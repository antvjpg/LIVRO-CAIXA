// D-03 — Validação funcional real: Próximo Pagamento em Início
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
    for (let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,300)); try{ ready = await ev(`typeof window.switchTab==='function' && !!document.querySelector('#viewInicio .next-pay-inner')`); }catch(e){} if(ready)break; }
    if (!ready) throw new Error('App não inicializou (switchTab / host Início ausentes)');
    await new Promise(r=>setTimeout(r,500));

    // Dispara renderAdvancedDashboard via switchTab('inicio') — o caminho real
    await ev(`window.switchTab('inicio')`);
    await new Promise(r=>setTimeout(r,600));

    const v1 = await ev(`(()=>{
      const inicio = document.querySelector('#viewInicio .next-pay-inner');
      const legacy = document.getElementById('dashboardNextPayment');
      return {
        inicioText: inicio ? inicio.textContent.replace(/\\s+/g,' ').trim() : null,
        inicioHasKicker: !!inicio?.querySelector('.next-pay-kicker'),
        inicioHasRowOrEmpty: !!(inicio?.querySelector('.next-pay-row') || inicio?.classList.contains('empty')),
        legacyText: legacy ? legacy.textContent.replace(/\\s+/g,' ').trim() : null,
        legacyHasInner: !!legacy?.querySelector('.next-pay-inner')
      };
    })()`);
    record('V1','Host Início .next-pay-inner recebe conteúdo do renderizador','kicker=true, linha ou empty=true',JSON.stringify({inicioText:v1.inicioText,inicioHasKicker:v1.inicioHasKicker,inicioHasRowOrEmpty:v1.inicioHasRowOrEmpty}),
      v1.inicioHasKicker && v1.inicioHasRowOrEmpty ? 'PASS':'FAIL');
    record('V2','Dashboard legado continua exibindo o cartão (sem regressão)','legacyHasInner=true, kicker/texto presente',JSON.stringify({legacyText:v1.legacyText,legacyHasInner:v1.legacyHasInner}),
      v1.legacyHasInner && /Próximo pagamento/i.test(v1.legacyText||'') ? 'PASS':'FAIL');
    record('V3','Mesmo conteúdo nos dois hosts (reutilização do cálculo)','textos iguais',JSON.stringify({inicio:v1.inicioText,legacy:v1.legacyText}),
      v1.inicioText === v1.legacyText ? 'PASS':'FAIL');

    // V4: sem IDs duplicados
    const v4 = await ev(`(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);return {total:ids.length,duplicates:[...new Set(dup)]}})()`);
    record('V4','Nenhum ID duplicado introduzido','0 duplicatas',JSON.stringify(v4),v4.duplicates.length===0?'PASS':'FAIL');

    // V5: atualização após troca de view (dashboard -> inicio -> dashboard)
    await ev(`window.switchTab('dashboard')`);
    await new Promise(r=>setTimeout(r,300));
    await ev(`window.switchTab('inicio')`);
    await new Promise(r=>setTimeout(r,400));
    const v5 = await ev(`(()=>{const i=document.querySelector('#viewInicio .next-pay-inner');const l=document.getElementById('dashboardNextPayment');return {inicioFilled:!!i?.querySelector('.next-pay-kicker'),legacyFilled:!!l?.querySelector('.next-pay-kicker'),equal:i?.textContent.replace(/\\s+/g,' ').trim()===l?.textContent.replace(/\\s+/g,' ').trim()}})()`);
    record('V5','Persiste após múltiplas trocas de view','inicioFilled=true, legacyFilled=true, equal=true',JSON.stringify(v5),
      v5.inicioFilled && v5.legacyFilled && v5.equal ? 'PASS':'FAIL');

    const navErrors = consoleErrors.filter(e=>/renderAdvanced|next.pay|dashboard|switch|inner|syntax/i.test(e));
    record('V6','Sem erros de console relacionados ao cartão/navegação','0',navErrors.length+(navErrors.length?': '+navErrors.join(' | '):''),navErrors.length===0?'PASS':'FAIL');

    const pass=checks.filter(c=>c.status==='PASS').length, fail=checks.filter(c=>c.status==='FAIL').length;
    console.log('\n=== D-03 VALIDAÇÃO FUNCIONAL ===');
    for(const c of checks) console.log(`[${c.status}] ${c.id}: ${c.desc} | obs: ${c.observed}`);
    console.log(`\nRESUMO: ${pass} PASS / ${fail} FAIL / ${checks.length} TOTAL`);
    console.log('Console errors (total):',consoleErrors.length);
    fs.writeFileSync(path.join(PROJECT_ROOT,'tmp-c13/d03-validacao-resultados.json'),JSON.stringify({
      meta:{task:'D-03',url:APP_URL,timestamp:new Date().toISOString(),browser:'Chromium 156 headless CDP',method:'Metodologia CDP Navigation'},
      summary:{total:checks.length,pass,fail},checks,consoleErrors,
      note:'Firebase real não inicializa. Sem dados financeiros, o renderizador produz o estado "Nenhum pagamento pendente" de forma determinística; a validação cobre reutilização do cálculo e ausência de regressão.'
    },null,2));
  } catch(e){ console.error('FATAL:',e.message); }
  finally { if(client){try{client._ws.close()}catch(e){}} }
}
main();
