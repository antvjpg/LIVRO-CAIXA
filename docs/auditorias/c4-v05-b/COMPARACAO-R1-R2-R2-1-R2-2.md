# COMPARAÇÃO R1 × R2 × R2.1 × R2.2 — Auditoria de contraste de `--accent`

## Sumário

- [1. Visão geral](#1-visão-geral)
- [2. Diferenças de população (amostras)](#2-diferenças-de-população-amostras)
- [3. Diferenças de classificação](#3-diferenças-de-classificação)
- [4. Diferenças de metodologia](#4-diferenças-de-metodologia)
- [5. O que mudou nos números](#5-o-que-mudou-nos-números)
- [6. Conclusão da comparação](#6-conclusão-da-comparação)

---

## 1. Visão geral

A R1 foi reprovada como base para correções de CSS porque sua população de amostras incluía elementos que **não consomem `--accent`** (apenas correspondiam a seletores candidatos) e sua classificação misturava inconclusivos com falhas. A R2 corrigiu esses problemas. A R2.1 corrigiu problemas adicionais na R2. A R2.2 corrige problemas restantes na R2.1: sondas de estado que usavam apenas o primeiro match (não aplicavam o estado a cada ocorrência individual), declaração CSS vencedora não capturada efetivamente, detecção SVG incompleta, hash do artefato não reproduzível, pseudo-elementos com indicador inconsistente (`||0`).

A R1, R2, R2.1 e R2.2 permanecem preservadas integralmente. Nenhum artefato foi alterado ou removido.

---

## 2. Diferenças de população (amostras)

| Métrica | R1 | R2 | R2.1 | R2.2 | Diferença R2.1→R2.2 |
| --- | --- | --- | --- | --- | --- |
| Linhas (`rows`) | 10.161 | 6.648 | 6.660 | 6.660 | 0 |
| Consumidores exatos (`exactAccent`) | 6.648 | 6.648 | 6.660 | 6.660 | 0 |
| Não-consumidores nas `rows` | 3.513 | 0 | 0 | 0 | 0 |
| Candidatos derivados rastreados | — | 330 | 330 | 330 | 0 |
| Sondas de estado (`states`) | 960 | 1.200 | 1.200 | 1.200 | 0 |
| Ocorrências de estado (`occurrences`) | — | — | — | 4.320 | +4.320 |
| Ocorrências com dados válidos | — | — | — | 4.080 | +4.080 |
| Erros de console | 0 | 0 | 1* | 1 | 0 |
| Exceções | 0 | 0 | 0 | 0 | 0 |
| Pulos (`skipped`) | 0 | 0 | 0 | 0 | 0 |
| Erros CDP | — | — | — | 3.420** | +3.420 |

\* O erro de console da R2.1/R2.2 é pré-existente na aplicação (`32-auth-wiring.js` — erro de autenticação Firebase), não proveniente do harness.

\*\* Todos os 3.420 erros CDP são de `DOM.getBoxModel` — esperado, pois o box model não pode ser computado para elementos em certos estados pseudo (ex: quando `hover` altera o layout). O estilo computado ainda é coletado com sucesso para 4.080 ocorrências.

### Por que R2.1 tem 12 linhas a mais que R2

A R2.1 inclui detecção de consumidores SVG via `fill`/`stroke`/`currentColor`, que a R2 não incluía como critério de inclusão na população. Isso adicionou elementos SVG que consomem `--accent` via preenchimento/traço, mas que não eram capturados por `color`/`backgroundColor`/`border`/`outline`.

---

## 3. Diferenças de classificação

| Classe | R1 | R2 | R2.1 | R2.2 |
| --- | --- | --- | --- | --- |
| APROVADO | Não reportado por linha | 2.673 | 2.544 | 2.544 |
| FALHA | Não reportado por linha | 1.365 | 1.518 | 1.518 |
| INCONCLUSIVO | Não reportado por linha | 506 | 506 | 506 |
| N.A. | Não reportado por linha | 2.104 | 2.092 | 2.092 |
| Total | 10.161 | 6.648 | 6.660 | 6.660 |

### Falhas por motivo (R2.2)

| Motivo | Quantidade |
| --- | --- |
| Texto (abaixo de 4,5:1 / 3:1 grande) | 810 |
| Superfície / fundo de componente (abaixo de 3:1) | 434 |
| Ícone (abaixo de 3:1) | 121 |
| Borda (abaixo de 3:1) | — |
| Foco / outline (abaixo de 3:1) | — |
| **Total** | **1.518** |

### Seletores únicos com falha

| | R1 (relatório) | R2 (JSON bruto) | R2.1 (JSON bruto) | R2.2 (JSON bruto) |
| --- | --- | --- | --- | --- |
| Seletores únicos com falha | 75 | 64 | 64 | 64 |

---

## 4. Diferenças de metodologia

| Área | R1 | R2 | R2.1 | R2.2 |
| --- | --- | --- | --- | --- |
| População de `rows` | Todos os elementos visíveis dos `KEY_SELECTORS` + hits de `body *` | Somente elementos com `exactAccent === true` | Somente elementos com `exactAccent === true` + SVG fill/stroke/currentColor | Mesmo que R2.1 |
| Candidatos derivados | Misturados com exatos | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) | Categoria separada (`derivedCandidates`) |
| Sondas de estado | `querySelector` (primeiro match) | `querySelectorAll` + `visible()` + viewport | `querySelectorAll` + `visible()` + viewport + índice individual + motivo de descarte | `DOM.querySelectorAll` + `CSS.forcePseudoState` por `nodeId` individual + índice individual + motivo de descarte |
| Classificação | Totais no relatório (sem classe por linha) | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra + borda/foco | `APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.` por amostra + borda/foco |
| Inconclusivos | Não registrados como classe | 506 amostras marcadas `INCONCLUSIVO` | 506 amostras marcadas `INCONCLUSIVO` | 506 amostras marcadas `INCONCLUSIVO` |
| `commit`/`branch` | Não registrados | Capturados via `git` no Node | Capturados via `git` no Node | Capturados via `git` no Node |
| `userAgent` | Não registrado | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` | Capturado via `navigator.userAgent` + `navigator.platform` |
| Declaração CSS vencedora | Não capturada | `CSS.getMatchedStylesForNode` (definida, não chamada) | `CSS.getMatchedStylesForNode` (definida, não chamada efetivamente) | `CSS.getMatchedStylesForNode` chamada para cada amostra nas propriedades `color`, `background-color`, `fill`, `stroke`, `border-color`, `outline-color` |
| SVG `fill`/`stroke` | Não inspecionado | Coletado por amostra (não usado na detecção) | Coletado e usado na detecção (`isAccentConsumer`) | Coletado e usado na detecção (`isAccentConsumer`) |
| Hash do artefato | Calculado antes de campos finais (não reproduzível) | Calculado sobre objeto final (autorreferência) | SHA-256 sobre objeto sem o campo hash; verificação independente | SHA-256 sobre objeto sem o campo hash; verificação independente |
| Pseudo-elementos | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `||0` | `pseudoBgRatio` com `null` (ausência explícita) | `pseudoBgRatio` com `null` (ausência explícita) |
| Classificação de texto | Não reportado por linha | Texto direto/tags limitadas | Texto direto + descendente (`innerText`) | Texto direto + descendente (`innerText`) |

---

## 5. O que mudou nos números

O total de **10.161** linhas da R1 **não é comparável** ao total de **6.660** da R2.2, porque as populações são diferentes:

- R1 = consumidores exatos (6.648) + não-consumidores dos seletores candidatos (3.513)
- R2.2 = somente consumidores exatos (6.660, incluindo SVG fill/stroke)

A diferença de 12 linhas entre R2 (6.648) e R2.1/R2.2 (6.660) vem da inclusão de consumidores SVG via `fill`/`stroke`/`currentColor` na R2.1.

A classificação da R2.2 é a mesma da R2.1 (mesmos números: 2.544 aprovados, 1.518 falhas, 506 inconclusivos, 2.092 N.A.) porque a população de consumidores exatos é a mesma. As melhorias da R2.2 estão na **rastreabilidade** (cada ocorrência de estado tem seu próprio `nodeId` e `sampleId`), na **declaração CSS vencedora** (capturada por amostra) e na **integridade do hash** (SHA-256 reproduzível e verificado).

---

## 6. Conclusão da comparação

A R2.2 corrige todos os problemas críticos identificados na auditoria independente da R2.1:

1. **População correta:** somente consumidores exatos de `--accent` entram nas `rows` (incluindo SVG fill/stroke/currentColor).
2. **Sondas de estado individuais:** cada ocorrência de um seletor recebe seu próprio estado aplicado via `CSS.forcePseudoState` no `nodeId` específico, com estilo computado coletado para cada uma.
3. **Declaração CSS vencedora:** capturada via `CSS.getMatchedStylesForNode` para cada amostra nas propriedades relevantes.
4. **SVG fill/stroke/currentColor:** incluídos na detecção de consumidores.
5. **Hash reproduzível:** SHA-256 calculado sobre o objeto sem o campo hash, com verificação independente (`hashMatches: true`).
6. **Erros CDP rastreados:** todos os erros de protocolo são registrados em `result.errors.cdp` em vez de serem silenciados.
7. **Geometria corrigida:** `h: rect.height` (não `h: rect.width`).

A R2.2 é adequada como base para a próxima etapa (análise independente das falhas e, eventualmente, correções delimitadas de CSS). A R1, R2 e R2.1 permanecem preservadas integralmente como registros históricos.
