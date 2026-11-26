// Event and error logger (runs in the MAIN page world).
// Each entry is kept in memory and sent to bridge.js, which persists it in chrome.storage.local.
(() => {
  const SSWC = (window.SSWC = window.SSWC || {});
  if (SSWC.log) return;

  SSWC.VERSION = "";
  SSWC.sessionId = Math.random().toString(36).slice(2, 10);
  SSWC.entries = [];
  SSWC.activeRun = null; // ID of the in-progress operation (create/send)
  const MAX_MEM = 3000;
  const listeners = new Set();
  const toggleListeners = new Set();

  // Keep the bridge handshake nonce private inside this closure.
  let bridgeNonce = null;
  let pendingBridge = [];
  let resolveReady = null;
  const readyPromise = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function postBridge(msg) {
    if (!bridgeNonce) return false;
    try {
      window.postMessage({ ...msg, nonce: bridgeNonce }, location.origin);
      return true;
    } catch (e) {
      return false;
    }
  }

  function maskIds(s) {
    // Mask long numbers (phone numbers, group IDs), keeping only the last 3 digits.
    return s.replace(/\d{7,}/g, (m) => "…" + m.slice(-3));
  }

  function sanitize(value, depth = 0) {
    if (value == null) return value;
    if (depth > 4) return "[max depth]";
    if (
      value instanceof Error ||
      (value && typeof value === "object" && "stack" in value && "message" in value)
    ) {
      return {
        name: value.name,
        message: maskIds(String(value.message)),
        stack: maskIds(String(value.stack || "")).slice(0, 4000),
      };
    }
    if (typeof Blob !== "undefined" && value instanceof Blob) {
      return { blob: true, size: value.size, type: value.type };
    }
    if (value instanceof ArrayBuffer) return { arrayBuffer: value.byteLength };
    if (ArrayBuffer.isView(value)) return { bytes: value.byteLength };
    if (typeof value === "string") {
      return maskIds(value.length > 3000 ? value.slice(0, 3000) + "…" : value);
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (typeof value === "bigint") return String(value);
    if (typeof value === "function") return "[function " + (value.name || "anonymous") + "]";
    if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
    if (typeof value === "object") {
      const out = {};
      let n = 0;
      for (const k of Object.keys(value)) {
        if (n++ > 60) {
          out["…"] = "more keys omitted";
          break;
        }
        try {
          out[k] = sanitize(value[k], depth + 1);
        } catch (e) {
          out[k] = "[unreadable]";
        }
      }
      return out;
    }
    return String(value);
  }

  function log(level, event, data) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      event,
      run: SSWC.activeRun,
      session: SSWC.sessionId,
      data: sanitize(data),
    };
    SSWC.entries.push(entry);
    if (SSWC.entries.length > MAX_MEM) SSWC.entries.splice(0, SSWC.entries.length - MAX_MEM);
    if (bridgeNonce) {
      postBridge({ __sswc: "log", entry });
    } else {
      pendingBridge.push(entry);
    }
    // Use console.debug only: console.warn/error would surface in chrome://extensions error log.
    console.debug("[SSWC]", level, event, entry.data ?? "");
    for (const l of listeners) {
      try {
        l(entry);
      } catch (e) {
        /* ignore listener error */
      }
    }
    return entry;
  }

  SSWC.log = log;
  SSWC.info = (event, data) => log("info", event, data);
  SSWC.warn = (event, data) => log("warn", event, data);
  SSWC.error = (event, data) => log("error", event, data);
  SSWC.onLog = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  SSWC.onTogglePanel = (fn) => {
    toggleListeners.add(fn);
    return () => toggleListeners.delete(fn);
  };
  SSWC.maskIds = maskIds;

  // Run fn inside a named operation; logs start, completion duration, and any thrown error.
  SSWC.run = async function (name, fn) {
    const prev = SSWC.activeRun;
    const id = name + "-" + Date.now().toString(36);
    SSWC.activeRun = id;
    const t0 = performance.now();
    log("info", name + ":start", null);
    try {
      const r = await fn();
      log("info", name + ":end", { ms: Math.round(performance.now() - t0) });
      return r;
    } catch (err) {
      log("error", name + ":error", { ms: Math.round(performance.now() - t0), error: err });
      throw err;
    } finally {
      SSWC.activeRun = prev;
    }
  };

  // Global errors: recorded if originating from the extension or while an operation is active.
  const EXT_MARK = "chrome-extension://";
  window.addEventListener(
    "error",
    (ev) => {
      const stack = (ev.error && ev.error.stack) || "";
      const fromExt = (ev.filename || "").startsWith(EXT_MARK) || stack.includes(EXT_MARK);
      if (!fromExt && !SSWC.activeRun) return;
      log("error", fromExt ? "global-error-extension" : "global-error-page", {
        message: ev.message,
        file: ev.filename,
        line: ev.lineno,
        col: ev.colno,
        error: ev.error,
      });
    },
    true
  );
  window.addEventListener("unhandledrejection", (ev) => {
    const r = ev.reason;
    const stack = (r && r.stack) || "";
    const fromExt = stack.includes(EXT_MARK);
    if (!fromExt && !SSWC.activeRun) return;
    log("error", fromExt ? "unhandled-rejection-extension" : "unhandled-rejection-page", {
      reason: r,
    });
  });

  // Request the full persisted log via bridge.js. Returns null on timeout.
  SSWC.getStoredLog = function () {
    return new Promise((resolve) => {
      if (!bridgeNonce) return resolve(null);
      const reqId = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", onMsg);
        resolve(null);
      }, 3000);
      function onMsg(ev) {
        const d = ev.data;
        if (
          ev.source !== window ||
          ev.origin !== location.origin ||
          !d ||
          d.__sswc !== "logResponse" ||
          d.nonce !== bridgeNonce ||
          d.reqId !== reqId
        ) {
          return;
        }
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        resolve(d.log || []);
      }
      window.addEventListener("message", onMsg);
      postBridge({ __sswc: "getLog", reqId });
    });
  };

  SSWC.clearStoredLog = function () {
    SSWC.entries.length = 0;
    pendingBridge = [];
    postBridge({ __sswc: "clearLog" });
  };

  SSWC.openLogPage = function () {
    postBridge({ __sswc: "openLog" });
  };

  SSWC.notifyUiReady = function () {
    postBridge({ __sswc: "uiReady" });
  };

  SSWC.whenReady = function (timeoutMs = 1000) {
    return Promise.race([readyPromise, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
  };

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== "object") return;
    if (d.__sswc === "init" && !bridgeNonce && typeof d.nonce === "string") {
      bridgeNonce = d.nonce;
      SSWC.VERSION = typeof d.version === "string" ? d.version : "1.0.0";
      if (typeof SSWC._setMessages === "function" && d.messages) {
        SSWC._setMessages(d.messages);
      } else {
        SSWC._pendingMessages = d.messages || null;
      }
      for (const entry of pendingBridge) postBridge({ __sswc: "log", entry });
      pendingBridge = [];
      log("info", "logger:ready", {
        version: SSWC.VERSION,
        url: location.href,
        ua: navigator.userAgent,
      });
      resolveReady();
      return;
    }
    if (d.__sswc === "togglePanel" && bridgeNonce && d.nonce === bridgeNonce) {
      for (const fn of toggleListeners) {
        try {
          fn();
        } catch (e) {
          /* ignore */
        }
      }
    }
  });

  window.postMessage({ __sswc: "hello" }, location.origin);
})();
