/* Verificação da expansão do card "Total investido" na aba Investimento via Chromium CDP.
   Uso: node e2e/visual/verify-invest-total-expand.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.artifacts/verify-invest-total-expand');
const BASE = 'http://127.0.0.1:8000/index.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  try {
    const { result, exceptionDetails } = await Runtime.evaluate({
      expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) return { error: exceptionDetails.exception?.description || exceptionDetails.text };
    return { value: result.value };
  } catch (e) { return { error: e.message }; }
}

async function screenshot(Page, name) {
  const { data } = await Page.captureScreenshot({ format: 'png' });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('  shot:', file);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Emulation } = client;

  await Page.enable();
  await Runtime.enable();
  await Emulation.setDeviceMetricsOverride({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000);

  const mockInvestments = [
    { id: 'inv1', name: 'Tesouro IPCA 2029', type: 'Renda Fixa', institution: 'Banco Alpha', initialValue: 5000, value: 5200, units: 1, rate: 'IPCA+6%' },
    { id: 'inv2', name: 'CDB Liquidez Diária', type: 'Renda Fixa', institution: 'Banco Alpha', initialValue: 3000, value: 3100, units: 1, rate: '110% CDI' },
    { id: 'inv3', name: 'FII HGLG11', type: 'FII', institution: 'Banco Alpha', initialValue: 2000, value: 2150, units: 100 },
    { id: 'inv4', name: 'PETR4', type: 'Ações', institution: 'Corretora Beta', initialValue: 4000, value: 4500, units: 200 },
    { id: 'inv5', name: 'VALE3', type: 'Ações', institution: 'Corretora Beta', initialValue: 3500, value: 3800, units: 100 },
    { id: 'inv6', name: 'Bitcoin', type: 'Bitcoin', institution: 'Exchange Gamma', initialValue: 1000, value: 1500, units: 0.015, price: 50000 },
  ];
  const mockYields = [
    { id: 'y1', targetType: 'invest', targetId: 'inv1', kind: 'rendimento', amount: 200, dateEnd: '2026-10-01' },
    { id: 'y2', targetType: 'invest', targetId: 'inv2', kind: 'rendimento', amount: 100, dateEnd: '2026-10-01' },
  ];
  const mockBanks = [
    { id: 'bank1', name: 'Banco Alpha', saldo: 8100 },
    { id: 'bank2', name: 'Corretora Beta', saldo: 8300 },
  ];
  const mockCategories = [
    { id: 'cat1', name: 'Investimentos', emoji: '📈' },
  ];

  const r0 = await evalJS(Runtime, `
    (() => {
      document.getElementById('authOverlay')?.classList.add('hidden');
      investments = ${JSON.stringify(mockInvestments)};
      yieldsLog = ${JSON.stringify(mockYields)};
      banks = ${JSON.stringify(mockBanks)};
      categories = ${JSON.stringify(mockCategories)};
      entries = [];
      pockets = [];
      window.investments = investments;
      window.yieldsLog = yieldsLog;
      window.banks = banks;
      window.categories = categories;
      window.entries = entries;
      window.pockets = pockets;
      firstLoadDone = true;
      currentUser = { uid: 'test-user-123', email: 'test@test.com' };
      if (typeof window.switchTab === 'function') {
        window.switchTab('invest');
      }
      if (typeof render === 'function') {
        render();
        return 'render-called';
      }
      return 'no-render-func';
    })()
  `);
  console.log('1. Bypass auth + render invest:', r0.value || r0.error);
  await sleep(2000);
  await screenshot(Page, '01-total-colapsado');

  const r2 = await evalJS(Runtime, `
    (() => {
      const box = document.getElementById('investTotalBox');
      const symbol = document.querySelector('#investBalanceStrip .balance-card.total .balance-symbol');
      const card = document.querySelector('#investBalanceStrip .balance-card.total');
      return JSON.stringify({
        cardExists: !!card,
        symbolExists: !!symbol,
        role: symbol?.getAttribute('role'),
        tabindex: symbol?.getAttribute('tabindex'),
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        ariaControls: symbol?.getAttribute('aria-controls'),
        ariaLabel: symbol?.getAttribute('aria-label'),
        boxExists: !!box,
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
        amountText: card?.querySelector('.amount')?.textContent,
        labelText: card?.querySelector('.label')?.textContent,
      });
    })()
  `);
  console.log('2. Estado inicial card Total investido:', r2.value || r2.error);

  const r3 = await evalJS(Runtime, `
    (() => {
      const symbol = document.querySelector('#investBalanceStrip .balance-card.total .balance-symbol');
      if (!symbol) return 'no-symbol';
      symbol.click();
      return 'clicked-total-symbol';
    })()
  `);
  console.log('3. Clicar símbolo Total investido:', r3.value || r3.error);
  await sleep(1000);
  await screenshot(Page, '02-total-expandido');

  const r4 = await evalJS(Runtime, `
    (() => {
      const box = document.getElementById('investTotalBox');
      const symbol = document.querySelector('#investBalanceStrip .balance-card.total .balance-symbol');
      const rows = box?.querySelectorAll('div').length || 0;
      return JSON.stringify({
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
        boxHasContent: !!box?.innerHTML?.trim(),
        rowCount: rows,
      });
    })()
  `);
  console.log('4. Após expandir:', r4.value || r4.error);

  const r5 = await evalJS(Runtime, `
    (() => {
      const symbol = document.querySelector('#investBalanceStrip .balance-card.total .balance-symbol');
      if (!symbol) return 'no-symbol';
      symbol.click();
      return 'clicked-again-recolher';
    })()
  `);
  console.log('5. Clicar novamente (recolher):', r5.value || r5.error);
  await sleep(1000);
  await screenshot(Page, '03-total-recolhido');

  const r6 = await evalJS(Runtime, `
    (() => {
      const box = document.getElementById('investTotalBox');
      const symbol = document.querySelector('#investBalanceStrip .balance-card.total .balance-symbol');
      return JSON.stringify({
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
      });
    })()
  `);
  console.log('6. Após recolher:', r6.value || r6.error);

  await client.close();
  console.log('\nScreenshots em:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
