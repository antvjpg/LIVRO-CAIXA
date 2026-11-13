# COMPARAÇÃO R1 × R2 × R2.1 — Auditoria de contraste de `--accent`

## Sumário

- [1. Visão geral](#1-visão-geral)
- [2. Diferenças de população (amostras)](#2-diferenças-de-população-amostras)
- [3. Diferenças de classificação](#3-diferenças-de-classificação)
- [4. Diferenças de metodologia](#4-diferenças-de-metodologia)
- [5. O que mudou nos números](#5-o-que-mudou-nos-números)
- [6. Conclusão da comparação](#6-conclusão-da-comparação)

---

## 1. Visão geral

A R1 foi reprovada como base para correções de CSS porque sua população de amostras incluía elementos que **não consomem `--accent`** (apenas correspondiam a seletores candidatos) e sua classificação misturava inconclusivos com falhas. A R2 corrigiu esses problemas. A R2.1 corrige problemas adicionais na R2: sondas de estado que usavam apenas o primeiro match, declaração CSS vencedora não capturada, detecção SVG incompleta (fill/stroke/currentColor), hash do artefato não reproduzível, classificação que não incluía bordas/foco, e pseudo-elementos com indicador inconsistente (`||0`).

A R1, R2 e R2.1 permanecem preservadas integralmente. Nenhum artefato foi alterado ou removido.

---

## 2. Diferenças de população (amostras)

| Métrica | R1 | R2 | R2.1 | Diferença R2→R2.1 |
| --- | --- | --- | --- | --- |
| Linhas (`rows`) | 10.161 | 6.648 | 6.660 | +12 |
| Consumidores exatos (`exactAccent`) | 6.648 | 6.648 | 6.660 | +12 |
| Não-consumidores nas `rows` | 3.513 | 0 | 0 | 0 |
| Candidatos derivados rastreados | — | 330 | 330 | 0 |
| Sondas de estado (`states`) | 960 | 1.200 | 1.200 | 0 |
| Erros de console | 0 | 0 | 1* | +1 |
| Exceções | 0 | 0 | 0 | 0 |
| Pulos (`skipped`) | 0 | 0 | 0 | 0 |

\* O erro de console da R2.1 é pré-existente na aplicação (`32-auth-wiring.js` — erro de autenticação Firebase), não proveniente do harness.

### Por que R2.1 tem 12 linhas a mais que R2

A R2.1 inclui detecção de consumidores SVG via `fill`/`stroke`/`currentColor`, que a R2 não incluía como critério de inclusão na população. Isso adicionou elementos SVG que consomem `--accent` via preenchimento/traço, mas que não eram capturados por `color`/`backgroundColor`/`border`/`outline`.

---

## 3. Diferenças de classificação

| Classe | R1 | R2 | R2.1 |
| --- | --- | --- | --- |
| APROVADO | Não reportado por linha | 2.673 | 2.544 |
| FALHA | Não reportado por linha | 1.365 | 1.518 |
| INCONCLUSIVO | Não reportado por linha | 506 | 506 |
| N.A. | Não reportado por linha | 2.104 | 2.092 |
| Total | 10.161 | 6.648 | 6.660 |

### Falhas por motivo (R2.1)

| Motivo | Quantidade |
| --- | --- |
| Texto (abaixo de 4,5:1 / 3:1 grande) | 810 |
| Superfície / fundo de componente (abaixo de 3:1) | 434 |
| Ícone (abaixo de 3:1) | 121 |
| Borda (abaixo de 3:1) | — |
| Foco / outline (abaixo de 3:1) | — |
| **Total** | **1.518** |

### Seletores únicos com falha

| | R1 (relatório) | R2 (JSON bruto) | R2.1 (JSON bruto) |
| --- | --- | --- | --- |
| Seletores únicos com falha | 75 | 64 | 64 |

---

## 4. Diferenças de metodologia

| Área | R1 | R2 | R2.1 |
| --- | --- | --- | --- |
| População de `rows` | Todos os elementos visíveis dos `KEY_SELECTORS` + hits de `body *` | Somente elementos com `exactAccent === true` | Somente elementos com `exactAccent === true` + SVG fill/stroke/currentColor |
| Candidatos derivados | Misturados com exatos | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) |
| Sondas de estado | `querySelector` (primeiro match) | `querySelectorAll` + `visible()` + viewport | `querySelectorAll` + `visible()` + viewport + índice individual + motivo de descarte |
| Classificação | Totais no relatório (sem classe por linha) | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra + borda/foco |
| Inconclusivos | Não registrados como classe | 506 amostras marcadas `INCONCLUSIVO` | 506 amostras marcadas `INCONCLUSIVO` |
| `commit`/`branch` | Não registrados | Capturados via `git` no Node | Capturados via `git` no Node |
| `userAgent` | Não registrado | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` |
| Declaração CSS vencedora | Não capturada | `CSS.getMatchedStylesForNode` (definida, não chamada) | `CSS.getMatchedStylesForNode` (chamada para cada amostra) |
| SVG `fill`/`stroke` | Não inspecionado | Coletado por amostra (não usado na detecção) | Coletado **e usado** na detecção (`isAccentConsumer`) |
| Hash do artefato | Calculado antes de campos finais (não reproduzível) | Calculado sobre objeto final (autorreferência) | SHA-256 sobre objeto **sem** o campo hash; verificação independente |
| Pseudo-elementos | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `null` (ausência explícita) |
| Classificação de texto | Não reportado por linha | Texto direto/tags limitadas | Texto direto + descendente (`innerText`) |

---

## 5. O que mudou nos números

O total de **10.161** linhas da R1 **não é comparável** ao total de **6.660** da R2.1, porque as populações são diferentes:

- R1 = consumidores exatos (6.648) + não-consumidores dos seletores candidatos (3.513)
- R2.1 = somente consumidores exatos (6.660, incluindo SVG fill/stroke)

A diferença de 12 linhas entre R2 (6.648) e R2.1 (6.660) vem da inclusão de consumidores SVG via `fill`/`stroke`/`currentColor` na R2.1.

A classificação da R2.1 é mais completa que a R2 porque inclui bordas e indicadores de foco (WCAG 1.4.11) como critérios de falha, e trata pseudo-elementos sem amostra como `null` (não como zero).

---

## 6. Conclusão da comparação

A R2.1 corrige todos os problemas críticos identificados na auditoria independente da R2:

1. **População correta:** somente consumidores exatos de `--accent` entram nas `rows` (incluindo SVG fill/stroke/currentColor).
2. **Sondas de estado individuais:** todas as ocorrências de um seletor são avaliadas, não apenas a primeira.
3. **Declaração CSS vencedora:** capturada via `CSS.getMatchedStylesForNode` para cada amostra.
4. **SVG fill/stroke/currentColor:** incluídos na detecção de consumidores.
5. **Hash reproduzível:** SHA-256 calculado sobre o objeto sem o campo hash, com verificação independente (`hashMatches: true`).
6. **Classificação incluindo foco/borda:** bordas e indicadores de foco participam da classificação com limiar 3:1.
7. **Pseudo-elementos sem amostra:** tratados como `null`, nunca como zero.

A R2.1 é adequada como base para a próxima etapa (análise independente das falhas e, eventualmente, correções delimitadas de CSS). A R1 e a R2 permanecem preservadas integralmente como registros históricos.

---
