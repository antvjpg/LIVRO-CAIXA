'use strict';

const CDP = require('chrome-remote-interface');

const URL = 'http://127.0.0.1:8000/tmp-c13/r2-6-6/fixture.html';

async function rawClient() {
  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('sem alvo page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id) return;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
    else entry.resolve(msg.result);
  };
  return {
    send(method, params = {}) {
      const id = seq++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { ws.close(); },
  };
}

async function waitComputed(Runtime, expression, expected, timeoutMs = 15000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const res = await Runtime.evaluate({ expression, returnByValue: true });
    last = res.result && res.result.value;
    if (String(last).includes(expected)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  return last;
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Browser, Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  const version = await Browser.getVersion();
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: URL });
  });

  const expression = `(()=>{const g=id=>getComputedStyle(document.getElementById(id));return JSON.stringify({uaNormal:g('r266-ua-normal').fontSize,uaImportant:g('r266-ua-important').display,userImportant:g('r266-user-important').color})})()`;
  const values = JSON.parse(await waitComputed(Runtime, expression, 'rgb(200, 10, 20)'));

  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const regras = {};
  for (const [id, property] of [
    ['r266-ua-normal', 'font-size'],
    ['r266-ua-important', 'display'],
    ['r266-user-important', 'color'],
  ]) {
    const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: `#${id}` });
    const matched = await CSS.getMatchedStylesForNode({ nodeId });
    regras[id] = [];
    for (const match of matched.matchedCSSRules || []) {
      const rule = match.rule;
      if (!rule || !rule.style) continue;
      for (const prop of rule.style.cssProperties || []) {
        if (prop.name !== property) continue;
        regras[id].push({
          origem: rule.origin || null,
          seletor: rule.selectorList ? rule.selectorList.text : rule.selectorText,
          valor: prop.value,
          importante: prop.important === true || /!important/i.test(String(prop.text || '')),
        });
      }
    }
  }

  const raw = await rawClient();
  let uaInject = null;
  try {
    uaInject = await raw.send('CSS.setUserAgentStylesheet', { content: '#r266-ua-raw { color: rgb(1, 2, 3); }' });
  } catch (err) {
    uaInject = { erro: err.message };
  }
  raw.close();

  console.log(JSON.stringify({
    navegador: version.product,
    userAgent: version.userAgent,
    valores: values,
    regras,
    uaInject,
  }, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
