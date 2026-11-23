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
  : path.join(DIR, 'resultados', 'resultado-navegador-r266-aud-c.json');

const CASOS = JSON.parse(fs.readFileSync(CASOS_PATH, 'utf8'));
const { createCDPAuditCore } = require(CORE_EFETIVO);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canon(value) {
  let text = String(value === null || value === undefined ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/\s*!important\s*$/i, '');
  const rgb = text.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const nums = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (nums.length >= 3) return `rgb(${Math.round(nums[0])}, ${Math.round(nums[1])}, ${Math.round(nums[2])})`;
  }
  return text.replace(/\s+/g, ' ');
}

function sameValue(a, b) {
  return canon(a) === canon(b);
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

  const core = createCDPAuditCore({
    CDP: client,
    DOM,
    CSS,
    Runtime,
    consoleErrors,
    exceptions,
    cdpErrors,
  });

  await navigate(Page, CASOS.url);
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });
  const casos = [];

  for (const caso of CASOS.casos) {
    const propriedade = caso.propriedade || CASOS.propriedade;
    const registro = {
      id: caso.id,
      descricao: caso.descricao,
      alvo: caso.alvo,
      propriedade,
      status: 'BLOCKED',
      divergencias: [],
    };
    try {
      const { nodeIds } = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: caso.alvo });
      if (!nodeIds || nodeIds.length !== 1) throw new Error('alvo ambiguo ou ausente');
      const nodeId = nodeIds[0];
      const resolucao = await core.getWinningRule(nodeId, propriedade);
      const valorCdp = await browserComputed(client, nodeId, propriedade);
      const valorJs = await browserComputedJs(client, nodeId, propriedade);
      const vencedor = resolucao.winningDeclaration;
      const heranca = resolucao.inheritance || {};
      const declaracao = heranca.originDeclaration || {};
      const esperado = caso.esperado;

      registro.vencedor = vencedor ? {
        value: vencedor.value,
        origin: vencedor.origin,
        cdpOrigin: vencedor.cdpOrigin,
        important: vencedor.important,
        importanceStatus: vencedor.importanceStatus,
        selectorText: vencedor.selectorText,
      } : null;
      registro.valorComputado = {
        esperado: esperado.computed,
        nucleo: resolucao.resolvedValue,
        cdp: valorCdp,
        getComputedStyle: valorJs,
      };
      registro.cascata = {
        inheritanceStatus: heranca.status || null,
        providerLevel: heranca.providerLevel === undefined ? null : heranca.providerLevel,
        providerSelector: declaracao.selectorText || (vencedor && vencedor.selectorText) || null,
        identityStatus: heranca.identityStatus || null,
        winnerConfidence: resolucao.winnerConfidence || null,
        decisionSet: resolucao.decisionSet ? resolucao.decisionSet.origem : null,
        importanceStatus: vencedor ? vencedor.importanceStatus : null,
        originStatus: vencedor ? vencedor.originStatus : null,
      };

      if (!vencedor) registro.divergencias.push('sem-vencedor');
      if (!sameValue(resolucao.resolvedValue, esperado.computed)) registro.divergencias.push('valor-nucleo');
      if (!sameValue(valorCdp, esperado.computed)) registro.divergencias.push('valor-cdp');
      if (!sameValue(valorJs, esperado.computed)) registro.divergencias.push('valor-getComputedStyle');
      if (vencedor && vencedor.origin !== esperado.origin) registro.divergencias.push('origem');
      if (vencedor && vencedor.important !== esperado.important) registro.divergencias.push('importancia');
      if (heranca.status !== esperado.inheritanceStatus) registro.divergencias.push('inheritance-status');
      if (heranca.providerLevel !== esperado.providerLevel) registro.divergencias.push('provider-level');
      if (registro.cascata.providerSelector !== esperado.providerSelector) registro.divergencias.push('provider-selector');
      if (!resolucao.winnerConfidence || resolucao.winnerConfidence === 'confiavel') registro.divergencias.push('confianca-ingenua');
      if (!resolucao.decisionSet || !resolucao.decisionSet.origem) registro.divergencias.push('decision-set-ausente');
      registro.status = registro.divergencias.length === 0 ? 'PASS' : 'FAIL';
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
    NOT_RUN: 0,
    chromiumReal: casos.length,
  };
  const erros = { cdp: cdpErrors.slice(), console: consoleErrors.slice(), excecoes: exceptions.slice() };
  const resultado = {
    meta: {
      id: 'r266-aud-c-navegador',
      data: new Date().toISOString(),
      fixture: CASOS.fixture,
      url: CASOS.url,
      core: CORE_EFETIVO,
      coreSha256: sha(fs.readFileSync(CORE_EFETIVO)),
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
  console.log(`R266-AUD-C navegador: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL / ${resumo.BLOCKED} BLOCKED`);
  if (resumo.FAIL > 0 || resumo.BLOCKED > 0 || !relido.verification.hashMatches
    || erros.cdp.length > 0 || erros.console.length > 0 || erros.excecoes.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
