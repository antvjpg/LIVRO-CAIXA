/* LIVRO-CAIXA · js/25-bills-receivables.js — contas a pagar e a receber (app.js: 8926-9641). Separação por responsabilidade; conteúdo preservado. */


  let editingBillId;

  let billViewDate;

  function billMonthKey(date){ return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`; }
  function billAppliesToMonth(bill, year, month){
    if (!bill.active) return false;
    if (bill.recurrenceType === 'nao_recorrente' || bill.frequency === 'once') { const oneDate = bill.startDate ? new Date(bill.startDate + 'T00:00:00') : null; return !!oneDate && oneDate.getFullYear() === year && oneDate.getMonth() === month; }
    const start = bill.startDate ? new Date(bill.startDate+'T00:00:00') : null;
    const end = bill.endDate ? new Date(bill.endDate+'T23:59:59') : null;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month+1, 0, 23,59,59);
    return (!start || monthEnd >= start) && (!end || monthStart <= end);
  }
  function billDueDayFromStart(bill){
    return bill.startDate ? new Date(bill.startDate+'T00:00:00').getDate() : 1;
  }
  function billDueDateForMonth(bill, year, month){
    if (bill.recurrenceType === 'nao_recorrente' || bill.frequency === 'once') return bill.startDate || `${year}-${String(month+1).padStart(2,'0')}-01`;
    const lastDay = new Date(year, month+1, 0).getDate();
    const day = Math.min(Math.max(billDueDayFromStart(bill),1), lastDay);
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function billGeneratedForMonth(bill, key){ return Array.isArray(bill.generatedMonths) && bill.generatedMonths.includes(key); }
  function billPaidForMonth(bill, key){ return Array.isArray(bill.paidMonths) && bill.paidMonths.includes(key); }
  // P2.4.1 — estados independentes: Lançado (livro-caixa) vs Pago — não lançado (só status)
  function billIsOverdue(dueDateISO) {
    // Atrasada SOMENTE a partir do dia seguinte ao vencimento.
    // No dia do vencimento (due === hoje) permanece pendente.
    if (!dueDateISO) return false;
    const due = String(dueDateISO).slice(0, 10);
    const today = todayISO().slice(0, 10);
    return due < today;
  }
  function billStatus(bill, key){
    if (billGeneratedForMonth(bill, key)) return 'Lançado';
    if (billPaidForMonth(bill, key)) return 'Pago — não lançado';
    const [year, month] = key.split('-').map(Number);
    const dueDate = billDueDateForMonth(bill, year, month - 1);
    return billIsOverdue(dueDate) ? 'Atrasado' : 'Pendente';
  }
  async function markBillPaid(id, monthKey, btn=null) {
    if(btn){ btn.disabled=true; btn.textContent='Marcando...'; }
    try {
      const bill = recurringBills.find(b => b.id === id);
      if (!bill || billGeneratedForMonth(bill, monthKey)) return;
      if (!Array.isArray(bill.paidMonths)) bill.paidMonths = [];
      if (!bill.paidMonths.includes(monthKey)) bill.paidMonths.push(monthKey);
      try {
        await persistAll();
        logInfo('Calendário', 'Marcar como pago', 'Sucesso', `${bill.name} marcado como pago sem lançamento (${monthKey}).`);
      } catch (err) {
        bill.paidMonths = bill.paidMonths.filter(k => k !== monthKey);
        logSyncError('marcar conta como paga', err);
        showToast('Não foi possível salvar o status pago. Tente novamente.', 'error');
      } finally {
        renderBills();
        renderNotifications();
      }
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='Marcar pago'; }
    }
  }
  async function unmarkBillPaid(id, monthKey, btn=null) {
    if(btn){ btn.disabled=true; btn.textContent='Desmarcando...'; }
    try {
      const bill = recurringBills.find(b => b.id === id);
      if (!bill) return;
      const previous = Array.isArray(bill.paidMonths) ? bill.paidMonths.slice() : [];
      bill.paidMonths = previous.filter(k => k !== monthKey);
      try {
        await persistAll();
        logInfo('Calendário', 'Desmarcar pago', 'Sucesso', `${bill.name}: status pago removido (${monthKey}).`);
      } catch (err) {
        bill.paidMonths = previous;
        logSyncError('desmarcar conta paga', err);
        showToast('Não foi possível atualizar o status.', 'error');
      } finally {
        renderBills();
        renderNotifications();
      }
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='Desmarcar pago'; }
    }
  }

  // ===== P3.1 — Valores a Receber (independente do Livro-Caixa) =====
  let editingReceivableId;

  let RECV_STATUS_LABEL;

  function normalizeReceivableStatus(s) {
    const v = String(s || 'pendente').toLowerCase();
    return ['pendente', 'recebido', 'cancelado'].includes(v) ? v : 'pendente';
  }
  function receivableTotalsOf(list) {
    const totals = { pendingCount: 0, pendingTotal: 0, receivedTotal: 0 };
    if (!Array.isArray(list)) return totals;
    for (const item of list) {
      const status = normalizeReceivableStatus(item?.status);
      const value = Math.max(0, normalizeMoney(item?.amount));
      if (status === 'pendente') {
        totals.pendingCount += 1;
        totals.pendingTotal += value;
      } else if (status === 'recebido') {
        totals.receivedTotal += value;
      }
    }
    return totals;
  }
  function receivableStatusClass(receivable) {
    const status = normalizeReceivableStatus(receivable?.status);
    const expected = String(receivable?.expectedAt || '');
    return status === 'pendente' && expected && expected < todayISO() ? 'overdue' : '';
  }
  function openReceivableModal(id = null) {
    editingReceivableId = id;
    const item = id ? receivables.find(r => r.id === id) : null;
    document.getElementById('recvPessoa').value = item?.person || '';
    document.getElementById('recvDesc').value = item?.desc || '';
    setMoneyInput('recvValor', item?.amount || 0);
    document.getElementById('recvDataRegistro').value = item?.registeredAt || todayISO();
    document.getElementById('recvDataPrevista').value = item?.expectedAt || '';
    document.getElementById('recvStatus').value = normalizeReceivableStatus(item?.status);
    document.getElementById('recvObs').value = item?.notes || '';
    document.getElementById('panelReceivableTitle').innerHTML = `${item ? 'Editar' : 'Novo'} valor a receber <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    openModal('panelReceivable');
  }
  function renderReceivables() {
    const list = document.getElementById('receivablesList');
    const summary = document.getElementById('receivablesSummary');
    if (!list || !summary) return;
    const filter = document.getElementById('receivableStatusFilter')?.value || '';
    const rows = receivables
      .filter(r => !filter || normalizeReceivableStatus(r.status) === filter)
      .slice()
      .sort((a, b) => String(b.registeredAt || '').localeCompare(String(a.registeredAt || '')) || String(b.id || '').localeCompare(String(a.id || '')));
    const totals = receivableTotalsOf(receivables);
    summary.innerHTML = `
      <div class="balance-card"><span class="label">Pendentes</span><span class="amount">${totals.pendingCount}</span></div>
      <div class="balance-card"><span class="label">A receber</span><span class="amount">${fmt(totals.pendingTotal)}</span></div>
      <div class="balance-card"><span class="label">Já recebidos</span><span class="amount">${fmt(totals.receivedTotal)}</span></div>
      <div class="balance-card"><span class="label">Registros</span><span class="amount">${receivables.length}</span></div>`;
    if (!rows.length) {
      list.innerHTML = `<div class="empty">Nenhum valor a receber${filter ? ' neste filtro' : ''}. Use “+ Novo valor a receber”.</div>`;
      return;
    }
    list.innerHTML = rows.map(r => {
      const st = normalizeReceivableStatus(r.status);
      const stClass = receivableStatusClass(r);
      const expected = r.expectedAt ? r.expectedAt.split('-').reverse().join('/') : '—';
      const registered = r.registeredAt ? r.registeredAt.split('-').reverse().join('/') : '—';
      const actions = st === 'pendente'
        ? `<button type="button" onclick="markReceivableReceived('${r.id}')">Marcar recebido</button>
           <button type="button" onclick="cancelReceivable('${r.id}')">Cancelar</button>`
        : (st === 'recebido'
          ? `<button type="button" onclick="reopenReceivable('${r.id}')">Reabrir</button>`
          : `<button type="button" onclick="reopenReceivable('${r.id}')">Reabrir</button>`);
      return `<div class="bill-list-item receivable-item">
        <div>
          <strong>${escapeHTML(r.person || 'Sem pessoa')} · ${escapeHTML(r.desc || 'Sem descrição')}</strong>
          <div class="hint">Registro: ${registered} · Previsto: ${expected}${r.notes ? ' · ' + escapeHTML(r.notes) : ''}</div>
        </div>
        <div style="text-align:right;">
          <div class="js-money" style="font-family:'IBM Plex Mono',monospace;font-weight:700;">${fmt(r.amount)}</div>
          <span class="bill-status recv-${st} ${stClass}">${RECV_STATUS_LABEL[st]}</span>
        </div>
        <div class="bill-actions">
          ${actions}
          <button type="button" onclick="editReceivable('${r.id}')">Editar</button>
        </div>
      </div>`;
    }).join('');
  }
  async function saveReceivableRecord() {
    const person = document.getElementById('recvPessoa').value.trim();
    const desc = document.getElementById('recvDesc').value.trim();
    const amount = readMoneyInput('recvValor');
    const registeredAt = document.getElementById('recvDataRegistro').value || todayISO();
    const expectedAt = document.getElementById('recvDataPrevista').value || '';
    const status = normalizeReceivableStatus(document.getElementById('recvStatus').value);
    const notes = document.getElementById('recvObs').value.trim();
    if (!person || !desc) { showToast('Informe pessoa e descrição.', 'error'); return; }
    if (!(amount > 0)) { showToast('Informe um valor válido.', 'error'); return; }
    const base = {
      person, desc, amount, registeredAt, expectedAt, status, notes,
      updatedAt: new Date().toISOString()
    };
    if (editingReceivableId) {
      const idx = receivables.findIndex(r => r.id === editingReceivableId);
      if (idx >= 0) {
        const prev = receivables[idx];
        receivables[idx] = {
          ...prev,
          ...base,
          createdAt: prev.createdAt || registeredAt,
          receivedAt: status === 'recebido' ? (prev.receivedAt || todayISO()) : null,
          cancelledAt: status === 'cancelado' ? (prev.cancelledAt || todayISO()) : null,
          history: Array.isArray(prev.history) ? prev.history : []
        };
        if (prev.status !== status) {
          receivables[idx].history = [...(receivables[idx].history || []), { at: new Date().toISOString(), from: prev.status, to: status }];
        }
      }
    } else {
      receivables.push({
        id: 'recv' + Date.now() + Math.random().toString(36).slice(2, 7),
        createdAt: registeredAt,
        receivedAt: status === 'recebido' ? todayISO() : null,
        cancelledAt: status === 'cancelado' ? todayISO() : null,
        history: [{ at: new Date().toISOString(), from: null, to: status }],
        ...base
      });
    }
    // Não cria lançamento, evento de calendário, nem altera patrimônio
    try {
      await persistAll();
      logInfo('Valores a Receber', editingReceivableId ? 'Editar' : 'Criar', 'Sucesso', `${person} · ${desc} · ${fmt(amount)} · ${status}`);
      editingReceivableId = null;
      closeAllPanels();
      renderReceivables();
    } catch (err) {
      logSyncError('valores a receber', err);
      showToast('Não foi possível salvar. Tente novamente.', 'error');
    }
  }
  async function setReceivableStatus(id, status) {
    const idx = receivables.findIndex(r => r.id === id);
    if (idx < 0) return;
    const prev = receivables[idx];
    const next = normalizeReceivableStatus(status);
    if (normalizeReceivableStatus(prev.status) === next) return;
    receivables[idx] = {
      ...prev,
      status: next,
      updatedAt: new Date().toISOString(),
      receivedAt: next === 'recebido' ? todayISO() : null,
      cancelledAt: next === 'cancelado' ? todayISO() : null,
      history: [...(Array.isArray(prev.history) ? prev.history : []), { at: new Date().toISOString(), from: prev.status, to: next }]
    };
    try {
      await persistAll();
      logInfo('Valores a Receber', 'Alterar status', 'Sucesso', `${prev.person}: ${prev.status} → ${next}`);
      renderReceivables();
    } catch (err) {
      receivables[idx] = prev;
      logSyncError('status valores a receber', err);
      alert('Não foi possível atualizar o status.');
      renderReceivables();
    }
  }
  function populateBillForm(){
    const options = banks.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    document.getElementById('billBanco').innerHTML = `<option value="a-definir">A definir</option>${options}`;
    document.getElementById('billCategoria').innerHTML = categories.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
  }
  function updateBillInstallmentFieldsVisibility(){
    const isInstallment = document.getElementById('billParcelado').value === '1';
    document.getElementById('billParcelasFields').style.display = isInstallment ? 'block' : 'none';
    document.getElementById('billFimField').style.display = isInstallment ? 'none' : '';
    if (isInstallment) document.getElementById('billTipoOcorrencia').value = 'recorrente';
  }
  function openBillModal(id=null){
    editingBillId=id; populateBillForm();
    const bill=id?recurringBills.find(x=>x.id===id):null;
    document.getElementById('billNome').value=bill?.name||'';
    document.getElementById('billTitular').value=bill?.titular||'';
    setMoneyInput('billValor', bill?.amount||0);
    document.getElementById('billTipoOcorrencia').value=bill?.recurrenceType==='nao_recorrente'?'nao_recorrente':'recorrente';
    document.getElementById('billBanco').value=bill?.bank||'a-definir';
    document.getElementById('billCategoria').value=bill?.category||categories[0]?.id||'';
    document.getElementById('billInicio').value=bill?.startDate||todayISO();
    document.getElementById('billFim').value=bill?.endDate||'';
    document.getElementById('billAtiva').value=bill?.active===false?'0':'1';
    document.getElementById('billObs').value=bill?.desc||'';
    document.getElementById('billParcelado').value=bill?.installment?'1':'0';
    document.getElementById('billParcelasTotal').value=bill?.installmentTotal||'';
    document.getElementById('billParcelaInicial').value=bill?.installmentStart||1;
    updateBillInstallmentFieldsVisibility();
    document.getElementById('panelBillTitle').innerHTML=`${bill?'Editar':'Nova'} Conta / Fatura <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('billSalvar').textContent=bill?'Atualizar Conta / Fatura':'Salvar Conta / Fatura';
    openModal('panelBill');
  }
  let pendingBillLaunch;

  function openBillLaunchPanel(bill, monthKey){
    pendingBillLaunch = { billId: bill.id, monthKey };
    document.getElementById('billLaunchDescription').textContent = `${bill.name} · ${fmt(bill.amount)}. O banco “A definir” é temporário; selecione o banco real antes de lançar.`;
    document.getElementById('billLaunchBank').innerHTML = banks.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    openModal('panelBillLaunch');
  }
  async function launchBill(billId, monthKey, selectedBankId = null, btn=null){
    if(btn){ btn.disabled=true; btn.textContent='Lançando...'; }
    try {
      if(!currentUser) { showToast('Sessão expirada. Entre novamente para lançar.', 'error'); return; }
      const bill = recurringBills.find(b => b.id === billId);
      if (!bill) { showToast('Conta não encontrada.', 'error'); return; }
      if(billGeneratedForMonth(bill,monthKey)) { showToast('Esta conta já foi lançada este mês.', 'warning'); return; }
      if (bill.bank === 'a-definir' && !selectedBankId) { openBillLaunchPanel(bill, monthKey); return; }
      const confirmed = await showConfirm(`Confirmar lançamento de ${bill.name} no Livro-Caixa?`);
      if (!confirmed) return;
      const [year,month] = monthKey.split('-').map(Number);
      const date=billDueDateForMonth(bill,year,month-1);
      const bankId = selectedBankId || bill.bank;
      if (!bankId || bankId === 'a-definir') { openBillLaunchPanel(bill, monthKey); return; }
      const entry={id:'e'+Date.now()+Math.random().toString(36).slice(2,7),date,desc:bill.name,bank:bankId,category:bill.category||'',amount:Number(bill.amount)||0,type:'out',recurringBillId:bill.id};
      const previousBank = bill.bank;
      const previousGeneratedMonths = Array.isArray(bill.generatedMonths) ? bill.generatedMonths.slice() : [];
      entries.push(entry);
      bill.bank = bankId;
      bill.generatedMonths=previousGeneratedMonths.slice();
      bill.generatedMonths.push(monthKey);
      render(); renderBills();
      try {
        await persistAll();
        logInfo('Calendário','Lançar no Livro-Caixa','Sucesso',`${bill.name} lançado em ${date}.`,{bankId, recurringBillId: bill.id});
        closeAllPanels();
        showToast(`${bill.name} lançado com sucesso`, 'success');
      } catch (err) {
        entries = entries.filter(item => item.id !== entry.id);
        bill.bank = previousBank;
        bill.generatedMonths = previousGeneratedMonths;
        logSyncError('lançamento de conta', err);
        showToast('Não foi possível confirmar o lançamento no servidor. A conta continua como pendente.', 'error');
      } finally {
        render(); renderBills();
      }
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='Lançar'; }
    }
  }
  function billTitularValues() {
    const map = new Map();
    recurringBills.forEach(bill => { const value = String(bill.titular || '').trim(); if (value) { const key = value.toLocaleLowerCase('pt-BR'); if (!map.has(key)) map.set(key, value); } });
    return [...map.values()].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }
  function populateBillTitularFilter() {
    const select = document.getElementById('billTitularFilter'); if (!select) return;
    const saved = localStorage.getItem('billTitularFilter');
    const current = saved || select.value;
    const values = billTitularValues();
    select.innerHTML = '<option value="">Todos</option>' + values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    if (values.includes(current)) select.value = current;
    else if (current) { /* saved value not in current list */ }
    select.onchange = () => { localStorage.setItem('billTitularFilter', select.value); renderBills(); };
  }
  function visibleBillsForCalendar() {
    const titular = document.getElementById('billTitularFilter')?.value || '';
    return recurringBills.filter(bill => billAppliesToMonth(bill, billViewDate.getFullYear(), billViewDate.getMonth()) && (!titular || String(bill.titular || '').trim() === titular));
  }
  function billInstallmentLabel(bill, year, month){
    if (!bill.installment || !bill.installmentTotal) return null;
    const start = new Date(bill.startDate+'T00:00:00');
    const monthsElapsed = (year - start.getFullYear())*12 + (month - start.getMonth());
    const current = (bill.installmentStart||1) + monthsElapsed;
    if (current < 1 || current > bill.installmentTotal) return null;
    return `${current}/${bill.installmentTotal}`;
  }
  function calendarBillRows() {
    const y=billViewDate.getFullYear(), m=billViewDate.getMonth(), key=billMonthKey(billViewDate);
    return visibleBillsForCalendar().map(bill => {
      const launched = billGeneratedForMonth(bill, key);
      const paidOnly = !launched && billPaidForMonth(bill, key);
      return {
        bill,
        dueDate: billDueDateForMonth(bill, y, m),
        status: billStatus(bill, key),
        launched,
        paidOnly,
        settled: launched || paidOnly,
        installmentLabel: billInstallmentLabel(bill, y, m),
        bank: bill.bank === 'a-definir' ? 'A definir' : (banks.find(x => x.id === bill.bank)?.name || 'Banco não informado')
      };
    });
  }
  function billShareText(bill) {
    const y=billViewDate.getFullYear(), m=billViewDate.getMonth();
    const due = billDueDateForMonth(bill,y,m).split('-').reverse().join('/');
    const label = billInstallmentLabel(bill,y,m);
    return `📌 HELLOUUUUUUU
— ${String(bill.titular || '').trim() || 'Olá'}
Passando pra lembrar do pagamento da ${bill.name || 'conta'}${label?` (parcela ${label})`:''} 📃

• VENCIMENTO: ${due}
VALOR: ${fmt(bill.amount)}

📤 Enviar para a chave Pix abaixo e encaminhar comprovante:

🗝️| 85981886720
🪪| ANTONIO VINICIUS P SOBRINHO
🏦| ITAU UNIBANCO S.A.`;
  }
  function openBillShare(id) { const bill = recurringBills.find(item => item.id === id); if (!bill) return; const field = document.getElementById('billShareMessage'); if (field) field.value = billShareText(bill); document.getElementById('billShareStatus').textContent = ''; openModal('panelBillShare'); }

  // Helpers de fatura no escopo global (usados por renderBills E openBillDayPanel)
  function invoiceDisplayTotalFor(row, titularFilter) {
    const tf = titularFilter != null ? titularFilter : (document.getElementById('billTitularFilter')?.value || '');
    if (tf) return (row.breakdown || []).reduce((sum, b) => sum + Number(b.total || 0), 0);
    return Number(row.invoice?.total || 0);
  }
  function invoiceSettled(row) {
    return Array.isArray(row.breakdown) && row.breakdown.length > 0 && row.breakdown.every(b => b.status === 'Pago');
  }
  function invoiceOverdue(row) {
    return !invoiceSettled(row) && String(row.dueDate) < todayISO();
  }
  function invoicePending(row) {
    return !invoiceSettled(row) && !invoiceOverdue(row);
  }

  function renderBills(){
    const y=billViewDate.getFullYear(), m=billViewDate.getMonth(), key=billMonthKey(billViewDate);
    document.getElementById('billMonthLabel').textContent=billViewDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    populateBillTitularFilter();
    const titularFilter = document.getElementById('billTitularFilter')?.value || '';
    const statusFilter = document.getElementById('billsStatusFilter')?.value || '';
    const rows=calendarBillRows();
    let allInvoiceRows=[];
    try { allInvoiceRows = calendarInvoiceRows(y,m); } catch { allInvoiceRows = []; }
    const invoiceRows=titularFilter?allInvoiceRows.map(inv=>({...inv, breakdown:inv.breakdown.filter(b=>b.titular===titularFilter)})).filter(inv=>inv.breakdown.length):allInvoiceRows;
    const invoiceDisplayTotal = (row) => {
      try { return invoiceDisplayTotalFor(row, titularFilter); } catch { return 0; }
    };

    const matchBillStatus = (row) => {
      if (!statusFilter) return true;
      if (statusFilter === 'pago') return !!row.settled;
      if (statusFilter === 'atrasado') return !row.settled && row.status === 'Atrasado';
      if (statusFilter === 'pendente') return !row.settled && row.status === 'Pendente';
      return true;
    };
    const matchInvStatus = (row) => {
      if (!statusFilter) return true;
      if (statusFilter === 'pago') return invoiceSettled(row);
      if (statusFilter === 'atrasado') return invoiceOverdue(row);
      if (statusFilter === 'pendente') return invoicePending(row);
      return true;
    };

    const openBillRows = rows.filter(r => !r.settled && matchBillStatus(r));
    const paidBillRows = rows.filter(r => r.settled && (statusFilter === '' || statusFilter === 'pago'));
    const openInvoiceRows = invoiceRows.filter(r => !invoiceSettled(r) && matchInvStatus(r));
    const paidInvoiceRows = invoiceRows.filter(r => invoiceSettled(r) && (statusFilter === '' || statusFilter === 'pago'));

    const unsettled=rows.filter(row=>!row.settled);
    const settledCount=rows.filter(row=>row.settled).length + invoiceRows.filter(invoiceSettled).length;
    const total=rows.reduce((sum,row)=>sum+Number(row.bill.amount||0),0) + invoiceRows.reduce((sum,row)=>sum+invoiceDisplayTotal(row),0);
    const overdue=unsettled.filter(row=>row.status==='Atrasado').length + invoiceRows.filter(invoiceOverdue).length;
    const pendingCount = unsettled.filter(row=>row.status==='Pendente').length + invoiceRows.filter(invoicePending).length;
    document.getElementById('billsSummary').innerHTML=`<div class="bills-summary-grid"><div class="balance-card"><span class="label">Contas do mês</span><span class="amount">${fmt(total)}</span></div><div class="balance-card"><span class="label">Pagas</span><span class="amount">${settledCount}</span></div><div class="balance-card"><span class="label">Pendentes</span><span class="amount">${pendingCount}</span></div><div class="balance-card"><span class="label">Atrasadas</span><span class="amount">${overdue}</span></div><div class="balance-card"><span class="label">Faturas de cartão</span><span class="amount">${invoiceRows.length}</span></div></div>`;

    const first=new Date(y,m,1).getDay(), days=new Date(y,m+1,0).getDate(), names=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']; let html=names.map(n=>`<div class="bill-weekday">${n}</div>`).join('');
    for(let i=0;i<first;i++) html+=`<div class="bill-day muted"></div>`;
    const today=todayISO();
    for(let d=1;d<=days;d++){
      const date=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const events=rows.filter(row=>row.bill.recurrenceType==='nao_recorrente'||row.bill.frequency==='once'?row.dueDate===date:billDueDayFromStart(row.bill)===d);
      const invEvents=invoiceRows.filter(row=>row.dueDate===date);
      html+=`<div class="bill-day ${date===today?'today':''}" onclick="window.openBillDayPanel('${date}')"><div class="bill-day-num" role="button" tabindex="0" onclick="event.stopPropagation();window.openBillDayPanel('${date}')" aria-label="Ver compromissos de ${d}">${d}</div>${events.map(row=>`<div class="bill-event ${row.settled?'paid':''}" title="${escapeHTML(row.bill.name)}${row.installmentLabel?' · Parcela '+row.installmentLabel:''} · ${fmt(row.bill.amount)} · ${escapeHTML(row.status)}"></div>`).join('')}${invEvents.map(row=>`<div class="bill-event card-invoice ${invoiceSettled(row)?'paid':''}" title="Fatura ${escapeHTML(row.card.name)} · ${fmt(invoiceDisplayTotal(row))}"></div>`).join('')}</div>`;
    }
    document.getElementById('billCalendar').innerHTML=html;

    const renderBillItem = (row) => {
      const b = row.bill;
      const statusClass = row.settled ? 'is-paid' : (row.status === 'Atrasado' ? 'overdue' : '');
      const statusLabel = row.status === 'Pago — não lançado' ? 'Pago' : (row.status === 'Lançado' ? 'Lançado' : row.status);
      const payBtn = row.launched ? '' : (row.paidOnly
        ? `<button type="button" class="bill-action-btn" onclick="unmarkBillPaid('${b.id}','${key}',this)">Desmarcar pago</button>`
        : `<button type="button" class="bill-action-btn" onclick="markBillPaid('${b.id}','${key}',this)">Marcar pago</button>`);
      const dueLabel = row.dueDate.split('-').reverse().join('/');
      const meta = [
        `Venc. ${dueLabel}`,
        b.recurrenceType === 'nao_recorrente' ? 'Não recorrente' : (row.installmentLabel ? 'Parcelada' : 'Recorrente'),
        'Banco: ' + escapeHTML(row.bank),
        b.titular ? 'Titular: ' + escapeHTML(b.titular) : ''
      ].filter(Boolean).join(' · ');
      return `<div class="bill-list-item commitment-card is-recurring">
        <div class="commitment-card-head">
          <div class="commitment-card-main">
            <strong>${escapeHTML(b.name)}${row.installmentLabel ? ` · ${escapeHTML(row.installmentLabel)}` : ''}</strong>
            <div class="bill-list-item-amount">${fmt(b.amount)}</div>
            <div class="hint">${meta}</div>
          </div>
          <span class="bill-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="bill-actions commitment-actions">
          <button type="button" class="bill-action-btn primary-outline" onclick="launchBill('${b.id}','${key}',null,this)" ${row.launched ? 'disabled' : ''}>${row.launched ? 'Já lançada' : 'Lançar'}</button>
          ${payBtn}
          <button type="button" class="bill-action-btn" onclick="openBillShare('${b.id}')">Compartilhar</button>
          <div class="bill-more-wrap">
            <button type="button" class="bill-action-btn bill-more-button" aria-label="Mais opções" aria-expanded="false" onclick="toggleBillMenu('${b.id}')">•••</button>
            <div class="bill-more-menu" id="bill-more-${b.id}" hidden>
              <button type="button" onclick="editBill('${b.id}');closeBillMenus()">Editar</button>
              <button type="button" onclick="deleteBill('${b.id}');closeBillMenus()">Excluir</button>
            </div>
          </div>
        </div>
      </div>`;
    };

    const renderInvoiceItem = (row) => {
      const dueLabel = row.dueDate.split('-').reverse().join('/');
      const displayTotal = invoiceDisplayTotal(row);
      const settled = invoiceSettled(row);
      const statusLabel = settled ? 'Pago' : (invoiceOverdue(row) ? 'Atrasado' : 'Pendente');
      const statusClass = settled ? 'is-paid' : (invoiceOverdue(row) ? 'overdue' : '');
      const titulars = Array.isArray(row.breakdown) ? row.breakdown : [];

      const actionPair = (b) => {
        const safeTitular = escapeHTML(b.titular || '').replace(/'/g, "\\'");
        const cid = row.card.id;
        const pk = row.closingPeriodKey;
        const total = Number(b.total || 0);
        const remaining = Number(b.remaining != null ? b.remaining : b.total || 0);
        if (b.status === 'Pago' && !b.paidOnly) {
          return `
            <button type="button" class="bill-action-btn primary-outline" disabled>Já lançada</button>
            <button type="button" class="bill-action-btn" disabled>Pago</button>
            <button type="button" class="bill-action-btn" onclick="shareInvoiceTitular('${cid}','${pk}','${safeTitular}',${total})">Compartilhar</button>
            <button type="button" class="bill-action-btn bill-more-button" disabled aria-hidden="true">•••</button>`;
        }
        if (b.status === 'Pago' && b.paidOnly) {
          return `
            <button type="button" class="bill-action-btn primary-outline" onclick="recordInvoicePayment('${cid}','${pk}','${safeTitular}',${total},${total},this)">Lançar</button>
            <button type="button" class="bill-action-btn" onclick="unmarkInvoicePaidOnly('${cid}','${pk}','${safeTitular}')">Desmarcar pago</button>
            <button type="button" class="bill-action-btn" onclick="shareInvoiceTitular('${cid}','${pk}','${safeTitular}',${total})">Compartilhar</button>
            <button type="button" class="bill-action-btn bill-more-button" disabled aria-hidden="true">•••</button>`;
        }
        return `
            <button type="button" class="bill-action-btn primary-outline" onclick="recordInvoicePayment('${cid}','${pk}','${safeTitular}',${total},${remaining},this)">Lançar</button>
            <button type="button" class="bill-action-btn" onclick="markInvoicePaidOnly('${cid}','${pk}','${safeTitular}',${total})">Marcar pago</button>
            <button type="button" class="bill-action-btn" onclick="shareInvoiceTitular('${cid}','${pk}','${safeTitular}',${total})">Compartilhar</button>
            <button type="button" class="bill-action-btn bill-more-button" disabled aria-hidden="true">•••</button>`;
      };

      const carriedOut = Number(row.invoice?.carriedOut || 0);
      const carriedBadge = carriedOut > 0.004
        ? `<span class="bill-status is-carried" title="Saldo em aberto levado para a fatura seguinte">Seguinte</span>`
        : '';

      // 1 titular: idêntico à conta (sem bloco interno extra)
      if (titulars.length <= 1) {
        const b = titulars[0] || { titular: '', total: displayTotal, status: statusLabel, remaining: displayTotal, carry: 0 };
        const carryLine = Number(b.carry || 0) > 0.004
          ? `<div class="hint invoice-carry-line">Saldo anterior em aberto: <strong>${fmt(b.carry)}</strong></div>`
          : '';
        const meta = [
          `Venc. ${dueLabel}`,
          'Cartão',
          b.titular ? ('Titular: ' + escapeHTML(b.titular)) : ''
        ].filter(Boolean).join(' · ');
        return `<div class="bill-list-item commitment-card is-invoice" id="invoice-detail-${escapeHTML(row.card.id)}">
          <div class="commitment-card-head">
            <div class="commitment-card-main">
              <strong>Fatura ${escapeHTML(row.card.name)}</strong>
              <div class="bill-list-item-amount">${fmt(displayTotal)}</div>
              ${carryLine}
              <div class="hint">${meta}</div>
            </div>
            <span class="bill-status ${statusClass}">${statusLabel}</span>${carriedBadge}
          </div>
          <div class="bill-actions commitment-actions">${actionPair(b)}</div>
        </div>`;
      }

      // N titulares: mesmo card, sublinhas só com meta + mesma grade full-width
      const blocks = titulars.map(b => {
        const carryLine = Number(b.carry || 0) > 0.004
          ? `<div class="hint invoice-carry-line">Saldo anterior em aberto: <strong>${fmt(b.carry)}</strong></div>`
          : '';
        return `<div class="commitment-subblock">
          <div class="hint"><strong>${escapeHTML(b.titular || 'Sem titular')}</strong> · ${fmt(b.total)} · ${escapeHTML(b.status)}</div>
          ${carryLine}
          <div class="bill-actions commitment-actions">${actionPair(b)}</div>
        </div>`;
      }).join('');
      return `<div class="bill-list-item commitment-card is-invoice" id="invoice-detail-${escapeHTML(row.card.id)}">
        <div class="commitment-card-head">
          <div class="commitment-card-main">
            <strong>Fatura ${escapeHTML(row.card.name)}</strong>
            <div class="bill-list-item-amount">${fmt(displayTotal)}</div>
            <div class="hint">Venc. ${dueLabel} · Cartão · ${titulars.length} titulares</div>
          </div>
          <span class="bill-status ${statusClass}">${statusLabel}</span>${carriedBadge}
        </div>
        <div class="commitment-subblocks">${blocks}</div>
      </div>`;
    };

    let listHtml = '';
    if (statusFilter === 'pago') {
      const paidItems = paidBillRows.map(renderBillItem).join('') + paidInvoiceRows.map(renderInvoiceItem).join('');
      listHtml = paidItems || '<div class="empty">Nenhuma conta paga neste período com o filtro atual.</div>';
    } else {
      const main = openBillRows.slice().sort((a,b)=>billDueDayFromStart(a.bill)-billDueDayFromStart(b.bill)).map(renderBillItem).join('')
        + openInvoiceRows.map(renderInvoiceItem).join('');
      listHtml = main || (statusFilter ? '<div class="empty">Nenhum item neste filtro.</div>' : '<div class="empty">Nenhuma conta pendente neste mês com o filtro atual.</div>');
      if (statusFilter === '' && (paidBillRows.length || paidInvoiceRows.length)) {
        const paidInner = paidBillRows.map(renderBillItem).join('') + paidInvoiceRows.map(renderInvoiceItem).join('');
        listHtml += `<details class="bills-paid-accordion"><summary>Pagas (${paidBillRows.length + paidInvoiceRows.length})</summary><div class="bills-paid-body">${paidInner}</div></details>`;
      }
    }
    const listEl = document.getElementById('billList');
    if (listEl) listEl.innerHTML = listHtml;
  }


  function closeBillDayPanel() {
    document.getElementById('bill-day-panel-v19-16')?.remove();
  }

  function openBillDayPanel(date) {
    closeBillDayPanel();
    const parts = String(date).split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;

    const billRows = calendarBillRows().filter(row => row.dueDate === date);
    let allInvoices = [];
    try { allInvoices = calendarInvoiceRows(y, m); } catch { allInvoices = []; }
    const titularFilter = document.getElementById('billTitularFilter')?.value || '';
    const invoiceRows = titularFilter
      ? allInvoices.map(inv => ({
          ...inv,
          breakdown: inv.breakdown.filter(b => b.titular === titularFilter)
        })).filter(inv => inv.breakdown.length)
      : allInvoices;

    const dayInvoices = invoiceRows.filter(row => row.dueDate === date);

    const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const billItems = billRows.map(row => {
      const status = row.status === 'Pago — não lançado' ? 'Pago' : row.status;
      const installment = row.installmentLabel
        ? ` · Parcela ${escapeHTML(row.installmentLabel)}`
        : '';

      return `<div class="bill-day-panel-item">
        <div>
          <strong>${escapeHTML(row.bill.name)}${installment}</strong>
          <span>${fmt(row.bill.amount)} · ${escapeHTML(status)}</span>
        </div>
        <span class="bill-day-panel-type">Conta</span>
      </div>`;
    }).join('');

    const invoiceItems = dayInvoices.map(row => {
      const settled = invoiceSettled(row);
      const status = settled
        ? 'Pago'
        : (invoiceOverdue(row) ? 'Atrasado' : 'Pendente');
      const total = invoiceDisplayTotalFor(row, titularFilter);
      const carry = titularFilter
        ? (row.breakdown || []).reduce((sum, b) => sum + Number(b.carry || 0), 0)
        : Number(row.invoice?.carry || 0);
      const carryText = carry > 0.004 ? ` · anterior ${fmt(carry)}` : '';

      return `<div class="bill-day-panel-item">
        <div>
          <strong>Fatura ${escapeHTML(row.card.name)}</strong>
          <span>${fmt(total)}${carryText} · ${status}</span>
        </div>
        <span class="bill-day-panel-type">Cartão</span>
      </div>`;
    }).join('');

    const items = billItems + invoiceItems;

    const overlay = document.createElement('div');
    overlay.id = 'bill-day-panel-v19-16';
    overlay.className = 'modal-overlay open';

    overlay.innerHTML = `
      <div class="panel bill-day-panel-card open" role="dialog" aria-modal="true" aria-label="Compromissos do dia">
        <h3>
          <div>
            <span class="bill-day-panel-kicker">Contas e faturas</span>
            <div class="bill-day-panel-date">${dayLabel}</div>
          </div>
          <button type="button" class="modal-close" onclick="closeBillDayPanel()" aria-label="Fechar">×</button>
        </h3>

        <div class="bill-day-panel-body">
          ${items || '<div class="bill-day-panel-empty">Nenhuma conta ou fatura neste dia.</div>'}
        </div>
      </div>`;

    document.body.appendChild(overlay);
  }

function billsExportRows() {
    const titularFilter = document.getElementById('billTitularFilter')?.value || '';
    const rows = calendarBillRows().map(({bill,dueDate,status,launched,bank}) => ({ 'Conta/Fatura': bill.name || '', 'Titular': bill.titular || '', 'Valor': Number(bill.amount || 0), 'Vencimento': dueDate.split('-').reverse().join('/'), 'Banco': bank, 'Status': status, 'Recorrente': bill.recurrenceType === 'nao_recorrente' ? 'Não' : 'Sim', 'Periodicidade': bill.frequency === 'once' ? 'Única' : 'Mensal', 'Observação': bill.desc || '' }));
    let invoiceRows = [];
    try { invoiceRows = calendarInvoiceRows(billViewDate.getFullYear(), billViewDate.getMonth()); } catch (err) { logWarn('Calendário','Exportar contas/faturas','Atenção','Card Engine indisponível; faturas de cartão ficaram fora da exportação.'); }
    invoiceRows.forEach(row => {
      const breakdown = (Array.isArray(row.breakdown) ? row.breakdown : []).filter(b => !titularFilter || String(b.titular || '').trim() === titularFilter);
      if (titularFilter && !breakdown.length) return;
      const filteredRow = { ...row, breakdown };
      const settled = invoiceSettled(filteredRow);
      const overdue = invoiceOverdue(filteredRow);
      const vencimento = String(row.dueDate || '').split('-').reverse().join('/');
      const banco = cardBankName(row.card);
      const items = breakdown.length ? breakdown : [{ titular: '', total: Number(row.invoice?.payableTotal || row.invoice?.total || 0), count: Number(row.invoice?.count || 0), carry: Number(row.invoice?.carry || 0) }];
      items.forEach(b => {
        const status = (b.status === 'Pago' || settled) ? 'Pago' : (overdue ? 'Atrasado' : (b.status || 'Pendente'));
        const obs = [];
        if (Number(b.count || 0) > 0) obs.push(`${b.count} compra(s) no período`);
        if (Number(b.carry || 0) > 0.004) obs.push(`Saldo anterior em aberto: ${fmt(b.carry)}`);
        rows.push({ 'Conta/Fatura': `Fatura ${row.card?.name || ''}`, 'Titular': b.titular || '', 'Valor': Number(b.total || 0), 'Vencimento': vencimento, 'Banco': banco, 'Status': status, 'Recorrente': 'Não', 'Periodicidade': 'Mensal', 'Observação': obs.join(' · ') });
      });
    });
    return rows;
  }
  function exportBillsXlsx() { const rows=billsExportRows(); if (!window.XLSX) { alert('A biblioteca de Excel não está disponível.'); return; } const sheet=XLSX.utils.json_to_sheet(rows); sheet['!cols']=[{wch:24},{wch:18},{wch:13},{wch:14},{wch:22},{wch:14},{wch:12},{wch:15},{wch:36}]; const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Calendário'); XLSX.writeFile(book,`calendario-${billMonthKey(billViewDate)}.xlsx`); logInfo('Calendário','Exportar Excel','Sucesso',`${rows.length} conta(s)/fatura(s) exportada(s) respeitando o filtro de titular.`); }
  function exportBillsPdf() { const rows=billsExportRows(); const Pdf=window.jspdf?.jsPDF; if (!Pdf) { alert('A biblioteca de PDF não está disponível.'); return; } const doc=new Pdf({unit:'pt',format:'a4'}); const margin=36; let y=42; doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('Calendário financeiro',margin,y); y+=22; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Período: ${billViewDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`,margin,y); doc.text(`Total de contas/faturas: ${rows.length} · Total previsto: ${fmt(rows.reduce((sum,row)=>sum+Number(row.Valor||0),0))}`,margin,y+14); y+=38; doc.setFontSize(8); rows.forEach(row=>{ if(y>760){doc.addPage();y=42;} const line=`${row['Vencimento']} · ${row['Conta/Fatura']} · ${row['Titular']||'Sem titular'} · ${fmt(row['Valor'])} · ${row['Status']}`; doc.text(doc.splitTextToSize(line,520),margin,y); y+=14; }); doc.save(`calendario-${billMonthKey(billViewDate)}.pdf`); logInfo('Calendário','Exportar PDF','Sucesso',`${rows.length} conta(s)/fatura(s) exportada(s) respeitando o filtro de titular.`); }

  window.openBillDayPanel = openBillDayPanel;
  window.closeBillDayPanel = closeBillDayPanel;
