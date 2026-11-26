# Sound Stickers for Web Chat

Create animated or still stickers with sound from videos, images, or GIFs completely locally in your browser, ready to download or send in WhatsApp Web.

> **Disclaimer:** Unofficial. Not affiliated with or endorsed by WhatsApp or Meta.

## Important Warnings

- **Fragility & Account Risk:** To send sound stickers directly inside WhatsApp Web, this extension patches WhatsApp Web's internal feature flags (`WAWebABProps` / `WAWebSoundStickerGating`) and calls private client modules. Any WhatsApp Web update can break sending without notice, and modifying the client or using undocumented internal APIs may carry account restriction risks under WhatsApp's terms of service.
- **Distribution Note:** Because the Chrome Web Store may reject or later remove extensions that modify or hook third-party websites this way, **GitHub releases / unpacked installation** should be kept as the primary fallback distribution method. If sending ever breaks, local `.webp` + `.ogg` export still works.

## Features

- **Video with its own sound**: Trim a video clip, choose framing (**Fit** or **Crop**), calculate a resolution × FPS size grid under the 1 MB limit, and encode locally.
- **Image + audio**: Pair any still image (`JPG`, `PNG`, `WebP`) with an audio clip (`MP3`, `M4A`, `OGG`, `WAV`, or audio extracted from a video).
- **Video or GIF + audio**: Combine an animated GIF/WebP/APNG or muted video with a separate audio track, with options to keep durations independent, loop, or freeze the last frame.
- **100% local processing**: Uses `<video>`, `ImageDecoder`, `OffscreenCanvas`, `OfflineAudioContext`, and WebCodecs (`AudioEncoder`) directly in your browser.
- **Optional metadata**: Set pack name and author in the sticker's EXIF block, or download `.webp` and `.ogg` files directly.

## Limits & Supported Formats

- **Max size**: 1 MB (`1,000,000` bytes) for the WebP sticker and 1 MB for the Ogg/Opus audio file.
- **Visual inputs**: MP4, WebM, MOV, MKV videos; animated GIF, WebP, APNG; still JPG, PNG, WebP.
- **Audio inputs**: MP3, M4A, AAC, OGG, Opus, WAV, FLAC, or audio tracks inside video files.
- **Browser requirements**: Up-to-date Chromium-based browser (Chrome or Edge) supporting `OffscreenCanvas` WebP encoding, `AudioEncoder` (Opus), and `ImageDecoder`.

## Installation (Unpacked)

1. Download or build the release zip (`npm run build` produces `dist/sound-stickers-for-web-chat-1.0.0.zip`) and extract it to a folder.
2. Open `chrome://extensions` in Chrome or Edge.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the extracted folder (containing `manifest.json`).
5. Open `https://web.whatsapp.com`, sign in, and click the **Sound Stickers for Web Chat** toolbar icon.

## Usage

1. Click the extension icon while on `https://web.whatsapp.com` (or click it from any tab to focus/open WhatsApp Web).
2. Pick one of the three tabs (**Video**, **Image + audio**, or **Video or GIF + audio**).
3. Select your media and trim the clip using the timeline handles or start/end inputs.
4. Choose **Fit** or **Crop**, click **Calculate options** (for video/GIF tabs), and pick a cell in the size grid (`★` marks the recommended balance of smoothness and resolution).
5. Optionally enter **Pack** and **Author** names, click **Create sticker**, and preview the result.
6. Click **Send** (to the open chat or your self chat + Forward dialog) or **Download .webp and .ogg**.

## Privacy

- **Zero network requests from the extension**: No analytics, telemetry, ads, tracking, or external servers are used.
- **Local-only media processing**: Videos, images, and audio never leave your computer unless you explicitly click **Send** through your active WhatsApp Web session.
- **Local diagnostic logs**: Diagnostic events are stored locally in `chrome.storage.local` (capped at 5,000 entries), with 7+ digit phone numbers and IDs masked (`…123`). You can view, download, or clear logs at any time from the panel or the extension options page (`log.html`). See [PRIVACY.md](PRIVACY.md).

## Development

```bash
npm install
npm test            # Run Node unit tests for pure conversion & i18n helpers
npm run lint        # Run ESLint across all source, test, and tool files
npm run format:check
npm run check:security
npm run icons       # Regenerate PNG icons from icons/icon.svg
npm run build       # Create dist/sound-stickers-for-web-chat-1.0.0.zip
```

## Attribution & License

This project is a modified version of 'Stickers con sonido' by Shirtep. Changes: English translation, rebranding, removal of donation link, refactors.

- Required Notice: `Required Notice: Copyright Shirtep (https://github.com/Shirtep/WA-audio-stickers)`
- Licensed under the **PolyForm Noncommercial License 1.0.0** (see [LICENSE.md](LICENSE.md) and [NOTICE](NOTICE)). Noncommercial use only: no ads, paid features, donations, affiliate links, or analytics.
