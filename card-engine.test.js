const assert = require('node:assert/strict');
const CardEngine = require('./card-engine-v3');

const cards = [{
  id: 'card_1',
  name: 'Meu Cartão',
  closingDay: 10,
  dueDay: 20,
  limit: 2000,
  active: true
}];

const cardsById =
  new Map(cards.map(card => [card.id, card]));

/* =========================================================
   1. FECHAMENTO DA FATURA
   ========================================================= */

/* Antes do fechamento */
assert.equal(
  CardEngine.invoicePeriodKeyForDate(
    cards[0],
    '2026-09-05'
  ),
  '2026-09'
);

/* Exatamente no fechamento */
assert.equal(
  CardEngine.invoicePeriodKeyForDate(
    cards[0],
    '2026-09-10'
  ),
  '2026-09'
);

/* Depois do fechamento */
assert.equal(
  CardEngine.invoicePeriodKeyForDate(
    cards[0],
    '2026-09-11'
  ),
  '2026-10'
);

/* =========================================================
   2. COMPRA À VISTA
   ========================================================= */

const avista = {
  id: 'avista',
  cardId: 'card_1',
  date: '2026-09-05',
  paymentType: 'avista',
  totalValue: 500
};

const avistaOccurrences =
  CardEngine.purchaseInstallmentOccurrences(
    avista,
    cardsById
  );

assert.equal(avistaOccurrences.length, 1);
assert.equal(avistaOccurrences[0].periodKey, '2026-09');
assert.equal(avistaOccurrences[0].amount, 500);

/* =========================================================
   3. COMPRA PARCELADA
   ========================================================= */

const parcelada = {
  id: 'parcelada',
  cardId: 'card_1',
  date: '2026-09-11',
  paymentType: 'parcelado',
  totalValue: 1200,
  totalInstallments: 12,
  installmentValue: 100,
  initialInstallment: 1
};

const occurrences =
  CardEngine.purchaseInstallmentOccurrences(
    parcelada,
    cardsById
  );

assert.equal(occurrences.length, 12);
assert.equal(occurrences[0].periodKey, '2026-10');
assert.equal(occurrences[0].installmentNumber, 1);
assert.equal(occurrences[11].periodKey, '2027-09');
assert.equal(occurrences[11].installmentNumber, 12);

assert.equal(
  occurrences.reduce(
    (sum, occurrence) => sum + occurrence.amount,
    0
  ),
  1200
);

/* =========================================================
   4. INITIAL INSTALLMENT
   ========================================================= */

const parceladaIniciandoNa3 = {
  id: 'parcelada-3',
  cardId: 'card_1',
  date: '2026-09-11',
  paymentType: 'parcelado',
  totalValue: 1000,
  totalInstallments: 12,
  installmentValue: 100,
  initialInstallment: 3
};

const occurrencesInitial =
  CardEngine.purchaseInstallmentOccurrences(
    parceladaIniciandoNa3,
    cardsById
  );

assert.equal(occurrencesInitial.length, 10);
assert.equal(occurrencesInitial[0].installmentNumber, 3);
assert.equal(occurrencesInitial[9].installmentNumber, 12);
assert.equal(occurrencesInitial[0].periodKey, '2026-10');
assert.equal(occurrencesInitial[9].periodKey, '2027-07');

/* =========================================================
   5. FATURAS
   ========================================================= */

const purchases = [
  avista,
  parcelada
];

const september =
  CardEngine.cardInvoiceForPeriod(
    'card_1',
    '2026-09',
    purchases,
    cards
  );

assert.equal(september.total, 500);
assert.equal(september.count, 1);

const october =
  CardEngine.cardInvoiceForPeriod(
    'card_1',
    '2026-10',
    purchases,
    cards
  );

assert.equal(october.total, 100);
assert.equal(october.count, 1);

/* =========================================================
   6. PAGAMENTOS
   ========================================================= */

const paidLaunches = [
  {
    id: 'launch-paid',
    cardId: 'card_1',
    closingPeriodKey: '2026-09',
    payments: [{ amount: 500 }]
  }
];

assert.equal(
  CardEngine.invoiceAmountPaid(
    'card_1',
    '2026-09',
    500,
    paidLaunches
  ),
  500
);

assert.equal(
  CardEngine.invoiceStatus(500, 500),
  'Pago'
);

const partialLaunches = [
  {
    id: 'launch-partial',
    cardId: 'card_1',
    closingPeriodKey: '2026-09',
    payments: [
      { amount: 200 },
      { amount: 200 }
    ]
  }
];

assert.equal(
  CardEngine.invoiceAmountPaid(
    'card_1',
    '2026-09',
    500,
    partialLaunches
  ),
  400
);

assert.equal(
  CardEngine.invoiceStatus(400, 500),
  'Parcial'
);

/* Sem pagamentos */
assert.equal(
  CardEngine.invoiceAmountPaid(
    'card_1',
    '2026-09',
    500,
    []
  ),
  0
);

assert.equal(
  CardEngine.invoiceStatus(0, 500),
  'Pendente'
);

/* Compatibilidade com formato antigo de lançamento */
const legacyLaunches = [
  {
    id: 'launch-legacy',
    cardId: 'card_1',
    closingPeriodKey: '2026-09',
    amount: 500
  }
];

assert.equal(
  CardEngine.invoiceAmountPaid(
    'card_1',
    '2026-09',
    500,
    legacyLaunches
  ),
  500
);

/* Marcado como pago sem lançamento financeiro */
assert.equal(
  CardEngine.invoiceStatus(0, 500, true),
  'Pago'
);

/* =========================================================
   7. PAGAMENTO ACIMA DA FATURA
   ========================================================= */

const overpaidLaunches = [
  {
    id: 'launch-overpaid',
    cardId: 'card_1',
    closingPeriodKey: '2026-09',
    payments: [{ amount: 600 }]
  }
];

assert.equal(
  CardEngine.invoiceAmountPaid(
    'card_1',
    '2026-09',
    500,
    overpaidLaunches
  ),
  500
);

assert.equal(
  CardEngine.invoiceStatus(500, 500),
  'Pago'
);

/* =========================================================
   8. LIMITE
   ========================================================= */

const limit =
  CardEngine.calculateLimit(
    cards[0],
    purchases,
    cards,
    []
  );

assert.equal(limit.total, 2000);
assert.equal(limit.used, 1700);
assert.equal(limit.available, 300);
assert.equal(limit.excess, 0);

/* =========================================================
   9. LIMITE EXCEDIDO
   ========================================================= */

const exceeded =
  CardEngine.calculateLimit(
    cards[0],
    [{
      id: 'p-excess',
      cardId: 'card_1',
      date: '2026-09-05',
      paymentType: 'avista',
      totalValue: 2500
    }],
    cards,
    []
  );

assert.equal(exceeded.used, 2500);
assert.equal(exceeded.available, 0);
assert.equal(exceeded.excess, 500);

/* =========================================================
   10. CARTÃO SEM LIMITE
   ========================================================= */

const noLimitCard = {
  ...cards[0],
  id: 'card-no-limit',
  limit: 0
};

const noLimit =
  CardEngine.calculateLimit(
    noLimitCard,
    [],
    cards,
    []
  );

assert.equal(noLimit.total, 0);
assert.equal(noLimit.used, null);
assert.equal(noLimit.available, null);
assert.equal(noLimit.excess, 0);

/* =========================================================
   11. CARTÃO INEXISTENTE
   ========================================================= */

const missingCardPurchase = {
  id: 'missing-card',
  cardId: 'does-not-exist',
  date: '2026-09-05',
  paymentType: 'avista',
  totalValue: 100
};

assert.deepEqual(
  CardEngine.purchaseInstallmentOccurrences(
    missingCardPurchase,
    cardsById
  ),
  []
);

/* =========================================================
   12. ÓRFÃOS
   ========================================================= */

const orphans =
  CardEngine.auditOrphans(
    cards,
    [
      { id: 'ok', cardId: 'card_1' },
      { id: 'orphan', cardId: 'deleted' }
    ],
    [
      { id: 'ok2', cardId: 'card_1' },
      { id: 'orphan2', cardId: 'deleted' }
    ]
  );

assert.deepEqual(
  orphans.purchases,
  ['orphan']
);

assert.deepEqual(
  orphans.invoiceLaunches,
  ['orphan2']
);

/* =========================================================
   RESULTADO
   ========================================================= */

console.log('CARD ENGINE V3 TESTS: PASS');
