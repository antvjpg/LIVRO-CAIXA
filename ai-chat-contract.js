/* Contrato e núcleo compartilhado do Chat IA — LIVRO-CAIXA (V.20).
   FONT ÚNICA dos limites, da validação de payload e do ciclo de vida do
   contexto da conversa.

   Consumidores:
   - index.html  → carrega este arquivo como <script type="module"> e lê
                   globalThis.LivroCaixaChatContract.
   - worker/src/index.js → importa a validação para repetir tudo no
                   servidor. O Worker NUNCA confia nos limites do cliente.
   - testes      → importam o mesmo arquivo e conferem limites, validação,
                   ciclo de vida do contexto e a fiação declarada no
                   index.html (uma fonte, zero duplicação).

   Contrato lógico (versão 1):
     POST /ai
     {
       "message": "string",              // 1..2000 chars após trim
       "financialSnapshot": {},          // objeto, até 64 KB serializado
       "conversationContext": [          // até 12 mensagens, até 24 KB
         { "role": "user" | "assistant", "content": "string" }
       ]
     }
     → { "text": "string", "model": "string" }   (mesmo envelope de /ai)

   Campos desconhecidos são ignorados pelo Worker (compatível com os
   fluxos legados que ainda enviam "prompt"/"imagePart"/"maxTokens").
   Toda alteração incompatível de nome, tipo ou limite precisa atualizar
   index.html, Worker e testes na mesma etapa e incrementar
   CHAT_CONTRACT_VERSION. */

export const CHAT_CONTRACT_VERSION = 1;

export const CHAT_LIMITS = Object.freeze({
  /* Mensagem digitada: normalizada (trim) e limitada antes do envio. */
  MESSAGE_MAX_CHARS: 2000,
  /* Histórico enviado: quantidade de mensagens (usuário + IA). */
  CONTEXT_MAX_MESSAGES: 12,
  /* Cada item do histórico, individualmente. */
  CONTEXT_MESSAGE_MAX_CHARS: 4000,
  /* Histórico completo serializado (JSON). */
  CONTEXT_MAX_BYTES: 24 * 1024,
  /* financialSnapshot serializado (JSON). */
  SNAPSHOT_MAX_BYTES: 64 * 1024,
  /* Payload completo serializado (JSON). */
  PAYLOAD_MAX_BYTES: 96 * 1024,
  /* Timeout da requisição ao provedor de IA — somente no caminho do chat.
     Os fluxos legados (prompt/imagem) mantêm o teto do próprio Worker. */
  PROVIDER_TIMEOUT_MS: 30000,
  /* Teto de geração da resposta do chat. */
  MAX_TOKENS: 1000
});

const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;

/* Tamanho em bytes UTF-8 de uma string. Sem TextEncoder (ambiente
   exótico) cai para length: conservador para ASCII e pode subestimar
   para UTF-8 — por isso os testes rodam em Node, que sempre tem o encoder. */
export function byteLength(text) {
  const value = String(text == null ? "" : text);
  return encoder ? encoder.encode(value).length : value.length;
}

export function serializedBytes(value) {
  return byteLength(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/* ------------------------------------------------------------------ */
/* Mensagem do usuário                                                 */
/* ------------------------------------------------------------------ */

export function validateChatMessage(raw) {
  const message = typeof raw === "string" ? raw.trim() : "";
  if (!message) {
    return {
      ok: false,
      status: 400,
      body: { error: "Escreva uma pergunta antes de enviar.", code: "empty_message" }
    };
  }
  if (message.length > CHAT_LIMITS.MESSAGE_MAX_CHARS) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Mensagem acima do limite de ${CHAT_LIMITS.MESSAGE_MAX_CHARS} caracteres.`,
        code: "message_too_long"
      }
    };
  }
  return { ok: true, value: message };
}

/* ------------------------------------------------------------------ */
/* Histórico da conversa                                               */
/* ------------------------------------------------------------------ */

/* Normalização do lado do cliente: descarta o que não serve, corta o
   que é longo e reduz até caber nos limites. É uma REDUÇÃO, nunca uma
   validação de segurança — o Worker repete tudo em validateConversationContext. */
export function normalizeConversationContext(messages) {
  const source = Array.isArray(messages) ? messages : [];
  const normalized = [];

  for (const item of source) {
    if (!isPlainObject(item)) continue;
    const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
    if (!role) continue;
    const content = typeof item.content === "string" ? item.content.trim() : "";
    if (!content) continue;
    normalized.push({ role, content: content.slice(0, CHAT_LIMITS.CONTEXT_MESSAGE_MAX_CHARS) });
  }

  const recent = normalized.slice(-CHAT_LIMITS.CONTEXT_MAX_MESSAGES);

  /* Ordem preservada: para caber no teto de bytes, removemos as mais
     antigas — nunca as mais recentes. */
  while (recent.length && serializedBytes(recent) > CHAT_LIMITS.CONTEXT_MAX_BYTES) {
    recent.shift();
  }

  return recent;
}

/* Validação autoritativa do Worker: formato estrito, sem redução silenciosa. */
export function validateConversationContext(value) {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Histórico inválido: "conversationContext" deve ser uma lista.', code: "invalid_context" }
    };
  }

  if (value.length > CHAT_LIMITS.CONTEXT_MAX_MESSAGES) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Histórico acima do limite de ${CHAT_LIMITS.CONTEXT_MAX_MESSAGES} mensagens.`,
        code: "context_too_many_messages"
      }
    };
  }

  for (const item of value) {
    if (!isPlainObject(item)) {
      return {
        ok: false,
        status: 400,
        body: { error: "Histórico inválido: cada mensagem deve ser um objeto.", code: "invalid_context" }
      };
    }
    if (item.role !== "user" && item.role !== "assistant") {
      return {
        ok: false,
        status: 400,
        body: { error: 'Histórico inválido: "role" deve ser "user" ou "assistant".', code: "invalid_context" }
      };
    }
    if (typeof item.content !== "string" || !item.content.trim()) {
      return {
        ok: false,
        status: 400,
        body: { error: "Histórico inválido: conteúdo da mensagem vazio.", code: "invalid_context" }
      };
    }
    if (item.content.length > CHAT_LIMITS.CONTEXT_MESSAGE_MAX_CHARS) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `Mensagem do histórico acima de ${CHAT_LIMITS.CONTEXT_MESSAGE_MAX_CHARS} caracteres.`,
          code: "context_message_too_long"
        }
      };
    }
  }

  if (serializedBytes(value) > CHAT_LIMITS.CONTEXT_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      body: {
        error: `Histórico acima de ${Math.floor(CHAT_LIMITS.CONTEXT_MAX_BYTES / 1024)} KB.`,
        code: "context_too_large"
      }
    };
  }

  return { ok: true, value };
}

/* ------------------------------------------------------------------ */
/* Snapshot financeiro                                                 */
/* ------------------------------------------------------------------ */

export function validateFinancialSnapshot(value) {
  if (value === undefined || value === null) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Dados financeiros ausentes: "financialSnapshot" é obrigatório.', code: "invalid_snapshot" }
    };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Dados financeiros inválidos: "financialSnapshot" deve ser um objeto.', code: "invalid_snapshot" }
    };
  }

  const bytes = serializedBytes(value);
  if (bytes > CHAT_LIMITS.SNAPSHOT_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      body: {
        error: `Dados financeiros acima de ${Math.floor(CHAT_LIMITS.SNAPSHOT_MAX_BYTES / 1024)} KB.`,
        code: "snapshot_too_large"
      }
    };
  }

  return { ok: true, value, bytes };
}

/* ------------------------------------------------------------------ */
/* Payload completo                                                    */
/* ------------------------------------------------------------------ */

/* Ordem das checagens: mensagem → snapshot → histórico → total.
   Cada falha devolve { ok:false, status, body } já no formato de erro
   do contrato de /ai ({ error, code }). */
export function validateChatPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, status: 400, body: { error: "Corpo da requisição inválido.", code: "bad_body" } };
  }

  const message = validateChatMessage(payload.message);
  if (!message.ok) return message;

  const snapshot = validateFinancialSnapshot(payload.financialSnapshot);
  if (!snapshot.ok) return snapshot;

  const context = validateConversationContext(payload.conversationContext);
  if (!context.ok) return context;

  const normalized = {
    message: message.value,
    financialSnapshot: snapshot.value,
    conversationContext: context.value
  };

  const totalBytes = serializedBytes(normalized);
  if (totalBytes > CHAT_LIMITS.PAYLOAD_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      body: {
        error: `Requisição de chat acima de ${Math.floor(CHAT_LIMITS.PAYLOAD_MAX_BYTES / 1024)} KB.`,
        code: "chat_payload_too_large"
      }
    };
  }

  return { ok: true, value: normalized, bytes: totalBytes };
}

/* =====================================================================
   ETAPA 3 — orçamento do snapshot antes do envio.

   O Worker rejeita financialSnapshot acima de CHAT_LIMITS.SNAPSHOT_MAX_BYTES.
   Aqui encolhemos ANTES, removendo primeiro o que é opcional e nunca
   inventando valor. Se mesmo depois de tudo remover ainda não couber, não
   enviamos e o chat informa o usuário — o App Check do payload é o Worker,
   isto aqui é apenas cortesia de rede.
   ===================================================================== */

export const CHAT_SNAPSHOT_REDUCTIONS = [
  {
    label: "diagnóstico estrutural",
    apply: snap => { const { structuralDiagnosis, ...rest } = snap; return rest; }
  },
  {
    label: "categorias além das 8 maiores",
    apply: snap => snap.cashFlow
      ? { ...snap, cashFlow: { ...snap.cashFlow, expensesByCategory: (snap.cashFlow.expensesByCategory || []).slice(0, 8) } }
      : snap
  },
  {
    label: "histórico mensal além dos 6 meses",
    apply: snap => ({ ...snap, monthlyFlow: (snap.monthlyFlow || []).slice(-6) })
  },
  {
    label: "orçamentos",
    apply: snap => { const { budgets, ...rest } = snap; return rest; }
  },
  {
    label: "histórico mensal",
    apply: snap => { const { monthlyFlow, ...rest } = snap; return rest; }
  },
  {
    label: "listas longas (máx. 40 itens)",
    apply: snap => {
      const cap = list => (Array.isArray(list) ? list.slice(0, 40) : list);
      return {
        ...snap,
        accounts: cap(snap.accounts),
        pockets: cap(snap.pockets),
        investments: cap(snap.investments),
        goals: cap(snap.goals),
        cards: snap.cards
      };
    }
  },
  {
    label: "detalhamento das contas",
    apply: snap => { const { accounts, ...rest } = snap; return rest; }
  },
  {
    label: "detalhamento dos cartões",
    apply: snap => { const { cards, ...rest } = snap; return rest; }
  }
];

/* Devolve { ok:true, snapshot, bytes, dropped } ou
   { ok:false, reason, bytes, limit, dropped }. */
export function fitChatSnapshotToBudget(snapshot) {
  const limit = CHAT_LIMITS.SNAPSHOT_MAX_BYTES;

  let current = snapshot;
  let bytes = serializedBytes(current);
  if (bytes <= limit) return { ok: true, snapshot: current, bytes, dropped: [] };

  const dropped = [];
  for (const step of CHAT_SNAPSHOT_REDUCTIONS) {
    const next = step.apply(current);
    const nextBytes = serializedBytes(next);
    if (nextBytes < bytes) {
      current = next;
      bytes = nextBytes;
      dropped.push(step.label);
    }
    if (bytes <= limit) return { ok: true, snapshot: current, bytes, dropped };
  }

  return { ok: false, reason: "snapshot_too_large", bytes, limit, dropped };
}

/* O chat só faz sentido com algo para interpretar. Sem dados, diz isso
   claramente em vez de queimar uma leitura da cota com uma pergunta que
   a IA não teria como responder. */
export function snapshotHasData(snapshot) {
  if (!snapshot) return false;
  const count = (list) => (Array.isArray(list) ? list.length : 0);
  return Boolean(
    count(snapshot.accounts) ||
    count(snapshot.pockets) ||
    count(snapshot.goals) ||
    count(snapshot.investments) ||
    count(snapshot.budgets) ||
    (snapshot.cards && Number(snapshot.cards.activeCount) > 0) ||
    (snapshot.cashFlow && Number(snapshot.cashFlow.transactionCount) > 0)
  );
}

/* =====================================================================
   Sugestões rápidas dinâmicas (V.20-01).
 
   Gera exatamente 3 sugestões contextuais baseadas no snapshot financeiro.
   Função pura, determinística, sem side effects.
   ===================================================================== */

const SUGGESTION_TEMPLATES = Object.freeze({
  accounts: [
    "Qual é o meu saldo total?",
    "Quanto gastei neste mês?",
    "Mostre meus maiores gastos"
  ],
  pockets: [
    "Como estão minhas caixinhas?",
    "Qual caixinha está mais perto da meta?",
    "Quanto falta para completar minhas metas?"
  ],
  investments: [
    "Como estão meus investimentos?",
    "Qual a rentabilidade da minha carteira?",
    "Quanto rendeu este mês?"
  ],
  goals: [
    "Como estão minhas metas financeiras?",
    "Qual meta vou atingir primeiro?",
    "Quanto preciso poupar por mês?"
  ],
  budgets: [
    "Estou dentro do orçamento?",
    "Em qual categoria gastei mais?",
    "Quanto ainda posso gastar?"
  ],
  cards: [
    "Como estão minhas faturas?",
    "Qual o limite disponível?",
    "Quando vence a próxima fatura?"
  ],
  cashFlow: [
    "Como está meu fluxo de caixa?",
    "Entradas vs saídas do mês",
    "Tendência dos últimos 6 meses"
  ],
  fallback: [
    "Cadastre uma conta para começar",
    "Crie uma caixinha para seus objetivos",
    "Adicione seu primeiro investimento"
  ]
});

function pickSuggestions(pool, max) {
  const shuffled = [...pool].sort((a, b) => a.localeCompare(b));
  return shuffled.slice(0, max);
}

function buildDomainPools(snapshot) {
  const pools = [];
  if (snapshot.accounts?.length) pools.push(SUGGESTION_TEMPLATES.accounts);
  if (snapshot.pockets?.length) pools.push(SUGGESTION_TEMPLATES.pockets);
  if (snapshot.investments?.length) pools.push(SUGGESTION_TEMPLATES.investments);
  if (snapshot.goals?.length) pools.push(SUGGESTION_TEMPLATES.goals);
  if (snapshot.budgets?.length) pools.push(SUGGESTION_TEMPLATES.budgets);
  if (snapshot.cards && Number(snapshot.cards.activeCount) > 0) pools.push(SUGGESTION_TEMPLATES.cards);
  if (snapshot.cashFlow && Number(snapshot.cashFlow.transactionCount) > 0) pools.push(SUGGESTION_TEMPLATES.cashFlow);
  return pools;
}

export function generateQuickSuggestions(snapshot) {
  if (!snapshot || !snapshotHasData(snapshot)) {
    return [...SUGGESTION_TEMPLATES.fallback];
  }

  const pools = buildDomainPools(snapshot);
  if (pools.length === 0) {
    return [...SUGGESTION_TEMPLATES.fallback];
  }

  const perPool = Math.max(1, Math.floor(3 / pools.length));
  const suggestions = [];

  for (const pool of pools) {
    const picked = pickSuggestions(pool, perPool);
    suggestions.push(...picked);
    if (suggestions.length >= 3) break;
  }

  while (suggestions.length < 3 && pools.length > 0) {
    for (const pool of pools) {
      const remaining = pool.filter(s => !suggestions.includes(s));
      if (remaining.length > 0) {
        suggestions.push(remaining[0]);
        if (suggestions.length >= 3) break;
      }
    }
    if (suggestions.length >= 3) break;
  }

  return suggestions.slice(0, 3).map(s => s.slice(0, CHAT_LIMITS.MESSAGE_MAX_CHARS));
}

/* =====================================================================
   Máquina de estados da conversa (ETAPA 13).
 
   Pura, sem DOM: o index.html só lê getters e chama transições. Um token
   ({sessionId, accountId, requestId}) identifica cada requisição; uma
   resposta só entra se o token ainda for o atual. Fechar/reabrir preserva
   a conversa; trocar de conta ou resetar é a única forma de apagá-la.
   ===================================================================== */
export function createChatSession() {
  let open = false;
  let accountId = null;
  let sessionId = 0;
  let requestId = 0;
  let messages = [];
  let pending = null;
  let busy = false;
  let quickSuggestions = [];

  const isCurrent = (token) => Boolean(token) &&
    token.sessionId === sessionId &&
    token.accountId === accountId &&
    token.requestId === requestId;

  function regenerateSuggestions(snapshot) {
    quickSuggestions = generateQuickSuggestions(snapshot);
  }

  return {
    isOpen: () => open,
    isBusy: () => busy,
    getAccountId: () => accountId,
    getSessionId: () => sessionId,
    getMessages: () => messages.slice(),
    getPending: () => pending,
    getQuickSuggestions: () => quickSuggestions.slice(),

    /* Abertura vinculada à conta ativa. Outro dono = conversa nova. */
    openFor(uid, snapshot) {
      if (accountId !== uid) {
        accountId = uid;
        messages = [];
        sessionId += 1;
      }
      open = true;
      pending = null;
      if (snapshot) regenerateSuggestions(snapshot);
    },

    /* Fechar preserva o contexto; só encerra a exibição, o envio atual e
       invalida resposta tardia (nada de renderizar em conversa encerrada). */
    close() {
      open = false;
      busy = false;
      pending = null;
      requestId += 1;
    },

    /* Limpeza de contexto: troca de conta, logout, sessão reiniciada.
       Único caminho que apaga a conversa. */
    resetContext() {
      sessionId += 1;
      requestId += 1;
      messages = [];
      pending = null;
      busy = false;
      quickSuggestions = [];
    },

    /* Início de envio: bloqueia enquanto houver outro em andamento. */
    begin(message) {
      if (busy) return { ok: false, token: null };
      requestId += 1;
      busy = true;
      pending = { content: message };
      return { ok: true, token: { sessionId, accountId, requestId } };
    },

    /* Guardas de sessão: conta, sessão e pertencimento à pergunta. */
    isCurrent,

    /* Resposta só entra se o token ainda for o atual. */
    commit(token, message, reply) {
      if (!isCurrent(token)) return false;
      messages.push({ role: "user", content: message });
      messages.push({ role: "assistant", content: reply });
      return true;
    },

    /* Encerra o envio da requisição informada. Se houve troca de conta,
       fechamento ou novo envio no meio, o estado pertence a outro token
       e esta chamada não mexe nele. */
    settle(token) {
      if (token && !isCurrent(token)) return false;
      pending = null;
      busy = false;
      return true;
    }
  };
}

/* Moldura única do módulo para quem lê pelo global (index.html). */
const api = {
  CHAT_CONTRACT_VERSION,
  CHAT_LIMITS,
  CHAT_SNAPSHOT_REDUCTIONS,
  byteLength,
  serializedBytes,
  validateChatMessage,
  normalizeConversationContext,
  validateConversationContext,
  validateFinancialSnapshot,
  validateChatPayload,
  fitChatSnapshotToBudget,
  snapshotHasData,
  generateQuickSuggestions,
  createChatSession
};

if (typeof globalThis !== "undefined") {
  globalThis.LivroCaixaChatContract = api;
}
