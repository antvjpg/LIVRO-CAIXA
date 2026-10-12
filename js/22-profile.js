/* LIVRO-CAIXA · js/22-profile.js — perfil e diagnóstico (app.js: 6884-7289). Separação por responsabilidade; conteúdo preservado. */

  let HIDE_BALANCES_STORAGE_KEY;

  function syncProfileEmail() {
    const user = (typeof auth !== 'undefined' && auth.currentUser) ? auth.currentUser : null;
    const elProfileEmail = document.getElementById('profileEmail');
    if (elProfileEmail && user?.email) {
      elProfileEmail.textContent = user.email;
    }
  }

  function syncBalancesToggleButton(hidden) {
    /* Botão do olho removido: alternância só pelo toque no valor/saldo. */
  }
  function applyBalancesHiddenState(hidden) {
    document.body.classList.toggle('balances-hidden', !!hidden);
    syncBalancesToggleButton(!!hidden);
  }
  function toggleBalancesVisibility() {
    applyBalancesHiddenState(!document.body.classList.contains('balances-hidden'));
  }
  let hideBalancesOnOpen;

  let autoQuotes;

  let quoteIntervalRow;

  function toggleQuoteInterval() {
    if (quoteIntervalRow) quoteIntervalRow.style.display = autoQuotes?.checked ? '' : 'none';
  }

  // ===== P2.3.2 — Detecção real de inconsistências =====
  function runDiagnostics() {
    const issues = [];

    const orphanEntryBanks = entries.filter(e => e.bank && !banks.some(b => b.id === e.bank));
    if (orphanEntryBanks.length) issues.push({ severity: 'warning', title: 'Lançamentos com banco inexistente', detail: `${orphanEntryBanks.length} lançamento(s) referenciam um banco que não existe mais.` });

    const orphanEntryCats = entries.filter(e => e.category && !categories.some(c => c.id === e.category));
    if (orphanEntryCats.length) issues.push({ severity: 'warning', title: 'Lançamentos com categoria inexistente', detail: `${orphanEntryCats.length} lançamento(s) referenciam uma categoria que não existe mais.` });

    const orphanPurchaseCards = purchases.filter(p => p.cardId && !cards.some(c => c.id === p.cardId));
    if (orphanPurchaseCards.length) issues.push({ severity: 'warning', title: 'Compras sem cartão vinculado', detail: `${orphanPurchaseCards.length} compra(s) referenciam um cartão que não existe mais.` });

    const orphanBudgets = budgets.filter(b => b.categoryId && !categories.some(c => c.id === b.categoryId));
    if (orphanBudgets.length) issues.push({ severity: 'warning', title: 'Limites de orçamento órfãos', detail: `${orphanBudgets.length} limite(s) de orçamento apontam pra uma categoria que não existe mais.` });

    const catNamesSeen = {};
    categories.forEach(c => { const key = String(c.name || '').trim().toLowerCase(); if (key) catNamesSeen[key] = (catNamesSeen[key] || 0) + 1; });
    const dupCatNames = Object.entries(catNamesSeen).filter(([, count]) => count > 1);
    if (dupCatNames.length) issues.push({ severity: 'warning', title: 'Categorias com nome repetido', detail: `${dupCatNames.length} nome(s) de categoria aparecem mais de uma vez: ${dupCatNames.map(([name]) => name).join(', ')}.` });

    const bankNamesSeen = {};
    banks.forEach(b => { const key = String(b.name || '').trim().toLowerCase(); if (key) bankNamesSeen[key] = (bankNamesSeen[key] || 0) + 1; });
    const dupBankNames = Object.entries(bankNamesSeen).filter(([, count]) => count > 1);
    if (dupBankNames.length) issues.push({ severity: 'warning', title: 'Bancos com nome repetido', detail: `${dupBankNames.length} nome(s) de banco aparecem mais de uma vez: ${dupBankNames.map(([name]) => name).join(', ')}.` });

    const negativePockets = pockets.filter(p => pocketCurrentBalance(p) < -0.005);
    if (negativePockets.length) issues.push({ severity: 'warning', title: 'Caixinhas com saldo negativo', detail: `${negativePockets.length} caixinha(s) têm mais resgate do que aporte registrado: ${negativePockets.map(p => p.name).join(', ')}.` });

    const cardsWithoutBank = cards.filter(c => c.active !== false && !c.bankId);
    if (cardsWithoutBank.length) issues.push({ severity: 'warning', title: 'Cartões sem banco definido', detail: `${cardsWithoutBank.length} cartão(ões) ativo(s) não têm banco de pagamento vinculado.` });

    const goalsPastDeadline = goals.filter(g => {
      const current = goalCurrentAmount(g);
      return g.deadline && g.deadline < todayISO() && current != null && current < Number(g.targetAmount || 0);
    });
    if (goalsPastDeadline.length) issues.push({ severity: 'warning', title: 'Metas com prazo vencido', detail: `${goalsPastDeadline.length} meta(s) passaram do prazo sem atingir o objetivo: ${goalsPastDeadline.map(g => g.name).join(', ')}.` });

    return issues;
  }
  function buildGeminiFinancialSnapshot() {
    const entriesSafe = Array.isArray(entries) ? entries : [];
    const currentMonth = currentMonthYM();
    const diagnosticIssues = runDiagnostics();

    const totalIncome = entriesSafe
      .filter(e => e.type === 'in')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const totalExpense = entriesSafe
      .filter(e => e.type === 'out')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const categoryTotals = new Map();

    entriesSafe
      .filter(e => e.type === 'out')
      .forEach(e => {
        const categoryName =
          categories.find(c => c.id === e.category)?.name || 'Sem categoria';

        categoryTotals.set(
          categoryName,
          (categoryTotals.get(categoryName) || 0) + Number(e.amount || 0)
        );
      });

    const expensesByCategory = [...categoryTotals.entries()]
      .map(([category, amount]) => ({
        category,
        amount: Number(amount.toFixed(2))
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyFlow = [];
    const monthsSeen = new Set();

    entriesSafe.forEach(e => {
      const month = String(e.date || '').slice(0, 7);
      if (month) monthsSeen.add(month);
    });

    [...monthsSeen]
      .sort()
      .slice(-12)
      .forEach(month => {
        const monthEntries = entriesSafe.filter(
          e => String(e.date || '').startsWith(month)
        );

        const income = monthEntries
          .filter(e => e.type === 'in')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        const expense = monthEntries
          .filter(e => e.type === 'out')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        monthlyFlow.push({
          month,
          income: Number(income.toFixed(2)),
          expense: Number(expense.toFixed(2)),
          net: Number((income - expense).toFixed(2)),
          transactions: monthEntries.length
        });
      });

    const patrimony = getPatrimonySummaryBlock();

    /* Contas: rótulo + saldo. Sem números de conta, sem IDs internos. */
    const accountSummary = banks
      .filter(bank => bank && bank.id !== 'geral')
      .map(bank => ({
        name: String(bank.name || 'Conta'),
        balance: Number(bankBalance(bank.id).toFixed(2))
      }));

    /* Caixinhas: usa as mesmas fórmulas da tela (pocketCurrentBalance e a
       progressão exibida em pocketGoalMarkup) — nada de regra paralela. */
    const pocketSummary = pockets.map(pocket => {
      const balance = Number(pocketCurrentBalance(pocket).toFixed(2));
      const target = Number(pocket.goalAmount) || 0;
      const percent = target > 0 ? Math.min(100, Math.max(0, balance / target * 100)) : null;
      return {
        name: String(pocket.name || 'Caixinha'),
        objective: pocket.goal ? String(pocket.goal) : null,
        balance,
        target: target > 0 ? target : null,
        progressPercent: percent == null ? null : Number(percent.toFixed(1)),
        remaining: target > 0 ? Number(Math.max(0, target - balance).toFixed(2)) : null
      };
    });

    const investmentSummary = investments.map(inv => {
      const crypto = isCryptoType(inv.type);
      return {
        name: String(inv.name || inv.alias || 'Ativo'),
        type: String(inv.type || 'Não informado'),
        institution: inv.institution ? String(inv.institution) : null,
        value: Number(
          (
            inv.type === 'Renda Fixa'
              ? fixedIncomeCurrentValue(inv)
              : Number(inv.value || 0)
          ).toFixed(2)
        ),
        units: crypto && inv.units != null
          ? Number(cryptoCurrentUnits(inv))
          : null,
        rate: inv.rate ? String(inv.rate) : null,
        dueDate: inv.dueDate || null
      };
    });

    const budgetSummary = budgets.map(budget => {
      const categoryName =
        categories.find(c => c.id === budget.categoryId)?.name ||
        'Sem categoria';

      const spent = budgetSpent(budget.categoryId);

      return {
        categoryId: budget.categoryId,
        category: categoryName,
        amount: Number(budget.amount || 0),
        limit: Number(budget.amount || 0),
        spent: Number(spent.toFixed(2))
      };
    });

    /* Metas: goalPlanning()/goalCurrentAmount() são a fonte oficial de
       alvo, atual, restante e prazo. */
    const goalSummary = goals.map(goal => {
      const plan = goalPlanning(goal);
      const percent = plan.target > 0 && plan.hasCurrent
        ? Math.min(100, Math.max(0, plan.current / plan.target * 100))
        : null;
      return {
        name: String(goal.name || 'Meta'),
        target: plan.target,
        current: plan.hasCurrent ? plan.current : null,
        remaining: plan.remaining,
        progressPercent: percent == null ? null : Number(percent.toFixed(1)),
        deadline: goal.deadline || null,
        status: goal.status || 'active',
        daysRemaining: plan.daysRemaining,
        source: goal.sourceType || (goal.caixinhaId ? 'pocket' : null)
      };
    });

    /* Cartões: agregados do motor (card-engine) — nunca dados completos
       do cartão, titular, número ou compras individuais. */
    const cardSummary = dashCardSummary();
    const cardTotals = cardSummary
      ? {
          activeCount: cards.filter(card => card.active !== false).length,
          invoiceLaunchCount: invoiceLaunches.length,
          purchaseCount: purchases.length,
          currentInvoiceTotal: Number(cardSummary.currentInvoiceTotal || 0),
          currentInvoiceRemaining: Number(cardSummary.currentInvoiceRemaining || 0),
          previousInvoiceRemaining: Number(cardSummary.previousInvoiceRemaining || 0),
          totalLimit: Number(cardSummary.totalLimit || 0),
          totalUsed: Number(cardSummary.totalUsed || 0),
          committed: Number(cardSummary.committed || 0)
        }
      : {
          activeCount: cards.filter(card => card.active !== false).length,
          invoiceLaunchCount: invoiceLaunches.length,
          purchaseCount: purchases.length
        };

    return {
      schemaVersion: 'P3.5',
      generatedAt: new Date().toISOString(),
      period: {
        currentMonth,
        monthsIncluded: monthlyFlow.length,
        currentMonthComplete: (() => {
          const today = todayISO();
          const monthEnd = monthEndDate(currentMonth);
          return today >= monthEnd;
        })(),
        /* Totais do mês corrente mesmo quando ainda não há lançamento
           nele — evita a IA tratar "sem dados" como "sem gastos". */
        currentMonthTotals: (() => {
          const inMonth = entriesSafe.filter(e => String(e.date || '').startsWith(currentMonth));
          const inc = inMonth.filter(e => e.type === 'in').reduce((s, e) => s + Number(e.amount || 0), 0);
          const exp = inMonth.filter(e => e.type === 'out').reduce((s, e) => s + Number(e.amount || 0), 0);
          return {
            income: Number(inc.toFixed(2)),
            expense: Number(exp.toFixed(2)),
            net: Number((inc - exp).toFixed(2)),
            transactions: inMonth.length
          };
        })(),
        latestEntryDate: entriesSafe
          .map(e => String(e.date || ''))
          .filter(Boolean)
          .sort()
          .pop() || null
      },

      cashFlow: {
        totalIncome: Number(totalIncome.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        net: Number((totalIncome - totalExpense).toFixed(2)),
        transactionCount: entriesSafe.length,
        expensesByCategory
      },

      monthlyFlow,

      patrimony: {
        banks: Number(patrimony.bankTotal.toFixed(2)),
        pockets: Number(patrimony.pocketTotal.toFixed(2)),
        investments: Number(patrimony.investTotal.toFixed(2)),
        total: Number(patrimony.total.toFixed(2))
      },

      accounts: accountSummary,
      pockets: pocketSummary,
      investments: investmentSummary,

      cards: cardTotals,

      budgets: budgetSummary,
      goals: goalSummary,

      /* Referência externa de mercado (BCB/Tesouro) — contexto adicional.
         null quando ainda não há indicadores; nunca entra em cálculo. */
      indicators: (() => {
        const info = financialIndicatorsState();
        if (!info) return null;
        const current = info.indicators;
        const pick = item => (item ? { value: item.value, unit: item.unit, date: item.date } : null);
        return {
          source: 'BCB SGS e Tesouro Nacional',
          fetchedAt: info.fetchedAt || null,
          selic: pick(current.selic),
          cdi: pick(current.cdi),
          ipca: pick(current.ipca),
          tesouro: current.tesouro && Array.isArray(current.tesouro.titles)
            ? { date: current.tesouro.date, titleCount: current.tesouro.titles.length }
            : null
        };
      })(),

      structuralDiagnosis: {
        issueCount: diagnosticIssues.length,
        issues: diagnosticIssues.map(issue => ({
        severity: issue.severity,
        title: issue.title
      }))
      }
    };
  }

  /* ETAPA 3 (V.20-02) — o orçamento do snapshot (CHAT_SNAPSHOT_REDUCTIONS e
     fitChatSnapshotToBudget) mora em ai-chat-contract.js junto dos limites
     que ele usa; aqui só chamamos contract.fitChatSnapshotToBudget(). */

  function renderDiagnosticResults() {
    const issues = runDiagnostics();
    const icon = document.getElementById('diagnosticSummaryIcon');
    const label = document.getElementById('diagnosticSummaryLabel');
    const detail = document.getElementById('diagnosticSummaryDetail');
    if (icon) icon.textContent = '';
    if (label) label.textContent = issues.length ? `${issues.length} ponto(s) de atenção` : 'Dados consistentes';
    if (detail) detail.textContent = issues.length ? 'Veja os detalhes abaixo — nada foi alterado automaticamente.' : 'Nenhuma inconsistência encontrada na última verificação.';
    const results = document.getElementById('diagnosticResults');
    if (results) {
      results.innerHTML = issues.length
        ? issues.map(i => `<div class="diagnostic-item is-warning"><span></span><div><strong>${escapeHTML(i.title)}</strong><span>${escapeHTML(i.detail)}</span></div></div>`).join('')
        : '<div class="diagnostic-item is-ok"><span></span><div><strong>Tudo certo</strong><span>Nenhuma inconsistência encontrada.</span></div></div>';
    }
    return issues;
  }
