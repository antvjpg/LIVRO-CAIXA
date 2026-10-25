'use strict';

/* Oráculo de integração Cartão → Fatura → Saldo.
   Combina o estado da fatura com o limite do cartão,
   retornando tudo o que é necessário para a UI e validações.
   Dados esperados em localStorage: cards, purchases, invoiceLaunches. */

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/* --- Estado da Fatura --- */

function getEstadoFatura(cardId, periodKey, purchases, cards, invoiceLaunches) {
  const invoiceTotal = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);

  const paid = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey && il.paid)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);

  return {
    total: round2(invoiceTotal),
    paid: round2(paid),
    remaining: round2(invoiceTotal - paid),
    periodKey
  };
}

/* --- Estado do Limite do Cartão --- */

function getLimiteCartao(cardId, purchases, cards, invoiceLaunches, referencePeriod) {
  const card = (cards || []).find(c => c.id === cardId);
  if (!card) return { total: 0, used: 0, available: 0, excess: 0 };

  const total = Number(card.limit) || 0;
  const cardPurchases = (purchases || [])
    .filter(p => p.cardId === cardId);

  const used = cardPurchases.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0) + (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === referencePeriod)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);

  const available = Math.max(0, total - used);
  const excess = Math.max(0, used - total);

  return { total, used: round2(used), available: round2(available), excess: round2(excess) };
}

/* --- Validação de Pagamento --- */

function validarPagamentoCartao(cardId, periodKey, amount, purchases, cards, invoiceLaunches) {
  const EPSILON = 0.01;

  const invoice = getEstadoFatura(cardId, periodKey, purchases, cards, invoiceLaunches);
  const remaining = invoice.remaining;

  if (Number(amount) <= 0) {
    return { valid: false, reason: 'invalid_amount', remaining };
  }

  if (Number(amount) > remaining + EPSILON) {
    return {
      valid: false,
      reason: 'payment_exceeds_invoice',
      remaining,
      invoiceTotal: invoice.total,
      alreadyPaid: invoice.paid,
      requested: Number(amount)
    };
  }

  return {
    valid: true,
    reason: null,
    remaining: round2(remaining - Number(amount)),
    invoiceTotal: invoice.total,
    alreadyPaid: invoice.paid,
    requested: Number(amount)
  };
}

/* --- Exportações --- */

module.exports = {
  getEstadoFatura,
  getLimiteCartao,
  validarPagamentoCartao
};