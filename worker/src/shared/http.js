/* Helpers HTTP compartilhados por todas as rotas do Worker.
   Sem conhecimento de IA, OpenRouter ou provedores financeiros: o roteador
   e a camada de gateway futura reutilizam exatamente o mesmo contrato de
   resposta, de CORS e de headers. */

export function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      cors || {}
    )
  });
}

/* Allowlist explícita de origens (wrangler.toml → ALLOW_ORIGINS).
   Nunca usar "*" nem refletir origem arbitrária: origem fora da lista
   não recebe headers de CORS e as rotas protegidas respondem 403. */
export function corsHeaders(origin, env) {
  if (!origin) return null;
  const allowed = String(env.ALLOW_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowed.includes(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-expose-headers":
      "X-AI-Quota-Limit, X-AI-Quota-Remaining, X-AI-Quota-Reset",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

export function withHeaders(cors, extra) {
  return Object.assign({}, cors || {}, extra || {});
}
