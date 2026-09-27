/* C.O.D.E. — página-objeto do LIVRO-CAIXA.
   Usa apenas seletores já existentes no aplicativo (auditoria: e2e/AUDITORIA.md).
   Sem sleeps: todas as esperas são por condição/elemento. */
'use strict';

/* Aceita alert/confirm do app (Playwright descarta por padrão e cancelaria
   confirmações, quebrando o fluxo real). Registra o texto como evidência. */
function attachDialogHandler(page, sink = []) {
  page.on('dialog', async (dialog) => {
    sink.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  return sink;
}

async function openApp(page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#authOverlay', { state: 'attached' });
}

async function authOverlayHidden(page) {
  return page.evaluate(() => document.getElementById('authOverlay')?.classList.contains('hidden') === true);
}

async function isLoggedIn(page) {
  return authOverlayHidden(page);
}

/* Espera o app terminar de sincronizar (gate real: body.is-data-loading + #syncOverlay). */
async function waitForDataReady(page, timeout = 60_000) {
  await page.waitForFunction(
    () =>
      !document.body.classList.contains('is-data-loading') &&
      (document.getElementById('syncOverlay')?.classList.contains('hidden') ?? true),
    null,
    { timeout }
  );
  /* dois frames de renderização — evita ler DOM ainda em transição */
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function openTab(page, tab /* 'dashboard' | 'caixa' | ... */) {
  const id = { dashboard: 'tabBtnDashboard', caixa: 'tabBtnCaixa', pockets: 'tabBtnPockets',
    cards: 'tabBtnCards', invest: 'tabBtnInvest', goals: 'tabBtnGoals', dash: 'tabBtnDash',
    receivables: 'tabBtnReceivables' }[tab];
  if (!id) throw new Error(`Aba desconhecida: ${tab}`);
  await page.click(`#${id}`);
  await page.waitForFunction(
    (t) =>
      document
        .getElementById('view' + t.charAt(0).toUpperCase() + t.slice(1))
        ?.classList.contains('active') === true,
    tab,
    { timeout: 10_000 }
  );
}

function parseCurrency(text) {
  if (text == null) return NaN;
  let s = String(text).replace(/\u00a0/g, ' ').trim();
  if (!s) return NaN;
  let neg = false;
  if (s.includes('−') || s.startsWith('-')) neg = true;
  s = s.replace(/[^\d.,-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) s = s.replace(/,/g, '');
  else if (lastComma >= 0) s = s.replace(',', '.');
  const n = Number(s);
  if (Number.isNaN(n)) return NaN;
  return neg ? -n : n;
}

/* Patrimônio total exibido na faixa de saldos (.balance-card.total). */
async function readPatrimonio(page) {
  const text = await page.textContent('#balanceStrip .balance-card.total .amount');
  return parseCurrency(text);
}

async function readCardAmount(page, selector) {
  const text = await page.textContent(selector);
  return parseCurrency(text);
}

async function ledgerCount(page) {
  const text = await page.textContent('#ledgerCount');
  const m = /(\d+)/.exec(text || '');
  return m ? Number(m[1]) : 0;
}

/* Linhas do livro-caixa: [{ desc, amount, date, raw }] */
async function ledgerRows(page) {
  return page.$$eval('#ledgerBody .card-lancamento', (cards) =>
    cards.map((c) => ({
      desc: (c.querySelector('.card-title')?.textContent || '').trim(),
      amountText: (c.querySelector('.card-amount')?.textContent || '').trim(),
      date: (c.querySelector('.card-date')?.textContent || '').trim(),
      bank: (c.querySelector('.card-badge')?.textContent || '').trim(),
      category: (c.querySelector('.card-category')?.textContent || '').trim(),
    }))
  );
}

async function ensureBankExists(page, bankName, initial = 0) {
  const options = await page.$$eval('#fBanco option', (o) => o.map((x) => x.textContent.trim())).catch(() => []);
  if (options.includes(bankName)) return;

  /* Cartão "Bancos" da faixa de saldos abre o painel (index.html:3969). */
  await page.click('#balanceStrip .bank-summary-card');
  await page.waitForSelector('#panelBanco.open', { timeout: 10_000 });
  await page.fill('#bNome', bankName);
  /* máscara de dinheiro: dígitos = centavos (readMoneyInput /100) */
  await page.fill('#bSaldo', String(Math.round(initial * 100)));
  await page.click('#bSalvar');
  await page.waitForSelector('#panelBanco.open', { state: 'detached', timeout: 15_000 }).catch(async () => {
    await page.waitForFunction(() => !document.querySelector('#panelBanco.open'), null, { timeout: 15_000 });
  });
}

/* Abre o modal de novo lançamento; cria banco automaticamente se preciso. */
async function openNewEntry(page, bankName) {
  await page.click('#fabAdd');
  const bankPanel = await page.isVisible('#panelBanco.open').catch(() => false);
  if (bankPanel) {
    /* app exige ≥1 banco (index.html:10446) — cria e reabre */
    await page.fill('#bNome', bankName);
    await page.fill('#bSaldo', '0');
    await page.click('#bSalvar');
    await page.waitForFunction(() => !document.querySelector('#panelBanco.open'), null, { timeout: 15_000 });
    await page.click('#fabAdd');
  }
  await page.waitForSelector('#panelNovo.open', { timeout: 10_000 });
}

/* type: 'in' | 'out' */
async function addEntry(page, { type, desc, amount, bank, date, category } = {}) {
  if (!desc) throw new Error('addEntry: desc é obrigatório');
  if (!(amount > 0)) throw new Error('addEntry: amount deve ser > 0');
  await openNewEntry(page, bank);
  await page.click(type === 'out' ? '#tglOut' : '#tglIn');
  if (date) await page.fill('#fData', date);
  await page.fill('#fDesc', desc);
  if (bank) await page.selectOption('#fBanco', { label: bank });
  if (category) await page.selectOption('#fCategoria', { label: category });
  await page.fill('#fValor', amount.toFixed(2).replace('.', ','));
  await page.click('#fSalvar');
  /* fecha o painel ao salvar (closeAllPanels) */
  await page.waitForFunction(() => !document.querySelector('#panelNovo.open'), null, { timeout: 20_000 });
}

async function findLedgerRow(page, desc) {
  const rows = await ledgerRows(page);
  return rows.find((r) => r.desc === desc) || null;
}

module.exports = {
  attachDialogHandler,
  openApp,
  authOverlayHidden,
  isLoggedIn,
  waitForDataReady,
  openTab,
  parseCurrency,
  readPatrimonio,
  readCardAmount,
  ledgerCount,
  ledgerRows,
  ensureBankExists,
  openNewEntry,
  addEntry,
  findLedgerRow,
};
