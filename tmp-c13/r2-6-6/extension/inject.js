const CSS_TEXT = '#r266-user-important { color: rgb(200, 10, 20) !important; }';
const ALVO = 'http://127.0.0.1:8000/tmp-c13/r2-6-6/fixture.html';

async function inject() {
  const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1:8000/tmp-c13/r2-6-6/fixture.html*' });
  const tab = tabs.find((item) => item.url && item.url.startsWith(ALVO));
  if (!tab) throw new Error('fixture tab not found');
  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, origin: 'USER', css: CSS_TEXT });
  return 'ok';
}

inject().then(
  (result) => { document.title = `r266-inject:${result}`; },
  (err) => { document.title = `r266-inject:error:${err && err.message ? err.message : err}`; }
);
