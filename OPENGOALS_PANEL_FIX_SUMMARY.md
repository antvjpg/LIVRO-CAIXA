# Correção Pontual: openGoalsPanel() — Remoção de Lógica de Cards do Início

## Contexto
Função `openGoalsPanel()` em `js/20-dashboard.js` continha um bloco indevido responsável por atualizar os cartões da aba Início (patrimônio, saúde financeira, próximo pagamento). Esse bloco introduzia risco de regressão ao possuir `return` antecipado quando não encontrava próximo pagamento, impedindo a execução de `window.switchTab('goals')`.

## Problema Identificado

O bloco (linhas 1755-1796) misturava a abertura de Metas com a renderização de outra tela, utilizando variáveis como `month`, `year`, `monthIndex`, `monthIncome` e `monthExpense` sem declaração local comprovada, e consultava `pendingBills` fora do contexto adequado.

## Solução Aplicada

Removido exclusivamente do `openGoalsPanel()` o bloco que atualizava cards da view Início, preservando integralmente:

- A abertura de Metas (`renderGoalsList()`, `initMoneyMasks()`)
- A navegação para a viewGoals (`window.switchTab('goals')`)
- O fechamento de overlays e painéis abertos
- Todas as outras funções e alterações preexistentes do arquivo

## Resultado

Após a correção, `openGoalsPanel()` cuida exclusivamente da abertura e preparação da tela de Metas, sem interferência no ciclo de renderização da aba Início. A função não possui mais `return` antecipado condicionado à existência de pagamentos pendentes.

## Arquivos Modificados

- `js/20-dashboard.js` — remoção de 42 linhas do bloco de atualização de cards do Início na função `openGoalsPanel()`

## Validação

- ✅ Sintaxe JavaScript válida (`node --check` passou)
- ✅ Nenhuma referência restante à atualização de cards do Início em `openGoalsPanel()`
- ✅ `window.switchTab('goals')` executado normalmente quando `viewGoals` existe
- ✅ Não existe mais `return` antecipado condicionado a pagamentos
- ✅ Apenas o trecho autorizado foi modificado (confere `git diff`)

## Critério de Conclusão

A abertura de Metas funciona independentemente da existência de pagamentos pendentes, e `openGoalsPanel()` voltou a cuidar exclusivamente da abertura e preparação da tela de Metas.
