# Security Review

This document summarizes the security posture of the extension based on static inspection of all source files (`manifest.json`, `background.js`, `src/*.js`, `registro.html`, `registro.js`).

## 1. Network Activity & Remote Code

- **Zero network requests from extension code**: Static inspection confirms there are **no** calls to `fetch()`, `XMLHttpRequest`, `WebSocket`, `navigator.sendBeacon()`, `EventSource`, or external `<script>` / `<iframe>` / `importScripts()` URLs anywhere in the codebase.
- **No remote code**: All JavaScript executes from local extension files declared in `manifest.json`.
- **Exception (WhatsApp Web's own upload/send APIs)**: `src/wa.js` invokes WhatsApp Web's internal `WAWebUploadManagerMainThread` / `WAWebUploadManager` and `WAWebMediaPrep.sendToChat` only when the user explicitly clicks **Send**, which sends the user-created sticker/audio through WhatsApp Web's own authenticated session.
- **Donation link**: Removed. The original extension included an external donation link in the header; all donation/payment links have been removed in this fork.

## 2. DOM Injection & Code Execution Safety

- **No `eval` / `new Function`**: Neither `eval()`, `new Function()`, string-based `setTimeout`/`setInterval`, nor dynamic `import()` is used anywhere.
- **No `innerHTML` / `outerHTML` / `document.write`**:
  - `src/ui.js` builds all Shadow DOM elements exclusively with `document.createElement()` (`h()` helper) and `document.createTextNode()` / `.textContent` to comply with WhatsApp Web's Trusted Types policy.
  - `registro.js` populates the log viewer using `document.createElement("div")` and `.textContent`.
- **Shadow DOM isolation**: The panel mounts inside an open Shadow Root (`attachShadow({ mode: "open" })`) with `:host { all: initial; }` and `adoptedStyleSheets` (falling back to a `<style>` element inside the shadow root).

## 3. Permissions & Storage

From `manifest.json`:
- `"permissions": ["storage"]` — Used solely to store diagnostic/operation logs (`chrome.storage.local.get/set({ log })`, capped at 5,000 entries).
- `"host_permissions": ["https://web.whatsapp.com/*"]` — Restricts content script injection strictly to `https://web.whatsapp.com/*`.
- `localStorage` (WhatsApp Web origin) — Used by `ui.js` only for non-sensitive UI preferences (selected tab, duration-fit mode, sync offset ms, optional sticker pack/author strings).
- **ID masking in logs**: `src/logger.js` masks digit sequences of 7+ characters (`maskIds()`) with `"…<last3>"` before storing or exporting logs so phone numbers and chat/group IDs are redacted.

## 4. MAIN-World Execution Risk & Mitigations

- **Why MAIN world is used**: WhatsApp Web's internal module system (`window.require`, `importNamespace`, `requireLazy`) and runtime state (`ChatCollection`, `MediaPrep`, etc.) live in the page's `MAIN` JavaScript world and are inaccessible from an `ISOLATED` content script.
- **Inherent risks of MAIN-world execution**:
  1. **Shared global namespace**: Any script running in the page context (including WhatsApp Web itself or hypothetical XSS in the page) can read or overwrite globals (`window.WAAS`) or inspect/forge `window.postMessage` events sent to `src/bridge.js`.
  2. **Bridge message trust**: `src/bridge.js` mitigates arbitrary page-script spoofing by verifying `ev.source === window && ev.origin === location.origin`, rejecting invalid/oversized log entries (`> 16 KB`), and enforcing a one-time per-page random `crypto.randomUUID()` nonce handshake whose secret stays inside `src/logger.js`'s private closure.
  3. **Extension-page CSP**: `manifest.json` declares `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'self'" }`.
  4. **User controls & graceful degradation**: Users can toggle verbose WhatsApp internal log capture (`hookWALogger`) or clear stored logs at any time, and `src/wa.js` degrades gracefully if internal modules are missing (disabling Send while keeping local `.webp`/`.ogg` export working).
