/* C.O.D.E. — oracle de valores a receber (independente do aplicativo).
   Nenhuma função do LIVRO-CAIXA é importada aqui (regra dos oracles §9).

   Regras de domínio para Receivables:
   - status: 'pendente' | 'recebido' | 'cancelado'
   - total a receber = soma dos amount com status 'pendente'
   - total recebido = soma dos amount com status 'recebido'
   - total cancelado = soma dos amount com status 'cancelado'
   - cada receivable individual: recebido se status === 'recebido' */
'use strict';

const { round2 } = require('./money');

function receivableAmount(receivable = {}) {
  if (receivable == null) return 0;
  return Number(receivable.amount) || 0;
}

function receivableIsPending(receivable = {}) {
  return receivable.status === 'pendente';
}

function receivableIsReceived(receivable = {}) {
  return receivable.status === 'recebido';
}

function receivableIsCancelled(receivable = {}) {
  return receivable.status === 'cancelado';
}

function totalPending(receivables = []) {
  return round2(
    (Array.isArray(receivables) ? receivables : [])
      .filter(receivableIsPending)
      .reduce((sum, r) => sum + receivableAmount(r), 0)
  );
}

function totalReceived(receivables = []) {
  return round2(
    (Array.isArray(receivables) ? receivables : [])
      .filter(receivableIsReceived)
      .reduce((sum, r) => sum + receivableAmount(r), 0)
  );
}

function totalCancelled(receivables = []) {
  return round2(
    (Array.isArray(receivables) ? receivables : [])
      .filter(receivableIsCancelled)
      .reduce((sum, r) => sum + receivableAmount(r), 0)
  );
}

function totalAll(receivables = []) {
  return round2(
    (Array.isArray(receivables) ? receivables : [])
      .reduce((sum, r) => sum + receivableAmount(r), 0)
  );
}

function pendingCount(receivables = []) {
  return (Array.isArray(receivables) ? receivables : [])
    .filter(receivableIsPending).length;
}

function receivedCount(receivables = []) {
  return (Array.isArray(receivables) ? receivables : [])
    .filter(receivableIsReceived).length;
}

function cancelledCount(receivables = []) {
  return (Array.isArray(receivables) ? receivables : [])
    .filter(receivableIsCancelled).length;
}

module.exports = {
  receivableAmount,
  receivableIsPending,
  receivableIsReceived,
  receivableIsCancelled,
  totalPending,
  totalReceived,
  totalCancelled,
  totalAll,
  pendingCount,
  receivedCount,
  cancelledCount,
};
