const $ = (id) => document.getElementById(id);
const msg = (key, subs) =>
  (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getMessage(key, subs)) || key;

let onlyErrors = false;
let entries = [];

// Apply localized strings from _locales.
document.title = msg("logPageTitle");
$("title").textContent = msg("logPageTitle");
$("hint").textContent = msg("logPageHint");
$("summary").textContent = msg("logLoading");
$("dl").textContent = msg("logDownloadBtn");
$("copy").textContent = msg("logCopyBtn");
$("errors").textContent = msg("logErrorsOnlyBtn");
$("clear").textContent = msg("logClearBtn");

function render() {
  const box = $("log");
  box.textContent = "";
  const list = (onlyErrors ? entries.filter((e) => e.level !== "info") : entries).slice(-2000);
  for (const e of list) {
    const div = document.createElement("div");
    div.className = e.level === "error" ? "e" : e.level === "warn" ? "w" : "";
    div.textContent = `${e.ts.replace("T", " ").slice(0, 19)} [${e.level}] ${e.event}${e.data != null ? " " + JSON.stringify(e.data) : ""}`;
    box.append(div);
  }
  box.scrollTop = box.scrollHeight;
  const errs = entries.filter((e) => e.level === "error").length;
  const warns = entries.filter((e) => e.level === "warn").length;
  const sessions = new Set(entries.map((e) => e.session)).size;
  $("summary").textContent = msg("logSummary", [
    String(entries.length),
    String(errs),
    String(warns),
    String(sessions),
  ]);
}

function load() {
  chrome.storage.local.get({ log: [] }, (res) => {
    entries = res.log || [];
    render();
  });
}

$("dl").addEventListener("click", () => {
  const content = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      ua: navigator.userAgent,
      entries,
    },
    null,
    1
  );
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  a.href = url;
  a.download =
    "sound-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(entries, null, 1));
  $("copy").textContent = msg("logCopiedBtn");
  setTimeout(() => ($("copy").textContent = msg("logCopyBtn")), 1500);
});

$("errors").addEventListener("click", () => {
  onlyErrors = !onlyErrors;
  $("errors").textContent = onlyErrors ? msg("logShowAllBtn") : msg("logErrorsOnlyBtn");
  render();
});

$("clear").addEventListener("click", () => {
  if (!confirm(msg("logClearConfirm"))) return;
  chrome.storage.local.set({ log: [] }, load);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.log) {
    entries = changes.log.newValue || [];
    render();
  }
});

load();
