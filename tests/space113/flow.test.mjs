// 星途-113：事件航程完整规则（纯函数层）。旧档兼容 / 选择先存不重掷 / 只发一次 / 回执兼容校验。
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {moonView,planMoon,MOON_RULES,MOON_EV_RULES} from '../../space/moon.mjs';
import {EVENTS,EVENT_POOL,outcomeFor,rewardPoints} from '../../space/voyage-ev.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({rev:1,coins:50,shops:[0,1,2,3].map(()=>({open:true,lv:35})),space:defaultSpace()});
const opt=(now,u='11111111-1111-4111-8111-111111111111')=>({scope:'formal',now,makeId:()=>u});
const go=(s,i,now,u)=>{const r=planMoon(s,i,opt(now,u));assert(r.ok,JSON.stringify(r));return r;};
function departed(u){const d=go(fresh(),{type:'depart',route:'moon'},1000,u);return {d,id:d.state.space.voyage.voyageId};}
test('old v1 save in flight: no event, claim pays exactly 8 with v1 receipt; next departure is ev-v2',()=>{
 const s=fresh(),id='moon:formal:1:12345678-1234-1234-1234-123456789abc';
 s.space.voyage={route:'moon',start:1000,dur:600000,ev:null,voyageId:id,sequence:1,ruleset:MOON_RULES.id,completed:false};s.space.moonLoop={schemaVersion:1,sequence:1,claimed:0,lastReceipt:null};
 const raw=JSON.stringify(s),v=moonView(s,{scope:'formal',now:601000});assert(v.ok);assert.equal(v.event,null);assert.equal(v.needsChoice,false);assert.equal(JSON.stringify(s),raw,'read never writes');
 assert.equal(planMoon(s,{type:'choose',voyageId:id,choice:'a'},opt(601000)).code,'SPACE_EV_NONE');
 const c=go(s,{type:'claim',voyageId:id},601000);assert.equal(c.state.space.pts,8);assert.deepEqual(Object.keys(c.state.space.moonLoop.lastReceipt).sort(),['arrival','card','claimedAt','hidden','points','route','ruleset','sequence','start','voyageId']);
 const n=go(c.state,{type:'depart',route:'moon'},602000);assert.equal(n.state.space.voyage.ruleset,MOON_EV_RULES.id);assert(EVENT_POOL.includes(n.state.space.voyage.ev));assert(moonView(n.state,{scope:'formal',now:602000}).ok,'v1 receipt + v2 voyage coexist');
 for(const old of [{...fresh(),space:undefined}]){delete old.space;assert(moonView(old,{scope:'formal',now:5}).ok);}
});
test('event is fixed at departure: refresh/close never re-picks; claim before choosing refused; choose before arrival refused',()=>{
 const {d,id}=departed();const ev=d.state.space.voyage.ev;
 for(const now of [2000,601000,9e9])assert.equal(moonView(d.state,{scope:'formal',now}).event.id,ev);
 assert.equal(planMoon(d.state,{type:'choose',voyageId:id,choice:'a'},opt(600999)).code,'SPACE_NOT_ARRIVED');
 assert.equal(planMoon(d.state,{type:'claim',voyageId:id},opt(601000)).code,'SPACE_EV_CHOICE_REQUIRED');
 const v=moonView(d.state,{scope:'formal',now:601000});assert(v.needsChoice);assert.equal(v.space.pts,0);
});
test('choice + outcome stored first, never re-rolled; second choice (even different) is read-only noop',()=>{
 const {d,id}=departed();const c=go(d.state,{type:'choose',voyageId:id,choice:'a'},601000),st=c.state.space.voyage.evState;
 assert.equal(st.choice,'a');assert.equal(st.outcome,outcomeFor(id,st.id,'a'));assert.deepEqual(st.reward,{pts:rewardPoints(st.id,'a',st.outcome)});assert.equal(c.state.space.pts,0,'choosing pays nothing');
 for(const choice of ['a','b']){const again=planMoon(c.state,{type:'choose',voyageId:id,choice},opt(602000));assert(again.ok&&again.noop);assert.equal(again.code,'SPACE_EV_ALREADY_CHOSEN');}
 for(const bad of [{type:'choose',voyageId:id,choice:'c'},{type:'choose',voyageId:id,choice:'a',outcome:'success'},{type:'choose',voyageId:id,choice:'a',pts:99}])assert.equal(planMoon(d.state,bad,opt(601000)).code,'SPACE_INTENT_INVALID');
});
test('no double reward: claim pays evState reward once together with the return report; repeat/stale/late choose are noops',()=>{
 for(const choice of ['a','b']){const {d,id}=departed();const c=go(d.state,{type:'choose',voyageId:id,choice},601000),want=c.state.space.voyage.evState.reward.pts;
  const k=go(c.state,{type:'claim',voyageId:id},601500),s=k.state.space,r=s.moonLoop.lastReceipt;
  assert.equal(s.pts,want);assert.equal(r.points,want);assert.equal(r.ev,c.state.space.voyage.ev);assert.equal(r.choice,choice);assert.equal(r.outcome,c.state.space.voyage.evState.outcome);assert.equal(s.visits.moon,1);assert(s.voyage.completed);
  const again=planMoon(k.state,{type:'claim',voyageId:id},opt(602000));assert(again.ok&&again.noop);
  const late=planMoon(k.state,{type:'choose',voyageId:id,choice:choice==='a'?'b':'a'},opt(602000));assert(late.ok&&late.noop&&late.stale);
  const next=go(k.state,{type:'depart',route:'moon'},603000,'22222222-2222-4222-8222-222222222222');assert.equal(next.state.space.voyage.evState.choice,null,'old evState not carried over');assert.equal(next.state.space.pts,want);
  assert(planMoon(next.state,{type:'claim',voyageId:id},opt(9e9)).noop,'old ID cannot claim the new voyage');}
});
test('outcomes/points follow 星途-07 numbers: A success 12 / fail 6; B per event (照常 8 / 少拿一点 7); A is roughly 六成',()=>{
 for(const id of EVENT_POOL){assert.equal(rewardPoints(id,'a','success'),12);assert.equal(rewardPoints(id,'a','fail'),6);assert(['照常','什么也不发生'].some(w=>EVENTS[id].b.hint.includes(w))?EVENTS[id].b.pts===8:EVENTS[id].b.pts===7,id);assert.equal(outcomeFor('x',id,'b'),'success');}
 let ok=0;for(let i=1;i<=2000;i++)if(outcomeFor(`moon:formal:${i}:11111111-1111-4111-8111-111111111111`,'ev_pirates','a')==='success')ok++;assert(ok>1000&&ok<1400,String(ok));
});
test('receipt/voyage compatibility: any tampering of ev/choice/outcome/points/evState is read-only protection, never repaired',()=>{
 const {d,id}=departed();const c=go(d.state,{type:'choose',voyageId:id,choice:'a'},601000),k=go(c.state,{type:'claim',voyageId:id},601500);
 const flip=o=>o==='success'?'fail':'success';
 const cases=[
  [c.state,s=>{s.space.voyage.evState.outcome=flip(s.space.voyage.evState.outcome);s.space.voyage.evState.reward.pts=rewardPoints(s.space.voyage.ev,'a',s.space.voyage.evState.outcome);},'SPACE_VOYAGE_COMPATIBILITY'],
  [c.state,s=>{s.space.voyage.evState.reward.pts=99;},'SPACE_VOYAGE_COMPATIBILITY'],
  [d.state,s=>{delete s.space.voyage.evState;},'SPACE_VOYAGE_COMPATIBILITY'],
  [d.state,s=>{s.space.voyage.ev='ev_future_thing';s.space.voyage.evState.id='ev_future_thing';},'SPACE_VOYAGE_COMPATIBILITY'],
  [d.state,s=>{s.space.voyage.ruleset=MOON_RULES.id;},'SPACE_VOYAGE_COMPATIBILITY'],
  [k.state,s=>{s.space.moonLoop.lastReceipt.points+=1;},'SPACE_RECEIPT_COMPATIBILITY'],
  [k.state,s=>{s.space.moonLoop.lastReceipt.outcome=flip(s.space.moonLoop.lastReceipt.outcome);},'SPACE_RECEIPT_COMPATIBILITY'],
  [k.state,s=>{delete s.space.moonLoop.lastReceipt.ev;},'SPACE_RECEIPT_COMPATIBILITY'],
  [k.state,s=>{s.space.moonLoop.lastReceipt.ruleset=MOON_RULES.id;},'SPACE_RECEIPT_COMPATIBILITY'],
  [k.state,s=>{const e=EVENT_POOL.find(x=>x!==s.space.moonLoop.lastReceipt.ev);s.space.moonLoop.lastReceipt.ev=e;},null],
  [k.state,s=>{s.space.voyage.evState.choice='b';},'SPACE_VOYAGE_COMPATIBILITY'],
 ];
 for(const [base,mut,code] of cases){const s=copy(base);mut(s);const raw=JSON.stringify(s),v=moonView(s,{scope:'formal',now:700000});assert(!v.ok,mut.toString());if(code)assert.equal(v.code,code,mut.toString());assert.equal(JSON.stringify(s),raw);
  for(const i of [{type:'claim',voyageId:id},{type:'choose',voyageId:id,choice:'b'},{type:'depart',route:'moon'}])assert(!planMoon(s,i,opt(700000)).ok);}
 assert.equal(moonView(c.state,{scope:'formal',now:600500}).code,'SPACE_TIME_BACKWARDS','clock before stored choice');
});
