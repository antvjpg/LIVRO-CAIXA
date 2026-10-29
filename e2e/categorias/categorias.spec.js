'use strict';

/* P1 — Categorias: criação, edição, exclusão, subcategorias (popover,
   prompt, exclusão) e persistência. Modal aberto via #btnCategoria (perfil)
   ou #btnQuickCat (formulário de lançamento). */

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');

test.describe.serial('Categorias — CRUD, subcategorias e persistência', () => {
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

  /* Nomes únicos por execução para não colidir com dados reais */
  const uniq = Date.now().toString(36);
  const catName = `CatTeste ${uniq}`;
  const catNameEdited = `${catName} Editada`;
  const subName = `SubTeste ${uniq}`;
  const subNameEdited = `${subName} v2`;

  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* Linha da categoria na lista gerenciada */
  const catRow = (page, name) =>
    page.locator('#catManageList .cat-list-item', {
      has: page.locator('.cat-name', { hasText: new RegExp(`^${esc(name)}$`) }),
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

  /* Abre o modal de categorias a partir do perfil */
  async function openCategoryModal(page) {
    await app.openTab(page, 'profile');
    await page.click('#btnCategoria');
    await page.waitForSelector('#panelCategoria.open', { timeout: 10_000 });
  }

  /* Fecha o modal se ainda estiver aberto */
  async function closeCategoryModal(page) {
    const aberto = await page.isVisible('#panelCategoria.open').catch(() => false);
    if (aberto) {
      await page.click('#panelCategoria .modal-close');
      await page.waitForFunction(() => !document.querySelector('#panelCategoria.open'), null, { timeout: 5_000 });
    }
  }

  /* Conta as linhas de categoria na lista */
  async function countCategories(page) {
    return page.locator('#catManageList .cat-list-item').count();
  }

  /* Verifica se uma subcategoria está visível dentro da linha da categoria */
  async function subcategoryVisible(page, catName, subName) {
    const row = catRow(page, catName);
    return row.locator('.sub-cat-label', { hasText: subName }).isVisible().catch(() => false);
  }

  /* Espera a trava anti-duplo liberar (mesmo padrão de helpers/app.js) */
  async function esperaTrava(page, selector) {
    await page
      .waitForFunction(
        (sel) => {
          const btn = document.querySelector(sel);
          return !btn || Date.now() >= Number(btn.dataset.actionLockedUntil || 0);
        },
        selector,
        { timeout: 5_000 }
      )
      .catch(() => {});
  }

  test.beforeEach(async ({ page }, testInfo) => {
    const creds = skipSemCredencial();
    await startPage(page, creds);
  });

  /* ---------- CRUD básico ---------- */

  test('cria categoria, aparece na lista e persiste após reabrir', async ({ page }) => {
    await openCategoryModal(page);

    const antes = await countCategories(page);
    await page.fill('#cNome', catName);
    await esperaTrava(page, '#cSalvar');
    await page.click('#cSalvar');

    /* input limpa após salvar */
    await expect(page.locator('#cNome')).toHaveValue('');

    /* categoria aparece na lista */
    await expect(catRow(page, catName)).toBeVisible({ timeout: 10_000 });

    /* lista cresceu */
    const depois = await countCategories(page);
    expect(depois).toBe(antes + 1);

    /* fecha e reabre — persistência local (categories[] em memória) */
    await closeCategoryModal(page);
    await openCategoryModal(page);
    await expect(catRow(page, catName)).toBeVisible({ timeout: 10_000 });
  });

  test('edita categoria existente (renomeia)', async ({ page }) => {
    await openCategoryModal(page);

    /* garante que a categoria existe (pode já ter sido criada no teste anterior) */
    const existe = await catRow(page, catName).isVisible().catch(() => false);
    if (!existe) {
      await page.fill('#cNome', catName);
      await esperaTrava(page, '#cSalvar');
      await page.click('#cSalvar');
      await expect(catRow(page, catName)).toBeVisible({ timeout: 10_000 });
    }

    /* clica no botão de editar (ícone lápis) */
    await catRow(page, catName).locator('.cat-actions .action-btn[aria-label*="ditar"], .cat-actions .action-btn[aria-label*="dit"]').first().click();

    /* formulário preenche com dados existentes */
    await expect(page.locator('#cNome')).toHaveValue(catName);
    await expect(page.locator('#cSalvar')).toHaveText(/Salvar Altera/);

    /* renomeia e salva */
    await page.fill('#cNome', catNameEdited);
    await esperaTrava(page, '#cSalvar');
    await page.click('#cSalvar');

    /* botão volta para "Adicionar" */
    await expect(page.locator('#cSalvar')).toHaveText('Adicionar');

    /* nome atualizado na lista */
    await expect(catRow(page, catNameEdited)).toBeVisible({ timeout: 10_000 });
  });

  test('exclui categoria com confirmação', async ({ page }) => {
    await openCategoryModal(page);

    /* garante que a categoria existe */
    const existe = await catRow(page, catNameEdited).isVisible().catch(() => false)
      || await catRow(page, catName).isVisible().catch(() => false);
    const alvo = existe ? (await catRow(page, catNameEdited).isVisible().catch(() => false) ? catNameEdited : catName) : null;
    if (!alvo) {
      test.skip(true, 'categoria não encontrada — teste anterior falhou');
    }

    const antes = await countCategories(page);

    /* clica no botão de excluir (ícone lixeira, classe .del) */
    await catRow(page, alvo).locator('.cat-actions .action-btn.del').click();

    /* dialog confirm() é aceito pelo attachDialogHandler */
    await page.waitForFunction(() => !document.querySelector('#panelCategoria.open'), null, { timeout: 10_000 });

    /* reabre e verifica que sumiu */
    await openCategoryModal(page);
    await expect(catRow(page, alvo)).toBeHidden({ timeout: 10_000 });
    const depois = await countCategories(page);
    expect(depois).toBe(antes - 1);
  });

  /* ---------- Subcategorias ---------- */

  test('adiciona subcategoria via popover, edita e exclui', async ({ page }) => {
    await openCategoryModal(page);

    /* recria a categoria base para este teste */
    await page.fill('#cNome', catName);
    await esperaTrava(page, '#cSalvar');
    await page.click('#cSalvar');
    await expect(catRow(page, catName)).toBeVisible({ timeout: 10_000 });

    /* --- adicionar subcategoria via popover --- */
    await catRow(page, catName).locator('.cat-actions .action-btn.add').click();

    /* popover abre */
    await expect(page.locator('#subcat-popover')).toBeVisible({ timeout: 5_000 });
    await page.fill('#subcat-popover input', subName);
    await page.click('#subcat-popover button:has-text("Confirmar")');

    /* popover fecha */
    await expect(page.locator('#subcat-popover')).toBeHidden({ timeout: 5_000 });

    /* subcategoria aparece na linha da categoria */
    await expect(catRow(page, catName).locator('.sub-cat-label', { hasText: subName })).toBeVisible({ timeout: 10_000 });

    /* --- editar subcategoria via prompt --- */
    /* o prompt() é interceptado pelo attachDialogHandler que aceita com texto default;
       precisamos interceptar e enviar o novo nome */
    page.once('dialog', async (dialog) => {
      /* prompt abre com valor atual — aceita e substitui */
      await dialog.accept(subNameEdited);
    });
    await catRow(page, catName).locator('.sub-cat-label', { hasText: subName }).click();

    /* aguarda re-render com novo nome */
    await expect(catRow(page, catName).locator('.sub-cat-label', { hasText: subNameEdited })).toBeVisible({ timeout: 10_000 });

    /* --- excluir subcategoria via × --- */
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await catRow(page, catName).locator('.sub-cat-label', { hasText: subNameEdited }).locator('..').locator('.sub-del').click();

    /* subcategoria some */
    await expect(catRow(page, catName).locator('.sub-cat-label', { hasText: subNameEdited })).toBeHidden({ timeout: 10_000 });
  });

  test('não duplica subcomcategoria com mesmo nome (case-insensitive)', async ({ page }) => {
    await openCategoryModal(page);

    /* garante categoria com subcategoria existente */
    const row = catRow(page, catName);
    const temSub = await row.locator('.sub-cat-label', { hasText: subName }).isVisible().catch(() => false);
    if (!temSub) {
      await row.locator('.cat-actions .action-btn.add').click();
      await page.fill('#subcat-popover input', subName);
      await page.click('#subcat-popover button:has-text("Confirmar")');
      await expect(row.locator('.sub-cat-label', { hasText: subName })).toBeVisible({ timeout: 10_000 });
    }

    /* tenta adicionar subcomcategoria com mesmo nome (caixa diferente) */
    await row.locator('.cat-actions .action-btn.add').click();
    await page.fill('#subcat-popover input', subName.toUpperCase());
    await page.click('#subcat-popover button:has-text("Confirmar")');

    /* popover NÃO fecha (validação rejeita) */
    await expect(page.locator('#subcat-popover')).toBeVisible({ timeout: 3_000 });

    /* fecha o popover manualmente */
    await page.click('#subcat-popover button:has-text("Cancelar")');
    await expect(page.locator('#subcat-popover')).toBeHidden({ timeout: 5_000 });
  });
});
