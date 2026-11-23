'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const CDP = require('chrome-remote-interface');

const ROOT = path.resolve(__dirname, '../..');
const OUT = __dirname;
const SHOTS = path.join(OUT, 'screenshots');
const BASE = 'http://127.0.0.1:8000/index.html';
const ORIGIN = 'http://127.0.0.1:8000';
const HEAD = require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const BRANCH = require('child_process').execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const PORT = 9222;

const VIEWPORTS = [
  { name: 'mobile-compacto', width: 320, height: 720, deviceScaleFactor: 2, mobile: true },
  { name: 'mobile', width: 360, height: 800, deviceScaleFactor: 2, mobile: true },
  { name: 'mobile-largo', width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
  { name: 'tablet', width: 768, height: 1024, deviceScaleFactor: 2, mobile: true },
  { name: 'desktop', width: 1280, height: 800, deviceScaleFactor: 1, mobile: false },
];

const THEMES = [
  { name: 'oliva-claro', modo: 'claro', id: '1', accent: '#5f7a43', paper: '#f7f5ef' },
  { name: 'verde-claro', modo: 'claro', id: '2', accent: '#327957', paper: '#f8f7f2' },
  { name: 'lima-claro', modo: 'claro', id: '3', accent: '#40916c', paper: '#faf9f6' },
  { name: 'terracota-claro', modo: 'claro', id: '4', accent: '#c66f50', paper: '#fbf6ef' },
  { name: 'laranja-claro', modo: 'claro', id: '5', accent: '#e85002', paper: '#f9f9f9' },
  { name: 'oliva-escuro', modo: 'escuro', id: '1', accent: '#9dd08b', paper: '#1a1917' },
  { name: 'verde-escuro', modo: 'escuro', id: '2', accent: '#22c55e', paper: '#121212' },
  { name: 'bege-escuro', modo: 'escuro', id: '3', accent: '#c9a86a', paper: '#0f1712' },
  { name: 'terracota-escuro', modo: 'escuro', id: '4', accent: '#d08860', paper: '#141410' },
  { name: 'laranja-escuro', modo: 'escuro', id: '5', accent: '#e85002', paper: '#000000' },
];

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return;
    } catch (_) {}
    await sleep(500);
  }
  throw new Error(`${label} indisponível: ${url}`);
}

async function evalJS(Runtime, expression) {
  const res = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) return `ERR: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`;
  return res.result.value;
}

async function screenshot(client, name, fullPage = false) {
  const params = { format: 'png', fromSurface: true, captureBeyondViewport: fullPage };
  const { data } = await client.Page.captureScreenshot(params);
  const buffer = Buffer.from(data, 'base64');
  const file = path.join(SHOTS, `${name}.png`);
  fs.writeFileSync(file, buffer);
  return { arquivo: path.relative(ROOT, file), bytes: buffer.length, sha256: sha(buffer), fullPage };
}

async function loadApp(client) {
  const { Page, Runtime } = client;
  await Page.navigate({ url: BASE });
  await Promise.race([
    Page.loadEventFired(),
    sleep(15000).then(() => { throw new Error('timeout loadEventFired'); }),
  ]);
  await sleep(3500);
  await evalJS(Runtime, 'document.fonts.ready.then(function(){return 1;})');
  const preAuth = await evalJS(Runtime, `(() => {
    const ov = document.getElementById('authOverlay');
    const sync = document.getElementById('syncOverlay');
    const state = (el) => !el ? 'ausente' : (el.classList.contains('hidden') || el.hasAttribute('hidden') ? 'oculto' : 'visivel');
    return {
      authOverlay: state(ov),
      syncOverlay: state(sync),
      overlayText: document.getElementById('authOverlayText')?.textContent?.trim() || null,
      userBar: document.getElementById('userBar')?.textContent?.trim() || null,
      url: location.href,
      origin: location.origin,
    };
  })()`);
  await evalJS(Runtime, `(() => {
    ['authOverlay','syncOverlay','appDrawerOverlay','panelThemePicker'].forEach(function(id){
      const el = document.getElementById(id);
      if (el) { el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); }
    });
    return 1;
  })()`);
  const switched = await evalJS(Runtime, `(() => {
    if (typeof window.switchTab === 'function') { window.switchTab('inicio'); return 'switchTab:inicio'; }
    return 'switchTab-indisponivel';
  })()`);
  await sleep(800);
  const active = await evalJS(Runtime, `(() => {
    const ids = [...document.querySelectorAll('.tab-content.active')].map(e => e.id);
    return { activeViews: ids, bodyTab: document.body.dataset.tab || null };
  })()`);
  return { preAuth, switched, active };
}

async function applyTheme(Runtime, theme) {
  return evalJS(Runtime, `(() => {
    var escuro = ${JSON.stringify(theme.modo)} === 'escuro';
    if (escuro) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
    var fn = escuro ? 'applyDarkTheme' : 'applyLightTheme';
    if (typeof window[fn] !== 'function') return { erro: fn + '-ausente' };
    window[fn](${JSON.stringify(theme.id)}, false);
    var cs = getComputedStyle(document.body);
    return {
      datasetLight: document.body.dataset.lightTheme || '',
      datasetDark: document.body.dataset.darkTheme || '',
      isDark: document.body.classList.contains('dark-mode'),
      accent: (cs.getPropertyValue('--accent') || '').trim().toLowerCase(),
      paper: (cs.getPropertyValue('--paper') || '').trim().toLowerCase(),
    };
  })()`);
}

async function initialTheme(Runtime) {
  return evalJS(Runtime, `(() => {
    var cs = getComputedStyle(document.body);
    return {
      light: document.body.dataset.lightTheme || '',
      dark: document.body.dataset.darkTheme || '',
      isDark: document.body.classList.contains('dark-mode'),
      accent: (cs.getPropertyValue('--accent') || '').trim(),
      paper: (cs.getPropertyValue('--paper') || '').trim(),
    };
  })()`);
}

async function restoreTheme(Runtime, original) {
  return evalJS(Runtime, `(() => {
    var o = ${JSON.stringify(original)};
    if (o.isDark) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode');
    if (o.light && typeof window.applyLightTheme === 'function') window.applyLightTheme(o.light, false);
    if (o.dark && typeof window.applyDarkTheme === 'function') window.applyDarkTheme(o.dark, false);
    return 1;
  })()`);
}

function contrastText(js) {
  return js;
}

async function measureLayout(Runtime) {
  const expression = `(() => {
    function rgb(s) {
      var m = String(s || '').match(/rgba?\\(([^)]+)\\)/);
      if (!m) return null;
      var p = m[1].split(/[,\\s/]+/).filter(Boolean).map(Number);
      return p.length >= 3 ? p.slice(0,3) : null;
    }
    function lum(c) {
      if (!c) return null;
      var v = c.map(function(x){ x/=255; return x <= 0.03928 ? x/12.92 : Math.pow((x+0.055)/1.055,2.4); });
      return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
    }
    function ratio(a,b) {
      var la=lum(rgb(a)), lb=lum(rgb(b));
      if (la===null||lb===null) return null;
      return Math.round(((Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05))*100)/100;
    }
    function rect(el) {
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
    }
    function visible(el) {
      var cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity || 1) > 0;
    }
    var de = document.documentElement;
    var vw = window.innerWidth;
    var overflow = {
      documentWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      horizontal: de.scrollWidth > de.clientWidth + 1,
      overflowPx: Math.max(0, de.scrollWidth - de.clientWidth),
    };
    var cortados = [];
    var candidatos = document.querySelectorAll('#viewInicio *, header *, #balanceStrip *');
    for (var i=0;i<candidatos.length && cortados.length<20;i++) {
      var el = candidatos[i];
      if (!visible(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        cortados.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          cls: (el.className && String(el.className).slice(0,120)) || null,
          rect: rect(el),
          texto: (el.textContent || '').trim().slice(0,80),
        });
      }
    }
    var cards = [...document.querySelectorAll('#viewInicio .inicio-card')].map(function(el){
      var cs = getComputedStyle(el);
      return {
        cls: String(el.className),
        rect: rect(el),
        background: cs.backgroundColor,
        color: cs.color,
        padding: cs.padding,
        gap: cs.gap,
        borderRadius: cs.borderRadius,
        boxShadow: cs.boxShadow,
        fontSize: cs.fontSize,
      };
    });
    var overlaps = [];
    for (var a=0;a<cards.length;a++) for (var b=a+1;b<cards.length;b++) {
      var r1=cards[a].rect, r2=cards[b].rect;
      if (!r1||!r2) continue;
      var ow = Math.max(0, Math.min(r1.right,r2.right)-Math.max(r1.x,r2.x));
      var oh = Math.max(0, Math.min(r1.bottom,r2.bottom)-Math.max(r1.y,r2.y));
      if (ow>1 && oh>1) overlaps.push({ a:a, b:b, width:ow, height:oh });
    }
    var header = document.querySelector('header.app-header');
    var strip = document.getElementById('balanceStrip');
    var view = document.getElementById('viewInicio');
    var grid = document.querySelector('#viewInicio .inicio-grid');
    var amount = document.querySelector('#viewInicio .balance-card .amount');
    var label = document.querySelector('#viewInicio .balance-card .label');
    var hint = document.querySelector('#viewInicio .hint');
    var canvas = document.getElementById('patrimonySparklineInicio');
    var hcs = header ? getComputedStyle(header) : null;
    var scs = strip ? getComputedStyle(strip) : null;
    var vcs = view ? getComputedStyle(view) : null;
    var gcs = grid ? getComputedStyle(grid) : null;
    var acs = amount ? getComputedStyle(amount) : null;
    var lcs = label ? getComputedStyle(label) : null;
    var canvasRect = rect(canvas);
    return {
      viewport: { width: vw, height: window.innerHeight, dpr: window.devicePixelRatio },
      overflow: overflow,
      cortados: cortados,
      cards: cards,
      cardOverlaps: overlaps,
      header: {
        presente: !!header,
        rect: rect(header),
        position: hcs?.position || null,
        display: hcs?.display || null,
        zIndex: hcs?.zIndex || null,
        background: hcs?.backgroundColor || null,
        height: hcs?.height || null,
      },
      balanceStrip: {
        presente: !!strip,
        visivel: strip ? visible(strip) : false,
        ocultoPorClasse: strip ? strip.classList.contains('section-hidden') : null,
        rect: rect(strip),
        display: scs?.display || null,
        gridTemplateColumns: scs?.gridTemplateColumns || null,
        gap: scs?.gap || null,
        padding: scs?.padding || null,
        texto: (strip?.textContent || '').replace(/\\s+/g,' ').trim().slice(0,300),
      },
      viewInicio: {
        presente: !!view,
        ativa: view ? view.classList.contains('active') : false,
        rect: rect(view),
        display: vcs?.display || null,
        gridGap: gcs?.gap || null,
        gridColumns: gcs?.gridTemplateColumns || null,
      },
      legibilidade: {
        amount: {
          texto: (amount?.textContent || '').trim(),
          fontSize: acs?.fontSize || null,
          fontWeight: acs?.fontWeight || null,
          color: acs?.color || null,
          backgroundCard: getComputedStyle(amount?.closest('.inicio-card') || document.body).backgroundColor,
        },
        label: { fontSize: lcs?.fontSize || null, color: lcs?.color || null, texto: (label?.textContent||'').trim() },
        hint: { fontSize: hint ? getComputedStyle(hint).fontSize : null, color: hint ? getComputedStyle(hint).color : null, texto: (hint?.textContent||'').trim() },
        contrasteAmountVsCard: ratio(acs?.color, getComputedStyle(amount?.closest('.inicio-card') || document.body).backgroundColor),
      },
      canvas: {
        presente: !!canvas,
        attrWidth: canvas ? canvas.width : null,
        attrHeight: canvas ? canvas.height : null,
        rect: canvasRect,
        ariaLabel: canvas?.getAttribute('aria-label') || null,
      },
    };
  })()`;
  return evalJS(Runtime, expression);
}

async function nodeListeners(client, selector) {
  try {
    await client.DOM.enable();
    const { root } = await client.DOM.getDocument({ depth: 1 });
    const { nodeId } = await client.DOM.querySelector({ nodeId: root.nodeId, selector });
    if (!nodeId) return { encontrado: false, listeners: [] };
    const { object } = await client.DOM.resolveNode({ nodeId });
    const res = await client.DOMDebugger.getEventListeners({ objectId: object.objectId });
    return {
      encontrado: true,
      listeners: (res.listeners || []).map((item) => ({ type: item.type, useCapture: item.useCapture, passive: item.passive, once: item.once })),
    };
  } catch (e) {
    return { encontrado: null, erro: e.message };
  }
}

async function openDialogSnapshot(Runtime) {
  return evalJS(Runtime, `(() => {
    var els = [...document.querySelectorAll('.modal.open, .panel.open, [role="dialog"].open, .modal.show, .panel.show, [data-open="true"]')];
    return els.map(function(el){
      var cs = getComputedStyle(el);
      return {
        id: el.id || null,
        cls: String(el.className).slice(0,160),
        role: el.getAttribute('role'),
        ariaHidden: el.getAttribute('aria-hidden'),
        display: cs.display,
        visibility: cs.visibility,
        rect: (function(){ var r=el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}; })(),
      };
    }).filter(function(x){ return x.display !== 'none' && x.visibility !== 'hidden'; });
  })()`);
}

async function closeDialog(Runtime, Input) {
  const before = await evalJS(Runtime, `(() => ({ active: document.activeElement?.id || document.activeElement?.className || null }))()`);
  await Input.dispatchKeyEvent({ type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await Input.dispatchKeyEvent({ type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await sleep(400);
  let open = await openDialogSnapshot(Runtime);
  if (open.length) {
    await evalJS(Runtime, `(() => {
      var btn = document.querySelector('.modal.open .modal-close, .panel.open .panel-close, [data-close-modal], [data-close]');
      if (btn) { btn.click(); return 'close-clicked'; }
      return 'sem-botao-fecho';
    })()`);
    await sleep(400);
    open = await openDialogSnapshot(Runtime);
  }
  return { before, openAfter: open };
}

async function focusState(Runtime, selector) {
  return evalJS(Runtime, `(() => {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { encontrado:false };
    el.focus();
    var cs = getComputedStyle(el);
    return {
      encontrado: true,
      focused: document.activeElement === el,
      tabIndex: el.tabIndex,
      outline: cs.outline,
      outlineColor: cs.outlineColor,
      boxShadow: cs.boxShadow,
      ariaExpanded: el.getAttribute('aria-expanded'),
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
    };
  })()`);
}

async function tabOrder(Runtime) {
  return evalJS(Runtime, `(() => {
    var root = document.getElementById('viewInicio');
    if (!root) return [];
    var els = [...root.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(function(el){
      var cs=getComputedStyle(el); return cs.display!=='none' && cs.visibility!=='hidden' && el.tabIndex>=0;
    });
    return els.map(function(el,i){ return { i:i, tag:el.tagName.toLowerCase(), id:el.id||null, cls:String(el.className).slice(0,100), tabIndex:el.tabIndex, ariaLabel:el.getAttribute('aria-label'), role:el.getAttribute('role') }; });
  })()`);
}

async function chartState(Runtime) {
  return evalJS(Runtime, `(() => {
    var controls = [...document.querySelectorAll('#viewInicio [aria-controls="patrimonySparkBoxInicio"], #balanceStrip [aria-controls="patrimonySparkBoxInicio"]')];
    var box = document.getElementById('patrimonySparkBoxInicio');
    var canvas = document.getElementById('patrimonySparklineInicio');
    var br = box ? box.getBoundingClientRect() : null;
    var cr = canvas ? canvas.getBoundingClientRect() : null;
    return {
      controls: controls.map(function(el){
        var r=el.getBoundingClientRect();
        return {
          contexto: el.closest('#balanceStrip') ? 'balanceStrip' : 'viewInicio',
          tag: el.tagName.toLowerCase(),
          cls: String(el.className),
          ariaExpanded: el.getAttribute('aria-expanded'),
          ariaLabel: el.getAttribute('aria-label'),
          ariaHidden: el.getAttribute('aria-hidden'),
          tabIndex: el.tabIndex,
          rect: {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
        };
      }),
      box: {
        presente: !!box,
        ariaHidden: box?.getAttribute('aria-hidden') || null,
        collapsed: box ? box.classList.contains('is-collapsed') : null,
        display: box ? getComputedStyle(box).display : null,
        rect: br ? {x:Math.round(br.x),y:Math.round(br.y),width:Math.round(br.width),height:Math.round(br.height)} : null,
      },
      canvas: {
        presente: !!canvas,
        attrWidth: canvas?.width || null,
        attrHeight: canvas?.height || null,
        rect: cr ? {x:Math.round(cr.x),y:Math.round(cr.y),width:Math.round(cr.width),height:Math.round(cr.height)} : null,
      },
    };
  })()`);
}

async function clickControl(Runtime, selector) {
  return evalJS(Runtime, `(() => {
    var el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'nao-encontrado';
    el.click();
    return 'clicado';
  })()`);
}

async function keyControl(Input, key, code, vk) {
  await Input.dispatchKeyEvent({ type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await Input.dispatchKeyEvent({ type: 'keyUp', key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
  await sleep(250);
}

async function snapshotHosts(Runtime) {
  return evalJS(Runtime, `(() => {
    function snap(sel) {
      var el=document.querySelector(sel);
      if (!el) return { presente:false };
      return {
        presente:true,
        filhos: el.children.length,
        texto: (el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,400),
        htmlLen: el.innerHTML.length,
        altura: Math.round(el.getBoundingClientRect().height),
      };
    }
    return {
      saude: snap('#viewInicio .advanced-dashboard'),
      fluxo: snap('#viewInicio .cashflow-mini-summary'),
      proximo: snap('#viewInicio .next-pay-inner'),
      patrimonioInicio: snap('#viewInicio .balance-card .amount'),
      patrimonioStrip: snap('#balanceStrip .balance-card.total .amount'),
      canvasInicio: snap('#patrimonySparklineInicio'),
      canvasStrip: snap('#patrimonySparkline'),
    };
  })()`);
}

async function switchTab(Runtime, tab) {
  const result = await evalJS(Runtime, `(() => {
    if (typeof window.switchTab === 'function') { window.switchTab(${JSON.stringify(tab)}); return 'switchTab'; }
    var btn = document.getElementById('tabBtn' + ${JSON.stringify(tab).replace(/"/g,'')}) || document.querySelector('[data-tab=' + ${JSON.stringify(tab)} + ']');
    if (btn) { btn.click(); return 'botao'; }
    return 'sem-mecanismo';
  })()`);
  await sleep(700);
  return result;
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const evidencias = {
    meta: {
      geradoEm: new Date().toISOString(),
      head: HEAD,
      branch: BRANCH,
      base: BASE,
      origin: ORIGIN,
      mecanismo: 'Chromium headless temporário provisionado pelo harness + chrome-remote-interface',
      endpoint: `http://127.0.0.1:${PORT}`,
      sessaoQA: 'indisponível: e2e/.state/qa-session.json ausente; credenciaisCODE_TEST_EMAIL/CODE_TEST_PASSWORD ausentes',
      observacaoAuth: 'overlay de autenticação ocultado em runtime apenas para inspeção visual; não houve login nem escrita em Firestore',
    },
    console: [],
    excecoes: [],
    indicadores: {},
    matriz: [],
    screenshots: [],
  };

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-1-chrome-'));
  const server = spawn('python3', ['-m', 'http.server', '8000', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  let serverErr = '';
  server.stderr.on('data', (chunk) => { serverErr += chunk.toString(); });
  const browser = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let browserErr = '';
  browser.stderr.on('data', (chunk) => { browserErr += chunk.toString(); });

  let client;
  try {
    await waitFor('HTTP', `${ORIGIN}/index.html`);
    await waitFor('CDP', `http://127.0.0.1:${PORT}/json/version`);
    client = await CDP({ port: PORT });
    const { Page, Runtime, Emulation, DOM, DOMDebugger, Log, Input } = client;
    await Promise.all([Page.enable(), Runtime.enable(), DOM.enable(), DOMDebugger.enable?.() || Promise.resolve(), Log.enable()]);
    Runtime.consoleAPICalled((event) => {
      if (event.type === 'error' || event.type === 'warning') {
        evidencias.console.push({ tipo: event.type, texto: (event.args || []).map(a => a.value || a.description).join(' ').slice(0, 500) });
      }
    });
    Runtime.exceptionThrown((event) => {
      evidencias.excecoes.push({ texto: event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || 'exception' });
    });
    Log.entryAdded((event) => {
      const e = event.entry || {};
      if (e.level === 'error' || e.level === 'warning') evidencias.console.push({ tipo: `Log.${e.level}`, texto: String(e.text || '').slice(0, 500), fonte: e.source || null });
    });

    await Emulation.setDeviceMetricsOverride({ width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    const init = await loadApp(client);
    const originalTheme = await initialTheme(Runtime);
    const baselineMetrics = await measureLayout(Runtime);
    const baselineShot = await screenshot(client, 'baseline-inicio-antes-interacao', true);
    evidencias.indicadores.C6_INICIO_01 = { ...init, baseline: baselineMetrics, screenshot: baselineShot };
    evidencias.screenshots.push(baselineShot);

    for (const vp of VIEWPORTS) {
      await Emulation.setDeviceMetricsOverride({ width: vp.width, height: vp.height, deviceScaleFactor: vp.deviceScaleFactor, mobile: vp.mobile });
      await sleep(250);
      for (const theme of THEMES) {
        const applied = await applyTheme(Runtime, theme);
        await sleep(220);
        const metrics = await measureLayout(Runtime);
        const shot = await screenshot(client, `matriz-${vp.name}-${theme.name}`, false);
        evidencias.screenshots.push(shot);
        evidencias.matriz.push({
          viewport: vp.name,
          resolucao: `${vp.width}x${vp.height}`,
          dpr: vp.deviceScaleFactor,
          tema: theme.name,
          modo: theme.modo,
          temaId: theme.id,
          aplicado: applied,
          paletaOk: applied && applied.accent === theme.accent && applied.paper === theme.paper,
          metricas: metrics,
          screenshot: shot.arquivo,
        });
      }
    }
    await restoreTheme(Runtime, originalTheme);

    await Emulation.setDeviceMetricsOverride({ width: 360, height: 800, deviceScaleFactor: 2, mobile: true });
    await sleep(300);

    const localSelector = '#viewInicio .inicio-footer button.primary[title="Adicionar"][aria-label="Adicionar"]';
    const buttonInfo = await evalJS(Runtime, `(() => {
      var els = [...document.querySelectorAll(${JSON.stringify(localSelector)})];
      var fab = document.getElementById('fabAdd');
      function info(el) {
        if (!el) return null;
        var r=el.getBoundingClientRect(), cs=getComputedStyle(el);
        return {
          html: el.outerHTML,
          attrs: [...el.attributes].map(a => a.name + '=' + a.value),
          rect: {x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
          display: cs.display,
          visibility: cs.visibility,
          fontSize: cs.fontSize,
          background: cs.backgroundColor,
        };
      }
      return { quantidade: els.length, local: info(els[0]), fab: info(fab), sameNode: els[0] === fab };
    })()`);
    const listenersLocal = await nodeListeners(client, localSelector);
    const listenersFab = await nodeListeners(client, '#fabAdd');
    const openBefore = await openDialogSnapshot(Runtime);
    const clickLocal = await clickControl(Runtime, localSelector);
    await sleep(600);
    const openAfterLocal = await openDialogSnapshot(Runtime);
    const localShot = await screenshot(client, 'c6-inicio-07-botao-local-click');
    const closeLocal = await closeDialog(Runtime, Input);
    const clickFab = await clickControl(Runtime, '#fabAdd');
    await sleep(600);
    const openAfterFab = await openDialogSnapshot(Runtime);
    const fabShot = await screenshot(client, 'c6-inicio-07-fab-click');
    const closeFab = await closeDialog(Runtime, Input);
    evidencias.indicadores.C6_INICIO_07 = {
      buttonInfo, listenersLocal, listenersFab, openBefore, clickLocal, openAfterLocal, closeLocal, clickFab, openAfterFab, closeFab,
      screenshots: [localShot, fabShot],
    };
    evidencias.screenshots.push(localShot, fabShot);

    const graphInitial = await chartState(Runtime);
    const tabSeq = await tabOrder(Runtime);
    const localControl = '#viewInicio .balance-symbol[aria-controls="patrimonySparkBoxInicio"]';
    const stripControl = '#balanceStrip .balance-card.total .balance-symbol[aria-controls="patrimonySparkBoxInicio"]';
    const focusLocal = await focusState(Runtime, localControl);
    const clickGraph = await clickControl(Runtime, localControl);
    await sleep(400);
    const graphAfterClick = await chartState(Runtime);
    await focusState(Runtime, localControl);
    await keyControl(Input, 'Enter', 'Enter', 13);
    const graphAfterEnter = await chartState(Runtime);
    await focusState(Runtime, localControl);
    await keyControl(Input, ' ', 'Space', 32);
    const graphAfterSpace = await chartState(Runtime);
    const clickStrip = await clickControl(Runtime, stripControl);
    await sleep(300);
    const graphAfterStrip = await chartState(Runtime);
    const beforeNav = await chartState(Runtime);
    await switchTab(Runtime, 'dashboard');
    await switchTab(Runtime, 'inicio');
    const afterNav = await chartState(Runtime);
    const graphShot = await screenshot(client, 'c6-inicio-09-grafico');
    evidencias.indicadores.C6_INICIO_09 = {
      graphInitial, tabSeq, focusLocal, clickGraph, graphAfterClick, graphAfterEnter, graphAfterSpace, clickStrip, graphAfterStrip, beforeNav, afterNav,
      screenshot: graphShot,
    };
    evidencias.screenshots.push(graphShot);

    const hierarchy = await evalJS(Runtime, `(() => {
      function info(sel) {
        var el=document.querySelector(sel);
        if (!el) return { presente:false };
        var r=el.getBoundingClientRect(), cs=getComputedStyle(el);
        return {
          presente:true,
          texto:(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,300),
          rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)},
          fontSize:cs.fontSize, fontWeight:cs.fontWeight, color:cs.color, background:cs.backgroundColor,
          position:cs.position, zIndex:cs.zIndex,
        };
      }
      return {
        header: info('header.app-header'),
        balanceStrip: info('#balanceStrip'),
        cardPatrimonio: info('#viewInicio .balance-card'),
        amountInicio: info('#viewInicio .balance-card .amount'),
        amountStrip: info('#balanceStrip .balance-card.total .amount'),
      };
    })()`);
    const hierarchyShot = await screenshot(client, 'c6-inicio-02-hierarquia-patrimonio');
    evidencias.indicadores.C6_INICIO_02 = { hierarchy, screenshot: hierarchyShot };
    evidencias.screenshots.push(hierarchyShot);

    const hostsBefore = await snapshotHosts(Runtime);
    const listenersBefore = {
      tabInicio: await nodeListeners(client, '[data-tab="inicio"], #tabBtnInicio'),
      tabDashboard: await nodeListeners(client, '#tabBtnDashboard, [data-tab="dashboard"]'),
    };
    await switchTab(Runtime, 'dashboard');
    await switchTab(Runtime, 'inicio');
    const hostsAfter = await snapshotHosts(Runtime);
    const listenersAfter = {
      tabInicio: await nodeListeners(client, '[data-tab="inicio"], #tabBtnInicio'),
      tabDashboard: await nodeListeners(client, '#tabBtnDashboard, [data-tab="dashboard"]'),
    };
    const isolationShot = await screenshot(client, 'c6-inicio-03-isolamento');
    evidencias.indicadores.C6_INICIO_03 = { hostsBefore, hostsAfter, listenersBefore, listenersAfter, screenshot: isolationShot };
    evidencias.screenshots.push(isolationShot);

    const states = await evalJS(Runtime, `(() => {
      function text(sel){ var e=document.querySelector(sel); return e ? (e.textContent||'').replace(/\\s+/g,' ').trim() : null; }
      function overflowing(){
        var out=[];
        document.querySelectorAll('#viewInicio *').forEach(function(el){
          if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) out.push({ tag:el.tagName.toLowerCase(), id:el.id||null, cls:String(el.className).slice(0,100), sw:el.scrollWidth, cw:el.clientWidth, texto:(el.textContent||'').trim().slice(0,80) });
        });
        return out.slice(0,20);
      }
      return {
        carregado: { viewAtiva: document.getElementById('viewInicio')?.classList.contains('active') || false, textos: [...document.querySelectorAll('#viewInicio .label')].map(e=>e.textContent.trim()) },
        vazio: { amountInicio: text('#viewInicio .balance-card .amount'), amountStrip: text('#balanceStrip .balance-card.total .amount'), saude: text('#viewInicio .advanced-dashboard'), fluxo: text('#viewInicio .cashflow-mini-summary'), proximo: text('#viewInicio .next-pay-inner') },
        semProximoPagamento: { texto: text('#viewInicio .next-pay-inner'), vazio: !(text('#viewInicio .next-pay-inner') || '') },
        conteudoLongo: overflowing(),
        valoresMonetarios: [...document.querySelectorAll('#viewInicio .amount, #balanceStrip .amount')].map(function(e){ var cs=getComputedStyle(e); return { texto:e.textContent.trim(), fontSize:cs.fontSize, overflow:e.scrollWidth>e.clientWidth+2 }; }),
        quebrasTexto: [...document.querySelectorAll('#viewInicio .label, #viewInicio .hint, #viewInicio .amount')].filter(function(e){ return e.scrollHeight > e.clientHeight + 2; }).map(function(e){ return { texto:e.textContent.trim(), sh:e.scrollHeight, ch:e.clientHeight }; }),
      };
    })()`);
    evidencias.indicadores.C6_INICIO_04 = { states, screenshot: baselineShot.arquivo };

    const c5c6 = await evalJS(Runtime, `(() => {
      var links=[...document.styleSheets].map(s=>s.href).filter(Boolean);
      function bp(sel){ return { selector: sel, encontrado: !!document.querySelector(sel) }; }
      return { folhas: links, breakpoint360: bp('#viewInicio .inicio-grid'), regra360: '@media (max-width:360px) em features.css (auditoria estática)', controllGraph: bp('#viewInicio [aria-controls="patrimonySparkBoxInicio"]') };
    })()`);
    evidencias.indicadores.C6_INICIO_05 = { graphInitial, focusLocal, tabSeq, c5c6 };
    evidencias.indicadores.C6_INICIO_06 = { c5c6, matrizResumo: evidencias.matriz.map(m => ({ viewport:m.viewport, tema:m.tema, overflow:m.metricas?.overflow?.horizontal, cortados:m.metricas?.cortados?.length || 0, overlaps:m.metricas?.cardOverlaps?.length || 0 })) };
    evidencias.indicadores.C6_INICIO_08 = { buttonInfo, listenersLocal, listenersFab, clickLocal, openAfterLocal, clickFab, openAfterFab };
    evidencias.indicadores.C6_INICIO_01.coberturaE2E = 'helper e2e/helpers/app.cjs não declara aba inicio; smoke não navega para Início (evidência estática C6-INICIO-01)';

    await client.close();
    client = null;
  } catch (e) {
    evidencias.erroExecucao = e && e.stack ? e.stack : String(e);
    evidencias.serverErr = serverErr;
    evidencias.browserErr = browserErr;
    process.exitCode = 1;
  } finally {
    if (client) { try { await client.close(); } catch (_) {} }
    try { browser.kill('SIGTERM'); } catch (_) {}
    try { server.kill('SIGTERM'); } catch (_) {}
    await sleep(500);
    try { browser.kill('SIGKILL'); } catch (_) {}
    try { server.kill('SIGKILL'); } catch (_) {}
    fs.writeFileSync(path.join(OUT, 'evidencias.json'), `${JSON.stringify(evidencias, null, 2)}\n`);
    console.log(`R266 C6.1: screenshots=${evidencias.screenshots.length} matriz=${evidencias.matriz.length} erro=${evidencias.erroExecucao ? 'sim' : 'nao'}`);
  }
}

main();
