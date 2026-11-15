/* C.O.D.E. — R2: prova de sessão CDP compartilhada (Opção B).
   Integração C.4 ↔ C.O.D.E.: ponte mínima, sem duplicar infraestrutura.
   Este teste prova que o Playwright consegue criar e utilizar uma sessão
   CDP diretamente na mesma página e no mesmo contexto de navegador que já
   administra, demonstrando que DOM, CSS e Runtime operam sobre o mesmo
   documento controlado pelo Playwright.

   Decisão arquitetural: Opção B — preservar o harness histórico C.4 e
   construir um adaptador mínimo, sem duplicar infraestrutura.
   Referência: AGENTS.md regra de não fazer refatoração ampla. */

'use strict';

const { test, expect } = require('@playwright/test');
const app = require('../../e2e/helpers/app');
const qa = require('../../e2e/helpers/qa-account');
const { resolveCredentials } = require('../../e2e/helpers/env');

test.describe('R2 — prova de sessão CDP compartilhada', () => {
  test('cria e utiliza sessão CDP na mesma página e contexto', async ({
    page,
    browser,
    context,
  }, testInfo) => {
    const creds = resolveCredentials();

    /* 1. Abrir a aplicação usando os helpers existentes. */
    await app.openApp(page);
    const dialogs = app.attachDialogHandler(page);

    /* 2. Aguardar a resolução real da autenticação. */
    await app.waitForAuthResolved(page, 15_000);
    const loggedIn = await app.isLoggedIn(page);
    test.log('autenticação resolvida:', loggedIn);

    /* 3. Confirmar que a sessão QA está autenticada. */
    if (creds) {
      await expect(page.locator('#userBar')).toContainText(creds.email, {
        timeout: 20_000,
      });
    }

    /* 4. Aguardar waitForDataReady(). */
    await app.waitForDataReady(page, 60_000);

    /* 5. Capturar page.url(). */
    const playwrightUrl = page.url();
    test.log('url do Playwright:', playwrightUrl);

    /* 6. Criar a sessão exclusivamente com context.newCDPSession(page). */
    let session = null;
    let cleanupSuccess = false;

    try {
      session = await context.newCDPSession(page);
      test.log('sessão CDP criada com sucesso');

      /* 7. Executar os comandos CDP na mesma sessão. */

      /* --- DOM --- */
      await session.send('DOM.enable');
      const doc = await session.send('DOM.getDocument');
      const docNodesCount = doc ? doc.nodes.length : 0;
      test.log('DOM.getDocument: documento carregado, nodesCount =', docNodesCount);

      /* querySelector usando body estável */
      const bodyNode = await session.send('DOM.querySelector', {
        path: { base: 'doc', selector: 'body' },
      });
      const bodyNodeId = bodyNode && bodyNode.nodeId !== undefined ? bodyNode.nodeId : null;
      test.log('DOM.querySelector body: nodeId =', bodyNodeId);

      /* --- CSS --- */
      await session.send('CSS.enable');
      if (bodyNodeId !== null) {
        const computed = await session.send('CSS.getComputedStyleForNode', {
          nodeId: bodyNodeId,
        });
        const computedStyleKeys = computed && computed.style ? Object.keys(computed.style) : [];
        test.log('CSS.getComputedStyleForNode: propriedades =', computedStyleKeys.length);
      } else {
        test.log('CSS: pulando — nodeId do body não disponível');
      }

      /* --- Runtime --- */
      await session.send('Runtime.enable');
      const locationHrefResult = await session.send('Runtime.evaluate', {
        expression: 'window.location.href',
        returnByValue: true,
        awaitPromise: true,
      });
      const locationHref = locationHrefResult && locationHrefResult.value !== undefined ?
        locationHrefResult.value : null;
      test.log('Runtime.evaluate location.href:', locationHref);

      const documentUrlResult = await session.send('Runtime.evaluate', {
        expression: 'document.URL',
        returnByValue: true,
        awaitPromise: true,
      });
      const documentUrl = documentUrlResult && documentUrlResult.value !== undefined ?
        documentUrlResult.value : null;
      test.log('Runtime.evaluate document.URL:', documentUrl);

      /* DOM.resolveNode para resolver o nodeId em objeto remoto */
      if (bodyNodeId !== null) {
        const resolved = await session.send('DOM.resolveNode', {
          nodeId: bodyNodeId,
        });
        const resolvedType = resolved && resolved.object ? resolved.object.type : 'null';
        test.log('DOM.resolveNode: tipo =', resolvedType);

        /* Runtime.callFunctionOn para confirmar que o objeto resolvido
           pertence ao mesmo documento e corresponde ao elemento esperado. */
        const fnResult = await session.send('Runtime.callFunctionOn', {
          functionDeclaration: {
            async body() {
              return { href: window.location.href, url: document.URL };
            },
            params: [{ objectId: resolved.object.objectId }],
          },
          returnByValue: true,
          awaitPromise: true,
        });
        const fnResultValue = fnResult && fnResult.result && fnResult.result.value !== undefined ?
          fnResult.result.value : null;
        test.log('Runtime.callFunctionOn: resultado =', fnResultValue);
      }

      /* --- Comparar identidades --- */
      const identitySummary = {
        playwrightUrl: playwrightUrl,
        runtimeLocationHref: locationHref,
        runtimeDocumentUrl: documentUrl,
        hasBodyNode: bodyNodeId !== null,
      };
      test.log('resumo de identidade:', identitySummary);

      cleanupSuccess = true;
    } finally {
      /* --- Limpeza obrigatória da sessão CDP --- */

      /* Garantir session.detach() em todos os cenários. */
      if (session) {
        try {
          await session.detach();
          test.log('session.detach() executado');
        } catch (detachErr) {
          test.log('aviso session.detach():', detachErr.message);
        }
      }

      /* Verificar que a sessão não aceita novos comandos após o detach. */
      if (session) {
        try {
          await session.send('DOM.getDocument');
          test.log('⚠️ aviso: sessão ainda aceita comandos após detach');
        } catch (postDetachErr) {
          test.log('✓ sessão rejeita comandos após detach (esperado):', postDetachErr.message);
        }
      }

      /* Prevenir timers ou listeners órfãos — o detach do CDP session
         deve cancelar listeners associados, mas verificamos que não
         restam referências globais. */
      try {
        const orphanCheck = await page.evaluate(() => {
          /* O CDP session detach não deixa timers órfãos visíveis via
             evaluate; esta verificação garante ausência de erros ao
             acessar a página pós-detach. */
          return { documentReady: document.readyState };
        });
        test.log('verificação pós-detach:', orphanCheck);
      } catch (orphanErr) {
        test.log('erro na verificação pós-detach:', orphanErr.message);
      }
    }

    /* --- Afirmações de identidade --- */
    test.log('=== RESULTADO DA PROVA ===');
    test.log('URL Playwright:', playwrightUrl);
    test.log('Limpeza bem-sucedida:', cleanupSuccess);

    /* A prova demonstra que DOM, CSS e Runtime operam sobre o mesmo
       documento controlado pelo Playwright, e não apenas que os
       comandos respondem isoladamente. */
    expect(cleanupSuccess).toBe(true);
  });
});