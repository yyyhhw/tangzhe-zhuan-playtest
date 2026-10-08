// 打僵尸无尽 TOP10 手机宽度：原型页 + 嵌入经营页，真打死后上榜 / 未上榜 / 老档（Chromium 手机视口，不是真机）
// PLAYWRIGHT_MODULE=… ZB_TEST_BASE=http://127.0.0.1:8765 ZB_TEST_OUTPUT=/tmp/zbtop node zombie/test_zbtop_layout.mjs
import {createRequire} from 'node:module';import fs from 'node:fs';const require=createRequire(import.meta.url);
const E=require(new URL('../economy.js',import.meta.url).pathname);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const OUT=process.env.ZB_TEST_OUTPUT||'/tmp/zbtop';fs.mkdirSync(OUT,{recursive:true});
const b=await chromium.launch(),B=process.env.ZB_TEST_BASE||'http://127.0.0.1:8765',R=[];let bad=0;
const top=n=>Array.from({length:n},(_,i)=>({t:(i+1)*100,kills:i+1,id:'old'+i,at:i}));
for(const [w,h] of [[320,568],[375,667],[393,852]]){
 // 原型页
 for(const [label,seedTop,t] of [['proto-上榜',top(10),550],['proto-未上榜',top(10),50],['proto-老档',null,40]]){
  const c=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
  await c.addInitScript(([st])=>{if(!localStorage.getItem('seed')){localStorage.setItem('tangzhe-zombie-proto',JSON.stringify(st));localStorage.setItem('tangzhe-save','SENT');localStorage.setItem('seed','1')}},[{cleared:50,endBest:{t:seedTop?1000:300,kills:9},...(seedTop?{endTop:seedTop}:{}),lv:{atk:0,rate:0,hp:0,ult:0},coins:5e10}]);
  await p.goto(B+'/zombie/');await p.waitForFunction(()=>window.__zb);
  await p.click('#endlessBtn');await p.evaluate(t=>{__zb.G.t=t;__zb.G.p.inv=0;},t);
  await p.evaluate(()=>{const g=__zb.G,pp=g.p;g.zs=[{type:'walker',x:pp.x,y:pp.y,r:20,hp:1e9,maxHp:1e9,sp:0,dmg:1e6,col:'#000',flash:0,kx:0,ky:0,slow:0,burn:0,wob:0}];for(let i=0;i<20&&!g.over;i++)__zb.step(0.05)});
  await p.waitForFunction(()=>__zb.G.over&&!__zb.G.wait,null,{timeout:5000});
  const r=await p.evaluate(()=>({over:__zb.G?.over,res:!document.querySelector('#result').classList.contains('hidden'),title:document.querySelector('#resTitle').textContent,rows:document.querySelectorAll('#resBoard .board li').length,me:document.querySelector('#resBoard li.me b')?.textContent||'',extra:document.querySelector('#resBoard .board-me')?.textContent||'',saved:JSON.parse(localStorage.getItem('tangzhe-zombie-proto-top')).length,formal:localStorage.getItem('tangzhe-save'),ov:document.documentElement.scrollWidth>innerWidth,fit:(()=>{const c=document.querySelector('#result .card').getBoundingClientRect();return c.bottom<=innerHeight+1&&c.top>=-1})()}));
  await p.screenshot({path:`${OUT}/zb-${label}-${w}.png`});
  // 刷新后榜单还在 + 菜单入口
  await p.reload();await p.waitForFunction(()=>window.__zb);await p.click('#boardBtn');const bl=await p.evaluate(()=>document.querySelectorAll('#boardList .board li').length);
  if(label==='proto-未上榜')await p.screenshot({path:`${OUT}/zb-menuboard-${w}.png`});
  const want={'proto-上榜':['无尽结算 · 第 6 名',10],'proto-未上榜':['无尽结算 · 未上榜',10],'proto-老档':['无尽结算 · 第 2 名',2]}[label];
  const good=r.over&&r.res&&r.title===want[0]&&r.rows===want[1]&&bl===want[1]&&r.formal==='SENT'&&!r.ov&&r.fit&&!errs.length&&(label==='proto-未上榜'?/未上榜$/.test(r.extra)&&!r.me:r.me===want[0].slice(-5));if(!good)bad++;
  R.push(`${good?'OK':'FAIL'} ${w} ${label}: ${JSON.stringify(r)} 刷新后榜单=${bl} errs=${errs.length}`);await c.close();}
 // 嵌入经营页
 const s=E.newState(Date.now());s.coins=12345;s.muted=true;s.taps=1;s.zombie={cleared:50,endBest:{t:1000,kills:9},endTop:top(10),lv:{atk:0,rate:0,hp:0,ult:0},best:0};
 const c=await b.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});const p=await c.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
 await c.addInitScript(st=>{if(!localStorage.getItem('seed')){localStorage.setItem('tangzhe-save',JSON.stringify(st));localStorage.setItem('tangzhe-save-bak',JSON.stringify(st));localStorage.setItem('tangzhe-preview-save','SENT');localStorage.setItem('seed','1')}},s);
 await p.goto(B+'/');await p.waitForFunction(()=>window.__tzz);await p.evaluate(()=>{if(__tzz.modalOpen())__tzz.closeModal();__tzz.act('zombie')});
 let f=null;for(let i=0;i<60&&!f;i++){for(const fr of p.frames())if(fr.url().includes('/zombie/'))try{if(await fr.evaluate(()=>!!(window.__zb&&__zb.proto.ready)))f=fr}catch(e){}await p.waitForTimeout(100)}
 const out=[];
 for(const t of [650,30]){
  await f.click('#endlessBtn').catch(async()=>{await f.click('#againBtn')});await f.waitForFunction(()=>__zb.G&&!__zb.G.pendStart,null,{timeout:4000});
  await f.evaluate(t=>{const g=__zb.G,pp=g.p;g.t=t;pp.inv=0;g.zs=[{type:'walker',x:pp.x,y:pp.y,r:20,hp:1e9,maxHp:1e9,sp:0,dmg:1e6,col:'#000',flash:0,kx:0,ky:0,slow:0,burn:0,wob:0}];for(let i=0;i<20&&!g.over;i++)__zb.step(0.05)},t);
  await f.waitForFunction(()=>__zb.G.over&&!__zb.G.wait,null,{timeout:4000});
  const r=await f.evaluate(()=>({title:document.querySelector('#resTitle').textContent,rows:document.querySelectorAll('#resBoard .board li').length,extra:document.querySelector('#resBoard .board-me')?.textContent||''}));
  const m=await p.evaluate(()=>({coins:__tzz.state.coins,top:JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).zombie.endTop.length,first:JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).zombie.endTop[0].t,formal:localStorage.getItem('tangzhe-preview-save')}));
  await p.screenshot({path:`${OUT}/zb-embed-${t}-${w}.png`});
  // 重试同一 runId 不重复
  const dup=await f.evaluate(()=>{__zb.send(__zb.G.resMsg);return new Promise(r=>setTimeout(r,300))}).then(()=>p.evaluate(()=>JSON.parse(localStorage.getItem(__tzz.SAVE_KEY)).zombie.endTop.filter(e=>e.t>=600||e.t<40).length));
  const good=r.rows===10&&m.coins===12345&&m.top===10&&m.formal==='SENT'&&dup===6&&(t===650?r.title==='无尽结算 · 第 5 名':r.title==='无尽结算 · 未上榜'&&/未上榜$/.test(r.extra));if(!good)bad++;
  out.push(`${good?'OK':'FAIL'} t=${t} ${JSON.stringify(r)} ${JSON.stringify(m)} 重发后同局条数=${dup}`);
  await f.click('#againBtn');await p.waitForTimeout(200);await f.evaluate(()=>{if(__zb.G&&!__zb.G.over){__zb.G.p.hp=0}});await f.click('#menuBtn').catch(()=>{});
 }
 if(errs.length)bad++;R.push(`${w} embed: ${out.join(' | ')} errs=${errs.length}`);await c.close();
}
await b.close();console.log(R.join('\n'));console.log(bad?`FAILED ${bad}`:'all passed');if(bad)process.exitCode=1;
