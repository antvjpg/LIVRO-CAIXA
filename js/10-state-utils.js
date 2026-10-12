/* LIVRO-CAIXA · js/10-state-utils.js — estado global, utilitários e domínio básico (app.js: 482-584). Separação por responsabilidade; conteúdo preservado. */

  /* [JS 02] ESTADO GLOBAL / COLLECTIONS */
  let banks;

  let categories;

  let entries;

  let investments;

  let pockets;

  let yieldsLog;

  let recurringBills;

  let receivables;

  let budgets;

  let goals;

  let invoiceLaunches;

  let cards;

  let purchases;

  let editingCardId;

  let editingPurchaseId;

  let pendingImport;

  let FEATURE_SETTINGS_KEY;

  let featureSettings;

  let FCM_TOKEN_KEY;

  let pushForegroundBound;

  let featureAutomationTimer;

  let pendingImportSource;

  let currentType;

  let editingEntryId;

  let editingBankId;

  let editingCategoryId;

  let editingInvestId;

  let editingPocketId;

  let investmentMovementTarget;
 // { kind: 'aporte'|'resgate'|'rendimento', id }
  let catChartInstances;

  let catChartOutsideClickHandler;


  /* [JS 03] UTILITÁRIOS / FORMATAÇÃO / DOM */
  let normalizeMoney;

  let fmt;

  /* Valores abaixo de 1 centavo não podem passar por normalizeMoney (que zera
     |v| < 0,005) — senão 0,0049 sai como R$ 0,00. Mantém no mínimo 4 casas
     (acima de 1 centavo continua igual ao fmt) e até 8 para preservar precisão. */
  let fmtPrecise;

  let MONEY_FORMATTER;


  function moneyDigits(value) {
    return String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  }

  function formatMoneyFromCents(cents) {
    return MONEY_FORMATTER.format((Number(cents) || 0) / 100);
  }

  function setMoneyInput(target, amount) {
    const input = typeof target === 'string' ? document.getElementById(target) : target;
    if (!input) return;
    input.value = MONEY_FORMATTER.format(Number(amount) || 0);
  }

  function readMoneyInput(target) {
    const input = typeof target === 'string' ? document.getElementById(target) : target;
    if (!input) return 0;
    return Number(moneyDigits(input.value)) / 100;
  }

  function applyMoneyMask(input) {
    input.value = formatMoneyFromCents(moneyDigits(input.value));
  }

  function initMoneyMasks() {
    document.querySelectorAll('input[data-money="true"]').forEach(input => {
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'off');
      input.addEventListener('input', () => applyMoneyMask(input));
      input.addEventListener('focus', () => { if (!input.value) setMoneyInput(input, 0); });
    });
  }
  let todayISO;

  let currentMonthYM;

  // ===== V.19 — Ciclo financeiro personalizado (aplicado por enquanto só ao Orçamento; gráficos/resumos
  // continuam usando mês de calendário — expandir gradualmente, essa mudança em tudo de uma vez é arriscada) =====
  let FINANCIAL_CYCLE_STORAGE_KEY;
