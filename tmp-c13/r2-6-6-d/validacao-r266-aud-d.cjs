'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CDP = require('chrome-remote-interface');

const DIR = __dirname;
const CASOS_PATH = path.join(DIR, 'casos.json');
const CORE_PATH = path.resolve(
  DIR,
  '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-c/c4-v05-b-r2-6-6-r266-aud-c-core.cjs',
);
const coreArgIndex = process.argv.findIndex((arg) => arg.startsWith('--core='));
const CORE_EFETIVO = coreArgIndex >= 0 ? path.resolve(process.argv[coreArgIndex].slice('--core='.length)) : CORE_PATH;
const outArgIndex = process.argv.findIndex((arg) => arg.startsWith('--out='));
const OUT = outArgIndex >= 0
  ? path.resolve(process.argv[outArgIndex].slice('--out='.length))
  : path.join(DIR, 'resultados', 'resultado-navegador-r266-aud-d.json');

const CASOS = JSON.parse(fs.readFileSync(CASOS_PATH, 'utf8'));
const { createCDPAuditCore } = require(CORE_EFETIVO);
const { sameValue, candidateView: viewCandidato, candidatosRelevantes, validarDisputa } = require(path.join(DIR, 'contrato-disputa.cjs'));
const EXTENSION_DIR = path.join(DIR, 'extension');
const INJECT_SOURCE = fs.readFileSync(path.join(EXTENSION_DIR, 'inject.js'), 'utf8');
const CSS_TEXT = (INJECT_SOURCE.match(/const CSS_TEXT = '([^']+)'/) || [])[1] || null;

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function extensionIdFromPath(dir) {
  const hash = crypto.createHash('sha256').update(dir).digest('hex').slice(0, 32);
  return Array.from(hash, (digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

const EXTENSION_ID = extensionIdFromPath(EXTENSION_DIR);

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
  const title = await openInjectPage(client, EXTENSION_ID);
  return {
    extensionId: EXTENSION_ID,
    operacao: 'chrome.scripting.insertCSS',
    originInformada: 'USER',
    cssText: CSS_TEXT,
    title,
    confirmada: title === 'r266-d-inject:ok',
  };
}

async function browserComputed(client, nodeId, property) {
  const computed = await client.CSS.getComputedStyleForNode({ nodeId });
  const found = (computed.computedStyle || []).find((item) => item.name === property);
  return found ? found.value : null;
}

async function browserComputedJs(client, nodeId, property) {
  const { object } = await client.DOM.resolveNode({ nodeId });
  const res = await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function(){ return getComputedStyle(this)[${JSON.stringify(property)}]; }`,
    returnByValue: true,
  });
  return res && res.result ? res.result.value : null;
}

async function run() {
  const client = await CDP({ port: 9222 });
  if (typeof client.setMaxListeners === 'function') client.setMaxListeners(50);
  const { Page, DOM, CSS, Runtime } = client;
  const consoleErrors = [];
  const exceptions = [];
  const cdpErrors = [];
  await Promise.all([Page.enable(), DOM.enable(), CSS.enable(), Runtime.enable()]);
  const versao = await client.send('Browser.getVersion');
  Runtime.consoleAPICalled((event) => {
    if (event.type === 'error') consoleErrors.push(event.type);
  });
  Runtime.exceptionThrown((event) => exceptions.push(event.exceptionDetails.text || 'exception'));

  const core = createCDPAuditCore({ CDP: client, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });
  await navigate(Page, CASOS.url);
  const injecao = await injectUser(client);
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const casos = [];

  for (const caso of CASOS.casos) {
    const registro = {
      id: caso.id,
      descricao: caso.descricao,
      alvo: caso.alvo,
      propriedade: caso.propriedade,
      status: 'BLOCKED',
      divergencias: [],
      insuficiencias: [],
    };
    try {
      const { nodeIds } = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: caso.alvo });
      if (!nodeIds || nodeIds.length !== 1) throw new Error('alvo ambiguo ou ausente');
      const nodeId = nodeIds[0];
      const opcoes = caso.proveniencia ? { provenance: caso.proveniencia } : {};
      const resolucao = await core.getWinningRule(nodeId, caso.propriedade, opcoes);
      const candidatos = (resolucao.candidates || []).map(viewCandidato);
      const decisionIds = ((resolucao.decisionSet && resolucao.decisionSet.candidatos) || []).map((item) => item.order);
      const candidatosDecisao = candidatos.filter((candidate) => decisionIds.includes(candidate.order));
      const vencedor = resolucao.winningDeclaration;
      const valorCdp = await browserComputed(client, nodeId, caso.propriedade);
      const valorJs = await browserComputedJs(client, nodeId, caso.propriedade);
      const esperado = caso.esperado;
      const candidatosRelevantesDisputa = candidatosRelevantes(candidatosDecisao, esperado);

      registro.injecao = caso.proveniencia ? injecao : null;
      registro.candidatos = candidatos;
      registro.candidatosDecisao = candidatosDecisao;
      registro.candidatosRelevantes = candidatosRelevantesDisputa;
      registro.vencedor = vencedor ? viewCandidato(vencedor) : null;
      registro.proveniencia = (resolucao.provenanceResolution || []).map((item) => ({
        status: item.status,
        matchCount: item.matchCount,
        matches: item.matches || [],
      }));
      registro.valorComputado = {
        esperado: esperado.computed,
        nucleo: resolucao.resolvedValue,
        cdp: valorCdp,
        getComputedStyle: valorJs,
      };
      registro.comparador = {
        captureStatus: resolucao.captureStatus,
        winnerConfidence: resolucao.winnerConfidence || null,
        decisionSet: resolucao.decisionSet ? resolucao.decisionSet.origem : null,
        specificityStatus: resolucao.specificityStatus || null,
        diagnostico: resolucao.diagnostico || null,
      };

      const provaUnica = (resolucao.provenanceResolution || []).some((item) => item.status === 'unica' && item.matchCount === 1);
      const veredito = validarDisputa({
        candidatosDecisao: candidatosRelevantesDisputa,
        esperado,
        vencedor: registro.vencedor,
        injecaoRequerida: Boolean(caso.proveniencia),
        injecaoConfirmada: injecao.confirmada,
        provenienciaRequerida: Boolean(caso.proveniencia),
        provenienciaUnica: provaUnica,
        valoresComputados: {
          nucleo: resolucao.resolvedValue,
          cdp: valorCdp,
          getComputedStyle: valorJs,
        },
      });
      registro.insuficiencias = veredito.insuficiencias;
      registro.divergencias = veredito.divergencias;
      registro.status = veredito.status;
    } catch (e) {
      registro.status = 'BLOCKED';
      registro.divergencias.push(e && e.message ? e.message : String(e));
    }
    casos.push(registro);
  }

  await client.close();

  const resumo = {
    total: casos.length,
    PASS: casos.filter((item) => item.status === 'PASS').length,
    FAIL: casos.filter((item) => item.status === 'FAIL').length,
    BLOCKED: casos.filter((item) => item.status === 'BLOCKED').length,
    INSUFFICIENT: casos.filter((item) => item.status === 'INSUFFICIENT').length,
    NOT_RUN: 0,
    chromiumReal: casos.length,
    userReal: casos.filter((item) => item.injecao && item.status === 'PASS').length,
  };
  const erros = { cdp: cdpErrors.slice(), console: consoleErrors.slice(), excecoes: exceptions.slice() };
  const resultado = {
    meta: {
      id: 'r266-aud-d-navegador',
      data: new Date().toISOString(),
      fixture: CASOS.fixture,
      url: CASOS.url,
      core: CORE_EFETIVO,
      coreSha256: sha(fs.readFileSync(CORE_EFETIVO)),
      extensionD: EXTENSION_DIR,
      extensionId: EXTENSION_ID,
      injecao,
      navegador: versao.product || null,
      userAgent: versao.userAgent || null,
      protocolo: versao.protocolVersion || null,
    },
    casos,
    resumo,
    erros,
  };
  const semHash = JSON.parse(JSON.stringify(resultado));
  const hash = sha(JSON.stringify(semHash, null, 2));
  resultado.meta.hash = hash;
  resultado.verification = { hashMatches: true, declared: hash, recalculated: hash };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(resultado, null, 2)}\n`);
  const relido = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const recalculado = JSON.parse(JSON.stringify(relido));
  delete recalculado.meta.hash;
  delete recalculado.verification;
  const h2 = sha(JSON.stringify(recalculado, null, 2));
  relido.verification.hashMatches = h2 === hash;
  relido.verification.recalculated = h2;
  fs.writeFileSync(OUT, `${JSON.stringify(relido, null, 2)}\n`);
  console.log(`R266-AUD-D navegador: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL / ${resumo.BLOCKED} BLOCKED / ${resumo.INSUFFICIENT} INSUFFICIENT`);
  if (resumo.FAIL > 0 || resumo.BLOCKED > 0 || resumo.INSUFFICIENT > 0 || !relido.verification.hashMatches
    || erros.cdp.length > 0 || erros.console.length > 0 || erros.excecoes.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
