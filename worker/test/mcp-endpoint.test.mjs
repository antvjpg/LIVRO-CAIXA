/* Testes do endpoint MCP e da ponte (Fase 2 — modelo cliente→snapshot).
   Execução: node --test worker/test/

   Cobre: autenticação por token MCP, protocolo JSON-RPC (initialize,
   tools/list, tools/call), isolamento entre contas, depósito validado
   pelo contrato Fase 1, revogação, rate limit e read-only total. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { makeKvMock } from "./helpers/kv.mjs";
import { buildExternalSnapshotResult, MCP_TOOL_GET_FINANCIAL_SNAPSHOT } from "../../mcp-financial-contract.js";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubJwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key-1", alg: "RS256", use: "sig" };

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeIdToken(sub) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key-1" }));
  const body = b64url(JSON.stringify({
    iss: `https://securetoken.google.com/${PROJ}`,
    aud: PROJ,
    sub,
    iat: now,
    exp: now + 3600
  }));
  const data = `${head}.${body}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
  return `${data}.${sig}`;
}

globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes("googleapis.com/service_accounts") || target.includes("securetoken")) {
    return new Response(JSON.stringify({ keys: [pubJwk] }), { status: 200 });
  }
  throw new Error(`fetch inesperado: ${target}`);
};

function makeEnv(overrides = {}) {
  return {
    ALLOW_ORIGINS: `http://127.0.0.1:8000,http://localhost:8000,${ORIGIN}`,
    FIREBASE_PROJECT_ID: PROJ,
    RATE_LIMIT_KV: makeKvMock(),
    MCP_RATE_LIMIT_PER_MINUTE: "20",
    BRIDGE_RATE_LIMIT_PER_MINUTE: "20",
    ...overrides
  };
}

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;

function request(path, { method = "POST", headers = {}, body } = {}) {
  return workerFetch(new Request(`${BASE}${path}`, { method, headers, body }), env);
}

let env = makeEnv();

test.beforeEach(() => {
  env = makeEnv();
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

function envelopeFixture() {
  const snapshot = {
    schemaVersion: "P3.5",
    generatedAt: "2026-10-12T12:00:00.000Z",
    period: { currentMonth: "2026-10", currentMonthTotals: { income: 5000, expense: 3200, net: 1800, transactions: 42 } },
    accounts: [{ name: "Nubank", balance: 4000 }],
    pockets: [{ name: "Viagem", balance: 1200 }],
    budgets: [{ categoryId: "cat_mercado", category: "Mercado", amount: 1000, spent: 900 }]
  };
  const built = buildExternalSnapshotResult(snapshot);
  assert.equal(built.ok, true, JSON.stringify(built.body));
  return built.value;
}

async function issueTokenFor(uid) {
  const res = await request("/bridge/token", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` }
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.token && body.token.startsWith("mxc_"));
  return body.token;
}

async function depositFor(uid, envelope = envelopeFixture()) {
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` },
    body: JSON.stringify(envelope)
  });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}

async function mcp(token, payload) {
  return request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

/* ------------------------------------------------------------------ */
/* Autenticação do /mcp                                                */
/* ------------------------------------------------------------------ */

test("/mcp sem token → 401 missing_token", async () => {
  const res = await request("/mcp", { headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "missing_token");
});

test("/mcp com token inexistente → 401 invalid_mcp_token", async () => {
  const res = await mcp("mxc_falso", { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "invalid_mcp_token");
});

test("/mcp com ID token do Firebase (não token MCP) → 401", async () => {
  const res = await mcp(makeIdToken("uid-a"), { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.status, 401);
});

test("/mcp GET → 405 method_not_allowed", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await request("/mcp", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(res.status, 405);
});

/* ------------------------------------------------------------------ */
/* Protocolo MCP                                                       */
/* ------------------------------------------------------------------ */

test("initialize negocia versão e declara apenas capacidade tools", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await mcp(token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.jsonrpc, "2.0");
  assert.equal(body.id, 1);
  assert.equal(body.result.protocolVersion, "2025-06-18");
  assert.deepEqual(body.result.capabilities, { tools: {} });
  assert.equal(body.result.serverInfo.name, "livro-caixa-mcp");
});

test("tools/list devolve somente get_financial_snapshot", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await mcp(token, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const body = await res.json();
  const tools = body.result.tools;
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, MCP_TOOL_GET_FINANCIAL_SNAPSHOT);
  assert.deepEqual(tools[0].inputSchema.properties, {});
});

test("método desconhecido → -32601; ferramenta desconhecida → -32602", async () => {
  const token = await issueTokenFor("uid-a");
  const unknown = await (await mcp(token, { jsonrpc: "2.0", id: 3, method: "resources/list" })).json();
  assert.equal(unknown.error.code, -32601);

  const badTool = await (await mcp(token, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "delete_all_data" } })).json();
  assert.equal(badTool.error.code, -32602);
});

test("notificação sem id → 202 sem corpo", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await mcp(token, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("JSON-RPC inválido → -32600", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await mcp(token, { foo: "bar" });
  const body = await res.json();
  assert.equal(body.error.code, -32600);
});

/* ------------------------------------------------------------------ */
/* tools/call + isolamento                                             */
/* ------------------------------------------------------------------ */

test("tools/call sem snapshot depositado → isError snapshot_unavailable", async () => {
  const token = await issueTokenFor("uid-a");
  const res = await mcp(token, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT, arguments: {} } });
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.ok(body.result.content[0].text.includes("snapshot_unavailable"));
});

test("fluxo feliz: depositar → consultar → dados sem IDs internos", async () => {
  await depositFor("uid-a");
  const token = await issueTokenFor("uid-a");

  const res = await mcp(token, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT } });
  const body = await res.json();
  assert.ok(!body.result.isError, JSON.stringify(body.result));

  const payload = JSON.parse(body.result.content[0].text);
  assert.equal(payload.contractVersion, 1);
  assert.equal(payload.tool, MCP_TOOL_GET_FINANCIAL_SNAPSHOT);
  assert.equal(payload.data.accounts[0].name, "Nubank");
  assert.equal(payload.data.budgets[0].category, "Mercado");
  assert.ok(!("categoryId" in payload.data.budgets[0]), "categoryId não pode vazar");
});

test("isolamento: token de uid-b não enxerga o snapshot de uid-a", async () => {
  await depositFor("uid-a");
  const tokenB = await issueTokenFor("uid-b");

  const res = await mcp(tokenB, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT } });
  const body = await res.json();
  assert.equal(body.result.isError, true);
  assert.ok(body.result.content[0].text.includes("snapshot_unavailable"));
});

/* ------------------------------------------------------------------ */
/* /bridge — depósito e tokens                                         */
/* ------------------------------------------------------------------ */

test("/bridge/snapshot rejeita envelope com campos proibidos", async () => {
  const envelope = envelopeFixture();
  envelope.data.budgets[0].categoryId = "cat_vazamento";
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-a")}` },
    body: JSON.stringify(envelope)
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "forbidden_fields");
});

test("/bridge/snapshot sem Origin allowlist → 403 origin_blocked", async () => {
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: "https://evil.example", Authorization: `Bearer ${makeIdToken("uid-a")}` },
    body: JSON.stringify(envelopeFixture())
  });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, "origin_blocked");
});

test("/bridge/snapshot sem ID token → 401", async () => {
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(envelopeFixture())
  });
  assert.equal(res.status, 401);
});

test("revogação: dono revoga; outra conta não revoga; token revogado morre", async () => {
  const token = await issueTokenFor("uid-a");

  /* uid-b tenta revogar o token de uid-a → 403. */
  const cross = await request("/bridge/token", {
    method: "DELETE",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-b")}` },
    body: JSON.stringify({ token })
  });
  assert.equal(cross.status, 403);
  assert.equal((await cross.json()).code, "token_not_owned");

  /* Dono revoga → ok. */
  const owner = await request("/bridge/token", {
    method: "DELETE",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-a")}` },
    body: JSON.stringify({ token })
  });
  assert.equal(owner.status, 200);
  assert.equal((await owner.json()).revoked, true);

  /* Token revogado → 401. */
  const after = await mcp(token, { jsonrpc: "2.0", id: 8, method: "ping" });
  assert.equal(after.status, 401);
});

/* ------------------------------------------------------------------ */
/* Rate limit                                                          */
/* ------------------------------------------------------------------ */

test("/mcp respeita MCP_RATE_LIMIT_PER_MINUTE por token", async () => {
  env = makeEnv({ MCP_RATE_LIMIT_PER_MINUTE: "2" });
  const token = await issueTokenFor("uid-a");

  assert.equal((await mcp(token, { jsonrpc: "2.0", id: 1, method: "ping" })).status, 200);
  assert.equal((await mcp(token, { jsonrpc: "2.0", id: 2, method: "ping" })).status, 200);
  const third = await mcp(token, { jsonrpc: "2.0", id: 3, method: "ping" });
  assert.equal(third.status, 429);
  assert.equal((await third.json()).code, "mcp_rate_limited");

  /* Outro token (outro uid) tem bucket próprio. */
  const other = await issueTokenFor("uid-b");
  assert.equal((await mcp(other, { jsonrpc: "2.0", id: 4, method: "ping" })).status, 200);
});
