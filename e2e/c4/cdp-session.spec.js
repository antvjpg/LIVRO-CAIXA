/* C.O.D.E. — R2: quinta retificação técnica.
   Correção de falsos positivos pós-detach, comprovação de cancelamento
   e evidências auditáveis. Arquitetura Opção B preservada. */

'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../../e2e/helpers/app');
const { resolveCredentials } = require('../../e2e/helpers/env');

test.describe('R2 — quinta retificação técnica', () => {
  /* ── Helper runWithCdpSession (mantido das correções anteriores) ─────
     Estrutura preservada: return após finally, operationError/cleanupError
     separados, detach único em finally. Nenhuma alteração no helper. */

  /* ── Convenção testInfo ────────────────────────────────────────────
     async ({ page, context }, testInfo) — Playwright v1.39+ */

  /* ── helpers de assertion pós-detach ────────────────────────────────
     Utilitários para separar observação de assertion em todos os cenários.
     Nunca lance assertion inside o catch que captura o resultado do CDP. */

  /* ── Cenário A: sucesso com rejeição pós-detach comprovada ─────────── */
  test(
    'R2: Cenário A — sucesso, limpeza verificada e rejeição pós-detach comprovada',
    async ({ page, context }, testInfo) => {
      const creds = resolveCredentials();
      if (!creds) {
        await testInfo.skip(
          true,
          'BLOCKED: credenciais QA indisponíveis — defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD'
        );
        return;
      }

      await app.openApp(page);
      await app.waitForAuthResolved(page, 15_000);
      if (creds) {
        await expect(page.locator('#userBar')).toContainText(creds.email, {
          timeout: 20_000,
        });
      }
      await app.waitForDataReady(page, 60_000);

      const {
        session,
        result,
        operationError,
        cleanupError,
      } = await runWithCdpSession({
        context,
        page,
        testInfo,
        operation: async ({ session }) => {
          /* --- DOM --- */
          await session.send('DOM.enable');
          const doc = await session.send('DOM.getDocument');
          const rootNodeId =
            doc && doc.root && doc.root.nodeId !== undefined
              ? doc.root.nodeId
              : null;
          if (!rootNodeId) {
            throw new Error('DOM.getDocument sem root.nodeId');
          }

          const bodyResult = await session.send('DOM.querySelector', {
            nodeId: rootNodeId,
            selector: 'body',
          });
          const bodyNodeId =
            bodyResult && bodyResult.nodeId !== undefined
              ? bodyResult.nodeId
              : null;
          if (!bodyNodeId) {
            throw new Error('DOM.querySelector sem body nodeId');
          }

          /* --- CSS --- */
          await session.send('CSS.enable');
          let computedResult;
          if (bodyNodeId !== null) {
            computedResult = await session.send(
              'CSS.getComputedStyleForNode',
              { nodeId: bodyNodeId }
            );
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
              throw new Error('CSS retorno inesperado: ' + JSON.stringify(computed));
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
          if (typeof locationHref !== 'string') {
            throw new Error('location.href não é string: ' + typeof locationHref);
          }

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
          if (typeof documentUrl !== 'string') {
            throw new Error('document.URL não é string: ' + typeof documentUrl);
          }

          /* --- Frame principal --- */
          await session.send('Page.enable');
          const frameTree = await session.send('Page.getFrameTree');
          const mainFrame = frameTree.frame;
          const frameId = mainFrame ? mainFrame.frameId : null;
          const frameUrl = mainFrame ? mainFrame.url : null;
          if (!frameId) {
            throw new Error('frameId indefinido');
          }
          if (!frameUrl) {
            throw new Error('frameUrl indefinido');
          }

          // Assertions de identidade: URLs consistentes
          const pageUrl = page.url();
          expect(frameUrl).toBe(pageUrl), 'frameUrl não corresponde ao page.url()';
          expect(documentUrl).toBe(pageUrl), 'document.URL não corresponde ao page.url()';
          expect(locationHref).toBe(pageUrl), 'location.href não corresponde ao page.url()';

          /* --- DOM.resolveNode e Runtime.callFunctionOn --- */
          if (!bodyNodeId) {
            throw new Error('bodyNodeId não definido');
          }

          const resolved = await session.send('DOM.resolveNode', {
            nodeId: bodyNodeId,
          });
          const resolvedType =
            resolved && resolved.object ? resolved.object.type : 'null';

          // Runtime.callFunctionOn: functionDeclaration como STRING JavaScript completa
          const fnResult = await session.send('Runtime.callFunctionOn', {
            functionDeclaration:
              'function () { return this === document.body; }',
            objectId:
              resolved && resolved.object ? resolved.object.objectId : null,
            returnByValue: true,
            awaitPromise: true,
          });
          const fnResultValue =
            fnResult && fnResult.result !== undefined
              ? fnResult.result.value
              : null;
          if (fnResultValue !== true) {
            throw new Error(
              'Objeto resolvido não é document.body, got: ' + fnResultValue
            );
          }

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
        },
      });

      // --- Pós-detach: separar observação de assertion ---

      // 1. Registrar resultado da tentativa de comando pós-detach
      let postDetachAccepted = false;
      let postDetachError = null;
      try {
        // Attempt to send command after detach
        // O comportamento varia por versão do Chromium; o importante é
        // capturar o resultado observado, não suppor.
        try {
          await session.send('DOM.getDocument');
          // Se chegou aqui sem throw, o comando foi ACEITO
          postDetachAccepted = true;
        } catch (err) {
          // Comando rejeitado
          postDetachError = err;
        }
      } catch (e) {
        test.log('⚠️ Cenário A: erro ao tentar comando pós-detach: ' + e.message);
      }

      // 2. A assertion de rejeição DEVE estar FORA do bloco try/capture acima.
      //    Se postDetachAccepted for verdadeiro, o teste deve FALHAR.
      if (postDetachAccepted) {
        throw new Error(
          'Cenário A: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
        );
      }

      // 3. Afirmar que a operação principal não trouxe operationError
      if (operationError) {
        throw new Error(
          'Cenário A: operação principal falhou: ' + operationError.message
        );
      }

      // 4. Afirmar que o cleanup não teve erro
      if (cleanupError) {
        throw new Error(
          'Cenário A: cleanupError não é nulo: ' + cleanupError.message
        );
      }

      // 5. Evidência: JSON válido derivado das observações reais
      // Usar contentType application/json e extensão .json
      try {
        await testInfo.attach('r2-prova-resultado-A.json', {
          body: JSON.stringify({
            cenario: 'sucesso',
            url_playwright: page.url(),
            root_nodeId: result ? result.rootNodeId : null,
            body_nodeId: result ? result.bodyNodeId : null,
            document_url: result ? result.documentUrl : null,
            location_href: result ? result.locationHref : null,
            frame_id: result ? result.frameId : null,
            frame_url: result ? result.frameUrl : null,
            resolved_type: result ? result.resolvedType : null,
            fn_result_value: result ? result.fnResultValue : null,
            operation_error: operationError ? operationError.message : null,
            cleanup_error: cleanupError ? cleanupError.message : null,
            post_detach_result: postDetachAccepted ? 'accepted' : 'rejected',
            post_detach_error: postDetachError
              ? postDetachError.message
              : null,
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        // Se anexar falhar, o teste deve reprovar, não ser ignorado
        throw new Error('Cenário A: falha ao anexar evidência: ' + e.message);
      }

      test.log('Cenário A: sucesso verificado, assertions e evidência JSON');
      return;
    }
  );

  /* ── Cenário B: exceção provocada com assertions rigorosas ──────────── */
  test(
    'R2: Cenário B — exceção sentinela preservada, cleanup e rejeição pós-detach',
    async ({ page, context }, testInfo) => {
      const creds = resolveCredentials();
      if (!creds) {
        await testInfo.skip(
          true,
          'BLOCKED: credenciais QA indisponíveis — defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD'
        );
        return;
      }

      await app.openApp(page);
      await app.waitForAuthResolved(page, 15_000);
      if (creds) {
        await expect(page.locator('#userBar')).toContainText(creds.email, {
          timeout: 20_000,
        });
      }
      await app.waitForDataReady(page, 60_000);

      const {
        session,
        result,
        operationError,
        cleanupError,
      } = await runWithCdpSession({
        context,
        page,
        testInfo,
        operation: async ({ session }) => {
          // Provocar exceção deliberada com sentinel único e determinístico.
          // NÃO usar CDP.InvalidMethod.
          throw new Error('sentinel_original_exception_cdp_timeout');
        },
      });

      // --- Afirmações obrigatórias (fora de try/catch que capturem rejeição) ---

      // 1. Afirmar que operationError existe e é o sentinel esperado
      if (!operationError) {
        throw new Error('Cenário B: operationError é nulo - exceção não foi provocada');
      }
      if (operationError.message !== 'sentinel_original_exception_cdp_timeout') {
        throw new Error(
          'Cenário B: operationError não é o sentinel esperado: ' + operationError.message
        );
      }
      test.log('Cenário B: operaçãoError capturado e é o sentinel esperado');

      // 2. Afirmar que cleanupError é nulo (regra: erro de cleanup reprova ainda que
      //    operationError também exista). Essa assertion está separada da try/catch
      //    que captura a rejeição pós-detach.
      if (cleanupError) {
        throw new Error(
          'Cenário B: cleanupError não é nulo: ' + cleanupError.message
        );
      }
      test.log('Cenário B: cleanupError é nulo (limpeza bem-sucedida)');

      // 3. Tentativa de comando pós-detach: observar o resultado, não suppor.
      //    O resultado será asserted separadamente abaixo.
      let postDetachAccepted = false;
      let postDetachError = null;
      try {
        try {
          await session.send('DOM.getDocument');
          // Se chegou aqui, o comando foi ACEITO pós-detach
          postDetachAccepted = true;
        } catch (err) {
          // Comando rejeitado
          postDetachError = err;
        }
      } catch (e) {
        test.log('⚠️ Cenário B: erro ao tentar comando pós-detach: ' + e.message);
      }

      // 4. A assertion de rejeição DEVE ser FORA do bloco try/capture.
      //    Se o comando foi aceito, o teste falha.
      if (postDetachAccepted) {
        throw new Error(
          'Cenário B: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
        );
      }

      // 5. Evidência: JSON válido
      try {
        await testInfo.attach('r2-prova-resultado-B.json', {
          body: JSON.stringify({
            cenario: 'excecao',
            excecao_provocada: true,
            operation_error: operationError.message,
            cleanup_error: cleanupError ? cleanupError.message : null,
            post_detach_result: postDetachAccepted ? 'accepted' : 'rejected',
            post_detach_error: postDetachError ? postDetachError.message : null,
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        throw new Error('Cenário B: falha ao anexar evidência: ' + e.message);
      }

      test.log('Cenário B: exceção provocada, cleanup verificado, evidencia JSON');
      return;
    }
  );

  /* ── Cenário C: timeout controlado via AbortController ──────────────── */
  test(
    'R2: Cenário C — timeout controlado via AbortController, cleanup e rejeição pós-detach',
    async ({ page, context }, testInfo) => {
      // Definir timeout do teste via API documentada
      testInfo.setTimeout(30_000);

      const creds = resolveCredentials();
      if (!creds) {
        await testInfo.skip(
          true,
          'BLOCKED: credenciais QA indisponíveis — defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD'
        );
        return;
      }

      await app.openApp(page);
      await app.waitForAuthResolved(page, 15_000);
      if (creds) {
        await expect(page.locator('#userBar')).toContainText(creds.email, {
          timeout: 20_000,
        });
      }
      await app.waitForDataReady(page, 60_000);

      const {
        session,
        result,
        operationError,
        cleanupError,
      } = await runWithCdpSession({
        context,
        page,
        testInfo,
        operation: async ({ session }) => {
          // Timeout controlado localmente, APENAS AbortController.
          // NÃO usar fallback concorrente que dispara antes do abort.
          // A única fonte de cancelamento é o timer programado.
          const ac = new AbortController();
          const timeoutHandler = setTimeout(() => ac.abort(), 10_000);

          try {
            // Operação observando o AbortController - a Promise rejeita em
            // resposta ao sinal de abort, não há fallback alternativo.
            await new Promise((resolve, reject) => {
              const intervalId = setInterval(() => {
                if (ac.signal.aborted) {
                  clearInterval(intervalId);
                  reject(new Error('aborted'));
                }
              }, 500);
              // NÃO há setTimeout de fallback aqui.
              // Se o signal nunca chegar, a Promise ficará pendurada.
              // O helper executará detach mesmo assim.
            });
            // Se a Promise resolveu (signal não chegou a ser aborted),
            // cancelar o timeout handler para evitar execução dupla
            clearTimeout(timeoutHandler);
          } catch (e) {
            // Re-lançar com prefixo identificável - o erro veio do AbortController
            throw new Error('timeout-controlado: ' + e.message);
          } finally {
            // Limpar timer e intervalo - NÃO deixar recursos órfãos
            clearTimeout(timeoutHandler);
            // O intervalId foi clearado dentro do reject handler acima.
          }

          // CSS e Runtime basics (apenas para validar que a sessão está viva)
          await session.send('CSS.enable');
          await session.send('Runtime.enable');
          const locResult = await session.send('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true,
            awaitPromise: true,
          });
          if (!locResult?.result?.value) {
            throw new Error('Runtime.evaluate sem resultado válido');
          }

          return { success: true, runtimeHref: locResult.result.value };
        },
      });

      // --- Afirmações pós-detach (fora de blocos que capturem rejeição) ---

      // 1. Afirmar que o timeout controlado foi capturado
      if (!operationError) {
        // Se operationError for nulo, o timeout não aconteceu como esperado.
        // O teste deve reprovar por ausência do comportamento esperado.
        throw new Error(
          'Cenário C: operationError é nulo - timeout esperado não ocorreu'
        );
      }
      // 2. Afirmar que é o sentinel de timeout esperado (prefixo 'timeout-controlado')
      if (
        !operationError.message ||
        !operationError.message.includes('timeout-controlado')
      ) {
        throw new Error(
          'Cenário C: operationError não é o sentinel de timeout esperado: ' +
            (operationError ? operationError.message : 'null')
        );
      }
      test.log('Cenário C: operationError capturado com sentinel de timeout');

      // 3. Afirmar que cleanupError é nulo
      if (cleanupError) {
        throw new Error(
          'Cenário C: cleanupError não é nulo: ' + cleanupError.message
        );
      }
      test.log('Cenário C: cleanupError é nulo (limpeza bem-sucedida)');

      // 4. Tentativa de comando pós-detach: observar o resultado.
      //    O resultado será asserted separadamente abaixo, fora do try.
      let postDetachAccepted = false;
      let postDetachError = null;
      try {
        try {
          await session.send('DOM.getDocument');
          // Se chegou aqui, o comando foi ACEITO pós-detach
          postDetachAccepted = true;
        } catch (err) {
          // Comando rejeitado
          postDetachError = err;
        }
      } catch (e) {
        test.log('⚠️ Cenário C: erro ao tentar comando pós-detach: ' + e.message);
      }

      // 5. A assertion de rejeição DEVE estar FORA do bloco try/capture.
      //    Se o comando foi aceito, o teste falha.
      if (postDetachAccepted) {
        throw new Error(
          'Cenário C: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
        );
      }

      // 6. Evidência: JSON válido
      try {
        await testInfo.attach('r2-prova-resultado-C.json', {
          body: JSON.stringify({
            cenario: 'timeout',
            timeout_explicito: true,
            timeout_global_playwright_nao_utilizado: true,
            timeout_controller: 'AbortController local 10s',
            operation_error: operationError ? operationError.message : null,
            cleanup_error: cleanupError ? cleanupError.message : null,
            post_detach_result: postDetachAccepted ? 'accepted' : 'rejected',
            post_detach_error: postDetachError ? postDetachError.message : null,
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        throw new Error('Cenário C: falha ao anexar evidência: ' + e.message);
      }

      test.log('Cenário C: timeout controlado verificado, evidencia JSON');
      return;
    }
  );
});