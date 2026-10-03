/* C.O.D.E. — validação de sintaxe.
   Execução: npm run code:syntax   (sem rede, sem navegador)

   O JavaScript do LIVRO-CAIXA é majoritariamente INLINE dentro de
   index.html — nenhum linter do repositório o cobre. Este script extrai
   cada bloco <script> sem src e o compila (vm.Script, executa nada),
   além de compilar com node --check os módulos .js do repositório.

   NÃO executa código: só compila.

   ---------------------------------------------------------------------------
   ENDURECIMENTO (2026-10) — falso negativo estrutural corrigido
   ---------------------------------------------------------------------------
   A versão anterior usava `/<script\b[^>]*>([\s\S]*?)<\/script>/gi`. Como o
   pareamento é "preguiçoso", um </script> SEM <script> correspondente fechava
   a tag ABERTA MAIS PRÓXIMA, e todo o JS que ficava entre eles simplesmente
   DESAPARECIA da análise.

   Consequência real observada: com o index.html de produção quebrado (JS
   100% fora das tags, app morto), o verificador compilava 3 blocos de 1 byte
   e reportava "SINTAXE: OK". A etapa de QA do CI passava enquanto nenhum
   JavaScript executava.

   Agora o documento é percorrido por varredura (mesmo pareamento do HTML):
     1. <script> sem </script>  → erro;
     2. </script> órfão         → erro;
     3. JS que aparece FORA de <script>…</script> → erro;
     4. cada bloco inline segue sendo compilado como antes. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const JS_FILES = [
  'app.js',
  'emoji-catalog.js',
  'patches.js',
  'card-engine-v3-combined.js',
  'financial-client.js',
  'ai-chat-contract.js',
  'chat-persistence.js',
  'sw.js',
  'ocr/limits.js',
  'ocr/log.js',
  'ocr/attachment-manager.js',
  'ocr/extractor.js',
  'ocr/ocr-adapter.js',
  'ocr/lia-interpret.js',
  'ocr/review.js',
  'src/diagnostic/login-diagnostic.js'
];

/* Linha de texto que só pode ser JavaScript (prosa/HTML nunca a gera). */
const JS_LINE = new RegExp([
  '^\\s*(?:const|let|var)\\s+[\\w$]+\\s*(?:[:=]|\\[|\\.)',
  '^\\s*(?:async\\s+)?function\\s*\\*?\\s*[\\w$]+\\s*\\(',
  '^\\s*(?:window|document|self|globalThis)\\s*\\.\\s*[\\w$]+\\s*[=.(]',
  '^\\s*}\\s*[\\]);,]*$',
  '^\\s*\\)\\s*(?:=>|\\{)',
  '^\\s*(?:if|for|while|switch|try|catch|return|throw|await)\\s*[({\'"`\\[]'
].join('|'));

function lineOf(html, index) {
  return html.slice(0, index).split('\n').length;
}

/* Varre o documento imitando o pareamento do parser HTML: dentro de um
   <script>, o primeiro </script> é o que encerra — <script> aninhado dentro
   é texto, não nova abertura. */
function scan(html) {
  const spans = [];
  const outside = [];
  const errors = [];
  const openRe = /<script\b([^>]*)/gi;
  const closeRe = /<\/script\s*>/gi;
  let pos = 0;

  for (;;) {
    openRe.lastIndex = pos;
    const om = openRe.exec(html);
    const openAt = om ? om.index : html.length;
    if (openAt > pos) outside.push([pos, openAt]);
    if (!om) break;

    const contentStart = om.index + om[0].length + 1; // +1 => após o ">"
    closeRe.lastIndex = contentStart;
    const cm = closeRe.exec(html);
    if (!cm) {
      errors.push(`index.html:${lineOf(html, openAt)}: <script> sem </script> correspondente`);
      outside.push([openAt, html.length]);
      break;
    }
    spans.push({
      attrs: om[1] || '',
      offset: lineOf(html, contentStart),
      code: html.slice(contentStart, cm.index)
    });
    pos = closeRe.lastIndex;
  }
  return { spans, outside, errors };
}

function outsideErrors(html, outside) {
  const errors = [];
  for (const [from, to] of outside) {
    const chunk = html.slice(from, to);

    for (const m of chunk.matchAll(/<\/script\s*>/gi)) {
      errors.push(
        `index.html:${lineOf(html, from + m.index)}: </script> órfão ` +
        '(fecha uma tag que não foi aberta e desalinha todo o restante)'
      );
    }

    const text = chunk.replace(/<!--[\s\S]*?-->/g, '');
    const base = lineOf(html, from);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trimStart().startsWith('<')) continue;      // é marcação
      if (!JS_LINE.test(line)) continue;                  // é texto normal
      errors.push(
        `index.html:${base + i}: JavaScript fora de <script> → ${line.trim().slice(0, 90)}`
      );
    }
  }
  return errors;
}

function inlineScripts(spans) {
  return spans.filter((s) => {
    const attrs = s.attrs;
    if (/\bsrc\s*=/i.test(attrs)) return false;
    if (/\btype\s*=\s*["'](?!text\/javascript|module["'])/i.test(attrs)) return false;
    return true;
  });
}

function collectJsFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        out.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  };
  for (const dir of ['ocr', 'src']) {
    const abs = path.join(ROOT, dir);
    if (fs.existsSync(abs)) walk(abs);
  }
  return [...JS_FILES, ...out].filter((f, i, a) => a.indexOf(f) === i);
}

function main() {
  const failures = [];

  const htmlPath = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { spans, outside, errors } = scan(html);

  failures.push(...errors);
  failures.push(...outsideErrors(html, outside));

  const blocks = inlineScripts(spans);
  blocks.forEach((block, index) => {
    try {
      new vm.Script(block.code, { filename: `index.html:inline[${index}]@${block.offset}` });
    } catch (err) {
      failures.push(`index.html bloco #${index + 1} (linha ~${block.offset}): ${err.message}`);
    }
  });

  const files = collectJsFiles();
  for (const rel of files) {
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
    for (const f of failures.slice(0, 40)) console.error(' - ' + f);
    if (failures.length > 40) console.error(` - ... e mais ${failures.length - 40} falha(s)`);
    process.exit(1);
  }
  console.log(
    `SINTAXE: OK (${blocks.length} bloco(s) inline de index.html + ${files.length} arquivo(s) .js)`
  );
}

main();
