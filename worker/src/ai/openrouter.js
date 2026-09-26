/* Cliente do provedor de IA (OpenRouter).
   Único lugar que conhece endpoint, modelos, cabeçalhos e timeout do
   provedor. Não conhece autenticação nem cota: o roteador (index.js)
   resolve isso antes de chamar. */

export const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/* Ordem de tentativa. Em 429/5xx o Worker passa para o próximo modelo free.
   404 (modelo removido do OpenRouter / sem endpoint) também pula: um modelo
   morto na lista não pode derrubar toda a cadeia. */
const DEFAULT_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "qwen/qwen3.8-27b:free",
  "google/gemma-4-31b-it:free"
];

export const RETRYABLE_STATUS = new Set([402, 404, 408, 429, 500, 502, 503, 504]);
const UPSTREAM_TIMEOUT_MS = 45000;

export function modelList(env) {
  const raw = env.OPENROUTER_MODELS || DEFAULT_MODELS.join(",");
  const list = String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

/* Remove segredo (chave da API), caracteres de controle e espaço extra
   do detalhe vindo do provedor, e corta em 200 chars: este texto é
   exibido ao usuário final na mensagem de erro. */
function sanitizeDetail(detail, env) {
  let text = String(detail || "");
  const key = env && env.OPENROUTER_API_KEY;
  if (key) text = text.split(key).join("[chave removida]");
  return text
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export function upstreamMessage(status, raw, parsed, env) {
  const detail = sanitizeDetail(
    (parsed && (parsed.error?.message || parsed.message)) || String(raw || "").slice(0, 200),
    env
  );
  if (status === 429) {
    return "A IA atingiu o limite de uso temporariamente. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 402) {
    return "A IA está indisponível no momento. Tente novamente mais tarde.";
  }
  if (status === 404) {
    return "A IA está indisponível no momento. Tente novamente mais tarde.";
  }
  return `A IA respondeu com erro ${status}${detail ? `: ${detail}` : "."}`;
}

/* Convenção interna de falha de provedor: {code, message, provider, status}.
   Campo "provider" é interno (ainda não publicado no corpo de /ai); o
   envelope que chega ao cliente é montado pelo roteador. */
export function providerFailure({ code, message, status = 0, model = null, provider = "openrouter" }) {
  return { provider, code, message, status, model };
}

export async function callOpenRouter(model, env, content, maxTokens, referer) {
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

/* Resultado não-2xx do provedor → falha interna padronizada. */
export function failureFromResult(result, model, env) {
  const status = result.status || 0;
  return providerFailure({
    provider: "openrouter",
    status,
    model,
    code: status === 0 ? "network" : `upstream_${status}`,
    message:
      status === 0
        ? "Falha de rede ao consultar a IA. Verifique a conexão."
        : upstreamMessage(status, result.raw, result.parsed, env)
  });
}

export function emptyReplyFailure(model) {
  return providerFailure({
    provider: "openrouter",
    status: 502,
    model,
    code: "empty_reply",
    message: "A IA não retornou uma resposta utilizável."
  });
}
