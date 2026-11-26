# Architecture Overview

This document describes the architecture of the Chrome Manifest V3 extension as originally analyzed (v0.7.2, prior to English translation and rebranding).

## 1. Execution Worlds & Messaging Protocols

The extension separates privileged Chrome API access from WhatsApp Web's page context across three execution environments:

1. **Service Worker (`background.js`)**: Extension background context. Listens for toolbar icon clicks (`chrome.action.onClicked`) and runtime messages from content scripts.
2. **ISOLATED-world Content Script (`src/bridge.js`)**: Runs at `document_start` on `https://web.whatsapp.com/*`. Has access to `chrome.storage.local` and `chrome.runtime`, plus the shared `window` DOM/message channel, but cannot access page JS globals (`window.require`, etc.).
3. **MAIN-world Content Scripts (`src/logger.js`, `src/convert.js`, `src/wa.js`, `src/ui.js`, `src/main.js`)**: Run sequentially at `document_idle` in the `"MAIN"` world on `https://web.whatsapp.com/*`. They share the page's JavaScript global scope, allowing direct access to WhatsApp Web's internal module loader (`window.require`, `importNamespace`, `requireLazy`) as well as WebCodecs / `OffscreenCanvas` / Shadow DOM without CSP nonce issues for page-world JS.

### `window.postMessage` Protocol (MAIN <-> ISOLATED)

All page <-> bridge communication uses `window.postMessage(..., location.origin)` with a `__waas` discriminator property:

| Direction | `__waas` value | Payload fields | Purpose |
|---|---|---|---|
| MAIN -> ISOLATED | `log` | `entry` (`{ ts, level, event, run, session, data }`) | Queues a log entry in `bridge.js` (flushed every 400 ms or on `pagehide` to `chrome.storage.local`, capped at 5000 entries). |
| MAIN -> ISOLATED | `getLog` | `reqId` | Flushes pending log entries and requests the persisted `log` array from `chrome.storage.local`. |
| ISOLATED -> MAIN | `logResponse` | `reqId`, `log` | Returns the persisted `log` array matching `reqId`. |
| MAIN -> ISOLATED | `clearLog` | *(none)* | Clears the pending queue and resets `chrome.storage.local.log` to `[]`. |
| MAIN -> ISOLATED | `openLog` | *(none)* | Requests `bridge.js` to ask `background.js` to open the options/log viewer page. |
| MAIN -> ISOLATED | `uiReady` | *(none)* | Signals that the UI has mounted and is ready to receive `togglePanel`. |
| ISOLATED -> MAIN | `togglePanel` | *(none)* | Instructs `ui.js` to open or close the Shadow DOM modal overlay. |

### `chrome.runtime` / `chrome.tabs` Message Protocol (ISOLATED <-> Service Worker)

Messages use `{ waas: "..." }`:

| Direction | `waas` value | Channel | Purpose |
|---|---|---|---|
| Service Worker -> ISOLATED | `togglePanel` | `chrome.tabs.sendMessage` | Sent when the extension action icon is clicked on an active WhatsApp Web tab, or after a pending reload finishes (`pageReady`). If sending fails (tab predates extension load), `background.js` reloads the tab and adds `tabId` to `pendingOpen`. |
| ISOLATED -> Service Worker | `openLog` | `chrome.runtime.sendMessage` | Calls `chrome.runtime.openOptionsPage()` to open the log viewer (`registro.html`). |
| ISOLATED -> Service Worker | `pageReady` | `chrome.runtime.sendMessage` | Sent on `uiReady`; if `sender.tab.id` is in `pendingOpen`, `background.js` removes it and dispatches `togglePanel`. |

---

## 2. Media Conversion Pipeline (`src/convert.js`)

The conversion pipeline operates entirely client-side using Web APIs (`<video>`, `ImageDecoder`, `OffscreenCanvas`, `OfflineAudioContext`, WebCodecs `AudioEncoder`, `crypto.subtle`) with no WhatsApp dependencies.

### Stage 1: Media Capture (`analyze`)
1. **Source probing**:
   - Video: `loadVideo()` attaches a Blob URL to `<video>`, resolves start timestamp offsets (`_waasOffset` for trimmed videos that don't start at 0), and seeks near `v.duration` up to 8 times to force Chrome to finalize container duration.
   - Animated image (GIF/WebP/APNG): `openDecoder()` + `probeAnimation()` uses WebCodecs `ImageDecoder`, clamping frame durations `<= 10 ms` to `100 ms` to match browser playback behavior.
   - Still image: `probeImage()` decodes via `createImageBitmap()`.
2. **Capture parameters**:
   - `captureFpsFor(dur)` chooses capture FPS from `{30, 25, 20, 15, 12}` based on sticker duration (`<=10s -> 30`, `<=20s -> 25`, `<=40s -> 20`, `<=80s -> 15`, else `12`).
   - `captureSide` is capped at `512` and constrained by `CAPTURE_MEM_BYTES` (`320e6` bytes) across `ceil(capDur * captureFps)` RGBA frames (`floor(sqrt(320e6 / (4 * slots)))`, min `64`).
3. **Frame capture & fingerprinting**:
   - Video uses `captureBySeeking()` by default (exact midpoint sampling `(i + 0.5) / fps`) with `captureByPlayback()` (`requestVideoFrameCallback`) as fallback (or primary if requested).
   - `makeSnapper(side, mode)` draws onto a `side x side` `OffscreenCanvas` using fit (`Math.min`) or crop (`Math.max`), downscales to a `32 x 32` `OffscreenCanvas`, and extracts its raw RGBA bytes as a lightweight visual fingerprint (`fp`).
   - Animated GIF/WebP/APNG maps target timestamps modulo animation duration and decodes only distinct `frameIndex` values.
4. **Timeline fitting (`fitTimeline`)**:
   - Maps `captured` frames (`capDur`) onto the sticker duration `dur` at `captureFps`:
     - Repeat mode: `t % capDur`
     - Freeze mode: `Math.min(t, capDur)` (holds last frame)
     - Independent mode: `dur = vDur` (visual and audio keep independent durations).

### Stage 2: Frame Deduplication & Size Estimation Grid (`analyze`)
1. **Deduplication**: For each candidate FPS in `FPS_LIST = [30, 25, 20, 15, 12, 10, 8, 6, 5]` (`<= captureFps`), `plan()` maps output frame indices and counts `distinct[fps]` by comparing adjacent `fp` byte arrays (`sameBytes`). Consecutive identical frames are later merged by summing `durationMs`.
2. **Sample encoding**: Up to `M = 24` unique frames (golden-ratio spaced via `(i * 0.618) % 1` to avoid periodic aliasing) are encoded via `encodeStaticFrame` (`canvas.convertToBlob({ type: "image/webp", quality })`) at three qualities (`Q_BY_SIDE[side]`, `0.35`, `Q_MIN = 0.15`) for each `side` in `SIDES = [512, 448, 384, 320, 256, 224, 192, 160, 128, 96, 64]` (`<= captureSide`).
3. **Grid classification**:
   - `est = (sampleBytes[side][Q_BY_SIDE[side]] + 32) * distinct[fps] + 400`
   - `estMin = (sampleBytes[side][Q_MIN] + 32) * distinct[fps] + 400`
   - Against `SAFE_BYTES = 900_000` (margin under WhatsApp's `1_000_000` byte HTTP 413 limit): classified as `ok` (`est <= 900 KB`), `lowq`/`baja` (`estMin <= 900 KB`), `no` (exceeds 1 MB), or `na`/`fuera` (above `captureSide`/`captureFps`).
   - `score(side, fps)` ranks valid cells favoring smoothness (`>= 20 fps`) and penalizing resolutions `< 192 px`.

### Stage 3: Hand-Built Animated / Still WebP (`encodeWebp`, `buildAnimatedWebp`, `buildStillWebp`)
1. **Static frame extraction (`encodeStaticFrame`)**: Encodes each unique frame to static WebP via `OffscreenCanvas.convertToBlob`, parses RIFF/WEBP chunks (`readChunks`), and keeps only `ALPH`, `VP8 `, and `VP8L` sub-chunks.
2. **Quality search**: Starts at `Q_BY_SIDE[side]` and steps down by `0.1` toward `Q_MIN = 0.15`, using `sampleAvg()` ratios to skip intermediate qualities unlikely to fit under `MAX_STICKER_BYTES = 1_000_000`.
3. **Container assembly**:
   - `VP8X` chunk (10 bytes): flags `0x02` (animation, omitted for still WebP), `0x10` (alpha if any frame has `ALPH`/`VP8L`), `0x08` (EXIF present), plus 24-bit `(side - 1)` width & height.
   - `ANIM` chunk (6 bytes): background color `0`, infinite loop count `0`.
   - `ANMF` chunks: 16-byte header (`x=0, y=0`, 24-bit `side - 1` w/h, 24-bit `durationMs` with optional `syncMs` added to frame 0, flags `0x02` no-blend / no-dispose) + frame `ALPH`/`VP8 `/`VP8L` payload.
   - `EXIF` chunk: `exifWhatsApp(meta)` builds a big-endian TIFF header (`4D 4D 00 2A`) with a single IFD tag `0x5741` (`"WA"`, type `7` undefined) pointing to UTF-8 JSON at offset 26.
   - Wrapped in `RIFF <size> WEBP`.

### Stage 4: Audio Extraction, Opus Encoding, Ogg Muxing & `sound-sha256`
1. **Audio decode & trim (`decodeAudioFile`, `extractAudio`)**:
   - Decodes input audio/video via `OfflineAudioContext(1, 48000, 48000).decodeAudioData()`.
   - Renders the trimmed `[start, start + dur)` segment to mono 48 kHz PCM (`OfflineAudioContext(1, len, 48000)`), applying an 8 ms edge fade when using a separate audio file to avoid boundary clicks.
   - Computes adaptive bitrate: `clamp(12000, 32000, floor((0.9 * 1_000_000 * 8) / dur))`.
2. **Opus encode (`encodeOpus`)**:
   - Uses WebCodecs `AudioEncoder` (`opus`, 48 kHz, mono) feeding `AudioData` (`f32-planar`) in chunks of `960 * 50` samples (1 second).
   - Extracts `preSkip` from `decoderConfig.description` (`OpusHead` bytes 10–11 LE, defaulting to `312`).
3. **Ogg muxing (`buildOggOpus`, `oggPage`, `oggCrc`)**:
   - Generates a random 32-bit stream serial, builds RFC 7845 `OpusHead` (page 0, BOS flag `0x02`) and `OpusTags` (page 1, vendor string, 0 user comments), then packs up to 50 Opus packets (20 ms / 960 samples each) per Ogg page with monotonically increasing `granule` (`preSkip + cumulativeSamples`, capped at `preSkip + totalSamples` on the final EOS page `0x04`).
   - Computes RFC 3533 CRC-32 (`0x04c11db7` polynomial, unreflected, MSB-first) stored at page offset 22.
   - Verifies playability by round-tripping through `OfflineAudioContext.decodeAudioData`.
4. **EXIF binding (`sha256b64`, `stickerMeta`)**:
   - Computes base64-encoded SHA-256 of the complete `.ogg` byte array and embeds it in the WebP EXIF JSON under `"sound-sha256"`, along with `"sticker-pack-id"` (UUID or deterministic SHA-256-derived UUID from pack/publisher), optional `"sticker-pack-name"` / `"sticker-pack-publisher"`, and `"emojis": ["🔊"]`.

---

## 3. WhatsApp Web Integration (`src/wa.js`)

### Module Loader & Dependencies (`NEEDED`)
`wa.js` accesses WhatsApp Web's internal Meta/Comet module registry using:
- `window.importNamespace(name)` (preferred) or `window.require(name)` (`ns()` / `def()`)
- `window.requireLazy([name], cb)` (`load()`) for deferred modal modules.

The 21 modules listed in `NEEDED`:
1. `WAWebChatCollection`
2. `WAWebMsgCollection`
3. `WAWebMediaPrep`
4. `WAWebMediaOpaqueData`
5. `WAWebUploadManagerMainThread`
6. `WAWebUploadManager`
7. `WAWebCreateMediaUploadMetrics`
8. `WAWebMmsMediaTypes`
9. `WAWebMediaGetUploadOriginForChat`
10. `WAWebSoundStickerGating`
11. `WAWebSoundStickerUtils`
12. `WAWebABProps`
13. `WAWebModalManager`
14. `WAWebForwardMessageFlowLoadable`
15. `WAWebStateUtils`
16. `WAWebUserPrefsMeUser`
17. `WAWebFindChatAction`
18. `WAWebSendMsgResultAction`
19. `WAWebAck`
20. `WALogger`
21. `react`

### Force-Enabling Sound Stickers (`forceSoundStickers`)
1. Wraps `WAWebABProps.getABPropConfigValue` so calls for `sound_stickers_consumption_enabled`, `sound_stickers_creation_enabled`, and `sound_stickers_audio_playing_enabled` return `true`.
2. Checks `WAWebSoundStickerGating.isSoundStickerCreationEnabled()` and `isSoundStickerConsumptionEnabled()`; if still falsy (e.g., cached gating), overrides `isSoundStickerConsumptionEnabled`, `isSoundStickerCreationEnabled`, and `isSoundStickerPlaybackEnabled` to return `true`.

### Upload, Send, and Forward Flow (`publish`)
1. **Chat resolution**: Uses `WAWebChatCollection.ChatCollection.getActive()` for the open chat, or `getSelfChat()` which tries `WAWebUserPrefsMeUser` (`getMaybeMePnUser`, `getMeUserOrThrow`, `getMaybeMeLidUser`) and falls back to `WAWebFindChatAction.findOrCreateLatestChat(wid, "forwardSelectedModals")`.
2. **Audio upload (`uploadAudio`)**: Encrypts and uploads the `.ogg` Blob as `MEDIA_TYPES.AUDIO` (`WAWebMmsMediaTypes`) using `WAWebUploadManagerMainThread.encryptAndUpload(params, metrics)` (with `WAWebUploadManager.encryptAndUpload` fallback), `WAWebMediaGetUploadOriginForChat`, `WAWebCreateMediaUploadMetrics`, and a no-op `Proxy` for `uploadQpl`. Builds `stickerAudio` (`deprecatedMms3Url`, `directPath`, `mediaKey`, `mediaKeyTimestamp`, `filehash`, `encFilehash`, `size`, `mimetype: "audio/ogg; codecs=opus"`, `duration`) and validates it with `WAWebSoundStickerUtils.isCompleteStickerAudio(stickerAudio)`.
3. **Sticker send (`sendSticker`)**: Wraps the `.webp` Blob via `WAWebMediaOpaqueData.createFromData(webpBlob, "image/webp")`, constructs `new MediaPrep("sticker", Promise.resolve(data))`, and calls `prep.sendToChat({ chat, options: { stickerAudio } })`. Verifies `res.messageSendResult === WAWebSendMsgResultAction.SendMsgResult.OK`.
4. **Ack & Forward (`waitForAck`, `openForward`)**: Polls `msg.ack >= WAWebAck.ACK.SENT`, then lazy-loads `WAWebForwardMessageFlowLoadable`, unproxies the message model via `WAWebStateUtils.unproxy`, and opens WhatsApp's native modal via `WAWebModalManager.ModalManager.open(React.createElement(ForwardMessageFlowLoadable, ...))`.

---

## 4. Fragility Table

Every WhatsApp-internal symbol the extension relies on, and what breaks if WhatsApp Web renames, refactors, or removes it:

| Internal Dependency | Symbols Used | Impact if Changed / Removed |
|---|---|---|
| Global module loader | `window.require`, `window.__d`, `window.importNamespace`, `window.requireLazy` | Extension cannot detect WhatsApp readiness or load any internal module; sending/forwarding fails completely. |
| `window.Debug` | `Debug.VERSION` | Diagnostic log loses WhatsApp Web version string (non-fatal). |
| `WAWebChatCollection` | `ChatCollection.getActive()`, `ChatCollection.get()` | Readiness check (`waitForWA`) times out; cannot resolve active or self chat. |
| `WAWebUserPrefsMeUser` | `getMaybeMePnUser`, `getMeUserOrThrow`, `getMaybeMeLidUser` | "Save to my chat (You)" fails with self-WID lookup error. |
| `WAWebFindChatAction` | `findOrCreateLatestChat(wid, "forwardSelectedModals")` | Creating/opening self chat fails if not already in `ChatCollection`. |
| `WAWebABProps` | `getABPropConfigValue`, props `sound_stickers_consumption_enabled`, `sound_stickers_creation_enabled`, `sound_stickers_audio_playing_enabled`, `sound_stickers_channels_send_enabled` | Sound-sticker AB gate cannot be bypassed at prop level (falls back to `WAWebSoundStickerGating` override if present). |
| `WAWebSoundStickerGating` | `isSoundStickerConsumptionEnabled`, `isSoundStickerCreationEnabled`, `isSoundStickerPlaybackEnabled` | `forceSoundStickers()` fails; WhatsApp may strip `stickerAudio` when sending. |
| `WAWebSoundStickerUtils` | `isCompleteStickerAudio(stickerAudio)` | Upload validation throws even if upload succeeded, blocking send. |
| `WAWebMmsMediaTypes` | `MEDIA_TYPES.AUDIO` | Audio upload fails due to missing media type enum. |
| `WAWebMediaGetUploadOriginForChat` | default export `(chat)` | Minor: falls back to `uploadOrigin = 1` with a warning. |
| `WAWebCreateMediaUploadMetrics` | default export `(params)` | Minor: `MainThread` upload fails and falls back to `WAWebUploadManager`. |
| `WAWebUploadManagerMainThread` | default export `.encryptAndUpload(params, metrics)` | Falls back to `WAWebUploadManager`; if both change, audio upload fails completely. |
| `WAWebUploadManager` | default export `.encryptAndUpload(params)` | Fallback audio upload fails completely. |
| Upload response shape | `res.url`, `res.directPath`, `res.mediaKey`, `res.mediaKeyTimestamp`, `res.encFilehash` | `stickerAudio` metadata becomes incomplete; `isCompleteStickerAudio` rejects or server drops audio. |
| `WAWebMediaOpaqueData` | default export `.createFromData(blob, "image/webp")` | Cannot wrap WebP blob for `MediaPrep`; sticker sending fails. |
| `WAWebMediaPrep` | default export constructor `(type, dataPromise)`, `.sendToChat({ chat, options })` | Sticker sending fails completely; `options.stickerAudio` signature changes break sound attachment. |
| `WAWebSendMsgResultAction` | `SendMsgResult.OK` | Send result check throws even if sticker was sent. |
| `WAWebAck` | `ACK.SENT` | `waitForAck` fails or times out before opening Forward dialog. |
| `WAWebMsgCollection` | `MsgCollection.get(msg.id)` | Minor: falls back to raw `msg` object for Forward dialog. |
| `WAWebModalManager` | `ModalManager.open()`, `closeModalManager` / `ModalManager.close()` | Forward modal cannot open after sending. |
| `WAWebForwardMessageFlowLoadable` | `ForwardMessageFlowLoadable` React component (`msgs`, `onClose`, `onForward`) | Forward modal fails to open or render. |
| `WAWebStateUtils` | `unproxy(model)` | Passing a proxy model to `ForwardMessageFlowLoadable` may throw during React rendering. |
| `react` | `React.createElement` | Forward modal cannot be instantiated. |
| `WALogger` | `WALogger.LOG`, `WALogger.WARN`, `WALogger.ERROR` (tagged template literals) | Minor: internal WhatsApp diagnostic logs are not captured (send flow unaffected). |
