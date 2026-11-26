# Relatório técnico de auditoria — C6-INICIO-03

**Base:** `db5bdb9` (`feat/app-layout-redesign`)  
**Tipo:** auditoria interna de isolamento entre Início e Visão Geral  
**Data:** 2026-11-26  
**Método:** inspeção estática cruzada + validação CDP headless local. Nenhuma alteração de código nesta fase de auditoria.

## 1. Objetivo

Verificar se a infraestrutura compartilhada entre Início e Visão Geral respeita a independência de estrutura, apresentação e estado visual das duas telas.

## 2. Fatos observados

- Início = `body[data-tab="inicio"]` / `#viewInicio` (`index.html:476`). Visão Geral = `body[data-tab="dashboard"]` / `#viewDashboard` (`index.html:322`). A aba `dash` / `#viewDash` (`index.html:292`) é distinta.
- `renderAdvancedDashboard()` (`js/20-dashboard.js:81`) escreve em `#advancedDashboard`, `#viewInicio .advanced-dashboard`, `#viewInicio .next-pay-inner` e `#cashflowMiniSummary`. Dados compartilhados; DOM separado.
- `#viewInicio .cashflow-mini-summary` não existe no HTML; a escrita correspondente em `js/20-dashboard.js:87,103` é no-op. O Resumo do Fluxo real está em `viewCaixa` (`index.html:366`).
- `renderBalances()` (`js/18-render-core.js:760`) reescreve o `#balanceStrip` compartilhado e altera sua forma conforme a aba (`:790`).
- `renderPatrimonySparkline()` usa instâncias separadas por contexto (`js/18-render-core.js:53`), com IDs `#patrimonySparklineInicio` e `#patrimonySparkline`.
- `#inicioPeriodSelect` grava `dashFilters.period` e persiste (`js/18-render-core.js:921-925`).
- `renderBalances()` força `patrimonySparkVisible = true` e o latch `__inicioSparkForcedVisible` na Início (`js/18-render-core.js:812-815`).
- `markBudgetAlertShown()` é chamado dentro de `renderAdvancedDashboard()` (`js/20-dashboard.js:227`); o efeito não é idempotente.
- `render()` (`js/24-automation-render.js:94-111`) e `switchTabOriginal()` (`js/99-init.js:410-457`) fazem fan-out para vários renderizadores.
- Validação CDP local com 5 alternâncias Início → Visão Geral → Início: hosts iniciais permaneceram únicos; não houve duplicação de `#inicioBudgets`, resumo, ações ou barras; o bloco de orçamentos manteve `53%`.

## 3. Classificação

| ID | Item | Classificação | Evidência |
|---|---|---|---|
| A-01 | Cálculo de Saúde Financeira e Próximo Pagamento | shared-safe | `js/20-dashboard.js:90-118,180-211` |
| A-02 | DOM de Saúde/Próximo nas duas telas | isolated | `index.html:481,487`; `js/20-dashboard.js:210` |
| A-03 | Resumo do Fluxo na Início | isolated / no-op | `js/20-dashboard.js:87,103`; `e2e/smoke/inicio.spec.js:451` |
| A-04 | Sparkline patrimonial | shared-safe | `js/18-render-core.js:53,89-96,129` |
| A-05 | `dashFilters.period` escrito pela Início | shared-risk | `js/18-render-core.js:921-925` |
| A-06 | `patrimonySparkVisible` compartilhado | shared-risk | `js/18-render-core.js:812-815,327-360` |
| A-07 | `markBudgetAlertShown()` dentro do render | shared-risk | `js/20-dashboard.js:227` |
| A-08 | `render()` / `switchTabOriginal()` fan-out | shared-risk | `js/24-automation-render.js:94+`; `js/99-init.js:410-457` |
| A-09 | Navegação repetida Início ↔ Visão Geral | shared-safe em CDP | `tmp-c13/c6-3/validacao-c6-03.json` |

## 4. Hipóteses não confirmadas

- Troca de tema pode deixar gráficos da Visão Geral com cores antigas até outro render; não reproduzido nesta auditoria.
- Boot com aba Início restaurada pode dessincronizar `#inicioPeriodSelect` de `dashFilters.period`; não reproduzido.
- Handlers delegados não foram integralmente instrumentados; duplicação de listeners foi verificada por contagem de DOM e contagem de abertura do modal, não por introspecção completa de listeners.

## 5. Limitações

- Playwright local bloqueado: `Error: Unsupported platform: android` e `sh: 1: playwright: not found`.
- Sem credenciais Firebase reais: dados autenticados não foram validados.
- Auditoria é interna; não houve auditoria independente.
- C6-INICIO-02 permanece com pendências P-01/P-03/P-04 e não foi reaberta nesta tarefa.

## 6. Veredito

**INCONCLUSIVA** para aceite definitivo de isolamento. Não foi observada regressão por alternância repetida, mas os acoplamentos A-05, A-06, A-07 e A-08 permanecem como risco conhecido e devem ser tratados em escopo próprio, sem misturar com C6-INICIO-02.
