/* C.O.D.E. — utilitário monetário independente do aplicativo.
   Nenhuma função do LIVRO-CAIXA é importada aqui (regra dos oracles §9). */
'use strict';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/* "R$ 1.000,00", "+ R$ 750,00", "− 250,00" → número */
function parseBRL(text) {
  if (text == null) return NaN;
  let s = String(text).replace(/\u00a0/g, ' ').trim();
  if (!s) return NaN;
  const neg = s.includes('−') || s.startsWith('-');
  s = s.replace(/[^\d.,-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) s = s.replace(/,/g, '');
  else if (lastComma >= 0) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? NaN : neg ? -n : n;
}

/* 1000 → "1.000,00" (pt-BR, sem símbolo) */
function formatBRL(n) {
  const fixed = round2(n).toFixed(2);
  const [int, dec] = fixed.split('.');
  const neg = int.startsWith('-');
  const digits = neg ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${grouped},${dec}`;
}

module.exports = { round2, parseBRL, formatBRL };
