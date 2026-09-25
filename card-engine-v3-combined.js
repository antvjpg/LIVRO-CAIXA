(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var result = factory();
    root.LivroCaixaCardEngineV3 = result.engine;
    root.LivroCaixaCardAdapter = result.adapter;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  /* =====================================================================
     ENGINE — card-engine-v3.js (lógica pura de cálculo de cartão)
     ===================================================================== */

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

  function invoicePeriods(
    card,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
  ) {
    const today =
      referenceDate ||
      new Date().toISOString().slice(0, 10);

    const referencePeriod = invoicePeriodKeyForDate(
      card,
      today
    );

    if (!referencePeriod) {
      return {
        current: null,
        previous: null,
        next: null,
        periods: []
      };
    }

    const periods = new Set();

    for (const purchase of purchases || []) {
      if (purchase?.cardId !== card?.id) continue;

      const occurrences = purchaseInstallmentOccurrences(
        purchase,
        new Map((cards || []).map(c => [c.id, c]))
      );

      for (const occurrence of occurrences) {
        if (occurrence.periodKey) {
          periods.add(occurrence.periodKey);
        }
      }
    }

    for (const launch of invoiceLaunches || []) {
      if (
        launch?.cardId === card?.id &&
        launch?.closingPeriodKey
      ) {
        periods.add(launch.closingPeriodKey);
      }
    }

    periods.add(referencePeriod);

    const sorted = Array.from(periods)
      .filter(Boolean)
      .sort();

    let current = referencePeriod;

    const laterOpen = sorted
      .filter(period => period >= referencePeriod)
      .find(period => {
        const state = invoiceState(
          card.id,
          period,
          purchases,
          cards,
          invoiceLaunches
        );

        return state.total > EPSILON &&
          state.remaining > EPSILON;
      });

    if (laterOpen) {
      current = laterOpen;
    }

    const currentIndex = sorted.indexOf(current);

    const previous =
      currentIndex > 0
        ? sorted[currentIndex - 1]
        : addMonthsToPeriodKey(current, -1);

    const next =
      currentIndex >= 0 && currentIndex < sorted.length - 1
        ? sorted[currentIndex + 1]
        : addMonthsToPeriodKey(current, 1);

    return {
      current,
      previous,
      next,
      periods: sorted
    };
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

  function invoicePaymentsFor(
    cardId,
    periodKey,
    invoiceLaunches
  ) {
    return (invoiceLaunches || [])
      .filter(launch => {
        if (
          launch.cardId !== cardId ||
          launch.closingPeriodKey !== periodKey
        ) {
          return false;
        }

        const hasFinancialPayments =
          Array.isArray(launch.payments)
            ? launch.payments.some(
                payment => number(payment.amount) > EPSILON
              )
            : number(launch.amount) > EPSILON;

        return !launch.markedPaidOnly || hasFinancialPayments;
      });
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

    const paid = titulars.reduce(
      (sum, titular) =>
        sum + Math.max(0, number(titular.paid)),
      0
    );

    const remaining = titulars.reduce(
      (sum, titular) =>
        sum + Math.max(0, number(titular.remaining)),
      0
    );

    const markedPaidOnly =
      titulars.length > 0 &&
      titulars.every(
        titular => titular.markedPaidOnly === true
      );

    let status = 'Pendente';

    if (invoice.total > EPSILON) {
      if (remaining <= EPSILON) {
        status = 'Pago';
      } else if (paid > EPSILON) {
        status = 'Parcial';
      }
    }

    return {
      ...invoice,
      paid: Math.min(
        Math.max(0, number(invoice.total)),
        paid
      ),
      remaining: Math.min(
        Math.max(0, number(invoice.total)),
        Math.max(0, remaining)
      ),
      markedPaidOnly,
      status,
      paymentCount: launches.length
    };
  }

  function cardCommittedAmount(
    cardId,
    purchases,
    cards,
    invoiceLaunches,
    referencePeriodInput
  ) {
    const card = (cards || []).find(
      item => item?.id === cardId
    );

    if (!card) {
      return 0;
    }

    const suppliedReference =
      String(referencePeriodInput || '').trim();

    const referencePeriod =
      /^\d{4}-\d{2}$/.test(suppliedReference)
        ? suppliedReference
        : invoicePeriodKeyForDate(
            card,
            suppliedReference ||
              new Date().toISOString().slice(0, 10)
          );

    if (!referencePeriod) {
      return 0;
    }

    const installments = buildInstallments(
      purchases,
      cards
    );

    const periodKeys = [
      ...new Set(
        installments
          .filter(item => item.cardId === cardId)
          .map(item => item.periodKey)
          .filter(Boolean)
      )
    ];

    const previousPeriod =
      addMonthsToPeriodKey(referencePeriod, -1);

    const relevantPeriods = new Set([
      previousPeriod,
      referencePeriod,
      ...periodKeys.filter(
        period => period > referencePeriod
      )
    ]);

    let committed = 0;

    for (const periodKey of relevantPeriods) {
      if (!periodKey) continue;

      const groups = invoiceByTitular(
        cardId,
        periodKey,
        purchases,
        cards
      );

      if (!groups.length) {
        continue;
      }

      for (const group of groups) {
        const state = titularInvoice(
          cardId,
          periodKey,
          group.titular,
          purchases,
          cards,
          invoiceLaunches
        );
        committed += Math.max(0, number(state.remaining));
      }
    }

    return Math.max(0, committed);
  }

  function calculateLimit(
    card,
    purchases,
    cards,
    invoiceLaunches,
    referencePeriod
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
      invoiceLaunches,
      referencePeriod
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

    const markedPaidOnly = launch?.markedPaidOnly === true;

    const remaining = markedPaidOnly
      ? 0
      : Math.max(0, total - paid);

    return {
      cardId,
      periodKey,
      titular: normalizedTitular,
      total,
      paid,
      remaining,
      count: group?.count || group?.lines?.length || 0,
      status: markedPaidOnly
        ? 'Pago'
        : paid <= EPSILON
          ? 'Pendente'
          : paid + EPSILON < total
            ? 'Parcial'
            : 'Pago',
      markedPaidOnly,
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
      remaining: Math.max(0, number(state?.remaining)),
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

  const engine = Object.freeze({
    EPSILON,
    addMonthsToPeriodKey,
    invoicePeriodKeyForDate,
    invoicePeriods,
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

  /* =====================================================================
     ADAPTER — card-adapter.js (camada de adaptação para UI)
     ===================================================================== */

  function adapterNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function resolveContext(ctx) {
    const c = ctx || {};
    return {
      cards: Array.isArray(c.cards) ? c.cards : [],
      purchases: Array.isArray(c.purchases) ? c.purchases : [],
      invoiceLaunches: Array.isArray(c.invoiceLaunches) ? c.invoiceLaunches : [],
      referenceDate: typeof c.referenceDate === 'string' && c.referenceDate ? c.referenceDate : undefined,
      dueDateFor: typeof c.dueDateFor === 'function' ? c.dueDateFor : null
    };
  }

  function dueDateFor(card, periodKey, c) {
    if (!c.dueDateFor || !periodKey) return '';
    try {
      return String(c.dueDateFor(card, periodKey) || '').slice(0, 10);
    } catch (err) {
      return '';
    }
  }

  function readInvoice(eng, card, periodKey, c) {
    if (!periodKey) return null;
    const state = eng.invoice(card.id, periodKey, c.purchases, c.cards, c.invoiceLaunches);
    if (!state) return null;
    return {
      periodKey: periodKey,
      total: Math.max(0, adapterNumber(state.total)),
      paid: Math.max(0, adapterNumber(state.paid)),
      remaining: Math.max(0, adapterNumber(state.remaining)),
      status: state.status || 'Pendente',
      dueDate: dueDateFor(card, periodKey, c)
    };
  }

  function snapshot(card, ctx) {
    const eng = engine;
    if (!eng || !card) return null;

    const c = resolveContext(ctx);
    const periods = eng.invoicePeriods(
      card,
      c.purchases,
      c.cards,
      c.invoiceLaunches,
      c.referenceDate
    ) || {};

    const previousKey = periods.previous || null;
    const currentKey = periods.current || null;
    const nextKey = periods.next || null;

    const previous = readInvoice(eng, card, previousKey, c);
    const current = readInvoice(eng, card, currentKey, c);
    const next = readInvoice(eng, card, nextKey, c);

    let futureRemaining = 0;
    const futureInvoices = [];
    const known = Array.isArray(periods.periods) ? periods.periods : [];

    known.forEach(function (key) {
      if (!currentKey || key <= currentKey) return;
      const state = eng.invoice(card.id, key, c.purchases, c.cards, c.invoiceLaunches);
      const remaining = Math.max(0, adapterNumber(state && state.remaining));
      if (remaining <= 0) return;
      futureRemaining += remaining;
      futureInvoices.push({
        periodKey: key,
        remaining: remaining,
        dueDate: dueDateFor(card, key, c)
      });
    });

    const limitState = eng.calculateLimit(
      card,
      c.purchases,
      c.cards,
      c.invoiceLaunches,
      c.referenceDate
    ) || {};

    const committed = Math.max(0, adapterNumber(
      eng.cardCommittedAmount(card.id, c.purchases, c.cards, c.invoiceLaunches, c.referenceDate)
    ));

    const limitTotal = adapterNumber(card.limit);
    const hasLimit = limitTotal > 0;

    return {
      cardId: card.id,
      name: card.name || 'Cartão',
      titular: card.titular || '',
      active: card.active !== false,
      referencePeriod: currentKey,
      previous: previous,
      current: current,
      next: next,
      futureRemaining: futureRemaining,
      futureInvoices: futureInvoices,
      committed: committed,
      limitTotal: limitTotal,
      limitUsed: hasLimit ? Math.max(0, adapterNumber(limitState.used)) : null,
      limitAvailable: hasLimit ? Math.max(0, adapterNumber(limitState.available)) : null,
      limitExcess: hasLimit ? Math.max(0, adapterNumber(limitState.excess)) : 0
    };
  }

  function emptySummary() {
    return {
      ready: false,
      cards: [],
      count: 0,
      totalLimit: 0,
      totalUsed: 0,
      totalAvailable: 0,
      currentInvoiceTotal: 0,
      currentInvoiceRemaining: 0,
      previousInvoiceRemaining: 0,
      nextInvoiceTotal: 0,
      nextInvoiceRemaining: 0,
      futureInstallmentsRemaining: 0,
      committed: 0,
      dueDates: []
    };
  }

  function summarize(ctx) {
    const eng = engine;
    if (!eng) return emptySummary();

    const c = resolveContext(ctx);
    const rows = [];

    c.cards
      .filter(function (card) { return card && card.active !== false; })
      .forEach(function (card) {
        const snap = snapshot(card, c);
        if (snap) rows.push(snap);
      });

    const out = emptySummary();
    out.ready = true;
    out.cards = rows;
    out.count = rows.length;

    rows.forEach(function (row) {
      out.committed += row.committed;
      out.futureInstallmentsRemaining += row.futureRemaining;

      if (row.limitTotal > 0) {
        out.totalLimit += row.limitTotal;
        out.totalUsed += row.limitUsed || 0;
        out.totalAvailable += row.limitAvailable || 0;
      }

      if (row.previous && row.previous.remaining > 0) {
        out.previousInvoiceRemaining += row.previous.remaining;
        if (row.previous.dueDate) {
          out.dueDates.push({
            cardId: row.cardId,
            label: row.name,
            periodKey: row.previous.periodKey,
            dueDate: row.previous.dueDate,
            amount: row.previous.remaining
          });
        }
      }

      if (row.current) {
        out.currentInvoiceTotal += row.current.total;
        out.currentInvoiceRemaining += row.current.remaining;
        if (row.current.remaining > 0 && row.current.dueDate) {
          out.dueDates.push({
            cardId: row.cardId,
            label: row.name,
            periodKey: row.current.periodKey,
            dueDate: row.current.dueDate,
            amount: row.current.remaining
          });
        }
      }

      if (row.next) {
        out.nextInvoiceTotal += row.next.total;
        out.nextInvoiceRemaining += row.next.remaining;
      }

      (row.futureInvoices || []).forEach(function (future) {
        if (!future.dueDate) return;
        out.dueDates.push({
          cardId: row.cardId,
          label: row.name,
          periodKey: future.periodKey,
          dueDate: future.dueDate,
          amount: future.remaining
        });
      });
    });

    return out;
  }

  const adapter = Object.freeze({
    isReady: function () { return !!engine; },
    snapshot: snapshot,
    summarize: summarize
  });

  return { engine, adapter };
});