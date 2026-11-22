'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCDPAuditCore } = require(path.resolve(__dirname, '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01/c4-v05-b-r2-6-6-a01-core.cjs'));

const OUT = path.join(__dirname, 'resultados/teste-comparador-a01.json');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function rule(config) {
  return {
    rule: {
      origin: config.origin,
      styleSheetId: config.styleSheetId || null,
      selectorList: {
        text: config.selector,
        selectors: [{ text: config.selector, specificity: config.specificity }],
      },
      style: {
        cssProperties: [{
          name: 'color',
          value: config.value,
          important: Boolean(config.important),
          text: `color: ${config.value}${config.important ? ' !important' : ''}`,
          implicit: config.origin === 'user-agent',
        }],
      },
    },
    matchingSelectors: [0],
  };
}

function candidateView(candidate) {
  return {
    value: candidate.value,
    important: candidate.important,
    origin: candidate.origin === 'regular' ? 'author' : candidate.origin,
    cdpOrigin: candidate.cdpOrigin,
    provenance: candidate.provenance ? candidate.provenance.origin : null,
    selectorText: candidate.selectorText,
    styleSheetId: candidate.styleSheetId,
    specificity: candidate.specificity,
  };
}

async function execute(name, rules, provenance, expected) {
  const cdpErrors = [];
  const consoleErrors = [];
  const exceptions = [];
  const core = createCDPAuditCore({
    CDP: {},
    DOM: {},
    CSS: {
      getMatchedStylesForNode: async () => ({ matchedCSSRules: rules, inherited: [], pseudoElements: [] }),
      getInlineStylesForNode: async () => ({ inlineStyle: null }),
      getComputedStyleForNode: async () => ({ computedStyle: [{ name: 'color', value: expected.computed }] }),
    },
    Runtime: {},
    consoleErrors,
    exceptions,
    cdpErrors,
  });
  const result = await core.getWinningRule(1, 'color', { provenance });
  const winner = result.winningDeclaration || null;
  const divergencias = [];
  if (!winner) divergencias.push('vencedor ausente');
  else {
    if (winner.origin !== expected.origin) divergencias.push(`origin: esperado=${expected.origin} observado=${winner.origin}`);
    if (winner.cdpOrigin !== expected.cdpOrigin) divergencias.push(`cdpOrigin: esperado=${expected.cdpOrigin} observado=${winner.cdpOrigin}`);
    if (String(winner.value).toLowerCase() !== expected.value) divergencias.push(`valor: esperado=${expected.value} observado=${winner.value}`);
    if (Boolean(winner.important) !== Boolean(expected.important)) divergencias.push(`important divergente`);
    if ((winner.provenance && winner.provenance.origin || null) !== expected.provenance) divergencias.push(`proveniencia: esperado=${expected.provenance} observado=${winner.provenance && winner.provenance.origin || null}`);
  }
  if (result.resolvedValue !== expected.computed) divergencias.push(`resolvido: esperado=${expected.computed} observado=${result.resolvedValue}`);
  if (cdpErrors.length || consoleErrors.length || exceptions.length) divergencias.push('erros instrumentais registrados');
  return {
    nome: name,
    status: divergencias.length ? 'FAIL' : 'PASS',
    divergencias,
    esperado: expected,
    vencedor: winner ? candidateView(winner) : null,
    candidatos: result.candidates.map(candidateView),
    resolvedValue: result.resolvedValue,
    resolveStatus: result.resolveStatus,
  };
}

async function main() {
  const injected = rule({
    origin: 'user-agent',
    selector: '#alvo',
    value: 'rgb(200, 10, 20)',
    important: true,
    styleSheetId: 'sheet-user-a01',
    specificity: { a: 1, b: 0, c: 0 },
  });
  const author = rule({
    origin: 'regular',
    selector: '#alvo',
    value: 'rgb(10, 20, 30)',
    important: true,
    styleSheetId: 'sheet-author-a01',
    specificity: { a: 1, b: 0, c: 0 },
  });
  const genuineUa = rule({
    origin: 'user-agent',
    selector: 'input[type="hidden" i]',
    value: 'rgb(1, 2, 3)',
    important: true,
    styleSheetId: 'sheet-ua-a01',
    specificity: { a: 0, b: 1, c: 1 },
  });
  const provenance = {
    origin: 'user',
    property: 'color',
    selectorText: '#alvo',
    declaredValue: 'rgb(200, 10, 20)',
    important: true,
    cdpOrigin: 'user-agent',
    styleSheetId: 'sheet-user-a01',
    evidence: {
      operacao: 'chrome.scripting.insertCSS',
      originInformada: 'USER',
      confirmacao: 'r266-inject:ok',
      origemCdpObservada: 'user-agent',
    },
  };

  const testes = [];
  testes.push(await execute(
    'A1 — user !important supera author !important',
    [injected, author],
    provenance,
    { origin: 'user', cdpOrigin: 'user-agent', provenance: 'user', value: 'rgb(200, 10, 20)', important: true, computed: 'rgb(200, 10, 20)' }
  ));
  testes.push(await execute(
    'A2 — user-agent !important supera user !important',
    [injected, author, genuineUa],
    provenance,
    { origin: 'user-agent', cdpOrigin: 'user-agent', provenance: null, value: 'rgb(1, 2, 3)', important: true, computed: 'rgb(1, 2, 3)' }
  ));
  testes.push(await execute(
    'A3 — USER nao e classificado como user-agent',
    [injected, author],
    provenance,
    { origin: 'user', cdpOrigin: 'user-agent', provenance: 'user', value: 'rgb(200, 10, 20)', important: true, computed: 'rgb(200, 10, 20)' }
  ));

  const receipt = testes[0].vencedor;
  const candidates = testes[0].candidatos;
  const userCandidate = candidates.find((c) => c.value === 'rgb(200, 10, 20)');
  const authorCandidate = candidates.find((c) => c.value === 'rgb(10, 20, 30)');
  const rastreabilidade = {
    status: userCandidate && userCandidate.origin === 'user' && userCandidate.cdpOrigin === 'user-agent' && authorCandidate && authorCandidate.origin === 'author' ? 'PASS' : 'FAIL',
    candidatoUser: userCandidate || null,
    candidatoAuthor: authorCandidate || null,
    vencedor: receipt,
  };

  const result = {
    id: 'A-01-TESTE-A',
    data: new Date().toISOString(),
    nucleo: 'docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01/c4-v05-b-r2-6-6-a01-core.cjs',
    metodo: 'createCDPAuditCore.getWinningRule com dominios CDP simulados',
    testes,
    rastreabilidade,
    resumo: {
      total: testes.length + 1,
      PASS: testes.filter((t) => t.status === 'PASS').length + (rastreabilidade.status === 'PASS' ? 1 : 0),
      FAIL: testes.filter((t) => t.status === 'FAIL').length + (rastreabilidade.status === 'FAIL' ? 1 : 0),
    },
  };
  const hash = sha(JSON.stringify(result, null, 2));
  result.verification = { hashMatches: true, declared: hash, recalculated: hash };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  const check = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const recalculado = JSON.parse(JSON.stringify(check));
  delete recalculado.verification;
  const h2 = sha(JSON.stringify(recalculado, null, 2));
  check.verification.hashMatches = h2 === hash;
  check.verification.recalculated = h2;
  fs.writeFileSync(OUT, `${JSON.stringify(check, null, 2)}\n`);
  console.log('Teste A:', JSON.stringify(result.resumo), 'hash:', h2);
  if (result.resumo.FAIL > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
