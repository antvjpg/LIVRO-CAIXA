if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'Plus Jakarta Sans';
  Chart.defaults.font.weight = '500';
}
/* [JS 01] CONFIGURAÇÃO / FIREBASE / BOOTSTRAP BASE */
const firebaseConfig = {
  apiKey: "AIzaSyADRwvRCaOB0Q8QvDeDfReVeMzK_m4KqlA",
  authDomain: "livro-caixa-54357.firebaseapp.com",
  projectId: "livro-caixa-54357",
  storageBucket: "livro-caixa-54357.firebasestorage.app",
  messagingSenderId: "508374087306",
  appId: "1:508374087306:web:43a797d57ca6e548655f73"
};
window.__firebaseConfig = firebaseConfig;
window.__FCM_VAPID_KEY = "BJ_SAUk9tFJPLKxXGNqu0v3uDpyyhPeqyKaz7myEixa3an_MZQ79jk9zMypKIq0ZjuKS0j_V_8Cz1clFtfsPhu8";

/* [JS AI] Cliente único de IA. Modo principal: Worker do Cloudflare (chave no servidor, sessão Firebase).
   Modo fallback: chave OpenRouter digitada pelo usuário, guardada só neste dispositivo (localStorage). */
const OPENROUTER_API_KEY_STORAGE_KEY = 'livrocaixa_openrouter_api_key';
const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_DEFAULT_MAX_TOKENS = 900;
/* URL do Worker. Vazia = só o modo local (chave no dispositivo) é usado. */
const AI_WORKER_ENDPOINT = 'https://livro-caixa-ai.livro-caixa-ai.workers.dev/ai';

/* [JS INDICADORES] Base do Worker para GET /financial: mesma origem da IA,
   derivada da URL acima (nada de host novo no código). Vazia = adaptador
   desligado e o app segue normalmente. */
window.LivroCaixaFinancial?.configure?.({
  baseUrl: String(AI_WORKER_ENDPOINT || '').replace(/\/ai$/, ''),
  ttlMs: 6 * 60 * 60 * 1000
});

window.LivroCaixaAI = {
  getApiKey() {
    try { return localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY) || ''; } catch (err) { return ''; }
  },
  setApiKey(rawKey) {
    const key = String(rawKey || '').replace(/\s+/g, '');
    try {
      if (!key) {
        localStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY);
        return false;
      }
      localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, key);
      return true;
    } catch (err) {
      return false;
    }
  },
  clearApiKey() {
    try { localStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY); } catch (err) {}
  },
  hasLocalKey() {
    return Boolean(this.getApiKey());
  },
  isReady() {
    if (this.getApiKey()) return true;
    try {
      return typeof auth !== 'undefined' && Boolean(auth?.currentUser);
    } catch (err) {
      return false;
    }
  },
  buildContent(text, imagePart) {
    if (imagePart && imagePart.image_url && imagePart.image_url.url) {
      return [
        { type: 'text', text },
        { type: 'image_url', image_url: { url: imagePart.image_url.url } }
      ];
    }
    return text;
  },
  /* Caminho principal e protegido: ID token do Firebase → Worker (POST /ai)
     → OpenRouter. O Worker aplica autenticação, rate limit, cota diária e
     validação de prompt/imagem/maxTokens antes de chamar o provedor. */
  /* Transporte único de POST para /ai: autenticação, cota, parse de erro e
     leitura da resposta. Compartilhado pelo caminho legado (prompt/imagem)
     e pelo chat — existe UM envio de IA no frontend, não dois. */
  async postWorker(payload, { signal } = {}) {
    if (!AI_WORKER_ENDPOINT) {
      const err = new Error('O serviço de IA não está configurado.');
      err.code = 'worker_not_configured';
      throw err;
    }

    let user = null;
    try {
      user = typeof auth !== 'undefined' ? auth?.currentUser : null;
    } catch (err) {
      user = null;
    }

    if (!user) {
      const err = new Error('Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida.');
      err.code = 'not_authenticated';
      throw err;
    }

    let idToken = '';
    let appCheckToken = '';
    try {
      idToken = await user.getIdToken();
      if (typeof firebase !== 'undefined' && firebase.appCheck) {
        const appCheckResult = await firebase.appCheck().getToken(false);
        appCheckToken = appCheckResult?.token || '';
      }
    } catch (err) {
      const tokenErr = new Error('Não foi possível validar a sessão para usar a IA.');
      tokenErr.code = 'token_failed';
      throw tokenErr;
    }

    const init = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    };
    if (appCheckToken) {
      init.headers['X-Firebase-AppCheck'] = appCheckToken;
    }
    if (signal) init.signal = signal;

    let response;
    try {
      response = await fetch(AI_WORKER_ENDPOINT, init);
    } catch (networkError) {
      /* Cancelamento explícito (AbortController) é distinto de queda de
         rede: o chat descarta em silêncio, os demais fluxos mostram erro. */
      const aborted = networkError?.name === 'AbortError';
      const err = new Error(aborted ? 'Requisição cancelada.' : 'Falha de rede ao consultar a IA. Verifique a conexão.');
      err.code = aborted ? 'aborted' : 'network';
      throw err;
    }

    try { this.applyQuotaFromHeaders(response); } catch (quotaErr) {}

    const rawBody = await response.text().catch(() => '');
    let parsed = null;
    try { parsed = rawBody ? JSON.parse(rawBody) : null; } catch (err) { parsed = null; }

    if (!response.ok) {
      const err = new Error(parsed?.error || `A IA respondeu com erro ${response.status}.`);
      err.status = response.status;
      err.code = parsed?.code || `http_${response.status}`;
      throw err;
    }

    const reply = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    if (!reply) {
      const err = new Error('A IA não retornou uma resposta utilizável.');
      err.code = 'empty_reply';
      throw err;
    }
    return reply;
  },
  async generateViaWorker({ prompt, imagePart, maxTokens, signal }) {
    return this.postWorker(
      {
        prompt,
        imagePart: imagePart || null,
        maxTokens
      },
      { signal }
    );
  },
  /* Chat IA (V.20-02): contrato {message, financialSnapshot, conversationContext}.
     Sem fallback de chave local — o Worker é quem valida limites, cota e
     autenticação, e este caminho não pode ser contornado. */
  async chat({ message, financialSnapshot, conversationContext, signal } = {}) {
    return this.postWorker(
      {
        message,
        financialSnapshot,
        conversationContext
      },
      { signal }
    );
  },
  /* Fallback local: chamada direta ao OpenRouter com a chave guardada no
     localStorage. NÃO é o caminho protegido pelo Worker — não passa por
     autenticação, cota diária nem validação de payload do proxy. Usado
     só quando o Worker falha e há chave local cadastrada. */
  async generateViaLocalKey({ content, maxTokens }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const err = new Error('Chave da API não configurada. Cadastre-a em Perfil → Análise assistida.');
      err.code = 'missing_api_key';
      throw err;
    }

    let response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.origin,
          'X-Title': 'LIVRO-CAIXA'
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [{ role: 'user', content }],
          temperature: 0.2,
          max_tokens: maxTokens,
          reasoning: { effort: 'none' },
          reasoning_effort: 'none'
        })
      });
    } catch (networkError) {
      const err = new Error('Falha de rede ao consultar a IA. Verifique a conexão.');
      err.code = 'network';
      throw err;
    }

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch (err) {}
      const err = new Error(`A IA respondeu com erro ${response.status}${detail ? `: ${detail.slice(0, 200)}` : '.'}`);
      err.status = response.status;
      err.code = `http_${response.status}`;
      throw err;
    }

    let data;
    try { data = await response.json(); } catch (err) {
      const parseErr = new Error('Resposta inválida da IA.');
      parseErr.code = 'bad_json';
      throw parseErr;
    }

    const reply = data?.choices?.[0]?.message?.content;
    const responseText = typeof reply === 'string' ? reply.trim() : '';
    if (!responseText) {
      const err = new Error('A IA não retornou uma resposta utilizável.');
      err.code = 'empty_reply';
      throw err;
    }
    return responseText;
  },
  async generate({ prompt, imagePart, maxTokens, signal } = {}) {
    const text = String(prompt || '').trim();
    if (!text) {
      const err = new Error('Prompt vazio para a análise de IA.');
      err.code = 'empty_prompt';
      throw err;
    }

    const content = this.buildContent(text, imagePart);
    const tokenCap = Number.isFinite(maxTokens) && maxTokens > 0
      ? Math.min(Math.floor(maxTokens), 4096)
      : OPENROUTER_DEFAULT_MAX_TOKENS;

    if (AI_WORKER_ENDPOINT) {
      try {
        return await this.generateViaWorker({ prompt: text, imagePart, maxTokens: tokenCap, signal });
      } catch (workerError) {
        /* Sem chave local, o erro do Worker é o que o usuário precisa ver. */
        if (!this.getApiKey()) throw workerError;
      }
    }

    /* O caminho de chave local é o legado e não recebe o signal nesta
       versão; o cancelamento do pipeline é garantido pelo timeout do
       módulo ocr/ocr-adapter.js. */
    return this.generateViaLocalKey({ content, maxTokens: tokenCap });
  },

  /* Cota diária de leituras (modelos free). Vem do Worker em headers na
     resposta de /ai, ou sob demanda pela rota GET /quota. */
  quota: null,
  quotaState: 'idle',
  lastQuotaFetchAt: 0,
  setQuota(data) {
    if (!data || data.remaining == null || !Number.isFinite(Number(data.remaining))) return;
    this.quota = {
      limit: Number(data.limit) || 0,
      used: Number(data.used) || 0,
      remaining: Math.max(0, Number(data.remaining) || 0),
      resetAt: Number(data.resetAt) || null
    };
    this.quotaState = 'ready';
    window.renderAiQuotaStatus?.();
  },
  getQuota() {
    return this.quota;
  },
  applyQuotaFromHeaders(response) {
    if (!response || !response.headers) return;
    const rawLimit = response.headers.get('X-AI-Quota-Limit');
    const rawRemaining = response.headers.get('X-AI-Quota-Remaining');
    if (rawLimit == null || rawRemaining == null) return;

    const limit = Number(rawLimit);
    const remaining = Number(rawRemaining);
    if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return;

    const resetAt = Number(response.headers.get('X-AI-Quota-Reset'));
    this.setQuota({
      limit,
      remaining,
      used: Math.max(0, limit - remaining),
      resetAt: Number.isFinite(resetAt) ? resetAt : null
    });
  },
  async refreshQuota(options) {
    const silent = Boolean(options && options.silent);
    const throttleMs = Number(options && options.throttleMs) || 0;
    if (!AI_WORKER_ENDPOINT) return null;
    if (throttleMs > 0 && Date.now() - this.lastQuotaFetchAt < throttleMs) return this.quota;

    let user = null;
    try { user = typeof auth !== 'undefined' ? auth?.currentUser : null; } catch (err) { user = null; }
    if (!user) {
      // Em refresh silencioso não mexe no estado: evita apagar um número já exibido.
      if (!silent) {
        this.quotaState = 'idle';
        window.renderAiQuotaStatus?.();
      }
      return null;
    }

    let idToken = '';
    try { idToken = await user.getIdToken(); } catch (err) { return null; }

    this.lastQuotaFetchAt = Date.now();
    if (!silent) {
      this.quotaState = 'loading';
      window.renderAiQuotaStatus?.();
    }

    try {
      const endpoint = AI_WORKER_ENDPOINT.replace(/\/ai$/, '/quota');
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!response.ok) {
        if (!silent) this.quotaState = 'unavailable';
        return null;
      }
      const data = await response.json();
      this.setQuota(data);
      return this.quota;
    } catch (err) {
      if (!silent) this.quotaState = 'unavailable';
      return null;
    } finally {
      window.renderAiQuotaStatus?.();
    }
  }
};

window.renderAiQuotaStatus = function renderAiQuotaStatus() {
  const nodes = document.querySelectorAll('[data-ai-quota]');
  if (!nodes.length) return;

  const ai = window.LivroCaixaAI;
  const quota = ai?.quota;
  const state = ai?.quotaState || 'idle';

  let text = '';
  let color = '';

  if (state === 'loading') {
    text = 'Consultando o limite de leituras de IA…';
  } else if (state === 'unavailable') {
    text = 'Não foi possível consultar o limite de leituras de IA agora.';
    color = 'var(--red)';
  } else if (quota && quota.remaining <= 0) {
    text = `Limite diário de leituras de IA atingido (${quota.limit}/dia). Volta a liberar à meia-noite (UTC).`;
    color = 'var(--red)';
  } else if (quota) {
    const ending = quota.remaining <= 5;
    text = ending
      ? `Leituras de IA hoje: ${quota.remaining} de ${quota.limit} — o limite está acabando.`
      : `Leituras de IA hoje: ${quota.remaining} de ${quota.limit} restantes.`;
    color = ending ? 'var(--red)' : '';
  }

  nodes.forEach((el) => {
    el.textContent = text;
    el.style.color = color;
  });
};

window.addEventListener('load', () => {
  window.renderAiQuotaStatus?.();
  window.LivroCaixaAI?.refreshQuota?.();
});

/* A cota fica só em memória e o reset é do OpenRouter (dia UTC), então relê-la
   ao voltar ao app é o que faz o número acompanhar a virada do dia. */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  window.LivroCaixaAI?.refreshQuota?.({ silent: true, throttleMs: 60000 });
});

/* [BOOT FIREBASE] Precisa estar ANTES de qualquer firebase.firestore()/auth():
   sem initializeApp() a primeira chamada lança e derruba todo o resto do script. */
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

window.loginDebugLog?.(
  'FIREBASE',
  'Firebase Auth inicializado',
  {
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId
  }
);

firebase.firestore().enablePersistence().catch(err => {
  console.log("A persistência offline não pôde ser ativada:", err);
});
const db = firebase.firestore();

let currentUser = null;
  let firstLoadDone = false;
  let loadGeneration = 0;
let isSignupMode = false;
let saveTimer = null;
let pendingSaveCount = 0;
let snapshotBuffer = {};
window.addEventListener('beforeunload', e => {
  if (pendingSaveCount > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
  function updateNavIndicator(tabName) {
    const nav = document.querySelector('.mobile-bottom-nav');
    if (!nav) return;
    const buttons = Array.from(nav.querySelectorAll('button[data-destination]'));
    let index = buttons.findIndex(btn => btn.dataset.destination === tabName);
    if (index < 0) {
      index = buttons.findIndex(btn => btn.dataset.destination === 'caixa');
      tabName = 'caixa';
    }
    if (index < 0) index = 0;
    nav.dataset.active = tabName || 'caixa';
    nav.style.setProperty('--nav-indicator-x', `${index * 100}%`);
  }

  function markValueRefresh(root = document) {
    root.querySelectorAll('.balance-card .amount,.card-amount,.cat-summary-total strong').forEach((node) => {
      node.classList.remove('value-refresh');
      requestAnimationFrame(() => node.classList.add('value-refresh'));
    });
  }

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
  /* [JS 02] ESTADO GLOBAL / COLLECTIONS */
  let banks = [];
  let categories = [];
  let entries = [];
  let investments = [];
  let pockets = [];
  let yieldsLog = [];
  let recurringBills = [];
  let receivables = [];
  let budgets = [];
  let goals = [];
  let invoiceLaunches = [];
  let cards = [];
  let purchases = [];
  let editingCardId = null;
  let editingPurchaseId = null;
  let pendingImport = [];
  const FEATURE_SETTINGS_KEY = 'livrocaixa-feature-settings';
  let featureSettings = { autoLaunchRecurring: false, reminders: true, autoRefreshQuotes: false, quoteRefreshMinutes: 15, projectionMonths: 6, autoCategorization: false, reminderAdvanceDays: 3, monthlySavingsGoal: 0, pushNotifications: false, lockOnOpen: true, lockGraceMinutes: 5 };
  const FCM_TOKEN_KEY = 'livrocaixa-fcm-token';
  let pushForegroundBound = false;
  let featureAutomationTimer = null;
  let pendingImportSource = '';
  let currentType = 'in';
  let editingEntryId = null;
  let editingBankId = null;
  let editingCategoryId = null;
  let returnToEntryAfterCategory = false;
  let editingInvestId = null;
  let editingPocketId = null;
  let investmentMovementTarget = null; // { kind: 'aporte'|'resgate'|'rendimento', id }
  let catChartInstances = { out: null, in: null };
  const catChartBreakpoint = window.matchMedia('(max-width: 680px)');
  if (typeof catChartBreakpoint.addEventListener === 'function') {
    catChartBreakpoint.addEventListener('change', () => { if (catChartInstances.out || catChartInstances.in) renderCategorySummary(); });
  } else if (typeof catChartBreakpoint.addListener === 'function') {
    catChartBreakpoint.addListener(() => { if (catChartInstances.out || catChartInstances.in) renderCategorySummary(); });
  }

  /* [JS 03] UTILITÁRIOS / FORMATAÇÃO / DOM */
  const normalizeMoney = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    // evita -0,00 por resíduo de ponto flutuante; não mascara déficits reais
    return Math.abs(v) < 0.005 ? 0 : v;
  };
  const fmt = (n) => {
    const v = normalizeMoney(n);
    return (v < 0 ? '-' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  /* Valores abaixo de 1 centavo não podem passar por normalizeMoney (que zera
     |v| < 0,005) — senão 0,0049 sai como R$ 0,00. Mantém no mínimo 4 casas
     (acima de 1 centavo continua igual ao fmt) e até 8 para preservar precisão. */
  const fmtPrecise = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return fmt(0);
    const abs = Math.abs(v);
    if (abs > 0 && abs < 0.01) return (v < 0 ? '-' : '') + 'R$ ' + abs.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    return fmt(v);
  };
  const MONEY_FORMATTER = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const todayISO = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  const currentMonthYM = () => todayISO().slice(0, 7);
  // ===== V.19 — Ciclo financeiro personalizado (aplicado por enquanto só ao Orçamento; gráficos/resumos
  // continuam usando mês de calendário — expandir gradualmente, essa mudança em tudo de uma vez é arriscada) =====
  const FINANCIAL_CYCLE_STORAGE_KEY = 'livrocaixa_financial_cycle_start_day';
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
  const BUDGET_ALERT_STORAGE_KEY = 'livrocaixa_budget_alerts_shown';
  function getShownBudgetAlerts() {
    try { return JSON.parse(localStorage.getItem(BUDGET_ALERT_STORAGE_KEY) || '{}'); } catch (err) { return {}; }
  }
  function markBudgetAlertShown(key) {
    const shown = getShownBudgetAlerts();
    shown[key] = true;
    try { localStorage.setItem(BUDGET_ALERT_STORAGE_KEY, JSON.stringify(shown)); } catch (err) {}
  }
  function financialCycleLabel(cycleKey) {
    const { start, end } = financialCycleRangeForKey(cycleKey);
    const fmtDate = iso => iso.split('-').reverse().slice(0, 2).join('/');
    return getFinancialCycleStartDay() === 1 ? invoicePeriodLabel(cycleKey) : `${fmtDate(start)} a ${fmtDate(end)}`;
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

  const BACKUP_SCHEMA_VERSION = 4;
  const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 minutos de inatividade
  let sessionIdleTimer = null;
  let sessionLastActivity = Date.now();
  let sessionSecurityStarted = false;

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

  /* [JS 07] BACKUP / IMPORTAÇÃO / EXPORTAÇÃO / DIAGNÓSTICOS */
  function markSingleActionButtons() {
    ['fSalvar','bSalvar','cSalvar','tSalvar','iSalvar','pSalvar','pmSalvar','imSalvar','importConfirm','btnFetchPrice','imFetchPrice','btnUpdateAllPrices','btnExportBackup','billSalvar','cardSalvar','purchaseSalvar','btnOcrReviewConfirm'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.dataset.singleAction = '1';
    });
  }

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

  function buildBackupPayload() {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: 'livro-caixa',
      exportedAt: new Date().toISOString(),
      data: { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, invoiceLaunches, cards, purchases, featureSettings, diagnosticLog: diagnosticLog.slice(0, LOG_LIMIT) }
    };
  }

  function isValidBackupPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const required = ['banks','categories','entries'];
    if (!required.every(k => Array.isArray(data[k]))) return false;
    if (payload.schemaVersion != null && (!Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1 || payload.schemaVersion > BACKUP_SCHEMA_VERSION)) return false;
    const optional = ['investments','pockets','yieldsLog','recurringBills','receivables','budgets','goals','cards','purchases','invoiceLaunches','diagnosticLog'];
    if (optional.some(k => data[k] != null && !Array.isArray(data[k]))) return false;
    if (data.featureSettings != null && (typeof data.featureSettings !== 'object' || Array.isArray(data.featureSettings))) return false;
    return true;
  }

  function extractBackupData(payload) {
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    return {
      banks: Array.isArray(data.banks) ? data.banks : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      entries: Array.isArray(data.entries) ? data.entries : [],
      investments: Array.isArray(data.investments) ? data.investments : [],
      pockets: Array.isArray(data.pockets) ? data.pockets : [],
      yieldsLog: Array.isArray(data.yieldsLog) ? data.yieldsLog : [],
      recurringBills: Array.isArray(data.recurringBills) ? data.recurringBills : [],
      receivables: Array.isArray(data.receivables) ? data.receivables : [],
      budgets: Array.isArray(data.budgets) ? data.budgets : [],
      featureSettings: data.featureSettings && typeof data.featureSettings === 'object' ? data.featureSettings : null,
      goals: Array.isArray(data.goals) ? data.goals : [],
      invoiceLaunches: Array.isArray(data.invoiceLaunches) ? data.invoiceLaunches : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
      purchases: Array.isArray(data.purchases) ? data.purchases : [],
      diagnosticLog: Array.isArray(data.diagnosticLog) ? data.diagnosticLog : []
    };
  }

  function sanitizeBackupData(data) {
    const dropped = { banks: 0, categories: 0, entries: 0, investments: 0, pockets: 0, recurringBills: 0, budgets: 0, cards: 0, purchases: 0 };
    const banks = data.banks.filter(b => {
      const ok = b && typeof b === 'object' && typeof b.id === 'string' && b.id && typeof b.name === 'string' && b.name.trim();
      if (!ok) dropped.banks++;
      return ok;
    });
    const categories = data.categories.filter(c => {
      const ok = c && typeof c === 'object' && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim();
      if (!ok) dropped.categories++;
      return ok;
    });
    const entries = data.entries.filter(e => {
      const ok = e && typeof e === 'object' && typeof e.id === 'string' && e.id
        && typeof e.desc === 'string' && e.desc.trim()
        && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        && typeof e.amount === 'number' && isFinite(e.amount) && e.amount > 0
        && (e.type === 'in' || e.type === 'out');
      if (!ok) dropped.entries++;
      return ok;
    });
    const investments = data.investments.filter(i => {
      const ok = i && typeof i === 'object' && typeof i.id === 'string' && i.id && typeof i.name === 'string' && i.name.trim()
        && typeof i.value === 'number' && isFinite(i.value) && i.value >= 0;
      if (!ok) dropped.investments++;
      return ok;
    });
    const pockets = data.pockets.filter(p => {
      const ok = p && typeof p === 'object' && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()
        && typeof p.initial === 'number' && isFinite(p.initial) && p.initial >= 0;
      if (!ok) dropped.pockets++;
      return ok;
    });
    const yieldsLog = Array.isArray(data.yieldsLog) ? data.yieldsLog.filter(y => y && typeof y === 'object' && typeof y.id === 'string' && y.id) : [];
    const budgets = (Array.isArray(data.budgets) ? data.budgets : []).filter(b => {
      const ok = b && typeof b === 'object' && typeof b.id === 'string' && b.id && typeof b.categoryId === 'string' && b.categoryId && typeof b.month === 'string' && /^\d{4}-\d{2}$/.test(b.month) && Number.isFinite(Number(b.amount)) && Number(b.amount) >= 0;
      if (!ok) dropped.budgets++;
      return ok;
    }).map(b => ({ ...b, amount: Number(b.amount) }));
    const cards = (Array.isArray(data.cards) ? data.cards : []).filter(c => {
      const ok = c && typeof c === 'object' && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim()
        && Number.isInteger(Number(c.closingDay)) && Number(c.closingDay) >= 1 && Number(c.closingDay) <= 31
        && Number.isInteger(Number(c.dueDay)) && Number(c.dueDay) >= 1 && Number(c.dueDay) <= 31;
      if (!ok) dropped.cards++;
      return ok;
    });
    const cardIds = new Set(cards.map(c => c.id));
    const purchases = (Array.isArray(data.purchases) ? data.purchases : []).filter(p => {
      const ok = p && typeof p === 'object' && typeof p.id === 'string' && p.id && typeof p.cardId === 'string' && cardIds.has(p.cardId)
        && typeof p.description === 'string' && p.description.trim() && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
        && Number.isFinite(Number(p.totalValue)) && Number(p.totalValue) > 0
        && (p.paymentType === 'avista' || p.paymentType === 'parcelado');
      if (!ok) dropped.purchases++;
      return ok;
    });
    const diagnosticLog = data.diagnosticLog.filter(item => item && typeof item === 'object' && typeof item.type === 'string' && typeof item.module === 'string').slice(0, LOG_LIMIT);
    return { data: { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables: Array.isArray(data.receivables) ? data.receivables : [], budgets, goals: data.goals || [], invoiceLaunches: Array.isArray(data.invoiceLaunches) ? data.invoiceLaunches : [], cards, purchases, featureSettings: data.featureSettings || null, diagnosticLog }, dropped };
  }

  // Tema Escuro / Claro
  const themeBtn = document.getElementById('btnThemeToggle');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const lightThemePicker = document.getElementById('lightThemePicker');
  const lightThemeOptions = Array.from(document.querySelectorAll('.light-theme-option'));
  const LIGHT_THEME_STORAGE_KEY = 'livro-caixa-light-theme';
  const LIGHT_THEME_COLORS = {
    '1': '#F8F7F2',
    '4': '#FBF6EF',
    '5': '#F9F9F9'
  };
  const darkThemePicker = document.getElementById('darkThemePicker');
  const darkThemeOptions = Array.from(document.querySelectorAll('.dark-theme-option'));
  const DARK_THEME_STORAGE_KEY = 'livro-caixa-dark-theme';
  const DARK_THEME_COLORS = {
    '1': '#0F1712',
    '3': '#141410',
    '4': '#121212',
    '5': '#000000'
  };

  function validLightTheme(value) {
    if (value === '2' || value === '3') return '1';
    return Object.prototype.hasOwnProperty.call(LIGHT_THEME_COLORS, value) ? value : '1';
  }

  function getSavedLightTheme() {
    return validLightTheme(localStorage.getItem(LIGHT_THEME_STORAGE_KEY));
  }

  function updateLightThemePicker(themeId) {
    lightThemeOptions.forEach(option => {
      const selected = option.dataset.theme === themeId;
      option.setAttribute('aria-pressed', String(selected));
    });
  }

  function applyLightTheme(themeId, persist = true) {
    const selectedTheme = validLightTheme(themeId);
    document.body.dataset.lightTheme = selectedTheme;
    updateLightThemePicker(selectedTheme);
    if (persist) localStorage.setItem(LIGHT_THEME_STORAGE_KEY, selectedTheme);
    if (themeColorMeta) themeColorMeta.setAttribute('content', LIGHT_THEME_COLORS[selectedTheme]);
  }

  function validDarkTheme(value) {
    if (value === '2') return '1';
    return Object.prototype.hasOwnProperty.call(DARK_THEME_COLORS, value) ? value : '1';
  }

  function getSavedDarkTheme() {
    return validDarkTheme(localStorage.getItem(DARK_THEME_STORAGE_KEY));
  }

  function updateDarkThemePicker(themeId) {
    darkThemeOptions.forEach(option => {
      const selected = option.dataset.theme === themeId;
      option.setAttribute('aria-pressed', String(selected));
    });
  }

  function applyDarkTheme(themeId, persist = true) {
    const selectedTheme = validDarkTheme(themeId);
    document.body.dataset.darkTheme = selectedTheme;
    updateDarkThemePicker(selectedTheme);
    if (persist) localStorage.setItem(DARK_THEME_STORAGE_KEY, selectedTheme);
    if (themeColorMeta) themeColorMeta.setAttribute('content', DARK_THEME_COLORS[selectedTheme]);
  }

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
    });
  });

  function setThemeToggleIcon(isDark) {
    if (!themeBtn) return;
    themeBtn.innerHTML = `<i class="fi fi-sr-contrast" aria-hidden="true"></i>`;
  }
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
    renderDashboardTab();
  };

  // Suporte a tecla ESC para fechar modais
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });

  // Alternância de Abas
  const LAST_TAB_STORAGE_KEY = 'livrocaixa_last_tab';
  const TAB_NAMES = ['dash', 'dashboard', 'caixa', 'invest', 'pockets', 'cards', 'receivables', 'bills', 'profile', 'goals'];
  let currentTab = 'caixa';
  let lastTabRestored = false;
  try { document.body.dataset.tab = currentTab; } catch (e) {}
  /* sessionStorage (e não localStorage): a aba vale só durante a sessão —
     sobrevive a F5/atualização, mas some ao fechar o app (volta no Livro-Caixa). */
  try { localStorage.removeItem(LAST_TAB_STORAGE_KEY); } catch (e) {}

  function persistLastTab(tab) {
    try {
      if (tab && TAB_NAMES.includes(tab)) sessionStorage.setItem(LAST_TAB_STORAGE_KEY, tab);
    } catch (e) {}
  }
  /* Exportado: o patch de Metas (scripts externos) roda FORA deste closure do
     DOMContentLoaded e precisa salvar a aba 'goals' pelo guard typeof. */
  window.persistLastTab = persistLastTab;

  document.getElementById('btnTogglePeriodBar')?.addEventListener('click', () => {
    const bar = document.getElementById('universalPeriodBar');
    const btn = document.getElementById('btnTogglePeriodBar');
    if (!bar || !btn) return;
    const open = bar.classList.toggle('is-collapsed') === false;
    // class is-collapsed means collapsed; toggle returns true if class now present
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

  function syncPeriodActiveLabels(text) {
    const a = document.getElementById('periodActiveLabel');
    const b = document.getElementById('periodActiveLabelTop');
    if (a) a.textContent = text;
    if (b) b.textContent = text;
  }

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
    document.getElementById('tabBtnBills')?.classList.toggle('active', tabName === 'bills');
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
    document.querySelectorAll('.mobile-bottom-nav button').forEach(button => button.classList.toggle('is-active', button.dataset.destination === tabName));
    if (tabName === 'profile') renderProfile();
  };
  // Base da navegação: BNI e onclick usam switchTab
  if (typeof window.switchTab !== 'function') {
    window.switchTab = window.switchTabOriginal;
  }

  function formatMonthLabel(ym) {
    if (!ym) return 'Todos os Meses';
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' / ' + y;
  }

  function docRef() {
    return db.collection('livrocaixa').doc(currentUser.uid);
  }
  function colRef(name) {
    return docRef().collection(name);
  }

  const COLLECTIONS = ['banks', 'categories', 'entries', 'investments', 'pockets', 'yieldsLog', 'recurringBills', 'receivables', 'budgets', 'goals', 'cards', 'purchases', 'invoiceLaunches'];
  let lastSynced = { banks: {}, categories: {}, entries: {}, investments: {}, pockets: {}, yieldsLog: {}, recurringBills: {}, receivables: {}, budgets: {}, goals: {}, invoiceLaunches: {}, cards: {}, purchases: {} };
  let realtimeUnsubscribers = [];

  function cloneSyncItem(item) {
    if (!item || typeof item !== 'object') return item;
    try {
      if (typeof structuredClone === 'function') return structuredClone(item);
    } catch (_) {}
    try {
      return JSON.parse(JSON.stringify(item));
    } catch (_) {
      return Array.isArray(item) ? [...item] : { ...item };
    }
  }

  function arrToMap(arr) {
    const m = {};
    (arr || []).forEach(it => {
      if (it && it.id) m[it.id] = cloneSyncItem(it);
    });
    return m;
  }

  function ensureDisplayOrder(list) {
    let changed = false;
    (list || []).forEach((item, index) => {
      if (!Number.isFinite(Number(item.order))) { item.order = index; changed = true; }
    });
    return changed;
  }
  function sortDisplayOrder(list) {
    return [...(list || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }
  async function moveDisplayItem(collectionName, id, direction) {
    const list = collectionName === 'investments' ? investments : pockets;
    ensureDisplayOrder(list);
    const index = list.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((item, position) => { item.order = position; });
    render();
    try {
      await persistAll();
      logInfo('Organização', collectionName === 'investments' ? 'Reordenação de investimento' : 'Reordenação de caixinha', 'Sucesso', `Item movido para a posição ${target + 1}.`);
    } catch (err) {
      logSyncError('reordenação', err);
    }
  }
  window.moveInvestment = (id, direction) => moveDisplayItem('investments', id, direction);
  window.movePocket = (id, direction) => moveDisplayItem('pockets', id, direction);

  async function reorderDisplayItem(collectionName, id, targetIndex) {
    const list = collectionName === 'investments' ? investments : pockets;

    ensureDisplayOrder(list);

    const ordered = sortDisplayOrder(list);
    const fromIndex = ordered.findIndex(item => item.id === id);

    if (
      fromIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= ordered.length ||
      fromIndex === targetIndex
    ) {
      return false;
    }

    const previousOrder = list.map(item => ({
      id: item.id,
      order: item.order
    }));

    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);

    ordered.forEach((item, position) => {
      item.order = position;
    });

    list.sort((a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0)
    );

    render();

    try {
      await persistAll();

      logInfo(
        'Organização',
        collectionName === 'investments'
          ? 'Reordenação de investimento'
          : 'Reordenação de caixinha',
        'Sucesso',
        `Item movido para a posição ${targetIndex + 1}.`
      );

      return true;
    } catch (err) {
      previousOrder.forEach(({ id: previousId, order }) => {
        const item = list.find(entry => entry.id === previousId);
        if (item) item.order = order;
      });

      list.sort((a, b) =>
        (Number(a.order) || 0) - (Number(b.order) || 0)
      );

      render();
      logSyncError('reordenação', err);

      return false;
    }
  }

  function setupDisplayCardDrag(container, collectionName) {
    if (!container || container.dataset.dragBound === '1') return;

    container.dataset.dragBound = '1';

    let state = null;

    const HOLD_MS = 220;

    const getCards = () =>
      Array.from(container.children).filter(card =>
        card.matches('.invest-box, .asset-card') &&
        !card.classList.contains('drag-placeholder') &&
        card !== state?.card
      );

    const removePlaceholder = () => {
      if (state?.placeholder?.parentNode) {
        state.placeholder.parentNode.removeChild(state.placeholder);
      }
    };

    const clearDrag = () => {
      if (!state) return;

      if (state.timer) {
        clearTimeout(state.timer);
      }

      if (state.scrollRaf) {
        cancelAnimationFrame(state.scrollRaf);
      }

      if (state.card) {
        state.card.classList.remove('is-dragging');
        state.card.classList.remove('is-holding');
        state.card.style.transform = '';
        state.card.style.width = '';
        state.card.style.height = '';
        state.card.style.position = '';
        state.card.style.left = '';
        state.card.style.top = '';
        state.card.style.zIndex = '';
      }

      removePlaceholder();

    container.classList.remove('is-dragging-active');

      getCards().forEach(card => {
        card.classList.remove('drop-target');
      });

      state = null;
    };

    const createPlaceholder = card => {
      const rect = card.getBoundingClientRect();
      const placeholder = document.createElement('div');

      placeholder.className = 'drag-placeholder';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.setAttribute('aria-hidden', 'true');

      return placeholder;
    };

    const getInsertionIndex = (cards, pointerX, pointerY) => {
      if (!cards.length) return 0;

      /*
       * O card arrastado já foi removido da lista de candidatos por getCards().
       *
       * O cálculo anterior escolhia o centro mais próximo. Em uma fronteira
       * entre dois cards, pequenas variações do ponteiro podiam trocar o
       * destino continuamente.
       *
       * Agora usamos zonas determinísticas:
       * - agrupamento visual por linha;
       * - separação vertical entre linhas;
       * - ponto médio horizontal de cada card.
       */

      const rows = [];
      const ROW_TOLERANCE = 12;

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        let row = rows.find(item =>
          Math.abs(item.centerY - centerY) <= ROW_TOLERANCE
        );

        if (!row) {
          row = {
            centerY,
            cards: []
          };

          rows.push(row);
        }

        row.cards.push({
          card,
          rect
        });

        row.centerY =
          row.cards.reduce(
            (sum, item) =>
              sum + item.rect.top + item.rect.height / 2,
            0
          ) / row.cards.length;
      });

      rows.sort((a, b) => a.centerY - b.centerY);

      rows.forEach(row => {
        row.cards.sort((a, b) => a.rect.left - b.rect.left);
      });

      if (!rows.length) return 0;

      let selectedRow = rows[0];

      for (let i = 0; i < rows.length - 1; i++) {
        const current = rows[i];
        const next = rows[i + 1];
        const boundary = (current.centerY + next.centerY) / 2;

        if (pointerY < boundary) {
          selectedRow = current;
          break;
        }

        selectedRow = next;
      }

      const firstCard = selectedRow.cards[0];
      const lastCard =
        selectedRow.cards[selectedRow.cards.length - 1];

      if (pointerY < selectedRow.centerY) {
        const globalIndex = cards.indexOf(firstCard.card);
        return Math.max(0, globalIndex);
      }

      for (const item of selectedRow.cards) {
        const centerX =
          item.rect.left + item.rect.width / 2;

        if (pointerX < centerX) {
          const globalIndex = cards.indexOf(item.card);
          return Math.max(0, globalIndex);
        }
      }

      const globalIndex = cards.indexOf(lastCard.card);

      return Math.min(
        cards.length,
        globalIndex + 1
      );
    };

    const STABLE_TARGET_MS = 70;

    const applyPlaceholderTarget = insertionIndex => {
      if (!state?.placeholder) return;

      const cards = getCards();
      const targetCard = cards[insertionIndex];

      state.targetIndex = insertionIndex;

      if (targetCard) {
        targetCard.before(state.placeholder);
        targetCard.classList.add('drop-target');
      } else {
        container.appendChild(state.placeholder);
      }

      cards.forEach(card => {
        if (card !== targetCard) {
          card.classList.remove('drop-target');
        }
      });
    };

    const updatePlaceholder = (pointerX, pointerY) => {
      if (!state?.placeholder) return;

      const cards = getCards();
      const insertionIndex =
        getInsertionIndex(cards, pointerX, pointerY);

      if (insertionIndex === state.targetIndex) {
        state.pendingTargetIndex = -1;

        if (state.pendingTargetTimer) {
          clearTimeout(state.pendingTargetTimer);
          state.pendingTargetTimer = null;
        }

        return;
      }

      if (insertionIndex === state.pendingTargetIndex) {
        return;
      }

      state.pendingTargetIndex = insertionIndex;

      if (state.pendingTargetTimer) {
        clearTimeout(state.pendingTargetTimer);
      }

      state.pendingTargetTimer = setTimeout(() => {
        if (!state?.placeholder) return;

        if (state.pendingTargetIndex !== insertionIndex) {
          return;
        }

        state.pendingTargetTimer = null;
        state.pendingTargetIndex = -1;

        applyPlaceholderTarget(insertionIndex);
      }, STABLE_TARGET_MS);
    };

    const SCROLL_EDGE = 48;
    const SCROLL_MAX_SPEED = 12;

    const scrollTick = () => {
      if (!state || !state.active) {
        if (state) state.scrollRaf = null;
        return;
      }

      const maxY = (window.innerHeight || 0) - SCROLL_EDGE;
      let delta = 0;

      if (state.lastY < SCROLL_EDGE) {
        const factor = Math.min(
          1,
          1 - Math.max(0, state.lastY) / SCROLL_EDGE
        );
        delta = -Math.max(1, Math.round(SCROLL_MAX_SPEED * factor));
      } else if (state.lastY > maxY) {
        const factor = Math.min(
          1,
          (state.lastY - maxY) / SCROLL_EDGE
        );
        delta = Math.max(1, Math.round(SCROLL_MAX_SPEED * factor));
      }

      if (delta) {
        window.scrollBy(0, delta);
      }

      state.scrollRaf = requestAnimationFrame(scrollTick);
    };

    container.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.drag-handle');

      if (!handle || !container.contains(handle)) return;
      if (event.button !== 0) return;

      const card = handle.closest('.invest-box, .asset-card');

      if (!card || !container.contains(card)) return;

      const id = card.dataset.itemId;

      if (!id) return;

      event.preventDefault();

      card.classList.add('is-holding');

      const rect = card.getBoundingClientRect();

      state = {
        card,
        handle,
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height,
        active: false,
        targetIndex: -1,
        pendingTargetIndex: -1,
        pendingTargetTimer: null,
        placeholder: null,
        timer: setTimeout(() => {
          if (!state) return;

          state.active = true;
          container.classList.add('is-dragging-active');
          state.scrollRaf = requestAnimationFrame(scrollTick);

          state.placeholder = createPlaceholder(card);
          card.before(state.placeholder);

          card.classList.add('is-dragging');
          card.classList.remove('is-holding');

          card.style.width = `${state.width}px`;
          card.style.height = `${state.height}px`;
          card.style.position = 'fixed';
          card.style.left = `${state.startLeft}px`;
          card.style.top = `${state.startTop}px`;
          card.style.zIndex = '9999';

          try {
            handle.setPointerCapture(event.pointerId);
          } catch (_) {}

          updatePlaceholder(
            state.startX,
            state.startY
          );
        }, HOLD_MS)
      };
    });

    container.addEventListener('pointermove', event => {
      if (!state || state.pointerId !== event.pointerId) return;

      if (!state.active) return;

      event.preventDefault();

      state.lastX = event.clientX;
      state.lastY = event.clientY;

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;

      state.card.style.transform =
        `translate(${dx}px, ${dy}px) scale(.985)`;

      updatePlaceholder(
        event.clientX,
        event.clientY
      );
    }, { passive: false });

    container.addEventListener('pointerup', async event => {
      if (!state || state.pointerId !== event.pointerId) return;

      const current = state;

      if (current.timer) {
        clearTimeout(current.timer);
      }

      if (!current.active) {
        clearDrag();
        return;
      }

      event.preventDefault();

      const cards = getCards();

      const targetIndex =
        Number.isInteger(current.targetIndex) &&
        current.targetIndex >= 0
          ? Math.max(
              0,
              Math.min(current.targetIndex, cards.length)
            )
          : -1;

      clearDrag();

      if (targetIndex >= 0) {
        await reorderDisplayItem(
          collectionName,
          current.id,
          targetIndex
        );
      }
    });

    container.addEventListener(
      'pointercancel',
      clearDrag
    );

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state) {
        clearDrag();
      }
    });

    window.addEventListener(
      'scroll',
      () => {
        if (state?.active) {
          updatePlaceholder(state.lastX, state.lastY);
        }
      },
      { passive: true }
    );
  }

  function currentStateSnapshot() {
    return { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, invoiceLaunches, cards, purchases };
  }

  function setLastSyncedFromCurrentState() {
    const s = currentStateSnapshot();
    lastSynced = {
      banks: arrToMap(s.banks), categories: arrToMap(s.categories), entries: arrToMap(s.entries),
      investments: arrToMap(s.investments), pockets: arrToMap(s.pockets), yieldsLog: arrToMap(s.yieldsLog), recurringBills: arrToMap(s.recurringBills), receivables: arrToMap(s.receivables), budgets: arrToMap(s.budgets), goals: arrToMap(s.goals), invoiceLaunches: arrToMap(s.invoiceLaunches), cards: arrToMap(s.cards), purchases: arrToMap(s.purchases)
    };
  }

  function setStateArray(name, arr) {
    switch (name) {
      case 'banks': banks = arr.filter(bk => bk.id !== 'geral' && bk.name.toLowerCase() !== 'geral'); break;
      case 'categories': categories = [...(arr || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')); break;
      case 'entries': entries = arr; break;
      case 'investments': investments = sortDisplayOrder(arr); break;
      case 'pockets': pockets = sortDisplayOrder(arr); break;
      case 'yieldsLog': yieldsLog = arr; break;
      case 'recurringBills': recurringBills = arr; break;
      case 'receivables': receivables = arr; break;
      case 'budgets': budgets = arr; break;
      case 'goals': goals = arr; break;
      case 'invoiceLaunches': invoiceLaunches = arr; break;
      case 'cards': cards = arr; break;
      case 'purchases': purchases = arr; break;
    }
  }

  async function loadState() {
    const operation = beginLogOperation('Carregamento de dados', 'Sincronização');
    const loadUserUid = currentUser?.uid || null;
    const thisLoadGeneration = ++loadGeneration;
    firstLoadDone = false;
    const defaultCats = ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Salário', 'Renda Extra', 'Transferência', 'Outros'];
    const syncOverlay = document.getElementById('syncOverlay');
    const syncOverlayText = document.getElementById('syncOverlayText');
    document.body.classList.add('is-data-loading');
    if (syncOverlayText) syncOverlayText.textContent = 'Sincronizando seus dados...';
    if (syncOverlay) syncOverlay.classList.remove('hidden');

    realtimeUnsubscribers.forEach(unsub => unsub());
    realtimeUnsubscribers = [];
    await loadDiagnosticLog();
    logInfo('Carregamento de dados', 'Início da sincronização', 'Em andamento', 'Leitura das coleções do Livro-Caixa iniciada.', null, operation);

    try {
      // Cada coleção resolve assim que a PRIMEIRA leitura chega — que, com o cache offline
      // ativo, costuma vir do disco do próprio celular quase instantaneamente, mesmo antes
      // da confirmação do servidor. Isso evita esperar a rede toda vez que a página recarrega.
      await Promise.all(COLLECTIONS.map(name => new Promise((resolve, reject) => {
        let resolved = false;
        const unsub = colRef(name).onSnapshot(snap => {
          if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) {
            if (!resolved) {
              resolved = true;
              resolve();
            }
            return;
          }
          const arr = snap.docs.map(d => d.data());
          if (resolved && pendingSaveCount > 0) {
            snapshotBuffer[name] = { arr, hasPendingWrites: snap.metadata.hasPendingWrites };
            return;
          }
          setStateArray(name, arr);
          if (!snap.metadata.hasPendingWrites) {
            lastSynced[name] = arrToMap(getStateArray(name));
          }
          if (!resolved) {
            resolved = true;
            resolve();
          } else if (firstLoadDone) {
            render();
          }
        }, err => {
          if (!resolved) { resolved = true; reject(err);           } else { console.error(err); logSyncError(`sincronização — ${name}`, err); }
        });
        realtimeUnsubscribers.push(unsub);
      })));

      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      COLLECTIONS.forEach(name => {
        if (Object.keys(lastSynced[name]).length === 0 && getStateArray(name).length > 0) {
          lastSynced[name] = arrToMap(getStateArray(name));
        }
      });

      const hasSubData = COLLECTIONS.some(name => getStateArray(name).length > 0);

      if (!hasSubData) {
        // Migração automática do formato antigo (documento único) para subcoleções
        const oldSnap = await docRef().get();
        if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;
        const data = oldSnap.exists ? oldSnap.data() : {};
        banks = data.banks || [];
        categories = data.categories || [];
        entries = data.entries || [];
        investments = data.investments || [];
        pockets = data.pockets || [];
        yieldsLog = data.yieldsLog || [];
        recurringBills = data.recurringBills || [];
        receivables = data.receivables || [];
        budgets = data.budgets || [];
        goals = data.goals || [];
        invoiceLaunches = data.invoiceLaunches || [];
        cards = data.cards || [];
        purchases = data.purchases || [];
        lastSynced = { banks: {}, categories: {}, entries: {}, investments: {}, pockets: {}, yieldsLog: {}, recurringBills: {}, receivables: {}, budgets: {}, goals: {}, invoiceLaunches: {}, cards: {}, purchases: {} };
        if (data.banks || data.entries) {
          if (syncOverlayText) syncOverlayText.textContent = 'Migrando seus dados para a nova estrutura (só acontece uma vez)...';
        }
      }

      let changed = !hasSubData;
      const orderChanged = ensureDisplayOrder(investments) | ensureDisplayOrder(pockets);
      investments = sortDisplayOrder(investments);
      pockets = sortDisplayOrder(pockets);
      if (orderChanged) changed = true;
      const beforePocketState = JSON.stringify(pockets);
      normalizePockets();
      if (JSON.stringify(pockets) !== beforePocketState) changed = true;

      const beforeGoalState = JSON.stringify(goals);
      normalizeGoals();
      if (JSON.stringify(goals) !== beforeGoalState) changed = true;
      const beforeGoalProgressState = JSON.stringify(goals);
      if (normalizeAllGoalStatuses()) changed = true;
      if (JSON.stringify(goals) !== beforeGoalProgressState) changed = true;

      const filteredBanks = banks.filter(bk => bk.id !== 'geral' && bk.name.toLowerCase() !== 'geral');
      if (filteredBanks.length !== banks.length) changed = true;
      banks = filteredBanks;

      if (categories.length === 0) {
        categories = defaultCats.map(name => ({ id: 'c' + name, name }));
        changed = true;
      }

      if (changed) {
        if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;
        await persistNow(operation);
      }

      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      await loadProfileSettingsFromCloud();
      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      /* Indicadores públicos (BCB/Tesouro): só semeia a tela com o que já
         estava persistido; a busca fresca acontece depois, sem atrasar a
         sincronização das coleções. */
      await loadFinancialIndicatorsFromCloud();
      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      populateFilterControls(true);
      render();
      renderBills();
      if (currentTab === 'profile') renderProfile();
      firstLoadDone = true;
      renderBalances();
      refreshFinancialIndicators();
      logInfo('Carregamento de dados', 'Sincronização concluída', 'Sucesso', `${COLLECTIONS.length} coleções carregadas.`, null, operation);
    } catch (err) {
      console.error(err);
      logSyncError('carregamento de dados', err, operation);
      alert('Erro ao carregar dados. O aplicativo pode estar offline.');
    } finally {
      if (thisLoadGeneration === loadGeneration && currentUser?.uid === loadUserUid) {
        if (!lastTabRestored) {
          lastTabRestored = true;
          try {
            const savedTab = sessionStorage.getItem(LAST_TAB_STORAGE_KEY);
            if (savedTab && TAB_NAMES.includes(savedTab) && savedTab !== currentTab && typeof window.switchTab === 'function') {
              window.switchTab(savedTab);
            }
          } catch (e) {}
        }
        if (syncOverlay) syncOverlay.classList.add('hidden');
        document.body.classList.remove('is-data-loading');
        markValueRefresh();
      }
    }
  }

  function getStateArray(name) {
    switch (name) {
      case 'banks': return banks;
      case 'categories': return categories;
      case 'entries': return entries;
      case 'investments': return investments;
      case 'pockets': return pockets;
      case 'yieldsLog': return yieldsLog;
      case 'recurringBills': return recurringBills;
      case 'receivables': return receivables;
      case 'budgets': return budgets;
      case 'goals': return goals;
      case 'invoiceLaunches': return invoiceLaunches;
      case 'cards': return cards;
      case 'purchases': return purchases;
    }
  }

  /* [JS 06] FIREBASE / STORAGE / SINCRONIZAÇÃO / MIGRAÇÕES */
  function flushSnapshotBuffer() {
    const names = Object.keys(snapshotBuffer);
    if (!names.length) return;
    names.forEach(name => {
      const buffered = snapshotBuffer[name];
      setStateArray(name, buffered.arr);
      lastSynced[name] = arrToMap(getStateArray(name));
    });
    snapshotBuffer = {};
    render();
  }

  function setSyncDot(saving) {
    const dot = document.getElementById('syncDot');
    if (dot) dot.classList.toggle('saving', saving);
  }
  const diagnosticLog = [];
  const syncErrorLog = diagnosticLog; // compatibilidade com a interface antiga.
  const LOG_STORAGE_KEY = 'livrocaixa_diagnostic_log';
  const LOG_LIMIT = 200;
  const LOG_SCHEMA_VERSION = 2;
  const LOG_SEQUENCE_STORAGE_KEY = 'livrocaixa_diagnostic_sequence';
  const LOG_SOURCE = 'Livro-Caixa-web';
  let logSequence = 0;

  function nextLogSequence() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(LOG_SEQUENCE_STORAGE_KEY)) || 0; } catch (err) {}
    logSequence = Math.max(logSequence, stored) + 1;
    try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    return logSequence;
  }
  function createCorrelationId(label = 'operacao') {
    const safeLabel = String(label || 'operacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'operacao';
    return `op_${Date.now()}_${safeLabel}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function beginLogOperation(module, action, details = null) {
    return { correlationId: createCorrelationId(`${module}-${action}`), startedAt: performance.now(), module, action, details };
  }
  function operationDuration(operation) {
    if (!operation || !Number.isFinite(operation.startedAt)) return null;
    return Math.max(0, Math.round(performance.now() - operation.startedAt));
  }
  function getLogContextFields(operation, durationMs = null) {
    if (!operation) return {};
    return {
      correlationId: operation.correlationId || null,
      durationMs: durationMs != null ? durationMs : null,
      source: operation.source || LOG_SOURCE
    };
  }

  function sanitizeLogValue(value, depth = 0) {
    if (depth > 2 || value == null) return value == null ? null : String(value);
    if (value instanceof Error) return { name: value.name, message: value.message, code: value.code || null };
    if (typeof value === 'string') return value.slice(0, 800);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeLogValue(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      Object.keys(value).slice(0, 20).forEach(key => {
        if (/password|token|secret|authorization|apiKey|credential|uid/i.test(key)) return;
        result[key] = sanitizeLogValue(value[key], depth + 1);
      });
      return result;
    }
    return String(value);
  }
  function normalizeLogEvent(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const sequenceNumber = Number(item.sequence);
    const durationNumber = Number(item.durationMs);
    const retryNumber = Number(item.retryCount);
    return {
      id: String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      sequence: Number.isFinite(sequenceNumber) && sequenceNumber > 0 ? sequenceNumber : null,
      timestamp: item.timestamp || new Date().toISOString(),
      type: ['INFO', 'WARN', 'ERROR'].includes(item.type) ? item.type : 'INFO',
      module: String(item.module || 'Sistema').slice(0, 120),
      action: String(item.action || 'Operação').slice(0, 160),
      status: String(item.status || 'Sucesso').slice(0, 80),
      description: String(item.description || '').slice(0, 800),
      details: sanitizeLogValue(item.details),
      correlationId: item.correlationId ? String(item.correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(durationNumber) && durationNumber >= 0 ? Math.round(durationNumber) : null,
      retryCount: Number.isFinite(retryNumber) && retryNumber >= 0 ? Math.floor(retryNumber) : null,
      source: String(item.source || 'Livro-Caixa-web').slice(0, 80),
      synced: item.synced === true ? true : item.synced === false ? false : null,
      schemaVersion: Number(item.schemaVersion) || 1
    };
  }
  function normalizeDiagnosticLog(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).map(normalizeLogEvent).slice(0, LOG_LIMIT);
  }
  function syncLogSequenceFromEvents(items) {
    const maxSequence = (Array.isArray(items) ? items : []).reduce((max, item) => Math.max(max, Number(item?.sequence) || 0), 0);
    if (maxSequence > logSequence) {
      logSequence = maxSequence;
      try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    }
  }
  function persistDiagnosticLogLocally() {
    try {
      const normalized = normalizeDiagnosticLog(diagnosticLog);
      diagnosticLog.splice(0, diagnosticLog.length, ...normalized);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem('livrocaixa_sync_errors', JSON.stringify(normalized.filter(item => item.type === 'ERROR').slice(0, 50)));
    } catch (err) { console.warn('LOG local indisponível:', err); }
  }
  function hydrateDiagnosticLog() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch (err) {}
    if (!Array.isArray(stored) || stored.length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem('livrocaixa_sync_errors') || '[]');
        stored = Array.isArray(legacy) ? legacy.map(item => ({ id: 'legacy-' + Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), type: 'ERROR', module: 'Sincronização', action: item.context || 'Operação', status: 'Falha', description: item.message || 'Erro legado', details: null })) : [];
      } catch (err) {}
    }
    diagnosticLog.splice(0, diagnosticLog.length, ...normalizeDiagnosticLog(stored));
    syncLogSequenceFromEvents(diagnosticLog);
  }
  async function loadDiagnosticLog() {
    hydrateDiagnosticLog();
    if (!currentUser) return;
    try {
      const snap = await db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').limit(100).get();
      const remote = snap.docs.map(doc => ({ ...normalizeLogEvent(doc.data()), synced: true })).filter(item => item && item.id);
      const merged = new Map(diagnosticLog.map(item => [item.id, normalizeLogEvent(item)]));
      remote.forEach(item => merged.set(item.id, item));
      diagnosticLog.splice(0, diagnosticLog.length, ...[...merged.values()].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, LOG_LIMIT));
      syncLogSequenceFromEvents(diagnosticLog);
      persistDiagnosticLogLocally();
    } catch (err) { console.warn('LOG remoto indisponível:', err); }
  }
  function createLogEvent({ type = 'INFO', module = 'Sistema', action = 'Operação', status = 'Sucesso', description = '', details = null, correlationId = null, durationMs = null, retryCount = null, source = LOG_SOURCE, synced = null } = {}) {
    return {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      sequence: nextLogSequence(),
      timestamp: new Date().toISOString(), type, module, action, status,
      description: String(description || '').slice(0, 800), details: sanitizeLogValue(details),
      correlationId: correlationId ? String(correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0 ? Math.round(Number(durationMs)) : null,
      retryCount: Number.isFinite(Number(retryCount)) && Number(retryCount) >= 0 ? Math.floor(Number(retryCount)) : null,
      source: String(source || LOG_SOURCE).slice(0, 80), synced: synced === true ? true : synced === false ? false : null,
      schemaVersion: LOG_SCHEMA_VERSION
    };
  }
  function recordLogEvent(input = {}) {
    const event = createLogEvent({ ...input, synced: currentUser ? false : null });
    diagnosticLog.unshift(event);
    if (diagnosticLog.length > LOG_LIMIT) diagnosticLog.length = LOG_LIMIT;
    persistDiagnosticLogLocally();
    if (event.type === 'ERROR') flashSyncError();
    if (currentUser) {
      db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').doc(event.id).set(event, { merge: true })
        .then(() => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = true; persistDiagnosticLogLocally(); })
        .catch(err => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = false; persistDiagnosticLogLocally(); console.warn('Falha ao sincronizar o LOG:', err); });
    }
    if (event.type === 'ERROR') console.error(`[${event.module}] ${event.action}:`, event.description, event.details || '');
    else if (event.type === 'WARN') console.warn(`[${event.module}] ${event.action}:`, event.description);
    return event;
  }
  function logInfo(module, action, status = 'Sucesso', description = '', details = null, operation = null) { const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null; return recordLogEvent({ type: 'INFO', module, action, status, description, details, ...getLogContextFields(operation, duration) }); }
  function logWarn(module, action, status = 'Atenção', description = '', details = null, operation = null) { const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null; return recordLogEvent({ type: 'WARN', module, action, status, description, details, ...getLogContextFields(operation, duration) }); }
  function logSyncError(context, err, operation = null) {
    const message = err && err.message ? err.message : String(err);
    recordLogEvent({ type: 'ERROR', module: context === 'sincronização' ? 'Sincronização' : 'Sistema', action: context, status: 'Falha', description: message, details: err && { code: err.code, failedCollections: err.failedCollections }, ...getLogContextFields(operation, operationDuration(operation)) });
  }
  window.addEventListener('error', event => {
    const error = event.error || new Error(event.message || 'Erro de interface');
    if (!error.__livroCaixaLogged) { error.__livroCaixaLogged = true; logSyncError('erro de interface', error); }
  });
  window.addEventListener('unhandledrejection', event => {
    logSyncError('rejeição assíncrona', event.reason || new Error('Promise rejeitada sem motivo informado'));
  });
  function flashSyncError() {
    const dot = document.getElementById('syncDot');
    if (!dot) return;
    dot.classList.add('sync-error');
    setTimeout(() => dot.classList.remove('sync-error'), 4000);
  }

  function persistNow(operation = null) {
    if (!currentUser) return Promise.resolve();
    clearTimeout(saveTimer);
    setSyncDot(true);
    pendingSaveCount++;
    return commitDiff()
      .then(() => { setSyncDot(false); logInfo('Salvamento', 'Persistência dos dados', 'Sucesso', 'Alterações gravadas nas coleções do Livro-Caixa.', null, operation); })
      .catch(err => { logSyncError('salvamento', err, operation); setSyncDot(false); throw err; })
      .finally(() => {
        pendingSaveCount = Math.max(0, pendingSaveCount - 1);
        if (pendingSaveCount === 0) flushSnapshotBuffer();
      });
  }

  async function commitDiff() {
    const saveUserUid = currentUser?.uid || null;
    if (!saveUserUid) return;

    const userDocRef = db.collection('livrocaixa').doc(saveUserUid);
    const current = currentStateSnapshot();
    const failedCollections = [];
    const MAX_BATCH_OPERATIONS = 400;

    for (const name of COLLECTIONS) {
      if (currentUser?.uid !== saveUserUid) return;

      const newMap = arrToMap(current[name]);
      const oldMap = lastSynced[name] || {};
      const operations = [];

      Object.keys(newMap).forEach(id => {
        const newItem = newMap[id];
        const oldItem = oldMap[id];

        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          operations.push({
            type: 'set',
            ref: userDocRef.collection(name).doc(id),
            data: newItem
          });
        }
      });

      Object.keys(oldMap).forEach(id => {
        if (!newMap[id]) {
          operations.push({
            type: 'delete',
            ref: userDocRef.collection(name).doc(id)
          });
        }
      });

      if (operations.length === 0) continue;

      try {
        for (let i = 0; i < operations.length; i += MAX_BATCH_OPERATIONS) {
          if (currentUser?.uid !== saveUserUid) return;

          const chunk = operations.slice(i, i + MAX_BATCH_OPERATIONS);
          const batch = db.batch();

          chunk.forEach(operation => {
            if (operation.type === 'set') {
              batch.set(operation.ref, operation.data);
            } else {
              batch.delete(operation.ref);
            }
          });

          await batch.commit();
        }

        if (currentUser?.uid !== saveUserUid) return;
        lastSynced[name] = newMap;
      } catch (err) {
        console.error(`Falha ao salvar a coleção "${name}":`, err);
        failedCollections.push(name);
      }
    }

    if (failedCollections.length > 0) {
      const err = new Error(`Falha ao sincronizar: ${failedCollections.join(', ')}`);
      err.failedCollections = failedCollections;
      throw err;
    }
  }

  function persistAll(operation = null) { return persistNow(operation); }
  function saveBanks(operation = null) { return persistAll(operation); }
  function saveCategories(operation = null) { return persistAll(operation); }
  function saveEntries(operation = null) { return persistAll(operation); }
  function saveInvestments(operation = null) { return persistAll(operation); }
  function savePockets(operation = null) { return persistAll(operation); }

  function bankBalance(bankId) {
    const bank = banks.find(b => b.id === bankId);
    const initial = bank ? (bank.initial || 0) : 0;
    return entries.filter(e => e.bank === bankId).reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), initial);
  }

  function totalBankBalance() {
    return banks.reduce((sum, b) => sum + bankBalance(b.id), 0);
  }

  function totalInvestBalance() {
    return investments.reduce((sum, i) => {
      if (i.type === 'Renda Fixa') return sum + fixedIncomeCurrentValue(i);
      let v = Number(i.value);
      if (!(v >= 0) || (v === 0 && isCryptoType(i.type) && cryptoCurrentUnits(i) > 0 && Number(i.price) > 0)) {
        v = cryptoValueFromUnits(i.type, cryptoCurrentUnits(i), i.price || 0);
      }
      return sum + (Number(v) || 0);
    }, 0);
  }

  function pocketMovementTotal(pocketId, excludeId = null) {
    return yieldsLog
      .filter(y => y.targetType === 'pocket' && y.targetId === pocketId && y.id !== excludeId)
      .reduce((sum, y) => sum + (y.kind === 'resgate' ? -1 : 1) * (Number(y.amount) || 0), 0);
  }

  function pocketCurrentBalance(pocket) {
    const initial = Number(pocket.initial ?? pocket.value ?? 0) || 0;
    return initial + pocketMovementTotal(pocket.id);
  }

  function normalizePockets() {
    pockets.forEach(p => {
      if (p.initial == null) {
        const currentStored = Number(p.value) || 0;
        const movementTotal = pocketMovementTotal(p.id);
        p.initial = currentStored - movementTotal;
      }
      if ('value' in p) delete p.value;
    });
  }

  function normalizeGoals() {
    const validStatuses = new Set(['active', 'completed', 'paused', 'cancelled']);

    goals.forEach(goal => {
      if (!goal || typeof goal !== 'object') return;

      if (!goal.id) {
        goal.id = 'goal' + Date.now() + Math.random().toString(36).slice(2, 7);
      }

      if (goal.name == null) goal.name = '';
      goal.name = String(goal.name).slice(0, 200);

      if (goal.icon == null || !String(goal.icon).trim()) goal.icon = '🎯';
      else goal.icon = String(goal.icon).slice(0, 8);

      if (goal.targetAmount == null) {
        goal.targetAmount = 0;
      } else {
        const target = Number(goal.targetAmount);
        goal.targetAmount = Number.isFinite(target) ? Math.max(0, target) : 0;
      }

      if (!goal.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(goal.startDate))) {
        const created = String(goal.createdAt || '');
        goal.startDate = /^\d{4}-\d{2}-\d{2}/.test(created)
          ? created.slice(0, 10)
          : todayISO();
      }

      if (!Object.prototype.hasOwnProperty.call(goal, 'caixinhaId') || !goal.caixinhaId) {
        goal.caixinhaId = null;
      } else {
        goal.caixinhaId = String(goal.caixinhaId);
      }

      if (!goal.sourceType) {
        goal.sourceType = goal.caixinhaId ? 'pocket' : null;
      }
      if (!goal.sourceId) {
        goal.sourceId = goal.caixinhaId || null;
      }
      if (goal.sourceType && !['bank', 'pocket', 'invest'].includes(goal.sourceType)) {
        goal.sourceType = null;
        goal.sourceId = null;
      }
      if (goal.sourceId != null) goal.sourceId = String(goal.sourceId);

      if (!validStatuses.has(goal.status)) {
        goal.status = 'active';
      }

      if (goal.deadline == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(goal.deadline))) goal.deadline = '';
      if (goal.desc == null) goal.desc = '';
      else goal.desc = String(goal.desc).slice(0, 500);

      if (!goal.createdAt) goal.createdAt = todayISO();
      if (!goal.updatedAt) goal.updatedAt = goal.createdAt;
    });
  }

  function goalCurrentAmount(goal) {
    if (!goal) return null;

    const sourceType = goal.sourceType || (goal.caixinhaId ? 'pocket' : null);
    const sourceId = goal.sourceId || goal.caixinhaId || null;

    if (sourceType === 'bank' && sourceId) {
      const bank = banks.find(b => b.id === sourceId);
      return bank ? bankBalance(sourceId) : null;
    }

    if (sourceType === 'pocket' && sourceId) {
      const pocket = pockets.find(p => p.id === sourceId);
      return pocket ? pocketCurrentBalance(pocket) : null;
    }

    if (sourceType === 'invest' && sourceId) {
      const investment = investments.find(i => i.id === sourceId);
      return investment ? investmentValueAtDate(investment, todayISO()) : null;
    }

    if (Object.prototype.hasOwnProperty.call(goal, 'currentAmount')) {
      const legacyCurrent = Number(goal.currentAmount);
      return Number.isFinite(legacyCurrent) ? Math.max(0, legacyCurrent) : null;
    }

    return null;
  }

  function totalPocketBalance() {
    return pockets.reduce((sum, p) => sum + pocketCurrentBalance(p), 0);
  }

  const VIEW_PERIOD_KEY = 'livrocaixa_view_period_v18_08';
  let viewPeriod = { mode: 'month', month: currentMonthYM() };

  function loadViewPeriod() {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_PERIOD_KEY) || 'null');
      if (saved && (saved.mode === 'all' || /^\d{4}-\d{2}$/.test(String(saved.month || '')))) {
        viewPeriod = { mode: saved.mode === 'all' ? 'all' : 'month', month: saved.month || currentMonthYM() };
      }
    } catch (err) { viewPeriod = { mode:'month', month:currentMonthYM() }; }
  }
  function saveViewPeriod() { try { localStorage.setItem(VIEW_PERIOD_KEY, JSON.stringify(viewPeriod)); } catch (err) {} }
  function activePeriodRange() {
    if (viewPeriod.mode === 'all') return { start: null, end: null };
    return { start: `${viewPeriod.month}-01`, end: monthEndDate(viewPeriod.month) };
  }
  function periodLabel() {
    if (viewPeriod.mode === 'all') return 'Todos / Todo o histórico';
    const [year, month] = viewPeriod.month.split('-').map(Number);
    const name = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month:'long' });
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${year}`;
  }
  function periodMatchesDate(date) {
    if (viewPeriod.mode === 'all') return true;
    const value = String(date || '');
    const range = activePeriodRange();
    return value >= range.start && value <= range.end;
  }
  function periodMatchesMovement(y) {
    return periodMatchesDate(y?.date);
  }
  function updatePeriodUI() {
    const label = periodLabel();
    const active = document.getElementById('periodActiveLabel');
    const button = document.getElementById('btnPeriodPicker');
    const input = document.getElementById('periodMonthInput');
    const all = document.getElementById('btnPeriodAll');
    const prev = document.getElementById('btnPeriodPrev');
    const next = document.getElementById('btnPeriodNext');
    if (active) active.textContent = label;
    if (button) button.textContent = viewPeriod.mode === 'all' ? 'Escolher mês ▾' : `${label} ▾`;
    if (input) input.value = viewPeriod.mode === 'all' ? '' : viewPeriod.month;
    if (all) { all.classList.toggle('is-active', viewPeriod.mode === 'all'); all.setAttribute('aria-pressed', viewPeriod.mode === 'all' ? 'true' : 'false'); }
    if (prev) prev.disabled = viewPeriod.mode === 'all';
    if (next) next.disabled = viewPeriod.mode === 'all';
  }
  function setViewPeriod(mode, month = currentMonthYM(), rerender = true) {
    viewPeriod = { mode: mode === 'all' ? 'all' : 'month', month: String(month || currentMonthYM()).slice(0,7) };
    saveViewPeriod(); updatePeriodUI();
    if (rerender) { renderCategorySummary(); renderLedger(); renderInvestments(); renderPocketBalances(); renderPockets(); renderPeriodSummaries(); }
  }
  function shiftViewPeriod(delta) {
    if (viewPeriod.mode === 'all') return;
    const [year, month] = viewPeriod.month.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setViewPeriod('month', `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  }
  function periodSummaryHTML(items) {
    return items.map(item => `<div class="period-summary-card"><small>${escapeHTML(item.label)}</small><strong class="${item.tone || ''}">${escapeHTML(item.value)}</strong></div>`).join('');
  }
  function renderPeriodSummaries() {
    const entryItems = entries.filter(e => periodMatchesDate(e.date));
    const income = entryItems.filter(e => e.type === 'in').reduce((s,e)=>s+Number(e.amount||0),0);
    const expense = entryItems.filter(e => e.type === 'out').reduce((s,e)=>s+Number(e.amount||0),0);
    const net = income - expense;
    const caixa = document.getElementById('caixaPeriodSummary');
    if (caixa) caixa.innerHTML = periodSummaryHTML([
      {label:'Movimentações', value:String(entryItems.length)},
      {label:'Entradas', value:fmt(income), tone:'positive'},
      {label:'Saídas', value:fmt(expense), tone:'negative'},
      {label:'Resultado', value:fmt(net), tone:net >= 0 ? 'positive' : 'negative'}
    ]);

    const investMoves = yieldsLog.filter(y => y.targetType === 'invest' && periodMatchesMovement(y));
    const investAportes = investMoves.filter(y => (y.kind||'rendimento') === 'aporte').reduce((s,y)=>s+Math.abs(Number(y.amount||0)),0);
    const investResgates = investMoves.filter(y => y.kind === 'resgate').reduce((s,y)=>s+Math.abs(Number(y.amount||0)),0);
    const investYields = investMoves.filter(y => (y.kind||'rendimento') === 'rendimento').reduce((s,y)=>s+Number(y.amount||0),0);
    const investSummary = document.getElementById('investPeriodSummary');
    if (investSummary) investSummary.innerHTML = periodSummaryHTML([
      {label:'Movimentações', value:String(investMoves.length)},
      {label:'Aportes', value:fmt(investAportes), tone:'positive'},
      {label:'Resgates', value:fmt(investResgates), tone:'negative'},
      {label:'Rendimentos', value:fmt(investYields), tone:investYields >= 0 ? 'positive' : 'negative'}
    ]);

  }

  function monthKeyOffset(offset) {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + offset);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  }

  function netFlowForMonth(monthKey) {
    return entries.filter(entry => String(entry.date || '').startsWith(monthKey)).reduce((sum, entry) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0)), 0);
  }

  function monthlyFlowInsight() {
    const current = netFlowForMonth(monthKeyOffset(0));
    const previous = netFlowForMonth(monthKeyOffset(-1));
    if (current === 0 && previous === 0) return { kind:'neutral', value:'Sem comparativo mensal', detail:'Registre lançamentos em meses diferentes' };
    if (previous === 0) return { kind: current >= 0 ? 'positive' : 'negative', value:fmt(current), detail:'Fluxo líquido no mês atual' };
    const delta = ((current - previous) / Math.abs(previous)) * 100;
    const arrow = delta >= 0 ? '↑' : '↓';
    return { kind:delta >= 0 ? 'positive' : 'negative', value:`${arrow} ${Math.abs(delta).toFixed(1).replace('.', ',')}%`, detail:'em relação ao fluxo do mês anterior' };
  }

  function percentOfTotal(value, total) {
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, value / total * 100);
  }

  function financialIcon(kind) {
    const icons = {
      wallet: '<i class="fi fi-rr-wallet" aria-hidden="true"></i>',
      bank: '<i class="fi fi-rr-building" aria-hidden="true"></i>',
      box: '<i class="fi fi-rr-box" aria-hidden="true"></i>',
      growth: '<i class="fi fi-rr-chart-line-up" aria-hidden="true"></i>'
    };
    return icons[kind] || icons.wallet;
  }

  /* [JS 08] RENDERIZAÇÃO / VIEWS */
  function renderBalances() {
    const strip = document.getElementById('balanceStrip');
    if (!strip) return;

    const balancesReady = !!currentUser && !!firstLoadDone;
    const bankTotal = totalBankBalance();
    const investTotal = totalInvestBalance();
    const pocketTotal = totalPocketBalance();
    const totalPatrimonio = bankTotal + pocketTotal + investTotal;
    const flowInsight = monthlyFlowInsight();
    const bankShare = balancesReady ? percentOfTotal(bankTotal, totalPatrimonio) : null;
    const investShare = balancesReady ? percentOfTotal(investTotal, totalPatrimonio) : null;
    const pocketShare = balancesReady ? percentOfTotal(pocketTotal, totalPatrimonio) : null;

    const totalLabel = balancesReady ? fmt(totalPatrimonio) : '—';
    const bankLabel = balancesReady ? fmt(bankTotal) : '—';
    const pocketLabel = balancesReady ? fmt(pocketTotal) : '—';
    const investLabel = balancesReady ? fmt(investTotal) : '—';
    const insightValue = balancesReady ? flowInsight.value : '—';
    const insightDetail = balancesReady ? flowInsight.detail : 'Aguardando dados';

    let html = `
    <div class="balance-card total">
      <div class="balance-card-head"><span class="label">Patrimônio Total</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-wallet" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && totalPatrimonio < 0 ? 'neg' : ''}">${totalLabel}</span>
      <span class="balance-insight is-${balancesReady ? flowInsight.kind : 'neutral'}"><strong>${escapeHTML(insightValue)}</strong><span>${escapeHTML(insightDetail)}</span></span>
    </div>
    <div class="balance-card bank-summary-card" role="button" tabindex="0" aria-label="Ver saldos dos bancos" title="Ver saldos dos bancos">
      <div class="balance-card-head"><span class="label">Bancos</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-bank" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && bankTotal < 0 ? 'neg' : ''}">${bankLabel}</span>
      ${bankShare === null ? '' : `<span class="balance-share">${bankShare.toFixed(0)}% do patrimônio</span>`}
    </div>
    <div class="balance-card pocket-summary-card" role="button" tabindex="0" aria-label="Ver caixinhas" title="Ver caixinhas">
      <div class="balance-card-head"><span class="label">Caixinhas</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-piggy-bank" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && pocketTotal < 0 ? 'neg' : ''}">${pocketLabel}</span>
      ${pocketShare === null ? '' : `<span class="balance-share">${pocketShare.toFixed(0)}% do patrimônio</span>`}
    </div>
    <div class="balance-card invest-summary-card" role="button" tabindex="0" aria-label="Ver investimentos" title="Ver investimentos">
      <div class="balance-card-head"><span class="label" title="Investimentos">Invest.</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-chat-arrow-grow" aria-hidden="true"></i></span></div>
      <span class="amount">${investLabel}</span>
      ${investShare === null ? '' : `<span class="balance-share">${investShare.toFixed(0)}% do patrimônio</span>`}
    </div>`;
    strip.innerHTML = html;
    markValueRefresh(strip);
    const bankSummaryCard = strip.querySelector('.bank-summary-card');
    const openBankPanel = () => openBankManagementPanel();
    bankSummaryCard?.addEventListener('click', openBankPanel);
    bankSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openBankPanel();
      }
    });
    const pocketSummaryCard = strip.querySelector('.pocket-summary-card');
    const openPocketsTab = () => window.switchTab('pockets');
    pocketSummaryCard?.addEventListener('click', openPocketsTab);
    pocketSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPocketsTab();
      }
    });
    // P2.4.2 — mesmo padrão de navegação dos cards Contas e Caixinhas
    const investSummaryCard = strip.querySelector('.invest-summary-card');
    const openInvestTab = () => window.switchTab('invest');
    investSummaryCard?.addEventListener('click', openInvestTab);
    investSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInvestTab();
      }
    });
  }

  function getDashboardAlerts() {
    const alerts = [];
    if (banks.length === 0) {
      alerts.push({ icon: '▦', title: 'Adicione uma conta bancária', detail: 'Cadastre um banco para acompanhar seu saldo disponível.' });
    }
    banks.filter(bank => bankBalance(bank.id) < 0).forEach(bank => {
      alerts.push({ icon: '!', title: `${bank.name} está com saldo negativo`, detail: `Saldo atual: ${fmt(bankBalance(bank.id))}.` });
    });
    const cryptoWithoutQuote = investments.filter(inv => isCryptoType(inv.type) && !inv.lastQuoteAt);
    cryptoWithoutQuote.slice(0, 2).forEach(inv => {
      alerts.push({ icon: '↻', title: `Atualize a cotação de ${inv.alias || inv.name}`, detail: 'Este ativo ainda não possui uma atualização de cotação registrada.' });
    });
    if (entries.length === 0 && banks.length > 0) {
      alerts.push({ icon: '+', title: 'Registre seu primeiro lançamento', detail: 'Use “Novo lançamento” para começar a acompanhar suas movimentações.' });
    }
    if (featureSettings.reminders) {
      const key = billMonthKey(new Date());
      recurringBills.filter(bill => billAppliesToMonth(bill, new Date().getFullYear(), new Date().getMonth()) && !billGeneratedForMonth(bill, key) && !billPaidForMonth(bill, key)).slice(0, 3).forEach(bill => {
        const status = billStatus(bill, key);
        alerts.push({ icon: status === 'Atrasado' ? '!' : '◷', title: `${status}: ${bill.name}`, detail: `Vencimento ${billDueDateForMonth(bill, new Date().getFullYear(), new Date().getMonth())} · ${fmt(bill.amount)}` });
      });
    }
    return alerts.slice(0, 8);
  }

  function renderNotifications() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!list || !badge) return;
    const alerts = getDashboardAlerts();
    badge.hidden = alerts.length === 0;
    badge.textContent = alerts.length > 9 ? '9+' : String(alerts.length);
    list.innerHTML = alerts.length ? alerts.map(alert => `<article class="notification-item"><span class="notification-item-icon">${alert.icon}</span><div><strong>${escapeHTML(alert.title)}</strong><p>${escapeHTML(alert.detail)}</p></div></article>`).join('') : `<div class="notification-empty">Nenhum aviso pendente. Seus dados estão organizados.</div>`;
  }

  function closeDrawer() {
    const overlay = document.getElementById('appDrawerOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function closeNotifications() {
    const overlay = document.getElementById('notificationOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function openDrawer() {
    closeNotifications();
    const overlay = document.getElementById('appDrawerOverlay');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
  }

  function openNotifications() {
    closeDrawer();
    renderNotifications();
    const overlay = document.getElementById('notificationOverlay');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
  }

  function renderBankSelects() {
    const options = banks.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    document.getElementById('fBanco').innerHTML = options;
    const pocketBank = document.getElementById('pBancoOrigem');
    if (pocketBank) {
      const current = pocketBank.value;
      pocketBank.innerHTML = `<option value="">A definir</option>${options}`;
      if (current && banks.some(b => b.id === current)) pocketBank.value = current;
    }

    const bankOptGroup = banks.map(b => `<option value="${b.id}">🏦 ${escapeHTML(b.name)}</option>`).join('');
    const pocketOptGroup = pockets.map(p => `<option value="${p.id}">🐷 ${escapeHTML(p.name)} (Caixinha)</option>`).join('');
    const investmentOptGroup = investments.map(i => `<option value="${i.id}">🪙 ${escapeHTML(i.name)} (Investimento)</option>`).join('');
    const transferOptions =
      (bankOptGroup ? `<optgroup label="Bancos">${bankOptGroup}</optgroup>` : '') +
      (pocketOptGroup ? `<optgroup label="Caixinhas">${pocketOptGroup}</optgroup>` : '') +
      (investmentOptGroup ? `<optgroup label="Investimentos">${investmentOptGroup}</optgroup>` : '');

    const tDe = document.getElementById('tDe');
    const tPara = document.getElementById('tPara');
    tDe.innerHTML = transferOptions;
    tPara.innerHTML = transferOptions;
    const firstOther = [...banks, ...pockets, ...investments].find(item => item.id !== tDe.value);
    if (firstOther) tPara.value = firstOther.id;
  }

  function renderBankManageList() {
    const container = document.getElementById('bankManageList');
    const total = totalBankBalance();
    const sortedBanks = [...banks].sort((a, b) => {
      const diff = bankBalance(b.id) - bankBalance(a.id);
      return diff !== 0 ? diff : String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
    container.innerHTML = sortedBanks.map(b => {
      const balance = bankBalance(b.id);
      const share = percentOfTotal(balance, total);
      return `<div class="bank-list-item">
        <div class="manage-item-copy"><strong>${escapeHTML(b.name)}</strong><span>Saldo atual</span><span class="bank-share-line">${share == null ? '—' : share.toFixed(1).replace('.', ',') + '% do total'}</span></div>
        <strong class="manage-item-value">${fmt(balance)}</strong>
        <div class="manage-item-actions">
          <button type="button" class="action-btn beta-icon-button edit" onclick="editBank('${b.id}')" aria-label="Editar banco" title="Editar banco"></button>
          <button type="button" class="action-btn beta-icon-button delete" onclick="deleteBank('${b.id}')" aria-label="Excluir banco" title="Excluir banco"></button>
        </div>
      </div>`;
    }).join('');
  }

  const CATEGORY_PALETTE = ['#93584B', '#386D54', '#B89034', '#426980', '#593553', '#AA825A', '#678974', '#AC5E88'];
  const CATEGORY_ICON_RULES = [
    [/aliment|restaur|mercado|comida/i, '🍔'], [/transporte|uber|ônibus|combust/i, '🚗'],
    [/moradia|casa|aluguel|luz|água/i, '🏠'], [/salário|renda|receb|trabalho/i, '💰'],
    [/invest|cripto|cdb|renda fixa/i, '📈'], [/lazer|jogo|cinema|stream/i, '🎮'],
    [/compra|loja/i, '🛒'], [/saúde|farmácia|médic/i, '❤️'], [/educa|curso|livro/i, '📚'], [/transfer/i, '↔️']
  ];
  const categoryColorMap = new Map();
  function pickCategoryColor(key) {
    const used = new Set(categoryColorMap.values());
    const seed = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      const candidate = CATEGORY_PALETTE[(seed + i) % CATEGORY_PALETTE.length];
      if (!used.has(candidate)) return candidate;
    }
    return `hsl(${(216 + categoryColorMap.size * 137.508) % 360}, 24%, 58%)`;
  }
  function categoryColor(category) {
    if (!category) return '#66746B';
    if (category.color) return category.color;
    const key = String(category.id || category.name || 'outros');
    if (!categoryColorMap.has(key)) {
      (Array.isArray(categories) ? categories : []).forEach(cat => {
        const catKey = cat && String(cat.id || cat.name || 'outros');
        if (catKey && !categoryColorMap.has(catKey)) categoryColorMap.set(catKey, pickCategoryColor(catKey));
      });
      if (!categoryColorMap.has(key)) categoryColorMap.set(key, pickCategoryColor(key));
    }
    return categoryColorMap.get(key);
  }

  const normalizeTextKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  function findCategoryByName(name) {
    const key = normalizeTextKey(name);
    return categories.find(c => normalizeTextKey(c.name) === key) || null;
  }

  function categoryIcon(category, flow = 'in') {
    if (category?.icon) return category.icon;
    const name = String(category?.name || '');
    const match = CATEGORY_ICON_RULES.find(([rule]) => rule.test(name));
    return match ? match[1] : (flow === 'out' ? '↘' : '↗');
  }

  const EMOJI_CATALOG = window.LC_EMOJI_CATALOG || [];
  function emojiLabel(icon) {
    return (EMOJI_CATALOG.find(([emoji]) => emoji === icon) || [icon, 'Emoji personalizado'])[1];
  }
  function isEmojiValue(value) {
    try { return /\p{Extended_Pictographic}/u.test(String(value || '')); } catch (err) { return String(value || '').trim().length > 0; }
  }
  function setCategoryDraftIcon(icon) {
    const value = String(icon || '📦').trim();
    document.getElementById('cIcon').value = value;
    document.getElementById('cEmojiPreview').textContent = value;
    document.getElementById('cEmojiLabel').textContent = emojiLabel(value);
  }
  let emojiFloatPending = null;
  let categoryIconTouched = false;
  let categoryIconSuggested = null;
  function normalizeEmojiSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function suggestEmojiForCategoryName(name) {
    const query = normalizeEmojiSearch(name);
    if (!query) return null;
    const entries = EMOJI_CATALOG.map(([emoji, label, group]) => ({ emoji, l: normalizeEmojiSearch(label), g: normalizeEmojiSearch(group) }));
    const match = entries.find(e => e.l === query)
      || entries.find(e => e.l.startsWith(query))
      || entries.find(e => e.l.includes(query))
      || entries.find(e => e.g === query)
      || entries.find(e => query.includes(e.l));
    return match ? match.emoji : null;
  }
  function applyCategoryNameSuggestion() {
    if (categoryIconTouched) return;
    const suggestion = suggestEmojiForCategoryName(document.getElementById('cNome').value);
    const current = document.getElementById('cIcon').value || '📦';
    if (suggestion) {
      if (current !== suggestion) {
        categoryIconSuggested = suggestion;
        setCategoryDraftIcon(suggestion);
      }
    } else if (categoryIconSuggested && current === categoryIconSuggested) {
      categoryIconSuggested = null;
      setCategoryDraftIcon('📦');
    }
  }
  function renderEmojiFloatGrid() {
    const current = emojiFloatPending || document.getElementById('cIcon').value || '📦';
    const rawQuery = document.getElementById('emojiFloatSearch')?.value || '';
    const query = normalizeEmojiSearch(rawQuery);
    const matches = EMOJI_CATALOG.filter(([emoji, label, group]) => !query
      || normalizeEmojiSearch(label).includes(query)
      || normalizeEmojiSearch(group).includes(query)
      || emoji.includes(query));
    let html = '';
    let lastGroup = '';
    for (const [emoji, label, group] of matches) {
      if (group && group !== lastGroup) {
        lastGroup = group;
        html += `<div class="emoji-float-group">${escapeHTML(group)}</div>`;
      }
      html += `<button type="button" class="${emoji === current ? 'selected' : ''}" data-emoji="${emoji}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}" aria-pressed="${emoji === current}"><span class="emoji-float-btn-emoji">${emoji}</span><span class="emoji-float-btn-label">${escapeHTML(label)}</span></button>`;
    }
    if (!matches.length) {
      html = `<div class="emoji-float-empty">Nenhum emoji encontrado para “${escapeHTML(rawQuery)}”</div>`;
    }
    document.getElementById('emojiFloatGrid').innerHTML = html;
    updateEmojiFloatPreview(current);
  }
  function updateEmojiFloatPreview(icon) {
    document.getElementById('emojiFloatPreviewIcon').textContent = icon;
    document.getElementById('emojiFloatPreviewLabel').textContent = emojiLabel(icon);
  }
  function openEmojiFloat() {
    emojiFloatPending = document.getElementById('cIcon').value || '📦';
    document.getElementById('emojiFloatNativeBox').classList.remove('is-open');
    document.getElementById('emojiFloatNativeInput').value = '';
    document.getElementById('emojiFloatSearch').value = '';
    renderEmojiFloatGrid();
    document.getElementById('emojiFloatOverlay').classList.add('open');
  }
  function closeEmojiFloat() {
    document.getElementById('emojiFloatOverlay').classList.remove('open');
  }
  function initCategoryEmojiPicker() {
    document.getElementById('btnEmojiCatalog').onclick = openEmojiFloat;
    document.getElementById('emojiFloatSearch').addEventListener('input', renderEmojiFloatGrid);
    document.getElementById('cNome').addEventListener('input', applyCategoryNameSuggestion);
    document.getElementById('emojiFloatClose').onclick = closeEmojiFloat;
    document.getElementById('emojiFloatOverlay').onclick = event => {
      if (event.target.id === 'emojiFloatOverlay') closeEmojiFloat();
    };
    document.getElementById('emojiFloatGrid').onclick = event => {
      const button = event.target.closest('[data-emoji]');
      if (!button) return;
      emojiFloatPending = button.dataset.emoji;
      document.getElementById('emojiFloatNativeBox').classList.remove('is-open');
      renderEmojiFloatGrid();
    };
    document.getElementById('emojiFloatKeyboard').onclick = () => {
      document.getElementById('emojiFloatNativeBox').classList.add('is-open');
      requestAnimationFrame(() => document.getElementById('emojiFloatNativeInput').focus({ preventScroll: true }));
    };
    document.getElementById('emojiFloatNativeUse').onclick = () => {
      const input = document.getElementById('emojiFloatNativeInput');
      const value = input.value.trim();
      if (!isEmojiValue(value)) { alert('Digite ou cole um emoji válido do teclado.'); return; }
      emojiFloatPending = value;
      updateEmojiFloatPreview(value);
      renderEmojiFloatGrid();
    };
    document.getElementById('emojiFloatConfirm').onclick = () => {
      categoryIconTouched = true;
      setCategoryDraftIcon(emojiFloatPending || document.getElementById('cIcon').value);
      closeEmojiFloat();
    };
    setCategoryDraftIcon(document.getElementById('cIcon').value || '📦');
  }
  initCategoryEmojiPicker();
  updateNavIndicator(currentTab);

  function renderCategorySelect() {
    const sel = document.getElementById('fCategoria');
    const currentVal = sel.value;
    sel.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    if (currentVal && categories.some(c => c.id === currentVal)) {
      sel.value = currentVal;
    }
  }

  function renderCategoryManageList() {
    const container = document.getElementById('catManageList');
    container.innerHTML = categories.map(c => `
      <div class="cat-list-item">
        <span class="category-dot" style="background:${categoryColor(c)}">${categoryIcon(c)}</span>
        <strong class="manage-item-copy">${escapeHTML(c.name)}<span>${escapeHTML(categoryIcon(c))} · ${escapeHTML(c.color ? 'cor personalizada' : 'cor automática')}</span></strong>
        <span class="manage-item-actions">
          <button type="button" class="action-btn beta-icon-button edit" onclick="editCategory('${c.id}')" aria-label="Editar categoria" title="Editar categoria"></button>
          <button type="button" class="action-btn beta-icon-button delete" onclick="deleteCategory('${c.id}')" aria-label="Excluir categoria" title="Excluir categoria"></button>
        </span>
      </div>
    `).join('');
  }

  function updateFixedIncomeFormCurrent() {
    const currentInput = document.getElementById('iValorAtualSimples');
    if (!currentInput) return;
    const item = editingInvestId ? investments.find(x => x.id === editingInvestId) : null;
    const initial = readMoneyInput('iValorSimples');
    const movements = item ? fixedIncomeMovementTotal(item) : 0;
    setMoneyInput('iValorAtualSimples', Math.max(0, initial + movements));
  }
  const SATS_PER_BTC = 100000000;
  function isCryptoType(type) {
    return type === 'Stablecoin' || type === 'Criptomoeda' || type === 'Bitcoin';
  }
  function isBitcoinType(type) {
    return type === 'Bitcoin';
  }
  // 'units' de Bitcoin é sempre um inteiro de SATS. Nunca converter pra BTC fracionário
  // pra evitar perda de precisão — a conversão só acontece na hora de calcular o valor em BRL.
  function cryptoValueFromUnits(type, units, pricePerUnit) {
    if (!isFinite(units) || !isFinite(pricePerUnit)) return 0;
    if (isBitcoinType(type)) return (units / SATS_PER_BTC) * pricePerUnit;
    return units * pricePerUnit;
  }
  function cryptoMovementTotal(item, excludeId = null) {
    if (!item) return 0;
    const total = yieldsLog
      .filter(y => y.targetType === 'invest' && y.targetId === item.id && y.id !== excludeId && y.units != null)
      .reduce((sum, y) => sum + (y.kind === 'resgate' ? -1 : 1) * (Number(y.units) || 0), 0);
    return Number(total.toFixed(8));
  }
  function cryptoInitialUnits(item) {
    if (Number.isFinite(Number(item?.initialUnits))) return Number(item.initialUnits);
    return Number(item?.units || 0) - cryptoMovementTotal(item);
  }
  function cryptoCurrentUnits(item, excludeId = null) {
    const current = Math.max(0, cryptoInitialUnits(item) + cryptoMovementTotal(item, excludeId));
    return isBitcoinType(item?.type) ? Math.round(current) : Number(current.toFixed(8));
  }
  /* Movimentações legadas/importadas podem não ter 'units'. Elas já ficam de fora
     do saldo (ver filtro de y.units em cryptoMovementTotal) — este contador serve
     para o card avisar, em vez de deixar a divergência silenciosa. */
  function cryptoMissingUnitsCount(item) {
    if (!item) return 0;
    return yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === item.id && y.units == null).length;
  }
  function syncDerivedCryptoValue(item, priceOverride = null) {
    if (!item || !isCryptoType(item.type)) return item;
    item.units = cryptoCurrentUnits(item);
    const price = priceOverride != null && Number(priceOverride) > 0 ? Number(priceOverride) : Number(item.price || 0);
    if (price > 0) item.value = cryptoValueFromUnits(item.type, item.units, price);
    return item;
  }
  function formatCryptoUnits(type, units, assetName = '') {
    const n = Number(units) || 0;
    if (isBitcoinType(type)) return `${Math.round(n).toLocaleString('pt-BR')} SATS`;
    const label = String(assetName || '').trim().toUpperCase();
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}${label ? ` ${escapeHTML(label)}` : ''}`;
  }
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
      simplesBox.style.display = 'block';
    } else {
      simplesBox.style.display = 'block';
    }
    if (type === 'Renda Fixa') updateFixedIncomeFormCurrent();
  };

  function formatMovementPeriod(y) {
    return (y.date || '').split('-').reverse().join('/');
  }

  function movementKindLabel(kind) {
    if (kind === 'aporte') return 'Aporte';
    if (kind === 'resgate') return 'Resgate';
    return 'Rendimento';
  }

  function compactMoney(value) {
    const amount = Number(value) || 0;
    const abs = Math.abs(amount);
    if (abs >= 1000000) return `R$ ${(amount / 1000000).toFixed(1)} mi`;
    if (abs >= 1000) return `R$ ${(amount / 1000).toFixed(1)} mil`;
    return fmt(amount);
  }

  function formatQuoteUpdatedAt(value) {
    if (!value) return 'sem atualização registrada';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'atualização registrada' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function movementHistoryRows(targetType, targetId) {
    const item = (targetType === 'invest' ? investments : pockets).find(x => x.id === targetId);
    // Calcula o saldo auditável usando TODO o histórico e só depois aplica o período visualizado.
    // Assim, um lançamento de agosto continua mostrando corretamente o saldo anterior,
    // mesmo quando julho ou meses anteriores estiverem ocultos pela interface.
    const allItems = yieldsLog.filter(y => y.targetType === targetType && y.targetId === targetId)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id || '').localeCompare(String(b.id || '')));
    const isCryptoTarget = !!(item && targetType === 'invest' && isCryptoType(item.type));
    let running = isCryptoTarget ? cryptoInitialUnits(item) : (item && targetType === 'invest' ? fixedIncomeInitialValue(item) : Number(item?.initial ?? item?.value ?? 0) || 0);
    const rows = [];
    allItems.forEach(y => {
      const before = running;
      /* Movimentação cripto sem 'units' não tem variação conhecida em unidades:
         somar movementDelta(y) aqui misturaria reais no saldo auditável.
         O registro continua listado, apenas sem alterar o saldo. */
      const delta = !isCryptoTarget ? movementDelta(y) : (y.units != null ? (y.kind === 'resgate' ? -1 : 1) * Number(y.units || 0) : 0);
      running += delta;
      if (periodMatchesMovement(y)) rows.push({ y, before, delta, after: running, item, isCrypto: isCryptoTarget });
    });
    return rows;
  }
  function yieldHistoryHTML(targetType, targetId) {
    const rowsData = movementHistoryRows(targetType, targetId);
    if (rowsData.length === 0) return '';
    const rows = rowsData.slice().reverse().map(({ y, before, delta, after, item, isCrypto }) => {
      const kind = y.kind || 'rendimento';
      const positive = kind !== 'resgate';
      const sign = positive ? '+' : '−';
      const label = movementKindLabel(kind);
      let description = String(y.desc || '').trim();
      const duplicateLabel = new RegExp(`^${label}\\s*[-–—:]?\\s*`, 'i');
      description = description.replace(duplicateLabel, '');
      const hasUnits = !!(isCrypto && y.units != null);
      /* Unidade conhecida: quantidade + valor aproximado. Sem unidade (registro
         legado) só há o valor a mostrar — o saldo auditável segue em unidades. */
      const valueLabel = hasUnits
        ? `${sign}${formatCryptoUnits(item.type, Math.abs(y.units), item.name)} · ≈ ${fmtPrecise(Math.abs(y.amount || 0))}`
        : `${sign}${fmtPrecise(Math.abs(y.amount || 0))}`;
      const beforeLabel = isCrypto ? formatCryptoUnits(item.type, before, item.name) : fmtPrecise(before);
      const deltaLabel = isCrypto ? `${sign}${formatCryptoUnits(item.type, Math.abs(delta), item.name)}` : `${sign}${fmtPrecise(Math.abs(delta))}`;
      const afterLabel = isCrypto ? formatCryptoUnits(item.type, after, item.name) : fmtPrecise(after);
      return `<article class="yield-row">
        <div class="history-main">
          <div class="history-head"><strong class="history-date">${escapeHTML(formatMovementPeriod(y))}</strong><span class="history-kind ${positive ? '' : 'negative'}">${escapeHTML(label)}</span></div>
          ${description ? `<div class="history-description">${escapeHTML(description)}</div>` : ''}
          <div class="history-value ${positive ? 'positive' : 'negative'}">${valueLabel}${y.price ? `<span class="history-quote">Cotação ${fmt(y.price)}</span>` : ''}</div>
          <div class="history-audit"><span><small>Saldo anterior</small><strong>${beforeLabel}</strong></span><span><small>Alteração</small><strong>${deltaLabel}</strong></span><span><small>Saldo posterior</small><strong>${afterLabel}</strong></span></div>
        </div>
        <div class="yield-actions"><button type="button" class="action-btn beta-icon-button edit" onclick="editYield('${y.id}')" aria-label="Editar movimentação" title="Editar movimentação"></button><button type="button" class="action-btn beta-icon-button delete" onclick="deleteYield('${y.id}')" aria-label="Excluir movimentação" title="Excluir movimentação"></button></div>
      </article>`;
    }).join('');
    return `<details class="yield-history"><summary><i class="fi fi-rr-clipboard-list" aria-hidden="true"></i> Histórico auditável (${rowsData.length})</summary><div class="yield-history-list">${rows}</div></details>`;
  }

  function rentabilityHTML(targetType, targetId, currentValue) {
    const items = yieldsLog.filter(y => y.targetType === targetType && y.targetId === targetId && periodMatchesMovement(y) && (y.kind || 'rendimento') === 'rendimento');
    if (items.length === 0) return '';
    const totalYield = items.reduce((s, y) => s + y.amount, 0);
    const baseValue = currentValue - totalYield;
    const firstDate = items.map(y => y.date).sort()[0];
    const days = Math.max(1, Math.round((new Date(todayISO()) - new Date(firstDate)) / 86400000));
    const monthly = totalYield / (days / 30);
    const pct = baseValue > 0 ? (totalYield / baseValue * 100) : null;
    return `<div class="rentability-box">
      <span><i class="fi fi-rr-financial-health" aria-hidden="true"></i> Rendimento total: <strong class="${totalYield >= 0 ? 'yield-pos' : 'yield-neg'}">${fmt(totalYield)}</strong>${pct !== null ? ` (${pct.toFixed(2)}%)` : ''}</span>
      <span>Média: ${fmt(monthly)}/mês · desde ${firstDate.split('-').reverse().join('/')}</span>
    </div>`;
  }

  /* P2.6 — UI de histórico de cotações removida; priceHistory/upsertPriceHistory permanecem para cálculos */
  function priceHistoryHTML(_inv) {
    return '';
  }

  let priceChartInstances = {};

  function renderPriceCharts() {
    // P2.6: gráficos de cotação não são mais exibidos na interface de Investimentos.
    Object.keys(priceChartInstances).forEach(id => {
      try { priceChartInstances[id]?.destroy?.(); } catch (err) {}
      delete priceChartInstances[id];
    });
  }

  /* Dedupe: logInfo/logWarn gravam no Firestore, então cada render não pode
     reemitir o mesmo aviso. Limpa sozinho quando a contagem volta a zero. */
  const unitsWarningLogged = new Set();
  function renderInvestments() {
    applyCachedQuotesToInvestments();
    const container = document.getElementById('investGrid');
    const summary = document.getElementById('investBalanceStrip');
    const total = totalInvestBalance();
    summary.innerHTML = `<div class="balance-card total"><div class="balance-card-head"><span class="label">Total investido</span><span class="balance-symbol" aria-hidden="true">${financialIcon('growth')}</span></div><span class="amount">${fmt(total)}</span></div>`;
    if (investments.length === 0) {
      container.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">Nenhum ativo ou investimento cadastrado. Clique em "+ Novo Ativo / Cripto" para registrar.</div>`;
      return;
    }
    container.innerHTML = investments.map((inv, index) => {
      const displayVal = inv.type === 'Renda Fixa'
        ? fixedIncomeCurrentValue(inv)
        : (Number(inv.value) > 0 ? inv.value : cryptoValueFromUnits(inv.type, cryptoCurrentUnits(inv), inv.price || 0));
      const missingUnits = isCryptoType(inv.type) ? cryptoMissingUnitsCount(inv) : 0;
      if (missingUnits > 0) {
        if (!unitsWarningLogged.has(inv.id)) {
          unitsWarningLogged.add(inv.id);
          logWarn('Investimentos', 'Movimentações sem quantidade', 'Atenção',
            `${missingUnits} ${missingUnits === 1 ? 'movimentação' : 'movimentações'} sem quantidade não ${missingUnits === 1 ? 'entra' : 'entram'} no saldo de ${inv.name}.`,
            { investmentId: inv.id, count: missingUnits });
        }
      } else {
        unitsWarningLogged.delete(inv.id);
      }
      const typeShort = ({
        'Stablecoin':'STABLE', 'Bitcoin':'BTC', 'Cripto':'CRIPTO', 'Ações':'AÇÕES',
        'Renda Fixa':'RF', 'FII':'FII', 'ETF':'ETF', 'Tesouro':'TESOURO'
      })[inv.type] || String(inv.type || '').slice(0, 10);
      return `
      <article class="invest-box asset-card" data-item-id="${inv.id}">
        <button type="button" class="drag-handle" aria-label="Segurar para mover investimento" title="Segure para mover">
          <i class="fi fi-rr-layers" aria-hidden="true"></i>
        </button>
        <div class="asset-card-head">
          <div class="asset-card-title">
            <div class="asset-card-name-row">
              <strong class="asset-card-name">${escapeHTML(inv.alias || inv.name)}</strong>
              <span class="asset-card-tag">${escapeHTML(typeShort)}</span>
            </div>
            ${inv.alias ? `<span class="asset-card-sub">${escapeHTML(inv.name)}</span>` : ''}
          </div>
        </div>
        <div class="asset-card-value">${fmt(displayVal)}</div>
        <div class="asset-card-meta">
          ${isCryptoType(inv.type) ? `<span>Qtd: ${formatCryptoUnits(inv.type, cryptoCurrentUnits(inv), inv.name)}</span>` : ''}
          ${isCryptoType(inv.type) ? `<span>${fmt(inv.price || 0)} · ${inv.quoteSource === 'api' ? 'Auto' : 'Manual'} · ${formatQuoteUpdatedAt(inv.lastQuoteAt)}</span>` : ''}
          ${missingUnits > 0 ? `<span class="asset-card-units-warning">${missingUnits} ${missingUnits === 1 ? 'movimentação' : 'movimentações'} sem quantidade não ${missingUnits === 1 ? 'entra' : 'entram'} no saldo</span>` : ''}
          ${inv.institution ? `<span>${escapeHTML(inv.institution)}${inv.rate ? ' · ' + escapeHTML(inv.rate) : ''}</span>` : ''}
          ${investmentReferenceHTML(inv)}
          ${inv.dueDate ? `<span>Venc.: ${inv.dueDate.split('-').reverse().join('/')}</span>` : ''}
        </div>
        ${rentabilityHTML('invest', inv.id, displayVal)}
        ${yieldHistoryHTML('invest', inv.id)}
        <div class="asset-card-actions item-action-row">
          <div class="reorder-actions">
            <button type="button" class="action-btn" onclick="moveInvestment('${inv.id}',-1)" ${index===0?'disabled':''} aria-label="Mover para cima">↑</button>
            <button type="button" class="action-btn" onclick="moveInvestment('${inv.id}',1)" ${index===investments.length-1?'disabled':''} aria-label="Mover para baixo">↓</button>
          </div>
          <button type="button" class="action-btn beta-icon-button move" onclick="openInvestmentMovementModal('aporte','${inv.id}')" aria-label="Movimentações"></button>
          ${isCryptoType(inv.type) ? `<button type="button" class="action-btn reconcile-btn" onclick="openCryptoReconcileModal('${inv.id}')" aria-label="Conciliar saldo com a corretora">Conciliar</button>` : ''}
          <button type="button" class="action-btn beta-icon-button edit" onclick="editInvest('${inv.id}')" aria-label="Editar"></button>
          <button type="button" class="action-btn beta-icon-button delete" onclick="deleteInvest('${inv.id}')" aria-label="Excluir"></button>
        </div>
      </article>`;
    }).join('');
      setupDisplayCardDrag(container, 'investments');
    renderPriceCharts();
  }

  function renderPocketBalances() {
    const strip = document.getElementById('pocketBalanceStrip');
    const total = totalPocketBalance();
    let html = `<div class="balance-card total">
      <div class="balance-card-head"><span class="label">Total em Caixinhas</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-piggy-bank" aria-hidden="true"></i></span></div>
      <span class="amount">${fmt(total)}</span>
    </div>`;
    pockets.forEach(p => {
      html += `<div class="balance-card">
        <div class="balance-card-head">
          <span class="label">${escapeHTML(p.name)}</span>
          <span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-piggy-bank"></i></span>
        </div>
        <span class="amount">${fmt(pocketCurrentBalance(p))}</span>
      </div>`;
    });
    strip.innerHTML = html;
  }

  function renderPockets() {
    const container = document.getElementById('pocketGrid');
    if (pockets.length === 0) {
      container.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">Nenhuma caixinha cadastrada. Clique em "+ Nova Caixinha" para começar.</div>`;
      return;
    }
    container.innerHTML = pockets.map((p, index) => {
      const current = pocketCurrentBalance(p);
      const sourceBank = banks.find(b => b.id === p.sourceBankId);
      const goalAmount = Number(p.goalAmount) || 0;
      const goalPercent = goalAmount > 0 ? Math.min(100, Math.max(0, current / goalAmount * 100)) : null;
      const goalHTML = goalAmount > 0 ? `<div class="pocket-goal"><div class="pocket-goal-head"><span>${escapeHTML(p.goal || 'Meta da caixinha')}</span><strong>${goalPercent.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${goalPercent.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(current)} de ${fmt(goalAmount)}</div></div>` : (p.goal ? `<div class="units">${escapeHTML(p.goal)}</div>` : '');
      return `<div class="invest-box" data-item-id="${p.id}">
        <button type="button" class="drag-handle" aria-label="Segurar para mover caixinha" title="Segure para mover">
          <i class="fi fi-rr-layers" aria-hidden="true"></i>
        </button><h4><span>${escapeHTML(p.name)}</span></h4><div class="val">${fmt(current)}</div>${goalHTML}${sourceBank ? `<div class="units">Banco de origem: ${escapeHTML(sourceBank.name)}</div>` : '<div class="units">Banco de origem: A definir</div>'}${rentabilityHTML('pocket', p.id, current)}${yieldHistoryHTML('pocket', p.id)}<div class="item-action-row"><div class="reorder-actions"><button type="button" class="action-btn" onclick="movePocket('${p.id}',-1)" ${index===0?'disabled':''} aria-label="Mover caixinha para cima" title="Mover para cima">↑</button><button type="button" class="action-btn" onclick="movePocket('${p.id}',1)" ${index===pockets.length-1?'disabled':''} aria-label="Mover caixinha para baixo" title="Mover para baixo">↓</button></div><button type="button" class="action-btn beta-icon-button move" onclick="openPocketMovementModal('aporte','${p.id}')" aria-label="Movimentações da caixinha"></button><button type="button" class="action-btn beta-icon-button edit" onclick="editPocket('${p.id}')" aria-label="Editar caixinha"></button><button type="button" class="action-btn beta-icon-button delete" onclick="deletePocket('${p.id}')" aria-label="Excluir caixinha"></button></div></div>`;
    }).join('');
      setupDisplayCardDrag(container, 'pockets');
  }

  function getSelectedFilterValues(id) {
    const select = document.getElementById(id);
    return select ? Array.from(select.selectedOptions).map(option => option.value).filter(Boolean) : [];
  }

  function clearSelectedFilterValues(id) {
    const select = document.getElementById(id);
    if (select) Array.from(select.options).forEach(option => { option.selected = false; });
  }

  let activeFilterChoice = null;
  let filterChoiceSearchTerm = '';

  function filterChoiceConfig(target) {
    return target === 'bank' ? { selectId: 'filterBank', summaryId: 'filterBankSummary', title: 'Escolha os bancos', subtitle: 'Selecione um ou mais bancos para filtrar.', placeholder: 'Buscar banco ou conta', items: banks } : { selectId: 'filterCategory', summaryId: 'filterCategorySummary', title: 'Escolha as categorias', subtitle: 'Selecione uma ou mais categorias para filtrar.', placeholder: 'Buscar categoria', items: categories };
  }

  function refreshFilterChoiceSummaries() {
    const bankCount = getSelectedFilterValues('filterBank').length;
    const categoryCount = getSelectedFilterValues('filterCategory').length;
    const bankSummary = document.getElementById('filterBankSummary');
    const categorySummary = document.getElementById('filterCategorySummary');
    if (bankSummary) bankSummary.textContent = bankCount ? `${bankCount} selecionado${bankCount === 1 ? '' : 's'}` : 'Todos os bancos';
    if (categorySummary) categorySummary.textContent = categoryCount ? `${categoryCount} selecionada${categoryCount === 1 ? '' : 's'}` : 'Todas as categorias';
  }

  function renderFilterChoiceList() {
    if (!activeFilterChoice) return;
    const config = filterChoiceConfig(activeFilterChoice);
    const selected = new Set(getSelectedFilterValues(config.selectId));
    const query = filterChoiceSearchTerm.toLocaleLowerCase('pt-BR');
    const items = config.items.filter(item => !query || String(item.name || '').toLocaleLowerCase('pt-BR').includes(query));
    const list = document.getElementById('filterChoiceList');
    if (!list) return;
    list.innerHTML = items.length ? items.map(item => `<label class="filter-choice-option ${selected.has(item.id) ? 'is-selected' : ''}"><input type="checkbox" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span>${escapeHTML(item.name)}</span></label>`).join('') : '<div class="filter-choice-empty">Nenhuma opção encontrada.</div>';
    list.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
      const select = document.getElementById(config.selectId);
      const option = Array.from(select.options).find(current => current.value === input.value);
      if (option) option.selected = input.checked;
      input.closest('.filter-choice-option')?.classList.toggle('is-selected', input.checked);
      refreshFilterChoiceSummaries();
    }));
  }

  function openFilterChoice(target) {
    activeFilterChoice = target;
    filterChoiceSearchTerm = '';
    const config = filterChoiceConfig(target);
    const sheet = document.getElementById('filterChoiceSheet');
    const search = document.getElementById('filterChoiceSearch');
    if (!sheet || !search) return;

    // V19-20: submodal de filtro com fechamento determinístico.
    sheet.style.display = 'flex';
    sheet.style.visibility = 'visible';
    sheet.style.pointerEvents = 'auto';
    sheet.style.transform = '';
    document.getElementById('filterChoiceTitle').textContent = config.title;
    document.getElementById('filterChoiceSubtitle').textContent = config.subtitle;
    search.placeholder = config.placeholder;
    search.value = '';
    renderFilterChoiceList();
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.getElementById('panelFiltros')?.classList.add('sheet-open');
  }

  function closeFilterChoice() {
    activeFilterChoice = null;
    filterChoiceSearchTerm = '';

    const sheet = document.getElementById('filterChoiceSheet');

    if (sheet) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');

      // Impede que bancos/categorias permaneçam visíveis
      // sobre o modal ou outra camada da aplicação.
      sheet.style.display = 'none';
      sheet.style.visibility = 'hidden';
      sheet.style.pointerEvents = 'none';
      sheet.style.transform = 'translateY(105%)';

      const list = document.getElementById('filterChoiceList');
      if (list) list.replaceChildren();

      const search = document.getElementById('filterChoiceSearch');
      if (search) search.value = '';
    }

    document.getElementById('panelFiltros')?.classList.remove('sheet-open');
  }

  function populateFilterControls(isInitial = false) {
    const flowSel = document.getElementById('filterFlow');
    const bankSel = document.getElementById('filterBank');
    const catSel = document.getElementById('filterCategory');
    const currFlowVal = flowSel.value;
    const currBankVals = getSelectedFilterValues('filterBank');
    const currCatVals = getSelectedFilterValues('filterCategory');

    flowSel.value = currFlowVal || '';

    bankSel.innerHTML = banks.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    Array.from(bankSel.options).forEach(option => { option.selected = currBankVals.includes(option.value); });

    catSel.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    Array.from(catSel.options).forEach(option => { option.selected = currCatVals.includes(option.value); });
    refreshFilterChoiceSummaries();
  }

  function getFilteredEntries() {
    const flow = document.getElementById('filterFlow').value;
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;
    const selectedBanks = getSelectedFilterValues('filterBank');
    const selectedCategories = getSelectedFilterValues('filterCategory');
    const query = (document.getElementById('filterText')?.value || '').trim().toLocaleLowerCase('pt-BR');

    return entries.filter(e => {
      if (!periodMatchesDate(e.date)) return false;
      if (flow && e.type !== flow) return false;
      if (dateStart && e.date < dateStart) return false;
      if (dateEnd && e.date > dateEnd) return false;
      if (selectedBanks.length && !selectedBanks.includes(e.bank)) return false;
      if (selectedCategories.length && !selectedCategories.includes(e.category)) return false;
      if (query) {
        const bankName = banks.find(bank => bank.id === e.bank)?.name || '';
        const categoryName = categories.find(cat => cat.id === e.category)?.name || '';
        if (![e.desc, bankName, categoryName].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query))) return false;
      }
      return true;
    });
  }

  /* Transferências entre contas: não devem ser contadas como entradas/saídas.
     Fonte compartilhada por resumo de categorias e pelo Dashboard (dash). */
  function transferCategoryIds() {
    return new Set(categories.filter(c => normalizeTextKey(c.name) === 'transferencia').map(c => c.id));
  }
  function isTransferEntry(entry, transferCatIds) {
    const set = transferCatIds || transferCategoryIds();
    return set.has(entry.category) || normalizeTextKey(entry.desc).startsWith('transferencia para ');
  }
  function categoryTypeTotals(mode, list) {
    const transferCatIds = transferCategoryIds();
    return categories
      .map(c => ({
        cat: c,
        total: list.filter(e => e.type === mode && e.category === c.id && !isTransferEntry(e, transferCatIds)).reduce((s, e) => s + e.amount, 0)
      })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  }
  function groupCategoryRowsForChart(totals) {
    return totals.length > 7
      ? [...totals.slice(0, 6), { cat: { id: '__others__', name: 'Outras', color: '#8B9A92' }, total: totals.slice(6).reduce((sum, item) => sum + item.total, 0) }]
      : totals;
  }

  function renderCategorySummary() {
    const flowVal = document.getElementById('filterFlow').value;
    renderCategoryChartCard('categorySummary', flowVal === 'in' ? 'in' : 'out');
  }

  function destroyCatCharts() {
    ['out', 'in'].forEach(key => {
      if (catChartInstances[key]) {
        catChartInstances[key].destroy();
        catChartInstances[key] = null;
      }
    });
  }

  function renderCategoryChartCard(wrapId, mode) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const activeEntries = getFilteredEntries();
    const totals = categoryTypeTotals(mode, activeEntries);

    if (totals.length === 0) {
      destroyCatCharts();
      wrap.innerHTML = '';
      return;
    }
    const totalSpend = totals.reduce((sum, item) => sum + item.total, 0);
    const leader = totals[0];
    const chartSpend = groupCategoryRowsForChart(totals);
    const max = chartSpend[0].total;
    const isIncome = mode === 'in';
    const canvasId = isIncome ? 'catIncomePieChart' : 'catPieChart';

    const flowVal = document.getElementById('filterFlow').value;
    const ds = document.getElementById('filterDateStart').value;
    const de = document.getElementById('filterDateEnd').value;
    let subtitle = '';
    if (!isIncome) {
      if (flowVal === 'in') subtitle = '— Entradas';
      else if (flowVal === 'out') subtitle = '— Saídas';
    }
    if (ds || de) subtitle += `${subtitle ? ' · ' : '— '}${ds ? ds.split('-').reverse().join('/') : 'Início'} até ${de ? de.split('-').reverse().join('/') : 'Hoje'}`;

    destroyCatCharts();

    const title = isIncome ? 'Entradas por Categoria' : 'Gastos por Categoria';
    const leaderLabel = isIncome ? 'Maior entrada' : 'Maior gasto';
    const totalLabel = isIncome ? 'Total de entradas' : 'Total de gastos';

    wrap.innerHTML = `<div class="cat-summary">
      <h3>${title} ${subtitle}</h3>
      <p class="cat-summary-leader">${leaderLabel}: <strong>${escapeHTML(leader.cat.name)}</strong> · ${(leader.total / totalSpend * 100).toFixed(1).replace('.', ',')}%</p>
      <div class="cat-summary-content">
        <div class="chart-container">
          <canvas id="${canvasId}"></canvas>
        </div>
        <div class="cat-bars-list">
          <div class="cat-legend-head"><span>Categoria</span><span>Movimentação</span><span>%</span></div>
          ${chartSpend.map(x => `
            <div class="cat-row" style="--category-color:${categoryColor(x.cat)}">
              <span class="cat-name">${escapeHTML(x.cat.name)}</span>
              <span class="cat-bar-wrap"><div class="cat-bar" style="width:${(x.total / max * 100).toFixed(0)}%"></div></span>
              <span class="cat-amt">${fmt(x.total)}</span>
              <span class="cat-pct">${(x.total / totalSpend * 100).toFixed(1).replace('.', ',')}%</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="cat-summary-total"><span>${totalLabel}</span><strong>${fmt(totalSpend)}</strong></div>
    </div>`;

    const ctx = document.getElementById(canvasId);
    if (ctx && typeof Chart !== 'undefined') {
      const isDark = document.body.classList.contains('dark-mode');
      const textColor = getComputedStyle(document.body).getPropertyValue('--ink').trim() || (isDark ? '#E3E8E4' : '#1C2B24');
      const borderColor = getComputedStyle(document.body).getPropertyValue('--paper').trim() || (isDark ? '#121915' : '#F7F5EF');
      const isMobileLayout = window.matchMedia('(max-width: 680px)').matches;

      catChartInstances[mode] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartSpend.map(x => x.cat.name),
          datasets: [{
            data: chartSpend.map(x => x.total),
            backgroundColor: chartSpend.map(x => categoryColor(x.cat)),
            borderColor: borderColor,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: isMobileLayout ? '67%' : '62%',
          plugins: {
            legend: {
              display: !isMobileLayout,
              position: 'bottom',
              labels: {
                font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
                color: textColor,
                boxWidth: 12
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const head = ' ' + context.label + ': ';
                  if (document.body.classList.contains('balances-hidden')) return head + '••••••';
                  const val = context.raw || 0;
                  return head + 'R$ ' + val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                }
              }
            }
          }
        }
      });
    }
  }

  function renderLedger() {
    const body = document.getElementById('ledgerBody');
    const filtered = getFilteredEntries();

    document.getElementById('ledgerCount').textContent = filtered.length + ' lançamento(s)';

    if (filtered.length === 0) {
      body.innerHTML = `<div class="empty">Nenhum lançamento encontrado para os filtros selecionados.</div>`;
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      // Dentro do mesmo dia: ordem de criação, mais recente primeiro (padrão bancário).
      // IDs de lançamento começam com 'e' + timestamp, então a comparação de string já reflete a ordem cronológica.
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

        let html = '';
    sorted.forEach(e => {
      const bank = banks.find(b => b.id === e.bank);
      const cat = categories.find(c => c.id === e.category);
      const dateFmt = e.date.split('-').reverse().join('/');

      // Define as cores e sinais baseado se é entrada (in) ou saída (out)
      const tipoClasse = e.type === 'in' ? 'receita' : 'despesa';
      const sinal = e.type === 'in' ? '+' : '−';

      // Monta o novo Card usando as suas variáveis
      html += `
        <div class="card-lancamento">
          <div class="card-left">
            <div class="card-border-line"><span class="movement-category-icon">${escapeHTML(categoryIcon(cat, e.type))}</span></div>
            <div class="card-info">
              <span class="card-date">${dateFmt}</span>
              <h3 class="card-title" title="${escapeHTML(e.desc)}" onclick="this.classList.toggle('is-expanded')">${escapeHTML(e.desc)}</h3>
              <span class="card-meta"><span class="card-badge">${bank ? escapeHTML(bank.name) : 'Banco não informado'}</span><span class="card-category" style="--category-color:${categoryColor(cat)}">${cat ? escapeHTML(cat.name) : 'Sem categoria'}</span></span>
            </div>
          </div>

          <div class="card-right">
            <span class="card-amount ${tipoClasse}">${sinal} ${fmt(Math.abs(e.amount))}</span>
            <div class="card-actions">
              <button type="button" class="action-btn beta-icon-button edit" onclick="editEntry('${e.id}')" aria-label="Editar lançamento" title="Editar lançamento"></button>
              <button type="button" class="action-btn beta-icon-button delete" onclick="deleteEntry('${e.id}')" aria-label="Excluir lançamento" title="Excluir lançamento"></button>
            </div>
          </div>
        </div>
      `;
    });

    body.innerHTML = html;
  }

  function normalizeFeatureSettings(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const graceRaw = String(source.lockGraceMinutes ?? '').trim();
    const graceNum = Number(graceRaw);
    return {
      autoLaunchRecurring: source.autoLaunchRecurring === true,
      reminders: source.reminders !== false,
      pushNotifications: source.pushNotifications === true,
      autoRefreshQuotes: source.autoRefreshQuotes === true,
      quoteRefreshMinutes: Math.min(1440, Math.max(1, Number(source.quoteRefreshMinutes) || 15)),
      projectionMonths: Math.min(24, Math.max(1, Number(source.projectionMonths) || 6)),
      autoCategorization: source.autoCategorization === true,
      reminderAdvanceDays: Math.min(30, Math.max(0, Number(source.reminderAdvanceDays) || 0)),
      monthlySavingsGoal: Math.max(0, Number(source.monthlySavingsGoal) || 0),
      lockOnOpen: source.lockOnOpen !== false,
      lockGraceMinutes: graceRaw !== '' && Number.isFinite(graceNum) ? Math.min(30, Math.max(0, Math.round(graceNum))) : 5
    };
  }
  function loadFeatureSettings() {
    try { featureSettings = normalizeFeatureSettings(JSON.parse(localStorage.getItem(FEATURE_SETTINGS_KEY) || '{}')); } catch (err) { featureSettings = normalizeFeatureSettings(); }
  }
  function persistFeatureSettings() {
    try { localStorage.setItem(FEATURE_SETTINGS_KEY, JSON.stringify(featureSettings)); } catch (err) {}
  }

  // V19-20: preferências do Perfil também acompanham a conta na nuvem.
  function normalizeProfileSettings(raw = {}, base = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const local = base && typeof base === 'object' ? base : {};
    const remoteFeatures = source.featureSettings && typeof source.featureSettings === 'object'
      ? source.featureSettings
      : {};
    const localFeatures = local.featureSettings && typeof local.featureSettings === 'object'
      ? local.featureSettings
      : {};

    const merged = {
      featureSettings: normalizeFeatureSettings({ ...localFeatures, ...remoteFeatures }),
      financialCycleStartDay: Number.isFinite(Number(local.financialCycleStartDay))
        ? Math.min(28, Math.max(1, Number(local.financialCycleStartDay)))
        : 1,
      hideBalancesOnOpen: local.hideBalancesOnOpen === true
    };

    if (Object.prototype.hasOwnProperty.call(source, 'financialCycleStartDay')) {
      const remoteDay = Number(source.financialCycleStartDay);
      if (Number.isFinite(remoteDay) && remoteDay >= 1 && remoteDay <= 28) {
        merged.financialCycleStartDay = Math.min(28, Math.max(1, remoteDay));
      }
    }

    if (Object.prototype.hasOwnProperty.call(source, 'hideBalancesOnOpen')) {
      if (typeof source.hideBalancesOnOpen === 'boolean') {
        merged.hideBalancesOnOpen = source.hideBalancesOnOpen;
      }
    }

    return merged;
  }

  async function loadProfileSettingsFromCloud() {
    if (!currentUser) return;
    try {
      const snap = await docRef().get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      if (!data.profileSettings || typeof data.profileSettings !== 'object') {
        // V19-20: conta antiga ainda sem preferências de Perfil na nuvem.
        // Mantém as preferências locais para não sobrescrever configurações válidas.
        return;
      }

      const local = {
        featureSettings: normalizeFeatureSettings(featureSettings || {}),
        financialCycleStartDay: getFinancialCycleStartDay(),
        hideBalancesOnOpen: localStorage.getItem(HIDE_BALANCES_STORAGE_KEY) === '1'
      };

      const remote = normalizeProfileSettings(data.profileSettings, local);
      featureSettings = remote.featureSettings;
      persistFeatureSettings();

      localStorage.setItem(
        FINANCIAL_CYCLE_STORAGE_KEY,
        String(remote.financialCycleStartDay)
      );

      localStorage.setItem(
        HIDE_BALANCES_STORAGE_KEY,
        remote.hideBalancesOnOpen ? '1' : '0'
      );

      const cycleInput = document.getElementById('inputFinancialCycleDay');
      if (cycleInput) cycleInput.value = remote.financialCycleStartDay;

      const hideInput = document.getElementById('chkHideBalancesOnOpen');
      if (hideInput) hideInput.checked = remote.hideBalancesOnOpen;
      hideBalancesOnOpen = remote.hideBalancesOnOpen;

      if (typeof applyBalancesHiddenState === 'function') {
        applyBalancesHiddenState(remote.hideBalancesOnOpen);
      }
    } catch (err) {
      console.warn('[Perfil] Preferências remotas indisponíveis:', err);
      logWarn(
        'Perfil',
        'Carregar preferências',
        'Parcial',
        'As preferências locais continuam disponíveis neste aparelho.',
        { code: err?.code || null }
      );
    }
  }

  async function persistProfileSettings() {
    if (!currentUser) return;

    const profileSettings = {
      featureSettings: normalizeFeatureSettings(featureSettings),
      financialCycleStartDay: getFinancialCycleStartDay(),
      hideBalancesOnOpen: document.getElementById('chkHideBalancesOnOpen')?.checked === true,
      updatedAt: new Date().toISOString()
    };

    await docRef().set({ profileSettings }, { merge: true });
  }

  function sanitizePushToken(token) {
    return String(token || '').replace(/\//g, '_');
  }

  function setupPushForegroundHandler() {
    if (pushForegroundBound) return;
    if (typeof firebase === 'undefined' || !firebase.messaging || !firebase.messaging.isSupported()) return;
    pushForegroundBound = true;
    firebase.messaging().onMessage(payload => {
      const data = payload && payload.data ? payload.data : {};
      const notice = payload && payload.notification ? payload.notification : {};
      const title = notice.title || data.title || 'Livro-Caixa';
      const body = notice.body || data.body || '';
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: data.tag || undefined });
      }).catch(() => {});
    });
  }

  async function setPushNotifications(enabled) {
    const toggle = document.getElementById('featurePushNotifications');
    if (!enabled) {
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: false });
      persistFeatureSettings();
      if (toggle) toggle.checked = false;
      try {
        const savedToken = localStorage.getItem(FCM_TOKEN_KEY);
        if (savedToken && currentUser) await docRef().collection('pushTokens').doc(sanitizePushToken(savedToken)).delete();
        localStorage.removeItem(FCM_TOKEN_KEY);
      } catch (err) { logSyncError('notificações push', err); }
      persistProfileSettings().catch(err => logSyncError('preferência de notificações', err));
      return;
    }
    try {
      if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
      if (typeof firebase === 'undefined' || !firebase.messaging || !firebase.messaging.isSupported()) throw new Error('Notificações push não são suportadas neste navegador.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { if (toggle) toggle.checked = false; return; }
      const vapidKey = window.__FCM_VAPID_KEY;
      if (!vapidKey) {
        if (toggle) toggle.checked = false;
        alert('Configure a chave VAPID (Web Push) em app.js no campo window.__FCM_VAPID_KEY antes de ativar as notificações push.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const token = await firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('Não foi possível gerar o token de notificação.');
      localStorage.setItem(FCM_TOKEN_KEY, token);
      if (currentUser) {
        await docRef().collection('pushTokens').doc(sanitizePushToken(token)).set({ token, createdAt: todayISO(), updatedAt: new Date().toISOString() }, { merge: true });
      }
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: true });
      persistFeatureSettings();
      if (toggle) toggle.checked = true;
      setupPushForegroundHandler();
      await persistProfileSettings();
    } catch (err) {
      if (toggle) toggle.checked = false;
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: false });
      persistFeatureSettings();
      logSyncError('notificações push', err);
      alert('Não foi possível ativar as notificações push: ' + (err && err.message ? err.message : String(err)));
    }
  }

  /* =====================================================================
     [JS INDICADORES] BCB SGS + Tesouro Nacional — camada de exibição.

     Consome window.LivroCaixaFinancial (financial-client.js) e serve
     apenas três superfícies de leitura: seção do Dashboard, contexto da
     IA e uma linha de referência nos cards de Renda Fixa/Tesouro.

     Regras desta camada:
     - não escreve nem lê o modelo financeiro (saldos, investimentos,
       caixinhas e cartões continuam exatamente os mesmos);
     - cotação de cripto continua exclusiva do CoinGecko;
     - não envia token: /financial é rota pública do Worker.

     Persistência: snapshot no documento raiz, campo aditivo
     "financialIndicators" gravado com { merge: true } — mesmo padrão de
     profileSettings. Campo ausente ou inválido em conta antiga não
     quebra nada (sem indicadores até a próxima busca) e versões antigas
     do app simplesmente ignoram o campo.
     ===================================================================== */
  const FINANCIAL_INDICATORS_DOC_FIELD = 'financialIndicators';
  let financialIndicatorsPersistedJson = '';
  let financialIndicatorsOwnerUid = '';
  let financialIndicatorsWarnedNoClient = false;
  let financialIndicatorsLastError = '';

  function financialIndicatorsClient() {
    const client = window.LivroCaixaFinancial;
    return client && typeof client.getIndicators === 'function' ? client : null;
  }

  function financialIndicatorsState() {
    const client = financialIndicatorsClient();
    if (!client) return null;
    const snapshot = typeof client.getSnapshot === 'function' ? client.getSnapshot() : null;
    if (!snapshot || !snapshot.indicators || !Object.keys(snapshot.indicators).length) return null;
    const state = typeof client.getState === 'function' ? client.getState() : {};
    return {
      indicators: snapshot.indicators,
      fetchedAt: snapshot.fetchedAt || '',
      status: state.status || 'ready',
      errors: Array.isArray(state.lastErrors) ? state.lastErrors : []
    };
  }

  function financialIndicatorsSnapshot() {
    const info = financialIndicatorsState();
    return info ? info.indicators : null;
  }

  function formatIndicatorDate(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '';
  }

  function formatIndicatorMonth(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7).split('-').reverse().join('/') : '';
  }

  function formatIndicatorPercent(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(digits).replace('.', ',')}%`;
  }

  async function loadFinancialIndicatorsFromCloud() {
    const client = financialIndicatorsClient();
    if (!client || !currentUser) return null;
    try {
      /* Troca de conta no mesmo aparelho: o snapshot anterior é de outra
         pessoa e não pode ser reaproveitado nem persistido por engano. */
      if (financialIndicatorsOwnerUid && financialIndicatorsOwnerUid !== currentUser.uid) {
        if (typeof client.forget === 'function') client.forget();
        financialIndicatorsPersistedJson = '';
      }
      financialIndicatorsOwnerUid = currentUser.uid;

      const snap = await docRef().get();
      if (!currentUser) return null;
      const raw = snap && snap.exists ? snap.data()?.[FINANCIAL_INDICATORS_DOC_FIELD] : null;
      const restored = typeof client.restoreFromPersisted === 'function'
        ? client.restoreFromPersisted(raw)
        : null;
      if (restored) financialIndicatorsPersistedJson = JSON.stringify(restored);
      return restored;
    } catch (err) {
      /* Offline ou leitura negada: segue sem cache remoto — a busca
         abaixo recria os indicadores em memória. */
      return null;
    }
  }

  async function persistFinancialIndicators() {
    const client = financialIndicatorsClient();
    if (!client || !currentUser) return false;

    let payload = null;
    try {
      payload = typeof client.snapshotToPersist === 'function' ? client.snapshotToPersist() : null;
    } catch (err) {
      return false;
    }
    if (!payload) return false;

    const json = JSON.stringify(payload);
    if (json === financialIndicatorsPersistedJson) return true;

    try {
      await docRef().set({ [FINANCIAL_INDICATORS_DOC_FIELD]: payload }, { merge: true });
      financialIndicatorsPersistedJson = json;
      return true;
    } catch (err) {
      console.warn('[Livro-Caixa] Indicadores não persistidos:', err?.code || err?.message || err);
      return false;
    }
  }

  /* Busca pública (sem login), mas só faz sentido com a tela pronta.
     O TTL do adaptador (6 h) impede nova leva de chamadas ao reabrir. */
  async function refreshFinancialIndicators(options = {}) {
    try {
      const client = financialIndicatorsClient();
      if (!client) {
        if (!financialIndicatorsWarnedNoClient) {
          financialIndicatorsWarnedNoClient = true;
          financialIndicatorsLastError = 'script_ausente';
          console.warn('[Livro-Caixa] Adaptador de indicadores não encontrado (financial-client.js).');
          logWarn('Indicadores', 'Adaptador ausente', 'Falha', 'financial-client.js não carregou nesta sessão.');
          renderIndicatorsSection();
        }
        return null;
      }

      const before = JSON.stringify(financialIndicatorsSnapshot());
      const snapshot = await client.getIndicators({ force: options.force === true });
      financialIndicatorsLastError = '';
      if (!snapshot) {
        renderIndicatorsSection();
        return null;
      }

      if (firstLoadDone && JSON.stringify(financialIndicatorsSnapshot()) !== before) render();
      await persistFinancialIndicators();
      return snapshot;
    } catch (err) {
      /* Camada de exibição: falha aqui nunca pode derrubar a tela — mas
         fica registrada para o usuário conseguir enxergar o motivo. */
      const code = (err && err.code) || (err && err.name) || 'erro';
      financialIndicatorsLastError = String(code);
      console.warn('[Livro-Caixa] Indicadores indisponíveis:', code, (err && err.message) || '');
      logWarn('Indicadores', 'Consulta ao Worker', 'Falha', `Sem indicadores externos (${code}). Saldos locais não foram afetados.`);
      renderIndicatorsSection();
      return null;
    } finally {
      renderAiIndicatorsStatus();
    }
  }

  /* Repinta só o Dashboard (e só quando ele está na tela), para o aviso de
     indisponibilidade aparecer sem depender de outra ação do usuário. */
  function renderIndicatorsSection() {
    if (!firstLoadDone || typeof currentTab === 'undefined' || currentTab !== 'dash') return;
    try {
      render();
    } catch (err) {
      console.warn('[Livro-Caixa] Repaint do Dashboard falhou:', err?.message || err);
    }
  }

  /* Chip no cabeçalho do chat da LIA: diz quais indicadores externos estão
     faltando, para a recusa de simulação não parecer misteriosa. */
  function renderAiIndicatorsStatus() {
    const el = document.querySelector('[data-ai-indicators]');
    if (!el) return;
    try {
      const info = financialIndicatorsState();
      const ind = info && info.indicators ? info.indicators : {};
      const names = { cdi: 'CDI', selic: 'Selic', ipca: 'IPCA', tesouro: 'Tesouro' };
      const missing = ['cdi', 'selic', 'ipca', 'tesouro'].filter((key) => !ind[key]);
      if (!missing.length) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      el.textContent = `Indicadores indisponíveis: ${missing.map((key) => names[key]).join(', ')}. Simulações da LIA com essas referências podem ficar limitadas até a consulta voltar.`;
    } catch (err) { /* chip é informativo; falha aqui não pode derrubar o refresh */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !currentUser) return;
    refreshFinancialIndicators();
  });

  /* --- superfície 1: seção do Dashboard (somente leitura) --- */
  function renderDashIndicators() {
    const info = financialIndicatorsState();
    if (!info) return renderDashIndicatorsUnavailable();
    const ind = info.indicators;
    const rows = [];
    const add = (label, value, detail, icon) => rows.push(dashHealthMetric(label, value, 'neutral', detail, null, icon));

    if (ind.selic) {
      add('Selic (ao dia)', formatIndicatorPercent(ind.selic.value, 4),
        `Último valor apurado em ${formatIndicatorDate(ind.selic.date)}`, '％');
    }
    if (ind.cdi) {
      add('CDI (ao dia)', formatIndicatorPercent(ind.cdi.value, 4),
        `Último valor apurado em ${formatIndicatorDate(ind.cdi.date)}`, '％');
    }
    if (ind.ipca) {
      add('IPCA (mês)', formatIndicatorPercent(ind.ipca.value, 2),
        `Variação de ${formatIndicatorMonth(ind.ipca.date)}`, '％');
    }
    if (ind.tesouro && Array.isArray(ind.tesouro.titles)) {
      add('Tesouro Direto', `${ind.tesouro.titles.length} títulos`,
        `Taxas e preços do dia ${formatIndicatorDate(ind.tesouro.date)}`, '▤');
    }
    if (!rows.length) return '';

    const rowsHtml = rows.map(metric => `
      <div class="dash-metric">
        <div class="dash-metric-icon ${metric.tone}" aria-hidden="true">${metric.icon || ''}</div>
        <div class="dash-metric-content">
          <small>${escapeHTML(metric.label)}</small>
          <strong class="dash-metric-value ${metric.tone}">${escapeHTML(metric.value)}</strong>
          <span class="dash-metric-note">${escapeHTML(metric.detail)}</span>
        </div>
      </div>`).join('');

    const meta = info.fetchedAt
      ? `Atualizado em ${formatIndicatorDate(String(info.fetchedAt).slice(0, 10))}`
      : '';
    const missing = ['selic', 'cdi', 'ipca', 'tesouro'].filter(key => !ind[key]);
    const missingNote = missing.length
      ? `<p class="dashboard-footnote">Indicador(es) indisponível(is) no momento: ${escapeHTML(missing.join(', '))}. O app mantém o último valor conhecido.</p>`
      : '';

    return `
      <section class="dash-section dash-indicators-section" aria-label="Indicadores do mercado">
        ${dashSectionHead('07', 'Indicadores do mercado', 'Banco Central (SGS) e Tesouro Nacional — referência externa.', meta)}
        <div class="dash-metrics">${rowsHtml}</div>
        ${missingNote}
        <p class="dashboard-footnote">Fonte: BCB SGS e Tesouro Transparente, consultados pelo Worker do Livro-Caixa. Valores de referência; nenhum saldo seu é calculado a partir deles.</p>
      </section>`;
  }

  /* Sem snapshot a seção não some em silêncio: quando houve falha
     registrada, ela aparece dizendo o que travou. Nada de dado inventado. */
  function renderDashIndicatorsUnavailable() {
    const client = financialIndicatorsClient();
    const state = client && typeof client.getState === 'function' ? client.getState() : {};
    const codes = [];
    if (financialIndicatorsLastError) codes.push(financialIndicatorsLastError);
    (Array.isArray(state.lastErrors) ? state.lastErrors : []).forEach(err => {
      const code = err && err.code;
      if (code && !codes.includes(code)) codes.push(code);
    });
    if (!codes.length && state.status !== 'error') return '';

    const detail = codes.length ? ` (código: ${escapeHTML(codes.join(', '))})` : '';
    return `
      <section class="dash-section dash-indicators-section" aria-label="Indicadores do mercado">
        ${dashSectionHead('07', 'Indicadores do mercado', 'Banco Central (SGS) e Tesouro Nacional — referência externa.', 'indisponível')}
        <p class="dashboard-footnote">Os indicadores externos não puderam ser consultados agora${detail}. Nada dos seus dados foi afetado: saldos, lançamentos e cálculos continuam locais. A seção volta sozinha quando a consulta funcionar.</p>
      </section>`;
  }

  /* --- superfície 2: cards de Renda Fixa/Tesouro (só leitura) --- */
  function normalizeIndicatorKey(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function matchTesouroTitle(inv, tesouro) {
    if (!inv || !tesouro || !Array.isArray(tesouro.titles)) return null;
    const keys = [normalizeIndicatorKey(inv.alias), normalizeIndicatorKey(inv.name)]
      .filter(key => key.length >= 5);
    if (!keys.length) return null;

    /* O CSV separa "Tipo Titulo" de "Data Vencimento": o mesmo tipo
       (ex.: "Tesouro Selic") tem vários vencimentos e alguns tipos se
       contêm ("Tesouro Prefixado" e "… com Juros Semestrais"). Sem o
       vencimento do investimento o par seria ambíguo — nesse caso nada é
       exibido, em vez de apontar taxa/PU do título errado. */
    const due = typeof inv.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate)
      ? inv.dueDate
      : '';
    if (!due) return null;

    const candidates = tesouro.titles.filter(title => {
      if (!title || title.maturity !== due) return false;
      const name = normalizeIndicatorKey(title.name);
      if (!name) return false;
      return keys.some(key => name === key
        || key.startsWith(`${name} `)
        || name.startsWith(`${key} `)
        || name.includes(key));
    });

    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    /* Mesmo vencimento em duas variantes do tipo (ex.: "Tesouro Prefixado"
       e "… com Juros Semestrais" em 2027-01-01): fica o que o próprio
       investimento nomeia; empate vira "não mostra", nunca chute. */
    const wantsSemiannual = keys.some(key => key.includes('juros') || key.includes('semestrais'));
    const pool = candidates.filter(title => {
      const name = normalizeIndicatorKey(title.name);
      const semiannual = name.includes('juros') || name.includes('semestrais');
      return wantsSemiannual ? semiannual : !semiannual;
    });
    if (pool.length === 1) return pool[0];
    if (pool.length > 1) {
      const exact = pool.filter(title => keys.includes(normalizeIndicatorKey(title.name)));
      return exact.length === 1 ? exact[0] : null;
    }
    return null;
  }

  function investmentReferenceHTML(inv) {
    if (!inv || (inv.type !== 'Renda Fixa' && inv.type !== 'Tesouro')) return '';
    const ind = financialIndicatorsSnapshot();
    if (!ind) return '';

    const parts = [];
    if (ind.selic) parts.push(`Selic ${formatIndicatorPercent(ind.selic.value, 4)}`);
    if (ind.cdi) parts.push(`CDI ${formatIndicatorPercent(ind.cdi.value, 4)}`);

    const title = matchTesouroTitle(inv, ind.tesouro);
    if (title) {
      parts.push(`${title.name}: taxa ${formatIndicatorPercent(title.purchaseRate, 2)} · PU ${fmt(title.purchasePrice)}`);
    }

    if (!parts.length) return '';
    return `<span title="Referência externa (BCB/Tesouro), não altera este saldo">Ref.: ${escapeHTML(parts.join(' · '))}</span>`;
  }

  const PIN_UNLOCKED_KEY = 'livrocaixa_pin_unlocked';
  let pinUnlocked = false;
  let lastPinActivity = 0;
  function localPinKey() { return `livrocaixa-local-pin-${currentUser?.uid || 'anonymous'}`; }
  function getLocalPinRecord() { try { return JSON.parse(localStorage.getItem(localPinKey()) || 'null'); } catch (err) { return null; } }
  async function hashLocalPin(pin) { const bytes = new TextEncoder().encode(String(pin)); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
  function validLocalPin(pin) { return /^\d{4,8}$/.test(String(pin || '')); }
  async function saveLocalPin(pin) { if (!validLocalPin(pin)) throw new Error('O PIN deve ter entre 4 e 8 dígitos.'); localStorage.setItem(localPinKey(), JSON.stringify({ hash: await hashLocalPin(pin), createdAt: new Date().toISOString() })); pinUnlocked = true; markPinActivity(); }
  function removeLocalPin() { localStorage.removeItem(localPinKey()); removeBiometric(); pinUnlocked = true; hidePinOverlay(); clearPinActivity(); }
  function hasLocalPin() { const record = getLocalPinRecord(); return Boolean(record && typeof record.hash === 'string' && record.hash.length === 64); }
  function biometricKey() { return `livrocaixa-webauthn-${currentUser?.uid || 'anonymous'}`; }
  function getBiometricRecord() {
    try { return JSON.parse(localStorage.getItem(biometricKey()) || 'null'); } catch (e) { return null; }
  }
  function hasBiometric() {
    const rec = getBiometricRecord();
    return Boolean(rec && rec.credentialId);
  }
  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(b => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function base64UrlToBuffer(value) {
    const pad = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }
  function supportsWebAuthn() {
    return typeof window !== 'undefined' && window.PublicKeyCredential && typeof navigator.credentials?.create === 'function';
  }
  async function registerBiometric() {
    if (!currentUser) throw new Error('Faça login antes de ativar a biometria.');
    if (!hasLocalPin()) throw new Error('Ative um PIN local antes de vincular a biometria.');
    if (!supportsWebAuthn()) throw new Error('Este aparelho/navegador não oferece biometria via WebAuthn.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(String(currentUser.uid || 'user').slice(0, 64));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Livro-Caixa', id: location.hostname },
        user: { id: userId, name: currentUser.email || 'usuario', displayName: currentUser.displayName || 'Livro-Caixa' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (!cred) throw new Error('Registro biométrico cancelado.');
    const credentialId = bufferToBase64Url(cred.rawId);
    localStorage.setItem(biometricKey(), JSON.stringify({ credentialId, createdAt: new Date().toISOString() }));
    return true;
  }
  function removeBiometric() {
    localStorage.removeItem(biometricKey());
  }
  async function unlockWithBiometric() {
    if (!hasBiometric() || !supportsWebAuthn()) return false;
    const rec = getBiometricRecord();
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: base64UrlToBuffer(rec.credentialId) }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (!assertion) return false;
    pinUnlocked = true;
    hidePinOverlay();
    return true;
  }
  async function tryBiometricUnlockOnShow() {
    const btn = document.getElementById('btnBiometricUnlock');
    if (btn) btn.hidden = !(hasBiometric() && supportsWebAuthn());
    if (!(hasBiometric() && supportsWebAuthn())) return;
    try {
      await unlockWithBiometric();
      logInfo('Segurança', 'Desbloquear biometria', 'Sucesso', 'Aplicativo desbloqueado por biometria neste dispositivo.');
    } catch (err) {
      /* usuário cancelou ou falhou — permanece no PIN */
    }
  }

  function showPinOverlay() { if (!currentUser || !hasLocalPin() || pinUnlocked) return; const overlay = document.getElementById('pinOverlay'); overlay?.classList.remove('hidden'); overlay?.setAttribute('aria-hidden', 'false'); document.body.classList.add('is-pin-locked'); const bioBtn = document.getElementById('btnBiometricUnlock'); if (bioBtn) bioBtn.hidden = !(hasBiometric() && supportsWebAuthn()); setTimeout(() => { document.getElementById('pinUnlockInput')?.focus(); tryBiometricUnlockOnShow(); }, 0); }
  function hidePinOverlay() { markPinActivity(); const overlay = document.getElementById('pinOverlay'); overlay?.classList.add('hidden'); overlay?.setAttribute('aria-hidden', 'true'); document.body.classList.remove('is-pin-locked'); }
  async function unlockWithLocalPin(pin) { const record = getLocalPinRecord(); if (!record) { pinUnlocked = true; hidePinOverlay(); return true; } const valid = (await hashLocalPin(pin)) === record.hash; if (!valid) return false; pinUnlocked = true; hidePinOverlay(); return true; }
  function pinGraceMs() { const m = Number(featureSettings.lockGraceMinutes); return Number.isFinite(m) && m > 0 ? Math.round(m) * 60000 : 0; }
  function markPinActivity() { lastPinActivity = Date.now(); }
  function persistPinActivity() { try { if (pinUnlocked && hasLocalPin() && featureSettings.lockOnOpen !== false) sessionStorage.setItem('livrocaixa-pin-grace', String(lastPinActivity)); } catch (err) {} }
  function clearPinActivity() { lastPinActivity = 0; try { sessionStorage.removeItem('livrocaixa-pin-grace'); } catch (err) {} }
  function lockPinNow() { pinUnlocked = false; clearPinActivity(); showPinOverlay(); }
  function checkLocalPinLock() {
    if (!hasLocalPin() || featureSettings.lockOnOpen === false) { pinUnlocked = true; clearPinActivity(); return; }
    const grace = pinGraceMs();
    if (grace > 0) {
      let saved = 0;
      try { saved = Number(sessionStorage.getItem('livrocaixa-pin-grace')) || 0; } catch (err) {}
      if (saved > 0 && Date.now() - saved < grace) { pinUnlocked = true; lastPinActivity = saved; return; }
    }
    lockPinNow();
  }
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

  function budgetFor(categoryId) {
    const matches = budgets.filter(item => item.categoryId === categoryId);
    if (!matches.length) return null;
    return matches.reduce((latest, item) => (!latest || new Date(item.updatedAt || 0) > new Date(latest.updatedAt || 0)) ? item : latest, null);
  }
  function budgetSpent(categoryId, cycleKey = currentFinancialCycleKey()) {
    const { start, end } = financialCycleRangeForKey(cycleKey);
    return entries.filter(entry => entry.type === 'out' && entry.category === categoryId && entry.date >= start && entry.date <= end).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }
  let editingGoalId = null;

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

  function activeGoalForCaixinha(caixinhaId, exceptId = null) {
    return activeGoalForSource('pocket', caixinhaId, exceptId);
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
            <i class="fi fi-rr-pen" aria-hidden="true"></i>
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
  const btnCancelGoalEdit = document.getElementById('btnCancelGoalEdit');
  if (btnCancelGoalEdit) {
    btnCancelGoalEdit.onclick = function() {
      resetGoalForm();
      if (typeof closeAllPanels === 'function') closeAllPanels();
    };
  }
  function openNewGoalModal() {
    resetGoalForm();
    if (typeof openModal === 'function') openModal('panelGoalForm');
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
  } // if btnSaveGoalEl
  function pocketGoalMarkup(pocket, current) {
    const amount = Number(pocket?.goalAmount) || 0;
    if (!(amount > 0)) return pocket?.goal ? `<div class="units">${escapeHTML(pocket.goal)}</div>` : '';
    const percent = Math.min(100, Math.max(0, current / amount * 100));
    return `<div class="pocket-goal"><div class="pocket-goal-head"><span>${escapeHTML(pocket.goal || 'Meta da caixinha')}</span><strong>${percent.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${percent.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(current)} de ${fmt(amount)}</div></div>`;
  }
  function monthEndDate(month) { const [year, value] = month.split('-').map(Number); return `${month}-${String(new Date(year, value, 0).getDate()).padStart(2, '0')}`; }
  function balanceAtDate(bankId, cutoff) {
    const bank = banks.find(item => item.id === bankId);
    return Number(bank?.initial || 0) + entries.filter(entry => entry.bank === bankId && String(entry.date || '') <= cutoff).reduce((sum, entry) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0)), 0);
  }
  function pocketBalanceAtDate(pocket, cutoff) {
    const initial = Number(pocket?.initial ?? pocket?.value ?? 0) || 0;
    return initial + yieldsLog.filter(item => item.targetType === 'pocket' && item.targetId === pocket.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + (item.kind === 'resgate' ? -1 : 1) * Number(item.amount || 0), 0);
  }
  function investmentValueAtDate(inv, cutoff) {
    if (inv.type === 'Renda Fixa') return Math.max(0, fixedIncomeInitialValue(inv) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + movementDelta(item), 0));
    if (isCryptoType(inv.type)) {
      const units = cryptoInitialUnits(inv) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + (item.kind === 'resgate' ? -1 : 1) * Number(item.units || 0), 0);
      const points = Array.isArray(inv.priceHistory) ? inv.priceHistory.filter(item => String(item.date || '') <= cutoff).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))) : [];
      const price = Number(points.at(-1)?.price || inv.price || 0);
      return Math.max(0, cryptoValueFromUnits(inv.type, units, price));
    }
    return Math.max(0, Number(inv.initialValue ?? inv.value ?? 0) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + movementDelta(item), 0));
  }
  function dashboardMonthSeries(count = 6) {
    return Array.from({ length: count }, (_, index) => {
      const offset = index - count + 1;
      const month = monthKeyOffset(offset);
      const cutoff = monthEndDate(month);
      const income = entries.filter(entry => entry.type === 'in' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const expense = entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const banksAt = banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0);
      const pocketsAt = pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0);
      const investmentsAt = investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0);
      return { month, label: new Date(`${month}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), income, expense, net: income - expense, patrimony: banksAt + pocketsAt + investmentsAt };
    });
  }
  /* formatMonthLabel canônica definida acima (mês por extenso); evita sobrescrita duplicada */
  function renderAdvancedDashboard() {
    const wrap = document.getElementById('advancedDashboard');
    const mini = document.getElementById('cashflowMiniSummary');
    if (!wrap) return;

    const dashboardMonth = currentMonthYM();
    const month = dashboardMonth;
    const monthIncome = entries.filter(entry => entry.type === 'in' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const monthExpense = entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const monthNet = monthIncome - monthExpense;
    const series = dashboardMonthSeries(6);
    const current = series.at(-1) || { income: monthIncome, expense: monthExpense, net: monthNet, patrimony: totalBankBalance() + totalPocketBalance() + totalInvestBalance() };
    const avgNet = series.reduce((sum, item) => sum + item.net, 0) / Math.max(1, series.length);
    const projectionMonths = Number(featureSettings.projectionMonths || 6);
    const projected = current.patrimony + avgNet * projectionMonths;
    const savingsGoal = Number(featureSettings.monthlySavingsGoal) || 0;
    const savingsProgress = savingsGoal > 0 ? Math.max(0, Math.min(100, (monthNet / savingsGoal) * 100)) : 0;
    const savingsGoalHTML = savingsGoal > 0 ? `<div class="pocket-goal dashboard-savings-goal"><div class="pocket-goal-head"><span>Meta de economia mensal</span><strong>${savingsProgress.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${savingsProgress.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(Math.max(0, monthNet))} de ${fmt(savingsGoal)}</div></div>` : '';
    if (mini) mini.innerHTML = `<div class="cashflow-mini-head"><div><strong>Resumo do fluxo</strong><span class="hint">${formatMonthLabel(month)}</span></div><button type="button" class="cashflow-mini-link" onclick="document.getElementById('tabBtnDashboard')?.click()">Ver visão geral</button></div><div class="cashflow-mini-metrics"><div><small>Entradas</small><strong class="positive">${fmt(monthIncome)}</strong></div><div><small>Saídas</small><strong class="negative">${fmt(monthExpense)}</strong></div><div><small>Saldo do mês</small><strong class="${monthNet >= 0 ? 'positive' : 'negative'}">${fmt(monthNet)}</strong></div></div>`;
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const activeBills = recurringBills.filter(bill => bill.active !== false && billAppliesToMonth(bill, year, monthIndex));
    const pendingBills = activeBills.filter(bill => !billGeneratedForMonth(bill, month));
    const overdueBills = pendingBills.filter(bill => String(billDueDateForMonth(bill, year, monthIndex)) < todayISO());
    const upcomingBills = pendingBills.slice().sort((a, b) => billDueDateForMonth(a, year, monthIndex).localeCompare(billDueDateForMonth(b, year, monthIndex))).slice(0, 3);
    const health = monthNet < 0 ? { label: 'Atenção', detail: 'As saídas superaram as entradas neste mês.', tone: 'warning', icon: '!' } : overdueBills.length ? { label: 'Revisar compromissos', detail: `${overdueBills.length} conta(s) aguardam atenção.`, tone: 'warning', icon: '!' } : (monthIncome > 0 || monthExpense > 0) ? { label: 'Equilibrado', detail: 'Fluxo positivo e compromissos sob acompanhamento.', tone: 'positive', icon: '✓' } : { label: 'Comece seu acompanhamento', detail: 'Registre movimentações para ver sua saúde financeira.', tone: 'neutral', icon: '○' };
    const budgetCycle = currentFinancialCycleKey();
    const budgetRows = categories.map(cat => { const budget = budgetFor(cat.id); if (!budget || !(budget.amount > 0)) return ''; const spent = budgetSpent(cat.id, budgetCycle); const pct = Math.max(0, spent / budget.amount * 100); const visualPct = Math.min(100, pct); const overLabel = pct >= 100 ? ' · limite excedido' : ''; return `<div class="budget-summary-row"><div><strong>${escapeHTML(cat.name)}</strong><span>${fmt(spent)} de ${fmt(budget.amount)}${overLabel}</span></div><div class="budget-summary-track"><span class="${pct >= 100 ? 'over' : ''}" style="width:${visualPct.toFixed(2)}%" data-real-percent="${pct.toFixed(2)}"></span></div><b>${pct.toFixed(0).replace('.', ',')}%</b></div>`; }).filter(Boolean).join('');

    const incomeCats = categoryTypeTotals('in', entries.filter(entry => String(entry.date || '').startsWith(month)));
    const incomeCatSectionHTML = buildIncomeCatSectionHTML(month, incomeCats);

    (function updateNextPaymentCard(){
      const host = document.getElementById('dashboardNextPayment');
      if (!host) return;
      const today = todayISO().slice(0, 10);
      const list = (typeof pendingBills !== 'undefined' && Array.isArray(pendingBills) ? pendingBills : [])
        .filter(bill => {
          try {
            if (typeof billPaidForMonth === 'function' && billPaidForMonth(bill, month)) return false;
            if (typeof billGeneratedForMonth === 'function' && billGeneratedForMonth(bill, month)) return false;
            const st = typeof billStatus === 'function' ? billStatus(bill, month) : '';
            if (st === 'Pago — não lançado' || st === 'Lançado' || st === 'Atrasado') return false;
          } catch (e) {}
          const due = String(billDueDateForMonth(bill, year, monthIndex) || '').slice(0, 10);
          // hoje ou futuro apenas
          return due && due >= today;
        })
        .sort((a,b) => String(billDueDateForMonth(a, year, monthIndex)).localeCompare(String(billDueDateForMonth(b, year, monthIndex))));
      const next = list[0];
      if (!next) {
        host.innerHTML = '<div class="next-pay-inner empty"><span class="next-pay-kicker">Próximo pagamento</span><strong>Nenhum pagamento pendente</strong></div>';
        return;
      }
      const due = String(billDueDateForMonth(next, year, monthIndex)).slice(0, 10);
      const dueFmt = due.split('-').reverse().join('/');
      host.innerHTML = '<div class="next-pay-inner"><span class="next-pay-kicker">Próximo pagamento</span><div class="next-pay-row"><strong>' + escapeHTML(next.name || 'Conta') + '</strong><b>' + fmt(next.amount) + '</b></div><span class="hint">Vence em ' + dueFmt + '</span></div>';
    })();

    const commitments = upcomingBills.map(bill => { const dueDate = billDueDateForMonth(bill, year, monthIndex); const status = billStatus(bill, month); const tone = status === 'Atrasado' ? 'overdue' : ''; return `<div class="dashboard-commitment-row ${tone}"><div><strong>${escapeHTML(bill.name || 'Conta recorrente')}</strong><span>${status} · ${dueDate.split('-').reverse().join('/')}</span></div><b>${fmt(bill.amount)}</b></div>`; }).join('');
    const alerts = [];
    if (monthNet < 0) alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>Fluxo negativo</strong><small>As saídas superam as entradas em ${fmt(Math.abs(monthNet))}.</small></div></div>`);
    if (overdueBills.length) alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>${overdueBills.length} compromisso(s) atrasado(s)</strong><small>Confira os avisos antes de gerar lançamentos automáticos.</small></div></div>`);
    const overBudgetCount = categories.filter(cat => { const budget = budgetFor(cat.id); return budget && budget.amount > 0 && budgetSpent(cat.id, budgetCycle) > budget.amount; }).length;
    categories.forEach(cat => {
      const budget = budgetFor(cat.id);
      if (!budget || !(budget.amount > 0)) return;
      const spent = budgetSpent(cat.id, budgetCycle);
      const pct = spent / budget.amount * 100;
      const tier = pct >= 100 ? 'over' : pct >= 80 ? '80' : null;
      if (!tier) return;
      const alertKey = `${cat.id}_${budgetCycle}_${tier}`;
      if (getShownBudgetAlerts()[alertKey]) return;
      markBudgetAlertShown(alertKey);
      const msg = tier === 'over'
        ? `Você ultrapassou o limite de ${cat.name} em ${fmt(spent - budget.amount)}.`
        : `Você já utilizou ${pct.toFixed(0)}% do limite de ${cat.name}.`;
      alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>${tier === 'over' ? 'Limite ultrapassado' : 'Limite quase no fim'}</strong><small>${escapeHTML(msg)}</small></div></div>`);
    });
    const advanceDays = Number(featureSettings.reminderAdvanceDays) || 0; const advanceBills = advanceDays ? pendingBills.filter(bill => { const due = new Date(`${month}-${String(billDueDateForMonth(bill, year, monthIndex).slice(-2)).padStart(2, '0')}T23:59:59`); return due >= new Date() && (due - new Date()) / 86400000 <= advanceDays; }) : []; if (advanceBills.length) alerts.push(`<div class="dashboard-alert-row"><span>i</span><div><strong>Fatura próxima</strong><small>${advanceBills.length} conta(s) vencem nos próximos ${advanceDays} dia(s).</small></div></div>`);
    if (!alerts.length) alerts.push(`<div class="dashboard-alert-row positive"><span>✓</span><div><strong>Nenhum alerta importante</strong><small>Seu painel não encontrou pendências críticas neste momento.</small></div></div>`);

    wrap.innerHTML = `<section class="advanced-dashboard dashboard-page"><div class="dashboard-page-heading"><div><span class="eyebrow">Visão geral</span><h2>Como está seu dinheiro?</h2><p>Uma leitura simples do mês atual e dos últimos seis meses.</p></div><span class="dashboard-period">${formatMonthLabel(month)}</span></div><div class="dashboard-health-card ${health.tone}"><span class="dashboard-health-icon">${health.icon}</span><div><strong>Saúde financeira</strong><small>${health.detail}</small></div><b>${health.label}</b></div><div class="dashboard-metrics"><div><small>Entradas no mês</small><strong class="positive">${fmt(current.income)}</strong></div><div><small>Saídas no mês</small><strong class="negative">${fmt(current.expense)}</strong></div><div><small>Fluxo líquido</small><strong class="${current.net >= 0 ? 'positive' : 'negative'}">${fmt(current.net)}</strong></div><div><small>Patrimônio atual</small><strong>${fmt(current.patrimony)}</strong></div></div><div class="dashboard-projection-card"><div><small>Estimativa para os próximos ${projectionMonths} meses</small><strong>${fmt(projected)}</strong></div><p>Baseada no patrimônio atual e no fluxo líquido médio dos últimos seis meses: <b>${fmt(avgNet)}/mês</b>.</p></div>${savingsGoalHTML}<div class="dashboard-trend dashboard-flow-chart"><div class="dashboard-trend-head"><div><strong>Entradas e saídas por mês</strong><span>Compare os valores de cada período</span></div><span>últimos 6 meses</span></div><div class="dash-chart-box dashboard-monthly-flow-box" id="dashMonthlyFlowChartBox"><canvas id="dashMonthlyFlowChart" role="img" aria-label="Gráfico de entradas, saídas e patrimônio estimado dos últimos meses"></canvas></div><div class="dash-chart-fallback dashboard-monthly-flow-fallback" id="dashMonthlyFlowFallback" hidden></div><p class="dashboard-footnote">O patrimônio histórico é uma estimativa quando não existe cotação registrada para cada mês. Ele não altera seus saldos atuais.</p></div>${incomeCatSectionHTML}${budgetRows ? `<div class="dashboard-budgets"><div class="dashboard-section-heading"><strong>Orçamento do mês</strong><span>Acompanhe seus limites</span></div>${budgetRows}</div>` : '<div class="dashboard-empty-state">Defina orçamentos em Perfil → Preferências financeiras para acompanhar limites por categoria nesta visão.</div>'}<div class="dashboard-commitments"><div class="dashboard-section-heading"><strong>Próximos compromissos</strong><span>${upcomingBills.length ? `${upcomingBills.length} pendente(s)` : 'Tudo em dia'}</span></div>${commitments || '<div class="dashboard-empty-state">Nenhuma conta ou fatura encontrada para o filtro/titular selecionado neste mês.</div>'}</div><div class="dashboard-alerts"><div class="dashboard-section-heading"><strong>Avisos importantes</strong><span>Atualizado agora</span></div>${alerts.join('')}</div></section>`;
    renderDashboardMonthlyFlowChart(series);
    renderDashboardIncomeCatChart(incomeCats);
  }

  let dashboardIncomeCatChartInstance = null;

  function destroyDashboardIncomeCatChart() {
    if (!dashboardIncomeCatChartInstance) return;
    try {
      dashboardIncomeCatChartInstance.destroy();
    } catch (err) {}
    dashboardIncomeCatChartInstance = null;
  }

  function buildIncomeCatSectionHTML(month, incomeCats) {
    if (!incomeCats.length) return '';
    const total = incomeCats.reduce((sum, item) => sum + item.total, 0);
    const chartRows = groupCategoryRowsForChart(incomeCats);
    const max = chartRows[0].total;
    return `<div class="dashboard-trend dashboard-income-cats"><div class="dashboard-trend-head"><div><strong>Entradas por categoria</strong><span>Como as entradas do mês se distribuem</span></div><span>${escapeHTML(formatMonthLabel(month))}</span></div><div class="cat-summary-content"><div class="chart-container"><canvas id="dashIncomeCatChart" role="img" aria-label="Gráfico de entradas por categoria do mês"></canvas></div><div class="cat-bars-list"><div class="cat-legend-head"><span>Categoria</span><span>Movimentação</span><span>%</span></div>${chartRows.map(x => `
      <div class="cat-row" style="--category-color:${categoryColor(x.cat)}">
        <span class="cat-name">${escapeHTML(x.cat.name)}</span>
        <span class="cat-bar-wrap"><div class="cat-bar" style="width:${(x.total / max * 100).toFixed(0)}%"></div></span>
        <span class="cat-amt">${fmt(x.total)}</span>
        <span class="cat-pct">${(x.total / total * 100).toFixed(1).replace('.', ',')}%</span>
      </div>`).join('')}</div></div></div>`;
  }

  function renderDashboardIncomeCatChart(incomeCats) {
    const canvas = document.getElementById('dashIncomeCatChart');
    destroyDashboardIncomeCatChart();
    if (!canvas || !incomeCats.length || typeof Chart === 'undefined') return;
    const chartRows = groupCategoryRowsForChart(incomeCats);
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = getComputedStyle(document.body).getPropertyValue('--ink').trim() || (isDark ? '#E3E8E4' : '#1C2B24');
    const borderColor = getComputedStyle(document.body).getPropertyValue('--paper').trim() || (isDark ? '#121915' : '#F7F5EF');
    const isMobileLayout = window.matchMedia('(max-width: 680px)').matches;

    dashboardIncomeCatChartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chartRows.map(x => x.cat.name),
        datasets: [{
          data: chartRows.map(x => x.total),
          backgroundColor: chartRows.map(x => categoryColor(x.cat)),
          borderColor: borderColor,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: isMobileLayout ? '67%' : '62%',
        plugins: {
          legend: {
            display: !isMobileLayout,
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: textColor,
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const head = ' ' + context.label + ': ';
                if (document.body.classList.contains('balances-hidden')) return head + '••••••';
                const val = context.raw || 0;
                return head + 'R$ ' + val.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
              }
            }
          }
        }
      }
    });
  }

  /* Gráfico de barras "Entradas e saídas por mês" (aba Visão geral).
     Reusa dashFlowFallbackHTML quando o Chart.js não está disponível. */
  let dashboardMonthlyFlowChartInstance = null;

  function destroyDashboardMonthlyFlowChart() {
    if (!dashboardMonthlyFlowChartInstance) return;
    try {
      dashboardMonthlyFlowChartInstance.destroy();
    } catch (err) {
      /* canvas já removido do DOM */
    }
    dashboardMonthlyFlowChartInstance = null;
  }

  function renderDashboardMonthlyFlowChart(series) {
    const canvas = document.getElementById('dashMonthlyFlowChart');
    const box = document.getElementById('dashMonthlyFlowChartBox');
    const fallback = document.getElementById('dashMonthlyFlowFallback');

    destroyDashboardMonthlyFlowChart();

    if (!canvas || typeof Chart === 'undefined') {
      if (box) box.hidden = true;
      if (fallback) {
        fallback.hidden = false;
        fallback.innerHTML = dashFlowFallbackHTML(series);
      }
      return;
    }

    if (fallback) fallback.hidden = true;
    if (box) box.hidden = false;

    const styles = getComputedStyle(document.body);
    const readVar = (name, fallbackValue) => styles.getPropertyValue(name).trim() || fallbackValue;
    const ink = readVar('--ink', '#1C2B24');
    const inkSoft = readVar('--ink-soft', '#4C5A52');
    const lineColor = readVar('--line', '#D8D2C1');
    const green = readVar('--dash-flow-income', readVar('--green', '#3E9B6E'));
    const red = readVar('--dash-flow-expense', readVar('--red', '#C2553B'));
    const gold = readVar('--dash-flow-patrimony', readVar('--gold', '#B08D3E'));
    const masked = () => document.body.classList.contains('balances-hidden');
    const money = value => (masked() ? '••••••' : fmt(value));
    const tick = value => {
      if (masked()) return '';
      return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    };

    dashboardMonthlyFlowChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: series.map(item => item.label),
        datasets: [
          {
            label: 'Entradas',
            data: series.map(item => item.income),
            backgroundColor: green,
            borderRadius: 4,
            maxBarThickness: 22,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Saídas',
            data: series.map(item => item.expense),
            backgroundColor: red,
            borderRadius: 4,
            maxBarThickness: 22,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Patrimônio estimado',
            data: series.map(item => item.patrimony),
            type: 'line',
            borderColor: gold,
            backgroundColor: gold,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: inkSoft,
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: context => ` ${context.dataset.label}: ${money(context.parsed.y)}`,
              afterBody: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                const item = series[index];
                return item ? `Resultado: ${money(item.net)}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: ink, font: { size: 10, weight: '600' }, maxRotation: 0, autoSkip: true }
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: lineColor },
            ticks: { color: inkSoft, font: { size: 10 }, callback: tick }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: gold, font: { size: 10 }, callback: tick }
          }
        }
      }
    });
  }

  /* =====================================================================
     [DASHBOARD] Aba "dash" — análise financeira (aba nova, separada da
     "Visão geral"). Reaproveita as fontes de verdade já existentes:
       entradas/bancos/caixinhas/investimentos → saldo, fluxo e patrimônio
       categories/budgets + ciclo financeiro    → gastos e orçamento
       recurringBills (billAppliesToMonth…)      → compromissos pendentes
       goals (goalPlanning/goalCurrentAmount)    → metas
       LivroCaixaCardEngineV3 + Adapter (card-engine-v3-combined.js)  → faturas, limites, parcelas
       getDashboardAlerts()                      → camada determinística
     Nenhuma regra financeira é duplicada neste bloco.
     ===================================================================== */

  const DASH_FILTERS_KEY = 'livrocaixa_dashboard_filters_v1';
  const DASH_SCHEMA_VERSION = 1;
  const DASH_DAYS_PER_MONTH = 30.4375;
  const DASH_PERIODS = {
    '7d':  { label: '7 dias',  days: 7,   bucket: 'day'   },
    '30d': { label: '30 dias', days: 30,  bucket: 'chunk' },
    '6m':  { label: '6 meses', months: 6, bucket: 'month' },
    '1y':  { label: '1 ano',   months: 12, bucket: 'month' }
  };
  let dashFilters = { period: '30d', account: '', compare: true, customStart: '', customEnd: '' };
  let dashCommitmentsExpanded = false;

  function dashLoadFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(DASH_FILTERS_KEY) || 'null');
      if (saved && (DASH_PERIODS[saved.period] || saved.period === 'custom')) {
        dashFilters = {
          period: saved.period,
          account: typeof saved.account === 'string' ? saved.account : '',
          compare: saved.compare !== false,
          customStart: typeof saved.customStart === 'string' ? saved.customStart : '',
          customEnd: typeof saved.customEnd === 'string' ? saved.customEnd : ''
        };
      }
    } catch (err) {
      dashFilters = { period: '30d', account: '', compare: true, customStart: '', customEnd: '' };
    }
  }

  function dashSaveFilters() {
    try {
      localStorage.setItem(DASH_FILTERS_KEY, JSON.stringify(dashFilters));
    } catch (err) {
      /* armazenamento indisponível — filtros valem só para a sessão */
    }
  }

  dashLoadFilters();

  function dashPreset() {
    if (dashFilters.period === 'custom') {
      const start = dashParseISO(dashFilters.customStart);
      const end = dashParseISO(dashFilters.customEnd);
      if (start && end) {
        const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
        return {
          label: 'Personalizado',
          days,
          bucket: days <= 14 ? 'day' : days <= 45 ? 'chunk' : 'month',
          custom: true
        };
      }
      return DASH_PERIODS['30d'];
    }
    return DASH_PERIODS[dashFilters.period] || DASH_PERIODS['30d'];
  }

  function dashParseISO(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dashToISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dashShiftDays(iso, days) {
    const base = dashParseISO(iso);
    if (!base) return iso;
    base.setDate(base.getDate() + days);
    return dashToISO(base);
  }

  function dashShortDate(iso) {
    const parts = String(iso || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
  }

  function dashLongDate(iso) {
    const parts = String(iso || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
  }

  function dashFormatRange(range) {
    if (!range || !range.start || !range.end) return '';
    const yearStart = range.start.slice(0, 4);
    const yearEnd = range.end.slice(0, 4);
    return yearStart === yearEnd
      ? `${dashShortDate(range.start)} a ${dashShortDate(range.end)}/${yearEnd}`
      : `${dashShortDate(range.start)}/${yearStart} a ${dashShortDate(range.end)}/${yearEnd}`;
  }

  /* Período atual e período imediatamente anterior (para comparação). */
  function dashRange(previous) {
    const cfg = dashPreset();
    const today = dashParseISO(todayISO());
    if (!today) return { start: '', end: '' };

    // Período personalizado: respeita as datas escolhidas pelo usuário.
    if (cfg.custom && dashFilters.customStart && dashFilters.customEnd) {
      if (!previous) {
        return { start: dashFilters.customStart, end: dashFilters.customEnd };
      }
      const days = cfg.days || 30;
      const startD = dashParseISO(dashFilters.customStart);
      if (!startD) return { start: '', end: '' };
      const prevEnd = new Date(startD);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (days - 1));
      return { start: dashToISO(prevStart), end: dashToISO(prevEnd) };
    }

    if (cfg.days) {
      const days = cfg.days;
      const end = new Date(today);
      if (previous) end.setDate(end.getDate() - days);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      return { start: dashToISO(start), end: dashToISO(end) };
    }

    const months = cfg.months;
    const currentStart = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    if (previous) {
      // Período anterior = os N meses completos imediatamente anteriores ao
      // início do período atual (sem lacuna e alinhado às barras mensais).
      const prevStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - months, 1);
      const prevEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
      return { start: dashToISO(prevStart), end: dashToISO(prevEnd) };
    }
    return { start: dashToISO(currentStart), end: dashToISO(today) };
  }

  /* Escopo de lançamentos do período já marcado como transferência ou não. */
  function dashBuildScope(range) {
    const start = range.start;
    const end = range.end;
    const account = dashFilters.account;
    const transferIds = transferCategoryIds();
    const rows = [];

    for (const entry of entries) {
      const date = String(entry.date || '');
      if (date < start || date > end) continue;
      if (account && entry.bank !== account) continue;
      rows.push({ entry, transfer: isTransferEntry(entry, transferIds) });
    }
    return rows;
  }

  function dashFlowOf(rows) {
    let income = 0;
    let expense = 0;
    let transfers = 0;
    for (const row of rows) {
      if (row.transfer) { transfers += 1; continue; }
      const value = Number(row.entry.amount || 0);
      if (row.entry.type === 'in') income += value;
      else if (row.entry.type === 'out') expense += value;
    }
    return { income, expense, net: income - expense, transfers, count: rows.length };
  }

  /* Blocos do gráfico de fluxo: dia (7d), pedaços de 5 dias (30d), mês (6m/1y). */
  function dashBuckets(range) {
    const cfg = dashPreset();
    const out = [];
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    if (!startD || !endD || endD < startD) return out;

    if (cfg.bucket === 'month') {
      let cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
      let guard = 0;
      while (cursor <= endD && guard < 36) {
        guard += 1;
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = `${key}-01`;
        const monthEnd = monthEndDate(key);
        out.push({
          start: monthStart < range.start ? range.start : monthStart,
          end: monthEnd > range.end ? range.end : monthEnd,
          label: new Date(`${key}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          title: formatMonthLabel(key)
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      return out;
    }

    if (cfg.bucket === 'day') {
      const cursor = new Date(startD);
      let guard = 0;
      while (cursor <= endD && guard < 40) {
        guard += 1;
        const iso = dashToISO(cursor);
        out.push({ start: iso, end: iso, label: dashShortDate(iso), title: dashLongDate(iso) });
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    }

    const size = Math.max(1, Math.ceil(Number(cfg.days || 30) / 5));
    let cursor = new Date(startD);
    let guard = 0;
    while (cursor <= endD && guard < 40) {
      guard += 1;
      const chunkEnd = new Date(cursor);
      chunkEnd.setDate(chunkEnd.getDate() + size - 1);
      const effectiveEnd = chunkEnd > endD ? endD : chunkEnd;
      const chunkStartISO = dashToISO(cursor);
      const chunkEndISO = dashToISO(effectiveEnd);
      out.push({
        start: chunkStartISO,
        end: chunkEndISO,
        label: dashShortDate(chunkStartISO),
        title: `${dashLongDate(chunkStartISO)} a ${dashLongDate(chunkEndISO)}`
      });
      cursor = new Date(effectiveEnd);
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function dashPatrimonyAt(cutoff) {
    if (!cutoff) return 0;
    const banksAt = banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0);
    const pocketsAt = pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0);
    const investmentsAt = investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0);
    return banksAt + pocketsAt + investmentsAt;
  }

  function dashPatrimonyParts(cutoff) {
    return {
      banks: banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0),
      pockets: pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0),
      investments: investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0)
    };
  }

  function dashPercentDelta(current, previous) {
    if (!dashFilters.compare) return null;
    if (!Number.isFinite(previous) || Math.abs(previous) < 0.005) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
    return {
      pct: rounded,
      up: rounded >= 0,
      text: `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}%`
    };
  }

  function dashMoneyDelta(current, previous) {
    if (!dashFilters.compare) return null;
    if (!Number.isFinite(previous)) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.005) return null;
    return { pct: diff, up: diff >= 0, text: `${diff >= 0 ? '+' : ''}${fmt(diff)}` };
  }

  function dashCategoryRanking(currentRows, previousRows) {
    const current = new Map();
    const previous = new Map();
    let total = 0;

    for (const row of currentRows) {
      if (row.transfer || row.entry.type !== 'out') continue;
      const key = row.entry.category || '__none__';
      const value = Number(row.entry.amount || 0);
      current.set(key, (current.get(key) || 0) + value);
      total += value;
    }
    for (const row of previousRows) {
      if (row.transfer || row.entry.type !== 'out') continue;
      const key = row.entry.category || '__none__';
      previous.set(key, (previous.get(key) || 0) + Number(row.entry.amount || 0));
    }

    const rows = Array.from(current.entries())
      .map(([id, amount]) => {
        const category = id === '__none__' ? null : categories.find(item => item.id === id);
        const base = previous.get(id) || 0;
        let delta = null;
        if (dashFilters.compare) {
          if (base > 0) {
            const pct = ((amount - base) / base) * 100;
            delta = { up: pct >= 0, text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` };
          } else if (amount > 0) {
            delta = { up: null, text: 'novo' };
          }
        }
        return {
          id,
          name: category ? category.name : 'Sem categoria',
          color: categoryColor(category),
          amount,
          share: total > 0 ? (amount / total) * 100 : 0,
          delta
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return { rows, total };
  }

  function dashBudgetRows() {
    const cycle = currentFinancialCycleKey();
    const rows = [];
    categories.forEach(category => {
      const budget = budgetFor(category.id);
      if (!budget || !(Number(budget.amount) > 0)) return;
      const planned = Number(budget.amount) || 0;
      const spent = budgetSpent(category.id, cycle);
      rows.push({
        id: category.id,
        name: category.name,
        planned,
        spent,
        rest: planned - spent,
        pct: planned > 0 ? (spent / planned) * 100 : 0
      });
    });
    return { cycle, rows: rows.sort((a, b) => b.pct - a.pct) };
  }

  function dashCardSummary() {
    const adapter = window.LivroCaixaCardAdapter;
    if (!adapter || typeof adapter.isReady !== 'function' || !adapter.isReady()) return null;
    try {
      return adapter.summarize({
        cards,
        purchases,
        invoiceLaunches,
        referenceDate: todayISO(),
        dueDateFor: typeof invoiceDueDateForPeriod === 'function' ? invoiceDueDateForPeriod : null
      });
    } catch (err) {
      logSyncError('dashboard · resumo de cartões', err);
      return null;
    }
  }

  /* Contas recorrentes pendentes com vencimento entre hoje e o horizonte. */
  function dashUpcomingBills(horizon) {
    const today = todayISO();
    const start = dashParseISO(today);
    const end = dashParseISO(horizon);
    const rows = [];
    if (!start || !end) return rows;

    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let guard = 0;
    while (cursor <= end && guard < 6) {
      guard += 1;
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      recurringBills
        .filter(bill => billAppliesToMonth(bill, year, month))
        .forEach(bill => {
          if (billGeneratedForMonth(bill, key) || billPaidForMonth(bill, key)) return;
          const due = String(billDueDateForMonth(bill, year, month) || '').slice(0, 10);
          if (!due || due < today || due > horizon) return;
          rows.push({
            id: `bill_${bill.id}_${key}`,
            name: bill.name || 'Conta recorrente',
            amount: Number(bill.amount || 0),
            due
          });
        });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return rows.sort((a, b) => a.due.localeCompare(b.due));
  }

  /* Valor das contas recorrentes cujo vencimento cai dentro do período filtrado. */
  function dashFixedExpenses(range) {
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    if (!startD || !endD) return 0;

    const seen = new Set();
    let total = 0;
    let cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
    let guard = 0;
    while (cursor <= endD && guard < 36) {
      guard += 1;
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      recurringBills
        .filter(bill => billAppliesToMonth(bill, year, month))
        .forEach(bill => {
          const due = String(billDueDateForMonth(bill, year, month) || '').slice(0, 10);
          if (!due || due < range.start || due > range.end) return;
          const dedupeKey = `${bill.id}_${due}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          total += Number(bill.amount || 0);
        });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return total;
  }

  function dashObligations(cardSummary) {
    const today = todayISO();
    const horizon = dashShiftDays(today, 30);
    const bills = dashUpcomingBills(horizon);
    const invoices = (cardSummary && Array.isArray(cardSummary.dueDates) ? cardSummary.dueDates : [])
      .map(item => ({
        id: `card_${item.cardId}_${item.periodKey}`,
        name: `Fatura ${item.label || 'cartão'}`,
        amount: Number(item.amount || 0),
        due: String(item.dueDate || '').slice(0, 10)
      }))
      .filter(item => item.due);

    const all = bills.concat(invoices).sort((a, b) => a.due.localeCompare(b.due));
    const buckets = [
      { key: 'overdue', label: 'Vencidas', hint: 'vencidas até hoje', rows: [] },
      { key: 'today', label: 'Vencem hoje', hint: 'vencimento de hoje', rows: [] },
      { key: 'd7', label: 'Próximos 7 dias', hint: 'hoje + 7 dias', rows: [] },
      { key: 'd30', label: 'Próximos 30 dias', hint: 'hoje + 8 a 30 dias', rows: [] },
      { key: 'later', label: 'Após 30 dias', hint: 'faturas com vencimento mais distante', rows: [] }
    ];

    all.forEach(item => {
      let key = 'later';
      if (item.due < today) key = 'overdue';
      else if (item.due === today) key = 'today';
      else if (item.due <= dashShiftDays(today, 7)) key = 'd7';
      else if (item.due <= dashShiftDays(today, 30)) key = 'd30';
      buckets.find(bucket => bucket.key === key).rows.push(item);
    });

    const committedBills = bills.reduce((sum, item) => sum + item.amount, 0);
    return { buckets, committedBills, today, horizon, total: all.length };
  }

  function dashGoalRows() {
    return goals.map(goal => {
      const plan = goalPlanning(goal);
      const target = plan.target;
      const current = plan.current;
      const raw = plan.hasCurrent && target > 0 ? (current / target) * 100 : null;
      return {
        id: goal.id,
        name: goal.name || 'Meta',
        target,
        current,
        hasCurrent: plan.hasCurrent,
        raw,
        pct: raw == null ? 0 : Math.min(100, Math.max(0, raw)),
        overdue: plan.overdue,
        deadline: goal.deadline || null
      };
    });
  }

  function dashHealthMetric(label, value, tone, detail, base, icon) {
    return { label, value, tone, detail: detail || '', base: base || null, icon: icon || '' };
  }

  function dashHealthRows(range, flow, fixedExpenses, patrimony, patrimonyStart, committed) {
    const rows = [];
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    const days = startD && endD ? Math.max(1, Math.round((endD - startD) / 86400000) + 1) : 0;
    const monthlyExpense = days > 0 ? flow.expense / (days / DASH_DAYS_PER_MONTH) : 0;

    rows.push(dashHealthMetric(
      'Taxa de poupança',
      flow.income > 0 ? `${((flow.net / flow.income) * 100).toFixed(1).replace('.', ',')}%` : '—',
      flow.income > 0 && flow.net >= 0 ? 'positive' : flow.income > 0 ? 'negative' : 'neutral',
      'Resultado dividido pelas entradas do período',
      flow.income > 0 ? { label: 'resultado / entradas', value: `${fmt(flow.net)} / ${fmt(flow.income)}` } : null,
      '％'
    ));

    rows.push(dashHealthMetric(
      'Despesas fixas / entradas',
      flow.income > 0 ? `${((fixedExpenses / flow.income) * 100).toFixed(1).replace('.', ',')}%` : '—',
      flow.income > 0 && fixedExpenses / flow.income <= 0.5 ? 'positive' : flow.income > 0 ? 'negative' : 'neutral',
      'Contas recorrentes com vencimento no período',
      { label: 'despesas fixas no período', value: fmt(fixedExpenses) },
      '⟳'
    ));

    rows.push(dashHealthMetric(
      'Comprometimento financeiro',
      patrimony > 0 ? `${((committed / patrimony) * 100).toFixed(1).replace('.', ',')}%` : '—',
      patrimony > 0 && committed / patrimony <= 0.3 ? 'positive' : patrimony > 0 ? 'negative' : 'neutral',
      'Cartões mais contas dos próximos 30 dias sobre o patrimônio',
      { label: 'comprometido', value: fmt(committed) },
      '∑'
    ));

    const growth = patrimonyStart > 0 ? ((patrimony - patrimonyStart) / patrimonyStart) * 100 : null;
    rows.push(dashHealthMetric(
      'Crescimento patrimonial',
      growth == null ? '—' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1).replace('.', ',')}%`,
      growth == null ? 'neutral' : growth >= 0 ? 'positive' : 'negative',
      'Variação do patrimônio entre o início e o fim do período',
      growth == null ? null : { label: 'variação no período', value: fmt(patrimony - patrimonyStart) },
      growth != null && growth < 0 ? '↘' : '↗'
    ));

    rows.push(dashHealthMetric(
      'Reserva financeira',
      monthlyExpense > 0 ? `${(patrimony > 0 ? Math.min(999, patrimony / monthlyExpense) : 0).toFixed(1).replace('.', ',')} meses` : '—',
      monthlyExpense > 0 && patrimony / monthlyExpense >= 3 ? 'positive' : monthlyExpense > 0 ? 'negative' : 'neutral',
      'Patrimônio dividido pela média mensal de saídas do período',
      monthlyExpense > 0 ? { label: 'saída média mensal', value: fmt(monthlyExpense) } : null,
      '🛡'
    ));

    return rows;
  }

  function dashHistoryAvailable(range) {
    const start = range.start;
    if (!start) return false;
    return entries.some(entry => String(entry.date || '') <= start)
      || yieldsLog.some(item => String(item.dateEnd || item.date || '') <= start);
  }

  function buildDashboardSummary() {
    const preset = dashPreset();
    const range = dashRange(false);
    const previousRange = dashRange(true);
    const hasAccount = Boolean(dashFilters.account);
    const bank = hasAccount ? banks.find(item => item.id === dashFilters.account) : null;
    if (hasAccount && !bank) dashFilters.account = '';

    const scope = dashBuildScope(range);
    const flow = dashFlowOf(scope);
    const previousScope = dashFilters.compare ? dashBuildScope(previousRange) : [];
    const previousFlow = dashFilters.compare ? dashFlowOf(previousScope) : { income: 0, expense: 0, net: 0, transfers: 0, count: 0 };

    const buckets = dashBuckets(range);
    const bucketRows = buckets.map(bucket => {
      const slice = scope.filter(row => row.entry.date >= bucket.start && row.entry.date <= bucket.end);
      const bucketFlow = dashFlowOf(slice);
      return {
        start: bucket.start,
        end: bucket.end,
        label: bucket.label,
        title: bucket.title,
        income: bucketFlow.income,
        expense: bucketFlow.expense,
        net: bucketFlow.net,
        patrimony: dashPatrimonyAt(bucket.end)
      };
    });

    const today = todayISO();
    const patrimony = dashPatrimonyAt(today);
    const patrimonyParts = dashPatrimonyParts(today);
    const patrimonyStart = dashPatrimonyAt(range.start);
    const balanceAvailable = dashFilters.account ? bankBalance(dashFilters.account) : totalBankBalance();
    const cardSummary = dashCardSummary();
    const obligations = dashObligations(cardSummary);
    const committedCards = cardSummary ? Number(cardSummary.committed || 0) : 0;
    const committed = committedCards + obligations.committedBills;
    const fixedExpenses = dashFixedExpenses(range);
    const categoriesSummary = dashCategoryRanking(scope, previousScope);
    const budgetsSummary = dashBudgetRows();
    const historyAvailable = dashHistoryAvailable(range);

    return {
      schemaVersion: DASH_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      period: {
        key: dashFilters.period,
        label: preset.label,
        bucket: preset.bucket,
        start: range.start,
        end: range.end,
        text: dashFormatRange(range),
        previous: dashFilters.compare ? previousRange : null,
        previousText: dashFilters.compare ? dashFormatRange(previousRange) : '',
        entries: scope.length
      },
      account: {
        id: dashFilters.account,
        label: dashFilters.account && bank ? bank.name : 'Todas as contas'
      },
      compare: dashFilters.compare,
      income: flow.income,
      expense: flow.expense,
      result: flow.net,
      previous: dashFilters.compare
        ? { income: previousFlow.income, expense: previousFlow.expense, result: previousFlow.net }
        : null,
      balanceAvailable,
      patrimony: {
        current: patrimony,
        atStart: patrimonyStart,
        delta: patrimony - patrimonyStart,
        hasHistory: historyAvailable,
        parts: patrimonyParts
      },
      flow: {
        buckets: bucketRows,
        transfers: flow.transfers,
        count: flow.count
      },
      committed: {
        total: committed,
        cards: committedCards,
        bills: obligations.committedBills,
        horizon: obligations.horizon
      },
      categories: categoriesSummary,
      budgets: budgetsSummary,
      obligations,
      cards: cardSummary,
      fixedExpenses,
      goals: dashGoalRows(),
      health: dashHealthRows(range, flow, fixedExpenses, patrimony, patrimonyStart, committed),
      insights: getDashboardAlerts()
    };
  }

  window.LivroCaixaDashboard = {
    schemaVersion: DASH_SCHEMA_VERSION,
    buildSummary: buildDashboardSummary,
    refresh: renderDashboardTab
  };

  function dashDeltaHTML(delta) {
    if (!delta) return '';
    return `<span class="dash-delta ${delta.up ? 'up' : 'down'}">${escapeHTML(delta.text)}</span>`;
  }

  function dashSectionHead(index, title, subtitle, meta) {
    return `<div class="dash-section-head"><div><span class="dash-section-index">${escapeHTML(index)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(subtitle)}</p></div>${meta ? `<span class="dash-section-meta">${meta}</span>` : ''}</div>`;
  }

  function renderDashSummary(s) {
    const kpi = (label, value, cls, note, delta, isMain = false) => `
      <div class="dash-kpi ${isMain ? 'dash-kpi-main' : ''}">
        <small>${escapeHTML(label)}</small>
        <strong class="js-money ${cls || ''}">${value}</strong>
        ${delta || ''}
        ${note ? `<span class="dash-kpi-note">${note}</span>` : ''}
      </div>`;

    const incomeDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.income, s.previous.income)) : '';
    const expenseDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.expense, s.previous.expense)) : '';
    const resultDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.result, s.previous.result)) : '';
    const patrimonyDelta = dashMoneyDelta(s.patrimony.current, s.patrimony.atStart);

    return `
      <section class="dash-section" aria-labelledby="dashSec1">
        ${dashSectionHead('01', 'Resumo', `Movimentação e posição em ${s.period.text}.`, escapeHTML(s.account.label))}
        <div class="dash-kpis">
          ${kpi('Entradas', fmt(s.income), 'positive', s.previous && s.previous.income > 0 ? 'vs. ' + escapeHTML(fmt(s.previous.income)) + ' no período anterior' : '', incomeDelta, true)}
          ${kpi('Saídas', fmt(s.expense), 'negative', s.previous && s.previous.expense > 0 ? 'vs. ' + escapeHTML(fmt(s.previous.expense)) + ' no período anterior' : '', expenseDelta, true)}
          ${kpi('Resultado', fmt(s.result), s.result >= 0 ? 'positive' : 'negative', s.previous ? 'vs. ' + escapeHTML(fmt(s.previous.result)) + ' no período anterior' : '', resultDelta, true)}
          ${kpi('Saldo disponível', fmt(s.balanceAvailable), '', 'Contas bancárias' + (s.account.id ? ' do filtro' : ''), '', true)}
          ${kpi('Patrimônio', fmt(s.patrimony.current), '', 'Bancos + caixinhas + investimentos', patrimonyDelta ? `<span class="dash-delta ${patrimonyDelta.up ? 'up' : 'down'}">${escapeHTML(patrimonyDelta.text)} no período</span>` : '')}
          ${kpi('Comprometido', fmt(s.committed.total), 'negative', 'Cartões + contas dos próximos 30 dias', '')}
        </div>
        ${s.flow.transfers ? `<p class="dash-inline-note">${s.flow.transfers} transferência(s) entre contas não contam como entrada/saída.</p>` : ''}
      </section>`;
  }

  let dashFlowChartInstance = null;

  function renderDashFlow(s) {
    const rows = s.flow.buckets;
    if (!rows.length) {
      return `
        <section class="dash-section" aria-labelledby="dashSec2">
          ${dashSectionHead('02', 'Fluxo de caixa', 'Entradas, saídas e patrimônio por período.', '')}
          <div class="dashboard-empty-state">Selecione um período válido para visualizar o fluxo de caixa.</div>
        </section>`;
    }

    return `
      <section class="dash-section" aria-labelledby="dashSec2">
        ${dashSectionHead('02', 'Fluxo de caixa', 'Entradas, saídas e patrimônio por período.', `${rows.length} bloco(s)`)}
        <div class="dash-panel dash-flow-panel">
          <div class="dash-chart-box" id="dashFlowChartBox">
            <canvas id="dashFlowChart" role="img" aria-label="Gráfico de entradas, saídas e patrimônio por período"></canvas>
          </div>
          <div class="dash-chart-fallback" id="dashFlowFallback" hidden></div>
          <p class="dashboard-footnote">Barras no eixo esquerdo: entradas e saídas do período. Linha no eixo direito: patrimônio estimado. O patrimônio histórico é uma estimativa quando não existe cotação registrada para cada data; ele não altera seus saldos atuais.</p>
        </div>
      </section>`;
  }

  /* Versão em HTML do fluxo: usada apenas quando Chart.js não está disponível. */
  function dashFlowFallbackHTML(rows) {
    const maxFlow = Math.max(1, ...rows.flatMap(item => [item.income, item.expense]));
    const body = rows.map(item => {
      const incomePct = item.income > 0 ? Math.max(4, (item.income / maxFlow) * 100) : 0;
      const expensePct = item.expense > 0 ? Math.max(4, (item.expense / maxFlow) * 100) : 0;
      return `
        <div class="monthly-flow-row">
          <div class="monthly-flow-label"><strong>${escapeHTML(item.label)}</strong><span>Fluxo ${item.net >= 0 ? '+' : ''}${fmt(item.net)}</span></div>
          <div class="monthly-flow-bars">
            <div class="flow-bar-line"><span>Entradas</span><div class="flow-track"><i class="income" style="width:${Math.min(100, incomePct).toFixed(2)}%"></i></div><b class="js-money">${fmt(item.income)}</b></div>
            <div class="flow-bar-line"><span>Saídas</span><div class="flow-track"><i class="expense" style="width:${Math.min(100, expensePct).toFixed(2)}%"></i></div><b class="js-money">${fmt(item.expense)}</b></div>
          </div>
          <div class="monthly-patrimony"><small>Patrimônio estimado</small><strong class="js-money">${fmt(item.patrimony)}</strong></div>
        </div>`;
    }).join('');

    return `<div class="dashboard-explainer"><span class="legend-dot income"></span> Entradas <span class="legend-dot expense"></span> Saídas <span class="legend-dot patrimony"></span> Patrimônio estimado</div><div class="monthly-flow-chart">${body}</div>`;
  }

  function dashDestroyFlowChart() {
    if (!dashFlowChartInstance) return;
    try {
      dashFlowChartInstance.destroy();
    } catch (err) {
      /* canvas já removido do DOM */
    }
    dashFlowChartInstance = null;
  }

  function dashRenderFlowChart(s) {
    const rows = s.flow.buckets;
    if (!rows.length) return;

    const canvas = document.getElementById('dashFlowChart');
    const box = document.getElementById('dashFlowChartBox');
    const fallback = document.getElementById('dashFlowFallback');

    if (!canvas || typeof Chart === 'undefined') {
      if (box) box.hidden = true;
      if (fallback) {
        fallback.hidden = false;
        fallback.innerHTML = dashFlowFallbackHTML(rows);
      }
      return;
    }

    if (fallback) fallback.hidden = true;
    if (box) box.hidden = false;

    const styles = getComputedStyle(document.body);
    const readVar = (name, fallbackValue) => styles.getPropertyValue(name).trim() || fallbackValue;
    const ink = readVar('--ink', '#1C2B24');
    const inkSoft = readVar('--ink-soft', '#4C5A52');
    const lineColor = readVar('--line', '#D8D2C1');
    const green = readVar('--dash-flow-income', readVar('--green', '#3E9B6E'));
    const red = readVar('--dash-flow-expense', readVar('--red', '#C2553B'));
    const gold = readVar('--dash-flow-patrimony', readVar('--gold', '#B08D3E'));
    const masked = () => document.body.classList.contains('balances-hidden');
    const money = value => (masked() ? '••••••' : fmt(value));
    const tick = value => {
      if (masked()) return '';
      return 'R$ ' + Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    };

    dashFlowChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(item => item.label),
        datasets: [
          {
            label: 'Entradas',
            data: rows.map(item => item.income),
            backgroundColor: green,
            borderRadius: 4,
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Saídas',
            data: rows.map(item => item.expense),
            backgroundColor: red,
            borderRadius: 4,
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Patrimônio estimado',
            data: rows.map(item => item.patrimony),
            type: 'line',
            borderColor: gold,
            backgroundColor: gold,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: rows.length > 31 ? 0 : 2,
            pointHoverRadius: 4,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: inkSoft,
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              title: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                return rows[index] ? rows[index].title : '';
              },
              label: context => ` ${context.dataset.label}: ${money(context.parsed.y)}`,
              afterBody: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                const row = rows[index];
                return row ? `Resultado: ${money(row.net)}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: ink, font: { size: 10, weight: '600' }, maxRotation: 0, autoSkip: true }
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: lineColor },
            ticks: { color: inkSoft, font: { size: 10 }, callback: tick }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: gold, font: { size: 10 }, callback: tick }
          }
        }
      }
    });
  }

  function renderDashSpending(s) {
    const categoriesHTML = s.categories.rows.length
      ? s.categories.rows.map(row => `
        <div class="dash-cat-row">
          <span class="dash-cat-dot" style="background:${escapeHTML(row.color)}" aria-hidden="true"></span>
          <div class="dash-cat-copy">
            <strong>${escapeHTML(row.name)}</strong>
            <span>${row.share.toFixed(1).replace('.', ',')}% do total do período</span>
          </div>
          <div class="dash-cat-value">
            <b class="js-money">${fmt(row.amount)}</b>
            ${row.delta ? `<span class="dash-delta ${row.delta.up == null ? 'muted' : row.delta.up ? 'up' : 'down'}">${escapeHTML(row.delta.text)}</span>` : ''}
          </div>
        </div>`).join('')
      : `<div class="dashboard-empty-state">Nenhuma saída registrada${s.account.id ? ' para a conta selecionada' : ''} neste período.</div>`;

    const budgetsHTML = s.budgets.rows.length
      ? s.budgets.rows.map(row => {
        const over = row.pct >= 100;
        let statusLabel = '';
        let statusClass = '';
        if (row.pct >= 100) { statusLabel = 'Excedido'; statusClass = 'excedido'; }
        else if (row.pct >= 80) { statusLabel = 'Atenção'; statusClass = 'atencao'; }
        else { statusLabel = 'Normal'; statusClass = 'normal'; }
        return `
        <div class="budget-summary-row">
          <div><strong>${escapeHTML(row.name)}</strong><span class="js-money">${fmt(row.spent)} de ${fmt(row.planned)}</span></div>
          <div class="budget-summary-track"><span class="${over ? 'over' : ''}" style="width:${Math.min(100, Math.max(0, row.pct)).toFixed(2)}%"></span></div>
          <b>${row.pct.toFixed(0).replace('.', ',')}%</b>
          <span class="budget-status ${statusClass}">${statusLabel}</span>
        </div>`;
      }).join('')
      : `<div class="dashboard-empty-state">Nenhum orçamento ativo no ciclo atual. Defina limites em Perfil → Preferências financeiras.</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec3">
        ${dashSectionHead('03', 'Gastos e orçamento', 'Para onde o dinheiro saiu e o que já está planejado.', `Ciclo ${escapeHTML(s.budgets.cycle)}`)}
        <div class="dash-two-col">
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Categorias</strong><span class="js-money">${fmt(s.categories.total)}</span></div>
            ${categoriesHTML}
          </div>
          <div class="dash-panel dash-budgets">
            <div class="dash-panel-head"><strong>Orçamento do ciclo</strong><span>não segue o filtro de período</span></div>
            ${budgetsHTML}
          </div>
        </div>
      </section>`;
  }

  function renderDashCommitments(s) {
    const cards = s.cards;
    const perCard = cards && cards.count > 1
      ? `<div class="dash-card-list">${cards.cards.map(row => `
          <div class="dash-card-line">
            <div><strong>${escapeHTML(row.name)}</strong><span>referência ${escapeHTML(row.referencePeriod || '—')}</span></div>
            <b class="js-money">${fmt(row.committed)}</b>
          </div>`).join('')}</div>`
      : '';

    const cardsPanel = cards && cards.ready
      ? `
        <div class="dash-panel">
          <div class="dash-panel-head"><strong>Cartões</strong><span>${cards.count} ativo(s)</span></div>
          ${cards.count ? `
            <div class="dash-card-line"><div><strong>Fatura atual</strong><span>de ${escapeHTML(fmt(cards.currentInvoiceTotal))}</span></div><b class="js-money">${fmt(cards.currentInvoiceRemaining)}</b></div>
            ${cards.previousInvoiceRemaining > 0 ? `<div class="dash-card-line"><div><strong>Fatura anterior pendente</strong><span>vencimento já ocorrido ou próximo</span></div><b class="js-money">${fmt(cards.previousInvoiceRemaining)}</b></div>` : ''}
            <div class="dash-card-line"><div><strong>Próxima fatura</strong><span>de ${escapeHTML(fmt(cards.nextInvoiceTotal))}</span></div><b class="js-money">${fmt(cards.nextInvoiceRemaining)}</b></div>
            <div class="dash-card-line"><div><strong>Limite utilizado</strong><span>de ${escapeHTML(fmt(cards.totalLimit))}</span></div><b class="js-money">${fmt(cards.totalUsed)}</b></div>
            <div class="dash-card-line"><div><strong>Parcelas futuras</strong><span>fora da fatura atual</span></div><b class="js-money">${fmt(cards.futureInstallmentsRemaining)}</b></div>
            <div class="dash-card-line"><div><strong>Comprometido (motor)</strong><span>fonte: card-engine-v3</span></div><b class="js-money">${fmt(cards.committed)}</b></div>
            ${perCard}
          ` : '<div class="dashboard-empty-state">Nenhum cartão ativo cadastrado.</div>'}
        </div>`
      : `<div class="dash-panel"><div class="dash-panel-head"><strong>Cartões</strong><span>indisponível</span></div><div class="dashboard-empty-state">Motor de cartões não carregado neste momento.</div></div>`;

    const visibleBuckets = s.obligations.buckets
      .filter(bucket => bucket.key !== 'later')
      .filter(bucket => bucket.rows.length);
    const visibleTotal = visibleBuckets.reduce((sum, bucket) => sum + bucket.rows.length, 0);

    const allBucketRows = visibleBuckets
      .map(bucket => `
        <div class="dash-bucket">
          <div class="dash-bucket-head"><strong>${escapeHTML(bucket.label)}</strong><span class="dash-bucket-count">${bucket.rows.length}</span></div>
          ${bucket.rows.map(item => `
            <div class="dash-bucket-row ${bucket.key === 'overdue' ? 'overdue' : ''}">
              <div><strong>${escapeHTML(item.name)}</strong><span>${dashLongDate(item.due)}</span></div>
              <b class="js-money">${fmt(item.amount)}</b>
            </div>`).join('')}
        </div>`).join('')
      || '';

    const summaryRows = visibleBuckets
      .map(bucket => `
        <div class="dash-bucket-summary">
          <span>${escapeHTML(bucket.label)}</span>
          <span class="dash-bucket-count">${bucket.rows.length}</span>
          <b class="js-money">${fmt(bucket.rows.reduce((sum, r) => sum + r.amount, 0))}</b>
        </div>`).join('')
      || `<div class="dashboard-empty-state">Nenhuma conta ou fatura pendente nos próximos 30 dias.</div>`;

    const commitmentsContent = dashCommitmentsExpanded
      ? `<div class="dash-buckets-expanded">${allBucketRows}</div>`
      : `<div class="dash-buckets-summary">${summaryRows}</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec4">
        ${dashSectionHead('04', 'Compromissos', `Vencimentos a partir de hoje (${dashLongDate(s.obligations.today)}).`, visibleTotal ? `${visibleTotal} compromisso(s)` : 'tudo em dia')}
        <div class="dash-two-col">
          ${cardsPanel}
          <div class="dash-panel">
            <div class="dash-panel-head">
              <strong>Contas e faturas por vencimento</strong>
              <span class="js-money">${fmt(s.committed.total)} comprometido</span>
            </div>
            <button type="button" class="dash-expand-btn" onclick="toggleDashCommitments()" aria-expanded="${dashCommitmentsExpanded}" aria-controls="dashCommitmentsContent">
              <i class="fi fi-rr-angle-${dashCommitmentsExpanded ? 'up' : 'down'}-small" aria-hidden="true"></i>
              <span>${dashCommitmentsExpanded ? 'Recolher' : 'Expandir'}</span>
            </button>
            <div id="dashCommitmentsContent" class="dash-commitments-content">
              ${commitmentsContent}
            </div>
          </div>
        </div>
      </section>`;
  }

  window.toggleDashCommitments = function() {
    dashCommitmentsExpanded = !dashCommitmentsExpanded;
    renderDashboardTab();
  }

  function renderDashPatrimony(s) {
    const parts = s.patrimony.parts;
    const totalParts = parts.banks + parts.pockets + parts.investments;
    const partRow = (label, value, share, color) => `
      <div class="dash-part-row">
        <div class="dash-part-copy"><strong>${escapeHTML(label)}</strong><span>${share.toFixed(1).replace('.', ',')}% do patrimônio</span></div>
        <div class="dash-part-mini-bar" style="--share:${Math.min(100, Math.max(0, share)).toFixed(2)}%;--bar-color:${color}"></div>
        <div class="dash-part-value js-money">${fmt(value)}</div>
      </div>`;

    const share = value => (totalParts > 0 ? (value / totalParts) * 100 : 0);

    const goalsHTML = s.goals.length
      ? s.goals.map(goal => `
        <div class="dash-goal-row">
          <div class="dash-goal-info">
            <strong>${escapeHTML(goal.name)}${goal.deadline ? ' · até ' + dashLongDate(goal.deadline) : ''}</strong>
            <span>${goal.hasCurrent ? fmt(goal.current) : '—'} de ${fmt(goal.target)}</span>
          </div>
          <div class="dash-goal-progress">
            <div class="dash-goal-bar" style="--pct:${goal.pct.toFixed(2)}%;--bar-color:${goal.pct >= 100 ? 'var(--green)' : 'var(--accent)'}"></div>
            <span class="dash-goal-pct">${goal.hasCurrent ? goal.pct.toFixed(0).replace('.', ',') + '%' : 'sem origem'}</span>
          </div>
        </div>`).join('')
      : `<div class="dashboard-empty-state">Nenhuma meta cadastrada. Crie metas na aba Metas para acompanhar o progresso aqui.</div>`;

    const evolution = s.patrimony.hasHistory
      ? `
        <div class="dash-evolution-grid">
          <div class="dash-evo-item">
            <small>No início do período</small>
            <strong class="js-money">${fmt(s.patrimony.atStart)}</strong>
          </div>
          <div class="dash-evo-item">
            <small>Hoje</small>
            <strong class="js-money">${fmt(s.patrimony.current)}</strong>
          </div>
          <div class="dash-evo-item dash-evo-delta ${s.patrimony.delta >= 0 ? 'positive' : 'negative'}">
            <small>Variação</small>
            <strong class="js-money ${s.patrimony.delta >= 0 ? 'positive' : 'negative'}">${fmt(s.patrimony.delta)}</strong>
          </div>
        </div>`
      : `<div class="dashboard-empty-state">Histórico insuficiente para comparar a evolução do patrimônio neste período. Registre movimentações anteriores a ${dashLongDate(s.period.start)}.</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec5">
        ${dashSectionHead('05', 'Patrimônio e metas', 'Composição do patrimônio, evolução e progresso das metas.', '')}
        <div class="dash-two-col">
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Composição atual</strong><span class="js-money">${fmt(totalParts)}</span></div>
            ${partRow('Bancos', parts.banks, share(parts.banks), '#3E9B6E')}
            ${partRow('Caixinhas', parts.pockets, share(parts.pockets), '#B08D3E')}
            ${partRow('Investimentos', parts.investments, share(parts.investments), '#327957')}
            ${evolution}
          </div>
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Metas</strong><span>${s.goals.length} cadastrada(s)</span></div>
            ${goalsHTML}
          </div>
        </div>
      </section>`;
  }

  function renderDashHealth(s) {
    const rows = s.health.map(metric => `
      <div class="dash-metric">
        <div class="dash-metric-icon ${metric.tone}" aria-hidden="true">${metric.icon || ''}</div>
        <div class="dash-metric-content">
          <small>${escapeHTML(metric.label)}</small>
          <strong class="dash-metric-value ${metric.tone}">${escapeHTML(metric.value)}</strong>
          <span class="dash-metric-note">${escapeHTML(metric.detail)}</span>
          ${metric.base ? `<span class="dash-metric-base js-money">${escapeHTML(metric.base.value)}</span>` : ''}
        </div>
      </div>`).join('');

    return `
      <section class="dash-section dash-health-section" aria-labelledby="dashSec6">
        ${dashSectionHead('06', 'Saúde financeira', 'Indicadores-chave da sua situação financeira.', s.period.text)}
        <div class="dash-metrics">${rows}</div>
        <p class="dashboard-footnote">Poupança = resultado ÷ entradas · Despesas fixas = contas recorrentes com vencimento no período ÷ entradas · Comprometido = cartões + contas dos próximos 30 dias ÷ patrimônio · Reserva = patrimônio ÷ saída média mensal.</p>
      </section>`;
  }

  function dashSyncPeriodPill() {
    const bar = document.getElementById('dashFilterBar');
    if (!bar) return;
    const pill = bar.querySelector('.dash-segmented-pill');
    if (!pill) return;
    const buttons = Array.from(bar.querySelectorAll('[data-dash-period]'));
    const activeIndex = buttons.findIndex(button => button.dataset.dashPeriod === dashFilters.period);
    pill.style.setProperty('--dash-pill-i', String(Math.max(0, activeIndex)));
  }

  function dashSyncFilterUI(s) {
    const bar = document.getElementById('dashFilterBar');
    if (bar) {
      bar.querySelectorAll('[data-dash-period]').forEach(button => {
        const active = button.dataset.dashPeriod === dashFilters.period;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      dashSyncPeriodPill();
    }

    const select = document.getElementById('dashAccountFilter');
    if (select) {
      const desired = dashFilters.account;
      const options = [`<option value="">Todas as contas</option>`]
        .concat(banks.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`))
        .join('');
      if (select.innerHTML !== options) select.innerHTML = options;
      select.value = desired;
      if (select.value !== desired) {
        dashFilters.account = '';
        select.value = '';
      }
    }

    const compare = document.getElementById('dashCompare');
    if (compare) compare.checked = dashFilters.compare;

    const label = document.getElementById('dashRangeLabel');
    if (label) {
      label.textContent = s.period.text + (s.compare && s.period.previousText ? ` · comparação ${s.period.previousText}` : '');
    }
  }

  function renderDashboardTab() {
    if (currentTab !== 'dash') return;
    const host = document.getElementById('dashContent');
    if (!host) return;

    dashDestroyFlowChart();
    const summary = buildDashboardSummary();
    dashSyncFilterUI(summary);
    host.innerHTML =
      renderDashSummary(summary) +
      renderDashFlow(summary) +
      renderDashSpending(summary) +
      renderDashCommitments(summary) +
      renderDashPatrimony(summary) +
      renderDashHealth(summary) +
      renderDashIndicators();
    dashRenderFlowChart(summary);
  }

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

  function renderFeatureProfile() {
    const autoBills = document.getElementById('featureAutoBills'); if (autoBills) autoBills.checked = featureSettings.autoLaunchRecurring;
    const reminders = document.getElementById('featureReminders'); if (reminders) reminders.checked = featureSettings.reminders;
    const push = document.getElementById('featurePushNotifications'); if (push) push.checked = featureSettings.pushNotifications;
    const lockOnOpen = document.getElementById('chkLockOnOpen'); if (lockOnOpen) lockOnOpen.checked = featureSettings.lockOnOpen;
    const lockGrace = document.getElementById('featureLockGrace'); if (lockGrace) lockGrace.value = featureSettings.lockGraceMinutes;
    const autoQuotes = document.getElementById('featureAutoQuotes'); if (autoQuotes) autoQuotes.checked = featureSettings.autoRefreshQuotes;
    const interval = document.getElementById('featureQuoteInterval'); if (interval) interval.value = featureSettings.quoteRefreshMinutes;
    const projection = document.getElementById('featureProjectionMonths'); if (projection) projection.value = featureSettings.projectionMonths;
    const autoCat = document.getElementById('featureAutoCategorization'); if (autoCat) autoCat.checked = featureSettings.autoCategorization;
    const advance = document.getElementById('featureReminderAdvanceDays'); if (advance) advance.value = featureSettings.reminderAdvanceDays;
    const savings = document.getElementById('featureSavingsGoalAmount'); if (savings) setMoneyInput('featureSavingsGoalAmount', featureSettings.monthlySavingsGoal);
    const whatIf = document.getElementById('featureWhatIfExpense'); if (whatIf) setMoneyInput('featureWhatIfExpense', 0);
    const ciInitial = document.getElementById('ciInitial'); if (ciInitial && !ciInitial.value) setMoneyInput('ciInitial', 1000);
    const ciMonthly = document.getElementById('ciMonthly'); if (ciMonthly && !ciMonthly.value) setMoneyInput('ciMonthly', 100);
    const ciRate = document.getElementById('ciRate'); if (ciRate && !ciRate.value) ciRate.value = '0,8';
    const ciMonths = document.getElementById('ciMonths'); if (ciMonths && !ciMonths.value) ciMonths.value = '24';
    const ciBenchmarkRate = document.getElementById('ciBenchmarkRate'); if (ciBenchmarkRate && !ciBenchmarkRate.value) ciBenchmarkRate.value = compoundRateInputValue(compoundBenchmarkRatePct('cdi'));
    const pinInput = document.getElementById('featurePin'); if (pinInput) pinInput.value = '';
    window.renderAiQuotaStatus?.();
    window.LivroCaixaAI?.refreshQuota?.();
    const bank = document.getElementById('reconcileBank'); if (bank) { const current = bank.value; bank.innerHTML = banks.map(item => `<option value="${item.id}">${escapeHTML(item.name)}</option>`).join(''); if (banks.some(item => item.id === current)) bank.value = current; }
    const month = currentMonthYM(); const budgetCycle = currentFinancialCycleKey(); const rows = document.getElementById('featureBudgetRows');
    if (rows) rows.innerHTML = categories.map(cat => { const budget = budgetFor(cat.id); const spent = budgetSpent(cat.id, budgetCycle); const pct = budget && budget.amount > 0 ? (spent / budget.amount * 100) : 0; let statusLabel = ''; let statusClass = ''; if (budget && budget.amount > 0) { if (pct >= 100) { statusLabel = 'Excedido'; statusClass = 'excedido'; } else if (pct >= 80) { statusLabel = 'Atenção'; statusClass = 'atencao'; } else { statusLabel = 'Normal'; statusClass = 'normal'; } } return `<div class="feature-budget-row"><label for="budget-${escapeHTML(cat.id)}">${escapeHTML(cat.name)}</label><input type="text" data-budget-category="${escapeHTML(cat.id)}" id="budget-${escapeHTML(cat.id)}" data-money="true" placeholder="Sem limite" value="${budget ? MONEY_FORMATTER.format(Number(budget.amount) || 0) : ''}"><span>${fmt(spent)} gastos${budget && budget.amount>0 ? ` (${pct.toFixed(0)}%)` : ''}</span>${statusLabel ? `<span class="budget-status ${statusClass}">${statusLabel}</span>` : ''}</div>`; }).join('');
    initMoneyMasks();
    renderReconciliationHistory();
  }
  function openFeatureProfile() { renderFeatureProfile(); openModal('panelFeatureProfile'); }

  function openGoalsPanel() {
  if (typeof renderGoalsList === 'function') {
    renderGoalsList();
  }

  if (typeof initMoneyMasks === 'function') {
    initMoneyMasks();
  }

  const goalsView = document.getElementById('viewGoals');

  if (goalsView && typeof window.switchTab === 'function') {
    const overlay = document.getElementById('modalOverlay');

    if (overlay) {
      overlay.classList.remove('open');
    }

    document.querySelectorAll('.panel.open').forEach(function(panel) {
      panel.classList.remove('open');
    });

    window.switchTab('goals');
    return;
  }
}

  async function saveFeatureSettings({ silent = false } = {}) {
    const statusEl = document.getElementById('profileSettingsStatus');
    featureSettings = normalizeFeatureSettings({ autoLaunchRecurring: document.getElementById('featureAutoBills')?.checked, reminders: document.getElementById('featureReminders')?.checked, pushNotifications: document.getElementById('featurePushNotifications')?.checked ?? featureSettings.pushNotifications, lockOnOpen: document.getElementById('chkLockOnOpen')?.checked ?? featureSettings.lockOnOpen, lockGraceMinutes: document.getElementById('featureLockGrace')?.value ?? featureSettings.lockGraceMinutes, autoRefreshQuotes: document.getElementById('featureAutoQuotes')?.checked, quoteRefreshMinutes: document.getElementById('featureQuoteInterval')?.value, projectionMonths: document.getElementById('featureProjectionMonths')?.value, autoCategorization: document.getElementById('featureAutoCategorization') ? document.getElementById('featureAutoCategorization').checked : featureSettings.autoCategorization, reminderAdvanceDays: document.getElementById('featureReminderAdvanceDays')?.value, monthlySavingsGoal: document.getElementById('featureSavingsGoalAmount')
        ? readMoneyInput(document.getElementById('featureSavingsGoalAmount'))
        : featureSettings.monthlySavingsGoal });
    budgets = budgets.filter(item => !document.getElementById(`budget-${item.categoryId}`));
    document.querySelectorAll('[data-budget-category]').forEach(input => { const amount = readMoneyInput(input); const categoryId = input.dataset.budgetCategory; if (amount > 0) budgets.push({ id: `bud_${categoryId}`, categoryId, month: currentMonthYM(), amount, updatedAt: new Date().toISOString() }); });
    persistFeatureSettings();
    if (!silent && statusEl) statusEl.textContent = 'Salvando…';
    try {
      await persistAll();
      await persistProfileSettings();
      if (!silent && statusEl) {
        statusEl.textContent = 'Salvo ✓';
        setTimeout(() => { if (statusEl.textContent === 'Salvo ✓') statusEl.textContent = ''; }, 3000);
        logInfo('Recursos de teste', 'Salvar configurações', 'Sucesso', 'Configurações, preferências e orçamentos atualizados.');
      } else if (silent && statusEl) {
        statusEl.textContent = 'Salvo ✓';
        setTimeout(() => { if (statusEl.textContent === 'Salvo ✓') statusEl.textContent = ''; }, 2000);
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = silent ? 'Erro ao sincronizar (salvo localmente)' : 'Erro ao sincronizar (salvo localmente)';
      logSyncError('configurações de teste', err);
    }
    startFeatureAutomation(); render();
  }

  let featureSettingsAutosaveTimer = 0;
  let isSaving = false;
  function scheduleFeatureSettingsAutosave() {
    if (isSaving) return;
    clearTimeout(featureSettingsAutosaveTimer);
    featureSettingsAutosaveTimer = setTimeout(async () => {
      isSaving = true;
      await saveFeatureSettings({ silent: true });
      isSaving = false;
    }, 700);
  }
  const FEATURE_AUTOSAVE_IDS = [
    'featureAutoBills', 'featureReminders', 'featureAutoQuotes', 'featureQuoteInterval',
    'featureProjectionMonths', 'featureAutoCategorization', 'featureReminderAdvanceDays',
    'featureSavingsGoalAmount', 'chkLockOnOpen', 'featureLockGrace'
  ];
  FEATURE_AUTOSAVE_IDS.forEach(id => document.getElementById(id)?.addEventListener('change', scheduleFeatureSettingsAutosave));
  document.getElementById('featureBudgetRows')?.addEventListener('change', scheduleFeatureSettingsAutosave);
  document.getElementById('featureBudgetRows')?.addEventListener('input', scheduleFeatureSettingsAutosave);
  function suggestCategoryForDescription(description) { const text = String(description || '').toLocaleLowerCase('pt-BR'); const scores = new Map(); entries.forEach(entry => { const entryText = String(entry.desc || '').toLocaleLowerCase('pt-BR'); const category = categories.find(item => item.id === entry.category); if (!category || !entryText) return; const tokens = text.split(/\s+/).filter(token => token.length >= 4); const matches = tokens.filter(token => entryText.includes(token)).length; if (matches) scores.set(category.id, (scores.get(category.id) || 0) + matches); }); const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]; return best ? best[0] : ''; }
  function applySimpleAutoCategorization(rows) { return rows.map(row => { if (!row.category && featureSettings.autoCategorization) { const suggested = suggestCategoryForDescription(row.desc); if (suggested) { row.category = suggested; row.matchStatus = 'Categoria sugerida pelo histórico · revise antes de confirmar'; } } return row; }); }
  function detectSpendingAnomalies() { const currentMonth = currentMonthYM(); const byCategory = new Map(); entries.filter(entry => entry.type === 'out').forEach(entry => { const month = String(entry.date || '').slice(0, 7); const key = `${entry.category || 'sem-categoria'}|${month}`; byCategory.set(key, (byCategory.get(key) || 0) + Number(entry.amount || 0)); }); const current = new Map(); entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(currentMonth)).forEach(entry => current.set(entry.category || 'sem-categoria', (current.get(entry.category || 'sem-categoria') || 0) + Number(entry.amount || 0))); const anomalies = []; current.forEach((value, categoryId) => { const history = [...byCategory.entries()].filter(([key]) => key.startsWith(`${categoryId}|`) && !key.endsWith(`|${currentMonth}`)).map(([, amount]) => amount).slice(-6); if (history.length < 2) return; const average = history.reduce((sum, amount) => sum + amount, 0) / history.length; if (value > average * 1.75 && value > average + 50) anomalies.push({ category: categories.find(cat => cat.id === categoryId)?.name || 'Sem categoria', value, average }); }); return anomalies.sort((a, b) => b.value - b.average - (a.value - a.average)); }
  function runAnomalyScan() { const anomalies = detectSpendingAnomalies(); const status = document.getElementById('profileAnalysisStatus'); status.innerHTML = anomalies.length ? anomalies.slice(0, 5).map(item => `<div><strong>${escapeHTML(item.category)}</strong>: ${fmt(item.value)} no mês atual, contra média de ${fmt(item.average)}.</div>`).join('') : 'Nenhuma anomalia estatística encontrada com pelo menos dois meses de histórico.'; logInfo('Análise', 'Detectar anomalias', 'Sucesso', `${anomalies.length} possível(is) anomalia(s) encontrada(s).`); }
  function generateMonthlyReview() { const month = currentMonthYM(); const income = entries.filter(e => e.type === 'in' && String(e.date || '').startsWith(month)).reduce((s, e) => s + Number(e.amount || 0), 0); const expense = entries.filter(e => e.type === 'out' && String(e.date || '').startsWith(month)).reduce((s, e) => s + Number(e.amount || 0), 0); const over = categories.filter(cat => { const budget = budgetFor(cat.id); return budget && budget.amount > 0 && budgetSpent(cat.id, currentFinancialCycleKey()) > budget.amount; }).map(cat => cat.name); const status = document.getElementById('profileAnalysisStatus'); status.innerHTML = `<strong>Revisão de ${escapeHTML(formatMonthLabel(month))}</strong><div>Entradas: ${fmt(income)} · Saídas: ${fmt(expense)} · Fluxo: ${fmt(income - expense)}</div><div>${over.length ? `Categorias acima do orçamento: ${escapeHTML(over.join(', '))}.` : 'Nenhuma categoria acima do orçamento.'}</div><small>Resumo informativo; nenhuma alteração automática foi feita.</small>`; logInfo('Análise', 'Revisão mensal guiada', 'Sucesso', 'Resumo mensal apresentado sem alterações automáticas.'); }
  function runWhatIf() {
    const extra = Math.max(0, readMoneyInput(document.getElementById('featureWhatIfExpense')));
    const goal = Math.max(0, readMoneyInput(document.getElementById('featureSavingsGoalAmount')));
    const monthsInput = Number(document.getElementById('featureProjectionMonths')?.value);
    const projectionMonths = Math.min(24, Math.max(1, Number.isFinite(monthsInput) && monthsInput > 0 ? monthsInput : Number(featureSettings.projectionMonths || 6)));

    const series = dashboardMonthSeries(6);
    const avgNet = series.reduce((sum, item) => sum + Number(item.net || 0), 0) / Math.max(1, series.length);
    const currentPatrimony = totalBankBalance() + totalPocketBalance() + totalInvestBalance();

    const baselineProjected = currentPatrimony + avgNet * projectionMonths;
    const simulatedNet = avgNet - extra;
    const simulatedProjected = currentPatrimony + simulatedNet * projectionMonths;

    const goalGap = goal > 0 ? simulatedNet - goal : null;
    const goalMessage = goal > 0
      ? (goalGap >= 0
        ? `A projeção mensal fica <strong>${fmt(goalGap)}</strong> acima da meta de economia.`
        : `A projeção mensal fica <strong>${fmt(Math.abs(goalGap))}</strong> abaixo da meta de economia.`)
      : 'Defina uma meta de economia mensal para comparar o cenário.';

    const status = document.getElementById('profileProjectionStatus');
    if (status) {
      status.innerHTML = `
        <strong>Projeção para ${projectionMonths} ${projectionMonths === 1 ? 'mês' : 'meses'}</strong>
        <div>Fluxo líquido médio atual: <strong>${fmt(avgNet)}</strong>/mês.</div>
        <div>Patrimônio estimado sem nova saída: <strong>${fmt(baselineProjected)}</strong>.</div>
        <div>Com nova saída de <strong>${fmt(extra)}</strong>/mês: patrimônio estimado de <strong>${fmt(simulatedProjected)}</strong>.</div>
        <div>${goalMessage}</div>
        <small>Estimativa baseada na média dos últimos seis meses. Nenhum lançamento foi alterado.</small>
      `;
    }

    logInfo('Análise', 'Simulador E se', 'Sucesso', 'Cenário simulado com média líquida dos últimos seis meses, sem alteração dos dados.');
  }
  let compoundCalcChartInstance = null;
  function destroyCompoundCalcChart() {
    if (compoundCalcChartInstance) {
      compoundCalcChartInstance.destroy();
      compoundCalcChartInstance = null;
    }
  }
  function parseCompoundRate(value) {
    const text = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
    const rate = Number(text);
    return Number.isFinite(rate) && rate >= 0 ? rate : 0;
  }
  function compoundFutureValue(principal, payment, monthlyRate, months) {
    let balance = Math.max(0, principal);
    const paymentValue = Math.max(0, payment);
    const points = [balance];
    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyRate) + paymentValue;
      points.push(balance);
    }
    const invested = Math.max(0, principal) + paymentValue * months;
    return { final: balance, invested, interest: balance - invested, points };
  }
  function compoundTaxRates(days) {
    const prazo = Math.max(1, Math.round(Number(days) || 1));
    const ir = prazo <= 180 ? 0.225 : prazo <= 360 ? 0.2 : prazo <= 720 ? 0.175 : 0.15;
    const iof = Math.max(0, 96 - 3.5 * (prazo - 1)) / 100;
    return { ir, iof, days: prazo };
  }
  function compoundApplyTaxes(result, days) {
    const rates = compoundTaxRates(days);
    const interest = Math.max(0, result.interest);
    const taxIof = interest * rates.iof;
    const taxIr = interest * rates.ir;
    const taxTotal = taxIof + taxIr;
    return { ...result, irPct: rates.ir * 100, iofPct: rates.iof * 100, taxDays: rates.days, taxIr, taxIof, taxTotal, netInterest: interest - taxTotal, netFinal: result.final - taxTotal };
  }
  function indicatorMonthlyRate(key) {
    try {
      const info = typeof financialIndicatorsState === 'function' ? financialIndicatorsState() : null;
      const item = info && info.indicators ? info.indicators[key] : null;
      const daily = item ? Number(item.value) : NaN;
      if (Number.isFinite(daily) && daily > 0) {
        const annual = Math.pow(1 + daily / 100, 252) - 1;
        return Math.pow(1 + annual, 1 / 12) - 1;
      }
    } catch (_) { }
    return null;
  }
  function compoundBenchmarkRatePct(kind) {
    if (kind === 'selic') { const live = indicatorMonthlyRate('selic'); return live === null ? 1 : live * 100; }
    if (kind === 'cdi') { const live = indicatorMonthlyRate('cdi'); return live === null ? 0.9 : live * 100; }
    return 0.5;
  }
  function compoundPctLabel(pct) { return String(Number(Number(pct).toFixed(2))).replace('.', ','); }
  function compoundRateInputValue(pct) { return String(Number(Number(pct).toFixed(3))).replace('.', ','); }
  function renderCompoundCalcChart(months, scenario, benchmarks) {
    const box = document.getElementById('ciChartBox');
    const canvas = document.getElementById('ciChart');
    destroyCompoundCalcChart();
    if (!box || !canvas) return;
    if (typeof Chart === 'undefined') { box.hidden = true; return; }
    box.hidden = false;
    const labels = scenario.points.map((_, index) => index === 0 ? 'Início' : String(index));
    const bodyStyle = getComputedStyle(document.body);
    const textColor = bodyStyle.getPropertyValue('--ink-soft').trim() || '#55635B';
    const gridColor = bodyStyle.getPropertyValue('--line').trim() || '#D8D2C1';
    const benchmarkColors = { 'CDI': '#B3432B', 'Selic': '#3B6FA8', 'Poupança': '#8A6A2F', 'Personalizado': '#7A4B9E' };
    const benchmarkDatasets = (benchmarks || []).map((item) => {
      const color = benchmarkColors[item.name] || '#B3432B';
      return {
        label: `${item.name} · ${compoundPctLabel(item.ratePct)}%`,
        data: item.result.points,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.25,
        pointRadius: 0,
        pointBackgroundColor: color
      };
    });
    compoundCalcChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Cenário', data: scenario.points, borderColor: '#2F6F4F', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.25, pointRadius: months > 36 ? 0 : 2, pointBackgroundColor: '#2F6F4F' },
          ...benchmarkDatasets
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 14, boxHeight: 2, padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
        },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 9, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { size: 10 }, callback: (value) => { const v = Number(value); if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'; return fmt(v); } }, grid: { color: gridColor } }
        }
      }
    });
  }
  function compoundAllocationOptions(days) {
    const info = typeof financialIndicatorsState === 'function' ? financialIndicatorsState() : null;
    const ind = info && info.indicators ? info.indicators : {};
    const normalized = (text) => String(text || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const pickTitle = (needle) => {
      const titles = ind.tesouro && Array.isArray(ind.tesouro.titles) ? ind.tesouro.titles : [];
      const pool = titles.filter(title => title && normalized(title.name).includes(needle)
        && Number.isFinite(title.saleRate) && title.saleRate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(title.maturity || ''));
      if (!pool.length) return null;
      const horizon = new Date(Date.now() + Math.max(1, Math.round(days)) * 86400000).toISOString().slice(0, 10);
      const still = pool.filter(title => title.maturity >= horizon);
      const source = still.length ? still : pool;
      return source.slice().sort((a, b) => (a.maturity <= b.maturity ? -1 : 1))[0];
    };
    const annualFromBenchmark = (kind) => Math.pow(1 + compoundBenchmarkRatePct(kind) / 100, 12) - 1;
    const options = [];
    const selicTitle = pickTitle('selic');
    const selicAnnual = selicTitle ? selicTitle.saleRate / 100 : annualFromBenchmark('selic');
    options.push({
      name: 'Tesouro Selic',
      ref: selicTitle
        ? `${compoundPctLabel(selicAnnual * 100)}% a.a. · liquidez diária (Tesouro)`
        : `${compoundPctLabel(selicAnnual * 100)}% a.a. · ${indicatorMonthlyRate('selic') !== null ? 'Selic BCB' : 'ref. offline'} · liquidez diária`,
      annual: selicAnnual,
      irExempt: false
    });
    const ipcaTitle = pickTitle('ipca');
    const ipcaMonthlyPct = ind.ipca ? Number(ind.ipca.value) : NaN;
    const ipcaAnnual = Number.isFinite(ipcaMonthlyPct) && ipcaMonthlyPct > -100 ? Math.pow(1 + ipcaMonthlyPct / 100, 12) - 1 : null;
    if (ipcaTitle && ipcaAnnual !== null) {
      options.push({
        name: 'Tesouro IPCA+',
        ref: `${compoundPctLabel(ipcaTitle.saleRate)}% a.a. real + IPCA estimado (${compoundPctLabel(ipcaAnnual * 100)}%)`,
        annual: (1 + ipcaTitle.saleRate / 100) * (1 + ipcaAnnual) - 1,
        irExempt: false
      });
    }
    const cdiAnnual = annualFromBenchmark('cdi');
    const cdiLive = indicatorMonthlyRate('cdi') !== null;
    options.push({
      name: 'CDB 100% do CDI',
      ref: `${compoundPctLabel(cdiAnnual * 100)}% a.a. · ${cdiLive ? 'CDI vigente BCB' : 'ref. offline'} · FGC até R$ 250 mil`,
      annual: cdiAnnual,
      irExempt: false
    });
    options.push({
      name: 'LCI/LCA típico 90% do CDI',
      ref: `${compoundPctLabel(cdiAnnual * 90)}% a.a. · isento IR${days >= 90 ? ' (90 dias cumpridos)' : ' (carência de 90 dias)'}`,
      annual: cdiAnnual * 0.9,
      irExempt: days >= 90
    });
    return options;
  }
  function compoundAllocationCard(initial, monthly, months, days, scenario) {
    const options = compoundAllocationOptions(days)
      .filter(option => Number.isFinite(option.annual) && option.annual > 0)
      .map(option => {
        const monthlyRate = Math.pow(1 + option.annual, 1 / 12) - 1;
        const taxed = compoundApplyTaxes(compoundFutureValue(initial, monthly, monthlyRate, months), days);
        const netFinal = option.irExempt ? taxed.final - taxed.taxIof : taxed.netFinal;
        return { ...option, netFinal, delta: netFinal - scenario.netFinal };
      })
      .sort((a, b) => b.netFinal - a.netFinal);
    if (!options.length) return '';
    const rows = options.map(option => {
      const pct = scenario.netFinal > 0 ? (option.delta / scenario.netFinal) * 100 : null;
      const color = option.delta >= 0 ? '#2F6F4F' : '#B3432B';
      const sign = option.delta >= 0 ? '+' : '−';
      const deltaText = pct === null ? '' : ` <em style="color:${color}">${sign}${fmt(Math.abs(option.delta))} (${sign}${compoundPctLabel(Math.abs(pct))}%)</em>`;
      return `<div class="compound-calc-row"><span>${escapeHTML(option.name)} · ${escapeHTML(option.ref)}</span><b>${fmt(option.netFinal)}${deltaText}</b></div>`;
    }).join('');
    return `
        <div class="compound-calc-card compound-calc-card-aloc">
          <strong class="compound-calc-card-title">Onde alocar · melhor líquido primeiro (mesmo valor e prazo do cenário)</strong>
          ${rows}
          <p class="compound-calc-note">Estimativas com IR/IOF pelo prazo; isenção de LCI/LCA só vale após 90 dias de carência. Fontes: BCB (Selic/CDI/IPCA) e Tesouro Nacional quando há conexão; CDB e LCI/LCA usam percentuais típicos do CDI (referência do mercado, não cotação). Conteúdo educativo — não é recomendação de investimento.</p>
        </div>`;
  }
  function runCompoundInterest() {
    const initial = Math.max(0, readMoneyInput(document.getElementById('ciInitial')));
    const monthly = Math.max(0, readMoneyInput(document.getElementById('ciMonthly')));
    const unitDays = document.getElementById('ciTermUnit')?.value === 'd';
    const termRaw = String(document.getElementById('ciMonths')?.value ?? '').trim();
    const termDefault = unitDays ? 365 : 12;
    const termValue = termRaw === '' ? termDefault : (Number(termRaw.replace(',', '.')) || termDefault);
    const days = unitDays
      ? Math.min(18000, Math.max(1, Math.round(termValue)))
      : Math.min(18000, Math.max(1, Math.round(termValue) * 30));
    const months = unitDays
      ? Math.max(1, Math.ceil(days / 30))
      : Math.min(600, Math.max(1, Math.round(termValue)));
    const scenarioRatePct = parseCompoundRate(document.getElementById('ciRate')?.value);
    const scenarioPeriod = document.getElementById('ciRatePeriod')?.value || 'm';
    const scenarioAnnual = scenarioPeriod === 'y';
    const scenarioCdiMode = scenarioPeriod === 'c';
    const scenarioMonthlyRate = scenarioCdiMode
      ? (scenarioRatePct / 100) * (compoundBenchmarkRatePct('cdi') / 100)
      : scenarioAnnual
        ? Math.pow(1 + scenarioRatePct / 100, 1 / 12) - 1
        : scenarioRatePct / 100;
    const scenario = compoundApplyTaxes(compoundFutureValue(initial, monthly, scenarioMonthlyRate, months), days);
    const benchmarkDefs = [];
    if (document.getElementById('ciBenchCdi')?.checked) benchmarkDefs.push({ name: 'CDI', ratePct: compoundBenchmarkRatePct('cdi') });
    if (document.getElementById('ciBenchSelic')?.checked) benchmarkDefs.push({ name: 'Selic', ratePct: compoundBenchmarkRatePct('selic') });
    if (document.getElementById('ciBenchPoupanca')?.checked) benchmarkDefs.push({ name: 'Poupança', ratePct: compoundBenchmarkRatePct('poupanca') });
    if (document.getElementById('ciBenchCustom')?.checked) benchmarkDefs.push({ name: 'Personalizado', ratePct: parseCompoundRate(document.getElementById('ciBenchmarkRate')?.value) });
    const benchmarks = benchmarkDefs.map((def) => ({
      name: def.name,
      ratePct: def.ratePct,
      result: compoundApplyTaxes(compoundFutureValue(initial, monthly, def.ratePct / 100, months), days)
    }));

    const results = document.getElementById('ciResults');
    if (results) {
      const card = (title, result) => `
        <div class="compound-calc-card">
          <strong class="compound-calc-card-title">${escapeHTML(title)}</strong>
          <div class="compound-calc-row"><span>Montante final (bruto)</span><b>${fmt(result.final)}</b></div>
          <div class="compound-calc-row"><span>Total aportado</span><b>${fmt(result.invested)}</b></div>
          <div class="compound-calc-row"><span>Juros (bruto)</span><b>${fmt(result.interest)}</b></div>
          <div class="compound-calc-row"><span>IR (regressivo ${compoundPctLabel(result.irPct)}%)</span><b>− ${fmt(result.taxIr)}</b></div>
          <div class="compound-calc-row"><span>IOF${result.taxIof > 0 ? ` (${compoundPctLabel(result.iofPct)}%)` : ' (isento)'}</span><b>${fmt(result.taxIof)}</b></div>
          <div class="compound-calc-row compound-calc-row-net"><span>Montante líquido</span><b>${fmt(result.netFinal)}</b></div>
        </div>`;
      const iofLabel = scenario.taxIof > 0 ? `${compoundPctLabel(scenario.iofPct)}%` : 'isento';
      const scenarioTitle = scenarioCdiMode
        ? `Cenário · ${compoundPctLabel(scenarioRatePct)}% do CDI (${compoundPctLabel(scenarioMonthlyRate * 100)}% a.m.)`
        : `Cenário · ${compoundPctLabel(scenarioRatePct)}% ${scenarioAnnual ? 'a.a.' : 'a.m.'}`;
      if (!benchmarks.length) {
        results.innerHTML = `
          ${card(scenarioTitle, scenario)}
          <div class="compound-calc-card compound-calc-card-delta">
            <strong class="compound-calc-card-title">Benchmark</strong>
            <div class="compound-calc-row"><span>Marque pelo menos um benchmark (CDI, Selic, Poupança ou Personalizado) para comparar com o cenário.</span></div>
          </div>`;
        destroyCompoundCalcChart();
        const chartBox = document.getElementById('ciChartBox');
        if (chartBox) chartBox.hidden = true;
        logInfo('Análise', 'Calculadora de juros compostos', 'Aguardando benchmark', 'Nenhum benchmark marcado; apenas o cenário foi calculado.');
        return;
      }
      const benchmarkCards = benchmarks.map((item) => card(`${item.name} · ${compoundPctLabel(item.ratePct)}% a.m.`, item.result)).join('');
      const diffRows = benchmarks.map((item) => {
        const diffNet = scenario.netFinal - item.result.netFinal;
        const diffGross = scenario.final - item.result.final;
        const diffPct = item.result.netFinal > 0 ? Math.abs(diffNet / item.result.netFinal) * 100 : null;
        const diffTitle = diffNet >= 0 ? 'O cenário termina acima' : 'O benchmark termina acima';
        return `
          <strong class="compound-calc-card-title">${escapeHTML(item.name)}</strong>
          <div class="compound-calc-row"><span>Líquido (cenário − ${escapeHTML(item.name)})</span><b>${fmt(diffNet)}</b></div>
          <div class="compound-calc-row"><span>Bruto (cenário − ${escapeHTML(item.name)})</span><b>${fmt(diffGross)}</b></div>
          <div class="compound-calc-row"><span>${diffTitle}${diffPct !== null ? ` em ${compoundPctLabel(diffPct)}%` : ''}</span></div>`;
      }).join('');
      results.innerHTML = `
        ${card(scenarioTitle, scenario)}
        ${benchmarkCards}
        <div class="compound-calc-card compound-calc-card-delta">
          <strong class="compound-calc-card-title">Diferença</strong>
          ${diffRows}
          <div class="compound-calc-row"><span>Impostos no prazo: IR ${compoundPctLabel(scenario.irPct)}% · IOF ${iofLabel} · ${scenario.taxDays} dias</span></div>
        </div>
        ${compoundAllocationCard(initial, monthly, months, days, scenario)}`;
    }

    renderCompoundCalcChart(months, scenario, benchmarks);
    logInfo('Análise', 'Calculadora de juros compostos', 'Sucesso', 'Cenário e benchmarks calculados localmente com IR/IOF, sem alterar os dados.');
  }
  function parsePtNumberValue(raw) {
    const text = String(raw || '').trim();
    if (!text) return 0;
    if (text.includes(',') && text.includes('.')) return Number(text.replace(/\./g, '').replace(',', '.')) || 0;
    if (text.includes(',')) return Number(text.replace(',', '.')) || 0;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, '')) || 0;
    return Number(text) || 0;
  }
  function buildCompoundInterestReply(message) {
    const text = String(message || '').toLocaleLowerCase('pt-BR');
    if (!/\d/.test(text)) return null;
    if (!/(juros compost|quanto (?:rende|acumula|cresce|eu teria|teria)|montante|simul\w*\s+(?:o |um )?(?:investiment|rendiment|aplic))/.test(text)) return null;
    const rateMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%(?!\s*(?:do|da|de)\b)/);
    if (!rateMatch) return null;
    const ratePct = parseCompoundRate(rateMatch[1]);
    if (ratePct <= 0) return null;
    const mentionsYear = /(?:ao\s+ano|no\s+ano|por\s+ano|anual|a\.a\.?)/.test(text);
    const mentionsMonth = /(?:ao\s+m[êe]s|no\s+m[êe]s|por\s+m[êe]s|mensal|cada\s+m[êe]s|a\.m\.?)/.test(text);
    const annual = mentionsYear && !mentionsMonth;
    const monthlyRate = annual ? Math.pow(1 + ratePct / 100, 1 / 12) - 1 : ratePct / 100;
    if (monthlyRate <= 0 || monthlyRate > 0.1) return null;
    const termMonths = text.match(/(\d+)\s*meses/);
    const termDaysMatch = text.match(/(\d+)\s*dias?/);
    const termYears = text.match(/(\d+)\s*anos?/);
    let days = 0;
    if (termDaysMatch) days = Number(termDaysMatch[1]);
    else if (termMonths) days = Number(termMonths[1]) * 30;
    else if (termYears) days = Number(termYears[1]) * 365;
    if (!Number.isFinite(days) || days < 1) return null;
    days = Math.min(18000, Math.round(days));
    const aporteMatch = text.match(/(?:aporte|aportando|depositando|guardando|aplicando)[^0-9%]{0,24}(\d+(?:[.,]\d+)?)/);
    const valueTokens = [...text.matchAll(/(?:r\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*reais\b)/g)];
    const bareInitial = text.match(/(\d+(?:[.,]\d+)?)\s*(?:reais\s*)?com\s+(?:o\s+)?(?:aporte|juros)/);
    let aporte = aporteMatch ? parsePtNumberValue(aporteMatch[1]) : 0;
    let inicial = 0;
    let foundInicial = false;
    for (const match of valueTokens) {
      const rawValue = match[1] || match[2];
      const start = match.index || 0;
      const end = start + match[0].length;
      const marker = /(?:\/\s*m[êe]s|ao\s+m[êe]s|por\s+m[êe]s|cada\s+m[êe]s|no\s+m[êe]s|mensal)/;
      const after = text.slice(end, end + 16).match(/^[^\d%]*/)?.[0] || '';
      const beforeRaw = text.slice(Math.max(0, start - 16), start);
      const before = beforeRaw.match(/[\d%][^\d%]*$/)?.[0] || beforeRaw;
      const monthlyContext = marker.test(after) || marker.test(before);
      if (monthlyContext) { if (!aporte) aporte = parsePtNumberValue(rawValue); continue; }
      if (!foundInicial) { inicial = parsePtNumberValue(rawValue); foundInicial = true; }
    }
    if (!foundInicial && bareInitial) { inicial = parsePtNumberValue(bareInitial[1]); foundInicial = true; }
    if (!aporte) { const monthlyAporte = text.match(/(\d+(?:[.,]\d+)?)\s*(?:por|ao|no|cada)\s*m[êe]s\b/); if (monthlyAporte) aporte = parsePtNumberValue(monthlyAporte[1]); }
    if (!foundInicial && !aporte) return null;
    let benchmarkKind = 'poupanca';
    if (/selic/.test(text)) benchmarkKind = 'selic';
    else if (/\bcdi\b/.test(text) || /\bcdb\b/.test(text)) benchmarkKind = 'cdi';
    const benchmarkName = { poupanca: 'Poupança', cdi: 'CDI', selic: 'Selic' }[benchmarkKind];
    const benchmarkRatePct = compoundBenchmarkRatePct(benchmarkKind);
    const months = Math.max(1, Math.ceil(days / 30));
    const scenario = compoundApplyTaxes(compoundFutureValue(inicial, aporte, monthlyRate, months), days);
    const benchmark = compoundApplyTaxes(compoundFutureValue(inicial, aporte, benchmarkRatePct / 100, months), days);
    const diffNet = scenario.netFinal - benchmark.netFinal;
    const diffPct = benchmark.netFinal > 0 ? Math.abs(diffNet / benchmark.netFinal) * 100 : null;
    const winner = diffNet >= 0 ? 'O cenário termina acima' : 'O benchmark termina acima';
    const rateLabel = annual
      ? `${compoundPctLabel(ratePct)}% ao ano (${compoundPctLabel(monthlyRate * 100)}% a.m.)`
      : `${compoundPctLabel(ratePct)}% ao mês`;
    const iofLabel = scenario.taxIof > 0 ? ` · IOF ${fmt(scenario.taxIof)}` : ' · IOF isento (prazo ≥ 30 dias)';
    return [
      'Simulação local de juros compostos (calculadora do LABS — sem chamada de IA):',
      `Cenário: ${rateLabel} em ${days} dias, com ${fmt(inicial)} inicial e aporte de ${fmt(aporte)} por mês.`,
      `Bruto: montante ${fmt(scenario.final)} · aportado ${fmt(scenario.invested)} · juros ${fmt(scenario.interest)}.`,
      `Impostos: IR ${compoundPctLabel(scenario.irPct)}% = ${fmt(scenario.taxIr)}${iofLabel} (${scenario.taxDays} dias).`,
      `Líquido: montante ${fmt(scenario.netFinal)} · juros ${fmt(scenario.netInterest)}.`,
      `Comparativo ${benchmarkName} (${compoundPctLabel(benchmarkRatePct)}% a.m.): líquido ${fmt(benchmark.netFinal)} · juros ${fmt(benchmark.netInterest)}.`,
      `Diferença líquida (cenário − benchmark): ${diffNet >= 0 ? '+' : ''}${fmt(diffNet)} — ${winner}${diffPct !== null ? ` em ${compoundPctLabel(diffPct)}%` : ''}.`,
      'Estimativa sem inflação; a Poupança pode ter isenção própria de IR. Ajuste os parâmetros na calculadora do LABS.'
    ].join('\n');
  }
  /* Movimentação por texto digitado (sem chamada de IA): casa SÓ com
     valor + verbo de direção ("gastei 30 reais no mercado",
     "recebi 1500 de salário", "paguei R$ 45,90 no restaurante").
     Perguntas, textos sem verbo, sem valor ou sem conta cadastrada não
     disparam — o texto segue para a IA. Categoria: palavras-chave nas
     categorias padrão, depois o histórico; banco = primeiro cadastrado
     (o comprovante tem Editar para corrigir). */
  function parseMovementFromText(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw || raw.includes('?')) return null;
    if (!banks.length) return null;
    const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const plain = stripAccents(raw.toLocaleLowerCase('pt-BR'));
    if (/\b(?:quanto|quanta|quando|onde|quem|qual|quais|como|por que|porque|sera)\b/.test(plain)) return null;

    const outVerb = /\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou)\b/.test(plain);
    const inVerb = /\b(?:recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b/.test(plain);
    if (!outVerb && !inVerb) return null;
    const type = outVerb ? 'out' : 'in';

    /* Valor: "R$ 45,90" / "45,90 reais" tem prioridade; senão o número
       que segue o verbo de direção. Sem valor > 0 → não casa. */
    let amount = 0;
    let amountSpan = '';
    const moneyMatch = raw.match(/r\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*reais\b/i);
    if (moneyMatch) {
      amount = parsePtNumberValue(moneyMatch[1] || moneyMatch[2]);
      amountSpan = moneyMatch[0];
    } else {
      const numAfterVerb = plain.match(/\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou|recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b[^0-9]{0,24}(\d+(?:[.,]\d+)?)/);
      if (numAfterVerb) {
        amount = parsePtNumberValue(numAfterVerb[1]);
        amountSpan = numAfterVerb[0];
      }
    }
    if (!(amount > 0)) return null;

    /* Descrição: remove o valor reconhecido e os verbos de direção e
       encolhe o resto (fallback: o texto original). O span vem do texto
       em minúsculas — comparação case-insensitive. */
    let desc = raw;
    if (amountSpan) {
      const spanPattern = amountSpan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      desc = desc.replace(new RegExp(spanPattern, 'i'), ' ');
    }
    desc = desc
      .replace(/\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou|recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b/gi, ' ')
      .replace(/\d+(?:[.,]\d+)?\s*reais\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:em|no|na|nos|nas|de|do|da|para|pelo|pela|com|por|e)\s+/i, '')
      .trim();
    if (!desc) desc = raw;
    if (desc.length > 160) desc = desc.slice(0, 157) + '...';

    const categoryKeywords = [
      { key: 'alimentacao', words: ['mercado', 'supermercado', 'restaurante', 'lanche', 'comida', 'ifood', 'padaria', 'acougue', 'cafe', 'cafeteria', 'almoco', 'jantar', 'pizza', 'hamburguer', 'marmita'] },
      { key: 'transporte', words: ['uber', 'onibus', 'metro', 'gasolina', 'combustivel', 'estacionamento', 'passagem', 'taxi', 'pedagio'] },
      { key: 'saude', words: ['farmacia', 'medico', 'dentista', 'consulta', 'remedio', 'exame', 'hospital', 'psicologo', 'terapia'] },
      { key: 'lazer', words: ['cinema', 'show', 'bar', 'viagem', 'hotel', 'passeio', 'netflix', 'spotify', 'steam', 'jogo', 'presente'] },
      { key: 'moradia', words: ['aluguel', 'condominio', 'luz', 'agua', 'energia', 'internet', 'gas', 'iptu', 'reforma', 'mensalidade'] },
      { key: 'salario', words: ['salario', 'pagamento', 'folha', 'prolabore'] },
      { key: 'renda extra', words: ['freela', 'bico', 'venda', 'cashback', 'rendimento'] }
    ];
    const plainDesc = stripAccents(desc.toLowerCase());
    let category = '';
    for (const entry of categoryKeywords) {
      if (!entry.words.some((word) => plainDesc.includes(word))) continue;
      const hit = categories.find((c) => stripAccents(String(c.name || '').toLowerCase()) === entry.key);
      if (hit) { category = hit.id; break; }
    }
    if (!category) category = suggestCategoryForDescription(desc) || '';

    return {
      type,
      amount: Math.round(amount * 100) / 100,
      desc,
      category,
      bank: banks[0].id,
      date: todayISO()
    };
  }
  function exportPatrimonyChartPng() { const series = dashboardMonthSeries(6); const canvas = document.createElement('canvas'); canvas.width = 1400; canvas.height = 820; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#F7F5EF'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#1C2B24'; ctx.font = '700 36px Plus Jakarta Sans, sans-serif'; ctx.fillText('Livro-Caixa · Patrimônio estimado', 80, 90); ctx.font = '20px Plus Jakarta Sans, sans-serif'; ctx.fillStyle = '#4C5A52'; ctx.fillText('Últimos seis meses · imagem gerada localmente', 80, 130); const left = 110, top = 210, width = 1160, height = 470; const values = series.map(item => Number(item.patrimony || 0)); const min = Math.min(0, ...values), max = Math.max(1, ...values); ctx.strokeStyle = '#D8D2C1'; ctx.lineWidth = 2; for (let i = 0; i <= 4; i++) { const y = top + height - (height * i / 4); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke(); } const xFor = i => left + (series.length <= 1 ? width / 2 : i * width / (series.length - 1)); const yFor = value => top + height - ((value - min) / (max - min || 1)) * height; ctx.strokeStyle = '#2F6F4F'; ctx.lineWidth = 7; ctx.beginPath(); series.forEach((item, i) => { const x = xFor(i), y = yFor(item.patrimony); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke(); series.forEach((item, i) => { const x = xFor(i), y = yFor(item.patrimony); ctx.fillStyle = '#2F6F4F'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1C2B24'; ctx.font = '18px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText(item.label, x, top + height + 42); ctx.font = '16px IBM Plex Mono, monospace'; ctx.fillText(fmt(item.patrimony), x, y - 20); }); const link = document.createElement('a'); link.download = `patrimonio-livro-caixa-${todayISO()}.png`; link.href = canvas.toDataURL('image/png'); link.click(); logInfo('Exportação', 'Exportar patrimônio PNG', 'Sucesso', 'Gráfico de patrimônio exportado como imagem.'); }
document.getElementById('btnRunAnomalyScan')?.addEventListener('click', runAnomalyScan);
  document.getElementById('btnGenerateMonthlyReview')?.addEventListener('click', generateMonthlyReview);
  document.getElementById('btnRunWhatIf')?.addEventListener('click', runWhatIf);
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
  document.getElementById('btnExportPatrimonyPng')?.addEventListener('click', exportPatrimonyChartPng);

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
  const HIDE_BALANCES_STORAGE_KEY = 'livrocaixa_hide_balances_on_open';
  document.getElementById('profileAppVersion') && (document.getElementById('profileAppVersion').textContent = APP_VERSION_LABEL);
  function syncProfileEmail() {
    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    const elProfileEmail = document.getElementById('profileEmail');
    if (elProfileEmail && user?.email) {
      elProfileEmail.textContent = user.email;
    }
  }
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

  function syncBalancesToggleButton(hidden) {
    /* Botão do olho removido: alternância só pelo toque no valor/saldo. */
  }
  function applyBalancesHiddenState(hidden) {
    document.body.classList.toggle('balances-hidden', !!hidden);
    syncBalancesToggleButton(!!hidden);
  }
  function toggleBalancesVisibility() {
    applyBalancesHiddenState(!document.body.classList.contains('balances-hidden'));
  }
  let hideBalancesOnOpen = localStorage.getItem(HIDE_BALANCES_STORAGE_KEY) === '1';
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
  const autoQuotes = document.getElementById('featureAutoQuotes');
  const quoteIntervalRow = document.querySelector('label[for="featureQuoteInterval"]')?.parentElement;
  function toggleQuoteInterval() {
    if (quoteIntervalRow) quoteIntervalRow.style.display = autoQuotes?.checked ? '' : 'none';
  }
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

  // ===== P2.3.2 — Detecção real de inconsistências =====
  function runDiagnostics() {
    const issues = [];

    const orphanEntryBanks = entries.filter(e => e.bank && !banks.some(b => b.id === e.bank));
    if (orphanEntryBanks.length) issues.push({ severity: 'warning', title: 'Lançamentos com banco inexistente', detail: `${orphanEntryBanks.length} lançamento(s) referenciam um banco que não existe mais.` });

    const orphanEntryCats = entries.filter(e => e.category && !categories.some(c => c.id === e.category));
    if (orphanEntryCats.length) issues.push({ severity: 'warning', title: 'Lançamentos com categoria inexistente', detail: `${orphanEntryCats.length} lançamento(s) referenciam uma categoria que não existe mais.` });

    const orphanPurchaseCards = purchases.filter(p => p.cardId && !cards.some(c => c.id === p.cardId));
    if (orphanPurchaseCards.length) issues.push({ severity: 'warning', title: 'Compras sem cartão vinculado', detail: `${orphanPurchaseCards.length} compra(s) referenciam um cartão que não existe mais.` });

    const orphanBudgets = budgets.filter(b => b.categoryId && !categories.some(c => c.id === b.categoryId));
    if (orphanBudgets.length) issues.push({ severity: 'warning', title: 'Limites de orçamento órfãos', detail: `${orphanBudgets.length} limite(s) de orçamento apontam pra uma categoria que não existe mais.` });

    const catNamesSeen = {};
    categories.forEach(c => { const key = String(c.name || '').trim().toLowerCase(); if (key) catNamesSeen[key] = (catNamesSeen[key] || 0) + 1; });
    const dupCatNames = Object.entries(catNamesSeen).filter(([, count]) => count > 1);
    if (dupCatNames.length) issues.push({ severity: 'warning', title: 'Categorias com nome repetido', detail: `${dupCatNames.length} nome(s) de categoria aparecem mais de uma vez: ${dupCatNames.map(([name]) => name).join(', ')}.` });

    const bankNamesSeen = {};
    banks.forEach(b => { const key = String(b.name || '').trim().toLowerCase(); if (key) bankNamesSeen[key] = (bankNamesSeen[key] || 0) + 1; });
    const dupBankNames = Object.entries(bankNamesSeen).filter(([, count]) => count > 1);
    if (dupBankNames.length) issues.push({ severity: 'warning', title: 'Bancos com nome repetido', detail: `${dupBankNames.length} nome(s) de banco aparecem mais de uma vez: ${dupBankNames.map(([name]) => name).join(', ')}.` });

    const negativePockets = pockets.filter(p => pocketCurrentBalance(p) < -0.005);
    if (negativePockets.length) issues.push({ severity: 'warning', title: 'Caixinhas com saldo negativo', detail: `${negativePockets.length} caixinha(s) têm mais resgate do que aporte registrado: ${negativePockets.map(p => p.name).join(', ')}.` });

    const cardsWithoutBank = cards.filter(c => c.active !== false && !c.bankId);
    if (cardsWithoutBank.length) issues.push({ severity: 'warning', title: 'Cartões sem banco definido', detail: `${cardsWithoutBank.length} cartão(ões) ativo(s) não têm banco de pagamento vinculado.` });

    const goalsPastDeadline = goals.filter(g => {
      const current = goalCurrentAmount(g);
      return g.deadline && g.deadline < todayISO() && current != null && current < Number(g.targetAmount || 0);
    });
    if (goalsPastDeadline.length) issues.push({ severity: 'warning', title: 'Metas com prazo vencido', detail: `${goalsPastDeadline.length} meta(s) passaram do prazo sem atingir o objetivo: ${goalsPastDeadline.map(g => g.name).join(', ')}.` });

    return issues;
  }
  function buildGeminiFinancialSnapshot() {
    const entriesSafe = Array.isArray(entries) ? entries : [];
    const currentMonth = currentMonthYM();
    const diagnosticIssues = runDiagnostics();

    const totalIncome = entriesSafe
      .filter(e => e.type === 'in')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const totalExpense = entriesSafe
      .filter(e => e.type === 'out')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const categoryTotals = new Map();

    entriesSafe
      .filter(e => e.type === 'out')
      .forEach(e => {
        const categoryName =
          categories.find(c => c.id === e.category)?.name || 'Sem categoria';

        categoryTotals.set(
          categoryName,
          (categoryTotals.get(categoryName) || 0) + Number(e.amount || 0)
        );
      });

    const expensesByCategory = [...categoryTotals.entries()]
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2))
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyFlow = [];
    const monthsSeen = new Set();

    entriesSafe.forEach(e => {
      const month = String(e.date || '').slice(0, 7);
      if (month) monthsSeen.add(month);
    });

    [...monthsSeen]
      .sort()
      .slice(-12)
      .forEach(month => {
        const monthEntries = entriesSafe.filter(
          e => String(e.date || '').startsWith(month)
        );

        const income = monthEntries
          .filter(e => e.type === 'in')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const expense = monthEntries
          .filter(e => e.type === 'out')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        monthlyFlow.push({
          month,
          income: Number(income.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          net: Number((income - expense).toFixed(2)),
          transactions: monthEntries.length
        });
      });

    const patrimony = getPatrimonySummaryBlock();

    /* Contas: rótulo + saldo. Sem números de conta, sem IDs internos. */
    const accountSummary = banks
      .filter(bank => bank && bank.id !== 'geral')
      .map(bank => ({
        name: String(bank.name || 'Conta'),
        balance: Number(bankBalance(bank.id).toFixed(2))
      }));

    /* Caixinhas: usa as mesmas fórmulas da tela (pocketCurrentBalance e a
       progressão exibida em pocketGoalMarkup) — nada de regra paralela. */
    const pocketSummary = pockets.map(pocket => {
      const balance = Number(pocketCurrentBalance(pocket).toFixed(2));
      const target = Number(pocket.goalAmount) || 0;
      const percent = target > 0 ? Math.min(100, Math.max(0, balance / target * 100)) : null;
      return {
        name: String(pocket.name || 'Caixinha'),
        objective: pocket.goal ? String(pocket.goal) : null,
        balance,
        target: target > 0 ? target : null,
        progressPercent: percent == null ? null : Number(percent.toFixed(1)),
        remaining: target > 0 ? Number(Math.max(0, target - balance).toFixed(2)) : null
      };
    });

    const investmentSummary = investments.map(inv => {
      const crypto = isCryptoType(inv.type);
      return {
        name: String(inv.name || inv.alias || 'Ativo'),
        type: String(inv.type || 'Não informado'),
        institution: inv.institution ? String(inv.institution) : null,
        value: Number(
          (
            inv.type === 'Renda Fixa'
              ? fixedIncomeCurrentValue(inv)
              : Number(inv.value || 0)
          ).toFixed(2)
        ),
        units: crypto && inv.units != null
          ? Number(cryptoCurrentUnits(inv))
          : null,
        rate: inv.rate ? String(inv.rate) : null,
        dueDate: inv.dueDate || null
      };
    });

    const budgetSummary = budgets.map(budget => {
      const categoryName =
        categories.find(c => c.id === budget.categoryId)?.name ||
        'Sem categoria';

      const spent = budgetSpent(budget.categoryId);

      return {
        categoryId: budget.categoryId,
        category: categoryName,
        amount: Number(budget.amount || 0),
        limit: Number(budget.amount || 0),
        spent: Number(spent.toFixed(2))
      };
    });

    /* Metas: goalPlanning()/goalCurrentAmount() são a fonte oficial de
       alvo, atual, restante e prazo. */
    const goalSummary = goals.map(goal => {
      const plan = goalPlanning(goal);
      const percent = plan.target > 0 && plan.hasCurrent
        ? Math.min(100, Math.max(0, plan.current / plan.target * 100))
        : null;
      return {
        name: String(goal.name || 'Meta'),
        target: plan.target,
        current: plan.hasCurrent ? plan.current : null,
        remaining: plan.remaining,
        progressPercent: percent == null ? null : Number(percent.toFixed(1)),
        deadline: goal.deadline || null,
        status: goal.status || 'active',
        daysRemaining: plan.daysRemaining,
        source: goal.sourceType || (goal.caixinhaId ? 'pocket' : null)
      };
    });

    /* Cartões: agregados do motor (card-engine) — nunca dados completos
       do cartão, titular, número ou compras individuais. */
    const cardSummary = dashCardSummary();
    const cardTotals = cardSummary
      ? {
          activeCount: cards.filter(card => card.active !== false).length,
          invoiceLaunchCount: invoiceLaunches.length,
          purchaseCount: purchases.length,
          currentInvoiceTotal: Number(cardSummary.currentInvoiceTotal || 0),
          currentInvoiceRemaining: Number(cardSummary.currentInvoiceRemaining || 0),
          previousInvoiceRemaining: Number(cardSummary.previousInvoiceRemaining || 0),
          totalLimit: Number(cardSummary.totalLimit || 0),
          totalUsed: Number(cardSummary.totalUsed || 0),
          committed: Number(cardSummary.committed || 0)
        }
      : {
          activeCount: cards.filter(card => card.active !== false).length,
          invoiceLaunchCount: invoiceLaunches.length,
          purchaseCount: purchases.length
        };

    return {
      schemaVersion: 'P3.5',
      generatedAt: new Date().toISOString(),
      period: {
        currentMonth,
        monthsIncluded: monthlyFlow.length,
        currentMonthComplete: (() => {
          const today = todayISO();
          const monthEnd = monthEndDate(currentMonth);
          return today >= monthEnd;
        })(),
        /* Totais do mês corrente mesmo quando ainda não há lançamento
           nele — evita a IA tratar "sem dados" como "sem gastos". */
        currentMonthTotals: (() => {
          const inMonth = entriesSafe.filter(e => String(e.date || '').startsWith(currentMonth));
          const inc = inMonth.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.amount || 0), 0);
          const exp = inMonth.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.amount || 0), 0);
          return {
            income: Number(inc.toFixed(2)),
            expense: Number(exp.toFixed(2)),
            net: Number((inc - exp).toFixed(2)),
            transactions: inMonth.length
          };
        })(),
        latestEntryDate: entriesSafe
          .map(e => String(e.date || ''))
          .filter(Boolean)
          .sort()
          .pop() || null
      },

      cashFlow: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        net: Number((totalIncome - totalExpense).toFixed(2)),
        transactionCount: entriesSafe.length,
        expensesByCategory
      },

      monthlyFlow,

      patrimony: {
        banks: Number(patrimony.bankTotal.toFixed(2)),
        pockets: Number(patrimony.pocketTotal.toFixed(2)),
        investments: Number(patrimony.investTotal.toFixed(2)),
        total: Number(patrimony.total.toFixed(2))
      },

      accounts: accountSummary,
      pockets: pocketSummary,
      investments: investmentSummary,

      cards: cardTotals,

      budgets: budgetSummary,
      goals: goalSummary,

      /* Referência externa de mercado (BCB/Tesouro) — contexto adicional.
         null quando ainda não há indicadores; nunca entra em cálculo. */
      indicators: (() => {
        const info = financialIndicatorsState();
        if (!info) return null;
        const current = info.indicators;
        const pick = item => (item ? { value: item.value, unit: item.unit, date: item.date } : null);
        return {
          source: 'BCB SGS e Tesouro Nacional',
          fetchedAt: info.fetchedAt || null,
          selic: pick(current.selic),
          cdi: pick(current.cdi),
          ipca: pick(current.ipca),
          tesouro: current.tesouro && Array.isArray(current.tesouro.titles)
            ? { date: current.tesouro.date, titleCount: current.tesouro.titles.length }
            : null
        };
      })(),

      structuralDiagnosis: {
        issueCount: diagnosticIssues.length,
        issues: diagnosticIssues.map(issue => ({
        severity: issue.severity,
        title: issue.title
      }))
      }
    };
  }

  /* ETAPA 3 (V.20-02) — o orçamento do snapshot (CHAT_SNAPSHOT_REDUCTIONS e
     fitChatSnapshotToBudget) mora em ai-chat-contract.js junto dos limites
     que ele usa; aqui só chamamos contract.fitChatSnapshotToBudget(). */

  function renderDiagnosticResults() {
    const issues = runDiagnostics();
    const icon = document.getElementById('diagnosticSummaryIcon');
    const label = document.getElementById('diagnosticSummaryLabel');
    const detail = document.getElementById('diagnosticSummaryDetail');
    if (icon) icon.textContent = '';
    if (label) label.textContent = issues.length ? `${issues.length} ponto(s) de atenção` : 'Dados consistentes';
    if (detail) detail.textContent = issues.length ? 'Veja os detalhes abaixo — nada foi alterado automaticamente.' : 'Nenhuma inconsistência encontrada na última verificação.';
    const results = document.getElementById('diagnosticResults');
    if (results) {
      results.innerHTML = issues.length
        ? issues.map(i => `<div class="diagnostic-item is-warning"><span></span><div><strong>${escapeHTML(i.title)}</strong><span>${escapeHTML(i.detail)}</span></div></div>`).join('')
        : '<div class="diagnostic-item is-ok"><span></span><div><strong>Tudo certo</strong><span>Nenhuma inconsistência encontrada.</span></div></div>';
    }
    return issues;
  }
  document.getElementById('btnRunDiagnostic')?.addEventListener('click', renderDiagnosticResults);

  // Console técnico global: o Perfil reutiliza exatamente o mesmo
  // painel e o mesmo histórico usado durante a autenticação.
  document.getElementById('btnOpenTechnicalDiagnostic')?.addEventListener('click', event => {
    event.preventDefault();

    if (typeof window.toggleLoginDiagnostic === 'function') {
      window.toggleLoginDiagnostic(event);
    }
  });

  /* =====================================================================
     CHAT IA (V.20-02) — modal aberto pelo FAB da Visão Geral.

     - contrato/limites: window.LivroCaixaChatContract (fonte única);
     - snapshot: buildGeminiFinancialSnapshot() + orçamento de 64 KB;
     - envio: window.LivroCaixaAI.chat() → POST /ai (sem chave local);
     - contexto: EM MEMÓRIA, atrelado à conta ativa. Nada em Firebase,
       localStorage ou sessionStorage nesta versão.
     ===================================================================== */

  const AI_CHAT_GREETING = 'Olá! Eu sou a LIA.\nEstou aqui para ajudar você a entender melhor suas finanças — suas contas, gastos, metas, caixinhas e investimentos.';

  /* Máquina de estados da conversa: fonte única em ai-chat-contract.js
     (testável sem DOM). Sem contrato o chat já não envia — aqui degradamos
     para um núcleo inerte só para abrir/fechar sem lançar. */
  function createAiChatSession() {
    const contract = window.LivroCaixaChatContract;
    const persistence = window.LivroCaixaChatPersistence;
    if (contract && typeof contract.createChatSession === 'function') {
      return contract.createChatSession(persistence || {});
    }
    return {
      isOpen: () => false,
      isBusy: () => false,
      getAccountId: () => null,
      getSessionId: () => 0,
      getMessages: () => [],
      getPending: () => null,
      openFor() {},
      close() {},
      resetContext() {},
      begin: () => ({ ok: false, token: null }),
      isCurrent: () => false,
      commit: () => false,
      settle: () => false,
      truncateFrom: async () => false
    };
  }

  const aiChat = {
    session: createAiChatSession(),
    controller: null,
    opener: null,
    pageScroll: null,
    editing: null
  };

  function aiChatContract() {
    return window.LivroCaixaChatContract || null;
  }

  function aiChatAccountId() {
    try { return currentUser?.uid || null; } catch (err) { return null; }
  }

  function aiChatNotice(text, kind) {
    const el = document.getElementById('aiChatNotice');
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.classList.remove('is-error');
      return;
    }
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('is-error', kind === 'error');
  }

  function aiChatScrollToEnd() {
    const box = document.getElementById('aiChatMessages');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function aiChatSetBusy(busy) {
    const send = document.getElementById('btnAiChatSend');
    const box = document.getElementById('aiChatMessages');
    if (send) {
      send.disabled = Boolean(busy);
      send.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
    if (box) box.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  /* O prompt proíbe markdown, mas o modelo ainda pode escapar **negrito**
     ou `código`: remove só os marcadores (pós-escape, sem inserir HTML)
     para a conversa nunca exibir asterisco ou crase cru. */
  function aiChatStripEmphasis(text) {
    return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  }

  function aiChatRender() {
    const box = document.getElementById('aiChatMessages');
    if (!box) return;

    const messages = aiChat.session.getMessages();
    const pending = aiChat.session.getPending();

    const parts = [];
    if (!messages.length && !pending) {
      parts.push(`<div class="ai-chat-msg is-placeholder">${escapeHTML(AI_CHAT_GREETING)}</div>`);

      /* V.20-01 — sugestões rápidas dinâmicas (exatamente 3). */
      const suggestions = aiChat.session.getQuickSuggestions();
      if (suggestions.length > 0) {
        parts.push('<div class="ai-quick-suggestions" role="list" aria-label="Sugestões rápidas">');
        suggestions.forEach((text, idx) => {
          const safe = escapeHTML(text);
          parts.push(
            `<button type="button" class="ai-quick-suggestion" role="listitem" ` +
            `aria-label="Perguntar: ${safe}" ` +
            `aria-posinset="${idx + 1}" aria-setsize="${suggestions.length}" ` +
            `data-suggestion="${safe}">${safe}</button>`
          );
        });
        parts.push('</div>');
      }
    }
    messages.forEach((item, index) => {
      if (item.role !== 'user') {
        const body = aiChatStripEmphasis(escapeHTML(item.content));
        parts.push(`<div class="ai-chat-msg is-assistant">${body}</div>`);
        return;
      }
      const body = escapeHTML(item.content);
      parts.push(
        `<div class="ai-chat-msg is-user" data-msg-index="${index}" tabindex="0">` +
        `<span class="ai-chat-msg-text">${body}</span>` +
        `<span class="ai-chat-msg-actions" hidden>` +
        `<button type="button" class="ai-chat-action" data-chat-action="copy">Copiar</button>` +
        `<button type="button" class="ai-chat-action" data-chat-action="edit">Editar</button>` +
        `<span class="ai-chat-action-status" aria-live="polite"></span>` +
        `</span>` +
        `</div>`
      );
    });

    /* V.20-01 — comprovante da proposta no chat: derivado de
       chatProposal (sem tocar no contrato do chat); some quando a
       proposta é descartada ou liberada. */
    parts.push(...chatProposalParts());

    if (pending) {
      parts.push(`<div class="ai-chat-msg is-user is-pending">${escapeHTML(pending.content)}</div>`);
      parts.push('<div class="ai-chat-msg is-assistant is-pending">Pensando…</div>');
    }

    box.innerHTML = parts.join('');
    aiChatScrollToEnd();

    /* Listeners das sugestões (delegação no container). */
    box.querySelectorAll('.ai-quick-suggestion').forEach((btn) => {
      btn.addEventListener('click', onQuickSuggestionClick);
    });
  }

  function onQuickSuggestionClick(event) {
    const btn = event.currentTarget;
    const suggestion = btn.getAttribute('data-suggestion');
    if (!suggestion) return;

    aiChatCancelEdit();

    const input = document.getElementById('aiChatInput');
    if (!input) return;

    input.value = suggestion;
    input.focus({ preventScroll: true });

    /* Dispara o envio usando o fluxo padrão (submit do form). */
    const form = document.getElementById('aiChatForm');
    if (form) {
      const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(submitEvent);
    }
  }

  /* ------------------- ações na mensagem do usuário ------------------------ */

  function closeAiChatActions() {
    document.querySelectorAll('#aiChatMessages .ai-chat-msg-actions').forEach((el) => { el.hidden = true; });
    document.querySelectorAll('#aiChatMessages .is-actions-open').forEach((el) => el.classList.remove('is-actions-open'));
  }

  function toggleAiChatActions(bubble) {
    const actions = bubble.querySelector('.ai-chat-msg-actions');
    if (!actions) return;
    const wasOpen = bubble.classList.contains('is-actions-open');
    closeAiChatActions();
    if (!wasOpen) {
      actions.hidden = false;
      bubble.classList.add('is-actions-open');
    }
  }

  async function aiChatCopyMessage(index, bubble) {
    const item = aiChat.session.getMessages()[index];
    if (!item || item.role !== 'user') return;

    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.content);
        copied = true;
      }
    } catch (err) { copied = false; }
    if (!copied) {
      try {
        const area = document.createElement('textarea');
        area.value = item.content;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand('copy');
        area.remove();
      } catch (err) { copied = false; }
    }

    const status = bubble.querySelector('.ai-chat-action-status');
    if (status) {
      status.textContent = copied ? 'Copiado!' : 'Não foi possível copiar.';
      window.setTimeout(() => { if (status.isConnected) status.textContent = ''; }, 1600);
    }
  }

  function aiChatStartEdit(index) {
    if (aiChat.session.isBusy()) {
      aiChatNotice('Aguarde a resposta atual antes de editar uma pergunta.', 'error');
      return;
    }
    const item = aiChat.session.getMessages()[index];
    if (!item || item.role !== 'user') return;

    aiChat.editing = { index };
    const input = document.getElementById('aiChatInput');
    if (input) {
      input.value = item.content;
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (err) { /* input sem seleção */ }
    }
    aiChatNotice('Editando sua pergunta: ajuste e envie para reenviar — as respostas a partir dela serão atualizadas. Esc cancela.');
  }

  function aiChatCancelEdit() {
    if (!aiChat.editing) return;
    if (aiChat.session.isBusy()) return;
    aiChat.editing = null;
    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';
    aiChatNotice('');
  }

  function onAiChatMessagesClick(event) {
    /* Ações do comprovante no chat (Confirmar/Editar/Descartar) — antes
       do guard de mensagens do usuário: o balão é do assistente e não
       tem data-msg-index. */
    const proposalAction = event.target.closest?.('[data-chat-confirm],[data-chat-edit],[data-chat-discard]');
    if (proposalAction) {
      if (proposalAction.hasAttribute('data-chat-confirm')) chatProposalConfirm();
      else if (proposalAction.hasAttribute('data-chat-edit')) chatProposalEdit();
      else chatProposalDiscard();
      return;
    }

    const bubble = event.target.closest?.('.ai-chat-msg.is-user[data-msg-index]');
    if (!bubble) {
      closeAiChatActions();
      return;
    }

    const action = event.target.closest?.('[data-chat-action]');
    if (action) {
      const index = Number(bubble.dataset.msgIndex);
      if (action.dataset.chatAction === 'copy') {
        aiChatCopyMessage(index, bubble);
        return;
      }
      if (action.dataset.chatAction === 'edit') {
        aiChatStartEdit(index);
        closeAiChatActions();
      }
      return;
    }

    if (event.target.closest('.ai-chat-msg-actions')) return;
    toggleAiChatActions(bubble);
  }

  const AI_CHAT_ERROR_MESSAGES = {
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

  function aiChatErrorMessage(err) {
    const code = String(err?.code || '');
    if (AI_CHAT_ERROR_MESSAGES[code]) return AI_CHAT_ERROR_MESSAGES[code];
    if (/^http_429$/.test(code)) return AI_CHAT_ERROR_MESSAGES.rate_limited;
    const message = String(err?.message || '').trim();
    return message || 'Não foi possível enviar a pergunta. Tente novamente.';
  }

  /* Monta e valida o payload ANTES de qualquer requisição. Repete a mesma
     validação que o Worker fará (validateChatPayload) para falhar cedo e
     com mensagem útil — o Worker continua sendo a garantia real.

     historyIndex — edição estilo ChatGPT: o contexto considera só as
     mensagens anteriores à pergunta editada (o resto será descartado
     no reenvio). */
  function aiChatPrepare(text, historyIndex) {
    const contract = aiChatContract();
    if (!contract) return { ok: false, code: 'contract_unavailable' };

    const message = contract.validateChatMessage(text);
    if (!message.ok) return { ok: false, code: message.body.code, error: message.body.error };

    const rawSnapshot = buildGeminiFinancialSnapshot();
    if (!contract.snapshotHasData(rawSnapshot)) return { ok: false, code: 'no_data' };

    const fitted = contract.fitChatSnapshotToBudget(rawSnapshot);
    if (!fitted.ok) return { ok: false, code: fitted.reason };

    const history = aiChat.session.getMessages();
    const source = Number.isInteger(historyIndex) && historyIndex >= 0 && historyIndex <= history.length
      ? history.slice(0, historyIndex)
      : history;
    const context = contract.normalizeConversationContext(source);
    const payload = {
      message: message.value,
      financialSnapshot: fitted.snapshot,
      conversationContext: context
    };

    const check = contract.validateChatPayload(payload);
    if (!check.ok) return { ok: false, code: check.body.code, error: check.body.error };

    return { ok: true, payload: check.value, dropped: fitted.dropped || [] };
  }

  async function aiChatSend(rawText) {
    if (aiChat.session.isBusy()) return;

    const originalText = String(rawText ?? '');

    /* Edição estilo ChatGPT: o índice capturado aqui vale pelo envio
       inteiro; a validação garante que truncateFrom não falhará. */
    const editing = aiChat.editing ? { ...aiChat.editing } : null;
    if (editing) {
      const target = aiChat.session.getMessages()[editing.index];
      if (!target || target.role !== 'user') {
        aiChat.editing = null;
        aiChatNotice('Não foi possível editar essa mensagem — a conversa mudou. Ajuste o texto e envie como nova pergunta.', 'error');
        return;
      }
    }

    const localCompoundReply = buildCompoundInterestReply(originalText);
    if (localCompoundReply) {
      const started = aiChat.session.begin(originalText);
      if (started.ok) {
        const token = started.token;
        if (editing) {
          const truncated = await aiChat.session.truncateFrom(editing.index);
          if (!truncated) {
            aiChat.session.settle(token);
            aiChatNotice('Não foi possível atualizar a conversa. Tente editar novamente.', 'error');
            return;
          }
          aiChat.editing = null;
        }
        const input = document.getElementById('aiChatInput');
        if (input) input.value = '';
        aiChat.session.commit(token, originalText, localCompoundReply);
        aiChat.session.settle(token);
        aiChatNotice('');
        if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
        logInfo('Análise', 'LIA · cálculo local de juros compostos', 'Sucesso', 'Resposta calculada localmente sem chamada de IA.');
        return;
      }
    }

    /* Movimentação por texto digitado: casa localmente (sem chamada de
       IA) e monta o comprovante na conversa para confirmação. Não casa
       em edição nem com anexo pendente; se não entender, o texto segue
       normalmente para a IA. */
    const parsedMovement = (!editing && !ocrState.attachment)
      ? parseMovementFromText(originalText)
      : null;
    if (parsedMovement) {
      const started = aiChat.session.begin(originalText);
      if (started.ok) {
        const token = started.token;
        const inputField = document.getElementById('aiChatInput');
        if (inputField) inputField.value = '';
        chatProposalFromText(parsedMovement);
        await aiChat.session.commit(token, originalText,
          'Ok — identifiquei a movimentação. Confira o comprovante abaixo e toque em Confirmar para lançar.');
        aiChat.session.settle(token);
        aiChatNotice('');
        if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
        logInfo('Análise', 'LIA · movimentação por texto', 'Sucesso', 'Comprovante criado localmente sem chamada de IA.');
        return;
      }
    }

    const prepared = aiChatPrepare(originalText, editing ? editing.index : null);

    if (!prepared.ok) {
      aiChatNotice(
        AI_CHAT_ERROR_MESSAGES[prepared.code] || prepared.error || 'Não foi possível enviar a pergunta.',
        'error'
      );
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      aiChatNotice(AI_CHAT_ERROR_MESSAGES.offline, 'error');
      return;
    }

    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';

    const started = aiChat.session.begin(prepared.payload.message);
    if (!started.ok) return;
    const token = started.token;

    const controller = new AbortController();
    aiChat.controller = controller;
    aiChatNotice(prepared.dropped.length
      ? `Alguns detalhes foram omitidos do envio por tamanho (${prepared.dropped.join(', ')}).`
      : '');
    aiChatSetBusy(true);
    aiChatRender();

    const isCurrent = () =>
      aiChat.session.isCurrent(token) &&
      token.accountId === aiChatAccountId() &&
      !controller.signal.aborted;

    try {
      const reply = await window.LivroCaixaAI.chat({
        message: prepared.payload.message,
        financialSnapshot: prepared.payload.financialSnapshot,
        conversationContext: prepared.payload.conversationContext,
        signal: controller.signal
      });

      /* Guardas de sessão: conta, sessão do modal, cancelamento e
         pertencimento à pergunta enviada. Falhou alguma → descarta. */
      if (!isCurrent()) return;

      /* Edição: só descarta o trecho antigo quando a resposta chegou —
         falhou a IA, o histórico fica intacto e o rascunho é recuperado. */
      if (editing) {
        const truncated = await aiChat.session.truncateFrom(editing.index);
        if (!truncated) {
          aiChatNotice('Não foi possível atualizar a conversa. Edite a pergunta novamente.', 'error');
          const field = document.getElementById('aiChatInput');
          if (field && !field.value) field.value = originalText;
          return;
        }
        aiChat.editing = null;
      }

      aiChat.session.commit(token, prepared.payload.message, reply);
    } catch (err) {
      if (err?.code === 'aborted') return;
      if (!isCurrent()) return;

      aiChatNotice(aiChatErrorMessage(err), 'error');
      /* A pergunta volta ao campo para reenvio — sem duplicar no histórico. */
      const field = document.getElementById('aiChatInput');
      if (field && !field.value) field.value = originalText;
    } finally {
      aiChat.session.settle(token);
      aiChat.controller = null;
      aiChatSetBusy(false);
      if (aiChat.session.isOpen() && aiChat.session.getSessionId() === token.sessionId) aiChatRender();
    }
  }

  function openAiChat() {
    /* Contexto pertence a uma conta: outro dono = conversa nova. */
    
    /* Garante que indicadores de mercado estejam disponíveis para a IA. */
    const refreshIndicatorsPromise = (typeof refreshFinancialIndicators === 'function')
      ? refreshFinancialIndicators({ silent: true })
      : Promise.resolve(null);

    const snapshot = buildGeminiFinancialSnapshot();
    const abertura = aiChat.session.openFor(aiChatAccountId(), snapshot);

    const contract = aiChatContract();
    const input = document.getElementById('aiChatInput');
    if (contract && input) input.maxLength = contract.CHAT_LIMITS.MESSAGE_MAX_CHARS;

    aiChat.opener = document.activeElement;

    /* Estado da página antes de abrir (restaurado no fechamento) e
       limpeza de qualquer deslocamento herdado — antes do openModal. */
    aiChat.pageScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };
    aiChatResetModalScroll();
    openModal('panelAiChat');
    aiChatNotice(contract ? '' : AI_CHAT_ERROR_MESSAGES.contract_unavailable, contract ? null : 'error');
    aiChatSetBusy(aiChat.session.isBusy());
    aiChatRender();
    if (abertura && typeof abertura.then === 'function') {
      abertura.then(() => {
        if (aiChat.session.isOpen()) aiChatRender();
      }).catch(() => {});
    }
    /* Foco em caixa overflow:hidden deixa overlay/painel deslocados de uma
       abertura anterior; limpa a página/camadas, mede contra a visual
       viewport e preserva a âncora do fim da conversa do aiChatRender(). */
    aiChatApplyViewportFix();
    window.renderAiQuotaStatus?.();
    renderAiIndicatorsStatus();
    window.LivroCaixaAI?.refreshQuota?.({ silent: true, throttleMs: 15000 });

    /* Aguarda indicadores (não bloqueia a UI, mas enriquece o snapshot se chegar a tempo). */
    refreshIndicatorsPromise.catch(() => { /* best-effort */ });

    window.setTimeout(() => input?.focus({ preventScroll: true }), 0);
  }

  function closeAiChat() {
    /* O contexto permanece em memória; só o envio em andamento é
       invalidado (close incrementa requestId no contrato). */
    aiChat.session.close();

    if (aiChat.controller) {
      try { aiChat.controller.abort(); } catch (err) { /* já encerrado */ }
      aiChat.controller = null;
    }

    aiChatSetBusy(false);

    const input = document.getElementById('aiChatInput');
    if (input) input.value = '';
    aiChat.editing = null;

    const opener = aiChat.opener;
    aiChat.opener = null;
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
      try { opener.focus(); } catch (err) { /* elemento saiu do DOM */ }
    }

    /* Reset completo (página + camadas + caixa) para a próxima abertura
       não herdar deslocamento de teclado; em seguida devolve a página à
       posição de antes de abrir — no mobile era 0, no desktop não pula
       para o topo. */
    aiChatResetModalScroll();
    const closedPanel = document.getElementById('panelAiChat');
    if (closedPanel) {
      closedPanel.style.removeProperty('--ai-chat-vv-top');
      closedPanel.style.removeProperty('--ai-chat-vv-bottom');
    }
    const pageScroll = aiChat.pageScroll;
    aiChat.pageScroll = null;
    if (pageScroll && (pageScroll.x || pageScroll.y)) {
      try { window.scrollTo(pageScroll.x, pageScroll.y); } catch (err) { /* sem janela */ }
    }
  }

  /* Limpeza de contexto: troca de conta, logout, sessão reiniciada.
     Nunca persistida — só isto apaga a conversa nesta versão. */
  function resetAiChatContext() {
    const snapshot = buildGeminiFinancialSnapshot();
    aiChat.session.resetContext();
    aiChat.editing = null;

    if (aiChat.controller) {
      try { aiChat.controller.abort(); } catch (err) { /* já encerrado */ }
      aiChat.controller = null;
    }

    if (aiChat.session.isOpen()) {
      aiChat.session.openFor(aiChatAccountId(), snapshot);
      aiChatNotice('');
      aiChatSetBusy(false);
      aiChatRender();
    }
  }

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

  /* O navegador rola a PÁGINA (body/documentElement) e as caixas
     overflow:hidden para manter o input em foco com o teclado aberto — e
     o deslocamento permanece depois que o teclado fecha. Zera página,
     overlay, painel e, no ciclo de vida, a caixa de conversa.

     keepMessages — foco/blur/toque preservam a rolagem da conversa para a
     lista não pular para o topo enquanto o usuário digita. */
  function aiChatResetModalScroll(keepMessages) {
    try { window.scrollTo(0, 0); } catch (err) { /* sem janela */ }
    try {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    } catch (err) { /* sem DOM */ }

    const overlay = document.getElementById('modalOverlay');
    const panel = document.getElementById('panelAiChat');
    if (overlay) { overlay.scrollTop = 0; overlay.scrollLeft = 0; }
    if (panel) { panel.scrollTop = 0; panel.scrollLeft = 0; }

    const box = document.getElementById('aiChatMessages');
    if (box && !keepMessages) { box.scrollTop = 0; box.scrollLeft = 0; }

    /* Nenhum estilo inline existe hoje; limpa resíduo de transform/top/
       height para a próxima abertura nascer com layout limpo. */
    [overlay, panel].forEach((el) => {
      if (!el) return;
      if (el.style.transform) el.style.transform = '';
      if (el.style.top) el.style.top = '';
      if (el.style.height) el.style.height = '';
    });
  }

  /* 2ª rodada (mobile): em vez de só zerar scroll, o sheet é medido
     contra a VISUAL viewport e ancorado acima do teclado — encolhe lá
     em cima em vez de subir e cortar o cabeçalho. As medidas viram
     custom properties consumidas pelo CSS (#panelAiChat.open). */
  function aiChatFitVisualViewport() {
    const panel = document.getElementById('panelAiChat');
    if (!panel || !panel.classList.contains('open')) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const layoutH = document.documentElement.clientHeight || window.innerHeight || 0;
    /* Topo: o offset da viewport visual (barra do sistema) + 16px de folga.
       Base: o que sobra até o fim do layout (teclado em modo
       resizes-visual; ~0 em resizes-content, que encolhe o layout) + 16px.
       O overlay recebe esses valores como padding e o flex-center do
       overlay mantém o painel centralizado dentro da região visível. */
    const topGap = Math.max(16, Math.round(vv.offsetTop) + 16);
    const bottomGap = Math.max(16, layoutH - (vv.offsetTop + vv.height)) + 16;
    panel.style.setProperty('--ai-chat-vv-top', topGap + 'px');
    panel.style.setProperty('--ai-chat-vv-bottom', bottomGap + 'px');
  }

  function aiChatApplyViewportFix() {
    aiChatResetModalScroll(true);
    aiChatFitVisualViewport();
  }

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


  // V19-20: meses de projeção são salvos automaticamente ao sair do campo.
  const inputProjectionMonths = document.getElementById('featureProjectionMonths');
  let projectionSaveTimer = null;

  async function saveProjectionMonthsAutomatically() {
    if (!inputProjectionMonths) return;

    const value = Math.min(24, Math.max(1, Number(inputProjectionMonths.value) || 6));

    inputProjectionMonths.value = value;
    featureSettings = normalizeFeatureSettings({
      ...featureSettings,
      projectionMonths: value
    });

    // V19-20: garante persistência local mesmo sem login ou se a nuvem falhar.
    persistFeatureSettings();

    try {
      await persistProfileSettings();
      const status = document.getElementById('profileSettingsStatus') || document.getElementById('featureProfileStatus');
      if (status) status.textContent = 'Meses de projeção salvos automaticamente.';
    } catch (err) {
      const status = document.getElementById('profileSettingsStatus') || document.getElementById('featureProfileStatus');
      if (status) status.textContent = 'Projeção salva localmente; sincronização remota falhou.';
      logSyncError('meses de projeção', err);
    }
  }

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
  document.getElementById('pinUnlockInput')?.addEventListener('keydown', event => { if (event.key === 'Enter') document.getElementById('btnPinUnlock')?.click(); });
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
      logWarn('Conciliação', 'Salvar histórico', 'Falha', err.message);
    }
  }

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
            <span class="history-diff ${item.difference > 0 ? 'positive' : (item.difference < 0 ? 'negative' : 'zero')}" style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:11px;color:${item.difference > 0 ? 'var(--red)' : (item.difference < 0 ? 'var(--green)' : 'var(--green)')};">
              ${item.difference === 0 ? '✓ Conciliado' : (item.difference > 0 ? '+' : '') + fmt(Math.abs(item.difference))}
            </span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      logWarn('Conciliação', 'Render histórico', 'Falha', err.message);
    }
  }

  async function autoGenerateRecurringBills() {
    if (!currentUser) { logWarn('Calendário', 'Geração automática', 'Ignorado', 'É necessário estar autenticado para gerar lançamentos financeiros.'); return 0; }
    const now = new Date(); const key = billMonthKey(now); const year = now.getFullYear(); const month = now.getMonth(); const candidates = recurringBills.filter(bill => billAppliesToMonth(bill, year, month) && !billGeneratedForMonth(bill, key) && bill.bank && bill.bank !== 'a-definir');
    if (!candidates.length) return 0;
    const operation = beginLogOperation('Calendário', 'Geração automática'); let created = 0;
    const generatedEntryIds = [];
    const previousStates = candidates.map(bill => ({ bill, generatedMonths: Array.isArray(bill.generatedMonths) ? bill.generatedMonths.slice() : [] }));
    candidates.forEach(bill => { const date = billDueDateForMonth(bill, year, month); const entryId = 'auto' + Date.now() + Math.random().toString(36).slice(2, 8); generatedEntryIds.push(entryId); entries.push({ id: entryId, date, desc: `${bill.name} (automático)`, bank: bill.bank, category: bill.category || categories[0]?.id || '', amount: Number(bill.amount) || 0, type: 'out', recurringBillId: bill.id, automated: true }); bill.generatedMonths = Array.isArray(bill.generatedMonths) ? bill.generatedMonths : []; bill.generatedMonths.push(key); created++; });
    try {
      await persistAll(operation);
      logInfo('Calendário', 'Geração automática', 'Sucesso', `${created} conta(s) recorrente(s) gerada(s) sem duplicidade.`, { month: key, created }, operation);
    } catch (err) {
      entries = entries.filter(item => !generatedEntryIds.includes(item.id));
      previousStates.forEach(({ bill, generatedMonths }) => { bill.generatedMonths = generatedMonths; });
      created = 0;
      logSyncError('geração automática de contas', err, operation);
    }
    render(); renderBills(); return created;
  }
  async function runFeatureAutomation({ manual = false } = {}) {
    if (!currentUser) { logWarn('Automação', 'Ciclo de recursos', 'Ignorado', 'É necessário estar autenticado para executar alterações financeiras.'); return { generated: 0, skipped: true }; }
    if (manual && !window.confirm('Executar agora o ciclo de teste? A geração de contas recorrentes pode criar lançamentos financeiros reais e as cotações podem ser atualizadas.')) return { generated: 0, cancelled: true };
    let generated = 0;
    if (featureSettings.autoLaunchRecurring || manual) generated = await autoGenerateRecurringBills();
    if (featureSettings.autoRefreshQuotes || manual) { try { await updateAllInvestmentPrices({ auto: !manual }); } catch (err) { logSyncError('autoatualização de cotações', err); } }
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

  function formatLogTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const base = date.toLocaleString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${base}.${String(date.getMilliseconds()).padStart(3, '0')}`;
  }
  function renderDiagnosticLog() {
    const type = document.getElementById('logFilterType')?.value || '';
    const module = document.getElementById('logFilterModule')?.value || '';
    const query = (document.getElementById('logFilterText')?.value || '').toLowerCase();
    const modules = [...new Set(diagnosticLog.map(item => item.module).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    const moduleSelect = document.getElementById('logFilterModule');
    if (moduleSelect) { const current=moduleSelect.value; moduleSelect.innerHTML='<option value="">Todos os módulos</option>'+modules.map(item=>`<option value="${escapeHTML(item)}">${escapeHTML(item)}</option>`).join(''); if(modules.includes(current)) moduleSelect.value=current; }
    const filtered = diagnosticLog.filter(item => (!type || item.type === type) && (!module || item.module === module) && (!query || JSON.stringify(item).toLowerCase().includes(query)));
    const list = document.getElementById('diagnosticoList');
    list.innerHTML = filtered.length ? filtered.map(item => {
      const date = item.timestamp ? formatLogTimestamp(item.timestamp) : '';
      const details = item.details ? (typeof item.details === 'string' ? item.details : JSON.stringify(item.details, null, 2)) : '';
      const identity = item.sequence != null ? `#${item.sequence}` : 'sem sequência';
      const operation = item.correlationId ? `op ${item.correlationId}` : '';
      const duration = item.durationMs != null ? `${item.durationMs} ms` : '';
      const sync = item.synced === true ? 'Sincronizado' : item.synced === false ? 'Pendente' : '';
      const meta = [identity, date, item.module || 'Sistema', item.status || '', duration, sync].filter(Boolean).join(' · ');
      return `<article class="log-entry ${String(item.type||'').toLowerCase()}"><div class="log-entry-head"><span class="log-badge">${escapeHTML(item.type || 'INFO')}</span><span class="log-entry-meta">${escapeHTML(meta)}</span></div><div class="log-entry-description">${escapeHTML(item.action || 'Operação')}${item.description ? ' — ' + escapeHTML(item.description) : ''}</div>${operation ? `<div class="log-entry-details">Operação: ${escapeHTML(operation)}</div>` : ''}${details ? `<div class="log-entry-details">${escapeHTML(details)}</div>` : ''}</article>`;
    }).join('') : '<p class="hint">Nenhum evento encontrado para os filtros atuais.</p>';
  }
  function openDiagnostics() { renderDiagnosticLog(); openModal('panelDiagnostico'); }
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
    closeDrawer();
  }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeDrawer(); closeNotifications(); } });

  function refreshFilteredViews() { renderCategorySummary(); renderLedger(); }
  document.getElementById('btnOpenFilters').onclick = () => { closeFilterChoice(); openModal('panelFiltros'); };
  document.getElementById('filterBankTrigger').onclick = () => openFilterChoice('bank');
  document.getElementById('filterCategoryTrigger').onclick = () => openFilterChoice('category');
  document.getElementById('filterChoiceClose').onclick = closeFilterChoice;
  document.getElementById('filterChoiceConfirm').onclick = closeFilterChoice;
  document.getElementById('filterChoiceSearch').addEventListener('input', event => { filterChoiceSearchTerm = event.target.value || ''; renderFilterChoiceList(); });
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
      entries = entries.map(entry => entry.category === id ? { ...entry, category: replacementId } : entry);
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

  let yieldTarget = null; // legado: usado pelos registros antigos de rendimento
  let editingYieldId = null;
  let investmentMovementEditingId = null;
  let pocketMovementTarget = null; // { kind, id }
  let pocketMovementEditingId = null;

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

  window.openYieldModal = function(type, id) {
    if (type === 'invest') return openInvestmentMovementModal('rendimento', id);
    return openPocketMovementModal('rendimento', id);
  };

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

  window.openInvestmentMovementModal = function(kind, id) {
    const item = investments.find(x => x.id === id);
    if (!item) return;
    investmentMovementTarget = { kind: ['aporte','resgate','rendimento'].includes(kind) ? kind : 'aporte', id };
    investmentMovementEditingId = null;
    setInvestmentMovementDefaults();
    updateInvestmentMovementUI();
    openModal('panelInvestMovement');
  };

  document.getElementById('imAporte').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'aporte'; updateInvestmentMovementUI(); } };
  document.getElementById('imResgate').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'resgate'; updateInvestmentMovementUI(); } };
  document.getElementById('imRendimento').onclick = () => { if (investmentMovementTarget) { investmentMovementTarget.kind = 'rendimento'; updateInvestmentMovementUI(); } };

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

  window.editYield = function(yieldId) {
    const y = yieldsLog.find(x => x.id === yieldId);
    if (!y) return;
    if (y.targetType === 'invest') return loadInvestmentMovementForEdit(y);
    if (y.targetType === 'pocket') return loadPocketMovementForEdit(y);
  };

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

  window.editEntry = function(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    editingEntryId = entry.id;
    document.getElementById('fData').value = entry.date;
    document.getElementById('fDesc').value = entry.desc;
    document.getElementById('fBanco').value = entry.bank;
    document.getElementById('fCategoria').value = entry.category;
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
  };

  function openModal(panelId) {
    closeFilterChoice();
    const overlay = document.getElementById('modalOverlay');
    /* Se outro painel for aberto enquanto o chat está no ar, o chat fecha
       pelo mesmo caminho (cancela requisição + devolve foco) para o estado
       interno não divergir do que está visível. */
    if (panelId !== 'panelAiChat' && window.LivroCaixaChat?.isOpen?.()) {
      window.LivroCaixaChat.close();
    }
    // Fecha TODOS os painéis antes de abrir um (evita modais lado a lado)
    document.querySelectorAll('.panel.open, .panel').forEach(p => p.classList.remove('open'));
    const panel = document.getElementById(panelId);
    if (!panel) {
      console.warn('[openModal] painel não encontrado:', panelId);
      return;
    }
    panel.classList.add('open');
    if (overlay) overlay.classList.add('open');
  }

  window.closeAllPanels = function() {
    closeFilterChoice();
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('open');
    document.querySelectorAll('.panel.open, .panel').forEach(p => p.classList.remove('open'));
    returnToEntryAfterCategory = false;
    /* Chat: cancela requisição em andamento, limpa o campo e devolve o
       foco. O contexto em memória é preservado (só troca de conta apaga). */
    window.LivroCaixaChat?.close?.();
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

  let editingBillId = null;
  let billViewDate = new Date();
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
  async function markBillPaid(id, monthKey) {
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
      alert('Não foi possível salvar o status pago. Tente novamente.');
    } finally {
      renderBills();
      renderNotifications();
    }
  }
  async function unmarkBillPaid(id, monthKey) {
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
      alert('Não foi possível atualizar o status. Tente novamente.');
    } finally {
      renderBills();
      renderNotifications();
    }
  }
  window.markBillPaid = markBillPaid;
  window.unmarkBillPaid = unmarkBillPaid;

  // ===== P3.1 — Valores a Receber (independente do Livro-Caixa) =====
  let editingReceivableId = null;
  const RECV_STATUS_LABEL = { pendente: 'Pendente', recebido: 'Recebido', cancelado: 'Cancelado' };
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
    if (!person || !desc) { alert('Informe pessoa e descrição.'); return; }
    if (!(amount > 0)) { alert('Informe um valor válido.'); return; }
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
      alert('Não foi possível salvar. Tente novamente.');
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
  document.getElementById('billParcelado').addEventListener('change', updateBillInstallmentFieldsVisibility);
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
  window.editBill = id => openBillModal(id);
  window.deleteBill = async id => { if(!confirm('Excluir esta conta/fatura? Os lançamentos já gerados no Livro-Caixa serão mantidos.')) return; recurringBills=recurringBills.filter(b=>b.id!==id); await persistAll(); logInfo('Calendário','Exclusão de conta','Sucesso','Conta removida; lançamentos já realizados foram preservados.'); renderBills(); };
  let pendingBillLaunch = null;
  function openBillLaunchPanel(bill, monthKey){
    pendingBillLaunch = { billId: bill.id, monthKey };
    document.getElementById('billLaunchDescription').textContent = `${bill.name} · ${fmt(bill.amount)}. O banco “A definir” é temporário; selecione o banco real antes de lançar.`;
    document.getElementById('billLaunchBank').innerHTML = banks.map(b=>`<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    openModal('panelBillLaunch');
  }
  async function launchBill(bill, monthKey, selectedBankId = null){
    if(!currentUser || billGeneratedForMonth(bill,monthKey)) return;
    if (bill.bank === 'a-definir' && !selectedBankId) { openBillLaunchPanel(bill, monthKey); return; }
    if (!confirm(`Confirmar lançamento de ${bill.name} no Livro-Caixa?`)) return;
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
    } catch (err) {
      entries = entries.filter(item => item.id !== entry.id);
      bill.bank = previousBank;
      bill.generatedMonths = previousGeneratedMonths;
      logSyncError('lançamento de conta', err);
      alert('Não foi possível confirmar o lançamento no servidor. A conta continua como pendente — verifique sua conexão e tente novamente.');
    } finally {
      render(); renderBills();
    }
  }
  window.launchBill = async (id,monthKey) => { const bill=recurringBills.find(b=>b.id===id); if(bill) await launchBill(bill,monthKey); };
  document.getElementById('billLaunchConfirm').onclick = async () => {
    if (!pendingBillLaunch) return;
    const { billId, monthKey } = pendingBillLaunch;
    const bill = recurringBills.find(b => b.id === billId);
    const bankId = document.getElementById('billLaunchBank').value;
    pendingBillLaunch = null;
    if (bill) await launchBill(bill, monthKey, bankId);
  };
  function billTitularValues() {
    const map = new Map();
    recurringBills.forEach(bill => { const value = String(bill.titular || '').trim(); if (value) { const key = value.toLocaleLowerCase('pt-BR'); if (!map.has(key)) map.set(key, value); } });
    return [...map.values()].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  }
  function populateBillTitularFilter() {
    const select = document.getElementById('billTitularFilter'); if (!select) return;
    const current = select.value; const values = billTitularValues();
    select.innerHTML = '<option value="">Todos</option>' + values.map(value => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('');
    if (values.includes(current)) select.value = current;
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
  window.openBillShare = openBillShare;

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
    const allInvoiceRows=calendarInvoiceRows(y,m);
    const invoiceRows=titularFilter?allInvoiceRows.map(inv=>({...inv, breakdown:inv.breakdown.filter(b=>b.titular===titularFilter)})).filter(inv=>inv.breakdown.length):allInvoiceRows;
    const invoiceDisplayTotal = (row) => invoiceDisplayTotalFor(row, titularFilter);

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
        ? `<button type="button" class="bill-action-btn" onclick="unmarkBillPaid('${b.id}','${key}')">Desmarcar pago</button>`
        : `<button type="button" class="bill-action-btn" onclick="markBillPaid('${b.id}','${key}')">Marcar pago</button>`);
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
          <button type="button" class="bill-action-btn primary-outline" onclick="launchBill('${b.id}','${key}')" ${row.launched ? 'disabled' : ''}>${row.launched ? 'Já lançada' : 'Lançar'}</button>
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
            <button type="button" class="bill-action-btn primary-outline" onclick="recordInvoicePayment('${cid}','${pk}','${safeTitular}',${total},${total})">Lançar</button>
            <button type="button" class="bill-action-btn" onclick="unmarkInvoicePaidOnly('${cid}','${pk}','${safeTitular}')">Desmarcar pago</button>
            <button type="button" class="bill-action-btn" onclick="shareInvoiceTitular('${cid}','${pk}','${safeTitular}',${total})">Compartilhar</button>
            <button type="button" class="bill-action-btn bill-more-button" disabled aria-hidden="true">•••</button>`;
        }
        return `
            <button type="button" class="bill-action-btn primary-outline" onclick="recordInvoicePayment('${cid}','${pk}','${safeTitular}',${total},${remaining})">Lançar</button>
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

  window.closeBillDayPanel = closeBillDayPanel;

  function openBillDayPanel(date) {
    const parts = String(date).split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;

    const billRows = calendarBillRows().filter(row => row.dueDate === date);
    const allInvoices = calendarInvoiceRows(y, m);
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

  window.openBillDayPanel = openBillDayPanel;

function billsExportRows() { return calendarBillRows().map(({bill,dueDate,status,launched,bank}) => ({ 'Conta/Fatura': bill.name || '', 'Titular': bill.titular || '', 'Valor': Number(bill.amount || 0), 'Vencimento': dueDate.split('-').reverse().join('/'), 'Banco': bank, 'Status': status, 'Recorrente': bill.recurrenceType === 'nao_recorrente' ? 'Não' : 'Sim', 'Periodicidade': bill.frequency === 'once' ? 'Única' : 'Mensal', 'Observação': bill.desc || '' })); }
  function exportBillsXlsx() { const rows=billsExportRows(); if (!window.XLSX) { alert('A biblioteca de Excel não está disponível.'); return; } const sheet=XLSX.utils.json_to_sheet(rows); sheet['!cols']=[{wch:24},{wch:18},{wch:13},{wch:14},{wch:22},{wch:14},{wch:12},{wch:15},{wch:36}]; const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Calendário'); XLSX.writeFile(book,`calendario-${billMonthKey(billViewDate)}.xlsx`); logInfo('Calendário','Exportar Excel','Sucesso',`${rows.length} conta(s) exportada(s) respeitando o filtro de titular.`); }
  function exportBillsPdf() { const rows=billsExportRows(); const Pdf=window.jspdf?.jsPDF; if (!Pdf) { alert('A biblioteca de PDF não está disponível.'); return; } const doc=new Pdf({unit:'pt',format:'a4'}); const margin=36; let y=42; doc.setFont('helvetica','bold'); doc.setFontSize(17); doc.text('Calendário financeiro',margin,y); y+=22; doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.text(`Período: ${billViewDate.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}`,margin,y); doc.text(`Total de contas: ${rows.length} · Total previsto: ${fmt(rows.reduce((sum,row)=>sum+Number(row.Valor||0),0))}`,margin,y+14); y+=38; doc.setFontSize(8); rows.forEach(row=>{ if(y>760){doc.addPage();y=42;} const line=`${row['Vencimento']} · ${row['Conta/Fatura']} · ${row['Titular']||'Sem titular'} · ${fmt(row['Valor'])} · ${row['Status']}`; doc.text(doc.splitTextToSize(line,520),margin,y); y+=14; }); doc.save(`calendario-${billMonthKey(billViewDate)}.pdf`); logInfo('Calendário','Exportar PDF','Sucesso',`${rows.length} conta(s) exportada(s) respeitando o filtro de titular.`); }
  document.getElementById('billTitularFilter').addEventListener('change', renderBills);
  document.getElementById('billsStatusFilter')?.addEventListener('change', renderBills);
  document.getElementById('btnExportBillsPdf').addEventListener('click', exportBillsPdf);
  document.getElementById('btnExportBillsXlsx').addEventListener('click', exportBillsXlsx);
  document.getElementById('btnCopyBillShare').addEventListener('click', async () => { const text=document.getElementById('billShareMessage').value; try { await navigator.clipboard.writeText(text); } catch (err) { const field=document.getElementById('billShareMessage'); field.focus(); field.select(); document.execCommand('copy'); } document.getElementById('billShareStatus').textContent='Mensagem copiada. Nenhum envio foi realizado.'; logInfo('Calendário','Copiar compartilhamento','Sucesso','Mensagem individual copiada para revisão do usuário.'); });
  document.getElementById('btnNativeBillShare').addEventListener('click', async () => { const text=document.getElementById('billShareMessage').value; try { if (navigator.share) await navigator.share({title:'Lembrete de pagamento',text}); else { await navigator.clipboard.writeText(text); document.getElementById('billShareStatus').textContent='Compartilhamento nativo indisponível; mensagem copiada.'; } logInfo('Calendário','Compartilhar conta','Sucesso','Compartilhamento individual iniciado pelo usuário.'); } catch (err) { if (err?.name !== 'AbortError') document.getElementById('billShareStatus').textContent='Compartilhamento cancelado ou indisponível.'; } });


// P3.5.2 — Entrada de comprovante para leitura inteligente.
// O arquivo permanece somente em memória nesta etapa.
let receiptReaderState = null;

const RECEIPT_MAX_SIZE = 15 * 1024 * 1024;
const RECEIPT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function clearReceiptReaderState() {
  receiptReaderState = null;
  const input = document.getElementById('receiptFile');
  const status = document.getElementById('receiptFileStatus');

  if (input) input.value = '';

  if (status) {
    status.textContent = '';
    status.style.display = 'none';
  }
}

function setReceiptFileStatus(message, isError = false) {
  const status = document.getElementById('receiptFileStatus');
  if (!status) return;

  status.textContent = message;
  status.style.display = message ? 'block' : 'none';
  status.style.opacity = isError ? '1' : '.8';
}

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


// P3.5.3 — Envio multimodal do comprovante à IA (OpenRouter/MiMo).
// A IA interpreta o arquivo, mas não grava nenhum dado financeiro.
let receiptAIResponseText = '';

async function fileToReceiptGenerativePart(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        const result = String(reader.result || '');
        const base64Data = result.split(',')[1] || '';

        if (!base64Data) {
          reject(new Error('Não foi possível preparar o comprovante para análise.'));
          return;
        }

        resolve({
          type: 'image_url',
          image_url: {
            url: `data:${file.type || 'image/jpeg'};base64,${base64Data}`
          }
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Não foi possível ler o arquivo do comprovante.'));
    };

    reader.readAsDataURL(file);
  });
}

function normalizeReceiptTypeToken(value) {
  const text = String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!text) return null;

  const aliases = {
    entrada: 'entrada',
    in: 'entrada',
    credito: 'entrada',
    recebimento: 'entrada',
    recebido: 'entrada',
    deposito: 'entrada',
    saida: 'saida',
    out: 'saida',
    debito: 'saida',
    pagamento: 'saida',
    enviado: 'saida',
    sacado: 'saida',
    compra: 'saida',
    transferencia: 'transferencia'
  };

  return aliases[text] || null;
}

function normalizeHolderKey(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getAccountHolderNames() {
  const names = [];

  const add = (value) => {
    const key = normalizeHolderKey(value);
    if (key.length >= 3 && !names.includes(key)) names.push(key);
  };

  const user = typeof currentUser !== 'undefined' ? currentUser : null;

  add(user && user.displayName);
  add(user && user.email && user.email.split('@')[0]);

  return names;
}

function matchesAccountHolder(text, holderNames) {
  const value = normalizeHolderKey(text);

  if (!value || !holderNames || !holderNames.length) return false;

  return holderNames.some((name) => {
    if (value === name) return true;
    if (value.length < 5 || name.length < 5) return false;
    return value.includes(name) || name.includes(value);
  });
}

function resolveReceiptType(tipo, pagador, recebedor, holderNames) {
  if (tipo !== 'desconhecido') return tipo;
  if (!holderNames || !holderNames.length) return tipo;

  const pagadorIsOwner = matchesAccountHolder(pagador, holderNames);
  const recebedorIsOwner = matchesAccountHolder(recebedor, holderNames);

  if (pagadorIsOwner === recebedorIsOwner) return tipo;

  return pagadorIsOwner ? 'saida' : 'entrada';
}

function parseReceiptAIResult(responseText) {
  const cleaned = String(responseText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('A IA retornou um resultado que não está em JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A IA retornou uma estrutura de dados inválida.');
  }

  const allowedTypes = new Set([
    'entrada',
    'saida',
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const data = parsed.data == null ? null : String(parsed.data).trim() || null;
  const descricao =
    parsed.descricao == null
      ? null
      : String(parsed.descricao).trim() || null;
  const banco =
    parsed.banco == null
      ? null
      : String(parsed.banco).trim() || null;
  const observacoes =
    parsed.observacoes == null
      ? null
      : String(parsed.observacoes).trim() || null;

  const pagador =
    parsed.pagador == null
      ? null
      : String(parsed.pagador).trim() || null;

  const recebedor =
    parsed.recebedor == null
      ? null
      : String(parsed.recebedor).trim() || null;

  const valor =
    parsed.valor == null || parsed.valor === ''
      ? null
      : Number(parsed.valor);

  if (valor !== null && !Number.isFinite(valor)) {
    throw new Error('A IA retornou um valor financeiro inválido.');
  }

  const tipo = allowedTypes.has(parsed.tipo)
    ? parsed.tipo
    : normalizeReceiptTypeToken(parsed.tipo) || 'desconhecido';

  const confianca = allowedConfidence.has(parsed.confianca)
    ? parsed.confianca
    : 'baixa';

  return {
    data,
    valor,
    descricao,
    banco,
    tipo,
    confianca,
    observacoes,
    pagador,
    recebedor
  };
}

function normalizeReceiptAIData(aiData) {
  if (!aiData || typeof aiData !== 'object' || Array.isArray(aiData)) {
    throw new Error('Os dados do comprovante são inválidos.');
  }

  const normalizeText = (value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
  };

  const normalizeDate = (value) => {
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
  };

  const normalizeValue = (value) => {
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
  };

  const allowedTypes = new Set([
    'entrada',
    'saida',
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const data = normalizeDate(aiData.data);
  const valor = normalizeValue(aiData.valor);
  const descricao = normalizeText(aiData.descricao);
  const banco = normalizeText(aiData.banco);
  const observacoes = normalizeText(aiData.observacoes);
  const pagador = normalizeText(aiData.pagador);
  const recebedor = normalizeText(aiData.recebedor);

  const rawTipo = allowedTypes.has(aiData.tipo)
    ? aiData.tipo
    : normalizeReceiptTypeToken(aiData.tipo) || 'desconhecido';

  const tipo = resolveReceiptType(
    rawTipo,
    pagador,
    recebedor,
    getAccountHolderNames()
  );

  const tipoInferidoPeloTitular = tipo !== rawTipo;

  const confianca = allowedConfidence.has(aiData.confianca)
    ? aiData.confianca
    : 'baixa';

  const missingFields = [];

  if (!data) missingFields.push('data');
  if (valor === null) missingFields.push('valor');
  if (!descricao) missingFields.push('descricao');
  if (!banco) missingFields.push('banco');

  const warnings = [];

  if (!data && aiData.data != null) {
    warnings.push('A data identificada não pôde ser validada.');
  }

  if (valor === null && aiData.valor != null) {
    warnings.push('O valor identificado não pôde ser validado.');
  }

  if (tipo === 'desconhecido') {
    warnings.push(
      'Não foi possível identificar se é entrada ou saída. Confirme o tipo antes de salvar.'
    );
  } else if (tipoInferidoPeloTitular) {
    warnings.push(
      'O tipo da operação foi inferido pelo nome do titular — confirme antes de salvar.'
    );
  }

  if (confianca === 'baixa') {
    warnings.push('A leitura do comprovante possui baixa confiança.');
  }

  return {
    data,
    valor,
    descricao,
    banco,
    tipo,
    confianca,
    observacoes,
    pagador,
    recebedor,
    missingFields,
    warnings,
    isValid: missingFields.length === 0
  };
}


// P3.5.6 — Correspondência do banco identificado pela IA com uma conta local.
// Esta função somente identifica um banco existente; não cria nem altera registros.
function matchReceiptBank(rawBank) {
  const raw = String(rawBank || '').trim();

  if (!raw) {
    return {
      raw: '',
      id: '',
      name: '',
      confidence: 0
    };
  }

  const match = findImportMatch(raw, banks);

  return {
    raw,
    id: match?.id || '',
    name: match?.name || '',
    confidence: Number(match?.confidence || 0)
  };
}


function classifyReceiptBankMatch(bankMatch) {
  if (!bankMatch || !bankMatch.id) {
    return {
      status: 'not_found',
      label: 'Banco não encontrado',
      canSuggest: false,
      requiresConfirmation: true
    };
  }

  if (bankMatch.confidence >= 1) {
    return {
      status: 'exact',
      label: 'Correspondência exata',
      canSuggest: true,
      requiresConfirmation: false
    };
  }

  if (bankMatch.confidence >= 0.7) {
    return {
      status: 'partial',
      label: 'Correspondência parcial',
      canSuggest: true,
      requiresConfirmation: true
    };
  }

  return {
    status: 'uncertain',
    label: 'Correspondência incerta',
    canSuggest: false,
    requiresConfirmation: true
  };
}


function findReceiptDuplicate(normalizedData, bankMatch) {
  if (!normalizedData || !bankMatch?.id) {
    return {
      found: false,
      entry: null
    };
  }

  const typeMap = {
    entrada: 'in',
    saida: 'out'
  };

  const type = typeMap[normalizedData.tipo];

  if (!type || !normalizedData.data || normalizedData.valor === null) {
    return {
      found: false,
      entry: null
    };
  }

  const description = String(normalizedData.descricao || '').trim();

  if (!description) {
    return {
      found: false,
      entry: null
    };
  }

  const possibleDuplicate = entries.find(entry =>
    entry.date === normalizedData.data &&
    entry.bank === bankMatch.id &&
    entry.type === type &&
    Math.abs(Number(entry.amount) - Number(normalizedData.valor)) < 0.005 &&
    String(entry.desc || '').trim().toLocaleLowerCase('pt-BR') ===
      description.toLocaleLowerCase('pt-BR')
  );

  return {
    found: Boolean(possibleDuplicate),
    entry: possibleDuplicate || null
  };
}

function applyReceiptToLaunchForm() {
  const data = receiptReaderState?.normalizedData;

  if (!data) {
    setReceiptFileStatus(
      'Não há dados normalizados do comprovante para preencher o lançamento.',
      true
    );
    return false;
  }

  const dateInput = document.getElementById('fData');
  const descInput = document.getElementById('fDesc');
  const bankSelect = document.getElementById('fBanco');
  const categorySelect = document.getElementById('fCategoria');

  if (dateInput) {
    dateInput.value = data.data || '';
  }

  if (descInput) {
    descInput.value = data.descricao || '';
  }

  if (data.valor !== null) {
    setMoneyInput('fValor', data.valor);
  } else {
    setMoneyInput('fValor', '');
  }

  if (bankSelect) {
    const bankMatch = receiptReaderState?.bankMatch;

    if (bankMatch?.id && banks.some(bank => bank.id === bankMatch.id)) {
      bankSelect.value = bankMatch.id;
    } else {
      bankSelect.value = '';
    }
  }

  if (categorySelect) {
    const suggestedCategoryId =
      data.descricao
        ? suggestCategoryForDescription(data.descricao)
        : '';

    if (
      suggestedCategoryId &&
      categories.some(category => category.id === suggestedCategoryId)
    ) {
      categorySelect.value = suggestedCategoryId;
    } else {
      categorySelect.value = '';
    }
  }

  if (data.tipo === 'entrada') {
    document.getElementById('tglIn')?.click();
  } else if (data.tipo === 'saida') {
    document.getElementById('tglOut')?.click();
  }

  const warnings = [...(data.warnings || [])];

  if (data.tipo === 'transferencia') {
    warnings.push(
      'Este documento parece uma transferência entre contas. Use o fluxo de transferências ou confirme o tipo.'
    );
  }

  if (!data.data) {
    warnings.push('A data não foi identificada pela IA. Preencha a data manualmente.');
  }

  if (!data.banco) {
    warnings.push('O comprovante não traz banco identificável. Escolha a conta manualmente.');
  } else if (receiptReaderState?.bankMatchStatus?.status === 'not_found') {
    warnings.push('O banco identificado pela IA não foi encontrado nas contas cadastradas.');
  } else if (receiptReaderState?.bankMatchStatus?.status === 'partial') {
    warnings.push('O banco foi encontrado por correspondência parcial. Revise antes de salvar.');
  }

  if (receiptReaderState?.duplicate?.found) {
    warnings.push('Foi encontrado um lançamento possivelmente duplicado. Revise antes de salvar.');
  }

  const warningText = warnings.length
    ? ` · Atenção: ${warnings.join(' ')}`
    : '';

  const quota = window.LivroCaixaAI?.getQuota();
  const quotaNote = !quota
    ? ''
    : quota.remaining <= 0
      ? ` Limite diário de leituras de IA atingido (${quota.limit}/dia).`
      : quota.remaining <= 5
        ? ` Leituras de IA hoje: ${quota.remaining} de ${quota.limit} restantes.`
        : '';

  setReceiptFileStatus(
    `Comprovante aplicado ao formulário. Revise os dados antes de salvar.${warningText}${quotaNote}`,
    warnings.length > 0 || Boolean(quota && quota.remaining <= 0)
  );

  return true;
}

async function runReceiptAIAnalysis() {
  const button = document.getElementById('btnReadReceipt');

  if (!receiptReaderState?.file) {
    setReceiptFileStatus('Selecione um comprovante antes de iniciar a leitura.', true);
    return;
  }

  if (!window.LivroCaixaAI?.isReady()) {
    setReceiptFileStatus(
      'Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para ler comprovantes.',
      true
    );
    alert('Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para usar a leitura de comprovantes.');
    return;
  }

  const file = receiptReaderState.file;

  if (file.type.startsWith('image/') && file.size > 7 * 1024 * 1024) {
    setReceiptFileStatus(
      'Imagem muito grande para leitura multimodal. Use uma imagem de até 7 MB.',
      true
    );
    alert('Para imagens, use um arquivo de até 7 MB.');
    return;
  }

  const originalButtonText = button?.textContent || 'Ler comprovante com IA';

  try {
    receiptAIResponseText = '';

    if (button) {
      button.disabled = true;
      button.textContent = 'Lendo comprovante…';
    }

    setReceiptFileStatus(
      `Enviando ${file.name} para análise inteligente…`
    );

    const filePart = await fileToReceiptGenerativePart(file);

    const holderUser = typeof currentUser !== 'undefined' ? currentUser : null;
    const holderLabel =
      (holderUser && (holderUser.displayName || holderUser.email)) || 'não informado';

    const prompt = `
Analise o comprovante financeiro anexado.

Titular desta conta: ${holderLabel}.

Nesta etapa, faça somente a leitura e interpretação do documento.
NÃO grave, altere ou execute nenhum lançamento financeiro.
NÃO invente informações ausentes.
NÃO presuma dados que não estejam visíveis no comprovante.
Quando um campo não puder ser identificado com segurança, use null.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem blocos de código e sem texto antes ou depois.

Use exatamente esta estrutura:

{
  "data": null,
  "valor": null,
  "descricao": null,
  "banco": null,
  "pagador": null,
  "recebedor": null,
  "tipo": null,
  "confianca": null,
  "observacoes": null
}

Regras:
- "data": data da operação. SEMPRE preencha quando existir QUALQUER data visível no comprovante (data de emissão, data da transação, data/hora). Converta sempre para YYYY-MM-DD. Exemplos: "24/09/2026" ou "24-09-2026" → "2026-09-24"; "2026-09-24" mantenha; "24 de setembro de 2026" → "2026-09-24". Use null somente se o documento não tiver nenhuma data.
- "valor": valor numérico da operação, sem símbolo de moeda, quando identificável.
- "descricao": estabelecimento, pessoa ou descrição principal do comprovante.
- "banco": banco ou instituição identificada no documento.
- "pagador": nome ou conta de quem paga/envia o dinheiro, quando visível no documento. Caso contrário null.
- "recebedor": nome ou conta de quem recebe o dinheiro, quando visível no documento. Caso contrário null.
- "tipo": use somente "entrada", "saida", "transferencia" ou "desconhecido". Siga esta ordem de decisão:
  1. O titular acima aparece como recebedor → "entrada".
  2. O titular acima aparece como pagador → "saida".
  3. Sem o titular no documento: "recebido", "crédito", "recebimento", "depositado" → "entrada"; "enviado", "pagamento", "débito", "saída", "cobrança", "compra" → "saida".
  4. Movimentação entre contas do mesmo titular → "transferencia".
  5. Nenhum desses sinais → "desconhecido".
- "confianca": use somente "alta", "media" ou "baixa".
- "observacoes": informações relevantes que não caibam nos demais campos.
- Se houver dúvida relevante sobre qualquer campo, prefira null.
- Não transforme a interpretação em um lançamento financeiro.
- Não execute nenhuma ação no aplicativo.
`;

    const responseText = await window.LivroCaixaAI.generate({
      prompt,
      imagePart: filePart,
      maxTokens: 500
    });

    if (!responseText) {
      throw new Error('A IA não retornou uma resposta utilizável.');
    }

    const receiptAIData = parseReceiptAIResult(responseText);
    const normalizedReceiptData = normalizeReceiptAIData(receiptAIData);
    const matchedReceiptBank = matchReceiptBank(normalizedReceiptData.banco);
    const receiptBankMatch = classifyReceiptBankMatch(matchedReceiptBank);
    const receiptDuplicate = findReceiptDuplicate(
      normalizedReceiptData,
      matchedReceiptBank
    );

    receiptAIResponseText = responseText;

    if (receiptReaderState) {
      receiptReaderState.aiText = responseText;
      receiptReaderState.aiData = receiptAIData;
      receiptReaderState.normalizedData = normalizedReceiptData;
      receiptReaderState.bankMatch = matchedReceiptBank;
      receiptReaderState.bankMatchStatus = receiptBankMatch;
      receiptReaderState.duplicate = receiptDuplicate;
      receiptReaderState.aiStatus = 'completed';
    }

    if (applyReceiptToLaunchForm()) {
      openModal('panelNovo');
    }



  } catch (error) {
    receiptAIResponseText = '';

    if (receiptReaderState) {
      receiptReaderState.aiText = '';
      receiptReaderState.aiStatus = 'error';
    }

    console.error('P3.5.3 — Erro na leitura inteligente do comprovante:', error);

    setReceiptFileStatus(
      `Não foi possível ler o comprovante: ${error?.message || 'erro desconhecido'}`,
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }
}

function openNewEntryModal() {
    if (banks.length === 0) {
      alert('Cadastre pelo menos um banco antes de fazer lançamentos.');
      openModal('panelBanco');
      return;
    }
    editingEntryId = null;
    clearReceiptReaderState();
    document.getElementById('panelNovoTitle').innerHTML = 'Novo lançamento <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('fSalvar').textContent = 'Salvar';
    document.getElementById('fDesc').value = '';
    setMoneyInput('fValor', 0);
    document.getElementById('fData').value = todayISO();
    openModal('panelNovo');
}


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
    if (!cards.filter(c => c.active !== false).length && !id) { alert('Cadastre pelo menos um cartão ativo antes de registrar uma compra.'); return; }
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
  let purchaseCalcMode = 'installment'; // 'installment' = parcela dirige o total; 'total' = total dirige a parcela
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
  document.getElementById('purchaseInstallmentValue').addEventListener('input', () => { purchaseCalcMode = 'installment'; recalcTotalFromInstallment(); });
  document.getElementById('purchaseValue').addEventListener('input', () => { if (document.getElementById('purchaseType')?.value === 'parcelado') { purchaseCalcMode = 'total'; recalcInstallmentFromTotal(); } });
  document.getElementById('purchaseInstallments').addEventListener('input', recalcFromCount);
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
  window.recordInvoicePayment = async function(cardId, closingPeriodKey, titular, totalAmount, paymentAmount) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const amount = Number(paymentAmount);
    if (!(amount > 0)) { alert('Informe um valor de pagamento válido.'); return; }
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
        alert('Informe um valor de pagamento válido.');
      } else if (validation.reason === 'empty_invoice') {
        alert('Não há saldo de fatura para este titular.');
      } else if (validation.reason === 'payment_exceeds_titular_invoice') {
        alert(`O valor não pode ser maior que o restante (${fmt(validation.remaining)}).`);
      } else {
        alert('Não foi possível validar este pagamento.');
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
      alert('Não foi possível registrar esse pagamento agora. Verifique sua conexão e tente novamente.');
    } finally {
      render(); renderBills();
    }
  };
  window.launchInvoiceTitular = function(cardId, closingPeriodKey, titular, amount) {
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
    window.recordInvoicePayment(
      cardId,
      closingPeriodKey,
      titular,
      amount,
      remaining
    );
  };
  window.toggleInvoicePartialForm = function(rowId) {
    const box = document.getElementById('partial-form-' + rowId);
    if (!box) return;
    const opening = box.style.display === 'none' || !box.style.display;
    box.style.display = opening ? 'flex' : 'none';
    if (opening) { const input = box.querySelector('input[data-money]'); if (input) { setMoneyInput(input.id, 0); setTimeout(() => input.focus(), 30); } }
  };
  window.confirmInvoicePartial = function(cardId, closingPeriodKey, titular, totalAmount, inputId) {
    const amount = readMoneyInput(inputId);
    window.recordInvoicePayment(cardId, closingPeriodKey, titular, totalAmount, amount);
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

  // V.19-14 — marcar fatura de cartão como paga SEM lançar no Livro-Caixa
  function invoiceMarkedPaidOnly(cardId, closingPeriodKey, titular) {
    const launch = invoiceLaunchFor(cardId, closingPeriodKey, titular);
    return !!(launch && launch.markedPaidOnly);
  }
  async function markInvoicePaidOnly(cardId, closingPeriodKey, titular, totalAmount) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
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
      alert('Esta fatura já foi lançada no Livro-Caixa.');
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
      alert('Não foi possível salvar. Tente novamente.');
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
      alert('Não foi possível atualizar. Tente novamente.');
    } finally {
      renderBills();
      renderCards();
      renderNotifications();
    }
  }
  window.markInvoicePaidOnly = markInvoicePaidOnly;
  window.unmarkInvoicePaidOnly = unmarkInvoicePaidOnly;

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
  const cardInvoiceSelection = {};

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
  const purchasesUiState = { expanded: new Set(), doneOpen: new Set() };
  window.togglePurchaseDetail = (btn, cardId) => {
    const open = btn.closest('.credit-card-purchases').classList.toggle('is-expanded');
    if (open) purchasesUiState.expanded.add(cardId); else purchasesUiState.expanded.delete(cardId);
  };
  window.togglePurchaseDone = (cardId, open) => {
    if (open) purchasesUiState.doneOpen.add(cardId); else purchasesUiState.doneOpen.delete(cardId);
  };

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
    const parcel = p.paymentType === 'parcelado' ? `${p.totalInstallments}× de ${fmt(p.installmentValue)}` : 'À vista';
    const concluded = purchaseIsConcluded(p, concludedMap);
    const statusBadge = concluded ? '<span class="purchase-status finalizada">✓ Finalizada</span>' : (p.status === 'parcial' ? '<span class="purchase-status parcial">⏳ Parcial</span>' : '<span class="purchase-status pendente">⏳ Pendente</span>');
    const finalizeBtn = !concluded ? `<button type="button" class="action-btn beta-icon-button finalize" onclick="finalizePurchase('${p.id}')" aria-label="Marcar como finalizada" title="Marcar como finalizada"><i class="fi fi-rr-check" aria-hidden="true"></i></button>` : '';
    const reopenBtn = concluded ? `<button type="button" class="action-btn beta-icon-button unarchive" onclick="unarchivePurchase('${p.id}')" aria-label="Reabrir compra" title="Reabrir compra"><i class="fi fi-rr-refresh" aria-hidden="true"></i></button>` : '';
    return `<div class="credit-card-purchase-row ${concluded ? 'is-finalized' : ''}">
      <span class="credit-card-purchase-dot" aria-hidden="true"></span>
      <div class="credit-card-purchase-main">
        <strong>${escapeHTML(p.description || 'Compra sem descrição')}</strong>
        <span>${(p.date || '').split('-').reverse().join('/')} · ${escapeHTML(p.titular || 'Sem titular')}</span>
        <span class="credit-card-purchase-parcel">${parcel}</span>
      </div>
      ${statusBadge}
      <strong class="credit-card-purchase-value">${fmt(p.totalValue)}</strong>
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
  const cardHeroState = { index: 0, started: false, bound: false, dragging: false, startX: 0, delta: 0, width: 0, key: '' };
  const cardHeroClampIndex = i => Math.max(0, Math.min(cards.length - 1, i));

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
  window.deleteCard = async id => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const linked = purchases.filter(p => p.cardId === id);
    const msg = linked.length
      ? `Excluir o cartão "${card.name}" e ${linked.length} compra(s) vinculada(s)?\n\nLançamentos já feitos no Livro-Caixa não serão apagados.`
      : `Excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`;
    if (!confirm(msg)) return;
    const prevCards = cards.slice();
    const prevPurchases = purchases.slice();
    cards = cards.filter(c => c.id !== id);
    purchases = purchases.filter(p => p.cardId !== id);
    try {
      await persistAll();
      renderCards();
      renderBills();
      logInfo('Cartões', 'Excluir cartão', 'Sucesso', `${card.name} excluído (${linked.length} compra(s) removida(s)).`);
    } catch (err) {
      cards = prevCards;
      purchases = prevPurchases;
      logSyncError('exclusão de cartão', err);
      renderCards();
      alert('Não foi possível excluir o cartão.');
    }
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

  function openNewCardModal() { openCardModal(); }
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
  };

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
  };

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

  /* V.20-01 — o corpo do salvamento foi extraído para função nomeada,
     com comportamento IDÊNTICO ao handler anterior, para que a revisão de
     anexo reutilize o MESMO fluxo de criação de movimentação: validação,
     cálculo, saldo, persistência, eventos e tratamento de erro.
     Nenhuma segunda implementação de movimentação foi criada. */
  async function saveMovementFromForm() {
    const btn = document.getElementById('fSalvar');
    const dateInput = document.getElementById('fData').value;

    if (receiptReaderState?.aiStatus === 'completed' && !dateInput) {
      alert('A data do comprovante não foi identificada. Informe a data antes de salvar.');
      return false;
    }

    const date = dateInput || todayISO();
    const desc = document.getElementById('fDesc').value.trim();
    const bank = document.getElementById('fBanco').value;
    const category = document.getElementById('fCategoria').value;
    const valor = readMoneyInput('fValor');

    if (!desc || isNaN(valor) || valor <= 0) {
      alert('Preencha a descrição e um valor válido.');
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
        entries[idx] = { id: editingEntryId, date, desc, bank, category, amount: valor, type: currentType };
      }
      editingEntryId = null;
    } else {
      entries.push({ id: 'e' + Date.now() + Math.random().toString(36).slice(2, 7), date, desc, bank, category, amount: valor, type: currentType });
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
  document.getElementById('fSalvar').onclick = saveMovementFromForm;

  /* ==================================================================
     V.20-01 — ANEXOS DA LIA · LEITURA/OCR · REVISÃO OBRIGATÓRIA

     Pipeline transacional obrigatório (nenhuma etapa, isoladamente,
     cria movimentação):

       arquivo → validação → leitura/OCR → extração estruturada →
       normalização → interpretação pela LIA → preview → revisão e
       edição do usuário → confirmação explícita → validação final →
       fluxo EXISTENTE de criação (saveMovementFromForm)

     A LIA conversa apenas com globalThis.LivroCaixaOCR (contrato estável).
     Nenhum código aqui conhece Android, Capacitor ou plugin nativo.
     ================================================================== */

  const ocrState = { attachment: null, model: null, controller: null, busy: false, confirming: false, openedTransfer: false, sameHolder: null };

  /* Proposta de movimentação exibida no chat como comprovante (estilo
     Itaú/WhatsApp): nasce da leitura de anexo OU de texto digitado,
     aguarda confirmação na conversa e vira comprovante final. Snapshot
     próprio (linhas/valor prontos) — não entra no session do chat nem
     no contexto enviado à IA. */
  const chatProposal = {
    source: null, status: null, kind: null, rows: [], amount: null,
    attachmentId: null, data: null, error: null, saving: false
  };

  function chatProposalClear() {
    chatProposal.source = null;
    chatProposal.status = null;
    chatProposal.kind = null;
    chatProposal.rows = [];
    chatProposal.amount = null;
    chatProposal.attachmentId = null;
    chatProposal.data = null;
    chatProposal.error = null;
    chatProposal.saving = false;
  }

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
  const OCR_FIELD_ORDER = ['date', 'amount', 'description', 'type', 'category', 'account', 'merchant', 'paymentMethod', 'documentNumber'];
  /* Exibidos na revisão mas SEM campo equivalente no modelo de movimentação:
     são informações do documento, nunca persistidas. */
  const OCR_READ_ONLY_FIELDS = ['merchant', 'paymentMethod', 'documentNumber'];

  function ocrShowNotice(id, text, kind) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!text) { el.hidden = true; el.textContent = ''; el.classList.remove('is-error'); return; }
    el.textContent = text;
    el.hidden = false;
    el.classList.toggle('is-error', kind === 'error');
  }
  const ocrAttachmentNotice = (text, kind) => ocrShowNotice('liaAttachmentNotice', text, kind);
  const ocrReviewNotice = (text, kind) => ocrShowNotice('ocrReviewNotice', text, kind);

  function ocrSetFallback(visible) {
    const row = document.getElementById('liaAttachmentFallback');
    if (row) row.hidden = !visible;
  }

  function ocrFileErrorMessage(code) {
    const map = {
      TOO_LARGE: 'Arquivo maior que o limite permitido.',
      INVALID_FILE: 'Arquivo inválido ou vazio.',
      UNSUPPORTED_FILE: 'Formato não suportado. Use JPG, PNG, WEBP ou PDF.',
      DUPLICATE: 'Este anexo já está na fila de processamento.',
      LIMIT_REACHED: 'Limite de anexos por operação atingido.'
    };
    return map[code] || 'Não foi possível usar este arquivo.';
  }

  function ocrReadErrorMessage(status) {
    const map = {
      UNAVAILABLE: 'A leitura do anexo está indisponível no momento.',
      NOT_IMPLEMENTED: 'Este formato ainda não pode ser lido. Use uma imagem JPG, PNG ou WEBP.',
      TIMEOUT: 'O tempo máximo de leitura foi atingido.',
      CANCELLED: 'Leitura cancelada.',
      PERMISSION_DENIED: 'Permissão negada pelo dispositivo.',
      UNSUPPORTED_PLATFORM: 'Este ambiente não suporta a leitura de anexos.',
      TOO_LARGE: 'A imagem é grande demais para leitura (máx. 7 MB).',
      INVALID_FILE: 'O arquivo selecionado é inválido.',
      UNSUPPORTED_FILE: 'Formato não suportado.',
      DUPLICATE: 'Este anexo já foi processado.'
    };
    return map[status] || 'Não foi possível ler o anexo.';
  }

  function ocrDependenciesReady() {
    return !!(globalThis.LivroCaixaOCRLimits && globalThis.LivroCaixaOCRLog &&
      globalThis.LivroCaixaAttachments && globalThis.LivroCaixaExtract &&
      globalThis.LivroCaixaOCR && globalThis.LivroCaixaOCRLia && globalThis.LivroCaixaReview);
  }

  /* Libera Blob/File/ObjectURL e zera o estado — usado em conclusão,
     cancelamento, erro e fechamento do painel. Idempotente. */
  function ocrReleaseAll() {
    if (ocrState.controller) {
      try { ocrState.controller.abort(); } catch (err) { /* abort é best-effort */ }
      ocrState.controller = null;
    }
    if (ocrState.attachment) {
      try { globalThis.LivroCaixaAttachments.manager.release(ocrState.attachment.id); } catch (err) { /* best-effort */ }
      ocrState.attachment = null;
    } else {
      try { globalThis.LivroCaixaAttachments.manager.releaseAll(); } catch (err) { /* best-effort */ }
    }
    ocrState.model = null;
    ocrState.busy = false;
    ocrState.openedTransfer = false;
    ocrState.sameHolder = null;
    const input = document.getElementById('liaAttachmentFile');
    if (input) input.value = '';
    const chip = document.getElementById('liaAttachmentChip');
    if (chip) { chip.hidden = true; chip.textContent = ''; }
    const attachBtn = document.getElementById('btnLiaAttach');
    if (attachBtn) attachBtn.disabled = false;
    /* Comprovante confirmado fica no chat como histórico final; uma
       proposta pendente é descartada junto com o anexo. */
    if (chatProposal.status !== 'confirmed') chatProposalClear();
    aiChatRender();
  }

  function ocrHolderLabel() {
    try {
      const user = typeof currentUser !== 'undefined' ? currentUser : null;
      return (user && (user.displayName || user.email)) || 'não informado';
    } catch (err) {
      return 'não informado';
    }
  }

  function ocrRenderChip() {
    const chip = document.getElementById('liaAttachmentChip');
    if (!chip) return;
    const attachment = ocrState.attachment;
    if (!attachment) { chip.hidden = true; chip.textContent = ''; return; }
    const sizeMb = (attachment.size / (1024 * 1024)).toFixed(2);
    chip.hidden = false;
    chip.innerHTML =
      '<span class="ocr-chip-name">' + escapeHTML(attachment.name) + '</span>' +
      '<span class="ocr-chip-meta">' + sizeMb + ' MB</span>' +
      '<button type="button" class="ocr-chip-remove" aria-label="Remover anexo" title="Remover">×</button>';
    const remove = chip.querySelector('.ocr-chip-remove');
    if (remove) {
      remove.addEventListener('click', () => {
        ocrReleaseAll();
        ocrSetFallback(false);
        ocrAttachmentNotice('Anexo removido. Nada foi gravado.');
      });
    }
  }

  /* ------------------------------------------- balões da revisão no chat */
  function ocrChatDisplayValue(key, field) {
    const raw = field.value;
    if (raw == null || raw === '') return null;
    if (key === 'date') {
      const parts = String(raw).split('-');
      if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
      return String(raw);
    }
    if (key === 'amount') {
      const num = Number(raw);
      return Number.isFinite(num) ? MONEY_FORMATTER.format(num) : String(raw);
    }
    if (key === 'type') {
      if (raw === 'in') return 'Entrada';
      if (raw === 'out') return 'Saída';
      return String(raw);
    }
    return String(raw);
  }

  /* Sinais já usados pelo extrator (categoria/pagamento "Transferência",
     TED, DOC, "pix enviado"): quando a leitura indica transferência, o
     balão usa o modelo "Transferência universal" e o Revisar abre
     panelTransferencia em vez do modal de revisão convencional. */
  function ocrChatIsTransfer(fields, sameHolder) {
    if (sameHolder && sameHolder.sameHolder) return true;
    if (!fields) return false;
    const transferRe = /\btransfer|\bpix enviado\b|\bted\b|\bdoc\b/i;
    const strip = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const category = fields.category ? fields.category.value : null;
    /* suggestion: "Transferência" não resolvida no catálogo zera o value,
       mas a intenção do documento continua legível ali. */
    const categoryHint = category || (fields.category && fields.category.suggestion) || null;
    if (categoryHint && strip(categoryHint) === 'transferencia') return true;
    if (categoryHint && transferRe.test(String(categoryHint))) return true;
    const payment = fields.paymentMethod ? fields.paymentMethod.value : null;
    if (payment && /transfer/i.test(String(payment))) return true;
    const desc = (fields.description && fields.description.value) || '';
    const merchant = (fields.merchant && fields.merchant.value) || '';
    return transferRe.test(String(desc) + ' ' + String(merchant));
  }

  /* ---- proposta no chat: criação a partir da leitura de anexo ---- */
  function chatProposalFromOcr() {
    const model = ocrState && ocrState.model;
    chatProposalClear();
    if (!model) return;
    const fields = model.fields || {};
    const val = (key) => {
      const field = fields[key];
      return field && field.value != null && field.value !== '' ? ocrChatDisplayValue(key, field) : null;
    };
    const isTransfer = ocrChatIsTransfer(fields, ocrState.sameHolder);
    const account = val('account');
    const isIn = !!(fields.type && fields.type.value === 'in');
    const rows = [];
    const push = (label, value) => { if (value != null && value !== '') rows.push({ label, value: String(value) }); };
    push('Data', val('date'));
    if (isTransfer) {
      /* A leitura da LIA tem UMA conta: em entrada ela é o destino,
         nos demais casos a origem — o usuário ajusta no modal. */
      push('Origem', isIn ? null : account);
      push('Destino', isIn ? account : null);
    } else {
      push('Tipo', val('type'));
      push('Banco', account);
      push('Categoria', val('category'));
    }
    push('Descrição', val('description'));
    const amountRaw = fields.amount ? fields.amount.value : null;
    const amount = Number(amountRaw);
    chatProposal.source = 'ocr';
    chatProposal.status = 'awaiting';
    chatProposal.kind = isTransfer ? 'transfer' : 'movement';
    chatProposal.rows = rows;
    chatProposal.amount = Number.isFinite(amount) && amount > 0 ? amount : null;
    chatProposal.attachmentId = (ocrState.attachment && ocrState.attachment.id)
      || (model.attachment && model.attachment.id) || null;
  }

  /* ---- proposta no chat: criação a partir de texto digitado ---- */
  function chatProposalFromText(parsed) {
    chatProposalClear();
    if (!parsed) return;
    const bank = banks.find((b) => b.id === parsed.bank);
    const category = categories.find((c) => c.id === parsed.category);
    const rows = [
      { label: 'Data', value: parsed.date },
      { label: 'Tipo', value: parsed.type === 'in' ? 'Entrada' : 'Saída' }
    ];
    if (bank) rows.push({ label: 'Banco', value: bank.name });
    if (category) rows.push({ label: 'Categoria', value: category.name });
    rows.push({ label: 'Descrição', value: parsed.desc });
    chatProposal.source = 'text';
    chatProposal.status = 'awaiting';
    chatProposal.kind = 'movement';
    chatProposal.rows = rows;
    chatProposal.amount = parsed.amount;
    chatProposal.data = {
      date: parsed.date,
      desc: parsed.desc,
      bank: bank ? bank.id : '',
      category: category ? category.id : '',
      amount: parsed.amount,
      type: parsed.type
    };
  }

  /* UM cartão-comprovante no chat (estilo Itaú/WhatsApp): status +
     anexo + valor grande + linhas "Rótulo: valor" + Confirmar/Editar/
     Descartar; depois de confirmar vira o comprovante final ✅ e fica
     como histórico. Derivado de chatProposal (fora do session do chat
     e fora do contexto enviado à IA). */
  function chatProposalParts() {
    if (!chatProposal.status) return [];
    const title = chatProposal.kind === 'transfer' ? 'Transferência universal' : 'Informações reconhecidas';
    const statusHtml = chatProposal.status === 'confirmed'
      ? '<div class="ai-ocr-status">' + (chatProposal.kind === 'transfer'
        ? '✅ Transferência registrada com sucesso'
        : '✅ Movimento lançado com sucesso') + '</div>'
      : '<div class="ai-ocr-status">✅ Dados reconhecidos — confirme para lançar</div>';

    let imageHtml = '';
    if (chatProposal.source === 'ocr' && chatProposal.attachmentId) {
      try {
        const url = globalThis.LivroCaixaAttachments.manager.previewUrl(chatProposal.attachmentId);
        if (url) imageHtml = '<img class="ai-ocr-attach" src="' + url + '" alt="Anexo lido">';
      } catch (err) { /* pré-visualização é best-effort */ }
    }

    const amountHtml = chatProposal.amount != null && chatProposal.amount > 0
      ? '<div class="ai-ocr-amount">' + escapeHTML(MONEY_FORMATTER.format(chatProposal.amount)) + '</div>'
      : '';

    const rowsHtml = chatProposal.rows.length
      ? '<div class="ai-ocr-section-title">' + escapeHTML(title) + '</div>' +
        '<div class="ai-ocr-rows">' + chatProposal.rows.map((row) =>
          '<div class="ai-ocr-row"><span class="ai-ocr-label">' + escapeHTML(row.label) + '</span>' +
          '<span class="ai-ocr-value">' + escapeHTML(String(row.value)) + '</span></div>'
        ).join('') + '</div>'
      : '<div class="ai-ocr-error">Não consegui reconhecer os dados. Toque em Editar para preencher.</div>';

    const errorHtml = chatProposal.error
      ? '<div class="ai-ocr-error">' + escapeHTML(chatProposal.error) + '</div>'
      : '';

    let actionsHtml = '';
    if (chatProposal.status === 'awaiting') {
      if (chatProposal.amount != null && chatProposal.amount > 0) {
        actionsHtml += '<button type="button" class="ai-ocr-confirm-btn" data-chat-confirm' +
          (chatProposal.saving ? ' disabled' : '') + '>' +
          (chatProposal.saving ? 'Confirmando…' : 'Confirmar') + '</button>';
      }
      actionsHtml += '<button type="button" class="ai-ocr-secondary-btn" data-chat-edit>Editar</button>' +
        '<button type="button" class="ai-ocr-secondary-btn" data-chat-discard>Descartar</button>';
    }

    return [
      '<div class="ai-chat-msg is-assistant is-ocr-summary">' +
      statusHtml + imageHtml + amountHtml + rowsHtml + errorHtml + actionsHtml +
      '</div>'
    ];
  }

  /* Confirmar: valida e grava pelo fluxo EXISTENTE de criação (mesmas
     validações, mesmo saldo, mesma persistência). Movimentação salva
     aqui mesmo — transferência apenas abre a Transferência universal
     pré-preenchida (o salvamento acontece no tSalvar, que dispara
     lc-transfer-saved). */
  async function chatProposalConfirm() {
    if (chatProposal.status !== 'awaiting' || chatProposal.saving) return;
    chatProposal.error = null;

    if (chatProposal.kind === 'transfer') {
      const canTransfer = banks.length + pockets.length + investments.length >= 2;
      if (!canTransfer) { chatProposalEdit(); return; }
      if (ocrState.model) ocrPrefillTransferForm();
      ocrState.openedTransfer = true;
      openModal('panelTransferencia');
      return;
    }

    chatProposal.saving = true;
    aiChatRender();
    try {
      if (chatProposal.source === 'ocr') {
        const model = ocrState.model;
        if (!model) {
          chatProposal.error = 'A leitura não está mais disponível. Toque em Editar para preencher.';
          return;
        }
        const bankSelect = document.getElementById('fBanco');
        const categorySelect = document.getElementById('fCategoria');
        const bankOptions = bankSelect ? Array.from(bankSelect.options).map((o) => o.value) : [];
        const categoryOptions = categorySelect ? Array.from(categorySelect.options).map((o) => o.value) : [];
        const result = globalThis.LivroCaixaReview.validate(model, { bankOptions, categoryOptions });
        if (!result.ok) {
          chatProposal.error = 'Alguns dados precisam de ajuste. Toque em Editar para revisar.';
          return;
        }
        ocrFillLaunchForm(result.value);
      } else {
        const d = chatProposal.data;
        if (!d || !(d.amount > 0) || !String(d.desc || '').trim() || !banks.some((b) => b.id === d.bank)) {
          chatProposal.error = 'Alguns dados precisam de ajuste. Toque em Editar para revisar.';
          return;
        }
        ocrFillLaunchForm(d);
      }
      const saved = await saveMovementFromForm();
      if (saved) {
        chatProposal.status = 'confirmed';
        chatProposal.error = null;
        ocrReleaseAll();
        window.LivroCaixaChat?.open?.();
      } else {
        chatProposal.error = 'O lançamento não foi concluído. Revise e tente novamente.';
      }
    } catch (err) {
      chatProposal.error = 'Falha inesperada ao confirmar. Nada foi gravado duas vezes.';
    } finally {
      chatProposal.saving = false;
      aiChatRender();
    }
  }

  /* Editar: leva ao MESMO modal de sempre — revisão da leitura (ou
     Transferência universal) para origem anexo; formulário comum já
     preenchido para origem texto. */
  function chatProposalEdit() {
    if (chatProposal.status !== 'awaiting') return;
    if (chatProposal.source === 'ocr') {
      const isTransfer = chatProposal.kind === 'transfer';
      const canTransfer = banks.length + pockets.length + investments.length >= 2;
      if (isTransfer && canTransfer && ocrState.model) {
        ocrPrefillTransferForm();
        ocrState.openedTransfer = true;
        openModal('panelTransferencia');
        return;
      }
      /* Sem dois destinos a transferência é inválida — mesma regra
         do botão manual — e a revisão convencional assume. */
      if (isTransfer && !canTransfer) {
        alert('Você precisa ter pelo menos dois destinos cadastrados para realizar transferências. Revise como movimentação comum.');
      }
      if (ocrState.model) {
        ocrRenderReview();
        ocrReviewNotice('');
        openModal('panelOcrReview');
        return;
      }
    }
    chatProposalFillManualForm();
  }

  /* Formulário comum já preenchido com o snapshot da proposta. */
  function chatProposalFillManualForm() {
    const d = chatProposal.data;
    chatProposalClear();
    openNewEntryModal();
    if (d) {
      const dateEl = document.getElementById('fData');
      if (dateEl && d.date) dateEl.value = d.date;
      const descEl = document.getElementById('fDesc');
      if (descEl) descEl.value = d.desc || '';
      const bankEl = document.getElementById('fBanco');
      if (bankEl && d.bank) bankEl.value = d.bank;
      const catEl = document.getElementById('fCategoria');
      if (catEl && d.category) catEl.value = d.category;
      setMoneyInput('fValor', d.amount || 0);
      if (d.type && currentType !== d.type) {
        const toggle = document.getElementById(d.type === 'in' ? 'tglIn' : 'tglOut');
        if (toggle) toggle.click();
      }
    }
    aiChatRender();
  }

  /* Descartar: some com o cartão; origem anexo também libera o anexo. */
  function chatProposalDiscard() {
    const wasOcr = chatProposal.source === 'ocr';
    chatProposalClear();
    if (wasOcr) ocrReleaseAll();
    else aiChatRender();
  }

  /* Pré-preenche panelTransferencia com o que a leitura da LIA tem:
     data, valor, observação e a conta lida (quando bater com um banco)
     na direção correta. Origem/destino completos ficam com o usuário —
     o modal tem o próprio "Ler comprovante com IA". */
  function ocrPrefillTransferForm() {
    const model = ocrState.model;
    if (!model) return false;
    const fields = model.fields || {};
    const dateEl = document.getElementById('tData');
    const rawDate = fields.date && fields.date.value ? String(fields.date.value) : '';
    if (dateEl) dateEl.value = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO();
    const amountRaw = fields.amount ? fields.amount.value : null;
    const amount = Number(amountRaw);
    setMoneyInput('tValor', Number.isFinite(amount) && amount > 0 ? amount : 0);
    const descEl = document.getElementById('tDesc');
    if (descEl) descEl.value = (fields.description && fields.description.value) || '';

    const deSelect = document.getElementById('tDe');
    const paraSelect = document.getElementById('tPara');
    const accountName = (fields.account && fields.account.value) || '';
    const matched = accountName ? matchTransferReceiptTarget(accountName) : null;
    const matchedBank = matched && matched.id && (banks || []).some((bank) => bank.id === matched.id)
      ? matched.id
      : '';
    if (matchedBank && deSelect && paraSelect) {
      const isIn = !!(fields.type && fields.type.value === 'in');
      const side = isIn ? paraSelect : deSelect;
      const other = isIn ? deSelect : paraSelect;
      /* Só preenche quando não colide com o outro lado (senão
         origem === destino e o salvamento é bloqueado). */
      if (other.value !== matchedBank) side.value = matchedBank;
    }
    return true;
  }

  /* ------------------------------------------------------- render preview */

  function ocrCandidatesHtml(key, field) {
    if (!field.candidates || !field.candidates.length) return '';
    if (field.status !== 'AMBIGUOUS' && field.status !== 'MISSING') return '';
    const items = field.candidates.map((candidate) => {
      const label = key === 'amount' && Number.isFinite(Number(candidate))
        ? MONEY_FORMATTER.format(Number(candidate))
        : String(candidate);
      return '<button type="button" class="ocr-candidate" data-field="' + key + '" data-value="' +
        escapeHTML(String(candidate)) + '">' + escapeHTML(label) + '</button>';
    }).join('');
    return '<div class="ocr-candidates" role="group" aria-label="Candidatos reconhecidos">' + items + '</div>';
  }

  function ocrControlHtml(key, field) {
    const id = 'ocrField_' + key;
    if (OCR_READ_ONLY_FIELDS.indexOf(key) !== -1) {
      return '<div class="ocr-readonly" id="' + id + '">' + (field.value == null ? '—' : escapeHTML(String(field.value))) + '</div>';
    }
    if (field.kind === 'date') {
      return '<input type="date" id="' + id + '" value="' + escapeHTML(field.value == null ? '' : String(field.value)) + '">';
    }
    if (field.kind === 'money') {
      return '<input type="text" id="' + id + '" inputmode="numeric" placeholder="R$ 0,00">';
    }
    if (field.kind === 'select') {
      const list = key === 'category' ? categories : banks;
      const options = list.map((item) => '<option value="' + escapeHTML(String(item.id)) + '">' + escapeHTML(String(item.name)) + '</option>').join('');
      return '<select id="' + id + '">' + options + '</select>';
    }
    if (field.kind === 'toggle') {
      return '<div class="type-toggle" id="' + id + '" role="group" aria-label="Tipo de movimentação">' +
        '<button type="button" data-type="in">Entrada</button>' +
        '<button type="button" data-type="out">Saída</button>' +
        '</div>';
    }
    return '<input type="text" id="' + id + '" value="' + escapeHTML(field.value == null ? '' : String(field.value)) + '">';
  }

  function ocrFieldHtml(key, field) {
    const style = globalThis.LivroCaixaReview.describe(field.status);
    const classes = ['ocr-field', style.className];
    if (field.edited) classes.push('is-edited');
    const note = field.persisted ? '' : '<span class="ocr-not-persisted">não é gravado</span>';
    const labelTag = OCR_READ_ONLY_FIELDS.indexOf(key) !== -1
      ? '<span class="ocr-field-label">' + escapeHTML(field.label) + note + '</span>'
      : '<label for="ocrField_' + key + '">' + escapeHTML(field.label) + note + '</label>';
    const suggestion = field.suggestion
      ? '<p class="ocr-suggestion">Sugerido na leitura: ' + escapeHTML(String(field.suggestion)) + ' — selecione a correspondente.</p>'
      : '';
    return '<div class="' + classes.join(' ') + '" data-field="' + key + '">' +
      '<div class="ocr-field-head">' + labelTag +
      '<span class="ocr-field-status">' + escapeHTML(style.label) + '</span></div>' +
      ocrControlHtml(key, field) +
      ocrCandidatesHtml(key, field) + suggestion +
      '<p class="ocr-field-error" data-error-for="' + key + '" hidden></p>' +
      '</div>';
  }

  function ocrUpdateFieldChrome(key) {
    const wrap = document.querySelector('.ocr-field[data-field="' + key + '"]');
    const field = ocrState.model && ocrState.model.fields[key];
    if (!wrap || !field) return;
    const style = globalThis.LivroCaixaReview.describe(field.status);
    wrap.className = 'ocr-field ' + style.className + (field.edited ? ' is-edited' : '');
    const badge = wrap.querySelector('.ocr-field-status');
    if (badge) badge.textContent = style.label;
    const keepCandidates = (field.status === 'AMBIGUOUS' || field.status === 'MISSING') && field.candidates && field.candidates.length;
    const cand = wrap.querySelector('.ocr-candidates');
    if (cand && !keepCandidates) cand.remove();
    /* valor preenchido → a sugestão deixa de fazer sentido */
    if (field.value != null) {
      const sg = wrap.querySelector('.ocr-suggestion');
      if (sg) sg.remove();
    }
    ocrUpdateHint();
  }

  function ocrUpdateHint() {
    const intro = document.getElementById('ocrReviewIntro');
    if (!intro || !ocrState.model) return;
    const counts = globalThis.LivroCaixaReview.summary(ocrState.model);
    const parts = [];
    if (counts.extracted) parts.push(counts.extracted + ' extraído(s)');
    if (counts.edited) parts.push(counts.edited + ' editado(s)');
    if (counts.unconfirmed) parts.push(counts.unconfirmed + ' não confirmado(s)');
    if (counts.absent) parts.push(counts.absent + ' ausente(s)');
    if (counts.invalid) parts.push(counts.invalid + ' inválido(s)');
    intro.textContent = 'Confira o que foi reconhecido. Nada é gravado até você confirmar.' +
      (parts.length ? ' (' + parts.join(', ') + ')' : '');
  }

  function ocrRenderTypeToggle() {
    const wrap = document.getElementById('ocrField_type');
    if (!wrap) return;
    const value = ocrState.model && ocrState.model.fields.type ? ocrState.model.fields.type.value : null;
    wrap.querySelectorAll('button[data-type]').forEach((btn) => {
      const active = btn.dataset.type === value;
      btn.classList.toggle('active-in', active && btn.dataset.type === 'in');
      btn.classList.toggle('active-out', active && btn.dataset.type === 'out');
    });
  }

  function ocrSelectField(key, selectEl) {
    const field = ocrState.model.fields[key];
    const list = key === 'category' ? categories : banks;
    const found = list.find((item) => String(item.id) === String(selectEl.value));
    field.resolvedId = found ? found.id : null;
    field.value = found ? found.name : null;
    field.edited = true;
    field.invalid = false;
    field.status = found ? globalThis.LivroCaixaExtract.STATUS.USER_EDITED : globalThis.LivroCaixaExtract.STATUS.MISSING;
    ocrUpdateFieldChrome(key);
  }

  function ocrBindFields() {
    const model = ocrState.model;
    if (!model) return;

    const dateEl = document.getElementById('ocrField_date');
    if (dateEl) dateEl.addEventListener('change', () => {
      globalThis.LivroCaixaReview.editField(model, 'date', dateEl.value);
      ocrUpdateFieldChrome('date');
    });

    const descEl = document.getElementById('ocrField_description');
    if (descEl) descEl.addEventListener('input', () => {
      globalThis.LivroCaixaReview.editField(model, 'description', descEl.value);
      ocrUpdateFieldChrome('description');
    });

    const amountEl = document.getElementById('ocrField_amount');
    if (amountEl) {
      amountEl.addEventListener('change', () => {
        const value = readMoneyInput(amountEl);
        globalThis.LivroCaixaReview.editField(model, 'amount', Number.isFinite(value) && value > 0 ? value : null);
        if (Number.isFinite(value) && value > 0) setMoneyInput(amountEl, value);
        ocrUpdateFieldChrome('amount');
      });
    }

    const catEl = document.getElementById('ocrField_category');
    if (catEl) catEl.addEventListener('change', () => ocrSelectField('category', catEl));
    const bankEl = document.getElementById('ocrField_account');
    if (bankEl) bankEl.addEventListener('change', () => ocrSelectField('account', bankEl));

    const typeWrap = document.getElementById('ocrField_type');
    if (typeWrap) {
      typeWrap.querySelectorAll('button[data-type]').forEach((btn) => {
        btn.addEventListener('click', () => {
          globalThis.LivroCaixaReview.editField(model, 'type', btn.dataset.type);
          ocrRenderTypeToggle();
          ocrUpdateFieldChrome('type');
        });
      });
    }

    document.querySelectorAll('#ocrReviewFields .ocr-candidate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.field;
        /* data-value chega como string: o tipo do campo é restaurado aqui
           (valor monetário NÃO pode virar string no modelo) */
        let chosen = btn.dataset.value;
        if (key === 'amount' && Number.isFinite(Number(chosen))) chosen = Number(chosen);
        globalThis.LivroCaixaReview.chooseCandidate(model, key, chosen);
        if (key === 'amount') {
          const amountEl = document.getElementById('ocrField_amount');
          const value = Number(btn.dataset.value);
          if (amountEl && Number.isFinite(value)) setMoneyInput(amountEl, value);
        }
        ocrUpdateFieldChrome(key);
        if (key === 'type') ocrRenderTypeToggle();
        if (key === 'category' || key === 'account') {
          const el = document.getElementById('ocrField_' + key);
          const field = model.fields[key];
          if (el && field && field.value) {
            const list = key === 'category' ? categories : banks;
            const found = list.find((item) => item.name === field.value);
            if (found) { el.value = found.id; field.resolvedId = found.id; }
          }
        }
        const wrap = document.querySelector('.ocr-field[data-field="' + key + '"]');
        if (wrap) {
          const cand = wrap.querySelector('.ocr-candidates');
          if (cand) cand.remove();
          const sg = wrap.querySelector('.ocr-suggestion');
          if (sg) sg.remove();
        }
      });
    });
  }

  function ocrRenderReview() {
    const model = ocrState.model;
    const box = document.getElementById('ocrReviewFields');
    if (!model || !box) return;

    const preview = document.getElementById('ocrAttachmentPreview');
    if (preview) {
      const attachment = model.attachment;
      if (!attachment) {
        preview.hidden = true;
        preview.innerHTML = '';
      } else if (attachment.category === 'image') {
        const url = globalThis.LivroCaixaAttachments.manager.previewUrl(attachment.id);
        preview.hidden = false;
        preview.innerHTML = url
          ? '<img class="ocr-preview-img" src="' + url + '" alt="Pré-visualização do anexo">'
          : '<span class="ocr-preview-file">' + escapeHTML(attachment.name) + '</span>';
      } else {
        preview.hidden = false;
        preview.innerHTML = '<span class="ocr-preview-file">' + escapeHTML(attachment.name) + '</span>';
      }
    }

    box.innerHTML = OCR_FIELD_ORDER
      .map((key) => (model.fields[key] ? ocrFieldHtml(key, model.fields[key]) : ''))
      .join('');

    const amountEl = document.getElementById('ocrField_amount');
    if (amountEl && model.fields.amount && model.fields.amount.value != null) {
      setMoneyInput(amountEl, model.fields.amount.value);
    }
    const catEl = document.getElementById('ocrField_category');
    if (catEl && model.fields.category && model.fields.category.resolvedId) catEl.value = model.fields.category.resolvedId;
    const bankEl = document.getElementById('ocrField_account');
    if (bankEl && model.fields.account && model.fields.account.resolvedId) bankEl.value = model.fields.account.resolvedId;

    ocrRenderTypeToggle();
    ocrBindFields();
    ocrUpdateHint();
  }

  function ocrShowErrors(errors) {
    const list = errors || [];
    document.querySelectorAll('#ocrReviewFields .ocr-field-error').forEach((el) => {
      el.hidden = true;
      el.textContent = '';
    });
    /* ao limpar os erros, os campos destacados voltam ao estado real */
    if (!list.length && ocrState.model) {
      OCR_FIELD_ORDER.forEach((key) => ocrUpdateFieldChrome(key));
    }
    list.forEach((err) => {
      const el = document.querySelector('[data-error-for="' + err.key + '"]');
      if (el) { el.textContent = err.message; el.hidden = false; }
      ocrUpdateFieldChrome(err.key);
    });
  }

  /* ------------------------------------------------------------- pipeline */

  async function ocrRunPipeline(attachment) {
    const manager = globalThis.LivroCaixaAttachments.manager;
    const guard = manager.beginProcessing(attachment.id);
    if (!guard.ok) {
      ocrAttachmentNotice('Este anexo já está sendo processado.', 'error');
      return;
    }

    const controller = new AbortController();
    ocrState.controller = controller;
    ocrState.busy = true;
    ocrAttachmentNotice('Lendo o anexo…');
    const attachBtn = document.getElementById('btnLiaAttach');
    if (attachBtn) attachBtn.disabled = true;

    try {
      const prompt = globalThis.LivroCaixaOCRLia.buildReadPrompt({ holderLabel: ocrHolderLabel() });
      const aiReady = !!(window.LivroCaixaAI && typeof window.LivroCaixaAI.isReady === 'function' && window.LivroCaixaAI.isReady());

      const read = await globalThis.LivroCaixaOCR.extract(attachment.file, {
        prompt,
        signal: controller.signal,
        aiReady,
        reader: async ({ signal }) => {
          const part = await fileToReceiptGenerativePart(attachment.file);
          return await window.LivroCaixaAI.generate({ prompt, imagePart: part, maxTokens: 1200, signal });
        },
        parse: globalThis.LivroCaixaOCRLia.parseReadResponse
      });

      if (!read.continuable) {
        ocrAttachmentNotice(ocrReadErrorMessage(read.status), 'error');
        ocrSetFallback(true);
        return;
      }

      const deterministic = globalThis.LivroCaixaExtract.extractFromText(read.text || '');
      const interpreted = globalThis.LivroCaixaOCRLia.interpret({
        readFields: read.fields || {},
        readCandidates: read.candidates || {},
        deterministic,
        text: read.text,
        catalog: {
          categories: categories.map((c) => ({ value: c.id, label: c.name })),
          banks: banks.map((b) => ({ value: b.id, label: b.name }))
        }
      });

      ocrState.model = globalThis.LivroCaixaReview.createModel(interpreted, {
        attachment,
        environment: read.environment,
        provider: read.provider,
        extractStatus: read.status
      });
      /* Mesmo titular nos lados De/Para (CPF/nome) é o sinal que o
         keyword-match não alcança: Pix entre contas do próprio usuário. */
      ocrState.sameHolder = globalThis.LivroCaixaExtract.detectSameHolder(read.text || '');

      ocrSetFallback(false);
      ocrAttachmentNotice('');
      /* Comprovante com os dados reconhecidos entra pelo render do chat
         antes da repintura — o modal de revisão só abre no clique em
         Editar. O status cobre NO_TEXT e os badges cobrem AMBIGUOUS. */
      chatProposalFromOcr();
      aiChatRender();
    } catch (err) {
      ocrAttachmentNotice('Não foi possível ler o anexo.', 'error');
      ocrSetFallback(true);
      globalThis.LivroCaixaOCRLog && globalThis.LivroCaixaOCRLog.failure('pipeline.erro', {
        stage: 'pipeline', status: 'falhou', code: (err && err.code) || 'UNEXPECTED'
      });
    } finally {
      ocrState.busy = false;
      manager.endProcessing(attachment.id);
      if (attachBtn) attachBtn.disabled = false;
    }
  }

  function ocrFillLaunchForm(value) {
    editingEntryId = null;
    const dateEl = document.getElementById('fData');
    const descEl = document.getElementById('fDesc');
    const bankEl = document.getElementById('fBanco');
    const catEl = document.getElementById('fCategoria');
    if (dateEl) dateEl.value = value.date;
    if (descEl) descEl.value = value.desc;
    if (bankEl && value.bank) bankEl.value = value.bank;
    if (catEl && value.category) catEl.value = value.category;
    setMoneyInput('fValor', value.amount);
    if (currentType !== value.type) {
      document.getElementById(value.type === 'in' ? 'tglIn' : 'tglOut').click();
    }
  }

  function ocrAbortReview(message) {
    ocrReleaseAll();
    ocrReviewNotice('');
    closeAllPanels();
    /* o aviso de "nada foi gravado" mora dentro da conversa: reabre-a
       para que a mensagem seja lida (é o mesmo caminho do FAB da Visão
       Geral — LivroCaixaChat.open()). */
    const text = message || 'Revisão encerrada. Nada foi gravado.';
    if (window.LivroCaixaChat && typeof window.LivroCaixaChat.open === 'function') {
      window.LivroCaixaChat.open();
    }
    ocrAttachmentNotice(text);
  }

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

  function updateInvestmentMainValue() {
    const type = document.getElementById('iTipo').value;
    if (!isCryptoType(type)) return;
    const rawInitial = parseFloat(document.getElementById('iUnidades').value) || 0;
    const initialUnits = isBitcoinType(type) ? Math.round(rawInitial) : rawInitial;
    const item = editingInvestId ? investments.find(x => x.id === editingInvestId) : null;
    const movementTotal = item ? cryptoMovementTotal(item) : 0;
    const finalUnits = Math.max(0, initialUnits + movementTotal);
    const finalInput = document.getElementById('iUnidadesAtual');
    if (finalInput) finalInput.value = isBitcoinType(type) ? Math.round(finalUnits) : finalUnits;
    const price = readMoneyInput('iCotacao');
    setMoneyInput('iValor', finalUnits > 0 && price > 0 ? cryptoValueFromUnits(type, finalUnits, price) : 0);
  }

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
        investments[idx] = { id: editingInvestId, createdAt: old.createdAt, order: old.order, priceHistory: old.priceHistory, ...record };
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
  };

  function openNewPocketModal() {
    editingPocketId = null;
    document.getElementById('pNome').value = '';
    document.getElementById('pObjetivo').value = '';
    setMoneyInput('pMetaValor', 0);
    renderBankSelects();
    document.getElementById('pBancoOrigem').value = '';
    setMoneyInput('pInicial', 0);
    setMoneyInput('pAtual', 0);
    document.getElementById('panelPocketTitle').innerHTML = 'Nova Caixinha <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('pSalvar').textContent = 'Salvar Caixinha';
    openModal('panelPocket');
  };

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

  /* Conciliação com a corretora: compara a quantidade informada pela corretora
     com o saldo derivado das movimentações e grava UM lançamento de ajuste.
     Não altera cotação, priceHistory nem lastQuoteAt — preço é dado do ativo. */
  let cryptoReconcileTarget = null;
  window.openCryptoReconcileModal = function(id) {
    const item = investments.find(x => x.id === id);
    if (!item || !isCryptoType(item.type)) return;
    cryptoReconcileTarget = item.id;
    const isBtc = isBitcoinType(item.type);
    document.getElementById('panelCryptoReconcileTitle').innerHTML = `Conciliar — ${escapeHTML(item.alias || item.name)} <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>`;
    document.getElementById('panelCryptoReconcileHint').textContent =
      `Informe a quantidade total que consta na corretora. A diferença em relação ao saldo atual (${formatCryptoUnits(item.type, cryptoCurrentUnits(item), item.name)}) vira um lançamento de ajuste.`;
    const input = document.getElementById('crSaldoReal');
    document.getElementById('crSaldoRealLabel').textContent = isBtc ? 'Saldo na corretora (SAT)' : 'Saldo na corretora (quantidade)';
    input.step = isBtc ? '1' : '0.00000001';
    input.value = '';
    updateCryptoReconcilePreview();
    openModal('panelCryptoReconcile');
    setTimeout(() => input.focus(), 80);
  };
  function cryptoReconcileNumbers() {
    const item = investments.find(x => x.id === cryptoReconcileTarget);
    if (!item) return null;
    const raw = parseFloat(document.getElementById('crSaldoReal').value);
    const current = cryptoCurrentUnits(item);
    if (!isFinite(raw) || raw < 0) return { item, current, informed: null, diff: null };
    const informed = isBitcoinType(item.type) ? Math.round(raw) : Number(raw.toFixed(8));
    return { item, current, informed, diff: Number((informed - current).toFixed(8)) };
  }
  function updateCryptoReconcilePreview() {
    const box = document.getElementById('crPreview');
    const ctx = cryptoReconcileNumbers();
    if (!ctx || !box) return;
    const { item, current, informed, diff } = ctx;
    if (informed == null) {
      box.textContent = `Saldo atual: ${formatCryptoUnits(item.type, current, item.name)}`;
      return;
    }
    if (diff === 0) {
      box.innerHTML = `Saldo atual: <b>${formatCryptoUnits(item.type, current, item.name)}</b><br>Sem diferença — nada a conciliar.`;
      return;
    }
    const kind = diff > 0 ? 'rendimento' : 'resgate';
    box.innerHTML = `Saldo atual: <b>${formatCryptoUnits(item.type, current, item.name)}</b><br>`
      + `Saldo informado: <b>${formatCryptoUnits(item.type, informed, item.name)}</b><br>`
      + `Diferença: <b>${diff > 0 ? '+' : '−'}${formatCryptoUnits(item.type, Math.abs(diff), item.name)}</b> → ${movementKindLabel(kind)}`;
  }
  document.getElementById('crSaldoReal')?.addEventListener('input', updateCryptoReconcilePreview);
  document.getElementById('crConfirmar').onclick = async () => {
    const ctx = cryptoReconcileNumbers();
    if (!ctx) return;
    const { item, informed, diff } = ctx;
    if (informed == null) { alert('Informe um saldo válido na corretora.'); return; }
    if (diff === 0) { alert('O saldo informado já confere com o saldo atual.'); return; }
    const units = Math.abs(diff);
    const kind = diff > 0 ? 'rendimento' : 'resgate';
    const price = Number(item.price) || 0;
    const amount = cryptoValueFromUnits(item.type, units, price);
    const operation = beginLogOperation('Investimentos', `Conciliação — ${movementKindLabel(kind)}`);
    logInfo('Investimentos', 'Conciliação', 'Em andamento', `Ajuste de ${formatCryptoUnits(item.type, units, item.name)} iniciado para ${item.name}.`, null, operation);
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
    render();
    try {
      await persistAll(operation);
      logInfo('Investimentos', 'Conciliação', 'Sucesso', `Ajuste de conciliação aplicado em ${item.name}.`, { kind, units }, operation);
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

  let pendingPricePoint = null;

  function upsertPriceHistory(inv, point) {
    if (!inv) return;
    if (!Array.isArray(inv.priceHistory)) inv.priceHistory = [];
    const date = String(point.date || todayISO());
    const index = inv.priceHistory.findIndex(item => item && item.date === date);
    const normalized = { ...point, date };
    if (index >= 0) inv.priceHistory[index] = { ...inv.priceHistory[index], ...normalized };
    else inv.priceHistory.push(normalized);
    inv.priceHistory.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }

  async function persistInvestmentQuote(inv, quote, source='manual', operation = null) {
    if (!inv || !isCryptoType(inv.type) || !(Number(quote)>0)) return false;
    const units = cryptoCurrentUnits(inv);
    inv.price = Number(quote);
    inv.value = cryptoValueFromUnits(inv.type, units, inv.price);
    inv.lastQuoteAt = new Date().toISOString();
    inv.quoteSource = source === 'api' ? 'api' : 'manual';
    upsertPriceHistory(inv, { date: todayISO(), price: inv.price, units, value: inv.value, source });
    await saveInvestments(operation);
    return true;
  }

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

  async function fetchCoinMatch(nameQuery) {
    const searchRes = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(nameQuery));
    if (!searchRes.ok) throw new Error(`CoinGecko search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    return searchData.coins && searchData.coins[0];
  }

  async function fetchCoinPriceBRL(coinId) {
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + coinId + '&vs_currencies=brl');
    if (!priceRes.ok) throw new Error(`CoinGecko price HTTP ${priceRes.status}`);
    const priceData = await priceRes.json();
    return priceData[coinId] && priceData[coinId].brl;
  }

  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const QUOTE_STALE_MS = 6 * 60 * 60 * 1000; // 6h — saldo usa última cotação salva até então
  function investmentQuoteIsStale(inv) {
    if (!inv || !isCryptoType(inv.type) || cryptoCurrentUnits(inv) <= 0) return false;
    const ts = Date.parse(inv.lastQuoteAt || '');
    return !Number.isFinite(ts) || Date.now() - ts >= QUOTE_STALE_MS;
  }
  async function refreshStaleInvestmentQuotes() {
    if (!currentUser) return;
    const stale = investments.filter(investmentQuoteIsStale);
    if (!stale.length) return;
    try { await updateAllInvestmentPrices({ auto:true, requestedCandidates:stale }); } catch (err) { logSyncError('atualização de cotações desatualizadas', err); }
  }


  function applyCachedQuotesToInvestments() {
    try {
      const raw = localStorage.getItem('lc_last_quotes');
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.items)) return;
      const byId = Object.fromEntries(snap.items.map(x => [x.id, x]));
      investments.forEach(inv => {
        if (!isCryptoType(inv.type)) return;
        const c = byId[inv.id];
        if (!c) return;
        const remoteTs = Date.parse(inv.lastQuoteAt || '') || 0;
        const cacheTs = Date.parse(c.lastQuoteAt || '') || 0;
        // usa cache se não tem cotação remota ou se cache é mais recente
        if (!inv.lastQuoteAt || cacheTs >= remoteTs) {
          if (Number(c.price) > 0) inv.price = Number(c.price);
          if (Number(c.value) >= 0) inv.value = Number(c.value);
          if (c.lastQuoteAt) inv.lastQuoteAt = c.lastQuoteAt;
          if (c.quoteSource) inv.quoteSource = c.quoteSource;
          if (c.coinGeckoId) inv.coinGeckoId = c.coinGeckoId;
        }
      });
    } catch (_) {}
  }

  async function updateAllInvestmentPrices({ auto = false, requestedCandidates = null } = {}) {
    const statusEl = document.getElementById('updateAllStatus');
    const btn = document.getElementById('btnUpdateAllPrices');
    const candidates = Array.isArray(requestedCandidates) ? requestedCandidates : investments.filter(inv => isCryptoType(inv.type) && cryptoCurrentUnits(inv) > 0);
    if (candidates.length === 0) {
      statusEl.textContent = 'Nenhum ativo com unidades cadastradas para atualizar automaticamente (ativos sem "unidades/tokens" precisam ser editados manualmente).';
      return;
    }
    const operation = beginLogOperation('Cotação', 'Atualização em lote');
    logInfo('Cotação', 'Atualização em lote', 'Em andamento', `Atualização de ${candidates.length} ativo(s) iniciada.`, { count: candidates.length }, operation);
    btn.disabled = true;
    let updated = 0, failed = [];
    for (let i = 0; i < candidates.length; i++) {
      const inv = candidates[i];
      statusEl.textContent = `Atualizando ${i + 1}/${candidates.length}: ${escapeHTML(inv.name)}...`;
      try {
        const coin = inv.coinGeckoId ? { id: inv.coinGeckoId, symbol: inv.name } : await fetchCoinMatch(inv.name);
        if (!coin) { failed.push(inv.name); continue; }
        const price = await fetchCoinPriceBRL(coin.id);
        if (!(Number(price) > 0)) { failed.push(inv.name); logWarn('Cotação','Atualização de cotação','Parcial',`Retorno inválido para ${inv.name}; última cotação válida preservada.`,null,operation); continue; }
        inv.price = Number(price);
        const currentUnits = cryptoCurrentUnits(inv);
        inv.value = cryptoValueFromUnits(inv.type, currentUnits, price);
        inv.lastQuoteAt = new Date().toISOString();
        inv.quoteSource = 'api';
        inv.coinGeckoId = coin.id;
        upsertPriceHistory(inv, { date: todayISO(), price, units: currentUnits, value: inv.value, source: 'api' });
        updated++;
      } catch (err) {
        console.error(err);
        failed.push(inv.name);
        logSyncError(`cotação CoinGecko — ${inv.name}`, err, operation);
      }
      if (i < candidates.length - 1) await sleep(1200); // evita limite de requisições da API
    }
    if (updated > 0) {
      try {
        const quoteSnap = investments.filter(i => isCryptoType(i.type)).map(i => ({
          id: i.id, price: i.price, value: i.value, lastQuoteAt: i.lastQuoteAt, quoteSource: i.quoteSource, coinGeckoId: i.coinGeckoId
        }));
        localStorage.setItem('lc_last_quotes', JSON.stringify({ at: Date.now(), items: quoteSnap }));
      } catch (_) {}
      await persistAll(operation);
    }
    render();
    btn.disabled = false;
    statusEl.textContent = `${updated} de ${candidates.length} cotação(ões) atualizada(s).` +
      (failed.length ? ` Não encontrados: ${failed.join(', ')}.` : '');
    (failed.length ? logWarn : logInfo)('Cotação', auto ? 'Atualização automática' : 'Atualização em lote', failed.length ? 'Parcial' : 'Sucesso', `${updated} cotação(ões) atualizada(s).`, { failed }, operation);
  }
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

  // P3.5.10 — Entrada de comprovante para transferência.
let transferReceiptReaderState = null;

const TRANSFER_RECEIPT_MAX_SIZE = 15 * 1024 * 1024;
const TRANSFER_RECEIPT_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
]);

function clearTransferReceiptReaderState() {
  transferReceiptReaderState = null;

  const input = document.getElementById('transferReceiptFile');
  const status = document.getElementById('transferReceiptFileStatus');

  if (input) input.value = '';

  if (status) {
    status.textContent = '';
    status.style.display = 'none';
  }
}

function setTransferReceiptFileStatus(message, isError = false, showRetry = false) {
  const status = document.getElementById('transferReceiptFileStatus');
  if (!status) return;

  status.textContent = message;
  status.style.display = message ? 'block' : 'none';
  status.style.opacity = isError ? '1' : '.8';

  if (showRetry && transferReceiptReaderState?.file) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Tentar novamente';
    retry.style.marginLeft = '8px';
    retry.onclick = () => runTransferReceiptAIAnalysis();
    status.appendChild(retry);
  }
}

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

async function runTransferReceiptAIAnalysis() {
  const button = document.getElementById('btnReadTransferReceipt');

  if (!transferReceiptReaderState?.file) {
    setTransferReceiptFileStatus(
      'Selecione um comprovante antes de iniciar a leitura.',
      true
    );
    return;
  }

  if (!window.LivroCaixaAI?.isReady()) {
    setTransferReceiptFileStatus(
      'Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para ler comprovantes.',
      true
    );
    alert('Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para usar a leitura de comprovantes.');
    return;
  }

  const file = transferReceiptReaderState.file;

  if (file.type.startsWith('image/') && file.size > 7 * 1024 * 1024) {
    setTransferReceiptFileStatus(
      'Imagem muito grande para leitura multimodal. Use uma imagem de até 7 MB.',
      true
    );
    alert('Para imagens, use um arquivo de até 7 MB.');
    return;
  }

  const originalButtonText =
    button?.textContent || 'Ler comprovante com IA';

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Lendo comprovante…';
    }

    setTransferReceiptFileStatus(
      `Enviando ${file.name} para análise inteligente…`
    );

    const filePart = await fileToReceiptGenerativePart(file);

    const prompt = `
Analise o comprovante financeiro anexado.

Nesta etapa, faça somente a leitura e interpretação do documento.
NÃO grave, altere ou execute nenhuma transferência.
NÃO invente informações ausentes.
NÃO presuma dados que não estejam visíveis no comprovante.
Quando um campo não puder ser identificado com segurança, use null.

O objetivo principal é identificar se o documento representa uma
transferência entre contas, pessoas ou instituições e identificar
a origem e o destino da operação.

Retorne SOMENTE um objeto JSON válido, sem markdown,
sem blocos de código e sem texto antes ou depois.

Use exatamente esta estrutura:

{
  "data": null,
  "banco_origem": null,
  "banco_destino": null,
  "valor": null,
  "descricao": null,
  "tipo": null,
  "confianca": null,
  "observacoes": null
}

Regras:
- "data": data da operação. SEMPRE preencha quando existir QUALQUER data visível no comprovante (data de emissão, data da transação, data/hora). Converta sempre para YYYY-MM-DD. Exemplos: "24/09/2026" ou "24-09-2026" → "2026-09-24"; "2026-09-24" mantenha; "24 de setembro de 2026" → "2026-09-24". Use null somente se o documento não tiver nenhuma data.
- "banco_origem": instituição, conta, pessoa ou identificador de origem
  visível no comprovante.
- "banco_destino": instituição, conta, pessoa ou identificador de destino
  visível no comprovante.
- "valor": valor numérico da operação, sem símbolo de moeda.
- "descricao": descrição principal da transferência, quando houver.
- "tipo": use somente "transferencia" ou "desconhecido".
- "confianca": use somente "alta", "media" ou "baixa".
- "observacoes": informações relevantes que não caibam nos demais campos.
- Se origem ou destino não puderem ser identificados com segurança,
  use null.
- Não transforme a interpretação em uma transferência.
- Não execute nenhuma ação no aplicativo.
`;

    const responseText = await window.LivroCaixaAI.generate({
      prompt,
      imagePart: filePart,
      maxTokens: 500
    });

    if (!responseText) {
      throw new Error('A IA não retornou uma resposta utilizável.');
    }

    const parsedReceipt = parseTransferReceiptAIResult(responseText);
    const normalizedReceipt = normalizeTransferReceiptAIData(parsedReceipt);

    transferReceiptReaderState.aiResponseText = responseText;
    transferReceiptReaderState.parsedData = parsedReceipt;
    transferReceiptReaderState.normalizedData = normalizedReceipt;
    transferReceiptReaderState.targets = resolveTransferReceiptTargets();
    transferReceiptReaderState.aiStatus = 'completed';

    if (applyTransferReceiptToForm()) {
      openModal('panelTransferencia');
    }
  } catch (error) {
    console.error('Erro na leitura do comprovante de transferência:', error);

    transferReceiptReaderState.aiStatus = 'error';

    const errorText = String(
      error?.message || error?.status || error || ''
    ).toLowerCase();

    let userMessage =
      'Não foi possível analisar o comprovante. Verifique o arquivo e tente novamente.';

    if (
      errorText.includes('429') ||
      errorText.includes('quota') ||
      errorText.includes('resource_exhausted')
    ) {
      userMessage =
        'A IA atingiu o limite de uso temporariamente. Aguarde alguns segundos e tente novamente.';
    } else if (
      errorText.includes('500') ||
      errorText.includes('high demand') ||
      errorText.includes('internal')
    ) {
      userMessage =
        'A IA está com alta demanda no momento. Aguarde alguns segundos e tente novamente.';
    } else if (
      errorText.includes('413') ||
      errorText.includes('too large') ||
      errorText.includes('payload')
    ) {
      userMessage =
        'O comprovante é muito grande para análise. Escolha um arquivo menor.';
    }

    setTransferReceiptFileStatus(userMessage, true, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }
}

function parseTransferReceiptAIResult(responseText) {
  const cleaned = String(responseText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'A IA retornou um resultado de transferência que não está em JSON válido.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'A IA retornou uma estrutura de transferência inválida.'
    );
  }

  const allowedTypes = new Set([
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const normalizeText = (value) => {
    if (value == null) return null;

    const text = String(value).trim();

    return text || null;
  };

  const data =
    parsed.data == null
      ? null
      : String(parsed.data).trim() || null;

  const bancoOrigem = normalizeText(parsed.banco_origem);
  const bancoDestino = normalizeText(parsed.banco_destino);
  const descricao = normalizeText(parsed.descricao);
  const observacoes = normalizeText(parsed.observacoes);

  const valor =
    parsed.valor == null || parsed.valor === ''
      ? null
      : Number(parsed.valor);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
    throw new Error(
      'A IA retornou um valor de transferência inválido.'
    );
  }

  const tipo = allowedTypes.has(parsed.tipo)
    ? parsed.tipo
    : 'desconhecido';

  const confianca = allowedConfidence.has(parsed.confianca)
    ? parsed.confianca
    : 'baixa';

  return {
    data,
    bancoOrigem,
    bancoDestino,
    valor,
    descricao,
    tipo,
    confianca,
    observacoes
  };
}

function normalizeTransferReceiptAIData(aiData) {
  if (
    !aiData ||
    typeof aiData !== 'object' ||
    Array.isArray(aiData)
  ) {
    throw new Error(
      'Os dados do comprovante de transferência são inválidos.'
    );
  }

  const normalizeText = (value) => {
    if (value == null) return null;

    const text = String(value).trim();

    return text || null;
  };

  const normalizeDate = (value) => {
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
  };

  const normalizeValue = (value) => {
    if (value == null || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0
        ? value
        : null;
    }

    let text = String(value).trim();

    if (!text) return null;

    text = text
      .replace(/\s/g, '')
      .replace(/R\$/gi, '');

    if (text.includes(',') && text.includes('.')) {
      text = text
        .replace(/\./g, '')
        .replace(',', '.');
    } else if (text.includes(',')) {
      text = text.replace(',', '.');
    }

    const number = Number(text);

    return Number.isFinite(number) && number >= 0
      ? number
      : null;
  };

  const data = normalizeDate(aiData.data);
  const bancoOrigem = normalizeText(aiData.bancoOrigem);
  const bancoDestino = normalizeText(aiData.bancoDestino);
  const valor = normalizeValue(aiData.valor);
  const descricao = normalizeText(aiData.descricao);
  const observacoes = normalizeText(aiData.observacoes);

  const missingFields = [];

  if (!data) missingFields.push('data');
  if (!bancoOrigem) missingFields.push('banco_origem');
  if (!bancoDestino) missingFields.push('banco_destino');
  if (valor === null) missingFields.push('valor');

  const warnings = [];

  if (!data && aiData.data != null) {
    warnings.push(
      'A data identificada não pôde ser validada.'
    );
  }

  if (!bancoOrigem) {
    warnings.push(
      'A origem da transferência não foi identificada com segurança.'
    );
  }

  if (!bancoDestino) {
    warnings.push(
      'O destino da transferência não foi identificado com segurança.'
    );
  }

  if (valor === null && aiData.valor != null) {
    warnings.push(
      'O valor identificado não pôde ser validado.'
    );
  }

  if (aiData.tipo !== 'transferencia') {
    warnings.push(
      'A IA não confirmou com segurança que o comprovante representa uma transferência.'
    );
  }

  if (aiData.confianca === 'baixa') {
    warnings.push(
      'A leitura do comprovante possui baixa confiança.'
    );
  }

  return {
    data,
    bancoOrigem,
    bancoDestino,
    valor,
    descricao,
    observacoes,
    missingFields,
    warnings,
    isValid: missingFields.length === 0
  };
}

function matchTransferReceiptTarget(rawTarget) {
  const raw = String(rawTarget || '').trim();

  if (!raw) {
    return {
      raw: '',
      id: '',
      name: '',
      confidence: 0
    };
  }

  const token = normalizeImportToken(raw);

  if (!token) {
    return {
      raw,
      id: '',
      name: '',
      confidence: 0
    };
  }

  const exact = (banks || []).find(bank =>
    normalizeImportToken(bank.name) === token
  );

  if (exact) {
    return {
      raw,
      id: exact.id,
      name: exact.name,
      confidence: 1
    };
  }

  const partial = (banks || [])
    .map(bank => ({
      bank,
      key: normalizeImportToken(bank.name)
    }))
    .filter(item =>
      item.key &&
      (
        item.key.includes(token) ||
        token.includes(item.key) ||
        token.split(' ').some(part =>
          part.length > 3 &&
          item.key.split(' ').includes(part)
        )
      )
    )
    .sort((a, b) => b.key.length - a.key.length)[0];

  if (partial) {
    return {
      raw,
      id: partial.bank.id,
      name: partial.bank.name,
      confidence: 0.7
    };
  }

  return {
    raw,
    id: '',
    name: '',
    confidence: 0
  };
}

function classifyTransferReceiptTargetMatch(match) {
  if (!match?.id) {
    return {
      status: 'not_found',
      label: 'Conta não encontrada',
      requiresConfirmation: true
    };
  }

  if (match.confidence >= 1) {
    return {
      status: 'exact',
      label: 'Correspondência exata',
      requiresConfirmation: false
    };
  }

  return {
    status: 'partial',
    label: 'Correspondência parcial',
    requiresConfirmation: true
  };
}

function resolveTransferReceiptTargets() {
  const data = transferReceiptReaderState?.normalizedData;

  if (!data) {
    return {
      origin: null,
      destination: null
    };
  }

  const origin = matchTransferReceiptTarget(data.bancoOrigem);
  const destination = matchTransferReceiptTarget(data.bancoDestino);

  return {
    origin: {
      match: origin,
      status: classifyTransferReceiptTargetMatch(origin)
    },
    destination: {
      match: destination,
      status: classifyTransferReceiptTargetMatch(destination)
    }
  };
}

function applyTransferReceiptToForm() {
  const data = transferReceiptReaderState?.normalizedData;
  const targets = transferReceiptReaderState?.targets;

  if (!data) {
    setTransferReceiptFileStatus(
      'Não há dados normalizados do comprovante para preencher a transferência.',
      true
    );
    return false;
  }

  const dateInput = document.getElementById('tData');
  const deSelect = document.getElementById('tDe');
  const paraSelect = document.getElementById('tPara');

  if (dateInput) {
    dateInput.value = data.data || '';
  }

  if (deSelect) {
    const originId = targets?.origin?.match?.id || '';

    deSelect.value = (
      originId &&
      banks.some(bank => bank.id === originId)
    )
      ? originId
      : '';
  }

  if (paraSelect) {
    const destinationId = targets?.destination?.match?.id || '';

    paraSelect.value = (
      destinationId &&
      banks.some(bank => bank.id === destinationId)
    )
      ? destinationId
      : '';
  }

  if (data.valor !== null) {
    setMoneyInput('tValor', data.valor);
  } else {
    setMoneyInput('tValor', '');
  }

  const descriptionParts = [];

  if (data.descricao) {
    descriptionParts.push(data.descricao);
  }

  if (data.observacoes) {
    descriptionParts.push(data.observacoes);
  }

  const descInput = document.getElementById('tDesc');

  if (descInput) {
    descInput.value = descriptionParts.join(' · ');
  }

  const warnings = [...(data.warnings || [])];

  if (targets?.origin?.status?.status === 'not_found') {
    warnings.push(
      'A conta de origem identificada pela IA não foi encontrada nas contas cadastradas.'
    );
  } else if (targets?.origin?.status?.status === 'partial') {
    warnings.push(
      'A conta de origem foi encontrada por correspondência parcial. Revise antes de transferir.'
    );
  }

  if (targets?.destination?.status?.status === 'not_found') {
    warnings.push(
      'A conta de destino identificada pela IA não foi encontrada nas contas cadastradas.'
    );
  } else if (targets?.destination?.status?.status === 'partial') {
    warnings.push(
      'A conta de destino foi encontrada por correspondência parcial. Revise antes de transferir.'
    );
  }

  if (!data.data) {
    warnings.push(
      'A data não foi identificada. Informe a data antes de transferir.'
    );
  }

  if (data.valor === null) {
    warnings.push(
      'O valor não foi identificado. Informe o valor antes de transferir.'
    );
  }

  const warningText = warnings.length
    ? ` · Atenção: ${warnings.join(' ')}`
    : '';

  setTransferReceiptFileStatus(
    warnings.length
      ? `Comprovante aplicado ao formulário. Revise os dados antes de transferir.${warningText}`
      : 'Comprovante aplicado ao formulário. Revise os dados antes de transferir.',
    warnings.length > 0
  );

  return true;
}

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
  function setPasteStatus(message) { document.getElementById('pasteStatus').textContent = message; }
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

  function parseCsvLine(line) { const cells = []; let current = '', quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i++; } else if (char === '"') quoted = !quoted; else if ((char === ',' || char === ';' || char === '\t') && !quoted) { cells.push(current.trim()); current = ''; } else current += char; } cells.push(current.trim()); return cells; }
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

  function getExportMeta(activeEntries = getFilteredEntries()) {
    const startFilter = document.getElementById('filterDateStart').value;
    const endFilter = document.getElementById('filterDateEnd').value;
    const dates = activeEntries.map(e => e.date).filter(Boolean).sort();
    const dateStart = startFilter || dates[0] || todayISO();
    const dateEnd = endFilter || dates[dates.length - 1] || dateStart;
    const initialForBank = bankId => (Number(banks.find(b => b.id === bankId)?.initial) || 0) + entries.filter(e => e.bank === bankId && e.date < dateStart).reduce((sum,e)=>sum+(e.type==='in'?Number(e.amount||0):-Number(e.amount||0)),0);
    return { dateStart, dateEnd, initialForBank };
  }
  function getOrganizedExportData() {
    const activeEntries = getFilteredEntries();
    const meta = getExportMeta(activeEntries);
    const bankIds = [...new Set(activeEntries.map(e => e.bank))];
    return bankIds.map(id => {
      const bank = banks.find(b => b.id === id);
      if (!bank) return null;
      const bankEntries = activeEntries.filter(e => e.bank === id).sort((a,b)=>a.date.localeCompare(b.date) || (a.type==='in'?-1:1));
      const initialBalance = meta.initialForBank(id);
      const finalBalance = initialBalance + bankEntries.reduce((sum,e)=>sum+(e.type==='in'?Number(e.amount||0):-Number(e.amount||0)),0);
      return { bank, entries: bankEntries, initialBalance, finalBalance };
    }).filter(Boolean);
  }
  function downloadBlob(blob, filename) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }

  // ===== P1.4 — Blocos adicionais de exportação: Caixinhas, Investimentos, Resumo Patrimonial =====
  function getPocketsExportBlock(dateStart, dateEnd) {
    return pockets.map(pocket => {
      const movs = yieldsLog.filter(y => y.targetType === 'pocket' && y.targetId === pocket.id && (!dateStart || y.date >= dateStart) && (!dateEnd || y.date <= dateEnd)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      return {
        name: pocket.name,
        goal: pocket.goal || '',
        initial: Number(pocket.initial) || 0,
        current: pocketCurrentBalance(pocket),
        movements: movs.map(m => ({ date: m.date, kind: m.kind === 'aporte' ? 'Aporte' : m.kind === 'resgate' ? 'Resgate' : 'Rendimento', amount: Number(m.amount) || 0, desc: m.desc || '' }))
      };
    });
  }
  function getInvestmentsExportBlock(dateStart, dateEnd) {
    return investments.map(inv => {
      const movs = yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === inv.id && (!dateStart || y.date >= dateStart) && (!dateEnd || y.date <= dateEnd)).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const isCrypto = isCryptoType(inv.type);
      return {
        name: inv.name,
        alias: inv.alias || '',
        type: inv.type,
        units: isCrypto && inv.units != null ? formatCryptoUnits(inv.type, inv.units) : (inv.units != null ? String(inv.units) : ''),
        price: inv.price || null,
        currentValue: inv.type === 'Renda Fixa' ? fixedIncomeCurrentValue(inv) : Number(inv.value || 0),
        movements: movs.map(m => ({
          date: m.date,
          kind: m.kind === 'aporte' ? 'Aporte' : m.kind === 'resgate' ? 'Resgate' : 'Rendimento',
          amount: Number(m.amount) || 0,
          units: isCrypto && m.units != null ? formatCryptoUnits(inv.type, m.units, inv.name) : ''
        }))
      };
    });
  }
  function getPatrimonySummaryBlock() {
    const bankTotal = totalBankBalance();
    const pocketTotal = totalPocketBalance();
    const investTotal = totalInvestBalance();
    return { bankTotal, pocketTotal, investTotal, total: bankTotal + pocketTotal + investTotal };
  }

  document.getElementById('btnExport').onclick = () => {
    const activeEntries = getFilteredEntries();
    const meta = getExportMeta(activeEntries);
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    const hasAnything = activeEntries.length > 0 || pocketsBlock.length > 0 || investBlock.length > 0;
    if (!hasAnything) { alert('Não há dados para exportar nos filtros/período atuais.'); return; }
    renderExportPreview(); openModal('panelExportFormat');
    logInfo('Exportação','Abertura da prévia','Sucesso','Prévia do extrato aberta.',{count: activeEntries.length});
  };
  function renderExportPreview() {
    // P2.4.3 — formato original da prévia + blocos Caixinhas/Investimentos (período)
    const grouped = getOrganizedExportData();
    const count = grouped.reduce((sum, group) => sum + group.entries.length, 0);
    const meta = getExportMeta();
    const initial = grouped.reduce((sum, g) => sum + g.initialBalance, 0);
    const final = grouped.reduce((sum, g) => sum + g.finalBalance, 0);
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    const preview = document.getElementById('exportPreview');
    document.getElementById('exportPreviewCaption').textContent =
      `${count} movimentação(ões) · ${meta.dateStart.split('-').reverse().join('/')} a ${meta.dateEnd.split('-').reverse().join('/')} · Saldo inicial ${fmt(initial)} · Saldo final ${fmt(final)}.`;

    const bankHtml = grouped.map(group => {
      const rows = group.entries.slice(0, 6).map(entry => {
        const category = categories.find(c => c.id === entry.category);
        return `<div class="export-preview-row"><span>${escapeHTML(entry.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(entry.desc || 'Lançamento')}</strong><span>${escapeHTML(category?.name || 'Sem categoria')}</span><b class="${entry.type === 'in' ? 'positive' : 'negative'}">${entry.type === 'in' ? '+' : '−'} ${fmt(Math.abs(entry.amount))}</b></div>`;
      }).join('');
      const extra = group.entries.length > 6 ? `<div class="export-preview-more">+ ${group.entries.length - 6} lançamento(s)</div>` : '';
      return `<section class="export-preview-bank"><h4>${escapeHTML(group.bank.name)} <small>Inicial ${fmt(group.initialBalance)} · Final ${fmt(group.finalBalance)}</small></h4>${rows}${extra}</section>`;
    }).join('');

    const pocketsHtml = pocketsBlock.length ? `<section class="export-preview-bank"><h4>Caixinhas <small>no período</small></h4>${pocketsBlock.map(p => {
      const rows = p.movements.slice(0, 4).map(m => `<div class="export-preview-row"><span>${escapeHTML(m.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(p.name)} · ${escapeHTML(m.kind)}</strong><span>${escapeHTML(m.desc || '')}</span><b class="${m.kind === 'Resgate' ? 'negative' : 'positive'}">${m.kind === 'Resgate' ? '−' : '+'} ${fmt(Math.abs(m.amount))}</b></div>`).join('');
      return `<div class="export-preview-sub"><strong>${escapeHTML(p.name)}</strong> <small>Saldo ${fmt(p.current)}</small></div>${rows || '<div class="export-preview-more">Sem movimentos no período</div>'}`;
    }).join('')}</section>` : '';

    const investHtml = investBlock.length ? `<section class="export-preview-bank"><h4>Investimentos <small>no período</small></h4>${investBlock.map(inv => {
      const label = inv.alias || inv.name;
      const rows = inv.movements.slice(0, 4).map(m => `<div class="export-preview-row"><span>${escapeHTML(m.date.split('-').reverse().join('/'))}</span><strong>${escapeHTML(label)} · ${escapeHTML(m.kind)}</strong><span>${escapeHTML(inv.type)}${m.units ? ` · ${m.units}` : ''}</span><b class="${m.kind === 'Resgate' ? 'negative' : 'positive'}">${m.kind === 'Resgate' ? '−' : '+'} ${fmtPrecise(Math.abs(m.amount))}</b></div>`).join('');
      return `<div class="export-preview-sub"><strong>${escapeHTML(label)}</strong> <small>${fmt(inv.currentValue)}</small></div>${rows || '<div class="export-preview-more">Sem movimentos no período</div>'}`;
    }).join('')}</section>` : '';

    preview.innerHTML = (bankHtml || '') + pocketsHtml + investHtml || '<div class="empty">Nada para pré-visualizar no período.</div>';
  }
  document.getElementById('btnExportFormatPdf').onclick = () => { closeAllPanels(); exportExtractPdf(); };
  document.getElementById('btnExportFormatXlsx').onclick = () => { closeAllPanels(); exportExtractXlsx(); };
  document.getElementById('btnExportFormatDocx').onclick = () => { closeAllPanels(); exportExtractDocx().catch(err => { logSyncError('exportação DOCX', err); alert('Não foi possível gerar o arquivo Word.'); }); };
  function exportExtractPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('A biblioteca PDF ainda está carregando.'); return; }
    const grouped=getOrganizedExportData(); const meta=getExportMeta(); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4'}); const initial=grouped.reduce((s,g)=>s+g.initialBalance,0); const final=grouped.reduce((s,g)=>s+g.finalBalance,0);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - 2 * margin;
    let y = 18;
    let pageNum = 1;
    const totalPages = estimateTotalPages(grouped, meta);

    const addHeader = (title) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('Livro-Caixa — Extrato', margin, y); y+=7;
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      doc.text(`Período: ${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`, margin, y); y+=5;
      doc.text(`Saldo Inicial: ${fmt(initial)} | Saldo Final: ${fmt(final)}`, margin, y); y+=8;
      doc.setDrawColor(200,200,200); doc.line(margin, y, pageWidth - margin, y); y+=10;
    };

    const addFooter = () => {
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.setTextColor(120,120,120);
        doc.text(`Livro-Caixa — Extrato | Página ${i} de ${pageCount} | ${todayISO()}`, pageWidth/2, pageHeight - 8, {align:'center'});
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth/2, pageHeight - 4, {align:'center'});
      }
    };

    const addPageIfNeeded = (spaceNeeded) => {
      if (y + spaceNeeded > pageHeight - 20) {
        doc.addPage(); y = 14; pageNum++;
        doc.setDrawColor(200,200,200); doc.line(margin, y - 4, pageWidth - margin, y - 4);
      }
    };

    const drawTableHeader = (cols, widths) => {
      doc.setFont('helvetica','bold'); doc.setFontSize(8);
      doc.setFillColor(40,40,40);
      let x = margin;
      cols.forEach((col, i) => {
        doc.rect(x, y, widths[i], 7, 'F');
        doc.setTextColor(255,255,255);
        doc.text(col, x + 3, y + 5);
        x += widths[i];
      });
      y += 8;
      doc.setDrawColor(0,0,0); doc.line(margin, y, pageWidth - margin, y); y += 3;
      doc.setTextColor(0,0,0);
    };

    const drawRow = (cells, widths, running) => {
      addPageIfNeeded(10);
      doc.setFont('helvetica','normal'); doc.setFontSize(8);
      let x = margin;
      cells.forEach((cell, i) => {
        const w = widths[i];
        doc.text(String(cell), x + 2, y + 5, {maxWidth: w - 4});
        x += w;
      });
      y += 7;
      if (running !== undefined) {
        doc.setFont('helvetica','normal'); doc.setFontSize(7);
        doc.setTextColor(100,100,100);
        doc.text(`Saldo: ${fmt(running)}`, margin + widths[0] + widths[1] + widths[2] + 2, y - 1);
        doc.setTextColor(0,0,0);
      }
    };

    function estimateTotalPages(grouped, meta) {
      let total = 1; // capa
      grouped.forEach(g => total += Math.ceil((g.entries.length + 2) / 30));
      return total + 3; // caixinhas, investimentos, resumo
    }

    addHeader('Livro-Caixa — Extrato');

    grouped.forEach((group, gi) => {
      addPageIfNeeded(30);
      doc.setFont('helvetica','bold'); doc.setFontSize(13);
      doc.setTextColor(40,40,40);
      doc.text(group.bank.name, margin, y); y+=6;
      doc.setFont('helvetica','normal'); doc.setFontSize(9);
      doc.setTextColor(80,80,80);
      doc.text(`Saldo inicial: ${fmt(group.initialBalance)}  |  Saldo final: ${fmt(group.finalBalance)}`, margin, y); y+=5;
      doc.setDrawColor(200,200,200); doc.line(margin, y, pageWidth - margin, y); y+=4;

      const widths = [25, 58, 32, 25, 25, 32];
      drawTableHeader(['Data','Descrição','Categoria','Entrada','Saída','Saldo'], widths);

      let running = group.initialBalance;
      group.entries.forEach(e => {
        addPageIfNeeded(8);
        const cat = categories.find(c => c.id === e.category);
        const dateFmt = e.date.split('-').reverse().join('/');
        running += e.type === 'in' ? Number(e.amount||0) : -Number(e.amount||0);
        const descLines = doc.splitTextToSize((e.desc||'Lançamento'), 55);
        doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0,0,0);
        doc.text(e.date.split('-').reverse().join('/'), margin, y);
        const descText = descLines.join(' ');
        doc.text(escapeHTML(descText).slice(0, 80), margin + 25, y, {maxWidth: 120});
        const catName = cat ? cat.name.slice(0,18) : '—';
        doc.text(catName, margin + 25 + 55, y);
        const movText = (e.type==='in'?'+':'−') + ' ' + fmt(Math.abs(e.amount)).replace('R$ ','');
        doc.setTextColor(e.type==='in'?0x2F6F4F:0xB44D3A);
        doc.text(movText, margin + 25 + 55 + 30, y, {align:'right'});
        doc.setTextColor(0,0,0);
        const runningText = fmt(running).replace('R$ ','');
        doc.setFontSize(7); doc.setTextColor(100,100,100);
        doc.text(runningText, pageWidth - margin - 30, y);
        doc.setTextColor(0,0,0);
        doc.setFontSize(8);
        y += 7;
      });
      y += 8;
    });

    // Caixinhas
    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      // Don't force new page if there's space
      addPageIfNeeded(50);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
      doc.text('2. Caixinhas', margin, y); y+=10;
      pocketsBlock.forEach(p => {
        addPageIfNeeded(30);
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(40,40,40);
        doc.text(p.name, margin, y); y+=6;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`${p.goal ? 'Objetivo: ' + p.goal + ' · ' : ''}Saldo inicial: ${fmt(p.initial)} · Saldo atual: ${fmt(p.current)}`, margin, y); y+=8;
        p.movements.forEach(m => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(0,0,0);
          doc.text(`${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmt(m.amount)}${m.desc ? ' (' + m.desc + ')' : ''}`, margin + 4, y);
          y += 6;
        });
        y += 6;
      });
    }

    // Investimentos
    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      addPageIfNeeded(50);
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
      doc.text('3. Investimentos', margin, y); y+=10;
      investBlock.forEach(inv => {
        addPageIfNeeded(30);
        doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(40,40,40);
        doc.text(`${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, margin, y); y+=6;
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,80);
        doc.text(`Tipo: ${inv.type}${inv.units ? ' · Quantidade: ' + inv.units : ''}${inv.price ? ' · Cotação: ' + fmt(inv.price) : ''} · Valor atual: ${fmt(inv.currentValue)}`, margin, y); y+=8;
        inv.movements.forEach(m => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(0,0,0);
          doc.text(`${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmtPrecise(m.amount)}${m.units ? ` · ${m.units}` : ''}`, margin + 4, y); y+=6;
        });
        y += 6;
      });
    }

    // Resumo Patrimonial
    const summary = getPatrimonySummaryBlock();
    doc.addPage(); y = 14;
    doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(40,40,40);
    doc.text('Resumo Patrimonial', margin, y); y+=10;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
    doc.text(`Total em contas: ${fmt(getPatrimonySummaryBlock().bankTotal)}`, margin, y); y+=8;
    doc.text(`Total em Caixinhas: ${fmt(getPatrimonySummaryBlock().pocketTotal)}`, margin, y); y+=8;
    doc.text(`Total investido: ${fmt(getPatrimonySummaryBlock().investTotal)}`, margin, y); y+=10;
    doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(0,0,0);
    doc.text(`Patrimônio Total: ${fmt(getPatrimonySummaryBlock().total)}`, margin, y);

    addFooter();
    doc.save(`livro-caixa-extrato-${todayISO()}.pdf`); logInfo('Exportação','Exportação PDF','Sucesso','Extrato PDF completo gerado.',{dateStart:meta.dateStart,dateEnd:meta.dateEnd});
  }
  function exportExtractXlsx() {
    if(typeof XLSX==='undefined'){alert('A biblioteca de Excel ainda está carregando.');return;}
    const grouped=getOrganizedExportData(); const meta=getExportMeta(); const wb=XLSX.utils.book_new(); const totalInitial=grouped.reduce((s,g)=>s+g.initialBalance,0); const totalFinal=grouped.reduce((s,g)=>s+g.finalBalance,0);

    grouped.forEach(group=>{
      const rows=[
        ['Extrato — Livro-Caixa'],
        ['Período',`${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`],
        ['Saldo Inicial',group.initialBalance],
        [],
        ['Data','Descrição','Categoria','Entrada','Saída','Saldo']
      ];
      let running=group.initialBalance;
      group.entries.forEach(e=>{
        const cat=categories.find(c=>c.id===e.category);
        running+=e.type==='in'?Number(e.amount||0):-Number(e.amount||0);
        rows.push([
          e.date.split('-').reverse().join('/'),
          e.desc||'',
          cat?cat.name:'—',
          e.type==='in'?e.amount:'',
          e.type==='out'?e.amount:'',
          running
        ]);
      });
      rows.push([],['','','','','Saldo Final',group.finalBalance]);
      const ws=XLSX.utils.aoa_to_sheet(rows);
      ws['!cols']=[
        {wch:12},{wch:40},{wch:22},{wch:14},{wch:14},{wch:16}
      ];
      // Currency formatting for money columns
      for(let r=5;r<=rows.length;r++){
        ['E','F','G'].forEach(col=>{
          const cell = ws[`${col}${r}`];
          if(cell && cell.v!==null && cell.v!=='') {
            cell.t='n'; cell.z='#,##0.00';
          }
        });
      }
      const safeName=group.bank.name.replace(/[\/*?:\[\]]/g,'').slice(0,31)||'Banco';
      XLSX.utils.book_append_sheet(wb,ws,safeName);
    });

    const summaryRows=[
      ['Extrato — Livro-Caixa'],
      ['Período',`${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`],
      [],
      ['Banco','Saldo Inicial','Saldo Final']
    ];
    grouped.forEach(g=>summaryRows.push([g.bank.name,g.initialBalance,g.finalBalance]));
    summaryRows.push([],['Saldo Inicial Total',totalInitial],['Saldo Final Total',totalFinal]);
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols']=[{wch:30},{wch:18},{wch:18}];
    // Currency format for summary
    for(let r=5;r<=summaryRows.length;r++){
      ['B','C'].forEach(col=>{
        const cell = summaryWs[`${col}${r}`];
        if(cell && cell.v!==null) { cell.t='n'; cell.z='#,##0.00'; }
      });
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryRows),'Resumo');

    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      const rows = [['2. Caixinhas'], []];
      pocketsBlock.forEach(p => {
        rows.push([p.name, p.goal ? `Objetivo: ${p.goal}` : '', `Saldo inicial: ${p.initial}`, `Saldo atual: ${p.current}`]);
        rows.push(['Data', 'Tipo', 'Valor', 'Observação']);
        p.movements.forEach(m => rows.push([m.date.split('-').reverse().join('/'), m.kind, m.amount, m.desc || '']));
        rows.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:22},{wch:20},{wch:14},{wch:30}];
      XLSX.utils.book_append_sheet(wb, ws, 'Caixinhas');
    }

    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      const rows = [['3. Investimentos'], []];
      investBlock.forEach(inv => {
        rows.push([`${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, `Tipo: ${inv.type}`, inv.units ? `Quantidade: ${inv.units}` : '', inv.price ? `Cotação: ${inv.price}` : '', `Valor atual: ${inv.currentValue}`]);
        rows.push(['Data', 'Tipo', 'Valor', 'Quantidade']);
        inv.movements.forEach(m => rows.push([m.date.split('-').reverse().join('/'), m.kind, m.amount, m.units || '']));
        rows.push([]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[{wch:26},{wch:18},{wch:16},{wch:16},{wch:16}];
      XLSX.utils.book_append_sheet(wb, ws, 'Investimentos');
    }

    const patrimony = getPatrimonySummaryBlock();
    const patrimonyRows = [['4. Resumo Patrimonial'], [], ['Total em contas', patrimony.bankTotal], ['Total em Caixinhas', patrimony.pocketTotal], ['Total investido', patrimony.investTotal], [], ['Patrimônio Total', patrimony.total]];
    const wsPatrimony = XLSX.utils.aoa_to_sheet(patrimonyRows);
    wsPatrimony['!cols']=[{wch:30},{wch:20}];
    // Currency format
    for(let r=4;r<=patrimonyRows.length;r++){
      const cell = wsPatrimony[`B${r}`];
      if(cell && cell.v!==null) { cell.t='n'; cell.z='#,##0.00'; }
    }
    XLSX.utils.book_append_sheet(wb, wsPatrimony, 'Patrimônio');

    XLSX.writeFile(wb,`livro-caixa-extrato-${todayISO()}.xlsx`);
    logInfo('Exportação','Exportação Excel','Sucesso','Extrato Excel completo gerado (4 blocos).',{dateStart:meta.dateStart,dateEnd:meta.dateEnd});
  }
  async function exportExtractDocx() {
    if (!window.docx) { alert('A biblioteca Word ainda está carregando.'); return; }
    const grouped = getOrganizedExportData();
    const meta = getExportMeta();
    const d = window.docx;
    const initial = grouped.reduce((sum, group) => sum + group.initialBalance, 0);
    const final = grouped.reduce((sum, group) => sum + group.finalBalance, 0);
    const children = [
      new d.Paragraph({ text: 'Livro-Caixa — Extrato', heading: d.HeadingLevel.TITLE }),
      new d.Paragraph(`Período: ${meta.dateStart.split('-').reverse().join('/')} – ${meta.dateEnd.split('-').reverse().join('/')}`),
      new d.Paragraph(`Saldo Inicial: ${fmt(initial)}   |   Saldo Final: ${fmt(final)}`),
      new d.Paragraph({ text: '', spacing: { after: 200 } })
    ];

    const detailLine = (label, value, color = '1C2B24') => new d.Paragraph({
      spacing: { after: 40 },
      children: [
        new d.TextRun({ text: label, bold: true }),
        new d.TextRun({ text: String(value || '—'), color })
      ]
    });

    const moneyColor = (val) => val >= 0 ? '2F6F4F' : 'B44D3A';
    const moneySign = (val) => val >= 0 ? '+' : '−';

    grouped.forEach(group => {
      children.push(
        new d.Paragraph({ text: group.bank.name, heading: d.HeadingLevel.HEADING_1 }),
        new d.Paragraph(`Saldo inicial: ${fmt(group.initialBalance)} · Saldo final: ${fmt(group.finalBalance)}`),
        new d.Paragraph({ text: '', spacing: { after: 100 } })
      );
      let running = group.initialBalance;
      group.entries.forEach(entry => {
        const category = categories.find(c => c.id === entry.category);
        running += entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0);
        const date = entry.date.split('-').reverse().join('/');
        const movement = `${entry.type === 'in' ? '+' : '−'} ${fmt(Math.abs(entry.amount))}`;
        const movementColor = entry.type === 'in' ? '2F6F4F' : 'B44D3A';
        children.push(
          new d.Paragraph({
            spacing: { before: 120, after: 60 },
            children: [new d.TextRun({ text: `${date} — ${entry.desc || 'Lançamento'}`, bold: true, size: 24 })]
          }),
          detailLine('Categoria: ', category ? category.name : '—'),
          detailLine('Movimentação: ', movement, movementColor),
          detailLine('Saldo após o lançamento: ', fmt(running)),
          new d.Paragraph({ text: '', spacing: { after: 60 } })
        );
      });
    });

    const pocketsBlock = getPocketsExportBlock(meta.dateStart, meta.dateEnd);
    if (pocketsBlock.length) {
      children.push(new d.Paragraph({ text: '2. Caixinhas', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }));
      pocketsBlock.forEach(p => {
        children.push(
          new d.Paragraph({ text: p.name, heading: d.HeadingLevel.HEADING_1 }),
          detailLine('Objetivo: ', p.goal || 'Não definido'),
          detailLine('Saldo inicial: ', fmt(p.initial)),
          detailLine('Saldo atual: ', fmt(p.current))
        );
        p.movements.forEach(m => children.push(new d.Paragraph({ text: `${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmt(m.amount)}${m.desc ? ' (' + m.desc + ')' : ''}`, spacing: { after: 40 } })));
      });
    }

    const investBlock = getInvestmentsExportBlock(meta.dateStart, meta.dateEnd);
    if (investBlock.length) {
      children.push(new d.Paragraph({ text: '3. Investimentos', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }));
      investBlock.forEach(inv => {
        children.push(
          new d.Paragraph({ text: `${inv.name}${inv.alias ? ' (' + inv.alias + ')' : ''}`, heading: d.HeadingLevel.HEADING_1 }),
          detailLine('Tipo: ', inv.type),
          detailLine('Quantidade: ', inv.units || '—'),
          detailLine('Cotação atual: ', inv.price ? fmt(inv.price) : '—'),
          detailLine('Valor atual: ', fmt(inv.currentValue))
        );
        inv.movements.forEach(m => children.push(new d.Paragraph({ text: `${m.date.split('-').reverse().join('/')} — ${m.kind}: ${fmtPrecise(m.amount)}${m.units ? ` · ${m.units}` : ''}`, spacing: { after: 40 } })));
      });
    }

    const patrimony = getPatrimonySummaryBlock();
    children.push(
      new d.Paragraph({ text: '4. Resumo Patrimonial', heading: d.HeadingLevel.TITLE, pageBreakBefore: true }),
      detailLine('Total em contas: ', fmt(patrimony.bankTotal)),
      detailLine('Total em Caixinhas: ', fmt(patrimony.pocketTotal)),
      detailLine('Total investido: ', fmt(patrimony.investTotal)),
      new d.Paragraph({ spacing: { before: 120 }, children: [new d.TextRun({ text: `Patrimônio Total: ${fmt(patrimony.total)}`, bold: true, size: 28 })] })
    );

    const blob = await d.Packer.toBlob(new d.Document({ sections: [{ children }] }));
    downloadBlob(blob, `livro-caixa-extrato-${todayISO()}.docx`);
    logInfo('Exportação', 'Exportação DOCX', 'Sucesso', 'Extrato Word completo gerado (4 blocos).', { dateStart: meta.dateStart, dateEnd: meta.dateEnd, layout: 'vertical-mobile' });
  }

  const PDF_IMPORT_MAX_BYTES = 12 * 1024 * 1024;
  const PDF_IMPORT_MAX_PAGES = 80;
  let pdfImportInProgress = false;
  function extractPdfPageLines(content) {
    const groups = [];
    content.items.filter(item => String(item.str || '').trim()).forEach(item => {
      const y = Number(item.transform?.[5] || 0);
      const x = Number(item.transform?.[4] || 0);
      let group = groups.find(current => Math.abs(current.y - y) < 3);
      if (!group) { group = { y, items: [] }; groups.push(group); }
      group.items.push({ x, text: String(item.str).trim() });
    });
    return groups.sort((a, b) => b.y - a.y).map(group => group.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).filter(Boolean).join('\n');
  }
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

  const IMPORT_MAX_TEXT_LENGTH = 120000;
  const IMPORT_MAX_ROWS = 250;
  function isValidImportDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }
  function parseImportMoney(value) {
    let text = String(value || '').replace(/[^\d,\.\-+]/g, '').replace(/\s/g, '');
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    } else if (lastComma > -1) {
      text = text.replace(',', '.');
    }
    const amount = Math.abs(Number.parseFloat(text));
    return Number.isFinite(amount) ? amount : NaN;
  }
  function normalizeImportDescription(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Lançamento importado';
  }
  function normalizeImportToken(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function findImportMatch(raw, items) {
    const token = normalizeImportToken(raw);
    if (!token) return { id: '', confidence: 0, raw: String(raw || '').trim() };
    const exact = (items || []).find(item => normalizeImportToken(item.name) === token);
    if (exact) return { id: exact.id, confidence: 1, raw: String(raw || '').trim(), name: exact.name };
    const partial = (items || []).map(item => ({ item, key: normalizeImportToken(item.name) })).filter(x => x.key && (x.key.includes(token) || token.includes(x.key) || token.split(' ').some(part => part.length > 3 && x.key.split(' ').includes(part)))).sort((a, b) => b.key.length - a.key.length)[0];
    if (partial) return { id: partial.item.id, confidence: 0.7, raw: String(raw || '').trim(), name: partial.item.name };
    return { id: '', confidence: 0, raw: String(raw || '').trim() };
  }
  function importSignature(row) {
    const descriptionKey = normalizeImportDescription(row.desc).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
    return [row.date, String(row.bank || ''), String(row.type || ''), Number(row.amount || 0).toFixed(2), descriptionKey].join('|');
  }
  function isValidImportRow(row) {
    return Boolean(row && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')) && isValidImportDate(row.date) && Number(row.amount) > 0 && (row.type === 'in' || row.type === 'out') && row.bank && (!row.category || categories.some(c => c.id === row.category)));
  }
  function refreshImportFlags() {
    const existing = new Set(entries.map(importSignature));
    const seen = new Set();
    pendingImport.forEach(row => {
      row.valid = isValidImportRow(row);
      const signature = importSignature(row);
      row.duplicate = existing.has(signature) || seen.has(signature);
      seen.add(signature);
    });
  }
  function importHeaderLine(value) {
    return ['data', 'descrição', 'descricao', 'categoria', 'entrada', 'saída', 'saida', 'saldo'].includes(normalizeImportToken(value));
  }
  function parseClosingImportText(text, source) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean);
    const rows = [];
    const dateRe = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const amountRe = /^[+\-−]?\s*(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/;
    const makeInvalid = (line, reason) => ({ date:'', desc:'', amount:0, type:'out', bank:'', category:'', rawBank:'', rawCategory:'', matchStatus:`Linha inválida: ${reason}`, balance:null, source, valid:false, duplicate:false, rawLine:line });
    const parseAmountStrict = value => {
      const raw=String(value||'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
      if(!amountRe.test(raw)) return NaN;
      const sign=(raw.startsWith('-')||raw.startsWith('−'))?-1:1;
      const n=Number(raw.replace(/^[+\-−]/,'').replace(/\./g,'').replace(',','.'));
      return Number.isFinite(n)&&n>0 ? sign*n : NaN;
    };
    lines.forEach(line=>{
      const structure=line.match(/^(\d{2}\/\d{2}\/\d{4})\s*\/\s*(.*)$/);
      const fields=structure ? [structure[1], ...structure[2].split('/').map(v=>v.trim())] : [];
      if(fields.length<3 || fields.length>5){ rows.push(makeInvalid(line,'use DATA / VALOR / BANCO / CATEGORIA / OBSERVAÇÃO; categoria e observação são opcionais')); return; }
      const [dateRaw,amountRaw,bankRaw,categoryRaw='',...obsParts]=fields; const obs=obsParts.join(' / ').trim();
      const dm=dateRaw.match(dateRe); if(!dm){rows.push(makeInvalid(line,'data deve estar no formato DD/MM/AAAA'));return;}
      const date=`${dm[3]}-${dm[2]}-${dm[1]}`; if(!isValidImportDate(date)){rows.push(makeInvalid(line,'data inválida'));return;}
      const amount=parseAmountStrict(amountRaw); if(!Number.isFinite(amount)){rows.push(makeInvalid(line,'valor inválido'));return;}
      const bankMatch=findImportMatch(bankRaw,banks); if(!bankMatch.id){rows.push({...makeInvalid(line,`banco não reconhecido: ${bankRaw||'(vazio)'}`),rawBank:bankRaw});return;}
      let categoryId='';
      if(categoryRaw){const cm=findImportMatch(categoryRaw,categories);if(!cm.id){rows.push({...makeInvalid(line,`categoria não reconhecida: ${categoryRaw}`),bank:bankMatch.id,rawBank:bankRaw,rawCategory:categoryRaw});return;}categoryId=cm.id;}
      rows.push({date,desc:obs,amount:Math.abs(amount),type:amount>=0?'in':'out',bank:bankMatch.id,category:categoryId,rawBank:bankRaw,rawCategory:categoryRaw,matchStatus:`Banco reconhecido${categoryRaw?' · Categoria reconhecida':' · Categoria opcional'}`,balance:null,source,valid:true,duplicate:false,rawLine:line});
    });
    return rows;
  }
  function parseImportedText(text, source = 'Importação') {
    const normalizedText = String(text || '').replace(/\r/g, '\n').replace(/\u00A0/g, ' ').trim();
    if (!normalizedText) { alert('Não encontrei texto para importar.'); return false; }
    if (normalizedText.length > IMPORT_MAX_TEXT_LENGTH) { alert('O conteúdo é muito extenso. Importe um trecho menor, de até 120 mil caracteres.'); return false; }
    const rows = applySimpleAutoCategorization(parseClosingImportText(normalizedText, source)).slice(0, IMPORT_MAX_ROWS);
    if (!rows.length) { alert('Não encontrei lançamentos estruturados. Use o texto do fechamento com data, descrição, categoria e valor.'); return false; }
    pendingImport = rows;
    pendingImportSource = source;
    refreshImportFlags();
    renderImportReview();
    openModal('panelImport');
    return true;
  }

  function renderImportReview() {
    refreshImportFlags();
    const ready = pendingImport.filter(row => row.valid && !row.duplicate).length;
    const duplicates = pendingImport.filter(row => row.duplicate).length;
    const invalid = pendingImport.filter(row => !row.valid).length;
    document.getElementById('importSummary').innerHTML = `<b>${escapeHTML(pendingImportSource || 'Importação')}</b> · ${pendingImport.length} linha(s) identificada(s) · <span class="import-ready">${ready} pronta(s)</span>${duplicates ? ` · <span class="import-warning">${duplicates} possível(is) duplicidade(s)</span>` : ''}${invalid ? ` · <span class="import-warning">${invalid} inválida(s)</span>` : ''}`;
    const list = document.getElementById('importList');
list.innerHTML = pendingImport.map((row, i) => `
      <div class="import-row ${row.duplicate ? 'is-duplicate' : ''}">
        <select aria-label="Tipo" onchange="updateImportRow(${i}, 'type', this.value)"><option value="in" ${row.type === 'in' ? 'selected' : ''}>Entrada</option><option value="out" ${row.type === 'out' ? 'selected' : ''}>Saída</option></select>
        <input type="date" value="${row.date}" aria-label="Data" placeholder="DD/MM/AAAA" onchange="updateImportRow(${i}, 'date', this.value)">
        <input type="number" step="0.01" min="0.01" value="${row.amount}" aria-label="Valor" placeholder="0,00" onchange="updateImportRow(${i}, 'amount', this.value)">
        <select aria-label="Banco" onchange="updateImportRow(${i}, 'bank', this.value)"><option value="">Banco</option>${banks.map(b => `<option value="${b.id}" ${b.id === row.bank ? 'selected' : ''}>${escapeHTML(b.name)}</option>`).join('')}</select>
        <select aria-label="Categoria" onchange="updateImportRow(${i}, 'category', this.value)"><option value="">Categoria</option>${categories.map(c => `<option value="${c.id}" ${c.id === row.category ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}</select>
        <input type="text" value="${escapeHTML(row.desc)}" aria-label="Descrição" placeholder="Descrição" onchange="updateImportRow(${i}, 'desc', this.value)">
        <button class="action-btn del" onclick="removeImportRow(${i})" aria-label="Remover linha ${i + 1}">×</button>
        <div class="import-status">${row.duplicate ? 'Possível duplicidade: esta linha será ignorada até que você a edite ou remova.' : (row.valid ? `${escapeHTML(row.matchStatus || 'Banco e categoria conferidos.')}. Pronta para importar.` : `${escapeHTML(row.matchStatus || 'Revise banco, categoria, data, descrição e valor.')}. Corrija antes de confirmar.`)}</div>
      </div>
    `).join('');
    const confirm = document.getElementById('importConfirm');
    confirm.disabled = ready === 0;
    confirm.textContent = ready ? `Confirmar ${ready} lançamento(s)` : 'Nenhum lançamento válido';

    const btnRemoveDup = document.getElementById('importRemoveDuplicates');
    const btnRemoveInv = document.getElementById('importRemoveInvalid');
    if (btnRemoveDup) btnRemoveDup.disabled = duplicates === 0;
    if (btnRemoveInv) btnRemoveInv.disabled = invalid === 0;

    // Focus first invalid/editable field when modal opens
    setTimeout(() => {
      const firstInvalid = document.querySelector('.import-row:not(.is-duplicate) input, .import-row:not(.is-duplicate) select');
      if (firstInvalid) firstInvalid.focus();
    }, 50);
  }

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

  function renderUserBar() {
    const bar = document.getElementById('userBar');
    if (!currentUser) { bar.innerHTML = ''; renderProfile(); return; }
    bar.innerHTML = `<span class="sync-dot" id="syncDot"></span> ${escapeHTML(currentUser.email)} <button type="button" id="btnLogout">Sair</button>`;
    document.getElementById('btnLogout').onclick = () => auth.signOut();
    renderProfile();
  }

  function renderProfile() {
    const email = currentUser?.email || 'Sua conta e preferências';
    const target = document.getElementById('profileEmail');
    if (target) target.textContent = email;
    const remindersChk = document.getElementById('featureReminders');
    if (remindersChk) remindersChk.checked = featureSettings.reminders;
    const remindersAdvance = document.getElementById('featureReminderAdvanceDays');
    if (remindersAdvance) remindersAdvance.value = featureSettings.reminderAdvanceDays;
    const cycleInput = document.getElementById('inputFinancialCycleDay');
    if (cycleInput) cycleInput.value = getFinancialCycleStartDay();
    renderFeatureProfile();
  }

  function setAuthError(msg) {
    const el = document.getElementById('authError');

    if (el) {
      el.textContent = msg || '';
    }

    if (msg) {
      window.loginDebugLog?.(
        'AUTH',
        'Mensagem exibida na tela',
        msg
      );
    }
  }

  function translateAuthError(code) {
    const map = {
      'auth/invalid-email': 'E-mail inválido.',
      'auth/user-not-found': 'Conta não encontrada. Crie uma conta.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
      'auth/unauthorized-domain': 'Este domínio não está autorizado no Firebase.',
      'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Tentando redirecionar...',
      'auth/popup-closed-by-user': 'A janela do Google foi fechada.',
      'auth/web-storage-unsupported': 'O navegador bloqueou o armazenamento necessário para o login Google.',
      'auth/operation-not-supported-in-this-environment': 'Este ambiente não permite o login Google por janela.',
      'auth/internal-error': 'O Firebase encontrou um erro interno ao iniciar o login Google.'
    };
    return map[code] || 'Não foi possível concluir. Tente novamente.';
  }

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
        action.then(() => logInfo('Autenticação', isSignupMode ? 'Criar conta' : 'Entrar', 'Sucesso', 'Solicitação de autenticação concluída.', null, operation)).catch(err => { logSyncError('autenticação', err, operation); setAuthError(translateAuthError(err.code)); });
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

  function updateFabAriaLabel(tab) {
    const fab = document.getElementById('fabAdd');
    if (!fab) return;
    const labels = {
      dashboard: 'Conversar com IA financeira',
      bills: 'Adicionar conta recorrente',
      receivables: 'Adicionar valor a receber',
      invest: 'Adicionar investimento',
      pockets: 'Adicionar caixinha',
      cards: 'Adicionar cartão',
      goals: 'Adicionar meta',
      caixa: 'Adicionar lançamento',
      contas: 'Adicionar lançamento'
    };
    fab.setAttribute('aria-label', labels[tab] || 'Adicionar');
  }

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
