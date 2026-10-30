/* LIVRO-CAIXA · js/28-ocr-lia.js — anexos/OCR e propostas do chat (app.js: 11835-12653). Separação por responsabilidade; conteúdo preservado. */


  /* ==================================================================
     V.20-01 — ANEXOS DA LIA · LEITURA/OCR · REVISÃO OBRIGATÓRIA

     Pipeline transacional obrigatório (nenhuma etapa, isoladamente,
     cria movimentação):

       arquivo → validação → leitura/OCR → extração estruturada →
       normalização → interpretação pela LIA → preview → revisão e
       edição do usuário → confirmação explícita → validação final →
       fluxo EXISTENTE de criação (saveMovementFromForm)

     A LIA conversa apenas com globalThis.LivroCaixaOCR (contrato estável).
     Nenhum código aqui conhece Android, Capacitor ou plugin nativo.
     ================================================================== */

  let ocrState;


  /* Proposta de movimentação exibida no chat como comprovante (estilo
     Itaú/WhatsApp): nasce da leitura de anexo OU de texto digitado,
     aguarda confirmação na conversa e vira comprovante final. Snapshot
     próprio (linhas/valor prontos) — não entra no session do chat nem
     no contexto enviado à IA. */
  let chatProposal;


  function chatProposalClear() {
    chatProposal.source = null;
    chatProposal.status = null;
    chatProposal.kind = null;
    chatProposal.rows = [];
    chatProposal.amount = null;
    chatProposal.attachmentId = null;
    chatProposal.data = null;
    chatProposal.error = null;
    chatProposal.saving = false;
  }
  let OCR_FIELD_ORDER;

  /* Exibidos na revisão mas SEM campo equivalente no modelo de movimentação:
     são informações do documento, nunca persistidas. */
  let OCR_READ_ONLY_FIELDS;


  function ocrShowNotice(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ''; el.classList.remove('is-error'); return; }
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('is-error', kind === 'error');
  }
  let ocrAttachmentNotice;

  let ocrReviewNotice;


  function ocrSetFallback(visible) {
    const row = document.getElementById('liaAttachmentFallback');
    if (row) row.hidden = !visible;
  }

  function ocrFileErrorMessage(code) {
    const map = {
      TOO_LARGE: 'Arquivo maior que o limite permitido.',
      INVALID_FILE: 'Arquivo inválido ou vazio.',
      UNSUPPORTED_FILE: 'Formato não suportado. Use JPG, PNG, WEBP ou PDF.',
      DUPLICATE: 'Este anexo já está na fila de processamento.',
      LIMIT_REACHED: 'Limite de anexos por operação atingido.'
    };
    return map[code] || 'Não foi possível usar este arquivo.';
  }

  function ocrReadErrorMessage(status) {
    const map = {
      UNAVAILABLE: 'A leitura do anexo está indisponível no momento.',
      NOT_IMPLEMENTED: 'Este formato ainda não pode ser lido. Use uma imagem JPG, PNG ou WEBP.',
      TIMEOUT: 'O tempo máximo de leitura foi atingido.',
      CANCELLED: 'Leitura cancelada.',
      PERMISSION_DENIED: 'Permissão negada pelo dispositivo.',
      UNSUPPORTED_PLATFORM: 'Este ambiente não suporta a leitura de anexos.',
      TOO_LARGE: 'A imagem é grande demais para leitura (máx. 7 MB).',
      INVALID_FILE: 'O arquivo selecionado é inválido.',
      UNSUPPORTED_FILE: 'Formato não suportado.',
      DUPLICATE: 'Este anexo já foi processado.'
    };
    return map[status] || 'Não foi possível ler o anexo.';
  }

  function ocrDependenciesReady() {
    return !!(globalThis.LivroCaixaOCRLimits && globalThis.LivroCaixaOCRLog &&
      globalThis.LivroCaixaAttachments && globalThis.LivroCaixaExtract &&
      globalThis.LivroCaixaOCR && globalThis.LivroCaixaOCRLia && globalThis.LivroCaixaReview);
  }

  /* Libera Blob/File/ObjectURL e zera o estado — usado em conclusão,
     cancelamento, erro e fechamento do painel. Idempotente. */
  function ocrReleaseAll() {
    if (ocrState.controller) {
      try { ocrState.controller.abort(); } catch (err) { /* abort é best-effort */ }
      ocrState.controller = null;
    }
    if (ocrState.attachment) {
      try { globalThis.LivroCaixaAttachments.manager.release(ocrState.attachment.id); } catch (err) { /* best-effort */ }
      ocrState.attachment = null;
    } else {
      try { globalThis.LivroCaixaAttachments.manager.releaseAll(); } catch (err) { /* best-effort */ }
    }
    ocrState.model = null;
    ocrState.busy = false;
    ocrState.openedTransfer = false;
    ocrState.sameHolder = null;
    const input = document.getElementById('liaAttachmentFile');
    if (input) input.value = '';
    const chip = document.getElementById('liaAttachmentChip');
    if (chip) { chip.hidden = true; chip.textContent = ''; }
    const attachBtn = document.getElementById('btnLiaAttach');
    if (attachBtn) attachBtn.disabled = false;
    /* Comprovante confirmado fica no chat como histórico final; uma
       proposta pendente é descartada junto com o anexo. */
    if (chatProposal.status !== 'confirmed') chatProposalClear();
    aiChatRender();
  }

  function ocrHolderLabel() {
    try {
      const user = typeof currentUser !== 'undefined' ? currentUser : null;
      return (user && (user.displayName || user.email)) || 'não informado';
    } catch (err) {
      return 'não informado';
    }
  }

  function ocrRenderChip() {
    const chip = document.getElementById('liaAttachmentChip');
    if (!chip) return;
    const attachment = ocrState.attachment;
    if (!attachment) { chip.hidden = true; chip.textContent = ''; return; }
    const sizeMb = (attachment.size / (1024 * 1024)).toFixed(2);
    chip.hidden = false;
    chip.innerHTML =
      '<span class="ocr-chip-name">' + escapeHTML(attachment.name) + '</span>' +
      '<span class="ocr-chip-meta">' + sizeMb + ' MB</span>' +
      '<button type="button" class="ocr-chip-remove" aria-label="Remover anexo" title="Remover">×</button>';
    const remove = chip.querySelector('.ocr-chip-remove');
    if (remove) {
      remove.addEventListener('click', () => {
        ocrReleaseAll();
        ocrSetFallback(false);
        ocrAttachmentNotice('Anexo removido. Nada foi gravado.');
      });
    }
  }

  /* ------------------------------------------- balões da revisão no chat */
  function ocrChatDisplayValue(key, field) {
    const raw = field.value;
    if (raw == null || raw === '') return null;
    if (key === 'date') {
      const parts = String(raw).split('-');
      if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
      return String(raw);
    }
    if (key === 'amount') {
      const num = Number(raw);
      return Number.isFinite(num) ? MONEY_FORMATTER.format(num) : String(raw);
    }
    if (key === 'type') {
      if (raw === 'in') return 'Entrada';
      if (raw === 'out') return 'Saída';
      return String(raw);
    }
    return String(raw);
  }

  /* Sinais já usados pelo extrator (categoria/pagamento "Transferência",
     TED, DOC, "pix enviado"): quando a leitura indica transferência, o
     balão usa o modelo "Transferência universal" e o Revisar abre
     panelTransferencia em vez do modal de revisão convencional. */
  function ocrChatIsTransfer(fields, sameHolder) {
    if (sameHolder && sameHolder.sameHolder) return true;
    if (!fields) return false;
    const transferRe = /\btransfer|\bpix enviado\b|\bted\b|\bdoc\b/i;
    const strip = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const category = fields.category ? fields.category.value : null;
    /* suggestion: "Transferência" não resolvida no catálogo zera o value,
       mas a intenção do documento continua legível ali. */
    const categoryHint = category || (fields.category && fields.category.suggestion) || null;
    if (categoryHint && strip(categoryHint) === 'transferencia') return true;
    if (categoryHint && transferRe.test(String(categoryHint))) return true;
    const payment = fields.paymentMethod ? fields.paymentMethod.value : null;
    if (payment && /transfer/i.test(String(payment))) return true;
    const desc = (fields.description && fields.description.value) || '';
    const merchant = (fields.merchant && fields.merchant.value) || '';
    return transferRe.test(String(desc) + ' ' + String(merchant));
  }

  /* ---- proposta no chat: criação a partir da leitura de anexo ---- */
  function chatProposalFromOcr() {
    const model = ocrState && ocrState.model;
    chatProposalClear();
    if (!model) return;
    const fields = model.fields || {};
    const val = (key) => {
      const field = fields[key];
      return field && field.value != null && field.value !== '' ? ocrChatDisplayValue(key, field) : null;
    };
    const isTransfer = ocrChatIsTransfer(fields, ocrState.sameHolder);
    const account = val('account');
    const isIn = !!(fields.type && fields.type.value === 'in');
    const rows = [];
    const push = (label, value) => { if (value != null && value !== '') rows.push({ label, value: String(value) }); };
    push('Data', val('date'));
    if (isTransfer) {
      /* A leitura da LIA tem UMA conta: em entrada ela é o destino,
         nos demais casos a origem — o usuário ajusta no modal. */
      push('Origem', isIn ? null : account);
      push('Destino', isIn ? account : null);
    } else {
      push('Tipo', val('type'));
      push('Banco', account);
      push('Categoria', val('category'));
    }
    push('Descrição', val('description'));
    const amountRaw = fields.amount ? fields.amount.value : null;
    const amount = Number(amountRaw);
    chatProposal.source = 'ocr';
    chatProposal.status = 'awaiting';
    chatProposal.kind = isTransfer ? 'transfer' : 'movement';
    chatProposal.rows = rows;
    chatProposal.amount = Number.isFinite(amount) && amount > 0 ? amount : null;
    chatProposal.attachmentId = (ocrState.attachment && ocrState.attachment.id)
      || (model.attachment && model.attachment.id) || null;
  }

  /* ---- proposta no chat: criação a partir de texto digitado ---- */
  function chatProposalFromText(parsed) {
    chatProposalClear();
    if (!parsed) return;
    const bank = banks.find((b) => b.id === parsed.bank);
    const category = categories.find((c) => c.id === parsed.category);
    const rows = [
      { label: 'Data', value: parsed.date },
      { label: 'Tipo', value: parsed.type === 'in' ? 'Entrada' : 'Saída' }
    ];
    if (bank) rows.push({ label: 'Banco', value: bank.name });
    if (category) rows.push({ label: 'Categoria', value: category.name });
    rows.push({ label: 'Descrição', value: parsed.desc });
    chatProposal.source = 'text';
    chatProposal.status = 'awaiting';
    chatProposal.kind = 'movement';
    chatProposal.rows = rows;
    chatProposal.amount = parsed.amount;
    chatProposal.data = {
      date: parsed.date,
      desc: parsed.desc,
      bank: bank ? bank.id : '',
      category: category ? category.id : '',
      amount: parsed.amount,
      type: parsed.type
    };
  }

  /* UM cartão-comprovante no chat (estilo Itaú/WhatsApp): status +
     anexo + valor grande + linhas "Rótulo: valor" + Confirmar/Editar/
     Descartar; depois de confirmar vira o comprovante final ✅ e fica
     como histórico. Derivado de chatProposal (fora do session do chat
     e fora do contexto enviado à IA). */
  function chatProposalParts() {
    if (!chatProposal.status) return [];
    const title = chatProposal.kind === 'transfer' ? 'Transferência universal' : 'Informações reconhecidas';
    const statusHtml = chatProposal.status === 'confirmed'
      ? '<div class="ai-ocr-status">' + (chatProposal.kind === 'transfer'
        ? '✅ Transferência registrada com sucesso'
        : '✅ Movimento lançado com sucesso') + '</div>'
      : '<div class="ai-ocr-status">✅ Dados reconhecidos — confirme para lançar</div>';

    let imageHtml = '';
    if (chatProposal.source === 'ocr' && chatProposal.attachmentId) {
      try {
        const url = globalThis.LivroCaixaAttachments.manager.previewUrl(chatProposal.attachmentId);
        if (url) imageHtml = '<img class="ai-ocr-attach" src="' + url + '" alt="Anexo lido">';
      } catch (err) { /* pré-visualização é best-effort */ }
    }

    const amountHtml = chatProposal.amount != null && chatProposal.amount > 0
      ? '<div class="ai-ocr-amount">' + escapeHTML(MONEY_FORMATTER.format(chatProposal.amount)) + '</div>'
      : '';

    const rowsHtml = chatProposal.rows.length
      ? '<div class="ai-ocr-section-title">' + escapeHTML(title) + '</div>' +
        '<div class="ai-ocr-rows">' + chatProposal.rows.map((row) =>
          '<div class="ai-ocr-row"><span class="ai-ocr-label">' + escapeHTML(row.label) + '</span>' +
          '<span class="ai-ocr-value">' + escapeHTML(String(row.value)) + '</span></div>'
        ).join('') + '</div>'
      : '<div class="ai-ocr-error">Não consegui reconhecer os dados. Toque em Editar para preencher.</div>';

    const errorHtml = chatProposal.error
      ? '<div class="ai-ocr-error">' + escapeHTML(chatProposal.error) + '</div>'
      : '';

    let actionsHtml = '';
    if (chatProposal.status === 'awaiting') {
      if (chatProposal.amount != null && chatProposal.amount > 0) {
        actionsHtml += '<button type="button" class="ai-ocr-confirm-btn" data-chat-confirm' +
          (chatProposal.saving ? ' disabled' : '') + '>' +
          (chatProposal.saving ? 'Confirmando…' : 'Confirmar') + '</button>';
      }
      actionsHtml += '<button type="button" class="ai-ocr-secondary-btn" data-chat-edit>Editar</button>' +
        '<button type="button" class="ai-ocr-secondary-btn" data-chat-discard>Descartar</button>';
    }

    return [
      '<div class="ai-chat-msg is-assistant is-ocr-summary">' +
      statusHtml + imageHtml + amountHtml + rowsHtml + errorHtml + actionsHtml +
      '</div>'
    ];
  }

  /* Confirmar: valida e grava pelo fluxo EXISTENTE de criação (mesmas
     validações, mesmo saldo, mesma persistência). Movimentação salva
     aqui mesmo — transferência apenas abre a Transferência universal
     pré-preenchida (o salvamento acontece no tSalvar, que dispara
     lc-transfer-saved). */
  async function chatProposalConfirm() {
    if (chatProposal.status !== 'awaiting' || chatProposal.saving) return;
    chatProposal.error = null;

    if (chatProposal.kind === 'transfer') {
      const canTransfer = banks.length + pockets.length + investments.length >= 2;
      if (!canTransfer) { chatProposalEdit(); return; }
      if (ocrState.model) ocrPrefillTransferForm();
      ocrState.openedTransfer = true;
      openModal('panelTransferencia');
      return;
    }

    chatProposal.saving = true;
    aiChatRender();
    try {
      if (chatProposal.source === 'ocr') {
        const model = ocrState.model;
        if (!model) {
          chatProposal.error = 'A leitura não está mais disponível. Toque em Editar para preencher.';
          return;
        }
        const bankSelect = document.getElementById('fBanco');
        const categorySelect = document.getElementById('fCategoria');
        const bankOptions = bankSelect ? Array.from(bankSelect.options).map((o) => o.value) : [];
        const categoryOptions = categorySelect ? Array.from(categorySelect.options).map((o) => o.value) : [];
        const result = globalThis.LivroCaixaReview.validate(model, { bankOptions, categoryOptions });
        if (!result.ok) {
          chatProposal.error = 'Alguns dados precisam de ajuste. Toque em Editar para revisar.';
          return;
        }
        ocrFillLaunchForm(result.value);
      } else {
        const d = chatProposal.data;
        if (!d || !(d.amount > 0) || !String(d.desc || '').trim() || !banks.some((b) => b.id === d.bank)) {
          chatProposal.error = 'Alguns dados precisam de ajuste. Toque em Editar para revisar.';
          return;
        }
        ocrFillLaunchForm(d);
      }
      const saved = await saveMovementFromForm();
      if (saved) {
        chatProposal.status = 'confirmed';
        chatProposal.error = null;
        ocrReleaseAll();
        window.LivroCaixaChat?.open?.();
      } else {
        chatProposal.error = 'O lançamento não foi concluído. Revise e tente novamente.';
      }
    } catch (err) {
      chatProposal.error = 'Falha inesperada ao confirmar. Nada foi gravado duas vezes.';
    } finally {
      chatProposal.saving = false;
      aiChatRender();
    }
  }

  /* Editar: leva ao MESMO modal de sempre — revisão da leitura (ou
     Transferência universal) para origem anexo; formulário comum já
     preenchido para origem texto. */
  function chatProposalEdit() {
    if (chatProposal.status !== 'awaiting') return;
    if (chatProposal.source === 'ocr') {
      const isTransfer = chatProposal.kind === 'transfer';
      const canTransfer = banks.length + pockets.length + investments.length >= 2;
      if (isTransfer && canTransfer && ocrState.model) {
        ocrPrefillTransferForm();
        ocrState.openedTransfer = true;
        openModal('panelTransferencia');
        return;
      }
      /* Sem dois destinos a transferência é inválida — mesma regra
         do botão manual — e a revisão convencional assume. */
      if (isTransfer && !canTransfer) {
        alert('Você precisa ter pelo menos dois destinos cadastrados para realizar transferências. Revise como movimentação comum.');
      }
      if (ocrState.model) {
        ocrRenderReview();
        ocrReviewNotice('');
        openModal('panelOcrReview');
        return;
      }
    }
    chatProposalFillManualForm();
  }

  /* Formulário comum já preenchido com o snapshot da proposta. */
  function chatProposalFillManualForm() {
    const d = chatProposal.data;
    chatProposalClear();
    openNewEntryModal();
    if (d) {
      const dateEl = document.getElementById('fData');
      if (dateEl && d.date) dateEl.value = d.date;
      const descEl = document.getElementById('fDesc');
      if (descEl) descEl.value = d.desc || '';
      const bankEl = document.getElementById('fBanco');
      if (bankEl && d.bank) bankEl.value = d.bank;
      const catEl = document.getElementById('fCategoria');
      if (catEl && d.category) catEl.value = d.category;
      updateCategoryTriggerLabel();
      setMoneyInput('fValor', d.amount || 0);
      if (d.type && currentType !== d.type) {
        const toggle = document.getElementById(d.type === 'in' ? 'tglIn' : 'tglOut');
        if (toggle) toggle.click();
      }
    }
    aiChatRender();
  }

  /* Descartar: some com o cartão; origem anexo também libera o anexo. */
  function chatProposalDiscard() {
    const wasOcr = chatProposal.source === 'ocr';
    chatProposalClear();
    if (wasOcr) ocrReleaseAll();
    else aiChatRender();
  }

  /* Pré-preenche panelTransferencia com o que a leitura da LIA tem:
     data, valor, observação e a conta lida (quando bater com um banco)
     na direção correta. Origem/destino completos ficam com o usuário —
     o modal tem o próprio "Ler comprovante com IA". */
  function ocrPrefillTransferForm() {
    const model = ocrState.model;
    if (!model) return false;
    const fields = model.fields || {};
    const dateEl = document.getElementById('tData');
    const rawDate = fields.date && fields.date.value ? String(fields.date.value) : '';
    if (dateEl) dateEl.value = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO();
    const amountRaw = fields.amount ? fields.amount.value : null;
    const amount = Number(amountRaw);
    setMoneyInput('tValor', Number.isFinite(amount) && amount > 0 ? amount : 0);
    const descEl = document.getElementById('tDesc');
    if (descEl) descEl.value = (fields.description && fields.description.value) || '';

    const deSelect = document.getElementById('tDe');
    const paraSelect = document.getElementById('tPara');
    const accountName = (fields.account && fields.account.value) || '';
    const matched = accountName ? matchTransferReceiptTarget(accountName) : null;
    const matchedBank = matched && matched.id && (banks || []).some((bank) => bank.id === matched.id)
      ? matched.id
      : '';
    if (matchedBank && deSelect && paraSelect) {
      const isIn = !!(fields.type && fields.type.value === 'in');
      const side = isIn ? paraSelect : deSelect;
      const other = isIn ? deSelect : paraSelect;
      /* Só preenche quando não colide com o outro lado (senão
         origem === destino e o salvamento é bloqueado). */
      if (other.value !== matchedBank) side.value = matchedBank;
    }
    return true;
  }

  /* ------------------------------------------------------- render preview */

  function ocrCandidatesHtml(key, field) {
    if (!field.candidates || !field.candidates.length) return '';
    if (field.status !== 'AMBIGUOUS' && field.status !== 'MISSING') return '';
    const items = field.candidates.map((candidate) => {
      const label = key === 'amount' && Number.isFinite(Number(candidate))
        ? MONEY_FORMATTER.format(Number(candidate))
        : String(candidate);
      return '<button type="button" class="ocr-candidate" data-field="' + key + '" data-value="' +
        escapeHTML(String(candidate)) + '">' + escapeHTML(label) + '</button>';
    }).join('');
    return '<div class="ocr-candidates" role="group" aria-label="Candidatos reconhecidos">' + items + '</div>';
  }

  function ocrControlHtml(key, field) {
    const id = 'ocrField_' + key;
    if (OCR_READ_ONLY_FIELDS.indexOf(key) !== -1) {
      return '<div class="ocr-readonly" id="' + id + '">' + (field.value == null ? '—' : escapeHTML(String(field.value))) + '</div>';
    }
    if (field.kind === 'date') {
      return '<input type="date" id="' + id + '" value="' + escapeHTML(field.value == null ? '' : String(field.value)) + '">';
    }
    if (field.kind === 'money') {
      return '<input type="text" id="' + id + '" inputmode="numeric" placeholder="R$ 0,00">';
    }
    if (field.kind === 'select') {
      const list = key === 'category' ? categories : banks;
      const options = list.map((item) => '<option value="' + escapeHTML(String(item.id)) + '">' + escapeHTML(String(item.name)) + '</option>').join('');
      return '<select id="' + id + '">' + options + '</select>';
    }
    if (field.kind === 'toggle') {
      return '<div class="type-toggle" id="' + id + '" role="group" aria-label="Tipo de movimentação">' +
        '<button type="button" data-type="in">Entrada</button>' +
        '<button type="button" data-type="out">Saída</button>' +
        '</div>';
    }
    return '<input type="text" id="' + id + '" value="' + escapeHTML(field.value == null ? '' : String(field.value)) + '">';
  }

  function ocrFieldHtml(key, field) {
    const style = globalThis.LivroCaixaReview.describe(field.status);
    const classes = ['ocr-field', style.className];
    if (field.edited) classes.push('is-edited');
    const note = field.persisted ? '' : '<span class="ocr-not-persisted">não é gravado</span>';
    const labelTag = OCR_READ_ONLY_FIELDS.indexOf(key) !== -1
      ? '<span class="ocr-field-label">' + escapeHTML(field.label) + note + '</span>'
      : '<label for="ocrField_' + key + '">' + escapeHTML(field.label) + note + '</label>';
    const suggestion = field.suggestion
      ? '<p class="ocr-suggestion">Sugerido na leitura: ' + escapeHTML(String(field.suggestion)) + ' — selecione a correspondente.</p>'
      : '';
    return '<div class="' + classes.join(' ') + '" data-field="' + key + '">' +
      '<div class="ocr-field-head">' + labelTag +
      '<span class="ocr-field-status">' + escapeHTML(style.label) + '</span></div>' +
      ocrControlHtml(key, field) +
      ocrCandidatesHtml(key, field) + suggestion +
      '<p class="ocr-field-error" data-error-for="' + key + '" hidden></p>' +
      '</div>';
  }

  function ocrUpdateFieldChrome(key) {
    const wrap = document.querySelector('.ocr-field[data-field="' + key + '"]');
    const field = ocrState.model && ocrState.model.fields[key];
    if (!wrap || !field) return;
    const style = globalThis.LivroCaixaReview.describe(field.status);
    wrap.className = 'ocr-field ' + style.className + (field.edited ? ' is-edited' : '');
    const badge = wrap.querySelector('.ocr-field-status');
    if (badge) badge.textContent = style.label;
    const keepCandidates = (field.status === 'AMBIGUOUS' || field.status === 'MISSING') && field.candidates && field.candidates.length;
    const cand = wrap.querySelector('.ocr-candidates');
    if (cand && !keepCandidates) cand.remove();
    /* valor preenchido → a sugestão deixa de fazer sentido */
    if (field.value != null) {
      const sg = wrap.querySelector('.ocr-suggestion');
      if (sg) sg.remove();
    }
    ocrUpdateHint();
  }

  function ocrUpdateHint() {
    const intro = document.getElementById('ocrReviewIntro');
    if (!intro || !ocrState.model) return;
    const counts = globalThis.LivroCaixaReview.summary(ocrState.model);
    const parts = [];
    if (counts.extracted) parts.push(counts.extracted + ' extraído(s)');
    if (counts.edited) parts.push(counts.edited + ' editado(s)');
    if (counts.unconfirmed) parts.push(counts.unconfirmed + ' não confirmado(s)');
    if (counts.absent) parts.push(counts.absent + ' ausente(s)');
    if (counts.invalid) parts.push(counts.invalid + ' inválido(s)');
    intro.textContent = 'Confira o que foi reconhecido. Nada é gravado até você confirmar.' +
      (parts.length ? ' (' + parts.join(', ') + ')' : '');
  }

  function ocrRenderTypeToggle() {
    const wrap = document.getElementById('ocrField_type');
    if (!wrap) return;
    const value = ocrState.model && ocrState.model.fields.type ? ocrState.model.fields.type.value : null;
    wrap.querySelectorAll('button[data-type]').forEach((btn) => {
      const active = btn.dataset.type === value;
      btn.classList.toggle('active-in', active && btn.dataset.type === 'in');
      btn.classList.toggle('active-out', active && btn.dataset.type === 'out');
    });
  }

  function ocrSelectField(key, selectEl) {
    const field = ocrState.model.fields[key];
    const list = key === 'category' ? categories : banks;
    const found = list.find((item) => String(item.id) === String(selectEl.value));
    field.resolvedId = found ? found.id : null;
    field.value = found ? found.name : null;
    field.edited = true;
    field.invalid = false;
    field.status = found ? globalThis.LivroCaixaExtract.STATUS.USER_EDITED : globalThis.LivroCaixaExtract.STATUS.MISSING;
    ocrUpdateFieldChrome(key);
  }

  function ocrBindFields() {
    const model = ocrState.model;
    if (!model) return;

    const dateEl = document.getElementById('ocrField_date');
    if (dateEl) dateEl.addEventListener('change', () => {
      globalThis.LivroCaixaReview.editField(model, 'date', dateEl.value);
      ocrUpdateFieldChrome('date');
    });

    const descEl = document.getElementById('ocrField_description');
    if (descEl) descEl.addEventListener('input', () => {
      globalThis.LivroCaixaReview.editField(model, 'description', descEl.value);
      ocrUpdateFieldChrome('description');
    });

    const amountEl = document.getElementById('ocrField_amount');
    if (amountEl) {
      amountEl.addEventListener('change', () => {
        const value = readMoneyInput(amountEl);
        globalThis.LivroCaixaReview.editField(model, 'amount', Number.isFinite(value) && value > 0 ? value : null);
        if (Number.isFinite(value) && value > 0) setMoneyInput(amountEl, value);
        ocrUpdateFieldChrome('amount');
      });
    }

    const catEl = document.getElementById('ocrField_category');
    if (catEl) catEl.addEventListener('change', () => ocrSelectField('category', catEl));
    const bankEl = document.getElementById('ocrField_account');
    if (bankEl) bankEl.addEventListener('change', () => ocrSelectField('account', bankEl));

    const typeWrap = document.getElementById('ocrField_type');
    if (typeWrap) {
      typeWrap.querySelectorAll('button[data-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          globalThis.LivroCaixaReview.editField(model, 'type', btn.dataset.type);
          ocrRenderTypeToggle();
          ocrUpdateFieldChrome('type');
        });
      });
    }

    document.querySelectorAll('#ocrReviewFields .ocr-candidate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.field;
        /* data-value chega como string: o tipo do campo é restaurado aqui
           (valor monetário NÃO pode virar string no modelo) */
        let chosen = btn.dataset.value;
        if (key === 'amount' && Number.isFinite(Number(chosen))) chosen = Number(chosen);
        globalThis.LivroCaixaReview.chooseCandidate(model, key, chosen);
        if (key === 'amount') {
          const amountEl = document.getElementById('ocrField_amount');
          const value = Number(btn.dataset.value);
          if (amountEl && Number.isFinite(value)) setMoneyInput(amountEl, value);
        }
        ocrUpdateFieldChrome(key);
        if (key === 'type') ocrRenderTypeToggle();
        if (key === 'category' || key === 'account') {
          const el = document.getElementById('ocrField_' + key);
          const field = model.fields[key];
          if (el && field && field.value) {
            const list = key === 'category' ? categories : banks;
            const found = list.find((item) => item.name === field.value);
            if (found) { el.value = found.id; field.resolvedId = found.id; }
          }
        }
        const wrap = document.querySelector('.ocr-field[data-field="' + key + '"]');
        if (wrap) {
          const cand = wrap.querySelector('.ocr-candidates');
          if (cand) cand.remove();
          const sg = wrap.querySelector('.ocr-suggestion');
          if (sg) sg.remove();
        }
      });
    });
  }

  function ocrRenderReview() {
    const model = ocrState.model;
    const box = document.getElementById('ocrReviewFields');
    if (!model || !box) return;

    const preview = document.getElementById('ocrAttachmentPreview');
    if (preview) {
      const attachment = model.attachment;
      if (!attachment) {
        preview.hidden = true;
        preview.innerHTML = '';
      } else if (attachment.category === 'image') {
        const url = globalThis.LivroCaixaAttachments.manager.previewUrl(attachment.id);
        preview.hidden = false;
        preview.innerHTML = url
          ? '<img class="ocr-preview-img" src="' + url + '" alt="Pré-visualização do anexo">'
          : '<span class="ocr-preview-file">' + escapeHTML(attachment.name) + '</span>';
      } else {
        preview.hidden = false;
        preview.innerHTML = '<span class="ocr-preview-file">' + escapeHTML(attachment.name) + '</span>';
      }
    }

    box.innerHTML = OCR_FIELD_ORDER
      .map((key) => (model.fields[key] ? ocrFieldHtml(key, model.fields[key]) : ''))
      .join('');

    const amountEl = document.getElementById('ocrField_amount');
    if (amountEl && model.fields.amount && model.fields.amount.value != null) {
      setMoneyInput(amountEl, model.fields.amount.value);
    }
    const catEl = document.getElementById('ocrField_category');
    if (catEl && model.fields.category && model.fields.category.resolvedId) catEl.value = model.fields.category.resolvedId;
    const bankEl = document.getElementById('ocrField_account');
    if (bankEl && model.fields.account && model.fields.account.resolvedId) bankEl.value = model.fields.account.resolvedId;

    ocrRenderTypeToggle();
    ocrBindFields();
    ocrUpdateHint();
  }

  function ocrShowErrors(errors) {
    const list = errors || [];
    document.querySelectorAll('#ocrReviewFields .ocr-field-error').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    /* ao limpar os erros, os campos destacados voltam ao estado real */
    if (!list.length && ocrState.model) {
      OCR_FIELD_ORDER.forEach((key) => ocrUpdateFieldChrome(key));
    }
    list.forEach((err) => {
      const el = document.querySelector('[data-error-for="' + err.key + '"]');
      if (el) { el.textContent = err.message; el.hidden = false; }
      ocrUpdateFieldChrome(err.key);
    });
  }

  /* ------------------------------------------------------------- pipeline */

  async function ocrRunPipeline(attachment) {
    const manager = globalThis.LivroCaixaAttachments.manager;
    const guard = manager.beginProcessing(attachment.id);
    if (!guard.ok) {
      ocrAttachmentNotice('Este anexo já está sendo processado.', 'error');
      return;
    }

    const controller = new AbortController();
    ocrState.controller = controller;
    ocrState.busy = true;
    ocrAttachmentNotice('Lendo o anexo…');
    const attachBtn = document.getElementById('btnLiaAttach');
    if (attachBtn) attachBtn.disabled = true;

    try {
      const prompt = globalThis.LivroCaixaOCRLia.buildReadPrompt({ holderLabel: ocrHolderLabel() });
      const aiReady = !!(window.LivroCaixaAI && typeof window.LivroCaixaAI.isReady === 'function' && await window.LivroCaixaAI.isReady());

      const read = await globalThis.LivroCaixaOCR.extract(attachment.file, {
        prompt,
        signal: controller.signal,
        aiReady,
        reader: async ({ signal }) => {
          const part = await fileToReceiptGenerativePart(attachment.file);
          return await window.LivroCaixaAI.generate({ prompt, imagePart: part, maxTokens: 1200, signal });
        },
        parse: globalThis.LivroCaixaOCRLia.parseReadResponse
      });

      if (!read.continuable) {
        ocrAttachmentNotice(ocrReadErrorMessage(read.status), 'error');
        ocrSetFallback(true);
        return;
      }

      const deterministic = globalThis.LivroCaixaExtract.extractFromText(read.text || '');
      const interpreted = globalThis.LivroCaixaOCRLia.interpret({
        readFields: read.fields || {},
        readCandidates: read.candidates || {},
        deterministic,
        text: read.text,
        catalog: {
          categories: categories.map((c) => ({ value: c.id, label: c.name })),
          banks: banks.map((b) => ({ value: b.id, label: b.name }))
        }
      });

      ocrState.model = globalThis.LivroCaixaReview.createModel(interpreted, {
        attachment,
        environment: read.environment,
        provider: read.provider,
        extractStatus: read.status
      });
      /* Mesmo titular nos lados De/Para (CPF/nome) é o sinal que o
         keyword-match não alcança: Pix entre contas do próprio usuário. */
      ocrState.sameHolder = globalThis.LivroCaixaExtract.detectSameHolder(read.text || '');

      ocrSetFallback(false);
      ocrAttachmentNotice('');
      /* Comprovante com os dados reconhecidos entra pelo render do chat
         antes da repintura — o modal de revisão só abre no clique em
         Editar. O status cobre NO_TEXT e os badges cobrem AMBIGUOUS. */
      chatProposalFromOcr();
      aiChatRender();
    } catch (err) {
      ocrAttachmentNotice('Não foi possível ler o anexo.', 'error');
      ocrSetFallback(true);
      globalThis.LivroCaixaOCRLog && globalThis.LivroCaixaOCRLog.failure('pipeline.erro', {
        stage: 'pipeline', status: 'falhou', code: (err && err.code) || 'UNEXPECTED'
      });
    } finally {
      ocrState.busy = false;
      manager.endProcessing(attachment.id);
      if (attachBtn) attachBtn.disabled = false;
    }
  }

  function ocrFillLaunchForm(value) {
    editingEntryId = null;
    const dateEl = document.getElementById('fData');
    const descEl = document.getElementById('fDesc');
    const bankEl = document.getElementById('fBanco');
    const catEl = document.getElementById('fCategoria');
    if (dateEl) dateEl.value = value.date;
    if (descEl) descEl.value = value.desc;
    if (bankEl && value.bank) bankEl.value = value.bank;
    if (catEl && value.category) catEl.value = value.category;
    updateCategoryTriggerLabel();
    setMoneyInput('fValor', value.amount);
    if (currentType !== value.type) {
      document.getElementById(value.type === 'in' ? 'tglIn' : 'tglOut').click();
    }
  }

  function ocrAbortReview(message) {
    ocrReleaseAll();
    ocrReviewNotice('');
    closeAllPanels();
    /* o aviso de "nada foi gravado" mora dentro da conversa: reabre-a
       para que a mensagem seja lida (é o mesmo caminho do FAB da Visão
       Geral — LivroCaixaChat.open()). */
    const text = message || 'Revisão encerrada. Nada foi gravado.';
    if (window.LivroCaixaChat && typeof window.LivroCaixaChat.open === 'function') {
      window.LivroCaixaChat.open();
    }
    ocrAttachmentNotice(text);
  }
