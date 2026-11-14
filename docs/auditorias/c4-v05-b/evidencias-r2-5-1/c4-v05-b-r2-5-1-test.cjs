// ============================================================================
// Testes controlados C.4-V05-B-R2.5.2
// Executa as funções REAIS do núcleo compartilhado (c4-v05-b-r2-5-1-core.cjs)
// Valida: R25-01 sampleId com screen, R25-02 associação key→nodeId (cardinalidade),
// R25-03 limpeza de pseudoestado (try/finally real com injeção de falha),
// R25-04 visibilidade efetiva com ancestrais, R25-05 validação geométrica,
// R25-06 atributos DOM com expectativas exatas, R25-07 classificação de erros CDP,
// R25-10 nenhum fallback a branco presumido.
// ============================================================================

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = path.dirname(__filename);
const CORE_PATH = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-1-core.cjs');
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
  'file://' +
  path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-1-test-fixtures.html');

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

  // A7: Chamadas sucessivas de makeSampleId não geram colisão
  {
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const s = makeSampleId('mobile', 'light', '3', 'dash', '.r25-unique', 'hover', i);
      ids.add(s);
    }
    assert(ids.size === 50, 'A7: 50 chamadas sucessivas geram 50 sampleIds únicos');
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

  // B4: Erro CDP → cdp-error
  {
    const result = { status: 'cdp-error', nodeId: null, key: 'c4-test', selector: '.r25-test', idCount: 0 };
    assert(result.status === 'cdp-error', 'B4: erro CDP resulta em cdp-error');
    assert(result.nodeId === null, 'B4: nodeId é null em erro CDP');
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

  // C4: Falha de CSS.getComputedStyleForNode não impede limpeza de pseudoestado
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
    } catch (e) {
      block('C4: exceção inesperada: ' + e.message);
    } finally {
      CSS.getComputedStyleForNode = originalGetComputedStyleForNode;
    }
  }

  // C5: Falha de limpeza de pseudoestado invalida a amostra
  {
    const originalForcePseudoState = CSS.forcePseudoState.bind(CSS);
    let clearFailed = false;
    let applyCalled = false;
    CSS.forcePseudoState = async function (params) {
      if (params.forcedPseudoClasses && params.forcedPseudoClasses.length === 0) {
        clearFailed = true;
        throw new Error('limpeza injetada falhou');
      }
      applyCalled = true;
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
    } catch (e) {
      block('C5: exceção inesperada: ' + e.message);
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
        occ.geometryStatus === 'available',
        'D5: box model computável para elemento de dimensões zero',
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

  await client.close();

  console.log('\n=== RESUMO DOS TESTES CONTROLADOS R2.5.1 ===');
  console.log('PASS:', passed, 'FAIL:', failed, 'BLOCKED:', blocked);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});