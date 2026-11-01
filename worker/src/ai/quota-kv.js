/* Cota diária por provedor usando KV (distribuído entre isolates).
   OpenRouter: consulta API real (/api/v1/key) como fonte de verdade.
   Google/Groq: limites configuráveis via env + tracking em KV. */

const QUOTA_CACHE_MS = 60000;
const QUOTA_ENDPOINT = "https://openrouter.ai/api/v1/key";

/* Limites padrão por provedor (podem ser sobrescritos por env vars) */
const DEFAULT_LIMITS = {
  openrouter: 1000,   // free tier OpenRouter
  google: 1500,       // Gemini free tier (aprox)
  groq: 14400         // Groq free tier: 6000 req/day (conservative)
};

/* Chaves de env para limites customizáveis */
const ENV_LIMIT_KEYS = {
  openrouter: "OPENROUTER_DAILY_LIMIT",
  google: "GOOGLE_DAILY_LIMIT",
  groq: "GROQ_DAILY_LIMIT"
};

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetAtSeconds(dayKey) {
  return Math.floor((Date.parse(`${dayKey}T00:00:00Z`) + 86400000) / 1000);
}

function quotaCacheKey(provider, day) {
  return `quota:${provider}:${day}`;
}

function getProviderLimit(env, provider) {
  const envKey = ENV_LIMIT_KEYS[provider];
  if (envKey && env[envKey]) {
    const val = Number(env[envKey]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return DEFAULT_LIMITS[provider] || 1000;
}

/* --- OpenRouter: consulta API real --- */

export async function getOpenRouterQuotaKV(env, force = false) {
  if (!env.OPENROUTER_API_KEY || !env.QUOTA_KV) return null;

  const day = utcDayKey();
  const now = Date.now();
  const cacheKey = quotaCacheKey("openrouter", day);

  if (!force) {
    const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
    if (cached && cached.at && now - cached.at < QUOTA_CACHE_MS) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(QUOTA_ENDPOINT, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
      return cached?.data || null;
    }
    const parsed = await response.json();
    const quota = parsed?.data?.free_model_daily_requests;
    if (!quota || !Number.isFinite(quota.limit)) {
      const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
      return cached?.data || null;
    }

    const limit = Math.max(0, Number(quota.limit) || 0);
    const used = Math.max(0, Number(quota.used) || 0);
    const remaining = Math.max(0, Number(quota.remaining) || 0);

    const data = {
      provider: "openrouter",
      day,
      limit,
      used,
      remaining: Math.min(remaining, limit),
      resetAt: resetAtSeconds(day)
    };

    await env.QUOTA_KV.put(cacheKey, JSON.stringify({ at: now, data }), {
      expirationTtl: 86400 * 2
    });
    return data;
  } catch (quotaError) {
    const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
    return cached?.data || null;
  }
}

/* Leitura autoritativa sem cache (para GET /quota?force e monitor) */
export async function getOpenRouterUsageKV(env) {
  if (!env.OPENROUTER_API_KEY) return { ok: false, code: "openrouter_key_missing" };

  try {
    const response = await fetch(QUOTA_ENDPOINT, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status >= 300 && response.status < 400) return { ok: false, code: "openrouter_unavailable" };
    if (!response.ok) return { ok: false, code: "openrouter_unavailable" };

    const parsed = await response.json();
    const usage = parsed?.data?.free_model_daily_requests;
    const used = Number(usage?.used);
    const limit = Number(usage?.limit);
    const remaining = Number(usage?.remaining);
    if (!usage || !Number.isFinite(used) || !Number.isFinite(limit) || !Number.isFinite(remaining)) {
      return { ok: false, code: "openrouter_invalid_response" };
    }

    const safeLimit = Math.max(0, limit);
    const safeUsed = Math.max(0, used);
    const safeRemaining = Math.max(0, Math.min(remaining, safeLimit));
    return { ok: true, used: safeUsed, limit: safeLimit, remaining: safeRemaining };
  } catch (usageError) {
    return { ok: false, code: "openrouter_unavailable" };
  }
}

/* --- Google / Groq: limites configuráveis + KV tracking --- */

async function getConfiguredQuotaKV(env, provider) {
  if (!env.QUOTA_KV) return null;

  const day = utcDayKey();
  const now = Date.now();
  const cacheKey = quotaCacheKey(provider, day);
  const limit = getProviderLimit(env, provider);

  const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
  if (cached && cached.at && now - cached.at < QUOTA_CACHE_MS) {
    return cached.data;
  }

  /* Inicializa do zero se não existir */
  const data = {
    provider,
    day,
    limit,
    used: 0,
    remaining: limit,
    resetAt: resetAtSeconds(day)
  };

  await env.QUOTA_KV.put(cacheKey, JSON.stringify({ at: now, data }), {
    expirationTtl: 86400 * 2
  });
  return data;
}

export async function getQuotaForProvider(env, provider) {
  switch (provider) {
    case "openrouter":
      return getOpenRouterQuotaKV(env);
    case "google":
      return getConfiguredQuotaKV(env, "google");
    case "groq":
      return getConfiguredQuotaKV(env, "groq");
    default:
      return null;
  }
}

export async function burnQuotaForProvider(env, provider) {
  if (!env.QUOTA_KV) return;
  const day = utcDayKey();
  const cacheKey = quotaCacheKey(provider, day);
  const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
  if (!cached?.data) return;
  cached.data.remaining = Math.max(0, cached.data.remaining - 1);
  cached.data.used += 1;
  await env.QUOTA_KV.put(cacheKey, JSON.stringify(cached), { expirationTtl: 86400 * 2 });
}

/* --- Helpers --- */

export function quotaHeaderValues(quota) {
  if (!quota) return {};
  return {
    "X-AI-Quota-Limit": String(quota.limit),
    "X-AI-Quota-Remaining": String(quota.remaining),
    "X-AI-Quota-Reset": String(quota.resetAt),
    "X-AI-Quota-Provider": quota.provider || "unknown"
  };
}

/* Backwards compat: o frontend e GET /quota esperam getFreeQuotaKV para OpenRouter */
export async function getFreeQuotaKV(env, force = false) {
  return getOpenRouterQuotaKV(env, force);
}

export function currentQuotaKV(env) {
  return null;
}