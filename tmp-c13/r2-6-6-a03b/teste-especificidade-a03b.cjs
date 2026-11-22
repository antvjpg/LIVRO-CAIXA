'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { selectMaxSpecificity, avaliarEspecificidade } = require(path.join(__dirname, 'especificidade-maxima.cjs'));

const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(__dirname, 'resultados/teste-especificidade-a03b.json');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function spec(a, b, c) {
  return { a, b, c };
}

function seletores(specs) {
  return specs.map((item) => ({ text: item.text || `.s${specs.indexOf(item)}`, specificity: item.spec }));
}

function executar(nome, selectors, matchingSelectors, esperado, esperadoAvaliacao) {
  let resultado = null;
  let avaliacao = null;
  let erro = null;
  try {
    resultado = selectMaxSpecificity(selectors, matchingSelectors);
    avaliacao = avaliarEspecificidade(selectors, matchingSelectors);
  } catch (err) {
    erro = err && err.message ? err.message : String(err);
  }
  const divergencias = [];
  if (erro) divergencias.push(`excecao: ${erro}`);
  if (esperado === null) {
    if (resultado !== null) divergencias.push(`esperado null, observado=${JSON.stringify(resultado)}`);
  } else {
    if (!resultado) divergencias.push('resultado ausente');
    else {
      for (const key of ['a', 'b', 'c']) {
        if (resultado[key] !== esperado[key]) divergencias.push(`${key}: esperado=${esperado[key]} observado=${resultado[key]}`);
      }
      if (esperado.index !== undefined && resultado.index !== esperado.index) divergencias.push(`index: esperado=${esperado.index} observado=${resultado.index}`);
    }
  }
  if (esperadoAvaliacao) {
    if (!avaliacao || avaliacao.status !== esperadoAvaliacao.status) divergencias.push(`status avaliacao: esperado=${esperadoAvaliacao.status} observado=${avaliacao && avaliacao.status}`);
    if (esperadoAvaliacao.indicesValidos && avaliacao && JSON.stringify(avaliacao.indicesValidos) !== JSON.stringify(esperadoAvaliacao.indicesValidos)) divergencias.push(`indicesValidos: esperado=${JSON.stringify(esperadoAvaliacao.indicesValidos)} observado=${JSON.stringify(avaliacao.indicesValidos)}`);
    if (esperadoAvaliacao.indicesSemEspecificidade && avaliacao && JSON.stringify(avaliacao.indicesSemEspecificidade) !== JSON.stringify(esperadoAvaliacao.indicesSemEspecificidade)) divergencias.push(`indicesSemEspecificidade: esperado=${JSON.stringify(esperadoAvaliacao.indicesSemEspecificidade)} observado=${JSON.stringify(avaliacao.indicesSemEspecificidade)}`);
  }
  return {
    nome,
    status: divergencias.length ? 'FAIL' : 'PASS',
    divergencias,
    selectors,
    matchingSelectors,
    esperado,
    esperadoAvaliacao: esperadoAvaliacao || null,
    observado: resultado,
    avaliacao: avaliacao ? {
      status: avaliacao.status,
      indices: avaliacao.indices,
      indicesValidos: avaliacao.indicesValidos,
      indicesInvalidos: avaliacao.indicesInvalidos.length,
      indicesSemEspecificidade: avaliacao.indicesSemEspecificidade,
    } : null,
  };
}

function main() {
  const baixa = { text: '.card', spec: spec(0, 1, 0) };
  const alta = { text: '#app .card', spec: spec(1, 1, 0) };
  const selects = seletores([baixa, alta]);
  const testes = [];
  testes.push(executar('A1 — primeiro seletor menos especifico', selects, [0, 1], { ...spec(1, 1, 0), index: 1 }, { status: 'maximo', indicesValidos: [0, 1] }));
  testes.push(executar('A2 — ordem invertida', selects, [1, 0], { ...spec(1, 1, 0), index: 1 }));
  testes.push(executar('A3 — tres seletores com maximo intermediario', seletores([
    { text: '.a', spec: spec(0, 1, 0) },
    { text: '#b', spec: spec(1, 0, 0) },
    { text: '.c.d', spec: spec(0, 2, 0) },
  ]), [0, 1, 2], { ...spec(1, 0, 0), index: 1 }));
  testes.push(executar('A4 — empate deterministico', seletores([
    { text: '#a', spec: spec(1, 0, 0) },
    { text: '#b', spec: spec(1, 0, 0) },
  ]), [0, 1], { ...spec(1, 0, 0), index: 0 }));
  testes.push(executar('A5 — indice invalido sem fallback', selects, [99], null));
  testes.push(executar('A6 — correspondencia ausente', selects, [], null));
  testes.push(executar('A7 — formato objeto', selects, [{ index: 0 }, { index: 1 }], { ...spec(1, 1, 0), index: 1 }));
  testes.push(executar('A8 — especificidade indisponivel', [
    { text: '.sem-metadado', specificity: null },
    { text: '.outro', specificity: null },
  ], [0, 1], null));
  testes.push(executar('A9 — seletor unico', seletores([baixa]), [0], { ...spec(0, 1, 0), index: 0 }));
  testes.push(executar('A10 — pseudo-elemento preservado', seletores([
    { text: '#a::before', spec: spec(1, 0, 1) },
  ]), [0], { ...spec(1, 0, 1), index: 0 }));
  testes.push(executar('A11 — metadado parcialmente indisponivel', [
    { text: '#a', specificity: spec(1, 0, 0) },
    { text: '#b', specificity: null },
  ], [0, 1], null, { status: 'insuficiente', indicesValidos: [0, 1], indicesSemEspecificidade: [1] }));
  testes.push(executar('A12 — evidencia dos indices com ordem invertida', selects, [1, 0], { ...spec(1, 1, 0), index: 1 }, { status: 'maximo', indicesValidos: [1, 0] }));

  const result = {
    id: 'A-03B-TESTE-ESPECIFICIDADE',
    data: new Date().toISOString(),
    helper: 'tmp-c13/r2-6-6-a03b/especificidade-maxima.cjs',
    criterios: ['todos os indices correspondentes', 'comparacao lexicografica a,b,c', 'ordem irrelevante', 'indices invalidos sem fallback', 'ausencia de evidencia retorna null', 'metadado parcial retorna insuficiente', 'evidencia dos indices correspondentes', 'formato objeto', 'pseudo-elemento preservado'],
    testes,
    resumo: {
      total: testes.length,
      PASS: testes.filter((t) => t.status === 'PASS').length,
      FAIL: testes.filter((t) => t.status === 'FAIL').length,
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
  console.log('Teste A-03B:', JSON.stringify(result.resumo), 'hash:', h2);
  if (result.resumo.FAIL > 0) process.exitCode = 1;
}

main();
