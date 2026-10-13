// 盲盒-70：开游戏上新弹窗 + 离线结算上新条（只记 localStorage，不进存档）
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
function harness(file,{unlocked=true,can=true,ls={},saveBlocked=false,claim=null,p2=true}={}){
  const src=read(file);
  const code=slice(src,'/* ---------- 盲盒-70','/* ---------- 调任');
  const store=new Map(Object.entries(ls)),h={},els=new Map(),log=[],mq=[];let open=false,html='';
  const el=id=>{if(!els.has(id))els.set(id,{id,disabled:false,addEventListener:(ev,fn)=>{h[id]=fn;},set innerHTML(x){html+=x;}});return els.get(id);};
  const ctx={TEST_MODE:false,saveBlocked,mq,log,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    FormalCollectionRuntime:{qaProtocol2:true,qaWearables8:p2},
    state:{_collectionProtocol:p2?2:1,pending:{sec:3600,gap:3600,amount:1000,cap:28800}},
    E:{gachaUnlocked:()=>unlocked,canDouble:()=>can,claimOffline:(s,t,dbl)=>{log.push(['claim',dbl]);return claim?claim(dbl):{ok:true,amount:dbl?2000:1000,doubled:dbl};},nextResetTs:()=>0},
    modalOpen:()=>open,openModal:x=>{open=true;html=x;for(const k in h)delete h[k];els.clear();},closeModal:()=>{open=false;html='';log.push(['close']);},
    $:sel=>{const id=sel.slice(1);return html.includes(`id="${id}"`)?el(id):null;},
    setTab:t=>{log.push(['tab',t]);},
    audioUnlock(){},sfx(){},popWord(){},bumpCoins(){},burstCoins(){},toast:m=>log.push(['toast',m]),fmt:String,fmtDur:String,fmtClockLocal:String,coinSm:'',W:1,H:1,now:()=>0,dirty:false,
    atomic:fn=>fn()};
  vm.createContext(ctx);vm.runInContext(code+';this.BB70_LAUNCH_KEY=BB70_LAUNCH_KEY;this.BB70_VISIT_KEY=BB70_VISIT_KEY;this.notice=showNewBlindboxNotice;this.offline=showOffline;this.shouldLaunch=bb70ShouldShowLaunch;this.set=bb70Set;',ctx);
  return {ctx,store,h,els,log,get html(){return html;},click:id=>h[id]()};
}
// 熊大审 #3：用 app 里真实的 queueModal / closeModal / modalOpen 和 boot() 里真实的三行排队顺序，验证整条弹窗队列不会卡住
function queueHarness(file,{launchSeen=false,claim=null}={}){
  const src=read(file),line=re=>{const m=src.match(re);assert(m,String(re));return m[0];};
  const qfns=[/^function modalOpen\(\) .*$/m,/^function queueModal\(fn\) .*$/m,/^function closeModal\(\) .*$/m].map(line).join('\n');
  const b=slice(src,'function boot()','requestAnimationFrame(frame)'),bootQueue=slice(b,'if (state.pending) queueModal(showOffline);','lastFrame');
  const code=slice(src,'/* ---------- 盲盒-70','/* ---------- 调任');
  const store=new Map(launchSeen?[]:[]),h={},log=[],timers=[];let html='';
  const cls=(name)=>{const set=new Set(['hidden']);return {contains:c=>set.has(c),add:c=>{if(c==='hidden'&&!set.has(c)&&name)log.push(['close']);set.add(c);},remove:c=>set.delete(c)};};
  const modal={classList:cls('modal')},sheet={classList:cls(null)},mpanel={set innerHTML(x){html=x;},get innerHTML(){return html;}};
  const ctx={TEST_MODE:false,saveBlocked:false,modal,sheet,mpanel,log,setTimeout:fn=>timers.push(fn),
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    FormalCollectionRuntime:{qaProtocol2:true,qaWearables8:true},
    state:{_collectionProtocol:2,pending:{sec:3600,gap:3600,amount:1000,cap:28800},gacha:{last:{id:'c_x',seen:false}}},
    E:{gachaUnlocked:()=>true,canDouble:()=>true,claimOffline:(s,t,dbl)=>{log.push(['claim',dbl]);return claim?claim(dbl):{ok:true,amount:1000,doubled:dbl};},nextResetTs:()=>0},
    openModal:x=>{html=x;for(const k in h)delete h[k];modal.classList.remove('hidden');log.push(['open',/新盲盒上线啦/.test(x)?'launch':/大家帮你干了/.test(x)?'offline':'other']);},
    $:sel=>{const id=sel.slice(1);return html.includes(`id="${id}"`)?{disabled:false,addEventListener:(ev,fn)=>{h[id]=fn;},set innerHTML(x){html+=x;}}:null;},
    setTab:t=>log.push(['tab',t]),showReveal:r=>{log.push(['reveal',r]);modal.classList.remove('hidden');html='<div id="reveal"></div>';},
    audioUnlock(){},sfx(){},popWord(){},bumpCoins(){},burstCoins(){},toast:m=>log.push(['toast',m]),fmt:String,fmtDur:String,fmtClockLocal:String,coinSm:'',W:1,H:1,now:()=>0,dirty:false,atomic:fn=>fn()};
  vm.createContext(ctx);
  vm.runInContext(`const mq=[];${qfns}\n${code}\nthis.mq=mq;this.KEY=BB70_LAUNCH_KEY;`,ctx);
  if(launchSeen)store.set(ctx.KEY,'1');
  vm.runInContext(bootQueue,ctx);
  const flush=()=>{let n=0;while(timers.length){assert(++n<20,'timer loop');timers.shift()();}};
  return {ctx,store,log,flush,click:id=>{assert(h[id],id+' rendered');h[id]();},get html(){return html;}};
}
for(const file of ['app.js','pet/game/app.js']){
  test(file+': unlocked launch popup copy, buttons, × source, go to gacha; shown once per version',()=>{
    const t=harness(file);t.ctx.notice();
    assert.match(t.html,/新盲盒上线啦！/);assert.match(t.html,/77 收藏盲盒到了 16 件新衣服和帽子，开出来就能给 CEO 换上。/);
    assert.match(t.html,/id="mNo"[^>]*>等会儿</);assert.match(t.html,/id="mGo"[^>]*>去看看</);
    assert.equal(t.store.get(t.ctx.BB70_LAUNCH_KEY),'1');t.click('mGo');assert.deepEqual(t.log.filter(x=>x[0]!=='toast'),[['close'],['tab','gacha']]);
    assert.equal(t.ctx.shouldLaunch(),false);
  });
  test(file+': locked launch popup has only 知道了 and the hire hint',()=>{
    const t=harness(file,{unlocked:false});t.ctx.notice();
    assert.match(t.html,/科技公司雇到员工，就能来开盒/);assert.match(t.html,/id="mOk"[^>]*>知道了</);assert.doesNotMatch(t.html,/mGo|mNo|16 件/);
    t.click('mOk');assert.deepEqual(t.log,[['close']]);
  });
  test(file+': launch popup queues behind an open modal and is suppressed when seen / save blocked',()=>{
    const t=harness(file);t.ctx.offline();t.ctx.notice();assert.equal(t.ctx.mq.length,1);assert.doesNotMatch(t.html,/新盲盒上线啦/);
    assert.equal(harness(file,{ls:{[t.ctx.BB70_LAUNCH_KEY]:'1'}}).ctx.shouldLaunch(),false);
    assert.equal(harness(file,{saveBlocked:true}).ctx.shouldLaunch(),false);
  });
  test(file+': settlement banner + shortcut claims normal amount (double kept) then opens gacha',()=>{
    for(const [can,label] of [[true,'直接领取，去开盲盒'],[false,'收下，去开盲盒']]){
      const t=harness(file,{can});t.ctx.offline();
      assert.match(t.html,/盲盒上新了：16 件新衣帽，等老板来开！/);assert(t.html.indexOf('offGain')<t.html.indexOf('bb70OfflineBanner'));
      assert.match(t.html,new RegExp('id="claimBb70">'+label+'<'));
      t.click('claimBb70');assert.deepEqual(t.log.filter(x=>x[0]!=='toast'),[['claim',false],['close'],['tab','gacha']]);
      assert.equal(t.store.get(t.ctx.BB70_VISIT_KEY),'1');assert.equal(t.store.get(t.ctx.BB70_LAUNCH_KEY),'1');
    }
  });
  test(file+': no settlement banner when locked or after visiting gacha once',()=>{
    let t=harness(file,{unlocked:false});t.ctx.offline();assert.doesNotMatch(t.html,/盲盒上新了|claimBb70/);
    t=harness(file);t=harness(file,{ls:{[t.ctx.BB70_VISIT_KEY]:'1'}});t.ctx.offline();assert.doesNotMatch(t.html,/盲盒上新了|claimBb70/);
  });
  test(file+': 去开盲盒 claim failure (model) keeps modal, no tab/flags, locks buttons; 知道了 closes only',()=>{
    const t=harness(file,{claim:()=>({ok:false,why:'saveFailed'})});t.ctx.offline();t.click('claimBb70');
    assert.deepEqual(t.log,[['claim',false]]);assert.equal(t.store.get(t.ctx.BB70_VISIT_KEY),undefined);assert.equal(t.store.get(t.ctx.BB70_LAUNCH_KEY),undefined);
    for(const id of ['claimDouble','claim','claimBb70'])assert.equal(t.els.get(id).disabled,true,id);
    assert.match(t.html,/没有确认到账/);t.click('claim');t.click('claimDouble');assert.deepEqual(t.log,[['claim',false]],'no re-claim');
    t.click('bb70ClaimOk');assert.deepEqual(t.log,[['claim',false],['close']]);
  });
  test(file+': queue order — offline 去开盲盒 → already-seen launch notice is skipped → unseen open-box reveal still shows',()=>{
    const q=queueHarness(file);assert.deepEqual(q.log,[['open','offline']]);assert.equal(q.ctx.mq.length,2);
    q.click('claimBb70');q.flush();
    assert.deepEqual(q.log.filter(x=>x[0]!=='toast'),[['open','offline'],['claim',false],['close'],['tab','gacha'],['reveal',true]]);assert.equal(q.ctx.mq.length,0);
  });
  test(file+': queue order — launch seen before boot: offline → reveal; normal claim with unseen launch: offline → launch → reveal',()=>{
    let q=queueHarness(file,{launchSeen:true});assert.equal(q.ctx.mq.length,1);q.click('claim');q.flush();assert.deepEqual(q.log.filter(x=>x[0]!=='toast'),[['open','offline'],['claim',false],['close'],['reveal',true]]);
    q=queueHarness(file);q.click('claim');q.flush();assert.deepEqual(q.log.filter(x=>x[0]!=='toast'),[['open','offline'],['claim',false],['close'],['open','launch']]);
    q.click('mNo');q.flush();assert.deepEqual(q.log.filter(x=>x[0]!=='toast').slice(-2),[['close'],['reveal',true]]);
  });
  test(file+': queue order — launch marked seen by another tab while queued still advances to reveal',()=>{
    const q=queueHarness(file);q.store.set(q.ctx.KEY,'1');q.click('claim');q.flush();assert.deepEqual(q.log.filter(x=>x[0]!=='toast'),[['open','offline'],['claim',false],['close'],['reveal',true]]);
  });
  test(file+': boot order is settlement then launch notice; gacha tab visit recorded; nothing written to save',()=>{
    const s=read(file),b=slice(s,'function boot()','requestAnimationFrame(frame)');
    assert(b.indexOf('queueModal(showOffline)')<b.indexOf('queueModal(showNewBlindboxNotice)'));
    assert.match(slice(s,'function setTab(','function updateCompactHead'),/if \(t === 'gacha' && bb70P2Active\(\)\) bb70Set\(BB70_VISIT_KEY\)/);
    assert.doesNotMatch(slice(s,'/* ---------- 盲盒-70','/* ---------- 离线收益'),/state\.[a-z]+\s*=|persist\(|dirty\s*=/);
  });
}
for(const file of ['app.js','pet/game/app.js']){
  test(file+': r3 P1 (36-item catalog, upgrade cancelled): no launch popup, no banner, no marker writes even via 去看看 path',()=>{
    for(const rt of [{qaProtocol2:true,qaWearables8:false},{qaProtocol2:false,qaWearables8:true}]){
      const t=harness(file,{p2:false});t.ctx.FormalCollectionRuntime=rt;
      assert.equal(t.ctx.shouldLaunch(),false);t.ctx.notice();assert.doesNotMatch(t.html,/新盲盒上线啦|16 件/);
      t.ctx.offline();assert.doesNotMatch(t.html,/盲盒上新了|claimBb70/);
      assert.equal(t.ctx.set(t.ctx.BB70_LAUNCH_KEY),false);assert.equal(t.ctx.set(t.ctx.BB70_VISIT_KEY),false);assert.equal(t.store.size,0);
    }
    const t=harness(file);t.ctx.state._collectionProtocol=1;assert.equal(t.ctx.shouldLaunch(),false,'runtime flag alone is not enough');
  });
  test(file+': r3 native write guard — only the two UI keys, only value "1"',()=>{
    const t=harness(file);
    assert.equal(t.ctx.set('tzz-save'),false);assert.equal(t.ctx.set(t.ctx.BB70_LAUNCH_KEY+'x'),false);
    assert.equal(t.ctx.set(t.ctx.BB70_LAUNCH_KEY,'0'),false);assert.equal(t.ctx.set(t.ctx.BB70_VISIT_KEY,1),false);assert.equal(t.store.size,0);
    assert.equal(t.ctx.set(t.ctx.BB70_LAUNCH_KEY),true);assert.equal(t.ctx.set(t.ctx.BB70_VISIT_KEY,'1'),true);
    assert.deepEqual([...t.store.entries()].sort(),[[t.ctx.BB70_VISIT_KEY,'1'],[t.ctx.BB70_LAUNCH_KEY,'1']].sort());
    const src=slice(read(file),'/* ---------- 盲盒-70','/* ---------- 调任');assert.equal((src.match(/localStorage\.setItem\(/g)||[]).length,1,'single native write site');
  });
}
test('16 = first eight + blindbox18 second eight, all clothes/hats, catalog 36 → 52',async()=>{
  const {ITEMS}=await import('../../candidates/blindbox18/catalog.mjs');const {EIGHT_WEARABLES}=await import('../../qa-protocol2/eight-catalog.mjs');const {LEGACY_IDS}=await import('../../qa-protocol2/vendor/planner/migration.mjs');
  const all=[...EIGHT_WEARABLES,...ITEMS];assert.equal(all.length,16);assert(all.every(x=>x.slot==='clothes'||x.slot==='hat'||x.type==='clothes'||x.type==='hat'));assert.equal(LEGACY_IDS.length+all.length,52);
});
