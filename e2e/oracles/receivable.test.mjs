import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const {
  receivableAmount,
  receivableIsPending,
  receivableIsReceived,
  receivableIsCancelled,
  totalPending,
  totalReceived,
  totalCancelled,
  totalAll,
  pendingCount,
  receivedCount,
  cancelledCount,
} = require('./receivable.js');

test('receivable: amount é 0 quando ausente ou inválido', () => {
  assert.strictEqual(receivableAmount({}), 0);
  assert.strictEqual(receivableAmount(null), 0);
  assert.strictEqual(receivableAmount(undefined), 0);
  assert.strictEqual(receivableAmount({ amount: 'abc' }), 0);
  assert.strictEqual(receivableAmount({ amount: null }), 0);
});

test('receivable: amount retorna o valor numérico', () => {
  assert.strictEqual(receivableAmount({ amount: 100 }), 100);
  assert.strictEqual(receivableAmount({ amount: 250.50 }), 250.5);
  assert.strictEqual(receivableAmount({ amount: 0 }), 0);
});

test('receivable: status pendente/recebido/cancelado', () => {
  assert.strictEqual(receivableIsPending({ status: 'pendente' }), true);
  assert.strictEqual(receivableIsPending({ status: 'recebido' }), false);
  assert.strictEqual(receivableIsPending({ status: 'cancelado' }), false);
  assert.strictEqual(receivableIsPending({}), false);

  assert.strictEqual(receivableIsReceived({ status: 'recebido' }), true);
  assert.strictEqual(receivableIsReceived({ status: 'pendente' }), false);
  assert.strictEqual(receivableIsReceived({}), false);

  assert.strictEqual(receivableIsCancelled({ status: 'cancelado' }), true);
  assert.strictEqual(receivableIsCancelled({ status: 'pendente' }), false);
  assert.strictEqual(receivableIsCancelled({}), false);
});

test('receivable: lista vazia retorna zeros', () => {
  assert.strictEqual(totalPending([]), 0);
  assert.strictEqual(totalReceived([]), 0);
  assert.strictEqual(totalCancelled([]), 0);
  assert.strictEqual(totalAll([]), 0);
  assert.strictEqual(pendingCount([]), 0);
  assert.strictEqual(receivedCount([]), 0);
  assert.strictEqual(cancelledCount([]), 0);
});

test('receivable: total a receber soma só os pendentes', () => {
  const receivables = [
    { id: 'r1', person: 'Ana', desc: 'Venda 1', amount: 100, status: 'pendente' },
    { id: 'r2', person: 'Bob', desc: 'Venda 2', amount: 200, status: 'recebido' },
    { id: 'r3', person: 'Carol', desc: 'Venda 3', amount: 50, status: 'pendente' },
    { id: 'r4', person: 'Dan', desc: 'Venda 4', amount: 300, status: 'cancelado' },
  ];
  assert.strictEqual(totalPending(receivables), 150);
  assert.strictEqual(totalReceived(receivables), 200);
  assert.strictEqual(totalCancelled(receivables), 300);
  assert.strictEqual(totalAll(receivables), 650);
  assert.strictEqual(pendingCount(receivables), 2);
  assert.strictEqual(receivedCount(receivables), 1);
  assert.strictEqual(cancelledCount(receivables), 1);
});

test('receivable: todos pendentes → total a receber = total geral', () => {
  const receivables = [
    { id: 'r1', person: 'X', desc: 'A', amount: 50, status: 'pendente' },
    { id: 'r2', person: 'Y', desc: 'B', amount: 75, status: 'pendente' },
  ];
  assert.strictEqual(totalPending(receivables), 125);
  assert.strictEqual(totalAll(receivables), 125);
  assert.strictEqual(totalReceived(receivables), 0);
  assert.strictEqual(totalCancelled(receivables), 0);
});

test('receivable: arredondamento de 2 casas decimais', () => {
  const receivables = [
    { id: 'r1', person: 'X', desc: 'A', amount: 10.105, status: 'pendente' },
    { id: 'r2', person: 'Y', desc: 'B', amount: 20.104, status: 'pendente' },
  ];
  assert.strictEqual(totalPending(receivables), 30.21);
});

test('receivable: null/undefined como entrada não lança erro', () => {
  assert.strictEqual(totalPending(null), 0);
  assert.strictEqual(totalReceived(undefined), 0);
  assert.strictEqual(totalCancelled([]), 0);
  assert.strictEqual(totalAll(null), 0);
});
