/* LIVRO-CAIXA — LivroCaixaOCR — camada de abstração de OCR.
   Contrato estável e independente de fornecedor/plataforma:

       const r = await LivroCaixaOCR.extract(file, { reader, signal });

   A LIA (e o restante do aplicativo) NÃO conhecem Android, Capacitor,
   plugin, fornecedor ou mecanismo de OCR. Só este contrato.

   Ambiente detectado por sinais confiáveis da plataforma (objeto
   Capacitor público + isNativePlatform()), nunca por user-agent.

   Capacidade não implementada ou não validada retorna estado explícito:
   NOT_IMPLEMENTED · UNSUPPORTED_PLATFORM · UNAVAILABLE · PERMISSION_DENIED.
   Nada é simulado.

   Contrato exposto: globalThis.LivroCaixaOCR */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./limits.js'), require('./log.js'));
  } else {
    root.LivroCaixaOCR = factory(root.LivroCaixaOCRLimits, root.LivroCaixaOCRLog);
  }
})(typeof self !== 'undefined' ? self : this, function (limitsModule, logModule) {
  'use strict';

  const limits = limitsModule || { LIMITS: {}, classifyFile: () => ({ ok: false, code: 'UNSUPPORTED_FILE' }) };
  const log = logModule || { event: () => ({}), failure: () => ({}) };
  const LIMITS = limits.LIMITS;

  const STATUS = Object.freeze({
    OK: 'OK',
    NO_TEXT: 'NO_TEXT',
    AMBIGUOUS: 'AMBIGUOUS',
    UNAVAILABLE: 'UNAVAILABLE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
    UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
    INVALID_FILE: 'INVALID_FILE',
    TOO_LARGE: 'TOO_LARGE',
    TIMEOUT: 'TIMEOUT',
    CANCELLED: 'CANCELLED',
    DUPLICATE: 'DUPLICATE',
    ERROR: 'ERROR'
  });

  /* Estados em que o pipeline pode continuar até o preview (o usuário
     revisa e completa o que faltou). */
  const CONTINUABLE = Object.freeze([STATUS.OK, STATUS.NO_TEXT, STATUS.AMBIGUOUS]);

  /* ---------------------------------------------------------- plataforma */

  function detectPlatform(rootObj) {
    const scope = rootObj || (typeof globalThis !== 'undefined' ? globalThis : {});
    const cap = scope.Capacitor;
    const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() === true);

    if (isNative) {
      let platform = null;
      try {
        platform = typeof cap.getPlatform === 'function' ? String(cap.getPlatform() || '').toLowerCase() : null;
      } catch (err) {
        platform = null;
      }
      return {
        environment: 'CAPACITOR',
        platform: platform || 'android',
        isWeb: false,
        signals: ['Capacitor.isNativePlatform()===true']
      };
    }

    const hasWindow = typeof window !== 'undefined';
    if (hasWindow) {
      return { environment: 'WEB', platform: 'web', isWeb: true, signals: ['window'] };
    }
    return { environment: 'UNKNOWN', platform: null, isWeb: false, signals: [] };
  }

  /* O que cada plataforma oferece HOJE, sem prometer o que não existe. */
  function capabilities(env, deps) {
    const d = deps || {};
    const environment = env && env.environment ? env.environment : 'UNKNOWN';
    const assisted = d.aiReady === true;

    return Object.freeze({
      environment,
      /* seleção de arquivo/galeria: API padrão da web, presente em todo PWA */
      attachmentSelection: 'AVAILABLE',
      /* OCR nativo no Android: camada de abstração pronta, plugin ainda
         NÃO implementado nem validado */
      nativeOcr: environment === 'CAPACITOR' ? 'NOT_IMPLEMENTED' : 'UNSUPPORTED_PLATFORM',
      /* leitura assistida (visão do modelo) — mecanismo já em produção */
      assistedRead: assisted ? 'AVAILABLE' : 'UNAVAILABLE',
      /* captura pela câmera: fora do escopo desta versão */
      cameraCapture: 'NOT_IMPLEMENTED',
      /* permissão de arquivo: o seletor de arquivos da web não exige
         permissão em runtime; em Capacitor seria plugin — ainda não */
      filePermission: environment === 'CAPACITOR' ? 'NOT_IMPLEMENTED' : 'NOT_REQUIRED'
    });
  }

  /* Solicitação de permissão sob demanda. Só o que o fluxo usa. */
  async function requestPermission(kind) {
    if (kind !== 'file' && kind !== 'camera' && kind !== 'storage') {
      return { status: 'UNSUPPORTED_PLATFORM', kind: String(kind || '') };
    }
    const env = detectPlatform();
    if (kind !== 'file') return { status: 'NOT_IMPLEMENTED', kind };
    return { status: env.environment === 'CAPACITOR' ? 'NOT_IMPLEMENTED' : 'GRANTED', kind };
  }

  /* ------------------------------------------------------------- helpers */

  function nowMs(nowFn) {
    return typeof nowFn === 'function' ? nowFn() : Date.now();
  }

  function baseResult(overrides) {
    return Object.assign({
      status: STATUS.ERROR,
      ok: false,
      continuable: false,
      provider: 'none',
      platform: 'UNKNOWN',
      environment: 'UNKNOWN',
      language: null,
      text: null,
      fields: null,
      candidates: null,
      meta: { stage: 'extracao', durationMs: 0, attempts: 0, fileType: null, fileSize: null },
      error: null
    }, overrides || {});
  }

  function withError(status, code, message, meta) {
    return baseResult({
      status,
      ok: false,
      continuable: false,
      error: { code, message },
      meta: Object.assign({ stage: 'extracao' }, meta || {})
    });
  }

  /* ---------------------------------------------------------- extração */

  async function extract(file, options) {
    const opts = options || {};
    const started = nowMs(opts.now);
    const platform = opts.platform || detectPlatform(opts.root);
    const environment = platform.environment;

    const meta = {
      stage: 'extracao',
      durationMs: 0,
      attempts: 0,
      environment,
      platform: platform.platform,
      fileType: file && file.type ? String(file.type) : '',
      fileSize: file && Number.isFinite(Number(file.size)) ? Number(file.size) : null
    };

    /* 1) validação de arquivo — antes de qualquer processamento pesado */
    const verdict = limits.classifyFile(
      { name: file && file.name, type: file && file.type, size: file && file.size },
      opts.contentCategory || null
    );
    if (!verdict.ok) {
      const statusMap = {
        TOO_LARGE: STATUS.TOO_LARGE,
        INVALID_FILE: STATUS.INVALID_FILE,
        DUPLICATE: STATUS.DUPLICATE
      };
      const status = statusMap[verdict.code] || STATUS.UNSUPPORTED_FILE;
      const result = withError(status, verdict.code, 'Arquivo recusado pelo validador.', meta);
      log.failure('ocr.recusado', Object.assign({}, meta, { stage: 'validacao', status, code: verdict.code, reason: verdict.reason }));
      return result;
    }

    if (verdict.category !== 'image') {
      /* PDF/DOC/DOCX/XLS/XLSX: arquitetura preparada, processamento não
         implementado nesta versão. Estado explícito, sem simulação. */
      const result = withError(
        STATUS.NOT_IMPLEMENTED,
        'DOCUMENT_READ_NOT_IMPLEMENTED',
        'Leitura deste formato ainda não está implementada.',
        meta
      );
      result.meta.category = 'document';
      log.failure('ocr.nao_implementado', Object.assign({}, meta, { status: STATUS.NOT_IMPLEMENTED, code: 'DOCUMENT_READ_NOT_IMPLEMENTED', category: 'document' }));
      return result;
    }

    /* 2) capacidade do ambiente */
    const caps = capabilities(platform, { aiReady: opts.aiReady === true });
    meta.provider = caps.assistedRead === 'AVAILABLE' ? 'ai-vision' : 'none';

    if (environment === 'UNKNOWN') {
      const result = withError(STATUS.UNSUPPORTED_PLATFORM, 'UNKNOWN_ENVIRONMENT', 'Ambiente de execução desconhecido.', meta);
      log.failure('ocr.ambiente', Object.assign({}, meta, { status: STATUS.UNSUPPORTED_PLATFORM, code: 'UNKNOWN_ENVIRONMENT' }));
      return result;
    }

    if (environment === 'CAPACITOR' && opts.useNative !== true) {
      /* ponte nativa ainda não existe: não fingir que existe */
      const result = withError(
        STATUS.NOT_IMPLEMENTED,
        'NATIVE_OCR_NOT_IMPLEMENTED',
        'OCR nativo ainda não está implementado.',
        meta
      );
      result.capabilities = caps;
      log.failure('ocr.nao_implementado', Object.assign({}, meta, { status: STATUS.NOT_IMPLEMENTED, code: 'NATIVE_OCR_NOT_IMPLEMENTED', provider: 'none' }));
      return result;
    }

    if (typeof opts.reader !== 'function') {
      const result = withError(STATUS.UNAVAILABLE, 'NO_READER', 'Nenhum provedor de leitura disponível.', meta);
      result.capabilities = caps;
      log.failure('ocr.indisponivel', Object.assign({}, meta, { status: STATUS.UNAVAILABLE, code: 'NO_READER', provider: 'none' }));
      return result;
    }

    if (caps.assistedRead !== 'AVAILABLE') {
      const result = withError(STATUS.UNAVAILABLE, 'READER_NOT_READY', 'Leitura assistida indisponível no momento.', meta);
      result.capabilities = caps;
      log.failure('ocr.indisponivel', Object.assign({}, meta, { status: STATUS.UNAVAILABLE, code: 'READER_NOT_READY', provider: 'none' }));
      return result;
    }

    /* 3) execução com timeout + cancelamento cooperativo */
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : LIMITS.PROCESS_TIMEOUT_MS;
    const maxAttempts = Number.isFinite(opts.maxAttempts) ? opts.maxAttempts : LIMITS.MAX_ATTEMPTS;
    const externalSignal = opts.signal || null;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (controller) controller.abort();
    }, timeoutMs);

    const onExternalAbort = () => {
      if (controller) controller.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) onExternalAbort();
      else if (typeof externalSignal.addEventListener === 'function') {
        externalSignal.addEventListener('abort', onExternalAbort);
      }
    }

    const cleanup = () => {
      clearTimeout(timer);
      if (externalSignal && typeof externalSignal.removeEventListener === 'function') {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    };

    let raw = null;
    let lastCode = null;
    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        meta.attempts = attempt;
        if (externalSignal && externalSignal.aborted) {
          cleanup();
          const result = withError(STATUS.CANCELLED, 'CANCELLED', 'Processamento cancelado pelo usuário.', meta);
          log.event('ocr.cancelado', Object.assign({}, meta, { status: STATUS.CANCELLED, code: 'CANCELLED' }));
          return result;
        }
        try {
          raw = await opts.reader({
            file,
            signal: controller ? controller.signal : null,
            attempt,
            prompt: opts.prompt
          });
          if (raw != null) break;
          lastCode = 'EMPTY_RESPONSE';
        } catch (err) {
          lastCode = err && err.code ? String(err.code) : 'READER_ERROR';
          if (lastCode === 'aborted' || (err && err.name === 'AbortError')) break;
          if (attempt >= maxAttempts) break;
        }
      }
    } finally {
      cleanup();
    }

    meta.durationMs = Math.max(0, nowMs(opts.now) - started);

    if (externalSignal && externalSignal.aborted && raw == null) {
      const result = withError(STATUS.CANCELLED, 'CANCELLED', 'Processamento cancelado pelo usuário.', meta);
      log.event('ocr.cancelado', Object.assign({}, meta, { status: STATUS.CANCELLED, code: 'CANCELLED' }));
      return result;
    }
    if (timedOut && raw == null) {
      const result = withError(STATUS.TIMEOUT, 'TIMEOUT', 'O tempo máximo de processamento foi atingido.', meta);
      log.failure('ocr.timeout', Object.assign({}, meta, { status: STATUS.TIMEOUT, code: 'TIMEOUT' }));
      return result;
    }
    if (raw == null) {
      const status = lastCode === 'network' || String(lastCode).indexOf('http_') === 0
        ? STATUS.UNAVAILABLE
        : STATUS.ERROR;
      const result = withError(status, lastCode || 'READER_ERROR', 'Não foi possível ler o anexo.', meta);
      log.failure('ocr.erro', Object.assign({}, meta, { status, code: lastCode || 'READER_ERROR' }));
      return result;
    }

    /* 4) interpretação da resposta (parser injetado — contrato estável) */
    const rawText = typeof raw === 'string' ? raw : String(raw == null ? '' : raw);
    let parsed = null;
    if (typeof opts.parse === 'function') {
      try {
        parsed = opts.parse(rawText);
      } catch (err) {
        parsed = null;
      }
    }

    /* resposta não interpretável → não há texto a exibir. O JSON bruto NUNCA
       vira "texto do documento" na tela do usuário. O fluxo continua como
       NO_TEXT (continuável) e o usuário revisa/digita manualmente. */
    const parseInvalid = !!(parsed && parsed.invalid === true);
    const text = parseInvalid
      ? ''
      : parsed && typeof parsed.text === 'string'
        ? parsed.text
        : rawText;
    const language = !parseInvalid && parsed && parsed.language ? parsed.language : null;
    const fields = !parseInvalid && parsed && parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : null;
    const candidates = !parseInvalid && parsed && parsed.candidates && typeof parsed.candidates === 'object' ? parsed.candidates : null;

    meta.stage = 'concluido';
    meta.provider = 'ai-vision';

    if (!String(text || '').trim()) {
      const result = baseResult({
        status: STATUS.NO_TEXT,
        ok: true,
        continuable: true,
        provider: 'ai-vision',
        platform: platform.platform,
        environment,
        language,
        text: '',
        fields,
        candidates,
        meta
      });
      log.event('ocr.sem_texto', Object.assign({}, meta, { status: STATUS.NO_TEXT, code: 'NO_TEXT' }));
      return result;
    }

    const truncated = text.length > LIMITS.MAX_EXTRACTED_TEXT_CHARS
      ? text.slice(0, LIMITS.MAX_EXTRACTED_TEXT_CHARS)
      : text;

    const result = baseResult({
      status: STATUS.OK,
      ok: true,
      continuable: true,
      provider: 'ai-vision',
      platform: platform.platform,
      environment,
      language,
      text: truncated,
      fields,
      candidates,
      meta
    });
    log.event('ocr.concluido', Object.assign({}, meta, { status: STATUS.OK }));
    return result;
  }

  return {
    STATUS,
    CONTINUABLE,
    detectPlatform,
    capabilities,
    requestPermission,
    extract
  };
});
