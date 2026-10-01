/* C.O.D.E. — validação de sintaxe.
   Execução: npm run code:syntax   (sem rede, sem navegador)

   O JavaScript do LIVRO-CAIXA é majoritariamente INLINE dentro de
   index.html — nenhum linter do repositório o cobre. Este script extrai
   cada bloco <script> sem src e o compila (vm.Script, executa nada),
   além de compilar com node --check os módulos .js do repositório.

   NÃO executa código: só compila. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const JS_FILES = [
  'card-engine-v3-combined.js',
  'financial-client.js',
  'ai-chat-contract.js',
  'ocr/limits.js',
  'ocr/log.js',
  'ocr/attachment-manager.js',
  'ocr/extractor.js',
  'ocr/ocr-adapter.js',
  'ocr/lia-interpret.js',
  'ocr/review.js'
];

function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (/\btype\s*=\s*["'](?!text\/javascript|module["'])/i.test(attrs)) continue;
    const offset = html.slice(0, m.index).split('\n').length;
    out.push({ offset, code: m[2] });
  }
  return out;
}

function main() {
  const failures = [];

  const htmlPath = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const blocks = inlineScripts(html);
  blocks.forEach((block, index) => {
    try {
      new vm.Script(block.code, { filename: `index.html:inline[${index}]@${block.offset}` });
    } catch (err) {
      failures.push(`index.html bloco #${index + 1} (linha ~${block.offset}): ${err.message}`);
    }
  });

  for (const rel of JS_FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      failures.push(`${rel}: arquivo não encontrado`);
      continue;
    }
    const res = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (res.status !== 0) {
      failures.push(`${rel}: ${(res.stderr || res.stdout || '').trim().split('\n')[0]}`);
    }
  }

  if (failures.length) {
    console.error('SINTAXE: FALHOU');
    for (const f of failures) console.error(' - ' + f);
    process.exit(1);
  }
  console.log(`SINTAXE: OK (${blocks.length} bloco(s) inline de index.html + ${JS_FILES.length} arquivo(s) .js)`);
}

main();
