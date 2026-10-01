'use strict';

const { test, expect } = require('@playwright/test');
const qa = require('../helpers/qa-account');
const { resolveCredentials } = require('../helpers/env');

test.describe('Login — console técnico de diagnóstico', () => {
  test('abre e fecha o diagnóstico pela tela de login', async ({ page }) => {
    const creds = resolveCredentials();
    const session = await qa.ensureUiSession(page, creds);

    if (session.status !== 'ok') {
      test.skip(true, `BLOCKED: sessão QA indisponível — ${session.error || 'motivo desconhecido'}`);
    }

    await page.evaluate(async () => {
      if (window.firebase?.auth) {
        await window.firebase.auth().signOut();
      }
    });

    await expect(page.locator('#authOverlay')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#authDiagnosticToggle')).toBeVisible();

    const overlay = page.locator('#authDiagnosticOverlay');
    const panel = page.locator('#authDiagnosticPanel');
    const toggle = page.locator('#authDiagnosticToggle');

    await expect(overlay).not.toHaveClass(/open/);
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();

    await expect(overlay).toHaveClass(/open/);
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await expect(page.locator('#authDiagnosticLog')).toContainText(
      /Sistema de diagnóstico iniciado|Controles do diagnóstico conectados|Console de diagnóstico aberto/,
    );

    await page.locator('#authDiagnosticClose').click();

    await expect(overlay).not.toHaveClass(/open/);
    await expect(panel).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
