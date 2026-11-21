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
  const sel = (s) => DOM.querySelector({ nodeId: root.nodeId, selector: s }).then((r) => r.nodeId);
  const selectorText = (r) => r && r.rule && ((r.rule.selectorList && (r.rule.selectorList.text || r.rule.selectorList.selectorText)) || r.rule.selectorText);
  const cores = (r) => (r.rule && r.rule.style && r.rule.style.cssProperties ? r.rule.style.cssProperties : []).filter((p) => p.name === 'color').map((p) => ({ v: p.value, imp: p.important, parsed: p.parsedOk, disabled: p.disabled }));

  for (const s of ['#r261-order', '#r261-spec', '#r261-important', '#r261-inline', '#r261-inherit-implicit', '#r261-pseudo']) {
    const nodeId = await sel(s);
    const m = await CSS.getMatchedStylesForNode({ nodeId });
    const inline = await CSS.getInlineStylesForNode({ nodeId });
    console.log(s, JSON.stringify({
      matchedKeys: Object.keys(m),
      matched: (m.matchedCSSRules || []).map((e) => ({ sel: selectorText(e), props: cores(e) })),
      pseudoElements: (m.pseudoElements || []).map((x) => ({ type: x.type, rules: (x.matchedCSSRules || []).length })),
      inherited: (m.inherited || []).map((e) => ({ sel: selectorText(e), props: cores(e) })),
      inline: (inline.inlineStyle && inline.inlineStyle.cssProperties || []).filter((p) => p.name === 'color').map((p) => ({ v: p.value, imp: p.important })),
    }, null, 2));
  }

  const pseudoId = await sel('#r261-pseudo');
  const ps = await CSS.getMatchedStylesForNode({ nodeId: pseudoId, pseudoElement: '::before' });
  console.log('PSEUDO_DIRECT', JSON.stringify({ keys: Object.keys(ps), rules: (ps.matchedCSSRules || []).map((e) => ({ sel: selectorText(e), props: cores(e) })) }, null, 2));
  const cs = await CSS.getComputedStyleForNode({ nodeId: pseudoId, pseudoElement: '::before' });
  console.log('PSEUDO_COMPUTED', JSON.stringify((cs.computedStyle || []).filter((p) => p.name === 'color')));
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
