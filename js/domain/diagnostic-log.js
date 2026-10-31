/* LIVRO-CAIXA · js/domain/diagnostic-log.js — motor central do LOG do sistema.
   Extração da Fase 1 do LOG (C.O.D.E.): normalização, sequência, correlação,
   sanitização, persistência local e sincronização remota.
   Contrato público mantido: logInfo, logWarn, logSyncError, recordLogEvent,
   createLogEvent, beginLogOperation.
   Nenhuma alteração de comportamento: apenas move o código para um módulo
   dedicado, preservando chave local, compatibilidade de dados antigos,
   backup e comportamento remoto.
   Falhas do logger são absorvidas e nunca interrompem operações financeiras.
*/

  let diagnosticLog;

  // compatibilidade com a interface antiga.
  let LOG_STORAGE_KEY;

  let LOG_LIMIT;

  let LOG_SCHEMA_VERSION;

  let LOG_SEQUENCE_STORAGE_KEY;

  let LOG_SOURCE;

  let logSequence;

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

  function sanitizeLogValue(value, depth = 0) {
    if (depth > 2 || value == null) return value == null ? null : String(value);
    if (value instanceof Error) return { name: value.name, message: value.message, code: value.code || null };
    if (typeof value === 'string') return value.slice(0, 800);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeLogValue(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      Object.keys(value).slice(0, 20).forEach(key => {
        if (/password|token|secret|authorization|apiKey|credential|uid/i.test(key)) return;
        result[key] = sanitizeLogValue(value[key], depth + 1);
      });
      return result;
    }
    return String(value);
  }

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
      module: String(item.module || 'Sistema').slice(0, 120),
      action: String(item.action || 'Operação').slice(0, 160),
      status: String(item.status || 'Sucesso').slice(0, 80),
      description: String(item.description || '').slice(0, 800),
      details: sanitizeLogValue(item.details),
      correlationId: item.correlationId ? String(item.correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(durationNumber) && durationNumber >= 0 ? Math.round(durationNumber) : null,
      retryCount: Number.isFinite(retryNumber) && retryNumber >= 0 ? Math.floor(retryNumber) : null,
      source: String(item.source || 'Livro-Caixa-web').slice(0, 80),
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

  function persistDiagnosticLogLocally() {
    try {
      const normalized = normalizeDiagnosticLog(diagnosticLog);
      diagnosticLog.splice(0, diagnosticLog.length, ...normalized);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem('livrocaixa_sync_errors', JSON.stringify(normalized.filter(item => item.type === 'ERROR').slice(0, 50)));
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

  function createLogEvent({ type = 'INFO', module = 'Sistema', action = 'Operação', status = 'Sucesso', description = '', details = null, correlationId = null, durationMs = null, retryCount = null, source = LOG_SOURCE, synced = null } = {}) {
    return {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      sequence: nextLogSequence(),
      timestamp: new Date().toISOString(), type, module, action, status,
      description: String(description || '').slice(0, 800), details: sanitizeLogValue(details),
      correlationId: correlationId ? String(correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0 ? Math.round(Number(durationMs)) : null,
      retryCount: Number.isFinite(Number(retryCount)) && Number(retryCount) >= 0 ? Math.floor(Number(retryCount)) : null,
      source: String(source || LOG_SOURCE).slice(0, 80), synced: synced === true ? true : synced === false ? false : null,
      schemaVersion: LOG_SCHEMA_VERSION
    };
  }

  function recordLogEvent(input = {}) {
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
