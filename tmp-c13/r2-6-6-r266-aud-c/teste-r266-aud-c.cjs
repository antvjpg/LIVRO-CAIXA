const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORE_PATH = path.resolve(
  __dirname,
  '../../docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-c/c4-v05-b-r2-6-6-r266-aud-c-core.cjs',
);
const { createCDPAuditCore } = require(CORE_PATH);

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function decl(value, options = {}) {
  const item = { name: 'color', value, implicit: false };
  if (options.important !== undefined) item.important = options.important;
  if (options.text !== undefined) item.text = options.text;
  else if (options.important === true) item.text = `color: ${value} !important`;
  else if (options.important === false) item.text = `color: ${value}`;
  return item;
}

function makeMatch(options) {
  const specificity = options.specificity || { a: 1, b: 0, c: 0 };
  return {
    matchingSelectors: options.matchingSelectors || [0],
    rule: {
      id: options.id || null,
      origin: options.origin === undefined ? 'author' : options.origin,
      selectorList: {
        text: options.selectorText || '#candidate',
        selectors: [{ text: options.selectorText || '#candidate', specificity }],
      },
      style: { cssProperties: options.declarations || [decl('rgb(0, 0, 0)')] },
    },
  };
}

function makeCore(matched, computedValue) {
  const CSS = {
    getMatchedStylesForNode: async () => matched,
    getInlineStylesForNode: async () => ({ inlineStyle: { cssProperties: [] } }),
    getLayersForNode: async () => ({ layers: [] }),
    getComputedStyleForNode: async () => ({
      computedStyle: [
        { name: 'color', value: computedValue || null },
        { name: 'animation-name', value: 'none' },
        { name: 'transition-property', value: 'none' },
      ],
    }),
  };
  return createCDPAuditCore({
    CDP: {},
    DOM: { resolveNode: async () => ({ object: { objectId: 'obj-c' } }) },
    CSS,
    Runtime: {
      evaluate: async () => ({ result: { value: computedValue || null } }),
      callFunctionOn: async () => ({ result: { value: false } }),
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

const importanceCases = [
  ['I01', 'important true', decl('rgb(0, 0, 255)', { important: true }), true, 'explicit'],
  ['I02', 'important false', decl('rgb(0, 0, 255)', { important: false }), false, 'explicit'],
  ['I03', 'campo ausente sem texto', decl('rgb(0, 0, 255)', { text: null }), null, 'unknown'],
  ['I04', 'important null', { name: 'color', value: 'rgb(0, 0, 255)', important: null, implicit: false }, null, 'unknown'],
  ['I05', 'important tipo invalido', { name: 'color', value: 'rgb(0, 0, 255)', important: 'true', implicit: false }, null, 'unknown'],
  ['I06', 'texto !important', decl('rgb(0, 0, 255)', { text: 'color: rgb(0, 0, 255) !important' }), true, 'text'],
  ['I07', 'texto normal explicito', decl('rgb(0, 0, 255)', { text: 'color: rgb(0, 0, 255)' }), false, 'text'],
  ['I08', 'metadado false contra texto importante', decl('rgb(0, 0, 255)', { important: false, text: 'color: rgb(0, 0, 255) !important' }), null, 'contradiction'],
  ['I09', 'metadado true contra texto normal', decl('rgb(0, 0, 255)', { important: true, text: 'color: rgb(0, 0, 255)' }), null, 'contradiction'],
  ['I10', 'metadado ausente com texto ambiguo', decl('rgb(0, 0, 255)', { text: 'color: rgb(0, 0, 255) !important extra' }), null, 'ambiguous'],
];
for (const [id, descricao, propriedade, esperadoValor, esperadoStatus] of importanceCases) {
  check(id, 'B05', descricao, async () => {
    const observado = await core.readImportance(propriedade);
    return {
      ok: observado.value === esperadoValor && observado.status === esperadoStatus,
      esperado: { value: esperadoValor, status: esperadoStatus },
      observado,
    };
  });
}

check('I11', 'B05', 'importancia desconhecida pode alterar o vencedor', async () => {
  const desconhecida = makeMatch({
    id: 'desconhecida',
    selectorText: '#desconhecida',
    specificity: { a: 2, b: 0, c: 0 },
    declarations: [decl('rgb(200, 0, 0)', { text: 'color: rgb(200, 0, 0) !important maybe' })],
  });
  const conhecida = makeMatch({
    id: 'conhecida',
    selectorText: '#conhecida',
    specificity: { a: 1, b: 0, c: 0 },
    declarations: [decl('rgb(0, 0, 255)', { important: false })],
  });
  const instancia = makeCore({ matchedCSSRules: [desconhecida, conhecida] }, 'rgb(200, 0, 0)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'importance-insufficient' && observado.winningDeclaration === null,
    esperado: { captureStatus: 'importance-insufficient', vencedor: null },
    observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration },
  };
});
check('I12', 'B05', 'importancia desconhecida irrelevante nao bloqueia mas rebaixa confianca', async () => {
  const unica = makeMatch({ id: 'unica', declarations: [decl('rgb(0, 0, 255)', { text: 'color: rgb(0, 0, 255) important?' })] });
  const instancia = makeCore({ matchedCSSRules: [unica] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'captured' && observado.winnerConfidence === 'condicionado' && observado.winningDeclaration.important === null,
    esperado: { captureStatus: 'captured', winnerConfidence: 'condicionado', important: null },
    observado: { captureStatus: observado.captureStatus, winnerConfidence: observado.winnerConfidence, important: observado.winningDeclaration && observado.winningDeclaration.important },
  };
});
check('I13', 'B05', 'contradicao impede promocao automatica', async () => {
  const contraditoria = makeMatch({
    id: 'contraditoria',
    declarations: [decl('rgb(0, 0, 255)', { important: false, text: 'color: rgb(0, 0, 255) !important' })],
  });
  const instancia = makeCore({ matchedCSSRules: [contraditoria] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'importance-contradiction' && observado.winningDeclaration === null,
    esperado: { captureStatus: 'importance-contradiction', vencedor: null },
    observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration },
  };
});

const originMatrix = [
  ['O01', 'author normal vs user normal', 'author', false, 'user', false, 'rgb(0, 128, 0)', 'author'],
  ['O02', 'author normal vs user-agent normal', 'author', false, 'user-agent', false, 'rgb(0, 128, 0)', 'author'],
  ['O03', 'user normal vs user-agent normal', 'user', false, 'user-agent', false, 'rgb(0, 0, 255)', 'user'],
  ['O04', 'user-agent important vs user important', 'user-agent', true, 'user', true, 'rgb(200, 0, 0)', 'user-agent'],
  ['O05', 'user-agent important vs author important', 'user-agent', true, 'author', true, 'rgb(200, 0, 0)', 'user-agent'],
  ['O06', 'user important vs author important', 'user', true, 'author', true, 'rgb(20, 0, 255)', 'user'],
  ['O07', 'author normal vs author important', 'author', false, 'author', true, 'rgb(10, 128, 10)', 'author'],
  ['O08', 'user normal vs user important', 'user', false, 'user', true, 'rgb(20, 0, 255)', 'user'],
  ['O09', 'user-agent normal vs user-agent important', 'user-agent', false, 'user-agent', true, 'rgb(200, 0, 0)', 'user-agent'],
  ['O10', 'author important vs user important', 'author', true, 'user', true, 'rgb(20, 0, 255)', 'user'],
  ['O11', 'user important vs user-agent important', 'user', true, 'user-agent', true, 'rgb(200, 0, 0)', 'user-agent'],
  ['O12', 'author important vs user-agent important', 'author', true, 'user-agent', true, 'rgb(200, 0, 0)', 'user-agent'],
];
const COR_RANK = {
  authorNormal: 'rgb(0, 128, 0)',
  authorImportant: 'rgb(10, 128, 10)',
  userNormal: 'rgb(0, 0, 255)',
  userImportant: 'rgb(20, 0, 255)',
  uaNormal: 'rgb(100, 100, 100)',
  uaImportant: 'rgb(200, 0, 0)',
};
for (const [id, descricao, origemA, impA, origemB, impB, valorEsperado, origemEsperada] of originMatrix) {
  check(id, 'B06', descricao, async () => {
    const valorA = COR_RANK[`${origemA.replace('-', '')}${impA ? 'Important' : 'Normal'}`]
      || (origemA === 'user-agent' ? (impA ? COR_RANK.uaImportant : COR_RANK.uaNormal) : null);
    const valorB = COR_RANK[`${origemB.replace('-', '')}${impB ? 'Important' : 'Normal'}`]
      || (origemB === 'user-agent' ? (impB ? COR_RANK.uaImportant : COR_RANK.uaNormal) : null);
    const regraA = makeMatch({ id: 'a', origin: origemA, declarations: [decl(valorA, { important: impA })] });
    const regraB = makeMatch({ id: 'b', origin: origemB, declarations: [decl(valorB, { important: impB })] });
    const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [regraA, regraB] }] }, valorEsperado);
    const observado = await instancia.getWinningRule(1, 'color');
    const vencedor = observado.winningDeclaration;
    return {
      ok: Boolean(vencedor) && vencedor.value === valorEsperado && vencedor.origin === origemEsperada,
      esperado: { value: valorEsperado, origin: origemEsperada },
      observado: vencedor ? { value: vencedor.value, origin: vencedor.origin, important: vencedor.important } : null,
    };
  });
}

check('H01', 'B06 heranca', 'pai imediato com duas origens normais', async () => {
  const autor = makeMatch({ id: 'autor', origin: 'author', declarations: [decl(COR_RANK.authorNormal, { important: false })] });
  const user = makeMatch({ id: 'user', origin: 'user', declarations: [decl(COR_RANK.userNormal, { important: false })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [autor, user] }] }, COR_RANK.authorNormal);
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.winningDeclaration.origin === 'author' && observado.inheritance.providerLevel === 1,
    esperado: { origin: 'author', providerLevel: 1 },
    observado: { origin: observado.winningDeclaration.origin, providerLevel: observado.inheritance.providerLevel },
  };
});
check('H02', 'B06 heranca', 'pai imediato com origem normal e importante', async () => {
  const normal = makeMatch({ id: 'normal', origin: 'user', declarations: [decl(COR_RANK.userNormal, { important: false })] });
  const importante = makeMatch({ id: 'importante', origin: 'author', declarations: [decl(COR_RANK.authorImportant, { important: true })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [normal, importante] }] }, COR_RANK.authorImportant);
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.winningDeclaration.important === true && observado.winningDeclaration.origin === 'author',
    esperado: { important: true, origin: 'author' },
    observado: { important: observado.winningDeclaration.important, origin: observado.winningDeclaration.origin },
  };
});
check('H03', 'B06 heranca', 'avo fornecedor com disputa de origens', async () => {
  const autor = makeMatch({ id: 'autor', origin: 'author', declarations: [decl(COR_RANK.authorImportant, { important: true })] });
  const user = makeMatch({ id: 'user', origin: 'user', declarations: [decl(COR_RANK.userImportant, { important: true })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [] }, { matchedCSSRules: [autor, user] }] }, COR_RANK.userImportant);
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.winningDeclaration.origin === 'user' && observado.inheritance.providerLevel === 2,
    esperado: { origin: 'user', providerLevel: 2 },
    observado: { origin: observado.winningDeclaration.origin, providerLevel: observado.inheritance.providerLevel },
  };
});
check('H04', 'B06 heranca', 'declaracao propria impede confusao com disputa do ancestral', async () => {
  const proprio = makeMatch({ id: 'proprio', origin: 'author', declarations: [decl('rgb(1, 2, 3)', { important: false })] });
  const autor = makeMatch({ id: 'autor', origin: 'author', declarations: [decl(COR_RANK.authorImportant, { important: true })] });
  const user = makeMatch({ id: 'user', origin: 'user', declarations: [decl(COR_RANK.userImportant, { important: true })] });
  const instancia = makeCore({ matchedCSSRules: [proprio], inherited: [{ matchedCSSRules: [autor, user] }] }, 'rgb(1, 2, 3)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.decisionSet.origem === 'propria' && observado.winningDeclaration.value === 'rgb(1, 2, 3)',
    esperado: { origem: 'propria', value: 'rgb(1, 2, 3)' },
    observado: { origem: observado.decisionSet.origem, value: observado.winningDeclaration.value },
  };
});
check('H05', 'B06 heranca', 'ancestral distante irrelevante', async () => {
  const pai = makeMatch({ id: 'pai', origin: 'author', declarations: [decl(COR_RANK.authorNormal, { important: false })] });
  const distante = makeMatch({ id: 'distante', origin: 'user', declarations: [decl(COR_RANK.userImportant, { important: true })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [pai] }, { matchedCSSRules: [distante] }] }, COR_RANK.authorNormal);
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.winningDeclaration.value === COR_RANK.authorNormal && observado.ignorados.length === 1,
    esperado: { value: COR_RANK.authorNormal, ignorados: 1 },
    observado: { value: observado.winningDeclaration.value, ignorados: observado.ignorados.length },
  };
});
check('H06', 'B06 heranca', 'origem incompleta no grupo relevante bloqueia', async () => {
  const desconhecida = makeMatch({ id: 'sem-origem', origin: null, declarations: [decl('rgb(200, 0, 0)', { important: false })] });
  const conhecida = makeMatch({ id: 'conhecida', origin: 'author', declarations: [decl('rgb(0, 0, 255)', { important: false })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [desconhecida, conhecida] }] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'origin-insufficient' && observado.winningDeclaration === null,
    esperado: { captureStatus: 'origin-insufficient', vencedor: null },
    observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration },
  };
});
check('H07', 'B06 heranca', 'origem desconhecida isolada rebaixa confianca', async () => {
  const unica = makeMatch({ id: 'sem-origem', origin: null, declarations: [decl('rgb(0, 0, 255)', { important: false })] });
  const instancia = makeCore({ matchedCSSRules: [unica] }, 'rgb(0, 0, 255)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'captured' && observado.winnerConfidence === 'condicionado',
    esperado: { captureStatus: 'captured', winnerConfidence: 'condicionado' },
    observado: { captureStatus: observado.captureStatus, winnerConfidence: observado.winnerConfidence },
  };
});
check('H08', 'B06 heranca', 'empate com metadados contraditorios nao gera vencedor', async () => {
  const a = makeMatch({ id: 'a', origin: 'author', declarations: [decl('rgb(0, 0, 255)', { important: false, text: 'color: rgb(0, 0, 255) !important' })] });
  const b = makeMatch({ id: 'b', origin: 'author', declarations: [decl('rgb(0, 128, 0)', { important: true })] });
  const instancia = makeCore({ matchedCSSRules: [], inherited: [{ matchedCSSRules: [a, b] }] }, 'rgb(0, 128, 0)');
  const observado = await instancia.getWinningRule(1, 'color');
  return {
    ok: observado.captureStatus === 'importance-contradiction' && observado.winningDeclaration === null,
    esperado: { captureStatus: 'importance-contradiction', vencedor: null },
    observado: { captureStatus: observado.captureStatus, vencedor: observado.winningDeclaration },
  };
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
    : path.join(__dirname, 'resultados', 'teste-r266-aud-c.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const resultado = {
    meta: {
      id: 'r266-aud-c-unitario',
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
  console.log(`R266-AUD-C unitario: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL`);
  if (resumo.FAIL > 0 || !relido.verification.hashMatches) process.exitCode = 1;
});
