/* LIVRO-CAIXA · js/23-ai-chat.js — chat da LIA (app.js: 7327-8260). Separação por responsabilidade; conteúdo preservado. */


  /* =====================================================================
     CHAT IA (V.20-02) — modal aberto pelo FAB da Visão Geral.

     - contrato/limites: window.LivroCaixaChatContract (fonte única);
     - snapshot: buildGeminiFinancialSnapshot() + orçamento de 64 KB;
     - envio: window.LivroCaixaAI.chat() → POST /ai (sem chave local);
     - contexto: EM MEMÓRIA, atrelado à conta ativa. Nada em Firebase,
       localStorage ou sessionStorage nesta versão.
     ===================================================================== */

  let AI_CHAT_GREETING;


  /* Máquina de estados da conversa: fonte única em ai-chat-contract.js
     (testável sem DOM). Sem contrato o chat já não envia — aqui degradamos
     para um núcleo inerte só para abrir/fechar sem lançar. */
  function createAiChatSession() {
    const contract = window.LivroCaixaChatContract;
    const persistence = window.LivroCaixaChatPersistence;
    if (contract && typeof contract.createChatSession === 'function') {
      return contract.createChatSession(persistence || {});
    }
    return {
      isOpen: () => false,
      isBusy: () => false,
      getAccountId: () => null,
      getSessionId: () => 0,
      getMessages: () => [],
      getPending: () => null,
      openFor() {},
      close() {},
      resetContext() {},
      begin: () => ({ ok: false, token: null }),
      isCurrent: () => false,
      commit: () => false,
      settle: () => false,
      truncateFrom: async () => false
    };
  }

  let aiChat;


  function aiChatContract() {
    return window.LivroCaixaChatContract || null;
  }

  function aiChatAccountId() {
    try { return currentUser?.uid || null; } catch (err) { return null; }
  }

  function aiChatNotice(text, kind) {
    const el = document.getElementById('aiChatNotice');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-error');
      return;
    }
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('is-error', kind === 'error');
  }

  function aiChatScrollToEnd() {
    const box = document.getElementById('aiChatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function aiChatSetBusy(busy) {
    const send = document.getElementById('btnAiChatSend');
    const box = document.getElementById('aiChatMessages');
    if (send) {
      send.disabled = Boolean(busy);
      send.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (box) box.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  /* O prompt proíbe markdown, mas o modelo ainda pode escapar **negrito**
     ou `código`: remove só os marcadores (pós-escape, sem inserir HTML)
     para a conversa nunca exibir asterisco ou crase cru. */
  function aiChatStripEmphasis(text) {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  }

  function aiChatRender() {
    const box = document.getElementById('aiChatMessages');
    if (!box) return;

    const messages = aiChat.session.getMessages();
    const pending = aiChat.session.getPending();

    const parts = [];
    if (!messages.length && !pending) {
      parts.push(`<div class="ai-chat-msg is-placeholder">${escapeHTML(AI_CHAT_GREETING)}</div>`);

      /* V.20-01 — sugestões rápidas dinâmicas (exatamente 3). */
      const suggestions = aiChat.session.getQuickSuggestions();
      if (suggestions.length > 0) {
        parts.push('<div class="ai-quick-suggestions" role="list" aria-label="Sugestões rápidas">');
        suggestions.forEach((text, idx) => {
          const safe = escapeHTML(text);
          parts.push(
            `<button type="button" class="ai-quick-suggestion" role="listitem" ` +
            `aria-label="Perguntar: ${safe}" ` +
            `aria-posinset="${idx + 1}" aria-setsize="${suggestions.length}" ` +
            `data-suggestion="${safe}">${safe}</button>`
          );
        });
        parts.push('</div>');
      }
    }
    messages.forEach((item, index) => {
      if (item.role !== 'user') {
        const body = aiChatStripEmphasis(escapeHTML(item.content));
        parts.push(`<div class="ai-chat-msg is-assistant">${body}</div>`);
        return;
      }
      const body = escapeHTML(item.content);
      parts.push(
        `<div class="ai-chat-msg is-user" data-msg-index="${index}" tabindex="0">` +
        `<span class="ai-chat-msg-text">${body}</span>` +
        `<span class="ai-chat-msg-actions" hidden>` +
        `<button type="button" class="ai-chat-action" data-chat-action="copy">Copiar</button>` +
        `<button type="button" class="ai-chat-action" data-chat-action="edit">Editar</button>` +
        `<span class="ai-chat-action-status" aria-live="polite"></span>` +
        `</span>` +
        `</div>`
      );
    });

    /* V.20-01 — comprovante da proposta no chat: derivado de
       chatProposal (sem tocar no contrato do chat); some quando a
       proposta é descartada ou liberada. */
    parts.push(...chatProposalParts());

    if (pending) {
      parts.push(`<div class="ai-chat-msg is-user is-pending">${escapeHTML(pending.content)}</div>`);
      parts.push('<div class="ai-chat-msg is-assistant is-pending">Pensando…</div>');
    }

    box.innerHTML = parts.join('');
    aiChatScrollToEnd();

    /* Listeners das sugestões (delegação no container). */
    box.querySelectorAll('.ai-quick-suggestion').forEach((btn) => {
      btn.addEventListener('click', onQuickSuggestionClick);
    });
  }

  function onQuickSuggestionClick(event) {
    const btn = event.currentTarget;
    const suggestion = btn.getAttribute('data-suggestion');
    if (!suggestion) return;

    aiChatCancelEdit();

    const input = document.getElementById('aiChatInput');
    if (!input) return;

    input.value = suggestion;
    input.focus({ preventScroll: true });

    /* Dispara o envio usando o fluxo padrão (submit do form). */
    const form = document.getElementById('aiChatForm');
    if (form) {
      const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(submitEvent);
    }
  }

  /* ------------------- ações na mensagem do usuário ------------------------ */

  function closeAiChatActions() {
    document.querySelectorAll('#aiChatMessages .ai-chat-msg-actions').forEach((el) => { el.hidden = true; });
    document.querySelectorAll('#aiChatMessages .is-actions-open').forEach((el) => el.classList.remove('is-actions-open'));
  }

  function toggleAiChatActions(bubble) {
    const actions = bubble.querySelector('.ai-chat-msg-actions');
    if (!actions) return;
    const wasOpen = bubble.classList.contains('is-actions-open');
    closeAiChatActions();
    if (!wasOpen) {
      actions.hidden = false;
      bubble.classList.add('is-actions-open');
    }
  }

  async function aiChatCopyMessage(index, bubble) {
    const item = aiChat.session.getMessages()[index];
    if (!item || item.role !== 'user') return;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.content);
        copied = true;
      }
    } catch (err) { copied = false; }
    if (!copied) {
      try {
        const area = document.createElement('textarea');
        area.value = item.content;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        area.remove();
      } catch (err) { copied = false; }
    }

    const status = bubble.querySelector('.ai-chat-action-status');
    if (status) {
      status.textContent = copied ? 'Copiado!' : 'Não foi possível copiar.';
      window.setTimeout(() => { if (status.isConnected) status.textContent = ''; }, 1600);
    }
  }

  function aiChatStartEdit(index) {
    if (aiChat.session.isBusy()) {
      aiChatNotice('Aguarde a resposta atual antes de editar uma pergunta.', 'error');
      return;
    }
    const item = aiChat.session.getMessages()[index];
    if (!item || item.role !== 'user') return;

    aiChat.editing = { index };
    const input = document.getElementById('aiChatInput');
    if (input) {
      input.value = item.content;
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (err) { /* input sem seleção */ }
    }
    aiChatNotice('Editando sua pergunta: ajuste e envie para reenviar — as respostas a partir dela serão atualizadas. Esc cancela.');
  }

  function aiChatCancelEdit() {
    if (!aiChat.editing) return;
    if (aiChat.session.isBusy()) return;
    aiChat.editing = null;
    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';
    aiChatNotice('');
  }

  function onAiChatMessagesClick(event) {
    /* Ações do comprovante no chat (Confirmar/Editar/Descartar) — antes
       do guard de mensagens do usuário: o balão é do assistente e não
       tem data-msg-index. */
    const proposalAction = event.target.closest?.('[data-chat-confirm],[data-chat-edit],[data-chat-discard]');
    if (proposalAction) {
      if (proposalAction.hasAttribute('data-chat-confirm')) chatProposalConfirm();
      else if (proposalAction.hasAttribute('data-chat-edit')) chatProposalEdit();
      else chatProposalDiscard();
      return;
    }

    const bubble = event.target.closest?.('.ai-chat-msg.is-user[data-msg-index]');
    if (!bubble) {
      closeAiChatActions();
      return;
    }

    const action = event.target.closest?.('[data-chat-action]');
    if (action) {
      const index = Number(bubble.dataset.msgIndex);
      if (action.dataset.chatAction === 'copy') {
        aiChatCopyMessage(index, bubble);
        return;
      }
      if (action.dataset.chatAction === 'edit') {
        aiChatStartEdit(index);
        closeAiChatActions();
      }
      return;
    }

    if (event.target.closest('.ai-chat-msg-actions')) return;
    toggleAiChatActions(bubble);
  }

  let AI_CHAT_ERROR_MESSAGES;


  function aiChatErrorMessage(err) {
    const code = String(err?.code || '');
    if (AI_CHAT_ERROR_MESSAGES[code]) return AI_CHAT_ERROR_MESSAGES[code];
    if (/^http_429$/.test(code)) return AI_CHAT_ERROR_MESSAGES.rate_limited;
    const message = String(err?.message || '').trim();
    return message || 'Não foi possível enviar a pergunta. Tente novamente.';
  }

  /* Monta e valida o payload ANTES de qualquer requisição. Repete a mesma
     validação que o Worker fará (validateChatPayload) para falhar cedo e
     com mensagem útil — o Worker continua sendo a garantia real.

     historyIndex — edição estilo ChatGPT: o contexto considera só as
     mensagens anteriores à pergunta editada (o resto será descartado
     no reenvio). */
  function aiChatPrepare(text, historyIndex) {
    const contract = aiChatContract();
    if (!contract) return { ok: false, code: 'contract_unavailable' };

    const message = contract.validateChatMessage(text);
    if (!message.ok) return { ok: false, code: message.body.code, error: message.body.error };

    const rawSnapshot = buildGeminiFinancialSnapshot();
    if (!contract.snapshotHasData(rawSnapshot)) return { ok: false, code: 'no_data' };

    const fitted = contract.fitChatSnapshotToBudget(rawSnapshot);
    if (!fitted.ok) return { ok: false, code: fitted.reason };

    const history = aiChat.session.getMessages();
    const source = Number.isInteger(historyIndex) && historyIndex >= 0 && historyIndex <= history.length
      ? history.slice(0, historyIndex)
      : history;
    const context = contract.normalizeConversationContext(source);
    const payload = {
      message: message.value,
      financialSnapshot: fitted.snapshot,
      conversationContext: context
    };

    const check = contract.validateChatPayload(payload);
    if (!check.ok) return { ok: false, code: check.body.code, error: check.body.error };

    return { ok: true, payload: check.value, dropped: fitted.dropped || [] };
  }

  async function aiChatSend(rawText) {
    if (aiChat.session.isBusy()) return;

    const originalText = String(rawText ?? '');

    /* Edição estilo ChatGPT: o índice capturado aqui vale pelo envio
       inteiro; a validação garante que truncateFrom não falhará. */
    const editing = aiChat.editing ? { ...aiChat.editing } : null;
    if (editing) {
      const target = aiChat.session.getMessages()[editing.index];
      if (!target || target.role !== 'user') {
        aiChat.editing = null;
        aiChatNotice('Não foi possível editar essa mensagem — a conversa mudou. Ajuste o texto e envie como nova pergunta.', 'error');
        return;
      }
    }

    const localCompoundReply = buildCompoundInterestReply(originalText);
    if (localCompoundReply) {
      const started = aiChat.session.begin(originalText);
      if (started.ok) {
        const token = started.token;
        if (editing) {
          const truncated = await aiChat.session.truncateFrom(editing.index);
          if (!truncated) {
            aiChat.session.settle(token);
            aiChatNotice('Não foi possível atualizar a conversa. Tente editar novamente.', 'error');
            return;
          }
          aiChat.editing = null;
        }
        const input = document.getElementById('aiChatInput');
        if (input) input.value = '';
        aiChat.session.commit(token, originalText, localCompoundReply);
        aiChat.session.settle(token);
        aiChatNotice('');
        if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
        logInfo('Análise', 'LIA · cálculo local de juros compostos', 'Sucesso', 'Resposta calculada localmente sem chamada de IA.');
        return;
      }
    }

    /* Movimentação por texto digitado: casa localmente (sem chamada de
       IA) e monta o comprovante na conversa para confirmação. Não casa
       em edição nem com anexo pendente; se não entender, o texto segue
       normalmente para a IA. */
    const parsedMovement = (!editing && !ocrState.attachment)
      ? parseMovementFromText(originalText)
      : null;
    if (parsedMovement) {
      const started = aiChat.session.begin(originalText);
      if (started.ok) {
        const token = started.token;
        const inputField = document.getElementById('aiChatInput');
        if (inputField) inputField.value = '';
        chatProposalFromText(parsedMovement);
        await aiChat.session.commit(token, originalText,
          'Ok — identifiquei a movimentação. Confira o comprovante abaixo e toque em Confirmar para lançar.');
        aiChat.session.settle(token);
        aiChatNotice('');
        if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
        logInfo('Análise', 'LIA · movimentação por texto', 'Sucesso', 'Comprovante criado localmente sem chamada de IA.');
        return;
      }
    }

    const prepared = aiChatPrepare(originalText, editing ? editing.index : null);

    if (!prepared.ok) {
      aiChatNotice(
        AI_CHAT_ERROR_MESSAGES[prepared.code] || prepared.error || 'Não foi possível enviar a pergunta.',
        'error'
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      aiChatNotice(AI_CHAT_ERROR_MESSAGES.offline, 'error');
      return;
    }

    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';

    const started = aiChat.session.begin(prepared.payload.message);
    if (!started.ok) return;
    const token = started.token;

    const controller = new AbortController();
    aiChat.controller = controller;
    aiChatNotice(prepared.dropped.length
      ? `Alguns detalhes foram omitidos do envio por tamanho (${prepared.dropped.join(', ')}).`
      : '');
    aiChatSetBusy(true);
    aiChatRender();

    const isCurrent = () =>
      aiChat.session.isCurrent(token) &&
      token.accountId === aiChatAccountId() &&
      !controller.signal.aborted;

    try {
      const reply = await window.LivroCaixaAI.chat({
        message: prepared.payload.message,
        financialSnapshot: prepared.payload.financialSnapshot,
        conversationContext: prepared.payload.conversationContext,
        signal: controller.signal
      });

      /* Guardas de sessão: conta, sessão do modal, cancelamento e
         pertencimento à pergunta enviada. Falhou alguma → descarta. */
      if (!isCurrent()) return;

      /* Edição: só descarta o trecho antigo quando a resposta chegou —
         falhou a IA, o histórico fica intacto e o rascunho é recuperado. */
      if (editing) {
        const truncated = await aiChat.session.truncateFrom(editing.index);
        if (!truncated) {
          aiChatNotice('Não foi possível atualizar a conversa. Edite a pergunta novamente.', 'error');
          const field = document.getElementById('aiChatInput');
          if (field && !field.value) field.value = originalText;
          return;
        }
        aiChat.editing = null;
      }

      aiChat.session.commit(token, prepared.payload.message, reply);
    } catch (err) {
      if (err?.code === 'aborted') return;
      if (!isCurrent()) return;

      aiChatNotice(aiChatErrorMessage(err), 'error');
      /* A pergunta volta ao campo para reenvio — sem duplicar no histórico. */
      const field = document.getElementById('aiChatInput');
      if (field && !field.value) field.value = originalText;
    } finally {
      aiChat.session.settle(token);
      aiChat.controller = null;
      aiChatSetBusy(false);
      if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
    }
  }

  function openAiChat() {
    /* Contexto pertence a uma conta: outro dono = conversa nova. */
    
    /* Garante que indicadores de mercado estejam disponíveis para a IA. */
    const refreshIndicatorsPromise = (typeof refreshFinancialIndicators === 'function')
      ? refreshFinancialIndicators({ silent: true })
      : Promise.resolve(null);

    const snapshot = buildGeminiFinancialSnapshot();
    const abertura = aiChat.session.openFor(aiChatAccountId(), snapshot);

    const contract = aiChatContract();
    const input = document.getElementById('aiChatInput');
    if (contract && input) input.maxLength = contract.CHAT_LIMITS.MESSAGE_MAX_CHARS;

    aiChat.opener = document.activeElement;

    /* Estado da página antes de abrir (restaurado no fechamento) e
       limpeza de qualquer deslocamento herdado — antes do openModal. */
    aiChat.pageScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };
    aiChatResetModalScroll();
    openModal('panelAiChat');
    aiChatNotice(contract ? '' : AI_CHAT_ERROR_MESSAGES.contract_unavailable, contract ? null : 'error');
    aiChatSetBusy(aiChat.session.isBusy());
    aiChatRender();
    if (abertura && typeof abertura.then === 'function') {
      abertura.then(() => {
        if (aiChat.session.isOpen()) aiChatRender();
      }).catch(() => {});
    }
    /* Foco em caixa overflow:hidden deixa overlay/painel deslocados de uma
       abertura anterior; limpa a página/camadas, mede contra a visual
       viewport e preserva a âncora do fim da conversa do aiChatRender(). */
    aiChatApplyViewportFix();
    window.renderAiQuotaStatus?.();
    renderAiIndicatorsStatus();
    window.LivroCaixaAI?.refreshQuota?.({ silent: true, throttleMs: 15000 });

    /* Aguarda indicadores (não bloqueia a UI, mas enriquece o snapshot se chegar a tempo). */
    refreshIndicatorsPromise.catch(() => { /* best-effort */ });

    window.setTimeout(() => input?.focus({ preventScroll: true }), 0);
  }

  function closeAiChat() {
    /* O contexto permanece em memória; só o envio em andamento é
       invalidado (close incrementa requestId no contrato). */
    aiChat.session.close();

    if (aiChat.controller) {
      try { aiChat.controller.abort(); } catch (err) { /* já encerrado */ }
      aiChat.controller = null;
    }

    aiChatSetBusy(false);

    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';
    aiChat.editing = null;

    const opener = aiChat.opener;
    aiChat.opener = null;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      try { opener.focus(); } catch (err) { /* elemento saiu do DOM */ }
    }

    /* Reset completo (página + camadas + caixa) para a próxima abertura
       não herdar deslocamento de teclado; em seguida devolve a página à
       posição de antes de abrir — no mobile era 0, no desktop não pula
       para o topo. */
    aiChatResetModalScroll();
    const closedPanel = document.getElementById('panelAiChat');
    if (closedPanel) {
      closedPanel.style.removeProperty('--ai-chat-vv-top');
      closedPanel.style.removeProperty('--ai-chat-vv-bottom');
    }
    const pageScroll = aiChat.pageScroll;
    aiChat.pageScroll = null;
    if (pageScroll && (pageScroll.x || pageScroll.y)) {
      try { window.scrollTo(pageScroll.x, pageScroll.y); } catch (err) { /* sem janela */ }
    }
  }

  /* Limpeza de contexto: troca de conta, logout, sessão reiniciada.
     Nunca persistida — só isto apaga a conversa nesta versão. */
  function resetAiChatContext() {
    const snapshot = buildGeminiFinancialSnapshot();
    aiChat.session.resetContext();
    aiChat.editing = null;

    if (aiChat.controller) {
      try { aiChat.controller.abort(); } catch (err) { /* já encerrado */ }
      aiChat.controller = null;
    }

    if (aiChat.session.isOpen()) {
      aiChat.session.openFor(aiChatAccountId(), snapshot);
      aiChatNotice('');
      aiChatSetBusy(false);
      aiChatRender();
    }
  }

  /* O navegador rola a PÁGINA (body/documentElement) e as caixas
     overflow:hidden para manter o input em foco com o teclado aberto — e
     o deslocamento permanece depois que o teclado fecha. Zera página,
     overlay, painel e, no ciclo de vida, a caixa de conversa.

     keepMessages — foco/blur/toque preservam a rolagem da conversa para a
     lista não pular para o topo enquanto o usuário digita. */
  function aiChatResetModalScroll(keepMessages) {
    try { window.scrollTo(0, 0); } catch (err) { /* sem janela */ }
    try {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    } catch (err) { /* sem DOM */ }

    const overlay = document.getElementById('modalOverlay');
    const panel = document.getElementById('panelAiChat');
    if (overlay) { overlay.scrollTop = 0; overlay.scrollLeft = 0; }
    if (panel) { panel.scrollTop = 0; panel.scrollLeft = 0; }

    const box = document.getElementById('aiChatMessages');
    if (box && !keepMessages) { box.scrollTop = 0; box.scrollLeft = 0; }

    /* Nenhum estilo inline existe hoje; limpa resíduo de transform/top/
       height para a próxima abertura nascer com layout limpo. */
    [overlay, panel].forEach((el) => {
      if (!el) return;
      if (el.style.transform) el.style.transform = '';
      if (el.style.top) el.style.top = '';
      if (el.style.height) el.style.height = '';
    });
  }

  /* 2ª rodada (mobile): em vez de só zerar scroll, o sheet é medido
     contra a VISUAL viewport e ancorado acima do teclado — encolhe lá
     em cima em vez de subir e cortar o cabeçalho. As medidas viram
     custom properties consumidas pelo CSS (#panelAiChat.open). */
  function aiChatFitVisualViewport() {
    const panel = document.getElementById('panelAiChat');
    if (!panel || !panel.classList.contains('open')) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const layoutH = document.documentElement.clientHeight || window.innerHeight || 0;
    /* Topo: o offset da viewport visual (barra do sistema) + 16px de folga.
       Base: o que sobra até o fim do layout (teclado em modo
       resizes-visual; ~0 em resizes-content, que encolhe o layout) + 16px.
       O overlay recebe esses valores como padding e o flex-center do
       overlay mantém o painel centralizado dentro da região visível. */
    const topGap = Math.max(16, Math.round(vv.offsetTop) + 16);
    const bottomGap = Math.max(16, layoutH - (vv.offsetTop + vv.height)) + 16;
    panel.style.setProperty('--ai-chat-vv-top', topGap + 'px');
    panel.style.setProperty('--ai-chat-vv-bottom', bottomGap + 'px');
  }

  function aiChatApplyViewportFix() {
    aiChatResetModalScroll(true);
    aiChatFitVisualViewport();
  }


  // V19-20: meses de projeção são salvos automaticamente ao sair do campo.
  let inputProjectionMonths;


  async function saveProjectionMonthsAutomatically() {
    if (!inputProjectionMonths) return;

    const value = Math.min(24, Math.max(1, Number(inputProjectionMonths.value) || 6));

    inputProjectionMonths.value = value;
    featureSettings = normalizeFeatureSettings({
      ...featureSettings,
      projectionMonths: value
    });

    // V19-20: garante persistência local mesmo sem login ou se a nuvem falhar.
    persistFeatureSettings();

    try {
      await persistProfileSettings();
      const status = document.getElementById('profileSettingsStatus') || document.getElementById('featureProfileStatus');
      if (status) status.textContent = 'Meses de projeção salvos automaticamente.';
    } catch (err) {
      const status = document.getElementById('profileSettingsStatus') || document.getElementById('featureProfileStatus');
      if (status) status.textContent = 'Projeção salva localmente; sincronização remota falhou.';
      logSyncError('meses de projeção', err);
    }
  }

  function addReconciliationToHistory(bankId, calculated, reported, difference, isMatch) {
    const bank = banks.find(b => b.id === bankId);
    if (!bank) return;

    const historyKey = 'reconciliationHistory';
    try {
      const stored = localStorage.getItem(historyKey);
      const history = stored ? JSON.parse(stored) : [];
      const entry = {
        bankId,
        bankName: bank.name,
        calculated,
        reported,
        difference,
        isMatch,
        timestamp: Date.now(),
        date: todayISO()
      };
      history.unshift(entry);
      if (history.length > 50) history.length = 50;
      localStorage.setItem(historyKey, JSON.stringify(history));
      renderReconciliationHistory();
    } catch (err) {
      logWarn('Conciliação', 'Salvar histórico', 'Falha', err.message);
    }
  }
