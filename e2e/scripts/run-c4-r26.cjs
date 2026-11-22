'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const ARTIFACTS = path.join(ROOT, 'e2e/.artifacts');
const CORE = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs');
const CORE_266 = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-6-6/c4-v05-b-r2-6-6-core.cjs');
const VALIDATOR = path.join(ROOT, 'tmp-c13/r2-6-2/validacao-r2-6-3.cjs');
const VALIDATOR_265 = path.join(ROOT, 'tmp-c13/r2-6-5/validacao-r2-6-5.cjs');
const VALIDATOR_266 = path.join(ROOT, 'tmp-c13/r2-6-6/validacao-r2-6-6.cjs');
const EXTENSION_266 = path.join(ROOT, 'tmp-c13/r2-6-6/extension');
const REGRESSION = path.join(ROOT, 'tmp-c13/r2-6-4/regressao/test-r2-6.cjs');
const BASELINE = path.join(ROOT, 'docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-results.json');
const MATRIZ_OUT = path.join(ARTIFACTS, 'r2-6-matriz.json');
const MATRIZ_265_OUT = path.join(ARTIFACTS, 'r2-6-5-matriz.json');
const MATRIZ_266_OUT = path.join(ARTIFACTS, 'r2-6-6-matriz.json');
const REG_LOG = path.join(ARTIFACTS, 'r2-6-regressao.log');
const HTTP_LOG = path.join(ARTIFACTS, 'r2-6-http.log');
const CHROME_LOG = path.join(ARTIFACTS, 'r2-6-chromium.log');
const SUMMARY_OUT = path.join(ARTIFACTS, 'r2-6-ci-summary.json');
const CDP_PORT = 9222;
const HTTP_PORT = 8000;

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
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
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
    `| R2.6.6 | ${summary.r26_6.PASS} PASS / ${summary.r26_6.FAIL} FAIL / ${summary.r26_6.BLOCKED} BLOCKED |`,
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

    const r266Run = spawnSync(
      process.execPath,
      [VALIDATOR_266, `--core=${CORE_266}`, `--out=${MATRIZ_266_OUT}`],
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
    const r266Erros = r266.erros || {};
    for (const key of ['cdp', 'console', 'excecoes']) {
      const itens = r266Erros[key] || [];
      if (itens.length) problems.push(`R2.6.6 erros.${key}=${itens.length}`);
    }
    const injecoesU1 = (r266.casos || []).filter((c) => c.id === 'R265-U1');
    if (injecoesU1.length !== 1 || !injecoesU1[0].injecao || injecoesU1[0].injecao.title !== 'r266-inject:ok') {
      problems.push('R2.6.6 injecao USER nao confirmada');
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
    core266: CORE_266,
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
  console.log(`R2.6 CI: ${summary.verdict} | matriz ${summary.matrix.PASS}/10 | R2.6.5 ${summary.r26_5.PASS}/13 | R2.6.6 ${summary.r26_6.PASS}/11 | regressao ${summary.regression.PASS}/${summary.regression.records}`);
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
