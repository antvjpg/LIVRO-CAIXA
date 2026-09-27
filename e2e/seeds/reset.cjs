/* C.O.D.E. — reset/cleanup do ambiente QA (CLI, idempotente).
   Uso: npm run code:reset
   Apaga somente livrocaixa/{uid-qa} (uid vem da autenticação das credenciais
   QA). Recusa qualquer caminho fora do escopo. Credenciais nunca são logadas. */
'use strict';

const qa = require('../helpers/qa-account');
const { resolveCredentials, guardReasonText, config } = require('../helpers/env');

async function main() {
  const creds = resolveCredentials();
  if (!creds) {
    console.error(
      `BLOCKED: ${guardReasonText() || 'credenciais QA ausentes'}.\n` +
        `  Defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD (ambiente ou ${config.envLocalPath.replace(config.root + '/', '')}) — ou rode via npm run code:test, que gera a identidade efêmera.\n` +
        '  Exemplo: e2e/.env.example'
    );
    process.exit(2);
  }
  const summary = await qa.reset();
  const perCollection = Object.entries(summary.perCollection)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}=${n}`)
    .join(' ') || '(vazio)';
  console.log(`[C.O.D.E.] reset do ambiente QA concluído.`);
  console.log(`  escopo   : livrocaixa/${summary.uid}`);
  console.log(`  apagados : ${summary.deleted} documento(s)`);
  console.log(`  por coleção: ${perCollection}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
