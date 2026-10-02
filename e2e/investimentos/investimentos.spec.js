'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { signIn, listCollection } = require('../helpers/firestore-rest');

/* Investimentos — cobre a separação entre quantidade (unidades) e valor em BRL:
   1. aviso de movimentações legadas sem 'units' + saldo auditável em unidades;
   2. conciliação com a corretora (saldo informado → lançamento de ajuste);
   3. precisão de 8 casas e 'units' no bloco de exportação.
   Nenhuma suíte cria movimentação cripto sem unidades pela UI — o cenário
   legado é semeado de propósito, sem apagar o registro persistido. */
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
  const LEGACY_AMOUNT = 0.37;
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

  /* Estado serializável do app — usado para assegurar que a conciliação de UM
     ativo não toca nos demais ativos nem nas caixinhas. */
  async function snapshot(page) {
    return page.evaluate(() => {
      const nameOf = (id) => {
        const inv = investments.find((i) => i.id === id);
        if (inv) return inv.name;
        const p = pockets.find((x) => x.id === id);
        return p ? p.name : '';
      };
      return {
        investments: investments
          .map((i) => ({
            name: i.name,
            units: i.units ?? null,
            value: Number(i.value || 0),
            price: Number(i.price || 0),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        pockets: pockets
          .map((p) => ({ name: p.name, initial: Number(p.initial ?? 0), balance: pocketCurrentBalance(p) }))
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        yields: yieldsLog
          .map((y) => ({
            targetName: nameOf(y.targetId),
            kind: y.kind,
            units: y.units ?? null,
            amount: Number(y.amount || 0),
            desc: String(y.desc || ''),
          }))
          .sort((a, b) => `${a.targetName}|${a.desc}|${a.amount}`.localeCompare(`${b.targetName}|${b.desc}|${b.amount}`, 'pt-BR')),
      };
    });
  }

  const withoutUsdt = (snap) => ({
    investments: snap.investments.filter((i) => i.name !== NAME_USDT),
    pockets: snap.pockets,
    yields: snap.yields.filter((y) => y.targetName !== NAME_USDT),
  });
  const yieldsUsdt = (snap) => snap.yields.filter((y) => y.targetName === NAME_USDT);

  test('aviso de movimentações sem quantidade, saldo auditável em unidades e registro legado preservado', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();

    let reset1;
    try {
      reset1 = await qa.reset();
    } catch (err) {
      if (err.code === 'CODE_BLOCKED') {
        test.skip(true, `BLOCKED: reset do ambiente QA — ${err.message}`);
      }
      throw err;
    }
    testInfo.annotations.push({ type: 'reset', description: `antes: ${reset1.deleted} doc(s)` });

    await startPage(page, creds);
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
       cenário de dado legado/importado que o aviso precisa cobrir. */
    const seededId = await page.evaluate(
      async ({ name, amount, desc }) => {
        const inv = investments.find((x) => x.name === name);
        if (!inv) return null;
        yieldsLog.push({
          id: 'legado-unidades-nulas-1',
          targetType: 'invest',
          targetId: inv.id,
          kind: 'rendimento',
          date: todayISO(),
          dateEnd: todayISO(),
          units: null,
          price: null,
          amount,
          desc,
        });
        render();
        await persistAll();
        return inv.id;
      },
      { name: NAME_USDT, amount: LEGACY_AMOUNT, desc: LEGACY_DESC }
    );
    expect(seededId, 'semear o registro legado no ativo USDT').toBeTruthy();

    await expect(card(page, NAME_USDT).locator('.asset-card-units-warning')).toHaveText(AVISO_1);
    /* A movimentação legada não entra no saldo: a quantidade continua a inicial. */
    await expect(
      card(page, NAME_USDT).locator('.asset-card-meta span').first(),
      'saldo em unidades não pode absorver movimentação sem quantidade'
    ).toHaveText(`Qtd: ${UNITS_INICIAL_BR} ${NAME_USDT}`);

    const hist = await openHistory(page, NAME_USDT);
    await expect(hist, 'registro legado continua listado').toContainText(LEGACY_DESC);
    const audit = hist.locator('.yield-row .history-audit strong');
    await expect(audit.nth(0), 'saldo anterior do registro legado em unidades').toHaveText(
      `${UNITS_INICIAL_BR} ${NAME_USDT}`
    );
    await expect(audit.nth(1), 'alteração de movimentação sem quantidade').toHaveText(`+0 ${NAME_USDT}`);
    await expect(audit.nth(2), 'saldo posterior do registro legado em unidades').toHaveText(
      `${UNITS_INICIAL_BR} ${NAME_USDT}`
    );
    await expect(hist.locator('.yield-row .history-value').first()).toContainText('R$ 0,37');
    await card(page, NAME_USDT).locator('details.yield-history summary').click();

    await page.evaluate(() => {
      const t = document.getElementById('logFilterType');
      const m = document.getElementById('logFilterModule');
      const q = document.getElementById('logFilterText');
      if (t) t.value = '';
      if (m) m.value = '';
      if (q) q.value = '';
      openDiagnostics();
    });
    await expect(page.locator('#diagnosticoList'), 'aviso registrado no diagnóstico').toContainText(AVISO_1);
    await expect(page.locator('#diagnosticoList')).toContainText(`no saldo de ${NAME_USDT}`);
    await page.evaluate(() => closeAllPanels());

    const rest = await signIn(creds.email, creds.password);
    const storedYields = await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog');
    const legado = storedYields
      .map((d) => d.fields)
      .find((m) => m.targetType === 'invest' && String(m.desc || '') === LEGACY_DESC);
    expect(legado, 'registro legado apagado do Firestore').toBeTruthy();
    expect(legado.units == null, 'registro legado deveria seguir sem units').toBe(true);
    expect(Number(legado.amount), 'valor do registro legado no Firestore').toBe(LEGACY_AMOUNT);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('conciliação: saldo informado vira lançamento de ajuste sem tocar nos demais ativos', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openInvest(page);

    const antes = await snapshot(page);
    expect(yieldsUsdt(antes), 'cenário depende do registro legado do teste anterior').toHaveLength(1);
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
    await expect(card(page, NAME_USDT).locator('.asset-card-units-warning')).toHaveCount(0);

    const hist = await openHistory(page, NAME_USDT);
    await expect(hist).toContainText(AJUSTE_DESC);
    await expect(hist).toContainText(`${AJUSTE_BR} ${NAME_USDT}`);
    await expect(hist.locator('.yield-row').first()).toContainText('Rendimento');
    await card(page, NAME_USDT).locator('details.yield-history summary').click();

    const depois = await snapshot(page);
    expect(
      withoutUsdt(depois),
      'conciliação alterou ativos/Renda Fixa/bitcoin/caixinha que não participam do ajuste'
    ).toEqual(withoutUsdt(antes));
    expect(yieldsUsdt(depois), 'a conciliação deve acrescentar exatamente um lançamento').toHaveLength(2);

    const ajuste = yieldsUsdt(depois).find((y) => y.desc === AJUSTE_DESC);
    expect(ajuste, 'lançamento de ajuste ausente').toBeTruthy();
    expect(ajuste.kind, 'diferença positiva vira rendimento').toBe('rendimento');
    expect(String(ajuste.units), 'unidades do ajuste').toBe('0.05923258');
    expect(ajuste.units == null, 'ajuste não pode nascer sem quantidade').toBe(false);

    const rest = await signIn(creds.email, creds.password);
    const storedYields = await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog');
    const storedAjuste = storedYields
      .map((d) => d.fields)
      .find((m) => String(m.desc || '') === AJUSTE_DESC);
    expect(storedAjuste, 'lançamento de ajuste ausente no Firestore').toBeTruthy();
    expect(Number(storedAjuste.units), 'unidades do ajuste no Firestore').toBeCloseTo(0.05923258, 10);
    expect(
      storedYields.map((d) => d.fields).filter((m) => String(m.desc || '') === LEGACY_DESC),
      'registro legado não pode ser reescrito pela conciliação'
    ).toHaveLength(1);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('precisão de 8 casas e unidades no bloco de exportação de investimentos', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openInvest(page);

    const utilitarios = await page.evaluate(() => ({
      abaixoDeUmCentavo: fmtPrecise(0.0049),
      valorNormal: fmtPrecise(0.37),
      estavel: formatCryptoUnits('Stablecoin', 0.00097734, 'USDT'),
      estavelCheia: formatCryptoUnits('Stablecoin', 11.89509469, 'USDT'),
      sats: formatCryptoUnits('Bitcoin', 100000, 'BTC'),
    }));
    expect(utilitarios.abaixoDeUmCentavo, 'fmtPrecise zeraria valor abaixo de 1 centavo').toBe('R$ 0,0049');
    expect(utilitarios.valorNormal, 'fmtPrecise divergiu do formato padrão').toBe('R$ 0,37');
    expect(utilitarios.estavel).toBe('0,00097734 USDT');
    expect(utilitarios.estavelCheia).toBe(`${UNITS_INICIAL_BR} USDT`);
    expect(utilitarios.sats, 'Bitcoin segue em SATS inteiros').toBe('100.000 SATS');

    const bloco = await page.evaluate(
      (name) => getInvestmentsExportBlock('2000-01-01', '2099-12-31').find((b) => b.name === name),
      NAME_USDT
    );
    expect(bloco, 'ativo USDT ausente do bloco de exportação').toBeTruthy();
    expect(bloco.units, 'quantidade do ativo no cabeçalho da exportação').toBe(UNITS_REAL_BR);

    const ajuste = bloco.movements.find((m) => String(m.units || '').startsWith(AJUSTE_BR));
    expect(ajuste, 'movimentação de ajuste sem quantidade na exportação').toBeTruthy();
    expect(ajuste.kind).toBe('Rendimento');
    expect(ajuste.amount).toBeCloseTo(0.05923258 * PRECO_USDT, 8);

    const legado = bloco.movements.find((m) => Number(m.amount) === LEGACY_AMOUNT);
    expect(legado, 'movimentação legada ausente da exportação').toBeTruthy();
    expect(legado.units, 'movimentação legada não pode inventar quantidade').toBe('');
  });
});
