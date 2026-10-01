/* LIVRO-CAIXA — log seguro do pipeline de anexos/OCR.
   Arquivos financeiros são dados sensíveis. Este módulo existe para
   imPOSSIBILITAR o vazamento por log: só chaves de metadado da lista
   branca sobrevivem; qualquer outra propriedade é descartada à vista,
   inclusive strings livres (nome de arquivo, texto do documento, OCR,
   CPF, número de cartão, payload).

   Nunca registrar: conteúdo do documento, texto OCR integral, nome do
   arquivo, dados bancários, tokens, credenciais, payloads financeiros.

   Contrato exposto: globalThis.LivroCaixaOCRLog */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LivroCaixaOCRLog = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALLOWED_KEYS = Object.freeze([
    'stage',        // etapa do pipeline
    'status',       // status tipado
    'code',         // código de erro/estado
    'reason',       // motivo curto e fixo (enum)
    'fileType',     // MIME ou extensão
    'fileSize',     // bytes (número)
    'category',     // image | document
    'environment',  // WEB | CAPACITOR | UNKNOWN
    'platform',     // web | android | ios | null
    'provider',     // ai-vision | native-ocr | none
    'durationMs',
    'attempts',
    'field',        // nome do campo (chave fixa, não valor)
    'attachmentId', // identificador técnico efêmero
    'count'
  ]);

  const NUMBER_KEYS = Object.freeze(['fileSize', 'durationMs', 'attempts', 'count']);
  const MAX_STRING = 64;

  function sanitize(meta) {
    const out = {};
    if (!meta || typeof meta !== 'object') return out;
    for (const key of ALLOWED_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
      const value = meta[key];
      if (value == null) continue;
      if (NUMBER_KEYS.indexOf(key) !== -1) {
        const num = Number(value);
        if (Number.isFinite(num)) out[key] = num;
        continue;
      }
      if (typeof value === 'string') {
        const text = value.trim();
        if (!text) continue;
        out[key] = text.length > MAX_STRING ? text.slice(0, MAX_STRING) : text;
      }
    }
    return out;
  }

  function emit(level, event, meta) {
    const safe = sanitize(meta);
    const line = [String(event || 'evento'), safe];
    try {
      if (level === 'error' && typeof console !== 'undefined' && console.warn) console.warn(...line);
      else if (typeof console !== 'undefined' && console.debug) console.debug(...line);
    } catch (err) {
      /* logging nunca pode derrubar o fluxo */
    }
    return safe;
  }

  return {
    ALLOWED_KEYS,
    sanitize,
    event: (event, meta) => emit('info', event, meta),
    failure: (event, meta) => emit('error', event, meta)
  };
});
