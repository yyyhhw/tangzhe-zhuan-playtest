// 星途 v2-A（候选）：科研升级花探索点 + 多航线出航（四岗科研/合计/短板），月面规则不变。
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {moonView,planMoon,MOON_EV_RULES,ROUTE_RULES,LV_COST,routePoints} from '../../space/moon.mjs';
import {rewardPoints} from '../../space/voyage-ev.mjs';
const fresh=(lv,pts=0)=>{const space=defaultSpace();if(lv)space.lv=lv;space.pts=pts;return {rev:1,coins:5,shops:[0,1,2,3].map(()=>({open:true,lv:35})),space};};
let u=0;const uid=()=>`${String(++u%1e8).padStart(8,'0')}-2222-4222-8222-222222222222`;
const plan=(s,i,now)=>planMoon(s,i,{scope:'formal',now,makeId:uid});
const go=(s,i,now)=>{const r=plan(s,i,now);assert(r.ok&&!r.noop,JSON.stringify(r));return r.state;};
const T=1700000000000;
test('科研升级：20/60/150/400 探索点，满 5 级不再扣；不够就拒绝、不写',()=>{
  assert.deepEqual(LV_COST,[20,60,150,400]);
  let s=fresh(null,630);for(const c of [20,60,150,400]){const before=s.space.pts;s=go(s,{type:'upgrade',sys:'med'},T);assert.equal(s.space.pts,before-c);}
  assert.equal(s.space.lv.med,5);assert.equal(s.space.pts,0);
  const max=plan(s,{type:'upgrade',sys:'med'},T);assert(max.ok&&max.noop);assert.equal(max.code,'SPACE_LV_MAX');
  const poor=plan(fresh(null,19),{type:'upgrade',sys:'tech'},T);assert.equal(poor.ok,false);assert.equal(poor.code,'SPACE_PTS_NOT_ENOUGH');
  assert.equal(plan(fresh(null,99),{type:'upgrade',sys:'gold'},T).code,'SPACE_INTENT_INVALID');
});
test('出航需要四个岗位科研：火星四岗都≥2 + 合计≥7 + 科技≥2；不够拒绝',()=>{
  assert.equal(plan(fresh(),{type:'depart',route:'mars'},T).code,'SPACE_POSTS_REQUIRED');
  assert.equal(plan(fresh({tech:3,war:3,med:3,life:1}),{type:'depart',route:'mars'},T).code,'SPACE_POSTS_REQUIRED');
  assert.equal(plan(fresh(),{type:'depart',route:'signal'},T).code,'SPACE_INTENT_INVALID','信号源留给结局批');
  assert.equal(plan(fresh({tech:2,war:2,med:2,life:2}),{type:'depart',route:'belt'},T).code,'SPACE_POSTS_REQUIRED');
});
test('火星一趟：1 小时、事件点×2.5、发火星第 1 张卡、visits.mars+1；回执能被再次校验',()=>{
  let s=go(fresh({tech:2,war:2,med:2,life:2}),{type:'depart',route:'mars'},T);const v=s.space.voyage;
  assert.equal(v.route,'mars');assert.equal(v.dur,3600000);assert.equal(v.ruleset,ROUTE_RULES.id);
  assert.equal(moonView(s,{scope:'formal',now:T+3599999}).phase,'flying');
  s=go(s,{type:'choose',voyageId:v.voyageId,choice:'b'},T+3600000);const pts=s.space.voyage.evState.reward.pts;
  assert.equal(pts,Math.round(rewardPoints(v.ev,'b','success')*2.5));
  s=go(s,{type:'claim',voyageId:v.voyageId},T+3600001);
  assert.equal(s.space.pts,pts);assert.equal(s.space.cards.mars,1);assert.equal(s.space.visits.mars,1);assert.equal(s.space.visits.moon,undefined);
  const r=moonView(s,{scope:'formal',now:T+3600002});assert(r.ok,r.code);assert.equal(r.receipt.route,'mars');assert.equal(r.phase,'report');
  // 篡改：火星回执改成 10 分钟 → 只读保护
  const bad=JSON.parse(JSON.stringify(s));bad.space.moonLoop.lastReceipt.arrival=bad.space.moonLoop.lastReceipt.start+600000;assert.equal(moonView(bad,{scope:'formal',now:T+3600002}).code,'SPACE_RECEIPT_COMPATIBILITY');
  const bad2=JSON.parse(JSON.stringify(s));bad2.space.moonLoop.lastReceipt.ruleset=MOON_EV_RULES.id;assert.equal(moonView(bad2,{scope:'formal',now:T+3600002}).ok,false);
});
test('月面照旧：v2 规则、10 分钟、点数不乘倍数',()=>{
  const s=go(fresh(),{type:'depart',route:'moon'},T);assert.equal(s.space.voyage.ruleset,MOON_EV_RULES.id);assert.equal(s.space.voyage.dur,600000);
  for(const ev of ['ev_pod']) if(rewardPoints(ev,'b','success')!==null)assert.equal(routePoints('moon',ev,'b','success'),rewardPoints(ev,'b','success'));
  assert.deepEqual(ROUTE_RULES.dur,{station:1800000,mars:3600000,venus:3600000,belt:7200000,pirate:7200000,europa:14400000,saturn:14400000});
});
import {assembly,until} from '../wearables8/production-harness.mjs';
for(const scope of ['formal','preview'])test(scope+'：飞船页点升级 → 一笔写，舰桥 Lv2、探索点 -20',{timeout:20000},async t=>{
  const h=await assembly({scope,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}const sp=defaultSpace();sp.pts=25;s.space=sp;f.data.set(f.keys.main,JSON.stringify(s));}});
  t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');
  const m=h.context.XingTu;assert(m.open().ok);await h.click('xingtuTabShip');
  assert.equal(h.node('xingtuUpgrade').disabled,false);const w=h.writes().length;await h.click('xingtuUpgrade');
  assert(h.writes().length>w);const v=m.view();assert.equal(v.space.lv.tech,2);assert.equal(v.space.pts,5);assert.equal(h.node('xingtuUpgrade').disabled,true,'5 点不够 60');
});
