/* C.O.D.E. — acesso REST ao Firebase exclusivamente para:
   - seed/cleanup/reset do ambiente QA;
   - comparação somente-leitura (UI × Firestore) durante os testes.
   Segurança: só opera no uid retornado pela autenticação da CONTA QA
   (CODE_TEST_EMAIL/CODE_TEST_PASSWORD). Não existe caminho para tocar em
   dados de outro usuário: as rotas são sempre livrocaixa/{uid-qa}/...
   Credenciais e tokens nunca são impressos. */
'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('./env');

const COLLECTIONS = [
  'banks', 'categories', 'entries', 'investments', 'pockets', 'yieldsLog',
  'recurringBills', 'receivables', 'budgets', 'goals', 'cards', 'purchases',
  'invoiceLaunches', 'diagnostics',
];

/* Config pública do frontend é lida do próprio app.js (nada é copiado
   para o repositório e nada é logado). */
function readFirebaseWebConfig() {
  const html = fs.readFileSync(path.join(config.root, 'app.js'), 'utf8');
  const apiKey = /apiKey:\s*"([^"]+)"/.exec(html)?.[1];
  const projectId = /projectId:\s*"([^"]+)"/.exec(html)?.[1];
  if (!apiKey || !projectId) {
    const err = new Error('BLOCKED: não foi possível ler a config pública do Firebase em app.js');
    err.code = 'CODE_BLOCKED';
    throw err;
  }
  return { apiKey, projectId: projectId };
}

/* A cota de verificação de senha do Identity Toolkit ("Exceeded quota for
   verifying passwords") é por projeto e curta. O teardown roda logo após a
   rajada de login/logout das suítes e é justamente ali que ela estoura: sem
   conseguir autenticar, a conta efêmera criada pela run não é excluída e os
   docs dela ficam órfãos. Só cota é retentada — senha inválida, conta
   inexistente e falha de rede caem na hora. */
const SIGNIN_QUOTA_RETRY_DELAYS_MS = [2000, 5000];

function isPasswordQuota(res, body) {
  if (res.status === 429) return true;
  return String((body && body.error && body.error.message) || '').includes('QUOTA_EXCEEDED');
}

async function signIn(email, password, { retryDelaysMs = SIGNIN_QUOTA_RETRY_DELAYS_MS } = {}) {
  const { apiKey, projectId } = readFirebaseWebConfig();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  };

  let res;
  let body;
  for (let attempt = 0; ; attempt += 1) {
    res = await fetch(url, init);
    body = await res.json().catch(() => ({}));
    if (!isPasswordQuota(res, body) || attempt >= retryDelaysMs.length) break;
    await new Promise((r) => setTimeout(r, retryDelaysMs[attempt]));
  }

  if (!res.ok) {
    const err = new Error(`BLOCKED: login REST da conta QA falhou (${body?.error?.message || res.status})`);
    err.code = 'CODE_BLOCKED';
    err.reason = body?.error?.message || String(res.status);
    throw err;
  }
  return { uid: body.localId, idToken: body.idToken, email: body.email, projectId };
}

/* O Firestore REST devolve o resource name COMPLETO em Document.name:
   projects/{p}/databases/(default)/documents/livrocaixa/{uid}/...
   (fonte: google/firestore/v1/document.proto — "The resource name of the
   document"). Aceitamos forma completa ou relativa e validamos sempre o
   trecho relativo ao documento. */
function docPathOf(docPath) {
  const s = String(docPath || '');
  const marker = '/documents/';
  const i = s.lastIndexOf(marker);
  return i >= 0 ? s.slice(i + marker.length) : s;
}

function assertScoped(uid, docPath) {
  const rel = docPathOf(docPath);
  const prefix = `livrocaixa/${uid}/`;
  if (!uid || !(rel === `livrocaixa/${uid}` || rel.startsWith(prefix))) {
    throw new Error(`Recusado: caminho fora do escopo QA (${rel || docPath})`);
  }
}

/* Nomes de coleção entram literalmente na URL: só caracteres simples. */
const COLLECTION_RE = /^[A-Za-z0-9_-]{1,150}$/;
function assertCollection(collection) {
  if (!COLLECTION_RE.test(String(collection || ''))) {
    throw new Error(`Recusado: nome de coleção inválido (${String(collection).slice(0, 50)})`);
  }
}

/* Cota do Firestore (HTTP 429 RESOURCE_EXHAUSTED) é do PROJETO e dura horas
   (janela diária), não segundos. Estratégia: 2 retentativas curtas na PRIMEIRA
   resposta 429 de uma run e, se persistir, marcar uma carência — dentro dela
   nenhuma chamada repete espera (14 listagens × backoff estouraria o timeout
   de 90s do Playwright sem recuperar cota). Falha continua explícita. */
const QUOTA_RETRY_DELAYS_MS = [2000, 5000];
const QUOTA_COOLDOWN_MS = 10 * 60 * 1000;
let quotaExhaustedUntil = 0;

async function fetchWithQuotaRetry(url, init) {
  let res = await fetch(url, init);
  let attempt = 0;
  while (res.status === 429 && attempt < QUOTA_RETRY_DELAYS_MS.length && Date.now() >= quotaExhaustedUntil) {
    await new Promise((r) => setTimeout(r, QUOTA_RETRY_DELAYS_MS[attempt]));
    attempt += 1;
    res = await fetch(url, init);
  }
  if (res.status === 429 && Date.now() >= quotaExhaustedUntil) quotaExhaustedUntil = Date.now() + QUOTA_COOLDOWN_MS;
  return res;
}

/* Sonda de cota para o setup E2E abortar a run ANTES de criar conta e
   queimar 9 minutos falhando em cascata. Sem autenticação: 429 = cota
   esgotada; 401/403/200 = projeto atendendo. Não lê dado algum (pageSize 1
   sobre coleção inexistente sob conta inexistente). */
async function probeQuota() {
  const { projectId } = readFirebaseWebConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/livrocaixa/probe-cota/entries?pageSize=1`;
  const res = await fetch(url).catch(() => null);
  return res ? res.status : 0;
}

async function listCollection(uid, idToken, projectId, collection) {
  assertCollection(collection);
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/livrocaixa/${uid}/${collection}`;
  const out = [];
  let pageToken = '';
  /* Trilha por página (só contagens/sinais — nunca token nem conteúdo):
     permite ler o diagnóstico no relatório sem expor dado algum. */
  const trilha = [];
  for (let guard = 0; guard < 20; guard++) {
    const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetchWithQuotaRetry(url, { headers: { Authorization: `Bearer ${idToken}` } });
    if (res.status === 404) return out; /* coleção inexistente = vazia */
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      const codigo = (() => { try { return JSON.parse(corpo)?.error?.message || ''; } catch { return ''; } })();
      throw new Error(
        `Falha ao listar ${collection}: HTTP ${res.status}${codigo ? ` (${codigo})` : ''}` +
        ` — trilha=${trilha.join('|') || 'vazia'}`
      );
    }
    const body = await res.json();
    const docs = body.documents || [];
    trilha.push(`p${guard + 1}:${docs.length}${body.nextPageToken ? 'T' : '-'}`);
    for (const doc of docs) {
      assertScoped(uid, doc.name);
      out.push({ path: doc.name, fields: decodeFields(doc.fields || {}) });
    }
    if (!body.nextPageToken) return out;
    /* Sem progresso: repetição de token ou página vazia com token indicam
       paginação patológica — parar cedo, com evidência, em vez de repetir 20×. */
    if (body.nextPageToken === pageToken) {
      throw new Error(
        `Falha ao listar ${collection}: token de paginação repetido após ${guard + 1} página(s)` +
        ` — trilha=${trilha.join('|')} — listagem inconclusiva, reset recusado`
      );
    }
    if (docs.length === 0) {
      throw new Error(
        `Falha ao listar ${collection}: página vazia com token após ${guard + 1} página(s)` +
        ` — trilha=${trilha.join('|')} — listagem inconclusiva, reset recusado`
      );
    }
    pageToken = body.nextPageToken;
  }
  /* Paginação estourada: nunca entregar lista incompleta como se fosse o
     conjunto real (senão o reset ficaria silenciosamente incompleto). */
  throw new Error(
    `Falha ao listar ${collection}: mais de 20 páginas de documentos` +
    ` — trilha=${trilha.join('|')} — reset incompleto recusado`
  );
}

/* Firestore REST tipa valores ({integerValue}|{doubleValue}|{stringValue}...) */
function decodeFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) out[k] = Number(v.doubleValue);
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else if (v.nullValue !== undefined) out[k] = null;
    else if (v.arrayValue) out[k] = (v.arrayValue.values || []).map((x) => decodeFields({ v: x }).v);
    else if (v.mapValue) out[k] = decodeFields(v.mapValue.fields || {});
    else out[k] = null;
  }
  return out;
}

async function deleteDoc(uid, idToken, projectId, docPath) {
  assertScoped(uid, docPath);
  const res = await fetchWithQuotaRetry(`https://firestore.googleapis.com/v1/${docPath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Falha ao excluir ${docPath}: HTTP ${res.status}`);
  return true;
}

/* Reset idempotente a partir de uma sessão já autenticada (uid da PRÓPRIA
   conta QA). Usado pelo cleanup final e pelo reset manual. */
async function resetWithSession(session) {
  const { uid, idToken, projectId } = session || {};
  if (!uid || !idToken || !projectId) {
    throw new Error('Recusado: sessão sem uid/idToken/projectId para cleanup');
  }
  const summary = { uid, deleted: 0, perCollection: {} };
  for (const col of COLLECTIONS) {
    const docs = await listCollection(uid, idToken, projectId, col);
    let n = 0;
    for (const doc of docs) {
      if (await deleteDoc(uid, idToken, projectId, doc.path)) n++;
    }
    summary.perCollection[col] = n;
    summary.deleted += n;
  }
  /* documento raiz (formato legado) — opcional, 404 é normal */
  const root = `livrocaixa/${uid}`;
  assertScoped(uid, root);
  const res = await fetchWithQuotaRetry(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${root}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.ok) summary.deleted += 1;
  return summary;
}

/* Reset idempotente: autentica com as credenciais e limpa o escopo delas. */
async function resetUser(creds) {
  const session = await signIn(creds.email, creds.password);
  return resetWithSession(session);
}

/* Exclusão da conta Auth criada pela própria run (FASE 6).
   Usa APENAS o idToken do próprio usuário QA — fonte: Identity Platform
   "accounts:delete" ("idToken ... required to be specified for requests from
   end users that lack Google OAuth 2.0 credential").
   Proibido por aqui: localId (exigiria credencial administrativa) e qualquer
   token/chave administrativa do Firebase. */
async function deleteOwnAccount(idToken) {
  if (!idToken) {
    throw new Error('Recusado: exclusão de conta exige o idToken do próprio usuário QA');
  }
  const { apiKey } = readFirebaseWebConfig();
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (res.status === 404) return false; /* conta já não existe */
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.message || String(res.status);
    throw new Error(`Falha ao excluir a conta Auth QA (HTTP ${res.status}: ${code})`);
  }
  return true;
}

async function signUpOrCreate(email, password) {
  const { apiKey, projectId } = readFirebaseWebConfig();
  const headers = { 'Content-Type': 'application/json' };
  let res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  let body = await res.json().catch(() => ({}));
  let how = 'criada';
  if (!res.ok) {
    const codigo = body?.error?.message || String(res.status);
    if (!codigo.includes('EMAIL_EXISTS')) {
      const err = new Error(`BLOCKED: cadastro REST da conta secundária falhou (${codigo})`);
      err.code = 'CODE_BLOCKED';
      err.reason = codigo;
      throw err;
    }
    res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const codigoLogin = body?.error?.message || String(res.status);
      const err = new Error(`BLOCKED: login REST da conta secundária falhou (${codigoLogin})`);
      err.code = 'CODE_BLOCKED';
      err.reason = codigoLogin;
      throw err;
    }
    how = 'existente';
  }
  return { uid: body.localId, idToken: body.idToken, email: body.email, projectId, how };
}

async function probeCrossAccount(uidAlvo, idTokenOutraConta, projectId) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const lista = `${base}/livrocaixa/${uidAlvo}/entries?pageSize=1`;
  const anonimo = await fetch(lista);
  await anonimo.arrayBuffer().catch(() => null);
  const alheio = await fetch(lista, { headers: { Authorization: `Bearer ${idTokenOutraConta}` } });
  await alheio.arrayBuffer().catch(() => null);
  const escrita = await fetch(`${base}/livrocaixa/${uidAlvo}/entries/prova-c.o.d.e-sonda`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idTokenOutraConta}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { origem: { stringValue: 'C.O.D.E.-auditoria-regras' } } }),
  });
  await escrita.arrayBuffer().catch(() => null);
  return { anonimo: anonimo.status, alheio: alheio.status, escrita: escrita.status };
}

module.exports = {
  COLLECTIONS,
  probeQuota,
  signIn,
  signUpOrCreate,
  probeCrossAccount,
  listCollection,
  deleteDoc,
  resetUser,
  resetWithSession,
  deleteOwnAccount,
  assertScoped,
  assertCollection,
  docPathOf,
  decodeFields,
};
