/* Rate limit distribuído usando KV.
   Chave: "ratelimit:<prefix>:<key>:<windowStart>"
   Valor: contador (number)
   TTL: 2 minutos (cobre a janela de 1 minuto + margem) */

const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_FINANCIAL_RATE_LIMIT = 20;

function windowStartKey() {
  return Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
}

function rateLimitKey(prefix, key) {
  const windowStart = windowStartKey();
  return `ratelimit:${prefix}:${key}:${windowStart}`;
}

export async function isRateLimitedKV(key, env, options = {}) {
  if (!env.RATE_LIMIT_KV) return false; // fallback: sem KV = sem limit

  const limitEnvVar = options.limitEnvVar || "AI_RATE_LIMIT_PER_MINUTE";
  const defaultLimit = options.defaultLimit || DEFAULT_RATE_LIMIT;
  const prefix = options.prefix || "";

  const configured = Number(env[limitEnvVar]);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : defaultLimit;

  const rlKey = rateLimitKey(prefix, key);
  const current = await env.RATE_LIMIT_KV.get(rlKey);
  const count = current ? Number(current) : 0;

  if (count >= limit) {
    return true;
  }

  // Incrementa com TTL de 2 minutos
  await env.RATE_LIMIT_KV.put(rlKey, String(count + 1), { expirationTtl: 120 });
  return false;
}