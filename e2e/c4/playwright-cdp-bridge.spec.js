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
const app = require('../helpers/app');
const { resolveCredentials, guardReasonText } = require('../helpers/env');
const { createDomainAdapters } = require('./playwright-cdp-domain-adapter.cjs');
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
