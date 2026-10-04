/* Teste-guarda do layout de CSS (pasta style/).
   Execução: node --test worker/test/*.test.mjs

   Garante que styles.css e themes.css vivem em style/ e que as
   referências continuam apontando para lá na ordem correta
   (themes.css ANTES de styles.css — a ordem do <link> é a cascata;
   o sw.js precisa precachear os dois para o shell PWA não ficar sem
   tema offline). Falha aqui = path quebrado em refatoração futura. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

test("os dois arquivos de CSS existem em style/", () => {
  for (const file of ["styles.css", "themes.css"]) {
    const full = path.join(ROOT, "style", file);
    assert.ok(fs.existsSync(full), `style/${file} deveria existir`);
    assert.ok(fs.statSync(full).size > 0, `style/${file} não deveria ser vazio`);
  }
});

test("index.html linka os CSS sob ./style/", () => {
  assert.ok(html.includes('href="./style/themes.css'), "index.html deveria linkar ./style/themes.css");
  assert.ok(html.includes('href="./style/styles.css'), "index.html deveria linkar ./style/styles.css");
});

test("themes.css carrega antes de styles.css (cascata)", () => {
  const iT = html.indexOf("./style/themes.css");
  const iS = html.indexOf("./style/styles.css");
  assert.ok(iT !== -1 && iS !== -1, "ambos os links deveriam existir");
  assert.ok(iT < iS, "themes.css deve vir antes de styles.css no index.html");
});

test("index.html não tem mais link para styles.css na raiz", () => {
  assert.ok(!html.includes('href="./styles.css'), "link antigo ./styles.css na raiz deveria ter sido removido");
});

test("sw.js precacheia os dois CSS sob ./style/", () => {
  assert.ok(sw.includes('"./style/themes.css"'), "APP_SHELL deveria conter ./style/themes.css");
  assert.ok(sw.includes('"./style/styles.css"'), "APP_SHELL deveria conter ./style/styles.css");
  assert.ok(!sw.includes('"./styles.css"'), "APP_SHELL não deveria mais referenciar ./styles.css na raiz");
});
