# Manual Test Checklist

Use this checklist in Chromium (Chrome / Edge) on `https://web.whatsapp.com` after building or loading the unpacked extension.

## 1. Installation & Lifecycle
- [ ] **Fresh install**: Unzip `dist/sound-stickers-for-web-chat-1.0.0.zip` into a folder and load via `chrome://extensions` -> **Load unpacked**. Confirm zero manifest/service-worker errors.
- [ ] **Panel open/close**: Open `https://web.whatsapp.com`, click the extension toolbar icon, confirm the Shadow DOM panel opens cleanly, and click `×` or the dark backdrop to close and reopen it.
- [ ] **Reload extension while tab is open**: Keep an open `web.whatsapp.com` tab, click **Reload** on `chrome://extensions`, then click the extension icon. Confirm `background.js` detects the missing content script, reloads the tab, and automatically opens the panel once `pageReady` fires.
- [ ] **Legacy storage migration**: Pre-seed `waas-metadatos`, `waas-compensacion-ms`, `waas-ajuste-duracion-v2`, `waas-pestana` in `localStorage`, reload, and verify settings migrate into `sswc-*` keys.

## 2. Conversion Modes
- [ ] **Video + sound**: In the **Video** tab, load an `.mp4`/`.webm` with audio, drag start/end handles, click **Calculate options**, verify the resolution × fps grid renders with `★` recommendation, click **Create sticker**, and preview video+audio together.
- [ ] **Image + audio**: In the **Image + audio** tab, load a `.png`/`.jpg`/`.webp` image and an audio clip (`.mp3`/`.wav`/`.ogg`), test both default (1-frame animated WebP) and **Send as still image (experimental)**, and create the sticker.
- [ ] **GIF + audio**: In the **Video or GIF + audio** tab, load an animated `.gif` (or animated `.webp`/`.apng`) plus an audio clip, verify frame count and duration readout, and create the sticker.
- [ ] **Duration fit modes** (when visual and audio durations differ):
  - [ ] **Keep each duration independent**: Verify changing the audio selection does not mark the calculated grid stale.
  - [ ] **Loop animation until audio ends**: Verify summary shows repeat count (with English decimal `.`) and output WebP loops to match audio duration.
  - [ ] **Hold last frame until audio ends**: Verify output WebP holds the final frame until audio ends.
- [ ] **Framing modes**: Test both **Fit (transparent borders)** and **Crop (fill square)** and confirm preview aspect ratio matches.

## 3. Limits, Cancellation & Downloads
- [ ] **1 MB limit behavior**: Pick a long/complex video clip (e.g. 20–30 s). Verify high-res/high-fps cells show `✕` (exceeds 1 MB), amber cells note lower quality, and a very long clip with no fitting cells disables creation with `"No combination fits under 1 MB: shorten the clip."`.
- [ ] **Cancel mid-run**: Click **Calculate options** or **Create sticker** on a multi-second video, click **Cancel** mid-progress, confirm status displays `Cancelled`, UI unlocks, and no orphaned errors appear.
- [ ] **Download files**: Click **Download .webp and .ogg**, confirm both `<name>.webp` and `<name>.ogg` download and play/render locally.

## 4. Sending & Graceful Degradation
- [ ] **Send to open chat**: Open a test chat, select **Send to open chat**, click **Send**, and verify the sticker arrives with playable audio.
- [ ] **Send to self chat + Forward dialog**: Select **Save to my chat (You) and open Forward**, click **Send**, verify the sticker is saved in your self chat and the native **Forward** modal opens after server ACK.
- [ ] **Unsupported / missing internals**: Simulate missing internal modules (or inspect behavior before WhatsApp finishes loading). Confirm `"This version of the web app is not supported yet. Sending is disabled, but you can still create and download .webp and .ogg files."` displays without stack traces, **Send** is disabled, and **Download .webp and .ogg** remains enabled.

## 5. Logging & Privacy Controls
- [ ] **Verbose WA log toggle**: Uncheck **Capture web app internal logs (verbose)** in **Diagnostics and logs**, send or run diagnostics, and confirm `wa-log`/`wa-warn` entries stop recording.
- [ ] **Clear log**: Click **Clear log** in the panel and verify both the in-panel log box and `log.html` (`chrome.storage.local`) are cleared.
- [ ] **Full log page**: Click **Open full log**, verify `log.html` opens, test **Errors only**, **Copy**, **Download log (.json)**, and verify phone numbers/IDs (`7+` digits) are masked with `…<last3>`.
