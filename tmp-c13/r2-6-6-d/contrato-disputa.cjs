'use strict';

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

function candidateView(candidate) {
  return {
    origin: candidate.origin || null,
    cdpOrigin: candidate.cdpOrigin || null,
    value: candidate.value || null,
    important: candidate.important === undefined ? null : candidate.important,
    importanceStatus: candidate.importanceStatus || null,
    selectorText: candidate.selectorText || null,
    source: candidate.source || null,
    specificity: candidate.specificity || null,
    specificityStatus: candidate.specificityStatus || null,
    order: candidate.order || null,
    provenance: candidate.provenance ? {
      origin: candidate.provenance.origin,
      status: candidate.provenance.status || null,
    } : null,
  };
}

function matchCandidate(candidates, expected) {
  return (candidates || []).filter((candidate) => {
    if (!sameValue(candidate.value, expected.value)) return false;
    if (candidate.important !== expected.important) return false;
    if (expected.origin && candidate.origin !== expected.origin) return false;
    if (expected.selectorText && String(candidate.selectorText || '') !== expected.selectorText) return false;
    if (expected.cdpOrigin && String(candidate.cdpOrigin || '') !== expected.cdpOrigin) return false;
    return true;
  });
}

function dedupCandidatos(candidates) {
  const vistos = new Set();
  return (candidates || []).filter((candidate) => {
    const chave = [
      candidate.origin,
      candidate.cdpOrigin,
      canon(candidate.value),
      candidate.important,
      candidate.selectorText,
    ].join('|');
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

function candidatosRelevantes(candidates, esperado) {
  const unicos = dedupCandidatos(candidates);
  return unicos.filter((candidate) => (esperado.concorrentes || []).some((item) => matchCandidate([candidate], item).length === 1));
}

function validarDisputa(options) {
  const candidatos = options.candidatosDecisao || [];
  const esperado = options.esperado || {};
  const unicos = dedupCandidatos(candidatos);
  const relevantes = candidatosRelevantes(candidatos, esperado);
  const relevantesSet = new Set(relevantes);
  const ignoradosRelevantes = unicos.filter((candidate) => !relevantesSet.has(candidate));
  const insuficiencias = [];
  const divergencias = [];

  for (const candidate of ignoradosRelevantes) {
    if (candidate.important === true || candidate.origin === 'user' || candidate.origin === 'author') {
      insuficiencias.push(`terceiro-candidato-relevante:${candidate.origin}`);
    }
  }
  if (options.injecaoRequerida && !options.injecaoConfirmada) insuficiencias.push('injecao-user-nao-confirmada');
  if (relevantes.length !== (esperado.concorrentes || []).length) insuficiencias.push('dois-candidatos-obrigatorios-ausentes');
  for (const concorrente of esperado.concorrentes || []) {
    const encontrados = matchCandidate(relevantes, concorrente);
    if (encontrados.length !== 1) insuficiencias.push(`candidato-ausente-ou-ambigu:${concorrente.origin}`);
  }
  if (options.provenienciaRequerida && !options.provenienciaUnica) insuficiencias.push('proveniencia-user-nao-unica');
  for (const candidate of relevantes) {
    if (candidate.importanceStatus === 'unknown'
      || candidate.importanceStatus === 'ambiguous'
      || candidate.importanceStatus === 'contradiction') {
      insuficiencias.push(`importancia-indeterminada:${candidate.origin}`);
    }
    if (!candidate.origin || candidate.origin === 'unknown') insuficiencias.push(`origem-desconhecida:${candidate.order}`);
  }

  if (insuficiencias.length === 0) {
    const vencedor = options.vencedor;
    if (!vencedor) divergencias.push('sem-vencedor');
    if (vencedor && esperado.winner && (vencedor.origin !== esperado.winner.origin
      || !sameValue(vencedor.value, esperado.winner.value)
      || vencedor.important !== esperado.winner.important)) {
      divergencias.push('vencedor-divergente');
    }
    for (const [chave, valor] of Object.entries(options.valoresComputados || {})) {
      if (!sameValue(valor, esperado.computed)) divergencias.push(`valor-${chave}`);
    }
  }

  return {
    status: insuficiencias.length > 0 ? 'INSUFFICIENT' : divergencias.length > 0 ? 'FAIL' : 'PASS',
    insuficiencias,
    divergencias,
  };
}

module.exports = { canon, sameValue, candidateView, matchCandidate, dedupCandidatos, candidatosRelevantes, validarDisputa };
