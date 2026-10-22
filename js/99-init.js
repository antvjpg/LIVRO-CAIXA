/* LIVRO-CAIXA · js/99-init.js — dispatcher DOMContentLoaded: fiiação (listeners, handlers e chamadas) extraída de app.js (app.js: 457-15501). Separação por responsabilidade; conteúdo preservado. */
/* [JS 10] INICIALIZAÇÃO / BOOTSTRAP */
document.addEventListener('DOMContentLoaded', () => {
  // PWA: registra o Service Worker e disponibiliza a instalação quando o navegador permitir.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js?v=20-02').then(reg => {
      window.loginDebugLog?.(
        'PWA',
        'Service Worker registrado',
        {
          scope: reg.scope,
          controller: !!navigator.serviceWorker.controller
        }
      );

      console.log('[PWA] Service Worker registrado:', reg.scope);
      if (typeof logInfo === 'function') logInfo('Sistema','Registro do Service Worker','Sucesso','PWA pronta para atualização offline.');
    }).catch(err => { console.warn('[PWA] Falha ao registrar Service Worker:', err); if (typeof logWarn === 'function') logWarn('Sistema','Registro do Service Worker','Falha','A aplicação seguirá sem o service worker nesta sessão.',{message: err.message}); });
  }

    document.querySelectorAll('.mobile-bottom-nav button').forEach((button) => {
      button.addEventListener('click', () => {
        if (!button.dataset.destination) return;
        switchTab(button.dataset.destination);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  banks = [];
  categories = [];
  entries = [];
  investments = [];
  pockets = [];
  yieldsLog = [];
  recurringBills = [];
  receivables = [];
  budgets = [];
  goals = [];
  invoiceLaunches = [];
  cards = [];
  purchases = [];
  editingCardId = null;
  editingPurchaseId = null;
  pendingImport = [];
  FEATURE_SETTINGS_KEY = 'livrocaixa-feature-settings';
  featureSettings = { autoLaunchRecurring: false, reminders: true, autoRefreshQuotes: false, quoteRefreshMinutes: 15, projectionMonths: 6, autoCategorization: false, reminderAdvanceDays: 3, monthlySavingsGoal: 0, pushNotifications: false, lockOnOpen: true, lockGraceMinutes: 5 };
  FCM_TOKEN_KEY = 'livrocaixa-fcm-token';
  pushForegroundBound = false;
  featureAutomationTimer = null;
  pendingImportSource = '';
  currentType = 'in';
  editingEntryId = null;
  editingBankId = null;
  editingCategoryId = null;

  let returnToEntryAfterCategory = false;
  editingInvestId = null;
  editingPocketId = null;
  investmentMovementTarget = null;
  catChartInstances = { out: null, in: null };
  catChartOutsideClickHandler = null;

  const catChartBreakpoint = window.matchMedia('(max-width: 680px)');
  if (typeof catChartBreakpoint.addEventListener === 'function') {
    catChartBreakpoint.addEventListener('change', () => { if (catChartInstances.out || catChartInstances.in) renderCategorySummary(); });
  } else if (typeof catChartBreakpoint.addListener === 'function') {
    catChartBreakpoint.addListener(() => { if (catChartInstances.out || catChartInstances.in) renderCategorySummary(); });
  }
  normalizeMoney = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // evita -0,00 por resíduo de ponto flutuante; não mascara déficits reais
    return Math.abs(v) < 0.005 ? 0 : v;
  };
  fmt = (n) => {
    const v = normalizeMoney(n);
    return (v < 0 ? '-' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  fmtPrecise = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return fmt(0);
    const abs = Math.abs(v);
    if (abs > 0 && abs < 0.01) return (v < 0 ? '-' : '') + 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    return fmt(v);
  };
  MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  todayISO = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  currentMonthYM = () => todayISO().slice(0, 7);
  FINANCIAL_CYCLE_STORAGE_KEY = 'livrocaixa_financial_cycle_start_day';
  BUDGET_ALERT_STORAGE_KEY = 'livrocaixa_budget_alerts_shown';
  BACKUP_SCHEMA_VERSION = 4;
  SESSION_IDLE_MS = 30 * 60 * 1000;
  sessionIdleTimer = null;
  sessionLastActivity = Date.now();
  sessionSecurityStarted = false;


  // Proteção contra toques/cliques duplicados muito rápidos.
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-single-action="1"]');
    if (!btn) return;
    const now = Date.now();
    const lockedUntil = Number(btn.dataset.actionLockedUntil || 0);
    if (now < lockedUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    btn.dataset.actionLockedUntil = String(now + 1200);
    btn.classList.add('single-action-locked');
    setTimeout(() => {
      if (Number(btn.dataset.actionLockedUntil || 0) <= Date.now()) {
        btn.classList.remove('single-action-locked');
      }
    }, 1250);
  }, true);
  themeBtn = document.getElementById('btnThemeToggle');
  themeColorMeta = document.querySelector('meta[name="theme-color"]');

  const lightThemePicker = document.getElementById('lightThemePicker');
  lightThemeOptions = Array.from(document.querySelectorAll('.light-theme-option'));
  LIGHT_THEME_STORAGE_KEY = 'livro-caixa-light-theme';
  LIGHT_THEME_COLORS = {
    '1': '#F7F5EF',
    '2': '#F8F7F2',
    '3': '#FAF9F6',
    '4': '#FBF6EF',
    '5': '#F9F9F9'
  };

  const darkThemePicker = document.getElementById('darkThemePicker');
  darkThemeOptions = Array.from(document.querySelectorAll('.dark-theme-option'));
  DARK_THEME_STORAGE_KEY = 'livro-caixa-dark-theme';
  DARK_THEME_COLORS = {
    '1': '#1A1917',
    '2': '#121212',
    '3': '#0F1712',
    '4': '#141410',
    '5': '#000000'
  };
  THEME_IDS_MIGRATED_KEY = 'livro-caixa-theme-ids-v2';


  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    setThemeToggleIcon(true);
    applyDarkTheme(getSavedDarkTheme());
  } else applyLightTheme(getSavedLightTheme());
  lightThemeOptions.forEach(option => {
    option.addEventListener('click', () => {
      if (document.body.classList.contains('dark-mode')) return;
      applyLightTheme(option.dataset.theme);
      renderCategorySummary();
      renderInvestments();
      renderPockets();
      renderPocketBalances();
      renderBalances();
    });
  });
  darkThemeOptions.forEach(option => {
    option.addEventListener('click', () => {
      if (!document.body.classList.contains('dark-mode')) return;
      applyDarkTheme(option.dataset.theme);
      renderCategorySummary();
      renderInvestments();
      renderPockets();
      renderPocketBalances();
      renderBalances();
    });
  });

  try { localStorage.removeItem('livro-caixa-oliva-sec'); } catch (e) {}
  themeBtn.onclick = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    // Flaticon permanece fixo no botão; não substituir por SVG.
    themeBtn?.querySelector('.fi')?.setAttribute('aria-hidden', 'true');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) applyDarkTheme(getSavedDarkTheme());
    else applyLightTheme(getSavedLightTheme());
    renderCategorySummary();
    renderInvestments();
    renderPockets();
    renderPocketBalances();
    renderBalances();
    renderDashboardTab();
  };

  // Perfil → Aparência: mostrar/ocultar as paletas (única entrada das paletas no app)
  document.getElementById('btnAparencia')?.addEventListener('click', () => {
    const wrap = document.getElementById('aparenciaPaletas');
    const btn = document.getElementById('btnAparencia');
    if (!wrap || !btn) return;
    const willOpen = wrap.hasAttribute('hidden');
    if (willOpen) wrap.removeAttribute('hidden');
    else wrap.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  // Suporte a tecla ESC para fechar modais
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });
  LAST_TAB_STORAGE_KEY = 'livrocaixa_last_tab';
  TAB_NAMES = ['dash', 'dashboard', 'caixa', 'invest', 'pockets', 'cards', 'receivables', 'bills', 'profile', 'goals'];
  currentTab = 'caixa';
  lastTabRestored = false;

  try { document.body.dataset.tab = currentTab; } catch (e) {}
  /* sessionStorage (e não localStorage): a aba vale só durante a sessão —
     sobrevive a F5/atualização, mas some ao fechar o app (volta no Livro-Caixa). */
  try { localStorage.removeItem(LAST_TAB_STORAGE_KEY); } catch (e) {}
  /* Exportado: o patch de Metas (scripts externos) roda FORA deste closure do
     DOMContentLoaded e precisa salvar a aba 'goals' pelo guard typeof. */
  window.persistLastTab = persistLastTab;

  document.getElementById('universalPeriodBar')?.addEventListener('click', (event) => {
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('.period-controls')) return;
    const bar = document.getElementById('universalPeriodBar');
    const btn = document.getElementById('btnTogglePeriodBar');
    if (!bar || !btn) return;
    bar.classList.toggle('is-collapsed');
    const collapsed = bar.classList.contains('is-collapsed');
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
  // sync top label with main period label when updated
  (function syncPeriodTopLabel(){
    const src = document.getElementById('periodActiveLabel');
    const top = document.getElementById('periodActiveLabelTop');
    if (!src || !top) return;
    const mo = new MutationObserver(() => { top.textContent = src.textContent; });
    mo.observe(src, { childList:true, characterData:true, subtree:true });
    top.textContent = src.textContent;
  })();

  /* [JS 09] EVENTOS / INTERAÇÕES / MODAIS */
  window.switchTabOriginal = function(tabName) {
    currentTab = tabName;
    persistLastTab(tabName);
    try { document.body.dataset.tab = tabName || 'caixa'; } catch (e) {}
    document.body.classList.add('tab-changing');
    window.setTimeout(() => document.body.classList.remove('tab-changing'), 240);
    updateNavIndicator(tabName);
    document.getElementById('tabBtnDash')?.classList.toggle('active', tabName === 'dash');
    document.getElementById('tabBtnDashboard')?.classList.toggle('active', tabName === 'dashboard');
    document.getElementById('tabBtnCaixa')?.classList.toggle('active', tabName === 'caixa');
    document.getElementById('tabBtnInvest')?.classList.toggle('active', tabName === 'invest');
    document.getElementById('tabBtnPockets')?.classList.toggle('active', tabName === 'pockets');
    document.getElementById('tabBtnCards')?.classList.toggle('active', tabName === 'cards');
    document.getElementById('tabBtnReceivables')?.classList.toggle('active', tabName === 'receivables');
    document.getElementById('viewDash')?.classList.toggle('active', tabName === 'dash');
    document.getElementById('viewDashboard')?.classList.toggle('active', tabName === 'dashboard');
    document.getElementById('viewCaixa')?.classList.toggle('active', tabName === 'caixa');
    document.getElementById('viewInvest')?.classList.toggle('active', tabName === 'invest');
    document.getElementById('viewPockets')?.classList.toggle('active', tabName === 'pockets');
    document.getElementById('viewCards')?.classList.toggle('active', tabName === 'cards');
    document.getElementById('viewReceivables')?.classList.toggle('active', tabName === 'receivables');
    document.getElementById('viewBills')?.classList.toggle('active', tabName === 'bills');
    document.getElementById('viewProfile')?.classList.toggle('active', tabName === 'profile');
    document.getElementById('viewGoals')?.classList.toggle('active', tabName === 'goals');
    document.getElementById('balanceStrip')?.classList.toggle('section-hidden', tabName !== 'caixa');
    document.getElementById('universalPeriodBar')?.classList.toggle('section-hidden', !['caixa','invest','pockets'].includes(tabName));
    if (tabName === 'bills') renderBills();
    if (tabName === 'cards') renderCards();
    if (tabName === 'receivables') renderReceivables();
    if (tabName === 'invest') { renderInvestments(); refreshStaleInvestmentQuotes(); }
    if (tabName === 'dashboard') renderAdvancedDashboard();
    if (tabName === 'dash') renderDashboardTab();
    if (tabName === 'caixa') renderCategorySummary();
    const navEl = document.querySelector('.mobile-bottom-nav');
    const navActive = navEl?.dataset.active || tabName;
    navEl?.querySelectorAll('button').forEach(button => button.classList.toggle('is-active', button.dataset.destination === navActive));
    if (tabName === 'profile') renderProfile();
  };
  // Base da navegação: BNI e onclick usam switchTab
  if (typeof window.switchTab !== 'function') {
    window.switchTab = window.switchTabOriginal;
  }
  COLLECTIONS = ['banks', 'categories', 'entries', 'investments', 'pockets', 'yieldsLog', 'recurringBills', 'receivables', 'budgets', 'goals', 'cards', 'purchases', 'invoiceLaunches'];
  lastSynced = { banks: {}, categories: {}, entries: {}, investments: {}, pockets: {}, yieldsLog: {}, recurringBills: {}, receivables: {}, budgets: {}, goals: {}, invoiceLaunches: {}, cards: {}, purchases: {} };
  realtimeUnsubscribers = [];

  window.moveInvestment = (id, direction) => moveDisplayItem('investments', id, direction);
  window.movePocket = (id, direction) => moveDisplayItem('pockets', id, direction);
  diagnosticLog = [];

  LOG_STORAGE_KEY = 'livrocaixa_diagnostic_log';
  LOG_LIMIT = 200;
  LOG_SCHEMA_VERSION = 2;
  LOG_SEQUENCE_STORAGE_KEY = 'livrocaixa_diagnostic_sequence';
  LOG_SOURCE = 'Livro-Caixa-web';
  logSequence = 0;

  window.addEventListener('error', event => {
    const error = event.error || new Error(event.message || 'Erro de interface');
    if (!error.__livroCaixaLogged) { error.__livroCaixaLogged = true; logSyncError('erro de interface', error); }
  });
  window.addEventListener('unhandledrejection', event => {
    logSyncError('rejeição assíncrona', event.reason || new Error('Promise rejeitada sem motivo informado'));
  });
  VIEW_PERIOD_KEY = 'livrocaixa_view_period_v18_08';
  viewPeriod = { mode: 'month', month: currentMonthYM() };
  patrimonySparklineInstance = null;
  PATRIMONY_SPARK_STORAGE_KEY = 'livro-caixa-patrimony-spark';
  patrimonySparkVisible = localStorage.getItem(PATRIMONY_SPARK_STORAGE_KEY) !== '0';
  CATEGORY_PALETTE = ['#93584B', '#386D54', '#B89034', '#426980', '#593553', '#AA825A', '#678974', '#AC5E88'];
  CATEGORY_ICON_RULES = [
    [/aliment|restaur|mercado|comida/i, '🍔'], [/transporte|uber|ônibus|combust/i, '🚗'],
    [/moradia|casa|aluguel|luz|água/i, '🏠'], [/salário|renda|receb|trabalho/i, '💰'],
    [/invest|cripto|cdb|renda fixa/i, '📈'], [/lazer|jogo|cinema|stream/i, '🎮'],
    [/compra|loja/i, '🛒'], [/saúde|farmácia|médic/i, '❤️'], [/educa|curso|livro/i, '📚'], [/transfer/i, '↔️']
  ];
  categoryColorMap = new Map();
  normalizeTextKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  EMOJI_CATALOG = window.LC_EMOJI_CATALOG || [];
  emojiFloatPending = null;
  categoryIconTouched = false;
  categoryIconSuggested = null;

  initCategoryEmojiPicker();
  updateNavIndicator(currentTab);
  SATS_PER_BTC = 100000000;

  window.updateInvestFormLayout = function() {
    const type = document.getElementById('iTipo').value;
    const cryptoBox = document.getElementById('cryptoFields');
    const rendaFixaBox = document.getElementById('rendaFixaFields');
    const simplesBox = document.getElementById('valorSimplesField');
    const unidadesInput = document.getElementById('iUnidades');
    const unidadesLabel = document.getElementById('iUnidadesLabel');
    const cotacaoLabel = document.getElementById('iCotacaoLabel');
    cryptoBox.style.display = 'none';
    rendaFixaBox.style.display = 'none';
    simplesBox.style.display = 'none';
    if (isCryptoType(type)) {
      cryptoBox.style.display = 'contents';
      if (isBitcoinType(type)) {
        unidadesLabel.textContent = editingInvestId ? 'Saldo Inicial em SATS' : 'Saldo Inicial em SATS';
        unidadesInput.step = '1';
        unidadesInput.placeholder = 'Ex: 2000';
        cotacaoLabel.textContent = 'Cotação (R$ por BTC)';
        document.getElementById('iUnidadesAtualLabel').textContent = 'Saldo Final em SATS';
        document.getElementById('iUnidadesAtual').step = '1';
      } else {
        unidadesLabel.textContent = 'Saldo Inicial';
        unidadesInput.step = '0.00000001';
        unidadesInput.placeholder = 'Ex: 50.00';
        cotacaoLabel.textContent = 'Cotação (R$ por unidade)';
        document.getElementById('iUnidadesAtualLabel').textContent = 'Saldo Final';
        document.getElementById('iUnidadesAtual').step = '0.00000001';
      }
      updateInvestmentMainValue();
    } else if (type === 'Renda Fixa') {
      rendaFixaBox.style.display = 'contents';
      simplesBox.style.display = 'contents';
    } else {
      simplesBox.style.display = 'contents';
    }
    if (type === 'Renda Fixa') updateFixedIncomeFormCurrent();
  };
  priceChartInstances = {};
  unitsWarningLogged = new Set();
  activeFilterChoice = null;
  filterChoiceSearchTerm = '';
  FINANCIAL_INDICATORS_DOC_FIELD = 'financialIndicators';
  financialIndicatorsPersistedJson = '';
  financialIndicatorsOwnerUid = '';
  financialIndicatorsWarnedNoClient = false;
  financialIndicatorsLastError = '';


  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !currentUser) return;
    refreshFinancialIndicators();
  });

  pinUnlocked = false;
  lastPinActivity = 0;

  document.addEventListener('pointerdown', () => { if (pinUnlocked) lastPinActivity = Date.now(); }, { passive: true });
  document.addEventListener('keydown', () => { if (pinUnlocked) lastPinActivity = Date.now(); }, { passive: true });
  window.addEventListener('pagehide', () => { if (pinUnlocked && hasLocalPin()) markPinActivity(); persistPinActivity(); });
  setInterval(() => {
    if (!pinUnlocked || !currentUser || !hasLocalPin() || featureSettings.lockOnOpen === false) return;
    const grace = pinGraceMs();
    if (grace > 0 && Date.now() - lastPinActivity >= grace) lockPinNow();
  }, 20000);
  loadFeatureSettings();
  loadViewPeriod();
  setupPushForegroundHandler();
  editingGoalId = null;

  window.renderGoalsList = renderGoalsList;
  window.editGoal = function(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    editingGoalId = id;
    document.getElementById('goalNome').value = goal.name || '';
    document.getElementById('goalIcone').value = goal.icon || '🎯';
    setMoneyInput('goalValorObjetivo', goal.targetAmount || 0);
    refreshGoalCaixinhaOptions(goal.sourceId ? `${goal.sourceType}:${goal.sourceId}` : (goal.caixinhaId ? `pocket:${goal.caixinhaId}` : ''));
    document.getElementById('goalCaixinha').value = goal.sourceId ? `${goal.sourceType}:${goal.sourceId}` : (goal.caixinhaId ? `pocket:${goal.caixinhaId}` : '');
    document.getElementById('goalDataInicio').value = goal.startDate || todayISO();
    setMoneyInput('goalValorAtual', goal.currentAmount || 0);
    syncGoalLegacyAmountField();
    document.getElementById('goalPrazo').value = goal.deadline || '';
    document.getElementById('goalStatus').value = goal.status || 'active';
    document.getElementById('goalObs').value = goal.desc || '';
    document.getElementById('btnSaveGoal').textContent = 'ATUALIZAR META';
    const titleEl = document.getElementById('goalFormTitle');
    if (titleEl) titleEl.textContent = 'Editar Meta';
    if (typeof openModal === 'function') openModal('panelGoalForm');
    else document.getElementById('panelGoalForm')?.classList.add('open');
  };
  window.deleteGoal = function(id) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const linked = goal.caixinhaId ? ' A Caixinha continuará intacta.' : '';
    if (!confirm(`Excluir a Meta "${goal.name}"? Isso não afeta nenhum saldo ou lançamento.${linked}`)) return;
    const previousGoals = goals.map(item => ({ ...item }));
    goals = goals.filter(g => g.id !== id);
    if (editingGoalId === id) resetGoalForm();
    renderGoalsList();
    persistAll().catch(err => {
      goals = previousGoals;
      renderGoalsList();
      logSyncError('meta', err);
    });
  };
  const btnCancelGoalEdit = document.getElementById('btnCancelGoalEdit');
  if (btnCancelGoalEdit) {
    btnCancelGoalEdit.onclick = function() {
      resetGoalForm();
      if (typeof closeAllPanels === 'function') closeAllPanels();
    };
  }
  const goalCaixinhaEl = document.getElementById('goalCaixinha');
  if (goalCaixinhaEl) {
    goalCaixinhaEl.addEventListener('change', syncGoalLegacyAmountField);
  }
  refreshGoalCaixinhaOptions('');
  const goalDataInicioEl = document.getElementById('goalDataInicio');
  if (goalDataInicioEl) goalDataInicioEl.value = todayISO();
  syncGoalLegacyAmountField();

  const btnSaveGoalEl = document.getElementById('btnSaveGoal');
  if (btnSaveGoalEl) {
  btnSaveGoalEl.onclick = async () => {
    const name = document.getElementById('goalNome').value.trim();
    const targetAmount = readMoneyInput('goalValorObjetivo');
    const legacyCurrent = Math.max(0, Number(readMoneyInput('goalValorAtual')) || 0);
    if (!name) { alert('Informe o nome da meta.'); return; }
    if (!(Number.isFinite(targetAmount) && targetAmount > 0)) { alert('Informe um valor objetivo válido.'); return; }
    const sourceValue = document.getElementById('goalCaixinha').value || '';
    const sourceParts = sourceValue.split(':');
    const sourceType = ['bank', 'pocket', 'invest'].includes(sourceParts[0]) ? sourceParts[0] : null;
    const sourceId = sourceType && sourceParts[1] ? sourceParts.slice(1).join(':') : null;
    const caixinhaId = sourceType === 'pocket' ? sourceId : null;
    const startDate = document.getElementById('goalDataInicio').value || todayISO();
    const deadline = document.getElementById('goalPrazo').value || '';
    const status = document.getElementById('goalStatus').value || 'active';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      alert('Informe uma data de início válida.');
      return;
    }
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      alert('Informe um prazo válido.');
      return;
    }
    if (deadline && deadline < startDate) {
      alert('O prazo não pode ser anterior à data de início.');
      return;
    }

    const conflictingGoal = activeGoalForSource(
      sourceType,
      sourceId,
      editingGoalId
    );
    if (conflictingGoal) {
      const linked =
        sourceType === 'bank' ? banks.find(item => item.id === sourceId) :
        sourceType === 'pocket' ? pockets.find(item => item.id === sourceId) :
        sourceType === 'invest' ? investments.find(item => item.id === sourceId) :
        null;
      const kind =
        sourceType === 'bank' ? 'Conta' :
        sourceType === 'pocket' ? 'Caixinha' : 'Investimento';
      alert(`${kind} "${linked?.name || linked?.asset || 'selecionado'}" já está vinculada à Meta "${conflictingGoal.name}".`);
      return;
    }

    const existingGoal = editingGoalId ? goals.find(g => g.id === editingGoalId) : null;
    const record = {
      name,
      icon: document.getElementById('goalIcone').value.trim() || '🎯',
      targetAmount,
      startDate,
      deadline,
      status,
      desc: document.getElementById('goalObs').value.trim(),
      sourceType,
      sourceId,
      caixinhaId,
      caixinhaDetached: caixinhaId ? false : Boolean(existingGoal?.caixinhaDetached),
      updatedAt: new Date().toISOString()
    };

    if (!caixinhaId) {
      record.currentAmount = legacyCurrent;
    }

    if (sourceType && sourceId && status === 'active') {
      const linkedCurrent = goalCurrentAmount({ sourceType, sourceId, caixinhaId });
      if (linkedCurrent != null && linkedCurrent >= targetAmount) {
        record.status = 'completed';
      }
    }

    // O status segue o progresso: se ficou/manteve "Concluída" mas o objetivo
    // ultrapassa o acumulado (ex.: meta editada com valor maior), reabre para Ativa.
    if (record.status === 'completed') {
      const measuredCurrent = goalCurrentAmount({ sourceType, sourceId, caixinhaId, currentAmount: legacyCurrent });
      if (measuredCurrent != null && targetAmount > 0 && measuredCurrent < targetAmount) {
        record.status = 'active';
      }
    }
    const btn = document.getElementById('btnSaveGoal');
    const originalLabel = btn.textContent;
    const previousGoals = goals.map(goal => ({ ...goal }));
    btn.disabled = true; btn.textContent = 'Salvando...';
    if (editingGoalId) {
      const idx = goals.findIndex(g => g.id === editingGoalId);
      if (idx >= 0) {
        const nextGoal = { ...goals[idx], ...record };
        if (caixinhaId) delete nextGoal.currentAmount;
        goals[idx] = nextGoal;
      }
    } else {
      goals.push({ id: 'goal' + Date.now() + Math.random().toString(36).slice(2, 7), createdAt: todayISO(), ...record });
    }
    renderGoalsList();
    try {
      await persistAll();
      resetGoalForm();
      if (typeof closeAllPanels === 'function') closeAllPanels();
      try {
        const st = document.getElementById('goalsStatus');
        if (st) st.textContent = 'Meta salva.';
      } catch (e) {}
    } catch (err) {
      goals = previousGoals;
      renderGoalsList();
      logSyncError('meta', err);
      try {
        const st = document.getElementById('goalsStatus');
        if (st) st.textContent = 'Não foi possível salvar agora — tente novamente.';
      } catch (e) {}
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel || 'SALVAR META';
    }
  };
  }
  dashboardIncomeCatChartInstance = null;
  dashboardMonthlyFlowChartInstance = null;
  DASH_FILTERS_KEY = 'livrocaixa_dashboard_filters_v1';
  DASH_SCHEMA_VERSION = 1;
  DASH_DAYS_PER_MONTH = 30.4375;
  DASH_PERIODS = {
    '7d':  { label: '7 dias',  days: 7,   bucket: 'day'   },
    '30d': { label: '30 dias', days: 30,  bucket: 'chunk' },
    '6m':  { label: '6 meses', months: 6, bucket: 'month' },
    '1y':  { label: '1 ano',   months: 12, bucket: 'month' }
  };
  dashFilters = { period: '30d', account: '', compare: true, customStart: '', customEnd: '' };
  dashCommitmentsExpanded = false;


  dashLoadFilters();

  window.LivroCaixaDashboard = {
    schemaVersion: DASH_SCHEMA_VERSION,
    buildSummary: buildDashboardSummary,
    refresh: renderDashboardTab
  };
  dashFlowChartInstance = null;


  window.toggleDashCommitments = function() {
    dashCommitmentsExpanded = !dashCommitmentsExpanded;
    renderDashboardTab();
  };

  (function bindDashboardFilters() {
    const bar = document.getElementById('dashFilterBar');
    if (!bar) return;

    dashSyncPeriodPill();

    bar.querySelectorAll('[data-dash-period]').forEach(button => {
      button.addEventListener('click', () => {
        const period = button.dataset.dashPeriod;
        if (period === 'custom') {
          openCustomPeriodModal();
          return;
        }
        if (!DASH_PERIODS[period]) return;
        dashFilters.period = period;
        dashSaveFilters();
        renderDashboardTab();
      });
    });

    const select = document.getElementById('dashAccountFilter');
    select?.addEventListener('change', () => {
      dashFilters.account = select.value;
      dashSaveFilters();
      renderDashboardTab();
    });

    const compare = document.getElementById('dashCompare');
    compare?.addEventListener('change', () => {
      dashFilters.compare = Boolean(compare.checked);
      dashSaveFilters();
      renderDashboardTab();
    });
  })();
  featureSettingsAutosaveTimer = 0;
  isSaving = false;

  const FEATURE_AUTOSAVE_IDS = [
    'featureAutoBills', 'featureReminders', 'featureAutoQuotes', 'featureQuoteInterval',
    'featureProjectionMonths', 'featureAutoCategorization', 'featureReminderAdvanceDays',
    'featureSavingsGoalAmount', 'chkLockOnOpen', 'featureLockGrace'
  ];
  FEATURE_AUTOSAVE_IDS.forEach(id => document.getElementById(id)?.addEventListener('change', scheduleFeatureSettingsAutosave));
  document.getElementById('featureBudgetRows')?.addEventListener('change', scheduleFeatureSettingsAutosave);
  document.getElementById('featureBudgetRows')?.addEventListener('input', scheduleFeatureSettingsAutosave);
  compoundCalcChartInstance = null;

document.getElementById('btnRunAnomalyScan')?.addEventListener('click', runAnomalyScan);
  document.getElementById('btnGenerateMonthlyReview')?.addEventListener('click', generateMonthlyReview);
  document.getElementById('btnRunCompoundCalc')?.addEventListener('click', runCompoundInterest);
  document.getElementById('ciBenchCustom')?.addEventListener('change', (event) => {
    const rate = document.getElementById('ciBenchmarkRate');
    if (event.target.checked && rate && !rate.value) rate.value = compoundRateInputValue(compoundBenchmarkRatePct('cdi'));
  });
  document.getElementById('ciTermUnit')?.addEventListener('change', (event) => {
    const months = document.getElementById('ciMonths');
    if (months) months.max = event.target.value === 'd' ? '18000' : '600';
  });
  document.getElementById('ciRatePeriod')?.addEventListener('change', (event) => {
    const rate = document.getElementById('ciRate');
    if (!rate) return;
    const cdiMode = event.target.value === 'c';
    rate.placeholder = cdiMode ? '100' : '0,80';
    if (cdiMode && (rate.value === '' || rate.value === '0,8')) rate.value = '100';
    if (!cdiMode && rate.value === '100') rate.value = '0,8';
  });

  let pendingReconciliation = null;
  document.getElementById('btnSaveLocalPin')?.addEventListener('click', async () => { const status = document.getElementById('pinSettingsStatus'); const pin = document.getElementById('featurePin')?.value || ''; try { await saveLocalPin(pin); document.getElementById('featurePin').value = ''; status.textContent = 'PIN ativado. Você pode vincular a biometria neste aparelho.'; logInfo('Segurança', 'Ativar PIN local', 'Sucesso', 'PIN local armazenado somente como hash neste dispositivo.'); } catch (err) { status.textContent = err.message; logWarn('Segurança', 'Ativar PIN local', 'Falha', err.message); } });
  document.getElementById('btnEnableBiometric')?.addEventListener('click', async () => {
    const status = document.getElementById('pinSettingsStatus');
    try {
      await registerBiometric();
      if (status) status.textContent = 'Biometria ativada neste aparelho. No bloqueio, o sistema pedirá digital/rosto.';
      logInfo('Segurança', 'Ativar biometria', 'Sucesso', 'Credencial WebAuthn de plataforma registrada neste dispositivo.');
    } catch (err) {
      if (status) status.textContent = err.message || 'Não foi possível ativar a biometria.';
      logWarn('Segurança', 'Ativar biometria', 'Falha', err.message || String(err));
    }
  });
  document.getElementById('btnDisableBiometric')?.addEventListener('click', () => {
    removeBiometric();
    const status = document.getElementById('pinSettingsStatus');
    if (status) status.textContent = 'Biometria desativada neste aparelho. O PIN continua ativo.';
    logInfo('Segurança', 'Desativar biometria', 'Sucesso', 'Credencial biométrica removida deste dispositivo.');
  });
  document.getElementById('btnBiometricUnlock')?.addEventListener('click', async () => {
    const error = document.getElementById('pinUnlockError');
    try {
      const ok = await unlockWithBiometric();
      if (!ok) { if (error) error.textContent = 'Biometria não concluída. Ative em Perfil → Proteção local ou use o PIN.'; return; }
      if (error) error.textContent = '';
      logInfo('Segurança', 'Desbloquear biometria', 'Sucesso', 'Aplicativo desbloqueado por biometria.');
    } catch (err) {
      if (error) error.textContent = 'Biometria cancelada ou falhou. Use o PIN.';
    }
  });
  document.getElementById('btnClearLocalPin')?.addEventListener('click', () => { removeLocalPin(); const status = document.getElementById('pinSettingsStatus'); if (status) status.textContent = 'PIN removido deste dispositivo.'; logInfo('Segurança', 'Remover PIN local', 'Sucesso', 'Proteção local removida deste dispositivo.'); });
  document.getElementById('btnLockNow')?.addEventListener('click', () => { if (!hasLocalPin()) { const status = document.getElementById('pinSettingsStatus'); if (status) status.textContent = 'Ative um PIN antes de bloquear o aplicativo.'; return; } pinUnlocked = false; clearPinActivity(); closeAllPanels(); showPinOverlay(); });

  // Autosave para PIN (debounce 1s ao sair do campo)
  let pinAutosaveTimer = 0;
  document.getElementById('featurePin')?.addEventListener('blur', () => {
    clearTimeout(pinAutosaveTimer);
    pinAutosaveTimer = setTimeout(async () => {
      const pin = document.getElementById('featurePin')?.value || '';
      if (pin.length >= 4) {
        const status = document.getElementById('pinSettingsStatus');
        try {
          await saveLocalPin(pin);
          document.getElementById('featurePin').value = '';
          if (status) status.textContent = 'PIN salvo automaticamente.';
        } catch (err) {
          if (status) status.textContent = err.message;
        }
      }
    }, 1000);
  });

  // ===== V.19 — Perfil: versão, logout com confirmação, ocultar saldos =====
  const APP_VERSION_LABEL = 'Livro-Caixa V.20-02 (opencode)';
  HIDE_BALANCES_STORAGE_KEY = 'livrocaixa_hide_balances_on_open';

  document.getElementById('profileAppVersion') && (document.getElementById('profileAppVersion').textContent = APP_VERSION_LABEL);
  syncProfileEmail();
  try { auth?.onAuthStateChanged?.(() => syncProfileEmail()); } catch (e) {}


  // Acessibilidade: elementos com role=button precisam responder a Enter/Espaço.
  document.querySelectorAll('#viewProfile .profile-item[role="button"]').forEach(item => {
    item.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      item.click();
    });
  });

  document.getElementById('btnProfileLogout')?.addEventListener('click', () => {
    if (confirm('Deseja realmente sair da sua conta? Seus dados continuam salvos na nuvem — só a sessão neste aparelho é encerrada.')) {
      auth.signOut();
    }
  });
  hideBalancesOnOpen = localStorage.getItem(HIDE_BALANCES_STORAGE_KEY) === '1';

  const chkHideBalances = document.getElementById('chkHideBalancesOnOpen');
  if (chkHideBalances) {
    chkHideBalances.checked = hideBalancesOnOpen;
    chkHideBalances.addEventListener('change', () => {
      hideBalancesOnOpen = chkHideBalances.checked;
      localStorage.setItem(HIDE_BALANCES_STORAGE_KEY, chkHideBalances.checked ? '1' : '0');
      applyBalancesHiddenState(chkHideBalances.checked);
      persistProfileSettings().catch(err => logSyncError('preferência de privacidade', err));
    });
  }
  document.addEventListener('click', (e) => {
    // AD-03: ocultar/mostrar saldos somente ao tocar no valor do card Patrimônio Total
    const moneyEl = e.target.closest('.balance-card.total .amount');
    if (!moneyEl) return;
    if (e.target.closest('button, a, input, select, textarea, .btn-action, .action-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    toggleBalancesVisibility();
  }, true);
  document.addEventListener('click', (e) => {
    const title = e.target.closest('.card-title');
    if (!title || e.target.closest('button, a')) return;
    title.classList.toggle('is-expanded');
  });
  const profileReminders = document.getElementById('featureReminders');
  profileReminders?.addEventListener('change', () => {
    featureSettings = normalizeFeatureSettings({ ...featureSettings, reminders: profileReminders.checked });
    persistFeatureSettings();
    persistProfileSettings().catch(err => logSyncError('preferência de avisos', err));
    render();
  });
  const profilePush = document.getElementById('featurePushNotifications');
  profilePush?.addEventListener('change', () => { setPushNotifications(profilePush.checked); });
  const profileLockOnOpen = document.getElementById('chkLockOnOpen');
  profileLockOnOpen?.addEventListener('change', () => {
    featureSettings = normalizeFeatureSettings({ ...featureSettings, lockOnOpen: profileLockOnOpen.checked });
    persistFeatureSettings();
    persistProfileSettings().catch(err => logSyncError('preferência de proteção ao abrir', err));
  });
  autoQuotes = document.getElementById('featureAutoQuotes');
  quoteIntervalRow = document.querySelector('label[for="featureQuoteInterval"]')?.parentElement;

  autoQuotes?.addEventListener('change', toggleQuoteInterval);
  toggleQuoteInterval();
  const profileReminderAdvance = document.getElementById('featureReminderAdvanceDays');
  profileReminderAdvance?.addEventListener('change', () => {
    featureSettings = normalizeFeatureSettings({ ...featureSettings, reminderAdvanceDays: profileReminderAdvance.value });
    persistFeatureSettings();
    persistProfileSettings().catch(err => logSyncError('preferência de antecedência', err));
    render();
  });
  applyBalancesHiddenState(hideBalancesOnOpen);
  document.getElementById('btnRecEnableQuotes')?.addEventListener('click', () => {
    document.getElementById('featureAutoQuotes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('featureAutoQuotes')?.focus?.();
  });
  document.getElementById('btnRecEnableReminders')?.addEventListener('click', () => {
    document.getElementById('featureReminders')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btnRecEnableBills')?.addEventListener('click', () => {
    document.getElementById('featureAutoBills')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('btnRunDiagnostic')?.addEventListener('click', renderDiagnosticResults);

  // Console técnico global: o Perfil reutiliza exatamente o mesmo
  // painel e o mesmo histórico usado durante a autenticação.
  document.getElementById('btnOpenTechnicalDiagnostic')?.addEventListener('click', event => {
    event.preventDefault();

    if (typeof window.toggleLoginDiagnostic === 'function') {
      window.toggleLoginDiagnostic(event);
    }
  });
  AI_CHAT_GREETING = 'Olá! Eu sou a LIA.\nEstou aqui para ajudar você a entender melhor suas finanças — suas contas, gastos, metas, caixinhas e investimentos.';
  aiChat = {
    session: createAiChatSession(),
    controller: null,
    opener: null,
    pageScroll: null,
    editing: null
  };
  AI_CHAT_ERROR_MESSAGES = {
    no_data: 'Ainda não existem dados suficientes no LIVRO-CAIXA para responder. Cadastre contas, lançamentos, caixinhas, metas ou investimentos e tente de novo.',
    snapshot_too_large: 'Não foi possível preparar seus dados com segurança porque são grandes demais. Tente uma pergunta mais específica.',
    contract_unavailable: 'O contrato da IA não carregou. Verifique a conexão e recarregue a página.',
    empty_message: 'Escreva uma pergunta antes de enviar.',
    message_too_long: 'A pergunta é maior que o limite permitido. Encurte-a e tente novamente.',
    network: 'Falha de rede. Sua pergunta não foi enviada — tente novamente quando a conexão voltar.',
    offline: 'Você está offline. Conecte-se à internet para perguntar à IA.',
    rate_limited: 'Muitas perguntas agora. Aguarde alguns segundos e tente novamente.',
    daily_limit: 'A IA atingiu o limite diário de leituras. O limite volta à meia-noite (UTC).',
    empty_reply: 'A IA não retornou uma resposta utilizável. Tente novamente.',
    not_authenticated: 'Entre na sua conta para conversar com a IA.',
    token_failed: 'Não foi possível validar a sessão. Entre novamente.',
    worker_not_configured: 'O serviço de IA não está configurado.',
    bad_body: 'A requisição foi recusada pelo servidor. Tente novamente.',
    payload_too_large: 'Os dados preparados foram recusados por tamanho. Tente uma pergunta mais específica.',
    chat_payload_too_large: 'A pergunta com o contexto ficou grande demais. Tente novamente.'
  };


  /* Superfície usada pelos pontos de integração existentes (fechamento
     global de modais e limpeza de sessão) sem depender de ordem de
     declaração. */
  window.LivroCaixaChat = {
    open: openAiChat,
    close: closeAiChat,
    resetContext: resetAiChatContext,
    isOpen: () => aiChat.session.isOpen(),
    isBusy: () => aiChat.session.isBusy(),
    getMessages: () => aiChat.session.getMessages()
  };

  document.getElementById('btnAiChatClose')?.addEventListener('click', () => {
    if (typeof closeAllPanels === 'function') closeAllPanels();
  });

  document.getElementById('aiChatForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('aiChatInput');
    aiChatSend(input ? input.value : '');
  });

  /* Editando: Esc cancela a edição em vez de fechar o modal — o handler
     de Escape global está no document (fase de bubbling). */
  document.getElementById('aiChatInput')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !aiChat.editing) return;
    event.preventDefault();
    event.stopPropagation();
    aiChatCancelEdit();
  });

  /* O Chrome faz scroll-into-view DEPOIS do rAF do evento de foco.
     Por isso o reforço com 50ms (logo após o scroll nativo) e 150ms
     (quando o teclado assentou) reaplicando posição + medida. */
  const aiChatRetriggerViewportFix = () => {
    aiChatApplyViewportFix();
    window.setTimeout(aiChatApplyViewportFix, 50);
    window.setTimeout(aiChatApplyViewportFix, 150);
  };

  document.getElementById('aiChatInput')?.addEventListener('focus', () => {
    requestAnimationFrame(aiChatRetriggerViewportFix);
  });
  document.getElementById('aiChatInput')?.addEventListener('blur', () => {
    requestAnimationFrame(aiChatRetriggerViewportFix);
  });

  /* Toque/foco na área de conversa produz o mesmo deslocamento: o
     navegador rola overlay/painel para "revelar" o elemento focado e o
     cabeçalho sobe junto. Zera após o evento e trava qualquer rolagem
     residual enquanto o chat estiver aberto (nada ali deve rolar). */
  const aiChatMessagesBox = document.getElementById('aiChatMessages');
  aiChatMessagesBox?.addEventListener('pointerdown', () => requestAnimationFrame(() => aiChatResetModalScroll(true)));
  aiChatMessagesBox?.addEventListener('focus', () => requestAnimationFrame(() => aiChatResetModalScroll(true)));
  aiChatMessagesBox?.addEventListener('click', onAiChatMessagesClick);
  aiChatMessagesBox?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const bubble = event.target.closest?.('.ai-chat-msg.is-user[data-msg-index]');
    if (!bubble || event.target !== bubble) return;
    event.preventDefault();
    toggleAiChatActions(bubble);
  });

  ['modalOverlay', 'panelAiChat'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('scroll', () => {
      if (!window.LivroCaixaChat?.isOpen?.()) return;
      if (el.scrollTop || el.scrollLeft) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    }, { passive: true });
  });

  /* Teclado abrindo/fechando dispara vários resizes: corrige no rAF e
     reafirma com debounce curto quando o teclado assentou. O pan do
     Chrome sobre a viewport visual (visualViewport.scroll) e a rolagem
     da página em si também reaplicam posição + medida. */
  let aiChatViewportResetTimer = 0;
  const aiChatViewportSync = () => {
    if (!window.LivroCaixaChat?.isOpen?.()) return;
    requestAnimationFrame(aiChatApplyViewportFix);
    window.clearTimeout(aiChatViewportResetTimer);
    aiChatViewportResetTimer = window.setTimeout(aiChatApplyViewportFix, 150);
  };
  window.visualViewport?.addEventListener('resize', aiChatViewportSync);
  window.visualViewport?.addEventListener('scroll', aiChatViewportSync);
  window.addEventListener('scroll', () => {
    if (!window.LivroCaixaChat?.isOpen?.()) return;
    aiChatApplyViewportFix();
  }, { passive: true });
  inputProjectionMonths = document.getElementById('featureProjectionMonths');

  let projectionSaveTimer = null;

  if (inputProjectionMonths) {
    inputProjectionMonths.addEventListener('change', saveProjectionMonthsAutomatically);

    inputProjectionMonths.addEventListener('blur', () => {
      clearTimeout(projectionSaveTimer);
      projectionSaveTimer = setTimeout(() => {
        saveProjectionMonthsAutomatically();
      }, 150);
    });
  }

  const inputFinancialCycleDay = document.getElementById('inputFinancialCycleDay');
  if (inputFinancialCycleDay) {
    inputFinancialCycleDay.value = getFinancialCycleStartDay();
    inputFinancialCycleDay.addEventListener('change', () => {
      setFinancialCycleStartDay(inputFinancialCycleDay.value);
      inputFinancialCycleDay.value = getFinancialCycleStartDay();
      persistProfileSettings().catch(err => logSyncError('preferência de ciclo financeiro', err));
      renderFeatureProfile();
      renderAdvancedDashboard();
      renderDashboardTab();
    });
  }
  document.getElementById('btnPinUnlock')?.addEventListener('click', async () => { const input = document.getElementById('pinUnlockInput'); const error = document.getElementById('pinUnlockError'); try { const ok = await unlockWithLocalPin(input?.value || ''); if (!ok) { if (error) error.textContent = 'PIN incorreto.'; input.value = ''; input.focus(); return; } input.value = ''; if (error) error.textContent = ''; logInfo('Segurança', 'Desbloquear PIN local', 'Sucesso', 'Aplicativo desbloqueado neste dispositivo.'); } catch (err) { if (error) error.textContent = 'Não foi possível validar o PIN.'; logSyncError('desbloqueio por PIN', err); } });
  (function bindPinUnlockKeys() {
    const input = document.getElementById('pinUnlockInput');
    if (!input) return;
    const isSubmitKey = (event) => event.key === 'Enter' || event.key === 'Go' || event.key === 'Send' || event.key === 'Done' || event.key === 'Search' || event.code === 'Enter' || event.keyCode === 13;
    let lastTriggerAt = 0;
    const trigger = (event) => {
      if (!isSubmitKey(event)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastTriggerAt < 900) return;
      lastTriggerAt = now;
      document.getElementById('btnPinUnlock')?.click();
    };
    input.addEventListener('keydown', trigger);
    input.addEventListener('keyup', trigger);
  })();
  document.getElementById('btnPinLogout')?.addEventListener('click', () => auth.signOut());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (pinUnlocked && hasLocalPin()) markPinActivity(); persistPinActivity(); return; }
    if (currentUser && hasLocalPin() && featureSettings.lockOnOpen !== false) {
      const grace = pinGraceMs();
      if (grace > 0 && pinUnlocked && Date.now() - lastPinActivity < grace) return;
      lockPinNow();
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && currentUser) refreshStaleInvestmentQuotes(); });
  document.getElementById('btnRunReconciliation')?.addEventListener('click', () => {
    const bankId = document.getElementById('reconcileBank')?.value;
    const reported = readMoneyInput('reconcileReported');
    const calculated = bankBalance(bankId);
    const difference = reported - calculated;

    if (!bankId) {
      const result = document.getElementById('reconciliationResult');
      if (result) result.textContent = 'Selecione um banco para conciliar.';
      return;
    }

    if (reported <= 0) {
      const result = document.getElementById('reconciliationResult');
      if (result) result.textContent = 'Informe o saldo do extrato bancário.';
      return;
    }

    const differenceAbs = Math.abs(difference);
    const isMatch = differenceAbs <= 0.005;

    // Update reconciliation status badge
    const badge = document.getElementById('reconciliationStatusBadge');
    if (badge) {
      badge.hidden = false;
      badge.textContent = isMatch ? 'Conciliado' : 'Diferença detectada';
      badge.className = 'reconciliation-badge ' + (isMatch ? 'ok' : 'warning');
    }

    // Show balances comparison
    const balancesDiv = document.getElementById('reconciliationBalances');
    if (balancesDiv) balancesDiv.hidden = false;

    const calculatedEl = document.getElementById('reconciliationCalculated');
    if (calculatedEl) calculatedEl.textContent = fmt(calculated);

    const reportedEl = document.getElementById('reconciliationReportedValue');
    if (reportedEl) reportedEl.textContent = fmt(reported);

    const diffEl = document.getElementById('differenceAmount');
    const diffLabel = document.getElementById('differenceLabel');

    if (diffEl) {
      diffEl.textContent = fmt(differenceAbs);
      diffEl.className = 'difference-amount ' + (difference > 0 ? 'positive' : (difference < 0 ? 'negative' : 'zero'));
    }

    if (diffLabel) {
      if (isMatch) {
        diffLabel.textContent = 'Saldo conferido — nenhuma diferença';
        diffLabel.style.color = 'var(--green)';
      } else if (difference > 0) {
        diffLabel.textContent = 'O extrato bancário informa mais que o calculado';
        diffLabel.style.color = 'var(--gold)';
      } else {
        diffLabel.textContent = 'O saldo calculado é maior que o informado';
        diffLabel.style.color = 'var(--red)';
      }
    }

    // Show/hide apply button
    const applyBtn = document.getElementById('btnApplyReconciliation');
    if (applyBtn) applyBtn.hidden = Math.abs(difference) <= 0.005;

    // Update result text
    const result = document.getElementById('reconciliationResult');
    if (result) {
      if (isMatch) {
        result.textContent = `Conciliação conferida: ${fmt(calculated)}. Nenhum ajuste necessário.`;
      } else {
        result.textContent = `Saldo calculado: ${fmt(calculated)} · informado: ${fmt(reported)} · diferença sugerida: ${fmt(difference)}.`;
      }
    }

    // Store for apply action
    pendingReconciliation = isMatch ? null : { bankId, reported, calculated, difference };

    // Add to history
    addReconciliationToHistory(bankId, calculated, reported, difference, isMatch);

    logInfo('Conciliação', 'Comparar saldos', 'Sucesso', 'Comparação entre saldo calculado e informado concluída.', { bankId, difference, isMatch });
  });

  document.getElementById('btnApplyReconciliation')?.addEventListener('click', async () => {
    if (!pendingReconciliation) return;
    const bank = banks.find(item => item.id === pendingReconciliation.bankId);
    if (!bank) return;
    const amount = Math.abs(pendingReconciliation.difference);
    const category = categories.find(item => item.name === 'Outros') || categories[0];
    entries.push({
      id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
      date: todayISO(),
      desc: 'Ajuste de conciliação',
      bank: bank.id,
      category: category?.id || '',
      amount,
      type: pendingReconciliation.difference > 0 ? 'in' : 'out',
      isReconciliationAdjustment: true
    });
    try {
      await persistAll();
      logInfo('Conciliação', 'Aplicar ajuste', 'Sucesso', `Ajuste de ${fmt(amount)} aplicado em ${bank.name}.`);
    } catch (err) {
      logSyncError('ajuste de conciliação', err);
    }
    pendingReconciliation = null;
    document.getElementById('btnApplyReconciliation').hidden = true;
    document.getElementById('reconciliationResult').textContent = 'Ajuste aplicado e incorporado ao Livro-Caixa.';
    render();
  });
  ['logFilterType','logFilterModule','logFilterText'].forEach(id => document.getElementById(id)?.addEventListener('input', renderDiagnosticLog));
  document.getElementById('filterText')?.addEventListener('input', refreshFilteredViews);
  document.getElementById('btnPeriodPrev')?.addEventListener('click', () => shiftViewPeriod(-1));
  document.getElementById('btnPeriodNext')?.addEventListener('click', () => shiftViewPeriod(1));
  document.getElementById('btnPeriodAll')?.addEventListener('click', () => setViewPeriod('all'));
  document.getElementById('periodMonthInput')?.addEventListener('change', event => { if (event.target.value) setViewPeriod('month', event.target.value); });
  document.getElementById('btnPeriodPicker')?.addEventListener('click', () => { const input=document.getElementById('periodMonthInput'); if (!input) return; if (typeof input.showPicker === 'function') { try { input.showPicker(); } catch (err) { input.focus(); } } else input.focus(); });
  document.getElementById('btnCopyDiagnostico').onclick = () => {
    const text = diagnosticLog.map(item => `[${item.type}] ${item.sequence != null ? '#' + item.sequence + ' ' : ''}${formatLogTimestamp(item.timestamp || Date.now())} | ${item.module} | ${item.action} | ${item.status}${item.correlationId ? ' | op=' + item.correlationId : ''}${item.durationMs != null ? ' | duração=' + item.durationMs + 'ms' : ''}${item.synced === false ? ' | sincronização pendente' : ''} | ${item.description}${item.details ? ' | ' + JSON.stringify(item.details) : ''}`).join('\n') || 'Nenhum evento registrado.';
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(()=>alert('LOG copiado.')).catch(()=>alert(text)); else alert(text);
  };
  document.getElementById('btnClearDiagnostico').onclick = () => { if (!confirm('Limpar apenas a cópia local do LOG? O histórico remoto não será apagado.')) return; diagnosticLog.length=0; persistDiagnosticLogLocally(); renderDiagnosticLog(); };

  document.getElementById('btnOpenDrawer')?.addEventListener('click', openDrawer);
  document.getElementById('btnNotifications')?.addEventListener('click', openNotifications);
  document.getElementById('btnUniversalSearch')?.addEventListener('click', openUniversalSearch);
  document.querySelector('[data-close-search]')?.addEventListener('click', closeUniversalSearch);
  document.getElementById('universalSearchInput')?.addEventListener('input', event => renderUniversalSearchResults(event.target.value || ''));
  document.getElementById('universalSearchOverlay')?.addEventListener('click', event => { if (event.target.id === 'universalSearchOverlay') closeUniversalSearch(); });
  document.getElementById('universalSearchResults')?.addEventListener('click', event => {
    const item = event.target.closest('[data-search-kind]');
    if (item) universalSearchGo(item.dataset.searchKind, item.dataset.searchId);
  });
  document.querySelector('[data-close-drawer]')?.addEventListener('click', closeDrawer);
  document.querySelector('[data-close-notifications]')?.addEventListener('click', closeNotifications);
  document.getElementById('appDrawerOverlay')?.addEventListener('click', event => { if (event.target.id === 'appDrawerOverlay') closeDrawer(); });
  document.getElementById('notificationOverlay')?.addEventListener('click', event => { if (event.target.id === 'notificationOverlay') closeNotifications(); });
  document.querySelectorAll('[data-drawer-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.drawerAction;
    const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' });
    if (action === 'overview') { window.switchTab('caixa'); window.scrollTo({ top:0, behavior:'smooth' }); }
    if (action === 'dash') { window.switchTab('dash'); window.scrollTo({ top:0, behavior:'smooth' }); }
    if (action === 'entries') { window.switchTab('caixa'); setTimeout(() => scrollTo('ledgerBody'), 20); }
    if (action === 'bills') window.switchTab('bills');
    if (action === 'receivables') window.switchTab('receivables');
    if (action === 'cards') window.switchTab('cards');
    if (action === 'diagnostico') openDiagnostics();
    if (action === 'lab') openFeatureProfile();
    if (action === 'reports') { window.switchTab('caixa'); setTimeout(() => scrollTo('categorySummary'), 20); }
    if (action === 'pockets') window.switchTab('pockets');
    if (action === 'goals') openGoalsPanel();
    if (action === 'investments') window.switchTab('invest');
    if (action === 'banks') openBankManagementPanel();
    if (action === 'categories') document.getElementById('btnCategoria')?.click();
    if (action === 'theme') document.getElementById('btnThemeToggle')?.click();
    if (action === 'profile') { window.switchTab('profile'); window.scrollTo({ top:0, behavior:'smooth' }); }
    closeDrawer();
  }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeDrawer(); closeNotifications(); closeUniversalSearch(); } });
  document.getElementById('btnOpenFilters').onclick = () => { closeFilterChoice(); openModal('panelFiltros'); };
  document.getElementById('filterBankTrigger').onclick = () => openFilterChoice('bank');
  document.getElementById('filterCategoryTrigger').onclick = () => openFilterChoice('category');
  document.getElementById('filterChoiceClose').onclick = closeFilterChoice;
  document.getElementById('filterChoiceConfirm').onclick = closeFilterChoice;
  document.getElementById('filterChoiceSearch').addEventListener('input', event => { filterChoiceSearchTerm = event.target.value || ''; renderFilterChoiceList(); });
  document.getElementById('fCategoriaTrigger').onclick = () => openCategoryPicker();
  document.getElementById('catPickerClose').onclick = closeCategoryPicker;
  document.getElementById('catPickerSearch').addEventListener('input', event => { catPickerSearchTerm = event.target.value || ''; renderCatPickerList(); });
  document.getElementById('btnApplyFilters').onclick = () => { closeFilterChoice(); refreshFilteredViews(); closeAllPanels(); };

  document.getElementById('btnClearFilters').onclick = () => {
    document.getElementById('filterFlow').value = '';
    document.getElementById('filterDateStart').value = '';
    document.getElementById('filterDateEnd').value = '';
    clearSelectedFilterValues('filterBank');
    clearSelectedFilterValues('filterCategory');
    document.getElementById('filterText').value = '';
    refreshFilterChoiceSummaries();
    if (activeFilterChoice) renderFilterChoiceList();
    refreshFilteredViews();
  };

  window.deleteEntry = async function(id) {
    if (confirm('Deseja realmente excluir este lançamento?')) {
      entries = entries.filter(e => e.id !== id);
      await saveEntries();
      populateFilterControls();
      render();
    }
  };

  window.deleteBank = function(id) {
    if (confirm('Deseja excluir este banco? Os lançamentos permanecerão gravados.')) {
      banks = banks.filter(b => b.id !== id);
      saveBanks();
      populateFilterControls();
      render();
    }
  };

  window.deleteCategory = async function(id) {
    if (categories.length <= 1) {
      alert('Você precisa ter pelo menos uma categoria cadastrada.');
      return;
    }
    if (confirm('Deseja excluir esta categoria? Os lançamentos vinculados a ela serão movidos para outra categoria.')) {
      const replacementId = categories.find(c => c.id !== id)?.id || '';
      categories = categories.filter(c => c.id !== id);
      entries = entries.map(entry => entry.category === id ? { ...entry, category: replacementId, subcategory: '' } : entry);
      await Promise.all([saveCategories(), saveEntries()]);
      populateFilterControls();
      render();
    }
  };

  window.deleteInvest = function(id) {
    if (confirm('Deseja excluir este registro de investimento?')) {
      investments = investments.filter(i => i.id !== id);
      yieldsLog = yieldsLog.filter(y => !(y.targetType === 'invest' && y.targetId === id));
      saveInvestments().then(() => logInfo('Investimentos','Excluir investimento','Sucesso','Investimento e seu histórico foram removidos.')).catch(err => logSyncError('exclusão de investimento', err));
      render();
    }
  };
window.deletePocket = function(id) {
    if (confirm('Deseja excluir esta caixinha e todo o histórico de movimentações dela?')) {
      const yieldIdsToDelete = yieldsLog
        .filter(y => y.targetType === 'pocket' && y.targetId === id)
        .map(y => y.id);

      pockets = pockets.filter(p => p.id !== id);
      const affectedGoals = goals.filter(goal => goal.caixinhaId === id);
      goals = goals.map(goal =>
        goal.caixinhaId === id
          ? { ...goal, caixinhaId: null, caixinhaDetached: true, updatedAt: new Date().toISOString() }
          : goal
      );

      yieldsLog = yieldsLog.filter(y => !(y.targetType === 'pocket' && y.targetId === id));

      if (yieldIdsToDelete.length > 0) {
        const batch = db.batch();
        const userDocRef = db.collection('livrocaixa').doc(currentUser.uid);
        yieldIdsToDelete.forEach(yid => {
          batch.delete(userDocRef.collection('yieldsLog').doc(yid));
        });
        batch.commit().catch(err => logSyncError('exclusão de movimentações da caixinha', err));
      }

      if (affectedGoals.length) {
        alert(`${affectedGoals.length} Meta(s) mantida(s). O vínculo com a Caixinha excluída foi removido; nenhum dinheiro foi transferido.`);
      }
      persistAll().then(() => logInfo('Caixinhas','Excluir caixinha','Sucesso','Caixinha e seu histórico foram removidos.')).catch(err => logSyncError('exclusão de caixinha', err));
      render();
    }
  };

  window.editPocket = function(id) {
    const pocket = pockets.find(p => p.id === id);
    if (!pocket) return;
    editingPocketId = pocket.id;
    document.getElementById('pNome').value = pocket.name;
    document.getElementById('pObjetivo').value = pocket.goal || '';
    setMoneyInput('pMetaValor', Number(pocket.goalAmount) || 0);
    renderBankSelects();
    document.getElementById('pBancoOrigem').value = pocket.sourceBankId || '';
    setMoneyInput('pInicial', Number(pocket.initial ?? pocket.value ?? 0));
    setMoneyInput('pAtual', pocketCurrentBalance(pocket));
    document.getElementById('panelPocketTitle').innerHTML = 'Editar Caixinha <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('pSalvar').textContent = 'Atualizar Caixinha';
    openModal('panelPocket');
  };
  yieldTarget = null;
  editingYieldId = null;
  investmentMovementEditingId = null;
  pocketMovementTarget = null;
  pocketMovementEditingId = null;


  window.openInvestmentMovementModal = function(kind, id) {
    const item = investments.find(x => x.id === id);
    if (!item) return;
    investmentMovementTarget = { kind: ['aporte','resgate','rendimento'].includes(kind) ? kind : 'aporte', id };
    investmentMovementEditingId = null;
    setInvestmentMovementDefaults();
    updateInvestmentMovementUI();
    openModal('panelInvestMovement');
    const focusFieldId = isCryptoType(item.type) ? 'imQuantidade' : 'imValor';
    setTimeout(() => document.getElementById(focusFieldId)?.focus(), 80);
  };

  document.getElementById('imAporte').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'aporte'; updateInvestmentMovementUI(); } };
  document.getElementById('imResgate').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'resgate'; updateInvestmentMovementUI(); } };
  document.getElementById('imRendimento').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'rendimento'; updateInvestmentMovementUI(); } };

  window.openPocketMovementModal = function(kind, id) {
    const item = pockets.find(x => x.id === id);
    if (!item) return;
    pocketMovementTarget = { kind: ['aporte','resgate','rendimento'].includes(kind) ? kind : 'aporte', id };
    pocketMovementEditingId = null;
    document.getElementById('pmData').value = todayISO();
    setMoneyInput('pmValor', 0);
    document.getElementById('pmDesc').value = '';
    updatePocketMovementUI();
    openModal('panelPocketMovement');
  };

  document.getElementById('pmAporte').onclick = () => setPocketMovementMode('aporte');
  document.getElementById('pmResgate').onclick = () => setPocketMovementMode('resgate');
  document.getElementById('pmRendimento').onclick = () => setPocketMovementMode('rendimento');

    document.getElementById('imQuantidade').addEventListener('input', updateInvestmentMovementValue);
  document.getElementById('imCotacao').addEventListener('input', updateInvestmentMovementValue);
  document.getElementById('imFetchPrice').onclick = fetchInvestmentMovementPrice;

  window.editYield = function(yieldId) {
    const y = yieldsLog.find(x => x.id === yieldId);
    if (!y) return;
    if (y.targetType === 'invest') return loadInvestmentMovementForEdit(y);
    if (y.targetType === 'pocket') return loadPocketMovementForEdit(y);
  };

  window.deleteYield = function(yieldId) {
    const y = yieldsLog.find(x => x.id === yieldId);
    if (!y) return;
    if (!confirm('Deseja excluir este registro de movimentação? O saldo será ajustado automaticamente.')) return;
    const list = y.targetType === 'invest' ? investments : pockets;
    const item = list.find(x => x.id === y.targetId);
    if (item) {
      const isCrypto = y.targetType === 'invest' && isCryptoType(item.type) && y.units != null;
      if (isCrypto) {
        const latestPrice = item.priceHistory && item.priceHistory.length ? Number(item.priceHistory[item.priceHistory.length - 1].price) : Number(y.price || 0);
        syncDerivedCryptoValue(item, latestPrice);
        item.price = latestPrice || item.price || null;
      } else if (y.targetType === 'invest') {
        item.value = Math.max(0, (item.value || 0) - movementDelta(y));
      }
    }
    yieldsLog = yieldsLog.filter(x => x.id !== yieldId);
    if (item && y.targetType === 'invest' && item.type === 'Renda Fixa') syncDerivedInvestmentValue(item);
    persistAll();
    render();
  };

  // ===== Feature 14 — Log de alterações: painel de histórico do lançamento =====
  window.openEntryHistory = function(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const sub = document.getElementById('entryHistorySub');
    const list = document.getElementById('entryHistoryList');
    const dateFmt = iso => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso.split('-').reverse().join('/') : '—';
    const actionLabel = { create: 'Criação', update: 'Alteração' };
    const byLabel = { user: 'Você', auto: 'Automação' };
    const escVal = v => typeof v === 'number' ? fmt(v) : escapeHTML(String(v ?? '—'));
    sub.textContent = `${entry.desc || 'Lançamento'} · ${dateFmt(entry.date)} · ${fmt(entry.amount)}`;
    const history = Array.isArray(entry.history) ? entry.history : [];
    if (!history.length) {
      list.innerHTML = `<div class="empty">Sem registros de alteração para este lançamento. Lançamentos criados a partir desta versão passam a registrar criação, edição e automação aqui.</div>`;
    } else {
      list.innerHTML = [...history].reverse().map(item => {
        const at = item.at ? new Date(item.at) : null;
        const atStr = at && !isNaN(at) ? at.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const changesHtml = (Array.isArray(item.changes) && item.changes.length)
          ? `<ul class="history-changes">${item.changes.map(ch => `<li><b>${escapeHTML(String(ch.field ?? ''))}</b>: ${escVal(ch.from)} → ${escVal(ch.to)}</li>`).join('')}</ul>`
          : '';
        return `<div class="history-item">
          <div class="history-item-head">
            <span class="history-action">${actionLabel[item.action] || 'Alteração'}</span>
            <span class="history-by">${byLabel[item.by] || 'Sistema'}</span>
            <time>${atStr}</time>
          </div>
          ${changesHtml}
        </div>`;
      }).join('');
    }
    openModal('panelEntryHistory');
  };

  window.editEntry = function(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    editingEntryId = entry.id;
    document.getElementById('fData').value = entry.date;
    document.getElementById('fDesc').value = entry.desc;
    document.getElementById('fBanco').value = entry.bank;
    const catSelEntry = document.getElementById('fCategoria');
    const desiredCatValue = entry.subcategory && entry.category ? `${entry.category}::${entry.subcategory}` : entry.category;
    catSelEntry.value = Array.from(catSelEntry.options).some(o => o.value === desiredCatValue) ? desiredCatValue : entry.category;
    setMoneyInput('fValor', entry.amount);

    if (entry.type === 'in') document.getElementById('tglIn').click();
    else document.getElementById('tglOut').click();

    document.getElementById('panelNovoTitle').innerHTML = 'Editar lançamento <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('fSalvar').textContent = 'Atualizar';
    openModal('panelNovo');
  };

  window.editBank = function(id) {
    const bank = banks.find(b => b.id === id);
    if (!bank) return;
    editingBankId = bank.id;
    document.getElementById('bNome').value = bank.name;
    setMoneyInput('bSaldo', bank.initial || 0);
    document.getElementById('panelBancoTitle').innerHTML = 'Editar Banco <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('bSalvar').textContent = 'Atualizar';
    openModal('panelBanco');
  };

  window.editInvest = function(id) {
    pendingPricePoint = null;
    const inv = investments.find(i => i.id === id);
    if (!inv) return;
    editingInvestId = inv.id;
    document.getElementById('iNome').value = inv.name;
    document.getElementById('iApelido').value = inv.alias || '';
    document.getElementById('iCoinGeckoId').value = inv.coinGeckoId || '';
    document.getElementById('iTipo').value = inv.type || 'Stablecoin';
    document.getElementById('iUnidades').value = isCryptoType(inv.type) ? cryptoInitialUnits(inv) : (inv.units || '');
    document.getElementById('iUnidadesAtual').value = isCryptoType(inv.type) ? cryptoCurrentUnits(inv) : '';
    const latestQuote = inv.price != null ? inv.price : (inv.priceHistory && inv.priceHistory.length ? inv.priceHistory[inv.priceHistory.length - 1].price : '');
    setMoneyInput('iCotacao', latestQuote || 0);
    setMoneyInput('iValor', isCryptoType(inv.type) ? cryptoValueFromUnits(inv.type, cryptoCurrentUnits(inv), latestQuote || 0) : (inv.value || 0));
    setMoneyInput('iValorSimples', inv.type === 'Renda Fixa' ? fixedIncomeInitialValue(inv) : (inv.value || 0));
    setMoneyInput('iValorAtualSimples', inv.type === 'Renda Fixa' ? fixedIncomeCurrentValue(inv) : (inv.value || 0));
    document.getElementById('iInstituicao').value = inv.institution || '';
    document.getElementById('iTaxa').value = inv.rate || '';
    document.getElementById('iVencimento').value = inv.dueDate || '';
    updateInvestFormLayout();
    document.getElementById('panelInvestTitle').innerHTML = 'Editar Ativo / Cripto <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('iSalvar').textContent = 'Atualizar Ativo';
    openModal('panelInvest');
    setTimeout(() => document.getElementById('iNome')?.focus(), 80);
  };

  window.closeAllPanels = function() {
    closeFilterChoice();
    closeCategoryPicker();
    /* Limpa o estado do painel de lançamento de conta; sem isso, cancelar o
       showConfirm interno de launchBill deixava pendingBillLaunch stale. */
    pendingBillLaunch = null;
    /* Painel "compromissos do dia" é um .modal-overlay dinâmico (#bill-day-panel-v19-16).
       Sem removê-lo aqui, um Escape (handler global em keydown) escondia só o
       .panel.open interno e mantinha o overlay escuro preso na tela — deadlock
       com botão × inacessível, exigindo reload. closeBillDayPanel remove o overlay. */
    window.closeBillDayPanel?.();
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('open');
    document.querySelectorAll('.panel.open, .panel').forEach(p => p.classList.remove('open'));
    returnToEntryAfterCategory = false;
    /* Chat: cancela requisição em andamento, limpa o campo e devolve o
       foco. O contexto em memória é preservado (só troca de conta apaga). */
    window.LivroCaixaChat?.close?.();
  }

  window.applyCustomPeriod = function() {
    const start = document.getElementById('customPeriodStart')?.value;
    const end = document.getElementById('customPeriodEnd')?.value;
    
    if (!start || !end) {
      alert('Selecione data de início e fim');
      return;
    }
    
    if (new Date(start) > new Date(end)) {
      alert('Data de início deve ser anterior à data de fim');
      return;
    }
    
    dashFilters.period = 'custom';
    dashFilters.customStart = start;
    dashFilters.customEnd = end;
    dashSaveFilters();
    closeAllPanels();
    renderDashboardTab();
  }

  document.getElementById('modalOverlay').onclick = (e) => {
    if (e.target === document.getElementById('modalOverlay')) {
      closeAllPanels();
    }
  };

  document.getElementById('btnBillPrev').onclick = () => { billViewDate.setMonth(billViewDate.getMonth()-1); renderBills(); };
  document.getElementById('btnBillNext').onclick = () => { billViewDate.setMonth(billViewDate.getMonth()+1); renderBills(); };
  document.getElementById('btnBillsToday').onclick = () => { billViewDate = new Date(); renderBills(); };
  editingBillId = null;
  billViewDate = new Date();

  window.markBillPaid = markBillPaid;
  window.unmarkBillPaid = unmarkBillPaid;
  editingReceivableId = null;
  RECV_STATUS_LABEL = { pendente: 'Pendente', recebido: 'Recebido', cancelado: 'Cancelado' };

  window.editReceivable = id => openReceivableModal(id);
  window.markReceivableReceived = id => setReceivableStatus(id, 'recebido');
  window.cancelReceivable = id => {
    if (!confirm('Cancelar este valor a receber? O registro permanece no histórico com status Cancelado.')) return;
    setReceivableStatus(id, 'cancelado');
  };
  window.reopenReceivable = id => setReceivableStatus(id, 'pendente');
  document.getElementById('recvSalvar')?.addEventListener('click', () => saveReceivableRecord());
  document.getElementById('receivableStatusFilter')?.addEventListener('change', () => renderReceivables());
  document.getElementById('btnNewReceivable')?.addEventListener('click', () => openReceivableModal());
  document.getElementById('billParcelado').addEventListener('change', updateBillInstallmentFieldsVisibility);
  window.editBill = id => openBillModal(id);
  window.deleteBill = async id => { if(!await showConfirm('Excluir esta conta/fatura? Os lançamentos já gerados no Livro-Caixa serão mantidos.')) return; recurringBills=recurringBills.filter(b=>b.id!==id); await persistAll(); logInfo('Calendário','Exclusão de conta','Sucesso','Conta removida; lançamentos já realizados foram preservados.'); renderBills(); };
  pendingBillLaunch = null;

  /* launchBill é função global declarada em 25-bills-receivables.js (assinatura
     billId, monthKey, selectedBankId, btn). NÃO criar wrapper aqui: um wrapper
     que chamasse `launchBill(...)` se resolvia para ele mesmo (window.launchBill)
     e estourava RangeError — botão "Lançar" morto. */
  window.launchBill = launchBill;
  document.getElementById('billLaunchConfirm').onclick = async () => {
    if (!pendingBillLaunch) return;
    const { billId, monthKey } = pendingBillLaunch;
    const bankId = document.getElementById('billLaunchBank').value;
    pendingBillLaunch = null;
    if (billId) await launchBill(billId, monthKey, bankId);
  };
  window.openBillShare = openBillShare;

  /* billTitularFilter: NÃO adicionar outro listener 'change' aqui —
     populateBillTitularFilter (js/25-bills-receivables.js) já atribui select.onchange
     com persistência em localStorage + renderBills; dois handlers = render duplo. */
  document.getElementById('billsStatusFilter')?.addEventListener('change', renderBills);
  document.getElementById('btnExportBillsPdf').addEventListener('click', exportBillsPdf);
  document.getElementById('btnExportBillsXlsx').addEventListener('click', exportBillsXlsx);
  document.getElementById('btnCopyBillShare').addEventListener('click', async () => { const text=document.getElementById('billShareMessage').value; try { await navigator.clipboard.writeText(text); } catch (err) { const field=document.getElementById('billShareMessage'); field.focus(); field.select(); document.execCommand('copy'); } document.getElementById('billShareStatus').textContent='Mensagem copiada. Nenhum envio foi realizado.'; logInfo('Calendário','Copiar compartilhamento','Sucesso','Mensagem individual copiada para revisão do usuário.'); });
  document.getElementById('btnNativeBillShare').addEventListener('click', async () => { const text=document.getElementById('billShareMessage').value; try { if (navigator.share) await navigator.share({title:'Lembrete de pagamento',text}); else { await navigator.clipboard.writeText(text); document.getElementById('billShareStatus').textContent='Compartilhamento nativo indisponível; mensagem copiada.'; } logInfo('Calendário','Compartilhar conta','Sucesso','Compartilhamento individual iniciado pelo usuário.'); } catch (err) { if (err?.name !== 'AbortError') document.getElementById('billShareStatus').textContent='Compartilhamento cancelado ou indisponível.'; } });
receiptReaderState = null;


const RECEIPT_MAX_SIZE = 15 * 1024 * 1024;
const RECEIPT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

document.getElementById('btnReadReceipt').onclick = () => {
  document.getElementById('receiptFile')?.click();
};

document.getElementById('receiptFile').addEventListener('change', (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;

  if (!RECEIPT_ALLOWED_TYPES.has(file.type)) {
    clearReceiptReaderState();
    setReceiptFileStatus(
      'Formato não suportado. Use JPG, PNG, WEBP ou PDF.',
      true
    );
    alert('Formato de comprovante não suportado. Use JPG, PNG, WEBP ou PDF.');
    return;
  }

  if (file.size <= 0) {
    clearReceiptReaderState();
    setReceiptFileStatus('O arquivo está vazio.', true);
    alert('O arquivo selecionado está vazio.');
    return;
  }

  if (file.size > RECEIPT_MAX_SIZE) {
    clearReceiptReaderState();
    setReceiptFileStatus(
      'Arquivo muito grande. O limite para comprovantes é de 15 MB.',
      true
    );
    alert('O comprovante é muito grande. O limite é de 15 MB.');
    return;
  }

  receiptReaderState = {
    file,
    name: file.name,
    type: file.type,
    size: file.size
  };

  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  setReceiptFileStatus(
    `Comprovante selecionado: ${file.name} · ${sizeMB} MB. Pronto para análise.`
  );

  runReceiptAIAnalysis();
});
receiptAIResponseText = '';
  purchaseCalcMode = 'installment';

  document.getElementById('purchaseInstallmentValue').addEventListener('input', () => { purchaseCalcMode = 'installment'; recalcTotalFromInstallment(); });
  document.getElementById('purchaseValue').addEventListener('input', () => { if (document.getElementById('purchaseType')?.value === 'parcelado') { purchaseCalcMode = 'total'; recalcInstallmentFromTotal(); } });
  document.getElementById('purchaseInstallments').addEventListener('input', recalcFromCount);
  window.recordInvoicePayment = async function(cardId, closingPeriodKey, titular, totalAmount, paymentAmount, btn=null) {
    if(btn){ btn.disabled=true; btn.textContent='Lançando...'; }
    try {
      if (!currentUser) { showToast('Sessão expirada. Entre novamente para lançar.', 'error'); return; }
      const card = cards.find(c => c.id === cardId);
      if (!card) { showToast('Cartão não encontrado.', 'error'); return; }
      const amount = Number(paymentAmount);
      if (!(amount > 0)) { showToast('Informe um valor de pagamento válido.', 'warning'); return; }
      if (!window.LivroCaixaCardEngineV3) { showToast('Motor de cartões não carregado. Recarregue a página.', 'error'); return; }
      const validation = window.LivroCaixaCardEngineV3.validatePaymentForTitular(
        cardId,
        closingPeriodKey,
        titular,
        amount,
        purchases,
        cards,
        invoiceLaunches
      );

      if (!validation.valid) {
        if (validation.reason === 'invalid_amount') {
          showToast('Informe um valor de pagamento válido.', 'warning');
        } else if (validation.reason === 'empty_invoice') {
          showToast('Não há saldo de fatura para este titular.', 'warning');
        } else if (validation.reason === 'payment_exceeds_titular_invoice') {
          showToast(`O valor não pode ser maior que o restante (${fmt(validation.remaining)}).`, 'warning');
        } else {
          showToast('Não foi possível validar este pagamento.', 'error');
        }
        return;
      }

      const launchId = invoiceLaunchId(cardId, closingPeriodKey, titular);
      const existing = invoiceLaunches.find(x => x.id === launchId);
      const alreadyPaid = validation.alreadyPaid;
      const remaining = validation.remaining;
      const dueDate = invoiceDueDateForPeriod(card, closingPeriodKey);
      const entryId = 'e' + Date.now() + Math.random().toString(36).slice(2, 7);
      const willBeFullyPaid = amount + 0.004 >= remaining;
      const entry = { id: entryId, date: dueDate, desc: `Fatura ${card.name}${titular && titular !== 'Sem titular' ? ' — ' + titular : ''}${willBeFullyPaid ? '' : ' (parcial)'}`, bank: card.bank || '', category: card.category || categories[0]?.id || '', amount, type: 'out', invoiceLaunchId: launchId };

      // O total pagável do período inclui o saldo anterior já vencido, então o
      // pagamento é distribuído entre os períodos anteriores (mais antigo
      // primeiro) e o período atual. Uma única entrada é criada no Livro-Caixa;
      // cada período recebe seu registro em invoiceLaunches apontando para o
      // mesmo entryId, o que mantém o rollback consistente.
      const engineRef = window.LivroCaixaCardEngineV3;
      let plan = engineRef && typeof engineRef.planInvoicePayment === 'function'
        ? engineRef.planInvoicePayment(cardId, closingPeriodKey, titular, amount, purchases, cards, invoiceLaunches)
        : [];
      if (!Array.isArray(plan) || !plan.length) {
        plan = [{ periodKey: closingPeriodKey, amount: amount }];
      }

      const nowIso = new Date().toISOString();
      const touched = [];
      plan.forEach(part => {
        const partId = invoiceLaunchId(cardId, part.periodKey, titular);
        const launch = invoiceLaunches.find(x => x.id === partId);
        if (!launch) {
          invoiceLaunches.push({
            id: partId,
            cardId,
            closingPeriodKey: part.periodKey,
            titular,
            payments: [{ entryId, amount: part.amount, date: nowIso }],
            updatedAt: nowIso
          });
          touched.push({ id: partId, wasNew: true, snapshot: null });
          return;
        }
        const snapshot = JSON.parse(JSON.stringify(launch));
        if (!Array.isArray(launch.payments)) launch.payments = launch.amount ? [{ entryId: launch.entryId, amount: launch.amount, date: launch.launchedAt }] : [];
        launch.payments.push({ entryId, amount: part.amount, date: nowIso });
        launch.updatedAt = nowIso;
        touched.push({ id: partId, wasNew: false, snapshot });
      });

      entries.push(entry);
      render(); renderBills();
      try {
        await persistAll();
        const spreadCount = plan.filter(part => part.periodKey !== closingPeriodKey).length;
        logInfo('Cartões', willBeFullyPaid ? 'Lançar fatura por titular' : 'Pagamento parcial de fatura', 'Sucesso', `${card.name} — ${titular}: ${fmt(amount)} lançado${willBeFullyPaid ? ' (quitado)' : ' (parcial, restam ' + fmt(remaining - amount) + ')'}${spreadCount ? ` · abrangindo ${spreadCount} fatura(s) anterior(es)` : ''}.`, { cardId, closingPeriodKey, titular });
      } catch (err) {
        entries = entries.filter(item => item.id !== entryId);
        touched.forEach(t => {
          if (t.wasNew) {
            invoiceLaunches = invoiceLaunches.filter(item => item.id !== t.id);
          } else {
            const idx = invoiceLaunches.findIndex(x => x.id === t.id);
            if (idx >= 0) invoiceLaunches[idx] = t.snapshot;
          }
        });
        logSyncError('lançamento de fatura por titular', err);
        showToast('Não foi possível registrar esse pagamento agora. Verifique sua conexão e tente novamente.', 'error');
      } finally {
        render(); renderBills();
      }
    } finally {
      if(btn){ btn.disabled=false; btn.textContent='Lançar'; }
    }
  };


  window.shareInvoiceTitular = function(cardId, closingPeriodKey, titular, amount) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const invoiceState = window.LivroCaixaCardEngineV3.invoice(
      cardId,
      closingPeriodKey,
      purchases,
      cards,
      invoiceLaunches
    );
    const target = Array.isArray(invoiceState?.titulars)
      ? invoiceState.titulars.find(item => item.titular === titular)
      : null;
    const remaining = Number(target?.payableRemaining ?? target?.remaining ?? amount);
    const dueDate = invoiceDueDateForPeriod(card, closingPeriodKey);
    const pseudoBill = { name: `Fatura ${card.name}`, titular: titular === 'Sem titular' ? '' : titular, amount: remaining > 0.004 ? remaining : Number(amount) };
    const dueLabel = dueDate.split('-').reverse().join('/');
    const field = document.getElementById('billShareMessage');
    if (field) field.value = `📌 HELLOUUUUUUU
— ${pseudoBill.titular || 'Olá'}
Passando pra lembrar do pagamento da ${pseudoBill.name} 📃

• VENCIMENTO: ${dueLabel}
VALOR: ${fmt(pseudoBill.amount)}

📤 Enviar para a chave Pix abaixo e encaminhar comprovante:

🗝️| 85981886720
🪪| ANTONIO VINICIUS P SOBRINHO
🏦| ITAU UNIBANCO S.A.`;
    document.getElementById('billShareStatus').textContent = '';
    openModal('panelBillShare');
  };
  window.markInvoicePaidOnly = markInvoicePaidOnly;
  window.unmarkInvoicePaidOnly = unmarkInvoicePaidOnly;
  cardInvoiceSelection = {};
  purchasesUiState = { expanded: new Set(), doneOpen: new Set() };

  window.togglePurchaseDetail = (btn, cardId) => {
    const open = btn.closest('.credit-card-purchases').classList.toggle('is-expanded');
    if (open) purchasesUiState.expanded.add(cardId); else purchasesUiState.expanded.delete(cardId);
  };
  window.togglePurchaseDone = (cardId, open) => {
    if (open) purchasesUiState.doneOpen.add(cardId); else purchasesUiState.doneOpen.delete(cardId);
  };
  cardHeroState = { index: 0, started: false, bound: false, dragging: false, startX: 0, delta: 0, width: 0, key: '' };
  cardHeroClampIndex = i => Math.max(0, Math.min(cards.length - 1, i));


  window.editCard = id => openCardModal(id);
  window.shiftCardInvoice = (cardId, delta) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const nav = cardInvoiceNavState(card);
    const nextPeriod = addMonthsToPeriodKey(nav.selected, delta);
    if (!nextPeriod || nextPeriod < nav.min || nextPeriod > nav.max) return;
    cardInvoiceSelection[cardId] = nextPeriod;
    renderCards();
  };
  window.resetCardInvoice = cardId => {
    if (!(cardId in cardInvoiceSelection)) return;
    delete cardInvoiceSelection[cardId];
    renderCards();
  };
  window.editPurchase = id => openPurchaseModal('', id);
  window.openPurchaseModal = openPurchaseModal;
  window.toggleCardActive = async id => {
    const card = cards.find(c => c.id === id); if (!card) return;
    card.active = card.active === false;
    try { await persistAll(); renderCards(); logInfo('Cartões','Alterar status do cartão','Sucesso',`${card.name} agora está ${card.active ? 'ativo' : 'inativo'}.`); } catch (err) { card.active = !card.active; logSyncError('status do cartão', err); renderCards(); }
  };

  window.deletePurchase = async id => {
    const purchase = purchases.find(p => p.id === id); if (!purchase) return;
    if (!confirm(`Excluir a compra “${purchase.description || 'sem descrição'}”?`)) return;
    purchases = purchases.filter(p => p.id !== id);
    try { await persistAll(); renderCards(); logInfo('Cartões','Excluir compra','Sucesso','Compra excluída.'); } catch (err) { purchases.push(purchase); logSyncError('exclusão de compra', err); renderCards(); }
  };

  window.finalizePurchase = async id => {
    const purchase = purchases.find(p => p.id === id); if (!purchase) return;
    /* A compra NUNCA sai de `purchases` (único array persistido/exportado).
       Arquivamento é só um flag derivado — evita perda definitiva de dado. */
    const previousStatus = purchase.status || 'pendente';
    purchase.statusBeforeArchive = previousStatus;
    purchase.status = 'finalizada';
    purchase.archivedAt = new Date().toISOString();
    try { await persistAll(); renderCards(); logInfo('Cartões','Arquivar compra','Sucesso',`Compra "${purchase.description}" arquivada.`); } catch (err) { purchase.status = previousStatus; delete purchase.archivedAt; delete purchase.statusBeforeArchive; logSyncError('arquivar compra', err); renderCards(); alert('Não foi possível concluir a compra.\n' + (err && err.message ? err.message : err)); }
  };

  window.unarchivePurchase = async id => {
    const purchase = purchases.find(p => p.id === id); if (!purchase) return;
    const previousStatus = purchase.status;
    const previousArchivedAt = purchase.archivedAt;
    const previousBeforeArchive = purchase.statusBeforeArchive;
    const previousAutoBlocked = purchase.autoBlocked;
    purchase.status = previousBeforeArchive || 'pendente';
    /* ⟲ manual = "não conclua automaticamente": vence a fatura paga (manual > automático). */
    purchase.autoBlocked = true;
    delete purchase.archivedAt;
    delete purchase.statusBeforeArchive;
    try { await persistAll(); renderCards(); logInfo('Cartões','Restaurar compra','Sucesso',`Compra "${purchase.description}" reaberta.`); } catch (err) { purchase.status = previousStatus; if (previousArchivedAt !== undefined) purchase.archivedAt = previousArchivedAt; else delete purchase.archivedAt; if (previousBeforeArchive !== undefined) purchase.statusBeforeArchive = previousBeforeArchive; if (previousAutoBlocked) purchase.autoBlocked = true; else delete purchase.autoBlocked; logSyncError('restaurar compra', err); renderCards(); alert('Não foi possível reabrir a compra.\n' + (err && err.message ? err.message : err)); }
  };
  document.getElementById('cardSalvar').onclick = async () => {
    const name = document.getElementById('cardNome').value.trim();
    const closingDay = Number(document.getElementById('cardFechamento').value);
    const dueDay = Number(document.getElementById('cardVencimento').value);
    if (!name) { alert('Informe o nome do cartão.'); return; }
    if (!(closingDay >= 1 && closingDay <= 31) || !(dueDay >= 1 && dueDay <= 31)) { alert('Informe dias de fechamento e vencimento entre 1 e 31.'); return; }
    const record = normalizeCardRecord({ name, bankId: document.getElementById('cardBanco').value, titular: document.getElementById('cardTitular').value, closingDay, dueDay, limit: readMoneyInput('cardLimite'), active: document.getElementById('cardAtivo').value !== '0', obs: document.getElementById('cardObs').value }, editingCardId ? cards.find(c=>c.id===editingCardId) : { id:'card_' + Date.now() + '_' + Math.random().toString(36).slice(2,8) });
    const old = editingCardId ? cards.find(c=>c.id===editingCardId) : null;
    if (old) cards = cards.map(c => c.id === editingCardId ? record : c); else cards.push(record);
    try { await persistAll(); renderCards(); closeAllPanels(); logInfo('Cartões', old ? 'Editar cartão' : 'Criar cartão', 'Sucesso', `${record.name} salvo com identificador persistente.`); }
    catch (err) { if (old) cards = cards.map(c => c.id === editingCardId ? old : c); else cards = cards.filter(c => c.id !== record.id); logSyncError('salvamento de cartão', err); renderCards(); alert('Não foi possível salvar o cartão.'); }
  };
  document.getElementById('purchaseType').addEventListener('change', updatePurchaseInstallmentFields);
  document.getElementById('purchaseSalvar').onclick = async () => {
    const cardId = document.getElementById('purchaseCard').value;
    const description = document.getElementById('purchaseDesc').value.trim();
    const totalValue = readMoneyInput('purchaseValue');
    const date = document.getElementById('purchaseDate').value || todayISO();
    const paymentType = document.getElementById('purchaseType').value;
    if (!cardId || !cards.some(c => c.id === cardId)) { alert('Selecione um cartão válido.'); return; }
    if (!description) { alert('Informe a descrição da compra.'); return; }
    if (!(totalValue > 0)) { alert('Informe um valor total maior que zero.'); return; }
    let totalInstallments = Number(document.getElementById('purchaseInstallments').value) || 1;
    if (paymentType === 'parcelado' && !(totalInstallments >= 2 && totalInstallments <= 360)) { alert('Informe entre 2 e 360 parcelas.'); return; }
    const installmentValue = paymentType === 'parcelado' ? (readMoneyInput('purchaseInstallmentValue') || (totalValue / totalInstallments)) : totalValue;
    if (paymentType === 'parcelado' && !(installmentValue > 0)) { alert('Informe o valor da parcela.'); return; }
    const record = normalizePurchaseRecord({ cardId, description, totalValue, date, titular: document.getElementById('purchaseTitular').value, categoryId: document.getElementById('purchaseCategory').value, paymentType, totalInstallments, installmentValue, initialInstallment: document.getElementById('purchaseInitialInstallment').value, obs: document.getElementById('purchaseObs').value }, editingPurchaseId ? purchases.find(p=>p.id===editingPurchaseId) : { id:'purchase_' + Date.now() + '_' + Math.random().toString(36).slice(2,8) });
    const old = editingPurchaseId ? purchases.find(p => p.id === editingPurchaseId) : null;
    if (old) purchases = purchases.map(p => p.id === editingPurchaseId ? record : p); else purchases.push(record);
    try { await persistAll(); renderCards(); closeAllPanels(); logInfo('Cartões',old ? 'Editar compra' : 'Criar compra','Sucesso',`${record.description} vinculada ao cartão ${cards.find(c=>c.id===record.cardId)?.name || ''}.`); }
    catch (err) { if (old) purchases = purchases.map(p => p.id === editingPurchaseId ? old : p); else purchases = purchases.filter(p => p.id !== record.id); logSyncError('salvamento de compra', err); renderCards(); alert('Não foi possível salvar a compra.'); }
  };;

  document.getElementById('btnCategoria').onclick = () => {
    returnToEntryAfterCategory = false;
    editingCategoryId = null;
    categoryIconTouched = false;
    categoryIconSuggested = null;
    document.getElementById('cNome').value = '';
    document.getElementById('cIcon').value = '📦';
    document.getElementById('cSalvar').textContent = 'Adicionar';
    openModal('panelCategoria');
  };

  document.getElementById('btnTransferencia').onclick = () => {
    if (banks.length + pockets.length + investments.length < 2) {
      alert('Você precisa ter pelo menos dois destinos cadastrados para realizar transferências.');
      return;
    }
    document.getElementById('tData').value = todayISO();
    openModal('panelTransferencia');
  };

  document.getElementById('btnPasteTrigger').onclick = () => openModal('panelPaste');

  document.getElementById('btnQuickCat').onclick = () => {
    returnToEntryAfterCategory = true;
    editingCategoryId = null;
    categoryIconTouched = false;
    categoryIconSuggested = null;
    document.getElementById('cNome').value = '';
    document.getElementById('cIcon').value = '📦';
    document.getElementById('cSalvar').textContent = 'Adicionar categoria';
    openModal('panelCategoria');
    setTimeout(() => document.getElementById('cNome').focus(), 80);
  };

  document.getElementById('tglIn').onclick = () => {
    currentType = 'in';
    document.getElementById('tglIn').classList.add('active-in');
    document.getElementById('tglOut').classList.remove('active-out');
  };
  document.getElementById('tglOut').onclick = () => {
    currentType = 'out';
    document.getElementById('tglOut').classList.add('active-out');
    document.getElementById('tglIn').classList.remove('active-in');
  };
  document.getElementById('fSalvar').onclick = saveMovementFromForm;
  ocrState = { attachment: null, model: null, controller: null, busy: false, confirming: false, openedTransfer: false, sameHolder: null };
  chatProposal = {
    source: null, status: null, kind: null, rows: [], amount: null,
    attachmentId: null, data: null, error: null, saving: false
  };


  /* Transferência salva pelo painel → o comprovante confirmado fica no
     chat. Disparado por tSalvar; o listener só age se há proposta de
     transferência pendente (fechar o painel sem salvar descarta pelo
     observador do fluxo OCR). Registrado antes de tSalvar existir — a
     ordem não importa, o evento só sobe no clique. */
  window.addEventListener('lc-transfer-saved', () => {
    if (chatProposal.status === 'awaiting' && chatProposal.kind === 'transfer') {
      chatProposal.status = 'confirmed';
      chatProposal.error = null;
      window.LivroCaixaChat?.open?.();
    }
  });
  OCR_FIELD_ORDER = ['date', 'amount', 'description', 'type', 'category', 'account', 'merchant', 'paymentMethod', 'documentNumber'];
  OCR_READ_ONLY_FIELDS = ['merchant', 'paymentMethod', 'documentNumber'];
  ocrAttachmentNotice = (text, kind) => ocrShowNotice('liaAttachmentNotice', text, kind);
  ocrReviewNotice = (text, kind) => ocrShowNotice('ocrReviewNotice', text, kind);


  /* ------------------------------------------------------------- listeners */

  (function ocrWireUp() {
    const attachBtn = document.getElementById('btnLiaAttach');
    const fileInput = document.getElementById('liaAttachmentFile');
    if (!attachBtn || !fileInput) return;

    attachBtn.addEventListener('click', () => {
      if (!ocrDependenciesReady()) {
        ocrAttachmentNotice('Módulo de anexos indisponível. Recarregue a página.', 'error');
        return;
      }
      if (ocrState.busy) { ocrAttachmentNotice('Aguarde o processamento atual.', 'error'); return; }
      fileInput.click();
    });

    fileInput.addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      ocrSetFallback(false);
      ocrAttachmentNotice('');
      if (!ocrDependenciesReady()) {
        event.target.value = '';
        ocrAttachmentNotice('Módulo de anexos indisponível. Recarregue a página.', 'error');
        return;
      }
      if (ocrState.busy) {
        event.target.value = '';
        ocrAttachmentNotice('Já há um anexo em processamento.', 'error');
        return;
      }
      /* limite de 1 anexo por operação: substitui o anterior — fecha uma
         revisão aberta para não deixar campos obsoletos na tela */
      if (ocrState.attachment) ocrAbortReview('Substituindo o anexo anterior. Nada foi gravado.');

      const registration = await globalThis.LivroCaixaAttachments.manager.register(file);
      if (!registration.ok) {
        event.target.value = '';
        ocrAttachmentNotice(ocrFileErrorMessage(registration.code), 'error');
        ocrSetFallback(registration.code === 'UNSUPPORTED_FILE');
        return;
      }
      ocrState.attachment = registration.attachment;
      ocrRenderChip();
      await ocrRunPipeline(registration.attachment);
    });

    const cancelBtn = document.getElementById('btnOcrReviewCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', () => ocrAbortReview('Anexo descartado. Nada foi gravado.'));
    const closeBtn = document.getElementById('btnOcrReviewClose');
    if (closeBtn) closeBtn.addEventListener('click', () => ocrAbortReview('Revisão encerrada. Nada foi gravado.'));

    const confirmBtn = document.getElementById('btnOcrReviewConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (ocrState.confirming) return;
        const model = ocrState.model;
        if (!model) { ocrReviewNotice('Nada para confirmar.', 'error'); return; }

        const bankSelect = document.getElementById('fBanco');
        const categorySelect = document.getElementById('fCategoria');
        const bankOptions = bankSelect ? Array.from(bankSelect.options).map((o) => o.value) : [];
        const categoryOptions = categorySelect ? Array.from(categorySelect.options).map((o) => o.value) : [];

        /* validação final ANTES de tocar no fluxo financeiro */
        const result = globalThis.LivroCaixaReview.validate(model, { bankOptions, categoryOptions });
        if (!result.ok) {
          ocrShowErrors(result.errors);
          ocrReviewNotice('Confira os campos destacados antes de confirmar.', 'error');
          return;
        }
        ocrShowErrors([]);
        ocrReviewNotice('');

        ocrState.confirming = true;
        const originalLabel = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Confirmando…';
        try {
          ocrFillLaunchForm(result.value);
          /* fluxo EXISTENTE de criação: mesmas validações, mesmo saldo,
             mesma persistência, mesmos eventos e mesmo tratamento de erro */
          const saved = await saveMovementFromForm();
          if (saved) {
            /* Comprovante final no chat também para quem confirmou pela
               revisão: marca ANTES do release (que preserva "confirmed"). */
            if (chatProposal.status === 'awaiting') chatProposal.status = 'confirmed';
            ocrReleaseAll();
            window.LivroCaixaChat?.open?.();
          } else {
            ocrReviewNotice('O lançamento não foi concluído. Revise e tente novamente.', 'error');
          }
        } catch (err) {
          ocrReviewNotice('Falha inesperada ao confirmar. Nada foi gravado duas vezes.', 'error');
        } finally {
          ocrState.confirming = false;
          confirmBtn.disabled = false;
          confirmBtn.textContent = originalLabel;
        }
      });
    }

    const manualBtn = document.getElementById('btnLiaManualEntry');
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        ocrSetFallback(false);
        ocrReleaseAll();
        ocrAttachmentNotice('');
        openNewEntryModal();
      });
    }

    /* Fechamento do painel por qualquer via (Escape, clique fora, outro
       painel) → libera Blob/ObjectURL e zera o estado. */
    const reviewPanel = document.getElementById('panelOcrReview');
    if (reviewPanel && typeof MutationObserver === 'function') {
      let wasOpen = false;
      const observer = new MutationObserver(() => {
        const open = reviewPanel.classList.contains('open');
        if (wasOpen && !open && (ocrState.model || ocrState.attachment)) {
          ocrReleaseAll();
          ocrReviewNotice('');
        }
        wasOpen = open;
      });
      observer.observe(reviewPanel, { attributes: true, attributeFilter: ['class'] });
    }

    /* Mesma semântica para a Transferência universal aberta pelo balão:
       fechar (Escape, clique fora, salvar) encerra o estado da revisão —
       mas só quando o painel foi aberto pelo balão, para não afetar o
       fluxo manual de transferência. */
    const transferPanel = document.getElementById('panelTransferencia');
    if (transferPanel && typeof MutationObserver === 'function') {
      let wasOpen = false;
      const observer = new MutationObserver(() => {
        const open = transferPanel.classList.contains('open');
        if (wasOpen && !open && ocrState.openedTransfer) {
          ocrReleaseAll();
        }
        wasOpen = open;
      });
      observer.observe(transferPanel, { attributes: true, attributeFilter: ['class'] });
    }
  })();

  document.getElementById('iUnidades').addEventListener('input', updateInvestmentMainValue);
  document.getElementById('iCotacao').addEventListener('input', updateInvestmentMainValue);
  document.getElementById('iValorSimples').addEventListener('input', updateFixedIncomeFormCurrent);

  document.getElementById('iSalvar').onclick = async () => {
    const name = document.getElementById('iNome').value.trim();
    const alias = document.getElementById('iApelido').value.trim();
    const coinGeckoId = document.getElementById('iCoinGeckoId').value.trim().toLowerCase();
    const type = document.getElementById('iTipo').value;
    const isCrypto = isCryptoType(type);
    const rawUnitsInput = isCrypto ? parseFloat(document.getElementById('iUnidades').value) : NaN;
    const initialUnits = isCrypto
      ? (Number.isFinite(rawUnitsInput)
        ? (isBitcoinType(type) ? Math.round(rawUnitsInput) : Number(rawUnitsInput.toFixed(8)))
        : 0)
      : null;
    const quoteRaw = isCrypto ? readMoneyInput('iCotacao') : NaN;
    const quote = isFinite(quoteRaw) && quoteRaw > 0 ? quoteRaw : null;
    const existingItem = editingInvestId ? investments.find(i => i.id === editingInvestId) : null;
    const finalUnits = isCrypto ? Math.max(0, (initialUnits || 0) + (existingItem ? cryptoMovementTotal(existingItem) : 0)) : null;
    const units = isCrypto ? finalUnits : null;
    const value = isCrypto
      ? (quote != null && finalUnits != null ? cryptoValueFromUnits(type, finalUnits, quote) : readMoneyInput('iValor'))
      : readMoneyInput('iValorSimples');
    const initialValue = type === 'Renda Fixa' ? value : null;
    const institution = type === 'Renda Fixa' ? document.getElementById('iInstituicao').value.trim() : '';
    const rate = type === 'Renda Fixa' ? document.getElementById('iTaxa').value.trim() : '';
    const dueDate = type === 'Renda Fixa' ? document.getElementById('iVencimento').value : '';

    if (!name) { alert('Informe o nome do ativo.'); return; }
    if (isCrypto && (initialUnits == null || initialUnits < 0)) { alert('O saldo inicial não pode ser negativo.'); return; }

    const operation = beginLogOperation('Investimentos', editingInvestId ? 'Editar ativo' : 'Salvar ativo');
    logInfo('Investimentos', editingInvestId ? 'Editar ativo' : 'Salvar ativo', 'Em andamento', 'Operação de ativo iniciada.', null, operation);
    const record = { name, alias, coinGeckoId, type, units, initialUnits: isCrypto ? (initialUnits || 0) : null, value, initialValue, price: quote, institution, rate, dueDate };

    let targetItem;
    if (editingInvestId) {
      const idx = investments.findIndex(i => i.id === editingInvestId);
      if (idx !== -1) {
        const old = investments[idx];
        investments[idx] = { id: editingInvestId, createdAt: old.createdAt, order: old.order, ...(Array.isArray(old.priceHistory) ? { priceHistory: old.priceHistory } : {}), ...record };
        targetItem = investments[idx];
      }
      editingInvestId = null;
    } else {
      targetItem = { id: 'inv' + Date.now(), createdAt: todayISO(), order: investments.length, ...record };
      investments.push(targetItem);
    }

    if (targetItem && type === 'Renda Fixa') syncDerivedInvestmentValue(targetItem);
    if (isCrypto && quote != null && targetItem) {
      upsertPriceHistory(targetItem, { date: todayISO(), price: quote, units, value, source: 'manual' });
      targetItem.price = quote;
      targetItem.quoteSource = 'manual';
      targetItem.lastQuoteAt = new Date().toISOString();
    }
    pendingPricePoint = null;

    render();
    const btnSalvarInvest = document.getElementById('iSalvar');
    const originalLabel = btnSalvarInvest ? btnSalvarInvest.textContent : null;
    if (btnSalvarInvest) { btnSalvarInvest.disabled = true; btnSalvarInvest.textContent = 'Salvando...'; }
    try {
      await saveInvestments(operation);
      logInfo('Investimentos','Salvar ativo','Sucesso','Ativo salvo com separação entre quantidade e valor em BRL.', null, operation);
      closeAllPanels();
    } catch (err) {
      logSyncError('investimento', err, operation);
    } finally {
      if (btnSalvarInvest) { btnSalvarInvest.disabled = false; btnSalvarInvest.textContent = originalLabel; }
      render();
    }
  };

  document.getElementById('billSalvar').onclick = async () => {
    const name=document.getElementById('billNome').value.trim(); const amount=readMoneyInput('billValor');
    if(!name){alert('Informe o nome da conta ou fatura.');return;}
    if(!(amount>0)){alert('Informe um valor válido.');return;}
    const isInstallment = document.getElementById('billParcelado').value === '1';
    const recurrenceType=isInstallment?'recorrente':document.getElementById('billTipoOcorrencia').value; const startDate=document.getElementById('billInicio').value||todayISO();
    let installmentTotal=null, installmentStart=null, endDate=recurrenceType==='nao_recorrente'?'':document.getElementById('billFim').value||'';
    if(isInstallment){
      installmentTotal=Number(document.getElementById('billParcelasTotal').value);
      installmentStart=Number(document.getElementById('billParcelaInicial').value)||1;
      if(!(installmentTotal>=2)){alert('Informe o número total de parcelas (mínimo 2).');return;}
      if(!(installmentStart>=1&&installmentStart<=installmentTotal)){alert('A parcela inicial deve estar entre 1 e o número total de parcelas.');return;}
      const start=new Date(startDate+'T00:00:00'); const monthsRemaining=installmentTotal-installmentStart;
      const endDateObj=new Date(start.getFullYear(), start.getMonth()+monthsRemaining, start.getDate());
      endDate=`${endDateObj.getFullYear()}-${String(endDateObj.getMonth()+1).padStart(2,'0')}-${String(endDateObj.getDate()).padStart(2,'0')}`;
    }
    const titular=document.getElementById('billTitular').value.trim(); const record={name,titular,amount,bank:document.getElementById('billBanco').value,category:document.getElementById('billCategoria').value,startDate,endDate,active:document.getElementById('billAtiva').value==='1',desc:document.getElementById('billObs').value.trim(),frequency:recurrenceType==='nao_recorrente'?'once':'monthly',recurrenceType,installment:isInstallment,installmentTotal,installmentStart};
    if(editingBillId){ const idx=recurringBills.findIndex(b=>b.id===editingBillId); if(idx>=0) recurringBills[idx]={...recurringBills[idx],...record, paidMonths: Array.isArray(recurringBills[idx].paidMonths) ? recurringBills[idx].paidMonths : [], generatedMonths: Array.isArray(recurringBills[idx].generatedMonths) ? recurringBills[idx].generatedMonths : [] }; } else recurringBills.push({id:'bill'+Date.now()+Math.random().toString(36).slice(2,7),createdAt:todayISO(),generatedMonths:[],paidMonths:[],...record});
    await persistAll(); editingBillId=null; logInfo('Calendário','Salvar conta','Sucesso',`Conta ${name} salva como ${recurrenceType==='nao_recorrente'?'não recorrente':'recorrente'}.`); closeAllPanels(); renderBills();
  };;

  document.getElementById('pInicial').addEventListener('input', () => {
    const initial = readMoneyInput('pInicial');
    const current = editingPocketId ? pocketCurrentBalance(pockets.find(p => p.id === editingPocketId)) : initial;
    if (editingPocketId) {
      const pocket = pockets.find(p => p.id === editingPocketId);
      const movements = pocket ? pocketMovementTotal(pocket.id) : 0;
      setMoneyInput('pAtual', Math.max(0, initial + movements));
    } else {
      setMoneyInput('pAtual', Math.max(0, current));
    }
  });

  document.getElementById('pSalvar').onclick = async () => {
    const name = document.getElementById('pNome').value.trim();
    const goal = document.getElementById('pObjetivo').value.trim();
    const goalAmount = readMoneyInput('pMetaValor');
    const sourceBankId = document.getElementById('pBancoOrigem').value || '';
    const initial = readMoneyInput('pInicial');

    if (!name) { alert('Informe o nome da caixinha.'); return; }
    if (!isFinite(initial) || initial < 0) { alert('Informe um saldo inicial válido.'); return; }

    if (editingPocketId) {
      const idx = pockets.findIndex(p => p.id === editingPocketId);
      if (idx !== -1) {
        pockets[idx] = { ...pockets[idx], id: editingPocketId, name, goal, goalAmount: Math.max(0, goalAmount), initial, sourceBankId };
      }
      editingPocketId = null;
    } else {
      const id = 'pkt' + Date.now();
      pockets.push({ id, name, goal, goalAmount: Math.max(0, goalAmount), initial, sourceBankId, order: pockets.length });
    }

    render();
    try {
      await persistAll();
      closeAllPanels();
    } catch (err) {
      logSyncError('caixinha', err);
    } finally {
      render();
    }
  };

  document.getElementById('imSalvar').onclick = async () => {
    if (!investmentMovementTarget) return;
    const item = investments.find(x => x.id === investmentMovementTarget.id);
    if (!item) return;

    const date = document.getElementById('imData').value || todayISO();
    const desc = document.getElementById('imDesc').value.trim();
    const kind = investmentMovementTarget.kind;
    const dateEnd = date;
    const isCrypto = isCryptoType(item.type);

    let units = null;
    let price = null;
    let amount = readMoneyInput('imValor');

    if (isCrypto) {
      units = parseFloat(document.getElementById('imQuantidade').value);
      if (isBitcoinType(item.type) && isFinite(units)) units = Math.round(units);
      else if (isFinite(units)) units = Number(units.toFixed(8));
      price = readMoneyInput('imCotacao');
      if (!isFinite(units) || units <= 0) { alert('Informe uma quantidade válida.'); return; }
      if (!isFinite(price) || price <= 0) { alert('Informe uma cotação válida ou use o botão de cotação para buscá-la.'); return; }
      if (kind === 'resgate') {
        const available = cryptoCurrentUnits(item, investmentMovementEditingId);
        if (units > available + 1e-12) { alert(`O resgate não pode ser maior que o saldo disponível (${formatCryptoUnits(item.type, available, item.name)}).`); return; }
      }
      amount = cryptoValueFromUnits(item.type, units, price);
      setMoneyInput('imValor', amount);
    } else {
      if (!isFinite(amount) || amount <= 0) { alert('Informe um valor válido.'); return; }
      if (kind === 'resgate') {
        const old = investmentMovementEditingId ? yieldsLog.find(x => x.id === investmentMovementEditingId) : null;
        const available = (item.value || 0) + (old && old.kind === 'resgate' ? (old.amount || 0) : 0);
        if (amount > available + 1e-9) { alert(`O resgate não pode ser maior que o saldo atual (${fmt(available)}).`); return; }
      }
    }

    if (investmentMovementEditingId) {
      const old = yieldsLog.find(x => x.id === investmentMovementEditingId);
      if (old) {
        if (!isCrypto) {
          item.value = Math.max(0, (item.value || 0) - movementDelta(old));
          item.value += (kind === 'resgate' ? -amount : amount);
        }
        old.date = date;
        old.dateEnd = dateEnd;
        old.units = units;
        old.price = price;
        old.amount = amount;
        old.desc = desc;
        old.kind = kind;
        if (item.type === 'Renda Fixa') syncDerivedInvestmentValue(item);
      }
      investmentMovementEditingId = null;
    } else {
      if (!isCrypto) {
        item.value = (item.value || 0) + (kind === 'resgate' ? -amount : amount);
        if (item.value < 0) { alert('O resgate não pode ser maior que o saldo atual.'); item.value -= (kind === 'resgate' ? -amount : amount); return; }
      }
      yieldsLog.push({
        id: 'imv' + Date.now() + Math.random().toString(36).slice(2, 7),
        targetType: 'invest',
        targetId: item.id,
        kind,
        date,
        dateEnd,
        units,
        price,
        amount,
        desc
      });
      if (item.type === 'Renda Fixa') syncDerivedInvestmentValue(item);
    }
    const operation = beginLogOperation('Investimentos', `Movimentação — ${movementKindLabel(kind)}`);
    logInfo('Investimentos', 'Movimentação', 'Em andamento', `${movementKindLabel(kind)} iniciada para ${item.name}.`, null, operation);
    if (isCrypto) {
      syncDerivedCryptoValue(item, price);
      item.price = price;
      item.lastQuoteAt = new Date().toISOString();
      if (!item.priceHistory) item.priceHistory = [];
      const latest = item.priceHistory[item.priceHistory.length - 1];
      const pointDate = dateEnd;
      if (!latest || latest.date !== pointDate) {
        item.priceHistory.push({ date: pointDate, price, units: item.units, value: item.value });
      } else {
        latest.price = price;
        latest.units = item.units;
        latest.value = item.value;
      }
    }

    render();
    try {
      await persistAll(operation);
      logInfo('Investimentos','Salvar movimentação','Sucesso',`${movementKindLabel(kind)} registrada para ${item.name}.`, null, operation);
      investmentMovementTarget = null;
      closeAllPanels();
    } catch (err) {
      logSyncError('movimentação de investimento', err, operation);
    } finally {
      render();
    }
  };
  cryptoReconcileTarget = null;

  window.openCryptoReconcileModal = function(id) {
    const item = investments.find(x => x.id === id);
    if (!item) return;
    cryptoReconcileTarget = item.id;
    const isBtc = isBitcoinType(item.type);
    const isCrypto = isCryptoType(item.type);
    document.getElementById('panelCryptoReconcileTitle').innerHTML = `Conciliar — ${escapeHTML(item.alias || item.name)} <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    const input = document.getElementById('crSaldoReal');
    if (isCrypto) {
      document.getElementById('panelCryptoReconcileHint').textContent =
        `Informe a quantidade total que consta na corretora. A diferença em relação ao saldo atual (${formatCryptoUnits(item.type, cryptoCurrentUnits(item), item.name)}) vira um lançamento de ajuste.`;
      document.getElementById('crSaldoRealLabel').textContent = isBtc ? 'Saldo na corretora (SAT)' : 'Saldo na corretora (quantidade)';
      input.step = isBtc ? '1' : '0.00000001';
      input.placeholder = 'Ex: 11.95432727';
    } else {
      document.getElementById('panelCryptoReconcileHint').textContent =
        `Informe o saldo atual desta posição. A diferença em relação ao valor exibido (${fmt(reconcileCurrentValue(item))}) vira um lançamento de ajuste.`;
      document.getElementById('crSaldoRealLabel').textContent = 'Saldo atual na instituição (R$)';
      input.step = '0.01';
      input.placeholder = 'Ex: 1234.56';
    }
    input.value = '';
    updateCryptoReconcilePreview();
    openModal('panelCryptoReconcile');
    setTimeout(() => input.focus(), 80);
  };
  document.getElementById('crSaldoReal')?.addEventListener('input', updateCryptoReconcilePreview);
  document.getElementById('crConfirmar').onclick = async () => {
    const ctx = cryptoReconcileNumbers();
    if (!ctx) return;
    const { item, informed, diff } = ctx;
    const isCrypto = isCryptoType(item.type);
    if (informed == null) { alert(isCrypto ? 'Informe um saldo válido na corretora.' : 'Informe um saldo válido.'); return; }
    if (diff === 0) { alert('O saldo informado já confere com o saldo atual.'); return; }
    const kind = diff > 0 ? 'rendimento' : 'resgate';
    const operation = beginLogOperation('Investimentos', `Conciliação — ${movementKindLabel(kind)}`);
    let units = null;
    let price = null;
    let amount = Math.abs(diff);
    if (isCrypto) {
      units = Math.abs(diff);
      price = Number(item.price) || 0;
      amount = cryptoValueFromUnits(item.type, units, price);
    }
    logInfo('Investimentos', 'Conciliação', 'Em andamento', `Ajuste de ${isCrypto ? formatCryptoUnits(item.type, units, item.name) : fmt(amount)} iniciado para ${item.name}.`, null, operation);
    if (isCrypto) {
      yieldsLog.push({
        id: 'imv' + Date.now() + Math.random().toString(36).slice(2, 7),
        targetType: 'invest',
        targetId: item.id,
        kind,
        date: todayISO(),
        dateEnd: todayISO(),
        units,
        price,
        amount,
        desc: 'Ajuste de conciliação com a corretora'
      });
      syncDerivedCryptoValue(item);
    } else if (item.type === 'Renda Fixa') {
      yieldsLog.push({
        id: 'imv' + Date.now() + Math.random().toString(36).slice(2, 7),
        targetType: 'invest',
        targetId: item.id,
        kind,
        date: todayISO(),
        dateEnd: todayISO(),
        units,
        price,
        amount,
        desc: 'Ajuste de conciliação'
      });
      syncDerivedInvestmentValue(item);
    } else {
      const previousMovements = yieldsLog
        .filter(y => y.targetType === 'invest' && y.targetId === item.id)
        .reduce((sum, y) => sum + movementDelta(y), 0);
      item.value = informed;
      if (Math.abs(previousMovements) >= 0.005) {
        yieldsLog.push({
          id: 'imv' + Date.now() + Math.random().toString(36).slice(2, 7),
          targetType: 'invest',
          targetId: item.id,
          kind: previousMovements > 0 ? 'resgate' : 'rendimento',
          date: todayISO(),
          dateEnd: todayISO(),
          units: null,
          price: null,
          amount: Math.abs(previousMovements),
          desc: 'Ajuste de conciliação'
        });
      }
    }
    render();
    try {
      await persistAll(operation);
      logInfo('Investimentos', 'Conciliação', 'Sucesso', `Ajuste de conciliação aplicado em ${item.name}.`, { kind, amount }, operation);
      cryptoReconcileTarget = null;
      closeAllPanels();
    } catch (err) {
      logSyncError('conciliação de investimento', err, operation);
    } finally {
      render();
    }
  };

  document.getElementById('pmSalvar').onclick = async () => {
    if (!pocketMovementTarget) return;
    const item = pockets.find(x => x.id === pocketMovementTarget.id);
    if (!item) return;
    const date = document.getElementById('pmData').value || todayISO();
    const dateEnd = date;
    const amount = readMoneyInput('pmValor');
    const desc = document.getElementById('pmDesc').value.trim();
    const kind = pocketMovementTarget.kind;
    if (!isFinite(amount) || amount <= 0) { alert('Informe um valor válido.'); return; }

    const delta = kind === 'resgate' ? -amount : amount;
    const baseBalance = pocketCurrentBalance(item) - (pocketMovementEditingId ? movementDelta(yieldsLog.find(y => y.id === pocketMovementEditingId) || {}) : 0);
    if (baseBalance + delta < 0) { alert('O resgate não pode ser maior que o saldo disponível.'); return; }

    const operation = beginLogOperation('Caixinhas', `Movimentação — ${movementKindLabel(kind)}`);
    logInfo('Caixinhas', 'Movimentação', 'Em andamento', `${movementKindLabel(kind)} iniciada para ${item.name}.`, null, operation);
    if (pocketMovementEditingId) {
      const old = yieldsLog.find(x => x.id === pocketMovementEditingId);
      if (old) {
        old.date = date;
        old.dateEnd = dateEnd;
        old.amount = amount;
        old.desc = desc;
        old.kind = kind;
      }
      pocketMovementEditingId = null;
    } else {
      yieldsLog.push({
        id: 'pmv' + Date.now() + Math.random().toString(36).slice(2, 7),
        targetType: 'pocket',
        targetId: item.id,
        kind,
        date,
        dateEnd,
        amount,
        desc
      });
    }

    try {
      await persistAll(operation);
      logInfo('Caixinhas','Salvar movimentação','Sucesso',`${movementKindLabel(kind)} registrada para ${item.name}.`, null, operation);
    } catch (err) {
      logSyncError('movimentação de caixinha', err, operation);
    }
    pocketMovementTarget = null;
    closeAllPanels();
    render();
  };
  pendingPricePoint = null;


  document.getElementById('btnFetchPrice').onclick = async () => {
    const nameQuery = document.getElementById('iNome').value.trim();
    const statusEl = document.getElementById('fetchPriceStatus');
    if (!nameQuery) { statusEl.textContent = 'Digite o nome do ativo primeiro (ex: Bitcoin, USDC).'; return; }
    const operation = beginLogOperation('Cotação', 'Atualização de cotação');
    logInfo('Cotação', 'Atualização de cotação', 'Em andamento', `Consulta iniciada para ${nameQuery}.`, null, operation);
    statusEl.textContent = 'Buscando cotação...';
    const fetchIcon = document.querySelector('#btnFetchPrice .fi');
    fetchIcon?.classList.add('is-loading');
    try {
      const currentInv = editingInvestId ? investments.find(inv => inv.id === editingInvestId) : null;
      const coin = currentInv?.coinGeckoId ? { id: currentInv.coinGeckoId, symbol: currentInv.name } : await fetchCoinMatch(nameQuery);
      if (!coin) { logWarn('Cotação', 'Atualização de cotação', 'Parcial', 'Ativo não encontrado; cotação manual disponível.', null, operation); statusEl.textContent = 'Ativo não encontrado. Preencha o valor manualmente.'; return; }
      const price = await fetchCoinPriceBRL(coin.id);
      if (!price) { logWarn('Cotação', 'Atualização de cotação', 'Parcial', 'Cotação indisponível; última cotação válida preservada.', null, operation); statusEl.textContent = 'Cotação indisponível no momento.'; return; }
      setMoneyInput('iCotacao', price);
      updateInvestmentMainValue();
      pendingPricePoint = { price, units: cryptoCurrentUnits(editingInvestId ? investments.find(i=>i.id===editingInvestId) : null), value: readMoneyInput('iValor') };
      if (editingInvestId) {
        const inv=investments.find(i=>i.id===editingInvestId);
        if(inv) { inv.coinGeckoId = coin.id; await persistInvestmentQuote(inv, price, 'api', operation); render(); }
      }
      statusEl.textContent = `1 ${coin.symbol.toUpperCase()} = ${fmt(price)} · ${editingInvestId?'salvo agora':'pronto para salvar'}`;
      logInfo('Cotação', 'Atualização de cotação', 'Sucesso', `Cotação de ${coin.symbol.toUpperCase()} obtida.`, { source: 'CoinGecko' }, operation);
    } catch (err) {
      console.error(err);
      logSyncError('cotação CoinGecko', err, operation);
      statusEl.textContent = 'Erro ao buscar cotação. A última cotação válida foi preservada; informe uma cotação manual.';
    } finally {
      fetchIcon?.classList.remove('is-loading');
    }
  };
  sleep = (ms) => new Promise(res => setTimeout(res, ms));
  QUOTE_STALE_MS = 6 * 60 * 60 * 1000;

  document.getElementById('btnUpdateAllPrices').onclick = () => updateAllInvestmentPrices({ auto: false });

  document.getElementById('bSalvar').onclick = async () => {
    const name = document.getElementById('bNome').value.trim();
    const saldo = readMoneyInput('bSaldo');
    if (!name) { alert('Dê um nome ao banco.'); return; }

    if (editingBankId) {
      const idx = banks.findIndex(b => b.id === editingBankId);
      if (idx !== -1) {
        banks[idx].name = name;
        banks[idx].initial = saldo;
      }
      editingBankId = null;
    } else {
      banks.push({ id: 'b' + Date.now(), name, initial: saldo });
    }

    populateFilterControls();
    render();
    try {
      await saveBanks();
      logInfo('Bancos','Salvar banco','Sucesso',`Banco ${name} salvo.`);
      document.getElementById('bNome').value = '';
      setMoneyInput('bSaldo', 0);
      document.getElementById('panelBancoTitle').innerHTML = 'Gerenciar Bancos <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
      document.getElementById('bSalvar').textContent = 'Adicionar';
      closeAllPanels();
    } catch (err) {
      logSyncError('banco', err);
    } finally {
      render();
    }
  };

  document.getElementById('cSalvar').onclick = async () => {
    const name = document.getElementById('cNome').value.trim();
    const icon = document.getElementById('cIcon').value || '📦';
    if (!name) { alert('Dê um nome à categoria.'); return; }
    let savedCategoryId = editingCategoryId;
    if (editingCategoryId) {
      const cat = categories.find(c => c.id === editingCategoryId);
      if (cat) { cat.name = name; cat.icon = icon; }
      editingCategoryId = null;
      document.getElementById('cSalvar').textContent = 'Adicionar';
    } else {
      savedCategoryId = 'c' + Date.now();
      categories.push({ id: savedCategoryId, name, icon });
    }
    categories.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
    await saveCategories();
    logInfo('Categorias','Salvar categoria','Sucesso',`Categoria ${name} salva.`);
    populateFilterControls();
    document.getElementById('cNome').value = '';
    setCategoryDraftIcon('📦');
    render();
    if (returnToEntryAfterCategory) {
      returnToEntryAfterCategory = false;
      document.getElementById('fCategoria').value = savedCategoryId;
      openModal('panelNovo');
    }
  };

  window.editCategory = function(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    editingCategoryId = id;
    categoryIconTouched = true;
    categoryIconSuggested = null;
    document.getElementById('cNome').value = cat.name;
    setCategoryDraftIcon(categoryIcon(cat));
    document.getElementById('cSalvar').textContent = 'Salvar Alteração';
    openModal('panelCategoria');
  };

  // ===== Feature 3 — Subcategorias dentro de uma categoria principal =====
  window.addSubcategory = async function(catId) {
    const row = document.querySelector(`.cat-subs[data-cat="${catId}"]`);
    const input = row ? row.querySelector('.cat-sub-input') : null;
    if (!input) return;
    const name = input.value.trim();
    if (!name) { showToast('Digite o nome da subcategoria.', 'error'); return; }
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const subs = Array.isArray(cat.subcategories) ? cat.subcategories : [];
    if (subs.some(s => String(s.name || '').toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      showToast('Esta subcategoria já existe nesta categoria.', 'error');
      return;
    }
    subs.push({ id: 's' + Date.now() + Math.random().toString(36).slice(2, 7), name });
    cat.subcategories = subs;
    try {
      await saveCategories();
      render();
      showToast('Subcategoria adicionada.', 'success');
    } catch (err) {
      logSyncError('subcategoria', err);
      showToast('Não foi possível salvar a subcategoria.', 'error');
    }
  };

  window.removeSubcategory = async function(catId, subId) {
    const cat = categories.find(c => c.id === catId);
    if (!cat || !Array.isArray(cat.subcategories)) return;
    const sub = cat.subcategories.find(s => s.id === subId);
    const ok = await showConfirm(`Remover a subcategoria "${sub ? sub.name : ''}"? Os lançamentos dela continuam com a categoria principal.`);
    if (!ok) return;
    cat.subcategories = cat.subcategories.filter(s => s.id !== subId);
    const hadRefs = entries.some(e => e.category === catId && e.subcategory === subId);
    if (hadRefs) entries = entries.map(e => (e.category === catId && e.subcategory === subId) ? { ...e, subcategory: '' } : e);
    try {
      await Promise.all([saveCategories(), hadRefs ? saveEntries() : Promise.resolve()]);
      render();
      showToast('Subcategoria removida.', 'success');
    } catch (err) {
      logSyncError('subcategoria', err);
      showToast('Não foi possível remover a subcategoria.', 'error');
    }
  };

  document.getElementById('catManageList').addEventListener('keydown', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('cat-sub-input') && (e.key === 'Enter' || e.key === 'Go' || e.key === 'Send')) {
      e.preventDefault();
      const row = e.target.closest('.cat-subs');
      if (row) window.addSubcategory(row.dataset.cat);
    }
  });
transferReceiptReaderState = null;


const TRANSFER_RECEIPT_MAX_SIZE = 15 * 1024 * 1024;
const TRANSFER_RECEIPT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

document.getElementById('btnReadTransferReceipt').onclick = () => {
  document.getElementById('transferReceiptFile')?.click();
};

document.getElementById('transferReceiptFile').addEventListener('change', (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;

  if (!TRANSFER_RECEIPT_ALLOWED_TYPES.has(file.type)) {
    clearTransferReceiptReaderState();
    setTransferReceiptFileStatus(
      'Formato não suportado. Use JPG, PNG, WEBP ou PDF.',
      true
    );
    alert('Formato de comprovante não suportado. Use JPG, PNG, WEBP ou PDF.');
    return;
  }

  if (file.size <= 0) {
    clearTransferReceiptReaderState();
    setTransferReceiptFileStatus('O arquivo está vazio.', true);
    alert('O arquivo selecionado está vazio.');
    return;
  }

  if (file.size > TRANSFER_RECEIPT_MAX_SIZE) {
    clearTransferReceiptReaderState();
    setTransferReceiptFileStatus(
      'Arquivo muito grande. O limite para comprovantes é de 15 MB.',
      true
    );
    alert('O comprovante é muito grande. O limite é de 15 MB.');
    return;
  }

  transferReceiptReaderState = {
    file,
    name: file.name,
    type: file.type,
    size: file.size
  };

  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

  setTransferReceiptFileStatus(
    `Comprovante selecionado: ${file.name} · ${sizeMB} MB. Pronto para análise.`
  );

  runTransferReceiptAIAnalysis();
});

document.getElementById('tSalvar').onclick = async () => {
    const dateInput = document.getElementById('tData').value;

    if (transferReceiptReaderState?.aiStatus === 'completed' && !dateInput) {
      alert('A data do comprovante não foi identificada. Informe a data antes de transferir.');
      return;
    }

    const date = dateInput || todayISO();
    const deId = document.getElementById('tDe').value;
    const paraId = document.getElementById('tPara').value;
    const valor = readMoneyInput('tValor');
    const desc = document.getElementById('tDesc').value.trim();

    if (deId === paraId) {
      alert('Escolha contas diferentes para origem e destino.');
      return;
    }
    if (isNaN(valor) || valor <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    if (transferReceiptReaderState?.aiStatus === 'completed') {
      if (!deId || !paraId) {
        alert('A origem e o destino do comprovante precisam ser identificados ou selecionados antes de transferir.');
        return;
      }

      if (transferReceiptReaderState?.normalizedData?.valor === null) {
        alert('O valor do comprovante não foi identificado. Informe o valor antes de transferir.');
        return;
      }
    }

    const deBank = banks.find(b => b.id === deId);
    const dePocket = pockets.find(p => p.id === deId);
    const deInvest = investments.find(i => i.id === deId);
    const paraBank = banks.find(b => b.id === paraId);
    const paraPocket = pockets.find(p => p.id === paraId);
    const paraInvest = investments.find(i => i.id === paraId);
    let transCat = findCategoryByName('Transferência');
    const extraDesc = desc ? ` (${desc})` : '';
    const deName = deBank ? deBank.name : (dePocket ? dePocket.name + ' (Caixinha)' : (deInvest ? deInvest.name + ' (Investimento)' : ''));
    const paraName = paraBank ? paraBank.name : (paraPocket ? paraPocket.name + ' (Caixinha)' : (paraInvest ? paraInvest.name + ' (Investimento)' : ''));
    const investmentValue = inv => inv ? (inv.type === 'Renda Fixa' ? fixedIncomeCurrentValue(inv) : Number(inv.value || 0)) : 0;
    if (deInvest && investmentValue(deInvest) + 1e-9 < valor) { logWarn('Transferência', 'Transferência universal', 'Bloqueada', 'O valor excede o saldo disponível do investimento.', { amount: valor, investmentId: deInvest.id }); alert('O valor excede o saldo disponível do investimento.'); return; }
    if (deInvest && isCryptoType(deInvest.type) && !(Number(deInvest.price) > 0)) { logWarn('Transferência', 'Transferência universal', 'Bloqueada', 'O investimento de origem não possui cotação válida.'); alert('Defina uma cotação válida no investimento antes de transferir.'); return; }
    if (paraInvest && isCryptoType(paraInvest.type) && !(Number(paraInvest.price) > 0)) { logWarn('Transferência', 'Transferência universal', 'Bloqueada', 'O investimento de destino não possui cotação válida.'); alert('Defina uma cotação válida no investimento antes de transferir.'); return; }
    const operation = beginLogOperation('Transferência', 'Transferência universal');
    logInfo('Transferência', 'Transferência universal', 'Em andamento', `Transferência de ${deName} para ${paraName} iniciada.`, { amount: valor }, operation);
    if (deBank) {
      entries.push({
        id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7),
        date,
        desc: `Transferência para ${paraName}${extraDesc}`,
        bank: deId,
        category: transCat ? transCat.id : (categories[0] ? categories[0].id : ''),
        amount: valor,
        type: 'out'
      });
    } else if (dePocket) {
      yieldsLog.push({
        id: 'pmv' + Date.now() + Math.random().toString(36).slice(2, 7),
        targetType: 'pocket', targetId: dePocket.id, kind: 'resgate',
        date, dateEnd: date, amount: valor,
        desc: `Transferência para ${paraName}${extraDesc}`
      });
    } else if (deInvest) {
      const isCrypto = isCryptoType(deInvest.type);
      const units = isCrypto ? (isBitcoinType(deInvest.type) ? Math.round((valor / Math.max(Number(deInvest.price) || 0, 1e-12)) * SATS_PER_BTC) : (valor / Math.max(Number(deInvest.price) || 0, 1e-12))) : null;
      yieldsLog.push({ id: 'imv' + Date.now() + Math.random().toString(36).slice(2, 7), targetType: 'invest', targetId: deInvest.id, kind: 'resgate', date, dateEnd: date, units, price: deInvest.price || null, amount: valor, desc: `Transferência para ${paraName}${extraDesc}` });
      if (isCrypto) syncDerivedCryptoValue(deInvest, deInvest.price);
      else { deInvest.value = Math.max(0, investmentValue(deInvest) - valor); syncDerivedInvestmentValue(deInvest); }
    }

    if (paraBank) {
      entries.push({
        id: 'e' + (Date.now() + 1) + Math.random().toString(36).slice(2, 7),
        date,
        desc: `Transferência de ${deName}${extraDesc}`,
        bank: paraId,
        category: transCat ? transCat.id : (categories[0] ? categories[0].id : ''),
        amount: valor,
        type: 'in'
      });
    } else if (paraPocket) {
      yieldsLog.push({
        id: 'pmv' + (Date.now() + 1) + Math.random().toString(36).slice(2, 7),
        targetType: 'pocket', targetId: paraPocket.id, kind: 'aporte',
        date, dateEnd: date, amount: valor,
        desc: `Transferência de ${deName}${extraDesc}`
      });
    } else if (paraInvest) {
      const isCrypto = isCryptoType(paraInvest.type);
      const units = isCrypto ? (isBitcoinType(paraInvest.type) ? Math.round((valor / Math.max(Number(paraInvest.price) || 0, 1e-12)) * SATS_PER_BTC) : (valor / Math.max(Number(paraInvest.price) || 0, 1e-12))) : null;
      yieldsLog.push({ id: 'imv' + (Date.now() + 1) + Math.random().toString(36).slice(2, 7), targetType: 'invest', targetId: paraInvest.id, kind: 'aporte', date, dateEnd: date, units, price: paraInvest.price || null, amount: valor, desc: `Transferência de ${deName}${extraDesc}` });
      if (isCrypto) syncDerivedCryptoValue(paraInvest, paraInvest.price);
      else { paraInvest.value = investmentValue(paraInvest) + valor; syncDerivedInvestmentValue(paraInvest); }
    }

    try {
      await persistAll(operation);
      logInfo('Transferência','Transferência universal','Sucesso',`Transferência de ${deName} para ${paraName} registrada.`,{amount: valor}, operation);
    } catch (err) { logSyncError('transferência', err, operation); }
    populateFilterControls();
    setMoneyInput('tValor', 0);
    document.getElementById('tDesc').value = '';
    closeAllPanels();
    /* Comprovante no chat: mesmo task do closeAllPanels, ANTES do
       microtask do observador que libera o anexo (a proposta passa a
       "confirmed" e o release a preserva). Só age se há proposta de
       transferência pendente — o fluxo manual não tem nenhuma. */
    window.dispatchEvent(new Event('lc-transfer-saved'));
    render();
  };

  let pastePreviewInProgress = false;
  document.getElementById('btnReadClipboard').onclick = async () => {
    const area = document.getElementById('pasteArea');
    if (!navigator.clipboard?.readText) { setPasteStatus('O navegador não liberou a leitura automática. Cole manualmente no campo acima.'); area.focus(); return; }
    try {
      setPasteStatus('Lendo a área de transferência…');
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { setPasteStatus('A área de transferência está vazia. Cole o texto manualmente no campo acima.'); area.focus(); return; }
      area.value = text;
      setPasteStatus(`${text.trim().length.toLocaleString('pt-BR')} caracteres lidos. Revise e gere a prévia quando estiver pronto.`);
    } catch (error) {
      console.warn('Clipboard não disponível:', error);
      setPasteStatus('Permissão não concedida. Você pode colar manualmente no campo acima.');
      area.focus();
    }
  };
  document.getElementById('pasteArea').addEventListener('input', event => {
    const chars = event.target.value.trim().length;
    if (chars) setPasteStatus(`${chars.toLocaleString('pt-BR')} caracteres prontos para análise. Nenhum lançamento será criado antes da confirmação.`);
  });
  document.getElementById('btnProcessPaste').onclick = () => {
    if (pastePreviewInProgress) return;
    const txt = document.getElementById('pasteArea').value;
    if(!txt.trim()){ alert('Cole algum texto primeiro.'); return; }
    pastePreviewInProgress = true;
    const button = document.getElementById('btnProcessPaste');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Gerando prévia…';
    try {
      if (parseImportedText(txt, 'Texto colado')) {
        logInfo('Importação','Processar texto colado','Sucesso','Prévia de importação criada; nenhum lançamento foi salvo ainda.');
        document.getElementById('pasteArea').value = '';
        setPasteStatus('Prévia criada. Confira os lançamentos antes de confirmar.');
      }
    } finally {
      pastePreviewInProgress = false;
      button.disabled = false;
      button.textContent = originalLabel;
    }
  };
  document.getElementById('btnCancelPaste').onclick = () => closeAllPanels();
  document.getElementById('btnImportBackupTrigger').onclick = () => document.getElementById('fileBackupImport').click();
  let restoringBackup = false;
  document.getElementById('fileBackupImport').onchange = (ev) => {
    const file = ev.target.files[0];
    if (!file || restoringBackup) return;
    restoringBackup = true;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        if (!isValidBackupPayload(payload)) {
          alert('Arquivo de backup inválido ou incompatível com esta versão.');
          return;
        }
        const data = extractBackupData(payload);
        const { data: clean, dropped } = sanitizeBackupData(data);
        const totalDropped = Object.values(dropped).reduce((a, b) => a + b, 0);
        if (totalDropped > 0) {
          const detail = Object.entries(dropped).filter(([, n]) => n > 0).map(([k, n]) => `${n} em "${k}"`).join(', ');
          const proceed = confirm(`${totalDropped} registro(s) do backup estavam incompletos ou inválidos e serão ignorados (${detail}). Deseja continuar mesmo assim com o restante do backup?`);
          if (!proceed) { return; }
        }
        banks = clean.banks.filter(bk => bk.id !== 'geral' && String(bk.name || '').toLowerCase() !== 'geral');
        categories = clean.categories;
        entries = clean.entries;
        investments = sortDisplayOrder(clean.investments);
        pockets = sortDisplayOrder(clean.pockets);
        ensureDisplayOrder(investments);
        ensureDisplayOrder(pockets);
        yieldsLog = clean.yieldsLog;
        recurringBills = clean.recurringBills || [];
        budgets = clean.budgets || [];
        goals = clean.goals || [];
        invoiceLaunches = clean.invoiceLaunches || [];
        normalizeGoals();
        cards = clean.cards || [];
        purchases = clean.purchases || [];
        if (clean.featureSettings) { featureSettings = normalizeFeatureSettings(clean.featureSettings); persistFeatureSettings(); }
        diagnosticLog.splice(0, diagnosticLog.length, ...(clean.diagnosticLog || []).slice(0, LOG_LIMIT));
        persistDiagnosticLogLocally();
        normalizePockets();
        await persistNow();
        populateFilterControls(true);
        render();
        logInfo('Importação','Restaurar backup','Sucesso','Backup restaurado após validação e sanitização.',{schemaVersion: payload.schemaVersion || 'antiga', dropped});
        alert(`Backup restaurado com sucesso! Versão ${payload.schemaVersion || 'antiga'}.`);
      } catch(err) {
        logSyncError('restauração de backup', err);
        console.error('Falha ao restaurar backup:', err);
        alert('Não foi possível restaurar o backup. Verifique se o arquivo é um JSON válido do Livro-Caixa.');
      } finally {
        restoringBackup = false;
        ev.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  document.getElementById('btnExport').onclick = () => {
    const activeEntries = getExportEntries();
    const meta = getExportMeta(activeEntries);
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    const hasAnything = activeEntries.length > 0 || pocketsBlock.length > 0 || investBlock.length > 0;
    if (!hasAnything) { showToast('Não há dados para exportar nos filtros/período atuais.', 'warning'); return; }
    renderExportPreview(); openModal('panelExportFormat');
    logInfo('Exportação','Abertura da prévia','Sucesso','Prévia do extrato aberta.',{count: activeEntries.length});
  };
  document.getElementById('btnExportFormatPdf').onclick = () => { closeAllPanels(); exportExtractPdf(); };
  document.getElementById('btnExportFormatXlsx').onclick = () => { closeAllPanels(); exportExtractXlsx(); };
  document.getElementById('btnExportFormatDocx').onclick = () => { closeAllPanels(); exportExtractDocx().catch(err => { logSyncError('exportação DOCX', err); showToast('Não foi possível gerar o arquivo Word.', 'error'); }); };

  const PDF_IMPORT_MAX_BYTES = 12 * 1024 * 1024;
  const PDF_IMPORT_MAX_PAGES = 80;
  let pdfImportInProgress = false;
  document.getElementById('btnImportTrigger').onclick = () => document.getElementById('fileImport').click();

  document.getElementById('fileImport').onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file || pdfImportInProgress) return;
    const looksLikePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const looksLikeDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || /\.docx$/i.test(file.name || '');
    if (!looksLikePdf && !looksLikeDocx) { alert('Selecione um arquivo PDF ou DOCX válido.'); ev.target.value = ''; return; }
    if (file.size > PDF_IMPORT_MAX_BYTES) { alert('O arquivo excede o limite de 12 MB. Use um arquivo menor ou cole o texto do extrato.'); ev.target.value = ''; return; }
    if (looksLikeDocx) {
      if (typeof mammoth === 'undefined') { alert('A biblioteca de leitura de DOCX ainda está carregando.'); ev.target.value = ''; return; }
      pdfImportInProgress = true;
      const trigger = document.getElementById('btnImportTrigger');
      trigger.disabled = true;
      const label = trigger.querySelector('span:last-child');
      const originalLabel = label?.textContent || 'Importar PDF/DOCX';
      if (label) label.textContent = 'Lendo DOCX…';
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        if (!result.value.trim()) throw new Error('Não encontrei texto no DOCX.');
        parseImportedText(result.value, `DOCX · ${String(file.name || 'fechamento').slice(0, 80)}`);
        logInfo('Importação','Ler DOCX','Sucesso','Texto extraído do DOCX para revisão; nenhum lançamento foi salvo automaticamente.',{messages: result.messages?.length || 0});
      } catch (err) {
        logSyncError('importação de DOCX', err);
        alert(err?.message || 'Não foi possível ler o arquivo DOCX.');
      } finally {
        pdfImportInProgress = false;
        trigger.disabled = false;
        if (label) label.textContent = originalLabel;
        ev.target.value = '';
      }
      return;
    }
    if (typeof pdfjsLib === 'undefined') { alert('A biblioteca de leitura de PDF ainda está carregando.'); ev.target.value = ''; return; }
    pdfImportInProgress = true;
    const trigger = document.getElementById('btnImportTrigger');
    trigger.disabled = true;
    const originalLabel = trigger.querySelector('span:last-child')?.textContent || 'Importar PDF';
    const label = trigger.querySelector('span:last-child');
    if (label) label.textContent = 'Lendo PDF…';
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    try {
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      if (pdf.numPages > PDF_IMPORT_MAX_PAGES) throw new Error('O PDF possui muitas páginas para esta importação.');
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        const pageText = extractPdfPageLines(content);
        if (pageText) pages.push(pageText);
      }
      const fullText = pages.join('\n');
      if (!fullText.trim()) throw new Error('Não encontrei texto selecionável neste PDF.');
      parseImportedText(fullText, `PDF · ${String(file.name || 'extrato').slice(0, 80)}`);
      logInfo('Importação','Ler PDF','Sucesso','Texto extraído do PDF para revisão; nenhum lançamento foi salvo automaticamente.',{pages: pdf.numPages});
    } catch(err) {
      logSyncError('importação de PDF', err);
      console.error(err);
      alert(err?.message || 'Não consegui ler esse PDF. Tente usar "Colar Texto".');
    } finally {
      ev.target.value = '';
      pdfImportInProgress = false;
      trigger.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  };
  IMPORT_MAX_TEXT_LENGTH = 120000;
  IMPORT_MAX_ROWS = 250;


  // Bulk action handlers
  document.getElementById('importRemoveDuplicates')?.addEventListener('click', () => {
    pendingImport = pendingImport.filter(row => !row.duplicate);
    renderImportReview();
  });
  document.getElementById('importRemoveInvalid')?.addEventListener('click', () => {
    pendingImport = pendingImport.filter(row => row.valid);
    renderImportReview();
  });

  // Keyboard shortcuts for panelImport
  const panelImport = document.getElementById('panelImport');
  if (panelImport && !panelImport.dataset.keyHandlerAttached) {
    panelImport.dataset.keyHandlerAttached = 'true';
    panelImport.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.target.matches('input, select, textarea')) {
        e.preventDefault();
        const confirm = document.getElementById('importConfirm');
        if (confirm && !confirm.disabled) confirm.click();
      }
      if (e.key === 'Escape') {
        document.getElementById('importCancel')?.click();
      }
    });
  }

  window.updateImportRow = function(index, field, value) {
    const row = pendingImport[index];
    if (!row) return;
    row[field] = field === 'amount' ? Number.parseFloat(value) : value;
    renderImportReview();
  };
  window.removeImportRow = function(i) { pendingImport.splice(i, 1); renderImportReview(); };

  document.getElementById('importConfirm').onclick = () => {
    refreshImportFlags();
    const rowsToSave = pendingImport.filter(row => row.valid && !row.duplicate).map(({ source, valid, duplicate, rawBank, rawCategory, matchStatus, balance, ...row }) => row);
    if (!rowsToSave.length) { alert('Não há lançamentos válidos e inéditos para confirmar.'); return; }
    rowsToSave.forEach(row => entries.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7), ...row }));
    saveEntries();
    pendingImport = []; pendingImportSource = '';
    populateFilterControls();
    closeAllPanels();
    render();
  };

  document.getElementById('importCancel').onclick = () => { pendingImport = []; pendingImportSource = ''; closeAllPanels(); };

  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  // Auth handlers — só ligam se o formulário de login existir no DOM
  (function bindAuthHandlers() {
    const authToggleLink = document.getElementById('authToggleLink');
    const authSubmit = document.getElementById('authSubmit');
    const authPassToggle = document.getElementById('authPassToggle');
    const authGoogle = document.getElementById('authGoogle');

    if (!authToggleLink && !authSubmit && !authPassToggle && !authGoogle) {
      return; // tela de login antiga removida / ainda não montada
    }

    if (authToggleLink) {
      authToggleLink.onclick = () => {
        isSignupMode = !isSignupMode;
        const authTitle = document.getElementById('authTitle');
        const authSubmitBtn = document.getElementById('authSubmit');
        const authToggleWrap = document.getElementById('authToggleWrap');
        if (authTitle) authTitle.textContent = isSignupMode ? 'Criar conta' : 'Entrar';
        if (authSubmitBtn) authSubmitBtn.textContent = isSignupMode ? 'Criar conta' : 'Entrar';
        if (authToggleWrap) {
          authToggleWrap.innerHTML = isSignupMode
            ? 'Já tem conta? <a id="authToggleLink2">Entrar</a>'
            : 'Não tem conta? <a id="authToggleLink2">Criar conta</a>';
          const link2 = document.getElementById('authToggleLink2');
          if (link2) link2.onclick = authToggleLink.onclick;
        }
        setAuthError('');
      };
    }

    if (authSubmit) {
      authSubmit.onclick = () => {
        const emailEl = document.getElementById('authEmail');
        const passEl = document.getElementById('authPass');
        const email = emailEl ? emailEl.value.trim() : '';
        const pass = passEl ? passEl.value : '';
        if (!email || !pass) { setAuthError('Preencha e-mail e senha.'); return; }
        setAuthError('');
        const operation = beginLogOperation('Autenticação', isSignupMode ? 'Criar conta' : 'Entrar');
        logInfo('Autenticação', isSignupMode ? 'Criar conta' : 'Entrar', 'Em andamento', 'Solicitação de autenticação iniciada.', null, operation);
        const action = isSignupMode
          ? auth.createUserWithEmailAndPassword(email, pass)
          : auth.signInWithEmailAndPassword(email, pass);
        action.then(() => logInfo('Autenticação', isSignupMode ? 'Criar conta' : 'Entrar', 'Sucesso', 'Solicitação de autenticação concluída.', null, operation)).catch(err => {
          /* Conta QA efêmera removida no cleanup da run anterior: credencial
             inválida é comportamento esperado, não erro do usuário. Loga como
             aviso para não poluir o console com console.error de diagnóstico. */
          if (err && err.code === 'auth/invalid-credential') {
            logWarn('Autenticação', isSignupMode ? 'Criar conta' : 'Entrar', 'Falha', 'Credencial inválida ou conta não encontrada (conta efêmera pode ter sido removida).', { code: err.code }, operation);
          } else {
            logSyncError('autenticação', err, operation);
          }
          setAuthError(translateAuthError(err.code));
        });
      };
    }

    if (authPassToggle) {
      authPassToggle.onclick = () => {
        const input = document.getElementById('authPass');
        const btn = document.getElementById('authPassToggle');
        const eyeOpen = document.getElementById('eyeOpen');
        const eyeClosed = document.getElementById('eyeClosed');
        if (!input || !btn) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        if (eyeOpen) eyeOpen.style.display = showing ? 'block' : 'none';
        if (eyeClosed) eyeClosed.style.display = showing ? 'none' : 'block';
        btn.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
      };
    }

    if (authGoogle) {
      authGoogle.onclick = () => {
        setAuthError('');
        window.loginDebugLog?.(
          'GOOGLE',
          'Clique em “Entrar com Google” detectado'
        );

        const operation = beginLogOperation(
          'Autenticação',
          'Entrar com Google'
        );
        logInfo('Autenticação', 'Entrar com Google', 'Em andamento', 'Solicitação de autenticação Google iniciada.', null, operation);
        const provider = new firebase.auth.GoogleAuthProvider();

        window.loginDebugLog?.(
          'GOOGLE',
          'GoogleAuthProvider criado',
          { authDomain: window.__firebaseConfig?.authDomain }
        );

        window.loginDebugLog?.(
          'GOOGLE',
          'Modo popup selecionado'
        );

        auth.signInWithPopup(provider)
          .then(() => {
            window.loginDebugLog?.(
              'GOOGLE',
              'signInWithPopup concluído com sucesso'
            );

            logInfo(
              'Autenticação',
              'Entrar com Google',
              'Sucesso',
              'Autenticação Google concluída.',
              null,
              operation
            );
          })
          .catch(err => {
            window.loginDebugLog?.(
              'ERROR',
              'signInWithPopup falhou',
              { code: err.code, message: err.message }
            );

            if (err.code === 'auth/popup-closed-by-user') {
              window.loginDebugLog?.(
                'WARN',
                'Popup fechado pelo usuário'
              );
              return;
            }
            logSyncError('autenticação Google', err, operation);
            setAuthError(translateAuthError(err.code));
          });
      };
    }
  })();

  document.getElementById('fabAdd').onclick = () => {
    const activeTab = document.body.dataset.tab || currentTab;
    if (activeTab === 'dashboard') {
      window.LivroCaixaChat?.open();
      return;
    }
    if (activeTab === 'bills') openBillModal();
    else if (activeTab === 'receivables') openReceivableModal();
    else if (activeTab === 'invest') openNewInvestModal();
    else if (activeTab === 'pockets') openNewPocketModal();
    else if (activeTab === 'cards') openNewCardModal();
    else if (activeTab === 'goals') openNewGoalModal();
    else openNewEntryModal();
  };

  /* Atualiza aria-label do FAB quando a aba muda */
  const origSwitchTab = window.switchTab;
  if (typeof origSwitchTab === 'function') {
    window.switchTab = function(...args) {
      origSwitchTab.apply(this, args);
      const tab = document.body.dataset.tab || currentTab;
      updateFabAriaLabel(tab);
    };
  }
  /* Inicial */
  updateFabAriaLabel(document.body.dataset.tab || currentTab);

  initMoneyMasks();
  markSingleActionButtons();

  /* Rede de segurança: se a sessão não resolver em 8s (callback do Firebase
     pendurado), revela o login em vez de deixar o loader preso. Se a sessão
     chegar depois do timeout, o fluxo normal esconde o login e segue. */
  let authResolved = false;
  setTimeout(() => {
    if (authResolved) return;
    const loginOv = document.getElementById('authOverlay');
    const loaderOv = document.getElementById('syncOverlay');
    if (loaderOv) loaderOv.classList.add('hidden');
    if (loginOv) loginOv.classList.remove('hidden');
  }, 8000);

  auth.onAuthStateChanged(user => {
    authResolved = true;
    loadGeneration++;
    currentUser = user;

    window.loginDebugLog?.(
      'AUTH',
      user
        ? 'Firebase informou usuário autenticado'
        : 'Firebase informou que não há usuário autenticado',
      user
        ? { provider: user.providerData?.map(p => p.providerId) }
        : undefined
    );
    if (user) logInfo('Autenticação','Sessão iniciada','Sucesso','Usuário autenticado.');
    else if (typeof diagnosticLog !== 'undefined' && diagnosticLog.length) logInfo('Autenticação','Sessão encerrada','Sucesso','Sessão atual encerrada.');
    const overlay = document.getElementById('authOverlay');
    const syncOverlay = document.getElementById('syncOverlay');
    if (user) {
      clearSessionMemory();
      firstLoadDone = false;
      renderBalances();
      if (overlay) overlay.classList.add('hidden');
      if (syncOverlay) syncOverlay.classList.add('hidden');
      renderUserBar();
      startSessionSecurity();
      startFeatureAutomation();
      window.LivroCaixaAI?.refreshQuota?.({ throttleMs: 15000 });
      loadState();
      setTimeout(checkLocalPinLock, 700);
    } else {
      stopSessionSecurity();
      pinUnlocked = false;
      hidePinOverlay();
      clearPinActivity();
      if (featureAutomationTimer) { clearInterval(featureAutomationTimer); featureAutomationTimer = null; }
      realtimeUnsubscribers.forEach(unsub => unsub());
      realtimeUnsubscribers = [];
      lastSynced = { banks: {}, categories: {}, entries: {}, investments: {}, pockets: {}, yieldsLog: {}, recurringBills: {}, receivables: {}, budgets: {}, goals: {}, invoiceLaunches: {}, cards: {}, purchases: {} };
      banks = []; categories = []; entries = []; investments = []; pockets = []; yieldsLog = []; recurringBills = []; receivables = []; budgets = []; goals = []; cards = []; purchases = [];
      clearSessionMemory();
      firstLoadDone = false;
      renderBalances();
      if (syncOverlay) syncOverlay.classList.add('hidden');
      if (overlay) overlay.classList.remove('hidden');
      renderUserBar();
    }
  });
});
