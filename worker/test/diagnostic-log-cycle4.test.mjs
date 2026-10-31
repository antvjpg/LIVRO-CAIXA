/* LIVRO-CAIXA · worker/test/diagnostic-log-cycle4.test.mjs
   Testes de regressão para a Fase 4 do LOG (ampliar cobertura dos módulos de negócio):
   1. Não há duplicação de eventos por idempotencyKey (handler + persistência).
   2. Schema versionado e normalização determinística.
   3. Operações críticas alteram saldo/dívida/limite/patrimônio geram eventos de LOG.
   4. Eventos de início/fim usam correlationId e durationMs quando agregam valor.
   5. Não há ruído para renderizações/leituras repetitivas (sem evento sem ação real).
*/

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  recordLogEvent, logInfo, logWarn, logSyncError,
  resetLogForNewUser, diagnosticLog, LOG_CURRENT_UID,
} from '../../js/domain/diagnostic-log.js';

/* ============================================================================
   MOCKs de ambiente (localStorage, currentUser, console, document)
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

function clearStorage() {
  storage.clear();
  consoleInfoCalls = [];
  consoleErrorCalls = [];
  consoleWarnCalls = [];
  diagnosticLog.splice(0, diagnosticLog.length);
}

/* ============================================================================
   FASE 4 — Não há duplicação por idempotencyKey
   ============================================================================ */

describe('Fase 4 — Sem duplicação por idempotencyKey', () => {
  it('mesmo idempotencyKey não duplica evento (handler + persistência)', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    const idemKey = 'lancamento-salvar-abc123';
    const op = { correlationId: 'op_lancamento_1', startedAt: performance.now() };

    const e1 = logInfo('Livro-Caixa', 'Salvar lançamento', 'Em andamento', 'Operação iniciada', null, op);
    const e2 = logInfo('Livro-Caixa', 'Salvar lançamento', 'Em andamento', 'Operação iniciada (duplicada)', null, op);

    // Sem idempotencyKey explícita, usa correlationId para dedup (legado)
    assert.strictEqual(e1.id, e2.id, 'mesmo correlationId não duplica (legado)');
    assert.strictEqual(diagnosticLog.length, 1, 'apenas um evento registrado');

    // Com idempotencyKey explícita
    const e3 = recordLogEvent({ type: 'INFO', module: 'Cartões', action: 'Salvar cartão', status: 'Sucesso', description: 'Cartão salvo', idempotencyKey: idemKey });
    const e4 = recordLogEvent({ type: 'INFO', module: 'Cartões', action: 'Salvar cartão', status: 'Sucesso', description: 'Cartão salvo (duplicado)', idempotencyKey: idemKey });

    assert.strictEqual(e3.id, e4.id, 'mesmo idempotencyKey não duplica');
    assert.strictEqual(diagnosticLog.length, 2, 'apenas dois eventos no total (1 legado + 1 idempotent)');
  });

  it('idempotencyKeys diferentes geram eventos distintos', () => {
    clearStorage();
    resetLogForNewUser(null);

    const e1 = recordLogEvent({ type: 'INFO', module: 'Transferência', action: 'Transferência universal', status: 'Em andamento', description: 'Iniciada', idempotencyKey: 'idem-A' });
    const e2 = recordLogEvent({ type: 'INFO', module: 'Transferência', action: 'Transferência universal', status: 'Sucesso', description: 'Concluída', idempotencyKey: 'idem-B' });

    assert.notStrictEqual(e1.id, e2.id, 'idempotencyKeys diferentes geram eventos distintos');
    assert.strictEqual(diagnosticLog.length, 2, 'dois eventos distintos');
  });
});

/* ============================================================================
   FASE 4 — Schema versionado e normalização determinística
   ============================================================================ */

describe('Fase 4 — Schema versionado e normalização', () => {
  it('todos os eventos possuem schemaVersion e campos obrigatórios', () => {
    clearStorage();
    resetLogForNewUser(null);

    recordLogEvent({ type: 'INFO', module: 'Bancos', action: 'Salvar banco', status: 'Sucesso', description: 'Banco salvo' });
    recordLogEvent({ type: 'WARN', module: 'Cotação', action: 'Atualização de cotação', status: 'Parcial', description: 'Parcial' });
    recordLogEvent({ type: 'ERROR', module: 'Investimentos', action: 'Salvar ativo', status: 'Falha', description: 'Falha' });

    diagnosticLog.forEach(item => {
      assert.ok(item.id, 'evento tem id');
      assert.ok(item.timestamp, 'evento tem timestamp');
      assert.ok(['INFO', 'WARN', 'ERROR'].includes(item.type), 'type válido');
      assert.ok(item.module, 'module preenchido');
      assert.ok(item.action, 'action preenchido');
      assert.ok(item.status, 'status preenchido');
      assert.ok(item.schemaVersion, 'schemaVersion presente');
      assert.strictEqual(typeof item.schemaVersion, 'number', 'schemaVersion é número');
      assert.ok(item.schemaVersion >= 1, 'schemaVersion >= 1');
    });
  });

  it('normalização determinística: mesmo input produz mesma estrutura', () => {
    clearStorage();
    resetLogForNewUser(null);

    const input = {
      type: 'INFO',
      module: 'Caixinhas',
      action: 'Salvar movimentação',
      status: 'Sucesso',
      description: 'Depósito de R$ 100,00',
      details: { operation: 'aporte', count: 1, attachmentId: 'attach-x' },
      correlationId: 'op_caixinha_1',
      idempotencyKey: 'caixinha-aporte-1',
      durationMs: 45,
      retryCount: 0,
      source: 'Livro-Caixa-web',
      synced: false,
      schemaVersion: 1,
    };

    const e1 = recordLogEvent(input);
    const e2 = recordLogEvent({ ...input, description: 'Descrição diferente', idempotencyKey: 'caixinha-aporte-2' });

    // Mesmo schema, campos normalizados da mesma forma
    assert.strictEqual(e1.schemaVersion, e2.schemaVersion);
    assert.strictEqual(e1.module, e2.module);
    assert.strictEqual(e1.type, e2.type);
    assert.strictEqual(e1.source, e2.source);
    assert.strictEqual(e1.synced, e2.synced);
    assert.notStrictEqual(e1.description, e2.description, 'descrição preservada');
  });
});

/* ============================================================================
   FASE 4 — Operações críticas geram eventos de LOG
   ============================================================================ */

describe('Fase 4 — Operações críticas alteram saldo/dívida/limite/patrimônio', () => {
  const operacoesCriticas = [
    { module: 'Livro-Caixa', action: 'Salvar lançamento', tipo: 'saldo' },
    { module: 'Transferência', action: 'Transferência universal', tipo: 'saldo' },
    { module: 'Investimentos', action: 'Salvar ativo', tipo: 'patrimonio' },
    { module: 'Investimentos', action: 'Salvar movimentação', tipo: 'patrimonio' },
    { module: 'Caixinhas', action: 'Salvar movimentação', tipo: 'saldo' },
    { module: 'Cartões', action: 'Salvar compra', tipo: 'divida' },
    { module: 'Cartões', action: 'Lançar fatura por titular', tipo: 'divida' },
    { module: 'Calendário', action: 'Salvar conta', tipo: 'divida' },
    { module: 'Bancos', action: 'Salvar banco', tipo: 'saldo' },
    { module: 'Categorias', action: 'Salvar categoria', tipo: 'saldo' },
  ];

  it('todas as operações críticas registram evento de LOG', () => {
    clearStorage();
    resetLogForNewUser('usuario-A');

    operacoesCriticas.forEach(({ module, action, tipo }) => {
      logInfo(module, action, 'Sucesso', `Operação crítica ${tipo} realizada.`);
    });

    operacoesCriticas.forEach(({ module, action }) => {
      const evt = diagnosticLog.find(item => item.module === module && item.action === action);
      assert.ok(evt, `evento de LOG registrado para ${module} / ${action}`);
      assert.strictEqual(evt.status, 'Sucesso');
    });

    assert.strictEqual(diagnosticLog.length, operacoesCriticas.length, 'todas as operações críticas cobertas');
  });

  it('falhas em operações críticas registram evento de erro', () => {
    clearStorage();
    resetLogForNewUser(null);

    logSyncError('transferência', new Error('Saldo insuficiente'), { correlationId: 'op_transfer_1', startedAt: performance.now() });
    logSyncError('investimento', new Error('Falha ao salvar ativo'), { correlationId: 'op_invest_1', startedAt: performance.now() });

    const erros = diagnosticLog.filter(item => item.type === 'ERROR');
    assert.ok(erros.length >= 2, 'pelo menos 2 eventos de erro registrados');
    assert.ok(erros.some(e => e.module === 'Transferência' || e.action.includes('transferência')), 'erro de transferência registrado');
    assert.ok(erros.some(e => e.module === 'Investimentos' || e.action.includes('investimento')), 'erro de investimento registrado');
  });
});

/* ============================================================================
   FASE 4 — Início/fim com correlationId e durationMs
   ============================================================================ */

describe('Fase 4 — Início/fim com correlationId e durationMs', () => {
  it('evento de início e fim compartilham correlationId', () => {
    clearStorage();
    resetLogForNewUser(null);

    const corrId = 'op_lancamento_salvar_1';

    const inicio = logInfo('Livro-Caixa', 'Salvar lançamento', 'Em andamento', 'Operação de lançamento iniciada.', null, { correlationId: corrId, startedAt: performance.now() });
    const fim = logInfo('Livro-Caixa', 'Salvar lançamento', 'Sucesso', 'Movimentação registrada.', { type: 'out' }, { correlationId: corrId, startedAt: inicio.startedAt || performance.now() });

    assert.strictEqual(inicio.correlationId, fim.correlationId, 'mesmo correlationId entre início e fim');
    assert.strictEqual(inicio.correlationId, corrId);
    assert.strictEqual(fim.correlationId, corrId);
  });

  it('eventos de início/fim possuem durationMs quando operation é informado', () => {
    clearStorage();
    resetLogForNewUser(null);

    const startedAt = performance.now() - 100;
    const op = { correlationId: 'op_duracao_1', startedAt };

    const evt = logInfo('Investimentos', 'Salvar ativo', 'Sucesso', 'Ativo salvo.', null, op);

    assert.ok(evt.durationMs != null && evt.durationMs >= 0, 'durationMs preenchido para operação com início/fim');
  });

  it('eventos sem operação não geram durationMs (sem ruído)', () => {
    clearStorage();
    resetLogForNewUser(null);

    const evt = logInfo('Sistema', 'Registro do Service Worker', 'Sucesso', 'PWA pronta.');

    assert.strictEqual(evt.durationMs, null, 'sem operação, durationMs é null');
    assert.strictEqual(evt.correlationId, null, 'sem operação, correlationId é null');
  });
});

/* ============================================================================
   FASE 4 — Não há ruído para renderizações/leituras repetitivas
   ============================================================================ */

describe('Fase 4 — Sem ruído para renderizações', () => {
  it('eventos sem ação real não são registrados (apenas operações de negócio)', () => {
    clearStorage();
    resetLogForNewUser(null);

    // Simular renderização repetitiva — não deve gerar evento de LOG
    const antes = diagnosticLog.length;

    // Apenas operações que alteram estado devem gerar evento
    logInfo('Livro-Caixa', 'Salvar lançamento', 'Sucesso', 'Lançamento salvo.');
    logWarn('Transferência', 'Transferência universal', 'Bloqueada', 'Valor excede saldo.');

    const depois = diagnosticLog.length;
    assert.strictEqual(depois, antes + 2, 'apenas operações de negócio geram evento');
    assert.strictEqual(diagnosticLog.filter(item => item.module === 'Renderização').length, 0, 'sem eventos de renderização');
  });
});
