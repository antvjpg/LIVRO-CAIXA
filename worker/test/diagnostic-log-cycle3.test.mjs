/* LIVRO-CAIXA · worker/test/diagnostic-log-cycle3.test.mjs
   Testes de regressão para a Fase 3 do LOG (integração de diagnósticos
   especializados):
   1. Sanitização OCR ponta a ponta — CPF, cartão, email, texto do documento
      nunca vazam nos detalhes; apenas campos da whitelist sobrevivem.
   2. Padronização de eventos de IA (recordAiEvent / recordWorkerEvent).
   3. Correlação entre etapas — mesmo correlationId, eventos distintos.
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordLogEvent, recordOCREvent, recordOCRFailure, recordLoginEvent,
  recordAiEvent, recordWorkerEvent, recordWorkerFailure,
  resetLogForNewUser, getDiagnosticLogStats, diagnosticLog,
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

let consoleInfoCalls = [];
let consoleErrorCalls = [];
let consoleWarnCalls = [];
const mockDocument = {
  getElementById() { return null; },
};
Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });
globalThis.console = {
  ...globalThis.console,
  error(...args) { consoleErrorCalls.push(args.map(String).join(' ')); },
  warn(...args) { consoleWarnCalls.push(args.map(String).join(' ')); },
  log(...args) { process.stdout.write(args.map(String).join(' ') + '\n'); },
  info(...args) { consoleInfoCalls.push(args.map(String).join(' ')); },
  debug() {},
};

function clearStorage() {
  storage.clear();
  consoleInfoCalls = [];
  consoleErrorCalls = [];
  consoleWarnCalls = [];
  diagnosticLog.splice(0, diagnosticLog.length);
}

/* ============================================================================
   FASE 3 — Sanitização OCR ponta a ponta
   ============================================================================ */

describe('Fase 3 — Sanitização OCR ponta a ponta', () => {
  it('OCR não grava CPF, cartão, email nem texto do documento nos detalhes', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    recordOCREvent('ocr.concluido', {
      stage: 'concluido',
      status: 'OK',
      code: '200',
      reason: 'sucesso',
      fileType: 'image/jpeg',
      fileSize: 123456,
      category: 'image',
      environment: 'WEB',
      platform: 'web',
      provider: 'ai-vision',
      durationMs: 450,
      attempts: 1,
      field: 'valor_total',
      attachmentId: 'attach-abc123',
      count: 1,
      /* Campos perigosos que NUNCA devem aparecer: */
      cpf: '123.456.789-00',
      cardNumber: '4532 1234 5678 9012',
      email: 'usuario@empresa.com.br',
      documentText: 'JOÃO SILVA — CPF 123.456.789-00 — Cartão 4532...',
      nomeArquivo: 'comprovante.pdf',
      payload: { valor: 1500.00, banco: 'Banco X' },
      token: 'abc123def456',
    });

    const evt = diagnosticLog.find(item => item.module === 'OCR');
    assert.ok(evt, 'deve haver evento de OCR');
    const detalhes = JSON.stringify(evt.details);

    /* Campos da whitelist devem sobreviver */
    assert.ok(detalhes.includes('stage'), 'deve manter stage');
    assert.ok(detalhes.includes('status'), 'deve manter status');
    assert.ok(detalhes.includes('provider'), 'deve manter provider');

    /* Campos perigosos NÃO devem aparecer */
    assert.ok(!detalhes.includes('123.456.789-00'), 'CPF não deve vazar');
    assert.ok(!detalhes.includes('4532'), 'número de cartão não deve vazar');
    assert.ok(!detalhes.includes('usuario@empresa.com.br'), 'email não deve vazar');
    assert.ok(!detalhes.includes('JOÃO SILVA'), 'texto do documento não deve vazar');
    assert.ok(!detalhes.includes('comprovante.pdf'), 'nome de arquivo não deve vazar');
    assert.ok(!detalhes.includes('Banco X'), 'dados bancários não devem vazar');
    assert.ok(!detalhes.includes('abc123def456'), 'token não deve vazar');
  });

  it('OCR falha não grava dados sensíveis nos detalhes de erro', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    recordOCRFailure('ocr.erro', {
      stage: 'extracao',
      status: 'ERROR',
      code: 'READER_ERROR',
      reason: 'falha de leitura',
      fileType: 'image/png',
      fileSize: 50000,
      category: 'image',
      environment: 'CAPACITOR',
      platform: 'android',
      provider: 'native-ocr',
      durationMs: 1200,
      attempts: 3,
      field: 'vencimento',
      attachmentId: 'attach-xyz789',
      count: 3,
      /* Sensíveis que devem ser removidos/mascarados: */
      cpf: '987.654.321-00',
      cardNumber: '5555 6666 7777 8888',
      email: 'cliente@banco.com.br',
    });

    const evt = diagnosticLog.find(item => item.module === 'OCR' && item.type === 'ERROR');
    assert.ok(evt, 'deve haver evento de erro de OCR');
    const detalhes = JSON.stringify(evt.details);

    assert.ok(!detalhes.includes('987.654.321-00'), 'CPF não deve vazar em erro');
    assert.ok(!detalhes.includes('5555'), 'cartão não deve vazar em erro');
    assert.ok(!detalhes.includes('cliente@banco.com.br'), 'email não deve vazar em erro');
    assert.ok(evt.status === 'Falha', 'status de falha deve ser Falha');
  });
});

/* ============================================================================
   FASE 3 — Padronização de eventos de IA e Worker
   ============================================================================ */

describe('Fase 3 — Padronização IA/Worker', () => {
  it('recordAiEvent padroniza módulo IA e sanitiza metadados', () => {
    clearStorage();
    resetLogForNewUser(null);

    recordAiEvent('calculo-juros', {
      operation: 'juros compostos',
      durationMs: 42,
      cpf: '111.222.333-44',
      email: 'usuario@ia.com.br',
      valor: 1000,
    });

    const evt = diagnosticLog.find(item => item.module === 'IA');
    assert.ok(evt, 'deve haver evento de IA');
    assert.strictEqual(evt.source, 'IA');
    assert.strictEqual(evt.action, 'calculo-juros');
    const detalhes = JSON.stringify(evt.details);
    assert.ok(!detalhes.includes('111.222.333-44'), 'CPF não deve vazar em IA');
    assert.ok(!detalhes.includes('usuario@ia.com.br'), 'email não deve vazar em IA');
    assert.ok(detalhes.includes('operation'), 'campo permitido deve sobreviver');
  });

  it('recordWorkerEvent padroniza módulo Worker e sanitiza metadados', () => {
    clearStorage();
    resetLogForNewUser(null);

    recordWorkerEvent('sync-diagnostico', {
      operation: 'sync-diagnostico',
      total: 5,
      token: 'secreto-abc123',
      credentials: { usuario: 'admin', senha: '123' },
    });

    const evt = diagnosticLog.find(item => item.module === 'Worker');
    assert.ok(evt, 'deve haver evento de Worker');
    assert.strictEqual(evt.source, 'Worker');
    assert.strictEqual(evt.action, 'sync-diagnostico');
    const detalhes = JSON.stringify(evt.details);
    assert.ok(!detalhes.includes('secreto-abc123'), 'token não deve vazar em Worker');
    assert.ok(!detalhes.includes('admin'), 'credenciais não devem vazar em Worker');
    assert.ok(detalhes.includes('operation'), 'campo permitido deve sobreviver');
  });

  it('recordWorkerFailure registra erro com módulo Worker', () => {
    clearStorage();
    resetLogForNewUser(null);

    recordWorkerFailure('push-falhou', {
      operation: 'push-falhou',
      erro: 'timeout',
      email: 'dev@empresa.com.br',
    });

    const evt = diagnosticLog.find(item => item.module === 'Worker' && item.type === 'ERROR');
    assert.ok(evt, 'deve haver evento de falha de Worker');
    assert.strictEqual(evt.status, 'Falha');
    const detalhes = JSON.stringify(evt.details);
    assert.ok(!detalhes.includes('dev@empresa.com.br'), 'email não deve vazar em falha');
  });
});

/* ============================================================================
   FASE 3 — Correlação entre etapas
   ============================================================================ */

describe('Fase 3 — Correlação entre etapas', () => {
  it('mesmo correlationId permite eventos distintos de uma mesma operação', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    const attachId = 'attach-123';

    /* Etapa 1: validação */
    recordOCREvent('ocr.validacao', {
      stage: 'validacao',
      status: 'OK',
      attachmentId: attachId,
    });

    /* Etapa 2: extração */
    recordOCREvent('ocr.concluido', {
      stage: 'concluido',
      status: 'OK',
      attachmentId: attachId,
      durationMs: 500,
    });

    /* Etapa 3: falha de revisão (mesmo attachmentId → mesmo correlationId, evento distinto) */
    recordOCRFailure('ocr.revisao', {
      stage: 'revisao',
      status: 'ERROR',
      attachmentId: attachId,
    });

    const ocrEvents = diagnosticLog.filter(item => item.module === 'OCR');
    assert.strictEqual(ocrEvents.length, 3, 'três eventos distintos com mesmo correlationId');
    assert.ok(ocrEvents.every(item => item.correlationId === attachId), 'todos compartilham o correlationId');

    /* Status devem ser preservados individualmente */
    const statuses = ocrEvents.map(item => item.status);
    assert.ok(statuses.includes('Sucesso'), 'etapa de sucesso registrada');
    assert.ok(statuses.includes('Falha'), 'etapa de falha registrada');
  });

  it('idempotencyKey diferente com mesmo correlationId não duplica incorretamente', () => {
    clearStorage();
    resetLogForNewUser(null);

    const e1 = recordLogEvent({
      type: 'INFO', module: 'IA', action: 'etapa-1', status: 'Sucesso',
      description: 'Etapa 1', correlationId: 'op_x',
      idempotencyKey: 'idem-1',
    });
    const e2 = recordLogEvent({
      type: 'INFO', module: 'IA', action: 'etapa-2', status: 'Sucesso',
      description: 'Etapa 2', correlationId: 'op_x',
      idempotencyKey: 'idem-2',
    });

    assert.notStrictEqual(e1.id, e2.id, 'idempotencyKeys diferentes geram eventos diferentes');
    assert.strictEqual(diagnosticLog.length, 2, 'não duplica incorretamente');
    assert.strictEqual(e1.correlationId, e2.correlationId, 'compartilham correlationId');
  });
});
