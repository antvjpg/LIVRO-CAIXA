/* LIVRO-CAIXA · js/12-auth-session.js — sessão e autenticação (app.js: 644-701). Separação por responsabilidade; conteúdo preservado. */


  /* [JS 05] AUTENTICAÇÃO / SESSÃO */
  function clearSessionMemory() {
    pendingImport = [];
    /* Conversa da IA é memória de sessão: login, logout ou troca de conta
       descartam o contexto (nada é persistido fora da memória). */
    window.LivroCaixaChat?.resetContext?.();
    editingEntryId = null;
    editingBankId = null;
    editingCategoryId = null;
    editingInvestId = null;
    editingPocketId = null;
    investmentMovementTarget = null;
    investmentMovementEditingId = null;
    editingCardId = null;
    editingPurchaseId = null;
    pocketMovementTarget = null;
    pocketMovementEditingId = null;
    yieldTarget = null;
    editingYieldId = null;
    closeAllPanels();
    ['authPass','authEmail'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function stopSessionSecurity() {
    if (sessionIdleTimer) {
      clearTimeout(sessionIdleTimer);
      sessionIdleTimer = null;
    }
  }

  function lockSessionForInactivity() {
    stopSessionSecurity();
    if (!currentUser) return;
    setAuthError('Sessão encerrada por 30 minutos de inatividade. Entre novamente para continuar.');
    clearSessionMemory();
    auth.signOut();
  }

  function scheduleSessionTimeout() {
    stopSessionSecurity();
    if (!currentUser) return;
    sessionLastActivity = Date.now();
    sessionIdleTimer = setTimeout(lockSessionForInactivity, SESSION_IDLE_MS);
  }

  function registerSessionActivity() {
    if (!currentUser) return;
    const now = Date.now();
    sessionLastActivity = now;
    if (sessionIdleTimer) {
      clearTimeout(sessionIdleTimer);
      sessionIdleTimer = setTimeout(lockSessionForInactivity, SESSION_IDLE_MS);
    }
  }

  function startSessionSecurity() {
    if (sessionSecurityStarted) return;
    sessionSecurityStarted = true;
    ['pointerdown','keydown','touchstart','click'].forEach(evt => {
      document.addEventListener(evt, registerSessionActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
      if (!currentUser || document.hidden) return;
      if (Date.now() - sessionLastActivity >= SESSION_IDLE_MS) {
        lockSessionForInactivity();
      } else {
        registerSessionActivity();
      }
    });
    scheduleSessionTimeout();
  }
