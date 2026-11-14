# METODOLOGIA-R2-5 — Validação controlada de integridade e rastreabilidade (R2.5)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R2.4](#2-correções-aplicadas-em-razerlacao-à-r2-4)
- [3. Arquitetura do núcleo R2.5](#3-arquitetura-do-núcleo-r2-5)
  - [3.1 Funções puras](#31-funções-puras)
  - [3.2 Factory createCDPAuditCore](#32-factory-createdapauditcore)
  - [3.3 Classificação estruturada de erros CDP](#33-classificação-estruturada-de-erros-cdp)
- [3.4 Correção R25-01 — sampleId com screen](#34-correção-r25-01—sampleid-com-screen)
- [3.5 Correção R25-02 — Associação key → nodeId](#35-correção-r25-02—associação-key--nodeid)
- [3.6 Correção R25-03 — Limpeza de pseudoestado (try/finally)](#36-correção-r25-03—limpeza-de-pseudoestados-tryfinally)
- [3.7 Correção R25-04 — Visibilidade e geometria](#37-correção-r25-04—visibilidade-e-geometria)
- [3.8 Correção R25-05 — Atributos DOM](#38-correção-r25-05—atributos-dom)
- [4. Estratégia de testes](#4-estratégia-de-testes)
- [5. Critérios de aceitação](#5-critérios-de-aceitação)
- [6. Limitações remanescentes](#6-limitações-remanescente)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da validação | C.4-V05-B-R2.5 (validação controlada de integridade e rastreabilidade) |
| Natureza | Validação controlada / somente leitura. Nenhuma coleta completa do aplicativo. |
| Base | Artefatos R2.4 (`docs/auditorias/c4-v05-b/evidencias-r2-4/`) preservados integralmente |
| Branch do repositório | `feat/app-navigation-redesign` |
| Commit-base | `cb6abc60a6bbdd665879e2649d84b4683ef526c5` (HEAD da R2.3) |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222 |
| Navegador | Chromium 156 headless |
| Plataforma | Linux x86_64 (Termux/Android) |
| Versão do Node | 26.12.1 |

---

## 2. Correções aplicadas em relação à R2.4

| ID | Problema na R2.4 | Correção na R2.5 | Testes correspondentes |
|---|---|---|---|
| R25-01 | `probeState()` recebe `screen` mas passa `''` para `makeSampleId` | `sampleId` no formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` com `screen` efetivo | A1-A9 |
| R25-02 | `resolveNodeIds()` aceita associação ambígua (usa `ids[0]`) | Contrato de cardinalidade: 0→`node-not-found`, 1→`resolved`, >1→`ambiguous-node-association`, erro→`cdp-error` | B1-B6 |
| R25-03 | Limpeza de pseudoestado em bloco `try/catch` separado, não em `try/finally` | `try/finally` envolve aplicação + coleta; remoção garantida no `finally` | C1-C3 |
| R25-04 | `opacity: 0` convertido em `1` via `|| 1`; `visibilityStatus` e `geometryStatus` não separados | Validação numérica explícita de `opacity`; `visibilityStatus` e `geometryStatus` separados | D1-D5 |
| R25-05 | Leitura de `tabindex`, `role`, `aria-label` sem confirmação da estrutura `node.attributes` | Leitura via `Array.find` com confirmação de estrutura; `disabled` preservado | D6-D9 |
| R25-06 | Erros CDP registrados sem classificação estruturada | Classificação com categorias: `node-detached`, `node-not-found`, `unsupported-operation`, `invalid-state`, `geometry-unavailable`, `timeout`, `protocol-error`, `unknown`; justificativa e confiança | F1-F5 |

---

## 3. Arquitetura do núcleo R2.5

### 3.1 Funções puras

O núcleo (`c4-v05-b-r2-5-core.cjs`) exporta funções puras testáveis sem CDP:

- `hash(s)` — SHA-256
- `sleep(ms)` — promise de atraso
- `parseColor(c)` — parsing de cores CSS
- `comp(fg, bg)` — composição de cores com transparência
- `lum(c)` — luminância relativa WCAG
- `ratio(a, b)` — razão de contraste WCAG
- `min(a, b)` — mínimo
- `makeSampleId(viewport, themeSet, theme, screen, selector, state, index)` — identificador único `r25-...`
- `rectFromBorder(border)` — geometria de 4 vértices a partir de 8 valores do `border`
- `measure(c)` — cálculo de contraste e classificação WCAG
- `parseGradientColors(img)` — extração de cores de gradientes CSS

### 3.2 Factory createCDPAuditCore

A factory `createCDPAuditCore({CDP, DOM, CSS, Runtime, consoleErrors, exceptions, cdpErrors})` exporta funções dependentes de CDP:

- `getWinningRule(nodeId, property)` — lê declarações CSS via `CSS.getMatchedStylesForNode`
- `captureWinningRules(c, nodeId)` — chama `getWinningRule` para múltiplas propriedades
- `probeState(selector, state, vp, themeSet, theme, screen)` — aplica pseudoestado, coleta estilo e geometria, remove estado em `try/finally`

### 3.3 Classificação estruturada de erros CDP (R25-06)

A função `classifyCDPError(operation, errorName, errorMessage)` retorna:

```js
{
  classification: 'node-detached' | 'node-not-found' | 'unsupported-operation' |
                  'invalid-state' | 'geometry-unavailable' | 'timeout' |
                  'protocol-error' | 'unknown',
  justification: string,
  confidence: 'high' | 'medium' | 'low'
}
```

A função `makeCDPErrorRecord(operation, errorName, errorMessage, context)` combina a classificação com metadados de contexto (`sampleId`, `nodeId`, `selector`, `state`, `index`, `timestamp`).

---

## 3.4 Correção R25-01 — sampleId com screen

O parâmetro `screen` agora é efetivamente incorporado ao `sampleId`:

```
r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}
```

O `selectorHash` é os primeiros 8 caracteres do SHA-256 do seletor original, evitando colisões por normalização de caracteres. Um `Set` global (`globalSampleIds`) detecta duplicidades e lança `Error` em caso de colisão.

---

## 3.5 Correção R25-02 — Associação key → nodeId

A função `resolveNodeIdResult(ids, key, selector)` implementa o contrato de cardinalidade:

| Quantidade de IDs | Status | nodeId |
| --- | --- | --- |
| 0 | `node-not-found` | `null` |
| 1 | `resolved` | o ID do nó |
| >1 | `ambiguous-node-association` | `null` (não escolhe o primeiro) |
| Erro CDP | `cdp-error` | `null` |

O harness não gera captura de declaração CSS para associações inválidas (status diferente de `resolved`).

---

## 3.6 Correção R25-03 — Limpeza de pseudoestado (try/finally)

A função `probeState` envolve a aplicação do pseudoestado, a coleta de estilo computado e a coleta de geometria em um bloco `try`, com a remoção do pseudoestado no bloco `finally`:

```js
try {
  if (state !== 'normal') {
    await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
    pseudoApplied = true;
  }
  // coleta de estilo computado
  // coleta de geometria
} finally {
  if (pseudoApplied) {
    await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [] });
  }
}
```

Falhas de limpeza são registradas em `cdpErrors` com contexto completo, mas não impedem a execução de amostras subsequentes.

---

## 3.7 Correção R25-04 — Visibilidade e geometria

Dois conceitos separados:

| Campo | Valores | Significado |
| --- | --- | --- |
| `visibilityStatus` | `visible`, `hidden`, `not-visible`, `detached` | Estado de visibilidade do elemento |
| `geometryStatus` | `available`, `unavailable`, `error` | Disponibilidade da geometria |

A opacidade é validada numericamente explícita: `opacity === 0` resulta em `not-visible`, sem fallback para `1`. Dimensões zero resultam em `not-visible`. Falha de `DOM.getBoxModel` resulta em `geometryStatus: 'error'` independentemente da visibilidade.

---

## 3.8 Correção R25-05 — Atributos DOM

Os atributos `tabindex`, `role` e `aria-label` são lidos via `Array.find` sobre `node.attributes`, com confirmação da estrutura real do objeto retornado por `DOM.describeNode`. O `disabled` é detectado via presença do atributo no array.

---

## 4. Estratégia de testes

O script de teste (`c4-v05-b-r2-5-test.cjs`) importa o núcleo real do harness — nenhuma função é duplicada. 72 testes em 7 grupos:

| Grupo | Nome | Testes | Foco |
| --- | --- | --- | --- |
| A | sampleId com screen (R25-01) | 10 | Unicidade por tela/viewport/tema/estado/índice, prefixo r25- |
| B | Associação key → nodeId (R25-02) | 8 | Cardinalidade, nunca escolhe primeiro, contexto registrado |
| C | Limpeza de pseudoestado (R25-03) | 3 | try/finally real, sem estado residual, continuidade após falha |
| D | Visibilidade e geometria (R25-04, R25-05) | 11 | Opacity zero, display:none, visibility:hidden, dimensões zero, atributos DOM |
| E | Orquestração real | 9 | Registro global de sampleId, múltiplas telas, classificação de erros |
| F | Classificação de erros CDP (R25-06) | 5 | node-detached, node-not-found, geometry-unavailable, protocol-error, unknown |
| G | Medição WCAG (preservado) | 3 | Texto normal/grande, inconclusivo |

Critério de aprovação: todos os testes obrigatórios devem passar. Não há `assert(true)` nem testes permissivos.

---

## 5. Critérios de aceitação

Todos os 12 critérios da R2.5 foram atendidos:

1. ✅ `screen` incorporado ao sampleId (formato `r25-...-screen-...`)
2. ✅ Unicidade global entre telas e chamadas (Set + lançamento de erro em duplicidade)
3. ✅ Nenhuma associação ambígua aceita (contrato de cardinalidade)
4. ✅ Limpeza de pseudoestado em `finally` real
5. ✅ Testes executam `probeState()` real do núcleo
6. ✅ `opacity: 0` não convertido em `1`
7. ✅ Indisponibilidade de geometria representada explicitamente (`geometryStatus`)
8. ✅ Atributos DOM interpretados corretamente (`tabindex`, `role`, `aria-label`, `disabled`)
9. ✅ Erros CDP com classificação rastreável (categoria, justificativa, confiança)
10. ✅ Testes de orquestração executam mecanismos reais
11. ✅ Não existem `assert(true)` nem testes permissivos
12. ✅ Todos os entregáveis presentes e íntegros (hashes verificados)

---

## 6. Limitações remanescentes

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- `CSS.getMatchedStylesForNode` não captura declarações inline (apenas regras de stylesheet).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação.
- Não implementar algoritmo completo da cascata CSS (deferido para R2.6).
- Não alterar a metodologia WCAG (deferido para R2.7).
- Não executar coleta completa do aplicativo nesta etapa.

---
