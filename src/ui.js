// UI: Shadow DOM panel opened by the extension toolbar button.
// Three tabs: video with its own sound, still image + audio, and video or GIF + another audio.
// Built strictly with createElement / textContent to satisfy Trusted Types.
(() => {
  const SSWC = (window.SSWC = window.SSWC || {});
  const log = (lvl, ev, data) => SSWC.log(lvl, ev, data);
  const t = (key, subs) => (SSWC.t ? SSWC.t(key, subs) : key);
  const FRAME = 1 / 30; // fine-step increment
  const MIN_LEN = 0.3; // minimum clip duration
  const DEFAULT_LEN = 10; // default initial clip selection

  const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Segoe UI", "Helvetica Neue", Helvetica, "Lucida Grande", Arial, sans-serif; }

.overlay { position: fixed; inset: 0; z-index: 2147483001; background: rgba(11,20,26,.6); display: flex; align-items: center; justify-content: center; }

/* Light theme (default) */
.panel {
  --bg:#ffffff; --fg:#111b21; --muted:#667781; --card:#f0f2f5; --line:#e9edef; --hover:#f5f6f6;
  --input:#ffffff; --accent:#00a884; --accent-hover:#008f72; --accent-fg:#ffffff;
  --pill:#d9fdd3; --pill-fg:#008069;
  --ok:#00a884; --ok-bg:#d9fdd3; --warn:#b7791f; --warn-bg:#fff3cd; --no:#8696a0; --err:#ea0038;
  width: min(640px, 96vw); max-height: 92vh; overflow: auto;
  background: var(--bg); color: var(--fg);
  border-radius: 3px; padding: 0 0 12px; font-size: 14.2px; line-height: 1.4;
  box-shadow: 0 17px 50px 0 rgba(11,20,26,.19), 0 12px 15px 0 rgba(11,20,26,.24);
}
/* Dark theme (applied when WhatsApp Web has body.dark) */
.panel.dark {
  --bg:#111b21; --fg:#e9edef; --muted:#8696a0; --card:#202c33; --line:#222d34; --hover:#2a3942;
  --input:#2a3942; --accent:#00a884; --accent-hover:#06cf9c; --accent-fg:#0b141a;
  --pill:#103529; --pill-fg:#21c063;
  --ok:#21c063; --ok-bg:#005c4b; --warn:#ffd279; --warn-bg:#3b3320; --no:#667781; --err:#f15c6d;
  box-shadow: 0 17px 50px 0 rgba(0,0,0,.5);
}
.panel::-webkit-scrollbar { width: 6px; }
.panel::-webkit-scrollbar-thumb { background: rgba(134,150,160,.4); }

/* Header: like the WhatsApp Web panel header strip */
header { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 20px; background: var(--card); margin: 0; }
h2 { margin: 0; font-size: 19px; font-weight: 400; }
.muted { color: var(--muted); font-size: 12.5px; }
.hdr-r { display: flex; align-items: center; gap: 8px; flex: none; }
.close { width: 34px; height: 34px; border-radius: 50%; background: none; border: none; font-size: 22px; line-height: 1; color: var(--muted); }
.close:hover { background: var(--hover); }
.note { color: var(--warn); font-size: 12.5px; }
.warn-banner { background: var(--warn-bg); color: var(--fg); border-radius: 7.5px; padding: 8px 12px; font-size: 13px; margin: 10px 20px 0; }

/* Tabs as pill filters, like the chat-list filters */
.tabs { display: flex; gap: 8px; padding: 12px 20px 4px; margin: 0; border: none; }
.tabs button { border: 1px solid var(--line); background: var(--bg); color: var(--muted); padding: 5px 13px; font-size: 14px; font-weight: 400; border-radius: 16px; margin: 0; }
.tabs button:hover { background: var(--hover); }
.tabs button.on { background: var(--pill); color: var(--pill-fg); border-color: transparent; }
.tabs button:disabled { opacity: .5; }
.tabdesc { margin: 6px 20px 0; }

/* Content blocks */
section { background: var(--card); border-radius: 8px; padding: 12px 16px; margin: 10px 20px; }
section.off { opacity: .45; pointer-events: none; }
h3 { margin: 0 0 8px; font-size: 14.2px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
h3 .n { display: inline-flex; width: 20px; height: 20px; border-radius: 50%; background: transparent; border: 1.5px solid var(--accent); color: var(--accent); align-items: center; justify-content: center; font-size: 11px; font-weight: 600; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 6px 0; }
.grow { flex: 1; }

/* Buttons */
button { font: inherit; cursor: pointer; }
button:disabled { opacity: .4; cursor: default; }
.act { padding: 8px 20px; border-radius: 24px; border: none; background: var(--accent); color: var(--accent-fg); font-weight: 500; }
.act:hover:not(:disabled) { background: var(--accent-hover); }
.sec { padding: 5px 13px; border-radius: 16px; border: 1px solid var(--line); background: transparent; color: var(--fg); font-size: 13px; }
.sec:hover:not(:disabled) { background: var(--hover); }
.icon { width: 30px; padding: 4px 0; text-align: center; }

/* Inputs */
input[type=text], input[type=number], select { padding: 6px 10px; border-radius: 8px; border: 1px solid transparent; background: var(--input); color: var(--fg); font: inherit; max-width: 100%; }
input[type=text] { width: 220px; }
input[type=number] { width: 80px; }
input:focus, select:focus { outline: none; border-color: var(--accent); }
.meta { display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; margin: 4px 0 10px; }
label.chk { display: flex; gap: 8px; align-items: flex-start; margin: 6px 0; }
input[type=checkbox] { accent-color: var(--accent); }

/* Media */
video { display: block; width: 100%; max-height: 260px; background: #000; border-radius: 8px; }
.thumb { width: 150px; height: 150px; object-fit: contain; border-radius: 8px; background: repeating-conic-gradient(#d1d7db 0 25%, #e9edef 0 50%) 50% / 16px 16px; }
.panel.dark .thumb { background: repeating-conic-gradient(#2a3942 0 25%, #202c33 0 50%) 50% / 16px 16px; }

/* Timeline */
.track { position: relative; height: 34px; margin: 14px 8px 6px; background: var(--line); border-radius: 6px; cursor: pointer; touch-action: none; user-select: none; }
.panel.dark .track { background: #2a3942; }
.track.audio { height: 48px; }
.track canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.track .sel { position: absolute; top: 0; bottom: 0; background: rgba(0,168,132,.28); border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent); pointer-events: none; }
.track .handle { position: absolute; top: -4px; bottom: -4px; width: 12px; margin-left: -6px; background: var(--accent); border-radius: 4px; cursor: ew-resize; }
.track .handle::after { content: ""; position: absolute; left: 4px; top: 10px; bottom: 10px; width: 4px; border-left: 1px solid rgba(255,255,255,.85); border-right: 1px solid rgba(255,255,255,.85); }
.track .ph { position: absolute; top: -6px; bottom: -6px; width: 2px; margin-left: -1px; background: var(--fg); pointer-events: none; }
.times { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); margin: 0 8px; }
.trim { display: grid; grid-template-columns: auto auto 1fr; gap: 6px 10px; align-items: center; }

/* Segmented control for framing */
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.seg button { border: none; padding: 5px 13px; background: transparent; color: var(--muted); font-size: 13px; }
.seg button:hover:not(:disabled) { background: var(--hover); }
.seg button.on { background: var(--pill); color: var(--pill-fg); }
.summary { background: var(--bg); border-radius: 8px; padding: 8px 12px; margin: 6px 0; font-size: 13.5px; }

/* Size grid */
table.grid { border-collapse: separate; border-spacing: 3px; margin: 6px 0; font-size: 12px; }
table.grid th { color: var(--muted); font-weight: 500; padding: 2px 4px; text-align: center; }
table.grid th.side { text-align: right; }
table.grid td button { width: 52px; padding: 5px 0; border-radius: 6px; border: 1px solid transparent; font-size: 12px; background: transparent; color: var(--no); }
table.grid td button.ok { background: var(--ok-bg); color: var(--fg); }
table.grid td button.lowq { background: var(--warn-bg); color: var(--fg); }
table.grid td button.ok:hover:not(:disabled), table.grid td button.lowq:hover:not(:disabled) { border-color: var(--accent); }
table.grid td button.no, table.grid td button.na { cursor: default; opacity: .55; }
table.grid td button.sel { border-color: var(--fg); font-weight: 600; }
.legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 4px; }

/* Status */
.stale { color: var(--warn); font-size: 13px; font-weight: 500; }
.bar { height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; margin-top: 8px; }
.bar > div { height: 100%; width: 0; background: var(--accent); transition: width .2s; }
.status { font-size: 13.5px; margin: 6px 0 0; min-height: 18px; }
.status.err { color: var(--err); font-weight: 500; }
.result { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
audio { max-width: 100%; }

/* Tools / log */
details { margin-top: 8px; }
summary { cursor: pointer; color: var(--muted); font-size: 13px; }
.logbox { max-height: 150px; overflow: auto; font: 11px/1.4 ui-monospace, Consolas, monospace; background: var(--bg); padding: 6px 8px; border-radius: 6px; white-space: pre-wrap; margin-top: 6px; }
.logbox .e { color: var(--err); } .logbox .w { color: var(--warn); }
.panel > details { margin-left: 20px; margin-right: 20px; }
footer { margin: 10px 20px 0; padding-top: 8px; border-top: 1px solid var(--line); text-align: center; }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  function attachStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      log("warn", "ui:styles-fallback", e);
      root.append(h("style", { textContent: CSS }));
    }
  }

  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 2000);
  }

  async function saveLog() {
    const stored = await SSWC.getStoredLog();
    const entries = stored && stored.length ? stored : SSWC.entries;
    const content = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: SSWC.VERSION,
        ua: navigator.userAgent,
        entries,
      },
      null,
      1
    );
    const blob = new Blob([content], { type: "application/json" });
    const name =
      "sound-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: t("jsonFilterDesc"), accept: { "application/json": [".json"] } }],
        });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        log("info", "log:saved", { name: handle.name, entries: entries.length });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        log("warn", "log:picker-failed", e);
      }
    }
    download(blob, name);
    log("info", "log:downloaded", { name, entries: entries.length });
  }
  SSWC.saveLog = saveLog;

  const fmtT = (sec) =>
    sec >= 60
      ? Math.floor(sec / 60) + ":" + (sec % 60).toFixed(2).padStart(5, "0")
      : sec.toFixed(2) + " s";
  const fmtB = (b) => (b >= 1e6 ? (b / 1e6).toFixed(2) + " MB" : Math.round(b / 1000) + " KB");
  const isDark = () => {
    try {
      return (
        document.body.classList.contains("dark") ||
        document.documentElement.classList.contains("dark") ||
        matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return false;
    }
  };
  const store = {
    get(k, def) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? def : JSON.parse(v);
      } catch (e) {
        return def;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* storage unavailable */
      }
    },
  };

  // One-time migration from legacy v0.7.2 localStorage keys so existing user settings carry over.
  function migrateLegacyStorage() {
    try {
      if (localStorage.getItem("sswc-migrated-v1")) return;
      const syncOld = localStorage.getItem("waas-compensacion-ms");
      if (syncOld != null && localStorage.getItem("sswc-sync-offset-ms") == null) {
        localStorage.setItem("sswc-sync-offset-ms", syncOld);
      }
      const metaOld = store.get("waas-metadatos", null);
      if (metaOld && localStorage.getItem("sswc-metadata") == null) {
        store.set("sswc-metadata", {
          pack: metaOld.paquete || "",
          author: metaOld.autor || "",
        });
      }
      const fitMap = {
        independiente: "independent",
        repetir: "repeat",
        congelar: "freeze",
      };
      const fitOld = store.get("waas-ajuste-duracion-v2", null);
      if (fitOld && fitMap[fitOld] && localStorage.getItem("sswc-fit-mode-v2") == null) {
        store.set("sswc-fit-mode-v2", fitMap[fitOld]);
      }
      const tabMap = { video: "video", imagen: "image", mezcla: "mix" };
      const tabOld = store.get("waas-pestana", null);
      if (tabOld && tabMap[tabOld] && localStorage.getItem("sswc-active-tab") == null) {
        store.set("sswc-active-tab", tabMap[tabOld]);
      }
      localStorage.setItem("sswc-migrated-v1", "1");
    } catch (e) {
      /* ignore storage errors */
    }
  }

  const baseName = (f) => (f && f.name.replace(/\.[^.]+$/, "")) || "sticker";

  function mount() {
    if (document.getElementById("sswc-root")) return;
    migrateLegacyStorage();
    SSWC.settings = {
      hookWaLogs: store.get("sswc-hook-wa-logs", true) !== false,
    };

    const host = h("div", { id: "sswc-root" });
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    attachStyles(root);

    // Shared UI state: only one conversion/send operation can run at a time.
    const G = {
      busy: false,
      waSupported: true,
      forms: [],
      refreshTabs: () => {},
    };
    const setBusy = (b) => {
      G.busy = b;
      G.forms.forEach((f) => f.refresh());
      G.refreshTabs();
    };
    const run = async (name, fn) => {
      const ac = new AbortController();
      G.abort = ac;
      setBusy(true);
      try {
        return await SSWC.run(name, () => fn(ac.signal));
      } finally {
        G.abort = null;
        setBusy(false);
      }
    };

    // ============================================================ timeline trimmer
    function makeTrimmer(kind, hint) {
      const isVideo = kind === "video";
      const media = isVideo
        ? h("video", { playsInline: true, preload: "auto" })
        : h("audio", { preload: "auto" });
      const wave = isVideo ? null : h("canvas");
      const selBar = h("div", { class: "sel" });
      const hS = h("div", { class: "handle", title: t("handleStartTitle") });
      const hE = h("div", { class: "handle", title: t("handleEndTitle") });
      const ph = h("div", { class: "ph" });
      const track = h(
        "div",
        { class: "track" + (isVideo ? "" : " audio"), title: t("trackTitle") },
        wave,
        selBar,
        ph,
        hS,
        hE
      );
      const tLeft = h("span");
      const tRight = h("span");
      const playSegBtn = h("button", { class: "sec", textContent: t("playClip") });
      const playCurBtn = h("button", { class: "sec", textContent: t("playFromCursor") });
      const playEndBtn = h("button", { class: "sec", textContent: t("playClipEnd") });
      const curLbl = h("span", { class: "muted grow", style: "text-align:right" });
      const startNum = h("input", { type: "number", min: 0, step: 0.01 });
      const endNum = h("input", { type: "number", min: 0, step: 0.01 });
      const startCur = h("button", {
        class: "sec",
        textContent: t("setStartCursor"),
        title: t("setStartCursorTitle"),
      });
      const endCur = h("button", {
        class: "sec",
        textContent: t("setStartCursor"),
        title: t("setEndCursorTitle"),
      });
      const lenLbl = h("span", { class: "muted" });
      const tr = {
        start: 0,
        end: 0,
        playhead: 0,
        stopAt: null,
        dur: 0,
        offset: 0,
        url: null,
        peaks: null,
        peakMax: 1,
        muted: false,
      };
      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());
      const mkStep = (txt, title, fn) =>
        h("button", { class: "sec icon", textContent: txt, title, onclick: fn });
      const el = h(
        "div",
        null,
        isVideo ? media : null,
        track,
        h("div", { class: "times" }, tLeft, tRight),
        h("div", { class: "row" }, playSegBtn, playCurBtn, playEndBtn, curLbl),
        h(
          "div",
          { class: "trim" },
          h("span", null, t("startLabel")),
          h(
            "span",
            { class: "row", style: "margin:0" },
            mkStep("−", t("stepBackTitle"), () => setStart(tr.start - FRAME)),
            startNum,
            mkStep("+", t("stepFwdTitle"), () => setStart(tr.start + FRAME))
          ),
          h("span", { class: "row", style: "margin:0" }, startCur),
          h("span", null, t("endLabel")),
          h(
            "span",
            { class: "row", style: "margin:0" },
            mkStep("−", t("stepBackTitle"), () => setEnd(tr.end - FRAME)),
            endNum,
            mkStep("+", t("stepFwdTitle"), () => setEnd(tr.end + FRAME))
          ),
          h("span", { class: "row", style: "margin:0" }, endCur, lenLbl)
        ),
        hint ? h("div", { class: "muted", style: "margin-top:6px" }, hint) : null
      );

      const layout = () => {
        const d = tr.dur || 1;
        const pct = (x) => Math.max(0, Math.min(100, (x / d) * 100)) + "%";
        selBar.style.left = pct(tr.start);
        selBar.style.width = Math.max(0, ((tr.end - tr.start) / d) * 100) + "%";
        hS.style.left = pct(tr.start);
        hE.style.left = pct(tr.end);
        ph.style.left = pct(tr.playhead);
        tLeft.textContent = "0 s";
        tRight.textContent = fmtT(tr.dur);
        curLbl.textContent = t("cursorLabel", fmtT(tr.playhead));
        if (root.activeElement !== startNum) startNum.value = tr.start.toFixed(2);
        if (root.activeElement !== endNum) endNum.value = tr.end.toFixed(2);
        lenLbl.textContent = t("durationLabel", fmtT(tr.end - tr.start));
      };

      const drawWave = () => {
        if (!wave) return;
        const w = track.clientWidth;
        const hh = track.clientHeight;
        if (!w) return;
        const dpr = window.devicePixelRatio || 1;
        wave.width = Math.round(w * dpr);
        wave.height = Math.round(hh * dpr);
        const ctx = wave.getContext("2d");
        ctx.clearRect(0, 0, wave.width, wave.height);
        if (!tr.peaks) return;
        ctx.fillStyle = getComputedStyle(track).getPropertyValue("--muted").trim() || "#64748b";
        const n = tr.peaks.length;
        const cols = wave.width;
        const mid = wave.height / 2;
        const norm = 1 / (tr.peakMax || 1);
        for (let x = 0; x < cols; x++) {
          const a = Math.floor((x / cols) * n);
          const b = Math.max(a + 1, Math.floor(((x + 1) / cols) * n));
          let p = 0;
          for (let i = a; i < b && i < n; i++) if (tr.peaks[i] > p) p = tr.peaks[i];
          const hgt = Math.max(1, p * norm * (wave.height - 4));
          ctx.fillRect(x, mid - hgt / 2, 1, hgt);
        }
      };
      if (wave && typeof ResizeObserver !== "undefined")
        new ResizeObserver(drawWave).observe(track);

      let seeking = false;
      let pendingSeek = null;
      const seekTo = (x) => {
        pendingSeek = x;
        if (!seeking) doSeek();
      };
      const doSeek = () => {
        if (pendingSeek == null) return;
        const x = pendingSeek;
        pendingSeek = null;
        seeking = true;
        tr.playhead = x;
        media.currentTime = tr.offset + x;
        layout();
      };
      media.addEventListener("seeked", () => {
        seeking = false;
        if (pendingSeek != null) doSeek();
      });

      const changed = () => {
        layout();
        emit();
      };
      const setStart = (x, seek = true) => {
        if (!tr.dur) return;
        tr.start = Math.max(0, Math.min(x, tr.end - MIN_LEN));
        changed();
        if (seek) {
          stop();
          seekTo(tr.start);
        }
      };
      const setEnd = (x, seek = true) => {
        if (!tr.dur) return;
        tr.end = Math.min(tr.dur, Math.max(x, tr.start + MIN_LEN));
        changed();
        if (seek) {
          stop();
          seekTo(Math.max(tr.start, tr.end - FRAME));
        }
      };

      const tAt = (ev) => {
        const r = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * tr.dur;
      };
      let drag = null;
      track.addEventListener("pointerdown", (ev) => {
        if (!tr.dur || G.busy) return;
        drag = ev.target === hS ? "s" : ev.target === hE ? "e" : "p";
        track.setPointerCapture(ev.pointerId);
        stop();
        applyDrag(ev);
      });
      track.addEventListener("pointermove", (ev) => {
        if (drag) applyDrag(ev);
      });
      const endDrag = () => {
        drag = null;
      };
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      const applyDrag = (ev) => {
        const x = tAt(ev);
        if (drag === "s") setStart(x);
        else if (drag === "e") setEnd(x);
        else seekTo(x);
      };
      startNum.addEventListener("change", () => setStart(+startNum.value || 0));
      endNum.addEventListener("change", () => setEnd(+endNum.value || 0));
      startCur.addEventListener("click", () => setStart(tr.playhead));
      endCur.addEventListener("click", () => setEnd(tr.playhead));

      let raf = 0;
      const tick = () => {
        tr.playhead = Math.max(0, media.currentTime - tr.offset);
        layout();
        if (tr.stopAt != null && media.currentTime >= tr.offset + tr.stopAt) {
          stop();
          return;
        }
        if (!media.paused) raf = requestAnimationFrame(tick);
      };
      function stop() {
        cancelAnimationFrame(raf);
        if (!media.paused) media.pause();
        tr.stopAt = null;
      }
      const play = (from, to, muted = tr.muted) => {
        stop();
        tr.stopAt = to;
        media.muted = muted;
        seeking = false;
        pendingSeek = null;
        media.currentTime = tr.offset + from;
        return media
          .play()
          .then(() => {
            raf = requestAnimationFrame(tick);
          })
          .catch((e) => log("warn", "ui:play-error", e));
      };
      const toggleRange = (from, to) => {
        if (!media.paused) stop();
        else play(from, to);
      };
      playSegBtn.addEventListener("click", () => toggleRange(tr.start, tr.end));
      playCurBtn.addEventListener("click", () =>
        toggleRange(
          tr.playhead >= tr.start && tr.playhead < tr.end - 0.1 ? tr.playhead : tr.start,
          tr.end
        )
      );
      playEndBtn.addEventListener("click", () =>
        toggleRange(Math.max(tr.start, tr.end - 2), tr.end)
      );

      const load = (file, { duration, offset = 0, peaks = null, peakMax = 1 }) => {
        stop();
        if (tr.url) URL.revokeObjectURL(tr.url);
        tr.url = URL.createObjectURL(file);
        Object.assign(tr, {
          dur: duration,
          offset,
          start: 0,
          end: Math.min(duration, DEFAULT_LEN),
          playhead: 0,
          peaks,
          peakMax,
        });
        media.addEventListener("loadeddata", () => seekTo(0), { once: true });
        media.src = tr.url;
        changed();
        requestAnimationFrame(drawWave);
      };
      const clear = () => {
        stop();
        if (tr.url) URL.revokeObjectURL(tr.url);
        tr.url = null;
        media.removeAttribute("src");
        Object.assign(tr, { dur: 0, start: 0, end: 0, playhead: 0, peaks: null });
        changed();
        drawWave();
      };

      layout();
      return {
        el,
        media,
        load,
        clear,
        stop,
        play,
        layout,
        drawWave,
        onChange: (fn) => listeners.add(fn),
        setMuted: (m) => {
          tr.muted = m;
          media.muted = m;
        },
        get loaded() {
          return tr.dur > 0;
        },
        get start() {
          return tr.start;
        },
        get end() {
          return tr.end;
        },
        get len() {
          return tr.end - tr.start;
        },
        get key() {
          return tr.start.toFixed(3) + "-" + tr.end.toFixed(3);
        },
      };
    }

    // ============================================================ shared section helpers
    const section = (n, title, ...body) =>
      h(
        "section",
        { class: "off" },
        h("h3", null, h("span", { class: "n" }, String(n)), title),
        ...body
      );

    function makePicker(label, accept, hint) {
      const input = h("input", { type: "file", accept, style: "display:none" });
      const btn = h("button", { class: "act", textContent: label });
      const info = h("span", { class: "muted" }, hint);
      btn.addEventListener("click", () => input.click());
      return {
        el: h("div", { class: "row" }, btn, info, input),
        btn,
        info,
        onPick: (fn) =>
          input.addEventListener("change", () => {
            const f = input.files && input.files[0];
            input.value = "";
            if (f) fn(f);
          }),
      };
    }

    function makeAudioSource(onChange) {
      const picker = makePicker(
        t("pickAudioBtn"),
        "audio/*,video/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.mp4,.mov,.webm",
        t("pickAudioHint")
      );
      const trimmer = makeTrimmer("audio", t("trimAudioHint"));
      const wrap = h("div", { style: "display:none" }, trimmer.el);
      const s = { file: null };
      picker.onPick(async (f) => {
        picker.info.textContent = t("readingFile", f.name);
        await run("audio", async () => {
          try {
            const a = await SSWC.probeAudio(f);
            s.file = f;
            trimmer.load(f, { duration: a.duration, peaks: a.peaks, peakMax: a.peakMax });
            wrap.style.display = "";
            picker.info.textContent = `${f.name} · ${fmtT(a.duration)}${a.peakMax < 0.001 ? " · " + t("noSoundDetected") : ""}`;
            log("info", "ui:audio-selected", {
              name: f.name,
              type: f.type,
              bytes: f.size,
              duration: a.duration,
              channels: a.channels,
              peak: +a.peakMax.toFixed(4),
            });
          } catch (e) {
            log("error", "ui:audio-error", e);
            picker.info.textContent = t("couldNotRead", e.message);
            s.file = null;
            trimmer.clear();
            wrap.style.display = "none";
          }
        });
        onChange();
      });
      trimmer.onChange(onChange);
      return {
        els: [picker.el, wrap],
        trimmer,
        picker,
        get ready() {
          return !!s.file && trimmer.loaded;
        },
        get params() {
          return s.file ? { file: s.file, start: trimmer.start, dur: trimmer.len } : null;
        },
        get key() {
          return s.file ? s.file.name + s.file.size + "|" + trimmer.key : "";
        },
      };
    }

    // Format: framing + (optional) resolution x fps size grid.
    function makeFormat({ getParams, grid = true, sync = true, still = false, extras = [] }) {
      const f = { mode: "fit", an: null, anKey: null, sel: null };
      const segFit = h("button", { textContent: t("modeFit"), class: "on" });
      const segCrop = h("button", { textContent: t("modeCrop") });
      const calcBtn = h("button", { class: "act", textContent: t("calcOptionsBtn") });
      const calcInfo = h("span", { class: "muted" });
      const staleLbl = h("div", { class: "stale", style: "display:none" }, t("calcStale"));
      const calcBarIn = h("div");
      const calcBar = h("div", { class: "bar", style: "display:none" }, calcBarIn);
      const gridHost = h("div");
      const selLbl = h("div", { class: "row", style: "font-weight:600" });
      const legend = h(
        "div",
        { class: "legend" },
        h(
          "span",
          null,
          h("i", { style: "background:var(--ok-bg);border:1px solid var(--ok)" }),
          t("legendFits")
        ),
        h(
          "span",
          null,
          h("i", { style: "background:var(--warn-bg);border:1px solid var(--warn)" }),
          t("legendLowQ")
        ),
        h("span", null, h("i", { style: "border:1px solid var(--line)" }), t("legendTooBig")),
        h("span", null, t("legendNotes"))
      );
      const syncNum = h("input", {
        type: "number",
        min: 0,
        max: 1000,
        step: 10,
        value: store.get("sswc-sync-offset-ms", 0),
      });
      syncNum.addEventListener("change", () => {
        store.set("sswc-sync-offset-ms", +syncNum.value || 0);
        api.onUpdate();
      });
      const stillChk = h("input", { type: "checkbox", onchange: () => api.onUpdate() });
      const advRows = [];
      if (sync) {
        advRows.push(
          h(
            "div",
            { class: "row" },
            h("span", null, t("syncOffsetLabel")),
            syncNum,
            h("span", { class: "muted" }, t("syncOffsetHint"))
          )
        );
      }
      if (still) {
        advRows.push(
          h(
            "label",
            { class: "chk" },
            stillChk,
            h(
              "span",
              null,
              t("stillStickerLabel"),
              h("div", { class: "muted" }, t("stillStickerDesc"))
            )
          )
        );
      }
      const advanced = advRows.length
        ? h("details", null, h("summary", null, t("advancedSummary")), ...advRows)
        : null;

      const fileId = (x) => (x ? x.name + "|" + x.size + "|" + x.lastModified : "");
      const key = () => {
        const p = getParams();
        if (!p) return null;
        const v = p.visual;
        const followsAudio = v.kind === "image" || p.fit !== "independent";
        return JSON.stringify([
          v.kind,
          fileId(v.file),
          v.start,
          v.dur,
          followsAudio ? p.fit : "",
          followsAudio ? +p.audio.dur.toFixed(3) : "",
          f.mode,
        ]);
      };
      const fullKey = () => {
        const p = getParams();
        if (!p) return null;
        return JSON.stringify([
          key(),
          fileId(p.audio.file),
          +p.audio.start.toFixed(3),
          +p.audio.dur.toFixed(3),
          p.fit,
          f.sel,
          api.options(),
        ]);
      };
      const fresh = () => !!f.an && f.anKey === key();
      const reset = () => {
        if (f.an) SSWC.release(f.an);
        f.an = null;
        f.sel = null;
        gridHost.textContent = "";
        selLbl.textContent = "";
        calcInfo.textContent = t("calcHint");
      };
      calcInfo.textContent = t("calcHint");

      const renderGrid = () => {
        gridHost.textContent = "";
        const an = f.an;
        if (!an) return;
        const L = SSWC.limits;
        const thead = h(
          "tr",
          null,
          h("th", { class: "side" }, t("gridHeaderCorner")),
          L.FPS_LIST.map((x) => h("th", null, String(x)))
        );
        const rows = L.SIDES.map((side) =>
          h(
            "tr",
            null,
            h("th", { class: "side" }, String(side)),
            L.FPS_LIST.map((fps) => {
              const c = an.cells.find((x) => x.side === side && x.fps === fps);
              const isAuto = an.auto && an.auto.side === side && an.auto.fps === fps;
              const isSel = f.sel && f.sel.side === side && f.sel.fps === fps;
              const can = !!c && (c.status === "ok" || c.status === "lowq");
              const label =
                !c || c.status === "na"
                  ? "·"
                  : c.status === "no"
                    ? "✕"
                    : (isAuto ? "★" : "") + Math.round(c.est / 1000);
              const title =
                !c || c.status === "na"
                  ? t("cellUnavailable")
                  : c.status === "no"
                    ? t("cellExceeds", fmtB(c.estMin))
                    : c.status === "lowq"
                      ? t("cellLowQ", fmtB(c.est))
                      : t("cellOk", fmtB(c.est));
              return h(
                "td",
                null,
                h("button", {
                  class: (c ? c.status : "na") + (isSel ? " sel" : ""),
                  textContent: label,
                  title,
                  disabled: !can,
                  onclick: () => {
                    f.sel = { side, fps };
                    renderGrid();
                    api.onUpdate();
                  },
                })
              );
            })
          )
        );
        gridHost.append(h("table", { class: "grid" }, thead, rows));
        const c = f.sel && an.cells.find((x) => x.side === f.sel.side && x.fps === f.sel.fps);
        selLbl.textContent = c
          ? t("selectedCell", [
              String(c.side),
              String(c.fps),
              fmtB(c.est),
              c.status === "lowq" ? t("selectedLowQSuffix") : "",
            ])
          : t("noCellFits");
      };

      segFit.addEventListener("click", () => {
        f.mode = "fit";
        api.onUpdate();
      });
      segCrop.addEventListener("click", () => {
        f.mode = "crop";
        api.onUpdate();
      });
      calcBtn.addEventListener("click", async () => {
        const p = getParams();
        if (!p) return;
        reset();
        const k = key();
        api.onUpdate();
        try {
          const an = await run("analyze", (signal) =>
            SSWC.analyze({
              ...p,
              mode: f.mode,
              signal,
              onProgress: (txt, frac) => {
                calcInfo.textContent = txt;
                api.setProgress(frac);
              },
            })
          );
          f.an = an;
          f.anKey = k;
          f.sel = an.auto ? { side: an.auto.side, fps: an.auto.fps } : null;
          calcInfo.textContent = t("calcReady", (an.ms / 1000).toFixed(1));
          renderGrid();
        } catch (e) {
          calcInfo.textContent =
            e.name === "AbortError" ? t("calcCancelled") : t("calcError", e.message);
        }
        api.setProgress(0);
        api.onUpdate();
      });

      const body = [
        ...extras,
        h(
          "div",
          { class: "row" },
          h("span", null, t("framingLabel")),
          h("span", { class: "seg" }, segFit, segCrop)
        ),
      ];
      if (grid)
        body.push(
          h("div", { class: "row" }, calcBtn, calcInfo),
          calcBar,
          staleLbl,
          gridHost,
          selLbl,
          legend
        );
      if (advanced) body.push(advanced);

      const api = {
        body,
        onUpdate: () => {},
        setProgress: (frac) => {
          calcBar.style.display = frac > 0 ? "" : "none";
          calcBarIn.style.width = Math.round(frac * 100) + "%";
        },
        refresh() {
          const has = !!getParams();
          const stale = !!f.an && !fresh();
          staleLbl.style.display = stale ? "" : "none";
          gridHost.style.opacity = stale ? ".35" : "";
          gridHost.style.pointerEvents = stale ? "none" : "";
          calcBtn.disabled = G.busy || !has;
          segFit.disabled = segCrop.disabled = G.busy;
          segFit.classList.toggle("on", f.mode === "fit");
          segCrop.classList.toggle("on", f.mode === "crop");
        },
        get ready() {
          return grid ? fresh() && !!f.sel : !!getParams();
        },
        reset,
        fullKey,
        options: () => ({
          syncMs: sync ? +syncNum.value || 0 : 0,
          still: still && stillChk.checked,
        }),
        async prepare(signal, onProgress) {
          const p = getParams();
          if (grid)
            return { an: f.an, side: f.sel.side, fps: f.sel.fps, audio: p.audio, temp: false };
          const an = await SSWC.analyze({ ...p, mode: f.mode, signal, onProgress });
          return { an, side: an.auto.side, fps: an.auto.fps, audio: p.audio, temp: true };
        },
      };
      return api;
    }

    // Create & Send section: metadata, sticker encoding, preview, and sending/downloading.
    function makeCreate({ fmt, getBase }) {
      const META_KEY = "sswc-metadata";
      const packInput = h("input", {
        type: "text",
        maxLength: 128,
        placeholder: t("packPlaceholder"),
      });
      const authorInput = h("input", {
        type: "text",
        maxLength: 128,
        placeholder: t("authorPlaceholder"),
      });
      const loadMeta = () => {
        const m = store.get(META_KEY, {}) || {};
        packInput.value = m.pack || "";
        authorInput.value = m.author || "";
      };
      const saveMeta = () =>
        store.set(META_KEY, { pack: packInput.value, author: authorInput.value });
      loadMeta();
      packInput.addEventListener("change", saveMeta);
      authorInput.addEventListener("change", saveMeta);
      const createBtn = h("button", { class: "act", textContent: t("createBtn") });
      const cancelBtn = h("button", {
        class: "sec",
        textContent: t("cancelBtn"),
        style: "display:none",
      });
      const barIn = h("div");
      const status = h("div", { class: "status" });
      const resImg = h("img", { class: "thumb", alt: t("previewAlt") });
      const resAudio = h("audio", { controls: true });
      const resInfo = h("div", { class: "muted", style: "max-width:380px" });
      const togetherBtn = h("button", { class: "sec", textContent: t("watchHearBtn") });
      const destSel = h(
        "select",
        null,
        h("option", { value: "open-only", textContent: t("destOpenOnly") }),
        h("option", { value: "open", textContent: t("destOpenForward") }),
        h("option", { value: "self", textContent: t("destSelfForward") })
      );
      const sendBtn = h("button", { class: "act", textContent: t("sendBtn") });
      const dlBtn = h("button", { class: "sec", textContent: t("downloadBtn") });
      const staleNote = h(
        "div",
        { class: "stale", style: "display:none;margin-top:8px" },
        t("staleStickerNote")
      );
      const resultBox = h(
        "div",
        { class: "result" },
        resImg,
        h("div", null, resAudio, h("div", { class: "row" }, togetherBtn), resInfo)
      );
      const result = h(
        "div",
        { style: "display:none" },
        staleNote,
        resultBox,
        h("div", { class: "row", style: "margin-top:10px" }, destSel, sendBtn, dlBtn)
      );
      const c = { result: null, key: null, urls: [] };
      const setStatus = (txt, frac, isErr) => {
        status.textContent = txt || "";
        status.className = "status" + (isErr ? " err" : "");
        if (frac != null) barIn.style.width = Math.round(frac * 100) + "%";
      };
      const revoke = () => {
        c.urls.forEach((u) => URL.revokeObjectURL(u));
        c.urls = [];
      };
      const clear = () => {
        c.result = null;
        c.key = null;
        result.style.display = "none";
        revoke();
        setStatus("", 0);
      };

      createBtn.addEventListener("click", async () => {
        if (!fmt.ready) return;
        result.style.display = "none";
        try {
          const k = fmt.fullKey();
          const res = await run("create", async (signal) => {
            const p = await fmt.prepare(signal, (txt, f) => setStatus(txt, f * 0.3));
            try {
              return await SSWC.create(p.an, {
                side: p.side,
                fps: p.fps,
                audio: p.audio,
                ...fmt.options(),
                packName: packInput.value,
                publisher: authorInput.value,
                onProgress: (txt, f) => setStatus(txt, f),
                signal,
              });
            } finally {
              if (p.temp) SSWC.release(p.an);
            }
          });
          c.result = res;
          c.key = k;
          revoke();
          const u1 = URL.createObjectURL(res.webp);
          const u2 = URL.createObjectURL(res.ogg);
          c.urls.push(u1, u2);
          resImg.src = u1;
          resAudio.src = u2;
          const i = res.info;
          const durTxt =
            Math.abs(i.duration - i.audioDuration) > 0.05
              ? t("resInfoDurPair", [fmtT(i.duration), fmtT(i.audioDuration)])
              : fmtT(i.duration);
          resInfo.textContent = t("resInfoSummary", [
            durTxt,
            String(i.side),
            i.fps ? " · " + i.fps + " fps" : "",
            i.isAnimated ? "" : t("resInfoStill"),
            String(Math.round(i.quality * 100)),
            fmtB(i.webpBytes),
            i.estimated ? t("resInfoEst", fmtB(i.estimated)) : "",
            fmtB(i.oggBytes),
            String(i.audioKbps),
          ]);
          result.style.display = "";
          setStatus(t("stickerReadyStatus"), 1);
        } catch (e) {
          setStatus(
            e.name === "AbortError" ? t("calcCancelled") : t("calcError", e.message),
            0,
            e.name !== "AbortError"
          );
        }
        api.onUpdate();
      });
      cancelBtn.addEventListener("click", () => {
        if (G.abort) G.abort.abort();
      });

      togetherBtn.addEventListener("click", () => {
        if (!c.result) return;
        const u = resImg.src;
        resImg.src = "";
        resImg.src = u;
        resAudio.currentTime = 0;
        resAudio.play().catch((e) => log("warn", "ui:play-error", e));
      });

      sendBtn.addEventListener("click", async () => {
        if (!c.result || !G.waSupported) return;
        const dest = destSel.value;
        try {
          await run("send", async () => {
            const i = c.result.info;
            if (
              packInput.value.trim() !== (i.pack || "") ||
              authorInput.value.trim() !== (i.author || "")
            ) {
              c.result.webp = await SSWC.retagWebp(c.result.webp, {
                packName: packInput.value,
                publisher: authorInput.value,
                soundSha: i.soundSha256,
              });
              i.pack = packInput.value.trim();
              i.author = authorInput.value.trim();
              log("info", "metadata:updated", {
                pack: i.pack,
                author: i.author,
                webpBytes: c.result.webp.size,
              });
            }
            saveMeta();
            await SSWC.wa.publish(c.result, {
              dest: dest === "self" ? "self" : "open",
              openForward: dest !== "open-only",
              onProgress: (txt) => setStatus(txt),
            });
          });
          setStatus(dest === "open-only" ? t("sendSuccessOpen") : t("sendSuccessForward"), 1);
          api.onSent();
        } catch (e) {
          setStatus(t("sendErrorStatus", (e && e.message) || t("unsupportedWebApp")), 0, true);
        }
      });
      dlBtn.addEventListener("click", () => {
        if (!c.result) return;
        const base = getBase();
        download(c.result.webp, base + ".webp");
        download(c.result.ogg, base + ".ogg");
        log("info", "ui:download-files", { base });
      });

      const api = {
        body: [
          h(
            "div",
            null,
            h("div", { class: "muted" }, t("metaHint")),
            h(
              "div",
              { class: "meta" },
              h("span", null, t("packLabel")),
              packInput,
              h("span", null, t("authorLabel")),
              authorInput
            )
          ),
          h("div", { class: "row" }, createBtn, cancelBtn),
          h("div", { class: "bar" }, barIn),
          status,
          result,
        ],
        onSent: () => {},
        onUpdate: () => {},
        setStatus,
        clear,
        loadMeta,
        get hasResult() {
          return !!c.result;
        },
        refresh() {
          const stale = !!c.result && c.key !== fmt.fullKey();
          const done = !!c.result && !stale;
          createBtn.textContent = done
            ? t("createDoneBtn")
            : c.result
              ? t("createChangedBtn")
              : t("createBtn");
          createBtn.disabled = G.busy || !fmt.ready || done;
          staleNote.style.display = stale ? "" : "none";
          resultBox.style.opacity = stale ? ".45" : "";
          sendBtn.disabled = G.busy || !c.result || !G.waSupported;
          destSel.disabled = G.busy || !G.waSupported;
          dlBtn.disabled = G.busy || !c.result;
          cancelBtn.style.display = G.busy && api.isActive() ? "" : "none";
        },
        isActive: () => true,
      };
      return api;
    }

    function makeForm({ id, title, desc, sources, fmt, getBase, onShow, stop }) {
      const create = makeCreate({ fmt, getBase });
      let n = 0;
      const secs = sources.map((s) => section(++n, s.title, ...s.body));
      const secFmt = section(++n, t("secFormat"), ...fmt.body);
      const secCreate = section(++n, t("secCreateSend"), ...create.body);
      const el = h(
        "div",
        { style: "display:none" },
        h("div", { class: "muted tabdesc" }, desc),
        ...secs,
        secFmt,
        secCreate
      );
      const form = {
        id,
        title,
        el,
        create,
        stop,
        refresh() {
          sources.forEach((s, i) =>
            secs[i].classList.toggle("off", G.busy || (s.enabled ? !s.enabled() : false))
          );
          secFmt.classList.toggle("off", !sources.every((s) => s.ready()));
          secCreate.classList.toggle("off", !fmt.ready && !create.hasResult);
          fmt.refresh();
          create.refresh();
        },
        show(on) {
          el.style.display = on ? "" : "none";
          if (on) {
            create.loadMeta();
            if (onShow) onShow();
          } else {
            stop();
          }
        },
      };
      fmt.onUpdate = () => form.refresh();
      create.onUpdate = () => form.refresh();
      create.isActive = () => el.style.display !== "none";
      create.onSent = () => close(true);
      return form;
    }

    // ============================================================ tab 1: video with its sound
    function videoForm() {
      const picker = makePicker(
        t("pickVideoBtn"),
        "video/*,.mov,.mp4,.webm,.mkv",
        t("pickVideoHint")
      );
      const trimmer = makeTrimmer("video", t("trimVideoHint"));
      const s = { file: null };
      const changed = () => form.refresh();
      const fmt = makeFormat({
        getParams: () =>
          s.file && trimmer.loaded
            ? {
                visual: { kind: "video", file: s.file, start: trimmer.start, dur: trimmer.len },
                audio: { file: s.file, start: trimmer.start, dur: trimmer.len },
                fit: "repeat",
              }
            : null,
      });
      picker.onPick(async (f) => {
        trimmer.stop();
        fmt.reset();
        form.create.clear();
        picker.info.textContent = t("readingFile", f.name);
        await run("video", async () => {
          try {
            const meta = await SSWC.probeVideo(f);
            s.file = f;
            trimmer.load(f, meta);
            picker.info.textContent = `${f.name} · ${fmtT(meta.duration)} · ${meta.width}×${meta.height}`;
            log("info", "ui:video-selected", {
              name: f.name,
              type: f.type,
              bytes: f.size,
              ...meta,
            });
          } catch (e) {
            log("error", "ui:video-error", e);
            picker.info.textContent = t("couldNotRead", e.message);
            s.file = null;
            trimmer.clear();
          }
        });
        changed();
      });
      trimmer.onChange(changed);
      const form = makeForm({
        id: "video",
        title: t("tabVideoTitle"),
        desc: t("tabVideoDesc"),
        sources: [
          { title: t("secVideo"), body: [picker.el], ready: () => !!s.file },
          {
            title: t("secClip"),
            body: [trimmer.el],
            ready: () => trimmer.loaded,
            enabled: () => trimmer.loaded,
          },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => trimmer.stop(),
      });
      return form;
    }

    // ============================================================ tab 2: still image + audio
    function imageForm() {
      const picker = makePicker(t("pickImageBtn"), "image/*", t("pickImageHint"));
      const thumb = h("img", { class: "thumb", alt: t("imageAlt"), style: "display:none" });
      const animNote = h("div", { class: "note", style: "display:none" }, t("imageAnimatedNote"));
      const s = { file: null, url: null };
      const changed = () => form.refresh();
      const audio = makeAudioSource(changed);
      const fmt = makeFormat({
        grid: false,
        sync: false,
        still: true,
        getParams: () =>
          s.file && audio.ready
            ? { visual: { kind: "image", file: s.file }, audio: audio.params, fit: "repeat" }
            : null,
      });
      picker.onPick(async (f) => {
        form.create.clear();
        picker.info.textContent = t("readingFile", f.name);
        await run("image", async () => {
          try {
            const meta = await SSWC.probeImage(f);
            s.file = f;
            if (s.url) URL.revokeObjectURL(s.url);
            s.url = URL.createObjectURL(f);
            thumb.src = s.url;
            thumb.style.display = "";
            animNote.style.display = meta.animated ? "" : "none";
            picker.info.textContent = `${f.name} · ${meta.width}×${meta.height}`;
            log("info", "ui:image-selected", {
              name: f.name,
              type: f.type,
              bytes: f.size,
              ...meta,
            });
          } catch (e) {
            log("error", "ui:image-error", e);
            picker.info.textContent = t("couldNotRead", e.message);
            s.file = null;
            thumb.style.display = "none";
            animNote.style.display = "none";
          }
        });
        changed();
      });
      const form = makeForm({
        id: "image",
        title: t("tabImageTitle"),
        desc: t("tabImageDesc"),
        sources: [
          { title: t("secImage"), body: [picker.el, thumb, animNote], ready: () => !!s.file },
          { title: t("secAudio"), body: audio.els, ready: () => audio.ready },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => audio.trimmer.stop(),
      });
      return form;
    }

    // ============================================================ tab 3: video or GIF + another audio
    function mixForm() {
      const picker = makePicker(
        t("pickAnimBtn"),
        "video/*,image/gif,image/webp,image/apng,.gif,.mov,.mp4,.webm,.mkv",
        t("pickAnimHint")
      );
      const vTrim = makeTrimmer("video", t("trimMixVideoHint"));
      vTrim.setMuted(true);
      const vWrap = h("div", { style: "display:none" }, vTrim.el);
      const gifImg = h("img", { class: "thumb", alt: t("gifAlt"), style: "display:none" });
      const s = { file: null, kind: null, gif: null, url: null };
      const changed = () => {
        updateSummary();
        form.refresh();
      };
      const audio = makeAudioSource(changed);

      const FIT_KEY = "sswc-fit-mode-v2";
      const fitSel = h(
        "select",
        null,
        h("option", { value: "independent", textContent: t("fitIndependent") }),
        h("option", { value: "repeat", textContent: t("fitRepeat") }),
        h("option", { value: "freeze", textContent: t("fitFreeze") })
      );
      fitSel.value = store.get(FIT_KEY, "independent");
      fitSel.addEventListener("change", () => {
        store.set(FIT_KEY, fitSel.value);
        changed();
      });
      const summary = h("div", { class: "summary" });
      const fitRow = h(
        "div",
        null,
        h("div", { class: "row" }, h("span", null, t("fitIfDifferent")), fitSel)
      );
      const testBtn = h("button", { class: "sec", textContent: t("testTogetherBtn") });
      const vDur = () => (s.kind === "gif" ? s.gif.duration : vTrim.len);

      function updateSummary() {
        summary.textContent = "";
        if (!s.file || !audio.ready) {
          summary.append(t("mixPromptSelect"));
          fitRow.style.display = "none";
          return;
        }
        const v = vDur();
        const a = audio.params.dur;
        const same = Math.abs(v - a) < 0.05;
        fitRow.style.display = same ? "none" : "";
        if (same) {
          summary.append(t("mixSameDuration", fmtT(a)));
          return;
        }
        const fit = fitSel.value;
        let txt = t("mixDurationsLine", [fmtT(v), fmtT(a)]);
        if (fit === "independent") txt += t("mixIndependentDesc");
        else if (v > a) txt += t("mixAnimLonger", fmtT(a));
        else if (fit === "repeat") txt += t("mixRepeatDesc", [fmtT(a), (a / v).toFixed(1)]);
        else txt += t("mixFreezeDesc", [fmtT(a), fmtT(v)]);
        summary.append(txt);
      }

      testBtn.addEventListener("click", () => {
        if (!s.file || !audio.ready) return;
        const a = audio.params;
        if (s.kind === "gif") {
          const u = gifImg.src;
          gifImg.src = "";
          gifImg.src = u;
        } else {
          vTrim.play(vTrim.start, vTrim.end, true);
        }
        audio.trimmer.play(a.start, a.start + a.dur, false);
      });

      const fmt = makeFormat({
        extras: [
          summary,
          fitRow,
          h("div", { class: "row" }, testBtn, h("span", { class: "muted" }, t("testTogetherHint"))),
        ],
        getParams: () => {
          if (!s.file || !audio.ready) return null;
          const visual =
            s.kind === "gif"
              ? { kind: "gif", file: s.file, start: 0, dur: s.gif.duration }
              : { kind: "video", file: s.file, start: vTrim.start, dur: vTrim.len };
          return { visual, audio: audio.params, fit: fitSel.value };
        },
      });

      picker.onPick(async (f) => {
        vTrim.stop();
        fmt.reset();
        form.create.clear();
        picker.info.textContent = t("readingFile", f.name);
        await run("animation", async () => {
          try {
            if (s.url) {
              URL.revokeObjectURL(s.url);
              s.url = null;
            }
            if (SSWC.isAnimationFile(f) || (f.type || "").startsWith("image/")) {
              const g = await SSWC.probeAnimation(f);
              if (!g.animated) throw new Error(t("errStillImageInMix"));
              s.file = f;
              s.kind = "gif";
              s.gif = g;
              s.url = URL.createObjectURL(f);
              gifImg.src = s.url;
              gifImg.style.display = "";
              vWrap.style.display = "none";
              vTrim.clear();
              picker.info.textContent = `${f.name} · ${fmtT(g.duration)} · ${t("framesCount", String(g.frames))} · ${g.width}×${g.height} · ${t("gifFullUsed")}`;
              log("info", "ui:gif-selected", {
                name: f.name,
                type: f.type,
                bytes: f.size,
                frames: g.frames,
                duration: g.duration,
                width: g.width,
                height: g.height,
              });
            } else {
              const meta = await SSWC.probeVideo(f);
              s.file = f;
              s.kind = "video";
              s.gif = null;
              vTrim.load(f, meta);
              vWrap.style.display = "";
              gifImg.style.display = "none";
              picker.info.textContent = `${f.name} · ${fmtT(meta.duration)} · ${meta.width}×${meta.height}`;
              log("info", "ui:video-selected", {
                name: f.name,
                type: f.type,
                bytes: f.size,
                mutedSource: true,
                ...meta,
              });
            }
          } catch (e) {
            log("error", "ui:animation-error", e);
            picker.info.textContent = t("couldNotUse", e.message);
            s.file = null;
            s.kind = null;
            s.gif = null;
            vTrim.clear();
            vWrap.style.display = "none";
            gifImg.style.display = "none";
          }
        });
        changed();
      });
      vTrim.onChange(changed);
      updateSummary();

      const form = makeForm({
        id: "mix",
        title: t("tabMixTitle"),
        desc: t("tabMixDesc"),
        sources: [
          { title: t("secAnimation"), body: [picker.el, vWrap, gifImg], ready: () => !!s.file },
          { title: t("secAudio"), body: audio.els, ready: () => audio.ready },
        ],
        fmt,
        getBase: () => baseName(s.file),
        stop: () => {
          vTrim.stop();
          audio.trimmer.stop();
        },
      });
      return form;
    }

    // ============================================================ panel
    G.forms = [videoForm(), imageForm(), mixForm()];
    const TAB_KEY = "sswc-active-tab";
    let active = Math.max(
      0,
      G.forms.findIndex((f) => f.id === store.get(TAB_KEY, "video"))
    );
    const tabBtns = G.forms.map((f, i) =>
      h("button", { textContent: f.title, onclick: () => selectTab(i) })
    );
    function selectTab(i) {
      if (G.busy) return;
      active = i;
      store.set(TAB_KEY, G.forms[i].id);
      G.forms.forEach((f, j) => f.show(j === i));
      G.refreshTabs();
      G.forms[i].refresh();
      log("info", "ui:tab", { tab: G.forms[i].id });
    }
    G.refreshTabs = () =>
      tabBtns.forEach((b, i) => {
        b.classList.toggle("on", i === active);
        b.disabled = G.busy && i !== active;
      });

    const unsupportedBanner = h(
      "div",
      { class: "warn-banner", style: "display:none" },
      t("unsupportedHint")
    );
    SSWC.setWaSupport = (support) => {
      G.waSupported = !!(support && support.supported);
      unsupportedBanner.style.display = G.waSupported ? "none" : "";
      G.forms.forEach((f) => f.refresh());
    };

    const hookLogsChk = h("input", {
      type: "checkbox",
      checked: SSWC.settings.hookWaLogs,
      onchange: () => {
        SSWC.settings.hookWaLogs = hookLogsChk.checked;
        store.set("sswc-hook-wa-logs", hookLogsChk.checked);
      },
    });

    const logBox = h("div", { class: "logbox" });
    const tools = h(
      "details",
      null,
      h("summary", null, t("toolsSummary")),
      h(
        "label",
        { class: "chk" },
        hookLogsChk,
        h("span", { class: "muted" }, t("hookWaLogsLabel"))
      ),
      h(
        "div",
        { class: "row" },
        h("button", {
          class: "sec",
          textContent: t("diagnoseBtn"),
          onclick: () => SSWC.wa.diagnose().catch((e) => log("error", "diagnose:error", e)),
        }),
        h("button", {
          class: "sec",
          textContent: t("saveLogBtn"),
          onclick: () => saveLog().catch((e) => log("error", "log:error", e)),
        }),
        h("button", {
          class: "sec",
          textContent: t("viewLogBtn"),
          onclick: () => SSWC.openLogPage(),
        }),
        h("button", {
          class: "sec",
          textContent: t("clearLogBtn"),
          onclick: () => {
            SSWC.clearStoredLog();
            logBox.textContent = "";
            log("info", "ui:clear-log", null);
          },
        })
      ),
      logBox
    );

    const closeBtn = h("button", { class: "close", title: t("closeTitle"), textContent: "×" });
    const panel = h(
      "div",
      { class: "panel" },
      h(
        "header",
        null,
        h(
          "div",
          null,
          h("h2", null, t("panelTitle")),
          h("div", { class: "muted" }, t("panelSubtitle", SSWC.VERSION || "1.0.0"))
        ),
        h("div", { class: "hdr-r" }, closeBtn)
      ),
      unsupportedBanner,
      h("nav", { class: "tabs" }, tabBtns),
      G.forms.map((f) => f.el),
      tools,
      h("footer", null, h("div", { class: "muted" }, t("disclaimerFooter")))
    );
    const overlay = h("div", { class: "overlay", style: "display:none" }, panel);
    root.append(overlay);

    const showEntry = (e) => {
      logBox.append(
        h(
          "div",
          { class: e.level === "error" ? "e" : e.level === "warn" ? "w" : "" },
          e.ts.slice(11, 19) +
            " " +
            e.event +
            (e.data != null ? " " + JSON.stringify(e.data).slice(0, 260) : "")
        )
      );
      while (logBox.childNodes.length > 200) logBox.firstChild.remove();
      logBox.scrollTop = logBox.scrollHeight;
    };
    SSWC.entries.slice(-30).forEach(showEntry);
    SSWC.onLog(showEntry);

    const open = () => {
      panel.classList.toggle("dark", isDark());
      overlay.style.display = "";
      G.forms[active].show(true);
      log("info", "ui:open", null);
    };
    function close(force) {
      if (G.busy && force !== true) return;
      G.forms.forEach((f) => f.stop());
      overlay.style.display = "none";
    }
    const toggle = () => (overlay.style.display === "none" ? open() : close());
    SSWC.onTogglePanel(toggle);
    SSWC.togglePanel = toggle;
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    selectTab(active);
    log("info", "ui:mounted", null);
    SSWC.notifyUiReady();
  }

  SSWC.mountUI = mount;
})();
