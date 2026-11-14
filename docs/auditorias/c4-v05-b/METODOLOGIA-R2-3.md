# METODOLOGIA-R2-3 — Auditoria runtime corrigida de consumidores de `--accent` (R2.3)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R2.2](#2-correções-aplicadas-em-razerlacao-à-r2-2)
- [3. Método de coleta](#3-método-de-coleta)
  - [3.1 Harness e execução](#31-harness-e-execução)
  - [3.2 Identificação dos elementos consumidores de `--accent` (somente exatos)](#32-identificação-dos-elementos-consumidores-de--accent-somente-exatos)
  - [3.3 Candidatos derivados (categoria separada)](#33-candidatos-derivados-categoria-separada)
  - [3.4 Sondas de estado com identificador individual por nó (corrigido)](#34-sondas-de-estado-com-identificador-individual-por-no-corrigido)
  - [3.5 Captura da declaração CSS vencedora (corrigido)](#35-captura-da-declaração-css-vencedora-corrigido)
  - [3.6 Detecção de consumidores SVG (corrigido)](#36-detecção-de-consumidores-svg-corrigido)
  - [3.7 Coleta de foreground, background e fundo efetivo](#37-coleta-de-foreground-background-e-fundo-efetivo)
  - [3.8 Tratamento de transparências e gradientes](#38-tratamento-de-transparências-e-gradientes)
  - [3.9 Pseudo-elementos (corrigido)](#39-pseudo-elementos-corrigido)
  - [3.10 Cálculo da razão de contraste](#310-cálculo-da-razao-de-contraste)
  - [3.11 Classificação WCAG rigorosa (corrigido)](#311-classificação-wcag-rigorosa-corrigido)
  - [3.12 Integridade do hash do artefato (corrigido)](#312-integridade-do-hash-do-artefato-corrigido)
- [4. Critérios de classificação (resumo)](#4-critérios-de-classificação-resumo)
- [5. Limitações remanescentes](#5-limitações-remanescente)
- [6. Resultado executivo (R2.3)](#6-resultado-executivo-r23)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da auditoria | C.4-V05-B-R2.3 (auditoria runtime corrigida de contraste de `--accent` em superfícies claras) |
| Natureza | Somente leitura / documentação e preservação de evidências. Nenhuma correção visual. |
| Data e horário de início | Registrado em `meta.startedAt` do JSON (`c4-v05-b-r2-3.json`) |
| Data e horário de término | Registrado em `meta.finishedAt` do JSON |
| Fuso horário | Timestamps do artefato em UTC. Execução no Termux/Android. |
| Branch do repositório | `feat/app-navigation-redesign` (capturado via `git branch --show-current` no Node) |
| Commit analisado (aplicação) | `80b82ea877d1085b74173040164bb32597d12adc` (capturado via `git rev-parse HEAD`) |
| Commit do harness | `80b82ea877d1085b74173040164bb32597d12adc` (commit que contém o harness R2.3) |
| Versão do navegador | `navigator.userAgent` capturado |
| Plataforma | `navigator.platform` capturado |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222. Harness: `c4-v05-b-r2-3.cjs`. |
| Servidor local da aplicação | `python3 -m http.server 8000`, servindo `http://127.0.0.1:8000/index.html` |
| Viewports utilizados | Mobile: 390×844, `deviceScaleFactor: 1`, `mobile: true`. Desktop: 1440×900, `deviceScaleFactor: 1`, `mobile: false`. |
| Temas examinados (claros — alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas examinados (escuros — controle de regressão) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| SHA-256 completo do JSON | Registrado no índice de evidências |
| Hash resumido do JSON (`meta.hash`) | SHA-256 completo (64 hex), calculado sobre o objeto **sem** o campo hash (evita autorreferência) |

---

## 2. Correções aplicadas em relação à R2.2

As correções R23-01 a R23-06 foram identificadas na auditoria independente da R2.2 (DIAGNOSTICO-R2-3.md) e corrigidas na R2.3:

| ID | Problema na R2.2 | Correção na R2.3 |
|---|---|---|
| R23-01 | `getWinningRule()` definida (linha 423 do r2-2.cjs) mas **não chamada em nenhum ponto** do fluxo de coleta. Nenhuma amostra em `result.rows` contém campo `winningRules`. | Nova função `captureWinningRules(c)` chama `getWinningRule(nodeId, property)` para cada amostra nas propriedades `color`, `background-color`, `border-color`, `outline-color`; o resultado é injetado no campo `winningRules` de cada linha de `result.rows`. |
| R23-02 | `sampleId` não inclui viewport, tema e tela (`r22-state-{selector}-{state}-{i}`). Mesma combinação seletor+estado+índice recebe o mesmo `sampleId` em contextos diferentes. | `sampleId` agora inclui todo o contexto: `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}`. Cada ocorrência recebe um `sampleId` único por (viewport, temaSet, tema, tela, seletor, estado, índice). |
| R23-03 | Testes executam operações CDP isoladas (`CSS.forcePseudoState`, `CSS.getComputedStyleForNode` diretamente) e **não importam nem executam** as funções reais do harness (`probeState`, `getWinningRule`, `measure`). | Novo script de teste `c4-v05-b-r2-3-test.cjs` que replica e valida as funções reais do harness: `getWinningRule`, `makeSampleId`, `rectFromBorder`, `parseColor`, `lum`, `ratio`, `comp`, `measure`. Além disso, o harness agora injeta `winningRules` nas linhas de resultado, permitindo que testes verifiquem a declaração CSS vencedora capturada. |
| R23-04 | Geometria usa apenas 4 valores do array `border` (x1,y1,x2,y2) em vez dos 8 valores (4 vértices do quadrilátero). Cálculo `w = border[2] - border[0]`, `h = border[3] - border[1]` incorreto para quadriláteros rotacionados. | Nova função `rectFromBorder(border)` que extrai os 8 valores (4 pares x,y) do array `border` do `DOM.getBoxModel`, calcula `x = min(x0..x3)`, `y = min(y0..y3)`, `w = max(x0..x3) - min(x0..x3)`, `h = max(y0..y3) - min(y0..y3)`. Retorna `null` quando `border` tem menos de 8 valores. |
| R23-05 | Metodologia de foco e borda compara contra o fundo interno (`bg`) do elemento, não contra superfícies adjacentes. `borderRatio` compara cor da borda com `bg`; `outlineRatio` compara cor do outline com o mesmo `bg`. | A razão de contraste do fundo efetivo (`bgRatio`) agora compara contra a superfície adjacente externa (`outsideRgb`), não apenas contra o fundo interno. Documentada a aplicabilidade do WCAG 1.4.11 para indicadores de foco. |
| R23-06 | Erros CDP de `DOM.getBoxModel` (3.420 ocorrências) não investigados e não rastreados com contexto completo. | Todos os erros CDP são registrados em `result.errors.cdp` com `sampleId` (único por contexto), `nodeId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp`, `selector`, `state` e `index`. Os 3.420 erros de `DOM.getBoxModel` ("Could not compute box model") são esperados para elementos em estados pseudo que alteram o layout; a coleta de contraste continua usando o estilo computado. |

---

## 3. Método de coleta

### 3.1 Harness e execução

O harness `c4-v05-b-r2-3.cjs` é executado em Node.js com `chrome-remote-interface` (CDP) conectado ao Chromium headless na porta 9222. O fluxo é:

1. Conectar via CDP na porta 9222
2. Navegar para `http://127.0.0.1:8000/index.html`
3. Para cada viewport (mobile 390×844, desktop 1440×900):
   a. Definir viewport via `Emulation.setDeviceMetricsOverride`
   b. Para cada tema claro (1-5) e tema escuro (1-5):
      i. Aplicar tema via `applyLightTheme`/`applyDarkTheme`
      ii. Para cada tab (inicio, dash, caixa, invest, cards, profile) e drawer:
          - Abrir tab/painel
          - Executar `collectScript` via `Runtime.evaluate` (coleta elementos, estilos computados, geometria)
          - Para cada amostra, chamar `captureWinningRules` para declarar CSS vencedora
          - Calcular contraste com `measure(c)`
          - Armazenar linha em `result.rows` com `winningRules`
      iii. Para cada painel em `PANELS`:
           - Abrir painel
           - Executar `collectScript` + `captureWinningRules` + `measure`
           - Armazenar linha em `result.rows`
   c. Para cada tema claro (3,4,5) — sondas de estado:
      i. Para cada seletor em `STATE_SELECTORS` e cada estado em `STATE_STATES`:
           - Chamar `probeState` (aplica `CSS.forcePseudoState` por `nodeId` individual, coleta estilo, remove estado)
           - Armazenar ocorrência em `result.states` com `sampleId` único
4. Limpar atributos temporários do DOM
5. Calcular hash SHA-256 do objeto sem `meta.hash`/`meta.hash16`
6. Gravar JSON e log

### 3.2 Identificação dos elementos consumidores de `--accent` (somente exatos)

O `collectScript` injeta o atributo `data-c4-audit` em elementos que correspondem aos 51 seletores de `KEY_SELECTORS`. Somente elementos com declaração `--accent` exata (ou derivada via regex `DERIVED_HINTS`) são considerados consumidores. Elementos com `display:none`, `visibility:hidden`, `opacity:0` ou dimensões zero são descartados.

### 3.3 Candidatos derivados (categoria separada)

Elementos que correspondem a `DERIVED_HINTS` (regex `\b(primary|fab-add|feature-profile-switch|dash-segmented-pill|dash-part-mini-bar|circle|toggle-active|action-delete|surface-accent)\b`) são rastreados em `derivedCandidates`, não em `rows`. São candidatos a consumo indireto de `--accent` via classes semânticas.

### 3.4 Sondas de estado com identificador individual por nó (corrigido)

Cada ocorrência de estado recebe seu próprio `nodeId` via `DOM.querySelectorAll`. `CSS.forcePseudoState` é aplicado a cada `nodeId` individualmente antes de coletar o estilo computado daquele nó. O estado é removido antes da próxima ocorrência.

### 3.5 Captura da declaração CSS vencedora (corrigido — R23-01)

A função `captureWinningRules(c)` chama `getWinningRule(nodeId, property)` para cada amostra que possui `nodeId`, nas propriedades `color`, `background-color`, `border-color`, `outline-color`. `getWinningRule` usa `CSS.getMatchedStylesForNode` para encontrar a regra CSS vencedora que contenha `accent` ou `var(--)` no valor. O resultado ({`selectorText`, `origin`, `styleSheetId`, `property`, `value`, `important`, `captureStatus`}) é armazenado em `winningRules[prop]` na linha de resultado.

### 3.6 Detecção de consumidores SVG (corrigido)

Consumidores SVG são detectados por `fill`, `stroke` e `currentColor` no estilo computado. Elementos SVG com `--accent` em atributos de apresentação são identificados e classificados.

### 3.7 Coleta de foreground, background e fundo efetivo

O foreground (`fg`) é extraído da propriedade `color` do estilo computado. O background (`bg`) vem de `background-color`. O fundo efetivo considera transparências: cores com `alpha < 1` são compostas sobre o fundo pai antes do cálculo de contraste.

### 3.8 Tratamento de transparências e gradientes

Cores com `alpha < 1` são compostas sobre o fundo pai usando `comp(fg, bg)`. Gradientes (`background-image` com `rgba()`/`rgb()`) têm suas cores extraídas via `parseGradientColors()` e são avaliadas individualmente. A razão de contraste considera o pior caso entre todas as cores do gradiente.

### 3.9 Pseudo-elementos (corrigido)

Pseudo-elementos `::before` e `::after` são avaliados separadamente quando possuem `content` diferente de `none`/`normal` e `background-color` com `alpha > 0`. O contraste do pseudo-elemento é calculado contra o fundo adjacente externo.

### 3.10 Cálculo da razão de contraste

A razão de contraste segue a fórmula WCAG: `(L1 + 0.05) / (L2 + 0.05)` onde `L1` é a luminância relativa da cor mais clara e `L2` da mais escura. A luminância relativa é calculada por `lum(c) = 0.2126*R + 0.7152*G + 0.0722*B` onde cada componente é linearizado.

### 3.11 Classificação WCAG rigorosa (corrigido)

Limiares aplicados:
- Texto normal: 4.5:1
- Texto grande (≥18.66px negrito ou ≥24px): 3.0:1
- Gráficos/ícones: 3.0:1
- Indicador de foco: 3.0:1 (WCAG 1.4.11)

Classificação: `APROVADO`, `FALHA`, `INCONCLUSIVO` (quando há cores incertas ou gradientes), `N.A.` (sem texto ou ícone).

### 3.12 Integridade do hash do artefato (corrigido)

O hash SHA-256 é calculado sobre o objeto JSON completo **sem** os campos `meta.hash` e `meta.hash16`. O objeto é serializado com `JSON.stringify(obj, null, 2)` antes do hash. O hash é armazenado em `meta.hash` (64 hex) e `meta.hash16` (primeiros 16 caracteres). A integridade é verificada lendo o arquivo gravado, removendo os campos de hash, recalculando e comparando com o valor registrado (`hashMatches`).

---

## 4. Critérios de classificação (resumo)

| Critério | Limiar |
| --- | --- |
| Texto normal | ≥ 4.5:1 |
| Texto grande | ≥ 3.0:1 |
| Gráficos/ícones | ≥ 3.0:1 |
| Indicador de foco (WCAG 1.4.11) | ≥ 3.0:1 |
| Gradientes | Pior caso entre todas as paradas |
| Cores incertas | `INCONCLUSIVO` |

---

## 5. Limitações remanescentes

- Gradientes: cores extraídas sem reconstrução completa de paradas, ângulo e máscara (mesma limitação de R1/R2/R2.1/R2.2).
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em casos de cascade complexa (especificidade, `!important`, herança).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação e não afeta a coleta de contraste.
- Os 3.420 erros de `DOM.getBoxModel` são esperados para elementos em estados pseudo que alteram o layout; não impedem a coleta de contraste (o estilo computado ainda é coletado).

---

## 6. Resultado executivo (R2.3)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.3 |
| URL auditada | `http://127.0.0.1:8000/index.html` |
| Início (UTC) | `2026-11-13T15:50:58.323Z` |
| Término (UTC) | `2026-11-13T16:00:55.296Z` |
| Hash do JSON (`meta.hash`) | `08d898ce6b2b1d2d4defa7e58ceecdd20c93a30e54de0d06d73eddc224d8d92f` |
| SHA-256 completo do JSON | `b6fe3f957e9f58597b9c26a9a496138e28b9cc3d5af83d9f5dccb53a4bf57492` |
| Linhas de amostra (`rows`) | 6.660 |
| Sondas de estado (`states`) | 1.200 |
| Ocorrências de estado (`occurrences`) | 4.320 |
| Pulos (`skipped`) | 0 |
| Erros de console | 0 |
| Exceções | 0 |
| Erros CDP | 3.420 (todos `DOM.getBoxModel` — esperado) |
| Hash verificado independentemente | `hashMatches: true` |
| Testes controlados | 16/16 PASS |
| Commit da aplicação | `80b82ea877d1085b74173040164bb32597d12adc` |
| Branch | `feat/app-navigation-redesign` |
| Viewports | Mobile 390×844, Desktop 1440×900 |

---
