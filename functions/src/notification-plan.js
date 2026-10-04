if (typeof process !== "undefined" && process.env) {
  process.env.TZ = process.env.TZ || "America/Sao_Paulo";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function daysBetween(fromISO, toISO) {
  const from = Date.parse(String(fromISO || "").slice(0, 10) + "T00:00:00Z");
  const to = Date.parse(String(toISO || "").slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86400000);
}

function addDaysISO(iso, days) {
  const base = Date.parse(String(iso || "").slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(base)) return null;
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value) || 0);
}

function formatBRDate(iso) {
  const parts = String(iso || "").slice(0, 10).split("-");
  if (parts.length !== 3) return String(iso || "");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function duePhrase(diff) {
  if (diff < 0) {
    const days = Math.abs(diff);
    return `vencido há ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  if (diff === 0) return "vence hoje";
  if (diff === 1) return "vence amanhã";
  return `vence em ${diff} dias`;
}

function billAppliesToMonth(bill, year, month) {
  if (!bill.active) return false;
  if (bill.recurrenceType === "nao_recorrente" || bill.frequency === "once") {
    const oneDate = bill.startDate ? new Date(bill.startDate + "T00:00:00") : null;
    return !!oneDate && oneDate.getFullYear() === year && oneDate.getMonth() === month;
  }
  const start = bill.startDate ? new Date(bill.startDate + "T00:00:00") : null;
  const end = bill.endDate ? new Date(bill.endDate + "T23:59:59") : null;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
  return (!start || monthEnd >= start) && (!end || monthStart <= end);
}

function billDueDayFromStart(bill) {
  return bill.startDate ? new Date(bill.startDate + "T00:00:00").getDate() : 1;
}

function billDueDateForMonth(bill, year, month) {
  if (bill.recurrenceType === "nao_recorrente" || bill.frequency === "once") {
    return bill.startDate || `${year}-${pad2(month + 1)}-01`;
  }
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(Math.max(billDueDayFromStart(bill), 1), lastDay);
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function billGeneratedForMonth(bill, key) {
  return Array.isArray(bill.generatedMonths) && bill.generatedMonths.includes(key);
}

function billPaidForMonth(bill, key) {
  return Array.isArray(bill.paidMonths) && bill.paidMonths.includes(key);
}

function buildPushNotificationPlan(options = {}) {
  const items = [];
  const today = String(options.today || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return items;
  const advanceRaw = Number(options.advanceDays);
  const advance = Number.isFinite(advanceRaw) ? Math.min(30, Math.max(0, advanceRaw)) : 0;
  const bills = Array.isArray(options.bills) ? options.bills : [];
  const goals = Array.isArray(options.goals) ? options.goals : [];
  const receivables = Array.isArray(options.receivables) ? options.receivables : [];
  const cards = Array.isArray(options.cards) ? options.cards : [];
  const parts = today.split("-").map(Number);
  const year = parts[0];
  const monthIndex = parts[1] - 1;
  const monthKey = `${year}-${pad2(parts[1])}`;

  if (options.reminders !== false) {
    for (const bill of bills) {
      if (!bill || typeof bill !== "object") continue;
      if (!bill.active) continue;
      if (!billAppliesToMonth(bill, year, monthIndex)) continue;
      if (billGeneratedForMonth(bill, monthKey) || billPaidForMonth(bill, monthKey)) continue;
      const due = billDueDateForMonth(bill, year, monthIndex);
      const diff = daysBetween(today, due);
      if (diff === null || diff > advance) continue;
      const name = String(bill.name || "Conta").slice(0, 80);
      items.push({
        tag: `bill:${bill.id || name}:${due}`,
        title: `Conta ${duePhrase(diff)}: ${name}`,
        body: `${formatBRDate(due)} · ${formatBRL(bill.amount)}`
      });
    }
  }

  for (const receivable of receivables) {
    if (!receivable || typeof receivable !== "object") continue;
    if (String(receivable.status || "pendente") !== "pendente") continue;
    const expected = String(receivable.expectedAt || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expected)) continue;
    const diff = daysBetween(today, expected);
    if (diff === null || diff > advance) continue;
    const person = String(receivable.person || "").slice(0, 60);
    const desc = String(receivable.desc || "").slice(0, 80);
    const label = person || desc || "Valor a receber";
    items.push({
      tag: `recv:${receivable.id || label}:${expected}`,
      title: `A receber ${duePhrase(diff)}: ${label}`,
      body: [desc, formatBRL(receivable.amount), formatBRDate(expected)].filter(Boolean).join(" · ")
    });
  }

  for (const goal of goals) {
    if (!goal || typeof goal !== "object") continue;
    if (String(goal.status || "") === "completed") continue;
    const deadline = String(goal.deadline || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) continue;
    const target = Number(goal.targetAmount) || 0;
    const current = Number(goal.currentAmount) || 0;
    if (target > 0 && current >= target) continue;
    const diff = daysBetween(today, deadline);
    if (diff === null || diff > advance) continue;
    const name = String(goal.name || "Meta").slice(0, 80);
    items.push({
      tag: `goal:${goal.id || name}:${deadline}`,
      title: `Meta ${duePhrase(diff)}: ${name}`,
      body: `${formatBRDate(deadline)} · meta ${formatBRL(target)}`
    });
  }

  for (const card of cards) {
    if (!card || typeof card !== "object") continue;
    if (card.active === false) continue;
    const dueDay = Math.min(31, Math.max(1, Number(card.dueDay) || 1));
    const lastThisMonth = new Date(year, parts[1], 0).getDate();
    let candidate = `${year}-${pad2(parts[1])}-${pad2(Math.min(dueDay, lastThisMonth))}`;
    if (candidate < today) {
      const nextYear = parts[1] === 12 ? year + 1 : year;
      const nextMonth = parts[1] === 12 ? 1 : parts[1] + 1;
      const lastNextMonth = new Date(nextYear, nextMonth, 0).getDate();
      candidate = `${nextYear}-${pad2(nextMonth)}-${pad2(Math.min(dueDay, lastNextMonth))}`;
    }
    const diff = daysBetween(today, candidate);
    if (diff === null || diff > advance) continue;
    const name = String(card.name || "Cartão").slice(0, 80);
    items.push({
      tag: `card:${card.id || name}:${candidate}`,
      title: `Fatura ${duePhrase(diff)}: ${name}`,
      body: `Vencimento ${formatBRDate(candidate)}`
    });
  }

  return items;
}

function pruneSentMap(lastSent, today) {
  const source = lastSent && typeof lastSent === "object" ? lastSent : {};
  const cutoff = addDaysISO(today, -45);
  const result = {};
  for (const tag of Object.keys(source)) {
    const sentOn = source[tag];
    if (typeof sentOn === "string" && (!cutoff || sentOn >= cutoff)) result[tag] = sentOn;
  }
  return result;
}

function selectPendingToday(plan, lastSent, today) {
  const sent = lastSent && typeof lastSent === "object" ? lastSent : {};
  return (Array.isArray(plan) ? plan : []).filter((item) => sent[item.tag] !== today);
}

module.exports = {
  buildPushNotificationPlan,
  pruneSentMap,
  selectPendingToday,
  daysBetween,
  addDaysISO,
  duePhrase,
  formatBRL,
  formatBRDate
};
