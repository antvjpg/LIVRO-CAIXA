# RELATÓRIO DE VALIDAÇÃO CONTROLADA — C.4-V05-B-R2.5

Este documento apresenta o resultado da validação controlada das correções de integridade e rastreabilidade do harness R2.4. Não é um relatório de aprovação da auditoria completa.

---

## A. Resumo executivo

A R2.5 corrigiu seis problemas de integridade e rastreabilidade identificados na auditoria independente da R2.4:

| ID | Problema | Status na R2.5 |
|---|---|---|
| R25-01 | `sampleId` não incluía `screen` | `sampleId` no formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` |
| R25-02 | Associação key→nodeId aceitava ambiguidade | Contrato de cardinalidade: 0→`node-not-found`, 1→`resolved`, >1→`ambiguous-node-association` |
| R25-03 | Limpeza de pseudoestado sem try/finally real | `try/finally` garante remoção mesmo após exceção intermediária |
| R25-04 | `opacity: 0` convertido em `1`; visibilidade/geometria não separadas | Validação numérica explícita; `visibilityStatus` e `geometryStatus` separados |
| R25-05 | Atributos DOM (`tabindex`, `role`, `aria-label`) não confirmados | Leitura via `Array.find` com estrutura de `node.attributes` confirmada |
| R25-06 | Erros CDP sem classificação estruturada | Classificação com 8 categorias, justificativa e grau de confiança |

Resultado dos testes: **72/72 PASS, 0 FAIL, 0 BLOCKED**

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
| Fixture | `c4-v05-b-r2-5-test-fixtures.html` (21 elementos de teste) |

---

## C. Arquivos criados

| Arquivo | Descrição |
| --- | --- |
| `evidencias-r2-5/c4-v05-b-r2-5-core.cjs` | Núcleo compartilhado e testável (funções puras + factory CDP) |
| `evidencias-r2-5/c4-v05-b-r2-5.cjs` | Harness principal R2.5 (importa o núcleo) |
| `evidencias-r2-5/c4-v05-b-r2-5-test.cjs` | Testes controlados R2.5 (72 testes em 7 grupos) |
| `evidencias-r2-5/c4-v05-b-r2-5-test-fixtures.html` | Fixture HTML com 21 elementos de teste |
| `evidencias-r2-5/c4-v05-b-r2-5-test.log` | Saída integral da execução dos testes |
| `evidencias-r2-5/c4-v05-b-r2-5-test-results.json` | Resultado estruturado dos testes |
| `evidencias-r2-5/c4-v05-b-r2-5-integrity.json` | Hashes SHA-256 de todos os artefatos |
| `METODOLOGIA-R2-5.md` | Metodologia detalhada da R2.5 |
| `RELATORIO-VALIDACAO-CONTROLADA-R2-5.md` | Este relatório |
| `INDICE-EVIDENCIAS-R2-5.md` | Índice de evidências R2.5 |

---

## D. Correções implementadas

### R25-01 — sampleId com screen incorporado

**Antes:** `makeSampleId(vp, themeSet, theme, '', selector, state, i)` — `screen` era string vazia.

**Depois:** `makeSampleId(vp, themeSet, theme, screen, selector, state, i)` — `screen` efetivo no formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`.

**Testes:** A1-A9 (10 testes, todos PASS)

### R25-02 — Associação key → nodeId com cardinalidade

**Antes:** `resolveNodeIds` usava `ids[0]` quando múltiplos IDs encontrados, aceitando ambiguidade silenciosamente.

**Depois:** `resolveNodeIdResult(ids, key, selector)` retorna contrato de cardinalidade: `node-not-found` (0 IDs), `resolved` (1 ID), `ambiguous-node-association` (>1 IDs, nodeId=null), `cdp-error` (erro CDP).

**Testes:** B1-B6 (8 testes, todos PASS)

### R25-03 — Limpeza de pseudoestado com try/finally

**Antes:** Limpeza em bloco `try/catch` separado após a coleta, risco de estado residual se coleta falhasse.

**Depois:** `try/finally` envolve aplicação do pseudoestado + coleta de estilo + coleta de geometria; remoção garantida no `finally`.

**Testes:** C1-C3 (3 testes, todos PASS)

### R25-04 — Visibilidade e geometria separadas; opacity corrigido

**Antes:** `opacity = parseFloat(...) || 1` convertia `0` em `1`; apenas `visibilityStatus` existia.

**Depois:** Validação numérica explícita de `opacity`; `visibilityStatus` (`visible`/`hidden`/`not-visible`/`detached`) e `geometryStatus` (`available`/`unavailable`/`error`) separados.

**Testes:** D1-D5 (5 testes de visibilidade/geometria, todos PASS)

### R25-05 — Atributos DOM lidos corretamente

**Antes:** Leitura de `tabindex`, `role`, `aria-label` sem confirmação da estrutura `node.attributes`.

**Depois:** Leitura via `Array.find` sobre `node.attributes` com confirmação de estrutura; `disabled` preservado via presença no array.

**Testes:** D6-D9 (4 testes, todos PASS)

### R25-06 — Classificação estruturada de erros CDP

**Antes:** Erros registrados com `errorName`/`errorMessage` sem classificação.

**Depois:** `classifyCDPError()` retorna categoria (`node-detached`, `node-not-found`, `unsupported-operation`, `invalid-state`, `geometry-unavailable`, `timeout`, `protocol-error`, `unknown`) com justificativa e confiança.

**Testes:** F1-F5 (5 testes, todos PASS)

---

## E. Matriz de testes

72 testes em 7 grupos, todos PASS:

| Grupo | Testes | PASS | FAIL | BLOCKED |
| --- | --- | --- | --- | --- |
| A — sampleId com screen | 10 | 10 | 0 | 0 |
| B — Associação key→nodeId | 8 | 8 | 0 | 0 |
| C — Limpeza de pseudoestado | 3 | 3 | 0 | 0 |
| D — Visibilidade e geometria | 11 | 11 | 0 | 0 |
| E — Orquestração real | 9 | 9 | 0 | 0 |
| F — Classificação de erros CDP | 5 | 5 | 0 | 0 |
| G — Medição WCAG | 3 | 3 | 0 | 0 |
| **Total** | **72** | **72** | **0** | **0** |

---

## F. Integridade dos artefatos

Todos os 6 arquivos de artefato têm SHA-256 registrado em `c4-v05-b-r2-5-integrity.json`. A verificação independente consiste em ler cada arquivo e recalcular o SHA-256, comparando com o valor registrado.

| Arquivo | SHA-256 (primeiros 16 chars) |
| --- | --- |
| c4-v05-b-r2-5-core.cjs | `73ca81810995db8e` |
| c4-v05-b-r2-5.cjs | `f2c7f696e5c8a564` |
| c4-v05-b-r2-5-test.cjs | `d71d9c69a091cab3` |
| c4-v05-b-r2-5-test-fixtures.html | `d243b0ac8b058b48` |
| c4-v05-b-r2-5-test.log | `c9332f2a30ea815f` |
| c4-v05-b-r2-5-test-results.json | `705edcc37b201e17` |

---

## G. Limitações

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- `CSS.getMatchedStylesForNode` não captura declarações inline.
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente.
- Não implementar algoritmo completo da cascata CSS (R2.6).
- Não alterar metodologia WCAG (R2.7).
- Não executar coleta completa do aplicativo.

---

## H. Git

```
git status --short:
(arquivos R2.5 prontos para commit, nenhum commit realizado nesta tarefa)

git diff --stat:
(nenhuma alteração em arquivos de produção)
```

- Nenhum commit criado.
- Nenhum push realizado.
- Nenhum arquivo de produção alterado.
- Nenhum artefato R1/R2/R2.1/R2.2/R2.3/R2.4 sobrescrito ou removido.

---

## I. Encerramento

**C.4-V05-B-R2.5 — VALIDAÇÃO CONTROLADA CONCLUÍDA**

Todos os 72 testes controlados passaram. As 6 correções (R25-01 a R25-06) estão implementadas e comprovadas por teste. O núcleo do harness é testável e executado tanto pelo harness quanto pelos testes.

Esta conclusão representa somente o resultado da execução técnica. Não declara aprovação da auditoria independente.

---
