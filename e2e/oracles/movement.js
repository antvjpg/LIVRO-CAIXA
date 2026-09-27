/* C.O.D.E. — oracle de movimentações (independente do aplicativo). */
'use strict';

const { round2 } = require('./money');

function ledgerSummary(entries = []) {
  const inflow = round2(entries.filter((e) => e.type === 'in').reduce((s, e) => s + Number(e.amount), 0));
  const outflow = round2(entries.filter((e) => e.type === 'out').reduce((s, e) => s + Number(e.amount), 0));
  return { count: entries.length, inflow, outflow, net: round2(inflow - outflow) };
}

/* Linhas esperadas no livro (ordem: data desc, depois id desc — padrão do app). */
function expectedRows(entries = []) {
  return [...entries]
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id || '').localeCompare(String(a.id || '')))
    .map((e) => ({
      desc: e.desc,
      amount: round2(e.type === 'in' ? Number(e.amount) : -Number(e.amount)),
      type: e.type,
      date: e.date,
    }));
}

function entriesByDescription(entries = [], desc) {
  return entries.filter((e) => e.desc === desc);
}

module.exports = { ledgerSummary, expectedRows, entriesByDescription };
