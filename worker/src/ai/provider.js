/* LIVRO-CAIXA · Interface base para provedores de IA.
   Qualquer provedor implementa: modelList(env), callModel(model, env, messages, maxTokens, referer, options)
   e opcionalmente quota(env) para cota diária. O roteador (index.js) decide qual provedor usar
   pela variável AI_PROVIDER (openrouter | google | groq). */

export const PROVIDER_NAMES = ["openrouter", "google", "groq"];

export function resolveProvider(env) {
  const name = String(env.AI_PROVIDER || "openrouter").toLowerCase();
  if (!PROVIDER_NAMES.includes(name)) {
    return null;
  }
  return name;
}

export function providerMissingKey(name, env) {
  const keyMap = {
    openrouter: "OPENROUTER_API_KEY",
    google: "GOOGLE_API_KEY",
    groq: "GROQ_API_KEY"
  };
  return !env[keyMap[name]];
}

export class ProviderError extends Error {
  constructor({ code, message, status = 0, model = null, provider = "unknown" }) {
    super(message);
    this.code = code;
    this.status = status;
    this.model = model;
    this.provider = provider;
    this.name = "ProviderError";
  }
}

export function providerFailure({ code, message, status = 0, model = null, provider = "unknown" }) {
  return new ProviderError({ code, message, status, model, provider });
}

export function emptyReplyFailure(model, provider = "unknown") {
  return providerFailure({
    provider,
    status: 502,
    model,
    code: "empty_reply",
    message: "A IA não retornou uma resposta utilizável."
  });
}
