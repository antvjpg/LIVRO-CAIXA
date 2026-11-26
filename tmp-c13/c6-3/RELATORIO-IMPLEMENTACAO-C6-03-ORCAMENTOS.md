# Relatório de implementação — C6-INICIO-03 / Orçamentos na Início

**Base:** `db5bdb9`  
**Branch:** `feat/app-layout-redesign`  
**Data:** 2026-11-26  
**Destino da ação aprovado:** abrir modal existente `#panelOrcamento` via `openBudgetModal()`.

## 1. Objetivo e escopo

Implementar um bloco compacto de acompanhamento de orçamentos na aba Início, com cálculos reais, no máximo três categorias prioritárias, estados vazio/zero, acesso ao modal existente e responsividade.

**Incluído:** host na Início, renderer somente leitura, CSS, hooks guardados, testes E2E e evidências CDP.  
**Excluído:** alterações em Patrimônio Total, cards de saldo, gráfico patrimonial, Saúde Financeira, Próximo Pagamento, BNI/FAB, renderizadores compartilhados, persistência e regras financeiras.

## 2. Diagnóstico pré-implementação

- `budgetFor()` (`js/18-render-core.js:3309`) retorna o último orçamento por `updatedAt` e ignora `month`.
- `budgetSpent()` (`:3314`) soma saídas no ciclo financeiro, não no mês civil.
- `dashBudgetRows()` (`js/20-dashboard.js:759`) já fornece `{ cycle, rows: [{ id, name, planned, spent, rest, pct }] }` ordenado por `pct`.
- `renderAdvancedDashboard()` (`js/20-dashboard.js:81`) atende simultaneamente Visão Geral e Início; inserir o bloco nele agravaria o acoplamento mapeado na auditoria C6-INICIO-03.
- Não existe tela completa de orçamentos; existe apenas o modal `#panelOrcamento`.

## 3. Implementação

- Novo host `#inicioBudgets` e `#inicioBudgetCycle` em `#viewInicio` (`index.html`).
- Nova função `renderInicioBudgets()` (`js/18-render-core.js`):
  - reaproveita `dashBudgetRows()`, `budgetFor()`, `budgetSpent()`, `fmt()`, `escapeHTML()` e `formatMonthLabel()`;
  - calcula total previsto, gasto, saldo e percentual real;
  - não limita o percentual exibido a 100%; a barra visual é limitada, mas `data-real-percent` preserva o valor real;
  - prioriza excedidas → atenção → maior percentual, com desempate determinístico por nome;
  - mostra no máximo três categorias;
  - distingue “sem orçamento” de “limite zero”;
  - usa `role="progressbar"` com `aria-valuetext`.
- Hooks guardados:
  - `js/99-init.js`: chamada somente quando `tabName === 'inicio'`.
  - `js/24-automation-render.js`: chamada em `render()` e `runFeatureAutomation()` somente se a aba atual for Início.
- Nenhuma alteração ao output de `renderAdvancedDashboard()` para Visão Geral.
- Ajuste de proporção tipográfica após revisão visual: rótulo do card alinhado aos demais cards da Início (13px), percentual reduzido para `clamp(20px, 2vw, 24px)`, status para 11px e nome das categorias/ação “Ver todos os orçamentos” para 12px. Evidências: `tmp-c13/c6-3/prints/orcamento-390-fontes.png` e `orcamento-final-390.png`.
- Ajuste de responsividade após revisão visual: `Utilizado / Previsto / Disponível` permanecem em uma única linha também em 320px. Evidência: `tmp-c13/c6-3/prints/orcamento-320-valores-linha.png`.

## 4. Arquivos alterados/criados

| Arquivo | Motivo |
|---|---|
| `index.html` | Host do card e referência do ciclo. |
| `js/18-render-core.js` | Renderer isolado de Orçamentos da Início. |
| `js/24-automation-render.js` | Hooks guardados por aba. |
| `js/99-init.js` | Renderização ao trocar para Início. |
| `style/features.css` | Card único, barras, estados, responsividade e foco. |
| `e2e/smoke/inicio-orcamentos.spec.js` | Novo spec E2E de cálculo, estado vazio/zero, navegação, isolamento e responsividade. |
| `tmp-c13/c6-3/INDICE-EVIDENCIAS.md` | Metodologia, resultados e índice de evidências. |
| `tmp-c13/c6-3/RELATORIO-AUDITORIA-C6-INICIO-03.md` | Auditoria de isolamento. |
| `tmp-c13/c6-3/validacao-c6-03.json` | Evidência CDP estrutural/cálculo. |
| `tmp-c13/c6-3/prints/*.png` | Evidências visuais em 320/360/390/1280. |
| `tmp-c13/c6-3/RELATORIO-IMPLEMENTACAO-C6-03-ORCAMENTOS.md` | Este relatório. |

## 5. Validações

| Validação | Estado | Resultado |
|---|---|---|
| `node --check` nos JS alterados | PASS | Sem erro de sintaxe. |
| `npm run code:syntax` | PASS | `SINTAXE: OK (0 bloco(s) inline de index.html + 31 arquivo(s) .js)`. |
| `npm run code:oracles` | PASS | 149 testes, 149 pass, 0 fail. |
| `npm run code:security` | PASS | 94 testes, 94 pass, 0 fail. |
| `git diff --check` | PASS | Sem erros. |
| CDP — cálculo e hierarquia | PASS | 53%, R$ 2.670,00 / R$ 5.000,00 / R$ 2.330,00; categorias 105% Excedido, 80% Atenção, 64% Normal. |
| CDP — percentual real >100 | PASS | `data-real-percent=105.00`, `aria-valuenow=100`, texto 105%. |
| CDP — modal | PASS | Clique abre `#panelOrcamento`. |
| CDP — 5 alternâncias Início ↔ Visão Geral | PASS | Hosts/resumo/ações/barras permanecem 1/1/1/4; nenhuma duplicação. |
| CDP — responsividade 320/360/390/1280 | PASS | Sem overflow horizontal, sem sobreposição com nav, quatro barras presentes. |
| CDP — proporção tipográfica | PASS | Rótulo 13px, percentual 20px em 390px/24px em 1280px, status 11px, categoria e ação 12px. |
| CDP — valores em uma linha em 320px | PASS | Três colunas no mesmo `y`, sem overflow horizontal. |
| CDP — BNI nos estados finais | PASS | Capturas em 320/360/390, caixa, dashboard e tema escuro. |
| CDP — estado vazio e limite zero | PASS | Mensagens distintas, sem percentual fictício e sem barras. |
| Playwright local | BLOCKED | `Error: Unsupported platform: android`; `sh: 1: playwright: not found`. |
| C.O.D.E. remoto | NOT RUN | Workflow manual; não disparado. |
| Dados Firebase reais | NOT RUN | Sem credenciais reais nesta validação. |
| Auditoria independente | NOT RUN | Não realizada. |

Observação sobre a auditoria C6-INICIO-03: no CDP, o texto de Saúde Financeira da Visão Geral mudou após a injeção de lançamentos de teste. Isso é consequência esperada do fixture em memória, não regressão de isolamento; o spec E2E foi ajustado para estabilizar a Visão Geral com os mesmos dados antes de comparar.

## 6. Revisão do diff

- `git status --short`:
  - `M index.html`
  - `M js/18-render-core.js`
  - `M js/24-automation-render.js`
  - `M js/99-init.js`
  - `M style/features.css`
  - `?? e2e/smoke/inicio-orcamentos.spec.js`
  - `?? tmp-c13/c6-3/`
- Nenhum commit ou push realizado.

## 7. Limitações e riscos

- O acoplamento pré-existente `dashFilters.period`, `patrimonySparkVisible`, `markBudgetAlertShown()` e fan-out de `render()` permanece; a nova implementação não o agrava, mas não o resolve.
- `budget.month` continua sem uso pelo motor existente; não foi alterado.
- A validação de persistência continua coberta por `e2e/orcamento`, não por este bloco.
- C6-INICIO-02 permanece com `db5bdb9` como base e pendências registradas.

## 8. Resultado

Implementação concluída no escopo autorizado, com cálculos reais e evidências locais suficientes para validação interna. Aceite final permanece condicionado à execução do spec E2E em CI/PC com Playwright e aos acoplamentos remanescentes da C6-INICIO-03.
