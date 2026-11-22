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

function selectMaxSpecificity(selectors, matchingSelectors) {
  if (!Array.isArray(matchingSelectors) || matchingSelectors.length === 0) return null;
  if (!Array.isArray(selectors)) return null;
  let best = null;
  let bestIndex = null;
  const validIndices = [];
  for (const entry of matchingSelectors) {
    const index = normalizeIndex(entry);
    if (index === null || index >= selectors.length) continue;
    validIndices.push(index);
    const spec = specificityFromObject(selectors[index] && selectors[index].specificity);
    if (!spec) continue;
    if (!best || compareSpecificity(spec, best) > 0) {
      best = spec;
      bestIndex = index;
    }
  }
  if (!best) return null;
  return { a: best.a, b: best.b, c: best.c, index: bestIndex, indices: validIndices };
}

module.exports = { normalizeIndex, specificityFromObject, compareSpecificity, selectMaxSpecificity };
