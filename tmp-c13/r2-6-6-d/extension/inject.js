const CSS_TEXT = '#d-user-normal { color: rgb(20, 0, 255); } #d-user-normal-font { font-size: 18px; } #d-user-important { color: rgb(200, 10, 20) !important; } #d-author-normal-user-important { color: rgb(200, 10, 20) !important; } #d-user-normal-author-important { color: rgb(20, 0, 255); } #d-ua-normal-user-important { font-size: 18px !important; } #d-ua-user-important { display: block !important; }';
const ALVO = 'http://127.0.0.1:8000/tmp-c13/r2-6-6-d/fixture.html';

async function inject() {
  const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:8000/tmp-c13/r2-6-6-d/fixture.html*' });
  const tab = tabs.find((item) => item.url && item.url.startsWith(ALVO));
  if (!tab) throw new Error('fixture D tab not found');
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, origin: 'USER', css: CSS_TEXT });
  return 'ok';
}

inject().then(
  (result) => { document.title = `r266-d-inject:${result}`; },
  (err) => { document.title = `r266-d-inject:error:${err && err.message ? err.message : err}`; }
);
