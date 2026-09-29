/* C.O.D.E. — garantias de segurança da própria infraestrutura (auditáveis).
   Nada aqui usa rede nem navegador: são as regras que impedem o C.O.D.E. de
   tocar outra conta, de apagar fora do escopo QA e de vazar segredo.
   Execução: npm run code:security (também roda no CI). */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const rest = require('../helpers/firestore-rest.js');
const { isQaEmail, resolveCredentials, guardReasonText } = require('../helpers/env.js');
const identity = require('../helpers/identity.js');
const { runCleanup } = require('../helpers/cleanup.js');

const UID = 'uidQaTest123';
const FULL = `projects/livro-caixa-54357/databases/(default)/documents/livrocaixa/${UID}/banks/abc`;

test('escopo: aceita o documento da própria conta QA (nome completo do Firestore)', () => {
  assert.doesNotThrow(() => rest.assertScoped(UID, FULL));
  assert.doesNotThrow(() => rest.assertScoped(UID, `livrocaixa/${UID}/banks/abc`));
  assert.doesNotThrow(() => rest.assertScoped(UID, `livrocaixa/${UID}`));
});

test('escopo: recusa qualquer caminho fora de livrocaixa/{uid-qa}', () => {
  const fora = [
    'livrocaixa/OUTRO_UID/banks/abc',
    `projects/p/databases/(default)/documents/livrocaixa/OUTRO_UID/banks/abc`,
    'livrocaixa',
    `livrocaixa/${UID}2/banks/abc`,
    'users/qualquercoisa/doc',
    FULL.replace(UID, 'OUTRO'),
    '',
  ];
  for (const p of fora) {
    assert.throws(() => rest.assertScoped(UID, p), /Recusado/, `deveria recusar: ${p}`);
  }
  assert.throws(() => rest.assertScoped(undefined, FULL), /Recusado/);
  assert.throws(() => rest.assertScoped('', FULL), /Recusado/);
});

test('escopo: uid vazio nunca libera caminho algum', () => {
  for (const p of [FULL, `livrocaixa//banks`, 'livrocaixa/undefined/banks']) {
    assert.throws(() => rest.assertScoped('', p), /Recusado/);
  }
});

test('docPathOf: normaliza resource name completo e caminho relativo', () => {
  assert.equal(rest.docPathOf(FULL), `livrocaixa/${UID}/banks/abc`);
  assert.equal(rest.docPathOf(`livrocaixa/${UID}/banks/abc`), `livrocaixa/${UID}/banks/abc`);
  assert.equal(rest.docPathOf(''), '');
});

test('coleção: só nomes simples entram na URL', () => {
  assert.doesNotThrow(() => rest.assertCollection('banks'));
  assert.doesNotThrow(() => rest.assertCollection('invoiceLaunches'));
  for (const bad of ['banks/x', '../etc', 'a?b', 'a#b', '', 'a b', 'a/b/c', 'x'.repeat(200)]) {
    assert.throws(() => rest.assertCollection(bad), /inválido/, `deveria recusar: ${bad}`);
  }
});

test('coleções resetáveis: lista fechada, sem curinga', () => {
  assert.ok(Array.isArray(rest.COLLECTIONS) && rest.COLLECTIONS.length > 0);
  for (const c of rest.COLLECTIONS) assert.match(c, /^[A-Za-z0-9_-]+$/);
  assert.ok(!rest.COLLECTIONS.includes('*'));
});

test('conta QA: e-mails fora do padrão são recusados (protege conta real)', () => {
  assert.equal(isQaEmail('user@gmail.com'), false);
  assert.equal(isQaEmail('meuemail@outro-dominio.com'), false);
  assert.equal(isQaEmail('code-qa-abc123@qualquer.test'), true);
  assert.equal(isQaEmail('code-qa-abc123@livrocaixa.test'), true);
  assert.equal(isQaEmail('alguem@livrocaixa.test'), true);
  assert.equal(isQaEmail(''), false);
  assert.equal(isQaEmail('sem-arroba'), false);
});

test('conta QA: override ex CODE_TEST_ALLOW_ANY_EMAIL=1', () => {
  process.env.CODE_TEST_ALLOW_ANY_EMAIL = '1';
  try {
    assert.equal(isQaEmail('user@gmail.com'), true);
  } finally {
    delete process.env.CODE_TEST_ALLOW_ANY_EMAIL;
  }
});

test('resolveCredentials: recusa e-mail não-QA e expõe o motivo', () => {
  process.env.CODE_TEST_EMAIL = 'pessoa-real@gmail.com';
  process.env.CODE_TEST_PASSWORD = 'qualquer-senha';
  try {
    assert.equal(resolveCredentials(), null);
    assert.match(guardReasonText() || '', /não é uma conta QA/);
  } finally {
    delete process.env.CODE_TEST_EMAIL;
    delete process.env.CODE_TEST_PASSWORD;
  }
});

test('resolveCredentials: aceita e-mail QA declarado', () => {
  process.env.CODE_TEST_EMAIL = 'code-qa-verificacao@livrocaixa.test';
  process.env.CODE_TEST_PASSWORD = 'qualquer-senha';
  try {
    const c = resolveCredentials();
    assert.equal(c.email, 'code-qa-verificacao@livrocaixa.test');
    assert.equal(guardReasonText(), null);
  } finally {
    delete process.env.CODE_TEST_EMAIL;
    delete process.env.CODE_TEST_PASSWORD;
  }
});

test('gitignore: credenciais, estado e artefatos nunca vão para o Git', () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const linha of ['e2e/.env.local', 'e2e/.state/', 'e2e/.artifacts/', 'node_modules/', 'e2e/reports/results.json', '\n.env\n', '!.env.example']) {
    assert.ok(gi.includes(linha), `.gitignore deveria conter ${linha}`);
  }
  /* a documentação precisa refletir a guarda implementada (evita doc que
     promete regra que não existe) */
  const example = fs.readFileSync(path.join(ROOT, 'e2e', '.env.example'), 'utf8');
  assert.ok(example.includes('CODE_TEST_ALLOW_ANY_EMAIL'), '.env.example deve documentar o override');
  assert.ok(example.includes('CODE_TEST_EMAIL_DOMAINS') || example.includes('livrocaixa.test'),
    '.env.example deve documentar o padrão de domínio QA');
});

test('segredos: nenhum padrão de credencial em arquivos versionados', () => {
  const arquivos = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const permitidos = [
    'AIzaSyADRwvRCaOB0Q8QvDeDfReVeMzK_m4KqlA',
    'sk-or-v1-chave-fake-0123456789abcdef',
  ];
  const padroes = [
    ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY/],
    ['service account', /"type"\s*:\s*"service_account"/],
    ['GitHub token', /(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,}/],
    ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
    ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
    ['OpenRouter key', /\bsk-or-v1-[A-Za-z0-9_-]{20,}/],
    ['OpenAI key', /\bsk-proj-[A-Za-z0-9_-]{20,}/],
    ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
    ['token Cloudflare', /CLOUDFLARE_API_TOKEN\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/],
    ['JWT', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ];
  const violacoes = [];
  for (const arquivo of arquivos) {
    let buffer;
    try {
      buffer = fs.readFileSync(path.join(ROOT, arquivo));
    } catch {
      continue;
    }
    if (buffer.includes(0)) continue;
    const texto = buffer.toString('utf8');
    for (const [nome, padrao] of padroes) {
      const achados = texto.match(new RegExp(padrao.source, 'g')) || [];
      for (const achado of achados) {
        if (permitidos.some((p) => achado.includes(p))) continue;
        violacoes.push(`${nome}: ${arquivo} (${achado.slice(0, 16)}…)`);
      }
    }
  }
  assert.deepEqual(violacoes, [], `padrões de credencial detectados:\n${violacoes.join('\n')}`);
});

test('playwright: setup não grava trace/screenshot (senha no corpo do login)', () => {
  /* leitura textual: exigir o módulo @playwright/test aborta no Termux
     ("Unsupported platform") e este teste precisa rodar em qualquer lugar. */
  const cfgText = fs.readFileSync(path.join(ROOT, 'playwright.config.js'), 'utf8');
  const blocoSetup = cfgText.slice(cfgText.indexOf("name: 'setup'"), cfgText.indexOf("name: 'smoke'"));
  assert.ok(blocoSetup.includes("trace: 'off'"), 'setup deve ter trace: off');
  assert.ok(blocoSetup.includes("screenshot: 'off'"), 'setup deve ter screenshot: off');
  assert.ok(blocoSetup.includes("video: 'off'"), 'setup deve ter video: off');
});

test('workflow: sem deploy, sem permissões amplas, sem pull_request_target', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'code-e2e.yml'), 'utf8');
  assert.ok(wf.includes('permissions:\n  contents: read'), 'workflow deveria declarar permissions: contents: read');
  assert.ok(!wf.includes('pull_request_target'), 'pull_request_target é proibido (expõe secrets a PRs externos)');
  assert.ok(!wf.includes('environment: production'), 'o C.O.D.E. não pode usar o environment de produção');
  for (const proibido of ['wrangler', 'cloudflare', 'deploy', 'CLOUDFLARE_API_TOKEN', 'npm publish']) {
    assert.ok(!wf.includes(proibido), `workflow não pode conter "${proibido}"`);
  }
});

test('package.json: é privado, sem hooks de ciclo de vida', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.private, true);
  for (const hook of ['preinstall', 'postinstall', 'prepublish', 'prepare']) {
    assert.ok(!(hook in pkg.scripts), `script de ciclo de vida "${hook}" não é permitido`);
  }
  assert.ok(pkg.devDependencies['@playwright/test'], 'dependência de teste deve ficar em devDependencies');
  assert.ok(!pkg.dependencies, 'nenhuma dependência de produção');
});

/* ================= FASE 5 — sanitização de artefatos ================= */
const { sanitizeText } = require('../helpers/sanitize.js');

test('sanitiza: relatório nunca contém e-mail completo, senha ou token longo', () => {
  const email = 'code-qa-gh1234567890-a1-f2b3c4@livrocaixa.test';
  const senha = 'QabcDEF1234567890_abcDEF1234567890';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0SflKxw5JSMe';
  const texto = `erro ao logar ${email} com password=${senha} e Authorization: Bearer ${token}`;
  const saida = sanitizeText(texto);
  assert.ok(!saida.includes(email), 'e-mail completo vazou no texto sanitizado');
  assert.ok(saida.includes('***@livrocaixa.test'), 'domínio deve ser preservado para diagnóstico');
  assert.ok(!saida.includes(senha), 'senha vazou no texto sanitizado');
  assert.ok(!saida.includes(token), 'token vazou no texto sanitizado');
});

/* ================= FASE 1/12 — identidade nunca grava segredo ========= */
test('identidade: senha/token nunca chegam ao disco', () => {
  const antes = fs.existsSync(identity.IDENTITY_PATH) ? fs.readFileSync(identity.IDENTITY_PATH, 'utf8') : null;
  try {
    identity.save({
      runId: 'test-run',
      email: 'code-qa-teste@livrocaixa.test',
      password: 'SEGREDO_QUE_NAO_PODE_IR_A_DISCO_123',
      idToken: 'TOKEN_QUE_NAO_PODE_IR_A_DISCO_456',
      nested: { apiKey: 'CHAVE_PROIBIDA_789', uid: 'ok' },
    });
    const texto = fs.readFileSync(identity.IDENTITY_PATH, 'utf8');
    assert.ok(!texto.includes('SEGREDO_QUE_NAO_PODE_IR_A_DISCO_123'), 'senha persistida em disco');
    assert.ok(!texto.includes('TOKEN_QUE_NAO_PODE_IR_A_DISCO_456'), 'idToken persistido em disco');
    assert.ok(!texto.includes('CHAVE_PROIBIDA_789'), 'apiKey persistida em disco');
    const carregado = identity.load();
    assert.equal(carregado.password, undefined);
    assert.equal(carregado.idToken, undefined);
    assert.equal(carregado.nested.apiKey, undefined);
    assert.equal(carregado.nested.uid, 'ok', 'campo não sensível deve sobreviver ao scrub');
  } finally {
    restaurarArquivo(identity.IDENTITY_PATH, antes);
  }
});

test('identidade: credenciais efêmeras são fortes e no padrão QA', () => {
  const id = identity.generate();
  assert.match(id.email, /^code-qa-[a-z0-9-]+@livrocaixa\.test$/, 'e-mail fora do padrão efêmero');
  assert.ok(isQaEmail(id.email), 'guarda de conta QA deve aceitar a identidade gerada');
  assert.ok(id.password.length >= 16, 'senha efêmera fraca');
  assert.notEqual(id.password, id.email);
  assert.match(id.runId, /^(gh\d+(-a\d+)?|loc[a-z0-9]+)$/, 'runId ilegível para rastreio');
  assert.ok(!Object.values(id).includes(''), 'campos vazios não servem para identificação');
});

/* ============== FASE 4/6 — só a conta desta run pode sair ============== */
test('propriedade: canDeleteIdentity recusa tudo que não for conta desta run', () => {
  const identidade = {
    runId: 'r1',
    email: 'code-qa-r1-abc123@livrocaixa.test',
    uid: 'UID_RUN',
    createdByCode: true,
  };
  const sessao = { uid: 'UID_RUN', email: 'code-qa-r1-abc123@livrocaixa.test' };
  assert.equal(identity.canDeleteIdentity(identidade, sessao).ok, true);

  const casos = [
    [{ ...identidade, createdByCode: false }, sessao],
    [null, sessao],
    [{ ...identidade, email: 'code-qa-OUTRA@livrocaixa.test' }, sessao],
    [{ ...identidade, createdByCode: undefined }, sessao],
    [identidade, { ...sessao, email: 'code-qa-outra-run@livrocaixa.test' }],
    [identidade, { ...sessao, uid: 'UID_DIFERENTE' }],
    [identidade, { uid: '', email: sessao.email }],
    [identidade, null],
  ];
  for (const [id, s] of casos) {
    const r = identity.canDeleteIdentity(id, s);
    assert.equal(r.ok, false, `deveria recusar: ${JSON.stringify({ id, s })}`);
    assert.ok(r.reason, 'recusa precisa explicar o motivo');
  }
});

test('propriedade: planCleanup nunca decide exclusão de conta preexistente', () => {
  const pre = { runId: 'r1', email: 'code-qa-x@livrocaixa.test', createdByCode: false };
  const propria = { runId: 'r2', email: 'code-qa-y@livrocaixa.test', uid: 'U2', createdByCode: true };
  const sessaoOk = { ok: true, uid: 'U2', email: 'code-qa-y@livrocaixa.test' };

  assert.equal(identity.planCleanup(pre, { ok: true, uid: 'U1', email: 'code-qa-x@livrocaixa.test' }).auth, 'SKIP');
  assert.equal(identity.planCleanup(propria, sessaoOk).auth, 'RUN');
  assert.equal(identity.planCleanup(propria, sessaoOk).firestore, 'RUN');
  assert.equal(identity.planCleanup(null, sessaoOk).auth, 'SKIP');
  /* conta da run mas sem sessão → sobras possíveis, nunca silêncio */
  const bloqueio = identity.planCleanup(propria, { ok: false, reason: 'erro de autenticação observado' });
  assert.equal(bloqueio.severity, 'BLOCKED');
  assert.equal(bloqueio.auth, 'SKIP');
  /* uid divergente → bloqueia antes de tocar em algo */
  const divergente = identity.planCleanup(
    { ...propria, uid: 'OUTRO' },
    { ok: true, uid: 'U2', email: 'code-qa-y@livrocaixa.test' }
  );
  assert.equal(divergente.severity, 'BLOCKED');
  assert.equal(divergente.auth, 'SKIP');
});

/* ================= FASE 9 — cleanup em duas camadas ==================== */
function fakeRes(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body || {} };
}
function stubFetch(handler) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, opts = {}) => {
    const registro = { url: String(url), method: opts.method || 'GET', body: opts.body || null };
    calls.push(registro);
    return handler(registro);
  };
  return { calls, restore: () => { global.fetch = original; } };
}
function restaurarArquivo(caminho, conteudo) {
  if (conteudo === null) {
    if (fs.existsSync(caminho)) fs.unlinkSync(caminho);
    return;
  }
  fs.writeFileSync(caminho, conteudo);
}

function prepararAmbienteCleanup({ createdByCode, uidIdentidade, uidSessao }) {
  const email = `code-qa-cleanup-${Date.now().toString(36)}@livrocaixa.test`;
  const senha = `Q${Date.now().toString(36)}xyzSECRET1234567890`;
  const backupSummary = fs.existsSync(identity.SUMMARY_PATH)
    ? fs.readFileSync(identity.SUMMARY_PATH, 'utf8')
    : null;
  const backupIdentity = fs.existsSync(identity.IDENTITY_PATH)
    ? fs.readFileSync(identity.IDENTITY_PATH, 'utf8')
    : null;
  identity.save({
    runId: 'cleanup-test',
    mode: 'ephemeral',
    email,
    uid: uidIdentidade || null,
    createdByCode,
    state: 'created-by-code',
    createdAt: new Date().toISOString(),
  });
  process.env.CODE_TEST_EMAIL = email;
  process.env.CODE_TEST_PASSWORD = senha;
  process.env.CODE_TEST_MODE = 'ephemeral';
  const limpar = () => {
    delete process.env.CODE_TEST_EMAIL;
    delete process.env.CODE_TEST_PASSWORD;
    delete process.env.CODE_TEST_MODE;
    restaurarArquivo(identity.IDENTITY_PATH, backupIdentity);
    restaurarArquivo(identity.SUMMARY_PATH, backupSummary);
  };
  return { email, senha, limpar };
}

test('cleanup: apaga só livrocaixa/{uid-qa} e exclui a conta só com idToken próprio', async () => {
  const env = prepararAmbienteCleanup({ createdByCode: true, uidIdentidade: 'UIDQA', uidSessao: 'UIDQA' });
  const logs = [];
  const stub = stubFetch((call) => {
    if (call.url.includes('signInWithPassword')) {
      return fakeRes(200, { localId: 'UIDQA', idToken: 'FAKE_ID_TOKEN_SECRETO_123', email: env.email });
    }
    if (call.url.includes('accounts:delete')) return fakeRes(200, {});
    if (call.url.includes('firestore.googleapis.com')) return fakeRes(404, {});
    throw new Error(`chamada inesperada: ${call.url}`);
  });
  try {
    const summary = await runCleanup({ log: (m) => logs.push(m) });

    /* camada 1 — só o escopo da própria conta */
    const deletes = stub.calls.filter((c) => c.method === 'DELETE');
    assert.ok(deletes.length > 0, 'cleanup deveria ter tentado limpar o Firestore');
    for (const d of deletes) {
      assert.ok(d.url.includes('/livrocaixa/UIDQA'), `DELETE fora do escopo: ${d.url}`);
      assert.ok(!d.url.includes('UIDQA2'), 'escopo vizinho atingido');
    }
    /* camada 2 — conta própria, só idToken, sem credencial administrativa */
    const excl = stub.calls.filter((c) => c.url.includes('accounts:delete'));
    assert.equal(excl.length, 1, 'exclusão da conta deve acontecer exatamente uma vez');
    const corpo = JSON.parse(excl[0].body);
    assert.deepEqual(Object.keys(corpo), ['idToken'], 'corpo deve conter APENAS idToken (sem localId/admin)');
    assert.ok(!/localId|email|password/i.test(excl[0].body), 'corpo com dado além do idToken');
    for (const c of stub.calls) {
      assert.ok(!c.url.includes('localId='), 'uso de localId indica credencial administrativa');
    }

    assert.equal(summary.createdByCode, true);
    assert.equal(summary.firestoreCleanup, 'PASS');
    assert.equal(summary.authCleanup, 'PASS');
    assert.equal(summary.severity, null);

    /* nenhum segredo em logs nem no resumo (que vira relatório) */
    const tudo = logs.join('\n') + JSON.stringify(summary);
    assert.ok(!tudo.includes(env.senha), 'senha vazou em log/resumo');
    assert.ok(!tudo.includes('FAKE_ID_TOKEN_SECRETO_123'), 'idToken vazou em log/resumo');
    assert.ok(!tudo.includes(env.email), 'e-mail completo vazou em log/resumo');
    assert.ok(summary.email.includes('***'), 'resumo deve guardar e-mail mascarado');
    assert.ok(!fs.existsSync(identity.IDENTITY_PATH), 'metadado da run deveria ser removido');
    assert.ok(fs.existsSync(identity.SUMMARY_PATH), 'resumo do cleanup deveria ficar para o relatório');
  } finally {
    stub.restore();
    env.limpar();
  }
});

test('cleanup: uid divergente bloqueia — nada é apagado e nada é excluído', async () => {
  const env = prepararAmbienteCleanup({ createdByCode: true, uidIdentidade: 'OUTRO', uidSessao: 'UIDQA' });
  const stub = stubFetch((call) => {
    if (call.url.includes('signInWithPassword')) {
      return fakeRes(200, { localId: 'UIDQA', idToken: 'FAKE_ID_TOKEN_999', email: env.email });
    }
    throw new Error(`não deveria haver chamada além do signIn: ${call.url}`);
  });
  try {
    const summary = await runCleanup();
    assert.equal(summary.severity, 'BLOCKED');
    assert.equal(summary.firestoreCleanup, 'SKIP');
    assert.equal(summary.authCleanup, 'SKIP');
    const mutacoes = stub.calls.filter((c) => c.method === 'DELETE' || c.url.includes('accounts:delete'));
    assert.equal(mutacoes.length, 0, 'houve mutação com uid divergente');
  } finally {
    stub.restore();
    env.limpar();
  }
});

test('cleanup: conta preexistente é limpa no Firestore mas NUNCA excluída', async () => {
  const env = prepararAmbienteCleanup({ createdByCode: false, uidIdentidade: 'UIDQA', uidSessao: 'UIDQA' });
  const stub = stubFetch((call) => {
    if (call.url.includes('signInWithPassword')) {
      return fakeRes(200, { localId: 'UIDQA', idToken: 'FAKE_ID_TOKEN_777', email: env.email });
    }
    if (call.url.includes('firestore.googleapis.com')) return fakeRes(404, {});
    throw new Error(`chamada inesperada: ${call.url}`);
  });
  try {
    const summary = await runCleanup();
    assert.equal(summary.firestoreCleanup, 'PASS');
    assert.equal(summary.authCleanup, 'SKIP-PREEXISTENTE');
    assert.equal(summary.severity, null);
    assert.equal(
      stub.calls.filter((c) => c.url.includes('accounts:delete')).length,
      0,
      'conta preexistente foi excluída'
    );
    /* a run terminou: sem resíduo de estado (o resumo já registra o modo) */
    assert.equal(summary.createdByCode, false);
    assert.ok(!fs.existsSync(identity.IDENTITY_PATH), 'metadado órfão não deve sobrar');
  } finally {
    stub.restore();
    env.limpar();
  }
});

test('cleanup: sem senha em memória e conta criada pela run → BLOCKED visível', async () => {
  const email = `code-qa-sem-senha-${Date.now().toString(36)}@livrocaixa.test`;
  const backupIdentity = fs.existsSync(identity.IDENTITY_PATH)
    ? fs.readFileSync(identity.IDENTITY_PATH, 'utf8')
    : null;
  const backupSummary = fs.existsSync(identity.SUMMARY_PATH)
    ? fs.readFileSync(identity.SUMMARY_PATH, 'utf8')
    : null;
  identity.save({ runId: 'r', mode: 'ephemeral', email, uid: 'U', createdByCode: true, state: 'x' });
  delete process.env.CODE_TEST_EMAIL;
  delete process.env.CODE_TEST_PASSWORD;
  delete process.env.CODE_TEST_MODE;
  /* rede bloqueada: este teste precisa ser determinístico e offline */
  const stub = stubFetch((call) => {
    throw new Error(`rede bloqueada em teste offline: ${call.url}`);
  });
  try {
    const summary = await runCleanup();
    assert.equal(summary.severity, 'BLOCKED', 'sobras de conta devem ficar visíveis, nunca silenciosas');
    assert.equal(summary.authCleanup, 'SKIP');
    assert.equal(summary.firestoreCleanup, 'SKIP');
    const notas = summary.notes.join(' ');
    assert.ok(
      notas.includes('sem credenciais') || notas.includes('signIn'),
      `motivo do bloqueio ausente nas notas: ${notas}`
    );
    assert.equal(stub.calls.filter((c) => c.method === 'DELETE' || c.url.includes('accounts:delete')).length, 0);
  } finally {
    stub.restore();
    restaurarArquivo(identity.IDENTITY_PATH, backupIdentity);
    restaurarArquivo(identity.SUMMARY_PATH, backupSummary);
  }
});

test('cleanup: deleteOwnAccount recusa idToken ausente (sem rede)', async () => {
  const original = global.fetch;
  global.fetch = async () => {
    throw new Error('rede não deveria ser usada sem idToken');
  };
  try {
    await assert.rejects(rest.deleteOwnAccount(null), /idToken/);
    await assert.rejects(rest.deleteOwnAccount(''), /idToken/);
  } finally {
    global.fetch = original;
  }
});

/* ============ FASE 3/5 — CI sem segredo e sem artefato sensível ======== */
test('workflow: zero GitHub Secrets, zero environment, sem credencial em texto', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'code-e2e.yml'), 'utf8');
  assert.ok(!wf.includes('secrets.'), 'workflow não pode depender de GitHub Secrets (run efêmera)');
  assert.ok(!wf.includes('environment:'), 'workflow não pode declarar environment');
  for (const proibido of ['CODE_TEST_PASSWORD', 'CODE_TEST_EMAIL', 'password:', 'idToken']) {
    assert.ok(!wf.includes(proibido), `workflow não pode conter "${proibido}"`);
  }
});

test('workflow: evidências nunca incluem e2e/.state (estado de sessão/identidade)', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'code-e2e.yml'), 'utf8');
  const bloco = wf.slice(wf.indexOf('name: Evidências'));
  assert.ok(bloco.length > 0, 'passo de evidências ausente');
  assert.ok(!bloco.includes('.state'), 'e2e/.state não pode ir para artefatos');
  assert.ok(!bloco.includes('.env'), 'arquivo de env não pode ir para artefatos');
  assert.ok(!bloco.includes('node_modules'), 'node_modules não deve ser artefato');
});

test('workflow: nenhuma falha é mascarada e o runner fica pinado', () => {
  for (const arquivo of ['code-e2e.yml', 'worker.yml', 'eol-check.yml', 'model-failed-alert.yml']) {
    const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', arquivo), 'utf8');
    assert.ok(!wf.includes('|| true'), `${arquivo}: nenhum passo pode anular erro com "|| true"`);
    assert.ok(!wf.includes('continue-on-error'), `${arquivo}: nenhum passo pode continuar após falha`);
    assert.ok(!wf.includes('ubuntu-latest'), `${arquivo}: runner pinado — ubuntu-latest migra de imagem sem aviso`);
    assert.ok(wf.includes('runs-on: ubuntu-24.04'), `${arquivo}: esperado runs-on: ubuntu-24.04`);
  }
});

test('workflow: versões das actions rodam em runtime Node 24', () => {
  /* node20 está deprecado no GitHub e é forçado a rodar em node24.
     As actions são pinadas por SHA (supply chain) e o comentário depois do
     SHA registra a tag exata: checkout v5 e setup-node v5 são os primeiros
     majors node24 (upload-artifact v6). */
  const pinada = (wf, acao, major, arquivo) => {
    const re = new RegExp(`${acao.replace('/', '\\/')}@[0-9a-f]{40} # v${major}\\.\\d+\\.\\d+`);
    assert.match(wf, re, `${arquivo}: ${acao} precisa estar pinada por SHA na major node24 (>=v${major})`);
  };
  for (const arquivo of ['code-e2e.yml', 'worker.yml']) {
    const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', arquivo), 'utf8');
    pinada(wf, 'actions/checkout', 5, arquivo);
    pinada(wf, 'actions/setup-node', 5, arquivo);
    assert.ok(wf.includes('node-version: 24'), `${arquivo}: CI deve usar a mesma faixa do dev local (Node 24)`);
  }
  const e2e = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'code-e2e.yml'), 'utf8');
  pinada(e2e, 'actions/upload-artifact', 6, 'code-e2e.yml');
});

test('workflow: toda action é pinada por SHA com tag documentada (supply chain)', () => {
  /* Nenhuma `uses:` pode apontar para tag móvel (@v5): tag pode ser reescrita
     depois do merge. Exige SHA de commit + comentário com a tag exata. */
  const dir = path.join(ROOT, '.github', 'workflows');
  const arquivos = fs.readdirSync(dir).filter((a) => a.endsWith('.yml') || a.endsWith('.yaml'));
  assert.ok(arquivos.length >= 3, `esperado ao menos 3 workflows, encontrado ${arquivos.length}`);
  const rePin = /^(- )?uses:\s*[A-Za-z0-9._/-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/;
  for (const arquivo of arquivos) {
    const wf = fs.readFileSync(path.join(dir, arquivo), 'utf8');
    const uses = wf.split('\n').filter((linha) => linha.includes('uses:'));
    assert.ok(uses.length > 0, `${arquivo}: deveria declarar ao menos uma action`);
    for (const linha of uses) {
      assert.match(linha.trim(), rePin, `${arquivo}: action sem pin por SHA/tag → ${linha.trim()}`);
    }
  }
});

test('worker: smoke pós-deploy exige GET /health com falha explícita', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'worker.yml'), 'utf8');
  const idx = wf.indexOf('name: Smoke pós-deploy');
  assert.ok(idx >= 0, 'passo de smoke pós-deploy ausente');
  assert.ok(wf.indexOf('Deploy real do Worker') < idx, 'smoke precisa rodar depois do deploy');
  const bloco = wf.slice(idx);
  assert.ok(bloco.includes('"$base/health"'), 'smoke deve chamar GET /health');
  assert.ok(bloco.includes('.ok == true'), 'smoke deve validar ok:true (status 200 sozinho não basta)');
  assert.ok(bloco.includes('exit 1'), 'smoke deve falhar explicitamente quando o health não responde');
  assert.ok(!bloco.includes('|| true'), 'smoke não pode mascarar falha');
});

test('alerta model_failed: permissão mínima, token do repositório e script que falha alto', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'model-failed-alert.yml'), 'utf8');
  assert.ok(
    wf.includes('permissions:\n  contents: read\n  issues: write'),
    'workflow deve declarar apenas contents: read + issues: write'
  );
  assert.ok(wf.includes('secrets.CLOUDFLARE_API_TOKEN'), 'workflow deve repassar o token da Cloudflare');
  assert.ok(wf.includes('github.token'), 'autenticação do gh deve usar github.token (novo segredo)');
  assert.ok(!wf.includes('pull_request_target'), 'pull_request_target é proibido');
  assert.ok(wf.includes('timeout-minutes:'), 'consulta à API precisa de timeout');
  assert.ok(wf.includes('workflow_dispatch'), 'gatilho manual é obrigatório para validação/rollback');

  const sh = fs.readFileSync(path.join(ROOT, '.github', 'scripts', 'model-failed-alert.sh'), 'utf8');
  assert.ok(sh.includes('set -euo pipefail'), 'script deve abortar no primeiro erro (falha nunca vira sucesso)');
  assert.ok(!sh.includes('set -x'), 'script não pode transpor variáveis (token) no log');
  assert.ok(!sh.includes('curl -v'), 'curl não pode logar headers com o token');
  assert.ok(!sh.includes('|| true'), 'script não pode mascarar falha');
  assert.ok(sh.includes('CLOUDFLARE_API_TOKEN'), 'script usa o token via Authorization header');
  assert.ok(sh.includes('::error::'), 'falha da API deve virar annotation de erro visível na run');
});

test('relatório: seção QA ENVIRONMENT documenta modo, limpeza e exclusão', () => {
  const src = fs.readFileSync(path.join(ROOT, 'e2e', 'reports', 'generate-report.cjs'), 'utf8');
  for (const esperado of ['QA ENVIRONMENT', 'Criada pelo C.O.D.E.', 'Limpeza Firestore', 'Exclusão da conta Auth', 'Arquivo de identidade remanescente']) {
    assert.ok(src.includes(esperado), `relatório deveria incluir "${esperado}"`);
  }
  /* estrito: bloqueio de cleanup derruba o CI */
  assert.ok(src.includes("summary.severity === 'BLOCKED'"), '--strict deve considerar cleanup BLOCKED');
  /* estrito: nenhuma falha vira sucesso silencioso */
  assert.ok(src.includes('counts.FLAKY'), '--strict deve reprovar FLAKY (falhou e passou na repetição)');
  assert.ok(src.includes('tests.length === 0'), '--strict deve reprovar results.json sem nenhum teste');
  assert.ok(src.includes('identityLeftover'), '--strict deve reprovar identidade efêmera não excluída');
  assert.ok(src.includes('sanitizeText'), 'relatório deve passar pelo sanitizador');
});

test('teardown: sempre registrado e nunca derruba a run', () => {
  const cfg = fs.readFileSync(path.join(ROOT, 'playwright.config.js'), 'utf8');
  assert.ok(cfg.includes('globalTeardown'), 'config deve registrar globalTeardown (o "finally" da run)');
  const teardown = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'global-teardown.js'), 'utf8');
  assert.ok(teardown.includes('catch'), 'teardown precisa engolir erro e reportar');
  assert.ok(!teardown.includes('process.exit'), 'teardown não pode encerrar o processo');
});

/* ============ FASE 2/5 do diagnóstico de autenticação (27/09/2026) ======== */
const { hintFor } = require('../helpers/qa-account.js');

test('hintFor: erro de provider vira verificação do estado atual, nunca afirmação', () => {
  for (const code of ['PASSWORD_LOGIN_DISABLED', 'OPERATION_NOT_ALLOWED']) {
    const h = hintFor(code);
    assert.ok(h.includes(code), `o sinal observado deve aparecer no hint: ${code}`);
    assert.ok(/estado ATUAL/i.test(h), 'hint deve pedir verificação do estado atual');
    assert.ok(/execução controlada/i.test(h), 'hint deve pedir validação em execução controlada');
    assert.ok(!/est[aá] desabilitado/i.test(h), 'hint não pode afirmar desabilitação');
    assert.ok(!/habilitar "E\/mail\/senha"/i.test(h), 'hint não pode presumir que está desligado');
  }
  const generico = hintFor('Não foi possível concluir');
  assert.ok(/estado ATUAL/i.test(generico), 'erro genérico também deve pedir verificação');
  assert.ok(!/habilitar/i.test(generico), 'erro genérico não pode presumir provider desligado');
});

test('diagnóstico: nenhuma fonte do C.O.D.E. afirma provider desabilitado sem evidência', () => {
  const fontes = [
    'e2e/helpers/qa-account.js',
    'e2e/README.md',
    'e2e/AUDITORIA.md',
  ];
  for (const rel of fontes) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(
      !txt.includes('o projeto está com e-mail/senha desligado'),
      `${rel}: frase histórica de desabilitação deve ter sido removida`
    );
  }
  /* estado atual informado (Firebase Console, 27/09/2026) documentado */
  const readme = fs.readFileSync(path.join(ROOT, 'e2e', 'README.md'), 'utf8');
  assert.ok(readme.includes('E-mail/senha **ATIVADO**'), 'README deve registrar o estado informado');
  assert.ok(readme.includes('Smartphone **ATIVADO**') && readme.includes('Google **ATIVADO**'),
    'README deve registrar os três provedores informados');
  assert.ok(readme.includes('erro histórico'), 'erro anterior deve ficar classificado como histórico');
  assert.ok(readme.includes('não substituem'), 'Google/Smartphone não podem substituir o fluxo E-mail/senha');
  /* regra de classificação presente no hintFor */
  const qa = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'qa-account.js'), 'utf8');
  assert.ok(qa.includes('evidência'), 'hintFor deve exigir evidência para classificar');
  assert.ok(qa.includes('providerSignals'), 'os códigos devem ser tratados como sinais, não como estado');
});

/* ============ FASE 4 do preparo E2E — relogin sem tocar na propriedade ==== */
test('FASE 4: logout/login reais existem e o relogin nunca rebaixa a propriedade', () => {
  const src = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'qa-account.js'), 'utf8');
  const iLogout = src.indexOf('async function logout(');
  const iLogin = src.indexOf('async function loginOnly(');
  const iSign = src.indexOf('async function signInOrCreate(');
  assert.ok(iLogout > 0 && iLogin > iLogout, 'logout/loginOnly devem existir');
  assert.ok(iSign > iLogin, 'signInOrCreate deve vir depois (assinatura inalterada)');

  const corpoLogin = src.slice(iLogin, iSign);
  assert.ok(!corpoLogin.includes('recordOwnership'), 'loginOnly não pode registrar propriedade');
  assert.ok(!corpoLogin.includes('identity.patch'), 'loginOnly não pode alterar a identidade da run');
  const corpoLogout = src.slice(iLogout, iLogin);
  assert.ok(!corpoLogout.includes('recordOwnership'), 'logout não pode registrar propriedade');
  assert.ok(!corpoLogout.includes('accounts:delete'), 'logout não pode excluir conta');

  const setup = fs.readFileSync(path.join(ROOT, 'e2e', 'auth', 'qa.setup.js'), 'utf8');
  assert.ok(setup.includes('qa.logout(page)'), 'setup deve executar logout real');
  assert.ok(setup.includes('qa.loginOnly(page, creds)'), 'setup deve executar login real');
  assert.ok(
    setup.indexOf('qa.loginOnly') < setup.indexOf('context.storageState'),
    'storageState deve ser salvo APÓS o login real'
  );
  assert.ok(setup.includes('rebaixar a propriedade'), 'setup deve conferir createdByCode após o relogin');
});

/* ==== Provisionamento: proteção contra enumeração esconde "conta inexistente" ==== */
test('provisionamento tenta cadastro quando o login falha (sem depender do texto do erro)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'qa-account.js'), 'utf8');
  const iSign = src.indexOf('async function signInOrCreate(');
  const iHint = src.indexOf('function hintFor(');
  assert.ok(iSign > 0 && iHint > iSign, 'signInOrCreate deve existir antes de hintFor');
  const corpo = src.slice(iSign, iHint);

  assert.ok(
    !corpo.includes('MSG.notFound'),
    'não pode condicionar a criação ao texto "Conta não encontrada" — o Firebase devolve credencial inválida quando protege a enumeração'
  );
  assert.ok(corpo.includes('MSG.exists'), 'deve tratar a colisão "Já existe uma conta" voltando ao login');
  assert.ok(corpo.includes("how: 'signup'"), 'deve registrar o caminho signup');
  assert.ok(corpo.includes('loginErr'), 'deve preservar o erro do login para diagnóstico');

  const iSub1 = corpo.indexOf('await submit(page, creds)');
  const iToggle = corpo.indexOf('await toggleMode(page)');
  const iSub2 = corpo.indexOf('await submit(page, creds)', iSub1 + 1);
  assert.ok(
    iSub1 >= 0 && iToggle > iSub1 && iSub2 > iToggle,
    'fluxo deve ser: login -> cadastro -> (colisão) login'
  );
});

/* ==== Sessão por suíte: Firebase 10 usa IndexedDB (storageState não cobre) ==== */
test('suítes dependentes refazem o login real com trace pausado (senha nunca vira artefato)', () => {
  const qa = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'qa-account.js'), 'utf8');
  const iEnsure = qa.indexOf('async function ensureUiSession(');
  const iFim = qa.indexOf('async function signInOrCreate(', iEnsure);
  assert.ok(iEnsure > 0 && iFim > iEnsure, 'ensureUiSession deve existir');
  const corpo = qa.slice(iEnsure, iFim);
  const iStop = corpo.indexOf('tracing.stop()');
  const iCall = corpo.indexOf('loginOnly(page, creds)');
  const iStart = corpo.indexOf('start({ snapshots');
  assert.ok(iStop >= 0, 'trace deve ser pausado antes do login');
  assert.ok(iStop < iCall, 'pausa do trace deve vir ANTES do login');
  assert.ok(iCall >= 0 && iCall < iStart, 'trace deve ser religado DEPOIS do login (ordem: stop -> login -> start)');
  assert.ok(
    corpo.includes("document.getElementById('authPass')") && corpo.includes("campo.value = ''"),
    'a senha deve sair do DOM logo após o login (sem depender de visibilidade do overlay)'
  );

  for (const spec of ['e2e/smoke/smoke.spec.js', 'e2e/movimentacoes/movimentacao.spec.js']) {
    const src = fs.readFileSync(path.join(ROOT, spec), 'utf8');
    assert.ok(src.includes('qa.ensureUiSession('), `${spec} deve estabelecer a sessão com ensureUiSession`);
    assert.ok(!src.includes('qa.loginOnly('), `${spec} não deve chamar loginOnly diretamente`);
  }
});

/* ==== Evidência de falha: console do app precisa chegar ao relatório ==== */
test('evidência de console é anexada mesmo em FALHA e o relatório embute o corpo', () => {
  for (const spec of ['e2e/smoke/smoke.spec.js', 'e2e/movimentacoes/movimentacao.spec.js']) {
    const src = fs.readFileSync(path.join(ROOT, spec), 'utf8');
    assert.ok(src.includes('test.afterEach('), `${spec} deve anexar evidência em afterEach (falha inclusive)`);
    assert.ok(src.includes('watchAtual = watch'), `${spec} deve registrar o watch no escopo da suíte`);
    assert.ok(
      /\.attach\(testInfo\)/.test(src.slice(src.indexOf('test.afterEach('))),
      `${spec} deve anexar o console-evidencia.txt também quando o teste falha`
    );
  }
  const rel = fs.readFileSync(path.join(ROOT, 'e2e', 'reports', 'generate-report.cjs'), 'utf8');
  assert.ok(rel.includes('decodeTextBodies'), 'o relatório deve decodificar o corpo dos anexos text/*');
  assert.ok(rel.includes('a.corpo'), 'o relatório deve embutir o corpo da evidência na seção de falhas');
  /* forense em arquivo puro: se o base64 do anexo não decodificar, o relatório
     ainda recebe a evidência gravada pela própria suíte */
  const mov = fs.readFileSync(path.join(ROOT, 'e2e', 'movimentacoes', 'movimentacao.spec.js'), 'utf8');
  assert.ok(
    mov.includes('reports') && mov.includes('evidencia') && mov.includes('movimentacao.spec.txt'),
    'a suíte de movimentações deve gravar a forense em e2e/reports/evidencia/'
  );
  assert.ok(rel.includes(`'evidencia'`) && rel.includes('evidFile'), 'o relatório deve embutir a forense da suíte');
});

/* ==== Guard anti-clique-duplo do app (1200ms) não pode engolir o salvar ==== */
test('cliques de salvamento esperam a trava anti-clique-duplo do app liberar', () => {
  const src = fs.readFileSync(path.join(ROOT, 'e2e', 'helpers', 'app.js'), 'utf8');
  assert.ok(src.includes('function esperaTravaAntiDuplo'), 'o helper de espera da trava deve existir');
  const cliques = (re) => (src.match(re) || []).length;
  assert.ok(
    cliques(/page\.click\('#fSalvar'\)/g) === cliques(/esperaTravaAntiDuplo\(page, '#fSalvar'\)/g) &&
      cliques(/page\.click\('#fSalvar'\)/g) >= 1,
    'todo clique em #fSalvar deve ser precedido pela espera da trava anti-duplo'
  );
  assert.ok(
    cliques(/page\.click\('#bSalvar'\)/g) === cliques(/esperaTravaAntiDuplo\(page, '#bSalvar'\)/g),
    'todo clique em #bSalvar deve ser precedido pela espera da trava anti-duplo'
  );
  assert.ok(src.includes('travaAntiDuplo'), 'a evidência de falha deve registrar a trava anti-duplo');
});
