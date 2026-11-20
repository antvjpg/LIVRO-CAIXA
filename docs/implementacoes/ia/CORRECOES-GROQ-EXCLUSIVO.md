# Correções Aplicadas — LIA Groq-Exclusivo

> **NOTA HISTÓRICA (Nov/2026):** Esta implementação da LIA/IA foi **removida completamente** em novembro de 2026 (commit `ffae78d6a72d96001acae6a307aca422c60bfaab`). Este documento é o **relatório de implementação e validação** da correção feita antes da remoção; não descreve a arquitetura atual.

## Classificação: relatório de implementação / validação (histórico)

Este documento é a etapa posterior ao diagnóstico em `docs/auditorias/ia/AUDITORIA-GROQ-EXCLUSIVA.md`: diagnóstico (02/11) → autorização → implementação → testes 53/53 (02/11) → revisão → remoção completa da funcionalidade (02/11, `ffae78d`). Os testes abaixo são resultado registrado na época; **não foram reexecutados** nesta reconciliação.

## Data
2026-11-02

## Resumo
Implementação completa das 7 correções para tornar a LIA (Inteligência Artificial do LIVRO-CAIXA) **exclusivamente Groq via Worker Cloudflare**, eliminando OpenRouter, Google e seletor de provedor.

---

## Mudanças por Arquivo

### 1. `js/00-bootstrap.js` — Frontend (-288 linhas, +0)
**Removido:**
- `VALID_PROVIDERS = ['openrouter', 'google', 'groq']`
- `getAiProvider()` — leitura de SecureStorage/localStorage
- `setAiProvider()` — escrita de provedor
- `initAiProviderSelect()` — inicialização do `<select>` UI
- `generateViaLocalKey()` — fallback local OpenRouter
- Constantes `OPENROUTER_API_KEY_STORAGE_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_ENDPOINT`, `OPENROUTER_DEFAULT_MAX_TOKENS`
- `renderOpenRouterUsagePanel()` — painel monitor OpenRouter
- `refreshOpenRouterUsage()` — consulta uso OpenRouter
- Props `openRouterUsage`, `openRouterUsageState`, `openRouterUsageTimestamp`

**Adicionado/Alterado:**
- `AI_DEFAULT_MAX_TOKENS = 900` (substitui `OPENROUTER_DEFAULT_MAX_TOKENS`)
- `postWorker()` envia apenas `payload` (sem `aiProvider`)
- `generate()` usa apenas `generateViaWorker()` (sem fallback)
- `refreshQuota()` comentário atualizado para "Groq via Worker"
- `window.addEventListener('load')` chama apenas `refreshQuota()`

---

### 2. `worker/wrangler.toml` — Configuração Worker
**Removido:**
- `OPENROUTER_MODELS = "..."`
- Comentário "Pode ser sobrescrito pelo frontend via payload.aiProvider"
- Comentários de limites OpenRouter/Google (`OPENROUTER_DAILY_LIMIT`, `GOOGLE_DAILY_LIMIT`)

**Alterado:**
- Comentário da chave: `# npx wrangler secret put GROQ_API_KEY`
- `AI_PROVIDER = "groq"` mantido (agora fixo, sem override)

---

### 3. `worker/src/ai/provider.js` — Interface Base (-23 linhas, +9)
```javascript
// Antes
export const PROVIDER_NAMES = ["openrouter", "google", "groq"];
export function resolveProvider(env) { /* switch com fallback openrouter */ }
export function providerMissingKey(name, env) { /* keyMap com 3 provedores */ }

// Depois
export const PROVIDER_NAMES = ["groq"];
export function resolveProvider(_env) { return "groq"; }
export function providerMissingKey(_name, env) { return !env.GROQ_API_KEY; }
```

---

### 4. `worker/src/ai/quota-kv.js` — Cota Diária (-152 linhas, +50)
**Removido:**
- `getOpenRouterQuotaKV()` — consulta API real `/api/v1/key`
- `getOpenRouterUsageKV()` — leitura autoritativa OpenRouter
- `getConfiguredQuotaKV()` — genérico Google/Groq
- Constantes `QUOTA_ENDPOINT`, `DEFAULT_LIMITS`, `ENV_LIMIT_KEYS`

**Mantido/Simplificado:**
- `getGroqQuotaKV()` — KV tracking com `GROQ_DAILY_LIMIT` (default 6000)
- `getQuotaForProvider()` — só aceita `"groq"`
- `burnQuotaForProvider()` — só decreta se provider === "groq"
- `getFreeQuotaKV()` — retorna `null` (compatibilidade)

---

### 5. `worker/src/ai/groq.js` — Cliente Groq (+2 linhas)
```javascript
// RETRYABLE_STATUS expandido para igualar OpenRouter
export const RETRYABLE_STATUS = new Set([0, 402, 404, 408, 429, 500, 502, 503, 504]);
```
Permite retry em 402 (créditos insuficientes) e 404 (modelo não encontrado).

---

### 6. `worker/src/index.js` — Worker Principal (-210 linhas, +35)
**Removido:**
- Imports: `getFreeQuotaKV`, `getOpenRouterUsageKV` de quota-kv.js
- Imports: `openrouter.js` e `google.js` completos
- `resolveAiProvider(env)` — switch 3 provedores
- `resolveAiProviderByName(env, name)` — switch 3 provedores
- `providerMissingKeyMessage(providerName)` — mapa 3 chaves
- Endpoint `/openrouter-usage` completo (admin, App Check, uso gratuito)

**Adicionado/Simplificado:**
- `getGroqProvider(env)` — objeto fixo Groq
- `/quota` usa `getQuotaForProvider(env, "groq")` direto
- `/ai` usa `getGroqProvider(env)` direto, sem seleção
- `burnQuotaForProvider(env, "groq")` hardcoded

---

### 7. `worker/test/ai.test.mjs` — Testes E2E (51 testes)
**Principais alterações:**
- `API_KEY` → `gsk_groq-fake-key...`
- `fetch` mock → `api.groq.com/openai/v1/chat/completions`
- `state.openRouterCalls` → `state.groqCalls`
- Modelos: `modelo-a:free`/`modelo-b:free` → `llama-3.1-8b-instant`/`llama-3.1-70b-versatile`/etc
- Quota: 100 → 6000, remaining 90 → 5900
- Cache key: `quota:openrouter:` → `quota:groq:`
- `tried`: 2 → 4 (4 modelos Groq)
- Headers quota: 100/89 → 6000/5999

---

### 8. `worker/test/ai-limits.test.mjs` — Testes Limites (2 testes)
- `setupQuotaCache()` popula KV direto (`quota:groq:`)
- Quota zerada: `limit: 6000, used: 6000, remaining: 0`
- Rate limit: quota 6000/5900

---

### 9. `worker/test/openrouter-usage.test.mjs` — **REMOVIDO**
Endpoint `/openrouter-usage` não existe mais no Worker.

---

## Validação

| Check | Resultado |
|-------|-----------|
| `node --check` (6 arquivos) | ✅ Pass |
| Testes `ai.test.mjs` | ✅ 51/51 pass |
| Testes `ai-limits.test.mjs` | ✅ 2/2 pass |
| Total testes AI | ✅ 53/53 pass |

---

## Arquitetura final da implementação histórica (substituída pela remoção em nov/2026)

```
Frontend (js/00-bootstrap.js)                    Worker Cloudflare                      Groq API
│                                                │                                      │
│ POST /ai { prompt, maxTokens } ──────────────►│                                      │
│         (sem aiProvider)                       │  getGroqProvider()                   │
│                                                │  callGroq(model, messages) ─────────►│
│                                                │  burnQuotaForProvider("groq")        │
│ ◄────────────────── { text, model }            │  quota headers X-AI-Quota-*          │
│ + quota headers                                │                                      │
│                                                │ GET /quota → getGroqQuotaKV()        │
│                                                │   (KV tracking, 6000 req/dia)        │
│                                                │                                      │
```

**Nenhum caminho alternativo para OpenRouter, Google ou outro provedor** era admitido nessa implementação histórica. Verificação feita em 20/11/2026: o código atual **não contém** rotas `/ai`, `/quota`, `/openrouter-usage`, `/mcp` ou `/bridge/*`, nem variáveis `AI_PROVIDER`, `GROQ_API_KEY` ou `GROQ_DAILY_LIMIT` em configuração ativa. Restam apenas referências textuais/passivas: comentários em `worker/src/shared/validation.js`, `worker/src/financial/gateway.js` e `js/26-receipts.js`; um padrão de detecção de segredo em `e2e/security/security.test.mjs`; e o backup histórico `index.html.backup-diagnostico-alert-20261001-195746`. Nenhuma delas é um provedor ativo. Não alterar ou remover esses artefatos nesta tarefa.

---

## Critério de Sucesso Cumprido (da implementação histórica)

> A LIA deve utilizar exclusivamente a Groq por meio do Worker Cloudflare. Nenhuma falha, timeout, indisponibilidade ou erro de configuração poderá provocar troca silenciosa para OpenRouter, Google ou qualquer outro provedor.

✅ **ATENDIDO na implementação histórica.** Em 20/11/2026 o critério não é mais aplicável: a funcionalidade foi removida e não existe provedor de IA ativo no código atual.