'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const STATE_DIR = path.join(REPO_ROOT, 'e2e', '.state');
const LOCK_PATH = path.join(STATE_DIR, 'checkout.lock');
const EXIT_LOCKED = 3;
const EXIT_IDENTITY = 4;
const CI_WORKFLOW_ID = '.github/workflows/code-e2e.yml';
const LOCAL_WORKFLOW_ID = 'local';

const RUN_ID_CI = /^\d+$/;
const RUN_ID_LOCAL = /^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RUN_ATTEMPT = /^[1-9]\d*$/;
const REQUIRED_LOCK_FIELDS = ['token', 'pid', 'runId', 'runAttempt', 'workflowId', 'acquiredAt'];

class LockError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LockError';
    this.exitCode = EXIT_LOCKED;
  }
}

class IdentityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IdentityError';
    this.exitCode = EXIT_IDENTITY;
  }
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateIdentity(identity) {
  if (!identity || typeof identity !== 'object') {
    throw new IdentityError('identidade de execução ausente');
  }
  const runId = str(identity.runId);
  if (!RUN_ID_CI.test(runId) && !RUN_ID_LOCAL.test(runId)) {
    throw new IdentityError('runId ausente ou malformado (esperado somente dígitos ou local-<uuid v4>)');
  }
  const rawAttempt =
    typeof identity.runAttempt === 'number' ? String(identity.runAttempt) : str(identity.runAttempt);
  if (!RUN_ATTEMPT.test(rawAttempt)) {
    throw new IdentityError('runAttempt ausente ou malformado (esperado inteiro positivo)');
  }
  const workflowId = str(identity.workflowId);
  if (!workflowId) {
    throw new IdentityError('workflowId ausente');
  }
  return { runId, runAttempt: Number(rawAttempt), workflowId };
}

function resolveExecutionIdentity(env = process.env) {
  const overrideRunId = str(env.CODE_EXECUTION_RUN_ID);
  const overrideAttempt = str(env.CODE_EXECUTION_RUN_ATTEMPT);
  const overrideWorkflow = str(env.CODE_EXECUTION_WORKFLOW_ID);
  const inCI = env.GITHUB_ACTIONS === 'true' || str(env.GITHUB_RUN_ID) !== '';

  if (inCI) {
    const runId = overrideRunId || str(env.GITHUB_RUN_ID);
    if (!RUN_ID_CI.test(runId)) {
      throw new IdentityError('runId de CI ausente ou malformado (esperado somente dígitos)');
    }
    const attempt = overrideAttempt || str(env.GITHUB_RUN_ATTEMPT);
    if (!RUN_ATTEMPT.test(attempt)) {
      throw new IdentityError('runAttempt de CI ausente ou malformado (esperado inteiro positivo)');
    }
    const workflowId = overrideWorkflow || CI_WORKFLOW_ID;
    return { mode: 'ci', runId, runAttempt: Number(attempt), workflowId };
  }

  const runId = overrideRunId || `local-${crypto.randomUUID()}`;
  if (!RUN_ID_CI.test(runId) && !RUN_ID_LOCAL.test(runId)) {
    throw new IdentityError('CODE_EXECUTION_RUN_ID malformado para execução local');
  }
  const attempt = overrideAttempt || '1';
  if (!RUN_ATTEMPT.test(attempt)) {
    throw new IdentityError('CODE_EXECUTION_RUN_ATTEMPT malformado (esperado inteiro positivo)');
  }
  const workflowId = overrideWorkflow || LOCAL_WORKFLOW_ID;
  return { mode: 'local', runId, runAttempt: Number(attempt), workflowId };
}

function assertStateDir(dir) {
  const st = fs.lstatSync(dir);
  if (st.isSymbolicLink()) {
    throw new LockError(`diretório de estado é symlink — recusado: ${dir}`);
  }
  if (!st.isDirectory()) {
    throw new LockError(`caminho de estado não é diretório — recusado: ${dir}`);
  }
}

function ensureStateDir(dir) {
  try {
    assertStateDir(dir);
    return;
  } catch (err) {
    if (err instanceof LockError) throw err;
    if (err.code !== 'ENOENT') {
      throw new LockError(`não foi possível inspecionar o diretório de estado: ${err.message}`);
    }
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    throw new LockError(`não foi possível criar o diretório de estado: ${err.message}`);
  }
  try {
    assertStateDir(dir);
  } catch (err) {
    if (err instanceof LockError) throw err;
    throw new LockError(`diretório de estado ilegível após criação: ${err.message}`);
  }
}

function readLockPayload(lockPath) {
  return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
}

function describeExistingLock(lockPath) {
  let st;
  try {
    st = fs.lstatSync(lockPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return new LockError('lock desapareceu durante a aquisição — recusado sem recuperação automática');
    }
    return new LockError(`lock ilegível — recusado: ${err.message}`);
  }
  if (st.isSymbolicLink()) {
    return new LockError(`lock é symlink — recusado e nunca removido: ${lockPath}`);
  }
  if (!st.isFile()) {
    return new LockError(`lock não é arquivo regular — recusado: ${lockPath}`);
  }
  let payload;
  try {
    payload = readLockPayload(lockPath);
  } catch {
    return new LockError('lock inválido (JSON ilegível) — recusado; recuperação manual necessária');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return new LockError('lock inválido (payload não é objeto) — recusado; recuperação manual necessária');
  }
  for (const field of REQUIRED_LOCK_FIELDS) {
    const value = payload[field];
    const numeric = field === 'pid' || field === 'runAttempt';
    const ok = numeric
      ? Number.isInteger(value) && value > 0
      : typeof value === 'string' && value !== '';
    if (!ok) {
      return new LockError(`lock inválido (campo ${field} ausente ou malformado) — recusado; recuperação manual necessária`);
    }
  }
  let alive = true;
  try {
    process.kill(payload.pid, 0);
  } catch (err) {
    alive = err.code === 'EPERM';
  }
  if (alive) {
    return new LockError(`lock ativo (pid ${payload.pid}, runId ${payload.runId}) — segunda execução recusada`);
  }
  return new LockError(
    `lock órfão (pid ${payload.pid} sem processo) — não removido; recuperação manual necessária`
  );
}

let heldHandle = null;

function acquireLock(identity, options = {}) {
  const ident = validateIdentity(identity);
  if (heldHandle) {
    throw new LockError('reentrância recusada — este processo já detém o lock deste checkout');
  }
  const lockPath = str(options.lockPath) || LOCK_PATH;
  ensureStateDir(path.dirname(lockPath));

  const payload = {
    token: crypto.randomUUID(),
    pid: process.pid,
    runId: ident.runId,
    runAttempt: ident.runAttempt,
    workflowId: ident.workflowId,
    acquiredAt: new Date().toISOString(),
  };

  try {
    fs.writeFileSync(lockPath, JSON.stringify(payload) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (err) {
    if (err.code === 'EEXIST') throw describeExistingLock(lockPath);
    throw new LockError(`não foi possível criar o lock: ${err.message}`);
  }

  let st;
  try {
    st = fs.lstatSync(lockPath);
  } catch (err) {
    throw new LockError(`lock não pôde ser verificado após criação: ${err.message}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new LockError('lock substituído por arquivo inválido logo após a criação — recusado');
  }
  let readBack;
  try {
    readBack = readLockPayload(lockPath);
  } catch (err) {
    throw new LockError(`lock ilegível após criação: ${err.message}`);
  }
  if (!readBack || readBack.token !== payload.token) {
    throw new LockError('lock substituído por terceiro durante a aquisição — recusado');
  }

  heldHandle = {
    lockPath,
    token: payload.token,
    ino: st.ino,
    dev: st.dev,
    runId: payload.runId,
    acquiredAt: payload.acquiredAt,
  };
  return heldHandle;
}

function releaseLock(handle) {
  if (!handle || typeof handle !== 'object' || handle !== heldHandle) {
    throw new LockError('liberação recusada — o lock informado não é o mantido por este processo');
  }
  heldHandle = null;
  const lockPath = handle.lockPath;

  let st;
  try {
    st = fs.lstatSync(lockPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new LockError('lock não existe mais — nada foi liberado (estado inconsistente)');
    }
    throw new LockError(`lock ilegível na liberação — não removido: ${err.message}`);
  }
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new LockError('lock substituído por arquivo inválido — não removido');
  }
  let payload;
  try {
    payload = readLockPayload(lockPath);
  } catch {
    throw new LockError('lock corrompido — não removido');
  }
  if (!payload || payload.token !== handle.token || st.ino !== handle.ino || st.dev !== handle.dev) {
    throw new LockError('lock não pertence mais a esta execução (token/inode divergentes) — não removido');
  }
  fs.unlinkSync(lockPath);
  return true;
}

module.exports = {
  REPO_ROOT,
  STATE_DIR,
  LOCK_PATH,
  EXIT_LOCKED,
  EXIT_IDENTITY,
  LockError,
  IdentityError,
  validateIdentity,
  resolveExecutionIdentity,
  acquireLock,
  releaseLock,
};
