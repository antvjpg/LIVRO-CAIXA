'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');

/* Investimentos — agrupamento visual por instituição.
   A instituição é metadado derivado (investment.institution); o agrupamento é
   camada pura (normalizeInstitutionKey / groupInvestmentsByInstitution) aplicada
   na renderização. Não cria entidade persistida. */

test.describe.serial('Investimentos — agrupamento por instituição', () => {
  let watchAtual = null;
  let dialogsAtual = null;

  test.afterEach(async ({ page }, testInfo) => {
    watchAtual?.attach(testInfo);
    watchAtual = null;
    if (testInfo.status !== testInfo.expectedStatus && dialogsAtual) {
      const corpo = dialogsAtual.map((d) => `${d.type}: ${d.message}`).join('\n') || 'nenhum';
      await testInfo.attach('dialogos.txt', { body: corpo, contentType: 'text/plain' }).catch(() => {});
    }
    dialogsAtual = null;
  });

  function skipSemCredencial() {
    const creds = resolveCredentials();
    if (!creds) {
      test.skip(true, `BLOCKED: credenciais QA indisponíveis — ${guardReasonText() || 'sem credencial'}`);
    }
    return creds;
  }

  async function startPage(page, creds) {
    const dialogs = app.attachDialogHandler(page);
    dialogsAtual = dialogs;
    const watch = watchPage(page);
    watchAtual = watch;
    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
      test.skip(true, `BLOCKED: sessão QA indisponível — ${sessao.error} | ${sessao.hint || ''}`);
    }
    await app.waitForDataReady(page);
    return dialogs;
  }

  test('agrupamento: institution-card agrupa investimentos e preserva resumo', async ({ page }) => {
    const creds = skipSemCredencial();
    await startPage(page, creds);

    await app.openTab(page, 'invest');
    const cards = page.locator('#investGrid .institution-card');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });

    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const keys = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-institution-key')));
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(String(key || '')).not.toBe('');
    }

    const assetCards = page.locator('#investGrid .institution-card .asset-card');
    await expect(assetCards.first()).toBeVisible();
    const assetCount = await assetCards.count();
    expect(assetCount).toBeGreaterThan(0);

    await expect(page.locator('#investBalanceStrip .balance-card.total')).toBeVisible();
  });

  test('agrupamento: sem investimentos não renderiza institution-card vazio', async ({ page }) => {
    const creds = skipSemCredencial();
    await startPage(page, creds);

    await app.openTab(page, 'invest');
    await expect(page.locator('#investBalanceStrip .balance-card.total')).toBeVisible({ timeout: 20_000 });
    const emptyCount = await page.locator('#investGrid .empty').count();
    if (emptyCount > 0) {
      await expect(page.locator('#investGrid .institution-card')).toHaveCount(0);
    }
  });
});
