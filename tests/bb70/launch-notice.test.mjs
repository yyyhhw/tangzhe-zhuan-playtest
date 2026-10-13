// 盲盒-70：开游戏上新弹窗 + 离线结算上新条（只记 localStorage，不进存档）
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
function harness(file,{unlocked=true,can=true,ls={},saveBlocked=false}={}){
  const src=read(file);
  const code=slice(src,'/* ---------- 盲盒-70','/* ---------- 调任');
  const store=new Map(Object.entries(ls)),h={},log=[],mq=[];let open=false,html='';
  const el=id=>({addEventListener:(ev,fn)=>{h[id]=fn;}});
  const ctx={TEST_MODE:false,saveBlocked,mq,log,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
    state:{pending:{sec:3600,gap:3600,amount:1000,cap:28800}},
    E:{gachaUnlocked:()=>unlocked,canDouble:()=>can,claimOffline:(s,t,dbl)=>{log.push(['claim',dbl]);return{ok:true,amount:dbl?2000:1000,doubled:dbl};},nextResetTs:()=>0},
    modalOpen:()=>open,openModal:x=>{open=true;html=x;for(const k in h)delete h[k];},closeModal:()=>{open=false;log.push(['close']);},
    $:sel=>{const id=sel.slice(1);return html.includes(`id="${id}"`)?el(id):null;},
    setTab:t=>{log.push(['tab',t]);if(t==='gacha')store.set(ctx.BB70_VISIT_KEY,'1');},
    audioUnlock(){},sfx(){},popWord(){},bumpCoins(){},burstCoins(){},toast(){},fmt:String,fmtDur:String,fmtClockLocal:String,coinSm:'',W:1,H:1,now:()=>0,dirty:false,
    atomic:fn=>fn()};
  vm.createContext(ctx);vm.runInContext(code+';this.BB70_LAUNCH_KEY=BB70_LAUNCH_KEY;this.BB70_VISIT_KEY=BB70_VISIT_KEY;this.notice=showNewBlindboxNotice;this.offline=showOffline;this.shouldLaunch=bb70ShouldShowLaunch;',ctx);
  return {ctx,store,h,log,get html(){return html;},click:id=>h[id]()};
}
for(const file of ['app.js','pet/game/app.js']){
  test(file+': unlocked launch popup copy, buttons, × source, go to gacha; shown once per version',()=>{
    const t=harness(file);t.ctx.notice();
    assert.match(t.html,/新盲盒上线啦！/);assert.match(t.html,/77 收藏盲盒到了 16 件新衣服和帽子，开出来就能给 CEO 换上。/);
    assert.match(t.html,/id="mNo"[^>]*>等会儿</);assert.match(t.html,/id="mGo"[^>]*>去看看</);
    assert.equal(t.store.get(t.ctx.BB70_LAUNCH_KEY),'1');t.click('mGo');assert.deepEqual(t.log,[['close'],['tab','gacha']]);
    assert.equal(t.ctx.shouldLaunch(),false);
  });
  test(file+': locked launch popup has only 知道了 and the hire hint',()=>{
    const t=harness(file,{unlocked:false});t.ctx.notice();
    assert.match(t.html,/摸鱼科技公司雇到员工，就能来开盒/);assert.match(t.html,/id="mOk"[^>]*>知道了</);assert.doesNotMatch(t.html,/mGo|mNo|16 件/);
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
      t.click('claimBb70');assert.deepEqual(t.log,[['claim',false],['close'],['tab','gacha']]);
      assert.equal(t.store.get(t.ctx.BB70_VISIT_KEY),'1');assert.equal(t.store.get(t.ctx.BB70_LAUNCH_KEY),'1');
    }
  });
  test(file+': no settlement banner when locked or after visiting gacha once',()=>{
    let t=harness(file,{unlocked:false});t.ctx.offline();assert.doesNotMatch(t.html,/盲盒上新了|claimBb70/);
    t=harness(file);t=harness(file,{ls:{[t.ctx.BB70_VISIT_KEY]:'1'}});t.ctx.offline();assert.doesNotMatch(t.html,/盲盒上新了|claimBb70/);
  });
  test(file+': boot order is settlement then launch notice; gacha tab visit recorded; nothing written to save',()=>{
    const s=read(file),b=slice(s,'function boot()','requestAnimationFrame(frame)');
    assert(b.indexOf('queueModal(showOffline)')<b.indexOf('queueModal(showNewBlindboxNotice)'));
    assert.match(slice(s,'function setTab(','function updateCompactHead'),/if \(t === 'gacha'\) bb70Set\(BB70_VISIT_KEY\)/);
    assert.doesNotMatch(slice(s,'/* ---------- 盲盒-70','/* ---------- 离线收益'),/state\.[a-z]+\s*=|persist\(|dirty\s*=/);
  });
}
test('16 = first eight + blindbox18 second eight, all clothes/hats, catalog 36 → 52',async()=>{
  const {ITEMS}=await import('../../candidates/blindbox18/catalog.mjs');const {EIGHT_WEARABLES}=await import('../../qa-protocol2/eight-catalog.mjs');const {LEGACY_IDS}=await import('../../qa-protocol2/vendor/planner/migration.mjs');
  const all=[...EIGHT_WEARABLES,...ITEMS];assert.equal(all.length,16);assert(all.every(x=>x.slot==='clothes'||x.slot==='hat'||x.type==='clothes'||x.type==='hat'));assert.equal(LEGACY_IDS.length+all.length,52);
});
