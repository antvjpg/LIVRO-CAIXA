'use strict';

/* P1 — Metas: criação/validações, fontes (Conta, Caixinha, Investimento),
   progresso × ORACLE, status, edição, persistência, exclusão e isolamento.
   Oracles em e2e/oracles/goal.js são independentes do app (§9). */

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { signIn, listCollection } = require('../helpers/firestore-rest');
const { fixtures } = require('../fixtures/fixtures');
const {
  goalRemaining,
  goalProgressLabel,
  goalStatusLabel,
  goalStatusFromLabel,
  goalSaveStatus,
  goalDaysRemaining,
  goalDeadlineLabel,
} = require('../oracles/goal');
const { formatBRL } = require('../oracles/money');

test.describe.serial('Metas — criação, fontes, progresso, persistência e exclusão', () => {
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

  const g = fixtures.goals;
  const e = g.expected;
  const bankName = fixtures.bank.name;
  const pocketName = fixtures.pockets.c1.name;
  const investName = g.invest.name;
  const nameM1Edited = g.m1.name + g.edit.nameSuffix;

  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const card = (page, name) =>
    page.locator('#goalsList .goal-card-v2', {
      has: page.locator('strong', { hasText: new RegExp(`^${esc(name)}$`) }),
    });
  const countGoals = (page) => page.locator('#goalsList .goal-card-v2').count();

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

  const openGoals = (page) => app.openTab(page, 'goals');

  async function waitDialog(dialogs, texto) {
    await expect
      .poll(() => dialogs.map((d) => d.message).join(' | '), { timeout: 15_000, message: `dialogo com "${texto}"` })
      .toContain(texto);
  }

  function fillMoney(page, selector, value) {
    return page.fill(selector, String(Math.round(value * 100)));
  }

  async function clickSaveGoal(page) {
    await app.esperaTravaAntiDuplo(page, '#btnSaveGoal');
    await page.click('#btnSaveGoal');
  }

  async function openGoalForm(page) {
    await page.click('#fabAdd');
    await page.waitForSelector('#panelGoalForm.open', { timeout: 15_000 });
  }

  async function waitGoalFormClosed(page) {
    await page.waitForFunction(() => !document.querySelector('#panelGoalForm.open'), null, { timeout: 30_000 });
  }

  async function browserToday(page) {
    const iso = await page.$eval('#goalDataInicio', (el) => el.value || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    return page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
  }

  function addDaysISO(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  function fmtDate(iso) {
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
  }

  async function selectSource(page, labelPart) {
    const value = await page.$eval(
      '#goalCaixinha',
      (sel, part) => {
        const opt = [...sel.options].find((o) => o.textContent.includes(part));
        return opt ? opt.value : null;
      },
      labelPart
    );
    expect(value, `opção de fonte "${labelPart}" no formulário`).toBeTruthy();
    await page.selectOption('#goalCaixinha', value);
  }

  async function fillGoalForm(page, { name, target, current, source, deadline, status }) {
    if (name != null) await page.fill('#goalNome', name);
    if (target != null) await fillMoney(page, '#goalValorObjetivo', target);
    if (source) await selectSource(page, source);
    if (current != null && !source) await fillMoney(page, '#goalValorAtual', current);
    if (deadline != null) await page.fill('#goalPrazo', deadline);
    if (status) await page.selectOption('#goalStatus', status);
  }

  async function createGoal(page, opts) {
    await openGoalForm(page);
    await fillGoalForm(page, opts);
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);
    await expect(card(page, opts.name)).toBeVisible({ timeout: 20_000 });
  }

  async function openEditGoal(page, name) {
    await card(page, name).locator('button[aria-label="Editar meta"]').click();
    await page.waitForSelector('#panelGoalForm.open', { timeout: 15_000 });
  }

  async function cardState(page, name) {
    const c = card(page, name);
    await expect(c).toBeVisible();
    const norm = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    return {
      current: app.parseCurrency(await c.locator('.goal-card-v2-current').textContent()),
      target: app.parseCurrency(await c.locator('.goal-card-v2-target').textContent()),
      percent: (await c.locator('.goal-card-v2-track').getAttribute('aria-valuenow')) || '',
      badge: norm(await c.locator('.goal-card-v2-badge').textContent()),
      meta: norm(await c.locator('.goal-card-v2-meta').textContent()),
      source: norm(await c.locator('.goal-card-v2-pocket').textContent()),
    };
  }

  function expectedMeta({ remaining, days = null, deadline = null }) {
    const parts = [`Faltam R$ ${formatBRL(remaining)}`];
    if (days != null) parts.push(`${days} dias`);
    if (deadline) parts.push(`Prazo ${goalDeadlineLabel(deadline)}`);
    return parts.join(' · ');
  }

  /* Estado da UI sempre conferido contra o ORACLE antes de comparar com a UI. */
  async function expectGoal(page, name, exp, { badge = 'Ativa', meta = null } = {}) {
    expect(goalProgressLabel(exp.target, exp.current), `${name}: progresso (ORACLE)`).toBe(exp.percent);
    expect(goalRemaining(exp.target, exp.current), `${name}: restante (ORACLE)`).toBe(exp.remaining);
    const s = await cardState(page, name);
    expect(s.current, `${name}: valor atual na UI`).toBe(exp.current);
    expect(s.target, `${name}: valor alvo na UI`).toBe(exp.target);
    expect(`${s.percent}%`, `${name}: progresso na UI diverge do ORACLE`).toBe(exp.percent);
    expect(s.badge, `${name}: status na UI`).toBe(badge);
    expect(s.badge, `${name}: status na UI diverge do ORACLE`).toBe(goalStatusLabel(goalStatusFromLabel(badge)));
    if (meta != null) expect(s.meta, `${name}: linha de prazo/restante`).toBe(meta);
    return s;
  }

  async function createPocket(page, { name, initial }) {
    await app.openTab(page, 'pockets');
    await page.click('#fabAdd');
    await page.waitForSelector('#panelPocket.open', { timeout: 15_000 });
    await page.fill('#pNome', name);
    await fillMoney(page, '#pInicial', initial);
    await app.esperaTravaAntiDuplo(page, '#pSalvar');
    await page.click('#pSalvar');
    await page.waitForFunction(() => !document.querySelector('#panelPocket.open'), null, { timeout: 25_000 });
    await expect(page.locator('#pocketGrid .invest-box', { hasText: name })).toBeVisible({ timeout: 15_000 });
  }

  async function pocketAporte(page, { name, amount }) {
    await app.openTab(page, 'pockets');
    const c = page.locator('#pocketGrid .invest-box', { hasText: name });
    await c.locator('button[aria-label="Movimentações da caixinha"]').click();
    await page.waitForSelector('#panelPocketMovement.open', { timeout: 15_000 });
    await fillMoney(page, '#pmValor', amount);
    await app.esperaTravaAntiDuplo(page, '#pmSalvar');
    await page.click('#pmSalvar');
    await page.waitForFunction(() => !document.querySelector('#panelPocketMovement.open'), null, { timeout: 25_000 });
  }

  async function pocketBalance(page, name) {
    return app.parseCurrency(
      await page.locator('#pocketGrid .invest-box', { hasText: name }).locator('.val').textContent()
    );
  }

  async function createInvestment(page, { name, type, value }) {
    await app.openTab(page, 'invest');
    await page.click('#fabAdd');
    await page.waitForSelector('#panelInvest.open', { timeout: 15_000 });
    await page.fill('#iNome', name);
    await page.selectOption('#iTipo', type);
    await fillMoney(page, '#iValorSimples', value);
    await app.esperaTravaAntiDuplo(page, '#iSalvar');
    await page.click('#iSalvar');
    await page.waitForFunction(() => !document.querySelector('#panelInvest.open'), null, { timeout: 30_000 });
  }

  async function storedGoals(rest) {
    return (await listCollection(rest.uid, rest.idToken, rest.projectId, 'goals')).map((d) => ({
      id: d.path.split('/').pop(),
      ...d.fields,
    }));
  }

  test('criação com validações, progresso 0%/parcial, prazo, reload e Firestore', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();

    let reset1;
    try {
      reset1 = await qa.reset();
    } catch (err) {
      if (err.code === 'CODE_BLOCKED') test.skip(true, `BLOCKED: reset do ambiente QA — ${err.message}`);
      throw err;
    }
    testInfo.annotations.push({ type: 'reset', description: `antes: ${reset1.deleted} doc(s)` });

    const dialogs = await startPage(page, creds);
    await openGoals(page);
    await expect(page.locator('#goalsList .hint')).toContainText('Nenhuma meta cadastrada ainda.');
    expect(await countGoals(page), 'estado inicial deveria estar vazio').toBe(0);

    /* validações do formulário (alerts) */
    await openGoalForm(page);
    await clickSaveGoal(page);
    await waitDialog(dialogs, 'Informe o nome da meta.');
    await expect(page.locator('#panelGoalForm.open')).toBeVisible();

    await page.fill('#goalNome', g.m1.name);
    await clickSaveGoal(page);
    await waitDialog(dialogs, 'Informe um valor objetivo válido.');
    await expect(page.locator('#panelGoalForm.open')).toBeVisible();

    await fillMoney(page, '#goalValorObjetivo', g.m1.target);
    const hoje = await browserToday(page);
    await page.fill('#goalPrazo', addDaysISO(hoje, -1));
    await clickSaveGoal(page);
    await waitDialog(dialogs, 'O prazo não pode ser anterior à data de início.');
    await expect(page.locator('#panelGoalForm.open')).toBeVisible();

    await page.fill('#goalPrazo', '');
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);
    await expect(card(page, g.m1.name)).toBeVisible({ timeout: 20_000 });

    /* m1: legado sem fonte → 0% */
    const s1 = await expectGoal(page, g.m1.name, e.m1, { badge: 'Ativa', meta: expectedMeta({ remaining: e.m1.remaining }) });

    /* m2: legado com prazo futuro */
    const prazo2 = addDaysISO(hoje, g.m2.deadlineOffsetDays);
    const dias2 = goalDaysRemaining(hoje, prazo2);
    await createGoal(page, {
      name: g.m2.name,
      target: g.m2.target,
      current: g.m2.current,
      deadline: prazo2,
      status: 'active',
    });
    const s2 = await expectGoal(page, g.m2.name, e.m2, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m2.remaining, days: dias2, deadline: prazo2 }),
    });
    expect(dias2, 'dias restantes (ORACLE)').toBe(g.m2.deadlineOffsetDays);
    expect(s2.meta, 'prazo exibido em DD/MM/YYYY').toContain(`Prazo ${fmtDate(prazo2)}`);
    expect(s1.meta, 'meta sem prazo não pode exibir linha de prazo').not.toContain('Prazo');

    await expect.poll(() => countGoals(page), { timeout: 20_000, message: 'total de metas' }).toBe(2);

    /* reload */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openGoals(page);
    await expectGoal(page, g.m1.name, e.m1, { badge: 'Ativa', meta: expectedMeta({ remaining: e.m1.remaining }) });
    await expectGoal(page, g.m2.name, e.m2, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m2.remaining, days: dias2, deadline: prazo2 }),
    });

    /* Firestore × UI × ORACLE */
    const rest = await signIn(creds.email, creds.password);
    const stored = await storedGoals(rest);
    expect(stored, 'goals no Firestore').toHaveLength(2);
    const doc1 = stored.find((d) => d.name === g.m1.name);
    const doc2 = stored.find((d) => d.name === g.m2.name);
    expect(doc1, 'm1 ausente no Firestore').toBeTruthy();
    expect(doc2, 'm2 ausente no Firestore').toBeTruthy();
    expect(Number(doc1.fields === undefined ? doc1.targetAmount : doc1.targetAmount), 'alvo de m1').toBe(g.m1.target);
    expect(Number(doc1.currentAmount), 'atual legado de m1').toBe(g.m1.current);
    expect(doc1.status, 'status de m1').toBe('active');
    expect(doc1.sourceType, 'fonte de m1').toBe(null);
    expect(Number(doc2.targetAmount), 'alvo de m2').toBe(g.m2.target);
    expect(Number(doc2.currentAmount), 'atual legado de m2').toBe(g.m2.current);
    expect(doc2.deadline, 'prazo de m2').toBe(prazo2);
    expect(doc2.startDate, 'data de início de m2').toBe(hoje);
    expect(goalStatusLabel(doc2.status), 'status de m2 (ORACLE)').toBe('Ativa');

    await testInfo.attach('criacao-vs-oracle.txt', {
      body: [
        `UI    : m1=${s1.current}/${s1.target} ${s1.percent}% ${s1.badge} | m2=${s2.current}/${s2.target} ${s2.percent}% ${s2.badge}`,
        `ORACLE: m1=${e.m1.current}/${e.m1.target} ${e.m1.percent} | m2=${e.m2.current}/${e.m2.target} ${e.m2.percent}`,
        `prazo m2=${prazo2} (${dias2} dias) firestore_goals=${stored.length} dialogos=${dialogs.length}`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('integração com Conta: saldo da fonte, campo legado oculto e conflito de vínculo', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openGoals(page);
    expect(await countGoals(page), 'metas da etapa anterior').toBe(2);

    /* conta + lançamentos: 0 + 1000 − 250 = 750 */
    await app.openTab(page, 'caixa');
    await app.ensureBankExists(page, bankName, fixtures.bank.initial);
    await app.addEntry(page, {
      type: fixtures.movements.in.type,
      desc: fixtures.movements.in.desc,
      amount: fixtures.movements.in.amount,
      bank: bankName,
    });
    await app.addEntry(page, {
      type: fixtures.movements.out.type,
      desc: fixtures.movements.out.desc,
      amount: fixtures.movements.out.amount,
      bank: bankName,
    });
    expect(await app.ledgerCount(page), 'lançamentos da conta').toBe(2);

    await openGoals(page);
    await openGoalForm(page);
    /* sem fonte → campo legado visível e habilitado */
    expect(await page.locator('#goalValorAtualLegacyField').isVisible(), 'campo legado sem fonte').toBe(true);
    expect(await page.locator('#goalValorAtual').isDisabled(), 'campo legado habilitado sem fonte').toBe(false);
    await selectSource(page, bankName);
    expect(await page.locator('#goalValorAtualLegacyField').isVisible(), 'campo legado com fonte').toBe(false);
    expect(await page.locator('#goalValorAtual').isDisabled(), 'campo legado desabilitado com fonte').toBe(true);

    await fillGoalForm(page, { name: g.m3.name, target: g.m3.target });
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);
    const s3 = await expectGoal(page, g.m3.name, e.m3, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m3.remaining }),
    });
    expect(s3.source, 'fonte exibida no card').toContain('Conta');
    expect(s3.source, 'nome da conta no card').toContain(bankName);

    /* conflito: mesma conta não pode ficar em duas metas ativas */
    await openGoalForm(page);
    await fillGoalForm(page, { name: g.m3.name + '_DUP', target: 500, source: bankName });
    await clickSaveGoal(page);
    await waitDialog(dialogs, `Conta "${bankName}" já está vinculada à Meta "${g.m3.name}".`);
    await expect(page.locator('#panelGoalForm.open')).toBeVisible();
    expect(await countGoals(page), 'meta duplicada não pode ser criada').toBe(3);
    await page.click('#btnCancelGoalEdit');
    await waitGoalFormClosed(page);

    /* Firestore: vínculo com a conta persistido */
    const rest = await signIn(creds.email, creds.password);
    const doc3 = (await storedGoals(rest)).find((d) => d.name === g.m3.name);
    expect(doc3, 'm3 ausente no Firestore').toBeTruthy();
    expect(doc3.sourceType, 'sourceType de m3').toBe('bank');
    const banks = await listCollection(rest.uid, rest.idToken, rest.projectId, 'banks');
    const bankId = banks.find((b) => b.fields.name === bankName)?.path.split('/').pop();
    expect(bankId, 'id da conta no Firestore').toBeTruthy();
    expect(doc3.sourceId, 'sourceId de m3').toBe(bankId);
    expect(Number(doc3.targetAmount), 'alvo de m3').toBe(g.m3.target);

    await testInfo.attach('conta-vs-oracle.txt', {
      body: [
        `UI    : m3=${s3.current}/${s3.target} ${s3.percent}% fonte="${s3.source}"`,
        `ORACLE: m3=${e.m3.current}/${e.m3.target} ${e.m3.percent} (banco ${e.bankBalance})`,
        `conflito_ok=true cards=${await countGoals(page)} ledger=${await app.ledgerCount(page)}`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('integração com Caixinha (aporte) e Investimento', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);

    await createPocket(page, { name: pocketName, initial: fixtures.pockets.c1.initial });

    await openGoals(page);
    await createGoal(page, { name: g.m4.name, target: g.m4.target, source: pocketName });
    const s4 = await expectGoal(page, g.m4.name, e.m4, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m4.remaining }),
    });
    expect(s4.source, 'fonte Caixinha no card').toContain(pocketName);

    /* aporte na caixinha alimenta o progresso da meta */
    await pocketAporte(page, { name: pocketName, amount: g.m4.aporte });
    await openGoals(page);
    await expect
      .poll(async () => (await cardState(page, g.m4.name)).percent, { timeout: 20_000, message: 'progresso após aporte' })
      .toBe('50');
    const s4b = await expectGoal(page, g.m4.name, e.m4AfterAporte, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m4AfterAporte.remaining }),
    });

    /* investimento "Outros" alimenta outra meta */
    await createInvestment(page, { name: investName, type: g.invest.type, value: g.invest.value });
    await openGoals(page);
    await createGoal(page, { name: g.m5.name, target: g.m5.target, source: investName });
    const s5 = await expectGoal(page, g.m5.name, e.m5, {
      badge: 'Ativa',
      meta: expectedMeta({ remaining: e.m5.remaining }),
    });
    expect(s5.source, 'fonte Investimento no card').toContain(investName);
    expect(await countGoals(page), 'total de metas').toBe(5);

    const rest = await signIn(creds.email, creds.password);
    const goals = await storedGoals(rest);
    const doc4 = goals.find((d) => d.name === g.m4.name);
    const doc5 = goals.find((d) => d.name === g.m5.name);
    expect(doc4.sourceType, 'sourceType de m4').toBe('pocket');
    expect(doc4.caixinhaId, 'caixinhaId de m4').toBeTruthy();
    expect(doc5.sourceType, 'sourceType de m5').toBe('invest');
    expect(doc5.caixinhaId, 'm5 não é caixinha').toBe(null);
    const investments = await listCollection(rest.uid, rest.idToken, rest.projectId, 'investments');
    const inv = investments.find((d) => d.fields.name === investName);
    expect(inv, 'investimento ausente no Firestore').toBeTruthy();
    expect(Number(inv.fields.value), 'valor do investimento').toBe(g.invest.value);

    await testInfo.attach('fontes-vs-oracle.txt', {
      body: [
        `UI    : m4=${s4b.current}/${s4b.target} ${s4b.percent}% | m5=${s5.current}/${s5.target} ${s5.percent}%`,
        `ORACLE: m4=${e.m4AfterAporte.current}/${e.m4AfterAporte.target} ${e.m4AfterAporte.percent} | m5=${e.m5.current}/${e.m5.target} ${e.m5.percent}`,
        `caixinha=${await pocketBalance(page, pocketName)} cards=${await countGoals(page)}`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('atingir o alvo: conclusão automática, reabertura e meta pausada', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    void dialogs;
    await openGoals(page);
    await expectGoal(page, g.m3.name, e.m3, { badge: 'Ativa' });

    /* aporte de 250 na conta → 1000/1000 */
    await app.openTab(page, 'caixa');
    await app.addEntry(page, { type: 'in', desc: g.topUp.desc, amount: g.topUp.amount, bank: bankName });
    expect(await app.ledgerCount(page), 'lançamentos após o aporte').toBe(3);

    await openGoals(page);
    await expect
      .poll(async () => (await cardState(page, g.m3.name)).badge, { timeout: 20_000, message: 'status ao atingir o alvo' })
      .toBe('Concluída');
    const doneExpected = goalSaveStatus('active', { target: g.m3.target, current: e.m3Done.current, linked: true });
    expect(doneExpected, 'status esperado (ORACLE)').toBe('completed');
    const sDone = await expectGoal(page, g.m3.name, e.m3Done, { badge: 'Concluída' });
    expect(sDone.meta, 'restante zerado na conclusão').toContain('Faltam R$ 0,00');

    const rest = await signIn(creds.email, creds.password);
    await expect
      .poll(
        async () => ((await storedGoals(rest)).find((d) => d.name === g.m3.name) || {}).status,
        { timeout: 30_000, message: 'conclusão persistida no Firestore' }
      )
      .toBe('completed');

    /* reload mantém a conclusão */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openGoals(page);
    await expectGoal(page, g.m3.name, e.m3Done, { badge: 'Concluída' });

    /* editar o alvo para cima reabre a meta (Ativa) */
    await openEditGoal(page, g.m3.name);
    await fillGoalForm(page, { target: g.m3.retarget });
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);
    const reopened = goalSaveStatus('completed', { target: g.m3.retarget, current: e.m3Retarget.current, linked: true });
    expect(reopened, 'status esperado ao aumentar o alvo (ORACLE)').toBe('active');
    await expectGoal(page, g.m3.name, e.m3Retarget, { badge: 'Ativa' });

    /* pausada no alvo NÃO vira Concluída (nem no save nem no render) */
    await openEditGoal(page, g.m3.name);
    await fillGoalForm(page, { target: g.m3.target, status: 'paused' });
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);
    const paused = goalSaveStatus('paused', { target: g.m3.target, current: e.m3Paused.current, linked: true });
    expect(paused, 'status esperado de meta pausada (ORACLE)').toBe('paused');
    const sPaused = await expectGoal(page, g.m3.name, e.m3Paused, { badge: 'Pausada' });
    expect(sPaused.percent, 'pausada no alvo mantém 100% sem concluir').toBe('100');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openGoals(page);
    await expectGoal(page, g.m3.name, e.m3Paused, { badge: 'Pausada' });

    await testInfo.attach('atingir-alvo.txt', {
      body: [
        `UI    : concluida=${sDone.current}/${sDone.target} ${sDone.percent}% | reaberta=${e.m3Retarget.percent} | pausada=${sPaused.percent}`,
        `ORACLE: status conclusao=${doneExpected} reabertura=${reopened} pausada=${paused}`,
        `observacao: meta pausada no alvo permanece "Pausada" (sem auto-conclusão)`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('edição persiste dados/status e cancelar não grava', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openGoals(page);

    await openEditGoal(page, g.m1.name);
    expect(await page.inputValue('#goalNome'), 'formulário abre com o nome atual').toBe(g.m1.name);
    expect(app.parseCurrency(await page.inputValue('#goalValorObjetivo')), 'formulário abre com o alvo atual').toBe(
      g.m1.target
    );
    expect(await page.inputValue('#goalStatus'), 'status atual no formulário').toBe('active');
    expect(await page.locator('#goalValorAtualLegacyField').isVisible(), 'meta sem fonte mantém campo legado').toBe(
      true
    );

    await fillGoalForm(page, {
      name: nameM1Edited,
      target: g.edit.target,
      current: g.edit.current,
      status: g.edit.status,
    });
    await clickSaveGoal(page);
    await waitGoalFormClosed(page);

    const edited = await expectGoal(page, nameM1Edited, e.m1Edited, { badge: 'Pausada' });
    expect(await card(page, g.m1.name).count(), 'nome antigo sumiu da lista').toBe(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openGoals(page);
    await expectGoal(page, nameM1Edited, e.m1Edited, { badge: 'Pausada' });

    const rest = await signIn(creds.email, creds.password);
    const doc = (await storedGoals(rest)).find((d) => d.name === nameM1Edited);
    expect(doc, 'meta editada ausente no Firestore').toBeTruthy();
    expect(Number(doc.targetAmount), 'alvo editado no Firestore').toBe(g.edit.target);
    expect(Number(doc.currentAmount), 'atual legado editado no Firestore').toBe(g.edit.current);
    expect(doc.status, 'status editado no Firestore').toBe(g.edit.status);

    /* cancelar o formulário não grava nada */
    await openEditGoal(page, nameM1Edited);
    await page.fill('#goalNome', 'NÃO_GRAVAR_ESTE_NOME');
    await fillMoney(page, '#goalValorObjetivo', 999999);
    await page.click('#btnCancelGoalEdit');
    await waitGoalFormClosed(page);
    await expect.poll(() => countGoals(page), { timeout: 20_000, message: 'total após cancelar' }).toBe(5);
    const still = await expectGoal(page, nameM1Edited, e.m1Edited, { badge: 'Pausada' });
    expect(
      (await card(page, nameM1Edited).locator('.goal-card-v2-title strong').textContent()).trim(),
      'nome fantasma'
    ).toBe(nameM1Edited);

    await testInfo.attach('edicao-vs-oracle.txt', {
      body: [
        `UI    : ${nameM1Edited}=${edited.current}/${edited.target} ${edited.percent}% ${edited.badge}`,
        `ORACLE: ${e.m1Edited.current}/${e.m1Edited.target} ${e.m1Edited.percent} status=${g.edit.status}`,
        `cancelar_sem_gravar_ok=true (total=${await countGoals(page)})`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
    expect(still.badge).toBe('Pausada');
  });

  test('exclusão remove a meta sem tocar em Caixinha, conta ou lançamentos', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const creds = skipSemCredencial();
    const dialogs = await startPage(page, creds);
    await openGoals(page);
    expect(await countGoals(page), 'metas antes da exclusão').toBe(5);
    await expect(card(page, g.m4.name)).toBeVisible();

    await card(page, g.m4.name).locator('button[aria-label="Excluir meta"]').click();
    await waitDialog(dialogs, `Excluir a Meta "${g.m4.name}"? Isso não afeta nenhum saldo ou lançamento.`);
    expect(dialogs.at(-1).message, 'aviso de que a caixinha fica intacta').toContain('A Caixinha continuará intacta.');
    await expect(card(page, g.m4.name)).toHaveCount(0, { timeout: 20_000 });
    expect(await countGoals(page), 'metas após a exclusão').toBe(4);

    /* Caixinha intacta */
    await app.openTab(page, 'pockets');
    await expect
      .poll(() => pocketBalance(page, pocketName), { timeout: 20_000, message: 'saldo da caixinha após excluir meta' })
      .toBe(e.pocketBalanceAfterAporte);

    /* conta e lançamentos intactos */
    await app.openTab(page, 'caixa');
    expect(await app.ledgerCount(page), 'lançamentos intactos').toBe(3);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await openGoals(page);
    expect(await countGoals(page), 'metas após reload').toBe(4);
    await expect(card(page, g.m4.name)).toHaveCount(0);
    for (const nome of [nameM1Edited, g.m2.name, g.m3.name, g.m5.name]) {
      await expect(card(page, nome), `${nome} deveria continuar na lista`).toBeVisible();
    }
    await app.openTab(page, 'pockets');
    expect(await pocketBalance(page, pocketName), 'saldo da caixinha após reload').toBe(e.pocketBalanceAfterAporte);
    await app.openTab(page, 'caixa');
    expect(await app.ledgerCount(page), 'lançamentos após reload').toBe(3);

    const rest = await signIn(creds.email, creds.password);
    const goals = await storedGoals(rest);
    expect(goals.map((d) => d.name).sort(), 'goals no Firestore após exclusão').toEqual(
      [nameM1Edited, g.m2.name, g.m3.name, g.m5.name].sort()
    );
    const pockets = await listCollection(rest.uid, rest.idToken, rest.projectId, 'pockets');
    expect(pockets.map((d) => d.fields.name), 'pockets intactos').toEqual([pocketName]);
    const entries = await listCollection(rest.uid, rest.idToken, rest.projectId, 'entries');
    expect(entries.map((d) => d.fields.desc).sort(), 'entries intactas').toEqual(
      [fixtures.movements.in.desc, fixtures.movements.out.desc, g.topUp.desc].sort()
    );

    await testInfo.attach('exclusao-vs-firestore.txt', {
      body: [
        `goals=${goals.length} pockets=${pockets.length} entries=${entries.length} ledger=3`,
        `dialogo="${dialogs.at(-1)?.message || ''}"`,
      ].join('\n'),
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });

  test('isolamento entre contas: metas da conta A não aparecem na conta B', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await openGoals(page);

    expect(await countGoals(page), 'conta A deveria ter 4 metas').toBe(4);

    const creds2 = { ...creds, email: creds.email.replace('@', '+2@') };
    const sessao2 = await qa.ensureSecondaryAccount(page, creds2);
    if (sessao2.status !== 'ok') {
      test.skip(true, `BLOCKED: conta secundária indisponível — ${sessao2.error}`);
    }
    await app.waitForDataReady(page);
    await openGoals(page);

    await expect(page.locator('#goalsList .hint')).toContainText('Nenhuma meta cadastrada ainda.');
    expect(await countGoals(page), 'conta B não deveria ver metas').toBe(0);

    const rest2 = await signIn(creds2.email, creds2.password);
    const storedB = await listCollection(rest2.uid, rest2.idToken, rest2.projectId, 'goals');
    expect(storedB, 'Firestore da conta B não deveria ter metas').toHaveLength(0);

    await testInfo.attach('isolamento-contas.txt', {
      body: `contaA_goals=4 contaB_goals=${storedB.length} uidB=${rest2.uid.slice(0, 6)}…`,
      contentType: 'text/plain',
    });

    expect(watchAtual.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });
});
