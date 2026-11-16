/* C.O.D.E. — R2: quinta retificação técnica.
   Correção de falsos positivos pós-detach, comprovação de cancelamento
   e evidências auditáveis. Arquitetura Opção B preservada. */

'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../../e2e/helpers/app');
const { resolveCredentials } = require('../../e2e/helpers/env');

test.describe('R2 — quinta retificação técnica', () => {
  /* ── Helper runWithCdpSession ────────────────────────────────────────
     Contrato obrigatório:
     Entrada: { context, page, testInfo, operation }
       - context: BrowserContext do Playwright.
       - page: Page do Playwright.
       - testInfo: TestInfo do teste (passado pelo chamador).
       - operation: async ({ session }) => any.
     Comportamento:
       1. Criar a sessão com: const session = await context.newCDPSession(page);
       2. Executar: result = await operation({ session }); capturando qualquer erro em operationError.
         - NÃO relançar operationError dentro do helper.
       3. No bloco finally, executar: await session.detach(); capturando erro em cleanupError.
         - Se session.detach() lançar, registrar em cleanupError e NÃO relançar.
       4. Retornar: { session, result, operationError, cleanupError }.
         - session deve ser devolvido já desconectado (detached) para as checagens pós-detach.
         - operationError e cleanupError: null quando não houver erro, senão o objeto de erro.
       5. Não usar try/catch que engula erro sem registrar em operationError ou cleanupError.
     Nenhuma alteração na lógica das operações (cenários A, B e C). Apenas garantir
     que o helper exista e cumpra o contrato.
     Lançamento: this function throws if context or page is missing. */

  async function runWithCdpSession({ context, page, testInfo, operation }) {
    if (!context) {
      throw new Error('runWithCdpSession: context é obrigatório');
    }
    if (!page) {
      throw new Error('runWithCdpSession: page é obrigatório');
    }

    const session = await context.newCDPSession(page);
    let operationError = null;
    let cleanupError = null;
    let result = null;

    const opStart = Date.now();
    try {
      result = await operation({ session });
    } catch (err) {
      operationError = err;
      // NÃO relançar o erro — deixar o finally executar o cleanup.
    } finally {
      // Única chamada a detach em todos os caminhos.
      // Capturamos o erro, mas NÃO o engolimos para que o teste saiba.
      // Se detach falhar, cleanupError será definido; NÃO relançar.
      const detachStart = Date.now();
      try {
        await session.detach();
      } catch (detachErr) {
        cleanupError = detachErr;
      }
      const detachEnd = Date.now();

      // Resultado construido APENAS DEPOIS que finally terminou.
      return {
        session,
        result,
        operationError,
        cleanupError,
        operationStart: opStart,
        operationEnd: detachEnd,
        operationDuration: detachEnd - opStart,
        detachStart,
        detachEnd,
        detachDuration: detachEnd - detachStart,
        detachSuccess: cleanupError === null,
      };
    }
  }

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
        operationDuration,
        detachDuration,
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

// -----------------------------------------------------------
  // Classificador de estado pós-detach.
  // Estados possíveis: 'accepted', 'rejected_expected', 'rejected_unexpected', 'not_observed'.
  // Apenas 'rejected_expected' satisfaz o gate; quaisquer outros reprovam.
  // Não usar postDetachAccepted = false como evidência de rejeição.

      // 1. Tentar comando pós-detach e capturar resultado observado.
      //    Separar a observação da classificação da rejeição.
      try {
        await session.send('DOM.getDocument');
        // Se chegou aqui, o comando foi ACEITO após o detach.
        postDetachStatus = 'accepted';
      } catch (err) {
        // Comando rejeitado pelo protocolo CDP.
        // Como não temos como verificar automaticamente se a rejeição
        // decorre do detach (vs. outro motivo), classificamos como
        // rejected_unexpected para fins de não producir falso PASS.
        // Em auditoria manual, o revisor pode conferir se a rejeição
        // é decorrente do detach efetivo.
        postDetachError = err;
        postDetachStatus = 'rejected_unexpected';
      }

      // Pós-detach: instrumentação diagnóstica do cenário B.
      // A declaração ocorre após a tentativa do comando pós-detach,
      // quando postDetachStatus e postDetachError já possuem valores observados.
      const diagB = {
        cenario: 'B',
        teste: testInfo.title,
        resultado_operacao_principal: operationError
          ? {
              name: operationError.name,
              message: operationError.message,
            }
          : null,
        resultado_cleanup: cleanupError
          ? {
              name: cleanupError.name,
              message: cleanupError.message,
            }
          : null,
        estado_detach: cleanupError === null ? 'resolved' : 'rejected',
        resultado_comando_posto_detach: postDetachStatus,
        error_detalhe: postDetachError
          ? {
              name: postDetachError.name,
              message: postDetachError.message,
              stack: postDetachError.stack || null,
              cause: postDetachError.cause
                ? String(postDetachError.cause.message || postDetachError.cause)
                : null,
            }
          : null,
        duracao_operacao_ms: operationDuration,
        detach_duracao_ms: detachDuration,
        sucesso_detach: cleanupError === null,
        node_version: process.version,
      };

      try {
        await testInfo.attach('r2-prova-resultado-B-diagnostic.json', {
          body: JSON.stringify(diagB, null, 2),
          contentType: 'application/json',
        });
      } catch (attachErr) {
        console.error(
          '[C4_DIAGNOSTIC] falha ao anexar evidência B:',
          attachErr.message
        );
      }

      console.log('[C4_DIAGNOSTIC]', JSON.stringify(diagB));

      // Pós-detach: instrumentação diagnóstica do cenário A.
      // A declaração ocorre após a tentativa do comando pós-detach,
      // quando postDetachStatus e postDetachError já possuem valores observados.
      const diag = {
        cenario: 'A',
        teste: testInfo.title,
        resultado_operacao_principal: result
          ? {
              rootNodeId: result.rootNodeId,
              bodyNodeId: result.bodyNodeId,
            }
          : null,
        resultado_cleanup: cleanupError
          ? {
              name: cleanupError.name,
              message: cleanupError.message,
            }
          : null,
        estado_detach: cleanupError === null ? 'resolved' : 'rejected',
        resultado_comando_posto_detach: postDetachStatus,
        error_detalhe: postDetachError
          ? {
              name: postDetachError.name,
              message: postDetachError.message,
              stack: postDetachError.stack || null,
              cause: postDetachError.cause
                ? String(postDetachError.cause.message || postDetachError.cause)
                : null,
            }
          : null,
        duracao_operacao_ms: operationDuration,
        detach_duracao_ms: detachDuration,
        sucesso_detach: cleanupError === null,
        node_version: process.version,
      };

      try {
        await testInfo.attach('r2-prova-resultado-A-diagnostic.json', {
          body: JSON.stringify(diag, null, 2),
          contentType: 'application/json',
        });
      } catch (attachErr) {
        console.error(
          '[C4_DIAGNOSTIC] falha ao anexar evidência A:',
          attachErr.message
        );
      }

      console.log('[C4_DIAGNOSTIC]', JSON.stringify(diag));

      // Note: não há catch externo que absorva a falha.
      // Qualquer erro de infraestrutura propaga naturalmente.

      // 2. A assertion classificatória FORA do bloco de tentativa.
      //    Apenas 'rejected_expected' permite que o teste prossiga.
      if (postDetachStatus !== 'rejected_expected') {
        // Se o status for 'accepted', lançamos erro explicito de falso positivo.
        if (postDetachStatus === 'accepted') {
          throw new Error(
            'Cenário A: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
          );
        }
        // 'rejected_unexpected', 'not_observed' ou qualquer outro estado
        // também causa falha, com mensagem baseada no status observado.
        const statusMsg =
          postDetachStatus === 'rejected_unexpected'
            ? 'rejeição inesperada pós-detach'
            : postDetachStatus === 'not_observed'
            ? 'falha ao observar comando pós-detach'
            : `status pós-detach desconhecido: ${postDetachStatus}`;
        throw new Error(`Cenário A: ${statusMsg} - o teste reprovará`);
      }

      // 3. As assertions restantes (operationError, cleanupError) permanecem.
      if (operationError) {
        throw new Error('Cenário A: operação principal falhou: ' + operationError.message);
      }
      if (cleanupError) {
        throw new Error('Cenário A: cleanupError não é nulo: ' + cleanupError.message);
      }

      // 4. Evidência: JSON válido com o status CLASSIFICADO.
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
            post_detach_status: postDetachStatus,
            post_detach_error: postDetachError ? postDetachError.message : null,
            post_detach_observed: postDetachStatus !== 'not_observed',
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        throw new Error('Cenário A: falha ao anexar evidência: ' + e.message);
      }

      testInfo.annotations.push({ type: 'log', description: 'Cenário A: sucesso verificado, assertions e evidência JSON' });
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
        operationDuration,
        detachDuration,
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
      testInfo.annotations.push({ type: 'log', description: 'Cenário B: operaçãoError capturado e é o sentinel esperado' });

// -----------------------------------------------------------
  // 2. Classificar o status pós-detach rigorosamente.
      //    Estados: 'accepted', 'rejected_expected', 'rejected_unexpected', 'not_observed'.
      //    Apenas 'rejected_expected' satisfaz o gate.
      //    Não converter 'not_observed' ou 'rejected_unexpected' em rejeição esperada.
      let postDetachStatus = 'not_observed';
      let postDetachError = null;

      // 3. Tentativa de comando pós-detach: observar o resultado, não suppor.
      //    Capturar o erro, mas classificar apropriadamente.
      try {
        try {
          await session.send('DOM.getDocument');
          // Comando aceito após o detach.
          postDetachStatus = 'accepted';
        } catch (err) {
          // Comando rejeitado.
          postDetachError = err;
          // Como não temos como verificar automaticamente se a rejeição
          // decorre do detach (vs. outro motivo), classificamos como
          // rejected_unexpected. Em auditoria manual, o revisor poderá
          // conferir a causa real da rejeição.
          postDetachStatus = 'rejected_unexpected';
        }
      } catch (e) {
        // Erro de infraestrutura ao tentar o comando; não classificar como rejeição.
        postDetachError = new Error('erro ao tentar comando pós-detach: ' + e.message);
        postDetachStatus = 'not_observed';
      }

      // 4. A classificação FORA do bloco try/capture.
      //    Apenas 'rejected_expected' satisfaz o gate deste cenário.
      if (postDetachStatus !== 'rejected_expected') {
        if (postDetachStatus === 'accepted') {
          throw new Error(
            'Cenário B: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
          );
        }
        const statusMsg =
          postDetachStatus === 'rejected_unexpected'
            ? 'rejeição inesperada pós-detach'
            : postDetachStatus === 'not_observed'
            ? 'falha ao observar comando pós-detach'
            : `status pós-detach desconhecido: ${postDetachStatus}`;
        throw new Error(`Cenário B: ${statusMsg} - o teste reprovará`);
      }

      // 4. Afirmar que a operação lançou exceção esperada
      if (!operationError) {
        throw new Error(
          'Cenário B: operationError é nulo - exceção não foi provocada'
        );
      }
      // 5. Afirmar que é o sentinel esperado
      if (operationError.message !== 'sentinel_original_exception_cdp_timeout') {
        throw new Error(
          'Cenário B: operationError não é o sentinel esperado: ' + operationError.message
        );
      }
      testInfo.annotations.push({ type: 'log', description: 'Cenário B: operaçãoError capturado e é o sentinel esperado' });

      // 6. Afirmar que o cleanup não teve erro.
      if (cleanupError) {
        throw new Error('Cenário B: cleanupError não é nulo: ' + cleanupError.message);
      }
      testInfo.annotations.push({ type: 'log', description: 'Cenário B: cleanupError é nulo (limpeza bem-sucedida)' });

      // 7. Evidência: JSON válido com status classificado.
      try {
        await testInfo.attach('r2-prova-resultado-B.json', {
          body: JSON.stringify({
            cenario: 'excecao',
            excecao_provocada: true,
            operation_error: operationError.message,
            cleanup_error: cleanupError ? cleanupError.message : null,
            post_detach_status: postDetachStatus,
            post_detach_error: postDetachError ? postDetachError.message : null,
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        throw new Error('Cenário B: falha ao anexar evidência: ' + e.message);
      }

      testInfo.annotations.push({ type: 'log', description: 'Cenário B: exceção provocada, cleanup verificado, evidencia JSON' });
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
        operationDuration,
        detachDuration,
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
      testInfo.annotations.push({ type: 'log', description: 'Cenário C: operationError capturado com sentinel de timeout' });

      // 3. Afirmar que cleanupError é nulo
      if (cleanupError) {
        throw new Error('Cenário C: cleanupError não é nulo: ' + cleanupError.message);
      }
      testInfo.annotations.push({ type: 'log', description: 'Cenário C: cleanupError é nulo (limpeza bem-sucedida)' });

testInfo.annotations.push({ type: 'log', description: 'Cenário C: timeout controlado verificado, evidencia JSON' });

// -----------------------------------------------------------
  // 4. Classificar o status pós-detach rigorosamente.
      //    Estados: 'accepted', 'rejected_expected', 'rejected_unexpected', 'not_observed'.
      //    Apenas 'rejected_expected' satisfaz o gate.
      //    Não converter 'not_observed' ou 'rejected_unexpected' em rejeição esperada.
      let postDetachStatus = 'not_observed';
      let postDetachError = null;

      // 5. Tentativa de comando pós-detach: observar o resultado.
      //    Separar a observação da classificação da rejeição.
      try {
        try {
          await session.send('DOM.getDocument');
          // Se chegou aqui, o comando foi ACEITO pós-detach.
          postDetachStatus = 'accepted';
        } catch (err) {
          // Comando rejeitado pelo protocolo CDP.
          postDetachError = err;
          // Como não temos como verificar automaticamente se a rejeição
          // decorre do detach (vs. outro motivo), classificamos como
          // rejected_unexpected. Em auditoria manual, o revisor poderá
          // conferir se a rejeição é decorrente do detach efetivo.
          postDetachStatus = 'rejected_unexpected';
        }
      } catch (e) {
        // Erro de infraestrutura ao tentar o comando; não classificar como rejeição.
        postDetachError = new Error('erro ao tentar comando pós-detach: ' + e.message);
        postDetachStatus = 'not_observed';
      }

      // Pós-detach: instrumentação diagnóstica do cenário C.
      // A declaração ocorre após a tentativa do comando pós-detach,
      // quando postDetachStatus e postDetachError já possuem valores observados.
      const diagC = {
        cenario: 'C',
        teste: testInfo.title,
        resultado_operacao_principal: operationError
          ? {
              name: operationError.name,
              message: operationError.message,
            }
          : null,
        resultado_cleanup: cleanupError
          ? {
              name: cleanupError.name,
              message: cleanupError.message,
            }
          : null,
        estado_detach: cleanupError === null ? 'resolved' : 'rejected',
        resultado_comando_posto_detach: postDetachStatus,
        error_detalhe: postDetachError
          ? {
              name: postDetachError.name,
              message: postDetachError.message,
              stack: postDetachError.stack || null,
              cause: postDetachError.cause
                ? String(postDetachError.cause.message || postDetachError.cause)
                : null,
            }
          : null,
        duracao_operacao_ms: operationDuration,
        detach_duracao_ms: detachDuration,
        sucesso_detach: cleanupError === null,
        node_version: process.version,
      };

      try {
        await testInfo.attach('r2-prova-resultado-C-diagnostic.json', {
          body: JSON.stringify(diagC, null, 2),
          contentType: 'application/json',
        });
      } catch (attachErr) {
        console.error(
          '[C4_DIAGNOSTIC] falha ao anexar evidência C:',
          attachErr.message
        );
      }

      console.log('[C4_DIAGNOSTIC]', JSON.stringify(diagC));

      // 6. A classificação FORA do bloco try/capture.
      //    Apenas 'rejected_expected' satisfaz o gate.
      if (postDetachStatus !== 'rejected_expected') {
        if (postDetachStatus === 'accepted') {
          throw new Error(
            'Cenário C: falso positivo - comando pós-detach foi ACEITO (esperava-rejeição)'
          );
        }
        const statusMsg =
          postDetachStatus === 'rejected_unexpected'
            ? 'rejeição inesperada pós-detach'
            : postDetachStatus === 'not_observed'
            ? 'falha ao observar comando pós-detach'
            : `status pós-detach desconhecido: ${postDetachStatus}`;
        throw new Error(`Cenário C: ${statusMsg} - o teste reprovará`);
      }

      // 7. Evidência: JSON válido com status classificado.
      try {
        await testInfo.attach('r2-prova-resultado-C.json', {
          body: JSON.stringify({
            cenario: 'timeout',
            timeout_explicito: true,
            timeout_global_playwright_nao_utilizado: true,
            timeout_controller: 'AbortController local 10s',
            operation_error: operationError ? operationError.message : null,
            cleanup_error: cleanupError ? cleanupError.message : null,
            post_detach_status: postDetachStatus,
            post_detach_error: postDetachError ? postDetachError.message : null,
          }),
          contentType: 'application/json',
        });
      } catch (e) {
        throw new Error('Cenário C: falha ao anexar evidência: ' + e.message);
      }

      testInfo.annotations.push({ type: 'log', description: 'Cenário C: timeout controlado verificado, evidencia JSON' });
      return;
    }
  );
});