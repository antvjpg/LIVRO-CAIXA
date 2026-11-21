const fs = require('fs');
const path = require('path');
const CDP = require('chrome-remote-interface');
const { createCDPAuditCore } = require('../../docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');

const OUT = path.join(__dirname, 'fase4-pseudoelemento.json');
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
  const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: '#r261-pseudo' });
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors: [], exceptions: [], cdpErrors });

  const matched = await CSS.getMatchedStylesForNode({ nodeId });
  const pseudoEntry = (matched.pseudoElements || []).find((x) => x.pseudoType === 'before');
  const pseudo = await core.getWinningRule(nodeId, 'color', {
    pseudoElement: '::before',
    selector: '#r261-pseudo',
  });
  const owner = await core.getWinningRule(nodeId, 'color');
  const wPseudo = pseudo.winningDeclaration || {};
  const wOwner = owner.winningDeclaration || {};

  const esperado = {
    source: 'stylesheet',
    selectorText: '#r261-pseudo::before',
    pseudoElement: '::before',
    declared: 'var(--accent)',
    resolved: 'rgb(95, 122, 67)',
    ownerSelector: '#r261-pseudo',
    ownerDeclared: 'rgb(17, 17, 17)',
  };
  const observado = {
    pseudo: {
      captureStatus: pseudo.captureStatus,
      source: wPseudo.source || null,
      selectorText: wPseudo.selectorText || null,
      pseudoElement: wPseudo.pseudoElement || null,
      declaredValueCanonico: canon(wPseudo.value),
      resolvedValueNucleo: canon(pseudo.resolvedValue),
    },
    owner: {
      captureStatus: owner.captureStatus,
      selectorText: wOwner.selectorText || null,
      declaredValueCanonico: canon(wOwner.value),
      resolvedValueNucleo: canon(owner.resolvedValue),
    },
    pseudoElementsNoCDP: (matched.pseudoElements || []).length,
    pseudoMatches: pseudoEntry ? pseudoEntry.matches.length : 0,
  };
  const ok = observado.pseudo.captureStatus === 'captured'
    && observado.pseudo.source === esperado.source
    && observado.pseudo.selectorText === esperado.selectorText
    && observado.pseudo.pseudoElement === esperado.pseudoElement
    && observado.pseudo.declaredValueCanonico === esperado.declared
    && observado.pseudo.resolvedValueNucleo === esperado.resolved
    && observado.owner.selectorText === esperado.ownerSelector
    && observado.owner.declaredValueCanonico === esperado.ownerDeclared
    && observado.pseudoMatches === 1;

  await client.close();
  const saida = {
    id: 'R2.6-FASE4',
    data: new Date().toISOString(),
    objetivo: 'verificar pseudoelemento isolado do elemento proprietario',
    esperado,
    observado,
    status: ok ? 'PASS' : 'FAIL',
    errosCDP: cdpErrors.length,
  };
  fs.writeFileSync(OUT, JSON.stringify(saida, null, 2) + '\n');
  console.log(saida.status, JSON.stringify(observado));
  process.exit(ok && cdpErrors.length === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
