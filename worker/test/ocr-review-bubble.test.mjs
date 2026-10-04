/* Testes de frontend dos balões de revisão de anexo da LIA.
   Execução: node --test worker/test/*.test.mjs

   Sem DOM: confere por leitura dos arquivos a fiação do fluxo —
   leitura do anexo → UM balão de texto (cabeçalho + linhas
   "Rótulo: valor" + anexo dentro + botão "Revisar") → modal certo no
   clique (convencional → revisão; transferência → Transferência
   universal pré-preenchida), sem abertura automática, e a limpeza do
   balão junto com o estado (ocrReleaseAll). */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const js = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

const sliceBetween = (from, to) => {
  const start = js.indexOf(from);
  const end = js.indexOf(to);
  assert.ok(start !== -1, `marcador inicial não encontrado: ${from}`);
  assert.ok(end !== -1 && end > start, `marcador final não encontrado: ${to}`);
  return js.slice(start, end);
};

const clickHandler = () =>
  sliceBetween("function onAiChatMessagesClick", "const AI_CHAT_ERROR_MESSAGES");
const pipeline = () =>
  sliceBetween("async function ocrRunPipeline", "function ocrFillLaunchForm");
const releaseAll = () =>
  sliceBetween("function ocrReleaseAll", "function ocrHolderLabel");
const bubbles = () =>
  sliceBetween("function ocrChatBubblesParts", "function ocrPrefillTransferForm");
const prefill = () =>
  sliceBetween("function ocrPrefillTransferForm", "render preview */");
const wireUp = () =>
  sliceBetween("(function ocrWireUp()", "function updateInvestmentMainValue");

test("aiChatRender injeta o balão derivado de ocrState", () => {
  assert.match(js, /parts\.push\(\.\.\.ocrChatBubblesParts\(\)\);/,
    "render deve empurrar o balão antes do bloco pending");
  assert.match(js, /function ocrChatBubblesParts\(\)/);
  assert.match(js, /const model = ocrState && ocrState\.model;/,
    "balão só existe com modelo pendente");
});

test("UM balão com cabeçalho, linhas Rótulo: valor, anexo e botão", () => {
  const flow = bubbles();
  const singleBubble = (js.split('<div class="ai-chat-msg is-assistant is-ocr-summary">').length - 1);
  assert.equal(singleBubble, 1, "o builder deve produzir exatamente UM balão");
  assert.doesNotMatch(flow, /is-ocr-cta/, "sem balão secundário de CTA");
  assert.match(flow, /'Informações reconhecidas'/, "template convencional");
  assert.match(flow, /ocrChatLine\('Data', value\('date'\)\)/);
  assert.match(flow, /ocrChatLine\('Tipo', value\('type'\)\)/);
  assert.match(flow, /ocrChatLine\('Banco', value\('account'\)\)/);
  assert.match(flow, /ocrChatLine\('Valor', value\('amount'\)\)/);
  assert.match(flow, /ocrChatLine\('Descrição', value\('description'\)\)/);
  assert.match(flow, /ocrChatLine\('Categoria', value\('category'\)\)/);
  assert.match(flow, /escapeHTML\(text\)/, "texto sempre escapado");
  assert.match(flow, /previewUrl\(attachment\.id\)[\s\S]*ai-ocr-attach/,
    "anexo dentro do balão via previewUrl");
  assert.match(flow, /<button type="button" class="ai-ocr-review-btn" data-ocr-review>Revisar<\/button>/);
  assert.match(flow, /Não consegui reconhecer os dados deste anexo/,
    "leitura vazia cai no texto de fallback");
});

test("transferência: detecção e template próprio no balão", () => {
  assert.match(js, /function ocrChatIsTransfer\(fields\)/);
  const detect = sliceBetween("function ocrChatIsTransfer", "function ocrChatBubblesParts");
  assert.match(detect, /transfer\[eê\]ncia|pix enviado/, "usa os sinais do extrator");
  const flow = bubbles();
  assert.match(flow, /'Transferência universal'/, "cabeçalho do template de transferência");
  assert.match(flow, /ocrChatLine\('Origem'/);
  assert.match(flow, /ocrChatLine\('Destino'/);
  assert.match(flow, /isIn \? account : null/, "conta lida vira destino em entrada");
});

test("clique em Revisar abre o modal certo pelo handler do chat", () => {
  const handler = clickHandler();
  const reviewIdx = handler.indexOf("[data-ocr-review]");
  const userGuardIdx = handler.indexOf(".ai-chat-msg.is-user[data-msg-index]");
  assert.ok(reviewIdx !== -1, "handler deve tratar [data-ocr-review]");
  assert.ok(userGuardIdx !== -1, "guard de mensagens do usuário deve existir");
  assert.ok(reviewIdx < userGuardIdx,
    "o dispatch de Revisar deve vir ANTES do guard .is-user (balão é do assistente)");
  assert.match(handler, /ocrChatIsTransfer\(ocrState\.model\.fields\)/,
    "rota por detecção de transferência");
  assert.match(handler, /banks\.length \+ pockets\.length \+ investments\.length >= 2/,
    "espelha o guarda de dois destinos do botão manual");
  assert.match(handler, /ocrPrefillTransferForm\(\);/, "transferência é pré-preenchida");
  assert.match(handler, /ocrState\.openedTransfer = true;/, "marca o abertura pelo balão");
  assert.match(handler, /openModal\('panelTransferencia'\);/,
    "transferência abre a Transferência universal");
  assert.match(handler, /ocrRenderReview\(\);/, "convencional renderiza o modal");
  assert.match(handler, /openModal\('panelOcrReview'\);/, "convencional abre a revisão");
});

test("pré-preenchimento usa matchTransferReceiptTarget com guarda de colisão", () => {
  const flow = prefill();
  assert.match(flow, /getElementById\('tData'\)/);
  assert.match(flow, /setMoneyInput\('tValor'/);
  assert.match(flow, /getElementById\('tDesc'\)/);
  assert.match(flow, /matchTransferReceiptTarget\(accountName\)/, "reutiliza o matcher existente");
  assert.match(flow, /other\.value !== matchedBank/,
    "não preenche quando origem === destino");
  assert.match(flow, /other\.value !== matchedBank[\s\S]{0,120}?side\.value = matchedBank;/,
    "preenche só o lado livre");
});

test("pipeline não abre modal sozinho — só via clique", () => {
  const flow = pipeline();
  assert.doesNotMatch(flow, /openModal\('panelOcrReview'\)/,
    "ocrRunPipeline não deve abrir o modal automaticamente");
  assert.doesNotMatch(flow, /openModal\('panelTransferencia'\)/,
    "nem o de transferência");
  assert.doesNotMatch(flow, /ocrRenderReview\(\)/,
    "render do modal fica para o clique");
  assert.match(flow, /aiChatRender\(\);/, "sucesso repinta o chat com o balão");
  const total = js.split("openModal('panelOcrReview')").length - 1;
  assert.equal(total, 1, "openModal('panelOcrReview') deve existir exatamente 1x (no handler)");
});

test("ocrReleaseAll some com o balão e zera o flag de transferência", () => {
  const flow = releaseAll();
  assert.match(flow, /aiChatRender\(\);/,
    "liberar o estado (confirmar/cancelar/fechar/remover) deve repintar sem balão");
  assert.match(flow, /ocrState\.openedTransfer = false;/,
    "o flag de transferência é zerado junto");
});

test("fechar a Transferência aberta pelo balão encerra o estado", () => {
  const flow = wireUp();
  assert.match(flow, /getElementById\('panelTransferencia'\)/, "observa o painel");
  assert.match(flow, /wasOpen && !open && ocrState\.openedTransfer/,
    "só libera quando o painel veio do balão");
  assert.match(flow, /ocrReleaseAll\(\);/, "fechamento libera o estado");
});

test("styles.css tem os estilos do balão, do anexo e do botão", () => {
  assert.match(css, /\.ai-chat-msg\.is-ocr-summary\{/);
  assert.match(css, /\.ai-ocr-text\{/);
  assert.match(css, /\.ai-ocr-attach\{/);
  assert.match(css, /\.ai-ocr-review-btn\{/);
  assert.doesNotMatch(css, /\.ai-ocr-line\{/, "classes antigas removidas");
  assert.doesNotMatch(css, /\.is-ocr-cta\{/, "classes antigas removidas");
});
