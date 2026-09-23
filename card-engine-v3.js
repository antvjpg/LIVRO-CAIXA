(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LivroCaixaCardEngineV3 = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  const EPSILON = 0.004;

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function clampDay(value, fallback = 1) {
    return Math.min(31, Math.max(1, number(value, fallback)));
  }

  function parsePeriodKey(value) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);

    if (month < 1 || month > 12) return null;

    return {
      year,
      monthIndex: month - 1
    };
  }

  function periodKey(year, monthIndex) {
    return `${year}-${pad2(monthIndex + 1)}`;
  }

  function addMonthsToPeriodKey(value, months) {
    const parsed = parsePeriodKey(value);
    if (!parsed) return null;

    const date = new Date(
      parsed.year,
      parsed.monthIndex + number(months),
      1
    );

    return periodKey(
      date.getFullYear(),
      date.getMonth()
    );
  }

  function invoicePeriodKeyForDate(card, dateStr) {
    const value =
      dateStr ||
      new Date().toISOString().slice(0, 10);

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const closingDay = clampDay(card?.closingDay, 1);

    const targetMonth =
      date.getDate() <= closingDay
        ? date.getMonth()
        : date.getMonth() + 1;

    const target = new Date(
      date.getFullYear(),
      targetMonth,
      1
    );

    return periodKey(
      target.getFullYear(),
      target.getMonth()
    );
  }

  function purchaseInstallmentOccurrences(purchase, cardsById) {
    const card = cardsById.get(purchase.cardId);

    if (!card) return [];

    const firstPeriod = invoicePeriodKeyForDate(
      card,
      purchase.date
    );

    if (!firstPeriod) return [];

    if (purchase.paymentType !== 'parcelado') {
      return [{
        id: `${purchase.id}-1`,
        purchaseId: purchase.id,
        cardId: purchase.cardId,
        periodKey: firstPeriod,
        installmentNumber: 1,
        totalInstallments: 1,
        amount: number(purchase.totalValue)
      }];
    }

    const totalInstallments = Math.max(
      1,
      Math.floor(number(purchase.totalInstallments, 1))
    );

    const installmentValue =
      number(purchase.installmentValue);

    const initialInstallment = Math.min(
      totalInstallments,
      Math.max(
        1,
        Math.floor(number(purchase.initialInstallment, 1))
      )
    );

    const occurrences = [];

    for (
      let n = initialInstallment;
      n <= totalInstallments;
      n++
    ) {
      occurrences.push({
        id: `${purchase.id}-${n}`,
        purchaseId: purchase.id,
        cardId: purchase.cardId,
        periodKey: addMonthsToPeriodKey(
          firstPeriod,
          n - initialInstallment
        ),
        installmentNumber: n,
        totalInstallments,
        amount: installmentValue
      });
    }

    return occurrences;
  }

  function buildInstallments(purchases, cards) {
    const cardsById = new Map(
      (cards || []).map(card => [card.id, card])
    );

    const installments = [];

    for (const purchase of purchases || []) {
      installments.push(
        ...purchaseInstallmentOccurrences(
          purchase,
          cardsById
        )
      );
    }

    return installments;
  }

  function cardInvoiceForPeriod(
    cardId,
    targetPeriod,
    purchases,
    cards
  ) {
    const installments = buildInstallments(
      purchases,
      cards
    );

    const purchaseById = new Map(
      (purchases || []).map(p => [p.id, p])
    );

    const lines = installments
      .filter(item =>
        item.cardId === cardId &&
        item.periodKey === targetPeriod
      )
      .map(item => ({
        ...item,
        purchase: purchaseById.get(item.purchaseId)
      }));

    /*
     * purchaseInstallmentOccurrences não precisa carregar
     * cardId porque purchaseId já identifica a compra.
     */
    const normalizedLines = lines.filter(
      line => line.purchase?.cardId === cardId
    );

    const total = normalizedLines.reduce(
      (sum, line) =>
        sum + number(line.amount),
      0
    );

    return {
      cardId,
      periodKey: targetPeriod,
      lines: normalizedLines,
      total,
      count: normalizedLines.length
    };
  }

  /*
   * Cada pagamento é associado explicitamente a uma fatura.
   *
   * markedPaidOnly NÃO é considerado pagamento financeiro.
   */
  function invoicePaymentsFor(
    cardId,
    periodKey,
    invoiceLaunches
  ) {
    return (invoiceLaunches || [])
      .filter(launch =>
        launch.cardId === cardId &&
        launch.closingPeriodKey === periodKey &&
        !launch.markedPaidOnly
      );
  }

  function invoiceAmountPaid(
    cardId,
    periodKey,
    invoiceTotal,
    invoiceLaunches
  ) {
    const launches = invoicePaymentsFor(
      cardId,
      periodKey,
      invoiceLaunches
    );

    let paid = 0;

    for (const launch of launches) {
      if (Array.isArray(launch.payments)) {
        paid += launch.payments.reduce(
          (sum, payment) =>
            sum + Math.max(0, number(payment.amount)),
          0
        );
      } else {
        paid += Math.max(
          0,
          number(launch.amount)
        );
      }
    }

    /*
     * Nunca reconhece como pagamento da fatura
     * valor superior à própria dívida.
     */
    return Math.min(
      Math.max(0, number(invoiceTotal)),
      paid
    );
  }

  function invoiceStatus(
    paid,
    totalAmount,
    markedPaidOnly = false
  ) {
    const total = Math.max(
      0,
      number(totalAmount)
    );

    if (markedPaidOnly) {
      return 'Pago';
    }

    if (paid <= EPSILON) {
      return 'Pendente';
    }

    if (paid + EPSILON < total) {
      return 'Parcial';
    }

    return 'Pago';
  }

  /*
   * Retorna o estado financeiro completo de uma fatura.
   */
  function invoiceState(
    cardId,
    periodKey,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const invoice = cardInvoiceForPeriod(
      cardId,
      periodKey,
      purchases,
      cards
    );

    const launches = invoicePaymentsFor(
      cardId,
      periodKey,
      invoiceLaunches
    );

    const paid = invoiceAmountPaid(
      cardId,
      periodKey,
      invoice.total,
      invoiceLaunches
    );

    const markedPaidOnly = (invoiceLaunches || [])
      .some(launch =>
        launch.cardId === cardId &&
        launch.closingPeriodKey === periodKey &&
        launch.markedPaidOnly
      );

    const remaining = Math.max(
      0,
      invoice.total - paid
    );

    return {
      ...invoice,
      paid,
      remaining,
      markedPaidOnly,
      status: invoiceStatus(
        paid,
        invoice.total,
        markedPaidOnly
      ),
      paymentCount: launches.length
    };
  }

  /*
   * Soma o comprometimento REAL das compras,
   * mas desconta somente pagamentos que foram
   * efetivamente associados às faturas.
   *
   * Pagamento acima da fatura não gera crédito
   * artificial para outras faturas.
   */
  function cardCommittedAmount(
    cardId,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const installments = buildInstallments(
      purchases,
      cards
    );

    const cardInstallments = installments.filter(
      item => {
        const purchase = (purchases || [])
          .find(p => p.id === item.purchaseId);

        return purchase?.cardId === cardId;
      }
    );

    const grossCommitted = cardInstallments.reduce(
      (sum, installment) =>
        sum + Math.max(
          0,
          number(installment.amount)
        ),
      0
    );

    /*
     * Para liberar limite corretamente,
     * precisamos considerar somente o valor
     * realmente pago dentro das respectivas faturas.
     */
    const periodKeys = [
      ...new Set(
        cardInstallments.map(
          item => item.periodKey
        )
      )
    ];

    let released = 0;

    for (const periodKey of periodKeys) {
      const invoice = cardInvoiceForPeriod(
        cardId,
        periodKey,
        purchases,
        cards
      );

      released += invoiceAmountPaid(
        cardId,
        periodKey,
        invoice.total,
        invoiceLaunches
      );
    }

    return Math.max(
      0,
      grossCommitted - released
    );
  }

  function calculateLimit(
    card,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const total = number(card?.limit);

    if (total <= 0) {
      return {
        total,
        used: null,
        available: null,
        excess: 0
      };
    }

    const used = cardCommittedAmount(
      card.id,
      purchases,
      cards,
      invoiceLaunches
    );

    const available = Math.max(
      0,
      total - used
    );

    const excess = Math.max(
      0,
      used - total
    );

    return {
      total,
      used,
      available,
      excess
    };
  }

  /*
   * Validação de um novo pagamento.
   *
   * Não grava nada.
   * Apenas informa se o pagamento pode ocorrer.
   */
  function validatePayment(
    cardId,
    periodKey,
    amount,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const value = number(amount);

    if (!(value > 0)) {
      return {
        valid: false,
        reason: 'invalid_amount',
        message: 'O valor do pagamento deve ser maior que zero.'
      };
    }

    const invoice = invoiceState(
      cardId,
      periodKey,
      purchases,
      cards,
      invoiceLaunches
    );

    if (invoice.total <= EPSILON) {
      return {
        valid: false,
        reason: 'empty_invoice',
        message: 'A fatura não possui saldo.'
      };
    }

    if (value > invoice.remaining + EPSILON) {
      return {
        valid: false,
        reason: 'payment_exceeds_invoice',
        message:
          'O pagamento não pode ultrapassar o saldo da fatura.',
        invoiceTotal: invoice.total,
        alreadyPaid: invoice.paid,
        remaining: invoice.remaining,
        requested: value
      };
    }

    return {
      valid: true,
      amount: value,
      invoiceTotal: invoice.total,
      alreadyPaid: invoice.paid,
      remainingBefore: invoice.remaining,
      remainingAfter: Math.max(
        0,
        invoice.remaining - value
      )
    };
  }

  /*
   * Identifica registros que apontam para cartões inexistentes.
   */
  function auditOrphans(
    cards,
    purchases,
    invoiceLaunches
  ) {
    const cardIds = new Set(
      (cards || []).map(card => card.id)
    );

    return {
      purchases: (purchases || [])
        .filter(p => !cardIds.has(p.cardId))
        .map(p => p.id),

      invoiceLaunches: (invoiceLaunches || [])
        .filter(x => !cardIds.has(x.cardId))
        .map(x => x.id)
    };
  }


  function normalizeTitular(value) {
    const s = String(value ?? '').trim();
    return s || 'Sem titular';
  }

  function launchId(cardId, periodKey, titular) {
    return `invl_${cardId}_${periodKey}_${normalizeTitular(titular)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`;
  }

  function launchPaidAmount(launch) {
    if (!launch) return 0;

    if (Array.isArray(launch.payments)) {
      return Math.max(
        0,
        launch.payments.reduce(
          (sum, payment) => sum + Math.max(0, number(payment?.amount)),
          0
        )
      );
    }

    return Math.max(0, number(launch.amount));
  }

  function invoiceLines(cardId, periodKey, purchases, cards) {
    const invoice = cardInvoiceForPeriod(
      cardId,
      periodKey,
      purchases,
      cards
    );

    return Array.isArray(invoice?.lines) ? invoice.lines : [];
  }

  function invoiceByTitular(cardId, periodKey, purchases, cards) {
    const groups = new Map();

    for (const line of invoiceLines(cardId, periodKey, purchases, cards)) {
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
      group.total += Math.max(0, number(line.amount));
      group.count += 1;
      group.lines.push(line);
    }

    return Array.from(groups.values());
  }

  function titularInvoice(
    cardId,
    periodKey,
    titular,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const normalizedTitular = normalizeTitular(titular);

    const group = invoiceByTitular(
      cardId,
      periodKey,
      purchases,
      cards
    ).find(x => x.titular === normalizedTitular);

    const total = Math.max(0, number(group?.total));

    const id = launchId(
      cardId,
      periodKey,
      normalizedTitular
    );

    const launch = (Array.isArray(invoiceLaunches) ? invoiceLaunches : [])
      .find(x => x && x.id === id) || null;

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
      launchId: launch?.id || id,
      lines: group?.lines || []
    };
  }

  function invoice(
    cardId,
    periodKey,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const base = cardInvoiceForPeriod(
      cardId,
      periodKey,
      purchases,
      cards
    );

    const state = invoiceState(
      cardId,
      periodKey,
      purchases,
      cards,
      invoiceLaunches
    );

    const lines = invoiceLines(
      cardId,
      periodKey,
      purchases,
      cards
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

    return {
      ...base,
      paid: number(state?.paid),
      remaining: Math.max(0, number(base?.total) - number(state?.paid)),
      status: state?.status || 'open',
      markedPaidOnly: state?.markedPaidOnly === true,
      count: lines.length,
      lines,
      titulars
    };
  }

  function validatePaymentForTitular(
    cardId,
    periodKey,
    titular,
    amount,
    purchases,
    cards,
    invoiceLaunches
  ) {
    const requested = number(amount);

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

  return Object.freeze({
    EPSILON,
    addMonthsToPeriodKey,
    invoicePeriodKeyForDate,
    purchaseInstallmentOccurrences,
    buildInstallments,
    cardInvoiceForPeriod,
    invoicePaymentsFor,
    invoiceAmountPaid,
    invoiceStatus,
    invoiceState,
    cardCommittedAmount,
    calculateLimit,
    validatePayment,
    validatePaymentForTitular,
    normalizeTitular,
    launchId,
    invoiceLines,
    invoiceByTitular,
    titularInvoice,
    invoice,
    auditOrphans
  });
});
