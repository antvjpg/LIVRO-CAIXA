import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const {
  bankInitial,
  accountBalance,
  banksBalance,
  banksCount,
  bankNames,
} = require('./bank.js');

test('bank: initial é 0 quando ausente ou inválido', () => {
  assert.strictEqual(bankInitial({}), 0);
  assert.strictEqual(bankInitial(null), 0);
  assert.strictEqual(bankInitial(undefined), 0);
  assert.strictEqual(bankInitial({ initial: 'abc' }), 0);
  assert.strictEqual(bankInitial({ initial: null }), 0);
});

test('bank: initial retorna o valor numérico', () => {
  assert.strictEqual(bankInitial({ initial: 1000 }), 1000);
  assert.strictEqual(bankInitial({ initial: 500.75 }), 500.75);
  assert.strictEqual(bankInitial({ initial: 0 }), 0);
});

test('bank: saldo de conta sem lançamentos é o initial', () => {
  assert.strictEqual(accountBalance({ initial: 1000, entries: [] }, 'b1'), 1000);
  assert.strictEqual(accountBalance({ initial: 0, entries: [] }, 'b1'), 0);
  assert.strictEqual(accountBalance({}, 'b1'), 0);
});

test('bank: saldo soma entradas e subtrai saídas', () => {
  const entries = [
    { id: 'e1', bank: 'b1', type: 'in', desc: 'Salário', amount: 1000 },
    { id: 'e2', bank: 'b1', type: 'out', desc: 'Supermercado', amount: 250 },
    { id: 'e3', bank: 'b1', type: 'in', desc: 'Freelance', amount: 300 },
    { id: 'e4', bank: 'b1', type: 'out', desc: 'Conta de luz', amount: 150 },
  ];
  assert.strictEqual(accountBalance({ initial: 500, entries }, 'b1'), 1400);
});

test('bank: saldo filtra por bankId', () => {
  const entries = [
    { id: 'e1', bank: 'b1', type: 'in', desc: 'Conta A', amount: 1000 },
    { id: 'e2', bank: 'b2', type: 'in', desc: 'Conta B', amount: 500 },
    { id: 'e3', bank: 'b1', type: 'out', desc: 'Saque A', amount: 200 },
  ];
  assert.strictEqual(accountBalance({ initial: 0, entries }, 'b1'), 800);
  assert.strictEqual(accountBalance({ initial: 0, entries }, 'b2'), 500);
  assert.strictEqual(accountBalance({ initial: 0, entries }, 'b3'), 0);
});

test('bank: entries sem bank não são atribuídas a nenhuma conta', () => {
  const entries = [
    { id: 'e1', type: 'in', desc: 'Sem banco', amount: 100 },
  ];
  assert.strictEqual(accountBalance({ initial: 0, entries }, 'b1'), 0);
});

test('bank: banksBalance soma o saldo de todas as contas', () => {
  const banks = [
    { id: 'b1', name: 'Banco A', initial: 1000 },
    { id: 'b2', name: 'Banco B', initial: 500 },
  ];
  const entries = [
    { id: 'e1', bank: 'b1', type: 'out', amount: 200 },
    { id: 'e2', bank: 'b2', type: 'in', amount: 100 },
  ];
  assert.strictEqual(banksBalance(banks, entries), 1400); // (1000-200) + (500+100) = 800 + 600
});

test('bank: banksBalance com lista vazia retorna 0', () => {
  assert.strictEqual(banksBalance([], []), 0);
  assert.strictEqual(banksBalance([], null), 0);
  assert.strictEqual(banksBalance(null, []), 0);
});

test('bank: banksCount conta o número de bancos', () => {
  assert.strictEqual(banksCount([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]), 3);
  assert.strictEqual(banksCount([]), 0);
  assert.strictEqual(banksCount(null), 0);
});

test('bank: bankNames retorna os nomes dos bancos', () => {
  const banks = [
    { id: 'b1', name: 'Nubank' },
    { id: 'b2', name: 'XP Investimentos' },
    { id: 'b3', name: 'Itaú' },
  ];
  assert.deepEqual(bankNames(banks), ['Nubank', 'XP Investimentos', 'Itaú']);
  assert.deepEqual(bankNames([]), []);
  assert.deepEqual(bankNames(null), []);
});
