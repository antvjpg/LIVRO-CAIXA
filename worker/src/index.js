/* LIVRO-CAIXA — Worker gateway financeiro.
   Apenas rotas financeiras e de push; IA/MCP/bridge removidos.

   Tabela de rotas:
      OPTIONS  *            → 204 + CORS, ou 403 fora da allowlist
      GET      /health      → { ok: true }        (sem autenticação)
      GET      /financial/  → gateway financeiro  → BCB (SGS) e Tesouro
                              (sem autenticação: dado público; Origin na
                              allowlist + rate limit próprio por IP/origem)
      scheduled             → push dispatch (cron)

    Qualquer outra rota → 404 { error, code: "not_found" }. */

import { json, corsHeaders } from "./shared/http.js";
import { handleFinancial } from "./financial/gateway.js";
import { runPushDispatch } from "./push/sender.js";

/* Rate limit em memória como fallback quando KV não disponível */
const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_FINANCIAL_RATE_LIMIT = 20;
const MAX_RATE_BUCKETS = 500;
const rateBuckets = new Map();

function isRateLimitedMemory(key, env, options = {}) {
  const limitEnvVar = options.limitEnvVar || "FINANCIAL_RATE_LIMIT_PER_MINUTE";
  const defaultLimit = options.defaultLimit || DEFAULT_FINANCIAL_RATE_LIMIT;
  const prefix = options.prefix || "";

  const configured = Number(env[limitEnvVar]);
  const limit = Number.isFinite(configured) && configured > 0 ? configured : defaultLimit;
  const now = Date.now();
  const bucketKey = `${prefix}${key}`;
  const bucket = rateBuckets.get(bucketKey);

  if (!bucket || now - bucket.start >= RATE_LIMIT_WINDOW_MS) {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) rateBuckets.clear();
    rateBuckets.set(bucketKey, { start: now, count: 1 });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}

async function isRateLimited(key, env, options = {}) {
  if (env.RATE_LIMIT_KV) {
    const { isRateLimitedKV } = await import("./shared/ratelimit-kv.js");
    return isRateLimitedKV(key, env, options);
  }
  return isRateLimitedMemory(key, env, options);
}

export default {
  async fetch(request, env) {
    try {
      return await handleFetch(request, env);
    } catch (error) {
      console.error(`erro interno em ${request.method} ${new URL(request.url).pathname}: ${error && error.message}`);
      return json({ error: "Erro interno do servidor.", code: "internal_error" }, 500, null);
    }
  },

  async scheduled(event, env) {
    const summary = await runPushDispatch(env);
    console.log(JSON.stringify({ event: "push_dispatch", cron: event && event.cron, ...summary }));
  }
};

async function handleFetch(request, env) {
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

  /* Rotas financeiras: dado público, sem autenticação, mas com a mesma
     allowlist de origem do restante e rate limit próprio por IP/origem. */
  if (url.pathname === "/financial" || url.pathname.startsWith("/financial/")) {
    if (!cors) return json({ error: "Origem não autorizada.", code: "origin_blocked" }, 403, null);
    if (request.method !== "GET") {
      return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors);
    }

    const rateKey = request.headers.get("cf-connecting-ip") || origin || "unknown";
    const limited = await isRateLimited(rateKey, env, {
      limitEnvVar: "FINANCIAL_RATE_LIMIT_PER_MINUTE",
      defaultLimit: DEFAULT_FINANCIAL_RATE_LIMIT,
      prefix: "financial:"
    });
    if (limited) {
      return json(
        {
          error: "Muitas consultas financeiras agora. Aguarde alguns segundos e tente novamente.",
          code: "financial_rate_limited"
        },
        429,
        cors
      );
    }

    return handleFinancial(request, env, cors);
  }

  return json({ error: "Rota não encontrada.", code: "not_found" }, 404, cors || {});
}