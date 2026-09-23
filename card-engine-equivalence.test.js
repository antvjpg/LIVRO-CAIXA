'use strict';

const assert = require('assert');
const Engine = require('./card-engine-v3.js');

function oldInvoicePeriodKeyForDate(card, dateStr) {
  const d = new Date((dateStr || '2026-01-01') + 'T00:00:00');
  const day = d.getDate();
  const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
  const targetMonth = day <= closing ? d.getMonth() : d.getMonth() + 1;
  const target = new Date(d.getFullYear(), targetMonth, 1);

  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

function oldAddMonths(periodKey, months) {
  const [y, m] = periodKey.split('-').map(Number);
  const d = new Date(y, (m - 1) + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function oldOccurrences(purchase, cards) {
  const card = cards.find(c => c.id === purchase.cardId);
  if (!card) return [];

  const firstPeriod = oldInvoicePeriodKeyForDate(card, purchase.date);
  if (!firstPeriod) return [];

  if (purchase.paymentType !== 'parcelado') {
    return [{
      periodKey: firstPeriod,
      installmentNumber: 1,
      totalInstallments: 1,
      amount: Number(purchase.totalValue || 0)
    }];
  }

  const occurrences = [];
  const start = Number(purchase.initialInstallment) || 1;
  const total = Number(purchase.totalInstallments) || 0;

  for (let n = start; n <= total; n++) {
    occurrences.push({
      periodKey: oldAddMonths(firstPeriod, n - start),
      installmentNumber: n,
      totalInstallments: total,
      amount: Number(purchase.installmentValue || 0)
    });
  }

  return occurrences;
}

function oldInvoice(cardId, periodKey, purchases, cards) {
  const lines = [];

  purchases
    .filter(p => p.cardId === cardId)
    .forEach(purchase => {
      oldOccurrences(purchase, cards).forEach(occ => {
        if (occ.periodKey === periodKey) {
          lines.push({
            purchase,
            ...occ
          });
        }
      });
    });

  return {
    cardId,
    periodKey,
    lines,
    total: lines.reduce((sum, line) => sum + Number(line.amount || 0), 0),
    count: lines.length
  };
}

function normalizeOld(lines) {
  return lines.map(line => ({
    purchaseId: line.purchase?.id || null,
    cardId: line.purchase?.cardId || null,
    periodKey: line.periodKey,
    installmentNumber: line.installmentNumber,
    totalInstallments: line.totalInstallments,
    amount: Number(line.amount || 0)
  }));
}

function normalizeNew(lines) {
  return lines.map(line => ({
    purchaseId: line.purchaseId || line.purchase?.id || null,
    cardId: line.cardId || line.purchase?.cardId || null,
    periodKey: line.periodKey,
    installmentNumber: line.installmentNumber,
    totalInstallments: line.totalInstallments,
    amount: Number(line.amount || 0)
  }));
}

function compareScenario(name, card, purchases, periods) {
  let checks = 0;

  for (const period of periods) {
    const old = oldInvoice(card.id, period, purchases, [card]);
    const modern = Engine.cardInvoiceForPeriod(
      card.id,
      period,
      purchases,
      [card]
    );

    assert.strictEqual(
      modern.total,
      old.total,
      `${name} / ${period}: total diferente`
    );
    checks++;

    assert.strictEqual(
      modern.count,
      old.count,
      `${name} / ${period}: quantidade diferente`
    );
    checks++;

    assert.deepStrictEqual(
      normalizeNew(modern.lines),
      normalizeOld(old.lines),
      `${name} / ${period}: linhas diferentes`
    );
    checks++;
  }

  console.log(`PASS: ${name} (${checks} comparações)`);
  return checks;
}

const scenarios = [
  {
    name: 'Fechamento dia 1',
    card: { id: 'c1', closingDay: 1 },
    purchase: {
      id: 'p1',
      cardId: 'c1',
      date: '2026-09-01',
      paymentType: 'avista',
      totalValue: 100
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fechamento dia 5',
    card: { id: 'c2', closingDay: 5 },
    purchase: {
      id: 'p2',
      cardId: 'c2',
      date: '2026-09-05',
      paymentType: 'avista',
      totalValue: 150
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Depois do fechamento',
    card: { id: 'c3', closingDay: 5 },
    purchase: {
      id: 'p3',
      cardId: 'c3',
      date: '2026-09-06',
      paymentType: 'avista',
      totalValue: 200
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fechamento dia 28',
    card: { id: 'c4', closingDay: 28 },
    purchase: {
      id: 'p4',
      cardId: 'c4',
      date: '2026-09-28',
      paymentType: 'avista',
      totalValue: 250
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fechamento dia 29',
    card: { id: 'c5', closingDay: 29 },
    purchase: {
      id: 'p5',
      cardId: 'c5',
      date: '2026-09-29',
      paymentType: 'avista',
      totalValue: 300
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fechamento dia 30',
    card: { id: 'c6', closingDay: 30 },
    purchase: {
      id: 'p6',
      cardId: 'c6',
      date: '2026-09-30',
      paymentType: 'avista',
      totalValue: 350
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fechamento dia 31',
    card: { id: 'c7', closingDay: 31 },
    purchase: {
      id: 'p7',
      cardId: 'c7',
      date: '2026-09-30',
      paymentType: 'avista',
      totalValue: 400
    },
    periods: ['2026-09', '2026-10']
  },
  {
    name: 'Fevereiro',
    card: { id: 'c8', closingDay: 28 },
    purchase: {
      id: 'p8',
      cardId: 'c8',
      date: '2026-02-28',
      paymentType: 'avista',
      totalValue: 450
    },
    periods: ['2026-02', '2026-03']
  },
  {
    name: 'Virada de ano',
    card: { id: 'c9', closingDay: 15 },
    purchase: {
      id: 'p9',
      cardId: 'c9',
      date: '2026-12-20',
      paymentType: 'avista',
      totalValue: 500
    },
    periods: ['2026-12', '2027-01']
  },
  {
    name: 'Parcelamento 3x',
    card: { id: 'c10', closingDay: 10 },
    purchase: {
      id: 'p10',
      cardId: 'c10',
      date: '2026-09-05',
      paymentType: 'parcelado',
      totalValue: 1200,
      installmentValue: 400,
      totalInstallments: 3,
      initialInstallment: 1
    },
    periods: ['2026-09', '2026-10', '2026-11', '2026-12']
  },
  {
    name: 'Parcelamento iniciando na parcela 2',
    card: { id: 'c11', closingDay: 10 },
    purchase: {
      id: 'p11',
      cardId: 'c11',
      date: '2026-09-05',
      paymentType: 'parcelado',
      totalValue: 1200,
      installmentValue: 400,
      totalInstallments: 3,
      initialInstallment: 2
    },
    periods: ['2026-09', '2026-10', '2026-11', '2026-12']
  }
];

let totalChecks = 0;

console.log('=== EQUIVALÊNCIA OLD × V3 ===');

for (const scenario of scenarios) {
  totalChecks += compareScenario(
    scenario.name,
    scenario.card,
    [scenario.purchase],
    scenario.periods
  );
}

console.log('\n=== TESTE COM MÚLTIPLAS COMPRAS ===');

const card = {
  id: 'multi',
  closingDay: 10
};

const purchases = [
  {
    id: 'm1',
    cardId: 'multi',
    date: '2026-09-05',
    paymentType: 'avista',
    totalValue: 100,
    titular: 'João'
  },
  {
    id: 'm2',
    cardId: 'multi',
    date: '2026-09-12',
    paymentType: 'avista',
    totalValue: 200,
    titular: 'Maria'
  },
  {
    id: 'm3',
    cardId: 'multi',
    date: '2026-09-07',
    paymentType: 'parcelado',
    totalValue: 900,
    installmentValue: 300,
    totalInstallments: 3,
    initialInstallment: 1,
    titular: 'João'
  }
];

totalChecks += compareScenario(
  'Múltiplas compras + titulares + parcelamento',
  card,
  purchases,
  ['2026-09', '2026-10', '2026-11', '2026-12']
);

console.log('\n=== RESULTADO FINAL ===');
console.log(`PASS: ${totalChecks}`);
console.log('FAIL: 0');
console.log('OLD × V3: PASS');
