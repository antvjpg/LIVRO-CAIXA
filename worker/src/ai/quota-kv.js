/* Cota diária de modelos free usando KV (distribuído entre isolates).
   Substitui quota.js em memória para produção. */

const QUOTA_CACHE_MS = 60000;
const QUOTA_ENDPOINT = "https://openrouter.ai/api/v1/key";

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetAtSeconds(dayKey) {
  return Math.floor((Date.parse(`${dayKey}T00:00:00Z`) + 86400000) / 1000);
}

function quotaCacheKey(day) {
  return `quota:${day}`;
}

export async function getFreeQuotaKV(env, force = false) {
  if (!env.OPENROUTER_API_KEY || !env.QUOTA_KV) return null;

  const day = utcDayKey();
  const now = Date.now();
  const cacheKey = quotaCacheKey(day);

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

export async function burnQuotaKV(env) {
  if (!env.QUOTA_KV) return;
  const day = utcDayKey();
  const cacheKey = quotaCacheKey(day);
  const cached = await env.QUOTA_KV.get(cacheKey, { type: "json" });
  if (!cached?.data) return;
  cached.data.remaining = Math.max(0, cached.data.remaining - 1);
  cached.data.used += 1;
  await env.QUOTA_KV.put(cacheKey, JSON.stringify(cached), { expirationTtl: 86400 * 2 });
}

export function currentQuotaKV(env) {
  // This is sync but needs async KV - use getFreeQuotaKV instead
  return null;
}

export function quotaHeaderValues(quota) {
  if (!quota) return {};
  return {
    "X-AI-Quota-Limit": String(quota.limit),
    "X-AI-Quota-Remaining": String(quota.remaining),
    "X-AI-Quota-Reset": String(quota.resetAt)
  };
}