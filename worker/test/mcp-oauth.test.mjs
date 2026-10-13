/* Testes do OAuth 2.1 da ponte (Fase 4/5 — claude.ai "Entrar agora").
   Execução: node --test worker/test/

   Cobre: discovery RFC 9728/8414, 401 com WWW-Authenticate, DCR,
   authorize (consentimento colando o mxc_), PKCE S256, code de uso
   único, rotação de refresh, cascata de revogação (mxc_ derruba o
   OAuth), audience (RFC 8707) e regressão do fluxo mxc_ direto. */

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { makeKvMock } from "./helpers/kv.mjs";
import { buildExternalSnapshotResult } from "../../mcp-financial-contract.js";

const PROJ = "livro-caixa-54357";
const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";
const ISSUER = BASE;
const RESOURCE = `${BASE}/mcp`;
const CLAUDE_REDIRECT = "https://claude.ai/api/mcp/auth_callback";

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
    MCP_OAUTH_ISSUER: ISSUER,
    MCP_OAUTH_RATE_LIMIT_PER_MINUTE: "500",
    ...overrides
  };
}

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;

let env = makeEnv();

test.beforeEach(() => {
  env = makeEnv();
});

function request(path, { method = "POST", headers = {}, body } = {}) {
  return workerFetch(new Request(`${BASE}${path}`, { method, headers, body }), env);
}

function makeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

function challengeOf(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
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

async function depositFor(uid, envelope) {
  const snapshot = envelope || {
    schemaVersion: "P3.5",
    generatedAt: "2026-10-12T12:00:00.000Z",
    period: { currentMonth: "2026-10", currentMonthTotals: { income: 5000, expense: 3200, net: 1800, transactions: 10 } },
    accounts: [{ name: "Nubank", balance: 4000 }]
  };
  const built = buildExternalSnapshotResult(snapshot);
  assert.equal(built.ok, true);
  const res = await request("/bridge/snapshot", {
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` },
    body: JSON.stringify(built.value)
  });
  assert.equal(res.status, 200);
}

async function registerClient(uris = [CLAUDE_REDIRECT], name = "Claude") {
  const res = await request("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: uris, client_name: name })
  });
  const body = await res.json();
  return { status: res.status, body };
}

function authorizeUrl(clientId, redirectUri, { challenge, state = "est-1", resource = RESOURCE } = {}) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: "mcp:tools",
    resource
  });
  return `/authorize?${params}`;
}

async function getAuthorize(path) {
  return request(path, { method: "GET" });
}

function ticketFrom(html) {
  const match = /name="ticket" value="([^"]+)"/.exec(html);
  return match ? match[1] : null;
}

async function postAuthorize(form) {
  return request("/authorize", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString()
  });
}

async function postToken(form) {
  return request("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString()
  });
}

function locationParams(res) {
  return Object.fromEntries(new URL(res.headers.get("location")).searchParams);
}

async function mcp(token, payload) {
  return request("/mcp", {
    headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

test("protected resource metadata (RFC 9728): resource exato + authorization_servers", async () => {
  const res = await getAuthorize("/.well-known/oauth-protected-resource");
  assert.equal(res.status, 200);
  const doc = await res.json();
  assert.equal(doc.resource, RESOURCE);
  assert.deepEqual(doc.authorization_servers, [ISSUER]);
  assert.ok(doc.scopes_supported.includes("mcp:tools"));
});

test("protected resource metadata via caminho /mcp também responde", async () => {
  const res = await getAuthorize("/.well-known/oauth-protected-resource/mcp");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).resource, RESOURCE);
});

test("AS metadata (RFC 8414): S256, DCR, offline_access, issuer pinado", async () => {
  const res = await getAuthorize("/.well-known/oauth-authorization-server");
  assert.equal(res.status, 200);
  const doc = await res.json();
  assert.equal(doc.issuer, ISSUER);
  assert.deepEqual(doc.code_challenge_methods_supported, ["S256"]);
  assert.equal(doc.registration_endpoint, `${ISSUER}/register`);
  assert.equal(doc.token_endpoint, `${ISSUER}/token`);
  assert.ok(doc.scopes_supported.includes("offline_access"));
  assert.deepEqual(doc.token_endpoint_auth_methods_supported, ["none"]);
});

/* ------------------------------------------------------------------ */
/* 401 do /mcp com WWW-Authenticate                                     */
/* ------------------------------------------------------------------ */

test("/mcp sem token → 401 + WWW-Authenticate apontando o metadata", async () => {
  const res = await request("/mcp", {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "missing_token");
  const www = res.headers.get("www-authenticate") || "";
  assert.ok(www.includes(`resource_metadata="${ISSUER}/.well-known/oauth-protected-resource"`), www);
  assert.ok(www.includes('scope="mcp:tools"'), www);
});

test("/mcp token inválido → 401 + WWW-Authenticate", async () => {
  const res = await mcp("mxc_falso", { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.status, 401);
  assert.ok((res.headers.get("www-authenticate") || "").includes("resource_metadata="));
});

test("fluxo mxc_ direto continua funcionando (regressão)", async () => {
  const token = await issueTokenFor("uid-regressao");
  const res = await mcp(token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).result.serverInfo.name, "livro-caixa-mcp");
});

/* ------------------------------------------------------------------ */
/* DCR                                                                 */
/* ------------------------------------------------------------------ */

test("DCR registra cliente público e devolve client_id", async () => {
  const { status, body } = await registerClient();
  assert.equal(status, 201);
  assert.ok(body.client_id.startsWith("mcpcli_"));
  assert.equal(body.token_endpoint_auth_method, "none");
  assert.deepEqual(body.redirect_uris, [CLAUDE_REDIRECT]);
});

test("DCR recusa redirect_uri http não-loopback", async () => {
  const { status, body } = await registerClient(["http://evil.example/callback"]);
  assert.equal(status, 400);
  assert.equal(body.error, "invalid_client_metadata");
});

test("DCR aceita loopback http (Claude Code)", async () => {
  const { status } = await registerClient(["http://localhost:3333/callback"]);
  assert.equal(status, 201);
});

/* ------------------------------------------------------------------ */
/* Authorize                                                           */
/* ------------------------------------------------------------------ */

test("authorize GET válido renderiza consentimento com hostname do redirect", async () => {
  const { body: client } = await registerClient();
  const verifier = makeVerifier();
  const res = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(verifier) }));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes("claude.ai"), "hostname do redirect deve aparecer na página");
  assert.ok(html.includes("somente leitura"));
  assert.ok(ticketFrom(html), "form deve conter ticket");
});

test("authorize com client_id desconhecido → 400 sem redirecionar", async () => {
  const res = await getAuthorize(authorizeUrl("mcpcli_inexistente", CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()) }));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("location"), null);
});

test("authorize com redirect_uri não registrada → 400 sem redirecionar", async () => {
  const { body: client } = await registerClient();
  const res = await getAuthorize(authorizeUrl(client.client_id, "https://evil.example/cb", { challenge: challengeOf(makeVerifier()) }));
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("location"), null);
});

test("authorize com code_challenge_method=plain → 302 invalid_request", async () => {
  const { body: client } = await registerClient();
  const params = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: CLAUDE_REDIRECT,
    response_type: "code",
    code_challenge: challengeOf(makeVerifier()),
    code_challenge_method: "plain",
    state: "s1"
  });
  const res = await getAuthorize(`/authorize?${params}`);
  assert.equal(res.status, 302);
  assert.equal(locationParams(res).error, "invalid_request");
});

test("authorize com resource errado → 302 invalid_target", async () => {
  const { body: client } = await registerClient();
  const res = await getAuthorize(
    authorizeUrl(client.client_id, CLAUDE_REDIRECT, {
      challenge: challengeOf(makeVerifier()),
      resource: "https://outro-servidor.example/mcp"
    })
  );
  assert.equal(res.status, 302);
  assert.equal(locationParams(res).error, "invalid_target");
});

test("authorize POST permitir com mxc_ válido → 302 com code e state", async () => {
  const { body: client } = await registerClient();
  const verifier = makeVerifier();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(verifier), state: "xyz" }));
  const ticket = ticketFrom(await page.text());
  const mxc = await issueTokenFor("uid-authz");

  const res = await postAuthorize({ ticket, token: mxc, action: "allow" });
  assert.equal(res.status, 302);
  const params = locationParams(res);
  assert.ok(params.code, "deve devolver code");
  assert.equal(params.state, "xyz");
});

test("authorize POST com token inválido → re-renderiza consentimento com erro", async () => {
  const { body: client } = await registerClient();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()) }));
  const ticket = ticketFrom(await page.text());

  const res = await postAuthorize({ ticket, token: "mxc_invalido", action: "allow" });
  assert.equal(res.status, 200, "re-renderiza o form, não página morta");
  assert.equal(res.headers.get("location"), null);
  const html = await res.text();
  assert.ok(html.includes("Token inválido"));
  /* O ticket não é consumido em falha: o mesmo form serve para retry. */
  assert.equal(ticketFrom(html), ticket, "form deve manter o mesmo ticket para retry");
});

test("authorize POST token inválido → retry com token válido no mesmo ticket → 302", async () => {
  const { body: client } = await registerClient();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()), state: "r1" }));
  const ticket = ticketFrom(await page.text());

  const invalid = await postAuthorize({ ticket, token: "mxc_invalido", action: "allow" });
  assert.equal(invalid.status, 200);

  const mxc = await issueTokenFor("uid-retry-ticket");
  const retry = await postAuthorize({ ticket, token: mxc, action: "allow" });
  assert.equal(retry.status, 302, "retry no mesmo ticket deve funcionar");
  assert.equal(locationParams(retry).state, "r1");
});

test("authorize POST negar → 302 access_denied", async () => {
  const { body: client } = await registerClient();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()) }));
  const ticket = ticketFrom(await page.text());

  const res = await postAuthorize({ ticket, token: "mxc_qualquer", action: "deny" });
  assert.equal(res.status, 302);
  assert.equal(locationParams(res).error, "access_denied");
});

test("ticket é de uso único (replay → 400 com mensagem de já usado)", async () => {
  const { body: client } = await registerClient();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()) }));
  const ticket = ticketFrom(await page.text());
  const mxc = await issueTokenFor("uid-replay-ticket");

  const first = await postAuthorize({ ticket, token: mxc, action: "deny" });
  assert.equal(first.status, 302);
  const second = await postAuthorize({ ticket, token: mxc, action: "deny" });
  assert.equal(second.status, 400);
  /* Ticket ausente ≠ expirado: a mensagem não pode culpar o TTL de 30 min. */
  const html = await second.text();
  assert.ok(html.includes("já foi usado"), "deve dizer que a tela já foi usada");
  assert.ok(!html.includes("30 minutos"), "não deve dizer 'expirou (30 minutos)'");
});

test("ticket realmente expirado → 400 Sessão expirada (30 minutos)", async () => {
  const { body: client } = await registerClient();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(makeVerifier()) }));
  const ticket = ticketFrom(await page.text());
  const key = `mcp-oa:auth:${ticket}`;
  const record = JSON.parse(await env.RATE_LIMIT_KV.get(key));
  record.exp = Date.now() - 1000;
  await env.RATE_LIMIT_KV.put(key, JSON.stringify(record));

  const res = await postAuthorize({ ticket, token: "mxc_qualquer", action: "allow" });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.ok(html.includes("Sessão expirada"));
  assert.ok(html.includes("30 minutos"));
});

/* ------------------------------------------------------------------ */
/* Token endpoint + /mcp com access token OAuth                        */
/* ------------------------------------------------------------------ */

async function fullCodeFlow(uid, { state = "s" } = {}) {
  const mxc = await issueTokenFor(uid);
  const { body: client } = await registerClient();
  const verifier = makeVerifier();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(verifier), state }));
  const ticket = ticketFrom(await page.text());
  const authz = await postAuthorize({ ticket, token: mxc, action: "allow" });
  const { code } = locationParams(authz);
  assert.ok(code);
  const tokenRes = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: CLAUDE_REDIRECT,
    client_id: client.client_id,
    code_verifier: verifier,
    resource: RESOURCE
  });
  const tokens = await tokenRes.json();
  return { mxc, client, tokens, tokenRes };
}

test("token: troca de code devolve access + refresh (uso único do code)", async () => {
  const { tokenRes, tokens } = await fullCodeFlow("uid-token");
  assert.equal(tokenRes.status, 200);
  assert.ok(tokens.access_token.startsWith("oat_"));
  assert.ok(tokens.refresh_token.startsWith("oat_"));
  assert.equal(tokens.expires_in, 30 * 24 * 3600);
  assert.equal(tokens.token_type, "Bearer");

  const replay = await postToken({
    grant_type: "authorization_code",
    code: "qualquer",
    redirect_uri: CLAUDE_REDIRECT,
    client_id: "x",
    code_verifier: makeVerifier()
  });
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).error, "invalid_grant");
});

test("token: code replay do mesmo code → invalid_grant", async () => {
  const mxc = await issueTokenFor("uid-replay-code");
  const { body: client } = await registerClient();
  const verifier = makeVerifier();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(verifier) }));
  const ticket = ticketFrom(await page.text());
  const authz = await postAuthorize({ ticket, token: mxc, action: "allow" });
  const { code } = locationParams(authz);

  const form = {
    grant_type: "authorization_code",
    code,
    redirect_uri: CLAUDE_REDIRECT,
    client_id: client.client_id,
    code_verifier: verifier
  };
  const first = await postToken(form);
  assert.equal(first.status, 200);
  const second = await postToken(form);
  assert.equal(second.status, 400);
  assert.equal((await second.json()).error, "invalid_grant");
});

test("token: verifier errado → invalid_grant", async () => {
  const mxc = await issueTokenFor("uid-verifier");
  const { body: client } = await registerClient();
  const verifier = makeVerifier();
  const page = await getAuthorize(authorizeUrl(client.client_id, CLAUDE_REDIRECT, { challenge: challengeOf(verifier) }));
  const ticket = ticketFrom(await page.text());
  const authz = await postAuthorize({ ticket, token: mxc, action: "allow" });
  const { code } = locationParams(authz);

  const res = await postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: CLAUDE_REDIRECT,
    client_id: client.client_id,
    code_verifier: makeVerifier()
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_grant");
});

test("access token OAuth autentica o /mcp (fluxo completo: snapshot → tools/call)", async () => {
  const uid = "uid-fluxo-completo";
  await depositFor(uid);
  const { tokens } = await fullCodeFlow(uid);

  const list = await mcp(tokens.access_token, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).result.tools[0].name, "get_financial_snapshot");

  const call = await mcp(tokens.access_token, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_financial_snapshot", arguments: {} }
  });
  assert.equal(call.status, 200);
  const callBody = await call.json();
  assert.equal(callBody.result.content[0].type, "text");
  const payload = JSON.parse(callBody.result.content[0].text);
  assert.equal(payload.data.accounts[0].name, "Nubank");
});

test("refresh: rotação completa e cascata de revogação do mxc_", async () => {
  const uid = "uid-cascata";
  const { mxc, client, tokens } = await fullCodeFlow(uid);

  /* 1. refresh válido → nova par; RT antigo passa a valer invalid_grant. */
  const refreshed = await postToken({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: client.client_id,
    resource: RESOURCE
  });
  assert.equal(refreshed.status, 200);
  const pair2 = await refreshed.json();
  assert.ok(pair2.access_token.startsWith("oat_"));
  assert.ok(pair2.refresh_token !== tokens.refresh_token);

  const oldRt = await postToken({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: client.client_id
  });
  assert.equal(oldRt.status, 400);
  assert.equal((await oldRt.json()).error, "invalid_grant");

  /* 2. access token novo funciona no /mcp. */
  const list = await mcp(pair2.access_token, { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(list.status, 200);

  /* 3. revogar o mxc_ no app derruba o restante no próximo refresh. */
  const revoke = await request("/bridge/token", {
    method: "DELETE",
    headers: { "content-type": "application/json", Origin: ORIGIN, Authorization: `Bearer ${makeIdToken(uid)}` },
    body: JSON.stringify({ token: mxc })
  });
  assert.equal(revoke.status, 200);

  const afterRevoke = await postToken({
    grant_type: "refresh_token",
    refresh_token: pair2.refresh_token,
    client_id: client.client_id
  });
  assert.equal(afterRevoke.status, 400);
  assert.equal((await afterRevoke.json()).error, "invalid_grant");
});

/* ------------------------------------------------------------------ */
/* Audience e expiry do access token                                   */
/* ------------------------------------------------------------------ */

async function seedAccessToken(record) {
  const token = `oat_${crypto.randomBytes(32).toString("base64url")}`;
  await env.RATE_LIMIT_KV.put(`mcp-oa:at:${sha256Hex(token)}`, JSON.stringify(record));
  return token;
}

test("access token com audience diferente do MCP → 401", async () => {
  const token = await seedAccessToken({
    uid: "uid-aud",
    client_id: "mcpcli_x",
    resource: "https://outro-servidor.example/mcp",
    srcHash: "abc",
    exp: Date.now() + 60000
  });
  const res = await mcp(token, { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "invalid_mcp_token");
});

test("access token expirado → 401", async () => {
  const token = await seedAccessToken({
    uid: "uid-exp",
    client_id: "mcpcli_x",
    resource: RESOURCE,
    srcHash: "abc",
    exp: Date.now() - 1000
  });
  const res = await mcp(token, { jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.status, 401);
});

/* ------------------------------------------------------------------ */
/* Rate limit                                                          */
/* ------------------------------------------------------------------ */

test("rate limit por IP no /register (fail-open padrão quando KV ok)", async () => {
  env = makeEnv({ MCP_OAUTH_RATE_LIMIT_PER_MINUTE: "2" });
  const first = await registerClient();
  assert.equal(first.status, 201);
  const second = await registerClient();
  assert.equal(second.status, 201);
  const third = await registerClient();
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "slow_down");
});
