/* Testes do monitor de uso gratuito do OpenRouter: GET /openrouter-usage.
   Arquivo separado de propósito: a rota admin lê o provedor sem cache e
   distingue falhas de configuração/validação da resposta do provedor. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { makeAppCheckToken, APP_CHECK_JWKS_FRAGMENT } from "./helpers/appcheck.mjs";
import { makeKvMock } from "./helpers/kv.mjs";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";
const API_KEY = "sk-or-v1-chave-fake-0123456789abcdef";
const ADMIN_EMAIL = "admin@exemplo.com";

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

function makeToken(sub, email) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: "test-key-1" }));
  const body = b64url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${PROJ}`,
      aud: PROJ,
      sub,
      email: email || "",
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
  providerStatus: 200
};

const appCheckToken = makeAppCheckToken(privateKey, PROJ);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes("googleapis.com/service_accounts")) return jsonResponse({ keys: [pubJwk] });
  if (target.includes(APP_CHECK_JWKS_FRAGMENT)) return jsonResponse({ keys: [pubJwk] });
  if (target === "https://openrouter.ai/api/v1/key") {
    if (state.providerStatus !== 200) {
      return jsonResponse({ error: { message: "provider failure" } }, state.providerStatus);
    }
    return jsonResponse({ data: { free_model_daily_requests: state.quota } });
  }
  if (target.includes("openrouter.ai/api/v1/chat/completions")) {
    return jsonResponse({ choices: [{ message: { content: "ok" } }] });
  }
  throw new Error(`fetch inesperado: ${target}`);
};

const env = {
  ALLOW_ORIGINS: `http://127.0.0.1:8000,http://localhost:8000,${ORIGIN}`,
  FIREBASE_PROJECT_ID: PROJ,
  OPENROUTER_API_KEY: API_KEY,
  OPENROUTER_MODELS: "modelo-a:free,modelo-b:free",
  AI_RATE_LIMIT_PER_MINUTE: "30",
  OPENROUTER_USAGE_ADMIN_EMAIL: ADMIN_EMAIL,
  QUOTA_KV: makeKvMock(),
  RATE_LIMIT_KV: makeKvMock()
};

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;

function call(path, { method = "GET", token, body, envOverride } = {}) {
  const requestEnv = envOverride || env;
  const headers = { "content-type": "application/json", Origin: ORIGIN, "X-Firebase-AppCheck": appCheckToken };
  if (token) headers.Authorization = `Bearer ${token}`;
  return workerFetch(new Request(`${BASE}${path}`, { method, headers, body }), requestEnv);
}

async function expectError(res, status, code) {
  assert.equal(res.status, status, `status esperado ${status}, veio ${res.status}`);
  const body = await res.json();
  assert.equal(body.code, code, `code esperado ${code}, veio ${JSON.stringify(body)}`);
  assert.ok(!JSON.stringify(body).includes(API_KEY), "chave da API vazou no corpo");
  return body;
}

test("GET /openrouter-usage sem token → 401 missing_token", async () => {
  const res = await call("/openrouter-usage");
  await expectError(res, 401, "missing_token");
});

test("GET /openrouter-usage com usuário comum → 403 admin_forbidden", async () => {
  const res = await call("/openrouter-usage", { token: makeToken("u-common", "user@exemplo.com") });
  await expectError(res, 403, "admin_forbidden");
});

test("GET /openrouter-usage com e-mail do admin em case diferente → 200", async () => {
  const res = await call("/openrouter-usage", { token: makeToken("u-admin-case", "ADMIN@EXEMPLO.COM") });
  const body = await res.json();
  assert.equal(res.status, 200, "admin configurado com case diferente deve autorizar");
  assert.equal(body.free_model_daily_requests.used, 10);
});

test("GET /openrouter-usage com chave ausente no Worker → 503 openrouter_key_missing", async () => {
  const res = await call("/openrouter-usage", {
    token: makeToken("u-admin", ADMIN_EMAIL),
    envOverride: { ...env, OPENROUTER_API_KEY: undefined }
  });
  await expectError(res, 503, "openrouter_key_missing");
});

test("GET /openrouter-usage → 200 com free_model_daily_requests e timestamp", async () => {
  state.quota = { limit: 100, used: 10, remaining: 90 };
  const res = await call("/openrouter-usage", { token: makeToken("u-admin", ADMIN_EMAIL) });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.free_model_daily_requests, { used: 10, limit: 100, remaining: 90 });
  assert.equal(typeof body.timestamp, "string");
  assert.ok(!JSON.stringify(body).includes(API_KEY), "chave da API vazou no corpo");
});

test("GET /openrouter-usage com provedor indisponível → 502 openrouter_unavailable", async () => {
  state.providerStatus = 500;
  const res = await call("/openrouter-usage", { token: makeToken("u-admin", ADMIN_EMAIL) });
  await expectError(res, 502, "openrouter_unavailable");
  state.providerStatus = 200;
});

test("GET /openrouter-usage com resposta inválida do provedor → 502 openrouter_invalid_response", async () => {
  state.quota = null;
  const res = await call("/openrouter-usage", { token: makeToken("u-admin", ADMIN_EMAIL) });
  await expectError(res, 502, "openrouter_invalid_response");
});

test("GET /openrouter-usage rejeita método não GET → 405 method_not_allowed", async () => {
  const res = await call("/openrouter-usage", { method: "POST" });
  await expectError(res, 405, "method_not_allowed");
});
