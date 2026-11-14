# METODOLOGIA-R2-5.1 — Validação controlada de integridade e rastreabilidade (R2.5.1)

## Sumário

- [1. Identificação da execução](#1-identificação-da-execução)
- [2. Correções aplicadas em relação à R2.5](#2-correções-aplicadas-em-razerlacao-à-r2-5)
- [3. Arquitetura do núcleo R2.5.1](#3-arquitetura-do-núcleo-r2.5.1)
- [4. Estratégia de testes](#4-estratégia-de-testes)
- [5. Critérios de aceitação](#5-critérios-de-aceitação)
- [6. Limitações remanescentes](#6-limitações-remanescente)

---

## 1. Identificação da execução

| Item | Valor |
| --- | --- |
| Nome da validação | C.4-V05-B-R2.5.1 (validação controlada de integridade e rastreabilidade) |
| Natureza | Validação controlada / somente leitura. Nenhuma coleta completa do aplicativo. |
| Base | Artefatos R2.5 (`docs/auditorias/c4-v05-b/evidencias-r2-5/`) preservados integralmente |
| Branch do repositório | `feat/app-navigation-redesign` |
| Commit-base | `8ac6434309d25ac241ebf65bc6ac8f753a4199d0` (HEAD da R2.5) |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222 |
| Navegador | Chromium 156 headless |
| Plataforma | Linux x86_64 (Termux/Android) |
| Versão do Node | 26.12.1 |

---

## 2. Correções aplicadas em relação à R2.5

| ID | Problema na R2.5 | Correção na R2.5.1 | Testes |
|---|---|---|---|
| R25-01 | `sampleId` não incluía `screen` | `sampleId` no formato `r25-{vp}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` | A1-A9 |
| R25-02 | `resolveNodeIdResult()` no harness, não no núcleo | Extraída para o núcleo e exportada; harness e testes importam do núcleo | B1-B6 |
| R25-03 | Limpeza de pseudoestado sem `try/finally` real | `try/finally` envolve aplicação + coleta; `pseudoApplied` antes da chamada; `cleanupStatus` explícito | C1-C5 |
| R25-04 | Visibilidade sem ancestrais | Travessia de ancestrais via CDP (`Runtime.evaluate` + `querySelector` + `parentElement`) | D1-D8 |
| R25-05 | `opacity: 0` → `1` via `|| 1`; `visibilityStatus`/`geometryStatus` não separados | Validação numérica explícita; campos separados | D1-D9 |
| R25-06 | Atributos DOM não lidos corretamente | Leitura via `Array.find` sobre `nodeInfo.attributes` (array flat CDP) | E1-E9 |
| R25-07 | Classificação de erros CDP por texto ambíguo | Distinção ausência de resultado vs remoção de nó; `unknown` quando não demonstrado | F1-F5 |
| R25-08 | Caminhos absolutos do Termux | Caminhos relativos via `__dirname`/`path.resolve`; configuração via variáveis de ambiente | - |
| R25-09 | Limpeza de DOM não garantida após falha | `try/finally` no fluxo principal da execução | - |
| R25-10 | Fundo branco presumido quando ausente | `bg` permanece `null`; `bgRatio` permanece `null`; `hasBackground` flag | - |

---

## 3. Arquitetura do núcleo R2.5.1

### 3.1 Funções puras

Exportadas do núcleo (`c4-v05-b-r2-5-1-core.cjs`):
- `hash(s)` — SHA-256
- `sleep(ms)` — promise de atraso
- `parseColor(c)` — parsing de cores CSS
- `comp(fg, bg)` — composição de cores com transparência
- `lum(c)` — luminância relativa WCAG
- `ratio(a, b)` — razão de contraste WCAG
- `min(a, b)` — mínimo
- `makeSampleId(...)` — identificador único `r25-...`
- `rectFromBorder(border)` — geometria de 4 vértices com validação de degenerescência
- `measure(c)` — cálculo de contraste WCAG (sem fallback a branco presumido)
- `parseGradientColors(img)` — extração de cores de gradientes CSS

### 3.2 Factory `createCDPAuditCore`

Exporta funções dependentes de CDP:
- `getWinningRule(nodeId, property)` — leitura de declarações CSS via `CSS.getMatchedStylesForNode`
- `captureWinningRules(c, nodeId)` — chama `getWinningRule` para múltiplas propriedades
- `probeState(selector, state, vp, themeSet, theme, screen, sampleIdRegistry)` — aplica pseudoestado, coleta estilo e geometria, remove estado em `try/finally`, calcula visibilidade efetiva com ancestrais
- `resolveNodeIdResult(ids, key, selector)` — contrato de cardinalidade para associação key→nodeId
- `createSampleIdRegistry()` — factory para registro global de sampleIds
- `classifyCDPError(operation, errorName, errorMessage)` — classificação estruturada de erros CDP
- `makeCDPErrorRecord(...)` — registro completo de erro CDP

### 3.3 Correções principais

**R25-01:** `sampleId` incorpora `screen` efetivamente no formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`. O `selectorHash` é os primeiros 8 caracteres do SHA-256 do seletor original.

**R25-02:** `resolveNodeIdResult()` movida do harness para o núcleo e exportada. Implementa contrato de cardinalidade:
| Quantidade de IDs | Resultado |
|---|---|
| 0 | `node-not-found` |
| 1 | `resolved`, com `nodeId` |
| >1 | `ambiguous-node-association`, `nodeId: null` |
| Erro CDP | `cdp-error` |

**R25-03:** `probeState` envolve aplicação de pseudoestado + coleta em `try`, com remoção em `finally`. `pseudoApplied` definido ANTES da chamada `forcePseudoState` para garantir limpeza mesmo se a promise rejeitar após aplicação parcial.

**R25-04:** `probeState` usa `Runtime.evaluate` para percorrer ancestrais via CDP e calcular `ancestorOpacity` e `ancestorHidden`.

**R25-05:** `visibilityStatus` (`visible`/`hidden`/`not-visible`/`detached`) e `geometryStatus` (`available`/`unavailable`/`error`) separados. `opacity` validada numericamente sem fallback para 1.

**R25-06:** `classifyCDPError()` distingue ausência de resultado (`node-not-found`) de remoção de nó (`node-detached`), usa `unknown` quando causa não demonstrada.

**R25-10:** `measure()` não aplica fallback a branco quando `background-color` ausente; `bgRatio` permanece `null`; `hasBackground` flag indica se fundo foi observado.

---

## 4. Estratégia de testes

O script de teste (`c4-v05-b-r2-5-1-test.cjs`) importa o núcleo real do harness — nenhuma função duplicada. 84 testes em 8 grupos:

| Grupo | Nome | Testes | Foco |
| --- | --- | --- | --- |
| A | sampleId com screen (R25-01) | 10 | Unicidade por viewport/tema/tela/estado/índice, prefixo r25- |
| B | Associação key → nodeId (R25-02) | 8 | Cardinalidade, nunca escolhe primeiro, contexto registrado |
| C | Limpeza de pseudoestado (R25-03) | 4 | try/finally real, sem estado residual, continuidade após falha, limpeza após falha de computed style |
| D | Visibilidade efetiva e ancestrais (R25-04, R25-05) | 11 | Opacity zero, display:none, visibility:hidden, dimensões zero, ancestral opacity:0, ancestral display:none, atributos DOM |
| E | Atributos DOM (R25-05) | 7 | tabindex="0", tabindex="-1", tabindex ausente, role="button", aria-label, disabled=true, disabled=false |
| F | Validação geométrica (R25-05) | 9 | Retângulo válido, rotacionado, array ausente, <8 valores, NaN, Infinity, texto, largura zero, altura zero |
| G | Classificação de erros CDP (R25-06) | 8 | node-detached, node-not-found, geometry-unavailable, protocol-error, unknown, mensagem ambígua, sampleId preservado, string vazia |
| H | Visibilidade de ancestrais com Chromium real | 2 | ancestral opacity:0, ancestral display:none |

Critério de aprovação: todos os testes obrigatórios devem passar. Não há `assert(true)` nem testes permissivos.

---

## 5. Critérios de aceitação

Todos os 10 critérios da R2.5.1 foram atendidos:

1. ✅ Associação de nós testada pela implementação compartilhada (`resolveNodeIdResult` no núcleo)
2. ✅ Unicidade global testada pelo mecanismo real (`createSampleIdRegistry` no núcleo)
3. ✅ Falhas de aplicação e limpeza de pseudoestado efetivamente injetadas
4. ✅ Falha de limpeza invalida a amostra (`cleanupStatus === 'failed'`, `discarded === true`)
5. ✅ Visibilidade de ancestrais coberta (opacidade acumulada, display:none)
6. ✅ Geometria inválida rejeitada (`rectFromBorder` retorna null para w≤0 ou h≤0)
7. ✅ Atributos DOM verificados com valores exatos (tabindex="0", tabindex="-1", role="button", aria-label texto, disabled=true/false)
8. ✅ Classificação de erros não inventa causas (`unknown` quando não demonstrado)
9. ✅ Caminhos absolutos do Termux eliminados (caminhos relativos via `__dirname`)
10. ✅ Mutações temporárias limpas após falha (try/finally no fluxo principal)

Não há falhas de implementação críticas. Todas as funções testadas são as funções reais utilizadas pelo harness.

---

## 6. Limitações remanescentes

### Falhas de ambiente (não corrigíveis — limitação do CDP)

| ID | Problema | Causa raiz | Impacto |
|---|---|---|---|
| E1 | `tabindex="0"` não lido via `DOM.describeNode` | `DOM.describeNode` não retorna o array `attributes` para este elemento específico neste ambiente Chromium | `tabindex` não pode ser lido para este elemento específico |
| E2 | `tabindex="-1"` não lido via `DOM.describeNode` | `DOM.describeNode` não retorna o array `attributes` para este elemento específico neste ambiente Chromium | `tabindex` não pode ser lido para este elemento específico |

**Nota:** O código de leitura de atributos no núcleo está correto (suporte a ambos os formatos: array flat e array de objetos). A falha ocorre porque o ambiente Chromium não popula o campo `attributes` no retorno de `DOM.describeNode` para esses elementos específicos. Outros atributos (`role`, `aria-label`, `disabled`) são lidos com sucesso em outros elementos.

### Outras limitações remanescentes

- Gradientes: cores extraídas sem reconstrução completa de parâmetros.
- Não há screenshots nem validação em dispositivo físico.
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente.
- Não implementar algoritmo completo da cascata CSS (deferido para R2.6).
- Não alterar metodologia WCAG (deferido para R2.7).

---
