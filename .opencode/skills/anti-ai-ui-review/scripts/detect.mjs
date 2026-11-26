#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES, SEVERITIES, SCOPES, STATUSES, VERSION } from './rules.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `anti-ai-ui-review v${VERSION}

Usage:
  node detect.mjs [options] [paths]
  node detect.mjs --self-check

Options:
  --json              Emit valid JSON to stdout.
  --self-check        Validate detector/docs consistency.
  --scope <scope>     Filter by global|view|component|content|rendered.
  --view <name>       Restrict view-scoped findings to a named view.
  --help              Show this help.

Exit codes:
  0  audit completed; candidates may remain
  1  execution/configuration/documentation error
  2  confirmed P0/P1 finding`;

const argv = process.argv.slice(2);

function option(name) {
  const exact = argv.indexOf(name);
  if (exact >= 0) return argv[exact + 1] || null;
  const prefix = `${name}=`;
  const found = argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

if (argv.includes('--help')) {
  console.log(USAGE);
  process.exit(0);
}

if (argv.includes('--self-check')) {
  const result = checkDocsSync();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

const asJson = argv.includes('--json');
const scopeFilter = option('--scope');
const view = option('--view');

if (scopeFilter && !SCOPES.includes(scopeFilter)) {
  console.error(`Invalid scope: ${scopeFilter}`);
  process.exit(1);
}

const targets = argv.filter((a) => !a.startsWith('--'));
if (!targets.length) {
  console.error('No targets provided.');
  console.error(USAGE);
  process.exit(1);
}

const files = collect(targets);
const cssTexts = files.filter(isCss).map((f) => fs.readFileSync(f, 'utf8'));
const allCssText = cssTexts.join('\n');
const hasReducedMotion = /@media\s*\([^)]*prefers-reduced-motion/i.test(allCssText);
const findings = files.flatMap((file) => scanFile(file, allCssText, hasReducedMotion));
const filtered = applyFilters(findings, scopeFilter, view);

const summary = {
  files: files.length,
  findings: filtered.length,
  bySeverity: Object.fromEntries(SEVERITIES.map((s) => [s, filtered.filter((f) => f.severity === s).length])),
  byStatus: Object.fromEntries(STATUSES.map((s) => [s, filtered.filter((f) => f.status === s).length])),
};

const limitations = [
  'Static detector does not analyze screenshots, pixels, or rendered layout.',
  'The rendered scope is unsupported by this command.',
  'CSS cascade, specificity, and runtime state are not fully resolved.',
];
if (!view) limitations.push('No --view filter was provided; view-scoped results are not restricted to one view.');

const report = {
  version: VERSION,
  mode: 'detect',
  scopeFilter: scopeFilter || null,
  view: view || null,
  summary,
  findings: filtered,
  limitations,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderMarkdown(report));
}

const confirmedCritical = filtered.some((f) => f.status === 'confirmed' && (f.severity === 'P0' || f.severity === 'P1'));
process.exit(confirmedCritical ? 2 : 0);

function collect(targets) {
  const out = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.cache', '.vercel', '.turbo', 'coverage', 'vendor']);
  const skipRe = /(^|\/)(backup|\.bak|tmp-c13|e2e\/reports|\.artifacts|livro-caixa-main-check\.js)/i;
  const ext = new Set(['.html', '.htm', '.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']);
  const add = (p) => {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (skipDirs.has(path.basename(abs)) || skipRe.test(abs)) return;
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) add(path.join(abs, entry.name));
      return;
    }
    if (!ext.has(path.extname(abs))) return;
    if (skipRe.test(abs)) return;
    out.push(abs);
  };
  for (const t of targets) add(t);
  return out.sort();
}

function isCss(file) {
  return ['.css', '.scss', '.sass', '.less'].includes(path.extname(file));
}

function isHtml(file) {
  return ['.html', '.htm', '.vue', '.svelte'].includes(path.extname(file));
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
}

function findClosing(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function parseCssBlocks(css) {
  const clean = stripCssComments(css);
  const blocks = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(clean))) {
    const leading = m[1].match(/^\s*/)[0].length;
    const header = m[1].trim();
    const open = m.index + m[0].length - 1;
    const close = findClosing(clean, open);
    if (close < 0) break;
    const body = clean.slice(open + 1, close);
    const line = lineAt(clean, m.index + leading);
    if (header.startsWith('@')) {
      for (const child of parseCssBlocks(body)) blocks.push({ ...child, media: [header, ...child.media], line: child.line + line - 1 });
    } else if (!header.startsWith('@')) {
      blocks.push({ selector: header, body, line, media: [] });
    }
    re.lastIndex = close + 1;
  }
  return blocks;
}

function declarations(body) {
  return Array.from(body.matchAll(/([-\w]+)\s*:\s*([^;{}]+)/g), (m) => ({ prop: m[1], value: m[2].trim(), index: m.index }));
}

function countNewlines(text) {
  return (text.match(/\n/g) || []).length;
}

function decodeEntities(text) {
  return text.replace(/&(?:nbsp|#160);/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}

function visibleHtmlText(html) {
  let s = stripHtmlComments(html);
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  return decodeEntities(s.replace(/\s+/g, ' '));
}

function relative(file) {
  const rel = path.relative(process.cwd(), file);
  return rel && !rel.startsWith('..') ? rel : file;
}

function finding(rule, file, line, selector, snippet, overrides = {}) {
  return {
    id: rule.id,
    rule: rule.name,
    description: rule.description,
    category: rule.category,
    file: relative(file),
    line,
    selector: selector || null,
    snippet: snippet.trim().slice(0, 200),
    scope: rule.scope,
    severity: overrides.severity || rule.severity,
    confidence: overrides.confidence || rule.confidence,
    status: overrides.status || rule.status,
    evidence: overrides.evidence || 'Static source declaration found.',
    impact: overrides.impact || 'Impact not confirmed by static analysis.',
    limitations: rule.limitations,
    recommendation: rule.validation,
    validation: rule.validation,
  };
}

function byId(id) {
  return RULES.find((r) => r.id === id);
}

function scanFile(file, allCssText, hasReducedMotion) {
  if (isCss(file)) return scanCss(file, fs.readFileSync(file, 'utf8'), allCssText, hasReducedMotion);
  if (isHtml(file)) return scanHtml(file, fs.readFileSync(file, 'utf8'));
  return [];
}

function scanCss(file, text, allCssText, hasReducedMotion) {
  const blocks = parseCssBlocks(text);
  const out = [];
  const ruleIds = new Set();
  for (const block of blocks) {
    const decls = declarations(block.body);
    const selector = block.selector;
    for (const decl of decls) {
      const push = (id, overrides) => {
        const r = byId(id);
        out.push(finding(r, file, block.line + countNewlines(block.body.slice(0, decl.index)), selector, `${decl.prop}: ${decl.value}`, overrides));
        ruleIds.add(id);
      };
      if (byId('CSS-MOTION-001') && decl.prop === 'transition' && /\ball\b/i.test(decl.value)) {
        push('CSS-MOTION-001', { severity: 'P2', confidence: 'high', status: 'candidate' });
      }
      if (decl.prop === 'transition' && /\b(width|height|top|left)\b/i.test(decl.value)) {
        push('CSS-LAYOUT-MOTION-001', { severity: 'P2', confidence: 'high', status: 'candidate' });
      }
      if (decl.prop === 'outline' && /\bnone\b/i.test(decl.value)) {
        const hasReplacement = /:focus-visible/i.test(allCssText);
        push('CSS-FOCUS-OUTLINE-001', hasReplacement
          ? { severity: 'P2', confidence: 'medium', status: 'candidate', evidence: 'outline:none found; possible :focus-visible replacement exists elsewhere.' }
          : { severity: 'P2', confidence: 'low', status: 'inconclusive' });
      }
      if (decl.prop === 'grid-template-columns' && /repeat\(\s*3\s*,/i.test(decl.value)) {
        push('CSS-THREE-COL-001', { severity: 'INFO', confidence: 'high', status: 'candidate' });
      }
      if (decl.prop === 'backdrop-filter') {
        const justified = /overlay|modal|nav|drawer|sheet|bottom-nav/i.test(selector);
        push('CSS-GLASS-001', justified
          ? { severity: 'INFO', confidence: 'medium', status: 'false_positive', evidence: 'Selector indicates a likely overlapping layer.' }
          : { severity: 'INFO', confidence: 'medium', status: 'candidate' });
      }
      if (decl.prop === 'box-shadow' && /^0\s+0\s+/i.test(decl.value) && /accent|gold|green|red|#|rgba?\(/i.test(decl.value)) {
        const state = /:focus|:active/i.test(selector);
        push('CSS-SHADOW-GLOW-001', state
          ? { severity: 'INFO', confidence: 'medium', status: 'false_positive', evidence: 'Selector is an interaction state.' }
          : { severity: 'INFO', confidence: 'medium', status: 'candidate' });
      }
      if (/^border-(left|right|inline-start)$/i.test(decl.prop) && /[2-9]px/i.test(decl.value)) {
        push('CSS-FINGERNAIL-001', { severity: 'INFO', confidence: 'high', status: 'candidate' });
      }
      if ((decl.prop === '--font-family-ui' || decl.prop === 'font-family') && /\b(inter|sora|geist)\b/i.test(decl.value)) {
        const conditional = /\[data-font|data-theme/i.test(selector);
        if (decl.prop === '--font-family-ui') {
          push('CSS-FONT-PRIMARY-001', conditional
            ? { severity: 'INFO', confidence: 'high', status: 'false_positive', evidence: 'Conditional or token-level selector.' }
            : { severity: 'INFO', confidence: 'medium', status: 'candidate' });
        } else {
          push('CSS-FONT-LOCAL-001', conditional
            ? { severity: 'INFO', confidence: 'high', status: 'false_positive', evidence: 'Conditional font selector.' }
            : { severity: 'INFO', confidence: 'medium', status: 'candidate' });
        }
      }
      if (/purple|indigo|violet|#(?:6d28d9|7c3aed|4f46e5|6366f1|a855f7|8b5cf6)/i.test(`${decl.prop} ${decl.value}`)) {
        push('CSS-PALETTE-001', { severity: 'INFO', confidence: 'medium', status: 'candidate' });
      }
    }
    if (/-webkit-background-clip\s*:\s*text|background-clip\s*:\s*text/i.test(block.body)) {
      const r = byId('CSS-GRADIENT-TEXT-001');
      out.push(finding(r, file, block.line, selector, 'background-clip:text', { severity: 'INFO', confidence: 'high', status: 'candidate' }));
    }
    const reducedBlock = block.media.some((m) => /prefers-reduced-motion/i.test(m));
    const hasAnimation = decls.some((d) => /^animation/.test(d.prop) && !(reducedBlock && /\bnone\b/i.test(d.value))) || (!reducedBlock && /animation\s*:/i.test(block.body));
    if (hasAnimation) {
      const r = byId('CSS-REDUCED-MOTION-001');
      const fileHasReducedMotion = /@media\s*\([^)]*prefers-reduced-motion/i.test(text);
      const override = fileHasReducedMotion
        ? { severity: 'INFO', confidence: 'low', status: 'false_positive', evidence: 'prefers-reduced-motion exists in this CSS file.' }
        : hasReducedMotion
          ? { severity: 'P2', confidence: 'low', status: 'inconclusive', evidence: 'prefers-reduced-motion exists elsewhere in the scanned CSS set; coverage of this animation is unproven.' }
          : { severity: 'P2', confidence: 'low', status: 'candidate', evidence: 'No prefers-reduced-motion declaration found in the scanned CSS set.' };
      out.push(finding(r, file, block.line, selector, 'animation/keyframes found', override));
    }
  }
  return out;
}

function scanHtml(file, text) {
  const out = [];
  const visible = visibleHtmlText(text);
  const stripped = stripHtmlComments(text).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const hype = /\b(elevate|seamless|next-generation|supercharge|unleash|empower|revolutioni[sz]e|streamline|world-class|enterprise-grade|cutting-edge)\b/i;
  const dot = /[·•]/u;
  if (hype.test(visible)) {
    const m = stripped.match(hype);
    const r = byId('CONTENT-HYPE-001');
    out.push(finding(r, file, lineAt(stripped, m.index), null, m[0], { severity: 'INFO', confidence: 'high', status: 'candidate', evidence: 'Word found in visible text.' }));
  }
  if (dot.test(visible)) {
    const clean = stripHtmlComments(text);
    const m = clean.match(dot);
    if (m) {
      const r = byId('CONTENT-MIDDLE-DOT-001');
      out.push(finding(r, file, lineAt(clean, m.index), null, m[0], { severity: 'INFO', confidence: 'high', status: 'candidate', evidence: 'Separator found in text content.' }));
    }
  }
  return out;
}

function applyFilters(findings, scopeFilter, view) {
  let out = findings;
  if (scopeFilter) out = out.filter((f) => f.scope === scopeFilter || (scopeFilter === 'view' && f.scope === 'global'));
  if (view) {
    const cap = view.charAt(0).toUpperCase() + view.slice(1);
    out = out.filter((f) => f.file.toLowerCase().includes(view.toLowerCase()) || (f.selector && (f.selector.includes(`#view${cap}`) || f.selector.includes(`.${view}`))));
  }
  return out;
}

function renderMarkdown(report) {
  const groups = ['confirmed', 'candidate', 'inconclusive', 'false_positive', 'unsupported'];
  const lines = [
    `# Anti-AI UI Review v${report.version}`,
    '',
    `Files: ${report.summary.files} | Findings: ${report.summary.findings}`,
    `Severity: ${SEVERITIES.map((s) => `${s} ${report.summary.bySeverity[s]}`).join(' · ')}`,
    `Status: ${STATUSES.map((s) => `${s} ${report.summary.byStatus[s]}`).join(' · ')}`,
    '',
    '## Limitations',
    ...report.limitations.map((l) => `- ${l}`),
    '',
  ];
  for (const group of groups) {
    const list = report.findings.filter((f) => f.status === group);
    lines.push(`## ${group} (${list.length})`);
    if (!list.length) {
      lines.push('_none_', '');
      continue;
    }
    for (const f of list) {
      lines.push(`- ${f.severity} ${f.id} ${f.file}:${f.line} ${f.rule}`);
      lines.push(`  status=${f.status} confidence=${f.confidence} scope=${f.scope}`);
      lines.push(`  selector=${f.selector || 'n/a'} snippet=${JSON.stringify(f.snippet)}`);
      lines.push(`  evidence=${f.evidence}`);
      lines.push(`  validate=${f.validation}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function checkDocsSync() {
  const errors = [];
  const tells = fs.readFileSync(path.join(SKILL_DIR, 'references', 'TELLS.md'), 'utf8');
  const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const versionMatch = skill.match(/^version:\s*["']?([^"'\n]+)["']?/m);
  if (!versionMatch || versionMatch[1].trim() !== VERSION) errors.push(`SKILL.md version != ${VERSION}`);

  const rows = tells.split(/\r?\n/).filter((l) => /^\| [A-Z]/.test(l));
  const documented = new Map();
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 5) continue;
    const [id, severity, scope, implementedRaw] = cells;
    if (!SEVERITIES.includes(severity)) continue;
    const implemented = implementedRaw.toLowerCase() === 'yes';
    if (documented.has(id)) errors.push(`duplicate documented id ${id}`);
    documented.set(id, { severity, scope, implemented });
  }
  const seen = new Set();
  for (const r of RULES) {
    if (seen.has(r.id)) errors.push(`duplicate implemented id ${r.id}`);
    seen.add(r.id);
    const doc = documented.get(r.id);
    if (!doc) {
      errors.push(`rule ${r.id} implemented but not documented`);
      continue;
    }
    if (doc.severity !== r.severity) errors.push(`${r.id} severity mismatch: docs=${doc.severity} code=${r.severity}`);
    if (doc.scope !== r.scope) errors.push(`${r.id} scope mismatch: docs=${doc.scope} code=${r.scope}`);
    if (doc.implemented !== r.implemented) errors.push(`${r.id} implemented mismatch: docs=${doc.implemented} code=${r.implemented}`);
  }
  for (const id of documented.keys()) {
    if (!seen.has(id)) errors.push(`rule ${id} documented but not implemented`);
  }
  return {
    ok: errors.length === 0,
    version: VERSION,
    documented: documented.size,
    implemented: seen.size,
    errors,
  };
}
