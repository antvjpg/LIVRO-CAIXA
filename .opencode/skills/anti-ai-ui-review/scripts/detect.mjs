#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '1.0.0';
const EXT = new Set(['.html', '.htm', '.css', '.scss', '.sass', '.less', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.cache', '.vercel', '.turbo', 'coverage', 'vendor']);
const SKIP_RE = /(^|\/)(backup|\.bak|tmp-c13|e2e\/reports|\.artifacts|livro-caixa-main-check\.js)/i;
const SEV = { P0: 0, P1: 1, P2: 2, INFO: 3 };

const rules = [
  {
    id: 'T1', sev: 'P0', re: /(purple|indigo|violet|#(?:6d28d9|7c3aed|4f46e5|6366f1|a855f7|8b5cf6)|rgba?\(\s*(?:109|124|79|99|168|139)[,\s]+(?:40|58|70|102|85|92)[,\s]+(?:217|229|229|247|247|246))/i,
    msg: 'purple/indigo/violet palette or gradient', scope: 'style'
  },
  {
    id: 'T2', sev: 'P0', re: /-webkit-background-clip\s*:\s*text|background-clip\s*:\s*text/i,
    msg: 'gradient/clipped text used as emphasis', scope: 'style'
  },
  {
    id: 'T3', sev: 'P1', re: /transition\s*:\s*all/i,
    msg: 'transition:all', scope: 'style'
  },
  {
    id: 'T4', sev: 'P2', re: /grid-template-columns\s*:\s*repeat\(\s*3\s*,/i,
    msg: 'three equal columns; verify it is data, not template cards', scope: 'style'
  },
  {
    id: 'T5', sev: 'P2', re: /backdrop-filter\s*:/i,
    msg: 'glassmorphism; justify real overlap', scope: 'style'
  },
  {
    id: 'T6', sev: 'P2', re: /outline\s*:\s*none/i,
    msg: 'outline removed; verify :focus-visible replacement', scope: 'style'
  },
  {
    id: 'T7', sev: 'P2', re: /transition\s*:[^;]*\b(width|height|top|left)\b/i,
    msg: 'layout-property animation', scope: 'style'
  },
  {
    id: 'T8', sev: 'P2', re: /(?:^|[;{]\s*)(font-family|--font-family-ui)\s*:\s*['"]Inter['"]/i,
    msg: 'Inter as a font choice; verify it is deliberate', scope: 'style'
  },
  {
    id: 'T9', sev: 'P2', re: /box-shadow\s*:\s*0\s+0\s+[^;]*(accent|gold|green|red|#[0-9a-f]{3,8}|rgba?\([^)]*(?:1[0-9]{2}|2[0-5][0-9]))/i,
    msg: 'zero-offset colored shadow/glow', scope: 'style'
  },
  {
    id: 'T10', sev: 'P2', re: /[·•]/u,
    msg: 'middle-dot separator; prefer layout spacing', scope: 'markup'
  },
  {
    id: 'T11', sev: 'P1', re: /\b(elevate|seamless|next-generation|supercharge|unleash|empower|revolutioni[sz]e|streamline|world-class|enterprise-grade|cutting-edge)\b/i,
    msg: 'hype copy', scope: 'content'
  },
  {
    id: 'T12', sev: 'P2', re: /border-left\s*:\s*[2-9]px|border-right\s*:\s*[2-9]px|border-inline-start\s*:\s*[2-9]px/i,
    msg: 'fingernail accent border', scope: 'style'
  }
];

function collect(targets) {
  const files = [];
  const add = (p) => {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(abs)) || SKIP_RE.test(abs)) return;
      for (const entry of fs.readdirSync(abs, { withFileTypes: true })) add(path.join(abs, entry.name));
      return;
    }
    if (!EXT.has(path.extname(abs))) return;
    if (SKIP_RE.test(abs)) return;
    files.push(abs);
  };
  for (const t of targets) add(t);
  return files.sort();
}

function isStyle(file) {
  return ['.css', '.scss', '.sass', '.less'].includes(path.extname(file));
}

function scanFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      if (rule.scope === 'style' && !isStyle(file)) continue;
      if (rule.scope === 'markup' && !['.html', '.htm', '.vue', '.svelte'].includes(path.extname(file))) continue;
      if (rule.re.test(line)) {
        out.push({ id: rule.id, sev: rule.sev, file, line: i + 1, msg: rule.msg, evidence: 'code' });
        rule.re.lastIndex = 0;
      }
    }
  }
  if (isStyle(file) && /(?:@keyframes|animation\s*:)/i.test(text) && !/prefers-reduced-motion/i.test(text)) {
    out.push({ id: 'T13', sev: 'P2', file, line: 0, msg: 'animations without prefers-reduced-motion', evidence: 'code' });
  }
  return out;
}

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const targets = argv.filter((a) => !a.startsWith('--'));
const files = collect(targets.length ? targets : ['.']);
const findings = files.flatMap(scanFile);
const summary = { files: files.length, findings: findings.length, P0: 0, P1: 0, P2: 0, INFO: 0 };
for (const f of findings) summary[f.sev] += 1;

if (asJson) {
  console.log(JSON.stringify({ version: VERSION, summary, findings }, null, 2));
} else {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  for (const [file, list] of byFile) {
    console.log(path.relative(process.cwd(), file));
    for (const f of list.sort((a, b) => SEV[a.sev] - SEV[b.sev] || a.line - b.line)) {
      console.log(`  ${f.sev} ${f.id} L${f.line} ${f.msg}`);
    }
  }
  console.log(`${summary.findings} findings  P0 ${summary.P0}  P1 ${summary.P1}  P2 ${summary.P2}`);
  console.log('Code-certain only. Visual tells and intentional choices require the rendered review.');
}

process.exit(summary.P0 || summary.P1 ? 2 : 0);
