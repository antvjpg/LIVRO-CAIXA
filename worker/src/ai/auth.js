/* Autenticação do Worker: ID token do Firebase → claims.
   Área sensível: nunca logar token, header Authorization ou UID.
   O motivo de rejeição é registrado apenas como motivo curto. */

import { json } from "../shared/http.js";

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS_CACHE_URL = "https://jwks-cache.internal/securetoken.json";

/* Resposta pronta de 401 usada por /ai e /quota (contrato preservado). */
export async function authenticate(request, env, cors) {
  const authHeader = request.headers.get("Authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return json(
      {
        error: "Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida.",
        code: "missing_token"
      },
      401,
      cors
    );
  }

  try {
    return { claims: await verifyFirebaseIdToken(idToken, env) };
  } catch (tokenError) {
    /* Motivo apenas — nunca o token ou o UID. */
    console.warn("id_token_rejected", String(tokenError?.message || tokenError));
    return json(
      { error: "Sessão inválida ou expirada. Entre novamente para usar a IA.", code: "invalid_token" },
      401,
      cors
    );
  }
}

function b64urlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

/* force=true ignora o cache (rotação de chaves do Firebase): quando o
   token traz um kid desconhecido, buscamos os JWKS de novo antes de
   rejeitar. O fetch só acontece nesses casos, não em todo request. */
async function getJwks(force = false) {
  if (!force) {
    try {
      const cache = caches.default;
      const hit = await cache.match(JWKS_CACHE_URL);
      if (hit) return await hit.json();
    } catch (cacheError) {
      /* segue sem cache */
    }
  }

  const response = await fetch(JWKS_URL, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("jwks_unavailable");

  const data = await response.json();
  try {
    await caches.default.put(
      JWKS_CACHE_URL,
      new Response(JSON.stringify(data), {
        headers: {
          "content-type": "application/json",
          "cache-control": "public, max-age=3600"
        }
      })
    );
  } catch (cacheError) {
    /* cache é opcional */
  }
  return data;
}

function findRsaKey(keys, kid) {
  return keys.find(
    (item) => item && item.kty === "RSA" && item.kid === kid && (item.alg === "RS256" || !item.alg)
  );
}

async function importRsaKey(jwk) {
  try {
    return await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch (firstError) {
    const minimal = { kty: jwk.kty, n: jwk.n, e: jwk.e, kid: jwk.kid };
    return await crypto.subtle.importKey(
      "jwk",
      minimal,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  }
}

async function verifyFirebaseIdToken(token, env) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed_token");

  let header;
  let payload;
  try {
    header = JSON.parse(bytesToText(b64urlToBytes(parts[0])));
    payload = JSON.parse(bytesToText(b64urlToBytes(parts[1])));
  } catch (parseError) {
    throw new Error("malformed_token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("expired_token");
  }

  /* Formato atual do Firebase: https://securetoken.google.com/<project-id>.
     Formato legado: https://securetoken@system.gserviceaccount.com */
  const expectedIssuers = new Set([
    `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
    "https://securetoken@system.gserviceaccount.com"
  ]);
  const tokenIssuer = String(payload.iss || "").replace(/\/+$/, "");
  if (!expectedIssuers.has(tokenIssuer)) {
    throw new Error(`bad_issuer:${String(payload.iss || "vazio").slice(0, 120)}`);
  }
  if (payload.aud !== env.FIREBASE_PROJECT_ID) {
    throw new Error(`bad_audience:${String(payload.aud || "vazio").slice(0, 60)}`);
  }
  if (typeof payload.sub !== "string" || payload.sub.length < 1 || payload.sub.length > 128) {
    throw new Error("bad_subject");
  }

  const jwks = await getJwks();
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  let jwk = findRsaKey(keys, header.kid);

  if (!jwk) {
    /* Kid desconhecido: pode ser rotação de chave do Firebase. */
    const refreshed = await getJwks(true);
    const refreshedKeys = Array.isArray(refreshed?.keys) ? refreshed.keys : [];
    jwk = findRsaKey(refreshedKeys, header.kid);
  }

  if (!jwk) throw new Error(`unknown_key_id:${String(header.kid || "vazio").slice(0, 60)}`);

  const key = await importRsaKey(jwk);
  const signatureOk = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    textToBytes(`${parts[0]}.${parts[1]}`)
  );
  if (!signatureOk) throw new Error("bad_signature");

  return payload;
}
