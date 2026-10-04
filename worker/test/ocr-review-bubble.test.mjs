/* Testes de frontend do comprovante no chat da LIA (estilo Itaú/WhatsApp).
   Execução: node --test worker/test/*.test.mjs

   Sem DOM: confere por leitura dos arquivos a fiação do fluxo —
   leitura do anexo OU texto digitado → UM cartão-comprovante no chat
   (status + anexo + valor + linhas "Rótulo: valor") → Confirmar/
   Editar/Descartar na conversa → comprovante final ✅, com a
   transferência indo para a Transferência universal pré-preenchida. */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const js = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "style", "styles.css"), "utf8");

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
const state = () =>
  sliceBetween("const chatProposal = {", "const OCR_FIELD_ORDER");
const builders = () =>
  sliceBetween("function chatProposalFromOcr()", "function ocrPrefillTransferForm");
const confirmFn = () =>
  sliceBetween("async function chatProposalConfirm()", "function chatProposalEdit()");
const editFn = () =>
  sliceBetween("function chatProposalEdit()", "function chatProposalFillManualForm()");
const transferSaved = () =>
  sliceBetween("document.getElementById('tSalvar').onclick", "let pastePreviewInProgress");
const sendFn = () =>
  sliceBetween("const localCompoundReply = buildCompoundInterestReply", "function updateInvestmentMainValue");
const prefill = () =>
  sliceBetween("function ocrPrefillTransferForm", "render preview */");
const wireUp = () =>
  sliceBetween("(function ocrWireUp()", "function updateInvestmentMainValue");

test("aiChatRender injeta o comprovante derivado de chatProposal", () => {
  assert.match(js, /parts\.push\(\.\.\.chatProposalParts\(\)\);/,
    "render deve empurrar o comprovante antes do bloco pending");
  assert.match(js, /function chatProposalParts\(\)/);
  assert.match(js, /if \(!chatProposal\.status\) return \[\];/,
    "comprovante só existe com proposta pendente/confirmada");
});

test("estado da proposta vive fora do session e tem ciclo completo", () => {
  const flow = state();
  assert.match(flow, /source: null, status: null, kind: null/,
    "snapshot próprio (fora do session e do contexto de IA)");
  assert.match(flow, /function chatProposalClear\(\)/, "limpeza explícita");
  assert.match(flow, /window\.addEventListener\('lc-transfer-saved'/,
    "escuta a transferência salva pelo painel");
  assert.match(flow, /chatProposal\.kind === 'transfer'/,
    "só age quando há proposta de transferência pendente");
  assert.match(flow, /chatProposal\.status = 'confirmed';/, "confirma no evento");
  assert.match(flow, /window\.LivroCaixaChat\?\./, "reabre o chat com o comprovante");
});

test("UM cartão-comprovante com status, valor, linhas e ações", () => {
  const flow = builders();
  const singleBubble = (js.split('<div class="ai-chat-msg is-assistant is-ocr-summary">').length - 1);
  assert.equal(singleBubble, 1, "o builder deve produzir exatamente UM cartão");
  assert.match(flow, /✅ Dados reconhecidos — confirme para lançar/,
    "status de proposta pendente");
  assert.match(flow, /✅ Movimento lançado com sucesso/, "comprovante final movimento");
  assert.match(flow, /✅ Transferência registrada com sucesso/, "comprovante final transferência");
  assert.match(flow, /'Informações reconhecidas'/, "título convencional");
  assert.match(flow, /'Transferência universal'/, "título de transferência");
  assert.match(flow, /MONEY_FORMATTER\.format\(chatProposal\.amount\)/, "valor grande formatado");
  assert.match(flow, /ai-ocr-label/, "linhas Rótulo");
  assert.match(flow, /ai-ocr-value/, "linhas valor");
  assert.match(flow, /escapeHTML\(/, "tudo escapado");
  assert.match(flow, /previewUrl\(chatProposal\.attachmentId\)[\s\S]*ai-ocr-attach/,
    "anexo dentro do cartão via previewUrl");
  assert.match(flow, /data-chat-confirm/, "ação Confirmar");
  assert.match(flow, /data-chat-edit/, "ação Editar");
  assert.match(flow, /data-chat-discard/, "ação Descartar");
  assert.match(flow, /Confirmando…/, "estado de salvamento no botão");
  assert.match(flow, /Não consegui reconhecer os dados/,
    "leitura vazia cai no texto de fallback");
  assert.doesNotMatch(flow, /data-ocr-review/, "botão Revisar antigo removido");
});

test("origem anexo: snapshot no pipeline; origem texto: snapshot local", () => {
  const flow = builders();
  assert.match(flow, /function chatProposalFromOcr\(\)/);
  assert.match(flow, /chatProposal\.source = 'ocr';/);
  assert.match(flow, /ocrChatIsTransfer\(fields, ocrState\.sameHolder\)/,
    "detecta transferência da leitura (keywords + mesmo titular De/Para)");
  assert.match(flow, /isIn \? null : account/, "conta lida vira origem em saída");
  assert.match(flow, /isIn \? account : null/, "conta lida vira destino em entrada");
  assert.match(flow, /function chatProposalFromText\(parsed\)/);
  assert.match(flow, /chatProposal\.source = 'text';/);
  const pipe = pipeline();
  assert.match(pipe, /chatProposalFromOcr\(\);/,
    "pipeline cria a proposta antes de repintar");
  assert.match(pipe, /detectSameHolder\(read\.text/,
    "pipeline calcula o mesmo titular a partir do texto lido");
  assert.match(pipe, /aiChatRender\(\);/, "sucesso repinta o chat com o cartão");
});

test("clique nas ações dispara ANTES do guard de mensagens do usuário", () => {
  const handler = clickHandler();
  const actionIdx = handler.indexOf("[data-chat-confirm]");
  const userGuardIdx = handler.indexOf(".ai-chat-msg.is-user[data-msg-index]");
  assert.ok(actionIdx !== -1, "handler deve tratar as ações da proposta");
  assert.ok(userGuardIdx !== -1, "guard de mensagens do usuário deve existir");
  assert.ok(actionIdx < userGuardIdx,
    "o dispatch deve vir ANTES do guard .is-user (cartão é do assistente)");
  assert.match(handler, /chatProposalConfirm\(\)/);
  assert.match(handler, /chatProposalEdit\(\)/);
  assert.match(handler, /chatProposalDiscard\(\)/);
});

test("Confirmar valida e grava pelo fluxo existente de criação", () => {
  const flow = confirmFn();
  assert.match(flow, /chatProposal\.saving = true;/, "trava o botão durante o salvamento");
  assert.match(flow, /LivroCaixaReview\.validate\(model, { bankOptions, categoryOptions }\)/,
    "OCR passa pela validação final do modelo");
  assert.match(flow, /chatProposal\.error = 'Alguns dados precisam de ajuste/,
    "erro da proposta quando a validação falha");
  assert.match(flow, /ocrFillLaunchForm\(/, "preenche o formulário pelo caminho existente");
  assert.match(flow, /await saveMovementFromForm\(\)/,
    "mesma persistência, mesmo saldo, mesmos eventos");
  assert.match(flow, /chatProposal\.status = 'confirmed';/, "vira comprovante final");
  assert.match(flow, /ocrReleaseAll\(\);/, "libera o anexo/modelo");
  assert.match(flow, /window\.LivroCaixaChat\?\./, "reabre o chat com o comprovante");
  assert.match(flow, /finally \{[\s\S]*chatProposal\.saving = false;/, "solta o bloqueio");
});

test("Confirmar de transferência vai para a Transferência universal", () => {
  const flow = confirmFn();
  assert.match(flow, /chatProposal\.kind === 'transfer'/, "ramo de transferência");
  assert.match(flow, /banks\.length \+ pockets\.length \+ investments\.length >= 2/,
    "espelha o guarda de dois destinos do botão manual");
  assert.match(flow, /chatProposalEdit\(\);/, "sem dois destinos cai na revisão");
  assert.match(flow, /ocrState\.openedTransfer = true;/, "marca a abertura pelo chat");
  assert.match(flow, /openModal\('panelTransferencia'\);/, "abre a Transferência universal");
  const transferBranch = flow.slice(
    flow.indexOf("if (chatProposal.kind === 'transfer')"),
    flow.indexOf("chatProposal.saving = true;")
  );
  assert.ok(transferBranch.length > 0, "o ramo de transferência existe e é restrito");
  assert.doesNotMatch(transferBranch, /saveMovementFromForm/,
    "transferência NÃO salva por aqui (vai para o painel)");
});

test("tSalvar dispara lc-transfer-saved no mesmo task do closeAllPanels", () => {
  const flow = transferSaved();
  const closeIdx = flow.indexOf("closeAllPanels();");
  const dispatchIdx = flow.indexOf("window.dispatchEvent(new Event('lc-transfer-saved'));");
  assert.ok(closeIdx !== -1, "sucesso fecha os painéis");
  assert.ok(dispatchIdx !== -1, "sucesso dispara o evento do comprovante");
  assert.ok(closeIdx < dispatchIdx, "dispatch DEPOIS do closeAllPanels (mesmo task)");
  const total = js.split("window.dispatchEvent(new Event('lc-transfer-saved'));").length - 1;
  assert.equal(total, 1, "o evento deve ser disparado exatamente 1x");
});

test("Editar abre o mesmo modal de sempre para cada origem", () => {
  const flow = editFn();
  assert.match(flow, /ocrPrefillTransferForm\(\);/, "transferência é pré-preenchida");
  assert.match(flow, /ocrState\.openedTransfer = true;/, "marca a abertura pelo chat");
  assert.match(flow, /openModal\('panelTransferencia'\);/,
    "transferência abre a Transferência universal");
  assert.match(flow, /ocrRenderReview\(\);/, "convencional renderiza a revisão");
  assert.match(flow, /openModal\('panelOcrReview'\);/, "convencional abre a revisão");
  assert.match(flow, /chatProposalFillManualForm\(\);/, "texto (ou modelo ausente) vai ao formulário");
  const fill = sliceBetween("function chatProposalFillManualForm()", "function chatProposalDiscard()");
  assert.match(fill, /openNewEntryModal\(\);/, "abre o formulário comum");
  assert.match(fill, /setMoneyInput\('fValor'/, "preenche o valor do snapshot");
  assert.match(fill, /tglIn|tglOut/, "ajusta o tipo (entrada/saída)");
});

test("Descartar limpa a proposta; releaseAll preserva confirmado", () => {
  const discard = sliceBetween("function chatProposalDiscard()", "function ocrPrefillTransferForm");
  assert.match(discard, /chatProposalClear\(\);/, "limpa o snapshot");
  assert.match(discard, /ocrReleaseAll\(\);/, "origem anexo libera o anexo junto");
  const flow = releaseAll();
  assert.match(flow, /if \(chatProposal\.status !== 'confirmed'\) chatProposalClear\(\);/,
    "comprovante confirmado vira histórico; pendente é descartado");
  assert.match(flow, /aiChatRender\(\);/, "liberar o estado repinta o chat");
  assert.match(flow, /ocrState\.openedTransfer = false;/,
    "o flag de transferência é zerado junto");
  assert.match(flow, /ocrState\.sameHolder = null;/,
    "o sinal de mesmo titular é zerado junto (não vaza para o próximo anexo)");
});

test("pipeline não abre modal sozinho — só via Editar", () => {
  const flow = pipeline();
  assert.doesNotMatch(flow, /openModal\('panelOcrReview'\)/,
    "ocrRunPipeline não deve abrir o modal automaticamente");
  assert.doesNotMatch(flow, /openModal\('panelTransferencia'\)/,
    "nem o de transferência");
  assert.doesNotMatch(flow, /ocrRenderReview\(\)/,
    "render do modal fica para o clique");
  const total = js.split("openModal('panelOcrReview')").length - 1;
  assert.equal(total, 1, "openModal('panelOcrReview') deve existir exatamente 1x (no Editar)");
});

test("texto digitado: parser local com ack da conversa, sem IA", () => {
  const flow = sendFn();
  assert.match(flow, /parseMovementFromText\(originalText\)/, "tenta o parser local");
  assert.match(flow, /!editing && !ocrState\.attachment/, "só fora de edição e sem anexo");
  assert.match(flow, /chatProposalFromText\(parsedMovement\)/, "monta o comprovante");
  assert.match(flow, /Ok — identifiquei a movimentação\. Confira o comprovante abaixo e toque em Confirmar para lançar\./,
    "ack real como reply (nada de balão vazio)");
  assert.match(flow, /aiChat\.session\.commit\(token, originalText,/,
    "usa o contrato begin/commit/settle existente");
  assert.match(flow, /logInfo\('Análise', 'LIA · movimentação por texto'/,
    "diagnóstico sem dado sensível");
  assert.match(js, /function parseMovementFromText\(rawText\)/, "parser definido");
  assert.match(js, /suggestCategoryForDescription\(desc\)/, "fallback de categoria pelo histórico");
  assert.match(js, /bank: banks\[0\]\.id/, "banco = primeiro cadastrado");
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

test("fechar a Transferência aberta pelo chat encerra o estado", () => {
  const flow = wireUp();
  assert.match(flow, /getElementById\('panelTransferencia'\)/, "observa o painel");
  assert.match(flow, /wasOpen && !open && ocrState\.openedTransfer/,
    "só libera quando o painel veio do chat");
  assert.match(flow, /ocrReleaseAll\(\);/, "fechamento libera o estado");
});

test("styles.css tem os estilos do comprovante e remove os antigos", () => {
  assert.match(css, /\.ai-chat-msg\.is-ocr-summary\{/);
  assert.match(css, /\.ai-ocr-status\{/);
  assert.match(css, /\.ai-ocr-attach\{/);
  assert.match(css, /\.ai-ocr-amount\{/);
  assert.match(css, /\.ai-ocr-section-title\{/);
  assert.match(css, /\.ai-ocr-rows\{/);
  assert.match(css, /\.ai-ocr-error\{/);
  assert.match(css, /\.ai-ocr-confirm-btn\{/);
  assert.match(css, /\.ai-ocr-secondary-btn\{/);
  assert.doesNotMatch(css, /\.ai-ocr-review-btn\{/, "botão Revisar antigo removido");
  assert.doesNotMatch(css, /\.ai-ocr-text\{/, "balão de texto antigo removido");
  assert.doesNotMatch(css, /\.ai-ocr-line\{/, "classes antigas removidas");
  assert.doesNotMatch(css, /\.is-ocr-cta\{/, "classes antigas removidas");
});
