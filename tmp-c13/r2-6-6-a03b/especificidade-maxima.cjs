'use strict';

function normalizeIndex(entry) {
  if (typeof entry === 'number' && Number.isInteger(entry) && entry >= 0) return entry;
  if (entry && typeof entry === 'object' && typeof entry.index === 'number' && Number.isInteger(entry.index) && entry.index >= 0) return entry.index;
  return null;
}

function specificityFromObject(spec) {
  if (!spec) return null;
  const values = [spec.a, spec.b, spec.c];
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  return { a: values[0], b: values[1], c: values[2] };
}

function compareSpecificity(a, b) {
  if (a.a !== b.a) return a.a > b.a ? 1 : -1;
  if (a.b !== b.b) return a.b > b.b ? 1 : -1;
  if (a.c !== b.c) return a.c > b.c ? 1 : -1;
  return 0;
}

function avaliarEspecificidade(selectors, matchingSelectors) {
  const vazio = {
    status: 'ausente',
    a: null,
    b: null,
    c: null,
    index: null,
    indices: [],
    indicesValidos: [],
    indicesInvalidos: [],
    indicesSemEspecificidade: [],
    especificidade: null,
  };
  if (!Array.isArray(matchingSelectors) || matchingSelectors.length === 0) return vazio;
  if (!Array.isArray(selectors)) return { ...vazio, status: 'insuficiente', indicesInvalidos: matchingSelectors.map(() => null) };
  const indicesValidos = [];
  const indicesInvalidos = [];
  const indicesSemEspecificidade = [];
  const candidaturas = [];
  for (const entry of matchingSelectors) {
    const index = normalizeIndex(entry);
    if (index === null || index >= selectors.length) {
      indicesInvalidos.push(entry);
      continue;
    }
    indicesValidos.push(index);
    const spec = specificityFromObject(selectors[index] && selectors[index].specificity);
    if (!spec) {
      indicesSemEspecificidade.push(index);
      continue;
    }
    candidaturas.push({ index, spec });
  }
  if (indicesValidos.length === 0) return { ...vazio, indicesInvalidos };
  if (indicesSemEspecificidade.length > 0 || candidaturas.length === 0) {
    return {
      status: 'insuficiente',
      a: null,
      b: null,
      c: null,
      index: null,
      indices: indicesValidos,
      indicesValidos,
      indicesInvalidos,
      indicesSemEspecificidade,
      especificidade: null,
    };
  }
  let best = candidaturas[0];
  for (const candidatura of candidaturas.slice(1)) {
    if (compareSpecificity(candidatura.spec, best.spec) > 0) best = candidatura;
  }
  return {
    status: 'maximo',
    a: best.spec.a,
    b: best.spec.b,
    c: best.spec.c,
    index: best.index,
    indices: indicesValidos,
    indicesValidos,
    indicesInvalidos,
    indicesSemEspecificidade,
    especificidade: { a: best.spec.a, b: best.spec.b, c: best.spec.c },
  };
}

function selectMaxSpecificity(selectors, matchingSelectors) {
  const avaliacao = avaliarEspecificidade(selectors, matchingSelectors);
  if (avaliacao.status !== 'maximo') return null;
  return { a: avaliacao.a, b: avaliacao.b, c: avaliacao.c, index: avaliacao.index, indices: avaliacao.indicesValidos };
}

module.exports = { normalizeIndex, specificityFromObject, compareSpecificity, avaliarEspecificidade, selectMaxSpecificity };
