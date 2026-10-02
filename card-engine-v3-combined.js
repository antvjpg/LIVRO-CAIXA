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

  // Janela de compras da fatura de um período de fechamento 'AAAA-MM':
  // começa no dia seguinte ao fechamento do mês anterior e termina no
  // dia de fechamento do próprio período (limitado ao último dia do mês).
  // É o inverso de invoicePeriodKeyForDate(): toda data dentro da janela
  // cai no mesmo períodoKey, e datas fora dela caem em outro.
  function invoiceCycleRange(card, periodKeyValue) {
    const parsed = parsePeriodKey(periodKeyValue);
    if (!parsed) return null;

    const closing = clampDay(card?.closingDay, 1);
    const year = parsed.year;
    const monthIndex = parsed.monthIndex;

    const lastDayOfMonth = (y, m) =>
      new Date(y, m + 1, 0).getDate();

    const endDay = Math.min(
      closing,
      lastDayOfMonth(year, monthIndex)
    );

    const previous = new Date(year, monthIndex - 1, 1);
    const previousClosing = Math.min(
      closing,
      lastDayOfMonth(
        previous.getFullYear(),
        previous.getMonth()
      )
    );

    // Dia anterior ao fechamento do mês anterior; quando o fechamento
    // cai no último dia do mês, a data "vira" para o dia 1 do período.
    const start = new Date(
      previous.getFullYear(),
      previous.getMonth(),
      previousClosing + 1
    );

    return {
      start: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
      end: `${year}-${pad2(monthIndex + 1)}-${pad2(endDay)}`
    };
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  // Data de vencimento de uma fatura. Se o vencimento é anterior ao
  // fechamento (fecha dia 29, vence dia 05), o vencimento cai no mês
  // seguinte ao fechamento.
  function dueDateForPeriod(card, periodKeyValue) {
    const parsed = parsePeriodKey(periodKeyValue);
    if (!parsed) return '';

    const closing = clampDay(card?.closingDay, 1);
    // Mesmo critério de invoiceDueDateForPeriod() no index.html: valor
    // falso/zerado de dueDay cai no dia de fechamento.
    const due = clampDay(Number(card?.dueDay) || closing, closing);
    const dueMonthOffset = due < closing ? 1 : 0;
    const base = new Date(
      parsed.year,
      parsed.monthIndex + dueMonthOffset,
      1
    );
    const lastDayOfDueMonth = new Date(
      base.getFullYear(),
      base.getMonth() + 1,
      0
    ).getDate();
    const finalDay = Math.min(due, lastDayOfDueMonth);

    return `${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(finalDay)}`;
  }

  // Conjunto ordenado de períodos de fatura conhecidos para um cartão
  // (compras/parcelas + lançamentos + referência). Extraído de
  // invoicePeriods() para permitir que o cálculo de saldo anterior (carry)
  // navegue pelos períodos sem reentrar em invoiceState().
  function periodSet(card, purchases, cards, invoiceLaunches, referenceDate) {
    const today =
      referenceDate ||
      todayISO();

    const referencePeriod = invoicePeriodKeyForDate(
      card,
      today
    );

    if (!referencePeriod) {
      return { referencePeriod: null, periods: [] };
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

    return {
      referencePeriod,
      periods: Array.from(periods)
        .filter(Boolean)
        .sort()
    };
  }

  function invoicePeriods(
    card,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
  ) {
    const { referencePeriod, periods: sorted } = periodSet(
      card,
      purchases,
      cards,
      invoiceLaunches,
      referenceDate
    );

    if (!referencePeriod) {
      return {
        current: null,
        previous: null,
        next: null,
        periods: []
      };
    }

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
    invoiceLaunches,
    referenceDate
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
        invoiceLaunches,
        referenceDate
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

    const carry = titulars.reduce(
      (sum, titular) =>
        sum + Math.max(0, number(titular.carry)),
      0
    );

    const payableTotal = Math.max(
      0,
      number(invoice.total) + carry
    );

    const payablePaid = titulars.reduce(
      (sum, titular) =>
        sum + Math.max(0, number(titular.payablePaid)),
      0
    );

    const payableRemaining = titulars.reduce(
      (sum, titular) =>
        sum + Math.max(0, number(titular.payableRemaining)),
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

    let payableStatus = 'Pendente';

    if (payableTotal > EPSILON) {
      if (markedPaidOnly || payableRemaining <= EPSILON) {
        payableStatus = 'Pago';
      } else if (payablePaid > EPSILON) {
        payableStatus = 'Parcial';
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
      paymentCount: launches.length,
      carry,
      payableTotal,
      payablePaid: Math.min(payableTotal, payablePaid),
      payableRemaining: Math.min(
        payableTotal,
        Math.max(0, payableRemaining)
      ),
      payableStatus
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

    // Saldo arrastado de períodos ANTERIORES à janela considerada. Sem isso,
    // uma fatura com saldo anterior em aberto seria medida só pela parcela do
    // período atual e o limite usado ficaria menor que o valor exibido na
    // fatura. Quando não há saldo arrastado, titularCarry() devolve 0 e o
    // resultado é idêntico ao de antes.
    const carryReferenceDate = /^\d{4}-\d{2}$/.test(suppliedReference)
      ? undefined
      : (suppliedReference || undefined);
    const anchorTitulares = new Set();
    [...new Set([...relevantPeriods, ...periodKeys])].forEach(period => {
      if (!period) return;
      invoiceByTitular(cardId, period, purchases, cards).forEach(group => {
        anchorTitulares.add(normalizeTitular(group.titular));
      });
    });
    anchorTitulares.forEach(titular => {
      committed += Math.max(0, number(titularCarry(
        cardId,
        previousPeriod,
        titular,
        purchases,
        cards,
        invoiceLaunches,
        carryReferenceDate
      )));
    });

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

  // Saldo anterior ("carry") de um titular num período: encadeamento do que
  // ficou em aberto nos períodos ANTERIORES cujo vencimento JÁ passou.
  // Regra de contagem exata: cada saldo aparece uma única vez — o período
  // "dono" é o último da cadeia (aquele cujo carry ainda não foi quitado).
  // O gate de vencimento evita arrastar faturas que ainda não venceram.
  function titularCarry(
    cardId,
    periodKey,
    titular,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
  ) {
    if (!periodKey) return 0;

    const cardsById = new Map((cards || []).map(c => [c.id, c]));
    const card = cardsById.get(cardId);
    if (!card) return 0;

    const normalizedTitular = normalizeTitular(titular);
    const today = referenceDate || todayISO();
    const { periods } = periodSet(
      card,
      purchases,
      cards,
      invoiceLaunches,
      referenceDate
    );

    let carry = 0;

    for (const earlier of periods) {
      if (!(earlier < periodKey)) continue;

      const due = dueDateForPeriod(card, earlier);
      if (!due || due >= today) continue;

      const own = titularInvoice(
        cardId,
        earlier,
        normalizedTitular,
        purchases,
        cards,
        invoiceLaunches,
        referenceDate,
        true
      );

      if (own.markedPaidOnly) {
        carry = 0;
        continue;
      }

      const payableTotal = own.total + carry;
      carry = Math.max(0, payableTotal - Math.min(payableTotal, own.paidRaw));
    }

    return carry;
  }

  function titularInvoice(
    cardId,
    periodKey,
    titular,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate,
    skipCarry
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

    const paidRaw = launchPaidAmount(launch);

    const paid = Math.min(
      total,
      paidRaw
    );

    const markedPaidOnly = launch?.markedPaidOnly === true;

    const remaining = markedPaidOnly
      ? 0
      : Math.max(0, total - paid);

    const carry = skipCarry
      ? 0
      : titularCarry(
          cardId,
          periodKey,
          normalizedTitular,
          purchases,
          cards,
          invoiceLaunches,
          referenceDate
        );

    const payableTotal = Math.max(0, total + carry);
    const payablePaid = markedPaidOnly
      ? payableTotal
      : Math.min(payableTotal, paidRaw);
    const payableRemaining = markedPaidOnly
      ? 0
      : Math.max(0, payableTotal - payablePaid);

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
      lines: group?.lines || [],
      // Campos pagáveis: incluem o saldo anterior já vencido de períodos
      // anteriores. `total`/`paid`/`remaining` permanecem SEM o carry — o
      // saldo de períodos fora da janela é somado uma única vez, e só em
      // cardCommittedAmount(), para o limite usar o mesmo número exibido na
      // fatura. Projeções futuras (futureRemaining) continuam sem carry.
      paidRaw,
      carry,
      payableTotal,
      payablePaid,
      payableRemaining,
      payableStatus: markedPaidOnly
        ? 'Pago'
        : payablePaid <= EPSILON
          ? 'Pendente'
          : payablePaid + EPSILON < payableTotal
            ? 'Parcial'
            : 'Pago'
    };
  }

  // Períodos anteriores que formam o saldo arrastado ("carry") do período
  // informado, na ordem em que serão quitados (mais antigo primeiro).
  // Espelha titularCarry(): só períodos já vencidos; uma fatura marcada como
  // paga sem lançamento zera tudo o que vem antes dela (a quitação dela já
  // cobriu o saldo que ela própria arrastava).
  function carrySourcePeriods(
    cardId,
    periodKey,
    titular,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
  ) {
    if (!periodKey) return [];

    const card = (cards || []).find(item => item && item.id === cardId);
    if (!card) return [];

    const normalized = normalizeTitular(titular);
    const today = referenceDate || todayISO();
    const { periods } = periodSet(
      card,
      purchases,
      cards,
      invoiceLaunches,
      referenceDate
    );

    let collected = [];

    for (const earlier of periods) {
      if (!(earlier < periodKey)) continue;

      const due = dueDateForPeriod(card, earlier);
      if (!due || due >= today) continue;

      const own = titularInvoice(
        cardId,
        earlier,
        normalized,
        purchases,
        cards,
        invoiceLaunches,
        referenceDate,
        true
      );

      if (own.markedPaidOnly) {
        collected = [];
        continue;
      }

      const remaining = Math.max(0, own.remaining);
      if (remaining > EPSILON) {
        collected.push({ periodKey: earlier, remaining: remaining });
      }
    }

    return collected;
  }

  // Distribui um pagamento de fatura entre os períodos anteriores que já
  // venceram (mais antigo primeiro) e o período informado. Sem essa
  // propagação, quitar o "saldo anterior" deixaria cardCommittedAmount() e
  // calculateLimit() apontando dívida que já foi paga.
  function planInvoicePayment(
    cardId,
    periodKey,
    titular,
    amount,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
  ) {
    const plan = [];
    let left = Math.max(0, number(amount));

    if (left <= EPSILON || !periodKey) return plan;

    const sources = carrySourcePeriods(
      cardId,
      periodKey,
      titular,
      purchases,
      cards,
      invoiceLaunches,
      referenceDate
    );

    for (const source of sources) {
      if (left <= EPSILON) break;
      const part = Math.min(source.remaining, left);
      if (part <= EPSILON) continue;
      plan.push({ periodKey: source.periodKey, amount: part });
      left -= part;
    }

    if (left > EPSILON) {
      plan.push({ periodKey: periodKey, amount: left });
    }

    return plan;
  }

  function invoice(
    cardId,
    periodKey,
    purchases,
    cards,
    invoiceLaunches,
    referenceDate
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
      invoiceLaunches,
      referenceDate
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
        invoiceLaunches,
        referenceDate
      )
    );

    // Quanto deste período é levado para o mês seguinte. Usado para o
    // rótulo "Seguinte" no mês anterior: carry do mês seguinte > 0 implica
    // que o saldo vencido de {periodKey} (ou de um anterior) ainda está
    // em aberto.
    const nextPeriodKey = addMonthsToPeriodKey(periodKey, 1);
    const carriedOut = nextPeriodKey
      ? titulars.reduce(
          (sum, titular) =>
            sum + titularCarry(
              cardId,
              nextPeriodKey,
              titular.titular,
              purchases,
              cards,
              invoiceLaunches,
              referenceDate
            ),
          0
        )
      : 0;

    const carry = Math.max(0, number(state?.carry));
    const payableTotal = Math.max(
      0,
      number(state?.payableTotal, number(state?.total) + carry)
    );
    const payablePaid = Math.max(0, number(state?.payablePaid));
    const payableRemaining = Math.max(0, number(state?.payableRemaining));

    return {
      ...base,
      paid: number(state?.paid),
      remaining: Math.max(0, number(state?.remaining)),
      status: state?.status || 'open',
      markedPaidOnly: state?.markedPaidOnly === true,
      count: lines.length,
      lines,
      titulars,
      carry,
      payableTotal,
      payablePaid,
      payableRemaining,
      payableStatus: state?.payableStatus || 'Pendente',
      carriedOut: Math.max(0, carriedOut)
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

    if (target.payableTotal <= EPSILON) {
      return {
        valid: false,
        reason: 'empty_invoice',
        total: target.payableTotal,
        alreadyPaid: target.payablePaid,
        remaining: target.payableRemaining,
        requested
      };
    }

    if (requested > target.payableRemaining + EPSILON) {
      return {
        valid: false,
        reason: 'payment_exceeds_titular_invoice',
        total: target.payableTotal,
        alreadyPaid: target.payablePaid,
        remaining: target.payableRemaining,
        requested
      };
    }

    return {
      valid: true,
      reason: 'ok',
      total: target.payableTotal,
      alreadyPaid: target.payablePaid,
      remaining: target.payableRemaining,
      requested
    };
  }

  const engine = Object.freeze({
    EPSILON,
    addMonthsToPeriodKey,
    invoicePeriodKeyForDate,
    invoiceCycleRange,
    invoicePeriods,
    periodSet,
    dueDateForPeriod,
    titularCarry,
    carrySourcePeriods,
    planInvoicePayment,
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
     ADAPTER — camada de adaptação para UI (definida aqui e exportada em
     LivroCaixaCardAdapter). O arquivo separado card-adapter.js não existe
     mais: manter a camada neste arquivo evita duplicar lógica.
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
    const state = eng.invoice(card.id, periodKey, c.purchases, c.cards, c.invoiceLaunches, c.referenceDate);
    if (!state) return null;
    return {
      periodKey: periodKey,
      total: Math.max(0, adapterNumber(state.total)),
      paid: Math.max(0, adapterNumber(state.paid)),
      remaining: Math.max(0, adapterNumber(state.remaining)),
      // Campos pagáveis: total/restante do período incluindo o saldo
      // anterior já vencido (o que o usuário efetivamente deve nesta fatura).
      carry: Math.max(0, adapterNumber(state.carry)),
      payableTotal: Math.max(0, adapterNumber(state.payableTotal)),
      payablePaid: Math.max(0, adapterNumber(state.payablePaid)),
      payableRemaining: Math.max(0, adapterNumber(state.payableRemaining)),
      status: state.status || 'Pendente',
      payableStatus: state.payableStatus || state.status || 'Pendente',
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
      const state = eng.invoice(card.id, key, c.purchases, c.cards, c.invoiceLaunches, c.referenceDate);
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

      // Quando o saldo da fatura anterior já foi arrastado para a fatura
      // atual (carry > 0), ele NÃO pode ser somado de novo: senão o mesmo
      // dinheiro apareceria duas vezes (anterior + atual). O alerta de
      // vencimento continua em dueDates().
      const currentCarried = row.current
        ? adapterNumber(row.current.carry) > EPSILON
        : false;

      if (row.previous) {
        const previousRemaining = adapterNumber(row.previous.payableRemaining) > 0
          ? adapterNumber(row.previous.payableRemaining)
          : adapterNumber(row.previous.remaining);

        if (previousRemaining > 0) {
          if (!currentCarried) {
            out.previousInvoiceRemaining += previousRemaining;
          }
          if (row.previous.dueDate) {
            // O alerta de vencimento é sempre mantido (mesmo com o saldo
            // já arrastado), para não perder o aviso de fatura vencida.
            out.dueDates.push({
              cardId: row.cardId,
              label: row.name,
              periodKey: row.previous.periodKey,
              dueDate: row.previous.dueDate,
              amount: previousRemaining
            });
          }
        }
      }

      if (row.current) {
        const currentTotal = adapterNumber(row.current.payableTotal) > 0
          ? adapterNumber(row.current.payableTotal)
          : adapterNumber(row.current.total);
        const currentRemaining = adapterNumber(row.current.payableRemaining) > 0
          ? adapterNumber(row.current.payableRemaining)
          : adapterNumber(row.current.remaining);
        // dueDates() é uma lista POR VENCIMENTO: cada período entra com a
        // parcela que nasceu nele. Somar o payable aqui duplicaria o saldo
        // anterior (que já foi lançado na linha do período anterior).
        const currentDueAmount = adapterNumber(row.current.remaining) > EPSILON
          ? adapterNumber(row.current.remaining)
          : currentRemaining;

        out.currentInvoiceTotal += currentTotal;
        out.currentInvoiceRemaining += currentRemaining;
        if (currentDueAmount > 0 && row.current.dueDate) {
          out.dueDates.push({
            cardId: row.cardId,
            label: row.name,
            periodKey: row.current.periodKey,
            dueDate: row.current.dueDate,
            amount: currentDueAmount
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