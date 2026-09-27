/* C.O.D.E. — global teardown (FASE 7): o "finally" da run.
   Executa SEMPRE (testes passaram, falharam ou ficaram BLOCKED), no processo
   principal, depois de todos os workers. Nunca lança exceção: uma falha aqui
   vira CLEANUP_WARNING no resumo e no relatório. */
'use strict';

const { runCleanup } = require('./cleanup');

module.exports = async () => {
  try {
    await runCleanup({ log: (m) => console.log(m) });
  } catch (err) {
    console.warn(`[C.O.D.E.] cleanup final não concluído: ${err.message}`);
    try {
      const identity = require('./identity');
      const prev = identity.readSummary() || {};
      identity.writeSummary({
        ...prev,
        severity: prev.severity || 'CLEANUP_WARNING',
        notes: [...(prev.notes || []), `teardown: ${err.message}`],
        finishedAt: new Date().toISOString(),
      });
    } catch {
      /* nada mais a fazer — o aviso já foi impresso */
    }
  }
};
