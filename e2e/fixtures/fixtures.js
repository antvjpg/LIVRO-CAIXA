/* C.O.D.E. — fixtures determinísticas (FASE 1).
   Valores redondos e marcadores CODE_TEST_* para identificação imediata
   de dado de teste em qualquer tela, log ou consulta. */
'use strict';

const MARK = 'CODE_TEST';

const fixtures = {
  bank: {
    name: `${MARK}_BANK_001`,
    initial: 0,
  },
  movements: {
    in: { type: 'in', desc: `${MARK}_MOVEMENT_IN_001`, amount: 1000 },
    out: { type: 'out', desc: `${MARK}_MOVEMENT_OUT_001`, amount: 250 },
  },
  pockets: {
    c1: { name: `${MARK}_CAIXA_001`, goal: 'Reserva viagem', goalAmount: 500, initial: 100 },
    c2: { name: `${MARK}_CAIXA_002`, goal: '', goalAmount: 0, initial: 0 },
    date: '2026-09-15',
    movements: [
      { kind: 'aporte', amount: 150, desc: 'aporte inicial' },
      { kind: 'aporte', amount: 20, desc: 'aporte extra' },
      { kind: 'resgate', amount: 50, desc: 'retirada parcial' },
      { kind: 'rendimento', amount: 10.5, desc: 'rendimento do período' },
    ],
    edit: { nameSuffix: '_EDIT', goal: 'Reserva editada', goalAmount: 800, initial: 300 },
    cappedGoalAmount: 250,
    largeMovement: { kind: 'aporte', amount: 999999.99, desc: 'aporte grande' },
    expected: {
      balance: 230.5,
      progress: '46%',
      total: 230.5,
      editedBalance: 430.5,
      editedProgress: '54%',
      largeBalance: 1000430.49,
      cappedProgress: '100%',
    },
  },
  /* Metas (P1): datas de prazo NÃO são fixas — o spec calcula a partir do
     relógio do browser para a suíte não envelhecer. */
  goals: {
    m1: { name: `${MARK}_META_001`, target: 1000, current: 0 },
    m2: { name: `${MARK}_META_002`, target: 600, current: 300, deadlineOffsetDays: 30 },
    m3: { name: `${MARK}_META_003`, target: 1000, retarget: 2000 },
    m4: { name: `${MARK}_META_004`, target: 400, aporte: 100 },
    m5: { name: `${MARK}_META_005`, target: 1200 },
    edit: { nameSuffix: '_EDIT', target: 400, current: 200, status: 'paused' },
    invest: { name: `${MARK}_INVEST_001`, type: 'Outros', value: 600 },
    topUp: { amount: 250, desc: `${MARK}_META_TOPUP_001` },
    expected: {
      bankBalance: 750,
      bankBalanceAfterTopUp: 1000,
      pocketBalance: 100,
      pocketBalanceAfterAporte: 200,
      m1: { current: 0, target: 1000, remaining: 1000, percent: '0%' },
      m2: { current: 300, target: 600, remaining: 300, percent: '50%' },
      m3: { current: 750, target: 1000, remaining: 250, percent: '75%' },
      m3Done: { current: 1000, target: 1000, remaining: 0, percent: '100%' },
      m3Retarget: { current: 1000, target: 2000, remaining: 1000, percent: '50%' },
      m3Paused: { current: 1000, target: 1000, remaining: 0, percent: '100%' },
      m4: { current: 100, target: 400, remaining: 300, percent: '25%' },
      m4AfterAporte: { current: 200, target: 400, remaining: 200, percent: '50%' },
      m5: { current: 600, target: 1200, remaining: 600, percent: '50%' },
      m1Edited: { current: 200, target: 400, remaining: 200, percent: '50%' },
    },
  },
  /* resultado esperado pelo oracle (não pelo app): 0 + 1000 − 250 */
  expected: {
    patrimonio: 750,
    ledgerCount: 2,
  },
};

module.exports = { fixtures, MARK };
