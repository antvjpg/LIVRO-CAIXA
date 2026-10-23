/* LIVRO-CAIXA — Worker proxy de IA (OpenRouter).
   A chave da API fica em secret do Cloudflare; o cliente envia apenas o ID token do Firebase.

   Tabela de rotas (cada handler declara método, origem, autenticação e
   contrato de resposta; NÃO renomear rotas, códigos de erro nem os
   headers X-AI-Quota-* — o index.html os consome):
      OPTIONS  *            → 204 + CORS, ou 403 fora da allowlist
      GET      /health      → { ok: true }        (sem autenticação)
      GET      /quota       → auth + cota forçada → { limit, used, remaining, resetAt, day }
      POST     /ai          → auth + cota         → { text, model }
      GET      /financial/  → gateway financeiro  → BCB (SGS) e Tesouro
                             (sem autenticação: dado público; Origin na
                             allowlist + rate limit próprio por IP/origem)
       POST     /mcp         → token MCP (mxc_ ou OAuth) + rate limit
                              → JSON-RPC MCP (somente leitura; sem
                              exigência de Origin: cliente é servidor
                              externo, não navegador)
       GET      /.well-known/oauth-* → discovery OAuth (RFC 9728/8414)
       POST     /register    → DCR (RFC 7591), rate limit por IP
       GET/POST /authorize   → consentimento (cole o token mxc_)
       POST     /token       → code+PKCE S256 / refresh rotativo
       POST     /bridge/snapshot → auth Firebase → deposita snapshot
                              externo (Fase 1) no KV, TTL 1 h
       POST/DELETE /bridge/token → auth Firebase → emite/revoga token
                              MCP dedicado (o bruto aparece só 1 vez)
   Qualquer outra rota → 404 { error, code: "not_found" }.

   Envelope interno de falha de provedor: { code, message, provider,
   status } (ver ai/openrouter.js e financial/gateway.js); cabe ao
   roteador decidir o que vira resposta HTTP.

   Limitações conscientes desta versão: rate limit e cota vivem em memória
   por isolate (não distribuídos) — comportamento suficiente para o uso
   atual; a extensão, se necessária, é um armazenamento compartilhado. */

import { json, corsHeaders, withHeaders } from "./shared/http.js";
import { readJsonBody, validateAiPayload } from "./shared/validation.js";
/* Contrato do chat: fonte única compartilhada com o index.html. */
import { validateChatPayload, CHAT_LIMITS } from "../../js/domain/ai-chat-contract.js";
import { buildChatSystemPrompt } from "./ai/chat-prompt.js";
import { authenticate } from "./ai/auth.js";
import { requireAppCheck } from "./ai/appcheck.js";
import { getFreeQuotaKV, burnQuotaKV, quotaHeaderValues } from "./ai/quota-kv.js";
import { isRateLimitedKV } from "./ai/ratelimit-kv.js";
import {
  RETRYABLE_STATUS,
  modelList,
  callOpenRouter,
  failureFromResult,
  emptyReplyFailure
} from "./ai/openrouter.js";
import { handleFinancial } from "./financial/gateway.js";
import { runPushDispatch } from "./push/sender.js";
import { validateExternalSnapshotResult, MCP_LIMITS } from "../../js/domain/mcp-financial-contract.js";
import { handleMcpMessage } from "./mcp/protocol.js";
import { issueMcpToken, revokeMcpToken, putSnapshot } from "./mcp/store.js";
import { authenticateMcpAny, oauthChallenge, handleOAuthRequest, isOAuthPath } from "./mcp/oauth.js";

/* Rate limit em memória como fallback quando KV não disponível */
const RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_FINANCIAL_RATE_LIMIT = 20;
const DEFAULT_MCP_RATE_LIMIT = 20;
const DEFAULT_MCP_ANON_RATE_LIMIT = 60;
const DEFAULT_BRIDGE_RATE_LIMIT = 20;
/* Tetos de corpo por rota da ponte: JSON-RPC é minúsculo; o envelope do
   snapshot é limitado pelo contrato (64 KB) e aqui só evita ler 24 MB
   antes de validar; revogação leva um token de ~50 chars. */
const MCP_MAX_BODY_BYTES = 64 * 1024;
const BRIDGE_SNAPSHOT_MAX_BODY_BYTES = MCP_LIMITS.SNAPSHOT_MAX_BYTES * 2;
const BRIDGE_TOKEN_MAX_BODY_BYTES = 8 * 1024;
const MAX_RATE_BUCKETS = 500;
const rateBuckets = new Map();

function isRateLimitedMemory(key, env, options = {}) {
  const limitEnvVar = options.limitEnvVar || "AI_RATE_LIMIT_PER_MINUTE";
  const defaultLimit = options.defaultLimit || DEFAULT_RATE_LIMIT;
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
    return isRateLimitedKV(key, env, options);
  }
  return isRateLimitedMemory(key, env, options);
}

export default {
  /* Defesa de última camada: qualquer exceção não tratada vira JSON 500
     estruturado, nunca a página HTML de erro do runtime (conectores MCP
     esperam JSON). Log mínimo: método + caminho, sem query nem credencial. */
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

    /* OAuth paths (incl. /mcp/auth-code, /mcp/connect-claude) usam seu
       próprio CORS (OAUTH_CORS = *), inclusive para OPTIONS preflight.
       Precisam ser despachados ANTES do middleware de CORS principal. */
    if (isOAuthPath(url.pathname)) {
      return handleOAuthRequest(request, env, { isRateLimited });
    }

    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      if (!cors) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, cors || {});
    }

    /* Rotas financeiras: dado público, sem autenticação, mas com a mesma
       allowlist de origem do restante e rate limit próprio por IP/origem
       (chave separada da IA: nunca disputa bucket com /ai). */
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

    if (url.pathname === "/quota") {
      if (!cors) return json({ error: "Origem não autorizada.", code: "origin_blocked" }, 403, null);
      if (request.method !== "GET") {
        return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors);
      }

      const appCheck = await requireAppCheck(request, env, cors);
      if (!appCheck.ok) return appCheck.response;

      const quotaAuth = await authenticate(request, env, cors);
      if (quotaAuth instanceof Response) return quotaAuth;

      const quota = await getFreeQuotaKV(env, true);
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

    /* ---------------------------------------------------------------- */
    /* Ponte de IA — POST /mcp (JSON-RPC, somente leitura).              */
    /* Autenticação: token MCP dedicado (Bearer), NÃO o ID token.        */
    /* Sem exigência de Origin: o chamador é um servidor MCP externo.    */
    /* ---------------------------------------------------------------- */
    if (url.pathname === "/mcp") {
      if (request.method !== "POST") {
        return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors || {});
      }

      /* Rate limit ANTES da autenticação, por IP: sem token válido o
         atacante só consume hash + leitura de KV; este bucket corta o
         volume sem depender de token algum. Prefixo separado do bucket
         autenticado (nunca disputam janela). */
      const anonKey = request.headers.get("cf-connecting-ip") || "unknown";
      const anonLimited = await isRateLimited(anonKey, env, {
        limitEnvVar: "MCP_ANON_RATE_LIMIT_PER_MINUTE",
        defaultLimit: DEFAULT_MCP_ANON_RATE_LIMIT,
        prefix: "mcp-anon:"
      });
      if (anonLimited) {
        return json(
          { error: "Muitas consultas MCP agora. Aguarde alguns segundos e tente novamente.", code: "mcp_rate_limited" },
          429,
          cors || {}
        );
      }

      const mcpAuth = await authenticateMcpAny(request, env);
      if (mcpAuth.error) {
        /* 401 carrega WWW-Authenticate apontando o metadata OAuth: é o
           gatilho do "Entrar agora" no claude.ai (RFC 9728 + exigência
           da Anthropic; eles ignoram o header em respostas 200). */
        return json(
          { error: "Token MCP inválido ou ausente.", code: mcpAuth.error },
          mcpAuth.status,
          withHeaders(cors || {}, { "WWW-Authenticate": oauthChallenge(env) })
        );
      }

      const limited = await isRateLimited(mcpAuth.hash, env, {
        limitEnvVar: "MCP_RATE_LIMIT_PER_MINUTE",
        defaultLimit: DEFAULT_MCP_RATE_LIMIT,
        prefix: "mcp:"
      });
      if (limited) {
        return json(
          { error: "Muitas consultas MCP agora. Aguarde alguns segundos e tente novamente.", code: "mcp_rate_limited" },
          429,
          cors || {}
        );
      }

      const body = await readJsonBody(request, { maxBytes: MCP_MAX_BODY_BYTES });
      if (!body.ok) return json(body.body, body.status, cors || {});

      let response;
      try {
        response = await handleMcpMessage(body.payload, env, mcpAuth.uid);
      } catch (mcpError) {
        /* Falha interna (KV/protocolo) vira erro JSON-RPC, nunca 500 cru. */
        response = {
          jsonrpc: "2.0",
          id: body.payload && "id" in body.payload ? body.payload.id : null,
          error: { code: -32603, message: "Erro interno ao processar a requisição." }
        };
      }
      if (response === null) {
        /* Notificação JSON-RPC: aceita sem corpo (Streamable HTTP). */
        return new Response(null, { status: 202, headers: cors || {} });
      }
      return json(response, 200, cors || {});
    }

    /* ---------------------------------------------------------------- */
    /* Ponte de IA — ponte do app autenticado (ID token do Firebase).    */
    /* ---------------------------------------------------------------- */
    if (url.pathname === "/bridge/snapshot" || url.pathname === "/bridge/token") {
      if (!cors) return json({ error: "Origem não autorizada.", code: "origin_blocked" }, 403, null);

      const isSnapshot = url.pathname === "/bridge/snapshot";
      const methodAllowed = isSnapshot
        ? request.method === "POST"
        : request.method === "POST" || request.method === "DELETE";
      if (!methodAllowed) {
        return json({ error: "Método não permitido.", code: "method_not_allowed" }, 405, cors);
      }

      const appCheck = await requireAppCheck(request, env, cors);
      if (!appCheck.ok) return appCheck.response;

      const authResult = await authenticate(request, env, cors);
      if (authResult instanceof Response) return authResult;
      const uid = authResult.claims.sub;

      const limited = await isRateLimited(uid, env, {
        limitEnvVar: "BRIDGE_RATE_LIMIT_PER_MINUTE",
        defaultLimit: DEFAULT_BRIDGE_RATE_LIMIT,
        prefix: "bridge:"
      });
      if (limited) {
        return json(
          { error: "Muitas operações na ponte agora. Aguarde alguns segundos e tente novamente.", code: "bridge_rate_limited" },
          429,
          cors
        );
      }

      if (isSnapshot) {
        const body = await readJsonBody(request, { maxBytes: BRIDGE_SNAPSHOT_MAX_BODY_BYTES });
        if (!body.ok) return json(body.body, body.status, cors);

        /* Validação autoritativa do contrato externo (Fase 1) — o mesmo
           envelope que a ferramenta MCP servirá depois. */
        const validated = validateExternalSnapshotResult(body.payload);
        if (!validated.ok) return json(validated.body, validated.status, cors);

        const stored = await putSnapshot(env, uid, validated.value);
        if (!stored.ok) {
          return json(
            { error: "Armazenamento da ponte indisponível.", code: stored.code },
            503,
            cors
          );
        }
        return json({ ok: true, bytes: stored.bytes, expiresIn: stored.expiresIn }, 200, cors);
      }

      /* /bridge/token — emissão e revogação. Um token ativo por conta:
         gerar novo revoga os anteriores automaticamente. */
      if (request.method === "POST") {
        const issued = await issueMcpToken(env, uid);
        if (!issued.ok) {
          return json({ error: "Armazenamento da ponte indisponível.", code: issued.code }, 503, cors);
        }
        /* O token bruto aparece só nesta resposta; o KV guarda apenas o hash. */
        return json({ token: issued.token, createdAt: issued.createdAt, expiresInSeconds: issued.expiresInSeconds }, 201, cors);
      }

      const body = await readJsonBody(request, { maxBytes: BRIDGE_TOKEN_MAX_BODY_BYTES });
      if (!body.ok) return json(body.body, body.status, cors);
      const token = body.payload && typeof body.payload.token === "string" ? body.payload.token : "";
      if (!token) {
        return json({ error: 'Informe o token a revogar em "token".', code: "missing_token_field" }, 400, cors);
      }
      const revoked = await revokeMcpToken(env, uid, token);
      if (!revoked.ok) {
        if (revoked.code === "store_unavailable") {
          return json({ error: "Armazenamento da ponte indisponível.", code: revoked.code }, 503, cors);
        }
        return json({ error: "Este token pertence a outra conta.", code: revoked.code }, 403, cors);
      }
      return json({ ok: true, revoked: revoked.revoked }, 200, cors);
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

    const appCheck = await requireAppCheck(request, env, cors);
    if (!appCheck.ok) return appCheck.response;

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

    if (await isRateLimited(claims.sub, env)) {
      return json(
        {
          error: "Muitas solicitações de IA agora. Aguarde alguns segundos e tente novamente.",
          code: "rate_limited"
        },
        429,
        cors
      );
    }

    /* Garante o cache de cota antes de decidir sobre o limite diário.
       let: após um burn com sucesso a leitura é refeita para que os headers
       X-AI-Quota-* da MESMA resposta mostrem o valor já decrementado
       (contrato consumido pelo index.html, ver quota.js). */
    let quota = await getFreeQuotaKV(env);
    const quotaHeaders = () => quotaHeaderValues(quota);

    if (quota && quota.remaining <= 0) {
      return json(
        {
          error:
            "A IA atingiu o limite diário de leituras. O limite volta a ser liberado à meia-noite (UTC).",
          code: "daily_limit",
          quota
        },
        429,
        withHeaders(cors, quotaHeaders())
      );
    }

    /* Corpo: limite de tamanho → parse → validação. Nada disso chega ao
       provedor sem passar por aqui.

       Dois caminhos na MESMA rota (sem segunda arquitetura de IA):
       - payload com "message"      → contrato do chat (ai-chat-contract.js);
       - payload com "prompt"       → contrato legado (prompt/imagem) usado
                                      por comprovantes e diagnóstico. */
    const body = await readJsonBody(request);
    if (!body.ok) return json(body.body, body.status, cors);

    /* Um payload é de chat se trouxer QUALQUER campo do contrato de chat.
       Assim, "message" esquecida ainda cai no caminho do chat e retorna
       empty_message em vez de empty_prompt genérico. */
    const payloadKeys = ["message", "conversationContext", "financialSnapshot"];
    const isChatPayload = payloadKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(body.payload, key)
    );

    let messages;
    let maxTokens;
    let providerTimeoutMs;

    if (isChatPayload) {
      const chat = validateChatPayload(body.payload);
      if (!chat.ok) return json(chat.body, chat.status, cors);

      messages = [
        { role: "system", content: buildChatSystemPrompt(chat.value.financialSnapshot) },
        ...chat.value.conversationContext.map((item) => ({ role: item.role, content: item.content })),
        { role: "user", content: chat.value.message }
      ];
      maxTokens = CHAT_LIMITS.MAX_TOKENS;
      providerTimeoutMs = CHAT_LIMITS.PROVIDER_TIMEOUT_MS;
    } else {
      const validation = validateAiPayload(body.payload);
      if (!validation.ok) return json(validation.body, validation.status, cors);

      const { prompt, imageUrl, maxTokens: legacyMaxTokens } = validation.value;

      messages = imageUrl
        ? [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageUrl } }
              ]
            }
          ]
        : [{ role: "user", content: prompt }];
      maxTokens = legacyMaxTokens;
      providerTimeoutMs = undefined;
    }

    const referer = origin || "https://livro-caixa.local";
    const models = modelList(env);
    let lastFailure = null;

    for (const model of models) {
      const result = await callOpenRouter(model, env, messages, maxTokens, referer, {
        timeoutMs: providerTimeoutMs
      });

      /* Conta na cota apenas o que deu certo: tentativas que o OpenRouter
         recusou (402/404 de modelo pago, falha de rede) não gastam o dia. */
      if (result.ok) {
        await burnQuotaKV(env);
        const refreshed = await getFreeQuotaKV(env);
        if (refreshed) quota = refreshed;
      }

      if (!result.ok) {
        const status = result.status || 0;
        lastFailure = failureFromResult(result, model, env);

        /* Log estruturado para monitoramento de falhas de modelo */
        console.log(JSON.stringify({
          event: "model_failed",
          model,
          status,
          code: lastFailure.code,
          timestamp: new Date().toISOString()
        }));

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

      /* Log para resposta vazia */
      console.log(JSON.stringify({
        event: "model_empty_reply",
        model,
        timestamp: new Date().toISOString()
      }));

      lastFailure = emptyReplyFailure(model);
    }

    if (!lastFailure) {
      return json({ error: "IA indisponível no momento.", code: "no_model" }, 502, cors);
    }

    const failureStatus =
      lastFailure.status >= 400 && lastFailure.status <= 599 ? lastFailure.status : 502;

    const exhausted =
      failureStatus === 429 && quota && quota.remaining <= 0;

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
