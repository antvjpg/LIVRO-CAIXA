/* C6-INICIO-03 — Orçamentos na Início: cálculo, isolamento e responsividade.
   Os estados financeiros são injetados apenas em memória para tornar os cálculos
   determinísticos; persistência permanece coberta por e2e/orcamento. */
'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const qa = require('../helpers/qa-account');

test.describe('Início — bloco de Orçamentos', () => {
  let watchAtual = null;

  test.afterEach(async ({ page }, testInfo) => {
    await page
      .evaluate(() => {
        const original = window.__inicioBudgetOriginalState;
        if (!original) return;
        budgets = original.budgets;
        entries = original.entries;
        categories = original.categories;
        if (typeof renderInicioBudgets === 'function') renderInicioBudgets();
        delete window.__inicioBudgetOriginalState;
      })
      .catch(() => {});
    watchAtual?.attach(testInfo);
    watchAtual = null;
  });

  async function abrir(page) {
    const creds = resolveCredentials();
    app.attachDialogHandler(page);
    watchAtual = watchPage(page);
    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
      test.skip(true, `BLOCKED: sem sessão QA — ${sessao.error}`);
    }
    await app.waitForDataReady(page);
    await expect(page.locator('#syncOverlay')).toBeHidden({ timeout: 30_000 });
    await app.openTab(page, 'inicio');
    await expect(page.locator('#viewInicio')).toHaveClass(/active/);
  }

  async function injetar(page, overrides = {}) {
    return page.evaluate((overrides) => {
      if (!window.__inicioBudgetOriginalState) {
        window.__inicioBudgetOriginalState = { budgets, entries, categories };
      }
      const cycle = currentFinancialCycleKey();
      const { start } = financialCycleRangeForKey(cycle);
      const nextCategories = overrides.categories || [
        { id: 'cat_alim', name: 'Alimentação' },
        { id: 'cat_moradia', name: 'Moradia' },
        { id: 'cat_transp', name: 'Transporte' },
        { id: 'cat_educ', name: 'Educação' },
      ];
      const nextBudgets = overrides.budgets === undefined
        ? [
            { id: 'bud_alim', categoryId: 'cat_alim', amount: 1000, month: cycle, updatedAt: '2026-01-01T00:00:00Z' },
            { id: 'bud_moradia', categoryId: 'cat_moradia', amount: 1500, month: cycle, updatedAt: '2026-01-01T00:00:00Z' },
            { id: 'bud_transp', categoryId: 'cat_transp', amount: 500, month: cycle, updatedAt: '2026-01-01T00:00:00Z' },
            { id: 'bud_educ', categoryId: 'cat_educ', amount: 2000, month: cycle, updatedAt: '2026-01-01T00:00:00Z' },
          ]
        : overrides.budgets;
      const nextEntries = overrides.entries === undefined
        ? [
            { id: 'e_alim', type: 'out', category: 'cat_alim', amount: overrides.alimSpent === undefined ? 1050 : overrides.alimSpent, date: start },
            { id: 'e_moradia', type: 'out', category: 'cat_moradia', amount: 1200, date: start },
            { id: 'e_transp', type: 'out', category: 'cat_transp', amount: 320, date: start },
            { id: 'e_educ', type: 'out', category: 'cat_educ', amount: 100, date: start },
          ]
        : overrides.entries;
      budgets = nextBudgets;
      entries = nextEntries;
      categories = nextCategories;
      renderInicioBudgets();
      return { cycle, start };
    }, overrides);
  }

  function snapshot(page) {
    return page.evaluate(() => {
      const host = document.getElementById('inicioBudgets');
      const text = (selector) => (host.querySelector(selector)?.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        hostCount: document.querySelectorAll('#inicioBudgets').length,
        summaryCount: host.querySelectorAll('.inicio-budget-summary').length,
        actionCount: host.querySelectorAll('[data-open-budget]').length,
        progressbars: host.querySelectorAll('[role="progressbar"]').length,
        empty: !!host.querySelector('.inicio-budget-empty'),
        emptyText: text('.inicio-budget-empty p'),
        cycle: text('#inicioBudgetCycle') || (document.getElementById('inicioBudgetCycle')?.textContent || '').trim(),
        percent: text('.inicio-budget-percent strong'),
        status: text('.inicio-budget-percent small'),
        values: [...host.querySelectorAll('.inicio-budget-values b')].map((el) => el.textContent.trim()),
        categories: [...host.querySelectorAll('.inicio-budget-category')].map((row) => ({
          name: (row.querySelector('.inicio-budget-category-head strong')?.textContent || '').trim(),
          percent: (row.querySelector('.inicio-budget-category-head b')?.textContent || '').trim(),
          values: (row.querySelector('.inicio-budget-category-values span')?.textContent || '').replace(/\s+/g, ' ').trim(),
          flag: (row.querySelector('.inicio-budget-flag')?.textContent || '').trim(),
          realPercent: row.querySelector('.inicio-budget-track i')?.getAttribute('data-real-percent') || null,
          ariaNow: row.querySelector('.inicio-budget-track')?.getAttribute('aria-valuenow') || null,
          ariaLabel: row.querySelector('.inicio-budget-track')?.getAttribute('aria-label') || null,
        })),
        totalTrack: {
          realPercent: host.querySelector('.inicio-budget-summary .inicio-budget-track i')?.getAttribute('data-real-percent') || null,
          ariaNow: host.querySelector('.inicio-budget-summary .inicio-budget-track')?.getAttribute('aria-valuenow') || null,
          ariaLabel: host.querySelector('.inicio-budget-summary .inicio-budget-track')?.getAttribute('aria-label') || null,
        },
      };
    });
  }

  test('calcula totais, prioriza categorias e mantém percentual real acima de 100%', async ({ page }) => {
    await abrir(page);
    await injetar(page);
    const snap = await snapshot(page);

    expect(snap.hostCount).toBe(1);
    expect(snap.summaryCount).toBe(1);
    expect(snap.actionCount).toBe(1);
    expect(snap.progressbars).toBe(4);
    expect(snap.empty).toBe(false);
    expect(snap.percent).toBe('53%');
    expect(snap.status).toBe('Dentro do limite');
    expect(snap.totalTrack.realPercent).toBe('53.40');
    expect(snap.totalTrack.ariaLabel).toBe('Utilização geral do orçamento');
    expect(snap.values).toEqual(['R$ 2.670,00', 'R$ 5.000,00', 'R$ 2.330,00']);

    expect(snap.categories.map((row) => row.name)).toEqual(['Alimentação', 'Moradia', 'Transporte']);
    expect(snap.categories[0].percent).toBe('105%');
    expect(snap.categories[0].flag).toBe('Excedido');
    expect(snap.categories[0].realPercent).toBe('105.00');
    expect(snap.categories[0].ariaNow).toBe('100');
    expect(snap.categories[1].percent).toBe('80%');
    expect(snap.categories[1].flag).toBe('Atenção');
    expect(snap.categories[2].percent).toBe('64%');
    expect(snap.categories[2].flag).toBe('');
    expect(snap.categories.every((row) => row.ariaLabel.startsWith('Utilização de '))).toBe(true);
  });

  test('atualiza após alteração de dados sem duplicar renderização', async ({ page }) => {
    await abrir(page);
    await injetar(page);
    await expect.poll(async () => (await snapshot(page)).categories[0].percent).toBe('105%');

    await injetar(page, { alimSpent: 1500 });
    const snap = await snapshot(page);
    expect(snap.summaryCount).toBe(1);
    expect(snap.progressbars).toBe(4);
    expect(snap.categories[0].percent).toBe('150%');
    expect(snap.categories[0].realPercent).toBe('150.00');
    expect(snap.categories[0].ariaNow).toBe('100');
    expect(snap.percent).toBe('62%');
  });

  test('exibe estado vazio e estado de limite zero sem percentuais fictícios', async ({ page }) => {
    await abrir(page);
    await injetar(page, { budgets: [], entries: [] });
    let snap = await snapshot(page);
    expect(snap.empty).toBe(true);
    expect(snap.emptyText).toContain('Você ainda não tem orçamentos');
    expect(snap.percent).toBe('');
    expect(snap.progressbars).toBe(0);

    await injetar(page, {
      budgets: [{ id: 'bud_zero', categoryId: 'cat_alim', amount: 0, month: '2026-01', updatedAt: '2026-01-01T00:00:00Z' }],
      entries: [],
    });
    snap = await snapshot(page);
    expect(snap.empty).toBe(true);
    expect(snap.emptyText).toContain('Defina limites');
    expect(snap.percent).toBe('');
  });

  test('ação existente abre o modal de orçamentos por clique e teclado', async ({ page }) => {
    await abrir(page);
    await injetar(page);

    const action = page.locator('#inicioBudgets [data-open-budget]');
    await expect(action).toHaveText(/Ver todos os orçamentos/);
    await action.click();
    await expect(page.locator('#panelOrcamento')).toHaveClass(/open/);
    await page.evaluate(() => window.closeAllPanels?.());
    await expect(page.locator('#panelOrcamento')).not.toHaveClass(/open/);

    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#panelOrcamento')).toHaveClass(/open/);
    await page.evaluate(() => window.closeAllPanels?.());
  });

  test('alternância com Visão Geral preserva o bloco e não duplica listeners', async ({ page }) => {
    await abrir(page);
    await injetar(page);
    await app.openTab(page, 'dashboard');
    await app.openTab(page, 'inicio');

    const overviewBefore = await page.evaluate(() => ({
      health: (document.querySelector('#viewDashboard .dashboard-health-card')?.textContent || '').replace(/\s+/g, ' ').trim(),
      inicioBlocks: document.querySelectorAll('#viewDashboard .inicio-budget-card, #viewDashboard .inicio-budgets').length,
    }));
    expect(overviewBefore.inicioBlocks).toBe(0);

    await page.evaluate(() => {
      window.__budgetOpenCount = 0;
      const original = window.openBudgetModal;
      window.openBudgetModal = () => {
        window.__budgetOpenCount += 1;
        if (typeof original === 'function') original();
      };
    });

    for (let index = 0; index < 5; index += 1) {
      await app.openTab(page, 'dashboard');
      await app.openTab(page, 'inicio');
    }

    const snap = await snapshot(page);
    expect(snap.hostCount).toBe(1);
    expect(snap.summaryCount).toBe(1);
    expect(snap.actionCount).toBe(1);
    expect(snap.progressbars).toBe(4);
    expect(snap.percent).toBe('53%');
    expect(snap.categories.map((row) => row.name)).toEqual(['Alimentação', 'Moradia', 'Transporte']);

    const overviewAfter = await page.evaluate(() => ({
      health: (document.querySelector('#viewDashboard .dashboard-health-card')?.textContent || '').replace(/\s+/g, ' ').trim(),
      inicioBlocks: document.querySelectorAll('#viewDashboard .inicio-budget-card, #viewDashboard .inicio-budgets').length,
    }));
    expect(overviewAfter.inicioBlocks).toBe(0);
    expect(overviewAfter.health).toBe(overviewBefore.health);

    await page.locator('#inicioBudgets [data-open-budget]').click();
    expect(await page.evaluate(() => window.__budgetOpenCount)).toBe(1);
    await page.evaluate(() => window.closeAllPanels?.());
  });

  test('responsividade sem overflow nem sobreposição em quatro viewports', async ({ page }) => {
    await abrir(page);
    await injetar(page);

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('#viewInicio .inicio-budget-card')).toBeVisible();
      const layout = await page.evaluate(() => {
        const card = document.querySelector('#viewInicio .inicio-budget-card');
        const box = card.getBoundingClientRect();
        const tracks = [...card.querySelectorAll('.inicio-budget-track')];
        const nav = document.querySelector('.mobile-bottom-nav');
        const navBox = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
        return {
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          cardLeft: Math.round(box.left),
          cardRight: Math.round(box.right),
          viewport: document.documentElement.clientWidth,
          tracks: tracks.length,
          trackWidths: tracks.map((track) => Math.round(track.getBoundingClientRect().width)),
          navOverlap: navBox ? Math.max(0, Math.min(box.bottom, navBox.bottom) - Math.max(box.top, navBox.top)) > 0 : false,
        };
      });
      expect(layout.horizontalOverflow, `overflow em ${viewport.width}`).toBe(false);
      expect(layout.cardLeft).toBeGreaterThanOrEqual(0);
      expect(layout.cardRight).toBeLessThanOrEqual(layout.viewport + 1);
      expect(layout.tracks).toBe(4);
      expect(layout.trackWidths.every((width) => width > 0)).toBe(true);
      expect(layout.navOverlap).toBe(false);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
