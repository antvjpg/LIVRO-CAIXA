'use strict';

/* C.O.D.E. — FASE 2: prova vertical C.4 ↔ Playwright.
   Comprova que o núcleo C.4 R2.5.6 executa probeState() utilizando
   exclusivamente uma CDPSession criada pelo próprio Playwright para a
   página sob teste.

   Contrato do adaptador (playwright-cdp-domain-adapter.cjs):
     - proxies finos para DOM, CSS e Runtime;
     - cada método encaminha os parâmetros para session.send('Domain.method', params);
     - não cria conexão CDP própria, não abre Chromium e não usa
       chrome-remote-interface na porta 9222.

   Preservação: núcleo R2.5.6, harness R2.5.7, snapshots, fixtures históricos,
   resultados e manifestos originais, cdp-session.spec.js, playwright.config.cjs,
   package.json e workflow GitHub Actions permanecem inalterados. */

const { test, expect } = require('@playwright/test');
const { EventEmitter } = require('node:events');
const fs = require('fs');
const path = require('path');
const app = require('../helpers/app');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { createDomainAdapters, createPlaywrightBootstrap } = require('./playwright-cdp-domain-adapter.cjs');
const { runWithCdpSession } = require('./playwright-cdp-session-lifecycle.cjs');
const { createCDPAuditCore, createSampleIdRegistry, parseColor } = require('./original/docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs');

const SELECTOR_SINTETICO = '#code-cdp-bridge-fixture';

test.describe('C.4 — prova vertical: probeState via CDPSession do Playwright', () => {
  let dialogos = null;

  test.afterEach(async ({}, testInfo) => {
    if (dialogos && testInfo.status !== testInfo.expectedStatus) {
      const corpo = dialogos.map((d) => `${d.type}: ${d.message}`).join('\n') || 'nenhum';
      await testInfo.attach('dialogos.txt', { body: corpo, contentType: 'text/plain' }).catch(() => {});
    }
    dialogos = null;
  });

  function skipSemCredencial() {
    const creds = resolveCredentials();
    if (!creds) {
      test.skip(true, `BLOCKED: credenciais QA indisponíveis — ${guardReasonText() || 'sem credencial'}`);
    }
    return creds;
  }

  async function startPage(page, creds) {
    dialogos = app.attachDialogHandler(page);
    await app.openApp(page);
    await app.waitForAuthResolved(page, 15_000);
    await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });
    await app.waitForDataReady(page, 60_000);
    return dialogos;
  }

  test('executa probeState() do núcleo R2.5.6 com sessão CDP criada exclusivamente pelo Playwright', async ({ page, context }, testInfo) => {
    testInfo.setTimeout(90_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);

    /* Página/fixture sintética descartável */
    await page.evaluate((sel) => {
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('div');
        el.id = sel.slice(1);
        el.setAttribute('data-code-cdp-bridge', 'fixture');
        el.textContent = 'fixture-cdp-bridge';
        el.style.position = 'fixed';
        el.style.top = '10px';
        el.style.left = '10px';
        el.style.width = '120px';
        el.style.height = '40px';
        el.style.color = 'rgb(10, 20, 30)';
        el.style.backgroundColor = 'rgb(200, 210, 220)';
        el.style.opacity = '1';
        el.style.zIndex = '9999';
        document.body.appendChild(el);
      }
      return true;
    }, SELECTOR_SINTETICO);

    /* G3.1-D: ciclo de vida centralizado no helper compartilhado.
       Criação única via context.newCDPSession; detach único pelo helper;
       adaptador e núcleo não encerram a sessão (ownership Playwright). */
    const lifecycle = await runWithCdpSession({
      context,
      page,
      testInfo,
      operation: async ({ session }) => {
        const adapters = createDomainAdapters(session);

        /* Núcleo histórico R2.5.6 — instanciado com os proxies do adaptador */
        const cdpErrors = [];
        const consoleErrors = [];
        const exceptions = [];
        const core = createCDPAuditCore({
          CDP: null,
          DOM: adapters.DOM,
          CSS: adapters.CSS,
          Runtime: adapters.Runtime,
          consoleErrors,
          exceptions,
          cdpErrors,
        });
        const sampleIdRegistry = createSampleIdRegistry();

        await adapters.DOM.enable();
        await adapters.CSS.enable();
        await adapters.Runtime.enable();

        const occurrences = await core.probeState(
          SELECTOR_SINTETICO,
          'normal',
          'desktop',
          'light',
          '1',
          'dash',
          sampleIdRegistry
        );
        return { occurrences, cdpErrors, consoleErrors, exceptions };
      },
    });

    const { result, operationError, cleanupError, detachAttempts } = lifecycle;
    const { occurrences, cdpErrors, consoleErrors, exceptions } = result || {};

    /* Validações da prova vertical */
    expect(operationError, 'operação principal sem erro').toBeNull();
    expect(cleanupError, 'detach sem erro').toBeNull();
    expect(detachAttempts, 'detach exatamente uma vez').toBe(1);
    expect(cdpErrors, 'ausência de erros CDP inesperados').toHaveLength(0);
    expect(Array.isArray(occurrences), 'probeState retorna array').toBe(true);
    expect(occurrences.length, 'associação do nodeId — ocorrência encontrada').toBeGreaterThan(0);

    const first = occurrences[0];
    expect(typeof first.nodeId, 'associação do nodeId é number').toBe('number');
    expect(first.discarded, 'ocorrência não descartada').toBe(false);
    expect(first.color, 'estilo computado (color)').toBeTruthy();
    expect(first.bg, 'estilo computado (background-color)').toBeTruthy();
    expect(first.rect, 'geometria (rect)').toBeTruthy();
    expect(first.geometryStatus, 'geometria disponível').toBe('available');
    expect(first.visibilityStatus, 'visibilidade confirmada').toBe('visible');
    expect(first.cleanupStatus, 'limpeza de pseudoestado ok').toBe('not-required');

    /* Limpeza do elemento */
    const removido = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return !document.querySelector(sel);
    }, SELECTOR_SINTETICO);
    expect(removido, 'elemento sintético removido').toBe(true);

    /* Página ainda funcional após detach */
    await expect(page.locator('#userBar')).toBeVisible({ timeout: 10_000 });
    await app.waitForDataReady(page, 30_000);

    const diag = {
      prova: 'C.4-vertical-playwright',
      seletor: SELECTOR_SINTETICO,
      ocorrencias: occurrences.length,
      node_id: first.nodeId,
      visibility_status: first.visibilityStatus,
      geometry_status: first.geometryStatus,
      detach_count: detachAttempts,
      cdp_errors: cdpErrors.length,
      console_errors: consoleErrors.length,
      exceptions: exceptions.length,
      node_version: process.version,
    };
    try {
      await testInfo.attach('c4-prova-vertical-playwright.json', {
        body: JSON.stringify(diag, null, 2),
        contentType: 'application/json',
      });
    } catch (attachErr) {
      console.error('[C4_DIAGNOSTIC] falha ao anexar evidência:', attachErr.message);
    }
    console.log('[C4_DIAGNOSTIC]', JSON.stringify(diag));
  });
});

test.describe('C.4 — G3.1-B: eventos CDP no adaptador Playwright', () => {
  test('inscreve consoleAPICalled e exceptionThrown em session.on com payload íntegro e remoção idempotente', () => {
    const emitter = new EventEmitter();
    const session = {
      send: () => Promise.resolve({}),
      on: (eventName, listener) => emitter.on(eventName, listener),
      off: (eventName, listener) => emitter.off(eventName, listener),
      removeListener: (eventName, listener) => emitter.removeListener(eventName, listener),
    };
    const { Runtime } = createDomainAdapters(session);

    const calls = [];
    const consoleListener = ({ type, args }) => { calls.push(['console', type, args]); };
    const exceptionListener = ({ exceptionDetails }) => { calls.push(['exception', exceptionDetails]); };

    /* 1. inscrição nos dois eventos */
    const offConsole = Runtime.consoleAPICalled(consoleListener);
    const offException = Runtime.exceptionThrown(exceptionListener);
    expect(emitter.listenerCount('Runtime.consoleAPICalled')).toBe(1);
    expect(emitter.listenerCount('Runtime.exceptionThrown')).toBe(1);

    /* 3. preservação da identidade do listener */
    expect(emitter.listeners('Runtime.consoleAPICalled')[0]).toBe(consoleListener);
    expect(emitter.listeners('Runtime.exceptionThrown')[0]).toBe(exceptionListener);

    /* 2. encaminhamento do payload original sem alteração (mesma referência) */
    const argsRef = [{ type: 'string', value: 'fixture' }];
    const detailsRef = { text: 'exceção sintética' };
    emitter.emit('Runtime.consoleAPICalled', { type: 'log', args: argsRef });
    emitter.emit('Runtime.exceptionThrown', { exceptionDetails: detailsRef });
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toBe('console');
    expect(calls[0][1]).toBe('log');
    expect(calls[0][2]).toBe(argsRef);
    expect(calls[1][0]).toBe('exception');
    expect(calls[1][1]).toBe(detailsRef);

    /* 4 e 5. remoção individual: sem novas chamadas após a remoção */
    offConsole();
    emitter.emit('Runtime.consoleAPICalled', { type: 'warn', args: [] });
    expect(calls).toHaveLength(2);
    emitter.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'ainda ativo' } });
    expect(calls).toHaveLength(3);

    /* 6. remoção idempotente */
    offConsole();
    offConsole();
    expect(emitter.listenerCount('Runtime.consoleAPICalled')).toBe(0);
    offException();
    expect(emitter.listenerCount('Runtime.exceptionThrown')).toBe(0);
    emitter.emit('Runtime.exceptionThrown', { exceptionDetails: { text: 'removido' } });
    expect(calls).toHaveLength(3);

    /* 7. rejeição de listener inválido */
    expect(() => Runtime.consoleAPICalled('nao-e-funcao')).toThrow(TypeError);
    expect(() => Runtime.exceptionThrown(null)).toThrow(TypeError);
  });

  test('rejeita sessão sem API de eventos e usa removeListener() quando off() estiver ausente', () => {
    /* 8. erro claro quando a sessão não oferece API de eventos */
    const semEventos = { send: () => Promise.resolve({}) };
    const adaptersSemEventos = createDomainAdapters(semEventos);
    expect(() => adaptersSemEventos.Runtime.consoleAPICalled(() => {})).toThrow(/session\.on|API de eventos/);

    /* fallback de remoção: sessão expõe apenas removeListener */
    const emitter = new EventEmitter();
    const session = {
      send: () => Promise.resolve({}),
      on: (eventName, listener) => emitter.on(eventName, listener),
      removeListener: (eventName, listener) => emitter.removeListener(eventName, listener),
    };
    const { Runtime } = createDomainAdapters(session);
    const calls = [];
    const offException = Runtime.exceptionThrown(({ exceptionDetails }) => { calls.push(exceptionDetails); });
    emitter.emit('Runtime.exceptionThrown', { exceptionDetails: { a: 1 } });
    expect(calls).toEqual([{ a: 1 }]);
    offException();
    expect(emitter.listenerCount('Runtime.exceptionThrown')).toBe(0);
    offException();
    expect(emitter.listenerCount('Runtime.exceptionThrown')).toBe(0);
  });
});

test.describe('C.4 — G3.1-C: contrato do harness R2.5.7 ↔ adaptador Playwright', () => {
  /* Superfície efetivamente consumida pelo harness R2.5.7 e pelo núcleo R2.5.6,
     levantada na inspeção obrigatória do G3.1-C. */
  const CONSUMED_SURFACE = {
    DOM: ['enable', 'getDocument', 'querySelectorAll', 'describeNode', 'resolveNode', 'requestNode', 'getBoxModel', 'getAttributes'],
    CSS: ['enable', 'getMatchedStylesForNode', 'getComputedStyleForNode', 'forcePseudoState'],
    Runtime: ['enable', 'evaluate', 'callFunctionOn', 'consoleAPICalled', 'exceptionThrown'],
    Page: ['enable', 'navigate'],
    Emulation: ['setDeviceMetricsOverride', 'setTouchEmulationEnabled'],
  };

  function fakeSession(emitter, sendImpl) {
    return {
      send: sendImpl || (() => Promise.resolve({})),
      on: (eventName, listener) => emitter.on(eventName, listener),
      off: (eventName, listener) => emitter.off(eventName, listener),
      removeListener: (eventName, listener) => emitter.removeListener(eventName, listener),
    };
  }

  test('expõe os cinco domínios com os métodos exigidos pelo harness R2.5.7 e pelo núcleo R2.5.6', () => {
    const adapters = createDomainAdapters(fakeSession(new EventEmitter()));

    expect(Object.keys(adapters).sort(), 'cinco domínios').toEqual(['CSS', 'DOM', 'Emulation', 'Page', 'Runtime']);
    for (const [domain, methods] of Object.entries(CONSUMED_SURFACE)) {
      expect(adapters[domain], `domínio ${domain}`).toBeTruthy();
      for (const method of methods) {
        expect(typeof adapters[domain][method], `${domain}.${method}`).toBe('function');
      }
    }
    /* Método adicional preservado do G3.1-A (não exigido pelo harness,
       mas não removido). */
    expect(typeof adapters.DOM.querySelector, 'DOM.querySelector preservado').toBe('function');
  });

  test('encaminha comandos e parâmetros e preserva retornos e erros', async () => {
    const sentinel = { marker: 'retorno-integro' };
    const calls = [];
    const adapters = createDomainAdapters(fakeSession(new EventEmitter(), (method, params) => {
      calls.push([method, params]);
      return Promise.resolve(sentinel);
    }));

    const retorno = await adapters.Page.navigate({ url: 'https://exemplo.invalido' });
    expect(retorno, 'retorno é a mesma referência do session.send').toBe(sentinel);
    expect(calls, 'método e parâmetros exatos').toContainEqual(['Page.navigate', { url: 'https://exemplo.invalido' }]);

    const boom = new Error('erro CDP sintetico');
    const adaptersErro = createDomainAdapters(fakeSession(new EventEmitter(), () => Promise.reject(boom)));
    await expect(adaptersErro.Runtime.evaluate({ expression: '1' }), 'erro propaga com a mesma referência').rejects.toBe(boom);
  });

  test('assinaturas de listeners no formato R2.5.7: ({ type, args }) e ({ exceptionDetails })', () => {
    const emitter = new EventEmitter();
    const { Runtime } = createDomainAdapters(fakeSession(emitter));
    const consoleCalls = [];
    const exceptionCalls = [];

    Runtime.consoleAPICalled(({ type, args }) => { consoleCalls.push({ type, args }); });
    Runtime.exceptionThrown(({ exceptionDetails }) => { exceptionCalls.push(exceptionDetails); });

    const consolePayload = { type: 'error', args: [{ type: 'string', value: 'x' }] };
    const exceptionPayload = { exceptionDetails: { text: 'boom' } };
    emitter.emit('Runtime.consoleAPICalled', consolePayload);
    emitter.emit('Runtime.exceptionThrown', exceptionPayload);

    expect(consoleCalls, 'consoleAPICalled no formato R2.5.7').toHaveLength(1);
    expect(consoleCalls[0].type).toBe('error');
    expect(consoleCalls[0].args, 'args preservado por referência').toBe(consolePayload.args);
    expect(exceptionCalls, 'exceptionThrown no formato R2.5.7').toHaveLength(1);
    expect(exceptionCalls[0], 'exceptionDetails preservado por referência').toBe(exceptionPayload.exceptionDetails);
  });

  test('contrato Playwright: sem transporte CRI, sem conexão própria e sem encerramento implícito', async () => {
    /* 6 e 7: análise estática do adaptador (comentários removidos para não
       confundir menção contratual com uso). Literais montados em partes
       para que este próprio teste não seja confundido com uso real. */
    const src = fs
      .readFileSync(path.join(__dirname, 'playwright-cdp-domain-adapter.cjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const CRI = ['chrome', 'remote', 'interface'].join('-');
    const PORTA = ['92', '22'].join('');
    const CONECTA = ['.con', 'nect('].join('');
    const ABRE_CDP = ['CDP', '('].join('');
    expect(src.includes(`require('${CRI}')`) || src.includes(`require("${CRI}")`), 'sem require do transporte legado').toBe(false);
    expect(src.includes(CONECTA), 'sem conexao propria').toBe(false);
    expect(src.includes('new WebSocket'), 'sem WebSocket proprio').toBe(false);
    expect(src.includes(ABRE_CDP), 'sem abertura de CDP alternativo').toBe(false);
    expect(src.includes(PORTA), 'sem porta legada').toBe(false);

    /* 8: o adaptador nunca encerra a sessão (detach/close/disconnect). */
    const lifecycle = [];
    const emitter = new EventEmitter();
    const session = {
      ...fakeSession(emitter),
      detach: () => { lifecycle.push('detach'); return Promise.resolve(); },
      close: () => { lifecycle.push('close'); return Promise.resolve(); },
      disconnect: () => { lifecycle.push('disconnect'); return Promise.resolve(); },
    };
    const adapters = createDomainAdapters(session);
    await adapters.DOM.enable();
    await adapters.CSS.enable();
    await adapters.Runtime.enable();
    await adapters.Page.enable();
    const offConsole = adapters.Runtime.consoleAPICalled(() => {});
    const offException = adapters.Runtime.exceptionThrown(() => {});
    offConsole();
    offException();
    expect(lifecycle, 'nenhum encerramento implícito da sessão').toEqual([]);
    expect(emitter.listenerCount('Runtime.consoleAPICalled')).toBe(0);
    expect(emitter.listenerCount('Runtime.exceptionThrown')).toBe(0);
  });

  test('bootstrap Playwright injeta domínios explicitamente no núcleo e mantém a sessão com o Playwright', () => {
    const sentinelCore = { probeState: () => {} };
    let injected = null;
    const createCoreFake = (deps) => { injected = deps; return sentinelCore; };
    const session = fakeSession(new EventEmitter());
    const consoleErrors = [];
    const exceptions = [];
    const cdpErrors = [];
    const result = createPlaywrightBootstrap(session, { createCore: createCoreFake, consoleErrors, exceptions, cdpErrors });

    expect(result.core, 'core retornado').toBe(sentinelCore);
    expect(result.adapters, 'adapters retornados').toBeTruthy();
    expect(result.session, 'sessão permanece a do Playwright').toBe(session);
    expect(injected, 'createCore recebe injeção explícita').toBeTruthy();
    expect(injected.CDP, 'CDP nulo no caminho Playwright').toBeNull();
    expect(injected.DOM).toBe(result.adapters.DOM);
    expect(injected.CSS).toBe(result.adapters.CSS);
    expect(injected.Runtime).toBe(result.adapters.Runtime);
    expect(injected.consoleErrors).toBe(consoleErrors);
    expect(injected.exceptions).toBe(exceptions);
    expect(injected.cdpErrors).toBe(cdpErrors);

    expect(() => createPlaywrightBootstrap(session, {}), 'createCore obrigatória').toThrow(/createCore/);
  });

  test('reusa resolveNodeIds() do harness R2.5.7 real contra o adaptador (sem copiar o harness)', async () => {
    let harness = null;
    try {
      harness = require('./original/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7.cjs');
    } catch (err) {
      test.skip(true, `harness histórico indisponível no ambiente: ${err.message}`);
      return;
    }
    expect(typeof harness.resolveNodeIds, 'harness exporta resolveNodeIds').toBe('function');

    const emitter = new EventEmitter();
    const sendCalls = [];
    const adapters = createDomainAdapters(fakeSession(emitter, (method, params) => {
      sendCalls.push([method, params]);
      if (method === 'DOM.getDocument') return Promise.resolve({ root: { nodeId: 1 } });
      if (method === 'DOM.querySelectorAll') return Promise.resolve({ nodeIds: [7] });
      return Promise.resolve({});
    }));
    const cdpErrors = [];
    const rows = [
      { key: 'c4-999-0', sel: '.a' },
      { key: 'c4-998-0', sel: '.b' },
    ];

    const map = await harness.resolveNodeIds(adapters.DOM, rows, cdpErrors, 999);

    expect(map.get('c4-999-0'), 'associação resolvida pelo harness real').toEqual({
      status: 'resolved', nodeId: 7, key: 'c4-999-0', selector: '[data-c4-audit="c4-999-0"]', idCount: 1,
    });
    expect(map.get('c4-998-0').status, 'chave de outra execução não resolvida').toBe('node-not-found');
    expect(sendCalls.filter(([m]) => m === 'DOM.getDocument'), 'getDocument uma vez por lote').toEqual([['DOM.getDocument', { depth: -1, pierce: true }]]);
    expect(sendCalls, 'querySelectorAll com seletor da chave').toContainEqual(['DOM.querySelectorAll', { nodeId: 1, selector: '[data-c4-audit="c4-999-0"]' }]);
    expect(cdpErrors, 'sem erros CDP').toHaveLength(0);
  });
});

test.describe('C.4 — G3.1-D: ciclo de vida centralizado da CDPSession (runWithCdpSession)', () => {
  /* Sessão falsa controlada: nunca abre Chromium nem conexão CDP real.
     Conta criações e detaches para comprovar unicidade. */
  function fakeSession({ detachImpl } = {}) {
    let detachCalls = 0;
    let createCalls = 0;
    const session = {
      send: () => Promise.resolve({}),
      on: () => {},
      off: () => {},
      removeListener: () => {},
      detach: () => {
        detachCalls += 1;
        if (detachImpl) return detachImpl();
        return Promise.resolve();
      },
    };
    Object.defineProperty(session, 'detachCalls', { get: () => detachCalls });
    Object.defineProperty(session, 'createCalls', { get: () => createCalls });
    session.recordCreate = () => { createCalls += 1; };
    return session;
  }

  function fakeContext(session) {
    return {
      newCDPSession: async () => {
        session.recordCreate();
        return session;
      },
    };
  }

  /* 1. Sucesso: uma criação, operação concluída e um detach. */
  test('1. sucesso: uma criação, operação concluída e um detach', async () => {
    const session = fakeSession();
    const context = fakeContext(session);
    let operationCalls = 0;

    const out = await runWithCdpSession({
      context,
      page: {},
      testInfo: {},
      operation: async ({ session: s }) => {
        operationCalls += 1;
        expect(s, 'operação recebe a mesma sessão criada').toBe(session);
        return { ok: true };
      },
    });

    expect(out.session, 'sessão devolvida').toBe(session);
    expect(out.result, 'resultado da operação').toEqual({ ok: true });
    expect(out.operationError, 'sem erro de operação').toBeNull();
    expect(out.cleanupError, 'sem erro de cleanup').toBeNull();
    expect(out.detachAttempts, 'detach tentado uma vez').toBe(1);
    expect(session.createCalls, 'criação única').toBe(1);
    expect(session.detachCalls, 'detach executado uma vez').toBe(1);
    expect(operationCalls, 'operação executada uma vez').toBe(1);
    expect(out.detachSuccess, 'detach bem-sucedido').toBe(true);
    expect(out.operationDuration, 'duração registrada').toBeGreaterThanOrEqual(0);
    expect(out.detachDuration, 'duração do detach registrada').toBeGreaterThanOrEqual(0);
  });

  /* 2. Erro na operação: preserva a mesma referência de operationError
        e executa detach uma vez. */
  test('2. erro na operação: preserva a referência do operationError e executa detach uma vez', async () => {
    const sentinel = new Error('boom-operacao');
    const session = fakeSession();
    const context = fakeContext(session);

    const out = await runWithCdpSession({
      context,
      page: {},
      testInfo: {},
      operation: async () => { throw sentinel; },
    });

    expect(out.operationError, 'operationError preservado por referência').toBe(sentinel);
    expect(out.cleanupError, 'cleanup sem erro').toBeNull();
    expect(out.result, 'resultado nulo quando a operação falha').toBeNull();
    expect(out.detachAttempts, 'detach tentado uma vez').toBe(1);
    expect(session.createCalls, 'criação única').toBe(1);
    expect(session.detachCalls, 'detach executado uma vez').toBe(1);
    expect(out.detachSuccess, 'detach bem-sucedido').toBe(true);
  });

  /* 3. Erro no cleanup: preserva cleanupError sem apagar operationError. */
  test('3. erro no cleanup: preserva cleanupError sem apagar operationError', async () => {
    const opErr = new Error('erro-operacao');
    const cleanupErr = new Error('erro-detach');
    const session = fakeSession({ detachImpl: () => { throw cleanupErr; } });
    const context = fakeContext(session);

    const out = await runWithCdpSession({
      context,
      page: {},
      testInfo: {},
      operation: async () => { throw opErr; },
    });

    expect(out.operationError, 'operationError preservado').toBe(opErr);
    expect(out.cleanupError, 'cleanupError preservado por referência').toBe(cleanupErr);
    expect(out.detachAttempts, 'detach tentado uma vez').toBe(1);
    expect(session.detachCalls, 'detach executado uma vez').toBe(1);
    expect(out.detachSuccess, 'detach marcado como falha').toBe(false);
  });

  /* 4. Context ausente: rejeita antes da criação. */
  test('4. context ausente: rejeita antes da criação', async () => {
    let created = 0;
    const context = { newCDPSession: async () => { created += 1; return {}; } };
    await expect(runWithCdpSession({ context: null, page: {}, testInfo: {}, operation: async () => {} }))
      .rejects.toThrow(/context é obrigatório/);
    expect(created, 'nenhuma sessão criada').toBe(0);
  });

  /* 5. Page ausente: rejeita antes da criação. */
  test('5. page ausente: rejeita antes da criação', async () => {
    let created = 0;
    const context = { newCDPSession: async () => { created += 1; return {}; } };
    await expect(runWithCdpSession({ context, page: null, testInfo: {}, operation: async () => {} }))
      .rejects.toThrow(/page é obrigatório/);
    expect(created, 'nenhuma sessão criada').toBe(0);
  });

  /* 6. Operation inválida: rejeita com TypeError antes da criação. */
  test('6. operation inválida: rejeita com TypeError antes da criação', async () => {
    let created = 0;
    const context = { newCDPSession: async () => { created += 1; return {}; } };
    await expect(runWithCdpSession({ context, page: {}, testInfo: {}, operation: 'nao-e-funcao' }))
      .rejects.toThrow(TypeError);
    expect(created, 'nenhuma sessão criada').toBe(0);
  });

  /* 7. Ownership: o adaptador não encerra a sessão. */
  test('7. ownership: o adaptador não encerra a sessão', async () => {
    const lifecycle = [];
    const session = {
      send: () => Promise.resolve({}),
      on: () => {},
      off: () => {},
      removeListener: () => {},
      detach: () => { lifecycle.push('detach'); return Promise.resolve(); },
      close: () => { lifecycle.push('close'); return Promise.resolve(); },
      disconnect: () => { lifecycle.push('disconnect'); return Promise.resolve(); },
    };
    const adapters = createDomainAdapters(session);
    await adapters.DOM.enable();
    await adapters.CSS.enable();
    await adapters.Runtime.enable();
    await adapters.Page.enable();
    expect(lifecycle, 'adaptador não encerra a sessão').toEqual([]);
    expect(typeof adapters.DOM.detach, 'adaptador não expõe detach').toBe('undefined');
    expect(typeof adapters.close, 'adaptador não expõe close').toBe('undefined');
  });

  /* 8. Sem duplicidade: nenhuma segunda tentativa de detach pelo chamador
        após o helper concluir. */
  test('8. sem duplicidade: nenhuma segunda tentativa de detach pelo chamador', async () => {
    const session = fakeSession();
    const context = fakeContext(session);

    const out = await runWithCdpSession({
      context,
      page: {},
      testInfo: {},
      operation: async () => ({ ok: true }),
    });

    expect(out.detachAttempts, 'helper tentou detach uma vez').toBe(1);
    expect(session.detachCalls, 'detach executado exatamente uma vez').toBe(1);
    /* O chamador não chama session.detach() novamente após o helper:
       session.detachCalls permanece 1, provando ausência de duplicidade. */
    expect(session.detachCalls, 'nenhuma segunda tentativa após o helper').toBe(1);
    expect(typeof out.session.detach, 'sessão devolvida ainda expõe detach (ownership Playwright)').toBe('function');
  });
});

test.describe('C.4 — G3.1-E: integração real CDP ↔ adaptador ↔ bootstrap ↔ núcleo', () => {
  /* Marcadores determinísticos e sem dados sensíveis. */
  const CONSOLE_MARKER = 'G3E_CONSOLE_MARKER_7F3A';
  const EXCEPTION_MARKER = 'G3E_EXCEPTION_MARKER_9C2B';
  const SENTINEL_MSG = 'G3E_SENTINEL_OPERATION_FAILURE';

  let dialogos = null;

  test.afterEach(async ({}, testInfo) => {
    if (dialogos && testInfo.status !== testInfo.expectedStatus) {
      const corpo = dialogos.map((d) => `${d.type}: ${d.message}`).join('\n') || 'nenhum';
      await testInfo.attach('dialogos.txt', { body: corpo, contentType: 'text/plain' }).catch(() => {});
    }
    dialogos = null;
  });

  function skipSemCredencial() {
    const creds = resolveCredentials();
    if (!creds) {
      test.skip(true, `BLOCKED: credenciais QA indisponíveis — ${guardReasonText() || 'sem credencial'}`);
    }
    return creds;
  }

  async function startPage(page, creds) {
    dialogos = app.attachDialogHandler(page);
    await app.openApp(page);
    await app.waitForAuthResolved(page, 15_000);
    await expect(page.locator('#userBar')).toContainText(creds.email, { timeout: 20_000 });
    await app.waitForDataReady(page, 60_000);
  }

  async function prepareFixture(page) {
    await page.evaluate((sel) => {
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('div');
        el.id = sel.slice(1);
        el.setAttribute('data-code-cdp-e2e', 'fixture');
        el.textContent = 'fixture-g31e';
        el.style.position = 'fixed';
        el.style.top = '10px';
        el.style.left = '10px';
        el.style.width = '120px';
        el.style.height = '40px';
        el.style.color = 'rgb(10, 20, 30)';
        el.style.backgroundColor = 'rgb(200, 210, 220)';
        el.style.opacity = '1';
        el.style.zIndex = '9998';
        document.body.appendChild(el);
      }
      return true;
    }, SELECTOR_SINTETICO);
  }

  /* Espera controlada por condição: a resolução vem do evento recebido;
     o timeout é apenas limite de falha, não mecanismo de sincronização. */
  function withTimeout(promise, ms, label) {
    let timer;
    const limite = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: marcador não recebido em ${ms}ms`)), ms);
    });
    return Promise.race([promise, limite]).finally(() => clearTimeout(timer));
  }

  /* E1–E4 + E6: integração real de transporte, bootstrap, núcleo, eventos,
     lifecycle e estado pós-detach em uma única operação. */
  test('integra sessão CDP real, bootstrap, núcleo R2.5.6 e eventos com detach único', async ({ page, context }, testInfo) => {
    testInfo.setTimeout(120_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);
    await prepareFixture(page);

    const lifecycle = await runWithCdpSession({
      context,
      page,
      testInfo,
      operation: async ({ session }) => {
        const cdpErrors = [];
        const consoleErrors = [];
        const exceptions = [];
        const bootstrap = createPlaywrightBootstrap(session, {
          createCore: createCDPAuditCore,
          consoleErrors,
          exceptions,
          cdpErrors,
        });
        const { adapters, core } = bootstrap;

        expect(bootstrap.session, 'bootstrap mantém a sessão do Playwright').toBe(session);
        expect(bootstrap.consoleErrors, 'array de consoleErrors injetado').toBe(consoleErrors);
        expect(bootstrap.exceptions, 'array de exceptions injetado').toBe(exceptions);
        expect(bootstrap.cdpErrors, 'array de cdpErrors injetado').toBe(cdpErrors);

        /* E1 — comandos reais de DOM, CSS e Runtime pelo adaptador */
        await adapters.DOM.enable();
        await adapters.CSS.enable();
        await adapters.Runtime.enable();

        const document = await adapters.DOM.getDocument({ depth: -1, pierce: true });
        expect(document.root.nodeId, 'DOM.getDocument real').toBeGreaterThan(0);

        const found = await adapters.DOM.querySelectorAll({
          nodeId: document.root.nodeId,
          selector: SELECTOR_SINTETICO,
        });
        expect(found.nodeIds.length, 'fixture encontrada via CDP real').toBeGreaterThan(0);

        const computed = await adapters.CSS.getComputedStyleForNode({ nodeId: found.nodeIds[0] });
        expect(Array.isArray(computed.computedStyle) && computed.computedStyle.length > 0, 'CSS.getComputedStyleForNode real').toBe(true);

        const runtime = await adapters.Runtime.evaluate({
          expression: 'window.location.href',
          returnByValue: true,
        });
        expect(typeof runtime.result.value, 'Runtime.evaluate real').toBe('string');

        /* E3 — eventos reais na CDPSession do Playwright */
        const consoleEvents = [];
        const exceptionEvents = [];
        let resolveConsole;
        let resolveException;
        const consoleSeen = new Promise((resolve) => { resolveConsole = resolve; });
        const exceptionSeen = new Promise((resolve) => { resolveException = resolve; });

        const offConsole = adapters.Runtime.consoleAPICalled((payload) => {
          consoleEvents.push(payload);
          if (JSON.stringify(payload).includes(CONSOLE_MARKER)) resolveConsole(payload);
        });
        const offException = adapters.Runtime.exceptionThrown((payload) => {
          exceptionEvents.push(payload);
          if (JSON.stringify(payload).includes(EXCEPTION_MARKER)) resolveException(payload);
        });

        let consolePayload = null;
        let exceptionPayload = null;
        try {
          await page.evaluate((marker) => { console.log(marker); }, CONSOLE_MARKER);
          await page.evaluate((marker) => {
            const script = document.createElement('script');
            script.textContent = `throw new Error("${marker}")`;
            document.head.appendChild(script);
          }, EXCEPTION_MARKER);
          consolePayload = await withTimeout(consoleSeen, 10_000, 'Runtime.consoleAPICalled');
          exceptionPayload = await withTimeout(exceptionSeen, 10_000, 'Runtime.exceptionThrown');
        } finally {
          /* Remoção dos listeners antes do detach executado pelo helper. */
          offConsole();
          offException();
        }

        const totalAposRemocao = consoleEvents.length;
        await page.evaluate((marker) => { console.log(marker); }, `${CONSOLE_MARKER}_POS_REMOCAO`);
        /* Janela curta de observação negativa; a sincronização positiva acima
           foi feita por condição, não por tempo. */
        await page.waitForTimeout(300);
        expect(consoleEvents.length, 'nenhum evento encaminhado após remoção').toBe(totalAposRemocao);

        /* E2 — probeState real pelo núcleo histórico R2.5.6 */
        const sampleIdRegistry = createSampleIdRegistry();
        const occurrences = await core.probeState(
          SELECTOR_SINTETICO,
          'normal',
          'desktop',
          'light',
          '1',
          'dash',
          sampleIdRegistry
        );

        expect(cdpErrors, 'ausência de erros CDP inesperados').toHaveLength(0);
        return {
          occurrences,
          consolePayload,
          exceptionPayload,
          consoleCount: consoleEvents.length,
          exceptionCount: exceptionEvents.length,
          domNodeId: document.root.nodeId,
          runtimeHref: runtime.result.value,
          computedProps: computed.computedStyle.length,
          listenersAposRemocao: typeof session.listenerCount === 'function'
            ? session.listenerCount('Runtime.consoleAPICalled')
            : null,
        };
      },
    });

    /* E4 — lifecycle integrado */
    expect(lifecycle.operationError, 'operação integrada sem erro').toBeNull();
    expect(lifecycle.cleanupError, 'cleanup sem erro').toBeNull();
    expect(lifecycle.detachAttempts, 'detach exatamente uma vez').toBe(1);
    expect(lifecycle.detachSuccess, 'detach bem-sucedido').toBe(true);

    const out = lifecycle.result;
    expect(out.consolePayload, 'evento de console real recebido').toBeTruthy();
    expect(JSON.stringify(out.consolePayload), 'marcador de console presente').toContain(CONSOLE_MARKER);
    expect(out.exceptionPayload, 'evento de exceção real recebido').toBeTruthy();
    expect(JSON.stringify(out.exceptionPayload), 'marcador de exceção presente').toContain(EXCEPTION_MARKER);
    expect(out.consoleCount, 'eventos de console capturados').toBeGreaterThan(0);
    expect(out.exceptionCount, 'eventos de exceção capturados').toBeGreaterThan(0);
    expect(out.listenersAposRemocao === null || out.listenersAposRemocao === 0, 'sem listeners residuais').toBe(true);

    expect(Array.isArray(out.occurrences), 'probeState retorna array').toBe(true);
    expect(out.occurrences.length, 'ocorrência encontrada').toBeGreaterThan(0);
    const first = out.occurrences[0];
    expect(typeof first.nodeId, 'nodeId válido').toBe('number');
    expect(first.discarded, 'ocorrência não descartada').toBe(false);
    expect(first.color, 'estilo computado color').toBeTruthy();
    expect(first.bg, 'estilo computado background-color').toBeTruthy();
    expect(first.rect, 'geometria disponível').toBeTruthy();
    expect(first.geometryStatus, 'geometria confirmada').toBe('available');
    expect(first.visibilityStatus, 'visibilidade confirmada').toBe('visible');
    expect(first.cleanupStatus, 'limpeza aplicável').toBe('not-required');

    /* E6 — estado após encerramento */
    await expect(lifecycle.session.send('DOM.getDocument'), 'sessão não ativa após detach')
      .rejects.toThrow(/closed|detached|Target/i);
    const removido = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return !document.querySelector(sel);
    }, SELECTOR_SINTETICO);
    expect(removido, 'elemento sintético removido').toBe(true);
    await expect(page.locator('#userBar'), 'página funcional após detach').toBeVisible({ timeout: 10_000 });
    await app.waitForDataReady(page, 30_000);

    const diag = {
      prova: 'C.4-G3.1-E-integrada',
      comandos_reais: ['DOM.getDocument', 'DOM.querySelectorAll', 'CSS.getComputedStyleForNode', 'Runtime.evaluate'],
      eventos_reais: ['Runtime.consoleAPICalled', 'Runtime.exceptionThrown'],
      ocorrencias: out.occurrences.length,
      console_capturados: out.consoleCount,
      excecoes_capturadas: out.exceptionCount,
      detach_attempts: lifecycle.detachAttempts,
      detach_success: lifecycle.detachSuccess,
      node_version: process.version,
    };
    await testInfo.attach('c4-g31e-integracao.json', {
      body: JSON.stringify(diag, null, 2),
      contentType: 'application/json',
    }).catch(() => {});
    console.log('[C4_DIAGNOSTIC]', JSON.stringify(diag));
  });

  /* E5 — falha integrada com CDPSession real. */
  test('falha integrada com sessão real preserva erro sentinela e executa detach único', async ({ page, context }, testInfo) => {
    testInfo.setTimeout(90_000);
    const creds = skipSemCredencial();
    await startPage(page, creds);

    const sentinel = new Error(SENTINEL_MSG);
    const lifecycle = await runWithCdpSession({
      context,
      page,
      testInfo,
      operation: async ({ session }) => {
        const adapters = createDomainAdapters(session);
        await adapters.Runtime.enable();
        const valido = await adapters.Runtime.evaluate({ expression: '1 + 1', returnByValue: true });
        expect(valido.result.value, 'comando CDP real válido antes da falha').toBe(2);
        throw sentinel;
      },
    });

    expect(lifecycle.operationError, 'referência original do erro preservada').toBe(sentinel);
    expect(lifecycle.cleanupError, 'cleanup não mascara o erro da operação').toBeNull();
    expect(lifecycle.result, 'resultado nulo na falha').toBeNull();
    expect(lifecycle.detachAttempts, 'detach exatamente uma vez').toBe(1);
    expect(lifecycle.detachSuccess, 'detach bem-sucedido').toBe(true);

    await expect(page.locator('#userBar'), 'página funcional após falha e detach').toBeVisible({ timeout: 10_000 });
    await app.waitForDataReady(page, 30_000);
  });
});

test.describe('C.4 — G4.1: paridade representativa do fluxo R2.5.7 via Playwright', () => {
  const FIXTURA = 'e2e/c4/original/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-fixtures.html';
  const historical = require('./original/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7.cjs');

  /* IDs da fixture com expectativa documentada no teste histórico R2.5.7. */
  const IDS_REFERENCIA = new Set(['r256-accent-consumer', 'r256-accent-opacity0-child', 'r25-btn-1']);
  const ALVO_V24 = '#r25-btn-1';

  /* Tolerância geométrica: getBoundingClientRect (collectScript) e
     DOM.getBoxModel (CDP) retornam DIP, mas serializam por caminhos distintos
     com granularidade LayoutUnit de 1/64 px. 1 CSS px cobre subpixel/jitter
     de layout em CI headless sem mascarar divergência real de geometria. */
  const TOLERANCIA_GEOMETRIA_PX = 1;

  /* Propriedades determinísticas da fixture: background-color vem de
     background:#FFFFFF (declarado no autor e rgb(255,255,255) no CDP);
     color usa var(--accent), resolvido pelo computedStyle do mesmo nó.
     Ambas são capturadas por captureWinningRules (núcleo). */
  const PROPRIEDADES_CSS = ['background-color', 'color'];

  /* Expectativas CONCRETAS extraídas de c4-v05-b-r2-5-7-test.cjs.
     Voláteis (runId, key, nodeId, sampleId, rect.x/y) são excluídos. */
  const EXPECTATIVAS_HISTORICAS = [
    {
      caso: 'Y1',
      id: 'r256-accent-consumer',
      campos: {
        'nodeAssociation.status': 'resolved',
        visibilityStatus: 'visible',
        ancestorVisibility: 'completed',
        ancestorOpacityStatus: 'complete',
        ancestorOpacity: 1,
        ancestorHidden: false,
      },
    },
    {
      caso: 'Y2',
      id: 'r256-accent-opacity0-child',
      campos: {
        'nodeAssociation.status': 'resolved',
        visibilityStatus: 'not-visible',
        ancestorOpacity: 0,
        ancestorOpacityStatus: 'conclusive-zero',
      },
    },
    {
      caso: 'D1/V1',
      id: 'r25-btn-1',
      campos: {
        visibilityStatus: 'visible',
        rect: '__PRESENTE__',
      },
    },
    {
      /* G4.2-A — mesmos três campos exigidos por V24, no alvo histórico
         correto (#r25-btn-1), nunca transferidos de Y1. */
      caso: 'V24',
      id: 'r25-btn-1',
      campos: {
        'nodeAssociation.status': 'resolved',
        ancestorOpacityStatus: 'complete',
        ancestorOpacity: 1,
        ancestorVisibility: 'completed',
      },
    },
  ];

  function getPath(obj, caminho) {
    return caminho.split('.').reduce((atual, chave) => (atual == null ? atual : atual[chave]), obj);
  }

  function compararSemantica(evidencias) {
    const porId = new Map(evidencias.map((r) => [r.id, r]));
    return EXPECTATIVAS_HISTORICAS.map((caso) => {
      const linha = porId.get(caso.id);
      if (!linha) {
        return { caso: caso.caso, id: caso.id, situacao: 'nao-comparavel', motivo: 'elemento ausente da coleta' };
      }
      for (const [campo, esperado] of Object.entries(caso.campos)) {
        const obtido = getPath(linha, campo);
        if (esperado === '__PRESENTE__') {
          expect(obtido, `${caso.caso}: ${campo} presente`).toBeTruthy();
        } else {
          expect(obtido, `${caso.caso}: ${campo} conforme referência histórica`).toEqual(esperado);
        }
      }
      return { caso: caso.caso, id: caso.id, situacao: 'comparado', campos: Object.keys(caso.campos) };
    });
  }

  test('reexecuta collectScript, resolveNodeIds e buildAuditRow em CDPSession real com isolamento Y/Z', async ({ page, context }, testInfo) => {
    testInfo.setTimeout(180_000);
    await page.goto(FIXTURA, { waitUntil: 'load' });
    await expect(page.locator('body'), 'fixture histórica carregada').toBeVisible();

    const lifecycle = await runWithCdpSession({
      context,
      page,
      testInfo,
      operation: async ({ session }) => {
        /* G4.1-R1: um único conjunto de adapters, criado pelo bootstrap. */
        const cdpErrors = [];
        const consoleErrors = [];
        const exceptions = [];
        const bootstrap = createPlaywrightBootstrap(session, {
          createCore: createCDPAuditCore,
          consoleErrors,
          exceptions,
          cdpErrors,
        });
        const { adapters, core } = bootstrap;
        await adapters.DOM.enable();
        await adapters.CSS.enable();
        await adapters.Runtime.enable();

        /* Listeners monitorados e removidos em finally, antes do detach. */
        const eventos = [];
        const offConsole = adapters.Runtime.consoleAPICalled((payload) => {
          eventos.push(['consoleAPICalled', payload]);
        });
        const offException = adapters.Runtime.exceptionThrown((payload) => {
          eventos.push(['exceptionThrown', payload]);
        });

        try {
          const rounds = [];
          const geometria = [];
          const css = [];

          /* Duas execuções na mesma página: grupos Y e Z. */
          for (let i = 0; i < 2; i++) {
            /* collectScript ORIGINAL via Runtime.evaluate da sessão real. */
            const evaluation = await adapters.Runtime.evaluate({
              expression: historical.collectScript,
              returnByValue: true,
              awaitPromise: false,
              userGesture: true,
            });
            if (evaluation.exceptionDetails) {
              throw new Error(
                'collectScript falhou: ' +
                  (evaluation.exceptionDetails.exception ? evaluation.exceptionDetails.exception.description : evaluation.exceptionDetails.text)
              );
            }

            const collected = evaluation.result.value;
            expect(collected, 'collectScript retornou dados').toBeTruthy();
            expect(Array.isArray(collected.rows), 'rows é array').toBe(true);
            expect(collected.rows.length, 'consumidores coletados na página real').toBeGreaterThan(0);
            expect(typeof collected.runId, 'runId da execução').toBe('number');

            /* resolveNodeIds ORIGINAL com respostas CDP reais. */
            const associationMap = await historical.resolveNodeIds(
              adapters.DOM,
              collected.rows,
              cdpErrors,
              collected.runId
            );
            expect(associationMap.size, 'cardinalidade do mapa de associações').toBe(collected.rows.length);

            const prefix = `c4-${collected.runId}-`;
            const evidencias = [];
            /* buildAuditRow ORIGINAL para um subconjunto representativo,
               priorizando os elementos com expectativa histórica documentada.
               O fluxo histórico completo cobre 393 asserções; esta prova é
               representativa e não integral. */
            const selecionadas = [
              ...collected.rows.filter((r) => IDS_REFERENCIA.has(r.id)),
              ...collected.rows.filter((r) => !IDS_REFERENCIA.has(r.id)),
            ].slice(0, 5);
            for (const row of selecionadas) {
              expect(row.key.startsWith(prefix), 'chave pertence à execução corrente').toBe(true);
              const association = associationMap.get(row.key);
              expect(association, 'associação presente no mapa').toBeTruthy();
              expect(association.status, 'associação resolvida').toBe('resolved');
              expect(typeof association.nodeId, 'nodeId real').toBe('number');
              expect(association.nodeId, 'nodeId positivo').toBeGreaterThan(0);

              const auditRow = await historical.buildAuditRow({
                core,
                row,
                association,
                context: {
                  vp: 'desktop',
                  themeSet: 'light',
                  theme: '1',
                  themeName: 'Tema 1',
                  screen: 'dash',
                  screenLabel: 'Painel',
                },
              });

              /* G4.2-C/D — apenas no alvo histórico das frentes de geometria
                 e CSS. Mesmo nodeId, mesma iteração, mesma execução. */
              if (row.id === 'r25-btn-1') {
                /* Geometria: rect do collectScript vs. box model CDP. */
                const boxModel = await adapters.DOM.getBoxModel({ nodeId: association.nodeId });
                expect(boxModel && boxModel.model, 'box model CDP recebido').toBeTruthy();
                const rectCdp = core.rectFromBorder(boxModel.model.border);
                expect(rectCdp, 'border box convertido por rectFromBorder').not.toBeNull();
                expect(auditRow.rect, 'rect da evidência').toBeTruthy();
                const deltas = {};
                for (const campo of ['x', 'y', 'w', 'h']) {
                  deltas[campo] = Math.abs(auditRow.rect[campo] - rectCdp[campo]);
                  expect(Number.isFinite(deltas[campo]), `delta ${campo} finito`).toBe(true);
                  expect(deltas[campo], `delta ${campo} dentro da tolerância`).toBeLessThanOrEqual(TOLERANCIA_GEOMETRIA_PX);
                }
                geometria.push({
                  runId: collected.runId,
                  nodeId: association.nodeId,
                  rectEvidencia: auditRow.rect,
                  rectCdp,
                  deltas,
                  toleranciaPx: TOLERANCIA_GEOMETRIA_PX,
                });

                /* CSS: computedStyle CDP no mesmo nó cruzado com winningRules
                   capturadas pelo núcleo. */
                const respostaCss = await adapters.CSS.getComputedStyleForNode({ nodeId: association.nodeId });
                const computedStyle = respostaCss.computedStyle || [];
                expect(auditRow.winningRules.error, 'captura de regras sem erro').toBeNull();
                for (const prop of PROPRIEDADES_CSS) {
                  const regra = auditRow.winningRules.properties[prop];
                  expect(regra, `regra ${prop} capturada`).toBeTruthy();
                  expect(regra.property, `nome da propriedade ${prop}`).toBe(prop);
                  expect(regra.captureStatus, `captureStatus ${prop}`).toBe('captured');
                  expect(regra.winningDeclaration, `declaração vencedora ${prop}`).toBeTruthy();
                  expect(regra.winningDeclaration.captureStatus, `captureStatus da declaração ${prop}`).toBe('captured');
                  expect(Array.isArray(regra.candidates) && regra.candidates.length > 0, `candidatos ${prop}`).toBe(true);
                  const direto = computedStyle.find((p) => p.name === prop);
                  expect(direto, `propriedade ${prop} no computedStyle CDP`).toBeTruthy();
                  const corCdp = parseColor(direto.value);
                  expect(corCdp, `valor CDP ${prop} parseável`).not.toBeNull();
                  let corRegra = parseColor(regra.computedValue);
                  if (!corRegra && regra.computedValue && regra.computedValue.includes('var(--accent)')) {
                    const variavel = computedStyle.find((p) => p.name === '--accent');
                    corRegra = parseColor(variavel && variavel.value);
                  }
                  expect(corRegra, `computedValue ${prop} parseável`).not.toBeNull();
                  expect(corRegra, `coerência núcleo/CDP ${prop}`).toEqual(corCdp);
                  css.push({
                    runId: collected.runId,
                    nodeId: association.nodeId,
                    prop,
                    computedValue: regra.computedValue,
                    cdpValue: direto.value,
                    selector: regra.winningDeclaration.selectorText,
                    captureStatus: regra.captureStatus,
                  });
                }
              }

              evidencias.push(auditRow);
            }

            rounds.push({
              runId: collected.runId,
              keys: collected.rows.map((r) => r.key),
              rows: collected.rows,
              nodeIds: Array.from(associationMap.values()).map((a) => a.nodeId),
              status: Array.from(associationMap.values()).map((a) => a.status),
              coletados: collected.rows.length,
              evidencias,
            });
          }

          /* G4.2-B — Z8: resolução cruzada real. Chave preservada da execução
             Y submetida à resolveNodeIds ORIGINAL com as linhas e o runId da
             execução Z, antes do cleanup que remove data-c4-audit. */
          const chaveAntigaY = rounds[0].rows[0].key;
          const linhaAntigaY = rounds[0].rows[0];
          const linhaZ = rounds[1].rows[0];
          const mapaZ8 = await historical.resolveNodeIds(
            adapters.DOM,
            [{ ...linhaZ, key: chaveAntigaY, sel: linhaAntigaY.sel }],
            cdpErrors,
            rounds[1].runId
          );
          const resZ8 = mapaZ8.get(chaveAntigaY);
          expect(resZ8, 'resultado da resolução cruzada').toBeTruthy();
          expect(resZ8.status, 'Z8 node-not-found').toBe('node-not-found');
          expect(resZ8.nodeId, 'Z8 nodeId null').toBeNull();
          expect(typeof resZ8.reason, 'Z8 reason string').toBe('string');
          expect(resZ8.reason.includes('outra execucao'), 'Z8 reason outra execucao').toBe(true);

          /* G4.2-A — V24: ocorrência de #r25-btn-1 via probeState do núcleo,
             exatamente como runProbe() no teste histórico R2.5.7. */
          const ocorrenciasV24 = await core.probeState(
            ALVO_V24, 'normal', 'mobile', 'light', '3', 'dash', createSampleIdRegistry()
          );
          expect(ocorrenciasV24.length, 'ocorrência V24 obtida').toBeGreaterThan(0);
          const occV24 = ocorrenciasV24[0];
          expect(occV24.ancestorOpacityStatus, 'V24 cadeia completa').toBe('complete');
          expect(occV24.ancestorOpacity, 'V24 opacidade acumulada 1').toBe(1);
          expect(occV24.ancestorVisibility, 'V24 travessia completa').toBe('completed');
          expect(occV24.geometryStatus, 'V24 geometria disponível').toBe('available');

          /* Erros CDP são registrados com estrutura; nenhum erro de DOM
             nos comandos usados por resolveNodeIds. */
          for (const erro of cdpErrors) {
            expect(erro && typeof erro === 'object', 'registro de erro estruturado').toBe(true);
            expect(erro.method, 'método do erro registrado').toBeTruthy();
          }
          expect(cdpErrors.filter((e) => /^DOM\.(getDocument|querySelectorAll)$/.test(e.method || '')).map((e) => e.method), 'DOM.getDocument/querySelectorAll sem erro')
            .toEqual([]);

          return {
            rounds,
            eventos: eventos.length,
            geometria,
            css,
            z8: {
              chaveAntiga: chaveAntigaY,
              runIdOrigem: rounds[0].runId,
              runIdDestino: rounds[1].runId,
              status: resZ8.status,
              nodeId: resZ8.nodeId,
              reason: resZ8.reason,
            },
            v24: {
              alvo: ALVO_V24,
              ancestorOpacityStatus: occV24.ancestorOpacityStatus,
              ancestorOpacity: occV24.ancestorOpacity,
              ancestorVisibility: occV24.ancestorVisibility,
              geometryStatus: occV24.geometryStatus,
              rect: occV24.rect,
            },
          };
        } finally {
          offConsole();
          offException();
          /* Limpeza das mutações temporárias do collectScript, ainda dentro
             da operação e antes do detach executado pelo helper. */
          await adapters.Runtime.evaluate({
            expression: `(()=>{document.querySelectorAll('[data-c4-audit]').forEach(e=>e.removeAttribute('data-c4-audit'));document.querySelectorAll('[data-c4-state]').forEach(e=>e.removeAttribute('data-c4-state'));document.getElementById('c4-audit-style')?.remove();return true})()`,
            returnByValue: true,
          });
        }
      },
    });

    /* Lifecycle integrado e ownership do Playwright. */
    expect(lifecycle.operationError, 'operação sem erro').toBeNull();
    expect(lifecycle.cleanupError, 'cleanup sem erro').toBeNull();
    expect(lifecycle.detachAttempts, 'detach exatamente uma vez').toBe(1);
    expect(lifecycle.detachSuccess, 'detach bem-sucedido').toBe(true);

    const out = lifecycle.result;
    const [y, z] = out.rounds;

    /* Isolamento entre execuções (grupos Y/Z). */
    expect(y.runId, 'runId da execução Y').toBeGreaterThan(0);
    expect(z.runId, 'runId da execução Z').toBe(y.runId + 1);
    const chavesY = new Set(y.keys);
    const chavesZ = new Set(z.keys);
    expect(chavesY.size, 'chaves únicas em Y').toBe(y.coletados);
    expect(chavesZ.size, 'chaves únicas em Z').toBe(z.coletados);
    expect(y.keys.some((k) => chavesZ.has(k)), 'nenhuma chave de Y reaparece em Z').toBe(false);
    expect(y.nodeIds.some((id) => typeof id !== 'number'), 'nodeIds de Y válidos').toBe(false);
    expect(z.nodeIds.some((id) => typeof id !== 'number'), 'nodeIds de Z válidos').toBe(false);
    expect(z.status.every((s) => s === 'resolved'), 'todas as associações de Z resolvidas').toBe(true);
    expect(z.evidencias.every((r) => r.nodeAssociation.key.startsWith(`c4-${z.runId}-`)), 'evidências pertencem à execução corrente').toBe(true);

    /* Campos semânticos da evidência construída pela função original. */
    expect(z.evidencias.length, 'evidências completas construídas').toBeGreaterThan(0);
    const first = z.evidencias[0];
    expect(first.screen, 'contexto screen preservado').toBe('dash');
    expect(first.vp, 'contexto viewport preservado').toBe('desktop');
    expect(first.nodeAssociation.status, 'associação na linha final').toBe('resolved');
    expect(typeof first.nodeAssociation.nodeId, 'nodeId na linha final').toBe('number');
    expect(first.winningRules, 'regras vencedoras capturadas').toBeTruthy();
    expect(first.winningRules.error, 'captura de regras sem erro').toBeNull();
    expect(first.winningRules.properties.color, 'propriedade color capturada').toBeTruthy();
    expect(first.winningRules.properties.color.captureStatus, 'status de captura real').toBeTruthy();
    expect(first.visibilityStatus, 'visibilidade classificada').toBeTruthy();
    expect(first.rect, 'geometria preservada').toBeTruthy();

    /* Comparação semântica com expectativas documentadas em
       c4-v05-b-r2-5-7-test.cjs (Y1, Y2, D1/V1, V24). */
    const semantica = compararSemantica(z.evidencias);
    expect(semantica.filter((r) => r.situacao === 'comparado').length, 'casos históricos comparados').toBe(4);
    expect(semantica.find((r) => r.caso === 'V24').situacao, 'V24 comparado no alvo #r25-btn-1').toBe('comparado');

    /* G4.2-A — V24 via probeState no alvo histórico. */
    expect(out.v24.alvo, 'alvo V24').toBe('#r25-btn-1');
    expect(out.v24.ancestorOpacityStatus, 'V24 complete').toBe('complete');
    expect(out.v24.ancestorOpacity, 'V24 opacidade 1').toBe(1);
    expect(out.v24.ancestorVisibility, 'V24 completed').toBe('completed');
    expect(out.v24.geometryStatus, 'V24 geometria available').toBe('available');

    /* G4.2-B — Z8: resolução cruzada efetiva, não mera distinção de chaves. */
    expect(out.z8.chaveAntiga.startsWith(`c4-${out.z8.runIdOrigem}-`), 'chave antiga pertence a Y').toBe(true);
    expect(out.z8.runIdDestino, 'runId destino é o de Z').toBe(z.runId);
    expect(out.z8.status, 'Z8 node-not-found').toBe('node-not-found');
    expect(out.z8.nodeId, 'Z8 nodeId null').toBeNull();
    expect(out.z8.reason.includes('outra execucao'), 'Z8 reason outra execucao').toBe(true);

    /* G4.2-C — geometria numérica nas duas execuções, mesmo elemento. */
    expect(out.geometria.length, 'comparações de geometria').toBe(out.rounds.length);
    expect(out.geometria.every((g) => g.nodeId > 0), 'nodeIds de geometria válidos').toBe(true);
    expect(out.geometria.every((g) => ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(g.deltas[k]) && g.deltas[k] <= g.toleranciaPx)), 'deltas dentro da tolerância').toBe(true);

    /* G4.2-D — CSS semântico: valores e declarações, não mera existência. */
    expect(out.css.length, 'comparações CSS').toBe(out.rounds.length * PROPRIEDADES_CSS.length);
    expect(out.css.every((c) => c.captureStatus === 'captured'), 'todas as capturas com sucesso').toBe(true);
    expect(out.css.every((c) => typeof c.cdpValue === 'string' && c.cdpValue.length > 0), 'valores CDP não vazios').toBe(true);
    expect(out.css.every((c) => typeof c.selector === 'string' && c.selector.length > 0), 'declarações vencedoras com seletor').toBe(true);

    /* Estado após encerramento. */
    const residuo = await page.evaluate(() =>
      document.querySelectorAll('[data-c4-audit],[data-c4-state]').length
    );
    expect(residuo, 'nenhuma mutação temporária residual').toBe(0);
    await expect(page.locator('body'), 'página funcional após detach').toBeVisible();

    const diag = {
      prova: 'C.4-G4.2-paridade-r257-playwright',
      funcoes_originais: ['collectScript', 'resolveNodeIds', 'buildAuditRow', 'probeState', 'rectFromBorder'],
      comandos_cdp_reais: [
        'Runtime.evaluate',
        'DOM.getDocument',
        'DOM.querySelectorAll',
        'DOM.getBoxModel',
        'CSS.getMatchedStylesForNode',
        'CSS.getComputedStyleForNode',
      ],
      execucoes: out.rounds.length,
      run_ids: out.rounds.map((r) => r.runId),
      coletados_por_execucao: out.rounds.map((r) => r.coletados),
      evidencias_por_execucao: out.rounds.map((r) => r.evidencias.length),
      comparacao_semantica: semantica,
      v24: out.v24,
      z8: out.z8,
      geometria: out.geometria,
      css: out.css,
      detach_attempts: lifecycle.detachAttempts,
      detach_success: lifecycle.detachSuccess,
      node_version: process.version,
    };
    await testInfo.attach('c4-g42-paridade.json', {
      body: JSON.stringify(diag, null, 2),
      contentType: 'application/json',
    }).catch(() => {});
    console.log('[C4_DIAGNOSTIC]', JSON.stringify(diag));
  });
});

test.describe('C.4 — G4.1-R1: rastreabilidade individual das 393 asserções R2.5.7', () => {
  const RESULTADOS = require('./original/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-results.json');

  /* Decisões EXPLÍCITAS por asserção, chaveadas por id + nome exato do JSON
     histórico. Nenhuma classificação é inferida por similaridade de texto.
     Cada entrada registra o critério histórico e a evidência real da prova
     integrada G4.1 (comparação semântica do describe anterior). */
  const DECISOES = new Map([
    /* Y1 — alvo histórico r256-accent-consumer. */
    ['Y1::a associacao key->nodeId foi resolvida pelo fluxo real', { situacao: 'covered', criterio: 'assoc.nodeId !== null', evidencia: 'nodeId numérico > 0 na associação resolvida' }],
    ['Y1::a travessia da linha real foi concluida ate a raiz', { situacao: 'covered', criterio: "finalRow.ancestorVisibility === 'completed'", evidencia: "comparação semântica ancestorVisibility === 'completed'" }],
    ['Y1::travessia completa e opacidade completa produzem visible na linha da coleta', { situacao: 'covered', criterio: "finalRow.visibilityStatus === 'visible'", evidencia: "comparação semântica visibilityStatus === 'visible'" }],
    ['Y1::a linha final preserva a associacao resolvida', { situacao: 'covered', criterio: "finalRow.nodeAssociation.status === 'resolved'", evidencia: "comparação semântica nodeAssociation.status === 'resolved'" }],
    ['Y1::a travessia foi executada pelo mecanismo do nucleo compartilhado', { situacao: 'partial', criterio: 'traverseCalls === 1', evidencia: 'valor final comparado; espionagem de core.traverseAncestorChain não executada' }],
    ['Y1::o campo ancestorOpacity da linha final vem do resultado do nucleo', { situacao: 'partial', criterio: 'finalRow.ancestorOpacity === lastTraversal.ancestorOpacity', evidencia: 'valor comparado; origem lastTraversal não demonstrada' }],
    ['Y1::o campo ancestorHidden da linha final vem do resultado do nucleo', { situacao: 'partial', criterio: 'finalRow.ancestorHidden === lastTraversal.ancestorHidden', evidencia: 'valor comparado; origem lastTraversal não demonstrada' }],
    ['Y1::o campo ancestorDisplayNone da linha final vem do resultado do nucleo', { situacao: 'partial', criterio: 'finalRow.ancestorDisplayNone === lastTraversal.ancestorDisplayNone', evidencia: 'campo não comparado na prova integrada' }],
    ['Y1::o campo ancestorDepth da linha final vem do resultado do nucleo', { situacao: 'partial', criterio: 'finalRow.ancestorDepth === lastTraversal.ancestorDepth', evidencia: 'campo não comparado na prova integrada' }],
    ['Y1::a opacidade da linha real foi acumulada de forma completa', { situacao: 'covered', criterio: "finalRow.ancestorOpacityStatus === 'complete'", evidencia: "comparação semântica ancestorOpacityStatus === 'complete' no mesmo alvo Y1" }],

    /* Y2 — alvo histórico r256-accent-opacity0-child. */
    ['Y2::a opacidade zero do ancestral chegou a linha final pelo mecanismo', { situacao: 'covered', criterio: 'finalRow.ancestorOpacity === 0', evidencia: 'comparação semântica ancestorOpacity === 0 no mesmo alvo Y2' }],
    ['Y2::a opacidade zero e conclusiva na linha final', { situacao: 'covered', criterio: "finalRow.ancestorOpacityStatus === 'conclusive-zero'", evidencia: "comparação semântica ancestorOpacityStatus === 'conclusive-zero'" }],
    ['Y2::a opacidade zero comprovada produz not-visible na linha da coleta', { situacao: 'covered', criterio: "finalRow.visibilityStatus === 'not-visible'", evidencia: "comparação semântica visibilityStatus === 'not-visible'" }],
    ['Y2::a linha com opacidade zero nunca e declarada visible', { situacao: 'covered', criterio: "finalRow.visibilityStatus !== 'visible'", evidencia: "comparação semântica visibilityStatus === 'not-visible' exclui 'visible'" }],

    /* D1 — alvo histórico #r25-btn-1. */
    ['D1::elemento visível tem visibilityStatus visible', { situacao: 'covered', criterio: "occ.visibilityStatus === 'visible'", evidencia: "comparação semântica visibilityStatus === 'visible' no alvo #r25-btn-1" }],
    ['D1::elemento visível tem geometryStatus available', { situacao: 'covered', criterio: "occ.geometryStatus === 'available'", evidencia: 'G4.2: probeState em #r25-btn-1 retornou geometryStatus available' }],
    ['D1::rect disponível para elemento visível', { situacao: 'covered', criterio: 'occ.rect !== null', evidencia: 'rect truthy via buildAuditRow/collectScript no alvo #r25-btn-1 (não probeState)' }],

    /* V24 — alvo histórico #r25-btn-1, comprovado em G4.2 via probeState
       e via evidência integrada buildAuditRow; nada transferido de Y1. */
    ['V24::cadeia completa de opacidade resulta em complete', { situacao: 'covered', criterio: "occ.ancestorOpacityStatus === 'complete'", evidencia: 'G4.2: probeState em #r25-btn-1 + comparação no alvo' }],
    ['V24::a opacidade completa acumulada é 1', { situacao: 'covered', criterio: 'occ.ancestorOpacity === 1 no alvo #r25-btn-1', evidencia: 'G4.2: probeState em #r25-btn-1 + comparação no alvo' }],
    ['V24::a travessia completa resulta em completed', { situacao: 'covered', criterio: "occ.ancestorVisibility === 'completed' no alvo #r25-btn-1", evidencia: 'G4.2: probeState em #r25-btn-1 + comparação no alvo' }],

    /* B2 — resolução de ID. */
    ['B2::1 ID resulta em resolved', { situacao: 'covered', criterio: "result.status === 'resolved'", evidencia: 'nodeAssociation.status === resolved demonstrado na resolução com uma chave' }],
    ['B2::idCount é 1', { situacao: 'partial', criterio: 'result.idCount === 1', evidencia: 'cardinalidade do mapa de associações verificada; campo idCount não lido' }],

    /* Regras de composição e isolamento. */
    ['V1::ancestral visible e descendente visible → visível', { situacao: 'partial', criterio: 'composição ancestral/descendente', evidencia: 'resultado final visível observado; regra de composição não exercitada diretamente' }],
    ['Z8::chave antiga de outra execucao nao e resolvida na execucao atual', { situacao: 'covered', criterio: "resolveNodeIds(chave antiga, runId novo).status === 'node-not-found'", evidencia: 'G4.2: resolução cruzada real com node-not-found, nodeId null e reason "outra execucao"' }],
  ]);

  function classificar(teste) {
    if (teste.status === 'BLOCKED') return 'blocked';
    const decisao = DECISOES.get(`${teste.id}::${teste.name}`);
    return decisao ? decisao.situacao : 'preserved-not-ported';
  }

  test('deriva 393 asserções, 134 IDs e classifica cada asserção individualmente', () => {
    const testes = RESULTADOS.tests;
    expect(testes.length, '393 registros históricos').toBe(393);
    expect(new Set(testes.map((t) => t.id)).size, '134 IDs distintos').toBe(134);
    expect(RESULTADOS.summary, 'resumo histórico').toEqual({ total: 393, passed: 392, failed: 0, blocked: 1 });
    expect(testes.filter((t) => t.status === 'PASS').length, '392 PASS').toBe(392);
    expect(testes.filter((t) => t.status === 'FAIL').length, '0 FAIL').toBe(0);
    expect(testes.filter((t) => t.status === 'BLOCKED').map((t) => t.id), 'único bloqueio V32').toEqual(['V32']);

    const DISTRIBUICAO = { A: 16, B: 17, C: 21, D: 27, V: 164, P: 19, R: 12, E: 7, F: 11, G: 11, H: 4, X: 21, Y: 30, Z: 33 };
    const porGrupo = {};
    for (const t of testes) porGrupo[t.group] = (porGrupo[t.group] || 0) + 1;
    expect(porGrupo, 'distribuição original por grupo preservada').toEqual(DISTRIBUICAO);

    const situacoes = {};
    const detalhePorGrupo = {};
    for (const teste of testes) {
      const situacao = classificar(teste);
      situacoes[situacao] = (situacoes[situacao] || 0) + 1;
      detalhePorGrupo[teste.group] = detalhePorGrupo[teste.group] || {};
      detalhePorGrupo[teste.group][situacao] = (detalhePorGrupo[teste.group][situacao] || 0) + 1;
    }

    /* Toda decisão explícita aponta para uma asserção existente no JSON;
       nomes trocados não podem passar despercebidos. */
    const chavesHistoricas = new Set(testes.map((t) => `${t.id}::${t.name}`));
    for (const chave of DECISOES.keys()) {
      expect(chavesHistoricas.has(chave), `decisão histórica existe: ${chave}`).toBe(true);
    }

    const situacaoDe = (id, nome) => classificar(testes.find((t) => t.id === id && t.name === nome));

    /* Correções G4.1-R2 — classificações excessivamente otimistas. */
    expect(situacaoDe('B2', 'idCount é 1'), 'B2 idCount não pode ser covered sem validar idCount').not.toBe('covered');
    expect(situacaoDe('B2', 'idCount é 1'), 'B2 idCount reclassificada como partial').toBe('partial');
    /* G4.2 — reclassificações sustentadas por nova prova executada. */
    expect(situacaoDe('V24', 'cadeia completa de opacidade resulta em complete'), 'V24 cadeia no alvo #r25-btn-1').toBe('covered');
    expect(situacaoDe('V24', 'a opacidade completa acumulada é 1'), 'V24 opacidade no alvo #r25-btn-1').toBe('covered');
    expect(situacaoDe('V24', 'a travessia completa resulta em completed'), 'V24 travessia no alvo #r25-btn-1').toBe('covered');
    expect(situacaoDe('Z8', 'chave antiga de outra execucao nao e resolvida na execucao atual'), 'Z8 com resolução cruzada real').toBe('covered');
    expect(DECISOES.get('Z8::chave antiga de outra execucao nao e resolvida na execucao atual').evidencia.includes('resolução cruzada real'), 'Z8 com evidência de resolução cruzada').toBe(true);

    /* Falsos negativos corrigidos na revisão completa da lógica: critério
       histórico demonstrado no MESMO alvo da asserção. */
    expect(situacaoDe('Y1', 'a opacidade da linha real foi acumulada de forma completa'), 'Y1 opacidade comparada no alvo correto').toBe('covered');
    expect(situacaoDe('Y2', 'a opacidade zero do ancestral chegou a linha final pelo mecanismo'), 'Y2 opacidade zero comparada no alvo correto').toBe('covered');
    expect(situacaoDe('D1', 'rect disponível para elemento visível'), 'D1 rect comparado no alvo correto').toBe('covered');
    expect(situacaoDe('D1', 'elemento visível tem geometryStatus available'), 'D1 geometryStatus via probeState').toBe('covered');

    /* V32 permanece bloqueado individualmente. */
    const v32 = testes.find((t) => t.id === 'V32' && t.status === 'BLOCKED');
    expect(v32, 'V32 bloqueado presente').toBeTruthy();
    expect(classificar(v32), 'V32 classificado como blocked').toBe('blocked');

    expect(Object.values(situacoes).reduce((a, b) => a + b, 0), 'todas as asserções classificadas').toBe(393);
    expect(situacoes, 'contagens finais G4.2').toEqual({
      covered: 17,
      partial: 7,
      'preserved-not-ported': 368,
      blocked: 1,
    });

    /* Nenhum grupo pode ser integralmente "covered": a prova é representativa. */
    for (const [grupo, dist] of Object.entries(detalhePorGrupo)) {
      const total = Object.values(dist).reduce((a, b) => a + b, 0);
      expect((dist.covered || 0) < total, `grupo ${grupo} não integralmente coberto`).toBe(true);
    }

    console.log('[C4_DIAGNOSTIC]', JSON.stringify({
      prova: 'C.4-G4.2-rastreabilidade',
      registros: testes.length,
      ids_distintos: new Set(testes.map((t) => t.id)).size,
      situacoes,
      grupos: Object.keys(detalhePorGrupo).length,
      bloqueio: 'V32',
    }));
  });
});
