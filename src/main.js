// Startup: waits for bridge handshake and WhatsApp Web readiness, runs diagnostics, and mounts UI.
(() => {
  const SSWC = window.SSWC;
  if (!SSWC || SSWC._started) return;
  SSWC._started = true;

  async function waitForWA(maxMs = 180000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      try {
        if (SSWC.wa.hasLoader()) {
          const CC = SSWC.wa.ns("WAWebChatCollection");
          if (CC && CC.ChatCollection) return Date.now() - t0;
        }
      } catch (e) {
        /* still loading */
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Web app did not finish loading within 3 minutes (signed out or changed?)");
  }

  (async () => {
    await SSWC.whenReady();
    try {
      SSWC.mountUI(); // Mount UI even before web app finishes loading so users can inspect/export logs.
    } catch (e) {
      SSWC.error("ui:mount-error", e);
    }
    try {
      const ms = await waitForWA();
      SSWC.info("wa:ready", { ms });
      // Account AB props arrive a few seconds after the main UI loads.
      await new Promise((r) => setTimeout(r, 8000));
      const support = SSWC.wa.checkSupport();
      if (SSWC.setWaSupport) SSWC.setWaSupport(support);
      await SSWC.wa.diagnose();
    } catch (e) {
      SSWC.error("wa:not-ready", e);
      if (SSWC.setWaSupport) SSWC.setWaSupport({ supported: false, missing: ["timeout"] });
    }
  })();
})();
