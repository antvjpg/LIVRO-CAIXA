const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORE_PATH = path.resolve(
  __dirname,
  '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-b/c4-v05-b-r2-6-6-r266-aud-b-core.cjs',
);
const { createCDPAuditCore } = require(CORE_PATH);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function makeMatch(options) {
  const textos = Array.isArray(options.selectorText) ? options.selectorText : [options.selectorText];
  const selectors = textos.map((text, index) => ({
    text,
    specificity: Array.isArray(options.specificity) ? options.specificity[index] : options.specificity,
  }));
  const cssProperties = (options.declarations || []).map((d) => ({
    name: d.name || 'color',
    value: d.value,
    text: `${d.name || 'color'}: ${d.value}${d.important ? ' !important' : ''}`,
    important: Boolean(d.important),
    implicit: false,
    parsedOk: d.parsedOk !== false,
    disabled: false,
  }));
  return {
    matchingSelectors: options.matchingSelectors === undefined ? [0] : options.matchingSelectors,
    rule: {
      id: options.id || null,
      origin: options.origin || 'author',
      layerName: options.layerName || null,
      media: options.media || null,
      scope: options.scope || null,
      selectorList: { text: textos.join(', '), selectors },
      style: { cssProperties },
    },
  };
}

function makeCore(matched, computedValue, cdpOptions = {}) {
  const getLayersForNode = cdpOptions.semApiCamadas ? undefined : async () => ({ layers: [] });
  const CSS = {
    getMatchedStylesForNode: async () => matched,
    getInlineStylesForNode: async () => ({ inlineStyle: { cssProperties: [] } }),
    getComputedStyleForNode: async () => ({
      computedStyle: [
        { name: 'color', value: computedValue || null },
        { name: 'animation-name', value: cdpOptions.animacao ? 'fade' : 'none' },
        { name: 'transition-property', value: 'none' },
      ],
    }),
  };
  if (getLayersForNode) CSS.getLayersForNode = getLayersForNode;
  return createCDPAuditCore({
    CDP: {},
    DOM: { resolveNode: async () => ({ object: { objectId: 'obj-1' } }) },
    CSS,
    Runtime: {
      evaluate: async () => ({ result: { value: computedValue || null } }),
      callFunctionOn: async () => ({ result: { value: Boolean(cdpOptions.shadowRoot) } }),
    },
    consoleErrors: [],
    exceptions: [],
    cdpErrors: [],
  });
}

const testes = [];
const pendencias = [];
function check(id, categoria, descricao, executar) {
  pendencias.push(Promise.resolve().then(executar).then((resultado) => {
    testes.push({
      id,
      categoria,
      descricao,
      status: resultado.ok ? 'PASS' : 'FAIL',
      esperado: resultado.esperado,
      observado: resultado.observado,
    });
  }).catch((e) => {
    testes.push({
      id,
      categoria,
      descricao,
      status: 'FAIL',
      esperado: null,
      observado: { erro: e && e.message ? e.message : String(e) },
    });
  }));
}

const core = makeCore({ matchedCSSRules: [] }, 'rgb(0, 0, 0)');

check('N01', 'B02', 'nodeId valido define provider no namespace DOM.NodeId', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: 10 }, 0);
  return { ok: observado.status === 'disponivel' && observado.providerNodeId === 10 && observado.identityRefs[0].namespace === 'DOM.NodeId', esperado: { status: 'disponivel', providerNodeId: 10 }, observado };
});
check('N02', 'B02', 'parentNodeId so nao identifica o ancestral', async () => {
  const observado = await core.normalizeCdpIdentity({ parentNodeId: 10 }, 0);
  return { ok: observado.status === 'inconclusivo' && observado.providerNodeId === null && observado.relationRefs.length === 1, esperado: { status: 'inconclusivo', providerNodeId: null }, observado };
});
check('N03', 'B02', 'backendNodeId so permanece em namespace proprio', async () => {
  const observado = await core.normalizeCdpIdentity({ backendNodeId: 10 }, 0);
  return { ok: observado.status === 'inconclusivo' && observado.identityRefs[0].namespace === 'DOM.BackendNodeId', esperado: { status: 'inconclusivo', namespace: 'DOM.BackendNodeId' }, observado };
});
check('N04', 'B02', 'nodeId e parentNodeId distintos nao sao contradicao', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: 10, parentNodeId: 99 }, 0);
  return { ok: observado.status === 'disponivel' && observado.providerNodeId === 10, esperado: { status: 'disponivel', providerNodeId: 10 }, observado };
});
check('N05', 'B02', 'colisao numerica entre namespaces nao corrobora', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: 10, backendNodeId: 10 }, 0);
  const namespaces = observado.identityRefs.map((item) => item.namespace);
  return { ok: observado.status === 'disponivel' && namespaces.includes('DOM.NodeId') && namespaces.includes('DOM.BackendNodeId'), esperado: { status: 'disponivel', namespaces: 2 }, observado };
});
check('N06', 'B02', 'valores diferentes entre namespaces nao contradizem', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: 10, backendNodeId: 99 }, 0);
  return { ok: observado.status === 'disponivel' && observado.providerNodeId === 10, esperado: { status: 'disponivel', providerNodeId: 10 }, observado };
});
check('N07', 'B02', 'conflito dentro do mesmo namespace gera insuficiente', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: 10, nodeIdAliases: [11] }, 0);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'conflito-interno-namespace', esperado: { status: 'insuficiente', reason: 'conflito-interno-namespace' }, observado };
});
check('N08', 'B02', 'ausencia total de identificador e inconclusiva por ordem', async () => {
  const observado = await core.normalizeCdpIdentity({}, 0);
  return { ok: observado.status === 'inconclusivo' && observado.orderHint === 'cdp-ordem', esperado: { status: 'inconclusivo', orderHint: 'cdp-ordem' }, observado };
});
check('N09', 'B02', 'nodeId textual nao e coerced', async () => {
  const observado = await core.normalizeCdpIdentity({ nodeId: '10' }, 0);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'tipo-invalido', esperado: { status: 'insuficiente', reason: 'tipo-invalido' }, observado };
});
check('N10', 'B02', 'objectId so e handle inconclusivo', async () => {
  const observado = await core.normalizeCdpIdentity({ objectId: 'handle-1' }, 0);
  return { ok: observado.status === 'inconclusivo' && observado.identityRefs[0].namespace === 'Runtime.RemoteObjectId', esperado: { status: 'inconclusivo', namespace: 'Runtime.RemoteObjectId' }, observado };
});

function proprio(valor, extra = {}) {
  return makeMatch({
    id: extra.id || 'filho',
    selectorText: extra.selectorText || '#filho',
    specificity: extra.specificity || { a: 1, b: 0, c: 0 },
    matchingSelectors: extra.matchingSelectors || [0],
    declarations: [{ value: valor }],
  });
}

check('D01', 'B03', 'propria valida ignora ancestral distante com especificidade invalida', async () => {
  const distante = makeMatch({ id: 'avo', selectorText: '#avo', specificity: null, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const instancia = makeCore({ matchedCSSRules: [proprio('rgb(1, 2, 3)')], inherited: [{}, { matchedCSSRules: [distante] }] }, 'rgb(1, 2, 3)');
  const observado = await instancia.getWinningRule(1, 'color');
  const ok = observado.captureStatus === 'captured' && observado.decisionSet.origem === 'propria'
    && observado.ignorados.some((item) => item.reason === 'propria-vence-herdadas')
    && observado.winningDeclaration.value === 'rgb(1, 2, 3)';
  return { ok, esperado: { captureStatus: 'captured', origem: 'propria' }, observado: { captureStatus: observado.captureStatus, origem: observado.decisionSet.origem, ignorados: observado.ignorados.length } };
});
check('D02', 'B03', 'pai valido vence avo com indice invalido irrelevante', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const avo = makeMatch({ id: 'avo', selectorText: '#avo', specificity: { a: 2, b: 0, c: 0 }, matchingSelectors: ['0'], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [pai] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'captured' && observado.inheritance.providerLevel === 1 && observado.inheritance.identityStatus === 'disponivel', esperado: { captureStatus: 'captured', providerLevel: 1 }, observado: { captureStatus: observado.captureStatus, heranca: observado.inheritance } };
});
check('D03', 'B03', 'grupo relevante com especificidade invalida continua insuficiente', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: ['0'], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [pai] }] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'specificity-insufficient' && observado.decisionSet.origem === 'herdada', esperado: { captureStatus: 'specificity-insufficient', origem: 'herdada' }, observado: { captureStatus: observado.captureStatus, origem: observado.decisionSet.origem } };
});
check('D04', 'B03', 'propria nao e bloqueada por identidade insuficiente em ancestral', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const instancia = makeCore({ matchedCSSRules: [proprio('rgb(1, 2, 3)')], inherited: [{ nodeId: 10, nodeIdAliases: [11], matchedCSSRules: [pai] }] }, 'rgb(1, 2, 3)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'captured' && observado.decisionSet.origem === 'propria', esperado: { captureStatus: 'captured', origem: 'propria' }, observado: { captureStatus: observado.captureStatus, origem: observado.decisionSet.origem } };
});
check('D05', 'B03', 'grupo relevante com identidade insuficiente bloqueia', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, nodeIdAliases: [11], matchedCSSRules: [pai] }] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'inheritance-insufficient' && observado.inheritance.identityStatus === 'insuficiente', esperado: { captureStatus: 'inheritance-insufficient' }, observado: { captureStatus: observado.captureStatus, identidade: observado.inheritance.identityStatus } };
});
check('D06', 'B03', 'pseudo-elemento ignora herdados malformados', async () => {
  const ruim = makeMatch({ id: 'avo', selectorText: '#avo', specificity: null, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const pseudo = makeMatch({ id: 'pseudo', selectorText: '#pseudo::after', specificity: { a: 1, b: 0, c: 1 }, matchingSelectors: [0], declarations: [{ value: 'rgb(4, 5, 6)' }] });
  const instancia = makeCore({ matchedCSSRules: [], pseudoElements: [{ pseudoType: 'after', matches: [pseudo] }], inherited: [{ matchedCSSRules: [ruim] }] }, 'rgb(4, 5, 6)');
  const observado = await instancia.getWinningRule(1, 'color', { pseudoElement: '::after', selector: '#pseudo' });
  return { ok: observado.captureStatus === 'captured' && observado.decisionSet.origem === 'pseudo-elemento' && observado.inheritance.status === 'nao-aplicavel', esperado: { captureStatus: 'captured', origem: 'pseudo-elemento' }, observado: { captureStatus: observado.captureStatus, origem: observado.decisionSet.origem } };
});

check('L01', 'B04', 'layer com metadado disponivel condiciona o vencedor', async () => {
  const regra = makeMatch({ id: 'layer', selectorText: '#layer', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }], layerName: 'base' });
  const instancia = makeCore({ matchedCSSRules: [regra] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.winnerConfidence === 'condicionado' && observado.cascadeLimitations.mecanismos.cascadeLayers.sinal === true, esperado: { winnerConfidence: 'condicionado', layer: true }, observado: { winnerConfidence: observado.winnerConfidence, mecanismo: observado.cascadeLimitations.mecanismos.cascadeLayers } };
});
check('L02', 'B04', 'evidencia explicita de ausencia permite vencedor confiavel', async () => {
  const evidencias = {};
  for (const id of ['cascadeLayers', 'animacoesTransicoes', 'scopingProximity', 'encapsulationContexts', 'regrasCondicionais']) {
    evidencias[id] = { sinal: false, verificacao: 'ausente-confiavel' };
  }
  const instancia = makeCore({ matchedCSSRules: [proprio('rgb(0, 0, 255)')] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color', { evidenciasCascata: evidencias });
  return { ok: observado.winnerConfidence === 'confiavel', esperado: { winnerConfidence: 'confiavel' }, observado: { winnerConfidence: observado.winnerConfidence, mecanismos: observado.cascadeLimitations.mecanismos } };
});
check('L03', 'B04', 'animacao com valor divergente rebaixa confianca', async () => {
  const instancia = makeCore({ matchedCSSRules: [proprio('rgb(0, 0, 255)')] }, 'rgb(0, 0, 128)', { animacao: true });
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.winnerConfidence === 'condicionado' && observado.diagnostico && observado.diagnostico.reason === 'valor-computado-divergente-com-animacao', esperado: { winnerConfidence: 'condicionado', reason: 'valor-computado-divergente-com-animacao' }, observado: { winnerConfidence: observado.winnerConfidence, diagnostico: observado.diagnostico } };
});
check('L04', 'B04', 'sem API de camadas a verificacao fica indisponivel', async () => {
  const instancia = makeCore({ matchedCSSRules: [proprio('rgb(0, 0, 255)')] }, 'rgb(0, 0, 255)', { semApiCamadas: true });
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.cascadeLimitations.mecanismos.cascadeLayers.verificacao === 'indisponivel' && observado.winnerConfidence === 'condicionado', esperado: { verificacao: 'indisponivel', winnerConfidence: 'condicionado' }, observado: { verificacao: observado.cascadeLimitations.mecanismos.cascadeLayers.verificacao, winnerConfidence: observado.winnerConfidence } };
});
check('L05', 'B04', 'sinal de scoping nao prova ausencia e condiciona', async () => {
  const regra = makeMatch({ id: 'scope', selectorText: '#scope', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }], scope: '@scope(.x)' });
  const instancia = makeCore({ matchedCSSRules: [regra] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.cascadeLimitations.mecanismos.scopingProximity.verificacao === 'confirmado' && observado.winnerConfidence === 'condicionado', esperado: { verificacao: 'confirmado', winnerConfidence: 'condicionado' }, observado: { verificacao: observado.cascadeLimitations.mecanismos.scopingProximity.verificacao, winnerConfidence: observado.winnerConfidence } };
});
check('L06', 'B04', 'regra condicional detectada condiciona o vencedor', async () => {
  const regra = makeMatch({ id: 'media', selectorText: '#media', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }], media: '(min-width: 800px)' });
  const instancia = makeCore({ matchedCSSRules: [regra] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return { ok: observado.cascadeLimitations.mecanismos.regrasCondicionais.verificacao === 'confirmado' && observado.winnerConfidence === 'condicionado', esperado: { verificacao: 'confirmado', winnerConfidence: 'condicionado' }, observado: { verificacao: observado.cascadeLimitations.mecanismos.regrasCondicionais.verificacao, winnerConfidence: observado.winnerConfidence } };
});

check('P01', 'preservacao', 'parser regex continua removido e indice estrito preservado', async () => {
  const regra = makeMatch({ id: 'p', selectorText: '.p', specificity: { a: 0, b: 1, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const especificidade = await core.ruleSpecificity(regra.rule, regra, null);
  const parser = await core.specificityFromSelector('#a');
  return { ok: especificidade.status === 'disponivel' && parser.status === 'indisponivel' && parser.reason === 'parser-regex-removido', esperado: { especificidade: 'disponivel', parser: 'indisponivel' }, observado: { especificidade: especificidade.status, parser: parser.status } };
});
check('P02', 'preservacao', 'proveniencia USER preservada', async () => {
  const regra = makeMatch({ id: 'user', selectorText: '#user', origin: 'user-agent', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 10, 20)', important: true }] });
  const instancia = makeCore({ matchedCSSRules: [regra] }, 'rgb(200, 10, 20)');
  const observado = await instancia.getWinningRule(1, 'color', {
    provenance: [{ origin: 'user', selectorText: '#user', declaredValue: 'rgb(200, 10, 20)', important: true }],
  });
  return { ok: observado.winningDeclaration.origin === 'user' && observado.winningDeclaration.cdpOrigin === 'user-agent', esperado: { origin: 'user', cdpOrigin: 'user-agent' }, observado: { origin: observado.winningDeclaration.origin, cdpOrigin: observado.winningDeclaration.cdpOrigin } };
});

Promise.all(pendencias).then(() => {
  const resumo = {
    total: testes.length,
    PASS: testes.filter((item) => item.status === 'PASS').length,
    FAIL: testes.filter((item) => item.status === 'FAIL').length,
  };
  const outIndex = process.argv.findIndex((arg) => arg.startsWith('--out='));
  const OUT = outIndex >= 0
    ? path.resolve(process.argv[outIndex].slice('--out='.length))
    : path.join(__dirname, 'resultados', 'teste-r266-aud-b.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const resultado = {
    meta: {
      id: 'r266-aud-b-unitario',
      core: CORE_PATH,
      coreSha256: sha(fs.readFileSync(CORE_PATH)),
      data: new Date().toISOString(),
    },
    testes,
    resumo,
  };
  const semHash = JSON.parse(JSON.stringify(resultado));
  const hash = sha(JSON.stringify(semHash, null, 2));
  resultado.meta.hash = hash;
  resultado.verification = { hashMatches: true, declared: hash, recalculated: hash };
  fs.writeFileSync(OUT, `${JSON.stringify(resultado, null, 2)}\n`);
  const relido = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const recalculado = JSON.parse(JSON.stringify(relido));
  delete recalculado.meta.hash;
  delete recalculado.verification;
  const h2 = sha(JSON.stringify(recalculado, null, 2));
  relido.verification.hashMatches = h2 === hash;
  relido.verification.recalculated = h2;
  fs.writeFileSync(OUT, `${JSON.stringify(relido, null, 2)}\n`);
  console.log(`R266-AUD-B unitario: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL`);
  if (resumo.FAIL > 0 || !relido.verification.hashMatches) process.exitCode = 1;
});
