/* LIVRO-CAIXA · js/21-ai-features.js — recursos de IA e análises (app.js: 6336-6807). Separação por responsabilidade; conteúdo preservado. */

  function suggestCategoryForDescription(description) { const text = String(description || '').toLocaleLowerCase('pt-BR'); const scores = new Map(); entries.forEach(entry => { const entryText = String(entry.desc || '').toLocaleLowerCase('pt-BR'); const category = categories.find(item => item.id === entry.category); if (!category || !entryText) return; const tokens = text.split(/\s+/).filter(token => token.length >= 4); const matches = tokens.filter(token => entryText.includes(token)).length; if (matches) scores.set(category.id, (scores.get(category.id) || 0) + matches); }); const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]; return best ? best[0] : ''; }
  function applySimpleAutoCategorization(rows) { return rows.map(row => { if (!row.category && featureSettings.autoCategorization) { const suggested = suggestCategoryForDescription(row.desc); if (suggested) { row.category = suggested; row.matchStatus = 'Categoria sugerida pelo histórico · revise antes de confirmar'; } } return row; }); }
  function detectSpendingAnomalies() { const currentMonth = currentMonthYM(); const byCategory = new Map(); entries.filter(entry => entry.type === 'out').forEach(entry => { const month = String(entry.date || '').slice(0, 7); const key = `${entry.category || 'sem-categoria'}|${month}`; byCategory.set(key, (byCategory.get(key) || 0) + Number(entry.amount || 0)); }); const current = new Map(); entries.filter(entry => entry.type === 'out' && String(entry.date || '').startsWith(currentMonth)).forEach(entry => current.set(entry.category || 'sem-categoria', (current.get(entry.category || 'sem-categoria') || 0) + Number(entry.amount || 0))); const anomalies = []; current.forEach((value, categoryId) => { const history = [...byCategory.entries()].filter(([key]) => key.startsWith(`${categoryId}|`) && !key.endsWith(`|${currentMonth}`)).map(([, amount]) => amount).slice(-6); if (history.length < 2) return; const average = history.reduce((sum, amount) => sum + amount, 0) / history.length; if (value > average * 1.75 && value > average + 50) anomalies.push({ category: categories.find(cat => cat.id === categoryId)?.name || 'Sem categoria', value, average }); }); return anomalies.sort((a, b) => b.value - b.average - (a.value - a.average)); }
  function runAnomalyScan() { const anomalies = detectSpendingAnomalies(); const status = document.getElementById('profileAnalysisStatus'); status.innerHTML = anomalies.length ? anomalies.slice(0, 5).map(item => `<div><strong>${escapeHTML(item.category)}</strong>: ${fmt(item.value)} no mês atual, contra média de ${fmt(item.average)}.</div>`).join('') : 'Nenhuma anomalia estatística encontrada com pelo menos dois meses de histórico.'; logInfo('Análise', 'Detectar anomalias', 'Sucesso', `${anomalies.length} possível(is) anomalia(s) encontrada(s).`); }
  function generateMonthlyReview() { const month = currentMonthYM(); const income = entries.filter(e => e.type === 'in' && String(e.date || '').startsWith(month)).reduce((s, e) => s + Number(e.amount || 0), 0); const expense = entries.filter(e => e.type === 'out' && String(e.date || '').startsWith(month)).reduce((s, e) => s + Number(e.amount || 0), 0); const over = categories.filter(cat => { const budget = budgetFor(cat.id); return budget && budget.amount > 0 && budgetSpent(cat.id, currentFinancialCycleKey()) > budget.amount; }).map(cat => cat.name); const status = document.getElementById('profileAnalysisStatus'); status.innerHTML = `<strong>Revisão de ${escapeHTML(formatMonthLabel(month))}</strong><div>Entradas: ${fmt(income)} · Saídas: ${fmt(expense)} · Fluxo: ${fmt(income - expense)}</div><div>${over.length ? `Categorias acima do orçamento: ${escapeHTML(over.join(', '))}.` : 'Nenhuma categoria acima do orçamento.'}</div><small>Resumo informativo; nenhuma alteração automática foi feita.</small>`; logInfo('Análise', 'Revisão mensal guiada', 'Sucesso', 'Resumo mensal apresentado sem alterações automáticas.'); }
  let compoundCalcChartInstance;

  function destroyCompoundCalcChart() {
    if (compoundCalcChartInstance) {
      compoundCalcChartInstance.destroy();
      compoundCalcChartInstance = null;
    }
  }
  function parseCompoundRate(value) {
    const text = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
    const rate = Number(text);
    return Number.isFinite(rate) && rate >= 0 ? rate : 0;
  }
  function compoundFutureValue(principal, payment, monthlyRate, months) {
    let balance = Math.max(0, principal);
    const paymentValue = Math.max(0, payment);
    const points = [balance];
    for (let month = 1; month <= months; month++) {
      balance = balance * (1 + monthlyRate) + paymentValue;
      points.push(balance);
    }
    const invested = Math.max(0, principal) + paymentValue * months;
    return { final: balance, invested, interest: balance - invested, points };
  }
  function compoundTaxRates(days) {
    const prazo = Math.max(1, Math.round(Number(days) || 1));
    const ir = prazo <= 180 ? 0.225 : prazo <= 360 ? 0.2 : prazo <= 720 ? 0.175 : 0.15;
    const iof = Math.max(0, 96 - 3.5 * (prazo - 1)) / 100;
    return { ir, iof, days: prazo };
  }
  function compoundApplyTaxes(result, days) {
    const rates = compoundTaxRates(days);
    const interest = Math.max(0, result.interest);
    const taxIof = interest * rates.iof;
    const taxIr = interest * rates.ir;
    const taxTotal = taxIof + taxIr;
    return { ...result, irPct: rates.ir * 100, iofPct: rates.iof * 100, taxDays: rates.days, taxIr, taxIof, taxTotal, netInterest: interest - taxTotal, netFinal: result.final - taxTotal };
  }
  function indicatorMonthlyRate(key) {
    try {
      const info = typeof financialIndicatorsState === 'function' ? financialIndicatorsState() : null;
      const item = info && info.indicators ? info.indicators[key] : null;
      const daily = item ? Number(item.value) : NaN;
      if (Number.isFinite(daily) && daily > 0) {
        const annual = Math.pow(1 + daily / 100, 252) - 1;
        return Math.pow(1 + annual, 1 / 12) - 1;
      }
    } catch (_) { }
    return null;
  }
  function compoundBenchmarkRatePct(kind) {
    if (kind === 'selic') { const live = indicatorMonthlyRate('selic'); return live === null ? 1 : live * 100; }
    if (kind === 'cdi') { const live = indicatorMonthlyRate('cdi'); return live === null ? 0.9 : live * 100; }
    return 0.5;
  }
  function compoundPctLabel(pct) { return String(Number(Number(pct).toFixed(2))).replace('.', ','); }
  function compoundRateInputValue(pct) { return String(Number(Number(pct).toFixed(3))).replace('.', ','); }
  function renderCompoundCalcChart(months, scenario, benchmarks) {
    const box = document.getElementById('ciChartBox');
    const canvas = document.getElementById('ciChart');
    destroyCompoundCalcChart();
    if (!box || !canvas) return;
    if (typeof Chart === 'undefined') { box.hidden = true; return; }
    box.hidden = false;
    const labels = scenario.points.map((_, index) => index === 0 ? 'Início' : String(index));
    const bodyStyle = getComputedStyle(document.body);
    const textColor = bodyStyle.getPropertyValue('--ink-soft').trim() || '#55635B';
    const gridColor = bodyStyle.getPropertyValue('--line').trim() || '#D8D2C1';
    const benchmarkColors = { 'CDI': '#B3432B', 'Selic': '#3B6FA8', 'Poupança': '#8A6A2F', 'Personalizado': '#7A4B9E' };
    const benchmarkDatasets = (benchmarks || []).map((item) => {
      const color = benchmarkColors[item.name] || '#B3432B';
      return {
        label: `${item.name} · ${compoundPctLabel(item.ratePct)}%`,
        data: item.result.points,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.25,
        pointRadius: 0,
        pointBackgroundColor: color
      };
    });
    compoundCalcChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Cenário', data: scenario.points, borderColor: '#2F6F4F', backgroundColor: 'transparent', borderWidth: 2.5, tension: 0.25, pointRadius: months > 36 ? 0 : 2, pointBackgroundColor: '#2F6F4F' },
          ...benchmarkDatasets
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: textColor, boxWidth: 14, boxHeight: 2, padding: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } }
        },
        scales: {
          x: { ticks: { color: textColor, maxTicksLimit: 9, font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: textColor, font: { size: 10 }, callback: (value) => { const v = Number(value); if (Math.abs(v) >= 1000) return 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil'; return fmt(v); } }, grid: { color: gridColor } }
        }
      }
    });
  }
  function compoundAllocationOptions(days) {
    const info = typeof financialIndicatorsState === 'function' ? financialIndicatorsState() : null;
    const ind = info && info.indicators ? info.indicators : {};
    const normalized = (text) => String(text || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
    const pickTitle = (needle) => {
      const titles = ind.tesouro && Array.isArray(ind.tesouro.titles) ? ind.tesouro.titles : [];
      const pool = titles.filter(title => title && normalized(title.name).includes(needle)
        && Number.isFinite(title.saleRate) && title.saleRate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(title.maturity || ''));
      if (!pool.length) return null;
      const horizon = new Date(Date.now() + Math.max(1, Math.round(days)) * 86400000).toISOString().slice(0, 10);
      const still = pool.filter(title => title.maturity >= horizon);
      const source = still.length ? still : pool;
      return source.slice().sort((a, b) => (a.maturity <= b.maturity ? -1 : 1))[0];
    };
    const annualFromBenchmark = (kind) => Math.pow(1 + compoundBenchmarkRatePct(kind) / 100, 12) - 1;
    const options = [];
    const selicTitle = pickTitle('selic');
    const selicAnnual = selicTitle ? selicTitle.saleRate / 100 : annualFromBenchmark('selic');
    options.push({
      name: 'Tesouro Selic',
      ref: selicTitle
        ? `${compoundPctLabel(selicAnnual * 100)}% a.a. · liquidez diária (Tesouro)`
        : `${compoundPctLabel(selicAnnual * 100)}% a.a. · ${indicatorMonthlyRate('selic') !== null ? 'Selic BCB' : 'ref. offline'} · liquidez diária`,
      annual: selicAnnual,
      irExempt: false
    });
    const ipcaTitle = pickTitle('ipca');
    const ipcaMonthlyPct = ind.ipca ? Number(ind.ipca.value) : NaN;
    const ipcaAnnual = Number.isFinite(ipcaMonthlyPct) && ipcaMonthlyPct > -100 ? Math.pow(1 + ipcaMonthlyPct / 100, 12) - 1 : null;
    if (ipcaTitle && ipcaAnnual !== null) {
      options.push({
        name: 'Tesouro IPCA+',
        ref: `${compoundPctLabel(ipcaTitle.saleRate)}% a.a. real + IPCA estimado (${compoundPctLabel(ipcaAnnual * 100)}%)`,
        annual: (1 + ipcaTitle.saleRate / 100) * (1 + ipcaAnnual) - 1,
        irExempt: false
      });
    }
    const cdiAnnual = annualFromBenchmark('cdi');
    const cdiLive = indicatorMonthlyRate('cdi') !== null;
    options.push({
      name: 'CDB 100% do CDI',
      ref: `${compoundPctLabel(cdiAnnual * 100)}% a.a. · ${cdiLive ? 'CDI vigente BCB' : 'ref. offline'} · FGC até R$ 250 mil`,
      annual: cdiAnnual,
      irExempt: false
    });
    options.push({
      name: 'LCI/LCA típico 90% do CDI',
      ref: `${compoundPctLabel(cdiAnnual * 90)}% a.a. · isento IR${days >= 90 ? ' (90 dias cumpridos)' : ' (carência de 90 dias)'}`,
      annual: cdiAnnual * 0.9,
      irExempt: days >= 90
    });
    return options;
  }
  function compoundAllocationCard(initial, monthly, months, days, scenario) {
    const options = compoundAllocationOptions(days)
      .filter(option => Number.isFinite(option.annual) && option.annual > 0)
      .map(option => {
        const monthlyRate = Math.pow(1 + option.annual, 1 / 12) - 1;
        const taxed = compoundApplyTaxes(compoundFutureValue(initial, monthly, monthlyRate, months), days);
        const netFinal = option.irExempt ? taxed.final - taxed.taxIof : taxed.netFinal;
        return { ...option, netFinal, delta: netFinal - scenario.netFinal };
      })
      .sort((a, b) => b.netFinal - a.netFinal);
    if (!options.length) return '';
    const rows = options.map(option => {
      const pct = scenario.netFinal > 0 ? (option.delta / scenario.netFinal) * 100 : null;
      const color = option.delta >= 0 ? 'var(--green,#327957)' : 'var(--red,#B3432B)';
      const sign = option.delta >= 0 ? '+' : '−';
      const deltaText = pct === null ? '' : ` <em style="color:${color}">${sign}${fmt(Math.abs(option.delta))} (${sign}${compoundPctLabel(Math.abs(pct))}%)</em>`;
      return `<div class="compound-calc-row"><span>${escapeHTML(option.name)} · ${escapeHTML(option.ref)}</span><b>${fmt(option.netFinal)}${deltaText}</b></div>`;
    }).join('');
    return `
        <div class="compound-calc-card compound-calc-card-aloc">
          <strong class="compound-calc-card-title">Onde alocar · melhor líquido primeiro (mesmo valor e prazo do cenário)</strong>
          ${rows}
          <p class="compound-calc-note">Estimativas com IR/IOF pelo prazo; isenção de LCI/LCA só vale após 90 dias de carência. Fontes: BCB (Selic/CDI/IPCA) e Tesouro Nacional quando há conexão; CDB e LCI/LCA usam percentuais típicos do CDI (referência do mercado, não cotação). Conteúdo educativo — não é recomendação de investimento.</p>
        </div>`;
  }
  function runCompoundInterest() {
    const initial = Math.max(0, readMoneyInput(document.getElementById('ciInitial')));
    const monthly = Math.max(0, readMoneyInput(document.getElementById('ciMonthly')));
    const unitDays = document.getElementById('ciTermUnit')?.value === 'd';
    const termRaw = String(document.getElementById('ciMonths')?.value ?? '').trim();
    const termDefault = unitDays ? 365 : 12;
    const termValue = termRaw === '' ? termDefault : (Number(termRaw.replace(',', '.')) || termDefault);
    const days = unitDays
      ? Math.min(18000, Math.max(1, Math.round(termValue)))
      : Math.min(18000, Math.max(1, Math.round(termValue) * 30));
    const months = unitDays
      ? Math.max(1, Math.ceil(days / 30))
      : Math.min(600, Math.max(1, Math.round(termValue)));
    const scenarioRatePct = parseCompoundRate(document.getElementById('ciRate')?.value);
    const scenarioPeriod = document.getElementById('ciRatePeriod')?.value || 'm';
    const scenarioAnnual = scenarioPeriod === 'y';
    const scenarioCdiMode = scenarioPeriod === 'c';
    const scenarioMonthlyRate = scenarioCdiMode
      ? (scenarioRatePct / 100) * (compoundBenchmarkRatePct('cdi') / 100)
      : scenarioAnnual
        ? Math.pow(1 + scenarioRatePct / 100, 1 / 12) - 1
        : scenarioRatePct / 100;
    const scenario = compoundApplyTaxes(compoundFutureValue(initial, monthly, scenarioMonthlyRate, months), days);
    const benchmarkDefs = [];
    if (document.getElementById('ciBenchCdi')?.checked) benchmarkDefs.push({ name: 'CDI', ratePct: compoundBenchmarkRatePct('cdi') });
    if (document.getElementById('ciBenchSelic')?.checked) benchmarkDefs.push({ name: 'Selic', ratePct: compoundBenchmarkRatePct('selic') });
    if (document.getElementById('ciBenchPoupanca')?.checked) benchmarkDefs.push({ name: 'Poupança', ratePct: compoundBenchmarkRatePct('poupanca') });
    if (document.getElementById('ciBenchCustom')?.checked) benchmarkDefs.push({ name: 'Personalizado', ratePct: parseCompoundRate(document.getElementById('ciBenchmarkRate')?.value) });
    const benchmarks = benchmarkDefs.map((def) => ({
      name: def.name,
      ratePct: def.ratePct,
      result: compoundApplyTaxes(compoundFutureValue(initial, monthly, def.ratePct / 100, months), days)
    }));

    const results = document.getElementById('ciResults');
    if (results) {
      const card = (title, result) => `
        <div class="compound-calc-card">
          <strong class="compound-calc-card-title">${escapeHTML(title)}</strong>
          <div class="compound-calc-row"><span>Montante final (bruto)</span><b>${fmt(result.final)}</b></div>
          <div class="compound-calc-row"><span>Total aportado</span><b>${fmt(result.invested)}</b></div>
          <div class="compound-calc-row"><span>Juros (bruto)</span><b>${fmt(result.interest)}</b></div>
          <div class="compound-calc-row"><span>IR (regressivo ${compoundPctLabel(result.irPct)}%)</span><b>− ${fmt(result.taxIr)}</b></div>
          <div class="compound-calc-row"><span>IOF${result.taxIof > 0 ? ` (${compoundPctLabel(result.iofPct)}%)` : ' (isento)'}</span><b>${fmt(result.taxIof)}</b></div>
          <div class="compound-calc-row compound-calc-row-net"><span>Montante líquido</span><b>${fmt(result.netFinal)}</b></div>
        </div>`;
      const iofLabel = scenario.taxIof > 0 ? `${compoundPctLabel(scenario.iofPct)}%` : 'isento';
      const scenarioTitle = scenarioCdiMode
        ? `Cenário · ${compoundPctLabel(scenarioRatePct)}% do CDI (${compoundPctLabel(scenarioMonthlyRate * 100)}% a.m.)`
        : `Cenário · ${compoundPctLabel(scenarioRatePct)}% ${scenarioAnnual ? 'a.a.' : 'a.m.'}`;
      if (!benchmarks.length) {
        results.innerHTML = `
          ${card(scenarioTitle, scenario)}
          <div class="compound-calc-card compound-calc-card-delta">
            <strong class="compound-calc-card-title">Benchmark</strong>
            <div class="compound-calc-row"><span>Marque pelo menos um benchmark (CDI, Selic, Poupança ou Personalizado) para comparar com o cenário.</span></div>
          </div>`;
        destroyCompoundCalcChart();
        const chartBox = document.getElementById('ciChartBox');
        if (chartBox) chartBox.hidden = true;
        logInfo('Análise', 'Calculadora de juros compostos', 'Aguardando benchmark', 'Nenhum benchmark marcado; apenas o cenário foi calculado.');
        return;
      }
      const benchmarkCards = benchmarks.map((item) => card(`${item.name} · ${compoundPctLabel(item.ratePct)}% a.m.`, item.result)).join('');
      const diffRows = benchmarks.map((item) => {
        const diffNet = scenario.netFinal - item.result.netFinal;
        const diffGross = scenario.final - item.result.final;
        const diffPct = item.result.netFinal > 0 ? Math.abs(diffNet / item.result.netFinal) * 100 : null;
        const diffTitle = diffNet >= 0 ? 'O cenário termina acima' : 'O benchmark termina acima';
        return `
          <strong class="compound-calc-card-title">${escapeHTML(item.name)}</strong>
          <div class="compound-calc-row"><span>Líquido (cenário − ${escapeHTML(item.name)})</span><b>${fmt(diffNet)}</b></div>
          <div class="compound-calc-row"><span>Bruto (cenário − ${escapeHTML(item.name)})</span><b>${fmt(diffGross)}</b></div>
          <div class="compound-calc-row"><span>${diffTitle}${diffPct !== null ? ` em ${compoundPctLabel(diffPct)}%` : ''}</span></div>`;
      }).join('');
      results.innerHTML = `
        ${card(scenarioTitle, scenario)}
        ${benchmarkCards}
        <div class="compound-calc-card compound-calc-card-delta">
          <strong class="compound-calc-card-title">Diferença</strong>
          ${diffRows}
          <div class="compound-calc-row"><span>Impostos no prazo: IR ${compoundPctLabel(scenario.irPct)}% · IOF ${iofLabel} · ${scenario.taxDays} dias</span></div>
        </div>
        ${compoundAllocationCard(initial, monthly, months, days, scenario)}`;
    }

    renderCompoundCalcChart(months, scenario, benchmarks);
    logInfo('Análise', 'Calculadora de juros compostos', 'Sucesso', 'Cenário e benchmarks calculados localmente com IR/IOF, sem alterar os dados.');
  }
  function parsePtNumberValue(raw) {
    const text = String(raw || '').trim();
    if (!text) return 0;
    if (text.includes(',') && text.includes('.')) return Number(text.replace(/\./g, '').replace(',', '.')) || 0;
    if (text.includes(',')) return Number(text.replace(',', '.')) || 0;
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, '')) || 0;
    return Number(text) || 0;
  }
  function buildCompoundInterestReply(message) {
    const text = String(message || '').toLocaleLowerCase('pt-BR');
    if (!/\d/.test(text)) return null;
    if (!/(juros compost|quanto (?:rende|acumula|cresce|eu teria|teria)|montante|simul\w*\s+(?:o |um )?(?:investiment|rendiment|aplic))/.test(text)) return null;
    const rateMatch = text.match(/(\d+(?:[.,]\d+)?)\s*%(?!\s*(?:do|da|de)\b)/);
    if (!rateMatch) return null;
    const ratePct = parseCompoundRate(rateMatch[1]);
    if (ratePct <= 0) return null;
    const mentionsYear = /(?:ao\s+ano|no\s+ano|por\s+ano|anual|a\.a\.?)/.test(text);
    const mentionsMonth = /(?:ao\s+m[êe]s|no\s+m[êe]s|por\s+m[êe]s|mensal|cada\s+m[êe]s|a\.m\.?)/.test(text);
    const annual = mentionsYear && !mentionsMonth;
    const monthlyRate = annual ? Math.pow(1 + ratePct / 100, 1 / 12) - 1 : ratePct / 100;
    if (monthlyRate <= 0 || monthlyRate > 0.1) return null;
    const termMonths = text.match(/(\d+)\s*meses/);
    const termDaysMatch = text.match(/(\d+)\s*dias?/);
    const termYears = text.match(/(\d+)\s*anos?/);
    let days = 0;
    if (termDaysMatch) days = Number(termDaysMatch[1]);
    else if (termMonths) days = Number(termMonths[1]) * 30;
    else if (termYears) days = Number(termYears[1]) * 365;
    if (!Number.isFinite(days) || days < 1) return null;
    days = Math.min(18000, Math.round(days));
    const aporteMatch = text.match(/(?:aporte|aportando|depositando|guardando|aplicando)[^0-9%]{0,24}(\d+(?:[.,]\d+)?)/);
    const valueTokens = [...text.matchAll(/(?:r\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*reais\b)/g)];
    const bareInitial = text.match(/(\d+(?:[.,]\d+)?)\s*(?:reais\s*)?com\s+(?:o\s+)?(?:aporte|juros)/);
    let aporte = aporteMatch ? parsePtNumberValue(aporteMatch[1]) : 0;
    let inicial = 0;
    let foundInicial = false;
    for (const match of valueTokens) {
      const rawValue = match[1] || match[2];
      const start = match.index || 0;
      const end = start + match[0].length;
      const marker = /(?:\/\s*m[êe]s|ao\s+m[êe]s|por\s+m[êe]s|cada\s+m[êe]s|no\s+m[êe]s|mensal)/;
      const after = text.slice(end, end + 16).match(/^[^\d%]*/)?.[0] || '';
      const beforeRaw = text.slice(Math.max(0, start - 16), start);
      const before = beforeRaw.match(/[\d%][^\d%]*$/)?.[0] || beforeRaw;
      const monthlyContext = marker.test(after) || marker.test(before);
      if (monthlyContext) { if (!aporte) aporte = parsePtNumberValue(rawValue); continue; }
      if (!foundInicial) { inicial = parsePtNumberValue(rawValue); foundInicial = true; }
    }
    if (!foundInicial && bareInitial) { inicial = parsePtNumberValue(bareInitial[1]); foundInicial = true; }
    if (!aporte) { const monthlyAporte = text.match(/(\d+(?:[.,]\d+)?)\s*(?:por|ao|no|cada)\s*m[êe]s\b/); if (monthlyAporte) aporte = parsePtNumberValue(monthlyAporte[1]); }
    if (!foundInicial && !aporte) return null;
    let benchmarkKind = 'poupanca';
    if (/selic/.test(text)) benchmarkKind = 'selic';
    else if (/\bcdi\b/.test(text) || /\bcdb\b/.test(text)) benchmarkKind = 'cdi';
    const benchmarkName = { poupanca: 'Poupança', cdi: 'CDI', selic: 'Selic' }[benchmarkKind];
    const benchmarkRatePct = compoundBenchmarkRatePct(benchmarkKind);
    const months = Math.max(1, Math.ceil(days / 30));
    const scenario = compoundApplyTaxes(compoundFutureValue(inicial, aporte, monthlyRate, months), days);
    const benchmark = compoundApplyTaxes(compoundFutureValue(inicial, aporte, benchmarkRatePct / 100, months), days);
    const diffNet = scenario.netFinal - benchmark.netFinal;
    const diffPct = benchmark.netFinal > 0 ? Math.abs(diffNet / benchmark.netFinal) * 100 : null;
    const winner = diffNet >= 0 ? 'O cenário termina acima' : 'O benchmark termina acima';
    const rateLabel = annual
      ? `${compoundPctLabel(ratePct)}% ao ano (${compoundPctLabel(monthlyRate * 100)}% a.m.)`
      : `${compoundPctLabel(ratePct)}% ao mês`;
    const iofLabel = scenario.taxIof > 0 ? ` · IOF ${fmt(scenario.taxIof)}` : ' · IOF isento (prazo ≥ 30 dias)';
    return [
      'Simulação local de juros compostos (calculadora do LABS — sem chamada de IA):',
      `Cenário: ${rateLabel} em ${days} dias, com ${fmt(inicial)} inicial e aporte de ${fmt(aporte)} por mês.`,
      `Bruto: montante ${fmt(scenario.final)} · aportado ${fmt(scenario.invested)} · juros ${fmt(scenario.interest)}.`,
      `Impostos: IR ${compoundPctLabel(scenario.irPct)}% = ${fmt(scenario.taxIr)}${iofLabel} (${scenario.taxDays} dias).`,
      `Líquido: montante ${fmt(scenario.netFinal)} · juros ${fmt(scenario.netInterest)}.`,
      `Comparativo ${benchmarkName} (${compoundPctLabel(benchmarkRatePct)}% a.m.): líquido ${fmt(benchmark.netFinal)} · juros ${fmt(benchmark.netInterest)}.`,
      `Diferença líquida (cenário − benchmark): ${diffNet >= 0 ? '+' : ''}${fmt(diffNet)} — ${winner}${diffPct !== null ? ` em ${compoundPctLabel(diffPct)}%` : ''}.`,
      'Estimativa sem inflação; a Poupança pode ter isenção própria de IR. Ajuste os parâmetros na calculadora do LABS.'
    ].join('\n');
  }
  /* Movimentação por texto digitado (sem chamada de IA): casa SÓ com
     valor + verbo de direção ("gastei 30 reais no mercado",
     "recebi 1500 de salário", "paguei R$ 45,90 no restaurante").
     Perguntas, textos sem verbo, sem valor ou sem conta cadastrada não
     disparam — o texto segue para a IA. Categoria: palavras-chave nas
     categorias padrão, depois o histórico; banco = primeiro cadastrado
     (o comprovante tem Editar para corrigir). */
  function parseMovementFromText(rawText) {
    const raw = String(rawText || '').trim();
    if (!raw || raw.includes('?')) return null;
    if (!banks.length) return null;
    const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const plain = stripAccents(raw.toLocaleLowerCase('pt-BR'));
    if (/\b(?:quanto|quanta|quando|onde|quem|qual|quais|como|por que|porque|sera)\b/.test(plain)) return null;

    const outVerb = /\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou)\b/.test(plain);
    const inVerb = /\b(?:recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b/.test(plain);
    if (!outVerb && !inVerb) return null;
    const type = outVerb ? 'out' : 'in';

    /* Valor: "R$ 45,90" / "45,90 reais" tem prioridade; senão o número
       que segue o verbo de direção. Sem valor > 0 → não casa. */
    let amount = 0;
    let amountSpan = '';
    const moneyMatch = raw.match(/r\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*reais\b/i);
    if (moneyMatch) {
      amount = parsePtNumberValue(moneyMatch[1] || moneyMatch[2]);
      amountSpan = moneyMatch[0];
    } else {
      const numAfterVerb = plain.match(/\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou|recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b[^0-9]{0,24}(\d+(?:[.,]\d+)?)/);
      if (numAfterVerb) {
        amount = parsePtNumberValue(numAfterVerb[1]);
        amountSpan = numAfterVerb[0];
      }
    }
    if (!(amount > 0)) return null;

    /* Descrição: remove o valor reconhecido e os verbos de direção e
       encolhe o resto (fallback: o texto original). O span vem do texto
       em minúsculas — comparação case-insensitive. */
    let desc = raw;
    if (amountSpan) {
      const spanPattern = amountSpan.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      desc = desc.replace(new RegExp(spanPattern, 'i'), ' ');
    }
    desc = desc
      .replace(/\b(?:gastei|gastamos|paguei|pagamos|comprei|compramos|saiu|retirei|desembolsei|perdi|custou|recebi|recebemos|ganhei|ganhamos|entrou|caiu|lucrei|rendeu|depositou|depositaram|reembolsou)\b/gi, ' ')
      .replace(/\d+(?:[.,]\d+)?\s*reais\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:em|no|na|nos|nas|de|do|da|para|pelo|pela|com|por|e)\s+/i, '')
      .trim();
    if (!desc) desc = raw;
    if (desc.length > 160) desc = desc.slice(0, 157) + '...';

    const categoryKeywords = [
      { key: 'alimentacao', words: ['mercado', 'supermercado', 'restaurante', 'lanche', 'comida', 'ifood', 'padaria', 'acougue', 'cafe', 'cafeteria', 'almoco', 'jantar', 'pizza', 'hamburguer', 'marmita'] },
      { key: 'transporte', words: ['uber', 'onibus', 'metro', 'gasolina', 'combustivel', 'estacionamento', 'passagem', 'taxi', 'pedagio'] },
      { key: 'saude', words: ['farmacia', 'medico', 'dentista', 'consulta', 'remedio', 'exame', 'hospital', 'psicologo', 'terapia'] },
      { key: 'lazer', words: ['cinema', 'show', 'bar', 'viagem', 'hotel', 'passeio', 'netflix', 'spotify', 'steam', 'jogo', 'presente'] },
      { key: 'moradia', words: ['aluguel', 'condominio', 'luz', 'agua', 'energia', 'internet', 'gas', 'iptu', 'reforma', 'mensalidade'] },
      { key: 'salario', words: ['salario', 'pagamento', 'folha', 'prolabore'] },
      { key: 'renda extra', words: ['freela', 'bico', 'venda', 'cashback', 'rendimento'] }
    ];
    const plainDesc = stripAccents(desc.toLowerCase());
    let category = '';
    for (const entry of categoryKeywords) {
      if (!entry.words.some((word) => plainDesc.includes(word))) continue;
      const hit = categories.find((c) => stripAccents(String(c.name || '').toLowerCase()) === entry.key);
      if (hit) { category = hit.id; break; }
    }
    if (!category) category = suggestCategoryForDescription(desc) || '';

    return {
      type,
      amount: Math.round(amount * 100) / 100,
      desc,
      category,
      bank: banks[0].id,
      date: todayISO()
    };
  }
