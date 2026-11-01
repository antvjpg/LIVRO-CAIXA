/* LIVRO-CAIXA · Cliente Google Gemini.
   Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
   Autenticação: Bearer {GOOGLE_API_KEY} */

import { providerFailure } from "./provider.js";

export const GOOGLE_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_MODELS = [
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash-exp"
];

export const RETRYABLE_STATUS = new Set([0, 408, 429, 500, 502, 503, 504]);

export function modelList(env) {
  const raw = env.GOOGLE_MODELS || DEFAULT_MODELS.join(",");
  const list = String(raw)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_MODELS;
}

function sanitizeDetail(detail, env) {
  let text = String(detail || "");
  const key = env && env.GOOGLE_API_KEY;
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

export async function callGoogle(model, env, messages, maxTokens, referer, options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
    ? options.timeoutMs
    : 45000;

  /* Monta contents no formato Gemini: [{role, parts:[{text}]}] */
  const systemText = [];
  const userMessages = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemText.push(m.content);
    } else {
      userMessages.push({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      });
    }
  }

  const systemInstruction = systemText.length > 0
    ? { parts: [{ text: systemText.join("\n\n") }] }
    : undefined;

  const body = {
    contents: userMessages,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens
    }
  };

  let response;
  try {
    response = await fetch(`${GOOGLE_ENDPOINT_BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GOOGLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
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
    provider: "google",
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
    provider: "google",
    status: 502,
    model,
    code: "empty_reply",
    message: "A IA não retornou uma resposta utilizável."
  });
}
