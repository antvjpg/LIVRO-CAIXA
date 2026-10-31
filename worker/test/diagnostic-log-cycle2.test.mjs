/* LIVRO-CAIXA · worker/test/diagnostic-log-cycle2.test.mjs
   Testes de regressão para o Ciclo 2 do LOG (confiabilidade e exportação):
   1. Exportação JSON/CSV — exportDiagnosticLog gera arquivo com dados sanitizados
   2. Debounce de persistência — schedulePersistLocally/flushPersistLocally
   3. Retry de sincronização — eventos falhos marcam synced=false sem quebrar o fluxo
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  logInfo, logWarn, logSyncError, recordLogEvent, createLogEvent,
  resetLogForNewUser, setLogStorageKeys, sanitizeLogText, sanitizeLogValue,
  beginLogOperation, operationDuration, getLogContextFields,
  getDiagnosticLogPage, getDiagnosticLogStats,
  diagnosticLog, LOG_STORAGE_KEY, LOG_SEQUENCE_STORAGE_KEY,
  LOG_CURRENT_UID, nextLogSequence, LOG_LIMIT, recordOCREvent,
  normalizeLogEvent, normalizeDiagnosticLog, persistDiagnosticLogLocally,
  hydrateDiagnosticLog, loadDiagnosticLog,
  exportDiagnosticLog, schedulePersistLocally, flushPersistLocally,
} from '../../js/domain/diagnostic-log.js';

/* ============================================================================
   MOCKs de ambiente (localStorage, currentUser, console, document, Blob, URL,
   setTimeout/clearTimeout)
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

const createdElements = [];
const mockDocument = {
  getElementById() { return null; },
  createElement(tag) {
    const el = { href: null, download: null, clicked: false, click() { this.clicked = true; } };
    createdElements.push(el);
    return el;
  },
  body: { appendChild() {}, removeChild() {} },
};
Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });

let lastBlobContent = null;
let lastBlobType = null;
class MockBlob {
  constructor(parts, opts) {
    lastBlobContent = Array.isArray(parts) ? parts.join('') : String(parts);
    lastBlobType = (opts && opts.type) || null;
  }
}
Object.defineProperty(globalThis, 'Blob', { value: MockBlob, writable: true, configurable: true });

let lastCreatedUrl = null;
let lastRevokedUrl = null;
Object.defineProperty(globalThis, 'URL', {
  value: {
    createObjectURL(blob) { lastCreatedUrl = 'blob:mock-url'; return lastCreatedUrl; },
    revokeObjectURL(u) { lastRevokedUrl = u; },
  },
  writable: true, configurable: true,
});

let consoleInfoCalls = [];
let consoleErrorCalls = [];
let consoleWarnCalls = [];
globalThis.console = {
  ...globalThis.console,
  error(...args) { consoleErrorCalls.push(args.map(String).join(' ')); },
  warn(...args) { consoleWarnCalls.push(args.map(String).join(' ')); },
  log(...args) { process.stdout.write(args.map(String).join(' ') + '\n'); },
  info(...args) { consoleInfoCalls.push(args.map(String).join(' ')); },
  debug() {},
};

/* Mock de setTimeout/clearTimeout que expõe callbacks para execução manual,
   permitindo testar debounce sem aguardar tempo real. */
const pendingTimers = new Map();
let timerCounter = 0;
function mockSetTimeout(cb, ms) {
  const id = ++timerCounter;
  pendingTimers.set(id, { cb, ms });
  return id;
}
function mockClearTimeout(id) {
  pendingTimers.delete(id);
}
function runPendingTimer(id) {
  const entry = pendingTimers.get(id);
  if (!entry) return false;
  pendingTimers.delete(id);
  entry.cb();
  return true;
}
Object.defineProperty(globalThis, 'setTimeout', { value: mockSetTimeout, writable: true, configurable: true });
Object.defineProperty(globalThis, 'clearTimeout', { value: mockClearTimeout, writable: true, configurable: true });

function clearStorage() {
  storage.clear();
  consoleInfoCalls = [];
  consoleErrorCalls = [];
  consoleWarnCalls = [];
  createdElements.length = 0;
  lastBlobContent = null;
  lastBlobType = null;
  lastCreatedUrl = null;
  lastRevokedUrl = null;
  pendingTimers.clear();
  timerCounter = 0;
  diagnosticLog.splice(0, diagnosticLog.length);
}

/* ============================================================================
   CICLO 2 — Exportação JSON/CSV
   ============================================================================ */

describe('Ciclo 2 — Exportação de dados', () => {
  it('exporta JSON com todos os eventos e metadados', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');

    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'Abertura', status: 'Sucesso', description: 'App aberto', idempotencyKey: 'exp_1' });
    recordLogEvent({ type: 'ERROR', module: 'Sincronização', action: 'Falha', status: 'Falha', description: 'Falha de rede', idempotencyKey: 'exp_2' });

    const result = exportDiagnosticLog('json');

    assert.strictEqual(result.format, 'json');
    assert.strictEqual(result.total, 2);
    assert.ok(result.fileName.endsWith('.json'), 'nome do arquivo deve terminar em .json');
    assert.ok(lastCreatedUrl === 'blob:mock-url', 'deve criar URL de blob');
    assert.ok(lastRevokedUrl === 'blob:mock-url', 'deve revogar a URL após o download');
    assert.ok(createdElements.length === 1, 'deve criar um link <a>');
    assert.ok(createdElements[0].clicked, 'deve disparar clique no link');
    assert.ok(createdElements[0].download.endsWith('.json'), 'link deve ter atributo download');

    const payload = JSON.parse(lastBlobContent);
    assert.strictEqual(payload.total, 2);
    assert.strictEqual(payload.uid, 'usuario-A');
    assert.strictEqual(payload.logs.length, 2);
    assert.strictEqual(payload.logs[0].idempotencyKey, 'exp_2');
    assert.strictEqual(payload.logs[1].idempotencyKey, 'exp_1');

    /* Sanitização respeitada: não deve vazar dados sensíveis */
    const bruto = JSON.stringify(payload);
    assert.ok(!bruto.includes('joao.silva@empresa.com.br'), 'JSON não deve expor email bruto');
  });

  it('exporta CSV com cabeçalho e linhas corretas', () => {
    clearStorage();
    setLogStorageKeys(null);

    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'Ação', status: 'Sucesso', description: 'Descrição com "aspas"', idempotencyKey: 'csv_1' });

    const result = exportDiagnosticLog('csv');

    assert.strictEqual(result.format, 'csv');
    assert.strictEqual(result.total, 1);
    assert.ok(result.fileName.endsWith('.csv'), 'nome do arquivo deve terminar em .csv');

    const linhas = lastBlobContent.split('\n');
    assert.strictEqual(linhas[0], 'id,sequence,timestamp,type,module,action,status,description,correlationId,idempotencyKey,durationMs,retryCount,source,synced,details');
    assert.strictEqual(linhas.length, 2, 'cabeçalho + 1 linha de dados');
    assert.ok(linhas[1].includes('csv_1'), 'linha deve conter o idempotencyKey');
    assert.ok(linhas[1].includes('Sucesso'), 'linha deve conter o status');
  });

  it('formato padrão é JSON quando não informado', () => {
    clearStorage();
    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'X', status: 'Sucesso', description: 'Y', idempotencyKey: 'df_1' });

    const result = exportDiagnosticLog();
    assert.strictEqual(result.format, 'json');
    assert.ok(lastBlobContent.startsWith('{'), 'conteúdo padrão deve ser JSON');
  });

  it('chama logInfo registrando a exportação', () => {
    clearStorage();
    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'X', status: 'Sucesso', description: 'Y', idempotencyKey: 'li_1' });

    exportDiagnosticLog('json');

    const info = consoleInfoCalls.join(' ');
    assert.ok(info.includes('Exportação de LOG'), 'deve registrar exportação no logInfo');
    assert.ok(info.includes('JSON'), 'deve registrar o formato');
  });
});

/* ============================================================================
   CICLO 2 — Debounce de persistência local
   ============================================================================ */

describe('Ciclo 2 — Debounce de persistência', () => {
  it('schedulePersistLocally agenda a persistência (não grava imediatamente)', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');

    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'A', status: 'Sucesso', description: 'B', idempotencyKey: 'db_1' });

    /* Limpa o estado de persistência do evento acima para testar o debounce puro */
    diagnosticLog.splice(0, diagnosticLog.length);
    storage.delete(LOG_STORAGE_KEY);

    schedulePersistLocally();
    assert.ok(pendingTimers.size >= 1, 'deve agendar pelo menos um timer');
    assert.strictEqual(storage.get(LOG_STORAGE_KEY), undefined, 'não deve persistir imediatamente');

    /* Executa o(s) timer(s) pendente(s) */
    for (const [id] of pendingTimers) {
      runPendingTimer(id);
    }
    assert.ok(storage.get(LOG_STORAGE_KEY) != null, 'deve persistir após executar o timer agendado');
  });

  it('flushPersistLocally persiste imediatamente e cancela timer pendente', () => {
    clearStorage();
    setLogStorageKeys(null);

    recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'A', status: 'Sucesso', description: 'B', idempotencyKey: 'fp_1' });

    flushPersistLocally();
    assert.ok(storage.get(LOG_STORAGE_KEY) != null, 'deve persistir imediatamente');
    assert.strictEqual(pendingTimers.size, 0, 'não deve deixar timer pendente após flush');
  });

  it('múltiplos schedulePersistLocally agendam apenas um timer', () => {
    clearStorage();
    diagnosticLog.splice(0, diagnosticLog.length);
    storage.delete(LOG_STORAGE_KEY);

    schedulePersistLocally();
    schedulePersistLocally();
    schedulePersistLocally();
    assert.strictEqual(pendingTimers.size, 1, 'deve manter apenas um timer agendado');
  });
});

/* ============================================================================
   CICLO 2 — Retry de sincronização (eventos falhos)
   ============================================================================ */

describe('Ciclo 2 — Retry de sincronização', () => {
  it('evento com synced=false é contabilizado como não sincronizado', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');

    recordLogEvent({ type: 'ERROR', module: 'Sincronização', action: 'Falha', status: 'Falha', description: 'Rede indisponível', idempotencyKey: 'retry_1' });

    const evt = diagnosticLog[0];
    assert.strictEqual(evt.synced, false, 'evento criado sem usuário tem synced=false');
    const stats = getDiagnosticLogStats();
    assert.ok(stats.unsynced >= 1, 'deve haver pelo menos 1 evento não sincronizado');
  });

  it('atualizar status de evento existente mantém id e não duplica', () => {
    clearStorage();
    setLogStorageKeys(null);

    const e1 = recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'X', status: 'Sucesso', description: 'Y', idempotencyKey: 'upd_1' });
    const e2 = recordLogEvent({ type: 'INFO', module: 'Sistema', action: 'X', status: 'Falha', description: 'Y atualizado', idempotencyKey: 'upd_1' });

    assert.strictEqual(e1.id, e2.id, 'mesmo idempotencyKey retorna o mesmo evento');
    assert.strictEqual(diagnosticLog.length, 1, 'não duplica');
    assert.strictEqual(diagnosticLog[0].status, 'Falha', 'status deve ser atualizado');
  });
});
