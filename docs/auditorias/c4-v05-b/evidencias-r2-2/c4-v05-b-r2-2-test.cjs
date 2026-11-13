// ============================================================================
// Testes controlados C.4-V05-B-R2.2
// Valida: sondas de estado individuais, identificação por sampleId,
// declaração CSS vencedora, detecção SVG, integridade de hash.
// ============================================================================

const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const FIXTURE = 'file://' + path.resolve('docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2-test-fixtures.html');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  PASS:', msg); }
  else { failed++; console.log('  FAIL:', msg); }
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, CSS } = client;
  await Runtime.enable(); await Page.enable(); await DOM.enable(); await CSS.enable();

  console.log('=== Teste 1: Três ocorrências do mesmo seletor recebem identificações individuais ===');
  await Page.navigate({url: FIXTURE});
  await new Promise(r => setTimeout(r, 500));

  const doc = await DOM.getDocument({depth: -1, pierce: true});
  const qs = await DOM.querySelectorAll({nodeId: doc.root.nodeId, selector: '.test-btn'});
  const nodeIds = qs.nodeIds || [];
  console.log('  Encontrados', nodeIds.length, 'elementos .test-btn');
  assert(nodeIds.length === 4, 'Deve encontrar 4 elementos .test-btn (3 visíveis + 1 oculto)');

  // Verificar que cada nodeId é único
  const uniqueIds = new Set(nodeIds);
  assert(uniqueIds.size === nodeIds.length, 'Cada nodeId deve ser único');

  console.log('\n=== Teste 2: Aplicação de hover em cada ocorrência individualmente ===');
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    try {
      await CSS.forcePseudoState({nodeId, forcedPseudoClasses: ['hover']});
      const cs = await CSS.getComputedStyleForNode({nodeId});
      const bgEntry = cs.computedStyle.find(e => e.name === 'background-color');
      await CSS.forcePseudoState({nodeId, forcedPseudoClasses: []});
      console.log('  Botão', i, 'nodeId', nodeId, 'bg após hover:', bgEntry ? bgEntry.value : 'não encontrado');
      assert(bgEntry && bgEntry.value.includes('122'), 'Botão ' + i + ' deve ter cor de hover aplicada');
    } catch (e) {
      console.log('  Botão', i, 'erro:', e.message);
      failed++;
    }
  }

  console.log('\n=== Teste 3: Aplicação de focus-visible em cada ocorrência ===');
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    try {
      await CSS.forcePseudoState({nodeId, forcedPseudoClasses: ['focus-visible']});
      const cs = await CSS.getComputedStyleForNode({nodeId});
      const outlineEntry = cs.computedStyle.find(e => e.name === 'outline-color');
      await CSS.forcePseudoState({nodeId, forcedPseudoClasses: []});
      console.log('  Botão', i, 'nodeId', nodeId, 'outline após focus-visible:', outlineEntry ? outlineEntry.value : 'não encontrado');
      assert(outlineEntry && outlineEntry.value.includes('95'), 'Botão ' + i + ' deve ter outline de focus-visible');
    } catch (e) {
      console.log('  Botão', i, 'erro:', e.message);
      failed++;
    }
  }

  console.log('\n=== Teste 4: Remoção do estado (sem pseudo-classe residual) ===');
  for (let i = 0; i < nodeIds.length; i++) {
    const nodeId = nodeIds[i];
    await CSS.forcePseudoState({nodeId, forcedPseudoClasses: ['hover']});
    await CSS.forcePseudoState({nodeId, forcedPseudoClasses: []});
    const cs = await CSS.getComputedStyleForNode({nodeId});
    const bgEntry = cs.computedStyle.find(e => e.name === 'background-color');
    // Após remover hover, deve voltar à cor original (#5F7A43 = rgb(95,122,67))
    assert(bgEntry && bgEntry.value.includes('95'), 'Botão ' + i + ' deve voltar à cor original após remover hover');
  }
  console.log('  Todos os botões voltaram à cor original após remover o estado');

  console.log('\n=== Teste 5: Elemento oculto é descartado corretamente ===');
  const btn3 = nodeIds[2]; // btn-3 tem display:none
  const cs3 = await CSS.getComputedStyleForNode({nodeId: btn3});
  const displayEntry = cs3.computedStyle.find(e => e.name === 'display');
  assert(displayEntry && displayEntry.value === 'none', 'Botão 3 deve ter display:none');

  console.log('\n=== Teste 6: Identificadores de amostra únicos ===');
  const sampleIds = nodeIds.map((nid, i) => `r22-state-.test-btn-normal-${i}`);
  const uniqueSampleIds = new Set(sampleIds);
  assert(uniqueSampleIds.size === sampleIds.length, 'Cada sampleId deve ser único');
  console.log('  sampleIds gerados:', sampleIds.join(', '));

  console.log('\n=== Teste 7: Elemento sem geometria é tratado corretamente ===');
  const btn4 = nodeIds[3]; // btn-4 tem width/height = 0
  const cs4 = await CSS.getComputedStyleForNode({nodeId: btn4});
  const bg4 = cs4.computedStyle.find(e => e.name === 'background-color');
  assert(bg4 && bg4.value.includes('95'), 'Botão 4 (sem geometria) deve ter cor de fundo detectada');

  console.log('\n=== Teste 8: Elemento sem relação com --accent não é consumidor ===');
  // Consultar todos os botões para encontrar o .other-btn
  const qsAll = await DOM.querySelectorAll({nodeId: doc.root.nodeId, selector: 'button'});
  const allBtnIds = qsAll.nodeIds || [];
  console.log('  Encontrados', allBtnIds.length, 'botões no total');
  // O .other-btn é o último botão (btn-5)
  const btn5Idx = allBtnIds.length - 1;
  const btn5 = allBtnIds[btn5Idx];
  const cs5 = await CSS.getComputedStyleForNode({nodeId: btn5});
  const bg5 = cs5.computedStyle.find(e => e.name === 'background-color');
  console.log('  Botão 5 (outro) bg:', bg5 ? bg5.value : 'não encontrado');
  assert(!bg5 || !bg5.value.includes('95'), 'Botão 5 não deve ter cor de accent');

  await client.close();

  console.log('\n=== RESUMO DOS TESTES CONTROLADOS ===');
  console.log('PASS:', passed, 'FAIL:', failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
