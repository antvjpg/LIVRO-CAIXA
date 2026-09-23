const Engine = require('./card-engine-v3.js');

let passed = 0;
let failed = 0;

function assert(condition, name, details = '') {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    if (details) console.log(`   ${details}`);
  }
}

function money(value) {
  return Number(value.toFixed(2));
}

const cards = [
  {
    id: 'c1',
    limit: 2000,
    closingDay: 10,
    dueDay: 20
  }
];

console.log('\n========================================');
console.log(' CARD ENGINE V3 — AUDITORIA COMPLETA');
console.log('========================================\n');


/* =========================================================
   1. PERÍODOS / FECHAMENTO
   ========================================================= */

console.log('--- 1. PERÍODOS ---');

const card = cards[0];

assert(
  Engine.invoicePeriodKeyForDate(card, '2026-09-05') === '2026-09',
  'Compra antes do fechamento entra na fatura do mês'
);

assert(
  Engine.invoicePeriodKeyForDate(card, '2026-09-10') === '2026-09',
  'Compra no dia do fechamento entra na fatura do mês'
);

assert(
  Engine.invoicePeriodKeyForDate(card, '2026-09-11') === '2026-10',
  'Compra após o fechamento entra na próxima fatura'
);

assert(
  Engine.addMonthsToPeriodKey('2026-12', 1) === '2027-01',
  'Virada de dezembro para janeiro'
);

assert(
  Engine.addMonthsToPeriodKey('2027-01', -1) === '2026-12',
  'Retrocesso de janeiro para dezembro'
);

assert(
  Engine.invoicePeriodKeyForDate(card, 'data-invalida') === null,
  'Data inválida retorna null'
);


/* =========================================================
   2. PARCELAMENTO
   ========================================================= */

console.log('\n--- 2. PARCELAMENTO ---');

const installmentPurchase = {
  id: 'p-parcelado',
  cardId: 'c1',
  date: '2026-09-11',
  paymentType: 'parcelado',
  totalValue: 1200,
  totalInstallments: 12,
  installmentValue: 100,
  initialInstallment: 1
};

const installments = Engine.purchaseInstallmentOccurrences(
  installmentPurchase,
  new Map(cards.map(c => [c.id, c]))
);

assert(
  installments.length === 12,
  '12 parcelas são geradas'
);

assert(
  installments[0]?.cardId === 'c1',
  'Cada parcela mantém o cardId'
);

assert(
  installments[0]?.periodKey === '2026-10',
  'Primeira parcela entra na fatura correta'
);

assert(
  installments[1]?.periodKey === '2026-11',
  'Segunda parcela avança um mês'
);

assert(
  installments[11]?.periodKey === '2027-09',
  'Décima segunda parcela chega ao período correto'
);

assert(
  installments.every(x => x.amount === 100),
  'Todas as parcelas têm R$ 100'
);

assert(
  installments[0]?.installmentNumber === 1 &&
  installments[11]?.installmentNumber === 12,
  'Numeração das parcelas está correta'
);


/* =========================================================
   3. INITIAL INSTALLMENT
   ========================================================= */

console.log('\n--- 3. PARCELA INICIAL ---');

const purchaseStartingAt3 = {
  id: 'p-inicial-3',
  cardId: 'c1',
  date: '2026-09-11',
  paymentType: 'parcelado',
  totalValue: 1200,
  totalInstallments: 12,
  installmentValue: 100,
  initialInstallment: 3
};

const initial3 = Engine.purchaseInstallmentOccurrences(
  purchaseStartingAt3,
  new Map(cards.map(c => [c.id, c]))
);

assert(
  initial3.length === 10,
  'Parcela inicial 3 gera parcelas 3 até 12'
);

assert(
  initial3[0]?.installmentNumber === 3,
  'Primeira ocorrência é a parcela 3'
);

assert(
  initial3[0]?.periodKey === '2026-10',
  'Parcela inicial mantém o período-base'
);

assert(
  initial3[9]?.installmentNumber === 12,
  'Última ocorrência é a parcela 12'
);


/* =========================================================
   4. FATURAS
   ========================================================= */

console.log('\n--- 4. FATURAS ---');

const purchases = [
  {
    id: 'p1',
    cardId: 'c1',
    date: '2026-09-05',
    paymentType: 'avista',
    totalValue: 500
  },
  installmentPurchase
];

let payments = [];

let sept = Engine.invoiceState(
  'c1',
  '2026-09',
  purchases,
  cards,
  payments
);

let oct = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  payments
);

assert(
  sept.total === 500,
  'Fatura setembro totaliza R$ 500'
);

assert(
  oct.total === 100,
  'Fatura outubro totaliza R$ 100'
);

assert(
  sept.status === 'Pendente',
  'Fatura sem pagamento fica Pendente'
);

assert(
  oct.status === 'Pendente',
  'Fatura parcelada sem pagamento fica Pendente'
);


/* =========================================================
   5. PAGAMENTO PARCIAL
   ========================================================= */

console.log('\n--- 5. PAGAMENTO PARCIAL ---');

payments = [
  {
    id: 'pay1',
    cardId: 'c1',
    closingPeriodKey: '2026-09',
    amount: 200
  }
];

sept = Engine.invoiceState(
  'c1',
  '2026-09',
  purchases,
  cards,
  payments
);

assert(
  sept.paid === 200,
  'Pagamento parcial é reconhecido'
);

assert(
  sept.remaining === 300,
  'Saldo restante fica em R$ 300'
);

assert(
  sept.status === 'Parcial',
  'Fatura parcial fica Parcial'
);


/* =========================================================
   6. SEGUNDO PAGAMENTO
   ========================================================= */

console.log('\n--- 6. MÚLTIPLOS PAGAMENTOS ---');

payments.push({
  id: 'pay2',
  cardId: 'c1',
  closingPeriodKey: '2026-09',
  amount: 300
});

sept = Engine.invoiceState(
  'c1',
  '2026-09',
  purchases,
  cards,
  payments
);

assert(
  sept.paid === 500,
  'Dois pagamentos são somados'
);

assert(
  sept.remaining === 0,
  'Saldo chega a zero'
);

assert(
  sept.status === 'Pago',
  'Fatura totalmente paga fica Pago'
);


/* =========================================================
   7. PAGAMENTO ACIMA DA FATURA
   ========================================================= */

console.log('\n--- 7. EXCESSO DE PAGAMENTO ---');

const invalidOverpayment = Engine.validatePayment(
  'c1',
  '2026-10',
  500,
  purchases,
  cards,
  payments
);

assert(
  invalidOverpayment.valid === false,
  'Pagamento acima da fatura é rejeitado'
);

assert(
  invalidOverpayment.reason === 'payment_exceeds_invoice',
  'Motivo correto para pagamento excedente'
);


/* =========================================================
   8. PAGAMENTO NEGATIVO / ZERO
   ========================================================= */

console.log('\n--- 8. VALORES INVÁLIDOS ---');

const invalidZero = Engine.validatePayment(
  'c1',
  '2026-10',
  0,
  purchases,
  cards,
  payments
);

assert(
  invalidZero.valid === false &&
  invalidZero.reason === 'invalid_amount',
  'Pagamento zero é rejeitado'
);

const invalidNegative = Engine.validatePayment(
  'c1',
  '2026-10',
  -50,
  purchases,
  cards,
  payments
);

assert(
  invalidNegative.valid === false &&
  invalidNegative.reason === 'invalid_amount',
  'Pagamento negativo é rejeitado'
);


/* =========================================================
   9. PAGAMENTO DE FATURA VAZIA
   ========================================================= */

console.log('\n--- 9. FATURA VAZIA ---');

const emptyInvoice = Engine.validatePayment(
  'c1',
  '2025-01',
  100,
  purchases,
  cards,
  payments
);

assert(
  emptyInvoice.valid === false &&
  emptyInvoice.reason === 'empty_invoice',
  'Pagamento de fatura vazia é rejeitado'
);


/* =========================================================
   10. MARKED PAID ONLY
   ========================================================= */

console.log('\n--- 10. MARKED PAID ONLY ---');

payments = [
  {
    id: 'paid-only',
    cardId: 'c1',
    closingPeriodKey: '2026-10',
    markedPaidOnly: true,
    amount: 0
  }
];

oct = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  payments
);

assert(
  oct.markedPaidOnly === true,
  'markedPaidOnly é identificado'
);

assert(
  oct.paid === 0,
  'markedPaidOnly não vira pagamento financeiro'
);

assert(
  oct.status === 'Pago',
  'markedPaidOnly mantém status Pago'
);


/* =========================================================
   11. markedPaidOnly NÃO LIBERA LIMITE
   ========================================================= */

console.log('\n--- 11. LIMITE + MARKED PAID ONLY ---');

const beforeMarked = Engine.calculateLimit(
  card,
  purchases,
  cards,
  []
);

const afterMarked = Engine.calculateLimit(
  card,
  purchases,
  cards,
  payments
);

assert(
  beforeMarked.used === afterMarked.used,
  'markedPaidOnly não libera limite'
);


/* =========================================================
   12. PAGAMENTO LIBERA LIMITE
   ========================================================= */

console.log('\n--- 12. LIBERAÇÃO DE LIMITE ---');

payments = [
  {
    id: 'pay-sept',
    cardId: 'c1',
    closingPeriodKey: '2026-09',
    amount: 500
  }
];

const limitAfterPayment = Engine.calculateLimit(
  card,
  purchases,
  cards,
  payments
);

assert(
  limitAfterPayment.used === 1200,
  'Pagamento da fatura libera exatamente o valor pago'
);

assert(
  limitAfterPayment.available === 800,
  'Limite disponível fica R$ 800'
);


/* =========================================================
   13. PAGAMENTO NÃO CONTAMINA OUTRA FATURA
   ========================================================= */

console.log('\n--- 13. ISOLAMENTO ENTRE FATURAS ---');

payments.push({
  id: 'pay-oct',
  cardId: 'c1',
  closingPeriodKey: '2026-10',
  amount: 50
});

const septAfterOctPayment = Engine.invoiceState(
  'c1',
  '2026-09',
  purchases,
  cards,
  payments
);

const octAfterPayment = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  payments
);

assert(
  septAfterOctPayment.paid === 500,
  'Pagamento de outubro não altera setembro'
);

assert(
  octAfterPayment.paid === 50,
  'Pagamento de outubro fica somente em outubro'
);


/* =========================================================
   14. LEGADO amount
   ========================================================= */

console.log('\n--- 14. COMPATIBILIDADE LEGADA ---');

const legacyPayments = [
  {
    id: 'legacy',
    cardId: 'c1',
    closingPeriodKey: '2026-10',
    amount: 25
  }
];

const legacyInvoice = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  legacyPayments
);

assert(
  legacyInvoice.paid === 25,
  'Formato legado amount continua reconhecido'
);


/* =========================================================
   15. PAYMENTS[]
   ========================================================= */

console.log('\n--- 15. PAYMENTS[] ---');

const structuredPayments = [
  {
    id: 'launch',
    cardId: 'c1',
    closingPeriodKey: '2026-10',
    payments: [
      { id: 'a', amount: 30 },
      { id: 'b', amount: 20 }
    ]
  }
];

const structuredInvoice = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  structuredPayments
);

assert(
  structuredInvoice.paid === 50,
  'payments[] é somado corretamente'
);

assert(
  structuredInvoice.paymentCount === 1,
  'Launch financeiro é contado corretamente'
);


/* =========================================================
   16. VALORES NEGATIVOS EM PAYMENTS[]
   ========================================================= */

console.log('\n--- 16. PAGAMENTO NEGATIVO INTERNO ---');

const negativePayment = [
  {
    id: 'negative',
    cardId: 'c1',
    closingPeriodKey: '2026-10',
    payments: [
      { amount: -100 },
      { amount: 40 }
    ]
  }
];

const negativeInvoice = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  negativePayment
);

assert(
  negativeInvoice.paid === 40,
  'Valores negativos internos não reduzem o pagamento'
);


/* =========================================================
   17. PAGAMENTO ACIMA DO TOTAL NÃO INFLA PAID
   ========================================================= */

console.log('\n--- 17. CAP DE PAGAMENTO ---');

const hugePayment = [
  {
    id: 'huge',
    cardId: 'c1',
    closingPeriodKey: '2026-10',
    amount: 9999
  }
];

const cappedInvoice = Engine.invoiceState(
  'c1',
  '2026-10',
  purchases,
  cards,
  hugePayment
);

assert(
  cappedInvoice.paid === cappedInvoice.total,
  'Pago nunca ultrapassa o total da fatura'
);


/* =========================================================
   18. CARTÃO INEXISTENTE
   ========================================================= */

console.log('\n--- 18. CARTÃO INEXISTENTE ---');

const missingCardPurchase = {
  id: 'orphan-purchase',
  cardId: 'nao-existe',
  date: '2026-09-05',
  paymentType: 'avista',
  totalValue: 100
};

const missingInstallments =
  Engine.purchaseInstallmentOccurrences(
    missingCardPurchase,
    new Map(cards.map(c => [c.id, c]))
  );

assert(
  missingInstallments.length === 0,
  'Compra sem cartão válido não gera parcelas'
);


/* =========================================================
   19. ORPHANS
   ========================================================= */

console.log('\n--- 19. ÓRFÃOS ---');

const orphanAudit = Engine.auditOrphans(
  cards,
  [
    ...purchases,
    missingCardPurchase
  ],
  [
    {
      id: 'valid-launch',
      cardId: 'c1'
    },
    {
      id: 'orphan-launch',
      cardId: 'nao-existe'
    }
  ]
);

assert(
  orphanAudit.purchases.includes('orphan-purchase'),
  'Auditoria encontra compra órfã'
);

assert(
  orphanAudit.invoiceLaunches.includes('orphan-launch'),
  'Auditoria encontra fatura órfã'
);


/* =========================================================
   20. EXCESSO DE LIMITE
   ========================================================= */

console.log('\n--- 20. EXCESSO DE LIMITE ---');

const excessPurchases = [
  {
    id: 'big',
    cardId: 'c1',
    date: '2026-09-05',
    paymentType: 'avista',
    totalValue: 2500
  }
];

const excess = Engine.calculateLimit(
  card,
  excessPurchases,
  cards,
  []
);

assert(
  excess.used === 2500,
  'Uso pode ultrapassar o limite'
);

assert(
  excess.available === 0,
  'Disponível é limitado a zero'
);

assert(
  excess.excess === 500,
  'Excesso é separado corretamente'
);


/* =========================================================
   RESULTADO
   ========================================================= */

console.log('\n========================================');
console.log(' RESULTADO DA AUDITORIA');
console.log('========================================');
console.log(`PASS: ${passed}`);
console.log(`FAIL: ${failed}`);
console.log(`TOTAL: ${passed + failed}`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
