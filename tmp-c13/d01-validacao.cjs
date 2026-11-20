// D-01 — Validação funcional real no navegador via CDP
// BLOCK_MODE: aborta requisições externas (sem rede no Termux) para que o DOM carregue.
// Usa Runtime.evaluate no contexto da página para inspecionar elementos DOM reais.
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/data/data/com.termux/files/home/LIVRO-CAIXA';
const APP_URL = 'http://127.0.0.1:8000/index.html';

async function main() {
  let client;
  const checks = [];
  const consoleErrors = [];
  function record(id, desc, expected, observed, status) {
    checks.push({ id, desc, expected, observed, status });
  }
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Fetch } = client;
    await Runtime.enable();
    await Page.enable();
    await Network.enable();
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

    // Injeta stub mínimo do Firebase ANTES dos scripts da página, para que o JS real
    // da aplicação inicialize (sem credenciais, sem dados, sem rede).
    await Page.addScriptToEvaluateOnNewDocument({ source: `
      (function(){
        function noop(){ return { catch: function(){ return this; }, then: function(){ return this; } }; }
        var stubAuth = {
          onAuthStateChanged: function(cb){ try{ cb(null); }catch(e){} return function(){}; },
          currentUser: null,
          signInWithPopup: function(){ return Promise.reject(new Error('stub')); },
          signOut: function(){ return Promise.resolve(); }
        };
        stubAuth.GoogleAuthProvider = function(){ this.addScope = function(){ return this; }; };
        var firestoreStub = {
          enablePersistence: function(){ return { catch: noop }; },
          collection: function(){ return { doc: function(){ return {
            get: function(){ return Promise.resolve({ exists: false, data: function(){return {};} }); },
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

    // Aborta qualquer requisição que NÃO seja local (127.0.0.1)
    Fetch.requestPaused(async ({ requestId, request }) => {
      const isLocal = request.url.startsWith('http://127.0.0.1:8000') || request.url.startsWith('data:') || request.url.startsWith('about:');
      try {
        if (isLocal) await Fetch.continueRequest({ requestId });
        else await Fetch.failRequest({ requestId, errorReason: 'Failed' });
      } catch (e) {}
    });

    Runtime.consoleAPICalled(({ type, args }) => {
      if (type === 'error') consoleErrors.push(args.map(a => a.value ?? a.description ?? '').join(' '));
    });
    Runtime.exceptionThrown(({ exceptionDetails }) => {
      consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception');
    });

    await Page.navigate({ url: APP_URL });

    // Aguarda o DOM da nav existir (poll)
    async function evalInPage(expression) {
      const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    }
    let navReady = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        navReady = await evalInPage(`!!document.querySelector('.mobile-bottom-nav button[data-destination]')`);
        if (navReady) break;
      } catch (e) {}
    }
    if (!navReady) throw new Error('Nav não apareceu no DOM após aguardar');
    await new Promise(r => setTimeout(r, 500));

    const destinos = await evalInPage(`Array.from(document.querySelectorAll('.mobile-bottom-nav button[data-destination]')).map(b=>b.dataset.destination)`);
    record('V1', 'Barra inferior com exatamente 5 destinos', '5: inicio,pockets,caixa,invest,profile',
      destinos.length + ': ' + destinos.join(','),
      destinos.length === 5 && destinos[0] === 'inicio' ? 'PASS' : 'FAIL');

    const first = await evalInPage(`(()=>{const b=document.querySelector('.mobile-bottom-nav button[data-destination]');return {dest:b.dataset.destination,aria:b.getAttribute('aria-label'),icon:b.querySelector('i')?.className}})()`);
    record('V2', 'Primeiro destino inicio, ícone casa, aria-label Início',
      'dest=inicio, aria=Início, icon contém fi-rr-home', JSON.stringify(first),
      first.dest === 'inicio' && first.aria === 'Início' && /fi-rr-home/.test(first.icon) ? 'PASS' : 'FAIL');

    const viewExists = await evalInPage(`!!document.getElementById('viewInicio')`);
    record('V3', '#viewInicio existe no DOM', 'true', String(viewExists), viewExists ? 'PASS' : 'FAIL');

    // Verificar que switchTab está disponível
    const hasSwitch = await evalInPage(`typeof window.switchTab === 'function'`);
    record('V3b', 'window.switchTab disponível', 'true', String(hasSwitch), hasSwitch ? 'PASS' : 'FAIL');

    await evalInPage(`window.switchTab('inicio')`);
    await new Promise(r => setTimeout(r, 500));
    const afterInicio = await evalInPage(`(()=>{
      const nav=document.querySelector('.mobile-bottom-nav');
      const btn=nav.querySelector('button[data-destination="inicio"]');
      return {
        viewInicioActive: document.getElementById('viewInicio')?.classList.contains('active'),
        isActive: btn.classList.contains('is-active'),
        navActive: nav.dataset.active,
        indicatorX: nav.style.getPropertyValue('--nav-indicator-x')
      };
    })()`);
    record('V4', 'Início ativa view, is-active e indicador na 1ª posição',
      'viewInicioActive=true, isActive=true, navActive=inicio, indicatorX=0%', JSON.stringify(afterInicio),
      afterInicio.viewInicioActive && afterInicio.isActive && afterInicio.navActive === 'inicio' && afterInicio.indicatorX === '0%' ? 'PASS' : 'FAIL');

    for (const dest of ['pockets', 'caixa', 'invest', 'profile']) {
      await evalInPage(`window.switchTab('${dest}')`);
      await new Promise(r => setTimeout(r, 300));
      const st = await evalInPage(`(()=>{const nav=document.querySelector('.mobile-bottom-nav');const b=nav.querySelector('button[data-destination="${dest}"]');return {isActive:b.classList.contains('is-active'),navActive:nav.dataset.active}})()`);
      record('V5-' + dest, 'Navegação para ' + dest, 'isActive=true, navActive=' + dest, JSON.stringify(st),
        st.isActive && st.navActive === dest ? 'PASS' : 'FAIL');
    }

    // Persistência: switchTab persiste a última aba
    await evalInPage(`window.switchTab('inicio')`);
    await new Promise(r => setTimeout(r, 300));
    const sessionKeys = await evalInPage(`JSON.stringify(Object.keys(sessionStorage))`);
    const savedTab = await evalInPage(`(()=>{let v=null;for(const k of Object.keys(sessionStorage)){const val=sessionStorage.getItem(k);if(val==='inicio'){v=k;break}}return v?sessionStorage.getItem(v):null})()`);
    record('V6a', 'Última aba salva é inicio', 'inicio', String(savedTab) + ' (keys: ' + sessionKeys + ')',
      savedTab === 'inicio' ? 'PASS' : 'FAIL');

    await Page.reload();
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 300));
      try { if (await evalInPage(`!!document.querySelector('.mobile-bottom-nav button[data-destination]')`)) break; } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 500));
    const afterReload = await evalInPage(`(()=>{const nav=document.querySelector('.mobile-bottom-nav');return {viewInicioActive:document.getElementById('viewInicio')?.classList.contains('active'),navActive:nav.dataset.active}})()`);
    record('V6b', 'Restauração de inicio após reload', 'viewInicioActive=true, navActive=inicio', JSON.stringify(afterReload),
      afterReload.viewInicioActive && afterReload.navActive === 'inicio' ? 'PASS' : 'FAIL');

    const dashOk = await evalInPage(`(()=>{window.switchTab('dashboard');return {ok:document.getElementById('viewDashboard')?.classList.contains('active'),tab:document.body.dataset.tab}})()`);
    record('V7', 'dashboard legado acessível via switchTab', 'viewDashboard active=true, tab=dashboard', JSON.stringify(dashOk),
      dashOk.ok && dashOk.tab === 'dashboard' ? 'PASS' : 'FAIL');

    const navErrors = consoleErrors.filter(e => /nav|tab|switch|indicator|destination/i.test(e));
    record('V8', 'Sem erros novos de console relacionados à navegação', '0 erros',
      navErrors.length + (navErrors.length ? ': ' + navErrors.join(' | ') : ''), navErrors.length === 0 ? 'PASS' : 'FAIL');

    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    console.log('\n=== D-01 VALIDAÇÃO FUNCIONAL (CDP real, externos bloqueados) ===');
    for (const c of checks) console.log(`[${c.status}] ${c.id}: ${c.desc} | obs: ${c.observed}`);
    console.log(`\nRESUMO: ${pass} PASS / ${fail} FAIL / ${checks.length} TOTAL`);
    console.log('Console errors (total):', consoleErrors.length);

    const out = {
      meta: { task: 'D-01', url: APP_URL, timestamp: new Date().toISOString(),
        browser: 'Chromium 156 headless CDP', method: 'Runtime.evaluate + Fetch bloqueio de externos' },
      summary: { total: checks.length, pass, fail }, checks, consoleErrors,
      note: 'Recursos externos (CDN) abortados por ausência de rede no Termux; app JS local carregado. Firebase autenticação pode não inicializar — validação cobre apenas mecanismo de navegação.'
    };
    fs.writeFileSync(path.join(PROJECT_ROOT, 'tmp-c13/d01-validacao-resultados.json'), JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('FATAL:', e.message);
  } finally {
    if (client) { try { client._ws.close(); } catch (e) {} }
  }
}
main();
