/* LIVRO-CAIXA · js/domain/diagnostic-log.js — motor central do LOG do sistema.
   Fase 2 — Segurança e resiliência (C.O.D.E.):
   - Allowlist de campos permitidos em detalhes (substitui blacklist genérica)
   - Máscara de dados sensíveis (credenciais, tokens, valores financeiros, OCR)
   - Deduplicação por correlationId (idempotência, evita duplicidade em retry)
   - Paginação explícita e limites documentados
   - Falhas do logger são absorvidas e nunca interrompem operações financeiras
   Contrato público mantido: logInfo, logWarn, logSyncError, recordLogEvent,
   createLogEvent, beginLogOperation.
*/

  /* =========================================================================
     CONFIGURAÇÃO DE SEGURANÇA (Fase 2)
     ========================================================================= */

  /* Campos permitidos em details (allowlist). Qualquer campo fora desta lista
     é removido antes de gravar no LOG. */
  const LOG_DETAILS_ALLOWLIST = new Set([
    'operation', 'status', 'code', 'message', 'count', 'total', 'remaining',
    'month', 'year', 'date', 'startDate', 'endDate', 'closingDay', 'dueDay',
    'categoryId', 'bankId', 'pocketId', 'cardId', 'investmentId', 'goalId',
    'receivableId', 'billId', 'purchaseId', 'invoiceId', 'type', 'kind',
    'provider', 'source', 'targetType', 'targetId', 'correlationId',
    'durationMs', 'retryCount', 'synced', 'schemaVersion', 'action', 'module'
  ]);

  /* Campos sensíveis que são MASKADOS (valor substituído por '[REDACTED]')
     em vez de apenas removidos, para manter a estrutura visível sem expor dados. */
  const LOG_SENSITIVE_MASK_FIELDS = new Set([
    'amount', 'value', 'balance', 'initial', 'current', 'targetAmount',
    'currentAmount', 'purchaseRate', 'saleRate', 'purchasePrice', 'salePrice',
    'basePrice', 'units', 'price', 'code', 'cardNumber', 'document', 'cpf',
    'cnpj', 'phone', 'email', 'address'
  ]);

  /* Limites documentados (Fase 2) */
  const LOG_LIMIT = 200;                 /* máximo de eventos na memória/localStorage */
  const LOG_SYNC_ERRORS_LIMIT = 50;      /* máximo de erros de sync mantidos */
  const LOG_DETAILS_MAX_KEYS = 20;       /* máximo de chaves por objeto em details */
  const LOG_DETAILS_MAX_DEPTH = 2;       /* profundidade máxima de recursão */
  const LOG_STRING_MAX_CHARS = 800;      /* máximo de caracteres por string */
  const LOG_ARRAY_MAX_ITEMS = 20;        /* máximo de itens por array */
  const LOG_DESCRIPTION_MAX_CHARS = 800; /* máximo de caracteres na descrição */
  const LOG_MODULE_MAX_CHARS = 120;      /* máximo de caracteres no módulo */
  const LOG_ACTION_MAX_CHARS = 160;      /* máximo de caracteres na ação */
  const LOG_STATUS_MAX_CHARS = 80;       /* máximo de caracteres no status */
  const LOG_CORRELATION_ID_MAX_CHARS = 120; /* máximo no correlationId */
  const LOG_SOURCE_MAX_CHARS = 80;       /* máximo no source */

  /* =========================================================================
     VARIÁVEIS DE ESTADO
     ========================================================================= */

  let diagnosticLog;

  // compatibilidade com a interface antiga.
  let LOG_STORAGE_KEY;

  let LOG_SEQUENCE_STORAGE_KEY;

  let LOG_SOURCE;

  let logSequence;

  /* =========================================================================
     SEQUÊNCIA E CORRELAÇÃO
     ========================================================================= */

  function nextLogSequence() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(LOG_SEQUENCE_STORAGE_KEY)) || 0; } catch (err) {}
    logSequence = Math.max(logSequence, stored) + 1;
    try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    return logSequence;
  }

  function createCorrelationId(label = 'operacao') {
    const safeLabel = String(label || 'operacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'operacao';
    return `op_${Date.now()}_${safeLabel}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function beginLogOperation(module, action, details = null) {
    return { correlationId: createCorrelationId(`${module}-${action}`), startedAt: performance.now(), module, action, details };
  }

  function operationDuration(operation) {
    if (!operation || !Number.isFinite(operation.startedAt)) return null;
    return Math.max(0, Math.round(performance.now() - operation.startedAt));
  }

  function getLogContextFields(operation, durationMs = null) {
    if (!operation) return {};
    return {
      correlationId: operation.correlationId || null,
      durationMs: durationMs != null ? durationMs : null,
      source: operation.source || LOG_SOURCE
    };
  }

  /* =========================================================================
     SANITIZAÇÃO (Fase 2 — allowlist + máscara de dados sensíveis)
     ========================================================================= */

  /* Máscara de campo sensível: substitui o valor por '[REDACTED]' preservando
     a chave visível para auditoria de estrutura sem expor dados sensíveis. */
  function maskSensitiveValue(key, value) {
    const lowerKey = String(key).toLowerCase();
    if (LOG_SENSITIVE_MASK_FIELDS.has(lowerKey)) return '[REDACTED]';
    /* Detecta nomes de campo que contenham palavras sensíveis */
    if (/token|secret|password|credential|apiKey|authorization|uid|cpf|cnpj|cardNumber|email|phone|address/i.test(lowerKey)) return '[REDACTED]';
    return value;
  }

  function sanitizeLogValue(value, depth = 0) {
    if (depth > LOG_DETAILS_MAX_DEPTH || value == null) return value == null ? null : String(value);
    if (value instanceof Error) return { name: value.name, message: value.message, code: value.code || null };
    if (typeof value === 'string') return value.slice(0, LOG_STRING_MAX_CHARS);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, LOG_ARRAY_MAX_ITEMS).map(item => sanitizeLogValue(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      const keys = Object.keys(value).slice(0, LOG_DETAILS_MAX_KEYS);
      for (const key of keys) {
        /* Allowlist: apenas campos conhecidos são mantidos */
        if (!LOG_DETAILS_ALLOWLIST.has(key.toLowerCase())) continue;
        result[key] = maskSensitiveValue(key, sanitizeLogValue(value[key], depth + 1));
      }
      return result;
    }
    return String(value);
  }

  /* =========================================================================
     NORMALIZAÇÃO DE EVENTOS
     ========================================================================= */

  function normalizeLogEvent(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const sequenceNumber = Number(item.sequence);
    const durationNumber = Number(item.durationMs);
    const retryNumber = Number(item.retryCount);
    return {
      id: String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      sequence: Number.isFinite(sequenceNumber) && sequenceNumber > 0 ? sequenceNumber : null,
      timestamp: item.timestamp || new Date().toISOString(),
      type: ['INFO', 'WARN', 'ERROR'].includes(item.type) ? item.type : 'INFO',
      module: String(item.module || 'Sistema').slice(0, LOG_MODULE_MAX_CHARS),
      action: String(item.action || 'Operação').slice(0, LOG_ACTION_MAX_CHARS),
      status: String(item.status || 'Sucesso').slice(0, LOG_STATUS_MAX_CHARS),
      description: String(item.description || '').slice(0, LOG_DESCRIPTION_MAX_CHARS),
      details: sanitizeLogValue(item.details),
      correlationId: item.correlationId ? String(item.correlationId).slice(0, LOG_CORRELATION_ID_MAX_CHARS) : null,
      durationMs: Number.isFinite(durationNumber) && durationNumber >= 0 ? Math.round(durationNumber) : null,
      retryCount: Number.isFinite(retryNumber) && retryNumber >= 0 ? Math.floor(retryNumber) : null,
      source: String(item.source || 'Livro-Caixa-web').slice(0, LOG_SOURCE_MAX_CHARS),
      synced: item.synced === true ? true : item.synced === false ? false : null,
      schemaVersion: Number(item.schemaVersion) || 1
    };
  }

  function normalizeDiagnosticLog(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).map(normalizeLogEvent).slice(0, LOG_LIMIT);
  }

  function syncLogSequenceFromEvents(items) {
    const maxSequence = (Array.isArray(items) ? items : []).reduce((max, item) => Math.max(max, Number(item?.sequence) || 0), 0);
    if (maxSequence > logSequence) {
      logSequence = maxSequence;
      try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    }
  }

  /* =========================================================================
     PERSISTÊNCIA LOCAL E REMOTA
     ========================================================================= */

  function persistDiagnosticLogLocally() {
    try {
      const normalized = normalizeDiagnosticLog(diagnosticLog);
      diagnosticLog.splice(0, diagnosticLog.length, ...normalized);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem('livrocaixa_sync_errors', JSON.stringify(normalized.filter(item => item.type === 'ERROR').slice(0, LOG_SYNC_ERRORS_LIMIT)));
    } catch (err) { console.warn('LOG local indisponível:', err); }
  }

  function hydrateDiagnosticLog() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch (err) {}
    if (!Array.isArray(stored) || stored.length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem('livrocaixa_sync_errors') || '[]');
        stored = Array.isArray(legacy) ? legacy.map(item => ({ id: 'legacy-' + Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), type: 'ERROR', module: 'Sincronização', action: item.context || 'Operação', status: 'Falha', description: item.message || 'Erro legado', details: null })) : [];
      } catch (err) {}
    }
    diagnosticLog.splice(0, diagnosticLog.length, ...normalizeDiagnosticLog(stored));
    syncLogSequenceFromEvents(diagnosticLog);
  }

  async function loadDiagnosticLog() {
    hydrateDiagnosticLog();
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
      const snap = await db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').limit(100).get();
      const remote = snap.docs.map(doc => ({ ...normalizeLogEvent(doc.data()), synced: true })).filter(item => item && item.id);
      const merged = new Map(diagnosticLog.map(item => [item.id, normalizeLogEvent(item)]));
      remote.forEach(item => merged.set(item.id, item));
      diagnosticLog.splice(0, diagnosticLog.length, ...[...merged.values()].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, LOG_LIMIT));
      syncLogSequenceFromEvents(diagnosticLog);
      persistDiagnosticLogLocally();
    } catch (err) { console.warn('LOG remoto indisponível:', err); }
  }

  /* =========================================================================
     CRIAÇÃO E REGISTRO DE EVENTOS (IDEMPOTÊNCIA)
     ========================================================================= */

  function createLogEvent({ type = 'INFO', module = 'Sistema', action = 'Operação', status = 'Sucesso', description = '', details = null, correlationId = null, durationMs = null, retryCount = null, source = LOG_SOURCE, synced = null } = {}) {
    return {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      sequence: nextLogSequence(),
      timestamp: new Date().toISOString(), type, module, action, status,
      description: String(description || '').slice(0, LOG_DESCRIPTION_MAX_CHARS), details: sanitizeLogValue(details),
      correlationId: correlationId ? String(correlationId).slice(0, LOG_CORRELATION_ID_MAX_CHARS) : null,
      durationMs: Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0 ? Math.round(Number(durationMs)) : null,
      retryCount: Number.isFinite(Number(retryCount)) && Number(retryCount) >= 0 ? Math.floor(Number(retryCount)) : null,
      source: String(source || LOG_SOURCE).slice(0, LOG_SOURCE_MAX_CHARS), synced: synced === true ? true : synced === false ? false : null,
      schemaVersion: LOG_SCHEMA_VERSION
    };
  }

  /* Verifica se já existe um evento com o mesmo correlationId (idempotência).
     Evita duplicidade em retry de operações. */
  function findExistingEventByCorrelationId(correlationId) {
    if (!correlationId) return null;
    return diagnosticLog.find(item => item.correlationId === correlationId) || null;
  }

  function recordLogEvent(input = {}) {
    const correlationId = input.correlationId || null;

    /* Idempotência: se já existe um evento com este correlationId, não duplica */
    if (correlationId) {
      const existing = findExistingEventByCorrelationId(correlationId);
      if (existing) {
        /* Atualiza apenas o status/synced do evento existente, se houver mudança */
        if (input.status !== undefined) existing.status = input.status;
        if (input.synced !== undefined) existing.synced = input.synced;
        persistDiagnosticLogLocally();
        return existing;
      }
    }

    const event = createLogEvent({ ...input, synced: typeof currentUser !== 'undefined' && currentUser ? false : null });
    diagnosticLog.unshift(event);
    if (diagnosticLog.length > LOG_LIMIT) diagnosticLog.length = LOG_LIMIT;
    persistDiagnosticLogLocally();
    if (event.type === 'ERROR') flashSyncError();
    if (typeof currentUser !== 'undefined' && currentUser) {
      db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').doc(event.id).set(event, { merge: true })
        .then(() => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = true; persistDiagnosticLogLocally(); })
        .catch(err => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = false; persistDiagnosticLogLocally(); console.warn('Falha ao sincronizar o LOG:', err); });
    }
    if (event.type === 'ERROR') console.error(`[${event.module}] ${event.action}:`, event.description, event.details || '');
    else if (event.type === 'WARN') console.warn(`[${event.module}] ${event.action}:`, event.description);
    return event;
  }

  /* =========================================================================
     PAGINAÇÃO E CONSULTA (Fase 2)
     ========================================================================= */

  /* Retorna uma página paginada do LOG.
     offset: índice inicial (0-based)
     limit: máximo de itens retornados
     filter: função opcional para filtrar (por type, module, status, etc.)
   */
  function getDiagnosticLogPage({ offset = 0, limit = LOG_LIMIT, filter = null } = {}) {
    const sorted = [...diagnosticLog].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    let filtered = sorted;
    if (typeof filter === 'function') filtered = sorted.filter(filter);
    const page = filtered.slice(offset, offset + limit);
    return {
      page,
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length
    };
  }

  function getDiagnosticLogStats() {
    const total = diagnosticLog.length;
    const byType = { INFO: 0, WARN: 0, ERROR: 0 };
    const byModule = {};
    diagnosticLog.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
      byModule[item.module] = (byModule[item.module] || 0) + 1;
    });
    const unsynced = diagnosticLog.filter(item => item.synced === false || item.synced === null).length;
    return { total, byType, byModule, unsynced };
  }

  /* =========================================================================
     API PÚBLICA
     ========================================================================= */

  function logInfo(module, action, status = 'Sucesso', description = '', details = null, operation = null) {
    const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null;
    return recordLogEvent({ type: 'INFO', module, action, status, description, details, ...getLogContextFields(operation, duration) });
  }

  function logWarn(module, action, status = 'Atenção', description = '', details = null, operation = null) {
    const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null;
    return recordLogEvent({ type: 'WARN', module, action, status, description, details, ...getLogContextFields(operation, duration) });
  }

  function logSyncError(context, err, operation = null) {
    const message = err && err.message ? err.message : String(err);
    recordLogEvent({ type: 'ERROR', module: context === 'sincronização' ? 'Sincronização' : 'Sistema', action: context, status: 'Falha', description: message, details: err && { code: err.code, failedCollections: err.failedCollections }, ...getLogContextFields(operation, operationDuration(operation)) });
  }

  function flashSyncError() {
    const dot = document.getElementById('syncDot');
    if (!dot) return;
    dot.classList.add('sync-error');
    setTimeout(() => dot.classList.remove('sync-error'), 4000);
  }

  /* =========================================================================
     ADAPTADORES DE DIAGNÓSTICOS ESPECIALIZADOS (Fase 3)
     =========================================================================
     Integram fontes externas de diagnóstico ao motor central, preservando
     sanitização e finalidade específicas de cada fonte:

     - OCR: apenas metadados da whitelist, nunca texto extraído/imagem/CPF/cartão/payload
     - Login: eventos de autenticação com sanitização própria
     - Worker/IA/Integrações: já usam logInfo/logWarn/logSyncError diretamente
   */

  /* Adapta eventos do pipeline de OCR para o motor central.
     Usa apenas chaves da allowlist do OCR (stage, status, code, reason,
     fileType, fileSize, category, environment, platform, provider,
     durationMs, attempts, field, attachmentId, count).
     Nunca grava texto do documento, nome do arquivo, CPF, cartão ou payload. */
  function recordOCREvent(event, meta = {}) {
    const allowedMeta = {};
    const ocrAllowed = [
      'stage', 'status', 'code', 'reason', 'fileType', 'fileSize',
      'category', 'environment', 'platform', 'provider', 'durationMs',
      'attempts', 'field', 'attachmentId', 'count'
    ];
    for (const key of ocrAllowed) {
      if (key in meta) allowedMeta[key] = meta[key];
    }
    return recordLogEvent({
      type: 'INFO',
      module: 'OCR',
      action: event,
      status: 'Sucesso',
      description: `OCR: ${event}`,
      details: allowedMeta,
      correlationId: allowedMeta.attachmentId || null,
      durationMs: allowedMeta.durationMs || null
    });
  }

  /* Adapta falhas do pipeline de OCR para o motor central. */
  function recordOCRFailure(event, meta = {}) {
    const allowedMeta = {};
    const ocrAllowed = [
      'stage', 'status', 'code', 'reason', 'fileType', 'fileSize',
      'category', 'environment', 'platform', 'provider', 'durationMs',
      'attempts', 'field', 'attachmentId', 'count'
    ];
    for (const key of ocrAllowed) {
      if (key in meta) allowedMeta[key] = meta[key];
    }
    return recordLogEvent({
      type: 'ERROR',
      module: 'OCR',
      action: event,
      status: 'Falha',
      description: `OCR falha: ${event}`,
      details: allowedMeta,
      correlationId: allowedMeta.attachmentId || null,
      durationMs: allowedMeta.durationMs || null
    });
  }

  /* Adapta eventos de login para o motor central.
     Sanitiza dados sensíveis usando a allowlist do motor central. */
  function recordLoginEvent(type, message, details = null) {
    const safeDetails = details ? sanitizeLogValue(details) : null;
    return recordLogEvent({
      type: type === 'ERROR' ? 'ERROR' : type === 'WARN' ? 'WARN' : 'INFO',
      module: 'Login',
      action: message,
      status: type === 'ERROR' ? 'Falha' : type === 'WARN' ? 'Atenção' : 'Sucesso',
      description: String(message || '').slice(0, LOG_DESCRIPTION_MAX_CHARS),
      details: safeDetails,
      source: 'Login'
    });
  }
