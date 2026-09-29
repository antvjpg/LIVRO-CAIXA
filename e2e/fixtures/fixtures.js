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
  /* resultado esperado pelo oracle (não pelo app): 0 + 1000 − 250 */
  expected: {
    patrimonio: 750,
    ledgerCount: 2,
  },
};

module.exports = { fixtures, MARK };
