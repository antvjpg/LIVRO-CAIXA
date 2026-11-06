/* C.O.D.E. — testes do domínio PinProtection (js/domain/pin-protection.js).
   Executam a IMPLEMENTAÇÃO REAL importada em Node. Sem window, sem localStorage:
   o módulo é puro. Execução: node --test e2e/oracles/pin-protection.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as PP from '../../js/domain/pin-protection.js';

const ADMIN_HASH = 'a'.repeat(64);

test('classifyPinRecord: raw null = ausência confirmada (não erro)', () => {
  const r = PP.classifyPinRecord(null);
  assert.equal(r.exists, false);
  assert.equal(r.valid, false);
  assert.equal(r.error, 'no_record');
});

test('classifyPinRecord: JSON malformado = parse_error', () => {
  const r = PP.classifyPinRecord('{invalid json');
  assert.equal(r.exists, false);
  assert.equal(r.valid, false);
  assert.equal(r.error, 'parse_error');
});

test('classifyPinRecord: JSON null = registro existente inválido', () => {
  const r = PP.classifyPinRecord('null');
  assert.equal(r.exists, true);
  assert.equal(r.valid, false);
  assert.equal(r.error, 'json_null');
});

test('classifyPinRecord: tipo não-objeto = json_type_invalid', () => {
  const r = PP.classifyPinRecord('123');
  assert.equal(r.exists, true);
  assert.equal(r.valid, false);
  assert.equal(r.error, 'json_type_invalid');
});

test('classifyPinRecord: hash ausente ou curto = hash_missing_or_invalid', () => {
  assert.equal(PP.classifyPinRecord('{}').error, 'hash_missing_or_invalid');
  assert.equal(PP.classifyPinRecord('{"hash":"curto"}').error, 'hash_missing_or_invalid');
  assert.equal(PP.classifyPinRecord('{"hash":123}').error, 'hash_missing_or_invalid');
});

test('classifyPinRecord: hash de 64 chars = válido', () => {
  const r = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  assert.equal(r.exists, true);
  assert.equal(r.valid, true);
  assert.equal(r.record.hash, ADMIN_HASH);
});

test('evaluateLock: sem registro e lockOnOpen=true → bloqueado', () => {
  const r = PP.evaluateLock({ recordResult: PP.classifyPinRecord(null), lockOnOpen: true, graceMs: 0, lastPinActivity: 0, now: Date.now() });
  assert.equal(r.locked, true);
  assert.equal(r.pinUnlocked, false);
  assert.equal(r.reason, 'no_record');
});

test('evaluateLock: sem registro e lockOnOpen=false → desbloqueado', () => {
  const r = PP.evaluateLock({ recordResult: PP.classifyPinRecord(null), lockOnOpen: false, graceMs: 0, lastPinActivity: 0, now: Date.now() });
  assert.equal(r.locked, false);
  assert.equal(r.pinUnlocked, true);
});

test('evaluateLock: registro inválido → fail-closed (bloqueado)', () => {
  const invalid = PP.classifyPinRecord('{"hash":"curto"}');
  const r = PP.evaluateLock({ recordResult: invalid, lockOnOpen: false, graceMs: 0, lastPinActivity: 0, now: Date.now() });
  assert.equal(r.locked, true);
  assert.equal(r.pinUnlocked, false);
  assert.equal(r.reason, 'invalid_record');
});

test('evaluateLock: registro válido, grace zero → bloqueado (needs_unlock)', () => {
  const valid = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  const r = PP.evaluateLock({ recordResult: valid, lockOnOpen: true, graceMs: 0, lastPinActivity: 0, now: Date.now() });
  assert.equal(r.locked, true);
  assert.equal(r.reason, 'needs_unlock');
});

test('evaluateLock: dentro do grace period → desbloqueado', () => {
  const valid = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  const now = Date.now();
  const r = PP.evaluateLock({ recordResult: valid, lockOnOpen: true, graceMs: 300000, lastPinActivity: now - 1000, now });
  assert.equal(r.locked, false);
  assert.equal(r.reason, 'within_grace_period');
});

test('evaluateLock: fora do grace period → bloqueado', () => {
  const valid = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  const now = Date.now();
  const r = PP.evaluateLock({ recordResult: valid, lockOnOpen: true, graceMs: 300000, lastPinActivity: now - 301000, now });
  assert.equal(r.locked, true);
});

test('evaluateLock: timestamp ausente/zero → bloqueado mesmo com grace', () => {
  const valid = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  const now = Date.now();
  const r = PP.evaluateLock({ recordResult: valid, lockOnOpen: true, graceMs: 300000, lastPinActivity: 0, now });
  assert.equal(r.locked, true);
});

test('evaluateLock: grace negativo/zero da PIN×correção indevida não aplica', () => {
  const valid = PP.classifyPinRecord(JSON.stringify({ hash: ADMIN_HASH }));
  const now = Date.now();
  const r = PP.evaluateLock({ recordResult: valid, lockOnOpen: true, graceMs: -5, lastPinActivity: now - 1000, now });
  assert.equal(r.locked, true);
});
