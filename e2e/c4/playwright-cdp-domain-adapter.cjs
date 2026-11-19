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
     const doc = await adapters.DOM.getDocument({ depth: -1, pierce: true }); */

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

module.exports = { createDomainAdapters };
