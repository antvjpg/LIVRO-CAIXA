import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WRAPPER = path.join(ROOT, 'e2e', 'scripts', 'run-code.cjs');
const LOCKMOD = path.join(ROOT, 'e2e', 'scripts', 'run-code-lock.cjs');
const IDENTITY = path.join(ROOT, 'e2e', 'helpers', 'identity.cjs');
const ENVCJS = path.join(ROOT, 'e2e', 'helpers', 'env.cjs');
const SETUP = path.join(ROOT, 'e2e', 'helpers', 'global-setup.cjs');
const CLEANUP = path.join(ROOT, 'e2e', 'helpers', 'cleanup.cjs');
const LOCK_PATH = path.join(ROOT, 'e2e', '.state', 'checkout.lock');
const LOCAL_RUN_ID = 'local-11111111-1111-4111-8111-111111111111';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TEMPS = [];

function makeTemp(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `codewrap-${label}-`));
  TEMPS.push(dir);
  return dir;
}

function makeFakeBin() {
  const dir = makeTemp('bin');
  const npx = path.join(dir, 'npx');
  fs.writeFileSync(
    npx,
    '#!/bin/sh\n' +
      'echo "ARGS: $*" >> "${FAKE_NPX_MARKER:-/dev/null}"\n' +
      "env | grep '^CODE_EXECUTION_' | sort >> \"${FAKE_NPX_MARKER:-/dev/null}\"\n" +
      'exit "${FAKE_NPX_EXIT:-0}"\n'
  );
  fs.chmodSync(npx, 0o755);
  const node = path.join(dir, 'node');
  fs.writeFileSync(
    node,
    '#!/bin/sh\n' +
      'echo "ARGS: $*" >> "${FAKE_NODE_MARKER:-/dev/null}"\n' +
      "env | grep '^CODE_EXECUTION_' | sort >> \"${FAKE_NODE_MARKER:-/dev/null}\"\n" +
      'exit "${FAKE_NODE_EXIT:-0}"\n'
  );
  fs.chmodSync(node, 0o755);
  return dir;
}

function wrapperEnv(fakeDir, extra = {}) {
  const env = { ...process.env };
  for (const key of [
    'GITHUB_ACTIONS',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'CODE_EXECUTION_RUN_ID',
    'CODE_EXECUTION_RUN_ATTEMPT',
    'CODE_EXECUTION_WORKFLOW_ID',
    'CODE_TEST_EMAIL',
    'CODE_TEST_PASSWORD',
    'CODE_TEST_MODE',
  ]) {
    delete env[key];
  }
  if (fakeDir) env.PATH = `${fakeDir}:${env.PATH}`;
  Object.assign(env, extra);
  return env;
}

function childEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of [
    'GITHUB_ACTIONS',
    'GITHUB_RUN_ID',
    'GITHUB_RUN_ATTEMPT',
    'CODE_EXECUTION_RUN_ID',
    'CODE_EXECUTION_RUN_ATTEMPT',
    'CODE_EXECUTION_WORKFLOW_ID',
    'CODE_TEST_EMAIL',
    'CODE_TEST_PASSWORD',
    'CODE_TEST_MODE',
  ]) {
    delete env[key];
  }
  Object.assign(env, extra);
  return env;
}

function runWrapper(args, env, opts = {}) {
  return spawnSync(process.execPath, [WRAPPER, ...args], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: opts.timeout ?? 20000,
  });
}

function runChild(script, env, opts = {}) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: opts.timeout ?? 20000,
  });
}

async function waitFor(cond, ms = 8000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor: condição não alcançada');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function waitExit(child) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

function payload(overrides = {}) {
  return {
    token: '11111111-1111-4111-8111-111111111111',
    pid: process.pid,
    runId: '99887',
    runAttempt: 1,
    workflowId: '.github/workflows/code-e2e.yml',
    acquiredAt: new Date().toISOString(),
    ...overrides,
  };
}

before(() => {
  if (fs.existsSync(LOCK_PATH)) {
    throw new Error(`lock pré-existente em ${LOCK_PATH} — recuperação manual necessária antes de rodar a suíte`);
  }
});

after(() => {
  for (const dir of TEMPS) fs.rmSync(dir, { recursive: true, force: true });
});

test('identidade local: runId local-<uuid v4>, tentativa 1, workflow local', () => {
  const fake = makeFakeBin();
  const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], wrapperEnv(fake));
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /\[C\.O\.D\.E\.\] execução runId=local-[0-9a-f-]+ tentativa=1 workflow=local/);
  const runId = /runId=(local-[0-9a-f-]+) /.exec(res.stdout)?.[1];
  assert.ok(runId && UUID_RE.test(runId.slice('local-'.length)), `runId inválido: ${runId}`);
});

test('identidade CI: runId de dígitos, tentativa do GITHUB_RUN_ATTEMPT, workflow do CI', () => {
  const fake = makeFakeBin();
  const env = wrapperEnv(fake, {
    GITHUB_ACTIONS: 'true',
    GITHUB_RUN_ID: '12345',
    GITHUB_RUN_ATTEMPT: '2',
  });
  const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], env);
  assert.equal(res.status, 0, res.stderr);
  assert.match(
    res.stdout,
    /\[C\.O\.D\.E\.\] execução runId=12345 tentativa=2 workflow=\.github\/workflows\/code-e2e\.yml/
  );
});

test('override CODE_EXECUTION_RUN_ID/RUN_ATTEMPT tem prioridade sobre GITHUB_*', () => {
  const fake = makeFakeBin();
  const env = wrapperEnv(fake, {
    GITHUB_ACTIONS: 'true',
    GITHUB_RUN_ID: '12345',
    GITHUB_RUN_ATTEMPT: '2',
    CODE_EXECUTION_RUN_ID: '777',
    CODE_EXECUTION_RUN_ATTEMPT: '1',
  });
  const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], env);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /runId=777 tentativa=1 workflow=\.github\/workflows\/code-e2e\.yml/);
});

test('CI sem GITHUB_RUN_ATTEMPT válido é recusado com exit 4', () => {
  const fake = makeFakeBin();
  const env = wrapperEnv(fake, { GITHUB_ACTIONS: 'true', GITHUB_RUN_ID: '12345' });
  const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], env);
  assert.equal(res.status, 4);
  assert.match(res.stderr, /runAttempt de CI ausente ou malformado/);
});

test('CODE_EXECUTION_RUN_ID local malformado é recusado com exit 4', () => {
  const fake = makeFakeBin();
  const res = runWrapper(
    ['--code-lock-only', '--', 'sh', '-c', 'exit 0'],
    wrapperEnv(fake, { CODE_EXECUTION_RUN_ID: 'abc' })
  );
  assert.equal(res.status, 4);
  assert.match(res.stderr, /CODE_EXECUTION_RUN_ID malformado para execução local/);
});

test('CODE_EXECUTION_RUN_ATTEMPT malformado é recusado com exit 4', () => {
  const fake = makeFakeBin();
  const res = runWrapper(
    ['--code-lock-only', '--', 'sh', '-c', 'exit 0'],
    wrapperEnv(fake, { CODE_EXECUTION_RUN_ATTEMPT: '0' })
  );
  assert.equal(res.status, 4);
  assert.match(res.stderr, /CODE_EXECUTION_RUN_ATTEMPT malformado/);
});

test('uso: --code-lock-only sem comando após -- sai com exit 4', () => {
  const res = runWrapper(['--code-lock-only'], wrapperEnv(null));
  assert.equal(res.status, 4);
  assert.match(res.stderr, /exige comando após --/);
});

test('uso: flag --code-* desconhecida sai com exit 4', () => {
  const res = runWrapper(['--code-foo'], wrapperEnv(null));
  assert.equal(res.status, 4);
  assert.match(res.stderr, /flag desconhecida: --code-foo/);
});

test('uso: --code-lock-only não aceita argumentos antes de --', () => {
  const res = runWrapper(
    ['--code-lock-only', '--project=smoke', '--', 'sh', '-c', 'exit 0'],
    wrapperEnv(null)
  );
  assert.equal(res.status, 4);
  assert.match(res.stderr, /não aceita argumentos antes de --/);
});

test('uso: --code-lock-only não combina com flags de relatório', () => {
  const res = runWrapper(
    ['--code-lock-only', '--code-report', '--', 'sh', '-c', 'exit 0'],
    wrapperEnv(null)
  );
  assert.equal(res.status, 4);
  assert.match(res.stderr, /exclusivo e não combina com flags de relatório/);
});

test('modo A: passa args do Playwright, injeta CODE_EXECUTION_* e libera o lock', () => {
  const fake = makeFakeBin();
  const npxMarker = path.join(fake, 'npx.marker');
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--config', 'playwright.config.cjs', '--project=smoke'],
    wrapperEnv(fake, { FAKE_NPX_MARKER: npxMarker, FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /runId=local-/);
  const npx = fs.readFileSync(npxMarker, 'utf8');
  assert.ok(npx.includes('ARGS: playwright test --config playwright.config.cjs --project=smoke'), npx);
  assert.match(npx, /CODE_EXECUTION_RUN_ID=local-/);
  assert.match(npx, /CODE_EXECUTION_RUN_ATTEMPT=1/);
  assert.match(npx, /CODE_EXECUTION_WORKFLOW_ID=local/);
  assert.ok(!fs.existsSync(nodeMarker), 'gerador não deve rodar sem flags de relatório');
  assert.ok(!fs.existsSync(LOCK_PATH), 'lock deve ser liberado após a execução');
});

test('modo A: falha do Playwright com --code-report-on-failure executa diagnósticos e mantém exit 3', () => {
  const fake = makeFakeBin();
  const npxMarker = path.join(fake, 'npx.marker');
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-report', '--code-report-strict', '--code-report-on-failure'],
    wrapperEnv(fake, {
      FAKE_NPX_MARKER: npxMarker,
      FAKE_NPX_EXIT: '3',
      FAKE_NODE_MARKER: nodeMarker,
      FAKE_NODE_EXIT: '5',
    })
  );
  assert.equal(res.status, 3, res.stderr);
  assert.ok(fs.existsSync(npxMarker), 'Playwright deve ter rodado');
  assert.ok(fs.existsSync(nodeMarker), 'diagnósticos devem rodar com onFailure');
  const onFailureLines = fs
    .readFileSync(nodeMarker, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('ARGS:'));
  assert.deepEqual(onFailureLines, ['ARGS: e2e/reports/generate-report.cjs --strict']);
  assert.ok(!fs.existsSync(LOCK_PATH));
});

test('modo A: falha do Playwright sem onFailure não executa diagnósticos', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-report', '--code-report-strict'],
    wrapperEnv(fake, { FAKE_NPX_EXIT: '3', FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 3, res.stderr);
  assert.ok(!fs.existsSync(nodeMarker), 'diagnósticos não devem rodar sem onFailure nem exit 0');
});

test('modo A: sucesso sem flags de relatório não executa o gerador', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper([], wrapperEnv(fake, { FAKE_NODE_MARKER: nodeMarker }));
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(nodeMarker));
});

test('modo A: --code-report sozinho gera uma invocação sem --strict', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-report'],
    wrapperEnv(fake, { FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  const lines = fs
    .readFileSync(nodeMarker, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('ARGS:'));
  assert.deepEqual(lines, ['ARGS: e2e/reports/generate-report.cjs']);
});

test('modo A: --code-report-strict sozinho gera uma invocação com --strict', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-report-strict'],
    wrapperEnv(fake, { FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  const lines = fs
    .readFileSync(nodeMarker, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('ARGS:'));
  assert.deepEqual(lines, ['ARGS: e2e/reports/generate-report.cjs --strict']);
});

test('modo A: --code-report e --code-report-strict juntos geram uma única invocação estrita', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-report', '--code-report-strict'],
    wrapperEnv(fake, { FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  const lines = fs
    .readFileSync(nodeMarker, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('ARGS:'));
  assert.deepEqual(lines, ['ARGS: e2e/reports/generate-report.cjs --strict']);
});

test('modo A: exit do diagnóstico propaga quando o Playwright passou', () => {
  const fake = makeFakeBin();
  const res = runWrapper(
    ['--code-report'],
    wrapperEnv(fake, { FAKE_NODE_MARKER: path.join(fake, 'node.marker'), FAKE_NODE_EXIT: '2' })
  );
  assert.equal(res.status, 2, res.stderr);
});

test('modo A: exit do Playwright tem precedência sobre o do diagnóstico', () => {
  const fake = makeFakeBin();
  const res = runWrapper(
    ['--code-report', '--code-report-on-failure'],
    wrapperEnv(fake, {
      FAKE_NPX_MARKER: path.join(fake, 'npx.marker'),
      FAKE_NPX_EXIT: '7',
      FAKE_NODE_MARKER: path.join(fake, 'node.marker'),
      FAKE_NODE_EXIT: '2',
    })
  );
  assert.equal(res.status, 7, res.stderr);
});

test('modo A: npx indisponível resulta em exit 127', () => {
  const empty = makeTemp('empty-path');
  const res = runWrapper([], wrapperEnv(null, { PATH: empty }));
  assert.equal(res.status, 127);
});

test('modo B: exit 0 do comando é repassado e o Playwright não roda', () => {
  const fake = makeFakeBin();
  const npxMarker = path.join(fake, 'npx.marker');
  const res = runWrapper(
    ['--code-lock-only', '--', 'sh', '-c', 'exit 0'],
    wrapperEnv(fake, { FAKE_NPX_MARKER: npxMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  assert.ok(!fs.existsSync(npxMarker), 'modo B não deve invocar npx');
  assert.ok(!fs.existsSync(LOCK_PATH));
});

test('modo B: exit diferente de zero do comando é repassado', () => {
  const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 5'], wrapperEnv(null));
  assert.equal(res.status, 5);
});

test('modo B: comando node é interceptado com args e CODE_EXECUTION_* no ambiente', () => {
  const fake = makeFakeBin();
  const nodeMarker = path.join(fake, 'node.marker');
  const res = runWrapper(
    ['--code-lock-only', '--', 'node', '-e', 'process.exit(0)'],
    wrapperEnv(fake, { FAKE_NODE_MARKER: nodeMarker })
  );
  assert.equal(res.status, 0, res.stderr);
  const content = fs.readFileSync(nodeMarker, 'utf8');
  assert.ok(content.includes('ARGS: -e process.exit(0)'), content);
  assert.match(content, /CODE_EXECUTION_RUN_ID=local-/);
  assert.match(content, /CODE_EXECUTION_RUN_ATTEMPT=1/);
  assert.match(content, /CODE_EXECUTION_WORKFLOW_ID=local/);
});

test('lock: recusa lock ativo com exit 3 e não altera o arquivo', () => {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  const written = JSON.stringify(payload()) + '\n';
  fs.writeFileSync(LOCK_PATH, written, { mode: 0o600 });
  try {
    const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], wrapperEnv(null));
    assert.equal(res.status, 3);
    assert.match(res.stderr, /lock ativo \(pid /);
    assert.equal(fs.readFileSync(LOCK_PATH, 'utf8'), written, 'lock ativo não pode ser modificado');
  } finally {
    fs.rmSync(LOCK_PATH, { force: true });
  }
});

test('lock: recusa lock órfão com exit 3 e não remove o arquivo', () => {
  const dead = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' });
  assert.ok(Number.isInteger(dead.pid));
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true });
  const written = JSON.stringify(payload({ pid: dead.pid })) + '\n';
  fs.writeFileSync(LOCK_PATH, written, { mode: 0o600 });
  try {
    const res = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], wrapperEnv(null));
    assert.equal(res.status, 3);
    assert.match(res.stderr, /lock órfão/);
    assert.ok(fs.existsSync(LOCK_PATH), 'lock órfão não pode ser removido automaticamente');
    assert.equal(fs.readFileSync(LOCK_PATH, 'utf8'), written);
  } finally {
    fs.rmSync(LOCK_PATH, { force: true });
  }
});

test('concorrência: segundo modo B é recusado enquanto o primeiro detém o lock', async () => {
  const fake = makeFakeBin();
  const env = wrapperEnv(fake);
  const first = spawn(
    process.execPath,
    [WRAPPER, '--code-lock-only', '--', 'sh', '-c', 'sleep 2'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const firstDone = waitExit(first);
  await waitFor(() => fs.existsSync(LOCK_PATH));
  const second = runWrapper(['--code-lock-only', '--', 'sh', '-c', 'exit 0'], env);
  assert.equal(second.status, 3, second.stderr);
  assert.match(second.stderr, /lock ativo \(pid /);
  const firstResult = await firstDone;
  assert.equal(firstResult.code, 0, firstResult.err);
  await waitFor(() => !fs.existsSync(LOCK_PATH));
});

test('concorrência: modo A durante lock ativo sai 3 sem invocar o Playwright', async () => {
  const fake = makeFakeBin();
  const npxMarker = path.join(fake, 'npx.marker');
  const env = wrapperEnv(fake, { FAKE_NPX_MARKER: npxMarker });
  const first = spawn(
    process.execPath,
    [WRAPPER, '--code-lock-only', '--', 'sh', '-c', 'sleep 2'],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const firstDone = waitExit(first);
  await waitFor(() => fs.existsSync(LOCK_PATH));
  const second = runWrapper(['--project=smoke'], env);
  assert.equal(second.status, 3, second.stderr);
  assert.match(second.stderr, /lock ativo \(pid /);
  assert.ok(!fs.existsSync(npxMarker), 'Playwright não pode rodar sob lock recusado');
  const firstResult = await firstDone;
  assert.equal(firstResult.code, 0, firstResult.err);
  await waitFor(() => !fs.existsSync(LOCK_PATH));
});

test('lock: diretório .state como symlink é recusado com exit 3', () => {
  const tmp = makeTemp('symlink');
  const repo = path.join(tmp, 'repo');
  fs.mkdirSync(path.join(repo, 'e2e', 'scripts'), { recursive: true });
  fs.copyFileSync(LOCKMOD, path.join(repo, 'e2e', 'scripts', 'run-code-lock.cjs'));
  const realState = path.join(tmp, 'real-state');
  fs.mkdirSync(realState);
  fs.symlinkSync(realState, path.join(repo, 'e2e', '.state'));
  const script = `
    const m = require(${JSON.stringify(path.join(repo, 'e2e', 'scripts', 'run-code-lock.cjs'))});
    const id = { runId: ${JSON.stringify(LOCAL_RUN_ID)}, runAttempt: 1, workflowId: 'local' };
    try {
      m.acquireLock(id);
      console.log('NAO-RECUSOU');
      process.exit(9);
    } catch (e) {
      console.log(e.name + ':' + e.message);
      process.exit(e.exitCode || 1);
    }
  `;
  const res = runChild(script, childEnv());
  assert.equal(res.status, 3, res.stdout + res.stderr);
  assert.match(res.stdout, /symlink/);
  assert.ok(!fs.existsSync(path.join(realState, 'checkout.lock')));
});

test('lock: reentrância e liberação alheia são recusadas; liberação própria remove o arquivo', () => {
  const tmp = makeTemp('reentrancy');
  const lockPath = path.join(tmp, 'checkout.lock');
  const script = `
    const fs = require('fs');
    const m = require(${JSON.stringify(LOCKMOD)});
    const id = { runId: ${JSON.stringify(LOCAL_RUN_ID)}, runAttempt: 1, workflowId: 'local' };
    const lockPath = ${JSON.stringify(lockPath)};
    let h;
    try {
      h = m.acquireLock(id, { lockPath });
    } catch (e) {
      console.log('A:' + e.name + ':' + e.message);
      process.exit(1);
    }
    try {
      m.acquireLock(id, { lockPath });
      console.log('REENTRANCIA-NAO-RECUSOU');
      process.exit(2);
    } catch (e) {
      if (e.name !== 'LockError' || !/reentrância/.test(e.message)) {
        console.log('B:' + e.name + ':' + e.message);
        process.exit(3);
      }
    }
    try {
      m.releaseLock({ ...h });
      console.log('RELEASE-ALHEIO-NAO-RECUSOU');
      process.exit(4);
    } catch (e) {
      if (!/liberação recusada/.test(e.message)) {
        console.log('C:' + e.name + ':' + e.message);
        process.exit(5);
      }
    }
    if (!fs.existsSync(lockPath)) {
      console.log('LOCK-REMOVIDO-PELO-ALHEIO');
      process.exit(6);
    }
    try {
      m.releaseLock(h);
    } catch (e) {
      console.log('D:' + e.name + ':' + e.message);
      process.exit(7);
    }
    if (fs.existsSync(lockPath)) {
      console.log('LOCK-NAO-LIBERADO');
      process.exit(8);
    }
    console.log('OK');
  `;
  const res = runChild(script, childEnv());
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /OK/);
  assert.ok(!fs.existsSync(lockPath));
});

test('lock: validateIdentity normaliza e rejeita identidades malformadas', () => {
  const lock = require(LOCKMOD);
  const ok = lock.validateIdentity({ runId: LOCAL_RUN_ID, runAttempt: '2', workflowId: 'local' });
  assert.deepEqual(ok, { runId: LOCAL_RUN_ID, runAttempt: 2, workflowId: 'local' });
  const ci = lock.validateIdentity({ runId: '99887', runAttempt: 1, workflowId: 'x' });
  assert.equal(ci.runId, '99887');
  assert.throws(() => lock.validateIdentity({ runId: 'gh1', runAttempt: 1, workflowId: 'x' }), lock.IdentityError);
  assert.throws(() => lock.validateIdentity({ runId: LOCAL_RUN_ID, runAttempt: 0, workflowId: 'x' }), lock.IdentityError);
  assert.throws(() => lock.validateIdentity({ runId: LOCAL_RUN_ID, runAttempt: 1, workflowId: '' }), lock.IdentityError);
  assert.throws(() => lock.validateIdentity(null), lock.IdentityError);
});

test('identity: sem variáveis compartilhadas nem GitHub gera runId local e tentativa 1', () => {
  const script = `
    const id = require(${JSON.stringify(IDENTITY)});
    console.log(JSON.stringify({ runId: id.newRunId(), attempt: id.newRunAttempt() }));
  `;
  const res = runChild(script, childEnv());
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.match(out.runId, /^loc[a-z0-9]+$/);
  assert.equal(out.attempt, 1);
});

test('identity: fallback legado GitHub mantém gh<id>-aN e a tentativa correspondente', () => {
  const script = `
    const id = require(${JSON.stringify(IDENTITY)});
    console.log(JSON.stringify({ runId: id.newRunId(), attempt: id.newRunAttempt() }));
  `;
  const res = runChild(script, childEnv({ GITHUB_RUN_ID: '777', GITHUB_RUN_ATTEMPT: '3' }));
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.runId, 'gh777-a3');
  assert.equal(out.attempt, 3);
});

test('identity: CODE_EXECUTION_RUN_ID/RUN_ATTEMPT vencem o fallback GitHub', () => {
  const script = `
    const id = require(${JSON.stringify(IDENTITY)});
    const g = id.generate();
    console.log(JSON.stringify({ runId: id.newRunId(), attempt: id.newRunAttempt(), gen: g.runId }));
  `;
  const res = runChild(
    script,
    childEnv({
      GITHUB_RUN_ID: '999',
      GITHUB_RUN_ATTEMPT: '5',
      CODE_EXECUTION_RUN_ID: LOCAL_RUN_ID,
      CODE_EXECUTION_RUN_ATTEMPT: '1',
    })
  );
  assert.equal(res.status, 0, res.stderr);
  const out = JSON.parse(res.stdout);
  assert.equal(out.runId, LOCAL_RUN_ID);
  assert.equal(out.attempt, 1);
  assert.equal(out.gen, LOCAL_RUN_ID);
});

test('identity: tentativa compartilhada inválida cai no fallback GitHub', () => {
  const script = `
    const id = require(${JSON.stringify(IDENTITY)});
    console.log(JSON.stringify({ attempt: id.newRunAttempt() }));
  `;
  const res = runChild(
    script,
    childEnv({ GITHUB_RUN_ID: '777', GITHUB_RUN_ATTEMPT: '3', CODE_EXECUTION_RUN_ATTEMPT: '0' })
  );
  assert.equal(res.status, 0, res.stderr);
  assert.equal(JSON.parse(res.stdout).attempt, 3);
});

test('identity: generate() no modo legado continua casando com o regex de security.test', () => {
  const script = `
    const id = require(${JSON.stringify(IDENTITY)});
    const g = id.generate();
    console.log(JSON.stringify({ runId: g.runId }));
  `;
  const res = runChild(script, childEnv({ GITHUB_RUN_ID: '777', GITHUB_RUN_ATTEMPT: '3' }));
  assert.equal(res.status, 0, res.stderr);
  const { runId } = JSON.parse(res.stdout);
  assert.match(runId, /^(gh\d+(-a\d+)?|loc[a-z0-9]+)$/);
});

test('global-setup: persiste runAttempt nos metadados da run', () => {
  const script = `
    const fs = require('fs');
    const path = require('path');
    const envMod = require(${JSON.stringify(ENVCJS)});
    envMod.env = () => undefined;
    const identity = require(${JSON.stringify(IDENTITY)});
    const saves = [];
    identity.save = (meta) => { saves.push(meta); return meta; };
    identity.load = () => null;
    const hit = (p) => String(p).includes(path.sep + '.state' + path.sep);
    const origWrite = fs.writeFileSync;
    const origMkdir = fs.mkdirSync;
    fs.writeFileSync = (p, ...r) => (hit(p) ? undefined : origWrite(p, ...r));
    fs.mkdirSync = (p, ...r) => (hit(p) ? undefined : origMkdir(p, ...r));
    (async () => {
      const setup = require(${JSON.stringify(SETUP)});
      await setup();
      const meta = saves[0];
      if (!meta) { console.log('SEM-SAVE'); process.exit(1); }
      console.log(JSON.stringify({ n: saves.length, runId: meta.runId, runAttempt: meta.runAttempt, mode: meta.mode }));
    })().catch((e) => { console.error(e); process.exit(1); });
  `;
  const res = runChild(
    script,
    childEnv({ CODE_EXECUTION_RUN_ID: LOCAL_RUN_ID, CODE_EXECUTION_RUN_ATTEMPT: '1' })
  );
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const lines = res.stdout.trim().split('\n');
  const out = JSON.parse(lines[lines.length - 1]);
  assert.equal(out.n, 1);
  assert.equal(out.runId, LOCAL_RUN_ID);
  assert.equal(out.runAttempt, 1);
  assert.equal(out.mode, 'ephemeral');
});

function runCleanupChild(meta) {
  const script = `
    const envMod = require(${JSON.stringify(ENVCJS)});
    envMod.resolveCredentials = () => null;
    envMod.guardReasonText = () => 'credenciais indisponíveis (suíte de teste)';
    const identity = require(${JSON.stringify(IDENTITY)});
    identity.load = () => ${meta === null ? 'null' : `(${JSON.stringify(meta)})`};
    let captured = null;
    identity.writeSummary = (summary) => { captured = summary; return summary; };
    identity.clear = () => {};
    const { runCleanup } = require(${JSON.stringify(CLEANUP)});
    (async () => {
      const summary = await runCleanup({ log: () => {} });
      console.log(JSON.stringify({
        runId: summary.runId,
        runAttempt: summary.runAttempt,
        captured: captured ? captured.runAttempt : null,
        severity: summary.severity,
      }));
    })().catch((e) => { console.error(e); process.exit(1); });
  `;
  const res = runChild(
    script,
    childEnv({ CODE_EXECUTION_RUN_ID: LOCAL_RUN_ID, CODE_EXECUTION_RUN_ATTEMPT: '1' })
  );
  assert.equal(res.status, 0, res.stdout + res.stderr);
  return JSON.parse(res.stdout);
}

test('cleanup: sem metadados persiste runAttempt 1 e runId compartilhado', () => {
  const out = runCleanupChild(null);
  assert.equal(out.runAttempt, 1);
  assert.equal(out.runId, LOCAL_RUN_ID);
  assert.equal(out.captured, 1);
});

test('cleanup: metadados com runAttempt 4 sobrescrevem o valor derivado', () => {
  const out = runCleanupChild({
    runId: '888',
    runAttempt: 4,
    mode: 'ephemeral',
    createdByCode: false,
    email: null,
  });
  assert.equal(out.runAttempt, 4);
  assert.equal(out.runId, '888');
  assert.equal(out.captured, 4);
});

test('cleanup: metadados com runAttempt inválido mantêm o valor derivado', () => {
  const out = runCleanupChild({
    runId: '888',
    runAttempt: 'invalida',
    mode: 'ephemeral',
    createdByCode: false,
    email: null,
  });
  assert.equal(out.runAttempt, 1);
  assert.equal(out.runId, '888');
  assert.equal(out.captured, 1);
});

test('wiring: os 10 scripts do package.json apontam para o wrapper', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const expected = {
    'code:test': 'node e2e/scripts/run-code.cjs --code-report-strict',
    'code:test:headed': 'node e2e/scripts/run-code.cjs -- --headed',
    'code:c4-cdp': 'node e2e/scripts/run-code.cjs -- --project=c4-cdp',
    'code:smoke': 'node e2e/scripts/run-code.cjs -- --project=smoke',
    'code:movimentacoes': 'node e2e/scripts/run-code.cjs -- --project=movimentacoes',
    'code:orcamento': 'node e2e/scripts/run-code.cjs -- --project=orcamento',
    'code:metas': 'node e2e/scripts/run-code.cjs -- --project=metas',
    'code:investimentos': 'node e2e/scripts/run-code.cjs -- --project=investimentos',
    'code:report': 'node e2e/scripts/run-code.cjs --code-lock-only -- node e2e/reports/generate-report.cjs',
    'code:report:strict': 'node e2e/scripts/run-code.cjs --code-lock-only -- node e2e/reports/generate-report.cjs --strict',
  };
  for (const [name, cmd] of Object.entries(expected)) {
    assert.equal(pkg.scripts[name], cmd, name);
  }
});

test('wiring: os scripts intactos do package.json permanecem sem wrapper', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const intact = {
    'code:oracles': 'node --test "e2e/oracles/*.test.mjs"',
    'code:reset': 'node e2e/seeds/reset.cjs',
    'code:cleanup': 'node e2e/seeds/cleanup.cjs',
    'code:list': 'node e2e/scripts/list-tests.cjs',
    'code:serve': 'python3 -m http.server 8000 --bind 127.0.0.1',
    'code:security': 'node --test "e2e/security/*.test.mjs"',
    'code:syntax': 'node e2e/scripts/syntax-check.cjs',
    'code:v20': 'node --test "worker/test/v20-01-*.test.mjs" "e2e/oracles/v20-01-*.test.mjs" "e2e/security/v20-01-*.test.mjs"',
    'code:v20-02': 'node --test "e2e/oracles/v20-02-*.test.mjs" "e2e/security/v20-02-*.test.mjs"',
  };
  for (const [name, cmd] of Object.entries(intact)) {
    assert.equal(pkg.scripts[name], cmd, name);
  }
});

test('lock: payload contém somente campos operacionais, sem segredos', () => {
  const script = `
    const fs = require('fs');
    const m = require(${JSON.stringify(LOCKMOD)});
    const id = { runId: ${JSON.stringify(LOCAL_RUN_ID)}, runAttempt: 1, workflowId: 'local' };
    const h = m.acquireLock(id);
    const raw = fs.readFileSync(m.LOCK_PATH, 'utf8');
    const obj = JSON.parse(raw);
    m.releaseLock(h);
    console.log(JSON.stringify({ keys: Object.keys(obj).sort(), raw }));
  `;
  const res = runChild(script, childEnv());
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const out = JSON.parse(res.stdout);
  assert.deepEqual(out.keys, ['acquiredAt', 'pid', 'runAttempt', 'runId', 'token', 'workflowId']);
  assert.ok(!/password|secret|credential|email/i.test(out.raw), out.raw);
  assert.ok(!fs.existsSync(LOCK_PATH));
});
