// C.4 - Validacao controlada do harness na aplicacao real
// Versao: minimal sample validation with CDP CSS.getComputedStyleForNode
// Apenas selecao de 16 elementos representativos + isAccentConsumer
// Sem alteracao de CSS de producao
// Sem coleta completa

const CDP = require('chrome-remote-interface');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = '/data/data/com.termux/files/home/LIVRO-CAIXA';

async function main() {
  let client;
  const results = [];
  
  try {
    client = await CDP({ port: 9222 });
    const { Page, DOM, CSS, Runtime, console } = client;
    
    await Runtime.enable();
    await Page.enable();
    await DOM.enable();
    await CSS.enable();
    
    // Navegar ate a aplicacao
    await Page.navigate({ url: 'http://127.0.0.1:8000/index.html' });
    await new Promise(r => setTimeout(r, 2000));
    
    // Get document e construir mapa de elementos
    const doc = await DOM.getDocument({ depth: -1, pierce: true });
    
    const elementMap = {};
    function buildMap(nodes) {
      for (const node of nodes) {
        if (node.nodeType === 1 && node.id) {
          elementMap[node.id] = node;
        }
        if (node.childNodes && node.childNodes.length) {
          buildMap(node.childNodes);
        }
      }
    }
    buildMap([doc]);
    
    // Import core functions
    const CORE_PATH = `${PROJECT_ROOT}/docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs`;
    const core = require(CORE_PATH);
    const { parseColor, comp, lum, min, makeSampleId, makeCDPErrorRecord } = core;
    
    // Get accent value via CDP CSS.getComputedStyleForNode on body
    const bodyNode = await DOM.querySelector({ nodeId: doc.root.nodeId, selector: 'body' });
    const csBody = await CSS.getComputedStyleForNode({ nodeId: bodyNode.nodeId });
    const accentRaw = csBody.style.color || csBody.style.getPropertyValue('--accent');
    console.log('Accent value:', accentRaw);
    
    // Helper: get computed style for any element via CDP
    const getComputedStyle = async (nodeId, prop) => {
      const cs = await CSS.getComputedStyleForNode({ nodeId });
      if (prop) {
        // Try to get the property value from style declaration
        const style = cs.computedStyle;
        const propValue = style[prop] || style.getPropertyValue(prop);
        return propValue;
      }
      return cs;
    };
    
    // R25.7: run counter
    const RUN_COUNTER_KEY = '__c4AuditRunCounter';
    if (typeof window[RUN_COUNTER_KEY] !== 'number') window[RUN_COUNTER_KEY] = 0;
    const runId = ++window[RUN_COUNTER_KEY];
    
    console.log('Run ID:', runId);
    
    // Select sample elements from the actual rendered DOM
    const selected = [];
    
    // Helper to find element by id from the document
    const getElById = id => elementMap[id];
    
    // 1. r25-btn-1: .r25-unique - direct color consumer (color: var(--accent))
    let el = getElById('r25-btn-1');
    if (el) { selected.push({id: 'r25-btn-1', el, tag: el.tagName.toLowerCase(), selector: '.r25-unique'}); }
    
    // 2. r25-btn-2: .r25-hidden - display:none
    el = getElById('r25-btn-2');
    if (el) { selected.push({id: 'r25-btn-2', el, tag: el.tagName.toLowerCase(), selector: '.r25-hidden', hidden: true}); }
    
    // 3. r25-btn-3: .r25-vishidden - visibility:hidden
    el = getElById('r25-btn-3');
    if (el) { selected.push({id: 'r25-btn-3', el, tag: el.tagName.toLowerCase(), selector: '.r25-vishidden'}); }
    
    // 4. r25-btn-4: .r25-opacity0 - opacity:0
    el = getElById('r25-btn-4');
    if (el) { selected.push({id: 'r25-btn-4', el, tag: el.tagName.toLowerCase(), selector: '.r25-opacity0'}); }
    
    // 5. r25-btn-5: .r25-no-dim - zero dimensions
    el = getElById('r25-btn-5');
    if (el) { selected.push({id: 'r25-btn-5', el, tag: el.tagName.toLowerCase(), selector: '.r25-no-dim'}); }
    
    // 6. r25-btn-6: .r25-border-high - border color consumer
    el = getElById('r25-btn-6');
    if (el) { selected.push({id: 'r25-btn-6', el, tag: el.tagName.toLowerCase(), selector: '.r25-border-high'}); }
    
    // 7. r25-btn-7: .r25-border-low - low contrast border
    el = getElById('r25-btn-7');
    if (el) { selected.push({id: 'r25-btn-7', el, tag: el.tagName.toLowerCase(), selector: '.r25-border-low'}); }
    
    // 8. r25-btn-9: .r25-focus-outline - outline color consumer
    el = getElById('r25-btn-9');
    if (el) { selected.push({id: 'r25-btn-9', el, tag: el.tagName.toLowerCase(), selector: '.r25-focus-outline'}); }
    
    // 9. r25-btn-10: .r25-hover - hover state
    el = getElById('r25-btn-10');
    if (el) { selected.push({id: 'r25-btn-10', el, tag: el.tagName.toLowerCase(), selector: '.r25-hover'}); }
    
    // 10. r25-btn-11: .r25-focus - focus state
    el = getElById('r25-btn-11');
    if (el) { selected.push({id: 'r25-btn-11', el, tag: el.tagName.toLowerCase(), selector: '.r25-focus'}); }
    
    // 11. r25-btn-17: .r25-svg-fill - SVG fill consumer
    el = getElById('r25-btn-17');
    if (el) { selected.push({id: 'r25-btn-17', el, tag: el.tagName.toLowerCase(), selector: '.r25-svg-fill'}); }
    
    // 12. r25-btn-18: .r25-svg-stroke - SVG stroke consumer
    el = getElById('r25-btn-18');
    if (el) { selected.push({id: 'r25-btn-18', el, tag: el.tagName.toLowerCase(), selector: '.r25-svg-stroke'}); }
    
    // 13. r25-btn-19: .r25-currentcolor - currentColor + color: var(--accent)
    el = getElById('r25-btn-19');
    if (el) { selected.push({id: 'r25-btn-19', el, tag: el.tagName.toLowerCase(), selector: '.r25-currentcolor'}); }
    
    // 14. r25-btn-20: .r25-other - no accent consumption
    el = getElById('r25-btn-20');
    if (el) { selected.push({id: 'r25-btn-20', el, tag: el.tagName.toLowerCase(), selector: '.r25-other'}); }
    
    // 15. r25-btn-13: .r25-important - !important with black
    el = getElById('r25-btn-13');
    if (el) { selected.push({id: 'r25-btn-13', el, tag: el.tagName.toLowerCase(), selector: '.r25-important'}); }
    
    // 16. r25-btn-14: .r25-inline - inline style
    el = getElById('r25-btn-14');
    if (el) { selected.push({id: 'r25-btn-14', el, tag: el.tagName.toLowerCase(), selector: '.r25-inline'}); }
    
    console.log('\nSelected elements for C.4 validation:');
    console.log('========================================');
    
    // Process each selected element
    let passCount = 0, failCount = 0, blockedCount = 0;
    
    // Helper: check if element consumes --accent via CDP
    const isAccentConsumerCDP = async el => {
      const cs = await getComputedStyle(el.nodeId);
      const exact = (a,b) => {
        const A=parseColor(a), B=parseColor(b); if(!A||!B) return false;
        return Math.abs(A.r-B.r)<.5 && Math.abs(A.g-B.g)<.5 && Math.abs(A.b-B.b)<.5 && Math.abs(A.a-B.a)<.01;
      };
      
      if (exact(cs.color,accentRaw)) return {consumed:true, property:'color'};
      if (exact(cs.backgroundColor,accentRaw)) return {consumed:true, property:'backgroundColor'};
      if (parseFloat(cs.borderTopWidth)>0 && cs.borderTopStyle!=='none' && exact(cs.borderTopColor,accentRaw)) return {consumed:true, property:'borderTopColor'};
      if (parseFloat(cs.outlineWidth)>0 && cs.outlineStyle!=='none' && exact(cs.outlineColor,accentRaw)) return {consumed:true, property:'outlineColor'};
      return {consumed:false, property:null};
    };
    
    // Helper: visibility check
    const visible = async el => {
      const cs = await getComputedStyle(el.nodeId);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false;
      const rect = await DOM.getBoxModel({ nodeId: el.nodeId });
      return rect.model.width>0 && rect.model.height>0;
    };
    
    // Helper: derived candidate check
    const isDerivedCandidate = el => {
      const cls=(typeof el.className==='string'?el.className:'')+' '+(el.id||'');
      return DERIVED_HINTS.test(cls) && false; // will be checked per-element
    };
    
    const DERIVED_HINTS = /\b(primary|fab-add|feature-profile-switch|dash-segmented-pill|dash-part-mini-bar|circle|toggle-active|action-delete|surface-accent)\b/;
    
    // Process each selected element
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      const el = item.el;
      
      try {
        // Check accent consumption via CDP
        const result = await isAccentConsumerCDP(el);
        const consumed = result.consumed;
        const prop = result.property;
        
        // Visibility
        const vis = await visible(el);
        
        // Derived candidate
        const cls = (typeof el.className === 'string' ? el.className : '').trim().split(/\\s+/).filter(Boolean).slice(0,3).map(c=>'.'+c).join('');
        const derived = DERIVED_HINTS.test((typeof el.className === 'string' ? el.className : '')+' '+(el.id||'')) && !consumed;
        
        const tag = el.tagName.toLowerCase();
        const id = el.id || '';
        const text = (el.innerText || '').replace(/\\s+/g,' ').trim().slice(0,80);
        
        const record = {
          key: 'c4-' + runId + '-' + i,
          sel: item.selector || (id||cls||tag),
          tag,
          id,
          cls,
          text,
          exactAccent: consumed,
          derivedAccent: derived,
          visibility: vis ? 'visible' : 'hidden',
          consumed,
          property: prop,
          nodeId: el.nodeId ? 'node:' + el.nodeId : 'unknown',
          runId,
          sampleIdx: i
        };
        
        results.push(record);
        
        // Console output
        const status = consumed ? 'PASS (accent consumer)' : (derived ? 'DERIVED (hint but no accent)' : 'NO (not accent consumer)');
        console.log(`[${i}] ${item.id}: ${status} | vis=${vis? 'VISIBLE':'HIDDEN'} | tag=${tag} | prop=${prop||'none'}`);
        
        if (consumed) passCount++;
        else if (derived) { /* */ }
        else failCount++;
        
      } catch(e) {
        console.log(`[${i}] ${item.id}: ERROR ${e.message}`);
        blockedCount++;
      }
    }
    
    console.log('\n=== C.4 VALIDATION SUMMARY ===');
    console.log('Total selected:', selected.length);
    console.log('PASS (accent consumers):', passCount);
    console.log('FAIL (non-consumers):', failCount);
    console.log('BLOCKED:', blockedCount);
    console.log('========================================');
    
    // Write results to file
    const output = {
      meta: {
        version: 'C.4-control',
        runId: runId,
        selectedCount: selected.length,
        timestamp: new Date().toISOString(),
        platform: 'android (Termux/Android)',
        browser: 'Chromium 156 headless (CDP)',
        accentRaw
      },
      summary: {
        total: results.length,
        pass: passCount,
        fail: failCount,
        blocked: blockedCount
      },
      results: results
    };
    
    const outPath = `${PROJECT_ROOT}/tmp-c13/c4-control-validacao-results.json`;
    fs.mkdirSync(`${PROJECT_ROOT}/tmp-c13`, { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log('\nResults written to:', outPath);
    
  } catch(e) {
    console.error('FATAL ERROR:', e.message);
    console.error(e.stack);
  } finally {
    if (client) {
      try { client._ws.close(); } catch(e) {}
      try { client.detach(); } catch(e) {}
    }
  }
}

main();
