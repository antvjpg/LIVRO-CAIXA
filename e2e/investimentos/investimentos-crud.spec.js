'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { signIn, resetWithSession, listCollection } = require('../helpers/firestore-rest');
const invOracle = require('../oracles/investment');

/* CRUD completo do módulo de investimentos: criação (4 tipos), validações,
   movimentações (crypto e simples), rentabilidade, histórico auditário,
   edição de ativo e de movimentação, exclusão de movimentação e de ativo,
   valores grandes/decimais, isolamento entre contas. Serial por design —
   cada teste reutiliza o estado Firestore deixado pelo anterior. */

const NAME_ST = 'CODE_TEST_INVCRUD_ST_001';
const NAME_RF = 'CODE_TEST_INVCRUD_RF_001';
const NAME_OUT = 'CODE_TEST_INVCRUD_OUT_001';
const NAME_BTC = 'CODE_TEST_INVCRUD_BTC_001';

const UNITS_ST = 12.5;
const PRICE_ST = 5.10;
const VALUE_RF = 1000;
const VALUE_OUT = 250;
const UNITS_BTC = 100000;
const PRICE_BTC = 650000;
const INST_RF = 'Corretora Teste C.O.D.E.';
const INST_RF_EDIT = 'Corretora Editada C.O.D.E.';

function toPlainInvest(fields) {
  return {
    id: String(fields.id),
    name: fields.name,
    type: fields.type,
    value: fields.value == null ? null : Number(fields.value),
    units: fields.units == null ? null : Number(fields.units),
    initialUnits: fields.initialUnits == null ? null : Number(fields.initialUnits),
    initialValue: fields.initialValue == null ? null : Number(fields.initialValue),
    price: fields.price == null ? null : Number(fields.price),
    institution: fields.institution || '',
  };
}

function toPlainYield(fields) {
  return {
    id: String(fields.id),
    targetType: fields.targetType,
    targetId: String(fields.targetId),
    kind: fields.kind || 'rendimento',
    amount: Number(fields.amount) || 0,
    units: fields.units == null ? null : Number(fields.units),
    price: fields.price == null ? null : Number(fields.price),
  };
}

const card = (page, name) => page.locator('#investGrid .asset-card', { hasText: name });

test.describe.serial('Investimentos — CRUD completo (serial)', () => {
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

  async function waitDialog(dialogs, texto) {
    await expect
      .poll(() => dialogs.map((d) => d.message).join(' | '), {
        timeout: 15_000,
        message: `dialogo com "${texto}"`,
      })
      .toContain(texto);
  }

  async function openInvest(page) {
    await app.openTab(page, 'invest');
    await expect(page.locator('#universalPeriodBar')).toBeVisible({ timeout: 10_000 });
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

  async function waitMovementPanelClosed(page) {
    await page.waitForFunction(() => !document.querySelector('#panelInvestMovement.open'), null, { timeout: 25_000 });
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
    if (type === 'Outros') {
      await fillMoney(page, '#iValorSimples', value);
    }
    await clickGuarded(page, '#iSalvar');
    await waitInvestPanelClosed(page);
    await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
  }

  async function editAsset(page, name, changes = {}) {
    await card(page, name).locator('button[aria-label="Editar"]').click();
    await page.waitForSelector('#panelInvest.open', { timeout: 15_000 });
    if (changes.price != null) await fillMoney(page, '#iCotacao', changes.price);
    if (changes.institution != null) await page.fill('#iInstituicao', changes.institution);
    if (changes.value != null) await fillMoney(page, '#iValorSimples', changes.value);
    await clickGuarded(page, '#iSalvar');
    await waitInvestPanelClosed(page);
  }

  async function openMovement(page, name, kind = 'aporte') {
    await card(page, name).locator('button[aria-label="Movimentações"]').click();
    await page.waitForSelector('#panelInvestMovement.open', { timeout: 15_000 });
    if (kind === 'resgate') await page.click('#imResgate');
    else if (kind === 'rendimento') await page.click('#imRendimento');
    else await page.click('#imAporte');
  }

  async function saveCryptoMovement(page, { units, price }) {
    await page.fill('#imQuantidade', String(units));
    await fillMoney(page, '#imCotacao', price);
    await clickGuarded(page, '#imSalvar');
    await waitMovementPanelClosed(page);
  }

  async function saveSimpleMovement(page, { amount }) {
    await fillMoney(page, '#imValor', amount);
    await clickGuarded(page, '#imSalvar');
    await waitMovementPanelClosed(page);
  }

  async function openHistory(page, name) {
    await card(page, name).locator('details.yield-history summary').click();
    return card(page, name).locator('.yield-history-list');
  }

  async function editYieldByKind(page, name, kindLabel) {
    const list = await openHistory(page, name);
    const row = list.locator('.yield-row', { hasText: kindLabel }).first();
    await row.locator('button[aria-label="Editar movimentação"]').click();
    await page.waitForSelector('#panelInvestMovement.open', { timeout: 15_000 });
  }

  async function deleteYieldByKind(page, name, kindLabel) {
    const list = await openHistory(page, name);
    const row = list.locator('.yield-row', { hasText: kindLabel }).first();
    await row.locator('button[aria-label="Excluir movimentação"]').click();
  }

  async function stripTotal(page) {
    return app.parseCurrency(await page.textContent('#investBalanceStrip .balance-card.total .amount'));
  }

  async function cardValue(page, name) {
    return app.parseCurrency(await card(page, name).locator('.asset-card-value').textContent());
  }

  async function snapshot(rest) {
    const [investments, yields] = await Promise.all([
      listCollection(rest.uid, rest.idToken, rest.projectId, 'investments'),
      listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog'),
    ]);
    const investmentsPlain = investments.map((d) => toPlainInvest(d.fields));
    const yieldsPlain = yields.map((d) => toPlainYield(d.fields));
    return { investments, yields, investmentsPlain, yieldsPlain };
  }

  async function conferirOracle(rest, name) {
    const snap = await snapshot(rest);
    const invDoc = snap.investments.find((d) => d.fields.name === name);
    if (!invDoc) throw new Error(`investments/${name} ausente no Firestore`);
    const assetPlain = toPlainInvest(invDoc.fields);
    const value = invOracle.investmentDisplayValue(assetPlain, snap.yieldsPlain);
    const units = invOracle.cryptoCurrentUnits(assetPlain, snap.yieldsPlain);
    return { assetPlain, value, units, snap };
  }

  test('1. criação (4 tipos), validações, tripla conferência e persistência', async ({ page }, testInfo) => {
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

    const dialogs = await startPage(page, creds);
    await openInvest(page);

    // validações de criação
    await openNewAsset(page);
    await page.fill('#iNome', '');
    await clickGuarded(page, '#iSalvar');
    await waitDialog(dialogs, 'Informe o nome do ativo.');
    await page.fill('#iNome', NAME_ST);
    await page.fill('#iUnidades', '-1');
    await clickGuarded(page, '#iSalvar');
    await waitDialog(dialogs, 'O saldo inicial não pode ser negativo.');
    await page.click('#panelInvest .modal-close');

    // cria os 4 ativos
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_ST, type: 'Stablecoin', units: UNITS_ST, price: PRICE_ST });
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_RF, type: 'Renda Fixa', institution: INST_RF, value: VALUE_RF });
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_OUT, type: 'Outros', value: VALUE_OUT });
    await openNewAsset(page);
    await saveAsset(page, { name: NAME_BTC, type: 'Bitcoin', units: UNITS_BTC, price: PRICE_BTC });

    // strip total vs oracle
    const snap = await snapshot(await sessionFromPage(page));
    const expectedTotal = invOracle.totalInvestBalance(snap.investmentsPlain, snap.yieldsPlain);
    expect(await stripTotal(page), 'strip total × oracle').toBeCloseTo(expectedTotal, 2);

    // tripla conferência por ativo: oracle × UI
    for (const name of [NAME_ST, NAME_RF, NAME_OUT, NAME_BTC]) {
      const conf = await conferirOracle(await sessionFromPage(page), name);
      expect(await cardValue(page, name), `card ${name} × oracle`).toBeCloseTo(conf.value, 2);
    }

    // persistência após reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#authOverlay', { state: 'attached' });
    expect(await app.isLoggedIn(page), 'sessão preservada após o reload').toBe(true);
    await app.waitForDataReady(page);
    await openInvest(page);
    for (const name of [NAME_ST, NAME_RF, NAME_OUT, NAME_BTC]) {
      await expect(card(page, name), `card ${name} visível após reload`).toBeVisible({ timeout: 20_000 });
    }
    expect(await stripTotal(page), 'strip total após reload').toBeCloseTo(expectedTotal, 2);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('2. movimentações (crypto e RF), validações, rentabilidade e histórico auditário', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openInvest(page);

    // --- crypto validações ---
    await openMovement(page, NAME_ST, 'aporte');
    await page.fill('#imQuantidade', '');
    await clickGuarded(page, '#imSalvar');
    await waitDialog(dialogs, 'Informe uma quantidade válida.');
    await page.fill('#imQuantidade', '10');
    await page.fill('#imCotacao', '');
    await clickGuarded(page, '#imSalvar');
    await waitDialog(dialogs, 'Informe uma cotação válida ou use o botão de cotação para buscá-la.');
    // resgate > saldo
    await page.click('#imResgate');
    await page.fill('#imQuantidade', '100');
    await fillMoney(page, '#imCotacao', PRICE_ST);
    await clickGuarded(page, '#imSalvar');
    await waitDialog(dialogs, 'O resgate não pode ser maior que o saldo disponível');
    await page.click('#panelInvestMovement .modal-close');

    // --- crypto movimentações ---
    await openMovement(page, NAME_ST, 'aporte');
    await saveCryptoMovement(page, { units: 10, price: 5.10 });
    await openMovement(page, NAME_ST, 'rendimento');
    await saveCryptoMovement(page, { units: 5, price: 5.20 });
    await openMovement(page, NAME_ST, 'resgate');
    await saveCryptoMovement(page, { units: 3, price: 5.30 });

    // ST final: units 24.5, value 24.5*5.30=129.85
    const confSt = await conferirOracle(await sessionFromPage(page), NAME_ST);
    expect(await cardValue(page, NAME_ST), 'card ST após movimentações').toBeCloseTo(129.85, 2);
    expect(confSt.units, 'unidades ST após movimentações').toBeCloseTo(24.5, 6);

    // --- RF movimentações ---
    await openMovement(page, NAME_RF, 'aporte');
    await saveSimpleMovement(page, { amount: 200 });
    await openMovement(page, NAME_RF, 'rendimento');
    await saveSimpleMovement(page, { amount: 50 });
    await openMovement(page, NAME_RF, 'resgate');
    await saveSimpleMovement(page, { amount: 100 });

    // RF value final: 1000+200+50-100=1150
    const confRf = await conferirOracle(await sessionFromPage(page), NAME_RF);
    expect(await cardValue(page, NAME_RF), 'card RF após movimentações').toBeCloseTo(1150, 2);

    // rentabilidade positiva no RF: totalYield=50, base=1100, pct≈4.55
    const rfBox = card(page, NAME_RF).locator('.rentability-box');
    await expect(rfBox).toBeVisible();
    await expect(rfBox.locator('.yield-pos')).toBeVisible();
    const rfRent = invOracle.rentability(confRf.assetPlain, confRf.snap.yieldsPlain, 1150);
    await expect(rfBox).toContainText(`(${rfRent.pct.toFixed(2)}%)`);

    // sem rentabilidade no OUT
    await expect(card(page, NAME_OUT).locator('.rentability-box')).toHaveCount(0);

    // histórico auditário — RF (BRL): mais recente primeiro
    const rfHist = await openHistory(page, NAME_RF);
    await expect(rfHist.locator('.yield-row')).toHaveCount(3);
    const rfFirst = rfHist.locator('.yield-row').first();
    await expect(rfFirst.locator('.history-kind')).toHaveText('Resgate');
    await expect(rfFirst.locator('.history-audit strong').nth(0)).toContainText('1.250,00');
    await expect(rfFirst.locator('.history-audit strong').nth(2)).toContainText('1.150,00');

    // histórico auditário — ST (unidades): mais recente primeiro
    const stHist = await openHistory(page, NAME_ST);
    await expect(stHist.locator('.yield-row')).toHaveCount(3);
    const stFirst = stHist.locator('.yield-row').first();
    await expect(stFirst.locator('.history-kind')).toHaveText('Resgate');
    await expect(stFirst.locator('.history-audit strong').nth(0)).toContainText('27,5');
    await expect(stFirst.locator('.history-audit strong').nth(2)).toContainText('24,5');

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('3. edição de ativo e movimentação, rentabilidade negativa, exclusões e valores grandes', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openInvest(page);

    // editar ST preço → recalc (finalUnits=24.5, value=24.5*5.50=134.75)
    await editAsset(page, NAME_ST, { price: 5.50 });
    expect(await cardValue(page, NAME_ST), 'card ST após editar preço').toBeCloseTo(134.75, 2);

    // editar RF instituição
    await editAsset(page, NAME_RF, { institution: INST_RF_EDIT });
    await expect(card(page, NAME_RF), 'instituição editada visível').toContainText(INST_RF_EDIT);

    // editar RF aporte 200→300: value final 1000+300+50-100=1250
    await editYieldByKind(page, NAME_RF, 'Aporte');
    await page.fill('#imValor', '');
    await fillMoney(page, '#imValor', 300);
    await clickGuarded(page, '#imSalvar');
    await waitMovementPanelClosed(page);
    expect(await cardValue(page, NAME_RF), 'card RF após editar aporte').toBeCloseTo(1250, 2);

    // rentabilidade após edição: base=1200, pct≈4.17
    const rfBox = card(page, NAME_RF).locator('.rentability-box');
    const confRf2 = await conferirOracle(await sessionFromPage(page), NAME_RF);
    const rfRent2 = invOracle.rentability(confRf2.assetPlain, confRf2.snap.yieldsPlain, 1250);
    await expect(rfBox).toContainText(`(${rfRent2.pct.toFixed(2)}%)`);

    // excluir RF resgate → value 1000+300+50=1350
    await deleteYieldByKind(page, NAME_RF, 'Resgate');
    await waitDialog(dialogs, 'Deseja excluir este registro de movimentação? O saldo será ajustado automaticamente.');
    await expect.poll(async () => cardValue(page, NAME_RF), { timeout: 10_000 }).toBeCloseTo(1350, 2);
    const rfHist2 = await openHistory(page, NAME_RF);
    await expect(rfHist2.locator('.yield-row')).toHaveCount(2);

    // rentabilidade negativa no OUT via SDK (seed) — Firestore path livrocaixa/{uid}
    const rest = await sessionFromPage(page);
    await page.evaluate(
      async ({ name, amount }) => {
        const uid = window.firebase?.auth?.()?.currentUser?.uid;
        if (!uid) throw new Error('uid ausente');
        const base = window.firebase.firestore().collection('livrocaixa').doc(uid);
        const invs = await base.collection('investments').get();
        const inv = invs.docs.find((d) => d.data().name === name);
        if (!inv) throw new Error(`investimento ${name} ausente`);
        const targetId = String(inv.data().id || inv.id);
        const now = new Date();
        const hoje = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        await base.collection('yieldsLog').doc('invcrud-neg-1').set({
          id: 'invcrud-neg-1',
          targetType: 'invest',
          targetId,
          kind: 'rendimento',
          amount,
          date: hoje,
          dateEnd: hoje,
        });
        return targetId;
      },
      { name: NAME_OUT, amount: -30 }
    );

    // força re-render abrindo/fechando a aba
    await openInvest(page);
    const outBox = card(page, NAME_OUT).locator('.rentability-box');
    await expect(outBox, 'rentabilidade negativa visível').toBeVisible({ timeout: 15_000 });
    await expect(outBox.locator('.yield-neg')).toBeVisible();
    // base=280, pct≈-10.71
    await expect(outBox).toContainText('(-10.71%)');

    // adicionar aporte BTC e depois excluir ativo (limpa yieldsLog)
    await openMovement(page, NAME_BTC, 'aporte');
    await saveCryptoMovement(page, { units: 50000, price: PRICE_BTC });
    await card(page, NAME_BTC).locator('button[aria-label="Excluir"]').click();
    await waitDialog(dialogs, 'Deseja excluir este registro de investimento?');
    await expect(card(page, NAME_BTC), 'card BTC excluído').toHaveCount(0, { timeout: 20_000 });

    // yieldsLog limpo: nenhum yield órfão (targetId sem investimento correspondente)
    const snapAfterBtc = await snapshot(await sessionFromPage(page));
    const orphan = snapAfterBtc.yieldsPlain.filter((y) => {
      const inv = snapAfterBtc.investmentsPlain.find((i) => i.id === y.targetId);
      return !inv;
    });
    expect(orphan, 'sem yields órfãos após exclusão de BTC').toHaveLength(0);

    // valores grandes/decimais: editar OUT → 1.234.567,89
    await editAsset(page, NAME_OUT, { value: 1234567.89 });
    expect(await cardValue(page, NAME_OUT), 'card OUT valor grande').toBeCloseTo(1234567.89, 2);
    await expect(card(page, NAME_OUT).locator('.asset-card-value')).toContainText('1.234.567,89');

    // persistência após reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#authOverlay', { state: 'attached' });
    await app.waitForDataReady(page);
    await openInvest(page);
    await expect(card(page, NAME_ST), 'ST após reload').toBeVisible({ timeout: 20_000 });
    await expect(card(page, NAME_RF), 'RF após reload').toBeVisible({ timeout: 20_000 });
    await expect(card(page, NAME_OUT), 'OUT após reload').toBeVisible({ timeout: 20_000 });
    await expect(card(page, NAME_BTC), 'BTC continua excluído').toHaveCount(0);
    expect(await cardValue(page, NAME_RF), 'RF valor persistido').toBeCloseTo(1350, 2);
    expect(await cardValue(page, NAME_OUT), 'OUT valor persistido').toBeCloseTo(1234567.89, 2);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('4. isolamento: conta B não enxerga ativos da conta A', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openInvest(page);

    // conta A ainda tem 3 ativos (ST, RF, OUT)
    expect(await page.locator('#investGrid .asset-card').count(), 'conta A deveria ter 3 ativos').toBe(3);

    const credsB = { ...creds, email: creds.email.replace('@', '+2@') };
    const sessaoB = await qa.ensureSecondaryAccount(page, credsB);
    if (sessaoB.status !== 'ok') {
      test.skip(true, `BLOCKED: conta secundária indisponível — ${sessaoB.error}`);
    }
    await app.waitForDataReady(page);
    await openInvest(page);

    // grid vazio para B
    await expect(page.locator('#investGrid .empty')).toContainText('Nenhum ativo ou investimento cadastrado', { timeout: 20_000 });
    expect(await page.locator('#investGrid .asset-card').count(), 'conta B não deveria ver ativos').toBe(0);
    expect(await stripTotal(page), 'total da conta B').toBeCloseTo(0, 2);

    // Firestore REST de B: investments e yieldsLog vazios
    const restB = await signIn(credsB.email, credsB.password);
    const invB = await listCollection(restB.uid, restB.idToken, restB.projectId, 'investments');
    const yieldsB = await listCollection(restB.uid, restB.idToken, restB.projectId, 'yieldsLog');
    expect(invB, 'Firestore da conta B investments vazio').toHaveLength(0);
    expect(yieldsB, 'Firestore da conta B yieldsLog vazio').toHaveLength(0);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });
});
