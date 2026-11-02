/* Cota diária para Groq via Worker usando KV (distribuído entre isolates).
   Limite configurável via env GROQ_DAILY_LIMIT + tracking em KV. */

const QUOTA_CACHE_MS = 60000;

/* Limite padrão Groq free tier: 6000 req/day */
const DEFAULT_GROQ_LIMIT = 6000;
const GROQ_ENV_LIMIT_KEY = "GROQ_DAILY_LIMIT";

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetAtSeconds(dayKey) {
  return Math.floor((Date.parse(`${dayKey}T00:00:00Z`) + 86400000) / 1000);
}

function quotaCacheKey(provider, day) {
  return `quota:${provider}:${day}`;
}

function getGroqLimit(env) {
  if (env[GROQ_ENV_LIMIT_KEY]) {
    const val = Number(env[GROQ_ENV_LIMIT_KEY]);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return DEFAULT_GROQ_LIMIT;
}

/* --- Groq: limite configurável + KV tracking --- */

async function getGroqQuotaKV(env) {
  if (!env.QUOTA_KV) {
    console.log("[quota] QUOTA_KV não disponível");
    return null;
  }

  const day = utcDayKey();
  const now = Date.now();
  const cacheKey = quotaCacheKey("groq", day);
  const limit = getGroqLimit(env);

  const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
  if (cached && cached.at && now - cached.at < QUOTA_CACHE_MS) {
    console.log(`[quota] cache HIT key=${cacheKey} limit=${cached.data?.limit} remaining=${cached.data?.remaining} used=${cached.data?.used}`);
    return cached.data;
  }

  /* Inicializa do zero se não existir */
  const data = {
    provider: "groq",
    day,
    limit,
    used: 0,
    remaining: limit,
    resetAt: resetAtSeconds(day)
  };

  console.log(`[quota] cache MISS key=${cacheKey} init limit=${limit}`);
  await env.QUOTA_KV.put(cacheKey, JSON.stringify({ at: now, data }), {
    expirationTtl: 86400 * 2
  });
  return data;
}

export async function getQuotaForProvider(_env, provider) {
  console.log(`[quota] getQuotaForProvider called provider=${provider}`);
  if (provider === "groq") {
    return getGroqQuotaKV(_env);
  }
  console.warn(`[quota] provider não suportado: ${provider}`);
  return null;
}

export async function burnQuotaForProvider(env, provider) {
  if (!env.QUOTA_KV || provider !== "groq") {
    console.log(`[quota] burnQuota skipped provider=${provider} QUOTA_KV=${!!env.QUOTA_KV}`);
    return;
  }
  const day = utcDayKey();
  const cacheKey = quotaCacheKey(provider, day);
  const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
  if (!cached?.data) {
    console.log(`[quota] burnQuota no cached data key=${cacheKey}`);
    return;
  }
  cached.data.remaining = Math.max(0, cached.data.remaining - 1);
  cached.data.used += 1;
  console.log(`[quota] burnQuota key=${cacheKey} used=${cached.data.used} remaining=${cached.data.remaining}`);
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

/* Backwards compat: mantém a exportação mas retorna null (sem OpenRouter) */
export async function getFreeQuotaKV(_env, _force = false) {
  return null;
}

export function currentQuotaKV(_env) {
  return null;
}