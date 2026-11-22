const CSS_TEXT = '#r266-user-important { color: rgb(200, 10, 20) !important; }';
const ALVO = 'http://127.0.0.1:8000/tmp-c13/r2-6-6/fixture.html';

async function inject(tabId) {
  await chrome.scripting.insertCSS({ target: { tabId }, origin: 'USER', css: CSS_TEXT });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.startsWith(ALVO)) return;
  inject(tabId).catch(() => {});
});
