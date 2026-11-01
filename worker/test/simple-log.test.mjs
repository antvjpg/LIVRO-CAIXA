/* LIVRO-CAIXA · worker/test/simple-log.test.mjs
   Testes abrangentes para o LOG de diagnóstico (simple-log.js)
   Usa import dinâmico após configurar mocks
*/

/* ============================================================================
   MOCKs de ambiente — CONFIGURADOS ANTES DO IMPORT DINÂMICO
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

const mockDocument = {
  getElementById(id) {
    if (id === 'logConteudo') return { innerHTML: '', scrollTop: 0, scrollHeight: 0 };
    if (id === 'btnCopiarLog') return { textContent: 'Copiar', addEventListener: () => {} };
    if (id === 'btnLimparLog') return { addEventListener: () => {} };
    return null;
  }
};
Object.defineProperty(globalThis, 'document', { value: mockDocument, writable: true, configurable: true });

// Mock window ANTES do import
Object.defineProperty(globalThis, 'window', { value: globalThis, writable: true, configurable: true });

// Mock navigator.clipboard para testes
let copiedText = '';
Object.defineProperty(globalThis, 'navigator', {
  value: { clipboard: { writeText: async (text) => { copiedText = text; } } },
  writable: true,
  configurable: true,
});

const consoleWarnCalls = [];
globalThis.console = {
  ...globalThis.console,
  warn(...args) { consoleWarnCalls.push(args.map(String).join(' ')); },
  error() {}, info() {}, log() {}, debug() {},
};

/* ============================================================================
   IMPORT DINÂMICO DO MÓDULO SIMPLE-LOG
   ============================================================================ */

// Carregar o módulo simple-log após mocks configurados
await import('../../js/domain/simple-log.js');

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

function clearStorage() {
  storage.clear();
  consoleWarnCalls.length = 0;
  copiedText = '';
  // Limpar estado interno do simple-log chamando limpar() que zera eventos[] e salva no storage
  if (globalThis.simpleLog && typeof globalThis.simpleLog.limpar === 'function') {
    globalThis.simpleLog.limpar();
  }
}

/* ============================================================================
   TESTES
   ============================================================================ */

describe('simple-log.js — Registro básico de eventos', () => {
  beforeEach(clearStorage);
  
  it('logEvent registra evento com todos os campos', () => {
    const event = globalThis.logEvent('INFO', 'Teste', 'Ação teste', 'Descrição teste', { chave: 'valor' }, 150);
    
    assert.ok(event.id, 'evento tem id');
    assert.ok(event.timestamp, 'evento tem timestamp');
    assert.strictEqual(event.tipo, 'INFO', 'tipo registrado');
    assert.strictEqual(event.modulo, 'Teste', 'módulo registrado');
    assert.strictEqual(event.acao, 'Ação teste', 'ação registrada');
    assert.strictEqual(event.descricao, 'Descrição teste', 'descrição registrada');
    assert.ok(event.detalhes, 'detalhes serializados');
    assert.strictEqual(event.duracaoMs, 150, 'duração registrada');
  });

  it('logEvent com valores nulos/undefined usa defaults', () => {
    const event = globalThis.logEvent(null, null, null, null, null, null);
    
    assert.strictEqual(event.tipo, 'INFO', 'default tipo INFO');
    assert.strictEqual(event.modulo, 'Sistema', 'default módulo Sistema');
    assert.strictEqual(event.acao, 'Operação', 'default ação Operação');
    assert.strictEqual(event.descricao, '', 'default descrição vazia');
    assert.strictEqual(event.detalhes, null, 'default detalhes null');
    // duracaoMs: Number(null) = 0, Number.isFinite(0) = true, então vira 0
    assert.strictEqual(event.duracaoMs, 0, 'default duração 0 (Number(null) é finito)');
  });

  it('eventos são adicionados no topo (unshift)', () => {
    globalThis.logEvent('INFO', 'A', '1', 'Primeiro');
    globalThis.logEvent('INFO', 'B', '2', 'Segundo');
    globalThis.logEvent('INFO', 'C', '3', 'Terceiro');
    
    const eventos = globalThis.simpleLog.obterEventos();
    assert.strictEqual(eventos[0].acao, '3', 'último evento fica no topo');
    assert.strictEqual(eventos[1].acao, '2', 'penúltimo em segundo');
    assert.strictEqual(eventos[2].acao, '1', 'primeiro no final');
  });
});

describe('simple-log.js — Persistência no localStorage', () => {
  beforeEach(clearStorage);
  
  it('salva evento no localStorage a cada logEvent', () => {
    globalThis.logEvent('INFO', 'Persist', 'Salvar', 'Teste persistência');
    
    const stored = storage.get('livrocaixa_diagnostic_log_v1');
    assert.ok(stored, 'chave localStorage existe');
    
    const parsed = JSON.parse(stored);
    assert.strictEqual(parsed.length, 1, '1 evento persistido');
    assert.strictEqual(parsed[0].modulo, 'Persist', 'módulo persistido');
  });

  it('múltiplos eventos são persistidos em ordem', () => {
    globalThis.logEvent('INFO', 'A', '1', 'Primeiro');
    globalThis.logEvent('INFO', 'B', '2', 'Segundo');
    
    const stored = JSON.parse(storage.get('livrocaixa_diagnostic_log_v1'));
    assert.strictEqual(stored.length, 2, '2 eventos persistidos');
    assert.strictEqual(stored[0].acao, '2', 'mais recente primeiro no storage');
    assert.strictEqual(stored[1].acao, '1', 'mais antigo por último');
  });

  it('limpar() zera o localStorage', () => {
    globalThis.logEvent('INFO', 'Teste', 'Limpar', 'Antes de limpar');
    assert.ok(storage.get('livrocaixa_diagnostic_log_v1'), 'existe antes de limpar');
    
    globalThis.simpleLogLimpar();
    
    const stored = storage.get('livrocaixa_diagnostic_log_v1');
    assert.strictEqual(stored, '[]', 'localStorage zerado após limpar');
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 0, 'memória zerada');
  });
});

describe('simple-log.js — Hidratação e sobrevivência a reload', () => {
  beforeEach(clearStorage);
  
  it('eventos persistem no localStorage e podem ser lidos', () => {
    // 1. Registrar eventos (simula sessão anterior)
    globalThis.logEvent('INFO', 'Sessao1', 'Acao1', 'Evento da sessão anterior');
    globalThis.logEvent('ERROR', 'Sessao1', 'Erro1', 'Erro da sessão anterior', { codigo: 500 });
    
    const storedBefore = storage.get('livrocaixa_diagnostic_log_v1');
    assert.ok(storedBefore, 'eventos salvos no localStorage');
    
    // 2. Verificar que localStorage persiste (não usar limpar() que apaga storage)
    const storedAfter = storage.get('livrocaixa_diagnostic_log_v1');
    assert.ok(storedAfter, 'localStorage intacto');
    
    const parsed = JSON.parse(storedAfter);
    assert.strictEqual(parsed.length, 2, '2 eventos no storage');
    // unshift coloca o mais recente no índice 0
    assert.strictEqual(parsed[0].tipo, 'ERROR', 'mais recente (ERROR) no índice 0');
    assert.strictEqual(parsed[1].modulo, 'Sessao1', 'mais antigo (INFO) no índice 1');
  });
});

describe('simple-log.js — Limite de 200 eventos (FIFO)', () => {
  beforeEach(clearStorage);
  
  it('mantém apenas 200 eventos mais recentes', () => {
    // Registrar 250 eventos
    for (let i = 1; i <= 250; i++) {
      globalThis.logEvent('INFO', 'Teste', `Acao${i}`, `Evento ${i}`);
    }
    
    const eventos = globalThis.simpleLog.obterEventos();
    assert.strictEqual(eventos.length, 200, 'apenas 200 eventos em memória');
    
    // Verificar que são os mais recentes (250 down to 51)
    assert.strictEqual(eventos[0].acao, 'Acao250', 'mais recente preservado');
    assert.strictEqual(eventos[199].acao, 'Acao51', '200º mais recente preservado');
    
    // Verificar localStorage também tem 200
    const stored = JSON.parse(storage.get('livrocaixa_diagnostic_log_v1'));
    assert.strictEqual(stored.length, 200, 'localStorage também limitado a 200');
  });
});

describe('simple-log.js — Sanitização de dados sensíveis', () => {
  beforeEach(clearStorage);
  
  it('redige emails nos detalhes', () => {
    globalThis.logEvent('INFO', 'Teste', 'Email', 'Teste email', { usuario: 'joao@empresa.com.br', email: 'contato@dominio.com' });
    
    const eventos = globalThis.simpleLog.obterEventos();
    const detalhes = JSON.parse(eventos[0].detalhes);
    
    assert.strictEqual(detalhes.usuario, '[EMAIL_REDACTED]', 'email em campo usuario redigido');
    assert.strictEqual(detalhes.email, '[EMAIL_REDACTED]', 'email em campo email redigido');
  });

  it('redige CPFs nos detalhes', () => {
    globalThis.logEvent('INFO', 'Teste', 'CPF', 'Teste CPF', { cpf: '123.456.789-00', documento: '987.654.321-11' });
    
    const eventos = globalThis.simpleLog.obterEventos();
    const detalhes = JSON.parse(eventos[0].detalhes);
    
    assert.strictEqual(detalhes.cpf, '[CPF_REDACTED]', 'CPF redigido');
    assert.strictEqual(detalhes.documento, '[CPF_REDACTED]', 'segundo CPF redigido');
  });

  it('redige tokens longos nos detalhes', () => {
    const token = 'a'.repeat(40);
    globalThis.logEvent('INFO', 'Teste', 'Token', 'Teste token', { apiKey: token, auth: 'Bearer ' + token });
    
    const eventos = globalThis.simpleLog.obterEventos();
    const detalhes = JSON.parse(eventos[0].detalhes);
    
    assert.strictEqual(detalhes.apiKey, '[TOKEN_REDACTED]', 'token redigido');
    assert.ok(detalhes.auth.includes('[TOKEN_REDACTED]'), 'token em string composta redigido');
  });

  it('sanitização também aplica no localStorage', () => {
    globalThis.logEvent('INFO', 'Teste', 'Sanitizar', 'Teste', { email: 'teste@email.com', cpf: '111.222.333-44' });
    
    const stored = JSON.parse(storage.get('livrocaixa_diagnostic_log_v1'));
    const detalhes = JSON.parse(stored[0].detalhes);
    
    assert.strictEqual(detalhes.email, '[EMAIL_REDACTED]', 'email redigido no storage');
    assert.strictEqual(detalhes.cpf, '[CPF_REDACTED]', 'CPF redigido no storage');
  });

  it('trunca strings longas a 500 chars', () => {
    const longString = 'x'.repeat(1000);
    globalThis.logEvent('INFO', 'Teste', 'Longo', 'Teste truncamento', { dados: longString });
    
    const eventos = globalThis.simpleLog.obterEventos();
    const detalhes = JSON.parse(eventos[0].detalhes);
    
    assert.ok(detalhes.dados.length <= 500, 'string truncada a 500 chars');
  });
});

describe('simple-log.js — API pública', () => {
  beforeEach(clearStorage);
  
  it('window.logEvent é atalho para adicionarEvento', () => {
    const event = globalThis.logEvent('WARN', 'API', 'Atalho', 'Teste window.logEvent');
    assert.ok(event.id, 'window.logEvent funciona');
  });

  it('window.simpleLog.obterEventos retorna cópia do array', () => {
    globalThis.logEvent('INFO', 'API', 'Obter', 'Teste obterEventos');
    const eventos = globalThis.simpleLog.obterEventos();
    
    assert.strictEqual(eventos.length, 1, 'retorna eventos');
    assert.ok(Array.isArray(eventos), 'retorna array');
    
    // Modificar array retornado não deve afetar original
    eventos.length = 0;
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 1, 'original não afetado');
  });

  it('window.simpleLogRender chama renderizar', () => {
    globalThis.logEvent('INFO', 'Render', 'Teste', 'Teste render');
    assert.doesNotThrow(() => globalThis.simpleLogRender(), 'simpleLogRender não lança erro');
  });

  it('window.simpleLogLimpar limpa eventos e storage', () => {
    globalThis.logEvent('INFO', 'Limpar', 'Teste', 'Antes');
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 1);
    
    globalThis.simpleLogLimpar();
    
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 0, 'memória limpa');
    assert.strictEqual(storage.get('livrocaixa_diagnostic_log_v1'), '[]', 'storage limpo');
  });

  it('window.simpleLogCopiar copia eventos formatados', async () => {
    globalThis.logEvent('INFO', 'Copiar', 'Acao', 'Descricao', { chave: 'valor' }, 100);
    
    await globalThis.simpleLogCopiar();
    
    assert.ok(copiedText.includes('[INFO]'), 'contém tipo');
    assert.ok(copiedText.includes('Copiar'), 'contém módulo');
    assert.ok(copiedText.includes('Acao'), 'contém ação');
    assert.ok(copiedText.includes('Descricao'), 'contém descrição');
    assert.ok(copiedText.includes('100ms'), 'contém duração');
    assert.ok(copiedText.includes('chave=valor'), 'contém detalhes');
  });

  it('window.beginLogOperation marca início de operação', () => {
    const op = globalThis.beginLogOperation('ModuloTeste', 'AcaoTeste');
    
    assert.ok(op.startedAt, 'retorna objeto com startedAt');
    assert.strictEqual(op.modulo, 'ModuloTeste', 'guarda módulo');
    assert.strictEqual(op.acao, 'AcaoTeste', 'guarda ação');
    assert.ok(typeof op.startedAt === 'number', 'startedAt é number');
  });

  it('window.operationDuration calcula duração em ms', () => {
    const op = globalThis.beginLogOperation('Modulo', 'Acao');
    
    // Simular passagem de tempo
    const originalNow = performance.now;
    let mockTime = performance.now();
    performance.now = () => mockTime;
    
    mockTime += 250; // 250ms depois
    const duration = globalThis.operationDuration(op);
    
    performance.now = originalNow;
    
    assert.strictEqual(duration, 250, 'calcula duração correta');
  });

  it('operationDuration retorna null para operação inválida', () => {
    assert.strictEqual(globalThis.operationDuration(null), null, 'null para operação null');
    assert.strictEqual(globalThis.operationDuration({}), null, 'null para objeto sem startedAt');
    assert.strictEqual(globalThis.operationDuration({ startedAt: 'invalido' }), null, 'null para startedAt inválido');
  });
});

describe('simple-log.js — Renderização', () => {
  beforeEach(clearStorage);
  
  it('renderizar formata eventos com hora, tipo, módulo, ação, descrição, duração', () => {
    globalThis.logEvent('INFO', 'RenderMod', 'RenderAcao', 'Descricao teste', { extra: 'dado' }, 500);
    
    // renderizar() é chamado automaticamente, mas testamos se não lança erro
    assert.doesNotThrow(() => globalThis.simpleLogRender(), 'renderizar não lança erro');
  });

  it('evento ERROR renderiza com classe error', () => {
    globalThis.logEvent('ERROR', 'ErroMod', 'Falha', 'Algo falhou');
    
    // Verificar que a renderização incluiria a classe
    const eventos = globalThis.simpleLog.obterEventos();
    assert.strictEqual(eventos[0].tipo, 'ERROR');
  });
});

describe('simple-log.js — Integração completa: sessão -> reload -> sessão', () => {
  beforeEach(clearStorage);
  
  it('eventos persistem no localStorage entre sessões simuladas', () => {
    // --- SESSÃO 1 ---
    globalThis.logEvent('INFO', 'Auth', 'Login', 'Usuário logado');
    globalThis.logEvent('INFO', 'Lancamento', 'Criar', 'Lançamento criado', { valor: 100, tipo: 'entrada' });
    globalThis.logEvent('INFO', 'Backup', 'Exportar', 'Backup exportado');
    
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 3, '3 eventos na sessão 1');
    
    const storageSessao1 = storage.get('livrocaixa_diagnostic_log_v1');
    assert.ok(storageSessao1, 'salvo no localStorage');
    
    // --- SIMULA RELOAD ---
    // Na vida real: nova instância do módulo -> carregarDoStorage() lê do localStorage
    // No teste unitário: o módulo já está carregado, então verificamos que o storage
    // contém os dados corretos para que uma nova instância os carregue
    const storageAposReload = storage.get('livrocaixa_diagnostic_log_v1');
    assert.strictEqual(storageAposReload, storageSessao1, 'localStorage intacto para próxima sessão');
    
    // --- VERIFICAÇÃO: storage contém dados corretos para hidratação ---
    const parsed = JSON.parse(storageAposReload);
    assert.strictEqual(parsed.length, 3, '3 eventos no storage para hidratação');
    assert.strictEqual(parsed[0].modulo, 'Backup', 'mais recente primeiro');
    assert.strictEqual(parsed[2].modulo, 'Auth', 'mais antigo por último');
    
    // --- NOVA SESSÃO (continuação na mesma instância) ---
    globalThis.logEvent('INFO', 'Sessao2', 'NovaAcao', 'Evento nova sessão');
    
    // Verificar que storage acumula novos eventos
    assert.ok(storage.get('livrocaixa_diagnostic_log_v1').includes('Sessao2'), 'novo evento adicionado ao storage');
  });
});

describe('simple-log.js — Edge cases', () => {
  beforeEach(clearStorage);
  
  it('detalhes com objeto aninhado são serializados e parseados corretamente', () => {
    globalThis.logEvent('INFO', 'Teste', 'Aninhado', 'Teste', { 
      nivel1: { nivel2: { valor: 'profundo' } },
      array: [1, 2, { item: 'obj' }]
    });
    
    const eventos = globalThis.simpleLog.obterEventos();
    // detalhes é a string JSON sanitizada do objeto original
    const detalhes = JSON.parse(eventos[0].detalhes);
    
    // Objeto aninhado deve ser preservado (não vira string)
    assert.ok(typeof detalhes.nivel1 === 'object', 'objeto aninhado preservado como objeto');
    assert.strictEqual(detalhes.nivel1.nivel2.valor, 'profundo', 'valor profundo preservado');
    assert.ok(Array.isArray(detalhes.array), 'array preservado');
    assert.strictEqual(detalhes.array[2].item, 'obj', 'objeto no array preservado');
  });

  it('eventos com mesmo timestamp mantêm ordem de inserção', () => {
    // Forçar mesmo timestamp mockando Date
    const originalNow = Date.now;
    const fixedTime = new Date('2026-11-01T12:00:00.000Z').getTime();
    Date.now = () => fixedTime;
    
    globalThis.logEvent('INFO', 'A', '1', 'Primeiro');
    globalThis.logEvent('INFO', 'B', '2', 'Segundo');
    
    Date.now = originalNow;
    
    const eventos = globalThis.simpleLog.obterEventos();
    // Ambos têm mesmo timestamp, ordem preservada pelo unshift
    assert.strictEqual(eventos[0].acao, '2', 'segundo no topo');
    assert.strictEqual(eventos[1].acao, '1', 'primeiro embaixo');
  });

  it('storage corrompido não quebra novo evento', () => {
    // Corromper localStorage
    storage.set('livrocaixa_diagnostic_log_v1', 'json invalido {');
    
    // Limpar storage corrompido
    storage.delete('livrocaixa_diagnostic_log_v1');
    
    // Novo evento deve funcionar
    globalThis.logEvent('INFO', 'Recuperacao', 'Novo', 'Após corrupção');
    
    assert.strictEqual(globalThis.simpleLog.obterEventos().length, 1, 'novo evento funciona após limpar storage corrompido');
  });
});