'use strict';

/* C.O.D.E. — G3.1-D: helper compartilhado de ciclo de vida da CDPSession.
   Centraliza criação única (context.newCDPSession), execução da operação e
   detach único, preservando operationError e cleanupError independentes.
   Ownership exclusivo do Playwright: o adaptador não encerra a sessão. */

async function runWithCdpSession({
  context,
  page,
  testInfo,
  operation,
}) {
  if (!context) {
    throw new Error('runWithCdpSession: context é obrigatório');
  }
  if (!page) {
    throw new Error('runWithCdpSession: page é obrigatório');
  }
  if (typeof operation !== 'function') {
    throw new TypeError('runWithCdpSession: operation deve ser uma função');
  }

  const session = await context.newCDPSession(page);

  let operationError = null;
  let cleanupError = null;
  let result = null;
  let detachAttempts = 0;
  let detachStart = null;
  let detachEnd = null;

  const operationStart = Date.now();
  try {
    result = await operation({ session });
  } catch (err) {
    operationError = err;
  } finally {
    detachStart = Date.now();
    detachAttempts += 1;
    try {
      await session.detach();
    } catch (err) {
      cleanupError = err;
    }
    detachEnd = Date.now();
  }

  return {
    session,
    result,
    operationError,
    cleanupError,
    detachAttempts,
    operationStart,
    operationEnd: detachEnd,
    operationDuration: detachEnd - operationStart,
    detachStart,
    detachEnd,
    detachDuration: detachEnd - detachStart,
    detachSuccess: cleanupError === null,
  };
}

module.exports = { runWithCdpSession };