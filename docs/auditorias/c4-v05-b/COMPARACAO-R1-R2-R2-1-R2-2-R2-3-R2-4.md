# COMPARAÇÃO R1 × R2 × R2.1 × R2.2 × R2.3 × R2.4 — Auditoria de contraste de `--accent`

## Sumário

- [1. Visão geral](#1-visão-geral)
- [2. Diferenças de população (amostras)](#2-diferenças-de-população-amostras)
- [3. Diferenças de classificação](#3-diferenças-de-classificação)
- [4. Diferenças de metodologia](#4-diferenças-de-metodologia)
- [5. Correções R24-01 a R24-08 na R2.4](#5-correções-r24-01-a-r24-08-na-r24)
- [6. Status de comprovação por teste](#6-status-de-comprovação-por-teste)
- [7. Conclusão da comparação](#7-conclusão-da-comparação)

---

## 1. Visão geral

A R1 foi reprovada como base para correções de CSS porque sua população de amostras incluía elementos que **não consomem `--accent`** e sua classificação misturava inconclusivos com falhas. A R2 corrigiu esses problemas. A R2.1 corrigiu problemas adicionais na R2. A R2.2 corrigiu problemas restantes na R2.1. A R2.3 corrigiu problemas metodológicos da R2.2. A R2.4 valida as correções da R2.3 com testes controlados que executam o código real do harness.

A R1, R2, R2.1, R2.2, R2.3 e R2.4 permanecem preservadas integralmente. Nenhum artefato foi alterado ou removido.

A R2.4 não executa uma coleta completa do aplicativo — apenas validação controlada com testes.

---

## 2. Diferenças de população (amostras)

| Métrica | R1 | R2 | R2.1 | R2.2 | R2.3 | R2.4 |
| --- | --- | --- | --- | --- | --- | --- |
| Linhas (`rows`) | 10.161 | 6.648 | 6.660 | 6.660 | 6.660 | — |
| Consumidores exatos (`exactAccent`) | 6.648 | 6.648 | 6.660 | 6.660 | 6.660 | — |
| Não-consumidores nas `rows` | 3.513 | 0 | 0 | 0 | 0 | — |
| Candidatos derivados rastreados | — | 330 | 330 | 330 | 330 | — |
| Sondas de estado (`states`) | 960 | 1.200 | 1.200 | 1.200 | 1.200 | — |
| Ocorrências de estado (`occurrences`) | — | — | — | 4.320 | 4.320 | — |
| Ocorrências com dados válidos | — | — | — | 4.080 | 4.080 | — |
| Erros de console | 0 | 0 | 1* | 1 | 0 | — |
| Exceções | 0 | 0 | 0 | 0 | 0 | — |
| Pulos (`skipped`) | 0 | 0 | 0 | 0 | 0 | — |
| Erros CDP | — | — | — | 3.420** | 3.420** | — |
| Testes controlados | — | — | — | — | 16/16 PASS | 61/61 PASS |

\* O erro de console da R2.1/R2.2 é pré-existente na aplicação (`32-auth-wiring.js`).
\*\* Todos os erros CDP são de `DOM.getBoxModel` — esperado para estados pseudo que alteram o layout.

**R2.4 não produz dados de coleta completa** — apenas resultados de testes controlados.

---

## 3. Diferenças de classificação

| Classe | R1 | R2 | R2.1 | R2.2 | R2.3 | R2.4 |
| --- | --- | --- | --- | --- | --- | --- |
| APROVADO | Não reportado | 2.673 | 2.544 | 2.544 | 2.544 | — |
| FALHA | Não reportado | 1.365 | 1.518 | 1.518 | 1.518 | — |
| INCONCLUSIVO | Não reportado | 506 | 506 | 506 | 506 | — |
| N.A. | Não reportado | 2.104 | 2.092 | 2.092 | 2.092 | — |
| Total | 10.161 | 6.648 | 6.660 | 6.660 | 6.660 | — |

**R2.4 não altera a classificação** — apenas valida o mecanismo de captura e medição.

---

## 4. Diferenças de metodologia

| Área | R1 | R2 | R2.1 | R2.2 | R2.3 | R2.4 |
| --- | --- | --- | --- | --- | --- | --- |
| População de `rows` | Todos visíveis dos `KEY_SELECTORS` | Somente `exactAccent === true` | Exatos + SVG fill/stroke | Mesmo que R2.1 | Mesmo que R2.2 | Não executa coleta |
| Candidatos derivados | Misturados | Categoria separada | Categoria separada | Categoria separada | Categoria separada | Não executa coleta |
| Sondas de estado | `querySelector` (primeiro match) | `querySelectorAll` + `visible` | `querySelectorAll` + índice individual | `DOM.querySelectorAll` + `nodeId` individual | Mesmo que R2.2 + `sampleId` com contexto | Núcleo testável com `probeState` |
| Classificação | Totais no relatório | Por amostra | Por amostra + borda/foco | Por amostra + borda/foco | Mesmo que R2.2 | `measure()` real no teste |
| `commit`/`branch` | Não registrados | Capturados via `git` | Capturados via `git` | Capturados via `git` | Capturados via `git` | Commit-base documentado |
| `userAgent` | Não registrado | Capturado | Capturado | Capturado | Capturado + platform | Não executa coleta |
| Declaração CSS vencedora | Não capturada | Definida, não chamada | Definida, não chamada efetivamente | Chamada por amostra | Chamada via `captureWinningRules` | `getWinningRule` real no teste |
| `sampleId` | Não aplicado | Não aplicado | Não aplicado | `r22-{selector}-{state}-{index}` | `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}` | `r24-{vp}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` |
| `winningRules` | Não capturado | Não capturado | Não capturado | Capturado (mas `getWinningRule` não chamada) | Capturado por amostra | Núcleo real testável |
| Geometria | `rect.height` correto | `rect.height` correto | `rect.height` correto | `rect.height` correto | `rectFromBorder` (4 vértices) | `rectFromBorder` real no teste |
| Foco/borda contraste | Contra fundo interno | Contra fundo interno | Contra fundo interno | Contra fundo interno | Contra superfície adjacente (`bgRatio`) | `measure()` real no teste |
| Erros CDP rastreados | Não | Não | Não | Sim (com sampleId) | Sim (com sampleId único) | `probeState` real com `try/finally` |
| Testes executam código real | Não | Não | Não | Não | Sim (16/16 PASS) | Sim (61/61 PASS) |
| Pseudoestado try/finally | Não | Não | Não | Não | Não | Sim (`probeState` no núcleo) |
| `!important` via `getPropertyPriority` | Não | Não | Não | Não | Não | Sim (API antiga + moderna) |

---

## 5. Correções R24-01 a R24-08 na R2.4

| ID | Problema na R2.3 | Correção na R2.4 | Comprovado por teste |
|---|---|---|---|
| R24-01 | `captureWinningRules` retorna `{}` (sem `nodeId`) | `key → nodeId` via `data-c4-audit`; `captureWinningRules(c, nodeId)` | A1, A2 |
| R24-02 | `sampleId` prefixo `r23-`; tema incorreto nas sondas | Prefixo `r24-` com hash; `themeSet` explícito; `Set` de unicidade | B1-B8 |
| R24-03 | Testes replicam funções; `String.includes` | Núcleo compartilhado importado por ambos | A-F (todos usam núcleo real) |
| R24-04 | (preservado) Geometria 4 vértices | `rectFromBorder` no núcleo | C1-C5 |
| R24-05 | `bgRatio` vs superfície adjacente | Mantido (`outsideRgb`) | D9 |
| R24-06 | Erros CDP sem classificação; limpeza sem try/finally | `try/finally`; erros rastreados com contexto | E7, F1-F5 |
| R24-07 | API CDP antiga apenas | Suporte a `cssProperties` + API antiga; `getPropertyPriority` | A3-A10 |
| R24-08 | Visibilidade incompleta | `visibilityStatus` (`display`, `visibility`, `opacity`, dimensões) | E1-E10 |

---

## 6. Status de comprovação por teste

| Correção | Implementada | Comprovada por teste | Testes |
|---|---|---|---|
| R24-01 | Sim | Sim | A1, A2 |
| R24-02 | Sim | Sim | B1-B8 |
| R24-03 | Sim | Sim | A-F (núcleo compartilhado) |
| R24-04 | Sim | Sim | C1-C5 |
| R24-05 | Sim | Sim | D9 |
| R24-06 | Sim | Sim | E7, F1-F5 |
| R24-07 | Sim | Sim | A3-A10 |
| R24-08 | Sim | Sim | E1-E10 |

**Total: 8/8 correções implementadas e comprovadas por teste.**

---

## 7. Conclusão da comparação

A R2.4 valida todas as oito correções metodológicas identificadas na auditoria da R2.3:

1. **Associação chave → nodeId:** `data-c4-audit` é usado para resolver `nodeId` após coleta; `captureWinningRules` recebe `nodeId` real.
2. **sampleId único por contexto:** Formato `r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` com controle global de unicidade.
3. **Testes executam código real:** Núcleo compartilhado importado por harness e testes; nenhuma função duplicada.
4. **Geometria com 4 vértices:** `rectFromBorder` usa 8 valores do `border` do `DOM.getBoxModel`.
5. **Fundo vs superfície adjacente:** `bgRatio` compara contra `outsideRgb`.
6. **Limpeza de pseudoestado:** `try/finally` garante remoção mesmo após exceção.
7. **Leitura CDP moderna:** Suporte a `cssProperties` array e API antiga fallback.
8. **Validação de visibilidade:** `visibilityStatus` baseado em `display`, `visibility`, `opacity`, dimensões.

Todos os 61 testes controlados passaram. A R2.4 está pronta para servir como base de uma futura coleta completa, após auditoria independente.

A R1, R2, R2.1, R2.2 e R2.3 permanecem preservadas integralmente como registros históricos.

---
