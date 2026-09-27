/* C.O.D.E. — FASE 3: SMOKE.
   Objetivo: provar que o C.O.D.E. consegue operar o LIVRO-CAIXA.
   1) abrir app  2) validar carregamento  3) sessão QA ativa  4) usuário correto
   5) Visão Geral  6) elementos essenciais  7) evidência em falha (config do Playwright). */
'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const qa = require('../helpers/qa-account');

test.describe('Smoke — aplicação operacional', () => {
  let watchAtual = null;
  /* evidência de console/rede disponível também quando o teste FALHA */
  test.afterEach(async ({ page }, testInfo) => {
    watchAtual?.attach(testInfo);
    watchAtual = null;
  });

  test('abre, valida sessão QA e acessa a Visão Geral', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
      /* diagnóstico vai para o próprio motivo (aparece no relatório) */
      const diag = await page
        .evaluate(() => ({
          origem: location.origin,
          chavesLocalStorage: Object.keys(localStorage).length,
          sessaoPersistida: Object.keys(localStorage).some((k) => k.indexOf('firebase:authUser:') === 0),
          overlayAuthOculto: document.getElementById('authOverlay')?.classList.contains('hidden') === true,
        }))
        .catch(() => ({ erro: 'sem acesso ao contexto da página' }));
      test.skip(
        true,
        `BLOCKED: sem sessão QA — ${sessao.error} | ${sessao.hint || ''} — origem=${diag.origem} chaves=${diag.chavesLocalStorage} persistida=${diag.sessaoPersistida} overlayOculto=${diag.overlayAuthOculto}`
      );
    }

    /* usuário correto logado */
    if (creds) await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });

    /* aplicação sincronizada (gate real do app) */
    await app.waitForDataReady(page);
    await expect(page.locator('#syncOverlay')).toBeHidden({ timeout: 30_000 });

    /* elementos essenciais de navegação */
    await expect(page.locator('#tabBtnDashboard')).toBeVisible();
    await expect(page.locator('#tabBtnCaixa')).toBeVisible();
    await expect(page.locator('#fabAdd')).toBeVisible();

    /* Visão Geral renderiza conteúdo */
    await app.openTab(page, 'dashboard');
    await expect(page.locator('#viewDashboard')).toHaveClass(/active/);
    await expect
      .poll(async () => page.locator('#advancedDashboard').evaluate((el) => el.innerHTML.trim().length), {
        timeout: 30_000,
        message: 'Visão Geral (#advancedDashboard) permaneceu vazia',
      })
      .toBeGreaterThan(0);

    /* evidências */
    await testInfo.attach('diagnostico-smoke.txt', {
      body: [
        `url=${page.url()}`,
        `titulo=${await page.title()}`,
        `usuario=${creds ? creds.email : 'n/d'}`,
        `dialogos=${dialogs.length}`,
        `console=${JSON.stringify(watch.counts())}`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    /* falha dura apenas: exceção não tratada na página.
       console.error fica como evidência visível (classificação em README). */
    expect(watch.pageErrors(), 'erros não tratados na página').toHaveLength(0);
  });
});
