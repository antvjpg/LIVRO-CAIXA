/* Auditoria do gráfico donut no card Total investido.
   Verifica se o canvas existe, se o Chart.js está disponível,
   se o gráfico é criado e se permanece após troca de tema. */

import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../.artifacts/audit-invest-donut');
const BASE = 'http://127.0.0.1:8000/index.html';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) return { error: exceptionDetails.exception?.description || exceptionDetails.text };
  return { value: result.value };
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
  const { Page, Runtime } = client;

  await Page.enable();
  await Runtime.enable();

  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000);

  /* Injeta mock e renderiza aba investimento */
  await Runtime.evaluate({ expression: `
    document.getElementById("authOverlay")?.classList.add("hidden");
    investments = [
      { id: "inv1", name: "Tesouro IPCA", type: "Renda Fixa", institution: "Banco Alpha", initialValue: 5000, value: 5200, units: 1 },
      { id: "inv2", name: "CDB", type: "Renda Fixa", institution: "Corretora Beta", initialValue: 3000, value: 3100, units: 1 },
      { id: "inv3", name: "FII", type: "FII", institution: "Banco Alpha", initialValue: 2000, value: 2150, units: 100 },
    ];
    yieldsLog = []; banks = []; categories = []; entries = []; pockets = [];
    window.investments = investments; window.yieldsLog = yieldsLog; window.banks = banks;
    window.categories = categories; window.entries = entries; window.pockets = pockets;
    firstLoadDone = true; currentUser = { uid: "u1", email: "t@t.com" };
    if (typeof window.switchTab === "function") window.switchTab("invest");
    if (typeof render === "function") render();
  `, awaitPromise: true });
  await sleep(1500);
  await screenshot(Page, 'audit-01-estado-inicial');

  /* Verifica estado inicial */
  const r1 = await evalJS(Runtime, `
    (() => {
      const canvas = document.getElementById("investTotalDonutChart");
      const box = document.getElementById("investTotalBox");
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const btn = document.getElementById("btnExpandInvestTotal");
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        cardClassList: card ? Array.from(card.classList) : null,
        cardHeight: card ? card.getBoundingClientRect().height : null,
        boxClassList: box ? Array.from(box.classList) : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        canvasExists: !!canvas,
        chartExists: typeof Chart !== "undefined",
        investmentsArray: Array.isArray(window.investments),
        investmentsLength: window.investments ? window.investments.length : null,
      });
    })()
  `);
  console.log("ANTES de expandir:", JSON.stringify(r1.value || r1.error));

  /* Clica no botão Expandir */
  await Runtime.evaluate({ expression: `document.getElementById("btnExpandInvestTotal").click();`, awaitPromise: true });
  await sleep(1000);
  await screenshot(Page, 'audit-02-após-expandir');

  const r2 = await evalJS(Runtime, `
    (() => {
      const canvas = document.getElementById("investTotalDonutChart");
      const box = document.getElementById("investTotalBox");
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const btn = document.getElementById("btnExpandInvestTotal");
      const donutInstance = window.investTotalDonutInstance;
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
        cardClassList: card ? Array.from(card.classList) : null,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
        boxClassList: box ? Array.from(box.classList) : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        canvasExists: !!canvas,
        canvasWidth: canvas ? canvas.width : null,
        canvasHeight: canvas ? canvas.height : null,
        chartInstanceExists: !!donutInstance,
        chartInstanceChart: donutInstance ? !!donutInstance.chart : null,
        boxInnerTextLen: box ? box.innerText.trim().length : 0,
      });
    })()
  `);
  console.log("APÓS expandir:", JSON.stringify(r2.value || r2.error));
  await screenshot(Page, 'audit-03-card-expandido');

  /* Troca para tema escuro */
  await Runtime.evaluate({ expression: `
    document.body.classList.toggle('dark-mode');
    if (typeof renderInvestments === "function") renderInvestments();
  `, awaitPromise: true });
  await sleep(1000);
  await screenshot(Page, 'audit-04-tema-escuro');

  const r3 = await evalJS(Runtime, `
    (() => {
      const canvas = document.getElementById("investTotalDonutChart");
      const box = document.getElementById("investTotalBox");
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const btn = document.getElementById("btnExpandInvestTotal");
      const donutInstance = window.investTotalDonutInstance;
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
        cardClassList: card ? Array.from(card.classList) : null,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
        boxClassList: box ? Array.from(box.classList) : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        canvasExists: !!canvas,
        chartInstanceExists: !!donutInstance,
        darkMode: document.body.classList.contains("dark-mode"),
      });
    })()
  `);
  console.log("APÓS trocar tema:", JSON.stringify(r3.value || r3.error));
  await screenshot(Page, 'audit-05-tema-escuro-final');

  /* Recolhe e expande novamente */
  await Runtime.evaluate({ expression: `document.getElementById("btnExpandInvestTotal").click();`, awaitPromise: true });
  await sleep(800);
  await screenshot(Page, 'audit-06-recolhido');

  const r4 = await evalJS(Runtime, `
    (() => {
      const btn = document.getElementById("btnExpandInvestTotal");
      const box = document.getElementById("investTotalBox");
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        boxClassList: box ? Array.from(box.classList) : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        cardClassList: card ? Array.from(card.classList) : null,
      });
    })()
  `);
  console.log("APÓS recolher:", JSON.stringify(r4.value || r4.error));

  await Runtime.evaluate({ expression: `document.getElementById("btnExpandInvestTotal").click();`, awaitPromise: true });
  await sleep(800);
  await screenshot(Page, 'audit-07-re-expandido');

  const r5 = await evalJS(Runtime, `
    (() => {
      const canvas = document.getElementById("investTotalDonutChart");
      const box = document.getElementById("investTotalBox");
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const btn = document.getElementById("btnExpandInvestTotal");
      const donutInstance = window.investTotalDonutInstance;
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        btnAriaExpanded: btn ? btn.getAttribute("aria-expanded") : null,
        cardClassList: card ? Array.from(card.classList) : null,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
        boxClassList: box ? Array.from(box.classList) : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        canvasExists: !!canvas,
        chartInstanceExists: !!donutInstance,
        boxInnerTextLen: box ? box.innerText.trim().length : 0,
      });
    })()
  `);
  console.log("APÓS re-expandir:", JSON.stringify(r5.value || r5.error));

  await client.close();
  console.log('\nScreenshots em:', OUT);
}

main().catch(e => { console.error(e); process.exit(1); });
