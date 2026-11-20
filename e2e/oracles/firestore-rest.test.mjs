/* C.O.D.E. — testes unitários offline do helper REST de QA.
   Execução: npm run code:oracles (mesmo harness dos demais testes unitários).
   Nenhum serviço externo é acessado: fetch e timers são controlados. */
import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  fetchCollectionPage,
  isTransientNetworkError,
  listCollection,
} = require('../helpers/firestore-rest.cjs');

function resposta(status) {
  return {
    status,
    ok: status >= 200 && status < 300,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => '',
  };
}

function controlarFetch(t, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  t.after(() => { globalThis.fetch = original; });
}

function erroRede(mensagem, code) {
  const err = new Error(mensagem);
  if (code) err.code = code;
  if (!code) err.name = 'TypeError';
  return err;
}

async function recuperacao(t, falha, esperado = 2) {
  let chamadas = 0;
  controlarFetch(t, async () => {
    chamadas += 1;
    if (chamadas === 1) throw falha;
    return resposta(200);
  });
  const pendente = fetchCollectionPage('https://firestore.example/pagina', {});
  const res = await pendente;
  assert.equal(res.status, 200);
  assert.equal(chamadas, esperado);
}

test('fetchCollectionPage: TypeError fetch failed recupera na 2ª chamada', async (t) => {
  await recuperacao(t, erroRede('fetch failed'));
});

test('fetchCollectionPage: ECONNRESET recupera na 2ª chamada', async (t) => {
  await recuperacao(t, erroRede('socket hang up', 'ECONNRESET'));
});

test('fetchCollectionPage: ETIMEDOUT recupera na 2ª chamada', async (t) => {
  await recuperacao(t, erroRede('connect timeout', 'ETIMEDOUT'));
});

test('fetchCollectionPage: EAI_AGAIN recupera na 2ª chamada', async (t) => {
  await recuperacao(t, erroRede('temporary name resolution failure', 'EAI_AGAIN'));
});

test('fetchCollectionPage: HTTP 500–599 recupera na 2ª chamada', async (t) => {
  let chamadas = 0;
  controlarFetch(t, async () => {
    chamadas += 1;
    return chamadas === 1 ? resposta(503) : resposta(200);
  });
  const pendente = fetchCollectionPage('https://firestore.example/pagina', {});
  assert.equal((await pendente).status, 200);
  assert.equal(chamadas, 2);
});

test('fetchCollectionPage: HTTP 401 e 403 não são repetidos', async (t) => {
  let statusAtual = 401;
  let chamadas = 0;
  controlarFetch(t, async () => { chamadas += 1; return resposta(statusAtual); });
  for (const status of [401, 403]) {
    chamadas = 0;
    statusAtual = status;
    const res = await fetchCollectionPage('https://firestore.example/pagina', {});
    assert.equal(res.status, status);
    assert.equal(chamadas, 1, `HTTP ${status} não deve ser repetido`);
  }
});

test('listCollection: HTTP 404 continua retornando coleção vazia', async (t) => {
  let chamadas = 0;
  controlarFetch(t, async () => { chamadas += 1; return resposta(404); });
  const docs = await listCollection('uid-teste', 'token-teste', 'proj-teste', 'investments');
  assert.deepEqual(docs, []);
  assert.equal(chamadas, 1);
});

test('fetchCollectionPage: falha de rede persistente encerra após 3 chamadas com erro identificável', async (t) => {
  let chamadas = 0;
  controlarFetch(t, async () => { chamadas += 1; throw erroRede('fetch failed'); });
  const pendente = assert.rejects(
    () => fetchCollectionPage('https://firestore.example/pagina', {}),
    (err) => {
      assert.equal(err.code, 'CODE_LIST_NETWORK_FAILED');
      assert.match(err.message, /após 3 tentativa\(s\)/);
      assert.ok(!err.message.includes('token-teste'));
      return true;
    }
  );
  await pendente;
  assert.equal(chamadas, 3);
});

test('fetchCollectionPage: HTTP 5xx persistente encerra após 3 chamadas com erro identificável', async (t) => {
  let chamadas = 0;
  controlarFetch(t, async () => { chamadas += 1; return resposta(502); });
  const pendente = assert.rejects(
    () => fetchCollectionPage('https://firestore.example/pagina', {}),
    (err) => {
      assert.equal(err.code, 'CODE_LIST_NETWORK_FAILED');
      assert.match(err.message, /HTTP 502/);
      assert.match(err.message, /após 3 tentativa\(s\)/);
      return true;
    }
  );
  await pendente;
  assert.equal(chamadas, 3);
});

test('fetchCollectionPage: HTTP 429 preserva exclusivamente o retry de quota', async (t) => {
  let chamadas = 0;
  controlarFetch(t, async () => { chamadas += 1; return resposta(429); });
  const pendente = fetchCollectionPage('https://firestore.example/pagina', {});
  assert.equal((await pendente).status, 429);
  assert.equal(chamadas, 3, '2 retries de quota [2000,5000] + chamada inicial');
});

test('isTransientNetworkError: classifica apenas falhas recuperáveis', () => {
  assert.equal(isTransientNetworkError(erroRede('fetch failed')), true);
  for (const code of ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'EAI_AGAIN']) {
    assert.equal(isTransientNetworkError(erroRede('x', code)), true, code);
  }
  assert.equal(isTransientNetworkError(erroRede('x', 'EACCES')), false);
  assert.equal(isTransientNetworkError(new Error('falha de regra')), false);
  assert.equal(isTransientNetworkError(null), false);
});

test('firestore-rest: fetchCollectionPage não é usada por escrita ou exclusão', () => {
  const fonte = fs.readFileSync(path.join(import.meta.dirname, '..', 'helpers', 'firestore-rest.cjs'), 'utf8');
  const linhas = fonte.split('\n');
  const usos = linhas.filter((linha) => linha.includes('fetchCollectionPage('));
  assert.equal(usos.length, 2, 'definição + uso exclusivo em listCollection');
  assert.ok(usos[0].trim().startsWith('async function fetchCollectionPage('));
  assert.ok(usos[1].includes('await fetchCollectionPage(url,'));
  const deletes = linhas.filter((linha) => linha.includes('fetchWithQuotaRetry(`https://firestore.googleapis.com/v1/'));
  assert.equal(deletes.length, 2, 'deleteDoc e DELETE raiz seguem no retry de quota, sem retry de rede');
});
