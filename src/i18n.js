// Lightweight i18n helper for MAIN-world scripts.
// Receives localized message templates from bridge.js (chrome.i18n) during init.
(() => {
  if (typeof window !== "undefined") {
    const SSWC = (window.SSWC = window.SSWC || {});
    let messages = SSWC._pendingMessages || {};
    delete SSWC._pendingMessages;

    SSWC._setMessages = (bundle) => {
      if (bundle && typeof bundle === "object") messages = bundle;
    };

    SSWC.t = (key, subs) => formatMessage(messages, key, subs);
  }

  function formatMessage(bundle, key, subs) {
    const tpl = bundle && bundle[key];
    if (typeof tpl !== "string") return key;
    if (!subs) return tpl;
    const list = Array.isArray(subs) ? subs : [subs];
    return tpl.replace(/\$(\d+)/g, (_, idx) => {
      const i = Number(idx) - 1;
      return i >= 0 && i < list.length && list[i] != null ? String(list[i]) : "";
    });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { formatMessage };
  }
})();
