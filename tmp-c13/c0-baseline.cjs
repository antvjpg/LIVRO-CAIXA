const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const CDP = require('chrome-remote-interface');

const REPO = process.cwd();
const URL_BASE = 'http://127.0.0.1:8000';
const URL_PAGE = URL_BASE + '/index.html';
const OUT_JSON = 'tmp-c13/c0-baseline-ficha.json';
const OUT_MD = 'tmp-c13/c0-baseline-ficha.md';

function sha(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
}

function headBlob(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: REPO,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    return null;
  }
}

function localPath(rel) {
  const p = path.normalize(path.join(REPO, rel));
  return p.startsWith(REPO + path.sep) || p === REPO ? p : null;
}

async function evaluate(client, expression) {
  const r = await client.Runtime.evaluate({
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
}

async function fetchViaPage(client, url) {
  const expression = `(async () => {
    const r = await fetch(${JSON.stringify(url)}, { cache: 'no-store' });
    return { status: r.status, text: await r.text() };
  })()`;
  return evaluate(client, expression);
}

function status(ok, detail) {
  return { status: ok ? 'PASS' : 'FAIL', detail };
}

(async () => {
  const startedAt = new Date().toISOString();
  const meta = {
    task: 'C.0 — fechamento do baseline técnico',
    branch: git(['branch', '--show-current']),
    head: git(['rev-parse', 'HEAD']),
    upstream: git(['rev-parse', '@{upstream}']),
    statusEntries: git(['status', '--short']).split('\n').filter(Boolean).filter((line) => {
      const p = line.slice(3);
      return !p.startsWith('tmp-c13/c0-');
    }).length,
    excludedFromStatus: 'tmp-c13/c0-* (evidencias e logs desta propria coleta)',
    originMain: git(['rev-list', '--left-right', '--count', 'origin/main...HEAD']).replace(/\s+/g, ' '),
    localMain: git(['rev-list', '--left-right', '--count', 'main...HEAD']).replace(/\s+/g, ' '),
    remoteUrl: git(['remote', 'get-url', 'origin']),
    lastCommit: git(['log', '-1', '--format=%H %ad %s', '--date=iso-strict']),
  };

  let httpStatus = '000';
  try {
    httpStatus = execFileSync('curl', [
      '-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '5',
      `${URL_BASE}/index.html`,
    ], { encoding: 'utf8' }).trim();
  } catch (e) {
    httpStatus = '000';
  }

  const events = { blocked: [], consoleErrors: [], exceptions: [] };
  let client;
  const report = {
    meta,
    startedAt,
    server: {
      url: URL_BASE,
      command: 'python3 -m http.server 8000 --bind 127.0.0.1',
      httpStatus,
    },
    environment: {},
    served: [],
    checks: [],
    limitations: [],
  };

  try {
    client = await CDP({ port: 9222 });
    const { Browser, Page, Runtime, Network, Fetch, Emulation, ServiceWorker } = client;

    await Promise.all([
      Runtime.enable(),
      Page.enable(),
      Network.enable(),
    ]);
    try { await ServiceWorker.disable(); } catch (e) {}
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    Fetch.requestPaused(async ({ requestId, request }) => {
      const isLocal = request.url.startsWith(URL_BASE) ||
        request.url.startsWith('data:') ||
        request.url.startsWith('about:');
      if (!isLocal && events.blocked.length < 50) {
        events.blocked.push(request.url.slice(0, 160));
      }
      try {
        if (isLocal) await Fetch.continueRequest({ requestId });
        else await Fetch.failRequest({ requestId, errorReason: 'Failed' });
      } catch (e) {}
    });

    Runtime.consoleAPICalled((p) => {
      if (p.type === 'error' && events.consoleErrors.length < 30) {
        events.consoleErrors.push((p.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 300));
      }
    });
    Runtime.exceptionThrown((p) => {
      if (events.exceptions.length < 30) {
        events.exceptions.push(String(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '').slice(0, 300));
      }
    });

    await Page.addScriptToEvaluateOnNewDocument({ source: `
      (function(){
        function noop(){ return { catch(){return this;}, then(){return this;} }; }
        var stubAuth = {
          onAuthStateChanged: function(cb){ setTimeout(function(){ try{ cb(null); }catch(e){} }, 0); return function(){}; },
          currentUser: null,
          signInWithPopup: function(){ return Promise.reject(new Error('stub')); },
          signOut: function(){ return Promise.resolve(); }
        };
        stubAuth.GoogleAuthProvider = function(){ this.addScope = function(){ return this; }; };
        var firestoreStub = {
          enablePersistence: function(){ return { catch: noop }; },
          collection: function(){ return { doc: function(){ return {
            get: function(){ return Promise.resolve({ exists:false, data:function(){return {};} }); },
            set: function(){ return Promise.resolve(); },
            onSnapshot: function(){ return function(){}; }
          }; } }; }
        };
        window.firebase = {
          initializeApp: function(){},
          auth: function(){ return stubAuth; },
          firestore: function(){ return firestoreStub; },
          apps: []
        };
      })();
    ` });

    await Emulation.setDeviceMetricsOverride({
      width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
    });
    await Network.setCacheDisabled({ cacheDisabled: true });
    await Page.navigate({ url: URL_PAGE });
    await Page.loadEventFired();

    let ready = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        ready = await evaluate(client, `!!document.querySelector('.mobile-bottom-nav button[data-destination]')`);
      } catch (e) {}
      if (ready) break;
    }

    const browser = await Browser.getVersion();
    const runtime = await evaluate(client, `({
      href: location.href,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      readyState: document.readyState,
      bodyClass: document.body.className || '',
      lightTheme: document.body.getAttribute('data-light-theme') || '',
      darkTheme: document.body.getAttribute('data-dark-theme') || '',
      destinationButtons: document.querySelectorAll('.mobile-bottom-nav button[data-destination]').length,
      stylesheets: Array.from(document.styleSheets).length,
      scripts: document.scripts.length
    })`);

    report.environment = {
      browserProduct: browser.product,
      browserRevision: browser.revision,
      browserUserAgent: browser.userAgent,
      runtime,
      domReady: ready,
      blockedExternalRequests: events.blocked.length,
      blockedExamples: events.blocked.slice(0, 10),
      consoleErrors: events.consoleErrors,
      exceptions: events.exceptions,
      externalPolicy: 'Fetch.requestPaused: somente 127.0.0.1:8000, data: e about: são liberados',
      firebaseStub: 'stub mínimo injetado via Page.addScriptToEvaluateOnNewDocument',
      serviceWorker: 'ServiceWorker.disable() + Network.setCacheDisabled(true)',
    };

    const html = await fetchViaPage(client, URL_PAGE);
    const htmlLocal = fs.readFileSync(path.join(REPO, 'index.html'));
    const htmlHead = headBlob('index.html');
    report.served.push({
      path: 'index.html',
      httpStatus: html.status,
      servedSha256: sha(Buffer.from(html.text, 'utf8')),
      localSha256: sha(htmlLocal),
      headSha256: htmlHead ? sha(htmlHead) : null,
    });

    const refs = new Set(['./sw.js']);
    for (const m of html.text.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)) {
      const clean = m[1].split('?')[0];
      if (/\.(js|css)$/.test(clean) || clean.endsWith('/sw.js')) refs.add(clean);
    }

    for (const ref of Array.from(refs).sort()) {
      const rel = ref.replace(/^\.\//, '');
      const abs = localPath(rel);
      if (!abs || !fs.existsSync(abs)) {
        report.served.push({ path: rel, error: 'arquivo local ausente' });
        continue;
      }
      try {
        const res = await fetchViaPage(client, `${URL_BASE}/${rel}`);
        const local = fs.readFileSync(abs);
        const head = headBlob(rel);
        report.served.push({
          path: rel,
          httpStatus: res.status,
          servedSha256: sha(Buffer.from(res.text, 'utf8')),
          localSha256: sha(local),
          headSha256: head ? sha(head) : null,
        });
      } catch (e) {
        report.served.push({ path: rel, error: String(e.message || e).slice(0, 200) });
      }
    }

    const withHash = report.served.filter(x => x.servedSha256);
    const servedMatchesLocal = withHash.filter(x => x.servedSha256 === x.localSha256).length;
    const localMatchesHead = withHash.filter(x => x.localSha256 === x.headSha256).length;
    const allMatch = withHash.length > 0 && servedMatchesLocal === withHash.length && localMatchesHead === withHash.length;
    const serverIdentified = httpStatus === '200';

    report.checks.push(status(
      meta.branch === 'feat/app-layout-redesign' && meta.head === meta.upstream,
      `branch ${meta.branch}; HEAD ${meta.head.slice(0, 8)} = upstream ${meta.upstream.slice(0, 8)}`
    ));
    report.checks.push(status(meta.statusEntries === 0, `working tree: ${meta.statusEntries} entradas`));
    report.checks.push(status(meta.originMain === '0 84', `origin/main...HEAD = ${meta.originMain}`));
    report.checks.push(status(serverIdentified, `servidor local ${URL_BASE} respondeu HTTP ${httpStatus}`));
    report.checks.push(status(ready, `DOM pronto: ${ready}; botões de destino: ${runtime.destinationButtons}`));
    report.checks.push(status(
      allMatch,
      `${servedMatchesLocal}/${withHash.length} servidos = locais; ${localMatchesHead}/${withHash.length} locais = HEAD`
    ));
    report.checks.push(status(
      !!report.environment.browserProduct && !!runtime.href,
      `browser ${report.environment.browserProduct}; viewport ${runtime.viewport.width}x${runtime.viewport.height}; tema ${runtime.bodyClass || 'padrão'}`
    ));

    report.shaServidoStatus = allMatch && serverIdentified ? 'PASS' : 'PARTIAL/BLOCKED';
    report.veredito = report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'PARTIAL/BLOCKED';
  } catch (e) {
    report.veredito = 'BLOCKED';
    report.error = String(e.stack || e.message || e).slice(0, 2000);
  } finally {
    if (client) {
      try { await client.close(); } catch (e) {}
    }
  }

  report.finishedAt = new Date().toISOString();
  report.limitations = [
    'Recursos externos foram bloqueados; CDNs e Firebase real não foram validados.',
    'O servidor é local e estático; build/publicação remota não foi certificada.',
    'C.0 não implica aprovação de C.1–C.8.',
  ];

  fs.writeFileSync(path.join(REPO, OUT_JSON), JSON.stringify(report, null, 2) + '\n');

  const lines = [];
  lines.push('# C.0 — Ficha de baseline técnico');
  lines.push('');
  lines.push(`Executado: ${report.startedAt} → ${report.finishedAt}`);
  lines.push('');
  lines.push('## Identificação');
  lines.push('');
  lines.push(`- Branch: \`${meta.branch}\``);
  lines.push(`- HEAD local: \`${meta.head}\``);
  lines.push(`- Upstream: \`${meta.upstream}\``);
  lines.push(`- Working tree: ${meta.statusEntries} entradas`);
  lines.push(`- origin/main...HEAD: \`${meta.originMain}\``);
  lines.push(`- main local...HEAD: \`${meta.localMain}\``);
  lines.push(`- Commit: ${meta.lastCommit}`);
  lines.push('');
  lines.push('## Servidor e ambiente');
  lines.push('');
  lines.push(`- Origem: \`${report.server.command}\` em \`${report.server.url}\``);
  lines.push(`- HTTP: ${report.server.httpStatus}`);
  if (report.environment.browserProduct) {
    lines.push(`- Browser: ${report.environment.browserProduct} / ${report.environment.browserRevision}`);
    lines.push(`- UA: ${report.environment.browserUserAgent}`);
  }
  if (report.environment.runtime) {
    const r = report.environment.runtime;
    lines.push(`- URL: ${r.href}`);
    lines.push(`- Viewport: ${r.viewport.width}x${r.viewport.height} (DPR ${r.viewport.dpr})`);
    lines.push(`- Tema/body class: ${r.bodyClass || 'padrão'}`);
    lines.push(`- Botões de destino: ${r.destinationButtons}`);
  }
  lines.push(`- Recursos externos bloqueados: ${report.environment.blockedExternalRequests ?? 'n/a'}`);
  lines.push(`- Erros de console: ${report.environment.consoleErrors?.length ?? 'n/a'}`);
  lines.push(`- Exceções: ${report.environment.exceptions?.length ?? 'n/a'}`);
  lines.push('');
  lines.push('## SHA servido');
  lines.push('');
  lines.push('| Arquivo | Servido | Local | HEAD |');
  lines.push('|---|---|---|---|');
  for (const s of report.served) {
    const v = s.servedSha256 ? s.servedSha256.slice(0, 12) : (s.error || 'n/a');
    const l = s.localSha256 ? s.localSha256.slice(0, 12) : '-';
    const h = s.headSha256 ? s.headSha256.slice(0, 12) : '-';
    lines.push(`| ${s.path} | ${v} | ${l} | ${h} |`);
  }
  lines.push('');
  lines.push(`**SHA servido = HEAD:** ${report.shaServidoStatus ?? 'n/a'}`);
  lines.push('');
  lines.push('## Critérios');
  lines.push('');
  lines.push('| Estado | Detalhe |');
  lines.push('|---|---|---|');
  for (const c of report.checks) {
    lines.push(`| ${c.status} | ${c.detail.replace(/\|/g, '/')} |`);
  }
  lines.push('');
  lines.push('## Veredito');
  lines.push('');
  lines.push(`**${report.veredito}**`);
  if (report.error) lines.push('');
  if (report.error) lines.push(`Erro: ${report.error}`);
  lines.push('');
  lines.push('## Limitações');
  lines.push('');
  for (const l of report.limitations) lines.push(`- ${l}`);
  lines.push('');
  fs.writeFileSync(path.join(REPO, OUT_MD), lines.join('\n'));

  console.log(`C.0 veredito: ${report.veredito}`);
  console.log(`Servidos conferidos: ${report.served.filter(x => x.servedSha256).length}`);
  console.log(`Evidencias: ${OUT_JSON}, ${OUT_MD}`);
})();
