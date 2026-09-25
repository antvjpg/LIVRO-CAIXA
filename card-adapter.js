/*
 * card-adapter.js — Camada de adaptação entre card-engine-v3.js e telas de consumo
 *
 * OBJETO
 *   Traduzir a API da engine (LivroCaixaCardEngineV3) em agregados prontos para
 *   exibição, SEM reproduzir qualquer regra financeira de cartão.
 *
 * REGRAS (obrigatórias)
 *   - NÃO calcular parcelas, faturas, fechamento, pagamento ou limite por conta própria.
 *   - NÃO copiar a lógica de card-engine-v3.js.
 *   - Ler somente resultados já produzidos pela engine:
 *       invoicePeriods / invoice / calculateLimit / cardCommittedAmount
 *   - Datas de vencimento NÃO são calculadas aqui: a função resolutora é injetada
 *     pelo aplicativo (que já possui invoiceDueDateForPeriod).
 *
 * Uso:
 *   const resumo = window.LivroCaixaCardAdapter.summarize({
 *     cards, purchases, invoiceLaunches,
 *     referenceDate: todayISO(),
 *     dueDateFor: invoiceDueDateForPeriod
 *   });
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LivroCaixaCardAdapter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function engine() {
    var scope = typeof globalThis !== 'undefined' ? globalThis : this;
    var eng = scope && scope.LivroCaixaCardEngineV3;
    return eng && typeof eng.invoice === 'function' ? eng : null;
  }

  function number(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function resolveContext(ctx) {
    var c = ctx || {};
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
    var state = eng.invoice(card.id, periodKey, c.purchases, c.cards, c.invoiceLaunches);
    if (!state) return null;
    return {
      periodKey: periodKey,
      total: Math.max(0, number(state.total)),
      paid: Math.max(0, number(state.paid)),
      remaining: Math.max(0, number(state.remaining)),
      status: state.status || 'Pendente',
      dueDate: dueDateFor(card, periodKey, c)
    };
  }

  /*
   * Snapshot de um cartão. Devolve somente valores lidos da engine.
   */
  function snapshot(card, ctx) {
    var eng = engine();
    if (!eng || !card) return null;

    var c = resolveContext(ctx);
    var periods = eng.invoicePeriods(
      card,
      c.purchases,
      c.cards,
      c.invoiceLaunches,
      c.referenceDate
    ) || {};

    var previousKey = periods.previous || null;
    var currentKey = periods.current || null;
    var nextKey = periods.next || null;

    var previous = readInvoice(eng, card, previousKey, c);
    var current = readInvoice(eng, card, currentKey, c);
    var next = readInvoice(eng, card, nextKey, c);

    var futureRemaining = 0;
    var futureInvoices = [];
    var known = Array.isArray(periods.periods) ? periods.periods : [];

    known.forEach(function (key) {
      if (!currentKey || key <= currentKey) return;
      var state = eng.invoice(card.id, key, c.purchases, c.cards, c.invoiceLaunches);
      var remaining = Math.max(0, number(state && state.remaining));
      if (remaining <= 0) return;
      futureRemaining += remaining;
      futureInvoices.push({
        periodKey: key,
        remaining: remaining,
        dueDate: dueDateFor(card, key, c)
      });
    });

    var limitState = eng.calculateLimit(
      card,
      c.purchases,
      c.cards,
      c.invoiceLaunches,
      c.referenceDate
    ) || {};

    var committed = Math.max(0, number(
      eng.cardCommittedAmount(card.id, c.purchases, c.cards, c.invoiceLaunches, c.referenceDate)
    ));

    var limitTotal = number(card.limit);
    var hasLimit = limitTotal > 0;

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
      limitUsed: hasLimit ? Math.max(0, number(limitState.used)) : null,
      limitAvailable: hasLimit ? Math.max(0, number(limitState.available)) : null,
      limitExcess: hasLimit ? Math.max(0, number(limitState.excess)) : 0
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

  /*
   * Agregado de todos os cartões ativos.
   * "committed" é a soma do comprometimento declarado pela engine e é a única
   * base aceita para o indicador "Comprometido" do Dashboard.
   */
  function summarize(ctx) {
    var eng = engine();
    if (!eng) return emptySummary();

    var c = resolveContext(ctx);
    var rows = [];

    c.cards
      .filter(function (card) { return card && card.active !== false; })
      .forEach(function (card) {
        var snap = snapshot(card, c);
        if (snap) rows.push(snap);
      });

    var out = emptySummary();
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

  return Object.freeze({
    isReady: function () { return !!engine(); },
    snapshot: snapshot,
    summarize: summarize
  });
});
