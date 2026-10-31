/* LIVRO-CAIXA · js/domain/audit-trail.js — trilha de auditoria de negócio (Fase 6).
   Separação conceitual do LOG diagnóstico:
   - LOG diagnóstico responde: o que o sistema tentou fazer, onde, quando e se teve sucesso.
   - Trilha de auditoria responde: qual entidade foi alterada, qual ação ocorreu, quando,
     por qual ator/origem e qual foi o resultado.

   Contrato público: recordAuditEvent, getAuditTrailPage, getAuditTrailStats,
   resetAuditTrailForNewUser, setAuditTrailStorageKeys.

   Princípios de integridade:
   - Cada evento é imutável após ser gravado (não há edição/exclusão de registros existentes).
   - previousHash encadeia os eventos por usuário (anti-adulteração simples).
   - schemaVersion versiona o contrato.
   - Nunca armazena snapshots financeiros completos por padrão (apenas referências leves).
   - Isolamento por usuário: localStorage e Firestore particionados por UID.
   - Falhas do logger de auditoria nunca interrompem operações financeiras.
*/

  /* =========================================================================
     CONFIGURAÇÃO
     ========================================================================= */

  const AUDIT_LIMIT = 500;                    /* máximo de eventos na memória/localStorage */
  const AUDIT_DETAILS_MAX_KEYS = 10;          /* máximo de chaves em details */
  const AUDIT_DETAILS_MAX_DEPTH = 1;          /* profundidade máxima (apenas primitives) */
  const AUDIT_STRING_MAX_CHARS = 400;         /* máximo de caracteres por string em details */

  /* Campos permitidos em details (allowlist estrita). Valores financeiros
     brutos (saldos, valores, limites) NÃO devem aparecer aqui. */
  const AUDIT_DETAILS_ALLOWLIST = new Set([
    'operation', 'entitytype', 'entityid', 'previousvalue', 'newvalue',
    'changetype', 'source', 'targettype', 'targetid', 'durationms',
    'retrycount', 'synced', 'schemaversion', 'action', 'module'
  ]);

  /* =========================================================================
     VARIÁVEIS DE ESTADO
     ========================================================================= */

  let auditTrail = [];

  let AUDIT_STORAGE_KEY;
  let AUDIT_SEQUENCE_STORAGE_KEY;
  let AUDIT_CURRENT_UID = null;

  let auditSequence = 0;
  let auditPreviousHash = null;

  /* SHA-256 simples (sem dependência externa) para encadeamento de integridade. */
  async function sha256Simple(text) {
    const msg = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msg);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function computeHash(event) {
    const payload = {
      id: event.id,
      sequence: event.sequence,
      timestamp: event.timestamp,
      actor: event.actor,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      result: event.result,
      previousHash: event.previousHash || null
    };
    return sha256Simple(JSON.stringify(payload));
  }

  /* Define as chaves de localStorage particionadas por UID. */
  function setAuditTrailStorageKeys(uid = null) {
    AUDIT_CURRENT_UID = uid || null;
    AUDIT_STORAGE_KEY = uid ? `livrocaixa_audit_trail_${String(uid)}` : 'livrocaixa_audit_trail';
    AUDIT_SEQUENCE_STORAGE_KEY = uid ? `livrocaixa_audit_sequence_${String(uid)}` : 'livrocaixa_audit_sequence';
  }

  /* Limpa a trilha na memória e no localStorage para o UID atual. */
  function resetAuditTrailForNewUser(uid) {
    auditTrail.splice(0, auditTrail.length);
    setAuditTrailStorageKeys(uid);
    try { localStorage.removeItem(AUDIT_STORAGE_KEY); } catch (err) {}
    try { localStorage.removeItem(AUDIT_SEQUENCE_STORAGE_KEY); } catch (err) {}
    auditSequence = 0;
    auditPreviousHash = null;
    try { localStorage.setItem(AUDIT_SEQUENCE_STORAGE_KEY, String(auditSequence)); } catch (err) {}
  }

  function nextAuditSequence() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(AUDIT_SEQUENCE_STORAGE_KEY)) || 0; } catch (err) {}
    auditSequence = Math.max(auditSequence, stored) + 1;
    try { localStorage.setItem(AUDIT_SEQUENCE_STORAGE_KEY, String(auditSequence)); } catch (err) {}
    return auditSequence;
  }

  /* Sanitiza valores de details: apenas allowlist, sem strings livres sensíveis. */
  function sanitizeAuditValue(value, depth = 0) {
    if (depth > AUDIT_DETAILS_MAX_DEPTH || value == null) return value == null ? null : String(value);
    if (typeof value === 'string') return value.slice(0, AUDIT_STRING_MAX_CHARS);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, AUDIT_DETAILS_MAX_KEYS).map(item => sanitizeAuditValue(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      const keys = Object.keys(value).slice(0, AUDIT_DETAILS_MAX_KEYS);
      for (const key of keys) {
        if (!AUDIT_DETAILS_ALLOWLIST.has(key.toLowerCase())) continue;
        result[key] = sanitizeAuditValue(value[key], depth + 1);
      }
      return result;
    }
    return String(value);
  }

  /* =========================================================================
     REGISTRO DE EVENTO DE AUDITORIA
     ========================================================================= */

  function createAuditEvent({ actor = null, entityType = null, entityId = null, action = 'Operação',
    result = 'Sucesso', details = null, timestamp = null, schemaVersion = 1 } = {}) {
    const id = 'audit' + Date.now() + Math.random().toString(36).slice(2, 8);
    const sequence = nextAuditSequence();
    const ts = timestamp || new Date().toISOString();
    const previousHash = auditPreviousHash;

    const event = {
      id,
      sequence,
      timestamp: ts,
      actor: actor ? String(actor).slice(0, 120) : null,
      entityType: entityType ? String(entityType).slice(0, 60) : null,
      entityId: entityId ? String(entityId).slice(0, 120) : null,
      action: String(action).slice(0, 160),
      result: String(result).slice(0, 80),
      details: sanitizeAuditValue(details),
      previousHash,
      schemaVersion: Number.isFinite(Number(schemaVersion)) && Number(schemaVersion) > 0 ? Number(schemaVersion) : 1
    };

    return event;
  }

  async function recordAuditEvent(input = {}) {
    const event = createAuditEvent(input);

    /* Encadeia o hash do evento anterior para integridade. */
    try {
      event.previousHash = auditPreviousHash;
      const hash = await computeHash(event);
      event.integrityHash = hash;
      auditPreviousHash = hash;
    } catch (err) {
      /* Se o hash falhar, a trilha continua sem hash (falha absorvida). */
      event.integrityHash = null;
    }

    auditTrail.unshift(event);
    if (auditTrail.length > AUDIT_LIMIT) auditTrail.length = AUDIT_LIMIT;

    /* Persistência local (debounce imediato para auditoria — gravação crítica). */
    persistAuditTrailLocally();

    /* Persistência remota (Firestore) — isolada por usuário, nunca bloqueia o fluxo. */
    if (typeof currentUser !== 'undefined' && currentUser) {
      try {
        await db.collection('livrocaixa').doc(currentUser.uid).collection('auditLog').doc(event.id).set(event, { merge: true });
      } catch (err) {
        console.warn('Falha ao gravar trilha de auditoria no Firestore:', err);
      }
    }

    return event;
  }

  /* =========================================================================
     PERSISTÊNCIA LOCAL E HIDRATAÇÃO
     ========================================================================= */

  function persistAuditTrailLocally() {
    try {
      const normalized = normalizeAuditTrail(auditTrail);
      auditTrail.splice(0, auditTrail.length, ...normalized);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(normalized));
      /* Reconstrói o chain de hashes a partir do último evento persistido. */
      if (normalized.length > 0) {
        auditPreviousHash = normalized[normalized.length - 1].integrityHash || null;
      }
    } catch (err) { console.warn('Trilha de auditoria local indisponível:', err); }
  }

  function hydrateAuditTrail() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(AUDIT_STORAGE_KEY) || '[]'); } catch (err) {}
    if (!Array.isArray(stored) || stored.length === 0) {
      stored = [];
    }
    auditTrail.splice(0, auditTrail.length, ...normalizeAuditTrail(stored));
    /* Restaura o previousHash a partir do último evento. */
    if (auditTrail.length > 0) {
      auditPreviousHash = auditTrail[auditTrail.length - 1].integrityHash || null;
    }
    syncAuditSequenceFromEvents(auditTrail);
  }

  async function loadAuditTrail() {
    if (typeof currentUser !== 'undefined' && currentUser) {
      setAuditTrailStorageKeys(currentUser.uid);
    } else {
      setAuditTrailStorageKeys(null);
    }
    hydrateAuditTrail();
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
      const snap = await db.collection('livrocaixa').doc(currentUser.uid).collection('auditLog').limit(100).get();
      const remote = snap.docs.map(doc => ({ ...doc.data(), synced: true })).filter(item => item && item.id);
      const merged = new Map(auditTrail.map(item => [item.id, item]));
      remote.forEach(item => merged.set(item.id, item));
      auditTrail.splice(0, auditTrail.length, ...[...merged.values()].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, AUDIT_LIMIT));
      syncAuditSequenceFromEvents(auditTrail);
      persistAuditTrailLocally();
    } catch (err) { console.warn('Trilha de auditoria remota indisponível:', err); }
  }

  function syncAuditSequenceFromEvents(items) {
    const maxSequence = (Array.isArray(items) ? items : []).reduce((max, item) => Math.max(max, Number(item?.sequence) || 0), 0);
    if (maxSequence > auditSequence) {
      auditSequence = maxSequence;
      try { localStorage.setItem(AUDIT_SEQUENCE_STORAGE_KEY, String(auditSequence)); } catch (err) {}
    }
  }

  function normalizeAuditTrail(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).map(item => ({
      ...item,
      integrityHash: item.integrityHash || null,
      previousHash: item.previousHash || null,
      schemaVersion: item.schemaVersion || 1,
      actor: item.actor || null,
      entityType: item.entityType || null,
      entityId: item.entityId || null
    })).slice(0, AUDIT_LIMIT);
  }

  /* =========================================================================
     CONSULTA E PAGINAÇÃO
     ========================================================================= */

  function getAuditTrailPage({ offset = 0, limit = AUDIT_LIMIT, filter = null } = {}) {
    const sorted = [...auditTrail].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
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

  function getAuditTrailStats() {
    const total = auditTrail.length;
    const byResult = {};
    const byEntityType = {};
    auditTrail.forEach(item => {
      byResult[item.result] = (byResult[item.result] || 0) + 1;
      byEntityType[item.entityType] = (byEntityType[item.entityType] || 0) + 1;
    });
    return { total, byResult, byEntityType };
  }

  /* =========================================================================
     API PÚBLICA
     ========================================================================= */

  export {
    recordAuditEvent, createAuditEvent,
    resetAuditTrailForNewUser, setAuditTrailStorageKeys,
    getAuditTrailPage, getAuditTrailStats,
    auditTrail, AUDIT_STORAGE_KEY, AUDIT_SEQUENCE_STORAGE_KEY,
    AUDIT_CURRENT_UID, nextAuditSequence, AUDIT_LIMIT,
    hydrateAuditTrail, loadAuditTrail, persistAuditTrailLocally,
    computeHash,
  };

  /* Expose para uso global no navegador (carregado via <script src> tradicional). */
  if (typeof window !== 'undefined') {
    window.recordAuditEvent = recordAuditEvent;
    window.createAuditEvent = createAuditEvent;
    window.resetAuditTrailForNewUser = resetAuditTrailForNewUser;
    window.setAuditTrailStorageKeys = setAuditTrailStorageKeys;
    window.getAuditTrailPage = getAuditTrailPage;
    window.getAuditTrailStats = getAuditTrailStats;
    window.auditTrail = auditTrail;
    window.AUDIT_STORAGE_KEY = AUDIT_STORAGE_KEY;
    window.AUDIT_SEQUENCE_STORAGE_KEY = AUDIT_SEQUENCE_STORAGE_KEY;
    window.AUDIT_CURRENT_UID = AUDIT_CURRENT_UID;
    window.nextAuditSequence = nextAuditSequence;
    window.AUDIT_LIMIT = AUDIT_LIMIT;
    window.hydrateAuditTrail = hydrateAuditTrail;
    window.loadAuditTrail = loadAuditTrail;
    window.persistAuditTrailLocally = persistAuditTrailLocally;
    window.computeHash = computeHash;
  }
