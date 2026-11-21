# R2.6 — Fase 0: baseline, integridade e mapa de rastreabilidade

**Data:** 21/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.
**Objetivo:** cumprir o Aceite G0 do plano de correção R2.6 sem sobrescrever evidências históricas.

## 1. Estado e integridade

- Working tree: **0 arquivos rastreados modificados**; apenas logs temporários não rastreados.
- Núcleo histórico R2.5.6 preservado: `43b0039e491096fa5497ec6bc4c6e2f29efe86665491b51d741ed0b4b832f006`.
- Núcleo candidato R2.6: `a373707ae029b0c7465d66959f9ae02aea36c8486953ecedc1fb6c2245232a70`.
- Manifesto de integridade R2.5.7 (`c4-v05-b-r2-5-7-integrity.json`): SHA antes e depois da checagem = `c3b8249bc3db097ed1883d8eafb5273e06f188d5c29f495a75c5bde69768d5b2` → **inalterado**.
- Recálculo somente leitura dos 11 artefatos do manifesto: **11 MATCH / 0 MISMATCH / 0 MISSING**.
- Conjunto histórico de 393 registros: `tests.length = 393`, `groups.length = 14`, resumo `392 PASS / 0 FAIL / 1 BLOCKED`, `summaryMatchesLog = true`, `groupsMatchSummary = true`.
- Observação metodológica: o script existente `verificar-manifesto-r2-5-7.cjs` grava `verifiedAt`/contadores no próprio manifesto; por isso não foi executado. A verificação foi reproduzida em modo somente leitura.

**Aceite G0: PASS** — baseline reproduzível em `tmp-c13/r2-6-4/fase0-baseline.json`; evidências históricas preservadas; nenhum arquivo histórico sobrescrito.

## 2. Comandos existentes identificados

| Finalidade | Comando |
|---|---|
| Sintaxe | `node --check <arquivo.js>` |
| Suíte histórica | `node docs/auditorias/c4-v05-b/evidencias-r2-5-7/c4-v05-b-r2-5-7-test.cjs` |
| Verificação do manifesto | `node docs/auditorias/c4-v05-b/evidencias-r2-5-7/verificar-manifesto-r2-5-7.cjs` (**grava no manifesto**) |
| Matriz R2.6.2 | `node tmp-c13/r2-6-2/validacao-r2-6-3.cjs --core=<nucleo> --out=<saida>` |

Nota: `c4-v05-b-r2-5-7-test.cjs` importa o núcleo histórico por `CORE_PATH` fixo. A regressão com o novo núcleo exigirá cópia controlada/adaptação, sem sobrescrever o original.

## 3. Mapa defeito → código → teste → evidência

| Defeito | Código corrigido (`r2-6-core.cjs`) | Teste | Evidência |
|---|---|---|---|
| **C04 — `!important`** | `compareCandidates()` ordena por `important → origem → especificidade → ordem`; `propImportant()` lê `important`/texto | R2.6.3 C04 | histórico FAIL → corrigido PASS; vencedor `.r261-important` / `var(--accent)` / `important=true` |
| **C05 — inline** | `CSS.getInlineStylesForNode()` adiciona candidatos `source: 'inline'` | R2.6.3 C05 | histórico FAIL → corrigido PASS; vencedor inline `rgb(255, 0, 0)` |
| **C06 — custom property inline** | mesma coleta inline + `resolvedValue` obtido do `computedStyle` | R2.6.3 C06 | declarado `var(--inline-accent)`, resolvido `rgb(0, 0, 255)`; PASS |
| **C08 — herança implícita** | percorre `matched.inherited[].matchedCSSRules` quando não há declaração própria | R2.6.3 C08 | histórico FAIL → corrigido PASS; vencedor herdado de `.r261-parent-implicit` |
| **C10 — pseudoelemento** | `options.pseudoElement`; `pseudoElements[].matches`; `options.selector` para `getComputedStyle(el, '::before')` | R2.6.3 C10 | histórico FAIL → corrigido PASS; `#r261-pseudo::before` / `::before` |

Oráculo: 10/10 PASS antes e depois. Núcleo corrigido: 10/10 PASS. Núcleo histórico reexecutado: 5 PASS / 5 FAIL. Sem regressões nem falhas novas.

## 4. Estado do gate

Fase 0 concluída. O Gate R2.6 permanece **INCONCLUSIVO**: faltam Fase 6 (regressão dos 393 registros com o novo núcleo), Fase 7 (CI/Linux), revisão independente, migração controlada do harness e aceite formal.

Nenhuma alteração de CSS de produção, aplicativo, commits ou push foi feita nesta etapa.
