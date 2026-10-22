/* Testes do contrato externo da Ponte de IA (Fase 1).
   Execução: node --test worker/test/

   Cobre: limites documentados, sanitização de IDs internos, envelope
   externo, varredura de chaves proibidas e validação autoritativa.
   Somente contrato — nenhuma ferramenta de escrita existe na V1. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  MCP_CONTRACT_VERSION,
  MCP_TOOL_GET_FINANCIAL_SNAPSHOT,
  MCP_LIMITS,
  findForbiddenKeys,
  sanitizeFinancialSnapshot,
  buildExternalSnapshotResult,
  validateExternalSnapshotResult
} from "../../mcp-financial-contract.js";
import { CHAT_LIMITS } from "../../ai-chat-contract.js";

/* Fixture: snapshot no formato de buildFinancialSnapshot (P3.5),
   incluindo o único ID bruto conhecido (budgets[].categoryId). */
function snapshotFixture() {
  return {
    schemaVersion: "P3.5",
    generatedAt: "2026-10-12T12:00:00.000Z",
    period: {
      currentMonth: "2026-10",
      monthsIncluded: 12,
      currentMonthComplete: false,
      currentMonthTotals: { income: 5000, expense: 3200, net: 1800, transactions: 42 },
      latestEntryDate: "2026-10-10"
    },
    cashFlow: {
      totalIncome: 5000,
      totalExpense: 3200,
      net: 1800,
      transactionCount: 42,
      expensesByCategory: [{ category: "Mercado", amount: 900 }]
    },
    monthlyFlow: [{ month: "2026-09", income: 4800, expense: 3100, net: 1700, transactions: 40 }],
    patrimony: { banks: 8000, pockets: 2000, investments: 15000, total: 25000 },
    accounts: [{ name: "Nubank", balance: 4000 }],
    pockets: [{ name: "Viagem", objective: "Passagem", balance: 1200, target: 3000, progressPercent: 40, remaining: 1800 }],
    investments: [{ name: "Tesouro IPCA", type: "Renda Fixa", institution: "Banco X", value: 15000, rate: 0, dueDate: "2029-01-01" }],
    cards: { activeCount: 2, invoiceLaunchCount: 10, purchaseCount: 14, currentInvoiceTotal: 1500, currentInvoiceRemaining: 900, previousInvoiceRemaining: 0, totalLimit: 20000, totalUsed: 1500, committed: 1500 },
    budgets: [{ categoryId: "cat_mercado", category: "Mercado", amount: 1000, limit: 1000, spent: 900, id: "orc_1", month: "2026-10", updatedAt: "2026-10-01T00:00:00.000Z" }],
    goals: [{ name: "Reserva", target: 10000, current: 4000, remaining: 6000, progressPercent: 40, deadline: "2026-12-31", status: "em andamento", daysRemaining: 80, source: "pocket" }],
    indicators: { source: "worker", fetchedAt: "2026-10-12T00:00:00.000Z", selic: { value: 15, unit: "% a.a.", date: "2026-10-10" } },
    structuralDiagnosis: { issueCount: 0, issues: [] }
  };
}

/* ------------------------------------------------------------------ */
/* Fonte única dos limites                                             */
/* ------------------------------------------------------------------ */

test("limites do contrato MCP são exatamente os documentados", () => {
  assert.equal(MCP_CONTRACT_VERSION, 1);
  assert.equal(MCP_TOOL_GET_FINANCIAL_SNAPSHOT, "get_financial_snapshot");
  assert.equal(MCP_LIMITS.SNAPSHOT_MAX_BYTES, CHAT_LIMITS.SNAPSHOT_MAX_BYTES);
  assert.equal(MCP_LIMITS.SNAPSHOT_MAX_BYTES, 64 * 1024);
  assert.equal(MCP_LIMITS.MAX_LIST_ITEMS, 40);
});

/* ------------------------------------------------------------------ */
/* Sanitização                                                         */
/* ------------------------------------------------------------------ */

test("sanitização remove categoryId e campos internos de budgets preservando os dados", () => {
  const r = sanitizeFinancialSnapshot(snapshotFixture());
  assert.equal(r.ok, true);
  assert.equal(r.value.budgets.length, 1);
  const budget = r.value.budgets[0];
  assert.ok(!("categoryId" in budget), "categoryId deve ser removido");
  assert.ok(!("id" in budget), "id interno deve ser removido");
  assert.ok(!("month" in budget), "month interno deve ser removido");
  assert.ok(!("updatedAt" in budget), "updatedAt deve ser removido");
  assert.equal(budget.category, "Mercado");
  assert.equal(budget.spent, 900, "valores financeiros nunca são alterados");
  assert.equal(r.removed.length, 4);
});

test("sanitização não altera os demais domínios nem inventa campos", () => {
  const input = snapshotFixture();
  const r = sanitizeFinancialSnapshot(input);
  assert.deepEqual(r.value.accounts, input.accounts);
  assert.deepEqual(r.value.pockets, input.pockets);
  assert.deepEqual(r.value.goals, input.goals);
  assert.deepEqual(r.value.cashFlow, input.cashFlow);
  assert.equal(r.value.schemaVersion, "P3.5");
});

test("sanitização rejeita entrada que não é objeto", () => {
  assert.equal(sanitizeFinancialSnapshot(null).code, "invalid_snapshot");
  assert.equal(sanitizeFinancialSnapshot("x").code, "invalid_snapshot");
  assert.equal(sanitizeFinancialSnapshot([]).code, "invalid_snapshot");
});

/* ------------------------------------------------------------------ */
/* Varredura de chaves proibidas                                       */
/* ------------------------------------------------------------------ */

test("varredura detecta chaves proibidas em qualquer profundidade", () => {
  const found = findForbiddenKeys({
    accounts: [{ name: "Nubank", balance: 1, docId: "abc" }],
    budgets: [{ category: "Mercado", categoryId: "cat_1" }],
    meta: { user: { uid: "u1", email: "a@b.c" } },
    token: "abc"
  });
  assert.ok(found.some(p => p.includes("docId")));
  assert.ok(found.some(p => p.includes("categoryId")));
  assert.ok(found.some(p => p.includes("uid")));
  assert.ok(found.some(p => p.includes("email")));
  assert.ok(found.includes("token"));
});

test("varredura é insensível a maiúsculas (APIKEY/ApiKey)", () => {
  const found = findForbiddenKeys({ cfg: { APIKEY: "sk-x" } });
  assert.equal(found.length, 1);
  assert.ok(found[0].includes("APIKEY"));
});

/* ------------------------------------------------------------------ */
/* Envelope externo                                                    */
/* ------------------------------------------------------------------ */

test("envelope feliz: versão, ferramenta, generatedAt, period e data sanitizada", () => {
  const r = buildExternalSnapshotResult(snapshotFixture());
  assert.equal(r.ok, true);
  assert.equal(r.value.contractVersion, 1);
  assert.equal(r.value.tool, "get_financial_snapshot");
  assert.equal(r.value.generatedAt, "2026-10-12T12:00:00.000Z");
  assert.equal(r.value.period.currentMonth, "2026-10");
  assert.equal(r.value.sourceSchemaVersion, "P3.5");
  assert.ok(!("categoryId" in r.value.data.budgets[0]));
  assert.ok(r.bytes > 0 && r.bytes <= MCP_LIMITS.SNAPSHOT_MAX_BYTES);
});

test("envelope sem generatedAt ou period válido é rejeitado", () => {
  const noStamp = snapshotFixture();
  delete noStamp.generatedAt;
  assert.equal(buildExternalSnapshotResult(noStamp).body.code, "invalid_generated_at");

  const noPeriod = snapshotFixture();
  delete noPeriod.period;
  assert.equal(buildExternalSnapshotResult(noPeriod).body.code, "invalid_period");

  const badPeriod = snapshotFixture();
  badPeriod.period = { currentMonth: "não-é-data" };
  assert.equal(buildExternalSnapshotResult(badPeriod).body.code, "invalid_period");
});

test("snapshot acima de 64 KB é rejeitado no envelope", () => {
  const big = snapshotFixture();
  big.cashFlow.note = "x".repeat(70 * 1024);
  const r = buildExternalSnapshotResult(big);
  assert.equal(r.ok, false);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "snapshot_too_large");
});

test("round-trip: envelope construído passa na validação autoritativa", () => {
  const built = buildExternalSnapshotResult(snapshotFixture());
  assert.equal(built.ok, true);
  const v = validateExternalSnapshotResult(built.value);
  assert.equal(v.ok, true, JSON.stringify(v.body));
  assert.equal(v.bytes, built.bytes);
});

/* ------------------------------------------------------------------ */
/* Validação autoritativa                                              */
/* ------------------------------------------------------------------ */

test("validação rejeita envelope malformado, versão errada e ferramenta errada", () => {
  assert.equal(validateExternalSnapshotResult(null).body.code, "invalid_external_snapshot");
  assert.equal(validateExternalSnapshotResult([]).body.code, "invalid_external_snapshot");

  const built = buildExternalSnapshotResult(snapshotFixture()).value;

  assert.equal(
    validateExternalSnapshotResult({ ...built, contractVersion: 99 }).body.code,
    "contract_version_mismatch"
  );
  assert.equal(
    validateExternalSnapshotResult({ ...built, tool: "delete_everything" }).body.code,
    "unknown_tool"
  );
  assert.equal(
    validateExternalSnapshotResult({ ...built, data: null }).body.code,
    "invalid_envelope"
  );
  assert.equal(
    validateExternalSnapshotResult({ ...built, generatedAt: "ontem" }).body.code,
    "invalid_envelope"
  );
});

test("validação bloqueia IDs internos mesmo que a sanitização tenha sido pulada", () => {
  const built = buildExternalSnapshotResult(snapshotFixture()).value;
  const tampered = JSON.parse(JSON.stringify(built));
  tampered.data.budgets[0].categoryId = "cat_vazamento";
  const r = validateExternalSnapshotResult(tampered);
  assert.equal(r.ok, false);
  assert.equal(r.body.code, "forbidden_fields");
  assert.ok(r.body.fields.some(f => f.includes("categoryId")));
});

test("validação bloqueia credenciais embutidas em qualquer domínio", () => {
  const built = buildExternalSnapshotResult(snapshotFixture()).value;
  const tampered = JSON.parse(JSON.stringify(built));
  tampered.data.accounts[0].uid = "uid-de-outra-conta";
  const r = validateExternalSnapshotResult(tampered);
  assert.equal(r.body.code, "forbidden_fields");
});

test("validação aplica o mesmo teto de 64 KB", () => {
  const built = buildExternalSnapshotResult(snapshotFixture()).value;
  const big = JSON.parse(JSON.stringify(built));
  big.data.pockets.push({ name: "x", balance: 0, padding: "y".repeat(70 * 1024) });
  const r = validateExternalSnapshotResult(big);
  assert.equal(r.status, 413);
  assert.equal(r.body.code, "snapshot_too_large");
});

test("contrato V1 é somente leitura: nenhuma ferramenta de escrita declarada", () => {
  assert.equal(MCP_TOOL_GET_FINANCIAL_SNAPSHOT, "get_financial_snapshot");
  /* A única constante de ferramenta exportada hoje é a de leitura.
     Se uma ferramenta de escrita for adicionada por engano, este teste
     falha e força uma revisão explícita das regras da V1. */
  const contractSource = fs.readFileSync(
    new URL("../../mcp-financial-contract.js", import.meta.url),
    "utf8"
  );
  const toolConsts = contractSource.match(/MCP_TOOL_[A-Z_]+/g) || [];
  assert.deepEqual([...new Set(toolConsts)], ["MCP_TOOL_GET_FINANCIAL_SNAPSHOT"]);
});
