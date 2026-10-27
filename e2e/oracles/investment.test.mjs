import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);

const {
  isCryptoType,
  isBitcoinType,
  movementDelta,
  cryptoMovementTotal,
  cryptoInitialUnits,
  cryptoCurrentUnits,
  cryptoValueFromUnits,
  fixedIncomeMovementTotal,
  fixedIncomeInitialValue,
  fixedIncomeCurrentValue,
  investmentDisplayValue,
  investmentsTotal,
  rentability,
  normalizeInstitutionKey,
  groupInvestmentsByInstitution,
  SATS_PER_BTC,
} = require('./investment.js');

test('tipos: crypto cobre Stablecoin/Criptomoeda/Bitcoin; outros não', () => {
  assert.equal(isCryptoType('Stablecoin'), true);
  assert.equal(isCryptoType('Criptomoeda'), true);
  assert.equal(isCryptoType('Bitcoin'), true);
  assert.equal(isCryptoType('Renda Fixa'), false);
  assert.equal(isCryptoType('Outros'), false);
  assert.equal(isBitcoinType('Bitcoin'), true);
  assert.equal(isBitcoinType('Stablecoin'), false);
});

test('cryptoValueFromUnits: BTC converte SATS → BRL; stablecoin multiplica direto', () => {
  assert.equal(SATS_PER_BTC, 1e8);
  assert.equal(cryptoValueFromUnits('Bitcoin', 100000, 650000), 650);
  assert.ok(Math.abs(cryptoValueFromUnits('Stablecoin', 12.5, 5.1) - 63.75) < 1e-9);
  assert.equal(cryptoValueFromUnits('Criptomoeda', 10, 2.25), 22.5);
});

test('cryptoValueFromUnits: unidades/cotação não finitas retornam 0', () => {
  assert.equal(cryptoValueFromUnits('Stablecoin', NaN, 5), 0);
  assert.equal(cryptoValueFromUnits('Stablecoin', 10, null), 0);
  assert.equal(cryptoValueFromUnits('Stablecoin', 10, undefined), 0);
  assert.equal(cryptoValueFromUnits('Bitcoin', 'x', 650000), 0);
});

test('movementDelta: aporte/rendimento positivos; resgate negativo; amount inválido vira 0', () => {
  assert.equal(movementDelta({ kind: 'aporte', amount: 100 }), 100);
  assert.equal(movementDelta({ kind: 'rendimento', amount: 25.5 }), 25.5);
  assert.equal(movementDelta({ kind: 'resgate', amount: 40 }), -40);
  assert.equal(movementDelta({ kind: 'rendimento' }), 0);
  assert.equal(movementDelta(null), 0);
});

test('cryptoMovementTotal: soma unidades com sinal, ignora null e registros de outra entidade', () => {
  const asset = { id: 'a1', type: 'Stablecoin', initialUnits: 100 };
  const yields = [
    { id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'aporte', units: 10 },
    { id: 'y2', targetType: 'invest', targetId: 'a1', kind: 'resgate', units: 5 },
    { id: 'y3', targetType: 'invest', targetId: 'a1', kind: 'rendimento', units: null, amount: 3 },
    { id: 'y4', targetType: 'pocket', targetId: 'a1', kind: 'aporte', units: 99 },
    { id: 'y5', targetType: 'invest', targetId: 'outra', kind: 'aporte', units: 7 },
  ];
  assert.equal(cryptoMovementTotal(asset, yields), 5);
  assert.equal(cryptoMovementTotal(asset, yields, 'y1'), -5);
});

test('cryptoInitialUnits: usa initialUnits quando presente; senão deriva units − movimentações', () => {
  const asset = { id: 'a1', type: 'Stablecoin', initialUnits: 12.5, units: 20 };
  const yields = [{ id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'aporte', units: 7.5 }];
  assert.equal(cryptoInitialUnits(asset, yields), 12.5);
  const legado = { id: 'a2', type: 'Stablecoin', units: 20 };
  assert.equal(cryptoInitialUnits(legado, []), 20);
  assert.equal(cryptoInitialUnits(legado, [{ id: 'y9', targetType: 'invest', targetId: 'a2', kind: 'aporte', units: 7 }]), 13);
});

test('cryptoCurrentUnits: inicial + movimentações; BTC arredonda; senão 8 casas; nunca negativo', () => {
  const st = { id: 'a1', type: 'Stablecoin', initialUnits: 100 };
  const yields = [
    { id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'aporte', units: 10.12345678 },
    { id: 'y2', targetType: 'invest', targetId: 'a1', kind: 'resgate', units: 0.12345678 },
  ];
  assert.equal(cryptoCurrentUnits(st, yields), 110);
  assert.equal(cryptoCurrentUnits(st, yields, 'y1'), 99.87654322);
  const btc = { id: 'b1', type: 'Bitcoin', initialUnits: 100000.4 };
  const btcY = [{ id: 'y1', targetType: 'invest', targetId: 'b1', kind: 'aporte', units: 0.4 }];
  assert.equal(cryptoCurrentUnits(btc, btcY), 100001);
  const zera = { id: 'z1', type: 'Stablecoin', initialUnits: 5 };
  const zeraY = [{ id: 'y1', targetType: 'invest', targetId: 'z1', kind: 'resgate', units: 99 }];
  assert.equal(cryptoCurrentUnits(zera, zeraY), 0);
});

test('renda fixa: movimentações somam com sinal; initialValue presente deriva saldo', () => {
  const rf = { id: 'rf1', type: 'Renda Fixa', initialValue: 1000, value: 1000 };
  const yields = [
    { id: 'y1', targetType: 'invest', targetId: 'rf1', kind: 'aporte', amount: 200 },
    { id: 'y2', targetType: 'invest', targetId: 'rf1', kind: 'rendimento', amount: 50.25 },
    { id: 'y3', targetType: 'invest', targetId: 'rf1', kind: 'resgate', amount: 100 },
  ];
  assert.equal(fixedIncomeMovementTotal(rf, yields), 150.25);
  assert.equal(fixedIncomeInitialValue(rf, yields), 1000);
  assert.equal(fixedIncomeCurrentValue(rf, yields), 1150.25);
  const legado = { id: 'rf2', type: 'Renda Fixa', value: 500 };
  assert.equal(fixedIncomeInitialValue(legado, []), 500);
  assert.equal(fixedIncomeCurrentValue(legado, []), 500);
});

test('renda fixa: saldo corrente nunca fica negativo', () => {
  const rf = { id: 'rf1', type: 'Renda Fixa', initialValue: 100, value: 100 };
  const yields = [{ id: 'y1', targetType: 'invest', targetId: 'rf1', kind: 'resgate', amount: 500 }];
  assert.equal(fixedIncomeCurrentValue(rf, yields), 0);
});

test('investmentDisplayValue: RF usa saldo corrente; crypto com value positivo usa value; senão unidades×cotação', () => {
  const rf = { id: 'rf1', type: 'Renda Fixa', initialValue: 1000, value: 1000 };
  const rfY = [{ id: 'y1', targetType: 'invest', targetId: 'rf1', kind: 'rendimento', amount: 40 }];
  assert.equal(investmentDisplayValue(rf, rfY), 1040);
  const st = { id: 'a1', type: 'Stablecoin', initialUnits: 10, value: 51, price: 5.1 };
  assert.equal(investmentDisplayValue(st, []), 51);
  const zero = { id: 'a2', type: 'Stablecoin', initialUnits: 10, value: 0, price: 5.1 };
  assert.equal(investmentDisplayValue(zero, []), 51);
});

test('investmentsTotal: soma RF + crypto + outros; espelha totalInvestBalance', () => {
  const rf = { id: 'rf1', type: 'Renda Fixa', initialValue: 1000, value: 1000 };
  const st = { id: 'a1', type: 'Stablecoin', initialUnits: 10, value: 51, price: 5.1 };
  const out = { id: 'o1', type: 'Outros', value: 250, initialValue: null };
  const rfY = [{ id: 'y1', targetType: 'invest', targetId: 'rf1', kind: 'rendimento', amount: 40 }];
  assert.equal(investmentsTotal([rf, st, out], rfY), 1000 + 40 + 51 + 250);
  assert.equal(investmentsTotal([], []), 0);
  const btc = { id: 'b1', type: 'Bitcoin', initialUnits: 100000, value: 650, price: 650000 };
  assert.equal(investmentsTotal([btc], []), 650);
});

test('rentability: sem rendimentos retorna null; positivo e negativo calculam pct sobre base', () => {
  const st = { id: 'a1', type: 'Stablecoin' };
  assert.equal(rentability(st, [], 51), null);
  const pos = [
    { id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'rendimento', amount: 50 },
    { id: 'y2', targetType: 'invest', targetId: 'a1', kind: 'aporte', amount: 100 },
  ];
  const r = rentability(st, pos, 150);
  assert.equal(r.totalYield, 50);
  assert.ok(Math.abs(r.pct - 50) < 1e-9);
  const neg = [
    { id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'rendimento', amount: -25 },
  ];
  const rn = rentability(st, neg, 100);
  assert.equal(rn.totalYield, -25);
  assert.ok(Math.abs(rn.pct - (-25 / 125) * 100) < 1e-9);
});

test('rentability: base <= 0 deixa pct nulo', () => {
  const st = { id: 'a1', type: 'Stablecoin' };
  const ys = [{ id: 'y1', targetType: 'invest', targetId: 'a1', kind: 'rendimento', amount: 20 }];
  const r = rentability(st, ys, 10);
  assert.equal(r.totalYield, 20);
  assert.equal(r.pct, null);
});

test('cenario de integração: stablecoin com aporte+resgate+rendimento', () => {
  const asset = { id: 'inv1', type: 'Stablecoin', initialUnits: 12.5, value: 63.75, price: 5.1 };
  const yields = [
    { id: 'y1', targetType: 'invest', targetId: 'inv1', kind: 'aporte', units: 10, price: 5.1, amount: 51 },
    { id: 'y2', targetType: 'invest', targetId: 'inv1', kind: 'rendimento', units: 5, price: 5.2, amount: 26 },
    { id: 'y3', targetType: 'invest', targetId: 'inv1', kind: 'resgate', units: 3, price: 5.3, amount: 15.9 },
  ];
  assert.equal(cryptoMovementTotal(asset, yields), 12);
  assert.equal(cryptoCurrentUnits(asset, yields), 24.5);
  const display = investmentDisplayValue({ ...asset, value: 0 }, yields);
  assert.ok(Math.abs(display - 24.5 * 5.1) < 1e-9);
  const r = rentability(asset, yields, display);
  assert.equal(r.totalYield, 26);
});

test('normalizeInstitutionKey: trim + lowercase + vazio reservado', () => {
  assert.equal(normalizeInstitutionKey(' Nubank '), 'nubank');
  assert.equal(normalizeInstitutionKey('NUBANK'), 'nubank');
  assert.equal(normalizeInstitutionKey('nubank'), 'nubank');
  assert.equal(normalizeInstitutionKey('  XP Investimentos  '), 'xp investimentos');
  assert.equal(normalizeInstitutionKey(''), 'sem-instituicao');
  assert.equal(normalizeInstitutionKey('   '), 'sem-instituicao');
  assert.equal(normalizeInstitutionKey(null), 'sem-instituicao');
  assert.equal(normalizeInstitutionKey(undefined), 'sem-instituicao');
});

test('groupInvestmentsByInstitution: agrupa por chave normalizada, preserva ordem e cria grupo sem instituição', () => {
  const invs = [
    { id: 'i1', institution: ' Nubank ' },
    { id: 'i2', institution: 'NUBANK' },
    { id: 'i3', institution: 'nubank' },
    { id: 'i4', institution: '' },
    { id: 'i5', institution: 'XP Investimentos' },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0], { key: 'nubank', label: 'Nubank', investments: [invs[0], invs[1], invs[2]] });
  assert.equal(groups[0].investments.length, 3);
  assert.equal(groups[1].key, 'sem-instituicao');
  assert.equal(groups[1].label, 'Sem instituição');
  assert.equal(groups[1].investments.length, 1);
  assert.equal(groups[2].key, 'xp investimentos');
  assert.equal(groups[2].label, 'XP Investimentos');
});

test('groupInvestmentsByInstitution: preserva ordem original dentro do grupo', () => {
  const invs = [
    { id: 'a', institution: 'Binance' },
    { id: 'b', institution: 'Nubank' },
    { id: 'c', institution: 'Binance' },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].key, 'binance');
  assert.deepEqual(
    groups[0].investments.map((i) => i.id),
    ['a', 'c']
  );
  assert.equal(groups[1].key, 'nubank');
  assert.equal(groups[1].investments.length, 1);
});

test('groupInvestmentsByInstitution: lista vazia / entrada não array', () => {
  assert.deepEqual(groupInvestmentsByInstitution([]), []);
  assert.deepEqual(groupInvestmentsByInstitution(null), []);
});

/* ===== NOVOS TESTES DE AGRUPAMENTO DETERMINÍSTICO (não dependem de fixtures) ===== */

test('agrupamento controlado: Nubank (2) + XP (1) = 2 institution-cards', () => {
  const invs = [
    { id: 'i1', institution: 'Nubank', type: 'Stablecoin', value: 100 },
    { id: 'i2', institution: 'Nubank', type: 'Stablecoin', value: 200 },
    { id: 'i3', institution: 'XP', type: 'Renda Fixa', initialValue: 500, value: 500 },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 2);
  const nubank = groups.find(g => g.key === 'nubank');
  const xp = groups.find(g => g.key === 'xp');
  assert.ok(nubank, 'grupo Nubank deve existir');
  assert.ok(xp, 'grupo XP deve existir');
  assert.equal(nubank.investments.length, 2);
  assert.equal(xp.investments.length, 1);
  assert.deepEqual(nubank.investments.map(i => i.id).sort(), ['i1', 'i2']);
  assert.equal(xp.investments[0].id, 'i3');
  // nenhum investimento duplicado nem fora de grupo
  const allIds = groups.flatMap(g => g.investments.map(i => i.id));
  assert.deepEqual(allIds.sort(), ['i1', 'i2', 'i3']);
});

test('agrupamento: normalização trim+lowercase — " Nubank " e "nubank" são o mesmo grupo', () => {
  const invs = [
    { id: 'i1', institution: ' Nubank ' },
    { id: 'i2', institution: 'nubank' },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'nubank');
  assert.equal(groups[0].investments.length, 2);
});

test('agrupamento: instituição vazia/espaços → "Sem instituição"', () => {
  const invs = [
    { id: 'i1', institution: '' },
    { id: 'i2', institution: '   ' },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'sem-instituicao');
  assert.equal(groups[0].label, 'Sem instituição');
  assert.equal(groups[0].investments.length, 2);
});

test('agrupamento: instituição com acento, apóstrofo e aspas', () => {
  const invs = [
    { id: 'i1', institution: 'Itaú Unibanco', type: 'Stablecoin', value: 100 },
    { id: 'i2', institution: "Banco do João's", type: 'Stablecoin', value: 100 },
    { id: 'i3', institution: 'Banco "X"', type: 'Stablecoin', value: 100 },
  ];
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 3);
  // chaves seguras (trim+lowercase)
  const keys = groups.map(g => g.key).sort();
  assert.ok(keys.includes(normalizeInstitutionKey('Itaú Unibanco')));
  assert.ok(keys.includes(normalizeInstitutionKey("Banco do João's")));
  assert.ok(keys.includes(normalizeInstitutionKey('Banco "X"')));
  // labels preservam caracteres originais
  const labels = groups.map(g => g.label).sort();
  assert.deepEqual(labels, ["Banco \"X\"", "Banco do João's", 'Itaú Unibanco']);
});

test('agrupamento: soma dos totais dos grupos === total global (invariant arredondamento do domínio)', () => {
  // total global usa investmentDisplayValue; grupos somam cada investmentDisplayValue individual
  const invs = [
    { id: 'i1', institution: 'Nubank', type: 'Stablecoin', initialUnits: 10, value: 51, price: 5.1 },
    { id: 'i2', institution: 'Nubank', type: 'Renda Fixa', initialValue: 1000, value: 1000 },
    { id: 'i3', institution: 'XP', type: 'Stablecoin', initialUnits: 5, value: 25.5, price: 5.1 },
  ];
  // yields vazios → display value = value (stablecoin) ou initialValue+movements (RF)
  const yields = [
    { id: 'y1', targetType: 'invest', targetId: 'i1', kind: 'rendimento', amount: 5 },
    { id: 'y2', targetType: 'invest', targetId: 'i2', kind: 'rendimento', amount: 20 },
  ];
  // global
  const global = investmentsTotal(invs, yields);
  // por grupo
  const groups = groupInvestmentsByInstitution(invs);
  const groupSum = groups.reduce((sum, g) => {
    return sum + g.investments.reduce((s, inv) => s + investmentDisplayValue(inv, yields), 0);
  }, 0);
  // regra: arredondamento por item (como o domínio faz) → comparação exata
  assert.equal(global, groupSum);
});

test('agrupamento: rename — filtro por chave normalizada afeta só o grupo correto', () => {
  const invs = [
    { id: 'i1', institution: 'Nubank', type: 'Stablecoin', value: 100 },
    { id: 'i2', institution: 'Nubank', type: 'Stablecoin', value: 200 },
    { id: 'i3', institution: 'XP', type: 'Renda Fixa', initialValue: 500, value: 500 },
  ];
  const key = normalizeInstitutionKey('Nubank');
  // simula edição: altera institution dos itens cujo key normalizado === 'nubank'
  const changed = [];
  for (const inv of invs) {
    if (normalizeInstitutionKey(inv.institution) === key) {
      inv.institution = 'NuBank Renomeado';
      changed.push(inv.id);
    }
  }
  assert.deepEqual(changed.sort(), ['i1', 'i2']);
  // XP intocado
  assert.equal(invs.find(i => i.id === 'i3').institution, 'XP');
  // re-agrupa
  const groups = groupInvestmentsByInstitution(invs);
  assert.equal(groups.length, 2);
  const nu = groups.find(g => g.key === normalizeInstitutionKey('NuBank Renomeado'));
  const xp = groups.find(g => g.key === 'xp');
  assert.equal(nu.investments.length, 2);
  assert.equal(xp.investments.length, 1);
});
