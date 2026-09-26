/* Helpers HTTP compartilhados por todas as rotas do Worker.
   Sem conhecimento de IA ou de regras de negócio: o roteador e o gateway
   financeiro reutilizam exatamente o mesmo contrato de resposta, de CORS,
   de cache e de leitura de recursos externos. */

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
      "X-AI-Quota-Limit, X-AI-Quota-Remaining, X-AI-Quota-Reset, X-Financial-Cache",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

export function withHeaders(cors, extra) {
  return Object.assign({}, cors || {}, extra || {});
}

/* =====================================================================
   Leitura de recursos externos (usada pelo gateway financeiro).

   Política comum aqui (não em cada provedor):
   - timeout explícito (AbortSignal.timeout) — a falha vira reason "timeout";
   - redirect: "error" — nenhum redirecionamento para destino arbitrário;
   - teto de bytes lidos (maxBytes) — nunca lê o arquivo inteiro;
   - teto de Content-Length (maxContentLength) — recusa resposta gigante
     antes de alocar memória;
   - leitura incremental por linha (onLines) com parada antecipada.

   Host, caminho e parsing continuam sendo responsabilidade do módulo do
   provedor: aqui só entram URL e cabeçalhos já montados por ele.
   ===================================================================== */

function classifyFetchError(error) {
  const name = String(error?.name || "");
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  const message = String(error?.message || "");
  if (/redirect/i.test(message)) return "redirect_blocked";
  return "network";
}

export async function fetchText(url, options = {}) {
  const headers = options.headers || {};
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 15000;
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 8 * 1024 * 1024;
  const maxContentLength = Number.isFinite(options.maxContentLength)
    ? options.maxContentLength
    : maxBytes;
  const onLines = typeof options.onLines === "function" ? options.onLines : null;

  let response;
  try {
    response = await fetch(url, {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (fetchError) {
    return { ok: false, reason: classifyFetchError(fetchError) };
  }

  const contentType = String(response.headers?.get?.("content-type") || "");
  const contentLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxContentLength) {
    /* Recusa ANTES de ler: resposta grande demais para o Worker. */
    return { ok: false, reason: "content_length_exceeded", status: response.status, contentType };
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (text.length > maxBytes) {
      return { ok: false, reason: "read_limit_exceeded", status: response.status, contentType };
    }
    return onLines
      ? emitLines(text.split("\n"), onLines, { status: response.status, contentType })
      : { ok: true, status: response.status, contentType, bytesRead: text.length, text };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  const chunks = [];
  let tail = "";

  const stop = async () => {
    try {
      await reader.cancel();
    } catch (cancelError) {
      /* cancelamento é opcional */
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await stop();
        return { ok: false, reason: "read_limit_exceeded", status: response.status, contentType };
      }

      const piece = decoder.decode(value, { stream: true });

      if (!onLines) {
        chunks.push(piece);
        continue;
      }

      const data = tail + piece;
      const lines = data.split("\n");
      tail = lines.pop();
      if (lines.length && onLines(lines) === true) {
        await stop();
        return {
          ok: true,
          status: response.status,
          contentType,
          bytesRead,
          stopped: true,
          trailing: tail
        };
      }
    }
    tail += decoder.decode();
    /* Última linha sem "\n" final: entregue ao consumidor — senão um CSV
       terminado sem quebra de linha perderia registros em silêncio. */
    if (onLines && tail !== "") {
      const lastLine = tail;
      tail = "";
      if (onLines([lastLine]) === true) {
        await stop();
        return { ok: true, status: response.status, contentType, bytesRead, stopped: true, trailing: "" };
      }
    }
  } catch (readError) {
    await stop();
    return { ok: false, reason: classifyFetchError(readError), status: response.status, contentType };
  }

  if (onLines) {
    return {
      ok: true,
      status: response.status,
      contentType,
      bytesRead,
      stopped: false,
      trailing: tail
    };
  }

  chunks.push(tail);
  const text = chunks.join("");
  if (text.length > maxBytes) {
    return { ok: false, reason: "read_limit_exceeded", status: response.status, contentType };
  }
  return { ok: true, status: response.status, contentType, bytesRead, text };
}

function emitLines(lines, onLines, meta) {
  const complete = lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
  const stopped = complete.length > 0 ? onLines(complete) === true : false;
  return {
    ok: true,
    status: meta.status,
    contentType: meta.contentType,
    bytesRead: 0,
    stopped,
    trailing: ""
  };
}

/* =====================================================================
   Cache de curta duração (Cache API do Worker).

   Papel: OTIMIZAÇÃO apenas. Nunca é fonte de verdade: leitura ou gravação
   que falhe simplesmente não usa cache; a resposta fresca é sempre montada
   de novo (headers de CORS inclusos). Sem KV, sem Durable Objects.

   Chave: URL absoluta sintética e determinística construída pelo provedor
   (série + intervalo, ou data). Nunca contém dados pessoais, IP ou UID —
   portanto não há mistura entre usuários: todos leem a mesma referência.

   TTL explícito em dois níveis: max-age no Cache-Control (evicção do
   Cloudflare) e checagem de storedAt aqui (comportamento determinístico e
   testável mesmo fora do runtime do Cloudflare).
   ===================================================================== */

const STORED_AT_HEADER = "x-livro-caixa-stored-at";
const STATUS_HEADER = "x-livro-caixa-status";

export async function cacheGet(key, ttlSeconds) {
  try {
    const hit = await caches.default.match(key);
    if (!hit) return null;
    const storedAt = Number(hit.headers.get(STORED_AT_HEADER));
    if (!Number.isFinite(storedAt)) return null;
    if (Date.now() - storedAt > ttlSeconds * 1000) return null;
    const body = await hit.text();
    const status = Number(hit.headers.get(STATUS_HEADER)) || 200;
    return { body, status, storedAt };
  } catch (cacheError) {
    return null;
  }
}

export async function cachePut(key, body, status, ttlSeconds) {
  try {
    await caches.default.put(
      key,
      new Response(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${Math.max(60, ttlSeconds)}`,
          [STORED_AT_HEADER]: String(Date.now()),
          [STATUS_HEADER]: String(status)
        }
      })
    );
  } catch (cacheError) {
    /* cache é otimização: falha não afeta a resposta */
  }
}
