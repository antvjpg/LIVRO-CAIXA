# METODOLOGIA-R2-4 — Auditoria runtime corrigida de consumidores de `--accent` (R2.4)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R2.3](#2-correções-aplicadas-em-razerlacao-à-r2-3)
- [3. Arquitetura do harness](#3-arquitetura-do-harness)
  - [3.1 Núcleo compartilhado e testável](#31-núcleo-compartilhado-e-testável)
  - [3.2 Harness principal](#32-harness-principal)
  - [3.3 Associação chave → nodeId](#33-associação-chave-→-nodeid)
  - [3.4 Captura de declarações CSS](#34-captura-de-declarações-css)
  - [3.5 Identificação de contexto e unicidade de sampleId](#35-identificação-de-contexto-e-unicidade-de-sampleid)
  - [3.6 Cálculo geométrico](#36-cálculo-geométrico)
  - [3.7 Metodologia WCAG](#37-metodologia-wcag)
  - [3.8 Critérios de visibilidade](#38-critérios-de-visibilidade)
  - [3.9 Aplicação e limpeza de pseudoestados](#39-aplicação-e-limpeza-de-pseudoestados)
  - [3.10 Classificação de erros CDP](#310-classificação-de-erros-cdp)
  - [3.11 Integridade do hash do artefato](#311-integridade-do-hash-do-artefato)
- [4. Estratégia de testes](#4-estratégia-de-testes)
- [5. Critérios de classificação (resumo)](#5-critérios-de-classificação-resumo)
- [6. Limitações remanescentes](#6-limitações-remanescente)
- [7. Resultado executivo (R2.4)](#7-resultado-executivo-r24)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da auditoria | C.4-V05-B-R2.4 (validação controlada de correções do harness R2.3) |
| Natureza | Validação controlada / somente leitura. Nenhuma coleta completa do aplicativo. Nenhuma correção visual. |
| Branch do repositório | `feat/app-navigation-redesign` |
| Commit-base (aplicação) | `cb6abc60a6bbdd665879e2649d84b4683ef526c5` (HEAD da R2.3) |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222 |
| Navegador | Chromium 156 headless |
| Plataforma | Linux x86_64 (Termux/Android) |
| Versão do Node | 26.12.1 |

---

## 2. Correções aplicadas em relação à R2.3

| ID | Problema na R2.3 | Correção na R2.4 |
|---|---|---|
| R24-01 | `captureWinningRules` retorna `{}` porque `c.nodeId` não existe nas linhas de `collectScript` | Harness associa `key → nodeId` via `DOM.querySelectorAll('[data-c4-audit="key"]')` após coleta; `captureWinningRules(c, nodeId)` recebe `nodeId` resolvido |
| R24-02 | `sampleId` prefixo `r23-`; tema identificado incorretamente nas sondas | Novo prefixo `r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`; `themeSet` explícito `'light'`; controle global de unicidade com `Set` |
| R24-03 | Testes replicam funções; verificações por `String.includes` | Módulo `c4-v05-b-r2-4-core.cjs` importado por harness e testes; nenhuma duplicação |
| R24-05 | `bgRatio` compara contra superfície adjacente; `borderRatio`/`outlineRatio` contra `bg` interno | `bgRatio` mantém comparação contra `outsideRgb` (superfície adjacente externa) |
| R24-06 | Erros CDP sem classificação; limpeza de pseudoestado sem try/finally | `try/finally` garante remoção de pseudoestado; erros CDP rastreados com contexto completo |
| R24-07 | Leitura CDP usa API antiga (`property(j)`/`value(j)`) | Suporte a ambos: `cssProperties` (moderno) e `property(j)`/`value(j)` (antigo); `!important` via `getPropertyPriority` |
| R24-08 | Validação de visibilidade incompleta | `visibilityStatus` (`valid`/`discarded`/`geometry-unavailable`) baseado em `display`, `visibility`, `opacity`, `width`, `height` |

---

## 3. Arquitetura do harness

### 3.1 Núcleo compartilhado e testável

Arquivo: `c4-v05-b-r2-4-core.cjs`

Exporta funções puras (testáveis sem CDP) e uma factory `createCDPAuditCore` para funções dependentes de CDP:

**Funções puras:**
- `hash(s)` — SHA-256
- `sleep(ms)` — promise de atraso
- `parseColor(c)` — parsing de cores CSS (`rgba()`, `rgb()`, `#hex`, `transparent`)
- `comp(fg, bg)` — composição de cores com transparência
- `lum(c)` — luminância relativa WCAG
- `ratio(a, b)` — razão de contraste WCAG
- `min(a, b)` — mínimo
- `makeSampleId(viewport, themeSet, theme, screen, selector, state, index)` — identificador único `r24-...`
- `rectFromBorder(border)` — geometria de 4 vértices a partir de 8 valores do `border`
- `measure(c)` — cálculo de contraste e classificação WCAG
- `parseGradientColors(img)` — extração de cores de gradientes CSS

**Factory `createCDPAuditCore({CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors})`:**
- `getWinningRule(nodeId, property)` — lê declarações CSS via `CSS.getMatchedStylesForNode`, suporta `cssProperties` e API antiga, retorna `{property, computedValue, winningDeclaration, candidates, captureStatus}`
- `captureWinningRules(c, nodeId)` — chama `getWinningRule` para múltiplas propriedades de cor
- `probeState(selector, state, vp, themeSet, theme, screen)` — aplica pseudoestado por `nodeId`, coleta estilo computado e box model, remove estado em `try/finally`

### 3.2 Harness principal

Arquivo: `c4-v05-b-r2-4.cjs`

Importa o núcleo e executa o fluxo completo:
1. Conecta via CDP na porta 9222
2. Navega para `http://127.0.0.1:8000/index.html`
3. Para cada viewport (mobile/desktop) e tema (claro/escuro):
   - Executa `collectScript` no browser (injeta `data-c4-audit` com chave `c4-N`)
   - Resolve `key → nodeId` via `DOM.querySelectorAll('[data-c4-audit="key"]')`
   - Chama `captureWinningRules(c, nodeId)` para cada amostra
   - Calcula contraste com `measure(c)`
4. Executa sondas de estado com `probeState` para temas claros 3, 4, 5
5. Calcula hash SHA-256 do objeto sem `meta.hash`/`meta.hash16`
6. Grava JSON e log

### 3.3 Associação chave → nodeId (R24-01)

O `collectScript` executa no contexto do browser e não tem acesso a `nodeId` do CDP. Após a coleta, o harness:

1. Chama `DOM.getDocument` para obter o `root.nodeId`
2. Para cada chave `c4-N`, chama `DOM.querySelectorAll({nodeId: root, selector: '[data-c4-audit="c4-N"]'})`
3. Associa o primeiro `nodeId` encontrado à amostra
4. Passa o `nodeId` para `captureWinningRules`

Não associa nós por posição de array sem comprovar correspondência.

### 3.4 Captura de declarações CSS (R24-07)

`getWinningRule` usa `CSS.getMatchedStylesForNode({nodeId})` e itera sobre `matched.matchedCSSRules`. Suporta duas estruturas CDP:

**CDP moderno:** `rule.style.cssProperties` array com `{name, value, important, text, disabled, parsedOk, ...}`

**CDP antigo:** `rule.style.property(j)` / `rule.style.value(j)` / `rule.style.getPropertyPriority(name)`

Para cada propriedade solicitada (`color`, `background-color`, `border-color`, `border-top-color`, `border-right-color`, `border-bottom-color`, `border-left-color`, `outline-color`, `fill`, `stroke`):

- Coletar todas as declarações candidatas
- A última declaração válida na cascata vence (ordem crescente de prioridade)
- `!important` detectado via `prop.important === true` ou `getPropertyPriority(name) === 'important'`
- Resultado: `{property, computedValue, winningDeclaration, candidates, captureStatus}`

Valores de `captureStatus`: `captured`, `no-matching-declaration`, `node-association-failed`, `cdp-error`, `ambiguous`

### 3.5 Identificação de contexto e unicidade de sampleId (R24-02)

Formato: `r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`

- `selectorHash` = primeiros 8 caracteres do SHA-256 do seletor original (evita colisões por normalização)
- Controle global com `Set` que lança `Error` em caso de duplicidade
- `themeSet` explícito: `'light'` no loop LIGHT, `'dark'` no loop DARK (não inferido do ID numérico do tema)

### 3.6 Cálculo geométrico (R24-04)

`rectFromBorder(border)` extrai os 8 valores (4 pares x,y) do array `border` do `DOM.getBoxModel`:

```
x = min(x0, x1, x2, x3)
y = min(y0, y1, y2, y3)
w = max(x0..x3) - min(x0..x3)
h = max(y0..y3) - min(y0..y3)
```

Retorna `null` quando `border` tem menos de 8 valores ou contém valores não numéricos.

### 3.7 Metodologia WCAG (R24-05)

Limiares aplicados:
- Texto normal: ≥ 4.5:1
- Texto grande (≥18.66px negrito ou ≥24px): ≥ 3.0:1
- Gráficos/ícones: ≥ 3.0:1
- Indicador de foco (WCAG 1.4.11): ≥ 3.0:1

`bgRatio` compara a cor de fundo contra a superfície adjacente externa (`outsideRgb`), não contra o fundo interno.

`borderRatio` e `outlineRatio` comparam contra `bg` (fundo interno do elemento), conforme design existente.

Classificação: `APROVADO`, `FALHA`, `INCONCLUSIVO` (cores incertas ou gradientes), `N.A.` (sem texto ou ícone).

### 3.8 Critérios de visibilidade (R24-08)

Uma ocorrência é classificada como:
- `valid`: elemento visível com estilo computado e geometria
- `discarded`: `display: none`, `visibility: hidden`, `opacity: 0`
- `geometry-unavailable`: largura ou altura computada igual a zero

Uma falha de `DOM.getBoxModel` não implica automaticamente que o elemento está invisível.

### 3.9 Aplicação e limpeza de pseudoestados

`probeState` utiliza `try/finally` para garantir a remoção do pseudoestado mesmo quando ocorre exceção durante coleta de estilo computado, geometria ou processamento:

```js
try {
  if (state !== 'normal') {
    await CSS.forcePseudoState({nodeId, forcedPseudoClasses: [state]});
    // coleta de estilo e geometria
  }
} finally {
  if (pseudoApplied) {
    await CSS.forcePseudoState({nodeId, forcedPseudoClasses: []});
  }
}
```

Falhas de limpeza são registradas em `cdpErrors` com contexto completo.

### 3.10 Classificação de erros CDP

Todos os erros CDP são registrados com: `sampleId`, `nodeId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp`, `selector`, `state`, `index`.

Causas não classificadas são marcadas como `unknown` — nunca assumidas como esperadas.

### 3.11 Integridade do hash do artefato

SHA-256 calculado sobre `JSON.stringify(obj, null, 2)` do objeto **sem** `meta.hash` e `meta.hash16`. Verificação independente: ler arquivo, remover campos de hash, recalcular, comparar com valor registrado.

---

## 4. Estratégia de testes

Arquivo: `c4-v05-b-r2-4-test.cjs`

Os testes importam o núcleo real (`c4-v05-b-r2-4-core.cjs`) — mesma implementação usada pelo harness. Não há funções duplicadas.

Grupos de testes:
- **A — Associação CSS**: key→nodeId, captura real, `cssProperties`, `!important`, especificidade, inline, herança, ambiguidade, fill/stroke
- **B — Identificadores**: unicidade por viewport/tema/tela/seletor/estado/índice, prefixo `r24-`, detecção de duplicidade
- **C — Geometria**: retângulo, quadrilátero rotacionado, coordenadas negativas, array incompleto, dados inválidos
- **D — Medição WCAG**: texto normal/grande, ícone, borda alta/baixa/decorativa, foco suficiente/insuficiente, superfície ausente, inconclusivo
- **E — Estados e visibilidade**: elemento visível/oculto/opacity:0/sem dimensões, pseudoestado aplicado/removido, limpeza após erro, estilo computado vs geométrico
- **F — Erros CDP**: getBoxModel registrado, operações distintas, causa desconhecida, estilo vs geometria, correlação com sampleId

Critério de aprovação: todos os testes obrigatórios devem passar. Não há testes baseados em `String.includes` do código-fonte.

---

## 5. Critérios de classificação (resumo)

| Critério | Limiar |
| --- | --- |
| Texto normal | ≥ 4.5:1 |
| Texto grande | ≥ 3.0:1 |
| Gráficos/ícones | ≥ 3.0:1 |
| Indicador de foco (WCAG 1.4.11) | ≥ 3.0:1 |
| Gradientes | Pior caso entre todas as paradas |
| Cores incertas | `INCONCLUSIVO` |

---

## 6. Limitações remanescentes

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` não captura declarações inline (apenas regras de stylesheet).
- `borderRatio` e `outlineRatio` comparam contra `bg` interno; apenas `bgRatio` usa superfície adjacente externa.
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação.

---

## 7. Resultado executivo (R2.4)

| Item | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.4 |
| Testes controlados | 61/61 PASS, 0 FAIL, 0 BLOCKED |
| Grupos de testes | A (10), B (8), C (5), D (10), E (10), F (5) |
| Arquivos criados | `c4-v05-b-r2-4-core.cjs`, `c4-v05-b-r2-4.cjs`, `c4-v05-b-r2-4-test.cjs`, `c4-v05-b-r2-4-test-fixtures.html` |
| Documentação | `DIAGNOSTICO-R2-4.md`, `METODOLOGIA-R2-4.md`, `RELATORIO-VALIDACAO-CONTROLADA-R2-4.md`, `COMPARACAO-R1-R2-R2-1-R2-2-R2-3-R2-4.md` |
| Nenhuma coleta completa executada | Confirmado |
| Nenhum arquivo de produção alterado | Confirmado |
| R1, R2, R2.1, R2.2, R2.3 preservados | Confirmado |

---
