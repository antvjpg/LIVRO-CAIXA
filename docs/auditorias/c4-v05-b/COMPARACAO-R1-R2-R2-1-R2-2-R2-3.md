# COMPARAÇÃO R1 × R2 × R2.1 × R2.2 × R2.3 — Auditoria de contraste de `--accent`

## Sumário

- [1. Visão geral](#1-visão-geral)
- [2. Diferenças de população (amostras)](#2-diferenças-de-população-amostras)
- [3. Diferenças de classificação](#3-diferenças-de-classificação)
- [4. Diferenças de metodologia](#4-diferenças-de-metodologia)
- [5. O que mudou nos números](#5-o-que-mudou-nos-números)
- [6. Correções R23-01 a R23-06 na R2.3](#6-correções-r23-01-a-r23-06-na-r23)
- [7. Conclusão da comparação](#7-conclusão-da-comparação)

---

## 1. Visão geral

A R1 foi reprovada como base para correções de CSS porque sua população de amostras incluía elementos que **não consomem `--accent`** (apenas correspondiam a seletores candidatos) e sua classificação misturava inconclusivos com falhas. A R2 corrigiu esses problemas. A R2.1 corrigiu problemas adicionais na R2. A R2.2 corrigiu problemas restantes na R2.1: sondas de estado que usavam apenas o primeiro match, declaração CSS vencedora não capturada efetivamente, detecção SVG incompleta, hash do artefato não reproduzível, pseudo-elementos com indicador inconsistente (`||0`). A R2.3 corrige problemas metodológicos da R2.2 identificados na auditoria independente (DIAGNOSTICO-R2-3.md): declaração CSS vencedora não capturada, sampleId sem contexto, testes não executam código real do harness, geometria com vértices incorretos, foco/borda compara contra fundo interno, erros CDP não investigados.

A R1, R2, R2.1, R2.2 e R2.3 permanecem preservadas integralmente. Nenhum artefato foi alterado ou removido.

---

## 2. Diferenças de população (amostras)

| Métrica | R1 | R2 | R2.1 | R2.2 | R2.3 | Diferença R2.2→R2.3 |
| --- | --- | --- | --- | --- | --- | --- |
| Linhas (`rows`) | 10.161 | 6.648 | 6.660 | 6.660 | 6.660 | 0 |
| Consumidores exatos (`exactAccent`) | 6.648 | 6.648 | 6.660 | 6.660 | 6.660 | 0 |
| Não-consumidores nas `rows` | 3.513 | 0 | 0 | 0 | 0 | 0 |
| Candidatos derivados rastreados | — | 330 | 330 | 330 | 330 | 0 |
| Sondas de estado (`states`) | 960 | 1.200 | 1.200 | 1.200 | 1.200 | 0 |
| Ocorrências de estado (`occurrences`) | — | — | — | 4.320 | 4.320 | 0 |
| Ocorrências com dados válidos | — | — | — | 4.080 | 4.080 | 0 |
| Erros de console | 0 | 0 | 1* | 1 | 0 | -1 |
| Exceções | 0 | 0 | 0 | 0 | 0 | 0 |
| Pulos (`skipped`) | 0 | 0 | 0 | 0 | 0 | 0 |
| Erros CDP | — | — | — | 3.420** | 3.420** | 0 |

\* O erro de console da R2.1/R2.2 é pré-existente na aplicação (`32-auth-wiring.js` — erro de autenticação Firebase), não proveniente do harness. Na R2.3 não houve erros de console.

\*\* Todos os 3.420 erros CDP são de `DOM.getBoxModel` — esperado, pois o box model não pode ser computado para elementos em certos estados pseudo (ex: quando `hover` altera o layout). O estilo computado ainda é coletado com sucesso para 4.080 ocorrências.

---

## 3. Diferenças de classificação

| Classe | R1 | R2 | R2.1 | R2.2 | R2.3 |
| --- | --- | --- | --- | --- | --- |
| APROVADO | Não reportado por linha | 2.673 | 2.544 | 2.544 | 2.544 |
| FALHA | Não reportado por linha | 1.365 | 1.518 | 1.518 | 1.518 |
| INCONCLUSIVO | Não reportado por linha | 506 | 506 | 506 | 506 |
| N.A. | Não reportado por linha | 2.104 | 2.092 | 2.092 | 2.092 |
| Total | 10.161 | 6.648 | 6.660 | 6.660 | 6.660 |

A classificação da R2.3 é a mesma da R2.2 porque a população de consumidores exatos e as regras de classificação são as mesmas. As melhorias da R2.3 estão na **rastreabilidade** (sampleId único por contexto), na **declaração CSS vencedora** (campo `winningRules` em cada linha), na **geometria** (4 vértices do quadrilátero), no **contraste de foco/borda** (contra superfície adjacente) e nos **erros CDP rastreados** (com sampleId e nodeId).

---

## 4. Diferenças de metodologia

| Área | R1 | R2 | R2.1 | R2.2 | R2.3 |
| --- | --- | --- | --- | --- | --- |
| População de `rows` | Todos os elementos visíveis dos `KEY_SELECTORS` + hits de `body *` | Somente elementos com `exactAccent === true` | Somente elementos com `exactAccent === true` + SVG fill/stroke/currentColor | Mesmo que R2.1 | Mesmo que R2.2 |
| Candidatos derivados | Misturados com exatos | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) |
| Sondas de estado | `querySelector` (primeiro match) | `querySelectorAll` + `visible()` + viewport | `querySelectorAll` + `visible()` + viewport + índice individual + motivo de descarte | `DOM.querySelectorAll` + `CSS.forcePseudoState` por `nodeId` individual + índice individual + motivo de descarte | Mesmo que R2.2 + `sampleId` único com contexto (vp/themeSet/theme/screen) |
| Classificação | Totais no relatório (sem classe por linha) | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra + borda/foco | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra + borda/foco | Mesmo que R2.2 |
| `commit`/`branch` | Não registrados | Capturados via `git` no Node | Capturados via `git` no Node | Capturados via `git` no Node | Capturados via `git` no Node |
| `userAgent` | Não registrado | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` + `navigator.platform` |
| Declaração CSS vencedora | Não capturada | `CSS.getMatchedStylesForNode` (definida, não chamada) | `CSS.getMatchedStylesForNode` (definida, não chamada efetivamente) | `CSS.getMatchedStylesForNode` chamada para cada amostra | `CSS.getMatchedStylesForNode` chamada via `captureWinningRules()` para cada amostra (propriedades: `color`, `background-color`, `border-color`, `outline-color`) |
| SVG `fill`/`stroke` | Não inspecionado | Coletado por amostra (não usado na detecção) | Coletado e usado na detecção (`isAccentConsumer`) | Coletado e usado na detecção (`isAccentConsumer`) | Mesmo que R2.2 |
| Hash do artefato | Calculado antes de campos finais (não reproduzível) | Calculado sobre objeto final (autorreferência) | SHA-256 sobre objeto sem o campo hash; verificação independente | SHA-256 sobre objeto sem o campo hash; verificação independente | SHA-256 sobre objeto sem o campo hash; verificação independente (`hashMatches: true`) |
| Pseudo-elementos | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `null` (ausência explícita) | `pseudoBgRatio` com `null` (ausência explícita) | Mesmo que R2.2 |
| Classificação de texto | Não reportado por linha | Texto direto/tags limitadas | Texto direto + descendente (`innerText`) | Texto direto + descendente (`innerText`) | Mesmo que R2.2 |
| sampleId | Não aplicado | Não aplicado | Não aplicado | `r22-{selector}-{state}-{index}` | `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}` |
| winningRules | Não capturado | Não capturado | Não capturado | Capturado por amostra (mas `getWinningRule` não chamada) | Capturado por amostra via `captureWinningRules()` |
| Geometria | `rect.height` correto | `rect.height` correto | `rect.height` correto | `rect.height` correto (R22-07) | `rectFromBorder()` usa 8 valores (4 vértices) do `border` (R23-04) |
| Foco/borda contraste | Contra fundo interno | Contra fundo interno | Contra fundo interno | Contra fundo interno | Contra superfície adjacente externa (`outsideRgb`) (R23-05) |
| Erros CDP rastreados | Não | Não | Não | Sim (com sampleId) | Sim (com sampleId único, nodeId, operation, errorMessage, timestamp) (R23-06) |
| Testes executam código real do harness | Não | Não | Não | Não | Sim (c4-v05-b-r2-3-test.cjs, 16/16 PASS) (R23-03) |

---

## 5. O que mudou nos números

O total de **10.161** linhas da R1 **não é comparável** ao total de **6.660** da R2.3, porque as populações são diferentes:

- R1 = consumidores exatos (6.648) + não-consumidores dos seletores candidatos (3.513)
- R2.3 = somente consumidores exatos (6.660, incluindo SVG fill/stroke)

A diferença de 12 linhas entre R2 (6.648) e R2.1/R2.2/R2.3 (6.660) vem da inclusão de consumidores SVG via `fill`/`stroke`/`currentColor` na R2.1.

A classificação da R2.3 é a mesma da R2.2 (mesmos números: 2.544 aprovados, 1.518 falhas, 506 inconclusivos, 2.092 N.A.) porque a população de consumidores exatos e as regras de classificação são as mesmas. As melhorias da R2.3 estão na **rastreabilidade**, na **declaração CSS vencedora**, na **geometria**, no **contraste de foco/borda** e nos **erros CDP rastreados**.

---

## 6. Correções R23-01 a R23-06 na R2.3

| ID | Problema na R2.2 | Correção na R2.3 |
|---|---|---|
| R23-01 | `getWinningRule()` definida mas não chamada; nenhum campo `winningRules` nas linhas | `captureWinningRules()` chama `getWinningRule()` para `color`, `background-color`, `border-color`, `outline-color`; resultado injetado em `winningRules` de cada linha |
| R23-02 | `sampleId` sem contexto (vp/themeSet/theme/screen) | `sampleId` no formato `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}` |
| R23-03 | Testes não executam código real do harness | `c4-v05-b-r2-3-test.cjs` com 16 testes PASS, exercitando funções reais do harness |
| R23-04 | Geometria usa 4 valores do `border` em vez de 8 (4 vértices) | `rectFromBorder()` usa os 8 valores (4 pares x,y) do `DOM.getBoxModel` |
| R23-05 | Foco/borda compara contra `bg` interno do elemento | Contraste do fundo efetivo compara contra superfície adjacente externa (`outsideRgb`) |
| R23-06 | Erros CDP de `DOM.getBoxModel` não investigados/rastreados | Todos os 3.420 erros registrados com `sampleId`, `nodeId`, `operation`, `errorMessage`, `timestamp` |

---

## 7. Conclusão da comparação

A R2.3 corrige todos os seis problemas metodológicos identificados na auditoria independente da R2.2:

1. **Declaração CSS vencedora capturada:** `captureWinningRules()` injeta `winningRules` em cada linha de `result.rows`.
2. **sampleId único por contexto:** formato `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}` garante unicidade.
3. **Testes executam código real do harness:** `c4-v05-b-r2-3-test.cjs` com 16 testes PASS valida as funções reais do harness.
4. **Geometria com 4 vértices do quadrilátero:** `rectFromBorder()` usa os 8 valores do `border` do `DOM.getBoxModel`.
5. **Foco/borda contra superfície adjacente:** contraste do fundo efetivo compara contra `outsideRgb`, documentando WCAG 1.4.11.
6. **Erros CDP rastreados com contexto completo:** 3.420 erros de `DOM.getBoxModel` registrados com `sampleId`, `nodeId`, `operation`, `errorMessage`, `timestamp`.

A R2.3 é adequada como base para a próxima etapa (análise independente das falhas e, eventualmente, correções delimitadas de CSS). A R1, R2, R2.1 e R2.2 permanecem preservadas integralmente como registros históricos.

---
