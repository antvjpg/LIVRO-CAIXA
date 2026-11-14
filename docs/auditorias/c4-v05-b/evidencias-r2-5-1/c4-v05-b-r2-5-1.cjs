// ============================================================================
// Harness C.4-V05-B-R2.5.1 — Auditoria runtime de consumidores de `--accent`
// Importa o núcleo compartilhado de c4-v05-b-r2-5-1-core.cjs
// Nenhum arquivo de produção é alterado.
// Correções R25-01 a R25-10 aplicadas:
// - sampleId incorpora 'screen' efetivamente (R25-01)
// - Associação key->nodeId com contrato de cardinalidade, extraída do núcleo (R25-02)
// - Registro global de sampleId extraído para o núcleo (R25-02)
// - Limpeza de pseudoestado em try/finally real com cleanupStatus (R25-03)
// - Visibilidade efetiva considerando ancestrais (R25-04)
// - Validação geométrica completa (R25-05)
// - Classificação estruturada de erros CDP (R25-06)
// - Nenhum fallback a branco presumido para fundo ausente (R25-10)
// - Caminhos relativos (sem caminhos absolutos do Termux) (R25-08)
// - Limpeza de mutações temporárias no DOM após falha (R25-09)
// ============================================================================

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const SCRIPT_DIR = path.dirname(__filename);
const CORE_PATH = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-1-core.cjs');
const {
  hash,
  sleep,
  parseColor,
  comp,
  lum,
  ratio,
  min,
  makeSampleId,
  rectFromBorder,
  measure,
  parseGradientColors,
  createCDPAuditCore,
  makeCDPErrorRecord,
  createSampleIdRegistry,
  resolveNodeIdResult,
} = require(CORE_PATH);

// Configuração por variável de ambiente ou padrão (R25-08: portabilidade)
const URL = process.env.C4_URL || 'http://127.0.0.1:8000/index.html';
const CDP_PORT = parseInt(process.env.C4_CDP_PORT || '9222', 10);
const OUT = process.env.C4_OUT || path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-1.json');
const LOG = process.env.C4_LOG || path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-1.log');

const LIGHT = [
  { id: '1', name: 'Oliva' },
  { id: '2', name: 'Verde' },
  { id: '3', name: 'Lima' },
  { id: '4', name: 'Terracota' },
  { id: '5', name: 'Laranja' }
];
const DARK = [
  { id: '1', name: 'Escuro Oliva' },
  { id: '2', name: 'Escuro Verde' },
  { id: '3', name: 'Escuro Bege' },
  { id: '4', name: 'Escuro Terracota' },
  { id: '5', name: 'Escuro Laranja' }
];
const TABS = [
  ['inicio', 'Início'],
  ['dash', 'Dashboard'],
  ['dashboard', 'Dashboard alias'],
  ['caixa', 'Lançamentos'],
  ['invest', 'Investimentos'],
  ['pockets', 'Caixinhas'],
  ['cards', 'Cartões'],
  ['bills', 'Contas'],
  ['receivables', 'A receber'],
  ['goals', 'Metas'],
  ['profile', 'Perfil']
];
const PANELS = [
  'panelNovo',
  'panelTransferencia',
  'panelThemePicker',
  'panelCard',
  'panelGoalForm',
  'panelBill',
  'panelReceivable',
  'panelInvest',
  'panelPocket',
  'panelBanco',
  'panelCategoria',
  'panelOrcamento',
  'panelLOG',
  'panelFiltros',
  'panelPurchase',
  'panelPocketMovement',
  'panelInvestMovement',
  'panelBillLaunch',
  'panelPaste',
  'panelExportFormat',
  'panelCryptoReconcile'
];
const KEY_SELECTORS = [
  '.period-eyebrow',
  '.notification-heading .eyebrow',
  '.universal-search-group',
  '.drawer-nav button',
  '.toolbar button',
  '.period-bar button',
  '.ledger-filter-button',
  '.manage-item-value',
  '.balance-detail-link',
  '.mobile-bottom-nav button.is-active',
  '.profile-avatar',
  '.profile-item-icon',
  '.diagnostic-summary-card > button.primary',
  '.feature-profile-kicker',
  '.quick-action-icon',
  '.history-kind',
  '.log-detail-toggle',
  '.bank-share-line',
  '.bill-status.is-carried',
  '.export-preview-bank h4 small',
  '#panelNovo label',
  '#panelTransferencia label',
  '#panelNovo #btnReadReceipt',
  '#panelTransferencia #btnReadTransferReceipt',
  '.dash-filter-range',
  '.dash-section-index',
  '.dash-section-meta',
  '.dash-expand-btn',
  '.dash-kpi-main small',
  '.next-pay-kicker',
  '.invest-total-expand-btn',
  '.credit-card-invoice-total',
  '.credit-card-invoice-reset',
  '.credit-card-invoice-toggle',
  '.institution-summary-metrics span.positive',
  '.goals-v2-kicker',
  '.goal-card-v2-badge',
  '.goal-card-v2-pace',
  '.feature-profile-switch',
  '#block1-circle.circle',
  '.primary',
  '.fab-add',
  '.dash-segmented-pill',
  '.dash-part-mini-bar',
  '.mobile-bottom-nav button',
  '.drawer-nav button span',
  '.panel label',
  '.panel .primary',
  '#btnRunReconciliation',
  '#btnNewReceivable',
  '#btnOpenAvatarGrid'
];
const DERIVED_HINTS = /\b(primary|fab-add|feature-profile-switch|dash-segmented-pill|dash-part-mini-bar|circle|toggle-active|action-delete|surface-accent)\b/;
const STATE_SELECTORS = [
  '.toolbar button.primary',
  '.toolbar button:not(.primary)',
  '.ledger-filter-button',
  '.mobile-bottom-nav button',
  '.drawer-nav button',
  '.dash-expand-btn',
  '.invest-total-expand-btn',
  '.profile-avatar',
  '.credit-card-invoice-toggle',
  '.credit-card-invoice-reset'
];
const STATE_STATES = ['normal', 'hover', 'focus-visible', 'active', 'disabled'];
const WINNING_PROPS = [
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke'
];

// R25-08: repositório raiz resolvido a partir do script (portabilidade)
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../../..');

(async () => {
  const logLines = [];
  const log = (...a) => {
    const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    logLines.push(s);
    console.log(s);
  };

  const client = await CDP({ port: CDP_PORT });
  const { Page, Runtime, DOM, CSS, Emulation } = client;

  const consoleErrors = [];
  const exceptions = [];
  const cdpErrors = [];

  Runtime.consoleAPICalled(({ type, args }) => {
    if (type === 'error') consoleErrors.push(args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  Runtime.exceptionThrown(({ exceptionDetails }) => {
    exceptions.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception');
  });

  await Runtime.enable();
  await Page.enable();
  await DOM.enable();
  await CSS.enable();

  // Núcleo CDP injetado com dependências explícitas
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });

  // R25-02: registro global de sampleId do núcleo (compartilhado com os testes)
  const sampleIdRegistry = createSampleIdRegistry();

  const gitEnv = (() => {
    try {
      const { execSync } = require('child_process');
      const commit = execSync(`git -C "${REPO_ROOT}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
      const branch = execSync(`git -C "${REPO_ROOT}" branch --show-current`, { encoding: 'utf8' }).trim();
      return { commit, branch };
    } catch (e) {
      return { commit: '', branch: '' };
    }
  })();

  const env = await (async () => {
    const ua = await Runtime.evaluate({
      expression: 'navigator.userAgent',
      returnByValue: true
    }).catch(() => ({ result: { value: '' } }));
    const platform = await Runtime.evaluate({
      expression: 'navigator.platform',
      returnByValue: true
    }).catch(() => ({ result: { value: '' } }));
    return {
      commit: gitEnv.commit,
      branch: gitEnv.branch,
      userAgent: ua.result.value || '',
      platform: platform.result.value || ''
    };
  })();

  async function evalv(expression, awaitPromise = false) {
    const r = await Runtime.evaluate({
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }

  async function waitReady() {
    for (let i = 0; i < 60; i++) {
      const ok = await evalv(
        `document.readyState === 'complete' && typeof applyLightTheme === 'function' && !!document.getElementById('viewDash')`
      ).catch(() => false);
      if (ok) return;
      await sleep(250);
    }
    throw new Error('app not ready');
  }

  async function navigate() {
    await Page.navigate({ url: URL });
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

  async function setViewport(w, h, mobile) {
    await Emulation.setDeviceMetricsOverride({ width: w, height: h, deviceScaleFactor: 1, mobile });
    await Emulation.setTouchEmulationEnabled({ enabled: !!mobile, maxTouchPoints: mobile ? 5 : 0 }).catch(() => {});
    await sleep(250);
  }

  async function resetScreen() {
    await evalv(`(()=>{try{window.closeAllPanels?.();}catch(e){};try{window.closeDrawer?.();}catch(e){};document.getElementById('modalOverlay')?.classList.remove('open');return true;})()`).catch(() => {});
    await sleep(80);
  }

  async function openTab(tab) {
    await resetScreen();
    const ok = await evalv(
      `(()=>{try{window.switchTab(${JSON.stringify(tab)});return document.body.dataset.tab||'';}catch(e){return 'ERR:'+e.message}})()`
    );
    await sleep(180);
    return ok;
  }

  async function openPanel(id) {
    await evalv(
      `(()=>{try{window.openModal(${JSON.stringify(id)});return !!document.getElementById(${JSON.stringify(id)})?.classList.contains('open');}catch(e){return false;}})()`
    );
    await sleep(120);
  }

  async function openDrawer() {
    await evalv(
      `(()=>{try{window.openDrawer?.();return document.getElementById('appDrawerOverlay')?.classList.contains('is-open');}catch(e){return false;}})()`
    );
    await sleep(120);
  }

  // =====================================================================
  // R25-01 / R25-04 — collectScript injeta data-c4-audit com a chave.
  // Não inclui nodeId (não disponível no contexto do browser).
  // A associação key→nodeId é feita pós-coleta via DOM.querySelectorAll.
  // R25-04: o seletor visible() no collectScript não detecta ancestrais com
  // opacity:0; a verificação efetiva é feita no núcleo probeState().
  // =====================================================================
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

      // R25-04: computar opacidade acumulada e visibilidade dos ancestrais
      let ancestorOpacityAcc = 1;
      let ancestorHiddenAcc = false;
      let anc = el.parentElement;
      const visitedAnc = new Set();
      while (anc && anc !== document.documentElement && visitedAnc.size < 50) {
        if (visitedAnc.has(anc)) break;
        visitedAnc.add(anc);
        try {
          const acs = getComputedStyle(anc);
          if (acs.display === 'none') {
            ancestorHiddenAcc = true;
            break;
          }
          const ao = parseFloat(acs.opacity);
          if (!isNaN(ao)) ancestorOpacityAcc *= ao;
        } catch (e) {
          break;
        }
        anc = anc.parentElement;
      }
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
        accentProperty: accentResult.property,
        // R25-04: opacidade acumulada dos ancestrais e visibilidade de ancestral com display:none
        ancestorOpacity: ancestorOpacityAcc,
        ancestorHidden: ancestorHiddenAcc
      });
    }
    return {rows:arr, derivedCount: derivedCandidates.length, derivedExample: derivedCandidates.slice(0,5).map(el=>({tag:el.tagName.toLowerCase(),id:el.id||'',cls:(typeof el.className==='string'?el.className:'').slice(0,60),text:(el.innerText||'').slice(0,60)}))};
  })()`;

  // R25-02: resolver nodeIds com contrato de cardinalidade, importado do núcleo
  // Nunca escolhe arbitrariamente o primeiro elemento quando há múltiplos.
  async function resolveNodeIds(rows) {
    const map = new Map();
    for (const row of rows) {
      const key = row.key;
      if (!key) continue;
      try {
        const root = await DOM.getDocument({ depth: -1, pierce: true });
        const qs = await DOM.querySelectorAll({
          nodeId: root.root.nodeId,
          selector: `[data-c4-audit="${key}"]`
        });
        const ids = qs.nodeIds || [];
        const result = resolveNodeIdResult(ids, key, `[data-c4-audit="${key}"]`);
        map.set(key, result);
      } catch (e) {
        cdpErrors.push(makeCDPErrorRecord('DOM.querySelectorAll', e.name, e.message, {
          selector: `[data-c4-audit="${key}"]`,
        }));
        map.set(key, { status: 'cdp-error', nodeId: null, key, selector: `[data-c4-audit="${key}"]`, idCount: 0 });
      }
    }
    return map;
  }

  const result = {
    meta: {
      url: URL,
      cdpPort: CDP_PORT,
      startedAt: new Date().toISOString(),
      viewport: {},
      themes: {},
      selectors: KEY_SELECTORS,
      stateSelectors: STATE_SELECTORS,
      stateStates: STATE_STATES,
      commit: env.commit,
      branch: env.branch,
      userAgent: env.userAgent,
      platform: env.platform
    },
    rows: [],
    states: [],
    derivedCandidates: [],
    errors: { console: consoleErrors, exceptions: exceptions, cdp: cdpErrors },
    skipped: []
  };

  log('Connecting and navigating', URL);
  try {
    await navigate();

    for (const vp of [
      { name: 'mobile', w: 390, h: 844, mobile: true },
      { name: 'desktop', w: 1440, h: 900, mobile: false }
    ]) {
      await setViewport(vp.w, vp.h, vp.mobile);

      // --- Temas claros (alvo) ---
      for (const th of LIGHT) {
        log('LIGHT', th.id, th.name, vp.name);
        await evalv(`window.applyLightTheme(${JSON.stringify(th.id)}, false); true`);
        await sleep(80);

        const screens = [
          ...TABS.map(([t, l]) => ({ kind: 'tab', id: t, label: l })),
          { kind: 'drawer', id: 'drawer', label: 'Menu lateral' }
        ];
        for (const scr of screens) {
          if (scr.kind === 'tab') await openTab(scr.id); else await openDrawer();
          const raw = await evalv(collectScript);

          // R25-02: resolver nodeIds com contrato de cardinalidade
          const nodeIdMap = await resolveNodeIds(raw.rows);

          for (const c of raw.rows) {
            const assoc = nodeIdMap.get(c.key) || { status: 'node-not-found', nodeId: null, key: c.key, selector: c.sel, idCount: 0 };
            // Não gerar captura de declaração CSS para associação inválida (R25-02)
            let wr = null;
            if (assoc.status === 'resolved' && assoc.nodeId) {
              wr = await core.captureWinningRules(c, assoc.nodeId);
            } else {
              wr = {
                error: assoc.status,
                properties: {},
                association: assoc
              };
            }
            const m = measure(c);
            result.rows.push({
              vp: vp.name,
              themeSet: 'light',
              theme: th.id,
              themeName: th.name,
              screen: scr.id,
              screenLabel: scr.label,
              ...c,
              ...m,
              winningRules: wr,
              nodeAssociation: assoc
            });
          }
          result.derivedCandidates.push({
            vp: vp.name,
            themeSet: 'light',
            theme: th.id,
            themeName: th.name,
            screen: scr.id,
            screenLabel: scr.label,
            count: raw.derivedCount,
            examples: raw.derivedExample
          });
        }

        for (const pid of PANELS) {
          const exists = await evalv(`!!document.getElementById(${JSON.stringify(pid)})`);
          if (!exists) {
            result.skipped.push({ vp: vp.name, themeSet: 'light', theme: th.id, panel: pid, reason: 'missing' });
            continue;
          }
          await resetScreen();
          await openPanel(pid);
          const open = await evalv(
            `!!document.getElementById(${JSON.stringify(pid)})?.classList.contains('open')`
          );
          if (!open) {
            result.skipped.push({ vp: vp.name, themeSet: 'light', theme: th.id, panel: pid, reason: 'not-open' });
            continue;
          }
          const raw = await evalv(collectScript);

          const nodeIdMap = await resolveNodeIds(raw.rows);

          for (const c of raw.rows) {
            const assoc = nodeIdMap.get(c.key) || { status: 'node-not-found', nodeId: null, key: c.key, selector: c.sel, idCount: 0 };
            let wr = null;
            if (assoc.status === 'resolved' && assoc.nodeId) {
              wr = await core.captureWinningRules(c, assoc.nodeId);
            } else {
              wr = {
                error: assoc.status,
                properties: {},
                association: assoc
              };
            }
            const m = measure(c);
            result.rows.push({
              vp: vp.name,
              themeSet: 'light',
              theme: th.id,
              themeName: th.name,
              screen: 'panel:' + pid,
              screenLabel: pid,
              ...c,
              ...m,
              winningRules: wr,
              nodeAssociation: assoc
            });
          }
          result.derivedCandidates.push({
            vp: vp.name,
            themeSet: 'light',
            theme: th.id,
            themeName: th.name,
            screen: 'panel:' + pid,
            screenLabel: pid,
            count: raw.derivedCount,
            examples: raw.derivedExample
          });
        }
        await resetScreen();
      }

      // --- Temas escuros (controle) ---
      for (const th of DARK) {
        log('DARK', th.id, th.name, vp.name);
        await evalv(`(()=>{document.body.classList.add('dark-mode');window.applyDarkTheme(${JSON.stringify(th.id)}, false);return true})()`);
        await sleep(80);
        for (const tab of ['inicio', 'dash', 'caixa', 'invest', 'cards', 'profile']) {
          await openTab(tab);
          const raw = await evalv(collectScript);

          const nodeIdMap = await resolveNodeIds(raw.rows);

          for (const c of raw.rows) {
            const assoc = nodeIdMap.get(c.key) || { status: 'node-not-found', nodeId: null, key: c.key, selector: c.sel, idCount: 0 };
            let wr = null;
            if (assoc.status === 'resolved' && assoc.nodeId) {
              wr = await core.captureWinningRules(c, assoc.nodeId);
            } else {
              wr = {
                error: assoc.status,
                properties: {},
                association: assoc
              };
            }
            const m = measure(c);
            result.rows.push({
              vp: vp.name,
              themeSet: 'dark',
              theme: th.id,
              themeName: th.name,
              screen: tab,
              screenLabel: tab,
              ...c,
              ...m,
              winningRules: wr,
              nodeAssociation: assoc
            });
          }
        }
        await resetScreen();
        await evalv(`(()=>{document.body.classList.remove('dark-mode');return true})()`);
      }
    }

    // =====================================================================
    // R25-01 / R25-02 — Sondas de estado com sampleId único (prefixo r25)
    // themeSet explícito: 'light' (loop LIGHT), nunca inferido de th.id
    // screen incorporado ao sampleId (R25-01)
    // Registro global de sampleId do núcleo (R25-02)
    // =====================================================================
    for (const vp of [
      { name: 'mobile', w: 390, h: 844, mobile: true },
      { name: 'desktop', w: 1440, h: 900, mobile: false }
    ]) {
      await setViewport(vp.w, vp.h, vp.mobile);
      for (const th of LIGHT.filter((x) => ['3', '4', '5'].includes(x.id))) {
        // R25-01: themeSet é 'light' explícito, não inferido de th.id
        await evalv(`window.applyLightTheme(${JSON.stringify(th.id)}, false); true`);
        await sleep(60);
        for (const [tab, label] of [
          ['dash', 'Dashboard'],
          ['caixa', 'Lançamentos'],
          ['invest', 'Investimentos'],
          ['profile', 'Perfil']
        ]) {
          await openTab(tab);
          for (const s of STATE_SELECTORS) {
            for (const state of STATE_STATES) {
              // R25-01: screen (tab) incorporado ao sampleId via probeState
              // R25-02: registro global de sampleId do núcleo
              const occurrences = await core.probeState(
                s,
                state,
                vp.name,
                'light',
                th.id,
                tab,
                sampleIdRegistry
              );
              // R25-02: registrar sampleIds para detecção de duplicidade global via registro do núcleo
              for (const occ of occurrences) {
                if (occ.sampleId) sampleIdRegistry.register(occ.sampleId);
              }
              result.states.push({
                vp: vp.name,
                theme: th.id,
                themeName: th.name,
                screen: tab,
                screenLabel: label,
                sel: s,
                state,
                occurrences
              });
            }
          }
        }
        await resetScreen();
      }
    }
  } catch (err) {
    // R25-09: preservar exceção original, não ocultar por falha de limpeza
    console.error('Erro durante coleta:', err.stack || err);
    throw err;
  } finally {
    // R25-09: limpeza garantida das mutações temporárias no DOM mesmo após falha
    try {
      await evalv(`(()=>{document.querySelectorAll('[data-c4-audit]').forEach(e=>e.removeAttribute('data-c4-audit'));document.querySelectorAll('[data-c4-state]').forEach(e=>e.removeAttribute('data-c4-state'));document.getElementById('c4-audit-style')?.remove();window.applyLightTheme('1',false);return true})()`);
    } catch (cleanupErr) {
      cdpErrors.push(makeCDPErrorRecord('DOM.cleanup', cleanupErr.name, cleanupErr.message, {}));
      // Não ocultar a exceção original por causa de limpeza secundária
    }
    try {
      await client.close();
    } catch (closeErr) {
      cdpErrors.push(makeCDPErrorRecord('CDP.close', closeErr.name, closeErr.message, {}));
    }
  }

  // =====================================================================
  // R25-06 — Integridade do hash do artefato com classificação de erros CDP
  // =====================================================================
  result.meta.finishedAt = new Date().toISOString();
  result.meta.rowsCount = result.rows.length;
  result.meta.statesCount = result.states.length;
  result.meta.consoleErrors = consoleErrors.length;
  result.meta.exceptions = exceptions.length;
  result.meta.cdpErrors = cdpErrors.length;
  result.meta.skipped = result.skipped.length;
  result.meta.globalSampleIdsCount = sampleIdRegistry.size();

  // Contagem de associações por status (R25-02)
  const assocStatusCount = {};
  for (const row of result.rows) {
    if (row.nodeAssociation) {
      const st = row.nodeAssociation.status;
      assocStatusCount[st] = (assocStatusCount[st] || 0) + 1;
    }
  }
  result.meta.nodeAssociationStatus = assocStatusCount;

  const objectWithoutHash = JSON.parse(JSON.stringify(result));
  delete objectWithoutHash.meta.hash;
  delete objectWithoutHash.meta.hash16;
  const fullHash = hash(JSON.stringify(objectWithoutHash, null, 2));
  result.meta.hash = fullHash;
  result.meta.hash16 = fullHash.slice(0, 16);

  const finalText = JSON.stringify(result, null, 2);
  fs.writeFileSync(OUT, finalText);
  fs.writeFileSync(LOG, logLines.join('\\n') + '\\n');

  const writtenContent = fs.readFileSync(OUT, 'utf8');
  const writtenObj = JSON.parse(writtenContent);
  const writtenHashRecorded = writtenObj.meta.hash;
  delete writtenObj.meta.hash;
  delete writtenObj.meta.hash16;
  const writtenHashRecalculated = hash(JSON.stringify(writtenObj, null, 2));
  const hashMatches = writtenHashRecalculated === fullHash;

  log(
    'WROTE',
    OUT,
    'hash',
    fullHash,
    'hash16',
    result.meta.hash16,
    'hashMatches',
    hashMatches,
    'rows',
    result.rows.length,
    'states',
    result.states.length,
    'consoleErrors',
    consoleErrors.length,
    'exceptions',
    exceptions.length,
    'cdpErrors',
    cdpErrors.length,
    'skipped',
    result.skipped.length,
    'globalSampleIds',
    sampleIdRegistry.size(),
    'nodeAssociationStatus',
    JSON.stringify(assocStatusCount)
  );
})().catch((err) => {
  console.error('ERRO FATAL:', err.stack || err);
  process.exit(1);
});
