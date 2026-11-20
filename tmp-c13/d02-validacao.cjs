// D-02 — Validação funcional real: Entrada de Início no Drawer
// Metodologia: docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = '/data/data/com.termux/files/home/LIVRO-CAIXA';
const APP_URL = 'http://127.0.0.1:8000/index.html';

async function main() {
  let client;
  const checks = [];
  const consoleErrors = [];
  const record = (id, desc, expected, observed, status) => checks.push({ id, desc, expected, observed, status });
  try {
    client = await CDP({ port: 9222 });
    const { Page, Runtime, Network, Fetch } = client;
    await Runtime.enable(); await Page.enable(); await Network.enable();
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    Fetch.requestPaused(async ({ requestId, request }) => {
      const isLocal = request.url.startsWith('http://127.0.0.1:8000') || request.url.startsWith('data:') || request.url.startsWith('about:');
      try { isLocal ? await Fetch.continueRequest({ requestId }) : await Fetch.failRequest({ requestId, errorReason: 'Failed' }); } catch (e) {}
    });
    await Page.addScriptToEvaluateOnNewDocument({ source: `
      (function(){
        function noop(){ return { catch(){return this;}, then(){return this;} }; }
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
            get: function(){ return Promise.resolve({ exists:false, data:function(){return {};} }); },
            set: function(){ return Promise.resolve(); },
            onSnapshot: function(){ return function(){}; }
          }; } }; }
        };
        window.firebase = { initializeApp:function(){}, auth:function(){return stubAuth;}, firestore:function(){return firestoreStub;}, apps:[] };
      })();
    ` });
    Runtime.consoleAPICalled(({ type, args }) => { if (type==='error') consoleErrors.push(args.map(a=>a.value??a.description??'').join(' ')); });
    Runtime.exceptionThrown(({ exceptionDetails }) => { consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception'); });

    await Page.navigate({ url: APP_URL });
    async function ev(expression) {
      const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    }
    let ready = false;
    for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,300)); try{ ready = await ev(`!!document.querySelector('[data-drawer-action="inicio"]')`); }catch(e){} if(ready)break; }
    if (!ready) throw new Error('Botão inicio do drawer não apareceu');
    await new Promise(r=>setTimeout(r,500));

    // V1: botão existe no grupo principal do drawer
    const v1 = await ev(`(()=>{const b=document.querySelector('[data-drawer-action="inicio"]');const nav=b?.closest('.drawer-nav');return {exists:!!b,text:b?.textContent.trim(),inPrincipal:!!nav && !nav.classList.contains('drawer-nav-secondary'),isFirst:nav?.firstElementChild===b,icon:b?.querySelector('i')?.className}})()`);
    record('V1','Botão Início existe no grupo principal do drawer','exists=true, inPrincipal=true, isFirst=true, icon=fi-rr-home',JSON.stringify(v1),
      v1.exists && v1.inPrincipal && v1.isFirst && /fi-rr-home/.test(v1.icon) ? 'PASS':'FAIL');

    // V2: abrir drawer (si disponível) e clicar Início
    const v2setup = await ev(`(()=>{try{ if(typeof window.openDrawer==='function'){window.openDrawer();return 'openDrawer()';} document.getElementById('btnOpenDrawer')?.click(); return 'btnOpenDrawer.click'; }catch(e){return 'err:'+e.message}})()`);
    await new Promise(r=>setTimeout(r,300));
    const beforeClick = await ev(`(()=>{const o=document.getElementById('appDrawerOverlay');return {overlayOpen:o?o.classList.contains('is-open'):null,bodyClass:document.body.className}})()`);
    await ev(`document.querySelector('[data-drawer-action="inicio"]').click()`);
    await new Promise(r=>setTimeout(r,500));
    const v2 = await ev(`(()=>{const o=document.getElementById('appDrawerOverlay');return {viewInicioActive:document.getElementById('viewInicio')?.classList.contains('active'),navActive:document.querySelector('.mobile-bottom-nav')?.dataset.active,drawerOpen:o?o.classList.contains('is-open'):null,drawerAriaHidden:o?o.getAttribute('aria-hidden'):null}})()`);
    record('V2','Clique Início no drawer abre view e fecha drawer','viewInicioActive=true, navActive=inicio, drawerOpen=false, drawerAriaHidden=true',JSON.stringify({setup:v2setup,beforeClick,...v2}),
      v2.viewInicioActive && v2.navActive==='inicio' && v2.drawerOpen===false && v2.drawerAriaHidden==='true' ? 'PASS':'FAIL');

    // V3: sem listener duplicado (dispatcher único)
    const v3 = await ev(`(()=>{const b=document.querySelector('[data-drawer-action="inicio"]');return {action:b.dataset.drawerAction,count:document.querySelectorAll('[data-drawer-action="inicio"]').length}})()`);
    record('V3','Ação inicio mapeada uma vez, sem duplicação','count=1',JSON.stringify(v3),v3.count===1?'PASS':'FAIL');

    // V4: demais ações do drawer continuam operacionais
    const otherActions = ['overview','dash','pockets','investments','profile'];
    for (const a of otherActions) {
      try { if(typeof window.openDrawer==='function') window.openDrawer(); else document.getElementById('btnOpenDrawer')?.click(); } catch(e){}
      await new Promise(r=>setTimeout(r,150));
      await ev(`document.querySelector('[data-drawer-action="${a}"]').click()`);
      await new Promise(r=>setTimeout(r,250));
      const st = await ev(`(()=>({tab:document.body.dataset.tab,navActive:document.querySelector('.mobile-bottom-nav')?.dataset.active}))()`);
      const expectedTab = {overview:'caixa',dash:'dash',pockets:'pockets',investments:'invest',profile:'profile'}[a];
      record('V4-'+a,'Ação '+a+' do drawer preservada','tab='+expectedTab,JSON.stringify(st),st.tab===expectedTab?'PASS':'FAIL');
    }

    // V5: sem erros de console relacionados
    const navErrors = consoleErrors.filter(e=>/nav|tab|switch|drawer|indicator|destination/i.test(e));
    record('V5','Sem erros de console relacionados à navegação','0',navErrors.length+(navErrors.length?': '+navErrors.join(' | '):''),navErrors.length===0?'PASS':'FAIL');

    const pass=checks.filter(c=>c.status==='PASS').length, fail=checks.filter(c=>c.status==='FAIL').length;
    console.log('\n=== D-02 VALIDAÇÃO FUNCIONAL ===');
    for(const c of checks) console.log(`[${c.status}] ${c.id}: ${c.desc} | obs: ${c.observed}`);
    console.log(`\nRESUMO: ${pass} PASS / ${fail} FAIL / ${checks.length} TOTAL`);
    console.log('Console errors (total):',consoleErrors.length);
    fs.writeFileSync(path.join(PROJECT_ROOT,'tmp-c13/d02-validacao-resultados.json'),JSON.stringify({
      meta:{task:'D-02',url:APP_URL,timestamp:new Date().toISOString(),browser:'Chromium 156 headless CDP',method:'Methodologia CDP Navigation (externos bloqueados + stub Firebase)'},
      summary:{total:checks.length,pass,fail},checks,consoleErrors,
      note:' Firebase real não inicializa; validação cobre mecanismo de navegação e drawer.'
    },null,2));
  } catch(e){ console.error('FATAL:',e.message); }
  finally { if(client){try{client._ws.close()}catch(e){}} }
}
main();
