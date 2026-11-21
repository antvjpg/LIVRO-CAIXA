# R2.6 — Correções mínimas aplicadas e revalidação

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD:** `6781176`.
**Autorização:** usuário autorizou explicitamente aplicar as correções mínimas e reexecutar a validação nesta sessão.

## 1. O que foi alterado

Foi criado um **núcleo versionado**, sem modificar o histórico aprovado:

| Artefato | SHA-256 |
|---|---|
| `docs/auditorias/c4-v05-b/evidencias-r2-5-6/c4-v05-b-r2-5-6-core.cjs` — preservado | `43b0039e491096fa5497ec6bc4c6e2f29efe86665491b51d741ed0b4b832f006` |
| `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs` — novo | `a373707ae029b0c7465d66959f9ae02aea36c8486953ecedc1fb6c2245232a70` |

Correções implementadas apenas em `getWinningRule()` / `captureWinningRules()`:

1. Comparator de cascata com `important → origem → especificidade (a,b,c) → ordem`, usando a `specificity` devolvida pelo CDP.
2. `CSS.getInlineStylesForNode()` passou a alimentar candidatos com origem `inline`.
3. Propriedades customizadas inline são resolvidas pelo navegador; o vencedor continua declarado como `var(--inline-accent)` e o valor resolvido aparece em `resolvedValue`.
4. `matchedCSSRules` dentro de cada entrada `inherited` passou a ser considerado quando o nó não tem declaração própria.
5. Pseudoelementos passaram a ser lidos de `pseudoElements[].matches`; `getWinningRule(nodeId, property, options)` aceita `options.pseudoElement` e `options.selector`.
6. API retrocompatível: chamadas sem `options` continuam válidas; `computedValue` continua sendo o valor declarado, preserving o contrato histórico.
7. O validador `tmp-c13/r2-6-2/validacao-r2-6-3.cjs` passou a aceitar `--core=` e `--out=` e a repassar `options` ao núcleo.

Nenhum arquivo de produção do aplicativo, CSS, autenticação, persistência ou harness histórico foi alterado.

## 2. Execução

Mesma fixture, mesma matriz e mesmo ambiente das execuções anteriores: Chromium headless + CDP, servidor local `:8000`, 10 cenários, oráculo independente.

- Resultado com núcleo corrigido: `tmp-c13/r2-6-4/resultado-correcao.json`
  - SHA-256 `27ea2e549144fde8c3582140c382f3c434299441deb1c6e8d7cfb6eaae41b878`
  - `hashMatches = true`
- Resultado com núcleo histórico reexecutado no mesmo ambiente: `tmp-c13/r2-6-4/resultado-historico-reexecucao.json`
  - SHA-256 `f0f0571036fb7e5bcd13301ab154161e9ac98a87acd092a71c5737f6eba858a7`
  - `hashMatches = true`

## 3. Comparação cenário a cenário

| ID | Antes | Depois | Vencedor após correção |
|---|---|---|---|
| C01 baseline | PASS | PASS | `#r261-baseline` / `var(--accent)` |
| C02 source-order | PASS | PASS | `#r261-order` / `var(--accent)` |
| C03 specificity-invertida | PASS | PASS | `button.r261-spec` / `var(--accent)` |
| C04 important-invertido | **FAIL** | **PASS** | `.r261-important` / `var(--accent)` / `important=true` |
| C05 inline-vs-stylesheet | **FAIL** | **PASS** | inline / `rgb(255, 0, 0)` |
| C06 custom-property-inline | **FAIL** | **PASS** | inline / `var(--inline-accent)`, resolvido para azul |
| C07 inherit-explicito | PASS | PASS | `#r261-inherit` / `inherit` |
| C08 herda-implicita | **FAIL** | **PASS** | herdado de `.r261-parent-implicit` / `var(--accent)` |
| C09 variaveis-encadeadas | PASS | PASS | `#r261-chain` / `var(--chain-a)` |
| C10 pseudoelemento | **FAIL** | **PASS** | `#r261-pseudo::before` / `var(--accent)` / `::before` |

Resumo antes: `10 cenários — 5 PASS, 5 FAIL, 0 BLOCKED`.
Resumo depois: `10 cenários — 10 PASS, 0 FAIL, 0 BLOCKED`.

## 4. Resposta direta às perguntas

- **As 5 falhas antigas voltaram?** Não. C04, C05, C06, C08 e C10 passaram.
- **Surgiram falhas novas?** Não. Nenhum cenário que era PASS regressou e nenhum cenário novo entrou em FAIL/BLOCKED.
- **O oráculo permaneceu válido?** Sim: 10/10 no antes e 10/10 no depois.
- **Houve erro CDP/console/exceção?** Não: 0 em ambas as execuções.

## 5. Limitações e estado do gate

- A correção foi verificada no núcleo isolado; o harness histórico `c4-v05-b-r2-5-7.cjs` **não** foi modificado nem passou a consumir o novo núcleo.
- Ainda é necessária a etapa formal de revisão/aceite (R2.6.4) antes de promover o novo núcleo para o harness e declarar o Gate R2.6 concluído.
- A matriz cobre os 10 cenários definidos; `@layer`, origem user-agent, `!important` inline, animações e transições seguem fora de escopo.
- Nenhum commit ou push foi feito nesta etapa.
