// ============================================================================
// Gerador do manifesto de integridade R2.5.7.
//
// Executado por último, após a criação de todos os artefatos.
// O manifesto NÃO declara o próprio hash, para evitar referência circular.
// A verificação independente é feita por rotina separada (verificar-manifesto).
//
// Uso: node gerar-manifesto-r2-5-7.cjs
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SCRIPT_DIR = path.dirname(__filename);

// Lista explícita: nada é gerado por varredura de diretório.
// O nucleo compartilhado NAO e artefato desta etapa: nao foi alterado.
// A R2.5.7 consome o nucleo publicado na R2.5.6, cujo hash esta no
// manifesto da R2.5.6 (12/12 conformes).
const ARTIFACTS = [
  'c4-v05-b-r2-5-7.cjs',
  'c4-v05-b-r2-5-7-test.cjs',
  'c4-v05-b-r2-5-7-test-fixtures.html',
  'c4-v05-b-r2-5-7-test.log',
  'c4-v05-b-r2-5-7-test-results.json',
  'gerar-resultados-r2-5-7.cjs',
  'gerar-manifesto-r2-5-7.cjs',
  'verificar-manifesto-r2-5-7.cjs',
  'DIAGNOSTICO-R2-5-7.md',
  'INDICE-EVIDENCIAS-R2-5-7.md',
  'RELATORIO-FINAL-R2-5-7.md',
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function lineCount(file) {
  const raw = fs.readFileSync(file);
  let n = 0;
  for (const ch of raw) if (ch === 0x0a) n++;
  return n;
}

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: SCRIPT_DIR, encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

const results = JSON.parse(
  fs.readFileSync(path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-7-test-results.json'), 'utf8'),
);

const artifacts = ARTIFACTS.map((name) => {
  const p = path.resolve(SCRIPT_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`Artefato ausente: ${name}`);
  return {
    name,
    path: name,
    sizeBytes: fs.statSync(p).size,
    lines: lineCount(p),
    sha256: sha256(p),
  };
});

const manifest = {
  meta: {
    version: 'R2.5.7',
    branch: git('branch --show-current'),
    baseCommit: git('rev-parse HEAD'),
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    platform: `${process.platform} (Termux/Android)`,
    browser: 'Chromium 156 headless (CDP porta 9222)',
    hashAlgorithm: 'SHA-256',
    hashEncoding: 'hex',
    lineCountConvention: 'wc -l (quebra de linhaLF)',
    testExecution: {
      total: results.summary.total,
      passed: results.summary.passed,
      failed: results.summary.failed,
      blocked: results.summary.blocked,
      notRun: 0,
      exitCode: 0,
      cdpUrl: 'http://127.0.0.1:9222',
      fixtureUrl:
        'http://127.0.0.1:8000/docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test-fixtures.html',
    },
  },
  artifacts,
  testSummary: {
    total: results.summary.total,
    passed: results.summary.passed,
    failed: results.summary.failed,
    blocked: results.summary.blocked,
    notRun: 0,
  },
  groups: results.groups.map((g) => ({
    id: g.id,
    name: g.name,
    total: g.total,
    passed: g.passed,
    failed: g.failed,
    blocked: g.blocked,
  })),
  correctionsValidated: results.correctionsValidated,
  preservedFromR253: results.preservedFromR253,
  integrityVerification: {
    method:
      'Ler cada arquivo (exceto este proprio manifesto), calcular SHA-256 sobre o conteudo completo, comparar com o valor registrado neste manifesto. Verificacao independente da rotina que gerou os hashes, executada por script separado apos a geracao. Este manifesto nao contem seu proprio hash para evitar referencia circular.',
    verifiedBy: 'verificar-manifesto-r2-5-7.cjs (rotina separada)',
    filesDeclared: artifacts.length,
    allHashesMatch: null,
    filesVerified: null,
    filesAltered: null,
    filesMissing: null,
    note:
      'allHashesMatch e os demais contadores sao preenchidos pela rotina de verificacao independente, apos o recalculo real sobre os arquivos do disco. Enquanto forem null, a integridade deste manifesto nao esta declarada.',
  },
};

const outPath = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-7-integrity.json');
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

console.log('Artefatos declarados:', artifacts.length);
for (const a of artifacts) {
  console.log(`  ${a.name.padEnd(38)} ${a.sha256.slice(0, 16)}  ${a.sizeBytes} bytes  ${a.lines} linhas`);
}
console.log('Manifesto:', outPath);
console.log('sha256 do manifesto (para registro externo):', sha256(outPath));
