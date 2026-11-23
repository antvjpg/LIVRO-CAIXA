const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CDP = require('chrome-remote-interface');

const DIR = __dirname;
const CASOS_PATH = path.join(DIR, 'casos.json');
const CORE_PATH = path.resolve(
  DIR,
  '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud/c4-v05-b-r2-6-6-r266-aud-core.cjs',
);
const coreArgIndex = process.argv.findIndex((arg) => arg.startsWith('--core='));
const CORE_EFETIVO = coreArgIndex >= 0
  ? path.resolve(process.argv[coreArgIndex].slice('--core='.length))
  : CORE_PATH;
const outArgIndex = process.argv.findIndex((arg) => arg.startsWith('--out='));
const OUT = outArgIndex >= 0
  ? path.resolve(process.argv[outArgIndex].slice('--out='.length))
  : path.join(DIR, 'resultados', 'resultado-navegador-r266-aud.json');

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

function makeMockCore() {
  const rule = {
    matchingSelectors: [0],
    rule: {
      id: 'mock-pai',
      origin: 'author',
      selectorList: {
        text: '#mock-pai',
        selectors: [{ text: '#mock-pai', specificity: { a: 1, b: 0, c: 0 } }],
      },
      style: {
        cssProperties: [{
          name: 'color',
          value: 'rgb(0, 0, 255)',
          text: 'color: rgb(0, 0, 255)',
          important: false,
          implicit: false,
          parsedOk: true,
          disabled: false,
        }],
      },
    },
  };
  const CSSMock = {
    getMatchedStylesForNode: async () => ({
      matchedCSSRules: [],
      inherited: [{ nodeId: 10, parentNodeId: 99, matchedCSSRules: [rule] }],
    }),
    getInlineStylesForNode: async () => ({ inlineStyle: { cssProperties: [] } }),
    getComputedStyleForNode: async () => ({ computedStyle: [{ name: 'color', value: 'rgb(0, 0, 255)' }] }),
  };
  return createCDPAuditCore({
    CDP: {},
    DOM: {},
    CSS: CSSMock,
    Runtime: { evaluate: async () => ({ result: { value: 'rgb(0, 0, 255)' } }) },
    consoleErrors: [],
    exceptions: [],
    cdpErrors: [],
  });
}

async function navigate(Page, url) {
  await Page.navigate({ url });
  await Page.loadEventFired();
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
  const mockCore = makeMockCore();

  await navigate(Page, CASOS.url);
  const { root } = await DOM.getDocument({ depth: -1, pierce: true });

  const casos = [];
  for (const caso of CASOS.casos) {
    const registro = {
      id: caso.id,
      descricao: caso.descricao,
      alvo: caso.alvo,
      origem: 'chromium-cdp',
      status: 'BLOCKED',
      divergencias: [],
    };
    try {
      const { nodeId } = await DOM.querySelector({ nodeId: root.nodeId, selector: caso.alvo });
      if (!nodeId) throw new Error('no-node');
      const resolucao = await core.getWinningRule(nodeId, CASOS.propriedade);
      const computedCdp = await CSS.getComputedStyleForNode({ nodeId });
      const valorCdp = (computedCdp.computedStyle || []).find((item) => item.name === CASOS.propriedade);
      const { object } = await DOM.resolveNode({ nodeId });
      const computedJs = await Runtime.callFunctionOn({
        objectId: object.objectId,
        functionDeclaration: 'function(){ return getComputedStyle(this).color; }',
        returnByValue: true,
      });
      const valorJs = computedJs && computedJs.result ? computedJs.result.value : null;
      const esperado = caso.esperado;
      const heranca = resolucao.inheritance || {};
      const declaracao = heranca.originDeclaration || {};
      registro.recebedor = { nodeId, seletor: caso.alvo };
      registro.ancestral = {
        providerNodeId: heranca.providerNodeId || null,
        providerLevel: heranca.providerLevel === undefined ? null : heranca.providerLevel,
        providerIdentifiedBy: heranca.providerIdentifiedBy || null,
      };
      registro.declaracaoOrigem = {
        selectorText: declaracao.selectorText || (resolucao.winningDeclaration && resolucao.winningDeclaration.selectorText) || null,
        declaredValue: declaracao.declaredValue || (resolucao.winningDeclaration && resolucao.winningDeclaration.value) || null,
        important: declaracao.important === undefined
          ? Boolean(resolucao.winningDeclaration && resolucao.winningDeclaration.important)
          : declaracao.important,
      };
      registro.valorComputado = {
        esperado: esperado.computed,
        nucleo: resolucao.resolvedValue,
        cdp: valorCdp ? valorCdp.value : null,
        getComputedStyle: valorJs,
      };
      registro.metadados = {
        inheritanceStatus: heranca.status || null,
        specificityStatus: resolucao.specificityStatus,
        captureStatus: resolucao.captureStatus,
        cascadeLimitations: resolucao.cascadeLimitations ? resolucao.cascadeLimitations.status : null,
      };

      if (canon(resolucao.resolvedValue) !== canon(esperado.computed)) registro.divergencias.push('valor-nucleo');
      if (canon(valorCdp && valorCdp.value) !== canon(esperado.computed)) registro.divergencias.push('valor-cdp');
      if (canon(valorJs) !== canon(esperado.computed)) registro.divergencias.push('valor-getComputedStyle');
      if (heranca.status !== esperado.inheritanceStatus) registro.divergencias.push('inheritance-status');
      if (heranca.providerLevel !== esperado.providerLevel) registro.divergencias.push('provider-level');
      const seletorEsperado = registro.declaracaoOrigem.selectorText;
      if (seletorEsperado !== esperado.providerSelector) registro.divergencias.push('provider-selector');
      if (registro.declaracaoOrigem.important !== esperado.importante) registro.divergencias.push('important');
      registro.status = registro.divergencias.length === 0 ? 'PASS' : 'FAIL';
    } catch (e) {
      registro.status = 'BLOCKED';
      registro.divergencias.push(e && e.message ? e.message : String(e));
    }
    casos.push(registro);
  }

  const sintetico = await mockCore.getWinningRule(1, 'color');
  casos.push({
    id: 'H7',
    descricao: 'Metadados de ancestral ausentes ou contraditorios: diagnostico insuficiente',
    alvo: null,
    origem: 'mock-cdp',
    status: sintetico.captureStatus === 'inheritance-insufficient'
      && sintetico.winningDeclaration === null
      && sintetico.inheritance.status === 'insuficiente' ? 'PASS' : 'FAIL',
    divergencias: [],
    recebedor: { nodeId: 1, seletor: null },
    ancestral: { providerNodeId: null, providerLevel: 1, providerIdentifiedBy: null },
    declaracaoOrigem: { selectorText: null, declaredValue: null, important: false },
    valorComputado: { esperado: null, nucleo: null, cdp: null, getComputedStyle: null },
    metadados: {
      inheritanceStatus: sintetico.inheritance.status,
      specificityStatus: sintetico.specificityStatus,
      captureStatus: sintetico.captureStatus,
      cascadeLimitations: sintetico.cascadeLimitations ? sintetico.cascadeLimitations.status : null,
    },
  });

  await client.close();

  const resumo = {
    total: casos.length,
    PASS: casos.filter((item) => item.status === 'PASS').length,
    FAIL: casos.filter((item) => item.status === 'FAIL').length,
    BLOCKED: casos.filter((item) => item.status === 'BLOCKED').length,
    NOT_RUN: 0,
    cromiumReal: casos.filter((item) => item.origem === 'chromium-cdp').length,
    cenarioSintetico: casos.filter((item) => item.origem === 'mock-cdp').length,
  };
  const erros = {
    cdp: cdpErrors.slice(),
    console: consoleErrors.slice(),
    excecoes: exceptions.slice(),
  };
  const resultado = {
    meta: {
      id: 'r266-aud-navegador',
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

  console.log(`R266-AUD navegador: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL / ${resumo.BLOCKED} BLOCKED`);
  if (resumo.FAIL > 0 || resumo.BLOCKED > 0 || !relido.verification.hashMatches
    || erros.cdp.length > 0 || erros.console.length > 0 || erros.excecoes.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
