/* C.O.D.E. — oracle de saldo/patrimônio (independente do aplicativo).
   Regra verificada contra a especificação natural do domínio:
     saldo(Conta)   = saldo inicial + Σ entradas − Σ saídas daquela conta
     patrimônio     = Σ saldos de contas + Σ caixinhas + Σ investimentos
   O código do LIVRO-CAIXA NÃO é importado: se app e oracle coincidirem, a
   coincidência é evidência — não cópia (§9). */
'use strict';

const { round2 } = require('./money');

function accountBalance({ initial = 0, entries = [] }, bankId) {
  const scoped = bankId === undefined ? entries : entries.filter((e) => e.bank === bankId);
  return round2(
    scoped.reduce((sum, e) => sum + (e.type === 'in' ? Number(e.amount) : -Number(e.amount)), Number(initial) || 0)
  );
}

function banksBalance(banks, entries) {
  return round2(banks.reduce((sum, b) => sum + accountBalance({ initial: b.initial, entries }, b.id), 0));
}

function patrimonio({ banks = [], entries = [], pockets = [], investments = [] } = {}) {
  const pocketsTotal = pockets.reduce(
    (sum, p) => sum + Number(p.balance ?? p.saved ?? p.amount ?? 0),
    0
  );
  const investmentsTotal = investments.reduce((sum, i) => sum + Number(i.value ?? 0), 0);
  return round2(banksBalance(banks, entries) + pocketsTotal + investmentsTotal);
}

module.exports = { accountBalance, banksBalance, patrimonio };
