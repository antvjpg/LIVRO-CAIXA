/* Armazenamento da Ponte de IA (Fase 2, modelo cliente→snapshot).

   O Worker NUNCA lê o Firestore no caminho de requisição. O snapshot é
   depositado pelo app autenticado (ID token do Firebase) e servido, com
   prazo de validade, a chamadas MCP autenticadas por token dedicado.

   Chaves no RATE_LIMIT_KV (namespace já existente; prefixo "mcp:" não
   colide com "ratelimit:"):
     mcp:snap:<uid>            → envelope externo (JSON), TTL 1 h
     mcp:tok:<sha256(token)>   → { uid, createdAt }, TTL 30 dias
     mcp:toks:<uid>            → índice de hashes ativos, TTL 30 dias

   O token bruto aparece UMA vez na resposta de criação; só o hash vai
   para o KV. Comprometer o KV expira sozinho e não expõe o token.
   Teto de MAX_ACTIVE_TOKENS por conta evita inflação do KV por uma
   conta autenticada (índice é melhor esforço: falha de KV não bloqueia
   a emissão, apenas relaxa o teto naquele momento).

   Toda operação de KV é envolvida em try/catch: indisponibilidade vira
   { ok: false, code: "store_unavailable" } (ou null na leitura) em vez
   de estourar como 500 sem JSON no roteador. */

import { MCP_LIMITS } from "../../../mcp-financial-contract.js";

export const MCP_SNAPSHOT_TTL_SECONDS = 3600;
export const MCP_TOKEN_TTL_SECONDS = 30 * 24 * 3600;
export const MAX_ACTIVE_TOKENS = 5;

const TOKEN_PREFIX = "mxc_";

function kvOf(env) {
  return env.RATE_LIMIT_KV || null;
}

function snapshotKey(uid) {
  return `mcp:snap:${uid}`;
}

function tokenKey(hash) {
  return `mcp:tok:${hash}`;
}

function tokenIndexKey(uid) {
  return `mcp:toks:${uid}`;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return TOKEN_PREFIX + btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* Lê o índice de tokens do uid. Corrompido/indisponível ⇒ [] (o teto
   relaxa; a disponibilidade vem primeiro, a segurança do teto é defesa
   em profundidade — a revogação continua funcionando pelo hash). */
async function readTokenIndex(kv, uid) {
  try {
    const raw = await kv.get(tokenIndexKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h) => typeof h === "string" && h.length === 64);
  } catch {
    return [];
  }
}

async function writeTokenIndex(kv, uid, hashes) {
  try {
    await kv.put(tokenIndexKey(uid), JSON.stringify(hashes), {
      expirationTtl: MCP_TOKEN_TTL_SECONDS
    });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export async function putSnapshot(env, uid, value) {
  const kv = kvOf(env);
  if (!kv) return { ok: false, code: "store_unavailable" };

  const raw = JSON.stringify(value);
  if (raw.length > MCP_LIMITS.SNAPSHOT_MAX_BYTES) {
    return { ok: false, code: "snapshot_too_large" };
  }

  try {
    await kv.put(snapshotKey(uid), raw, { expirationTtl: MCP_SNAPSHOT_TTL_SECONDS });
  } catch {
    return { ok: false, code: "store_unavailable" };
  }
  return { ok: true, bytes: raw.length, expiresIn: MCP_SNAPSHOT_TTL_SECONDS };
}

export async function getSnapshot(env, uid) {
  const kv = kvOf(env);
  if (!kv) return null;

  try {
    const raw = await kv.get(snapshotKey(uid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    /* Ausente ou corrompido: trata como sem snapshot; o próximo depósito
       sobrescreve. Nunca propaga exceção para o protocolo. */
    return null;
  }
}

export async function deleteSnapshot(env, uid) {
  const kv = kvOf(env);
  if (!kv) return false;
  try {
    await kv.delete(snapshotKey(uid));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Token MCP                                                           */
/* ------------------------------------------------------------------ */

/* Cria o token já vinculado ao uid e devolve { ok, token, ... }.
   Teto de MAX_ACTIVE_TOKENS ativos por conta (código "token_limit"). */
export async function issueMcpToken(env, uid) {
  const kv = kvOf(env);
  if (!kv) return { ok: false, code: "store_unavailable" };

  const index = await readTokenIndex(kv, uid);
  if (index.length >= MAX_ACTIVE_TOKENS) {
    return { ok: false, code: "token_limit" };
  }

  const token = randomToken();
  const hash = await sha256Hex(token);
  const createdAt = new Date().toISOString();

  try {
    await kv.put(
      tokenKey(hash),
      JSON.stringify({ uid, createdAt }),
      { expirationTtl: MCP_TOKEN_TTL_SECONDS }
    );
  } catch {
    return { ok: false, code: "store_unavailable" };
  }

  /* Índice é melhor esforço: se esta escrita falhar, o token já emitido
     segue válido e o teto apenas relaxa até a próxima emissão. */
  if (!index.includes(hash)) {
    await writeTokenIndex(kv, uid, [...index, hash]);
  }

  return { ok: true, token, createdAt, expiresInSeconds: MCP_TOKEN_TTL_SECONDS };
}

/* Devolve { uid, hash } ou null. */
export async function resolveMcpToken(env, token) {
  const kv = kvOf(env);
  if (!kv || typeof token !== "string" || !token.startsWith(TOKEN_PREFIX)) return null;

  try {
    const hash = await sha256Hex(token);
    const raw = await kv.get(tokenKey(hash));
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!record || typeof record.uid !== "string" || !record.uid) return null;
    return { uid: record.uid, hash };
  } catch {
    return null;
  }
}

/* Revoga um token SOMENTE se ele pertencer ao uid autenticado. */
export async function revokeMcpToken(env, uid, token) {
  const kv = kvOf(env);
  if (!kv) return { ok: false, code: "store_unavailable" };

  const resolved = await resolveMcpToken(env, token);
  if (!resolved) return { ok: true, revoked: false };
  if (resolved.uid !== uid) return { ok: false, code: "token_not_owned" };

  try {
    await kv.delete(tokenKey(resolved.hash));
  } catch {
    return { ok: false, code: "store_unavailable" };
  }

  /* Libera a vaga no índice (best effort; token já está morto). */
  const index = await readTokenIndex(kv, uid);
  if (index.includes(resolved.hash)) {
    await writeTokenIndex(kv, uid, index.filter((h) => h !== resolved.hash));
  }

  return { ok: true, revoked: true };
}

/* Extrai e resolve o token Bearer de uma requisição /mcp. */
export async function authenticateMcp(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return { error: "missing_token", status: 401 };

  const resolved = await resolveMcpToken(env, match[1].trim());
  if (!resolved) return { error: "invalid_mcp_token", status: 401 };

  return { uid: resolved.uid, hash: resolved.hash };
}
