/* Auditoria profunda da expansão vertical do card "Total investido".
   Uso: node e2e/visual/audit-invest-total-expand.mjs
   Requer: servidor local em :8000 e Chromium com --remote-debugging-port=9222 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.artifacts/audit-invest-total-expand');
const BASE = 'http://127.0.0.1:8000/index.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) return { error: exceptionDetails.exception?.description || exceptionDetails.text };
  return { value: result.value };
}

async function screenshot(Page, name, clip) {
  const params = { format: 'png' };
  if (clip) params.clip = clip;
  const { data } = await Page.captureScreenshot(params);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('  shot:', file);
}

async function getBoxModel(Runtime, objectId) {
  const { model } = await Runtime.getBoxModel({ objectId });
  return model;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, Emulation } = client;

  await Page.enable();
  await Runtime.enable();
  await DOM.enable();
  await Emulation.setDeviceMetricsOverride({ width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000);

  /* Injeta mock e renderiza aba invest */
  await Runtime.evaluate({ expression: `
    document.getElementById("authOverlay")?.classList.add("hidden");
    investments = [
      { id: "inv1", name: "Tesouro IPCA 2029", type: "Renda Fixa", institution: "Banco Alpha", initialValue: 5000, value: 5200, units: 1 },
      { id: "inv2", name: "CDB", type: "Renda Fixa", institution: "Corretora Beta", initialValue: 3000, value: 3100, units: 1 },
      { id: "inv3", name: "FII HGLG11", type: "FII", institution: "Banco Alpha", initialValue: 2000, value: 2150, units: 100 },
      { id: "inv4", name: "PETR4", type: "Ações", institution: "Corretora Beta", initialValue: 4000, value: 4500, units: 200 },
    ];
    yieldsLog = []; banks = [{ id: "b1", name: "Banco Alpha", saldo: 8100 }]; categories = [{ id: "c1", name: "Investimentos", emoji: "📈" }]; entries = []; pockets = [];
    window.investments = investments; window.yieldsLog = yieldsLog; window.banks = banks; window.categories = categories; window.entries = entries; window.pockets = pockets;
    firstLoadDone = true; currentUser = { uid: "u1", email: "t@t.com" };
    if (typeof window.switchTab === "function") window.switchTab("invest");
    if (typeof render === "function") render();
  `, awaitPromise: true });
  await sleep(2000);
  await screenshot(Page, 'audit-01-estado-inicial');

  /* Estado inicial do card */
  const initial = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const box = document.getElementById("investTotalBox");
      const btn = document.querySelector("#investBalanceStrip .invest-total-expand-btn");
      const sym = card?.querySelector(".balance-symbol");
      const comp = (el) => el ? getComputedStyle(el) : null;
      return JSON.stringify({
        cardExists: !!card,
        boxExists: !!box,
        btnExists: !!btn,
        boxClassList: box ? Array.from(box.classList) : [],
        boxCollapsed: box ? box.classList.contains("is-collapsed") : null,
        boxHiddenAttr: box ? box.getAttribute("aria-hidden") : null,
        boxInnerHTMLLen: box ? box.innerHTML.trim().length : 0,
        btnText: btn ? btn.textContent : null,
        btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
        symAriaExpanded: sym ? sym.getAttribute("aria-expanded") : null,
        cardComputed: card ? { display: comp(card).display, overflow: comp(card).overflow, height: comp(card).height, maxHeight: comp(card).maxHeight, position: comp(card).position, zIndex: comp(card).zIndex } : null,
        boxComputed: box ? { display: comp(box).display, overflow: comp(box).overflow, height: comp(box).height, maxHeight: comp(box).maxHeight, visibility: comp(box).visibility, opacity: comp(box).opacity, pointerEvents: comp(box).pointerEvents } : null,
      });
    })()
  `);
  console.log('ESTADO INICIAL:', initial.value || initial.error);
  await screenshot(Page, 'audit-02-card-inicial');

  /* Clica no botao Expandir */
  await Runtime.evaluate({ expression: `
    document.querySelector("#investBalanceStrip .invest-total-expand-btn").click();
  `, awaitPromise: true });
  await sleep(800);
  await screenshot(Page, 'audit-03-após-clicar-expandir');

  /* Estado após expandir - inclui box model e rect */
  const after = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const box = document.getElementById("investTotalBox");
      const btn = document.querySelector("#investBalanceStrip .invest-total-expand-btn");
      const rect = (el) => el ? el.getBoundingClientRect() : null;
      const comp = (el) => el ? getComputedStyle(el) : null;
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
        boxClassList: box ? Array.from(box.classList) : [],
        boxCollapsed: box ? box.classList.contains("is-collapsed") : null,
        boxHiddenAttr: box ? box.getAttribute("aria-hidden") : null,
        boxInnerHTMLLen: box ? box.innerHTML.trim().length : 0,
        boxText: box ? box.innerText.trim().slice(0, 200) : null,
        cardRect: rect(card),
        boxRect: rect(box),
        cardComputed: card ? { display: comp(card).display, overflow: comp(card).overflow, height: comp(card).height, maxHeight: comp(card).maxHeight, position: comp(card).position, zIndex: comp(card).zIndex } : null,
        boxComputed: box ? { display: comp(box).display, overflow: comp(box).overflow, height: comp(box).height, maxHeight: comp(box).maxHeight, visibility: comp(box).visibility, opacity: comp(box).opacity, pointerEvents: comp(box).pointerEvents } : null,
        stripComputed: document.getElementById("investBalanceStrip") ? { display: comp(document.getElementById("investBalanceStrip")).display, overflow: comp(document.getElementById("investBalanceStrip")).overflow, gridTemplateColumns: comp(document.getElementById("investBalanceStrip")).gridTemplateColumns } : null,
      });
    })()
  `);
  console.log('APÓS EXPANDIR:', after.value || after.error);
  await screenshot(Page, 'audit-04-card-expandido');

  /* Tenta recolher via teclado no simbolo para confirmar simetria */
  await Runtime.evaluate({ expression: `
    document.querySelector("#investBalanceStrip .balance-symbol").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  `, awaitPromise: true });
  await sleep(800);
  await screenshot(Page, 'audit-05-recolhido-via-teclado');

  await client.close();
  console.log('\nScreenshots em:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
