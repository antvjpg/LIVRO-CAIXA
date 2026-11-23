'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validarDisputa } = require(path.join(__dirname, 'contrato-disputa.cjs'));

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cand(origin, value, important, extra = {}) {
  return {
    origin,
    cdpOrigin: extra.cdpOrigin || (origin === 'user-agent' ? 'user-agent' : origin === 'user' ? 'user-agent' : 'regular'),
    value,
    important,
    importanceStatus: extra.importanceStatus || 'explicit',
    selectorText: extra.selectorText || `${origin}-selector`,
    source: extra.source || 'stylesheet',
    specificity: extra.specificity || { a: 0, b: 0, c: 1 },
    specificityStatus: 'disponivel',
    order: extra.order || 1,
    provenance: extra.provenance || null,
  };
}

function expected(winner, competitors, computed) {
  return { winner, concorrentes: competitors, computed };
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

const matriz = [
  ['U01', 'AUTHOR normal vence USER normal', cand('author', 'rgb(0, 0, 255)', false), cand('user', 'rgb(20, 0, 255)', false), expected({ origin: 'author', value: 'rgb(0, 0, 255)', important: false }, [{ origin: 'author', value: 'rgb(0, 0, 255)', important: false }, { origin: 'user', value: 'rgb(20, 0, 255)', important: false, cdpOrigin: 'user-agent' }], 'rgb(0, 0, 255)')],
  ['U02', 'AUTHOR normal vence USER-AGENT normal', cand('author', '14px', false), cand('user-agent', '2em', false), expected({ origin: 'author', value: '14px', important: false }, [{ origin: 'author', value: '14px', important: false }, { origin: 'user-agent', value: '2em', important: false }], '14px')],
  ['U03', 'USER normal vence USER-AGENT normal', cand('user', '18px', false), cand('user-agent', '2em', false), expected({ origin: 'user', value: '18px', important: false }, [{ origin: 'user', value: '18px', important: false, cdpOrigin: 'user-agent' }, { origin: 'user-agent', value: '2em', important: false }], '18px')],
  ['U04', 'USER-AGENT important vence USER important', cand('user-agent', 'none', true), cand('user', 'block', true), expected({ origin: 'user-agent', value: 'none', important: true }, [{ origin: 'user-agent', value: 'none', important: true }, { origin: 'user', value: 'block', important: true, cdpOrigin: 'user-agent' }], 'none')],
  ['U05', 'USER-AGENT important vence AUTHOR important', cand('user-agent', 'none', true), cand('author', 'block', true), expected({ origin: 'user-agent', value: 'none', important: true }, [{ origin: 'user-agent', value: 'none', important: true }, { origin: 'author', value: 'block', important: true }], 'none')],
  ['U06', 'USER important vence AUTHOR important', cand('user', 'rgb(200, 10, 20)', true), cand('author', 'rgb(0, 0, 255)', true), expected({ origin: 'user', value: 'rgb(200, 10, 20)', important: true }, [{ origin: 'user', value: 'rgb(200, 10, 20)', important: true, cdpOrigin: 'user-agent' }, { origin: 'author', value: 'rgb(0, 0, 255)', important: true }], 'rgb(200, 10, 20)')],
  ['U07', 'USER important vence AUTHOR normal', cand('user', 'rgb(200, 10, 20)', true), cand('author', 'rgb(0, 0, 255)', false), expected({ origin: 'user', value: 'rgb(200, 10, 20)', important: true }, [{ origin: 'author', value: 'rgb(0, 0, 255)', important: false }, { origin: 'user', value: 'rgb(200, 10, 20)', important: true, cdpOrigin: 'user-agent' }], 'rgb(200, 10, 20)')],
  ['U08', 'AUTHOR important vence USER normal', cand('author', 'rgb(0, 0, 255)', true), cand('user', 'rgb(20, 0, 255)', false), expected({ origin: 'author', value: 'rgb(0, 0, 255)', important: true }, [{ origin: 'user', value: 'rgb(20, 0, 255)', important: false, cdpOrigin: 'user-agent' }, { origin: 'author', value: 'rgb(0, 0, 255)', important: true }], 'rgb(0, 0, 255)')],
  ['U09', 'USER important vence USER-AGENT normal', cand('user', '18px', true), cand('user-agent', '2em', false), expected({ origin: 'user', value: '18px', important: true }, [{ origin: 'user-agent', value: '2em', important: false }, { origin: 'user', value: '18px', important: true, cdpOrigin: 'user-agent' }], '18px')],
  ['U10', 'USER-AGENT important vence AUTHOR normal', cand('user-agent', 'none', true), cand('author', 'block', false), expected({ origin: 'user-agent', value: 'none', important: true }, [{ origin: 'user-agent', value: 'none', important: true }, { origin: 'author', value: 'block', important: false }], 'none')],
];

for (const [id, descricao, vencedor, perdedor, esperado] of matriz) {
  check(id, 'matriz-origens', descricao, async () => {
    const observado = validarDisputa({
      candidatosDecisao: [vencedor, perdedor],
      esperado,
      vencedor,
      valoresComputados: { nucleo: esperado.computed, cdp: esperado.computed, getComputedStyle: esperado.computed },
    });
    return { ok: observado.status === 'PASS', esperado: { status: 'PASS' }, observado };
  });
}

function baseC2() {
  const autor = cand('author', '14px', false, { selectorText: 'h1#d-author-ua-normal', order: 1 });
  const ua = cand('user-agent', '2em', false, { selectorText: 'h1', order: 2 });
  return {
    candidatosDecisao: [autor, ua],
    esperado: expected(
      { origin: 'author', value: '14px', important: false },
      [
        { origin: 'author', value: '14px', important: false, selectorText: 'h1#d-author-ua-normal' },
        { origin: 'user-agent', value: '2em', important: false, selectorText: 'h1' },
      ],
      '14px',
    ),
    vencedor: autor,
    valoresComputados: { nucleo: '14px', cdp: '14px', getComputedStyle: '14px' },
  };
}

const negativos = [
  ['N01', 'candidato AUTHOR ausente', (o) => { o.candidatosDecisao = [o.candidatosDecisao[1]]; }, 'INSUFFICIENT'],
  ['N02', 'candidato USER-AGENT ausente', (o) => { o.candidatosDecisao = [o.candidatosDecisao[0]]; }, 'INSUFFICIENT'],
  ['N03', 'origem desconhecida', (o) => { o.candidatosDecisao[0].origin = null; }, 'INSUFFICIENT'],
  ['N04', 'importancia desconhecida', (o) => { o.candidatosDecisao[0].importanceStatus = 'unknown'; }, 'INSUFFICIENT'],
  ['N05', 'metadados contraditorios', (o) => { o.candidatosDecisao[0].importanceStatus = 'contradiction'; }, 'INSUFFICIENT'],
  ['N06', 'propriedade/valor divergente', (o) => { o.valoresComputados.cdp = '15px'; }, 'FAIL'],
  ['N07', 'vencedor divergente', (o) => { o.vencedor = o.candidatosDecisao[1]; }, 'FAIL'],
  ['N08', 'proveniencia ambigua', (o) => { o.provenienciaRequerida = true; o.provenienciaUnica = false; }, 'INSUFFICIENT'],
  ['N09', 'injecao nao confirmada', (o) => { o.injecaoRequerida = true; o.injecaoConfirmada = false; }, 'INSUFFICIENT'],
  ['N10', 'terceiro candidato', (o) => { o.candidatosDecisao.push(cand('user', '16px', false, { order: 3 })); }, 'INSUFFICIENT'],
];

for (const [id, descricao, mutar, statusEsperado] of negativos) {
  check(id, 'negativos-C2', descricao, async () => {
    const opcoes = baseC2();
    mutar(opcoes);
    const observado = validarDisputa(opcoes);
    return { ok: observado.status === statusEsperado, esperado: { status: statusEsperado }, observado };
  });
}

check('C02-P', 'C2', 'cenario C2 com dois candidatos aprovado', async () => {
  const observado = validarDisputa(baseC2());
  return { ok: observado.status === 'PASS', esperado: { status: 'PASS' }, observado };
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
    : path.join(__dirname, 'resultados', 'teste-r266-aud-d.json');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const resultado = {
    meta: { id: 'r266-aud-d-unitario', data: new Date().toISOString() },
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
  console.log(`R266-AUD-D unitario: ${resumo.PASS} PASS / ${resumo.FAIL} FAIL`);
  if (resumo.FAIL > 0 || !relido.verification.hashMatches) process.exitCode = 1;
});
