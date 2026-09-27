/* C.O.D.E. — identidade QA efêmera por execução (FASE 1, 4, 10, 11).
   Regras:
     - cada run gera e-mail/senha próprios (nunca conta compartilhada);
     - a senha existe SOMENTE em process.env (memória dos processos da run)
       — este arquivo nunca grava nem lê senha;
     - o arquivo de metadados guarda runId, e-mail, UID e propriedade
       (createdByCode) — sem segredo algum;
     - só conta com createdByCode === true pode ser excluída (FASE 6). */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('./env');

const IDENTITY_PATH = path.join(config.root, 'e2e', '.state', 'qa-identity.json');
const SUMMARY_PATH = path.join(config.root, 'e2e', '.state', 'qa-summary.json');

function ensureDir(p) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

/* Identificador rastreável da run, sem segredo (GitHub run id ou local). */
function newRunId() {
  if (process.env.GITHUB_RUN_ID) {
    const attempt = process.env.GITHUB_RUN_ATTEMPT ? `-a${process.env.GITHUB_RUN_ATTEMPT}` : '';
    return `gh${process.env.GITHUB_RUN_ID}${attempt}`;
  }
  return `loc${Date.now().toString(36)}`;
}

/* Credenciais efêmeras: devolvidas em memória; o chamador injeta em
   process.env. Senha forte e aleatória (18 bytes ~ 24 caracteres). */
function generate() {
  const runId = newRunId();
  const suffix = crypto.randomBytes(3).toString('hex');
  const email = `code-qa-${runId}-${suffix}@livrocaixa.test`;
  const password = `Q${crypto.randomBytes(18).toString('base64url')}`;
  return { runId, email, password, mode: 'ephemeral' };
}

function load() {
  try {
    if (!fs.existsSync(IDENTITY_PATH)) return null;
    return JSON.parse(fs.readFileSync(IDENTITY_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/* Campos que NUNCA podem ser persistidos em disco (FASE 1/12): a senha e
   qualquer token vivem só em process.env/memória. O scrub é profundo e
   defensivo — gravar segredo aqui seria um vazamento silencioso. */
const SENSITIVE_KEY = /^(password|senha|idtoken|accesstoken|refreshtoken|apikey|key|secret|credential|token)$/i;
function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}

function save(meta) {
  ensureDir(IDENTITY_PATH);
  const safe = scrub(meta);
  fs.writeFileSync(IDENTITY_PATH, JSON.stringify(safe, null, 2) + '\n', { mode: 0o600 });
  return safe;
}

/* Mescla campos na identidade atual (cria base mínima se não houver). */
function patch(partial) {
  const current =
    load() || {
      runId: newRunId(),
      mode: process.env.CODE_TEST_MODE || 'unknown',
      email: process.env.CODE_TEST_EMAIL || null,
      createdByCode: false,
      state: 'unknown',
      createdAt: new Date().toISOString(),
    };
  const next = { ...current, ...partial, updatedAt: new Date().toISOString() };
  return save(next);
}

function clear() {
  try {
    if (fs.existsSync(IDENTITY_PATH)) fs.unlinkSync(IDENTITY_PATH);
  } catch {
    /* falha ao remover metadados não pode derrubar a run */
  }
}

function writeSummary(summary) {
  ensureDir(SUMMARY_PATH);
  const safe = scrub(summary);
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(safe, null, 2) + '\n', { mode: 0o600 });
  return safe;
}

function readSummary() {
  try {
    if (!fs.existsSync(SUMMARY_PATH)) return null;
    return JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/* ---- mascaramentos (relatório nunca mostra identidade completa) ---- */
function maskEmail(email) {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 0) return '***';
  const local = e.slice(0, at);
  const domain = e.slice(at);
  const keep = local.slice(0, Math.min(8, Math.max(3, local.length - 6)));
  return `${keep}***${domain}`;
}

function maskUid(uid) {
  const u = String(uid || '');
  if (!u) return 'n/d';
  if (u.length <= 8) return `${u.slice(0, 2)}***`;
  return `${u.slice(0, 4)}…${u.slice(-4)}`;
}

/* ---- guardas de propriedade (FASE 4/6) ----
   Exclusão de conta só com prova de que ESTA run a criou e que a sessão
   corresponde exatamente à identidade registrada. Nenhuma heurística. */
function canDeleteIdentity(identity, session) {
  if (!identity || !identity.email) {
    return { ok: false, reason: 'sem metadado de identidade desta run' };
  }
  if (identity.createdByCode !== true) {
    return { ok: false, reason: 'conta preexistente — não criada por esta run' };
  }
  if (!session || !session.uid) {
    return { ok: false, reason: 'UID da sessão ausente' };
  }
  const mail = String(session.email || '').toLowerCase();
  if (mail !== String(identity.email).toLowerCase()) {
    return { ok: false, reason: 'e-mail da sessão não corresponde à identidade da run' };
  }
  if (identity.uid && String(identity.uid) !== String(session.uid)) {
    return { ok: false, reason: 'UID da sessão não corresponde ao registrado na run' };
  }
  return { ok: true, reason: 'conta criada por esta run e sessão confirmada' };
}

/* ---- plano de cleanup (FASE 7/11) — puro, testável sem rede ---- */
function planCleanup(identity, session) {
  const base = { firestore: 'SKIP', auth: 'SKIP', severity: null, reason: '' };

  if (!identity) {
    return { ...base, reason: 'sem identidade QA nesta run' };
  }
  if (!session || session.ok === false) {
    const why = (session && session.reason) || 'sessão indisponível';
    if (identity.createdByCode === true) {
      /* a conta foi criada e agora não há como autenticar: sobras possíveis */
      return {
        ...base,
        severity: 'BLOCKED',
        reason: `conta criada por esta run mas sessão indisponível (${why}) — Auth e Firestore não puderam ser limpos`,
      };
    }
    return { ...base, reason: `conta não criada nesta run (${why})` };
  }

  const own = canDeleteIdentity(identity, session);
  if (own.ok) {
    return { firestore: 'RUN', auth: 'RUN', severity: null, reason: own.reason };
  }
  if (identity.createdByCode === true) {
    /* diz ter criado a conta, mas a sessão não confere: inconsistência —
       não se toca em nada e o bloqueio fica visível. */
    return { firestore: 'SKIP', auth: 'SKIP', severity: 'BLOCKED', reason: own.reason };
  }
  return { firestore: 'RUN', auth: 'SKIP', severity: null, reason: own.reason };
}

module.exports = {
  IDENTITY_PATH,
  SUMMARY_PATH,
  newRunId,
  generate,
  load,
  save,
  patch,
  clear,
  writeSummary,
  readSummary,
  maskEmail,
  maskUid,
  canDeleteIdentity,
  planCleanup,
};
