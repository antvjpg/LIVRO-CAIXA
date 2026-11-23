const fs = require('fs');
const path = require('path');

const CORE_PATH = path.resolve(
  __dirname,
  '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud/c4-v05-b-r2-6-6-r266-aud-core.cjs',
);
const { createCDPAuditCore } = require(CORE_PATH);

function sha(value) {
  return require('crypto').createHash('sha256').update(value).digest('hex');
}

function makeMatch(options) {
  const selectorsText = Array.isArray(options.selectorText) ? options.selectorText : [options.selectorText];
  const selectors = selectorsText.map((text) => ({
    text,
    specificity: options.specificity || null,
  }));
  const cssProperties = (options.declarations || []).map((declaration) => ({
    name: declaration.name || 'color',
    value: declaration.value,
    text: `${declaration.name || 'color'}: ${declaration.value}${declaration.important ? ' !important' : ''}`,
    important: Boolean(declaration.important),
    implicit: false,
    parsedOk: declaration.parsedOk !== false,
    disabled: Boolean(declaration.disabled),
  }));
  return {
    matchingSelectors: options.matchingSelectors === undefined ? [0] : options.matchingSelectors,
    rule: {
      id: options.id || null,
      origin: options.origin || 'author',
      selectorList: {
        text: selectorsText.join(', '),
        selectors,
      },
      style: { cssProperties },
    },
  };
}

function makeCore(matched, computedValue, options = {}) {
  const CSS = {
    getMatchedStylesForNode: async () => matched,
    getInlineStylesForNode: async () => ({ inlineStyle: { cssProperties: [] } }),
    getComputedStyleForNode: async () => ({
      computedStyle: [{ name: 'color', value: computedValue || null }],
    }),
  };
  const Runtime = {
    evaluate: async () => ({ result: { value: computedValue || null } }),
  };
  return createCDPAuditCore({
    CDP: {},
    DOM: {},
    CSS,
    Runtime,
    consoleErrors: [],
    exceptions: [],
    cdpErrors: [],
    ...options,
  });
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
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

const coreBase = makeCore({ matchedCSSRules: [] }, 'rgb(0, 0, 0)');

check('S1', 'especificidade', 'indice numerico valido', async () => {
  const match = makeMatch({ selectorText: '.a', specificity: { a: 0, b: 1, c: 0 }, matchingSelectors: [0] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'disponivel' && same(observado.specificity, { a: 0, b: 1, c: 0 }), esperado: { a: 0, b: 1, c: 0 }, observado };
});
check('S2', 'especificidade', 'objeto com indice valido', async () => {
  const match = makeMatch({
    selectorText: ['.a', '#b'],
    specificity: null,
    matchingSelectors: [{ index: 1 }],
  });
  match.rule.selectorList.selectors[1].specificity = { a: 1, b: 0, c: 0 };
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'disponivel' && observado.melhorIndice === 1, esperado: { melhorIndice: 1 }, observado };
});
check('S3', 'especificidade', 'seletores agrupados com maximo por metadado CDP', async () => {
  const match = makeMatch({
    selectorText: ['.a', '#b'],
    specificity: { a: 0, b: 1, c: 0 },
    matchingSelectors: [0, 1],
  });
  match.rule.selectorList.selectors[1].specificity = { a: 1, b: 0, c: 0 };
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'disponivel' && same(observado.specificity, { a: 1, b: 0, c: 0 }), esperado: { a: 1, b: 0, c: 0 }, observado };
});
check('S4', 'especificidade', ':where aceito quando CDP fornece especificidade', async () => {
  const match = makeMatch({
    selectorText: ':where(.a) #b',
    specificity: { a: 1, b: 0, c: 0 },
    matchingSelectors: [0],
  });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'disponivel' && observado.sintaxe.status === 'complexa', esperado: { status: 'disponivel', sintaxe: 'complexa' }, observado };
});
check('S5', 'especificidade', ':is, :not e :has aceitos via metadado estruturado', async () => {
  const match = makeMatch({
    selectorText: ':is(.a) :not(.b) :has(.c)',
    specificity: { a: 0, b: 3, c: 0 },
    matchingSelectors: [0],
  });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'disponivel' && observado.source === 'cdp', esperado: { status: 'disponivel', source: 'cdp' }, observado };
});
check('S6', 'especificidade', 'pseudo-elemento subtraindo c da especificidade CDP', async () => {
  const match = makeMatch({
    selectorText: '.a::after',
    specificity: { a: 0, b: 1, c: 1 },
    matchingSelectors: [0],
  });
  const observado = coreBase.ruleSpecificity(match.rule, match, '::after');
  return { ok: observado.status === 'disponivel' && same(observado.specificity, { a: 0, b: 1, c: 0 }), esperado: { a: 0, b: 1, c: 0 }, observado };
});
check('S7', 'especificidade', 'matchingSelectors ausente produz insuficiencia', async () => {
  const match = makeMatch({ selectorText: '.a', specificity: { a: 0, b: 1, c: 0 } });
  const observado = coreBase.ruleSpecificity(match.rule, { rule: match.rule }, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'matching-selectors-ausente', esperado: { status: 'insuficiente', reason: 'matching-selectors-ausente' }, observado };
});
check('S8', 'especificidade', 'indice textual nao e convertido', async () => {
  const match = makeMatch({ selectorText: '.a', specificity: { a: 0, b: 1, c: 0 }, matchingSelectors: ['0'] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'indice-invalido', esperado: { status: 'insuficiente', reason: 'indice-invalido' }, observado };
});
check('S9', 'especificidade', 'objeto com indice textual nao e aceito', async () => {
  const match = makeMatch({ selectorText: '.a', specificity: { a: 0, b: 1, c: 0 }, matchingSelectors: [{ index: '0' }] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'indice-invalido', esperado: { status: 'insuficiente', reason: 'indice-invalido' }, observado };
});
check('S10', 'especificidade', 'indice fora do array nao usa seletor zero', async () => {
  const match = makeMatch({ selectorText: '.a', specificity: { a: 0, b: 1, c: 0 }, matchingSelectors: [7] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'indice-fora-do-array', esperado: { status: 'insuficiente', reason: 'indice-fora-do-array' }, observado };
});
check('S11', 'especificidade', 'ausencia de especificidade CDP nao usa parser', async () => {
  const match = makeMatch({ selectorText: '#a', specificity: null, matchingSelectors: [0] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'especificidade-cdp-ausente', esperado: { status: 'insuficiente', reason: 'especificidade-cdp-ausente' }, observado };
});
check('S12', 'especificidade', 'componente fracionario e rejeitado', async () => {
  const match = makeMatch({ selectorText: '#a', specificity: { a: 1.5, b: 0, c: 0 }, matchingSelectors: [0] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'especificidade-cdp-ausente', esperado: { status: 'insuficiente', reason: 'especificidade-cdp-ausente' }, observado };
});
check('S13', 'parser', 'parser regex simplificado removido', async () => {
  const observado = coreBase.specificityFromSelector('#a');
  return { ok: observado.status === 'indisponivel' && observado.reason === 'parser-regex-removido', esperado: { status: 'indisponivel', reason: 'parser-regex-removido' }, observado };
});
check('S14', 'parser', 'sintaxe complexa sem CDP fica indisponivel', async () => {
  const match = makeMatch({ selectorText: ':has(.a)', specificity: null, matchingSelectors: [0] });
  const observado = coreBase.ruleSpecificity(match.rule, match, null);
  return { ok: observado.status === 'insuficiente' && observado.reason === 'especificidade-cdp-ausente', esperado: { status: 'insuficiente', reason: 'especificidade-cdp-ausente' }, observado };
});

check('H1', 'heranca', 'pai proximo vence avo mais especifico', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#h1-pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const avo = makeMatch({ id: 'avo', selectorText: '#h1-avo.alt', specificity: { a: 1, b: 1, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [pai] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(0, 0, 255)');
  const observado = await core.getWinningRule(1, 'color');
  const ok = observado.winningDeclaration.value === 'rgb(0, 0, 255)'
    && observado.inheritance.status === 'herdada'
    && observado.inheritance.providerLevel === 1
    && observado.inheritance.providerNodeId === 10
    && observado.inheritance.originDeclaration.selectorText === '#h1-pai';
  return { ok, esperado: { valor: 'rgb(0, 0, 255)', nivel: 1, origem: '#h1-pai' }, observado: { valor: observado.winningDeclaration && observado.winningDeclaration.value, heranca: observado.inheritance } };
});
check('H2', 'heranca', 'pai sem declaracao; avo fornece valor', async () => {
  const avo = makeMatch({ id: 'avo', selectorText: '#h2-avo', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(10, 20, 30)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(10, 20, 30)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.inheritance.providerLevel === 2 && observado.inheritance.originDeclaration.selectorText === '#h2-avo', esperado: { nivel: 2, origem: '#h2-avo' }, observado: observado.inheritance };
});
check('H3', 'heranca', 'importante do pai vence avo de maior especificidade', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#h3-pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 128, 0)', important: true }] });
  const avo = makeMatch({ id: 'avo', selectorText: '#h3-avo.alt', specificity: { a: 1, b: 1, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [pai] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(0, 128, 0)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.winningDeclaration.value === 'rgb(0, 128, 0)' && observado.winningDeclaration.important === true, esperado: { valor: 'rgb(0, 128, 0)', importante: true }, observado: { valor: observado.winningDeclaration.value, importante: observado.winningDeclaration.important } };
});
check('H4', 'heranca', 'declaracao propria nao compete com herdadas', async () => {
  const proprio = makeMatch({ id: 'filho', selectorText: '#h4-filho', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(1, 2, 3)' }] });
  const avo = makeMatch({ id: 'avo', selectorText: '#h4-avo.muitoespecifico', specificity: { a: 1, b: 2, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 0, 0)' }] });
  const core = makeCore({ matchedCSSRules: [proprio], inherited: [{ nodeId: 10, matchedCSSRules: [] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(1, 2, 3)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.inheritance.status === 'propria' && observado.winningDeclaration.value === 'rgb(1, 2, 3)', esperado: { status: 'propria', valor: 'rgb(1, 2, 3)' }, observado: { status: observado.inheritance.status, valor: observado.winningDeclaration.value } };
});
check('H5', 'heranca', 'tres niveis com origem apenas no mais distante', async () => {
  const bisavo = makeMatch({ id: 'bisavo', selectorText: '#h5-bisavo', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(8, 9, 10)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [] }, { nodeId: 20, matchedCSSRules: [] }, { nodeId: 30, matchedCSSRules: [bisavo] }] }, 'rgb(8, 9, 10)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.inheritance.providerLevel === 3 && observado.inheritance.providerNodeId === 30, esperado: { nivel: 3, no: 30 }, observado: observado.inheritance };
});
check('H6', 'heranca', 'recebedor e origem declarativa permanecem distintos', async () => {
  const avo = makeMatch({ id: 'avo', selectorText: '#h6-avo', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(11, 12, 13)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [] }, { nodeId: 20, matchedCSSRules: [avo] }] }, 'rgb(11, 12, 13)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.inheritance.receiverNodeId === 1 && observado.inheritance.providerNodeId === 20 && observado.inheritance.originDeclaration.selectorText === '#h6-avo', esperado: { recebedor: 1, provedor: 20, origem: '#h6-avo' }, observado: observado.inheritance };
});
check('H7', 'heranca', 'metadados contraditorios de ancestral produzem insuficiencia', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, parentNodeId: 99, matchedCSSRules: [pai] }] }, 'rgb(0, 0, 255)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'inheritance-insufficient' && observado.winningDeclaration === null && observado.inheritance.status === 'insuficiente', esperado: { captureStatus: 'inheritance-insufficient', vencedor: null }, observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration, heranca: observado.inheritance.status } };
});
check('H8', 'heranca', 'indice invalido em ancestral nao gera vencedor', async () => {
  const pai = makeMatch({ id: 'pai', selectorText: '#pai', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: ['0'], declarations: [{ value: 'rgb(0, 0, 255)' }] });
  const core = makeCore({ matchedCSSRules: [], inherited: [{ nodeId: 10, matchedCSSRules: [pai] }] }, 'rgb(0, 0, 255)');
  const observado = await core.getWinningRule(1, 'color');
  return { ok: observado.captureStatus === 'specificity-insufficient' && observado.winningDeclaration === null, esperado: { captureStatus: 'specificity-insufficient', vencedor: null }, observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration } };
});

check('P1', 'preservacao', 'proveniencia USER preservada no no proprio', async () => {
  const match = makeMatch({ id: 'user', selectorText: '#user', origin: 'user-agent', specificity: { a: 1, b: 0, c: 0 }, matchingSelectors: [0], declarations: [{ value: 'rgb(200, 10, 20)', important: true }] });
  const core = makeCore({ matchedCSSRules: [match] }, 'rgb(200, 10, 20)');
  const observado = await core.getWinningRule(1, 'color', {
    provenance: [{ origin: 'user', selectorText: '#user', declaredValue: 'rgb(200, 10, 20)', important: true }],
  });
  return { ok: observado.winningDeclaration.origin === 'user' && observado.winningDeclaration.cdpOrigin === 'user-agent', esperado: { origin: 'user', cdpOrigin: 'user-agent' }, observado: { origin: observado.winningDeclaration.origin, cdpOrigin: observado.winningDeclaration.cdpOrigin } };
});
check('P2', 'preservacao', 'pseudo-elemento continua resolvido', async () => {
  const match = makeMatch({ id: 'pseudo', selectorText: '#pseudo::after', specificity: { a: 1, b: 0, c: 1 }, matchingSelectors: [0], declarations: [{ value: 'rgb(4, 5, 6)' }] });
  const core = makeCore({ matchedCSSRules: [], pseudoElements: [{ pseudoType: 'after', matches: [match] }] }, 'rgb(4, 5, 6)');
  const observado = await core.getWinningRule(1, 'color', { pseudoElement: '::after', selector: '#pseudo' });
  return { ok: observado.resolveStatus === 'computed' && observado.winningDeclaration.value === 'rgb(4, 5, 6)' && observado.inheritance.status === 'nao-aplicavel', esperado: { resolveStatus: 'computed', valor: 'rgb(4, 5, 6)' }, observado: { resolveStatus: observado.resolveStatus, valor: observado.winningDeclaration.value, heranca: observado.inheritance.status } };
});
check('P3', 'preservacao', 'limitacoes da cascata sao sinalizadas', async () => {
  const observado = coreBase.cascadeLimitations([]);
  const ids = observado.limitacoes.map((item) => item.id);
  return { ok: observado.status === 'delimitado' && ids.length === 5 && ids.includes('cascade-layers') && ids.includes('animacoes-transicoes'), esperado: { status: 'delimitado', total: 5 }, observado: { status: observado.status, ids } };
});

Promise.all(pendencias).then(() => {
  const resumo = {
    total: testes.length,
    PASS: testes.filter((teste) => teste.status === 'PASS').length,
    FAIL: testes.filter((teste) => teste.status === 'FAIL').length,
  };

  const outIndex = process.argv.findIndex((arg) => arg.startsWith('--out='));
  const OUT = outIndex >= 0
    ? path.resolve(process.argv[outIndex].slice('--out='.length))
    : path.join(__dirname, 'resultados', 'teste-r266-aud.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const resultado = {
    meta: {
      id: 'r266-aud-unitario',
      core: CORE_PATH,
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

  console.log(`R266-AUD unitario: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL`);
  if (resumo.FAIL > 0 || !relido.verification.hashMatches) process.exitCode = 1;
});
