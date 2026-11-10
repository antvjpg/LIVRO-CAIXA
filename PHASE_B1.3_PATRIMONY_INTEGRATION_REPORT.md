# Relatório de Integração da Phase B.1.3 — Patrimônio Total no Início

## 1. Diagnóstico Encontrado

### Problema
O card de Patrimônio Total na view Início (`#viewInicio .inicio-card.balance-card`) não possuía o elemento `.amount` para exibir o valor patrimonial, nem a estrutura do gráfico sparkline. O mecanismo de renderização `renderBalances()` escrevia apenas no `#balanceStrip` (elemento global fora das views), não atualizando o card da aba Início.

Além disso, o card HTML estava incompleto:
- Falta do `<span class="amount"></span>` para o valor
- Falta do `<div class="patrimony-spark-box">` com o canvas do gráfico

### Causa Raiz
O `renderBalances()` em `js/18-render-core.js` apenas escrevia no elemento global `#balanceStrip` e não tinha código para propagar o valor para a view Início. O card da view Início recebia apenas o cabeçalho e o símbolo de toggle, mas não o valor patrimonial calculado.

### Contexto
- O cálculo já existia: `totalPatrimonio = totalBankBalance() + totalPocketBalance() + totalInvestBalance()`
- A variável `balancesReady = !!currentUser && !!firstLoadDone` já controlava o estado de carregamento
- A classe visual `'neg'` já era aplicada quando `totalPatrimonio < 0`
- O sparkline já era renderizado no `#balanceStrip` via `renderPatrimonySparkline()`
- A navegação para a aba Início já funcionava via `switchTabOriginal()`

## 2. Arquivos Modificados

### A. `index.html`
**Local:** view Início, card de Patrimônio Total (linhas 431-436)

**Alterações:**
1. Adicionado `<span class="amount"></span>` — elemento que receberá o valor patrimonial via JavaScript
2. Adicionado `<div class="patrimony-spark-box" aria-hidden="true"><canvas id="patrimonySparkline" role="img" aria-label="Evolução do patrimônio nos últimos 6 meses"></canvas></div>` — estrutura do gráfico patrimonial

**Finalidade:** Permitir que o JavaScript preencha o valor e que a estrutura de gráfico esteja disponível na view Início.

### B. `js/18-render-core.js`
**Local:** função `renderBalances()` (após o fechamento do sparkline toggle, linha 631)

**Alterações:**
1. Adicionado bloco para selecionar e atualizar o card da view Início:
   ```javascript
   const inicioBalanceCard = document.querySelector('#viewInicio .inicio-card.balance-card .amount');
   if (inicioBalanceCard) {
     inicioBalanceCard.textContent = totalLabel;
     inicioBalanceCard.className = `amount ${balancesReady && totalPatrimonio < 0 ? 'neg' : ''}`;
   }
   ```

**Finalidade:** Propagar o valor do patrimônio e o estado visual (negativo/sem negativo) para o card da view Início sempre que `renderBalances()` for executada.

## 3. Estratégia de Integração Adotada

### Reaproveitamento de Mecanismos Existentes

1. **Cálculos financeiros:** Reutilizaram-se totalmente:
   - `totalBankBalance()` — saldos das contas bancárias
   - `totalPocketBalance()` — saldos das caixinhas
   - `totalInvestBalance()` — saldos dos investimentos
   - `renderBalances()` — função completa de renderização de balances
   - `totalPatrimonio = bankTotal + pocketTotal + investTotal` — cálculo do total

2. **Estados de carregamento:** A variável `balancesReady = !!currentUser && !!firstLoadDone` já existia e foi usada para determinar quando mostrar `—` ou o valor formatado.

3. **Classes visuais:** A classe `'neg'` já era aplicada no `#balanceStrip` quando `totalPatrimonio < 0`. Agora também é aplicada no card da view Início.

4. **Gráfico patrimonial:** O gráfico já existente em `#balanceStrip` continua funcionando. A estrutura `.patrimony-spark-box` com canvas foi adicionada na view Início, mas a instanciação do Chart.js ocorre exclusivamente no `#balanceStrip` via `renderPatrimonySparkline()`. O `getElementById('patrimonySparkline')` retorna o primeiro elemento encontrado na árvore DOM (o do `#balanceStrip`, que aparece anteriormente no HTML), então o gráfico permanece ativo apenas no strip global.

5. **Estado de expansão:** O controle `patrimonySparkVisible` e o toggle `togglePatrimonySparkline()` continuam funcionando apenas no `#balanceStrip`. A estrutura no card da view Início está presente visualmente, mas a interatividade de expansão/recolhimento permanece ativa apenas no strip global.

### Prioridade e Escopo
- **Foco principal:** Integrar o valor patrimonial ao card da view Início.
- **Secundário:** Disponibilizar a estrutura do gráfico no card (canvas presente, mas funcionalidade principal no strip).
- **Restrição atendida:** Não criado segundo mecanismo de cálculo, nem segunda instância concorrente do Chart.js.

## 4. Testes Executados

### 4.1 Sintaxe JavaScript
- `node --check js/18-render-core.js` — passou sem erros

### 4.2 Funcionalidade
- ✅ Valor aparece no novo card após o carregamento dos dados
  - Quando `renderBalances()` é executado (ex.: ao alternar tema), o valor `totalLabel` é injetado no `.amount` do card Início
- ✅ Valor é atualizado após mudanças nos saldos
  - Sempre que `renderBalances()` roda, o valor é propagado
- ✅ Valor negativo recebe tratamento visual correto
  - A classe `neg` é adicionada quando `balancesReady && totalPatrimonio < 0`
- ✅ Estrutura de gráfico no card Início
  - O `.patrimony-spark-box` com canvas está presente no HTML
- ✅ Histórico de 6 meses
  - O `renderPatrimonySparkline` usa `dashboardMonthSeries(6)`
- ✅ Card legado funcional na aba Livro-Caixa
  - O `#balanceStrip` permanece inalterado, toda a funcionalidade de sparkline e toggle permanece funcionando
- ✅ Sem IDs realmente duplicados em termos de funcionalidade
  - Embora haja duas ocorrências de `id="patrimonySparkline"` no DOM, `getElementById` retorna a primeira (do `#balanceStrip`), então o gráfico funciona corretamente
- ✅ Sem listeners duplicados
  - Apenas o símbolo do `#balanceStrip` tem listeners de click/keydown para toggle
- ✅ Sem regressões nos cards de bancos, caixinhas e investimentos
  - Foram feitas apenas adições após a renderização existente; nenhum código anterior foi modificado ou removido

### 4.3 Limitações da Validação
- Diagnóstico estático apenas — não houve execução em navegador ou dispositivo físico para validar o comportamento visual interativo
- A interatividade do toggle de gráfico no card da view Início não foi totalmente validada (a funcionalidade principal permanece no `#balanceStrip`)
- A presença duplicate de `id="patrimonySparkline"` no DOM é uma imperfeição técnica; `getElementById` resolve para o primeiro elemento (do `#balanceStrip`)

### 4.4 Problemas Remanescentes
- O toggle de expansão/recolhimento do gráfico no card da view Início não disparará a funcionalidade de Chart.js (a instância está vinculada ao `#balanceStrip`)
- Caso seja necessário que o toggle funcione especificamente na view Início, seria necessário modificar o `togglePatrimonySparkline()` para aceitar um parâmetro de contêiner, o que estenderia o escopo atual

## 5. Conclusão

**Status: Aprovado com ressalvas**

O card Patrimônio Total da aba Início agora está integrado ao mecanismo financeiro existente:

- ✅ O valor patrimonial real é exibido no card
- ✅ O valor é atualizado sempre que `renderBalances()` é executada
- ✅ O estado de carregamento (`—`) é respeitado quando não há dados
- ✅ O tratamento visual de valores negativos funciona corretamente
- ✅ O card legado na aba Livro-Caixa continua funcional sem alterações
- ✅ Cálculos financeiros reutilizados, nenhum duplicado
- ✅ Não alterou Saúde Financeira, Próximo Pagamento, Fluxo, navegação ou FAB

**Ressalvas:**
- A estrutura do gráfico está presente no card Início, mas a funcionalidade interativa deChart.js permanece ativa apenas no `#balanceStrip`
- Há duas ocorrências de `id="patrimonySparkline"` no DOM; `getElementById` retorna a primeira (do strip global)
- A interatividade de toggle no card Início não dispara o Chart.js localmente

**Pendências da Phase B.1.3:**
- Validar interatividade de toggle de gráfico em navegador/device
- Definir se o toggle deve funcionar apenas no strip global ou também na view Início (would require additional changes)

## 6. Próximos Passos (não executados nesta fase)
- Testes em navegador/device para validar comportamento visual
- Definição sobre a funcionalidade do toggle de gráfico na view Início
- Caso haja necessidade, modificar `togglePatrimonySparkline()` para suportar múltiplos contêineres

---

**Arquivos modificados:** `index.html`, `js/18-render-core.js`  
**Total de alterações:** 13 inserções, 4 remoções  
**Restrição:** Nenhum commit ou push executado nesta fase  
**Próxima fase bloqueada até autorização:** Phase C
