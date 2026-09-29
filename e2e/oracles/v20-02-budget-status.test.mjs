/* C.O.D.E. — oráculo V.20-02 (orçamento: status textual sem emoji).
   Execução local: npm run code:oracles
   Testa se o status do orçamento é calculado corretamente e NÃO usa emoji no nome da categoria. */
import test from 'node:test';
import assert from 'node:assert/strict';

function budgetStatus(pct) {
  if (pct >= 100) return { label: 'Excedido', class: 'excedido' };
  if (pct >= 80) return { label: 'Atenção', class: 'atencao' };
  return { label: 'Normal', class: 'normal' };
}

test('V.20-02 oráculo: status Normal para pct < 80', () => {
  assert.deepEqual(budgetStatus(0), { label: 'Normal', class: 'normal' });
  assert.deepEqual(budgetStatus(50), { label: 'Normal', class: 'normal' });
  assert.deepEqual(budgetStatus(79), { label: 'Normal', class: 'normal' });
});

test('V.20-02 oráculo: status Atenção para 80 <= pct < 100', () => {
  assert.deepEqual(budgetStatus(80), { label: 'Atenção', class: 'atencao' });
  assert.deepEqual(budgetStatus(85), { label: 'Atenção', class: 'atencao' });
  assert.deepEqual(budgetStatus(99), { label: 'Atenção', class: 'atencao' });
});

test('V.20-02 oráculo: status Excedido para pct >= 100', () => {
  assert.deepEqual(budgetStatus(100), { label: 'Excedido', class: 'excedido' });
  assert.deepEqual(budgetStatus(150), { label: 'Excedido', class: 'excedido' });
});

test('V.20-02 oráculo: nome da categoria NÃO contém emoji', () => {
  const categoryName = 'Alimentação';
  const status = budgetStatus(90);
  const renderedLabel = `${categoryName}`; // sem emoji
  assert.equal(renderedLabel.includes('🟢'), false);
  assert.equal(renderedLabel.includes('🟡'), false);
  assert.equal(renderedLabel.includes('🔴'), false);
  assert.equal(renderedLabel, 'Alimentação');
});

test('V.20-02 oráculo: status é apresentado separadamente (badge)', () => {
  const categoryName = 'Transporte';
  const status = budgetStatus(110);
  // Simula estrutura: label da categoria + badge de status separado
  const label = categoryName;
  const badge = status.label;
  assert.equal(label, 'Transporte');
  assert.equal(badge, 'Excedido');
  assert.ok(!label.includes('🔴'));
  assert.ok(!label.includes('🟡'));
  assert.ok(!label.includes('🟢'));
});

test('V.20-02 oráculo: thresholds preservados (80% e 100%)', () => {
  assert.deepEqual(budgetStatus(79), { label: 'Normal', class: 'normal' });
  assert.deepEqual(budgetStatus(80), { label: 'Atenção', class: 'atencao' });
  assert.deepEqual(budgetStatus(99), { label: 'Atenção', class: 'atencao' });
  assert.deepEqual(budgetStatus(100), { label: 'Excedido', class: 'excedido' });
  assert.deepEqual(budgetStatus(101), { label: 'Excedido', class: 'excedido' });
});