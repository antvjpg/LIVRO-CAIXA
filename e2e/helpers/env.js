/* C.O.D.E. — resolução de configuração e credenciais QA.
   Prioridade: process.env (identidade efêmera injetada pelo global-setup, ou
   variável explícita) → e2e/.env.local (fallback manual, gitignored).
   NUNCA imprime senha; NUNCA grava credencial em arquivo (a senha efêmera
   vive apenas na memória dos processos da run). */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const ENV_LOCAL = path.join(ROOT, 'e2e', '.env.local');
const ENV_EXAMPLE = path.join(ROOT, 'e2e', '.env.example');

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = parseEnvFile(ENV_LOCAL);

function env(name, fallback = undefined) {
  const v = process.env[name] !== undefined && process.env[name] !== '' ? process.env[name] : fileEnv[name];
  return v === undefined || v === '' ? fallback : v;
}

/* Motivo pelo qual as credenciais foram recusadas (para o relatório dizer o
   PORQUÊ em vez de "credenciais ausentes"). */
let guardReason = null;

/* Guarda de identificação da conta QA (exigência declarada em .env.example):
   o C.O.D.E. só pode rodar testes de ESCRITA numa conta declarada como QA,
   senão um reset/cleanup apagaria os dados reais do usuário. Aceito:
     - e-mail iniciado por "code-qa-" (autogerado pelo próprio C.O.D.E.), ou
     - domínio em CODE_TEST_EMAIL_DOMAINS (padrão: livrocaixa.test).
   Override explícito e deliberado: CODE_TEST_ALLOW_ANY_EMAIL=1. */
function isQaEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !e.includes('@')) return false;
  if (env('CODE_TEST_ALLOW_ANY_EMAIL') === '1') return true;
  const [localPart, domain] = e.split('@');
  if (/^code-qa[-.]/.test(localPart)) return true;
  const domains = (env('CODE_TEST_EMAIL_DOMAINS') || 'livrocaixa.test')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return domains.includes(domain);
}

const config = {
  root: ROOT,
  baseURL: env('CODE_BASE_URL', 'http://127.0.0.1:8000'),
  projectId: env('CODE_FIRESTORE_PROJECT', 'livro-caixa-54357'),
  statePath: path.join(ROOT, 'e2e', '.state', 'qa-session.json'),
  reportsDir: path.join(ROOT, 'e2e', 'reports'),
  envLocalPath: ENV_LOCAL,
  inCI: !!process.env.CI,
};

/* Credenciais QA (FASE 3 — sem segredo permanente):
     1. identidade efêmera injetada pelo global-setup em process.env
        (modo ephemeral — caminho padrão, inclusive no CI);
     2. CODE_TEST_EMAIL/CODE_TEST_PASSWORD explícitos (fallback manual;
        conta preexistente — nunca será excluída pelo C.O.D.E.);
     3. e2e/.env.local (mesmo fallback, fora do Git).
   Sem nenhuma das três → null com motivo claro (nada de segredo em CI). */
function resolveCredentials() {
  guardReason = null;
  const email = env('CODE_TEST_EMAIL');
  const password = env('CODE_TEST_PASSWORD');
  if (email && password) {
    if (!isQaEmail(email)) {
      guardReason =
        `e-mail declarado não é uma conta QA: "${email}". Use um e-mail iniciado por "code-qa-", ` +
        'um domínio de CODE_TEST_EMAIL_DOMAINS (padrão livrocaixa.test) ou, se for intencional, ' +
        'defina CODE_TEST_ALLOW_ANY_EMAIL=1.';
      return null;
    }
    const source =
      process.env.CODE_TEST_MODE === 'ephemeral'
        ? 'ephemeral'
        : process.env.CODE_TEST_EMAIL
          ? 'env'
          : 'env.local';
    return { email, password, source };
  }
  if (env('CODE_TEST_AUTO_PROVISION') === '0') {
    guardReason = 'CODE_TEST_AUTO_PROVISION=0 e nenhuma credencial informada.';
    return null;
  }
  guardReason =
    'nenhuma credencial disponível — a identidade efêmera é criada pelo global-setup ' +
    '(execute via "npm run code:test") ou informe CODE_TEST_EMAIL/CODE_TEST_PASSWORD.';
  return null;
}

function guardReasonText() {
  return guardReason;
}

function assertQaCredentials(creds) {
  if (!creds || !creds.email || !creds.password) {
    const err = new Error(
      `BLOCKED: credenciais QA indisponíveis${guardReason ? ` (${guardReason})` : ''}. ` +
        'Defina CODE_TEST_EMAIL/CODE_TEST_PASSWORD ' +
        `(via ambiente ou ${path.relative(ROOT, ENV_LOCAL)}) — ver e2e/.env.example.`
    );
    err.code = 'CODE_BLOCKED';
    throw err;
  }
  return creds;
}

module.exports = { env, config, resolveCredentials, assertQaCredentials, guardReasonText, isQaEmail, parseEnvFile, ENV_EXAMPLE };
