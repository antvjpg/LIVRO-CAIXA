const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CDP = require('chrome-remote-interface');

const REPO = process.cwd();
const URL_BASE = 'http://127.0.0.1:8000';
const URL_PAGE = URL_BASE + '/index.html';
const OUT_JSON = 'tmp-c13/c1-auditoria-css.json';

const SELECTORS = [
  ['body', 'body'],
  ['app-header', '.app-header'],
  ['bottom-nav', '.mobile-bottom-nav'],
  ['botao-inicio', '.mobile-bottom-nav button[data-destination="inicio"]'],
  ['view-inicio', '#viewInicio'],
  ['inicio-grid', '#viewInicio .inicio-grid'],
  ['card-saude', '#viewInicio .inicio-card.advanced-dashboard-card'],
  ['card-proximo', '#viewInicio .inicio-card.dashboard-next-payment-card'],
  ['resumo-fluxo', '#viewInicio .inicio-footer .cashflow-mini-summary'],
];

const PROPS = [
  'display', 'grid-template-columns', 'gap', 'padding', 'margin',
  'background-color', 'color', 'border-top-width', 'border-radius',
  'font-family', 'font-size', 'box-shadow', 'align-items', 'flex-wrap',
];

async function evaluate(client, expression) {
  const r = await client.Runtime.evaluate({
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

async function collect(client, label) {
  const stylesheetInfo = await evaluate(client, `Array.from(document.styleSheets).map(function(s){
    var n = null; try { n = s.cssRules.length; } catch(e) { n = null; }
    return { href: s.href || null, disabled: !!s.disabled, rules: n };
  })`);

  const mediaInfo = await evaluate(client, `(function(){
    var out = [];
    for (var i=0;i<document.styleSheets.length;i++){
      var s = document.styleSheets[i], rules;
      try { rules = s.cssRules; } catch(e) { continue; }
      for (var j=0;j<rules.length;j++){
        var r = rules[j];
        if (r.type === CSSRule.MEDIA_RULE) out.push({
          condition: r.conditionText,
          nested: r.cssRules.length,
          active: (function(){ try { return matchMedia(r.conditionText).matches; } catch(e) { return null; } })()
        });
      }
    }
    return out;
  })()`);

  const tokens = await evaluate(client, `(function(){
    var cs = getComputedStyle(document.body);
    var names = ['--accent','--accent-rgb','--accent-foreground','--surface-accent','--paper','--ink','--line','--shadow-lg','--radius-md','--z-modal'];
    var out = {};
    names.forEach(function(n){ out[n] = cs.getPropertyValue(n).trim(); });
    return { vars: out, bodyClass: document.body.className || '', lightTheme: document.body.getAttribute('data-light-theme'), darkTheme: document.body.getAttribute('data-dark-theme') };
  })()`);

  const layout = await evaluate(client, `(function(){
    var q = function(s){ return document.querySelector(s); };
    var grid = q('#viewInicio .inicio-grid');
    var nav = q('.mobile-bottom-nav');
    var g = grid ? getComputedStyle(grid) : null;
    var n = nav ? getComputedStyle(nav) : null;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      gridColumns: g ? g.gridTemplateColumns : null,
      gridGap: g ? g.gap : null,
      gridCards: grid ? Array.from(grid.children).slice(0, 6).map(function(e){ var r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }) : [],
      navDisplay: n ? n.display : null,
      destinationButtons: document.querySelectorAll('.mobile-bottom-nav button[data-destination]').length,
      visibleViews: Array.from(document.querySelectorAll('[id^="view"]')).filter(function(e){ return getComputedStyle(e).display !== 'none'; }).map(function(e){ return e.id; }).slice(0,12)
    };
  })()`);

  return {
    label,
    stylesheets: stylesheetInfo,
    mediaQueries: mediaInfo,
    tokens,
    layout,
  };
}

(async () => {
  const startedAt = new Date().toISOString();
  const out = {
    task: 'C.1 — auditoria de carregamento e cobertura CSS',
    startedAt,
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: REPO, encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
    views: [],
    nodes: [],
    blockedExternal: [],
    consoleErrors: [],
    exceptions: [],
    limitations: [
      'Recursos externos bloqueados: fontes e ícones CDN não foram avaliados visualmente.',
      'Amostragem de seletores, não cobertura exaustiva de todas as telas.',
      'Nenhuma regra CSS foi alterada; esta é uma auditoria somente leitura.',
    ],
  };

  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Browser, Page, Runtime, Network, Fetch, DOM, CSS, Emulation, ServiceWorker } = client;

    await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), DOM.enable(), CSS.enable()]);
    try { await ServiceWorker.disable(); } catch (e) {}
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    Fetch.requestPaused(async ({ requestId, request }) => {
      const local = request.url.startsWith(URL_BASE) || request.url.startsWith('data:') || request.url.startsWith('about:');
      if (!local && out.blockedExternal.length < 40) out.blockedExternal.push(request.url.slice(0, 160));
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
          onAuthStateChanged: function(cb){ setTimeout(function(){ try{ cb(null); }catch(e){} }, 0); return function(){}; },
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

    await Network.setCacheDisabled({ cacheDisabled: true });
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
    await evaluate(client, `(function(){ if (typeof window.switchTab === 'function') { window.switchTab('inicio'); } return true; })()`);
    await new Promise(r => setTimeout(r, 700));

    out.views.push(await collect(client, 'mobile-light'));

    await evaluate(client, `(function(){ document.body.classList.add('dark-mode'); document.body.setAttribute('data-dark-theme','2'); return true; })()`);
    await new Promise(r => setTimeout(r, 500));
    out.views.push(await collect(client, 'mobile-dark'));

    await evaluate(client, `(function(){ document.body.classList.remove('dark-mode'); document.body.removeAttribute('data-dark-theme'); return true; })()`);
    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 500));
    out.views.push(await collect(client, 'desktop-light'));

    const { root } = await DOM.getDocument({ depth: -1 });
    for (const [name, selector] of SELECTORS) {
      const found = await DOM.querySelector({ nodeId: root.nodeId, selector });
      if (!found.nodeId) {
        out.nodes.push({ name, selector, found: false });
        continue;
      }
      let matched = [];
      try {
        const m = await CSS.getMatchedStylesForNode({ nodeId: found.nodeId });
        matched = (m.matchedCSSRules || []).slice(0, 14).map((entry) => {
          const rule = entry.rule || {};
          return {
            selector: rule.selectorList?.text || null,
            origin: rule.origin || null,
            media: (rule.media || []).map(x => x.text || x.conditionText || '').filter(Boolean),
            cssText: String(rule.style?.cssText || '').slice(0, 400),
          };
        });
      } catch (e) {
        matched = [{ error: String(e.message || e).slice(0, 160) }];
      }
      let computed = {};
      try {
        const c = await CSS.getComputedStyleForNode({ nodeId: found.nodeId });
        for (const p of PROPS) {
          const hit = (c.computedStyle || []).find(x => x.name === p);
          if (hit) computed[p] = hit.value;
        }
      } catch (e) {
        computed = { error: String(e.message || e).slice(0, 160) };
      }
      out.nodes.push({ name, selector, found: true, matchedCount: matched.length, matched, computed });
    }

    const expectedLocal = [
      './style/themes.css?v=20-23',
      './style/base.css?v=20-24',
      './style/components.css?v=20-33',
      './style/layout.css?v=20-36',
      './style/features.css?v=20-31',
      './style/dashboard-chat.css?v=20-24',
      './vendor/tabler-icons/tabler-icons.css',
    ];
    const runtimeLocal = (out.views[0].stylesheets || [])
      .map(s => s.href || '')
      .filter(h => h.includes('/style/') || h.includes('/vendor/'))
      .map(h => h.replace(URL_BASE + '/', './'));
    out.cssOrder = {
      expected: expectedLocal,
      observed: runtimeLocal,
      match: JSON.stringify(expectedLocal) === JSON.stringify(runtimeLocal),
    };
    out.vereditoColeta = out.domReady && out.nodes.every(n => !n.found || n.matchedCount > 0) ? 'PASS' : 'PARTIAL';
  } catch (e) {
    out.vereditoColeta = 'BLOCKED';
    out.error = String(e.stack || e.message || e).slice(0, 2000);
  } finally {
    if (client) { try { await client.close(); } catch (e) {} }
  }

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(REPO, OUT_JSON), JSON.stringify(out, null, 2) + '\n');
  console.log(`C.1 coleta: ${out.vereditoColeta}`);
  console.log(`views: ${out.views.length}; nos amostrados: ${out.nodes.length}; bloqueados externos: ${out.blockedExternal.length}`);
  console.log(`ordem CSS: ${out.cssOrder?.match ? 'PASS' : 'DIVERGENTE'}`);
  console.log(`evidencia: ${OUT_JSON}`);
})();
