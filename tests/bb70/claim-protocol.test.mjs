// 盲盒-70（熊大审 #2）：结算框「去开盲盒」走真实 atomic/txn/persist + 生产 collection coordinator（P1 保留 / P1→P2 升级 / 已是 P2），
// 覆盖：成功、备份写失败、主档读回未知、刷新重开、双击连点。DOM/锁/存储是合成模型（production-harness），不是浏览器证据。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {assembly,until,copy,source} from '../wearables8/production-harness.mjs';
const opts={timeout:20000};
const slice=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
// 杨总 16:05：正式存档不再有升级确认/取消，P1（含以前取消过的）一律自动升级到 P2。
const MODES=[['P1 old save (auto-upgrade)',{},null,2],['P1→P2 (auto-upgrade)',{},null,2],['P2 existing',{protocol:2},null,2]];
const ROUTES=[['app.js','/'],['pet/game/app.js','/pet/game/']];
async function boot(t,{path,protocol,btn,configure,storageFault}){
  const h=await assembly({scope:'formal',mode:'bootstrap',path,...(protocol===2?{protocol:2}:{}),configure,storageFault});t.after(()=>h.close());
  await until(()=>h.view()?.phase==='prompt'||h.app||h.errors.length,'production entry');assert.equal(h.bootError,null);
  assert.notEqual(h.view()?.phase,'prompt','formal must not show an upgrade prompt');
  await until(()=>h.app||h.errors.length,'production app');assert(h.app,JSON.stringify(h.errors));return h;
}
// Mount the ACTUAL 盲盒-70 block + showOffline from the shipped app file; claim goes through the real extracted atomic→txn→persist→coordinator.
function mount(h,file){
  const src=source(file),code=slice(src,'/* ---------- 盲盒-70','/* ---------- 调任');
  const tabLine=slice(src,'function setTab(','function updateCompactHead').split('\n').find(l=>l.includes('bb70'));assert(tabLine,'setTab bb70 line');
  const ui={html:'',open:false,els:new Map(),log:[],mq:[],atomicCalls:0};
  const el=id=>{if(!ui.els.has(id))ui.els.set(id,{id,disabled:false,fns:[],addEventListener(ev,fn){this.fns.push(fn);},set innerHTML(x){ui.html+=x;ui.banner=x;},click(){for(const f of this.fns)f();}});return ui.els.get(id);};
  let dirty=false;
  const env={TEST_MODE:false,get saveBlocked(){return h.app.saveBlocked;},get state(){return h.app.state;},get E(){return h.context.Economy;},
    atomic:(...a)=>{ui.atomicCalls++;return h.app.atomic(...a);},now:()=>h.context.Date.now(),localStorage:h.context.localStorage,mq:ui.mq,
    modalOpen:()=>ui.open,openModal:x=>{ui.open=true;ui.html=x;ui.els.clear();},closeModal:()=>{ui.open=false;ui.html='';ui.log.push(['close']);},
    $:sel=>{const id=sel.slice(1);return ui.html.includes(`id="${id}"`)?el(id):null;},
    setTab:x=>{ui.log.push(['tab',x]);fns.realSetTab(x);},toast:m=>{ui.log.push(['toast',m]);h.context.__modelToasts.push(m);},
    audioUnlock(){},sfx(){},popWord(){},bumpCoins(){},burstCoins(){},fmt:String,fmtDur:String,fmtClockLocal:String,coinSm:'',W:1,H:1,get dirty(){return dirty;},set dirty(v){dirty=v;}};
  // realSetTab = the ACTUAL bb70 line from the shipped setTab() (r3: P1 old gacha tab must not write VISIT)
  let fns;fns=vm.runInContext(`(function(env){with(env){return (function(){${code}\nfunction realSetTab(t){\n${tabLine}\n}\nreturn {showOffline,showNewBlindboxNotice,BB70_LAUNCH_KEY,BB70_VISIT_KEY,bb70ShouldShowLaunch,bb70ShouldShowOfflineBanner,bb70Set,realSetTab};})();}})`,h.context)(env);
  return {...fns,ui,click:id=>{const e=ui.els.get(id);assert(e&&ui.html.includes(`id="${id}"`),id+' rendered');e.click();}};
}
function settle(h){const s=h.app.state,p=h.context.Economy.settleOffline(s,Math.max(s.lastSeen,h.context.Date.now())+7200e3,()=>'bb70-protocol-offline');assert(p&&p.amount>0);assert.equal(h.app.persist(),true);return copy(p);}
const mainWrites=h=>h.calls.filter(x=>x.operation==='setItem'&&x.key===h.t.keys.main).length;
const saved=h=>JSON.parse(h.data.get(h.t.keys.main));
const flags=(h,m)=>[h.data.get(m.BB70_LAUNCH_KEY)??null,h.data.get(m.BB70_VISIT_KEY)??null];
async function reopen(t,h,route,mode){const keep=new Map(h.data);await h.close();
  return boot(t,{path:route,protocol:1,btn:null,configure:f=>{f.data.clear();for(const [k,v] of keep)f.data.set(k,v);}});}

for(const [file,route] of ROUTES){
  // r3 #1/#3 → 杨总 16:05：P1 已不可能保留；P1 存档（含以前取消过的）开游戏即自动 P2，16 件新提醒照常出现
  test(`${file} P1 old save (incl. previously cancelled) auto-upgrades: launch notice + settlement banner show, markers only after real actions`,opts,async t=>{
    const h=await boot(t,{path:route,protocol:1,btn:null});assert.equal(h.app.state._collectionProtocol,2);assert.equal(h.runtime.qaWearables8,true);
    const p=settle(h);const m=mount(h,file);assert.deepEqual(flags(h,m),[null,null],'no marker pre-written by upgrade');
    assert.equal(m.bb70ShouldShowLaunch(),true);assert.equal(m.bb70ShouldShowOfflineBanner(),true);
    m.showOffline();assert.match(m.ui.html,/盲盒上新了：16 件新衣帽/);m.showNewBlindboxNotice();assert.equal(m.ui.mq.length,1);
    m.click('claimBb70');assert.deepEqual(m.ui.log.filter(x=>x[0]!=='toast'),[['close'],['tab','gacha']]);assert.equal(saved(h).pending,null);assert.equal(saved(h).claimLog.filter(c=>c.id===p.id).length,1);assert.deepEqual(flags(h,m),['1','1']);
  });
}
for(const [file,route] of ROUTES)for(const mode of MODES.slice(1)){
  const [label,,btn,proto]=mode,cfg={path:route,protocol:mode[1].protocol||1,btn};
  test(`${file} ${label}: success commits exactly once, then closes, goes to gacha, marks seen; survives refresh`,opts,async t=>{
    const h=await boot(t,cfg);assert.equal(h.app.state._collectionProtocol,proto);const p=settle(h),before=copy(h.app.state),w=mainWrites(h);
    const m=mount(h,file);m.showOffline();assert.match(m.ui.html,/盲盒上新了：16 件新衣帽/);assert.deepEqual(flags(h,m),[null,null]);
    m.click('claimBb70');
    assert.deepEqual(m.ui.log.filter(x=>x[0]!=='toast'),[['close'],['tab','gacha']]);assert.equal(m.ui.atomicCalls,1);
    assert.equal(mainWrites(h),w+1);const s=saved(h);assert.equal(s.pending,null);assert.equal(s.coins,before.coins+p.amount);assert.equal(s.claimLog.filter(c=>c.id===p.id).length,1);assert.equal(s.dailyDoubleDay,before.dailyDoubleDay,'double kept for next time');
    assert.deepEqual(flags(h,m),['1','1']);assert.equal(h.app.saveBlocked,false);
    const r=await reopen(t,h,route,mode);assert.equal(r.app.state.pending,null);assert.equal(r.app.state.coins,before.coins+p.amount);assert.equal(r.app.state._collectionProtocol,proto);
    const m2=mount(r,file);m2.showOffline();assert.equal(m2.ui.open,false,'no second settlement');assert.equal(m2.bb70ShouldShowLaunch(),false,'launch notice stays seen after refresh');
  });
  for(const failure of ['backup','unknown'])test(`${file} ${label}: ${failure} save failure keeps recovery path — no close/navigate/seen flags, buttons locked, no re-claim; refresh shows exact saved outcome`,opts,async t=>{
    const fault={operation:null,key:null,afterWrite:false,armed:false};const h=await boot(t,{...cfg,storageFault:fault});const p=settle(h),before=copy(h.app.state),oldMain=h.data.get(h.t.keys.main);
    const m=mount(h,file);m.showOffline();
    Object.assign(fault,failure==='backup'?{operation:'setItem',key:h.t.keys.backup}:{operation:'getItem',key:h.t.keys.main,afterWrite:true});
    m.click('claimBb70');
    assert.equal(m.ui.open,true,'settlement modal stays open');assert.deepEqual(m.ui.log.filter(x=>x[0]!=='toast'),[],'no close, no gacha tab');assert.deepEqual(flags(h,m),[null,null],'seen/visit flags not written');
    assert.equal(h.app.saveBlocked,true);assert.equal(h.view().phase,'protected');assert.equal(h.view().canPlay,false);
    for(const id of ['claimDouble','claim','claimBb70'])if(m.ui.els.has(id))assert.equal(m.ui.els.get(id).disabled,true,id+' locked');
    assert.match(m.ui.banner,/没有确认到账，先不去盲盒页/);assert(!h.context.__modelToasts.some(x=>/金币已退回|没扣金币|已到账/.test(x)),'uncertain UI must not promise refund or success');
    const stored=h.data.get(h.t.keys.main),writes=h.writes().length;
    if(failure==='backup')assert.equal(stored,oldMain,'main untouched');else{assert.equal(JSON.parse(stored).pending,null);assert.equal(JSON.parse(stored).coins,before.coins+p.amount);}
    for(const id of ['claimBb70','claim','claimDouble'])m.ui.els.get(id)?.click();   // stale handlers / double-click after failure
    assert.equal(m.ui.atomicCalls,1,'no blind re-claim');assert.equal(h.writes().length,writes);assert.equal(h.data.get(h.t.keys.main),stored);
    m.click('bb70ClaimOk');assert.equal(m.ui.open,false);assert.deepEqual(m.ui.log.filter(x=>x[0]!=='toast'),[['close']]);assert.deepEqual(flags(h,m),[null,null]);
    Object.assign(fault,{operation:null,key:null,armed:false,afterWrite:false});
    const r=await reopen(t,h,route,mode),s=r.app.state;
    if(failure==='backup'){assert.equal(s.pending?.id,p.id,'pending survives');assert.equal(s.coins,before.coins);
      const m2=mount(r,file);m2.showOffline();assert.match(m2.ui.html,/claimBb70/,'banner offered again');m2.click('claimBb70');assert.deepEqual(m2.ui.log.filter(x=>x[0]!=='toast'),[['close'],['tab','gacha']]);assert.equal(saved(r).coins,before.coins+p.amount);assert.equal(saved(r).claimLog.filter(c=>c.id===p.id).length,1);}
    else{assert.equal(s.pending,null,'unknown commit landed exactly once');assert.equal(s.coins,before.coins+p.amount);assert.equal(s.claimLog.filter(c=>c.id===p.id).length,1);
      const m2=mount(r,file);m2.showOffline();assert.equal(m2.ui.open,false,'nothing left to claim twice');}
  });
  test(`${file} ${label}: double-click / both buttons fire once — one real commit, normal amount, one gacha navigation`,opts,async t=>{
    const h=await boot(t,cfg);const p=settle(h),before=copy(h.app.state),w=mainWrites(h);const m=mount(h,file);m.showOffline();
    const handlers=['claimBb70','claimBb70','claim','claimDouble'].map(id=>m.ui.els.get(id)).filter(Boolean);for(const e of handlers)e.click();
    assert.equal(m.ui.atomicCalls,1);assert.equal(mainWrites(h),w+1);assert.equal(saved(h).coins,before.coins+p.amount,'not doubled, not twice');
    assert.deepEqual(m.ui.log.filter(x=>x[0]!=='toast'),[['close'],['tab','gacha']]);
  });
}
