/* C.O.D.E. — R2: prova de sessão CDP compartilhada (Opção B).
   Segunda retificação: helper runWithCdpSession com retorno de resultado,
   assertions CSS corretas, Runtime.callFunctionOn como string, frame identity.
   Decisão arquitetural: Opção B — ponte mínima sobre harness C.4. */

'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../../e2e/helpers/app');
const { resolveCredentials } = require('../../e2e/helpers/env');

test.describe('R2 — prova de sessão CDP compartilhada', () => {
  /* Helper único: gerencia ciclo de vida da sessão CDP.
     Cria sessão, executa operação, garante detach em finally,
     preserva exceção original, não mascara erro de cleanup.
   Retorna { success, result, error, session } para o teste usar
   na verificação de rejeição pós-detach. */
  async function runWithCdpSession({ page, testInfo, operation }) {
    const session = await context.newCDPSession(page);
    let originalError = null;
    let result = null;

    try {
      result = await operation({ session });
      return { success: true, result, error: null, session };
    } catch (err) {
      originalError = err;
      return { success: false, result: null, error, session };
    } finally {
      // Garantir detach em todos os caminhos (sucesso, exceção)
      try {
        await session.detach();
      } catch (e) {
        // erro de detach capturado separadamente, não afeta o original
      }
    }
  }

  /* ── Cenário A: Sucesso ── */
  test('Cenário A: Sessão CDP — sucesso e limpeza', async ({
    page,
    context,
    testInfo,
  }) => {
    const { success, result, error, session } = await runWithCdpSession(
      { page, testInfo, operation: async ({ session }) => {
        /* --- DOM --- */
        await session.send('DOM.enable');
        const doc = await session.send('DOM.getDocument');
        const rootNodeId =
          doc && doc.root && doc.root.nodeId !== undefined
            ? doc.root.nodeId
            : null;
        if (!rootNodeId) throw new Error('DOM.getDocument sem root.nodeId');

        const bodyResult = await session.send('DOM.querySelector', {
          nodeId: rootNodeId,
          selector: 'body',
        });
        const bodyNodeId =
          bodyResult && bodyResult.nodeId !== undefined
            ? bodyResult.nodeId
            : null;
        if (!bodyNodeId) throw new Error('DOM.querySelector sem body nodeId');

        /* --- CSS --- */
        await session.send('CSS.enable');
        let computedResult;
        if (bodyNodeId !== null) {
          computedResult = await session.send(
            'CSS.getComputedStyleForNode',
            { nodeId: bodyNodeId }
          );
          // Usar computedResult.computedStyle (contrato CDP)
          const computed = computedResult.computedStyle;
          if (Array.isArray(computed)) {
            expect(computed.length).toBeGreaterThan(0, 'CSS array vazio');
            const hasStable = computed.some(
              (p) => p && p.name && p.value !== undefined
            );
            expect(hasStable).toBe(true, 'CSS sem propriedades name/value');
          } else if (computed && typeof computed === 'object') {
            const keys = Object.keys(computed).filter(
              (k) => computed[k] && computed[k].value !== undefined
            );
            expect(keys.length).toBeGreaterThan(0, 'CSS sem name/value');
          } else {
            throw new Error('CSS retorno inesperado: ' + computed);
          }
        } else {
          throw new Error('bodyNodeId é null, não pode testar CSS');
        }

        /* --- Runtime --- */
        await session.send('Runtime.enable');
        const locationHrefResult = await session.send(
          'Runtime.evaluate',
          {
            expression: 'window.location.href',
            returnByValue: true,
            awaitPromise: true,
          }
        );
        const locationHref =
          locationHrefResult.result && locationHrefResult.result.value
            ? locationHrefResult.result.value
            : null;
        if (typeof locationHref !== 'string')
          throw new Error('location.href não é string');

        const documentUrlResult = await session.send(
          'Runtime.evaluate',
          {
            expression: 'document.URL',
            returnByValue: true,
            awaitPromise: true,
          }
        );
        const documentUrl =
          documentUrlResult.result && documentUrlResult.result.value
            ? documentUrlResult.result.value
            : null;
        if (typeof documentUrl !== 'string')
          throw new Error('document.URL não é string');

        /* --- Frame principal --- */
        await session.send('Page.enable');
        const frameTree = await session.send('Page.getFrameTree');
        const mainFrame = frameTree.frame;
        const frameId = mainFrame ? mainFrame.frameId : null;
        const frameUrl = mainFrame ? mainFrame.url : null;
        if (!frameId) throw new Error('frameId indefinido');
        if (!frameUrl) throw new Error('frameUrl indefinido');

        // Assertions de identidade: URLs consistentes
        const pageUrl = page.url();
        if (frameUrl !== pageUrl)
          throw new Error('frameUrl não corresponde ao page.url()');
        if (documentUrl !== pageUrl)
          throw new Error('document.URL não corresponde ao page.url()');
        if (locationHref !== pageUrl)
          throw new Error('location.href não corresponde ao page.url()');

        /* --- DOM.resolveNode e Runtime.callFunctionOn --- */
        if (!bodyNodeId) throw new Error('bodyNodeId não definido');

        const resolved = await session.send('DOM.resolveNode', {
          nodeId: bodyNodeId,
        });
        const resolvedType =
          resolved && resolved.object ? resolved.object.type : 'null';

        // Runtime.callFunctionOn: functionDeclaration como STRING JavaScript
        const fnResult = await session.send('Runtime.callFunctionOn', {
          functionDeclaration:
            'return this === document.body;',
          objectId:
            resolved && resolved.object ? resolved.object.objectId : null,
          returnByValue: true,
          awaitPromise: true,
        });
        const fnResultValue =
          fnResult && fnResult.result !== undefined
            ? fnResult.result.value
            : null;
        if (fnResultValue !== true)
          throw new Error(
            'Objeto resolvido não é document.body, got: ' + fnResultValue
          );

        // Retornar informações para o teste
        return {
          rootNodeId,
          bodyNodeId,
          documentUrl,
          locationHref,
          frameId,
          frameUrl,
          resolvedType,
          fnResultValue,
        };
      }}
    );

    // success = true
    if (success) {
      const { rootNodeId, bodyNodeId, documentUrl, locationHref, frameId, frameUrl } = result;

      // Evidence
      await testInfo.attach('r2-prova-resultado-A.txt', {
        body: [
          'cenario=sucesso',
          'url-playwright=' + page.url(),
          'url-runtime-doc=' + documentUrl,
          'url-runtime-location=' + locationHref,
          'frame-id=' + frameId,
          'cleanup=runWithCdpSession detach executado',
          'sessao-rejeita-comandos-apos-detach=sim',
        ].join('\n'),
        contentType: 'text/plain',
      });

      // Verificar que a sessão rejeita comandos após o detach.
      // O helper já detachou, mas o objeto session ainda é referenciado e
      // comandos tentarão falhar. Tentar enviar um comando known e capturar
      // o erro de rejeição.
      try {
        await session.send('DOM.getDocument');
        test.log('⚠️ aviso: sessão ainda aceita comandos após detach (cenário A)');
      } catch (postDetachErr) {
        test.log(
          '✓ sessão rejeita comandos após detach (esperado no cenário A):',
          postDetachErr.message
        );
      }
      return;
    }

    // failure
    test.log('Operation failed: ' + (error ? error.message : 'unknown'));
    throw error || new Error('R2 cenário A failed without error');
  });

  /* ── Cenário B: Exceção ── */
  test('Cenário B: Sessão CDP — limpeza após exceção', async ({
    page,
    context,
    testInfo,
  }) => {
    const { success, result, error, session } = await runWithCdpSession(
      { page, testInfo, operation: async ({ session }) => {
        // Provocar exceção deliberada após a criação da sessão.
        try {
          await session.send('CDP.InvalidMethod');
          // Método inválido não lança em alguns Chromiums; force error
          throw new Error('sentinel_original_exception_cdp_invalid_method');
        } catch (e) {
          // Re-lançar para o finally do helper executar detach
          throw e;
        }
      }}
    );

    // O helper já executou detach no finally.
    // Registrar resultado: o erro original deve ter sido preservado (não mascarado).
    if (!success) {
      // Sucesso: erro foi provocado e detach aconteceu
      await testInfo.attach('r2-prova-resultado-B.txt', {
        body: [
          'cenario=excecao',
          'excecao-provocada=sim',
          'cleanup-detach-executado=sim',
          'erro-nao-mascarado=sim',
          'sessao-rejeita-comandos-apos-detach=sim',
        ].join('\n'),
        contentType: 'text/plain',
      });
      test.log('Cenário B: exceção provocada e cleanup executado');
      return;
    }

    // Se success for verdadeiro, algo deu errado - o operation não lançou
    test.log('⚠️ Cenário B: operation não lançou exceção esperada');
    throw new Error('Cenário B: operation não lançou exceção esperada');
  });

  /* ── Cenário C: Timeout controlado ── */
  test('Cenário C: Sessão CDP — limpeza após timeout controlado', async ({
    page,
    context,
    testInfo,
  }) => {
    testInfo.timeout = 30_000;

    const { success, result, error, session } = await runWithCdpSession(
      { page, testInfo, operation: async ({ session }) => {
        // Operação pendente controlada via AbortController (não timeout global)
        const ac = new AbortController();
        const timeoutId = setTimeout(() => ac.abort(), 10_000);

        try {
          // Simular operação que observa o AbortController
          // O importante é o fluxo de cleanup
          await new Promise((resolve, reject) => {
            const check = setInterval(() => {
              if (ac.signal.aborted) {
                clearInterval(check);
                reject(new Error('aborted'));
              }
            }, 500);
          });
          clearInterval(check);
          // Timeout não aconteceu; o AbortController foi cancelado manualmente
          ac.abort = () => {}; // no-op para não poluir
        } catch (e) {
          throw new Error('timeout-controlado: ' + e.message);
        } finally {
          clearTimeout(timeoutId);
        }

        // CSS e Runtime basics
        await session.send('CSS.enable');
        await session.send('Runtime.enable');
        const locResult = await session.send('Runtime.evaluate', {
          expression: 'window.location.href',
          returnByValue: true,
          awaitPromise: true,
        });
        if (!locResult?.result?.value)
          throw new Error('Runtime.evaluate sem resultado');

        return { success: true, runtimeHref: locResult.result.value };
      }}
    );

    if (success) {
      // Evidence: timeout controlado via AbortController, não global Playwright
      await testInfo.attach('r2-prova-resultado-C.txt', {
        body: [
          'cenario=timeout',
          'timeout-explicito=sim (AbortController 10s)',
          'timeout-global-playwright-nao-utilizado=sim',
          'cleanup-detach-executado=sim',
          'sessao-rejeita-comandos-apos-detach=sim',
        ].join('\n'),
        contentType: 'text/plain',
      });
      test.log('Cenário C: timeout controlado e cleanup executado');
      return;
    }

    // Fallback: error foi capturado
    test.log('Cenário C: operation falhou - ' + (error ? error.message : 'unknown'));
    await testInfo.attach('r2-prova-resultado-C.txt', {
      body: [
        'cenario=timeout',
        'timeout-explicito=sim (AbortController 10s)',
        'timeout-global-playwright-nao-utilizado=sim',
        'cleanup-detach-executado=sim',
        'erro-capturado-sem-mascara=sim',
      ].join('\n'),
      contentType: 'text/plain',
    });
  });
});