// 星途 v2-D（候选）：未知信号源（8 小时）→ 收到回信 ended=true → 只能买一次地球（1e15）。
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {planMoon,researchSpend,EARTH_PRICE,ROUTE_RULES} from '../../space/moon.mjs';
const fresh=(coins,lv=4)=>{const space=defaultSpace();space.lv={tech:5,war:5,med:5,life:lv};return {rev:1,coins,shops:[0,1,2,3].map(()=>({open:true,lv:35})),space};};
let u=0;const uid=()=>`${String(++u%1e8).padStart(8,'0')}-3333-4333-8333-333333333333`;
const plan=(s,i,now)=>planMoon(s,i,{scope:'formal',now,makeId:uid});
const go=(s,i,now)=>{const r=plan(s,i,now);assert(r.ok&&!r.noop,JSON.stringify(r));return r.state;};
const T=1700000000000;
test('信号源：四系统都≥4 且合计≥19；8 小时；领完 ended=true、发「回信」',()=>{
  assert.equal(plan(fresh(0,3),{type:'depart',route:'signal'},T).code,'SPACE_POSTS_REQUIRED');
  let s=go(fresh(0),{type:'depart',route:'signal'},T);const v=s.space.voyage;assert.equal(v.dur,ROUTE_RULES.dur.signal);assert.equal(v.dur,28800000);
  s=go(s,{type:'choose',voyageId:v.voyageId,choice:'b'},T+v.dur);s=go(s,{type:'claim',voyageId:v.voyageId},T+v.dur+1);
  assert.equal(s.space.ended,true);assert.equal(s.space.cards.signal,1);assert.equal(s.space.hidden.signal,true);
});
test('买地球：要先收到回信、要 1e15；买一次扣 1e15，再买 noop',()=>{
  assert.equal(EARTH_PRICE,1e15);
  assert.equal(plan(fresh(1e15),{type:'earth'},T).code,'SPACE_ENDING_REQUIRED');
  const e=fresh(1e15-1);e.space.ended=true;assert.equal(plan(e,{type:'earth'},T).code,'SPACE_COINS_NOT_ENOUGH');
  const ok=fresh(1e15);ok.space.ended=true;const s=go(ok,{type:'earth'},T);assert.equal(s.coins,0);assert.equal(s.space.earth,true);
  const again=plan(s,{type:'earth'},T);assert(again.ok&&again.noop);
  assert.equal(researchSpend({items:{},earth:false},{items:{},earth:true}),1e15);assert.equal(researchSpend({items:{},earth:true},{items:{},earth:false}),null);
});
