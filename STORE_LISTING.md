# Chrome Web Store Listing Draft

## Product Name
Sound Stickers for Web Chat

## Short Description (126 / 132 characters max)
Create animated or still stickers with sound from videos, GIFs, or images locally in your browser for use with WhatsApp Web.

## Long Description
Create custom animated or still stickers with sound directly in your browser—no external servers, no uploads to third-party sites, and no account required.

Sound Stickers for Web Chat turns videos, still images, and animated GIFs paired with audio into compact WebP stickers with Ogg/Opus audio for use with WhatsApp Web.

Features:
- Three creation modes: Video with its own sound, Image + audio, and Video or GIF + custom audio.
- Interactive timeline trimmer with waveform preview and frame-accurate start/end handles.
- Automatic size estimator grid (resolution × FPS) that keeps stickers under the 1 MB limit.
- Fit (transparent borders) or Crop (fill square) framing options, plus loop, freeze, or independent duration modes.
- 100% local in-browser processing using WebCodecs, OffscreenCanvas, and WebAudio.
- Download `.webp` and `.ogg` files directly, or send directly from your open WhatsApp Web session.
- Optional pack name and author metadata.

Privacy & Transparency:
- Zero ads, zero analytics, zero tracking, and zero external network requests.
- Free and noncommercial.

Disclaimer:
Unofficial. Not affiliated with or endorsed by WhatsApp or Meta.

## Single-Purpose Statement
This extension has a single purpose: enabling users to convert local video, image, GIF, and audio files into sound-enabled WebP/Ogg stickers in the browser for use with WhatsApp Web.

## Permission Justifications

### `storage`
Used solely to persist local diagnostic and error logs (`chrome.storage.local`, capped at 5,000 entries) so users can inspect, export, or clear troubleshooting logs on the extension's options page (`log.html`). No personal data is collected or transmitted externally.

### Host Permission: `https://web.whatsapp.com/*`
Required exclusively to inject the extension's Shadow DOM sticker-creation panel onto WhatsApp Web when the user clicks the extension toolbar icon and, when the user explicitly clicks **Send**, to upload the audio and send the created sticker through their active WhatsApp Web session.

## Remote Code Statement
No remote code is used. All JavaScript, HTML, CSS, and localization assets are packaged locally inside the extension bundle. The extension executes zero `eval()`, `new Function()`, or external script/network requests.
