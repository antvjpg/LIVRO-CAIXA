// ============================================================================
// Núcleo compartilhado e testável do harness C.4-V05-B-R2.5.1
// Correções R25-01 a R25-06 aplicadas sobre o núcleo R2.5, mais:
// - R25-02: resolveNodeIdResult extraído para o núcleo e exportado
// - R25-02: registro global de sampleId extraído para o núcleo e exportado
// - R25-03: try/finally real com cleanupStatus explícito
// - R25-04: visibilidade efetiva considerando ancestrais (opacidade acumulada)
// - R25-05: validação geométrica completa (degenerescência, NaN, Infinity)
// - R25-06: classificação de erros CDP sem falsos positivos textuais
// - R25-07: nenhum fallback a branco presumido para fundo ausente
// - R25-08: caminhos relativos (sem caminhos absolutos do Termux)
// - R25-09: limpeza de mutações temporárias no DOM após falha
// R266-AUD: herança por ancestral, índices estritos, metadados CDP e limites da cascata
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
function makeSampleId(viewport, themeSet, theme, screen, selector, state, index) {
  const selectorHash = hash(selector).slice(0, 8);
  return `r25-${viewport}-${themeSet}-${theme}-${screen}-${selectorHash}-${state}-${index}`;
}

// Registro global de sampleId (R25-02)
// Detecta colisões entre chamadas distintas de probeState.
// Retorna um objeto com register, has e clear.
function createSampleIdRegistry() {
  const ids = new Set();
  return {
    register(sampleId) {
      if (ids.has(sampleId)) {
        throw new Error(`Duplicate sampleId: ${sampleId}`);
      }
      ids.add(sampleId);
      return true;
    },
    has(sampleId) {
      return ids.has(sampleId);
    },
    size() {
      return ids.size;
    },
    clear() {
      ids.clear();
    },
  };
}

// Geometria a partir dos 4 pares do quadrilátero (R24-04 preservado, R25-05 validado)
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
      const w = maxX - minX;
      const h = maxY - minY;
      // Dimensões degeneradas tornam a geometria indisponível
      if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null;
      return { x: minX, y: minY, w, h };
}

// Coleta de contraste e classificação WCAG (R24-07 preservado, R25-10: nenhum fallback a branco presumido)
function measure(c) {
  const fg = parseColor(c.color) || { r: 0, g: 0, b: 0, a: 1 };
  let bg = c.bgRgb || c.bg || null;
  if (bg && typeof bg === 'string') bg = parseColor(bg) || null;
  if (bg && typeof bg === 'object' && bg.r !== undefined) {
    // já é um objeto de cor parseado
  } else if (bg && typeof bg === 'object') {
    bg = parseColor(String(bg)) || null;
  }
  // R25-10: NÃO aplicar fallback a branco quando o fundo não está disponível.
  // Se não houver fundo comprovado, bgRatio permanece null e a classificação
  // deve considerar isso como ausência de evidência (inconclusivo quando aplicável).
  if (!bg || typeof bg !== 'object') bg = null;

  let uncertain = (c.bgUncertain || []).concat(c.outsideUncertain || []);
  let gradient = (c.bgGradient || [])
    .concat(c.outsideGradient || [])
    .concat(parseGradientColors(c.bgImage));

  const compFg = fg.a < 1 && bg ? comp(fg, bg) : fg;
  let textRatio = bg ? ratio(compFg, bg) : null;
  if (gradient.length) {
    for (const g of gradient) {
      const gb = bg ? comp(g, { r: 255, g: 255, b: 255, a: 1 }) : null;
      const r = bg ? ratio(compFg, gb) : null;
      if (r !== null) textRatio = textRatio === null ? r : min(textRatio, r);
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
    iconRatio = bg ? ratio(pc.a < 1 ? comp(pc, bg) : pc, bg) : null;
  }
  if (icon && c.pAfterContent && c.pAfterContent !== 'none' && c.pAfterContent !== 'normal') {
    const pc = parseColor(c.pAfterColor) || fg;
    iconRatio = bg ? min(iconRatio, ratio(pc.a < 1 ? comp(pc, bg) : pc, bg)) : null;
  }

  const borderW = parseFloat(c.borderW) || 0;
  const borderColor = parseColor(c.borderColor);
  const borderRatio =
    borderW > 0 && c.borderStyle !== 'none' && borderColor && bg ? ratio(borderColor, bg) : null;

  const outlineW = parseFloat(c.outlineW) || 0;
  const outlineColor = parseColor(c.outlineColor);
  const outlineRatio =
    outlineW > 0 && c.outlineStyle !== 'none' && outlineColor && bg ? ratio(outlineColor, bg) : null;

  // R24-05 / R25-05: fundo efetivo compara contra superfície adjacente externa.
  // Sem superfície comprovada (outsideRgb), bgRatio permanece null.
  let bgColor = null;
  if (c.bgRgb && typeof c.bgRgb === 'object' && c.bgRgb.r !== undefined) {
    bgColor = c.bgRgb;
  } else if (c.bg) {
    bgColor = parseColor(c.bg);
  }
  let bgRatio = null;
  if (bgColor && bgColor.a > 0) {
    const outside = c.outsideRgb || null;
    if (outside) {
      bgRatio = ratio(comp(bgColor, outside), outside);
    }
    // Sem outsideRgb: bgRatio permanece null (não se presume branco).
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
      const outside = c.outsideRgb || null;
      if (outside) {
        const r = ratio(comp(pc, outside), outside);
        pseudoBgRatio = pseudoBgRatio === null ? r : min(pseudoBgRatio, r);
      }
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
    if (textRatio === null) {
      // Não há fundo comprovado, não dá para classificar contraste de texto
      classificacao = 'INCONCLUSIVO';
      motivoFalha = null;
      valorPior = null;
      limiarPior = null;
    } else if (textRatio < limiar - 1e-9) {
      registerFail('texto', textRatio, limiar);
    }
  } else if (icon) {
    if (iconRatio === null) {
      classificacao = 'INCONCLUSIVO';
      motivoFalha = null;
      valorPior = null;
      limiarPior = null;
    } else if (iconRatio < GRAFICO - 1e-9) {
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

  // Se não há fundo comprovado, a classificação não pode ser APROVADA com certeza
  // sobre a superfície; manter a classificação calculada mas o consumidor deve
  // considerar bgRatio null como ausência de evidência.
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
    bg: bg ? { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) } : null,
    fg: { r: Math.round(compFg.r), g: Math.round(compFg.g), b: Math.round(compFg.b) },
    // R25-10: indica se o fundo foi efetivamente observado
    hasBackground: bg !== null,
    hasOutsideSurface: c.outsideRgb !== undefined && c.outsideRgb !== null,
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
// Não classificar com base apenas em texto ambíguo de mensagem.
// Usar operação, nome/tipo de erro e evidências disponíveis.
// ---------------------------------------------------------------------------

function classifyCDPError(operation, errorName, errorMessage) {
  const msg = (errorMessage || '').toLowerCase();
  const name = (errorName || '').toLowerCase();

  // node-detached: nó removido do DOM durante a operação (evidência forte)
  if (
    msg.includes('node is detached') ||
    name === 'notfounderror' ||
    (msg.includes('detached') && !msg.includes('queryselector'))
  ) {
    return {
      classification: 'node-detached',
      justification: 'Nó removido do DOM ou desconectado durante a operação CDP.',
      confidence: 'high',
    };
  }

  // node-not-found: seletor não corresponde a nenhum nó (ausência de resultado)
  if (
    msg.includes('no node') ||
    msg.includes('no nodes') ||
    (msg.includes('queryselector') && !msg.includes('detached'))
  ) {
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

  // protocol-error: erro de protocolo CDP (deve vir antes de invalid-state)
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

  // invalid-state: estado inválido para a operação (apenas quando explicitamente dito)
  if (msg.includes('invalid state')) {
    return {
      classification: 'invalid-state',
      justification: 'Estado inválido para a operação solicitada.',
      confidence: 'medium',
    };
  }

  // unknown: causa não demonstrada (não classificar por palavras genéricas como 'invalid')
  return {
    classification: 'unknown',
    justification: 'Causa do erro não pôde ser demonstrada com as evidências disponíveis.',
    confidence: 'low',
  };
}

function makeCDPErrorRecord(operation, errorName, errorMessage, context) {
  const classification = classifyCDPError(operation, errorName, errorMessage);
  return {
    sampleId: context && context.sampleId !== undefined ? context.sampleId : null,
    operation,
    status: 'ERROR',
    errorName: errorName || null,
    errorMessage: errorMessage || null,
    timestamp: new Date().toISOString(),
    nodeId: context && context.nodeId !== undefined ? context.nodeId : null,
    selector: context && context.selector !== undefined ? context.selector : null,
    state: context && context.state !== undefined ? context.state : null,
    index: context && context.index !== undefined ? context.index : null,
    classification: classification.classification,
    justification: classification.justification,
    confidence: classification.confidence,
    context: context || {},
  };
}

// Contrato de cardinalidade para associação key → nodeId (R25-02)
// 0 IDs -> "node-not-found"
// 1 ID -> "resolved"
// Mais de 1 ID -> "ambiguous-node-association"
// Erro CDP -> "cdp-error"
function resolveNodeIdResult(ids, key, selector) {
  if (!Array.isArray(ids)) {
    return { status: 'cdp-error', nodeId: null, key, selector: selector || null, idCount: 0 };
  }
  if (ids.length === 0) {
    return { status: 'node-not-found', nodeId: null, key, selector: selector || null, idCount: 0 };
  }
  if (ids.length === 1) {
    return { status: 'resolved', nodeId: ids[0], key, selector: selector || null, idCount: 1 };
  }
  return { status: 'ambiguous-node-association', nodeId: null, key, selector: selector || null, idCount: ids.length };
}

// ---------------------------------------------------------------------------
// R25.5 — Mecanismo rigoroso de visibilidade e integridade da travessia
// ---------------------------------------------------------------------------
//
// Princípio: duas perguntas que o mecanismo anterior fundia em uma só.
//
//   (1) A árvore de ancestrais foi percorrida completamente?
//   (2) Já existe evidência suficiente para concluir que o elemento NÃO
//       está visível?
//
// Evidência de ocultação (display:none, opacidade acumulada zero) permite
// responder (2) sem permitir responder (1). Por isso a travessia registra o
// motivo real de término e nunca é declarada 'completed' sem que a raiz real
// do documento tenha sido examinada.
//
// Estados terminais da travessia. Nenhum pode ser convertido silenciosamente
// em outro; cada um é atribuído no ponto em que a travessia termina.
const ANCESTOR_VISIBILITY_COMPLETED = 'completed';
const ANCESTOR_VISIBILITY_SHORT_CIRCUITED = 'short-circuited';
const ANCESTOR_VISIBILITY_PARTIAL = 'partial';
const ANCESTOR_VISIBILITY_UNAVAILABLE = 'unavailable';
const ANCESTOR_VISIBILITY_ERROR = 'error';
const ANCESTOR_VISIBILITY_DEPTH_LIMIT = 'depth-limit';
const ANCESTOR_VISIBILITY_CYCLE = 'cycle';

// Estados do contrato de integridade da opacidade acumulada.
const OPACITY_STATUS_COMPLETE = 'complete';
const OPACITY_STATUS_PARTIAL = 'partial';
const OPACITY_STATUS_CONCLUSIVE_ZERO = 'conclusive-zero';
const OPACITY_STATUS_SHORT_CIRCUITED = 'short-circuited';
const OPACITY_STATUS_UNAVAILABLE = 'unavailable';
const OPACITY_STATUS_INVALID = 'invalid';
const OPACITY_STATUS_ERROR = 'error';

// Limite de profundidade da travessia de ancestrais.
const MAX_ANCESTOR_DEPTH = 50;

// Leitura de estilo do nó corrente da travessia.
// `isRoot` identifica a raiz REAL do documento. A implementação anterior
// usava `this.parentElement === null`, que confunde um elemento desconectado
// com a raiz do documento.
const ANCESTOR_STYLE_FUNCTION = (function () {
  const cs = window.getComputedStyle(this);
  return {
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    isRoot: this === document.documentElement,
  };
}).toString();

// Resolução do próximo ancestral na árvore composta.
// Precedência: assignedSlot → parentElement → host da árvore Shadow.
// A ausência de pai somente significa raiz quando o elemento é o
// documentElement; um elemento desconectado resulta em travessia incompleta.
const ANCESTOR_PARENT_FUNCTION = (function () {
  if (this.assignedSlot) return this.assignedSlot;
  if (this.parentElement) return this.parentElement;
  const root = this.getRootNode ? this.getRootNode() : null;
  if (root && root.host) return root.host;
  return null;
}).toString();

// R25.5: validação estrita de opacidade.
// Não existe `parseFloat(valor) || 1`: um valor inválido jamais é convertido
// em 1, porque isso fabricaria uma confiança que a leitura não sustenta.
// Um valor é válido somente se for numérico, finito e estiver no intervalo
// CSS [0,1].
function parseOpacityValue(raw) {
  if (raw === undefined || raw === null) {
    return { valid: false, reason: 'valor de opacidade ausente' };
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return { valid: false, reason: 'tipo de opacidade inválido' };
  }
  const text = String(raw).trim();
  if (text === '') {
    return { valid: false, reason: 'valor de opacidade vazio' };
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return { valid: false, reason: 'valor de opacidade não numérico ou não finito' };
  }
  if (parsed < 0 || parsed > 1) {
    return { valid: false, reason: 'valor de opacidade fora do intervalo CSS [0,1]' };
  }
  return { valid: true, value: parsed };
}

// R25.5: descrição de uma exceção levantada dentro do navegador.
// O CDP devolve a exceção em `exceptionDetails` e resolve a promise; sem esta
// detecção, uma exceção real do lado do navegador seria confundida com uma
// simples leitura indisponível.
function describeCDPException(exceptionDetails) {
  if (!exceptionDetails) return 'exceção desconhecida no navegador';
  const exception = exceptionDetails.exception;
  const detail =
    (exception && (exception.description || exception.value)) ||
    exceptionDetails.text ||
    'exceção desconhecida no navegador';
  return 'exceção na execução da função no navegador: ' + String(detail);
}

// ---------------------------------------------------------------------------
// Factory para funções dependentes de CDP
// ---------------------------------------------------------------------------

function createCDPAuditCore({ CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors }) {
  function canonicalCssValue(value) {
    let text = String(value === null || value === undefined ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/\s*!important\s*$/i, '');
    const rgb = text.match(/^rgba?\(([^)]+)\)$/);
    if (rgb) {
      const nums = rgb[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      if (nums.length >= 3) return `rgb(${Math.round(nums[0])}, ${Math.round(nums[1])}, ${Math.round(nums[2])})`;
    }
    return text.replace(/\s+/g, ' ');
  }

  function provenanceMatches(entry, selector, prop, meta) {
    if (!entry || entry.origin !== 'user') return false;
    if (entry.property && entry.property !== prop.name) return false;
    if (entry.selectorText && String(entry.selectorText) !== String(selector || '')) return false;
    if (entry.declaredValue && canonicalCssValue(entry.declaredValue) !== canonicalCssValue(prop.value)) return false;
    if (typeof entry.important === 'boolean' && entry.important !== propImportant(prop)) return false;
    if (entry.cdpOrigin && meta.origin !== entry.cdpOrigin) return false;
    if (entry.styleSheetId && meta.styleSheetId && entry.styleSheetId !== meta.styleSheetId) return false;
    return true;
  }

  function findProvenance(selector, prop, meta, options) {
    const list = Array.isArray(options.provenance)
      ? options.provenance
      : options.provenance ? [options.provenance] : [];
    for (const entry of list) {
      if (provenanceMatches(entry, selector, prop, meta)) return entry;
    }
    return null;
  }

  function resolveProvenance(ruleMatches, options, property) {
    const list = Array.isArray(options.provenance)
      ? options.provenance
      : options.provenance ? [options.provenance] : [];
    return list.map((entry) => {
      const matches = [];
      for (const match of ruleMatches) {
        const rule = match.rule;
        if (!rule || !rule.style) continue;
        for (const prop of rule.style.cssProperties || []) {
          if (prop.name !== property) continue;
          const meta = { origin: rule.origin || null, styleSheetId: rule.styleSheetId || null };
          if (!provenanceMatches(entry, ruleSelector(rule), prop, meta)) continue;
          matches.push({
            selectorText: ruleSelector(rule),
            declaredValue: prop.value || null,
            important: propImportant(prop),
            cdpOrigin: meta.origin,
            styleSheetId: meta.styleSheetId || null,
            ruleId: rule.id || null,
          });
        }
      }
      return {
        entry,
        status: matches.length === 1 ? 'unica' : matches.length === 0 ? 'ausente' : 'ambigua',
        matchCount: matches.length,
        matches,
      };
    });
  }

  function authoredProp(p, origin) {
    if (origin === 'user-agent' || origin === 'user') return true;
    return Boolean(p && (p.implicit === false || (typeof p.text === 'string' && p.text.trim().length > 0)));
  }

  function propImportant(p) {
    return p.important === true || (typeof p.text === 'string' && /!important/i.test(p.text));
  }

  function ruleSelector(rule) {
    if (!rule) return null;
    if (rule.selectorList) return rule.selectorList.text || rule.selectorList.selectorText || null;
    return rule.selectorText || null;
  }

  const R266_AUD_CASCADE_SCOPE = {
    suportado: [
      'origens author, user e user-agent informadas pelo CDP',
      'declaracoes proprias do no e inline style',
      'cascata entre declaracoes do mesmo no por importancia, origem, especificidade e ordem',
      'heranca pela ordem da cadeia CDP, priorizando o ancestral mais proximo',
      'pseudo-elementos e descobrimento de nos em Shadow DOM',
    ],
    limitacoes: [
      { id: 'cascade-layers', status: 'nao-suportado', descricao: 'camadas @layer nao sao resolvidas como eixo independente' },
      { id: 'animacoes-transicoes', status: 'nao-suportado', descricao: 'valores animados ou em transicao nao sao resolvidos' },
      { id: 'scoping-proximity', status: 'nao-suportado', descricao: 'proximidade de @scope nao participa da comparacao' },
      { id: 'encapsulation-contexts', status: 'parcial', descricao: 'nos em Shadow DOM sao descobertos, mas limites de encapsulamento nao sao comparados' },
      { id: 'regras-condicionais', status: 'parcial', descricao: 'regras @media, @supports e @container sao consumidas pelo CDP, mas nao sao avaliadas pelo nucleo' },
    ],
  };

  function cascadeLimitations(ruleMatches) {
    const detectado = {
      cascadeLayers: false,
      animacoesTransicoes: false,
      scopingProximity: false,
      encapsulationContexts: false,
      regrasCondicionais: false,
    };
    for (const match of ruleMatches || []) {
      const rule = match && match.rule;
      if (!rule) continue;
      if (rule.layerName || rule.layer) detectado.cascadeLayers = true;
      if (rule.media || rule.supports || rule.containerQueries || rule.containerName) detectado.regrasCondicionais = true;
      if (rule.scope || rule.cssScope) detectado.scopingProximity = true;
      if (rule.pseudoElements || rule.shadowRoot || rule.shadow) detectado.encapsulationContexts = true;
      for (const prop of (rule.style && rule.style.cssProperties) || []) {
        if (/^(animation|transition)/i.test(prop.name || '')) detectado.animacoesTransicoes = true;
      }
    }
    return {
      status: 'delimitado',
      suportado: R266_AUD_CASCADE_SCOPE.suportado.slice(),
      limitacoes: R266_AUD_CASCADE_SCOPE.limitacoes.slice(),
      detectado,
    };
  }

  function analyzeSelectorSyntax(text) {
    const value = String(text || '');
    const complexa = /:(?:is|where|not|has|nth-child|nth-last-child)\s*\(|\\[^\s]|["]|[']/.test(value);
    return {
      status: complexa ? 'complexa' : 'simples',
      parserRegexUtilizado: false,
      motivo: complexa ? 'sintaxe complexa exige metadado estruturado do CDP' : null,
    };
  }

  function specificityFromSelector(text) {
    return {
      status: 'indisponivel',
      specificity: null,
      reason: 'parser-regex-removido',
      syntax: analyzeSelectorSyntax(text).status,
    };
  }

  function pseudoElementCount(text) {
    const modern = String(text || '').match(/::[\w-]+(?:\([^)]*\))?/g) || [];
    const legacy = String(text || '').match(/:(?:before|after|first-line|first-letter)(?:\([^)]*\))?/gi) || [];
    return modern.length + legacy.length;
  }

  function invalidSpecificity(reason, detail = {}) {
    return { status: 'insuficiente', specificity: null, reason, ...detail };
  }

  function ruleSpecificity(rule, match, pseudoElement) {
    const selectors = (rule && rule.selectorList && rule.selectorList.selectors) || [];
    const raw = match && match.matchingSelectors;
    if (!Array.isArray(raw) || raw.length === 0) {
      return invalidSpecificity('matching-selectors-ausente', { indicesRecebidos: null });
    }
    const entries = raw.map((item, pos) => {
      if (typeof item === 'number' && Number.isInteger(item)) {
        return { pos, index: item, valido: true, raw: item };
      }
      if (item && typeof item === 'object' && typeof item.index === 'number' && Number.isInteger(item.index)) {
        return { pos, index: item.index, valido: true, raw: item };
      }
      return { pos, index: null, valido: false, raw: item };
    });
    const invalidos = entries.filter((entry) => !entry.valido).map((entry) => ({ pos: entry.pos, raw: entry.raw }));
    if (invalidos.length > 0) return invalidSpecificity('indice-invalido', { indicesInvalidos: invalidos });
    const foraDoArray = entries.filter((entry) => entry.index < 0 || entry.index >= selectors.length)
      .map((entry) => ({ pos: entry.pos, index: entry.index }));
    if (foraDoArray.length > 0) return invalidSpecificity('indice-fora-do-array', { indicesForaDoArray: foraDoArray });
    const avaliados = [];
    for (const entry of entries) {
      const sel = selectors[entry.index];
      if (!sel) return invalidSpecificity('seletor-ausente', { indice: entry.index });
      const fonte = sel.specificity;
      if (!fonte || !['a', 'b', 'c'].every((key) => Number.isInteger(fonte[key]) && fonte[key] >= 0)) {
        return invalidSpecificity('especificidade-cdp-ausente', {
          indice: entry.index,
          texto: sel.text || ruleSelector(rule),
        });
      }
      const specificity = { a: fonte.a, b: fonte.b, c: fonte.c };
      if (pseudoElement) specificity.c = Math.max(0, specificity.c - pseudoElementCount(sel.text || ruleSelector(rule)));
      avaliados.push({
        index: entry.index,
        specificity,
        texto: sel.text || ruleSelector(rule),
        sintaxe: analyzeSelectorSyntax(sel.text || ruleSelector(rule)),
      });
    }
    let best = null;
    for (const item of avaliados) {
      if (!best || item.specificity.a > best.specificity.a
        || (item.specificity.a === best.specificity.a && item.specificity.b > best.specificity.b)
        || (item.specificity.a === best.specificity.a && item.specificity.b === best.specificity.b && item.specificity.c > best.specificity.c)) {
        best = item;
      }
    }
    if (!best) return invalidSpecificity('nenhum-indice-valido');
    return {
      status: 'disponivel',
      specificity: best.specificity,
      reason: null,
      source: 'cdp',
      indicesValidos: avaliados.map((item) => item.index),
      melhorIndice: best.index,
      sintaxe: best.sintaxe,
    };
  }

  function inheritanceProvider(entry, index) {
    if (!entry || typeof entry !== 'object') {
      return { status: 'insuficiente', reason: 'metadado-ancestral-ausente', providerNodeId: null, providerLevel: index + 1 };
    }
    const ids = [];
    if (entry.nodeId !== undefined && entry.nodeId !== null) ids.push({ campo: 'nodeId', valor: entry.nodeId });
    if (entry.parentNodeId !== undefined && entry.parentNodeId !== null) ids.push({ campo: 'parentNodeId', valor: entry.parentNodeId });
    if (entry.backendNodeId !== undefined && entry.backendNodeId !== null) ids.push({ campo: 'backendNodeId', valor: entry.backendNodeId });
    const valores = ids.map((item) => String(item.valor));
    if (valores.length > 1 && new Set(valores).size > 1) {
      return {
        status: 'insuficiente',
        reason: 'metadados-ancestral-contraditorios',
        providerNodeId: null,
        providerLevel: index + 1,
        ids,
      };
    }
    const primeiro = ids[0] || null;
    return {
      status: 'disponivel',
      reason: null,
      providerNodeId: primeiro ? primeiro.valor : null,
      providerLevel: index + 1,
      providerIdentifiedBy: primeiro ? primeiro.campo : 'cdp-ordem',
      ids,
    };
  }

  function originRank(candidate, important) {
    if (candidate.source === 'inherited') return -1;
    if (candidate.source === 'inline') return important ? 2 : 3;
    if (candidate.origin === 'user-agent') return important ? 4 : 0;
    if (candidate.origin === 'user') return important ? 3 : 1;
    return important ? 1 : 2;
  }

  function compareCandidates(a, b) {
    if (Boolean(a.important) !== Boolean(b.important)) return a.important ? -1 : 1;
    const important = Boolean(a.important);
    const ra = [originRank(a, important), a.specificity.a, a.specificity.b, a.specificity.c, a.order];
    const rb = [originRank(b, important), b.specificity.a, b.specificity.b, b.specificity.c, b.order];
    for (let i = 0; i < ra.length; i += 1) {
      if (ra[i] !== rb[i]) return rb[i] - ra[i];
    }
    return 0;
  }

  async function getWinningRule(nodeId, property, options = {}) {
    const ownCandidates = [];
    const inheritedGroups = [];
    let provenanceResolution = [];
    let uniqueEntries = [];
    const pseudoElement = options.pseudoElement ? String(options.pseudoElement) : null;
    const allCandidates = () => ownCandidates.concat(inheritedGroups.reduce((acc, group) => acc.concat(group.candidates), []));
    const empty = (status, detalhes = {}) => ({
      property,
      computedValue: null,
      resolvedValue: null,
      resolveStatus: 'unavailable',
      winningDeclaration: null,
      candidates: detalhes.candidates || allCandidates(),
      provenanceResolution,
      inheritance: detalhes.inheritance || {
        status: 'nao-aplicavel',
        receiverNodeId: nodeId,
        providerNodeId: null,
        providerLevel: null,
        originDeclaration: null,
        computedValue: null,
        ancestorChain: [],
      },
      cascadeLimitations: detalhes.cascadeLimitations || cascadeLimitations([]),
      specificityStatus: detalhes.specificityStatus || 'nao-avaliado',
      diagnostico: detalhes.diagnostico || null,
      captureStatus: status,
    });

    try {
      const matched = await CSS.getMatchedStylesForNode({ nodeId });
      if (!matched) return empty('no-matching-declaration');

      let order = 1;
      const inlineSpecificity = {
        status: 'disponivel',
        specificity: { a: 1, b: 0, c: 0 },
        reason: null,
        source: 'inline',
      };
      const addProps = (bucket, style, source, selector, specificityResult, meta, allowProvenance) => {
        if (!style || !Array.isArray(style.cssProperties)) return;
        for (const prop of style.cssProperties) {
          if (!authoredProp(prop, meta.origin) || prop.name !== property || prop.disabled === true || prop.parsedOk === false) continue;
          const provenance = allowProvenance ? findProvenance(selector, prop, meta, { provenance: uniqueEntries }) : null;
          const cdpOrigin = meta.origin || null;
          bucket.push({
            property: prop.name,
            value: prop.value || null,
            important: propImportant(prop),
            selectorText: selector || null,
            origin: provenance ? provenance.origin : cdpOrigin,
            cdpOrigin,
            provenance: provenance || null,
            styleSheetId: meta.styleSheetId || null,
            disabled: false,
            parsedOk: true,
            source,
            specificity: specificityResult.status === 'disponivel' ? specificityResult.specificity : null,
            specificityStatus: specificityResult.status,
            specificityReason: specificityResult.reason || null,
            pseudoElement: meta.pseudoElement || null,
            order: order++,
          });
        }
      };

      let ruleMatches = matched.matchedCSSRules || [];
      if (pseudoElement) {
        const pseudoType = String(pseudoElement).replace(/^::/, '');
        const entry = (matched.pseudoElements || []).find(
          (x) => x.pseudoType === pseudoType || x.pseudoType === pseudoElement
        );
        ruleMatches = entry && entry.matches ? entry.matches : [];
      }

      provenanceResolution = resolveProvenance(ruleMatches, options, property);
      uniqueEntries = provenanceResolution.filter((item) => item.status === 'unica').map((item) => item.entry);
      const limitations = cascadeLimitations(ruleMatches);

      for (const match of ruleMatches) {
        const rule = match.rule;
        if (!rule || !rule.style) continue;
        addProps(ownCandidates, rule.style, 'stylesheet', ruleSelector(rule), ruleSpecificity(rule, match, pseudoElement), {
          origin: rule.origin || null,
          styleSheetId: rule.styleSheetId || null,
          pseudoElement,
        }, true);
      }

      if (matched.attributesStyle) {
        addProps(ownCandidates, matched.attributesStyle, 'inline', null, inlineSpecificity, {
          origin: 'inline',
          styleSheetId: null,
          pseudoElement: null,
        }, false);
      }

      if (!pseudoElement) {
        try {
          const inline = await CSS.getInlineStylesForNode({ nodeId });
          if (inline && inline.inlineStyle) {
            addProps(ownCandidates, inline.inlineStyle, 'inline', null, inlineSpecificity, {
              origin: 'inline',
              styleSheetId: null,
              pseudoElement: null,
            }, false);
          }
        } catch (e) {
          cdpErrors.push(makeCDPErrorRecord('CSS.getInlineStylesForNode', e.name, e.message, { nodeId, property }));
        }

        const inheritedEntries = matched.inherited || [];
        for (let index = 0; index < inheritedEntries.length; index += 1) {
          const ancestral = inheritedEntries[index];
          const provider = inheritanceProvider(ancestral, index);
          const group = { index, provider, candidates: [] };
          if (ancestral && ancestral.inlineStyle) {
            addProps(group.candidates, ancestral.inlineStyle, 'inherited', null, inlineSpecificity, {
              origin: 'inline',
              styleSheetId: null,
              pseudoElement: null,
            }, false);
          }
          for (const match of (ancestral && ancestral.matchedCSSRules) || []) {
            const rule = match.rule;
            if (!rule || !rule.style) continue;
            addProps(group.candidates, rule.style, 'inherited', ruleSelector(rule), ruleSpecificity(rule, match, null), {
              origin: rule.origin || null,
              styleSheetId: rule.styleSheetId || null,
              pseudoElement: null,
            }, false);
          }
          inheritedGroups.push(group);
        }
      }

      const candidatos = allCandidates();
      const insuficienteEspecificidade = candidatos.find((candidate) => candidate.specificityStatus !== 'disponivel');
      if (insuficienteEspecificidade) {
        return empty('specificity-insufficient', {
          candidates: candidatos,
          cascadeLimitations: limitations,
          specificityStatus: 'insuficiente',
          inheritance: {
            status: 'insuficiente',
            reason: 'especificidade-insuficiente',
            receiverNodeId: nodeId,
            providerNodeId: null,
            providerLevel: null,
            originDeclaration: null,
            computedValue: null,
            ancestorChain: inheritedGroups.map((group) => ({ index: group.index, declarations: group.candidates.length })),
          },
          diagnostico: {
            reason: insuficienteEspecificidade.specificityReason,
            selectorText: insuficienteEspecificidade.selectorText,
            source: insuficienteEspecificidade.source,
          },
        });
      }

      const inheritedInsuficiente = inheritedGroups.find((group) => group.candidates.length > 0 && group.provider.status !== 'disponivel');
      if (inheritedInsuficiente) {
        return empty('inheritance-insufficient', {
          candidates: candidatos,
          cascadeLimitations: limitations,
          specificityStatus: 'disponivel',
          inheritance: {
            status: 'insuficiente',
            reason: inheritedInsuficiente.provider.reason,
            receiverNodeId: nodeId,
            providerNodeId: null,
            providerLevel: inheritedInsuficiente.provider.providerLevel,
            originDeclaration: null,
            computedValue: null,
            ancestorChain: inheritedGroups.map((group) => ({ index: group.index, declarations: group.candidates.length })),
          },
          diagnostico: { reason: inheritedInsuficiente.provider.reason, index: inheritedInsuficiente.index },
        });
      }

      let winner = null;
      let inheritanceInfo = null;
      const ancestorChain = inheritedGroups.map((group) => ({
        index: group.index,
        providerNodeId: group.provider.providerNodeId,
        providerLevel: group.provider.providerLevel,
        providerIdentifiedBy: group.provider.providerIdentifiedBy || null,
        declarations: group.candidates.length,
        status: group.candidates.length > 0 ? 'com-declaracao' : 'sem-declaracao',
      }));

      if (pseudoElement || ownCandidates.length > 0) {
        ownCandidates.sort(compareCandidates);
        winner = ownCandidates[0] || null;
        inheritanceInfo = {
          status: pseudoElement ? 'nao-aplicavel' : 'propria',
          reason: pseudoElement ? 'pseudo-elemento' : null,
          receiverNodeId: nodeId,
          providerNodeId: null,
          providerLevel: null,
          originDeclaration: null,
          computedValue: null,
          ancestorChain,
        };
      } else {
        for (const group of inheritedGroups) {
          if (group.candidates.length === 0) continue;
          group.candidates.sort(compareCandidates);
          winner = group.candidates[0];
          inheritanceInfo = {
            status: 'herdada',
            reason: null,
            receiverNodeId: nodeId,
            providerNodeId: group.provider.providerNodeId,
            providerLevel: group.provider.providerLevel,
            providerIdentifiedBy: group.provider.providerIdentifiedBy,
            originDeclaration: null,
            computedValue: null,
            ancestorChain,
          };
          break;
        }
      }

      if (!winner) {
        return empty('no-matching-declaration', {
          candidates: candidatos,
          cascadeLimitations: limitations,
          specificityStatus: 'disponivel',
          inheritance: inheritanceInfo || {
            status: 'sem-declaracao',
            receiverNodeId: nodeId,
            providerNodeId: null,
            providerLevel: null,
            originDeclaration: null,
            computedValue: null,
            ancestorChain,
          },
        });
      }

      let resolvedValue = winner.value;
      let resolveStatus = 'fallback-declared';
      try {
        if (pseudoElement && options.selector) {
          const expression = `(()=>{const el=document.querySelector(${JSON.stringify(options.selector)});if(!el)throw new Error('seletor nao encontrado');const cs=getComputedStyle(el,${JSON.stringify(pseudoElement)});return cs[${JSON.stringify(property)}]||null;})()`;
          const res = await Runtime.evaluate({ expression, returnByValue: true });
          if (res && res.exceptionDetails) throw new Error(describeCDPException(res.exceptionDetails));
          if (res && res.result && res.result.value !== undefined && res.result.value !== null) {
            resolvedValue = res.result.value;
            resolveStatus = 'computed';
          }
        } else if (!pseudoElement) {
          const computed = await CSS.getComputedStyleForNode({ nodeId });
          const found = (computed.computedStyle || []).find((p) => p.name === property);
          if (found) {
            resolvedValue = found.value;
            resolveStatus = 'computed';
          }
        }
      } catch (e) {
        cdpErrors.push(makeCDPErrorRecord('resolveWinningValue', e.name, e.message, { nodeId, property, pseudoElement }));
        resolveStatus = 'error';
      }

      if (inheritanceInfo && inheritanceInfo.status === 'herdada') {
        inheritanceInfo.originDeclaration = {
          selectorText: winner.selectorText,
          declaredValue: winner.value,
          important: winner.important,
          origin: winner.origin,
          source: winner.source,
        };
        inheritanceInfo.computedValue = resolvedValue;
      }

      return {
        property,
        computedValue: winner.value,
        resolvedValue,
        resolveStatus,
        winningDeclaration: { ...winner, captureStatus: 'captured' },
        candidates: candidatos,
        provenanceResolution: provenanceResolution.map((item) => {
          const copy = { ...item };
          delete copy.entry;
          return copy;
        }),
        inheritance: inheritanceInfo,
        cascadeLimitations: limitations,
        specificityStatus: 'disponivel',
        diagnostico: null,
        captureStatus: 'captured',
      };
    } catch (e) {
      cdpErrors.push(makeCDPErrorRecord('CSS.getMatchedStylesForNode', e.name, e.message, { nodeId, property }));
      return empty('cdp-error');
    }
  }

  async function captureWinningRules(c, nodeId, options = {}) {
    if (!nodeId) {
      return { error: 'node-association-failed', properties: {} };
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
      const r = await getWinningRule(nodeId, p, options);
      out[p] = {
        property: r.property,
        computedValue: r.computedValue,
        resolvedValue: r.resolvedValue,
        resolveStatus: r.resolveStatus,
        winningDeclaration: r.winningDeclaration,
          candidates: r.candidates,
          provenanceResolution: r.provenanceResolution || [],
          captureStatus: r.captureStatus,
      };
    }

    return { error: null, properties: out };
  }

  // R25-01, R25-03, R25-04, R25-05: probeState com screen no sampleId,
  // try/finally real para limpeza de pseudoestado com cleanupStatus,
  // separação visibilityStatus/geometryStatus,
  // correção de opacity, leitura correta de atributos DOM,
  // visibilidade efetiva considerando ancestrais,
  // validação geométrica completa.
  // R25.5: travessia da árvore composta (incluindo Shadow DOM) com controle
  // explícito de término.
  //
  // Esta função é interna ao núcleo compartilhado (mesma closure de
  // createCDPAuditCore, mesmo arquivo). Não é um módulo de visibilidade
  // paralelo: é a implementação do mecanismo, consumida exclusivamente por
  // probeState(), que continua sendo o único ponto de entrada.
  //
  // Contrato de retorno:
  // - ancestorVisibility: estado terminal da travessia (ver constantes acima).
  // - ancestorOpacity: produto acumulado da opacidade, ou null quando nenhum
  //   valor confiável foi obtido. SEMÂNTICA LEGADA PRESERVADA: o valor inclui
  //   a opacidade do PRÓPRIO elemento examinado, além dos níveis superiores,
  //   porque a travessia começa no elemento e sobe. O estado correspondente
  //   é reported em ancestorOpacityStatus.
  // - ancestorOpacityStatus: completude e confiabilidade do valor acumulado.
  // - ancestorHidden: algum ancestral tem visibility:hidden/collapse.
  // - ancestorDisplayNone: algum ancestral (ou o próprio elemento) tem
  //   display:none — evidência absoluta.
  // - ancestorDepth: quantidade de nós efetivamente examinados.
  // - ancestorFailureReason: causa registrada do término.
  async function traverseAncestorChain(startNodeId) {
    const result = {
      ancestorVisibility: ANCESTOR_VISIBILITY_UNAVAILABLE,
      ancestorOpacity: null,
      ancestorOpacityStatus: OPACITY_STATUS_UNAVAILABLE,
      ancestorHidden: false,
      ancestorDisplayNone: false,
      ancestorDepth: 0,
      ancestorFailureReason: null,
    };

    let startObjectId = null;
    try {
      const resolved = await DOM.resolveNode({ nodeId: startNodeId });
      if (resolved && resolved.object && resolved.object.objectId) {
        startObjectId = resolved.object.objectId;
      }
    } catch (e) {
      result.ancestorVisibility = ANCESTOR_VISIBILITY_ERROR;
      result.ancestorFailureReason = e.message;
      result.ancestorOpacityStatus = OPACITY_STATUS_ERROR;
      return result;
    }
    if (!startObjectId) {
      result.ancestorVisibility = ANCESTOR_VISIBILITY_UNAVAILABLE;
      result.ancestorFailureReason = 'não foi possível resolver o nó para travessia de ancestrais';
      return result;
    }

    const visited = new Set();
    let currentObjectId = startObjectId;
    // Identidade estável do nó para detecção de ciclo.
    // O objectId do CDP NÃO é estável: cada Runtime.callFunctionOn produz um
    // remote object novo para o mesmo elemento (verificado empiricamente), de
    // modo que um conjunto devisited indexado por objectId jamais detectaria
    // um ciclo. A identidade usada é o nodeId, obtido via DOM.requestNode.
    let currentIdentity = 'node:' + startNodeId;

    let opacityProduct = null;
    let opacityValuesRead = 0;
    let opacityReachedZero = false;
    let opacityInvalid = false;
    let traversalError = false;

    try {
      for (;;) {
        // 0) Ciclo: o nó corrente já foi visitado nesta travessia.
        if (visited.has(currentIdentity)) {
          result.ancestorVisibility = ANCESTOR_VISIBILITY_CYCLE;
          result.ancestorFailureReason = 'ciclo detectado na travessia de ancestrais';
          break;
        }
        visited.add(currentIdentity);
        result.ancestorDepth += 1;

        // 1) Estilo computado do nível corrente.
        const styleInfo = await Runtime.callFunctionOn({
          objectId: currentObjectId,
          functionDeclaration: ANCESTOR_STYLE_FUNCTION,
          returnByValue: true,
        });

        if (styleInfo && styleInfo.exceptionDetails) {
          throw new Error(describeCDPException(styleInfo.exceptionDetails));
        }

        const styleResult = styleInfo ? styleInfo.result : null;
        if (!styleResult || !styleResult.value) {
          // Falha de leitura no meio da travessia: a travessia foi iniciada mas
          // não chegou à raiz por falha de leitura -> 'partial'.
          result.ancestorVisibility = ANCESTOR_VISIBILITY_PARTIAL;
          result.ancestorFailureReason = 'não foi possível ler estilo computado do ancestral';
          break;
        }
        const styleVal = styleResult.value;

        // 2) display:none é evidência ABSOLUTA: oculta o elemento e todos os
        //    descendentes, independentemente de sobrescrita de visibility ou
        //    opacidade acima. Interrompe a travessia — mas NÃO significa que a
        //    árvore foi percorrida: o estado terminal é 'short-circuited'.
        if (styleVal.display === 'none') {
          result.ancestorDisplayNone = true;
          result.ancestorHidden = true;
          result.ancestorVisibility = ANCESTOR_VISIBILITY_SHORT_CIRCUITED;
          result.ancestorFailureReason = 'travessia interrompida por display:none em ancestral';
          break;
        }

        // 3) visibility é herdável e pode ser sobrescrita por um descendente
        //    com visibility:visible: é evidência de estilo, não de ocultação
        //    absoluta. Registrada, mas não interrompe a travessia.
        if (styleVal.visibility === 'hidden' || styleVal.visibility === 'collapse') {
          result.ancestorHidden = true;
        }

        // 4) Opacidade com validação estrita. Um valor inválido não é
        //    convertido em 1 e interrompe o acúmulo: o produto retido
        //    representa apenas o prefixo válido da cadeia, e o status
        //    'invalid' impede que ele seja apresentado como opacidade efetiva.
        const parsedOpacity = parseOpacityValue(styleVal.opacity);
        if (!parsedOpacity.valid) {
          opacityInvalid = true;
        } else if (!opacityInvalid) {
          opacityValuesRead += 1;
          opacityProduct =
            opacityProduct === null ? parsedOpacity.value : opacityProduct * parsedOpacity.value;
          if (opacityProduct === 0) opacityReachedZero = true;
        }

        // 5) A raiz real do documento encerra a travessia com 'completed'.
        if (styleVal.isRoot === true) {
          result.ancestorVisibility = ANCESTOR_VISIBILITY_COMPLETED;
          break;
        }

        // 6) Próximo ancestral na árvore composta.
        const parentInfo = await Runtime.callFunctionOn({
          objectId: currentObjectId,
          functionDeclaration: ANCESTOR_PARENT_FUNCTION,
          returnByValue: false,
        });

        // R25.6: o CDP pode resolver a chamada normalmente e devolver
        // `exceptionDetails` quando a função executada no Chromium lança uma
        // exceção. Sem esta verificação, a exceção seria confundida com a
        // simples ausência de `result`/`objectId` e classificada como
        // 'partial'. A verificação ocorre ANTES de qualquer interpretação do
        // resultado, para que a exceção seja tratada pelo catch como 'error'.
        if (parentInfo && parentInfo.exceptionDetails) {
          throw new Error(describeCDPException(parentInfo.exceptionDetails));
        }

        const parentObject = parentInfo ? parentInfo.result : null;
        if (!parentObject || !parentObject.objectId) {
          // Ausência de pai: a raiz real não foi alcançada.
          result.ancestorVisibility = ANCESTOR_VISIBILITY_PARTIAL;
          result.ancestorFailureReason =
            'não foi possível obter o elemento pai para continuar a travessia';
          break;
        }

        let nextIdentity;
        try {
          const requested = await DOM.requestNode({ objectId: parentObject.objectId });
          nextIdentity = 'node:' + requested.nodeId;
        } catch (e) {
          nextIdentity = 'object:' + parentObject.objectId;
        }

        // 7) Limite de profundidade, verificado ANTES da leitura do próximo
        //    nó. O nó 50 pode ser a raiz (tratado acima, como 'completed') ou
        //    pode ter outro ancestral — caso em que o término é 'depth-limit'.
        if (result.ancestorDepth >= MAX_ANCESTOR_DEPTH) {
          result.ancestorVisibility = ANCESTOR_VISIBILITY_DEPTH_LIMIT;
          result.ancestorFailureReason =
            `limite de profundidade (${MAX_ANCESTOR_DEPTH}) atingido na travessia de ancestrais`;
          break;
        }

        currentObjectId = parentObject.objectId;
        currentIdentity = nextIdentity;
      }
    } catch (e) {
      // Exceção real durante a travessia. As evidências já coletadas são
      // PRESERVADAS: uma falha posterior não apaga um display:none ou uma
      // opacidade zero já comprovados.
      traversalError = true;
      result.ancestorVisibility = ANCESTOR_VISIBILITY_ERROR;
      result.ancestorFailureReason = e.message;
    }

    // Contrato de integridade da opacidade, resolvido ao final da travessia.
    // Precedência: um produto zero é conclusivo e não pode ser alterado por
    // valores posteriores; depois, a exceção; depois, a invalidez; depois, o
    // curto-circuito; depois, a ausência de qualquer valor.
    if (opacityReachedZero) {
      result.ancestorOpacityStatus = OPACITY_STATUS_CONCLUSIVE_ZERO;
    } else if (traversalError) {
      result.ancestorOpacityStatus = OPACITY_STATUS_ERROR;
    } else if (opacityInvalid) {
      result.ancestorOpacityStatus = OPACITY_STATUS_INVALID;
    } else if (result.ancestorVisibility === ANCESTOR_VISIBILITY_SHORT_CIRCUITED) {
      result.ancestorOpacityStatus = OPACITY_STATUS_SHORT_CIRCUITED;
    } else if (opacityValuesRead === 0) {
      result.ancestorOpacityStatus = OPACITY_STATUS_UNAVAILABLE;
    } else if (result.ancestorVisibility === ANCESTOR_VISIBILITY_COMPLETED) {
      result.ancestorOpacityStatus = OPACITY_STATUS_COMPLETE;
    } else {
      result.ancestorOpacityStatus = OPACITY_STATUS_PARTIAL;
    }

    result.ancestorOpacity = opacityValuesRead === 0 ? null : opacityProduct;
    return result;
  }

  async function probeState(selector, state, vp, themeSet, theme, screen, sampleIdRegistry) {
    const occurrences = [];
    const localSampleIds = new Set();

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
      const sampleId = makeSampleId(vp, themeSet, theme, screen, selector, state, 0);
      if (localSampleIds.has(sampleId)) {
        throw new Error(`Duplicate sampleId: ${sampleId}`);
      }
      localSampleIds.add(sampleId);
      if (sampleIdRegistry) sampleIdRegistry.register(sampleId);
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
      const sampleId = makeSampleId(vp, themeSet, theme, screen, selector, state, i);

      if (localSampleIds.has(sampleId)) {
        throw new Error(`Duplicate sampleId: ${sampleId}`);
      }
      localSampleIds.add(sampleId);
      if (sampleIdRegistry) sampleIdRegistry.register(sampleId);

      let discarded = false;
      let reason = null;
      let computed = null;
      let boxModel = null;
      let nodeInfo = null;
      let pseudoApplied = false;
      let cleanupStatus = 'not-required';
      let cleanupError = null;

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
            cleanupStatus,
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
          cleanupStatus,
        });
        continue;
      }

      // R25-03: aplicação do pseudoestado com try/finally real envolvendo toda a computação
      try {
        if (state !== 'normal') {
          // Marcar como aplicado ANTES da chamada, pois o CDP pode ter aplicado
          // o estado no browser mesmo que a promise rejeite em seguida.
          pseudoApplied = true;
          try {
            await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
          } catch (e) {
            // Falha na aplicação do pseudoestado: registra o erro, descarta a
            // amostra e NÃO trata a coleta posterior como medição válida. O
            // finally ainda executa a limpeza (preservar try/finally real).
            cdpErrors.push(makeCDPErrorRecord('CSS.forcePseudoState-apply', e.name, e.message, {
              sampleId, selector, state, index: i, nodeId,
            }));
            discarded = true;
            reason = reason || 'pseudo-apply-error';
          }
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
            cleanupStatus = 'success';
          } catch (e) {
            cleanupStatus = 'failed';
            cleanupError = e;
            cdpErrors.push(makeCDPErrorRecord('CSS.forcePseudoState-clear', e.name, e.message, {
              sampleId, selector, state, index: i, nodeId,
            }));
            // R25-03: falha de limpeza invalida a amostra para fins de comprovação
            discarded = true;
            reason = 'cleanup-failed';
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
          cleanupStatus,
          cleanupError: cleanupError ? cleanupError.message : null,
        });
        continue;
      }

      const propMap = {};
      for (const entry of computed || []) {
        propMap[entry.name] = entry.value;
      }

      // R25-05: geometria com validação completa (4 vértices, não degenerada)
      // Contrato de geometria:
      // - 'available': box model recebido e retângulo utilizável (rect !== null)
      // - 'unavailable': box model recebido mas retângulo não utilizável (degenerado ou dados insuficientes)
      // - 'error': box model não pôde ser obtido (erro CDP)
      let rect = null;
      let geometryStatus = 'unavailable';
      if (boxModel) {
        const border = boxModel.border;
        if (border && border.length >= 8) {
          rect = rectFromBorder(border);
          if (rect !== null) {
            geometryStatus = 'available';
          } else {
            geometryStatus = 'unavailable';
          }
        } else {
          // Border existe mas com menos de 8 valores
          geometryStatus = 'unavailable';
        }
      } else {
        geometryStatus = 'error';
      }

      // R25-04: visibilidade efetiva considerando ancestrais (opacidade acumulada)
      // A travessia de ancestrais é feita via CDP (Runtime.evaluate) no contexto
      // do browser, que pode caminhar pela árvore DOM usando parentElement.
      let visibilityStatus = 'visible';
      const display = propMap.display;
      const visibility = propMap.visibility;

      // R25-04/R25.5: opacidade do próprio elemento com validação estrita.
      // Um valor inválido NÃO é convertido em 1: `ownOpacity` fica nulo e a
      // leitura inválida é tratada como ausência de evidência, não como
      // opacidade total. A integridade da cadeia é decidida pelo estado
      // `ancestorOpacityStatus`, que já cobre a opacidade do próprio elemento.
      const ownOpacityParsed = parseOpacityValue(propMap.opacity);
      const ownOpacity = ownOpacityParsed.valid ? ownOpacityParsed.value : null;
      const width = parseFloat(propMap.width);
      const height = parseFloat(propMap.height);
      const widthValid = !isNaN(width);
      const heightValid = !isNaN(height);
      const widthVal = widthValid ? width : 0;
      const heightVal = heightValid ? height : 0;

      // Verificar o próprio elemento
      if (display === 'none') {
        visibilityStatus = 'hidden';
      } else if (visibility === 'hidden' || visibility === 'collapse') {
        visibilityStatus = 'hidden';
      } else if (ownOpacity === 0) {
        visibilityStatus = 'not-visible';
      } else if (widthValid && heightValid && widthVal === 0 && heightVal === 0) {
        visibilityStatus = 'not-visible';
      } else if (rect === null && geometryStatus === 'unavailable') {
        // Geometria indisponível — não é possível confirmar visibilidade
        visibilityStatus = 'unknown';
      }

      // R25.5: mecanismo rigoroso de visibilidade e integridade da travessia.
      // A travessia de ancestrais e executada pelo nucleo compartilhado sobre o
      // nodeId especifico desta ocorrencia, e retorna o estado terminal da
      // travessia junto com o contrato de integridade da opacidade acumulada.
      const traversal = await traverseAncestorChain(nodeId);
      const ancestorVisibility = traversal.ancestorVisibility;
      const ancestorOpacityAcc = traversal.ancestorOpacity;
      const ancestorOpacityStatus = traversal.ancestorOpacityStatus;
      const ancestorHiddenAcc = traversal.ancestorHidden;
      const ancestorDisplayNoneAcc = traversal.ancestorDisplayNone;
      const ancestorDepth = traversal.ancestorDepth;
      const ancestorFailureReason = traversal.ancestorFailureReason;

      // Precedencia da decisao final de visibilidade:
      // 1. Evidencia absoluta: display:none no proprio elemento ou em qualquer
      //    ancestral relevante.
      // 2. Evidencia absoluta: opacidade acumulada conclusivamente zero.
      // 3. Ocultacao comprovada do proprio elemento (display:none ou
      //    visibility:hidden/collapse) - apurada acima e preservada.
      // 4. Incerteza: travessia incompleta, opacidade nao conclusiva ou
      //    invalida - nunca confirmar 'visible'.
      // 5. Visibilidade confirmada: exige travessia completa, opacidade
      //    completa e maior que zero, e ausencia de evidencia de ocultacao.
      //
      // Uma falha de leitura posterior nao pode apagar uma evidencia absoluta
      // ja comprovada; e uma travessia incompleta nao pode resultar em
      // visibilidade confirmada.
      //
      // visibility:hidden/collapse de ancestral nao forcou hidden sozinho:
      // o estilo computado do proprio elemento ja reflete heranca + sobrescrita.
      if (ancestorDisplayNoneAcc) {
        visibilityStatus = 'hidden';
      } else if (ancestorOpacityAcc === 0) {
        visibilityStatus = 'not-visible';
      } else if (visibilityStatus === 'visible') {
        const traversalComplete = ancestorVisibility === ANCESTOR_VISIBILITY_COMPLETED;
        const opacityComplete =
          ancestorOpacityStatus === OPACITY_STATUS_COMPLETE &&
          ancestorOpacityAcc !== null &&
          ancestorOpacityAcc > 0;
        if (!traversalComplete || !opacityComplete) {
          visibilityStatus = 'unknown';
        }
      }

      // R25-05: leitura de atributos DOM com estrutura confirmada
      // CDP DOM.describeNode retorna attributes como array de objetos [{name, value}, ...]
      // ou como array flat [name1, value1, name2, value2, ...] dependendo da versão.
      // DOM.getAttributes é mais confiável para leitura de atributos específicos.
      const attributes = Array.isArray(nodeInfo.attributes) ? nodeInfo.attributes : null;
      const findAttr = async (name) => {
        // Primeiro tenta obter via DOM.getAttributes (mais confiável)
        try {
          const attrResult = await DOM.getAttributes({nodeId});
          const attrs = attrResult.attributes || [];
          for (let ai = 0; ai < attrs.length; ai += 2) {
            if (attrs[ai] === name) {
              return attrs[ai + 1];
            }
          }
        } catch (e) {
          // Não conseguiu ler atributos via DOM.getAttributes
        }
        // Fallback: tenta obter via DOM.describeNode (já temos nodeInfo)
        if (attributes) {
          for (let ai = 0; ai < attributes.length; ai++) {
            const attr = attributes[ai];
            // Formato objeto: {name, value}
            if (attr && typeof attr === 'object' && attr.name === name) {
              return attr.value;
            }
            // Formato flat: [name1, value1, name2, value2, ...]
            if (typeof attr === 'string' && attr === name) {
              return attributes[ai + 1];
            }
          }
        }
        return null;
      };

      let disabled = null;
      if (attributes) {
        for (let ai = 0; ai < attributes.length; ai++) {
          if (attributes[ai] === 'disabled') {
            disabled = true;
            break;
          }
        }
      }
      // Se disabled ainda não encontrado, tenta via DOM.getAttributes
      if (disabled === null || disabled === undefined) {
        try {
          const attrResult = await DOM.getAttributes({nodeId});
          const attrs = attrResult.attributes || [];
          for (let ai = 0; ai < attrs.length; ai += 2) {
            if (attrs[ai] === 'disabled') {
              disabled = true;
              break;
            }
          }
        } catch (e) {
          // Não conseguiu ler disabled via DOM.getAttributes
        }
      }
      disabled = disabled === true;

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
        ancestorVisibility,
        ancestorOpacity: ancestorOpacityAcc,
        ancestorOpacityStatus,
        ancestorHidden: ancestorHiddenAcc,
        ancestorDisplayNone: ancestorDisplayNoneAcc,
        ancestorDepth,
        ancestorFailureReason,
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
        tabIndex: await findAttr('tabindex'),
        role: await findAttr('role'),
        aria: await findAttr('aria-label'),
        cleanupStatus,
        cleanupError: cleanupError ? cleanupError.message : null,
      });
    }

    return occurrences;
  }

  return {
    getWinningRule,
    ruleSpecificity,
    analyzeSelectorSyntax,
    specificityFromSelector,
    inheritanceProvider,
    cascadeLimitations,
    captureWinningRules,
    probeState,
    // R25.6: a mesma implementação de travessia usada por probeState() é
    // exposta para a coleta principal, que deixa de manter uma travessia
    // independente de ancestrais. Não há cópia: é a mesma função.
    traverseAncestorChain,
    resolveNodeIdResult,
    createSampleIdRegistry,
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
  createSampleIdRegistry,
  resolveNodeIdResult,
  createCDPAuditCore,
};
