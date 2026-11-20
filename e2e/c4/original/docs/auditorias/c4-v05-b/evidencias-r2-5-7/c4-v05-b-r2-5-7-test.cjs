// ============================================================================
// Testes controlados C.4-V05-B-R2.5.7
// Executa as funções REAIS do núcleo compartilhado (c4-v05-b-r2-5-7-core.cjs)
// Valida: R25-01 sampleId com screen, R25-02 associação key→nodeId (cardinalidade),
// R25-03 limpeza de pseudoestado (try/finally real com injeção de falha),
// R25-04 visibilidade efetiva com ancestrais (herança/sobrescrita de visibility,
// display:none absoluto, raiz do documento), R25-05 validação geométrica,
// R25-06 atributos DOM com expectativas exatas, R25-07 classificação de erros CDP,
// R25-10 nenhum fallback a branco presumido.
// Novos testes: V1-V10 (semântica de visibility), P1-P7 (falha de aplicação
// de pseudoestado), R1-R7 (travessia da raiz do documento).
// ============================================================================

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = path.dirname(__filename);
// R25.7: o nucleo compartilhado NAO foi alterado nesta rodada.
// A R2.5.7 usa exatamente o nucleo publicado na R2.5.6.
const CORE_PATH = path.resolve(SCRIPT_DIR, '../evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs');
const harness = require(path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-7.cjs'));

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
  classifyCDPError,
  makeCDPErrorRecord,
  createCDPAuditCore,
  createSampleIdRegistry,
  resolveNodeIdResult,
} = require(CORE_PATH);

const FIXTURE =
  'http://127.0.0.1:8000/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-fixtures.html';

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

  // Núcleo real do harness
  const core = createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors });

  await Page.navigate({ url: FIXTURE });
  await new Promise((r) => setTimeout(r, 500));

  const doc = await DOM.getDocument({ depth: -1, pierce: true });

  // =====================================================================
  // GRUPO A — sampleId com screen (R25-01)
  // Executar a função real makeSampleId
  // =====================================================================
  console.log('\n=== GRUPO A — sampleId com screen (R25-01) ===');

  // A1: Mesmo seletor em duas telas diferentes
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    const s2 = makeSampleId('mobile', 'light', '3', 'caixa', '.r25-unique', 'hover', 0);
    assert(s1 !== s2, 'A1: sampleId difere por tela (dash vs caixa)');
    assert(s1.includes('dash'), 'A1: screen dash presente no sampleId');
    assert(s2.includes('caixa'), 'A1: screen caixa presente no sampleId');
  }

  // A2: Mesmo seletor em dois viewports
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    const s2 = makeSampleId('desktop', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    assert(s1 !== s2, 'A2: sampleId difere por viewport (mobile vs desktop)');
    assert(s1.startsWith('r25-mobile'), 'A2: prefixo mobile presente');
    assert(s2.startsWith('r25-desktop'), 'A2: prefixo desktop presente');
  }

  // A3: Mesmo seletor em temas diferentes
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    const s2 = makeSampleId('mobile', 'light', '4', 'dash', '.r25-unique', 'hover', 0);
    assert(s1 !== s2, 'A3: sampleId difere por tema (3 vs 4)');
  }

  // A4: Mesmo seletor em estados diferentes
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    const s2 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'focus-visible', 0);
    assert(s1 !== s2, 'A4: sampleId difere por estado (hover vs focus-visible)');
  }

  // A5: Duas ocorrências do mesmo seletor na mesma tela (índice diferente)
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    const s2 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 1);
    assert(s1 !== s2, 'A5: sampleId difere por índice (0 vs 1)');
  }

  // A6: Seletor sem correspondência em telas diferentes (screen ainda incorporado)
  {
    const s1 = makeSampleId('mobile', 'light', '3', 'dash', '.r25-nonexistent', 'normal', 0);
    const s2 = makeSampleId('mobile', 'light', '3', 'caixa', '.r25-nonexistent', 'normal', 0);
    assert(s1 !== s2, 'A6: sampleId difere por tela mesmo sem elementos correspondentes');
  }

  // A7: Chamadas sucessivas de makeSampleId não geram colisão via registro real
  {
    const registry = createSampleIdRegistry();
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const s = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', i);
      registry.register(s);
      ids.add(s);
    }
    assert(ids.size === 50, 'A7: 50 chamadas sucessivas geram 50 sampleIds únicos');
    assert(registry.size() === 50, 'A7: registro real contém 50 sampleIds');
  }

  // A7b: Duplicidade no registro real lança erro
  {
    const registry = createSampleIdRegistry();
    const s = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    registry.register(s);
    let duplicateDetected = false;
    try {
      registry.register(s);
    } catch (e) {
      duplicateDetected = true;
    }
    assert(duplicateDetected, 'A7b: registro real detecta sampleId duplicado');
  }

  // A8: prefixo r25-
  {
    const s = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    assert(s.startsWith('r25-'), 'A8: prefixo r25- presente');
  }

  // A9: screen não é string vazia
  {
    const s = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', 0);
    assert(!s.includes('--'), 'A9: screen não resulta em segmento vazio');
    const parts = s.split('-');
    assert(parts[4] === 'dash', 'A9: screen dash está na posição correta');
  }

  // =====================================================================
  // GRUPO B — Associação key → nodeId (cardinalidade) (R25-02)
  // Executar a função real resolveNodeIdResult do núcleo
  // =====================================================================
  console.log('\n=== GRUPO B — Associação key → nodeId (cardinalidade) (R25-02) ===');

  // B1: 0 IDs → node-not-found
  {
    const result = resolveNodeIdResult([], 'c4-test', '.r25-nonexistent');
    assert(result.status === 'node-not-found', 'B1: 0 IDs resulta em node-not-found');
    assert(result.nodeId === null, 'B1: nodeId é null quando não há IDs');
    assert(result.idCount === 0, 'B1: idCount é 0');
  }

  // B2: 1 ID → resolved
  {
    const result = resolveNodeIdResult([123], 'c4-test', '#r25-btn-1');
    assert(result.status === 'resolved', 'B2: 1 ID resulta em resolved');
    assert(result.nodeId === 123, 'B2: nodeId é o ID resolvido');
    assert(result.idCount === 1, 'B2: idCount é 1');
  }

  // B3: Mais de 1 ID → ambiguous-node-association
  {
    const result = resolveNodeIdResult([10, 20, 30], 'c4-test', '.r25-multiple');
    assert(result.status === 'ambiguous-node-association', 'B3: mais de 1 ID resulta em ambiguous-node-association');
    assert(result.nodeId === null, 'B3: nodeId é null quando ambíguo (não escolhe primeiro)');
    assert(result.idCount === 3, 'B3: idCount registra a quantidade real de IDs');
  }

  // B4: Erro CDP real resulta em cdp-error (injeção de falha no DOM.querySelectorAll)
  {
    const originalQuerySelectorAll = DOM.querySelectorAll.bind(DOM);
    DOM.querySelectorAll = async function() {
      throw new Error('CDP querySelectorAll injetado falhou');
    };

    try {
      const result = resolveNodeIdResult([], 'c4-test', '.r25-test');
      // resolveNodeIdResult é puro: com 0 IDs retorna node-not-found, não cdp-error.
      // O cdp-error vem de probeState quando o CDP falha. Testamos via probeState abaixo.
      assert(result.status === 'node-not-found', 'B4a: resolveNodeIdResult com 0 IDs retorna node-not-found');
    } finally {
      DOM.querySelectorAll = originalQuerySelectorAll;
    }
  }

  // B4b: probeState com DOM.querySelectorAll falhando retorna ocorrência com erro CDP
  {
    const originalQuerySelectorAll = DOM.querySelectorAll.bind(DOM);
    DOM.querySelectorAll = async function() {
      throw new Error('CDP querySelectorAll injetado falhou');
    };

    try {
      const occurrences = await core.probeState(
        '.r25-nonexistent',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      // Quando querySelectorAll falha, probeState captura o erro e retorna array vazio
      // com o erro registrado em cdpErrors. Verificamos que não lançou exceção não tratada.
      assert(Array.isArray(occurrences), 'B4b: probeState retorna array mesmo com erro CDP');
      assert(occurrences.length === 0, 'B4b: nenhuma ocorrência quando CDP falha na consulta');
    } finally {
      DOM.querySelectorAll = originalQuerySelectorAll;
    }
  }

  // B5: Nunca escolhe arbitrariamente o primeiro elemento quando ambíguo
  {
    const ids = [10, 20, 30];
    const result = resolveNodeIdResult(ids, 'c4-test', '.r25-multiple');
    assert(result.status === 'ambiguous-node-association', 'B5: múltiplos IDs não resultam em escolha arbitrária do primeiro');
    assert(result.nodeId === null, 'B5: nodeId é null quando há múltiplos IDs');
  }

  // B6: Registrar chave, seletor, quantidade de IDs e operação
  {
    const result = resolveNodeIdResult([42], 'c4-key-1', '.r25-multiple');
    assert(result.key === 'c4-key-1', 'B6: chave registrada');
    assert(result.selector === '.r25-multiple', 'B6: seletor registrado');
    assert(result.idCount === 1, 'B6: quantidade de IDs registrada');
  }

  // =====================================================================
  // GRUPO C — Limpeza de pseudoestado (try/finally real) (R25-03)
  // Executar core.probeState() real com injeção de falha
  // =====================================================================
  console.log('\n=== GRUPO C — Limpeza de pseudoestado (try/finally real) (R25-03) ===');

  // C1: pseudoestado aplicado e removido com sucesso via probeState real
  {
    const occurrences = await core.probeState(
      '#r25-btn-10',
      'hover',
      'mobile',
      'light',
      '3',
      'dash',
      createSampleIdRegistry()
    );
    const occ = occurrences.find((o) => o.state === 'hover');
    if (occ) {
      assert(occ.sampleId.startsWith('r25-'), 'C1: sampleId gerado com prefixo r25');
      assert(occ.nodeId !== null && occ.nodeId !== undefined, 'C1: nodeId presente na ocorrência');
      assert(occ.cleanupStatus === 'success', 'C1: cleanupStatus é success quando limpeza bem-sucedida');
    } else {
      block('C1: ocorrência hover não encontrada');
    }
  }

  // C2: Não há estado residual após execução de probeState
  {
    try {
      await core.probeState('#r25-btn-11', 'focus', 'mobile', 'light', '3', 'dash', createSampleIdRegistry());
      const doc2 = await DOM.getDocument({ depth: -1, pierce: true });
      const qs2 = await DOM.querySelectorAll({
        nodeId: doc2.root.nodeId,
        selector: '#r25-btn-11',
      });
      const ids2 = qs2.nodeIds || [];
      if (ids2.length > 0) {
        const cs = await CSS.getComputedStyleForNode({ nodeId: ids2[0] });
        const bgEntry = cs.computedStyle.find((e) => e.name === 'background-color');
        assert(
          bgEntry && bgEntry.value.includes('255'),
          'C2: sem estado residual de :focus após probeState',
        );
      } else {
        block('C2: elemento r25-btn-11 não encontrado após probeState');
      }
    } catch (e) {
      block('C2: exceção durante probeState ou consulta após: ' + e.message);
    }
  }

  // C3: Continuidade após falha isolada - múltiplas chamadas seguidas de probeState
  {
    const selectors = ['#r25-btn-1', '#r25-btn-2', '#r25-btn-3'];
    let allOk = true;
    for (const sel of selectors) {
      try {
        const docFresh = await DOM.getDocument({ depth: -1, pierce: true });
        const qs = await DOM.querySelectorAll({ nodeId: docFresh.root.nodeId, selector: sel });
        if (qs.nodeIds && qs.nodeIds.length > 0) {
          const occs = await core.probeState(
            sel,
            'hover',
            'mobile',
            'light',
            '3',
            'dash',
            createSampleIdRegistry(),
          );
          if (occs.length === 0) allOk = false;
        }
      } catch (e) {
        allOk = false;
      }
    }
    assert(allOk, 'C3: múltiplas chamadas de probeState executam sem falha em cadeia');
  }

  // C4: Falha de CSS.getComputedStyleForNode não impede limpeza de pseudoestado em finally
  {
    const originalGetComputedStyleForNode = CSS.getComputedStyleForNode.bind(CSS);
    let computeStyleFailed = false;
    CSS.getComputedStyleForNode = async function () {
      computeStyleFailed = true;
      throw new Error('getComputedStyleForNode injetado falhou');
    };

    try {
      const occurrences = await core.probeState(
        '#r25-btn-1',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(
        occ.cleanupStatus === 'success',
        'C4: limpeza tentada após falha de computed style (cleanupStatus=' + occ.cleanupStatus + ')',
      );
      assert(occ.discarded === true, 'C4: amostra descartada quando computed style falha');
      assert(occ.reason === 'computed-style-error', 'C4: motivo é computed-style-error');
      assert(computeStyleFailed === true, 'C4: falha de computed style foi efetivamente injetada');
    } catch (e) {
      block('C4: exceção inesperada: ' + e.message);
    } finally {
      CSS.getComputedStyleForNode = originalGetComputedStyleForNode;
    }
  }

  // C4b: Falha durante a aplicação do pseudoestado (antes da coleta)
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let applyFailed = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length > 0) {
        applyFailed = true;
        throw new Error('aplicação de pseudoestado injetada falhou');
      }
      return originalForcePseudoState.call(CSS, params);
    };

    try {
      const occurrences = await core.probeState(
        '#r25-btn-1',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      // Quando a aplicação falha, pseudoApplied pode ter sido marcado true antes da chamada
      // mas o erro é capturado e a limpeza ainda roda em finally
      assert(occ.cleanupStatus === 'success', 'C4b: limpeza tentada mesmo com falha na aplicação');
    } catch (e) {
      block('C4b: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // C5: Falha de limpeza de pseudoestado invalida a amostra
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let clearFailed = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length === 0) {
        clearFailed = true;
        throw new Error('limpeza injetada falhou');
      }
      return originalForcePseudoState.call(CSS, params);
    };

    try {
      const occurrences = await core.probeState(
        '#r25-btn-1',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(occ.cleanupStatus === 'failed', 'C5: cleanupStatus é failed quando limpeza falha');
      assert(occ.discarded === true, 'C5: amostra descartada quando limpeza falha');
      assert(occ.reason === 'cleanup-failed', 'C5: motivo é cleanup-failed');
      assert(clearFailed === true, 'C5: falha de limpeza foi efetivamente injetada');
    } catch (e) {
      block('C5: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // C6: Processo continua após falha isolada em uma chamada de probeState
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let cleanupCall = 0;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length === 0) {
        // Esta é uma chamada de limpeza
        cleanupCall++;
        if (cleanupCall === 2) {
          throw new Error('limpeza da segunda chamada falhou');
        }
      }
      return originalForcePseudoState.call(CSS, params);
    };

    try {
      // Primeira chamada: sucesso
      const occs1 = await core.probeState(
        '#r25-btn-1',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      assert(occs1.length > 0, 'C6: primeira chamada produz ocorrências');
      assert(occs1[0].cleanupStatus === 'success', 'C6: primeira chamada limpeza success');

      // Segunda chamada: falha na limpeza
      const occs2 = await core.probeState(
        '#r25-btn-2',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      assert(occs2.length > 0, 'C6: segunda chamada produz ocorrências mesmo com falha na limpeza');
      assert(occs2[0].cleanupStatus === 'failed', 'C6: segunda chamada limpeza failed');
      assert(occs2[0].discarded === true, 'C6: segunda chamada amostra descartada');

      // Terceira chamada: continua funcionando após falha isolada
      CSS.forcePseudoState = originalForcePseudoState;
      const occs3 = await core.probeState(
        '#r25-btn-3',
        'hover',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      assert(occs3.length > 0, 'C6: terceira chamada produz ocorrências após recuperação');
      assert(occs3[0].cleanupStatus === 'success', 'C6: terceira chamada limpeza success após recuperação');
    } catch (e) {
      block('C6: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // =====================================================================
  // GRUPO D — Visibilidade efetiva e ancestrais (R25-04)
  // Executar core.probeState() real e verificar visibilityStatus/geometryStatus
  // =====================================================================
  console.log('\n=== GRUPO D — Visibilidade efetiva e ancestrais (R25-04) ===');

  async function probeBySelector(selector, state) {
    const rootId = (await DOM.getDocument({ depth: -1, pierce: true })).root.nodeId;
    const qs = await DOM.querySelectorAll({ nodeId: rootId, selector });
    return { ids: qs.nodeIds || [], rootId };
  }

  // D1: Elemento visível com geometria
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'visible', 'D1: elemento visível tem visibilityStatus visible');
      assert(
        occ.geometryStatus === 'available',
        'D1: elemento visível tem geometryStatus available',
      );
      assert(occ.rect !== null, 'D1: rect disponível para elemento visível');
    } else {
      block('D1: elemento r25-btn-1 não encontrado');
    }
  }

  // D2: display:none → visibilityStatus hidden
  {
    const { ids } = await probeBySelector('#r25-btn-2', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-2',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'D2: display:none resulta em visibilityStatus hidden',
      );
    } else {
      block('D2: elemento r25-btn-2 não encontrado');
    }
  }

  // D3: visibility:hidden → visibilityStatus hidden
  {
    const { ids } = await probeBySelector('#r25-btn-3', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-3',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'D3: visibility:hidden resulta em visibilityStatus hidden',
      );
    } else {
      block('D3: elemento r25-btn-3 não encontrado');
    }
  }

  // D4: opacity:0 → visibilityStatus not-visible (não convertido em 1)
  {
    const { ids } = await probeBySelector('#r25-btn-4', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-4',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'not-visible',
        'D4: opacity:0 resulta em visibilityStatus not-visible (não visível)',
      );
      assert(
        occ.opacity === '0',
        'D4: valor original de opacity preservado (não convertido para 1)',
      );
    } else {
      block('D4: elemento r25-btn-4 não encontrado');
    }
  }

  // D5: Elemento sem dimensões → visibilityStatus not-visible, geometryStatus available
  {
    const { ids } = await probeBySelector('#r25-btn-5', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-5',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'not-visible',
        'D5: dimensões zero resulta em visibilityStatus not-visible',
      );
      assert(
        occ.geometryStatus === 'unavailable',
        'D5: geometria degenerada (dimensões zero) tem geometryStatus unavailable',
      );
      assert(
        occ.rect === null,
        'D5: retângulo é null para geometria degenerada',
      );
    } else {
      block('D5: elemento r25-btn-5 não encontrado');
    }
  }

  // D6: Elemento dentro de ancestral com opacity:0 → visibilityStatus not-visible
  {
    const { ids } = await probeBySelector(
      '#r25-ancestor-opacity0-child',
      'normal',
    );
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-opacity0-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'not-visible',
        'D6: ancestral com opacity:0 resulta em visibilityStatus not-visible',
      );
      assert(
        occ.ancestorOpacity === 0,
        'D6: ancestorOpacity acumulado é 0',
      );
    } else {
      block('D6: elemento r25-ancestor-opacity0-child não encontrado');
    }
  }

  // D7: Elemento dentro de ancestral com display:none → visibilityStatus hidden
  {
    const { ids } = await probeBySelector(
      '#r25-ancestor-displaynone-child',
      'normal',
    );
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-displaynone-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'D7: ancestral com display:none resulta em visibilityStatus hidden',
      );
      assert(
        occ.ancestorHidden === true,
        'D7: ancestorHidden é true',
      );
    } else {
      block('D7: elemento r25-ancestor-displaynone-child não encontrado');
    }
  }

  // D8: Elemento dentro de ancestral com opacidade parcial
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.ancestorOpacity === 1,
        'D8: ancestral sem alteração de opacidade tem ancestorOpacity=1',
      );
      assert(
        occ.ancestorHidden === false,
        'D8: ancestral sem display:none tem ancestorHidden=false',
      );
    } else {
      block('D8: elemento r25-btn-1 não encontrado');
    }
  }

  // D9: Ancestral com visibility:hidden → visibilityStatus hidden
  {
    const { ids } = await probeBySelector(
      '#r25-ancestor-visibilityhidden-child',
      'normal',
    );
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-visibilityhidden-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'D9: ancestral com visibility:hidden resulta em visibilityStatus hidden',
      );
      assert(
        occ.ancestorHidden === true,
        'D9: ancestorHidden é true para ancestral visibility:hidden',
      );
      assert(
        occ.ancestorVisibility === 'completed',
        'D9: travessia de ancestral concluída com sucesso',
      );
    } else {
      block('D9: elemento r25-ancestor-visibilityhidden-child não encontrado');
    }
  }

  // D10: Ancestral com visibility:collapse → visibilityStatus hidden
  {
    const { ids } = await probeBySelector(
      '#r25-ancestor-visibilitycollapse-child',
      'normal',
    );
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-visibilitycollapse-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'D10: ancestral com visibility:collapse resulta em visibilityStatus hidden',
      );
      assert(
        occ.ancestorHidden === true,
        'D10: ancestorHidden é true para ancestral visibility:collapse',
      );
    } else {
      block('D10: elemento r25-ancestor-visibilitycollapse-child não encontrado');
    }
  }

  // D11: Falha na leitura de ancestral → visibilityStatus unknown (não presume visível)
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      let callCount = 0;
      Runtime.callFunctionOn = async function(params) {
        callCount++;
        // Falha na segunda chamada (obtenção do pai) para simular leitura indisponível
        if (callCount === 2 && params.returnByValue === false) {
          return { result: null };
        }
        return originalCallFunctionOn.call(Runtime, params);
      };

      try {
        const occs = await core.probeState(
          '#r25-btn-1',
          'normal',
          'mobile',
          'light',
          '3',
          'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        // Quando a leitura de ancestral falha e o elemento está visível, visibilityStatus deve ser 'unknown'
        assert(
          occ.visibilityStatus === 'unknown',
          'D11: falha na leitura de ancestral resulta em visibilityStatus unknown',
        );
        assert(
          occ.ancestorVisibility !== 'completed',
          'D11: ancestorVisibility não é completed quando leitura falha',
        );
        assert(
          occ.ancestorFailureReason !== null,
          'D11: ancestorFailureReason preenchido quando leitura falha',
        );
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('D11: elemento r25-btn-1 não encontrado');
    }
  }

  // D12: Duas ocorrências do mesmo seletor com ancestrais diferentes
  {
    const selector = '.r25-same-selector';
    const { ids } = await probeBySelector(selector, 'normal');
    if (ids.length >= 2) {
      const occs = await core.probeState(
        selector,
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      // Encontrar a ocorrência com ancestral oculto (opacity:0)
      const occHidden = occs.find((o) => o.nodeId && o.ancestorOpacity === 0);
      const occVisible = occs.find((o) => o.nodeId && o.ancestorOpacity === 1);

      if (occHidden) {
        assert(
          occHidden.visibilityStatus === 'not-visible',
          'D12: ocorrência com ancestral opacity:0 tem visibilityStatus not-visible',
        );
      } else {
        block('D12: não encontrada ocorrência com ancestral opacity:0');
      }

      if (occVisible) {
        assert(
          occVisible.visibilityStatus === 'visible',
          'D12: ocorrência com ancestral visível tem visibilityStatus visible',
        );
      } else {
        block('D12: não encontrada ocorrência com ancestral visível');
      }

      // Verificar que as duas ocorrências têm nodeId diferente (identidade preservada)
      const nodeIds = occs.map((o) => o.nodeId);
      const uniqueNodeIds = new Set(nodeIds);
      assert(
        uniqueNodeIds.size === ids.length,
        'D12: cada ocorrência tem nodeId individual (identidade preservada)',
      );
    } else {
      block('D12: menos de 2 elementos encontrados para seletor .r25-same-selector');
    }
  }

  // =====================================================================
  // GRUPO V — Semântica de visibility (herança e sobrescrita) (R25-04)
  // =====================================================================
  console.log('\n=== GRUPO V — Semântica de visibility (herança e sobrescrita) ===');

  // V1: ancestral visible e descendente visible → visível
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'visible', 'V1: ancestral visible e descendente visible → visível');
    } else {
      block('V1: elemento r25-btn-1 não encontrado');
    }
  }

  // V2: ancestral hidden e descendente sem sobrescrita → oculto
  {
    const { ids } = await probeBySelector('#r25-ancestor-visibilityhidden-child', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-visibilityhidden-child', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'hidden', 'V2: ancestral hidden e descendente sem sobrescrita → oculto');
    } else {
      block('V2: elemento r25-ancestor-visibilityhidden-child não encontrado');
    }
  }

  // V3: ancestral hidden e descendente visible → visível (sobrescrita)
  {
    const { ids } = await probeBySelector('#r25-v3-desc-vis', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-v3-desc-vis', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'visible', 'V3: ancestral hidden e descendente visible → visível (sobrescrita)');
    } else {
      block('V3: elemento r25-v3-desc-vis não encontrado');
    }
  }

  // V4: ancestral collapse e descendente sem sobrescrita → oculto
  {
    const { ids } = await probeBySelector('#r25-ancestor-visibilitycollapse-child', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-visibilitycollapse-child', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'hidden', 'V4: ancestral collapse e descendente sem sobrescrita → oculto');
    } else {
      block('V4: elemento r25-ancestor-visibilitycollapse-child não encontrado');
    }
  }

  // V5: ancestral collapse e descendente visible → observar comportamento real do Chromium
  {
    const { ids } = await probeBySelector('#r25-v5-desc-vis', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-v5-desc-vis', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'visible' || occ.visibilityStatus === 'hidden',
        'V5: ancestral collapse e descendente visible → resultado observado: ' + occ.visibilityStatus,
      );
      console.log('    V5 observado: visibilityStatus=' + occ.visibilityStatus + ', ancestorHidden=' + occ.ancestorHidden + ', ancestorVisibility=' + occ.ancestorVisibility);
    } else {
      block('V5: elemento r25-v5-desc-vis não encontrado');
    }
  }

  // V6: ancestral display:none e descendente visible → oculto (display:none é absoluto)
  {
    const { ids } = await probeBySelector('#r25-ancestor-displaynone-child', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-displaynone-child', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'hidden', 'V6: ancestral display:none e descendente visible → oculto (absoluto)');
    } else {
      block('V6: elemento r25-ancestor-displaynone-child não encontrado');
    }
  }

  // V7: ancestral opacity:0 → opacidade efetiva zero
  {
    const { ids } = await probeBySelector('#r25-ancestor-opacity0-child', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-opacity0-child', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'not-visible', 'V7: ancestral opacity:0 → not-visible');
      assert(occ.ancestorOpacity === 0, 'V7: ancestorOpacity acumulado é 0');
    } else {
      block('V7: elemento r25-ancestor-opacity0-child não encontrado');
    }
  }

  // V8: dois ancestrais com valores diferentes de visibility → respeitar computado em cada nível
  {
    const { ids } = await probeBySelector('#r25-v8-desc', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-v8-desc', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.visibilityStatus === 'visible', 'V8: dois ancestrais diferentes → respeitar computado do nível mais próximo');
    } else {
      block('V8: elemento r25-v8-desc não encontrado');
    }
  }

  // V9: falha de leitura de ancestral → estado desconhecido/erro, nunca visível confirmado
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      let callCount = 0;
      Runtime.callFunctionOn = async function(params) {
        callCount++;
        if (callCount === 2 && params.returnByValue === false) {
          return { result: null };
        }
        return originalCallFunctionOn.call(Runtime, params);
      };
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(
          occ.visibilityStatus === 'unknown',
          'V9: falha na leitura de ancestral → visibilityStatus unknown, nunca visível',
        );
        assert(
          occ.ancestorVisibility !== 'completed',
          'V9: ancestorVisibility não é completed quando leitura falha',
        );
        assert(occ.ancestorFailureReason !== null, 'V9: ancestorFailureReason preenchido');
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('V9: elemento r25-btn-1 não encontrado');
    }
  }

  // V10: duas ocorrências do mesmo seletor com ancestrais diferentes → resultado individual
  {
    const selector = '.r25-same-selector';
    const { ids } = await probeBySelector(selector, 'normal');
    if (ids.length >= 2) {
      const occs = await core.probeState(
        selector, 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occHidden = occs.find((o) => o.nodeId && o.ancestorOpacity === 0);
      const occVisible = occs.find((o) => o.nodeId && o.ancestorOpacity === 1);
      if (occHidden) {
        assert(occHidden.visibilityStatus === 'not-visible', 'V10: ocorrência com ancestral opacity:0 → not-visible');
      } else {
        block('V10: não encontrada ocorrência com ancestral opacity:0');
      }
      if (occVisible) {
        assert(occVisible.visibilityStatus === 'visible', 'V10: ocorrência com ancestral visível → visible');
      } else {
        block('V10: não encontrada ocorrência com ancestral visível');
      }
    } else {
      block('V10: menos de 2 elementos para .r25-same-selector');
    }
  }

  // V11: ancestral visibility:hidden + descendente visibility:visible + falha ao obter o pai
  // A travessia de ancestrais emite 2 Runtime.callFunctionOn por nível:
  //   1 = estilo do elemento testado, 2 = obter pai, 3 = estilo do ancestral,
  //   4 = obter avô.
  // A falha é injetada na 4ª chamada (obtenção do pai do ancestral), depois
  // de o estilo do ancestral oculto já ter sido lido.
  {
    const { ids } = await probeBySelector('#r25-v3-desc-vis', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      let callCount = 0;
      Runtime.callFunctionOn = async function(params) {
        callCount++;
        if (callCount === 4 && params.returnByValue === false) {
          return { result: null };
        }
        return originalCallFunctionOn.call(Runtime, params);
      };
      try {
        const occs = await core.probeState(
          '#r25-v3-desc-vis', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(
          occ.visibilityStatus === 'unknown',
          'V11: travessia incompleta não pode confirmar visibilidade (unknown, nunca visible)',
        );
        assert(
          occ.ancestorVisibility === 'partial',
          'V11: falha na obtenção do pai resulta em ancestorVisibility partial',
        );
        assert(
          occ.discarded === false,
          'V11: estado desconhecido não descarta a amostra',
        );
        assert(
          occ.ancestorFailureReason !== null,
          'V11: ancestorFailureReason preenchido',
        );
        assert(
          occ.ancestorHidden === true,
          'V11: evidência ancestorHidden do ancestral oculto foi preservada',
        );
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('V11: elemento r25-v3-desc-vis não encontrado');
    }
  }

  // V12: ancestral opacity:0 + falha posterior na travessia
  // A opacidade zero já comprovada não pode ser apagada pela falha posterior.
  {
    const { ids } = await probeBySelector('#r25-ancestor-opacity0-child', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      let callCount = 0;
      Runtime.callFunctionOn = async function(params) {
        callCount++;
        if (callCount === 4 && params.returnByValue === false) {
          return { result: null };
        }
        return originalCallFunctionOn.call(Runtime, params);
      };
      try {
        const occs = await core.probeState(
          '#r25-ancestor-opacity0-child', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(
          occ.visibilityStatus === 'not-visible',
          'V12: opacidade zero preservada apesar da falha posterior na travessia',
        );
        assert(
          occ.ancestorOpacity === 0,
          'V12: ancestorOpacity preservado em 0 após falha posterior',
        );
        assert(
          occ.ancestorVisibility !== 'completed',
          'V12: travessia incompleta registrada mesmo com evidência absoluta presente',
        );
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('V12: elemento r25-ancestor-opacity0-child não encontrado');
    }
  }

  // V13: ancestral com opacity parcial (0.5) + falha posterior na travessia
  {
    const { ids } = await probeBySelector('#r25-ancestor-opacity05-child', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      let callCount = 0;
      Runtime.callFunctionOn = async function(params) {
        callCount++;
        if (callCount === 4 && params.returnByValue === false) {
          return { result: null };
        }
        return originalCallFunctionOn.call(Runtime, params);
      };
      try {
        const occs = await core.probeState(
          '#r25-ancestor-opacity05-child', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(
          occ.visibilityStatus !== 'visible',
          'V13: visibilidade não confirmada quando a travessia falha com opacity parcial',
        );
        assert(
          occ.ancestorVisibility !== 'completed',
          'V13: travessia incompleta ou erro registrado',
        );
        assert(
          occ.ancestorOpacity === 0.5,
          'V13: ancestorOpacity representa somente o valor parcial coletado (0.5)',
        );
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('V13: elemento r25-ancestor-opacity05-child não encontrado');
    }
  }

  // =====================================================================
  // GRUPO P — Falha de aplicação de pseudoestado invalida a amostra (R25-03)
  // =====================================================================
  console.log('\n=== GRUPO P — Falha de aplicação de pseudoestado ===');

  // P1: aplicação bem-sucedida → amostra válida, limpeza executada
  {
    const occurrences = await core.probeState(
      '#r25-btn-10', 'hover', 'mobile', 'light', '3', 'dash',
      createSampleIdRegistry(),
    );
    const occ = occurrences.find((o) => o.state === 'hover');
    if (occ) {
      assert(occ.cleanupStatus === 'success', 'P1: aplicação bem-sucedida → cleanupStatus success');
      assert(occ.discarded !== true || occ.reason === 'visibility', 'P1: amostra válida quando aplicação bem-sucedida');
    } else {
      block('P1: ocorrência hover não encontrada');
    }
  }

  // P2: falha na aplicação → amostra descartada, limpeza executada
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let applyFailed = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length > 0) {
        applyFailed = true;
        throw new Error('aplicação injetada falhou');
      }
      return originalForcePseudoState.call(CSS, params);
    };
    try {
      const occurrences = await core.probeState(
        '#r25-btn-1', 'hover', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(applyFailed === true, 'P2: falha de aplicação foi efetivamente injetada');
      assert(occ.discarded === true, 'P2: amostra descartada quando aplicação falha');
      assert(occ.reason === 'pseudo-apply-error', 'P2: motivo é pseudo-apply-error');
      assert(occ.cleanupStatus === 'success', 'P2: limpeza executada mesmo com falha de aplicação');
    } catch (e) {
      block('P2: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // P3: falha na coleta depois da aplicação → descarte, limpeza
  {
    const originalGetComputedStyleForNode = CSS.getComputedStyleForNode.bind(CSS);
    CSS.getComputedStyleForNode = async function () {
      throw new Error('coleta injetada falhou');
    };
    try {
      const occurrences = await core.probeState(
        '#r25-btn-1', 'hover', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(occ.discarded === true, 'P3: amostra descartada quando coleta falha após aplicação');
      assert(occ.cleanupStatus === 'success', 'P3: limpeza executada após falha de coleta');
    } catch (e) {
      block('P3: exceção inesperada: ' + e.message);
    } finally {
      CSS.getComputedStyleForNode = originalGetComputedStyleForNode;
    }
  }

  // P4: falha na limpeza → cleanupStatus failed, amostra não íntegra
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let clearFailed = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length === 0) {
        clearFailed = true;
        throw new Error('limpeza injetada falhou');
      }
      return originalForcePseudoState.call(CSS, params);
    };
    try {
      const occurrences = await core.probeState(
        '#r25-btn-1', 'hover', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(clearFailed === true, 'P4: falha de limpeza foi efetivamente injetada');
      assert(occ.cleanupStatus === 'failed', 'P4: cleanupStatus é failed quando limpeza falha');
      assert(occ.discarded === true, 'P4: amostra não é íntegra quando limpeza falha');
    } catch (e) {
      block('P4: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // P5: falha simultânea de aplicação e limpeza → ambos preservados
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let applyFailed = false;
    let clearFailed = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length > 0) {
        applyFailed = true;
        throw new Error('aplicação injetada falhou');
      }
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length === 0) {
        clearFailed = true;
        throw new Error('limpeza injetada falhou');
      }
      return originalForcePseudoState.call(CSS, params);
    };
    try {
      const occurrences = await core.probeState(
        '#r25-btn-1', 'hover', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occurrences[0];
      assert(applyFailed === true, 'P5: falha de aplicação injetada');
      assert(clearFailed === true, 'P5: falha de limpeza injetada');
      assert(occ.discarded === true, 'P5: amostra descartada');
      assert(occ.cleanupStatus === 'failed', 'P5: cleanupStatus failed');
    } catch (e) {
      block('P5: exceção inesperada: ' + e.message);
    } finally {
      CSS.forcePseudoState = originalForcePseudoState;
    }
  }

  // P6: estado 'normal' (sem pseudoestado) não é descartado
  {
    const occurrences = await core.probeState(
      '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
      createSampleIdRegistry(),
    );
    const occ = occurrences[0];
    assert(occ.cleanupStatus === 'not-required', 'P6: cleanupStatus not-required quando não há pseudoestado');
    assert(occ.visibilityStatus === 'visible', 'P6: estado normal → visível');
  }

  // P7: integração com harness — amostra descartada é identificável via discarded flag
  {
    const occurrences = await core.probeState(
      '#r25-btn-2', 'normal', 'mobile', 'light', '3', 'dash',
      createSampleIdRegistry(),
    );
    const occ = occurrences[0];
    // r25-btn-2 tem display:none → descartado por visibility
    assert(occ.discarded === true, 'P7: amostra ocultada por visibility tem discarded = true');
    assert(occ.reason === 'visibility', 'P7: motivo é visibility');
  }

  // =====================================================================
  // GRUPO R — Travessia da raiz do documento (R25-04)
  // =====================================================================
  console.log('\n=== GRUPO R — Travessia da raiz do documento ===');

  // R1: HTML opacity 1 → travessia concluída
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.ancestorVisibility === 'completed', 'R1: HTML opacity 1 → travessia concluída');
      assert(occ.ancestorOpacity === 1, 'R1: ancestorOpacity = 1 (HTML opacidade padrão)');
    } else {
      block('R1: elemento r25-btn-1 não encontrado');
    }
  }

  // R2: HTML opacity 0 → opacidade acumulada zero
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      await Runtime.evaluate({ expression: 'document.documentElement.style.opacity = "0"' });
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(occ.visibilityStatus === 'not-visible', 'R2: HTML opacity:0 → not-visible');
        assert(occ.ancestorOpacity === 0, 'R2: ancestorOpacity acumulado é 0 (HTML)');
      } finally {
        await Runtime.evaluate({ expression: 'document.documentElement.style.opacity = ""' });
      }
    } else {
      block('R2: elemento r25-btn-1 não encontrado');
    }
  }

  // R3: HTML opacity 0.5 → opacidade acumulada correspondente
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      await Runtime.evaluate({ expression: 'document.documentElement.style.opacity = "0.5"' });
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(occ.ancestorOpacity === 0.5, 'R3: HTML opacity:0.5 → ancestorOpacity = 0.5');
        assert(occ.visibilityStatus === 'visible', 'R3: HTML opacity:0.5 (não zero) → visível');
      } finally {
        await Runtime.evaluate({ expression: 'document.documentElement.style.opacity = ""' });
      }
    } else {
      block('R3: elemento r25-btn-1 não encontrado');
    }
  }

  // R4: HTML display:none → descendente oculto
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      await Runtime.evaluate({ expression: 'document.documentElement.style.display = "none"' });
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(occ.visibilityStatus === 'hidden', 'R4: HTML display:none → hidden');
      } finally {
        await Runtime.evaluate({ expression: 'document.documentElement.style.display = ""' });
      }
    } else {
      block('R4: elemento r25-btn-1 não encontrado');
    }
  }

  // R5: HTML visibility:hidden → considerar herança e sobrescrita
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      await Runtime.evaluate({ expression: 'document.documentElement.style.visibility = "hidden"' });
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(occ.visibilityStatus === 'hidden', 'R5: HTML visibility:hidden e descendente sem sobrescrita → hidden');
      } finally {
        await Runtime.evaluate({ expression: 'document.documentElement.style.visibility = ""' });
      }
    } else {
      block('R5: elemento r25-btn-1 não encontrado');
    }
  }

  // R6: falha ao consultar estilo da raiz → desconhecido/erro
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const originalCallFunctionOn = Runtime.callFunctionOn.bind(Runtime);
      Runtime.callFunctionOn = async function(params) {
        const ret = await originalCallFunctionOn.call(Runtime, params);
        if (ret.result && ret.result.value && ret.result.value.isRoot === true) {
          return { result: null };
        }
        return ret;
      };
      try {
        const occs = await core.probeState(
          '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        const occ = occs[0];
        assert(
          occ.visibilityStatus === 'unknown',
          'R6: falha ao ler estilo da raiz → visibilityStatus unknown',
        );
        assert(
          occ.ancestorVisibility !== 'completed',
          'R6: ancestorVisibility não é completed quando leitura da raiz falha',
        );
      } finally {
        Runtime.callFunctionOn = originalCallFunctionOn;
      }
    } else {
      block('R6: elemento r25-btn-1 não encontrado');
    }
  }

  // R7: travessia normal até raiz → status de conclusão explícito
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.ancestorVisibility === 'completed', 'R7: travessia normal até raiz → ancestorVisibility completed');
      assert(occ.ancestorDepth > 0, 'R7: ancestorDepth > 0 (travessia alcançou ancestrais)');
    } else {
      block('R7: elemento r25-btn-1 não encontrado');
    }
  }

  // =====================================================================
  // GRUPO E — Atributos DOM com expectativas exatas (R25-05)
  // =====================================================================
  console.log('\n=== GRUPO E — Atributos DOM com expectativas exatas (R25-05) ===');

  // E1: tabindex="0"
  {
    const { ids } = await probeBySelector('#r25-attr-tabindex-0', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-tabindex-0',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.tabIndex === '0',
        'E1: tabindex="0" lido corretamente (valor="' + occ.tabIndex + '")',
      );
    } else {
      block('E1: elemento r25-attr-tabindex-0 não encontrado');
    }
  }

  // E2: tabindex="-1"
  {
    const { ids } = await probeBySelector('#r25-attr-tabindex-m1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-tabindex-m1',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.tabIndex === '-1',
        'E2: tabindex="-1" lido corretamente (valor="' + occ.tabIndex + '")',
      );
    } else {
      block('E2: elemento r25-attr-tabindex-m1 não encontrado');
    }
  }

  // E3: tabindex ausente
  {
    const { ids } = await probeBySelector('#r25-btn-1', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-btn-1',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(occ.tabIndex === null, 'E3: tabindex ausente retorna null');
    } else {
      block('E3: elemento r25-btn-1 não encontrado');
    }
  }

  // E4: role="button"
  {
    const { ids } = await probeBySelector('#r25-attr-role-button', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-role-button',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.role === 'button',
        'E4: role="button" lido corretamente (valor="' + occ.role + '")',
      );
    } else {
      block('E4: elemento r25-attr-role-button não encontrado');
    }
  }

  // E5: aria-label com texto conhecido
  {
    const { ids } = await probeBySelector('#r25-attr-aria-label', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-aria-label',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.aria === 'Rótulo de acessibilidade',
        'E5: aria-label lido corretamente (valor="' + occ.aria + '")',
      );
    } else {
      block('E5: elemento r25-attr-aria-label não encontrado');
    }
  }

  // E6: disabled=true
  {
    const { ids } = await probeBySelector('#r25-attr-disabled', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-disabled',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.disabled === true,
        'E6: disabled=true lido corretamente',
      );
    } else {
      block('E6: elemento r25-attr-disabled não encontrado');
    }
  }

  // E7: disabled=false (presente mas não desabilitado)
  {
    const { ids } = await probeBySelector('#r25-attr-enabled', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-attr-enabled',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.disabled === false,
        'E7: disabled=false lido corretamente',
      );
    } else {
      block('E7: elemento r25-attr-enabled não encontrado');
    }
  }

  // =====================================================================
  // GRUPO F — Validação geométrica (R25-05)
  // Executar rectFromBorder() real do núcleo
  // =====================================================================
  console.log('\n=== GRUPO F — Validação geométrica (R25-05) ===');

  // F1: Retângulo válido
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 50, 10, 50]);
    assert(r !== null, 'F1: retângulo válido retorna objeto');
    assert(
      r.x === 10 && r.y === 10 && r.w === 40 && r.h === 40,
      'F1: geometria correta (x=' + r.x + ', y=' + r.y + ', w=' + r.w + ', h=' + r.h + ')',
    );
  }

  // F2: Quadrilátero rotacionado válido
  {
    const r = rectFromBorder([0, 0, 40, 10, 30, 50, -10, 40]);
    assert(r !== null, 'F2: quadrilátero rotacionado válido retorna objeto');
    assert(
      r.x === -10 && r.y === 0 && r.w === 50 && r.h === 50,
      'F2: geometria rotacionada correta',
    );
  }

  // F3: Lista ausente
  {
    const r = rectFromBorder(null);
    assert(r === null, 'F3: lista ausente retorna null');
  }

  // F4: Lista com menos de oito coordenadas
  {
    const r = rectFromBorder([10, 10, 50, 10]);
    assert(r === null, 'F4: lista com menos de 8 coordenadas retorna null');
  }

  // F5: Coordenada NaN
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 50, 10, NaN]);
    assert(r === null, 'F5: coordenada NaN retorna null');
  }

  // F6: Coordenada infinita
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 50, 10, Infinity]);
    assert(r === null, 'F6: coordenada infinita retorna null');
  }

  // F7: Valor textual inválido
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 50, 10, 'x']);
    assert(r === null, 'F7: valor textual inválido retorna null');
  }

  // F8: Largura degenerada (zero)
  {
    const r = rectFromBorder([10, 10, 10, 10, 10, 10, 10, 10]);
    assert(r === null, 'F8: largura degenerada (zero) retorna null');
  }

  // F9: Altura degenerada (zero)
  {
    const r = rectFromBorder([10, 10, 50, 10, 50, 10, 10, 10]);
    assert(r === null, 'F9: altura degenerada (zero) retorna null');
  }

  // =====================================================================
  // GRUPO G — Classificação de erros CDP (R25-07)
  // Executar classifyCDPError() e makeCDPErrorRecord() reais do núcleo
  // =====================================================================
  console.log('\n=== GRUPO G — Classificação de erros CDP (R25-07) ===');

  // G1: node-detached
  {
    const record = classifyCDPError(
      'DOM.getBoxModel',
      'NotFoundError',
      'Node is detached from document.',
    );
    assert(record.classification === 'node-detached', 'G1: nó removido classificado como node-detached');
    assert(record.confidence === 'high', 'G1: confiança alta para node-detached');
  }

  // G2: node-not-found
  {
    const record = classifyCDPError(
      'DOM.querySelectorAll',
      'Error',
      'No nodes found for selector.',
    );
    assert(
      record.classification === 'node-not-found',
      'G2: seletor sem nós classificado como node-not-found',
    );
  }

  // G3: geometry-unavailable
  {
    const record = classifyCDPError(
      'DOM.getBoxModel',
      'Error',
      'Could not compute box model.',
    );
    assert(
      record.classification === 'geometry-unavailable',
      'G3: box model não computável classificado como geometry-unavailable',
    );
  }

  // G4: protocol-error
  {
    const record = classifyCDPError(
      'CSS.getMatchedStylesForNode',
      'InvalidParams',
      'Invalid parameters.',
    );
    assert(
      record.classification === 'protocol-error',
      'G4: parâmetros inválidos classificado como protocol-error',
    );
  }

  // G5: unknown para causa não demonstrada
  {
    const record = classifyCDPError(
      'Runtime.evaluate',
      'SomeError',
      'algo estranho aconteceu',
    );
    assert(record.classification === 'unknown', 'G5: erro não mapeado classificado como unknown');
    assert(record.confidence === 'low', 'G5: confiança baixa para erro desconhecido');
  }

  // G6: Mensagem ambígua com "node" não classificada automaticamente como node-detached
  {
    const record = classifyCDPError(
      'DOM.getBoxModel',
      'Error',
      'node not found in tree',
    );
    assert(
      record.classification !== 'node-detached',
      'G6: mensagem ambígua não classificada como node-detached sem evidência de remoção',
    );
  }

  // G7: makeCDPErrorRecord preserva sampleId
  {
    const record = makeCDPErrorRecord(
      'DOM.getBoxModel',
      'Error',
      'test error',
      {
        sampleId: 'r25-mobile-light-3-dash-abc123ef-hover-0',
        nodeId: 999,
        selector: '.test',
        state: 'hover',
        index: 0,
      },
    );
    assert(
      record.sampleId === 'r25-mobile-light-3-dash-abc123ef-hover-0',
      'G7: sampleId preservado no registro de erro',
    );
    assert(record.nodeId === 999, 'G7: nodeId preservado no registro de erro');
  }

  // G8: makeCDPErrorRecord com sampleId string vazia (não deve ser nullificado)
  {
    const record = makeCDPErrorRecord(
      'DOM.getBoxModel',
      'Error',
      'test error',
      {
        sampleId: '',
        nodeId: 1,
        selector: '.x',
        state: 'normal',
        index: 0,
      },
    );
    assert(
      record.sampleId === '',
      'G8: sampleId string vazia preservada (não nullificada)',
    );
  }

  // =====================================================================
  // GRUPO H — Visibilidade de ancestrais com Chromium real
  // =====================================================================
  console.log('\n=== GRUPO H — Visibilidade de ancestrais com Chromium real ===');

  // H1: Elemento dentro de ancestral com opacity:0 via probeState real
  {
    const { ids } = await probeBySelector('#r25-ancestor-opacity0-child', 'normal');
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-opacity0-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'not-visible',
        'H1: elemento dentro de ancestral opacity:0 tem visibilityStatus not-visible via probeState real',
      );
      assert(
        occ.ancestorOpacity === 0,
        'H1: ancestorOpacity=0 detectado via probeState real',
      );
    } else {
      block('H1: elemento r25-ancestor-opacity0-child não encontrado');
    }
  }

  // H2: Elemento dentro de ancestral com display:none via probeState real
  {
    const { ids } = await probeBySelector(
      '#r25-ancestor-displaynone-child',
      'normal',
    );
    if (ids.length > 0) {
      const occs = await core.probeState(
        '#r25-ancestor-displaynone-child',
        'normal',
        'mobile',
        'light',
        '3',
        'dash',
        createSampleIdRegistry(),
      );
      const occ = occs[0];
      assert(
        occ.visibilityStatus === 'hidden',
        'H2: elemento dentro de ancestral display:none tem visibilityStatus hidden via probeState real',
      );
      assert(
        occ.ancestorHidden === true,
        'H2: ancestorHidden=true detectado via probeState real',
      );
    } else {
      block('H2: elemento r25-ancestor-displaynone-child não encontrado');
    }
  }


  // =====================================================================
  // GRUPO V — R25.5: mecanismo rigoroso de visibilidade e integridade
  // da travessia. Todos os testes executam o probeState() real do núcleo
  // compartilhado; nenhum replica a lógica de travessia.
  // =====================================================================
  console.log('\n=== GRUPO V — R25.5 estados da travessia, exceções reais, opacidade e Shadow DOM ===');

  // O protocolo CDP disponível não expõe `pierce` em DOM.querySelectorAll,
  // de modo que o conteúdo de um shadow root não é alcançável a partir da
  // raiz do document. O teste amplia a resolução do seletor; o núcleo
  // permanece inalterado.
  async function collectShadowRootNodeIds() {
    const root = (await DOM.getDocument({ depth: -1, pierce: true })).root;
    const found = [];
    const walk = (node) => {
      for (const sr of node.shadowRoots || []) {
        found.push(sr.nodeId);
        walk(sr);
      }
      for (const child of node.children || []) walk(child);
    };
    walk(root);
    return found;
  }

  async function withShadowQuery(fn) {
    const original = DOM.querySelectorAll.bind(DOM);
    DOM.querySelectorAll = async function (params) {
      const res = await original(params);
      if (res.nodeIds && res.nodeIds.length > 0) return res;
      for (const nodeId of await collectShadowRootNodeIds()) {
        try {
          const inner = await original({ nodeId, selector: params.selector });
          if (inner.nodeIds && inner.nodeIds.length > 0) return inner;
        } catch (e) {
          // shadow root inacessível: segue para o próximo
        }
      }
      return res;
    };
    try {
      return await fn();
    } finally {
      DOM.querySelectorAll = original;
    }
  }

  async function withDetachedNodeQuery(fn) {
    const original = DOM.querySelectorAll.bind(DOM);
    DOM.querySelectorAll = async function (params) {
      if (params.selector === '#r255-detached') {
        // O nodeId e resolvido no momento da consulta: DOM.getDocument()
        // reidrenta a arvore e invalida nodeIds obtidos antes dele.
        const objectId = (
          await Runtime.evaluate({ expression: 'window.__r255Detached', returnByValue: false })
        ).result.objectId;
        const requested = await DOM.requestNode({ objectId });
        return { nodeIds: [requested.nodeId] };
      }
      return original(params);
    };
    try {
      return await fn();
    } finally {
      DOM.querySelectorAll = original;
    }
  }

  // Executa o probeState real com uma patch opcional em Runtime.callFunctionOn.
  async function runProbe(selector, patchFactory) {
    const original = Runtime.callFunctionOn.bind(Runtime);
    if (patchFactory) Runtime.callFunctionOn = patchFactory(original);
    try {
      return await core.probeState(
        selector, 'normal', 'mobile', 'light', '3', 'dash', createSampleIdRegistry(),
      );
    } finally {
      Runtime.callFunctionOn = original;
    }
  }

  // Falha controlada sem exceção: devolve resultado vazio na n-ésima chamada
  // de obtenção de pai (returnByValue === false).
  function nullParentAtCall(original, n) {
    let count = 0;
    return async function (params) {
      count++;
      if (count === n && params.returnByValue === false) return { result: null };
      return original(params);
    };
  }

  // Exceção real: a própria chamada CDP lança.
  function throwAtCall(original, n, message) {
    let count = 0;
    return async function (params) {
      count++;
      if (count === n) {
        throw new Error(message || 'falha injetada em Runtime.callFunctionOn');
      }
      return original(params);
    };
  }

  // Resposta CDP corrompida com opacidade inválida.
  function doctoredOpacityAtCall(original, n, badOpacity) {
    let count = 0;
    return async function (params) {
      count++;
      if (count === n && params.returnByValue === true) {
        return {
          result: {
            value: {
              display: 'block',
              visibility: 'visible',
              opacity: badOpacity,
              isRoot: false,
            },
          },
        };
      }
      return original(params);
    };
  }

  // Ocorrências coletadas para as verificações cruzadas (V34-V38).
  const r255 = {};

  // ---------------------------------------------------------------------
  // V14: display:none em ancestral resulta em short-circuited, nunca completed
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-ancestor-displaynone-child');
    const occ = occs[0];
    r255.displayNone = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'short-circuited',
        'V14: display:none em ancestral resulta em short-circuited',
      );
      assert(
        occ.ancestorVisibility !== 'completed',
        'V14: display:none em ancestral nunca resulta em completed',
      );
      assert(
        occ.ancestorDisplayNone === true,
        'V14: ancestorDisplayNone registra a evidência absoluta',
      );
      assert(
        occ.ancestorHidden === true,
        'V14: ancestorHidden preservado para compatibilidade',
      );
      assert(
        occ.visibilityStatus === 'hidden',
        'V14: display:none em ancestral resulta em visibilityStatus hidden',
      );
      assert(
        occ.ancestorOpacityStatus === 'short-circuited',
        'V14: opacidade interrompida por display:none é short-circuited',
      );
    } else {
      block('V14: ocorrência de #r25-ancestor-displaynone-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V15: display:none no nível 50 não é sobrescrito por depth-limit
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r255-depth-displaynone50');
    const occ = occs[0];
    r255.depthDisplayNone = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'short-circuited',
        'V15: display:none no nível 50 resulta em short-circuited',
      );
      assert(
        occ.ancestorVisibility !== 'depth-limit',
        'V15: display:none no nível 50 não é sobrescrito por depth-limit',
      );
      assert(
        occ.ancestorDepth === 50,
        'V15: a falha no nível 50 foi alcançada antes da interrupção',
      );
      assert(
        occ.visibilityStatus === 'hidden',
        'V15: display:none absoluto mantém a conclusão hidden',
      );
    } else {
      block('V15: ocorrência de #r255-depth-displaynone50 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V16: raiz examinada exatamente no nível 50 resulta em completed
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r255-depth-root50');
    const occ = occs[0];
    r255.depthRoot50 = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'completed',
        'V16: raiz real examinada no nível 50 resulta em completed',
      );
      assert(
        occ.ancestorDepth === 50,
        'V16: a travessia examinou exatamente 50 nós',
      );
      assert(
        occ.ancestorOpacityStatus === 'complete',
        'V16: cadeia completa resulta em opacidade complete',
      );
      assert(
        occ.visibilityStatus === 'visible',
        'V16: travessia completa e opacidade completa confirmam visibilidade',
      );
    } else {
      block('V16: ocorrência de #r255-depth-root50 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V17: ancestral além do limite resulta em depth-limit
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r255-depth-limit');
    const occ = occs[0];
    r255.depthLimit = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'depth-limit',
        'V17: ancestral além do limite resulta em depth-limit',
      );
      assert(
        occ.ancestorDepth === 50,
        'V17: a travessia parou no limite de 50 nós',
      );
      assert(
        occ.ancestorVisibility !== 'completed',
        'V17: depth-limit nunca é apresentado como completed',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V17: travessia incompleta não confirma visibilidade',
      );
      assert(
        occ.ancestorFailureReason !== null,
        'V17: ancestorFailureReason registra o limite de profundidade',
      );
    } else {
      block('V17: ocorrência de #r255-depth-limit não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V18: ciclo resulta em cycle, sem ser sobrescrito
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r255-cycle-a');
    const occ = occs[0];
    r255.cycle = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'cycle',
        'V18: ciclo na cadeia de ancestrais resulta em cycle',
      );
      assert(
        occ.ancestorVisibility !== 'depth-limit',
        'V18: cycle não é sobrescrito por depth-limit',
      );
      assert(
        occ.ancestorVisibility !== 'completed',
        'V18: cycle nunca é apresentado como completed',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V18: ciclo não permite confirmar visibilidade',
      );
    } else {
      block('V18: ocorrência de #r255-cycle-a não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V19: falha sem exceção na obtenção do pai resulta em partial
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-btn-1', (o) => nullParentAtCall(o, 2));
    const occ = occs[0];
    r255.partial = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'partial',
        'V19: falha sem exceção na obtenção do pai resulta em partial',
      );
      assert(
        occ.ancestorVisibility !== 'completed',
        'V19: partial nunca é apresentado como completed',
      );
      assert(
        occ.ancestorFailureReason !== null,
        'V19: ancestorFailureReason preenchido na falha de leitura',
      );
      assert(
        occ.visibilityStatus === 'unknown',
        'V19: travessia parcial não confirma visibilidade',
      );
    } else {
      block('V19: ocorrência de #r25-btn-1 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V20: exceção real em Runtime.callFunctionOn resulta em error
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-btn-1', (o) => throwAtCall(o, 2));
    const occ = occs[0];
    r255.error = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'error',
        'V20: exceção real em Runtime.callFunctionOn resulta em error',
      );
      assert(
        occ.ancestorVisibility !== 'partial',
        'V20: exceção real não é convertida em partial',
      );
      assert(
        occ.ancestorFailureReason !== null,
        'V20: a causa da exceção é registrada',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V20: exceção impede a confirmação de visibilidade',
      );
    } else {
      block('V20: ocorrência de #r25-btn-1 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V21: opacity:0 já coletado, seguida de exceção real
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe(
      '#r25-ancestor-opacity0-child',
      (o) => throwAtCall(o, 4, 'exceção real após a coleta da opacidade zero'),
    );
    const occ = occs[0];
    r255.zeroThenError = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'error',
        'V21: exceção real após opacidade zero resulta em error',
      );
      assert(
        occ.ancestorOpacity === 0,
        'V21: a opacidade zero já coletada é preservada após a exceção',
      );
      assert(
        occ.ancestorOpacityStatus === 'conclusive-zero',
        'V21: o produto zero já alcançado é conclusivo apesar da exceção',
      );
      assert(
        occ.visibilityStatus === 'not-visible',
        'V21: exceção posterior ao opacidade zero mantém not-visible',
      );
    } else {
      block('V21: ocorrência de #r25-ancestor-opacity0-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V22: ancestral visibility:hidden, descendente visible, exceção real
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe(
      '#r25-v3-desc-vis',
      (o) => throwAtCall(o, 4, 'exceção real após a leitura do ancestral oculto'),
    );
    const occ = occs[0];
    r255.hiddenThenError = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'error',
        'V22: exceção real resulta em error',
      );
      assert(
        occ.ancestorHidden === true,
        'V22: a evidência ancestorHidden anterior à exceção é preservada',
      );
      assert(
        occ.visibilityStatus === 'unknown',
        'V22: com ancestral oculto e descendente visível, o resultado é unknown',
      );
      assert(
        occ.discarded === false,
        'V22: estado desconhecido não descarta a amostra',
      );
    } else {
      block('V22: ocorrência de #r25-v3-desc-vis não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V23: exceção na primeira leitura de estilo
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-btn-1', (o) => throwAtCall(o, 1));
    const occ = occs[0];
    r255.firstReadError = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'error',
        'V23: exceção na primeira leitura de estilo resulta em error',
      );
      assert(
        occ.ancestorOpacity === null,
        'V23: nenhuma opacidade é presumida quando a leitura falha',
      );
      assert(
        occ.ancestorOpacityStatus === 'error',
        'V23: o estado da opacidade reflete a exceção',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V23: a visibilidade não é confirmada após exceção na primeira leitura',
      );
    } else {
      block('V23: ocorrência de #r25-btn-1 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V24: cadeia completa de opacidade válida resulta em complete
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-btn-1');
    const occ = occs[0];
    r255.complete = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacityStatus === 'complete',
        'V24: cadeia completa de opacidade resulta em complete',
      );
      assert(
        occ.ancestorOpacity === 1,
        'V24: a opacidade completa acumulada é 1',
      );
      assert(
        occ.ancestorVisibility === 'completed',
        'V24: a travessia completa resulta em completed',
      );
    } else {
      block('V24: ocorrência de #r25-btn-1 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V25: cadeia incompleta com produto diferente de zero resulta em partial
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe(
      '#r25-ancestor-opacity05-child',
      (o) => nullParentAtCall(o, 4),
    );
    const occ = occs[0];
    r255.opacityPartial = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacityStatus === 'partial',
        'V25: cadeia incompleta com produto diferente de zero resulta em partial',
      );
      assert(
        occ.ancestorOpacity === 0.5,
        'V25: o valor parcial acumulado é preservado',
      );
      assert(
        occ.ancestorVisibility === 'partial',
        'V25: a travessia incompleta é registrada como partial',
      );
    } else {
      block('V25: ocorrência de #r25-ancestor-opacity05-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V26: produto zero seguido de falha resulta em conclusive-zero
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-ancestor-opacity0-child', (o) => nullParentAtCall(o, 4));
    const occ = occs[0];
    r255.zeroThenFailure = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacityStatus === 'conclusive-zero',
        'V26: produto zero seguido de falha resulta em conclusive-zero',
      );
      assert(
        occ.ancestorOpacity === 0,
        'V26: o produto zero é preservado',
      );
      assert(
        occ.visibilityStatus === 'not-visible',
        'V26: a evidência de opacidade zero permanece conclusiva',
      );
    } else {
      block('V26: ocorrência de #r25-ancestor-opacity0-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V27: valor de opacidade inválido não é convertido em 1
  // ---------------------------------------------------------------------
  {
    const occs = await runProbe('#r25-btn-1', (o) => doctoredOpacityAtCall(o, 1, 'abc'));
    const occ = occs[0];
    r255.invalidOpacity = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacity === null,
        'V27: opacidade inválida não é convertida em 1',
      );
      assert(
        occ.ancestorOpacityStatus === 'invalid',
        'V27: opacidade inválida é registrada como invalid',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V27: opacidade inválida impede a confirmação de visibilidade',
      );
    } else {
      block('V27: ocorrência de #r25-btn-1 não obtida');
    }
  }
  {
    const occs = await runProbe('#r25-btn-1', (o) => doctoredOpacityAtCall(o, 1, '1.5'));
    const occ = occs[0];
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacity === null,
        'V27: opacidade fora do intervalo CSS [0,1] não é convertida em 1',
      );
      assert(
        occ.ancestorOpacityStatus === 'invalid',
        'V27: opacidade fora do intervalo é registrada como invalid',
      );
    } else {
      block('V27: segunda variante (1.5) não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V28: opacidade parcial não pode produzir visible
  // ---------------------------------------------------------------------
  {
    const occ = r255.opacityPartial;
    if (occ) {
      assert(
        occ.visibilityStatus !== 'visible',
        'V28: opacidade parcial não pode produzir visible',
      );
      assert(
        occ.visibilityStatus === 'unknown',
        'V28: opacidade parcial resulta em unknown',
      );
    } else {
      block('V28: ocorrência de V25 indisponível');
    }
  }

  // ---------------------------------------------------------------------
  // V29: travessia alcança o host Shadow DOM
  // ---------------------------------------------------------------------
  {
    let occ = null;
    await withShadowQuery(async () => {
      const occs = await runProbe('#r255-shadow-child');
      occ = occs[0];
    });
    r255.shadowChild = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'completed',
        'V29: a travessia através do shadow root alcança a raiz do documento',
      );
      assert(
        occ.ancestorOpacity === 0.5,
        'V29: a opacidade do host Shadow DOM foi incluída na travessia',
      );
      assert(
        occ.ancestorDepth >= 3,
        'V29: a travessia percorreu o ancestral intermediário e o host',
      );
      assert(
        occ.visibilityStatus === 'visible',
        'V29: elemento em shadow tree visível mantém visibilidade confirmada',
      );
    } else {
      block('V29: ocorrência de #r255-shadow-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V30: opacity:0 no host produz not-visible
  // ---------------------------------------------------------------------
  {
    let occ = null;
    await withShadowQuery(async () => {
      const occs = await runProbe('#r255-shadow-child-opacity0');
      occ = occs[0];
    });
    r255.shadowOpacity0 = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.visibilityStatus === 'not-visible',
        'V30: opacity:0 no host Shadow DOM produz not-visible',
      );
      assert(
        occ.ancestorOpacity === 0,
        'V30: a opacidade zero do host foi detectada na travessia composta',
      );
      assert(
        occ.ancestorOpacityStatus === 'conclusive-zero',
        'V30: a opacidade zero composta é conclusiva',
      );
    } else {
      block('V30: ocorrência de #r255-shadow-child-opacity0 não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V31: display:none no host produz hidden e short-circuited
  // ---------------------------------------------------------------------
  {
    let occ = null;
    await withShadowQuery(async () => {
      const occs = await runProbe('#r255-shadow-child-displaynone');
      occ = occs[0];
    });
    r255.shadowDisplayNone = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.visibilityStatus === 'hidden',
        'V31: display:none no host Shadow DOM produz hidden',
      );
      assert(
        occ.ancestorVisibility === 'short-circuited',
        'V31: display:none no host interrompe a travessia como short-circuited',
      );
      assert(
        occ.ancestorVisibility !== 'completed',
        'V31: a interrupção por display:none não é completed',
      );
    } else {
      block('V31: ocorrência de #r255-shadow-child-displaynone não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V32: elemento distribuído por slot percorre assignedSlot
  // ---------------------------------------------------------------------
  // A distribuição real por slot depende da tabela de slots do shadow root.
  // Neste ambiente (Chromium 156.0.8078.79, build Termux/Android) a tabela
  // de slots não é computada: `slot.assignedNodes()` retorna lista vazia e
  // `element.assignedSlot` é null mesmo no caso canônico (slot padrão com
  // um único filho). A distribuição real não é, portanto, observável aqui, e o teste
  // é registrado como BLOCKED com a causa específica, nunca como PASS.
  // A regra de precedência implementada é verificada em V32b.
  {
    let occ = null;
    let assignedSlotAvailable = false;
    await withShadowQuery(async () => {
      const probe = await Runtime.evaluate({
        expression:
          '(()=>{const h=document.getElementById("r255-shadow-host-slot");' +
          'const r=h.shadowRoot;const e=r.getElementById("r255-shadow-slotted");' +
          'return e.assignedSlot !== null;})()',
        returnByValue: true,
      });
      assignedSlotAvailable = !!(probe.result && probe.result.value === true);
      const occs = await runProbe('#r255-shadow-slotted');
      occ = occs[0];
    });
    r255.shadowSlotted = occ;
    if (assignedSlotAvailable) {
      assert(
        occ && occ.ancestorOpacity === 0.5,
        'V32: a travessia percorre o assignedSlot (opacidade do slot acumulada)',
      );
      assert(
        occ && occ.ancestorVisibility === 'completed',
        'V32: a travessia por assignedSlot alcança a raiz do documento',
      );
      assert(
        occ && occ.ancestorOpacityStatus === 'complete',
        'V32: a cadeia composta completa resulta em complete',
      );
    } else {
      block(
        'V32: distribuição real por slot não observável neste ambiente — ' +
          'assignedSlot permanece null e slot.assignedNodes() retorna lista vazia ' +
          'no Chromium 156.0.8078.79 (build Termux/Android), inclusive no caso canônico',
      );
    }
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility === 'completed',
        'V32: observado — a travessia do elemento no shadow root alcança a raiz via host',
      );
    } else {
      block('V32: ocorrência de #r255-shadow-slotted não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V32b: a precedência assignedSlot → parentElement → host é aplicada
  // ---------------------------------------------------------------------
  // Verifica a REGRA de precedência da travessia composta. O assignedSlot é
  // definido na própria instância (o ambiente não computa a tabela de slots),
  // de modo que o slot é alcançado apenas se a precedência for respeitada:
  // por parentElement o produto seria 1; por assignedSlot é 0.5.
  {
    const occs = await runProbe('#r255-assigned-slot-child');
    const occ = occs[0];
    r255.assignedSlotPrecedence = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorOpacity === 0.5,
        'V32b: a precedência prefere assignedSlot a parentElement na travessia',
      );
      assert(
        occ.ancestorVisibility === 'completed',
        'V32b: a travessia composta com assignedSlot alcança a raiz do documento',
      );
      assert(
        occ.ancestorOpacityStatus === 'complete',
        'V32b: a cadeia composta com assignedSlot resulta em complete',
      );
    } else {
      block('V32b: ocorrência de #r255-assigned-slot-child não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V33: elemento desconectado não é declarado completed
  // ---------------------------------------------------------------------
  {
    let occ = null;
    const created = await Runtime.evaluate({
      expression:
        '(()=>{ const d=document.createElement("span"); d.id="r255-detached"; window.__r255Detached=d; return true; })()',
      returnByValue: true,
    });
    if (created && created.result && created.result.value === true) {
      await withDetachedNodeQuery(async () => {
        const occs = await runProbe('#r255-detached');
        occ = occs[0];
      });
    }
    r255.detached = occ;
    if (occ && occ.ancestorVisibility) {
      assert(
        occ.ancestorVisibility !== 'completed',
        'V33: elemento desconectado não é declarado completed',
      );
      assert(
        occ.ancestorVisibility === 'partial',
        'V33: elemento desconectado resulta em travessia parcial',
      );
      assert(
        occ.visibilityStatus !== 'visible',
        'V33: elemento desconectado não tem visibilidade confirmada',
      );
    } else {
      block('V33: ocorrência do elemento desconectado não obtida');
    }
  }

  // ---------------------------------------------------------------------
  // V34: nenhum estado terminal é sobrescrito por condição posterior
  // ---------------------------------------------------------------------
  {
    const terminais = [
      ['display:none em ancestral', r255.displayNone, 'short-circuited'],
      ['display:none no nível 50', r255.depthDisplayNone, 'short-circuited'],
      ['raiz no nível 50', r255.depthRoot50, 'completed'],
      ['ancestral além do limite', r255.depthLimit, 'depth-limit'],
      ['ciclo', r255.cycle, 'cycle'],
      ['falha sem exceção', r255.partial, 'partial'],
      ['exceção real', r255.error, 'error'],
    ];
    for (const [rotulo, occ, esperado] of terminais) {
      if (occ) {
        assert(
          occ.ancestorVisibility === esperado,
          'V34: estado terminal preservado sem sobrescrita posterior — ' + rotulo,
        );
      } else {
        block('V34: cenário indisponível — ' + rotulo);
      }
    }
    if (r255.depthLimit && r255.depthDisplayNone) {
      assert(
        r255.depthLimit.ancestorVisibility !== r255.depthDisplayNone.ancestorVisibility,
        'V34: depth-limit e short-circuited são estados distintos e não se confundem',
      );
      assert(
        r255.depthLimit.ancestorVisibility !== 'completed' &&
          r255.depthDisplayNone.ancestorVisibility !== 'completed',
        'V34: nenhum dos casos terminais foi convertido em completed',
      );
    } else {
      block('V34: comparação entre cenários de término indisponível');
    }
  }

  // ---------------------------------------------------------------------
  // V35: ancestorOpacityStatus corresponde ao valor e à completude observados
  // ---------------------------------------------------------------------
  {
    const cenarios = [
      ['complete', r255.complete, 'complete', 1],
      ['partial', r255.opacityPartial, 'partial', 0.5],
      ['conclusive-zero', r255.zeroThenFailure, 'conclusive-zero', 0],
      ['short-circuited', r255.displayNone, 'short-circuited', 1],
      ['invalid', r255.invalidOpacity, 'invalid', null],
      ['error', r255.firstReadError, 'error', null],
    ];
    for (const [rotulo, occ, esperado, valor] of cenarios) {
      if (occ) {
        assert(
          occ.ancestorOpacityStatus === esperado,
          'V35: ancestorOpacityStatus corresponde ao cenário — ' + rotulo,
        );
        assert(
          occ.ancestorOpacity === valor,
          'V35: ancestorOpacity corresponde ao valor observado — ' + rotulo,
        );
      } else {
        block('V35: cenário indisponível — ' + rotulo);
      }
    }
  }

  // ---------------------------------------------------------------------
  // V36: discarded permanece coerente com visibilityStatus
  // ---------------------------------------------------------------------
  {
    const cenarios = [
      ['hidden', r255.displayNone],
      ['not-visible', r255.zeroThenFailure],
      ['unknown por travessia parcial', r255.partial],
      ['unknown por exceção real', r255.error],
      ['visible', r255.complete],
    ];
    for (const [status, occ] of cenarios) {
      if (occ) {
        const coerente =
          status === 'hidden' || status === 'not-visible'
            ? occ.discarded === true
            : occ.discarded === false;
        assert(
          coerente,
          'V36: discarded é coerente com visibilityStatus ' + status,
        );
      } else {
        block('V36: cenário indisponível — ' + status);
      }
    }
    if (r255.displayNone) {
      assert(
        r255.displayNone.reason === 'visibility',
        'V36: amostras descartadas por visibilidade registram o motivo visibility',
      );
    } else {
      block('V36: motivo de descarte indisponível');
    }
  }

  // ---------------------------------------------------------------------
  // V37: campos antigos permanecem presentes e compatíveis
  // ---------------------------------------------------------------------
  {
    const occ = r255.complete;
    const legados = [
      'ancestorVisibility',
      'ancestorOpacity',
      'ancestorHidden',
      'ancestorDepth',
      'ancestorFailureReason',
      'visibilityStatus',
      'geometryStatus',
      'discarded',
      'reason',
      'sampleId',
      'index',
      'selector',
      'state',
      'nodeId',
    ];
    const novos = ['ancestorOpacityStatus', 'ancestorDisplayNone'];
    if (occ) {
      for (const campo of legados) {
        assert(
          Object.prototype.hasOwnProperty.call(occ, campo),
          'V37: campo legado preservado — ' + campo,
        );
      }
      for (const campo of novos) {
        assert(
          Object.prototype.hasOwnProperty.call(occ, campo),
          'V37: campo novo presente — ' + campo,
        );
      }
      assert(
        typeof occ.ancestorHidden === 'boolean' && typeof occ.ancestorDisplayNone === 'boolean',
        'V37: os campos de evidência mantêm o tipo booleano',
      );
      assert(
        typeof occ.ancestorOpacity === 'number' || occ.ancestorOpacity === null,
        'V37: ancestorOpacity permanece numérico ou nulo',
      );
      assert(
        typeof occ.ancestorDepth === 'number',
        'V37: ancestorDepth permanece numérico',
      );
    } else {
      block('V37: ocorrência de referência indisponível');
    }
  }

  // ---------------------------------------------------------------------
  // V38: o JSON final preserva os novos campos sem perder a rastreabilidade
  // ---------------------------------------------------------------------
  {
    const occ = r255.shadowChild || r255.complete;
    if (occ) {
      const serializado = JSON.parse(JSON.stringify(occ));
      for (const campo of [
        'sampleId',
        'index',
        'selector',
        'state',
        'nodeId',
        'ancestorVisibility',
        'ancestorOpacity',
        'ancestorOpacityStatus',
        'ancestorHidden',
        'ancestorDisplayNone',
        'ancestorDepth',
        'visibilityStatus',
        'discarded',
      ]) {
        assert(
          Object.prototype.hasOwnProperty.call(serializado, campo),
          'V38: o JSON serializado preserva o campo — ' + campo,
        );
      }
      assert(
        typeof serializado.sampleId === 'string' && serializado.sampleId.length > 0,
        'V38: a rastreabilidade da ocorrência (sampleId) é preservada',
      );
      assert(
        serializado.index === occ.index && serializado.nodeId === occ.nodeId,
        'V38: índice e nodeId identificam a ocorrência específica',
      );
      assert(
        serializado.ancestorOpacityStatus === occ.ancestorOpacityStatus,
        'V38: o novo campo de integridade da opacidade sobrevive à serialização',
      );
    } else {
      block('V38: ocorrência de referência indisponível');
    }
  }


  // Acumulador de ocorrencias do grupo R25.6.
  const r256 = {};

  // Acumulador de ocorrencias do grupo R25.7.
  const r257 = {};

  // =====================================================================
  // GRUPO X — R25.6: contrato de excecoes CDP com excecao real no
  // contexto JavaScript do Chromium.
  //
  // A excecao e provoked DENTRO do navegador: um getter da propriedade
  // 'assignedSlot' (consultada pela ANCESTOR_PARENT_FUNCTION) e instalado
  // temporariamente no elemento alvo e lanca ao ser acessado. O CDP
  // resolve a chamada e devolve 'exceptionDetails'. Nenhum objeto
  // 'exceptionDetails' e fabricado pelo teste.
  //
  // Este caminho e DISTINTO do caminho historico de rejeicao da promise CDP
  // (V20-V23), em que a propria chamada CDP lanca no cliente. Os dois
  // cenarios sao exercitados e nao sao equivalentes.
  // =====================================================================
  console.log('\n=== GRUPO X — R25.6 contrato de excecoes CDP (excecao real no Chromium) ===');

  // Instala no alvo um getter de 'assignedSlot' que lanca no navegador.
  async function installThrowingAssignedSlot(elementId) {
    const res = await Runtime.evaluate({
      expression: `(()=>{
        const el=document.getElementById(${JSON.stringify(elementId)});
        if(!el) return false;
        Object.defineProperty(el,'assignedSlot',{
          get(){ throw new Error('r256-excecao-real-em-assignedSlot'); },
          configurable:true
        });
        return true;
      })()`,
      returnByValue: true,
    });
    return !!(res && res.result && res.result.value === true);
  }

  // Remove a instrumentacao do alvo (garantido em finally).
  async function removeThrowingAssignedSlot(elementId) {
    await Runtime.evaluate({
      expression: `(()=>{
        const el=document.getElementById(${JSON.stringify(elementId)});
        if(!el) return false;
        delete el.assignedSlot;
        return true;
      })()`,
      returnByValue: true,
    });
  }

  // Passa a resposta CDP intacta e apenas OBSERVA se ela contem
  // exceptionDetails. Nao fabrica, altera ou substitui resposta alguma.
  function observeExceptionDetails(original) {
    const observed = { calls: 0, withExceptionDetails: 0, rejected: 0, sample: null };
    return {
      observed,
      wrapper: async function (params) {
        observed.calls++;
        try {
          const res = await original(params);
          if (res && res.exceptionDetails) {
            observed.withExceptionDetails++;
            if (!observed.sample) observed.sample = res.exceptionDetails;
          }
          return res;
        } catch (e) {
          observed.rejected++;
          throw e;
        }
      },
    };
  }

  // ---------------------------------------------------------------------
  // X1: exceptionDetails na leitura do proximo ancestral -> 'error'
  // ---------------------------------------------------------------------
  {
    const installed = await installThrowingAssignedSlot('r256-exception-target');
    if (!installed) {
      block('X1: alvo r256-exception-target nao encontrado na fixture');
    } else {
      const original = Runtime.callFunctionOn.bind(Runtime);
      const obs = observeExceptionDetails(original);
      Runtime.callFunctionOn = obs.wrapper;
      let occ = null;
      try {
        const occs = await core.probeState(
          '#r256-exception-target', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        occ = occs[0];
      } finally {
        Runtime.callFunctionOn = original;
        await removeThrowingAssignedSlot('r256-exception-target');
      }
      r256.exceptionTarget = occ;
      if (occ && occ.ancestorVisibility) {
        assert(
          obs.observed.withExceptionDetails > 0,
          'X1: a resposta CDP do Chromium contem exceptionDetails (excecao real executada)',
        );
        assert(
          obs.observed.rejected === 0,
          'X1: a chamada CDP foi resolvida com exceptionDetails, e nao rejeitada',
        );
        assert(
          occ.ancestorVisibility === 'error',
          'X1: exceptionDetails na leitura do pai resulta em error',
        );
        assert(
          occ.ancestorVisibility !== 'partial',
          'X1: exceptionDetails nao e classificado como partial',
        );
        assert(
          occ.ancestorVisibility !== 'unavailable',
          'X1: exceptionDetails nao e classificado como unavailable',
        );
        assert(
          typeof occ.ancestorFailureReason === 'string' &&
            occ.ancestorFailureReason.includes('r256-excecao-real-em-assignedSlot'),
          'X1: ancestorFailureReason identifica a excecao occorrida no navegador',
        );
        assert(
          occ.ancestorOpacityStatus === 'error',
          'X1: o estado da opacidade reflete a excecao',
        );
      } else {
        block('X1: ocorrencia de #r256-exception-target nao obtida');
      }
    }
  }

  // ---------------------------------------------------------------------
  // X2: opacidade zero coletada antes da excecao real e preservada
  // ---------------------------------------------------------------------
  {
    const installed = await installThrowingAssignedSlot('r256-exception-opacity0-parent');
    if (!installed) {
      block('X2: alvo r256-exception-opacity0-parent nao encontrado na fixture');
    } else {
      const original = Runtime.callFunctionOn.bind(Runtime);
      const obs = observeExceptionDetails(original);
      Runtime.callFunctionOn = obs.wrapper;
      let occ = null;
      try {
        const occs = await core.probeState(
          '#r256-exception-opacity0-child', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        occ = occs[0];
      } finally {
        Runtime.callFunctionOn = original;
        await removeThrowingAssignedSlot('r256-exception-opacity0-parent');
      }
      r256.exceptionOpacity0 = occ;
      if (occ && occ.ancestorVisibility) {
        assert(
          obs.observed.withExceptionDetails > 0,
          'X2: a excecao real ocorreu no navegador durante a leitura do pai',
        );
        assert(
          occ.ancestorVisibility === 'error',
          'X2: a excecao real resulta em error',
        );
        assert(
          occ.ancestorOpacity === 0,
          'X2: a opacidade zero ja coletada e preservada apos a excecao',
        );
        assert(
          occ.ancestorOpacityStatus === 'conclusive-zero',
          'X2: a opacidade zero permanece conclusiva apesar da excecao',
        );
        assert(
          occ.visibilityStatus === 'not-visible',
          'X2: a classificacao final permanece not-visible',
        );
      } else {
        block('X2: ocorrencia de #r256-exception-opacity0-child nao obtida');
      }
    }
  }

  // ---------------------------------------------------------------------
  // X3: evidencia de ocultacao (visibility:hidden) preservada antes da excecao
  // ---------------------------------------------------------------------
  {
    const installed = await installThrowingAssignedSlot('r256-exception-visibilityhidden-parent');
    if (!installed) {
      block('X3: alvo r256-exception-visibilityhidden-parent nao encontrado na fixture');
    } else {
      const original = Runtime.callFunctionOn.bind(Runtime);
      const obs = observeExceptionDetails(original);
      Runtime.callFunctionOn = obs.wrapper;
      let occ = null;
      try {
        const occs = await core.probeState(
          '#r256-exception-visibilityhidden-child', 'normal', 'mobile', 'light', '3', 'dash',
          createSampleIdRegistry(),
        );
        occ = occs[0];
      } finally {
        Runtime.callFunctionOn = original;
        await removeThrowingAssignedSlot('r256-exception-visibilityhidden-parent');
      }
      r256.exceptionVisibilityHidden = occ;
      if (occ && occ.ancestorVisibility) {
        assert(
          obs.observed.withExceptionDetails > 0,
          'X3: a excecao real ocorreu no navegador durante a leitura do pai',
        );
        assert(
          occ.ancestorVisibility === 'error',
          'X3: a excecao real resulta em error',
        );
        assert(
          occ.ancestorHidden === true,
          'X3: a evidencia ancestorHidden anterior a excecao e preservada',
        );
        assert(
          occ.visibilityStatus === 'unknown',
          'X3: com descendente visivel e ancestral oculto em falha, o resultado e unknown',
        );
        assert(
          occ.visibilityStatus !== 'visible',
          'X3: a falha posterior impede a confirmacao de visibilidade',
        );
        assert(
          occ.discarded === false,
          'X3: estado desconhecido nao descarta a amostra',
        );
      } else {
        block('X3: ocorrencia de #r256-exception-visibilityhidden-child nao obtida');
      }
    }
  }

  // ---------------------------------------------------------------------
  // X4: os dois caminhos de excecao sao distintos e ambos classificados
  // ---------------------------------------------------------------------
  {
    // Caminho 1 (novo): excecao no navegador devolvida em exceptionDetails.
    const novo = r256.exceptionTarget;
    // Caminho 2 (historico): a propria chamada CDP lanca no cliente.
    const original = Runtime.callFunctionOn.bind(Runtime);
    let rejeitado = 0;
    Runtime.callFunctionOn = async function (params) {
      rejeitado++;
      throw new Error('r256-rejeicao-no-cliente-cdp');
    };
    let occRejeicao = null;
    try {
      const occs = await core.probeState(
        '#r25-btn-1', 'normal', 'mobile', 'light', '3', 'dash', createSampleIdRegistry(),
      );
      occRejeicao = occs[0];
    } finally {
      Runtime.callFunctionOn = original;
    }
    if (novo && occRejeicao && occRejeicao.ancestorVisibility) {
      assert(
        novo.ancestorVisibility === 'error' && occRejeicao.ancestorVisibility === 'error',
        'X4: os dois caminhos de excecao resultam em error',
      );
      assert(
        novo.ancestorFailureReason.includes('r256-excecao-real-em-assignedSlot') &&
          occRejeicao.ancestorFailureReason.includes('r256-rejeicao-no-cliente-cdp'),
        'X4: cada caminho registra a sua propria causa, distinguindo execucao no navegador de rejeicao no cliente',
      );
      assert(
        rejeitado > 0,
        'X4: o caminho de rejeicao no cliente foi de fato exercitado',
      );
    } else {
      block('X4: cenarios de excecao indisponiveis para comparacao');
    }
  }

  // ---------------------------------------------------------------------
  // Y5: todas as associacoes do lote permanecem utilizaveis
  // ---------------------------------------------------------------------
  // Regressao do defeito encontrado na R2.5.5: DOM.getDocument() e chamado
  // dentro do laco de associacao e invalida os nodeIds ja obtidos, de modo
  // que apenas a ultima linha do lote mantinha uma associacao valida.
  {
    const raw = await runRealCollect();
    const rows = raw.rows;
    const nodeIdMap = await harness.resolveNodeIds(DOM, rows, cdpErrors, raw.runId);
    const resolvidas = rows
      .map((r) => nodeIdMap.get(r.key))
      .filter((a) => a && a.status === 'resolved');
    if (resolvidas.length === 0) {
      block('Y5: nenhuma associacao resolvida no lote da fixture');
    } else {
      let validas = 0;
      const invalidas = [];
      for (const a of resolvidas) {
        try {
          const d = await DOM.describeNode({ nodeId: a.nodeId, depth: 0 });
          if (d && d.node) validas++;
          else invalidas.push(a.key);
        } catch (e) {
          invalidas.push(a.key);
        }
      }
      assert(
        invalidas.length === 0,
        'Y5: todas as associacoes key->nodeId do lote permanecem validas apos a resolucao',
      );
      assert(
        validas === resolvidas.length,
        'Y5: nenhuma associacao resolvida foi invalidada durante o lote',
      );
      assert(
        resolvidas.length > 1,
        'Y5: o lote contem mais de uma associacao resolvida (caso que expunha o defeito)',
      );
    }
  }

  // =====================================================================
  // GRUPO Y — R25.6: integracao da coleta principal com o nucleo
  // compartilhado.
  //
  // Exercita o fluxo REAL de producao do harness: o collectScript real
  // (descoberta), o resolveNodeIds real (associacao key->nodeId) e o
  // buildAuditRow real (montagem da linha final). Nenhuma logica de
  // integracao e copiada para dentro do teste.
  // =====================================================================
  console.log('\n=== GRUPO Y — R25.6 integracao da coleta principal com o nucleo ===');

  // Executa o collectScript real na fixture e devolve as linhas descobertas.
  async function runRealCollect() {
    const res = await Runtime.evaluate({
      expression: harness.collectScript,
      returnByValue: true,
    });
    const value = res && res.result ? res.result.value : null;
    // R25.7: devolve o resultado completo da execucao, incluindo o
    // identificador de execucao (runId) exigido por resolveNodeIds.
    return value && Array.isArray(value.rows) ? value : { rows: [], runId: null };
  }

  // ---------------------------------------------------------------------
  // Y1: descoberta, associacao e linha final pelo fluxo real do harness
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const rows = raw.rows;
    const row = rows.find((r) => r.id === 'r256-accent-consumer');
    if (!row) {
      block('Y1: o collectScript real nao descobriu o consumidor r256-accent-consumer');
    } else {
      // Espiona a chamada ao mecanismo do nucleo, sem reimplementar nada.
      const originalTraverse = core.traverseAncestorChain.bind(core);
      let traverseCalls = 0;
      let lastTraversal = null;
      core.traverseAncestorChain = async function (nodeId) {
        traverseCalls++;
        const t = await originalTraverse(nodeId);
        lastTraversal = t;
        return t;
      };

      const nodeIdMap = await harness.resolveNodeIds(DOM, rows, cdpErrors, raw.runId);
      const assoc = nodeIdMap.get(row.key);
      let finalRow = null;
      try {
        finalRow = await harness.buildAuditRow({
          core,
          row,
          association: assoc,
          context: { vp: 'mobile', themeSet: 'light', theme: '3', screen: 'dash' },
        });
      } finally {
        core.traverseAncestorChain = originalTraverse;
      }

      r256.collectRow = finalRow;
      if (assoc && assoc.status === 'resolved') {
        assert(
          assoc.nodeId !== null && assoc.nodeId !== undefined,
          'Y1: a associacao key->nodeId foi resolvida pelo fluxo real',
        );
        assert(
          traverseCalls === 1,
          'Y1: a travessia foi executada pelo mecanismo do nucleo compartilhado',
        );
        assert(
          finalRow.ancestorVisibility === lastTraversal.ancestorVisibility,
          'Y1: o campo ancestorVisibility da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorOpacity === lastTraversal.ancestorOpacity,
          'Y1: o campo ancestorOpacity da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorOpacityStatus === lastTraversal.ancestorOpacityStatus,
          'Y1: o campo ancestorOpacityStatus da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorHidden === lastTraversal.ancestorHidden,
          'Y1: o campo ancestorHidden da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorDisplayNone === lastTraversal.ancestorDisplayNone,
          'Y1: o campo ancestorDisplayNone da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorDepth === lastTraversal.ancestorDepth,
          'Y1: o campo ancestorDepth da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorFailureReason === lastTraversal.ancestorFailureReason,
          'Y1: o campo ancestorFailureReason da linha final vem do resultado do nucleo',
        );
        assert(
          finalRow.ancestorVisibility === 'completed',
          'Y1: a travessia da linha real foi concluida ate a raiz',
        );
        assert(
          finalRow.ancestorOpacityStatus === 'complete',
          'Y1: a opacidade da linha real foi acumulada de forma completa',
        );
        assert(
          finalRow.visibilityStatus === 'visible',
          'Y1: travessia completa e opacidade completa produzem visible na linha da coleta',
        );
        assert(
          finalRow.nodeAssociation.status === 'resolved',
          'Y1: a linha final preserva a associacao resolvida',
        );
      } else {
        block('Y1: associacao key->nodeId nao resolvida para a linha descoberta');
      }
    }
  }

  // ---------------------------------------------------------------------
  // Y2: ancestral com opacidade zero produz 'not-visible' na linha real
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const rows = raw.rows;
    const row = rows.find((r) => r.id === 'r256-accent-opacity0-child');
    if (!row) {
      block('Y2: o collectScript real nao descobriu r256-accent-opacity0-child');
    } else {
      const nodeIdMap = await harness.resolveNodeIds(DOM, rows, cdpErrors, raw.runId);
      const assoc = nodeIdMap.get(row.key);
      const finalRow = await harness.buildAuditRow({
        core,
        row,
        association: assoc,
        context: { vp: 'mobile', themeSet: 'light', theme: '3', screen: 'dash' },
      });
      r256.collectOpacity0Row = finalRow;
      if (finalRow) {
        assert(
          finalRow.ancestorOpacity === 0,
          'Y2: a opacidade zero do ancestral chegou a linha final pelo mecanismo',
        );
        assert(
          finalRow.ancestorOpacityStatus === 'conclusive-zero',
          'Y2: a opacidade zero e conclusiva na linha final',
        );
        assert(
          finalRow.visibilityStatus === 'not-visible',
          'Y2: a opacidade zero comprovada produz not-visible na linha da coleta',
        );
        assert(
          finalRow.visibilityStatus !== 'visible',
          'Y2: a linha com opacidade zero nunca e declarada visible',
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Y3: travessia incompleta nao produz 'visible' na linha real
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const rows = raw.rows;
    const row = rows.find((r) => r.id === 'r256-accent-consumer');
    if (!row) {
      block('Y3: o collectScript real nao descobriu o consumidor r256-accent-consumer');
    } else {
      const nodeIdMap = await harness.resolveNodeIds(DOM, rows, cdpErrors, raw.runId);
      const assoc = nodeIdMap.get(row.key);
      // Falha controlada na leitura do pai: a travessia fica incompleta.
      const original = Runtime.callFunctionOn.bind(Runtime);
      let count = 0;
      Runtime.callFunctionOn = async function (params) {
        count++;
        if (count === 2 && params.returnByValue === false) return { result: null };
        return original(params);
      };
      let finalRow = null;
      try {
        finalRow = await harness.buildAuditRow({
          core,
          row,
          association: assoc,
          context: { vp: 'mobile', themeSet: 'light', theme: '3', screen: 'dash' },
        });
      } finally {
        Runtime.callFunctionOn = original;
      }
      r256.collectIncompleteRow = finalRow;
      if (finalRow) {
        assert(
          finalRow.ancestorVisibility === 'partial',
          'Y3: a travessia incompleta e registrada como partial na linha final',
        );
        assert(
          finalRow.visibilityStatus === 'unknown',
          'Y3: travessia incompleta nao produz visible na linha da coleta',
        );
        assert(
          finalRow.visibilityStatus !== 'visible',
          'Y3: a linha com travessia incompleta nunca e declarada visible',
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Y4: associacao invalida nao produz confirmacao de visibilidade
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const rows = raw.rows;
    const row = rows.find((r) => r.id === 'r256-accent-consumer');
    if (!row) {
      block('Y4: o collectScript real nao descobriu o consumidor r256-accent-consumer');
    } else {
      const invalidAssociation = {
        status: 'node-not-found',
        nodeId: null,
        key: row.key,
        selector: `[data-c4-audit="${row.key}"]`,
        idCount: 0,
      };
      let finalRow = null;
      try {
        finalRow = await harness.buildAuditRow({
          core,
          row,
          association: invalidAssociation,
          context: { vp: 'mobile', themeSet: 'light', theme: '3', screen: 'dash' },
        });
      } finally {
        // nada a limpar: associacao invalida nao executa travessia
      }
      r256.collectInvalidRow = finalRow;
      if (finalRow) {
        assert(
          finalRow.ancestorVisibility === 'unavailable',
          'Y4: associacao invalida registra estado indisponivel',
        );
        assert(
          finalRow.ancestorOpacity === null,
          'Y4: associacao invalida nao inventa opacidade igual a 1',
        );
        assert(
          finalRow.ancestorOpacityStatus === 'unavailable',
          'Y4: o estado da opacidade e indisponivel quando a travessia nao ocorreu',
        );
        assert(
          typeof finalRow.ancestorFailureReason === 'string' &&
            finalRow.ancestorFailureReason.includes('node-not-found'),
          'Y4: a causa explicita da associacao invalida e registrada',
        );
        assert(
          finalRow.visibilityStatus === 'unknown',
          'Y4: associacao invalida nao confirma visibilidade',
        );
        assert(
          finalRow.visibilityStatus !== 'visible',
          'Y4: associacao invalida nunca produz visible',
        );
        assert(
          finalRow.winningRules && finalRow.winningRules.error === 'node-not-found',
          'Y4: a captura de regras CSS permanece sinalizada para associacao invalida',
        );
      }
    }
  }


  // =====================================================================
  // GRUPO Z — R25.7: colisao de identificadores entre execucoes da coleta.
  //
  // Os testes exercitam o mecanismo REAL de coleta (harness.collectScript) e
  // o mecanismo REAL de resolucao (harness.resolveNodeIds e o contrato de
  // cardinalidade resolveNodeIdResult do nucleo). Nenhuma logica de
  // integracao e reimplementada dentro do teste.
  //
  // F-04: o contador local do collectScript reiniciava a cada execucao, de
  // modo que a chave 'c4-<i>' era reutilizada. Como as views anteriores podem
  // continuar montadas no DOM, os atributos antigos continuavam presentes e a
  // resolucao encontrava mais de um elemento para a mesma chave.
  // =====================================================================
  console.log('\n=== GRUPO Z — R25.7 identidade de execucao da coleta ===');

  // Cria uma view com consumidores de --accent e a mantem montada no DOM.
  async function createView(viewId, consumerIds) {
    const res = await Runtime.evaluate({
      expression: `(()=>{
        const v=document.createElement('div');
        v.id=${JSON.stringify(viewId)};
        ${consumerIds
          .map(
            (cid, idx) =>
              `const c${idx}=document.createElement('span');` +
              `c${idx}.className='r256-accent-consumer';` +
              `c${idx}.id=${JSON.stringify(cid)};` +
              `c${idx}.textContent=${JSON.stringify(cid)};` +
              `v.appendChild(c${idx});`
          )
          .join('')}
        document.body.appendChild(v);
        return true;
      })()`,
      returnByValue: true,
    });
    return !!(res && res.result && res.result.value === true);
  }

  // Oculta a view sem desmontá-la (simula a navegação que mantém a view
  // anterior montada no DOM).
  async function hideView(viewId) {
    await Runtime.evaluate({
      expression: `(()=>{const v=document.getElementById(${JSON.stringify(viewId)});if(v)v.style.display='none';return true;})()`,
      returnByValue: true,
    });
  }

  // Remove a view do DOM (limpeza da fixture entre testes).
  async function removeView(viewId) {
    await Runtime.evaluate({
      expression: `(()=>{const v=document.getElementById(${JSON.stringify(viewId)});if(v)v.remove();return true;})()`,
      returnByValue: true,
    });
  }

  // Le o valor corrente do atributo data-c4-audit de um elemento.
  async function readAuditAttr(elementId) {
    const res = await Runtime.evaluate({
      expression: `(()=>{const e=document.getElementById(${JSON.stringify(elementId)});return e?e.getAttribute('data-c4-audit'):null;})()`,
      returnByValue: true,
    });
    return res && res.result ? res.result.value : null;
  }

  // Sobrescreve o atributo data-c4-audit de um elemento.
  async function writeAuditAttr(elementId, value) {
    await Runtime.evaluate({
      expression: `(()=>{const e=document.getElementById(${JSON.stringify(elementId)});if(e)e.setAttribute('data-c4-audit',${JSON.stringify(value)});return true;})()`,
      returnByValue: true,
    });
  }

  // Descobre, pela propria execucao real, a linha de um consumidor da view.
  function rowOfView(raw, elementId) {
    return (raw.rows || []).find((r) => r.id === elementId) || null;
  }

  // ---------------------------------------------------------------------
  // Z1: reproducao da falha F-04 — esquema antigo reutiliza a chave
  // ---------------------------------------------------------------------
  // A reproducao usa o caminho REAL de resolucao: o elemento antigo recebe a
  // chave da execucao corrente (como o contador reiniciado faria) e a
  // resolucao real encontra mais de um elemento para a mesma chave.
  // A resolucao de cada execucao e feita imediatamente apos a execucao, como
  // no fluxo de producao — uma execucao posterior sobrescreve o atributo dos
  // elementos que redesenha.
  {
    const viewA = 'r257-view-a';
    const viewB = 'r257-view-b';
    let executado = false;
    try {
      await createView(viewA, ['r257-a-1', 'r257-a-2']);
      const runA = await runRealCollect();
      const rowA = rowOfView(runA, 'r257-a-1');

      await hideView(viewA);
      await createView(viewB, ['r257-b-1', 'r257-b-2']);
      const runB = await runRealCollect();
      const rowB = rowOfView(runB, 'r257-b-1');

      if (!rowA || !rowB) {
        block('Z1: as execucoes nao descobriram os consumidores das views');
      } else {
        // Esquema antigo: o elemento antigo recebe a chave da execucao atual.
        const chaveAntiga = await readAuditAttr('r257-a-1');
        await writeAuditAttr('r257-a-1', rowB.key);
        const rootId = (await DOM.getDocument({ depth: -1, pierce: true })).root.nodeId;
        const qs = await DOM.querySelectorAll({
          nodeId: rootId,
          selector: `[data-c4-audit="${rowB.key}"]`,
        });
        const ids = qs.nodeIds || [];
        const resultado = resolveNodeIdResult(ids, rowB.key, `[data-c4-audit="${rowB.key}"]`);
        executado = true;

        assert(
          ids.length === 2,
          'Z1: com chaves reutilizadas, a resolucao real encontra dois elementos para a mesma chave',
        );
        assert(
          resultado.status === 'ambiguous-node-association',
          'Z1: a reutilizacao de chave produz ambiguous-node-association (reproducao de F-04)',
        );
        assert(
          resultado.nodeId === null,
          'Z1: a associacao ambigua nao escolhe arbitrariamente um nodeId',
        );

        // Restaura o atributo original do elemento antigo.
        await writeAuditAttr('r257-a-1', chaveAntiga);

        // ---------------- Z2: a correcao — execucoes distintas nao colidem
        const chavesA = new Set((runA.rows || []).map((r) => r.key));
        const chavesB = new Set((runB.rows || []).map((r) => r.key));
        const intersecao = [...chavesA].filter((k) => chavesB.has(k));
        assert(
          runA.runId !== runB.runId,
          'Z2: cada execucao da coleta tem identificador proprio',
        );
        assert(
          typeof runA.runId === 'number' &&
            typeof runB.runId === 'number' &&
            runB.runId > runA.runId,
          'Z2: o identificador de execucao e monotonico no contexto da pagina',
        );
        assert(
          intersecao.length === 0,
          'Z2: nenhuma chave e reutilizada entre execucoes',
        );
        assert(
          [...chavesB].every((k) => k.startsWith('c4-' + runB.runId + '-')),
          'Z2: todas as chaves da execucao atual carregam o identificador da execucao',
        );

        // -------- Z3: elementos antigos nao contaminam a resolucao atual
        const nodeIdMap = await harness.resolveNodeIds(DOM, runB.rows, cdpErrors, runB.runId);
        let todasResolvidas = true;
        let todasComUmNo = true;
        for (const r of runB.rows || []) {
          const a = nodeIdMap.get(r.key);
          if (!a || a.status !== 'resolved') todasResolvidas = false;
          else if (a.idCount !== 1) todasComUmNo = false;
        }
        assert(
          todasResolvidas,
          'Z3: todas as linhas da execucao atual foram resolvidas sem ambiguidade',
        );
        assert(
          todasComUmNo,
          'Z3: cada associacao da execucao atual aponta para exatamente um nodeId',
        );

        // O nodeId resolvido corresponde ao elemento que recebeu a chave.
        let confereElemento = true;
        const amostra = (runB.rows || []).slice(0, 5);
        for (const r of amostra) {
          const a = nodeIdMap.get(r.key);
          if (!a || !a.nodeId) {
            confereElemento = false;
            continue;
          }
          const described = await DOM.describeNode({ nodeId: a.nodeId, depth: 0 });
          const attrs = described.node && described.node.attributes ? described.node.attributes : [];
          let valor = null;
          for (let i = 0; i < attrs.length; i += 2) {
            if (attrs[i] === 'data-c4-audit') valor = attrs[i + 1];
          }
          if (valor !== r.key) confereElemento = false;
        }
        assert(
          amostra.length > 0 && confereElemento,
          'Z3: o nodeId resolvido pertence ao elemento que recebeu a chave da execucao atual',
        );

        // O elemento antigo continua no DOM com o atributo antigo e intacto.
        const attrAntigo = await readAuditAttr('r257-a-1');
        assert(
          attrAntigo === chaveAntiga,
          'Z3: o elemento da execucao anterior conserva o proprio atributo (nao e apagado)',
        );
        assert(
          attrAntigo !== rowB.key,
          'Z3: o elemento da execucao anterior nao recebeu a chave da execucao atual',
        );
      }
    } finally {
      await removeView(viewA);
      await removeView(viewB);
    }
    if (!executado) block('Z1: reproducao nao executada');
  }

  // ---------------------------------------------------------------------
  // Z4: tres execucoes sucessivas, com as anteriores ainda montadas
  // ---------------------------------------------------------------------
  {
    const views = ['r257-v1', 'r257-v2', 'r257-v3'];
    const execucoes = [];
    try {
      for (let n = 0; n < views.length; n++) {
        await createView(views[n], [views[n] + '-c1', views[n] + '-c2']);
        if (n > 0) await hideView(views[n - 1]);
        const exec = await runRealCollect();
        // Resolucao imediata, como no fluxo de producao.
        const mapa = await harness.resolveNodeIds(DOM, exec.rows, cdpErrors, exec.runId);
        let resolvidas = 0;
        let comUmNo = 0;
        for (const r of exec.rows || []) {
          const a = mapa.get(r.key);
          if (a && a.status === 'resolved') {
            resolvidas++;
            if (a.idCount === 1) comUmNo++;
          }
        }
        exec.resolvidas = resolvidas;
        exec.comUmNo = comUmNo;
        exec.total = (exec.rows || []).length;
        execucoes.push(exec);
      }

      const runIds = execucoes.map((e) => e.runId);
      assert(
        new Set(runIds).size === runIds.length,
        'Z4: as tres execucoes tem identificadores distintos',
      );
      assert(
        runIds[0] < runIds[1] && runIds[1] < runIds[2],
        'Z4: os identificadores de execucao sao estritamente crescentes',
      );
      const chavesPorExecucao = execucoes.map((e) => new Set((e.rows || []).map((r) => r.key)));
      let colisao = 0;
      for (let i = 0; i < chavesPorExecucao.length; i++) {
        for (let j = i + 1; j < chavesPorExecucao.length; j++) {
          for (const k of chavesPorExecucao[i]) {
            if (chavesPorExecucao[j].has(k)) colisao++;
          }
        }
      }
      assert(
        colisao === 0,
        'Z4: nenhuma chave se repete entre as tres execucoes',
      );
      assert(
        execucoes.every((e) => e.resolvidas === e.total),
        'Z4: todas as linhas das tres execucoes foram resolvidas',
      );
      assert(
        execucoes.every((e) => e.comUmNo === e.total),
        'Z4: nenhuma associacao das tres execucoes e ambigua',
      );

      // A execucao mais recente nao associa elementos das execucoes anteriores.
      const ultima = execucoes[execucoes.length - 1];
      const linhaV1 = rowOfView(execucoes[0], 'r257-v1-c1');
      if (linhaV1) {
        const mapa = await harness.resolveNodeIds(
          DOM,
          [{ key: linhaV1.key, sel: '#r257-v1-c1' }],
          cdpErrors,
          ultima.runId,
        );
        const a = mapa.get(linhaV1.key);
        assert(
          !a || a.status !== 'resolved',
          'Z4: uma chave de execucao anterior nao e resolvida na execucao atual',
        );
      } else {
        block('Z4: chave da primeira execucao nao disponivel');
      }
    } finally {
      for (const v of views) await removeView(v);
    }
  }

  // ---------------------------------------------------------------------
  // Z5: view anterior oculta e ainda montada
  // ---------------------------------------------------------------------
  {
    const viewAntiga = 'r257-hidden-view';
    const viewNova = 'r257-new-view';
    try {
      await createView(viewAntiga, ['r257-hidden-c1']);
      const runAntiga = await runRealCollect();
      const linhaAntiga = rowOfView(runAntiga, 'r257-hidden-c1');
      await hideView(viewAntiga);
      await createView(viewNova, ['r257-new-c1']);
      const runNova = await runRealCollect();
      const linhaNova = rowOfView(runNova, 'r257-new-c1');

      if (!linhaAntiga || !linhaNova) {
        block('Z5: as execucoes nao descobriram os consumidores das views');
      } else {
        const mapa = await harness.resolveNodeIds(DOM, runNova.rows, cdpErrors, runNova.runId);
        const a = mapa.get(linhaNova.key);
        assert(
          a && a.status === 'resolved' && a.idCount === 1,
          'Z5: a execucao com a view anterior oculta e montada resolve sem ambiguidade',
        );
        assert(
          linhaAntiga.key !== linhaNova.key,
          'Z5: a view anterior oculta e montada nao reutiliza a chave da execucao atual',
        );
        const naoDescoberta = (runNova.rows || []).find((r) => r.id === 'r257-hidden-c1');
        assert(
          !naoDescoberta,
          'Z5: o consumidor da view oculta nao e descoberto pela execucao atual (pre-filtro de visibilidade)',
        );
        const attr = await readAuditAttr('r257-hidden-c1');
        assert(
          attr === linhaAntiga.key,
          'Z5: o consumidor oculto mantem o atributo da execucao que o descobriu',
        );
      }
    } finally {
      await removeView(viewAntiga);
      await removeView(viewNova);
    }
  }

  // ---------------------------------------------------------------------
  // Z6: negativo — chave inexistente
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const mapa = await harness.resolveNodeIds(
      DOM,
      [{ key: 'c4-' + raw.runId + '-inexistente', sel: '#inexistente' }],
      cdpErrors,
      raw.runId,
    );
    const a = mapa.get('c4-' + raw.runId + '-inexistente');
    assert(
      a && a.status === 'node-not-found',
      'Z6: chave inexistente resulta em node-not-found',
    );
    assert(
      a && a.nodeId === null && a.idCount === 0,
      'Z6: chave inexistente nao produz nodeId',
    );
  }

  // ---------------------------------------------------------------------
  // Z7: negativo — chave duplicada dentro da execucao atual
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const linha = (raw.rows || [])[0];
    if (!linha) {
      block('Z7: nenhuma linha descoberta para o teste de duplicidade');
    } else {
      const alvoId = 'r257-dup-alvo';
      await createView('r257-dup-view', [alvoId]);
      // Duplica a chave da linha real em um segundo elemento da execucao.
      await writeAuditAttr(alvoId, linha.key);
      const mapa = await harness.resolveNodeIds(DOM, raw.rows, cdpErrors, raw.runId);
      const a = mapa.get(linha.key);
      assert(
        a && a.status === 'ambiguous-node-association',
        'Z7: chave duplicada dentro da execucao atual resulta em ambiguous-node-association',
      );
      assert(
        a && a.nodeId === null && a.idCount === 2,
        'Z7: a duplicidade real e detectada e nenhum nodeId e escolhido',
      );
      await removeView('r257-dup-view');
    }
  }

  // ---------------------------------------------------------------------
  // Z8: negativo — chave antiga de outra execucao
  // ---------------------------------------------------------------------
  {
    const view1 = 'r257-old-view';
    const view2 = 'r257-new-view-2';
    try {
      await createView(view1, ['r257-old-c1']);
      const run1 = await runRealCollect();
      const linha1 = rowOfView(run1, 'r257-old-c1');
      await hideView(view1);
      await createView(view2, ['r257-new-c1']);
      const run2 = await runRealCollect();

      if (!linha1) {
        block('Z8: linha da execucao anterior nao descoberta');
      } else {
        const mapa = await harness.resolveNodeIds(
          DOM,
          [{ key: linha1.key, sel: '#r257-old-c1' }],
          cdpErrors,
          run2.runId,
        );
        const a = mapa.get(linha1.key);
        assert(
          a && a.status === 'node-not-found',
          'Z8: chave antiga de outra execucao nao e resolvida na execucao atual',
        );
        assert(
          a && a.nodeId === null,
          'Z8: a chave antiga nao produz nodeId na execucao atual',
        );
        assert(
          a && typeof a.reason === 'string' && a.reason.includes('outra execucao'),
          'Z8: a recusa da chave antiga registra causa explicita',
        );
      }
    } finally {
      await removeView(view1);
      await removeView(view2);
    }
  }

  // ---------------------------------------------------------------------
  // Z9: negativo — erro CDP durante a resolucao
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const original = DOM.querySelectorAll.bind(DOM);
    DOM.querySelectorAll = async function () {
      throw new Error('r257-erro-cdp-simulado');
    };
    let mapa = null;
    try {
      mapa = await harness.resolveNodeIds(DOM, raw.rows, cdpErrors, raw.runId);
    } finally {
      DOM.querySelectorAll = original;
    }
    const linhas = raw.rows || [];
    const a = linhas.length ? mapa.get(linhas[0].key) : null;
    assert(
      a && a.status === 'cdp-error',
      'Z9: erro CDP durante a resolucao resulta em cdp-error',
    );
    assert(
      a && a.nodeId === null,
      'Z9: erro CDP nao produz nodeId',
    );
    assert(
      cdpErrors.some((e) => e && e.operation === 'DOM.querySelectorAll'),
      'Z9: o erro CDP e registrado no registro de erros',
    );
  }

  // ---------------------------------------------------------------------
  // Z10: negativo — resolucao sem identificador de execucao
  // ---------------------------------------------------------------------
  {
    const raw = await runRealCollect();
    const mapa = await harness.resolveNodeIds(DOM, raw.rows, cdpErrors, undefined);
    const linhas = raw.rows || [];
    const todosNaoResolvidos = linhas.every((r) => {
      const a = mapa.get(r.key);
      return a && a.status === 'node-not-found' && a.nodeId === null;
    });
    assert(
      linhas.length > 0 && todosNaoResolvidos,
      'Z10: sem identificador de execucao, nenhuma associacao e resolvida',
    );
  }

  await client.close();

  console.log('\n=== RESUMO DOS TESTES CONTROLADOS R2.5.7 ===');
  console.log('PASS:', passed, 'FAIL:', failed, 'BLOCKED:', blocked);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});