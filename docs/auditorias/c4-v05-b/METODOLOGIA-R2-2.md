# METODOLOGIA-R2-2 — Auditoria runtime corrigida de consumidores de `--accent` (R2.2)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R2.1](#2-correções-aplicadas-em-razerlacao-à-r2-1)
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
- [6. Resultado executivo (R2.2)](#6-resultado-executivo-r22)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da auditoria | C.4-V05-B-R2.2 (auditoria runtime corrigida de contraste de `--accent` em superfícies claras) |
| Natureza | Somente leitura / documentação e preservação de evidências. Nenhuma correção visual. |
| Data e horário de início | Registrado em `meta.startedAt` do JSON (`c4-v05-b-r2-2.json`) |
| Data e horário de término | Registrado em `meta.finishedAt` do JSON |
| Fuso horário | Timestamps do artefato em UTC. Execução no Termux/Android. |
| Branch do repositório | `feat/app-navigation-redesign` (capturado via `git branch --show-current` no Node) |
| Commit analisado (aplicação) | `30434a9fcc98e715398fa1f9977aed1feeaa3000` (capturado via `git rev-parse HEAD`) |
| Commit do harness | `30434a9fcc98e715398fa1f9977aed1feeaa3000` (commit que contém o harness R2.2) |
| Versão do navegador | `navigator.userAgent` capturado |
| Plataforma | `navigator.platform` capturado |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222. Harness: `c4-v05-b-r2-2.cjs`. |
| Servidor local da aplicação | `python3 -m http.server 8000`, servindo `http://127.0.0.1:8000/index.html` |
| Viewports utilizados | Mobile: 390×844, `deviceScaleFactor: 1`, `mobile: true`. Desktop: 1440×900, `deviceScaleFactor: 1`, `mobile: false`. |
| Temas examinados (claros — alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas examinados (escuros — controle de regressão) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| SHA-256 completo do JSON | Registrado no índice de evidências |
| Hash resumido do JSON (`meta.hash`) | SHA-256 completo (64 hex), calculado sobre o objeto **sem** o campo hash (evita autorreferência) |

---

## 2. Correções aplicadas em relação à R2.1

| # | Problema na R2.1 | Correção na R2.2 |
|---|---|---|
| R22-01 | `CSS.forcePseudoState` aplicado apenas ao primeiro `nodeId` via `document.querySelector()` | Cada ocorrência recebe seu próprio `nodeId` via `DOM.querySelectorAll`; `CSS.forcePseudoState` é aplicado a cada `nodeId` individualmente antes de coletar o estilo computado daquele nó |
| R22-02 | Coleta de todas as ocorrências sem aplicar o estado individualmente | `DOM.querySelectorAll` retorna todos os `nodeIds`; cada um recebe o estado, tem o estilo coletado e o estado é removido antes da próxima ocorrência |
| R22-03 | `getNodeIdBySelectorIndex()` retornava sempre `null` | Substituído por uso direto de `DOM.querySelectorAll` que retorna `nodeIds` válidos para cada ocorrência |
| R22-04 | `getWinningRule()` definida mas nunca chamada | Integrada ao fluxo: chamada para cada amostra nas propriedades `color`, `background-color`, `fill`, `stroke`, `border-color`, `outline-color`; resultado armazenado em `winningRules` por amostra |
| R22-05 | Nenhuma associação verificável entre regra vencedora e amostra | Cada amostra inclui campo `winningRules` com `selectorText`, `origin`, `styleSheetId`, `property`, `value`, `important`, `matched`, `captureStatus` |
| R22-06 | Erros do CDP descartados silenciosamente (`catch (e) { /* ignore */ }`) | Todos os erros CDP são registrados em `result.errors.cdp` com `sampleId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp` |
| R22-07 | Altura incorreta no registro geométrico (`h:rect.width` em vez de `h:rect.height`) | Corrigido para `h: rect.height` em todos os caminhos de coleta de geometria |
| R22-08 | Classificação de bordas e foco sem demonstração suficiente de contraste adjacente | Separação entre borda estrutural, indicador de foco, contorno decorativo; classificação de foco considera cores adjacentes; documento de limitações do critério WCAG 1.4.11 |

---

## 3. Método de coleta

### 3.1 Harness e execução

O harness `c4-v05-b-r2-2.cjs` executa em Node.js, conecta ao CDP na porta 9222, habilita os domínios `Page`, `Runtime`, `DOM`, `CSS`, `Emulation`, navega para `http://127.0.0.1:8000/index.html`, aguarda o estado de prontidão da aplicação, injeta um `<style id="c4-audit-style">` que oculta `#authOverlay`/`#syncOverlay` e desativa transições/animações, e itera sobre combinações de viewport × tema × tela/painel.

Ao final, remove marcadores temporários, remove o estilo injetado, remove `dark-mode`, reaplica o tema claro 1 (Oliva) e grava o resultado JSON com hash reproduzível.

### 3.2 Identificação dos elementos consumidores de `--accent` (somente exatos)

A coleta de elementos é feita pelo script `collectScript` injetado via `Runtime.evaluate`:

1. Obtém o valor computado de `--accent` em `document.body` (`getComputedStyle(document.body).getPropertyValue('--accent').trim()`), chamado `accentRaw`.
2. Executa `document.querySelectorAll(KEY_SELECTORS.join(','))` sobre os 46 seletores candidatos. **Somente elementos visíveis que passam no teste `isAccentConsumer` entram na população `known`.**
3. Executa `document.querySelectorAll('body *')` sobre todos os elementos do corpo. **Somente elementos visíveis que passam no teste `isAccentConsumer` entram na população `known`.**
4. A função `isAccentConsumer(el)` retorna `{consumed:true, property}` quando há correspondência exata (`exact`) de `accentRaw` em qualquer um destes:
   - `color` do elemento
   - `backgroundColor` do elemento
   - `borderTopColor` (quando `borderTopWidth > 0` e `borderTopStyle !== 'none'`)
   - `outlineColor` (quando `outlineWidth > 0` e `outlineStyle !== 'none'`)
   - `color` de `::before` ou `::after` (quando `content` não é `none`/`normal`)
   - `backgroundColor` de `::before` ou `::after` (quando `content` não é `none`/`normal` e largura > 0)
   - `fill` do SVG (atributo ou computed)
   - `stroke` do SVG (atributo ou computed)
   - `currentColor` resolvido (quando `fill`/`stroke` são `currentColor` e `color` do elemento é `--accent`)

A correspondência exata compara canais RGBA com tolerância de 0.5 nos canais RGB e 0.01 no alfa, após parsing de `rgba()`, `rgb()`, `color(srgb ...)` e `#RRGGBB[AA]`.

A propriedade responsável pela inclusão é registrada em `accentProperty` na amostra.

### 3.3 Candidatos derivados (categoria separada)

Elementos que correspondem a padrões temáticos sugerindo uso de `--accent` (classes como `primary`, `fab-add`, `feature-profile-switch`, etc.) mas **não** passam no teste exato são rastreados em `derivedCandidates`, nunca em `rows`.

### 3.4 Sondas de estado com identificador individual por nó (corrigido)

Sondas por CDP `CSS.forcePseudoState` sobre 10 seletores prioritários × 5 estados × 4 abas × 2 viewports × 3 temas claros (3, 4, 5).

Correções em relação à R2.1:

- **R22-01:** `DOM.querySelectorAll({nodeId: root.nodeId, selector})` retorna TODOS os `nodeIds` correspondentes. Para cada `nodeId`, `CSS.forcePseudoState` é aplicado individualmente, o estilo computado é coletado via `CSS.getComputedStyleForNode`, e o estado é removido antes da próxima ocorrência.
- **R22-02:** Cada ocorrência recebe um `sampleId` único no formato `r22-{selector}-{state}-{index}` e um `nodeId` específico. Não há mais confusão entre ocorrências.
- **R22-03:** `getNodeIdBySelectorIndex` foi substituído por uso direto de `DOM.querySelectorAll` que retorna `nodeIds` válidos.
- **R22-06:** Erros do CDP são registrados em `result.errors.cdp` com `sampleId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp`. Não há mais `catch (e) { /* ignore */ }` silencioso.

### 3.5 Captura da declaração CSS vencedora (corrigido)

Via `CSS.getMatchedStylesForNode({nodeId})`, o harness captura, para cada amostra de estado, as declarações de `color`/`background-color`/`fill`/`stroke`/`border-color`/`outline-color` que envolvam `--accent` ou `var(--`, registrando `selectorText`, `origin`, `styleSheetId`, `property`, `value`, `important`, `matched`, `captureStatus`.

Isso permite localizar precisamente a regra CSS de origem de cada consumidor, diferenciar valor computado de valor declarado, identificar origem da regra, registrar seletor e stylesheet, identificar `!important`, e distinguir regra correspondente de regra efetivamente vencedora.

### 3.6 Detecção de consumidores SVG (corrigido)

Coletados por amostra: `isSvg`, `svgFill`, `svgStroke`, `computedFill`, `computedStroke`, `currentColor`. A função `isAccentConsumer` agora testa `fill` e `stroke` (atributo HTML e computed style) e resolve `currentColor` (quando `fill`/`stroke` são `currentColor` e `color` do elemento é `--accent`).

### 3.7 Coleta de foreground, background e fundo efetivo

Para cada amostra, o harness captura:
- `color`, `backgroundColor`, `backgroundImage`, `fontSize`, `fontWeight` (computed style)
- `borderTopWidth/Style/Color`, `outlineWidth/Style/Color`
- `::before`/`::after`: `color`, `backgroundColor`, `content`, `width`, `height`
- `rect`, `role`, `aria-label`, `disabled`, `tabIndex`
- Inspeção SVG: `isSvg`, `svgFill`, `svgStroke`, `computedFill`, `computedStroke`, `currentColor`
- Propriedade responsável: `accentProperty`

**Fundo efetivo do próprio elemento (`bgRgb`):** `effBg(el, false)` compõe `backgroundColor` opaco da cadeia de ancestrais (inclusive o próprio elemento), começando de branco.

**Fundo efetivo externo (`outsideRgb`):** `effBg(el, true)` inicia a cadeia no `parentElement`. Serve de referência para contraste de superfície e borda/outline/pseudo-fundo.

**Incerteza e gradientes:** ancestrais com `backgroundImage !== 'none'` entram em `uncertain`; cores do gradiente entram em `gradientColors`.

### 3.8 Tratamento de transparências e gradientes

- Cores com alfa < 1 são compostas sobre o fundo efetivo antes do cálculo (`compFg = comp(fg, bg)` quando `fg.a < 1`).
- Cores de gradiente são capturadas da string `backgroundImage` por extração de `rgb(`/`rgba(`/`#hex` e parseadas com `pc`.
- `transparent` é tratado como `{r:0,g:0,b:0,a:0}`.

### 3.9 Pseudo-elementos (corrigido)

- `::before` e `::after` inspecionados via `getComputedStyle(el,'::before')` / `getComputedStyle(el,'::after')`.
- Se `content` não é `none`/`normal`, a cor do pseudo-elemento é considerada para `iconRatio` sobre o fundo do elemento.
- Se o pseudo-elemento tem `backgroundColor` opaco e largura > 0, `pseudoBgRatio` mede o contraste dessa cor sobre o fundo externo (`outsideRgb`).
- `pseudoBgRatio` é `null` quando não há amostra válida (nunca zero como substituto automático). `pseudoHasSample` indica se houve amostra válida.

### 3.10 Cálculo da razão de contraste

Implementado em Node (`parseColor`, `comp`, `lum`, `ratio`):
- Luminância relativa sRGB com linearização de canais.
- Razão WCAG: `(Lmax + 0.05) / (Lmin + 0.05)`.

Razões por amostra: `textRatio`, `bgRatio`, `borderRatio`, `outlineRatio`, `iconRatio`, `pseudoBgRatio`.

### 3.11 Classificação WCAG rigorosa (corrigido)

| Classe | Limiar | Aplica-se |
| --- | --- | --- |
| Texto normal | 4,5:1 | `fontSize < 24px` OU (`fontSize < 18,66px` E `fontWeight < 700`) |
| Texto grande | 3:1 | `fontSize >= 24px` OU (`fontSize >= 18,66px` E `fontWeight >= 700`) |
| Componente gráfico / superfície | 3:1 | fundo de botão, pill, toggle, ícone funcional |
| Foco / borda / outline | 3:1 | WCAG 1.4.11 |

Regras de decisão:
- Se `hasText`: usa `textRatio` com limiar de texto normal ou grande.
- Se `icon` (sem texto): usa `iconRatio` com limiar 3:1.
- Se `bgRatio` (fundo opaco): usa limiar 3:1 para superfície.
- Se `borderRatio` (borda opaca): usa limiar 3:1.
- Se `outlineRatio` (outline/foco opaco): usa limiar 3:1 (WCAG 1.4.11).
- A pior razão vence (menor valor).
- Se `uncertain` não vazio: `INCONCLUSIVO` (sobrepõe todas as outras classificações).
- Sem arredondamento para aprovação (tolerância 1e-9).

Categorias: **APROVADO** / **FALHA** / **INCONCLUSIVO** / **N.A.** / **NÃO MEDIDO**.

### 3.12 Integridade do hash do artefato (corrigido)

Procedimento determinístico:
1. Finalizar todos os dados do resultado (sem o campo `meta.hash`).
2. Serializar o objeto de maneira determinística (`JSON.stringify(result,null,2)`).
3. Calcular SHA-256 do objeto **sem** o campo `meta.hash` (evita autorreferência).
4. Adicionar `meta.hash` (SHA-256 completo, 64 hex) e `meta.hash16` (truncado, 16 hex).
5. Gravar o objeto completo.
6. Verificação independente: ler o arquivo gravado, remover `meta.hash` e `meta.hash16`, recalcular SHA-256, comparar com o valor registrado.

---

## 4. Critérios de classificação (resumo)

- Texto normal: mínimo 4,5:1, sem arredondamento.
- Texto grande: mínimo 3:1, somente quando enquadrado na definição WCAG.
- Componentes gráficos funcionais: mínimo 3:1, quando aplicável.
- Indicadores de foco: 3:1, considerando cores adjacentes e geometria.
- Bordas e contornos: mínimo 3:1.
- Inconclusivo: fundo com gradiente/não compósito ou composição incerta — não conta como falha nem aprovação.

Não tratar seletores distintos como "falhas confirmadas" automaticamente: cada amostra individual tem seu próprio resultado.

---

## 5. Limitações remanescentes

1. `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em casos de cascade complexa (especificidade, `!important`, herança). Fornece indício, não prova absoluta.
2. Estados `disabled` forçados via pseudoclasse CSS podem não refletir interação real.
3. Gradientes tratados de forma conservadora (cores extraídas, sem reconstrução de paradas/ângulo/máscara).
4. Não há screenshots nem validação em dispositivo físico.
5. Temas escuros usados apenas como controle de regressão.
6. O parser de cores não trata `color(srgb ...)` com canais fora de `[0,1]` nem espaços de cores não-sRGB.
7. O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação e não afeta a coleta de contraste.
8. `DOM.getBoxModel` pode falhar para elementos em certos estados pseudo (ex: quando `hover` altera o layout). O box model é opcional; o estilo computado ainda é coletado.

---

## 6. Resultado executivo (R2.2)

| Métrica | Valor |
| --- | --- |
| Amostras (`rows`) | 6.660 (apenas consumidores exatos de `--accent`) |
| Sondas de estado (`states`) | 1.200 |
| Ocorrências de estado (occurrences) | 4.320 (todas as ocorrências individuais por seletor×estado) |
| Ocorrências com dados de estilo válidos | 4.080 |
| Ocorrências descartadas | 240 (elementos não encontrados ou sem estilo computado) |
| Candidatos derivados rastreados | 330 (em `derivedCandidates`, não em `rows`) |
| Erros de console | 1 (erro de autenticação Firebase, pré-existente na app) |
| Exceções | 0 |
| Erros CDP | 3.420 (todos de `DOM.getBoxModel` — esperado, box model não compútavel em certos estados pseudo) |
| Pulos | 0 |
| APROVADO | 2.544 |
| FALHA | 1.518 |
| INCONCLUSIVO | 506 |
| N.A. | 2.092 |
| Seletores únicos com falha | 64 |
| Hash SHA-256 | Registrado em `meta.hash` |
| Hash verificado independentemente | `hashMatches: true` |

---
