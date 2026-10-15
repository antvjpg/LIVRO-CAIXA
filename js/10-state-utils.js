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

  // ===== Toast/Notification System =====
  let toastContainer = null;
  let toastIdCounter = 0;

  function ensureToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 360px;
      `;
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  function showToast(message, type = 'info', duration = 4000) {
    const container = ensureToastContainer();
    const id = ++toastIdCounter;
    const colors = {
      error: { bg: '#fdecea', border: '#f5c6c2', color: '#8a1f11' },
      success: { bg: '#e6f7ee', border: '#b7ecc0', color: '#1a6b2d' },
      warning: { bg: '#fff8e1', border: '#ffe082', color: '#8a6d00' },
      info: { bg: '#f0f4ff', border: '#d0dcfd', color: '#1a3c6e' }
    };
    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.id = `toast-${id}`;
    toast.style.cssText = `
      background: ${c.bg};
      border: 1px solid ${c.border};
      color: ${c.color};
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      font-size: 14px;
      line-height: 1.4;
      opacity: 0;
      transform: translateX(100%);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: auto;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    const remove = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 200);
    };

    const timer = setTimeout(remove, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(remove, duration));

    return { id, remove };
  }

  window.showToast = showToast;

  // ===== Modal de Confirmação Customizado =====
  let confirmResolve = null;

  function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
      confirmResolve = resolve;
      const overlay = document.createElement('div');
      overlay.id = 'custom-confirm-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.2s ease;
      `;
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: white;
        padding: 24px;
        border-radius: 12px;
        max-width: 320px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        transform: scale(0.95);
        transition: transform 0.2s ease;
      `;
      modal.innerHTML = `
        <p style="margin: 0 0 20px; font-size: 15px; color: #1a1a1a; line-height: 1.5;"></p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="confirm-cancel" style="padding: 10px 16px; border: 1px solid #c9d1d9; background: white; border-radius: 6px; cursor: pointer; font-size: 14px;"></button>
          <button id="confirm-ok" style="padding: 10px 16px; border: 1px solid #0b5fff; background: #0b5fff; color: white; border-radius: 6px; cursor: pointer; font-size: 14px;"></button>
        </div>
      `;
      modal.querySelector('p').textContent = message;
      modal.querySelector('#confirm-cancel').textContent = options.cancelText || 'Cancelar';
      modal.querySelector('#confirm-ok').textContent = options.okText || 'Confirmar';
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });

      const cleanup = (result) => {
        overlay.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        setTimeout(() => overlay.remove(), 200);
        confirmResolve = null;
        resolve(result);
      };

      overlay.querySelector('#confirm-ok').onclick = () => cleanup(true);
      overlay.querySelector('#confirm-cancel').onclick = () => cleanup(false);
      overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
  }

  window.showConfirm = showConfirm;
