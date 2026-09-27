/* C.O.D.E. — global setup (FASE 3, 4, 7, 10).
   Roda uma única vez, no processo principal, ANTES dos workers:
     1. detecta identidade órfã de run anterior abortada (aviso, sem segredo);
     2. gera a identidade QA EFÊMERA desta run (e-mail + senha) e a injeta em
        process.env — a senha vive só na memória, nunca em arquivo;
     3. prepara storageState mínimo e diretório de relatórios.
   Nenhum segredo é impresso (apenas e-mail mascarado). */
'use strict';

const fs = require('fs');
const path = require('path');
const identity = require('./identity');
const { config, env } = require('./env');

function writeEmptyState() {
  fs.mkdirSync(path.dirname(config.statePath), { recursive: true });
  fs.writeFileSync(config.statePath, JSON.stringify({ cookies: [], origins: [] }));
}

module.exports = async () => {
  fs.mkdirSync(path.dirname(config.statePath), { recursive: true });
  fs.mkdirSync(config.reportsDir, { recursive: true });

  /* 1) run anterior que abortou após criar conta: registrar aviso (sem senha;
        sem ela não há como excluir — fica visível no relatório). */
  const stale = identity.load();
  const staleWarning =
    stale && stale.createdByCode === true
      ? {
          runId: stale.runId || 'desconhecida',
          email: identity.maskEmail(stale.email),
          uid: identity.maskUid(stale.uid),
          createdAt: stale.createdAt || 'desconhecido',
        }
      : null;

  /* 2) credenciais explícitas (fallback manual) desativam a geração efêmera */
  const explicit = env('CODE_TEST_EMAIL') && env('CODE_TEST_PASSWORD');
  const provisionDisabled = env('CODE_TEST_AUTO_PROVISION') === '0';

  if (explicit) {
    identity.save({
      runId: identity.newRunId(),
      mode: 'explicit',
      email: env('CODE_TEST_EMAIL'),
      createdByCode: false,
      state: 'explicit-credentials',
      createdAt: new Date().toISOString(),
      ...(staleWarning ? { staleAccounts: [staleWarning] } : {}),
    });
    console.log(`[C.O.D.E.] modo explícito — conta QA declarada ${identity.maskEmail(env('CODE_TEST_EMAIL'))} (não será excluída)`);
  } else if (!provisionDisabled) {
    const id = identity.generate();
    process.env.CODE_TEST_EMAIL = id.email;
    process.env.CODE_TEST_PASSWORD = id.password;
    process.env.CODE_TEST_MODE = 'ephemeral';
    identity.save({
      runId: id.runId,
      mode: 'ephemeral',
      email: id.email,
      uid: null,
      createdByCode: false,
      state: 'generated',
      createdAt: new Date().toISOString(),
      ...(staleWarning ? { staleAccounts: [staleWarning] } : {}),
    });
    console.log(`[C.O.D.E.] identidade QA efêmera: ${identity.maskEmail(id.email)} (run ${id.runId})`);
  } else {
    identity.save({
      runId: identity.newRunId(),
      mode: 'disabled',
      email: null,
      createdByCode: false,
      state: 'provision-disabled',
      createdAt: new Date().toISOString(),
      ...(staleWarning ? { staleAccounts: [staleWarning] } : {}),
    });
    console.warn('[C.O.D.E.] autoprovisionamento desligado (CODE_TEST_AUTO_PROVISION=0) — suítes ficarão BLOCKED');
  }

  /* 3) estado mínimo para o projeto "setup" não falhar por arquivo ausente */
  if (!fs.existsSync(config.statePath)) writeEmptyState();
};
