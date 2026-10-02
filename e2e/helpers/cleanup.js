/* C.O.D.E. — cleanup em camadas (FASE 7, 10, 11).
   Camada 1: Firestore — apaga somente livrocaixa/{uid-da-conta-QA}.
   Camada 2: Auth — exclui a conta SOMENTE se foi criada por esta run.
   Roda no globalTeardown (sucesso/falha/blocked) e no CLI `code:cleanup`.
   Nunca lança exceção; nunca imprime senha/idToken; resultado vira
   e2e/.state/qa-summary.json (alimenta a seção QA ENVIRONMENT do relatório). */
'use strict';

const { resolveCredentials, guardReasonText } = require('./env');
const identity = require('./identity');
const rest = require('./firestore-rest');

/* O teardown não tem timeout de teste: aqui vale esperar a cota de
   verificação de senha recuar (minutos) em vez de largar conta efêmera e
   docs órfãos invisíveis. Esse backoff não é para quem roda dentro de spec.
   O Identity Toolkit limita ~25 verificações de senha por conta em janela
   rolante de 10 min — o backoff anterior somava 52 s e reprovava a run no
   --strict quando a cota estourava exatamente no teardown. A série abaixo
   cobre ~8 min, suficiente para as entradas mais antigas saírem da janela. */
const TEARDOWN_QUOTA_RETRY_DELAYS_MS = [2000, 5000, 15000, 30000, 60000, 120000, 240000];

async function runCleanup({ log = () => {} } = {}) {
  const summary = {
    runId: identity.newRunId(),
    mode: 'desconhecido',
    email: null,
    uid: null,
    createdByCode: false,
    firestoreCleanup: 'SKIP',
    authCleanup: 'SKIP',
    deletedDocs: 0,
    severity: null,
    notes: [],
    finishedAt: new Date().toISOString(),
  };

  try {
    const meta = identity.load();
    if (meta) {
      summary.runId = meta.runId || summary.runId;
      summary.mode = meta.mode || summary.mode;
      summary.email = meta.email ? identity.maskEmail(meta.email) : null;
      summary.createdByCode = meta.createdByCode === true;
      if (meta.staleAccounts && meta.staleAccounts.length) {
        summary.severity = summary.severity || 'CLEANUP_WARNING';
        summary.notes.push(
          `${meta.staleAccounts.length} conta(s) de run anterior não removida(s): ` +
            meta.staleAccounts.map((s) => s.email).join(', '),
        );
      }
    }

    const creds = resolveCredentials();
    if (!creds) {
      const reason = guardReasonText() || 'não informado';
      summary.notes.push(`sem credenciais: ${reason}`);
      /* sem senha em memória não há como autenticar: se ESTA run criou a
         conta, as sobras são reais → BLOCKED visível no relatório. */
      const plan = identity.planCleanup(meta, { ok: false, reason });
      summary.severity = plan.severity;
      return finish(summary, log);
    }
    summary.mode = meta?.mode || creds.source;
    summary.email = summary.email || identity.maskEmail(creds.email);

    /* --- camada 0: contas secundárias criadas por testes da run --- */
    await cleanupExtraAccounts(meta, creds, summary, log);

    /* --- autenticação (signIn REST; senha só em memória) --- */
    let session;
    try {
      session = await rest.signIn(creds.email, creds.password, {
        retryDelaysMs: TEARDOWN_QUOTA_RETRY_DELAYS_MS,
      });
    } catch (err) {
      const reason = err.reason || err.message || 'signIn falhou';
      summary.notes.push(`signIn: ${reason}`);
      /* sem autenticação nada foi tentado: SKIP + severidade visível */
      const plan = identity.planCleanup(meta, { ok: false, reason });
      summary.severity = plan.severity;
      return finish(summary, log);
    }

    summary.uid = identity.maskUid(session.uid);
    if (meta?.createdByCode !== true) summary.createdByCode = false;
    if (meta?.uid && String(meta.uid) !== String(session.uid)) {
      summary.severity = 'BLOCKED';
      summary.notes.push('UID da sessão não confere com o registrado — nada foi apagado');
      return finish(summary, log);
    }

    /* --- camada 1: Firestore (escopo exato livrocaixa/{uid}) --- */
    try {
      const r = await rest.resetWithSession(session);
      summary.firestoreCleanup = 'PASS';
      summary.deletedDocs = r.deleted;
      log(`[C.O.D.E.] cleanup Firestore: ${r.deleted} documento(s)`);
    } catch (err) {
      summary.firestoreCleanup = 'FAIL';
      summary.severity = summary.severity || 'BLOCKED';
      summary.notes.push(`Firestore: ${err.message}`);
    }

    /* --- camada 2: Auth (apenas conta criada por esta run) --- */
    const own = identity.canDeleteIdentity(meta, {
      uid: session.uid,
      email: session.email || creds.email,
    });
    if (own.ok) {
      try {
        const gone = await rest.deleteOwnAccount(session.idToken);
        summary.authCleanup = gone ? 'PASS' : 'PASS (já excluída)';
        log('[C.O.D.E.] conta Auth efêmera excluída');
      } catch (err) {
        summary.authCleanup = 'FAIL';
        summary.severity = summary.severity || 'CLEANUP_WARNING';
        summary.notes.push(`conta Auth permaneceu: ${err.message}`);
      }
    } else {
      summary.authCleanup = 'SKIP-PREEXISTENTE';
      summary.notes.push(own.reason);
    }
  } catch (err) {
    summary.severity = summary.severity || 'BLOCKED';
    summary.notes.push(`cleanup: ${err.message}`);
  }

  return finish(summary, log);
}

/* Contas extras (testes de isolamento por conta): mesma senha da run, em
   memória. Cada uma teve o documento apagado no Firestore e a conta Auth
   excluída aqui. Falha vira aviso — nunca esconde o resultado da conta
   principal nem derruba o teardown. */
async function cleanupExtraAccounts(meta, creds, summary, log) {
  const extras = meta && Array.isArray(meta.extraAccounts) ? meta.extraAccounts : [];
  if (!extras.length) return;
  let excluidas = 0;
  for (const acc of extras) {
    const email = acc && acc.email;
    if (!email) continue;
    const rotulo = identity.maskEmail(email);
    try {
      const session = await rest.signIn(email, creds.password);
      try {
        const r = await rest.resetWithSession(session);
        summary.deletedDocs += r.deleted || 0;
      } catch (err) {
        summary.severity = summary.severity || 'CLEANUP_WARNING';
        summary.notes.push(`Firestore da conta extra ${rotulo}: ${err.message}`);
      }
      await rest.deleteOwnAccount(session.idToken);
      excluidas++;
      log(`[C.O.D.E.] conta extra excluída: ${rotulo}`);
    } catch (err) {
      summary.severity = summary.severity || 'CLEANUP_WARNING';
      summary.notes.push(`conta extra ${rotulo} não excluída: ${err.reason || err.message}`);
    }
  }
  if (excluidas) summary.extraAccountsDeleted = excluidas;
}

function finish(summary, log) {
  try {
    identity.writeSummary(summary);
  } catch {
    /* resumo é best-effort */
  }
  try {
    identity.clear(); /* metadados da run (nenhum segredo) */
  } catch {
    /* best-effort */
  }
  log(
    `[C.O.D.E.] QA CREATED=${summary.createdByCode ? 'SIM' : 'NAO'} | ` +
      `FIRESTORE=${summary.firestoreCleanup} | AUTH=${summary.authCleanup}` +
      (summary.severity ? ` | ${summary.severity}` : ''),
  );
  return summary;
}

module.exports = { runCleanup };
