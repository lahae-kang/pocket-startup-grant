(() => {
  const channel = 'pocket-crm-screen-v1';
  let lastId = '';
  function publish(snapshot) {
    window.postMessage({ channel, type: 'CRM_BRIDGE_READY', version: 1 }, location.origin);
    if (snapshot && snapshot.id !== lastId) {
      lastId = snapshot.id;
      window.postMessage({ channel, type: 'CRM_SNAPSHOT', snapshot }, location.origin);
    }
  }
  async function pull() {
    try { const result = await chrome.runtime.sendMessage({ type: 'CRM_GET_CACHE' }); publish(result?.snapshot); }
    catch { /* Keep the app usable when the extension is updated or disabled. */ }
  }
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'CRM_SNAPSHOT') publish(message.snapshot);
  });
  window.addEventListener('message', event => {
    if (event.source === window && event.origin === location.origin && event.data?.channel === channel && event.data?.type === 'CRM_BOARD_READY') {
      lastId = '';
      pull();
    }
  });
  pull();
  setInterval(pull, 15000);
})();
