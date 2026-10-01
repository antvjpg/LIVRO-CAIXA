/* C.O.D.E. — oráculo (sugestões contextuais LIA).
   Execução local: npm run code:oracles
   Testa a seleção determinística de sugestões baseada em sinais financeiros reais. */
import test from 'node:test';
import assert from 'node:assert/strict';

const CONTEXTUAL_TEMPLATES = Object.freeze({
  budgetOver: [
    "Por que estou acima do orçamento?",
    "Como reduzir gastos nas categorias excedidas?"
  ],
  budgetNearLimit: [
    "Quanto ainda posso gastar neste orçamento?",
    "Estou perto do limite em alguma categoria?"
  ],
  topExpenseCategory: [
    "Qual categoria mais pesou nos meus gastos?",
    "Como comparar esta categoria com meses anteriores?"
  ],
  goalNearDeadline: [
    "Quanto preciso guardar para atingir minha meta a tempo?",
    "Minha meta está no prazo?"
  ],
  goalNeedsFunding: [
    "Quanto falta para completar minha meta?",
    "Qual o valor mensal necessário para a meta?"
  ],
  hasInvestments: [
    "Como está a rentabilidade da minha carteira?",
    "Qual a concentração dos meus investimentos?"
  ],
  negativeCashFlow: [
    "Por que meu fluxo de caixa está negativo?",
    "Como equilibrar entradas e saídas?"
  ],
  noData: [
    "Cadastre uma conta para começar",
    "Crie uma caixinha para seus objetivos",
    "Adicione seu primeiro investimento"
  ]
});

function pickContextual(pool, max) {
  const shuffled = [...pool].sort((a, b) => a.localeCompare(b));
  return shuffled.slice(0, max);
}

function analyzeFinancialContext(snapshot) {
  const signals = [];
  if (!snapshot) {
    signals.push({ type: 'noData', priority: 10 });
    return signals;
  }

  const hasOver = false;
  const hasNear = false;
  
  if (snapshot.budgets?.length) {
    let topExpense = { category: null, spent: 0 };
    for (const budget of snapshot.budgets) {
      if (!budget.amount || budget.amount <= 0) continue;
      const spent = budget.spent || 0;
      const pct = (spent / budget.amount) * 100;
      if (pct >= 100) {
        signals.push({ type: 'budgetOver', priority: 1, category: budget.categoryId, pct, spent, limit: budget.amount });
      } else if (pct >= 80) {
        signals.push({ type: 'budgetNearLimit', priority: 2, category: budget.categoryId, pct, spent, limit: budget.amount });
      }
      if (spent > topExpense.spent) {
        topExpense = { category: budget.categoryId, spent, pct };
      }
    }
    if (topExpense.category && topExpense.spent > 0) {
      signals.push({ type: 'topExpenseCategory', priority: 3, ...topExpense });
    }
  }

  if (snapshot.goals?.length) {
    const now = new Date('2026-09-28');
    for (const goal of snapshot.goals) {
      if (!goal.targetDate || !goal.targetAmount) continue;
      const targetDate = new Date(goal.targetDate);
      const monthsLeft = Math.max(1, Math.ceil((targetDate - now) / (30 * 24 * 60 * 60 * 1000)));
      const current = goal.currentAmount || 0;
      const needed = Math.max(0, (goal.targetAmount || 0) - current);
      if (monthsLeft <= 3 && needed > 0) {
        signals.push({ type: 'goalNearDeadline', priority: 3, goalId: goal.id, monthsLeft, needed });
      } else if (needed > 0) {
        signals.push({ type: 'goalNeedsFunding', priority: 4, goalId: goal.id, monthsLeft, needed });
      }
    }
  }

  if (snapshot.investments?.length) {
    signals.push({ type: 'hasInvestments', priority: 6 });
  }

  if (snapshot.cashFlow && typeof snapshot.cashFlow.net === 'number' && snapshot.cashFlow.net < 0) {
    signals.push({ type: 'negativeCashFlow', priority: 4, net: snapshot.cashFlow.net });
  }

  signals.sort((a, b) => a.priority - b.priority);
  return signals;
}

function generateContextualSuggestions(snapshot) {
  const signals = analyzeFinancialContext(snapshot);
  if (signals.length === 0 || signals[0].type === 'noData') {
    return [...CONTEXTUAL_TEMPLATES.noData];
  }

  const suggestions = [];
  const usedTypes = new Set();

  for (const signal of signals) {
    if (suggestions.length >= 3) break;
    if (usedTypes.has(signal.type)) continue;
    const templates = CONTEXTUAL_TEMPLATES[signal.type];
    if (!templates) continue;
    const picked = pickContextual(templates, 3 - suggestions.length);
    suggestions.push(...picked);
    usedTypes.add(signal.type);
  }

  return suggestions.slice(0, 3);
}

test('oráculo: snapshot vazio → fallback', () => {
  const suggestions = generateContextualSuggestions(null);
  assert.equal(suggestions.length, 3);
  assert.ok(suggestions[0].includes('Cadastre uma conta'));
});

test('oráculo: budgetOver prioridade máxima', () => {
  const snapshot = {
    budgets: [
      { categoryId: 'c_alimentacao', amount: 1000, spent: 1200 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('acima do orçamento') || s.includes('excedidas')));
});

test('oráculo: budgetNearLimit quando próximo do limite', () => {
  const snapshot = {
    budgets: [
      { categoryId: 'c_transporte', amount: 1000, spent: 850 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('ainda posso gastar') || s.includes('perto do limite')));
});

test('oráculo: topExpenseCategory detectada', () => {
  const snapshot = {
    budgets: [
      { categoryId: 'c_alimentacao', amount: 2000, spent: 1500 },
      { categoryId: 'c_transporte', amount: 1000, spent: 300 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('categoria mais pesou') || s.includes('comparar esta categoria')));
});

test('oráculo: goalNearDeadline prioridade alta', () => {
  const snapshot = {
    goals: [
      { id: 'g1', targetDate: '2026-10-15', targetAmount: 5000, currentAmount: 1000 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('guardar para atingir') || s.includes('meta está no prazo')));
});

test('oráculo: goalNeedsFunding quando meta precisa aporte', () => {
  const snapshot = {
    goals: [
      { id: 'g1', targetDate: '2027-06-01', targetAmount: 10000, currentAmount: 2000 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('falta para completar') || s.includes('valor mensal necessário')));
});

test('oráculo: hasInvestments quando há investimentos', () => {
  const snapshot = {
    investments: [{ name: 'Tesouro Selic', value: 5000 }]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('rentabilidade') || s.includes('concentração')));
});

test('oráculo: negativeCashFlow detectado', () => {
  const snapshot = {
    cashFlow: { net: -500, transactionCount: 10 }
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.ok(suggestions.some(s => s.includes('fluxo de caixa') || s.includes('equilibrar')));
});

test('oráculo: exatamente 3 sugestões', () => {
  const snapshot = {
    budgets: [
      { categoryId: 'c1', amount: 1000, spent: 1200 },
      { categoryId: 'c2', amount: 500, spent: 450 }
    ],
    goals: [
      { id: 'g1', targetDate: '2026-10-15', targetAmount: 5000, currentAmount: 1000 }
    ],
    investments: [{ name: 'A', value: 1000 }],
    cashFlow: { net: -100 }
  };
  const suggestions = generateContextualSuggestions(snapshot);
  assert.equal(suggestions.length, 3);
});

test('oráculo: determinístico (ordem alfabética)', () => {
  const snapshot = { budgets: [{ categoryId: 'c1', amount: 1000, spent: 1200 }] };
  const s1 = generateContextualSuggestions(snapshot);
  const s2 = generateContextualSuggestions(snapshot);
  assert.deepEqual(s1, s2);
});

test('oráculo: sem duplicatas', () => {
  const snapshot = {
    budgets: [
      { categoryId: 'c1', amount: 1000, spent: 1200 }
    ],
    goals: [
      { id: 'g1', targetDate: '2026-10-15', targetAmount: 5000, currentAmount: 1000 }
    ]
  };
  const suggestions = generateContextualSuggestions(snapshot);
  const unique = new Set(suggestions);
  assert.equal(unique.size, suggestions.length);
});