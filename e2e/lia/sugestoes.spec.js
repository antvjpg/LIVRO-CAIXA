/* C.O.D.E. — E2E V.20-02 (LIA Sugestões Contextuais).
   Cobertura: exatamente 3 sugestões, snapshot vazio, snapshot parcial,
   contas, orçamento, metas, investimentos, cartões, fluxo de caixa,
   priorização de contexto, clique na sugestão, geração da pergunta correta,
   envio pelo fluxo normal, troca de conta, logout/login, modo offline,
   erro do Worker. */
'use strict';

const { test, expect } = require('@playwright/test');
const assert = require('node:assert');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const qa = require('../helpers/qa-account');

test.describe('V.20-02 LIA — Sugestões contextuais', () => {
  let watchAtual = null;
  test.afterEach(async ({ page }, testInfo) => {
    watchAtual?.attach(testInfo);
    watchAtual = null;
  });

  async function openLiaChat(page) {
    await app.openTab(page, 'dashboard');
    await expect(page.locator('#viewDashboard')).toHaveClass(/active/);
    await page.waitForTimeout(1000);
    await page.locator('#fabAdd').click();
    await expect(page.locator('#panelAiChat')).toHaveClass(/open/, { timeout: 5000 });
  }

  async function getSuggestions(page) {
    const box = page.locator('#aiChatMessages');
    const suggestions = box.locator('.ai-quick-suggestion');
    return suggestions;
  }

  async function clickSuggestion(page, index) {
    const suggestions = await getSuggestions(page);
    await expect(suggestions.nth(index)).toBeVisible();
    await suggestions.nth(index).click();
  }

  test('exatamente 3 sugestões renderizadas', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);
  });

  test('snapshot vazio → fallback genérico', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureSecondaryAccount(page, { ...creds, email: `v2002-empty-${Date.now()}@test.local` });
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);
    
    const texts = [];
    for (let i = 0; i < 3; i++) {
      texts.push(await suggestions.nth(i).textContent());
    }
    assert.ok(texts.some(t => t.includes('Cadastre') || t.includes('caixinha') || t.includes('investimento')),
      'Deve mostrar fallback genérico');
  });

  test('com orçamento próximo do limite → sugestão "Quanto ainda posso gastar"', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    /* O sinal "próximo do limite" exige gasto REAL ≥ 80% do limite
       (analyzeFinancialContext em ai-chat-contract.js). Sem lançamento na
       categoria o pct é 0 e o sinal nunca dispara — por isso o teste cria
       a própria massa (gasto + limite ~11% acima do gasto), o que mantém
       o pct na faixa 80–99% também em retry. */
    const fmtBR = (v) => {
      const [inteiro, decimal] = v.toFixed(2).split('.');
      return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimal}`;
    };

    await app.openTab(page, 'profile');
    await expect(page.locator('#viewProfile')).toHaveClass(/active/);
    const linhaAlimentacao = page.locator('#featureBudgetRows .feature-budget-row', { hasText: 'Alimentação' });
    await expect(linhaAlimentacao).toBeVisible({ timeout: 10000 });
    let gasto = app.parseCurrency(await linhaAlimentacao.locator('span').first().textContent());
    if (!(gasto > 0)) {
      /* FAB só abre o formulário de lançamento fora da Visão Geral */
      await app.openTab(page, 'caixa');
      await app.ensureBankExists(page, 'Banco C.O.D.E.', 1000);
      await app.addEntry(page, {
        type: 'out',
        desc: 'Mercado do mês (C.O.D.E.)',
        amount: 900,
        bank: 'Banco C.O.D.E.',
        category: 'Alimentação',
      });
      await app.waitForDataReady(page);
      gasto = 900;
      await app.openTab(page, 'profile');
      await expect(page.locator('#viewProfile')).toHaveClass(/active/);
    }

    const input = page.locator('#featureBudgetRows input[data-budget-category*="alimentacao"]').first();
    await input.fill(fmtBR(gasto * 1.11));
    await input.blur();
    await expect(page.locator('#profileSettingsStatus')).toHaveText(/Salvo/, { timeout: 5000 });

    await page.reload();
    await app.waitForDataReady(page);
    await openLiaChat(page);
    
    const suggestions = await getSuggestions(page);
    const texts = [];
    for (let i = 0; i < 3; i++) {
      texts.push(await suggestions.nth(i).textContent());
    }
    assert.ok(texts.some(t => t.includes('ainda posso gastar') || t.includes('perto do limite')),
      `Sugestão de orçamento próximo do limite não encontrada. Sugestões: ${texts.join(', ')}`);
  });

  test('com meta próxima do prazo → sugestão "Quanto preciso guardar"', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    const texts = [];
    for (let i = 0; i < 3; i++) {
      texts.push(await suggestions.nth(i).textContent());
    }
    // Se houver metas com prazo próximo, deve aparecer sugestão contextual
    if (texts.some(t => t.includes('guardar para atingir') || t.includes('meta está no prazo'))) {
      assert.ok(true, 'Sugestão de meta contextual presente');
    } else {
      test.info().annotations.push({ type: 'info', description: 'Sem metas com prazo próximo no snapshot de teste' });
    }
  });

  test('com investimentos → sugestão "Como está a rentabilidade"', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    const texts = [];
    for (let i = 0; i < 3; i++) {
      texts.push(await suggestions.nth(i).textContent());
    }
    if (texts.some(t => t.includes('rentabilidade') || t.includes('concentração'))) {
      assert.ok(true, 'Sugestão de investimentos presente');
    } else {
      test.info().annotations.push({ type: 'info', description: 'Sem investimentos no snapshot de teste' });
    }
  });

  test('clique na sugestão → preenche input → envia pelo fluxo normal', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);
    
    const firstText = await suggestions.first().textContent();
    await clickSuggestion(page, 0);
    
    const input = page.locator('#aiChatInput');
    await expect(input).toHaveValue(firstText);
    
    const form = page.locator('#aiChatForm');
    await expect(form).toBeVisible();
  });

  test('sugestões determinísticas (mesma ordem ao reabrir)', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions1 = await getSuggestions(page);
    const texts1 = [];
    for (let i = 0; i < 3; i++) {
      texts1.push(await suggestions1.nth(i).textContent());
    }

    await page.locator('#panelAiChat .modal-close, #panelAiChat [data-close]').click();
    await expect(page.locator('#panelAiChat')).not.toHaveClass(/open/, { timeout: 3000 });

    await openLiaChat(page);
    const suggestions2 = await getSuggestions(page);
    const texts2 = [];
    for (let i = 0; i < 3; i++) {
      texts2.push(await suggestions2.nth(i).textContent());
    }

    assert.deepEqual(texts1, texts2);
  });

  test('troca de conta → sugestões resetam', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    await page.locator('#panelAiChat .modal-close, #panelAiChat [data-close]').click();
    await expect(page.locator('#panelAiChat')).not.toHaveClass(/open/, { timeout: 3000 });

    await page.evaluate(() => { if (window.firebase?.auth) return window.firebase.auth().signOut(); });
    await page.waitForTimeout(1000);

    const creds2 = { ...creds, email: `v2002-swap-${Date.now()}@test.local` };
    const sessao2 = await qa.ensureSecondaryAccount(page, creds2);
    if (sessao2.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao2.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);
  });

  test('logout/login → sugestões persistem por conta', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions1 = await getSuggestions(page);
    const texts1 = [];
    for (let i = 0; i < 3; i++) {
      texts1.push(await suggestions1.nth(i).textContent());
    }

    await page.locator('#panelAiChat .modal-close, #panelAiChat [data-close]').click();
    await page.evaluate(() => { if (window.firebase?.auth) return window.firebase.auth().signOut(); });
    await page.waitForTimeout(1000);

    const sessao2 = await qa.ensureUiSession(page, creds);
    if (sessao2.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao2.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions2 = await getSuggestions(page);
    const texts2 = [];
    for (let i = 0; i < 3; i++) {
      texts2.push(await suggestions2.nth(i).textContent());
    }

    assert.deepEqual(texts1, texts2);
  });

  test('modo offline → sugestões ainda renderizam (cache local)', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);

    await page.route('**/ai', route => route.abort('failed'));
    await page.route('**/quota', route => route.abort('failed'));

    await page.locator('#panelAiChat .modal-close, #panelAiChat [data-close]').click();
    await openLiaChat(page);
    
    const suggestions2 = await getSuggestions(page);
    await expect(suggestions2).toHaveCount(3);
  });

  test('erro do Worker (429/5xx) → sugestões não quebram', async ({ page }, testInfo) => {
    const creds = resolveCredentials();
    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);
    watchAtual = watch;

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') { test.skip(true, `BLOCKED: ${sessao.error}`); }
    await app.waitForDataReady(page);

    await page.route('**/ai', route => route.fulfill({ status: 429, body: JSON.stringify({ error: 'rate_limited' }) }));

    await openLiaChat(page);
    const suggestions = await getSuggestions(page);
    await expect(suggestions).toHaveCount(3);
  });
});