'use strict';

const { round2 } = require('./money');

function goalRemaining(target, current) {
  const t = Number(target) || 0;
  const c = Number(current) || 0;
  return round2(Math.max(0, t - c));
}

function goalProgressPercent(target, current) {
  const t = Number(target) || 0;
  if (!(t > 0)) return 0;
  const c = Number(current) || 0;
  return Math.min(100, Math.max(0, (c / t) * 100));
}

function goalProgressLabel(target, current) {
  return `${goalProgressPercent(target, current).toFixed(0)}%`;
}

const GOAL_STATUS_LABELS = {
  active: 'Ativa',
  completed: 'Concluída',
  paused: 'Pausada',
  cancelled: 'Cancelada',
};

function goalStatusLabel(status) {
  return GOAL_STATUS_LABELS[status] || 'Ativa';
}

/* Rótulo PT-BR → status canônico. Espelho de goalStatusLabel para que as specs
   possam expressar a espera no formato da UI sem perder o vínculo com o oráculo. */
function goalStatusFromLabel(label) {
  return Object.keys(GOAL_STATUS_LABELS).find((k) => GOAL_STATUS_LABELS[k] === label) || 'active';
}

/* Regra de status esperada ao salvar (independente do app):
   - meta vinculada em Ativa com atual >= alvo (>0) → Concluída;
   - salvar Concluída com atual < alvo → reabre Ativa;
   - meta pausada/cancelada nunca conclui sozinha; meta sem fonte nunca conclui. */
function goalSaveStatus(status, { target, current, linked }) {
  const t = Number(target) || 0;
  const c = Number(current) || 0;
  let next = status || 'active';

  // Regra 1: Se meta vinculada, está ativa E atual >= alvo → Concluída
  if (linked && next === 'active' && c >= t && t > 0) {
    next = 'completed';
  }

  // Regra 2: Se estava Concluída e atual < alvo → reabrir Ativa
  if (next === 'completed' && c < t && t > 0) {
    next = 'active';
  }

  return next;
}

function goalDaysRemaining(today, deadline) {
  if (!deadline) return null;
  const toUTC = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const start = toUTC(today);
  const end = toUTC(deadline);
  return Math.ceil((end - start) / 86400000);
}

function goalDeadlineLabel(deadline) {
  if (!deadline) return null;
  const [y, m, d] = String(deadline).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(deadline);
}

module.exports = {
  goalRemaining,
  goalProgressPercent,
  goalProgressLabel,
  goalStatusLabel,
  goalStatusFromLabel,
  goalSaveStatus,
  goalDaysRemaining,
  goalDeadlineLabel,
};
