const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html' });
  });
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: '#r261-pseudo' });
  const m = await CSS.getMatchedStylesForNode({ nodeId });
  console.log('PSEUDO_ELEMENTS_RAW', JSON.stringify(m.pseudoElements, null, 2));
  for (const p of ['::before', 'before']) {
    try {
      const r = await CSS.getMatchedStylesForNode({ nodeId, pseudoElement: p });
      console.log('MATCHED', p, JSON.stringify((r.matchedCSSRules || []).map((e) => e.rule && ((e.rule.selectorList && (e.rule.selectorList.text || e.rule.selectorList.selectorText)) || e.rule.selectorText)).filter(Boolean)));
    } catch (e) {
      console.log('MATCHED', p, 'ERRO', e.message);
    }
  }
  const runtime = await Runtime.evaluate({
    expression: "getComputedStyle(document.querySelector('#r261-pseudo'), '::before').color",
    returnByValue: true,
  });
  console.log('RUNTIME_PSEUDO_COLOR', JSON.stringify(runtime.result.value));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
