/* LIVRO-CAIXA · js/11-financial-domain.js — domínio financeiro (app.js: 586-641). Separação por responsabilidade; conteúdo preservado. */

  /* [JS 04] DOMÍNIO FINANCEIRO / CÁLCULOS / NORMALIZAÇÕES */
  function getFinancialCycleStartDay() {
    const stored = Number(localStorage.getItem(FINANCIAL_CYCLE_STORAGE_KEY));
    return (stored >= 1 && stored <= 28) ? stored : 1;
  }
  function setFinancialCycleStartDay(day) {
    const safe = Math.min(28, Math.max(1, Number(day) || 1));
    localStorage.setItem(FINANCIAL_CYCLE_STORAGE_KEY, String(safe));
    return safe;
  }
  function financialCycleKeyForDate(dateStr) {
    const startDay = getFinancialCycleStartDay();
    const d = new Date((dateStr || todayISO()) + 'T00:00:00');
    const cycleMonthIndex = d.getDate() >= startDay ? d.getMonth() : d.getMonth() - 1;
    const cd = new Date(d.getFullYear(), cycleMonthIndex, 1);
    return `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`;
  }
  function financialCycleRangeForKey(cycleKey) {
    const startDay = getFinancialCycleStartDay();
    const [y, m] = cycleKey.split('-').map(Number);
    const start = new Date(y, m - 1, startDay);
    const end = new Date(y, m, startDay - 1);
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: toISO(start), end: toISO(end) };
  }
  function currentFinancialCycleKey() { return financialCycleKeyForDate(todayISO()); }
  let BUDGET_ALERT_STORAGE_KEY;

  function getShownBudgetAlerts() {
    try { return JSON.parse(localStorage.getItem(BUDGET_ALERT_STORAGE_KEY) || '{}'); } catch (err) { return {}; }
  }
  function markBudgetAlertShown(key) {
    const shown = getShownBudgetAlerts();
    shown[key] = true;
    try { localStorage.setItem(BUDGET_ALERT_STORAGE_KEY, JSON.stringify(shown)); } catch (err) {}
  }


  // Segurança: os dados financeiros podem conter texto fornecido pelo usuário.
  // Nunca interpolamos texto bruto em HTML.
  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let BACKUP_SCHEMA_VERSION;

  let SESSION_IDLE_MS;
 // 30 minutos de inatividade
  let sessionIdleTimer;

  let sessionLastActivity;

  let sessionSecurityStarted;
