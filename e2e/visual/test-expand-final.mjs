/* Teste final: validar que o card Total investido expande verticalmente */
import CDP from 'chrome-remote-interface';

const BASE = 'http://127.0.0.1:8000/index.html?v=final2';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function evalJS(Runtime, expression) {
  const { result, exceptionDetails } = await Runtime.evaluate({
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) return { error: exceptionDetails.exception?.description || exceptionDetails.text };
  return { value: result.value };
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime } = client;
  await Page.enable();
  await Runtime.enable();

  await Page.navigate({ url: BASE });
  await Page.loadEventFired();
  await sleep(3000);

  await Runtime.evaluate({ expression: `
    document.getElementById("authOverlay")?.classList.add("hidden");
    investments = [
      { id: "inv1", name: "Tesouro IPCA 2029", type: "Renda Fixa", institution: "Banco Alpha", initialValue: 5000, value: 5200, units: 1 },
      { id: "inv2", name: "CDB", type: "Renda Fixa", institution: "Corretora Beta", initialValue: 3000, value: 3100, units: 1 },
      { id: "inv3", name: "FII HGLG11", type: "FII", institution: "Banco Alpha", initialValue: 2000, value: 2150, units: 100 },
    ];
    yieldsLog = []; banks = []; categories = []; entries = []; pockets = [];
    window.investments = investments; window.yieldsLog = yieldsLog; window.banks = banks; window.categories = categories; window.entries = entries; window.pockets = pockets;
    firstLoadDone = true; currentUser = { uid: "u1", email: "t@t.com" };
    if (typeof window.switchTab === "function") window.switchTab("invest");
    if (typeof render === "function") render();
  `, awaitPromise: true });
  await sleep(1500);

  const before = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const box = document.getElementById("investTotalBox");
      const btn = document.getElementById("btnExpandInvestTotal");
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        cardClasses: card ? Array.from(card.classList) : null,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
        boxCollapsed: box ? box.classList.contains("is-collapsed") : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
      });
    })()
  `);
  console.log("ANTES:", JSON.stringify(before.value || before.error));

  await Runtime.evaluate({ expression: `document.getElementById("btnExpandInvestTotal").click();`, awaitPromise: true });
  await sleep(800);

  const after = await evalJS(Runtime, `
    (() => {
      const card = document.querySelector("#investBalanceStrip .balance-card.total");
      const box = document.getElementById("investTotalBox");
      const btn = document.getElementById("btnExpandInvestTotal");
      return JSON.stringify({
        btnText: btn ? btn.textContent : null,
        cardClasses: card ? Array.from(card.classList) : null,
        cardHeight: card ? Math.round(card.getBoundingClientRect().height) : null,
        boxCollapsed: box ? box.classList.contains("is-collapsed") : null,
        boxHidden: box ? box.getAttribute("aria-hidden") : null,
        boxHasContent: box ? box.innerHTML.trim().length > 0 : null,
        boxText: box ? box.innerText.trim().slice(0, 150) : null,
        cardOverflow: card ? getComputedStyle(card).overflow : null,
      });
    })()
  `);
  console.log("DEPOIS:", JSON.stringify(after.value || after.error));

  await client.close();
}

main().catch(e => { console.error(e); process.exit(1); });
