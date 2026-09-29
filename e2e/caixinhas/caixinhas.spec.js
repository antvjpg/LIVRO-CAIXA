'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { signIn, listCollection } = require('../helpers/firestore-rest');
const { fixtures } = require('../fixtures/fixtures');
const { pocketBalance, progressLabel, pocketsTotal } = require('../oracles/pocket');
const { formatBRL } = require('../oracles/money');

test.describe.serial('Caixinhas — criação, saldo, progresso, persistência e exclusão', () => {
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

  const p = fixtures.pockets;
  const nameC1 = p.c1.name;
  const nameC2 = p.c2.name;
  const nameC1Edited = nameC1 + p.edit.nameSuffix;
  const KIND_LABEL = { aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento' };

  const card = (page, name) => page.locator('#pocketGrid .invest-box', { hasText: name });

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

  async function openPockets(page) {
    await app.openTab(page, 'pockets');
  }

  async function cardBalance(page, name) {
    return app.parseCurrency(await card(page, name).locator('.val').textContent());
  }

  async function cardProgress(page, name) {
    const label = card(page, name).locator('.pocket-goal-head strong');
    if ((await label.count()) === 0) return null;
    return (await label.textContent()).trim();
  }

  async function stripTotal(page) {
    return app.parseCurrency(await page.textContent('#pocketBalanceStrip .balance-card.total .amount'));
  }

  async function waitDialog(dialogs, texto) {
    await expect
      .poll(() => dialogs.map((d) => d.message).join(' | '), { timeout: 15_000, message: `dialogo com "${texto}"` })
      .toContain(texto);
  }

  function fillMoney(page, selector, value) {
    return page.fill(selector, String(Math.round(value * 100)));
  }

  async function clickGuarded(page, selector) {
    await app.esperaTravaAntiDuplo(page, selector);
    await page.click(selector);
  }

  async function waitPocketPanelClosed(page) {
    await page.waitForFunction(() => !document.querySelector('#panelPocket.open'), null, { timeout: 25_000 });
  }

  async function waitMovementPanelClosed(page) {
    await page.waitForFunction(() => !document.querySelector('#panelPocketMovement.open'), null, { timeout: 25_000 });
  }

  async function openNewPocket(page) {
    await page.click('#fabAdd');
    await page.waitForSelector('#panelPocket.open', { timeout: 15_000 });
  }

  async function savePocket(page, { name, goal = '', goalAmount = 0, initial = 0 }) {
    await page.fill('#pNome', name);
    await page.fill('#pObjetivo', goal);
    await fillMoney(page, '#pMetaValor', goalAmount);
    await fillMoney(page, '#pInicial', initial);
    await clickGuarded(page, '#pSalvar');
    await waitPocketPanelClosed(page);
    await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
  }

  async function openEditPocket(page, name) {
    await card(page, name).locator('button[aria-label="Editar caixinha"]').click();
    await page.waitForSelector('#panelPocket.open', { timeout: 15_000 });
  }

  async function openMovement(page, name, kind = 'aporte') {
    await card(page, name).locator('button[aria-label="Movimentações da caixinha"]').click();
    await page.waitForSelector('#panelPocketMovement.open', { timeout: 15_000 });
    if (kind === 'resgate') await page.click('#pmResgate');
    else if (kind === 'rendimento') await page.click('#pmRendimento');
    await expect(page.locator('#panelPocketMovement #pmSalvar')).toHaveText(`Registrar ${KIND_LABEL[kind]}`);
  }

  async function submitMovement(page, { amount, date = p.date, desc = '' }) {
    await page.fill('#pmData', date);
    if (desc) await page.fill('#pmDesc', desc);
    await fillMoney(page, '#pmValor', amount);
    await clickGuarded(page, '#pmSalvar');
  }

  async function savedPocketMovements(rest, pocketId) {
    const log = await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog');
    return log.map((d) => d.fields).filter((m) => m.targetType === 'pocket' && m.targetId === pocketId);
  }

  test('criação com validações, movimentações, saldo × oracle × Firestore e reload', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
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
    await openPockets(page);

    await expect(page.locator('#pocketGrid .empty')).toContainText('Nenhuma caixinha cadastrada');
    expect(await stripTotal(page), 'total inicial deveria ser 0').toBe(0);

    await openNewPocket(page);

    await clickGuarded(page, '#pSalvar');
    await waitDialog(dialogs, 'Informe o nome da caixinha.');
    await expect(page.locator('#panelPocket.open')).toBeVisible();

    await page.fill('#pInicial', '-10000');
    expect(
      app.parseCurrency(await page.inputValue('#pInicial')),
      'máscara não pode produzir saldo inicial negativo'
    ).toBe(100);

    await savePocket(page, { name: nameC1, goal: p.c1.goal, goalAmount: p.c1.goalAmount, initial: p.c1.initial });
    await openNewPocket(page);
    await savePocket(page, { name: nameC2, goal: p.c2.goal, goalAmount: p.c2.goalAmount, initial: p.c2.initial });

    expect(await cardBalance(page, nameC2), 'caixinha com valor inicial zero').toBe(0);
    await expect(
      card(page, nameC2).locator('.pocket-goal'),
      'caixinha sem objetivo não deve exibir barra de progresso'
    ).toHaveCount(0);

    await openMovement(page, nameC1, 'aporte');
    await page.fill('#pmData', p.date);
    await fillMoney(page, '#pmValor', 0);
    await clickGuarded(page, '#pmSalvar');
    await waitDialog(dialogs, 'Informe um valor válido.');
    await expect(page.locator('#panelPocketMovement.open')).toBeVisible();

    await submitMovement(page, { amount: p.movements[0].amount, desc: p.movements[0].desc });
    await waitMovementPanelClosed(page);
    for (const mov of p.movements.slice(1)) {
      await openMovement(page, nameC1, mov.kind);
      await submitMovement(page, { amount: mov.amount, desc: mov.desc });
      await waitMovementPanelClosed(page);
    }

    const oracle1 = pocketBalance({ initial: p.c1.initial, movements: p.movements });
    const progresso1 = progressLabel(oracle1, p.c1.goalAmount);
    const total1 = pocketsTotal([
      { initial: p.c1.initial, movements: p.movements },
      { initial: p.c2.initial, movements: [] },
    ]);
    expect(oracle1, 'saldo esperado (constante escrita à mão)').toBe(p.expected.balance);
    expect(progresso1, 'progresso esperado').toBe(p.expected.progress);
    expect(total1, 'total esperado').toBe(p.expected.total);

    await expect
      .poll(() => cardBalance(page, nameC1), { timeout: 20_000, message: 'saldo da caixinha após movimentações' })
      .toBe(oracle1);
    expect(await cardProgress(page, nameC1), 'progresso diverge do ORACLE').toBe(progresso1);
    const valores = (await card(page, nameC1).locator('.pocket-goal-values').textContent()).replace(/ /g, ' ');
    expect(valores, 'valores do progresso divergem do ORACLE').toBe(
      `R$ ${formatBRL(oracle1)} de R$ ${formatBRL(p.c1.goalAmount)}`
    );
    await expect.poll(() => stripTotal(page), { timeout: 20_000, message: 'total em caixinhas' }).toBe(total1);

    const evidencia = [
      `UI    : saldo=${await cardBalance(page, nameC1)} progresso=${await cardProgress(page, nameC1)} total=${await stripTotal(page)}`,
      `ORACLE: saldo=${oracle1} progresso=${progresso1} total=${total1}`,
      `reset antes=${reset1.deleted} docs | dialogos=${dialogs.length}`,
    ].join('\n');
    await testInfo.attach('ui-vs-oracle.txt', { body: evidencia, contentType: 'text/plain' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openPockets(page);
    expect(await cardBalance(page, nameC1), 'saldo mudou após reload').toBe(oracle1);
    expect(await cardProgress(page, nameC1), 'progresso mudou após reload').toBe(progresso1);
    expect(await stripTotal(page), 'total mudou após reload').toBe(total1);

    const rest = await signIn(creds.email, creds.password);
    const storedPockets = await listCollection(rest.uid, rest.idToken, rest.projectId, 'pockets');
    const storedC1 = storedPockets.find((d) => d.fields.name === nameC1);
    const storedC2 = storedPockets.find((d) => d.fields.name === nameC2);
    expect(storedC1, 'caixinha 1 ausente no Firestore').toBeTruthy();
    expect(storedC2, 'caixinha 2 ausente no Firestore').toBeTruthy();
    expect(Number(storedC1.fields.initial), 'DIVERGÊNCIA: initial no Firestore').toBe(p.c1.initial);
    expect(Number(storedC1.fields.goalAmount), 'DIVERGÊNCIA: goalAmount no Firestore').toBe(p.c1.goalAmount);
    expect(storedC1.fields.goal, 'DIVERGÊNCIA: objetivo no Firestore').toBe(p.c1.goal);
    expect(Number(storedC2.fields.initial), 'DIVERGÊNCIA: initial zero no Firestore').toBe(0);

    const c1Id = storedC1.path.split('/').pop();
    const storedMoves = await savedPocketMovements(rest, c1Id);
    expect(storedMoves, 'movimentações da caixinha no Firestore').toHaveLength(p.movements.length);
    expect(
      storedMoves.map((m) => m.kind).sort(),
      'kinds das movimentações no Firestore'
    ).toEqual(p.movements.map((m) => m.kind).sort());
    expect(
      storedMoves.map((m) => Number(m.amount)).sort((a, b) => a - b),
      'valores das movimentações no Firestore'
    ).toEqual(p.movements.map((m) => m.amount).sort((a, b) => a - b));

    const saldoStored = pocketBalance({ initial: Number(storedC1.fields.initial), movements: storedMoves });
    expect(saldoStored, 'DIVERGÊNCIA: saldo calculado dos dados persistidos ≠ ORACLE').toBe(oracle1);

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('editar caixinha: dados, progresso limitado a 100% e valor muito grande persistem', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openPockets(page);

    await expect(card(page, nameC1)).toBeVisible();
    expect(await cardBalance(page, nameC1)).toBe(p.expected.balance);

    await openEditPocket(page, nameC1);
    await expect(page.locator('#panelPocketTitle')).toContainText('Editar Caixinha');
    await expect(page.locator('#pSalvar')).toHaveText('Atualizar Caixinha');
    expect(
      app.parseCurrency(await page.inputValue('#pInicial')),
      'formulário deve abrir com o saldo inicial atual'
    ).toBe(p.c1.initial);

    await page.fill('#pNome', nameC1Edited);
    await page.fill('#pObjetivo', p.edit.goal);
    await fillMoney(page, '#pMetaValor', p.edit.goalAmount);
    await fillMoney(page, '#pInicial', p.edit.initial);
    await clickGuarded(page, '#pSalvar');
    await waitPocketPanelClosed(page);

    await expect(card(page, nameC1Edited)).toBeVisible({ timeout: 15_000 });
    const balanceEdited = pocketBalance({ initial: p.edit.initial, movements: p.movements });
    const progressEdited = progressLabel(balanceEdited, p.edit.goalAmount);
    expect(balanceEdited, 'saldo esperado após edição').toBe(p.expected.editedBalance);
    expect(progressEdited, 'progresso esperado após edição').toBe(p.expected.editedProgress);
    await expect
      .poll(() => cardBalance(page, nameC1Edited), { timeout: 20_000, message: 'saldo após edição' })
      .toBe(balanceEdited);
    expect(await cardProgress(page, nameC1Edited), 'progresso após edição').toBe(progressEdited);
    expect((await card(page, nameC1Edited).locator('h4 span').textContent()).trim(), 'nome editado na UI').toBe(
      nameC1Edited
    );

    await openEditPocket(page, nameC1Edited);
    await fillMoney(page, '#pMetaValor', p.cappedGoalAmount);
    await clickGuarded(page, '#pSalvar');
    await waitPocketPanelClosed(page);
    await expect
      .poll(() => cardProgress(page, nameC1Edited), { timeout: 20_000, message: 'progresso deve limitar a 100%' })
      .toBe(p.expected.cappedProgress);
    expect(await cardBalance(page, nameC1Edited), 'saldo não deve mudar ao editar só a meta').toBe(balanceEdited);

    await openMovement(page, nameC1Edited, p.largeMovement.kind);
    await submitMovement(page, { amount: p.largeMovement.amount, desc: p.largeMovement.desc });
    await waitMovementPanelClosed(page);
    const balanceLarge = pocketBalance({
      initial: p.edit.initial,
      movements: [...p.movements, p.largeMovement],
    });
    expect(balanceLarge, 'saldo esperado com movimentação muito grande').toBe(p.expected.largeBalance);
    await expect
      .poll(() => cardBalance(page, nameC1Edited), { timeout: 20_000, message: 'saldo após movimentação grande' })
      .toBe(balanceLarge);
    await expect.poll(() => stripTotal(page), { timeout: 20_000, message: 'total após movimentação grande' }).toBe(
      balanceLarge
    );
    expect(await cardProgress(page, nameC1Edited), 'progresso deve continuar limitado a 100%').toBe(
      p.expected.cappedProgress
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openPockets(page);
    expect(await cardBalance(page, nameC1Edited), 'saldo após reload').toBe(balanceLarge);
    expect(await cardProgress(page, nameC1Edited), 'progresso após reload').toBe(p.expected.cappedProgress);
    expect((await card(page, nameC1Edited).locator('h4 span').textContent()).trim(), 'nome após reload').toBe(
      nameC1Edited
    );
    expect(await stripTotal(page), 'total após reload').toBe(balanceLarge);

    const rest = await signIn(creds.email, creds.password);
    const storedPockets = await listCollection(rest.uid, rest.idToken, rest.projectId, 'pockets');
    const storedC1 = storedPockets.find((d) => d.fields.name === nameC1Edited);
    expect(storedC1, 'caixinha editada ausente no Firestore').toBeTruthy();
    expect(Number(storedC1.fields.initial), 'DIVERGÊNCIA: initial editado no Firestore').toBe(p.edit.initial);
    expect(Number(storedC1.fields.goalAmount), 'DIVERGÊNCIA: meta editada no Firestore').toBe(p.cappedGoalAmount);
    expect(storedC1.fields.goal, 'DIVERGÊNCIA: objetivo editado no Firestore').toBe(p.edit.goal);

    const c1Id = storedC1.path.split('/').pop();
    const storedMoves = await savedPocketMovements(rest, c1Id);
    expect(storedMoves, 'movimentações no Firestore após edição').toHaveLength(p.movements.length + 1);
    const saldoStored = pocketBalance({ initial: Number(storedC1.fields.initial), movements: storedMoves });
    expect(saldoStored, 'DIVERGÊNCIA: saldo dos dados persistidos após edição ≠ ORACLE').toBe(balanceLarge);

    await testInfo.attach(
      'edicao-vs-oracle.txt',
      {
        body: [
          `UI    : saldo=${await cardBalance(page, nameC1Edited)} progresso=${await cardProgress(page, nameC1Edited)}`,
          `ORACLE: saldo=${balanceLarge} progresso=${p.expected.cappedProgress}`,
          `firestore: initial=${storedC1.fields.initial} goalAmount=${storedC1.fields.goalAmount} movs=${storedMoves.length}`,
        ].join('\n'),
        contentType: 'text/plain',
      }
    );

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('fechar modal sem salvar e reload durante operação não alteram o estado', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openPockets(page);

    const saldoBase = p.expected.largeBalance;
    await expect(card(page, nameC1Edited)).toBeVisible();
    expect(await cardBalance(page, nameC1Edited)).toBe(saldoBase);

    await openEditPocket(page, nameC1Edited);
    await page.fill('#pNome', 'NÃO_GRAVAR_ESTE_NOME');
    await page.fill('#pInicial', '99999999');
    await page.click('#panelPocket .modal-close');
    await waitPocketPanelClosed(page);
    expect((await card(page, nameC1Edited).locator('h4 span').textContent()).trim(), 'nome alterou sem salvar').toBe(
      nameC1Edited
    );
    expect(await cardBalance(page, nameC1Edited), 'saldo alterou sem salvar').toBe(saldoBase);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openPockets(page);
    expect((await card(page, nameC1Edited).locator('h4 span').textContent()).trim(), 'nome fantasma após reload').toBe(
      nameC1Edited
    );
    expect(await cardBalance(page, nameC1Edited), 'saldo fantasma após reload').toBe(saldoBase);

    await openMovement(page, nameC1Edited, 'resgate');
    await page.fill('#pmDesc', 'não deve persistir');
    await fillMoney(page, '#pmValor', 1234.56);
    await page.click('#panelPocketMovement .modal-close');
    await waitMovementPanelClosed(page);
    expect(await cardBalance(page, nameC1Edited), 'cancelamento de movimento alterou o saldo').toBe(saldoBase);

    await openMovement(page, nameC1Edited, 'aporte');
    expect(app.parseCurrency(await page.inputValue('#pmValor')), 'modal de movimento deve abrir zerado').toBe(0);
    expect((await page.inputValue('#pmDesc')).trim(), 'descrição do movimento cancelado vazou').toBe('');
    await page.click('#panelPocketMovement .modal-close');
    await waitMovementPanelClosed(page);

    await openMovement(page, nameC1Edited, 'aporte');
    await page.fill('#pmData', '2026-09-20');
    await page.fill('#pmDesc', 'parcial não salvo');
    await fillMoney(page, '#pmValor', 4321.09);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openPockets(page);
    expect(await cardBalance(page, nameC1Edited), 'reload durante operação alterou o saldo').toBe(saldoBase);
    expect(await stripTotal(page), 'reload durante operação alterou o total').toBe(saldoBase);

    const rest = await signIn(creds.email, creds.password);
    const storedMoves = (await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog'))
      .map((d) => d.fields)
      .filter((m) => m.targetType === 'pocket');
    expect(storedMoves, 'total de movimentações persistidas').toHaveLength(p.movements.length + 1);
    expect(
      storedMoves.some((m) => m.desc === 'parcial não salvo'),
      'movimentação parcial vazou para o Firestore'
    ).toBe(false);

    await testInfo.attach(
      'reload-durante-operacao.txt',
      { body: `saldo=${saldoBase} movs_persistidas=${storedMoves.length}`, contentType: 'text/plain' }
    );

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('exclusão remove interface, Firestore e histórico sem tocar em outros módulos', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openPockets(page);

    await expect(card(page, nameC1Edited)).toBeVisible();

    await app.openTab(page, 'caixa');
    await app.ensureBankExists(page, fixtures.bank.name, fixtures.bank.initial);
    await app.addEntry(page, {
      type: fixtures.movements.in.type,
      desc: fixtures.movements.in.desc,
      amount: fixtures.movements.in.amount,
      bank: fixtures.bank.name,
    });
    expect(await app.ledgerCount(page), 'lançamento de outro módulo não foi criado').toBe(1);

    await openPockets(page);
    await expect(card(page, nameC1Edited)).toBeVisible();

    await card(page, nameC1Edited).locator('button[aria-label="Excluir caixinha"]').click();
    await waitDialog(dialogs, 'Deseja excluir esta caixinha e todo o histórico de movimentações dela?');
    await expect(card(page, nameC1Edited)).toHaveCount(0, { timeout: 20_000 });
    await expect(card(page, nameC2)).toBeVisible();
    await expect
      .poll(() => stripTotal(page), { timeout: 20_000, message: 'total após exclusão' })
      .toBe(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openPockets(page);
    await expect(card(page, nameC1Edited)).toHaveCount(0);
    await expect(card(page, nameC2)).toBeVisible();
    expect(await stripTotal(page), 'total após reload da exclusão').toBe(0);
    await app.openTab(page, 'caixa');
    expect(await app.ledgerCount(page), 'lançamento de outro módulo sumiu após reload').toBe(1);

    const rest = await signIn(creds.email, creds.password);
    await expect
      .poll(
        async () => (await listCollection(rest.uid, rest.idToken, rest.projectId, 'pockets')).length,
        { timeout: 30_000, message: 'exclusão da caixinha no Firestore' }
      )
      .toBe(1);
    const storedPockets = await listCollection(rest.uid, rest.idToken, rest.projectId, 'pockets');
    expect(storedPockets.map((d) => d.fields.name), 'coleção pockets após exclusão').toEqual([nameC2]);

    await expect
      .poll(
        async () =>
          (await listCollection(rest.uid, rest.idToken, rest.projectId, 'yieldsLog'))
            .map((d) => d.fields)
            .filter((m) => m.targetType === 'pocket').length,
        { timeout: 30_000, message: 'histórico da caixinha excluída no Firestore' }
      )
      .toBe(0);

    const storedEntries = await listCollection(rest.uid, rest.idToken, rest.projectId, 'entries');
    expect(storedEntries.map((d) => d.fields.desc), 'entries intactas após exclusão').toEqual([
      fixtures.movements.in.desc,
    ]);
    expect(Number(storedEntries[0].fields.amount), 'valor do entry intacto').toBe(fixtures.movements.in.amount);
    const storedBanks = await listCollection(rest.uid, rest.idToken, rest.projectId, 'banks');
    expect(storedBanks.map((d) => d.fields.name), 'banks intactos após exclusão').toContain(fixtures.bank.name);

    await testInfo.attach(
      'exclusao-vs-firestore.txt',
      {
        body: [
          `pockets=${storedPockets.length} (${storedPockets.map((d) => d.fields.name).join(', ')})`,
          `yieldsLog pocket=0 entries=${storedEntries.length} banks=${storedBanks.length}`,
          `dialogos=${dialogs.length}`,
        ].join('\n'),
        contentType: 'text/plain',
      }
    );

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('isolamento entre contas: caixinhas da conta A não aparecem na conta B', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openPockets(page);

    await expect(card(page, nameC2)).toBeVisible();
    expect(await page.locator('#pocketGrid .invest-box').count(), 'conta A deveria ter 1 caixinha').toBe(1);

    const creds2 = { ...creds, email: creds.email.replace('@', '+2@') };
    const sessao2 = await qa.ensureSecondaryAccount(page, creds2);
    if (sessao2.status !== 'ok') {
      test.skip(true, `BLOCKED: conta secundária indisponível — ${sessao2.error}`);
    }
    await app.waitForDataReady(page);
    await openPockets(page);

    await expect(page.locator('#pocketGrid .empty')).toContainText('Nenhuma caixinha cadastrada');
    expect(await page.locator('#pocketGrid .invest-box').count(), 'conta B não deveria ver caixinhas').toBe(0);
    expect(await stripTotal(page), 'total da conta B').toBe(0);

    const rest2 = await signIn(creds2.email, creds2.password);
    const storedB = await listCollection(rest2.uid, rest2.idToken, rest2.projectId, 'pockets');
    expect(storedB, 'Firestore da conta B não deveria ter caixinhas').toHaveLength(0);

    await testInfo.attach(
      'isolamento-contas.txt',
      { body: `contaA_pockets=1 contaB_pockets=${storedB.length} uidB=${rest2.uid.slice(0, 6)}…`, contentType: 'text/plain' }
    );

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });
});
