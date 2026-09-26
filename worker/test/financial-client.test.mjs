/* Testes do adaptador de indicadores do frontend (financial-client.js).
   Execução: node --test worker/test/

   Rede: nenhuma chamada real — fetch é substituído por um handler por
   teste. O módulo é CommonJS no repositório raiz e é importado aqui
   para validar contrato, validação de resposta, cache e degradação. */

import test from "node:test";
import assert from "node:assert/strict";

const BASE = "https://livro-caixa-ai.workers.dev";

const net = { handler: null, calls: [] };
globalThis.fetch = async (url, init) => {
  net.calls.push({ url: String(url), init });
  if (!net.handler) throw new Error(`fetch inesperado: ${url}`);
  return net.handler(String(url), init);
};

const client = (await import(new URL("../../financial-client.js", import.meta.url))).default;

/* ---------- helpers ---------- */

function freshClient(options = {}) {
  client.reset();
  client.configure({ baseUrl: BASE, ...options });
  net.calls = [];
  net.handler = null;
  return client;
}

function jsonRes(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function seriesBody(code, unit, points) {
  return {
    provider: "bcb",
    source: "SGS",
    series: { code, name: code === 11 ? "Selic" : code === 12 ? "CDI" : "IPCA" },
    unit,
    from: points[0]?.date || "2026-09-01",
    to: points[points.length - 1]?.date || "2026-09-26",
    data: points
  };
}

function tesouroBody(date = "2026-09-26") {
  return {
    provider: "tesouro",
    source: "tesouro_transparente",
    date,
    titles: [
      {
        name: "Tesouro Selic 2029",
        maturity: "2029-03-01",
        purchaseRate: 0.03,
        saleRate: 0.04,
        purchasePrice: 19934.86,
        salePrice: 19934.86,
        basePrice: 19934.86
      }
    ]
  };
}

/* Handler padrão de sucesso: atende as 4 rotas do adapter. */
function okHandler() {
  return (url) => {
    if (url.includes("/financial/bcb/series/11")) {
      return jsonRes(seriesBody(11, "percent_per_day", [
        { date: "2026-09-24", value: 0.05166 },
        { date: "2026-09-25", value: 0.050788 }
      ]));
    }
    if (url.includes("/financial/bcb/series/12")) {
      return jsonRes(seriesBody(12, "percent_per_day", [{ date: "2026-09-25", value: 0.050788 }]));
    }
    if (url.includes("/financial/bcb/series/433")) {
      return jsonRes(seriesBody(433, "percent_per_month", [{ date: "2026-08-01", value: -0.32 }]));
    }
    if (url.includes("/financial/tesouro/daily")) return jsonRes(tesouroBody());
    throw new Error(`rota inesperada: ${url}`);
  };
}

/* ---------- testes ---------- */

test("monta as URLs no baseUrl configurado, só GET, sem Authorization", async () => {
  const c = freshClient();
  net.handler = okHandler();

  const snapshot = await c.getIndicators();
  assert.ok(snapshot, "snapshot não retornado");

  assert.equal(net.calls.length, 4, "esperava exatamente 4 chamadas");
  for (const call of net.calls) {
    assert.ok(call.url.startsWith(`${BASE}/financial/`), `URL fora do Worker: ${call.url}`);
    assert.ok(!/coingecko|api\.bcb\.gov|tesourotransparente/i.test(call.url), "host externo vazou");
    assert.equal(call.init.method, "GET");
    assert.equal(
      (call.init.headers || {}).Authorization,
      undefined,
      "/financial é público: não enviar token"
    );
  }

  const paths = net.calls.map((call) => call.url.replace(BASE, "").split("?")[0]).sort();
  assert.deepEqual(paths, [
    "/financial/bcb/series/11",
    "/financial/bcb/series/12",
    "/financial/bcb/series/433",
    "/financial/tesouro/daily"
  ].sort());
});

test("janelas de data: Selic/CDI curtas, IPCA ~13 meses", async () => {
  const c = freshClient();
  net.handler = okHandler();
  await c.getIndicators();

  const windowOf = (code) => {
    const call = net.calls.find((item) => item.url.includes(`series/${code}`));
    assert.ok(call, `série ${code} não chamada`);
    const start = /startDate=(\d{4}-\d{2}-\d{2})/.exec(call.url);
    const end = /endDate=(\d{4}-\d{2}-\d{2})/.exec(call.url);
    assert.ok(start && end, "parâmetros de janela ausentes");
    return Math.round(
      (Date.parse(`${end[1]}T00:00:00Z`) - Date.parse(`${start[1]}T00:00:00Z`)) / 86400000
    );
  };

  assert.ok(windowOf(11) <= 15, "janela da Selic maior que o esperado");
  assert.ok(windowOf(12) <= 15, "janela do CDI maior que o esperado");
  const ipcaWindow = windowOf(433);
  assert.ok(ipcaWindow >= 360 && ipcaWindow <= 400, `janela do IPCA fora do intervalo: ${ipcaWindow}`);
});

test("sucesso → status ready e ponto mais recente por data", async () => {
  const c = freshClient();
  net.handler = okHandler();

  const snapshot = await c.getIndicators();
  assert.equal(c.getState().status, "ready");
  assert.deepEqual(snapshot.errors, []);
  assert.equal(snapshot.indicators.selic.value, 0.050788);
  assert.equal(snapshot.indicators.selic.date, "2026-09-25");
  assert.equal(snapshot.indicators.selic.unit, "percent_per_day");
  assert.equal(snapshot.indicators.cdi.name, "CDI");
  assert.equal(snapshot.indicators.ipca.value, -0.32);
  assert.equal(snapshot.indicators.tesouro.date, "2026-09-26");
  assert.equal(snapshot.indicators.tesouro.titles[0].name, "Tesouro Selic 2029");
});

test("cache com TTL: repete sem nova chamada; force busca de novo", async () => {
  const c = freshClient();
  net.handler = okHandler();

  await c.getIndicators();
  assert.equal(net.calls.length, 4);

  const second = await c.getIndicators();
  assert.equal(net.calls.length, 4, "TTL não evitou a segunda busca");
  assert.ok(second);

  await c.getIndicators({ force: true });
  assert.equal(net.calls.length, 8, "force não gerou nova busca");
});

test("falha parcial → mantém valor anterior, marca partial e lista o erro", async () => {
  const c = freshClient();
  net.handler = okHandler();
  await c.getIndicators();
  assert.equal(c.getState().status, "ready");

  net.handler = (url) => {
    if (url.includes("/financial/tesouro/daily")) {
      return jsonRes({ error: "Muitas consultas financeiras agora.", code: "financial_rate_limited" }, 429);
    }
    return okHandler()(url);
  };

  const snapshot = await c.getIndicators({ force: true });
  assert.equal(c.getState().status, "partial");
  assert.equal(snapshot.indicators.selic.value, 0.050788, "indicador saudável foi descartado");
  assert.ok(snapshot.indicators.tesouro, "valor anterior do Tesouro não foi preservado");
  assert.deepEqual(snapshot.errors, [{ key: "tesouro", code: "financial_rate_limited" }]);
});

test("resposta malformada → indicador indisponível, valor não é aceito", async () => {
  const c = freshClient();
  net.handler = (url) => {
    if (url.includes("/financial/bcb/series/11")) {
      /* data fora do formato e valor não numérico */
      return jsonRes(seriesBody(11, "percent_per_day", [{ date: "25/09/2026", valor: "0.05" }]));
    }
    if (url.includes("/financial/bcb/series/12")) {
      return jsonRes(seriesBody(12, "percent_per_day", [{ date: "2026-09-25", value: "0.050788" }]));
    }
    if (url.includes("/financial/bcb/series/433")) {
      return jsonRes(seriesBody(433, "percent_per_month", [{ date: "2026-08-01", value: Number.NaN }]));
    }
    return jsonRes(tesouroBody());
  };

  const snapshot = await c.getIndicators();
  assert.equal(c.getState().status, "partial");
  assert.equal(snapshot.indicators.selic, undefined, "dado malformado foi aceito");
  assert.equal(snapshot.indicators.cdi, undefined, "valor string foi aceito");
  assert.equal(snapshot.indicators.ipca, undefined, "NaN foi aceito");
  assert.ok(snapshot.indicators.tesouro);
  const codes = snapshot.errors.map((e) => e.key).sort();
  assert.deepEqual(codes, ["cdi", "ipca", "selic"]);
});

test("unidade divergente do contrato → indicador recusado (nada de unidade inventada)", async () => {
  const c = freshClient();
  net.handler = (url) => {
    if (url.includes("/financial/bcb/series/11")) {
      /* Worker desatualizado devolve unidade não catalogada */
      return jsonRes(seriesBody(11, "unspecified", [{ date: "2026-09-25", value: 0.050788 }]));
    }
    if (url.includes("/financial/bcb/series/12")) {
      return jsonRes(seriesBody(12, "percent_per_day", [{ date: "2026-09-25", value: 0.050788 }]));
    }
    if (url.includes("/financial/bcb/series/433")) {
      return jsonRes(seriesBody(433, "percent_per_month", [{ date: "2026-08-01", value: -0.32 }]));
    }
    return jsonRes(tesouroBody());
  };

  const snapshot = await c.getIndicators();
  assert.equal(snapshot.indicators.selic, undefined);
  assert.ok(snapshot.indicators.cdi, "indicador válido foi descartado junto");
  assert.deepEqual(snapshot.errors, [{ key: "selic", code: "invalid_response" }]);
});

test("corpo de erro do Worker → code propagado, sem inventar mensagem", async () => {
  const c = freshClient();
  net.handler = (url) => {
    if (url.includes("series/433")) {
      return jsonRes({ error: "Período solicitado acima do limite de 10 anos.", code: "date_range_too_large" }, 400);
    }
    if (url.includes("series/11") || url.includes("series/12")) {
      return jsonRes(seriesBody(Number(/series\/(\d+)/.exec(url)[1]), "percent_per_day", [
        { date: "2026-09-25", value: 0.050788 }
      ]));
    }
    return jsonRes(tesouroBody());
  };

  const snapshot = await c.getIndicators();
  const error = snapshot.errors.find((item) => item.key === "ipca");
  assert.equal(error.code, "date_range_too_large");
  assert.equal(c.getState().status, "partial");
});

test("sem cache e rede indisponível → status error, snapshot null", async () => {
  const c = freshClient();
  net.handler = () => {
    throw new Error("offline");
  };

  const snapshot = await c.getIndicators();
  assert.equal(snapshot, null);
  assert.equal(c.getState().status, "error");
  assert.ok(c.getState().lastErrors.every((item) => item.code === "network"));
});

test("baseUrl não configurada → not_configured, sem chamada de rede", async () => {
  const c = freshClient({ baseUrl: "" });
  net.handler = okHandler();

  await assert.rejects(() => c.getIndicators(), (err) => err.code === "not_configured");
  assert.equal(net.calls.length, 0);
});

test("snapshotToPersist é JSON seguro e restoreFromPersisted valida o formato", async () => {
  const c = freshClient();
  net.handler = okHandler();
  await c.getIndicators();

  const persisted = c.snapshotToPersist();
  assert.equal(JSON.parse(JSON.stringify(persisted)).indicators.selic.value, 0.050788);

  /* round-trip em um cliente novo */
  freshClient({ baseUrl: BASE });
  const restored = client.restoreFromPersisted(persisted);
  assert.ok(restored, "round-trip do snapshot falhou");
  assert.equal(client.getSnapshot().indicators.selic.value, 0.050788);
  assert.equal(client.getState().status, "ready");

  /* formatos inválidos são rejeitados em silêncio */
  for (const bad of [null, {}, { indicators: [] }, { indicators: { selic: { code: 11, unit: "percent_per_day", value: "0.05", date: "2026-09-25" } } }]) {
    freshClient({ baseUrl: BASE });
    assert.equal(client.restoreFromPersisted(bad), null, `formato aceito: ${JSON.stringify(bad)}`);
  }
});

test("forget descarta o conteúdo e mantém a configuração", async () => {
  const c = freshClient();
  net.handler = okHandler();
  await c.getIndicators();
  assert.ok(c.getSnapshot(), "snapshot não veio antes do forget");

  c.forget();
  assert.equal(c.getSnapshot(), null, "forget manteve o snapshot");
  assert.equal(c.getState().status, "idle");

  net.calls = [];
  net.handler = okHandler();
  const snapshot = await c.getIndicators();
  assert.ok(snapshot, "baseUrl/ttl perdidos após forget");
  assert.equal(net.calls.length, 4);
});

test("round-trip não aceita indicador com código ou unidade trocados", async () => {
  freshClient({ baseUrl: BASE });
  const base = {
    fetchedAt: "2026-09-26T12:00:00.000Z",
    indicators: {
      selic: { code: 11, name: "Selic", unit: "percent_per_day", value: 0.050788, date: "2026-09-25" },
      cdi: { code: 11, name: "CDI", unit: "percent_per_day", value: 0.050788, date: "2026-09-25" },
      ipca: { code: 433, name: "IPCA", unit: "percent_per_day", value: -0.32, date: "2026-08-01" }
    }
  };

  const restored = client.restoreFromPersisted(base);
  assert.ok(restored);
  assert.ok(restored.indicators.selic, "selic válida descartada");
  assert.equal(restored.indicators.cdi, undefined, "cdi com código de outra série foi aceita");
  assert.equal(restored.indicators.ipca, undefined, "ipca com unidade trocada foi aceita");
});
