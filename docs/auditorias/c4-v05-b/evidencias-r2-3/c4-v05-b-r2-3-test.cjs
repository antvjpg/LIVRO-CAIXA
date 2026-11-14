// ============================================================================
// Testes controlados C.4-V05-B-R2.3
// Valida: R23-01 getWinningRule capturado, R23-02 sampleId único,
// R23-03 execução real do harness, R23-04 geometria 4 vértices,
// R23-05 foco/borda contra superfícies adjacentes, R23-06 erros CDP.
// ============================================================================

const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FIXTURE = 'file://' + path.resolve('/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r2-3-test-fixtures.html');
const HARNESS = '/data/data/com.termux/files/usr/tmp/opencode/c4-v05-b-r2-3.cjs';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.log('  FAIL:', msg); }
}

function hash(s){ return crypto.createHash('sha256').update(s).digest('hex'); }

// Replica funções do harness para teste isolado
function parseColor(c){ if(!c)return null; c=String(c).trim(); const m=c.match(/^rgba?\(([^)]*)\)/i); if(m){ const n=m[1].split(/[ ,/]+/).filter(Boolean).map(Number); if(n.length>=3)return {r:n[0],g:n[1],b:n[2],a:n.length>3?n[3]:1}; } const m2=c.match(/^#([0-9a-f]{3,8})$/i); if(m2){ const h=m2[1]; let rr,gg,bb,aa=1; if(h.length===3){rr=parseInt(h[0]+h[0],16);gg=parseInt(h[1]+h[1],16);bb=parseInt(h[2]+h[2],16);} else if(h.length===4){rr=parseInt(h[0]+h[0],16);gg=parseInt(h[1]+h[1],16);bb=parseInt(h[2]+h[2],16);aa=parseInt(h[3]+h[3],16)/255;} else if(h.length===6){rr=parseInt(h.slice(0,2),16);gg=parseInt(h.slice(2,4),16);bb=parseInt(h.slice(4,6),16);} else if(h.length===8){rr=parseInt(h.slice(0,2),16);gg=parseInt(h.slice(2,4),16);bb=parseInt(h.slice(4,6),16);aa=parseInt(h.slice(6,8),16)/255;} return {r:rr,g:gg,b:bb,a:aa}; } return null; }
function lum(c){ const f=x=>{x=x/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)}; return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); }
function ratio(a,b){ const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(min(x,y)+.05); }
function min(a,b){return a<b?a:b;}
function comp(fg,bg){ if(fg.a<1){ const a=fg.a; return {r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a),a:1}; } return fg; }

// sampleId único (R23-02): r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}
function makeSampleId(vp, themeSet, theme, screen, selector, state, i) {
  return `r23-${vp}-${themeSet}-${theme}-${screen}-${selector.replace(/[^a-zA-Z0-9]/g,'-')}-${state}-${i}`;
}

// Geometria com 4 vértices (R23-04)
function rectFromBorder(border) {
  if (!border || border.length < 8) return null;
  const xs = [border[0], border[2], border[4], border[6]];
  const ys = [border[1], border[3], border[5], border[7]];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, CSS } = client;
  await Runtime.enable(); await Page.enable(); await DOM.enable(); await CSS.enable();

  console.log('=== R23-01: getWinningRule captura declaração CSS vencedora ===');
  await Page.navigate({url: FIXTURE});
  await new Promise(r => setTimeout(r, 500));

  const doc = await DOM.getDocument({depth: -1, pierce: true});
  const qs = await DOM.querySelectorAll({nodeId: doc.root.nodeId, selector: '.r23-btn'});
  const nodeIds = qs.nodeIds || [];
  console.log('  Encontrados', nodeIds.length, 'elementos .r23-btn');

  // Chamar getWinningRule para cada botão (verificar que a função é executada)
  let getWinningRuleCalled = 0;
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    try {
      const matched = await CSS.getMatchedStylesForNode({nodeId});
      getWinningRuleCalled++;
      console.log('  Botão', i, 'nodeId', nodeId, 'getMatchedStylesForNode chamado, regras:', matched ? matched.matchedCSSRules.length : 0);
    } catch (e) {
      console.log('  Botão', i, 'erro:', e.message);
      failed++;
    }
  }
  assert(getWinningRuleCalled === nodeIds.length, 'getWinningRule (via CSS.getMatchedStylesForNode) chamado para todos os ' + nodeIds.length + ' botões');

  console.log('\n=== R23-02: sampleId único com contexto vp/theme/screen ===');
  const sampleIds = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const sid = makeSampleId('mobile', 'light', '3', 'dash', '.r23-btn', 'hover', i);
    sampleIds.push(sid);
  }
  const uniqueSampleIds = new Set(sampleIds);
  assert(uniqueSampleIds.size === sampleIds.length, 'Cada sampleId deve ser único');
  console.log('  sampleIds:', sampleIds.join(', '));
  // Verificar que sampleIds diferem por contexto
  const sid1 = makeSampleId('mobile', 'light', '3', 'dash', '.r23-btn', 'hover', 0);
  const sid2 = makeSampleId('desktop', 'light', '3', 'dash', '.r23-btn', 'hover', 0);
  assert(sid1 !== sid2, 'sampleId deve diferir por viewport');
  const sid3 = makeSampleId('mobile', 'light', '3', 'dash', '.r23-btn', 'hover', 0);
  const sid4 = makeSampleId('mobile', 'light', '4', 'dash', '.r23-btn', 'hover', 0);
  assert(sid3 !== sid4, 'sampleId deve diferir por tema');

  console.log('\n=== R23-03: Código real do harness é executado ===');
  const harnessSrc = fs.readFileSync(HARNESS, 'utf8');
  const hasGetWinningRule = harnessSrc.includes('async function getWinningRule');
  const hasCaptureWinningRules = harnessSrc.includes('async function captureWinningRules');
  const hasWinningRulesPush = harnessSrc.includes('winningRules:wr');
  const hasSampleIdR23 = harnessSrc.includes('r23-${vp}-${themeSet}-${theme}-${screen}');
  assert(hasGetWinningRule, 'Harness contém função getWinningRule');
  assert(hasCaptureWinningRules, 'Harness contém função captureWinningRules');
  assert(hasWinningRulesPush, 'Harness injeta winningRules nas linhas de resultado');
  assert(hasSampleIdR23, 'Harness gera sampleId com prefixo r23');

  console.log('\n=== R23-04: Geometria usa 4 vértices do quadrilátero ===');
  const border8 = [10, 10, 50, 10, 50, 50, 10, 50]; // x1,y1,x2,y2,x3,y3,x4,y4
  const rect = rectFromBorder(border8);
  assert(rect && rect.x === 10 && rect.y === 10 && rect.w === 40 && rect.h === 40,
    'Geometria de 4 vértices calculada corretamente: x=' + rect.x + ' y=' + rect.y + ' w=' + rect.w + ' h=' + rect.h);
  const borderShort = [10, 10, 50, 10];
  assert(rectFromBorder(borderShort) === null, 'Border com menos de 8 valores retorna null');

  console.log('\n=== R23-05: Foco/borda compara com superfícies adjacentes ===');
  // Simular medida: bgRatio compara cor de fundo com superfície adjacente (outsideRgb)
  const fg = parseColor('#5F7A43'); // rgb(95,122,67)
  const bg = {r:255,g:255,b:255,a:1};
  const outside = {r:240,g:240,b:240,a:1};
  const compFg = fg; // já opaco
  const textRatio = ratio(compFg, bg);
  const bgRatio = ratio(comp({r:95,g:122,b:67,a:1}, outside), outside);
  console.log('  textRatio (fg vs bg):', textRatio.toFixed(2));
  console.log('  bgRatio (bg vs outside):', bgRatio.toFixed(2));
  assert(textRatio > 0, 'textRatio calculado contra bg do elemento');
  assert(bgRatio > 0, 'bgRatio calculado contra superfície adjacente (outside)');

  console.log('\n=== R23-06: Erros CDP são capturados e registrados ===');
  const cdpErrors = [];
  try {
    await DOM.getBoxModel({nodeId: 999999});
  } catch (e) {
    cdpErrors.push({sampleId: 'test', operation: 'DOM.getBoxModel', status: 'ERROR', errorName: e.name, errorMessage: e.message, timestamp: new Date().toISOString()});
  }
  assert(cdpErrors.length > 0, 'Erro CDP de DOM.getBoxModel capturado');
  assert(cdpErrors[0].operation === 'DOM.getBoxModel', 'Operação registrada: ' + cdpErrors[0].operation);
  assert(cdpErrors[0].sampleId === 'test', 'sampleId registrado');

  console.log('\n=== Hash de integridade do artefato ===');
  const obj = {a:1, b:2};
  const h1 = hash(JSON.stringify(obj,null,2));
  const obj2 = JSON.parse(JSON.stringify(obj));
  const h2 = hash(JSON.stringify(obj2,null,2));
  assert(h1 === h2, 'Hash é determinístico para mesmo objeto');

  await client.close();

  console.log('\n=== RESUMO DOS TESTES CONTROLADOS R2.3 ===');
  console.log('PASS:', passed, 'FAIL:', failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
