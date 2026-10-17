'use strict';

/* Oráculo independente de investimentos — espelha a semântica do app sem
   tocar em DOM/Firestore. Usado pelos testes node:test e pela spec Playwright
   para tripla conferência (oracle × UI × Firestore).

   Espelhado de:
   - js/18-render-core.js: isCryptoType, isBitcoinType, cryptoValueFromUnits,
     cryptoMovementTotal, cryptoInitialUnits, cryptoCurrentUnits,
     rentabilityHTML (apenas o cálculo);
   - js/24-automation-render.js: movementDelta, fixedIncomeMovementTotal,
     fixedIncomeInitialValue, fixedIncomeCurrentValue;
   - js/17-sync-persistence.js: totalInvestBalance;
   - js/99-init.js: save (initialUnits, finalUnits, initialValue) e imSalvar.

   "yields" é a lista completa de movimentações (yieldsLog); o oráculo filtra
   internamente por targetType==='invest' e targetId. Não aplica filtro de
   período — quem chama deve passar a lista já recortada ou aceitar todos. */

const SATS_PER_BTC = 1e8;

function isCryptoType(type) {
  return type === 'Stablecoin' || type === 'Criptomoeda' || type === 'Bitcoin';
}

function isBitcoinType(type) {
  return type === 'Bitcoin';
}

function cryptoValueFromUnits(type, units, pricePerUnit) {
  const u = Number(units);
  const p = Number(pricePerUnit);
  if (!Number.isFinite(u) || !Number.isFinite(p)) return 0;
  if (isBitcoinType(type)) return (u / SATS_PER_BTC) * p;
  return u * p;
}

function yieldsForAsset(asset, yields, excludeId) {
  const id = asset && asset.id;
  return (Array.isArray(yields) ? yields : [])
    .filter((y) => y && y.targetType === 'invest' && y.targetId === id && y.id !== excludeId);
}

function movementDelta(y) {
  const amount = Number(y && y.amount) || 0;
  return (y && y.kind === 'resgate' ? -1 : 1) * amount;
}

function cryptoMovementTotal(asset, yields, excludeId) {
  const total = yieldsForAsset(asset, yields, excludeId)
    .filter((y) => y.units != null)
    .reduce((sum, y) => sum + (y.kind === 'resgate' ? -1 : 1) * (Number(y.units) || 0), 0);
  return Number(total.toFixed(8));
}

function cryptoInitialUnits(asset, yields) {
  if (!asset) return 0;
  const raw = Number(asset.initialUnits);
  if (Number.isFinite(raw)) return raw;
  return Number(asset.units || 0) - cryptoMovementTotal(asset, yields);
}

function cryptoCurrentUnits(asset, yields, excludeId) {
  const current = Math.max(0, cryptoInitialUnits(asset, yields) + cryptoMovementTotal(asset, yields, excludeId));
  return isBitcoinType(asset && asset.type) ? Math.round(current) : Number(current.toFixed(8));
}

function fixedIncomeMovementTotal(asset, yields) {
  return yieldsForAsset(asset, yields)
    .reduce((sum, y) => sum + movementDelta(y), 0);
}

function fixedIncomeInitialValue(asset, yields) {
  if (!asset) return 0;
  const raw = Number(asset.initialValue);
  if (Number.isFinite(raw)) return raw;
  return Number(asset.value || 0) - fixedIncomeMovementTotal(asset, yields);
}

function fixedIncomeCurrentValue(asset, yields) {
  return Math.max(0, fixedIncomeInitialValue(asset, yields) + fixedIncomeMovementTotal(asset, yields));
}

/* displayVal de renderInvestments: RF usa fixedIncomeCurrentValue; os demais
   usam value quando positivo, senão recomputam por unidades × cotação. */
function investmentDisplayValue(asset, yields) {
  if (!asset) return 0;
  if (asset.type === 'Renda Fixa') return fixedIncomeCurrentValue(asset, yields);
  const v = Number(asset.value);
  if (Number.isFinite(v) && v > 0) return v;
  return cryptoValueFromUnits(asset.type, cryptoCurrentUnits(asset, yields), asset.price || 0);
}

/* totalInvestBalance: para não-RF usa value, mas cai para unidades quando o
   valor é não-negativo-inválido ou zero com unidades e cotação presentes. */
function investmentsTotal(assets, yields) {
  return (Array.isArray(assets) ? assets : []).reduce((sum, i) => {
    if (!i) return sum;
    if (i.type === 'Renda Fixa') return sum + fixedIncomeCurrentValue(i, yields);
    let v = Number(i.value);
    const units = cryptoCurrentUnits(i, yields);
    if (!(v >= 0) || (v === 0 && isCryptoType(i.type) && units > 0 && Number(i.price) > 0)) {
      v = cryptoValueFromUnits(i.type, units, i.price || 0);
    }
    return sum + (Number(v) || 0);
  }, 0);
}

/* Cálculo puro de rentabilityHTML. Retorna null quando não há rendimentos
   (UI oculta o box) ou { totalYield, pct } com pct nulo se base <= 0. */
function rentability(asset, yields, currentValue) {
  const items = yieldsForAsset(asset, yields)
    .filter((y) => (y.kind || 'rendimento') === 'rendimento');
  if (items.length === 0) return null;
  const totalYield = items.reduce((s, y) => s + (Number(y.amount) || 0), 0);
  const baseValue = Number(currentValue) - totalYield;
  const pct = baseValue > 0 ? (totalYield / baseValue) * 100 : null;
  return { totalYield, pct };
}

module.exports = {
  SATS_PER_BTC,
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
};
