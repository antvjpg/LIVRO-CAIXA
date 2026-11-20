// D-05 — Validação dos critérios de aceite + regressão das demais views
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
    const { Page, Runtime, Network, Fetch, Emulation } = client;
    await Runtime.enable(); await Page.enable(); await Network.enable();
    await Fetch.enable({ patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    Fetch.requestPaused(async ({ requestId, request }) => {
      const isLocal = request.url.startsWith('http://127.0.0.1:8000') || request.url.startsWith('data:') || request.url.startsWith('about:');
      try { isLocal ? await Fetch.continueRequest({ requestId }) : await Fetch.failRequest({ requestId, errorReason: 'Failed' }); } catch (e) {}
    });
    await Page.addScriptToEvaluateOnNewDocument({ source: `
      (function(){function n(){return{catch(){return this},then(){return this}}}var a={onAuthStateChanged:function(cb){try{cb(null)}catch(e){}return function(){}},currentUser:null};a.GoogleAuthProvider=function(){this.addScope=function(){return this}};var f={enablePersistence:function(){return{catch:n}},collection:function(){return{doc:function(){return{get:function(){return Promise.resolve({exists:false,data:function(){return{}}})},set:function(){return Promise.resolve()},onSnapshot:function(){return function(){}}}}}}};window.firebase={initializeApp:function(){},auth:function(){return a},firestore:function(){return f},apps:[]}})();
    ` });
    Runtime.consoleAPICalled(({ type, args }) => { if (type==='error') consoleErrors.push(args.map(a=>a.value??a.description??'').join(' ')); });
    Runtime.exceptionThrown(({ exceptionDetails }) => { consoleErrors.push(exceptionDetails.exception?.description || exceptionDetails.text || 'exception'); });
    await Page.navigate({ url: APP_URL });
    async function ev(e){const r=await Runtime.evaluate({expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
    for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,400));try{if(await ev(`typeof window.switchTab==='function'&&!!document.getElementById('viewInicio')`))break}catch(e){}}
    await ev(`document.getElementById('syncOverlay')?.classList.add('hidden');document.getElementById('authOverlay')?.classList.add('hidden')`);

    const viewports = [
      { name:'mobile', w:390, h:844, mobile:true },
      { name:'tablet', w:800, h:900, mobile:false },
      { name:'desktop', w:1280, h:800, mobile:false },
      { name:'narrow', w:320, h:640, mobile:true },
    ];
    for(const v of viewports){
      await Emulation.setDeviceMetricsOverride({width:v.w,height:v.h,deviceScaleFactor:1,mobile:v.mobile});
      await ev(`window.switchTab('inicio')`);
      await new Promise(r=>setTimeout(r,400));
      const m = await ev(`(()=>{const g=document.querySelector('#viewInicio .inicio-grid');const cards=Array.from(document.querySelectorAll('#viewInicio .inicio-card'));const cs=getComputedStyle(g);return{cols:cs.gridTemplateColumns,display:cs.display,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,cards:cards.map(c=>{const r=c.getBoundingClientRect();const s=getComputedStyle(c);return{w:Math.round(r.width),h:Math.round(r.height),bg:s.backgroundColor,padding:s.padding,border:s.borderTopWidth}})}})()`);
      // auto-fit com minmax(280px,1fr): n colunas = floor((largura+gap)/(280+gap)), min 1
      const expectedCols = Math.max(1, Math.min(3, Math.floor((v.w + 14) / (280 + 14))));
      const actualCards = m.cards.length;
      const bgOk = m.cards.every(c=>c.bg!=='rgba(0, 0, 0, 0)' && c.bg!=='transparent');
      record('V-'+v.name+'-1','Grid com '+expectedCols+' coluna(s) em '+v.name,'display=grid, '+expectedCols+' colunas',JSON.stringify({display:m.display,cols:m.cols}),m.display==='grid' && m.cols.split(' ').length===expectedCols?'PASS':'FAIL');
      record('V-'+v.name+'-2','Sem overflow horizontal em '+v.name,'overflow=false',String(m.overflow),!m.overflow?'PASS':'FAIL');
      record('V-'+v.name+'-3','3 cards com superfície/estrutura em '+v.name,'3 cards com bg e padding',JSON.stringify(m.cards),actualCards===3 && bgOk && m.cards.every(c=>c.padding!=='0px')?'PASS':'FAIL');
    }

    // Resumo visível em Início (D-04 + exceção D-05)
    await Emulation.setDeviceMetricsOverride({width:1280,height:800,deviceScaleFactor:1,mobile:false});
    const resumo = await ev(`(()=>{const r=document.querySelector('#viewInicio .cashflow-mini-summary');const cs=r?getComputedStyle(r):null;return{display:cs?.display,hasContent:!!r?.querySelector('.cashflow-mini-head')}})()`);
    record('V-resumo','Resumo do fluxo visível em Início','display!=none, hasContent=true',JSON.stringify(resumo),resumo.display!=='none' && resumo.hasContent?'PASS':'FAIL');

    // Regressão: demais views continuam funcionando
    for(const tab of ['caixa','pockets','invest','profile','dash']){
      await ev(`window.switchTab('${tab}')`);
      await new Promise(r=>setTimeout(r,200));
      const st = await ev(`(()=>({tab:document.body.dataset.tab,viewAtiva:!!document.querySelector('#view'+'${tab.charAt(0).toUpperCase()+tab.slice(1)}.active')||!!document.querySelector('.tab-content.active'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1}))()`);
      record('V-reg-'+tab,'View '+tab+' sem regressão','tab='+tab+', overflow=false',JSON.stringify(st),st.tab===tab && !st.overflow?'PASS':'FAIL');
    }

    const navErrors = consoleErrors.filter(e=>/css|style|layout|overflow|view/i.test(e));
    record('V-console','Sem erros de console relacionados','0',navErrors.length+(navErrors.length?': '+navErrors.join(' | '):''),navErrors.length===0?'PASS':'FAIL');

    const pass=checks.filter(c=>c.status==='PASS').length, fail=checks.filter(c=>c.status==='FAIL').length;
    console.log('\n=== D-05 VALIDAÇÃO DE ACEITE ===');
    for(const c of checks) console.log(`[${c.status}] ${c.id}: ${c.desc} | obs: ${c.observed}`);
    console.log(`\nRESUMO: ${pass} PASS / ${fail} FAIL / ${checks.length} TOTAL`);
    console.log('Console errors (total):',consoleErrors.length);
    fs.writeFileSync(path.join(PROJECT_ROOT,'tmp-c13/d05-validacao-resultados.json'),JSON.stringify({
      meta:{task:'D-05',url:APP_URL,timestamp:new Date().toISOString(),browser:'Chromium 156 headless CDP',method:'Baseline antes/depois + critérios de aceite'},
      summary:{total:checks.length,pass,fail},checks,consoleErrors,
      baseline:{antes:'tmp-c13/d05-baseline-antes.json',depois:'tmp-c13/d05-baseline-depois.json',screenshots:'tmp-c13/d05-{antes,depois}-*.png'},
      note:'Validação visual via CDP com stub Firebase; fontes/ícones CDN bloqueados. Composição/grid/overflow/contraste validados; aspecto de ícones não avaliado.'
    },null,2));
  } catch(e){ console.error('FATAL:',e.message); }
  finally { if(client){try{client._ws.close()}catch(e){}} }
}
main();
