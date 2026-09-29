'use strict';

const { round2 } = require('./money');

function movementDelta(movement = {}) {
  const amount = Number(movement.amount) || 0;
  return movement.kind === 'resgate' ? -amount : amount;
}

function pocketBalance(pocket = {}) {
  const initial = Number(pocket.initial) || 0;
  const movements = Array.isArray(pocket.movements) ? pocket.movements : [];
  return round2(movements.reduce((total, movement) => total + movementDelta(movement), initial));
}

function pocketProgress(balance, goalAmount) {
  const goal = Number(goalAmount) || 0;
  if (goal <= 0) return null;
  const percent = ((Number(balance) || 0) / goal) * 100;
  return Math.min(100, Math.max(0, percent));
}

function progressLabel(balance, goalAmount) {
  const percent = pocketProgress(balance, goalAmount);
  return percent == null ? null : `${percent.toFixed(0)}%`;
}

function pocketsTotal(pockets = []) {
  return round2(pockets.reduce((total, pocket) => total + pocketBalance(pocket), 0));
}

module.exports = { pocketBalance, pocketProgress, progressLabel, pocketsTotal };
