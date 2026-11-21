const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = process.cwd();
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
const BRANCH = execFileSync('git', ['branch', '--show-current'], { cwd: REPO, encoding: 'utf8' }).trim();
const OUT = path.join(REPO, 'tmp-c13', 'c4-accent-' + HEAD.slice(0, 7));
const FILE = path.join(OUT, 'resultado.json');
const URL_BASE = 'http://127.0.0.1:8000';

const TABS = [
  ['inicio', 'Início'], ['dash', 'Dashboard'], ['dashboard', 'Dashboard alias'],
  ['caixa', 'Lançamentos'], ['invest', 'Investimentos'], ['pockets', 'Caixinhas'],
  ['cards', 'Cartões'], ['bills', 'Contas'], ['receivables', 'A receber'],
  ['goals', 'Metas'], ['profile', 'Perfil'],
];
const PANELS = [
  'panelNovo', 'panelTransferencia', 'panelThemePicker', 'panelCard', 'panelGoalForm', 'panelBill',
  'panelReceivable', 'panelInvest', 'panelPocket', 'panelBanco', 'panelCategoria', 'panelOrcamento',
  'panelLOG', 'panelFiltros', 'panelPurchase', 'panelPocketMovement', 'panelInvestMovement',
  'panelBillLaunch', 'panelPaste', 'panelExportFormat', 'panelCryptoReconcile',
];
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
];
const THEMES = [
  { name: 'oliva-claro', modo: 'claro', id: '1' }, { name: 'verde-claro', modo: 'claro', id: '2' },
  { name: 'lima-claro', modo: 'claro', id: '3' }, { name: 'terracota-claro', modo: 'claro', id: '4' },
  { name: 'laranja-claro', modo: 'claro', id: '5' }, { name: 'oliva-escuro', modo: 'escuro', id: '1' },
  { name: 'verde-escuro', modo: 'escuro', id: '2' }, { name: 'bege-escuro', modo: 'escuro', id: '3' },
  { name: 'terracota-escuro', modo: 'escuro', id: '4' }, { name: 'laranja-escuro', modo: 'escuro', id: '5' },
];
const SCREENS = [].concat(
  TABS.map(t => ({ kind: 'tab', key: t[0], label: t[1], value: t[0] })),
  [{ kind: 'drawer', key: 'drawer', label: 'Drawer', value: null }],
  PANELS.map(p => ({ kind: 'panel', key: p, label: p, value: p }))
);

const themeArg = process.argv.find(a => a.startsWith('--theme='))?.slice(8) || null;
const finalize = process.argv.includes('--finalize');
const selecionados = themeArg ? THEMES.filter(t => t.name === themeArg) : THEMES;

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function vazio() {
  return {
    meta: {
      schemaVersion: 1,
      headSha: HEAD,
      branch: BRANCH,
      startedAt: new Date().toISOString(),
      definition: 'consumo exato de --accent (color/background/border/outline/pseudo/SVG); tokens derivados nao entram na populacao',
      matrix: { viewports: VIEWPORTS.map(v => v.name + ' ' + v.width + 'x' + v.height), themes: THEMES.length, screens: SCREENS.length },
      externalPolicy: 'recursos externos bloqueados via Fetch.requestPaused',
      hash: null,
      hash16: null,
    },
    rows: [],
    skipped: [],
    errors: { console: [], exceptions: [], cdp: [] },
  };
}

async function evalv(client, expression, awaitPromise = false) {
  const r = await client.Runtime.evaluate({ expression, returnByValue: true, awaitPromise, userGesture: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

const COLLECT = `(() => {
  const exact=(a,b)=>{const A=pc(a),B=pc(b);if(!A||!B)return false;return Math.abs(A.r-B.r)<.5&&Math.abs(A.g-B.g)<.5&&Math.abs(A.b-B.b)<.5&&Math.abs(A.a-B.a)<.01;};
  const pc=c=>{if(!c)return null;c=String(c).trim();const l=c.toLowerCase();if(l.startsWith('rgba(')&&l.endsWith(')')){const n=l.slice(5,-1).split(/[ ,/]+/).filter(Boolean).map(Number);if(n.length>=3)return{r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};}if(l.startsWith('rgb(')&&l.endsWith(')')){const n=l.slice(4,-1).split(/[ ,/]+/).filter(Boolean).map(Number);if(n.length>=3)return{r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};}const m=c.match(/^#([0-9a-f]{3,8})$/i);if(m){let h=m[1];if(h.length===3||h.length===4)h=h.split('').map(x=>x+x).join('');if(h.length===6)h+='ff';if(h.length===8)return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:parseInt(h.slice(6,8),16)/255};}if(c==='transparent')return{r:0,g:0,b:0,a:0};return null;};
  const visible=el=>{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  const accentRaw=getComputedStyle(document.body).getPropertyValue('--accent').trim();
  function consumer(el){
    const cs=getComputedStyle(el),pb=getComputedStyle(el,'::before'),pa=getComputedStyle(el,'::after');
    if(exact(cs.color,accentRaw))return{consumed:true,property:'color'};
    if(exact(cs.backgroundColor,accentRaw))return{consumed:true,property:'backgroundColor'};
    if(parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'&&exact(cs.borderTopColor,accentRaw))return{consumed:true,property:'borderTopColor'};
    if(parseFloat(cs.outlineWidth)>0&&cs.outlineStyle!=='none'&&exact(cs.outlineColor,accentRaw))return{consumed:true,property:'outlineColor'};
    if(pb.content&&pb.content!=='none'&&pb.content!=='normal'&&exact(pb.color,accentRaw))return{consumed:true,property:'pseudoBeforeColor'};
    if(pa.content&&pa.content!=='none'&&pa.content!=='normal'&&exact(pa.color,accentRaw))return{consumed:true,property:'pseudoAfterColor'};
    if(pb.content&&pb.content!=='none'&&pb.content!=='normal'&&parseFloat(pb.width)>0&&exact(pb.backgroundColor,accentRaw))return{consumed:true,property:'pseudoBeforeBackground'};
    if(pa.content&&pa.content!=='none'&&pa.content!=='normal'&&parseFloat(pa.width)>0&&exact(pa.backgroundColor,accentRaw))return{consumed:true,property:'pseudoAfterBackground'};
    const fa=el.getAttribute?el.getAttribute('fill'):null,sa=el.getAttribute?el.getAttribute('stroke'):null;
    if(exact(fa,accentRaw))return{consumed:true,property:'svgFillAttr'};
    if(exact(sa,accentRaw))return{consumed:true,property:'svgStrokeAttr'};
    if(exact(cs.fill,accentRaw))return{consumed:true,property:'svgComputedFill'};
    if(exact(cs.stroke,accentRaw))return{consumed:true,property:'svgComputedStroke'};
    if(exact(cs.color,accentRaw)&&(String(cs.fill).includes('currentColor')||String(cs.stroke).includes('currentColor')))return{consumed:true,property:'svgCurrentColor'};
    return{consumed:false,property:null};
  }
  const found=new Set();
  document.querySelectorAll('body *').forEach(el=>{if(!el||el===document.body||el===document.documentElement||!visible(el))return;if(consumer(el).consumed)found.add(el);});
  const rows=[];
  let i=0;
  for(const el of found){
    if(!visible(el))continue;
    const c=consumer(el),cs=getComputedStyle(el);
    const key='c4-'+(++i);
    el.setAttribute('data-c4-audit',key);
    const cls=(typeof el.className==='string'?el.className:'').trim().split(/\\s+/).filter(Boolean).slice(0,4).map(x=>'.'+x).join('');
    rows.push({key,sel:el.id?'#'+el.id:(cls||el.tagName.toLowerCase()),tag:el.tagName.toLowerCase(),id:el.id||'',cls:(typeof el.className==='string'?el.className:''),text:(el.innerText||el.value||'').replace(/\\s+/g,' ').trim().slice(0,120),accentProperty:c.property,color:cs.color,bg:cs.backgroundColor,borderColor:cs.borderTopColor,outlineColor:cs.outlineColor,fill:cs.fill,stroke:cs.stroke,rect:(()=>{const r=el.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};})()});
  }
  return{rows,accentRaw};
})()`;

async function winningRules(client, rootNodeId, key) {
  try {
    const q = await client.DOM.querySelector({ nodeId: rootNodeId, selector: '[data-c4-audit="' + key + '"]' });
    if (!q.nodeId) return { captureStatus: 'node-not-found', candidates: [] };
    const m = await client.CSS.getMatchedStylesForNode({ nodeId: q.nodeId });
    const props = ['color', 'background-color', 'border-top-color', 'outline-color', 'fill', 'stroke'];
    const candidates = [];
    for (const entry of m.matchedCSSRules || []) {
      const rule = entry.rule || {};
      const selector = rule.selectorList?.text || '';
      const media = (rule.media || []).map(x => x.text || x.conditionText || '').filter(Boolean);
      for (let j = 0; j < (rule.style?.cssProperties || []).length; j++) {
        const p = rule.style.cssProperties[j];
        if (!props.includes(p.name)) continue;
        const value = String(p.value || '');
        if (value.includes('accent') || value.includes('var(--')) {
          candidates.push({ selector, media, property: p.name, value, important: !!p.important, origin: rule.origin || null, styleSheetId: rule.styleSheetId || null });
        }
      }
    }
    return { captureStatus: candidates.length ? 'captured' : 'no-matching-declaration', candidates: candidates.slice(0, 8) };
  } catch (e) {
    return { captureStatus: 'cdp-error', detail: String(e.message || e).slice(0, 160), candidates: [] };
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let result = vazio();
  try { const old = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (Array.isArray(old.rows)) result = old; } catch (e) {}
  const jaColetados = new Set(result.rows.map(r => r.sampleId));

  const client = await CDP({ port: 9222 });
  const { Page, Runtime, Network, Fetch, Emulation, DOM, CSS } = client;
  await Promise.all([Runtime.enable(), Page.enable(), Network.enable(), DOM.enable(), CSS.enable()]);
  const sheetMeta = new Map();
  CSS.styleSheetAdded(({ header }) => { if (header.styleSheetId) sheetMeta.set(header.styleSheetId, { sourceURL: header.sourceURL || '', startLine: header.startLine || 0 }); });
  await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  Fetch.requestPaused(async ({ requestId, request }) => {
    const local = request.url.startsWith(URL_BASE) || request.url.startsWith('data:') || request.url.startsWith('about:');
    try { if (local) await Fetch.continueRequest({ requestId }); else await Fetch.failRequest({ requestId, errorReason: 'Failed' }); } catch (e) {}
  });
  Runtime.consoleAPICalled(({ type, args }) => { if (type === 'error' && result.errors.console.length < 30) result.errors.console.push(args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 250)); });
  Runtime.exceptionThrown(({ exceptionDetails }) => { if (result.errors.exceptions.length < 30) result.errors.exceptions.push(String(exceptionDetails.exception?.description || exceptionDetails.text || '').slice(0, 250)); });

  await Page.addScriptToEvaluateOnNewDocument({ source: `
    (function(){
      function noop(){return{catch(){return this;},then(){return this;}};}
      var auth={onAuthStateChanged:function(cb){setTimeout(function(){try{cb(null);}catch(e){}},150);return function(){};},currentUser:null,signInWithPopup:function(){return Promise.reject(new Error('stub'));},signOut:function(){return Promise.resolve();}};
      auth.GoogleAuthProvider=function(){this.addScope=function(){return this;};};
      var db={doc:function(){return{get:function(){return Promise.resolve({exists:false,data:function(){return{};}});},set:function(){return Promise.resolve();},onSnapshot:function(){return function(){};}};}};
      window.firebase={initializeApp:function(){},auth:function(){return auth;},firestore:function(){return{enablePersistence:function(){return{catch:noop};},collection:function(){return db;}};},apps:[]};
    })();
  ` });

  for (const theme of selecionados) {
    for (const vp of VIEWPORTS) {
      await Emulation.setDeviceMetricsOverride({ width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile });
      await Page.navigate({ url: URL_BASE + '/index.html' });
      await Page.loadEventFired();
      for (let i = 0; i < 40; i++) {
        const ok = await evalv(client, `document.readyState==='complete' && typeof applyLightTheme==='function' && !!document.getElementById('viewDash')`).catch(() => false);
        if (ok) break;
        await sleep(250);
      }
      await evalv(client, `(()=>{var s=document.createElement('style');s.id='c4-audit-style';s.textContent='#authOverlay,#syncOverlay,#panelThemePicker{display:none!important}*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';document.head.appendChild(s);return true;})()`);
      for (const screen of SCREENS) {
        const sampleId = [theme.name, vp.name, screen.key].join('|');
        if (jaColetados.has(sampleId)) continue;
        await evalv(client, `(()=>{try{window.closeAllPanels?.();}catch(e){}try{window.closeDrawer?.();}catch(e){}document.getElementById('modalOverlay')?.classList.remove('open');return true;})()`);
        const fn = theme.modo === 'escuro' ? 'applyDarkTheme' : 'applyLightTheme';
        const aplicado = await evalv(client, `(()=>{document.body.classList.${theme.modo === 'escuro' ? 'add' : 'remove'}('dark-mode');if(typeof window.${fn}!=='function')return false;window.${fn}('${theme.id}',false);return true;})()`);
        if (!aplicado) { result.skipped.push({ sampleId, reason: 'applyTheme indisponivel' }); continue; }
        if (screen.kind === 'tab') await evalv(client, `(()=>{try{window.switchTab(${JSON.stringify(screen.value)});return true;}catch(e){return false;}})()`);
        else if (screen.kind === 'drawer') await evalv(client, `(()=>{try{window.openDrawer?.();return true;}catch(e){return false;}})()`);
        else await evalv(client, `(()=>{try{window.openModal?.( ${JSON.stringify(screen.value)} );return true;}catch(e){return false;}})()`);
        await sleep(180);
        const res = await evalv(client, COLLECT);
        const { root } = await client.DOM.getDocument({ depth: -1 });
        for (const row of res.rows) {
          const wr = await winningRules(client, root.nodeId, row.key);
          result.rows.push({
            sampleId,
            viewport: vp.name,
            theme: theme.name,
            modo: theme.modo,
            screen: screen.key,
            screenLabel: screen.label,
            accentRaw: res.accentRaw,
            ...row,
            winningRules: wr,
          });
        }
        if (res.rows.length) jaColetados.add(sampleId);
        await evalv(client, `(()=>{document.querySelectorAll('[data-c4-audit]').forEach(function(e){e.removeAttribute('data-c4-audit');});return true;})()`);
      }
    }
    result.meta.styleSheets = Object.fromEntries(sheetMeta);
    console.log('tema concluido:', theme.name, '| rows acumuladas:', result.rows.length);
    fs.writeFileSync(FILE, JSON.stringify(result, null, 2) + '\n');
  }

  await client.close();
  result.meta.styleSheets = Object.fromEntries(sheetMeta);
  fs.writeFileSync(FILE, JSON.stringify(result, null, 2) + '\n');
  console.log('total rows:', result.rows.length, '| skipped:', result.skipped.length);
}

if (finalize) {
  const r = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  r.meta.finishedAt = new Date().toISOString();
  const sem = JSON.parse(JSON.stringify(r));
  delete sem.meta.hash;
  delete sem.meta.hash16;
  delete sem.verification;
  const h = sha(JSON.stringify(sem, null, 2));
  r.meta.hash = h;
  r.meta.hash16 = h.slice(0, 16);
  fs.writeFileSync(FILE, JSON.stringify(r, null, 2) + '\n');
  const lido = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const lidoSem = JSON.parse(JSON.stringify(lido));
  delete lidoSem.meta.hash;
  delete lidoSem.meta.hash16;
  delete lidoSem.verification;
  const h2 = sha(JSON.stringify(lidoSem, null, 2));
  lido.verification = { hashMatches: h2 === h, recalculated: h2, declared: h, rows: lido.rows.length };
  fs.writeFileSync(FILE, JSON.stringify(lido, null, 2) + '\n');
  console.log('finalizado:', JSON.stringify(lido.verification));
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}
