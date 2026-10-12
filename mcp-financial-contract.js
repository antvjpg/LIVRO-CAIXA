/* Contrato read-only da Ponte de IA — LIVRO-CAIXA (Fase 1).
   FONT ÚNICA do contrato externo da ferramenta `get_financial_snapshot`.

   Consumidores previstos (Fase 2 em diante):
   - Worker      → importa a validação para expor o endpoint MCP com
                   autoridade de servidor. O Worker NUNCA confia na
                   validação feita no cliente.
   - index.html  → pode carregar este arquivo para reduzir/anonimizar o
                   snapshot antes de qualquer transporte futuro.
   - testes      → importam o mesmo arquivo (uma fonte, zero duplicação).

   Princípios da V1 (regras de segurança da Ponte de IA):
   - Somente LEITURA: este contrato não define nenhuma ferramenta de
     escrita e não toca no modelo financeiro.
   - Reutiliza o financialSnapshot existente (buildGeminiFinancialSnapshot)
     como fonte; aqui apenas SANITIZAMOS e ENVOLVEMOS, nunca recalcamos.
   - Nenhum ID interno, token, credencial ou segredo pode atravessar o
     contrato: a sanitização remove e a validação rejeita (defesa em
     profundidade — as duas precisam falhar juntas para vazar).
   - Toda alteração incompatível de nome, tipo ou limite precisa incrementar
     MCP_CONTRACT_VERSION e atualizar Worker e testes na mesma etapa. */

import { CHAT_LIMITS, serializedBytes } from "./ai-chat-contract.js";

export const MCP_CONTRACT_VERSION = 1;

export const MCP_TOOL_GET_FINANCIAL_SNAPSHOT = "get_financial_snapshot";

export const MCP_LIMITS = Object.freeze({
  /* Teto do snapshot externo serializado — alinhado ao teto do chat
     (64 KB). A ferramenta externa não envia mensagem nem histórico,
     então este é o teto efetivo da resposta. */
  SNAPSHOT_MAX_BYTES: CHAT_LIMITS.SNAPSHOT_MAX_BYTES,
  /* Máximo de itens por lista preservada na resposta externa — mesmo
     piso aplicado pela redução do chat (fitChatSnapshotToBudget). */
  MAX_LIST_ITEMS: 40
});

/* Chaves proibidas: qualquer chave desta lista, em qualquer profundidade
   do payload externo, invalida o resultado. São identificadores internos
   ou credenciais — o snapshot do chat nunca deveria enviá-las; aqui isso
   vira garantia explícita do contrato, não convenção implícita. */
const FORBIDDEN_KEYS = Object.freeze(new Set([
  "id", "uid", "user_id", "email", "token", "secret", "password",
  "apikey", "api_key", "phone", "docid", "ref", "path",
  "categoryid", "accountid", "bankid", "cardid", "goalid", "pocketid",
  "investmentid", "invoiceid", "entryid", "purchaseid", "sourceid",
  "caixinhaid"
]));

/* Campos internos removidos da SANITIZAÇÃO (conhecidos de
   buildGeminiFinancialSnapshot, js/22-profile.js). A varredura de
   FORBIDDEN_KEYS continua válida para qualquer campo novo esquecido. */
const STRIP_FIELDS = Object.freeze({
  budgets: ["categoryId", "id", "month", "updatedAt"]
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDateLike(value) {
  return typeof value === "string" && value.length >= 10 &&
    /^\d{4}-\d{2}-\d{2}/.test(value);
}

/* currentMonthYM() do app produz "YYYY-MM" — mês, não data completa. */
function isMonthLike(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

/* ------------------------------------------------------------------ */
/* Varredura de chaves proibidas                                       */
/* ------------------------------------------------------------------ */

/* Devolve os caminhos (ex.: "budgets[0].categoryId") de chaves proibidas.
   Pura, sem efeitos colaterais, profundidade total sobre objetos/arrays. */
export function findForbiddenKeys(value, basePath = []) {
  const found = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findForbiddenKeys(item, [...basePath, `[${index}]`]));
    });
    return found;
  }
  if (!isPlainObject(value)) return found;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      found.push([...basePath, key].join(".").replace(/\.\[/g, "["));
    }
    found.push(...findForbiddenKeys(child, [...basePath, key]));
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Sanitização (lado de quem constrói)                                 */
/* ------------------------------------------------------------------ */

/* Copia o snapshot removendo os campos internos conhecidos das listas.
   Nunca inventa, nunca recalcula, nunca altera valores — só remove chaves.
   Devolve { ok, value, removed } ou { ok:false, code, error }. */
export function sanitizeFinancialSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    return {
      ok: false,
      code: "invalid_snapshot",
      error: "Snapshot financeiro ausente ou inválido."
    };
  }

  const removed = [];
  const value = { ...snapshot };

  if (Array.isArray(value.budgets)) {
    value.budgets = value.budgets.map((budget, index) => {
      if (!isPlainObject(budget)) return budget;
      const clean = { ...budget };
      for (const field of STRIP_FIELDS.budgets) {
        if (field in clean) {
          delete clean[field];
          removed.push(`budgets[${index}].${field}`);
        }
      }
      return clean;
    });
  }

  return { ok: true, value, removed };
}

/* ------------------------------------------------------------------ */
/* Envelope externo                                                    */
/* ------------------------------------------------------------------ */

/* Monta o resultado da ferramenta `get_financial_snapshot`:
     {
       contractVersion, tool, generatedAt, period, data
     }
   `generatedAt`/`period` vêm do próprio snapshot (fonte existente);
   aqui apenas validamos a presença e o formato. */
export function buildExternalSnapshotResult(snapshot) {
  const sanitized = sanitizeFinancialSnapshot(snapshot);
  if (!sanitized.ok) {
    return { ok: false, status: 400, body: { error: sanitized.error, code: sanitized.code } };
  }

  const generatedAt = sanitized.value.generatedAt;
  if (!isIsoDateLike(generatedAt)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Snapshot sem carimbo de tempo (generatedAt) válido.", code: "invalid_generated_at" }
    };
  }

  const period = sanitized.value.period;
  if (!isPlainObject(period) || !isMonthLike(period.currentMonth)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Snapshot sem período (period.currentMonth) válido.", code: "invalid_period" }
    };
  }

  const { schemaVersion, generatedAt: _ga, period: _p, ...data } = sanitized.value;

  const value = {
    contractVersion: MCP_CONTRACT_VERSION,
    tool: MCP_TOOL_GET_FINANCIAL_SNAPSHOT,
    generatedAt,
    period,
    /* schemaVersion do snapshot de origem (P3.5 etc.) segue como
       metadado — não faz parte do contrato externo, apenas diagnóstico. */
    sourceSchemaVersion: schemaVersion ?? null,
    data
  };

  const bytes = serializedBytes(value);
  if (bytes > MCP_LIMITS.SNAPSHOT_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      body: {
        error: `Snapshot externo acima de ${Math.floor(MCP_LIMITS.SNAPSHOT_MAX_BYTES / 1024)} KB.`,
        code: "snapshot_too_large"
      }
    };
  }

  return { ok: true, value, bytes, removed: sanitized.removed };
}

/* ------------------------------------------------------------------ */
/* Validação autoritativa (lado do servidor)                           */
/* ------------------------------------------------------------------ */

/* Checagem completa de um resultado externo recebido: envelope, versão,
   limites e varredura de chaves proibidas em profundidade. Mesmo que a
   sanitização já tenha rodado, o servidor NÃO confia nela. */
export function validateExternalSnapshotResult(value) {
  if (!isPlainObject(value)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Resultado externo inválido.", code: "invalid_external_snapshot" }
    };
  }

  if (value.contractVersion !== MCP_CONTRACT_VERSION) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Versão do contrato incompatível (esperada ${MCP_CONTRACT_VERSION}).`,
        code: "contract_version_mismatch"
      }
    };
  }

  if (value.tool !== MCP_TOOL_GET_FINANCIAL_SNAPSHOT) {
    return {
      ok: false,
      status: 400,
      body: { error: "Ferramenta desconhecida no envelope.", code: "unknown_tool" }
    };
  }

  if (!isIsoDateLike(value.generatedAt) || !isPlainObject(value.period) || !isMonthLike(value.period.currentMonth)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Envelope sem generatedAt/period válidos.", code: "invalid_envelope" }
    };
  }

  if (!isPlainObject(value.data)) {
    return {
      ok: false,
      status: 400,
      body: { error: "Envelope sem o bloco data.", code: "invalid_envelope" }
    };
  }

  const forbidden = findForbiddenKeys(value);
  if (forbidden.length > 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Payload externo contém campos internos proibidos.",
        code: "forbidden_fields",
        fields: forbidden.slice(0, 10)
      }
    };
  }

  const bytes = serializedBytes(value);
  if (bytes > MCP_LIMITS.SNAPSHOT_MAX_BYTES) {
    return {
      ok: false,
      status: 413,
      body: {
        error: `Snapshot externo acima de ${Math.floor(MCP_LIMITS.SNAPSHOT_MAX_BYTES / 1024)} KB.`,
        code: "snapshot_too_large"
      }
    };
  }

  return { ok: true, value, bytes };
}

/* Moldura única do módulo para quem lê pelo global (index.html).
   Mesmo padrão de ai-chat-contract.js → LivroCaixaChatContract. */
const mcpBridgeApi = Object.freeze({
  MCP_CONTRACT_VERSION,
  MCP_TOOL_GET_FINANCIAL_SNAPSHOT,
  MCP_LIMITS,
  findForbiddenKeys,
  sanitizeFinancialSnapshot,
  buildExternalSnapshotResult,
  validateExternalSnapshotResult
});

if (typeof globalThis !== "undefined") {
  globalThis.LivroCaixaMcpContract = mcpBridgeApi;
}
