// Bridge (ISOLATED extension world):
// - persists logs in chrome.storage.local (survives reloads and displays in the log viewer page);
// - passes version and localized UI strings to MAIN world via a one-time per-page nonce handshake;
// - validates postMessage origin, schema, and entry size before acting.
(() => {
  const MAX_ENTRIES = 5000;
  const MAX_ENTRY_CHARS = 16384;
  const VALID_LEVELS = new Set(["info", "warn", "error"]);
  const SUB_TOKENS = ["$1", "$2", "$3", "$4", "$5", "$6", "$7", "$8", "$9"];
  const MESSAGE_KEYS = [
    "panelTitle",
    "panelSubtitle",
    "closeTitle",
    "disclaimerFooter",
    "unsupportedWebApp",
    "unsupportedHint",
    "tabVideoTitle",
    "tabVideoDesc",
    "tabImageTitle",
    "tabImageDesc",
    "tabMixTitle",
    "tabMixDesc",
    "secVideo",
    "secClip",
    "secImage",
    "secAudio",
    "secAnimation",
    "secFormat",
    "secCreateSend",
    "pickVideoBtn",
    "pickVideoHint",
    "pickImageBtn",
    "pickImageHint",
    "pickAnimBtn",
    "pickAnimHint",
    "pickAudioBtn",
    "pickAudioHint",
    "readingFile",
    "couldNotRead",
    "couldNotUse",
    "noSoundDetected",
    "gifFullUsed",
    "framesCount",
    "imageAnimatedNote",
    "errStillImageInMix",
    "trimVideoHint",
    "trimAudioHint",
    "trimMixVideoHint",
    "handleStartTitle",
    "handleEndTitle",
    "trackTitle",
    "playClip",
    "playFromCursor",
    "playClipEnd",
    "cursorLabel",
    "durationLabel",
    "startLabel",
    "endLabel",
    "stepBackTitle",
    "stepFwdTitle",
    "setStartCursor",
    "setStartCursorTitle",
    "setEndCursorTitle",
    "fitIfDifferent",
    "fitIndependent",
    "fitRepeat",
    "fitFreeze",
    "mixPromptSelect",
    "mixSameDuration",
    "mixDurationsLine",
    "mixIndependentDesc",
    "mixAnimLonger",
    "mixRepeatDesc",
    "mixFreezeDesc",
    "testTogetherBtn",
    "testTogetherHint",
    "framingLabel",
    "modeFit",
    "modeCrop",
    "calcOptionsBtn",
    "calcHint",
    "calcStale",
    "calcReady",
    "calcCancelled",
    "calcError",
    "gridHeaderCorner",
    "legendFits",
    "legendLowQ",
    "legendTooBig",
    "legendNotes",
    "cellUnavailable",
    "cellExceeds",
    "cellLowQ",
    "cellOk",
    "selectedCell",
    "selectedLowQSuffix",
    "noCellFits",
    "advancedSummary",
    "syncOffsetLabel",
    "syncOffsetHint",
    "stillStickerLabel",
    "stillStickerDesc",
    "metaHint",
    "packLabel",
    "packPlaceholder",
    "authorLabel",
    "authorPlaceholder",
    "createBtn",
    "createDoneBtn",
    "createChangedBtn",
    "cancelBtn",
    "staleStickerNote",
    "previewAlt",
    "imageAlt",
    "gifAlt",
    "watchHearBtn",
    "destOpenOnly",
    "destOpenForward",
    "destSelfForward",
    "sendBtn",
    "downloadBtn",
    "stickerReadyStatus",
    "sendSuccessOpen",
    "sendSuccessForward",
    "sendErrorStatus",
    "resInfoSummary",
    "resInfoDurPair",
    "resInfoStill",
    "resInfoEst",
    "toolsSummary",
    "diagnoseBtn",
    "saveLogBtn",
    "viewLogBtn",
    "clearLogBtn",
    "clearLogDone",
    "hookWaLogsLabel",
    "jsonFilterDesc",
  ];

  const NONCE = crypto.randomUUID();
  let handshakeDone = false;
  let queue = [];
  let timer = null;
  let writing = Promise.resolve();

  function buildMessagesBundle() {
    const out = {};
    for (const k of MESSAGE_KEYS) {
      const val = chrome.i18n.getMessage(k, SUB_TOKENS);
      if (val) out[k] = val;
    }
    return out;
  }

  function sanitizeEntry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (typeof raw.ts !== "string" || raw.ts.length > 40) return null;
    if (!VALID_LEVELS.has(raw.level)) return null;
    if (typeof raw.event !== "string" || raw.event.length === 0 || raw.event.length > 120) {
      return null;
    }
    const entry = {
      ts: raw.ts,
      level: raw.level,
      event: raw.event,
      run: typeof raw.run === "string" ? raw.run.slice(0, 80) : null,
      session: typeof raw.session === "string" ? raw.session.slice(0, 32) : null,
      data: raw.data === undefined ? null : raw.data,
    };
    try {
      const serialized = JSON.stringify(entry);
      if (serialized.length > MAX_ENTRY_CHARS) {
        entry.data = { truncated: true, originalChars: serialized.length };
      }
      return entry;
    } catch (e) {
      return null;
    }
  }

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const batch = queue;
    queue = [];
    if (!batch.length) return writing;
    writing = writing.then(
      () =>
        new Promise((resolve) => {
          chrome.storage.local.get({ log: [] }, (res) => {
            let log = (res.log || []).concat(batch);
            if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
            chrome.storage.local.set({ log }, resolve);
          });
        })
    );
    return writing;
  }

  window.addEventListener("message", (ev) => {
    if (ev.source !== window || ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== "object" || Array.isArray(d)) return;
    if (typeof d.__sswc !== "string") return;

    if (d.__sswc === "hello") {
      if (handshakeDone) return;
      handshakeDone = true;
      window.postMessage(
        {
          __sswc: "init",
          nonce: NONCE,
          version: chrome.runtime.getManifest().version,
          messages: buildMessagesBundle(),
        },
        location.origin
      );
      return;
    }

    if (typeof d.nonce !== "string" || d.nonce !== NONCE) return;

    if (d.__sswc === "log") {
      const entry = sanitizeEntry(d.entry);
      if (!entry) return;
      queue.push(entry);
      if (queue.length >= 50) flush();
      else if (!timer) timer = setTimeout(flush, 400);
    } else if (d.__sswc === "getLog") {
      if (typeof d.reqId !== "string" || !d.reqId || d.reqId.length > 64) return;
      flush().then(() => {
        chrome.storage.local.get({ log: [] }, (res) => {
          window.postMessage(
            { __sswc: "logResponse", nonce: NONCE, reqId: d.reqId, log: res.log || [] },
            location.origin
          );
        });
      });
    } else if (d.__sswc === "clearLog") {
      queue = [];
      writing = writing.then(
        () => new Promise((resolve) => chrome.storage.local.set({ log: [] }, resolve))
      );
    } else if (d.__sswc === "openLog") {
      chrome.runtime.sendMessage({ sswc: "openLog" }).catch(() => {});
    } else if (d.__sswc === "uiReady") {
      chrome.runtime.sendMessage({ sswc: "pageReady" }).catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.sswc === "togglePanel") {
      window.postMessage({ __sswc: "togglePanel", nonce: NONCE }, location.origin);
    }
  });

  window.addEventListener("pagehide", () => {
    flush();
  });
})();
