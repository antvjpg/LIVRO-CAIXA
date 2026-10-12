/* LIVRO-CAIXA · js/13-backup.js — backup e restauração (app.js: 719-788). Separação por responsabilidade; conteúdo preservado. */


  /* [JS 07] BACKUP / IMPORTAÇÃO / EXPORTAÇÃO / DIAGNÓSTICOS */
  function markSingleActionButtons() {
    ['fSalvar','bSalvar','cSalvar','tSalvar','iSalvar','pSalvar','pmSalvar','imSalvar','importConfirm','btnFetchPrice','imFetchPrice','btnUpdateAllPrices','btnExportBackup','billSalvar','cardSalvar','purchaseSalvar','btnOcrReviewConfirm'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.dataset.singleAction = '1';
    });
  }

  function buildBackupPayload() {
    return {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      app: 'livro-caixa',
      exportedAt: new Date().toISOString(),
      data: { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, invoiceLaunches, cards, purchases, featureSettings, diagnosticLog: diagnosticLog.slice(0, LOG_LIMIT) }
    };
  }

  function isValidBackupPayload(payload) {
    if (!payload || typeof payload !== 'object') return false;
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const required = ['banks','categories','entries'];
    if (!required.every(k => Array.isArray(data[k]))) return false;
    if (payload.schemaVersion != null && (!Number.isInteger(payload.schemaVersion) || payload.schemaVersion < 1 || payload.schemaVersion > BACKUP_SCHEMA_VERSION)) return false;
    const optional = ['investments','pockets','yieldsLog','recurringBills','receivables','budgets','goals','cards','purchases','invoiceLaunches','diagnosticLog'];
    if (optional.some(k => data[k] != null && !Array.isArray(data[k]))) return false;
    if (data.featureSettings != null && (typeof data.featureSettings !== 'object' || Array.isArray(data.featureSettings))) return false;
    return true;
  }

  function extractBackupData(payload) {
    const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    return {
      banks: Array.isArray(data.banks) ? data.banks : [],
      categories: Array.isArray(data.categories) ? data.categories : [],
      entries: Array.isArray(data.entries) ? data.entries : [],
      investments: Array.isArray(data.investments) ? data.investments : [],
      pockets: Array.isArray(data.pockets) ? data.pockets : [],
      yieldsLog: Array.isArray(data.yieldsLog) ? data.yieldsLog : [],
      recurringBills: Array.isArray(data.recurringBills) ? data.recurringBills : [],
      receivables: Array.isArray(data.receivables) ? data.receivables : [],
      budgets: Array.isArray(data.budgets) ? data.budgets : [],
      featureSettings: data.featureSettings && typeof data.featureSettings === 'object' ? data.featureSettings : null,
      goals: Array.isArray(data.goals) ? data.goals : [],
      invoiceLaunches: Array.isArray(data.invoiceLaunches) ? data.invoiceLaunches : [],
      cards: Array.isArray(data.cards) ? data.cards : [],
      purchases: Array.isArray(data.purchases) ? data.purchases : [],
      diagnosticLog: Array.isArray(data.diagnosticLog) ? data.diagnosticLog : []
    };
  }

  function sanitizeBackupData(data) {
    const dropped = { banks: 0, categories: 0, entries: 0, investments: 0, pockets: 0, recurringBills: 0, budgets: 0, cards: 0, purchases: 0 };
    const banks = data.banks.filter(b => {
      const ok = b && typeof b === 'object' && typeof b.id === 'string' && b.id && typeof b.name === 'string' && b.name.trim();
      if (!ok) dropped.banks++;
      return ok;
    });
    const categories = data.categories.filter(c => {
      const ok = c && typeof c === 'object' && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim();
      if (!ok) dropped.categories++;
      return ok;
    });
    const entries = data.entries.filter(e => {
      const ok = e && typeof e === 'object' && typeof e.id === 'string' && e.id
        && typeof e.desc === 'string' && e.desc.trim()
        && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
        && typeof e.amount === 'number' && isFinite(e.amount) && e.amount > 0
        && (e.type === 'in' || e.type === 'out');
      if (!ok) dropped.entries++;
      return ok;
    });
    const investments = data.investments.filter(i => {
      const ok = i && typeof i === 'object' && typeof i.id === 'string' && i.id && typeof i.name === 'string' && i.name.trim()
        && typeof i.value === 'number' && isFinite(i.value) && i.value >= 0;
      if (!ok) dropped.investments++;
      return ok;
    });
    const pockets = data.pockets.filter(p => {
      const ok = p && typeof p === 'object' && typeof p.id === 'string' && p.id && typeof p.name === 'string' && p.name.trim()
        && typeof p.initial === 'number' && isFinite(p.initial) && p.initial >= 0;
      if (!ok) dropped.pockets++;
      return ok;
    });
    const yieldsLog = Array.isArray(data.yieldsLog) ? data.yieldsLog.filter(y => y && typeof y === 'object' && typeof y.id === 'string' && y.id) : [];
    const budgets = (Array.isArray(data.budgets) ? data.budgets : []).filter(b => {
      const ok = b && typeof b === 'object' && typeof b.id === 'string' && b.id && typeof b.categoryId === 'string' && b.categoryId && typeof b.month === 'string' && /^\d{4}-\d{2}$/.test(b.month) && Number.isFinite(Number(b.amount)) && Number(b.amount) >= 0;
      if (!ok) dropped.budgets++;
      return ok;
    }).map(b => ({ ...b, amount: Number(b.amount) }));
    const cards = (Array.isArray(data.cards) ? data.cards : []).filter(c => {
      const ok = c && typeof c === 'object' && typeof c.id === 'string' && c.id && typeof c.name === 'string' && c.name.trim()
        && Number.isInteger(Number(c.closingDay)) && Number(c.closingDay) >= 1 && Number(c.closingDay) <= 31
        && Number.isInteger(Number(c.dueDay)) && Number(c.dueDay) >= 1 && Number(c.dueDay) <= 31;
      if (!ok) dropped.cards++;
      return ok;
    });
    const cardIds = new Set(cards.map(c => c.id));
    const purchases = (Array.isArray(data.purchases) ? data.purchases : []).filter(p => {
      const ok = p && typeof p === 'object' && typeof p.id === 'string' && p.id && typeof p.cardId === 'string' && cardIds.has(p.cardId)
        && typeof p.description === 'string' && p.description.trim() && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
        && Number.isFinite(Number(p.totalValue)) && Number(p.totalValue) > 0
        && (p.paymentType === 'avista' || p.paymentType === 'parcelado');
      if (!ok) dropped.purchases++;
      return ok;
    });
    const diagnosticLog = data.diagnosticLog.filter(item => item && typeof item === 'object' && typeof item.type === 'string' && typeof item.module === 'string').slice(0, LOG_LIMIT);
    return { data: { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables: Array.isArray(data.receivables) ? data.receivables : [], budgets, goals: data.goals || [], invoiceLaunches: Array.isArray(data.invoiceLaunches) ? data.invoiceLaunches : [], cards, purchases, featureSettings: data.featureSettings || null, diagnosticLog }, dropped };
  }
