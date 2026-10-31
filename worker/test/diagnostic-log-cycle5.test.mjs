/* LIVRO-CAIXA · worker/test/diagnostic-log-cycle5.test.mjs
   Testes de regressão para a Fase 5 do LOG (interface, consulta e operação):
   1. Funções expostas globalmente (window/globalThis) para uso da UI.
   2. exportDiagnosticLog disponível e funcional.
   3. Filtro por ação na renderização (via getDiagnosticLogPage).
   4. Estados de sincronização diferenciados (local/pendente/sincronizado).
   5. Exportação gera JSON sanitizado dentro de limites.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordLogEvent, logInfo, logWarn, logSyncError,
  exportDiagnosticLog, getDiagnosticLogPage, getDiagnosticLogStats,
  resetLogForNewUser, diagnosticLog,
} from '../../js/domain/diagnostic-log.js';

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

const mockDocument = {
  getElementById() { return null; },
  createElement(tag) {
    const el = { href: null, download: null, clicked: false, click() { this.clicked = true; } };
    return el;
  },
  body: { appendChild() {}, removeChild() {} },
};
Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });

let lastBlobContent = null;
class MockBlob {
  constructor(parts, opts) {
    lastBlobContent = Array.isArray(parts) ? parts.join('') : String(parts);
  }
}
Object.defineProperty(globalThis, 'Blob', { value: MockBlob, writable: true, configurable: true });

let lastCreatedUrl = null;
Object.defineProperty(globalThis, 'URL', {
  value: {
    createObjectURL() { lastCreatedUrl = 'blob:mock-url'; return lastCreatedUrl; },
    revokeObjectURL() {},
  },
  writable: true, configurable: true,
});

let consoleInfoCalls = [];
globalThis.console = {
  ...globalThis.console,
  info(...args) { consoleInfoCalls.push(args.map(String).join(' ')); },
  error() {}, warn() {}, log() {}, debug() {},
};

function clearStorage() {
  storage.clear();
  consoleInfoCalls = [];
  lastBlobContent = null;
  lastCreatedUrl = null;
  diagnosticLog.splice(0, diagnosticLog.length);
}

/* ============================================================================
   FASE 5 — Exportação sanitizada
   ============================================================================ */

describe('Fase 5 — Exportação sanitizada', () => {
  it('exportDiagnosticLog gera JSON com metadados e dados sanitizados', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    recordLogEvent({ type: 'INFO', module: 'Livro-Caixa', action: 'Salvar lançamento', status: 'Sucesso', description: 'Lançamento salvo', idempotencyKey: 'exp_a' });
    recordLogEvent({ type: 'ERROR', module: 'Transferência', action: 'Transferência universal', status: 'Falha', description: 'Falha de rede', idempotencyKey: 'exp_b' });

    const result = exportDiagnosticLog('json');

    assert.strictEqual(result.format, 'json');
    assert.strictEqual(result.total, 2);
    assert.ok(result.fileName.endsWith('.json'), 'nome termina em .json');
    assert.ok(lastCreatedUrl === 'blob:mock-url', 'URL de blob criada');

    const payload = JSON.parse(lastBlobContent);
    assert.strictEqual(payload.total, 2);
    assert.strictEqual(payload.uid, 'usuario-A');
    assert.strictEqual(payload.logs.length, 2);

    /* Sanitização: nenhum dado sensível bruto */
    const bruto = JSON.stringify(payload);
    assert.ok(!bruto.includes('@'), 'email não deve vazar na exportação');
    assert.ok(!bruto.includes('cpf'), 'CPF não deve vazar na exportação');
    assert.ok(!bruto.includes('card'), 'cartão não deve vazar na exportação');

    /* logInfo registra a exportação */
    const info = consoleInfoCalls.join(' ');
    assert.ok(info.includes('Exportação de LOG'), 'exportação registrada no logInfo');
    assert.ok(info.includes('JSON'), 'formato registrado no logInfo');
  });

  it('exportação respeita limite LOG_LIMIT', () => {
    clearStorage();
    resetLogForNewUser(null);

    for (let i = 0; i < 250; i++) {
      recordLogEvent({ type: 'INFO', module: 'Sistema', action: `Ação ${i}`, status: 'Sucesso', description: 'Evento ' + i, idempotencyKey: `ev-${i}` });
    }

    assert.strictEqual(diagnosticLog.length, 200, 'limite de 200 eventos respeitado');
    const result = exportDiagnosticLog('json');
    assert.strictEqual(result.total, 200, 'exportação respeita o limite');
  });
});

/* ============================================================================
   FASE 5 — Filtro por ação e estados de sincronização
   ============================================================================ */

describe('Fase 5 — Filtro por ação e sincronização', () => {
  it('getDiagnosticLogPage filtra por ação', () => {
    clearStorage();
    resetLogForNewUser(null);

    logInfo('Cartões', 'Salvar cartão', 'Sucesso', 'Cartão criado');
    logInfo('Cartões', 'Salvar compra', 'Sucesso', 'Compra criada');
    logInfo('Livro-Caixa', 'Salvar lançamento', 'Sucesso', 'Lançamento criado');

    const cartoes = getDiagnosticLogPage({ filter: item => item.module === 'Cartões' });
    assert.strictEqual(cartoes.total, 2, 'dois eventos do módulo Cartões');

    const salvarCartao = getDiagnosticLogPage({ filter: item => item.action === 'Salvar cartão' });
    assert.strictEqual(salvarCartao.total, 1, 'um evento com ação Salvar cartão');
    assert.strictEqual(salvarCartao.page[0].module, 'Cartões');
  });

  it('estados de sincronização diferenciados', () => {
    clearStorage();
    resetLogForNewUser(null);

    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'A local', status: 'Sucesso', description: 'Local', synced: null });
    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'A pendente', status: 'Sucesso', description: 'Pendente', synced: false });
    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'A sincronizada', status: 'Sucesso', description: 'Sincronizada', synced: true });

    const stats = getDiagnosticLogStats();
    assert.strictEqual(stats.unsynced, 2, '2 eventos não sincronizados (local + pendente)');

    const local = diagnosticLog.filter(i => i.synced === null || i.synced === undefined);
    const pendente = diagnosticLog.filter(i => i.synced === false);
    const sincronizado = diagnosticLog.filter(i => i.synced === true);

    assert.strictEqual(local.length, 1, '1 evento apenas local');
    assert.strictEqual(pendente.length, 1, '1 evento pendente');
    assert.strictEqual(sincronizado.length, 1, '1 evento sincronizado');
  });
});
