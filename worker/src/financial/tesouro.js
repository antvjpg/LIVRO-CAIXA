/* Tesouro Nacional — Tesouro Transparente (CSV estruturado).

   Fonte oficial (recurso de dados, não scraping de página HTML):
     GET https://www.tesourotransparente.gov.br/ckan/dataset/
         df56aa42-484a-4a59-8184-7676580c81e3/resource/
         796d2059-14e9-44e3-80c9-2d9e30b405c1/download/
         precotaxatesourodireto.csv

   Host e caminho são CONSTANTES (montados na origem, nunca a partir de
   input do cliente) e a leitura usa redirect: "manual" com recusa de 3xx —
   não há URL a
   manipular, portanto não há SSRF.

   Estrutura verificada na fonte (inspeção desta auditoria):
   - separador ";", decimal ",", UTF-8 sem BOM, ~14,5 MB;
   - cabeçalho exato de 8 campos: Tipo Titulo;Data Vencimento;Data Base;
     Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;
     PU Base Manha;
   - datas dd/MM/yyyy; linhas ordenadas por "Data Base" DESCENDENTE (o
     dia mais recente vem primeiro); 21 a 61 títulos por dia.

   Leitura incremental: só o início do arquivo (teto de bytes), parando
   quando o bloco do dia pedido termina — o arquivo nunca é baixado por
   inteiro. Cada linha a mais é valida…da: nome, datas e números
   obrigatórios; linha malformada = resposta inválida (502), nunca
   registro parcial descartado em silêncio.
   ===================================================================== */

import { fetchText, cacheGet, cachePut } from "../shared/http.js";
import { isISODateFormat, isValidISODate, brDateToIso } from "../shared/validation.js";

const CSV_URL =
  "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3" +
  "/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";

const CACHE_PREFIX = "https://financial-cache.internal/tesouro/daily";

/* Cabeçalho esperado — mudança de schema do CSV é detectada aqui. */
const EXPECTED_HEADER = [
  "Tipo Titulo",
  "Data Vencimento",
  "Data Base",
  "Taxa Compra Manha",
  "Taxa Venda Manha",
  "PU Compra Manha",
  "PU Venda Manha",
  "PU Base Manha"
];

/* Piso de sanidade para títulos de um mesmo dia: o arquivo tem de 21 a
   61 linhas/dia; acima disso é schema anômalo (ex.: separador trocado),
   e não é tratado como dado válido. */
export const MAX_TITLES_PER_DATE = 500;

const DECIMAL_PATTERN = /^-?\d+(,\d+)?$/;
const BOM = "\uFEFF";
const REPLACEMENT_CHAR = "\uFFFD";

function fail(status, code, message, extra) {
  /* extra entra no BODY (nível do contrato), nunca como campo do
     resultado interno — o gateway serializa apenas result.body. */
  return { status, body: Object.assign({ error: message, code, provider: "tesouro" }, extra || {}) };
}

/* "12,34" → 12.34. Separador de milhar não é aceito: o arquivo atual
   não usa; se passar a usar, vira 502 (mudança de schema detectada) e
   não um número reinterpretado. */
function parseDecimalPt(value) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if (!DECIMAL_PATTERN.test(text)) return null;
  const parsed = Number(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/* Linha de título → contrato. Qualquer campo inválido devolve null
   (a chamada marca a resposta como inválida e interrompe a leitura). */
function parseTitle(fields, date) {
  const [type, maturity, baseDate, purchaseRate, saleRate, purchasePrice, salePrice, basePrice] = fields;
  const maturityDate = brDateToIso(maturity);
  if (!maturityDate) return null;
  if (brDateToIso(baseDate) !== date) return null;
  const name = type.trim();
  if (!name) return null;

  const numbers = [purchaseRate, saleRate, purchasePrice, salePrice, basePrice].map(parseDecimalPt);
  if (numbers.some((value) => value === null)) return null;

  return {
    name,
    maturity: maturityDate,
    purchaseRate: numbers[0],
    saleRate: numbers[1],
    purchasePrice: numbers[2],
    salePrice: numbers[3],
    basePrice: numbers[4]
  };
}

export async function handleTesouro({ url, policy }) {
  const segments = url.pathname.split("/").filter(Boolean); // ["financial","tesouro","daily"]
  if (segments[2] !== "daily" || segments.length !== 3) {
    return fail(404, "unknown_route", "Rota do Tesouro não encontrada.");
  }

  const rawDate = url.searchParams.get("date");
  let target = null;
  if (rawDate !== null) {
    if (!isISODateFormat(rawDate)) {
      return fail(400, "invalid_date_format", "Data inválida: use o formato AAAA-MM-DD.");
    }
    if (!isValidISODate(rawDate)) {
      return fail(400, "invalid_date", "Data inválida: não existe no calendário.");
    }
    target = rawDate;
  }

  const cacheKey = `${CACHE_PREFIX}/${target || "latest"}`;
  const cached = await cacheGet(cacheKey, policy.cacheTtlSeconds);
  if (cached) {
    try {
      const body = JSON.parse(cached.body);
      return { status: cached.status, body, headers: { "x-financial-cache": "hit" } };
    } catch (cacheParseError) {
      /* cache corrompido é ignorado (não é fonte de verdade) */
    }
  }

  const state = {
    headerChecked: false,
    headerInvalid: false,
    rowInvalid: false,
    tooManyTitles: false,
    target,
    targetFound: false,
    blockComplete: false,
    rows: [],
    newestDate: null,
    oldestDate: null
  };

  const read = await fetchText(CSV_URL, {
    timeoutMs: policy.timeoutMs,
    maxBytes: policy.maxBytes,
    maxContentLength: policy.maxContentLength,
    onLines: (lines) => consumeLines(lines, state)
  });

  return classify(state, read, cacheKey, policy);
}

function consumeLines(lines, state) {
  for (const rawLine of lines) {
    let line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!state.headerChecked && line.startsWith(BOM)) {
      line = line.slice(1); // BOM eventual não faz parte do cabeçalho
    }
    if (line === "") continue;

    const fields = line.split(";");

    if (!state.headerChecked) {
      state.headerChecked = true;
      if (fields.length !== EXPECTED_HEADER.length || EXPECTED_HEADER.some((h, i) => fields[i] !== h)) {
        state.headerInvalid = true;
        return true;
      }
      continue;
    }

    if (fields.length !== EXPECTED_HEADER.length) {
      state.rowInvalid = true;
      return true;
    }
    /* Bytes em codificação diferente de UTF-8 viram U+FFFD no decoder:
       é tratado como resposta inválida, não como texto aceito. */
    if (fields.some((field) => field.includes(REPLACEMENT_CHAR))) {
      state.rowInvalid = true;
      return true;
    }

    const date = brDateToIso(fields[2]);
    if (!date) {
      state.rowInvalid = true;
      return true;
    }

    const isFirstRow = state.newestDate === null;
    if (isFirstRow) state.newestDate = date;
    state.oldestDate = date;

    /* Sem ?date: o primeiro bloco do arquivo é o dia mais recente. */
    if (state.target === null) state.target = date;

    if (date === state.target) {
      if (state.rows.length >= MAX_TITLES_PER_DATE) {
        state.tooManyTitles = true;
        return true;
      }
      const title = parseTitle(fields, date);
      if (!title) {
        state.rowInvalid = true;
        return true;
      }
      state.rows.push(title);
      state.targetFound = true;
      continue;
    }

    if (state.targetFound) {
      /* Mudou de dia com o bloco já coletado: o bloco terminou. */
      state.blockComplete = true;
      return true;
    }
  }
  return false;
}

function classify(state, read, cacheKey, policy) {
  const invalidFormat = () =>
    fail(502, "financial_provider_invalid_response", "A base de dados oficial retornou um formato inesperado.");

  if (state.headerInvalid || state.rowInvalid) return invalidFormat();
  if (state.tooManyTitles) {
    return fail(
      502,
      "financial_provider_invalid_response",
      "A base de dados oficial retornou uma quantidade inesperada de títulos."
    );
  }

  if (!read.ok) {
    if (read.reason === "timeout") {
      return fail(504, "financial_provider_timeout", "A base de dados oficial não respondeu a tempo.");
    }
    if (read.reason === "content_length_exceeded") {
      return fail(
        502,
        "financial_provider_response_too_large",
        "A resposta da base de dados oficial excede o limite permitido."
      );
    }
    if (read.reason === "read_limit_exceeded") {
      if (state.targetFound) {
        /* O próprio bloco do dia excedeu o teto de leitura: anômalo. */
        return fail(
          502,
          "financial_provider_response_too_large",
          "A resposta da base de dados oficial excede o limite permitido."
        );
      }
      const available =
        state.newestDate && state.oldestDate ? { from: state.oldestDate, to: state.newestDate } : null;
      if (state.target && state.oldestDate && state.target < state.oldestDate) {
        /* Data mais antiga que o trecho lido: fora da janela disponível. */
        return fail(
          400,
          "date_outside_read_window",
          "Data fora da janela de leitura disponível.",
          available ? { available } : undefined
        );
      }
      return fail(404, "date_not_found", "Nenhum dado disponível para a data informada.");
    }
    return fail(502, "financial_provider_error", "Não foi possível consultar a base de dados oficial agora.");
  }

  const eof = read.stopped !== true;
  if (state.blockComplete || (state.targetFound && eof)) {
    return finalize(cacheKey, policy, {
      provider: "tesouro",
      source: "tesouro_transparente",
      date: state.target,
      titles: state.rows
    });
  }

  return fail(404, "date_not_found", "Nenhum dado disponível para a data informada.");
}

async function finalize(cacheKey, policy, body) {
  await cachePut(cacheKey, JSON.stringify(body), 200, policy.cacheTtlSeconds);
  return { status: 200, body, headers: { "x-financial-cache": "miss" } };
}
