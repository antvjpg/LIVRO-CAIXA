/* C.O.D.E. — compatibilidade histórica de ícones legados (emoji → Tabler).
   Executa o fluxo REAL de carregamento do app em Node:
   - carrega os scripts clássicos reais (js/16, js/17, js/19, js/18) num
     contexto vm com stubs mínimos de DOM;
   - injeta o resolvedor REAL (js/domain/icon-system.js, mesmo import dos
     demais oráculos) como LC_ICON, exatamente como o app faz em produção;
   - roda a sequência do loadState(): setStateArray → normalizeGoals →
     normalizeAllGoalStatuses (metas) e setStateArray (categorias);
   - verifica normalização, render (classe Tabler via categoryIconHTML /
     LC_ICON.getIconClass) e não-destruição dos demais campos.
   Não substitui o E2E de leitura real (seed no Firestore + reload), que roda
   no GitHub Actions — ver metas.spec.js/categorias.spec.js. Este oráculo
   prova o pipeline de load/normalização/render com o código do app.
   Execução: node --test e2e/oracles/legacy-icon-compat.test.mjs
   (também roda no CI via o glob e2e/oracles/*.test.mjs) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as ICON from '../../js/domain/icon-system.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const LC_ICON = {
  FALLBACK_ICON: ICON.FALLBACK_ICON,
  isValidTablerIcon: ICON.isValidTablerIcon,
  getLegacyIconMapping: ICON.getLegacyIconMapping,
  resolveIcon: ICON.resolveIcon,
  getIconClass: ICON.getIconClass,
  getIconLabel: ICON.getIconLabel,
  getTablerIconCatalog: ICON.getTablerIconCatalog,
};

function elStub() {
  const fn = function () {};
  return new Proxy(fn, {
    get(_t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      return elStub();
    },
    set() {
      return true;
    },
    apply() {
      return elStub();
    },
  });
}

function createAppContext() {
  const documentStub = new Proxy(
    {
      body: elStub(),
      addEventListener() {},
      getElementById() {
        return elStub();
      },
      querySelector() {
        return elStub();
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return elStub();
      },
    },
    {
      get(t, k) {
        return k in t ? t[k] : elStub();
      },
    }
  );
  const sandbox = {
    console,
    document: documentStub,
    goals: [],
    categories: [],
    banks: [],
    pockets: [],
    investments: [],
    yieldsLog: [],
    entries: [],
    recurringBills: [],
    receivables: [],
    budgets: [],
    invoiceLaunches: [],
    cards: [],
    purchases: [],
    todayISO: () => '2026-11-08',
    LC_ICON,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of [
    'js/16-events-modals.js',
    'js/17-sync-persistence.js',
    'js/19-goals.js',
    'js/18-render-core.js',
  ]) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8');
    new vm.Script(code, { filename: f }).runInContext(ctx);
  }
  // CATEGORY_ICON_RULES é atribuído no init do app (js/99-init.js); extrai o
  // literal REAL do fonte para cobrir o fallback por nome no render.
  const initSrc = fs.readFileSync(path.join(ROOT, 'js/99-init.js'), 'utf8');
  const rulesMatch = /CATEGORY_ICON_RULES = (\[[\s\S]*?\]);/.exec(initSrc);
  assert.ok(rulesMatch, 'CATEGORY_ICON_RULES não encontrado em js/99-init.js');
  new vm.Script(`CATEGORY_ICON_RULES = ${rulesMatch[1]};`, { filename: 'category-rules' }).runInContext(ctx);
  return { sandbox, ctx };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// Documentos no formato histórico do Firestore (o que doc.data() devolve):
// metas e categorias gravadas antes da migração Tabler guardavam emoji em `icon`.
const GOAL_DOCS = [
  { id: 'hist-heart', name: 'Reserva Saúde', icon: '❤️', targetAmount: 500, status: 'active' },
  { id: 'hist-target', name: 'Meta Antiga', icon: '🎯', targetAmount: 100, status: 'active' },
  { id: 'hist-chart', name: 'Investir', icon: '📈', targetAmount: 1000, status: 'active' },
  { id: 'new-chart', name: 'Meta Nova', icon: 'chart-line', targetAmount: 200, status: 'active' },
  { id: 'new-target-id', name: 'Meta ID', icon: 'target', targetAmount: 200, status: 'active' },
  { id: 'unknown', name: 'Meta X', icon: '🦄', targetAmount: 50, status: 'active' },
  { id: 'no-icon', name: 'Meta Sem Ícone', targetAmount: 50, status: 'active' },
  { id: 'null-icon', name: 'Meta Nula', icon: null, targetAmount: 50, status: 'active' },
  { id: 'blank-icon', name: 'Meta Vazia', icon: '   ', targetAmount: 50, status: 'active' },
];

const EXPECTED_GOAL_ICONS = {
  'hist-heart': 'heart',
  'hist-target': 'target',
  'hist-chart': 'chart-line',
  'new-chart': 'chart-line',
  'new-target-id': 'target',
  unknown: 'star',
  'no-icon': 'target',
  'null-icon': 'target',
  'blank-icon': 'target',
};

test('metas: load real (setStateArray → normalizeGoals → normalizeAllGoalStatuses) converte emojis legados', () => {
  const { sandbox } = createAppContext();
  const original = clone(GOAL_DOCS);

  // Sequência exata do loadState() (js/17-sync-persistence.js:65,126,129)
  sandbox.setStateArray('goals', clone(GOAL_DOCS));
  sandbox.normalizeGoals();
  sandbox.normalizeAllGoalStatuses();

  for (const goal of sandbox.goals) {
    const expected = EXPECTED_GOAL_ICONS[goal.id];
    assert.equal(goal.icon, expected, `ícone de ${goal.id}`);
    // Render: goalMarkup resolve via LC_ICON.getIconClass(goal.icon)
    assert.equal(LC_ICON.getIconClass(goal.icon), `ti ti-${expected}`, `classe de ${goal.id}`);
  }

  // Não-destruição: valores originais (exceto icon e campos novos com default)
  // permanecem idênticos; nenhum campo original é removido.
  for (const orig of original) {
    const norm = sandbox.goals.find((g) => g.id === orig.id);
    assert.ok(norm, `documento ${orig.id} preservado`);
    for (const [key, value] of Object.entries(orig)) {
      if (key === 'icon') continue;
      assert.deepEqual(norm[key], value, `${orig.id}.${key} preservado`);
    }
    for (const key of Object.keys(orig)) {
      assert.ok(key in norm, `${orig.id}.${key} não removido`);
    }
  }
  // Conjunto de documentos idêntico (nada adicionado/removido).
  assert.deepEqual(
    new Set(sandbox.goals.map((g) => g.id)),
    new Set(original.map((g) => g.id)),
    'nenhum documento adicionado ou removido'
  );
});

test('metas: diff de write-back (arrToMap) não destrutivo', () => {
  const { sandbox } = createAppContext();
  const original = clone(GOAL_DOCS);
  sandbox.setStateArray('goals', clone(GOAL_DOCS));
  sandbox.normalizeGoals();
  sandbox.normalizeAllGoalStatuses();

  // Mesma comparação JSON de id que o commitDiff usa para decidir escritas.
  const oldMap = sandbox.arrToMap(original);
  const newMap = sandbox.arrToMap(sandbox.goals);
  assert.deepEqual(new Set(Object.keys(newMap)), new Set(Object.keys(oldMap)), 'mesmos ids');
  for (const id of Object.keys(oldMap)) {
    const before = oldMap[id];
    const after = newMap[id];
    for (const [key, value] of Object.entries(before)) {
      if (key === 'icon') continue;
      assert.deepEqual(after[key], value, `${id}.${key} não alterado no write-back`);
    }
    assert.equal(after.icon, EXPECTED_GOAL_ICONS[id], `${id}.icon convertido`);
  }
});

const CAT_DOCS = [
  { id: 'c-heart', name: 'Saúde', icon: '❤️' },
  { id: 'c-chart', name: 'Investimento', icon: '📈' },
  { id: 'c-new', name: 'Mercado', icon: 'shopping-cart' },
  { id: 'c-unknown', name: 'Estranho', icon: '🦄' },
  { id: 'c-noicon', name: 'Sem Ícone' },
  { id: 'c-null', name: 'Nulo', icon: null },
];

test('categorias: load preserva o valor armazenado (sem normalização nem write-back)', () => {
  const { sandbox } = createAppContext();
  const original = clone(CAT_DOCS);
  sandbox.setStateArray('categories', clone(CAT_DOCS));

  const byId = new Map(sandbox.categories.map((c) => [c.id, c]));
  for (const orig of original) {
    assert.deepEqual(byId.get(orig.id), orig, `categoria ${orig.id} intacta após load`);
  }
});

test('categorias: render resolve emojis legados para classes Tabler', () => {
  const { sandbox } = createAppContext();
  sandbox.setStateArray('categories', clone(CAT_DOCS));
  const byId = new Map(sandbox.categories.map((c) => [c.id, c]));

  // categoryIconHTML é o renderizador real (js/18-render-core.js:993-998)
  assert.match(sandbox.categoryIconHTML(byId.get('c-heart')), /<i class="ti ti-heart"/);
  assert.match(sandbox.categoryIconHTML(byId.get('c-chart')), /<i class="ti ti-chart-line"/);
  assert.match(sandbox.categoryIconHTML(byId.get('c-new')), /<i class="ti ti-shopping-cart"/);
  assert.match(sandbox.categoryIconHTML(byId.get('c-unknown')), /<i class="ti ti-star"/);
  // Sem nome que case com regra nem ícone: default de fluxo, sem quebra.
  assert.match(sandbox.categoryIconHTML(byId.get('c-noicon')), /<i class="ti ti-trending-up"/);
  assert.match(sandbox.categoryIconHTML(byId.get('c-null'), 'out'), /<i class="ti ti-trending-down"/);
  // Regra por nome (fallback) também passa pelo resolvedor: 'Mercado' → 🍔 → burger.
  assert.match(sandbox.categoryIconHTML({ name: 'Mercado' }), /<i class="ti ti-burger"/);
});
