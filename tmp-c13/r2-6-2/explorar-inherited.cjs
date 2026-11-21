const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable()]);
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html' });
  });
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  for (const s of ['#r261-inherit', '#r261-inherit-implicit']) {
    const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: s });
    const m = await CSS.getMatchedStylesForNode({ nodeId });
    console.log(s, 'INHERITED_RAW', JSON.stringify(m.inherited, null, 2));
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
