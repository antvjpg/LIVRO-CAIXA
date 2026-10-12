/* Protocolo MCP (JSON-RPC 2.0) da Ponte de IA — somente leitura.

   Transporte: Streamable HTTP simplificado — 1 mensagem JSON-RPC por
   POST, resposta JSON no corpo. Sem SSE (a V1 não precisa de stream).

   Métodos suportados:
     initialize        → negocia versão e declara capacidade "tools"
     ping              → { pong: true }
     tools/list        → SOMENTE get_financial_snapshot
     tools/call        → SOMENTE get_financial_snapshot (read-only)

   Qualquer outro método → -32601. Não existe nenhuma ferramenta de
   escrita: o contrato da V1 é travado também pelo teste de regressão
   em worker/test/mcp-contract.test.mjs.

   Dados: o snapshot vem do KV depositado pelo app (modelo
   cliente→snapshot). O Worker não toca no Firestore aqui. */

import {
  MCP_CONTRACT_VERSION,
  MCP_TOOL_GET_FINANCIAL_SNAPSHOT,
  validateExternalSnapshotResult
} from "../../../mcp-financial-contract.js";
import { getSnapshot } from "./store.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = Object.freeze({ name: "livro-caixa-mcp", version: "1.0.0" });

const SNAPSHOT_TOOL = Object.freeze({
  name: MCP_TOOL_GET_FINANCIAL_SNAPSHOT,
  description:
    "Retorna o snapshot financeiro agregado do usuário (contas, caixinhas, " +
    "metas, investimentos, cartões e orçamentos) no período atual. " +
    "Somente leitura: não cria, edita nem apaga dados. Requer que o app " +
    "LIVRO-CAIXA tenha depositado um snapshot recente.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false }
});

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id ?? null, error };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/* Identificadores ecoados em mensagens de erro são truncados: evita
   refletir de volta um nome de ferramenta/método de dezenas de KB. */
function shortLabel(value, fallback) {
  const text = typeof value === "string" ? value : String(value);
  return text.length > 200 ? `${text.slice(0, 200)}…` : text || fallback;
}

function toolText(payload, isError) {
  return {
    content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }],
    ...(isError ? { isError: true } : {})
  };
}

async function callGetFinancialSnapshot(env, uid) {
  const snapshot = await getSnapshot(env, uid);

  if (!snapshot) {
    return toolText(
      {
        error: "snapshot_unavailable",
        message:
          "Nenhum snapshot disponível. Abra o LIVRO-CAIXA com a sua conta " +
          "para depositar os dados atuais e tente novamente (o snapshot " +
          "expira em 1 hora)."
      },
      true
    );
  }

  /* Validação autoritativa repetida no servidor, mesmo após o depósito:
     defesa em profundidade contra qualquer alteração intermediária. */
  const validated = validateExternalSnapshotResult(snapshot);
  if (!validated.ok) {
    return toolText({ error: validated.body.code, message: validated.body.error }, true);
  }

  return toolText(validated.value, false);
}

/* Processa uma mensagem JSON-RPC. Devolve o objeto de resposta
   (resultado ou erro); notificações (sem id) devolvem null — o roteador
   responde 202 sem corpo. */
export async function handleMcpMessage(message, env, uid) {
  if (!isPlainObject(message) || message.jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Requisição JSON-RPC inválida.");
  }

  const { id, method, params } = message;
  const isNotification = !("id" in message) || id === undefined;

  switch (method) {
    case "initialize": {
      const requested = params && typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : null;
      return rpcResult(id, {
        protocolVersion: requested && requested.startsWith("2025-") ? requested : MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "Servidor somente leitura do LIVRO-CAIXA. Disponível apenas a " +
          `ferramenta ${MCP_TOOL_GET_FINANCIAL_SNAPSHOT} (contrato v${MCP_CONTRACT_VERSION}).`
      });
    }

    case "ping":
      return rpcResult(id, { pong: true });

    case "tools/list":
      return rpcResult(id, { tools: [SNAPSHOT_TOOL] });

    case "tools/call": {
      const name = params && params.name;
      if (name !== MCP_TOOL_GET_FINANCIAL_SNAPSHOT) {
        return rpcError(id, -32602, `Ferramenta desconhecida ou não permitida: ${shortLabel(name, "(sem nome)")}`);
      }
      /* arguments é ignorado por design: a ferramenta não aceita entrada. */
      const toolResult = await callGetFinancialSnapshot(env, uid);
      return rpcResult(id, toolResult);
    }

    default: {
      /* Notificação (ex.: notifications/initialized) não recebe resposta. */
      if (isNotification) return null;
      return rpcError(id, -32601, `Método não suportado: ${shortLabel(method, "(sem método)")}`);
    }
  }
}
