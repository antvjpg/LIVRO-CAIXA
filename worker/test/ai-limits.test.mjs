/* Testes de limites da rota de IA: cota diária e rate limit.
   Arquivo separado de propósito: cota e bucket de requisições são estado
   por isolate e não podem ser zerados a meio da execução. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";
const API_KEY = "sk-or-v1-chave-fake-0123456789abcdef";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const pubJwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "test-key-1",
  alg: "RS256",
  use: "sig"
};

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(sub) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key-1" }));
  const body = b64url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJ}`,
      aud: PROJ,
      sub,
      iat: now,
      exp: now + 3600
    })
  );
  const data = `${head}.${body}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
  return `${data}.${sig}`;
}

const state = {
  quota: { limit: 100, used: 10, remaining: 90 },
  openRouterCalls: []
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes("googleapis.com/service_accounts")) return jsonResponse({ keys: [pubJwk] });
  if (target === "https://openrouter.ai/api/v1/key") {
    return jsonResponse({ data: { free_model_daily_requests: state.quota } });
  }
  if (target.includes("openrouter.ai/api/v1/chat/completions")) {
    state.openRouterCalls.push(JSON.parse(init.body));
    return jsonResponse({ choices: [{ message: { content: "ok" } }] });
  }
  throw new Error(`fetch inesperado: ${target}`);
};

const env = {
  ALLOW_ORIGINS: `http://127.0.0.1:8000,http://localhost:8000,${ORIGIN}`,
  FIREBASE_PROJECT_ID: PROJ,
  OPENROUTER_API_KEY: API_KEY,
  OPENROUTER_MODELS: "modelo-a:free,modelo-b:free",
  AI_RATE_LIMIT_PER_MINUTE: "30"
};

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;

function call(path, { method = "POST", token, body } = {}) {
  const headers = { "content-type": "application/json", Origin: ORIGIN };
  if (token) headers.Authorization = `Bearer ${token}`;
  return workerFetch(new Request(`${BASE}${path}`, { method, headers, body }), env);
}

async function expectError(res, status, code) {
  assert.equal(res.status, status, `status esperado ${status}, veio ${res.status}`);
  const body = await res.json();
  assert.equal(body.code, code, `code esperado ${code}, veio ${JSON.stringify(body)}`);
  assert.ok(!JSON.stringify(body).includes(API_KEY), "chave da API vazou no corpo");
  return body;
}

/* Lê a cota autoritativa da API simulada antes de cada cenário: o cache
   interno de cota vive 60 s e é compartilhado por todo o processo. */
async function refreshQuota() {
  const res = await call("/quota", { method: "GET", token: makeToken("u-quota") });
  assert.equal(res.status, 200);
  return res.json();
}

test("cota diária zerada → 429 daily_limit sem chamar o provedor", async () => {
  state.quota = { limit: 100, used: 100, remaining: 0 };
  const quota = await refreshQuota();
  assert.equal(quota.remaining, 0);

  state.openRouterCalls = [];
  const res = await call("/ai", {
    token: makeToken("u-daily"),
    body: JSON.stringify({ prompt: "oi", maxTokens: 900 })
  });
  const body = await expectError(res, 429, "daily_limit");
  assert.equal(body.quota.remaining, 0);
  assert.equal(res.headers.get("X-AI-Quota-Remaining"), "0");
  assert.equal(state.openRouterCalls.length, 0, "cota esgotada não pode chegar ao provedor");
});

test("rate limit por uid → 429 rate_limited na 2ª chamada do minuto", async () => {
  state.quota = { limit: 100, used: 10, remaining: 90 };
  await refreshQuota();
  env.AI_RATE_LIMIT_PER_MINUTE = "1";

  const token = makeToken("u-rate");
  const payload = JSON.stringify({ prompt: "oi", maxTokens: 900 });

  const first = await call("/ai", { token, body: payload });
  assert.equal(first.status, 200);
  assert.equal(state.openRouterCalls.length, 1);

  const second = await call("/ai", { token, body: payload });
  await expectError(second, 429, "rate_limited");
  assert.equal(state.openRouterCalls.length, 1, "requisição bloqueada não pode chegar ao provedor");

  /* Outro uid tem bucket próprio: não disputa contador. */
  const other = await call("/ai", { token: makeToken("u-rate-2"), body: payload });
  assert.equal(other.status, 200, "rate limit deveria ser por uid e não global");
  env.AI_RATE_LIMIT_PER_MINUTE = "30";
});
