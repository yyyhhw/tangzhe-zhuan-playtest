// 打僵尸无尽 TOP10 原型存档场景（Chromium 手机视口，隔离上下文；不是真机）：
// 在仓库根起 http.server 后：PLAYWRIGHT_MODULE=… ZB_TEST_BASE=http://127.0.0.1:8765 node preview/zombie/test_zbtop_browser.mjs
// 覆盖：旧正式页往返、双标签交替写分、同局重复、写入失败恢复、两页同时提交（有锁 / 无锁回补）
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch(),B=process.env.ZB_TEST_BASE||'http://127.0.0.1:8765',R=[];let pass=0,fail=0;
const ck=(c,m)=>{c?pass++:(fail++,console.log('FAIL',m));};
const PK='tangzhe-zombie-proto',TK='tangzhe-zombie-proto-top';
const die=async(p,t)=>{await p.click('#endlessBtn').catch(()=>p.click('#againBtn'));await p.evaluate(t=>{const g=__zb.G,pp=g.p;g.t=t;pp.inv=0;g.zs=[{type:'walker',x:pp.x,y:pp.y,r:20,hp:1e9,maxHp:1e9,sp:0,dmg:1e6,col:'#000',flash:0,kx:0,ky:0,slow:0,burn:0,wob:0}];for(let i=0;i<40&&!g.over;i++)__zb.step(0.05)},t);
 await p.waitForFunction(()=>__zb.G.over&&!__zb.G.wait,null,{timeout:5000});
 return p.evaluate(()=>({over:__zb.G.over,hp:__zb.G.p.hp,title:document.querySelector('#resTitle').textContent,me:document.querySelector('#resBoard li.me b')?.textContent||'',extra:document.querySelector('#resBoard .board-me')?.textContent||'',retry:!document.querySelector('#retryBtn').classList.contains('hidden')}));};
const top=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),TK);
const ctx=async()=>{const c=await b.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});await c.addInitScript(()=>{if(!localStorage.getItem('seed')){localStorage.setItem('tangzhe-zombie-proto',JSON.stringify({cleared:50,endBest:{t:300,kills:9},lv:{atk:0,rate:0,hp:0,ult:0},coins:5e10}));localStorage.setItem('tangzhe-save','SENT');localStorage.setItem('seed','1')}});return c;};
const errs=[];const pg=async c=>{const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));return p;};
// A 旧页往返：正式根目录 v15 原型页 ↔ 新预览原型页
{const c=await ctx();const old=await pg(c);await old.goto(B+'/zombie/');await old.waitForFunction(()=>window.__zb);
 await old.click('[data-tr="atk"]');ck(await old.evaluate(k=>JSON.parse(localStorage.getItem(k)).lv.atk,PK)===1,'旧页训练写进原型键');
 const nw=await pg(c);await nw.goto(B+'/preview/zombie/');await nw.waitForFunction(()=>window.__zb);
 ck(await nw.evaluate(()=>__zb.proto.lv.atk===1&&__zb.proto.endTop.length===1&&__zb.proto.endTop[0].t===300),'新页读到旧页训练和旧最好成绩 300（1 条 legacy）');
 let r=await die(nw,550);ck(r.over&&r.hp<=0&&r.title==='无尽新纪录！第 1 名'&&r.me==='第 1 名','新页真打死 550 秒 → 第 1 名 '+JSON.stringify(r));
 ck((await top(nw)).length===2,'榜单 2 条（550 + 旧 300）');
 await old.reload();await old.waitForFunction(()=>window.__zb);await old.click('[data-tr="rate"]');
 await old.click('#endlessBtn');await old.evaluate(()=>{const g=__zb.G;g.t=800;g.kills=33;__zb.setPause(true)});await old.click('#quitBtn');await old.waitForTimeout(100);
 ck(await old.evaluate(k=>JSON.parse(localStorage.getItem(k)).endBest.t,PK)>=800,'旧页无尽 800 秒写进旧字段 endBest');
 ck((await top(old)).length===2,'旧页保存没动独立榜单');
 await nw.reload();await nw.waitForFunction(()=>window.__zb);await nw.click('#boardBtn');
 const bl=await nw.evaluate(()=>[...document.querySelectorAll('#boardList li span')].map(e=>e.textContent));
 ck(bl.length===3&&/800/.test(bl[0])&&/550/.test(bl[1])&&/300/.test(bl[2]),'回新页：旧页 800、新页 550、旧 300 都在 '+JSON.stringify(bl));
 ck(await nw.evaluate(()=>__zb.proto.lv.rate===1&&__zb.proto.lv.atk===1),'旧页第二次训练也保留');
 R.push('A 旧页往返 done');await c.close();}
// B 双标签交替写分 + C 同局重复
{const c=await ctx();const A=await pg(c),Bp=await pg(c);for(const p of [A,Bp]){await p.goto(B+'/preview/zombie/');await p.waitForFunction(()=>window.__zb);}
 let r1=await die(A,200),r2=await die(Bp,400),r3=await die(A,100);
 const t=await top(A);ck(t.length===4&&t.map(e=>Math.round(e.t)).join()==='400,300,200,100','双标签交替写分全保留 '+t.map(e=>e.t));
 ck(r1.me==='第 2 名'&&r2.me==='第 1 名'&&r3.me==='第 4 名','各自名次按合并后算 '+[r1.me,r2.me,r3.me]);
 await A.click('#menuBtn');await A.click('#boardBtn');await A.waitForTimeout(100);
 ck(await A.evaluate(()=>document.querySelectorAll('#boardList li').length)===4,'A 页榜单看到 B 页成绩');
 await Bp.click('#menuBtn');await Bp.click('[data-tr="hp"]');ck((await top(A)).length===4,'B 页训练保存不覆盖 A 的成绩');
 await die(Bp,150);const n0=(await top(Bp)).length;
 await Bp.evaluate(()=>Promise.all([__zb.saveProto(__zb.G.resApply),__zb.saveProto(__zb.G.resApply)]));ck((await top(Bp)).length===n0&&n0===5,'同一局重复保存只记一次 '+n0);
 R.push('B/C done');await c.close();}
// D 写入失败恢复
{const c=await ctx();const p=await pg(c);await p.goto(B+'/preview/zombie/');await p.waitForFunction(()=>window.__zb);
 await p.evaluate(k=>{const o=Storage.prototype.setItem;window.__o=o;Storage.prototype.setItem=function(a,v){if(a===k)throw new Error('QuotaExceededError');return o.call(this,a,v)}},TK);
 const before=await p.evaluate(k=>[localStorage.getItem(k),localStorage.getItem('tangzhe-zombie-proto')],TK);
 let r=await die(p,999);ck(/没存上/.test(r.title)&&r.retry&&r.me===''&&/没存上/.test(r.extra),'写入失败：标题/本局行写没存上，不显示名次，出现重试 '+JSON.stringify(r));
 ck(JSON.stringify(await p.evaluate(k=>[localStorage.getItem(k),localStorage.getItem('tangzhe-zombie-proto')],TK))===JSON.stringify(before)&&await p.evaluate(()=>__zb.proto.endTop.length)===1,'失败时存档和内存都没变');
 await p.click('#retryBtn');await p.waitForFunction(()=>!__zb.G.wait);r=await p.evaluate(()=>({title:document.querySelector('#resTitle').textContent,retry:!document.querySelector('#retryBtn').classList.contains('hidden')}));ck(/没存上/.test(r.title)&&r.retry,'仍失败时重试照样提示');
 await p.evaluate(()=>{Storage.prototype.setItem=window.__o});await p.click('#retryBtn');
 r=await p.evaluate(()=>({title:document.querySelector('#resTitle').textContent,retry:!document.querySelector('#retryBtn').classList.contains('hidden'),me:document.querySelector('#resBoard li.me b')?.textContent}));
 await p.waitForFunction(()=>!__zb.G.wait);r=await p.evaluate(()=>({title:document.querySelector('#resTitle').textContent,retry:!document.querySelector('#retryBtn').classList.contains('hidden'),me:document.querySelector('#resBoard li.me b')?.textContent}));
 ck(r.title==='无尽新纪录！第 1 名'&&!r.retry&&r.me==='第 1 名','恢复后重试落盘并显示第 1 名 '+JSON.stringify(r));
 await p.reload();await p.waitForFunction(()=>window.__zb);ck(await p.evaluate(()=>__zb.proto.endTop[0].t>998&&__zb.proto.endTop.length===2),'刷新后 999 秒还在');
 ck(await p.evaluate(()=>localStorage.getItem('tangzhe-save'))==='SENT','正式存档 sentinel 不变');
 R.push('D done');await c.close();}
// E 两页真正同时提交：故意把读榜单放慢 40ms 拉大竞争窗口；有 Web Locks 走锁，没有就靠 storage 回补
for(const lock of [true,false]){
 const c=await b.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});
 await c.addInitScript(([lock,TK])=>{if(!localStorage.getItem('seed')){localStorage.setItem('tangzhe-zombie-proto',JSON.stringify({cleared:50,lv:{atk:0,rate:0,hp:0,ult:0},coins:5e10}));localStorage.setItem('seed','1')}
  const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){const v=g.call(this,k);if(k===TK){const t=performance.now();while(performance.now()-t<40);}return v};
  if(!lock)Object.defineProperty(Navigator.prototype,'locks',{get:()=>undefined,configurable:true});},[lock,TK]);
 const A=await pg(c),Bp=await pg(c);for(const p of [A,Bp]){await p.goto(B+'/preview/zombie/');await p.waitForFunction(()=>window.__zb);}
 ck(await A.evaluate(()=>__zb.hasLock())===lock,'锁可用状态 '+lock);
 const fire=(p,pre,base)=>p.evaluate(([pre,base])=>Promise.all([0,1,2,3,4].map(i=>__zb.saveProto(z=>ZBCore.applyResult(z,{mode:'endless',t:base+i,kills:i,runId:pre+i})))),[pre,base]);
 const oks=await Promise.all([fire(A,'a',100),fire(Bp,'b',200)]);
 ck(oks.flat().every(x=>x===true),'同时提交都返回保存成功');
 await A.waitForTimeout(1500);
 const t=await top(A);ck(t.length===10&&new Set(t.map(e=>e.id)).size===10,`${lock?'有锁':'无锁回补'}：两页同时各写 5 局，10 局全在 `+t.map(e=>e.id).join());
 await A.close();await Bp.close();const C=await pg(c);await C.goto(B+'/preview/zombie/');await C.waitForFunction(()=>window.__zb);
 ck(await C.evaluate(()=>__zb.proto.endTop.length)===10,`${lock?'有锁':'无锁'}：两页都关掉后重开，榜单仍 10 局`);
 R.push(`E ${lock?'lock':'nolock'} done`);await c.close();}
await b.close();if(fail)process.exitCode=1;console.log(R.join('\n'),`\npass ${pass} fail ${fail} pageerrors ${errs.length}`,errs.slice(0,3));
