/* C.1.3 — Medição CSS × DOM no Chromium (CDP). Versão linear simplificada. */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const PORT = 9222;
const BASE = 'http://127.0.0.1:8000/index.html';

const JS = fs.readFileSync(
  '/data/data/com.termux/files/home/LIVRO-CAIXA/.tmp-c13/inject-measure.js',
  'utf8'
);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const client = await CDP({ port: PORT });
  const { Page, Runtime, Emulation } = client;
  await Page.enable();
  await Runtime.enable();

  const viewports = [
    { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
    { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
  ];

  const resultados = {};

  for (const vp of viewports) {
    console.log('\n=== Viewport: ' + vp.name + ' (' + vp.width + 'x' + vp.height + ') ===');

    await Emulation.setDeviceMetricsOverride({
      width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile,
    });

    await Page.navigate({ url: BASE });
    await Page.loadEventFired();
    await sleep(8000);

    // Aguardar app carregar
    await Runtime.evaluate({
      expression: 'new Promise(function(resolve) { var check = function() { var body = document.body; var sync = document.getElementById("syncOverlay"); var ready = (!body.classList.contains("is-data-loading")) && (sync && sync.classList.contains("hidden") || !sync); if (ready) resolve(true); else setTimeout(check, 300); }; check(); setTimeout(function() { resolve(false); }, 60000); })',
      awaitPromise: true, timeout: 65000,
    });
    await sleep(1000);

    const vpResult = {};

    for (const state of ['base', 'dark-mode', 'classes-applied']) {
      if (state === 'dark-mode') {
        await Runtime.evaluate({ expression: 'document.body.classList.add("dark-mode")', awaitPromise: true });
        await sleep(500);
      } else if (state === 'classes-applied') {
        await Runtime.evaluate({
          expression: '(function() { document.body.classList.add("dark-mode"); var el = document.getElementById("viewDash"); if (el) el.classList.add("is-collapsed"); var el2 = document.getElementById("viewCaixa"); if (el2) el2.classList.add("is-expanded"); var el3 = document.getElementById("viewInicio"); if (el3) el3.classList.add("tab-changing"); return "ok"; })()',
          awaitPromise: true,
        });
        await sleep(500);
      }

      let resp;
      try {
        resp = await Runtime.evaluate({ expression: JS, returnByValue: true, awaitPromise: true, timeout: 120000 });
      } catch (e) {
        console.log('  ERRO estado ' + state + ': ' + String(e.message || e));
        vpResult[state] = [];
        continue;
      }

      if (resp.exceptionDetails) {
        console.log('  EXCEÇÃO estado ' + state + ': ' + resp.exceptionDetails.exception?.description);
        vpResult[state] = [];
        continue;
      }

      const results = (resp.result && resp.result.value) || [];
      console.log('  Estado ' + state + ': ' + results.length + ' seletores');
      vpResult[state] = results;

      if (state !== 'base') {
        await Runtime.evaluate({
          expression: '(function() { document.body.classList.remove("dark-mode"); var els = document.querySelectorAll(".is-collapsed, .is-expanded, .tab-changing"); els.forEach(function(e) { e.classList.remove("is-collapsed","is-expanded","tab-changing"); }); return "ok"; })()',
          awaitPromise: true,
        });
        await sleep(500);
      }
    }

    resultados[vp.name] = vpResult;
  }

  await client.close();

  // Relatório
  console.log('\n========================================');
  console.log('RELATÓRIO DE MEDIÇÃO CSS × DOM');
  console.log('========================================');
  console.log('Head: b6d7f91d8b192ecdfd63575e1fbdf135182a8485');
  console.log('URL: ' + BASE);

  for (const vpName in resultados) {
    if (!resultados.hasOwnProperty(vpName)) continue;
    const vpData = resultados[vpName];
    console.log('\n----- ' + vpName + ' -----');
    for (const state in vpData) {
      if (!vpData.hasOwnProperty(state)) continue;
      const results = vpData[state];
      const total = results.length;
      const estatica = results.filter(r => r.status === 'estatica').length;
      const semCorr = results.filter(r => r.status === 'sem-correspondencia').length;
      const inconclusivo = results.filter(r => r.status === 'inconclusivo').length;
      console.log('  ' + state + ': total=' + total + ' estatica=' + estatica + ' semCorr=' + semCorr + ' inconc=' + inconclusivo);
    }
  }

  const outFile = '/data/data/com.termux/files/usr/tmp/opencode/medicao-css-dom-resultado.json';
  fs.writeFileSync(outFile, JSON.stringify(resultados, null, 2));
  console.log('\nSalvo em: ' + outFile);
}

main().catch(e => { console.error(e); process.exit(1); });
