// D-04 — Validação funcional real: Resumo do Fluxo em Início
// Metodologia: docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md
// Dados: Opção A (sintéticos determinísticos) — ver seção 5.1 da metodologia
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
    for (let i=0;i<60;i++){ await new Promise(r=>setTimeout(r,400)); try{ ready = await ev(`typeof window.switchTab==='function' && !!document.querySelector('#viewInicio .cashflow-mini-summary')`); }catch(e){} if(ready)break; }
    if (!ready) {
      const diag = await ev(`JSON.stringify({readyState:document.readyState,hasSwitch:typeof window.switchTab,nav:!!document.querySelector('.mobile-bottom-nav'),inicioMini:!!document.querySelector('#viewInicio .cashflow-mini-summary'),viewInicio:!!document.getElementById('viewInicio'),bodyLen:document.body?document.body.innerHTML.length:-1})`).catch(e=>'ev erro: '+e.message);
      throw new Error('App não inicializou | diag: '+diag);
    }
    await new Promise(r=>setTimeout(r,500));

    // === OPÇÃO A: injetar dados sintéticos determinísticos ===
    const month = await ev(`currentMonthYM()`);
    const injected = await ev(`(function(){
      var m = currentMonthYM();
      var synthetic = [
        { id:'qa-d04-in-1', type:'in',  amount:1000, date:m+'-05', desc:'Entrada QA sintética' },
        { id:'qa-d04-in-2', type:'in',  amount:500,  date:m+'-08', desc:'Entrada QA sintética 2' },
        { id:'qa-d04-out-1',type:'out', amount:300,  date:m+'-10', desc:'Saída QA sintética' }
      ];
      entries = synthetic;
      window.__C4_SYNTHETIC_DATA__ = { month:m, entradas:1500, saidas:300, saldo:1200 };
      return window.__C4_SYNTHETIC_DATA__;
    })()`);

    // Dispara o renderizador real
    await ev(`renderAdvancedDashboard()`);
    await new Promise(r=>setTimeout(r,400));

    const v1 = await ev(`(()=>{
      const inicio = document.querySelector('#viewInicio .cashflow-mini-summary');
      const caixa = document.getElementById('cashflowMiniSummary');
      const metrics = inicio ? Array.from(inicio.querySelectorAll('.cashflow-mini-metrics strong')).map(e=>e.textContent.trim()) : [];
      return {
        inicioFilled: !!(inicio && inicio.querySelector('.cashflow-mini-head')),
        inicioMetrics: metrics,
        caixaFilled: !!(caixa && caixa.querySelector('.cashflow-mini-head')),
        caixaMetrics: caixa ? Array.from(caixa.querySelectorAll('.cashflow-mini-metrics strong')).map(e=>e.textContent.trim()) : [],
        inicioText: inicio ? inicio.textContent.replace(/\\s+/g,' ').trim() : null,
        caixaText: caixa ? caixa.textContent.replace(/\\s+/g,' ').trim() : null
      };
    })()`);
    record('V1','Host Início recebe o resumo do renderizador real','inicioFilled=true',String(v1.inicioFilled),v1.inicioFilled?'PASS':'FAIL');
    record('V2','Livro-Caixa (legado) continua exibindo o resumo','caixaFilled=true',String(v1.caixaFilled),v1.caixaFilled?'PASS':'FAIL');
    record('V3','Mesmo conteúdo nos dois hosts (reutilização do cálculo)','textos iguais',JSON.stringify({inicio:v1.inicioText,caixa:v1.caixaText}),
      v1.inicioText===v1.caixaText?'PASS':'FAIL');

    // V4: os valores refletem os dados sintéticos injetados (comprova que o cálculo real rodou)
    const fmtCheck = await ev(`(()=>{
      var inicio = document.querySelector('#viewInicio .cashflow-mini-summary');
      var txt = inicio ? inicio.textContent : '';
      return { hasEntradas:/Entradas/.test(txt), hasSaidas:/Saídas/.test(txt), hasSaldo:/Saldo do mês/.test(txt), raw:txt.replace(/\\s+/g,' ').trim() };
    })()`);
    record('V4','Resumo contém Entradas/Saídas/Saldo do cálculo real','todos os rótulos=true',JSON.stringify(fmtCheck),
      fmtCheck.hasEntradas && fmtCheck.hasSaidas && fmtCheck.hasSaldo ? 'PASS':'FAIL');

    // V5: consistência com os dados injetados (valores esperados formatados)
    const expected = await ev(`(()=>({e:fmt(1500),s:fmt(300),n:fmt(1200)}))()`);
    const v5 = await ev(`(()=>{
      var inicio = document.querySelector('#viewInicio .cashflow-mini-summary');
      var m = Array.from(inicio.querySelectorAll('.cashflow-mini-metrics strong')).map(e=>e.textContent.trim());
      return m;
    })()`);
    record('V5','Valores do resumo correspondem aos dados sintéticos',JSON.stringify(expected),JSON.stringify(v5),
      v5.length===3 && v5[0]===expected.e && v5[1]===expected.s && v5[2]===expected.n ? 'PASS':'FAIL');

    // V6: sem IDs duplicados
    const v6 = await ev(`(()=>{const ids=Array.from(document.querySelectorAll('[id]')).map(e=>e.id);const dup=ids.filter((x,i)=>ids.indexOf(x)!==i);return {total:ids.length,duplicates:[...new Set(dup)]}})()`);
    record('V6','Nenhum ID duplicado introduzido','0 duplicatas',JSON.stringify(v6),v6.duplicates.length===0?'PASS':'FAIL');

    // V7: persiste após troca de view
    await ev(`window.switchTab('caixa')`); await new Promise(r=>setTimeout(r,200));
    await ev(`window.switchTab('inicio')`); await new Promise(r=>setTimeout(r,300));
    const v7 = await ev(`(()=>{const i=document.querySelector('#viewInicio .cashflow-mini-summary');const c=document.getElementById('cashflowMiniSummary');return {inicioFilled:!!i?.querySelector('.cashflow-mini-metrics'),caixaFilled:!!c?.querySelector('.cashflow-mini-metrics'),equal:i?.textContent.replace(/\\s+/g,' ').trim()===c?.textContent.replace(/\\s+/g,' ').trim()}})()`);
    record('V7','Persiste após múltiplas trocas de view','todos true',JSON.stringify(v7),v7.inicioFilled&&v7.caixaFilled&&v7.equal?'PASS':'FAIL');

    const navErrors = consoleErrors.filter(e=>/renderAdvanced|cashflow|mini|resumo|switch|syntax/i.test(e));
    record('V8','Sem erros de console relacionados ao resumo/navegação','0',navErrors.length+(navErrors.length?': '+navErrors.join(' | '):''),navErrors.length===0?'PASS':'FAIL');

    const pass=checks.filter(c=>c.status==='PASS').length, fail=checks.filter(c=>c.status==='FAIL').length;
    console.log('\n=== D-04 VALIDAÇÃO FUNCIONAL (dados sintéticos - Opção A) ===');
    for(const c of checks) console.log(`[${c.status}] ${c.id}: ${c.desc} | obs: ${c.observed}`);
    console.log(`\nRESUMO: ${pass} PASS / ${fail} FAIL / ${checks.length} TOTAL`);
    console.log('Console errors (total):',consoleErrors.length);
    fs.writeFileSync(path.join(PROJECT_ROOT,'tmp-c13/d04-validacao-resultados.json'),JSON.stringify({
      meta:{task:'D-04',url:APP_URL,timestamp:new Date().toISOString(),browser:'Chromium 156 headless CDP',method:'Metodologia CDP Navigation',dados:'sintéticos determinísticos (Opção A, seção 5.1)',injetado:injected},
      summary:{total:checks.length,pass,fail},checks,consoleErrors,
      note:'Renderizador real renderAdvancedDashboard() executado com entries sintéticas. Firebase real não inicializa; sincronização fora de escopo.'
    },null,2));
  } catch(e){ console.error('FATAL:',e.message); }
  finally { if(client){try{client._ws.close()}catch(e){}} }
}
main();
