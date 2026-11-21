const fs = require('fs');
const path = require('path');
const CDP = require('chrome-remote-interface');
const { createCDPAuditCore } = require('../../docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');

const OUT = path.join(__dirname, 'comparador-ordem-inversa.json');
const URL = 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html';

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: URL });
  });
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const cssMock = {
    getMatchedStylesForNode: async (params) => {
      const real = await CSS.getMatchedStylesForNode(params);
      return { ...real, matchedCSSRules: [...(real.matchedCSSRules || [])].reverse() };
    },
    getInlineStylesForNode: (...args) => CSS.getInlineStylesForNode(...args),
    getComputedStyleForNode: (...args) => CSS.getComputedStyleForNode(...args),
    forcePseudoState: (...args) => CSS.forcePseudoState(...args),
  };
  const core = createCDPAuditCore({
    CDP,
    DOM,
    CSS: cssMock,
    Runtime,
    consoleErrors: [],
    exceptions: [],
    cdpErrors: [],
  });

  const casos = [
    {
      id: 'C03-inverso',
      selector: '#r261-spec',
      expected: { selectorText: 'button.r261-spec', value: 'var(--accent)', important: false },
    },
    {
      id: 'C04-inverso',
      selector: '#r261-important',
      expected: { selectorText: '.r261-important', value: 'var(--accent)', important: true },
    },
  ];

  const resultados = [];
  for (const caso of casos) {
    const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: caso.selector });
    const r = await core.getWinningRule(nodeId, 'color');
    const w = r.winningDeclaration || {};
    const valor = String(w.value || '').replace(/\s*!important\s*$/i, '').trim().toLowerCase();
    const ok = w.selectorText === caso.expected.selectorText
      && valor === caso.expected.value
      && Boolean(w.important) === caso.expected.important;
    resultados.push({
      id: caso.id,
      expected: caso.expected,
      observed: {
        selectorText: w.selectorText || null,
        value: w.value || null,
        important: Boolean(w.important),
        source: w.source || null,
        specificity: w.specificity || null,
      },
      captureStatus: r.captureStatus,
      status: ok ? 'PASS' : 'FAIL',
    });
  }
  await client.close();

  const saida = {
    id: 'R2.6-FASE1-ORDEM-INVERSA',
    data: new Date().toISOString(),
    objetivo: 'verificar que specificity/important vencem mesmo com matchedCSSRules invertido',
    resultados,
    resumo: {
      total: resultados.length,
      PASS: resultados.filter((r) => r.status === 'PASS').length,
      FAIL: resultados.filter((r) => r.status === 'FAIL').length,
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(saida, null, 2) + '\n');
  console.log(JSON.stringify(saida.resumo));
  for (const r of resultados) console.log(r.id, r.status, JSON.stringify(r.observed));
  process.exit(saida.resumo.FAIL ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
