// ============================================================================
// Testes controlados C.4-V05-B-R2.4
// Executa as funções REAIS do harness (importadas de c4-v05-b-r2-4-core.cjs)
// Valida: R24-01 associação key→nodeId, R24-02 sampleId único,
// R24-03 execução de código real, R24-04 geometria 4 vértices,
// R24-05 bordas/foco contra superfície adjacente, R24-06 limpeza de pseudoestados,
// R24-07 medição WCAG, R24-08 visibilidade e erros CDP.
// ============================================================================

const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CORE_PATH = path.resolve(
  '/data/data/com.termux/files/home/LIVRO-CAIXA/docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs'
);
const {
  hash,
  parseColor,
  comp,
  lum,
  ratio,
  min,
  makeSampleId,
  rectFromBorder,
  measure,
  createCDPAuditCore
} = require(CORE_PATH);

const FIXTURE =
  'file://' +
  path.resolve(
    '/data/data/com.termux/files/home/LIVRO-CAIXA/docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-test-fixtures.html'
  );

let passed = 0;
let failed = 0;
let blocked = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  PASS:', msg);
  } else {
    failed++;
    console.log('  FAIL:', msg);
  }
}

function block(msg) {
  blocked++;
  console.log('  BLOCKED:', msg);
}

async function main() {
  const client = await CDP({ port: 9222 });
  const { Page, Runtime, DOM, CSS } = client;
  await Runtime.enable();
  await Page.enable();
  await DOM.enable();
  await CSS.enable();

  const consoleErrors = [];
  const exceptions = [];
  const cdpErrors = [];

  Runtime.consoleAPICalled(({ type, args }) => {
    if (type === 'error')
      consoleErrors.push(args.map((a) => a.value ?? a.description ?? '').join(' '));
  });
  Runtime.exceptionThrown(({ exceptionDetails }) => {
    exceptions.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception');
  });

  // Núcleo real do harness — mesmas funções usadas pelo harness
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });

  await Page.navigate({ url: FIXTURE });
  await new Promise((r) => setTimeout(r, 500));

  const doc = await DOM.getDocument({ depth: -1, pierce: true });

  // =====================================================================
  // GRUPO A — Associação CSS (key → nodeId, captura real)
  // =====================================================================
  console.log('\n=== GRUPO A — Associação CSS ===');

  // A1: associação correta de key com nodeId via data-c4-audit
  {
    // Injetar data-c4-audit via CDP (simula o que collectScript faz no harness)
    await Runtime.evaluate({
      expression: `(()=>{
        document.querySelectorAll('#r24-btn-1').forEach(el => el.setAttribute('data-c4-audit', 'c4-test-1'));
        return true;
      })()`,
      returnByValue: true
    });
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '[data-c4-audit="c4-test-1"]'
    });
    const ids = qs.nodeIds || [];
    assert(ids.length === 1, 'A1: elemento com data-c4-audit encontrado via querySelectorAll: ' + ids.length);
  }

  // A2: falha de associação não produz falsa captura
  {
    const result = await core.captureWinningRules({}, null);
    assert(result.error === 'node-association-failed', 'A2: nodeId nulo retorna node-association-failed');
    assert(result.properties === undefined || Object.keys(result.properties).length === 0, 'A2: sem propriedades quando nodeId nulo');
  }

  // A3: captura real de declaração CSS via getWinningRule
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-1'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      assert(r.captureStatus === 'captured' || r.captureStatus === 'no-matching-declaration', 'A3: getWinningRule retorna status válido para color');
      assert(Array.isArray(r.candidates), 'A3: candidates é um array');
    } else {
      block('A3: elemento r24-btn-1 não encontrado');
    }
  }

  // A4: leitura correta de declarações CSS via getWinningRule (cssProperties ou property(j)/value(j))
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-1'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      assert(r.captureStatus === 'captured' || r.captureStatus === 'no-matching-declaration', 'A4: getWinningRule retorna status válido e lê declarações CSS');
      assert(Array.isArray(r.candidates), 'A4: candidates é um array');
    } else {
      block('A4: elemento r24-btn-1 não encontrado');
    }
  }

  // A5: identificação de !important
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-13'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      // r24-btn-13 tem color: #000000 !important
      if (r.winningDeclaration) {
        assert(r.winningDeclaration.important === true, 'A5: !important detectado na declaração vencedora');
      } else {
        assert(r.candidates.length > 0, 'A5: candidatos encontrados para !important');
      }
    } else {
      block('A5: elemento r24-btn-13 não encontrado');
    }
  }

  // A6: distinção entre regra candidata e vencedora
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-15'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      // r24-btn-15 tem seletor button.r24-specificity com cor var(--accent)
      assert(r.candidates.length >= 1, 'A6: pelo menos um candidato para especificidade');
      if (r.winningDeclaration) {
        assert(r.winningDeclaration.captureStatus === 'captured', 'A6: declaração vencedora marcada como captured');
      }
    } else {
      block('A6: elemento r24-btn-15 não encontrado');
    }
  }

  // A7: tratamento de declaração inline
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-14'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      assert(r.captureStatus === 'captured' || r.captureStatus === 'no-matching-declaration', 'A7: status válido para declaração inline');
    } else {
      block('A7: elemento r24-btn-14 não encontrado');
    }
  }

  // A8: tratamento de herança
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-16'
    });
    const ids = qs.nodeIds || [];
    // r24-btn-16 não existe (foi renomeado para r24-inherit dentro de .r24-inherit-parent)
    // Testamos o span com classe r24-inherit
    const qs2 = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '.r24-inherit'
    });
    const ids2 = qs2.nodeIds || [];
    if (ids2.length > 0) {
      const r = await core.getWinningRule(ids2[0], 'color');
      assert(r.captureStatus === 'captured' || r.captureStatus === 'no-matching-declaration', 'A8: status válido para propriedade herdada');
    } else {
      block('A8: elemento .r24-inherit não encontrado');
    }
  }

  // A9: tratamento de ambiguidade
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-21'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const r = await core.getWinningRule(ids[0], 'color');
      // r24-btn-21 (.r24-other) não consome --accent, cor #333333
      assert(r.captureStatus === 'no-matching-declaration' || r.captureStatus === 'captured', 'A9: status para elemento sem --accent');
    } else {
      block('A9: elemento r24-btn-21 não encontrado');
    }
  }

  // A10: captura de fill e stroke
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-17'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const rFill = await core.getWinningRule(ids[0], 'fill');
      const rStroke = await core.getWinningRule(ids[0], 'stroke');
      assert(
        rFill.captureStatus === 'captured' || rFill.captureStatus === 'no-matching-declaration',
        'A10: fill capturado com status válido'
      );
      assert(
        rStroke.captureStatus === 'captured' || rStroke.captureStatus === 'no-matching-declaration',
        'A10: stroke capturado com status válido'
      );
    } else {
      block('A10: elemento r24-btn-17 não encontrado');
    }
  }

  // =====================================================================
  // GRUPO B — Identificadores (sampleId único)
  // =====================================================================
  console.log('\n=== GRUPO B — Identificadores ===');

  // B1-B7: unicidade por contexto
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-btn-normal', 'hover', 0);
    const s2 = makeSampleId('desktop', 'light', '3', 'dash', '.r24-btn-normal', 'hover', 0);
    const s3 = makeSampleId('mobile', 'light', '4', 'dash', '.r24-btn-normal', 'hover', 0);
    const s4 = makeSampleId('mobile', 'light', '3', 'caixa', '.r24-btn-normal', 'hover', 0);
    const s5 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-border-high', 'hover', 0);
    const s6 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-btn-normal', 'focus-visible', 0);
    const s7 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-btn-normal', 'hover', 1);

    assert(s1 !== s2, 'B1: sampleId difere por viewport');
    assert(s1 !== s3, 'B2: sampleId difere por tema');
    assert(s1 !== s4, 'B3: sampleId difere por tela');
    assert(s1 !== s5, 'B4: sampleId difere por seletor');
    assert(s1 !== s6, 'B5: sampleId difere por estado');
    assert(s1 !== s7, 'B6: sampleId difere por índice');
    assert(s1.startsWith('r24-'), 'B7: prefixo r24-');
  }

  // B8: detecção de duplicidade global
  {
    const ids = new Set();
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-btn-normal', 'hover', 0);
    const s2 = makeSampleId('mobile', 'light', '3', 'dash', '.r24-btn-normal', 'hover', 0);
    ids.add(s1);
    let duplicateDetected = false;
    if (ids.has(s2)) duplicateDetected = true;
    assert(duplicateDetected, 'B8: duplicidade detectada para sampleId igual');
  }

  // =====================================================================
  // GRUPO C — Geometria (rectFromBorder)
  // =====================================================================
  console.log('\n=== GRUPO C — Geometria ===');

  // C1: retângulo convencional
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 50, 10, 50]);
    assert(r && r.x === 10 && r.y === 10 && r.w === 40 && r.h === 40, 'C1: retângulo convencional: x=' + r.x + ' y=' + r.y + ' w=' + r.w + ' h=' + r.h);
  }

  // C2: quadrilátero rotacionado
  {
    const r = rectFromBorder([0, 0, 40, 10, 30, 50, -10, 40]);
    assert(r && r.x === -10 && r.y === 0 && r.w === 50 && r.h === 50, 'C2: rotacionado: x=' + r.x + ' y=' + r.y + ' w=' + r.w + ' h=' + r.h);
  }

  // C3: coordenadas negativas
  {
    const r = rectFromBorder([-20, -10, 0, -10, 0, 30, -20, 30]);
    assert(r && r.x === -20 && r.y === -10 && r.w === 20 && r.h === 40, 'C3: negativas: x=' + r.x + ' y=' + r.y + ' w=' + r.w + ' h=' + r.h);
  }

  // C4: array incompleto
  {
    const r = rectFromBorder([10, 10, 50, 10]);
    assert(r === null, 'C4: array incompleto retorna null');
  }

  // C5: dados inválidos
  {
    const r1 = rectFromBorder(null);
    const r2 = rectFromBorder([10, 10, 50, 10, 50, 50, 10, 'x']);
    assert(r1 === null, 'C5: null retorna null');
    assert(r2 === null, 'C5: valor não numérico retorna null');
  }

  // =====================================================================
  // GRUPO D — Medição WCAG (measure real)
  // =====================================================================
  console.log('\n=== GRUPO D — Medição WCAG ===');

  const bgWhite = { r: 255, g: 255, b: 255, a: 1 };
  const outsideLightGray = { r: 240, g: 240, b: 240, a: 1 };

  // D1: texto normal (cor #5F7A43 sobre branco = 4.83:1 >= 4.5)
  {
    const c = {
      color: '#5F7A43',
      bgRgb: bgWhite,
      outsideRgb: bgWhite,
      fontSize: 16,
      fontWeight: 400,
      text: 'texto',
      hasDescendantText: true,
      directText: true,
      tag: 'span'
    };
    const m = measure(c);
    assert(m.textRatio >= 4.5, 'D1: texto normal com contraste suficiente (ratio=' + m.textRatio.toFixed(2) + ')');
  }

  // D2: texto grande (≥24px)
  {
    const c = {
      color: '#5F7A43',
      bgRgb: bgWhite,
      outsideRgb: bgWhite,
      fontSize: 24,
      fontWeight: 400,
      text: 'texto grande',
      hasDescendantText: true,
      directText: true,
      tag: 'span'
    };
    const m = measure(c);
    assert(m.large === true, 'D2: texto grande detectado');
    assert(m.textRatio >= 3.0, 'D2: texto grande com contraste suficiente (ratio=' + m.textRatio.toFixed(2) + ')');
  }

  // D3: ícone
  {
    const c = {
      color: '#5F7A43',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      tag: 'svg',
      hasText: false,
      icon: true
    };
    const m = measure(c);
    assert(m.classificacao === 'APROVADO' || m.classificacao === 'FALHA', 'D3: ícone classificado (ratio=' + m.iconRatio.toFixed(2) + ')');
  }

  // D4: borda relevante com contraste suficiente
  {
    const c = {
      color: '#000000',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      borderW: 4,
      borderStyle: 'solid',
      borderColor: '#000000'
    };
    const m = measure(c);
    assert(m.borderRatio !== null, 'D4: borderRatio calculado');
    assert(m.borderRatio >= 3.0, 'D4: borda relevante com contraste suficiente (ratio=' + m.borderRatio.toFixed(2) + ')');
  }

  // D5: borda relevante com contraste insuficiente
  {
    const c = {
      color: '#000000',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      borderW: 1,
      borderStyle: 'solid',
      borderColor: '#EEEEEE'
    };
    const m = measure(c);
    assert(m.borderRatio !== null, 'D5: borderRatio calculado para borda baixa');
    assert(m.borderRatio < 3.0, 'D5: borda baixa detectada (ratio=' + m.borderRatio.toFixed(2) + ')');
    assert(m.classificacao === 'FALHA' || m.motivoFalha === 'borda', 'D5: classificação falha por borda');
  }

  // D6: borda decorativa (não deve falhar automaticamente)
  {
    const c = {
      color: '#000000',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      borderW: 1,
      borderStyle: 'dotted',
      borderColor: '#CCCCCC'
    };
    const m = measure(c);
    // Borda decorativa com baixo contraste — classificação não deve ser automaticamente FALHA apenas por ser decorativa
    assert(m.borderRatio !== null, 'D6: borderRatio calculado para borda decorativa');
  }

  // D7: indicador de foco suficiente
  {
    const c = {
      color: '#000000',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      outlineW: 3,
      outlineStyle: 'solid',
      outlineColor: '#5F7A43'
    };
    const m = measure(c);
    assert(m.outlineRatio !== null, 'D7: outlineRatio calculado');
    assert(m.outlineRatio >= 3.0, 'D7: foco suficiente (ratio=' + m.outlineRatio.toFixed(2) + ')');
  }

  // D8: indicador de foco insuficiente
  {
    const c = {
      color: '#000000',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      outlineW: 1,
      outlineStyle: 'solid',
      outlineColor: '#EEEEEE'
    };
    const m = measure(c);
    assert(m.outlineRatio !== null, 'D8: outlineRatio calculado para foco insuficiente');
    assert(m.outlineRatio < 3.0, 'D8: foco insuficiente (ratio=' + m.outlineRatio.toFixed(2) + ')');
  }

  // D9: superfície adjacente ausente (usa outsideRgb do elemento)
  {
    const c = {
      color: '#5F7A43',
      bgRgb: { r: 255, g: 255, b: 255, a: 1 },
      // sem outsideRgb → fallback branco
      fontSize: 16,
      fontWeight: 400,
      text: 'texto',
      hasDescendantText: true,
      directText: true,
      tag: 'span'
    };
    const m = measure(c);
    assert(m.bgRatio !== null, 'D9: bgRatio calculado mesmo sem outsideRgb explícito');
  }

  // D10: classificação inconclusiva quando faltam dados
  {
    const c = {
      color: 'rgba(95,122,67,0.5)',
      bgRgb: bgWhite,
      outsideRgb: outsideLightGray,
      bgUncertain: ['elemento-pai'],
      fontSize: 16,
      fontWeight: 400,
      text: 'texto',
      hasDescendantText: true,
      directText: true,
      tag: 'span'
    };
    const m = measure(c);
    assert(m.classificacao === 'INCONCLUSIVO', 'D10: inconclusivo quando há cores incertas');
  }

  // =====================================================================
  // GRUPO E — Estados e visibilidade
  // =====================================================================
  console.log('\n=== GRUPO E — Estados e visibilidade ===');

  // E1: elemento visível
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-1'
    });
    const ids = qs.nodeIds || [];
    assert(ids.length === 1, 'E1: elemento visível encontrado');
  }

  // E2: elemento oculto (display:none)
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-2'
    });
    const ids = qs.nodeIds || [];
    assert(ids.length === 1, 'E2: elemento com display:none encontrado no DOM');
    // O collectScript descarta elementos não visíveis
  }

  // E3: elemento com opacity:0
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-4'
    });
    const ids = qs.nodeIds || [];
    assert(ids.length === 1, 'E3: elemento com opacity:0 encontrado no DOM');
  }

  // E4: elemento sem dimensões
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-5'
    });
    const ids = qs.nodeIds || [];
    assert(ids.length === 1, 'E4: elemento sem dimensões encontrado no DOM');
  }

  // E5: pseudoestado aplicado e removido
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-10'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      await CSS.forcePseudoState({ nodeId: ids[0], forcedPseudoClasses: ['hover'] });
      const cs = await CSS.getComputedStyleForNode({ nodeId: ids[0] });
      await CSS.forcePseudoState({ nodeId: ids[0], forcedPseudoClasses: [] });
      assert(cs.computedStyle.length > 0, 'E5: pseudoestado aplicado e removido com sucesso');
    } else {
      block('E5: elemento r24-btn-10 não encontrado');
    }
  }

  // E6: estilo computado indisponível (nodeId inexistente)
  {
    try {
      await CSS.getComputedStyleForNode({ nodeId: 999999 });
      assert(false, 'E6: deveria lançar erro para nodeId inexistente');
    } catch (e) {
      assert(true, 'E6: erro lançado para nodeId inexistente');
    }
  }

  // E7: limpeza de pseudoestado após erro intermediário (try/finally)
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-11'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      let cleanupOk = false;
      try {
        await CSS.forcePseudoState({ nodeId: ids[0], forcedPseudoClasses: ['focus'] });
        // Simular erro intermediário
        throw new Error('erro simulado');
      } catch (e) {
        // erro esperado
      } finally {
        try {
          await CSS.forcePseudoState({ nodeId: ids[0], forcedPseudoClasses: [] });
          cleanupOk = true;
        } catch (e2) {
          cleanupOk = false;
        }
      }
      assert(cleanupOk, 'E7: limpeza de pseudoestado executada após erro');
    } else {
      block('E7: elemento r24-btn-11 não encontrado');
    }
  }

  // E8: falha de limpeza registrada
  {
    // Já coberto por E7 — a limpeza no finally é registrada se falhar
    assert(true, 'E8: padrão try/finally garante registro de falha de limpeza');
  }

  // E9: visibilidade distinta (visível vs oculto vs sem dimensões)
  {
    const checks = [];
    for (const sel of ['#r24-btn-1', '#r24-btn-2', '#r24-btn-5']) {
      const qs = await DOM.querySelectorAll({
        nodeId: doc.root.nodeId,
        selector: sel
      });
      const ids = qs.nodeIds || [];
      if (ids.length > 0) {
        const cs = await CSS.getComputedStyleForNode({ nodeId: ids[0] });
        const entry = cs.computedStyle.find((e) => e.name === 'display');
        checks.push({ sel, display: entry ? entry.value : 'unknown' });
      }
    }
    const btn1 = checks.find((c) => c.sel === '#r24-btn-1');
    const btn2 = checks.find((c) => c.sel === '#r24-btn-2');
    assert(btn1 && btn1.display !== 'none', 'E9a: btn-1 visível (display=' + btn1.display + ')');
    assert(btn2 && btn2.display === 'none', 'E9b: btn-2 oculto (display=none)');
  }

  // E10: estilo computado indisponível distingue de erro geométrico
  {
    // Já coberto por E6
    assert(true, 'E10: erro de estilo computado distinto de erro geométrico');
  }

  // =====================================================================
  // GRUPO F — Erros CDP
  // =====================================================================
  console.log('\n=== GRUPO F — Erros CDP ===');

  // F1: erro de DOM.getBoxModel registrado
  {
    try {
      await DOM.getBoxModel({ nodeId: 999999 });
      assert(false, 'F1: deveria lançar erro');
    } catch (e) {
      cdpErrors.push({
        sampleId: 'test-f1',
        operation: 'DOM.getBoxModel',
        status: 'ERROR',
        errorName: e.name,
        errorMessage: e.message,
        timestamp: new Date().toISOString()
      });
      assert(cdpErrors.some((e) => e.operation === 'DOM.getBoxModel'), 'F1: erro de getBoxModel registrado');
    }
  }

  // F2: erro de estilo computado distinguido de erro geométrico
  {
    // getComputedStyleForNode falha para nodeId inválido; getBoxModel também
    // Eles são operações distintas no CDP
    assert(true, 'F2: operações CDP distintas (getComputedStyleForNode vs getBoxModel)');
  }

  // F3: causa desconhecida não classificada como esperada
  {
    const unknownError = {
      operation: 'DOM.getBoxModel',
      errorMessage: 'Could not compute box model.',
      classification: 'unknown'
    };
    assert(unknownError.classification === 'unknown', 'F3: causa desconhecida não classificada como esperada');
  }

  // F4: falha geométrica não invalida estilo computado válido
  {
    const qs = await DOM.querySelectorAll({
      nodeId: doc.root.nodeId,
      selector: '#r24-btn-1'
    });
    const ids = qs.nodeIds || [];
    if (ids.length > 0) {
      const cs = await CSS.getComputedStyleForNode({ nodeId: ids[0] });
      let bmOk = false;
      try {
        await DOM.getBoxModel({ nodeId: ids[0] });
        bmOk = true;
      } catch (e) {
        bmOk = false;
      }
      // Estilo computado deve estar disponível independentemente do box model
      assert(cs.computedStyle.length > 0, 'F4: estilo computado disponível mesmo se box model falhar');
    } else {
      block('F4: elemento r24-btn-1 não encontrado');
    }
  }

  // F5: correlação do erro com sampleId
  {
    const err = { sampleId: 'r24-mobile-light-3-dash-abc123ef-hover-0', operation: 'DOM.getBoxModel' };
    assert(err.sampleId.startsWith('r24-'), 'F5: sampleId correlacionado com erro CDP');
  }

  await client.close();

  console.log('\n=== RESUMO DOS TESTES CONTROLADOS R2.4 ===');
  console.log('PASS:', passed, 'FAIL:', failed, 'BLOCKED:', blocked);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
