const CardEngine = require('./card-engine-v3.js');

const cards = [{
  id: 'card-1',
  name: 'Cartão Principal',
  limit: 2000,
  closingDay: 10,
  dueDay: 20,
  active: true
}];

let purchases = [
  {
    id: 'p1',
    cardId: 'card-1',
    date: '2026-09-05',
    paymentType: 'avista',
    totalValue: 500
  },
  {
    id: 'p2',
    cardId: 'card-1',
    date: '2026-09-11',
    paymentType: 'parcelado',
    totalValue: 1200,
    totalInstallments: 12,
    installmentValue: 100,
    initialInstallment: 1
  }
];

function money(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

function showInvoices() {
  for (const period of ['2026-09', '2026-10', '2026-11']) {
    const invoice = CardEngine.cardInvoiceForPeriod(
      'card-1',
      period,
      purchases,
      cards
    );

    console.log(
      `${period}: ${money(invoice.total)}`
    );
  }
}

function showLimit(label, launches = []) {
  const result = CardEngine.calculateLimit(
    cards[0],
    purchases,
    cards,
    launches
  );

  console.log(`\n${label}`);
  console.log(`  Usado:      ${money(result.used)}`);
  console.log(`  Disponível: ${money(result.available)}`);
  console.log(`  Excesso:    ${money(result.excess)}`);
}

console.log(`
========================================
 CARD ENGINE — TESTE DE ALOCAÇÃO
========================================
`);

console.log('\nESTADO INICIAL');
showInvoices();
showLimit('Limite inicial');

console.log(`
----------------------------------------
TESTE 1
Pagamento de R$ 400 na fatura de SETEMBRO
----------------------------------------
`);

let launches = [{
  id: 'pay-september',
  cardId: 'card-1',
  closingPeriodKey: '2026-09',
  titular: 'Titular',
  amount: 400
}];

showLimit(
  'Resultado atual do engine',
  launches
);

console.log(`
O engine atual entende:

  Compras comprometidas: R$ 1.700
  Pagamentos:              R$   400
  Usado:                   R$ 1.300

Isso está correto neste cenário.
`);

console.log(`
----------------------------------------
TESTE 2
Agora adicionamos pagamento de R$ 100
na fatura de OUTUBRO.
----------------------------------------
`);

launches.push({
  id: 'pay-october',
  cardId: 'card-1',
  closingPeriodKey: '2026-10',
  titular: 'Titular',
  amount: 100
});

showLimit(
  'Resultado atual do engine',
  launches
);

console.log(`
Problema que precisamos eliminar:

O engine sabe que houve R$ 500 em pagamentos,
mas não usa a relação:

  pagamento → fatura → parcela → compromisso

Ele apenas subtrai R$ 500 do total comprometido.
`);

console.log(`
----------------------------------------
TESTE 3
Pagamento maior que a fatura específica
----------------------------------------
`);

const invalidPayment = CardEngine.validatePayment(
  'card-1',
  '2026-10',
  500,
  purchases,
  cards,
  launches
);

console.log('Resultado da validação:');
console.log(invalidPayment);

showLimit(
  'Estado após tentativa inválida — deve permanecer igual',
  launches
);

console.log(`
Comportamento esperado:

valid: false
reason: payment_exceeds_invoice

A tentativa de R$ 500 NÃO deve alterar:
- pagamentos registrados
- saldo da fatura de outubro
- limite usado
- limite disponível

O excesso também NÃO deve liberar limite de outra fatura.
`);

console.log(`
----------------------------------------
TESTE 4
Duas faturas independentes
----------------------------------------
`);

console.log(`
SETEMBRO
  Fatura: R$ 500
  Pago:   R$ 400
  Restam: R$ 100

OUTUBRO
  Fatura: R$ 100
  Pago:   R$ 100
  Restam: R$ 0

NOVEMBRO
  Fatura: R$ 100
  Pago:   R$ 0
  Restam: R$ 100

A arquitetura nova precisa preservar
essas três situações independentemente.
`);

console.log(`
========================================
 TESTE V3 CONCLUÍDO
========================================
`);
