import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RULES, SEVERITIES, SCOPES, STATUSES, VERSION } from '../scripts/rules.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = path.resolve(SKILL_DIR, '../../..');
const DETECTOR = path.join(SKILL_DIR, 'scripts', 'detect.mjs');
const FIXTURES = path.join(SKILL_DIR, 'tests', 'fixtures');

function fixture(name) {
  return path.join(FIXTURES, name);
}

function run(args) {
  return spawnSync(process.execPath, [DETECTOR, ...args], { cwd: REPO_DIR, encoding: 'utf8' });
}

function runJson(args) {
  const result = run([...args, '--json']);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function findings(report, id) {
  return report.findings.filter((f) => f.id === id);
}

test('self-check passes and version is synchronized', () => {
  const result = run(['--self-check']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const check = JSON.parse(result.stdout);
  assert.equal(check.ok, true, JSON.stringify(check.errors));
  assert.equal(check.version, VERSION);
  const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  assert.match(skill, new RegExp(`^version:\\s*["']?${VERSION}["']?`, 'm'));
});

test('rule metadata uses valid severities, scopes and statuses', () => {
  const ids = new Set();
  for (const r of RULES) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.ok(SEVERITIES.includes(r.severity), r.id);
    assert.ok(SCOPES.includes(r.scope), r.id);
    assert.ok(STATUSES.includes(r.status), r.id);
    assert.ok(r.validation && r.limitations, r.id);
  }
});

test('transition: all is found, multiline is supported, comments are ignored and severity is P2', () => {
  const report = runJson([fixture('transition.css')]);
  const list = findings(report, 'CSS-MOTION-001');
  assert.equal(list.length, 3);
  for (const f of list) {
    assert.equal(f.severity, 'P2');
    assert.equal(f.status, 'candidate');
    assert.equal(f.confidence, 'high');
    assert.doesNotMatch(f.snippet, /commented/i);
  }
  assert.equal(list[0].selector, '.nav-tab');
  assert.equal(list[0].line, 3);
  assert.equal(list[1].line, 6);
  assert.equal(list[2].selector, '.responsive');
});

test('outline none with focus-visible is contextual, without replacement is inconclusive', () => {
  const withReplacement = runJson([fixture('focus-with.css')]);
  const withFinding = findings(withReplacement, 'CSS-FOCUS-OUTLINE-001')[0];
  assert.ok(withFinding);
  assert.equal(withFinding.status, 'candidate');
  assert.equal(withFinding.severity, 'P2');
  assert.equal(withFinding.confidence, 'medium');

  const withoutReplacement = runJson([fixture('focus-without.css')]);
  const withoutFinding = findings(withoutReplacement, 'CSS-FOCUS-OUTLINE-001')[0];
  assert.ok(withoutFinding);
  assert.equal(withoutFinding.status, 'inconclusive');
  assert.equal(withoutFinding.confidence, 'low');
});

test('reduced motion considers rules across the loaded CSS set', () => {
  const report = runJson([fixture('reduced-present.css'), fixture('reduced-absent.css')]);
  const list = findings(report, 'CSS-REDUCED-MOTION-001');
  assert.equal(list.length, 2);
  assert.ok(list.some((f) => f.status === 'false_positive' && f.file.includes('reduced-present')));
  assert.ok(list.some((f) => f.status === 'inconclusive' && f.file.includes('reduced-absent')));
  for (const f of list) assert.notEqual(f.severity, 'P1');
});

test('optional font is not treated as primary font', () => {
  const report = runJson([fixture('fonts.css')]);
  const primary = findings(report, 'CSS-FONT-PRIMARY-001');
  const local = findings(report, 'CSS-FONT-LOCAL-001');
  assert.ok(primary.some((f) => f.selector.includes('data-font') && f.status === 'false_positive'));
  assert.ok(primary.some((f) => f.selector === ':root' && f.status === 'candidate'));
  assert.ok(local.some((f) => f.selector.includes('feature-copy') && f.status === 'candidate'));
  for (const f of [...primary, ...local]) assert.equal(f.severity, 'INFO');
});

test('glassmorphism and glow are contextual', () => {
  const glass = runJson([fixture('glass.css')]);
  const glassList = findings(glass, 'CSS-GLASS-001');
  assert.ok(glassList.some((f) => f.selector === '.modal-overlay' && f.status === 'false_positive'));
  assert.ok(glassList.some((f) => f.selector === '.card' && f.status === 'candidate'));

  const shadow = runJson([fixture('shadow.css')]);
  const shadowList = findings(shadow, 'CSS-SHADOW-GLOW-001');
  assert.ok(shadowList.some((f) => f.selector.includes(':focus') && f.status === 'false_positive'));
  assert.ok(shadowList.some((f) => f.selector === '.card' && f.status === 'candidate'));
  for (const f of [...glassList, ...shadowList]) assert.equal(f.severity, 'INFO');
});

test('aesthetic patterns remain INFO candidates', () => {
  const report = runJson([fixture('patterns.css')]);
  for (const id of ['CSS-THREE-COL-001', 'CSS-PALETTE-001', 'CSS-GRADIENT-TEXT-001', 'CSS-FINGERNAIL-001']) {
    const list = findings(report, id);
    assert.equal(list.length, 1, id);
    assert.equal(list[0].severity, 'INFO', id);
    assert.equal(list[0].status, 'candidate', id);
  }
});

test('content rules inspect visible text only', () => {
  const report = runJson([fixture('content.html')]);
  const hype = findings(report, 'CONTENT-HYPE-001');
  const dot = findings(report, 'CONTENT-MIDDLE-DOT-001');
  assert.equal(hype.length, 1);
  assert.match(hype[0].snippet, /Elevate/i);
  assert.doesNotMatch(JSON.stringify(report), /Seamless|supercharge/i);
  assert.equal(dot.length, 1);
  assert.equal(dot[0].severity, 'INFO');
});

test('view and rendered scopes change results', () => {
  const scoped = runJson([fixture('views.css'), '--scope', 'view', '--view', 'inicio']);
  assert.equal(scoped.findings.length, 1);
  assert.equal(scoped.findings[0].selector, '#viewInicio .card');

  const rendered = runJson([fixture('views.css'), '--scope', 'rendered']);
  assert.equal(rendered.findings.length, 0);
  assert.ok(rendered.limitations.some((l) => /rendered scope is unsupported/i.test(l)));
});

test('JSON and Markdown report the same findings', () => {
  const args = [fixture('patterns.css')];
  const report = runJson(args);
  const text = run(args).stdout;
  const rendered = report.findings.filter((f) => f.status !== 'unsupported');
  const lines = text.split(/\r?\n/).filter((l) => /^- (P0|P1|P2|INFO) [A-Z0-9-]+ /.test(l));
  assert.equal(lines.length, rendered.length);
  assert.match(text, new RegExp(`v${VERSION}`));
});

test('candidate findings do not fail the audit; invalid config does', () => {
  const candidate = run([fixture('patterns.css'), '--json']);
  assert.equal(candidate.status, 0);
  const invalid = run(['--scope', 'unknown', fixture('patterns.css')]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Invalid scope/);
});

test('no duplicate findings', () => {
  const report = runJson([fixture('transition.css'), fixture('patterns.css')]);
  const keys = report.findings.map((f) => `${f.id}|${f.file}|${f.line}|${f.snippet}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('reduced-motion in an unrelated selector remains inconclusive', () => {
  const report = runJson([fixture('reduced-unrelated.css')]);
  const list = findings(report, 'CSS-REDUCED-MOTION-001');
  assert.equal(list.length, 1);
  assert.equal(list[0].status, 'inconclusive');
  assert.equal(list[0].severity, 'P2');
  assert.match(list[0].evidence, /coverage of this animation is unproven/i);
});

test('visible-text rules do not use attributes as source', () => {
  const report = runJson([fixture('content-attributes.html')]);
  assert.equal(findings(report, 'CONTENT-HYPE-001').length, 0);
  const dot = findings(report, 'CONTENT-MIDDLE-DOT-001');
  assert.equal(dot.length, 1);
  assert.equal(dot[0].line, 6);
  assert.doesNotMatch(JSON.stringify(report), /Elevate|Seamless|supercharge/i);
});

test('JavaScript-only files are discovered but not analyzed', () => {
  const report = runJson([fixture('dynamic.js')]);
  assert.equal(report.summary.filesDiscovered, 1);
  assert.equal(report.summary.filesAnalyzed, 0);
  assert.equal(report.findings.length, 0);
  assert.ok(report.limitations.some((l) => /JavaScript is not analyzed/i.test(l)));
  assert.ok(report.summary.ignoredExtensions.includes('.js'));
});

test('brace-like characters inside strings do not break CSS parsing', () => {
  const report = runJson([fixture('tricky.css')]);
  const reduced = findings(report, 'CSS-REDUCED-MOTION-001');
  assert.equal(reduced.length, 1);
  assert.equal(findings(report, 'CSS-FONT-PRIMARY-001').length, 0);
});

test('shared global styles remain visible under --view', () => {
  const report = runJson([fixture('shared.css'), '--view', 'inicio']);
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].viewRelation, 'shared');
});

test('same rule in different selectors produces distinct findings', () => {
  const report = runJson([fixture('same-rule.css')]);
  const list = findings(report, 'CSS-MOTION-001');
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((f) => f.selector).sort(), ['.first', '.second']);
});

test('documentation contains trigger, limitations and validation for every rule', () => {
  const tells = fs.readFileSync(path.join(SKILL_DIR, 'references', 'TELLS.md'), 'utf8');
  const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  for (const r of RULES) {
    assert.ok(tells.includes(`| ${r.id} |`), r.id);
    assert.ok(tells.includes(normalize(r.trigger)), `${r.id} trigger`);
    assert.ok(tells.includes(normalize(r.limitations)), `${r.id} limitations`);
    assert.ok(tells.includes(normalize(r.validation)), `${r.id} validation`);
  }
});
