import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const {
  goalRemaining,
  goalProgressPercent,
  goalProgressLabel,
  goalStatusLabel,
  goalSaveStatus,
  goalDaysRemaining,
  goalDeadlineLabel,
} = require('./goal.js');
const { fixtures } = require('../fixtures/fixtures.js');

const g = fixtures.goals;

test('meta: restante é alvo − atual e nunca fica negativo', () => {
  assert.strictEqual(goalRemaining(1000, 0), 1000);
  assert.strictEqual(goalRemaining(600, 300), 300);
  assert.strictEqual(goalRemaining(1000, 1500), 0);
  assert.strictEqual(goalRemaining(0, 0), 0);
});

test('meta: progresso segue a razão atual/alvo com limites 0..100', () => {
  assert.strictEqual(goalProgressPercent(1000, 750), 75);
  assert.strictEqual(goalProgressLabel(400, 100), '25%');
  assert.strictEqual(goalProgressLabel(400, 200), '50%');
  assert.strictEqual(goalProgressLabel(1200, 600), '50%');
  assert.strictEqual(goalProgressLabel(2000, 1000), '50%');
  assert.strictEqual(goalProgressLabel(1000, 1000), '100%');
  assert.strictEqual(goalProgressLabel(1000, 5000), '100%');
  assert.strictEqual(goalProgressLabel(1000, 0), '0%');
  assert.strictEqual(goalProgressPercent(0, 500), 0);
});

test('meta: valores esperados das fixtures batem com o oracle', () => {
  const e = g.expected;
  for (const [key, exp] of Object.entries(e)) {
    if (!/m\d/.test(key)) continue;
    assert.strictEqual(goalRemaining(exp.target, exp.current), exp.remaining, `${key}: restante`);
    assert.strictEqual(goalProgressLabel(exp.target, exp.current), exp.percent, `${key}: progresso`);
  }
  assert.strictEqual(goalRemaining(g.expected.bankBalanceAfterTopUp, 1000), 0);
  assert.strictEqual(goalProgressLabel(g.m3.target, g.expected.m3.current), '75%');
});

test('meta: rótulos de status', () => {
  assert.strictEqual(goalStatusLabel('active'), 'Ativa');
  assert.strictEqual(goalStatusLabel('completed'), 'Concluída');
  assert.strictEqual(goalStatusLabel('paused'), 'Pausada');
  assert.strictEqual(goalStatusLabel('cancelled'), 'Cancelada');
  assert.strictEqual(goalStatusLabel(undefined), 'Ativa');
});

test('meta: ao salvar, vinculada no alvo conclui; sem fonte nunca conclui', () => {
  assert.strictEqual(
    goalSaveStatus('active', { target: 1000, current: 1000, linked: true }),
    'completed'
  );
  assert.strictEqual(
    goalSaveStatus('active', { target: 1000, current: 1000, linked: false }),
    'active'
  );
  assert.strictEqual(
    goalSaveStatus('active', { target: 1000, current: 750, linked: true }),
    'active'
  );
});

test('meta: ao salvar, Concluída abaixo do alvo reabre como Ativa', () => {
  assert.strictEqual(
    goalSaveStatus('completed', { target: 2000, current: 1000, linked: true }),
    'active'
  );
  assert.strictEqual(
    goalSaveStatus('paused', { target: 1000, current: 1000, linked: true }),
    'paused'
  );
  assert.strictEqual(
    goalSaveStatus('cancelled', { target: 500, current: 900, linked: true }),
    'cancelled'
  );
});

test('meta: dias restantes e rótulo de prazo', () => {
  assert.strictEqual(goalDaysRemaining('2026-09-29', '2026-10-29'), 30);
  assert.strictEqual(goalDaysRemaining('2026-09-29', '2026-09-29'), 0);
  assert.strictEqual(goalDaysRemaining('2026-09-29', '2026-09-20'), -9);
  assert.strictEqual(goalDaysRemaining('2026-09-29', ''), null);
  assert.strictEqual(goalDeadlineLabel('2026-10-29'), '29/10/2026');
  assert.strictEqual(goalDeadlineLabel(''), null);
});
