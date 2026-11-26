# Privacy Policy — Sound Stickers for Web Chat

**Effective Date:** 2026-11-26

Sound Stickers for Web Chat is a free, noncommercial browser extension designed to convert videos, images, GIFs, and audio into stickers with sound locally inside your browser.

## Data Collection

**We do not collect, transmit, store remotely, sell, or share any personal or usage data.**

- There are **no** analytics, telemetry, crash-reporting servers, advertising SDKs, affiliate links, or external network requests made by this extension.
- All video, image, GIF, and audio decoding, trimming, and encoding (`WebP` and `Ogg/Opus`) occur 100% locally on your device using standard browser APIs.
- Media files you select remain on your device unless and until you explicitly click **Send** to transmit a sticker through your own authenticated WhatsApp Web session.

## Local Storage

The extension stores only two categories of data locally on your device:

1. **Diagnostic Log (`chrome.storage.local`)**: Stores up to 5,000 local diagnostic entries (timestamps, operation names, encoding timings, and errors) to help you troubleshoot issues. Long numeric identifiers (7+ digits, such as phone numbers or chat IDs) are automatically masked (`…last3digits`) before being saved. Logs never leave your device unless you manually download and share the exported `.json` file. You can clear the log at any time via the **Clear log** button in the panel or the options page.
2. **UI Preferences (`localStorage` on `web.whatsapp.com`)**: Stores non-sensitive interface preferences such as your last active tab, duration-fit mode, sync offset (ms), optional sticker pack/author labels, and whether verbose web-app log capture is enabled.

## Permissions

- `storage`: Used exclusively to save and display the local diagnostic log in `chrome.storage.local`.
- `https://web.whatsapp.com/*`: Used solely to mount the extension's UI panel on WhatsApp Web and interact with the active web session when you click **Send**.

## Contact & Source

This extension is noncommercial open-source software licensed under the PolyForm Noncommercial License 1.0.0.
