/* LIVRO-CAIXA · worker/test/diagnostic-log-cycle1.test.mjs
   Testes de regressão para o Ciclo 1 do LOG (riscos críticos da auditoria):
   1. Isolamento por UID — resetLogForNewUser particiona o LOG por usuário
   2. Sanitização integral — description/action/erros mascaram dados sensíveis
   3. Correlação vs idempotência — idempotencyKey distinto de correlationId
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
} from '../../js/domain/diagnostic-log.js';

/* ============================================================================
   MOCKs de ambiente (localStorage, currentUser, console)
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

Object.defineProperty(globalThis, 'document', {
  value: {
    getElementById() { return null; },
  },
  writable: true,
  configurable: true,
});

let consoleErrorCalls = [];
let consoleWarnCalls = [];
globalThis.console = {
  ...globalThis.console,
  error(...args) { consoleErrorCalls.push(args.map(String).join(' ')); },
  warn(...args) { consoleWarnCalls.push(args.map(String).join(' ')); },
  log(...args) { process.stdout.write(args.map(String).join(' ') + '\n'); },
  info() {}, debug() {},
};

/* ============================================================================
   HELPERS
   ============================================================================ */

function clearStorage() {
  storage.clear();
  consoleErrorCalls = [];
  consoleWarnCalls = [];
  diagnosticLog.splice(0, diagnosticLog.length);
}

/* ============================================================================
   RISCO 1 — Isolamento por UID
   ============================================================================ */

describe('Ciclo 1 — Isolamento por UID', () => {
  it('deve definir chaves de storage diferentes por UID', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');
    assert.strictEqual(LOG_STORAGE_KEY, 'livrocaixa_diagnostic_log_usuario-A');
    assert.strictEqual(LOG_SEQUENCE_STORAGE_KEY, 'livrocaixa_diagnostic_sequence_usuario-A');
    assert.strictEqual(LOG_CURRENT_UID, 'usuario-A');

    setLogStorageKeys('usuario-B');
    assert.strictEqual(LOG_STORAGE_KEY, 'livrocaixa_diagnostic_log_usuario-B');
    assert.strictEqual(LOG_SEQUENCE_STORAGE_KEY, 'livrocaixa_diagnostic_sequence_usuario-B');
    assert.strictEqual(LOG_CURRENT_UID, 'usuario-B');

    setLogStorageKeys(null);
    assert.strictEqual(LOG_STORAGE_KEY, 'livrocaixa_diagnostic_log');
    assert.strictEqual(LOG_CURRENT_UID, null);
  });

  it('deve limpar o LOG ao trocar de usuário', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');
    diagnosticLog.push({ id: 'evt-A', type: 'INFO', module: 'Sistema', action: 'A', status: 'Sucesso', description: 'evt A' });
    assert.strictEqual(diagnosticLog.length, 1);

    resetLogForNewUser('usuario-B');
    assert.strictEqual(diagnosticLog.length, 0);
    assert.strictEqual(LOG_STORAGE_KEY, 'livrocaixa_diagnostic_log_usuario-B');
    assert.strictEqual(LOG_CURRENT_UID, 'usuario-B');

    /* Não deve manter eventos do usuário A na chave do B */
    assert.strictEqual(storage.get(LOG_STORAGE_KEY), undefined);
  });

  it('deve limpar o LOG no logout (UID nulo)', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');
    diagnosticLog.push({ id: 'evt-A', type: 'INFO', module: 'Sistema', action: 'A', status: 'Sucesso', description: 'evt A' });

    resetLogForNewUser(null);
    assert.strictEqual(diagnosticLog.length, 0);
    assert.strictEqual(LOG_STORAGE_KEY, 'livrocaixa_diagnostic_log');
    assert.strictEqual(LOG_CURRENT_UID, null);
  });

  it('deve resetar a sequência ao trocar de usuário', () => {
    clearStorage();
    setLogStorageKeys('usuario-A');
    const seqA = nextLogSequence();
    assert.ok(seqA >= 1, 'sequência do usuário A deve ser >= 1');

    resetLogForNewUser('usuario-B');
    const seqB = nextLogSequence();
    assert.strictEqual(seqB, 1, 'sequência do usuário B deve reiniciar em 1');
  });
});

/* ============================================================================
   RISCO 2 — Sanitização integral
   ============================================================================ */

describe('Ciclo 1 — Sanitização integral', () => {
  it('deve mascarar email em description', () => {
    clearStorage();
    const s = sanitizeLogText('Contato: joao.silva@empresa.com.br para confirmação');
    assert.ok(!s.includes('joao.silva@empresa.com.br'), 'email deve ser mascarado');
    assert.ok(s.includes('[EMAIL_REDACTED]'), 'deve conter placeholder de email');
  });

  it('deve mascarar CPF em description', () => {
    clearStorage();
    const s = sanitizeLogText('CPF do titular: 123.456.789-01');
    assert.ok(!s.includes('123.456.789-01'), 'CPF deve ser mascarado');
    assert.ok(s.includes('[CPF_REDACTED]'), 'deve conter placeholder de CPF');
  });

  it('deve mascarar CNPJ em description', () => {
    clearStorage();
    const s = sanitizeLogText('CNPJ: 11.222.333/0001-44');
    assert.ok(!s.includes('11.222.333/0001-44'), 'CNPJ deve ser mascarado');
    assert.ok(s.includes('[CNPJ_REDACTED]'), 'deve conter placeholder de CNPJ');
  });

  it('deve mascarar número de cartão em description', () => {
    clearStorage();
    const s = sanitizeLogText('Cartão 4532 0123 4567 8901 usado');
    assert.ok(!s.includes('4532 0123 4567 8901'), 'cartão deve ser mascarado');
    assert.ok(s.includes('[CARD_REDACTED]'), 'deve conter placeholder de cartão');
  });

  it('deve mascarar token longo em description', () => {
    clearStorage();
    const token = 'a'.repeat(40);
    const s = sanitizeLogText(`Token de acesso: ${token}`);
    assert.ok(!s.includes(token), 'token deve ser mascarado');
    assert.ok(s.includes('[TOKEN_REDACTED]'), 'deve conter placeholder de token');
  });

  it('deve mascarar dados sensíveis em action', () => {
    clearStorage();
    const evt = normalizeLogEventTest({
      module: 'Pagamento',
      action: 'Pagar com cartão 4532012345678901',
      status: 'Sucesso',
      description: 'Pagamento aprovado',
    });
    assert.ok(!evt.action.includes('4532012345678901'), 'action não deve expor cartão');
    assert.ok(evt.action.includes('[CARD_REDACTED]'), 'action deve mascarar cartão');
  });

  it('deve mascarar dados sensíveis em mensagem de erro', () => {
    clearStorage();
    const err = new Error('Falha ao autenticar usuário joao.silva@empresa.com.br');
    logSyncError('autenticação', err);
    assert.ok(consoleErrorCalls.length > 0, 'deve logar erro no console');
    const msg = consoleErrorCalls.join(' ');
    assert.ok(!msg.includes('joao.silva@empresa.com.br'), 'erro não deve expor email');
    assert.ok(msg.includes('[EMAIL_REDACTED]'), 'erro deve mascarar email');
  });
});

/* ============================================================================
   RISCO 3 — Correlação vs idempotência
   ============================================================================ */

describe('Ciclo 1 — Correlação vs idempotência', () => {
  it('deve criar eventos distintos com mesmo correlationId mas idempotencyKey diferente', () => {
    clearStorage();

    const correlationId = 'op_123_mesma_operacao';

    /* Primeira etapa */
    const e1 = recordLogEvent({
      type: 'INFO', module: 'OCR', action: 'Extração iniciada',
      status: 'Sucesso', description: 'Iniciando extração',
      correlationId, idempotencyKey: 'ocr_attach_1_etapa_1',
    });

    /* Segunda etapa com mesmo correlationId mas idempotencyKey diferente */
    const e2 = recordLogEvent({
      type: 'INFO', module: 'OCR', action: 'Extração concluída',
      status: 'Sucesso', description: 'Extração finalizada',
      correlationId, idempotencyKey: 'ocr_attach_1_etapa_2',
    });

    assert.notStrictEqual(e1.id, e2.id, 'devem ter IDs diferentes');
    assert.strictEqual(e1.correlationId, e2.correlationId, 'devem compartilhar correlationId');
    assert.notStrictEqual(e1.idempotencyKey, e2.idempotencyKey, 'devem ter idempotencyKey diferente');
    assert.strictEqual(diagnosticLog.length, 2, 'devem ser 2 eventos distintos');
  });

  it('não deve duplicar evento com mesmo idempotencyKey', () => {
    clearStorage();

    const idempotencyKey = 'ocr_attach_1_etapa_1';
    const correlationId = 'op_123';

    const e1 = recordLogEvent({
      type: 'INFO', module: 'OCR', action: 'Extração',
      status: 'Sucesso', description: 'Início',
      correlationId, idempotencyKey,
    });

    /* Segunda etapa com mesmo correlationId mas idempotencyKey diferente */
    const e2 = recordLogEvent({
      type: 'INFO', module: 'OCR', action: 'Extração',
      status: 'Sucesso', description: 'Repetido',
      correlationId, idempotencyKey,
    });

    assert.strictEqual(e1.id, e2.id, 'mesmo idempotencyKey deve retornar o mesmo evento');
    assert.strictEqual(diagnosticLog.length, 1, 'deve manter apenas 1 evento');
  });

  it('compatibilidade: sem idempotencyKey, usa correlationId para deduplicação (legado)', () => {
    clearStorage();

    const correlationId = 'op_legado_1';

    const e1 = recordLogEvent({
      type: 'INFO', module: 'Sistema', action: 'Legado',
      status: 'Sucesso', description: 'Primeiro',
      correlationId,
    });

    const e2 = recordLogEvent({
      type: 'INFO', module: 'Sistema', action: 'Legado',
      status: 'Sucesso', description: 'Segundo',
      correlationId,
    });

    assert.strictEqual(e1.id, e2.id, 'sem idempotencyKey, mesmo correlationId deve deduplicar');
    assert.strictEqual(diagnosticLog.length, 1, 'deve manter apenas 1 evento');
  });

  it('adaptador OCR deve gerar idempotencyKey único por etapa com mesmo attachmentId', () => {
    clearStorage();

    const meta = { attachmentId: 'attach_abc', stage: 'upload', status: 'ok' };

    const r1 = recordOCREvent('Iniciado', meta);
    const r2 = recordOCREvent('Concluído', meta);

    assert.strictEqual(r1.correlationId, 'attach_abc', 'correlationId deve ser attachmentId');
    assert.strictEqual(r2.correlationId, 'attach_abc', 'correlationId deve ser attachmentId');
    assert.notStrictEqual(r1.idempotencyKey, r2.idempotencyKey, 'idempotencyKey deve diferir entre etapas');
    assert.strictEqual(diagnosticLog.length, 2, 'devem ser 2 eventos OCR distintos');
  });
});

/* Helper: simula normalizeLogEvent para testar sanitização de action/description */
function normalizeLogEventTest(raw) {
  const item = raw && typeof raw === 'object' ? raw : {};
  return {
    id: String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    timestamp: item.timestamp || new Date().toISOString(),
    type: ['INFO', 'WARN', 'ERROR'].includes(item.type) ? item.type : 'INFO',
    module: String(item.module || 'Sistema').slice(0, 120),
    action: sanitizeLogText(item.action || 'Operação'),
    status: String(item.status || 'Sucesso').slice(0, 80),
    description: sanitizeLogText(item.description || ''),
    details: sanitizeLogValue(item.details),
    correlationId: item.correlationId ? String(item.correlationId).slice(0, 120) : null,
    source: String(item.source || 'Livro-Caixa-web').slice(0, 80),
    synced: item.synced === true ? true : item.synced === false ? false : null,
    schemaVersion: Number(item.schemaVersion) || 1
  };
}
