import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const { pocketBalance, pocketProgress, progressLabel, pocketsTotal } = require('./pocket.js');
const { fixtures } = require('../fixtures/fixtures.js');

const p = fixtures.pockets;

test('caixinha: saldo é apenas o valor inicial sem movimentações', () => {
  assert.strictEqual(pocketBalance({ initial: 100, movements: [] }), 100);
  assert.strictEqual(pocketBalance({ initial: 0, movements: [] }), 0);
  assert.strictEqual(pocketBalance({}), 0);
});

test('caixinha: aportes e rendimentos somam, resgates subtraem', () => {
  const movements = [
    { kind: 'aporte', amount: 150 },
    { kind: 'aporte', amount: 20 },
    { kind: 'resgate', amount: 50 },
    { kind: 'rendimento', amount: 10.5 },
  ];
  assert.strictEqual(pocketBalance({ initial: 100, movements }), 230.5);
});

test('caixinha: casas decimais são arredondadas em 2 casas', () => {
  const saldo = pocketBalance({ initial: 0.1, movements: [{ kind: 'aporte', amount: 0.2 }] });
  assert.strictEqual(saldo, 0.3);
});

test('caixinha: progresso sem objetivo é nulo', () => {
  assert.strictEqual(pocketProgress(230.5, 0), null);
  assert.strictEqual(pocketProgress(230.5, null), null);
  assert.strictEqual(progressLabel(230.5, 0), null);
});

test('caixinha: progresso parcial segue a razão saldo/objetivo', () => {
  assert.strictEqual(pocketProgress(230.5, 500), 46.1);
  assert.strictEqual(progressLabel(230.5, 500), '46%');
  assert.strictEqual(progressLabel(430.5, 800), '54%');
});

test('caixinha: progresso é limitado a 100% e não fica negativo', () => {
  assert.strictEqual(pocketProgress(1000, 250), 100);
  assert.strictEqual(progressLabel(1000, 250), '100%');
  assert.strictEqual(pocketProgress(-10, 250), 0);
  assert.strictEqual(progressLabel(-10, 250), '0%');
});

test('caixinha: total soma os saldos de todas as caixinhas', () => {
  const total = pocketsTotal([
    { initial: p.c1.initial, movements: p.movements },
    { initial: p.c2.initial, movements: [] },
  ]);
  assert.strictEqual(total, p.expected.total);
  assert.strictEqual(pocketsTotal([]), 0);
});
