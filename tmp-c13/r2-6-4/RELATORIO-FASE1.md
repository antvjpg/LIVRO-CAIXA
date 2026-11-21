# R2.6 — Fase 1: auditoria da candidata e do comparador de cascata

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.
**Objetivo:** cumprir o Aceite G1 do plano de correção R2.6 — C04 corrigido, comparador determinístico, critérios suportados documentados e nenhum fallback silencioso baseado na ordem do CDP.

## 1. Candidata auditada

Núcleo: `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs` — SHA `a373707ae029b0c7465d66959f9ae02aea36c8486953ecedc1fb6c2245232a70`.
Histórico preservado: `c4-v05-b-r2-5-6-core.cjs` — SHA `43b0039e491096fa5497ec6bc4c6e2f29efe86665491b51d741ed0b4b832f006`.

O núcleo histórico não foi alterado; a candidata é um arquivo versionado à parte, com API retrocompatível (`getWinningRule(nodeId, property, options?)`).

## 2. Comparador

Localização: `c4-v05-b-r2-6-core.cjs:622` (`originRank`) e `:630` (`compareCandidates`).

Ordem de precedência explícita:

```
[important, originRank, specificity.a, specificity.b, specificity.c, order]
```

- `important` é o critério principal: uma declaração `!important` vence declaração normal mesmo com especificidade menor.
- `originRank`: inline = 3, author/regular = 2, user/inherited = 1, user-agent = 0.
- `specificity` vem de `selectorList.selectors[].specificity` do CDP, com fallback textual apenas se ausente.
- `order` é o último desempate; a ordenação não depende da posição em que o CDP devolveu os candidatos quando há critérios superiores.

**Critérios suportados documentados:** importância, origem/contexto (inline, author, herdado; user/user-agent apenas por rank), especificidade A/B/C e ordem de declaração como desempate final.

**Critérios não suportados/não validados:** `@layer`, `!important` inline, transições/animações, `color-mix()`, origem user autorada, Shadow DOM, selectores complexos além da fixture.

## 3. Mapeamento dos cinco defeitos

| Defeito | Correção na candidata | Evidência |
|---|---|---|
| C04 `!important` | `propImportant()` + `compareCandidates()` com `important` primeiro | matriz C04 PASS; teste de ordem inversa PASS |
| C05 inline | `CSS.getInlineStylesForNode()` em `getWinningRule` (`core:698`) | matriz C05 PASS |
| C06 custom property inline | mesma coleta inline + `resolvedValue` do navegador (`core:729-738`) | declarado `var(--inline-accent)`, resolvido `rgb(0, 0, 255)` |
| C08 herança implícita | varredura de `matched.inherited[].matchedCSSRules` (`core:710`) | matriz C08 PASS com origem herdada |
| C10 pseudoelemento | `pseudoElements[].matches` + `options.pseudoElement`/`selector` (`core:680`, `core:641`) | matriz C10 PASS com `#r261-pseudo::before` / `::before` |

## 4. Teste adicional de ordem inversa

Para verificar que o comparador não depende da ordem incidental do CDP, foi executado `tmp-c13/r2-6-4/teste-comparador-c04.cjs`, que inverte `matchedCSSRules` antes de chamar o núcleo.

- Resultado: `tmp-c13/r2-6-4/comparador-ordem-inversa.json` — SHA `3563d93a9bf245a0f6517d3eda1502470850eb5d2f8cbe7744a307ba7ba60abc`.
- C03-inverso: PASS — vencedor `button.r261-spec`, especificidade `0-1-1`.
- C04-inverso: PASS — vencedor `.r261-important`, `important=true`, `var(--accent) !important`, especificidade `0-1-0`.
- Resumo: 2 PASS / 0 FAIL.

A primeira execução deste teste marcou C04-inverso como FAIL por uma falha de normalização na **asserção do teste** (não removia o sufixo `!important`). A asserção foi corrigida e a execução final está limpa; isso não alterou o núcleo nem a matriz.

## 5. Evidências já disponíveis

- Matriz original: 10/10 no núcleo corrigido; histórico reexecutado 5 PASS / 5 FAIL; oráculo 10/10 nos dois.
- Resultado corrigido: `tmp-c13/r2-6-4/resultado-correcao.json` — hash interno `27ea2e549144fde8c3582140c382f3c434299441deb1c6e8d7cfb6eaae41b878`.
- Resultado histórico: `tmp-c13/r2-6-4/resultado-historico-reexecucao.json` — hash interno `f0f0571036fb7e5bcd13301ab154161e9ac98a87acd092a71c5737f6eba858a7`.

## 6. Lacunas que ainda impedem o gate

- Regressão dos 393 registros com o novo núcleo (Fase 6) — **NOT RUN**.
- CI/Linux e revisão independente (Fase 7) — **NOT RUN**.
- Migração controlada do harness histórico — não executada.
- Testes de injeção de erro CDP — não executados.
- Compatibilidade do contrato de saída (`resolvedValue` adicional) com consumidores — não validada.

## 7. Veredito da Fase 1

**Aceite G1: PASS.** C04 está corrigido e o comparador é determinístico e explícito; os critérios suportados estão documentados e não há fallback silencioso à ordem do CDP.

O **Gate R2.6 permanece INCONCLUSIVO**. A próxima etapa do plano é a Fase 2 (inline/valores), cuja evidência já existe na matriz, seguida das fases seguintes até a regressão histórica e revisão independente.

Nenhum commit ou push foi feito nesta etapa.
