'use strict';

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { resetWithSession, listCollection } = require('../helpers/firestore-rest');

/* Investimentos — cobre a separação entre quantidade (unidades) e valor em BRL:
   1. aviso de movimentações legadas sem 'units' + saldo auditável em unidades;
   2. conciliação com a corretora (saldo informado → lançamento de ajuste);
   3. precisão de 8 casas e 'units' na exportação de investimentos.
   O app inteiro roda dentro de um listener de DOMContentLoaded, então nenhum
   estado de negócio (investments, yieldsLog, fmtPrecise, getInvestmentsExportBlock,
   openDiagnostics, ...) é global. Os testes enxergam apenas o DOM e o Firestore
   (REST do C.O.D.E. ou SDK em window.firebase, que é global). Nenhuma suíte
   cria movimentação cripto sem unidades pela UI — o cenário legado é semeado
   de propósito, sem apagar o registro persistido. */
test.describe.serial('Investimentos — movimentações sem quantidade e conciliação de cripto', () => {
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

  const NAME_USDT = 'CODE_TEST_USDT_001';
  const NAME_BTC = 'CODE_TEST_BTC_001';
  const NAME_RF = 'CODE_TEST_RF_001';
  const NAME_CAIXA = 'CODE_TEST_CAIXA_001';

  const UNITS_INICIAL = 11.89509469;
  const UNITS_REAL = 11.95432727;
  const UNITS_REAL_BR = '11,95432727';
  const UNITS_INICIAL_BR = '11,89509469';
  const AJUSTE_BR = '0,05923258';
  /* Abaixo de um centavo de propósito: fmtPrecise entrega 'R$ 0,0049' enquanto
     fmt() arredondaria para 'R$ 0,00' — é o discriminador da regressão. */
  const LEGACY_AMOUNT = 0.0049;
  const LEGACY_BR = 'R$ 0,0049';
  const LEGACY_DESC = 'Movimentação legada importada';
  const AJUSTE_DESC = 'Ajuste de conciliação com a corretora';
  const PRECO_USDT = 5;
  const AVISO_1 = '1 movimentação sem quantidade não entra no saldo';

  const card = (page, name) => page.locator('#investGrid .asset-card', { hasText: name });

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

  /* Sessão REST lida da PRÓPRIA página logada (uid + idToken do SDK) em vez de
     accounts:signInWithPassword: essa última consome a cota de verificação de
     senha do Identity Toolkit, que estoura quando as suítes rodam em rajada
     (QUOTA_EXCEEDED) e derruba toda a suíte em série. O idToken emitido pelo
     login da UI serve para as mesmas leituras do Firestore REST. */
  async function sessionFromPage(page) {
    const sessao = await page.evaluate(async () => {
      try {
        const usuario = window.firebase?.auth?.()?.currentUser;
        const projectId = window.firebase?.app?.()?.options?.projectId;
        if (!usuario || !projectId) return null;
        return { uid: usuario.uid, idToken: await usuario.getIdToken(), projectId };
      } catch {
        return null;
      }
    });
    if (!sessao) {
      const err = new Error('BLOCKED: a página não tem sessão Firebase autenticada');
      err.code = 'CODE_BLOCKED';
      throw err;
    }
    return sessao;
  }

  function fillMoney(page, selector, value) {
    return page.fill(selector, String(Math.round(value * 100)));
  }

  async function clickGuarded(page, selector) {
    await app.esperaTravaAntiDuplo(page, selector);
    await page.click(selector);
  }

  async function openInvest(page) {
    await app.openTab(page, 'invest');
    /* A barra de período é colapsada por padrão e só existe nas abas
       caixa/investimentos/caixinhas — precisa abrir antes de escolher "Todos",
       senão o histórico auditável mostra só o mês corrente. */
    await expect(page.locator('#universalPeriodBar'), 'barra de período na aba Investimentos').toBeVisible({
      timeout: 10_000,
    });
    if (!(await page.locator('#btnPeriodAll').isVisible())) {
      await page.click('#btnTogglePeriodBar');
    }
    await expect(page.locator('#btnPeriodAll')).toBeVisible({ timeout: 10_000 });
    await page.click('#btnPeriodAll');
  }

  async function openNewAsset(page) {
    await page.click('#fabAdd');
    await page.waitForSelector('#panelInvest.open', { timeout: 15_000 });
  }

  async function waitInvestPanelClosed(page) {
    await page.waitForFunction(() => !document.querySelector('#panelInvest.open'), null, { timeout: 25_000 });
  }

  async function saveAsset(page, { name, type, units = null, price = null, institution = '', value = 0 }) {
    await page.fill('#iNome', name);
    if (type !== 'Stablecoin') await page.selectOption('#iTipo', type);
    if (units != null) await page.fill('#iUnidades', String(units));
    if (price != null) await fillMoney(page, '#iCotacao', price);
    if (type === 'Renda Fixa') {
      await page.fill('#iInstituicao', institution);
      await fillMoney(page, '#iValorSimples', value);
    }
    await clickGuarded(page, '#iSalvar');
    await waitInvestPanelClosed(page);
    await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
  }

  async function openHistory(page, name) {
    await card(page, name).locator('details.yield-history summary').click();
    return card(page, name).locator('.yield-history-list');
  }

  /* Estado persistido lido pelo Firestore REST — o mesmo oráculo usado pelas
     demais suítes. Nada aqui depende do estado em memória da aplicação. */
  async function snapshot(rest) {
    const read = async (col) =>
      listCollection(rest.uid, rest.idToken, rest.projectId, col).then((docs) =>
        docs
          .map((d) => ({ id: String(d.fields.id ?? d.path.split('/').pop()), fields: d.fields }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
    const [investments, pockets, yields] = await Promise.all([
      read('investments'),
      read('pockets'),
      read('yieldsLog'),
    ]);
    return { investments, pockets, yields };
  }

  const withoutUsdt = (snap, usdtId) => ({
    investments: snap.investments.filter((d) => d.fields.name !== NAME_USDT),
    pockets: snap.pockets,
    yields: snap.yields.filter((d) => d.fields.targetId !== usdtId),
  });
  const yieldsUsdt = (snap, usdtId) => snap.yields.filter((d) => d.fields.targetId === usdtId);

  test('aviso de movimentações sem quantidade, saldo auditável em unidades e registro legado preservado', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();

    await startPage(page, creds);

    let reset1;
    try {
      reset1 = await resetWithSession(await sessionFromPage(page));
    } catch (err) {
      if (err.code === 'CODE_BLOCKED') {
        test.skip(true, `BLOCKED: reset do ambiente QA — ${err.message}`);
      }
      throw err;
    }
    testInfo.annotations.push({ type: 'reset', description: `antes: ${reset1.deleted} doc(s)` });

    /* Recarrega sobre o Firestore já limpo: a aplicação volta a subir vendo o
       estado pós-reset, como no fluxo reset → abertura. A sessão fica no disco
       (localStorage), então o login não se repete. */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#authOverlay', { state: 'attached' });
    expect(await app.isLoggedIn(page), 'sessão preservada após o reload').toBe(true);
    await app.waitForDataReady(page);

    await openInvest(page);

    await openNewAsset(page);
    await saveAsset(page, { name: NAME_USDT, type: 'Stablecoin', units: UNITS_INICIAL, price: PRECO_USDT });
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_BTC, type: 'Bitcoin', units: 100000, price: 650000 });
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_RF, type: 'Renda Fixa', institution: 'Banco de Teste', value: 1000 });

    /* caixinha de referência — asseverada intocada no teste de conciliação */
    await app.openTab(page, 'pockets');
    await page.click('#fabAdd');
    await page.waitForSelector('#panelPocket.open', { timeout: 15_000 });
    await page.fill('#pNome', NAME_CAIXA);
    await fillMoney(page, '#pInicial', 250);
    await clickGuarded(page, '#pSalvar');
    await page.waitForFunction(() => !document.querySelector('#panelPocket.open'), null, { timeout: 25_000 });
    await openInvest(page);

    await expect(
      card(page, NAME_USDT).locator('.asset-card-meta span').first(),
      'saldo inicial do USDT em unidades'
    ).toHaveText(`Qtd: ${UNITS_INICIAL_BR} ${NAME_USDT}`);
    await expect(card(page, NAME_USDT).locator('.asset-card-units-warning')).toHaveCount(0);

    /* Semeadura: nenhuma UI cria movimentação cripto sem 'units' — este é o
       cenário de dado legado/importado que o aviso precisa cobrir. Escrita
       externa pelo SDK (window.firebase é global) enquanto a aplicação roda:
       o onSnapshot de yieldsLog aplica o documento e chama render(). */
    const seededId = await page.evaluate(
      async ({ name, amount, desc }) => {
        const uid = window.firebase?.auth?.()?.currentUser?.uid;
        if (!uid) return null;
        const base = window.firebase.firestore().collection('livrocaixa').doc(uid);
        const snap = await base.collection('investments').get();
        const inv = snap.docs.find((d) => d.data().name === name);
        if (!inv) return null;
        const targetId = String(inv.data().id || inv.id);
        const now = new Date();
        const hoje = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        await base.collection('yieldsLog').doc('legado-unidades-nulas-1').set({
          id: 'legado-unidades-nulas-1',
          targetType: 'invest',
          targetId,
          kind: 'rendimento',
          date: hoje,
          dateEnd: hoje,
          amount,
          desc,
        });
        return targetId;
      },
      { name: NAME_USDT, amount: LEGACY_AMOUNT, desc: LEGACY_DESC }
    );
    expect(seededId, 'semear o registro legado no ativo USDT').toBeTruthy();

    await expect(card(page, NAME_USDT).locator('.asset-card-units-warning'), 'aviso no card').toHaveText(
      AVISO_1,
      { timeout: 20_000 }
    );
    /* A movimentação legada não entra no saldo: a quantidade continua a inicial. */
    await expect(
      card(page, NAME_USDT).locator('.asset-card-meta span').first(),
      'saldo em unidades não pode absorver movimentação sem quantidade'
    ).toHaveText(`Qtd: ${UNITS_INICIAL_BR} ${NAME_USDT}`);

    const hist = await openHistory(page, NAME_USDT);
    await expect(hist, 'registro legado continua listado').toContainText(LEGACY_DESC);
    await expect(hist.locator('.yield-row .history-value').first(), 'fmtPrecise abaixo de um centavo').toContainText(
      LEGACY_BR
    );
    const audit = hist.locator('.yield-row .history-audit strong');
    await expect(audit.nth(0), 'saldo anterior do registro legado em unidades').toHaveText(
      `${UNITS_INICIAL_BR} ${NAME_USDT}`
    );
    await expect(audit.nth(1), 'alteração de movimentação sem quantidade').toHaveText(`+0 ${NAME_USDT}`);
    await expect(audit.nth(2), 'saldo posterior do registro legado em unidades').toHaveText(
      `${UNITS_INICIAL_BR} ${NAME_USDT}`
    );
    await card(page, NAME_USDT).locator('details.yield-history summary').click();

    /* Diagnóstico pela rota real de UI (drawer), sem invocar funções internas. */
    await page.click('#btnOpenDrawer');
    await page.click('#appDrawerOverlay .app-drawer [data-drawer-action="diagnostico"]');
    await page.waitForSelector('#panelDiagnostico.open', { timeout: 15_000 });
    await expect(page.locator('#diagnosticoList'), 'aviso registrado no diagnóstico').toContainText(AVISO_1, {
      timeout: 20_000,
    });
    await expect(page.locator('#diagnosticoList')).toContainText(`no saldo de ${NAME_USDT}`);
    await page.evaluate(() => window.closeAllPanels());

    const rest = await sessionFromPage(page);
    const storedYields = await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog');
    const legado = storedYields
      .map((d) => d.fields)
      .find((m) => m.targetType === 'invest' && String(m.desc || '') === LEGACY_DESC);
    expect(legado, 'registro legado apagado do Firestore').toBeTruthy();
    expect(legado.units == null, 'registro legado deveria seguir sem units').toBe(true);
    expect(Number(legado.amount), 'valor do registro legado no Firestore').toBeCloseTo(LEGACY_AMOUNT, 10);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('conciliação: saldo informado vira lançamento de ajuste sem tocar nos demais ativos', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openInvest(page);

    const rest = await sessionFromPage(page);
    const antes = await snapshot(rest);
    const usdt = antes.investments.find((d) => d.fields.name === NAME_USDT);
    expect(usdt, 'ativo USDT ausente no Firestore').toBeTruthy();
    const usdtId = usdt.id;
    expect(yieldsUsdt(antes, usdtId), 'cenário depende do registro legado do teste anterior').toHaveLength(1);
    await expect(card(page, NAME_USDT).locator('.asset-card-units-warning')).toHaveText(AVISO_1);

    await card(page, NAME_USDT).locator('button[aria-label="Conciliar saldo com a corretora"]').click();
    await page.waitForSelector('#panelCryptoReconcile.open', { timeout: 15_000 });
    await expect(page.locator('#crSaldoRealLabel')).toHaveText('Saldo na corretora (quantidade)');

    await page.fill('#crSaldoReal', String(UNITS_REAL));
    await expect(page.locator('#crPreview')).toContainText(`Saldo atual: ${UNITS_INICIAL_BR} ${NAME_USDT}`);
    await expect(page.locator('#crPreview')).toContainText(`Saldo informado: ${UNITS_REAL_BR} ${NAME_USDT}`);
    await expect(page.locator('#crPreview')).toContainText(
      `Diferença: +${AJUSTE_BR} ${NAME_USDT} → Rendimento`
    );

    await clickGuarded(page, '#crConfirmar');
    await page.waitForFunction(() => !document.querySelector('#panelCryptoReconcile.open'), null, { timeout: 25_000 });

    await expect(
      card(page, NAME_USDT).locator('.asset-card-meta span').first(),
      'quantidade após a conciliação'
    ).toHaveText(`Qtd: ${UNITS_REAL_BR} ${NAME_USDT}`);
    await expect(
      card(page, NAME_USDT).locator('.asset-card-units-warning'),
      'o registro legado segue sem quantidade, então o aviso não some com a conciliação'
    ).toHaveText(AVISO_1);

    const hist = await openHistory(page, NAME_USDT);
    await expect(hist).toContainText(AJUSTE_DESC);
    await expect(hist).toContainText(`${AJUSTE_BR} ${NAME_USDT}`);
    await expect(hist.locator('.yield-row').first()).toContainText('Rendimento');
    await card(page, NAME_USDT).locator('details.yield-history summary').click();

    const depois = await snapshot(rest);
    expect(
      withoutUsdt(depois, usdtId),
      'conciliação alterou ativos/Renda Fixa/bitcoin/caixinha que não participam do ajuste'
    ).toEqual(withoutUsdt(antes, usdtId));
    expect(yieldsUsdt(depois, usdtId), 'a conciliação deve acrescentar exatamente um lançamento').toHaveLength(2);

    const ajuste = yieldsUsdt(depois, usdtId).find((d) => String(d.fields.desc || '') === AJUSTE_DESC);
    expect(ajuste, 'lançamento de ajuste ausente').toBeTruthy();
    expect(ajuste.fields.kind, 'diferença positiva vira rendimento').toBe('rendimento');
    expect(Number(ajuste.fields.units), 'unidades do ajuste no Firestore').toBeCloseTo(0.05923258, 10);
    expect(ajuste.fields.units == null, 'ajuste não pode nascer sem quantidade').toBe(false);

    const legados = depois.yields.filter((d) => String(d.fields.desc || '') === LEGACY_DESC);
    expect(legados, 'registro legado não pode ser reescrito pela conciliação').toHaveLength(1);
    expect(legados[0].fields.units == null, 'registro legado preservado sem units').toBe(true);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('precisão de 8 casas e unidades no bloco de exportação de investimentos', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openInvest(page);

    /* Quantidade do ativo na prévia e nos cards — formatCryptoUnits (8 casas,
       Bitcoin em SATS inteiros). */
    await expect(
      card(page, NAME_BTC).locator('.asset-card-meta span').first(),
      'Bitcoin segue em SATS inteiros'
    ).toHaveText('Qtd: 100.000 SATS');
    await expect(
      card(page, NAME_USDT).locator('.asset-card-meta span').first(),
      'unidades do ativo estável em 8 casas'
    ).toHaveText(`Qtd: ${UNITS_REAL_BR} ${NAME_USDT}`);

    /* Exportação pela rota real de UI: botão da aba Caixa → prévia → PDF. */
    await app.openTab(page, 'caixa');
    await page.evaluate(() => {
      const start = document.getElementById('filterDateStart');
      const end = document.getElementById('filterDateEnd');
      if (start) start.value = '2000-01-01';
      if (end) end.value = '2099-12-31';
    });
    await clickGuarded(page, '#btnExport');
    await page.waitForSelector('#panelExportFormat.open', { timeout: 15_000 });

    const linhas = page.locator('#exportPreview .export-preview-row', {
      hasText: `${NAME_USDT} · Rendimento`,
    });
    await expect(linhas, 'duas movimentações de rendimento do USDT na prévia').toHaveCount(2);

    const legada = linhas.filter({ hasText: LEGACY_BR });
    await expect(legada, 'movimentação legada ausente da prévia').toHaveCount(1);
    await expect(
      legada.locator('span').nth(1),
      'movimentação legada não pode inventar quantidade'
    ).toHaveText('Stablecoin');
    await expect(legada.locator('b'), 'fmtPrecise abaixo de um centavo na prévia').toContainText(LEGACY_BR);

    const ajuste = linhas.filter({ hasText: AJUSTE_BR });
    await expect(ajuste, 'movimentação de ajuste sem quantidade na prévia').toHaveCount(1);
    await expect(ajuste.locator('span').nth(1)).toHaveText(`Stablecoin · ${AJUSTE_BR} ${NAME_USDT}`);
    await expect(ajuste.locator('b'), 'fmtPrecise de valor normal na prévia').toContainText('R$ 0,30');

    await expect(
      page.locator('#exportPreview .export-preview-sub', { hasText: NAME_USDT }),
      'valor atual do ativo na prévia'
    ).toContainText('R$ 59,77');

    /* O PDF é o único formato que expõe a quantidade no cabeçalho do ativo. */
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45_000 }),
      clickGuarded(page, '#btnExportFormatPdf'),
    ]);
    expect(await download.suggestedFilename(), 'nome do PDF exportado').toMatch(
      /^livro-caixa-extrato-\d{4}-\d{2}-\d{2}\.pdf$/
    );
    const caminho = await download.path();
    expect(caminho, 'arquivo PDF baixado').toBeTruthy();
    const pdf = fs.readFileSync(caminho, 'latin1');
    expect(pdf, 'quantidade do ativo no cabeçalho do PDF').toContain(UNITS_REAL_BR);
    expect(pdf, 'quantidade da movimentação de ajuste no PDF').toContain(AJUSTE_BR);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });
});
