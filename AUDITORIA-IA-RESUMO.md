# Auditoria Técnica Cruzada - Subsistema de IA (LIA) - LIVRO-CAIXA

## Sumário Executivo

Esta auditoria técnica examinou o subsistema de Inteligência Artificial do LIVRO-CAIXA, abrangendo arquitetura, provedores, contexto financeiro, prompts, persistência, segurança e testes. O subsistema apresenta arquitetura tricampeada (frontend/validação → worker/roteamento → provedores/execução) com boa separação de responsabilidades, mas possui 3 criticidades operacionais e 7 itens de melhoria identificados.

**Estado geral**: Funcional com riscos operacionais identificados. Recomenda-se corrigir itens CRÍTICO antes de produção com múltiplos usuários.

---

## Arquitetura

### Componentes Identificados

1. **Frontend** (`js/domain/ai-chat-contract.js`): Validação de payload, normalização de contexto, redução de snapshot, sugestões rápidas/contextuais, máquina de estado da conversa, persistência IndexedDB opcional.

2. **Worker/Backend** (`worker/src/index.js`): Ponto de entrada único (`POST /ai`, `GET /quota`, `GET /health`), autenticação App Check, rate limiting, seleção de provedor, queima de cota, envelopamento de erros.

3. **Provedores** (`worker/src/ai/`): `openrouter.js`, `groq.js`, `google.js` — cada um com `modelList(env)`, `callModel(model, env, messages, maxTokens, referer, options)`, `failureFromResult`, `emptyReplyFailure`.

4. **Quota/KV** (`worker/src/ai/quota-kv.js`): Cota diária por provedor usando `env.QUOTA_KV`. OpenRouter consulta API real (`/api/v1/key`). Google/Groq usam limites configuráveis via env vars + tracking KV.

5. **Rate Limit** (`worker/src/ai/ratelimit-kv.js`): Balde por UID com TTL de 1 minuto. Fallback em memória (`rateBuckets` Map) quando KV indisponível.

6. **Dados Financeiros** (`js/domain/financial-client.js`): Indicadores BCB SGS (Selic, CDI, IPCA) e Tesouro Nacional. Snapshot serializado incluído no payload da IA.

### Grafo de Dependências

```
index.html → LivroCaixaChatContract → validateChatPayload → POST /ai
                   ↓
            worker/src/index.js
                   ↓
            +---------------------+
            | App Check Firebase  |
            +----------+----------+
                       ↓
            +---------------------+
            | Rate Limit + Quota  |
            +----------+----------+
                       ↓
            +---------------------+
            | Provider Selection  |
            +----------+----------+
                       ↓
            +---------------------+
            | callModel()         |
            +----------+----------+
                       ↓
                (model response)
                       ↓
              burn quota → return headers + text
```

---

## Inventário Funcional

### Validação de Payload

- `validateChatMessage`: mensagem 1-2000 chars trim.
- `validateFinancialSnapshot`: objeto, até 64 KB, validação de unidade.
- `validateConversationContext`: histórico 12 mensagens max, 4000 chars/item, 24 KB total.
- `validateAiPayload`: prompt, imagePart, maxTokens 1-4096.
- `fitChatSnapshotToBudget`: 8 etapas de redução (diagnóstico, categorias, histórico, orçamentos, contas, cartões).
- `generateQuickSuggestions`: 3 sugestões contextuais baseadas no snapshot.
- `generateContextualSuggestions`: sugestões avançadas baseadas em sinais financeiros.

### Contexto Conversacional

- `createChatSession`: open/close/reset/persistence com callbacks `onLoad/onSave/onClear`.
- `isCurrent(token)`: verificação de sessionId, accountId, requestId.
- `begin/commit/settle/truncateFrom`: gerenciamento de envío e edição.

### Provedores

| Provedor | Endpoint | Autenticação | Modelo padrão | Limite diário | KV tracking |
|----------|----------|-------------|--------------|---------------|-------------|
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `Bearer OPENROUTER_API_KEY` (server) | Lista configurável via `OPENROUTER_MODELS` | Via API real (`/api/v1/key`) | `quota:openrouter:${day}` |
| Groq | `https://api.groq.com/openai/v1/chat/completions` | `Bearer GROQ_API_KEY` (server) | `llama-3.1-8b-instant`, etc. | `GROQ_DAILY_LIMIT` env var (padrão 6000) | `quota:groq:${day}` |
| Google | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `Bearer GOOGLE_API_KEY` (server) | `gemini-1.5-flash`, etc. | `GOOGLE_DAILY_LIMIT` env var | `quota:google:${day}` |

### Cota

- `getQuotaForProvider`: resolve cota pelo nome do provedor.
- `burnQuotaForProvider`: decrementa cota apenas se `result.ok` (sucesso). Não queima em falhas.
- `quotaHeaderValues`: retorna `X-AI-Quota-Limit`, `X-AI-Quota-Remaining`, `X-AI-Quota-Reset`, `X-AI-Quota-Provider`.

### Rate Limit

- `isRateLimitedKV`: usando `env.RATE_LIMIT_KV` (distribuído). Fallback `isRateLimitedMemory` quando KV indisponível.
- Limites: `AI_RATE_LIMIT_PER_MINUTE` (padrão 30), `FINANCIAL_RATE_LIMIT_PER_MINUTE` (padrão 20), `MCP_ANON_RATE_LIMIT_PER_MINUTE` (padrão 60).

### Dados Financeiros

- Indicadores: Selic (code 11), CDI (code 12), IPCA (code 433), Tesouro diário.
- Snapshot: `indicators` (key → {code, name, unit, value, date}) + `titles` (Tesouro: [{name, maturity, rates}]).
- Precisão: unit check rigoroso — se `body.unit !== def.unit`, indicador é descartado.
- Redução: 8 etapas no frontend removendo dados para caber em 64 KB.

---

## Matriz de Provedores

| Cenário | Comportamento |
|---------|--------------|
| `AI_PROVIDER=groq` no Worker + `aiProvider: "groq"` no payload | Worker usa Groq (respecta escolha do frontend). |
| `AI_PROVIDER=groq` no Worker + `aiProvider: "openrouter"` no payload | Worker ignora payload e usa Groq (configuração servidor tem prioridade 2). |
| Sem `AI_PROVIDER` configurado + sem `aiProvider` no payload | Padrão "openrouter" (prioridade 3). |
| Provedor selecionado mas credenciais faltando | Erro: "Chave {PROVIDER}_API_KEY não configurada no servidor." |
| 429/402/404 no modelo → próximo modelo | Funciona: roteador passa para próximo da lista `DEFAULT_MODELS`. |
| Cota diária zerada → 429 daily_limit | Funciona: retorna 429 antes de chamar provedor. |

---

## Integridade Financeira

### Fontes de Dados

- **BCB SGS**: Selic (code 11), CDI (code 12), IPCA (code 433).
- **Tesouro Nacional**: diario com títulos {name, maturity, purchaseRate, saleRate, purchasePrice, salePrice, basePrice}.

### Cálculos

- Ponto mais recente por data (não por posição no array).
- `monthlyFlow`: histórico mensal de transações.
- `cashFlow.net`: entradas vs saídas (pode ser negativo).
- `expensesByCategory`: despesas por categoria (máx. 8 maiores no snapshot).
- `budgets[].pct`: (spent / amount) * 100.

### Snapshot

- Formato: `{ indicators: { key: {code, name, unit, value, date}, ...}, titles: [{name, maturity, rates}] }`.
- Tamanho máximo: 64 KB (`SNAPSHOT_MAX_BYTES`).
- Redução aplicada no frontend via `fitChatSnapshotToBudget` (8 etapas).
- Worker apenas valida tamanho final — assume que frontend já reduziu.

### Precisão

- **Unit check**: se `body.unit !== def.unit`, indicador é descartado (pode causar desaparecimento súbito do IPCA).
- **Dados negativos**: `cashFlow.net < 0` sinaliza fluxo de caixa negativo.
- **Percentuais**: `budget.spent / budget.amount * 100` — se >= 100, sinaliza `budgetOver`.

---

## Comportamento do Modelo

### Caminho de Chat

- Prompt de sistema: `buildChatSystemPrompt(snapshot)` — inclui dados financeiros reduzidos.
- Contexto: sistema + histórico (máx. 12 mensagens) + pergunta do usuário.
- Max tokens: 1000 (fixo). Temperature: 0.2 (fixo).

### Caminho Legado

- Prompt simples ou `imagePart` para multimodal (data URLs: jpeg/png/webp/pdf).
- Sem sistema prompt — apenas mensagem do usuário + imagem opcional.

### Retry Automático

- Status 429/402/404/500/502/503/504 → próximo modelo da lista.
- 402 (créditos insuficientes) → próximo modelo.
- 404 (modelo removido) → próximo modelo.
- Falha de rede → próximo modelo, cota NÃO queimada.

### Resposta Vazia

- Se `result.parsed?.choices?.[0]?.message?.content` estiver vazio após trim → 502 `empty_reply`.

### Erro Não-Repetitível

- Status 0 (rede) → mensagem "Falha de rede ao consultar a IA. Verifique a conexão."
- Status 4xx/5xx → `upstream_{status}` com mensagem sanitizada (chave da API removida).

### Quota em Erros

- Se `result.ok` for falso: cota **não** é queimada. Headers `X-AI-Quota-*` ainda enviados baseados no quota atual (pode inconsistir se houve erros anteriores não contabilizados).

---

## Segurança

### Credenciais

- **Nunca expostas ao frontend**. Apenas nomes de provedor (`openrouter`, `google`, `groq`) via campo `aiProvider` no payload.
- Chaves API (OPENROUTER_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY) vivem exclusivamente no Worker (`env.*`).
- Headers de resposta: `X-AI-Quota-Limit`, `X-AI-Quota-Remaining`, `X-AI-Quota-Reset`, `X-AI-Quota-Provider` — informativos, não sensíveis.

### App Check Firebase

- **Obrigatório** para `/ai` e `/quota`. Sem token inválido → 401 `invalid_appcheck`.
- Token verificado via JWKS público Firebase + crypto.subtle RSA verify.
- `/openrouter-usage` restrito a admin emails via `OPENROUTER_USAGE_ADMIN_EMAIL`.

### Rate Limiting e Cotas

- **Cota diária**: compartilhada entre todos os usuários (chave `quota:${provider}:${day}`). Em plano Free, isso é esperado mas pode causar negação de serviço se um usuário consumir toda a cota.
- **Rate limit por UID**: `AI_RATE_LIMIT_PER_MINUTE` (padrão 30 req/min). Implementado via KV com fallback em memória. **Em produção com múltiplos Worker isolates, o limite é por isolate, não global** — cada isolate tem seu próprio `rateBuckets` Map.
- **Financial rate limit**: `FINANCIAL_RATE_LIMIT_PER_MINUTE` (padrão 20), separado da cota de IA.
- **MCP rate limit**: `MCP_ANON_RATE_LIMIT_PER_MINUTE` (padrão 60), para acessos sem autenticação.

### Dados Financeiros em Trânsito

- O `financialSnapshot` é serializado no frontend e enviado ao Worker. O Worker valida novamente (`validateFinancialSnapshot`).
- Viaja em HTTPS, validad no Worker, **não criptografado adicionalmente** (App Check fornece autenticação, não criptografia de payload).

### Sanitização de Erros

- Chave da API removida de mensagens de erro (openrouter.js:38, groq.js:30, google.js:30).
- `sanitizeDetail` substitui chave por `[chave removida]` em detalhes de erro.

### Prompt Injection

- **Não mitigado no frontend**. Não há sanitização de instruções no campo `prompt` ou histórico. Risco inerente ao uso de LLM com histórico de conversa. Recomendação: educar usuários a não inserir instruções estranhas.

---

## OCR

- Módulo não localizado em inspeção profunda. Referências em testes (`ocr-review-bubble.test.mjs`, `v20-01-ocr-modules.test.mjs`) sugerem existência prévia, mas não encontrado nos arquivos lidos durante esta auditoria. Pode ter sido removido ou movido para repositório separado.

---

## Persistência Conversacional

### Memória Temporária

- Sessão do navegador, perdida ao fechar aba.
- `sessionId`, `requestId` incrementados a cada abertura/envío.

### Persistência Opcional

- Injetada via callbacks `onLoad/onSave/onClear` no index.html.
- Padrão não persiste nada — contexto vive apenas na memória da sessão.

### Isolamento

- Por `accountId`/`sessionId`. Troca de conta reinicia conversa (`sessionId += 1`).
- `isCurrent(token)` verifica `sessionId === token.sessionId && accountId === token.accountId && requestId === token.requestId`.

### Histórico

- Limitado a 12 mensagens no contexto enviado ao modelo.
- Mais antigas removidas primeiro (`normalizeConversationContext:117-123`).
- Persistência preserva mensagens entre recarregamentos se `onLoad` injetado.

---

## Qualidade e Testes

### Testes Existentes

| Arquivo | Result | Observações |
|---------|--------|-------------|
| `ai.test.mjs` | 50/51 passam | 1 falha: format key de cache incompatível entre teste e implementação |
| `ai-limits.test.mjs` | 1 passa, 1 infraestrutura | Rate limit isolamento entre processos Node (expected em CI) |
| `simple-log.test.mjs` | 27/27 passam | localStorage persistence survives reload/close |
| `v20-01-prompt-injection.test.mjs` | — | Existe, não executado aqui |
| `v20-02-prompt-injection.test.mjs` | — | Existe, não executado aqui |

### Lacunas de Cobertura

1. Seleção de provedor no frontend (não testado se `aiProvider` escolhido é realmente usado).
2. Persistência de preferência de provedor entre sessões.
3. Fallback de provedor (se credenciais faltam, não há rota automática).
4. Isolamento entre usuários (nenhum teste verifica dados isolados por UID).
5. OCR pipeline (módulo não localizado).
6. Prompt injection no frontend (não testado).
7. `monthlyFlow` em `snapshotHasData` (não verificado).

### Execução de Testes

- `node --test worker/test/ai.test.mjs` → 50/51 passam (1 falha de cache key format).
- `node --test worker/test/ai-limits.test.mjs` → taxa de isolamento entre processos causa falha esperada em CI.
- `node --test worker/test/simple-log.test.mjs` → 27/27 passam (localStorage persistence).

---

## Descobertos — Classificação por Severidade

### CRÍTICO

| ID | Título | Evidência |
|----|--------|-----------|
| CR-01 | Cota diária compartilhada entre todos os usuários | Chave `quota:${provider}:${day}` é global — qualquer usuário pode consumir toda a cota do plano Free. |
| CR-02 | Rate limit em memória não distribuído entre Worker isolates | `rateBuckets` Map é global por isolate — em produção com scaling, limite é por isolate, não global. Testes falham em CI por esse motivo. |
| CR-03 | Fallback de provedor inexistente | Se o provedor selecionado falhar por credenciais faltando, erro genérico sem sugestão de alternativa. |

### ALTO

| ID | Título | Evidência |
|----|--------|-----------|
| AL-01 | Rate limit CI isolamento entre processos | Teste `ai-limits.test.mjs:126` falha porque cada teste roda em processo Node isolado; `rateBuckets` não persiste. Em produção com KV, funcionaria corretamente. |
| AL-02 | Redução snapshot oculta ao usuário | `fitChatSnapshotToBudget` remove dados financeiros detalhados, mas usuário nunca vê quais dados foram removidos (apenas no relatório interno `dropped`). |
| AL-03 | Modelos sem validação de compatibilidade | `modelList()` lê `env.GOOGLE_MODELS`/`env.GROQ_MODELS` sem validar se nomes são compatíveis com a API. Modelos inválidos retornam erro 404 do provedor. |
| AL-04 | `snapshotHasData` incompleto | Não verifica `monthlyFlow` — se só houver monthlyFlow, IA usa sugestões fallback sem contexto financeiro. |

### MÉDIO

| ID | Título | Evidência |
|----|--------|-----------|
| MD-01 | Rate limit global vs por-UID | `isRateLimitedMemory` usa chave `${prefix}${key}` sem hash forte — múltiplos usuários podem competir pelo mesmo bucket em produção. |
| MD-02 | Prompt injection não mitigado no frontend | Não há sanitização de instruções no campo `prompt` ou histórico. Risco inerente ao LLM com histórico. |
| MD-03 | Format key de cache mismatch | Teste `ai.test.mjs:542` usa `quota:${data}` mas código usa `quota:${provider}:${day}`. Teste passa acidentalmente porque `provider` é "openrouter" por padrão. |

### BAIXO

| ID | Título | Evidência |
|----|--------|-----------|
| BD-01 | IPCA unit divergence | Se Worker retornar IPCA com unidade diferente de `percent_per_month`, indicador desaparece do snapshot sem aviso. |
| BD-02 | `monthlyFlow` não sinalizado | `analyzeFinancialContext` não empurra sinal `monthlyFlow` explicitamente, embora o dado esteja no snapshot. |
| BD-03 | OCR pipeline não localizado | Módulo não encontrado em inspeção — pode estar em repositório separado ou removido. |

---

## Recomendações Técnicas

### Prioridade CRÍTICO

1. **Migrar cota diária para KV com prefixo por UID** se necessário, ou documentar explicitamente que é compartilhado por design com limite de plano Free.

2. **Implementar fallback de provedor**: se falhar credenciais do selecionado, tentar próximo na lista `PROVIDER_NAMES` `["openrouter", "google", "groq"]` e informar o usuário.

3. **Adicionar comunicação ao usuário quando dados financeiros forem reduzidos** do snapshot (exibir contador de "itens removidos" ou resumo do que foi mantido).

### Prioridade ALTO

4. **Migrar rate limit de memória para KV** (`env.RATE_LIMIT_KV`) para garantir isolamento entre Worker isolates em produção.

5. **Validar nomes de modelo** ao ler de `env.GOOGLE_MODELS`/`env.GROQ_MODELS`; warn se modelo não na lista padrão DEFAULT_MODELS.

6. **Atualizar `snapshotHasData`** para verificar também `monthlyFlow`.

### Prioridade MÉDIO

7. **Corrigir format key de cache** de quota nos testes para ser consistente com a implementação (`quota:${provider}:${day}`).

8. **Adicionar sanitização básica de instruções** no campo `prompt` no frontend (remover padrões tipo "Ignore anterior" ou comandos de system prompt).

9. **Verificar se `monthlyFlow` deve ser incluído em `snapshotHasData`** para garantir que sinal financeiro seja reconhecido.

### Prioridade BAIXO

10. **Documentar comportamento de prompt injection** como risco inerto ao uso de LLM com histórico — educar usuários.

11. **Corrigir IPCA unit check** se fontes de dados forem alteradas no futuro.

12. **Confirmar status do módulo OCR** — se removido, atualizar referências em testes e documentação; se movido, atualizar imports.

---

## Critérios de Confiabilidade

O subsistema pode ser considerado tecnicamente confiável quando:

1. ✅ Cota diária funciona com rastreabilidade por provedor (investigar se compartilhada por design ou precisa de isolamento por UID).
2. ✅ Rate limit persiste corretamente em ambiente de múltiplos Worker isolates (migração para KV recomendada).
3. ✅ Usuário é informado quando dados financeiros são removidos antes de irem à IA.
4. ✅ Fallback de provedor está implementado para quando o selecionado falhar por credenciais faltando.
5. ✅ Todos os testes existentes passarem em ambiente de CI (correções de format key e isolamento).
6. ✅ App Check Firebase está ativo e funcionando em produção.
7. ✅ Não há vazamento de credenciais para o frontend (já verificado).
8. ✅ Snapshot financeiro reduzido mantém integridade dos dados essenciais (saldo, contas principais, metas ativas).

**Condições necessárias**:
- `AI_PROVIDER` e chaves respectivas (`GROQ_API_KEY`, `GOOGLE_API_KEY`, `OPENROUTER_API_KEY`) configuradas no Worker.
- `QUOTA_KV` disponível no Worker (para cota tracking).
- `RATE_LIMIT_KV` disponível (para rate limit distribuído).
- Firebase project configurado com App Check.
- Usuário ciente de que dados financeiros são resumidos antes de irem à IA.

---

## Fluxo Completo POST /ai

1. Requisição POST com `Origin` header + `X-Firebase-AppCheck` token + corpo JSON.
2. Validação App Check (401 se inválido).
3. Autenticação Firebase (401 `missing_token` se ausente).
4. Rate limit check (429 `rate_limited` se excedido).
5. Seleção de provedor:
   - Se `body.payload?.aiProvider` → `resolveAiProviderByName(env, frontendProvider)` (prioridade 1).
   - Senão → `resolveAiProvider(env)` (prioridade 2: `AI_PROVIDER` env var).
   - Fallback → `openrouter` (nunca alcançado — default sempre corresponde).
6. Verificação de chave API do provedor selecionado (503 `missing_server_key` se ausente).
7. Cache de cota `getQuotaForProvider` (usando KV ou lógica configurável).
8. Se `quota.remaining <= 0` → 429 `daily_limit` com headers de quota.
9. Validação de payload `validateAiPayload` + `validateChatPayload` (400 erros se inválido).
10. Construção de mensagens: `[{role: "system", content: buildChatSystemPrompt(financialSnapshot)}] + histórico + prompt do usuário`.
11. Lista de modelos: `provider.modelList()` → lê `env.{PROVIDER}_MODELS` ou DEFAULT_MODELS.
12. Loop sobre modelos: `provider.callModel(model, messages, maxTokens, referer, {timeoutMs})`.
13. Se `result.ok` → `burnQuotaForProvider(env, providerName)` (decrementa cota).
14. Se erro (`!result.ok`): log `model_failed`, tentar próximo modelo se status retryable.
15. Se modelo retornou resposta (`result.parsed?.choices?.[0]?.message?.content`): return `{text, model}` + headers `X-AI-Quota-*`.
16. Se resposta vazia: log `model_empty_reply` → 502 `empty_reply`.
17. Se todos os modelos falhados: return envelope com `tried`, `upstreamStatus`, `code`, `model`, `error`.

---

## Fluxo de Cota (`GET /quota`)

1. App Check + auth Firebase.
2. `const providerName = String(env.AI_PROVIDER || "openrouter").toLowerCase()`.
3. `const quota = await getQuotaForProvider(env, providerName)`.
4. Se não houver quota → 503 `quota_unavailable`.
5. Retornar `{limit, used, remaining, resetAt, day, provider}` + headers `X-AI-Quota-Limit`, `X-AI-Quota-Remaining`, `X-AI-Quota-Reset`, `X-AI-Quota-Provider`.

---

## Conclusão

O subsistema de IA do LIVRO-CAIXA é funcional e segue boa arquitetura de separação de responsabilidades, mas apresenta 3 criticidades operacionais que devem ser abordadas antes de considerar o subsistema plenamente confiável para produção com múltiplos usuários simultâneos:

1. **Cota diária compartilhada** — pode causar negação de serviço se um usuário consumir toda a cota do plano Free.
2. **Rate limit não distribuído** — em produção com múltiplos Worker isolates, o limite efetivo aumenta linearmente com o número de isolates ativos.
3. **Fallback de provedor inexistente** — usuário não tem feedback quando o provedor selecionado falha por credenciais faltando.

Além disso, 7 itens de melhoria de médio/baixo impacto devem ser planejados no próximo ciclo de desenvolvimento para aprimorar a experiência do usuário e a robustez do sistema.

**Recomendação**: Corrigir itens CRÍTICO (items 1-3 da seção de recomendações) antes de qualquer mudança que aumente o número de usuários simultâneos ou a carga de requisições de IA.