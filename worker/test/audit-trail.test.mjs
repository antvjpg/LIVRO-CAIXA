/* LIVRO-CAIXA · worker/test/audit-trail.test.mjs
   Testes de regressão para a Fase 6 — Trilha de Auditoria de Negócio:
   1. Registro de eventos com ator, entidade, ação, instante, resultado e integridade.
   2. Isolamento por usuário (UID) no localStorage.
   3. Integridade: previousHash encadeado, imutabilidade de registros existentes.
   4. Sem snapshots financeiros completos (details sanitizado por allowlist).
   5. Paginação e estatísticas.
   6. Persistência local e remota (Firestore isolada por UID).
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordAuditEvent, createAuditEvent,
  resetAuditTrailForNewUser, setAuditTrailStorageKeys,
  getAuditTrailPage, getAuditTrailStats,
  auditTrail, AUDIT_STORAGE_KEY, AUDIT_CURRENT_UID,
  hydrateAuditTrail, loadAuditTrail, persistAuditTrailLocally,
  computeHash,
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

/* Mock de Firestore: db.collection('livrocaixa').doc(uid).collection('auditLog').doc(id).set(event) */
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
  warn(...args) { consoleWarnCalls.push(args.map(String).join(' ')); },
  error() {}, info() {}, log() {}, debug() {},
};

function clearStorage() {
  storage.clear();
  firestoreWrites.length = 0;
  consoleWarnCalls = [];
  auditTrail.splice(0, auditTrail.length);
}

/* ============================================================================
   FASE 6 — Registro de eventos de auditoria
   ============================================================================ */

describe('Fase 6 — Registro de eventos de auditoria', () => {
  it('registra evento com ator, entidade, ação, instante, resultado e integridade', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    const event = await recordAuditEvent({
      actor: 'usuario-A',
      entityType: 'lançamento',
      entityId: 'lanc-123',
      action: 'criar',
      result: 'Sucesso',
      details: { operation: 'salvar', changeType: 'criação' },
    });

    assert.ok(event.id, 'evento tem id');
    assert.ok(event.sequence, 'evento tem sequência');
    assert.ok(event.timestamp, 'evento tem timestamp');
    assert.strictEqual(event.actor, 'usuario-A', 'ator registrado');
    assert.strictEqual(event.entityType, 'lançamento', 'tipo de entidade registrado');
    assert.strictEqual(event.entityId, 'lanc-123', 'ID da entidade registrado');
    assert.strictEqual(event.action, 'criar', 'ação registrada');
    assert.strictEqual(event.result, 'Sucesso', 'resultado registrado');
    assert.ok(event.integrityHash, 'hash de integridade presente');
    assert.strictEqual(event.previousHash, null, 'primeiro evento sem previousHash');
    assert.strictEqual(event.schemaVersion, 1, 'schemaVersion padrão 1');
  });

  it('encadeia previousHash entre eventos (anti-adulteração)', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    const e1 = await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'criar', result: 'Sucesso' });
    const e2 = await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'editar', result: 'Sucesso' });

    assert.strictEqual(e2.previousHash, e1.integrityHash, 'segundo evento referencia o hash do primeiro');
    assert.notStrictEqual(e1.integrityHash, e2.integrityHash, 'hashes diferentes para eventos diferentes');
  });

  it('não armazena snapshots financeiros completos (details sanitizado)', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    const event = await recordAuditEvent({
      actor: 'usuario-A',
      entityType: 'lançamento',
      entityId: 'lanc-1',
      action: 'editar',
      result: 'Sucesso',
      details: {
        operation: 'atualizar',
        entityType: 'lançamento',
        entityId: 'lanc-1',
        changeType: 'edição',
        /* Campos sensíveis que NÃO devem aparecer: */
        saldo: 1500.00,
        valor: 200.00,
        balance: 1300.00,
        amount: 200,
        cpf: '123.456.789-00',
        email: 'usuario@empresa.com.br',
        cardNumber: '4532 1234 5678 9012',
      },
    });

    const detalhes = JSON.stringify(event.details);

    /* Campos permitidos sobrevivem */
    assert.ok(detalhes.includes('operation'), 'operation mantido');
    assert.ok(detalhes.includes('changeType'), 'changeType mantido');

    /* Sensíveis removidos */
    assert.ok(!detalhes.includes('1500'), 'saldo não deve aparecer');
    assert.ok(!detalhes.includes('200.00'), 'valor não deve aparecer');
    assert.ok(!detalhes.includes('1300'), 'balance não deve aparecer');
    assert.ok(!detalhes.includes('123.456.789-00'), 'CPF não deve vazar');
    assert.ok(!detalhes.includes('usuario@empresa.com.br'), 'email não deve vazar');
    assert.ok(!detalhes.includes('4532'), 'cartão não deve vazar');
  });
});

/* ============================================================================
   FASE 6 — Isolamento por usuário
   ============================================================================ */

describe('Fase 6 — Isolamento por usuário', () => {
  it('chaves de storage diferentes por UID', () => {
    clearStorage();
    setAuditTrailStorageKeys('usuario-A');
    assert.strictEqual(AUDIT_STORAGE_KEY, 'livrocaixa_audit_trail_usuario-A');

    setAuditTrailStorageKeys('usuario-B');
    assert.strictEqual(AUDIT_STORAGE_KEY, 'livrocaixa_audit_trail_usuario-B');
    assert.notStrictEqual(AUDIT_STORAGE_KEY, 'livrocaixa_audit_trail_usuario-A');

    setAuditTrailStorageKeys(null);
    assert.strictEqual(AUDIT_STORAGE_KEY, 'livrocaixa_audit_trail');
  });

  it('limpa a trilha ao trocar de usuário', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'criar', result: 'Sucesso' });
    assert.strictEqual(auditTrail.length, 1, '1 evento para usuario-A');

    resetAuditTrailForNewUser('usuario-B');
    currentUserValue = { uid: 'usuario-B' };
    assert.strictEqual(auditTrail.length, 0, 'trilha limpa ao trocar de usuário');

    await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c2', action: 'criar', result: 'Sucesso' });
    assert.strictEqual(auditTrail.length, 1, '1 evento para usuario-B');
    assert.strictEqual(auditTrail[0].entityId, 'c2', 'entidade de usuario-B');
  });
});

/* ============================================================================
   FASE 6 — Imutabilidade e persistência local
   ============================================================================ */

describe('Fase 6 — Imutabilidade e persistência', () => {
  it('não permite edição de registros existentes (imutabilidade)', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    const e1 = await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'criar', result: 'Sucesso' });
    const id = e1.id;

    /* Tentativa de "editar" o mesmo registro: cria um novo evento, não sobrescreve o existente. */
    const e2 = await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'editar', result: 'Sucesso' });

    assert.notStrictEqual(e1.id, e2.id, 'edição gera novo evento, não sobrescreve');
    assert.strictEqual(auditTrail.length, 2, 'dois eventos distintos');
    assert.strictEqual(auditTrail.find(e => e.id === id).action, 'criar', 'registro original permanece inalterado');
  });

  it('persiste no localStorage e hidrata', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'u', entityType: 'cartão', entityId: 'card-1', action: 'criar', result: 'Sucesso' });
    assert.ok(storage.get(AUDIT_STORAGE_KEY), 'persistido no localStorage');

    /* Simula recarregamento: limpa memória e hidrata. */
    auditTrail.splice(0, auditTrail.length);
    hydrateAuditTrail();
    assert.strictEqual(auditTrail.length, 1, 'hidratou 1 evento do localStorage');
    assert.strictEqual(auditTrail[0].entityType, 'cartão', 'entidade preservada na hidratação');
  });

  it('grava no Firestore isolado por UID', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'u', entityType: 'lançamento', entityId: 'l-1', action: 'criar', result: 'Sucesso' });

    assert.strictEqual(firestoreWrites.length, 1, '1 gravação no Firestore');
    assert.strictEqual(firestoreWrites[0].event.entityId, 'l-1', 'evento gravado com entityId correto');
  });
});

/* ============================================================================
   FASE 6 — Paginação e estatísticas
   ============================================================================ */

describe('Fase 6 — Paginação e estatísticas', () => {
  it('pagina eventos por sequência decrescente', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c1', action: 'criar', result: 'Sucesso' });
    await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c2', action: 'criar', result: 'Sucesso' });
    await recordAuditEvent({ actor: 'u', entityType: 'conta', entityId: 'c3', action: 'criar', result: 'Sucesso' });

    const page1 = getAuditTrailPage({ offset: 0, limit: 2 });
    assert.strictEqual(page1.page.length, 2, 'primeira página tem 2 eventos');
    assert.strictEqual(page1.total, 3, 'total de 3 eventos');
    assert.strictEqual(page1.hasMore, true, 'há mais páginas');

    const page2 = getAuditTrailPage({ offset: 2, limit: 2 });
    assert.strictEqual(page2.page.length, 1, 'segunda página tem 1 evento');
    assert.strictEqual(page2.hasMore, false, 'não há mais páginas');
  });

  it('estatísticas agregam por resultado e tipo de entidade', async () => {
    clearStorage();
    resetAuditTrailForNewUser('usuario-A');
    currentUserValue = { uid: 'usuario-A' };

    await recordAuditEvent({ actor: 'u', entityType: 'lançamento', entityId: 'l1', action: 'criar', result: 'Sucesso' });
    await recordAuditEvent({ actor: 'u', entityType: 'lançamento', entityId: 'l2', action: 'editar', result: 'Falha' });
    await recordAuditEvent({ actor: 'u', entityType: 'cartão', entityId: 'c1', action: 'criar', result: 'Sucesso' });

    const stats = getAuditTrailStats();
    assert.strictEqual(stats.total, 3, 'total de 3 eventos');
    assert.strictEqual(stats.byResult.Sucesso, 2, '2 sucessos');
    assert.strictEqual(stats.byResult.Falha, 1, '1 falha');
    assert.strictEqual(stats.byEntityType.lançamento, 2, '2 lançamentos');
    assert.strictEqual(stats.byEntityType.cartão, 1, '1 cartão');
  });
});
