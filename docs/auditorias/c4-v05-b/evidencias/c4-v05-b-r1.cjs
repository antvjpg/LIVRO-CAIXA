const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const crypto = require('crypto');
const OUT = '/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1.json';
const LOG = '/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r1.log';
const URL = 'http://127.0.0.1:8000/index.html';

const LIGHT = [
  { id: '1', name: 'Oliva' }, { id: '2', name: 'Verde' }, { id: '3', name: 'Lima' },
  { id: '4', name: 'Terracota' }, { id: '5', name: 'Laranja' }
];
const DARK = [
  { id: '1', name: 'Escuro Oliva' }, { id: '2', name: 'Escuro Verde' }, { id: '3', name: 'Escuro Bege' },
  { id: '4', name: 'Escuro Terracota' }, { id: '5', name: 'Escuro Laranja' }
];
const TABS = [
  ['inicio', 'Início'], ['dash', 'Dashboard'], ['dashboard', 'Dashboard alias'],
  ['caixa', 'Lançamentos'], ['invest', 'Investimentos'], ['pockets', 'Caixinhas'],
  ['cards', 'Cartões'], ['bills', 'Contas'], ['receivables', 'A receber'],
  ['goals', 'Metas'], ['profile', 'Perfil']
];
const PANELS = [
  'panelNovo','panelTransferencia','panelThemePicker','panelCard','panelGoalForm','panelBill',
  'panelReceivable','panelInvest','panelPocket','panelBanco','panelCategoria','panelOrcamento',
  'panelLOG','panelFiltros','panelPurchase','panelPocketMovement','panelInvestMovement',
  'panelBillLaunch','panelPaste','panelExportFormat','panelCryptoReconcile'
];
const KEY_SELECTORS = [
  '.period-eyebrow','.notification-heading .eyebrow','.universal-search-group','.drawer-nav button',
  '.toolbar button','.period-bar button','.ledger-filter-button','.manage-item-value',
  '.balance-detail-link','.mobile-bottom-nav button.is-active','.profile-avatar','.profile-item-icon',
  '.diagnostic-summary-card > button.primary','.feature-profile-kicker','.quick-action-icon',
  '.history-kind','.log-detail-toggle','.bank-share-line','.bill-status.is-carried',
  '.export-preview-bank h4 small','#panelNovo label','#panelTransferencia label',
  '#panelNovo #btnReadReceipt','#panelTransferencia #btnReadTransferReceipt','.dash-filter-range',
  '.dash-section-index','.dash-section-meta','.dash-expand-btn','.dash-kpi-main small',
  '.next-pay-kicker','.invest-total-expand-btn','.credit-card-invoice-total',
  '.credit-card-invoice-reset','.credit-card-invoice-toggle','.institution-summary-metrics span.positive',
  '.goals-v2-kicker','.goal-card-v2-badge','.goal-card-v2-pace','.feature-profile-switch',
  '#block1-circle.circle','.primary','.fab-add','.dash-segmented-pill','.dash-part-mini-bar',
  '.mobile-bottom-nav button','.drawer-nav button span','.panel label','.panel .primary',
  '#btnRunReconciliation','#btnNewReceivable','#btnOpenAvatarGrid'
];

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function hash(s){ return crypto.createHash('sha256').update(s).digest('hex').slice(0,16); }

(async () => {
  const logLines = [];
  const log = (...a) => { const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, CSS, Emulation } = client;
  const consoleErrors = [];
  const exceptions = [];
  let ruleMeta = new Map();

  Runtime.consoleAPICalled(({type,args}) => {
    if (type === 'error') consoleErrors.push(args.map(a=>a.value ?? a.description ?? '').join(' '));
  });
  Runtime.exceptionThrown(({exceptionDetails}) => {
    exceptions.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception');
  });
  await Runtime.enable(); await Page.enable(); await DOM.enable(); await CSS.enable();
  CSS.styleSheetAdded(({header}) => {
    if (header.styleSheetId) ruleMeta.set(header.styleSheetId, { sourceURL: header.sourceURL || '', startLine: header.startLine || 0 });
  });

  async function evalv(expression, awaitPromise = false) {
    const r = await Runtime.evaluate({ expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async function waitReady() {
    for (let i=0;i<60;i++) {
      const ok = await evalv(`document.readyState === 'complete' && typeof applyLightTheme === 'function' && !!document.getElementById('viewDash')`).catch(()=>false);
      if (ok) return;
      await sleep(250);
    }
    throw new Error('app not ready');
  }
  async function navigate() {
    await Page.navigate({url: URL});
    await sleep(500);
    await waitReady();
    await evalv(`(()=>{
      const s=document.createElement('style'); s.id='c4-audit-style';
      s.textContent='#authOverlay,#syncOverlay{display:none!important}*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
      document.head.appendChild(s);
      return true;
    })()`);
    await sleep(200);
  }
  async function setViewport(w,h,mobile) {
    await Emulation.setDeviceMetricsOverride({width:w,height:h,deviceScaleFactor:1,mobile});
    await Emulation.setTouchEmulationEnabled({enabled:!!mobile, maxTouchPoints: mobile?5:0}).catch(()=>{});
    await sleep(250);
  }
  async function resetScreen() {
    await evalv(`(()=>{try{window.closeAllPanels?.();}catch(e){};try{window.closeDrawer?.();}catch(e){};document.getElementById('modalOverlay')?.classList.remove('open');return true;})()`).catch(()=>{});
    await sleep(80);
  }
  async function openTab(tab) {
    await resetScreen();
    const ok = await evalv(`(()=>{try{window.switchTab(${JSON.stringify(tab)});return document.body.dataset.tab||'';}catch(e){return 'ERR:'+e.message}})()`);
    await sleep(180);
    return ok;
  }
  async function openPanel(id) {
    await evalv(`(()=>{try{window.openModal(${JSON.stringify(id)});return !!document.getElementById(${JSON.stringify(id)})?.classList.contains('open');}catch(e){return false;}})()`);
    await sleep(120);
  }
  async function openDrawer() {
    await evalv(`(()=>{try{window.openDrawer?.();return document.getElementById('appDrawerOverlay')?.classList.contains('is-open');}catch(e){return false;}})()`);
    await sleep(120);
  }

  const collectScript = `(() => {
    const exact = (a,b) => {
      const p = c => { if (!c) return null; c=String(c).trim();
        let m=c.match(/^rgba?\\(([^)]+)\\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return [n[0],n[1],n[2],n.length>3?n[3]:1];}
        m=c.match(/^color\\(srgb\\s+([^)]+)\\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return [n[0]*255,n[1]*255,n[2]*255,n.length>3?n[3]:1];}
        m=c.match(/^#([0-9a-f]{3,8})$/i); if(m){let h=m[1];if(h.length===3)h=h.split('').map(x=>x+x).join('');if(h.length===4)h=h.split('').map(x=>x+x).join('');if(h.length===6)h+='ff';if(h.length===8)return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),parseInt(h.slice(6,8),16)/255];}
        if(c==='transparent') return [0,0,0,0]; return null;
      };
      const A=p(a), B=p(b); if(!A||!B) return false;
      return Math.abs(A[0]-B[0])<.5 && Math.abs(A[1]-B[1])<.5 && Math.abs(A[2]-B[2])<.5 && Math.abs(A[3]-B[3])<.01;
    };
    const visible = el => { const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; };
    const directText = el => Array.from(el.childNodes).some(n=>n.nodeType===3 && n.nodeValue.trim());
    const textOf = el => (el.innerText || el.value || '').replace(/\\s+/g,' ').trim();
    const pc = c => { if (!c) return null; c=String(c).trim();
      let m=c.match(/^rgba?\\(([^)]+)\\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};}
      m=c.match(/^color\\(srgb\\s+([^)]+)\\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:n[0]*255,g:n[1]*255,b:n[2]*255,a:n.length>3?n[3]:1};}
      m=c.match(/^#([0-9a-f]{3,8})$/i); if(m){let h=m[1];if(h.length===3||h.length===4)h=h.split('').map(x=>x+x).join('');if(h.length===6)h+='ff';if(h.length===8)return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:parseInt(h.slice(6,8),16)/255};}
      if(c==='transparent')return {r:0,g:0,b:0,a:0}; return null;
    };
    const ccomp = (fg,bg) => { const a=(fg.a??1)+(bg.a??1)*(1-(fg.a??1)); if(a===0)return {r:255,g:255,b:255,a:1}; return {r:(fg.r*(fg.a??1)+bg.r*(bg.a??1)*(1-(fg.a??1)))/a,g:(fg.g*(fg.a??1)+bg.g*(bg.a??1)*(1-(fg.a??1)))/a,b:(fg.b*(fg.a??1)+bg.b*(bg.a??1)*(1-(fg.a??1)))/a,a}; };
    const effBg = (el, startParent=false) => { const chain=[]; for(let n=startParent?el.parentElement:el;n;n=n.parentElement)chain.push(n); chain.reverse(); let bg={r:255,g:255,b:255,a:1}; const uncertain=[]; const gradientColors=[]; for(const n of chain){ const x=getComputedStyle(n); if(x.backgroundImage&&x.backgroundImage!=='none'){ uncertain.push(n.id?'#'+n.id:(n.className||n.tagName)); const re=/rgba?\\([^)]+\\)|color\\(srgb[^)]+\\)/g; (x.backgroundImage.match(re)||[]).forEach(v=>{const q=pc(v);if(q&&q.a>0)gradientColors.push(q)}); } const q=pc(x.backgroundColor); if(q&&q.a>0)bg=ccomp(q,bg); } return {bg,uncertain,gradientColors}; };
    const accentRaw = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const known = new Set();
    const selSet = new Set();
    document.querySelectorAll(${JSON.stringify(KEY_SELECTORS.join(','))}).forEach(el=>{ if(visible(el)) known.add(el); });
    document.querySelectorAll('body *').forEach(el=>{
      if(!el || el===document.body || el===document.documentElement || !visible(el)) return;
      const cs=getComputedStyle(el);
      const pb=getComputedStyle(el,'::before'), pa=getComputedStyle(el,'::after');
      const hit = exact(cs.color,accentRaw) || exact(cs.backgroundColor,accentRaw) ||
        (parseFloat(cs.borderTopWidth)>0 && cs.borderTopStyle!=='none' && exact(cs.borderTopColor,accentRaw)) ||
        (parseFloat(cs.outlineWidth)>0 && cs.outlineStyle!=='none' && exact(cs.outlineColor,accentRaw)) ||
        ((pb.content&&pb.content!=='none'&&pb.content!=='normal') && exact(pb.color,accentRaw)) ||
        ((pa.content&&pa.content!=='none'&&pa.content!=='normal') && exact(pa.color,accentRaw)) ||
        ((pb.content&&pb.content!=='none'&&pb.content!=='normal'&&parseFloat(pb.width)>0) && exact(pb.backgroundColor,accentRaw)) ||
        ((pa.content&&pa.content!=='none'&&pa.content!=='normal'&&parseFloat(pa.width)>0) && exact(pa.backgroundColor,accentRaw));
      if(hit) known.add(el);
    });
    let i=0; const arr=[];
    for (const el of known) {
      if (!visible(el)) continue;
      const cs=getComputedStyle(el), pb=getComputedStyle(el,'::before'), pa=getComputedStyle(el,'::after');
      const txt=textOf(el);
      const id=el.id?'#'+el.id:'';
      const cls=(typeof el.className==='string'?el.className:'').trim().split(/\\s+/).filter(Boolean).slice(0,4).map(c=>'.'+c).join('');
      const sel=id||cls||el.tagName.toLowerCase();
      const key='c4-'+i++;
      el.setAttribute('data-c4-audit',key);
      const bgInfo=effBg(el,false), outInfo=effBg(el,true);
      const exactAccent = exact(cs.color,accentRaw)||exact(cs.backgroundColor,accentRaw)||(parseFloat(cs.borderTopWidth)>0&&cs.borderTopStyle!=='none'&&exact(cs.borderTopColor,accentRaw))||(parseFloat(cs.outlineWidth)>0&&cs.outlineStyle!=='none'&&exact(cs.outlineColor,accentRaw))||((pb.content&&pb.content!=='none'&&pb.content!=='normal')&&(exact(pb.color,accentRaw)||(parseFloat(pb.width)>0&&exact(pb.backgroundColor,accentRaw))))||((pa.content&&pa.content!=='none'&&pa.content!=='normal')&&(exact(pa.color,accentRaw)||(parseFloat(pa.width)>0&&exact(pa.backgroundColor,accentRaw))));
      const derived = /\b(primary|fab-add|feature-profile-switch|dash-segmented-pill|dash-part-mini-bar|circle)\b/.test((el.className||'')+' '+el.id);
      arr.push({key,sel,tag:el.tagName.toLowerCase(),id:el.id||'',cls:(typeof el.className==='string'?el.className:''),text:txt.slice(0,120),directText:directText(el),exactAccent,derivedAccent:derived,bgRgb:bgInfo.bg,bgUncertain:bgInfo.uncertain,bgGradient:bgInfo.gradientColors,outsideRgb:outInfo.bg,outsideUncertain:outInfo.uncertain,outsideGradient:outInfo.gradientColors,
        color:cs.color,bg:cs.backgroundColor,bgImage:cs.backgroundImage,fontSize:cs.fontSize,fontWeight:cs.fontWeight,
        borderW:cs.borderTopWidth,borderStyle:cs.borderTopStyle,borderColor:cs.borderTopColor,
        outlineW:cs.outlineWidth,outlineStyle:cs.outlineStyle,outlineColor:cs.outlineColor,
        pBeforeColor:pb.color,pBeforeBg:pb.backgroundColor,pBeforeContent:pb.content,pBeforeW:pb.width,pBeforeH:pb.height,
        pAfterColor:pa.color,pAfterBg:pa.backgroundColor,pAfterContent:pa.content,pAfterW:pa.width,pAfterH:pa.height,
        rect:(()=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})(),
        role:el.getAttribute('role')||'', aria:el.getAttribute('aria-label')||'', disabled:!!el.disabled, tabIndex:el.tabIndex
      });
    }
    return arr;
  })()`;

  function parseColor(c) {
    if (!c) return null; c=String(c).trim();
    let m=c.match(/^rgba?\(([^)]+)\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};}
    m=c.match(/^color\(srgb\s+([^)]+)\)$/); if(m){const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number);return {r:n[0]*255,g:n[1]*255,b:n[2]*255,a:n.length>3?n[3]:1};}
    m=c.match(/^#([0-9a-f]{3,8})$/i); if(m){let h=m[1];if(h.length===3||h.length===4)h=h.split('').map(x=>x+x).join(''); if(h.length===6)h+='ff'; if(h.length===8)return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:parseInt(h.slice(6,8),16)/255};}
    if(c==='transparent') return {r:0,g:0,b:0,a:0}; return null;
  }
  function comp(fg,bg){ const a=(fg.a??1)+(bg.a??1)*(1-(fg.a??1)); if(a===0)return {r:255,g:255,b:255,a:1}; return {r:(fg.r*(fg.a??1)+bg.r*(bg.a??1)*(1-(fg.a??1)))/a,g:(fg.g*(fg.a??1)+bg.g*(bg.a??1)*(1-(fg.a??1)))/a,b:(fg.b*(fg.a??1)+bg.b*(bg.a??1)*(1-(fg.a??1)))/a,a}; }
  function lum(c){ const f=x=>{x=x/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}; return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); }
  function ratio(a,b){ const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
  function relLum(c){return lum(c)}
  function parseGradientColors(img) { const re=/rgba?\([^)]+\)|color\(srgb[^)]+\)/g; return (String(img).match(re)||[]).map(parseColor).filter(c=>c&&c.a>0); }

  function measure(c) {
    const fg=parseColor(c.color)||{r:0,g:0,b:0,a:1};
    let bg=c.bgRgb||{r:255,g:255,b:255,a:1};
    let uncertain=(c.bgUncertain||[]).concat(c.outsideUncertain||[]);
    let gradient=(c.bgGradient||[]).concat(c.outsideGradient||[]).concat(parseGradientColors(c.bgImage));
    const compFg=fg.a<1?comp(fg,bg):fg;
    let textRatio=ratio(compFg,bg);
    if(gradient.length){ for(const g of gradient){ const gb=comp(g,{r:255,g:255,b:255,a:1}); textRatio=Math.min(textRatio,ratio(compFg,gb)); } }
    const fs=parseFloat(c.fontSize)||16, fw=parseInt(c.fontWeight)||400;
    const large=fs>=24 || (fs>=18.66 && fw>=700);
    const hasText=!!c.text && (c.directText || ['button','a','label','small','span','strong','p','h1','h2','h3','h4','h5','h6'].includes(c.tag));
    const icon = !hasText && (c.tag==='i'||c.tag==='svg'||c.tag==='img'|| (c.pBeforeContent&&c.pBeforeContent!=='none'&&c.pBeforeContent!=='normal') || (c.pAfterContent&&c.pAfterContent!=='none'&&c.pAfterContent!=='normal'));
    let iconRatio=textRatio;
    if(icon && (c.pBeforeContent&&c.pBeforeContent!=='none'&&c.pBeforeContent!=='normal')) { const pc=parseColor(c.pBeforeColor)||fg; iconRatio=ratio(pc.a<1?comp(pc,bg):pc,bg); }
    if(icon && (c.pAfterContent&&c.pAfterContent!=='none'&&c.pAfterContent!=='normal')) { const pc=parseColor(c.pAfterColor)||fg; iconRatio=Math.min(iconRatio,ratio(pc.a<1?comp(pc,bg):pc,bg)); }
    const borderW=parseFloat(c.borderW)||0; const borderRatio=(borderW>0&&c.borderStyle!=='none'&&parseColor(c.borderColor))?ratio(parseColor(c.borderColor),bg):null;
    const outlineW=parseFloat(c.outlineW)||0; const outlineRatio=(outlineW>0&&c.outlineStyle!=='none'&&parseColor(c.outlineColor))?ratio(parseColor(c.outlineColor),bg):null;
    const bgColor=parseColor(c.bg); let bgRatio=null;
    if(bgColor&&bgColor.a>0){ const outside=c.outsideRgb||{r:255,g:255,b:255,a:1}; bgRatio=ratio(comp(bgColor,outside),outside); }
    let pseudoBgRatio=null;
    for(const [bgv,w,content] of [[c.pBeforeBg,c.pBeforeW,c.pBeforeContent],[c.pAfterBg,c.pAfterW,c.pAfterContent]]){ const pc=parseColor(bgv); if(pc&&pc.a>0&&parseFloat(w)>0&&content&&content!=='none'&&content!=='normal'){ const outside=c.outsideRgb||{r:255,g:255,b:255,a:1}; pseudoBgRatio=Math.max(pseudoBgRatio||0,ratio(comp(pc,outside),outside)); } }
    return {textRatio,bgRatio,borderRatio,outlineRatio,iconRatio,pseudoBgRatio,large,hasText,icon,fs,fw,uncertain,bg:{r:Math.round(bg.r),g:Math.round(bg.g),b:Math.round(bg.b)},fg:{r:Math.round(compFg.r),g:Math.round(compFg.g),b:Math.round(compFg.b)}};
  }
  const result = { meta:{url:URL,startedAt:new Date().toISOString(),viewport:{},themes:{},selectors:KEY_SELECTORS}, rows:[], states:[], errors:{console:consoleErrors,exceptions}, skipped:[] };
  log('Connecting and navigating', URL);
  await navigate();
  for (const vp of [{name:'mobile',w:390,h:844,mobile:true},{name:'desktop',w:1440,h:900,mobile:false}]) {
    await setViewport(vp.w,vp.h,vp.mobile);
    for (const th of LIGHT) {
      log('LIGHT', th.id, th.name, vp.name);
      await evalv(`window.applyLightTheme(${JSON.stringify(th.id)}, false); true`);
      await sleep(80);
      const screens = [...TABS.map(([t,l])=>({kind:'tab',id:t,label:l})), {kind:'drawer',id:'drawer',label:'Menu lateral'}];
      for (const scr of screens) {
        if (scr.kind==='tab') await openTab(scr.id); else await openDrawer();
        const raw = await evalv(collectScript);
        for (const c of raw) {
          const m=measure(c);
          result.rows.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:scr.id,screenLabel:scr.label,...c,...m});
        }
      }
      // panels only once per theme/viewport; they are overlays
      for (const pid of PANELS) {
        const exists = await evalv(`!!document.getElementById(${JSON.stringify(pid)})`);
        if(!exists){ result.skipped.push({vp:vp.name,themeSet:'light',theme:th.id,panel:pid,reason:'missing'}); continue; }
        await resetScreen(); await openPanel(pid);
        const open = await evalv(`!!document.getElementById(${JSON.stringify(pid)})?.classList.contains('open')`);
        if(!open){ result.skipped.push({vp:vp.name,themeSet:'light',theme:th.id,panel:pid,reason:'not-open'}); continue; }
        const raw = await evalv(collectScript);
        for (const c of raw) { const m=measure(c); result.rows.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:'panel:'+pid,screenLabel:pid,...c,...m}); }
      }
      await resetScreen();
    }
    for (const th of DARK) {
      log('DARK', th.id, th.name, vp.name);
      await evalv(`(()=>{document.body.classList.add('dark-mode');window.applyDarkTheme(${JSON.stringify(th.id)}, false);return true})()`);
      await sleep(80);
      for (const tab of ['inicio','dash','caixa','invest','cards','profile']) {
        await openTab(tab);
        const raw=await evalv(collectScript);
        for(const c of raw){ const m=measure(c); result.rows.push({vp:vp.name,themeSet:'dark',theme:th.id,themeName:th.name,screen:tab,screenLabel:tab,...c,...m}); }
      }
      await resetScreen();
      await evalv(`(()=>{document.body.classList.remove('dark-mode');return true})()`);
    }
  }

  // state probes for priority interactive consumers, worst light themes, both viewports
  const stateSelectors = ['.toolbar button.primary','.toolbar button:not(.primary)','.ledger-filter-button','.mobile-bottom-nav button','.drawer-nav button','.dash-expand-btn','.invest-total-expand-btn','.profile-avatar','.credit-card-invoice-toggle','.credit-card-invoice-reset'];
  for(const vp of [{name:'mobile',w:390,h:844,mobile:true},{name:'desktop',w:1440,h:900,mobile:false}]){
    await setViewport(vp.w,vp.h,vp.mobile);
    for(const th of LIGHT.filter(x=>['3','4','5'].includes(x.id))){
      await evalv(`window.applyLightTheme(${JSON.stringify(th.id)}, false); true`); await sleep(60);
      for(const [tab,label] of [['dash','Dashboard'],['caixa','Lançamentos'],['invest','Investimentos'],['profile','Perfil']]){
        await openTab(tab);
        for(const s of stateSelectors){
          const has=await evalv(`!!document.querySelector(${JSON.stringify(s)})`);
          if(!has) continue;
          const key='st-'+Math.random().toString(36).slice(2,9);
          const base=await evalv(`(()=>{const el=document.querySelector(${JSON.stringify(s)});el.setAttribute('data-c4-state','${key}');return {sel:${JSON.stringify(s)},text:(el.innerText||'').trim().slice(0,80),cls:el.className||'',tag:el.tagName.toLowerCase()}})()`);
          let doc=await DOM.getDocument({depth:-1,pierce:true});
          let q=await DOM.querySelector({nodeId:doc.root.nodeId,selector:`[data-c4-state="${key}"]`});
          if(!q.nodeId) continue;
          for(const state of ['normal','hover','focus-visible','active','disabled']){
            if(state!=='normal') await CSS.forcePseudoState({nodeId:q.nodeId,forcedPseudoClasses:[state]}).catch(()=>{});
            const m=await evalv(`(()=>{const el=document.querySelector('[data-c4-state="${key}"]');if(!el)return null;const cs=getComputedStyle(el);const r=el.getBoundingClientRect();return {color:cs.color,bg:cs.backgroundColor,img:cs.backgroundImage,border:cs.borderTopWidth+' '+cs.borderTopColor,outline:cs.outlineWidth+' '+cs.outlineStyle+' '+cs.outlineColor,filter:cs.filter,opacity:cs.opacity,rect:{w:r.width,h:r.height}}})()`);
            result.states.push({vp:vp.name,theme:th.id,themeName:th.name,screen:tab,screenLabel:label,sel:s,state,...base,...m});
            if(state!=='normal') await CSS.forcePseudoState({nodeId:q.nodeId,forcedPseudoClasses:[]}).catch(()=>{});
          }
          await evalv(`document.querySelector('[data-c4-state="${key}"]')?.removeAttribute('data-c4-state');true`).catch(()=>{});
        }
      }
    }
  }

  // cleanup
  await evalv(`(()=>{document.querySelectorAll('[data-c4-audit]').forEach(e=>e.removeAttribute('data-c4-audit'));document.querySelectorAll('[data-c4-state]').forEach(e=>e.removeAttribute('data-c4-state'));document.getElementById('c4-audit-style')?.remove();document.body.classList.remove('dark-mode');window.applyLightTheme('1',false);return true})()`).catch(()=>{});
  const text = JSON.stringify(result,null,2);
  fs.writeFileSync(OUT,text);
  result.meta.hash = hash(text);
  result.meta.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT,JSON.stringify(result,null,2));
  fs.writeFileSync(LOG,logLines.join('\n')+'\n');
  log('WROTE',OUT,result.meta.hash,'rows',result.rows.length,'states',result.states.length,'consoleErrors',consoleErrors.length,'exceptions',exceptions.length,'skipped',result.skipped.length);
  await client.close();
})().catch(err=>{ console.error(err.stack||err); process.exit(1); });
