/* Auditoria visual do modal de categorias via Chromium headless (CDP).
   Uso: node e2e/visual/audit-categorias.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.artifacts/audit-categorias');
const BASE = 'http://127.0.0.1:8000/index.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Emulation, Input } = client;

  await Page.enable();
  await Runtime.enable();

  /* Mobile 390×844 (iPhone 14) */
  await Emulation.setDeviceMetricsOverride({
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
  });

  /* Navega para o app */
  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000); /* espera app inicializar + Firebase */

  /* Screenshot 1: estado inicial (dashboard) */
  await screenshot(client, '01-dashboard');

  /* Abre o perfil para chegar no botão Categorias */
  const r1 = await evalJS(Runtime, `
    (() => {
      const btn = document.querySelector('[data-tab="profile"]') ||
                  document.querySelector('.nav-tab[data-tab="profile"]');
      if (btn) { btn.click(); return 'clicked-tab'; }
      /* fallback: nav mobile */
      const tabs = [...document.querySelectorAll('.nav-tab, [data-tab]')];
      const p = tabs.find(t => (t.dataset.tab || t.getAttribute('data-tab') || '').includes('profile'));
      if (p) { p.click(); return 'clicked-profile'; }
      return 'no-tab-found: ' + tabs.map(t => t.dataset.tab || t.className).join(', ');
    })()
  `);
  console.log('nav perfil:', r1);
  await sleep(1000);
  await screenshot(client, '02-perfil');

  /* Clica em #btnCategoria */
  const r2 = await evalJS(Runtime, `
    (() => {
      const btn = document.getElementById('btnCategoria');
      if (!btn) return 'btnCategoria-not-found';
      btn.click();
      return 'clicked-categoria';
    })()
  `);
  console.log('abrir categoria:', r2);
  await sleep(1500);

  /* Screenshot 3: modal de categorias aberto */
  await screenshot(client, '03-modal-categorias');

  /* Verifica estrutura interna */
  const r3 = await evalJS(Runtime, `
    (() => {
      const modal = document.getElementById('panelCategoria');
      if (!modal || !modal.classList.contains('open')) return 'modal-not-open';
      const list = document.getElementById('catManageList');
      const rows = list ? list.querySelectorAll('.cat-list-item') : [];
      const subs = list ? list.querySelectorAll('.sub-cat-label') : [];
      const dels = list ? list.querySelectorAll('.sub-del') : [];
      const dashed = list ? list.querySelectorAll('.cat-list-item') : [];
      let dashedCount = 0;
      dashed.forEach(el => {
        const s = getComputedStyle(el);
        if (s.borderBottomStyle === 'dashed') dashedCount++;
      });
      return JSON.stringify({
        modalOpen: true,
        catCount: rows.length,
        subCount: subs.length,
        delCount: dels.length,
        dashedCount,
        firstRow: rows[0] ? {
          name: rows[0].querySelector('.cat-name')?.textContent?.trim(),
          hasAdd: !!rows[0].querySelector('.action-btn.add'),
          hasDel: !!rows[0].querySelector('.action-btn.del'),
          hasSubsLine: !!rows[0].querySelector('.sub-cats-line'),
        } : null,
      });
    })()
  `);
  console.log('estrutura:', r3);

  /* Se houver categorias, clica em "+ sub" da primeira para ver o popover */
  const r4 = await evalJS(Runtime, `
    (() => {
      const addBtn = document.querySelector('#catManageList .cat-list-item .action-btn.add');
      if (!addBtn) return 'no-add-btn';
      addBtn.click();
      return 'clicked-add-sub';
    })()
  `);
  console.log('popover:', r4);
  await sleep(800);
  await screenshot(client, '04-popover-subcategoria');

  /* Fecha o popover se existir */
  await evalJS(Runtime, `
    (() => {
      const cancel = document.querySelector('#subcat-popover button');
      if (cancel) cancel.click();
    })()
  `);
  await sleep(500);

  /* Screenshot 5: tema escuro (se suportado) */
  await evalJS(Runtime, `document.body.classList.add('dark-mode')`);
  await sleep(500);
  await screenshot(client, '05-tema-escuro');
  await evalJS(Runtime, `document.body.classList.remove('dark-mode')`);

  /* Screenshot 6: viewport desktop 1280×800 */
  await Emulation.setDeviceMetricsOverride({
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  });
  await sleep(500);
  await screenshot(client, '06-desktop');

  await client.close();
  console.log('Screenshots em:', OUT);
}

async function evalJS(Runtime, expression) {
  try {
    const { result, exceptionDetails } = await Runtime.evaluate({
      expression, returnByValue: true, awaitPromise: true,
    });
    if (exceptionDetails) return 'ERR: ' + (exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  } catch (e) { return 'ERR: ' + e.message; }
}

async function screenshot(client, name) {
  const { Page } = client;
  const { data } = await Page.captureScreenshot({ format: 'png' });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('shot:', file);
}

main().catch(e => { console.error(e); process.exit(1); });
