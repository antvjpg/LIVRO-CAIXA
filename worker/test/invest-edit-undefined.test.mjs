/* Edição de ativo de Renda Fixa x batch do Firestore — regressão do
   "saldo inicial não salva".
   Execução: node --test worker/test/*.test.mjs

   Sem DOM e sem rede: lê app.js e executa os helpers de sincronização
   extraídos do arquivo. Cobre a causa comprovada do bug — a edição
   materializava `priceHistory: undefined` (RF nunca tem priceHistory) e
   o Firestore 10.12.2 rejeita undefined, derrubando o batch INTEIRO da
   coleção "investments" de forma silenciosa (log só). */

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

const syncHelpers = () =>
  sliceBetween("function stripUndefinedSyncValues", "function arrToMap");
const editSaveFn = () =>
  sliceBetween("document.getElementById('iSalvar').onclick", "document.getElementById('billSalvar').onclick");
const commitFn = () =>
  sliceBetween("async function commitDiff", "function persistAll");

const loadSyncHelpers = () =>
  new Function(`${syncHelpers()}; return { stripUndefinedSyncValues, cloneSyncItem };`)();

/* ---------------------------------- sanitizador: comportamento real */

test("sanitizador remove chaves undefined no topo e aninhadas", () => {
  const { stripUndefinedSyncValues } = loadSyncHelpers();
  const out = stripUndefinedSyncValues({
    id: "inv1",
    priceHistory: undefined,
    nested: { keep: 1, drop: undefined },
    arr: [{ keep: true, drop: undefined }]
  });
  assert.equal(Object.prototype.hasOwnProperty.call(out, "priceHistory"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(out.nested, "drop"), false);
  assert.equal(out.nested.keep, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(out.arr[0], "drop"), false);
});

test("sanitizador preserva valores falsos válidos (0, false, '', null)", () => {
  const { stripUndefinedSyncValues } = loadSyncHelpers();
  const out = stripUndefinedSyncValues({ zero: 0, no: false, blank: "", nil: null });
  assert.deepEqual(out, { zero: 0, no: false, blank: "", nil: null });
});

test("undefined dentro de array vira null (mesma semântica do fallback JSON)", () => {
  const { stripUndefinedSyncValues } = loadSyncHelpers();
  assert.deepEqual(stripUndefinedSyncValues({ list: [1, undefined, 3] }), { list: [1, null, 3] });
  assert.equal(stripUndefinedSyncValues("texto"), "texto");
  assert.equal(stripUndefinedSyncValues(null), null);
});

test("cloneSyncItem (structuredClone) não entrega chave undefined ao batch", () => {
  const { cloneSyncItem } = loadSyncHelpers();
  /* Caso real da edição de RF antes do fix: priceHistory materializado. */
  const cloned = cloneSyncItem({ id: "inv1", name: "Tesouro Selic", priceHistory: undefined, value: 100 });
  assert.equal(Object.prototype.hasOwnProperty.call(cloned, "priceHistory"), false,
    "structuredClone preservaria a chave; o sanitizador deve removê-la");
  assert.equal(cloned.value, 100);
  /* Ponto exato do Firestore (reproduzido com o bundle 10.12.2 em Node):
     set({priceHistory: undefined}) → invalid-argument "Unsupported field value". */
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(cloned)));
});

test("cloneSyncItem mantém priceHistory real de cripto intacto", () => {
  const { cloneSyncItem } = loadSyncHelpers();
  const history = [{ date: "2026-01-01", price: 5 }];
  const cloned = cloneSyncItem({ id: "inv2", priceHistory: history });
  assert.deepEqual(cloned.priceHistory, history, "array existente não pode ser descartado");
});

/* -------------------------------------------- fiação da sincronização */

test("cabo: arrToMap clona via cloneSyncItem; commitDiff escreve o que arrToMap devolve", () => {
  assert.match(js, /function arrToMap\(arr\)[\s\S]{0,200}cloneSyncItem\(it\)/,
    "arrToMap é o único caminho de clonagem para lastSynced e para a escrita");
  const commit = commitFn();
  assert.match(commit, /arrToMap\(current\[name\]\)/, "payload de escrita passa por arrToMap");
  assert.match(commit, /data: newItem/, "batch.set usa o objeto clonado (já sanitizado)");
});

/* ------------------------------------------------- caminho da edição */

test("edição de ativo não materializa priceHistory undefined", () => {
  const save = editSaveFn();
  assert.match(save, /Array\.isArray\(old\.priceHistory\)/,
    "priceHistory só entra no registro quando existe");
  assert.doesNotMatch(save, /priceHistory: old\.priceHistory, \.\.\.record/,
    "o spread cego era o que injetava undefined (RF nunca tem priceHistory)");
});

test("edição preserva createdAt/order e grava o novo initialValue", () => {
  const save = editSaveFn();
  assert.match(save, /createdAt: old\.createdAt, order: old\.order/);
  assert.match(save, /const initialValue = type === 'Renda Fixa' \? value : null;/);
  assert.match(save, /\.\.\.record \};\s*\n\s*targetItem = investments\[idx\]/,
    "o registro novo substitui o item mantendo os campos de identidade");
});
