

/* LIVRO-CAIXA · js/18-render-core.js — renderização principal e views (app.js: 2416-4290). Separação por responsabilidade; conteúdo preservado. */

/* Handlers seguros dos grupos de instituição.
   Nunca interpolam o nome da instituição (dado do usuário) em inline-JS ou
   seletores CSS. Recebem o elemento do botão e leem o identificador seguro
   armazenado em data-institution-key (valor escapado no atributo HTML, lido
   de volta via getAttribute). */

function instToggle(btn) {
  const key = btn.getAttribute('data-institution-key') || '';
  toggleInvestmentsInstitutionView(key);
}

function instEdit(btn) {
  const key = btn.getAttribute('data-institution-key') || '';
  editInstitution(btn, key);
}

function editInstitution(btn, key) {
  const article = btn.closest('.institution-card');
  if (!article) { console.error('[instituição] grupo não encontrado', key); return; }
  const h3 = article.querySelector('.institution-card-heading h3');
  const current = h3 ? (h3.textContent || '').trim() : key;
  const raw = prompt('Nova instituição:', current);
  if (raw === null) return;
  const newName = String(raw).trim();
  if (!newName) { alert('Nome não pode ser vazio.'); return; }
  if (newName === current) return;
  if (!Array.isArray(window.investments)) { console.error('[instituição] coleção não disponível'); return; }
  const matches = window.investments.filter(inv => inv && normalizeInstitutionKey(inv.institution) === key);
  if (!matches.length) { alert('Nenhum investimento pertencia a essa instituição.'); return; }
  if (!window.confirm('Renomear "' + current + '" para "' + newName + '"?\nIsso alterará ' + matches.length + ' investimento(s) desta instituição.')) return;
  const changed = [];
  for (const inv of window.investments) {
    if (!inv) continue;
    if (normalizeInstitutionKey(inv.institution) === key) {
      inv.institution = newName;
      changed.push(inv.id);
    }
  }
  window.investments = sortDisplayOrder(window.investments);
  saveInvestments().then(() => {
    logInfo('Instituições', 'Renomear instituição', 'Sucesso', changed.length + ' investimento(s) atualizado(s) para "' + newName + '".');
    render();
  }).catch(err => { console.error('[instituição] rename persist failed', err); alert('Não foi possível salvar a renomeação. Tente novamente.'); });
}


  /* [JS 08] RENDERIZAÇÃO / VIEWS */
  let patrimonySparklineInstance;

  let PATRIMONY_SPARK_STORAGE_KEY;

  let patrimonySparkVisible;

  function renderPatrimonySparkline(enabled) {
    if (patrimonySparklineInstance) {
      patrimonySparklineInstance.destroy();
      patrimonySparklineInstance = null;
    }
    const canvas = document.getElementById('patrimonySparkline');
    if (!enabled || !patrimonySparkVisible || !canvas) return;
    const series = dashboardMonthSeries(6);
    const styles = getComputedStyle(document.body);
    const readVar = (name, fallbackValue) => styles.getPropertyValue(name).trim() || fallbackValue;
    const toRgb = (value) => {
      const v = String(value || '').trim();
      let match = v.match(/^#([0-9a-fA-F]{6})$/);
      if (match) {
        const n = parseInt(match[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      match = v.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    };
    const luminance = (rgb) => {
      const channel = (value) => {
        const s = value / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    };
    const contrastRatio = (a, b) => {
      const la = luminance(a);
      const lb = luminance(b);
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const toHex = (rgb) => '#' + rgb.map(value => value.toString(16).padStart(2, '0')).join('');
    const card = canvas.closest('.balance-card');
    const cardStyles = card ? getComputedStyle(card) : styles;
    const bgStops = Array.from(String(cardStyles.backgroundImage).matchAll(/rgba?\([^)]+\)/g), match => toRgb(match[0])).filter(Boolean);
    const bgSolid = toRgb(cardStyles.backgroundColor);
    const bgRgbs = bgStops.length ? bgStops : (bgSolid ? [bgSolid] : [[28, 43, 36]]);
    const meanBg = bgRgbs.reduce((acc, rgb) => [acc[0] + rgb[0], acc[1] + rgb[1], acc[2] + rgb[2]], [0, 0, 0]).map(value => Math.round(value / bgRgbs.length));
    const byContrast = (a, b) => contrastRatio(b, meanBg) - contrastRatio(a, meanBg);
    const hueCandidates = [readVar('--accent', ''), readVar('--gold', ''), readVar('--green', '')].map(toRgb).filter(Boolean).sort(byContrast);
    const anchorCandidates = [readVar('--paper', ''), readVar('--ink', '')].map(toRgb).filter(Boolean).sort(byContrast);
    const chosen = hueCandidates.find(rgb => contrastRatio(rgb, meanBg) >= 3)
      || anchorCandidates.find(rgb => contrastRatio(rgb, meanBg) >= 3)
      || hueCandidates[0]
      || anchorCandidates[0]
      || [176, 141, 62];
    const lineColor = toHex(chosen);
    const values = series.map(item => Number(item.patrimony || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, 1);
    patrimonySparklineInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: series.map(item => item.label),
        datasets: [{
          data: values,
          borderColor: lineColor,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            if (!chart.chartArea) return lineColor + '2E';
            const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
            gradient.addColorStop(0, lineColor + '59');
            gradient.addColorStop(1, lineColor + '0A');
            return gradient;
          },
          pointRadius: 3,
          pointHoverRadius: 5,
          pointHitRadius: 10,
          pointBorderWidth: 0,
          pointBackgroundColor: lineColor,
          pointHoverBackgroundColor: lineColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: items => (items && items.length && series[items[0].dataIndex] ? series[items[0].dataIndex].label : ''),
              label: context => ' ' + fmt(context.parsed.y)
            }
          }
        },
        scales: {
          x: { display: false },
          y: { display: false, min: min - pad, max: max + pad }
        }
      }
    });
  }

  function togglePatrimonySparkline() {
    patrimonySparkVisible = !patrimonySparkVisible;
    try {
      localStorage.setItem(PATRIMONY_SPARK_STORAGE_KEY, patrimonySparkVisible ? '1' : '0');
    } catch (error) { /* armazenamento indisponível: estado vale só para a sessão */ }
    const symbol = document.querySelector('#balanceStrip .balance-card.total .balance-symbol');
    const box = document.getElementById('patrimonySparkBox');
    if (symbol) {
      symbol.setAttribute('aria-expanded', String(patrimonySparkVisible));
      symbol.setAttribute('aria-label', patrimonySparkVisible ? 'Recolher gráfico do patrimônio' : 'Mostrar gráfico do patrimônio');
    }
    if (box) {
      box.classList.toggle('is-collapsed', !patrimonySparkVisible);
      box.setAttribute('aria-hidden', String(!patrimonySparkVisible));
    }
    if (patrimonySparkVisible) {
      renderPatrimonySparkline(!!currentUser && !!firstLoadDone);
    } else {
      setTimeout(() => { if (!patrimonySparkVisible) renderPatrimonySparkline(false); }, 320);
    }
  }

  function renderBalances() {
    const strip = document.getElementById('balanceStrip');
    if (!strip) return;

    const balancesReady = !!currentUser && !!firstLoadDone;
    const bankTotal = totalBankBalance();
    const investTotal = totalInvestBalance();
    const pocketTotal = totalPocketBalance();
    const totalPatrimonio = bankTotal + pocketTotal + investTotal;
    const flowInsight = monthlyFlowInsight();
    const bankShare = balancesReady ? percentOfTotal(bankTotal, totalPatrimonio) : null;
    const investShare = balancesReady ? percentOfTotal(investTotal, totalPatrimonio) : null;
    const pocketShare = balancesReady ? percentOfTotal(pocketTotal, totalPatrimonio) : null;

    const totalLabel = balancesReady ? fmt(totalPatrimonio) : '—';
    const bankLabel = balancesReady ? fmt(bankTotal) : '—';
    const pocketLabel = balancesReady ? fmt(pocketTotal) : '—';
    const investLabel = balancesReady ? fmt(investTotal) : '—';
    const insightValue = balancesReady ? flowInsight.value : '—';
    const insightDetail = balancesReady ? flowInsight.detail : 'Aguardando dados';

    let html = `
    <div class="balance-card total">
      <div class="balance-card-head"><span class="label">Patrimônio Total</span><span class="balance-symbol" role="button" tabindex="0" aria-expanded="${patrimonySparkVisible}" aria-controls="patrimonySparkBox" aria-label="${patrimonySparkVisible ? 'Recolher gráfico do patrimônio' : 'Mostrar gráfico do patrimônio'}"><i class="fi fi-rr-wallet" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && totalPatrimonio < 0 ? 'neg' : ''}">${totalLabel}</span>
      ${balancesReady ? `<div class="patrimony-spark-box${patrimonySparkVisible ? '' : ' is-collapsed'}" id="patrimonySparkBox" aria-hidden="${!patrimonySparkVisible}"><canvas id="patrimonySparkline" role="img" aria-label="Evolução do patrimônio nos últimos 6 meses"></canvas></div>` : ''}
      <span class="balance-insight is-${balancesReady ? flowInsight.kind : 'neutral'}"><strong>${escapeHTML(insightValue)}</strong><span>${escapeHTML(insightDetail)}</span></span>
    </div>
    <div class="balance-card bank-summary-card" role="button" tabindex="0" aria-label="Ver saldos dos bancos" title="Ver saldos dos bancos">
      <div class="balance-card-head"><span class="label">Bancos</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-bank" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && bankTotal < 0 ? 'neg' : ''}">${bankLabel}</span>
      ${bankShare === null ? '' : `<span class="balance-share">${formatIndicatorPercent(bankShare, 1)} do patrimônio</span>`}
    </div>
    <div class="balance-card pocket-summary-card" role="button" tabindex="0" aria-label="Ver caixinhas" title="Ver caixinhas">
      <div class="balance-card-head"><span class="label">Caixinhas</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-piggy-bank" aria-hidden="true"></i></span></div>
      <span class="amount ${balancesReady && pocketTotal < 0 ? 'neg' : ''}">${pocketLabel}</span>
      ${pocketShare === null ? '' : `<span class="balance-share">${formatIndicatorPercent(pocketShare, 1)} do patrimônio</span>`}
    </div>
    <div class="balance-card invest-summary-card" role="button" tabindex="0" aria-label="Ver investimentos" title="Ver investimentos">
      <div class="balance-card-head"><span class="label" title="Investimentos">Invest.</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-chat-arrow-grow" aria-hidden="true"></i></span></div>
      <span class="amount">${investLabel}</span>
      ${investShare === null ? '' : `<span class="balance-share">${formatIndicatorPercent(investShare, 1)} do patrimônio</span>`}
    </div>`;
    strip.innerHTML = html;
    markValueRefresh(strip);
    renderPatrimonySparkline(balancesReady);
    const sparkToggleSymbol = strip.querySelector('.balance-card.total .balance-symbol');
    sparkToggleSymbol?.addEventListener('click', togglePatrimonySparkline);
    sparkToggleSymbol?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePatrimonySparkline();
      }
    });
    const bankSummaryCard = strip.querySelector('.bank-summary-card');
    const openBankPanel = () => openBankManagementPanel();
    bankSummaryCard?.addEventListener('click', openBankPanel);
    bankSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openBankPanel();
      }
    });
    const pocketSummaryCard = strip.querySelector('.pocket-summary-card');
    const openPocketsTab = () => window.switchTab('pockets');
    pocketSummaryCard?.addEventListener('click', openPocketsTab);
    pocketSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openPocketsTab();
      }
    });
    // P2.4.2 — mesmo padrão de navegação dos cards Contas e Caixinhas
    const investSummaryCard = strip.querySelector('.invest-summary-card');
    const openInvestTab = () => window.switchTab('invest');
    investSummaryCard?.addEventListener('click', openInvestTab);
    investSummaryCard?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInvestTab();
      }
    });
  }

  function getDashboardAlerts() {
    const alerts = [];
    if (banks.length === 0) {
      alerts.push({ icon: '▦', title: 'Adicione uma conta bancária', detail: 'Cadastre um banco para acompanhar seu saldo disponível.' });
    }
    banks.filter(bank => bankBalance(bank.id) < 0).forEach(bank => {
      alerts.push({ icon: '!', title: `${bank.name} está com saldo negativo`, detail: `Saldo atual: ${fmt(bankBalance(bank.id))}.` });
    });
    const cryptoWithoutQuote = investments.filter(inv => isCryptoType(inv.type) && !inv.lastQuoteAt);
    cryptoWithoutQuote.slice(0, 2).forEach(inv => {
      alerts.push({ icon: '↻', title: `Atualize a cotação de ${inv.alias || inv.name}`, detail: 'Este ativo ainda não possui uma atualização de cotação registrada.' });
    });
    if (entries.length === 0 && banks.length > 0) {
      alerts.push({ icon: '+', title: 'Registre seu primeiro lançamento', detail: 'Use “Novo lançamento” para começar a acompanhar suas movimentações.' });
    }
    if (featureSettings.reminders) {
      const key = billMonthKey(new Date());
      recurringBills.filter(bill => billAppliesToMonth(bill, new Date().getFullYear(), new Date().getMonth()) && !billGeneratedForMonth(bill, key) && !billPaidForMonth(bill, key)).slice(0, 3).forEach(bill => {
        const status = billStatus(bill, key);
        alerts.push({ icon: status === 'Atrasado' ? '!' : '◷', title: `${status}: ${bill.name}`, detail: `Vencimento ${billDueDateForMonth(bill, new Date().getFullYear(), new Date().getMonth())} · ${fmt(bill.amount)}` });
      });
      // Alerta antes do fechamento da fatura dos cartões: X dias antes do
      // fechamento, com o valor previsto da fatura em aberto (mesmo motor do app).
      // X = reminderAdvanceDays (0 = sem antecedência, mesma regra das contas).
      try {
        const engine = window.LivroCaixaCardEngineV3;
        const advance = Math.min(30, Math.max(0, Number(featureSettings.reminderAdvanceDays) || 0));
        const today = todayISO();
        if (advance > 0) (Array.isArray(cards) ? cards : []).filter(card => card && card.active !== false).forEach(card => {
          try {
            if (typeof engine?.invoicePeriodKeyForDate !== 'function' || typeof engine?.invoiceCycleRange !== 'function') return;
            const periodKey = engine.invoicePeriodKeyForDate(card, today);
            const cycle = engine.invoiceCycleRange(card, periodKey);
            if (!cycle || !cycle.end) return;
            const daysUntil = Math.round((new Date(`${cycle.end}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
            if (daysUntil < 0 || daysUntil > advance) return;
            if (typeof engine.invoice !== 'function') return;
            const invoice = engine.invoice(card.id, periodKey, purchases || [], cards || [], invoiceLaunches || []);
            const value = Number((invoice && (invoice.payableTotal || invoice.total)) || 0);
            if (!(value > 0)) return;
            alerts.push({
              icon: '▤',
              title: `Fatura de ${card.name || 'cartão'} fecha ${daysUntil === 0 ? 'hoje' : `em ${daysUntil} dia(s)`}`,
              detail: `Fecha em ${String(cycle.end).split('-').reverse().join('/')} · valor previsto: ${fmt(value)}.`
            });
          } catch (err) { /* cartão sem cálculo disponível */ }
        });
      } catch (err) { /* motor de cartões indisponível */ }
    }
    return alerts.slice(0, 8);
  }

  function renderNotifications() {
    const list = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!list || !badge) return;
    const alerts = getDashboardAlerts();
    badge.hidden = alerts.length === 0;
    badge.textContent = alerts.length > 9 ? '9+' : String(alerts.length);
    list.innerHTML = alerts.length ? alerts.map(alert => `<article class="notification-item"><span class="notification-item-icon">${alert.icon}</span><div><strong>${escapeHTML(alert.title)}</strong><p>${escapeHTML(alert.detail)}</p></div></article>`).join('') : `<div class="notification-empty">Nenhum aviso pendente. Seus dados estão organizados.</div>`;
  }

  function closeDrawer() {
    const overlay = document.getElementById('appDrawerOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function closeNotifications() {
    const overlay = document.getElementById('notificationOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function openDrawer() {
    closeNotifications();
    const overlay = document.getElementById('appDrawerOverlay');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
  }

  function openNotifications() {
    closeDrawer();
    if (typeof closeUniversalSearch === 'function') closeUniversalSearch();
    renderNotifications();
    const overlay = document.getElementById('notificationOverlay');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
  }

  /* [Busca universal] — lupa no topo: busca nome de lançamento, banco,
     categoria ou valor em todo o aplicativo (feature 11). */
  function universalSearchNormalize(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function universalSearchNumber(query) {
    const raw = String(query ?? '').trim();
    if (!/^-?\d[\d.,]*$/.test(raw)) return null;
    const n = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function openUniversalSearch() {
    closeDrawer();
    if (typeof closeNotifications === 'function') closeNotifications();
    const overlay = document.getElementById('universalSearchOverlay');
    overlay?.classList.add('is-open');
    overlay?.setAttribute('aria-hidden', 'false');
    const input = document.getElementById('universalSearchInput');
    if (input) {
      renderUniversalSearchResults(input.value);
      input.focus();
      input.select();
    }
  }

  function closeUniversalSearch() {
    const overlay = document.getElementById('universalSearchOverlay');
    overlay?.classList.remove('is-open');
    overlay?.setAttribute('aria-hidden', 'true');
  }

  function universalSearchGo(kind, id) {
    closeUniversalSearch();
    try {
      if (kind === 'entry') {
        window.switchTab('caixa');
        if (typeof window.editEntry === 'function') window.editEntry(id);
        return;
      }
      if (kind === 'bank' || kind === 'category') {
        const selectId = kind === 'bank' ? 'filterBank' : 'filterCategory';
        clearSelectedFilterValues(selectId);
        const select = document.getElementById(selectId);
        if (select) Array.from(select.options).forEach(option => { option.selected = option.value === id; });
        refreshFilterChoiceSummaries();
        window.switchTab('caixa');
        refreshFilteredViews();
        return;
      }
      const tabByKind = { bill: 'bills', card: 'cards', purchase: 'cards', pocket: 'pockets', goal: 'goals', investment: 'invest' };
      if (tabByKind[kind]) window.switchTab(tabByKind[kind]);
    } catch (err) {
      console.error('[universalSearch] Falha ao abrir resultado:', err);
    }
  }

  function renderUniversalSearchResults(query) {
    const box = document.getElementById('universalSearchResults');
    if (!box) return;
    const q = universalSearchNormalize(query);
    if (!q) {
      box.innerHTML = '<div class="universal-search-hint">Busque por nome de lançamento, banco, categoria ou valor.</div>';
      return;
    }
    const num = universalSearchNumber(query);
    const matchesText = (...values) => values.some(value => universalSearchNormalize(value).includes(q));
    const matchesAmount = value => num !== null && Math.abs(Number(value || 0) - num) < 0.005;
    const row = (kind, id, title, meta, value) => ({ kind, id, title, meta, value: value || '' });
    const groups = [];

    const entryRows = entries
      .filter(entry => matchesText(entry.desc, banks.find(bank => bank.id === entry.bank)?.name, categories.find(cat => cat.id === entry.category)?.name, entry.amount)
        || matchesAmount(entry.amount))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 10)
      .map(entry => row(
        'entry',
        entry.id,
        entry.desc || 'Sem descrição',
        `${String(entry.date || '').split('-').reverse().join('/')} · ${categories.find(cat => cat.id === entry.category)?.name || 'Sem categoria'} · ${banks.find(bank => bank.id === entry.bank)?.name || 'Sem conta'}`,
        `${entry.type === 'out' ? '−' : '+'}${fmt(entry.amount)}`
      ));
    if (entryRows.length) groups.push({ label: 'Lançamentos', rows: entryRows });

    const bankRows = banks
      .filter(bank => matchesText(bank.name) || matchesAmount(bankBalance(bank.id)))
      .slice(0, 4)
      .map(bank => row('bank', bank.id, bank.name, 'Conta bancária', fmt(bankBalance(bank.id))));
    if (bankRows.length) groups.push({ label: 'Contas', rows: bankRows });

    const categoryRows = categories
      .filter(cat => matchesText(cat.name))
      .slice(0, 4)
      .map(cat => row('category', cat.id, cat.name, 'Categoria'));
    if (categoryRows.length) groups.push({ label: 'Categorias', rows: categoryRows });

    const billRows = recurringBills
      .filter(bill => matchesText(bill.name) || matchesAmount(bill.amount))
      .slice(0, 4)
      .map(bill => row('bill', bill.id, bill.name, 'Conta recorrente', fmt(bill.amount)));
    if (billRows.length) groups.push({ label: 'Contas recorrentes', rows: billRows });

    const cardRows = cards
      .filter(card => matchesText(card.name) || matchesAmount(card.limit))
      .slice(0, 4)
      .map(card => row('card', card.id, card.name, 'Cartão de crédito', fmt(card.limit)));
    if (cardRows.length) groups.push({ label: 'Cartões', rows: cardRows });

    const purchaseRows = purchases
      .filter(purchase => matchesText(purchase.description) || matchesAmount(purchase.totalValue) || matchesAmount(purchase.installmentValue))
      .slice(0, 4)
      .map(purchase => row('purchase', purchase.id, purchase.description || 'Compra sem descrição', 'Compra no cartão', fmt(purchase.totalValue)));
    if (purchaseRows.length) groups.push({ label: 'Compras', rows: purchaseRows });

    const pocketRows = pockets
      .filter(pocket => matchesText(pocket.name))
      .slice(0, 3)
      .map(pocket => row('pocket', pocket.id, pocket.name, 'Caixinha'));
    if (pocketRows.length) groups.push({ label: 'Caixinhas', rows: pocketRows });

    const goalRows = goals
      .filter(goal => matchesText(goal.name))
      .slice(0, 3)
      .map(goal => row('goal', goal.id, goal.name, 'Meta'));
    if (goalRows.length) groups.push({ label: 'Metas', rows: goalRows });

    const investmentRows = investments
      .filter(inv => matchesText(inv.name, inv.alias))
      .slice(0, 3)
      .map(inv => row('investment', inv.id, inv.name || inv.alias || 'Investimento', 'Investimento'));
    if (investmentRows.length) groups.push({ label: 'Investimentos', rows: investmentRows });

    const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
    if (!total) {
      box.innerHTML = `<div class="universal-search-hint">Nenhum resultado para “${escapeHTML(query)}”.</div>`;
      return;
    }
    box.innerHTML = groups.map(group => `
      <div class="universal-search-group">${escapeHTML(group.label)}</div>
      ${group.rows.map(item => `
        <button type="button" class="universal-search-item" data-search-kind="${item.kind}" data-search-id="${escapeHTML(String(item.id))}">
          <span class="universal-search-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.meta)}</small></span>
          ${item.value ? `<b>${escapeHTML(item.value)}</b>` : ''}
        </button>`).join('')}
    `).join('');
  }

  function renderBankSelects() {
    const options = banks.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    document.getElementById('fBanco').innerHTML = options;
    const pocketBank = document.getElementById('pBancoOrigem');
    if (pocketBank) {
      const current = pocketBank.value;
      pocketBank.innerHTML = `<option value="">A definir</option>${options}`;
      if (current && banks.some(b => b.id === current)) pocketBank.value = current;
    }

    const bankOptGroup = banks.map(b => `<option value="${b.id}">🏦 ${escapeHTML(b.name)}</option>`).join('');
    const pocketOptGroup = pockets.map(p => `<option value="${p.id}">🐷 ${escapeHTML(p.name)} (Caixinha)</option>`).join('');
    const investmentOptGroup = investments.map(i => {
      const inst = i.institution ? ` · ${escapeHTML(i.institution)}` : '';
      return `<option value="${i.id}">🪙 ${escapeHTML(i.name)}${inst} (Investimento)</option>`;
    }).join('');
    const transferOptions =
      (bankOptGroup ? `<optgroup label="Bancos">${bankOptGroup}</optgroup>` : '') +
      (pocketOptGroup ? `<optgroup label="Caixinhas">${pocketOptGroup}</optgroup>` : '') +
      (investmentOptGroup ? `<optgroup label="Investimentos">${investmentOptGroup}</optgroup>` : '');

    const tDe = document.getElementById('tDe');
    const tPara = document.getElementById('tPara');
    tDe.innerHTML = transferOptions;
    tPara.innerHTML = transferOptions;
    const firstOther = [...banks, ...pockets, ...investments].find(item => item.id !== tDe.value);
    if (firstOther) tPara.value = firstOther.id;
  }

  function renderBankManageList() {
    const container = document.getElementById('bankManageList');
    const total = totalBankBalance();
    const sortedBanks = [...banks].sort((a, b) => {
      const diff = bankBalance(b.id) - bankBalance(a.id);
      return diff !== 0 ? diff : String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
    container.innerHTML = sortedBanks.map(b => {
      const balance = bankBalance(b.id);
      const share = percentOfTotal(balance, total);
      return `<div class="bank-list-item">
        <div class="manage-item-copy"><strong>${escapeHTML(b.name)}</strong><span>Saldo atual</span><span class="bank-share-line">${share == null ? '—' : share.toFixed(1).replace('.', ',') + '% do total'}</span></div>
        <strong class="manage-item-value">${fmt(balance)}</strong>
        <div class="manage-item-actions">
          <button type="button" class="action-btn icon-button edit" onclick="editBank('${b.id}')" aria-label="Editar banco" title="Editar banco"></button>
          <button type="button" class="action-btn icon-button delete" onclick="deleteBank('${b.id}')" aria-label="Excluir banco" title="Excluir banco"></button>
        </div>
      </div>`;
    }).join('');
  }

  let CATEGORY_PALETTE;

  let CATEGORY_ICON_RULES;

  let categoryColorMap;

  function pickCategoryColor(key) {
    const used = new Set(categoryColorMap.values());
    const seed = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      const candidate = CATEGORY_PALETTE[(seed + i) % CATEGORY_PALETTE.length];
      if (!used.has(candidate)) return candidate;
    }
    return `hsl(${(216 + categoryColorMap.size * 137.508) % 360}, 24%, 58%)`;
  }
  function categoryColor(category) {
    if (!category) return '#66746B';
    if (category.color) return category.color;
    const key = String(category.id || category.name || 'outros');
    if (!categoryColorMap.has(key)) {
      (Array.isArray(categories) ? categories : []).forEach(cat => {
        const catKey = cat && String(cat.id || cat.name || 'outros');
        if (catKey && !categoryColorMap.has(catKey)) categoryColorMap.set(catKey, pickCategoryColor(catKey));
      });
      if (!categoryColorMap.has(key)) categoryColorMap.set(key, pickCategoryColor(key));
    }
    return categoryColorMap.get(key);
  }

  let normalizeTextKey;

  function findCategoryByName(name) {
    const key = normalizeTextKey(name);
    return categories.find(c => normalizeTextKey(c.name) === key) || null;
  }

  function categoryIcon(category, flow = 'in') {
    if (category?.icon) return category.icon;
    const name = String(category?.name || '');
    const match = CATEGORY_ICON_RULES.find(([rule]) => rule.test(name));
    return match ? match[1] : (flow === 'out' ? '↘' : '↗');
  }

  let EMOJI_CATALOG;

  function emojiLabel(icon) {
    return (EMOJI_CATALOG.find(([emoji]) => emoji === icon) || [icon, 'Emoji personalizado'])[1];
  }
  function isEmojiValue(value) {
    try { return /\p{Extended_Pictographic}/u.test(String(value || '')); } catch (err) { return String(value || '').trim().length > 0; }
  }
  function setCategoryDraftIcon(icon) {
    const value = String(icon || '📦').trim();
    document.getElementById('cIcon').value = value;
    document.getElementById('cEmojiPreview').textContent = value;
    document.getElementById('cEmojiLabel').textContent = emojiLabel(value);
  }
  let emojiFloatPending;

  let categoryIconTouched;

  let categoryIconSuggested;

  function normalizeEmojiSearch(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function suggestEmojiForCategoryName(name) {
    const query = normalizeEmojiSearch(name);
    if (!query) return null;
    const entries = EMOJI_CATALOG.map(([emoji, label, group]) => ({ emoji, l: normalizeEmojiSearch(label), g: normalizeEmojiSearch(group) }));
    const match = entries.find(e => e.l === query)
      || entries.find(e => e.l.startsWith(query))
      || entries.find(e => e.l.includes(query))
      || entries.find(e => e.g === query)
      || entries.find(e => query.includes(e.l));
    return match ? match.emoji : null;
  }
  function applyCategoryNameSuggestion() {
    if (categoryIconTouched) return;
    const suggestion = suggestEmojiForCategoryName(document.getElementById('cNome').value);
    const current = document.getElementById('cIcon').value || '📦';
    if (suggestion) {
      if (current !== suggestion) {
        categoryIconSuggested = suggestion;
        setCategoryDraftIcon(suggestion);
      }
    } else if (categoryIconSuggested && current === categoryIconSuggested) {
      categoryIconSuggested = null;
      setCategoryDraftIcon('📦');
    }
  }
  function renderEmojiFloatGrid() {
    const current = emojiFloatPending || document.getElementById('cIcon').value || '📦';
    const rawQuery = document.getElementById('emojiFloatSearch')?.value || '';
    const query = normalizeEmojiSearch(rawQuery);
    const matches = EMOJI_CATALOG.filter(([emoji, label, group]) => !query
      || normalizeEmojiSearch(label).includes(query)
      || normalizeEmojiSearch(group).includes(query)
      || emoji.includes(query));
    let html = '';
    let lastGroup = '';
    for (const [emoji, label, group] of matches) {
      if (group && group !== lastGroup) {
        lastGroup = group;
        html += `<div class="emoji-float-group">${escapeHTML(group)}</div>`;
      }
      html += `<button type="button" class="${emoji === current ? 'selected' : ''}" data-emoji="${emoji}" title="${escapeHTML(label)}" aria-label="${escapeHTML(label)}" aria-pressed="${emoji === current}"><span class="emoji-float-btn-emoji">${emoji}</span><span class="emoji-float-btn-label">${escapeHTML(label)}</span></button>`;
    }
    if (!matches.length) {
      html = `<div class="emoji-float-empty">Nenhum emoji encontrado para “${escapeHTML(rawQuery)}”</div>`;
    }
    document.getElementById('emojiFloatGrid').innerHTML = html;
    updateEmojiFloatPreview(current);
  }
  function updateEmojiFloatPreview(icon) {
    document.getElementById('emojiFloatPreviewIcon').textContent = icon;
    document.getElementById('emojiFloatPreviewLabel').textContent = emojiLabel(icon);
  }
  function openEmojiFloat() {
    emojiFloatPending = document.getElementById('cIcon').value || '📦';
    document.getElementById('emojiFloatNativeBox').classList.remove('is-open');
    document.getElementById('emojiFloatNativeInput').value = '';
    document.getElementById('emojiFloatSearch').value = '';
    renderEmojiFloatGrid();
    document.getElementById('emojiFloatOverlay').classList.add('open');
  }
  function closeEmojiFloat() {
    document.getElementById('emojiFloatOverlay').classList.remove('open');
  }
  function initCategoryEmojiPicker() {
    document.getElementById('btnEmojiCatalog').onclick = openEmojiFloat;
    document.getElementById('emojiFloatSearch').addEventListener('input', renderEmojiFloatGrid);
    document.getElementById('cNome').addEventListener('input', applyCategoryNameSuggestion);
    document.getElementById('emojiFloatClose').onclick = closeEmojiFloat;
    document.getElementById('emojiFloatOverlay').onclick = event => {
      if (event.target.id === 'emojiFloatOverlay') closeEmojiFloat();
    };
    document.getElementById('emojiFloatGrid').onclick = event => {
      const button = event.target.closest('[data-emoji]');
      if (!button) return;
      emojiFloatPending = button.dataset.emoji;
      document.getElementById('emojiFloatNativeBox').classList.remove('is-open');
      renderEmojiFloatGrid();
    };
    document.getElementById('emojiFloatKeyboard').onclick = () => {
      document.getElementById('emojiFloatNativeBox').classList.add('is-open');
      requestAnimationFrame(() => document.getElementById('emojiFloatNativeInput').focus({ preventScroll: true }));
    };
    document.getElementById('emojiFloatNativeUse').onclick = () => {
      const input = document.getElementById('emojiFloatNativeInput');
      const value = input.value.trim();
      if (!isEmojiValue(value)) { alert('Digite ou cole um emoji válido do teclado.'); return; }
      emojiFloatPending = value;
      updateEmojiFloatPreview(value);
      renderEmojiFloatGrid();
    };
    document.getElementById('emojiFloatConfirm').onclick = () => {
      categoryIconTouched = true;
      setCategoryDraftIcon(emojiFloatPending || document.getElementById('cIcon').value);
      closeEmojiFloat();
    };
    setCategoryDraftIcon(document.getElementById('cIcon').value || '📦');
  }

  function renderCategorySelect() {
    const sel = document.getElementById('fCategoria');
    const currentVal = sel.value;
    sel.innerHTML = categories.map(c => {
      const subs = Array.isArray(c.subcategories) ? c.subcategories.filter(s => s && s.id) : [];
      const parentOption = `<option value="${c.id}">${escapeHTML(subs.length ? c.name + ' (sem subcategoria)' : c.name)}</option>`;
      if (!subs.length) return parentOption;
      const subOptions = subs.map(s => `<option value="${c.id}::${s.id}">${escapeHTML(c.name)} › ${escapeHTML(s.name || '')}</option>`).join('');
      return `<optgroup label="${escapeHTML(c.name)}">${parentOption}${subOptions}</optgroup>`;
    }).join('');
    const isKnown = value => value && (categories.some(c => c.id === value) ||
      (value.includes('::') && (() => { const [catId, subId] = value.split('::'); return (categories.find(c => c.id === catId)?.subcategories || []).some(s => s.id === subId); })()));
    if (isKnown(currentVal)) sel.value = currentVal;
    updateCategoryTriggerLabel();
  }

  function updateCategoryTriggerLabel() {
    const sel = document.getElementById('fCategoria');
    const summary = document.getElementById('fCategoriaSummary');
    if (!sel || !summary) return;
    const value = sel.value;
    if (!value) { summary.textContent = 'Sem categoria'; return; }
    const [catId, subId] = value.includes('::') ? value.split('::') : [value, ''];
    const cat = categories.find(c => c.id === catId);
    if (!cat) { summary.textContent = 'Sem categoria'; return; }
    const icon = categoryIcon(cat);
    const sub = subId && Array.isArray(cat.subcategories) ? cat.subcategories.find(s => s.id === subId) : null;
    summary.textContent = sub ? `${icon} ${cat.name} › ${sub.name}` : `${icon} ${cat.name}`;
  }

  function renderCatPickerList() {
    const list = document.getElementById('catPickerList');
    const sel = document.getElementById('fCategoria');
    if (!list || !sel) return;
    const current = sel.value;
    const query = (catPickerSearchTerm || '').toLocaleLowerCase('pt-BR');
    const rows = [`<button type="button" class="filter-choice-option cat-pick-option ${!current ? 'is-selected' : ''}" data-value=""><span class="category-dot" style="background:#66746B">—</span><span>Sem categoria</span></button>`];
    categories.forEach(c => {
      const name = String(c.name || '');
      const subs = Array.isArray(c.subcategories) ? c.subcategories.filter(s => s && s.id) : [];
      const catMatch = !query || name.toLocaleLowerCase('pt-BR').includes(query);
      const matchingSubs = subs.filter(s => !query || String(s.name || '').toLocaleLowerCase('pt-BR').includes(query));
      if (!catMatch && !matchingSubs.length) return;
      const color = categoryColor(c);
      const icon = categoryIcon(c);
      if (catMatch || !subs.length) {
        rows.push(`<button type="button" class="filter-choice-option cat-pick-option ${current === c.id ? 'is-selected' : ''}" data-value="${c.id}"><span class="category-dot" style="background:${color}">${escapeHTML(icon)}</span><span>${escapeHTML(c.name)}${subs.length ? ' (sem subcategoria)' : ''}</span></button>`);
      }
      matchingSubs.forEach(s => {
        const val = `${c.id}::${s.id}`;
        rows.push(`<button type="button" class="filter-choice-option cat-pick-option cat-pick-sub ${current === val ? 'is-selected' : ''}" data-value="${val}"><span class="category-dot" style="background:${color};opacity:.7">${escapeHTML(icon)}</span><span>${escapeHTML(c.name)} › ${escapeHTML(s.name || '')}</span></button>`);
      });
    });
    list.innerHTML = rows.join('') + (categories.length === 0 && !query ? '<div class="filter-choice-empty">Nenhuma categoria cadastrada. Toque em + para criar.</div>' : '');
    list.querySelectorAll('.cat-pick-option').forEach(btn => {
      btn.addEventListener('click', () => {
        sel.value = btn.dataset.value || '';
        updateCategoryTriggerLabel();
        closeCategoryPicker();
      });
    });
  }

  function openCategoryPicker() {
    const sheet = document.getElementById('catPickerSheet');
    const search = document.getElementById('catPickerSearch');
    if (!sheet) return;
    catPickerSearchTerm = '';
    if (search) { search.value = ''; search.placeholder = 'Buscar categoria'; }
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.getElementById('panelNovo')?.classList.add('sheet-open');
    renderCatPickerList();
  }

  function closeCategoryPicker() {
    const sheet = document.getElementById('catPickerSheet');
    if (sheet) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
      const list = document.getElementById('catPickerList');
      if (list) list.replaceChildren();
      const search = document.getElementById('catPickerSearch');
      if (search) search.value = '';
    }
    document.getElementById('panelNovo')?.classList.remove('sheet-open');
  }

  function renderCategoryManageList() {
    const container = document.getElementById('catManageList');
    container.innerHTML = categories.map(c => {
      const subs = Array.isArray(c.subcategories) ? c.subcategories.filter(s => s && s.id) : [];
      const chips = subs.map(s => `<span class="cat-sub-chip">${escapeHTML(s.name || '')}<button type="button" class="cat-sub-remove" onclick="removeSubcategory('${c.id}','${s.id}')" aria-label="Remover subcategoria ${escapeHTML(s.name || '')}" title="Remover subcategoria">×</button></span>`).join('');
      return `
      <div class="cat-list-item">
        <span class="category-dot" style="background:${categoryColor(c)}">${categoryIcon(c)}</span>
        <strong class="manage-item-copy">${escapeHTML(c.name)}<span>${escapeHTML(categoryIcon(c))} · ${escapeHTML(c.color ? 'cor personalizada' : 'cor automática')}</span></strong>
        <span class="manage-item-actions">
          <button type="button" class="action-btn icon-button edit" onclick="editCategory('${c.id}')" aria-label="Editar categoria" title="Editar categoria"></button>
          <button type="button" class="action-btn icon-button delete" onclick="deleteCategory('${c.id}')" aria-label="Excluir categoria" title="Excluir categoria"></button>
        </span>
        <div class="cat-subs" data-cat="${c.id}">
          ${chips}
          <span class="cat-sub-add">
            <input type="text" class="cat-sub-input" maxlength="40" placeholder="Nova subcategoria" aria-label="Nova subcategoria de ${escapeHTML(c.name)}">
            <button type="button" class="cat-sub-add-btn" onclick="addSubcategory('${c.id}')" aria-label="Adicionar subcategoria em ${escapeHTML(c.name)}" title="Adicionar subcategoria">+</button>
          </span>
        </div>
      </div>
    `;
    }).join('');
  }

  function updateFixedIncomeFormCurrent() {
    const currentInput = document.getElementById('iValorAtualSimples');
    if (!currentInput) return;
    const item = editingInvestId ? investments.find(x => x.id === editingInvestId) : null;
    const initial = readMoneyInput('iValorSimples');
    const movements = item ? fixedIncomeMovementTotal(item) : 0;
    setMoneyInput('iValorAtualSimples', Math.max(0, initial + movements));
  }
  let SATS_PER_BTC;

  function isCryptoType(type) {
    return type === 'Stablecoin' || type === 'Criptomoeda' || type === 'Bitcoin';
  }
  function isBitcoinType(type) {
    return type === 'Bitcoin';
  }
  // 'units' de Bitcoin é sempre um inteiro de SATS. Nunca converter pra BTC fracionário
  // pra evitar perda de precisão — a conversão só acontece na hora de calcular o valor em BRL.
  function cryptoValueFromUnits(type, units, pricePerUnit) {
    if (!isFinite(units) || !isFinite(pricePerUnit)) return 0;
    if (isBitcoinType(type)) return (units / SATS_PER_BTC) * pricePerUnit;
    return units * pricePerUnit;
  }
  function cryptoMovementTotal(item, excludeId = null) {
    if (!item) return 0;
    const total = yieldsLog
      .filter(y => y.targetType === 'invest' && y.targetId === item.id && y.id !== excludeId && y.units != null)
      .reduce((sum, y) => sum + (y.kind === 'resgate' ? -1 : 1) * (Number(y.units) || 0), 0);
    return Number(total.toFixed(8));
  }
  function cryptoInitialUnits(item) {
    if (Number.isFinite(Number(item?.initialUnits))) return Number(item.initialUnits);
    return Number(item?.units || 0) - cryptoMovementTotal(item);
  }
  function cryptoCurrentUnits(item, excludeId = null) {
    const current = Math.max(0, cryptoInitialUnits(item) + cryptoMovementTotal(item, excludeId));
    return isBitcoinType(item?.type) ? Math.round(current) : Number(current.toFixed(8));
  }
  /* Movimentações legadas/importadas podem não ter 'units'. Elas já ficam de fora
     do saldo (ver filtro de y.units em cryptoMovementTotal) — este contador serve
     para o card avisar, em vez de deixar a divergência silenciosa. */
  function cryptoMissingUnitsCount(item) {
    if (!item) return 0;
    return yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === item.id && y.units == null).length;
  }
  function syncDerivedCryptoValue(item, priceOverride = null) {
    if (!item || !isCryptoType(item.type)) return item;
    item.units = cryptoCurrentUnits(item);
    const price = priceOverride != null && Number(priceOverride) > 0 ? Number(priceOverride) : Number(item.price || 0);
    if (price > 0) item.value = cryptoValueFromUnits(item.type, item.units, price);
    return item;
  }
  function formatCryptoUnits(type, units, assetName = '') {
    const n = Number(units) || 0;
    if (isBitcoinType(type)) return `${Math.round(n).toLocaleString('pt-BR')} SATS`;
    const label = String(assetName || '').trim().toUpperCase();
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}${label ? ` ${escapeHTML(label)}` : ''}`;
  }

  function formatMovementPeriod(y) {
    return (y.date || '').split('-').reverse().join('/');
  }

  function movementKindLabel(kind) {
    if (kind === 'aporte') return 'Aporte';
    if (kind === 'resgate') return 'Resgate';
    return 'Rendimento';
  }


  function formatQuoteUpdatedAt(value) {
    if (!value) return 'sem atualização registrada';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'atualização registrada' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function movementHistoryRows(targetType, targetId) {
    const item = (targetType === 'invest' ? investments : pockets).find(x => x.id === targetId);
    // Calcula o saldo auditável usando TODO o histórico e só depois aplica o período visualizado.
    // Assim, um lançamento de agosto continua mostrando corretamente o saldo anterior,
    // mesmo quando julho ou meses anteriores estiverem ocultos pela interface.
    const allItems = yieldsLog.filter(y => y.targetType === targetType && y.targetId === targetId)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.id || '').localeCompare(String(b.id || '')));
    const isCryptoTarget = !!(item && targetType === 'invest' && isCryptoType(item.type));
    let running = isCryptoTarget ? cryptoInitialUnits(item) : (item && targetType === 'invest' ? fixedIncomeInitialValue(item) : Number(item?.initial ?? item?.value ?? 0) || 0);
    const rows = [];
    allItems.forEach(y => {
      const before = running;
      /* Movimentação cripto sem 'units' não tem variação conhecida em unidades:
         somar movementDelta(y) aqui misturaria reais no saldo auditável.
         O registro continua listado, apenas sem alterar o saldo. */
      const delta = !isCryptoTarget ? movementDelta(y) : (y.units != null ? (y.kind === 'resgate' ? -1 : 1) * Number(y.units || 0) : 0);
      running += delta;
      if (periodMatchesMovement(y)) rows.push({ y, before, delta, after: running, item, isCrypto: isCryptoTarget });
    });
    return rows;
  }
  function yieldHistoryHTML(targetType, targetId) {
    const rowsData = movementHistoryRows(targetType, targetId);
    if (rowsData.length === 0) return '';
    const rows = rowsData.slice().reverse().map(({ y, before, delta, after, item, isCrypto }) => {
      const kind = y.kind || 'rendimento';
      const positive = kind !== 'resgate';
      const sign = positive ? '+' : '−';
      const label = movementKindLabel(kind);
      let description = String(y.desc || '').trim();
      const duplicateLabel = new RegExp(`^${label}\\s*[-–—:]?\\s*`, 'i');
      description = description.replace(duplicateLabel, '');
      const hasUnits = !!(isCrypto && y.units != null);
      /* Unidade conhecida: quantidade + valor aproximado. Sem unidade (registro
         legado) só há o valor a mostrar — o saldo auditável segue em unidades. */
      const valueLabel = hasUnits
        ? `${sign}${formatCryptoUnits(item.type, Math.abs(y.units), item.name)} · ≈ ${fmtPrecise(Math.abs(y.amount || 0))}`
        : `${sign}${fmtPrecise(Math.abs(y.amount || 0))}`;
      const beforeLabel = isCrypto ? formatCryptoUnits(item.type, before, item.name) : fmtPrecise(before);
      const deltaLabel = isCrypto ? `${sign}${formatCryptoUnits(item.type, Math.abs(delta), item.name)}` : `${sign}${fmtPrecise(Math.abs(delta))}`;
      const afterLabel = isCrypto ? formatCryptoUnits(item.type, after, item.name) : fmtPrecise(after);
      return `<article class="yield-row">
        <div class="history-main">
          <div class="history-head"><strong class="history-date">${escapeHTML(formatMovementPeriod(y))}</strong><span class="history-kind ${positive ? '' : 'negative'}">${escapeHTML(label)}</span></div>
          ${description ? `<div class="history-description">${escapeHTML(description)}</div>` : ''}
          <div class="history-value ${positive ? 'positive' : 'negative'}">${valueLabel}${y.price ? `<span class="history-quote">Cotação ${fmt(y.price)}</span>` : ''}</div>
          <div class="history-audit"><span><small>Saldo anterior</small><strong>${beforeLabel}</strong></span><span><small>Alteração</small><strong>${deltaLabel}</strong></span><span><small>Saldo posterior</small><strong>${afterLabel}</strong></span></div>
        </div>
        <div class="yield-actions"><button type="button" class="action-btn icon-button edit" onclick="editYield('${y.id}')" aria-label="Editar movimentação" title="Editar movimentação"></button><button type="button" class="action-btn icon-button delete" onclick="deleteYield('${y.id}')" aria-label="Excluir movimentação" title="Excluir movimentação"></button></div>
      </article>`;
    }).join('');
    return `<details class="yield-history"><summary><i class="fi fi-rr-clipboard-list" aria-hidden="true"></i> Histórico auditável (${rowsData.length})</summary><div class="yield-history-list">${rows}</div></details>`;
  }

  function rentabilityHTML(targetType, targetId, currentValue) {
    const items = yieldsLog.filter(y => y.targetType === targetType && y.targetId === targetId && periodMatchesMovement(y) && (y.kind || 'rendimento') === 'rendimento');
    if (items.length === 0) return '';
    const totalYield = items.reduce((s, y) => s + y.amount, 0);
    const baseValue = currentValue - totalYield;
    const firstDate = items.map(y => y.date).sort()[0];
    const days = Math.max(1, Math.round((new Date(todayISO()) - new Date(firstDate)) / 86400000));
    const monthly = totalYield / (days / 30);
    const pct = baseValue > 0 ? (totalYield / baseValue * 100) : null;
    return `<div class="rentability-box">
      <span><i class="fi fi-rr-financial-health" aria-hidden="true"></i> Rendimento total: <strong class="${totalYield >= 0 ? 'yield-pos' : 'yield-neg'}">${fmt(totalYield)}</strong>${pct !== null ? ` (${pct.toFixed(2)}%)` : ''}</span>
      <span>Média: ${fmt(monthly)}/mês · desde ${firstDate.split('-').reverse().join('/')}</span>
    </div>`;
  }

  /* P2.6 — UI de histórico de cotações removida; priceHistory/upsertPriceHistory permanecem para cálculos */


  let priceChartInstances;


  function renderPriceCharts() {
    // P2.6: gráficos de cotação não são mais exibidos na interface de Investimentos.
    Object.keys(priceChartInstances).forEach(id => {
      try { priceChartInstances[id]?.destroy?.(); } catch (err) {}
      delete priceChartInstances[id];
    });
  }

  /* Dedupe: logInfo/logWarn gravam no Firestore, então cada render não pode
     reemitir o mesmo aviso. Limpa sozinho quando a contagem volta a zero. */
  let unitsWarningLogged;

  const expandedInstitutionKeys = new Set();

  function toggleInvestmentsInstitutionView(key) {
    const set = expandedInstitutionKeys;
    if (set.has(key)) set.delete(key); else set.add(key);
    renderInvestments();
  }

  function investmentDisplayValueFor(inv) {
    if (inv.type === 'Renda Fixa') return fixedIncomeCurrentValue(inv);
    const v = Number(inv.value);
    if (Number.isFinite(v) && v > 0) return v;
    return cryptoValueFromUnits(inv.type, cryptoCurrentUnits(inv), inv.price || 0);
  }

  function investmentsGroupYieldTotal(list) {
    let totalYield = 0;
    (list || []).forEach(inv => {
      yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === inv.id && periodMatchesMovement(y) && (y.kind || 'rendimento') === 'rendimento')
        .forEach(y => { totalYield += Number(y.amount) || 0; });
    });
    return totalYield;
  }

  function buildInvestmentsGroupCardHTML(group, gi) {
    const list = group.investments;
    const isOpen = expandedInstitutionKeys.has(group.key);
    const entries = list.map((inv, idx) => ({ inv, idx }));
    const visibleEntries = isOpen ? entries : entries.slice(0, 2);
    const hiddenCount = Math.max(0, entries.length - visibleEntries.length);
    const firstIdx = entries.length ? entries[0].idx : -1;
    const lastIdx = entries.length ? entries[entries.length - 1].idx : -1;
    const groupTotal = entries.reduce((sum, e) => sum + investmentDisplayValueFor(e.inv), 0);
    const groupYield = investmentsGroupYieldTotal(list);
    const groupBase = groupTotal - groupYield;
    const groupPct = groupBase > 0 ? (groupYield / groupBase) * 100 : null;
    const assetsHtml = visibleEntries.map(entry => {
      const inv = entry.inv;
      const displayVal = investmentDisplayValueFor(inv);
      const missingUnits = isCryptoType(inv.type) ? cryptoMissingUnitsCount(inv) : 0;
      if (missingUnits > 0) {
        if (!unitsWarningLogged.has(inv.id)) {
          unitsWarningLogged.add(inv.id);
          logWarn('Investimentos', 'Movimentações sem quantidade', 'Atenção',
            `${missingUnits} ${missingUnits === 1 ? 'movimentação' : 'movimentações'} sem quantidade não ${missingUnits === 1 ? 'entra' : 'entram'} no saldo de ${inv.name}.`,
            { investmentId: inv.id, count: missingUnits });
        }
      } else {
        unitsWarningLogged.delete(inv.id);
      }
      const typeShort = ({
        'Stablecoin':'STABLE', 'Bitcoin':'BTC', 'Criptomoeda':'CRIPTO', 'Ações':'AÇÕES',
        'Renda Fixa':'RF', 'FII':'FII', 'ETF':'ETF', 'Tesouro':'TESOURO'
      })[inv.type] || String(inv.type || '').slice(0, 10);
      const assetHtml = [
        '      <article class="invest-box asset-card" data-item-id="' + inv.id + '">',
        '        <div class="asset-card-head">',
        '          <div class="asset-card-title">',
        '            <div class="asset-card-name-row">',
        '              <strong class="asset-card-name">' + escapeHTML(inv.alias || inv.name) + '</strong>',
        '              <span class="asset-card-tag">' + escapeHTML(typeShort) + '</span>',
        '            </div>',
        '            ' + (inv.alias ? '<span class="asset-card-sub">' + escapeHTML(inv.name) + '</span>' : ''),
        '          </div>',
        '        </div>',
        '        <div class="asset-card-value">' + fmt(displayVal) + '</div>',
        '        <div class="asset-card-meta">',
        '          ' + (isCryptoType(inv.type) ? '<span>Qtd: ' + formatCryptoUnits(inv.type, cryptoCurrentUnits(inv), inv.name) + '</span>' : ''),
        '          ' + (isCryptoType(inv.type) ? '<span>' + fmt(inv.price || 0) + ' · ' + (inv.quoteSource === 'api' ? 'Auto' : 'Manual') + ' · ' + formatQuoteUpdatedAt(inv.lastQuoteAt) + '</span>' : ''),
        '          ' + (missingUnits > 0 ? '<span class="asset-card-units-warning">' + missingUnits + ' ' + (missingUnits === 1 ? 'movimentação' : 'movimentações') + ' sem quantidade não ' + (missingUnits === 1 ? 'entra' : 'entram') + ' no saldo</span>' : ''),
        '          ' + (inv.institution ? '<span>' + escapeHTML(inv.institution) + (inv.rate ? ' · ' + escapeHTML(inv.rate) : '') + '</span>' : ''),
        '          ' + investmentReferenceHTML(inv),
        '          ' + (inv.dueDate ? '<span>Venc.: ' + inv.dueDate.split('-').reverse().join('/') + '</span>' : ''),
        '        </div>',
        '        ' + (() => { const items = yieldsLog.filter(y => y.targetType === 'invest' && y.targetId === inv.id && periodMatchesMovement(y) && (y.kind || 'rendimento') === 'rendimento'); if (!items.length) return ''; const totalYield = items.reduce((s, y) => s + y.amount, 0); return `<span class="rentability-text">${fmt(totalYield)} (rendimento)</span>`; })(),
        '        ' + yieldHistoryHTML('invest', inv.id),
        '        <div class="asset-card-actions item-action-row">',
        '          <div class="reorder-actions">',
        '            <button type="button" class="action-btn" onclick="moveInvestment(' + "'" + inv.id + "'" + ',-1)" ' + (entry.idx === firstIdx ? 'disabled' : '') + ' aria-label="Mover para cima">↑</button>',
        '            <button type="button" class="action-btn" onclick="moveInvestment(' + "'" + inv.id + "'" + ',1)" ' + (entry.idx === lastIdx ? 'disabled' : '') + ' aria-label="Mover para baixo">↓</button>',
        '          </div>',
        '          <button type="button" class="action-btn icon-button move" onclick="openInvestmentMovementModal(' + "'" + 'aporte' + "'" + ',' + "'" + inv.id + "'" + ')" aria-label="Movimentações"></button>',
        '          <button type="button" class="action-btn reconcile-btn" onclick="openCryptoReconcileModal(' + "'" + inv.id + "'" + ')" aria-label="Conciliar saldo"><i class="fi fi-rr-money-bill-wave" aria-hidden="true"></i></button>',
        '          <button type="button" class="action-btn icon-button edit" onclick="editInvest(' + "'" + inv.id + "'" + ')" aria-label="Editar"></button>',
        '          <button type="button" class="action-btn icon-button delete" onclick="deleteInvest(' + "'" + inv.id + "'" + ')" aria-label="Excluir"></button>',
        '        </div>',
        '      </article>',
        ''
      ].join('\n');
      return assetHtml;
    }).join('');
    const assetsId = 'institution-assets-' + gi;
    const viewAllButton = list.length > 2
      ? '<button type="button" class="institution-view-all" data-institution-key="' + escapeHTML(group.key) + '" onclick="instToggle(this)" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="' + assetsId + '">' + (isOpen ? 'Ver menos' : 'Ver investimentos') + '</button>'
      : '';
    const moreBlock = (list.length > 2 && !isOpen) ? '<div class="institution-more"><span>+ ' + hiddenCount + ' outros investimentos</span>' + viewAllButton + '</div>' : (list.length > 2 ? viewAllButton : '');
    return [
      '      <article class="institution-card" data-institution-key="' + escapeHTML(group.key) + '">',
      '        <header class="institution-card-header">',
      '          <div class="institution-card-identity">',
      '            <i class="institution-icon fi fi-rr-bank" aria-hidden="true"></i>',
      '            <div class="institution-card-heading">',
      '              <h3>' + escapeHTML(group.label) + '</h3>',
      '              <span>' + list.length + ' investimentos</span>',
      '            </div>',
      '          </div>',
          (list.length > 2 ? '          <button type="button" class="institution-menu" aria-label="Ver investimentos" title="Ver mais/menos investimentos" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="' + assetsId + '" data-institution-key="' + escapeHTML(group.key) + '" onclick="instToggle(this)">\u25bc</button>' : ''),
          '          <button type="button" class="action-btn icon-button edit institution-rename" aria-label="Editar instituição" title="Editar instituição" data-institution-key="' + escapeHTML(group.key) + '" onclick="instEdit(this)"></button>',
      '        </header>',
      '        <div class="institution-summary">',
      '          <strong>' + fmt(groupTotal) + '</strong>',
      '          <div class="institution-summary-metrics">',
      '            <span>' + fmt(groupYield) + '</span>',
      '            <span>' + (groupPct !== null ? groupPct.toFixed(2) + '%' : '—') + '</span>',
      '          </div>',
      '        </div>',
      '        <div class="institution-assets" id="' + assetsId + '">',
      '          ' + assetsHtml,
      '        </div>',
      '        ' + moreBlock,
      '      </article>'
    ].join('\n');
  }



  function renderInvestments() {
    applyCachedQuotesToInvestments();
    const container = document.getElementById('investGrid');
    const summary = document.getElementById('investBalanceStrip');
    const total = totalInvestBalance();
    summary.innerHTML = `<div class="balance-card total"><div class="balance-card-head"><span class="label">Total investido</span><span class="balance-symbol" aria-hidden="true">${financialIcon('growth')}</span></div><span class="amount">${fmt(total)}</span></div>`;
    if (investments.length === 0) {
      container.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">Nenhum ativo ou investimento cadastrado. Clique em "+ Novo Ativo / Cripto" para registrar.</div>`;
      return;
    }
    const groups = groupInvestmentsByInstitution(investments);
    container.innerHTML = groups.map((group, gi) => buildInvestmentsGroupCardHTML(group, gi)).join('');
    renderPriceCharts();
  }

  function renderPocketBalances() {
    const strip = document.getElementById('pocketBalanceStrip');
    const total = totalPocketBalance();
    strip.innerHTML = `<div class="balance-card total">
      <div class="balance-card-head"><span class="label">Total em Caixinhas</span><span class="balance-symbol" aria-hidden="true"><i class="fi fi-rr-piggy-bank" aria-hidden="true"></i></span></div>
      <span class="amount">${fmt(total)}</span>
    </div>`;
  }

  function renderPockets() {
    const container = document.getElementById('pocketGrid');
    if (pockets.length === 0) {
      container.innerHTML = `<div class="empty" style="grid-column: 1 / -1;">Nenhuma caixinha cadastrada. Clique em "+ Nova Caixinha" para começar.</div>`;
      return;
    }
    container.innerHTML = pockets.map((p, index) => {
      const current = pocketCurrentBalance(p);
      const sourceBank = banks.find(b => b.id === p.sourceBankId);
      const goalAmount = Number(p.goalAmount) || 0;
      const goalPercent = goalAmount > 0 ? Math.min(100, Math.max(0, current / goalAmount * 100)) : null;
      const goalHTML = goalAmount > 0 ? `<div class="pocket-goal"><div class="pocket-goal-head"><span>${escapeHTML(p.goal || 'Meta da caixinha')}</span><strong>${goalPercent.toFixed(0).replace('.', ',')}%</strong></div><div class="pocket-goal-track"><span style="width:${goalPercent.toFixed(2)}%"></span></div><div class="pocket-goal-values">${fmt(current)} de ${fmt(goalAmount)}</div></div>` : (p.goal ? `<div class="units">${escapeHTML(p.goal)}</div>` : '');
      return `<div class="invest-box pocket-box" data-item-id="${p.id}">
        <button type="button" class="drag-handle" aria-label="Segurar para mover caixinha" title="Segure para mover">
          <i class="fi fi-rr-layers" aria-hidden="true"></i>
        </button><h4><span>${escapeHTML(p.name)}</span></h4><div class="val">${fmt(current)}</div>${rentabilityHTML('pocket', p.id, current)}${goalHTML}${sourceBank ? `<div class="units">Banco de origem: ${escapeHTML(sourceBank.name)}</div>` : '<div class="units">Banco de origem: A definir</div>'}${yieldHistoryHTML('pocket', p.id)}<div class="item-action-row"><div class="reorder-actions"><button type="button" class="action-btn" onclick="movePocket('${p.id}',-1)" ${index===0?'disabled':''} aria-label="Mover caixinha para cima" title="Mover para cima">↑</button><button type="button" class="action-btn" onclick="movePocket('${p.id}',1)" ${index===pockets.length-1?'disabled':''} aria-label="Mover caixinha para baixo" title="Mover para baixo">↓</button></div><button type="button" class="action-btn icon-button move" onclick="openPocketMovementModal('aporte','${p.id}')" aria-label="Movimentações da caixinha"></button><button type="button" class="action-btn icon-button edit" onclick="editPocket('${p.id}')" aria-label="Editar caixinha"></button><button type="button" class="action-btn icon-button delete" onclick="deletePocket('${p.id}')" aria-label="Excluir caixinha"></button></div></div>`;
    }).join('');
      setupDisplayCardDrag(container, 'pockets');
  }

  function getSelectedFilterValues(id) {
    const select = document.getElementById(id);
    return select ? Array.from(select.selectedOptions).map(option => option.value).filter(Boolean) : [];
  }

  function clearSelectedFilterValues(id) {
    const select = document.getElementById(id);
    if (select) Array.from(select.options).forEach(option => { option.selected = false; });
  }

  let activeFilterChoice;

  let filterChoiceSearchTerm;
  let catPickerSearchTerm;


  function filterChoiceConfig(target) {
    return target === 'bank' ? { selectId: 'filterBank', summaryId: 'filterBankSummary', title: 'Escolha os bancos', subtitle: 'Selecione um ou mais bancos para filtrar.', placeholder: 'Buscar banco ou conta', items: banks } : { selectId: 'filterCategory', summaryId: 'filterCategorySummary', title: 'Escolha as categorias', subtitle: 'Selecione uma ou mais categorias para filtrar.', placeholder: 'Buscar categoria', items: categories };
  }

  function refreshFilterChoiceSummaries() {
    const bankCount = getSelectedFilterValues('filterBank').length;
    const categoryCount = getSelectedFilterValues('filterCategory').length;
    const bankSummary = document.getElementById('filterBankSummary');
    const categorySummary = document.getElementById('filterCategorySummary');
    if (bankSummary) bankSummary.textContent = bankCount ? `${bankCount} selecionado${bankCount === 1 ? '' : 's'}` : 'Todos os bancos';
    if (categorySummary) categorySummary.textContent = categoryCount ? `${categoryCount} selecionada${categoryCount === 1 ? '' : 's'}` : 'Todas as categorias';
  }

  function renderFilterChoiceList() {
    if (!activeFilterChoice) return;
    const config = filterChoiceConfig(activeFilterChoice);
    const selected = new Set(getSelectedFilterValues(config.selectId));
    const query = filterChoiceSearchTerm.toLocaleLowerCase('pt-BR');
    const items = config.items.filter(item => !query || String(item.name || '').toLocaleLowerCase('pt-BR').includes(query));
    const list = document.getElementById('filterChoiceList');
    if (!list) return;
    list.innerHTML = items.length ? items.map(item => `<label class="filter-choice-option ${selected.has(item.id) ? 'is-selected' : ''}"><input type="checkbox" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span>${escapeHTML(item.name)}</span></label>`).join('') : '<div class="filter-choice-empty">Nenhuma opção encontrada.</div>';
    list.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
      const select = document.getElementById(config.selectId);
      const option = Array.from(select.options).find(current => current.value === input.value);
      if (option) option.selected = input.checked;
      input.closest('.filter-choice-option')?.classList.toggle('is-selected', input.checked);
      refreshFilterChoiceSummaries();
    }));
  }

  function openFilterChoice(target) {
    activeFilterChoice = target;
    filterChoiceSearchTerm = '';
    const config = filterChoiceConfig(target);
    const sheet = document.getElementById('filterChoiceSheet');
    const search = document.getElementById('filterChoiceSearch');
    if (!sheet || !search) return;

    // V19-20: submodal de filtro com fechamento determinístico.
    // Ordem importa: adicionar .open e sheet-open ANTES de renderFilterChoiceList
    // para que uma exceção no render não deixe o sheet sem .open (invisível,
    // recortado por overflow:hidden do painel).
    sheet.style.display = 'flex';
    sheet.style.visibility = 'visible';
    sheet.style.pointerEvents = 'auto';
    sheet.style.transform = '';
    document.getElementById('filterChoiceTitle').textContent = config.title;
    document.getElementById('filterChoiceSubtitle').textContent = config.subtitle;
    search.placeholder = config.placeholder;
    search.value = '';
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
    document.getElementById('panelFiltros')?.classList.add('sheet-open');
    try {
      renderFilterChoiceList();
    } catch (err) {
      console.error('[filterChoice] Falha ao renderizar lista:', err);
      const list = document.getElementById('filterChoiceList');
      if (list) list.innerHTML = '<div class="filter-choice-empty">Não foi possível carregar as opções.</div>';
    }
  }

  function closeFilterChoice() {
    activeFilterChoice = null;
    filterChoiceSearchTerm = '';

    const sheet = document.getElementById('filterChoiceSheet');

    if (sheet) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');

      // Impede que bancos/categorias permaneçam visíveis
      // sobre o modal ou outra camada da aplicação.
      sheet.style.display = 'none';
      sheet.style.visibility = 'hidden';
      sheet.style.pointerEvents = 'none';
      sheet.style.transform = 'translateY(105%)';

      const list = document.getElementById('filterChoiceList');
      if (list) list.replaceChildren();

      const search = document.getElementById('filterChoiceSearch');
      if (search) search.value = '';
    }

    document.getElementById('panelFiltros')?.classList.remove('sheet-open');
  }

  function populateFilterControls(isInitial = false) {
    const flowSel = document.getElementById('filterFlow');
    const bankSel = document.getElementById('filterBank');
    const catSel = document.getElementById('filterCategory');
    const currFlowVal = flowSel.value;
    const currBankVals = getSelectedFilterValues('filterBank');
    const currCatVals = getSelectedFilterValues('filterCategory');

    flowSel.value = currFlowVal || '';

    bankSel.innerHTML = banks.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('');
    Array.from(bankSel.options).forEach(option => { option.selected = currBankVals.includes(option.value); });

    catSel.innerHTML = categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    Array.from(catSel.options).forEach(option => { option.selected = currCatVals.includes(option.value); });
    refreshFilterChoiceSummaries();
  }

  function getFilteredEntries() {
    const flow = document.getElementById('filterFlow').value;
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;
    const selectedBanks = getSelectedFilterValues('filterBank');
    const selectedCategories = getSelectedFilterValues('filterCategory');
    const query = (document.getElementById('filterText')?.value || '').trim().toLocaleLowerCase('pt-BR');

    return entries.filter(e => {
      if (!periodMatchesDate(e.date)) return false;
      if (flow && e.type !== flow) return false;
      if (dateStart && e.date < dateStart) return false;
      if (dateEnd && e.date > dateEnd) return false;
      if (selectedBanks.length && !selectedBanks.includes(e.bank)) return false;
      if (selectedCategories.length && !selectedCategories.includes(e.category)) return false;
      if (query) {
        const bankName = banks.find(bank => bank.id === e.bank)?.name || '';
        const categoryName = categories.find(cat => cat.id === e.category)?.name || '';
        if (![e.desc, bankName, categoryName].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query))) return false;
      }
      return true;
    });
  }

  /* Transferências entre contas: não devem ser contadas como entradas/saídas.
     Fonte compartilhada por resumo de categorias e pelo Dashboard (dash). */
  function transferCategoryIds() {
    return new Set(categories.filter(c => normalizeTextKey(c.name) === 'transferencia').map(c => c.id));
  }
  function isTransferEntry(entry, transferCatIds) {
    const set = transferCatIds || transferCategoryIds();
    return set.has(entry.category) || normalizeTextKey(entry.desc).startsWith('transferencia para ');
  }
  function categoryTypeTotals(mode, list) {
    const transferCatIds = transferCategoryIds();
    return categories
      .map(c => ({
        cat: c,
        total: list.filter(e => e.type === mode && e.category === c.id && !isTransferEntry(e, transferCatIds)).reduce((s, e) => s + e.amount, 0)
      })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  }
  function groupCategoryRowsForChart(totals, totalSpend, minPct = 0) {
    if (minPct > 0 && totalSpend > 0) {
      const kept = [];
      let othersTotal = 0;
      for (const x of totals) {
        const pct = (x.total / totalSpend) * 100;
        if (pct >= minPct) kept.push(x);
        else othersTotal += x.total;
      }
      if (othersTotal > 0) kept.push({ cat: { id: '__others__', name: 'Outras', color: '#8B9A92' }, total: othersTotal });
      kept.sort((a, b) => b.total - a.total);
      return kept.length > 7 ? [...kept.slice(0, 6), { cat: { id: '__others__', name: 'Outras', color: '#8B9A92' }, total: kept.slice(6).reduce((sum, item) => sum + item.total, 0) }] : kept;
    }
    return totals.length > 7
      ? [...totals.slice(0, 6), { cat: { id: '__others__', name: 'Outras', color: '#8B9A92' }, total: totals.slice(6).reduce((sum, item) => sum + item.total, 0) }]
      : totals;
  }

  /* Piso de 4% para fatias de pizza: fatias menores que 4% do total ocupam
     4% da área do gráfico (senão ficam invisíveis). Os valores exibidos em
     tooltip/legenda continuam sendo os reais — nunca este array. */
  function pieSliceDisplayData(rows, total, minPct = 4) {
    if (!rows.length || !(total > 0)) return rows.map((row) => row.total);
    const floor = total * (minPct / 100);
    return rows.map((row) => Math.max(row.total, floor));
  }

  function updateCatViewPill(wrap) {
    if (!wrap) return;
    const buttons = wrap.querySelectorAll('[data-cat-chart-view]');
    if (!buttons.length) return;
    const active = wrap.querySelector('[data-cat-chart-view].is-active') || buttons[0];
    const rect = active.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const padding = 3;
    wrap.style.setProperty('--pill-left', `${rect.left - wrapRect.left - padding}px`);
    wrap.style.setProperty('--pill-width', `${rect.width + padding * 2}px`);
    wrap.style.setProperty('--pill-height', `${rect.height + padding * 2}px`);
  }

  function renderCategorySummary() {
    const flowVal = document.getElementById('filterFlow').value;
    renderCategoryChartCard('categorySummary', flowVal === 'in' ? 'in' : 'out');
  }

  function destroyCatCharts() {
    if (catChartOutsideClickHandler) {
      document.removeEventListener('click', catChartOutsideClickHandler);
      catChartOutsideClickHandler = null;
    }
    ['out', 'in'].forEach(key => {
      if (catChartInstances[key]) {
        catChartInstances[key].destroy();
        catChartInstances[key] = null;
      }
    });
  }

  function renderCategoryChartCard(wrapId, mode) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const viewMode = wrap.dataset.catChartView === 'bar' ? 'bar' : 'pie';
    const isBarView = viewMode === 'bar';
    const activeEntries = getFilteredEntries();
    const totals = categoryTypeTotals(mode, activeEntries);

    if (totals.length === 0) {
      destroyCatCharts();
      wrap.innerHTML = '';
      return;
    }
    const totalSpend = totals.reduce((sum, item) => sum + item.total, 0);
    const leader = totals[0];
    const chartSpend = groupCategoryRowsForChart(totals, totalSpend, 2);
    const max = chartSpend[0].total;
    const isIncome = mode === 'in';
    const canvasId = isIncome ? 'catIncomePieChart' : 'catPieChart';

    const flowVal = document.getElementById('filterFlow').value;
    const ds = document.getElementById('filterDateStart').value;
    const de = document.getElementById('filterDateEnd').value;
    let subtitle = '';
    if (!isIncome) {
      if (flowVal === 'in') subtitle = '— Entradas';
      else if (flowVal === 'out') subtitle = '— Saídas';
    }
    if (ds || de) subtitle += `${subtitle ? ' · ' : '— '}${ds ? ds.split('-').reverse().join('/') : 'Início'} até ${de ? de.split('-').reverse().join('/') : 'Hoje'}`;

    destroyCatCharts();

    const title = isIncome ? 'Entradas por Categoria' : 'Gastos por Categoria';
    const leaderLabel = isIncome ? 'Maior entrada' : 'Maior gasto';

    wrap.innerHTML = `<div class="cat-summary${isBarView ? ' is-bar' : ''}">
      <div class="cat-summary-head">
        <h3>${title} ${subtitle}</h3>
        <div class="cat-view-toggle" role="group" aria-label="Modo de visualização do gráfico">
          <button type="button" class="${viewMode === 'pie' ? 'is-active' : ''}" data-cat-chart-view="pie" aria-pressed="${viewMode === 'pie'}" aria-label="Gráfico de pizza" title="Gráfico de pizza"><i class="fi fi-rr-chart-pie" aria-hidden="true"></i></button>
          <button type="button" class="${viewMode === 'bar' ? 'is-active' : ''}" data-cat-chart-view="bar" aria-pressed="${viewMode === 'bar'}" aria-label="Gráfico de barras" title="Gráfico de barras"><i class="fi fi-rr-chart-histogram" aria-hidden="true"></i></button>
        </div>
      </div>
      <p class="cat-summary-leader">${leaderLabel}: <strong>${escapeHTML(leader.cat.name)}</strong> · ${(leader.total / totalSpend * 100).toFixed(1).replace('.', ',')}%</p>
      <div class="cat-summary-content">
        <div class="chart-container">
          <canvas id="${canvasId}" role="img" aria-label="${isBarView ? 'Gráfico de barras' : 'Gráfico de pizza'} de ${isIncome ? 'entradas' : 'gastos'} por categoria"></canvas>
          <div class="chart-center-total" aria-hidden="true">
            <span class="chart-center-total-label">Total</span>
            <strong class="chart-center-total-value">${fmt(totalSpend)}</strong>
          </div>
        </div>
        <div class="cat-bars-list">
          <div class="cat-legend-head"><span>Categoria</span><span>Movimentação</span><span>%</span></div>
          ${chartSpend.map(x => `
            <div class="cat-row" style="--category-color:${categoryColor(x.cat)}">
              <span class="cat-name">${escapeHTML(x.cat.name)}</span>
              <span class="cat-bar-wrap"><div class="cat-bar" style="width:${(x.total / max * 100).toFixed(0)}%"></div></span>
              <span class="cat-amt">${fmt(x.total)}</span>
              <span class="cat-pct">${(x.total / totalSpend * 100).toFixed(1).replace('.', ',')}%</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;

    wrap.querySelectorAll('[data-cat-chart-view]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const next = button.getAttribute('data-cat-chart-view');
        if (!next || next === viewMode) return;
        wrap.dataset.catChartView = next;
        renderCategoryChartCard(wrapId, mode);
      });
    });

    const ctx = document.getElementById(canvasId);
    if (ctx && typeof Chart !== 'undefined') {
      const isDark = document.body.classList.contains('dark-mode');
      const textColor = getComputedStyle(document.body).getPropertyValue('--ink').trim() || (isDark ? '#E3E8E4' : '#1C2B24');
      const borderColor = getComputedStyle(document.body).getPropertyValue('--paper').trim() || (isDark ? '#121915' : '#F7F5EF');
      const gridColor = getComputedStyle(document.body).getPropertyValue('--line').trim() || (isDark ? '#2A3A2E' : '#E1E1D9');
      const isMobileLayout = window.matchMedia('(max-width: 680px)').matches;
      const tooltipCallbacks = {
        label: function(context) {
          const val = context.raw || 0;
          const formatted = fmt(val);
          return isMobileLayout ? ' ' + formatted : ' ' + context.label + ': ' + formatted;
        }
      };
      if (isMobileLayout) tooltipCallbacks.title = function() { return []; };

      const baseSliceColors = chartSpend.map(x => categoryColor(x.cat));
      let activeSliceIndex = null;
      const dimSliceColor = (color) => {
        if (typeof color !== 'string') return color;
        if (/^#[0-9a-fA-F]{6}$/.test(color)) return color + '40';
        const hslMatch = color.match(/^hsl\((.+)\)$/);
        if (hslMatch) return 'hsla(' + hslMatch[1] + ', 0.3)';
        return color;
      };
      const applyActiveSlice = () => {
        const valueEl = wrap.querySelector('.chart-center-total-value');
        if (valueEl) {
          const slice = activeSliceIndex === null ? null : chartSpend[activeSliceIndex];
          valueEl.textContent = fmt(slice ? slice.total : totalSpend);
        }
        const chart = catChartInstances[mode];
        if (!chart) return;
        chart.data.datasets[0].backgroundColor = baseSliceColors.map((color, sliceIndex) => (activeSliceIndex === null || sliceIndex === activeSliceIndex) ? color : dimSliceColor(color));
        if (!isBarView) {
          chart.data.datasets[0].offset = chartSpend.map((_, sliceIndex) => sliceIndex === activeSliceIndex ? 6 : 0);
        }
        chart.update();
      };
      const toggleActiveSlice = (index) => {
        activeSliceIndex = activeSliceIndex === index ? null : index;
        applyActiveSlice();
      };

      const centerTotalOverlayPlugin = {
        id: 'centerTotalOverlay',
        afterDraw: function(chart) {
          const overlay = wrap.querySelector('.chart-center-total');
          const area = chart.chartArea;
          if (!overlay || !area) return;
          const width = chart.width || 0;
          const height = chart.height || 0;
          if (!width || !height) return;
          overlay.style.left = (((area.left + area.right) / 2) / width * 100) + '%';
          overlay.style.top = (((area.top + area.bottom) / 2) / height * 100) + '%';
        }
      };

      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        onClick: function(event, elements) {
          if (elements.length) toggleActiveSlice(elements[0].index);
          else if (activeSliceIndex !== null) {
            activeSliceIndex = null;
            applyActiveSlice();
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        }
      };
      if (isBarView) {
        chartOptions.indexAxis = 'y';
        chartOptions.scales = {
          x: {
            display: true,
            grid: { color: gridColor, drawTicks: false },
            border: { display: false },
            ticks: { display: false }
          },
          y: {
            display: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: textColor,
              font: { size: isMobileLayout ? 8 : 9 },
              autoSkip: false,
              padding: 4,
              callback: function(value) {
                const label = this.getLabelForValue(value);
                return label.length > 18 ? label.slice(0, 17) + '…' : label;
              }
            }
          }
        };
      } else {
        chartOptions.cutout = isMobileLayout ? '67%' : '62%';
      }

      catChartInstances[mode] = new Chart(ctx, {
        type: isBarView ? 'bar' : 'doughnut',
        plugins: isBarView ? [] : [centerTotalOverlayPlugin],
        data: {
          labels: chartSpend.map(x => x.cat.name),
          datasets: [{
            data: isBarView ? chartSpend.map(x => x.total) : pieSliceDisplayData(chartSpend, totalSpend),
            backgroundColor: baseSliceColors,
            borderColor: isBarView ? 'transparent' : borderColor,
            borderWidth: isBarView ? 0 : 2,
            borderRadius: isBarView ? 7 : 6,
            borderSkipped: false,
            barPercentage: 0.72,
            categoryPercentage: 0.82
          }]
        },
        options: chartOptions
      });

      wrap.querySelectorAll('.cat-bars-list .cat-row').forEach((row, index) => {
        row.addEventListener('click', () => toggleActiveSlice(index));
      });

      if (catChartOutsideClickHandler) document.removeEventListener('click', catChartOutsideClickHandler);
      catChartOutsideClickHandler = (event) => {
        if (activeSliceIndex === null) return;
        const target = event.target;
        if (target instanceof Element && wrap.contains(target) && (target.closest('.chart-container') || target.closest('.cat-bars-list .cat-row'))) return;
        activeSliceIndex = null;
        applyActiveSlice();
      };
      document.addEventListener('click', catChartOutsideClickHandler);

      updateCatViewPill(wrap);
    }
  }

  function renderLedger() {
    const body = document.getElementById('ledgerBody');
    const filtered = getFilteredEntries();

    document.getElementById('ledgerCount').textContent = filtered.length + ' lançamento(s)';

    if (filtered.length === 0) {
      body.innerHTML = `<div class="empty">Nenhum lançamento encontrado para os filtros selecionados.</div>`;
      return;
    }

    const sorted = [...filtered].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      // Dentro do mesmo dia: ordem de criação, mais recente primeiro (padrão bancário).
      // IDs de lançamento começam com 'e' + timestamp, então a comparação de string já reflete a ordem cronológica.
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

        let html = '';
    sorted.forEach(e => {
      const bank = banks.find(b => b.id === e.bank);
      const cat = categories.find(c => c.id === e.category);
      const dateFmt = e.date.split('-').reverse().join('/');

      // Define as cores e sinais baseado se é entrada (in) ou saída (out)
      const tipoClasse = e.type === 'in' ? 'receita' : 'despesa';
      const sinal = e.type === 'in' ? '+' : '−';

      // Monta o novo Card usando as suas variáveis
      html += `
        <div class="card-lancamento">
          <div class="card-left">
            <div class="card-border-line"><span class="movement-category-icon">${escapeHTML(categoryIcon(cat, e.type))}</span></div>
            <div class="card-info">
              <span class="card-date">${dateFmt}</span>
              <h3 class="card-title" title="${escapeHTML(e.desc)}" onclick="this.classList.toggle('is-expanded')">${escapeHTML(e.desc)}</h3>
              <span class="card-meta"><span class="card-badge">${bank ? escapeHTML(bank.name) : 'Banco não informado'}</span><span class="card-category" style="--category-color:${categoryColor(cat)}">${cat ? escapeHTML((() => { const sub = e.subcategory && Array.isArray(cat.subcategories) ? cat.subcategories.find(s => s.id === e.subcategory) : null; return sub ? `${cat.name} › ${sub.name}` : cat.name; })()) : 'Sem categoria'}</span></span>
            </div>
          </div>

          <div class="card-right">
            <span class="card-amount ${tipoClasse}">${sinal} ${fmt(Math.abs(e.amount))}</span>
            <div class="card-actions">
              <button type="button" class="action-btn icon-button history" onclick="openEntryHistory('${e.id}')" aria-label="Histórico do lançamento" title="Histórico do lançamento"></button>
              <button type="button" class="action-btn icon-button edit" onclick="editEntry('${e.id}')" aria-label="Editar lançamento" title="Editar lançamento"></button>
              <button type="button" class="action-btn icon-button delete" onclick="deleteEntry('${e.id}')" aria-label="Excluir lançamento" title="Excluir lançamento"></button>
            </div>
          </div>
        </div>
      `;
    });

    body.innerHTML = html;
  }

  function normalizeFeatureSettings(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const graceRaw = String(source.lockGraceMinutes ?? '').trim();
    const graceNum = Number(graceRaw);
    return {
      autoLaunchRecurring: source.autoLaunchRecurring === true,
      reminders: source.reminders !== false,
      pushNotifications: source.pushNotifications === true,
      autoRefreshQuotes: source.autoRefreshQuotes === true,
      quoteRefreshMinutes: Math.min(1440, Math.max(1, Number(source.quoteRefreshMinutes) || 15)),
      projectionMonths: Math.min(24, Math.max(1, Number(source.projectionMonths) || 6)),
      autoCategorization: source.autoCategorization === true,
      reminderAdvanceDays: Math.min(30, Math.max(0, Number(source.reminderAdvanceDays) || 0)),
      monthlySavingsGoal: Math.max(0, Number(source.monthlySavingsGoal) || 0),
      lockOnOpen: source.lockOnOpen !== false,
      lockGraceMinutes: graceRaw !== '' && Number.isFinite(graceNum) ? Math.min(30, Math.max(0, Math.round(graceNum))) : 5
    };
  }
  function loadFeatureSettings() {
    try { featureSettings = normalizeFeatureSettings(JSON.parse(localStorage.getItem(FEATURE_SETTINGS_KEY) || '{}')); } catch (err) { featureSettings = normalizeFeatureSettings(); }
  }
  function persistFeatureSettings() {
    try { localStorage.setItem(FEATURE_SETTINGS_KEY, JSON.stringify(featureSettings)); } catch (err) {}
  }

  // V19-20: preferências do Perfil também acompanham a conta na nuvem.
  function normalizeProfileSettings(raw = {}, base = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const local = base && typeof base === 'object' ? base : {};
    const remoteFeatures = source.featureSettings && typeof source.featureSettings === 'object'
      ? source.featureSettings
      : {};
    const localFeatures = local.featureSettings && typeof local.featureSettings === 'object'
      ? local.featureSettings
      : {};

    const merged = {
      featureSettings: normalizeFeatureSettings({ ...localFeatures, ...remoteFeatures }),
      financialCycleStartDay: Number.isFinite(Number(local.financialCycleStartDay))
        ? Math.min(28, Math.max(1, Number(local.financialCycleStartDay)))
        : 1
    };

    if (Object.prototype.hasOwnProperty.call(source, 'financialCycleStartDay')) {
      const remoteDay = Number(source.financialCycleStartDay);
      if (Number.isFinite(remoteDay) && remoteDay >= 1 && remoteDay <= 28) {
        merged.financialCycleStartDay = Math.min(28, Math.max(1, remoteDay));
      }
    }

    return merged;
  }

  async function loadProfileSettingsFromCloud() {
    if (!currentUser) return;
    try {
      const snap = await docRef().get();
      if (!snap.exists) return;

      const data = snap.data() || {};
      if (!data.profileSettings || typeof data.profileSettings !== 'object') {
        // V19-20: conta antiga ainda sem preferências de Perfil na nuvem.
        // Mantém as preferências locais para não sobrescrever configurações válidas.
        return;
      }

      const local = {
        featureSettings: normalizeFeatureSettings(featureSettings || {}),
        financialCycleStartDay: getFinancialCycleStartDay()
      };

      const remote = normalizeProfileSettings(data.profileSettings, local);
      featureSettings = remote.featureSettings;
      persistFeatureSettings();

      localStorage.setItem(
        FINANCIAL_CYCLE_STORAGE_KEY,
        String(remote.financialCycleStartDay)
      );

      const cycleInput = document.getElementById('inputFinancialCycleDay');
      if (cycleInput) cycleInput.value = remote.financialCycleStartDay;
    } catch (err) {
      console.warn('[Perfil] Preferências remotas indisponíveis:', err);
      logWarn(
        'Perfil',
        'Carregar preferências',
        'Parcial',
        'As preferências locais continuam disponíveis neste aparelho.',
        { code: err?.code || null }
      );
    }
  }

  async function persistProfileSettings() {
    if (!currentUser) return;

    const profileSettings = {
      featureSettings: normalizeFeatureSettings(featureSettings),
      financialCycleStartDay: getFinancialCycleStartDay(),
      updatedAt: new Date().toISOString()
    };

    await docRef().set({ profileSettings }, { merge: true });
  }

  function sanitizePushToken(token) {
    return String(token || '').replace(/\//g, '_');
  }

  function setupPushForegroundHandler() {
    if (pushForegroundBound) return;
    if (typeof firebase === 'undefined' || !firebase.messaging || !firebase.messaging.isSupported()) return;
    pushForegroundBound = true;
    firebase.messaging().onMessage(payload => {
      const data = payload && payload.data ? payload.data : {};
      const notice = payload && payload.notification ? payload.notification : {};
      const title = notice.title || data.title || 'Livro-Caixa';
      const body = notice.body || data.body || '';
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, { body, icon: './icon-192.png', badge: './icon-192.png', tag: data.tag || undefined });
      }).catch(() => {});
    });
  }

  async function setPushNotifications(enabled) {
    const toggle = document.getElementById('featurePushNotifications');
    if (!enabled) {
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: false });
      persistFeatureSettings();
      if (toggle) toggle.checked = false;
      try {
        const savedToken = localStorage.getItem(FCM_TOKEN_KEY);
        if (savedToken && currentUser) await docRef().collection('pushTokens').doc(sanitizePushToken(savedToken)).delete();
        localStorage.removeItem(FCM_TOKEN_KEY);
      } catch (err) { logSyncError('notificações push', err); }
      persistProfileSettings().catch(err => logSyncError('preferência de notificações', err));
      return;
    }
    const revertPushToggle = () => { setTimeout(() => { if (toggle) toggle.checked = false; }, 300); };
    try {
      if (!('Notification' in window)) throw new Error('Este navegador não suporta notificações.');
      if (typeof firebase === 'undefined' || !firebase.messaging || !firebase.messaging.isSupported()) throw new Error('Notificações push não são suportadas neste navegador.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        if (toggle) toggle.checked = false;
        alert('Permissão de notificações não concedida. Ative-a nas configurações do navegador para usar notificações push.');
        return;
      }
      const vapidKey = window.__FCM_VAPID_KEY;
      if (!vapidKey) {
        revertPushToggle();
        alert('Configure a chave VAPID (Web Push) em app.js no campo window.__FCM_VAPID_KEY antes de ativar as notificações push.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const token = await firebase.messaging().getToken({ vapidKey, serviceWorkerRegistration: registration });
      if (!token) throw new Error('Não foi possível gerar o token de notificação.');
      localStorage.setItem(FCM_TOKEN_KEY, token);
      if (currentUser) {
        await docRef().collection('pushTokens').doc(sanitizePushToken(token)).set({ token, createdAt: todayISO(), updatedAt: new Date().toISOString() }, { merge: true });
      }
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: true });
      persistFeatureSettings();
      if (toggle) toggle.checked = true;
      setupPushForegroundHandler();
      await persistProfileSettings();
    } catch (err) {
      revertPushToggle();
      featureSettings = normalizeFeatureSettings({ ...featureSettings, pushNotifications: false });
      persistFeatureSettings();
      logSyncError('notificações push', err);
      alert('Não foi possível ativar as notificações push: ' + (err && err.message ? err.message : String(err)));
    }
  }

  /* =====================================================================
     [JS INDICADORES] BCB SGS + Tesouro Nacional — camada de exibição.

     Consome window.LivroCaixaFinancial (js/domain/financial-client.js) e serve
     apenas três superfícies de leitura: seção do Dashboard, contexto da
     IA e uma linha de referência nos cards de Renda Fixa/Tesouro.

     Regras desta camada:
     - não escreve nem lê o modelo financeiro (saldos, investimentos,
       caixinhas e cartões continuam exatamente os mesmos);
     - cotação de cripto continua exclusiva do CoinGecko;
     - não envia token: /financial é rota pública do Worker.

     Persistência: snapshot no documento raiz, campo aditivo
     "financialIndicators" gravado com { merge: true } — mesmo padrão de
     profileSettings. Campo ausente ou inválido em conta antiga não
     quebra nada (sem indicadores até a próxima busca) e versões antigas
     do app simplesmente ignoram o campo.
     ===================================================================== */
  let FINANCIAL_INDICATORS_DOC_FIELD;

  let financialIndicatorsPersistedJson;

  let financialIndicatorsOwnerUid;

  let financialIndicatorsWarnedNoClient;

  let financialIndicatorsLastError;


  function financialIndicatorsClient() {
    const client = window.LivroCaixaFinancial;
    return client && typeof client.getIndicators === 'function' ? client : null;
  }

  function financialIndicatorsState() {
    const client = financialIndicatorsClient();
    if (!client) return null;
    const snapshot = typeof client.getSnapshot === 'function' ? client.getSnapshot() : null;
    if (!snapshot || !snapshot.indicators || !Object.keys(snapshot.indicators).length) return null;
    const state = typeof client.getState === 'function' ? client.getState() : {};
    return {
      indicators: snapshot.indicators,
      fetchedAt: snapshot.fetchedAt || '',
      status: state.status || 'ready',
      errors: Array.isArray(state.lastErrors) ? state.lastErrors : []
    };
  }

  function financialIndicatorsSnapshot() {
    const info = financialIndicatorsState();
    return info ? info.indicators : null;
  }

  function formatIndicatorDate(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : '';
  }

  function formatIndicatorMonth(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7).split('-').reverse().join('/') : '';
  }

  function formatIndicatorPercent(value, digits) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(digits).replace('.', ',')}%`;
  }

  async function loadFinancialIndicatorsFromCloud() {
    const client = financialIndicatorsClient();
    if (!client || !currentUser) return null;
    try {
      /* Troca de conta no mesmo aparelho: o snapshot anterior é de outra
         pessoa e não pode ser reaproveitado nem persistido por engano. */
      if (financialIndicatorsOwnerUid && financialIndicatorsOwnerUid !== currentUser.uid) {
        if (typeof client.forget === 'function') client.forget();
        financialIndicatorsPersistedJson = '';
      }
      financialIndicatorsOwnerUid = currentUser.uid;

      const snap = await docRef().get();
      if (!currentUser) return null;
      const raw = snap && snap.exists ? snap.data()?.[FINANCIAL_INDICATORS_DOC_FIELD] : null;
      const restored = typeof client.restoreFromPersisted === 'function'
        ? client.restoreFromPersisted(raw)
        : null;
      if (restored) financialIndicatorsPersistedJson = JSON.stringify(restored);
      return restored;
    } catch (err) {
      /* Offline ou leitura negada: segue sem cache remoto — a busca
         abaixo recria os indicadores em memória. */
      return null;
    }
  }

  async function persistFinancialIndicators() {
    const client = financialIndicatorsClient();
    if (!client || !currentUser) return false;

    let payload = null;
    try {
      payload = typeof client.snapshotToPersist === 'function' ? client.snapshotToPersist() : null;
    } catch (err) {
      return false;
    }
    if (!payload) return false;

    const json = JSON.stringify(payload);
    if (json === financialIndicatorsPersistedJson) return true;

    try {
      await docRef().set({ [FINANCIAL_INDICATORS_DOC_FIELD]: payload }, { merge: true });
      financialIndicatorsPersistedJson = json;
      return true;
    } catch (err) {
      console.warn('[Livro-Caixa] Indicadores não persistidos:', err?.code || err?.message || err);
      return false;
    }
  }

  /* Busca pública (sem login), mas só faz sentido com a tela pronta.
     O TTL do adaptador (6 h) impede nova leva de chamadas ao reabrir. */
  async function refreshFinancialIndicators(options = {}) {
    try {
      const client = financialIndicatorsClient();
      if (!client) {
        if (!financialIndicatorsWarnedNoClient) {
          financialIndicatorsWarnedNoClient = true;
          financialIndicatorsLastError = 'script_ausente';
          console.warn('[Livro-Caixa] Adaptador de indicadores não encontrado (js/domain/financial-client.js).');
          logWarn('Indicadores', 'Adaptador ausente', 'Falha', 'js/domain/financial-client.js não carregou nesta sessão.');
          renderIndicatorsSection();
        }
        return null;
      }

      const before = JSON.stringify(financialIndicatorsSnapshot());
      const snapshot = await client.getIndicators({ force: options.force === true });
      financialIndicatorsLastError = '';
      if (!snapshot) {
        renderIndicatorsSection();
        return null;
      }

      if (firstLoadDone && JSON.stringify(financialIndicatorsSnapshot()) !== before) render();
      await persistFinancialIndicators();
      return snapshot;
    } catch (err) {
      /* Camada de exibição: falha aqui nunca pode derrubar a tela — mas
         fica registrada para o usuário conseguir enxergar o motivo. */
      const code = (err && err.code) || (err && err.name) || 'erro';
      financialIndicatorsLastError = String(code);
      console.warn('[Livro-Caixa] Indicadores indisponíveis:', code, (err && err.message) || '');
      logWarn('Indicadores', 'Consulta ao Worker', 'Falha', `Sem indicadores externos (${code}). Saldos locais não foram afetados.`);
      renderIndicatorsSection();
      return null;
    } finally {
      renderAiIndicatorsStatus();
    }
  }

  /* Repinta só o Dashboard (e só quando ele está na tela), para o aviso de
     indisponibilidade aparecer sem depender de outra ação do usuário. */
  function renderIndicatorsSection() {
    if (!firstLoadDone || typeof currentTab === 'undefined' || currentTab !== 'dash') return;
    try {
      render();
    } catch (err) {
      console.warn('[Livro-Caixa] Repaint do Dashboard falhou:', err?.message || err);
    }
  }

  /* Chip no cabeçalho do chat da LIA: diz quais indicadores externos estão
     faltando, para a recusa de simulação não parecer misteriosa. */
  function renderAiIndicatorsStatus() {
    const el = document.querySelector('[data-ai-indicators]');
    if (!el) return;
    try {
      const info = financialIndicatorsState();
      const ind = info && info.indicators ? info.indicators : {};
      const names = { cdi: 'CDI', selic: 'Selic', ipca: 'IPCA', tesouro: 'Tesouro' };
      const missing = ['cdi', 'selic', 'ipca', 'tesouro'].filter((key) => !ind[key]);
      if (!missing.length) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      el.textContent = `Indicadores indisponíveis: ${missing.map((key) => names[key]).join(', ')}. Simulações da LIA com essas referências podem ficar limitadas até a consulta voltar.`;
    } catch (err) { /* chip é informativo; falha aqui não pode derrubar o refresh */ }
  }

  /* --- superfície 1: seção do Dashboard (somente leitura) --- */
  function renderDashIndicators() {
    const info = financialIndicatorsState();
    if (!info) return renderDashIndicatorsUnavailable();
    const ind = info.indicators;
    const rows = [];
    const add = (label, value, detail, icon) => rows.push(dashHealthMetric(label, value, 'neutral', detail, null, icon));

    if (ind.selic) {
      add('Selic (ao dia)', formatIndicatorPercent(ind.selic.value, 4),
        `Último valor apurado em ${formatIndicatorDate(ind.selic.date)}`, '％');
    }
    if (ind.cdi) {
      add('CDI (ao dia)', formatIndicatorPercent(ind.cdi.value, 4),
        `Último valor apurado em ${formatIndicatorDate(ind.cdi.date)}`, '％');
    }
    if (ind.ipca) {
      add('IPCA (mês)', formatIndicatorPercent(ind.ipca.value, 2),
        `Variação de ${formatIndicatorMonth(ind.ipca.date)}`, '％');
    }
    if (ind.tesouro && Array.isArray(ind.tesouro.titles)) {
      add('Tesouro Direto', `${ind.tesouro.titles.length} títulos`,
        `Taxas e preços do dia ${formatIndicatorDate(ind.tesouro.date)}`, '▤');
    }
    if (!rows.length) return '';

    const rowsHtml = rows.map(metric => `
      <div class="dash-metric">
        <div class="dash-metric-icon ${metric.tone}" aria-hidden="true">${metric.icon || ''}</div>
        <div class="dash-metric-content">
          <small>${escapeHTML(metric.label)}</small>
          <strong class="dash-metric-value ${metric.tone}">${escapeHTML(metric.value)}</strong>
          <span class="dash-metric-note">${escapeHTML(metric.detail)}</span>
        </div>
      </div>`).join('');

    const meta = info.fetchedAt
      ? `Atualizado em ${formatIndicatorDate(String(info.fetchedAt).slice(0, 10))}`
      : '';
    const missing = ['selic', 'cdi', 'ipca', 'tesouro'].filter(key => !ind[key]);
    const missingNote = missing.length
      ? `<p class="dashboard-footnote">Indicador(es) indisponível(is) no momento: ${escapeHTML(missing.join(', '))}. O app mantém o último valor conhecido.</p>`
      : '';

    return `
      <section class="dash-section dash-indicators-section" aria-label="Indicadores do mercado">
        ${dashSectionHead('08', 'Indicadores do mercado', 'Banco Central (SGS) e Tesouro Nacional — referência externa.', meta)}
        <div class="dash-metrics">${rowsHtml}</div>
        ${missingNote}
        <p class="dashboard-footnote">Fonte: BCB SGS e Tesouro Transparente, consultados pelo Worker do Livro-Caixa. Valores de referência; nenhum saldo seu é calculado a partir deles.</p>
      </section>`;
  }

  /* Sem snapshot a seção não some em silêncio: quando houve falha
     registrada, ela aparece dizendo o que travou. Nada de dado inventado. */
  function renderDashIndicatorsUnavailable() {
    const client = financialIndicatorsClient();
    const state = client && typeof client.getState === 'function' ? client.getState() : {};
    const codes = [];
    if (financialIndicatorsLastError) codes.push(financialIndicatorsLastError);
    (Array.isArray(state.lastErrors) ? state.lastErrors : []).forEach(err => {
      const code = err && err.code;
      if (code && !codes.includes(code)) codes.push(code);
    });
    if (!codes.length && state.status !== 'error') return '';

    const detail = codes.length ? ` (código: ${escapeHTML(codes.join(', '))})` : '';
    return `
      <section class="dash-section dash-indicators-section" aria-label="Indicadores do mercado">
        ${dashSectionHead('08', 'Indicadores do mercado', 'Banco Central (SGS) e Tesouro Nacional — referência externa.', 'indisponível')}
        <p class="dashboard-footnote">Os indicadores externos não puderam ser consultados agora${detail}. Nada dos seus dados foi afetado: saldos, lançamentos e cálculos continuam locais. A seção volta sozinha quando a consulta funcionar.</p>
      </section>`;
  }

  /* --- superfície 2: cards de Renda Fixa/Tesouro (só leitura) --- */
  function normalizeIndicatorKey(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function matchTesouroTitle(inv, tesouro) {
    if (!inv || !tesouro || !Array.isArray(tesouro.titles)) return null;
    const keys = [normalizeIndicatorKey(inv.alias), normalizeIndicatorKey(inv.name)]
      .filter(key => key.length >= 5);
    if (!keys.length) return null;

    /* O CSV separa "Tipo Titulo" de "Data Vencimento": o mesmo tipo
       (ex.: "Tesouro Selic") tem vários vencimentos e alguns tipos se
       contêm ("Tesouro Prefixado" e "… com Juros Semestrais"). Sem o
       vencimento do investimento o par seria ambíguo — nesse caso nada é
       exibido, em vez de apontar taxa/PU do título errado. */
    const due = typeof inv.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inv.dueDate)
      ? inv.dueDate
      : '';
    if (!due) return null;

    const candidates = tesouro.titles.filter(title => {
      if (!title || title.maturity !== due) return false;
      const name = normalizeIndicatorKey(title.name);
      if (!name) return false;
      return keys.some(key => name === key
        || key.startsWith(`${name} `)
        || name.startsWith(`${key} `)
        || name.includes(key));
    });

    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    /* Mesmo vencimento em duas variantes do tipo (ex.: "Tesouro Prefixado"
       e "… com Juros Semestrais" em 2027-01-01): fica o que o próprio
       investimento nomeia; empate vira "não mostra", nunca chute. */
    const wantsSemiannual = keys.some(key => key.includes('juros') || key.includes('semestrais'));
    const pool = candidates.filter(title => {
      const name = normalizeIndicatorKey(title.name);
      const semiannual = name.includes('juros') || name.includes('semestrais');
      return wantsSemiannual ? semiannual : !semiannual;
    });
    if (pool.length === 1) return pool[0];
    if (pool.length > 1) {
      const exact = pool.filter(title => keys.includes(normalizeIndicatorKey(title.name)));
      return exact.length === 1 ? exact[0] : null;
    }
    return null;
  }

  function investmentReferenceHTML(inv) {
    if (!inv || (inv.type !== 'Renda Fixa' && inv.type !== 'Tesouro')) return '';
    const ind = financialIndicatorsSnapshot();
    if (!ind) return '';

    const parts = [];
    if (ind.selic) parts.push(`Selic ${formatIndicatorPercent(ind.selic.value, 4)}`);
    if (ind.cdi) parts.push(`CDI ${formatIndicatorPercent(ind.cdi.value, 4)}`);

    const title = matchTesouroTitle(inv, ind.tesouro);
    if (title) {
      parts.push(`${title.name}: taxa ${formatIndicatorPercent(title.purchaseRate, 2)} · PU ${fmt(title.purchasePrice)}`);
    }

    if (!parts.length) return '';
    return `<span title="Referência externa (BCB/Tesouro), não altera este saldo">Ref.: ${escapeHTML(parts.join(' · '))}</span>`;
  }
  let pinUnlocked;

  let lastPinActivity;

  function localPinKey() { return `livrocaixa-local-pin-${currentUser?.uid || 'anonymous'}`; }
  function getLocalPinRecord() { try { return JSON.parse(localStorage.getItem(localPinKey()) || 'null'); } catch (err) { return null; } }
  async function hashLocalPin(pin) { const bytes = new TextEncoder().encode(String(pin)); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join(''); }
  function validLocalPin(pin) { return /^\d{4,8}$/.test(String(pin || '')); }
  async function saveLocalPin(pin) { if (!validLocalPin(pin)) throw new Error('O PIN deve ter entre 4 e 8 dígitos.'); localStorage.setItem(localPinKey(), JSON.stringify({ hash: await hashLocalPin(pin), createdAt: new Date().toISOString() })); pinUnlocked = true; markPinActivity(); }
  function removeLocalPin() { localStorage.removeItem(localPinKey()); removeBiometric(); pinUnlocked = true; hidePinOverlay(); clearPinActivity(); }
  function hasLocalPin() { const record = getLocalPinRecord(); return Boolean(record && typeof record.hash === 'string' && record.hash.length === 64); }
  function biometricKey() { return `livrocaixa-webauthn-${currentUser?.uid || 'anonymous'}`; }
  function getBiometricRecord() {
    try { return JSON.parse(localStorage.getItem(biometricKey()) || 'null'); } catch (e) { return null; }
  }
  function hasBiometric() {
    const rec = getBiometricRecord();
    return Boolean(rec && rec.credentialId);
  }
  function bufferToBase64Url(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';
    bytes.forEach(b => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  function base64UrlToBuffer(value) {
    const pad = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }
  function supportsWebAuthn() {
    return typeof window !== 'undefined' && window.PublicKeyCredential && typeof navigator.credentials?.create === 'function';
  }
  async function registerBiometric() {
    if (!currentUser) throw new Error('Faça login antes de ativar a biometria.');
    if (!hasLocalPin()) throw new Error('Ative um PIN local antes de vincular a biometria.');
    if (!supportsWebAuthn()) throw new Error('Este aparelho/navegador não oferece biometria via WebAuthn.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(String(currentUser.uid || 'user').slice(0, 64));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Livro-Caixa', id: location.hostname },
        user: { id: userId, name: currentUser.email || 'usuario', displayName: currentUser.displayName || 'Livro-Caixa' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (!cred) throw new Error('Registro biométrico cancelado.');
    const credentialId = bufferToBase64Url(cred.rawId);
    localStorage.setItem(biometricKey(), JSON.stringify({ credentialId, createdAt: new Date().toISOString() }));
    return true;
  }
  function removeBiometric() {
    localStorage.removeItem(biometricKey());
  }
  async function unlockWithBiometric() {
    if (!hasBiometric() || !supportsWebAuthn()) return false;
    const rec = getBiometricRecord();
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: base64UrlToBuffer(rec.credentialId) }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (!assertion) return false;
    pinUnlocked = true;
    hidePinOverlay();
    return true;
  }
  async function tryBiometricUnlockOnShow() {
    const btn = document.getElementById('btnBiometricUnlock');
    if (btn) btn.hidden = !(hasBiometric() && supportsWebAuthn());
    if (!(hasBiometric() && supportsWebAuthn())) return;
    try {
      await unlockWithBiometric();
      logInfo('Segurança', 'Desbloquear biometria', 'Sucesso', 'Aplicativo desbloqueado por biometria neste dispositivo.');
    } catch (err) {
      /* usuário cancelou ou falhou — permanece no PIN */
    }
  }

  function showPinOverlay() { if (!currentUser || !hasLocalPin() || pinUnlocked) return; const overlay = document.getElementById('pinOverlay'); overlay?.classList.remove('hidden'); overlay?.setAttribute('aria-hidden', 'false'); document.body.classList.add('is-pin-locked'); const bioBtn = document.getElementById('btnBiometricUnlock'); if (bioBtn) bioBtn.hidden = !(hasBiometric() && supportsWebAuthn()); setTimeout(() => { document.getElementById('pinUnlockInput')?.focus(); tryBiometricUnlockOnShow(); }, 0); }
  function hidePinOverlay() { markPinActivity(); const overlay = document.getElementById('pinOverlay'); overlay?.classList.add('hidden'); overlay?.setAttribute('aria-hidden', 'true'); document.body.classList.remove('is-pin-locked'); }
  async function unlockWithLocalPin(pin) { const record = getLocalPinRecord(); if (!record) { pinUnlocked = true; hidePinOverlay(); return true; } const valid = (await hashLocalPin(pin)) === record.hash; if (!valid) return false; pinUnlocked = true; hidePinOverlay(); return true; }
  function pinGraceMs() { const m = Number(featureSettings.lockGraceMinutes); return Number.isFinite(m) && m > 0 ? Math.round(m) * 60000 : 0; }
  function markPinActivity() { lastPinActivity = Date.now(); }
  function persistPinActivity() { try { if (pinUnlocked && hasLocalPin() && featureSettings.lockOnOpen !== false) sessionStorage.setItem('livrocaixa-pin-grace', String(lastPinActivity)); } catch (err) {} }
  function clearPinActivity() { lastPinActivity = 0; try { sessionStorage.removeItem('livrocaixa-pin-grace'); } catch (err) {} }
  function lockPinNow() { pinUnlocked = false; clearPinActivity(); showPinOverlay(); }
  function checkLocalPinLock() {
    if (!hasLocalPin() || featureSettings.lockOnOpen === false) { pinUnlocked = true; clearPinActivity(); return; }
    const grace = pinGraceMs();
    if (grace > 0) {
      let saved = 0;
      try { saved = Number(sessionStorage.getItem('livrocaixa-pin-grace')) || 0; } catch (err) {}
      if (saved > 0 && Date.now() - saved < grace) { pinUnlocked = true; lastPinActivity = saved; return; }
    }
    lockPinNow();
  }

  function budgetFor(categoryId) {
    const matches = budgets.filter(item => item.categoryId === categoryId);
    if (!matches.length) return null;
    return matches.reduce((latest, item) => (!latest || new Date(item.updatedAt || 0) > new Date(latest.updatedAt || 0)) ? item : latest, null);
  }
  function budgetSpent(categoryId, cycleKey = currentFinancialCycleKey()) {
    const { start, end } = financialCycleRangeForKey(cycleKey);
    return entries.filter(entry => entry.type === 'out' && entry.category === categoryId && entry.date >= start && entry.date <= end).reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }
