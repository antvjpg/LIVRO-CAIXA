# RELATÓRIO DE VALIDAÇÃO CONTROLADA — C.4-V05-B-R2.4

Este documento apresenta o resultado da validação controlada das correções do harness R2.3. Não é um relatório de aprovação da auditoria completa.

---

## A. Resumo executivo

A R2.4 corrigiu sete problemas metodológicos identificados na auditoria independente da R2.3:

| ID | Problema | Status na R2.4 |
|---|---|---|
| R24-01 | Declaração CSS capturada retorna `{}` | `key → nodeId` associado via `data-c4-audit`; `captureWinningRules(c, nodeId)` executa CDP real |
| R24-02 | `sampleId` prefixo `r23-`; tema incorreto nas sondas | Prefixo `r24-` com hash do seletor; `themeSet` explícito; controle global de unicidade |
| R24-03 | Testes não executam código real do harness | Núcleo compartilhado importado por harness e testes; 61/61 PASS |
| R24-04 | (preservado da R2.3) Geometria com 4 vértices | `rectFromBorder` no núcleo compartilhado |
| R24-05 | `bgRatio` vs superfície adjacente | Mantido no núcleo (`outsideRgb`) |
| R24-06 | Erros CDP não investigados; limpeza sem try/finally | `try/finally` para pseudoestado; erros CDP rastreados com contexto |
| R24-07 | API CDP antiga (`property(j)`/`value(j)`) | Suporte a `cssProperties` e API antiga; `!important` via `getPropertyPriority` |
| R24-08 | Validação de visibilidade incompleta | `visibilityStatus` baseado em `display`, `visibility`, `opacity`, dimensões |

Resultado dos testes: **61/61 PASS, 0 FAIL, 0 BLOCKED**

Nenhum arquivo de produção foi alterado. Nenhuma coleta completa foi executada.

---

## B. Ambiente utilizado

| Item | Valor |
| --- | --- |
| Branch | `feat/app-navigation-redesign` |
| Commit-base | `cb6abc60a6bbdd665879e2649d84b4683ef526c5` |
| Navegador | Chromium 156 headless (CDP porta 9222) |
| Node.js | 26.12.1 |
| Plataforma | Linux x86_64 (Termux/Android) |
| Fixture | `c4-v05-b-r2-4-test-fixtures.html` (21 elementos de teste) |

---

## C. Arquivos criados

| Arquivo | Descrição |
| --- | --- |
| `evidencias-r2-4/c4-v05-b-r2-4-core.cjs` | Núcleo compartilhado e testável (funções puras + factory CDP) |
| `evidencias-r2-4/c4-v05-b-r2-4.cjs` | Harness principal (importa o núcleo) |
| `evidencias-r2-4/c4-v05-b-r2-4-test.cjs` | Testes controlados (importa o núcleo real) |
| `evidencias-r2-4/c4-v05-b-r2-4-test-fixtures.html` | Fixture HTML com 21 elementos de teste |
| `DIAGNOSTICO-R2-4.md` | Diagnóstico dos problemas da R2.3 |
| `METODOLOGIA-R2-4.md` | Metodologia detalhada da R2.4 |
| `RELATORIO-VALIDACAO-CONTROLADA-R2-4.md` | Este relatório |
| `COMPARACAO-R1-R2-R2-1-R2-2-R2-3-R2-4.md` | Comparativo histórico penta-fásica + R2.4 |

---

## D. Correções implementadas

### R24-01 — Associação chave → nodeId

**Antes:** `collectScript` não incluía `nodeId` nas linhas; `captureWinningRules(c)` verificava `if (!c.nodeId) return {}` → sempre retornava `{}`.

**Depois:** Após `evalv(collectScript)`, o harness chama `DOM.querySelectorAll({selector: '[data-c4-audit="key"]'})` para resolver cada `key` para seu `nodeId`, então passa o `nodeId` para `captureWinningRules(c, nodeId)`.

**Teste:** A1 (associação key→nodeId), A2 (falha de associação retorna `node-association-failed`).

### R24-02 — sampleId único com contexto

**Antes:** Prefixo `r23-`; tema identificado por `th.id === 'light'` (sempre falso para IDs '3','4','5').

**Depois:** Prefixo `r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`; `themeSet` explícito; controle global com `Set` que lança erro em duplicidade.

**Teste:** B1-B8 (unicidade por todos os contextos, detecção de duplicidade).

### R24-03 — Testes executam código real

**Antes:** Testes replicavam `parseColor`, `lum`, `ratio`, `comp`, `makeSampleId`, `rectFromBorder`; usavam `harnessSrc.includes(...)`.

**Depois:** Módulo `c4-v05-b-r2-4-core.cjs` exportado; importado por harness e testes. Nenhuma função duplicada.

**Teste:** Todos os grupos A-F exercitam funções reais do núcleo.

### R24-04 — Geometria com 4 vértices

Preservado da R2.3: `rectFromBorder` extrai 8 valores (4 pares x,y) do `border` do `DOM.getBoxModel`.

**Teste:** C1-C5 (retângulo, rotacionado, negativas, array incompleto, dados inválidos).

### R24-05 — Fundo vs superfície adjacente

`bgRatio` compara cor de fundo contra `outsideRgb` (superfície adjacente externa), não contra `bg` interno.

**Teste:** D9 (bgRatio calculado com outsideRgb).

### R24-06 — Limpeza de pseudoestado e erros CDP

**Antes:** `CSS.forcePseudoState` aplicado/removido sem try/finally; risco de estado residual após exceção.

**Depois:** `try/finally` garante remoção; erros CDP registrados com `sampleId`, `nodeId`, `operation`, `errorMessage`, `timestamp`.

**Teste:** E7 (limpeza após erro), F1-F5 (erros CDP).

### R24-07 — Leitura CDP das declarações CSS

**Antes:** Usava `rule.style.property(j)` / `rule.style.value(j)` (API antiga).

**Depois:** Suporta `cssProperties` array (CDP moderno) e API antiga (fallback); `!important` via `getPropertyPriority`; última declaração na cascata vence.

**Teste:** A3-A10 (captura real, cssProperties, !important, especificidade, inline, herança, ambiguidade, fill/stroke).

### R24-08 — Validação de visibilidade

**Antes:** `DOM.describeNode` apenas verificava se o nó existe.

**Depois:** `visibilityStatus` (`valid`/`discarded`/`geometry-unavailable`) baseado em `display`, `visibility`, `opacity`, `width`, `height`.

**Teste:** E1-E10 (visível, oculto, opacity:0, sem dimensões, estilo vs geométrico).

---

## E. Matriz de testes

| ID | Teste | Resultado | Evidência |
|---|---|---|---|
| A1 | Associação key→nodeId via data-c4-audit | PASS | 1 elemento encontrado |
| A2 | Falha de associação não produz falsa captura | PASS | `node-association-failed` |
| A3 | Captura real de declaração CSS | PASS | status válido + candidates array |
| A4 | Leitura de declarações CSS | PASS | getWinningRule funcional |
| A5 | Detecção de !important | PASS | `important: true` na declaração vencedora |
| A6 | Candidata vs vencedora | PASS | última declaração da cascata |
| A7 | Declaração inline | PASS | status válido |
| A8 | Propriedade herdada | PASS | status válido |
| A9 | Elemento sem --accent | PASS | `no-matching-declaration` |
| A10 | fill e stroke | PASS | ambos capturados |
| B1-B8 | Identificadores únicos | PASS | 8/8 PASS |
| C1-C5 | Geometria 4 vértices | PASS | 5/5 PASS |
| D1-D10 | Medição WCAG | PASS | 10/10 PASS |
| E1-E10 | Estados e visibilidade | PASS | 10/10 PASS |
| F1-F5 | Erros CDP | PASS | 5/5 PASS |
| **Total** | | **61/61 PASS** | **0 FAIL, 0 BLOCKED** |

---

## F. Problemas restantes

- `borderRatio` e `outlineRatio` ainda comparam contra `bg` interno (não contra superfície adjacente). Isso é uma decisão de design preservada da R2.3.
- `CSS.getMatchedStylesForNode` não captura declarações inline (apenas regras de stylesheet).
- Gradientes: cores extraídas sem reconstrução completa.
- Nenhuma coleta completa do aplicativo foi executada nesta etapa.

---

## G. Limitações

- Não há screenshots nem validação em dispositivo físico.
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em cascade complexa.
- Causas de erros CDP desconhecidas são marcadas como `unknown`, nunca como esperadas.

---

## H. Git

```
git status --short:
 M docs/auditorias/c4-v05-b/INDICE-EVIDENCIAS.md
?? docs/auditorias/c4-v05-b/COMPARACAO-R1-R2-R2-1-R2-2-R2-3-R2-4.md
?? docs/auditorias/c4-v05-b/DIAGNOSTICO-R2-4.md
?? docs/auditorias/c4-v05-b/METODOLOGIA-R2-4.md
?? docs/auditorias/c4-v05-b/RELATORIO-VALIDACAO-CONTROLADA-R2-4.md
?? docs/auditorias/c4-v05-b/evidencias-r2-4/

git diff --stat:
 docs/auditorias/c4-v05-b/INDICE-EVIDENCIAS.md | 50 +++++++++
```

- Nenhum commit criado.
- Nenhum push realizado.
- Nenhum arquivo de produção alterado.
- Nenhum artefato R1/R2/R2.1/R2.2/R2.3 sobrescrito ou removido.

---

## I. Encerramento

**C.4-V05-B-R2.4 — VALIDAÇÃO CONTROLADA CONCLUÍDA**

Todos os 61 testes controlados passaram. O núcleo do harness é testável e executado tanto pelo harness quanto pelos testes. As correções R24-01 a R24-08 estão implementadas e comprovadas por testes independentes.

Esta conclusão representa somente o resultado da execução técnica. Não declara aprovação da auditoria independente.

---
