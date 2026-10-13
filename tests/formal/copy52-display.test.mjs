// Node/VM + static contracts only; Chromium 390 UI acceptance remains separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const root=path.resolve(new URL('../..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const require=createRequire(import.meta.url);
const apps=['app.js','preview/app.js','pet/game/app.js','preview/pet/game/app.js'];
const token='home86-bb86-20261013-r1';
const cases=[
 ['Asia/Tokyo','2026-10-05T06:00:00Z','06:00'],
 ['Asia/Kuala_Lumpur','2026-10-05T06:00:00Z','05:00'],
 ['Asia/Kolkata','2026-10-05T06:00:00Z','02:30'],
 ['Asia/Kathmandu','2026-10-05T06:00:00Z','02:45'],
 ['America/New_York','2026-03-08T06:30:00Z','17:00'],
 ['America/New_York','2026-11-01T05:30:00Z','16:00'],
 ['Australia/Lord_Howe','2026-10-03T14:00:00Z','08:00'],
 ['Australia/Lord_Howe','2026-04-04T14:00:00Z','07:30'],
];
function runCase([zone,iso,clock]){
 assert.equal(process.env.TZ,zone);
 const t=Date.parse(iso),R=Date.parse(iso.slice(0,10)+'T21:00:00Z');
 for(const p of apps){
  const src=read(p),E=require(path.join(root,p.replace(/app\.js$/,'economy.js')));
  assert.equal(E.nextResetTs(t),R,p+' absolute reset');
  const state=E.newState(t);state.doubleDay=E.dayKey(t);
  const before=JSON.stringify(state),key=E.dayKey(t),eligibility=E.canDouble(state,t);
  let resets=0,storageCalls=0;
  const storage=new Proxy({}, {get(){return ()=>{storageCalls++;throw Error('display touched storage');};}});
  const context={Date,E:{...E,nextResetTs:n=>{assert.equal(n,t);resets++;return E.nextResetTs(n);}},now:()=>t,state,t,can:false,STORAGE:storage,localStorage:storage,sessionStorage:storage};
  vm.createContext(context);
  const fn=src.match(/^function fmtClockLocal\(ts\).*$/m)?.[0];assert(fn,p);
  vm.runInContext(fn,context);
  assert.equal(vm.runInContext('fmtClockLocal('+R+')',context),clock,p);
  const chip=src.match(/const dtxt = (.*?); if \(dc\.textContent/)[1];
  assert.equal(vm.runInContext(chip,context),'双倍 '+clock+' 重置');
  context.can=true;assert.equal(vm.runInContext(chip,context),'今日双倍 ✓');context.can=false;
  const modal=src.match(/今日双倍已用，[^<]+/)[0];
  assert.equal(vm.runInContext('`'+modal+'`',context),'今日双倍已用，'+clock+'重置');
  const setting=src.match(/每日双倍下次重置：[^<]+/)[0];
  assert.equal(vm.runInContext('`'+setting+'`',context),'每日双倍下次重置：本机时间 '+clock);
  let handler,toastArgs;
  context.$=selector=>{assert.equal(selector,'#dailyChip');return {addEventListener:(event,fn)=>{assert.equal(event,'click');handler=fn;}};};
  context.toast=(...args)=>{toastArgs=args;};
  const event=src.split('\n').find(s=>s.startsWith("$('#dailyChip').addEventListener"));
  vm.runInContext(event,context);context.E.canDouble=()=>false;handler();
  assert.deepEqual(toastArgs,['今天的双倍用过啦，本机时间 '+clock+' 重置',2600]);
  const usedResets=resets;context.E.canDouble=()=>true;handler();
  assert.deepEqual(toastArgs,['每日双倍：今天第一次领离线收益可以免费翻倍（先封顶再翻倍）',2600]);
  assert.equal(resets,usedResets);assert.equal(resets,4);
  assert.equal(JSON.stringify(state),before);assert.equal(E.dayKey(t),key);assert.equal(E.canDouble(state,t),eligibility);assert.equal(storageCalls,0);
  assert.equal(E.nextResetTs(R-1),R);assert.equal(E.nextResetTs(R),R+86400000);assert.notEqual(E.dayKey(R-1),E.dayKey(R));
  assert(!/fmtClockMYT|马来西亚时间|setInterval.*fmtClockLocal/.test(src));
  assert.equal((src.match(/fmtClockLocal\(E.nextResetTs\(/g)||[]).length,4);
 }
 console.log(zone+' '+iso+' R='+new Date(R).toISOString()+' => '+clock+'; four mirrors/four displays unchanged state/dayKey');
}
if(process.argv[2]==='--case')runCase(JSON.parse(process.argv[3]));
else{
 const originalTZ=process.env.TZ;
 try{for(const c of cases){process.env.TZ=c[0];runCase(c);}}
 finally{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;}
 const boots=['collection/bootstrap.mjs','preview/collection/bootstrap.mjs'];
 for(const p of boots){const b=read(p);assert(b.includes('app.js?'+(p.startsWith('preview/')?'collectionHost=1c&':'')+'v='+token));}
 assert.equal((read(boots[0]).match(new RegExp('pet/game/app\\.js\\?v='+token,'g'))||[]).length,2);
 for(const p of apps){const html=read(p.replace(/app\.js$/,'index.html')),kind=p.startsWith('preview/')?'preview':'formal';
  assert(html.includes("var B='"+kind+'-'+(p==='preview/pet/game/app.js'?'tea-td-cards-out-20261012-r1':token)+"'"));
  assert.equal(JSON.parse(read(p.replace(/app\.js$/,'version.json'))).v,kind+'-'+(p==='preview/pet/game/app.js'?'tea-td-cards-out-20261012-r1':token));
  const entry=p==='preview/pet/game/app.js'?'app.js':p==='pet/game/app.js'?'../../collection/bootstrap.mjs':'collection/bootstrap.mjs';
  assert(html.includes(entry+'?v='+(p==='preview/pet/game/app.js'?'home35-td46-home22-copy52-20261012-r1':token)));
 }
 assert(read('index.html').includes('td/tdcore.js?v=tower39-copy34-clean01-20261012-r1'));
 assert(read('app.js').includes('td/index.html?embed=1&v='+token));
 console.log('Copy52 static cache closure: pass; no browser acceptance claimed.');
}
