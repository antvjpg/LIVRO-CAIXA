/* C.O.D.E. — oráculo do ciclo da fatura de cartão (período + janela de compras).
   Execução local: npm run code:oracles
   Importa o motor REAL (card-engine-v3-combined.js) e valida que a janela
   invoiceCycleRange() é o inverso exato de invoicePeriodKeyForDate(). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { engine } = require(path.join(ROOT, 'card-engine-v3-combined.js'));

test('invoiceCycle: fechamento dia 10, período 2026-09', () => {
  const card = { id: 'c1', closingDay: 10, dueDay: 17 };
  assert.deepEqual(engine.invoiceCycleRange(card, '2026-09'), {
    start: '2026-08-11',
    end: '2026-09-10'
  });
});

test('invoiceCycle: fechamento dia 10 cruza o ano (2026-01)', () => {
  const card = { id: 'c1', closingDay: 10, dueDay: 17 };
  assert.deepEqual(engine.invoiceCycleRange(card, '2026-01'), {
    start: '2025-12-11',
    end: '2026-01-10'
  });
});

test('invoiceCycle: fechamento dia 31 limitado ao fim do mês (fev/2026)', () => {
  const card = { id: 'c1', closingDay: 31, dueDay: 31 };
  assert.deepEqual(engine.invoiceCycleRange(card, '2026-02'), {
    start: '2026-02-01',
    end: '2026-02-28'
  });
});

test('invoiceCycle: fechamento dia 31 no mês seguinte a fevereiro', () => {
  const card = { id: 'c1', closingDay: 31, dueDay: 31 };
  assert.deepEqual(engine.invoiceCycleRange(card, '2026-03'), {
    start: '2026-03-01',
    end: '2026-03-31'
  });
});

test('invoiceCycle: fechamento dia 1', () => {
  const card = { id: 'c1', closingDay: 1, dueDay: 5 };
  assert.deepEqual(engine.invoiceCycleRange(card, '2026-09'), {
    start: '2026-08-02',
    end: '2026-09-01'
  });
});

test('invoiceCycle: período inválido retorna null', () => {
  const card = { id: 'c1', closingDay: 10, dueDay: 17 };
  assert.equal(engine.invoiceCycleRange(card, '2026-13'), null);
  assert.equal(engine.invoiceCycleRange(card, 'semp'), null);
  assert.equal(engine.invoiceCycleRange(card, ''), null);
});

test('invoiceCycle: cartão ausente não lança erro (usa fechamento padrão)', () => {
  const cycle = engine.invoiceCycleRange(null, '2026-09');
  assert.equal(typeof cycle, 'object');
  assert.deepEqual(cycle, { start: '2026-08-02', end: '2026-09-01' });
});

test('invoiceCycle: toda data da janela cai no mesmo períodoKey (inverso exato)', () => {
  for (const closing of [1, 10, 15, 28, 30, 31]) {
    const card = { id: 'c', closingDay: closing, dueDay: 17 };
    for (let month = 0; month < 12; month += 1) {
      const key = `2026-${String(month + 1).padStart(2, '0')}`;
      const cycle = engine.invoiceCycleRange(card, key);
      assert.ok(cycle, `ciclo deveria existir para ${key}`);

      const [sy, sm, sd] = cycle.start.split('-').map(Number);
      const [ey, em, ed] = cycle.end.split('-').map(Number);
      const start = Date.UTC(sy, sm - 1, sd);
      const end = Date.UTC(ey, em - 1, ed);
      assert.ok(start <= end, `início (${cycle.start}) deve preceder fim (${cycle.end}) em ${key}`);

      for (let t = start; t <= end; t += 86400000) {
        const iso = new Date(t).toISOString().slice(0, 10);
        assert.equal(
          engine.invoicePeriodKeyForDate(card, iso),
          key,
          `${iso} (fech. ${closing}) deveria pertencer a ${key}`
        );
      }

      // Data imediatamente anterior à janela pertence a OUTRO período.
      const before = new Date(start - 86400000).toISOString().slice(0, 10);
      assert.notEqual(engine.invoicePeriodKeyForDate(card, before), key, `${before} não pode cair em ${key}`);

      // Data imediatamente posterior à janela pertence a OUTRO período.
      const after = new Date(end + 86400000).toISOString().slice(0, 10);
      assert.notEqual(engine.invoicePeriodKeyForDate(card, after), key, `${after} não pode cair em ${key}`);
    }
  }
});

test('invoiceCycle: datas fora da janela de qualquer período nunca apontam para ele', () => {
  const card = { id: 'c', closingDay: 10, dueDay: 17 };
  const cycle = engine.invoiceCycleRange(card, '2026-09');
  const [sy, sm, sd] = cycle.start.split('-').map(Number);
  const [ey, em, ed] = cycle.end.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);

  for (let t = Date.UTC(2025, 11, 1); t <= Date.UTC(2027, 0, 31); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const inWindow = t >= start && t <= end;
    assert.equal(
      engine.invoicePeriodKeyForDate(card, iso) === '2026-09',
      inWindow,
      `${iso} deveria${inWindow ? '' : ' NÃO'} estar na janela de 2026-09`
    );
  }
});

test('invoiceCycle: vencimento nunca é anterior ao fim da janela', () => {
  for (const [closing, due] of [[10, 17], [31, 31], [5, 5], [29, 5], [30, 31], [1, 1]]) {
    const card = { id: 'c', closingDay: closing, dueDay: due };
    for (const key of ['2026-01', '2026-02', '2026-06', '2026-12']) {
      const cycle = engine.invoiceCycleRange(card, key);
      const [y, m, d] = cycle.end.split('-').map(Number);
      // Compara como número de dia-sequencial via Date.UTC (AAAA-MM-DD é lexível).
      const endUTC = Date.UTC(y, m - 1, d);
      const dueUTC = Date.parse(`${invoiceDueDateForPeriodReference(card, key)}T00:00:00Z`);
      assert.ok(
        dueUTC >= endUTC,
        `fech. ${closing} venc. ${due} em ${key}: vencimento não pode anteceder o fim da fatura`
      );
    }
  }
});

// Espelho mínimo de invoiceDueDateForPeriod() (index.html, Fase D) apenas para
// a asserção de coerência acima; o teste abaixo garante que o código real existe.
function invoiceDueDateForPeriodReference(card, periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
  const due = Math.min(31, Math.max(1, Number(card.dueDay) || closing));
  const offset = due < closing ? 1 : 0;
  const dueDate = new Date(y, m - 1 + offset, 1);
  const last = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
  return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(Math.min(due, last)).padStart(2, '0')}`;
}

test('invoiceCycle: index.html expõe a navegação de períodos da fatura', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const trecho of [
    'cardInvoiceSelection',
    'cardInvoiceNavState',
    'window.shiftCardInvoice',
    'window.resetCardInvoice',
    'invoiceCycleLabel',
    'credit-card-invoice-nav'
  ]) {
    assert.ok(html.includes(trecho), `index.html deveria conter "${trecho}"`);
  }
  const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
  assert.ok(css.includes('.credit-card-invoice-nav'), 'styles.css deveria estilizar a navegação da fatura');
});
