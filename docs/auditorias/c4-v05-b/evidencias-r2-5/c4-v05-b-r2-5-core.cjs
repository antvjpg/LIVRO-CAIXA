// ============================================================================
// Núcleo compartilhado e testável do harness C.4-V05-B-R2.5
// Correções R25-01 a R25-06 aplicadas sobre o núcleo R2.4.
// Funções puras podem ser testadas sem CDP.
// Funções dependentes de CDP são criadas via factory createCDPAuditCore.
// ============================================================================

const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Funções puras (testáveis sem CDP)
// ---------------------------------------------------------------------------

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseColor(c) {
  if (!c) return null;
  c = String(c).trim();
  const lower = c.toLowerCase();
  if (lower.startsWith('rgba(') && lower.endsWith(')')) {
    const inner = lower.slice(5, -1);
    const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3) return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  }
  if (lower.startsWith('rgb(') && lower.endsWith(')')) {
    const inner = lower.slice(4, -1);
    const n = inner.split(/[ ,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3) return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 };
  }
  const m2 = c.match(/^#([0-9a-f]{3,8})$/i);
  if (m2) {
    let h = m2[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    if (h.length === 6) h += 'ff';
    if (h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: parseInt(h.slice(6, 8), 16) / 255,
      };
    }
  }
  if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  return null;
}

function comp(fg, bg) {
  const a = (fg.a ?? 1) + (bg.a ?? 1) * (1 - (fg.a ?? 1));
  if (a === 0) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: (fg.r * (fg.a ?? 1) + bg.r * (bg.a ?? 1) * (1 - (fg.a ?? 1))) / a,
    g: (fg.g * (fg.a ?? 1) + bg.g * (bg.a ?? 1) * (1 - (fg.a ?? 1))) / a,
    b: (fg.b * (fg.a ?? 1) + bg.b * (bg.a ?? 1) * (1 - (fg.a ?? 1))) / a,
    a,
  };
}

function lum(c) {
  const f = (x) => {
    x = x / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

function ratio(a, b) {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function min(a, b) {
  return a < b ? a : b;
}

// Identificador global único de amostra (R25-01)
// Formato: r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}
// O parâmetro 'screen' agora é efetivamente incorporado ao identificador.
function makeSampleId(viewport, themeSet, theme, screen, selector, state, index) {
  const selectorHash = hash(selector).slice(0, 8);
  return `r25-${viewport}-${themeSet}-${theme}-${screen}-${selectorHash}-${state}-${index}`;
}

// Geometria a partir dos 4 pares do quadrilátero (R24-04 preservado)
function rectFromBorder(border) {
  if (!border || !Array.isArray(border) || border.length < 8) return null;
  const xs = [border[0], border[2], border[4], border[6]];
  const ys = [border[1], border[3], border[5], border[7]];
  if (xs.some((v) => typeof v !== 'number' || !isFinite(v))) return null;
  if (ys.some((v) => typeof v !== 'number' || !isFinite(v))) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Coleta de contraste e classificação WCAG (R24-07 preservado)
function measure(c) {
  const fg = parseColor(c.color) || { r: 0, g: 0, b: 0, a: 1 };
  let bg = c.bgRgb || c.bg || { r: 255, g: 255, b: 255, a: 1 };
  if (typeof bg === 'string') bg = parseColor(bg) || { r: 255, g: 255, b: 255, a: 1 };
  if (bg && typeof bg === 'object' && bg.r !== undefined) {
    // já é um objeto de cor parseado (ex: bgRgb do collectScript)
  } else if (bg && typeof bg === 'object') {
    bg = parseColor(String(bg)) || { r: 255, g: 255, b: 255, a: 1 };
  }
  if (!bg || typeof bg !== 'object') bg = { r: 255, g: 255, b: 255, a: 1 };

  let uncertain = (c.bgUncertain || []).concat(c.outsideUncertain || []);
  let gradient = (c.bgGradient || [])
    .concat(c.outsideGradient || [])
    .concat(parseGradientColors(c.bgImage));

  const compFg = fg.a < 1 ? comp(fg, bg) : fg;
  let textRatio = ratio(compFg, bg);
  if (gradient.length) {
    for (const g of gradient) {
      const gb = comp(g, { r: 255, g: 255, b: 255, a: 1 });
      textRatio = min(textRatio, ratio(compFg, gb));
    }
  }

  const fs = parseFloat(c.fontSize) || 16;
  const fw = parseInt(c.fontWeight, 10) || 400;
  const large = fs >= 24 || (fs >= 18.66 && fw >= 700);

  const directText = c.directText;
  const hasText =
    (!!c.text || c.hasDescendantText) &&
    (directText ||
      ['button', 'a', 'label', 'small', 'span', 'strong', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(c.tag));

  const icon =
    !hasText &&
    (c.tag === 'i' ||
      c.tag === 'svg' ||
      c.tag === 'img' ||
      (c.pBeforeContent && c.pBeforeContent !== 'none' && c.pBeforeContent !== 'normal') ||
      (c.pAfterContent && c.pAfterContent !== 'none' && c.pAfterContent !== 'normal'));

  let iconRatio = textRatio;
  if (icon && c.pBeforeContent && c.pBeforeContent !== 'none' && c.pBeforeContent !== 'normal') {
    const pc = parseColor(c.pBeforeColor) || fg;
    iconRatio = ratio(pc.a < 1 ? comp(pc, bg) : pc, bg);
  }
  if (icon && c.pAfterContent && c.pAfterContent !== 'none' && c.pAfterContent !== 'normal') {
    const pc = parseColor(c.pAfterColor) || fg;
    iconRatio = min(iconRatio, ratio(pc.a < 1 ? comp(pc, bg) : pc, bg));
  }

  const borderW = parseFloat(c.borderW) || 0;
  const borderColor = parseColor(c.borderColor);
  const borderRatio =
    borderW > 0 && c.borderStyle !== 'none' && borderColor ? ratio(borderColor, bg) : null;

  const outlineW = parseFloat(c.outlineW) || 0;
  const outlineColor = parseColor(c.outlineColor);
  const outlineRatio =
    outlineW > 0 && c.outlineStyle !== 'none' && outlineColor ? ratio(outlineColor, bg) : null;

  // R24-05: fundo efetivo compara contra superfície adjacente externa
  let bgColor = null;
  if (c.bgRgb && typeof c.bgRgb === 'object' && c.bgRgb.r !== undefined) {
    bgColor = c.bgRgb;
  } else {
    bgColor = parseColor(c.bg);
  }
  let bgRatio = null;
  if (bgColor && bgColor.a > 0) {
    const outside = c.outsideRgb || { r: 255, g: 255, b: 255, a: 1 };
    bgRatio = ratio(comp(bgColor, outside), outside);
  }

  let pseudoBgRatio = null;
  let pseudoHasSample = false;
  for (const [bgv, w, content] of [
    [c.pBeforeBg, c.pBeforeW, c.pBeforeContent],
    [c.pAfterBg, c.pAfterW, c.pAfterContent],
  ]) {
    const pc = parseColor(bgv);
    if (pc && pc.a > 0 && parseFloat(w) > 0 && content && content !== 'none' && content !== 'normal') {
      pseudoHasSample = true;
      const outside = c.outsideRgb || { r: 255, g: 255, b: 255, a: 1 };
      const r = ratio(comp(pc, outside), outside);
      pseudoBgRatio = pseudoBgRatio === null ? r : min(pseudoBgRatio, r);
    }
  }

  const TEXTO_NORMAL = 4.5;
  const TEXTO_GRANDE = 3.0;
  const GRAFICO = 3.0;
  const FOCO = 3.0;

  let classificacao = 'APROVADO';
  let motivoFalha = null;
  let valorPior = null;
  let limiarPior = null;

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
    textRatio,
    bgRatio,
    borderRatio,
    outlineRatio,
    iconRatio,
    pseudoBgRatio,
    pseudoHasSample,
    large,
    hasText,
    icon,
    fs,
    fw,
    uncertain,
    classificacao,
    motivoFalha,
    valorPior,
    limiarPior,
    bg: { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) },
    fg: { r: Math.round(compFg.r), g: Math.round(compFg.g), b: Math.round(compFg.b) },
  };
}

function parseGradientColors(img) {
  if (!img) return [];
  const lower = String(img).toLowerCase();
  const colors = [];
  const re = /rgba?\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(lower)) !== null) {
    const c = parseColor(m[0]);
    if (c && c.a > 0) colors.push(c);
  }
  return colors.filter((c) => c && c.a > 0);
}

// ---------------------------------------------------------------------------
// Classificação estruturada de erros CDP (R25-06)
// ---------------------------------------------------------------------------

function classifyCDPError(operation, errorName, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();
  const name = (errorName || '').toLowerCase();

  // node-detached: nó removido do DOM durante a operação
  if (
    msg.includes('node is detached') ||
    msg.includes('node not found') ||
    msg.includes('detached') ||
    name === 'notfounderror'
  ) {
    return {
      classification: 'node-detached',
      justification: 'Nó removido do DOM ou não encontrado durante a operação CDP.',
      confidence: 'high',
    };
  }

  // node-not-found: seletor não corresponde a nenhum nó
  if (msg.includes('no node') || msg.includes('no nodes') || msg.includes('queryselector')) {
    return {
      classification: 'node-not-found',
      justification: 'Nenhum nó corresponde ao seletor ou contexto informado.',
      confidence: 'medium',
    };
  }

  // geometry-unavailable: box model não computável
  if (operation === 'DOM.getBoxModel' && (msg.includes('box model') || msg.includes('could not compute'))) {
    return {
      classification: 'geometry-unavailable',
      justification: 'Box model não pôde ser computado (possível estado pseudo com layout alterado ou nó invisível).',
      confidence: 'medium',
    };
  }

  // unsupported-operation: operação não suportada no estado atual
  if (msg.includes('unsupported') || msg.includes('not supported')) {
    return {
      classification: 'unsupported-operation',
      justification: 'Operação CDP não suportada no estado atual do navegador/nó.',
      confidence: 'medium',
    };
  }

  // timeout: tempo esgotado
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return {
      classification: 'timeout',
      justification: 'Operação CDP excedeu o tempo limite.',
      confidence: 'high',
    };
  }

  // protocol-error: erro de protocolo CDP (deve vir antes de invalid-state para evitar falso positivo)
  if (
    msg.includes('protocol') ||
    msg.includes('invalid params') ||
    msg.includes('invalid parameter') ||
    msg.includes('invalid parameters') ||
    name === 'invalidparams'
  ) {
    return {
      classification: 'protocol-error',
      justification: 'Erro de protocolo CDP ou parâmetros inválidos.',
      confidence: 'medium',
    };
  }

  // invalid-state: estado inválido para a operação
  if (msg.includes('invalid state') || msg.includes('invalid')) {
    return {
      classification: 'invalid-state',
      justification: 'Estado inválido para a operação solicitada.',
      confidence: 'medium',
    };
  }

  // unknown: causa não demonstrada
  return {
    classification: 'unknown',
    justification: 'Causa do erro não pôde ser demonstrada com as evidências disponíveis.',
    confidence: 'low',
  };
}

function makeCDPErrorRecord(operation, errorName, errorMessage, context) {
  const classification = classifyCDPError(operation, errorName, errorMessage);
  return {
    sampleId: context.sampleId || null,
    operation,
    status: 'ERROR',
    errorName: errorName || null,
    errorMessage: errorMessage || null,
    timestamp: new Date().toISOString(),
    nodeId: context.nodeId || null,
    selector: context.selector || null,
    state: context.state || null,
    index: context.index !== undefined ? context.index : null,
    classification: classification.classification,
    justification: classification.justification,
    confidence: classification.confidence,
    context: context || {},
  };
}

// ---------------------------------------------------------------------------
// Factory para funções dependentes de CDP
// ---------------------------------------------------------------------------

function createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors }) {
  async function getWinningRule(nodeId, property) {
    try {
      const matched = await CSS.getMatchedStylesForNode({ nodeId });
      if (!matched || !matched.matchedCSSRules) {
        return {
          property,
          computedValue: null,
          winningDeclaration: null,
          candidates: [],
          captureStatus: 'no-matching-declaration',
        };
      }

      const candidates = [];
      let winningDeclaration = null;

      for (const match of matched.matchedCSSRules) {
        const rule = match.rule;
        if (!rule || !rule.style) continue;

        let props = [];
        if (Array.isArray(rule.style.cssProperties)) {
          props = rule.style.cssProperties;
        } else if (typeof rule.style.property === 'function') {
          for (let j = 0; j < rule.style.length; j++) {
            props.push({
              name: rule.style.property(j),
              value: rule.style.value(j),
              important: (rule.style.getPropertyPriority(rule.style.property(j)) === 'important'),
              disabled: false,
              parsedOk: true
            });
          }
        }

        for (const prop of props) {
          if (!prop || prop.name !== property) continue;

          const candidate = {
            property: prop.name,
            value: prop.value || null,
            important: prop.important === true || (prop.text && prop.text.includes('!important')),
            selectorText: rule.selectorList ? (rule.selectorList.selectorText || rule.selectorList.text || null) : rule.selectorText || null,
            origin: rule.origin || null,
            styleSheetId: rule.styleSheetId || null,
            disabled: prop.disabled === true,
            parsedOk: prop.parsedOk !== false
          };
          candidates.push(candidate);

          if (!candidate.disabled && candidate.parsedOk && candidate.value) {
            winningDeclaration = { ...candidate, captureStatus: 'captured' };
          }
        }
      }

      if (winningDeclaration) {
        return {
          property,
          computedValue: winningDeclaration.value,
          winningDeclaration,
          candidates,
          captureStatus: 'captured',
        };
      }

      return {
        property,
        computedValue: null,
        winningDeclaration: null,
        candidates,
        captureStatus: 'no-matching-declaration',
      };
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('CSS.getMatchedStylesForNode', e.name, e.message, {
        nodeId, property,
      }));
      return {
        property,
        computedValue: null,
        winningDeclaration: null,
        candidates: [],
        captureStatus: 'cdp-error',
      };
    }
  }

  async function captureWinningRules(c, nodeId) {
    if (!nodeId) {
      return {
        error: 'node-association-failed',
        properties: {},
      };
    }

    const props = [
      'color',
      'background-color',
      'border-color',
      'border-top-color',
      'border-right-color',
      'border-bottom-color',
      'border-left-color',
      'outline-color',
      'fill',
      'stroke',
    ];

    const out = {};
    for (const p of props) {
      const r = await getWinningRule(nodeId, p);
      out[p] = {
        property: r.property,
        computedValue: r.computedValue,
        winningDeclaration: r.winningDeclaration,
        candidates: r.candidates,
        captureStatus: r.captureStatus,
      };
    }

    return { error: null, properties: out };
  }

  // R25-01, R25-03, R25-04, R25-05: probeState com screen no sampleId,
  // try/finally real para limpeza de pseudoestado, separação visibilityStatus/geometryStatus,
  // correção de opacity e leitura correta de atributos DOM.
  async function probeState(selector, state, vp, themeSet, theme, screen) {
    const occurrences = [];
    const sampleIds = new Set();

    let rootNodeId;
    try {
      const doc = await DOM.getDocument({ depth: -1, pierce: true });
      rootNodeId = doc.root.nodeId;
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('DOM.getDocument', e.name, e.message, {}));
      return occurrences;
    }

    let nodeIds;
    try {
      const qs = await DOM.querySelectorAll({ nodeId: rootNodeId, selector });
      nodeIds = qs.nodeIds || [];
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('DOM.querySelectorAll', e.name, e.message, { selector }));
      return occurrences;
    }

    if (nodeIds.length === 0) {
      // R25-01: screen incorporado mesmo quando não há elementos
      const sampleId = makeSampleId(vp, themeSet, theme, screen, selector, state, 0);
      if (sampleIds.has(sampleId)) {
        throw new Error(`Duplicate sampleId: ${sampleId}`);
      }
      sampleIds.add(sampleId);
      occurrences.push({
        sampleId,
        index: 0,
        discarded: true,
        reason: 'no-elements-found',
        selector,
        state,
      });
      return occurrences;
    }

    for (let i = 0; i < nodeIds.length; i++) {
      const nodeId = nodeIds[i];
      // R25-01: screen incorporado ao sampleId
      const sampleId = makeSampleId(vp, themeSet, theme, screen, selector, state, i);

      if (sampleIds.has(sampleId)) {
        throw new Error(`Duplicate sampleId: ${sampleId}`);
      }
      sampleIds.add(sampleId);

      let discarded = false;
      let reason = null;
      let computed = null;
      let boxModel = null;
      let nodeInfo = null;
      let pseudoApplied = false;

      // Verificar se o nó ainda existe (R25-05: atributos DOM lidos com cuidado)
      try {
        const described = await DOM.describeNode({ nodeId, depth: 0 });
        nodeInfo = described.node;
        if (!nodeInfo) {
          occurrences.push({
            sampleId,
            index: i,
            discarded: true,
            reason: 'node-gone',
            selector,
            state,
            nodeId,
            visibilityStatus: 'detached',
            geometryStatus: 'unavailable',
          });
          continue;
        }
      } catch (e) {
        cdpErrors.push(makeCDPErrorRecord('DOM.describeNode', e.name, e.message, {
          sampleId, selector, state, index: i,
        }));
        occurrences.push({
          sampleId,
          index: i,
          discarded: true,
          reason: 'describe-error',
          selector,
          state,
          nodeId,
          visibilityStatus: 'detached',
          geometryStatus: 'unavailable',
        });
        continue;
      }

      // R25-03: aplicação do pseudoestado com try/finally envolvendo toda a computação
      try {
        if (state !== 'normal') {
          await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
          pseudoApplied = true;
        }

        // Coleta de estilo computado
        try {
          const cs = await CSS.getComputedStyleForNode({ nodeId });
          computed = cs.computedStyle;
        } catch (e) {
          cdpErrors.push(makeCDPErrorRecord('CSS.getComputedStyleForNode', e.name, e.message, {
            sampleId, selector, state, index: i, nodeId,
          }));
          discarded = true;
          reason = 'computed-style-error';
        }

        // Coleta de geometria (opcional — não descarta se falhar)
        try {
          const bm = await DOM.getBoxModel({ nodeId });
          boxModel = bm.model;
        } catch (e) {
          cdpErrors.push(makeCDPErrorRecord('DOM.getBoxModel', e.name, e.message, {
            sampleId, selector, state, index: i, nodeId,
          }));
          boxModel = null;
        }

      } finally {
        // R25-03: limpeza garantida em finally, somente se o pseudoestado foi aplicado
        if (pseudoApplied) {
          try {
            await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [] });
          } catch (e) {
            cdpErrors.push(makeCDPErrorRecord('CSS.forcePseudoState-clear', e.name, e.message, {
              sampleId, selector, state, index: i, nodeId,
            }));
          }
        }
      }

      if (!computed) {
        occurrences.push({
          sampleId,
          index: i,
          discarded: true,
          reason: reason || 'computed-style-missing',
          selector,
          state,
          nodeId,
          visibilityStatus: 'not-visible',
          geometryStatus: 'unavailable',
        });
        continue;
      }

      const propMap = {};
      for (const entry of computed || []) {
        propMap[entry.name] = entry.value;
      }

      // R25-04: geometria com 4 vértices
      let rect = null;
      let geometryStatus = 'available';
      if (boxModel) {
        const border = boxModel.border;
        if (border && border.length >= 8) {
          rect = rectFromBorder(border);
        } else {
          geometryStatus = 'unavailable';
        }
      } else {
        geometryStatus = 'error';
      }

      // R25-04, R25-05: separação de visibilityStatus e geometryStatus
      let visibilityStatus = 'visible';
      const display = propMap.display;
      const visibility = propMap.visibility;

      // R25-04: correção de opacity — validação numérica explícita, sem || 1
      let opacity = 1;
      if (propMap.opacity !== undefined && propMap.opacity !== null && propMap.opacity !== '') {
        const parsed = parseFloat(propMap.opacity);
        if (!isNaN(parsed)) {
          opacity = parsed;
        }
      }
      const width = parseFloat(propMap.width);
      const height = parseFloat(propMap.height);
      const widthValid = !isNaN(width);
      const heightValid = !isNaN(height);
      const widthVal = widthValid ? width : 0;
      const heightVal = heightValid ? height : 0;

      if (display === 'none') {
        visibilityStatus = 'hidden';
      } else if (visibility === 'hidden') {
        visibilityStatus = 'hidden';
      } else if (opacity === 0) {
        visibilityStatus = 'not-visible';
      } else if (!widthValid || !heightValid || widthVal === 0 || heightVal === 0) {
        visibilityStatus = 'not-visible';
      }

      // Se a geometria não pôde ser obtida, geometryStatus já reflete isso
      if (geometryStatus === 'unavailable' || geometryStatus === 'error') {
        // geometria indisponível não altera visibilityStatus, mas marca geometryStatus
      }

      // R25-05: leitura de atributos DOM com estrutura confirmada
      const attributes = Array.isArray(nodeInfo.attributes) ? nodeInfo.attributes : [];
      const findAttr = (name) => {
        const found = attributes.find((a) => a && a.name === name);
        return found ? found.value : null;
      };

      const disabled = attributes.some((a) => a && a.name === 'disabled');

      occurrences.push({
        sampleId,
        index: i,
        discarded: discarded || visibilityStatus === 'hidden' || visibilityStatus === 'not-visible',
        reason: visibilityStatus === 'hidden' || visibilityStatus === 'not-visible' ? 'visibility' : reason,
        selector,
        state,
        nodeId,
        rect,
        visibilityStatus,
        geometryStatus,
        color: propMap.color || null,
        bg: propMap['background-color'] || null,
        img: propMap['background-image'] || null,
        border: propMap['border-top-color']
          ? `${propMap['border-top-width']} ${propMap['border-top-style']} ${propMap['border-top-color']}`
          : null,
        outline: propMap['outline-color']
          ? `${propMap['outline-width']} ${propMap['outline-style']} ${propMap['outline-color']}`
          : null,
        filter: propMap.filter || null,
        opacity: propMap.opacity || null,
        disabled,
        tabIndex: findAttr('tabindex'),
        role: findAttr('role'),
        aria: findAttr('aria-label'),
      });
    }

    return occurrences;
  }

  return {
    getWinningRule,
    captureWinningRules,
    probeState,
    parseColor,
    lum,
    ratio,
    comp,
    measure,
    rectFromBorder,
    makeSampleId,
    hash,
    sleep,
    classifyCDPError,
    makeCDPErrorRecord,
  };
}

module.exports = {
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
  classifyCDPError,
  makeCDPErrorRecord,
  createCDPAuditCore,
};
