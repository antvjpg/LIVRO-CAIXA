# Auditoria de Integracao Groq-Exclusivo - LIA

> **NOTA HISTÓRICA (Nov/2026):** Esta implementação da LIA/IA foi **removida completamente** em novembro de 2026 (commit `ffae78d6a72d96001acae6a307aca422c60bfaab`, 02/11/2026). Este documento permanece apenas como registro histórico do **diagnóstico** realizado antes da remoção.

## Classificação: diagnóstico / snapshot histórico — 02/11/2026

**Status do diagnóstico: CONCLUÍDO.** Isso **não** significa que a correção tenha sido concluída neste documento: as ações corretivas foram executadas e registradas separadamente em `docs/implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md`. A arquitetura aqui descrita não é a arquitetura vigente — a funcionalidade foi removida em nov/2026.

### Cronologia documental

| Data | Registro | Fonte |
|---|---|---|
| 01/11/2026 | Suporte multi-provedor (OpenRouter, Google Gemini, Groq) — `ce72d70` | histórico Git |
| 01/11/2026 | Seletor de provedor no frontend — `e55efc7` | histórico Git |
| 02/11/2026 | Diagnóstico de não exclusividade (este documento) | data registrada no próprio documento |
| 02/11/2026 | Ajuste de quota/headers Groq — `4bcc39d` | histórico Git |
| 02/11/2026 | Correções e validação 53/53 — `docs/implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md` | data e testes no próprio documento |
| 02/11/2026 | Remoção completa da LIA/IA — `ffae78d` | histórico Git |

Os documentos não registram branch própria; a branch citada nos metadados atuais do repositório é `feat/app-navigation-redesign`, posterior aos fatos acima.

### Diagnostico da Divergencia

A configuracao `AI_PROVIDER = "groq"` no `wrangler.toml` **nao e exclusiva**. O sistema permite provedores alternativos atraves de multiplos pontos de entrada:

1. **Nivel de variavel de ambiente**: `AI_PROVIDER = "groq"` no `wrangler.toml`
2. **Nivel de payload frontend**: `aiProvider` no POST /ai corpo pode ser 'openrouter', 'google' ou 'groq'
3. **Nivel de seletor UI**: `initAiProviderSelect()` permite ao usuario escolher entre 3 provedores
4. **Nivel de codigo**: Todas as rotinas de OpenRouter e Google permanecem implementadas e ativas

### Dependencias Criticas que Permitem provedores Alternativos

```
VALID_PROVIDERS = ['openrouter', 'google', 'groq']  # 00-bootstrap.js:67
resolveAiProviderByName()                            # index.js:134-172
providerMissingKey()                                 # provider.js:16-23
getQuotaForProvider()                                # quota-kv.js:159-170
OPENROUTER_MODELS                                    # wrangler.toml
GOOGLE_MODELS / GROQ_MODELS                          # wrangler.toml
initAiProviderSelect()                               # 00-bootstrap.js:127-140
```

### Arquitetura vigente à época do diagnóstico — não exclusiva Groq (snapshot 02/11/2026)

```
Frontend                                              Worker Cloudflare                              IA Externa
│                                                                     │
│   escolhe provedor -> salva no SecureStorage/localStorage    │
│                                                                     │
│   POST /ai com {aiProvider: "openrouter"|"google"|"groq"} │───────────────┼────────────────────► API Externa
│                                                                     │  Provider selection:
│                                                                     │  1°: aiProvider do payload
│                                                                     │  2°: AI_PROVIDER env var (=groq)
│                                                                     │  3°: fallback 'openrouter'
│                                                                     │
│                                                                     │  Quota tracking (KV):
│                                                                     │  - openrouter: API real /api/v1/key
│                                                                     │  - google: limit config + KV
│                                                                     │  - groq: limit config + KV (GROQ_DAILY_LIMIT=6000)
│                                                                     ▼
│                                                                   Resposta {text, model} + headers
```

### Arquitetura Desejada (Groq-Exclusivo)

```
Frontend                                              Worker Cloudflare                              IA Externa
│                                                                     │
│   provedor FIXO = groq (sem seletor UI)               │
│                                                                     │
│   POST /ai (sem campo aiProvider) ─────────────────────┼─────► API Groq
│                                                                     │
│                                                                     │  Apenas Groq:
│                                                                     │  - endpoint: api.groq.com
│                                                                     │  - chave: GROQ_API_KEY ( ambiente seguro )
│                                                                     │  - modelos: lista fixa
│                                                                     │  - quota: GROQ_DAILY_LIMIT=6000 (KV)
│                                                                     ▼
│                                                                   Resposta {text, model} + headers APENAS Groq
```

### Acoes Corretivas Necessarias

1. **Remover seletor de provedor no frontend** (`00-bootstrap.js`)
   - Remover `VALID_PROVIDERS`, `getAiProvider()`, `setAiProvider()`, `initAiProviderSelect()`
   - Remover envio de `aiProvider` no payload POST /ai
   - Manter apenas caminho fixo para Groq

2. **Tornar AI_PROVIDER fixo no Worker** (`worker/wrangler.toml`)
   - Manter `AI_PROVIDER = "groq"` como fixo
   - Remover ou comentar referencias a OPENROUTER_MODELS e limites de Google nao necessarios

3. **Simplificar provider.js** (`worker/src/ai/provider.js`)
   - Remover `PROVIDER_NAMES` ou tornar estatico para groq somente
   - Remover `resolveProvider()` ou tornar inutilizado

4. **Ajustar quota-kv.js** (`worker/src/ai/quota-kv.js`)
   - Remover suporte a `openrouter` e `google` no `getQuotaForProvider()`
   - Manter apenas o case `groq`
   - Remover `getOpenRouterQuotaKV()` se nao for mais usado

5. **Remover/desativar clientes OpenRouter e Google**
   - `worker/src/ai/openrouter.js` - tornar inacessivel ou remover imports do index.js
   - `worker/src/ai/google.js` - tornar inacessivel ou remover imports do index.js
   - `worker/src/index.js` - remover cases 'openrouter' e 'google' de `resolveAiProvider()` e `resolveAiProviderByName()`

6. **Atualizar testes** (`worker/test/ai.test.mjs`, `worker/test/ai-limits.test.mjs`)
   - Adaptar mocks para esperarem apenas comportamento Groq
   - Remover testes de fallback para outros provedores
   - Ajustar assertions de quota e rate limit

7. **Validar OCR/multimodal**
   - Confirmar suporte da Groq ao processamento de imagens
   - Identificar modelos compatíveis para Groq
   - Verificar limites de tamanho e resolucao

### Verificacao Final

Antes de considerar o trabalho concluido, deve-se:

1. Confirmar que NAO existe fallback para outros provedores no fluxo principal
2. Verificar que todos os testes passam com comportamento esperada Groq-only
3. Validar que o Worker publica corretamente com a nova configuracao
4. Garantir que NAO ha caminhos alternativos ativos para OpenRouter ou Google
5. Confirmar que a configuracao e consistente em todos os niveis (code, env, frontend)

### Critério de Sucesso Final (proposta histórica)

A LIA deveria utilizar exclusivamente a Groq por meio do Worker Cloudflare. Nenhuma falha, timeout, indisponibilidade ou erro de configuracao poderia provocar troca silenciosa para OpenRouter, Google ou qualquer outro provedor.

A publicacao em producao seria etapa separada, realizada somente apos revisao dos resultados e autorizacao expressa.

**Situação atual:** este critério foi atendido pela implementação histórica descrita em `docs/implementacoes/ia/CORRECOES-GROQ-EXCLUSIVO.md`, mas a funcionalidade como um todo foi removida em nov/2026 (`ffae78d`). Não há hoje provedor de IA ativo — portanto, a afirmação "Groq é o único provedor ativo" **não** descreve o código atual.

---

*Relatorio gerado em: 2026-11-02*
*Fases executadas no documento: 1 (Diagnóstico). A correção foi documentada em arquivo separado; a implementação foi posteriormente removida.*