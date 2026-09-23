'use strict';

const Adapter = require('./card-adapter.js');

const cards = [{
  id: 'card-1',
  name: 'Cartão Teste',
  closingDay: 10,
  dueDay: 20,
  limit: 2000
}];

const purchases = [
  {
    id: 'p1',
    cardId: 'card-1',
    description: 'Compra João',
    totalValue: 600,
    date: '2026-09-05',
    titular: 'João',
    paymentType: 'avista'
  },
  {
    id: 'p2',
    cardId: 'card-1',
    description: 'Compra Maria',
    totalValue: 400,
    date: '2026-09-06',
    titular: 'Maria',
    paymentType: 'avista'
  }
];

let invoiceLaunches = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

console.log('\n=== TESTE CARD ADAPTER — TITULARES ===');

const lines = Adapter.invoiceLines(
  'card-1',
  '2026-09',
  purchases,
  cards
);

assert(Array.isArray(lines), 'invoiceLines retorna array');
assert(lines.length === 2, 'fatura possui 2 linhas');
assert(
  Math.abs(Adapter.invoiceTotal('card-1', '2026-09', purchases, cards) - 1000) < 0.004,
  'total da fatura = R$ 1.000'
);

const groups = Adapter.invoiceByTitular(
  'card-1',
  '2026-09',
  purchases,
  cards
);

assert(groups.length === 2, 'existem 2 titulares');

const joao = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'João',
  purchases,
  cards,
  invoiceLaunches
);

const maria = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'Maria',
  purchases,
  cards,
  invoiceLaunches
);

assert(joao.total === 600, 'João = R$ 600');
assert(maria.total === 400, 'Maria = R$ 400');
assert(joao.paid === 0, 'João inicialmente não pago');
assert(maria.paid === 0, 'Maria inicialmente não paga');

console.log('\n=== TESTE DE VALIDAÇÃO POR TITULAR ===');

let result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'João',
  600,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === true, 'João pode pagar R$ 600');

result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'João',
  601,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === false, 'João não pode pagar R$ 601');
assert(
  result.reason === 'payment_exceeds_titular_invoice',
  'motivo do excesso por titular está correto'
);

result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'Maria',
  400,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === true, 'Maria pode pagar R$ 400');

console.log('\n=== RESULTADO ===');
console.log('ADAPTER TESTE: PASS');

console.log('\n=== TESTE DE PAGAMENTO PARCIAL POR TITULAR ===');

invoiceLaunches = [{
  id: Adapter.launchId('card-1', '2026-09', 'João'),
  cardId: 'card-1',
  closingPeriodKey: '2026-09',
  titular: 'João',
  payments: [
    {
      entryId: 'entry-joao-1',
      amount: 400,
      date: '2026-09-20'
    }
  ]
}];

const joaoPartial = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'João',
  purchases,
  cards,
  invoiceLaunches
);

const mariaUnpaid = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'Maria',
  purchases,
  cards,
  invoiceLaunches
);

assert(joaoPartial.paid === 400, 'João pago = R$ 400');
assert(joaoPartial.remaining === 200, 'João restante = R$ 200');
assert(mariaUnpaid.paid === 0, 'Maria continua com R$ 0 pago');
assert(mariaUnpaid.remaining === 400, 'Maria continua devendo R$ 400');

result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'João',
  200,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === true, 'João pode pagar os R$ 200 restantes');

result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'João',
  201,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === false, 'João não pode pagar R$ 201 após pagar R$ 400');

result = Adapter.validatePayment(
  'card-1',
  '2026-09',
  'Maria',
  400,
  purchases,
  cards,
  invoiceLaunches
);

assert(result.valid === true, 'Maria ainda pode pagar R$ 400');

console.log('\n=== TESTE DE MÚLTIPLOS PAGAMENTOS ===');

invoiceLaunches = [{
  id: Adapter.launchId('card-1', '2026-09', 'João'),
  cardId: 'card-1',
  closingPeriodKey: '2026-09',
  titular: 'João',
  payments: [
    { entryId: 'entry-1', amount: 250, date: '2026-09-15' },
    { entryId: 'entry-2', amount: 150, date: '2026-09-20' }
  ]
}];

const joaoMultiple = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'João',
  purchases,
  cards,
  invoiceLaunches
);

assert(joaoMultiple.paid === 400, 'múltiplos pagamentos somam R$ 400');
assert(joaoMultiple.remaining === 200, 'restante após múltiplos pagamentos = R$ 200');

console.log('\n=== TESTE MARKED PAID ONLY ===');

invoiceLaunches = [{
  id: Adapter.launchId('card-1', '2026-09', 'Maria'),
  cardId: 'card-1',
  closingPeriodKey: '2026-09',
  titular: 'Maria',
  markedPaidOnly: true,
  amount: 0,
  payments: []
}];

const mariaMarked = Adapter.titularInvoice(
  'card-1',
  '2026-09',
  'Maria',
  purchases,
  cards,
  invoiceLaunches
);

assert(mariaMarked.paid === 0, 'markedPaidOnly não vira pagamento financeiro');
assert(mariaMarked.remaining === 400, 'markedPaidOnly não reduz o saldo');
assert(mariaMarked.markedPaidOnly === true, 'markedPaidOnly preservado');

console.log('\n=== RESULTADO FINAL ===');
console.log('ADAPTER PAGAMENTOS: PASS');
