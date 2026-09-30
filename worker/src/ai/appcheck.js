/* Verificação de App Check do Firebase no Worker.
   Valida o token X-Firebase-AppCheck usando chaves públicas do Firebase.
   Sem firebase-admin: usa JWKS público + crypto.subtle (igual ao ID token). */

const APPCHECK_JWKS_URL =
  "https://firebaseappcheck.googleapis.com/v1/jwks";
const APPCHECK_JWKS_CACHE_URL = "https://jwks-cache.internal/firebaseappcheck.json";

async function getAppCheckJwks(force = false) {
  if (!force) {
    try {
      const cache = caches.default;
      const hit = await cache.match(APPCHECK_JWKS_CACHE_URL);
      if (hit) return await hit.json();
    } catch (cacheError) {
      /* segue sem cache */
    }
  }

  const response = await fetch(APPCHECK_JWKS_URL, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error("appcheck_jwks_unavailable");

  const data = await response.json();
  try {
    await caches.default.put(
      APPCHECK_JWKS_CACHE_URL,
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

export async function verifyAppCheckToken(token, env) {
  if (!token || typeof token !== "string") {
    throw new Error("missing_appcheck_token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed_appcheck_token");

  let header;
  let payload;
  try {
    header = JSON.parse(bytesToText(b64urlToBytes(parts[0])));
    payload = JSON.parse(bytesToText(b64urlToBytes(parts[1])));
  } catch (parseError) {
    throw new Error("malformed_appcheck_token");
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("expired_appcheck_token");
  }

  /* Verifica audience: deve ser o project ID do Firebase */
  if (payload.aud !== env.FIREBASE_PROJECT_ID) {
    throw new Error(`bad_appcheck_audience:${String(payload.aud || "vazio").slice(0, 60)}`);
  }

  /* Verifica issuer */
  const expectedIssuer = `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_ID}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error(`bad_appcheck_issuer:${String(payload.iss || "vazio").slice(0, 120)}`);
  }

  const jwks = await getAppCheckJwks();
  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  let jwk = findRsaKey(keys, header.kid);

  if (!jwk) {
    const refreshed = await getAppCheckJwks(true);
    const refreshedKeys = Array.isArray(refreshed?.keys) ? refreshed.keys : [];
    jwk = findRsaKey(refreshedKeys, header.kid);
  }

  if (!jwk) throw new Error(`unknown_appcheck_key_id:${String(header.kid || "vazio").slice(0, 60)}`);

  const key = await importRsaKey(jwk);
  const signatureOk = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(parts[2]),
    textToBytes(`${parts[0]}.${parts[1]}`)
  );
  if (!signatureOk) throw new Error("bad_appcheck_signature");

  return payload;
}

export async function requireAppCheck(request, env, cors) {
  const appCheckToken = request.headers.get("X-Firebase-AppCheck") || "";
  if (!appCheckToken) {
    return { ok: true };
  }

  try {
    await verifyAppCheckToken(appCheckToken, env);
    return { ok: true };
  } catch (err) {
    console.warn("appcheck_rejected", String(err?.message || err));
    return {
      ok: false,
      response: new Response(JSON.stringify({
        error: "App Check inválido ou expirado. Reabra o aplicativo oficial.",
        code: "invalid_appcheck"
      }), {
        status: 401,
        headers: Object.assign({ "content-type": "application/json; charset=utf-8" }, cors || {})
      })
    };
  }
}