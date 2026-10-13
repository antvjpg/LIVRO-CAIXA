/* OAuth 2.1 da Ponte de IA — servidor de autorização + resource server.

   Objetivo: o claude.ai conectar "…/mcp" com "Entrar agora" (fluxo web
   completo), sem depender do beta de headers. Conformidade-alvo:

   - RFC 6749/8252/BCP-212 (OAuth 2.1 draft): PKCE S256 obrigatório,
     cliente público (sem client_secret), redirect_uri exata;
   - RFC 8414  → /.well-known/oauth-authorization-server;
   - RFC 9728  → /.well-known/oauth-protected-resource;
   - RFC 7591  → DCR (POST /register) — default da Anthropic;
   - RFC 8707  → resource/audience: o access token só vale para a URL
     exata do MCP; audience errada ⇒ 401 no /mcp;
   - 401 do /mcp com WWW-Authenticate apontando o metadata — exigência
     da Anthropic para iniciar o sign-in (eles ignoram header em 200).

   Login = o usuário cola o próprio token mxc_ gerado no app (mesmo
   namespace mcp:tok: por hash). Identidade continua sendo a do Firebase
   (uid dentro do registro do mxc_): nenhuma nova infra de login.

   Chaves novas no RATE_LIMIT_KV (prefixos "mcp-oa:" não colidem):
     mcp-oa:client:<id>        → registro DCR, sem TTL
     mcp-oa:auth:<ticket>      → ticket do consentimento, TTL 5 min
     mcp-oa:code:<sha256>      → código de autorização, uso único, 5 min
     mcp-oa:at:<sha256>        → access token, TTL 1 h
     mcp-oa:rt:<sha256>        → refresh token, uso único (rotação), 30 d

   Segurança: issuer fixo (nunca derivado do header Host); tickets e
   códigos são de uso único (get+delete); refresh rotaciona e a
   revogação do mxc_ fonte derruba o OAuth no próximo refresh (ou no
   expiry do access token, ≤ 1 h). Só hashes vão para o KV; nenhum
   token aparece em log. */

import { resolveMcpToken } from "./store.js";
import { readJsonBody } from "../shared/validation.js";

const DEFAULT_ISSUER = "https://livro-caixa-ai.livro-caixa-ai.workers.dev";
/* Access token OAuth: 30 dias (mesmo prazo do mxc_). App pessoal de
   uso único — prazo curto de 1 h só adicionava fricção sem ganho real.
   O refresh token (também 30 dias) renova automaticamente quando o
   access expira, então a sessão pode durar indefinidamente com o app
   conectado. */
const ACCESS_TTL_SECONDS = 30 * 24 * 3600;
const REFRESH_TTL_SECONDS = 30 * 24 * 3600;
const CODE_TTL_SECONDS = 300;
/* Ticket do consentimento: o usuário precisa de tempo para sair, gerar o
   mxc_ no app e voltar — 5 min estourava na prática. 30 min cobre o
   fluxo sem criar janela longa de reuso (é uso único mesmo). */
const TICKET_TTL_SECONDS = 1800;
const OA_TOKEN_PREFIX = "oat_";
const CLIENT_PREFIX = "mcpcli_";
const DEFAULT_OAUTH_RATE_LIMIT = 30;
const FORM_MAX_BYTES = 8 * 1024;
const OAUTH_CORS = { "access-control-allow-origin": "*" };
const SUPPORTED_SCOPE = "mcp:tools";

function kvOf(env) {
  return env.RATE_LIMIT_KV || null;
}

/* Issuer/URL canônica do recurso. Pinada em constante ou env — nunca do
   header Host (anti host-header injection nos documentos de discovery). */
export function oauthIssuer(env) {
  return String(env.MCP_OAUTH_ISSUER || DEFAULT_ISSUER).replace(/\/+$/, "");
}

export function oauthResource(env) {
  return `${oauthIssuer(env)}/mcp`;
}

export function oauthChallenge(env) {
  return `Bearer resource_metadata="${oauthIssuer(env)}/.well-known/oauth-protected-resource", scope="${SUPPORTED_SCOPE}"`;
}

/* ------------------------------------------------------------------ */
/* Primitivas                                                          */
/* ------------------------------------------------------------------ */

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomB64Url(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clientKey(id) {
  return `mcp-oa:client:${id}`;
}
function ticketKey(ticket) {
  return `mcp-oa:auth:${ticket}`;
}
function codeKey(hash) {
  return `mcp-oa:code:${hash}`;
}
function atKey(hash) {
  return `mcp-oa:at:${hash}`;
}
function rtKey(hash) {
  return `mcp-oa:rt:${hash}`;
}

function expIn(ttlSeconds) {
  return Date.now() + ttlSeconds * 1000;
}

function isExpired(record) {
  return !record || !Number.isFinite(record.exp) || record.exp <= Date.now();
}

/* Redirect URI válida para DCR: https em qualquer host, ou http apenas
   em loopback (localhost/127.0.0.1) — exigência do BCP de apps nativos. */
function isValidRedirectUri(value) {
  if (typeof value !== "string" || value.length > 2000) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function appendQuery(redirectUri, params) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function redirectError(redirectUri, error, state, description) {
  const location = appendQuery(redirectUri, {
    error,
    ...(description ? { error_description: description } : {}),
    ...(state ? { state } : {})
  });
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", ...OAUTH_CORS }
  });
}

async function parseFormBody(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > FORM_MAX_BYTES) return null;
  const text = await request.text();
  if (text.length > FORM_MAX_BYTES) return null;
  const params = new URLSearchParams(text);
  const out = {};
  for (const [key, value] of params) out[key] = value;
  return out;
}

async function kvGetJson(kv, key) {
  if (!kv) return null;
  try {
    const raw = await kv.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function kvGetRaw(kv, key) {
  if (!kv) return null;
  try {
    return await kv.get(key);
  } catch {
    return null;
  }
}

async function kvPutJson(kv, key, value, ttlSeconds) {
  try {
    /* expirationTtl só quando há TTL real (0/omitido ⇒ registro persistente;
       o Workers rejeita expirationTtl < 60 s). */
    if (Number.isFinite(ttlSeconds) && ttlSeconds >= 60) {
      await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
    } else {
      await kv.put(key, JSON.stringify(value));
    }
    return true;
  } catch {
    return false;
  }
}

async function kvDelete(kv, key) {
  try {
    await kv.delete(key);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* Um ticket ausente pode ser: reenvio do formulário (retry/duplo clique),
   leitura KV instável (propagação entre colos ou erro transitório — o
   catch do kvGetJson vira null) ou gravação perdida. Reler uma vez antes
   de declarar "não encontrado" evita falso expirado logo após o clique. */
async function readTicketRecord(kv, ticket) {
  const key = ticketKey(ticket);
  for (let attempt = 0; attempt < 2; attempt++) {
    const record = await kvGetJson(kv, key);
    if (record) return record;
    if (attempt === 0) await sleep(150);
  }
  return null;
}

/* Motivo do desfecho do POST /authorize — só o motivo, sem token/ticket/
   code/uid (log sanitizado para diagnosticar recorrência em produção). */
function logAuthorize(outcome) {
  console.log(JSON.stringify({ event: "mcp_oa_authorize", outcome }));
}

function methodNotAllowed() {
  return jsonResponse({ error: "Método não permitido.", code: "method_not_allowed" }, 405);
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...OAUTH_CORS
    }
  });
}

function oauthError(error, description, status = 400) {
  return jsonResponse({ error, ...(description ? { error_description: description } : {}) }, status);
}

function ipOf(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

async function limited(request, env, deps, prefix) {
  if (!deps || typeof deps.isRateLimited !== "function") return false;
  return deps.isRateLimited(ipOf(request), env, {
    limitEnvVar: "MCP_OAUTH_RATE_LIMIT_PER_MINUTE",
    defaultLimit: DEFAULT_OAUTH_RATE_LIMIT,
    prefix
  });
}

/* ------------------------------------------------------------------ */
/* Página de consentimento (HTML mínimo, sem JS, em PT)                */
/* ------------------------------------------------------------------ */

function htmlPage(title, bodyHtml, status = 200) {
  return new Response(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action 'self'">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:26rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}
h1{font-size:1.25rem}
.bole{background:#f4f6f8;border:1px solid #d8dee4;border-radius:8px;padding:1rem;margin:1rem 0}
.erro{background:#fdecea;border:1px solid #f5c6c2;color:#8a1f11;padding:.75rem 1rem;border-radius:8px}
label{display:block;margin:1rem 0 .35rem;font-weight:600}
input[type=password]{width:100%;padding:.6rem .7rem;border:1px solid #c9d1d9;border-radius:6px;font-size:1rem;box-sizing:border-box}
button{margin-top:1rem;margin-right:.5rem;padding:.6rem 1.1rem;border-radius:6px;border:1px solid #0b5fff;background:#0b5fff;color:#fff;font-size:1rem;cursor:pointer}
button.secundario{background:#fff;color:#1a1a1a;border-color:#c9d1d9}
.rodape{font-size:.85rem;color:#57606a;margin-top:1.25rem}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...OAUTH_CORS }
    });
}

function htmlErrorPage(title, message, status = 400) {
  return htmlPage(title, `<h1>${escapeHtml(title)}</h1><p class="erro">${escapeHtml(message)}</p>`, status);
}

function renderConsentPage({ clientName, redirectUri, scope, ticket, error, status = 200 }) {
  let hostname = "(desconhecido)";
  try {
    hostname = new URL(redirectUri).hostname;
  } catch {
    /* redirecionamento já validado antes; fallback defensivo */
  }
  const erroHtml = error ? `<p class="erro">${escapeHtml(error)}</p>` : "";
  return htmlPage(
    "LIVRO-CAIXA — Autorização",
    `<h1>Conexão externa (MCP)</h1>
<div class="bole">
<p><strong>${escapeHtml(clientName)}</strong> quer acessar dados do seu LIVRO-CAIXA.</p>
<p>Aplicativo: <strong>${escapeHtml(hostname)}</strong></p>
<p>Permissão: somente leitura do snapshot financeiro (${escapeHtml(scope)}). Nada será criado, editado ou apagado.</p>
</div>
${erroHtml}
<form method="post" action="/authorize">
<input type="hidden" name="ticket" value="${escapeHtml(ticket)}">
<label for="token">Token de acesso</label>
<p style="margin:.25rem 0;font-size:.9rem;color:#57606a">Cole o token gerado no app: <em>Perfil → Conexão externa (MCP) → Gerar token de acesso</em> (começa com <code>mxc_</code>).</p>
<input id="token" name="token" type="password" autocomplete="off" spellcheck="false" placeholder="mxc_…" required>
<button type="submit" name="action" value="allow">Permitir</button>
<button type="submit" name="action" value="deny" class="secundario">Negar</button>
</form>
<p class="rodape">Somente leitura. Revogue o token no app a qualquer momento para cortar o acesso (vale também para esta conexão).</p>`,
    status
  );
}

/* ------------------------------------------------------------------ */
/* Discovery (RFC 9728 + RFC 8414)                                     */
/* ------------------------------------------------------------------ */

export function handleProtectedResourceMetadata(env) {
  return jsonResponse(
    {
      resource: oauthResource(env),
      authorization_servers: [oauthIssuer(env)],
      scopes_supported: [SUPPORTED_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: "LIVRO-CAIXA — ponte de IA (somente leitura)"
    },
    200
  );
}

export function handleAuthorizationServerMetadata(env) {
  const issuer = oauthIssuer(env);
  return jsonResponse(
    {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [SUPPORTED_SCOPE, "offline_access"]
    },
    200
  );
}

/* ------------------------------------------------------------------ */
/* DCR (RFC 7591)                                                      */
/* ------------------------------------------------------------------ */

export async function handleRegister(request, env) {
  if (request.method !== "POST") return methodNotAllowed();

  const body = await readJsonBody(request, { maxBytes: FORM_MAX_BYTES });
  if (!body.ok) return oauthError("invalid_client_metadata", "Corpo JSON inválido.");

  const meta = body.payload || {};
  const redirectUris = meta.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 10) {
    return oauthError("invalid_client_metadata", "redirect_uris ausente ou inválido.");
  }
  if (!redirectUris.every((uri) => isValidRedirectUri(uri))) {
    return oauthError("invalid_client_metadata", "redirect_uri deve ser https ou loopback http.");
  }
  const clientName =
    typeof meta.client_name === "string" && meta.client_name.trim()
      ? meta.client_name.trim().slice(0, 100)
      : "Um aplicativo MCP";

  const kv = kvOf(env);
  if (!kv) return oauthError("temporarily_unavailable", "Armazenamento indisponível.", 503);

  const clientId = `${CLIENT_PREFIX}${randomB64Url(18)}`;
  const stored = await kvPutJson(
    kv,
    clientKey(clientId),
    { redirect_uris: redirectUris, client_name: clientName, createdAt: new Date().toISOString() },
    /* Registro persiste (sem TTL): o conector do Claude reutiliza o
       client_id entre sessões; o teto de abuso vem do rate limit. */
    0
  );
  if (!stored) return oauthError("temporarily_unavailable", "Armazenamento indisponível.", 503);

  return jsonResponse(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: redirectUris,
      client_name: clientName,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"]
    },
    201
  );
}

/* ------------------------------------------------------------------ */
/* Authorize                                                           */
/* ------------------------------------------------------------------ */

async function loadClient(env, clientId) {
  if (typeof clientId !== "string" || !clientId || clientId.length > 200) return null;
  return kvGetJson(kvOf(env), clientKey(clientId));
}

export async function handleAuthorize(request, env) {
  if (request.method === "GET") return authorizeGet(request, env);
  if (request.method === "POST") return authorizePost(request, env);
  return methodNotAllowed();
}

async function authorizeGet(request, env) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const responseType = url.searchParams.get("response_type") || "";
  const challenge = url.searchParams.get("code_challenge") || "";
  const challengeMethod = url.searchParams.get("code_challenge_method") || "";
  const state = url.searchParams.get("state") || "";
  const scope = url.searchParams.get("scope") || SUPPORTED_SCOPE;
  const resourceParam = url.searchParams.get("resource");

  /* client_id/redirect_uri inválidos NUNCA redirecionam (anti open
     redirect): só depois que os dois batem é que erros vão no 302. */
  const client = await loadClient(env, clientId);
  if (!client) {
    return htmlErrorPage("Aplicativo desconhecido", "client_id não registrado. Feche esta janela e tente a conexão novamente no aplicativo.");
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return htmlErrorPage("Redirecionamento não autorizado", "O endereço de retorno (redirect_uri) não corresponde ao registrado pelo aplicativo.");
  }

  if (responseType !== "code") {
    return redirectError(redirectUri, "unsupported_response_type", state, "Somente response_type=code.");
  }
  /* PKCE: somente S256 (plain é recusado — OAuth 2.1). */
  if (!challenge || challengeMethod !== "S256" || challenge.length < 43 || challenge.length > 128) {
    return redirectError(redirectUri, "invalid_request", state, "code_challenge S256 obrigatório.");
  }
  const resource = resourceParam || oauthResource(env);
  if (resource !== oauthResource(env)) {
    return redirectError(redirectUri, "invalid_target", state, "Resource desconhecido.");
  }

  const kv = kvOf(env);
  if (!kv) return htmlErrorPage("Indisponível", "Armazenamento da ponte indisponível. Tente novamente em instantes.");

  const ticket = randomB64Url(24);
  const stored = await kvPutJson(
    kv,
    ticketKey(ticket),
    {
      client_id: clientId,
      client_name: client.client_name,
      redirect_uri: redirectUri,
      challenge,
      state,
      scope,
      resource,
      exp: expIn(TICKET_TTL_SECONDS)
    },
    TICKET_TTL_SECONDS
  );
  if (!stored) return htmlErrorPage("Indisponível", "Armazenamento da ponte indisponível. Tente novamente em instantes.");

  return renderConsentPage({
    clientName: client.client_name,
    redirectUri,
    scope,
    ticket
  });
}

async function authorizePost(request, env) {
  const form = await parseFormBody(request);
  if (!form) return htmlErrorPage("Requisição inválida", "Corpo do formulário inválido.");

  const kv = kvOf(env);
  if (!kv) return htmlErrorPage("Indisponível", "Armazenamento da ponte indisponível.");

  const ticket = form.ticket || "";
  if (!ticket) return htmlErrorPage("Sessão indisponível", "Ticket ausente. Volte ao aplicativo e inicie a conexão novamente.");

  const record = await readTicketRecord(kv, ticket);
  if (!record) {
    logAuthorize("ticket_not_found");
    return htmlErrorPage(
      "Sessão indisponível",
      "Este pedido de conexão já foi usado ou não foi encontrado. Volte ao aplicativo e clique em Conectar novamente para gerar uma nova tela."
    );
  }
  if (isExpired(record)) {
    await kvDelete(kv, ticketKey(ticket));
    logAuthorize("ticket_expired");
    return htmlErrorPage("Sessão expirada", "Este pedido expirou (30 minutos). Volte ao aplicativo e tente novamente.");
  }

  if (form.action === "deny") {
    await kvDelete(kv, ticketKey(ticket));
    return redirectError(record.redirect_uri, "access_denied", record.state, "O usuário negou o acesso.");
  }
  if (form.action !== "allow") {
    return htmlErrorPage("Requisição inválida", "Ação desconhecida.");
  }

  const token = typeof form.token === "string" ? form.token.trim() : "";
  const resolved = token ? await resolveMcpToken(env, token) : null;
  if (!resolved) {
    /* Ticket ainda não foi consumido (a gravação é adiada até o sucesso):
       re-renderiza o mesmo form — o usuário cola o token corrigido sem
       reiniciar a conexão e sem depender de um ticket novo ser gravado. */
    logAuthorize("token_invalid");
    return renderConsentPage({
      clientName: record.client_name,
      redirectUri: record.redirect_uri,
      scope: record.scope,
      ticket,
      error: "Token inválido ou revogado. Gere um novo em Perfil → Conexão externa (MCP) e cole abaixo."
    });
  }

  /* Grava o code antes de consumir o ticket: se a gravação falhar, o
     ticket segue vivo e o usuário pode simplesmente tentar de novo.
     Depois disso o consumo torna o ticket de uso único — replay
     sequencial cai em ticket_not_found. Se dois Allows chegarem em
     paralelo, ambos podem ler antes do delete e emitir dois codes —
     cada code é de uso único e o PKCE impede que terceiros troquem
     qualquer um deles. */
  const code = randomB64Url(32);
  const codeHash = await sha256Hex(code);
  const stored = await kvPutJson(
    kv,
    codeKey(codeHash),
    {
      uid: resolved.uid,
      client_id: record.client_id,
      redirect_uri: record.redirect_uri,
      challenge: record.challenge,
      resource: record.resource,
      scope: record.scope,
      srcHash: resolved.hash,
      exp: expIn(CODE_TTL_SECONDS)
    },
    CODE_TTL_SECONDS
  );
  if (!stored) return htmlErrorPage("Indisponível", "Armazenamento da ponte indisponível.");

  await kvDelete(kv, ticketKey(ticket));
  logAuthorize("ok");

  const location = appendQuery(record.redirect_uri, {
    code,
    ...(record.state ? { state: record.state } : {})
  });
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "no-store", ...OAUTH_CORS }
  });
}

/* ------------------------------------------------------------------ */
/* Token endpoint                                                      */
/* ------------------------------------------------------------------ */

async function issueTokenPair(env, { uid, clientId, resource, scope, srcHash }) {
  const kv = kvOf(env);
  if (!kv) return null;

  const accessToken = `${OA_TOKEN_PREFIX}${randomB64Url(32)}`;
  const refreshToken = `${OA_TOKEN_PREFIX}${randomB64Url(32)}`;
  const base = { uid, client_id: clientId, resource, scope, srcHash };

  const okAt = await kvPutJson(kv, atKey(await sha256Hex(accessToken)), {
    ...base,
    exp: expIn(ACCESS_TTL_SECONDS)
  }, ACCESS_TTL_SECONDS);
  const okRt = await kvPutJson(kv, rtKey(await sha256Hex(refreshToken)), {
    ...base,
    exp: expIn(REFRESH_TTL_SECONDS)
  }, REFRESH_TTL_SECONDS);
  if (!okAt || !okRt) return null;

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS, scope: scope || SUPPORTED_SCOPE };
}

async function tokenAuthorizationCode(env, form) {
  const kv = kvOf(env);
  const code = typeof form.code === "string" ? form.code : "";
  if (!code) return oauthError("invalid_grant", "code ausente.");

  const codeHash = await sha256Hex(code);
  const key = codeKey(codeHash);
  const record = await kvGetJson(kv, key);
  await kvDelete(kv, key); /* uso único: replay ⇒ invalid_grant */

  if (isExpired(record)) return oauthError("invalid_grant", "Código expirado ou já utilizado.");
  if (form.client_id !== record.client_id) return oauthError("invalid_grant", "client_id não corresponde ao código.");
  if (!form.redirect_uri || form.redirect_uri !== record.redirect_uri) {
    return oauthError("invalid_grant", "redirect_uri não corresponde.");
  }
  if (form.resource && form.resource !== record.resource) {
    return oauthError("invalid_grant", "resource não corresponde.");
  }

  const verifier = typeof form.code_verifier === "string" ? form.code_verifier : "";
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) {
    return oauthError("invalid_grant", "code_verifier inválido.");
  }
  const derived = await sha256Base64Url(verifier);
  if (derived !== record.challenge) return oauthError("invalid_grant", "PKCE falhou.");

  const pair = await issueTokenPair(env, {
    uid: record.uid,
    clientId: record.client_id,
    resource: record.resource,
    scope: record.scope,
    srcHash: record.srcHash
  });
  if (!pair) return oauthError("temporarily_unavailable", "Armazenamento indisponível.", 503);

  return jsonResponse({
    access_token: pair.accessToken,
    token_type: "Bearer",
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    scope: pair.scope
  });
}

async function tokenRefresh(env, form) {
  const kv = kvOf(env);
  const presented = typeof form.refresh_token === "string" ? form.refresh_token : "";
  if (!presented) return oauthError("invalid_grant", "refresh_token ausente.");

  const hash = await sha256Hex(presented);
  const key = rtKey(hash);
  const record = await kvGetJson(kv, key);
  await kvDelete(kv, key); /* rotação: o RT apresentado morre aqui */

  if (isExpired(record)) return oauthError("invalid_grant", "refresh_token expirado ou já utilizado.");
  if (form.client_id !== record.client_id) return oauthError("invalid_grant", "client_id não corresponde.");
  if (form.resource && form.resource !== record.resource) {
    return oauthError("invalid_grant", "resource não corresponde.");
  }

  /* Cascata de revogação: o mxc_ de origem precisa continuar vivo. */
  const sourceAlive = await kvGetRaw(kv, `mcp:tok:${record.srcHash}`);
  if (!sourceAlive) {
    return oauthError("invalid_grant", "A sessão de origem foi revogada no app.");
  }

  const pair = await issueTokenPair(env, {
    uid: record.uid,
    clientId: record.client_id,
    resource: record.resource,
    scope: record.scope,
    srcHash: record.srcHash
  });
  if (!pair) return oauthError("temporarily_unavailable", "Armazenamento indisponível.", 503);

  return jsonResponse({
    access_token: pair.accessToken,
    token_type: "Bearer",
    expires_in: pair.expiresIn,
    refresh_token: pair.refreshToken,
    scope: pair.scope
  });
}

export async function handleToken(request, env) {
  if (request.method !== "POST") return methodNotAllowed();

  const form = await parseFormBody(request);
  if (!form) return oauthError("invalid_request", "Corpo form-urlencoded inválido.");

  const grantType = form.grant_type || "";
  if (grantType === "authorization_code") return tokenAuthorizationCode(env, form);
  if (grantType === "refresh_token") return tokenRefresh(env, form);
  return oauthError("unsupported_grant_type", "grant_type não suportado.");
}

/* ------------------------------------------------------------------ */
/* Roteador OAuth + autenticação do /mcp                               */
/* ------------------------------------------------------------------ */

export function isOAuthPath(pathname) {
  return (
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname.startsWith("/.well-known/oauth-protected-resource/") ||
    pathname === "/register" ||
    pathname === "/authorize" ||
    pathname === "/token"
  );
}

export async function handleOAuthRequest(request, env, deps) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/.well-known/oauth-protected-resource" || path.startsWith("/.well-known/oauth-protected-resource/")) {
    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
    return handleProtectedResourceMetadata(env);
  }
  if (path === "/.well-known/oauth-authorization-server") {
    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
    return handleAuthorizationServerMetadata(env);
  }
  if (path === "/register") {
    if (await limited(request, env, deps, "mcp-oa-reg:")) {
      return oauthError("slow_down", "Muitas tentativas. Aguarde alguns segundos.", 429);
    }
    return handleRegister(request, env);
  }
  if (path === "/authorize") {
    if (await limited(request, env, deps, "mcp-oa-authz:")) {
      return htmlErrorPage("Muitas tentativas", "Aguarde alguns segundos e tente novamente.");
    }
    return handleAuthorize(request, env);
  }
  if (path === "/token") {
    if (await limited(request, env, deps, "mcp-oa-token:")) {
      return oauthError("slow_down", "Muitas tentativas. Aguarde alguns segundos.", 429);
    }
    return handleToken(request, env);
  }
  return jsonNotFoundError();
}

function jsonNotFoundError() {
  return jsonResponse({ error: "Rota não encontrada.", code: "not_found" }, 404);
}

/* Resolve o Bearer do /mcp em dois formatos:
   - mxc_…       → token dedicado da ponte (fluxo anterior, intacto);
   - oat_…       → access token OAuth emitido neste módulo (audience
                   validada contra a URL exata do MCP — RFC 8707).
   Devolve { uid, hash } (hash alimenta o mesmo rate limit por token). */
export async function authenticateMcpAny(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return { error: "missing_token", status: 401 };

  const token = match[1].trim();
  if (!token) return { error: "missing_token", status: 401 };

  if (token.startsWith("mxc_")) {
    const resolved = await resolveMcpToken(env, token);
    if (resolved) return { uid: resolved.uid, hash: resolved.hash };
    return { error: "invalid_mcp_token", status: 401 };
  }

  const resolved = await resolveOAuthAccessToken(env, token);
  if (resolved) return { uid: resolved.uid, hash: resolved.hash };
  return { error: "invalid_mcp_token", status: 401 };
}

export async function resolveOAuthAccessToken(env, token) {
  if (typeof token !== "string" || token.length < 20 || token.startsWith("mxc_")) return null;
  const kv = kvOf(env);
  if (!kv) return null;

  try {
    const hash = await sha256Hex(token);
    const record = await kvGetJson(kv, atKey(hash));
    if (isExpired(record)) return null;
    if (record.resource !== oauthResource(env)) return null; /* audience */
    if (typeof record.uid !== "string" || !record.uid) return null;
    return { uid: record.uid, hash };
  } catch {
    return null;
  }
}
