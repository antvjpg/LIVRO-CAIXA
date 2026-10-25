'use strict';

/* C.O.D.E. — Oráculo de Integração: Movimentações → Dashboard.
   Fornece dados resumidos do ledger de movimentações no formato
   adequado para o painel dashboard do aplicativo.
   Dados esperados em localStorage: entries (lista de movimentações). */

const { round2, accountBalance, banksBalance, patrimonio } = require('./balance');
const { ledgerSummary, expectedRows, entriesByDescription } = require('./movement');

/* --- Resumo do Ledger de Movimentações --- */

function ledgerDashboardSummary(entries = []) {
  const summary = ledgerSummary(entries);
  const rows = expectedRows(entries);
  return {
    count: summary.count,
    inflow: summary.inflow,
    outflow: summary.outflow,
    net: summary.net,
    rows // últimas entradas para exibição no dashboard
  };
}

/* --- Resumo Patrimonial Incluindo Movimentações --- */

function patrimonioComMovimentacao({ banks = [], entries = [], pockets = [], investments = [] } = {}) {
  const pocketsTotal = pockets.reduce(
    (sum, p) => sum + Number(p.balance ?? p.saved ?? p.amount ?? 0),
    0
  );
  const investmentsTotal = investments.reduce((sum, i) => sum + Number(i.value ?? 0), 0);
  const banks Total = banksBalance(banks, entries);
  return round2(banks Total + pocketsTotal + investmentsTotal);
}

/* --- Filtrar entradas por tipo para o Dashboard --- */

function entradasPorTipo(entries = []) {
  const inflow = entries.filter((e) => e.type === 'in');
  const outflow = entries.filter((e) => e.type === 'out');
  return {
    inflow: inflow.length,
    outflow: outflow.length,
    total: entries.length
  };
}

/* --- Exportações --- */

module.exports = {
  ledgerDashboardSummary,
  patrimonioComMovimentacao,
  entradasPorTipo,
  ledgerSummary,
  expectedRows,
  entriesByDescription
};