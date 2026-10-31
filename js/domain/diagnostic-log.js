/* LIVRO-CAIXA · js/domain/diagnostic-log.js — motor central do LOG (versão simplificada).
   Objetivo: registrar eventos técnicos para inspeção de falhas.
   Contrato público mantido: logInfo, logWarn, logSyncError, recordLogEvent,
   createLogEvent, beginLogOperation.
*/

  /* =========================================================================
     VARIÁVEIS DE ESTADO
     ========================================================================= */

  let diagnosticLog = [];

  let LOG_STORAGE_KEY = 'livrocaixa_diagnostic_log';

  let LOG_SEQUENCE_STORAGE_KEY = 'livrocaixa_diagnostic_sequence';

  let LOG_SOURCE = 'Livro-Caixa-web';

  let LOG_SCHEMA_VERSION = 1;

  let logSequence = 0;

  let LOG_CURRENT_UID = null;

  let LOG_LIMIT = 200;

  /* Define as chaves de localStorage particionadas por UID. */
  function setLogStorageKeys(uid = null) {
    LOG_CURRENT_UID = uid || null;
    LOG_STORAGE_KEY = uid ? `livrocaixa_diagnostic_log_${String(uid)}` : 'livrocaixa_diagnostic_log';
    LOG_SEQUENCE_STORAGE_KEY = uid ? `livrocaixa_diagnostic_sequence_${String(uid)}` : 'livrocaixa_diagnostic_sequence';
  }

  /* Limpa o LOG na memória e redefine as chaves de storage para o novo UID. */
  function resetLogForNewUser(uid) {
    diagnosticLog.splice(0, diagnosticLog.length);
    setLogStorageKeys(uid);
    logSequence = 0;
    try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
  }

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
    const safeLabel = String(label || 'operacao').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'operacao';
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
     SANITIZAÇÃO SIMPLES
     ========================================================================= */

  /* Remove padrões sensíveis de texto livre sem destruir a legibilidade. */
  function sanitizeLogText(text) {
    if (text == null) return '';
    let s = String(text);
    s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    s = s.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
    s = s.replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, '[CNPJ_REDACTED]');
    s = s.replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');
    return s.slice(0, 800);
  }

  function sanitizeLogValue(value) {
    if (value == null) return null;
    if (value instanceof Error) return { name: value.name, message: value.message };
    if (typeof value === 'string') return sanitizeLogText(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.map(item => sanitizeLogValue(item));
    if (typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value).slice(0, 20)) {
        result[key] = sanitizeLogValue(value[key]);
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
    return {
      id: String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      sequence: Number(item.sequence) || null,
      timestamp: item.timestamp || new Date().toISOString(),
      type: ['INFO', 'WARN', 'ERROR'].includes(item.type) ? item.type : 'INFO',
      module: String(item.module || 'Sistema').slice(0, 120),
      action: sanitizeLogText(item.action || 'Operação'),
      status: String(item.status || 'Sucesso').slice(0, 80),
      description: sanitizeLogText(item.description || ''),
      details: sanitizeLogValue(item.details),
      correlationId: item.correlationId ? String(item.correlationId).slice(0, 120) : null,
      idempotencyKey: item.idempotencyKey ? String(item.idempotencyKey).slice(0, 120) : null,
      durationMs: Number(item.durationMs) || null,
      retryCount: Number(item.retryCount) || null,
      source: String(item.source || LOG_SOURCE).slice(0, 80),
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
    } catch (err) { console.warn('LOG local indisponível:', err); }
  }

  function hydrateDiagnosticLog() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch (err) {}
    diagnosticLog.splice(0, diagnosticLog.length, ...normalizeDiagnosticLog(stored));
    syncLogSequenceFromEvents(diagnosticLog);
  }

  async function loadDiagnosticLog() {
    if (typeof window !== 'undefined' && window.currentUser) {
      setLogStorageKeys(window.currentUser.uid);
    } else {
      setLogStorageKeys(null);
    }
    hydrateDiagnosticLog();
    /* Renderiza sempre após hidratar. */
    if (typeof window.renderDiagnosticLog === 'function') {
      try { window.renderDiagnosticLog(); } catch (err) { /* não bloqueia */ }
    }
    if (typeof window === 'undefined' || !window.currentUser) return;
    try {
      const snap = await window.db.collection('livrocaixa').doc(window.currentUser.uid).collection('diagnostics').limit(100).get();
      const remote = snap.docs.map(doc => ({ ...normalizeLogEvent(doc.data()), synced: true })).filter(item => item && item.id);
      const merged = new Map(diagnosticLog.map(item => [item.id, normalizeLogEvent(item)]));
      remote.forEach(item => merged.set(item.id, item));
      diagnosticLog.splice(0, diagnosticLog.length, ...[...merged.values()].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, LOG_LIMIT));
      syncLogSequenceFromEvents(diagnosticLog);
      persistDiagnosticLogLocally();
    } catch (err) { console.warn('LOG remoto indisponível:', err); }
    if (typeof window.renderDiagnosticLog === 'function') {
      try { window.renderDiagnosticLog(); } catch (err) { /* não bloqueia */ }
    }
  }

  /* =========================================================================
     CRIAÇÃO E REGISTRO DE EVENTOS
     ========================================================================= */

  function createLogEvent({ type = 'INFO', module = 'Sistema', action = 'Operação', status = 'Sucesso', description = '', details = null, correlationId = null, idempotencyKey = null, durationMs = null, retryCount = null, source = LOG_SOURCE, synced = null } = {}) {
    return {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      sequence: nextLogSequence(),
      timestamp: new Date().toISOString(), type, module, action, status,
      description: sanitizeLogText(description || ''), details: sanitizeLogValue(details),
      correlationId: correlationId ? String(correlationId).slice(0, 120) : null,
      idempotencyKey: idempotencyKey ? String(idempotencyKey).slice(0, 120) : null,
      durationMs: durationMs != null && Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0 ? Math.round(Number(durationMs)) : null,
      retryCount: Number.isFinite(Number(retryCount)) && Number(retryCount) >= 0 ? Math.floor(Number(retryCount)) : null,
      source: String(source || LOG_SOURCE).slice(0, 80), synced: synced === true ? true : synced === false ? false : null,
      schemaVersion: LOG_SCHEMA_VERSION
    };
  }

  function recordLogEvent(input = {}) {
    const correlationId = input.correlationId || null;
    const idempotencyKey = input.idempotencyKey || null;

    /* Idempotência simples por idempotencyKey. */
    if (idempotencyKey) {
      const existing = diagnosticLog.find(item => item.idempotencyKey === idempotencyKey) || null;
      if (existing) {
        if (input.status !== undefined) existing.status = input.status;
        if (input.synced !== undefined) existing.synced = input.synced;
        schedulePersistLocally();
        return existing;
      }
    }

    const event = createLogEvent({ ...input, synced: input.synced !== undefined ? input.synced : false });
    diagnosticLog.unshift(event);
    if (diagnosticLog.length > LOG_LIMIT) diagnosticLog.length = LOG_LIMIT;
    flushPersistLocally();

    /* Atualiza o painel se estiver aberto. */
    if (typeof window !== 'undefined' && typeof window.renderDiagnosticLog === 'function') {
      try {
        const panel = document.getElementById('panelDiagnostico');
        if (panel && panel.classList.contains('open')) {
          window.renderDiagnosticLog();
        }
      } catch (err) { /* não bloqueia */ }
    }

    /* Sincroniza com Firestore se houver usuário autenticado. */
    if (typeof window !== 'undefined' && window.currentUser && window.db) {
      window.db.collection('livrocaixa').doc(window.currentUser.uid).collection('diagnostics').doc(event.id).set(event, { merge: true })
        .then(() => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = true; flushPersistLocally(); })
        .catch(err => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = false; flushPersistLocally(); console.warn('Falha ao sincronizar o LOG:', err); });
    }

    if (event.type === 'ERROR') console.error(`[${event.module}] ${event.action}:`, event.description);
    else if (event.type === 'WARN') console.warn(`[${event.module}] ${event.action}:`, event.description);
    else if (event.type === 'INFO') console.info(`[${event.module}] ${event.action}:`, event.description);
    return event;
  }

  /* =========================================================================
     PAGINAÇÃO E CONSULTA SIMPLES
     ========================================================================= */

  function getDiagnosticLogPage({ offset = 0, limit = LOG_LIMIT, filter = null } = {}) {
    const sorted = [...diagnosticLog].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    let filtered = sorted;
    if (typeof filter === 'function') filtered = sorted.filter(filter);
    const page = filtered.slice(offset, offset + limit);
    return { page, total: filtered.length, offset, limit, hasMore: offset + limit < filtered.length };
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
    const message = err && err.message ? sanitizeLogText(err.message) : sanitizeLogText(String(err));
    recordLogEvent({ type: 'ERROR', module: context === 'sincronização' ? 'Sincronização' : 'Sistema', action: sanitizeLogText(context), status: 'Falha', description: message, details: err && { code: err.code }, ...getLogContextFields(operation, operationDuration(operation)) });
  }

  /* Exporta o LOG como JSON para download. */
  function exportDiagnosticLog(format = 'json') {
    const data = [...diagnosticLog].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let blob, fileName, mimeType;

    if (format === 'csv') {
      const rows = data.map(item => [
        item.id, item.sequence, item.timestamp, item.type, item.module, item.action,
        item.status, item.description, item.correlationId, item.source, item.synced
      ].join(','));
      blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      fileName = `livrocaixa_log_${timestamp}.csv`;
      mimeType = 'text/csv';
    } else {
      const payload = { exportedAt: new Date().toISOString(), uid: LOG_CURRENT_UID, total: data.length, logs: data };
      blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      fileName = `livrocaixa_log_${timestamp}.json`;
      mimeType = 'application/json';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logInfo('Sistema', 'Exportação de LOG', 'Sucesso', `Exportou ${data.length} evento(s) em ${format.toUpperCase()}`, { format, total: data.length });
    return { format, total: data.length, fileName };
  }

  /* =========================================================================
     DEBOUNCE DE PERSISTÊNCIA LOCAL
     ========================================================================= */

  let persistTimer = null;
  const PERSIST_DEBOUNCE_MS = 300;

  function schedulePersistLocally() {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistDiagnosticLogLocally();
    }, PERSIST_DEBOUNCE_MS);
  }

  function flushPersistLocally() {
    if (persistTimer !== null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    persistDiagnosticLogLocally();
  }

  export {
    logInfo, logWarn, logSyncError, recordLogEvent, createLogEvent,
    resetLogForNewUser, setLogStorageKeys, sanitizeLogText, sanitizeLogValue,
    beginLogOperation, operationDuration, getLogContextFields,
    getDiagnosticLogPage, getDiagnosticLogStats,
    diagnosticLog, LOG_STORAGE_KEY, LOG_SEQUENCE_STORAGE_KEY,
    LOG_CURRENT_UID, nextLogSequence, LOG_LIMIT, normalizeLogEvent,
    normalizeDiagnosticLog, persistDiagnosticLogLocally,
    hydrateDiagnosticLog, loadDiagnosticLog,
    exportDiagnosticLog, schedulePersistLocally, flushPersistLocally,
  };

  /* Expose para uso global no navegador. */
  if (typeof window !== 'undefined') {
    window.logInfo = logInfo;
    window.logWarn = logWarn;
    window.logSyncError = logSyncError;
    window.recordLogEvent = recordLogEvent;
    window.createLogEvent = createLogEvent;
    window.resetLogForNewUser = resetLogForNewUser;
    window.setLogStorageKeys = setLogStorageKeys;
    window.sanitizeLogText = sanitizeLogText;
    window.sanitizeLogValue = sanitizeLogValue;
    window.beginLogOperation = beginLogOperation;
    window.operationDuration = operationDuration;
    window.getLogContextFields = getLogContextFields;
    window.getDiagnosticLogPage = getDiagnosticLogPage;
    window.getDiagnosticLogStats = getDiagnosticLogStats;
    window.diagnosticLog = diagnosticLog;
    window.LOG_STORAGE_KEY = LOG_STORAGE_KEY;
    window.LOG_SEQUENCE_STORAGE_KEY = LOG_SEQUENCE_STORAGE_KEY;
    window.LOG_CURRENT_UID = LOG_CURRENT_UID;
    window.nextLogSequence = nextLogSequence;
    window.LOG_LIMIT = LOG_LIMIT;
    window.normalizeLogEvent = normalizeLogEvent;
    window.normalizeDiagnosticLog = normalizeDiagnosticLog;
    window.persistDiagnosticLogLocally = persistDiagnosticLogLocally;
    window.hydrateDiagnosticLog = hydrateDiagnosticLog;
    window.loadDiagnosticLog = loadDiagnosticLog;
    window.exportDiagnosticLog = exportDiagnosticLog;
    window.schedulePersistLocally = schedulePersistLocally;
    window.flushPersistLocally = flushPersistLocally;
  }
