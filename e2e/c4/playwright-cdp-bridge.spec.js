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
const { createCDPAuditCore, createSampleIdRegistry } = require('./original/docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs');

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

    /* Sessão CDP criada exclusivamente pelo Playwright */
    const session = await context.newCDPSession(page);
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

    let detachCount = 0;
    let operationError = null;
    let cleanupError = null;
    let occurrences = null;

    try {
      await adapters.DOM.enable();
      await adapters.CSS.enable();
      await adapters.Runtime.enable();

      occurrences = await core.probeState(
        SELECTOR_SINTETICO,
        'normal',
        'desktop',
        'light',
        '1',
        'dash',
        sampleIdRegistry
      );
    } catch (err) {
      operationError = err;
    } finally {
      try {
        await session.detach();
        detachCount += 1;
      } catch (detachErr) {
        cleanupError = detachErr;
      }
    }

    /* Validações da prova vertical */
    expect(operationError, 'operação principal sem erro').toBeNull();
    expect(cleanupError, 'detach sem erro').toBeNull();
    expect(detachCount, 'detach exatamente uma vez').toBe(1);
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
      detach_count: detachCount,
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
