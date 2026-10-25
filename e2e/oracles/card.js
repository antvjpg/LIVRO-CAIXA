'use strict';

/* Funções auxiliares reutilizáveis pelo oráculo (mirroring engine logic) */

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/* total, used, available — a partir de dados de card + purchases + invoiceLaunches + periodKey */
function calculateLimit(card, purchases, cards, invoiceLaunches, referencePeriod) {
  const total = Number(card?.limit) || 0;
  const cardPurchases = (purchases || [])
    .filter(p => p.cardId === card.id);
  const invoiceTotal = (invoiceLaunches || [])
    .filter(il => il.cardId === card.id && il.periodKey === referencePeriod)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);
  const used = cardPurchases.reduce((sum, p) => sum + (Number(p.totalValue) || 0), 0) + invoiceTotal;
  const available = total - used;
  const excess = used > total ? used - total : 0;
  return { total, used, available, excess };
}

/* valid payment — amount must be > 0, <= invoice.remaining + EPSILON */
function validatePayment(cardId, periodKey, amount, purchases, cards, invoiceLaunches) {
  const EPSILON = 0.01;
  if (Number(amount) <= 0) return { valid: false, amount, invoiceTotal: 0, alreadyPaid: 0, remainingBefore: 0, remainingAfter: 0 };
  const card = (cards || []).find(c => c.id === cardId);
  if (!card) return { valid: false, amount, invoiceTotal: 0, alreadyPaid: 0, remainingBefore: 0, remainingAfter: 0 };
  const invoiceTotal = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);
  const alreadyPaid = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey && il.paid)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);
  const remaining = invoiceTotal - alreadyPaid;
  const amountOk = Number(amount) <= remaining + EPSILON;
  return {
    valid: amountOk,
    amount,
    invoiceTotal,
    alreadyPaid,
    remainingBefore: remaining,
    remainingAfter: remaining - Number(amount),
  };
}

/* invoice state: total paid / remaining */
function invoiceState(cardId, periodKey, purchases, cards, invoiceLaunches) {
  const card = (cards || []).find(c => c.id === cardId);
  if (!card) return { total: 0, paid: 0, remaining: 0 };
  const invoiceTotal = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);
  const paid = (invoiceLaunches || [])
    .filter(il => il.cardId === cardId && il.periodKey === periodKey && il.paid)
    .reduce((sum, il) => sum + (Number(il.amount) || 0), 0);
  return { total: invoiceTotal, paid, remaining: invoiceTotal - paid };
}

module.exports = {
  calculateLimit,
  validatePayment,
  invoiceState,
};