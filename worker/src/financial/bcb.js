/* Banco Central do Brasil — SGS (Série Gerencial de Séries Temporais).

   Fonte oficial (inspecionada nesta auditoria):
     GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados
         ?formato=json&dataInicial=dd/mm/aaaa&dataFinal=dd/mm/aaaa

   Comportamentos do SGS verificados ao vivo:
   - janela de no máximo 10 anos para séries diárias (406 fora disso);
   - data impossível → 400 com corpo {"erro":...};
   - intervalo sem valores → 404 com corpo {"erro":...};
   - código numérico inexistente → 200 com corpo HTML (não-JSON);
   - código não numérico → 404 em texto puro.

   Host e caminho são CONSTANTES: o cliente só informa código de série e
   datas (nunca URL) — não há espaço para SSRF, host arbitrário ou
   redirecionamento (redirect: "error" na leitura).

   Transformações explícitas (nenhuma silenciosa):
   - YYYY-MM-DD → dd/MM/yyyy na requisição (formato do SGS);
   - dd/MM/yyyy → YYYY-MM-DD na resposta;
   - valor é string com ponto decimal → Number, sem conversão de unidade.
   ===================================================================== */

import { fetchText, cacheGet, cachePut } from "../shared/http.js";
import {
  isISODateFormat,
  isValidISODate,
  todayUTC,
  addDaysISO,
  diffDaysISO,
  isoToBrDate,
  brDateToIso
} from "../shared/validation.js";

const BCB_HOST = "https://api.bcb.gov.br";
const CACHE_PREFIX = "https://financial-cache.internal/bcb/series";

/* Limites do Worker (documentados no contrato). */
export const MIN_SERIES_CODE = 1;
export const MAX_SERIES_CODE = 999999;
export const MAX_WINDOW_DAYS = 3660; // 10 anos — mesmo teto do SGS para séries diárias
export const MAX_RECORDS = 5000;
export const DEFAULT_WINDOW_DAYS = 30;

/* Catálogo mínimo: nome e unidade só para série verificada na fonte.
   Séries fora do catálogo NÃO ganham unidade inventada ("unspecified")
   e nenhuma conversão de unidade é aplicada em nenhum caso. */
const SERIES_CATALOG = {
  11: { name: "Selic", unit: "percent_per_day" }
};

const NUMBER_PATTERN = /^-?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

function fail(status, code, message, extra) {
  /* extra entra no BODY (nível do contrato), nunca como campo do
     resultado interno — o gateway serializa apenas result.body. */
  return { status, body: Object.assign({ error: message, code, provider: "bcb" }, extra || {}) };
}

function providerReadFailure(read) {
  if (read.reason === "timeout") {
    return fail(504, "financial_provider_timeout", "A base de dados oficial não respondeu a tempo.");
  }
  if (read.reason === "content_length_exceeded" || read.reason === "read_limit_exceeded") {
    return fail(
      502,
      "financial_provider_response_too_large",
      "A resposta da base de dados oficial excede o limite permitido."
    );
  }
  return fail(502, "financial_provider_error", "Não foi possível consultar a base de dados oficial agora.");
}

/* Converte o payload do SGS no contrato interno.
   Qualquer item malformado invalida a resposta inteira (502): dado
   parcialmente corrompido não é descartado em silêncio. */
function normalizeSgs(payload) {
  if (!Array.isArray(payload)) return null;
  const data = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") return null;
    const date = brDateToIso(item.data);
    if (!date) return null;
    const raw = typeof item.valor === "number" ? String(item.valor) : item.valor;
    if (typeof raw !== "string" || !NUMBER_PATTERN.test(raw.trim())) return null;
    const value = Number(raw.trim());
    if (!Number.isFinite(value)) return null;
    data.push({ date, value });
  }
  return data;
}

function buildBody({ code, start, end, data }) {
  const catalog = SERIES_CATALOG[code] || null;
  return {
    provider: "bcb",
    source: "SGS",
    series: { code, name: catalog ? catalog.name : `Série ${code}` },
    unit: catalog ? catalog.unit : "unspecified",
    from: start,
    to: end,
    data
  };
}

export async function handleBcb({ url, policy }) {
  const segments = url.pathname.split("/").filter(Boolean); // ["financial","bcb","series","11"]
  if (segments[2] !== "series" || segments.length !== 4) {
    return fail(404, "unknown_route", "Rota do BCB não encontrada.");
  }

  const rawCode = segments[3];
  if (!/^\d{1,6}$/.test(rawCode)) {
    return fail(
      400,
      "invalid_series_code",
      `Código de série inválido: use um número inteiro entre ${MIN_SERIES_CODE} e ${MAX_SERIES_CODE}.`
    );
  }
  const code = Number(rawCode);
  if (code < MIN_SERIES_CODE || code > MAX_SERIES_CODE) {
    return fail(
      400,
      "invalid_series_code",
      `Código de série inválido: use um número inteiro entre ${MIN_SERIES_CODE} e ${MAX_SERIES_CODE}.`
    );
  }

  const rawStart = url.searchParams.get("startDate");
  const rawEnd = url.searchParams.get("endDate");

  for (const [param, raw] of [
    ["startDate", rawStart],
    ["endDate", rawEnd]
  ]) {
    if (raw === null) continue;
    if (!isISODateFormat(raw)) {
      return fail(400, "invalid_date_format", `Data inválida em ${param}: use o formato AAAA-MM-DD.`);
    }
    if (!isValidISODate(raw)) {
      return fail(400, "invalid_date", `Data inválida em ${param}: não existe no calendário.`);
    }
  }

  const end = rawEnd === null ? todayUTC() : rawEnd;
  const start = rawStart === null ? addDaysISO(end, -(DEFAULT_WINDOW_DAYS - 1)) : rawStart;

  if (diffDaysISO(start, end) < 0) {
    return fail(400, "invalid_date_range", "A data inicial deve ser anterior ou igual à data final.");
  }
  if (diffDaysISO(start, end) > MAX_WINDOW_DAYS) {
    return fail(
      400,
      "date_range_too_large",
      `Período solicitado acima do limite de ${Math.floor(MAX_WINDOW_DAYS / 365)} anos.`
    );
  }

  const cacheKey = `${CACHE_PREFIX}/${code}/${start}/${end}`;
  const cached = await cacheGet(cacheKey, policy.cacheTtlSeconds);
  if (cached) {
    try {
      const body = JSON.parse(cached.body);
      return { status: cached.status, body, headers: { "x-financial-cache": "hit" } };
    } catch (cacheParseError) {
      /* cache corrompido é ignorado (não é fonte de verdade) */
    }
  }

  const endpoint =
    `${BCB_HOST}/dados/serie/bcdata.sgs.${code}/dados` +
    `?formato=json&dataInicial=${isoToBrDate(start)}&dataFinal=${isoToBrDate(end)}`;

  const read = await fetchText(endpoint, {
    headers: { accept: "application/json" },
    timeoutMs: policy.timeoutMs,
    maxBytes: policy.maxBytes,
    maxContentLength: policy.maxContentLength
  });

  if (!read.ok) return providerReadFailure(read);

  /* 404 do SGS = janela sem valores (série existe, período sem dado):
     resposta vazia determinística, e não erro. */
  if (read.status === 404) {
    let empty = false;
    try {
      const parsed = JSON.parse(read.text);
      empty = Boolean(parsed && typeof parsed === "object" && parsed.erro);
    } catch (notJson) {
      empty = false;
    }
    if (empty) return finalize(cacheKey, policy, buildBody({ code, start, end, data: [] }));
    return fail(502, "financial_provider_invalid_response", "A base de dados oficial retornou um formato inesperado.");
  }

  if (read.status !== 200) {
    return fail(502, "financial_provider_error", "Não foi possível consultar a base de dados oficial agora.");
  }

  let payload;
  try {
    payload = JSON.parse(read.text);
  } catch (notJson) {
    /* Caso real do SGS: 200 com HTML quando a série numérica não existe. */
    return fail(502, "financial_provider_invalid_response", "A base de dados oficial retornou um formato inesperado.");
  }

  const data = normalizeSgs(payload);
  if (data === null) {
    return fail(502, "financial_provider_invalid_response", "A base de dados oficial retornou um formato inesperado.");
  }
  if (data.length > MAX_RECORDS) {
    return fail(
      400,
      "records_limit_exceeded",
      `Quantidade de registros acima do limite de ${MAX_RECORDS}.`
    );
  }

  return finalize(cacheKey, policy, buildBody({ code, start, end, data }));
}

async function finalize(cacheKey, policy, body) {
  const serialized = JSON.stringify(body);
  await cachePut(cacheKey, serialized, 200, policy.cacheTtlSeconds);
  return { status: 200, body, headers: { "x-financial-cache": "miss" } };
}
