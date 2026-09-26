/* Gateway financeiro — única porta de entrada de /financial.

   Papel (nada além disto):
   - traduz o caminho /financial/{provider}/... no handler do provedor;
   - aplica a política comum (timeout, teto de bytes, TTL de cache);
   - padroniza falha inesperada sem vazar detalhe interno;
   - mantém index.js alheio a host, contrato e parsing de cada API externa.

   Regras dos handlers (bcb.js / tesouro.js):
   - recebem { url, env, policy } e devolvem { status, body, headers? };
   - corpo de erro SEMPRE no formato { error, code, provider } — mesma
     forma do envelope interno { code, message, provider, status } usado
     em ai/openrouter.js, aqui já serializada para o cliente;
   - nunca constroem URL a partir de input do cliente (anti-SSRF);
   - nunca devolvem corpo bruto do provedor.

   Falha de provedor (mensagens controladas, sem host, stack ou payload):
     financial_provider_timeout            504
     financial_provider_error              502  (HTTP 4xx/5xx do provedor)
     financial_provider_invalid_response   502  (JSON/CSV fora do esperado)
     financial_provider_response_too_large 502  (Content-Length acima do teto)
     financial_internal_error              500  (imprevisto, sem detalhe)
   Validação de requisição: 400 com código específico (ver bcb/tesouro).
   ===================================================================== */

import { json, withHeaders } from "../shared/http.js";
import { handleBcb } from "./bcb.js";
import { handleTesouro } from "./tesouro.js";

/* Política comum por provedor.
   timeoutMs        — AbortSignal.timeout em toda chamada externa;
   maxBytes         — teto de BYTES LIDOS (nunca baixa o arquivo inteiro);
   maxContentLength — teto de Content-Length aceito (recusa prévia);
   cacheTtlSeconds  — TTL do cache de otimização (não é fonte de verdade). */
export const FINANCIAL_POLICY = {
  bcb: {
    timeoutMs: 12000,
    maxBytes: 4 * 1024 * 1024,
    maxContentLength: 8 * 1024 * 1024,
    cacheTtlSeconds: 600
  },
  tesouro: {
    timeoutMs: 25000,
    maxBytes: 2 * 1024 * 1024,
    maxContentLength: 64 * 1024 * 1024,
    cacheTtlSeconds: 3600
  }
};

const HANDLERS = {
  bcb: handleBcb,
  tesouro: handleTesouro
};

export async function handleFinancial(request, env, cors) {
  try {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean); // ["financial", provider, ...]
    const provider = segments[1] || "";

    const handler = HANDLERS[provider];
    if (!handler) {
      /* Provedor desconhecido não é ecoado: caminho vindo do cliente. */
      return json({ error: "Provedor financeiro não suportado.", code: "unknown_provider" }, 404, cors);
    }

    const result = await handler({ url, env, policy: FINANCIAL_POLICY[provider] });
    return json(result.body, result.status, withHeaders(cors, result.headers || {}));
  } catch (gatewayError) {
    /* Último reduto: log mínimo (sem payload, URL, header ou stack) e
       resposta genérica — nenhum detalhe interno chega ao cliente. */
    console.warn("financial_internal_error", String(gatewayError?.name || "Error"));
    return json(
      { error: "Falha ao consultar a base financeira.", code: "financial_internal_error" },
      500,
      cors
    );
  }
}
