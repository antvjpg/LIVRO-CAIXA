/* Testes de frontend do Chat IA (V.20, ETAPA 13).
   Execução: node --test worker/test/*.test.mjs

   Sem DOM e sem dependência extra: exercita a máquina de estados da
   conversa e o orçamento de snapshot que o index.html importa de
   ai-chat-contract.js, e confere por leitura do HTML a fiação declarada
   (contrato, IDs, listeners, superfície pública e ausência de código
   legado/otimizado). */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  CHAT_LIMITS,
  createChatSession,
  fitChatSnapshotToBudget,
  snapshotHasData
} from "../../ai-chat-contract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

/* ---------------------------- snapshots de teste ---------------------------- */

function smallSnapshot() {
  return {
    accounts: [{ id: "a1", name: "Conta principal", balance: 1500 }],
    pockets: [],
    goals: [],
    investments: [],
    budgets: [{ id: "b1", name: "Mercado", limit: 800 }]
  };
}

function overLimitSnapshot() {
  const accounts = Array.from({ length: 60 }, (_, i) => ({
    id: `acc-${i}`,
    name: `Conta ${i}`,
    balance: 1234.56 + i,
    note: `Observação detalhada da conta número ${i} usada para estourar o orçamento do envio. `.repeat(30)
  }));
  return {
    accounts,
    pockets: [],
    goals: [],
    investments: [],
    budgets: [{ id: "b1", name: "Orçamento grande", limit: 900, note: "x".repeat(200) }],
    cards: { activeCount: 2 }
  };
}

function impossibleSnapshot() {
  /* Campo que nenhuma redução toca: só assim o corte pode falhar. */
  return {
    accounts: [{ id: "a1", name: "Conta", balance: 10 }],
    projection: "y".repeat(CHAT_LIMITS.SNAPSHOT_MAX_BYTES + 1024)
  };
}

/* ------------------------- orçamento do snapshot --------------------------- */

test("orçamento: snapshot pequeno sai intacto e sem cortes", () => {
  const snap = smallSnapshot();
  const result = fitChatSnapshotToBudget(snap);

  assert.equal(result.ok, true);
  assert.deepEqual(result.dropped, []);
  assert.equal(result.snapshot, snap, "não deve reconstruir o objeto quando já cabe");
  assert.ok(result.bytes <= CHAT_LIMITS.SNAPSHOT_MAX_BYTES);
});

test("orçamento: snapshot grande é reduzido até caber, removendo sem inventar", () => {
  const snap = overLimitSnapshot();
  const rawBytes = JSON.stringify(snap).length;
  assert.ok(rawBytes > CHAT_LIMITS.SNAPSHOT_MAX_BYTES, "fixture deve estourar o limite");

  const result = fitChatSnapshotToBudget(snap);

  assert.equal(result.ok, true);
  assert.ok(result.bytes <= CHAT_LIMITS.SNAPSHOT_MAX_BYTES, `ficou com ${result.bytes} bytes`);
  assert.ok(result.dropped.length > 0, "alguma redução precisou ser aplicada");
  assert.ok(result.dropped.includes("detalhamento das contas"));
  assert.equal("accounts" in result.snapshot, false, "contas detalhadas foram o corte final");

  /* Nunca inventa campo: tudo que existe no resultado já existia antes. */
  for (const key of Object.keys(result.snapshot)) {
    assert.ok(key in snap, `campo ${key} apareceu do nada`);
  }
});

test("orçamento: o que sobra continua sendo um snapshot válido para o contrato", () => {
  const result = fitChatSnapshotToBudget(overLimitSnapshot());
  assert.equal(result.ok, true);
  assert.equal(typeof result.snapshot, "object");
  assert.ok(Array.isArray(result.snapshot.pockets));
});

test("orçamento: quando nem o corte resolve, devolve snapshot_too_large e não envia", () => {
  const result = fitChatSnapshotToBudget(impossibleSnapshot());

  assert.equal(result.ok, false);
  assert.equal(result.reason, "snapshot_too_large");
  assert.ok(result.bytes > result.limit);
  assert.equal(result.limit, CHAT_LIMITS.SNAPSHOT_MAX_BYTES);
  assert.ok(Array.isArray(result.dropped));
});

/* ------------------------------ snapshotHasData ---------------------------- */

test("snapshotHasData: sem nada para interpretar, não queima a cota", () => {
  assert.equal(snapshotHasData(null), false);
  assert.equal(snapshotHasData(undefined), false);
  assert.equal(snapshotHasData({}), false);
  assert.equal(snapshotHasData({ accounts: [], pockets: [], goals: [] }), false);
  assert.equal(snapshotHasData({ accounts: [], cashFlow: { transactionCount: 0 } }), false);
  assert.equal(snapshotHasData({ cards: { activeCount: 0 } }), false);
});

test("snapshotHasData: qualquer fonte de dado real conta", () => {
  assert.equal(snapshotHasData({ accounts: [{ id: "a1" }] }), true);
  assert.equal(snapshotHasData({ pockets: [{ id: "p1" }] }), true);
  assert.equal(snapshotHasData({ goals: [{ id: "g1" }] }), true);
  assert.equal(snapshotHasData({ investments: [{ id: "i1" }] }), true);
  assert.equal(snapshotHasData({ budgets: [{ id: "b1" }] }), true);
  assert.equal(snapshotHasData({ cards: { activeCount: 1 } }), true);
  assert.equal(snapshotHasData({ cashFlow: { transactionCount: 3 } }), true);
});

/* -------------------------- máquina de estados ----------------------------- */

test("máquina: mesma conta preserva a conversa ao fechar e reabrir", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const started = session.begin("quanto gastei?");
  assert.equal(started.ok, true);
  assert.equal(session.commit(started.token, "quanto gastei?", "R$ 1.200"), true);

  session.close();
  assert.equal(session.isOpen(), false);

  session.openFor("user-1");
  assert.equal(session.isOpen(), true);
  assert.equal(session.getMessages().length, 2, "fechar/reabrir não apaga a conversa");
  assert.equal(session.getAccountId(), "user-1");
});

test("máquina: trocar de conta apaga a conversa e invalida o voo antigo", () => {
  const session = createChatSession();
  session.openFor("user-1");
  const first = session.begin("p1");
  assert.equal(session.commit(first.token, "p1", "r1"), true);

  const previousSession = session.getSessionId();
  session.openFor("user-2");

  assert.equal(session.getMessages().length, 0, "outro dono = conversa nova");
  assert.equal(session.getSessionId(), previousSession + 1);
  assert.equal(session.getAccountId(), "user-2");
  assert.equal(session.commit(first.token, "p1", "r2"), false, "resposta da conta anterior não entra");
  assert.equal(session.settle(first.token), false);
});

test("máquina: não aceita segundo envio enquanto houver um em andamento", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const first = session.begin("primeira");
  assert.equal(first.ok, true);
  assert.equal(session.isBusy(), true);
  assert.deepEqual(session.getPending(), { content: "primeira" });

  const second = session.begin("segunda");
  assert.equal(second.ok, false, "segundo envio bloqueado");
  assert.equal(second.token, null);

  assert.equal(session.settle(first.token), true);
  assert.equal(session.isBusy(), false);
  assert.equal(session.getPending(), null);

  const third = session.begin("segunda");
  assert.equal(third.ok, true, "liberou depois de encerrar o envio");
});

test("máquina: fechar no meio do voo invalida a resposta tardia", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const inFlight = session.begin("p1");
  session.close();

  assert.equal(session.getPending(), null);
  assert.equal(session.isBusy(), false);
  assert.equal(session.commit(inFlight.token, "p1", "tarde demais"), false);
  assert.equal(session.settle(inFlight.token), false, "o finally do voo antigo não mexe no estado");
  assert.equal(session.getMessages().length, 0);
});

test("máquina: o finally de um voo antigo não limpa um envio novo (fechar→reabrir→perguntar)", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const old = session.begin("primeira");
  session.close();
  session.openFor("user-1");

  const current = session.begin("segunda");
  assert.equal(current.ok, true, "reabriu e conseguiu perguntar de novo");
  assert.equal(session.settle(old.token), false, "token antigo não derruba o envio novo");
  assert.equal(session.isBusy(), true);
  assert.equal(session.getPending().content, "segunda");

  assert.equal(session.commit(old.token, "primeira", "atrasada"), false);
  assert.equal(session.commit(current.token, "segunda", "na hora"), true);
  assert.equal(session.getMessages().length, 2);
  assert.equal(session.settle(current.token), true);
  assert.equal(session.isBusy(), false);
});

test("máquina: resetContext é o único caminho que apaga e descarta o voo", () => {
  const session = createChatSession();
  session.openFor("user-1");
  const started = session.begin("p1");
  assert.equal(session.commit(started.token, "p1", "r1"), true);

  const previousSession = session.getSessionId();
  session.resetContext();

  assert.equal(session.getMessages().length, 0);
  assert.equal(session.getPending(), null);
  assert.equal(session.isBusy(), false);
  assert.equal(session.getSessionId(), previousSession + 1);
  assert.equal(session.commit(started.token, "p1", "r2"), false);
  assert.equal(session.settle(started.token), false);
});

test("máquina: getMessages devolve cópia (o render não muta o histórico)", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const view = session.getMessages();
  view.push({ role: "user", content: "injetada" });

  assert.equal(session.getMessages().length, 0);
});

test("máquina: fluxo completo de uma pergunta (begin→commit→settle)", () => {
  const session = createChatSession();
  session.openFor("user-1");

  const started = session.begin("qual o saldo?");
  assert.equal(session.isCurrent(started.token), true);
  assert.equal(session.commit(started.token, "qual o saldo?", "R$ 3.400"), true);
  assert.equal(session.settle(started.token), true);

  assert.equal(session.isBusy(), false);
  assert.equal(session.getPending(), null);
  assert.deepEqual(
    session.getMessages().map((m) => m.role),
    ["user", "assistant"]
  );
});

/* ----------------------------- fiação no HTML ------------------------------ */

test("index.html: contrato carregado como módulo antes do DOMContentLoaded", () => {
  assert.match(html, /<script type="module" src="\.\/ai-chat-contract\.js"><\/script>/);

  const contractAt = html.indexOf('src="./ai-chat-contract.js"');
  const bootAt = html.indexOf("document.addEventListener('DOMContentLoaded'");
  assert.ok(contractAt > -1, "script do contrato presente");
  assert.ok(bootAt > -1, "bootstrap em DOMContentLoaded presente");
  assert.ok(contractAt < bootAt, "contrato declarado antes do bootstrap");
});

test("index.html: chat usa máquina e orçamento do contrato, sem cópia local", () => {
  assert.match(html, /contract\.createChatSession\(\)/);
  assert.match(html, /contract\.fitChatSnapshotToBudget\(/);
  assert.match(html, /contract\.snapshotHasData\(/);

  assert.doesNotMatch(html, /function fitChatSnapshotToBudget/);
  assert.doesNotMatch(html, /function aiChatSnapshotHasData/);
  assert.doesNotMatch(html, /const CHAT_SNAPSHOT_REDUCTIONS/);
  assert.doesNotMatch(html, /aiChat\.(messages|pending|busy|sessionId|accountId|open)\b/);
});

test("index.html: estado interno só pela superfície window.LivroCaixaChat", () => {
  const surface = html.match(/window\.LivroCaixaChat = \{[\s\S]{0,400}?\};/);
  assert.ok(surface, "superfície LivroCaixaChat declarada");
  for (const key of ["open:", "close:", "resetContext:", "isOpen:", "isBusy:", "getMessages:"]) {
    assert.ok(surface[0].includes(key), `superfície expõe ${key}`);
  }
});

test("index.html: IDs do chat presentes, únicos e com os listeners", () => {
  for (const id of ["panelAiChat", "btnAiChatClose", "aiChatForm", "aiChatInput", "aiChatMessages", "aiChatNotice", "btnAiChatSend"]) {
    const hits = html.split(`id="${id}"`).length - 1;
    assert.equal(hits, 1, `id="${id}" deve existir exatamente uma vez (achou ${hits})`);
  }

  assert.match(html, /getElementById\('btnAiChatClose'\)\?\.addEventListener\('click'/);
  assert.match(html, /getElementById\('aiChatForm'\)\?\.addEventListener\('submit'/);
});

test("index.html: card de Análise financeira por IA removido a pedido", () => {
  assert.doesNotMatch(html, /dashboardGeminiHost|btnGeminiDiagnostic|geminiDiagnostic/,
    "o card e seu atalho saíram do HTML/JS");
  assert.doesNotMatch(css, /dashboardGeminiHost|dashboard-gemini-host/,
    "as regras de estilo exclusivas do card saíram do CSS");
});

test("index.html: abertura e fechamento do modal seguem o caminho comum", () => {
  assert.match(html, /function openModal\(panelId\) \{\s*closeFilterChoice\(\);\s*const overlay = document\.getElementById\('modalOverlay'\);/,
    "openModal precisa materializar o overlay (regressão V.20)");
  assert.match(html, /window\.closeAllPanels = function\(\)/);
  assert.match(html, /window\.LivroCaixaChat\?\.close/, "fechar modal global encerra o chat");
});

test("index.html: tratamento de erro cobre os códigos do contrato e do Worker", () => {
  const block = html.match(/const AI_CHAT_ERROR_MESSAGES = \{([\s\S]*?)\n  \};/);
  assert.ok(block, "AI_CHAT_ERROR_MESSAGES declarado");

  const covered = [
    "no_data", "snapshot_too_large", "contract_unavailable",
    "empty_message", "message_too_long", "network", "offline",
    "rate_limited", "daily_limit", "empty_reply",
    "not_authenticated", "token_failed", "worker_not_configured",
    "bad_body", "payload_too_large", "chat_payload_too_large"
  ];
  for (const code of covered) {
    assert.match(block[1], new RegExp(`\\b${code}:`), `code "${code}" sem mensagem amigável`);
  }

  /* 429 sem code nomeado (rate limit de origem) cai no rate_limited. */
  assert.ok(html.includes("http_429"), "fallback http_429 → rate_limited");
  assert.match(html, /function aiChatErrorMessage\(err\)/);
});

test("index.html: render do chat escapa o conteúdo vindo da IA", () => {
  assert.match(html, /escapeHTML\(item\.content\)/);
  assert.match(html, /escapeHTML\(pending\.content\)/);
  assert.match(html, /escapeHTML\(AI_CHAT_GREETING\)/);
});

test("index.html: fluxo legado de diagnóstico por seções não voltou", () => {
  /* Só menção histórica em comentário é aceita: definição e chamadas, nunca. */
  assert.doesNotMatch(html, /function runGeminiFinancialDiagnosis/);
  assert.doesNotMatch(html, /runGeminiFinancialDiagnosis\s*\(/);
  assert.doesNotMatch(html, /renderAnalysisSections\s*\(/);
  assert.doesNotMatch(html, /ANALYSIS_SECTION/);
  assert.doesNotMatch(html, /\.analysis-section/);
});

/* --------------------- revisão de uso (ícones/contador/foco) --------------- */

test("index.html: FAB alterna ícone — messages só na Visão geral, + nas demais abas", () => {
  assert.match(html, /id="fabAdd"[^>]*><svg class="add-icon"[\s\S]{0,200}?<i class="fi fi-rr-messages fab-chat-icon" aria-hidden="true"><\/i><\/button>/,
    "FAB deve manter o + original e carregar o ícone messages junto");
  assert.match(css, /\.fab-add \.fab-chat-icon\{display:none;/,
    "messages deve iniciar oculto (padrão de todas as abas)");
  assert.match(css, /body\[data-tab="dashboard"\] \.fab-add \.add-icon\{display:none;\}/,
    "na Visão geral o + some");
  assert.match(css, /body\[data-tab="dashboard"\] \.fab-add \.fab-chat-icon\{display:block;\}/,
    "na Visão geral o messages aparece");
});

test("index.html: botão de enviar usa paper-plane-top", () => {
  assert.match(html, /id="btnAiChatSend"[\s\S]{0,200}?fi fi-rr-paper-plane-top/);
  assert.doesNotMatch(html, /id="btnAiChatSend"[\s\S]{0,200}?➤/);
});

test("index.html: contador de leitura de IA reusa [data-ai-quota] no intro", () => {
  assert.match(html, /id="aiChatIntro"[\s\S]{0,300}?class="ai-chat-quota" data-ai-quota aria-live="polite"/,
    "contador deve ser um nó data-ai-quota dentro do texto de intro");
  assert.match(html, /window\.renderAiQuotaStatus\?\.\(\);\s*\n\s*window\.LivroCaixaAI\?\.refreshQuota\?\.\(\{ silent: true, throttleMs: 15000 \}\);/,
    "abrir o chat atualiza o contador (padrão throttle do app)");
});

test("index.html: foco do chat não desloca overlay/painel (regressão de arrasto)", () => {
  assert.match(html, /focus\(\{ preventScroll: true \}\)/, "foco programático usa preventScroll");
  assert.match(html, /function aiChatResetModalScroll\(/);
  assert.match(html, /getElementById\('aiChatInput'\)\?\.addEventListener\('focus'/);
  assert.match(html, /getElementById\('aiChatInput'\)\?\.addEventListener\('blur'/);
  assert.match(html, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(html, /aiChatApplyViewportFix\(\);\s*\n\s*window\.renderAiQuotaStatus/, "fix também roda na abertura");
});

test("index.html: área de conversa e trava de rolagem mantêm o cabeçalho no lugar", () => {
  assert.match(html, /aiChatMessagesBox\?\.addEventListener\('pointerdown', \(\) => requestAnimationFrame\(\(\) => aiChatResetModalScroll\(true\)\)\)/,
    "toque na área de mensagens zera o deslocamento sem pular a conversa");
  assert.match(html, /aiChatMessagesBox\?\.addEventListener\('focus', \(\) => requestAnimationFrame\(\(\) => aiChatResetModalScroll\(true\)\)\)/,
    "foco na área de mensagens zera o deslocamento sem pular a conversa");
  assert.match(html, /\['modalOverlay', 'panelAiChat'\]\.forEach/,
    "as duas caixas que nunca devem rolar são vigiadas");
  assert.match(html, /addEventListener\('scroll', \(\) => \{\s*\n\s*if \(!window\.LivroCaixaChat\?\.isOpen\?\.\(\)\) return;/,
    "a trava de rolagem só age com o chat aberto (outros modais ficam intactos)");
});

test("index.html: reset de scroll cobre página/teclado (correção mobile)", () => {
  assert.match(html, /window\.scrollTo\(0, 0\)/, "zera a rolagem da página (ponte do teclado)");
  assert.match(html, /document\.documentElement\.scrollTop = 0/, "zera documentElement");
  assert.match(html, /document\.body\.scrollTop = 0/, "zera body");
  assert.match(html, /aiChatResetModalScroll\(\);\s*\n\s*openModal\('panelAiChat'\)/, "reset antes do openModal");
  assert.match(html, /function closeAiChat\(\) \{[\s\S]{0,1600}?aiChatResetModalScroll\(\);/, "fechamento também reseta");
  assert.match(html, /aiChat\.pageScroll/, "posição da página é salva no abrir e devolvida no fechar");
  assert.match(html, /el\.style\.transform = ''/, "limpa transform/top/height inline residuais");
});

test("index.html/css: 2ª rodada — sheet medido pela visualViewport (teclado mobile)", () => {
  assert.match(html, /name="viewport"[^>]*interactive-widget=resizes-content/,
    "viewport reflow com o teclado (Android Chrome)");
  assert.match(html, /function aiChatFitVisualViewport\(/, "medida da visual viewport");
  assert.match(html, /--ai-chat-vv-bottom/, "gap do teclado vira custom property");
  assert.match(html, /--ai-chat-vv-max/, "altura máxima vira custom property");
  assert.match(html, /window\.setTimeout\(aiChatApplyViewportFix, 50\)/, "reafirma após o scroll nativo (50ms)");
  assert.match(html, /window\.setTimeout\(aiChatApplyViewportFix, 150\)/, "reafirma quando o teclado assenta (150ms)");
  assert.match(html, /visualViewport\?\.addEventListener\('scroll'/, "pan da viewport visual também dispara");
  assert.match(html, /removeProperty\('--ai-chat-vv-bottom'\)/, "fechar limpa as medidas");
  assert.match(css, /#panelAiChat\.open\{[^}]*position:absolute/,
    "no mobile o sheet sai do flex-center e vira absoluto");
  assert.match(css, /bottom:max\(var\(--ai-chat-vv-bottom/,
    "ancorado acima do teclado");
  assert.match(css, /max-height:var\(--ai-chat-vv-max/,
    "altura máxima amarrada à viewport visível");
});
