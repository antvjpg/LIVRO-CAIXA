/* Verificação da expansão do card de investimento via Chromium CDP.
   Uso: node e2e/visual/verify-invest-expand.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.artifacts/verify-invest-expand');
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

  /* Navega para o app */
  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000);

  /* Bypass auth: esconde overlay, injeta dados mock, renderiza aba investimentos */
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
      /* 1. Esconde auth overlay */
      document.getElementById('authOverlay')?.classList.add('hidden');
      /* 2. Injeta dados mock no escopo léxico + window */
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
      /* 3. Marca como carregado e simula usuário autenticado */
      firstLoadDone = true;
      currentUser = { uid: 'test-user-123', email: 'test@test.com' };
      /* 4. Troca para a aba investimentos */
      if (typeof window.switchTab === 'function') {
        window.switchTab('invest');
      }
      /* 5. Força renderização global */
      if (typeof render === 'function') {
        render();
        return 'render-called';
      }
      return 'no-render-func';
    })()
  `);
  console.log('1. Bypass auth + render invest:', r0.value || r0.error);
  await sleep(2000);
  await screenshot(Page, '01-aba-investimentos');

  /* Verifica estrutura da aba investimentos */
  const r2 = await evalJS(Runtime, `
    (() => {
      const container = document.getElementById('investGrid');
      if (!container) return JSON.stringify({ error: 'investGrid-not-found', html: document.body.innerHTML.slice(0, 500) });
      const institutions = container.querySelectorAll('.institution-card');
      const viewAllBtns = container.querySelectorAll('.institution-view-all');
      const menuBtns = container.querySelectorAll('.institution-menu');
      const moreBlocks = container.querySelectorAll('.institution-more');
      const assetCards = container.querySelectorAll('.asset-card');
      const info = {
        institutionCount: institutions.length,
        viewAllBtnCount: viewAllBtns.length,
        menuBtnCount: menuBtns.length,
        moreBlockCount: moreBlocks.length,
        visibleAssetCards: assetCards.length,
        institutions: [],
      };
      institutions.forEach(inst => {
        const key = inst.dataset.institutionKey;
        const assets = inst.querySelectorAll('.asset-card');
        const viewAll = inst.querySelector('.institution-view-all');
        const more = inst.querySelector('.institution-more');
        const moreText = more ? more.querySelector('span')?.textContent : null;
        info.institutions.push({
          key,
          visibleAssets: assets.length,
          hasViewAll: !!viewAll,
          viewAllText: viewAll?.textContent?.trim(),
          moreText,
          expanded: viewAll?.getAttribute('aria-expanded'),
        });
      });
      return JSON.stringify(info);
    })()
  `);
  console.log('2. Estrutura investimentos:', r2.value || r2.error);

  /* Testa expansão: clica no primeiro "Ver investimentos" */
  const r3 = await evalJS(Runtime, `
    (() => {
      const btn = document.querySelector('.institution-view-all');
      if (!btn) return 'no-view-all-btn';
      const key = btn.dataset.institutionKey;
      btn.click();
      return 'clicked-view-all:' + key;
    })()
  `);
  console.log('3. Clicar "Ver investimentos":', r3.value || r3.error);
  await sleep(1000);
  await screenshot(Page, '02-investimentos-expandido');

  /* Verifica se expandiu */
  const r4 = await evalJS(Runtime, `
    (() => {
      const container = document.getElementById('investGrid');
      if (!container) return JSON.stringify({ error: 'investGrid-not-found' });
      const institutions = container.querySelectorAll('.institution-card');
      const info = { institutions: [] };
      institutions.forEach(inst => {
        const assets = inst.querySelectorAll('.asset-card');
        const viewAll = inst.querySelector('.institution-view-all');
        const more = inst.querySelector('.institution-more');
        info.institutions.push({
          key: inst.dataset.institutionKey,
          visibleAssets: assets.length,
          viewAllText: viewAll?.textContent?.trim(),
          hasMoreBlock: !!more,
          ariaExpanded: viewAll?.getAttribute('aria-expanded'),
        });
      });
      return JSON.stringify(info);
    })()
  `);
  console.log('4. Após expansão:', r4.value || r4.error);

  /* Testa recolhimento: clica "Ver menos" */
  const r5 = await evalJS(Runtime, `
    (() => {
      const btn = document.querySelector('.institution-view-all');
      if (!btn) return 'no-view-all-btn';
      if (btn.textContent.includes('menos')) {
        btn.click();
        return 'clicked-ver-menos';
      }
      return 'btn-text:' + btn.textContent;
    })()
  `);
  console.log('5. Clicar "Ver menos":', r5.value || r5.error);
  await sleep(1000);

  /* Verifica se recolheu */
  const r6 = await evalJS(Runtime, `
    (() => {
      const container = document.getElementById('investGrid');
      const institutions = container ? container.querySelectorAll('.institution-card') : [];
      const first = institutions[0];
      if (!first) return 'no-institution';
      const assets = first.querySelectorAll('.asset-card').length;
      const viewAll = first.querySelector('.institution-view-all');
      return JSON.stringify({ visibleAssets: assets, viewAllText: viewAll?.textContent?.trim() });
    })()
  `);
  console.log('6. Após recolher:', r6.value || r6.error);

  /* Volta para o dashboard e testa o card Invest. */
  const r7 = await evalJS(Runtime, `
    (() => {
      if (typeof window.switchTab === 'function') {
        window.switchTab('dash');
        return 'switched-to-dash';
      }
      const tab = document.querySelector('[data-tab="dash"]');
      if (tab) { tab.click(); return 'clicked-dash-tab'; }
      return 'no-switch';
    })()
  `);
  console.log('7. Voltar ao dashboard:', r7.value || r7.error);
  await sleep(1500);
  await screenshot(Page, '03-dashboard');

  /* Verifica estado inicial do card Invest. */
  const r8 = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector('.invest-summary-card');
      if (!card) return JSON.stringify({ error: 'invest-summary-card-not-found' });
      const symbol = card.querySelector('.balance-symbol');
      const box = document.getElementById('investBreakdownBox');
      return JSON.stringify({
        cardExists: true,
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        boxExists: !!box,
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
        boxHasCanvas: !!box?.querySelector('canvas'),
      });
    })()
  `);
  console.log('8. Estado inicial card Invest.:', r8.value || r8.error);

  /* Clica no card Invest. para expandir */
  const r9 = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector('.invest-summary-card');
      if (!card) return 'no-card';
      card.click();
      return 'clicked-invest-card';
    })()
  `);
  console.log('9. Clicar card Invest.:', r9.value || r9.error);
  await sleep(1500);
  await screenshot(Page, '04-dashboard-invest-expandido');

  /* Verifica se expandiu */
  const r10 = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector('.invest-summary-card');
      if (!card) return JSON.stringify({ error: 'no-card' });
      const symbol = card.querySelector('.balance-symbol');
      const box = document.getElementById('investBreakdownBox');
      return JSON.stringify({
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
        boxHasCanvas: !!box?.querySelector('canvas'),
        canvasId: box?.querySelector('canvas')?.id,
      });
    })()
  `);
  console.log('10. Após expandir card Invest.:', r10.value || r10.error);

  /* Clica novamente para recolher */
  const r11 = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector('.invest-summary-card');
      if (!card) return 'no-card';
      card.click();
      return 'clicked-again';
    })()
  `);
  console.log('11. Clicar novamente (recolher):', r11.value || r11.error);
  await sleep(1000);

  /* Verifica se recolheu */
  const r12 = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector('.invest-summary-card');
      if (!card) return JSON.stringify({ error: 'no-card' });
      const symbol = card.querySelector('.balance-symbol');
      const box = document.getElementById('investBreakdownBox');
      return JSON.stringify({
        ariaExpanded: symbol?.getAttribute('aria-expanded'),
        boxCollapsed: box?.classList.contains('is-collapsed'),
        boxHidden: box?.getAttribute('aria-hidden'),
      });
    })()
  `);
  console.log('12. Após recolher card Invest.:', r12.value || r12.error);

  await client.close();
  console.log('\nScreenshots em:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
