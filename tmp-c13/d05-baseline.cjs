// D-05 — Baseline visual e estrutural da view Início (ANTES/DEPOIS do CSS)
// Uso: node d05-baseline.cjs <antes|depois>
// Metodologia: docs/padroes/METODOLOGIA-VALIDACAO-NAVEGACAO-CDP.md
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');
const PHASE = process.argv[2] || 'antes';
const PROJECT_ROOT = '/data/data/com.termux/files/home/LIVRO-CAIXA';
const APP_URL = 'http://127.0.0.1:8000/index.html';

async function main() {
  let client;
  const scenarios = [
    { name: 'mobile-claro', w: 390, h: 844, mobile: true, dark: false },
    { name: 'mobile-escuro', w: 390, h: 844, mobile: true, dark: true },
    { name: 'desktop-claro', w: 1280, h: 800, mobile: false, dark: false },
    { name: 'desktop-escuro', w: 1280, h: 800, mobile: false, dark: true },
  ];
  const out = { meta: { task: 'D-05', phase: PHASE, timestamp: new Date().toISOString(), app: APP_URL }, cenarios: [] };
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
      (function(){
        function noop(){ return { catch(){return this;}, then(){return this;} }; }
        var a={onAuthStateChanged:function(cb){try{cb(null)}catch(e){}return function(){}},currentUser:null,signOut:function(){return Promise.resolve()}};
        a.GoogleAuthProvider=function(){this.addScope=function(){return this}};
        var f={enablePersistence:function(){return {catch:noop}},collection:function(){return {doc:function(){return {get:function(){return Promise.resolve({exists:false,data:function(){return{}}})},set:function(){return Promise.resolve()},onSnapshot:function(){return function(){}}}}}}};
        window.firebase={initializeApp:function(){},auth:function(){return a},firestore:function(){return f},apps:[]};
      })();
    ` });
    await Page.navigate({ url: APP_URL });
    async function ev(expression) {
      const r = await Runtime.evaluate({ expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    }
    let ready = false;
    for (let i=0;i<60;i++){ await new Promise(r=>setTimeout(r,400)); try{ ready = await ev(`typeof window.switchTab==='function' && !!document.getElementById('viewInicio')`); }catch(e){} if(ready)break; }
    if (!ready) throw new Error('App não inicializou');

    for (const c of scenarios) {
      await Emulation.setDeviceMetricsOverride({ width: c.w, height: c.h, deviceScaleFactor: 1, mobile: c.mobile });
      await ev(`document.body.classList.toggle('dark-mode', ${c.dark})`);
      await ev(`window.switchTab('inicio')`);
      // O stub do Firebase nao completa o boot: oculta overlays de teste para expor a view
      await ev(`document.getElementById('syncOverlay')?.classList.add('hidden'); document.getElementById('authOverlay')?.classList.add('hidden'); window.initialisationComplete = true; document.body.classList.remove('is-data-loading');`);
      await new Promise(r=>setTimeout(r,600));
      const metrics = await ev(`(()=>{
        const v = document.getElementById('viewInicio');
        const grid = v.querySelector('.inicio-grid');
        const header = v.querySelector('.inicio-header');
        const footer = v.querySelector('.inicio-footer');
        const cards = Array.from(v.querySelectorAll('.inicio-card'));
        const rect = el => { if(!el) return null; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),display:cs.display,position:cs.position}; };
        const cs = el => el ? { display:getComputedStyle(el).display, gridTemplateColumns:getComputedStyle(el).gridTemplateColumns, gap:getComputedStyle(el).gap, padding:getComputedStyle(el).padding, margin:getComputedStyle(el).margin } : null;
        return {
          viewport: { w: innerWidth, h: innerHeight },
          docScrollWidth: document.documentElement.scrollWidth,
          docClientWidth: document.documentElement.clientWidth,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          view: rect(v),
          header: { rect: rect(header), css: cs(header) },
          grid: { rect: rect(grid), css: cs(grid), children: grid ? grid.children.length : 0 },
          cards: cards.map(x=>({ cls:x.className, rect:rect(x), css:cs(x) })),
          footer: { rect: rect(footer), css: cs(footer) },
          tokens: { accent:getComputedStyle(document.body).getPropertyValue('--accent').trim(), surface:getComputedStyle(document.body).getPropertyValue('--surface').trim(), paper:getComputedStyle(document.body).getPropertyValue('--paper').trim() }
        };
      })()`);
      const shot = await Page.captureScreenshot({ format: 'png', captureBeyondViewport: false });
      const imgPath = path.join(PROJECT_ROOT, `tmp-c13/d05-${PHASE}-${c.name}.png`);
      fs.writeFileSync(imgPath, Buffer.from(shot.data, 'base64'));
      out.cenarios.push({ nome: c.name, viewport: c.viewport, metricas: metrics, screenshot: path.relative(PROJECT_ROOT, imgPath) });
      console.log(`[${c.name}] overflow=${metrics.horizontalOverflow} grid=${metrics.grid.css?.gridTemplateColumns} cards=${metrics.cards.length}`);
    }
    fs.writeFileSync(path.join(PROJECT_ROOT, `tmp-c13/d05-baseline-${PHASE}.json`), JSON.stringify(out, null, 2));
    console.log('\nSalvo:', `tmp-c13/d05-baseline-${PHASE}.json`);
  } catch (e) { console.error('FATAL:', e.message); }
  finally { if (client) { try { client._ws.close(); } catch (e) {} } }
}
main();
