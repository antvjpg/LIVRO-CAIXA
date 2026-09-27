/* C.O.D.E. — CLI de cleanup manual (FASE 7/11).
   Uso: npm run code:cleanup
   Limpa Firestore e exclui a conta efêmera da run quando (e somente quando)
   ela foi criada pelo C.O.D.E. Senha vem de process.env/​.env.local — nunca
   é impressa. Sai com 2 se BLOCKED (há sobras que exigem atenção manual). */
'use strict';

const { runCleanup } = require('../helpers/cleanup');

(async () => {
  const summary = await runCleanup({ log: (m) => console.log(m) });
  console.log(
    JSON.stringify(
      {
        runId: summary.runId,
        mode: summary.mode,
        email: summary.email,
        uid: summary.uid,
        createdByCode: summary.createdByCode,
        firestoreCleanup: summary.firestoreCleanup,
        authCleanup: summary.authCleanup,
        deletedDocs: summary.deletedDocs,
        severity: summary.severity,
        notes: summary.notes,
      },
      null,
      2,
    ),
  );
  process.exit(summary.severity === 'BLOCKED' ? 2 : 0);
})().catch((err) => {
  console.error(`[C.O.D.E.] cleanup manual falhou: ${err.message}`);
  process.exit(2);
});
