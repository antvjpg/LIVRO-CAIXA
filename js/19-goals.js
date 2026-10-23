/* LIVRO-CAIXA · js/19-goals.js — metas (app.js: 4294-4726). Separação por responsabilidade; conteúdo preservado. */

  let editingGoalId;


  function refreshGoalCaixinhaOptions(selectedId = '') {
    const select = document.getElementById('goalCaixinha');
    if (!select) return;

    const selected = String(selectedId || '');
    const bankOptions = banks
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
      .map(bank => `<option value="bank:${escapeHTML(bank.id)}">🏦 ${escapeHTML(bank.name || 'Conta')} · ${fmt(bankBalance(bank.id))}</option>`)
      .join('');

    const pocketOptions = pockets
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
      .map(pocket => `<option value="pocket:${escapeHTML(pocket.id)}">🐷 ${escapeHTML(pocket.name || 'Caixinha')} · ${fmt(pocketCurrentBalance(pocket))}</option>`)
      .join('');

    const investOptions = investments
      .slice()
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
      .map(inv => `<option value="invest:${escapeHTML(inv.id)}">📈 ${escapeHTML(inv.name || inv.asset || 'Investimento')} · ${fmt(investmentValueAtDate(inv, todayISO()))}</option>`)
      .join('');

    select.innerHTML =
      '<option value="">Nenhum — planejamento sem saldo</option>' +
      (bankOptions ? `<optgroup label="Contas">${bankOptions}</optgroup>` : '') +
      (pocketOptions ? `<optgroup label="Caixinhas">${pocketOptions}</optgroup>` : '') +
      (investOptions ? `<optgroup label="Investimentos">${investOptions}</optgroup>` : '');

    select.value = selected;
    if (select.value !== selected) select.value = '';
  }


  function syncGoalLegacyAmountField() {
    const select = document.getElementById('goalCaixinha');
    const field = document.getElementById('goalValorAtualLegacyField');
    const input = document.getElementById('goalValorAtual');
    if (!select || !field || !input) return;

    const linked = Boolean(select.value);
    field.hidden = linked;
    input.disabled = linked;
  }

  function activeGoalForSource(sourceType, sourceId, exceptId = null) {
    if (!sourceType || !sourceId) return null;
    return goals.find(goal =>
      goal &&
      goal.id !== exceptId &&
      (goal.sourceType || (goal.caixinhaId ? 'pocket' : null)) === sourceType &&
      String(goal.sourceId || goal.caixinhaId || '') === String(sourceId) &&
      (goal.status || 'active') === 'active'
    ) || null;
  }


  function goalStatusLabel(status) {
    return ({
      active: 'Ativa',
      completed: 'Concluída',
      paused: 'Pausada',
      cancelled: 'Cancelada'
    })[status] || 'Ativa';
  }

  function goalPlanning(goal) {
    const target = Number(goal.targetAmount) || 0;
    const current = goalCurrentAmount(goal);
    const hasCurrent = current != null;
    const remaining = hasCurrent ? Math.max(0, target - current) : null;
    const today = todayISO();

    let daysRemaining = null;
    let overdue = false;
    let periodsRemaining = null;
    let perDay = null;
    let perWeek = null;
    let perMonth = null;

    if (goal.deadline) {
      const start = new Date(`${goal.startDate || today}T00:00:00`);
      const end = new Date(`${goal.deadline}T00:00:00`);
      const now = new Date(`${today}T00:00:00`);
      daysRemaining = Math.ceil((end - now) / 86400000);
      overdue = goal.deadline < today;

      if (hasCurrent && remaining > 0 && daysRemaining > 0) {
        const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
        periodsRemaining = Math.max(1, Math.ceil(daysRemaining / 7));
        perDay = remaining / daysRemaining;
        perWeek = remaining / periodsRemaining;
        perMonth = remaining / Math.max(1, Math.ceil(daysRemaining / 30));
        void totalDays;
      }
    }

    return {
      target,
      current,
      hasCurrent,
      remaining,
      daysRemaining,
      overdue,
      periodsRemaining,
      perDay,
      perWeek,
      perMonth
    };
  }

  function normalizeGoalStatusFromProgress(goal) {
    if (!goal || goal.status !== 'active' || !(goal.sourceId || goal.caixinhaId)) return false;
    const current = goalCurrentAmount(goal);
    const target = Number(goal.targetAmount) || 0;
    if (current != null && target > 0 && current >= target) {
      goal.status = 'completed';
      goal.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  function normalizeAllGoalStatuses() {
    let changed = false;
    goals.forEach(goal => {
      if (normalizeGoalStatusFromProgress(goal)) changed = true;
    });
    return changed;
  }

  function goalMarkup(goal) {
    const plan = goalPlanning(goal);
    const target = plan.target;
    const current = plan.current;
    const hasCurrent = plan.hasCurrent;
    const percent = target > 0 && hasCurrent
      ? Math.min(100, Math.max(0, current / target * 100))
      : 0;

    const status = goal.status || 'active';
    const sourceType = goal.sourceType || (goal.caixinhaId ? 'pocket' : null);
    const sourceId = goal.sourceId || goal.caixinhaId || null;
    const linkedSource =
      sourceType === 'bank' ? banks.find(item => item.id === sourceId) :
      sourceType === 'pocket' ? pockets.find(item => item.id === sourceId) :
      sourceType === 'invest' ? investments.find(item => item.id === sourceId) :
      null;
    const sourceLabel =
      sourceType === 'bank' ? 'Conta' :
      sourceType === 'pocket' ? 'Caixinha' :
      sourceType === 'invest' ? 'Investimento' : 'Vínculo';
    const sourceIcon =
      sourceType === 'bank' ? '🏦' :
      sourceType === 'pocket' ? '🐷' :
      sourceType === 'invest' ? '📈' : '🔗';
    const statusLabel = goalStatusLabel(status);
    const statusClass = status === 'active' ? 'is-active' : (status === 'completed' ? 'is-done' : 'is-other');

    const currentTxt = hasCurrent ? fmt(current) : '—';
    const targetTxt = fmt(target);
    const remainTxt = hasCurrent && plan.remaining > 0 ? fmt(plan.remaining) : (hasCurrent ? 'R$ 0,00' : '—');

    let deadlineTxt = '';
    if (goal.deadline) {
      const parts = String(goal.deadline).split('-');
      deadlineTxt = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : goal.deadline;
    }

    let daysTxt = '';
    if (goal.deadline && plan.daysRemaining != null) {
      if (plan.overdue && plan.remaining > 0) {
        daysTxt = `atrasada ${Math.abs(plan.daysRemaining)} dias`;
      } else if (plan.daysRemaining >= 0) {
        daysTxt = `${plan.daysRemaining} dias`;
      }
    }

    const monthPace = plan.hasCurrent && plan.remaining > 0 && plan.perMonth > 0
      ? `Necessário ≈ ${fmt(plan.perMonth)}/mês`
      : '';

    return `<article class="goal-card-v2" data-goal-id="${escapeHTML(goal.id)}">
      <div class="goal-card-v2-top">
        <div class="goal-card-v2-title">
          <span class="goal-card-v2-icon" aria-hidden="true">${escapeHTML(goal.icon || '🎯')}</span>
          <strong>${escapeHTML(goal.name || 'Meta')}</strong>
          <span class="goal-card-v2-badge ${statusClass}">${escapeHTML(statusLabel)}</span>
        </div>
      </div>
      <div class="goal-card-v2-pocket">
        <span class="goal-card-v2-pocket-ico" aria-hidden="true">${sourceIcon}</span>
        ${escapeHTML(sourceLabel)}: <strong>${linkedSource ? escapeHTML(linkedSource.name || linkedSource.asset || 'Vinculado') : (sourceId ? 'Vínculo removido' : 'Nenhum')}</strong>
      </div>
      <div class="goal-card-v2-values">
        <span class="goal-card-v2-current">${currentTxt}</span>
        <span class="goal-card-v2-of">de</span>
        <span class="goal-card-v2-target">${targetTxt}</span>
      </div>
      <div class="goal-card-v2-track" role="progressbar" aria-valuenow="${percent.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
        <span style="width:${percent.toFixed(2)}%"></span>
      </div>
      <div class="goal-card-v2-meta">
        <span>Faltam ${remainTxt}</span>
        ${daysTxt ? `<span class="goal-card-v2-dot">·</span> <span>${escapeHTML(daysTxt)}</span>` : ''}
        ${deadlineTxt ? `<span class="goal-card-v2-dot">·</span> <span>Prazo ${escapeHTML(deadlineTxt)}</span>` : ''}
      </div>
      <div class="goal-card-v2-footer">
        <span class="goal-card-v2-pace">${monthPace ? '↗ ' + escapeHTML(monthPace) : ''}</span>
        <div class="goal-card-v2-actions">
          <button type="button" class="goal-card-v2-btn goal-edit-btn" onclick="editGoal(${escapeHTML(JSON.stringify(String(goal.id)))})" aria-label="Editar meta">
            <i class="fi fi-rr-pencil" aria-hidden="true"></i>
          </button>
          <button type="button" class="goal-card-v2-btn goal-delete-btn" onclick="deleteGoal(${escapeHTML(JSON.stringify(String(goal.id)))})" aria-label="Excluir meta">
            <i class="fi fi-rr-trash" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </article>
    `;
  }
  function renderGoalsList() {
    const list = document.getElementById('goalsList');
    if (!list) return;
    const statusChanged = normalizeAllGoalStatuses();
    list.innerHTML = goals.length ? goals.map(goalMarkup).join('') : '<p class="hint">Nenhuma meta cadastrada ainda.</p>';
    if (statusChanged && firstLoadDone && currentUser) {
      persistAll().catch(err => logSyncError('meta', err));
    }
    const current = goals.find(g => g.id === editingGoalId);
    refreshGoalCaixinhaOptions(current?.caixinhaId || document.getElementById('goalCaixinha')?.value || '');
    syncGoalLegacyAmountField();
  }
  function resetGoalForm() {
    editingGoalId = null;
    document.getElementById('goalNome').value = '';
    document.getElementById('goalIcone').value = '🎯';
    setMoneyInput('goalValorObjetivo', 0);
    refreshGoalCaixinhaOptions('');
    document.getElementById('goalCaixinha').value = '';
    document.getElementById('goalDataInicio').value = todayISO();
    setMoneyInput('goalValorAtual', 0);
    syncGoalLegacyAmountField();
    document.getElementById('goalPrazo').value = '';
    document.getElementById('goalStatus').value = 'active';
    document.getElementById('goalObs').value = '';
    document.getElementById('btnSaveGoal').textContent = 'SALVAR META';
    const titleEl = document.getElementById('goalFormTitle');
    if (titleEl) titleEl.textContent = 'Nova Meta';
  }
  function openNewGoalModal() {
    resetGoalForm();
    if (typeof openModal === 'function') openModal('panelGoalForm');
  } // if btnSaveGoalEl
  function pocketGoalMarkup(pocket, current) {
    const amount = Number(pocket?.goalAmount) || 0;
    if (!(amount > 0)) return pocket?.goal ? `<div class="units">${escapeHTML(pocket.goal)}</div>` : '';
    const percent = Math.min(100, Math.max(0, current / amount * 100));
    return `<div class="pocket-goal"><div class="pocket-goal-head"><span>${escapeHTML(pocket.goal || 'Meta da caixinha')}</span><strong>${percent.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${percent.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(current)} de ${fmt(amount)}</div></div>`;
  }
