/* Cota diária de modelos free, lida da API do OpenRouter (GET /api/v1/key).

   Papéis:
   - getFreeQuota: fonte com cache (60 s, zera ao mudar o dia UTC).
     force=true (GET /quota) é a leitura autoritativa para o cliente.
   - currentQuota: leitura do cache válido apenas dentro do mesmo dia UTC.
   - burnQuota: decremento local estimado após cada chamada que chegou ao
     OpenRouter, só para o cliente ver o número cair sem esperar a API.
   - quotaHeaderValues: nomes de header fixos consumidos pelo index.html
     (X-AI-Quota-Limit / Remaining / Reset). Não renomear.
   O limite diário bloqueia dentro de /ai; o cache não é a única garantia. */

const QUOTA_CACHE_MS = 60000;
const QUOTA_ENDPOINT = "https://openrouter.ai/api/v1/key";
let quotaCache = { at: 0, day: "", data: null };

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resetAtSeconds(dayKey) {
  return Math.floor((Date.parse(`${dayKey}T00:00:00Z`) + 86400000) / 1000);
}

export async function getFreeQuota(env, force = false) {
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

    const limit = Math.max(0, Number(quota.limit) || 0);
    const used = Math.max(0, Number(quota.used) || 0);
    const remaining = Math.max(0, Number(quota.remaining) || 0);

    quotaCache = {
      at: now,
      day,
      data: {
        day,
        limit,
        used,
        /* Nunca acima do limite: usado pelo cliente como limit - remaining. */
        remaining: Math.min(remaining, limit),
        resetAt: resetAtSeconds(day)
      }
    };
    return quotaCache.data;
  } catch (quotaError) {
    return quotaCache.data;
  }
}

/* Leitura atual do cache, válida só se ainda for o dia UTC gravado. */
export function currentQuota() {
  if (!quotaCache.data || quotaCache.day !== utcDayKey()) return null;
  return quotaCache.data;
}

/* Decrementa localmente após cada chamada que chegou ao OpenRouter,
   para o cliente ver o número cair sem esperar a API atualizar. */
export function burnQuota() {
  const data = currentQuota();
  if (!data) return;
  data.remaining = Math.max(0, data.remaining - 1);
  data.used += 1;
}

export function quotaHeaderValues(quota) {
  if (!quota) return {};
  return {
    "X-AI-Quota-Limit": String(quota.limit),
    "X-AI-Quota-Remaining": String(quota.remaining),
    "X-AI-Quota-Reset": String(quota.resetAt)
  };
}
