'use strict';

/* C.O.D.E. — FASE 2: adaptador de domínios CDP para a prova vertical C.4.
   Proxies finos para os domínios DOM, CSS e Runtime.

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
  };

  return { DOM, CSS, Runtime };
}

module.exports = { createDomainAdapters };
