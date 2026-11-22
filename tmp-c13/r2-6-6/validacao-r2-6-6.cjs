'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CDP = require('chrome-remote-interface');

const DIR = __dirname;
const coreArg = process.argv.find((a) => a.startsWith('--core='));
const outArg = process.argv.find((a) => a.startsWith('--out='));
const CORE_LABEL = coreArg ? coreArg.slice('--core='.length) : 'docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs';
const CORE_PATH = coreArg ? path.resolve(CORE_LABEL) : path.resolve(DIR, '../../../', CORE_LABEL);
const OUT = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(DIR, 'resultado.json');
const CASOS = JSON.parse(fs.readFileSync(path.join(DIR, 'casos.json'), 'utf8'));
const { createCDPAuditCore } = require(CORE_PATH);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function extensionIdFromPath(dir) {
  const hash = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return Array.from(hash, (digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

const EXTENSION_DIR = path.join(DIR, 'extension');
const EXTENSION_ID = extensionIdFromPath(EXTENSION_DIR);

function canon(value) {
  if (value === null || value === undefined) return null;
  let s = String(value).trim().toLowerCase().replace(/\s*!important\s*$/i, '');
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

function sameValue(a, b) {
  return canon(a) === canon(b);
}

function normalizeOrigin(origin, source) {
  if (origin === 'user-agent' || origin === 'user' || origin === 'inline') return origin;
  if (source === 'inline') return 'inline';
  return 'author';
}

function winnerView(winner) {
  if (!winner) return null;
  return {
    source: winner.source || null,
    selectorText: winner.selectorText || null,
    declaredValue: canon(winner.value !== undefined ? winner.value : winner.declaredValue),
    important: Boolean(winner.important),
    origin: normalizeOrigin(winner.origin, winner.source),
    specificity: {
      a: Number(winner.specificity && winner.specificity.a) || 0,
      b: Number(winner.specificity && winner.specificity.b) || 0,
      c: Number(winner.specificity && winner.specificity.c) || 0,
    },
    pseudoElement: winner.pseudoElement || null,
  };
}

function compareWinner(observed, expected) {
  if (!expected) return [];
  if (!observed) return ['vencedor ausente'];
  const diffs = [];
  for (const key of ['source', 'selectorText', 'important', 'origin', 'pseudoElement']) {
    if (String(observed[key] || '') !== String(expected[key] || '')) diffs.push(`${key}: esperado=${JSON.stringify(expected[key])} observado=${JSON.stringify(observed[key])}`);
  }
  if (!sameValue(observed.declaredValue, expected.declaredValue)) diffs.push(`declaredValue: esperado=${JSON.stringify(expected.declaredValue)} observado=${JSON.stringify(observed.declaredValue)}`);
  for (const key of ['a', 'b', 'c']) {
    if (observed.specificity[key] !== expected.specificity[key]) diffs.push(`specificity.${key}: esperado=${expected.specificity[key]} observado=${observed.specificity[key]}`);
  }
  return diffs;
}

async function navigate(Page, url) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('navegacao excedeu 30s')), 30000);
    Page.loadEventFired(() => {
      clearTimeout(timer);
      resolve();
    });
    Page.navigate({ url }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function browserComputed(client, nodeId, selector, pseudo, property) {
  const { CSS, Runtime } = client;
  if (!pseudo) {
    const res = await CSS.getComputedStyleForNode({ nodeId });
    const found = (res.computedStyle || []).find((p) => p.name === property);
    return found ? found.value : null;
  }
  const expression = `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const cs=getComputedStyle(el,${JSON.stringify(pseudo)});return cs[${JSON.stringify(property)}]||null;})()`;
  const res = await Runtime.evaluate({ expression, returnByValue: true });
  return res && res.result && res.result.value !== undefined ? res.result.value : null;
}

async function openInjectPage(client, extensionId) {
  const created = await client.Target.createTarget({ url: `chrome-extension://${extensionId}/inject.html` });
  const attached = await client.Target.attachToTarget({ targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await client.send('Runtime.enable', {}, sessionId);
  let title = '';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await client.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }, sessionId);
    title = res.result && res.result.value;
    if (title && title !== 'r266-pending') break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  await client.Target.closeTarget({ targetId: created.targetId });
  return title;
}

async function injectUser(client) {
  let extensionId = EXTENSION_ID;
  let metodo = 'hash-do-caminho';
  let title = await openInjectPage(client, extensionId);
  if (title !== 'r266-inject:ok') {
    const targets = await client.Target.getTargets();
    const worker = (targets.targetInfos || []).find((t) => t.type === 'service_worker' && /\/sw\.js$/.test(t.url));
    if (worker) {
      extensionId = worker.url.split('/')[2];
      metodo = 'service-worker';
      title = await openInjectPage(client, extensionId);
    }
  }
  return { extensionId, metodo, title };
}

async function regrasCandidatas(client, nodeId, property, pseudo, DOM, CSS) {
  const matched = await CSS.getMatchedStylesForNode({ nodeId });
  let rules = matched.matchedCSSRules || [];
  if (pseudo) {
    const entry = (matched.pseudoElements || []).find((item) => item.pseudoType === pseudo.replace(/^::/, ''));
    rules = entry ? entry.matches : [];
  }
  const out = [];
  for (const match of rules) {
    const rule = match.rule;
    if (!rule || !rule.style) continue;
    for (const prop of rule.style.cssProperties || []) {
      if (prop.name !== property) continue;
      const selectors = (rule.selectorList && rule.selectorList.selectors) || [];
      const index = (match.matchingSelectors && match.matchingSelectors[0]) || 0;
      const spec = selectors[index] && selectors[index].specificity;
      out.push({
        origem: rule.origin || null,
        seletor: rule.selectorList ? rule.selectorList.text : rule.selectorText,
        valor: canon(prop.value),
        importante: prop.important === true || /!important/i.test(String(prop.text || '')),
        especificidade: spec ? { a: Number(spec.a) || 0, b: Number(spec.b) || 0, c: Number(spec.c) || 0 } : null,
      });
    }
  }
  return out;
}

async function run() {
  const coreHash = sha(fs.readFileSync(CORE_PATH));
  const client = await CDP({ port: 9222 });
  if (typeof client.setMaxListeners === 'function') client.setMaxListeners(50);
  const { Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  const browser = await client.send('Browser.getVersion');
  const cdpErrors = [];
  const consoleErrors = [];
  const exceptions = [];
  Runtime.exceptionThrown((p) => exceptions.push(String(p.exceptionDetails && p.exceptionDetails.text || 'excecao')));
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });
  const result = {
    meta: {
      id: CASOS.id,
      data: new Date().toISOString(),
      fixture: CASOS.fixture,
      url: CASOS.url,
      extensao: CASOS.extension,
      nucleo: CORE_LABEL,
      nucleoSha256: coreHash,
      navegador: browser.product,
      userAgent: browser.userAgent,
      protocolo: browser.protocolVersion,
      criterios: CASOS.criterios,
    },
    casos: [],
    resumo: null,
    erros: null,
  };

  try {
    for (const caso of CASOS.casos) {
      const registro = {
        id: caso.id,
        grupo: caso.origem,
        descricao: caso.descricao,
        alvo: caso.alvo,
        propriedade: caso.propriedade,
        pseudoElement: caso.pseudoElement || null,
        injecao: null,
        regrasNavegador: [],
        navegador: null,
        nucleo: null,
        divergencias: [],
        status: 'BLOCKED',
      };
      try {
        await navigate(Page, CASOS.url);
        if (caso.injectUser) {
          registro.injecao = await injectUser(client);
          if (registro.injecao.title !== 'r266-inject:ok') throw new Error(`injecao user falhou: ${registro.injecao.title}`);
        }
        const { root } = await DOM.getDocument({ depth: -1, pierce: true });
        const { nodeIds } = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: caso.alvo });
        if (!nodeIds || nodeIds.length !== 1) throw new Error(`alvo ambiguo ou ausente: ${caso.alvo}`);
        const nodeId = nodeIds[0];
        const computed = await browserComputed(client, nodeId, caso.alvo, caso.pseudoElement || null, caso.propriedade);
        registro.regrasNavegador = await regrasCandidatas(client, nodeId, caso.propriedade, caso.pseudoElement || null, DOM, CSS);
        const expected = caso.esperado;
        registro.navegador = { observado: computed, esperado: expected.computed, status: sameValue(computed, expected.computed) ? 'PASS' : 'FAIL' };
        if (registro.navegador.status === 'FAIL') registro.divergencias.push(`oraculo navegador: esperado=${expected.computed} observado=${computed}`);

        const cdpErrorsBefore = cdpErrors.length;
        const nucleo = await core.getWinningRule(nodeId, caso.propriedade, {
          selector: caso.alvo,
          pseudoElement: caso.pseudoElement || undefined,
        });
        const novosErros = cdpErrors.slice(cdpErrorsBefore);
        const observeWinner = winnerView(nucleo.winningDeclaration);
        const resolveStatus = nucleo.resolveStatus || 'ausente';
        registro.nucleo = {
          captureStatus: nucleo.captureStatus,
          resolveStatus,
          computedValue: nucleo.computedValue,
          resolvedValue: nucleo.resolvedValue,
          vencedor: observeWinner,
          errosConsulta: novosErros.length,
        };
        if (!sameValue(nucleo.resolvedValue, expected.computed)) registro.divergencias.push(`resolvedValue: esperado=${expected.computed} observado=${nucleo.resolvedValue}`);
        if (resolveStatus !== expected.resolveStatus) registro.divergencias.push(`resolveStatus: esperado=${expected.resolveStatus} observado=${resolveStatus}`);
        registro.divergencias.push(...compareWinner(observeWinner, expected.vencedor));
        registro.status = registro.divergencias.length ? 'FAIL' : 'PASS';
      } catch (err) {
        registro.status = 'BLOCKED';
        registro.divergencias.push(`excecao: ${String(err && err.message || err)}`);
      }
      result.casos.push(registro);
      console.log(`${caso.id}: ${registro.status}`);
    }
  } finally {
    result.erros = { cdp: cdpErrors, console: consoleErrors, excecoes: exceptions };
    result.resumo = {
      total: result.casos.length,
      PASS: result.casos.filter((c) => c.status === 'PASS').length,
      FAIL: result.casos.filter((c) => c.status === 'FAIL').length,
      BLOCKED: result.casos.filter((c) => c.status === 'BLOCKED').length,
      NOT_RUN: result.casos.filter((c) => c.status === 'NOT RUN').length,
      origemPASS: result.casos.filter((c) => c.grupo !== 'especificidade' && c.status === 'PASS').length,
      especificidadePASS: result.casos.filter((c) => c.grupo === 'especificidade' && c.status === 'PASS').length,
    };
    await client.close();
  }

  const semHash = JSON.parse(JSON.stringify(result));
  const hash = sha(JSON.stringify(semHash, null, 2));
  result.meta.hash = hash;
  result.verification = { hashMatches: true, declared: hash, recalculated: hash };
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  const check = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const recalculado = JSON.parse(JSON.stringify(check));
  delete recalculado.meta.hash;
  delete recalculado.verification;
  const h2 = sha(JSON.stringify(recalculado, null, 2));
  check.verification.hashMatches = h2 === hash;
  check.verification.recalculated = h2;
  fs.writeFileSync(OUT, `${JSON.stringify(check, null, 2)}\n`);
  console.log('resumo:', JSON.stringify(result.resumo));
  console.log('hash:', h2, 'valido:', check.verification.hashMatches);
  if (result.resumo.FAIL > 0 || result.resumo.BLOCKED > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
