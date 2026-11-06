importScripts('crm-core.js');
const CACHE = 'pocket-crm-snapshot';
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'CRM_CAPTURE' && PocketCRM.crmURL(sender.url)) {
    const snapshot = PocketCRM.sanitizeSnapshot(message.snapshot);
    if (!snapshot) { respond({ ok: false }); return; }
    chrome.storage.local.set({ [CACHE]: snapshot }).then(async () => {
      const tabs = await chrome.tabs.query({ url: 'https://lahae-kang.github.io/pocket-startup-grant/*' });
      await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'CRM_SNAPSHOT', snapshot })));
      respond({ ok: true });
    }).catch(() => respond({ ok: false }));
    return true;
  }
  if (message?.type === 'CRM_GET_CACHE' && (PocketCRM.boardURL(sender.url) || (!sender.tab && sender.url?.startsWith(chrome.runtime.getURL(''))))) {
    chrome.storage.local.get(CACHE).then(result => respond({ snapshot: result[CACHE] || null, version: 1 })).catch(() => respond({ snapshot: null, version: 1 }));
    return true;
  }
});
