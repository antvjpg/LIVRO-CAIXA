const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CDP = require('chrome-remote-interface');
const { createCDPAuditCore } = require('../../docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs');

const DIR = __dirname;
const MATRIZ = JSON.parse(fs.readFileSync(path.join(DIR, 'matriz.json'), 'utf8'));
const OUT = path.join(DIR, 'resultado.json');
const URL = 'http://127.0.0.1:8000/tmp-c13/r2-6-2/fixture.html';

function sha(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function canonColor(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().toLowerCase();
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

function canonValue(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s*!important\s*$/i, '').toLowerCase();
  const c = canonColor(s);
  return c || s;
}

function selectorText(rule) {
  if (!rule) return null;
  if (rule.selectorList) return rule.selectorList.text || rule.selectorList.selectorText || null;
  return rule.selectorText || null;
}

function isAuthored(p) {
  return p && (p.implicit === false || (typeof p.text === 'string' && p.text.trim().length > 0));
}

function importantOf(p) {
  return p.important === true || (typeof p.text === 'string' && /!important/i.test(p.text));
}

function specificityOf(rule, match) {
  const selectors = (rule && rule.selectorList && rule.selectorList.selectors) || [];
  const idx = (match && match.matchingSelectors && match.matchingSelectors[0]) || 0;
  const sel = selectors[idx] || selectors[0] || {};
  if (sel.specificity) {
    return {
      a: Number(sel.specificity.a) || 0,
      b: Number(sel.specificity.b) || 0,
      c: Number(sel.specificity.c) || 0,
    };
  }
  const text = String(sel.text || selectorText(rule) || '');
  const a = (text.match(/#[\w-]+/g) || []).length;
  const b = (text.match(/[.\[:][\w-]+/g) || []).length;
  const c = (text.replace(/#[\w-]+/g, '').replace(/[.\[:][\w-]+/g, '').match(/[a-zA-Z][\w-]*/g) || []).length;
  return { a, b, c };
}

function propsFor(rule) {
  return (rule && rule.style && Array.isArray(rule.style.cssProperties)) ? rule.style.cssProperties : [];
}

function collectFromRuleMatches(matches, property, source, counter) {
  const out = [];
  for (const match of matches || []) {
    const rule = match && match.rule;
    if (!rule) continue;
    for (const p of propsFor(rule)) {
      if (!isAuthored(p) || p.name !== property || p.disabled === true) continue;
      out.push({
        source,
        selectorText: selectorText(rule),
        declaredValue: canonValue(p.value),
        rawValue: String(p.value || ''),
        important: importantOf(p),
        pseudoElement: source === 'pseudo' ? null : undefined,
        specificity: specificityOf(rule, match),
        origin: rule.origin || null,
        styleSheetId: rule.styleSheetId || null,
        order: counter.next++,
      });
    }
  }
  return out;
}

function rank(c) {
  const origin = c.source === 'inline' ? 3 : c.source === 'inherited' ? 1 : 2;
  return [c.important ? 1 : 0, origin, c.specificity.a, c.specificity.b, c.specificity.c, c.order];
}

function compareRank(a, b) {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] - rb[i];
  }
  return 0;
}

function chooseWinner(candidates) {
  let best = null;
  for (const c of candidates) {
    if (best === null || compareRank(c, best) > 0) best = c;
  }
  return best;
}

function winnerView(c) {
  if (!c) return null;
  return {
    source: c.source,
    selectorText: c.selectorText || null,
    declaredValue: c.declaredValue === undefined ? null : canonValue(c.declaredValue),
    important: Boolean(c.important),
    pseudoElement: c.pseudoElement || null,
  };
}

function compareWinner(observed, expected, campos) {
  if (!observed || !expected) {
    return [!observed ? 'vencedor observado ausente' : 'vencedor esperado ausente'];
  }
  const out = [];
  for (const campo of campos) {
    let a = observed[campo];
    let b = expected[campo];
    if (campo === 'declaredValue') {
      a = canonValue(a);
      b = canonValue(b);
    } else if (campo === 'important') {
      a = Boolean(a);
      b = Boolean(b);
    } else {
      a = a === null || a === undefined ? null : String(a).toLowerCase();
      b = b === null || b === undefined ? null : String(b).toLowerCase();
    }
    if (a !== b) out.push(`${campo}: esperado=${JSON.stringify(b)} observado=${JSON.stringify(a)}`);
  }
  return out;
}

function normalizeExpectedWinner(w, pseudo) {
  return {
    source: w.source,
    selectorText: w.selectorText || null,
    declaredValue: canonValue(w.declaredValue),
    important: Boolean(w.important),
    pseudoElement: w.pseudoElement || null,
    expectedPseudo: pseudo,
  };
}

async function getNormalComputed(CSS, nodeId, property) {
  const res = await CSS.getComputedStyleForNode({ nodeId });
  const item = (res.computedStyle || []).find((p) => p.name === property);
  return item ? item.value : null;
}

async function getPseudoComputed(Runtime, selector, pseudo, property) {
  const expression = `getComputedStyle(document.querySelector(${JSON.stringify(selector)}), ${JSON.stringify(pseudo)}).${property}`;
  const res = await Runtime.evaluate({ expression, returnByValue: true });
  return res.result && res.result.value !== undefined ? res.result.value : null;
}

function inferirSourceFonte(coreWinner, own, inline, inherited, pseudoMatches) {
  if (!coreWinner) return { source: 'nenhum', pseudoElement: null };
  const alvo = { selectorText: coreWinner.selectorText || null, declaredValue: canonValue(coreWinner.value) };
  const acha = (arr) => arr.find((c) => c.selectorText === alvo.selectorText && canonValue(c.declaredValue) === alvo.declaredValue);
  if (acha(pseudoMatches)) return { source: 'stylesheet', pseudoElement: pseudoMatches[0] ? pseudoMatches[0].pseudoElement || null : null };
  if (acha(inline)) return { source: 'inline', pseudoElement: null };
  if (acha(own)) return { source: 'stylesheet', pseudoElement: null };
  if (acha(inherited)) return { source: 'inherited', pseudoElement: null };
  return { source: 'desconhecido', pseudoElement: null };
}

async function run() {
  const result = {
    meta: {
      id: 'R2.6.3',
      data: new Date().toISOString(),
      branch: MATRIZ.branch,
      head: MATRIZ.head,
      fixture: MATRIZ.fixture,
      url: URL,
      matriz: 'tmp-c13/r2-6-2/matriz.json',
      nucleo: 'docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs',
      ambiente: MATRIZ.ambiente,
    },
    cenarios: [],
    resumo: null,
    erros: { cdp: [], console: [], excecoes: [] },
  };

  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  Runtime.exceptionThrown((p) => result.erros.excecoes.push(String(p.exceptionDetails && p.exceptionDetails.text || 'excecao')));
  await new Promise((resolve) => {
    Page.loadEventFired(resolve);
    Page.navigate({ url: URL });
  });

  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors: result.erros.console, exceptions: result.erros.excecoes, cdpErrors: result.erros.cdp });

  for (const cenario of MATRIZ.cenarios) {
    const registro = {
      id: cenario.id,
      nome: cenario.nome,
      objetivo: cenario.objetivo,
      alvo: cenario.alvo,
      propriedade: cenario.propriedade,
      pseudoElement: cenario.pseudoElement || null,
      fixture: null,
      computado: null,
      oracle: null,
      mecanismo: null,
      divergencias: [],
      status: 'BLOCKED',
    };
    try {
      const { nodeIds } = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: cenario.alvo });
      const nodeId = nodeIds && nodeIds[0];
      registro.fixture = { nodeId: nodeId || null, quantidade: (nodeIds || []).length, valida: (nodeIds || []).length === 1 };
      if (!registro.fixture.valida) throw new Error('alvo nao encontrado ou ambiguo');

      const m = await CSS.getMatchedStylesForNode({ nodeId });
      const inlineRes = await CSS.getInlineStylesForNode({ nodeId });
      const counter = { next: 1 };
      let own = [];
      let pseudoMatches = [];
      let inherited = [];

      if (cenario.pseudoElement) {
        const pseudoType = String(cenario.pseudoElement).replace(/^::/, '');
        const pseudoEntry = (m.pseudoElements || []).find((x) => x.pseudoType === pseudoType || x.pseudoType === cenario.pseudoElement);
        if (!pseudoEntry) throw new Error('pseudoelemento nao retornado pelo CDP');
        pseudoMatches = collectFromRuleMatches(pseudoEntry.matches, cenario.propriedade, 'stylesheet', counter);
        for (const c of pseudoMatches) c.pseudoElement = cenario.pseudoElement;
        own = pseudoMatches.slice();
      } else {
        own = collectFromRuleMatches(m.matchedCSSRules, cenario.propriedade, 'stylesheet', counter);
        for (const ancestral of m.inherited || []) {
          const cand = collectFromRuleMatches(ancestral.matchedCSSRules, cenario.propriedade, 'inherited', { next: 1 });
          inherited.push(...cand);
        }
      }

      const inline = [];
      for (const p of ((inlineRes.inlineStyle && inlineRes.inlineStyle.cssProperties) || [])) {
        if (!isAuthored(p) || p.name !== cenario.propriedade || p.disabled === true) continue;
        inline.push({
          source: 'inline',
          selectorText: null,
          declaredValue: canonValue(p.value),
          rawValue: String(p.value || ''),
          important: importantOf(p),
          pseudoElement: null,
          specificity: { a: 1, b: 0, c: 0 },
          origin: 'inline',
          styleSheetId: null,
          order: counter.next++,
        });
      }

      const pool = own.length ? own.concat(inline) : inherited;
      const oracleWinner = chooseWinner(pool);
      const observado = cenario.pseudoElement
        ? await getPseudoComputed(Runtime, cenario.alvo, cenario.pseudoElement, cenario.propriedade)
        : await getNormalComputed(CSS, nodeId, cenario.propriedade);
      const esperadoComputed = cenario.esperado.computed;
      const computedOk = canonColor(observado) === canonColor(esperadoComputed);
      const ownerOk = cenario.esperado.computedOwner
        ? canonColor(await getNormalComputed(CSS, nodeId, cenario.propriedade)) === canonColor(cenario.esperado.computedOwner)
        : true;
      const esperadoWinner = normalizeExpectedWinner(cenario.esperado.vencedor, cenario.pseudoElement || null);
      const oracleDiv = compareWinner(winnerView(oracleWinner), esperadoWinner, MATRIZ.criterios.comparacaoVencedor);

      registro.computado = {
        esperado: esperadoComputed,
        observado,
        canonicoEsperado: canonColor(esperadoComputed),
        canonicoObservado: canonColor(observado),
        status: computedOk && ownerOk ? 'PASS' : 'BLOCKED',
        ownerEsperado: cenario.esperado.computedOwner || null,
        ownerObservado: cenario.esperado.computedOwner ? await getNormalComputed(CSS, nodeId, cenario.propriedade) : null,
        fonte: cenario.pseudoElement ? 'Runtime.evaluate getComputedStyle' : 'CSS.getComputedStyleForNode',
      };
      registro.oracle = {
        esperado: winnerView(esperadoWinner),
        observado: winnerView(oracleWinner),
        divergencias: oracleDiv,
        status: oracleDiv.length === 0 ? 'PASS' : 'BLOCKED',
        contagens: {
          proprias: own.length,
          inline: inline.length,
          hereditarias: inherited.length,
          pseudo: pseudoMatches.length,
        },
      };

      const nucleo = await core.getWinningRule(nodeId, cenario.propriedade);
      const fonte = inferirSourceFonte(nucleo.winningDeclaration, own, inline, inherited, pseudoMatches);
      const mecanismoView = nucleo.winningDeclaration
        ? {
            source: fonte.source,
            selectorText: nucleo.winningDeclaration.selectorText || null,
            declaredValue: canonValue(nucleo.winningDeclaration.value),
            important: Boolean(nucleo.winningDeclaration.important),
            pseudoElement: cenario.pseudoElement ? fonte.pseudoElement : null,
          }
        : null;
      const mecanismoDiv = compareWinner(mecanismoView, esperadoWinner, MATRIZ.criterios.comparacaoVencedor);
      registro.mecanismo = {
        captureStatus: nucleo.captureStatus,
        vencedor: mecanismoView,
        divergencias: mecanismoDiv,
        status: mecanismoDiv.length === 0 ? 'PASS' : 'FAIL',
        candidatosNucleo: (nucleo.candidates || []).length,
        computedValueNucleo: nucleo.computedValue,
      };

      if (!registro.fixture.valida || !computedOk || !ownerOk || oracleDiv.length) {
        registro.status = 'BLOCKED';
        registro.divergencias.push(...oracleDiv);
        if (!computedOk) registro.divergencias.push('cor computada divergente do esperado');
        if (!ownerOk) registro.divergencias.push('cor do elemento owner divergente do esperado');
      } else {
        registro.status = mecanismoDiv.length ? 'FAIL' : 'PASS';
        registro.divergencias.push(...mecanismoDiv);
      }
    } catch (e) {
      registro.status = 'BLOCKED';
      registro.divergencias.push('excecao: ' + String(e && e.message || e));
    }
    result.cenarios.push(registro);
    console.log(`${registro.id} ${registro.nome}: ${registro.status}`);
  }

  await client.close();
  result.resumo = {
    total: result.cenarios.length,
    PASS: result.cenarios.filter((c) => c.status === 'PASS').length,
    FAIL: result.cenarios.filter((c) => c.status === 'FAIL').length,
    BLOCKED: result.cenarios.filter((c) => c.status === 'BLOCKED').length,
    NOT_RUN: result.cenarios.filter((c) => c.status === 'NOT RUN').length,
    mecanismoPASS: result.cenarios.filter((c) => c.mecanismo && c.mecanismo.status === 'PASS').length,
    mecanismoFAIL: result.cenarios.filter((c) => c.mecanismo && c.mecanismo.status === 'FAIL').length,
    oraclePASS: result.cenarios.filter((c) => c.oracle && c.oracle.status === 'PASS').length,
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');

  const r = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  r.meta.finishedAt = new Date().toISOString();
  delete r.meta.hash;
  delete r.verification;
  const sem = JSON.parse(JSON.stringify(r));
  const h = sha(JSON.stringify(sem, null, 2));
  r.meta.hash = h;
  r.verification = { hashMatches: true, declared: h, recalculated: h };
  fs.writeFileSync(OUT, JSON.stringify(r, null, 2) + '\n');
  const check = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const sem2 = JSON.parse(JSON.stringify(check));
  delete sem2.meta.hash;
  delete sem2.verification;
  const h2 = sha(JSON.stringify(sem2, null, 2));
  check.verification.hashMatches = h2 === h;
  check.verification.recalculated = h2;
  fs.writeFileSync(OUT, JSON.stringify(check, null, 2) + '\n');
  console.log('resumo:', JSON.stringify(result.resumo));
  console.log('hash:', h2, 'valido:', check.verification.hashMatches);
}

run().catch((e) => { console.error(e); process.exit(1); });
