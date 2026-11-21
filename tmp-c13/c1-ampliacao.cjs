const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const CDP = require('chrome-remote-interface');

const REPO = process.cwd();
const URL_BASE = 'http://127.0.0.1:8000';
const URL_PAGE = URL_BASE + '/index.html';
const OUT = 'tmp-c13/c1-ampliacao.json';

const PROPS = [
  'display', 'grid-template-columns', 'gap', 'padding', 'background-color',
  'color', 'position', 'width', 'border-radius', 'font-family', 'font-size',
];

function gitStatus(scope) {
  return execFileSync('git', ['status', '--short', ...scope], { cwd: REPO, encoding: 'utf8' }).trim();
}

async function evaluate(client, expression) {
  const r = await client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

function attributesToLabel(desc) {
  const a = {};
  const attrs = desc.node?.attributes || [];
  for (let i = 0; i + 1 < attrs.length; i += 2) a[attrs[i]] = attrs[i + 1];
  const tag = (desc.node?.nodeName || 'node').toLowerCase();
  const id = a.id ? '#' + a.id : '';
  const cls = a.class ? '.' + a.class.trim().split(/\s+/).slice(0, 3).join('.') : '';
  return `${tag}${id}${cls}`;
}

async function mediaConditions(client) {
  return evaluate(client, `(function(){
    var out = [];
    for (var i=0;i<document.styleSheets.length;i++){
      var s = document.styleSheets[i], rules;
      try { rules = s.cssRules; } catch(e) { continue; }
      for (var j=0;j<rules.length;j++){
        var r = rules[j];
        if (r.type === CSSRule.MEDIA_RULE) out.push(r.conditionText);
      }
    }
    return Array.from(new Set(out));
  })()`);
}

async function activeMedia(client) {
  return evaluate(client, `(function(){
    var out = [];
    for (var i=0;i<document.styleSheets.length;i++){
      var s = document.styleSheets[i], rules;
      try { rules = s.cssRules; } catch(e) { continue; }
      for (var j=0;j<rules.length;j++){
        var r = rules[j];
        if (r.type === CSSRule.MEDIA_RULE && matchMedia(r.conditionText).matches) out.push(r.conditionText);
      }
    }
    return Array.from(new Set(out));
  })()`);
}

async function layoutMetrics(client) {
  return evaluate(client, `(function(){
    var grid = document.querySelector('#viewInicio .inicio-grid');
    var nav = document.querySelector('.mobile-bottom-nav');
    var cards = grid ? Array.from(grid.children).slice(0, 8).map(function(e){ var r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; }) : [];
    var xs = Array.from(new Set(cards.map(function(c){ return c.x; })));
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      gridColumns: xs.length,
      gridGap: grid ? getComputedStyle(grid).gap : null,
      navDisplay: nav ? getComputedStyle(nav).display : null,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  })()`);
}

async function tokenValues(client) {
  return evaluate(client, `(function(){
    var cs = getComputedStyle(document.body);
    var names = ['--accent','--accent-rgb','--accent-foreground','--surface-accent','--paper','--ink','--line','--shadow-lg'];
    var out = {};
    names.forEach(function(n){ out[n] = cs.getPropertyValue(n).trim(); });
    return out;
  })()`);
}

(async () => {
  const out = {
    task: 'C.1 ampliada — todas as views, breakpoints e temas',
    startedAt: new Date().toISOString(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: REPO, encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
    views: [],
    breakpoints: [],
    themes: [],
    blockedExternal: [],
    consoleErrors: [],
    exceptions: [],
  };

  let client;
  try {
    client = await CDP({ port: 9222 });
    const { Browser, Page, Runtime, Network, Fetch, DOM, CSS, Emulation, ServiceWorker } = client;
    await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), DOM.enable(), CSS.enable()]);
    try { await ServiceWorker.disable(); } catch (e) {}
    await Network.setCacheDisabled({ cacheDisabled: true });
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

    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
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
    await evaluate(client, `(function(){ if (typeof window.switchTab === 'function') window.switchTab('inicio'); return true; })()`);
    await new Promise(r => setTimeout(r, 600));

    const { root } = await DOM.getDocument({ depth: -1 });
    const viewNodes = await DOM.querySelectorAll({ nodeId: root.nodeId, selector: '[id^="view"]' });
    out.viewCount = viewNodes.nodeIds.length;

    for (const viewNodeId of viewNodes.nodeIds) {
      const d = await DOM.describeNode({ nodeId: viewNodeId, depth: 0 });
      const label = attributesToLabel(d);
      const children = await DOM.querySelectorAll({ nodeId: viewNodeId, selector: '[id], [class]' });
      const nodes = [];
      for (const childId of children.nodeIds.slice(0, 8)) {
        const cd = await DOM.describeNode({ nodeId: childId, depth: 0 });
        let matched = [];
        try {
          const m = await CSS.getMatchedStylesForNode({ nodeId: childId });
          matched = (m.matchedCSSRules || []).slice(0, 8).map(e => ({
            selector: e.rule?.selectorList?.text || null,
            media: (e.rule?.media || []).map(x => x.text || x.conditionText || '').filter(Boolean),
          }));
        } catch (e) {
          matched = [{ error: String(e.message || e).slice(0, 120) }];
        }
        let computed = {};
        try {
          const c = await CSS.getComputedStyleForNode({ nodeId: childId });
          for (const p of PROPS) {
            const hit = (c.computedStyle || []).find(x => x.name === p);
            if (hit) computed[p] = hit.value;
          }
        } catch (e) {
          computed = { error: String(e.message || e).slice(0, 120) };
        }
        nodes.push({ label: attributesToLabel(cd), matchedCount: matched.length, matched, computed });
      }
      out.views.push({ label, nodeId: viewNodeId, nodes });
    }

    const allConditions = await mediaConditions(client);
    out.allMediaConditions = allConditions;
    const widths = new Set([320, 390, 680, 1024, 1280, 1440]);
    for (const c of allConditions) {
      const m = String(c).match(/(min|max)-width:\s*(\d+)px/);
      if (m) {
        const p = Number(m[2]);
        [p - 1, p, p + 1].forEach(w => { if (w >= 280 && w <= 1600) widths.add(w); });
      }
    }
    out.sweepWidths = Array.from(widths).sort((a, b) => a - b);
    const everActive = new Set();
    for (const w of out.sweepWidths) {
      await Emulation.setDeviceMetricsOverride({ width: w, height: 844, deviceScaleFactor: 1, mobile: w < 681 });
      await new Promise(r => setTimeout(r, 120));
      const active = await activeMedia(client);
      active.forEach(a => everActive.add(a));
      const metrics = await layoutMetrics(client);
      out.breakpoints.push({ width: w, activeConditions: active, activeCount: active.length, metrics });
    }
    out.widthConditions = allConditions.filter(c => /(min|max)-width/.test(c));
    out.widthConditionsCovered = out.widthConditions.filter(c => everActive.has(c));
    out.widthConditionsNeverActive = out.widthConditions.filter(c => !everActive.has(c));
    out.overflowFailures = out.breakpoints.filter(b => b.metrics.overflowX).map(b => b.width);

    await Emulation.setDeviceMetricsOverride({ width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 200));
    for (const mode of ['light', 'dark']) {
      for (let v = 1; v <= 5; v++) {
        await evaluate(client, `(function(){
          document.body.classList.remove('dark-mode');
          document.body.removeAttribute('data-dark-theme');
          document.body.removeAttribute('data-light-theme');
          if ('${mode}' === 'dark') { document.body.classList.add('dark-mode'); document.body.setAttribute('data-dark-theme','${v}'); }
          else { document.body.setAttribute('data-light-theme','${v}'); }
          return true;
        })()`);
        await new Promise(r => setTimeout(r, 250));
        out.themes.push({ mode, variant: v, tokens: await tokenValues(client) });
      }
    }
    await evaluate(client, `(function(){ document.body.classList.remove('dark-mode'); document.body.removeAttribute('data-dark-theme'); document.body.setAttribute('data-light-theme','2'); return true; })()`);

    out.cssWorkingTree = gitStatus(['style', 'index.html', 'js', 'worker']);
    const allNodes = out.views.reduce((acc, v) => acc.concat(v.nodes), []);
    const coveredViews = out.views.filter(v => v.nodes.some(n => n.matchedCount > 0)).length;
    const definedTokens = out.themes.every(t => Object.values(t.tokens).every(v => v && v.length > 0));
    const distinctThemes = new Set(out.themes.map(t => JSON.stringify(t.tokens))).size;
    out.status = {
      domReady: out.domReady,
      viewsTotal: out.viewCount,
      viewsWithMatchedRules: coveredViews,
      nodeSamples: allNodes.length,
      nodesWithRules: allNodes.filter(n => n.matchedCount > 0).length,
      breakpointsSweep: out.sweepWidths.length,
      widthConditionsTotal: out.widthConditions.length,
      widthConditionsCovered: out.widthConditionsCovered.length,
      widthConditionsNeverActive: out.widthConditionsNeverActive.length,
      overflowFailures: out.overflowFailures.length,
      themesTested: out.themes.length,
      distinctThemeTokenSets: distinctThemes,
      allThemeTokensDefined: definedTokens,
      cssWorkingTreeClean: out.cssWorkingTree === '',
      consoleErrors: out.consoleErrors.length,
      exceptions: out.exceptions.length,
    };
    out.veredito = (
      out.domReady && coveredViews === out.viewCount && allNodes.length > 0 &&
      allNodes.every(n => n.matchedCount > 0) && out.widthConditionsCovered.length === out.widthConditions.length &&
      out.overflowFailures.length === 0 && out.themes.length === 10 && definedTokens && out.cssWorkingTree === '' &&
      out.consoleErrors.length === 0 && out.exceptions.length === 0
    ) ? 'PASS' : 'PARTIAL';
  } catch (e) {
    out.veredito = 'BLOCKED';
    out.error = String(e.stack || e.message || e).slice(0, 2000);
  } finally {
    if (client) { try { await client.close(); } catch (e) {} }
  }

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(REPO, OUT), JSON.stringify(out, null, 2) + '\n');
  console.log(`C.1 ampliada: ${out.veredito}`);
  console.log(`views ${out.status?.viewsWithMatchedRules}/${out.status?.viewsTotal}; nos ${out.status?.nodesWithRules}/${out.status?.nodeSamples}`);
  console.log(`breakpoints ${out.status?.widthConditionsCovered}/${out.status?.widthConditionsTotal}; overflow ${out.status?.overflowFailures}`);
  console.log(`temas ${out.status?.themesTested}; distintos ${out.status?.distinctThemeTokenSets}; CSS limpo ${out.status?.cssWorkingTreeClean}`);
  console.log(`evidencia: ${OUT}`);
})();
