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

  /* Moeda de exibição: armazenamento e digitação continuam em BRL (evita
     drift de arredondamento); só a exibição converte, com a taxa em reais
     por unidade da moeda escolhida (taxa preenchida por refreshDisplayRate). */
  let MONEY_DISPLAY = { code: 'BRL', rateBRL: 1 };

  const MONEY_DISPLAY_SYMBOLS = { BRL: 'R$ ', USD: 'US$ ', BTC: '₿ ' };

  function moneyToDisplay(valueBRL) {
    if (MONEY_DISPLAY.code === 'BRL' || !(MONEY_DISPLAY.rateBRL > 0)) return valueBRL;
    return valueBRL / MONEY_DISPLAY.rateBRL;
  }

  function moneyDisplaySymbol() {
    return MONEY_DISPLAY_SYMBOLS[MONEY_DISPLAY.code] || MONEY_DISPLAY_SYMBOLS.BRL;
  }

  function moneyDisplayFormat(absDisplay) {
    return absDisplay.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: MONEY_DISPLAY.code === 'BTC' ? 8 : 2
    });
  }


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

  // ===== Feature 14 — Log de alterações embutido em cada lançamento =====
  // entry.history: array de { at, action: 'create'|'update', by: 'user'|'auto', changes?: [{field, from, to}] }
  // Mantido no próprio lançamento (sem coleção nova); cap de 20 eventos por lançamento.
  const ENTRY_HISTORY_LIMIT = 20;

  function appendEntryHistory(entry, event) {
    if (!entry || typeof entry !== 'object' || !event || typeof event !== 'object') return entry;
    const item = { at: new Date().toISOString(), action: String(event.action || 'update'), by: String(event.by || 'user') };
    if (Array.isArray(event.changes) && event.changes.length) item.changes = event.changes;
    const prev = Array.isArray(entry.history) ? entry.history : [];
    entry.history = prev.length >= ENTRY_HISTORY_LIMIT ? [...prev.slice(-(ENTRY_HISTORY_LIMIT - 1)), item] : [...prev, item];
    return entry;
  }

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

/* Normalizadores compartilhados de comprovante (26-receipts / 30-transfer-receipts). */
function normalizeReceiptText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeReceiptDate(value) {
  if (value == null || value === '') return null;

  let text = String(value).trim();
  if (!text) return null;

  /* Ignora horário/fuso quando vier junto: "2026-09-24T10:15:00-03:00" */
  const isoWithTime = text.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (isoWithTime) text = isoWithTime[1];

  const isValidIso = (iso) => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  if (/^\d{4}-\d{2}-\d{2}$/.test(text) && isValidIso(text)) {
    return text;
  }

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
    const iso = text.replace(/\//g, '-');
    if (isValidIso(iso)) return iso;
  }

  /* 24/09/2026, 24-09-2026, 24.09.2026 e dígitos simples */
  const dayFirst = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    if (isValidIso(iso)) return iso;
  }

  return null;
}

function normalizeReceiptValue(value) {
  if (value == null || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  let text = String(value).trim();

  if (!text) return null;

  text = text
    .replace(/\s/g, '')
    .replace(/R\$/gi, '');

  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }

  const number = Number(text);

  return Number.isFinite(number) && number >= 0 ? number : null;
}
