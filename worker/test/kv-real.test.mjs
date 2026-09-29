import test, { after } from "node:test";
import assert from "node:assert/strict";

import { getFreeQuotaKV, burnQuotaKV } from "../src/ai/quota-kv.js";
import { isRateLimitedKV } from "../src/ai/ratelimit-kv.js";

let mf = null;
let motivoPulo = "";

try {
  const { Miniflare } = await import("miniflare");
  mf = new Miniflare({
    modules: true,
    script: "export default {}",
    kvNamespaces: ["QUOTA_KV", "RATE_LIMIT_KV"]
  });
  await mf.ready;
} catch (erro) {
  if (mf) {
    try {
      await mf.dispose();
    } catch {}
  }
  mf = null;
  motivoPulo =
    `Miniflare/workerd indisponível em ${process.platform}-${process.arch} ` +
    `(testes de KV real rodam no CI linux; dependência em worker/package.json): ${erro.message}`;
}

const opcao = motivoPulo ? { skip: motivoPulo } : {};

after(async () => {
  if (mf) await mf.dispose();
});

async function nsDe(binding) {
  return mf.getKVNamespace(binding);
}

function diaUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function expiracaoDaChave(ns, nome) {
  const lista = await ns.list();
  const item = lista.keys.find((k) => k.name === nome);
  assert.ok(item, `chave "${nome}" não aparece no list() do KV real`);
  return item.expiration;
}

test("cota: cache fresco é servido pelo KV real sem chamar a API", opcao, async () => {
  const ns = await nsDe("QUOTA_KV");
  const dia = diaUtc();
  const chave = `quota:${dia}`;
  const dados = { day: dia, limit: 50, used: 5, remaining: 45, resetAt: 4102444800 };
  await ns.put(chave, JSON.stringify({ at: Date.now(), data: dados }));

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetch não deveria ser chamado com cache fresco");
  };
  try {
    const quota = await getFreeQuotaKV({ OPENROUTER_API_KEY: "sk-or-v1-teste", QUOTA_KV: ns });
    assert.deepEqual(quota, dados);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test("cota: burnQuotaKV decrementa e regrava no KV real com TTL de 2 dias", opcao, async () => {
  const ns = await nsDe("QUOTA_KV");
  const dia = diaUtc();
  const chave = `quota:${dia}`;
  const dados = { day: dia, limit: 50, used: 5, remaining: 45, resetAt: 4102444800 };
  await ns.put(chave, JSON.stringify({ at: Date.now(), data: dados }));

  await burnQuotaKV({ QUOTA_KV: ns });

  const cru = await ns.get(chave, { type: "json" });
  assert.equal(cru.data.remaining, 44, "burn deveria decrementar remaining");
  assert.equal(cru.data.used, 6, "burn deveria incrementar used");

  const agoraS = Math.floor(Date.now() / 1000);
  const expiracao = await expiracaoDaChave(ns, chave);
  assert.equal(typeof expiracao, "number", "expirationTtl não foi aplicado pelo KV real");
  assert.ok(
    Math.abs(expiracao - (agoraS + 86400 * 2)) <= 60,
    `expiration fora da janela esperada: ${expiracao}`
  );
});

test("cota: cache obsoleto busca a API e persiste no KV real com TTL", opcao, async () => {
  const ns = await nsDe("QUOTA_KV");
  const dia = diaUtc();
  const chave = `quota:${dia}`;
  const dadosAntigos = { day: dia, limit: 999, used: 999, remaining: 0, resetAt: 1 };
  await ns.put(chave, JSON.stringify({ at: Date.now() - 120000, data: dadosAntigos }));

  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/key");
    return new Response(
      JSON.stringify({
        data: { free_model_daily_requests: { limit: 100, used: 20, remaining: 80 } }
      }),
      { status: 200 }
    );
  };
  try {
    const quota = await getFreeQuotaKV({ OPENROUTER_API_KEY: "sk-or-v1-teste", QUOTA_KV: ns });
    const resetEsperado = Math.floor((Date.parse(`${dia}T00:00:00Z`) + 86400000) / 1000);
    assert.deepEqual(quota, { day: dia, limit: 100, used: 20, remaining: 80, resetAt: resetEsperado });
  } finally {
    globalThis.fetch = fetchOriginal;
  }

  const cru = await ns.get(chave, { type: "json" });
  assert.equal(cru.data.remaining, 80, "resultado da API deveria ficar gravado no KV real");
  assert.ok(Date.now() - cru.at < 60000, "timestamp do cache deveria ser recente");

  const agoraS = Math.floor(Date.now() / 1000);
  const expiracao = await expiracaoDaChave(ns, chave);
  assert.ok(
    Math.abs(expiracao - (agoraS + 86400 * 2)) <= 60,
    `expiration fora da janela esperada: ${expiracao}`
  );
});

test("rate limit: contador persiste no KV real com TTL de 2 minutos", opcao, async () => {
  const ns = await nsDe("RATE_LIMIT_KV");
  const agoraReal = Date.now();
  const dateNowOriginal = Date.now;
  Date.now = () => agoraReal;
  try {
    const uid = "uid-kv-real";
    const env = { RATE_LIMIT_KV: ns, AI_RATE_LIMIT_PER_MINUTE: "2" };

    assert.equal(await isRateLimitedKV(uid, env), false, "1ª chamada deveria passar");
    assert.equal(await isRateLimitedKV(uid, env), false, "2ª chamada deveria passar");
    assert.equal(await isRateLimitedKV(uid, env), true, "3ª chamada deveria ser bloqueada");

    const outroEnv = {
      RATE_LIMIT_KV: await nsDe("RATE_LIMIT_KV"),
      AI_RATE_LIMIT_PER_MINUTE: "2"
    };
    assert.equal(
      await isRateLimitedKV(uid, outroEnv),
      true,
      "contador deveria persistir no KV entre objetos de ambiente distintos"
    );

    const janela = Math.floor(agoraReal / 60000) * 60000;
    const chave = `ratelimit::${uid}:${janela}`;
    const valor = await ns.get(chave);
    assert.equal(valor, "2", "contador no KV real deveria ser 2 (3ª chamada não incrementa)");

    const agoraS = Math.floor(agoraReal / 1000);
    const expiracao = await expiracaoDaChave(ns, chave);
    assert.ok(
      Math.abs(expiracao - (agoraS + 120)) <= 30,
      `expiration fora da janela esperada: ${expiracao}`
    );
  } finally {
    Date.now = dateNowOriginal;
  }
});
