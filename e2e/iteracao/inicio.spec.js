/* C6-INICIO-01 — cobertura E2E permanente de navegação e renderização da aba Início.
   Valida estrutura, sem depender de saldo, lançamentos ou compromissos. */
'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const qa = require('../helpers/qa-account');

test.describe('Início — navegação e renderização', () => {
  let watchAtual = null;

  test.afterEach(async ({ page }, testInfo) => {
    watchAtual?.attach(testInfo);
    watchAtual = null;
  });

  test('abre a sessão QA e renderiza a aba Início', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
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

    if (creds) await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });

    await app.waitForDataReady(page);
    await expect(page.locator('#syncOverlay')).toBeHidden({ timeout: 30_000 });

    await app.openTab(page, 'inicio');

    await expect(page.locator('#viewInicio')).toHaveClass(/active/);
    await expect(page.locator('#viewInicio h2')).toHaveText('Início');

    const cards = [
      { label: 'Patrimônio Total', selector: '#viewInicio .balance-card' },
      { label: 'Saúde Financeira', selector: '#viewInicio .advanced-dashboard-card' },
      { label: 'Próximo Pagamento', selector: '#viewInicio .dashboard-next-payment-card' },
    ];
    for (const card of cards) {
      await expect(page.locator(card.selector), `card ${card.label}`).toBeVisible();
      await expect(page.locator(card.selector), `card ${card.label}`).toContainText(card.label);
    }

    const containers = [
      '#viewInicio .advanced-dashboard',
      '#viewInicio .next-pay-inner',
      '#viewInicio .cashflow-mini-summary',
    ];
    for (const selector of containers) {
      await expect(page.locator(selector), `container ${selector}`).toBeVisible();
    }

    await testInfo.attach('diagnostico-inicio.txt', {
      body: [
        `url=${page.url()}`,
        `titulo=${await page.title()}`,
        `usuario=${creds ? creds.email : 'n/d'}`,
        `aba=inicio`,
        `viewInicioAtiva=${await page.locator('#viewInicio').evaluate((el) => el.classList.contains('active'))}`,
        `dialogos=${dialogs.length}`,
        `console=${JSON.stringify(watch.counts())}`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watch.pageErrors(), 'erros não tratados na página').toHaveLength(0);
  });
});
