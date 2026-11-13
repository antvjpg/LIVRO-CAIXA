# COMPARAÇÃO R1 vs R2 — Auditoria de contraste de `--accent`

## Sumário

- [1. Visão geral](#1-visão-geral)
- [2. Diferenças de população (amostras)](#2-diferenças-de-população-amostras)
- [3. Diferenças de classificação](#3-diferenças-de-classificação)
- [4. Diferenças de metodologia](#4-diferenças-de-metodologia)
- [5. O que mudou nos números](#5-o-que-mudou-nos-números)
- [6. Conclusão da comparação](#6-conclusão-da-comparação)

---

## 1. Visão geral

A R1 foi reprovada como base para correções de CSS porque sua população de amostras incluía elementos que **não consomem `--accent`** (apenas correspondiam a seletores candidatos) e sua classificação misturava inconclusivos com falhas. A R2 corrige esses problemas e é executada preservando integralmente a R1 (nenhum artefato R1 alterado ou removido).

---

## 2. Diferenças de população (amostras)

| Métrica | R1 | R2 | Diferença | Explicação |
| --- | --- | --- | --- | --- |
| Linhas (`rows`) | 10.161 | 6.648 | −3.513 | R2 filtra somente consumidores exatos de `--accent`; R1 incluía todos os elementos visíveis dos seletores candidatos |
| Consumidores exatos (`exactAccent`) | 6.648 | 6.648 | 0 | Mesma população de consumidores exatos |
| Não-consumidores nas `rows` | 3.513 | 0 | −3.513 | R2 remove elementos que apenas correspondiam a `KEY_SELECTORS` sem usar `--accent` |
| Candidatos derivados rastreados | — | 330 | +330 | R2 mantém derivados em categoria separada (`derivedCandidates`) |
| Sondas de estado (`states`) | 960 | 1.200 | +240 | R2 itera todos os 10 seletores × 3 temas × 4 abas × 5 estados × 2 viewports |

### Por que a R1 tinha 3.513 não-consumidores

No `collectScript` da R1, o loop sobre `KEY_SELECTORS` adicionava **todos** os elementos visíveis ao conjunto `known`, sem verificar `exactAccent`. Somente depois o loop sobre `body *` adicionava hits. Como `known` era um `Set`, elementos dos seletores candidatos permaneciam mesmo sem consumir `--accent`. Isso explica por que o relatório R1 registrava 75 seletores com falha — incluindo seletores genéricos como `label`, `small`, `span`, `.is-active` que podem não usar `--accent` em todas as ocorrências.

Na R2, **somente** elementos com correspondência exata de `--accent` entram em `rows`. Candidatos derivados (gradiente, `color-mix`, classe temática) vão para `derivedCandidates` (330 rastreados), fora das `rows`.

---

## 3. Diferenças de classificação

A R1 não tinha classificação por linha (apenas totais no relatório consolidado). A R2 aplica classificação rigorosa por amostra:

| Classe | R1 | R2 |
| --- | --- | --- |
| APROVADO | Não reportado por linha | 2.673 |
| FALHA | Não reportado por linha | 1.365 |
| INCONCLUSIVO | Não reportado por linha | 506 |
| N.A. | Não reportado por linha | 2.104 |

### Falhas R2 por motivo

| Motivo | Quantidade |
| --- | --- |
| Texto (abaixo de 4,5:1 / 3:1 grande) | 810 |
| Superfície / fundo de componente (abaixo de 3:1) | 434 |
| Ícone (abaixo de 3:1) | 121 |
| **Total** | **1.365** |

### Seletores únicos com falha

| | R1 (relatório) | R2 (JSON bruto) |
| --- | --- | --- |
| Seletores únicos com falha | 75 | 64 |

A redução de 75 para 64 ocorre porque a R1 incluía seletores cujos elementos não eram consumidores exatos de `--accent` (ex.: `label`, `small`, `span`, `.is-active` em contextos sem `--accent`).

---

## 4. Diferenças de metodologia

| Área | R1 | R2 |
| --- | --- | --- |
| População de `rows` | Todos os elementos visíveis dos `KEY_SELECTORS` + hits de `body *` | Somente elementos com `exactAccent === true` |
| Candidatos derivados | Misturados com exatos | Categoria separada (`derivedCandidates`) |
| Sondas de estado | `querySelector` (primeiro match) | `querySelectorAll` + `visible()` + viewport |
| Classificação | Totais no relatório (sem classe por linha) | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra |
| Inconclusivos | Não registrados como classe | 506 amostras marcadas `INCONCLUSIVO` |
| `commit`/`branch` | Não registrados | Capturados via `git` no Node |
| `userAgent` | Não registrado | Capturado via `navigator.userAgent` |
| Declaração CSS vencedora | Não capturada | `CSS.getMatchedStylesForNode` |
| SVG `fill`/`stroke` | Não inspecionado | Coletado por amostra |
| Hash do artefato | Calculado antes de campos finais (não reproduzível) | Calculado sobre objeto final completo |

---

## 5. O que mudou nos números

O total de **10.161** linhas da R1 **não é comparável** ao total de **6.648** da R2, porque as populações são diferentes:

- R1 = consumidores exatos (6.648) + não-consumidores dos seletores candidatos (3.513)
- R2 = somente consumidores exatos (6.648)

Os **6.648 consumidores exatos** são a mesma população em ambas. O que mudou é a **classificação**: a R2 aplica critérios rigorosos por amostra, separando aprovados, falhas, inconclusivos e N.A., enquanto a R1 apenas totalizava no relatório consolidado (75 seletores, 3.010 linhas com falha — número que incluía não-consumidores).

---

## 6. Conclusão da comparação

A R2 corrige os dois problemas críticos identificados na auditoria independente da R1:

1. **População correta:** somente consumidores exatos de `--accent` entram nas `rows`. Não-consumidores dos seletores candidatos foram excluídos (3.513 removidos).
2. **Classificação rigorosa:** inconclusivos (fundos com gradiente/composição incerta) não são contados como falha; 506 amostras são marcadas como `INCONCLUSIVO`.

A R2 é adequada como base para a próxima etapa (análise independente das falhas e, eventualmente, correções delimitadas de CSS). A R1 permanece preservada integralmente como registro histórico.

---
