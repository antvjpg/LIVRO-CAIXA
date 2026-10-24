/* LIVRO-CAIXA · js/20-dashboard.js — dashboard e indicadores (app.js: 4732-6319). Separação por responsabilidade; conteúdo preservado. */

  function dashChartTheme() {
    const styles = getComputedStyle(document.body);
    const readVar = (name, fallbackValue) => styles.getPropertyValue(name).trim() || fallbackValue;
    const masked = () => document.body.classList.contains('balances-hidden');
    const money = value => (masked() ? '••••••' : fmt(value));
    return {
      ink: readVar('--ink', '#1C2B24'),
      inkSoft: readVar('--ink-soft', '#4C5A52'),
      lineColor: readVar('--line', '#D8D2C1'),
      green: readVar('--dash-flow-income', readVar('--green', '#3E9B6E')),
      red: readVar('--dash-flow-expense', readVar('--red', '#C2553B')),
      gold: readVar('--dash-flow-patrimony', readVar('--gold', '#B08D3E')),
      masked,
      money,
      tick: value => {
        if (masked()) return '';
        return moneyDisplaySymbol() + Math.round(moneyToDisplay(Number(value) || 0)).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
      }
    };
  }

  /* Traço tracejado separando a área do gráfico da legenda desenhada dentro
     do canvas (position:'bottom'). Padrão visual já usado nas listas HTML
     (.cat-bars-list). Quando a legenda não existe (mobile/oculta), não faz nada. */
  function dashLegendDividerPlugin(color) {
    return {
      id: 'dashLegendDivider',
      afterDraw(chart) {
        const boxes = chart.legend && chart.legend.legendHitBoxes;
        if (!boxes || !boxes.length) return;
        const first = boxes[0];
        if (!first || !first.height || !first.width) return;
        const { ctx, chartArea } = chart;
        const y = Math.round(first.y - 6) + 0.5;
        if (y <= chartArea.bottom + 2) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
      }
    };
  }

  function monthEndDate(month) { const [year, value] = month.split('-').map(Number); return `${month}-${String(new Date(year, value, 0).getDate()).padStart(2, '0')}`; }
  function balanceAtDate(bankId, cutoff) {
    const bank = banks.find(item => item.id === bankId);
    return Number(bank?.initial || 0) + entries.filter(entry => entry.bank === bankId && String(entry.date || '') <= cutoff).reduce((sum, entry) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0)), 0);
  }
  function pocketBalanceAtDate(pocket, cutoff) {
    const initial = Number(pocket?.initial ?? pocket?.value ?? 0) || 0;
    return initial + yieldsLog.filter(item => item.targetType === 'pocket' && item.targetId === pocket.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + (item.kind === 'resgate' ? -1 : 1) * Number(item.amount || 0), 0);
  }
  function investmentValueAtDate(inv, cutoff) {
    if (inv.type === 'Renda Fixa') return Math.max(0, fixedIncomeInitialValue(inv) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + movementDelta(item), 0));
    if (isCryptoType(inv.type)) {
      const units = cryptoInitialUnits(inv) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + (item.kind === 'resgate' ? -1 : 1) * Number(item.units || 0), 0);
      const points = Array.isArray(inv.priceHistory) ? inv.priceHistory.filter(item => String(item.date || '') <= cutoff).sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))) : [];
      const price = Number(points.at(-1)?.price || inv.price || 0);
      return Math.max(0, cryptoValueFromUnits(inv.type, units, price));
    }
    return Math.max(0, Number(inv.initialValue ?? inv.value ?? 0) + yieldsLog.filter(item => item.targetType === 'invest' && item.targetId === inv.id && String(item.dateEnd || item.date || '') <= cutoff).reduce((sum, item) => sum + movementDelta(item), 0));
  }
  function dashboardMonthSeries(count = 6) {
    return Array.from({ length: count }, (_, index) => {
      const offset = index - count + 1;
      const month = monthKeyOffset(offset);
      const cutoff = monthEndDate(month);
      const income = entries.filter(entry => entry.type === 'in' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const expense = entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
      const banksAt = banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0);
      const pocketsAt = pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0);
      const investmentsAt = investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0);
      return { month, label: new Date(`${month}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), income, expense, net: income - expense, patrimony: banksAt + pocketsAt + investmentsAt };
    });
  }
  /* formatMonthLabel canônica definida acima (mês por extenso); evita sobrescrita duplicada */
  function renderAdvancedDashboard() {
    const wrap = document.getElementById('advancedDashboard');
    const mini = document.getElementById('cashflowMiniSummary');
    if (!wrap) return;

    const dashboardMonth = currentMonthYM();
    const month = dashboardMonth;
    const monthIncome = entries.filter(entry => entry.type === 'in' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const monthExpense = entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(month)).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const monthNet = monthIncome - monthExpense;
    const series = dashboardMonthSeries(6);
    const current = series.at(-1) || { income: monthIncome, expense: monthExpense, net: monthNet, patrimony: totalBankBalance() + totalPocketBalance() + totalInvestBalance() };
    const avgNet = series.reduce((sum, item) => sum + item.net, 0) / Math.max(1, series.length);
    const projectionMonths = Number(featureSettings.projectionMonths || 6);
    const projected = current.patrimony + avgNet * projectionMonths;
    const savingsGoal = Number(featureSettings.monthlySavingsGoal) || 0;
    const savingsProgress = savingsGoal > 0 ? Math.max(0, Math.min(100, (monthNet / savingsGoal) * 100)) : 0;
    const savingsGoalHTML = savingsGoal > 0 ? `<div class="pocket-goal dashboard-savings-goal"><div class="pocket-goal-head"><span>Meta de economia mensal</span><strong>${savingsProgress.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${savingsProgress.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(Math.max(0, monthNet))} de ${fmt(savingsGoal)}</div></div>` : '';
    if (mini) mini.innerHTML = `<div class="cashflow-mini-head"><div><strong>Resumo do fluxo</strong><span class="hint">${formatMonthLabel(month)}</span></div><button type="button" class="cashflow-mini-link" onclick="document.getElementById('tabBtnDashboard')?.click()">Ver visão geral</button></div><div class="cashflow-mini-metrics"><div><small>Entradas</small><strong class="positive">${fmt(monthIncome)}</strong></div><div><small>Saídas</small><strong class="negative">${fmt(monthExpense)}</strong></div><div><small>Saldo do mês</small><strong class="${monthNet >= 0 ? 'positive' : 'negative'}">${fmt(monthNet)}</strong></div></div>`;
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const activeBills = recurringBills.filter(bill => bill.active !== false && billAppliesToMonth(bill, year, monthIndex));
    const pendingBills = activeBills.filter(bill => !billGeneratedForMonth(bill, month));
    const overdueBills = pendingBills.filter(bill => String(billDueDateForMonth(bill, year, monthIndex)) < todayISO());
    const upcomingBills = pendingBills.slice().sort((a, b) => billDueDateForMonth(a, year, monthIndex).localeCompare(billDueDateForMonth(b, year, monthIndex))).slice(0, 3);
    const health = monthNet < 0 ? { label: 'Atenção', detail: 'As saídas superaram as entradas neste mês.', tone: 'warning', icon: '!' } : overdueBills.length ? { label: 'Revisar compromissos', detail: `${overdueBills.length} conta(s) aguardam atenção.`, tone: 'warning', icon: '!' } : (monthIncome > 0 || monthExpense > 0) ? { label: 'Equilibrado', detail: 'Fluxo positivo e compromissos sob acompanhamento.', tone: 'positive', icon: '✓' } : { label: 'Comece seu acompanhamento', detail: 'Registre movimentações para ver sua saúde financeira.', tone: 'neutral', icon: '○' };
    const visaoScoreParts = [];
    if (monthIncome > 0) visaoScoreParts.push(dashClampPct((monthNet / monthIncome) * 100, 20));
    if (series.length) visaoScoreParts.push((series.filter(item => item.net >= 0).length / series.length) * 100);
    const visaoScore = dashFinanceScore(visaoScoreParts);
    const budgetCycle = currentFinancialCycleKey();
    const budgetRows = categories.map(cat => { const budget = budgetFor(cat.id); if (!budget || !(budget.amount > 0)) return ''; const spent = budgetSpent(cat.id, budgetCycle); const pct = Math.max(0, spent / budget.amount * 100); const visualPct = Math.min(100, pct); const overLabel = pct >= 100 ? ' · limite excedido' : ''; return `<div class="budget-summary-row"><div><strong>${escapeHTML(cat.name)}</strong><span>${fmt(spent)} de ${fmt(budget.amount)}${overLabel}</span></div><div class="budget-summary-track"><span class="${pct >= 100 ? 'over' : ''}" style="width:${visualPct.toFixed(2)}%" data-real-percent="${pct.toFixed(2)}"></span></div><b>${pct.toFixed(0).replace('.', ',')}%</b></div>`; }).filter(Boolean).join('');

    const incomeCats = categoryTypeTotals('in', entries.filter(entry => String(entry.date || '').startsWith(month)));
    const incomeCatSectionHTML = buildIncomeCatSectionHTML(month, incomeCats);

    (function updateNextPaymentCard(){
      const host = document.getElementById('dashboardNextPayment');
      if (!host) return;
      const today = todayISO().slice(0, 10);
      const list = (typeof pendingBills !== 'undefined' && Array.isArray(pendingBills) ? pendingBills : [])
        .filter(bill => {
          try {
            if (typeof billPaidForMonth === 'function' && billPaidForMonth(bill, month)) return false;
            if (typeof billGeneratedForMonth === 'function' && billGeneratedForMonth(bill, month)) return false;
            const st = typeof billStatus === 'function' ? billStatus(bill, month) : '';
            if (st === 'Pago — não lançado' || st === 'Lançado' || st === 'Atrasado') return false;
          } catch (e) {}
          const due = String(billDueDateForMonth(bill, year, monthIndex) || '').slice(0, 10);
          // hoje ou futuro apenas
          return due && due >= today;
        })
        .sort((a,b) => String(billDueDateForMonth(a, year, monthIndex)).localeCompare(String(billDueDateForMonth(b, year, monthIndex))));
      const next = list[0];
      if (!next) {
        host.innerHTML = '<div class="next-pay-inner empty"><span class="next-pay-kicker">Próximo pagamento</span><strong>Nenhum pagamento pendente</strong></div>';
        return;
      }
      const due = String(billDueDateForMonth(next, year, monthIndex)).slice(0, 10);
      const dueFmt = due.split('-').reverse().join('/');
      host.innerHTML = '<div class="next-pay-inner"><span class="next-pay-kicker">Próximo pagamento</span><div class="next-pay-row"><strong>' + escapeHTML(next.name || 'Conta') + '</strong><b>' + fmt(next.amount) + '</b></div><span class="hint">Vence em ' + dueFmt + '</span></div>';
    })();

    const commitments = upcomingBills.map(bill => { const dueDate = billDueDateForMonth(bill, year, monthIndex); const status = billStatus(bill, month); const tone = status === 'Atrasado' ? 'overdue' : ''; return `<div class="dashboard-commitment-row ${tone}"><div><strong>${escapeHTML(bill.name || 'Conta recorrente')}</strong><span>${status} · ${dueDate.split('-').reverse().join('/')}</span></div><b>${fmt(bill.amount)}</b></div>`; }).join('');
    const alerts = [];
    if (monthNet < 0) alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>Fluxo negativo</strong><small>As saídas superam as entradas em ${fmt(Math.abs(monthNet))}.</small></div></div>`);
    if (overdueBills.length) alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>${overdueBills.length} compromisso(s) atrasado(s)</strong><small>Confira os avisos antes de gerar lançamentos automáticos.</small></div></div>`);
    const overBudgetCount = categories.filter(cat => { const budget = budgetFor(cat.id); return budget && budget.amount > 0 && budgetSpent(cat.id, budgetCycle) > budget.amount; }).length;
    categories.forEach(cat => {
      const budget = budgetFor(cat.id);
      if (!budget || !(budget.amount > 0)) return;
      const spent = budgetSpent(cat.id, budgetCycle);
      const pct = spent / budget.amount * 100;
      const tier = pct >= 100 ? 'over' : pct >= 80 ? '80' : null;
      if (!tier) return;
      const alertKey = `${cat.id}_${budgetCycle}_${tier}`;
      if (getShownBudgetAlerts()[alertKey]) return;
      markBudgetAlertShown(alertKey);
      const msg = tier === 'over'
        ? `Você ultrapassou o limite de ${cat.name} em ${fmt(spent - budget.amount)}.`
        : `Você já utilizou ${pct.toFixed(0)}% do limite de ${cat.name}.`;
      alerts.push(`<div class="dashboard-alert-row warning"><span>!</span><div><strong>${tier === 'over' ? 'Limite ultrapassado' : 'Limite quase no fim'}</strong><small>${escapeHTML(msg)}</small></div></div>`);
    });
    const advanceDays = Number(featureSettings.reminderAdvanceDays) || 0; const advanceBills = advanceDays ? pendingBills.filter(bill => { const due = new Date(`${month}-${String(billDueDateForMonth(bill, year, monthIndex).slice(-2)).padStart(2, '0')}T23:59:59`); return due >= new Date() && (due - new Date()) / 86400000 <= advanceDays; }) : []; if (advanceBills.length) alerts.push(`<div class="dashboard-alert-row"><span>i</span><div><strong>Fatura próxima</strong><small>${advanceBills.length} conta(s) vencem nos próximos ${advanceDays} dia(s).</small></div></div>`);
    if (!alerts.length) alerts.push(`<div class="dashboard-alert-row positive"><span>✓</span><div><strong>Nenhum alerta importante</strong><small>Seu painel não encontrou pendências críticas neste momento.</small></div></div>`);

    wrap.innerHTML = `<section class="advanced-dashboard dashboard-page"><div class="dashboard-page-heading"><div><span class="eyebrow">Visão geral</span><h2>Como está seu dinheiro?</h2><p>Uma leitura simples do mês atual e dos últimos seis meses.</p></div><span class="dashboard-period">${formatMonthLabel(month)}</span></div><div class="dashboard-health-card ${health.tone}"><span class="dashboard-health-icon">${health.icon}</span><div><strong>Saúde financeira${visaoScore ? ` · score ${visaoScore.value}/100` : ''}</strong><small>${health.detail}</small></div><b>${visaoScore ? `${visaoScore.value} · ${health.label}` : health.label}</b></div><div class="dashboard-metrics"><div><small>Entradas no mês</small><strong class="positive">${fmt(current.income)}</strong></div><div><small>Saídas no mês</small><strong class="negative">${fmt(current.expense)}</strong></div><div><small>Fluxo líquido</small><strong class="${current.net >= 0 ? 'positive' : 'negative'}">${fmt(current.net)}</strong></div><div><small>Patrimônio atual</small><strong>${fmt(current.patrimony)}</strong></div></div><div class="dashboard-projection-card"><div><small>Estimativa para os próximos ${projectionMonths} meses</small><strong>${fmt(projected)}</strong></div><p>Baseada no patrimônio atual e no fluxo líquido médio dos últimos seis meses: <b>${fmt(avgNet)}/mês</b>.</p></div>${savingsGoalHTML}<div class="dashboard-trend dashboard-flow-chart"><div class="dashboard-trend-head"><div><strong>Entradas e saídas por mês</strong><span>Compare os valores de cada período</span></div><span>últimos 6 meses</span></div><div class="dash-chart-box dashboard-monthly-flow-box" id="dashMonthlyFlowChartBox"><canvas id="dashMonthlyFlowChart" role="img" aria-label="Gráfico de entradas, saídas e patrimônio estimado dos últimos meses"></canvas></div><div class="dash-chart-fallback dashboard-monthly-flow-fallback" id="dashMonthlyFlowFallback" hidden></div><p class="dashboard-footnote">O patrimônio histórico é uma estimativa quando não existe cotação registrada para cada mês. Ele não altera seus saldos atuais.</p></div>${incomeCatSectionHTML}${budgetRows ? `<div class="dashboard-budgets"><div class="dashboard-section-heading"><strong>Orçamento do mês</strong><span>Acompanhe seus limites</span></div>${budgetRows}</div>` : '<div class="dashboard-empty-state">Defina orçamentos em Perfil → Preferências financeiras para acompanhar limites por categoria nesta visão.</div>'}<div class="dashboard-commitments"><div class="dashboard-section-heading"><strong>Próximos compromissos</strong><span>${upcomingBills.length ? `${upcomingBills.length} pendente(s)` : 'Tudo em dia'}</span></div>${commitments || '<div class="dashboard-empty-state">Nenhuma conta ou fatura encontrada para o filtro/titular selecionado neste mês.</div>'}</div><div class="dashboard-alerts"><div class="dashboard-section-heading"><strong>Avisos importantes</strong><span>Atualizado agora</span></div>${alerts.join('')}</div></section>`;
    renderDashboardMonthlyFlowChart(series);
    renderDashboardIncomeCatChart(incomeCats);
  }

  let dashboardIncomeCatChartInstance;


  function destroyDashboardIncomeCatChart() {
    if (!dashboardIncomeCatChartInstance) return;
    try {
      dashboardIncomeCatChartInstance.destroy();
    } catch (err) {}
    dashboardIncomeCatChartInstance = null;
  }

  function buildIncomeCatSectionHTML(month, incomeCats) {
    if (!incomeCats.length) return '';
    const total = incomeCats.reduce((sum, item) => sum + item.total, 0);
    const chartRows = groupCategoryRowsForChart(incomeCats, total, 2);
    const max = chartRows[0].total;
    return `<div class="dashboard-trend dashboard-income-cats"><div class="dashboard-trend-head"><div><strong>Entradas por categoria</strong><span>Como as entradas do mês se distribuem</span></div><span>${escapeHTML(formatMonthLabel(month))}</span></div><div class="cat-summary-content"><div class="chart-container"><canvas id="dashIncomeCatChart" role="img" aria-label="Gráfico de entradas por categoria do mês"></canvas></div><div class="cat-bars-list"><div class="cat-legend-head"><span>Categoria</span><span>Movimentação</span><span>%</span></div>${chartRows.map(x => `
      <div class="cat-row" style="--category-color:${categoryColor(x.cat)}">
        <span class="cat-name">${escapeHTML(x.cat.name)}</span>
        <span class="cat-bar-wrap"><div class="cat-bar" style="width:${(x.total / max * 100).toFixed(0)}%"></div></span>
        <span class="cat-amt">${fmt(x.total)}</span>
        <span class="cat-pct">${(x.total / total * 100).toFixed(1).replace('.', ',')}%</span>
      </div>`).join('')}</div></div></div>`;
  }

  function renderDashboardIncomeCatChart(incomeCats) {
    const canvas = document.getElementById('dashIncomeCatChart');
    destroyDashboardIncomeCatChart();
    if (!canvas || !incomeCats.length || typeof Chart === 'undefined') return;
    const chartRows = groupCategoryRowsForChart(incomeCats, incomeCats.reduce((sum, item) => sum + item.total, 0), 2);
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = getComputedStyle(document.body).getPropertyValue('--ink').trim() || (isDark ? '#E3E8E4' : '#1C2B24');
    const borderColor = getComputedStyle(document.body).getPropertyValue('--paper').trim() || (isDark ? '#121915' : '#F7F5EF');
    const isMobileLayout = window.matchMedia('(max-width: 680px)').matches;

    dashboardIncomeCatChartInstance = new Chart(canvas, {
      type: 'doughnut',
      plugins: [dashLegendDividerPlugin(getComputedStyle(document.body).getPropertyValue('--line').trim() || '#D8D2C1')],
      data: {
        labels: chartRows.map(x => x.cat.name),
        datasets: [{
          data: chartRows.map(x => x.total),
          backgroundColor: chartRows.map(x => categoryColor(x.cat)),
          borderColor: borderColor,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: isMobileLayout ? '67%' : '62%',
        plugins: {
          legend: {
            display: !isMobileLayout,
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: textColor,
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const head = ' ' + context.label + ': ';
                if (document.body.classList.contains('balances-hidden')) return head + '••••••';
                const val = context.raw || 0;
                return head + fmt(val);
              }
            }
          }
        }
      }
    });
  }

  /* Gráfico de barras "Entradas e saídas por mês" (aba Visão geral).
     Reusa dashFlowFallbackHTML quando o Chart.js não está disponível. */
  let dashboardMonthlyFlowChartInstance;


  function destroyDashboardMonthlyFlowChart() {
    if (!dashboardMonthlyFlowChartInstance) return;
    try {
      dashboardMonthlyFlowChartInstance.destroy();
    } catch (err) {
      /* canvas já removido do DOM */
    }
    dashboardMonthlyFlowChartInstance = null;
  }

  function renderDashboardMonthlyFlowChart(series) {
    const canvas = document.getElementById('dashMonthlyFlowChart');
    const box = document.getElementById('dashMonthlyFlowChartBox');
    const fallback = document.getElementById('dashMonthlyFlowFallback');

    destroyDashboardMonthlyFlowChart();

    if (!canvas || typeof Chart === 'undefined') {
      if (box) box.hidden = true;
      if (fallback) {
        fallback.hidden = false;
        fallback.innerHTML = dashFlowFallbackHTML(series);
      }
      return;
    }

    if (fallback) fallback.hidden = true;
    if (box) box.hidden = false;

    const { ink, inkSoft, lineColor, green, red, gold, masked, money, tick } = dashChartTheme();

    dashboardMonthlyFlowChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: series.map(item => item.label),
        datasets: [
          {
            label: 'Entradas',
            data: series.map(item => item.income),
            backgroundColor: green,
            borderRadius: 4,
            maxBarThickness: 22,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Saídas',
            data: series.map(item => item.expense),
            backgroundColor: red,
            borderRadius: 4,
            maxBarThickness: 22,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Patrimônio estimado',
            data: series.map(item => item.patrimony),
            type: 'line',
            borderColor: gold,
            backgroundColor: gold,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
            pointHoverRadius: 4,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: inkSoft,
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              label: context => ` ${context.dataset.label}: ${money(context.parsed.y)}`,
              afterBody: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                const item = series[index];
                return item ? `Resultado: ${money(item.net)}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: ink, font: { size: 10, weight: '600' }, maxRotation: 0, autoSkip: true }
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: lineColor },
            ticks: { color: inkSoft, font: { size: 10 }, callback: tick }
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: gold, font: { size: 10 }, callback: tick }
          }
        }
      }
    });
  }

  /* =====================================================================
     [DASHBOARD] Aba "dash" — análise financeira (aba nova, separada da
     "Visão geral"). Reaproveita as fontes de verdade já existentes:
       entradas/bancos/caixinhas/investimentos → saldo, fluxo e patrimônio
       categories/budgets + ciclo financeiro    → gastos e orçamento
       recurringBills (billAppliesToMonth…)      → compromissos pendentes
       goals (goalPlanning/goalCurrentAmount)    → metas
       LivroCaixaCardEngineV3 + Adapter (js/domain/card-engine-v3-combined.js)  → faturas, limites, parcelas
       getDashboardAlerts()                      → camada determinística
     Nenhuma regra financeira é duplicada neste bloco.
     ===================================================================== */

  let DASH_FILTERS_KEY;

  let DASH_SCHEMA_VERSION;

  let DASH_DAYS_PER_MONTH;

  let DASH_PERIODS;

  let dashFilters;

  let dashCommitmentsExpanded;


  function dashLoadFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem(DASH_FILTERS_KEY) || 'null');
      if (saved && (DASH_PERIODS[saved.period] || saved.period === 'custom')) {
        dashFilters = {
          period: saved.period,
          account: typeof saved.account === 'string' ? saved.account : '',
          compare: saved.compare !== false,
          customStart: typeof saved.customStart === 'string' ? saved.customStart : '',
          customEnd: typeof saved.customEnd === 'string' ? saved.customEnd : ''
        };
      }
    } catch (err) {
      dashFilters = { period: '30d', account: '', compare: true, customStart: '', customEnd: '' };
    }
  }

  function dashSaveFilters() {
    try {
      localStorage.setItem(DASH_FILTERS_KEY, JSON.stringify(dashFilters));
    } catch (err) {
      /* armazenamento indisponível — filtros valem só para a sessão */
    }
  }

  function dashPreset() {
    if (dashFilters.period === 'custom') {
      const start = dashParseISO(dashFilters.customStart);
      const end = dashParseISO(dashFilters.customEnd);
      if (start && end) {
        const days = Math.max(1, Math.ceil((end - start) / 86400000) + 1);
        return {
          label: 'Personalizado',
          days,
          bucket: days <= 14 ? 'day' : days <= 45 ? 'chunk' : 'month',
          custom: true
        };
      }
      return DASH_PERIODS['30d'];
    }
    return DASH_PERIODS[dashFilters.period] || DASH_PERIODS['30d'];
  }

  function dashParseISO(value) {
    const date = new Date(`${String(value || '').slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dashToISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function dashShiftDays(iso, days) {
    const base = dashParseISO(iso);
    if (!base) return iso;
    base.setDate(base.getDate() + days);
    return dashToISO(base);
  }

  function dashShortDate(iso) {
    const parts = String(iso || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
  }

  function dashLongDate(iso) {
    const parts = String(iso || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : '';
  }

  function dashFormatRange(range) {
    if (!range || !range.start || !range.end) return '';
    const yearStart = range.start.slice(0, 4);
    const yearEnd = range.end.slice(0, 4);
    return yearStart === yearEnd
      ? `${dashShortDate(range.start)} a ${dashShortDate(range.end)}/${yearEnd}`
      : `${dashShortDate(range.start)}/${yearStart} a ${dashShortDate(range.end)}/${yearEnd}`;
  }

  /* Período atual e período imediatamente anterior (para comparação). */
  function dashRange(previous) {
    const cfg = dashPreset();
    const today = dashParseISO(todayISO());
    if (!today) return { start: '', end: '' };

    // Período personalizado: respeita as datas escolhidas pelo usuário.
    if (cfg.custom && dashFilters.customStart && dashFilters.customEnd) {
      if (!previous) {
        return { start: dashFilters.customStart, end: dashFilters.customEnd };
      }
      const days = cfg.days || 30;
      const startD = dashParseISO(dashFilters.customStart);
      if (!startD) return { start: '', end: '' };
      const prevEnd = new Date(startD);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - (days - 1));
      return { start: dashToISO(prevStart), end: dashToISO(prevEnd) };
    }

    if (cfg.days) {
      const days = cfg.days;
      const end = new Date(today);
      if (previous) end.setDate(end.getDate() - days);
      const start = new Date(end);
      start.setDate(start.getDate() - (days - 1));
      return { start: dashToISO(start), end: dashToISO(end) };
    }

    const months = cfg.months;
    const currentStart = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
    if (previous) {
      // Período anterior = os N meses completos imediatamente anteriores ao
      // início do período atual (sem lacuna e alinhado às barras mensais).
      const prevStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - months, 1);
      const prevEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
      return { start: dashToISO(prevStart), end: dashToISO(prevEnd) };
    }
    return { start: dashToISO(currentStart), end: dashToISO(today) };
  }

  /* Escopo de lançamentos do período já marcado como transferência ou não. */
  function dashBuildScope(range) {
    const start = range.start;
    const end = range.end;
    const account = dashFilters.account;
    const transferIds = transferCategoryIds();
    const rows = [];

    for (const entry of entries) {
      const date = String(entry.date || '');
      if (date < start || date > end) continue;
      if (account && entry.bank !== account) continue;
      rows.push({ entry, transfer: isTransferEntry(entry, transferIds) });
    }
    return rows;
  }

  function dashFlowOf(rows) {
    let income = 0;
    let expense = 0;
    let transfers = 0;
    for (const row of rows) {
      if (row.transfer) { transfers += 1; continue; }
      const value = Number(row.entry.amount || 0);
      if (row.entry.type === 'in') income += value;
      else if (row.entry.type === 'out') expense += value;
    }
    return { income, expense, net: income - expense, transfers, count: rows.length };
  }

  /* Blocos do gráfico de fluxo: dia (7d), pedaços de 5 dias (30d), mês (6m/1y). */
  function dashBuckets(range) {
    const cfg = dashPreset();
    const out = [];
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    if (!startD || !endD || endD < startD) return out;

    if (cfg.bucket === 'month') {
      let cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
      let guard = 0;
      while (cursor <= endD && guard < 36) {
        guard += 1;
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = `${key}-01`;
        const monthEnd = monthEndDate(key);
        out.push({
          start: monthStart < range.start ? range.start : monthStart,
          end: monthEnd > range.end ? range.end : monthEnd,
          label: new Date(`${key}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
          title: formatMonthLabel(key)
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
      return out;
    }

    if (cfg.bucket === 'day') {
      const cursor = new Date(startD);
      let guard = 0;
      while (cursor <= endD && guard < 40) {
        guard += 1;
        const iso = dashToISO(cursor);
        out.push({ start: iso, end: iso, label: dashShortDate(iso), title: dashLongDate(iso) });
        cursor.setDate(cursor.getDate() + 1);
      }
      return out;
    }

    const size = Math.max(1, Math.ceil(Number(cfg.days || 30) / 5));
    let cursor = new Date(startD);
    let guard = 0;
    while (cursor <= endD && guard < 40) {
      guard += 1;
      const chunkEnd = new Date(cursor);
      chunkEnd.setDate(chunkEnd.getDate() + size - 1);
      const effectiveEnd = chunkEnd > endD ? endD : chunkEnd;
      const chunkStartISO = dashToISO(cursor);
      const chunkEndISO = dashToISO(effectiveEnd);
      out.push({
        start: chunkStartISO,
        end: chunkEndISO,
        label: dashShortDate(chunkStartISO),
        title: `${dashLongDate(chunkStartISO)} a ${dashLongDate(chunkEndISO)}`
      });
      cursor = new Date(effectiveEnd);
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  function dashPatrimonyAt(cutoff) {
    if (!cutoff) return 0;
    const banksAt = banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0);
    const pocketsAt = pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0);
    const investmentsAt = investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0);
    return banksAt + pocketsAt + investmentsAt;
  }

  function dashPatrimonyParts(cutoff) {
    return {
      banks: banks.reduce((sum, bank) => sum + balanceAtDate(bank.id, cutoff), 0),
      pockets: pockets.reduce((sum, pocket) => sum + pocketBalanceAtDate(pocket, cutoff), 0),
      investments: investments.reduce((sum, inv) => sum + investmentValueAtDate(inv, cutoff), 0)
    };
  }

  function dashPercentDelta(current, previous) {
    if (!dashFilters.compare) return null;
    if (!Number.isFinite(previous) || Math.abs(previous) < 0.005) return null;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
    if (Math.abs(rounded) > 999) return null;
    return {
      pct: rounded,
      up: rounded >= 0,
      text: `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1).replace('.', ',')}%`
    };
  }

  function dashMoneyDelta(current, previous) {
    if (!dashFilters.compare) return null;
    if (!Number.isFinite(previous)) return null;
    const diff = current - previous;
    if (Math.abs(diff) < 0.005) return null;
    return { pct: diff, up: diff >= 0, text: `${diff >= 0 ? '+' : ''}${fmt(diff)}` };
  }

  function dashCategoryRanking(currentRows, previousRows) {
    const current = new Map();
    const previous = new Map();
    let total = 0;

    for (const row of currentRows) {
      if (row.transfer || row.entry.type !== 'out') continue;
      const key = row.entry.category || '__none__';
      const value = Number(row.entry.amount || 0);
      current.set(key, (current.get(key) || 0) + value);
      total += value;
    }
    for (const row of previousRows) {
      if (row.transfer || row.entry.type !== 'out') continue;
      const key = row.entry.category || '__none__';
      previous.set(key, (previous.get(key) || 0) + Number(row.entry.amount || 0));
    }

    const rows = Array.from(current.entries())
      .map(([id, amount]) => {
        const category = id === '__none__' ? null : categories.find(item => item.id === id);
        const base = previous.get(id) || 0;
        let delta = null;
        if (dashFilters.compare) {
          if (base > 0) {
            const pct = ((amount - base) / base) * 100;
            delta = { up: pct >= 0, text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%` };
          } else if (amount > 0) {
            delta = { up: null, text: 'novo' };
          }
        }
        return {
          id,
          name: category ? category.name : 'Sem categoria',
          color: categoryColor(category),
          amount,
          share: total > 0 ? (amount / total) * 100 : 0,
          delta
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return { rows, total };
  }

  function dashBudgetRows() {
    const cycle = currentFinancialCycleKey();
    const rows = [];
    categories.forEach(category => {
      const budget = budgetFor(category.id);
      if (!budget || !(Number(budget.amount) > 0)) return;
      const planned = Number(budget.amount) || 0;
      const spent = budgetSpent(category.id, cycle);
      rows.push({
        id: category.id,
        name: category.name,
        planned,
        spent,
        rest: planned - spent,
        pct: planned > 0 ? (spent / planned) * 100 : 0
      });
    });
    return { cycle, rows: rows.sort((a, b) => b.pct - a.pct) };
  }

  function dashCardSummary() {
    const adapter = window.LivroCaixaCardAdapter;
    if (!adapter || typeof adapter.isReady !== 'function' || !adapter.isReady()) return null;
    try {
      return adapter.summarize({
        cards,
        purchases,
        invoiceLaunches,
        referenceDate: todayISO(),
        dueDateFor: typeof invoiceDueDateForPeriod === 'function' ? invoiceDueDateForPeriod : null
      });
    } catch (err) {
      logSyncError('dashboard · resumo de cartões', err);
      return null;
    }
  }

  /* Contas recorrentes pendentes com vencimento entre hoje e o horizonte. */
  function dashUpcomingBills(horizon) {
    const today = todayISO();
    const start = dashParseISO(today);
    const end = dashParseISO(horizon);
    const rows = [];
    if (!start || !end) return rows;

    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    let guard = 0;
    while (cursor <= end && guard < 6) {
      guard += 1;
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      recurringBills
        .filter(bill => billAppliesToMonth(bill, year, month))
        .forEach(bill => {
          if (billGeneratedForMonth(bill, key) || billPaidForMonth(bill, key)) return;
          const due = String(billDueDateForMonth(bill, year, month) || '').slice(0, 10);
          if (!due || due < today || due > horizon) return;
          rows.push({
            id: `bill_${bill.id}_${key}`,
            name: bill.name || 'Conta recorrente',
            amount: Number(bill.amount || 0),
            due
          });
        });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return rows.sort((a, b) => a.due.localeCompare(b.due));
  }

  /* Valor das contas recorrentes cujo vencimento cai dentro do período filtrado. */
  function dashFixedExpenses(range) {
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    if (!startD || !endD) return 0;

    const seen = new Set();
    let total = 0;
    let cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
    let guard = 0;
    while (cursor <= endD && guard < 36) {
      guard += 1;
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      recurringBills
        .filter(bill => billAppliesToMonth(bill, year, month))
        .forEach(bill => {
          const due = String(billDueDateForMonth(bill, year, month) || '').slice(0, 10);
          if (!due || due < range.start || due > range.end) return;
          const dedupeKey = `${bill.id}_${due}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          total += Number(bill.amount || 0);
        });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return total;
  }

  function dashObligations(cardSummary) {
    const today = todayISO();
    const horizon = dashShiftDays(today, 30);
    const bills = dashUpcomingBills(horizon);
    const invoices = (cardSummary && Array.isArray(cardSummary.dueDates) ? cardSummary.dueDates : [])
      .map(item => ({
        id: `card_${item.cardId}_${item.periodKey}`,
        name: `Fatura ${item.label || 'cartão'}`,
        amount: Number(item.amount || 0),
        due: String(item.dueDate || '').slice(0, 10)
      }))
      .filter(item => item.due);

    const all = bills.concat(invoices).sort((a, b) => a.due.localeCompare(b.due));
    const buckets = [
      { key: 'overdue', label: 'Vencidas', hint: 'vencidas até hoje', rows: [] },
      { key: 'today', label: 'Vencem hoje', hint: 'vencimento de hoje', rows: [] },
      { key: 'd7', label: 'Próximos 7 dias', hint: 'hoje + 7 dias', rows: [] },
      { key: 'd30', label: 'Próximos 30 dias', hint: 'hoje + 8 a 30 dias', rows: [] },
      { key: 'later', label: 'Após 30 dias', hint: 'faturas com vencimento mais distante', rows: [] }
    ];

    all.forEach(item => {
      let key = 'later';
      if (item.due < today) key = 'overdue';
      else if (item.due === today) key = 'today';
      else if (item.due <= dashShiftDays(today, 7)) key = 'd7';
      else if (item.due <= dashShiftDays(today, 30)) key = 'd30';
      buckets.find(bucket => bucket.key === key).rows.push(item);
    });

    const committedBills = bills.reduce((sum, item) => sum + item.amount, 0);
    return { buckets, committedBills, today, horizon, total: all.length };
  }

  function dashGoalRows() {
    return goals.map(goal => {
      const plan = goalPlanning(goal);
      const target = plan.target;
      const current = plan.current;
      const raw = plan.hasCurrent && target > 0 ? (current / target) * 100 : null;
      return {
        id: goal.id,
        name: goal.name || 'Meta',
        target,
        current,
        hasCurrent: plan.hasCurrent,
        raw,
        pct: raw == null ? 0 : Math.min(100, Math.max(0, raw)),
        overdue: plan.overdue,
        deadline: goal.deadline || null
      };
    });
  }

  function dashHealthMetric(label, value, tone, detail, base, icon) {
    return { label, value, tone, detail: detail || '', base: base || null, icon: icon || '' };
  }

  function dashHealthRows(range, flow, fixedExpenses, patrimony, patrimonyStart, committed) {
    const rows = [];
    const startD = dashParseISO(range.start);
    const endD = dashParseISO(range.end);
    const days = startD && endD ? Math.max(1, Math.round((endD - startD) / 86400000) + 1) : 0;
    const monthlyExpense = days > 0 ? flow.expense / (days / DASH_DAYS_PER_MONTH) : 0;

    rows.push(dashHealthMetric(
      'Taxa de poupança',
      flow.income > 0 ? `${((flow.net / flow.income) * 100).toFixed(1).replace('.', ',')}%` : '—',
      flow.income > 0 && flow.net >= 0 ? 'positive' : flow.income > 0 ? 'negative' : 'neutral',
      'Resultado dividido pelas entradas do período',
      flow.income > 0 ? { label: 'resultado / entradas', value: `${fmt(flow.net)} / ${fmt(flow.income)}` } : null,
      '％'
    ));

    rows.push(dashHealthMetric(
      'Despesas fixas / entradas',
      flow.income > 0 ? `${((fixedExpenses / flow.income) * 100).toFixed(1).replace('.', ',')}%` : '—',
      flow.income > 0 && fixedExpenses / flow.income <= 0.5 ? 'positive' : flow.income > 0 ? 'negative' : 'neutral',
      'Contas recorrentes com vencimento no período',
      { label: 'despesas fixas no período', value: fmt(fixedExpenses) },
      '⟳'
    ));

    rows.push(dashHealthMetric(
      'Comprometimento financeiro',
      patrimony > 0 ? `${((committed / patrimony) * 100).toFixed(1).replace('.', ',')}%` : '—',
      patrimony > 0 && committed / patrimony <= 0.3 ? 'positive' : patrimony > 0 ? 'negative' : 'neutral',
      'Cartões mais contas dos próximos 30 dias sobre o patrimônio',
      { label: 'comprometido', value: fmt(committed) },
      '∑'
    ));

    const growth = patrimonyStart > 0 ? ((patrimony - patrimonyStart) / patrimonyStart) * 100 : null;
    rows.push(dashHealthMetric(
      'Crescimento patrimonial',
      growth == null ? '—' : `${growth >= 0 ? '+' : ''}${growth.toFixed(1).replace('.', ',')}%`,
      growth == null ? 'neutral' : growth >= 0 ? 'positive' : 'negative',
      'Variação do patrimônio entre o início e o fim do período',
      growth == null ? null : { label: 'variação no período', value: fmt(patrimony - patrimonyStart) },
      growth != null && growth < 0 ? '↘' : '↗'
    ));

    rows.push(dashHealthMetric(
      'Reserva financeira',
      monthlyExpense > 0 ? `${(patrimony > 0 ? Math.min(999, patrimony / monthlyExpense) : 0).toFixed(1).replace('.', ',')} meses` : '—',
      monthlyExpense > 0 && patrimony / monthlyExpense >= 3 ? 'positive' : monthlyExpense > 0 ? 'negative' : 'neutral',
      'Patrimônio dividido pela média mensal de saídas do período',
      monthlyExpense > 0 ? { label: 'saída média mensal', value: fmt(monthlyExpense) } : null,
      '🛡'
    ));

    return rows;
  }

  function dashHistoryAvailable(range) {
    const start = range.start;
    if (!start) return false;
    return entries.some(entry => String(entry.date || '') <= start)
      || yieldsLog.some(item => String(item.dateEnd || item.date || '') <= start);
  }

  /* ===== Score de saúde (0-100) e análises derivadas ===== */

  function dashClampPct(value, target) {
    if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return null;
    return Math.max(0, Math.min(100, (value / target) * 100));
  }

  /* Nota final = média simples dos componentes disponíveis.
     Componentes ausentes (sem entrada, sem patrimônio) são ignorados,
     não pontuados como zero — dado incompleto não pune o usuário. */
  function dashFinanceScore(parts) {
    const valid = (parts || []).filter(value => Number.isFinite(value));
    if (!valid.length) return null;
    const score = Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
    return {
      value: score,
      label: score >= 70 ? 'Saudável' : score >= 40 ? 'Regular' : 'Atenção',
      tone: score >= 70 ? 'positive' : score >= 40 ? 'neutral' : 'warning',
      components: valid.length
    };
  }

  function dashScoreComponents(flow, fixedExpenses, committed, patrimony, patrimonyStart, overdueCount) {
    const parts = [];
    if (flow && flow.income > 0) {
      // Poupança: 20% das entradas já é nota máxima.
      parts.push(dashClampPct((flow.net / flow.income) * 100, 20));
      if (Number.isFinite(fixedExpenses)) {
        // Despesas fixas: 0% = nota máxima; 60%+ das entradas = zero.
        parts.push(dashClampPct(60 - (fixedExpenses / flow.income) * 100, 60));
      }
    }
    if (Number.isFinite(committed) && patrimony > 0) {
      // Comprometimento (cartões+contas/30d): 0% = nota máxima; 50%+ = zero.
      parts.push(dashClampPct(50 - (committed / patrimony) * 100, 50));
    }
    if (Number.isFinite(patrimonyStart) && patrimonyStart > 0 && patrimony > 0) {
      // Evolução do patrimônio no período: -10% = zero; +10% = nota máxima.
      const growth = ((patrimony - patrimonyStart) / patrimonyStart) * 100;
      parts.push(dashClampPct(growth + 10, 20));
    }
    if (Number.isFinite(overdueCount)) {
      // Atrasados: nenhum vencido = nota máxima; cada vencido remove 30 pontos.
      parts.push(Math.max(0, 100 - overdueCount * 30));
    }
    return parts;
  }

  /* Estimativa do saldo de contas no fim do mês corrente: saldo atual +
     ritmo líquido médio já registrado no mês × dias restantes.
     Considera apenas movimentações com conta bancária (as que alteram o
     saldo exibido) e ignora transferências entre contas. */
  function dashEndOfMonthProjection(balance) {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const day = now.getDate();
    const remaining = daysInMonth - day;
    if (remaining < 1 || day < 2 || !Number.isFinite(balance)) return null;
    const scope = dashBuildScope({
      start: dashToISO(new Date(year, monthIndex, 1)),
      end: dashToISO(now)
    });
    let net = 0;
    for (const row of scope) {
      if (row.transfer || !row.entry.bank) continue;
      const value = Number(row.entry.amount || 0);
      net += row.entry.type === 'in' ? value : -value;
    }
    const avgDaily = net / day;
    return {
      value: balance + avgDaily * remaining,
      remaining,
      avgDaily,
      day,
      daysInMonth
    };
  }

  /* Comparativo do mês corrente com o mês anterior (sempre, independente
     do filtro de período do dashboard). Respeta o filtro de conta. */
  function dashMonthComparison() {
    const now = new Date();
    const year = now.getFullYear();
    const monthIndex = now.getMonth();
    const prevDate = new Date(year, monthIndex - 1, 1);
    const currentRange = { start: dashToISO(new Date(year, monthIndex, 1)), end: dashToISO(new Date(year, monthIndex + 1, 0)) };
    const previousRange = { start: dashToISO(prevDate), end: dashToISO(new Date(year, monthIndex, 0)) };
    const currentScope = dashBuildScope(currentRange);
    const previousScope = dashBuildScope(previousRange);
    const current = dashFlowOf(currentScope);
    const previous = dashFlowOf(previousScope);
    const pctChange = (a, b) => {
      if (!Number.isFinite(b) || Math.abs(b) < 0.005) return null;
      return ((a - b) / Math.abs(b)) * 100;
    };
    const outByCategory = scope => {
      const map = new Map();
      for (const row of scope) {
        if (row.transfer || row.entry.type !== 'out') continue;
        const key = row.entry.category || '__none__';
        map.set(key, (map.get(key) || 0) + Number(row.entry.amount || 0));
      }
      return map;
    };
    const currentOut = outByCategory(currentScope);
    const previousOut = outByCategory(previousScope);
    let topCategory = null;
    for (const [id, amount] of currentOut.entries()) {
      const base = previousOut.get(id) || 0;
      const delta = amount - base;
      if (!topCategory || Math.abs(delta) > Math.abs(topCategory.delta)) {
        const category = id === '__none__' ? null : categories.find(item => item.id === id);
        topCategory = { name: category ? category.name : 'Sem categoria', delta, amount, base };
      }
    }
    return {
      currentLabel: formatMonthLabel(`${year}-${String(monthIndex + 1).padStart(2, '0')}`),
      previousLabel: formatMonthLabel(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`),
      current,
      previous,
      incomePct: pctChange(current.income, previous.income),
      expensePct: pctChange(current.expense, previous.expense),
      resultPct: pctChange(current.net, previous.net),
      topCategory,
      day: now.getDate(),
      daysInMonth: new Date(year, monthIndex + 1, 0).getDate(),
      hasData: current.count > 0 || previous.count > 0
    };
  }

  function buildDashboardSummary() {
    const preset = dashPreset();
    const range = dashRange(false);
    const previousRange = dashRange(true);
    const hasAccount = Boolean(dashFilters.account);
    const bank = hasAccount ? banks.find(item => item.id === dashFilters.account) : null;
    if (hasAccount && !bank) dashFilters.account = '';

    const scope = dashBuildScope(range);
    const flow = dashFlowOf(scope);
    const previousScope = dashFilters.compare ? dashBuildScope(previousRange) : [];
    const previousFlow = dashFilters.compare ? dashFlowOf(previousScope) : { income: 0, expense: 0, net: 0, transfers: 0, count: 0 };

    const buckets = dashBuckets(range);
    const bucketRows = buckets.map(bucket => {
      const slice = scope.filter(row => row.entry.date >= bucket.start && row.entry.date <= bucket.end);
      const bucketFlow = dashFlowOf(slice);
      return {
        start: bucket.start,
        end: bucket.end,
        label: bucket.label,
        title: bucket.title,
        income: bucketFlow.income,
        expense: bucketFlow.expense,
        net: bucketFlow.net,
        patrimony: dashPatrimonyAt(bucket.end)
      };
    });

    const today = todayISO();
    const patrimony = dashPatrimonyAt(today);
    const patrimonyParts = dashPatrimonyParts(today);
    const patrimonyStart = dashPatrimonyAt(range.start);
    const balanceAvailable = dashFilters.account ? bankBalance(dashFilters.account) : totalBankBalance();
    const cardSummary = dashCardSummary();
    const obligations = dashObligations(cardSummary);
    const committedCards = cardSummary ? Number(cardSummary.committed || 0) : 0;
    const committed = committedCards + obligations.committedBills;
    const fixedExpenses = dashFixedExpenses(range);
    const categoriesSummary = dashCategoryRanking(scope, previousScope);
    const budgetsSummary = dashBudgetRows();
    const historyAvailable = dashHistoryAvailable(range);
    const overdueBucket = (obligations.buckets || []).find(bucket => bucket.key === 'overdue');
    const overdueCount = overdueBucket && Array.isArray(overdueBucket.rows) ? overdueBucket.rows.length : 0;
    const score = dashFinanceScore(dashScoreComponents(flow, fixedExpenses, committed, patrimony, patrimonyStart, overdueCount));
    const projectionEOM = dashEndOfMonthProjection(balanceAvailable);
    const monthComparison = dashMonthComparison();

    return {
      schemaVersion: DASH_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      period: {
        key: dashFilters.period,
        label: preset.label,
        bucket: preset.bucket,
        start: range.start,
        end: range.end,
        text: dashFormatRange(range),
        previous: dashFilters.compare ? previousRange : null,
        previousText: dashFilters.compare ? dashFormatRange(previousRange) : '',
        entries: scope.length
      },
      account: {
        id: dashFilters.account,
        label: dashFilters.account && bank ? bank.name : 'Todas as contas'
      },
      compare: dashFilters.compare,
      income: flow.income,
      expense: flow.expense,
      result: flow.net,
      previous: dashFilters.compare
        ? { income: previousFlow.income, expense: previousFlow.expense, result: previousFlow.net }
        : null,
      balanceAvailable,
      patrimony: {
        current: patrimony,
        atStart: patrimonyStart,
        delta: patrimony - patrimonyStart,
        hasHistory: historyAvailable,
        parts: patrimonyParts
      },
      flow: {
        buckets: bucketRows,
        transfers: flow.transfers,
        count: flow.count
      },
      committed: {
        total: committed,
        cards: committedCards,
        bills: obligations.committedBills,
        horizon: obligations.horizon
      },
      categories: categoriesSummary,
      budgets: budgetsSummary,
      obligations,
      cards: cardSummary,
      fixedExpenses,
      goals: dashGoalRows(),
      health: dashHealthRows(range, flow, fixedExpenses, patrimony, patrimonyStart, committed),
      score,
      projectionEOM,
      monthComparison,
      insights: getDashboardAlerts()
    };
  }

  function dashDeltaHTML(delta) {
    if (!delta) return '';
    return `<span class="dash-delta ${delta.up ? 'up' : 'down'}">${escapeHTML(delta.text)}</span>`;
  }

  function dashSectionHead(index, title, subtitle, meta) {
    return `<div class="dash-section-head"><div><span class="dash-section-index">${escapeHTML(index)}</span><h3>${escapeHTML(title)}</h3><p>${escapeHTML(subtitle)}</p></div>${meta ? `<span class="dash-section-meta">${meta}</span>` : ''}</div>`;
  }

  function renderDashSummary(s) {
    const kpi = (label, value, cls, note, delta, isMain = false) => `
      <div class="dash-kpi ${isMain ? 'dash-kpi-main' : ''}">
        <small>${escapeHTML(label)}</small>
        <strong class="js-money ${cls || ''}">${value}</strong>
        ${delta || ''}
        ${note ? `<span class="dash-kpi-note">${note}</span>` : ''}
      </div>`;

    const incomeDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.income, s.previous.income)) : '';
    const expenseDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.expense, s.previous.expense)) : '';
    const resultDelta = s.previous ? dashDeltaHTML(dashPercentDelta(s.result, s.previous.result)) : '';
    const patrimonyDelta = dashMoneyDelta(s.patrimony.current, s.patrimony.atStart);

    return `
      <section class="dash-section" aria-labelledby="dashSec1">
        ${dashSectionHead('01', 'Resumo', `Movimentação e posição em ${s.period.text}.`, escapeHTML(s.account.label))}
        <div class="dash-kpis">
          ${kpi('Entradas', fmt(s.income), 'positive', s.previous && s.previous.income > 0 ? 'vs. ' + escapeHTML(fmt(s.previous.income)) + ' no período anterior' : '', incomeDelta, true)}
          ${kpi('Saídas', fmt(s.expense), 'negative', s.previous && s.previous.expense > 0 ? 'vs. ' + escapeHTML(fmt(s.previous.expense)) + ' no período anterior' : '', expenseDelta, true)}
          ${kpi('Resultado', fmt(s.result), s.result >= 0 ? 'positive' : 'negative', s.previous ? 'vs. ' + escapeHTML(fmt(s.previous.result)) + ' no período anterior' : '', resultDelta, true)}
          ${kpi('Saldo disponível', fmt(s.balanceAvailable), '', 'Contas bancárias' + (s.account.id ? ' do filtro' : ''), '', true)}
          ${kpi('Patrimônio', fmt(s.patrimony.current), '', 'Bancos + caixinhas + investimentos', patrimonyDelta ? `<span class="dash-delta ${patrimonyDelta.up ? 'up' : 'down'}">${escapeHTML(patrimonyDelta.text)} no período</span>` : '')}
          ${kpi('Comprometido', fmt(s.committed.total), 'negative', 'Cartões + contas dos próximos 30 dias', '')}
          ${s.projectionEOM ? kpi('Projeção fim de mês', fmt(s.projectionEOM.value), s.projectionEOM.value >= s.balanceAvailable ? 'positive' : 'negative', `Saldo atual + ritmo médio registrado · ${s.projectionEOM.remaining} dia(s) até o fim do mês`, '', true) : ''}
        </div>
        ${s.flow.transfers ? `<p class="dash-inline-note">${s.flow.transfers} transferência(s) entre contas não contam como entrada/saída.</p>` : ''}
      </section>`;
  }

  let dashFlowChartInstance;

  /* Comparativo do mês corrente com o mês anterior de calendário.
     Sempre calculado (independe do toggle de comparação do período). */
  function renderDashComparison(s) {
    const cmp = s.monthComparison;
    if (!cmp || !cmp.hasData) return '';

    const sentences = [];
    if (Number.isFinite(cmp.expensePct)) {
      const dir = cmp.expensePct >= 0 ? 'a mais' : 'a menos';
      sentences.push(`Você gastou ${Math.abs(cmp.expensePct).toFixed(1).replace('.', ',')}% ${dir} que em ${cmp.previousLabel}.`);
    } else if (cmp.current.expense > 0 && cmp.previous.expense === 0) {
      sentences.push(`Saídas iniciadas neste mês (${escapeHTML(fmt(cmp.current.expense))}), sem base em ${escapeHTML(cmp.previousLabel)}.`);
    } else if (cmp.previous.expense > 0 && cmp.current.expense === 0) {
      sentences.push(`Você não registrou saídas em ${escapeHTML(cmp.currentLabel)}, após ${escapeHTML(fmt(cmp.previous.expense))} em ${escapeHTML(cmp.previousLabel)}.`);
    }
    if (Number.isFinite(cmp.incomePct)) {
      sentences.push(`Suas entradas ${cmp.incomePct >= 0 ? 'aumentaram' : 'caíram'} ${Math.abs(cmp.incomePct).toFixed(1).replace('.', ',')}%.`);
    }
    if (!sentences.length) {
      sentences.push(`Movimentação registrada: ${escapeHTML(fmt(cmp.current.income))} em entradas e ${escapeHTML(fmt(cmp.current.expense))} em saídas este mês.`);
    }

    const metric = (label, icon, current, previous, pct, tone) => `
      <div class="dash-metric">
        <div class="dash-metric-icon ${tone}" aria-hidden="true">${icon}</div>
        <div class="dash-metric-content">
          <small>${escapeHTML(label)}</small>
          <strong class="dash-metric-value ${tone}">${fmt(current)}</strong>
          <span class="dash-metric-note">${Number.isFinite(pct)
            ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}% vs. ${escapeHTML(fmt(previous))} em ${escapeHTML(cmp.previousLabel)}`
            : `Em ${escapeHTML(cmp.previousLabel)}: ${escapeHTML(fmt(previous))}`}</span>
        </div>
      </div>`;

    const topCategoryNote = cmp.topCategory && cmp.previous.expense > 0 && Math.abs(cmp.topCategory.delta) >= 0.005
      ? `<p class="dash-inline-note">Maior variação de saídas: <b>${escapeHTML(cmp.topCategory.name)}</b> — ${cmp.topCategory.delta > 0 ? '+' : '−'}${escapeHTML(fmt(Math.abs(cmp.topCategory.delta)))} frente a ${escapeHTML(cmp.previousLabel)}.</p>`
      : '';

    return `
      <section class="dash-section" aria-label="Comparativo mês a mês">
        ${dashSectionHead('07', 'Comparativo mês a mês', `${cmp.currentLabel} frente a ${cmp.previousLabel}.`, `dia ${cmp.day}/${cmp.daysInMonth}`)}
        <div class="dash-panel">
          <p class="dash-inline-note">${sentences.join(' ')}</p>
          <div class="dash-metrics">
            ${metric('Entradas', '↗', cmp.current.income, cmp.previous.income, cmp.incomePct, Number.isFinite(cmp.incomePct) ? (cmp.incomePct >= 0 ? 'positive' : 'negative') : 'neutral')}
            ${metric('Saídas', '↘', cmp.current.expense, cmp.previous.expense, cmp.expensePct, Number.isFinite(cmp.expensePct) ? (cmp.expensePct <= 0 ? 'positive' : 'negative') : 'neutral')}
            ${metric('Resultado', '=', cmp.current.net, cmp.previous.net, cmp.resultPct, cmp.current.net >= 0 ? 'positive' : 'negative')}
          </div>
          ${topCategoryNote}
        </div>
      </section>`;
  }


  function renderDashFlow(s) {
    const rows = s.flow.buckets;
    if (!rows.length) {
      return `
        <section class="dash-section" aria-labelledby="dashSec2">
          ${dashSectionHead('02', 'Fluxo de caixa', 'Entradas, saídas e patrimônio por período.', '')}
          <div class="dashboard-empty-state">Selecione um período válido para visualizar o fluxo de caixa.</div>
        </section>`;
    }

    return `
      <section class="dash-section" aria-labelledby="dashSec2">
        ${dashSectionHead('02', 'Fluxo de caixa', 'Entradas, saídas e patrimônio por período.', `${rows.length} bloco(s)`)}
        <div class="dash-panel dash-flow-panel">
          <div class="dash-chart-box" id="dashFlowChartBox">
            <canvas id="dashFlowChart" role="img" aria-label="Gráfico de entradas, saídas e patrimônio por período"></canvas>
          </div>
          <div class="dash-chart-fallback" id="dashFlowFallback" hidden></div>
          <p class="dashboard-footnote">Barras no eixo esquerdo: entradas e saídas do período. Linha no eixo direito: patrimônio estimado. O patrimônio histórico é uma estimativa quando não existe cotação registrada para cada data; ele não altera seus saldos atuais.</p>
        </div>
      </section>`;
  }

  /* Versão em HTML do fluxo: usada apenas quando Chart.js não está disponível. */
  function dashFlowFallbackHTML(rows) {
    const maxFlow = Math.max(1, ...rows.flatMap(item => [item.income, item.expense]));
    const body = rows.map(item => {
      const incomePct = item.income > 0 ? Math.max(4, (item.income / maxFlow) * 100) : 0;
      const expensePct = item.expense > 0 ? Math.max(4, (item.expense / maxFlow) * 100) : 0;
      return `
        <div class="monthly-flow-row">
          <div class="monthly-flow-label"><strong>${escapeHTML(item.label)}</strong><span>Fluxo ${item.net >= 0 ? '+' : ''}${fmt(item.net)}</span></div>
          <div class="monthly-flow-bars">
            <div class="flow-bar-line"><span>Entradas</span><div class="flow-track"><i class="income" style="width:${Math.min(100, incomePct).toFixed(2)}%"></i></div><b class="js-money">${fmt(item.income)}</b></div>
            <div class="flow-bar-line"><span>Saídas</span><div class="flow-track"><i class="expense" style="width:${Math.min(100, expensePct).toFixed(2)}%"></i></div><b class="js-money">${fmt(item.expense)}</b></div>
          </div>
          <div class="monthly-patrimony"><small>Patrimônio estimado</small><strong class="js-money">${fmt(item.patrimony)}</strong></div>
        </div>`;
    }).join('');

    return `<div class="dashboard-explainer"><span class="legend-dot income"></span> Entradas <span class="legend-dot expense"></span> Saídas <span class="legend-dot patrimony"></span> Patrimônio estimado</div><div class="monthly-flow-chart">${body}</div>`;
  }

  function dashDestroyFlowChart() {
    if (!dashFlowChartInstance) return;
    try {
      dashFlowChartInstance.destroy();
    } catch (err) {
      /* canvas já removido do DOM */
    }
    dashFlowChartInstance = null;
  }

  function dashRenderFlowChart(s) {
    const rows = s.flow.buckets;
    if (!rows.length) return;

    const canvas = document.getElementById('dashFlowChart');
    const box = document.getElementById('dashFlowChartBox');
    const fallback = document.getElementById('dashFlowFallback');

    if (!canvas || typeof Chart === 'undefined') {
      if (box) box.hidden = true;
      if (fallback) {
        fallback.hidden = false;
        fallback.innerHTML = dashFlowFallbackHTML(rows);
      }
      return;
    }

    if (fallback) fallback.hidden = true;
    if (box) box.hidden = false;

    const { ink, inkSoft, lineColor, green, red, gold, masked, money, tick } = dashChartTheme();

    dashFlowChartInstance = new Chart(canvas, {
      type: 'bar',
      plugins: [dashLegendDividerPlugin(lineColor)],
      data: {
        labels: rows.map(item => item.label),
        datasets: [
          {
            label: 'Entradas',
            data: rows.map(item => item.income),
            backgroundColor: green,
            borderRadius: 4,
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Saídas',
            data: rows.map(item => item.expense),
            backgroundColor: red,
            borderRadius: 4,
            maxBarThickness: 26,
            yAxisID: 'y',
            order: 2
          },
          {
            label: 'Patrimônio estimado',
            data: rows.map(item => item.patrimony),
            type: 'line',
            borderColor: gold,
            backgroundColor: gold,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: rows.length > 31 ? 0 : 2,
            pointHoverRadius: 4,
            yAxisID: 'y1',
            order: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              color: inkSoft,
              boxWidth: 12,
              padding: 12
            }
          },
          tooltip: {
            callbacks: {
              title: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                return rows[index] ? rows[index].title : '';
              },
              label: context => ` ${context.dataset.label}: ${money(context.parsed.y)}`,
              afterBody: items => {
                const index = items && items.length ? items[0].dataIndex : -1;
                const row = rows[index];
                return row ? `Resultado: ${money(row.net)}` : '';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: ink, font: { size: 10, weight: '600' }, maxRotation: 0, autoSkip: true }
          },
          y: {
            position: 'left',
            beginAtZero: true,
            grid: { color: lineColor },
            ticks: { color: inkSoft, font: { size: 10 }, callback: tick }
          },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: gold, font: { size: 10 }, callback: tick }
          }
        }
      }
    });
  }

  function renderDashSpending(s) {
    const categoriesHTML = s.categories.rows.length
      ? s.categories.rows.map(row => `
        <div class="dash-cat-row">
          <span class="dash-cat-dot" style="background:${escapeHTML(row.color)}" aria-hidden="true"></span>
          <div class="dash-cat-copy">
            <strong>${escapeHTML(row.name)}</strong>
            <span>${row.share.toFixed(1).replace('.', ',')}% do total do período</span>
          </div>
          <div class="dash-cat-value">
            <b class="js-money">${fmt(row.amount)}</b>
            ${row.delta ? `<span class="dash-delta ${row.delta.up == null ? 'muted' : row.delta.up ? 'up' : 'down'}">${escapeHTML(row.delta.text)}</span>` : ''}
          </div>
        </div>`).join('')
      : `<div class="dashboard-empty-state">Nenhuma saída registrada${s.account.id ? ' para a conta selecionada' : ''} neste período.</div>`;

    const budgetsHTML = s.budgets.rows.length
      ? s.budgets.rows.map(row => {
        const over = row.pct >= 100;
        let statusLabel = '';
        let statusClass = '';
        if (row.pct >= 100) { statusLabel = 'Excedido'; statusClass = 'excedido'; }
        else if (row.pct >= 80) { statusLabel = 'Atenção'; statusClass = 'atencao'; }
        else { statusLabel = 'Normal'; statusClass = 'normal'; }
        return `
        <div class="budget-summary-row">
          <div><strong>${escapeHTML(row.name)}</strong><span class="js-money">${fmt(row.spent)} de ${fmt(row.planned)}</span></div>
          <div class="budget-summary-track"><span class="${over ? 'over' : ''}" style="width:${Math.min(100, Math.max(0, row.pct)).toFixed(2)}%"></span></div>
          <b>${row.pct.toFixed(0).replace('.', ',')}%</b>
          <span class="budget-status ${statusClass}">${statusLabel}</span>
        </div>`;
      }).join('')
      : `<div class="dashboard-empty-state">Nenhum orçamento ativo no ciclo atual. Defina limites em Perfil → Preferências financeiras.</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec3">
        ${dashSectionHead('03', 'Gastos e orçamento', 'Para onde o dinheiro saiu e o que já está planejado.', `Ciclo ${escapeHTML(s.budgets.cycle)}`)}
        <div class="dash-two-col">
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Categorias</strong><span class="js-money">${fmt(s.categories.total)}</span></div>
            ${categoriesHTML}
          </div>
          <div class="dash-panel dash-budgets">
            <div class="dash-panel-head"><strong>Orçamento do ciclo</strong><span>não segue o filtro de período</span></div>
            ${budgetsHTML}
          </div>
        </div>
      </section>`;
  }

  function renderDashCommitments(s) {
    const cards = s.cards;
    const cardLine = (tone, label, note, value) => `
      <div class="dash-card-line${tone ? ` tone-${tone}` : ''}">
        <div><strong>${escapeHTML(label)}</strong><span>${note}</span></div>
        <b class="js-money">${fmt(value)}</b>
      </div>`;

    const perCard = cards && cards.count > 1
      ? `<div class="dash-card-list">${cards.cards.map(row => cardLine(row.committed > 0 ? 'warn' : '', row.name, `referência ${escapeHTML(row.referencePeriod || '—')}`, row.committed)).join('')}</div>`
      : '';

    let cardsPanel;
    if (cards && cards.ready) {
      const limitPct = cards.totalLimit > 0 ? (cards.totalUsed / cards.totalLimit) * 100 : 0;
      const currentTone = cards.currentInvoiceRemaining > 0 ? 'warn' : '';
      const previousTone = cards.previousInvoiceRemaining > 0 ? 'critical' : '';
      const limitTone = limitPct >= 100 ? 'critical' : limitPct >= 80 ? 'warn' : '';
      const committedTone = cards.committed > 0 ? 'warn' : '';

      cardsPanel = `
        <div class="dash-panel">
          <div class="dash-panel-head"><strong>Cartões</strong><span>${cards.count} ativo(s)</span></div>
          ${cards.count ? `
            ${cardLine(currentTone, 'Fatura atual', `de ${escapeHTML(fmt(cards.currentInvoiceTotal))}`, cards.currentInvoiceRemaining)}
            ${cards.previousInvoiceRemaining > 0 ? cardLine(previousTone, 'Fatura anterior pendente', 'vencimento já ocorrido ou próximo', cards.previousInvoiceRemaining) : ''}
            ${cardLine('', 'Próxima fatura', `de ${escapeHTML(fmt(cards.nextInvoiceTotal))}`, cards.nextInvoiceRemaining)}
            ${cardLine(limitTone, 'Limite utilizado', `de ${escapeHTML(fmt(cards.totalLimit))}${limitPct > 0 ? ` · ${limitPct.toFixed(0)}%` : ''}`, cards.totalUsed)}
            ${cardLine('', 'Parcelas futuras', 'fora da fatura atual', cards.futureInstallmentsRemaining)}
            ${cardLine(committedTone, 'Comprometido (motor)', 'fonte: card-engine-v3', cards.committed)}
            ${perCard}
          ` : '<div class="dashboard-empty-state">Nenhum cartão ativo cadastrado.</div>'}
        </div>`;
    } else {
      cardsPanel = `<div class="dash-panel"><div class="dash-panel-head"><strong>Cartões</strong><span>indisponível</span></div><div class="dashboard-empty-state">Motor de cartões não carregado neste momento.</div></div>`;
    }

    const visibleBuckets = s.obligations.buckets
      .filter(bucket => bucket.key !== 'later')
      .filter(bucket => bucket.rows.length);
    const visibleTotal = visibleBuckets.reduce((sum, bucket) => sum + bucket.rows.length, 0);

    const allBucketRows = visibleBuckets
      .map(bucket => `
        <div class="dash-bucket">
          <div class="dash-bucket-head"><strong>${escapeHTML(bucket.label)}</strong><span class="dash-bucket-count">${bucket.rows.length}</span></div>
          ${bucket.rows.map(item => `
            <div class="dash-bucket-row ${bucket.key === 'overdue' ? 'overdue' : ''}">
              <div><strong>${escapeHTML(item.name)}</strong><span>${dashLongDate(item.due)}</span></div>
              <b class="js-money">${fmt(item.amount)}</b>
            </div>`).join('')}
        </div>`).join('')
      || '';

    const summaryRows = visibleBuckets
      .map(bucket => `
        <div class="dash-bucket-summary">
          <span>${escapeHTML(bucket.label)}</span>
          <span class="dash-bucket-count">${bucket.rows.length}</span>
          <b class="js-money">${fmt(bucket.rows.reduce((sum, r) => sum + r.amount, 0))}</b>
        </div>`).join('')
      || `<div class="dashboard-empty-state">Nenhuma conta ou fatura pendente nos próximos 30 dias.</div>`;

    const commitmentsContent = dashCommitmentsExpanded
      ? `<div class="dash-buckets-expanded">${allBucketRows}</div>`
      : `<div class="dash-buckets-summary">${summaryRows}</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec4">
        ${dashSectionHead('04', 'Compromissos', `Vencimentos a partir de hoje (${dashLongDate(s.obligations.today)}).`, visibleTotal ? `${visibleTotal} compromisso(s)` : 'tudo em dia')}
        <div class="dash-two-col">
          ${cardsPanel}
          <div class="dash-panel">
            <div class="dash-panel-head">
              <strong>Contas e faturas por vencimento</strong>
              <span class="js-money">${fmt(s.committed.total)} comprometido</span>
            </div>
            <button type="button" class="dash-expand-btn" onclick="toggleDashCommitments()" aria-expanded="${dashCommitmentsExpanded}" aria-controls="dashCommitmentsContent">
              <i class="fi fi-rr-angle-${dashCommitmentsExpanded ? 'up' : 'down'}-small" aria-hidden="true"></i>
              <span>${dashCommitmentsExpanded ? 'Recolher' : 'Expandir'}</span>
            </button>
            <div id="dashCommitmentsContent" class="dash-commitments-content">
              ${commitmentsContent}
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderDashPatrimony(s) {
    const parts = s.patrimony.parts;
    const totalParts = parts.banks + parts.pockets + parts.investments;
    const partRow = (label, value, share, color) => `
      <div class="dash-part-row">
        <div class="dash-part-copy"><strong>${escapeHTML(label)}</strong><span>${share.toFixed(1).replace('.', ',')}% do patrimônio</span></div>
        <div class="dash-part-mini-bar" style="--share:${Math.min(100, Math.max(0, share)).toFixed(2)}%;--bar-color:${color}"></div>
        <div class="dash-part-value js-money">${fmt(value)}</div>
      </div>`;

    const share = value => (totalParts > 0 ? (value / totalParts) * 100 : 0);

    const goalsHTML = s.goals.length
      ? s.goals.map(goal => `
        <div class="dash-goal-row">
          <div class="dash-goal-info">
            <strong>${escapeHTML(goal.name)}${goal.deadline ? ' · até ' + dashLongDate(goal.deadline) : ''}</strong>
            <span>${goal.hasCurrent ? fmt(goal.current) : '—'} de ${fmt(goal.target)}</span>
          </div>
          <div class="dash-goal-progress">
            <div class="dash-goal-bar" style="--pct:${goal.pct.toFixed(2)}%;--bar-color:${goal.pct >= 100 ? 'var(--green)' : 'var(--accent)'}"></div>
            <span class="dash-goal-pct">${goal.hasCurrent ? goal.pct.toFixed(0).replace('.', ',') + '%' : 'sem origem'}</span>
          </div>
        </div>`).join('')
      : `<div class="dashboard-empty-state">Nenhuma meta cadastrada. Crie metas na aba Metas para acompanhar o progresso aqui.</div>`;

    const evolution = s.patrimony.hasHistory
      ? `
        <div class="dash-evolution-grid">
          <div class="dash-evo-item">
            <small>No início do período</small>
            <strong class="js-money">${fmt(s.patrimony.atStart)}</strong>
          </div>
          <div class="dash-evo-item">
            <small>Hoje</small>
            <strong class="js-money">${fmt(s.patrimony.current)}</strong>
          </div>
          <div class="dash-evo-item dash-evo-delta ${s.patrimony.delta >= 0 ? 'positive' : 'negative'}">
            <small>Variação</small>
            <strong class="js-money ${s.patrimony.delta >= 0 ? 'positive' : 'negative'}">${fmt(s.patrimony.delta)}</strong>
          </div>
        </div>`
      : `<div class="dashboard-empty-state">Histórico insuficiente para comparar a evolução do patrimônio neste período. Registre movimentações anteriores a ${dashLongDate(s.period.start)}.</div>`;

    return `
      <section class="dash-section" aria-labelledby="dashSec5">
        ${dashSectionHead('05', 'Patrimônio e metas', 'Composição do patrimônio, evolução e progresso das metas.', '')}
        <div class="dash-two-col">
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Composição atual</strong><span class="js-money">${fmt(totalParts)}</span></div>
            ${partRow('Bancos', parts.banks, share(parts.banks), '#3E9B6E')}
            ${partRow('Caixinhas', parts.pockets, share(parts.pockets), '#B08D3E')}
            ${partRow('Investimentos', parts.investments, share(parts.investments), '#327957')}
            ${evolution}
          </div>
          <div class="dash-panel">
            <div class="dash-panel-head"><strong>Metas</strong><span>${s.goals.length} cadastrada(s)</span></div>
            ${goalsHTML}
          </div>
        </div>
      </section>`;
  }

  function renderDashHealth(s) {
    const rows = s.health.map(metric => `
      <div class="dash-metric">
        <div class="dash-metric-icon ${metric.tone}" aria-hidden="true">${metric.icon || ''}</div>
        <div class="dash-metric-content">
          <small>${escapeHTML(metric.label)}</small>
          <strong class="dash-metric-value ${metric.tone}">${escapeHTML(metric.value)}</strong>
          <span class="dash-metric-note">${escapeHTML(metric.detail)}</span>
          ${metric.base ? `<span class="dash-metric-base js-money">${escapeHTML(metric.base.value)}</span>` : ''}
        </div>
      </div>`).join('');

    const score = s.score
      ? `<div class="dashboard-health-card ${s.score.tone}"><span class="dashboard-health-icon">${s.score.value}</span><div><strong>Score de saúde · 0 a 100</strong><small>Média de ${s.score.components} indicador(es): poupança, despesas fixas, comprometimento e evolução do patrimônio. Quanto maior, melhor.</small></div><b>${escapeHTML(s.score.label)}</b></div>`
      : '';

    return `
      <section class="dash-section dash-health-section" aria-labelledby="dashSec6">
        ${dashSectionHead('06', 'Saúde financeira', 'Indicadores-chave da sua situação financeira.', s.period.text)}
        ${score}
        <div class="dash-metrics">${rows}</div>
        <p class="dashboard-footnote">Poupança = resultado ÷ entradas · Despesas fixas = contas recorrentes com vencimento no período ÷ entradas · Comprometido = cartões + contas dos próximos 30 dias ÷ patrimônio · Reserva = patrimônio ÷ saída média mensal.</p>
      </section>`;
  }

  function dashSyncPeriodPill() {
    const bar = document.getElementById('dashFilterBar');
    if (!bar) return;
    const pill = bar.querySelector('.dash-segmented-pill');
    if (!pill) return;
    const buttons = Array.from(bar.querySelectorAll('[data-dash-period]'));
    const activeIndex = buttons.findIndex(button => button.dataset.dashPeriod === dashFilters.period);
    pill.style.setProperty('--dash-pill-i', String(Math.max(0, activeIndex)));
  }

  function dashSyncFilterUI(s) {
    const bar = document.getElementById('dashFilterBar');
    if (bar) {
      bar.querySelectorAll('[data-dash-period]').forEach(button => {
        const active = button.dataset.dashPeriod === dashFilters.period;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      dashSyncPeriodPill();
    }

    const select = document.getElementById('dashAccountFilter');
    if (select) {
      const desired = dashFilters.account;
      const options = [`<option value="">Todas as contas</option>`]
        .concat(banks.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`))
        .join('');
      if (select.innerHTML !== options) select.innerHTML = options;
      select.value = desired;
      if (select.value !== desired) {
        dashFilters.account = '';
        select.value = '';
      }
    }

    const compare = document.getElementById('dashCompare');
    if (compare) compare.checked = dashFilters.compare;

    const label = document.getElementById('dashRangeLabel');
    if (label) {
      label.textContent = s.period.text + (s.compare && s.period.previousText ? ` · comparação ${s.period.previousText}` : '');
    }
  }

  function renderDashboardTab() {
    if (currentTab !== 'dash') return;
    const host = document.getElementById('dashContent');
    if (!host) return;

    dashDestroyFlowChart();
    const summary = buildDashboardSummary();
    dashSyncFilterUI(summary);
    host.innerHTML =
      renderDashSummary(summary) +
      renderDashFlow(summary) +
      renderDashSpending(summary) +
      renderDashCommitments(summary) +
      renderDashPatrimony(summary) +
      renderDashHealth(summary) +
      renderDashComparison(summary) +
      renderDashIndicators();
    dashRenderFlowChart(summary);
  }

  function renderFeatureProfile() {
    const autoBills = document.getElementById('featureAutoBills'); if (autoBills) autoBills.checked = featureSettings.autoLaunchRecurring;
    const reminders = document.getElementById('featureReminders'); if (reminders) reminders.checked = featureSettings.reminders;
    const push = document.getElementById('featurePushNotifications'); if (push) push.checked = featureSettings.pushNotifications;
    const lockOnOpen = document.getElementById('chkLockOnOpen'); if (lockOnOpen) lockOnOpen.checked = featureSettings.lockOnOpen;
    const lockGrace = document.getElementById('featureLockGrace'); if (lockGrace) lockGrace.value = featureSettings.lockGraceMinutes;
    const autoQuotes = document.getElementById('featureAutoQuotes'); if (autoQuotes) autoQuotes.checked = featureSettings.autoRefreshQuotes;
    const interval = document.getElementById('featureQuoteInterval'); if (interval) interval.value = featureSettings.quoteRefreshMinutes;
    const projection = document.getElementById('featureProjectionMonths'); if (projection) projection.value = featureSettings.projectionMonths;
    const autoCat = document.getElementById('featureAutoCategorization'); if (autoCat) autoCat.checked = featureSettings.autoCategorization;
    const advance = document.getElementById('featureReminderAdvanceDays'); if (advance) advance.value = featureSettings.reminderAdvanceDays;
    const ciInitial = document.getElementById('ciInitial'); if (ciInitial && !ciInitial.value) setMoneyInput('ciInitial', 1000);
    const ciMonthly = document.getElementById('ciMonthly'); if (ciMonthly && !ciMonthly.value) setMoneyInput('ciMonthly', 100);
    const ciRate = document.getElementById('ciRate'); if (ciRate && !ciRate.value) ciRate.value = '0,8';
    const ciMonths = document.getElementById('ciMonths'); if (ciMonths && !ciMonths.value) ciMonths.value = '24';
    const ciBenchmarkRate = document.getElementById('ciBenchmarkRate'); if (ciBenchmarkRate && !ciBenchmarkRate.value) ciBenchmarkRate.value = compoundRateInputValue(compoundBenchmarkRatePct('cdi'));
    const pinInput = document.getElementById('featurePin'); if (pinInput) pinInput.value = '';
    window.renderAiQuotaStatus?.();
    window.LivroCaixaAI?.refreshQuota?.();
    const bank = document.getElementById('reconcileBank'); if (bank) { const current = bank.value; bank.innerHTML = banks.map(item => `<option value="${item.id}">${escapeHTML(item.name)}</option>`).join(''); if (banks.some(item => item.id === current)) bank.value = current; }
    const month = currentMonthYM(); const budgetCycle = currentFinancialCycleKey(); const rows = document.getElementById('featureBudgetRows');
    if (rows) rows.innerHTML = categories.map(cat => { const budget = budgetFor(cat.id); const spent = budgetSpent(cat.id, budgetCycle); const pct = budget && budget.amount > 0 ? (spent / budget.amount * 100) : 0; let statusLabel = ''; let statusClass = ''; if (budget && budget.amount > 0) { if (pct >= 100) { statusLabel = 'Excedido'; statusClass = 'excedido'; } else if (pct >= 80) { statusLabel = 'Atenção'; statusClass = 'atencao'; } else { statusLabel = 'Normal'; statusClass = 'normal'; } } return `<div class="feature-budget-row"><div class="budget-row-line1"><label for="budget-${escapeHTML(cat.id)}">${escapeHTML(cat.name)}</label><input type="text" data-budget-category="${escapeHTML(cat.id)}" id="budget-${escapeHTML(cat.id)}" data-money="true" placeholder="Sem limite" value="${budget ? MONEY_FORMATTER.format(Number(budget.amount) || 0) : ''}"></div><div class="budget-row-line2"><span>${fmt(spent)} gastos${budget && budget.amount>0 ? ` (${pct.toFixed(0)}%)` : ''}</span>${statusLabel ? `<span class="budget-status ${statusClass}">${statusLabel}</span>` : ''}</div><div class="budget-row-line3"><div class="budget-row-track"><span class="${pct >= 100 ? 'over' : ''}" style="width:${Math.min(100,pct).toFixed(2)}%" data-real-percent="${pct.toFixed(2)}"></span></div></div></div>`; }).join('');
    initMoneyMasks();
    renderReconciliationHistory();
  }
  function openFeatureProfile() { renderFeatureProfile(); openModal('panelFeatureProfile'); }

  function openGoalsPanel() {
  if (typeof renderGoalsList === 'function') {
    renderGoalsList();
  }

  if (typeof initMoneyMasks === 'function') {
    initMoneyMasks();
  }

  const goalsView = document.getElementById('viewGoals');

  if (goalsView && typeof window.switchTab === 'function') {
    const overlay = document.getElementById('modalOverlay');

    if (overlay) {
      overlay.classList.remove('open');
    }

    document.querySelectorAll('.panel.open').forEach(function(panel) {
      panel.classList.remove('open');
    });

    window.switchTab('goals');
    return;
  }
}

  async function saveFeatureSettings({ silent = false } = {}) {
    const statusEl = document.getElementById('profileSettingsStatus');
    featureSettings = normalizeFeatureSettings({ autoLaunchRecurring: document.getElementById('featureAutoBills')?.checked, reminders: document.getElementById('featureReminders')?.checked, pushNotifications: document.getElementById('featurePushNotifications')?.checked ?? featureSettings.pushNotifications, lockOnOpen: document.getElementById('chkLockOnOpen')?.checked ?? featureSettings.lockOnOpen, lockGraceMinutes: document.getElementById('featureLockGrace')?.value ?? featureSettings.lockGraceMinutes, autoRefreshQuotes: document.getElementById('featureAutoQuotes')?.checked, quoteRefreshMinutes: document.getElementById('featureQuoteInterval')?.value, projectionMonths: document.getElementById('featureProjectionMonths')?.value, autoCategorization: document.getElementById('featureAutoCategorization') ? document.getElementById('featureAutoCategorization').checked : featureSettings.autoCategorization, reminderAdvanceDays: document.getElementById('featureReminderAdvanceDays')?.value, monthlySavingsGoal: document.getElementById('featureSavingsGoalAmount')
        ? readMoneyInput(document.getElementById('featureSavingsGoalAmount'))
        : featureSettings.monthlySavingsGoal });
    budgets = budgets.filter(item => !document.getElementById(`budget-${item.categoryId}`));
    document.querySelectorAll('[data-budget-category]').forEach(input => { const amount = readMoneyInput(input); const categoryId = input.dataset.budgetCategory; if (amount > 0) budgets.push({ id: `bud_${categoryId}`, categoryId, month: currentMonthYM(), amount, updatedAt: new Date().toISOString() }); });
    persistFeatureSettings();
    if (!silent && statusEl) statusEl.textContent = 'Salvando…';
    try {
      await persistAll();
      await persistProfileSettings();
      if (!silent && statusEl) {
        statusEl.textContent = 'Salvo ✓';
        setTimeout(() => { if (statusEl.textContent === 'Salvo ✓') statusEl.textContent = ''; }, 3000);
        logInfo('Recursos de teste', 'Salvar configurações', 'Sucesso', 'Configurações, preferências e orçamentos atualizados.');
      } else if (silent && statusEl) {
        statusEl.textContent = 'Salvo ✓';
        setTimeout(() => { if (statusEl.textContent === 'Salvo ✓') statusEl.textContent = ''; }, 2000);
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = silent ? 'Erro ao sincronizar (salvo localmente)' : 'Erro ao sincronizar (salvo localmente)';
      logSyncError('configurações de teste', err);
    }
    startFeatureAutomation(); render();
  }

  let featureSettingsAutosaveTimer;

  let isSaving;

  function scheduleFeatureSettingsAutosave() {
    if (isSaving) return;
    clearTimeout(featureSettingsAutosaveTimer);
    featureSettingsAutosaveTimer = setTimeout(async () => {
      isSaving = true;
      await saveFeatureSettings({ silent: true });
      isSaving = false;
    }, 700);
  }
