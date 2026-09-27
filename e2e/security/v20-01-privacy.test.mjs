/* C.O.D.E. — garantias de segurança V.20-01 (anexos · OCR · revisão).
   Análise estática do repositório: nada aqui usa rede nem navegador.
   Execução: npm run code:security (também roda no CI).

   O que esta suíte trava:
   - nenhum segredo no código novo;
   - o fluxo de anexos não faz rede nem persistência por conta própria;
   - nenhum console direto no bloco (tudo passa pelo log com lista branca);
   - HTML interpolado passa por escapeHTML;
   - a confirmação é validada ANTES de chamar o fluxo financeiro existente;
   - scripts e Service Worker continuam locais/intactos;
   - package.json continua sem dependências nem hooks de ciclo de vida. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');
const sw = read('sw.js');
const pkg = JSON.parse(read('package.json'));

const OCR_MODULES = [
  'ocr/limits.js',
  'ocr/log.js',
  'ocr/attachment-manager.js',
  'ocr/extractor.js',
  'ocr/ocr-adapter.js',
  'ocr/lia-interpret.js',
  'ocr/review.js'
];

/* bloco V.20-01 em index.html (do comentário de abertura ao fim do IIFE) */
const BLOCK_START = html.indexOf('V.20-01 — ANEXOS DA LIA');
assert.ok(BLOCK_START !== -1, 'bloco V.20-01 não encontrado em index.html');
const BLOCK_END = html.indexOf('})();', BLOCK_START) + 5;
const block = html.slice(BLOCK_START, BLOCK_END);
const lineOf = (rel, needle) => {
  const src = read(rel);
  const i = src.indexOf(needle);
  return i === -1 ? null : src.slice(0, i).split('\n').length;
};

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /sk-[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./,
  /Bearer\s+[A-Za-z0-9._-]{30,}/,
  /api[_-]?key\s*[:=]\s*['"][^'"]{16,}/,
  /secret\s*[:=]\s*['"][^'"]{16,}/
];

test('V.20-01 segurança: nenhum segredo no código novo', () => {
  const sources = OCR_MODULES
    .map((rel) => [rel, read(rel)])
    .concat([
      ['index.html (bloco V.20-01)', block],
      ['e2e/fixtures/v20-01-fixtures.js', read('e2e/fixtures/v20-01-fixtures.js')]
    ]);
  for (const [label, src] of sources) {
    for (const re of SECRET_PATTERNS) {
      const safe = new RegExp(re.source, 'i');
      assert.equal(safe.test(src), false, `${label}: contém padrão de segredo (${re.source})`);
    }
  }
});

test('V.20-01 segurança: nenhuma chave nova foi acrescentada a index.html', () => {
  /* A chave web do Firebase é configuração PÚBLICA e pré-existente; a V.20-01
     não pode acrescentar nenhum outro padrão de credencial à página. */
  const keys = html.match(/AIza[0-9A-Za-z_-]{30,}/g) || [];
  assert.ok(keys.length <= 2, `chaves demais em index.html: ${keys.length}`);
  const inBlock = block.match(/AIza[0-9A-Za-z_-]{30,}/g) || [];
  assert.equal(inBlock.length, 0, 'o bloco V.20-01 não pode conter chave');
});

test('V.20-01 segurança: módulos ocr não fazem rede nem escrevem em console', () => {
  const forbidden = [
    ['fetch(', /\bfetch\s*\(/],
    ['XMLHttpRequest', /XMLHttpRequest/],
    ['WebSocket', /WebSocket\s*\(/],
    ['importScripts', /importScripts\s*\(/],
    ['eval(', /\beval\s*\(/],
    ['new Function', /new\s+Function\s*\(/],
    ['localStorage', /localStorage/],
    ['sessionStorage', /sessionStorage/],
    ['indexedDB', /indexedDB/],
    ['firebase', /firebase/i],
    ['firestore', /firestore/i]
  ];
  for (const rel of OCR_MODULES) {
    if (rel === 'ocr/log.js') continue; // log.js é o ÚNICO ponto de emissão
    const src = read(rel);
    for (const [label, re] of forbidden) {
      assert.equal(re.test(src), false, `${rel}: não deve usar ${label}`);
    }
    assert.equal(/console\./.test(src), false, `${rel}: log deve passar por LivroCaixaOCRLog`);
  }
});

test('V.20-01 segurança: o log é emitido apenas pelo módulo de log', () => {
  const logSrc = read('ocr/log.js');
  assert.equal(/console\.(log|info)\s*\(/.test(logSrc), false, 'log.js não usa console.log');
  assert.match(logSrc, /ALLOWED_KEYS/);
  for (const rel of OCR_MODULES) {
    if (rel === 'ocr/log.js') continue;
    const src = read(rel);
    const hits = src.match(/log\.(event|failure)\s*\(/g) || [];
    assert.ok(hits.length > 0 || /attachment-manager|ocr-adapter|extractor|lia-interpret|review|limits/.test(rel));
    assert.equal(/console\.(log|warn|error|debug)/.test(src), false, `${rel}: saída direta proibida`);
  }
});

test('V.20-01 segurança: bloco de anexos não chama console nem persiste sozinho', () => {
  for (const needle of ['console.', 'localStorage', 'sessionStorage', 'eval(', 'document.write']) {
    assert.equal(block.includes(needle), false, `bloco V.20-01 contém ${needle}`);
  }
  for (const needle of ['fetch(', 'XMLHttpRequest', 'https://', 'http://']) {
    assert.equal(block.includes(needle), false, `bloco V.20-01 não pode fazer rede (${needle})`);
  }
  /* nenhuma escrita direta em Firestore no fluxo de anexos */
  for (const needle of ['writeBatch', 'insertId', 'deleteDocument', '.add(', 'doc(']) {
    assert.equal(block.includes(needle), false, `bloco V.20-01 não deve persistir por conta própria (${needle})`);
  }
});

test('V.20-01 segurança: HTML interpolado passa por escapeHTML', () => {
  const assignments = block.match(/innerHTML\s*=\s*[^;]+;/g) || [];
  assert.ok(assignments.length >= 3, 'esperava-se renderização por innerHTML no preview');
  for (const stmt of assignments) {
    const emptyish = /innerHTML\s*=\s*(''|url)/.test(stmt);
    if (emptyish) continue;
    const safeRenderer = /escapeHTML\(|ocrFieldHtml\(/.test(stmt);
    assert.ok(safeRenderer, `atribuição sem escape: ${stmt.slice(0, 120)}`);
  }
  /* a renderização dos campos inteira passa por ocrFieldHtml/ocrControlHtml */
  assert.match(block, /function ocrFieldHtml/);
  assert.match(block, /function ocrControlHtml/);
});

test('V.20-01 segurança: confirmação é validada ANTES do fluxo financeiro', () => {
  const confirmIdx = block.indexOf("getElementById('btnOcrReviewConfirm')");
  assert.ok(confirmIdx !== -1, 'botão de confirmação deve existir');
  const handler = block.slice(confirmIdx);

  const validateIdx = handler.indexOf('LivroCaixaReview.validate(');
  const saveIdx = handler.indexOf('saveMovementFromForm()');
  const guardIdx = handler.indexOf('if (!result.ok)');

  assert.ok(validateIdx !== -1, 'validação obrigatória ausente');
  assert.ok(saveIdx !== -1, 'fluxo existente deve ser reutilizado');
  assert.ok(guardIdx !== -1, 'guarda de validação ausente');
  assert.ok(validateIdx < saveIdx, 'validação deve vir ANTES de salvar');
  assert.ok(guardIdx > validateIdx && guardIdx < saveIdx, 'a guarda deve interromper antes de salvar');
  assert.ok(handler.indexOf('return;', guardIdx) !== -1, 'a guarda precisa retornar sem salvar');

  /* trava anti-clique-duplo */
  assert.match(handler, /ocrState\.confirming/);
  /* o botão entra na lista global de trava única de ações */
  const lockLine = html.split('\n').find((l) => l.includes("'btnOcrReviewConfirm']"));
  assert.ok(lockLine, 'btnOcrReviewConfirm fora da lista de trava única');
  assert.match(lockLine, /'fSalvar'/);
});

test('V.20-01 segurança: revisão não pode ser pulada pelo atalho do formulário', () => {
  /* o painel só fecha com ação explícita e todo caminho de saída zera o estado */
  assert.match(block, /function ocrAbortReview/);
  assert.match(block, /function ocrReleaseAll/);
  /* cancel/close descartam sem gravar */
  assert.match(block, /btnOcrReviewCancel/);
  assert.match(block, /Anexo descartado\. Nada foi gravado\./);
  assert.match(block, /Revisão encerrada\. Nada foi gravado\./);
  /* o estado é zerado quando o painel sai da tela */
  assert.match(block, /MutationObserver/);
});

test('V.20-01 segurança: entrada manual continua disponível sem anexo', () => {
  assert.match(block, /btnLiaManualEntry/);
  assert.match(html, /id="liaAttachmentFallback"/);
  assert.match(html, /id="btnLiaAttach"/);
});

test('V.20-01 segurança: módulos carregados são de origem local', () => {
  const scripts = html.match(/<script[^>]*src="[^"]+"[^>]*>/g) || [];
  const added = scripts.filter((tag) => /ocr\//.test(tag));
  assert.equal(added.length, 7, `esperavam-se 7 módulos ocr, há ${added.length}`);
  for (const tag of added) {
    assert.match(tag, /src="\.\/ocr\/[a-z-]+\.js"/, `src externo ou suspeito: ${tag}`);
    assert.doesNotMatch(tag, /https?:\/\//, 'nenhum CDN pode ser adicionado pela V.20-01');
  }
  /* nenhum provedor de OCR/capacitor pode ser puxado de CDN */
  const forbidden = /tesseract|@capacitor|capacitor-|ocr\.min|google.*vision|aws.*textract/i;
  for (const tag of scripts) {
    assert.doesNotMatch(tag, forbidden, `script de OCR externo detectado: ${tag}`);
  }
});

test('V.20-01 segurança: Service Worker não guarda anexo nem texto OCR', () => {
  assert.equal(/ocr\//.test(sw), false, 'sw.js não deve precachear módulos ocr');
  assert.equal(/attachment/i.test(sw), false, 'sw.js não deve tratar anexos');
  assert.equal(/CACHE_NAME/.test(sw), true, 'CACHE_NAME deve continuar existindo');
  const cacheLine = /const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/.exec(sw);
  assert.ok(cacheLine, 'CACHE_NAME não encontrado');
  /* a V.20-01 não altera estratégia de cache */
  assert.match(cacheLine[1], /^livro-caixa-/);
});

test('V.20-01 segurança: package.json continua sem dependências nem hooks', () => {
  assert.equal(pkg.dependencies, undefined, 'package.json não pode ganhar dependencies');
  assert.equal(pkg.optionalDependencies, undefined);
  assert.equal(pkg.peerDependencies, undefined);
  assert.equal(pkg.scripts.prepare, undefined);
  assert.equal(pkg.scripts.preinstall, undefined);
  assert.equal(pkg.scripts.postinstall, undefined);
  assert.equal(pkg.scripts.install, undefined);
  assert.ok(pkg.scripts['code:syntax'], 'script de validação de sintaxe deve existir');
  assert.ok(pkg.scripts['code:v20'], 'script da suíte V.20-01 deve existir');

  const allowed = /^(node|playwright|python3)/;
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    assert.match(cmd, allowed, `script ${name} usa binário inesperado: ${cmd}`);
    for (const bad of ['curl ', 'wget ', 'sudo ', ' rm ', ' > ', ' | ', '$(']) {
      assert.equal(cmd.includes(bad), false, `script ${name} contém ${bad.trim()}`);
    }
  }
});

test('V.20-01 segurança: fixture não contém dado pessoal real', () => {
  const fixture = read('e2e/fixtures/v20-01-fixtures.js');
  assert.match(fixture, /CODE_V2001/);
  assert.equal(/\d{3}\.\d{3}\.\d{3}-\d{2}/.test(fixture), false, 'CPF detectado na fixture');
  assert.equal(/\b\d{13,16}\b/.test(fixture), false, 'número de cartão detectado na fixture');
  /* o CNPJ do documento é fictício e documentado como tal */
  assert.match(fixture, /12\.345\.678\/0001-90/);
  assert.match(fixture, /SINTÉTICOS|sintéticos/);
});

test('V.20-01 segurança: diagnóstico do fluxo nunca registra conteúdo do documento', () => {
  const calls = [...block.matchAll(/LivroCaixaOCRLog\.(?:event|failure)\(\s*'([^']+)'\s*,\s*([^)]*)\)/g)];
  assert.ok(calls.length > 0, 'o fluxo deve registrar eventos com lista branca');
  const allowed = new Set(require('../../ocr/log.js').ALLOWED_KEYS);
  for (const [, event, rawArgs] of calls) {
    assert.match(event, /^[a-z]+\.[a-z_]+$/, `nome de evento fora do padrão: ${event}`);
    const keys = [...rawArgs.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]);
    for (const key of keys) {
      assert.ok(allowed.has(key), `chave "${key}" fora da lista branca em ${event}`);
    }
  }
});

test('V.20-01 segurança: linha de apoio — bloco localizado corretamente', () => {
  assert.ok(BLOCK_END > BLOCK_START);
  assert.ok(block.length > 10000, 'o bloco V.20-01 parece truncado');
  assert.equal(lineOf('index.html', 'V.20-01 — ANEXOS DA LIA') > 10000, true);
  assert.match(block, /LivroCaixaReview/);
  assert.match(block, /LivroCaixaExtract/);
  assert.match(block, /LivroCaixaOCRLia/);
});

test('V.20-01 segurança: cancelamento (signal) chega até o Worker', () => {
  const start = html.indexOf('async generateViaWorker');
  assert.ok(start !== -1, 'generateViaWorker ausente');
  const body = html.slice(start, html.indexOf('\n  },', start));
  assert.match(body, /async generateViaWorker\(\{ prompt, imagePart, maxTokens, signal \}\)/);
  assert.match(body, /\{\s*signal\s*\}/, 'postWorker deve receber { signal }');

  assert.match(html, /generate\(\{ prompt, imagePart, maxTokens, signal \} = \{\}\)/);
  assert.match(html, /maxTokens: tokenCap, signal \}\);/);
});
