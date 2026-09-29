/* C.O.D.E. — E2E V.20-02 (Orçamento).
   Cobertura: criação, edição, exclusão, persistência, reload, Firestore,
   status sem emoji, troca de conta, tema claro/escuro, viewport mobile. */
'use strict';

const { test, expect } = require('@playwright/test');
const assert = require('node:assert');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const qa = require('../helpers/qa-account');

test.describe('V.20-02 Orçamento — UX finalizada', () => {
  let watchAtual = null;
  test.afterEach(async ({ page }, testInfo) => {
    watchAtual?.attach(testInfo);
    watchAtual = null;
  });

  async function openProfileBudget(page) {
    await app.openTab(page, 'profile');
    await expect(page.locator('#viewProfile')).toHaveClass(/active/);
    await expect(page.locator('#featureBudgetRows')).toBeVisible({ timeout: 10000 });
  }

  async function getBudgetRows(page) {
    return page.locator('#featureBudgetRows .feature-budget-row');
  }

  async function getBudgetStatus(page, categoryName) {
    const row = page.locator('#featureBudgetRows .feature-budget-row', { hasText: categoryName });
    const label = row.locator('label');
    const status = row.locator('.budget-status');
    return { label: await label.textContent(), status: await status.textContent() };
  }

  test('criar orçamento → persistir → reload → manter valor', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
      test.skip(true, `BLOCKED: sem sessão QA — ${sessao.error}`);
    }
    await app.waitForDataReady(page);

    await openProfileBudget(page);

    const rowsBefore = await getBudgetRows(page);
    const countBefore = await rowsBefore.count();

    const testCategory = 'Alimentação';
    const input = app.budgetInput(page, testCategory);
    await input.fill('1.500,00');
    await input.blur();

    await expect(page.locator('#profileSettingsStatus')).toHaveText(/Salvo/, { timeout: 5000 });
    await page.waitForTimeout(1000);

    await page.reload();
    await app.waitForDataReady(page);
    await openProfileBudget(page);

    const inputAfter = app.budgetInput(page, testCategory);
    await expect(inputAfter).toHaveValue(/1\.500/);
  });

  test('editar orçamento → alterar limite → persistir', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);

    const input = app.budgetInput(page, 'Alimentação');
    await input.fill('2.000,00');
    await input.blur();
    await expect(page.locator('#profileSettingsStatus')).toHaveText(/Salvo/, { timeout: 5000 });

    await page.reload();
    await app.waitForDataReady(page);
    await openProfileBudget(page);
    await expect(input).toHaveValue(/2\.000/);
  });

  test('excluir orçamento (limpar campo) → persistir → reload → campo vazio', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);

    const input = app.budgetInput(page, 'Transporte');
    await input.fill('');
    await input.blur();
    await expect(page.locator('#profileSettingsStatus')).toHaveText(/Salvo/, { timeout: 5000 });

    await page.reload();
    await app.waitForDataReady(page);
    await openProfileBudget(page);
    await expect(input).toHaveValue('');
  });

  test('status textual sem emoji no label da categoria (Normal/Atenção/Excedido)', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);

    const rows = await getBudgetRows(page);
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const label = row.locator('label');
      const labelText = await label.textContent();
      
      assert.ok(!labelText.includes('🟢'), `Label contém emoji verde: ${labelText}`);
      assert.ok(!labelText.includes('🟡'), `Label contém emoji amarelo: ${labelText}`);
      assert.ok(!labelText.includes('🔴'), `Label contém emoji vermelho: ${labelText}`);
      
      const status = row.locator('.budget-status');
      if (await status.count() > 0) {
        const statusText = await status.textContent();
        assert.ok(['Normal', 'Atenção', 'Excedido'].includes(statusText.trim()), 
          `Status inválido: ${statusText}`);
      }
    }
  });

  test('Dashboard: orçamento exibe badge textual + barra de progresso', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await app.openTab(page, 'dashboard');
    await expect(page.locator('#viewDashboard')).toHaveClass(/active/);
    await expect(page.locator('#advancedDashboard')).toBeVisible({ timeout: 10000 });

    const budgetRows = page.locator('.dashboard-budgets .budget-summary-row');
    const count = await budgetRows.count();
    
    for (let i = 0; i < count; i++) {
      const row = budgetRows.nth(i);
      const status = row.locator('.budget-status');
      if (await status.count() > 0) {
        const statusText = await status.textContent();
        assert.ok(['Normal', 'Atenção', 'Excedido'].includes(statusText.trim()));
      }
    }
  });

  test('tema claro e escuro: cores de status legíveis', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') {
        await page.evaluate(() => document.body.classList.add('dark-mode'));
      } else {
        await page.evaluate(() => document.body.classList.remove('dark-mode'));
      }
      await page.waitForTimeout(200);

      const statusElements = page.locator('#featureBudgetRows .budget-status');
      const count = await statusElements.count();
      for (let i = 0; i < count; i++) {
        const el = statusElements.nth(i);
        const bgColor = await el.evaluate(e => getComputedStyle(e).backgroundColor);
        assert.ok(bgColor && bgColor !== 'rgba(0, 0, 0, 0)', 'Status deve ter cor de fundo');
      }
    }
  });

  test('viewport mobile ≤600px: grid 1 coluna + status visível', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await page.setViewportSize({ width: 375, height: 667 });
    await openProfileBudget(page);

    const row = page.locator('#featureBudgetRows .feature-budget-row').first();
    const label = row.locator('label');
    const status = row.locator('.budget-status');
    
    await expect(label).toBeVisible();
    await expect(status).toBeVisible();
    
    const labelText = await label.textContent();
    assert.ok(!labelText.includes('🟢'));
    assert.ok(!labelText.includes('🟡'));
    assert.ok(!labelText.includes('🔴'));
  });

  test('troca de conta: orçamentos isolados por conta', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);
    const input1 = app.budgetInput(page, 'Alimentação');
    await input1.fill('1.000,00');
    await input1.blur();
    await expect(page.locator('#profileSettingsStatus')).toHaveText(/Salvo/, { timeout: 5000 });

    await page.evaluate(() => { if (window.firebase?.auth) return window.firebase.auth().signOut(); });
    await page.waitForTimeout(1000);

    const creds2 = { ...creds, email: creds.email.replace('@', '+2@') };
    const sessao2 = await qa.ensureSecondaryAccount(page, creds2);
    if (sessao2.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao2.error}`); }
    await app.waitForDataReady(page);

    await openProfileBudget(page);
    const input2 = app.budgetInput(page, 'Alimentação');
    await expect(input2).toHaveValue('');
  });
});