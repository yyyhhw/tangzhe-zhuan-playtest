// 盲盒-86：70 上新提醒三处细节（只改显示和弹出时机，不动领取逻辑和存档字段）
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const slice=(s,a,b)=>{const i=s.indexOf(a);assert(i>=0,a);const j=s.indexOf(b,i);assert(j>i,b);return s.slice(i,j);};
function load(file,{unlocked=true,can=true,p2=true,first=false,ls={}}={}){
  const src=read(file),code=slice(src,'/* ---------- 盲盒-70','/* ---------- 调任');
  const bootLines=slice(slice(src,'function boot()','requestAnimationFrame(frame)'),'if (first)','if (state.gacha.last');
  const store=new Map(Object.entries(ls)),q=[],writes=[];let html='';
  const ctx={TEST_MODE:false,saveBlocked:false,first,mq:[],q,
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{writes.push([k,v]);store.set(k,String(v));}},
    FormalCollectionRuntime:{qaProtocol2:true,qaWearables8:p2},
    state:{_collectionProtocol:p2?2:1,pending:null,gacha:{last:null}},
    E:{gachaUnlocked:()=>unlocked,canDouble:()=>can,nextResetTs:()=>0},
    modalOpen:()=>false,openModal:x=>{html=x;},closeModal(){},queueModal:fn=>q.push(fn.name),showIntro:function showIntro(){},showOffline:function showOffline(){},
    $:()=>({addEventListener(){}}),setTab(){},audioUnlock(){},toast(){},fmt:String,fmtDur:String,fmtClockLocal:String,coinSm:'',now:()=>0};
  vm.createContext(ctx);vm.runInContext(code+';this.K=BB70_LAUNCH_KEY;this.notice=showNewBlindboxNotice;this.offline=()=>{state.pending={sec:1,gap:1,amount:1,cap:28800};showOffline();};this.should=bb70ShouldShowLaunch;this.boot=()=>{'+bootLines+'};',ctx);
  return {ctx,store,writes,q,get html(){return html;}};
}
for(const file of ['app.js','pet/game/app.js']){
  test(file+' ① 新玩家：点「开摊！」之后不再排上新弹窗，首次进入直接记已看（只写那一个键、值 1）',()=>{
    const t=load(file,{first:true});t.ctx.boot();
    assert.deepEqual(t.q,['showIntro']);assert.equal(t.store.get(t.ctx.K),'1');assert.deepEqual(t.writes,[[t.ctx.K,'1']]);assert.equal(t.ctx.should(),false);
  });
  test(file+' ① 老玩家（非首次）照旧排上新弹窗，且不预先写标记',()=>{
    const t=load(file,{first:false});t.ctx.boot();
    assert.deepEqual(t.q,['showNewBlindboxNotice']);assert.deepEqual(t.writes,[]);
  });
  test(file+' ① P1（未启用新目录）的新玩家：不弹也不写任何标记',()=>{
    const t=load(file,{first:true,p2:false});t.ctx.boot();
    assert.deepEqual(t.q,['showIntro']);assert.deepEqual(t.writes,[]);
  });
  test(file+' ② 未解锁那句以句号结尾',()=>{
    const t=load(file,{unlocked:false});t.ctx.notice();assert.match(t.html,/科技公司雇到员工，就能来开盒。<\/div>/);
  });
  test(file+' ③ 双倍未用时「直接领取，去开盲盒」是白底次要样式；双倍已用时仍是红色主按钮',()=>{
    let t=load(file,{can:true});t.ctx.offline();assert.match(t.html,/class="buy ghost" id="claimBb70">直接领取，去开盲盒</);
    t=load(file,{can:false});t.ctx.offline();assert.match(t.html,/class="buy red" id="claimBb70">收下，去开盲盒</);
  });
}
