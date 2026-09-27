/* C.O.D.E. — sessão QA (FASE 2 + FASE 4 do preparo E2E).
   Executa uma única vez por run:
     1. login/criação autônoma pela interface real;
     2. logout real + login real (prova de que a conta criada autentica);
     3. grava storageState (pós-relogin) consumido pelas demais suítes.
   Sem credenciais → grava estado vazio e reporta BLOCKED (nunca escondido).
   Projeto "setup" roda com trace/screenshot/video OFF: nenhum corpo de
   requisição de login vira artefato. */
'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const qa = require('../helpers/qa-account');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { config, guardReasonText } = require('../helpers/env');
const identity = require('../helpers/identity');

function writeEmptyState() {
  fs.mkdirSync(path.dirname(config.statePath), { recursive: true });
  fs.writeFileSync(config.statePath, JSON.stringify({ cookies: [], origins: [] }));
}

test('provisiona sessão QA (login/criação autônoma)', async ({ page, context }, testInfo) => {
  const creds = qa.credentials();
  if (!creds) {
    writeEmptyState();
    test.skip(
      true,
      `BLOCKED: credenciais QA indisponíveis — ${guardReasonText() || 'defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD (e2e/.env.example)'}`
    );
  }

  const dialogs = app.attachDialogHandler(page);
  const watch = watchPage(page);

  const result = await qa.signInOrCreate(page, creds);
  if (result.status !== 'ok') {
    writeEmptyState();
    await testInfo.attach('blocked.txt', {
      body: `Provisionamento falhou: ${result.error}\n\nAção: ${result.hint}`,
      contentType: 'text/plain',
    });
    test.skip(true, `BLOCKED: provisionamento QA — ${result.error} | ${result.hint}`);
  }

  await app.waitForDataReady(page);
  await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });

  /* ---- FASE 4: logout real -> login real -> mesma conta ---- */
  const metaAntes = identity.load() || {};
  let relogin = { status: 'nao-executado', how: 'nao-executado' };

  await qa.logout(page);
  expect(await app.isLoggedIn(page), 'logout não encerrou a sessão').toBe(false);

  relogin = await qa.loginOnly(page, creds);
  if (relogin.status !== 'ok') {
    /* falha de login: evidência sanitizada + BLOCKED visível; a conta criada
       continua registrada (createdByCode) e será limpa no teardown. */
    writeEmptyState();
    await testInfo.attach('bloqueio-login.txt', {
      body: `relogin após logout falhou: ${relogin.error}\n\nAção: ${relogin.hint}\n`,
      contentType: 'text/plain',
    });
    test.skip(true, `BLOCKED: login real após logout — ${relogin.error} | ${relogin.hint}`);
  }

  await app.waitForDataReady(page);
  await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });

  const sessaoDepois = await qa.sessionIdentity(page, creds.email);
  if (metaAntes.uid && sessaoDepois) {
    expect(sessaoDepois.uid, 'login real autenticou uma conta diferente da criada').toBe(metaAntes.uid);
  }
  const metaDepois = identity.load() || {};
  if (metaAntes.createdByCode === true) {
    expect(metaDepois.createdByCode, 'relogin não pode rebaixar a propriedade da conta').toBe(true);
  }

  await context.storageState({ path: config.statePath });
  /* prova sanitizada do que foi gravado (só contagens/origem — nunca valores) */
  let estadoInfo = 'state ilegível';
  try {
    const estado = JSON.parse(fs.readFileSync(config.statePath, 'utf8'));
    const origens = estado.origins || [];
    const chaves = origens.flatMap((o) => o.localStorage || []);
    estadoInfo = JSON.stringify({
      origens: origens.length,
      origem: origens[0]?.origin || null,
      chavesLocalStorage: chaves.length,
      sessaoFirebase: chaves.some((it) => String(it.name || '').indexOf('firebase:authUser:') === 0),
    });
  } catch {
    /* evidência de diagnóstico nunca derruba a run */
  }
  /* onde o Firebase 10 (compat) guarda a sessão — só nomes de banco */
  const idb = await page
    .evaluate(async () =>
      indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name || 'sem-nome') : ['indisponível']
    )
    .catch(() => ['erro-ao-ler']);
  const persistencia = JSON.stringify(idb);
  console.log(`[C.O.D.E.] storageState gravado: ${estadoInfo}`);
  console.log(`[C.O.D.E.] bancos IndexedDB da página: ${persistencia}`);
  watch.attach(testInfo);
  /* Evidência só com dados mascarados: nunca senha, nunca e-mail completo,
     nunca token (FASE 12). */
  const meta = identity.load() || {};
  await testInfo.attach('provisionamento.txt', {
    body:
      `método=${result.how}\n` +
      `relogin=${relogin.how}\n` +
      `criado-por-este-código=${meta.createdByCode === true ? 'sim' : 'não'}\n` +
      `conta=${identity.maskEmail(creds.email)}\n` +
      `uid=${identity.maskUid(result.uid || meta.uid)}\n` +
      `diálogos=${dialogs.length}\n` +
      `storageState=${estadoInfo}\n` +
      `bancosIndexedDB=${persistencia}\n`,
    contentType: 'text/plain',
  });
  expect(watch.pageErrors(), 'erros de página durante autenticação').toHaveLength(0);
});
