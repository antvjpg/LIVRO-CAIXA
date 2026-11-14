// ============================================================================
// Núcleo compartilhado e testável do harness C.4-V05-B-R2.4
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

// Identificador global único de amostra (R24-02)
// Formato: r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}
function makeSampleId(viewport, themeSet, theme, screen, selector, state, index) {
  const selectorHash = hash(selector).slice(0, 8);
  return `r24-${viewport}-${themeSet}-${theme}-${screen}-${selectorHash}-${state}-${index}`;
}

// Geometria a partir dos 4 pares do quadrilátero (R24-04)
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

// Coleta de contraste e classificação WCAG (R24-07)
// c deve conter: color, bgRgb (ou bg), bgUncertain, outsideRgb, borderW,
// borderStyle, borderColor, outlineW, outlineStyle, outlineColor,
// fontSize, fontWeight, text, hasDescendantText, directText, tag,
// pBeforeBg, pBeforeW, pBeforeContent, pAfterBg, pAfterW, pAfterContent,
// bgImage, pBeforeColor, pAfterColor.
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

        // Suporta tanto cssProperties (CDP moderno) quanto property(j)/value(j) (CDP antigo)
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
      cdpErrors.push({
        sampleId: null,
        operation: 'CSS.getMatchedStylesForNode',
        status: 'ERROR',
        errorName: e.name,
        errorMessage: e.message,
        timestamp: new Date().toISOString(),
        nodeId,
        property,
      });
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

  async function probeState(selector, state, vp, themeSet, theme, screen) {
    const occurrences = [];
    const sampleIds = new Set();

    let rootNodeId;
    try {
      const doc = await DOM.getDocument({ depth: -1, pierce: true });
      rootNodeId = doc.root.nodeId;
    } catch (e) {
      cdpErrors.push({
        sampleId: null,
        operation: 'DOM.getDocument',
        status: 'ERROR',
        errorName: e.name,
        errorMessage: e.message,
        timestamp: new Date().toISOString(),
      });
      return occurrences;
    }

    let nodeIds;
    try {
      const qs = await DOM.querySelectorAll({ nodeId: rootNodeId, selector });
      nodeIds = qs.nodeIds || [];
    } catch (e) {
      cdpErrors.push({
        sampleId: null,
        operation: 'DOM.querySelectorAll',
        status: 'ERROR',
        errorName: e.name,
        errorMessage: e.message,
        timestamp: new Date().toISOString(),
        selector,
      });
      return occurrences;
    }

    if (nodeIds.length === 0) {
      const sampleId = makeSampleId(vp, themeSet, theme, '', selector, state, 0);
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
      const sampleId = makeSampleId(vp, themeSet, theme, '', selector, state, i);

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
          });
          continue;
        }
      } catch (e) {
        cdpErrors.push({
          sampleId,
          operation: 'DOM.describeNode',
          status: 'ERROR',
          errorName: e.name,
          errorMessage: e.message,
          timestamp: new Date().toISOString(),
          selector,
          state,
          index: i,
        });
        occurrences.push({
          sampleId,
          index: i,
          discarded: true,
          reason: 'describe-error',
          selector,
          state,
          nodeId,
        });
        continue;
      }

      try {
        if (state !== 'normal') {
          await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
          pseudoApplied = true;
        }
      } catch (e) {
        cdpErrors.push({
          sampleId,
          operation: 'CSS.forcePseudoState',
          status: 'ERROR',
          errorName: e.name,
          errorMessage: e.message,
          timestamp: new Date().toISOString(),
          selector,
          state,
          index: i,
          nodeId,
        });
        occurrences.push({
          sampleId,
          index: i,
          discarded: true,
          reason: 'force-pseudo-error',
          selector,
          state,
          nodeId,
        });
        continue;
      }

      try {
        const cs = await CSS.getComputedStyleForNode({ nodeId });
        computed = cs.computedStyle;
      } catch (e) {
        cdpErrors.push({
          sampleId,
          operation: 'CSS.getComputedStyleForNode',
          status: 'ERROR',
          errorName: e.name,
          errorMessage: e.message,
          timestamp: new Date().toISOString(),
          selector,
          state,
          index: i,
          nodeId,
        });
        discarded = true;
        reason = 'computed-style-error';
      }

      try {
        const bm = await DOM.getBoxModel({ nodeId });
        boxModel = bm.model;
      } catch (e) {
        cdpErrors.push({
          sampleId,
          operation: 'DOM.getBoxModel',
          status: 'ERROR',
          errorName: e.name,
          errorMessage: e.message,
          timestamp: new Date().toISOString(),
          selector,
          state,
          index: i,
          nodeId,
        });
        boxModel = null;
      }

      // R24-08: limpeza garantida com try/finally
      try {
        if (pseudoApplied) {
          await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [] });
        }
      } catch (e) {
        cdpErrors.push({
          sampleId,
          operation: 'CSS.forcePseudoState-clear',
          status: 'ERROR',
          errorName: e.name,
          errorMessage: e.message,
          timestamp: new Date().toISOString(),
          selector,
          state,
          index: i,
          nodeId,
        });
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
        });
        continue;
      }

      const propMap = {};
      for (const entry of computed || []) {
        propMap[entry.name] = entry.value;
      }

      // R24-04: geometria com 4 vértices
      let rect = null;
      if (boxModel) {
        const border = boxModel.border;
        if (border && border.length >= 8) {
          rect = rectFromBorder(border);
        }
      }

      // Validação de visibilidade (R24-08)
      let visibilityStatus = 'valid';
      const display = propMap.display;
      const visibility = propMap.visibility;
      const opacity = parseFloat(propMap.opacity) || 1;
      const width = parseFloat(propMap.width) || 0;
      const height = parseFloat(propMap.height) || 0;

      if (display === 'none') visibilityStatus = 'discarded';
      else if (visibility === 'hidden') visibilityStatus = 'discarded';
      else if (opacity === 0) visibilityStatus = 'discarded';
      else if (width === 0 || height === 0) visibilityStatus = 'geometry-unavailable';

      occurrences.push({
        sampleId,
        index: i,
        discarded: discarded || visibilityStatus === 'discarded',
        reason: visibilityStatus === 'discarded' ? 'visibility' : reason,
        selector,
        state,
        nodeId,
        rect,
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
        disabled: nodeInfo.attributes ? nodeInfo.attributes.includes('disabled') : false,
        tabIndex:
          nodeInfo.attributes &&
          (nodeInfo.attributes.find((a) => a.name === 'tabindex') || {}).value
            ? (nodeInfo.attributes.find((a) => a.name === 'tabindex') || {}).value
            : null,
        role:
          nodeInfo.attributes &&
          (nodeInfo.attributes.find((a) => a.name === 'role') || {}).value
            ? (nodeInfo.attributes.find((a) => a.name === 'role') || {}).value
            : null,
        aria:
          nodeInfo.attributes &&
          (nodeInfo.attributes.find((a) => a.name === 'aria-label') || {}).value
            ? (nodeInfo.attributes.find((a) => a.name === 'aria-label') || {}).value
            : null,
        visibilityStatus,
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
  createCDPAuditCore,
};
