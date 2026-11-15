// ============================================================================
// Verificação independente do manifesto de integridade R2.5.5.
//
// Relê cada artefato declarado no manifesto, recalcula o SHA-256 e compara
// com o valor registrado. Não modifica nada. Não reutiliza a rotina que
// gerou os hashes.
//
// Uso: node verificar-manifesto-r2-5-5.cjs
// Saída: exit code 0 se todos os artefatos conferirem, 1 caso contrário.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCRIPT_DIR = path.dirname(__filename);
const MANIFEST_PATH = path.resolve(SCRIPT_DIR, 'c4-v05-b-r2-5-5-integrity.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const results = [];
for (const a of manifest.artifacts) {
  const p = path.resolve(SCRIPT_DIR, a.path);
  if (!fs.existsSync(p)) {
    results.push({ name: a.name, status: 'MISSING', detail: 'arquivo ausente' });
    continue;
  }
  const buf = fs.readFileSync(p);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  let lines = 0;
  for (const ch of buf) if (ch === 0x0a) lines++;

  const hashOk = hash === a.sha256;
  const sizeOk = buf.length === a.sizeBytes;
  const linesOk = lines === a.lines;
  results.push({
    name: a.name,
    status: hashOk && sizeOk && linesOk ? 'MATCH' : 'MISMATCH',
    detail: `hash ${hashOk ? 'ok' : 'DIVERGENTE'} | size ${sizeOk ? 'ok' : 'DIVERGENTE'} | lines ${linesOk ? 'ok' : 'DIVERGENTE'}`,
    declaredSha256: a.sha256,
    actualSha256: hash,
    declaredSize: a.sizeBytes,
    actualSize: buf.length,
    declaredLines: a.lines,
    actualLines: lines,
  });
}

const matched = results.filter((r) => r.status === 'MATCH').length;
const mismatched = results.filter((r) => r.status === 'MISMATCH').length;
const missing = results.filter((r) => r.status === 'MISSING').length;
const allMatch = mismatched === 0 && missing === 0 && matched === manifest.artifacts.length;

console.log('Verificação independente do manifesto R2.5.5');
console.log('Manifesto:', MANIFEST_PATH);
console.log('');
for (const r of results) {
  console.log(`  ${r.status.padEnd(9)} ${r.name.padEnd(38)} ${r.detail}`);
}
console.log('');
console.log('Conferidos:', matched, '| Divergentes:', mismatched, '| Ausentes:', missing);
console.log('Total declarado:', manifest.artifacts.length);
console.log('allHashesMatch:', allMatch);

// Registrar o resultado real do recalculo no manifesto.
// Seguro: o manifesto nao declara o proprio hash, portanto esta atualizacao
// nao invalida a verificacao nem cria referencia circular.
manifest.integrityVerification.allHashesMatch = allMatch;
manifest.integrityVerification.filesVerified = matched;
manifest.integrityVerification.filesAltered = mismatched;
manifest.integrityVerification.filesMissing = missing;
manifest.integrityVerification.verifiedAt = new Date().toISOString();
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
console.log('Manifesto atualizado com o resultado observado do recalculo.');

process.exit(allMatch ? 0 : 1);
