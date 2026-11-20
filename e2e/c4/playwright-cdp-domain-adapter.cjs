'use strict';

/* C.O.D.E. — FASE 2: adaptador de domínios CDP para a prova vertical C.4.
   Proxies finos para os domínios DOM, CSS, Runtime, Page e Emulation.

   Contrato:
     - Cada método encaminha os parâmetros para session.send('Domain.method', params);
     - Não cria conexão CDP própria;
     - Não abre Chromium;
     - Não usa chrome-remote-interface para conectar à porta 9222;
     - A sessão é sempre a CDPSession criada pelo próprio Playwright
       (context.newCDPSession(page)).

   Uso:
     const session = await context.newCDPSession(page);
     const adapters = createDomainAdapters(session);
     await adapters.DOM.enable();
     const doc = await adapters.DOM.getDocument({ depth: -1, pierce: true });

     Bootstrap do contrato G3.1-C (harness R2.5.7 ↔ Playwright), com injeção
     explícita de domínios e sem conexão CRI própria:
     const { adapters, core } = createPlaywrightBootstrap(session, { createCore });
     // createCore = createCDPAuditCore do núcleo R2.5.6; CDP vem null
     // porque o núcleo não consome o parâmetro (assinatura legada
     // preservada por compatibilidade). */

function createDomainAdapters(session) {
  if (!session || typeof session.send !== 'function') {
    throw new Error('createDomainAdapters: session CDP do Playwright é obrigatória');
  }

  const forward = (domain, method) => {
    const fullMethod = `${domain}.${method}`;
    return (params) => session.send(fullMethod, params);
  };

  const subscribe = (eventName, listener) => {
    if (typeof session.on !== 'function') {
      throw new Error(`createDomainAdapters: sessão CDP do Playwright não oferece API de eventos (session.on) para "${eventName}"`);
    }
    if (typeof listener !== 'function') {
      throw new TypeError(`createDomainAdapters: listener de "${eventName}" deve ser uma função`);
    }
    session.on(eventName, listener);
    let removido = false;
    return () => {
      if (removido) return;
      removido = true;
      if (typeof session.off === 'function') {
        session.off(eventName, listener);
      } else if (typeof session.removeListener === 'function') {
        session.removeListener(eventName, listener);
      } else {
        throw new Error(`createDomainAdapters: sessão CDP do Playwright não oferece API de remoção de eventos (session.off/session.removeListener) para "${eventName}"`);
      }
    };
  };

  const DOM = {
    enable: forward('DOM', 'enable'),
    getDocument: forward('DOM', 'getDocument'),
    querySelector: forward('DOM', 'querySelector'),
    querySelectorAll: forward('DOM', 'querySelectorAll'),
    describeNode: forward('DOM', 'describeNode'),
    resolveNode: forward('DOM', 'resolveNode'),
    getBoxModel: forward('DOM', 'getBoxModel'),
    getAttributes: forward('DOM', 'getAttributes'),
    requestNode: forward('DOM', 'requestNode'),
  };

  const CSS = {
    enable: forward('CSS', 'enable'),
    getMatchedStylesForNode: forward('CSS', 'getMatchedStylesForNode'),
    getComputedStyleForNode: forward('CSS', 'getComputedStyleForNode'),
    forcePseudoState: forward('CSS', 'forcePseudoState'),
  };

  const Runtime = {
    enable: forward('Runtime', 'enable'),
    evaluate: forward('Runtime', 'evaluate'),
    callFunctionOn: forward('Runtime', 'callFunctionOn'),
    consoleAPICalled: (listener) => subscribe('Runtime.consoleAPICalled', listener),
    exceptionThrown: (listener) => subscribe('Runtime.exceptionThrown', listener),
  };

  const Page = {
    enable: forward('Page', 'enable'),
    navigate: forward('Page', 'navigate'),
  };

  const Emulation = {
    setDeviceMetricsOverride: forward('Emulation', 'setDeviceMetricsOverride'),
    setTouchEmulationEnabled: forward('Emulation', 'setTouchEmulationEnabled'),
  };

  return { DOM, CSS, Runtime, Page, Emulation };
}

function createPlaywrightBootstrap(session, options) {
  const opts = options || {};
  if (typeof opts.createCore !== 'function') {
    throw new Error('createPlaywrightBootstrap: createCore (createCDPAuditCore do núcleo R2.5.6) é obrigatória');
  }

  const adapters = createDomainAdapters(session);
  const consoleErrors = opts.consoleErrors || [];
  const exceptions = opts.exceptions || [];
  const cdpErrors = opts.cdpErrors || [];

  /* CDP: null — o núcleo R2.5.6 não consome o parâmetro CDP; ele existe
     apenas por compatibilidade com a assinatura do bootstrap legado
     (chrome-remote-interface, porta 9222). */
  const core = opts.createCore({
    CDP: null,
    DOM: adapters.DOM,
    CSS: adapters.CSS,
    Runtime: adapters.Runtime,
    consoleErrors,
    exceptions,
    cdpErrors,
  });

  return { session, adapters, core, consoleErrors, exceptions, cdpErrors };
}

module.exports = { createDomainAdapters, createPlaywrightBootstrap };
