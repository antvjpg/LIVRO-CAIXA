/* LIVRO-CAIXA — adaptador de indicadores (BCB SGS e Tesouro Nacional).

   Única porta de entrada do frontend para GET /financial do Worker.

   Papel (nada além disto):
   - montar as URLs a partir de um baseUrl configurado (nunca embutir host);
   - validar a forma da resposta antes de aceitar;
   - manter em cache, com TTL, o último valor válido por indicador;
   - expor um snapshot pronto para exibição, para o contexto da IA e para
     persistência — nunca participar de cálculo de saldo.

   Regras:
   - NÃO altera nem lê o modelo financeiro (lançamentos, investimentos,
     caixinhas, cartões): é somente leitura de dado externo;
   - NÃO consulta cripto — cotação de cripto é exclusiva do CoinGecko;
   - NÃO envia Authorization: /financial é rota pública do Worker
     (allowlist de origem + rate limit por IP);
   - NÃO persiste nada por conta própria: devolve JSON puro e cabe ao
     chamador decidir onde guardar (Firestore local, memória etc.);
   - indicador com resposta inválida ou unidade divergente da esperada
     fica indisponível (mantendo o valor anterior quando houver) em vez
     de exibir dado com unidade inventada.

   Contrato do Worker (worker/src/financial/*):
     GET {base}/financial/bcb/series/{código}?startDate&endDate
       → 200 { provider, source, series:{code,name}, unit, from, to,
               data:[{date,value}] }
     GET {base}/financial/tesouro/daily[?date]
       → 200 { provider, source, date, titles:[{name,maturity,
               purchaseRate,saleRate,purchasePrice,salePrice,basePrice}] }
     erro → { error, code, provider } com status HTTP correspondente
            (429 financial_rate_limited, 400/404 de validação, 502/504
            de provedor). Header X-Financial-Cache é exposto pelo CORS.
   ===================================================================== */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LivroCaixaFinancial = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; /* 6 h entre buscas */
  const FAILURE_BACKOFF_MS = 5 * 60 * 1000; /* espera mínima após falha total */
  const REQUEST_TIMEOUT_MS = 12000;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const MAX_TITLES = 500; /* mesmo teto do Worker (MAX_TITLES_PER_DATE) */

  /* Séries consumidas: somente as verificadas na fonte e cobertas pelo
     catálogo do Worker. O esperado aqui é contrato: se o Worker devolver
     unidade diferente, o indicador é marcado como indisponível. */
  const SERIES = [
    { key: 'selic', code: 11, name: 'Selic', unit: 'percent_per_day', windowDays: 14 },
    { key: 'cdi', code: 12, name: 'CDI', unit: 'percent_per_day', windowDays: 14 },
    { key: 'ipca', code: 433, name: 'IPCA', unit: 'percent_per_month', windowDays: 400 }
  ];
  const TESOURO_KEY = 'tesouro';

  let baseUrl = '';
  let ttlMs = DEFAULT_TTL_MS;
  let snapshot = null; /* último snapshot válido aceito */
  let fetchedAt = 0; /* quando o último snapshot ficou completo/parcial ok */
  let lastAttemptAt = 0; /* última tentativa (sucesso ou falha) */
  let status = 'idle'; /* idle | loading | ready | partial | error */
  let lastErrors = [];
  let inflight = null;

  function fail(code, message, statusHttp) {
    const err = new Error(message || code);
    err.code = code;
    if (statusHttp != null) err.status = statusHttp;
    return err;
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDaysISO(iso, days) {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function toISODate(value) {
    return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
  }

  /* ---------------- leitura HTTP ---------------- */

  async function requestJson(path) {
    if (!baseUrl) throw fail('not_configured', 'Cliente financeiro não configurado.');
    const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
      : null;

    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller ? controller.signal : undefined
      });
    } catch (networkError) {
      throw fail(
        networkError && networkError.name === 'AbortError' ? 'timeout' : 'network',
        'Falha de rede ao consultar a base financeira.'
      );
    } finally {
      if (timer) clearTimeout(timer);
    }

    const raw = await response.text().catch(() => '');
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch (notJson) {
      parsed = null;
    }

    if (!response.ok) {
      throw fail(
        (parsed && typeof parsed.code === 'string' && parsed.code) || `http_${response.status}`,
        (parsed && typeof parsed.error === 'string' && parsed.error) || 'A base financeira não respondeu.',
        response.status
      );
    }
    if (!parsed || typeof parsed !== 'object') {
      throw fail('invalid_response', 'A base financeira retornou um formato inesperado.', 502);
    }
    return parsed;
  }

  /* ---------------- validação de contrato ---------------- */

  /* Último ponto da série (a ordenação do SGS não é tratada como regra
     aqui: o ponto mais recente é escolhido por data, não por posição). */
  function normalizeSeries(body, def) {
    if (!body || typeof body !== 'object') return null;
    if (body.provider !== 'bcb') return null;
    if (!body.series || Number(body.series.code) !== def.code) return null;
    if (body.unit !== def.unit) return null; /* unidade divergente = contrato quebrado */
    if (!Array.isArray(body.data)) return null;

    let latest = null;
    for (const item of body.data) {
      if (!item || typeof item !== 'object') return null;
      const date = toISODate(item.date);
      if (!date || !isFiniteNumber(item.value)) return null;
      if (!latest || date > latest.date) latest = { date, value: item.value };
    }
    if (!latest) return null;

    return {
      code: def.code,
      name: def.name,
      unit: def.unit,
      value: latest.value,
      date: latest.date
    };
  }

  function normalizeTesouro(body) {
    if (!body || typeof body !== 'object') return null;
    if (body.provider !== 'tesouro') return null;
    const date = toISODate(body.date);
    if (!date || !Array.isArray(body.titles) || body.titles.length === 0) return null;
    if (body.titles.length > MAX_TITLES) return null;

    const titles = [];
    for (const item of body.titles) {
      if (!item || typeof item !== 'object') return null;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const maturity = toISODate(item.maturity);
      const numbers = [
        item.purchaseRate,
        item.saleRate,
        item.purchasePrice,
        item.salePrice,
        item.basePrice
      ];
      if (!name || !maturity || !numbers.every(isFiniteNumber)) return null;
      titles.push({
        name,
        maturity,
        purchaseRate: numbers[0],
        saleRate: numbers[1],
        purchasePrice: numbers[2],
        salePrice: numbers[3],
        basePrice: numbers[4]
      });
    }

    return { date, titles };
  }

  /* ---------------- cache ---------------- */

  function isFresh() {
    if (!snapshot) return false;
    /* Rodada em que nada deu certo: só o backoff curto vale — a tela
       reaberta em seguida não deve gerar nova leva de chamadas. */
    if (status === 'error') return Date.now() - lastAttemptAt < FAILURE_BACKOFF_MS;
    return Date.now() - fetchedAt < ttlMs;
  }

  function buildSnapshot(parts, errors) {
    const next = { fetchedAt: new Date().toISOString(), indicators: {}, errors };
    for (const def of SERIES) {
      const value = parts[def.key] || (snapshot && snapshot.indicators[def.key]) || null;
      if (value) next.indicators[def.key] = value;
    }
    const tesouro = parts[TESOURO_KEY] || (snapshot && snapshot.indicators[TESOURO_KEY]) || null;
    if (tesouro) next.indicators[TESOURO_KEY] = tesouro;
    return next;
  }

  /* ---------------- busca ---------------- */

  async function loadAll() {
    const start = todayISO();
    const tasks = SERIES.map(async (def) => {
      const query =
        `?startDate=${addDaysISO(start, -def.windowDays)}&endDate=${start}`;
      try {
        const body = await requestJson(`/financial/bcb/series/${def.code}${query}`);
        const value = normalizeSeries(body, def);
        if (!value) throw fail('invalid_response', 'Resposta inesperada da base financeira.', 502);
        return { key: def.key, ok: true, value };
      } catch (err) {
        return { key: def.key, ok: false, code: err.code || 'error' };
      }
    });

    tasks.push(
      (async () => {
        try {
          const body = await requestJson('/financial/tesouro/daily');
          const value = normalizeTesouro(body);
          if (!value) throw fail('invalid_response', 'Resposta inesperada da base financeira.', 502);
          return { key: TESOURO_KEY, ok: true, value };
        } catch (err) {
          return { key: TESOURO_KEY, ok: false, code: err.code || 'error' };
        }
      })()
    );

    const results = await Promise.all(tasks);
    lastAttemptAt = Date.now();

    const parts = {};
    const errors = [];
    let successCount = 0;
    for (const result of results) {
      if (result.ok) {
        parts[result.key] = result.value;
        successCount += 1;
      } else {
        errors.push({ key: result.key, code: result.code });
      }
    }

    /* Nada deu certo nesta rodada: o snapshot anterior é mantido (dado
       mais velho é melhor que nenhum), mas fetchedAt NÃO avança — assim
       o backoff de FAILURE_BACKOFF_MS deixa nova tentativa em breve. */
    if (successCount === 0) {
      status = 'error';
      lastErrors = errors;
      return snapshot;
    }

    snapshot = buildSnapshot(parts, errors);
    fetchedAt = lastAttemptAt;
    status = errors.length === 0 ? 'ready' : 'partial';
    lastErrors = errors;
    return snapshot;
  }

  /* ---------------- API pública ---------------- */

  const client = {
    configure(options) {
      const opts = options || {};
      if (typeof opts.baseUrl === 'string') baseUrl = opts.baseUrl.trim();
      if (Number.isFinite(opts.ttlMs) && opts.ttlMs > 0) ttlMs = Math.floor(opts.ttlMs);
      return client;
    },

    /* Devolve o último snapshot válido; busca quando o TTL expirou.
       force=true pula o TTL. Duas chamadas simultâneas compartilham a
       mesma busca (não dispara 8 requisições por re-render). */
    async getIndicators(options) {
      const opts = options || {};
      if (!baseUrl) throw fail('not_configured', 'Cliente financeiro não configurado.');
      if (!opts.force && isFresh()) return snapshot;
      if (inflight) return inflight;

      status = 'loading';
      inflight = loadAll()
        .catch(() => {
          status = snapshot ? 'partial' : 'error';
          return snapshot;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },

    getState() {
      return { status, lastErrors: lastErrors.slice(), fetchedAt };
    },

    getSnapshot() {
      return snapshot;
    },

    isStale() {
      return !isFresh();
    },

    /* JSON puro, seguro para Firestore (sem undefined/NaN/Infinity). */
    snapshotToPersist() {
      if (!snapshot) return null;
      return JSON.parse(JSON.stringify(snapshot));
    },

    /* Semeia o cache a partir do que já estava persistido, antes da
       primeira busca. Formato inválido → null (nunca lança). */
    restoreFromPersisted(raw) {
      if (!raw || typeof raw !== 'object' || !raw.indicators || typeof raw.indicators !== 'object') {
        return null;
      }
      const parts = {};
      for (const def of SERIES) {
        const value = normalizeSeriesLike(raw.indicators[def.key], def);
        if (value) parts[def.key] = value;
      }
      const tesouro = normalizeTesouroLike(raw.indicators[TESOURO_KEY]);
      if (tesouro) parts[TESOURO_KEY] = tesouro;
      if (Object.keys(parts).length === 0) return null;

      snapshot = buildSnapshot(parts, []);
      fetchedAt = Number.isFinite(Date.parse(raw.fetchedAt)) ? Date.parse(raw.fetchedAt) : 0;
      lastAttemptAt = fetchedAt;
      status = 'ready';
      lastErrors = [];
      return snapshot;
    },

    /* Uso em testes/diagnóstico: zera o estado em memória. */
    reset() {
      baseUrl = '';
      ttlMs = DEFAULT_TTL_MS;
      snapshot = null;
      fetchedAt = 0;
      lastAttemptAt = 0;
      status = 'idle';
      lastErrors = [];
      inflight = null;
    },

    /* Descarta só o conteúdo (troca de conta no mesmo dispositivo):
       mantém baseUrl/ttl configurados e força a próxima busca. */
    forget() {
      snapshot = null;
      fetchedAt = 0;
      lastAttemptAt = 0;
      status = 'idle';
      lastErrors = [];
      inflight = null;
    },

    SERIES: SERIES.map((def) => ({ key: def.key, code: def.code, name: def.name, unit: def.unit }))
  };

  /* Mesmas regras de validação aplicadas ao que veio da persistência:
     dado antigo/corrompido não volta para a tela. */
  function normalizeSeriesLike(value, def) {
    if (!value || typeof value !== 'object') return null;
    if (Number(value.code) !== def.code) return null;
    if (value.unit !== def.unit) return null;
    const date = toISODate(value.date);
    if (!date || !isFiniteNumber(value.value)) return null;
    return { code: def.code, name: def.name, unit: def.unit, value: value.value, date };
  }

  function normalizeTesouroLike(value) {
    if (!value || typeof value !== 'object') return null;
    const date = toISODate(value.date);
    if (!date || !Array.isArray(value.titles) || value.titles.length === 0) return null;
    if (value.titles.length > MAX_TITLES) return null;
    const titles = [];
    for (const item of value.titles) {
      if (!item || typeof item !== 'object') return null;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const maturity = toISODate(item.maturity);
      const numbers = [
        item.purchaseRate,
        item.saleRate,
        item.purchasePrice,
        item.salePrice,
        item.basePrice
      ];
      if (!name || !maturity || !numbers.every(isFiniteNumber)) return null;
      titles.push({
        name,
        maturity,
        purchaseRate: numbers[0],
        saleRate: numbers[1],
        purchasePrice: numbers[2],
        salePrice: numbers[3],
        basePrice: numbers[4]
      });
    }
    return { date, titles };
  }

  return client;
});
