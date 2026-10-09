/* Teste-guarda do layout de CSS (pasta style/).
   Execução: node --test worker/test/*.test.mjs

   styles.css foi dividido em cinco camadas preservando os bytes e a
   ordem original: base → components → layout → features →
   dashboard-chat, sempre depois de themes.css. A ordem dos <link> é a
   cascata; o sw.js precisa precachear todos para o shell PWA não ficar
   sem tema offline. Falha aqui = path ou ordem quebrados em
   refatoração futura. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

const SPLIT = [
  "base.css",
  "components.css",
  "layout.css",
  "features.css",
  "dashboard-chat.css"
];
const EXPECTED_ORDER = ["./style/themes.css", ...SPLIT.map((f) => `./style/${f}`)];

test("os seis arquivos de CSS existem em style/ e styles.css foi removido", () => {
  for (const file of ["themes.css", ...SPLIT]) {
    const full = path.join(ROOT, "style", file);
    assert.ok(fs.existsSync(full), `style/${file} deveria existir`);
    assert.ok(fs.statSync(full).size > 0, `style/${file} não deveria ser vazio`);
  }
  assert.ok(
    !fs.existsSync(path.join(ROOT, "style", "styles.css")),
    "style/styles.css não deveria mais existir (dividido em 5 camadas)"
  );
});

test("index.html linka os CSS de ./style/ na ordem de cascata", () => {
  const linked = [...html.matchAll(/href="(\.\/style\/[a-z-]+\.css)(?:\?[^"]*)?"/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(
    linked,
    EXPECTED_ORDER,
    "o index.html deve linkar themes + as 5 camadas na ordem base → components → layout → features → dashboard-chat"
  );
});

test("index.html não tem mais link para styles.css (raiz ou style/)", () => {
  assert.ok(
    !html.includes('href="./styles.css'),
    "link antigo ./styles.css na raiz deveria ter sido removido"
  );
  assert.ok(
    !html.includes("./style/styles.css"),
    "link antigo ./style/styles.css deveria ter sido removido"
  );
});

test("sw.js precacheia todos os CSS da cascata", () => {
  for (const asset of EXPECTED_ORDER) {
    assert.ok(sw.includes(`"${asset}"`), `APP_SHELL deveria conter ${asset}`);
  }
});

test("sw.js não precacheia mais styles.css", () => {
  assert.ok(
    !sw.includes("./style/styles.css"),
    "APP_SHELL não deveria mais referenciar ./style/styles.css"
  );
  assert.ok(!sw.includes('"./styles.css"'), "APP_SHELL não deveria referenciar ./styles.css na raiz");
});
