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

    const chartSnapshot = () => page.evaluate(() => {
      const chartOn = (id) => {
        const canvas = document.getElementById(id);
        if (!canvas || typeof Chart === 'undefined' || typeof Chart.getChart !== 'function') return false;
        return !!Chart.getChart(canvas);
      };
      return {
        inicio: chartOn('patrimonySparklineInicio'),
        strip: chartOn('patrimonySparkline'),
        preference: localStorage.getItem('livro-caixa-patrimony-spark'),
        ariaExpanded: document.querySelector('#viewInicio .inicio-card.balance-card .balance-symbol')?.getAttribute('aria-expanded') || null,
      };
    });
    const ensureSparkVisible = async () => {
      if ((await chartSnapshot()).preference === '0') {
        await page.locator('#viewInicio .inicio-card.balance-card .balance-symbol').click();
      }
    };

    const stripSnapshot = await page.evaluate(() => ({
      tab: document.body.dataset.tab,
      labels: Array.from(document.querySelectorAll('#balanceStrip > .balance-card .label')).map((el) => (el.textContent || '').trim()),
      investLabelTitle: document.querySelector('#balanceStrip > .invest-summary-card .label')?.getAttribute('title') || null,
      hasTotalCard: !!document.querySelector('#balanceStrip > .balance-card.total'),
      localTotal: (document.querySelector('#viewInicio .inicio-card.balance-card .amount')?.textContent || '').trim(),
      expectedTotal: ['fmt', 'totalBankBalance', 'totalPocketBalance', 'totalInvestBalance'].every((name) => typeof window[name] === 'function')
        ? window.fmt(window.totalBankBalance() + window.totalPocketBalance() + window.totalInvestBalance())
        : null,
    }));
    expect(stripSnapshot.tab).toBe('inicio');
    expect(stripSnapshot.labels).toEqual(['Bancos', 'Caixinhas', 'Invest.']);
    expect(stripSnapshot.investLabelTitle).toBe('Investimentos');
    expect(stripSnapshot.hasTotalCard).toBe(false);
    if (stripSnapshot.expectedTotal !== null) {
      expect(stripSnapshot.localTotal).toBe(stripSnapshot.expectedTotal);
    }

    await ensureSparkVisible();
    await expect.poll(async () => (await chartSnapshot()).inicio).toBe(true);
    expect((await chartSnapshot()).strip).toBe(false);

    await app.openTab(page, 'caixa');
    const caixaStrip = await page.evaluate(() => ({
      cards: document.querySelectorAll('#balanceStrip > .balance-card').length,
      hasTotalCard: !!document.querySelector('#balanceStrip > .balance-card.total'),
    }));
    expect(caixaStrip.cards).toBe(4);
    expect(caixaStrip.hasTotalCard).toBe(true);
    await expect.poll(async () => (await chartSnapshot()).strip).toBe(true);
    expect((await chartSnapshot()).inicio).toBe(false);

    await app.openTab(page, 'dashboard');
    await expect.poll(async () => (await chartSnapshot()).strip).toBe(false);
    expect((await chartSnapshot()).inicio).toBe(false);

    await app.openTab(page, 'inicio');
    await expect.poll(async () => (await chartSnapshot()).inicio).toBe(true);
    expect((await chartSnapshot()).strip).toBe(false);

    const sparkSymbol = page.locator('#viewInicio .inicio-card.balance-card .balance-symbol');
    const preferenceBefore = (await chartSnapshot()).preference;
    const flipped = preferenceBefore === '0' ? '1' : '0';
    await sparkSymbol.click();
    await expect.poll(async () => (await chartSnapshot()).preference).toBe(flipped);
    const toggled = await chartSnapshot();
    expect(toggled.ariaExpanded).toBe(String(flipped !== '0'));
    await expect.poll(async () => (await chartSnapshot()).inicio).toBe(flipped !== '0');
    expect((await chartSnapshot()).strip).toBe(false);
    await sparkSymbol.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await chartSnapshot()).preference).toBe(preferenceBefore === '0' ? '0' : '1');
    await page.keyboard.press('Space');
    await expect.poll(async () => (await chartSnapshot()).preference).toBe(flipped);
    await ensureSparkVisible();

    await page.locator('#balanceStrip > .pocket-summary-card').click();
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'pockets');
    await app.openTab(page, 'inicio');
    await page.locator('#balanceStrip > .invest-summary-card').click();
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'invest');
    await app.openTab(page, 'inicio');
    await page.locator('#balanceStrip > .bank-summary-card').click();
    await expect(page.locator('#panelBanco')).toHaveClass(/open/);
    await page.evaluate(() => window.closeAllPanels?.());

    await app.openTab(page, 'inicio');
    const investSymbol = page.locator('#balanceStrip > .invest-summary-card .balance-symbol');
    const breakdownBefore = await page.locator('#investBreakdownBox').getAttribute('aria-hidden');
    await investSymbol.click();
    const breakdownAfter = await page.locator('#investBreakdownBox').getAttribute('aria-hidden');
    expect(breakdownAfter).not.toBe(breakdownBefore);
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'inicio');
    await investSymbol.click();
    expect(await page.locator('#investBreakdownBox').getAttribute('aria-hidden')).toBe(breakdownBefore);

    const healthBefore = (await page.locator('#viewInicio .advanced-dashboard').innerText()).trim();
    const flowBefore = (await page.locator('#viewInicio .cashflow-mini-summary').innerText()).trim();
    expect(healthBefore.length).toBeGreaterThan(0);
    expect(flowBefore.length).toBeGreaterThan(0);
    await app.openTab(page, 'dashboard');
    await app.openTab(page, 'inicio');
    expect(await page.locator('#viewInicio .advanced-dashboard').count()).toBe(1);
    expect(await page.locator('#viewInicio .cashflow-mini-summary').count()).toBe(1);
    expect((await page.locator('#viewInicio .advanced-dashboard').innerText()).trim()).toBe(healthBefore);
    expect((await page.locator('#viewInicio .cashflow-mini-summary').innerText()).trim()).toBe(flowBefore);

    await testInfo.attach('inicio-redesign.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });

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
