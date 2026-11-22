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

async function navigate(client, css, uaStylesheet) {
  const { Page } = client;
  if (uaStylesheet !== undefined) await client.send('CSS.setUserAgentStylesheet', { content: uaStylesheet });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('navegacao excedeu 30s')), 30000);
    Page.loadEventFired(() => {
      clearTimeout(timer);
      resolve();
    });
    Page.navigate({ url: CASOS.url }).catch((err) => {
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

async function run() {
  const coreHash = sha(fs.readFileSync(CORE_PATH));
  const result = {
    meta: {
      id: CASOS.id,
      data: new Date().toISOString(),
      fixture: CASOS.fixture,
      url: CASOS.url,
      nucleo: CORE_LABEL,
      nucleoSha256: coreHash,
      criterios: CASOS.criterios,
    },
    casos: [],
    resumo: null,
  };

  const client = await CDP({ port: 9222 });
  const { Page, DOM, CSS, Runtime } = client;
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  const cdpErrors = [];
  const consoleErrors = [];
  let uaAplicado = false;
  const exceptions = [];
  Runtime.exceptionThrown((p) => exceptions.push(String(p.exceptionDetails && p.exceptionDetails.text || 'excecao')));
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });

  try {
    for (const caso of CASOS.casos) {
      const registro = {
        id: caso.id,
        grupo: caso.grupo,
        descricao: caso.descricao,
        alvo: caso.alvo,
        propriedade: caso.propriedade,
        pseudoElement: caso.pseudoElement || null,
        bloqueio: caso.bloqueio || null,
        navegador: null,
        nucleo: null,
        divergencias: [],
        status: 'BLOCKED',
      };
      try {
        if (caso.bloqueio) {
          registro.divergencias.push(caso.bloqueio);
          result.casos.push(registro);
          console.log(`${caso.id}: BLOCKED`);
          continue;
        }
        if (caso.uaStylesheet !== undefined) uaAplicado = true;
        await navigate(client, CSS, caso.uaStylesheet);
        const { root } = await DOM.getDocument({ depth: -1, pierce: true });
        const { nodeIds } = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: caso.alvo });
        if (!nodeIds || nodeIds.length !== 1) throw new Error(`alvo ambiguo ou ausente: ${caso.alvo}`);
        const nodeId = nodeIds[0];
        const computed = await browserComputed(client, nodeId, caso.alvo, caso.pseudoElement || null, caso.propriedade);
        const expected = caso.esperado;
        registro.navegador = { computed, esperado: expected.computed, status: sameValue(computed, expected.computed) ? 'PASS' : 'FAIL' };
        if (registro.navegador.status === 'FAIL') registro.divergencias.push(`oraculo navegador: esperado=${expected.computed} observado=${computed}`);

        const cdpErrorsBefore = cdpErrors.length;
        const nucleo = await core.getWinningRule(nodeId, caso.propriedade, {
          selector: caso.selectorOption || caso.alvo,
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

        const resolvedEsperado = expected.resolved !== undefined ? expected.resolved : expected.computed;
        if (!sameValue(nucleo.resolvedValue, resolvedEsperado)) {
          registro.divergencias.push(`resolvedValue: esperado=${resolvedEsperado} observado=${nucleo.resolvedValue}`);
        }
        if (resolveStatus !== expected.resolveStatus) {
          registro.divergencias.push(`resolveStatus: esperado=${expected.resolveStatus} observado=${resolveStatus}`);
        }
        const resolveErros = novosErros.filter((e) => String(e.operation || e.method || '').includes('resolveWinningValue'));
        if (expected.resolveStatus === 'error' && resolveErros.length === 0) {
          registro.divergencias.push('erro de consulta nao registrado');
        }
        if (expected.resolveStatus === 'computed' && resolveErros.length > 0) {
          registro.divergencias.push(`erro de consulta indevido: ${resolveErros.length}`);
        }
        registro.divergencias.push(...compareWinner(observeWinner, expected.vencedor));
        registro.status = registro.divergencias.length ? 'FAIL' : 'PASS';
      } catch (err) {
        registro.status = 'BLOCKED';
        registro.divergencias.push(`excecao: ${String(err && err.message || err)}`);
      }
      result.casos.push(registro);
      console.log(`${caso.id}: ${registro.status}`);
    }
    if (uaAplicado) {
      try {
        await client.send('CSS.setUserAgentStylesheet', { content: '' });
      } catch (err) {
        result.meta.resetUa = `falha ao limpar stylesheet UA: ${String(err && err.message || err)}`;
      }
    }
  } finally {
    await client.close();
  }

  result.resumo = {
    total: result.casos.length,
    PASS: result.casos.filter((c) => c.status === 'PASS').length,
    FAIL: result.casos.filter((c) => c.status === 'FAIL').length,
    BLOCKED: result.casos.filter((c) => c.status === 'BLOCKED').length,
    NOT_RUN: result.casos.filter((c) => c.status === 'NOT RUN').length,
    origemPASS: result.casos.filter((c) => c.grupo === 'origem' && c.status === 'PASS').length,
    especificidadePASS: result.casos.filter((c) => c.grupo === 'especificidade' && c.status === 'PASS').length,
    pseudoelementoPASS: result.casos.filter((c) => c.grupo === 'pseudoelemento' && c.status === 'PASS').length,
  };
  result.erros = { cdp: cdpErrors, console: consoleErrors, excecoes: exceptions };
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
  if (result.resumo.FAIL > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
