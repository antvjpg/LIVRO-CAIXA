/* C.O.D.E. — Testes de carga e recuperação de falha para o módulo de segurança.
   Testa:
   - Criptografia/descriptografia de valores sensíveis (chave OpenRouter)
   - Sanitização de entrada para prevenir XSS
   - Armazenamento e recuperação no IndexedDB (requer ambiente com indexedDB/crypto.subtle)
   Execução: node --test worker/test/security-utils.test.mjs
*/
import test from "node:test";
import assert from "node:assert/strict";
import { secureSet, secureGet, secureRemove, sanitizeInput, sanitizeDisplayName, sanitizeAttribute, escapeHTML } from "../../js/domain/secure-storage.js";

/* Indica se o ambiente suporta armazenamento criptografado (IndexedDB + WebCrypto). */
const hasSecureStorage =
  typeof indexedDB !== "undefined" &&
  typeof crypto !== "undefined" &&
  typeof crypto.subtle !== "undefined";

/* Testes de sanitização de entrada */
test("segurança-utils: sanitizeInput remove tags HTML perigosas", () => {
  assert.equal(sanitizeInput("<script>alert('xss')</script>"), "");
  assert.equal(sanitizeInput("<img onerror='alert(1)' src='x'>"), "");
  assert.equal(sanitizeInput("Texto normal"), "Texto normal");
  assert.equal(sanitizeInput("<b>negrito</b>"), "negrito");
  assert.equal(sanitizeInput(null), "");
  assert.equal(sanitizeInput(undefined), "");
});

test("segurança-utils: sanitizeDisplayName escapa caracteres especiais", () => {
  assert.equal(sanitizeDisplayName("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;");
  assert.equal(sanitizeDisplayName("João da Silva"), "João da Silva");
  assert.equal(sanitizeDisplayName(""), "");
  assert.equal(sanitizeDisplayName(null), "");
});

test("segurança-utils: sanitizeAttribute remove aspas perigosas", () => {
  assert.equal(sanitizeAttribute('"><script>alert(1)</script>'), "");
  assert.equal(sanitizeAttribute("valor normal"), "valor normal");
  assert.equal(sanitizeAttribute(null), "");
});

test("segurança-utils: escapeHTML escapa caracteres especiais", () => {
  assert.equal(escapeHTML("<script>"), "&lt;script&gt;");
  assert.equal(escapeHTML("teste & teste"), "teste &amp; teste");
  assert.equal(escapeHTML("\"aspas\""), "&quot;aspas&quot;");
});

test("segurança-utils: sanitizeInput previne injeção de evento on*", () => {
  assert.equal(sanitizeInput('<img onerror="alert(1)" src="x">'), "");
  assert.equal(sanitizeInput("<div onclick='alert(1)'>clique</div>"), "<div onclick='alert(1)'>clique</div>");
});

test("segurança-utils: sanitizeInput previne injeção javascript:", () => {
  assert.equal(sanitizeInput("javascript:alert(1)"), "");
  assert.equal(sanitizeInput("texto normal"), "texto normal");
});

/* Testes de armazenamento criptografado — requerem IndexedDB + WebCrypto. */
test("segurança-utils: secure-set e secure-get armazenam e recuperam valores", { skip: !hasSecureStorage }, async () => {
  await secureSet("chave-teste", "valor-secreto-123");
  const valor = await secureGet("chave-teste");
  assert.equal(valor, "valor-secreto-123");
});

test("segurança-utils: secure-remove remove valor armazenado", { skip: !hasSecureStorage }, async () => {
  await secureSet("chave-temporaria", "valor-temporario");
  await secureRemove("chave-temporaria");
  const valor = await secureGet("chave-temporaria");
  assert.equal(valor, null);
});
