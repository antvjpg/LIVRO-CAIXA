/* C.O.D.E. — testes unitários dos oracles.
   Execução local (sem browser, sem rede): npm run code:oracles */
import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { accountBalance, banksBalance, patrimonio } = require('./balance.js');
const { ledgerSummary, expectedRows, entriesByDescription } = require('./movement.js');
const { parseBRL, formatBRL, round2 } = require('./money.js');
const { fixtures } = require('../fixtures/fixtures.js');

test('money: parse pt-BR e formatação', () => {
  assert.equal(parseBRL('R$ 1.000,00'), 1000);
  assert.equal(parseBRL('+ R$ 750,00'), 750);
  assert.equal(parseBRL('− 250,00'), -250);
  assert.equal(formatBRL(1000), '1.000,00');
  assert.equal(formatBRL(-250), '-250,00');
  assert.equal(round2(749.999), 750);
});

test('balance: saldo da conta = inicial + entradas − saídas', () => {
  const entries = [
    { id: 'e1', bank: 'b1', type: 'in', amount: 1000 },
    { id: 'e2', bank: 'b1', type: 'out', amount: 250 },
    { id: 'e3', bank: 'b2', type: 'in', amount: 999 },
  ];
  assert.equal(accountBalance({ initial: 0, entries }, 'b1'), 750);
  assert.equal(accountBalance({ initial: 50, entries }, 'b1'), 800);
  assert.equal(accountBalance({ initial: 0, entries }, 'b2'), 999);
});

test('balance: patrimônio soma contas + caixinhas + investimentos', () => {
  const banks = [{ id: 'b1', initial: 100 }];
  const entries = [
    { id: 'e1', bank: 'b1', type: 'in', amount: 400 },
    { id: 'e2', bank: 'b1', type: 'out', amount: 50 },
  ];
  const pockets = [{ id: 'p1', balance: 200 }];
  const investments = [{ id: 'i1', value: 300 }];
  assert.equal(banksBalance(banks, entries), 450);
  assert.equal(patrimonio({ banks, entries, pockets, investments }), 950);
});

test('oracle do cenário fixture: 0 + 1000 − 250 = 750', () => {
  const bank = { id: 'b1', initial: fixtures.bank.initial };
  const entries = [
    { id: 'e1', bank: 'b1', type: fixtures.movements.in.type, amount: fixtures.movements.in.amount },
    { id: 'e2', bank: 'b1', type: fixtures.movements.out.type, amount: fixtures.movements.out.amount },
  ];
  assert.equal(banksBalance([bank], entries), fixtures.expected.patrimonio);
  assert.equal(ledgerSummary(entries).net, fixtures.expected.patrimonio);
  assert.equal(ledgerSummary(entries).count, fixtures.expected.ledgerCount);
});

test('movement: linhas ordenadas por data desc e depois id desc', () => {
  const rows = expectedRows([
    { id: 'e1', date: '2026-09-27', desc: 'A', type: 'in', amount: 10 },
    { id: 'e2', date: '2026-09-27', desc: 'B', type: 'out', amount: 5 },
    { id: 'e3', date: '2026-09-26', desc: 'C', type: 'in', amount: 1 },
  ]);
  assert.deepEqual(rows.map((r) => r.desc), ['B', 'A', 'C']);
  assert.equal(rows[1].amount, 10);
  assert.equal(rows[0].amount, -5);
});

test('movement: filtro por descrição é exato', () => {
  const entries = [
    { id: 'e1', date: '2026-09-27', desc: fixtures.movements.in.desc, type: 'in', amount: 1000 },
    { id: 'e2', date: '2026-09-27', desc: 'outro', type: 'out', amount: 10 },
  ];
  assert.equal(entriesByDescription(entries, fixtures.movements.in.desc).length, 1);
  assert.equal(entriesByDescription(entries, fixtures.movements.in.desc)[0].amount, 1000);
  assert.equal(entriesByDescription(entries, 'inexistente').length, 0);
});
