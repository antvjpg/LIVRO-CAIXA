/* C.O.D.E. — oracle de bancos/contas (independente do aplicativo).
   Nenhuma função do LIVRO-CAIXA é importada aqui (regra dos oracles §9).

   Regras de domínio para Banks:
   - saldo(Conta) = initial + Σ entradas − Σ saídas daquela conta
   - totalBanks = soma dos saldos de todas as contas
   - contas sem initial => initial = 0 */
'use strict';

const { round2 } = require('./money');

function bankInitial(bank = {}) {
  if (bank == null) return 0;
  return Number(bank.initial) || 0;
}

function accountBalance({ initial = 0, entries = [] }, bankId) {
  const scoped = bankId === undefined ? entries : entries.filter((e) => e.bank === bankId);
  return round2(
    scoped.reduce((sum, e) => sum + (e.type === 'in' ? Number(e.amount) : -Number(e.amount)), Number(initial) || 0)
  );
}

function banksBalance(banks = [], entries = []) {
  if (banks == null) banks = [];
  if (entries == null) entries = [];
  return round2(banks.reduce((sum, b) => sum + accountBalance({ initial: bankInitial(b), entries }, b.id), 0));
}

function banksCount(banks = []) {
  return Array.isArray(banks) ? banks.length : 0;
}

function bankNames(banks = []) {
  return (Array.isArray(banks) ? banks : []).map((b) => String(b.name || ''));
}

module.exports = {
  bankInitial,
  accountBalance,
  banksBalance,
  banksCount,
  bankNames,
};
