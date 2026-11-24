const CDP = require('/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const REPO = '/data/data/com.termux/files/home/LIVRO-CAIXA';
const OUT_ROOT = process.env.C6_OUT || path.join(REPO, 'tmp-c13/c6-2/complementar');
const ROUND = process.env.C6_ROUND || 'rodada';
const ICON_MODE = process.env.C6_ICON_MODE === 'allow' ? 'allow' : 'block';
const SCOPE = process.env.C6_SCOPE === 'diag' ? 'diag' : 'matrix';
const OUT = path.join(OUT_ROOT, ROUND);
const DIRS = {
  viewport: path.join(OUT, 'viewport'),
  fullpage: path.join(OUT, 'fullpage'),
  card: path.join(OUT, 'card-bancos'),
  diag: path.join(OUT, 'diagnosticos'),
};
Object.values(DIRS).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

const VIEWPORTS = [
  { name: '320x720', width: 320, height: 720 },
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1280x800', width: 1280, height: 800 },
];
const THEMES = [
  ...[1, 2, 3, 4, 5].map((n) => ({ name: `light-${n}`, dark: false, n })),
  ...[1, 2, 3, 4, 5].map((n) => ({ name: `dark-${n}`, dark: true, n })),
];
const COMBOS = SCOPE === 'diag'
  ? [
      { viewport: VIEWPORTS[2], theme: THEMES[0] },
      { viewport: VIEWPORTS[4], theme: THEMES[0] },
    ]
  : VIEWPORTS.flatMap((viewport) => THEMES.map((theme) => ({ viewport, theme })));

const inject = `
(() => {
  [ '#authOverlay', '#syncOverlay', '#modalOverlay', '.modal-overlay', '#toastContainer', '#universalPeriodBar' ]
    .forEach((selector) => { const el = document.querySelector(selector); if (el) el.style.display = 'none'; });
  document.body.dataset.tab = 'inicio';
  document.body.classList.remove('is-data-loading', 'tab-changing');
  document.querySelectorAll('.tab-content').forEach((view) => view.classList.remove('active'));
  document.getElementById('viewInicio').classList.add('active');
  document.getElementById('balanceStrip').classList.remove('section-hidden');
  window.scrollTo(0, 0);

  const card = (cls, label, amount, share, symbol) =>
    '<div class="balance-card ' + cls + '" role="button" tabindex="0">' +
      '<div class="balance-card-head"><span class="label">' + label + '</span>' +
      '<span class="balance-symbol" aria-hidden="true"><i class="' + symbol + '" aria-hidden="true"></i></span></div>' +
      '<span class="amount">' + amount + '</span>' +
      '<span class="balance-share">' + share + ' do patrimônio</span>' +
    '</div>';
  document.getElementById('balanceStrip').innerHTML =
    card('bank-summary-card', 'Bancos', 'R$ 4.200,00', '34,1%', 'fi fi-rr-bank') +
    card('pocket-summary-card', 'Caixinhas', 'R$ 2.750,00', '22,3%', 'fi fi-rr-piggy-bank') +
    card('invest-summary-card', 'Invest.', 'R$ 5.395,67', '43,6%', 'fi fi-rr-chat-arrow-grow') +
    '<div class="invest-breakdown-box" id="investBreakdownBox" aria-hidden="false" style="min-height:72px;display:flex;align-items:center;justify-content:center;color:var(--ink-soft);font-size:11px;">Detalhamento por instituição</div>';

  document.querySelector('#viewInicio .inicio-card.balance-card .amount').textContent = 'R$ 12.345,67';
  document.querySelector('#viewInicio .advanced-dashboard').innerHTML =
    '<div class="dashboard-health-card positive"><span class="dashboard-health-icon">✓</span>' +
    '<div><strong>Saúde financeira · score 82/100</strong>' +
    '<small>Fluxo positivo e compromissos sob acompanhamento.</small></div>' +
    '<b>82 · Equilibrado</b></div>';
  document.querySelector('#viewInicio .next-pay-inner').outerHTML =
    '<div class="next-pay-inner"><span class="next-pay-kicker">Próximo pagamento</span>' +
    '<div class="next-pay-row"><strong>Internet</strong><b>R$ 149,90</b></div>' +
    '<span class="hint">Vence em 28/11/2026</span></div>';
  document.querySelector('#viewInicio .cashflow-mini-summary').innerHTML =
    '<div class="cashflow-mini-head"><div><strong>Resumo do fluxo</strong>' +
    '<span class="hint">novembro de 2026</span></div>' +
    '<button type="button" class="cashflow-mini-link">Ver visão geral</button></div>' +
    '<div class="cashflow-mini-metrics"><div><small>Entradas</small><strong class="positive">R$ 6.800,00</strong></div>' +
    '<div><small>Saídas</small><strong class="negative">R$ 3.120,00</strong></div>' +
    '<div><small>Saldo do mês</small><strong class="positive">R$ 3.680,00</strong></div></div>';

  const canvas = document.getElementById('patrimonySparklineInicio');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.boxSizing = 'border-box';
  canvas.width = 320;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#327957';
  ctx.lineWidth = 2;
  ctx.beginPath();
  [8, 20, 14, 34, 28, 50].forEach((y, i) => {
    const x = 4 + i * 60;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
})();
`;

const setThemeExpression = (theme) => `(() => {
  const body = document.body;
  body.classList.remove('dark-mode');
  delete body.dataset.lightTheme;
  delete body.dataset.darkTheme;
  if (${theme.dark}) {
    body.classList.add('dark-mode');
    body.dataset.darkTheme = '${theme.n}';
  } else {
    body.dataset.lightTheme = '${theme.n}';
  }
})();`;

const metricsExpression = `
(() => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: +r.top.toFixed(2), left: +r.left.toFixed(2), width: +r.width.toFixed(2), height: +r.height.toFixed(2), right: +r.right.toFixed(2) };
  };
  const strip = document.getElementById('balanceStrip');
  const cards = Array.from(strip.querySelectorAll(':scope > .balance-card')).map((el) => ({
    className: el.className,
    rect: rect(el),
    amountFontSize: getComputedStyle(el.querySelector('.amount')).fontSize,
    amountLineHeight: getComputedStyle(el.querySelector('.amount')).lineHeight,
  }));
  const canvas = document.getElementById('patrimonySparklineInicio');
  const box = canvas.parentElement;
  const canvasRect = rect(canvas);
  const boxRect = rect(box);
  const bank = cards.find((c) => c.className.includes('bank-summary-card'));
  const pocket = cards.find((c) => c.className.includes('pocket-summary-card'));
  const invest = cards.find((c) => c.className.includes('invest-summary-card'));
  const breakdownRect = rect(document.getElementById('investBreakdownBox'));
  const triangular =
    bank.rect.top < pocket.rect.top &&
    Math.abs(pocket.rect.top - invest.rect.top) < 1 &&
    bank.rect.width > pocket.rect.width &&
    bank.rect.width > invest.rect.width &&
    breakdownRect.width >= bank.rect.width - 1;
  return {
    viewport: [window.innerWidth, window.innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    stripColumns: getComputedStyle(strip).gridTemplateColumns,
    mainColumns: getComputedStyle(document.querySelector('#viewInicio .inicio-grid')).gridTemplateColumns,
    bank: { rect: bank.rect, fontSize: bank.amountFontSize, lineHeight: bank.amountLineHeight },
    pocket: { rect: pocket.rect, fontSize: pocket.amountFontSize },
    invest: { rect: invest.rect, fontSize: invest.amountFontSize },
    triangular,
    canvas: {
      width: canvasRect.width,
      parentWidth: boxRect.width,
      cut: canvasRect.width > boxRect.width + 0.5 || canvasRect.right > boxRect.right + 0.5,
    },
    fixed: {
      fab: rect(document.querySelector('.fab-add')),
      bottomNav: rect(document.querySelector('.mobile-bottom-nav')),
    },
  };
})()
`;

const overlayExpression = `
(() => {
  const visibleFixed = Array.from(document.querySelectorAll('body *')).map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { el, cs, r };
  }).filter(({ cs, r }) =>
    (cs.position === 'fixed' || cs.position === 'absolute') &&
    cs.display !== 'none' && cs.visibility !== 'hidden' &&
    Number(cs.opacity) > 0 && r.width >= 60 && r.height >= 60
  ).map(({ el, cs, r }) => ({
    id: el.id || null,
    className: typeof el.className === 'string' ? el.className : '',
    tag: el.tagName,
    position: cs.position,
    zIndex: cs.zIndex,
    opacity: cs.opacity,
    filter: cs.filter,
    backdropFilter: cs.backdropFilter,
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage === 'none' ? null : String(cs.backgroundImage).slice(0, 140),
    rect: { top: +r.top.toFixed(1), left: +r.left.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) },
  }));
  const pointStacks = [[window.innerWidth / 2, 90], [window.innerWidth / 2, window.innerHeight / 2], [window.innerWidth / 2, window.innerHeight - 28]]
    .map(([x, y]) => document.elementsFromPoint(x, y).slice(0, 6).map((el) => ({
      tag: el.tagName,
      id: el.id || null,
      className: typeof el.className === 'string' ? el.className : '',
    })));
  const overlays = ['authOverlay', 'syncOverlay', 'modalOverlay'].map((id) => {
    const el = document.getElementById(id);
    const cs = el ? getComputedStyle(el) : null;
    return { id, present: !!el, display: cs ? cs.display : null, opacity: cs ? cs.opacity : null, className: el ? el.className : null };
  });
  return {
    url: location.href,
    bodyClass: document.body.className,
    bodyDataset: { tab: document.body.dataset.tab || null, light: document.body.dataset.lightTheme || null, dark: document.body.dataset.darkTheme || null },
    visibleFixed,
    pointStacks,
    overlays,
    openPanels: Array.from(document.querySelectorAll('.panel.open')).map((el) => el.id || el.className),
    loading: document.body.classList.contains('is-data-loading'),
    tabChanging: document.body.classList.contains('tab-changing'),
  };
})()
`;

const fontExpression = `
(() => {
  const families = ['tabler-icons', 'uicons-regular-rounded', 'uicons-solid-rounded', 'Plus Jakarta Sans', 'Inter', 'Roboto', 'Open Sans', 'Space Grotesk', 'Manrope', 'Outfit', 'Sora'];
  const checks = {};
  families.forEach((family) => {
    try { checks[family] = document.fonts.check('16px "' + family + '"'); }
    catch (_) { checks[family] = 'erro'; }
  });
  const glyphs = Array.from(document.querySelectorAll('#balanceStrip .balance-symbol i')).map((el) => {
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, '::before');
    return {
      className: el.className,
      fontFamily: cs.fontFamily,
      beforeContent: before.content,
      beforeFontFamily: before.fontFamily,
    };
  });
  return {
    status: document.fonts.status,
    size: document.fonts.size,
    checks,
    loaded: Array.from(document.fonts).map((font) => ({ family: font.family, status: font.status })),
    stripGlyphs: glyphs,
  };
})()
`;

(async () => {
  let client;
  const net = { requests: [], responses: [], failures: [], consoleErrors: [], exceptions: [] };
  try {
    client = await CDP({ port: 9223 });
    const { Page, Runtime, Network, Emulation } = client;
    await Promise.all([Page.enable(), Runtime.enable(), Network.enable()]);

    Network.requestWillBeSent((p) => net.requests.push({ requestId: p.requestId, url: p.request.url, type: p.type || null }));
    Network.responseReceived((p) => net.responses.push({ url: p.response.url, status: p.response.status, mimeType: p.response.mimeType || null }));
    Network.loadingFailed((p) => net.failures.push({ url: (net.requests.find((r) => r.requestId === p.requestId) || {}).url || p.requestId, error: p.errorText, blockedReason: p.blockedReason || null }));
    Runtime.consoleAPICalled((p) => {
      if (p.type === 'error' || p.type === 'warning') net.consoleErrors.push({ type: p.type, text: p.args.map((a) => a.value || a.description || '').join(' ') });
    });
    Runtime.exceptionThrown((p) => net.exceptions.push(p.exceptionDetails.text + ' ' + (p.exceptionDetails.exception?.description || '')));

    if (ICON_MODE === 'block') {
      await Network.setBlockedURLs({
        urls: [
          '*.js*', '*/js/*', '*fonts.googleapis.com*', '*fonts.gstatic.com*',
          '*cdnjs.cloudflare.com*', '*jsdelivr.net*', '*gstatic.com*', '*flaticon.com*',
        ],
      });
    } else {
      await Network.setBlockedURLs({ urls: [] });
    }

    const loaded = new Promise((resolve) => Page.loadEventFired(resolve));
    await Page.navigate({ url: 'http://127.0.0.1:8123/index.html' });
    await loaded;

    const evaluate = async (expression, awaitPromise = false) => {
      const response = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise });
      if (response.exceptionDetails) {
        throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
      }
      return response.result.value;
    };
    const settle = () => evaluate('new Promise(function(r){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(r, 260); }); }); });', true);

    await evaluate(inject);
    await evaluate('document.fonts.ready.then(function(){ return true; });', true).catch(() => null);
    await settle();

    const rows = [];
    const diagnostics = [];
    for (const combo of COMBOS) {
      const { viewport, theme } = combo;
      await Emulation.setDeviceMetricsOverride({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evaluate(setThemeExpression(theme));
      await settle();

      const metrics = await evaluate(metricsExpression);
      const overlay = await evaluate(overlayExpression);
      const fonts = await evaluate(fontExpression);
      const key = `${viewport.name}-${theme.name}`;

      const viewportFile = path.join(DIRS.viewport, `viewport-${key}.png`);
      const shotViewport = await Page.captureScreenshot({ format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(viewportFile, Buffer.from(shotViewport.data, 'base64'));

      const fullFile = path.join(DIRS.fullpage, `fullpage-${key}.png`);
      await evaluate('window.scrollTo(0, 0);');
      const shotFull = await Page.captureScreenshot({ format: 'png', captureBeyondViewport: true });
      fs.writeFileSync(fullFile, Buffer.from(shotFull.data, 'base64'));

      const cardFile = path.join(DIRS.card, `card-bancos-${key}.png`);
      const r = metrics.bank.rect;
      const clip = {
        x: Math.max(0, Math.floor(r.left)),
        y: Math.max(0, Math.floor(r.top)),
        width: Math.min(viewport.width, Math.ceil(r.width)),
        height: Math.min(viewport.height, Math.ceil(r.height)),
        scale: 1,
      };
      const shotCard = await Page.captureScreenshot({ format: 'png', captureBeyondViewport: false, clip });
      fs.writeFileSync(cardFile, Buffer.from(shotCard.data, 'base64'));

      const grayCandidate = overlay.visibleFixed.filter((el) => {
        const bg = String(el.backgroundColor || '');
        return /rgba?\([^)]*0?\.[0-9]|rgba?\([^)]*,\s*0?\.[0-9]/.test(bg) || el.backdropFilter !== 'none' || String(el.filter || '') !== 'none';
      });
      rows.push({
        key,
        viewport: viewport.name,
        theme: theme.name,
        overflow: metrics.horizontalOverflow ? 'FAIL' : 'PASS',
        canvas: metrics.canvas.cut ? 'FAIL' : 'PASS',
        triangular: metrics.triangular ? 'PASS' : 'FAIL',
        bankFontPx: metrics.bank.fontSize,
        bankLineHeight: metrics.bank.lineHeight,
        bankHeightPx: metrics.bank.rect.height,
        pocketFontPx: metrics.pocket.fontSize,
        investFontPx: metrics.invest.fontSize,
        viewportFile: path.relative(REPO, viewportFile),
        fullpageFile: path.relative(REPO, fullFile),
        cardFile: path.relative(REPO, cardFile),
      });
      diagnostics.push({
        key,
        viewport: viewport.name,
        theme: theme.name,
        overlay,
        grayCandidate,
        fonts,
      });
    }

    const matrixLines = [
      `# C6-INICIO-02 complementar — matriz visual (${ROUND}, ícones ${ICON_MODE})`,
      '',
      '| Viewport | Tema | Overflow | Canvas | Triângulo | Fonte Bancos | Altura Bancos | Caixinhas | Invest. |',
      '|---|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.viewport} | ${r.theme} | ${r.overflow} | ${r.canvas} | ${r.triangular} | ${r.bankFontPx} / ${r.bankLineHeight} | ${r.bankHeightPx}px | ${r.pocketFontPx} | ${r.investFontPx} |`),
      '',
      '## Arquivos',
      '',
      ...rows.flatMap((r) => [
        `- \`${r.viewportFile}\` (viewport — avalia FAB/navegação inferior)`,
        `- \`${r.fullpageFile}\` (página inteira — documentação complementar)`,
        `- \`${r.cardFile}\` (recorte do card Bancos)`,
      ]),
      '',
    ];
    fs.writeFileSync(path.join(DIRS.diag, `MATRIZ-${ROUND}-${ICON_MODE}.md`), matrixLines.join('\n'));

    const diagPayload = {
      round: ROUND,
      iconMode: ICON_MODE,
      scope: SCOPE,
      combos: COMBOS.map((c) => `${c.viewport.name}/${c.theme.name}`),
      diagnostics,
      network: net,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(DIRS.diag, `DIAGNOSTICO-${ROUND}-${ICON_MODE}.json`),
      JSON.stringify(diagPayload, null, 2)
    );

    const failures = rows.filter((r) => r.overflow === 'FAIL' || r.canvas === 'FAIL' || r.triangular === 'FAIL');
    console.log(`round=${ROUND} iconMode=${ICON_MODE} scope=${SCOPE} capturas=${rows.length * 3} falhas=${failures.length}`);
    console.log(`rede: requests=${net.requests.length} responses=${net.responses.length} failures=${net.failures.length} consoleErrors=${net.consoleErrors.length} exceptions=${net.exceptions.length}`);
    if (failures.length) {
      failures.slice(0, 20).forEach((r) => console.log(`FAIL ${r.key} overflow=${r.overflow} canvas=${r.canvas} triangular=${r.triangular}`));
      process.exitCode = 1;
    }
  } finally {
    if (client) await client.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
