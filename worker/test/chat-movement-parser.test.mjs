/* Testes do parser local de movimentação por texto digitado da LIA.
   Execução: node --test worker/test/*.test.mjs

   Sem DOM: extrai parsePtNumberValue + parseMovementFromText do app.js
   e executa com stubs (banks, categories, histórico, data) para conferir
   o contrato — casa só com valor + verbo de direção, nunca com perguntas
   ou texto sem conta cadastrada. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const js = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

const sliceBetween = (from, to) => {
  const start = js.indexOf(from);
  const end = js.indexOf(to);
  assert.ok(start !== -1, `marcador inicial não encontrado: ${from}`);
  assert.ok(end !== -1 && end > start, `marcador final não encontrado: ${to}`);
  return js.slice(start, end);
};

const parserSrc =
  sliceBetween("function parsePtNumberValue(raw)", "function buildCompoundInterestReply") +
  sliceBetween("function parseMovementFromText(rawText)", "function exportPatrimonyChartPng");

const BANKS = [{ id: "b1", name: "Banco Alpha" }, { id: "b2", name: "Banco Beta" }];
const CATEGORIES = [
  { id: "cAlim", name: "Alimentação" },
  { id: "cTrans", name: "Transporte" },
  { id: "cSaude", name: "Saúde" },
  { id: "cLazer", name: "Lazer" },
  { id: "cMora", name: "Moradia" },
  { id: "cSal", name: "Salário" },
  { id: "cRenda", name: "Renda Extra" }
];

const makeParser = ({ banks = BANKS, categories = CATEGORIES, history = {} } = {}) => {
  const factory = new Function(
    "banks",
    "categories",
    "suggestCategoryForDescription",
    "todayISO",
    parserSrc + "\nreturn parseMovementFromText;"
  );
  return factory(
    banks,
    categories,
    (description) => history[String(description || "").trim().toLowerCase()] || "",
    () => "2026-10-04"
  );
};

test("casa gasto com 'N reais' e categoria por palavra-chave", () => {
  const result = makeParser()("gastei 30 reais no mercado");
  assert.ok(result, "deve casar");
  assert.equal(result.type, "out");
  assert.equal(result.amount, 30);
  assert.equal(result.desc, "mercado");
  assert.equal(result.category, "cAlim");
  assert.equal(result.bank, "b1");
  assert.equal(result.date, "2026-10-04");
});

test("casa 'R$ 45,90' com vírgula decimal", () => {
  const result = makeParser()("paguei R$ 45,90 no restaurante");
  assert.ok(result, "deve casar");
  assert.equal(result.type, "out");
  assert.equal(result.amount, 45.9);
  assert.equal(result.desc, "restaurante");
  assert.equal(result.category, "cAlim");
});

test("casa entrada com verbo de recebimento", () => {
  const result = makeParser()("recebi 1500 de salário");
  assert.ok(result, "deve casar");
  assert.equal(result.type, "in");
  assert.equal(result.amount, 1500);
  assert.equal(result.desc, "salário");
  assert.equal(result.category, "cSal");
});

test("entende separador de milhar '1.200'", () => {
  const result = makeParser()("gastei R$ 1.200 no mercado");
  assert.ok(result, "deve casar");
  assert.equal(result.amount, 1200);
  assert.equal(result.type, "out");
});

test("sem maiúsculas no verbo o span ainda remove o número da descrição", () => {
  const result = makeParser()("Recebi 1500 de salário");
  assert.ok(result, "deve casar");
  assert.equal(result.amount, 1500);
  assert.equal(result.desc, "salário");
  assert.equal(result.type, "in");
});

test("perguntas nunca casam", () => {
  assert.equal(makeParser()("quanto está meu saldo?"), null);
  assert.equal(makeParser()("qual é a melhor corretora?"), null);
  assert.equal(makeParser()("quando vou receber"), null);
});

test("texto sem verbo ou sem valor não casa", () => {
  assert.equal(makeParser()("mercado"), null);
  assert.equal(makeParser()("gastei no mercado"), null, "verbo sem número");
  assert.equal(makeParser()("hoje fiz compras"), null);
});

test("sem banco cadastrado não casa (não há onde lançar)", () => {
  const parse = makeParser({ banks: [] });
  assert.equal(parse("gastei 30 reais no mercado"), null);
});

test("transferência textual não casa — fluxo é de movimentação", () => {
  assert.equal(makeParser()("transfiri 100 reais para a conta poupança"), null);
});

test("categoria sem palavra-chave cai no histórico e depois vazio", () => {
  const withHistory = makeParser({ history: { "joias": "cLazer" } });
  const result = withHistory("gastei 20 reais com joias");
  assert.ok(result, "deve casar");
  assert.equal(result.category, "cLazer");

  const noHistory = makeParser();
  const other = noHistory("gastei 20 reais com joias");
  assert.ok(other, "deve casar mesmo sem categoria");
  assert.equal(other.category, "", "sem categoria o Editar resolve");
});

test("arredonda para 2 casas e usa o primeiro banco cadastrado", () => {
  const result = makeParser()("paguei R$ 33,333 no mercado");
  assert.ok(result, "deve casar");
  assert.equal(result.amount, 33.33);
  assert.equal(result.bank, "b1");
});
