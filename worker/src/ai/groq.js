/* LIVRO-CAIXA · Cliente Groq (compatível OpenAI).
   Endpoint: https://api.groq.com/openai/v1/chat/completions
   Autenticação: Bearer {GROQ_API_KEY} */

import { providerFailure, emptyReplyFailure } from "./provider.js";

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const DEFAULT_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma2-9b-it"
];

export const RETRYABLE_STATUS = new Set([0, 408, 429, 500, 502, 503, 504]);

export function modelList(env) {
  const raw = env.GROQ_MODELS || DEFAULT_MODELS.join(",");
  const list = String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

function sanitizeDetail(detail, env) {
  let text = String(detail || "");
  const key = env && env.GROQ_API_KEY;
  if (key) text = text.split(key).join("[chave removida]");
  return text
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function upstreamMessage(status, raw, parsed, env) {
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
    return "O modelo não foi encontrado. Tente outro modelo.";
  }
  return `A IA respondeu com erro ${status}${detail ? ": " + detail : "."}`;
}

export async function callGroq(model, env, messages, maxTokens, referer, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : 45000;

  let response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens
      }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (networkError) {
    return { ok: false, status: 0, raw: "", parsed: null };
  }

  let raw = "";
  try {
    raw = await response.text();
  } catch (readError) {
    return { ok: false, status: 0, raw: "", parsed: null };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (parseError) {
    parsed = null;
  }

  return { ok: response.ok, status: response.status, raw, parsed };
}

export function failureFromResult(result, model, env) {
  const status = result.status || 0;
  return providerFailure({
    provider: "groq",
    status,
    model,
    code: status === 0 ? "network" : `upstream_${status}`,
    message:
      status === 0
        ? "Falha de rede ao consultar a IA. Verifique a conexão."
        : upstreamMessage(status, result.raw, result.parsed, env)
  });
}
