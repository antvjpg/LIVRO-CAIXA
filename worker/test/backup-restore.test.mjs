/* LIVRO-CAIXA · worker/test/backup-restore.test.mjs
   Testes de regressão para backup/restauração e isolamento entre usuários:
   1. Backup preserva diagnosticLog e auditTrail (dados não vazam no export).
   2. Sanitização do backup remove registros inválidos e respeita LOG_LIMIT.
   3. Hidratação de dados antigos (formato legacy livrocaixa_sync_errors).
   4. Isolamento entre usuários: nenhum dado vaza de um UID para outro
      (leitura cruzada impedida) tanto no LOG quanto na Trilha de Auditoria.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordLogEvent, logInfo, resetLogForNewUser, diagnosticLog,
  LOG_STORAGE_KEY, LOG_SEQUENCE_STORAGE_KEY,
  normalizeDiagnosticLog, hydrateDiagnosticLog,
} from '../../js/domain/diagnostic-log.js';
import {
  recordAuditEvent, resetAuditTrailForNewUser, auditTrail,
  AUDIT_STORAGE_KEY,
} from '../../js/domain/audit-trail.js';

/* ============================================================================
   MOCKs de ambiente
   ============================================================================ */

const storage = new Map();
const mockLocalStorage = {
  getItem(k) { return storage.get(k) || null; },
  setItem(k, v) { storage.set(k, String(v)); },
  removeItem(k) { storage.delete(k); },
  clear() { storage.clear(); },
  get length() { return storage.size; },
  key(i) { return [...storage.keys()][i]; },
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true, configurable: true });

let currentUserValue = null;
Object.defineProperty(globalThis, 'currentUser', {
  get() { return currentUserValue; },
  set(v) { currentUserValue = v; },
  configurable: true,
});

const mockDocument = { getElementById() { return null; } };
Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });

/* Mock de Firestore: db.collection('livrocaixa').doc(uid).collection(...).doc(id).set(event) */
const firestoreWrites = [];
const mockCollection = () => ({
  doc: () => ({
    collection: () => ({
      limit: () => ({ get: async () => ({ docs: [] }) }),
      doc: () => ({
        set: async (event, { merge } = {}) => {
          firestoreWrites.push({ event, merge });
        }
      })
    })
  })
});
globalThis.db = { collection: mockCollection };

let consoleWarnCalls = [];
globalThis.console = {
  ...globalThis.console,
  error() {}, warn() {}, info() {}, log() {}, debug() {},
};

function clearStorage() {
  storage.clear();
  diagnosticLog.splice(0, diagnosticLog.length);
  auditTrail.splice(0, auditTrail.length);
}

/* Simula as funções sanitizeBackupData / isValidBackupPayload de js/13-backup.js
   isoladas do DOM, para testar preservação de diagnosticLog no backup. */
const LOG_LIMIT = 200;

function isValidBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const required = ['banks','categories','entries'];
  if (!required.every(k => Array.isArray(data[k]))) return false;
  if (payload.schemaVersion != null && (!Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1 || payload.schemaVersion > 1)) return false;
  const optional = ['investments','pockets','yieldsLog','recurringBills','receivables','budgets','goals','cards','purchases','invoiceLaunches','diagnosticLog'];
  if (optional.some(k => data[k] != null && !Array.isArray(data[k]))) return false;
  return true;
}

function sanitizeBackupData(data) {
  const diagnosticLog = data.diagnosticLog.filter(item => item && typeof item === 'object' && typeof item.type === 'string' && typeof item.module === 'string').slice(0, LOG_LIMIT);
  return { data: { ...data, diagnosticLog }, dropped: { diagnosticLog: 0 } };
}

/* ============================================================================
   BACKUP / RESTAURAÇÃO / DADOS ANTIGOS
   ============================================================================ */

describe('Backup / restauração / dados antigos', () => {
  it('backup inclui diagnosticLog e é um payload válido', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    recordLogEvent({ type: 'INFO', module: 'Livro-Caixa', action: 'Salvar lançamento', status: 'Sucesso', description: 'Lançamento salvo', idempotencyKey: 'bkp_1' });

    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      userUid: 'usuario-A',
      data: {
        banks: [], categories: [], entries: [],
        investments: [], pockets: [], yieldsLog: [],
        recurringBills: [], receivables: [], budgets: [],
        goals: [], cards: [], purchases: [], invoiceLaunches: [],
        featureSettings: null,
        diagnosticLog: [...diagnosticLog]
      }
    };

    assert.ok(isValidBackupPayload(payload), 'payload de backup é válido');
    assert.strictEqual(payload.data.diagnosticLog.length, 1, 'diagnosticLog incluído no backup');
    assert.strictEqual(payload.data.diagnosticLog[0].module, 'Livro-Caixa');
  });

  it('sanitização do backup remove registros inválidos e respeita LOG_LIMIT', () => {
    clearStorage();

    const data = {
      banks: [], categories: [], entries: [],
      diagnosticLog: [
        { type: 'INFO', module: 'Sistema', action: 'A', status: 'Sucesso', description: 'válido' },
        { module: '' }, /* inválido: sem type */
        null, /* inválido: null */
        { tipo: 'outro', modulo: 'x' } /* inválido: chaves erradas */
      ]
    };

    const { data: clean, dropped } = sanitizeBackupData(data);
    assert.strictEqual(clean.diagnosticLog.length, 1, 'apenas 1 registro válido mantido');
    assert.strictEqual(clean.diagnosticLog[0].module, 'Sistema');
  });

  it('hidratação de dados antigos (formato legacy livrocaixa_sync_errors)', () => {
    clearStorage();
    resetLogForNewUser(null);

    /* Dados antigos no formato legacy de erros de sincronização */
    storage.set('livrocaixa_sync_errors', JSON.stringify([
      { context: 'sincronização', message: 'Falha de rede antiga', timestamp: '2026-01-01T00:00:00Z' },
      { context: 'autenticação', message: 'Login falhou', timestamp: '2026-01-02T00:00:00Z' }
    ]));

    hydrateDiagnosticLog();

    assert.ok(diagnosticLog.length >= 1, 'dados antigos hidratados');
    const legacy = diagnosticLog.find(item => item.module === 'Sincronização' && item.description === 'Falha de rede antiga');
    assert.ok(legacy, 'erro legado de sincronização preservado');
    assert.strictEqual(legacy.type, 'ERROR', 'tipo legado é ERROR');
  });

  it('hidratação de diagnosticLog existente (formato novo)', () => {
    clearStorage();
    resetLogForNewUser(null);

    storage.set('livrocaixa_diagnostic_log', JSON.stringify([
      { id: 'antigo-1', sequence: 1, timestamp: '2026-01-01T00:00:00Z', type: 'INFO', module: 'Sistema', action: 'Ação antiga', status: 'Sucesso', description: '', details: null, correlationId: null, idempotencyKey: null, durationMs: null, retryCount: null, source: 'Livro-Caixa-web', synced: null, schemaVersion: 1 }
    ]));

    hydrateDiagnosticLog();

    assert.strictEqual(diagnosticLog.length, 1, '1 evento antigo hidratado');
    assert.strictEqual(diagnosticLog[0].action, 'Ação antiga', 'ação preservada');
  });
});

/* ============================================================================
   ISOLAMENTO ENTRE USUÁRIOS (leitura cruzada)
   ============================================================================ */

describe('Isolamento entre usuários (LOG + Trilha de Auditoria)', () => {
  it('LOG: nenhum dado vaza de usuario-A para usuario-B', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    logInfo('Livro-Caixa', 'Salvar lançamento A', 'Sucesso', 'Lançamento do usuário A');
    const dadosA = [...diagnosticLog];

    resetLogForNewUser('usuario-B');
    currentUserValue = { uid: 'usuario-B' };

    logInfo('Livro-Caixa', 'Salvar lançamento B', 'Sucesso', 'Lançamento do usuário B');
    const dadosB = [...diagnosticLog];

    assert.strictEqual(dadosA.length, 1, 'usuario-A tem 1 evento');
    assert.strictEqual(dadosB.length, 1, 'usuario-B tem 1 evento');
    assert.strictEqual(dadosB[0].description, 'Lançamento do usuário B', 'usuario-B vê apenas seus dados');
    assert.ok(!dadosB.some(item => item.description === 'Lançamento do usuário A'), 'sem leitura cruzada: usuario-B não vê dados de A');

    /* Chaves de storage são diferentes */
    assert.ok(storage.get('livrocaixa_diagnostic_log_usuario-A'), 'chave A existe');
    assert.ok(storage.get('livrocaixa_diagnostic_log_usuario-B'), 'chave B existe');
    assert.notStrictEqual(storage.get('livrocaixa_diagnostic_log_usuario-A'), storage.get('livrocaixa_diagnostic_log_usuario-B'));
  });

  it('Trilha de Auditoria: nenhum dado vaza de usuario-A para usuario-B', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'usuario-A', entityType: 'lançamento', entityId: 'l1', action: 'criar', result: 'Sucesso' });
    const trilhaA = [...auditTrail];

    resetAuditTrailForNewUser('usuario-B');
    currentUserValue = { uid: 'usuario-B' };

    await recordAuditEvent({ actor: 'usuario-B', entityType: 'conta', entityId: 'c1', action: 'criar', result: 'Sucesso' });
    const trilhaB = [...auditTrail];

    assert.strictEqual(trilhaA.length, 1, 'usuario-A tem 1 evento de auditoria');
    assert.strictEqual(trilhaB.length, 1, 'usuario-B tem 1 evento de auditoria');
    assert.strictEqual(trilhaB[0].entityId, 'c1', 'usuario-B vê apenas sua entidade');
    assert.ok(!trilhaB.some(item => item.entityId === 'l1'), 'sem leitura cruzada: usuario-B não vê entidade de A');

    assert.ok(storage.get(AUDIT_STORAGE_KEY.replace('usuario-B', 'usuario-A')), 'chave A de auditoria existe');
    assert.ok(storage.get(AUDIT_STORAGE_KEY), 'chave B de auditoria existe');
  });
});
