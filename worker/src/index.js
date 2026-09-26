/* LIVRO-CAIXA — Worker proxy de IA (OpenRouter).
   A chave da API fica em secret do Cloudflare; o cliente envia apenas o ID token do Firebase.

   Tabela de rotas (cada handler declara método, origem, autenticação e
   contrato de resposta; NÃO renomear rotas, códigos de erro nem os
   headers X-AI-Quota-* — o index.html os consome):
     OPTIONS  *        → 204 + CORS, ou 403 fora da allowlist
     GET      /health  → { ok: true }            (sem autenticação)
     GET      /quota   → auth + cota forçada → { limit, used, remaining, resetAt, day }
     POST     /ai      → auth + cota         → { text, model }
   Qualquer outra rota → 404 { error, code: "not_found" }.

   Convenção preparada para o próximo passo (nenhuma rota publicada aqui):
   /financial/{provider}/... — gateway isolado por provedor (BCB, Tesouro
   Selic etc.), sem dependência com o módulo de IA. Envelope interno de
   falha de provedor: { code, message, provider, status } (ver
   ai/openrouter.js); cabe ao roteador decidir o que vira resposta HTTP.
   Nenhum endpoint é exposto sem implementação real.

   Limitações conscientes desta versão: rate limit e cota vivem em memória
   por isolate (não distribuídos) — comportamento suficiente para o uso
   atual; a extensão, se necessária, é um armazenamento compartilhado. */

import { json, corsHeaders, withHeaders } from "./shared/http.js";
import { readJsonBody, validateAiPayload } from "./shared/validation.js";
import { authenticate } from "./ai/auth.js";
import { getFreeQuota, currentQuota, burnQuota, quotaHeaderValues } from "./ai/quota.js";
import {
  RETRYABLE_STATUS,
  modelList,
  callOpenRouter,
  failureFromResult,
  emptyReplyFailure
} from "./ai/openrouter.js";

const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT = 30;
const MAX_RATE_BUCKETS = 500;

/* Map de contagem por uid dentro do isolate atual. Sobe junto com o
   isolate e não é compartilhado entre isolates. */
const rateBuckets = new Map();

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

    /* Garante o cache de cota antes de decidir sobre o limite diário. */
    await getFreeQuota(env);
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

    /* Corpo: limite de tamanho → parse → validação de prompt, imagem e
       maxTokens. Nada disso chega ao provedor sem passar por aqui. */
    const body = await readJsonBody(request);
    if (!body.ok) return json(body.body, body.status, cors);

    const validation = validateAiPayload(body.payload);
    if (!validation.ok) return json(validation.body, validation.status, cors);

    const { prompt, imageUrl, maxTokens } = validation.value;

    const content = imageUrl
      ? [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      : prompt;

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
        lastFailure = failureFromResult(result, model, env);

        if (status !== 0 && !RETRYABLE_STATUS.has(status)) {
          return json(
            {
              error: lastFailure.message,
              upstreamStatus: lastFailure.status,
              code: lastFailure.code,
              model: lastFailure.model
            },
            status,
            cors
          );
        }
        continue;
      }

      const reply = result.parsed?.choices?.[0]?.message?.content;
      const text = typeof reply === "string" ? reply.trim() : "";
      if (text) return json({ text, model }, 200, withHeaders(cors, quotaHeaders()));

      lastFailure = emptyReplyFailure(model);
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
