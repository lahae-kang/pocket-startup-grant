chrome.runtime.sendMessage({ type: 'CRM_GET_CACHE' }).then(result => {
  const snapshot = result?.snapshot;
  document.querySelector('#count').textContent = snapshot ? `${snapshot.entries.length}개` : '대기';
  document.querySelector('#dates').textContent = snapshot?.dates.join(', ') || '-';
  document.querySelector('#updated').textContent = snapshot ? new Date(snapshot.capturedAt).toLocaleString('ko-KR') : '-';
});
document.querySelector('#crm').addEventListener('click', () => chrome.tabs.create({ url: 'https://crm.xn--9i1b674cwc38r6pa.com/employee/schedule/meeting' }));
document.querySelector('#board').addEventListener('click', () => chrome.tabs.create({ url: 'https://lahae-kang.github.io/pocket-startup-grant/' }));
