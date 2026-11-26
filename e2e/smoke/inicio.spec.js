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
    await expect(page.locator('main > .inicio-header h2')).toHaveText('Início');

    const cards = [
      { label: 'Patrimônio Total', selector: 'main > .inicio-patrimonio' },
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
    ];
    for (const selector of containers) {
      await expect(page.locator(selector), `container ${selector}`).toBeVisible();
    }

    const healthSelectors = [
      '.inicio-health-content',
      '.inicio-health-status',
      '.inicio-health-copy',
      '.inicio-health-eyebrow',
      '.inicio-health-label',
      '.inicio-health-metrics',
      '.inicio-health-metric',
    ];
    for (const selector of healthSelectors) {
      await expect(page.locator(`#viewInicio .advanced-dashboard ${selector}`).first(), `saúde ${selector}`).toBeVisible();
    }
    await expect(page.locator('#viewInicio .inicio-health-metric')).toHaveCount(3);

    const healthSnapshot = await page.evaluate(() => {
      const root = document.querySelector('#viewInicio .advanced-dashboard');
      const norm = (value) => (value || '').replace(/\s+/g, ' ').trim();
      const text = (selector) => norm(root?.querySelector(selector)?.textContent);
      const score = root?.querySelector('.inicio-health-score');
      const scoreValue = norm(score?.querySelector('strong')?.textContent);
      const surface = root ? getComputedStyle(root) : null;
      const metricNodes = Array.from(root?.querySelectorAll('.inicio-health-metric') || []);
      const flowNodes = Array.from(document.querySelectorAll('#viewDashboard .dashboard-metrics > div'));
      return {
        eyebrow: text('.inicio-health-eyebrow'),
        label: text('.inicio-health-label'),
        detail: text('.inicio-health-copy p'),
        score: score
          ? {
              present: true,
              value: scoreValue,
              hasDe100: text('.inicio-health-score').includes('de 100'),
              role: score.getAttribute('role'),
              ariaLabel: score.getAttribute('aria-label'),
            }
          : { present: false },
        metricLabels: metricNodes.map((node) => norm(node.querySelector('small')?.textContent)),
        metricValues: metricNodes.map((node) => norm(node.querySelector('strong')?.textContent)),
        flowLabels: flowNodes.map((node) => norm(node.querySelector('small')?.textContent)),
        flowValues: flowNodes.map((node) => norm(node.querySelector('strong')?.textContent)),
        surface: surface
          ? {
              backgroundColor: surface.backgroundColor,
              borderWidth: surface.borderWidth,
              boxShadow: surface.boxShadow,
              padding: surface.padding,
              borderRadius: surface.borderRadius,
            }
          : null,
      };
    });
    expect(healthSnapshot.eyebrow).toBe('Seu momento financeiro');
    expect(healthSnapshot.label.length).toBeGreaterThan(0);
    expect(healthSnapshot.detail.length).toBeGreaterThan(0);
    expect(healthSnapshot.metricLabels).toEqual(['Entradas', 'Saídas', 'Resultado']);
    expect(healthSnapshot.flowLabels).toEqual(['Entradas no mês', 'Saídas no mês', 'Fluxo líquido', 'Patrimônio atual']);
    expect(healthSnapshot.metricValues[0]).toBe(healthSnapshot.flowValues[0]);
    expect(healthSnapshot.metricValues[1]).toBe(healthSnapshot.flowValues[1]);
    expect(healthSnapshot.metricValues[2]).toBe(healthSnapshot.flowValues[2]);
    if (healthSnapshot.score.present) {
      expect(healthSnapshot.score.value).toMatch(/^\d+$/);
      expect(healthSnapshot.score.hasDe100).toBe(true);
      expect(healthSnapshot.score.role).toBe('img');
      expect(healthSnapshot.score.ariaLabel).toBe(`Score de saúde financeira: ${healthSnapshot.score.value} de 100`);
    } else {
      await expect(page.locator('#viewInicio .inicio-health-score')).toHaveCount(0);
    }
    expect(healthSnapshot.surface).not.toBeNull();
    expect(healthSnapshot.surface.backgroundColor).toMatch(/^(rgba\(0, 0, 0, 0\)|transparent)$/);
    expect(healthSnapshot.surface.borderWidth).toBe('0px');
    expect(healthSnapshot.surface.boxShadow).toBe('none');
    expect(healthSnapshot.surface.padding).toBe('0px');
    expect(healthSnapshot.surface.borderRadius).toBe('0px');
    await testInfo.attach('saude-financeira.json', {
      body: JSON.stringify(healthSnapshot, null, 2),
      contentType: 'application/json',
    });

    const surfaceSnapshot = await page.evaluate(() => {
      const cs = (selector) => getComputedStyle(document.querySelector(selector));
      return {
        patrimonioBackground: cs('main > .inicio-patrimonio').backgroundImage,
        patrimonioAmountSize: parseFloat(cs('main > .inicio-patrimonio .amount').fontSize),
        pageBackground: cs('main').backgroundColor,
        bankBackground: cs('#balanceStrip > .bank-summary-card').backgroundColor,
        healthBackground: cs('#viewInicio .advanced-dashboard-card').backgroundColor,
        bankPaddingTop: cs('#balanceStrip > .bank-summary-card').paddingTop,
        healthPaddingTop: cs('#viewInicio .advanced-dashboard-card').paddingTop,
        bankHeadMargin: cs('#balanceStrip > .bank-summary-card .balance-card-head').marginBottom,
      };
    });
    expect(surfaceSnapshot.patrimonioBackground).toContain('gradient');
    expect(surfaceSnapshot.patrimonioAmountSize).toBeGreaterThanOrEqual(27);
    expect(surfaceSnapshot.bankBackground).not.toBe(surfaceSnapshot.pageBackground);
    expect(surfaceSnapshot.healthBackground).toBe(surfaceSnapshot.bankBackground);
    expect(surfaceSnapshot.bankPaddingTop).toBe('16px');
    expect(surfaceSnapshot.healthPaddingTop).toBe('16px');
    expect(surfaceSnapshot.bankHeadMargin).toBe('6px');
    await testInfo.attach('superficies-inicio.json', {
      body: JSON.stringify(surfaceSnapshot, null, 2),
      contentType: 'application/json',
    });

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
        ariaExpanded: document.querySelector('main > .inicio-patrimonio .balance-symbol')?.getAttribute('aria-expanded') || null,
      };
    });
    const ensureSparkVisible = async () => {
      if ((await chartSnapshot()).preference === '0') {
        await page.locator('main > .inicio-patrimonio .balance-symbol').click();
      }
    };

    const stripSnapshot = await page.evaluate(() => ({
      tab: document.body.dataset.tab,
      labels: Array.from(document.querySelectorAll('#balanceStrip > .balance-card .label')).map((el) => (el.textContent || '').trim()),
      investLabelTitle: document.querySelector('#balanceStrip > .invest-summary-card .label')?.getAttribute('title') || null,
      hasTotalCard: !!document.querySelector('#balanceStrip > .balance-card.total'),
      localTotal: (document.querySelector('main > .inicio-patrimonio .amount')?.textContent || '').trim(),
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

    const layoutSnapshot = await page.evaluate(() => {
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
      };
      const header = rect('main > .inicio-header');
      const patrimonio = rect('main > .inicio-patrimonio');
      const bank = rect('#balanceStrip > .bank-summary-card');
      const pocket = rect('#balanceStrip > .pocket-summary-card');
      const invest = rect('#balanceStrip > .invest-summary-card');
      return {
        headerBeforePatrimonio: !!header && !!patrimonio && header.bottom <= patrimonio.top + 1,
        patrimonioBeforeBank: !!patrimonio && !!bank && patrimonio.bottom <= bank.top + 1,
        bankBeforePocket: !!bank && !!pocket && bank.bottom <= pocket.top + 1,
        bankFullWidth: !!bank && !!pocket && bank.width > pocket.width,
        pocketInvestSameRow: !!pocket && !!invest && Math.abs(pocket.top - invest.top) < 1 && pocket.right <= invest.left + 1,
        resumoFluxoCount: document.querySelectorAll('#viewInicio .cashflow-mini-summary').length,
        resumoFluxoText: (document.querySelector('#viewInicio')?.textContent || '').includes('Resumo do fluxo'),
        breakdownCollapsed: document.querySelector('#investBreakdownBox')?.getAttribute('aria-hidden') === 'true',
      };
    });
    expect(layoutSnapshot.headerBeforePatrimonio).toBe(true);
    expect(layoutSnapshot.patrimonioBeforeBank).toBe(true);
    expect(layoutSnapshot.bankBeforePocket).toBe(true);
    expect(layoutSnapshot.bankFullWidth).toBe(true);
    expect(layoutSnapshot.pocketInvestSameRow).toBe(true);
    expect(layoutSnapshot.resumoFluxoCount).toBe(0);
    expect(layoutSnapshot.resumoFluxoText).toBe(false);
    expect(layoutSnapshot.breakdownCollapsed).toBe(true);

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

    const sparkSymbol = page.locator('main > .inicio-patrimonio .balance-symbol');
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
    expect(breakdownBefore).toBe('true');
    expect(breakdownAfter).toBe('false');
    expect(breakdownAfter).not.toBe(breakdownBefore);
    await expect(page.locator('body')).toHaveAttribute('data-tab', 'inicio');
    await investSymbol.click();
    expect(await page.locator('#investBreakdownBox').getAttribute('aria-hidden')).toBe(breakdownBefore);

    const overviewSnapshot = () => page.evaluate(() => {
      const card = document.querySelector('#viewDashboard .dashboard-health-card');
      return {
        hasHealthCard: !!card,
        healthText: (card?.textContent || '').replace(/\s+/g, ' ').trim(),
        inicioMarkupCount: document.querySelectorAll('#viewDashboard .inicio-health-content').length,
      };
    });
    const healthBefore = (await page.locator('#viewInicio .advanced-dashboard').innerText()).trim();
    const patrimonioBefore = (await page.locator('main > .inicio-patrimonio').innerText()).trim();
    const overviewBefore = await overviewSnapshot();
    expect(healthBefore.length).toBeGreaterThan(0);
    expect(patrimonioBefore.length).toBeGreaterThan(0);
    expect(overviewBefore.hasHealthCard).toBe(true);
    expect(overviewBefore.inicioMarkupCount).toBe(0);
    await app.openTab(page, 'dashboard');
    await app.openTab(page, 'inicio');
    const overviewAfter = await overviewSnapshot();
    expect(overviewAfter.hasHealthCard).toBe(true);
    expect(overviewAfter.inicioMarkupCount).toBe(0);
    expect(overviewAfter.healthText).toBe(overviewBefore.healthText);
    expect(await page.locator('main > .inicio-patrimonio').count()).toBe(1);
    expect(await page.locator('#viewInicio .advanced-dashboard').count()).toBe(1);
    expect(await page.locator('#viewInicio .inicio-health-content').count()).toBe(1);
    expect(await page.locator('#viewInicio .cashflow-mini-summary').count()).toBe(0);
    expect((await page.locator('main > .inicio-patrimonio').innerText()).trim()).toBe(patrimonioBefore);
    expect((await page.locator('#viewInicio .advanced-dashboard').innerText()).trim()).toBe(healthBefore);

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
