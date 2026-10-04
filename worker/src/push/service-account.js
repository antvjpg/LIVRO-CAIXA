const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

let cachedAccessToken = { value: null, expiresAt: 0 };

function bytesToB64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function textToB64url(text) {
  return bytesToB64url(new TextEncoder().encode(text));
}

function b64urlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function parseServiceAccount(raw) {
  if (!raw) throw new Error("secret FIREBASE_SERVICE_ACCOUNT ausente");
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    throw new Error("secret FIREBASE_SERVICE_ACCOUNT não é JSON válido");
  }
  if (!parsed || typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") {
    throw new Error("service account inválido: faltam client_email/private_key");
  }
  return parsed;
}

async function signJwt(serviceAccount, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = textToB64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = textToB64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: scopes.join(" "),
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600
    })
  );
  const unsigned = `${header}.${claims}`;
  const keyBytes = b64urlToBytes(
    serviceAccount.private_key
      .replace(/-----[A-Z ]+-----/g, "")
      .replace(/\s+/g, "")
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${bytesToB64url(new Uint8Array(signature))}`;
}

export async function getGoogleAccessToken(env) {
  const now = Date.now();
  if (cachedAccessToken.value && now < cachedAccessToken.expiresAt - 60000) {
    return cachedAccessToken.value;
  }
  const serviceAccount = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT);
  const assertion = await signJwt(serviceAccount, [DATASTORE_SCOPE, FCM_SCOPE]);
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`troca de token Google falhou (${response.status}): ${detail.slice(0, 200)}`);
  }
  const payload = await response.json();
  cachedAccessToken = {
    value: payload.access_token,
    expiresAt: now + Number(payload.expires_in || 3600) * 1000
  };
  return cachedAccessToken.value;
}
