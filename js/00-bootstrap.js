/* LIVRO-CAIXA · js/00-bootstrap.js — bootstrap de topo: config pública do Firebase, constantes e utilitários gerais (app.js: 1-454). Separação por responsabilidade; conteúdo preservado. */
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
  openRouterUsage: null,
  openRouterUsageState: 'idle',
  openRouterUsageTimestamp: null,
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
  },
  async refreshOpenRouterUsage(options) {
    const silent = Boolean(options && options.silent);
    if (!silent) {
      this.openRouterUsageState = 'loading';
      window.renderOpenRouterUsagePanel?.();
    }
    const user = typeof auth !== 'undefined' ? auth?.currentUser : null;
    if (!user) {
      if (!silent) this.openRouterUsageState = 'unavailable';
      return null;
    }
    let idToken = '';
    try { idToken = await user.getIdToken(); } catch (err) { if (!silent) this.openRouterUsageState = 'unavailable'; return null; }
    let appCheckToken = '';
    try {
      if (typeof firebase !== 'undefined' && firebase.appCheck) {
        const appCheckResult = await firebase.appCheck().getToken(false);
        appCheckToken = appCheckResult?.token || '';
      }
    } catch (err) { /* segue com o Bearer do ID token */ }
    const endpoint = `${String(AI_WORKER_ENDPOINT || '').replace(/\/ai$/, '')}/openrouter-usage`;
    let response;
    try {
      response = await fetch(endpoint, {
        headers: Object.assign(
          { Authorization: `Bearer ${idToken}` },
          appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}
        )
      });
    } catch (err) {
      if (!silent) this.openRouterUsageState = 'unavailable';
      return null;
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) {
      this.openRouterUsageState = data?.code === 'admin_forbidden' ? 'unauthorized' : 'unavailable';
      if (!silent) window.renderOpenRouterUsagePanel?.();
      return null;
    }
    this.openRouterUsage = data.free_model_daily_requests || null;
    this.openRouterUsageState = 'ready';
    this.openRouterUsageTimestamp = data.timestamp || null;
    window.renderOpenRouterUsagePanel?.(data);
    return data;
  },
  async openOpenRouterUsage() {
    const refreshButton = document.getElementById('btnOpenRouterUsageRefresh');
    if (refreshButton && !refreshButton.dataset.wired) {
      refreshButton.dataset.wired = '1';
      refreshButton.addEventListener('click', () => window.LivroCaixaAI?.refreshOpenRouterUsage?.());
    }
    await this.refreshOpenRouterUsage();
    if (typeof openModal === 'function') openModal('panelOpenRouterUsage');
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

window.renderOpenRouterUsagePanel = function renderOpenRouterUsagePanel() {
  const statusEl = document.getElementById('openRouterUsageStatus');
  const usedEl = document.getElementById('openRouterUsageUsed');
  const limitEl = document.getElementById('openRouterUsageLimit');
  const remainingEl = document.getElementById('openRouterUsageRemaining');
  const barFill = document.getElementById('openRouterUsageBarFill');
  const timestampEl = document.getElementById('openRouterUsageTimestamp');
  const ai = window.LivroCaixaAI;
  const state = ai?.openRouterUsageState || 'idle';
  const usage = ai?.openRouterUsage || null;

  if (state === 'loading') {
    if (statusEl) statusEl.textContent = 'Consultando uso do OpenRouter…';
    return;
  }
  if (state === 'unauthorized') {
    if (statusEl) statusEl.textContent = 'Acesso restrito: somente o administrador pode consultar o uso da API.';
    return;
  }
  if (state === 'unavailable') {
    if (statusEl) statusEl.textContent = 'Não foi possível consultar o uso do OpenRouter agora.';
    return;
  }
  if (state === 'ready' && usage) {
    const limit = Number(usage.limit) || 0;
    const used = Number(usage.used) || 0;
    const remaining = Math.max(0, Number(usage.remaining) || 0);
    const percent = limit > 0 ? Math.min(100, Math.round((remaining / limit) * 100)) : 0;
    if (usedEl) usedEl.textContent = String(used);
    if (limitEl) limitEl.textContent = String(limit);
    if (remainingEl) remainingEl.textContent = String(remaining);
    if (barFill) {
      barFill.style.width = `${percent}%`;
      barFill.style.background = remaining <= 5 ? 'var(--red)' : 'var(--green)';
    }
    if (timestampEl) {
      timestampEl.textContent = ai.openRouterUsageTimestamp
        ? `Última consulta: ${new Date(ai.openRouterUsageTimestamp).toLocaleString('pt-BR')}`
        : '';
    }
    if (statusEl) {
      statusEl.textContent = remaining <= 0
        ? `Uso gratuito diário atingido (${used}/${limit} usados).`
        : `Uso gratuito hoje: ${used}/${limit} usados · ${remaining} restantes.`;
      statusEl.style.color = remaining <= 5 ? 'var(--red)' : '';
    }
    return;
  }
  if (statusEl) statusEl.textContent = 'Abra o menu e use o Monitor de API para consultar o uso.';
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
    if (tabName === 'dash') tabName = 'dashboard';
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
    root.querySelectorAll('.balance-card .amount,.card-amount').forEach((node) => {
      node.classList.remove('value-refresh');
      requestAnimationFrame(() => node.classList.add('value-refresh'));
    });
  }

