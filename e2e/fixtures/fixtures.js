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
  /* resultado esperado pelo oracle (não pelo app): 0 + 1000 − 250 */
  expected: {
    patrimonio: 750,
    ledgerCount: 2,
  },
};

module.exports = { fixtures, MARK };
