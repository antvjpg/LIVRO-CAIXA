/* Fase 4 (preparação) — Conformidade de SESSÃO de um cliente MCP real.
   Execução: node --test worker/test/*.test.mjs  |  npm run code:mcp

   Simula a sequência exata que um conector externo (ex.: Claude) executa
   ao conectar em https://…/mcp — sem Origin (navegação de servidor, não
   de navegador), com cabeçalhos Accept/MCP-Protocol-Version reais — e os
   modos de falha que a Fase 4 exige testar: snapshot ausente, KV com
   exceção no meio da sessão e indisponibilidade do armazenamento.

   Observação sobre autenticação do conector: o Claude envia
   `Authorization: Bearer <token>` via "Request headers" (beta). Nada de
   token em query string — a especificação MCP proíbe e a própria
   documentação da Anthropic desaconsenha. Este arquivo valida que o
   header Bearer é o único mecanismo aceito em /mcp. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { makeKvMock } from "./helpers/kv.mjs";
import { buildExternalSnapshotResult, MCP_TOOL_GET_FINANCIAL_SNAPSHOT } from "../../js/domain/mcp-financial-contract.js";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";
const PROTOCOL_VERSION = "2025-06-18";

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

/* Requisição como um conector externo faria: SEM Origin (Anthropic
   cloud → Worker), Accept do Streamable HTTP, sem App Check. */
function connectorPost(payload, token, extraHeaders = {}) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "user-agent": "claude-mcp-connector/1.0",
    authorization: `Bearer ${token}`,
    ...extraHeaders
  };
  return workerFetch(new Request(`${BASE}/mcp`, { method: "POST", headers, body: JSON.stringify(payload) }), env);
}

async function issueTokenFor(uid) {
  const res = await workerFetch(
    new Request(`${BASE}/bridge/token`, {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` }
    }),
    env
  );
  const raw = await res.text();
  assert.equal(res.status, 201, raw);
  return JSON.parse(raw).token;
}

async function depositSnapshotFor(uid) {
  const built = buildExternalSnapshotResult({
    schemaVersion: "P3.5",
    generatedAt: "2026-10-12T12:00:00.000Z",
    period: { currentMonth: "2026-10", currentMonthTotals: { income: 5000, expense: 3200, net: 1800, transactions: 42 } },
    accounts: [{ name: "Nubank", balance: 4000 }]
  });
  assert.equal(built.ok, true, JSON.stringify(built.body));
  const res = await workerFetch(
    new Request(`${BASE}/bridge/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` },
      body: JSON.stringify(built.value)
    }),
    env
  );
  assert.equal(res.status, 200, await res.text());
}

/* ------------------------------------------------------------------ */
/* Sessão feliz completa (o que o conector faz ao conectar)            */
/* ------------------------------------------------------------------ */

test("sessão completa: initialize → initialized → tools/list → tools/call", async () => {
  const uid = "uid-session";
  const token = await issueTokenFor(uid);
  await depositSnapshotFor(uid);

  /* 1. initialize — sem Origin (servidor → servidor). */
  const init = await connectorPost(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { roots: { listChanged: false } },
        clientInfo: { name: "claude", version: "1.0.0" }
      }
    },
    token
  );
  assert.equal(init.status, 200, "conector sem Origin não pode receber 403");
  const initBody = await init.json();
  assert.equal(initBody.result.protocolVersion, PROTOCOL_VERSION);
  assert.deepEqual(initBody.result.capabilities, { tools: {} });
  assert.equal(initBody.result.serverInfo.name, "livro-caixa-mcp");
  assert.ok(initBody.result.instructions.includes(MCP_TOOL_GET_FINANCIAL_SNAPSHOT));

  /* 2. notification (sem id) → 202 sem corpo. */
  const notif = await connectorPost(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    token
  );
  assert.equal(notif.status, 202);
  assert.equal(await notif.text(), "");

  /* 3. tools/list com MCP-Protocol-Version (cabeçalho da spec 2025-06-18). */
  const list = await connectorPost(
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    token,
    { "mcp-protocol-version": PROTOCOL_VERSION }
  );
  const listBody = await list.json();
  assert.equal(listBody.result.tools.length, 1);
  const tool = listBody.result.tools[0];
  assert.equal(tool.name, MCP_TOOL_GET_FINANCIAL_SNAPSHOT);
  assert.equal(tool.inputSchema.additionalProperties, false);

  /* 4. tools/call (conectores sempre enviam arguments, ainda que vazio). */
  const call = await connectorPost(
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT, arguments: {} }
    },
    token
  );
  const callBody = await call.json();
  assert.equal(callBody.error, undefined);
  assert.ok(!callBody.result.isError, JSON.stringify(callBody.result));
  const parsed = JSON.parse(callBody.result.content[0].text);
  assert.equal(parsed.contractVersion, 1);
  assert.equal(parsed.tool, MCP_TOOL_GET_FINANCIAL_SNAPSHOT);
  assert.ok(parsed.data.accounts.length >= 1);

  /* 5. ping (keepalive que alguns clientes emitem). */
  const ping = await connectorPost({ jsonrpc: "2.0", id: 4, method: "ping" }, token);
  assert.deepEqual((await ping.json()).result, { pong: true });
});

/* ------------------------------------------------------------------ */
/* Versões de protocolo                                                */
/* ------------------------------------------------------------------ */

test("initialize com versão antiga (2024-11-05): servidor responde com a versão que suporta", async () => {
  const token = await issueTokenFor("uid-ver");
  const res = await connectorPost(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "legado", version: "0" } }
    },
    token
  );
  const body = await res.json();
  /* Spec: servidor declara a versão que suporta; o cliente decide. */
  assert.equal(body.result.protocolVersion, PROTOCOL_VERSION);
});

test("initialize sem params.protocolVersion: servidor declara a sua", async () => {
  const token = await issueTokenFor("uid-ver2");
  const res = await connectorPost({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, token);
  const body = await res.json();
  assert.equal(body.result.protocolVersion, PROTOCOL_VERSION);
});

/* ------------------------------------------------------------------ */
/* Modos de falha da Fase 4                                            */
/* ------------------------------------------------------------------ */

test("sem snapshot: tools/call → isError com orientação (não invenção de dados)", async () => {
  const token = await issueTokenFor("uid-vazio");

  const init = await connectorPost(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "c", version: "0" } } },
    token
  );
  assert.equal((await init.json()).result.protocolVersion, PROTOCOL_VERSION);

  const call = await connectorPost(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT, arguments: {} } },
    token
  );
  const body = await call.json();
  assert.equal(body.result.isError, true);
  const payload = JSON.parse(body.result.content[0].text);
  assert.equal(payload.error, "snapshot_unavailable");
  /* O texto deve orientar a depositar, jamais conter números inventados. */
  assert.ok(payload.message.includes("LIVRO-CAIXA"));
  assert.equal(body.result.content[0].type, "text");
});

test("KV com exceção no meio da sessão: resposta MCP de erro, nunca 500", async () => {
  const token = await issueTokenFor("uid-kv-erro");
  const kvSaudavel = env.RATE_LIMIT_KV;

  /* Sessão autenticada, e ENTÃO o KV do snapshot quebra: token ainda
     resolve (mesmo namespace), mas leitura/escrita de snapshot falha. */
  const kvQuebrado = {
    get: (key) =>
      String(key).startsWith("mcp:tok:")
        ? kvSaudavel.get(key)
        : Promise.reject(new Error("KV do snapshot indisponível")),
    put: () => Promise.reject(new Error("KV do snapshot indisponível")),
    delete: () => Promise.reject(new Error("KV do snapshot indisponível"))
  };
  env = makeEnv({ RATE_LIMIT_KV: kvQuebrado });

  /* Rate limit falha aberto (isRateLimitedKV) e o armazenamento devolve
     "sem snapshot": a sessão continua respondendo JSON-RPC, nunca 500. */
  const init = await connectorPost(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "c", version: "0" } } },
    token
  );
  assert.equal(init.status, 200, "falha de KV não pode derrubar o handshake");
  assert.equal((await init.json()).result.protocolVersion, PROTOCOL_VERSION);

  const call = await connectorPost(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT, arguments: {} } },
    token
  );
  assert.equal(call.status, 200, "falha de KV não pode virar 500");
  const body = await call.json();
  assert.equal(body.result.isError, true);
  assert.equal(JSON.parse(body.result.content[0].text).error, "snapshot_unavailable");
});

test("defesa de última camada: exceção não tratada vira JSON 500 estruturado", async () => {
  /* Simula falha que escapa do tratamento da rota (ex.: resposta
     inválida do upstream) — o conector deve receber JSON, não HTML. */
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes("googleapis.com")) throw new Error("rede fora");
      throw new Error(`fetch inesperado: ${url}`);
    };
    /* Sem Origin e sem token o caminho falce não é atingido; usamos a
       rota /bridge/token sem Origin — cai em origin_blocked (não é
       esse o teste). Em vez disso, provocamos exceção via JWKS: */
    const res = await workerFetch(
      new Request(`${BASE}/bridge/token`, {
        method: "POST",
        headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken("uid-x")}` }
      }),
      makeEnv({ RATE_LIMIT_KV: { get: () => { throw new Error("boom"); }, put: async () => {}, delete: async () => {} } })
    );
    /* Com limitador fail-open, o pior caso é 500 JSON do wrapper ou 503
       store_unavailable — o ponto é: a resposta SEMPRE é JSON. */
    const raw = await res.text();
    assert.ok(raw.startsWith("{"), `resposta não-JSON (status ${res.status}): ${raw.slice(0, 80)}`);
    if (res.status >= 500) {
      assert.equal(JSON.parse(raw).code, "internal_error");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ------------------------------------------------------------------ */
/* Autenticação: só header Bearer (sem query string)                   */
/* ------------------------------------------------------------------ */

test("token NÃO é aceito em query string (spec MCP proíbe token na URL)", async () => {
  const token = await issueTokenFor("uid-query");
  const res = await workerFetch(
    new Request(`${BASE}/mcp?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
    }),
    env
  );
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "missing_token");
});
