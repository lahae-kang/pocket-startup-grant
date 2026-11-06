(() => {
  let candidate = '';
  let published = '';
  let busy = false;
  async function capture() {
    if (busy || !chrome.runtime?.id) return;
    const snapshot = PocketCRM.capture(document, location.href);
    if (!snapshot) { candidate = ''; return; }
    const signature = JSON.stringify([snapshot.dates, snapshot.entries]);
    if (signature !== candidate) { candidate = signature; return; }
    if (signature === published) return;
    busy = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CRM_CAPTURE', snapshot });
      if (result?.ok) published = signature;
    } catch { /* A reloaded extension will resume after the CRM tab is refreshed. */ }
    finally { busy = false; }
  }
  capture();
  setInterval(capture, 10000);
  window.addEventListener('focus', capture);
})();
