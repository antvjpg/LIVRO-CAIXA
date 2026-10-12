/* LIVRO-CAIXA · js/29-invest-movements.js — investimentos e movimentos (app.js: 12813-13397). Separação por responsabilidade; conteúdo preservado. */


  function updateInvestmentMainValue() {
    const type = document.getElementById('iTipo').value;
    if (!isCryptoType(type)) return;
    const rawInitial = parseFloat(document.getElementById('iUnidades').value) || 0;
    const initialUnits = isBitcoinType(type) ? Math.round(rawInitial) : rawInitial;
    const item = editingInvestId ? investments.find(x => x.id === editingInvestId) : null;
    const movementTotal = item ? cryptoMovementTotal(item) : 0;
    const finalUnits = Math.max(0, initialUnits + movementTotal);
    const finalInput = document.getElementById('iUnidadesAtual');
    if (finalInput) finalInput.value = isBitcoinType(type) ? Math.round(finalUnits) : finalUnits;
    const price = readMoneyInput('iCotacao');
    setMoneyInput('iValor', finalUnits > 0 && price > 0 ? cryptoValueFromUnits(type, finalUnits, price) : 0);
  }

  function openNewPocketModal() {
    editingPocketId = null;
    document.getElementById('pNome').value = '';
    document.getElementById('pObjetivo').value = '';
    setMoneyInput('pMetaValor', 0);
    renderBankSelects();
    document.getElementById('pBancoOrigem').value = '';
    setMoneyInput('pInicial', 0);
    setMoneyInput('pAtual', 0);
    document.getElementById('panelPocketTitle').innerHTML = 'Nova Caixinha <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('pSalvar').textContent = 'Salvar Caixinha';
    openModal('panelPocket');
  }

  /* Conciliação com a corretora: compara a quantidade informada pela corretora
     com o saldo derivado das movimentações e grava UM lançamento de ajuste.
     Não altera cotação, priceHistory nem lastQuoteAt — preço é dado do ativo. */
  let cryptoReconcileTarget;

  function reconcileCurrentValue(item) {
    if (item.type === 'Renda Fixa') return fixedIncomeCurrentValue(item);
    return Number(item.value) || 0;
  }
  function cryptoReconcileNumbers() {
    const item = investments.find(x => x.id === cryptoReconcileTarget);
    if (!item) return null;
    const raw = parseFloat(document.getElementById('crSaldoReal').value);
    if (!isCryptoType(item.type)) {
      const current = reconcileCurrentValue(item);
      if (!isFinite(raw) || raw < 0) return { item, current, informed: null, diff: null };
      const informed = Number(raw.toFixed(2));
      return { item, current, informed, diff: Number((informed - current).toFixed(2)) };
    }
    const current = cryptoCurrentUnits(item);
    if (!isFinite(raw) || raw < 0) return { item, current, informed: null, diff: null };
    const informed = isBitcoinType(item.type) ? Math.round(raw) : Number(raw.toFixed(8));
    return { item, current, informed, diff: Number((informed - current).toFixed(8)) };
  }
  function updateCryptoReconcilePreview() {
    const box = document.getElementById('crPreview');
    const ctx = cryptoReconcileNumbers();
    if (!ctx || !box) return;
    const { item, current, informed, diff } = ctx;
    const show = isCryptoType(item.type) ? (value) => formatCryptoUnits(item.type, value, item.name) : (value) => fmt(value);
    if (informed == null) {
      box.textContent = `Saldo atual: ${show(current)}`;
      return;
    }
    if (diff === 0) {
      box.innerHTML = `Saldo atual: <b>${show(current)}</b><br>Sem diferença — nada a conciliar.`;
      return;
    }
    const kind = diff > 0 ? 'rendimento' : 'resgate';
    box.innerHTML = `Saldo atual: <b>${show(current)}</b><br>`
      + `Saldo informado: <b>${show(informed)}</b><br>`
      + `Diferença: <b>${diff > 0 ? '+' : '−'}${show(Math.abs(diff))}</b> → ${movementKindLabel(kind)}`;
  }

  let pendingPricePoint;


  function upsertPriceHistory(inv, point) {
    if (!inv) return;
    if (!Array.isArray(inv.priceHistory)) inv.priceHistory = [];
    const date = String(point.date || todayISO());
    const index = inv.priceHistory.findIndex(item => item && item.date === date);
    const normalized = { ...point, date };
    if (index >= 0) inv.priceHistory[index] = { ...inv.priceHistory[index], ...normalized };
    else inv.priceHistory.push(normalized);
    inv.priceHistory.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }

  async function persistInvestmentQuote(inv, quote, source='manual', operation = null) {
    if (!inv || !isCryptoType(inv.type) || !(Number(quote)>0)) return false;
    const units = cryptoCurrentUnits(inv);
    inv.price = Number(quote);
    inv.value = cryptoValueFromUnits(inv.type, units, inv.price);
    inv.lastQuoteAt = new Date().toISOString();
    inv.quoteSource = source === 'api' ? 'api' : 'manual';
    upsertPriceHistory(inv, { date: todayISO(), price: inv.price, units, value: inv.value, source });
    await saveInvestments(operation);
    return true;
  }

  async function fetchCoinMatch(nameQuery) {
    const searchRes = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(nameQuery));
    if (!searchRes.ok) throw new Error(`CoinGecko search HTTP ${searchRes.status}`);
    const searchData = await searchRes.json();
    return searchData.coins && searchData.coins[0];
  }

  async function fetchCoinPriceBRL(coinId) {
    const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + coinId + '&vs_currencies=brl');
    if (!priceRes.ok) throw new Error(`CoinGecko price HTTP ${priceRes.status}`);
    const priceData = await priceRes.json();
    return priceData[coinId] && priceData[coinId].brl;
  }

  let sleep;


  let QUOTE_STALE_MS;
 // 6h — saldo usa última cotação salva até então
  function investmentQuoteIsStale(inv) {
    if (!inv || !isCryptoType(inv.type) || cryptoCurrentUnits(inv) <= 0) return false;
    const ts = Date.parse(inv.lastQuoteAt || '');
    return !Number.isFinite(ts) || Date.now() - ts >= QUOTE_STALE_MS;
  }
  async function refreshStaleInvestmentQuotes() {
    if (!currentUser) return;
    const stale = investments.filter(investmentQuoteIsStale);
    if (!stale.length) return;
    try { await updateAllInvestmentPrices({ auto:true, requestedCandidates:stale }); } catch (err) { logSyncError('atualização de cotações desatualizadas', err); }
  }


  function applyCachedQuotesToInvestments() {
    try {
      const raw = localStorage.getItem('lc_last_quotes');
      if (!raw) return;
      const snap = JSON.parse(raw);
      if (!snap || !Array.isArray(snap.items)) return;
      const byId = Object.fromEntries(snap.items.map(x => [x.id, x]));
      investments.forEach(inv => {
        if (!isCryptoType(inv.type)) return;
        const c = byId[inv.id];
        if (!c) return;
        const remoteTs = Date.parse(inv.lastQuoteAt || '') || 0;
        const cacheTs = Date.parse(c.lastQuoteAt || '') || 0;
        // usa cache se não tem cotação remota ou se cache é mais recente
        if (!inv.lastQuoteAt || cacheTs >= remoteTs) {
          if (Number(c.price) > 0) inv.price = Number(c.price);
          if (Number(c.value) >= 0) inv.value = Number(c.value);
          if (c.lastQuoteAt) inv.lastQuoteAt = c.lastQuoteAt;
          if (c.quoteSource) inv.quoteSource = c.quoteSource;
          if (c.coinGeckoId) inv.coinGeckoId = c.coinGeckoId;
        }
      });
    } catch (_) {}
  }

  async function updateAllInvestmentPrices({ auto = false, requestedCandidates = null } = {}) {
    const statusEl = document.getElementById('updateAllStatus');
    const btn = document.getElementById('btnUpdateAllPrices');
    const candidates = Array.isArray(requestedCandidates) ? requestedCandidates : investments.filter(inv => isCryptoType(inv.type) && cryptoCurrentUnits(inv) > 0);
    if (candidates.length === 0) {
      statusEl.textContent = 'Nenhum ativo com unidades cadastradas para atualizar automaticamente (ativos sem "unidades/tokens" precisam ser editados manualmente).';
      return;
    }
    const operation = beginLogOperation('Cotação', 'Atualização em lote');
    logInfo('Cotação', 'Atualização em lote', 'Em andamento', `Atualização de ${candidates.length} ativo(s) iniciada.`, { count: candidates.length }, operation);
    btn.disabled = true;
    let updated = 0, failed = [];
    for (let i = 0; i < candidates.length; i++) {
      const inv = candidates[i];
      statusEl.textContent = `Atualizando ${i + 1}/${candidates.length}: ${escapeHTML(inv.name)}...`;
      try {
        const coin = inv.coinGeckoId ? { id: inv.coinGeckoId, symbol: inv.name } : await fetchCoinMatch(inv.name);
        if (!coin) { failed.push(inv.name); continue; }
        const price = await fetchCoinPriceBRL(coin.id);
        if (!(Number(price) > 0)) { failed.push(inv.name); logWarn('Cotação','Atualização de cotação','Parcial',`Retorno inválido para ${inv.name}; última cotação válida preservada.`,null,operation); continue; }
        inv.price = Number(price);
        const currentUnits = cryptoCurrentUnits(inv);
        inv.value = cryptoValueFromUnits(inv.type, currentUnits, price);
        inv.lastQuoteAt = new Date().toISOString();
        inv.quoteSource = 'api';
        inv.coinGeckoId = coin.id;
        upsertPriceHistory(inv, { date: todayISO(), price, units: currentUnits, value: inv.value, source: 'api' });
        updated++;
      } catch (err) {
        console.error(err);
        failed.push(inv.name);
        logSyncError(`cotação CoinGecko — ${inv.name}`, err, operation);
      }
      if (i < candidates.length - 1) await sleep(1200); // evita limite de requisições da API
    }
    if (updated > 0) {
      try {
        const quoteSnap = investments.filter(i => isCryptoType(i.type)).map(i => ({
          id: i.id, price: i.price, value: i.value, lastQuoteAt: i.lastQuoteAt, quoteSource: i.quoteSource, coinGeckoId: i.coinGeckoId
        }));
        localStorage.setItem('lc_last_quotes', JSON.stringify({ at: Date.now(), items: quoteSnap }));
      } catch (_) {}
      await persistAll(operation);
    }
    render();
    btn.disabled = false;
    statusEl.textContent = `${updated} de ${candidates.length} cotação(ões) atualizada(s).` +
      (failed.length ? ` Não encontrados: ${failed.join(', ')}.` : '');
    (failed.length ? logWarn : logInfo)('Cotação', auto ? 'Atualização automática' : 'Atualização em lote', failed.length ? 'Parcial' : 'Sucesso', `${updated} cotação(ões) atualizada(s).`, { failed }, operation);
  }
