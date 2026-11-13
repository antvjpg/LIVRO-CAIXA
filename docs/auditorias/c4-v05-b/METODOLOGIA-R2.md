# METODOLOGIA-R2 — Auditoria runtime de consumidores de `--accent` (corrigida)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R1](#2-correções-aplicadas-em-razerlacao-à-r1)
- [3. Método de coleta](#3-método-de-coleta)
  - [3.1 Harness e execução](#31-harness-e-execução)
  - [3.2 Identificação dos elementos consumidores de `--accent` (somente exatos)](#32-identificação-dos-elementos-consumidores-de--accent-somente-exatos)
  - [3.3 Candidatos derivados (categoria separada)](#33-candidatos-derivados-categoria-separada)
  - [3.4 Coleta de foreground, background e fundo efetivo](#34-coleta-de-foreground-background-e-fundo-efetivo)
  - [3.5 Tratamento de transparências e gradientes](#35-tratamento-de-transparências-e-gradientes)
  - [3.6 Pseudo-elementos](#36-pseudo-elementos)
  - [3.7 SVG, `fill`, `stroke` e `currentColor`](#37-svg-fill-stroke-e-currentcolor)
  - [3.8 Declaração CSS vencedora (rastreabilidade)](#38-declaração-css-vencedora-rastreabilidade)
  - [3.9 Estados normal, hover, focus-visible, ativo e disabled (corrigido)](#39-estados-normal-hover-focus-visible-ativo-e-disabled-corrigido)
  - [3.10 Elementos ocultos e interseção com viewport](#310-elementos-ocultos-e-interseção-com-viewport)
  - [3.11 Cálculo da razão de contraste](#311-cálculo-da-razao-de-contraste)
  - [3.12 Classificação WCAG rigorosa](#312-classificação-wcag-rigorosa)
  - [3.13 Hash reproduzível do artefato](#313-hash-reproduzível-do-artefato)
- [4. Critérios de classificação (resumo)](#4-critérios-de-classificação-resumo)
- [5. Limitações remanescentes](#5-limitações-remanescente)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da auditoria | C.4-V05-B-R2 (auditoria runtime corrigida de contraste de `--accent` em superfícies claras) |
| Natureza | Somente leitura / documentação e preservação de evidências. Nenhuma correção visual. |
| Data e horário de início | Registrado em `meta.startedAt` do JSON (`c4-v05-b-r2.json`) |
| Data e horário de término | Registrado em `meta.finishedAt` do JSON |
| Fuso horário | Timestamps do artefato em UTC. Execução no Termux/Android. |
| Branch do repositório | `feat/app-navigation-redesign` (capturado via `git branch --show-current` no Node) |
| Commit analisado | Capturado via `git rev-parse HEAD` no Node (registrado em `meta.commit`) |
| Versão do navegador | `navigator.userAgent` capturado (ex.: `HeadlessChrome/156.0.0.0`) |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222. Harness: `c4-v05-b-r2.cjs`. |
| Servidor local da aplicação | `python3 -m http.server 8000`, servindo `http://127.0.0.1:8000/index.html` |
| Viewports utilizados | Mobile: 390×844, `deviceScaleFactor: 1`, `mobile: true`. Desktop: 1440×900, `deviceScaleFactor: 1`, `mobile: false`. |
| Temas examinados (claros — alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas examinados (escuros — controle de regressão) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| SHA-256 completo do JSON | Registrado no índice de evidências |
| Hash resumido do JSON (`meta.hash`) | SHA-256 truncado a 16 hex, calculado sobre o objeto JSON **final** |

---

## 2. Correções aplicadas em relação à R1

| # | Problema na R1 | Correção na R2 |
|---|---|---|
| 1 | `KEY_SELECTORS` adicionava elementos à população sem verificar consumo exato de `--accent`; 3.513 amostras não-consumidoras entravam nas `rows`. | A população de `rows` contém **somente** elementos que passam no teste `isAccentConsumer` (correspondência exata do token em `color`, `backgroundColor`, `borderTopColor`, `outlineColor`, ou pseudo-elementos com conteúdo). `KEY_SELECTORS` serve apenas como pista de candidatos. |
| 2 | Elementos derivados (gradiente, `color-mix`, classe temática) misturados com consumidores exatos. | Candidatos derivados (padrões temáticos sem match exato) vão para `derivedCandidates`, categoria separada, nunca para `rows`. |
| 3 | Sondas de estado usavam `document.querySelector` (primeira correspondência), sem checar visibilidade, geometria ou contexto da aba. | Sondas usam `document.querySelectorAll` + filtro `visible()` + interseção com viewport. Registram total de candidatos, válidos e descartados com motivo. |
| 4 | Classificação tratava inconclusivos (`uncertain` não vazio) como falha definitiva. | Classificação rigorosa: `INCONCLUSIVO` quando `uncertain` não vazio — nunca conta como falha nem aprovação. |
| 5 | Sem registro de commit/branch/navegador nos artefatos. | `meta.commit` (via `git rev-parse HEAD`), `meta.branch` (via `git branch --show-current`), `meta.userAgent` (via `navigator.userAgent`). |
| 6 | Sem declaração CSS vencedora; impossível rastrear a regra de origem. | `CSS.getMatchedStylesForNode` captura seletor, origem e valor da declaração vencedora para `color`/`background-color` que envolvam `--accent` ou `var(--`. |
| 7 | Sem inspeção de SVG `fill`/`stroke`/`currentColor`. | Coleta `isSvg`, `svgFill`, `svgStroke`, `computedFill`, `computedStroke`, `currentColor` por amostra. |
| 8 | `meta.hash` calculado antes de adicionar `meta.hash`/`meta.finishedAt` (não era hash dos bytes finais). | Hash calculado sobre o objeto JSON **completo e final**, gravado uma única vez. |

---

## 3. Método de coleta

### 3.1 Harness e execução

O harness `c4-v05-b-r2.cjs` executa em Node.js, conecta ao CDP na porta 9222, habilita os domínios `Page`, `Runtime`, `DOM`, `CSS`, `Emulation`, navega para `http://127.0.0.1:8000/index.html`, aguarda o estado de prontidão da aplicação, injeta um `<style id="c4-audit-style">` que oculta `#authOverlay`/`#syncOverlay` e desativa transições/animações, e itera sobre combinações de viewport × tema × tela/painel.

Ao final, remove marcadores temporários, remove o estilo injetado, remove `dark-mode`, reaplica o tema claro 1 (Oliva) e grava o resultado JSON com hash reproduzível.

### 3.2 Identificação dos elementos consumidores de `--accent` (somente exatos)

A coleta de elementos é feita pelo script `collectScript` injetado via `Runtime.evaluate`:

1. Obtém o valor computado de `--accent` em `document.body` (`getComputedStyle(document.body).getPropertyValue('--accent').trim()`), chamado `accentRaw`.
2. Executa `document.querySelectorAll(KEY_SELECTORS.join(','))` sobre os 46 seletores candidatos. **Somente elementos visíveis que passam no teste `isAccentConsumer` entram na população `known`.**
3. Executa `document.querySelectorAll('body *')` sobre todos os elementos do corpo. **Somente elementos visíveis que passam no teste `isAccentConsumer` entram na população `known`.**
4. A função `isAccentConsumer(el)` retorna `true` quando há correspondência exata (`exact`) de `accentRaw` em qualquer um destes:
   - `color` do elemento
   - `backgroundColor` do elemento
   - `borderTopColor` (quando `borderTopWidth > 0` e `borderTopStyle !== 'none'`)
   - `outlineColor` (quando `outlineWidth > 0` e `outlineStyle !== 'none'`)
   - `color` de `::before` ou `::after` (quando `content` não é `none`/`normal`)
   - `backgroundColor` de `::before` ou `::after` (quando `content` não é `none`/`normal` e largura > 0)

A correspondência exata compara canais RGBA com tolerância de 0.5 nos canais RGB e 0.01 no alfa, após parsing de `rgba()`, `rgb()`, `color(srgb ...)` e `#RRGGBB[AA]`.

### 3.3 Candidatos derivados (categoria separada)

Elementos que correspondem a padrões temáticos sugerindo uso de `--accent` (classes como `primary`, `fab-add`, `feature-profile-switch`, etc.) mas **não** passam no teste exato são rastreados em `derivedCandidates`, nunca em `rows`. Isso permite investigação posterior sem contaminar a população de contraste.

### 3.4 Coleta de foreground, background e fundo efetivo

Para cada amostra, o harness captura:
- `color`, `backgroundColor`, `backgroundImage`, `fontSize`, `fontWeight` (computed style)
- `borderTopWidth/Style/Color`, `outlineWidth/Style/Color`
- `::before`/`::after`: `color`, `backgroundColor`, `content`, `width`, `height`
- `rect`, `role`, `aria-label`, `disabled`, `tabIndex`
- Inspeção SVG: `isSvg`, `svgFill`, `svgStroke`, `computedFill`, `computedStroke`, `currentColor`

**Fundo efetivo do próprio elemento (`bgRgb`):** `effBg(el, false)` compõe `backgroundColor` opaco da cadeia de ancestrais (inclusive o próprio elemento), começando de branco.

**Fundo efetivo externo (`outsideRgb`):** `effBg(el, true)` inicia a cadeia no `parentElement`. Serve de referência para contraste de superfície e borda/outline/pseudo-fundo.

**Incerteza e gradientes:** ancestrais com `backgroundImage !== 'none'` entram em `uncertain`; cores do gradiente entram em `gradientColors`.

### 3.5 Tratamento de transparências e gradientes

- Cores com alfa < 1 são compostas sobre o fundo efetivo antes do cálculo (`compFg = comp(fg, bg)` quando `fg.a < 1`).
- Cores de gradiente são capturadas da string `backgroundImage` por extração de `rgb(`/`rgba(`/`#hex` e parseadas com `pc`.
- `transparent` é tratado como `{r:0,g:0,b:0,a:0}`.

### 3.6 Pseudo-elementos

- `::before` e `::after` inspecionados via `getComputedStyle(el,'::before')` / `getComputadoStyle(el,'::after')`.
- Se `content` não é `none`/`normal`, a cor do pseudo-elemento é considerada para `iconRatio` sobre o fundo do elemento.
- Se o pseudo-elemento tem `backgroundColor` opaco e largura > 0, `pseudoBgRatio` mede contraste sobre o fundo externo.

### 3.7 SVG, `fill`, `stroke` e `currentColor`

Coletados por amostra: `isSvg` (elemento é SVG ou está dentro de SVG), `svgFill`, `svgStroke` (atributos HTML), `computedFill`, `computedStroke` (computed style), `currentColor` (computed style `color`). Isso permite rastrear contraste de ícones SVG que usam `fill`/`stroke` com `currentColor` ou `--accent`.

### 3.8 Declaração CSS vencedora (rastreabilidade)

Via `CSS.getMatchedStylesForNode({nodeId})`, o harness captura, para cada amostra, as declarações de `color`/`background-color` que envolvam `--accent` ou `var(--`, registrando `selectorText`, `origin`, `styleSheetId` e `value`. Isso permite localizar precisamente a regra CSS de origem de cada consumidor.

### 3.9 Estados normal, hover, focus-visible, ativo e disabled (corrigido)

Sondas por CDP `CSS.forcePseudoState` sobre 10 seletores prioritários. Correções em relação à R1:
- `document.querySelectorAll` (todos os candidatos) em vez de `document.querySelector` (primeiro).
- Filtro `visible()` antes de forçar estado.
- Verificação de interseção com viewport (`getBoundingClientRect` dentro da área visível).
- Registro de `totalCandidates`, `validCandidates`, e motivo de descarte para amostras inválidas.
- `nodeId` obtido via `DOM.querySelector` antes de `CSS.forcePseudoState`.
- Estado `disabled` continuado como limitação (pseudoclasse CSS pode não refletir interação real).

Condições: viewports mobile/desktop, temas claros 3/4/5, abas dash/caixa/invest/profile, estados normal/hover/focus-visible/active/disabled.

### 3.10 Elementos ocultos e interseção com viewport

- Elementos filtrados por `visible(el)`: descarta se `display === 'none'`, `visibility === 'hidden'`, `opacity === 0`, ou retângulo <= 0.
- Na sonda de estado, adicionalmente verifica interseção com o viewport (`bottom > 0`, `right > 0`, `top < innerHeight`, `left < innerWidth`).
- Elementos sem fundo opaco próprio herdam o fundo composto da cadeia de ancestrais.

### 3.11 Cálculo da razão de contraste

Implementado em Node (`parseColor`, `comp`, `lum`, `ratio`):
- Luminância relativa sRGB com linearização de canais.
- Razão WCAG: `(Lmax + 0.05) / (Lmin + 0.05)`.

Razões por amostra: `textRatio`, `bgRatio`, `borderRatio`, `outlineRatio`, `iconRatio`, `pseudoBgRatio`.

### 3.12 Classificação WCAG rigorosa

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
- Se `uncertain` não vazio: `INCONCLUSIVO` (sobrepõe outras classificações).
- Sem arredondamento para aprovação (tolerância 1e-9).

Categorias: **APROVADO** / **FALHA** / **INCONCLUSIVO** / **N.A.** / **NÃO MEDIDO**.

### 3.13 Hash reproduzível do artefato

O `meta.hash` é calculado sobre a string JSON **final e completa** do objeto `result` (após todos os campos preenchidos, incluindo `meta.hash` sendo preenchido em seguida). A gravação ocorre uma única vez, garantindo que o hash é reproduzível a partir do conteúdo do arquivo.

---

## 4. Critérios de classificação (resumo)

- Texto normal: mínimo 4,5:1, sem arredondamento.
- Texto grande: mínimo 3:1, somente quando enquadrado na definição WCAG.
- Componentes gráficos funcionais: mínimo 3:1, quando aplicável.
- Indicadores de foco: 3:1, considerando cores adjacentes e geometria.
- Inconclusivo: fundo com gradiente/não compósito ou composição incerta — não conta como falha nem aprovação.

Não tratar 64 seletores distintos como "64 falhas confirmadas" automaticamente: cada amostra individual tem seu próprio resultado.

---

## 5. Limitações remanescentes

1. `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em casos de cascade complexa (especificidade, `!important`, herança). Fornece indício, não prova absoluta.
2. Estados `disabled` forçados via pseudoclasse CSS podem não refletir interação real.
3. Gradientes tratados de forma conservadora (cores extraídas, sem reconstrução de paradas/ângulo/máscara).
4. Não há screenshots nem validação em dispositivo físico.
5. Temas escuros usados apenas como controle de regressão.
6. O parser de cores não trata `color(srgb ...)` com canais fora de `[0,1]` nem espaços de cores não-sRGB.

---

## 6. Resultado executivo (R2)

| Métrica | Valor |
| --- | --- |
| Amostras (`rows`) | 6.648 (apenas consumidores exatos de `--accent`) |
| Sondas de estado (`states`) | 1.200 |
| Candidatos derivados rastreados | 330 (em `derivedCandidates`, não em `rows`) |
| Erros de console | 0 |
| Exceções | 0 |
| Pulos | 0 |
| APROVADO | 2.673 |
| FALHA | 1.365 (texto: 810, superfície: 434, ícone: 121) |
| INCONCLUSIVO | 506 |
| N.A. | 2.104 |
| Seletores únicos com falha | 64 |

---
