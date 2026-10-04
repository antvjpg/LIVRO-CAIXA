/* Testes de frontend da calculadora de juros compostos (LABS · múltiplo benchmark).
   Execução: node --test worker/test/*.test.mjs

   Sem DOM: confere por leitura dos arquivos a fiação da comparação
   múltipla de benchmarks — index.html (checkboxes/estrutura), app.js
   (seleção dos marcadores, cartões, gráfico e listener) e styles.css
   (estilos dos picks) — e garante que o antigo <select id="ciBenchmark">
   não permanece em nenhuma camada. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

test("index.html expõe os quatro benchmarks como múltipla escolha", () => {
  assert.match(html, /id="ciBenchCdi" checked/);
  assert.match(html, /id="ciBenchSelic"/);
  assert.match(html, /id="ciBenchPoupanca"/);
  assert.match(html, /id="ciBenchCustom"/);
  assert.match(html, /class="ci-benchmark-picks" role="group" aria-labelledby="ciBenchmarksLabel"/);
  assert.match(html, /for="ciBenchmarkRate">Taxa personalizada \(% ao mês\)<\/label>/);
  assert.doesNotMatch(html, /<select id="ciBenchmark">/);
  assert.doesNotMatch(html, /for="ciBenchmark">/);
});

test("app.js lê os marcadores e renderiza um cartão por benchmark", () => {
  for (const id of ["ciBenchCdi", "ciBenchSelic", "ciBenchPoupanca", "ciBenchCustom"]) {
    assert.ok(js.includes(`getElementById('${id}')`), `esperava leitura de #${id}`);
  }
  assert.ok(!js.includes("getElementById('ciBenchmark')"), "o antigo select #ciBenchmark não deve ser lido");
  assert.ok(!js.includes("ciBenchmark?.value"), "o valor do antigo select não deve ser lido");
  assert.match(js, /const benchmarkDefs = \[\]/);
  assert.match(js, /if \(!benchmarks\.length\)/);
  assert.match(js, /renderCompoundCalcChart\(months, scenario, benchmarks\)/);
  assert.match(js, /const benchmarkCards = benchmarks\.map\(/);
  assert.match(js, /const diffRows = benchmarks\.map\(/);
});

test("app.js traça uma linha tracejada por benchmark no gráfico", () => {
  assert.match(js, /const benchmarkColors = \{ 'CDI':/);
  assert.match(js, /const benchmarkDatasets = \(benchmarks \|\| \[\]\)\.map\(/);
  assert.ok(js.includes("...benchmarkDatasets"), "os datasets dos benchmarks devem entrar no gráfico");
  assert.ok(js.includes("borderDash: [6, 4]"), "benchmarks devem continuar tracejados");
});

test("styles.css estiliza os picks de benchmark", () => {
  assert.ok(css.includes(".ci-benchmark-picks{"));
  assert.ok(css.includes(".ci-benchmark-pick{"));
  assert.match(css, /\.ci-benchmark-pick:has\(input:checked\)/);
});

test("resposta local da LIA em juros compostos permanece com um benchmark", () => {
  assert.ok(js.includes("function buildCompoundInterestReply"));
  assert.match(js, /Comparativo \$\{benchmarkName\}/);
});
