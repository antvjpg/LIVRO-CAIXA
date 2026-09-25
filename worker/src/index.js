/* LIVRO-CAIXA — Worker proxy de IA (OpenRouter).
   A chave da API fica em secret do Cloudflare; o cliente envia apenas o ID token do Firebase. */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS_CACHE_URL = "https://jwks-cache.internal/securetoken.json";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
/* Ordem de tentativa. Em 429/5xx o Worker passa para o próximo modelo free. */
const DEFAULT_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nex-agi/nex-n2.5-mini:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "qwen/qwen3.8-27b:free",
  "google/gemma-4-31b-it:free"
];
const RETRYABLE_STATUS = new Set([402, 408, 429, 500, 502, 503, 504]);
const UPSTREAM_TIMEOUT_MS = 45000;
const DEFAULT_MAX_TOKENS = 900;
const MAX_TOKENS_CAP = 4096;
const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT = 30;
const MAX_RATE_BUCKETS = 500;

const rateBuckets = new Map();

/* Cota diária de modelos free, lida da API do OpenRouter (GET /api/v1/key).
   Cache em memória: 60 s, e sempre zerado quando o dia UTC muda. */
const QUOTA_CACHE_MS = 60000;
const QUOTA_ENDPOINT = "https://openrouter.ai/api/v1/key";
let quotaCache = { at: 0, day: "", data: null };

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetAtSeconds(dayKey) {
  return Math.floor((Date.parse(`${dayKey}T00:00:00Z`) + 86400000) / 1000);
}

async function getFreeQuota(env, force = false) {
  if (!env.OPENROUTER_API_KEY) return null;

  const day = utcDayKey();
  const now = Date.now();

  if (quotaCache.day !== day) quotaCache = { at: 0, day, data: null };

  if (!force && quotaCache.data && now - quotaCache.at < QUOTA_CACHE_MS) {
    return quotaCache.data;
  }

  try {
    const response = await fetch(QUOTA_ENDPOINT, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return quotaCache.data;
    const parsed = await response.json();
    const quota = parsed?.data?.free_model_daily_requests;
    if (!quota || !Number.isFinite(quota.limit)) return quotaCache.data;

    quotaCache = {
      at: now,
      day,
      data: {
        day,
        limit: quota.limit,
        used: Number(quota.used) || 0,
        remaining: Math.max(0, Number(quota.remaining) || 0),
        resetAt: resetAtSeconds(day)
      }
    };
    return quotaCache.data;
  } catch (quotaError) {
    return quotaCache.data;
  }
}

/* Decrementa localmente após cada chamada que chegou ao OpenRouter,
   para o cliente ver o número cair sem esperar a API atualizar. */
function burnQuota() {
  const data = quotaCache.data;
  if (!data) return;
  data.remaining = Math.max(0, data.remaining - 1);
  data.used += 1;
}

function quotaHeaderValues(quota) {
  if (!quota) return {};
  return {
    "X-AI-Quota-Limit": String(quota.limit),
    "X-AI-Quota-Remaining": String(quota.remaining),
    "X-AI-Quota-Reset": String(quota.resetAt)
  };
}

function withHeaders(cors, extra) {
  return Object.assign({}, cors || {}, extra || {});
}

async function authenticate(request, env, cors) {
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

function corsHeaders(origin, env) {
  if (!origin) return null;
  const allowed = String(env.ALLOW_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-expose-headers":
      "X-AI-Quota-Limit, X-AI-Quota-Remaining, X-AI-Quota-Reset",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      cors || {}
    )
  });
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

async function getJwks() {
  try {
    const cache = caches.default;
    const hit = await cache.match(JWKS_CACHE_URL);
    if (hit) return await hit.json();
  } catch (cacheError) {
    /* segue sem cache */
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
  const jwk = keys.find(
    (item) => item && item.kty === "RSA" && item.kid === header.kid && (item.alg === "RS256" || !item.alg)
  );
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

function isRateLimited(uid, env) {
  const configured = Number(env.AI_RATE_LIMIT_PER_MINUTE);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RATE_LIMIT;
  const now = Date.now();
  const bucket = rateBuckets.get(uid);

  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) rateBuckets.clear();
    rateBuckets.set(uid, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

function upstreamMessage(status, raw, parsed) {
  const detail =
    (parsed && (parsed.error?.message || parsed.message)) || String(raw || "").slice(0, 200);
  if (status === 429) {
    return "A IA atingiu o limite de uso temporariamente. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 402) {
    return "A IA está indisponível no momento. Tente novamente mais tarde.";
  }
  return `A IA respondeu com erro ${status}${detail ? `: ${detail}` : "."}`;
}

function modelList(env) {
  const raw = env.OPENROUTER_MODELS || DEFAULT_MODELS.join(",");
  const list = String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

async function callOpenRouter(model, env, content, maxTokens, referer) {
  let response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "LIVRO-CAIXA"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: 0.2,
        max_tokens: maxTokens,
        reasoning: { effort: "none" },
        reasoning_effort: "none"
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });
  } catch (networkError) {
    return { ok: false, status: 0, raw: "", parsed: null };
  }

  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    parsed = null;
  }
  return { ok: response.ok, status: response.status, raw, parsed };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      if (!cors) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, cors || {});
    }

    if (url.pathname === "/quota") {
      if (!cors) return json({ error: "Origem não autorizada.", code: "origin_blocked" }, 403, null);
      if (request.method !== "GET") {
        return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors);
      }

      const quotaAuth = await authenticate(request, env, cors);
      if (quotaAuth instanceof Response) return quotaAuth;

      const quota = await getFreeQuota(env, true);
      if (!quota) {
        return json(
          { error: "Não foi possível consultar o limite de leituras agora.", code: "quota_unavailable" },
          503,
          cors
        );
      }

      return json(
        {
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
          day: quota.day
        },
        200,
        cors
      );
    }

    if (url.pathname !== "/ai") {
      return json({ error: "Rota não encontrada.", code: "not_found" }, 404, cors || {});
    }

    if (request.method !== "POST") {
      return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors);
    }

    if (!cors) {
      return json({ error: "Origem não autorizada.", code: "origin_blocked" }, 403, null);
    }

    const authResult = await authenticate(request, env, cors);
    if (authResult instanceof Response) return authResult;
    const claims = authResult.claims;

    if (!env.OPENROUTER_API_KEY) {
      return json(
        { error: "IA não configurada no servidor.", code: "missing_server_key" },
        503,
        cors
      );
    }

    if (isRateLimited(claims.sub, env)) {
      return json(
        {
          error: "Muitas solicitações de IA agora. Aguarde alguns segundos e tente novamente.",
          code: "rate_limited"
        },
        429,
        cors
      );
    }

    const quota = await getFreeQuota(env);
    const currentQuota = () => quotaCache.data || quota;
    const quotaHeaders = () => quotaHeaderValues(currentQuota());

    if (currentQuota() && currentQuota().remaining <= 0) {
      return json(
        {
          error:
            "A IA atingiu o limite diário de leituras. O limite volta a ser liberado à meia-noite (UTC).",
          code: "daily_limit",
          quota: currentQuota()
        },
        429,
        withHeaders(cors, quotaHeaders())
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (bodyError) {
      return json({ error: "Corpo da requisição inválido.", code: "bad_body" }, 400, cors);
    }

    const prompt = String(payload?.prompt || "").trim();
    if (!prompt) {
      return json({ error: "Prompt vazio para a análise de IA.", code: "empty_prompt" }, 400, cors);
    }

    const imageUrl = payload?.imagePart?.image_url?.url;
    const content =
      typeof imageUrl === "string" && imageUrl
        ? [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        : prompt;

    let maxTokens = Number(payload?.maxTokens);
    if (!Number.isFinite(maxTokens) || maxTokens <= 0) maxTokens = DEFAULT_MAX_TOKENS;
    maxTokens = Math.min(Math.floor(maxTokens), MAX_TOKENS_CAP);

    const referer = origin || "https://livro-caixa.local";
    const models = modelList(env);
    let lastFailure = null;

    for (const model of models) {
      const result = await callOpenRouter(model, env, content, maxTokens, referer);

      /* Conta na cota apenas o que deu certo: tentativas que o OpenRouter
         recusou (402/404 de modelo pago, falha de rede) não gastam o dia. */
      if (result.ok) burnQuota();

      if (!result.ok) {
        const status = result.status || 0;
        const message =
          status === 0
            ? "Falha de rede ao consultar a IA. Verifique a conexão."
            : upstreamMessage(status, result.raw, result.parsed);

        lastFailure = {
          status,
          message,
          code: status === 0 ? "network" : `upstream_${status}`,
          model
        };

        if (status !== 0 && !RETRYABLE_STATUS.has(status)) {
          return json(
            { error: message, upstreamStatus: status, code: lastFailure.code, model },
            status,
            cors
          );
        }
        continue;
      }

      const reply = result.parsed?.choices?.[0]?.message?.content;
      const text = typeof reply === "string" ? reply.trim() : "";
      if (text) return json({ text, model }, 200, withHeaders(cors, quotaHeaders()));

      lastFailure = {
        status: 502,
        message: "A IA não retornou uma resposta utilizável.",
        code: "empty_reply",
        model
      };
    }

    if (!lastFailure) {
      return json({ error: "IA indisponível no momento.", code: "no_model" }, 502, cors);
    }

    const failureStatus =
      lastFailure.status >= 400 && lastFailure.status <= 599 ? lastFailure.status : 502;

    const exhausted =
      failureStatus === 429 && currentQuota() && currentQuota().remaining <= 0;

    return json(
      {
        error: exhausted
          ? "A IA atingiu o limite diário de leituras. O limite volta a ser liberado à meia-noite (UTC)."
          : lastFailure.message,
        upstreamStatus: lastFailure.status,
        code: exhausted ? "daily_limit" : lastFailure.code,
        model: lastFailure.model,
        tried: models.length
      },
      failureStatus,
      failureStatus === 429 ? withHeaders(cors, quotaHeaders()) : cors
    );
  }
};
