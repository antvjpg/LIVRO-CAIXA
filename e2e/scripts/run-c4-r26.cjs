'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ARTIFACTS = path.join(ROOT, 'e2e/.artifacts');
const CORE = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');
const CORE_266 = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6/c4-v05-b-r2-6-6-core.cjs');
const CORE_A01 = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01/c4-v05-b-r2-6-6-a01-core.cjs');
const CORE_A01B = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6-a01b/c4-v05-b-r2-6-6-a01b-core.cjs');
const VALIDATOR = path.join(ROOT, 'tmp-c13/r2-6-2/validacao-r2-6-3.cjs');
const VALIDATOR_265 = path.join(ROOT, 'tmp-c13/r2-6-5/validacao-r2-6-5.cjs');
const VALIDATOR_266 = path.join(ROOT, 'tmp-c13/r2-6-6/validacao-r2-6-6.cjs');
const VALIDATOR_A01 = path.join(ROOT, 'tmp-c13/r2-6-6-a01/validacao-a01.cjs');
const COMPARADOR_A01 = path.join(ROOT, 'tmp-c13/r2-6-6-a01/teste-comparador-a01.cjs');
const COMPARADOR_A01_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a01-comparador.json');
const VALIDATOR_A01B = path.join(ROOT, 'tmp-c13/r2-6-6-a01b/validacao-a01b.cjs');
const COMPARADOR_A01B = path.join(ROOT, 'tmp-c13/r2-6-6-a01b/teste-comparador-a01b.cjs');
const COMPARADOR_A01B_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a01b-comparador.json');
const VALIDATOR_A02 = path.join(ROOT, 'tmp-c13/r2-6-6-a02/validacao-a02.cjs');
const BILATERAL_A02 = path.join(ROOT, 'tmp-c13/r2-6-6-a02/teste-bilateral-a02.cjs');
const BILATERAL_A02_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a02-bilateral.json');
const VALIDATOR_A02B = path.join(ROOT, 'tmp-c13/r2-6-6-a02b/validacao-a02b.cjs');
const BILATERAL_A02B = path.join(ROOT, 'tmp-c13/r2-6-6-a02b/teste-bilateral-a02b.cjs');
const BILATERAL_A02B_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a02b-bilateral.json');
const VALIDATOR_A03 = path.join(ROOT, 'tmp-c13/r2-6-6-a03/validacao-a03.cjs');
const ESPECIFICIDADE_A03 = path.join(ROOT, 'tmp-c13/r2-6-6-a03/teste-especificidade-a03.cjs');
const ESPECIFICIDADE_A03_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a03-especificidade.json');
const VALIDATOR_A03B = path.join(ROOT, 'tmp-c13/r2-6-6-a03b/validacao-a03b.cjs');
const ESPECIFICIDADE_A03B = path.join(ROOT, 'tmp-c13/r2-6-6-a03b/teste-especificidade-a03b.cjs');
const ESPECIFICIDADE_A03B_ARTIFACT = path.join(ARTIFACTS, 'r2-6-a03b-especificidade.json');
const CORE_R266AUD = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud/c4-v05-b-r2-6-6-r266-aud-core.cjs');
const VALIDATOR_R266AUD = path.join(ROOT, 'tmp-c13/r2-6-6-r266-aud/validacao-r266-aud.cjs');
const TESTE_R266AUD = path.join(ROOT, 'tmp-c13/r2-6-6-r266-aud/teste-r266-aud.cjs');
const TESTE_R266AUD_ARTIFACT = path.join(ARTIFACTS, 'r2-6-r266-aud-unitario.json');
const MATRIZ_R266AUD_OUT = path.join(ARTIFACTS, 'r2-6-r266-aud-matriz.json');
const CORE_266_HISTORICO = CORE_266;
const CORE_266_HISTORICO_SHA256 = '8a6e08d3982c201ad36bd5973f05da7580182f70d0c42691b2279754de0636c4';
const CORE_R266AUDB = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-b/c4-v05-b-r2-6-6-r266-aud-b-core.cjs');
const CORE_R266AUDB_SHA256 = 'f92d7016de979d30c34083f8cb320f9e0f74f4ab7d9916513db467e7c1d43926';
const VALIDATOR_R266AUDB = path.join(ROOT, 'tmp-c13/r2-6-6-r266-aud-b/validacao-r266-aud-b.cjs');
const TESTE_R266AUDB = path.join(ROOT, 'tmp-c13/r2-6-6-r266-aud-b/teste-r266-aud-b.cjs');
const TESTE_R266AUDB_ARTIFACT = path.join(ARTIFACTS, 'r2-6-r266-aud-b-unitario.json');
const MATRIZ_R266AUDB_OUT = path.join(ARTIFACTS, 'r2-6-r266-aud-b-matriz.json');
const MATRIZ_266_HISTORICO_OUT = path.join(ARTIFACTS, 'r2-6-6-historico-matriz.json');
const EXTENSION_266 = path.join(ROOT, 'tmp-c13/r2-6-6/extension');
const REGRESSION = path.join(ROOT, 'tmp-c13/r2-6-4/regressao/test-r2-6.cjs');
const BASELINE = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-results.json');
const MATRIZ_OUT = path.join(ARTIFACTS, 'r2-6-matriz.json');
const MATRIZ_265_OUT = path.join(ARTIFACTS, 'r2-6-5-matriz.json');
const MATRIZ_266_OUT = path.join(ARTIFACTS, 'r2-6-6-matriz.json');
const MATRIZ_A01_OUT = path.join(ARTIFACTS, 'r2-6-a01-matriz.json');
const MATRIZ_A01B_OUT = path.join(ARTIFACTS, 'r2-6-a01b-matriz.json');
const MATRIZ_A02_OUT = path.join(ARTIFACTS, 'r2-6-a02-matriz.json');
const MATRIZ_A02B_OUT = path.join(ARTIFACTS, 'r2-6-a02b-matriz.json');
const MATRIZ_A03_OUT = path.join(ARTIFACTS, 'r2-6-a03-matriz.json');
const MATRIZ_A03B_OUT = path.join(ARTIFACTS, 'r2-6-a03b-matriz.json');
const REG_LOG = path.join(ARTIFACTS, 'r2-6-regressao.log');
const HTTP_LOG = path.join(ARTIFACTS, 'r2-6-http.log');
const CHROME_LOG = path.join(ARTIFACTS, 'r2-6-chromium.log');
const SUMMARY_OUT = path.join(ARTIFACTS, 'r2-6-ci-summary.json');
const CDP_PORT = 9222;
const HTTP_PORT = 8000;

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fail(message) {
  throw new Error(message);
}

async function waitFor(label, url, timeoutMs = 30000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
      lastError = new Error(`${label}: HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`${label} nao ficou pronto em ${timeoutMs}ms: ${lastError && lastError.message}`);
}

function findChromium() {
  const roots = [
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(ROOT, 'node_modules/playwright-core/.local-browsers'),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidates = [
        path.join(root, entry, 'chrome-linux/chrome'),
        path.join(root, entry, 'chrome-linux64/chrome'),
        path.join(root, entry, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'),
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  for (const name of ['chromium-browser', 'chromium', 'google-chrome']) {
    const found = spawnSync('which', [name], { encoding: 'utf8' }).stdout.trim();
    if (found && fs.existsSync(found)) return found;
  }
  fail('Chromium nao encontrado; instale com npx playwright install chromium ou defina CHROME_BIN');
}

function terminate(child) {
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  }, 2000).unref();
}

function parseRegressionRows(text) {
  const rows = [];
  const re = /^\s{2}(PASS|FAIL|BLOCKED):\s*([A-Z][0-9]+[a-z]?):\s*(.*)$/;
  for (const line of text.split(/\r?\n/)) {
    const match = re.exec(line);
    if (match) rows.push({ id: match[2], status: match[1], evidence: match[3] });
  }
  return rows;
}

function countByStatus(rows) {
  return rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
}

function appendStepSummary(summary) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const lines = [
    '## C.4 — R2.6',
    '',
    `Veredito: **${summary.verdict}**`,
    '',
    '| Item | Resultado |',
    '|---|---|',
    `| SHA | \`${summary.sha || 'local'}\` |`,
    `| Node | ${summary.node} |`,
    `| Matriz | ${summary.matrix.PASS} PASS / ${summary.matrix.FAIL} FAIL / ${summary.matrix.BLOCKED} BLOCKED |`,
    `| R2.6.5 | ${summary.r26_5.PASS} PASS / ${summary.r26_5.FAIL} FAIL / ${summary.r26_5.BLOCKED} BLOCKED |`,
    `| R2.6.6 | ${summary.r26_6.PASS} PASS / ${summary.r26_6.FAIL} FAIL / ${summary.r26_6.BLOCKED} BLOCKED | núcleo ${summary.r26_6.nucleoSha256 || 'desconhecido'} |`,
    `| R2.6.6 histórico | ${summary.r26_6_historico.PASS} PASS / ${summary.r26_6_historico.FAIL} FAIL / ${summary.r26_6_historico.BLOCKED} BLOCKED | núcleo ${summary.r26_6_historico.nucleoSha256 || 'desconhecido'} |`,
    `| A-01 | ${summary.a01.PASS} PASS / ${summary.a01.FAIL} FAIL / ${summary.a01.BLOCKED} BLOCKED |`,
    `| A-01B | ${summary.a01b.PASS} PASS / ${summary.a01b.FAIL} FAIL / ${summary.a01b.BLOCKED} BLOCKED |`,
    `| A-02 | ${summary.a02.PASS} PASS / ${summary.a02.FAIL} FAIL / ${summary.a02.BLOCKED} BLOCKED |`,
    `| A-02B | ${summary.a02b.PASS} PASS / ${summary.a02b.FAIL} FAIL / ${summary.a02b.BLOCKED} BLOCKED |`,
    `| A-03 | ${summary.a03.PASS} PASS / ${summary.a03.FAIL} FAIL / ${summary.a03.BLOCKED} BLOCKED |`,
    `| A-03B | ${summary.a03b.PASS} PASS / ${summary.a03b.FAIL} FAIL / ${summary.a03b.BLOCKED} BLOCKED |`,
    `| R266-AUD | ${summary.r266aud.PASS} PASS / ${summary.r266aud.FAIL} FAIL / ${summary.r266aud.BLOCKED} BLOCKED |`,
    `| R266-AUD-B | ${summary.r266audb.PASS} PASS / ${summary.r266audb.FAIL} FAIL / ${summary.r266audb.BLOCKED} BLOCKED | núcleo ${summary.r266audb.nucleoSha256 || 'desconhecido'} |`,
    `| Regressao | ${summary.regression.PASS} PASS / ${summary.regression.FAIL} FAIL / ${summary.regression.BLOCKED} BLOCKED |`,
    `| Divergencias | ${summary.regression.divergences} |`,
    `| Duracao | ${summary.durationMs}ms |`,
    '',
  ];
  if (summary.problems.length) {
    lines.push('### Problemas', '');
    for (const problem of summary.problems) lines.push(`- ${problem}`);
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
}

async function main() {
  const started = Date.now();
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const httpLog = fs.openSync(HTTP_LOG, 'w');
  const chromeLog = fs.openSync(CHROME_LOG, 'w');
  const problems = [];
  let server = null;
  let browser = null;
  let matrix = null;
  let r265 = null;
  let r266 = null;
  let a01 = null;
  let comparadorA01 = null;
  let a01b = null;
  let comparadorA01b = null;
  let a02 = null;
  let bilateralA02 = null;
  let a02b = null;
  let bilateralA02b = null;
  let a03 = null;
  let especificidadeA03 = null;
  let a03b = null;
  let especificidadeA03b = null;
  let r266aud = null;
  let testeR266aud = null;
  let r266audb = null;
  let testeR266audb = null;
  let r266Historico = null;
  let regressionRows = [];
  let baselineRows = [];

  try {
    server = spawn(
      'python3',
      ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'],
      { cwd: ROOT, stdio: ['ignore', httpLog, httpLog] }
    );
    await waitFor('servidor HTTP', `http://127.0.0.1:${HTTP_PORT}/index.html`);

    const executablePath = findChromium();
    if (!fs.existsSync(executablePath)) fail(`Chromium nao encontrado: ${executablePath}`);
    if (!fs.existsSync(EXTENSION_266)) fail(`Extensao R2.6.6 nao encontrada: ${EXTENSION_266}`);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'c4-r26-chrome-'));
    browser = spawn(
      executablePath,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profile}`,
        `--disable-extensions-except=${EXTENSION_266}`,
        `--load-extension=${EXTENSION_266}`,
        'about:blank',
      ],
      { stdio: ['ignore', chromeLog, chromeLog] }
    );
    await waitFor('CDP', `http://127.0.0.1:${CDP_PORT}/json/version`);

    const matrixRun = spawnSync(
      process.execPath,
      [VALIDATOR, `--core=${CORE}`, `--out=${MATRIZ_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (matrixRun.status !== 0) problems.push(`validador R2.6 exit=${matrixRun.status}`);

    matrix = JSON.parse(fs.readFileSync(MATRIZ_OUT, 'utf8'));
    const resumo = matrix.resumo || {};
    if (resumo.total !== 10) problems.push(`matriz total=${resumo.total}, esperado 10`);
    if (resumo.PASS !== 10) problems.push(`matriz PASS=${resumo.PASS}, esperado 10`);
    if (resumo.FAIL !== 0) problems.push(`matriz FAIL=${resumo.FAIL}, esperado 0`);
    if (resumo.BLOCKED !== 0) problems.push(`matriz BLOCKED=${resumo.BLOCKED}, esperado 0`);
    if (resumo.NOT_RUN !== 0) problems.push(`matriz NOT_RUN=${resumo.NOT_RUN}, esperado 0`);
    if (resumo.oraclePASS !== 10) problems.push(`oraculo PASS=${resumo.oraclePASS}, esperado 10`);
    if (!matrix.verification || matrix.verification.hashMatches !== true) problems.push('hash da matriz nao confere');
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = (matrix.erros && matrix.erros[key]) || [];
      if (itens.length) problems.push(`matriz erros.${key}=${itens.length}`);
    }

    const r265Run = spawnSync(
      process.execPath,
      [VALIDATOR_265, `--core=${CORE}`, `--out=${MATRIZ_265_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r265Run.status !== 0) problems.push(`validador R2.6.5 exit=${r265Run.status}`);
    r265 = JSON.parse(fs.readFileSync(MATRIZ_265_OUT, 'utf8'));
    const r265Resumo = r265.resumo || {};
    if (r265Resumo.total !== 13) problems.push(`R2.6.5 total=${r265Resumo.total}, esperado 13`);
    if (r265Resumo.PASS !== 10) problems.push(`R2.6.5 PASS=${r265Resumo.PASS}, esperado 10`);
    if (r265Resumo.FAIL !== 0) problems.push(`R2.6.5 FAIL=${r265Resumo.FAIL}, esperado 0`);
    if (r265Resumo.BLOCKED !== 3) problems.push(`R2.6.5 BLOCKED=${r265Resumo.BLOCKED}, esperado 3`);
    const r265BlockedIds = (r265.casos || [])
      .filter((c) => c.status === 'BLOCKED')
      .map((c) => c.id)
      .sort()
      .join(',');
    if (r265BlockedIds !== 'R265-O3,R265-O4,R265-U1') {
      problems.push(`R2.6.5 BLOCKED IDs=${r265BlockedIds || 'nenhum'}, esperado R265-O3,R265-O4,R265-U1`);
    }
    if (r265Resumo.NOT_RUN !== 0) problems.push(`R2.6.5 NOT_RUN=${r265Resumo.NOT_RUN}, esperado 0`);
    if (r265Resumo.origemPASS !== 3) problems.push(`R2.6.5 origemPASS=${r265Resumo.origemPASS}, esperado 3`);
    if (r265Resumo.especificidadePASS !== 2) problems.push(`R2.6.5 especificidadePASS=${r265Resumo.especificidadePASS}, esperado 2`);
    if (r265Resumo.pseudoelementoPASS !== 5) problems.push(`R2.6.5 pseudoelementoPASS=${r265Resumo.pseudoelementoPASS}, esperado 5`);
    if (!r265.verification || r265.verification.hashMatches !== true) problems.push('hash R2.6.5 nao confere');
    const r265Erros = r265.erros || {};
    if ((r265Erros.console || []).length) problems.push(`R2.6.5 consoleErrors=${r265Erros.console.length}`);
    if ((r265Erros.excecoes || []).length) problems.push(`R2.6.5 exceptions=${r265Erros.excecoes.length}`);
    const cdpInesperados = (r265Erros.cdp || []).filter((e) => String(e.operation || '').indexOf('resolveWinningValue') === -1);
    if (cdpInesperados.length) problems.push(`R2.6.5 cdpErrors inesperados=${cdpInesperados.length}`);

    if (path.resolve(CORE_266) === path.resolve(CORE_R266AUDB)) {
      problems.push('R2.6.6 aponta para o nucleo historico; integracao R266-AUD-B nao efetiva');
    }
    if (sha256File(CORE_266) !== CORE_266_HISTORICO_SHA256) problems.push('SHA do nucleo historico R2.6.6 mudou');
    if (sha256File(CORE_R266AUDB) !== CORE_R266AUDB_SHA256) problems.push('SHA do nucleo R266-AUD-B nao corresponde ao pino');

    const r266Run = spawnSync(
      process.execPath,
      [VALIDATOR_266, `--core=${CORE_R266AUDB}`, `--out=${MATRIZ_266_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r266Run.status !== 0) problems.push(`validador R2.6.6 exit=${r266Run.status}`);
    r266 = JSON.parse(fs.readFileSync(MATRIZ_266_OUT, 'utf8'));
    const r266Resumo = r266.resumo || {};
    if (r266Resumo.total !== 11) problems.push(`R2.6.6 total=${r266Resumo.total}, esperado 11`);
    if (r266Resumo.PASS !== 11) problems.push(`R2.6.6 PASS=${r266Resumo.PASS}, esperado 11`);
    if (r266Resumo.FAIL !== 0) problems.push(`R2.6.6 FAIL=${r266Resumo.FAIL}, esperado 0`);
    if (r266Resumo.BLOCKED !== 0) problems.push(`R2.6.6 BLOCKED=${r266Resumo.BLOCKED}, esperado 0`);
    if (r266Resumo.NOT_RUN !== 0) problems.push(`R2.6.6 NOT_RUN=${r266Resumo.NOT_RUN}, esperado 0`);
    if (r266Resumo.origemPASS !== 3) problems.push(`R2.6.6 origemPASS=${r266Resumo.origemPASS}, esperado 3`);
    if (r266Resumo.especificidadePASS !== 8) problems.push(`R2.6.6 especificidadePASS=${r266Resumo.especificidadePASS}, esperado 8`);
    if (!r266.verification || r266.verification.hashMatches !== true) problems.push('hash R2.6.6 nao confere');
    if (!r266.meta || r266.meta.nucleoSha256 !== CORE_R266AUDB_SHA256) {
      problems.push('matriz R2.6.6 nao registra o nucleo R266-AUD-B');
    }
    const r266Erros = r266.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = r266Erros[key] || [];
      if (itens.length) problems.push(`R2.6.6 erros.${key}=${itens.length}`);
    }
    const injecoesU1 = (r266.casos || []).filter((c) => c.id === 'R265-U1');
    const injecaoU1 = injecoesU1.length === 1 ? injecoesU1[0].injecao : null;
    if (!injecaoU1 || (injecaoU1.confirmado !== true && injecaoU1.title !== 'r266-inject:ok')) {
      problems.push('R2.6.6 injecao USER nao confirmada');
    }

    const r266HistoricoRun = spawnSync(
      process.execPath,
      [VALIDATOR_266, `--core=${CORE_266_HISTORICO}`, `--out=${MATRIZ_266_HISTORICO_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r266HistoricoRun.status !== 0) problems.push(`validador R2.6.6 historico exit=${r266HistoricoRun.status}`);
    r266Historico = JSON.parse(fs.readFileSync(MATRIZ_266_HISTORICO_OUT, 'utf8'));
    const r266HistoricoResumo = r266Historico.resumo || {};
    if (r266HistoricoResumo.total !== 11 || r266HistoricoResumo.PASS !== 11 || r266HistoricoResumo.FAIL !== 0) {
      problems.push('matriz historica R2.6.6 divergiu do baseline');
    }
    if (!r266Historico.meta || r266Historico.meta.nucleoSha256 !== CORE_266_HISTORICO_SHA256) {
      problems.push('matriz historica R2.6.6 nao registra o nucleo historico');
    }

    const comparadorRun = spawnSync(process.execPath, [COMPARADOR_A01, `--out=${COMPARADOR_A01_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (comparadorRun.status !== 0) problems.push(`comparador A-01 exit=${comparadorRun.status}`);
    if (!fs.existsSync(COMPARADOR_A01_ARTIFACT)) {
      problems.push('comparador A-01 sem artifact');
    } else {
      comparadorA01 = JSON.parse(fs.readFileSync(COMPARADOR_A01_ARTIFACT, 'utf8'));
      const comparadorResumo = comparadorA01.resumo || {};
      if (comparadorResumo.total !== 4) problems.push(`comparador A-01 total=${comparadorResumo.total}, esperado 4`);
      if (comparadorResumo.PASS !== 4) problems.push(`comparador A-01 PASS=${comparadorResumo.PASS}, esperado 4`);
      if (comparadorResumo.FAIL !== 0) problems.push(`comparador A-01 FAIL=${comparadorResumo.FAIL}, esperado 0`);
      if (!comparadorA01.verification || comparadorA01.verification.hashMatches !== true) problems.push('hash do comparador A-01 nao confere');
    }

    const a01Run = spawnSync(
      process.execPath,
      [VALIDATOR_A01, `--core=${CORE_A01}`, `--out=${MATRIZ_A01_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a01Run.status !== 0) problems.push(`validador A-01 exit=${a01Run.status}`);
    a01 = JSON.parse(fs.readFileSync(MATRIZ_A01_OUT, 'utf8'));
    const a01Resumo = a01.resumo || {};
    if (a01Resumo.total !== 11) problems.push(`A-01 total=${a01Resumo.total}, esperado 11`);
    if (a01Resumo.PASS !== 11) problems.push(`A-01 PASS=${a01Resumo.PASS}, esperado 11`);
    if (a01Resumo.FAIL !== 0) problems.push(`A-01 FAIL=${a01Resumo.FAIL}, esperado 0`);
    if (a01Resumo.BLOCKED !== 0) problems.push(`A-01 BLOCKED=${a01Resumo.BLOCKED}, esperado 0`);
    if (a01Resumo.NOT_RUN !== 0) problems.push(`A-01 NOT_RUN=${a01Resumo.NOT_RUN}, esperado 0`);
    if (a01Resumo.origemPASS !== 3) problems.push(`A-01 origemPASS=${a01Resumo.origemPASS}, esperado 3`);
    if (a01Resumo.especificidadePASS !== 8) problems.push(`A-01 especificidadePASS=${a01Resumo.especificidadePASS}, esperado 8`);
    if (a01Resumo.provenienciaPASS !== 1) problems.push(`A-01 provenienciaPASS=${a01Resumo.provenienciaPASS}, esperado 1`);
    if (a01Resumo.userBranchExercised !== true) problems.push('A-01 ramo user nao exercitado');
    if (!a01.verification || a01.verification.hashMatches !== true) problems.push('hash A-01 nao confere');
    const a01Erros = a01.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a01Erros[key] || [];
      if (itens.length) problems.push(`A-01 erros.${key}=${itens.length}`);
    }
    const u1A01 = (a01.casos || []).find((c) => c.id === 'R265-U1');
    const vencedorU1 = u1A01 && u1A01.nucleo ? u1A01.nucleo.vencedor : null;
    if (!u1A01 || !u1A01.proveniencia || !vencedorU1 || vencedorU1.origin !== 'user' || vencedorU1.cdpOrigin !== 'user-agent' || vencedorU1.provenance !== 'user') {
      problems.push('A-01 proveniencia USER nao chegou ao vencedor');
    }

    const comparadorBRun = spawnSync(process.execPath, [COMPARADOR_A01B, `--out=${COMPARADOR_A01B_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (comparadorBRun.status !== 0) problems.push(`comparador A-01B exit=${comparadorBRun.status}`);
    if (!fs.existsSync(COMPARADOR_A01B_ARTIFACT)) {
      problems.push('comparador A-01B sem artifact');
    } else {
      comparadorA01b = JSON.parse(fs.readFileSync(COMPARADOR_A01B_ARTIFACT, 'utf8'));
      const comparadorBResumo = comparadorA01b.resumo || {};
      if (comparadorBResumo.total !== 5) problems.push(`comparador A-01B total=${comparadorBResumo.total}, esperado 5`);
      if (comparadorBResumo.PASS !== 5) problems.push(`comparador A-01B PASS=${comparadorBResumo.PASS}, esperado 5`);
      if (comparadorBResumo.FAIL !== 0) problems.push(`comparador A-01B FAIL=${comparadorBResumo.FAIL}, esperado 0`);
      const testeAmbiguo = (comparadorA01b.testes || []).find((t) => String(t.nome || '').indexOf('A4') === 0);
      if (!testeAmbiguo || testeAmbiguo.status !== 'PASS') problems.push('comparador A-01B nao comprovou regra ambigua');
      if (!comparadorA01b.verification || comparadorA01b.verification.hashMatches !== true) problems.push('hash do comparador A-01B nao confere');
    }

    const a01bRun = spawnSync(
      process.execPath,
      [VALIDATOR_A01B, `--core=${CORE_A01B}`, `--out=${MATRIZ_A01B_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a01bRun.status !== 0) problems.push(`validador A-01B exit=${a01bRun.status}`);
    a01b = JSON.parse(fs.readFileSync(MATRIZ_A01B_OUT, 'utf8'));
    const a01bResumo = a01b.resumo || {};
    if (a01bResumo.total !== 11) problems.push(`A-01B total=${a01bResumo.total}, esperado 11`);
    if (a01bResumo.PASS !== 11) problems.push(`A-01B PASS=${a01bResumo.PASS}, esperado 11`);
    if (a01bResumo.FAIL !== 0) problems.push(`A-01B FAIL=${a01bResumo.FAIL}, esperado 0`);
    if (a01bResumo.BLOCKED !== 0) problems.push(`A-01B BLOCKED=${a01bResumo.BLOCKED}, esperado 0`);
    if (a01bResumo.NOT_RUN !== 0) problems.push(`A-01B NOT_RUN=${a01bResumo.NOT_RUN}, esperado 0`);
    if (a01bResumo.provenienciaPASS !== 1) problems.push(`A-01B provenienciaPASS=${a01bResumo.provenienciaPASS}, esperado 1`);
    if (a01bResumo.provenienciaAmbigua !== 0) problems.push(`A-01B provenienciaAmbigua=${a01bResumo.provenienciaAmbigua}, esperado 0`);
    if (a01bResumo.userBranchExercised !== true) problems.push('A-01B ramo user nao exercitado');
    if (!a01b.verification || a01b.verification.hashMatches !== true) problems.push('hash A-01B nao confere');
    const a01bErros = a01b.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a01bErros[key] || [];
      if (itens.length) problems.push(`A-01B erros.${key}=${itens.length}`);
    }
    const u1A01b = (a01b.casos || []).find((c) => c.id === 'R265-U1');
    const resolucaoU1 = u1A01b && u1A01b.nucleo ? (u1A01b.nucleo.provenanceResolution || [])[0] : null;
    if (!resolucaoU1 || resolucaoU1.status !== 'unica' || resolucaoU1.matchCount !== 1) {
      problems.push('A-01B associacao da regra USER nao foi unica');
    }

    const bilateralRun = spawnSync(process.execPath, [BILATERAL_A02, `--out=${BILATERAL_A02_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (bilateralRun.status !== 0) problems.push(`teste bilateral A-02 exit=${bilateralRun.status}`);
    if (!fs.existsSync(BILATERAL_A02_ARTIFACT)) {
      problems.push('teste bilateral A-02 sem artifact');
    } else {
      bilateralA02 = JSON.parse(fs.readFileSync(BILATERAL_A02_ARTIFACT, 'utf8'));
      const bilateralResumo = bilateralA02.resumo || {};
      if (bilateralResumo.total !== 15) problems.push(`A-02 bilateral total=${bilateralResumo.total}, esperado 15`);
      if (bilateralResumo.PASS !== 15) problems.push(`A-02 bilateral PASS=${bilateralResumo.PASS}, esperado 15`);
      if (bilateralResumo.FAIL !== 0) problems.push(`A-02 bilateral FAIL=${bilateralResumo.FAIL}, esperado 0`);
      if (bilateralResumo.positivosPASS !== 3) problems.push(`A-02 positivosPASS=${bilateralResumo.positivosPASS}, esperado 3`);
      if (bilateralResumo.negativosPASS !== 12) problems.push(`A-02 negativosPASS=${bilateralResumo.negativosPASS}, esperado 12`);
      if (!bilateralA02.verification || bilateralA02.verification.hashMatches !== true) problems.push('hash do teste bilateral A-02 nao confere');
    }

    const a02Run = spawnSync(
      process.execPath,
      [VALIDATOR_A02, `--core=${CORE_A01B}`, `--out=${MATRIZ_A02_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a02Run.status !== 0) problems.push(`validador A-02 exit=${a02Run.status}`);
    a02 = JSON.parse(fs.readFileSync(MATRIZ_A02_OUT, 'utf8'));
    const a02Resumo = a02.resumo || {};
    if (a02Resumo.total !== 11) problems.push(`A-02 total=${a02Resumo.total}, esperado 11`);
    if (a02Resumo.PASS !== 11) problems.push(`A-02 PASS=${a02Resumo.PASS}, esperado 11`);
    if (a02Resumo.FAIL !== 0) problems.push(`A-02 FAIL=${a02Resumo.FAIL}, esperado 0`);
    if (a02Resumo.BLOCKED !== 0) problems.push(`A-02 BLOCKED=${a02Resumo.BLOCKED}, esperado 0`);
    if (a02Resumo.NOT_RUN !== 0) problems.push(`A-02 NOT_RUN=${a02Resumo.NOT_RUN}, esperado 0`);
    if (a02Resumo.bilateralPASS !== 3) problems.push(`A-02 bilateralPASS=${a02Resumo.bilateralPASS}, esperado 3`);
    if (a02Resumo.bilateralFAIL !== 0) problems.push(`A-02 bilateralFAIL=${a02Resumo.bilateralFAIL}, esperado 0`);
    if (a02Resumo.disputasEsperadas !== 3) problems.push(`A-02 disputasEsperadas=${a02Resumo.disputasEsperadas}, esperado 3`);
    if (a02Resumo.provenienciaPASS !== 1) problems.push(`A-02 provenienciaPASS=${a02Resumo.provenienciaPASS}, esperado 1`);
    if (a02Resumo.provenienciaAmbigua !== 0) problems.push(`A-02 provenienciaAmbigua=${a02Resumo.provenienciaAmbigua}, esperado 0`);
    if (a02Resumo.userBranchExercised !== true) problems.push('A-02 ramo user nao exercitado');
    if (!a02.verification || a02.verification.hashMatches !== true) problems.push('hash A-02 nao confere');
    const a02Erros = a02.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a02Erros[key] || [];
      if (itens.length) problems.push(`A-02 erros.${key}=${itens.length}`);
    }
    const disputasA02 = (a02.casos || []).filter((c) => ['R265-O3', 'R265-O4', 'R265-U1'].includes(c.id));
    if (disputasA02.length !== 3 || disputasA02.some((c) => !c.disputa || c.disputa.status !== 'PASS' || (c.disputa.concorrentes || []).length !== 2)) {
      problems.push('A-02 disputas bilaterais incompletas');
    }

    const bilateralBRun = spawnSync(process.execPath, [BILATERAL_A02B, `--out=${BILATERAL_A02B_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (bilateralBRun.status !== 0) problems.push(`teste bilateral A-02B exit=${bilateralBRun.status}`);
    if (!fs.existsSync(BILATERAL_A02B_ARTIFACT)) {
      problems.push('teste bilateral A-02B sem artifact');
    } else {
      bilateralA02b = JSON.parse(fs.readFileSync(BILATERAL_A02B_ARTIFACT, 'utf8'));
      const bilateralBResumo = bilateralA02b.resumo || {};
      if (bilateralBResumo.total !== 20) problems.push(`A-02B bilateral total=${bilateralBResumo.total}, esperado 20`);
      if (bilateralBResumo.PASS !== 20) problems.push(`A-02B bilateral PASS=${bilateralBResumo.PASS}, esperado 20`);
      if (bilateralBResumo.FAIL !== 0) problems.push(`A-02B bilateral FAIL=${bilateralBResumo.FAIL}, esperado 0`);
      if (bilateralBResumo.positivosPASS !== 3) problems.push(`A-02B positivosPASS=${bilateralBResumo.positivosPASS}, esperado 3`);
      if (bilateralBResumo.negativosPASS !== 17) problems.push(`A-02B negativosPASS=${bilateralBResumo.negativosPASS}, esperado 17`);
      if (!bilateralA02b.verification || bilateralA02b.verification.hashMatches !== true) problems.push('hash do teste bilateral A-02B nao confere');
    }

    const a02bRun = spawnSync(
      process.execPath,
      [VALIDATOR_A02B, `--core=${CORE_A01B}`, `--out=${MATRIZ_A02B_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a02bRun.status !== 0) problems.push(`validador A-02B exit=${a02bRun.status}`);
    a02b = JSON.parse(fs.readFileSync(MATRIZ_A02B_OUT, 'utf8'));
    const a02bResumo = a02b.resumo || {};
    if (a02bResumo.total !== 11) problems.push(`A-02B total=${a02bResumo.total}, esperado 11`);
    if (a02bResumo.PASS !== 11) problems.push(`A-02B PASS=${a02bResumo.PASS}, esperado 11`);
    if (a02bResumo.FAIL !== 0) problems.push(`A-02B FAIL=${a02bResumo.FAIL}, esperado 0`);
    if (a02bResumo.BLOCKED !== 0) problems.push(`A-02B BLOCKED=${a02bResumo.BLOCKED}, esperado 0`);
    if (a02bResumo.NOT_RUN !== 0) problems.push(`A-02B NOT_RUN=${a02bResumo.NOT_RUN}, esperado 0`);
    if (a02bResumo.bilateralPASS !== 3) problems.push(`A-02B bilateralPASS=${a02bResumo.bilateralPASS}, esperado 3`);
    if (a02bResumo.bilateralFAIL !== 0) problems.push(`A-02B bilateralFAIL=${a02bResumo.bilateralFAIL}, esperado 0`);
    if (a02bResumo.disputasEsperadas !== 3) problems.push(`A-02B disputasEsperadas=${a02bResumo.disputasEsperadas}, esperado 3`);
    if (a02bResumo.provenienciaPASS !== 1) problems.push(`A-02B provenienciaPASS=${a02bResumo.provenienciaPASS}, esperado 1`);
    if (a02bResumo.provenienciaAmbigua !== 0) problems.push(`A-02B provenienciaAmbigua=${a02bResumo.provenienciaAmbigua}, esperado 0`);
    if (a02bResumo.userBranchExercised !== true) problems.push('A-02B ramo user nao exercitado');
    if (!a02b.verification || a02b.verification.hashMatches !== true) problems.push('hash A-02B nao confere');
    const a02bErros = a02b.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a02bErros[key] || [];
      if (itens.length) problems.push(`A-02B erros.${key}=${itens.length}`);
    }
    const disputasA02b = (a02b.casos || []).filter((c) => ['R265-O3', 'R265-O4', 'R265-U1'].includes(c.id));
    if (disputasA02b.length !== 3 || disputasA02b.some((c) => !c.disputa || c.disputa.status !== 'PASS' || (c.disputa.concorrentes || []).length !== 2)) {
      problems.push('A-02B disputas bilaterais incompletas');
    }

    const especificidadeRun = spawnSync(process.execPath, [ESPECIFICIDADE_A03, `--out=${ESPECIFICIDADE_A03_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (especificidadeRun.status !== 0) problems.push(`teste de especificidade A-03 exit=${especificidadeRun.status}`);
    if (!fs.existsSync(ESPECIFICIDADE_A03_ARTIFACT)) {
      problems.push('teste de especificidade A-03 sem artifact');
    } else {
      especificidadeA03 = JSON.parse(fs.readFileSync(ESPECIFICIDADE_A03_ARTIFACT, 'utf8'));
      const especificidadeResumo = especificidadeA03.resumo || {};
      if (especificidadeResumo.total !== 10) problems.push(`A-03 especificidade total=${especificidadeResumo.total}, esperado 10`);
      if (especificidadeResumo.PASS !== 10) problems.push(`A-03 especificidade PASS=${especificidadeResumo.PASS}, esperado 10`);
      if (especificidadeResumo.FAIL !== 0) problems.push(`A-03 especificidade FAIL=${especificidadeResumo.FAIL}, esperado 0`);
      if (!especificidadeA03.verification || especificidadeA03.verification.hashMatches !== true) problems.push('hash do teste de especificidade A-03 nao confere');
    }

    const a03Run = spawnSync(
      process.execPath,
      [VALIDATOR_A03, `--core=${CORE_A01B}`, `--out=${MATRIZ_A03_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a03Run.status !== 0) problems.push(`validador A-03 exit=${a03Run.status}`);
    a03 = JSON.parse(fs.readFileSync(MATRIZ_A03_OUT, 'utf8'));
    const a03Resumo = a03.resumo || {};
    if (a03Resumo.total !== 12) problems.push(`A-03 total=${a03Resumo.total}, esperado 12`);
    if (a03Resumo.PASS !== 12) problems.push(`A-03 PASS=${a03Resumo.PASS}, esperado 12`);
    if (a03Resumo.FAIL !== 0) problems.push(`A-03 FAIL=${a03Resumo.FAIL}, esperado 0`);
    if (a03Resumo.BLOCKED !== 0) problems.push(`A-03 BLOCKED=${a03Resumo.BLOCKED}, esperado 0`);
    if (a03Resumo.NOT_RUN !== 0) problems.push(`A-03 NOT_RUN=${a03Resumo.NOT_RUN}, esperado 0`);
    if (a03Resumo.origemPASS !== 3) problems.push(`A-03 origemPASS=${a03Resumo.origemPASS}, esperado 3`);
    if (a03Resumo.especificidadePASS !== 9) problems.push(`A-03 especificidadePASS=${a03Resumo.especificidadePASS}, esperado 9`);
    if (a03Resumo.provenienciaPASS !== 1) problems.push(`A-03 provenienciaPASS=${a03Resumo.provenienciaPASS}, esperado 1`);
    if (a03Resumo.provenienciaAmbigua !== 0) problems.push(`A-03 provenienciaAmbigua=${a03Resumo.provenienciaAmbigua}, esperado 0`);
    if (a03Resumo.userBranchExercised !== true) problems.push('A-03 ramo user nao exercitado');
    if (a03Resumo.bilateralPASS !== 3) problems.push(`A-03 bilateralPASS=${a03Resumo.bilateralPASS}, esperado 3`);
    if (a03Resumo.bilateralFAIL !== 0) problems.push(`A-03 bilateralFAIL=${a03Resumo.bilateralFAIL}, esperado 0`);
    if (a03Resumo.disputasEsperadas !== 3) problems.push(`A-03 disputasEsperadas=${a03Resumo.disputasEsperadas}, esperado 3`);
    if (a03Resumo.especificidadeDiagnosticaPASS !== 1) problems.push(`A-03 especificidadeDiagnosticaPASS=${a03Resumo.especificidadeDiagnosticaPASS}, esperado 1`);
    if (!a03.verification || a03.verification.hashMatches !== true) problems.push('hash A-03 nao confere');
    const a03Erros = a03.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a03Erros[key] || [];
      if (itens.length) problems.push(`A-03 erros.${key}=${itens.length}`);
    }
    const casoGrupo = (a03.casos || []).find((c) => c.id === 'R266-S9');
    if (!casoGrupo || casoGrupo.status !== 'PASS' || !casoGrupo.diagnostico || casoGrupo.diagnostico.especificidade.a !== 1 || casoGrupo.diagnostico.especificidade.b !== 1 || casoGrupo.diagnostico.especificidade.c !== 0) {
      problems.push('A-03 diagnostico de seletores agrupados incorreto');
    }

    const especificidadeBRun = spawnSync(process.execPath, [ESPECIFICIDADE_A03B, `--out=${ESPECIFICIDADE_A03B_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (especificidadeBRun.status !== 0) problems.push(`teste de especificidade A-03B exit=${especificidadeBRun.status}`);
    if (!fs.existsSync(ESPECIFICIDADE_A03B_ARTIFACT)) {
      problems.push('teste de especificidade A-03B sem artifact');
    } else {
      especificidadeA03b = JSON.parse(fs.readFileSync(ESPECIFICIDADE_A03B_ARTIFACT, 'utf8'));
      const resumoB = especificidadeA03b.resumo || {};
      if (resumoB.total !== 12) problems.push(`A-03B especificidade total=${resumoB.total}, esperado 12`);
      if (resumoB.PASS !== 12) problems.push(`A-03B especificidade PASS=${resumoB.PASS}, esperado 12`);
      if (resumoB.FAIL !== 0) problems.push(`A-03B especificidade FAIL=${resumoB.FAIL}, esperado 0`);
      const testeParcial = (especificidadeA03b.testes || []).find((t) => t.nome.indexOf('A11') === 0);
      if (!testeParcial || testeParcial.status !== 'PASS' || !testeParcial.avaliacao || testeParcial.avaliacao.status !== 'insuficiente') {
        problems.push('A-03B nao comprovou metadado parcialmente indisponivel');
      }
      const testeIndices = (especificidadeA03b.testes || []).find((t) => t.nome.indexOf('A12') === 0);
      if (!testeIndices || testeIndices.status !== 'PASS' || !testeIndices.avaliacao || JSON.stringify(testeIndices.avaliacao.indicesValidos) !== JSON.stringify([1, 0])) {
        problems.push('A-03B nao registrou os indices correspondentes');
      }
      if (!especificidadeA03b.verification || especificidadeA03b.verification.hashMatches !== true) problems.push('hash do teste de especificidade A-03B nao confere');
    }

    const a03bRun = spawnSync(
      process.execPath,
      [VALIDATOR_A03B, `--core=${CORE_A01B}`, `--out=${MATRIZ_A03B_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (a03bRun.status !== 0) problems.push(`validador A-03B exit=${a03bRun.status}`);
    a03b = JSON.parse(fs.readFileSync(MATRIZ_A03B_OUT, 'utf8'));
    const a03bResumo = a03b.resumo || {};
    if (a03bResumo.total !== 12) problems.push(`A-03B total=${a03bResumo.total}, esperado 12`);
    if (a03bResumo.PASS !== 12) problems.push(`A-03B PASS=${a03bResumo.PASS}, esperado 12`);
    if (a03bResumo.FAIL !== 0) problems.push(`A-03B FAIL=${a03bResumo.FAIL}, esperado 0`);
    if (a03bResumo.BLOCKED !== 0) problems.push(`A-03B BLOCKED=${a03bResumo.BLOCKED}, esperado 0`);
    if (a03bResumo.NOT_RUN !== 0) problems.push(`A-03B NOT_RUN=${a03bResumo.NOT_RUN}, esperado 0`);
    if (a03bResumo.origemPASS !== 3) problems.push(`A-03B origemPASS=${a03bResumo.origemPASS}, esperado 3`);
    if (a03bResumo.especificidadePASS !== 9) problems.push(`A-03B especificidadePASS=${a03bResumo.especificidadePASS}, esperado 9`);
    if (a03bResumo.provenienciaPASS !== 1) problems.push(`A-03B provenienciaPASS=${a03bResumo.provenienciaPASS}, esperado 1`);
    if (a03bResumo.provenienciaAmbigua !== 0) problems.push(`A-03B provenienciaAmbigua=${a03bResumo.provenienciaAmbigua}, esperado 0`);
    if (a03bResumo.userBranchExercised !== true) problems.push('A-03B ramo user nao exercitado');
    if (a03bResumo.bilateralPASS !== 3) problems.push(`A-03B bilateralPASS=${a03bResumo.bilateralPASS}, esperado 3`);
    if (a03bResumo.bilateralFAIL !== 0) problems.push(`A-03B bilateralFAIL=${a03bResumo.bilateralFAIL}, esperado 0`);
    if (a03bResumo.disputasEsperadas !== 3) problems.push(`A-03B disputasEsperadas=${a03bResumo.disputasEsperadas}, esperado 3`);
    if (a03bResumo.especificidadeDiagnosticaPASS !== 1) problems.push(`A-03B especificidadeDiagnosticaPASS=${a03bResumo.especificidadeDiagnosticaPASS}, esperado 1`);
    if (a03bResumo.indicesCorrespondentesPASS !== 1) problems.push(`A-03B indicesCorrespondentesPASS=${a03bResumo.indicesCorrespondentesPASS}, esperado 1`);
    if (!a03b.verification || a03b.verification.hashMatches !== true) problems.push('hash A-03B nao confere');
    const a03bErros = a03b.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = a03bErros[key] || [];
      if (itens.length) problems.push(`A-03B erros.${key}=${itens.length}`);
    }
    const casoGrupoB = (a03b.casos || []).find((c) => c.id === 'R266-S9');
    if (!casoGrupoB || casoGrupoB.status !== 'PASS' || !casoGrupoB.diagnostico || casoGrupoB.diagnostico.status !== 'maximo' || (casoGrupoB.diagnostico.indicesCorrespondentes || []).length < 2 || (casoGrupoB.diagnostico.indicesSemEspecificidade || []).length !== 0) {
      problems.push('A-03B evidencia de seletores agrupados incompleta');
    }

    const testeR266AudRun = spawnSync(process.execPath, [TESTE_R266AUD, `--out=${TESTE_R266AUD_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (testeR266AudRun.status !== 0) problems.push(`teste R266-AUD exit=${testeR266AudRun.status}`);
    if (!fs.existsSync(TESTE_R266AUD_ARTIFACT)) {
      problems.push('teste R266-AUD sem artifact');
    } else {
      testeR266aud = JSON.parse(fs.readFileSync(TESTE_R266AUD_ARTIFACT, 'utf8'));
      const resumoTeste = testeR266aud.resumo || {};
      if (resumoTeste.total !== 25) problems.push(`R266-AUD unitario total=${resumoTeste.total}, esperado 25`);
      if (resumoTeste.PASS !== 25) problems.push(`R266-AUD unitario PASS=${resumoTeste.PASS}, esperado 25`);
      if (resumoTeste.FAIL !== 0) problems.push(`R266-AUD unitario FAIL=${resumoTeste.FAIL}, esperado 0`);
      for (const id of ['S7', 'S8', 'S9', 'S10', 'S11', 'H7', 'H8', 'P1', 'P2', 'P3']) {
        const teste = (testeR266aud.testes || []).find((item) => item.id === id);
        if (!teste || teste.status !== 'PASS') problems.push(`R266-AUD unitario caso ${id} nao PASS`);
      }
      if (!testeR266aud.verification || testeR266aud.verification.hashMatches !== true) problems.push('hash do teste R266-AUD nao confere');
    }

    const r266AudRun = spawnSync(
      process.execPath,
      [VALIDATOR_R266AUD, `--core=${CORE_R266AUD}`, `--out=${MATRIZ_R266AUD_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r266AudRun.status !== 0) problems.push(`validador R266-AUD exit=${r266AudRun.status}`);
    r266aud = JSON.parse(fs.readFileSync(MATRIZ_R266AUD_OUT, 'utf8'));
    const r266AudResumo = r266aud.resumo || {};
    if (r266AudResumo.total !== 7) problems.push(`R266-AUD total=${r266AudResumo.total}, esperado 7`);
    if (r266AudResumo.PASS !== 7) problems.push(`R266-AUD PASS=${r266AudResumo.PASS}, esperado 7`);
    if (r266AudResumo.FAIL !== 0) problems.push(`R266-AUD FAIL=${r266AudResumo.FAIL}, esperado 0`);
    if (r266AudResumo.BLOCKED !== 0) problems.push(`R266-AUD BLOCKED=${r266AudResumo.BLOCKED}, esperado 0`);
    if (r266AudResumo.NOT_RUN !== 0) problems.push(`R266-AUD NOT_RUN=${r266AudResumo.NOT_RUN}, esperado 0`);
    if (r266AudResumo.cromiumReal !== 6) problems.push(`R266-AUD cromiumReal=${r266AudResumo.cromiumReal}, esperado 6`);
    if (r266AudResumo.cenarioSintetico !== 1) problems.push(`R266-AUD cenarioSintetico=${r266AudResumo.cenarioSintetico}, esperado 1`);
    for (const id of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']) {
      const caso = (r266aud.casos || []).find((item) => item.id === id);
      if (!caso || caso.status !== 'PASS') problems.push(`R266-AUD caso ${id} nao PASS`);
    }
    if (!r266aud.verification || r266aud.verification.hashMatches !== true) problems.push('hash R266-AUD nao confere');
    const r266AudErros = r266aud.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = r266AudErros[key] || [];
      if (itens.length) problems.push(`R266-AUD erros.${key}=${itens.length}`);
    }
    const h1 = (r266aud.casos || []).find((item) => item.id === 'H1');
    if (!h1 || !h1.ancestral || h1.ancestral.providerLevel !== 1
      || (!h1.ancestral.providerNodeId && h1.ancestral.providerIdentifiedBy !== 'cdp-ordem')) {
      problems.push('R266-AUD H1 nao identificou o ancestral imediato');
    }
    const h6 = (r266aud.casos || []).find((item) => item.id === 'H6');
    if (!h6 || !h6.recebedor || !h6.ancestral || h6.ancestral.providerLevel !== 2
      || !h6.declaracaoOrigem || h6.declaracaoOrigem.selectorText !== '#h6-avo'
      || h6.recebedor.nodeId === h6.ancestral.providerNodeId) {
      problems.push('R266-AUD H6 nao distinguiu recebedor e origem');
    }

    const testeR266AudbRun = spawnSync(process.execPath, [TESTE_R266AUDB, `--out=${TESTE_R266AUDB_ARTIFACT}`], { cwd: ROOT, stdio: 'inherit' });
    if (testeR266AudbRun.status !== 0) problems.push(`teste R266-AUD-B exit=${testeR266AudbRun.status}`);
    if (!fs.existsSync(TESTE_R266AUDB_ARTIFACT)) {
      problems.push('teste R266-AUD-B sem artifact');
    } else {
      testeR266audb = JSON.parse(fs.readFileSync(TESTE_R266AUDB_ARTIFACT, 'utf8'));
      const resumoTesteB = testeR266audb.resumo || {};
      if (resumoTesteB.total !== 24) problems.push(`R266-AUD-B unitario total=${resumoTesteB.total}, esperado 24`);
      if (resumoTesteB.PASS !== 24) problems.push(`R266-AUD-B unitario PASS=${resumoTesteB.PASS}, esperado 24`);
      if (resumoTesteB.FAIL !== 0) problems.push(`R266-AUD-B unitario FAIL=${resumoTesteB.FAIL}, esperado 0`);
      for (const id of ['N01', 'N02', 'N04', 'N05', 'N06', 'N07', 'N08', 'D01', 'D02', 'D03', 'D05', 'L01', 'L02', 'L03', 'L04']) {
        const teste = (testeR266audb.testes || []).find((item) => item.id === id);
        if (!teste || teste.status !== 'PASS') problems.push(`R266-AUD-B unitario caso ${id} nao PASS`);
      }
      if (!testeR266audb.meta || testeR266audb.meta.coreSha256 !== CORE_R266AUDB_SHA256) problems.push('teste R266-AUD-B nao registra o nucleo correto');
      if (!testeR266audb.verification || testeR266audb.verification.hashMatches !== true) problems.push('hash do teste R266-AUD-B nao confere');
    }

    const r266AudbRun = spawnSync(
      process.execPath,
      [VALIDATOR_R266AUDB, `--core=${CORE_R266AUDB}`, `--out=${MATRIZ_R266AUDB_OUT}`],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (r266AudbRun.status !== 0) problems.push(`validador R266-AUD-B exit=${r266AudbRun.status}`);
    r266audb = JSON.parse(fs.readFileSync(MATRIZ_R266AUDB_OUT, 'utf8'));
    const r266AudbResumo = r266audb.resumo || {};
    if (r266AudbResumo.total !== 7) problems.push(`R266-AUD-B total=${r266AudbResumo.total}, esperado 7`);
    if (r266AudbResumo.PASS !== 7) problems.push(`R266-AUD-B PASS=${r266AudbResumo.PASS}, esperado 7`);
    if (r266AudbResumo.FAIL !== 0) problems.push(`R266-AUD-B FAIL=${r266AudbResumo.FAIL}, esperado 0`);
    if (r266AudbResumo.BLOCKED !== 0) problems.push(`R266-AUD-B BLOCKED=${r266AudbResumo.BLOCKED}, esperado 0`);
    if (r266AudbResumo.cromiumReal !== 6) problems.push(`R266-AUD-B cromiumReal=${r266AudbResumo.cromiumReal}, esperado 6`);
    if (r266AudbResumo.cenarioSintetico !== 1) problems.push(`R266-AUD-B cenarioSintetico=${r266AudbResumo.cenarioSintetico}, esperado 1`);
    if (!r266audb.meta || r266audb.meta.coreSha256 !== CORE_R266AUDB_SHA256) problems.push('matriz R266-AUD-B nao registra o nucleo correto');
    for (const id of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']) {
      const caso = (r266audb.casos || []).find((item) => item.id === id);
      if (!caso || caso.status !== 'PASS') problems.push(`R266-AUD-B caso ${id} nao PASS`);
    }
    const h1b = (r266audb.casos || []).find((item) => item.id === 'H1');
    if (!h1b || !h1b.metadados || h1b.metadados.identityStatus !== 'inconclusivo' || h1b.metadados.winnerConfidence !== 'condicionado') {
      problems.push('R266-AUD-B H1 nao marcou identidade inconclusiva e confianca condicionada');
    }
    if (!r266audb.verification || r266audb.verification.hashMatches !== true) problems.push('hash R266-AUD-B nao confere');
    const r266AudbErros = r266audb.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = r266AudbErros[key] || [];
      if (itens.length) problems.push(`R266-AUD-B erros.${key}=${itens.length}`);
    }

    const regressionRun = spawnSync(process.execPath, [REGRESSION], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    const regressionText = `${regressionRun.stdout || ''}${regressionRun.stderr || ''}`;
    fs.writeFileSync(REG_LOG, regressionText);
    if (regressionRun.status !== 0) problems.push(`regressao exit=${regressionRun.status}`);

    regressionRows = parseRegressionRows(regressionText);
    baselineRows = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).tests || [];
    let divergences = 0;
    const limit = Math.min(regressionRows.length, baselineRows.length);
    for (let i = 0; i < limit; i += 1) {
      if (regressionRows[i].id !== baselineRows[i].id || regressionRows[i].status !== baselineRows[i].status) {
        divergences += 1;
      }
    }
    if (regressionRows.length !== baselineRows.length) {
      problems.push(`regressao registros=${regressionRows.length}, baseline=${baselineRows.length}`);
    }
    if (divergences !== 0) problems.push(`regressao divergencias=${divergences}`);

    const regressionCounts = countByStatus(regressionRows);
    if ((regressionCounts.PASS || 0) !== 392) problems.push(`regressao PASS=${regressionCounts.PASS || 0}, esperado 392`);
    if ((regressionCounts.FAIL || 0) !== 0) problems.push(`regressao FAIL=${regressionCounts.FAIL || 0}, esperado 0`);
    if ((regressionCounts.BLOCKED || 0) !== 1) problems.push(`regressao BLOCKED=${regressionCounts.BLOCKED || 0}, esperado 1`);
    const blockedIds = regressionRows.filter((row) => row.status === 'BLOCKED').map((row) => row.id);
    if (blockedIds.join(',') !== 'V32') problems.push(`regressao BLOCKED IDs=${blockedIds.join(',') || 'nenhum'}, esperado V32`);
  } finally {
    terminate(browser);
    terminate(server);
    fs.closeSync(httpLog);
    fs.closeSync(chromeLog);
  }

  const summary = {
    id: 'C4-R26-CI',
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    sha: process.env.GITHUB_SHA || null,
    node: process.version,
    core: CORE,
    core266: CORE_R266AUDB,
    core266Historico: CORE_266_HISTORICO,
    coreA01: CORE_A01,
    coreA01b: CORE_A01B,
    nucleos: {
      r26: { path: CORE, sha256: sha256File(CORE) },
      r265: { path: CORE, sha256: sha256File(CORE) },
      r266: { path: CORE_R266AUDB, sha256: sha256File(CORE_R266AUDB) },
      r266Historico: { path: CORE_266_HISTORICO, sha256: sha256File(CORE_266_HISTORICO) },
      a01: { path: CORE_A01, sha256: sha256File(CORE_A01) },
      a01b: { path: CORE_A01B, sha256: sha256File(CORE_A01B) },
      r266aud: { path: CORE_R266AUD, sha256: sha256File(CORE_R266AUD) },
      r266audb: { path: CORE_R266AUDB, sha256: sha256File(CORE_R266AUDB) },
    },
    matrix: {
      PASS: (matrix && matrix.resumo && matrix.resumo.PASS) || 0,
      FAIL: (matrix && matrix.resumo && matrix.resumo.FAIL) || 0,
      BLOCKED: (matrix && matrix.resumo && matrix.resumo.BLOCKED) || 0,
      oraclePASS: (matrix && matrix.resumo && matrix.resumo.oraclePASS) || 0,
    },
    r26_5: {
      PASS: (r265 && r265.resumo && r265.resumo.PASS) || 0,
      FAIL: (r265 && r265.resumo && r265.resumo.FAIL) || 0,
      BLOCKED: (r265 && r265.resumo && r265.resumo.BLOCKED) || 0,
      NOT_RUN: (r265 && r265.resumo && r265.resumo.NOT_RUN) || 0,
    },
    r26_6: {
      PASS: (r266 && r266.resumo && r266.resumo.PASS) || 0,
      FAIL: (r266 && r266.resumo && r266.resumo.FAIL) || 0,
      BLOCKED: (r266 && r266.resumo && r266.resumo.BLOCKED) || 0,
      NOT_RUN: (r266 && r266.resumo && r266.resumo.NOT_RUN) || 0,
      nucleoSha256: (r266 && r266.meta && r266.meta.nucleoSha256) || null,
    },
    r26_6_historico: {
      PASS: (r266Historico && r266Historico.resumo && r266Historico.resumo.PASS) || 0,
      FAIL: (r266Historico && r266Historico.resumo && r266Historico.resumo.FAIL) || 0,
      BLOCKED: (r266Historico && r266Historico.resumo && r266Historico.resumo.BLOCKED) || 0,
      NOT_RUN: (r266Historico && r266Historico.resumo && r266Historico.resumo.NOT_RUN) || 0,
      nucleoSha256: (r266Historico && r266Historico.meta && r266Historico.meta.nucleoSha256) || null,
    },
    a01: {
      PASS: (a01 && a01.resumo && a01.resumo.PASS) || 0,
      FAIL: (a01 && a01.resumo && a01.resumo.FAIL) || 0,
      BLOCKED: (a01 && a01.resumo && a01.resumo.BLOCKED) || 0,
      NOT_RUN: (a01 && a01.resumo && a01.resumo.NOT_RUN) || 0,
      provenienciaPASS: (a01 && a01.resumo && a01.resumo.provenienciaPASS) || 0,
      userBranchExercised: Boolean(a01 && a01.resumo && a01.resumo.userBranchExercised),
      comparadorPASS: comparadorA01 && comparadorA01.resumo ? comparadorA01.resumo.PASS || 0 : 0,
    },
    a01b: {
      PASS: (a01b && a01b.resumo && a01b.resumo.PASS) || 0,
      FAIL: (a01b && a01b.resumo && a01b.resumo.FAIL) || 0,
      BLOCKED: (a01b && a01b.resumo && a01b.resumo.BLOCKED) || 0,
      NOT_RUN: (a01b && a01b.resumo && a01b.resumo.NOT_RUN) || 0,
      provenienciaPASS: (a01b && a01b.resumo && a01b.resumo.provenienciaPASS) || 0,
      provenienciaAmbigua: (a01b && a01b.resumo && a01b.resumo.provenienciaAmbigua) || 0,
      userBranchExercised: Boolean(a01b && a01b.resumo && a01b.resumo.userBranchExercised),
      comparadorPASS: comparadorA01b && comparadorA01b.resumo ? comparadorA01b.resumo.PASS || 0 : 0,
    },
    a02: {
      PASS: (a02 && a02.resumo && a02.resumo.PASS) || 0,
      FAIL: (a02 && a02.resumo && a02.resumo.FAIL) || 0,
      BLOCKED: (a02 && a02.resumo && a02.resumo.BLOCKED) || 0,
      NOT_RUN: (a02 && a02.resumo && a02.resumo.NOT_RUN) || 0,
      bilateralPASS: (a02 && a02.resumo && a02.resumo.bilateralPASS) || 0,
      bilateralFAIL: (a02 && a02.resumo && a02.resumo.bilateralFAIL) || 0,
      disputasEsperadas: (a02 && a02.resumo && a02.resumo.disputasEsperadas) || 0,
      testeBilateralPASS: bilateralA02 && bilateralA02.resumo ? bilateralA02.resumo.PASS || 0 : 0,
      negativosPASS: bilateralA02 && bilateralA02.resumo ? bilateralA02.resumo.negativosPASS || 0 : 0,
    },
    a02b: {
      PASS: (a02b && a02b.resumo && a02b.resumo.PASS) || 0,
      FAIL: (a02b && a02b.resumo && a02b.resumo.FAIL) || 0,
      BLOCKED: (a02b && a02b.resumo && a02b.resumo.BLOCKED) || 0,
      NOT_RUN: (a02b && a02b.resumo && a02b.resumo.NOT_RUN) || 0,
      bilateralPASS: (a02b && a02b.resumo && a02b.resumo.bilateralPASS) || 0,
      bilateralFAIL: (a02b && a02b.resumo && a02b.resumo.bilateralFAIL) || 0,
      disputasEsperadas: (a02b && a02b.resumo && a02b.resumo.disputasEsperadas) || 0,
      testeBilateralPASS: bilateralA02b && bilateralA02b.resumo ? bilateralA02b.resumo.PASS || 0 : 0,
      negativosPASS: bilateralA02b && bilateralA02b.resumo ? bilateralA02b.resumo.negativosPASS || 0 : 0,
    },
    a03: {
      PASS: (a03 && a03.resumo && a03.resumo.PASS) || 0,
      FAIL: (a03 && a03.resumo && a03.resumo.FAIL) || 0,
      BLOCKED: (a03 && a03.resumo && a03.resumo.BLOCKED) || 0,
      NOT_RUN: (a03 && a03.resumo && a03.resumo.NOT_RUN) || 0,
      especificidadeDiagnosticaPASS: (a03 && a03.resumo && a03.resumo.especificidadeDiagnosticaPASS) || 0,
      testeEspecificidadePASS: especificidadeA03 && especificidadeA03.resumo ? especificidadeA03.resumo.PASS || 0 : 0,
    },
    a03b: {
      PASS: (a03b && a03b.resumo && a03b.resumo.PASS) || 0,
      FAIL: (a03b && a03b.resumo && a03b.resumo.FAIL) || 0,
      BLOCKED: (a03b && a03b.resumo && a03b.resumo.BLOCKED) || 0,
      NOT_RUN: (a03b && a03b.resumo && a03b.resumo.NOT_RUN) || 0,
      especificidadeDiagnosticaPASS: (a03b && a03b.resumo && a03b.resumo.especificidadeDiagnosticaPASS) || 0,
      indicesCorrespondentesPASS: (a03b && a03b.resumo && a03b.resumo.indicesCorrespondentesPASS) || 0,
      testeEspecificidadePASS: especificidadeA03b && especificidadeA03b.resumo ? especificidadeA03b.resumo.PASS || 0 : 0,
    },
    r266aud: {
      PASS: (r266aud && r266aud.resumo && r266aud.resumo.PASS) || 0,
      FAIL: (r266aud && r266aud.resumo && r266aud.resumo.FAIL) || 0,
      BLOCKED: (r266aud && r266aud.resumo && r266aud.resumo.BLOCKED) || 0,
      NOT_RUN: (r266aud && r266aud.resumo && r266aud.resumo.NOT_RUN) || 0,
      unitarioPASS: testeR266aud && testeR266aud.resumo ? testeR266aud.resumo.PASS || 0 : 0,
      cromiumReal: (r266aud && r266aud.resumo && r266aud.resumo.cromiumReal) || 0,
      cenarioSintetico: (r266aud && r266aud.resumo && r266aud.resumo.cenarioSintetico) || 0,
    },
    r266audb: {
      PASS: (r266audb && r266audb.resumo && r266audb.resumo.PASS) || 0,
      FAIL: (r266audb && r266audb.resumo && r266audb.resumo.FAIL) || 0,
      BLOCKED: (r266audb && r266audb.resumo && r266audb.resumo.BLOCKED) || 0,
      NOT_RUN: (r266audb && r266audb.resumo && r266audb.resumo.NOT_RUN) || 0,
      unitarioPASS: testeR266audb && testeR266audb.resumo ? testeR266audb.resumo.PASS || 0 : 0,
      cromiumReal: (r266audb && r266audb.resumo && r266audb.resumo.cromiumReal) || 0,
      cenarioSintetico: (r266audb && r266audb.resumo && r266audb.resumo.cenarioSintetico) || 0,
      nucleoSha256: (r266audb && r266audb.meta && r266audb.meta.coreSha256) || null,
    },
    regression: {
      records: regressionRows.length,
      baseline: baselineRows.length,
      PASS: countByStatus(regressionRows).PASS || 0,
      FAIL: countByStatus(regressionRows).FAIL || 0,
      BLOCKED: countByStatus(regressionRows).BLOCKED || 0,
      divergences: regressionRows.length && baselineRows.length ? summaryDivergences(regressionRows, baselineRows) : null,
    },
    problems,
    verdict: problems.length ? 'FAIL' : 'PASS',
  };
  fs.writeFileSync(SUMMARY_OUT, `${JSON.stringify(summary, null, 2)}\n`);
  appendStepSummary(summary);
  console.log(`R2.6 CI: ${summary.verdict} | matriz ${summary.matrix.PASS}/10 | R2.6.5 ${summary.r26_5.PASS}/13 | R2.6.6 ${summary.r26_6.PASS}/11 | A-01 ${summary.a01.PASS}/11 | A-01B ${summary.a01b.PASS}/11 | A-02 ${summary.a02.PASS}/11 | A-02B ${summary.a02b.PASS}/11 | A-03 ${summary.a03.PASS}/12 | A-03B ${summary.a03b.PASS}/12 | R266-AUD ${summary.r266aud.PASS}/7 | R266-AUD-B ${summary.r266audb.PASS}/7 | historico ${summary.r26_6_historico.PASS}/11 | regressao ${summary.regression.PASS}/${summary.regression.records}`);
  if (problems.length) {
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  }
}

function summaryDivergences(rows, baseline) {
  let total = 0;
  const limit = Math.min(rows.length, baseline.length);
  for (let i = 0; i < limit; i += 1) {
    if (rows[i].id !== baseline[i].id || rows[i].status !== baseline[i].status) total += 1;
  }
  return total;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
