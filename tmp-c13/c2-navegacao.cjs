const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CDP = require('chrome-remote-interface');

const REPO = process.cwd();
const URL_BASE = 'http://127.0.0.1:8000';
const URL_PAGE = URL_BASE + '/index.html';
const OUT = 'tmp-c13/c2-navegacao.json';

const BOTTOM = ['inicio', 'pockets', 'caixa', 'invest', 'profile'];
const DRAWER = ['inicio', 'overview', 'dash', 'cards', 'bills', 'receivables', 'pockets', 'goals', 'investments', 'profile', 'lab', 'novoLog'];
const EXPECTED_VIEW = {
  inicio: 'viewInicio', overview: 'viewCaixa', dash: 'viewDash', cards: 'viewCards',
  bills: 'viewBills', receivables: 'viewReceivables', pockets: 'viewPockets',
  goals: 'viewGoals', investments: 'viewInvest', profile: 'viewProfile',
  lab: null, novoLog: null, caixa: 'viewCaixa', invest: 'viewInvest',
};
const EXPECTED_PANEL = { lab: 'panelFeatureProfile', novoLog: 'panelLOG' };

async function evaluate(client, expression) {
  const r = await client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

function snapshotExpr() {
  return `(function(){
    var nav = document.querySelector('.mobile-bottom-nav');
    var overlay = document.getElementById('appDrawerOverlay');
    var activeViews = Array.from(document.querySelectorAll('.tab-content.active')).map(function(e){ return e.id; });
    var activeButtons = nav ? Array.from(nav.querySelectorAll('button.is-active')).map(function(b){ return b.dataset.destination; }) : [];
    var fab = document.getElementById('fabAdd');
    return {
      bodyTab: document.body.dataset.tab || null,
      activeViews: activeViews,
      navActive: nav ? (nav.dataset.active || null) : null,
      indicator: nav ? nav.style.getPropertyValue('--nav-indicator-x') : null,
      activeBottomButtons: activeButtons,
      lastTab: (function(){ try { return sessionStorage.getItem('livrocaixa_last_tab'); } catch(e) { return null; } })(),
      scrollY: Math.round(window.scrollY),
      drawerOpen: overlay ? overlay.classList.contains('open') : null,
      openPanels: Array.from(document.querySelectorAll('.panel.open')).map(function(e){ return e.id; }).slice(0,5),
      fabLabel: fab ? (fab.getAttribute('aria-label') || null) : null,
    };
  })()`;
}

async function snapshot(client) {
  return evaluate(client, snapshotExpr());
}

async function click(client, selector) {
  return evaluate(client, `(function(){ var el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`);
}

function check(name, condition, detail) {
  return { name, status: condition ? 'PASS' : 'FAIL', detail };
}

(async () => {
  const out = {
    task: 'C.2 — auditoria de navegação',
    startedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: REPO, encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
    bottomNav: [],
    drawer: [],
    persistence: [],
    desktop: [],
    blockedExternal: [],
    consoleErrors: [],
    exceptions: [],
  };

  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Browser, Page, Runtime, Network, Fetch, Emulation, ServiceWorker } = client;
    await Promise.all([Runtime.enable(), Page.enable(), Network.enable()]);
    try { await ServiceWorker.disable(); } catch (e) {}
    await Network.setCacheDisabled({ cacheDisabled: true });
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    Fetch.requestPaused(async ({ requestId, request }) => {
      const local = request.url.startsWith(URL_BASE) || request.url.startsWith('data:') || request.url.startsWith('about:');
      if (!local && out.blockedExternal.length < 30) out.blockedExternal.push(request.url.slice(0, 150));
      try {
        if (local) await Fetch.continueRequest({ requestId });
        else await Fetch.failRequest({ requestId, errorReason: 'Failed' });
      } catch (e) {}
    });
    Runtime.consoleAPICalled((p) => {
      if (p.type === 'error' && out.consoleErrors.length < 20) {
        out.consoleErrors.push((p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 250));
      }
    });
    Runtime.exceptionThrown((p) => {
      if (out.exceptions.length < 20) {
        out.exceptions.push(String(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 250));
      }
    });

    await Page.addScriptToEvaluateOnNewDocument({ source: `
      (function(){
        function noop(){ return { catch(){return this;}, then(){return this;} }; }
        var stubAuth = {
          onAuthStateChanged: function(cb){ setTimeout(function(){ try{ cb(null); }catch(e){} }, 150); return function(){}; },
          currentUser: null,
          signInWithPopup: function(){ return Promise.reject(new Error('stub')); },
          signOut: function(){ return Promise.resolve(); }
        };
        stubAuth.GoogleAuthProvider = function(){ this.addScope = function(){ return this; }; };
        var db = { doc: function(){ return {
          get: function(){ return Promise.resolve({ exists:false, data:function(){return {};} }); },
          set: function(){ return Promise.resolve(); },
          onSnapshot: function(){ return function(){}; }
        }; } };
        var firestoreStub = { enablePersistence: function(){ return { catch: noop }; }, collection: function(){ return db; } };
        window.firebase = { initializeApp: function(){}, auth: function(){ return stubAuth; }, firestore: function(){ return firestoreStub; }, apps: [] };
      })();
    ` });

    await Emulation.setDeviceMetricsOverride({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await Page.navigate({ url: URL_PAGE });
    await Page.loadEventFired();
    let ready = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 300));
      try { ready = await evaluate(client, `!!document.querySelector('.mobile-bottom-nav button[data-destination]')`); } catch (e) {}
      if (ready) break;
    }
    out.browser = await Browser.getVersion();
    out.domReady = ready;
    await evaluate(client, `(function(){ try { sessionStorage.removeItem('livrocaixa_last_tab'); } catch(e){} return true; })()`);
    await evaluate(client, `(function(){ if (typeof window.switchTab === 'function') window.switchTab('caixa'); return true; })()`);
    await new Promise(r => setTimeout(r, 400));

    for (const dest of BOTTOM) {
      const clicked = await click(client, `.mobile-bottom-nav button[data-destination="${dest}"]`);
      await new Promise(r => setTimeout(r, 350));
      const state = await snapshot(client);
      const expected = 'view' + dest.charAt(0).toUpperCase() + dest.slice(1);
      out.bottomNav.push({
        destination: dest, clicked, expectedView: expected, state,
        check: check(`bottom:${dest}`, clicked && state.activeViews.length === 1 && state.activeViews[0] === expected && state.lastTab === dest,
          `view=${state.activeViews.join(',')} last=${state.lastTab} nav=${state.navActive} indicator=${state.indicator}`),
      });
    }

    for (const action of DRAWER) {
      const opened = await click(client, '#btnOpenDrawer');
      await new Promise(r => setTimeout(r, 200));
      const beforeClick = await snapshot(client);
      const clicked = await click(client, `[data-drawer-action="${action}"]`);
      await new Promise(r => setTimeout(r, 400));
      const state = await snapshot(client);
      const expected = EXPECTED_VIEW[action];
      const expectedPanel = EXPECTED_PANEL[action];
      const viewOk = expected
        ? (state.activeViews.length === 1 && state.activeViews[0] === expected)
        : (JSON.stringify(state.activeViews) === JSON.stringify(beforeClick.activeViews) && state.openPanels.includes(expectedPanel));
      out.drawer.push({
        action, opened, drawerOpenBeforeClick: beforeClick.drawerOpen, clicked, expectedView: expected, expectedPanel: expectedPanel || null, beforeClick, state,
        check: check(`drawer:${action}`, opened && clicked && viewOk && state.drawerOpen === false,
          `view=${state.activeViews.join(',')} last=${state.lastTab} drawer=${state.drawerOpen} panels=${state.openPanels.join(',')}`),
      });
    }

    for (const dest of ['inicio', 'pockets']) {
      await evaluate(client, `(function(){ if (typeof window.switchTab === 'function') window.switchTab('${dest}'); return true; })()`);
      await new Promise(r => setTimeout(r, 250));
      const before = await snapshot(client);
      await Page.reload({ ignoreCache: true });
      await Page.loadEventFired();
      await new Promise(r => setTimeout(r, 1200));
      const after = await snapshot(client);
      out.persistence.push({
        destination: dest, before, after,
        check: check(`persist:${dest}`, before.lastTab === dest && after.lastTab === dest && after.activeViews[0] === 'view' + dest.charAt(0).toUpperCase() + dest.slice(1),
          `antes=${before.lastTab}/${before.activeViews.join(',')} depois=${after.lastTab}/${after.activeViews.join(',')}`),
      });
    }

    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 400));
    for (const action of ['inicio', 'overview', 'dash', 'cards', 'goals', 'investments', 'profile']) {
      const opened = await click(client, '#btnOpenDrawer');
      await new Promise(r => setTimeout(r, 180));
      const clicked = await click(client, `[data-drawer-action="${action}"]`);
      await new Promise(r => setTimeout(r, 350));
      const state = await snapshot(client);
      const expected = EXPECTED_VIEW[action];
      out.desktop.push({
        action, opened, clicked, expectedView: expected, state,
        check: check(`desktop:${action}`, opened && clicked && state.activeViews.length === 1 && state.activeViews[0] === expected && state.drawerOpen === false,
          `view=${state.activeViews.join(',')} drawer=${state.drawerOpen} nav=${state.navActive}`),
      });
    }

    out.dispatcherChain = await evaluate(client, `(function(){
      return {
        hasOriginal: typeof window.switchTabOriginal === 'function',
        hasSwitch: typeof window.switchTab === 'function',
        hasPersist: typeof window.persistLastTab === 'function',
        source: String(window.switchTab || '').slice(0, 500),
      };
    })()`);
    out.veredito = [].concat(
      out.bottomNav.map(x => x.check), out.drawer.map(x => x.check),
      out.persistence.map(x => x.check), out.desktop.map(x => x.check)
    ).every(c => c.status === 'PASS') ? 'PASS' : 'PARTIAL';
  } catch (e) {
    out.veredito = 'BLOCKED';
    out.error = String(e.stack || e.message || e).slice(0, 2000);
  } finally {
    if (client) { try { await client.close(); } catch (e) {} }
  }

  out.finishedAt = new Date().toISOString();
  out.summary = {
    bottomChecks: out.bottomNav.filter(x => x.check.status === 'PASS').length + '/' + out.bottomNav.length,
    drawerChecks: out.drawer.filter(x => x.check.status === 'PASS').length + '/' + out.drawer.length,
    persistenceChecks: out.persistence.filter(x => x.check.status === 'PASS').length + '/' + out.persistence.length,
    desktopChecks: out.desktop.filter(x => x.check.status === 'PASS').length + '/' + out.desktop.length,
    consoleErrors: out.consoleErrors.length,
    exceptions: out.exceptions.length,
  };
  fs.writeFileSync(path.join(REPO, OUT), JSON.stringify(out, null, 2) + '\n');
  console.log(`C.2 runtime: ${out.veredito}`);
  console.log(`bottom ${out.summary.bottomChecks}; drawer ${out.summary.drawerChecks}; persist ${out.summary.persistenceChecks}; desktop ${out.summary.desktopChecks}`);
  console.log(`console errors ${out.summary.consoleErrors}; exceptions ${out.summary.exceptions}`);
  console.log(`evidencia: ${OUT}`);
})();
