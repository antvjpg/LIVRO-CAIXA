/* LIVRO-CAIXA · js/27-cards.js — cartões e lançamentos (app.js: 10488-11751). Separação por responsabilidade; conteúdo preservado. */



  function renderCardBankSelect(selected = '') {
    const select = document.getElementById('cardBanco');
    if (!select) return;
    select.innerHTML = '<option value="">Não informado</option>' + banks.map(b => `<option value="${escapeHTML(b.id)}">${escapeHTML(b.name)}</option>`).join('');
    select.value = selected || '';
  }
  function renderPurchaseSelects(selectedCard = '', selectedCategory = '') {
    const cardSelect = document.getElementById('purchaseCard');
    const catSelect = document.getElementById('purchaseCategory');
    if (cardSelect) {
      cardSelect.innerHTML = cards.filter(c => c.active !== false).map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
      if (selectedCard && cards.some(c => c.id === selectedCard)) cardSelect.value = selectedCard;
    }
    if (catSelect) {
      catSelect.innerHTML = categories.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.name)}</option>`).join('');
      if (selectedCategory && categories.some(c => c.id === selectedCategory)) catSelect.value = selectedCategory;
    }
  }
  function cardBankName(card) { return banks.find(b => b.id === card.bankId)?.name || 'Banco não informado'; }
  function normalizeCardRecord(record, existing = null) {
    return {
      id: existing?.id || record.id,
      createdAt: existing?.createdAt || record.createdAt || new Date().toISOString(),
      name: String(record.name || '').trim(),
      bankId: String(record.bankId || ''),
      titular: String(record.titular || '').trim(),
      closingDay: Math.min(31, Math.max(1, Number(record.closingDay) || 1)),
      dueDay: Math.min(31, Math.max(1, Number(record.dueDay) || 1)),
      limit: Math.max(0, Number(record.limit) || 0),
      active: record.active !== false,
      obs: String(record.obs || '').trim()
    };
  }
  function normalizePurchaseRecord(record, existing = null) {
    const total = Math.max(0, Number(record.totalValue) || 0);
    const type = record.paymentType === 'parcelado' ? 'parcelado' : 'avista';
    const totalInstallments = type === 'parcelado' ? Math.max(2, Math.min(360, Number(record.totalInstallments) || 2)) : 1;
    const installmentValue = type === 'parcelado' ? (Number(record.installmentValue) > 0 ? Number(record.installmentValue) : total / totalInstallments) : total;
    return {
      id: existing?.id || record.id,
      createdAt: existing?.createdAt || record.createdAt || new Date().toISOString(),
      cardId: String(record.cardId || ''),
      description: String(record.description || '').trim(),
      date: record.date || todayISO(),
      totalValue: total,
      titular: String(record.titular || '').trim(),
      categoryId: String(record.categoryId || ''),
      paymentType: type,
      totalInstallments,
      installmentValue,
      initialInstallment: Math.min(totalInstallments, Math.max(1, Number(record.initialInstallment) || 1)),
      obs: String(record.obs || '').trim(),
      status: existing?.status || 'pendente',
      ...(existing?.archivedAt ? { archivedAt: existing.archivedAt } : {}),
      ...(existing?.statusBeforeArchive ? { statusBeforeArchive: existing.statusBeforeArchive } : {}),
      ...(existing?.autoBlocked ? { autoBlocked: true } : {})
    };
  }
  function openCardModal(id = null) {
    editingCardId = id;
    const card = id ? cards.find(c => c.id === id) : null;
    renderCardBankSelect(card?.bankId || '');
    document.getElementById('cardNome').value = card?.name || '';
    document.getElementById('cardTitular').value = card?.titular || '';
    document.getElementById('cardFechamento').value = card?.closingDay || '';
    document.getElementById('cardVencimento').value = card?.dueDay || '';
    setMoneyInput('cardLimite', card?.limit || 0);
    document.getElementById('cardAtivo').value = card?.active === false ? '0' : '1';
    document.getElementById('cardObs').value = card?.obs || '';
    document.getElementById('panelCardTitle').innerHTML = `${card ? 'Editar' : 'Novo'} Cartão <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('cardSalvar').textContent = card ? 'Atualizar Cartão' : 'Salvar Cartão';
    openModal('panelCard');
  }
  function openPurchaseModal(cardId = '', id = null) {
    if (!cards.filter(c => c.active !== false).length && !id) { showToast('Cadastre pelo menos um cartão ativo antes de registrar uma compra.', 'error'); return; }
    editingPurchaseId = id;
    const purchase = id ? purchases.find(p => p.id === id) : null;
    renderPurchaseSelects(purchase?.cardId || cardId || cards.find(c => c.active !== false)?.id || '', purchase?.categoryId || categories[0]?.id || '');
    document.getElementById('purchaseDate').value = purchase?.date || todayISO();
    document.getElementById('purchaseDesc').value = purchase?.description || '';
    setMoneyInput('purchaseValue', purchase?.totalValue || 0);
    document.getElementById('purchaseTitular').value = purchase?.titular || '';
    document.getElementById('purchaseType').value = purchase?.paymentType === 'parcelado' ? 'parcelado' : 'avista';
    document.getElementById('purchaseInstallments').value = purchase?.totalInstallments || '';
    setMoneyInput('purchaseInstallmentValue', purchase?.installmentValue || 0);
    document.getElementById('purchaseInitialInstallment').value = purchase?.initialInstallment || 1;
    document.getElementById('purchaseObs').value = purchase?.obs || '';
    updatePurchaseInstallmentFields();
    document.getElementById('panelPurchaseTitle').innerHTML = `${purchase ? 'Editar' : 'Nova'} Compra <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('purchaseSalvar').textContent = purchase ? 'Atualizar Compra' : 'Salvar Compra';
    openModal('panelPurchase');
  }
  let purchaseCalcMode;
 // 'installment' = parcela dirige o total; 'total' = total dirige a parcela
  function updatePurchaseInstallmentFields() {
    const parcelado = document.getElementById('purchaseType')?.value === 'parcelado';
    ['purchaseInstallmentsField','purchaseInstallmentValueField','purchaseInitialInstallmentField','purchaseInstallmentHint'].forEach(id => { const el=document.getElementById(id); if(el) el.style.display=parcelado ? '' : 'none'; });
    document.getElementById('purchaseValueLabel').textContent = 'Valor total (R$)';
    document.getElementById('purchaseValue').readOnly = false;
    if (parcelado) recalcFromCount();
  }
  // A quantidade de parcelas muda: recalcula o campo OPOSTO ao que foi editado por último, preservando o que o usuário digitou.
  function recalcFromCount() {
    if (purchaseCalcMode === 'total') recalcInstallmentFromTotal();
    else recalcTotalFromInstallment();
  }
  function recalcTotalFromInstallment() {
    if (document.getElementById('purchaseType')?.value !== 'parcelado') return;
    const installmentValue = readMoneyInput('purchaseInstallmentValue') || 0;
    const count = Math.max(2, Number(document.getElementById('purchaseInstallments').value) || 2);
    setMoneyInput('purchaseValue', installmentValue * count);
  }
  function recalcInstallmentFromTotal() {
    if (document.getElementById('purchaseType')?.value !== 'parcelado') return;
    const total = readMoneyInput('purchaseValue') || 0;
    const count = Math.max(2, Number(document.getElementById('purchaseInstallments').value) || 2);
    setMoneyInput('purchaseInstallmentValue', total / count);
  }
  // ===== Fase C — Motor de fatura (cálculo puro, sem integração com Calendário/Livro-Caixa ainda) =====
  function invoicePeriodKeyForDate(card, dateStr) {
    const d = new Date((dateStr || todayISO()) + 'T00:00:00');
    const day = d.getDate();
    const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
    // Se a compra ocorre no dia de fechamento ou antes, entra na fatura que fecha nesse mesmo mês.
    // Se ocorre depois do fechamento, entra na fatura do mês seguinte.
    const targetMonth = day <= closing ? d.getMonth() : d.getMonth() + 1;
    const target = new Date(d.getFullYear(), targetMonth, 1);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
  }
  function addMonthsToPeriodKey(periodKey, months) {
    const [y, m] = periodKey.split('-').map(Number);
    const d = new Date(y, (m - 1) + months, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  function invoicePeriodKeyForDateByCardId(cardId, dateStr) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return null;
    return invoicePeriodKeyForDate(card, dateStr);
  }
  // Agrega todas as compras/parcelas de um cartão que caem num período de fatura específico (formato 'AAAA-MM').
  function currentInvoicePeriodKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // Converte o período de fechamento da fatura no mês em que ela vence.
  // Mantém o mesmo critério usado por closingPeriodKeyForDueMonth().
  function dueMonthKeyForClosingPeriod(card, closingPeriodKey) {
    const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
    const due = Math.min(31, Math.max(1, Number(card.dueDay) || closing));
    const offset = due < closing ? 1 : 0;
    return addMonthsToPeriodKey(closingPeriodKey, offset);
  }
  // Limite usado = soma de todas as compras/parcelas ainda não pagas do cartão (total comprometido, não só a fatura atual).
  // Limite disponível = limite total - limite usado. Aproximação baseada só no que está cadastrado no app —
  // não reflete o extrato real do banco, apenas o que foi lançado aqui.
  // A fatura é nomeada pelo mês em que VENCE (como no extrato real do banco), não pelo mês em que fecha.
  // Se vencimento < fechamento, o fechamento fica um mês ANTES do mês de vencimento — precisamos "voltar" um mês
  // pra achar o período de fechamento certo que corresponde à fatura que vence no mês pedido.
  function closingPeriodKeyForDueMonth(card, dueMonthKey) {
    const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
    const due = Math.min(31, Math.max(1, Number(card.dueDay) || closing));
    const offset = due < closing ? 1 : 0;
    return addMonthsToPeriodKey(dueMonthKey, -offset);
  }
  function invoicePeriodLabel(periodKey) {
    const [y, m] = periodKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }
  // ===== Fase D — Vencimento da fatura + integração com o Calendário =====
  function invoiceDueDateForPeriod(card, periodKey) {
    // Fonte de verdade: o motor (mesma regra usada no cálculo de saldo
    // anterior). O cálculo local abaixo fica apenas como fallback.
    const engineRef = window.LivroCaixaCardEngineV3;
    if (engineRef && typeof engineRef.dueDateForPeriod === 'function') {
      return engineRef.dueDateForPeriod(card, periodKey);
    }
    const [y, m] = periodKey.split('-').map(Number);
    const closing = Math.min(31, Math.max(1, Number(card.closingDay) || 1));
    const due = Math.min(31, Math.max(1, Number(card.dueDay) || closing));
    // Se o dia de vencimento é menor que o dia de fechamento, o vencimento cai no mês seguinte ao fechamento.
    // Ex: fecha dia 29, vence dia 05 -> fecha 29/08, vence 05/09.
    const dueMonthOffset = due < closing ? 1 : 0;
    const dueDate = new Date(y, (m - 1) + dueMonthOffset, 1);
    const lastDayOfDueMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
    const finalDay = Math.min(due, lastDayOfDueMonth);
    return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`;
  }
  // Rótulo da janela de compras da fatura ("11/08 a 10/09"), derivado do motor
  // para não duplicar o cálculo de fechamento. Retorna '' se o motor não
  // estiver disponível ou o período for inválido.
  function invoiceCycleLabel(card, periodKey) {
    const engineRef = window.LivroCaixaCardEngineV3;
    const cycle = engineRef && typeof engineRef.invoiceCycleRange === 'function'
      ? engineRef.invoiceCycleRange(card, periodKey)
      : null;
    if (!cycle) return '';
    const br = iso => String(iso || '').split('-').reverse().join('/');
    return `${br(cycle.start)} a ${br(cycle.end)}`;
  }
  // ===== Fase F — Lançamento/compartilhamento/status individual por titular dentro de cada fatura =====
  // Vínculo por ID: cardId + período de fechamento + titular identifica de forma estável a "fatia" de um titular
  // numa fatura, independente de nome/valor/data mudarem depois (o valor exibido é sempre recalculado ao vivo;
  // o que fica gravado é só o vínculo de que aquele titular, naquele cartão/período, já foi lançado).
  function invoiceLaunchId(cardId, closingPeriodKey, titular) {
    return `invl_${cardId}_${closingPeriodKey}_${(titular || 'sem-titular').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }
  function invoiceLaunchFor(cardId, closingPeriodKey, titular) {
    return invoiceLaunches.find(x => x.id === invoiceLaunchId(cardId, closingPeriodKey, titular));
  }

  // V.19-14 — marcar fatura de cartão como paga SEM lançar no Livro-Caixa
  function invoiceMarkedPaidOnly(cardId, closingPeriodKey, titular) {
    const launch = invoiceLaunchFor(cardId, closingPeriodKey, titular);
    return !!(launch && launch.markedPaidOnly);
  }
  async function markInvoicePaidOnly(cardId, closingPeriodKey, titular, totalAmount) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    showToast('Salvando status da fatura…', 'info', 2000);
    const id = invoiceLaunchId(cardId, closingPeriodKey, titular);
    const existing = invoiceLaunches.find(x => x.id === id);
    const invoiceState = window.LivroCaixaCardEngineV3.invoice(
      cardId,
      closingPeriodKey,
      purchases,
      cards,
      invoiceLaunches
    );

    const normalizedTitular = window.LivroCaixaCardEngineV3.normalizeTitular(titular);
    const target = Array.isArray(invoiceState?.titulars)
      ? invoiceState.titulars.find(item =>
          window.LivroCaixaCardEngineV3.normalizeTitular(item.titular) === normalizedTitular
        )
      : null;

    if (
      existing &&
      target &&
      (target.payableStatus || target.status) === 'Pago' &&
      target.markedPaidOnly !== true
    ) {
      showToast('Esta fatura já foi lançada no Livro-Caixa.', 'warning');
      return;
    }
    const prev = existing ? JSON.parse(JSON.stringify(existing)) : null;
    const record = {
      id,
      cardId,
      closingPeriodKey,
      titular: titular || '',
      markedPaidOnly: true,
      amount: 0,
      payments: Array.isArray(existing?.payments) ? existing.payments : [],
      updatedAt: todayISO()
    };
    if (existing) {
      const idx = invoiceLaunches.findIndex(x => x.id === id);
      invoiceLaunches[idx] = { ...existing, ...record };
    } else {
      invoiceLaunches.push(record);
    }

    // Cascata: a quitação deste período cobre também o saldo anterior que ele
    // arrastava, então esses períodos são marcados junto. Sem isso,
    // calculateLimit()/cardCommittedAmount() continuariam contando uma
    // dívida que o usuário acabou de quitar. Ao desmarcar, apenas o período
    // escolhido volta a ficar em aberto (use "Desmarcar pago" nos períodos
    // anteriores, se quiser reabrí-los também).
    const engineRef = window.LivroCaixaCardEngineV3;
    const sources = engineRef && typeof engineRef.carrySourcePeriods === 'function'
      ? engineRef.carrySourcePeriods(cardId, closingPeriodKey, titular, purchases, cards, invoiceLaunches)
      : [];
    const cascade = [];
    sources.forEach(source => {
      const sourceId = invoiceLaunchId(cardId, source.periodKey, titular);
      const found = invoiceLaunches.find(x => x.id === sourceId);
      if (found && found.markedPaidOnly) return;
      const snapshot = found ? JSON.parse(JSON.stringify(found)) : null;
      if (found) {
        const idx = invoiceLaunches.findIndex(x => x.id === sourceId);
        invoiceLaunches[idx] = { ...found, markedPaidOnly: true, updatedAt: todayISO() };
      } else {
        invoiceLaunches.push({
          id: sourceId,
          cardId,
          closingPeriodKey: source.periodKey,
          titular: titular || '',
          markedPaidOnly: true,
          amount: 0,
          payments: [],
          updatedAt: todayISO()
        });
      }
      cascade.push({ id: sourceId, snapshot });
    });

    try {
      await persistAll();
      logInfo('Cartões', 'Marcar fatura como paga', 'Sucesso', `Fatura ${card.name} (${closingPeriodKey}) marcada como paga sem lançamento${cascade.length ? ` · ${cascade.length} fatura(s) anterior(es) do saldo também marcada(s)` : ''}.`);
    } catch (err) {
      if (prev) {
        const idx = invoiceLaunches.findIndex(x => x.id === id);
        if (idx >= 0) invoiceLaunches[idx] = prev;
      } else {
        invoiceLaunches = invoiceLaunches.filter(x => x.id !== id);
      }
      cascade.forEach(item => {
        if (!item.snapshot) {
          invoiceLaunches = invoiceLaunches.filter(x => x.id !== item.id);
          return;
        }
        const idx = invoiceLaunches.findIndex(x => x.id === item.id);
        if (idx >= 0) invoiceLaunches[idx] = item.snapshot;
      });
      logSyncError('marcar fatura como paga', err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
    } finally {
      renderBills();
      renderCards();
      renderNotifications();
    }
  }
  async function unmarkInvoicePaidOnly(cardId, closingPeriodKey, titular) {
    const id = invoiceLaunchId(cardId, closingPeriodKey, titular);
    const existing = invoiceLaunches.find(x => x.id === id);
    if (!existing || !existing.markedPaidOnly) return;
    showToast('Removendo status pago…', 'info', 2000);
    const prev = JSON.parse(JSON.stringify(existing));
    // se não há payments, remove o registro; senão só tira a flag
    if (!Array.isArray(existing.payments) || existing.payments.length === 0) {
      invoiceLaunches = invoiceLaunches.filter(x => x.id !== id);
    } else {
      existing.markedPaidOnly = false;
    }
    try {
      await persistAll();
      logInfo('Cartões', 'Desmarcar fatura paga', 'Sucesso', `Status pago removido (${closingPeriodKey}).`);
    } catch (err) {
      const idx = invoiceLaunches.findIndex(x => x.id === id);
      if (idx >= 0) invoiceLaunches[idx] = prev;
      else invoiceLaunches.push(prev);
      logSyncError('desmarcar fatura paga', err);
      showToast('Não foi possível atualizar. Tente novamente.', 'error');
    } finally {
      renderBills();
      renderCards();
      renderNotifications();
    }
  }

  function calendarInvoiceRows(year, month) {
    const dueMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    if (
      !window.LivroCaixaCardEngineV3 ||
      typeof window.LivroCaixaCardEngineV3.invoice !== 'function'
    ) {
      throw new Error('CardEngine não disponível para calendarInvoiceRows.');
    }

    return cards
      .filter(card => card.active !== false)
      .map(card => {
        const closingPeriodKey = closingPeriodKeyForDueMonth(card, dueMonthKey);

        const invoiceState = window.LivroCaixaCardEngineV3.invoice(
          card.id,
          closingPeriodKey,
          purchases,
          cards,
          invoiceLaunches
        );

        if (!invoiceState || Number(invoiceState.total || 0) <= 0) {
          return null;
        }

        const breakdown = Array.isArray(invoiceState.titulars)
          ? invoiceState.titulars.map(item => {
              // Os valores exibidos são os PAGÁVEIS: somam a parcela do
              // próprio período com o saldo anterior já vencido (arrasto).
              // `own*` preserva a parcela do período para consulta/diagnóstico.
              return {
                titular: item.titular,
                total: Number(item.payableTotal != null ? item.payableTotal : item.total || 0),
                count: Number(item.count || 0),
                paid: Number(item.payablePaid != null ? item.payablePaid : item.paid || 0),
                remaining: Number(item.payableRemaining != null ? item.payableRemaining : item.remaining || 0),
                status: item.payableStatus || item.status || 'Pendente',
                carry: Number(item.carry || 0),
                ownTotal: Number(item.total || 0),
                ownPaid: Number(item.paid || 0),
                ownRemaining: Number(item.remaining || 0),
                ownStatus: item.status || 'Pendente',
                launched: item.status === 'Pago' &&
                          item.markedPaidOnly !== true &&
                          Number(item.paid || 0) > 0.004,
                paidOnly: item.markedPaidOnly === true
              };
            })
          : [];

        const invoice = {
          cardId: invoiceState.cardId,
          periodKey: invoiceState.periodKey,
          lines: [],
          total: Number(invoiceState.payableTotal || 0),
          count: invoiceState.titulars.reduce(
            (sum, item) => sum + Number(item.count || 0),
            0
          ),
          carry: Number(invoiceState.carry || 0),
          payableTotal: Number(invoiceState.payableTotal || 0),
          payableRemaining: Number(invoiceState.payableRemaining || 0),
          carriedOut: Number(invoiceState.carriedOut || 0)
        };

        return {
          card,
          invoice,
          closingPeriodKey,
          dueDate: invoiceDueDateForPeriod(card, closingPeriodKey),
          breakdown
        };
      })
      .filter(Boolean);
  }

  // ===== Navegação de períodos de fatura por cartão =====
  // Seleção por cartão (período de fechamento escolhido na UI). NÃO é dado
  // persistido: só controla qual fatura está sendo exibida em renderCards().
  // Padrão: período corrente; volta ao corrente se ficar fora dos limites.
  let cardInvoiceSelection;


  // Limites = períodos conhecidos (compras/parcelas + lançamentos + referência
  // atual). Navegação acontece em ±1 mês dentro dessa faixa.
  function cardInvoiceNavState(card) {
    const referencePeriod = currentInvoicePeriodKey();
    const periodState = typeof window.LivroCaixaCardEngineV3?.invoicePeriods === 'function'
      ? window.LivroCaixaCardEngineV3.invoicePeriods(
          card,
          purchases,
          cards,
          invoiceLaunches,
          referencePeriod
        )
      : null;
    const current = periodState?.current || closingPeriodKeyForDueMonth(card, referencePeriod);
    const known = Array.isArray(periodState?.periods) && periodState.periods.length
      ? periodState.periods
      : [current];
    const min = known[0];
    const max = known[known.length - 1];
    let selected = cardInvoiceSelection[card.id];
    if (typeof selected !== 'string' || selected < min || selected > max) {
      selected = current;
      cardInvoiceSelection[card.id] = selected;
    }
    return {
      referencePeriod,
      current,
      min,
      max,
      selected,
      canPrev: selected > min,
      canNext: selected < max
    };
  }

  /* Estado de UI das compras por cartão. Sobrevive aos re-renders de renderCards(). */
  let purchasesUiState;


  /* Conclusão de compra derivada da fatura (AGENTS §21):
     - manual vence automático: status 'finalizada' (✓) conclui sempre;
     - autoBlocked (⟲ manual) impede a conclusão automática;
     - caso contrário, conclui quando a fatura da ÚLTIMA parcela estiver Paga.
     Nada é persistido aqui: é cálculo de renderização. */
  function buildConcludedMap(list) {
    const map = new Map();
    const engineRef = window.LivroCaixaCardEngineV3;
    if (!engineRef || !Array.isArray(list) || !list.length) return map;
    const cardsById = new Map(cards.map(c => [c.id, c]));
    const meta = new Map();
    const groups = new Map();
    list.forEach(p => {
      if (p.status === 'finalizada' || p.autoBlocked) return;
      let occurrences = [];
      try { occurrences = engineRef.purchaseInstallmentOccurrences(p, cardsById) || []; } catch (err) { occurrences = []; }
      const last = occurrences[occurrences.length - 1];
      if (!last) return;
      const groupKey = `${last.cardId}|${last.periodKey}`;
      const titularKey = engineRef.normalizeTitular(p.titular || '');
      if (!groups.has(groupKey)) groups.set(groupKey, new Set());
      groups.get(groupKey).add(titularKey);
      meta.set(p.id, `${groupKey}|${titularKey}`);
      map.set(p.id, false);
    });
    const paidByGroup = new Map();
    groups.forEach((titulares, groupKey) => {
      const sep = groupKey.indexOf('|');
      const cardId = groupKey.slice(0, sep);
      const periodKey = groupKey.slice(sep + 1);
      let invoice = null;
      try { invoice = engineRef.invoice(cardId, periodKey, purchases, cards, invoiceLaunches); } catch (err) { invoice = null; }
      ((invoice && invoice.titulars) || []).forEach(t => {
        const titularKey = engineRef.normalizeTitular(t.titular || '');
        if (!titulares.has(titularKey)) return;
        paidByGroup.set(`${groupKey}|${titularKey}`, (t.payableStatus || t.status) === 'Pago');
      });
    });
    meta.forEach((key, id) => map.set(id, paidByGroup.get(key) === true));
    return map;
  }

  function purchaseIsConcluded(p, concludedMap) {
    if (p.status === 'finalizada') return true;
    if (p.autoBlocked) return false;
    return concludedMap.get(p.id) === true;
  }

  function purchaseRowHtml(p, concludedMap) {
    const cat = categories.find(c => c.id === p.categoryId)?.name || 'Sem categoria';
    const parcelado = p.paymentType === 'parcelado';
    const parcel = parcelado ? `${p.totalInstallments}× de ${fmt(p.installmentValue)}` : 'À vista';
    const concluded = purchaseIsConcluded(p, concludedMap);
    const statusBadge = concluded ? '<span class="purchase-status finalizada">✓ Finalizada</span>' : (p.status === 'parcial' ? '<span class="purchase-status parcial">⏳ Parcial</span>' : '<span class="purchase-status pendente">⏳ Pendente</span>');
    const finalizeBtn = !concluded ? `<button type="button" class="action-btn beta-icon-button finalize" onclick="finalizePurchase('${p.id}')" aria-label="Marcar como finalizada" title="Marcar como finalizada"><i class="fi fi-rr-check" aria-hidden="true"></i></button>` : '';
    const reopenBtn = concluded ? `<button type="button" class="action-btn beta-icon-button unarchive" onclick="unarchivePurchase('${p.id}')" aria-label="Reabrir compra" title="Reabrir compra"><i class="fi fi-rr-refresh" aria-hidden="true"></i></button>` : '';
    return `<div class="credit-card-purchase-row ${concluded ? 'is-finalized' : ''}">
      <span class="credit-card-purchase-dot" aria-hidden="true"></span>
      <div class="credit-card-purchase-main">
        <strong>${escapeHTML(p.description || 'Compra sem descrição')}</strong>
        <span>${(p.date || '').split('-').reverse().join('/')} · ${escapeHTML(p.titular || 'Sem titular')}</span>
        ${parcelado ? '' : `<span class="credit-card-purchase-parcel">${parcel}</span>`}
      </div>
      ${statusBadge}
      <strong class="credit-card-purchase-value">${fmt(p.totalValue)}${parcelado ? `<span class="credit-card-purchase-value-parcel">(${parcel})</span>` : ''}</strong>
      <div class="credit-card-purchase-menu">
        ${finalizeBtn}
        ${reopenBtn}
        <button type="button" class="action-btn beta-icon-button edit" onclick="editPurchase('${p.id}')" aria-label="Editar"></button>
        <button type="button" class="action-btn beta-icon-button delete" onclick="deletePurchase('${p.id}')" aria-label="Excluir"></button>
      </div>
    </div>`;
  }

  /* Protótipo de layout: pilha de cartões estilo Google Wallet acima do grid.
     Um slide por cartão, todos empilhados no mesmo lugar — o cartão de trás
     deixa a borda superior (cantos) aparecer acima do ativo e desliza por
     trás durante o arrasto. `cardHeroState.index` é só de UI (sobrevive aos
     re-renders) — nada é persistido; o DOM só é reconstruído se a lista mudar,
     para que a troca de cartão seja animada (transição fluida). */
  let cardHeroState;

  let cardHeroClampIndex;


  function cardHeroLimitState(card) {
    try {
      const nav = cardInvoiceNavState(card);
      if (window.LivroCaixaCardEngineV3 && typeof window.LivroCaixaCardEngineV3.calculateLimit === 'function') {
        return window.LivroCaixaCardEngineV3.calculateLimit(
          card, purchases, cards, invoiceLaunches, nav.referencePeriod
        );
      }
    } catch (err) { /* motor indisponível */ }
    return null;
  }

  function cardHeroLimitAvailable(card) {
    const limitState = cardHeroLimitState(card);
    const available = limitState ? Number(limitState.available) : NaN;
    return Number.isFinite(available) ? available : null;
  }

  /* Barra de progresso de limite — movida do credit-card-box (aba Cartões)
     para o cartão do hero; some quando o cartão não tem limite. */
  function cardHeroLimitBarHtml(card, hasLimit) {
    if (!hasLimit) return '';
    const limitState = cardHeroLimitState(card);
    if (!limitState) return '';
    const total = Math.max(0, Number(limitState.total || 0));
    const used = Math.max(0, Number(limitState.used || 0));
    const excess = Math.max(0, Number(limitState.excess || 0));
    if (total <= 0) return '';
    const percent = Math.min(100, Math.max(0, (used / total) * 100));
    return `
      <div class="credit-card-limit-summary is-compact">
        <div
          class="credit-card-limit-track"
          role="progressbar"
          aria-label="Utilização do limite"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${percent.toFixed(1)}"
        >
          <span style="width:${percent.toFixed(1)}%"></span>
        </div>
        <div class="credit-card-limit-caption">${fmt(used)} de ${fmt(total)}${excess > 0 ? ` · excedido ${fmt(excess)}` : ''}</div>
      </div>
    `;
  }

  function cardHeroSlideHtml(card, i) {
    const available = cardHeroLimitAvailable(card);
    const hasLimit = Number(card.limit || 0) > 0;
    const inactive = card.active === false;
    const delta = i - cardHeroState.index;
    const pos = delta === 0 ? '0' : delta === 1 ? 'next' : delta === -1 ? 'prev' : 'far';
    return `<div class="card-hero-slide" data-pos="${pos}">
      <div class="card-hero-top">
        <span class="card-hero-chip" aria-hidden="true"></span>
        <span class="card-hero-status ${inactive ? 'is-off' : 'is-on'}">${inactive ? 'Inativo' : 'Ativo'}</span>
      </div>
      <div class="card-hero-main">
        <span class="card-hero-name">${escapeHTML(card.name)}</span>
        <span class="card-hero-meta">${escapeHTML(cardBankName(card))}${card.titular ? ' · ' + escapeHTML(card.titular) : ''}</span>
      </div>
      ${cardHeroLimitBarHtml(card, hasLimit)}
      <div class="card-hero-foot">
        <div>
          <span>Limite disponível</span>
          <strong>${hasLimit && available !== null ? fmt(available) : '—'}</strong>
        </div>
        <div>
          <span>Fecha dia</span>
          <strong>${Number(card.closingDay || 0) || '—'}</strong>
        </div>
        <div>
          <span>Vence dia</span>
          <strong>${Number(card.dueDay || 0) || '—'}</strong>
        </div>
      </div>
    </div>`;
  }

  /* Listeners presos uma única vez ao contêiner (o innerHTML só é refeito quando
     a lista de cartões muda; a posição troca via CSS, animada). */
  function ensureCardHeroBindings() {
    const hero = document.getElementById('cardHero');
    if (!hero || cardHeroState.bound) return;
    cardHeroState.bound = true;

    const getTrack = () => hero.querySelector('.card-hero-track');
    /* Passo do gesto = largura do viewport (os slides estão empilhados). */
    const slideStep = () => {
      const viewport = hero.querySelector('.card-hero-viewport');
      return (viewport && viewport.getBoundingClientRect().width) || 1;
    };

    hero.addEventListener('pointerdown', e => {
      if (e.target.closest('.card-hero-dots')) return;
      const track = getTrack();
      if (cards.length < 2 || !track) return;
      cardHeroState.dragging = true;
      cardHeroState.startX = e.clientX;
      cardHeroState.delta = 0;
      cardHeroState.width = slideStep();
      track.classList.add('is-dragging');
      if (typeof hero.setPointerCapture === 'function') {
        try { hero.setPointerCapture(e.pointerId); } catch (err) { /* captura opcional */ }
      }
    });

    hero.addEventListener('pointermove', e => {
      if (!cardHeroState.dragging) return;
      const track = getTrack();
      if (!track) return;
      cardHeroState.delta = e.clientX - cardHeroState.startX;
      const width = cardHeroState.width || 1;
      let dx = cardHeroState.delta;
      if (cardHeroState.index === 0 && dx > 0) dx *= 0.35;               /* resistência na borda inicial */
      else if (cardHeroState.index === cards.length - 1 && dx < 0) dx *= 0.35; /* resistência na borda final */

      /* Estilo de arrasto (Google Wallet): o ativo segue o dedo na horizontal e
         o cartão de trás sobe da pilha para o centro conforme o progresso. */
      const progress = Math.min(1, Math.abs(dx) / width);
      const slides = hero.querySelectorAll('.card-hero-slide');
      const active = slides[cardHeroState.index];
      const incoming = slides[cardHeroState.index + (dx < 0 ? 1 : -1)];
      if (active) active.style.transform = `translateX(${dx.toFixed(1)}px) scale(${(1 - progress * 0.05).toFixed(4)})`;
      if (incoming) incoming.style.transform = `translateY(${(-14 * (1 - progress)).toFixed(1)}px) scale(${(0.94 + 0.06 * progress).toFixed(4)})`;
    });

    const endDrag = () => {
      if (!cardHeroState.dragging) return;
      cardHeroState.dragging = false;
      const track = getTrack();
      const before = cardHeroState.index;
      const threshold = Math.min(64, (cardHeroState.width || 1) * 0.2);
      if (cardHeroState.delta <= -threshold) cardHeroState.index += 1;
      else if (cardHeroState.delta >= threshold) cardHeroState.index -= 1;
      cardHeroState.index = cardHeroClampIndex(cardHeroState.index);
      cardHeroState.delta = 0;
      if (track) track.classList.remove('is-dragging'); /* religa a transição */
      hero.querySelectorAll('.card-hero-slide').forEach(slide => slide.style.removeProperty('transform'));
      if (before !== cardHeroState.index) applyCardHeroPosition();
    };
    hero.addEventListener('pointerup', endDrag);
    hero.addEventListener('pointercancel', endDrag);

    hero.addEventListener('click', e => {
      const dot = e.target.closest('.card-hero-dots button');
      if (!dot) return;
      const target = Number(dot.dataset.index);
      if (!Number.isFinite(target)) return;
      cardHeroState.index = cardHeroClampIndex(Math.round(target));
      applyCardHeroPosition();
    });
  }

  /* Sincroniza a grade da aba Cartões: só a caixa do cartão selecionado no
     hero fica visível; as demais ficam ocultas até o hero trocar. */
  function syncCardHeroGridSelection() {
    const container = document.getElementById('cardsGrid');
    if (!container) return;
    const boxes = container.querySelectorAll('.credit-card-box[data-card-index]');
    for (let i = 0; i < boxes.length; i++) {
      const selected = Number(boxes[i].dataset.cardIndex) === cardHeroState.index;
      if (selected) boxes[i].removeAttribute('hidden');
      else boxes[i].setAttribute('hidden', '');
    }
  }

  /* Atualiza posição/profundidade sem reconstruir o DOM — é isso que permite
     a transição fluida entre os cartões. */
  function applyCardHeroPosition() {
    const hero = document.getElementById('cardHero');
    if (!hero) return;
    const slides = hero.querySelectorAll('.card-hero-slide');
    for (let i = 0; i < slides.length; i++) {
      const delta = i - cardHeroState.index;
      const pos = delta === 0 ? '0' : delta === 1 ? 'next' : delta === -1 ? 'prev' : 'far';
      if (slides[i].dataset.pos !== pos) slides[i].dataset.pos = pos;
    }
    const dots = hero.querySelectorAll('.card-hero-dots button');
    for (let i = 0; i < dots.length; i++) {
      const active = i === cardHeroState.index;
      dots[i].classList.toggle('is-active', active);
      dots[i].setAttribute('aria-current', String(active));
    }
    syncCardHeroGridSelection();
  }

  function renderCardHero() {
    const hero = document.getElementById('cardHero');
    if (!hero) return;
    ensureCardHeroBindings();
    if (!cards.length) {
      hero.hidden = true;
      hero.innerHTML = '';
      cardHeroState.index = 0;
      cardHeroState.started = false;
      cardHeroState.key = '';
      return;
    }
    if (cardHeroState.dragging) return; /* termina o gesto antes de reconstruir */
    if (!cardHeroState.started) {
      const activeIndex = cards.findIndex(c => c.active !== false);
      cardHeroState.index = activeIndex >= 0 ? activeIndex : 0;
      cardHeroState.started = true;
    }
    cardHeroState.index = cardHeroClampIndex(cardHeroState.index);

    const key = cards.map(c => c.id).join('|');
    if (cardHeroState.key !== key || !hero.querySelector('.card-hero-track')) {
      cardHeroState.key = key;
      hero.hidden = false;
      hero.innerHTML = `
        <div class="card-hero-viewport">
          <div class="card-hero-track">
            ${cards.map(cardHeroSlideHtml).join('')}
          </div>
        </div>
        ${cards.length > 1 ? `<div class="card-hero-dots" role="group" aria-label="Selecionar cartão">
          ${cards.map((c, i) => `<button type="button" data-index="${i}" class="${i === cardHeroState.index ? 'is-active' : ''}" aria-label="${escapeHTML(c.name || ('Cartão ' + (i + 1)))}" aria-current="${i === cardHeroState.index}"></button>`).join('')}
        </div>` : ''}`;
    }
    applyCardHeroPosition();
  }

  function renderCards() {
    renderCardHero();
    const container = document.getElementById('cardsGrid');
    if (!container) return;
    if (!cards.length) {
      container.innerHTML = '<div class="empty" style="grid-column:1 / -1;">Nenhum cartão cadastrado. Clique em “+ Novo Cartão” para começar.</div>';
      return;
    }
    container.innerHTML = cards.map((card, index) => {
      const cardPurchases = purchases.filter(p => p.cardId === card.id).sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')));

      if (
        !window.LivroCaixaCardEngineV3 ||
        typeof window.LivroCaixaCardEngineV3.invoice !== 'function'
      ) {
        throw new Error('CardEngine não disponível para renderCards.');
      }

      const concludedMap = buildConcludedMap(cardPurchases);
      const activePurchases = cardPurchases.filter(p => !purchaseIsConcluded(p, concludedMap));
      const donePurchases = cardPurchases.filter(p => purchaseIsConcluded(p, concludedMap));

      const nav = cardInvoiceNavState(card);
      const period = nav.selected;
      const dueMonth = dueMonthKeyForClosingPeriod(card, period);

      const invoice = window.LivroCaixaCardEngineV3.invoice(
        card.id,
        period,
        purchases,
        cards,
        invoiceLaunches
      );
      return `<article class="credit-card-box credit-card-sheet ${card.active === false ? 'is-inactive' : ''}" data-card-index="${index}"${index === cardHeroState.index ? '' : ' hidden'}>
        <div class="credit-card-invoice-block">
          <div class="credit-card-invoice-head">
            <span class="credit-card-invoice-icon" aria-hidden="true"><i class="fi fi-rr-file-invoice-dollar"></i></span>
            <div class="credit-card-invoice-copy">
              <strong>Fatura de ${invoicePeriodLabel(dueMonth)}</strong>
              <span class="hint">${invoice.count} compra(s)/parcela(s) neste período. Cálculo automático</span>
            </div>
            ${Number(invoice.carriedOut || 0) > 0.004 ? `<span class="bill-status is-carried" title="Saldo em aberto levado para a fatura seguinte">Seguinte</span>` : ''}
            <strong class="credit-card-invoice-total">${fmt(Number(invoice.payableTotal || 0) > 0 ? invoice.payableTotal : invoice.total)}</strong>
          </div>
          ${Number(invoice.carry || 0) > 0.004 ? `<div class="hint invoice-carry-line">Saldo anterior em aberto: <strong>${fmt(invoice.carry)}</strong></div>` : ''}
          <div class="credit-card-invoice-nav">
            <button type="button" class="credit-card-invoice-nav-btn" onclick="shiftCardInvoice('${card.id}', -1)" aria-label="Fatura anterior" ${nav.canPrev ? '' : 'disabled'}>‹</button>
            <span class="credit-card-invoice-range">${invoiceCycleLabel(card, period)} · vence ${(invoiceDueDateForPeriod(card, period) || '').split('-').reverse().join('/')}</span>
            ${nav.selected !== nav.current ? `<button type="button" class="credit-card-invoice-reset" onclick="resetCardInvoice('${card.id}')" aria-label="Voltar para a fatura atual">Atual</button>` : ''}
            <button type="button" class="credit-card-invoice-nav-btn" onclick="shiftCardInvoice('${card.id}', 1)" aria-label="Próxima fatura" ${nav.canNext ? '' : 'disabled'}>›</button>
          </div>
          ${invoice.lines.length ? `
          <button type="button" class="credit-card-invoice-toggle" onclick="this.closest('.credit-card-invoice-block').classList.toggle('is-open')">Ver parcelas</button>
          <div class="credit-card-invoice-lines">
            ${invoice.lines.map(line => `<div class="credit-card-invoice-line"><span>${escapeHTML(line.purchase.description || 'Compra')}${line.totalInstallments>1?` (${line.installmentNumber}/${line.totalInstallments})`:''}${line.purchase.titular?' · '+escapeHTML(line.purchase.titular):''}</span><span>${fmt(line.amount)}</span></div>`).join('')}
          </div>` : ''}
        </div>

        ${Array.isArray(invoice.titulars) && invoice.titulars.length ? `
        <div class="credit-card-engine-summary">
          <div class="credit-card-titular-summary">
            <div class="credit-card-summary-title">Resumo por titular</div>

            <div class="credit-card-titular-list">
              ${invoice.titulars.map(t => `
                <div class="credit-card-titular-row">
                  <div class="credit-card-titular-main">
                    <div class="credit-card-titular-name">
                      <strong>${escapeHTML(t.titular)}</strong>
                      <span>${t.count || 0} lançamento(s)</span>
                    </div>
                    ${Number(t.carry || 0) > 0.004 ? `<span class="hint invoice-carry-line">Saldo anterior: <strong>${fmt(t.carry)}</strong></span>` : ''}
                  </div>

                  <div class="credit-card-titular-values">
                    <span>Total <b>${fmt(Number(t.payableTotal != null ? t.payableTotal : t.total))}</b></span>
                    <span>Pago <b>${fmt(Number(t.payablePaid != null ? t.payablePaid : t.paid))}</b></span>
                    <span>Restante <b>${fmt(Number(t.payableRemaining != null ? t.payableRemaining : t.remaining))}</b></span>
                  </div>

                  <span class="credit-card-titular-status is-${String(t.payableStatus || t.status || 'Pendente').toLowerCase().replace(/[^a-z]+/g, '-')}">
                    ${escapeHTML(t.payableStatus || t.status || 'Pendente')}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        ` : ''}

        <div class="credit-card-purchases${purchasesUiState.expanded.has(card.id) ? ' is-expanded' : ''}">
          <div class="credit-card-purchases-head">
            <strong>Compras</strong>
            <div class="credit-card-purchases-actions">
              <button type="button" class="credit-card-pill" onclick="togglePurchaseDetail(this, '${card.id}')">Detalhar</button>
              <button type="button" class="credit-card-pill primary" onclick="openPurchaseModal('${card.id}')" ${card.active === false ? 'disabled' : ''}>+ Compra</button>
            </div>
          </div>
          ${(() => {
            const doneAccordion = donePurchases.length ? `<details class="purchases-done-accordion"${purchasesUiState.doneOpen.has(card.id) ? ' open' : ''} ontoggle="togglePurchaseDone('${card.id}', this.open)">
              <summary class="purchases-done-summary"><i class="fi fi-rr-check-circle" aria-hidden="true"></i>Compras concluídas (${donePurchases.length})</summary>
              <div class="purchases-done-body">${donePurchases.map(p => purchaseRowHtml(p, concludedMap)).join('')}</div>
            </details>` : '';
            if (!cardPurchases.length) return '<div class="credit-card-empty">Nenhuma compra vinculada a este cartão.</div>';
            return activePurchases.map(p => purchaseRowHtml(p, concludedMap)).join('') + doneAccordion;
          })()}
        </div>
        <div class="credit-card-footer-actions">
          <button type="button" class="credit-card-footer-btn" onclick="editCard('${card.id}')"><i class="fi fi-rr-edit" aria-hidden="true"></i>Editar</button>
          <button type="button" class="credit-card-footer-btn" onclick="toggleCardActive('${card.id}')">${card.active === false ? '<i class="fi fi-rr-toggle-on" aria-hidden="true"></i>Ativar' : '<i class="fi fi-rr-toggle-off" aria-hidden="true"></i>Desativar'}</button>
        </div>
      </article>`;
    }).join('');
  }

  function openNewCardModal() { openCardModal(); }

  function openNewInvestModal() {
    editingInvestId = null;
    pendingPricePoint = null;
    document.getElementById('iNome').value = '';
    document.getElementById('iApelido').value = '';
    document.getElementById('iCoinGeckoId').value = '';
    document.getElementById('iTipo').value = 'Stablecoin';
    document.getElementById('iUnidades').value = '';
    document.getElementById('iUnidadesAtual').value = '';
    setMoneyInput('iCotacao', 0);
    setMoneyInput('iValor', 0);
    setMoneyInput('iValorSimples', 0);
    setMoneyInput('iValorAtualSimples', 0);
    document.getElementById('iInstituicao').value = '';
    document.getElementById('iTaxa').value = '';
    document.getElementById('iVencimento').value = '';
    updateInvestFormLayout();
    document.getElementById('panelInvestTitle').innerHTML = 'Novo Ativo / Cripto <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('iSalvar').textContent = 'Salvar Ativo';
    openModal('panelInvest');
  }

  /* Abre o painel de bancos em modo "novo" (zera o formulário antes).
     Ponto de entrada desde a saída do botão "Banco" da toolbar: chamado pelo
     card "Bancos" da faixa de saldos (sempre renderizado, inclusive sem bancos).
     A ramificação `action === 'banks'` do drawer também aponta para cá, mas hoje
     nenhum item do drawer emite essa ação — mantida por compatibilidade. */
  function openBankManagementPanel() {
    editingBankId = null;
    document.getElementById('bNome').value = '';
    setMoneyInput('bSaldo', 0);
    document.getElementById('panelBancoTitle').innerHTML = 'Gerenciar Bancos <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('bSalvar').textContent = 'Adicionar';
    openModal('panelBanco');
  }

  /* V.20-01 — o corpo do salvamento foi extraído para função nomeada,
     com comportamento IDÊNTICO ao handler anterior, para que a revisão de
     anexo reutilize o MESMO fluxo de criação de movimentação: validação,
     cálculo, saldo, persistência, eventos e tratamento de erro.
     Nenhuma segunda implementação de movimentação foi criada. */
  async function saveMovementFromForm() {
    const btn = document.getElementById('fSalvar');
    const dateInput = document.getElementById('fData').value;

    if (receiptReaderState?.aiStatus === 'completed' && !dateInput) {
      showToast('A data do comprovante não foi identificada. Informe a data antes de salvar.', 'error');
      return false;
    }

    const date = dateInput || todayISO();
    const desc = document.getElementById('fDesc').value.trim();
    const bank = document.getElementById('fBanco').value;
    const catValue = document.getElementById('fCategoria').value;
    const [category, subcategory] = catValue.includes('::') ? catValue.split('::') : [catValue, ''];
    const valor = readMoneyInput('fValor');

    if (!desc || isNaN(valor) || valor <= 0) {
      showToast('Preencha a descrição e um valor válido.', 'error');
      return false;
    }

    if (!editingEntryId) {
      const possibleDuplicate = entries.find(e =>
        e.date === date && e.bank === bank && e.category === category &&
        e.type === currentType && Math.abs(Number(e.amount) - valor) < 0.005 &&
        e.desc.trim().toLocaleLowerCase('pt-BR') === desc.toLocaleLowerCase('pt-BR')
      );
      if (possibleDuplicate) {
        const confirmDup = confirm('Já existe um lançamento igual a este nesta mesma data, banco e categoria. Deseja lançar mesmo assim?');
        if (!confirmDup) return false;
      }
    }

    const operation = beginLogOperation('Livro-Caixa', editingEntryId ? 'Editar lançamento' : 'Salvar lançamento');
    logInfo('Livro-Caixa', editingEntryId ? 'Editar lançamento' : 'Salvar lançamento', 'Em andamento', 'Operação de lançamento iniciada.', null, operation);
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Salvando...';

    if (editingEntryId) {
      const idx = entries.findIndex(e => e.id === editingEntryId);
      if (idx !== -1) {
        const prev = entries[idx];
        const bankLabel = id => banks.find(b => b.id === id)?.name || 'Banco não informado';
        const catLabel = id => categories.find(c => c.id === id)?.name || 'Sem categoria';
        const changes = [];
        if (prev.date !== date) changes.push({ field: 'Data', from: prev.date, to: date });
        if (String(prev.desc ?? '') !== desc) changes.push({ field: 'Descrição', from: prev.desc, to: desc });
        if (prev.bank !== bank) changes.push({ field: 'Banco', from: bankLabel(prev.bank), to: bankLabel(bank) });
        if (prev.category !== category) changes.push({ field: 'Categoria', from: catLabel(prev.category), to: catLabel(category) });
        if (Number(prev.amount ?? 0) !== Number(valor)) changes.push({ field: 'Valor', from: Number(prev.amount ?? 0), to: Number(valor) });
        const prevType = prev.type === 'in' ? 'Entrada' : 'Saída';
        const nextType = currentType === 'in' ? 'Entrada' : 'Saída';
        if (prevType !== nextType) changes.push({ field: 'Tipo', from: prevType, to: nextType });
        const subLabel = (catId, subId) => {
          if (!subId) return '—';
          const parent = categories.find(x => x.id === catId);
          const sub = parent && Array.isArray(parent.subcategories) ? parent.subcategories.find(s => s.id === subId) : null;
          return sub ? `${parent.name} › ${sub.name}` : '—';
        };
        if (String(prev.subcategory || '') !== String(subcategory || '')) {
          changes.push({ field: 'Subcategoria', from: subLabel(prev.category, prev.subcategory), to: subLabel(category, subcategory) });
        }
        // Preserva campos extras (history, recurringBillId, automated...) — o objeto antigo era reescrito só com 7 campos.
        const next = { ...prev, date, desc, bank, category, amount: valor, type: currentType, subcategory };
        if (changes.length) appendEntryHistory(next, { action: 'update', by: 'user', changes });
        entries[idx] = next;
      }
      editingEntryId = null;
    } else {
      const newEntry = { id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7), date, desc, bank, category, amount: valor, type: currentType, subcategory };
      appendEntryHistory(newEntry, { action: 'create', by: 'user' });
      entries.push(newEntry);
    }

    populateFilterControls();
    render();
    try {
      await saveEntries(operation);
      logInfo('Livro-Caixa','Salvar lançamento','Sucesso','Movimentação registrada.',{type: currentType}, operation);
      clearReceiptReaderState();
      document.getElementById('fDesc').value = '';
      setMoneyInput('fValor', 0);
      closeAllPanels();
      return true;
    } catch (err) {
      logSyncError('lançamento', err, operation);
      return false;
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
      render();
    }
  }
