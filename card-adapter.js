(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./card-engine-v3.js'));
  } else {
    root.LivroCaixaCardAdapter = factory(root.LivroCaixaCardEngineV3);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CardEngine) {
  'use strict';

  if (!CardEngine) {
    throw new Error('LivroCaixaCardEngineV3 não está disponível.');
  }

  const EPSILON = 0.004;

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTitular(value) {
  const s = String(value ?? '').trim();
  return s || 'Sem titular';
}

function sameMoney(a, b) {
  return Math.abs(money(a) - money(b)) <= EPSILON;
}

function invoiceLines(cardId, periodKey, purchases, cards) {
  const invoice = CardEngine.cardInvoiceForPeriod(
    cardId,
    periodKey,
    purchases,
    cards
  );

  return Array.isArray(invoice?.lines)
    ? invoice.lines
    : [];
}

function invoiceTotal(cardId, periodKey, purchases, cards) {
  return invoiceLines(cardId, periodKey, purchases, cards)
    .reduce((sum, line) => sum + money(line.amount), 0);
}

function invoiceByTitular(cardId, periodKey, purchases, cards) {
  const lines = invoiceLines(cardId, periodKey, purchases, cards);
  const groups = new Map();

  for (const line of lines) {
    const titular = normalizeTitular(
      line.titular ?? line.purchase?.titular
    );

    if (!groups.has(titular)) {
      groups.set(titular, {
        titular,
        total: 0,
        count: 0,
        lines: []
      });
    }

    const group = groups.get(titular);
    group.total += money(line.amount);
    group.count += 1;
    group.lines.push(line);
  }

  return Array.from(groups.values());
}

function launchId(cardId, periodKey, titular) {
  return `invl_${cardId}_${periodKey}_${normalizeTitular(titular)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`;
}

function findLaunch(cardId, periodKey, titular, invoiceLaunches) {
  const id = launchId(cardId, periodKey, titular);

  return (Array.isArray(invoiceLaunches) ? invoiceLaunches : [])
    .find(x => x && x.id === id) || null;
}

function launchPaidAmount(launch) {
  if (!launch) return 0;

  if (Array.isArray(launch.payments)) {
    return Math.max(
      0,
      launch.payments.reduce((sum, payment) => {
        return sum + Math.max(0, money(payment?.amount));
      }, 0)
    );
  }

  return Math.max(0, money(launch.amount));
}

function titularInvoice(cardId, periodKey, titular, purchases, cards, invoiceLaunches) {
  const normalizedTitular = normalizeTitular(titular);

  const group = invoiceByTitular(
    cardId,
    periodKey,
    purchases,
    cards
  ).find(x => x.titular === normalizedTitular);

  const total = money(group?.total);
  const launch = findLaunch(
    cardId,
    periodKey,
    normalizedTitular,
    invoiceLaunches
  );

  const paid = Math.min(
    total,
    launchPaidAmount(launch)
  );

  const remaining = Math.max(0, total - paid);

  return {
    cardId,
    periodKey,
    titular: normalizedTitular,
    total,
    paid,
    remaining,
    count: group?.count || group?.lines?.length || 0,
    status: launch?.markedPaidOnly === true
      ? 'Pago'
      : paid <= EPSILON
        ? 'Pendente'
        : paid + EPSILON < total
          ? 'Parcial'
          : 'Pago',
    markedPaidOnly: launch?.markedPaidOnly === true,
    launchId: launch?.id || launchId(
      cardId,
      periodKey,
      normalizedTitular
    ),
    lines: group?.lines || []
  };
}

function invoice(cardId, periodKey, purchases, cards, invoiceLaunches) {
  const total = invoiceTotal(
    cardId,
    periodKey,
    purchases,
    cards
  );

  const engineState = CardEngine.invoiceState(
    cardId,
    periodKey,
    purchases,
    cards,
    invoiceLaunches
  );

  const titulars = invoiceByTitular(
    cardId,
    periodKey,
    purchases,
    cards
  ).map(group =>
    titularInvoice(
      cardId,
      periodKey,
      group.titular,
      purchases,
      cards,
      invoiceLaunches
    )
  );

  const lines = invoiceLines(
    cardId,
    periodKey,
    purchases,
    cards
  );

  return {
    cardId,
    periodKey,
    total,
    paid: money(engineState?.paid),
    remaining: Math.max(
      0,
      total - money(engineState?.paid)
    ),
    status: engineState?.status || 'open',
    markedPaidOnly: engineState?.markedPaidOnly === true,
    count: lines.length,
    lines,
    titulars
  };
}

function validatePayment(
  cardId,
  periodKey,
  titular,
  amount,
  purchases,
  cards,
  invoiceLaunches
) {
  const requested = money(amount);

  if (!Number.isFinite(Number(amount)) || requested <= 0) {
    return {
      valid: false,
      reason: 'invalid_amount',
      requested
    };
  }

  const target = titularInvoice(
    cardId,
    periodKey,
    titular,
    purchases,
    cards,
    invoiceLaunches
  );

  if (target.total <= EPSILON) {
    return {
      valid: false,
      reason: 'empty_invoice',
      total: target.total,
      alreadyPaid: target.paid,
      remaining: target.remaining,
      requested
    };
  }

  if (requested > target.remaining + EPSILON) {
    return {
      valid: false,
      reason: 'payment_exceeds_titular_invoice',
      total: target.total,
      alreadyPaid: target.paid,
      remaining: target.remaining,
      requested
    };
  }

  return {
    valid: true,
    reason: 'ok',
    total: target.total,
    alreadyPaid: target.paid,
    remaining: target.remaining,
    requested
  };
}

function calculateLimit(card, purchases, cards, invoiceLaunches) {
  return CardEngine.calculateLimit(
    card,
    purchases,
    cards,
    invoiceLaunches
  );
}

function audit(cards, purchases, invoiceLaunches) {
  return CardEngine.auditOrphans(
    cards,
    purchases,
    invoiceLaunches
  );
}

return Object.freeze({
    EPSILON,
    money,
    normalizeTitular,
    sameMoney,
    invoiceLines,
    invoiceTotal,
    invoiceByTitular,
    launchId,
    findLaunch,
    launchPaidAmount,
    titularInvoice,
    invoice,
    validatePayment,
    calculateLimit,
    audit
  });
});