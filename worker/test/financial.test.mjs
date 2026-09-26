/* Testes de regressão das rotas /financial (BCB SGS e Tesouro Nacional)
   mais o gateway, CORS, rate limit e cache. Execução: node --test worker/test/

   Rede: nenhuma chamada real — fetch é substituído por um handler por
   teste. Cache: Cache API simulada (não existe no Node).
   Os arquivos de teste rodam em processo próprio; o rate limit em memória
   do Worker é compartilhado dentro deste arquivo, por isso cada teste usa
   um IP (cf-connecting-ip) próprio. */

import test from "node:test";
import assert from "node:assert/strict";

const ORIGIN = "https://antvjpg.github.io";
const BASE = "https://livro-caixa-ai.workers.dev";

const env = {
  ALLOW_ORIGINS: `http://127.0.0.1:8000,http://localhost:8000,${ORIGIN}`,
  AI_RATE_LIMIT_PER_MINUTE: "30",
  FINANCIAL_RATE_LIMIT_PER_MINUTE: "50"
};

/* ---------- fakes de ambiente ---------- */

const cacheStore = new Map();
globalThis.caches = {
  default: {
    async match(key) {
      const entry = cacheStore.get(String(key));
      return entry ? entry.clone() : undefined;
    },
    async put(key, response) {
      cacheStore.set(String(key), response);
    }
  }
};

const net = { handler: null, calls: [] };
globalThis.fetch = async (url, init) => {
  net.calls.push({ url: String(url), init });
  if (!net.handler) throw new Error(`fetch inesperado: ${url}`);
  return net.handler(String(url), init);
};

const workerModule = await import(new URL("../src/index.js", import.meta.url));
const workerFetch = workerModule.default.fetch;
const gatewayModule = await import(new URL("../src/financial/gateway.js", import.meta.url));
const handleFinancial = gatewayModule.handleFinancial;
const FINANCIAL_POLICY = gatewayModule.FINANCIAL_POLICY;
const bcbModule = await import(new URL("../src/financial/bcb.js", import.meta.url));
const handleBcb = bcbModule.handleBcb;
const tesouroModule = await import(new URL("../src/financial/tesouro.js", import.meta.url));
const handleTesouro = tesouroModule.handleTesouro;

/* ---------- helpers ---------- */

function get(path, { origin = ORIGIN, ip = "203.0.113.10", method = "GET", headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (origin) finalHeaders.Origin = origin;
  if (ip) finalHeaders["cf-connecting-ip"] = ip;
  return workerFetch(new Request(`${BASE}${path}`, { method, headers: finalHeaders }), env);
}

function jsonRes(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

function csvRes(text, status = 200, headers = {}) {
  return new Response(text, { status, headers: { "content-type": "text/csv", ...headers } });
}

function streamRes(chunks, headers = {}) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/csv", ...headers } });
}

async function expectJson(res, status, code) {
  assert.equal(res.status, status, `status esperado ${status}, veio ${res.status}`);
  const body = await res.json();
  assert.equal(body.code, code, `code esperado ${code}, veio ${JSON.stringify(body)}`);
  assert.equal(typeof body.error, "string");
  assertNoHostLeak(body);
  return body;
}

function assertNoHostLeak(body) {
  const text = JSON.stringify(body);
  assert.ok(!text.includes("api.bcb.gov.br"), "host do BCB vazou no corpo");
  assert.ok(!text.includes("tesourotransparente.gov.br"), "host do Tesouro vazou no corpo");
  assert.ok(!text.includes(" at "), "stack trace vazou no corpo");
}

function callsTo(fragment) {
  return net.calls.filter((call) => call.url.includes(fragment));
}

/* ---------- fixture do CSV do Tesouro ---------- */

const CSV_HEADER =
  "Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;" +
  "PU Compra Manha;PU Venda Manha;PU Base Manha";

function csvRow(name, maturity, base, buy, sale, puc, puv, pub) {
  return [name, maturity, base, buy, sale, puc, puv, pub].join(";");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoDate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function brDate(d) {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/* 30 dias descendo de 25/09/2026 (ordem real do arquivo: mais recente
   primeiro), 2 títulos por dia. O PU do primeiro título carrega o índice
   do dia para provar que o bloco certo foi lido. */
function makeFixture(count = 30) {
  const start = Date.UTC(2026, 8, 25);
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start - i * 86400000);
    const iso = isoDate(d);
    const br = brDate(d);
    const price = (19949.88 - i).toFixed(2).replace(".", ",");
    const lines = [
      csvRow("Tesouro Selic", "01/03/2029", br, "0,03", "0,04", price, "19934,86", "19934,86"),
      csvRow("Tesouro Prefixado", "01/01/2029", br, "13,67", "13,79", "851,57", "850,01", "850,01")
    ];
    days.push({ iso, br, lines, price: 19949.88 - i });
  }
  const text = [CSV_HEADER, ...days.flatMap((day) => day.lines), ""].join("\n");
  /* Chunks por dia: permite testar teto de leitura com datas já lidas. */
  const chunks = [
    `${CSV_HEADER}\n${days[0].lines.join("\n")}\n`,
    ...days.slice(1).map((day) => `${day.lines.join("\n")}\n`)
  ];
  return { days, text, chunks };
}

const fixture = makeFixture();

/* Cada teste parte de cache vazio e sem chamada anterior registrada: o
   cache por chave é justamente o que se quer verificar dentro do teste,
   nunca entre testes. */
test.beforeEach(() => {
  cacheStore.clear();
  net.calls = [];
  net.handler = null;
});

/* =====================================================================
   Rotas, CORS e rate limit
   ===================================================================== */

test("/financial sem Origin → 403 origin_blocked", async () => {
  const res = await get("/financial/bcb/series/11", { origin: null });
  await expectJson(res, 403, "origin_blocked");
});

test("OPTIONS /financial com Origin permitida → 204 + CORS", async () => {
  const res = await get("/financial/bcb/series/11", { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
});

test("POST /financial/... → 405 method_not_allowed", async () => {
  const res = await get("/financial/bcb/series/11", { method: "POST" });
  await expectJson(res, 405, "method_not_allowed");
});

test("provedor desconhecido → 404 unknown_provider", async () => {
  const res = await get("/financial/outro-provedor");
  await expectJson(res, 404, "unknown_provider");
});

test("rota fora do prefixo /financial continua 404 not_found", async () => {
  const res = await get("/financialx/bcb/series/11");
  await expectJson(res, 404, "not_found");
});

test("rate limit financeiro → 429 financial_rate_limited", async () => {
  env.FINANCIAL_RATE_LIMIT_PER_MINUTE = "2";
  net.handler = () => jsonRes([{ data: "25/09/2026", valor: "0.05" }]);
  try {
    const ip = "198.51.100.7";
    const first = await get("/financial/bcb/series/11?startDate=2026-09-01&endDate=2026-09-01", { ip });
    assert.equal(first.status, 200);
    const second = await get("/financial/bcb/series/11?startDate=2026-09-02&endDate=2026-09-02", { ip });
    assert.equal(second.status, 200);
    const third = await get("/financial/bcb/series/11?startDate=2026-09-03&endDate=2026-09-03", { ip });
    const body = await expectJson(third, 429, "financial_rate_limited");
    assert.equal(typeof body.error, "string");
    assert.equal(callsTo("bcdata.sgs.11").length, 2, "3ª chamada não deveria chegar ao provedor");
  } finally {
    env.FINANCIAL_RATE_LIMIT_PER_MINUTE = "50";
    net.handler = null;
  }
});

/* =====================================================================
   BCB (SGS)
   ===================================================================== */

test("BCB série 11 → contrato completo, datas dd/MM e cache", async () => {
  cacheStore.clear();
  net.calls = [];
  net.handler = (url) => {
    assert.ok(
      url.startsWith("https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&"),
      `URL fora do host constante: ${url}`
    );
    assert.ok(url.includes("dataInicial=25/09/2026"), "dataInicial não convertida para dd/MM/yyyy");
    assert.ok(url.includes("dataFinal=26/09/2026"), "dataFinal não convertida para dd/MM/yyyy");
    return jsonRes([
      { data: "25/09/2026", valor: "0.051660" },
      { data: "26/09/2026", valor: "0.049900" }
    ]);
  };

  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-26", { ip: "203.0.113.11" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-financial-cache"), "miss");
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);

  const body = await res.json();
  assert.equal(body.provider, "bcb");
  assert.equal(body.source, "SGS");
  assert.deepEqual(body.series, { code: 11, name: "Selic" });
  assert.equal(body.unit, "percent_per_day");
  assert.equal(body.from, "2026-09-25");
  assert.equal(body.to, "2026-09-26");
  assert.equal(body.data.length, 2);
  assert.deepEqual(body.data[0], { date: "2026-09-25", value: 0.05166 });
  assert.equal(typeof body.data[1].value, "number");
  assertNoHostLeak(body);

  /* Segundo pedido idêntico: cache, sem nova chamada externa. */
  const before = callsTo("bcdata.sgs.11").length;
  const cached = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-26", {
    ip: "203.0.113.12"
  });
  assert.equal(cached.status, 200);
  assert.equal(cached.headers.get("x-financial-cache"), "hit");
  assert.equal(callsTo("bcdata.sgs.11").length, before, "cache não evitou a chamada externa");
  const cachedBody = await cached.json();
  assert.deepEqual(cachedBody, body);
  net.handler = null;
});

test("BCB série fora do catálogo → nome e unidade não inventados", async () => {
  net.handler = () => jsonRes([{ data: "25/09/2026", valor: "1234.5" }]);
  const res = await get("/financial/bcb/series/4321?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.13"
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.series, { code: 4321, name: "Série 4321" });
  assert.equal(body.unit, "unspecified");
  net.handler = null;
});

test("BCB janela padrão de 30 dias quando os parâmetros são omitidos", async () => {
  net.handler = (url) => {
    const start = /dataInicial=(\d{2}\/\d{2}\/\d{4})/.exec(url);
    const end = /dataFinal=(\d{2}\/\d{2}\/\d{4})/.exec(url);
    assert.ok(start && end, "parâmetros de data ausentes");
    return jsonRes([]);
  };
  const res = await get("/financial/bcb/series/11", { ip: "203.0.113.14" });
  assert.equal(res.status, 200);
  const body = await res.json();
  const startDays = Date.parse(`${body.from}T00:00:00Z`);
  const endDays = Date.parse(`${body.to}T00:00:00Z`);
  assert.equal(Math.round((endDays - startDays) / 86400000), 29);
  net.handler = null;
});

test("BCB código inválido → 400 invalid_series_code sem chamada externa", async () => {
  net.calls = [];
  for (const code of ["abc", "0", "-1", "9999999"]) {
    const res = await get(`/financial/bcb/series/${code}`, { ip: "203.0.113.15" });
    const body = await expectJson(res, 400, "invalid_series_code");
    assert.match(body.error, /1 e 999999/);
  }
  assert.equal(net.calls.length, 0, "código inválido não pode gerar chamada externa");
});

test("BCB data com formato errado → 400 invalid_date_format", async () => {
  net.calls = [];
  const res = await get("/financial/bcb/series/11?startDate=25/09/2026", { ip: "203.0.113.16" });
  await expectJson(res, 400, "invalid_date_format");
  assert.equal(net.calls.length, 0);
});

test("BCB data impossível → 400 invalid_date", async () => {
  net.calls = [];
  for (const date of ["2026-02-30", "2026-13-01", "1899-01-01"]) {
    const res = await get(`/financial/bcb/series/11?startDate=${date}`, { ip: "203.0.113.17" });
    await expectJson(res, 400, "invalid_date");
  }
  assert.equal(net.calls.length, 0);
});

test("BCB início depois do fim → 400 invalid_date_range", async () => {
  const res = await get("/financial/bcb/series/11?startDate=2026-09-26&endDate=2026-09-25", {
    ip: "203.0.113.18"
  });
  await expectJson(res, 400, "invalid_date_range");
});

test("BCB janela acima de 10 anos → 400 date_range_too_large", async () => {
  net.calls = [];
  const res = await get("/financial/bcb/series/11?startDate=2010-01-01&endDate=2026-09-25", {
    ip: "203.0.113.19"
  });
  await expectJson(res, 400, "date_range_too_large");
  assert.equal(net.calls.length, 0, "janela inválida não pode gerar chamada externa");
});

test("BCB 404 com corpo {erro} → resposta vazia 200 (não é erro)", async () => {
  net.handler = () =>
    jsonRes({ erro: { statusCode: 404, detail: "Nenhum valor encontrado para o período informado" } }, 404);
  const res = await get("/financial/bcb/series/11?startDate=2000-01-01&endDate=2000-01-02", {
    ip: "203.0.113.20"
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.data, []);
  assert.equal(body.from, "2000-01-01");
  net.handler = null;
});

test("BCB 200 com HTML (série inexistente) → 502 invalid_response", async () => {
  net.handler = () => csvRes("<html><body>Requisição inválida!</body></html>", 200);
  const res = await get("/financial/bcb/series/999999?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.21"
  });
  const body = await expectJson(res, 502, "financial_provider_invalid_response");
  assert.ok(!body.error.includes("Requisição"), "corpo bruto do provedor vazou");
  net.handler = null;
});

test("BCB payload com valor não numérico → 502 invalid_response", async () => {
  net.handler = () => jsonRes([{ data: "25/09/2026", valor: "abc" }]);
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.22"
  });
  await expectJson(res, 502, "financial_provider_invalid_response");
  net.handler = null;
});

test("BCB acima de 5000 registros → 400 records_limit_exceeded", async () => {
  const payload = [];
  for (let i = 0; i < 5001; i++) {
    payload.push({ data: "25/09/2026", valor: "1.5" });
  }
  net.handler = () => jsonRes(payload);
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.23"
  });
  await expectJson(res, 400, "records_limit_exceeded");
  net.handler = null;
});

test("BCB timeout → 504 financial_provider_timeout", async () => {
  net.handler = () => {
    throw Object.assign(new Error("t"), { name: "TimeoutError" });
  };
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.24"
  });
  await expectJson(res, 504, "financial_provider_timeout");
  net.handler = null;
});

test("BCB erro de rede → 502 financial_provider_error", async () => {
  net.handler = () => {
    throw new Error("ECONNRESET");
  };
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.25"
  });
  await expectJson(res, 502, "financial_provider_error");
  net.handler = null;
});

test("BCB devolve 3xx → redirect não é seguido → 502 financial_provider_error", async () => {
  net.handler = () => jsonRes([], 302, { location: "https://example.com/destino" });
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.46"
  });
  await expectJson(res, 502, "financial_provider_error");
  assert.equal(callsTo("bcdata.sgs.11").length, 1, "deve parar na primeira leitura");
  net.handler = null;
});

test("BCB Content-Length acima do teto → 502 response_too_large", async () => {
  net.handler = () => jsonRes([{ data: "25/09/2026", valor: "1" }], 200, { "content-length": "99999999" });
  const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
    ip: "203.0.113.26"
  });
  await expectJson(res, 502, "financial_provider_response_too_large");
  net.handler = null;
});

test("falha inesperada → 500 sem detalhe interno e log mínimo", async () => {
  net.handler = () => ({
    status: 200,
    headers: {
      get() {
        throw new Error("segredo-de-interno");
      }
    }
  });
  const warns = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    const res = await get("/financial/bcb/series/11?startDate=2026-09-25&endDate=2026-09-25", {
      ip: "203.0.113.27"
    });
    const body = await expectJson(res, 500, "financial_internal_error");
    assert.ok(!JSON.stringify(body).includes("segredo-de-interno"));
    assert.equal(warns.length, 1);
    const logged = JSON.stringify(warns[0]);
    assert.ok(logged.includes("financial_internal_error"));
    assert.ok(!logged.includes("segredo-de-interno"), "log vazou detalhe interno");
    assert.ok(!logged.includes("203.0.113.27"), "log vazou IP do cliente");
  } finally {
    console.warn = originalWarn;
    net.handler = null;
  }
});

test("handler do gateway com URL inválida → 500 controlado", async () => {
  const res = await handleFinancial({ url: "nao-e-url" }, env, null);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.code, "financial_internal_error");
  assertNoHostLeak(body);
});

/* =====================================================================
   Tesouro Nacional
   ===================================================================== */

test("Tesouro sem data → dia mais recente e títulos convertidos", async () => {
  cacheStore.clear();
  net.calls = [];
  net.handler = () => csvRes(fixture.text);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.31" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-financial-cache"), "miss");

  const body = await res.json();
  assert.equal(body.provider, "tesouro");
  assert.equal(body.source, "tesouro_transparente");
  assert.equal(body.date, fixture.days[0].iso, "deveria ser o dia mais recente do arquivo");
  assert.equal(body.titles.length, 2);
  const selic = body.titles[0];
  assert.deepEqual(selic, {
    name: "Tesouro Selic",
    maturity: "2029-03-01",
    purchaseRate: 0.03,
    saleRate: 0.04,
    purchasePrice: 19949.88,
    salePrice: 19934.86,
    basePrice: 19934.86
  });
  assertNoHostLeak(body);

  const requested = callsTo("precotaxatesourodireto.csv");
  assert.equal(requested.length, 1);
  assert.equal(requested[0].init.redirect, "manual", "leitura externa não deve seguir redirect");
  net.handler = null;
});

test("Tesouro cache → segundo pedido sem chamada externa", async () => {
  net.handler = () => csvRes(fixture.text);

  const first = await get("/financial/tesouro/daily", { ip: "203.0.113.32" });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("x-financial-cache"), "miss");
  assert.equal(callsTo("precotaxatesourodireto.csv").length, 1);

  const second = await get("/financial/tesouro/daily", { ip: "203.0.113.32" });
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("x-financial-cache"), "hit");
  assert.equal(callsTo("precotaxatesourodireto.csv").length, 1, "cache não evitou a chamada externa");
  assert.deepEqual(await second.json(), await first.json());
  net.handler = null;
});

test("Tesouro ?date= de um dia anterior → só o bloco daquele dia", async () => {
  net.calls = [];
  net.handler = () => csvRes(fixture.text);
  const target = fixture.days[5];
  const res = await get(`/financial/tesouro/daily?date=${target.iso}`, { ip: "203.0.113.33" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.date, target.iso);
  assert.equal(body.titles.length, 2, "deveria parar no fim do bloco e não juntar os demais dias");
  assert.deepEqual(
    body.titles.map((title) => title.name),
    ["Tesouro Selic", "Tesouro Prefixado"]
  );
  assert.equal(
    body.titles[0].purchasePrice,
    target.price,
    "veio o PU de outro dia: o bloco não foi isolado"
  );
  net.handler = null;
});

test("Tesouro data sem dado recente → 404 date_not_found", async () => {
  net.handler = () => csvRes(fixture.text);
  const res = await get("/financial/tesouro/daily?date=2026-09-30", { ip: "203.0.113.34" });
  await expectJson(res, 404, "date_not_found");
  net.handler = null;
});

test("Tesouro data fora da janela lida → 400 date_outside_read_window", async () => {
  net.handler = () => streamRes(fixture.chunks);
  const policy = { ...FINANCIAL_POLICY.tesouro, maxBytes: 500 };
  const result = await handleTesouro({
    url: new URL(`${BASE}/financial/tesouro/daily?date=2020-01-01`),
    policy
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "date_outside_read_window");
  assert.equal(result.body.provider, "tesouro");
  assert.equal(result.body.available.to, fixture.days[0].iso, "deveria informar o topo da janela lida");
  assert.ok(result.body.available.from > "2020-01-01", "janela lida deveria ser mais recente que a data pedida");
  assertNoHostLeak(result.body);
  net.handler = null;
});

test("Tesouro data com formato errado → 400 invalid_date_format", async () => {
  net.calls = [];
  const res = await get("/financial/tesouro/daily?date=25/09/2026", { ip: "203.0.113.35" });
  await expectJson(res, 400, "invalid_date_format");
  assert.equal(net.calls.length, 0);
});

test("Tesouro data impossível → 400 invalid_date", async () => {
  net.calls = [];
  const res = await get("/financial/tesouro/daily?date=2026-02-30", { ip: "203.0.113.36" });
  await expectJson(res, 400, "invalid_date");
  assert.equal(net.calls.length, 0);
});

test("Tesouro rota errada → 404 unknown_route", async () => {
  const res = await get("/financial/tesouro/mensal", { ip: "203.0.113.37" });
  await expectJson(res, 404, "unknown_route");
  const bcbRes = await get("/financial/bcb/daily", { ip: "203.0.113.37" });
  await expectJson(bcbRes, 404, "unknown_route");
});

test("Tesouro cabeçalho diferente → 502 invalid_response", async () => {
  net.handler = () => csvRes(`Outro Cabecalho;Data;Valor\na;b;c\n`);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.38" });
  await expectJson(res, 502, "financial_provider_invalid_response");
  net.handler = null;
});

test("Tesouro número com separador inesperado → 502 invalid_response", async () => {
  const broken = [CSV_HEADER, csvRow("Tesouro Selic", "01/03/2029", "25/09/2026", "0,03", "0,04", "1.234,56", "1,0", "1,0"), ""].join(
    "\n"
  );
  net.handler = () => csvRes(broken);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.39" });
  await expectJson(res, 502, "financial_provider_invalid_response");
  net.handler = null;
});

test("Tesouro data de vencimento impossível → 502 invalid_response", async () => {
  const broken = [CSV_HEADER, csvRow("Tesouro Selic", "31/02/2029", "25/09/2026", "0,03", "0,04", "1,0", "1,0", "1,0"), ""].join(
    "\n"
  );
  net.handler = () => csvRes(broken);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.40" });
  await expectJson(res, 502, "financial_provider_invalid_response");
  net.handler = null;
});

test("Tesouro bytes fora de UTF-8 → 502 invalid_response", async () => {
  const header = new TextEncoder().encode(`${CSV_HEADER}\n`);
  const head = new TextEncoder().encode("Tesouro ");
  const tail = new TextEncoder().encode(
    " Selic;01/03/2029;25/09/2026;0,03;0,04;19949,88;19934,86;19934,86\n"
  );
  const bytes = new Uint8Array(header.length + head.length + 1 + tail.length);
  bytes.set(header, 0);
  bytes.set(head, header.length);
  bytes[header.length + head.length] = 0xe9; // byte solto → U+FFFD no decoder
  bytes.set(tail, header.length + head.length + 1);
  net.handler = () => new Response(bytes, { status: 200, headers: { "content-type": "text/csv" } });
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.41" });
  await expectJson(res, 502, "financial_provider_invalid_response");
  net.handler = null;
});

test("Tesouro Content-Length acima do teto → 502 response_too_large", async () => {
  net.handler = () => csvRes(fixture.text, 200, { "content-length": "999999999" });
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.42" });
  await expectJson(res, 502, "financial_provider_response_too_large");
  net.handler = null;
});

test("Tesouro timeout → 504 financial_provider_timeout", async () => {
  net.handler = () => {
    throw Object.assign(new Error("t"), { name: "AbortError" });
  };
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.43" });
  await expectJson(res, 504, "financial_provider_timeout");
  net.handler = null;
});

test("Tesouro resposta curta demais (só cabeçalho) → 404 date_not_found", async () => {
  net.handler = () => csvRes(`${CSV_HEADER}\n`);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.44" });
  await expectJson(res, 404, "date_not_found");
  net.handler = null;
});

test("última linha sem quebra final ainda é processada", async () => {
  const withoutTrailingNewline = [CSV_HEADER, csvRow("Tesouro Selic", "01/03/2029", "25/09/2026", "0,03", "0,04", "19949,88", "19934,86", "19934,86")].join(
    "\n"
  );
  net.handler = () => csvRes(withoutTrailingNewline);
  const res = await get("/financial/tesouro/daily", { ip: "203.0.113.45" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.titles.length, 1, "linha final sem \\n foi perdida");
  assert.equal(body.titles[0].purchasePrice, 19949.88);
  net.handler = null;
});

/* Políticas declaradas no gateway são respeitadas nos dois provedores. */
test("política do gateway cobre timeout, bytes e TTL", () => {
  assert.ok(FINANCIAL_POLICY.bcb.timeoutMs > 0);
  assert.ok(FINANCIAL_POLICY.bcb.maxBytes > 0);
  assert.ok(FINANCIAL_POLICY.bcb.maxBytes <= FINANCIAL_POLICY.bcb.maxContentLength);
  assert.ok(FINANCIAL_POLICY.tesouro.maxBytes < FINANCIAL_POLICY.tesouro.maxContentLength);
  assert.ok(FINANCIAL_POLICY.tesouro.cacheTtlSeconds >= FINANCIAL_POLICY.bcb.cacheTtlSeconds);
  assert.equal(typeof handleBcb, "function");
  assert.equal(typeof handleTesouro, "function");
});
