'use strict';

const { test, expect } = require('@playwright/test');
const rest = require('../helpers/firestore-rest');
const { resolveCredentials } = require('../helpers/env');
const identity = require('../helpers/identity');

test.describe('Segurança — regras do Firestore em produção', () => {
  test('dono acessa os próprios dados; conta alheia e anônimo são negados na leitura e na escrita', async () => {
    const creds = resolveCredentials();
    if (!creds) {
      test.skip(true, `BLOCKED: credenciais QA indisponíveis — ${require('../helpers/env').guardReasonText() || 'sem credencial'}`);
    }
    let sessaoA;
    try {
      sessaoA = await rest.signIn(creds.email, creds.password);
    } catch (err) {
      test.skip(true, `BLOCKED: conta QA indisponível (${err.reason || err.message})`);
    }

    const emailB = creds.email.replace('@', '+2@');
    let sessaoB;
    try {
      sessaoB = await rest.signUpOrCreate(emailB, creds.password);
    } catch (err) {
      test.skip(true, `BLOCKED: conta secundária indisponível (${err.reason || err.message})`);
    }
    try {
      identity.addExtraAccount(emailB);
    } catch {}

    try {
      const proprio = await rest.listCollection(
        sessaoA.uid,
        sessaoA.idToken,
        sessaoA.projectId,
        'entries'
      );
      expect(Array.isArray(proprio), 'dono deve conseguir ler a própria coleção').toBe(true);

      const son = await rest.probeCrossAccount(sessaoA.uid, sessaoB.idToken, sessaoA.projectId);
      expect([401, 403], `leitura anônima deve ser negada (recebido ${son.anonimo})`).toContain(
        son.anonimo
      );
      expect(
        [401, 403],
        `leitura cross-account deve ser negada (recebido ${son.alheio})`
      ).toContain(son.alheio);
      expect(
        [401, 403],
        `escrita cross-account deve ser negada (recebido ${son.escrita})`
      ).toContain(son.escrita);
    } finally {
      try {
        await rest.deleteDoc(
          sessaoA.uid,
          sessaoA.idToken,
          sessaoA.projectId,
          `livrocaixa/${sessaoA.uid}/entries/prova-c.o.d.e-sonda`
        );
      } catch {}
    }
  });
});
