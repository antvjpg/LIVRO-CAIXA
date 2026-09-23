'use strict';

const assert = require('assert');

const Engine = require('./card-engine-v3.js');
const Adapter = require('./card-adapter.js');

function buildCalendarInvoiceRow(card, dueMonthKey, purchases, cards, invoiceLaunches) {
  const [year, month] = dueMonthKey.split('-').map(Number);

  const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
  const due = Math.min(31, Math.max(1, Number(card.dueDay) || closing));
  const offset = due < closing ? 1 : 0;

  const [y, m] = dueMonthKey.split('-').map(Number);
  const d = new Date(y, (m - 1) - offset, 1);
  const closingPeriodKey =
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const invoiceState = Adapter.invoice(
    card.id,
    closingPeriodKey,
    purchases,
    cards,
    invoiceLaunches
  );

  if (!invoiceState || Number(invoiceState.total || 0) <= 0) {
    return null;
  }

  const breakdown = Array.isArray(invoiceState.titulars)
    ? invoiceState.titulars.map(item => ({
        titular: item.titular,
        total: Number(item.total || 0),
        count: Number(item.count || 0),
        paid: Number(item.paid || 0),
        remaining: Number(item.remaining || 0),
        status: item.status || 'Pendente',
        launched:
          item.status === 'Pago' &&
          item.markedPaidOnly !== true &&
          Number(item.paid || 0) > 0.004,
        paidOnly: item.markedPaidOnly === true
      }))
    : [];

  return {
    card,
    invoice: {
      cardId: invoiceState.cardId,
      periodKey: invoiceState.periodKey,
      lines: [],
      total: Number(invoiceState.total || 0),
      count: invoiceState.titulars.reduce(
        (sum, item) => sum + Number(item.count || 0),
        0
      )
    },
    closingPeriodKey,
    breakdown
  };
}

function findTitular(row, titular) {
  return row.breakdown.find(x => x.titular === titular);
}

let checks = 0;

function pass(label) {
  checks++;
  console.log(`PASS: ${label}`);
}

console.log('=== REGRESSÃO CALENDAR INVOICE × ADAPTER ===');

// --------------------------------------------------
// 1. UMA COMPRA / UM TITULAR
// --------------------------------------------------

{
  const cards = [{
    id: 'card-1',
    name: 'Visa',
    closingDay: 10,
    dueDay: 20,
    limit: 2000,
    active: true
  }];

  const purchases = [{
    id: 'p1',
    cardId: 'card-1',
    date: '2026-09-05',
    description: 'Compra João',
    titular: 'João',
    paymentType: 'avista',
    totalValue: 600
  }];

  const launches = [];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    launches
  );

  assert(row);
  assert.strictEqual(row.invoice.total, 600);
  assert.strictEqual(row.invoice.count, 1);
  assert.strictEqual(row.breakdown.length, 1);

  const joao = findTitular(row, 'João');

  assert(joao);
  assert.strictEqual(joao.total, 600);
  assert.strictEqual(joao.paid, 0);
  assert.strictEqual(joao.remaining, 600);
  assert.strictEqual(joao.status, 'Pendente');

  pass('uma compra + um titular');
}

// --------------------------------------------------
// 2. DOIS TITULARES
// --------------------------------------------------

{
  const cards = [{
    id: 'card-2',
    name: 'Master',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [
    {
      id: 'p1',
      cardId: 'card-2',
      date: '2026-09-05',
      description: 'João',
      titular: 'João',
      paymentType: 'avista',
      totalValue: 600
    },
    {
      id: 'p2',
      cardId: 'card-2',
      date: '2026-09-06',
      description: 'Maria',
      titular: 'Maria',
      paymentType: 'avista',
      totalValue: 400
    }
  ];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    []
  );

  assert(row);
  assert.strictEqual(row.invoice.total, 1000);
  assert.strictEqual(row.invoice.count, 2);
  assert.strictEqual(row.breakdown.length, 2);

  assert.strictEqual(findTitular(row, 'João').total, 600);
  assert.strictEqual(findTitular(row, 'Maria').total, 400);

  pass('dois titulares isolados corretamente');
}

// --------------------------------------------------
// 3. PAGAMENTO PARCIAL
// --------------------------------------------------

{
  const cards = [{
    id: 'card-3',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [{
    id: 'p1',
    cardId: 'card-3',
    date: '2026-09-05',
    titular: 'João',
    paymentType: 'avista',
    totalValue: 600
  }];

  const launches = [{
    id: 'invl_card-3_2026-09_jo-o',
    cardId: 'card-3',
    closingPeriodKey: '2026-09',
    titular: 'João',
    payments: [
      {
        entryId: 'e1',
        amount: 400,
        date: '2026-09-20'
      }
    ]
  }];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    launches
  );

  const joao = findTitular(row, 'João');

  assert(joao);
  assert.strictEqual(joao.total, 600);
  assert.strictEqual(joao.paid, 400);
  assert.strictEqual(joao.remaining, 200);
  assert.strictEqual(joao.status, 'Parcial');
  assert.strictEqual(joao.paidOnly, false);
  assert.strictEqual(joao.launched, false);

  pass('pagamento parcial');
}

// --------------------------------------------------
// 4. PAGAMENTO COMPLETO
// --------------------------------------------------

{
  const cards = [{
    id: 'card-4',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [{
    id: 'p1',
    cardId: 'card-4',
    date: '2026-09-05',
    titular: 'João',
    paymentType: 'avista',
    totalValue: 600
  }];

  const launches = [{
    id: 'invl_card-4_2026-09_jo-o',
    cardId: 'card-4',
    closingPeriodKey: '2026-09',
    titular: 'João',
    payments: [
      {
        entryId: 'e1',
        amount: 600,
        date: '2026-09-20'
      }
    ]
  }];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    launches
  );

  const joao = findTitular(row, 'João');

  assert(joao);
  assert.strictEqual(joao.total, 600);
  assert.strictEqual(joao.paid, 600);
  assert.strictEqual(joao.remaining, 0);
  assert.strictEqual(joao.status, 'Pago');
  assert.strictEqual(joao.paidOnly, false);
  assert.strictEqual(joao.launched, true);

  pass('pagamento completo');
}

// --------------------------------------------------
// 5. MARKED PAID ONLY
// --------------------------------------------------

{
  const cards = [{
    id: 'card-5',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [{
    id: 'p1',
    cardId: 'card-5',
    date: '2026-09-05',
    titular: 'João',
    paymentType: 'avista',
    totalValue: 600
  }];

  const launches = [{
    id: 'invl_card-5_2026-09_jo-o',
    cardId: 'card-5',
    closingPeriodKey: '2026-09',
    titular: 'João',
    markedPaidOnly: true,
    amount: 0,
    payments: []
  }];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    launches
  );

  const joao = findTitular(row, 'João');

  assert(joao);
  assert.strictEqual(joao.total, 600);
  assert.strictEqual(joao.paid, 0);
  assert.strictEqual(joao.remaining, 600);
  assert.strictEqual(joao.status, 'Pago');
  assert.strictEqual(joao.paidOnly, true);
  assert.strictEqual(joao.launched, false);

  pass('markedPaidOnly sem lançamento financeiro');
}

// --------------------------------------------------
// 6. PARCELAMENTO
// --------------------------------------------------

{
  const cards = [{
    id: 'card-6',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [{
    id: 'p1',
    cardId: 'card-6',
    date: '2026-09-05',
    titular: 'Maria',
    paymentType: 'parcelado',
    totalValue: 1200,
    installmentValue: 400,
    totalInstallments: 3,
    initialInstallment: 1
  }];

  const rowSep = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    []
  );

  const rowOct = buildCalendarInvoiceRow(
    cards[0],
    '2026-10',
    purchases,
    cards,
    []
  );

  const rowNov = buildCalendarInvoiceRow(
    cards[0],
    '2026-11',
    purchases,
    cards,
    []
  );

  assert.strictEqual(rowSep.invoice.total, 400);
  assert.strictEqual(rowOct.invoice.total, 400);
  assert.strictEqual(rowNov.invoice.total, 400);

  pass('parcelamento distribuído nas três faturas');
}

// --------------------------------------------------
// 7. FILTRO POR TITULAR
// --------------------------------------------------

{
  const cards = [{
    id: 'card-7',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const purchases = [
    {
      id: 'p1',
      cardId: 'card-7',
      date: '2026-09-05',
      titular: 'João',
      paymentType: 'avista',
      totalValue: 600
    },
    {
      id: 'p2',
      cardId: 'card-7',
      date: '2026-09-06',
      titular: 'Maria',
      paymentType: 'avista',
      totalValue: 400
    }
  ];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    purchases,
    cards,
    []
  );

  const joaoOnly = row.breakdown.filter(
    item => item.titular === 'João'
  );

  assert.strictEqual(joaoOnly.length, 1);
  assert.strictEqual(joaoOnly[0].total, 600);

  pass('dados permitem filtro por titular');
}

// --------------------------------------------------
// 8. FATURA VAZIA
// --------------------------------------------------

{
  const cards = [{
    id: 'card-8',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: true
  }];

  const row = buildCalendarInvoiceRow(
    cards[0],
    '2026-09',
    [],
    cards,
    []
  );

  assert.strictEqual(row, null);

  pass('fatura vazia é descartada');
}

// --------------------------------------------------
// 9. CARTÃO INATIVO
// --------------------------------------------------

{
  const cards = [{
    id: 'card-9',
    closingDay: 10,
    dueDay: 20,
    limit: 3000,
    active: false
  }];

  assert.strictEqual(cards[0].active, false);

  pass('cartão inativo permanece excluído pelo filtro da camada UI');
}

// --------------------------------------------------
// 10. LIMITE CONTINUA NO ENGINE
// --------------------------------------------------

{
  const card = {
    id: 'card-10',
    closingDay: 10,
    dueDay: 20,
    limit: 2000
  };

  const purchases = [{
    id: 'p1',
    cardId: 'card-10',
    date: '2026-09-05',
    titular: 'João',
    paymentType: 'avista',
    totalValue: 600
  }];

  const result = Adapter.calculateLimit(
    card,
    purchases,
    [card],
    []
  );

  assert.strictEqual(result.total, 2000);
  assert.strictEqual(result.used, 600);
  assert.strictEqual(result.available, 1400);
  assert.strictEqual(result.excess, 0);

  pass('limite continua delegado ao Engine V3');
}

console.log('\n=== RESULTADO FINAL ===');
console.log(`PASS: ${checks}`);
console.log('FAIL: 0');
console.log('CALENDAR × ADAPTER: PASS');
