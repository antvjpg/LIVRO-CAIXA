/* C.O.D.E. — gerador de relatório (FASE: mecanismo de relatório).
   Lê e2e/reports/results.json (JSON reporter do Playwright) e emite
   e2e/reports/CODE-relatorio-<data>.md com classificação
   PASS / FAIL / BLOCKED / SKIPPED / FLAKY.
   Uso: npm run code:report   (após uma execução) */
'use strict';

const fs = require('fs');
const path = require('path');
const { config } = require('../helpers/env');
const { sanitizeText } = require('../helpers/sanitize');
const { maskEmail, maskUid } = require('../helpers/identity');

const resultsPath = path.join(config.reportsDir, 'results.json');
if (!fs.existsSync(resultsPath)) {
  console.error('BLOCKED: e2e/reports/results.json não existe — rode os testes antes (npm run code:test).');
  process.exit(2);
}

let raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

/* Corpos de anexo text/* chegam em base64 no JSON reporter. Decodifica ANTES da
   sanitização (sanitizeText encurta "palavras" longas e corromperia o base64) e
   deixa o texto pronto para o relatório embutir a evidência da falha. */
function decodeTextBodies(node) {
  for (const suite of node?.suites || []) {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        for (const r of t.results || []) {
          for (const a of r.attachments || []) {
            if (!a.body || typeof a.body !== 'string' || !/^text\//.test(a.contentType || '')) continue;
            const b64 = a.body.replace(/\s+/g, '');
            try {
              const texto = Buffer.from(b64, 'base64').toString('utf8');
              if (texto && Buffer.from(texto, 'utf8').toString('base64') === b64) {
                a.body = texto;
                a.bodyFormat = 'text';
              }
            } catch {
              /* mantém o corpo original: melhor evidência bruta que nenhuma */
            }
          }
        }
      }
    }
  }
}
decodeTextBodies(raw);

/* O results.json bruto vai para os artefatos: sanitiza-o também (e-mail,
   senha, token). Se a validação JSON falhar, mantém o original. */
try {
  const bruto = JSON.stringify(raw);
  const limpo = sanitizeText(bruto);
  if (limpo !== bruto) {
    raw = JSON.parse(limpo);
    fs.writeFileSync(resultsPath, JSON.stringify(raw, null, 2) + '\n');
  }
} catch {
  /* melhor evidência crua do que evidência corrompida */
}

const stripAnsi = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, '');


function annotationsOf(test, result) {
  return [...(test.annotations || []), ...(result?.annotations || [])];
}

/* Motivo de falha: primeira linha do erro + última linha (resumo), sem ANSI. */
function errorReason(message) {
  const lines = stripAnsi(message || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return 'erro sem mensagem';
  const text = lines.length > 1 ? `${lines[0]} … ${lines[lines.length - 1]}` : lines[0];
  return text.slice(0, 300);
}

/* Motivo de skip: anotação "skip" com descrição quando existir. */
function skipAnnotation(test, result) {
  return annotationsOf(test, result).find((x) => x.type === 'skip');
}

function skipReason(test, result) {
  const a = skipAnnotation(test, result);
  if (a) return a.description || '';
  return '';
}

function walk(suite, titles, out) {
  const chain = suite.title ? [...titles, suite.title] : titles;
  for (const spec of suite.specs || []) {
    for (const t of spec.tests || []) {
      const result = (t.results || [])[0];
      const status = t.status || result?.status || 'unknown';
      const skipped = status === 'skipped' || result?.status === 'skipped';
      let cls;
      let reason = '';
      if (status === 'expected' || status === 'passed') cls = 'PASS';
      else if (status === 'flaky') cls = 'FLAKY';
      else if (skipped) {
        /* Sem anotação de skip registrada => o teste não rodou por falha de
           ambiente/execução (ex.: Playwright abortado). Tratar como BLOCKED,
           nunca como pulo benigno. */
        const ann = skipAnnotation(t, result);
        reason = ann ? ann.description || '' : '';
        if (!ann) {
          cls = 'BLOCKED';
          reason = 'pulado sem motivo registrado — falha de ambiente/execução (tratar como bloqueio)';
        } else {
          cls = reason.startsWith('BLOCKED') ? 'BLOCKED' : 'SKIPPED';
        }
      } else cls = 'FAIL';

      const attachments = (result?.attachments || []).map((a) => {
        const corpo =
          typeof a.body === 'string' &&
          /^text\//.test(a.contentType || '') &&
          (a.bodyFormat === 'text' || /\s/.test(a.body))
            ? a.body
            : '';
        return { name: a.name, path: a.path || '', corpo };
      });
      out.push({
        suite: chain.join(' › ') || '(sem suíte)',
        title: spec.title,
        cls,
        reason: sanitizeText(cls === 'FAIL' ? errorReason(result?.error?.message) : reason),
        duration: result?.duration ?? 0,
        attachments,
        file: spec.file || '',
      });
    }
  }
  for (const child of suite.suites || []) walk(child, chain, out);
}

const tests = [];
for (const s of raw.suites || []) walk(s, [], tests);

const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, FLAKY: 0 };
for (const t of tests) counts[t.cls] = (counts[t.cls] || 0) + 1;

const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
const lines = [];
const w = (s = '') => lines.push(s);

w('# C.O.D.E. — RELATÓRIO');
w('');
w(`Gerado: ${now} · Specs: ${tests.length}`);
w('');
w('| PASS | FAIL | BLOCKED | SKIPPED | FLAKY |');
w('|---:|---:|---:|---:|---:|');
w(`| ${counts.PASS} | ${counts.FAIL} | ${counts.BLOCKED} | ${counts.SKIPPED} | ${counts.FLAKY} |`);
w('');

/* ---- QA ENVIRONMENT (FASE 12): estado do ambiente desta run ---- */
const summaryPath = path.join(config.root, 'e2e', '.state', 'qa-summary.json');
const identityPath = path.join(config.root, 'e2e', '.state', 'qa-identity.json');
function readJsonSafe(p) {
  try {
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  } catch (e) {
    return { unreadable: e.message };
  }
}
const summary = readJsonSafe(summaryPath);
const identityLeftover = fs.existsSync(identityPath);
const row = (k, v) => w(`- ${k}: ${v}`);
w('## QA ENVIRONMENT');
w('');
if (!summary) {
  w('- Resumo do ambiente não encontrado — o globalTeardown não rodou (run abortada?).');
} else {
  row('Modo da identidade', summary.mode || 'n/d');
  /* re-mascara defensivamente: nem um arquivo de estado adulterado expõe */
  row('Conta QA (mascarada)', summary.email ? maskEmail(summary.email) : 'n/d');
  row('UID (mascarado)', summary.uid ? maskUid(summary.uid) : 'n/d');
  row('Criada pelo C.O.D.E.', summary.createdByCode ? 'SIM' : 'NÃO');
  row(
    'Limpeza Firestore',
    `${summary.firestoreCleanup || 'SKIP'}${summary.deletedDocs != null ? ` (${summary.deletedDocs} doc(s))` : ''}`
  );
  row('Exclusão da conta Auth', summary.authCleanup || 'SKIP');
  row('Run', summary.runId || 'n/d');
  row('Concluído em', summary.finishedAt || 'n/d');
  if (summary.severity) row('Atenção', summary.severity);
  if ((summary.notes || []).length) {
    w('- Observações:');
    for (const n of summary.notes) w(`  - ${n}`);
  }
}
row('Arquivo de identidade remanescente', identityLeftover ? 'SIM (possível run abortada)' : 'NÃO');
w('');
w('---');
w('');
w('| Classe | Suíte | Teste | Detalhe |');
w('|---|---|---|---|');
for (const t of tests) {
  const detail = (t.reason || '').replace(/\|/g, '\\|');
  w(`| **${t.cls}** | ${t.suite} | ${t.title} | ${detail} |`);
}
w('');

const failures = tests.filter((t) => t.cls === 'FAIL' || t.cls === 'FLAKY');
if (failures.length) {
  w('## Falhas e evidências');
  w('');
  for (const t of failures) {
    w(`### ${t.cls} — ${t.title}`);
    w('');
    w(`- Suíte: ${t.suite}`);
    w(`- Arquivo: \`${t.file}\``);
    w(`- Motivo: ${t.reason || 'não informado'}`);
    if (t.attachments.length) {
      w('- Evidências:');
      for (const a of t.attachments) w(`  - ${a.name}${a.path ? `: \`${a.path}\`` : ' (corpo embutido)'}`);
      for (const a of t.attachments.filter((x) => x.corpo)) {
        w('');
        w(`**${a.name}:**`);
        w('');
        w('```');
        w(a.corpo.split('\n').slice(0, 40).join('\n'));
        w('```');
      }
    }
    w('');
  }
}

const blocked = tests.filter((t) => t.cls === 'BLOCKED');
if (blocked.length) {
  w('## BLOCKED (não escondidos)');
  w('');
  for (const t of blocked) w(`- **${t.title}** — ${t.reason}`);
  w('');
}

w('---');
w('');
w('Classificação: PASS (ok) · FAIL (divergência/erro) · BLOCKED (não executou por');
w('condição de ambiente/credenciais) · SKIPPED (pulado intencionalmente) · FLAKY');
w('(falhou e passou na repetição — investigar estabilidade).');

const outPath = path.join(config.reportsDir, `CODE-relatorio-${new Date().toISOString().slice(0, 10)}.md`);
fs.writeFileSync(outPath, sanitizeText(lines.join('\n')) + '\n');
console.log(`Relatório: ${outPath}`);
console.log(`PASS=${counts.PASS} FAIL=${counts.FAIL} BLOCKED=${counts.BLOCKED} SKIPPED=${counts.SKIPPED} FLAKY=${counts.FLAKY}`);

/* --strict (usado no CI): bloqueio de ambiente NÃO pode passar em silêncio. */
if (process.argv.includes('--strict')) {
  const problemas = counts.FAIL + counts.BLOCKED;
  const cleanupBloqueado = !!summary && summary.severity === 'BLOCKED';
  if (problemas > 0 || cleanupBloqueado) {
    console.error(
      `C.O.D.E.: ${counts.FAIL} falha(s), ${counts.BLOCKED} bloqueio(s)` +
        `${cleanupBloqueado ? ' e cleanup BLOCKED (sobras possíveis)' : ''} — ver relatório.`
    );
    process.exit(1);
  }
}
