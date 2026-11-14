const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const crypto = require('crypto');
const OUT = '/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r2-3.json';
const LOG = '/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r2-3.log';
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
const DERIVED_HINTS = /\b(primary|fab-add|feature-profile-switch|dash-segmented-pill|dash-part-mini-bar|circle|toggle-active|action-delete|surface-accent)\b/;
const STATE_SELECTORS = [
  '.toolbar button.primary','.toolbar button:not(.primary)','.ledger-filter-button',
  '.mobile-bottom-nav button','.drawer-nav button','.dash-expand-btn','.invest-total-expand-btn',
  '.profile-avatar','.credit-card-invoice-toggle','.credit-card-invoice-reset'
];
const STATE_STATES = ['normal','hover','focus-visible','active','disabled'];
const ACCENT_PROPS = ['color','background-color','fill','stroke','border-color','outline-color'];

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function hash(s){ return crypto.createHash('sha256').update(s).digest('hex'); }

(async () => {
  const logLines = [];
  const log = (...a) => { const s=a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); logLines.push(s); console.log(s); };
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, CSS, Emulation } = client;
  const consoleErrors = [];
  const exceptions = [];
  const cdpErrors = [];

  Runtime.consoleAPICalled(({type,args}) => {
    if (type === 'error') consoleErrors.push(args.map(a=>a.value ?? a.description ?? '').join(' '));
  });
  Runtime.exceptionThrown(({exceptionDetails}) => {
    exceptions.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception');
  });
  await Runtime.enable(); await Page.enable(); await DOM.enable(); await CSS.enable();

  const gitEnv = (() => {
    try {
      const { execSync } = require('child_process');
      const commit = execSync('git -C /data/data/com.termux/files/home/LIVRO-CAIXA rev-parse HEAD', {encoding:'utf8'}).trim();
      const branch = execSync('git -C /data/data/com.termux/files/home/LIVRO-CAIXA branch --show-current', {encoding:'utf8'}).trim();
      return { commit, branch };
    } catch (e) { return { commit: '', branch: '' }; }
  })();
  const env = await (async () => {
    const ua = await Runtime.evaluate({ expression: 'navigator.userAgent', returnByValue: true }).catch(()=>({result:{value:''}}));
    const platform = await Runtime.evaluate({ expression: 'navigator.platform', returnByValue: true }).catch(()=>({result:{value:''}}));
    return { commit: gitEnv.commit, branch: gitEnv.branch, userAgent: ua.result.value || '', platform: platform.result.value || '' };
  })();

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

  // =====================================================================
  // CORREÇÃO R23-01 & R23-02 — Sondas de estado com nodeId individual + sampleId único
  // =====================================================================
  // Para cada seletor+estado: obter TODOS os nodeIds via DOM.querySelectorAll,
  // aplicar CSS.forcePseudoState a CADA nodeId individualmente, coletar estilo
  // computado de cada nó, remover o estado antes da próxima ocorrência.
  // sampleId único: r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}

  async function probeState(selector, state, vp, themeSet, theme, screen) {
    const occurrences = [];
    let rootNodeId;
    try {
      const doc = await DOM.getDocument({depth: -1, pierce: true});
      rootNodeId = doc.root.nodeId;
    } catch (e) {
      cdpErrors.push({sampleId: null, operation: 'DOM.getDocument', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString()});
      return occurrences;
    }

    let nodeIds;
    try {
      const qs = await DOM.querySelectorAll({nodeId: rootNodeId, selector});
      nodeIds = qs.nodeIds || [];
    } catch (e) {
      cdpErrors.push({sampleId: null, operation: 'DOM.querySelectorAll', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector});
      return occurrences;
    }

    if (nodeIds.length === 0) {
      occurrences.push({sampleId: null, index: 0, discarded: true, reason: 'no-elements-found', selector, state});
      return occurrences;
    }

    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      const sampleId = `r23-${vp}-${themeSet}-${theme}-${screen}-${selector.replace(/[^a-zA-Z0-9]/g,'-')}-${state}-${i}`;
      let discarded = false;
      let reason = null;
      let computed = null;
      let boxModel = null;

      // Verificar se o nó ainda existe e está visível
      let nodeInfo;
      try {
        const described = await DOM.describeNode({nodeId, depth: 0});
        nodeInfo = described.node;
        if (!nodeInfo) {
          occurrences.push({sampleId, index: i, discarded: true, reason: 'node-gone', selector, state, nodeId});
          continue;
        }
      } catch (e) {
        cdpErrors.push({sampleId, operation: 'DOM.describeNode', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector, state, index: i});
        occurrences.push({sampleId, index: i, discarded: true, reason: 'describe-error', selector, state, nodeId});
        continue;
      }

      // Aplicar pseudo-classe ao nodeId específico desta ocorrência
      if (state !== 'normal') {
        try {
          await CSS.forcePseudoState({nodeId, forcedPseudoClasses: [state]});
        } catch (e) {
          cdpErrors.push({sampleId, operation: 'CSS.forcePseudoState', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector, state, index: i, nodeId});
          occurrences.push({sampleId, index: i, discarded: true, reason: 'force-pseudo-error', selector, state, nodeId});
          continue;
        }
      }

      // Coletar estilo computado deste nó específico (essencial)
      try {
        const cs = await CSS.getComputedStyleForNode({nodeId});
        computed = cs.computedStyle;
      } catch (e) {
        cdpErrors.push({sampleId, operation: 'CSS.getComputedStyleForNode', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector, state, index: i, nodeId});
        discarded = true;
        reason = 'computed-style-error';
      }

      // Coletar geometria (opcional - não descarta se falhar)
      try {
        const bm = await DOM.getBoxModel({nodeId});
        boxModel = bm.model;
      } catch (e) {
        cdpErrors.push({sampleId, operation: 'DOM.getBoxModel', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector, state, index: i, nodeId});
        boxModel = null;
      }

      // Remover pseudo-classe antes da próxima ocorrência
      if (state !== 'normal') {
        try {
          await CSS.forcePseudoState({nodeId, forcedPseudoClasses: []});
        } catch (e) {
          cdpErrors.push({sampleId, operation: 'CSS.forcePseudoState-clear', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector, state, index: i, nodeId});
        }
      }

      // Se o estilo computado não pôde ser obtido, descartar a ocorrência
      if (!computed) {
        occurrences.push({sampleId, index: i, discarded: true, reason: reason || 'computed-style-missing', selector, state, nodeId});
        continue;
      }

      const propMap = {};
      for (const entry of computed || []) {
        propMap[entry.name] = entry.value;
      }

      // CORREÇÃO R23-04 — Geometria usando os quatro vértices do quadrilátero
      let rect = null;
      if (boxModel) {
        const border = boxModel.border;
        if (border && border.length >= 8) {
          const xs = [border[0], border[2], border[4], border[6]];
          const ys = [border[1], border[3], border[5], border[7]];
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          rect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        }
      }

      occurrences.push({
        sampleId, index: i, discarded: false, selector, state, nodeId,
        rect,
        color: propMap.color || null,
        bg: propMap['background-color'] || null,
        img: propMap['background-image'] || null,
        border: propMap['border-top-color'] ? `${propMap['border-top-width']} ${propMap['border-top-style']} ${propMap['border-top-color']}` : null,
        outline: propMap['outline-color'] ? `${propMap['outline-width']} ${propMap['outline-style']} ${propMap['outline-color']}` : null,
        filter: propMap.filter || null,
        opacity: propMap.opacity || null,
        disabled: nodeInfo.attributes ? nodeInfo.attributes.includes('disabled') : false,
        tabIndex: nodeInfo.attributes ? (nodeInfo.attributes.find(a => a.name === 'tabindex') || {}).value || null : null,
        role: nodeInfo.attributes ? (nodeInfo.attributes.find(a => a.name === 'role') || {}).value || null : null,
        aria: nodeInfo.attributes ? (nodeInfo.attributes.find(a => a.name === 'aria-label') || {}).value || null : null
      });
    }

    return occurrences;
  }

  const collectScript = `(() => {
    const exact = (a,b) => {
      const A=pc(a), B=pc(b); if(!A||!B) return false;
      return Math.abs(A.r-B.r)<.5 && Math.abs(A.g-B.g)<.5 && Math.abs(A.b-B.b)<.5 && Math.abs(A.a-B.a)<.01;
    };
    const visible = el => { const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; const r=el.getBoundingClientRect(); return r.width>0 && r.height>0; };
    const directText = el => Array.from(el.childNodes).some(n=>n.nodeType===3 && n.nodeValue.trim());
    const textOf = el => (el.innerText || el.value || '').replace(/\\\\s+/g,' ').trim();
    const hasDescendantText = el => {
      if (!el) return false;
      const it = (el.innerText || '').replace(/\\\\s+/g,' ').trim();
      return it.length > 0;
    };
    const pc = c => { if (!c) return null; c=String(c).trim();
      const lower = c.toLowerCase();
      if (lower.startsWith('rgba(') && lower.endsWith(')')) {
        const inner = lower.slice(5, -1);
        const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
        if (n.length >= 3) return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};
      }
      if (lower.startsWith('rgb(') && lower.endsWith(')')) {
        const inner = lower.slice(4, -1);
        const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
        if (n.length >= 3) return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};
      }
      const m2 = c.match(/^#([0-9a-f]{3,8})$/i);
      if (m2) { let h=m2[1]; if(h.length===3||h.length===4) h=h.split('').map(x=>x+x).join(''); if(h.length===6) h+='ff'; if(h.length===8) return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:parseInt(h.slice(6,8),16)/255}; }
      if (c==='transparent') return {r:0,g:0,b:0,a:0}; return null;
    };
    const ccomp = (fg,bg) => { const a=(fg.a??1)+(bg.a??1)*(1-(fg.a??1)); if(a===0)return {r:255,g:255,b:255,a:1}; return {r:(fg.r*(fg.a??1)+bg.r*(bg.a??1)*(1-(fg.a??1)))/a,g:(fg.g*(fg.a??1)+bg.g*(bg.a??1)*(1-(fg.a??1)))/a,b:(fg.b*(fg.a??1)+bg.b*(bg.a??1)*(1-(fg.a??1)))/a,a}; };
    const effBg = (el, startParent=false) => { const chain=[]; for(let n=startParent?el.parentElement:el;n;n=n.parentElement)chain.push(n); chain.reverse(); let bg={r:255,g:255,b:255,a:1}; const uncertain=[]; const gradientColors=[]; for(const n of chain){ const x=getComputedStyle(n); if(x.backgroundImage&&x.backgroundImage!=='none'){ uncertain.push(n.id?'#'+n.id:(n.className||n.tagName)); const bi=x.backgroundImage; for (let k=0;k<bi.length;k++){ if (bi[k]==='r' && bi.startsWith('rgb',k) || bi[k]==='R' && bi.startsWith('RGB',k)) { const end=bi.indexOf(')',k); if(end>0){ const q=pc(bi.slice(k,end+1)); if(q&&q.a>0) gradientColors.push(q); k=end; } } else if (bi[k]==='#') { const end=bi.indexOf(')',k); const seg=end>0?bi.slice(k,end):bi.slice(k,k+8); const q=pc(seg); if(q&&q.a>0) gradientColors.push(q); k+=7; } } } const q=pc(x.backgroundColor); if(q&&q.a>0)bg=ccomp(q,bg); } return {bg,uncertain,gradientColors}; };
    const accentRaw = getComputedStyle(document.body).getPropertyValue('--accent').trim();

    function resolveCurrentColor(el) {
      const cs = getComputedStyle(el);
      return cs.color;
    }

    function isAccentConsumer(el) {
      const cs=getComputedStyle(el);
      const pb=getComputedStyle(el,'::before'), pa=getComputedStyle(el,'::after');
      if (exact(cs.color,accentRaw)) return {consumed:true, property:'color'};
      if (exact(cs.backgroundColor,accentRaw)) return {consumed:true, property:'backgroundColor'};
      if (parseFloat(cs.borderTopWidth)>0 && cs.borderTopStyle!=='none' && exact(cs.borderTopColor,accentRaw)) return {consumed:true, property:'borderTopColor'};
      if (parseFloat(cs.outlineWidth)>0 && cs.outlineStyle!=='none' && exact(cs.outlineColor,accentRaw)) return {consumed:true, property:'outlineColor'};
      if ((pb.content&&pb.content!=='none'&&pb.content!=='normal') && exact(pb.color,accentRaw)) return {consumed:true, property:'pBeforeColor'};
      if ((pa.content&&pa.content!=='none'&&pa.content!=='normal') && exact(pa.color,accentRaw)) return {consumed:true, property:'pAfterColor'};
      if ((pb.content&&pb.content!=='none'&&pb.content!=='normal'&&parseFloat(pb.width)>0) && exact(pb.backgroundColor,accentRaw)) return {consumed:true, property:'pBeforeBg'};
      if ((pa.content&&pa.content!=='none'&&pa.content!=='normal'&&parseFloat(pa.width)>0) && exact(pa.backgroundColor,accentRaw)) return {consumed:true, property:'pAfterBg'};
      const fillAttr = el.getAttribute ? el.getAttribute('fill') : null;
      const computedFill = cs.fill;
      if (exact(fillAttr,accentRaw)) return {consumed:true, property:'svgFillAttr'};
      if (exact(computedFill,accentRaw)) return {consumed:true, property:'svgComputedFill'};
      const strokeAttr = el.getAttribute ? el.getAttribute('stroke') : null;
      const computedStroke = cs.stroke;
      if (exact(strokeAttr,accentRaw)) return {consumed:true, property:'svgStrokeAttr'};
      if (exact(computedStroke,accentRaw)) return {consumed:true, property:'svgComputedStroke'};
      if (exact(resolveCurrentColor(el),accentRaw)) {
        if (computedFill === 'currentColor' || computedStroke === 'currentColor' ||
            fillAttr === 'currentColor' || strokeAttr === 'currentColor') {
          return {consumed:true, property:'svgCurrentColor'};
        }
      }
      return {consumed:false, property:null};
    }

    function isDerivedCandidate(el) {
      const cls=(typeof el.className==='string'?el.className:'')+' '+(el.id||'');
      return DERIVED_HINTS_RE.test(cls) && !isAccentConsumer(el).consumed;
    }
    const DERIVED_HINTS_RE = new RegExp(${JSON.stringify(DERIVED_HINTS.source)});

    const known = new Map();
    const derivedCandidates = [];
    const seenNodes = new Set();

    document.querySelectorAll(${JSON.stringify(KEY_SELECTORS.join(','))}).forEach(el=>{
      if(!visible(el)) return;
      if (seenNodes.has(el)) return;
      const result = isAccentConsumer(el);
      if (result.consumed) { known.set(el, {el, result}); seenNodes.add(el); }
      else if (isDerivedCandidate(el)) derivedCandidates.push(el);
    });

    document.querySelectorAll('body *').forEach(el=>{
      if(!el || el===document.body || el===document.documentElement || !visible(el)) return;
      if (seenNodes.has(el)) return;
      const result = isAccentConsumer(el);
      if (result.consumed) { known.set(el, {el, result}); seenNodes.add(el); }
      else if (isDerivedCandidate(el)) derivedCandidates.push(el);
    });

    let i=0; const arr=[];
    for (const [el, {result: accentResult}] of known) {
      if (!visible(el)) continue;
      const cs=getComputedStyle(el), pb=getComputedStyle(el,'::before'), pa=getComputedStyle(el,'::after');
      const txt=textOf(el);
      const id=el.id?'#'+el.id:'';
      const cls=(typeof el.className==='string'?el.className:'').trim().split(/\\\\s+/).filter(Boolean).slice(0,4).map(c=>'.'+c).join('');
      const sel=id||cls||el.tagName.toLowerCase();
      const key='c4-'+i++;
      el.setAttribute('data-c4-audit',key);
      const bgInfo=effBg(el,false), outInfo=effBg(el,true);
      const exactAccent = accentResult.consumed;
      const derived = DERIVED_HINTS_RE.test((el.className||'')+' '+el.id);
      arr.push({key,sel,tag:el.tagName.toLowerCase(),id:el.id||'',cls:(typeof el.className==='string'?el.className:''),text:txt.slice(0,120),directText:directText(el),hasDescendantText:hasDescendantText(el),exactAccent,derivedAccent:derived,bgRgb:bgInfo.bg,bgUncertain:bgInfo.uncertain,bgGradient:bgInfo.gradientColors,outsideRgb:outInfo.bg,outsideUncertain:outInfo.uncertain,outsideGradient:outInfo.gradientColors,
        color:cs.color,bg:cs.backgroundColor,bgImage:cs.backgroundImage,fontSize:cs.fontSize,fontWeight:cs.fontWeight,
        borderW:cs.borderTopWidth,borderStyle:cs.borderTopStyle,borderColor:cs.borderTopColor,
        outlineW:cs.outlineWidth,outlineStyle:cs.outlineStyle,outlineColor:cs.outlineColor,
        pBeforeColor:pb.color,pBeforeBg:pb.backgroundColor,pBeforeContent:pb.content,pBeforeW:pb.width,pBeforeH:pb.height,
        pAfterColor:pa.color,pAfterBg:pa.backgroundColor,pAfterContent:pa.content,pAfterW:pa.width,pAfterH:pa.height,
        rect:{x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height},
        role:el.getAttribute('role')||'', aria:el.getAttribute('aria-label')||'', disabled:!!el.disabled, tabIndex:el.tabIndex,
        isSvg: el.tagName==='svg' || el.closest('svg')!==null,
        svgFill: el.getAttribute ? el.getAttribute('fill') : null,
        svgStroke: el.getAttribute ? el.getAttribute('stroke') : null,
        computedFill: cs.fill,
        computedStroke: cs.stroke,
        currentColor: cs.color,
        accentProperty: accentResult.property
      });
    }
    return {rows:arr, derivedCount: derivedCandidates.length, derivedExample: derivedCandidates.slice(0,5).map(el=>({tag:el.tagName.toLowerCase(),id:el.id||'',cls:(typeof el.className==='string'?el.className:'').slice(0,60),text:(el.innerText||'').slice(0,60)}))};
  })()`;

  function parseColor(c) {
    if (!c) return null; c=String(c).trim();
    const lower = c.toLowerCase();
    if (lower.startsWith('rgba(') && lower.endsWith(')')) {
      const inner = lower.slice(5, -1);
      const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
      if (n.length >= 3) return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};
    }
    if (lower.startsWith('rgb(') && lower.endsWith(')')) {
      const inner = lower.slice(4, -1);
      const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
      if (n.length >= 3) return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1};
    }
    const m2 = c.match(/^#([0-9a-f]{3,8})$/i);
    if (m2) { let h=m2[1]; if(h.length===3||h.length===4) h=h.split('').map(x=>x+x).join(''); if(h.length===6) h+='ff'; if(h.length===8) return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:parseInt(h.slice(6,8),16)/255}; }
    if (c==='transparent') return {r:0,g:0,b:0,a:0}; return null;
  }
  function comp(fg,bg){ const a=(fg.a??1)+(bg.a??1)*(1-(fg.a??1)); if(a===0) return {r:255,g:255,b:255,a:1}; return {r:(fg.r*(fg.a??1)+bg.r*(bg.a??1)*(1-(fg.a??1)))/a,g:(fg.g*(fg.a??1)+bg.g*(bg.a??1)*(1-(fg.a??1)))/a,b:(fg.b*(fg.a??1)+bg.b*(bg.a??1)*(1-(fg.a??1)))/a,a}; }
  function lum(c){ const f=x=>{x=x/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}; return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); }
  function ratio(a,b){ const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(min(x,y)+.05); }
  function relLum(c){return lum(c)}
  function parseGradientColors(img) {
    if (!img) return [];
    const lower = img.toLowerCase();
    const colors = [];
    const re = /rgba?\\(([^)]+)\\)/g;
    let m;
    while ((m = re.exec(img)) !== null) {
      const c = parseColor(m[0]);
      if (c && c.a > 0) colors.push(c);
    }
    return colors.filter(c=>c&&c.a>0);
  }
  function min(a,b){return a<b?a:b;}

  async function getWinningRule(nodeId, property) {
    try {
      const matched = await CSS.getMatchedStylesForNode({nodeId});
      if (!matched || !matched.matchedCSSRules) return null;
      for (const rule of matched.matchedCSSRules) {
        if (!rule.style) continue;
        for (let j=0;j<rule.style.length;j++) {
          const prop = rule.style.property(j);
          if (prop === property || prop === property.replace('-','')) {
            const value = rule.style.value(j);
            if (value && (value.includes('accent') || value.includes('var(--'))) {
              return {
                selectorText: rule.selectorText||'',
                origin: rule.origin||'',
                styleSheetId: rule.styleSheetId||'',
                property,
                value,
                important: (rule.style.getPropertyValue(property + ' important') || '').length > 0 ? true : undefined,
                matched: true,
                captureStatus: 'CAPTURED'
              };
            }
          }
        }
      }
    } catch (e) {
      cdpErrors.push({sampleId: null, operation: 'CSS.getMatchedStylesForNode', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), nodeId, property});
      return null;
    }
    return null;
  }

  async function captureWinningRules(c) {
    if (!c.nodeId) return {};
    const props = ['color', 'background-color', 'border-color', 'outline-color'];
    const out = {};
    for (const p of props) {
      const r = await getWinningRule(c.nodeId, p);
      out[p] = r ? { value: r.value, selectorText: r.selectorText, origin: r.origin, important: r.important, captureStatus: r.captureStatus } : null;
    }
    return out;
  }

  async function getNodeIdBySelectorIndex(selector, index) {
    try {
      const doc = await DOM.getDocument({depth: -1, pierce: true});
      const qs = await DOM.querySelectorAll({nodeId: doc.root.nodeId, selector});
      const nodeIds = qs.nodeIds || [];
      if (index >= 0 && index < nodeIds.length) {
        return nodeIds[index];
      }
      return null;
    } catch (e) {
      cdpErrors.push({sampleId: null, operation: 'DOM.querySelectorAll', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString(), selector});
      return null;
    }
  }

  function measure(c) {
    const fg=parseColor(c.color)||{r:0,g:0,b:0,a:1};
    let bg=c.bgRgb||{r:255,g:255,b:255,a:1};
    let uncertain=(c.bgUncertain||[]).concat(c.outsideUncertain||[]);
    let gradient=(c.bgGradient||[]).concat(c.outsideGradient||[]).concat(parseGradientColors(c.bgImage));
    const compFg=fg.a<1?comp(fg,bg):fg;
    let textRatio=ratio(compFg,bg);
    if(gradient.length){ for(const g of gradient){ const gb=comp(g,{r:255,g:255,b:255,a:1}); textRatio=min(textRatio,ratio(compFg,gb)); } }
    const fs=parseFloat(c.fontSize)||16, fw=parseInt(c.fontWeight)||400;
    const large=fs>=24 || (fs>=18.66 && fw>=700);
    const directText = c.directText;
    const hasText = (!!c.text || c.hasDescendantText) && (directText || ['button','a','label','small','span','strong','p','h1','h2','h3','h4','h5','h6'].includes(c.tag));
    const icon = !hasText && (c.tag==='i'||c.tag==='svg'||c.tag==='img'|| (c.pBeforeContent&&c.pBeforeContent!=='none'&&c.pBeforeContent!=='normal') || (c.pAfterContent&&c.pAfterContent!=='none'&&c.pAfterContent!=='normal'));
    let iconRatio=textRatio;
    if(icon && (c.pBeforeContent&&c.pBeforeContent!=='none'&&c.pBeforeContent!=='normal')) { const pc=parseColor(c.pBeforeColor)||fg; iconRatio=ratio(pc.a<1?comp(pc,bg):pc,bg); }
    if(icon && (c.pAfterContent&&c.pAfterContent!=='none'&&c.pAfterContent!=='normal')) { const pc=parseColor(c.pAfterColor)||fg; iconRatio=min(iconRatio,ratio(pc.a<1?comp(pc,bg):pc,bg)); }
    const borderW=parseFloat(c.borderW)||0; const borderRatio=(borderW>0&&c.borderStyle!=='none'&&parseColor(c.borderColor))?ratio(parseColor(c.borderColor),bg):null;
    const outlineW=parseFloat(c.outlineW)||0; const outlineRatio=(outlineW>0&&c.outlineStyle!=='none'&&parseColor(c.outlineColor))?ratio(parseColor(c.outlineColor),bg):null;
    const bgColor=parseColor(c.bg); let bgRatio=null;
    if(bgColor&&bgColor.a>0){ const outside=c.outsideRgb||{r:255,g:255,b:255,a:1}; bgRatio=ratio(comp(bgColor,outside),outside); }
    let pseudoBgRatio=null;
    let pseudoHasSample=false;
    for(const [bgv,w,content] of [[c.pBeforeBg,c.pBeforeW,c.pBeforeContent],[c.pAfterBg,c.pAfterW,c.pAfterContent]]) {
      const pc=parseColor(bgv);
      if(pc&&pc.a>0&&parseFloat(w)>0&&content&&content!=='none'&&content!=='normal') {
        pseudoHasSample=true;
        const outside=c.outsideRgb||{r:255,g:255,b:255,a:1};
        const r = ratio(comp(pc,outside),outside);
        pseudoBgRatio = pseudoBgRatio === null ? r : min(pseudoBgRatio, r);
      }
    }

    const TEXTO_NORMAL=4.5, TEXTO_GRANDE=3.0, GRAFICO=3.0, FOCO=3.0;
    let classificacao='APROVADO';
    let motivoFalha=null;
    let valorPior=null;
    let limiarPior=null;

    function registerFail(motivo, valor, limiar) {
      classificacao = 'FALHA';
      if (!motivoFalha || (valorPior !== null && valor < valorPior)) {
        motivoFalha = motivo;
        valorPior = valor;
        limiarPior = limiar;
      }
    }

    if (hasText) {
      const limiar = large ? TEXTO_GRANDE : TEXTO_NORMAL;
      if (textRatio === null || textRatio < limiar - 1e-9) {
        registerFail('texto', textRatio, limiar);
      }
    } else if (icon) {
      if (iconRatio === null || iconRatio < GRAFICO - 1e-9) {
        registerFail('icone', iconRatio, GRAFICO);
      }
    } else {
      classificacao = 'N.A.';
    }

    if (bgRatio !== null && bgRatio < GRAFICO - 1e-9) {
      registerFail('superficie', bgRatio, GRAFICO);
    }

    if (borderRatio !== null && borderRatio < GRAFICO - 1e-9) {
      registerFail('borda', borderRatio, GRAFICO);
    }

    if (outlineRatio !== null && outlineRatio < FOCO - 1e-9) {
      registerFail('foco', outlineRatio, FOCO);
    }

    if (uncertain && uncertain.length > 0) {
      classificacao = 'INCONCLUSIVO';
      motivoFalha = null;
      valorPior = null;
      limiarPior = null;
    }

    return {
      textRatio,bgRatio,borderRatio,outlineRatio,iconRatio,pseudoBgRatio,pseudoHasSample,
      large,hasText,icon,fs,fw,uncertain,
      classificacao,motivoFalha,valorPior,limiarPior,
      bg:{r:Math.round(bg.r),g:Math.round(bg.g),b:Math.round(bg.b)},
      fg:{r:Math.round(compFg.r),g:Math.round(compFg.g),b:Math.round(compFg.b)}
    };
  }

  const result = {
    meta:{
      url:URL,
      startedAt:new Date().toISOString(),
      viewport:{},
      themes:{},
      selectors:KEY_SELECTORS,
      stateSelectors:STATE_SELECTORS,
      stateStates:STATE_STATES,
      commit: env.commit,
      branch: env.branch,
      userAgent: env.userAgent,
      platform: env.platform
    },
    rows:[],
    states:[],
    derivedCandidates:[],
    errors:{console:consoleErrors,exceptions:exceptions,cdp:cdpErrors},
    skipped:[]
  };
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
        for (const c of raw.rows) {
          const wr = await captureWinningRules(c);
          const m=measure(c);
          result.rows.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:scr.id,screenLabel:scr.label,...c,...m,winningRules:wr});
        }
        result.derivedCandidates.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:scr.id,screenLabel:scr.label,count:raw.derivedCount,examples:raw.derivedExample});
      }
      for (const pid of PANELS) {
        const exists = await evalv(`!!document.getElementById(${JSON.stringify(pid)})`);
        if(!exists){ result.skipped.push({vp:vp.name,themeSet:'light',theme:th.id,panel:pid,reason:'missing'}); continue; }
        await resetScreen(); await openPanel(pid);
        const open = await evalv(`!!document.getElementById(${JSON.stringify(pid)})?.classList.contains('open')`);
        if(!open){ result.skipped.push({vp:vp.name,themeSet:'light',theme:th.id,panel:pid,reason:'not-open'}); continue; }
        const raw = await evalv(collectScript);
        for (const c of raw.rows) {
          const wr = await captureWinningRules(c);
          const m=measure(c);
          result.rows.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:'panel:'+pid,screenLabel:pid,...c,...m,winningRules:wr});
        }
        result.derivedCandidates.push({vp:vp.name,themeSet:'light',theme:th.id,themeName:th.name,screen:'panel:'+pid,screenLabel:pid,count:raw.derivedCount,examples:raw.derivedExample});
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
        for(const c of raw.rows){ const wr = await captureWinningRules(c); const m=measure(c); result.rows.push({vp:vp.name,themeSet:'dark',theme:th.id,themeName:th.name,screen:tab,screenLabel:tab,...c,...m,winningRules:wr}); }
      }
      await resetScreen();
      await evalv(`(()=>{document.body.classList.remove('dark-mode');return true})()`);
    }
  }

  // =====================================================================
  // CORREÇÃO R23-01 & R23-02 — Sondas de estado com nodeId individual + sampleId único
  // =====================================================================
  for(const vp of [{name:'mobile',w:390,h:844,mobile:true},{name:'desktop',w:1440,h:900,mobile:false}]) {
    await setViewport(vp.w,vp.h,vp.mobile);
    for(const th of LIGHT.filter(x=>['3','4','5'].includes(x.id))) {
      await evalv(`window.applyLightTheme(${JSON.stringify(th.id)}, false); true`); await sleep(60);
      for(const [tab,label] of [['dash','Dashboard'],['caixa','Lançamentos'],['invest','Investimentos'],['profile','Perfil']]) {
        await openTab(tab);
        for(const s of STATE_SELECTORS) {
          for(const state of STATE_STATES) {
            const occurrences = await probeState(s, state, vp.name, th.id === 'light' ? 'light' : 'dark', th.id, tab);
            result.states.push({vp:vp.name,theme:th.id,themeName:th.name,screen:tab,screenLabel:label,sel:s,state,occurrences});
          }
        }
      }
      await resetScreen();
    }
  }

  // Limpeza
  await evalv(`(()=>{document.querySelectorAll('[data-c4-audit]').forEach(e=>e.removeAttribute('data-c4-audit'));document.querySelectorAll('[data-c4-state]').forEach(e=>e.removeAttribute('data-c4-state'));document.getElementById('c4-audit-style')?.remove();window.applyLightTheme('1',false);return true})()`).catch(()=>{});

  // =====================================================================
  // CORREÇÃO R23-04 — Integridade do hash do artefato
  // =====================================================================
  result.meta.finishedAt = new Date().toISOString();
  result.meta.rowsCount = result.rows.length;
  result.meta.statesCount = result.states.length;
  result.meta.consoleErrors = consoleErrors.length;
  result.meta.exceptions = exceptions.length;
  result.meta.cdpErrors = cdpErrors.length;
  result.meta.skipped = result.skipped.length;

  const objectWithoutHash = JSON.parse(JSON.stringify(result));
  delete objectWithoutHash.meta.hash;
  delete objectWithoutHash.meta.hash16;
  const fullHash = hash(JSON.stringify(objectWithoutHash,null,2));
  result.meta.hash = fullHash;
  result.meta.hash16 = fullHash.slice(0,16);

  const finalText = JSON.stringify(result,null,2);
  fs.writeFileSync(OUT, finalText);
  fs.writeFileSync(LOG, logLines.join('\\n')+'\\n');

  const writtenContent = fs.readFileSync(OUT,'utf8');
  const writtenObj = JSON.parse(writtenContent);
  const writtenHashRecorded = writtenObj.meta.hash;
  delete writtenObj.meta.hash;
  delete writtenObj.meta.hash16;
  const writtenHashRecalculated = hash(JSON.stringify(writtenObj,null,2));
  const hashMatches = writtenHashRecalculated === fullHash;
  log('WROTE', OUT, 'hash', fullHash, 'hash16', result.meta.hash16, 'hashMatches', hashMatches,
    'rows', result.rows.length, 'states', result.states.length, 'consoleErrors', consoleErrors.length, 'exceptions', exceptions.length, 'cdpErrors', cdpErrors.length, 'skipped', result.skipped.length);
  await client.close();
})().catch(err=>{ console.error(err.stack||err); process.exit(1); });
