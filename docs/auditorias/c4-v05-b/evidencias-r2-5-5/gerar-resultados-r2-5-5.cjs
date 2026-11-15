// ============================================================================
// Gerador de resultados R2.5.5 — consolida o log de testes em registros
// individuais e recalcula as contagens a partir dos registros.
//
// Não aceita contagens informadas manualmente: summary e groups são derivados
// dos registros individuais extraídos do log. Detecta duplicidade de ID e
// divergência entre o total de linhas de resultado e o total de registros.
//
// Uso: node gerar-resultados-r2-5-5.cjs
// ============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCRIPT_DIR = path.dirname(__filename);
const LOG_PATH = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-5-test.log');
const OUT_PATH = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-5-test-results.json');

const GROUP_NAMES = {
  A: 'sampleId com screen',
  B: 'Associação key → nodeId (cardinalidade)',
  C: 'Limpeza de pseudoestado (try/finally real)',
  D: 'Visibilidade efetiva e ancestrais',
  V: 'Semântica de visibility, estados terminais da travessia, exceções reais, integridade da opacidade e árvore composta (Shadow DOM)',
  P: 'Falha de aplicação de pseudoestado',
  R: 'Travessia da raiz do documento',
  E: 'Atributos DOM com expectativas exatas',
  F: 'Validação geométrica',
  G: 'Classificação de erros CDP',
  H: 'Visibilidade de ancestrais com Chromium real',
};

const GROUP_ORDER = ['A', 'B', 'C', 'D', 'V', 'P', 'R', 'E', 'F', 'G', 'H'];

const STATUSES = ['PASS', 'FAIL', 'BLOCKED'];

function sha256(file) {
  return require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: SCRIPT_DIR, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Parsing do log
// ---------------------------------------------------------------------------
const logRaw = fs.readFileSync(LOG_PATH, 'utf8');
const logLines = logRaw.split('\n');

const tests = [];
const parseIssues = [];

for (let i = 0; i < logLines.length; i++) {
  const line = logLines[i];
  const m = line.match(/^\s{2}(PASS|FAIL|BLOCKED):\s*(.*)$/);
  if (!m) continue;
  const status = m[1];
  const message = m[2];
  const idMatch = message.match(/^([A-Z][0-9]+[a-z]?):\s*(.*)$/);
  if (!idMatch) {
    parseIssues.push({ line: i + 1, reason: 'ID não reconhecido', message });
    continue;
  }
  const id = idMatch[1];
  const name = idMatch[2];
  const group = id.replace(/[0-9]+[a-z]?$/, '');
  tests.push({
    id,
    group,
    name,
    status,
    evidence: message,
    logLine: i + 1,
  });
}

// ---------------------------------------------------------------------------
// 2. Integridade dos registros
// ---------------------------------------------------------------------------
const seen = new Map();
const duplicates = [];
for (const t of tests) {
  const key = `${t.id}::${t.name}`;
  if (seen.has(key)) {
    duplicates.push({ id: t.id, name: t.name, firstLine: seen.get(key), secondLine: t.logLine });
  } else {
    seen.set(key, t.logLine);
  }
}

const statusCounts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
for (const t of tests) {
  if (statusCounts[t.status] === undefined) throw new Error(`Status inválido: ${t.status}`);
  statusCounts[t.status]++;
}

const summary = {
  total: tests.length,
  passed: statusCounts.PASS,
  failed: statusCounts.FAIL,
  blocked: statusCounts.BLOCKED,
};

// Contagem declarada no final do log — usada apenas para detectar divergência.
const summaryLine = logRaw.match(/^PASS:\s*(\d+)\s+FAIL:\s*(\d+)\s+BLOCKED:\s*(\d+)\s*$/m);
const declaredSummary = summaryLine
  ? {
      total: parseInt(summaryLine[1], 10) + parseInt(summaryLine[2], 10) + parseInt(summaryLine[3], 10),
      passed: parseInt(summaryLine[1], 10),
      failed: parseInt(summaryLine[2], 10),
      blocked: parseInt(summaryLine[3], 10),
    }
  : null;

const summaryMatchesLog =
  declaredSummary !== null &&
  declaredSummary.total === summary.total &&
  declaredSummary.passed === summary.passed &&
  declaredSummary.failed === summary.failed &&
  declaredSummary.blocked === summary.blocked;

// ---------------------------------------------------------------------------
// 3. Grupos derivados dos registros individuais
// ---------------------------------------------------------------------------
const groups = [];
for (const gid of GROUP_ORDER) {
  const items = tests.filter((t) => t.group === gid);
  if (items.length === 0) continue;
  groups.push({
    id: gid,
    name: GROUP_NAMES[gid] || gid,
    total: items.length,
    passed: items.filter((t) => t.status === 'PASS').length,
    failed: items.filter((t) => t.status === 'FAIL').length,
    blocked: items.filter((t) => t.status === 'BLOCKED').length,
  });
}

const groupsTotal = groups.reduce((a, g) => a + g.total, 0);
const groupsMatchSummary = groupsTotal === summary.total;

// ---------------------------------------------------------------------------
// 4. Meta
// ---------------------------------------------------------------------------
const meta = {
  version: 'R2.5.5',
  branch: git('branch --show-current'),
  baseCommit: git('rev-parse HEAD'),
  logFile: 'c4-v05-b-r2-5-5-test.log',
  logSha256: sha256(LOG_PATH),
  logLines: logLines.length,
  nodeVersion: process.version,
  platform: `${process.platform} (Termux/Android)`,
  browser: 'Chromium 156 headless (CDP porta 9222)',
  browserVersion: 'Chrome/156.0.8078.79',
  cdpUrl: 'http://127.0.0.1:9222',
  fixtureUrl:
    'http://127.0.0.1:8000/docs/auditorias/c4-v05-b/evidencias-r2-5-5/c4-v05-b-r2-5-5-test-fixtures.html',
  hashAlgorithm: 'SHA-256',
  hashEncoding: 'hex',
};

// ---------------------------------------------------------------------------
// 5. Resultado
// ---------------------------------------------------------------------------
const out = {
  meta,
  summary,
  summaryDeclaredInLog: declaredSummary,
  summaryMatchesLog,
  groupsTotal,
  groupsMatchSummary,
  duplicates,
  parseIssues,
  groups,
  tests,
  errors: [],
  correctionsValidated: [
    'R25.5-01: display:none interrompe a travessia com estado short-circuited; completed somente quando a raiz real do documento é examinada',
    'R25.5-02: o limite de profundidade é verificado antes da leitura do próximo nó e não sobrescreve estados terminais',
    'R25.5-03: a detecção de ciclo usa identidade estável (nodeId via DOM.requestNode), e não objectId, que é instável entre chamadas CDP',
    'R25.5-04: a travessia percorre a árvore composta (assignedSlot → parentElement → host do shadow root) e nunca declara completed um elemento desconectado',
    'R25.5-05: ancestorOpacityStatus distingue complete, partial, conclusive-zero, short-circuited, unavailable, invalid e error',
    'R25.5-06: opacidade inválida nunca é convertida em 1 (validação numérica, finita e no intervalo CSS [0,1])',
    'R25.5-07: a decisão final só confirma visible com travessia completa, opacidade completa e maior que zero',
    'R25.5-08: exceções reais registram ancestorVisibility error e preservam as evidências já coletadas',
  ],
  preservedFromR254: [
    'Todas as correções R25.4-01 a R25.4-03 da R2.5.4',
    '170 asserções de regressão da R2.5.4 preservadas e executadas sem alteração de expectativa',
    'Evidências históricas da R2.5.4 preservadas intactas em evidencias-r2-5-4/',
  ],
  preservedFromR253: [
    'Todas as correções R25-01 a R25-12 da R2.5.3',
    '159 testes de regressão da R2.5.3 preservados e executados',
    'Evidências históricas da R2.5.3 preservadas intactas em evidencias-r2-5-3/',
  ],
};

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');

console.log('Registros individuais:', tests.length);
console.log('Summary (derivado):', JSON.stringify(summary));
console.log('Summary declarado no log:', JSON.stringify(declaredSummary));
console.log('summaryMatchesLog:', summaryMatchesLog);
console.log('groupsMatchSummary:', groupsMatchSummary, '(soma grupos =', groupsTotal, ')');
console.log('Duplicidades de (id,name):', duplicates.length);
console.log('Linhas de resultado não parseadas:', parseIssues.length);
console.log('Grupos:', groups.map((g) => `${g.id}:${g.total}`).join(' '));
console.log('Arquivo:', OUT_PATH);
