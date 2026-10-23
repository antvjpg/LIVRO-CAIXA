/* Fase 3 — Segurança da Ponte de IA (MCP read-only).
   Execução: node --test worker/test/*.test.mjs

   Cobre as lacunas encontradas na revisão de segurança da V1:
   - corpo de /mcp com teto próprio (64 KB) e JSON malformado/batch;
   - rate limit ANTES da autenticação (por IP) em /mcp;
   - teto de corpo em /bridge/snapshot e /bridge/token;
   - envelope válido porém > 64 KB rejeitado pelo contrato (413);
   - teto de tokens ativos por conta (409) e vaga liberada por revogação;
   - métodos errados nas rotas da ponte;
   - eco truncado de identificadores em erros JSON-RPC;
   - id:null tratado como requisição (não como notificação);
   - Worker sem KV: respostas 401/503, nunca 500 cru. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { makeKvMock } from "./helpers/kv.mjs";
import { buildExternalSnapshotResult, MCP_TOOL_GET_FINANCIAL_SNAPSHOT } from "../../js/domain/mcp-financial-contract.js";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubJwk = { ...publicKey.export({ format: "jwk" }), kid: "sec-key-1", alg: "RS256", use: "sig" };

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeIdToken(sub) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "sec-key-1" }));
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
  if (target.includes("googleapis.com") || target.includes("securetoken")) {
    return new Response(JSON.stringify({ keys: [pubJwk] }), { status: 200 });
  }
  throw new Error(`fetch inesperado: ${target}`);
};

function makeEnv(overrides = {}) {
  return {
    ALLOW_ORIGINS: `http://127.0.0.1:8000,http://localhost:8000,${ORIGIN}`,
    FIREBASE_PROJECT_ID: PROJ,
    RATE_LIMIT_KV: makeKvMock(),
    MCP_RATE_LIMIT_PER_MINUTE: "1000",
    MCP_ANON_RATE_LIMIT_PER_MINUTE: "1000",
    BRIDGE_RATE_LIMIT_PER_MINUTE: "1000",
    ...overrides
  };
}

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;

let env = makeEnv();

test.beforeEach(() => {
  env = makeEnv();
});

function request(path, { method = "POST", headers = {}, body, ip } = {}) {
  const h = { ...headers };
  if (ip) h["cf-connecting-ip"] = ip;
  return workerFetch(new Request(`${BASE}${path}`, { method, headers: h, body }), env);
}

async function issueTokenFor(uid) {
  const res = await request("/bridge/token", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` }
  });
  const raw = await res.text();
  assert.equal(res.status, 201, raw);
  return JSON.parse(raw).token;
}

async function mcp(token, payload, options = {}) {
  return request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    ...options
  });
}

function envelopeFixture(extraData = {}) {
  const snapshot = {
    schemaVersion: "P3.5",
    generatedAt: "2026-10-12T12:00:00.000Z",
    period: { currentMonth: "2026-10", currentMonthTotals: { income: 5000, expense: 3200, net: 1800, transactions: 42 } },
    accounts: [{ name: "Nubank", balance: 4000 }],
    ...extraData
  };
  const built = buildExternalSnapshotResult(snapshot);
  assert.equal(built.ok, true, JSON.stringify(built.body));
  return built.value;
}

/* ------------------------------------------------------------------ */
/* Corpo da requisição                                                 */
/* ------------------------------------------------------------------ */

test("/mcp: corpo acima de 64 KB → 413 payload_too_large", async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "x", pad: "y".repeat(70 * 1024) })
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "payload_too_large");
});

test("/mcp: JSON malformado → 400 bad_body", async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: "{isso nao é json"
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "bad_body");
});

test("/mcp: batch em array → 400 (V1 aceita 1 mensagem por requisição)", async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "ping" }])
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "bad_body");
});

test("/bridge/snapshot: corpo acima de 128 KB → 413 (nunca lê 24 MB)", async () => {
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` },
    body: JSON.stringify({ pad: "z".repeat(200 * 1024) })
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "payload_too_large");
});

test("/bridge/snapshot: envelope válido > 64 KB → 413 snapshot_too_large (contrato)", async () => {
  const envelope = envelopeFixture();
  envelope.data.huge = "h".repeat(70 * 1024);
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` },
    body: JSON.stringify(envelope)
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "snapshot_too_large");
});

test("/bridge/token DELETE: corpo acima de 8 KB → 413", async () => {
  const res = await request("/bridge/token", {
    method: "DELETE",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` },
    body: JSON.stringify({ token: "mxc_" + "a".repeat(9 * 1024) })
  });
  assert.equal(res.status, 413);
  assert.equal((await res.json()).code, "payload_too_large");
});

test("/bridge/token DELETE: sem campo token → 400 missing_token_field", async () => {
  const res = await request("/bridge/token", {
    method: "DELETE",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` },
    body: JSON.stringify({ outro: "x" })
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "missing_token_field");
});

/* ------------------------------------------------------------------ */
/* Rate limit pré-autenticação                                         */
/* ------------------------------------------------------------------ */

test("/mcp: limite por IP ANTES do token (sem token válido não isenta)", async () => {
  env = makeEnv({ MCP_ANON_RATE_LIMIT_PER_MINUTE: "3" });
  const headers = { "content-type": "application/json" };
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" });

  let last;
  for (let i = 0; i < 4; i++) {
    last = await request("/mcp", { headers, body, ip: "203.0.113.7" });
  }
  assert.equal(last.status, 429);
  assert.equal((await last.json()).code, "mcp_rate_limited");

  /* Outro IP segue com bucket próprio. */
  const other = await request("/mcp", { headers, body, ip: "203.0.113.8" });
  assert.equal(other.status, 401, "outro IP não deve estar limitado");
  assert.equal((await other.json()).code, "missing_token");
});

/* ------------------------------------------------------------------ */
/* Um token ativo por conta: gerar novo revoga os anteriores          */
/* ------------------------------------------------------------------ */

test("gerar novo token revoga o anterior automaticamente", async () => {
  const first = await issueTokenFor("uid-single");

  const second = await request("/bridge/token", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-single")}` }
  });
  assert.equal(second.status, 201);
  const secondToken = (await second.json()).token;
  assert.notEqual(secondToken, first);

  /* O token antigo parou de autenticar. */
  const mcpOld = await request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${first}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  assert.equal(mcpOld.status, 401);

  /* O novo autentica. */
  const mcpNew = await request("/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${secondToken}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  assert.equal(mcpNew.status, 200);
});

test("emissão não é bloqueada por teto: 6 emissões seguidas sempre retornam 201", async () => {
  for (let i = 0; i < 6; i++) {
    const res = await request("/bridge/token", {
      headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-nofence")}` }
    });
    assert.equal(res.status, 201, `emissão ${i + 1} deve ser 201`);
  }
});

/* ------------------------------------------------------------------ */
/* Métodos                                                             */
/* ------------------------------------------------------------------ */

test("PUT /bridge/token e GET /bridge/snapshot → 405", async () => {
  const put = await request("/bridge/token", {
    method: "PUT",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` }
  });
  assert.equal(put.status, 405);

  const get = await request("/bridge/snapshot", {
    method: "GET",
    headers: { Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` }
  });
  assert.equal(get.status, 405);
});

/* ------------------------------------------------------------------ */
/* Protocolo: eco e notificações                                       */
/* ------------------------------------------------------------------ */

test("ferramenta desconhecida longa: eco truncado na mensagem de erro", async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await mcp(token, {
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "x".repeat(5000) }
  });
  const body = await res.json();
  assert.equal(body.error.code, -32602);
  assert.ok(body.error.message.length < 300, `eco muito longo: ${body.error.message.length} chars`);
});

test('id:null é requisição (responde), não notificação', async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await mcp(token, { jsonrpc: "2.0", id: null, method: "ping" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, null);
  assert.deepEqual(body.result, { pong: true });
});

/* ------------------------------------------------------------------ */
/* Sem KV (indisponibilidade nunca vira 500 cru)                       */
/* ------------------------------------------------------------------ */

test("sem KV: /mcp → 401 e /bridge → 503, ambos JSON", async () => {
  env = makeEnv({ RATE_LIMIT_KV: undefined });

  const mcpRes = await request("/mcp", {
    headers: { "content-type": "application/json", Authorization: "Bearer mxc_qualquer" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  assert.equal(mcpRes.status, 401);
  assert.equal((await mcpRes.json()).code, "invalid_mcp_token");

  const tokenRes = await request("/bridge/token", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` }
  });
  assert.equal(tokenRes.status, 503);
  assert.equal((await tokenRes.json()).code, "store_unavailable");

  const snapRes = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-sec")}` },
    body: JSON.stringify(envelopeFixture())
  });
  assert.equal(snapRes.status, 503);
  assert.equal((await snapRes.json()).code, "store_unavailable");
});

/* ------------------------------------------------------------------ */
/* Read-only: nenhuma ferramenta de escrita existe sequer              */
/* ------------------------------------------------------------------ */

test("tools/list só devolve get_financial_snapshot (regressão do contrato)", async () => {
  const token = await issueTokenFor("uid-sec");
  const res = await mcp(token, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const body = await res.json();
  const names = body.result.tools.map((t) => t.name);
  assert.deepEqual(names, [MCP_TOOL_GET_FINANCIAL_SNAPSHOT]);
  for (const forbidden of ["create", "update", "delete", "write", "set", "remove"]) {
    for (const name of names) {
      assert.ok(!name.toLowerCase().includes(forbidden), `ferramenta suspeita: ${name}`);
    }
  }
});
