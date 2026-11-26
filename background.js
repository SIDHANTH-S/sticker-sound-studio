// Extension toolbar button handler: opens or toggles the sticker panel inside WhatsApp Web.
const WA_URL = "https://web.whatsapp.com/";
const pendingOpen = new Set();

async function logToStorage(level, event, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    run: null,
    session: "background",
    data,
  };
  const { log = [] } = await chrome.storage.local.get({ log: [] });
  log.push(entry);
  await chrome.storage.local.set({ log: log.slice(-5000) });
}

async function togglePanelIn(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { sswc: "togglePanel" });
  } catch (e) {
    // Tab was opened before installing/reloading the extension, so content scripts are not injected yet.
    await logToStorage("warn", "background:tab-no-scripts", {
      error: String((e && e.message) || e),
    });
    await chrome.tabs.reload(tabId);
    pendingOpen.add(tabId);
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab && tab.url && tab.url.startsWith(WA_URL)) return await togglePanelIn(tab.id);
    const [waTab] = await chrome.tabs.query({ url: WA_URL + "*" });
    if (waTab) {
      await chrome.tabs.update(waTab.id, { active: true });
      await chrome.windows.update(waTab.windowId, { focused: true });
      return await togglePanelIn(waTab.id);
    }
    const created = await chrome.tabs.create({ url: WA_URL });
    pendingOpen.add(created.id);
  } catch (e) {
    await logToStorage("error", "background:action-error", {
      error: String((e && e.stack) || e),
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.sswc === "openLog") chrome.runtime.openOptionsPage();
  if (msg.sswc === "pageReady" && sender.tab && pendingOpen.has(sender.tab.id)) {
    pendingOpen.delete(sender.tab.id);
    chrome.tabs.sendMessage(sender.tab.id, { sswc: "togglePanel" }).catch(() => {});
  }
});
