/* C.1.3 — Medição CSS × DOM no Chromium (CDP).
   LIVRO-CAIXA — fase de auditoria, sem alterar o aplicativo. */
import CDP from 'chrome-remote-interface';
import fs from 'fs';

const PORT = 9222;
const BASE = 'http://127.0.0.1:8000/index.html';

const VIEWPORTS = [
  { name: 'mobile-390x844', width: 390, height: 844, mobile: true },
  { name: 'desktop-1440x900', width: 1440, height: 900, mobile: false },
];

const INJECTED_MEASUREMENT_JS = fs.readFileSync(
  '/data/data/com.termux/files/home/LIVRO-CAIXA/.tmp-c13/inject-measure.js',
  'utf8'
);

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

async function evalJS(Runtime, expression) {
  var resp = await Runtime.evaluate({ expression: expression, returnByValue: true, awaitPromise: true });
  if (resp.exceptionDetails) {
    return { error: resp.exceptionDetails.exception?.description || resp.exceptionDetails.text };
  }
  return { value: resp.result.value };
}

async function measureViewport(client, viewport) {
  var Page = client.Page;
  var Runtime = client.Runtime;
  var Emulation = client.Emulation;

  await Emulation.setDeviceMetricsOverride({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });

  await Page.navigate({ url: BASE });
  await Page.loadEventFired();

  await sleep(8000);

  await Runtime.evaluate({
    expression: 'new Promise(function(resolve) { var check = function() { var body = document.body; var sync = document.getElementById("syncOverlay"); var ready = (!body.classList.contains("is-data-loading")) && (sync && sync.classList.contains("hidden") || !sync); if (ready) resolve(true); else setTimeout(check, 300); }; check(); setTimeout(function() { resolve(false); }, 60000); })',
    awaitPromise: true,
    timeout: 65000,
  });

  await sleep(1000);

  var perViewport = {};

  var stateNames = ['base', 'dark-mode', 'classes-applied'];

  for (var s = 0; s < stateNames.length; s++) {
    var stateName = stateNames[s];

    if (stateName === 'dark-mode') {
      await Runtime.evaluate({ expression: 'document.body.classList.add("dark-mode")', awaitPromise: true });
      await sleep(500);
    } else if (stateName === 'classes-applied') {
      await Runtime.evaluate({
        expression: '(function() { document.body.classList.add("dark-mode"); var el = document.getElementById("viewDash"); if (el) el.classList.add("is-collapsed"); var el2 = document.getElementById("viewCaixa"); if (el2) el2.classList.add("is-expanded"); var el3 = document.getElementById("viewInicio"); if (el3) el3.classList.add("tab-changing"); return "classes-applied"; })()',
        awaitPromise: true,
      });
      await sleep(500);
    }

    var measurement = null;
    try {
      measurement = await Runtime.evaluate({
        expression: INJECTED_MEASUREMENT_JS,
        awaitPromise: true,
        timeout: 120000,
      });
    } catch (e) {
      console.log('ERRO ao injetar JS em estado=' + stateName + ': ' + String(e.message || e));
      perViewport[stateName] = [];
      if (stateName !== 'base') {
        await Runtime.evaluate({
          expression: '(function() { document.body.classList.remove("dark-mode"); var els = document.querySelectorAll(".is-collapsed, .is-expanded, .tab-changing"); els.forEach(function(e) { e.classList.remove("is-collapsed","is-expanded","tab-changing"); }); return "limpo"; })()',
          awaitPromise: true,
        });
        await sleep(500);
      }
      continue;
    }
    var results = (measurement && measurement.value) || [];
    perViewport[stateName] = results;

    if (stateName !== 'base') {
      await Runtime.evaluate({
        expression: '(function() { document.body.classList.remove("dark-mode"); var els = document.querySelectorAll(".is-collapsed, .is-expanded, .tab-changing"); els.forEach(function(e) { e.classList.remove("is-collapsed","is-expanded","tab-changing"); }); return "limpo"; })()',
        awaitPromise: true,
      });
      await sleep(500);
    }
  }

  return { viewport: viewport, perViewport: perViewport };
}

async function main() {
  var client = await CDP({ port: PORT });
  var Page = client.Page;
  var Runtime = client.Runtime;

  await Page.enable();
  await Runtime.enable();

  var resultados = {};

  for (var v = 0; v < VIEWPORTS.length; v++) {
    var viewport = VIEWPORTS[v];
    console.log('\n=== Medindo viewport: ' + viewport.name + ' (' + viewport.width + 'x' + viewport.height + ') ===');
    var r = await measureViewport(client, viewport);
    resultados[viewport.name] = r;
    console.log('  Concluído: ' + viewport.name);
  }

  await client.close();

  console.log('\n========================================');
  console.log('RELATÓRIO DE MEDIÇÃO CSS × DOM');
  console.log('========================================');
  console.log('Head: b6d7f91d8b192ecdfd63575e1fbdf135182a8485');
  console.log('URL: ' + BASE);
  console.log('Viewports: ' + VIEWPORTS.map(function(v) { return v.name; }).join(', '));

  for (var vpName in resultados) {
    if (!resultados.hasOwnProperty(vpName)) continue;
    var vpData = resultados[vpName];
    console.log('\n----- Viewport: ' + vpName + ' -----');
    for (var stateName in vpData.perViewport) {
      if (!vpData.perViewport.hasOwnProperty(stateName)) continue;
      var results = vpData.perViewport[stateName];
      var total = results.length;
      var estatica = results.filter(function(r) { return r.status === 'estatica'; }).length;
      var semCorr = results.filter(function(r) { return r.status === 'sem-correspondencia'; }).length;
      var inconclusivo = results.filter(function(r) { return r.status === 'inconclusivo'; }).length;
      console.log('  Estado "' + stateName + '": total=' + total + ', estatica=' + estatica + ', sem-correspondencia=' + semCorr + ', inconclusivo=' + inconclusivo);
    }
  }

  var outFile = '/data/data/com.termux/files/usr/tmp/opencode/medicao-css-dom-resultado.json';
  fs.writeFileSync(outFile, JSON.stringify(resultados, null, 2));
  console.log('\nResultado detalhado salvo em: ' + outFile);
}

main().catch(function(e) { console.error(e); process.exit(1); });
