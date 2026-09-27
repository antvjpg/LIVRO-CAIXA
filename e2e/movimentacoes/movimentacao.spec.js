/* C.O.D.E. — FASE 4/5: primeira suíte financeira real + persistência.
   Fluxo (usuário real, pela interface):
     reset ambiente QA → criar banco → entrada +1000 → saída −250
       → valida UI (livro + patrimônio)
       → valida com ORACLE independente
       → reload → valida persistência na UI
       → compara com FIRESTORE (REST, somente-leitura) → classifica divergência
   Depois: cleanup (reset) para estado inicial.
   Qualquer divergência é FAIL com evidência; nada é corrigido automaticamente (§48). */
'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../helpers/app');
const qa = require('../helpers/qa-account');
const { watchPage } = require('../helpers/console-watch');
const { resolveCredentials } = require('../helpers/env');
const { signIn, listCollection } = require('../helpers/firestore-rest');
const { fixtures } = require('../fixtures/fixtures');
const { banksBalance, patrimonio } = require('../oracles/balance');
const { ledgerSummary, entriesByDescription } = require('../oracles/movement');

test.describe.serial('Movimentações — criação, saldo e persistência', () => {
  test('entrada de 1.000 e saída de 250: UI × oracle × Firestore', async ({ page }, testInfo) => {
    test.setTimeout(240_000);

    const creds = resolveCredentials();
    if (!creds) {
      test.skip(true, `BLOCKED: credenciais QA indisponíveis — ${require('../helpers/env').guardReasonText() || 'sem credencial'}`);
    }

    /* 1) ambiente determinístico: apaga só livrocaixa/{uid-qa}
       (falha de ambiente → BLOCKED; não conta como regressão financeira) */
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

    const dialogs = app.attachDialogHandler(page);
    const watch = watchPage(page);

    const sessao = await qa.ensureUiSession(page, creds);
    if (sessao.status !== 'ok') {
      test.skip(true, `BLOCKED: sessão QA indisponível — ${sessao.error} | ${sessao.hint || ''}`);
    }
    await app.waitForDataReady(page);
    await app.openTab(page, 'caixa');

    /* 2) baseline — reset precisa ter deixado tudo zerado */
    const baseline = await app.ledgerCount(page);
    const baselinePatrimonio = await app.readPatrimonio(page);
    expect(baseline, 'ambiente QA não estava limpo após reset').toBe(0);
    expect(baselinePatrimonio, 'patrimônio baseline deveria ser 0').toBe(0);

    /* 3) banco de teste */
    await app.ensureBankExists(page, fixtures.bank.name, fixtures.bank.initial);

    /* 4) movimentações pela interface */
    await app.addEntry(page, {
      type: fixtures.movements.in.type,
      desc: fixtures.movements.in.desc,
      amount: fixtures.movements.in.amount,
      bank: fixtures.bank.name,
    });
    await app.addEntry(page, {
      type: fixtures.movements.out.type,
      desc: fixtures.movements.out.desc,
      amount: fixtures.movements.out.amount,
      bank: fixtures.bank.name,
    });

    /* 5) ORACLE — cálculo independente do app */
    /* ids fictícios só dentro do oracle: a regra é a mesma, os ids reais vêm do Firestore */
    const oracleBankId = 'oracle-bank';
    const oracleEntries = [
      { id: 'e1', bank: oracleBankId, type: fixtures.movements.in.type, amount: fixtures.movements.in.amount },
      { id: 'e2', bank: oracleBankId, type: fixtures.movements.out.type, amount: fixtures.movements.out.amount },
    ];
    const banks = [{ id: oracleBankId, initial: fixtures.bank.initial }];
    const oraclePatrimonio = patrimonio({ banks, entries: oracleEntries });
    const oracleLedger = ledgerSummary(oracleEntries);
    expect(oraclePatrimonio).toBe(fixtures.expected.patrimonio);
    expect(oracleLedger.net).toBe(fixtures.expected.patrimonio);

    /* 6) UI depois da ação */
    await expect
      .poll(() => app.ledgerCount(page), { timeout: 30_000, message: 'livro não mostrava 2 lançamentos' })
      .toBe(oracleLedger.count);

    const rowIn = await app.findLedgerRow(page, fixtures.movements.in.desc);
    const rowOut = await app.findLedgerRow(page, fixtures.movements.out.desc);
    expect(rowIn, `linha ${fixtures.movements.in.desc} não apareceu no livro`).toBeTruthy();
    expect(rowOut, `linha ${fixtures.movements.out.desc} não apareceu no livro`).toBeTruthy();

    const uiIn = app.parseCurrency(rowIn.amountText);
    const uiOut = app.parseCurrency(rowOut.amountText);
    const uiPatrimonio = await app.readPatrimonio(page);

    const evidencia = [
      `UI  : entrada=${uiIn} saida=${uiOut} patrimonio=${uiPatrimonio} lancamentos=${await app.ledgerCount(page)}`,
      `ORACLE: patrimonio=${oraclePatrimonio} net=${oracleLedger.net} lancamentos=${oracleLedger.count}`,
      `reset antes=${reset1.deleted} docs | dialogos=${dialogs.length}`,
    ].join('\n');
    await testInfo.attach('ui-vs-oracle.txt', { body: evidencia, contentType: 'text/plain' });

    expect(uiIn, 'valor da entrada na UI diverge do esperado').toBe(fixtures.movements.in.amount);
    expect(uiOut, 'valor da saída na UI diverge do esperado').toBe(-fixtures.movements.out.amount);
    expect(uiPatrimonio, 'patrimônio da UI diverge do ORACLE').toBe(oraclePatrimonio);

    /* 7) persistência: reload e reconferência */
    await page.reload({ waitUntil: 'domcontentloaded' });
    await app.waitForDataReady(page);
    await app.openTab(page, 'caixa');
    expect(await app.ledgerCount(page), 'lançamentos sumiram após reload').toBe(oracleLedger.count);
    expect(await app.readPatrimonio(page), 'patrimônio mudou após reload').toBe(oraclePatrimonio);

    /* 8) Firestore (somente leitura) × UI × oracle */
    const rest = await signIn(creds.email, creds.password);
    const stored = await listCollection(rest.uid, rest.idToken, rest.projectId, 'entries');
    const storedIn = entriesByDescription(stored.map((d) => d.fields), fixtures.movements.in.desc);
    const storedOut = entriesByDescription(stored.map((d) => d.fields), fixtures.movements.out.desc);

    const firestoreInfo = [
      `firestore: entries=${stored.length} in=${storedIn.length} out=${storedOut.length}`,
      `firestore in.amount=${storedIn[0]?.amount} type=${storedIn[0]?.type}`,
      `firestore out.amount=${storedOut[0]?.amount} type=${storedOut[0]?.type}`,
    ].join('\n');
    await testInfo.attach('firestore-vs-ui.txt', { body: `${evidencia}\n${firestoreInfo}`, contentType: 'text/plain' });

    expect(storedIn.length, 'entrada não encontrada no Firestore').toBe(1);
    expect(storedOut.length, 'saída não encontrada no Firestore').toBe(1);
    expect(Number(storedIn[0].amount), 'DIVERGÊNCIA DE PERSISTÊNCIA: valor da entrada no Firestore').toBe(
      fixtures.movements.in.amount
    );
    expect(Number(storedOut[0].amount), 'DIVERGÊNCIA DE PERSISTÊNCIA: valor da saída no Firestore').toBe(
      fixtures.movements.out.amount
    );
    expect(storedIn[0].type, 'tipo da entrada no Firestore').toBe('in');
    expect(storedOut[0].type, 'tipo da saída no Firestore').toBe('out');

    /* caixa de banco no Firestore coerente com o oracle */
    const storedBanks = await listCollection(rest.uid, rest.idToken, rest.projectId, 'banks');
    const testBank = storedBanks.find((b) => b.fields.name === fixtures.bank.name);
    expect(testBank, 'banco de teste ausente no Firestore').toBeTruthy();
    expect(banksBalance(storedBanks.map((b) => b.fields), stored.map((d) => d.fields)),
      'DIVERGÊNCIA: saldo de banco no Firestore ≠ oracle').toBe(oraclePatrimonio);

    watch.attach(testInfo);
    expect(watch.pageErrors(), 'erros não tratados durante o fluxo').toHaveLength(0);
  });
});
