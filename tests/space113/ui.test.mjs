// 星途-113：真实入口/协调器/overlay（Node/VM 模型 DOM/Storage，不是浏览器）——事件卡、翻面、收下、最近返航报告、存档锁/脏内存。
import test from 'node:test';import assert from 'node:assert/strict';
import vm from 'node:vm';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
import {EVENTS} from '../../space/voyage-ev.mjs';
const opts={timeout:20000};
async function ready(t,{scope='formal',configure,...rest}={}){const h=await assembly({scope,protocol:2,mode:'bootstrap',...rest,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}f.data.set(f.keys.main,JSON.stringify(s));configure?.(f);}});t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');assert(h.app&&h.context.XingTu,JSON.stringify(h.errors));let time=1700000001000;h.context.Date.now=()=>time;return {...h,setTime:v=>time=v,moon:h.context.XingTu};}
const txt=(h,id)=>h.node(id)?.textContent;
for(const scope of ['formal','preview'])for(const choice of ['a','b'])test(`${scope} choice ${choice}: event card → same card flips to report → 收下 pays once; close/reopen/refresh keeps the card`,opts,async t=>{
 const h=await ready(t,{scope});h.moon.open();assert(h.node('xingtuDepart').onclick().ok);const v=copy(h.app.state.space.voyage),e=EVENTS[v.ev];assert(e);
 h.setTime(1700000601000);h.moon.refresh();assert.equal(txt(h,'xingtuEvStatus'),'已经回到地球。路上遇到了点事，看完再领探索点。');assert.equal(txt(h,'xingtuEvTitle'),e.name);assert.equal(txt(h,'xingtuEvText'),e.situation);assert.equal(txt(h,'xingtuEvKicker'),`返航途中 · 第 ${v.sequence} 次月面往返`);assert.equal(txt(h,'xingtuChoiceA'),e.a.label);assert.equal(txt(h,'xingtuChoiceB'),e.b.label);assert.equal(h.node('xingtuClaim'),null,'no claim before choosing');
 const raw=h.data.get(h.t.keys.main);h.moon.close();h.moon.open();assert.equal(txt(h,'xingtuEvTitle'),e.name);assert.equal(h.data.get(h.t.keys.main),raw,'close/reopen writes nothing, no re-pick');
 const saved=new Map(h.data);await h.close();const n2=await ready(t,{scope,configure:f=>{f.data.clear();for(const [k,x]of saved)f.data.set(k,x);}});n2.setTime(1700000602000);n2.moon.open();assert.equal(txt(n2,'xingtuEvTitle'),e.name,'refresh keeps same event');
 const btn=n2.node(choice==='a'?'xingtuChoiceA':'xingtuChoiceB'),other=n2.node(choice==='a'?'xingtuChoiceB':'xingtuChoiceA').onclick;const r=btn.onclick();assert(r.ok,JSON.stringify(r));
 const st=n2.app.state.space.voyage.evState,fail=st.outcome==='fail';assert.equal(n2.app.state.space.pts,0);assert.equal(txt(n2,'xingtuEvKicker'),'返航报告 · 月面基地');assert.equal(txt(n2,'xingtuEvTitle'),fail?'有点狼狈地回来了':'平安返航');assert.equal(txt(n2,'xingtuEvText'),choice==='b'?e.bText:fail?e.fail:e.success);assert.equal(txt(n2,'xingtuReward'),`+${st.reward.pts} 探索点`);
 const w=n2.writes().length;const late=other();assert.equal(n2.writes().length,w,'stale other-choice callback zero writes');assert.equal(n2.app.state.space.voyage.evState.choice,choice);
 const claim=n2.node('xingtuClaim');assert.equal(claim.textContent,'收下');assert(claim.onclick().ok);assert.equal(n2.app.state.space.pts,st.reward.pts);assert.equal(n2.app.state.space.visits.moon,1);
 assert.match(txt(n2,'xingtuReport'),new RegExp(`^最近返航报告：${e.name} · 已入账 ${st.reward.pts} 探索点 · 剧情卡「月面第一串」 · (今天|昨天|明天) \\d{2}:\\d{2}$`));
 const w2=n2.writes().length;claim.onclick();assert.equal(n2.writes().length,w2);assert.equal(n2.app.state.space.pts,st.reward.pts,'no double reward');
});
for(const scope of ['formal','preview'])test(`${scope} save-lock contention: pending ordinary save / dirty memory / hidden / stolen lock → choice zero writes, nothing re-rolled`,opts,async t=>{
 const h=await ready(t,{scope});h.moon.open();assert(h.node('xingtuDepart').onclick().ok);h.setTime(1700000601000);h.moon.refresh();const choose=h.node('xingtuChoiceA').onclick,raw=h.data.get(h.t.keys.main),n=h.writes().length;
 h.app.persist.pending={operation:'fixture'};assert(!choose().ok);delete h.app.persist.pending;assert.equal(h.writes().length,n);
 h.context.__i=JSON.stringify({type:'choose',voyageId:h.app.state.space.voyage.voyageId,choice:'a'});h.app.state.coins+=3;
 const denied=vm.runInContext((scope==='formal'?'Formal':'Preview')+'CollectionRuntime.coordinator.spaceIntent(JSON.parse(__i))',h.context);assert.equal(denied.code,'SPACE_APP_SAVE_REQUIRED');assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(h.writes().length,n);h.app.state.coins-=3;
 h.hide();assert(!choose().ok);assert.equal(h.writes().length,n);h.document.hidden=false;h.document.visibilityState='visible';h.moon.resume();
 h.stealLock();await new Promise(r=>setImmediate(r));assert(!choose().ok);assert.equal(h.writes().length,n);assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(JSON.parse(raw).space.voyage.evState.choice,null);
});
test('old v1 in-flight save opened in the new UI: no event card, old 8-point claim button, v1 receipt line',opts,async t=>{
 const h=await ready(t,{configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.space={schemaVersion:1,lv:{tech:1,war:1,med:1,life:1},pts:3,voyage:{route:'moon',start:1700000001000,dur:600000,ev:null,voyageId:'moon:formal:1:12345678-1234-4234-8234-123456789abc',sequence:1,ruleset:'xingtu-moon-10min-8pts-v1',completed:false},items:{},cards:{},hidden:{},alienCards:0,wins:0,ended:false,earth:false,visits:{},moonLoop:{schemaVersion:1,sequence:1,claimed:0,lastReceipt:null}};f.data.set(f.keys.main,JSON.stringify(s));}});
 h.setTime(1700000601000);h.moon.open();assert.equal(h.node('xingtuChoiceA'),null);assert.equal(txt(h,'xingtuClaim'),'确认返航报告 · 领取8探索点');assert(h.node('xingtuClaim').onclick().ok);assert.equal(h.app.state.space.pts,11);assert.match(txt(h,'xingtuReport'),/^最近返航报告：月面基地 · 已入账 8 探索点（一次）/);
 assert(h.node('xingtuDepart').onclick().ok);assert.equal(h.app.state.space.voyage.ruleset,'xingtu-moon-10min-ev-v2');
});
