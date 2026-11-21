const fs = require('fs');
const path = require('path');
const CDP = require('chrome-remote-interface');
const { createCDPAuditCore } = require('../../docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');

const OUT = path.join(__dirname, 'fase2-inline-valores.json');
const URL = 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html';

function canon(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s*!important\s*$/i, '').toLowerCase();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
  }
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const n = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (n.length >= 3) return `rgb(${Math.round(n[0])}, ${Math.round(n[1])}, ${Math.round(n[2])})`;
  }
  return s;
}

function authored(props) {
  return (props || [])
    .filter((p) => p && (p.implicit === false || (typeof p.text === 'string' && p.text.trim())))
    .map((p) => ({ name: p.name, value: p.value, important: Boolean(p.important) }));
}

(async () => {
  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  const cdpErrors = [];
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: URL });
  });
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors: [], exceptions: [], cdpErrors });

  const casos = [
    {
      id: 'C05',
      selector: '#r261-inline',
      esperado: { declared: 'rgb(255, 0, 0)', resolved: 'rgb(255, 0, 0)', source: 'inline' },
    },
    {
      id: 'C06',
      selector: '#r261-inline-var',
      esperado: { declared: 'var(--inline-accent)', resolved: 'rgb(0, 0, 255)', source: 'inline' },
    },
  ];

  const resultados = [];
  for (const caso of casos) {
    const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: caso.selector });
    const inline = await CSS.getInlineStylesForNode({ nodeId });
    const r = await core.getWinningRule(nodeId, 'color');
    const w = r.winningDeclaration || {};
    const computed = await CSS.getComputedStyleForNode({ nodeId });
    const corComputada = (computed.computedStyle || []).find((p) => p.name === 'color');
    const observado = {
      captureStatus: r.captureStatus,
      source: w.source || null,
      selectorText: w.selectorText || null,
      declaredValueRaw: w.value || null,
      declaredValueCanonico: canon(w.value),
      important: Boolean(w.important),
      resolvedValueNucleo: canon(r.resolvedValue),
      computedStyleCDP: canon(corComputada && corComputada.value),
      inlineDeclarations: authored(inline.inlineStyle && inline.inlineStyle.cssProperties),
    };
    const ok = observado.captureStatus === 'captured'
      && observado.source === caso.esperado.source
      && observado.declaredValueCanonico === caso.esperado.declared
      && observado.resolvedValueNucleo === caso.esperado.resolved
      && observado.computedStyleCDP === caso.esperado.resolved
      && observado.important === false;
    resultados.push({ id: caso.id, alvo: caso.selector, esperado: caso.esperado, observado, status: ok ? 'PASS' : 'FAIL' });
  }
  await client.close();

  const saida = {
    id: 'R2.6-FASE2',
    data: new Date().toISOString(),
    nucleo: 'docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs',
    objetivo: 'confirmar coleta inline e separacao entre valor declarado e resolvido',
    resultados,
    resumo: {
      total: resultados.length,
      PASS: resultados.filter((r) => r.status === 'PASS').length,
      FAIL: resultados.filter((r) => r.status === 'FAIL').length,
      errosCDP: cdpErrors.length,
    },
  };
  fs.writeFileSync(OUT, JSON.stringify(saida, null, 2) + '\n');
  console.log(JSON.stringify(saida.resumo));
  for (const r of resultados) console.log(r.id, r.status, JSON.stringify(r.observado));
  process.exit(saida.resumo.FAIL || saida.resumo.errosCDP ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
