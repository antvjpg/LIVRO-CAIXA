/* Fiação da Ponte de IA no frontend (Fase 2/6).
   Execução: node --test worker/test/*.test.mjs

   Sem DOM: confere por leitura dos arquivos que a integração existe e
   segue as regras da V1 — contrato carregado, módulo do bridge ligado ao
   DOM, precache do Service Worker, cobertura do syntax-check, e que o
   token nunca toca em armazenamento local nem existe escrita Firebase. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const html = read("index.html");
const bridgeJs = read("js/33-mcp-bridge.js");
const contractJs = read("js/domain/mcp-financial-contract.js");
const swJs = read("sw.js");
const syntaxCheck = read("e2e/scripts/syntax-check.cjs");

test("index.html carrega o contrato MCP como módulo e o bridge após a auth", () => {
  assert.ok(html.includes('<script type="module" src="./js/domain/mcp-financial-contract.js"></script>'));
  const bridgeAt = html.indexOf('<script src="./js/33-mcp-bridge.js');
  const authAt = html.indexOf('<script src="./js/32-auth-wiring.js');
  assert.ok(bridgeAt > -1, "script do bridge ausente");
  assert.ok(authAt > -1, "script de auth ausente");
  assert.ok(bridgeAt > authAt, "bridge deve carregar depois da fiação de auth");
});

test("index.html expõe os elementos da UI da ponte", () => {
  for (const id of [
    "btnMcpBridgeDeposit",
    "btnMcpBridgeCreateToken",
    "btnMcpBridgeCopyToken",
    "btnMcpBridgeRevokeToken",
    "inputMcpBridgeToken",
    "mcpBridgeTokenRow",
    "mcpBridgeStatus"
  ]) {
    assert.ok(html.includes(`id="${id}"`), `elemento #${id} ausente`);
  }
  assert.ok(html.includes('id="mcpBridgeTokenRow" hidden'), "linha do token deve começar oculta");
});

test("contrato MCP publica a moldura global usada pelo bridge", () => {
  assert.ok(contractJs.includes("globalThis.LivroCaixaMcpContract"));
  assert.ok(contractJs.includes("buildExternalSnapshotResult"));
  /* O bridge depende do builder do app e do contrato — sem CDN nova. */
  assert.ok(!/https?:\/\/[^"'`]*contract/i.test(bridgeJs), "bridge não deve puxar contrato de origem externa");
});

test("Service Worker e syntax-check cobrem o novo módulo", () => {
  assert.ok(swJs.includes('"./js/33-mcp-bridge.js"'), "APP_SHELL sem o bridge");
  assert.ok(syntaxCheck.includes("'js/33-mcp-bridge.js'"), "syntax-check sem o bridge");
  assert.ok(syntaxCheck.includes("'js/domain/mcp-financial-contract.js'"), "syntax-check sem o contrato MCP");
});

test("bridge: token nunca vai para armazenamento local nem cookie", () => {
  assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(bridgeJs),
    "token/depósito não podem ser persistidos no dispositivo");
});

test("bridge: nenhuma escrita Firebase e nenhum caminho fora da ponte", () => {
  for (const forbidden of ["setDoc", "updateDoc", "deleteDoc", "addDoc", "runTransaction", "writeBatch"]) {
    assert.ok(!bridgeJs.includes(forbidden), `${forbidden} não pode aparecer no bridge`);
  }
  const paths = [...bridgeJs.matchAll(/'(\/bridge\/[^']+)'/g)].map((m) => m[1]);
  assert.ok(paths.length >= 2, "esperava chamadas a /bridge/*");
  for (const p of paths) {
    assert.ok(p === "/bridge/snapshot" || p === "/bridge/token", `rota inesperada: ${p}`);
  }
});

test("bridge: depósito automático tem intervalo menor que o TTL de 1 h", () => {
  const match = /DEPOSIT_INTERVAL_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*1000/.exec(bridgeJs);
  assert.ok(match, "constante DEPOSIT_INTERVAL_MS ausente");
  const minutes = Number(match[1]);
  assert.ok(minutes > 0 && minutes < 60, `intervalo ${minutes} min deve ser >0 e <60 (TTL do Worker é 1 h)`);
});
