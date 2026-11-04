/* LIVRO-CAIXA · js/24-automation-render.js — automação e render de componentes (app.js: 8287-8859). Separação por responsabilidade; conteúdo preservado. */


  function renderReconciliationHistory() {
    const historyKey = 'reconciliationHistory';
    const list = document.getElementById('reconciliationHistoryList');
    const historyDiv = document.getElementById('reconciliationHistory');
    if (!list || !historyDiv) return;

    try {
      const stored = localStorage.getItem('reconciliationHistory');
      const history = stored ? JSON.parse(stored) : [];

      if (history.length === 0) {
        historyDiv.hidden = true;
        return;
      }

      historyDiv.hidden = false;
      list.innerHTML = history.map(item => `
        <div class="reconciliation-history-item">
          <span class="history-date">${escapeHTML(item.date)}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
            <span class="history-bank" style="font-weight:600;color:var(--ink);font-size:12px;">${escapeHTML(item.bankName)}</span>
            <span class="history-diff ${item.difference > 0 ? 'positive' : (item.difference < 0 ? 'negative' : 'zero')}" style="font-weight:600;font-size:11px;color:${item.difference > 0 ? 'var(--color-red)' : (item.difference < 0 ? 'var(--color-green)' : 'var(--color-green)')};">
              ${item.difference === 0 ? '✓ Conciliado' : (item.difference > 0 ? '+' : '') + fmt(Math.abs(item.difference))}
            </span>
          </div>
        </div>
      `).join('');
    } catch (err) {
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
    }
  }

  async function autoGenerateRecurringBills() {
    if (!currentUser) { return 0; }
    const now = new Date(); const key = billMonthKey(now); const year = now.getFullYear(); const month = now.getMonth(); const candidates = recurringBills.filter(bill => billAppliesToMonth(bill, year, month) && !billGeneratedForMonth(bill, key) && bill.bank && bill.bank !== 'a-definir');
    if (!candidates.length) return 0;
    let created = 0;
    const generatedEntryIds = [];
    const previousStates = candidates.map(bill => ({ bill, generatedMonths: Array.isArray(bill.generatedMonths) ? bill.generatedMonths.slice() : [] }));
    candidates.forEach(bill => { const date = billDueDateForMonth(bill, year, month); const entryId = 'auto' + Date.now() + Math.random().toString(36).slice(2, 8); generatedEntryIds.push(entryId); const entry = { id: entryId, date, desc: `${bill.name} (automático)`, bank: bill.bank, category: bill.category || categories[0]?.id || '', amount: Number(bill.amount) || 0, type: 'out', recurringBillId: bill.id, automated: true }; appendEntryHistory(entry, { action: 'create', by: 'auto' }); entries.push(entry); bill.generatedMonths = Array.isArray(bill.generatedMonths) ? bill.generatedMonths : []; bill.generatedMonths.push(key); created++; });
    try {
      await persistAll();
    } catch (err) {
      entries = entries.filter(item => !generatedEntryIds.includes(item.id));
      previousStates.forEach(({ bill, generatedMonths }) => { bill.generatedMonths = generatedMonths; });
      created = 0;
    }
    render(); renderBills(); return created;
  }
  async function runFeatureAutomation({ manual = false } = {}) {
    if (!currentUser) { return { generated: 0, skipped: true }; }
    if (manual && !window.confirm('Executar agora o ciclo de teste? A geração de contas recorrentes pode criar lançamentos financeiros reais e as cotações podem ser atualizadas.')) return { generated: 0, cancelled: true };
    let generated = 0;
    if (featureSettings.autoLaunchRecurring || manual) generated = await autoGenerateRecurringBills();
    if (featureSettings.autoRefreshQuotes || manual) { try { await updateAllInvestmentPrices({ auto: !manual }); } catch (err) {} }
    renderNotifications(); renderAdvancedDashboard(); renderDashboardTab(); return { generated };
  }
  function startFeatureAutomation() {
    if (featureAutomationTimer) { clearInterval(featureAutomationTimer); featureAutomationTimer = null; }
    if (!currentUser) return;
    if (!featureSettings.autoLaunchRecurring && !featureSettings.autoRefreshQuotes) return;
    const minutes = Math.min(1440, Math.max(1, Number(featureSettings.quoteRefreshMinutes) || 15));
    featureAutomationTimer = setInterval(() => { runFeatureAutomation({ manual: false }); }, minutes * 60000);
  }

  function render() {
    updatePeriodUI();
    renderBalances();
    renderBankSelects();
    renderBankManageList();
    renderCategorySelect();
    renderCategoryManageList();
    renderCategorySummary();
    renderAdvancedDashboard();
    renderDashboardTab();
    renderLedger();
    renderInvestments();
    renderPocketBalances();
    renderPockets();
    renderCards();
    renderPeriodSummaries();
    renderNotifications();
  }

  function refreshFilteredViews() { renderCategorySummary(); renderLedger(); }

  let yieldTarget;
 // legado: usado pelos registros antigos de rendimento
  let editingYieldId;

  let investmentMovementEditingId;

  let pocketMovementTarget;
 // { kind, id }
  let pocketMovementEditingId;


  function updateInvestmentMovementUI() {
    if (!investmentMovementTarget) return;
    const kind = investmentMovementTarget.kind;
    const item = investments.find(x => x.id === investmentMovementTarget.id);
    const isYield = kind === 'rendimento';
    const isCrypto = item && isCryptoType(item.type);
    document.getElementById('imAporte').classList.toggle('active-in', kind === 'aporte');
    document.getElementById('imResgate').classList.toggle('active-out', kind === 'resgate');
    document.getElementById('imRendimento').classList.toggle('active-yield', isYield);
    document.getElementById('imDataLabel').textContent = 'Data';
    const label = movementKindLabel(kind);
    const verb = investmentMovementEditingId ? 'Atualizar' : 'Registrar';
    document.getElementById('panelInvestMovementTitle').innerHTML = `${verb} ${label} — ${item ? escapeHTML(item.alias || item.name) : ''} <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('imSalvar').textContent = `${verb} ${label}`;
    document.getElementById('imValor').readOnly = isCrypto;
    document.getElementById('imValor').placeholder = isCrypto ? 'Calculado pela quantidade × cotação' : '0,00';
    document.getElementById('imCryptoQuantityField').style.display = isCrypto ? 'block' : 'none';
    document.getElementById('imCryptoQuoteField').style.display = isCrypto ? 'block' : 'none';
    document.getElementById('imPriceStatus').style.display = isCrypto ? 'block' : 'none';
    const qtyInput = document.getElementById('imQuantidade');
    const qtyLabel = document.getElementById('imQuantidadeLabel');
    if (item && isBitcoinType(item.type)) {
      qtyLabel.textContent = 'Quantidade em SATS';
      qtyInput.step = '1';
      qtyInput.placeholder = 'Ex: 500';
    } else {
      qtyLabel.textContent = 'Quantidade';
      qtyInput.step = '0.00000001';
      qtyInput.placeholder = 'Ex: 0.50';
    }
  }

  function setInvestmentMovementDefaults() {
    document.getElementById('imData').value = todayISO();
    document.getElementById('imQuantidade').value = '';
    setMoneyInput('imCotacao', 0);
    setMoneyInput('imValor', 0);
    document.getElementById('imDesc').value = '';
    document.getElementById('imPriceStatus').innerHTML = 'Digite a cotação manualmente ou clique no botão <i class="fi fi-rr-refresh" aria-hidden="true"></i> para buscar pela internet.';
  }

  function updateInvestmentMovementValue() {
    const item = investmentMovementTarget ? investments.find(x => x.id === investmentMovementTarget.id) : null;
    const rawQty = parseFloat(document.getElementById('imQuantidade').value) || 0;
    const qty = item && isBitcoinType(item.type) ? Math.round(rawQty) : rawQty;
    const price = readMoneyInput('imCotacao');
    setMoneyInput('imValor', qty > 0 && price > 0 ? cryptoValueFromUnits(item ? item.type : null, qty, price) : 0);
  }

  async function fetchInvestmentMovementPrice() {
    if (!investmentMovementTarget) return;
    const item = investments.find(x => x.id === investmentMovementTarget.id);
    const statusEl = document.getElementById('imPriceStatus');
    if (!item) return;
    statusEl.textContent = 'Buscando cotação...';
    const fetchIcon = document.querySelector('#imFetchPrice .fi');
    fetchIcon?.classList.add('is-loading');
    try {
      const coin = await fetchCoinMatch(item.name);
      if (!coin) { statusEl.textContent = 'Ativo não encontrado. Não foi possível buscar a cotação.'; return; }
      const price = await fetchCoinPriceBRL(coin.id);
      if (!price) { statusEl.textContent = 'Cotação indisponível no momento.'; return; }
      setMoneyInput('imCotacao', price);
      updateInvestmentMovementValue();
      statusEl.textContent = `1 ${coin.symbol.toUpperCase()} = ${fmt(price)} · atualizado agora`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Erro ao buscar cotação. Verifique sua conexão.';
    } finally {
      fetchIcon?.classList.remove('is-loading');
    }
  }

  function updatePocketMovementUI() {
    if (!pocketMovementTarget) return;
    const kind = pocketMovementTarget.kind;
    const item = pockets.find(x => x.id === pocketMovementTarget.id);
    const isYield = kind === 'rendimento';
    document.getElementById('pmAporte').classList.toggle('active-in', kind === 'aporte');
    document.getElementById('pmResgate').classList.toggle('active-out', kind === 'resgate');
    document.getElementById('pmRendimento').classList.toggle('active-yield', isYield);
    document.getElementById('pmDataLabel').textContent = 'Data';
    const label = movementKindLabel(kind);
    const verb = pocketMovementEditingId ? 'Atualizar' : 'Registrar';
    document.getElementById('panelPocketMovementTitle').innerHTML = `${verb} ${label} — ${item ? escapeHTML(item.name) : ''} <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('pmSalvar').textContent = `${verb} ${label}`;
  }

  function setPocketMovementMode(kind) {
    if (!pocketMovementTarget) return;
    pocketMovementTarget.kind = ['aporte','resgate','rendimento'].includes(kind) ? kind : 'aporte';
    updatePocketMovementUI();
  }

  function loadInvestmentMovementForEdit(y) {

    const item = investments.find(i => i.id === y.targetId);
    if (!item) return;
    investmentMovementTarget = { kind: ['aporte','resgate','rendimento'].includes(y.kind) ? y.kind : 'rendimento', id: y.targetId };
    investmentMovementEditingId = y.id;
    document.getElementById('imData').value = y.date || todayISO();

    document.getElementById('imQuantidade').value = y.units != null ? y.units : '';
    setMoneyInput('imCotacao', y.price || 0);
    setMoneyInput('imValor', y.amount || 0);
    document.getElementById('imDesc').value = y.desc || '';
    updateInvestmentMovementUI();
    document.getElementById('imPriceStatus').textContent = y.price ? `Cotação registrada: ${fmt(y.price)} · pode ser alterada manualmente` : 'Cotação não registrada. Você pode digitá-la manualmente.';
    if (isCryptoType(item.type)) updateInvestmentMovementValue();
    openModal('panelInvestMovement');
    const focusFieldId = isCryptoType(item.type) ? 'imQuantidade' : 'imValor';
    setTimeout(() => document.getElementById(focusFieldId)?.focus(), 80);
  }

  function loadPocketMovementForEdit(y) {
    const item = pockets.find(x => x.id === y.targetId);
    if (!item) return;
    pocketMovementTarget = { kind: ['aporte','resgate','rendimento'].includes(y.kind) ? y.kind : 'aporte', id: y.targetId };
    pocketMovementEditingId = y.id;
    document.getElementById('pmData').value = y.date || todayISO();
    setMoneyInput('pmValor', y.amount || 0);
    document.getElementById('pmDesc').value = y.desc || '';
    updatePocketMovementUI();
    document.getElementById('panelPocketMovementTitle').innerHTML = `Editar ${movementKindLabel(y.kind || 'aporte')} — ${escapeHTML(item.name)} <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('pmSalvar').textContent = `Atualizar ${movementKindLabel(y.kind || 'aporte')}`;
    openModal('panelPocketMovement');
  }

  function movementDelta(y) {
    const amount = Number(y.amount) || 0;
    return (y.kind === 'resgate' ? -1 : 1) * amount;
  }
  function fixedIncomeMovementTotal(item) {
    return yieldsLog
      .filter(y => y.targetType === 'invest' && y.targetId === item.id)
      .reduce((sum, y) => sum + movementDelta(y), 0);
  }
  function fixedIncomeInitialValue(item) {
    if (Number.isFinite(Number(item.initialValue))) return Number(item.initialValue);
    // Compatibilidade: registros antigos usavam item.value como saldo acumulado.
    return Number(item.value || 0) - fixedIncomeMovementTotal(item);
  }
  function fixedIncomeCurrentValue(item) {
    return Math.max(0, fixedIncomeInitialValue(item) + fixedIncomeMovementTotal(item));
  }
  function syncDerivedInvestmentValue(item) {
    if (item && item.type === 'Renda Fixa') item.value = fixedIncomeCurrentValue(item);
    return item;
  }

  function openModal(panelId) {
    closeFilterChoice();
    const overlay = document.getElementById('modalOverlay');
    // Fecha TODOS os painéis antes de abrir um (evita modais lado a lado)
    document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open'));
    const panel = document.getElementById(panelId);
    if (!panel) {
      console.warn('[openModal] painel não encontrado:', panelId);
      return;
    }
    if (!panel.classList.contains('open')) {
      panel.classList.add('open');
    }
    if (!panel.hasAttribute('role')) panel.setAttribute('role', 'dialog');
    if (!panel.hasAttribute('aria-modal')) panel.setAttribute('aria-modal', 'true');
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
      const titleEl = panel.querySelector('h3');
      if (titleEl) {
        const clone = titleEl.cloneNode(true);
        clone.querySelectorAll('button').forEach((b) => b.remove());
        const label = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        if (label) panel.setAttribute('aria-label', label);
      }
    }
    if (overlay) overlay.classList.add('open');
    if (panelId === 'panelNovo' && typeof updateCategoryTriggerLabel === 'function') updateCategoryTriggerLabel();
    setTimeout(() => {
      if (!panel.classList.contains('open') || panel.contains(document.activeElement)) return;
      /* data-no-autofocus: focar o <div tabindex=-1> do painel (não abre o
         teclado no mobile). Usado nos painéis de gerenciamento (banco,
         categoria) em que focar o input derruba o teclado automático. */
      if (panel.hasAttribute('data-no-autofocus')) {
        panel.focus();
        return;
      }
      const target = panel.querySelector('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([readonly]), textarea, select:not([aria-hidden="true"])');
      if (target && typeof target.focus === 'function') target.focus();
      else panel.focus();
    }, 80);
  }

  function openCustomPeriodModal() {
    closeFilterChoice();
    const overlay = document.getElementById('modalOverlay');
    if (!overlay) return;
    
    const modalHtml = `
      <div class="panel" id="panelCustomPeriod">
        <h3>Período personalizado <button type="button" class="modal-close" onclick="closeAllPanels()" aria-label="Fechar">×</button></h3>
        <div class="form-grid">
          <div>
            <label for="customPeriodStart">Início</label>
            <input type="date" id="customPeriodStart" value="${dashFilters.customStart || ''}">
          </div>
          <div>
            <label for="customPeriodEnd">Fim</label>
            <input type="date" id="customPeriodEnd" value="${dashFilters.customEnd || ''}">
          </div>
          <div style="grid-column:1/-1; display:flex; gap:8px; margin-top:4px;">
            <button type="button" onclick="closeAllPanels()" style="flex:1;">Cancelar</button>
            <button type="button" class="primary" onclick="applyCustomPeriod()" style="flex:1;">Aplicar</button>
          </div>
        </div>
      </div>
    `;
    
    // Remove existing custom period modal if any
    const existing = document.getElementById('panelCustomPeriod');
    if (existing) existing.remove();
    
    // Insere DENTRO do overlay: os estilos .modal-overlay/.panel#modalOverlay
    // centralizam o painel; fora dele ele renderiza sem posicionamento de modal.
    overlay.insertAdjacentHTML('beforeend', modalHtml);
    openModal('panelCustomPeriod');
  }

  /* Expose para que diagnostic-log.js possa chamar após carregar eventos. */
  if (typeof window !== 'undefined') {
  }
