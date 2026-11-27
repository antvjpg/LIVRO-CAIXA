import CDP from '/data/data/com.termux/files/home/LIVRO-CAIXA/node_modules/chrome-remote-interface/index.js';
import fs from 'fs';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const ROOT='/data/data/com.termux/files/home/LIVRO-CAIXA';
const OUT=`${ROOT}/tmp-c13/c6-9`;
const targets=await CDP.List({port:9222}); const page=targets.find(t=>t.type==='page'&&t.url.includes('index.html'));
const c=await CDP({target:page}); const {Page,Runtime,Emulation,Input,Log,Network}=c;
await Page.enable(); await Runtime.enable(); await Log.enable(); await Network.enable(); await Network.setCacheDisabled({cacheDisabled:true});
const errors=[];
Runtime.exceptionThrown(({exceptionDetails})=>errors.push({type:'exception',text:exceptionDetails.text,detail:exceptionDetails.exception?.description||''}));
Log.entryAdded(({entry})=>{ if(entry.level==='error') errors.push({type:'log',text:entry.text}); });
const ev=async(e)=>{const {result,exceptionDetails}=await Runtime.evaluate({expression:e,returnByValue:true,awaitPromise:true});if(exceptionDetails)throw new Error(exceptionDetails.text+' | '+JSON.stringify(exceptionDetails.exception?.description||''));return result.value;};
const key=async(k,code,vk,text,modifiers=0)=>{await Input.dispatchKeyEvent({type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,text,modifiers});await Input.dispatchKeyEvent({type:'keyUp',key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers});};
const snapExpr=`(()=>{const ctrl=document.querySelector('main > .inicio-patrimony-evolution .balance-symbol');const box=document.getElementById('patrimonySparkBoxInicio');const canvas=document.getElementById('patrimonySparklineInicio');const data=document.getElementById('inicioEvolutionData');const empty=document.getElementById('inicioPatrimonyEvolutionEmpty');const sel=document.getElementById('inicioPeriodSelect');const active=document.activeElement;const stripSymbol=document.querySelector('#balanceStrip .balance-card.total .balance-symbol');const chartCanvas=document.getElementById('patrimonySparkline');const cs=ctrl?getComputedStyle(ctrl):null;return{active:{tag:active?.tagName||'',id:active?.id||'',cls:active?.className||'',text:(active?.textContent||'').trim().slice(0,40)},focus:{outline:cs?.outline||'',outlineColor:cs?.outlineColor||'',outlineWidth:cs?.outlineWidth||'',boxShadow:cs?.boxShadow||''},ctrl:{expanded:ctrl?.getAttribute('aria-expanded')||'',label:ctrl?.getAttribute('aria-label')||'',role:ctrl?.getAttribute('role')||'',tabindex:ctrl?.getAttribute('tabindex')||''},box:{ariaHidden:box?.getAttribute('aria-hidden')||'',collapsed:!!box?.classList.contains('is-collapsed'),emptyClass:!!box?.classList.contains('is-empty'),display:box?getComputedStyle(box).display:''},canvas:{label:canvas?.getAttribute('aria-label')||'',describedBy:canvas?.getAttribute('aria-describedby')||'',points:canvas&&window.Chart?.getChart(canvas)?.data?.labels?.length||0},dataText:data?.textContent||'',dataEntries:(data?.textContent||'').split(';').filter(Boolean).map(s=>s.trim()),empty:{hidden:!!empty?.hidden,text:(empty?.textContent||'').trim(),role:empty?.getAttribute('role')||'',live:empty?.getAttribute('aria-live')||''},select:{value:sel?.value||'',label:sel?.getAttribute('aria-label')||''},pref:localStorage.getItem('livro-caixa-patrimony-spark'),periodPref:localStorage.getItem('livrocaixa_dashboard_filters_v1'),scrollY:window.scrollY,toggleCount:window.__c9ToggleCount||0,strip:{symbolExpanded:stripSymbol?.getAttribute('aria-expanded')||'',symbolLabel:stripSymbol?.getAttribute('aria-label')||'',chart:!!chartCanvas&&!!window.Chart?.getChart(chartCanvas)},inicioChart:!!canvas&&!!window.Chart?.getChart(canvas),tab:document.body.dataset.tab||''};})()`;
const snap=()=>ev(snapExpr);
await Emulation.setDeviceMetricsOverride({width:390,height:844,deviceScaleFactor:1,mobile:true});
await Page.navigate({url:`http://127.0.0.1:8000/index.html?c609=${Date.now()}`}); await Page.loadEventFired(); await sleep(2500);
await ev(`(()=>{document.getElementById('authOverlay')?.classList.add('hidden');document.querySelector('.light-theme-option[data-theme="1"]')?.click();currentUser={uid:'c9_test'};firstLoadDone=true;window.switchTab('inicio');localStorage.setItem('livro-caixa-patrimony-spark','1');patrimonySparkVisible=true;banks=[{id:'b_test',name:'CODE_TEST_BANK',initial:1000}];pockets=[];investments=[];entries=[];categories=[{id:'cat_test',name:'CODE_TEST_CAT'}];renderPatrimonySparkline(true,'inicio');window.__c9ToggleCount=0;const orig=togglePatrimonySparkline;togglePatrimonySparkline=(...args)=>{window.__c9ToggleCount++;return orig(...args)};return true;})()`); await sleep(400);
const out={initial:await snap(),focus:[],C09_01:{},C09_02:{},C09_03:{},C09_04:{},C09_05:[],C09_06:{},C09_07:{},errors:[]};

for (let i=0;i<40;i++) {
  await key('Tab','Tab',9);
  const s=await snap();
  out.focus.push({i:i+1,active:s.active});
  if (s.active.cls && String(s.active.cls).includes('balance-symbol') && s.active.tag==='SPAN') {
    out.C09_01.control={reachedAt:i+1,focus:s.focus,active:s.active}; break;
  }
}
for (let i=0;i<12;i++) {
  await key('Tab','Tab',9);
  const s=await snap();
  out.focus.push({i:'select+'+(i+1),active:s.active});
  if (s.active.id==='inicioPeriodSelect') { out.C09_01.select={reachedAfterControl:i+1,active:s.active}; break; }
}
await key('Tab','Tab',9);
out.C09_01.notTrapped=(await snap()).active;
await key('Tab','Tab',9,'',8); await key('Tab','Tab',9,'',8);
out.C09_01.refocusedControl=(await snap()).active;

out.C09_02.before=await snap();
await key('Enter','Enter',13,'\r'); await sleep(450);
out.C09_02.afterEnter1=await snap();
await key('Enter','Enter',13,'\r'); await sleep(450);
out.C09_02.afterEnter2=await snap();

await ev(`window.__c9ToggleCount=0`);
out.C09_03.before=await snap();
await key(' ','Space',32,' '); await sleep(450);
out.C09_03.afterSpace1=await snap();
await key(' ','Space',32,' '); await sleep(450);
out.C09_03.afterSpace2=await snap();

await ev(`window.switchTab('caixa')`); await sleep(400); out.C09_04.caixa=await snap();
await ev(`window.switchTab('inicio')`); await sleep(400); out.C09_04.inicio=await snap();

for (let i=0;i<40;i++) {
  await key('Tab','Tab',9);
  if ((await snap()).active.id==='inicioPeriodSelect') break;
}
for (const k of [['ArrowUp','ArrowUp',38],['ArrowDown','ArrowDown',40],['ArrowUp','ArrowUp',38]]) {
  await key(k[0],k[1],k[2]); await sleep(400); out.C09_05.push(await snap());
}

await ev(`(()=>{banks=[];pockets=[];investments=[];entries=[];renderPatrimonySparkline(true,'inicio');return true})()`); await sleep(400);
out.C09_06.noHistory=await snap();
await ev(`(()=>{banks=[{id:'b_test',name:'CODE_TEST_BANK',initial:1000}];renderPatrimonySparkline(true,'inicio');return true})()`); await sleep(400);
out.C09_06.restored=await snap();

await ev(`window.__c9ToggleCount=0`);
for(let i=0;i<3;i++){await key('Enter','Enter',13,'\r');await sleep(400);await key(' ','Space',32,' ');await sleep(400);}
out.C09_07.afterRepeats=await snap();
out.errors=errors;
fs.writeFileSync(`${OUT}/c9-resultados.json`,JSON.stringify(out,null,2));
console.log(JSON.stringify({focus:out.C09_01,enter:[out.C09_02.before,out.C09_02.afterEnter1,out.C09_02.afterEnter2].map(s=>({expanded:s.ctrl.expanded,label:s.ctrl.label,hidden:s.box.ariaHidden,collapsed:s.box.collapsed,chart:s.inicioChart,count:s.toggleCount})),space:[out.C09_03.before,out.C09_03.afterSpace1,out.C09_03.afterSpace2].map(s=>({expanded:s.ctrl.expanded,scrollY:s.scrollY,count:s.toggleCount})),periods:out.C09_05.map(s=>({value:s.select.value,points:s.canvas.points,label:s.canvas.label,entries:s.dataEntries.length})),empty:{no:{hidden:out.C09_06.noHistory.empty.hidden,chart:out.C09_06.noHistory.inicioChart,data:out.C09_06.noHistory.dataText},restored:{hidden:out.C09_06.restored.empty.hidden,chart:out.C09_06.restored.inicioChart,data:out.C09_06.restored.dataText}},errors:errors.length},null,2));
await c.close();
