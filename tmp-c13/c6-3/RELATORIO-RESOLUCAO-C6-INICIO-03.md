# Relatório de resolução — C6-INICIO-03

**Base:** `0ce008533168d407f611f424b994fc53980ebaef` · **Correções:** `651c081` e `de4ee7f` · **HEAD de referência:** `bdfb965`
**Branch:** `feat/app-layout-redesign`  
**Estado inicial:** árvore limpa, `origin/feat/app-layout-redesign...HEAD = 0 0`  
**Data:** 2026-11-26  
**Escopo:** somente isolamento Início ↔ Visão Geral e pendências P-01/P-02 do bloco de Orçamentos.

## 1. Metodologia

1. Confirmação de branch, HEAD, árvore e sincronização.
2. Leitura integral dos relatórios anteriores de C6-INICIO-03 e inspeção dos commits `f14955d` e `0ce0085`.
3. Rastreamento estático de A-05 a A-08 e P-01/P-02 por três agentes de exploração independentes.
4. Reprodução em CDP headless com dados fictícios em memória:
   - `A-05`: período `3m` definido na Início, leitura da Visão Geral e da aba `dash`.
   - `A-06`: preferência `'0'`, abertura da Início e ida para Livro-Caixa.
   - `A-07`: `renderAdvancedDashboard()` chamado duas vezes e após alternância de abas.
   - `A-08`: cinco alternâncias Início ↔ Visão Geral e contagem de hosts.
   - `P-01`: caso misto com agregado 53% e categoria 105%.
   - `P-02`: orçamento com `month` do ciclo anterior e gasto do ciclo atual.
5. Correções mínimas somente nos defeitos comprovados.
6. Reexecução CDP pós-correção e validações locais disponíveis.

> O skill `auditoria` não carregou neste ambiente (`ripgrep execution failed`); a auditoria foi conduzida manualmente com exploração estática e CDP.

## 2. Diagnóstico A-05 a A-08

### A-05 — `dashFilters.period`
- **Origem:** `js/20-dashboard.js:460,452`; chave `livrocaixa_dashboard_filters_v1` em `js/99-init.js:762`.
- **Escritores:** filtro da aba `dash` (`js/99-init.js:797-809`), modal customizado (`:2046-2066`) e `#inicioPeriodSelect` (`js/18-render-core.js:917-930`).
- **Leitores:** `dashPreset()`, `dashRange()`, `dashBuckets()`, `buildDashboardSummary()`, `dashSyncFilterUI()` e `inicioPeriodKey()`.
- **Destinos:** Visão Geral **não lê** `dashFilters`; `renderAdvancedDashboard()` usa mês atual e `dashboardMonthSeries(6)` fixos.
- **Evidência CDP:** após `3m` na Início, `#advancedDashboard` não menciona 3 meses; aba `dash` mostra 3 meses sem botão ativo.
- **Interferência:** apenas com a aba `dash`, fora do escopo desta tarefa.
- **Ação:** nenhuma. Compartilhamento é intencional e não afeta Início ↔ Visão Geral.

### A-06 — `patrimonySparkVisible`
- **Origem:** `js/18-render-core.js:108`; chave `livro-caixa-patrimony-spark` em `js/99-init.js:359-360`.
- **Escritores:** `togglePatrimonySparkline()` (`:327-368`) e force-visible em `renderBalances()` (`:810-815`).
- **Destinos:** instâncias separadas `{inicio, strip}` em `js/18-render-core.js:53`; `activePatrimonySparkContext()` retorna `null` para `dashboard`.
- **Evidência CDP:** com preferência `'0'`, Início mostra gráfico; Visão Geral não possui gráfico; ao ir para Livro-Caixa, o cartão total fica `aria-expanded=true` embora `localStorage` continue `'0'`.
- **Interferência:** resíduo apenas entre Início e Livro-Caixa, fora do escopo. Nenhuma interferência com Visão Geral.
- **Ação:** nenhuma.

### A-07 — `markBudgetAlertShown()`
- **Origem:** `js/11-financial-domain.js:29-38`; chave `livrocaixa_budget_alerts_shown`.
- **Único consumidor:** `js/20-dashboard.js:226-227`, dentro de `renderAdvancedDashboard()`.
- **Evidência pré-correção:** render 1 exibia “Limite ultrapassado” e gravava a chave; render 2 e após alternância mostravam apenas “Fluxo negativo”.
- **Interferência:** confirmada. Renderizações e entrada na Início consumiam alertas da Visão Geral. Não existe fluxo de confirmação do usuário.
- **Correção aplicada:** remoção de `alertKey`, `getShownBudgetAlerts()` e `markBudgetAlertShown()` do loop de alertas. `tier` e mensagens permanecem.
- **Código anterior:**
  ```js
  const alertKey = `${cat.id}_${budgetCycle}_${tier}`;
  if (getShownBudgetAlerts()[alertKey]) return;
  markBudgetAlertShown(alertKey);
  ```
- **Código atual:** essas três linhas foram removidas; o alerta é determinístico a cada render.

### A-08 — `render()` / `switchTabOriginal()`
- **Cadeia real:** nav → `window.switchTab` → wrapper de patches → `switchTabOriginal()` (`js/99-init.js:410-460`). Não existe segundo sistema de navegação.
- **Fan-out:** `renderAdvancedDashboard()` para `dashboard` e `inicio`; `renderInicioBudgets()` somente para `inicio`; `renderBalances()` para `inicio`/`caixa`; `renderDashboardTab()` somente para `dash`.
- **Evidência CDP:** após cinco alternâncias, hosts/resumo/ações permaneceram `1/1/1`; nenhuma duplicação de listeners foi observada no teste de clique do modal.
- **Interferência:** apenas a provocada por A-07.
- **Ação:** nenhuma alteração em navegação ou fan-out.

## 3. Diagnóstico P-01 — status geral

- **Problema confirmado:** `tier` era calculado somente por `spent / planned` agregado (`js/18-render-core.js:3331`), enquanto categorias eram classificadas independentemente.
- **Evidência pré-correção:** agregado 53% com `Dentro do limite` e categoria `105% Excedido`.
- **Correção aplicada:** o status geral passa a adotar a categoria mais grave entre todas as rows de `dashBudgetRows()`, usando os mesmos limiares 80/100 já usados por badges e alertas.
- **Código atual:**
  ```js
  const tierFor = value => value >= 100 ? 'excedido' : value >= 80 ? 'atencao' : 'normal';
  const tierRank = { normal: 0, atencao: 1, excedido: 2 };
  const tier = rows.reduce((worst, row) => {
    const rowTier = tierFor(Math.max(0, Number(row.pct) || 0));
    return tierRank[rowTier] > tierRank[worst] ? rowTier : worst;
  }, tierFor(pct));
  ```
- **Preservado:** percentual agregado, valores, barras, até três categorias, estado vazio e limite zero.
- **Evidência pós-correção:** o mesmo caso mostra `53%` com `Limite excedido`.

## 4. Diagnóstico P-02 — contrato temporal dos orçamentos

- **Descoberta:** `month` era gravado, mas nunca lido. `budgetFor()` selecionava apenas por `updatedAt`; `budgetSpent()` usa ciclo financeiro.
- **Contrato adotado:** orçamento vale para o ciclo financeiro de referência dos gastos. Por compatibilidade, `month` escrito pelo código antigo (`currentMonthYM()`) continua aceito como alias transitório; registros de meses anteriores são ignorados.
- **Código anterior:**
  ```js
  const matches = budgets.filter(item => item.categoryId === categoryId);
  ```
- **Código atual:**
  ```js
  const allowedMonths = new Set([cycleKey]);
  if (typeof currentMonthYM === 'function') allowedMonths.add(currentMonthYM());
  const matches = budgets.filter(item => item.categoryId === categoryId && allowedMonths.has(item.month));
  const exact = matches.filter(item => item.month === cycleKey);
  const candidates = exact.length ? exact : matches;
  ```
- **Escrita do modal:** `month: currentMonthYM()` → `month: currentFinancialCycleKey()` em `js/20-dashboard.js:1836`.
- **Compatibilidade:** a exclusão atual no modal foi preservada; não houve alteração destrutiva de persistência.
- **Evidência pré-correção:** orçamento `2026-10` era selecionado para gastos de `2026-11`.
- **Evidência pós-correção:** `budgetFor()` retorna `null` e `dashBudgetRows()` não produz linha para o mês anterior.

## 5. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `js/18-render-core.js` | Contrato temporal em `budgetFor()` e status geral por pior categoria em `renderInicioBudgets()`. |
| `js/20-dashboard.js` | Remoção do efeito colateral de alertas e gravação de `month` pelo ciclo financeiro. |
| `e2e/smoke/inicio-orcamentos.spec.js` | Novos cenários de P-01, A-07 e P-02; expectativas atualizadas. |
| `tmp-c13/c6-3/diagnostico-pre-correcao.json` | Estado observado antes das correções. |
| `tmp-c13/c6-3/diagnostico-pos-correcao.json` | Estado observado depois das correções. |
| `tmp-c13/c6-3/prints/p01-status-apos-390.png` | Evidência visual do status geral corrigido. |
| `tmp-c13/c6-3/prints/a07-alertas-apos-390.png` | Evidência visual dos alertas estáveis na Visão Geral. |
| `tmp-c13/c6-3/RELATORIO-RESOLUCAO-C6-INICIO-03.md` | Este relatório. |
| `tmp-c13/c6-3/INDICE-EVIDENCIAS.md` | Índice atualizado. |

## 6. Testes e resultados

| Teste | Estado | Resultado |
|---|---|---|
| `node --check` dos JS alterados | PASS | Sem erro de sintaxe. |
| `git diff --check` | PASS | Sem erros. |
| `npm run code:syntax` | PASS | `SINTAXE: OK (0 bloco(s) inline de index.html + 31 arquivo(s) .js)`. |
| `npm run code:oracles` | PASS | 149 testes, 149 pass, 0 fail. |
| `npm run code:security` | PASS | 94 testes, 94 pass, 0 fail. |
| CDP — A-07 | PASS | Alertas idênticos em dois renders e após alternância; chave `localStorage` vazia. |
| CDP — P-01 | PASS | Agregado 53% com status `Limite excedido`. |
| CDP — P-02 | PASS | Orçamento do mês anterior não é selecionado. |
| CDP — A-08 | PASS | Sem duplicação após cinco alternâncias. |
| `e2e/smoke/inicio-orcamentos.spec.js` | BLOCKED | Playwright indisponível: `Unsupported platform: android`; `sh: 1: playwright: not found`. |
| C.O.D.E. remoto | NOT RUN | Não autorizado nesta tarefa. |
| Firebase real | NOT RUN | Dados CDP são fictícios e apenas em memória. |
| Auditoria independente | NOT RUN | Aguardando revisão externa. |

## 7. Pendências restantes

- A-05: alinhar a aba `dash` ao período `3m` ou remover `3m` da Início — decisão de produto fora do escopo.
- A-06: corrigir o resíduo Início ↔ Livro-Caixa sem alterar a preferência salva — fora do escopo.
- Executar o spec E2E em CI/PC e C.O.D.E. remoto.
- Revisão independente e aceite do usuário.

## 8. Parecer final

Não há interferência indevida demonstrada entre Início e Visão Geral após as correções. A-05 e A-06 são acoplamentos reais, mas com outros destinos (`dash` e Livro-Caixa), e foram documentados sem alteração. A-07, P-01 e P-02 eram defeitos comprovados e foram corrigidos com mudanças localizadas. A-08 não exige correção adicional.

## 9. Correção pontual pós-revisão — estado vazio por ciclo

A revisão do commit `651c081` apontou uma inconsistência em P-02: `hasConfigured` considerava qualquer orçamento armazenado, inclusive de ciclos anteriores. Com apenas um orçamento antigo, `budgetFor()` o ignorava corretamente, mas a interface exibia “Defina limites” em vez de “Você ainda não tem orçamentos para este ciclo”.

**Código anterior:**
```js
const hasConfigured = Array.isArray(budgets) && budgets.length > 0;
```

**Código atual:**
```js
const hasCurrentBudget = Array.isArray(budgets) && budgets.some(item => {
  if (!item || !item.categoryId) return false;
  const selected = budgetFor(item.categoryId);
  return !!selected && selected.id === item.id;
});
```

A mensagem agora distingue:
- nenhum orçamento selecionável no ciclo → “Você ainda não tem orçamentos cadastrados para este ciclo”;
- orçamento do ciclo com limite zero → “Defina limites para acompanhar seus orçamentos neste ciclo”;
- limites positivos → renderização normal.

O teste de limite zero foi ajustado para usar `month: cycle` em vez de um mês fixo, preservando a distinção entre cenários.

**Validação CDP (`validacao-estado-vazio-ciclo.json`):**

| Cenário | Mensagem observada |
|---|---|
| Sem orçamento | “Você ainda não tem orçamentos cadastrados para este ciclo.” |
| Somente orçamento do ciclo anterior | “Você ainda não tem orçamentos cadastrados para este ciclo.” |
| Orçamento do ciclo com valor zero | “Defina limites para acompanhar seus orçamentos neste ciclo.” |
| Orçamento positivo do ciclo | Render normal, 50%, duas barras. |

O spec E2E permanece **BLOCKED** localmente por Playwright; os cenários foram escritos, mas não executados neste ambiente.

**Não foi feito commit, push, merge, release ou deploy.**
