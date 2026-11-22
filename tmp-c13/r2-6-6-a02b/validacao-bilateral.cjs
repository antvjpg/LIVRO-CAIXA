'use strict';

function canon(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim().toLowerCase().replace(/\s*!important\s*$/i, '');
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
  }
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

function normalizeCandidate(candidate) {
  return {
    source: candidate && candidate.source || null,
    selectorText: candidate && candidate.selectorText || null,
    declaredValue: canon(candidate && (candidate.declaredValue !== undefined ? candidate.declaredValue : candidate.value)),
    important: candidate && typeof candidate.important === 'boolean' ? candidate.important : null,
    origin: candidate && candidate.origin || null,
    cdpOrigin: candidate && candidate.cdpOrigin || null,
    provenance: candidate && candidate.provenance || null,
    styleSheetId: candidate && candidate.styleSheetId || null,
    order: Number(candidate && candidate.order) || 0,
  };
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function metadataMismatch(candidate, expected) {
  if (has(expected, 'origin') && candidate.origin !== expected.origin) return true;
  if (has(expected, 'declaredValue') && !sameValue(candidate.declaredValue, expected.declaredValue)) return true;
  if (has(expected, 'important') && candidate.important !== expected.important) return true;
  if (has(expected, 'selectorText') && candidate.selectorText !== expected.selectorText) return true;
  if (has(expected, 'cdpOrigin') && candidate.cdpOrigin !== expected.cdpOrigin) return true;
  if (has(expected, 'provenance') && candidate.provenance !== expected.provenance) return true;
  if (has(expected, 'source') && candidate.source !== expected.source) return true;
  if (has(expected, 'styleSheetId') && candidate.styleSheetId !== expected.styleSheetId) return true;
  return false;
}

function matchesExpected(candidate, expected) {
  return !metadataMismatch(candidate, expected);
}

function isContradiction(candidate, expected, exact, allExpected) {
  if (candidate === exact) return false;
  if ((allExpected || []).some((item) => matchesExpected(candidate, item))) return false;
  if (has(expected, 'selectorText') && candidate.selectorText !== expected.selectorText) return false;
  if (has(expected, 'important') && candidate.important !== expected.important) return false;
  return metadataMismatch(candidate, expected);
}

function validateDisputa(disputa, candidatos) {
  const normalized = (candidatos || []).map(normalizeCandidate);
  const divergencias = [];
  const concorrentes = [];
  const esperados = disputa && Array.isArray(disputa.concorrentes) ? disputa.concorrentes : [];
  if (esperados.length !== 2) divergencias.push(`numero de concorrentes=${esperados.length}, esperado 2`);
  for (const esperado of esperados) {
    const matches = normalized.filter((candidate) => matchesExpected(candidate, esperado));
    if (matches.length === 0) {
      divergencias.push(`${esperado.id}: concorrente ausente`);
      concorrentes.push({ id: esperado.id, status: 'FAIL', esperado, observado: null });
      continue;
    }
    if (matches.length > 1) {
      divergencias.push(`${esperado.id}: evidencia duplicada (${matches.length})`);
      concorrentes.push({ id: esperado.id, status: 'FAIL', esperado, observado: matches[0], duplicados: matches.length });
      continue;
    }
    const contradictory = normalized.filter((candidate) => isContradiction(candidate, esperado, matches[0], esperados));
    if (contradictory.length) {
      divergencias.push(`${esperado.id}: evidencia contraditoria (${contradictory.length})`);
      concorrentes.push({ id: esperado.id, status: 'FAIL', esperado, observado: matches[0], contradictory });
      continue;
    }
    concorrentes.push({ id: esperado.id, status: 'PASS', esperado, observado: matches[0] });
  }
  return {
    status: divergencias.length ? 'FAIL' : 'PASS',
    divergencias,
    concorrentes,
    candidatos: normalized,
  };
}

module.exports = { canon, sameValue, normalizeCandidate, validateDisputa };
