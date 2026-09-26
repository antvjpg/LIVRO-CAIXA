/* Testes de regressão da rota de IA (POST /ai, GET /quota, CORS e
   validação). Execução: node --test worker/test/

   Cada arquivo de teste roda em processo próprio: stubs de fetch/cache e
   limites por janela não vazam entre arquivos. */

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
  openRouterCalls: [],
  onChat: null
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
    const call = JSON.parse(init.body);
    state.openRouterCalls.push(call);
    if (state.onChat) return state.onChat(call);
    return jsonResponse({ choices: [{ message: { content: "  Resposta da IA  " } }] });
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
const validation = await import(new URL("../src/shared/validation.js", import.meta.url));

function post(path, { origin = ORIGIN, token, body, headers = {}, method = "POST" } = {}) {
  const finalHeaders = { "content-type": "application/json", ...headers };
  if (origin) finalHeaders.Origin = origin;
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  return workerFetch(new Request(`${BASE}${path}`, { method, headers: finalHeaders, body }), env);
}

async function expectError(res, status, code) {
  assert.equal(res.status, status, `status esperado ${status}, veio ${res.status}`);
  const body = await res.json();
  assert.equal(body.code, code, `code esperado ${code}, veio ${JSON.stringify(body)}`);
  assert.equal(typeof body.error, "string");
  assert.ok(!("provider" in body), "campo interno 'provider' vazou para o cliente");
  assert.ok(!JSON.stringify(body).includes(API_KEY), "chave da API vazou no corpo");
  return body;
}

/* ---------- unidades: validação ---------- */

test("prompt vazio → empty_prompt", () => {
  const r = validation.validateAiPayload({ prompt: "   ", maxTokens: 900 });
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "empty_prompt");
});

test("prompt no limite exato é aceito", () => {
  const r = validation.validateAiPayload({ prompt: "x".repeat(60000), maxTokens: 900 });
  assert.equal(r.ok, true);
  assert.equal(r.value.prompt.length, 60000);
});

test("prompt acima do limite → prompt_too_long", () => {
  const r = validation.validateAiPayload({ prompt: "x".repeat(60001), maxTokens: 900 });
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "prompt_too_long");
  assert.equal(r.status, 400);
});

test("maxTokens inválido em todas as formas → invalid_max_tokens", async (t) => {
  for (const [label, value] of [
    ["ausente", undefined],
    ["zero", 0],
    ["negativo", -1],
    ["fracionário", 1.5],
    ["string", "900"],
    ["NaN", NaN],
    ["acima do teto", 4097]
  ]) {
    await t.test(label, () => {
      const payload = { prompt: "oi" };
      if (value !== undefined) payload.maxTokens = value;
      const r = validation.validateAiPayload(payload);
      assert.equal(r.ok, false);
      assert.equal(r.body.code, "invalid_max_tokens");
    });
  }
});

test("maxTokens 1 e 4096 aceitos", () => {
  assert.equal(validation.validateAiPayload({ prompt: "oi", maxTokens: 1 }).ok, true);
  assert.equal(validation.validateAiPayload({ prompt: "oi", maxTokens: 4096 }).ok, true);
});

test("sem imagem → imageUrl null", () => {
  const r = validation.validateAiPayload({ prompt: "oi", maxTokens: 900 });
  assert.equal(r.value.imageUrl, null);
});

test("imagePart malformado → invalid_image", () => {
  assert.equal(
    validation.validateAiPayload({ prompt: "oi", maxTokens: 900, imagePart: {} }).body.code,
    "invalid_image"
  );
  assert.equal(
    validation.validateAiPayload({ prompt: "oi", maxTokens: 900, imagePart: { image_url: {} } }).body.code,
    "invalid_image"
  );
});

test("URL http(s) de imagem rejeitada", () => {
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { type: "image_url", image_url: { url: "https://exemplo.com/x.png" } }
  });
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "invalid_image");
});

test("tipo de arquivo fora da allowlist → invalid_image", () => {
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: "data:image/gif;base64,AAAA" } }
  });
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "invalid_image");
});

test("base64 malformado → invalid_image", () => {
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: "data:image/png;base64,AAA" } }
  });
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "invalid_image");
});

test("PNG pequeno aceito", () => {
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: "data:image/png;base64,AAAA" } }
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.imageUrl, "data:image/png;base64,AAAA");
});

test("PNG acima de 7 MB → image_too_large (413)", () => {
  const big = "A".repeat(10485764);
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: `data:image/png;base64,${big}` } }
  });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "image_too_large");
});

test("PDF acima de 15 MB → image_too_large (413)", () => {
  const big = "A".repeat(20971524);
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: `data:application/pdf;base64,${big}` } }
  });
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "image_too_large");
});

test("PDF de 14 MB aceito", () => {
  const big = "A".repeat(19660800);
  const r = validation.validateAiPayload({
    prompt: "oi",
    maxTokens: 900,
    imagePart: { image_url: { url: `data:application/pdf;base64,${big}` } }
  });
  assert.equal(r.ok, true);
});

test("payload não-objeto → bad_body", () => {
  assert.equal(validation.validateAiPayload(null).body.code, "bad_body");
  assert.equal(validation.validateAiPayload([1]).body.code, "bad_body");
});

test("JSON inválido → bad_body", async () => {
  const req = new Request(`${BASE}/ai`, { method: "POST", body: "{nope" });
  const r = await validation.readJsonBody(req);
  assert.equal(r.ok, false);
  assert.equal(r.status, 400);
  assert.equal(r.body.code, "bad_body");
});

test("corpo acima de 24 MiB → payload_too_large", async () => {
  const req = new Request(`${BASE}/ai`, {
    method: "POST",
    headers: { "content-length": String(validation.MAX_BODY_BYTES + 1) },
    body: "{}"
  });
  const r = await validation.readJsonBody(req);
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "payload_too_large");
});

/* ---------- rotas / CORS ---------- */

test("OPTIONS origem permitida → 204", async () => {
  const res = await workerFetch(new Request(`${BASE}/ai`, { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  const exposed = res.headers.get("access-control-expose-headers");
  assert.match(exposed, /X-AI-Quota-Limit/);
  assert.match(exposed, /X-Financial-Cache/);
});

test("OPTIONS origem não listada → 403", async () => {
  const res = await workerFetch(
    new Request(`${BASE}/ai`, { method: "OPTIONS", headers: { Origin: "https://evil.test" } }),
    env
  );
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
});

test("/health → 200 { ok: true }", async () => {
  const res = await workerFetch(new Request(`${BASE}/health`), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test("rota desconhecida → 404 not_found", async () => {
  const res = await workerFetch(new Request(`${BASE}/rota-inexistente`, { headers: { Origin: ORIGIN } }), env);
  await expectError(res, 404, "not_found");
});

test("/ai sem Origin → 403 origin_blocked", async () => {
  const res = await workerFetch(new Request(`${BASE}/ai`, { method: "POST", body: "{}" }), env);
  await expectError(res, 403, "origin_blocked");
});

test("GET /ai → 405 method_not_allowed", async () => {
  const res = await post("/ai", { method: "GET" });
  await expectError(res, 405, "method_not_allowed");
});

test("POST /ai sem token → 401 missing_token", async () => {
  const res = await post("/ai", { body: JSON.stringify({ prompt: "oi", maxTokens: 900 }) });
  await expectError(res, 401, "missing_token");
});

test("POST /ai token malformado → 401 invalid_token", async () => {
  const res = await post("/ai", { token: "abc", body: JSON.stringify({ prompt: "oi", maxTokens: 900 }) });
  await expectError(res, 401, "invalid_token");
});

test("GET /quota sem token → 401 missing_token", async () => {
  const res = await post("/quota", { method: "GET" });
  await expectError(res, 401, "missing_token");
});

test("POST /quota → 405 method_not_allowed", async () => {
  const res = await post("/quota", { method: "POST", token: makeToken("u-method") });
  await expectError(res, 405, "method_not_allowed");
});

test("GET /quota com token → contrato completo", async () => {
  const res = await post("/quota", { method: "GET", token: makeToken("u-quota") });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(Object.keys(body).sort(), ["day", "limit", "remaining", "resetAt", "used"]);
  assert.equal(body.limit, 100);
  /* O index.html lê /quota pelo corpo (setQuota) e /ai pelos headers:
     a rota /quota não emite X-AI-Quota-* e isso não muda aqui. */
  assert.equal(res.headers.get("X-AI-Quota-Limit"), null);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
});

/* ---------- /ai de ponta a ponta ---------- */

test("/ai sucesso → { text, model } + headers de cota", async () => {
  state.openRouterCalls = [];
  const res = await post("/ai", {
    token: makeToken("u-ok"),
    body: JSON.stringify({ prompt: "Analise", maxTokens: 1400 })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { text: "Resposta da IA", model: "modelo-a:free" });
  assert.equal(res.headers.get("X-AI-Quota-Limit"), "100");
  /* burnQuota roda antes de montar os headers: 90 → 89 na resposta. */
  assert.equal(res.headers.get("X-AI-Quota-Remaining"), "89");
  assert.ok(res.headers.get("X-AI-Quota-Reset"));
  assert.equal(state.openRouterCalls.length, 1);
  assert.equal(state.openRouterCalls[0].max_tokens, 1400);
  assert.equal(state.openRouterCalls[0].messages[0].content, "Analise");
});

test("/ai com imagem monta content multimodal", async () => {
  state.openRouterCalls = [];
  const res = await post("/ai", {
    token: makeToken("u-img"),
    body: JSON.stringify({
      prompt: "Comprovante",
      maxTokens: 500,
      imagePart: { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }
    })
  });
  assert.equal(res.status, 200);
  const call = state.openRouterCalls[0];
  assert.equal(call.messages[0].content.length, 2);
  assert.equal(call.messages[0].content[1].type, "image_url");
  assert.equal(call.messages[0].content[1].image_url.url, "data:image/png;base64,AAAA");
});

test("prompt longo rejeitado antes do provedor", async () => {
  state.openRouterCalls = [];
  const res = await post("/ai", {
    token: makeToken("u-long"),
    body: JSON.stringify({ prompt: "x".repeat(60001), maxTokens: 900 })
  });
  await expectError(res, 400, "prompt_too_long");
  assert.equal(state.openRouterCalls.length, 0);
});

test("maxTokens inválido rejeitado antes do provedor", async () => {
  state.openRouterCalls = [];
  const res = await post("/ai", {
    token: makeToken("u-tokens"),
    body: JSON.stringify({ prompt: "oi", maxTokens: "900" })
  });
  await expectError(res, 400, "invalid_max_tokens");
  assert.equal(state.openRouterCalls.length, 0);
});

test("imagem inválida rejeitada antes do provedor", async () => {
  state.openRouterCalls = [];
  const res = await post("/ai", {
    token: makeToken("u-imgbad"),
    body: JSON.stringify({
      prompt: "oi",
      maxTokens: 900,
      imagePart: { image_url: { url: "http://x/y.png" } }
    })
  });
  await expectError(res, 400, "invalid_image");
  assert.equal(state.openRouterCalls.length, 0);
});

test("429 na cadeia cai para o próximo modelo", async () => {
  state.openRouterCalls = [];
  state.onChat = (call) =>
    call.model === "modelo-a:free"
      ? jsonResponse({ error: { message: "rate" } }, 429)
      : jsonResponse({ choices: [{ message: { content: "segundo modelo" } }] });
  const res = await post("/ai", {
    token: makeToken("u-chain"),
    body: JSON.stringify({ prompt: "oi", maxTokens: 900 })
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.model, "modelo-b:free");
  assert.equal(body.text, "segundo modelo");
  state.onChat = null;
});

test("erro não-repetível repassa status e sana detalhe", async () => {
  state.onChat = () => jsonResponse({ error: { message: `falha com ${API_KEY}\nlinha2` } }, 400);
  const res = await post("/ai", {
    token: makeToken("u-hard"),
    body: JSON.stringify({ prompt: "oi", maxTokens: 900 })
  });
  const body = await expectError(res, 400, "upstream_400");
  assert.match(body.error, /chave removida/);
  assert.ok(!body.error.includes(API_KEY));
  assert.equal(body.model, "modelo-a:free");
  state.onChat = null;
});

test("cadeia esgotada → envelope com tried", async () => {
  state.onChat = () => jsonResponse({ error: { message: "busy" } }, 503);
  const res = await post("/ai", {
    token: makeToken("u-tired"),
    body: JSON.stringify({ prompt: "oi", maxTokens: 900 })
  });
  const body = await expectError(res, 503, "upstream_503");
  assert.equal(body.tried, 2);
  assert.equal(body.upstreamStatus, 503);
  state.onChat = null;
});

test("resposta vazia → 502 empty_reply", async () => {
  state.onChat = () => jsonResponse({ choices: [{ message: { content: "   " } }] });
  const res = await post("/ai", {
    token: makeToken("u-empty"),
    body: JSON.stringify({ prompt: "oi", maxTokens: 900 })
  });
  await expectError(res, 502, "empty_reply");
  state.onChat = null;
});
