// 星途 v2-D（候选）：未知信号源（8 小时）→ 收到回信 ended=true → 只能买一次地球（1e13，杨总 10-15 09:34 由 1e15 改）。
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
test('买地球：要先收到回信、要 1e13；买一次扣 1e13，再买 noop',()=>{
  assert.equal(EARTH_PRICE,1e13);
  assert.equal(plan(fresh(1e13),{type:'earth'},T).code,'SPACE_ENDING_REQUIRED');
  const e=fresh(1e13-1);e.space.ended=true;assert.equal(plan(e,{type:'earth'},T).code,'SPACE_COINS_NOT_ENOUGH');
  const ok=fresh(1e13);ok.space.ended=true;const s=go(ok,{type:'earth'},T);assert.equal(s.coins,0);assert.equal(s.space.earth,true);
  const again=plan(s,{type:'earth'},T);assert(again.ok&&again.noop);
  assert.equal(researchSpend({items:{},earth:false},{items:{},earth:true}),1e13);assert.equal(researchSpend({items:{},earth:true},{items:{},earth:false}),null);
});
// 自验 01:5x 发现：制作手记页用 A.CAST，xingtu-art 没导出 → 浏览器里点「看制作手记」报错。锁住 views 用到的 A.* 都有导出。
test('xingtu-views 用到的 ART 字段都从 xingtu-art 导出',async()=>{
  const fs=await import('node:fs');const A=await import('../../space/xingtu-art.mjs');
  const src=fs.readFileSync(new URL('../../space/xingtu-views.mjs',import.meta.url),'utf8');
  for(const k of new Set([...src.matchAll(/\bA\.([A-Za-z_][A-Za-z0-9_]*)/g)].map(m=>m[1])))assert.notEqual(A[k],undefined,'A.'+k);
  assert(Array.isArray(A.CAST)&&A.CAST.length>0);
});
// 杨总 2026-10-15 09:34：买下地球 10 万亿（1e13）。界面文案、views 常量与 moon 一致；金币上限不变；余额多于 1e13 只扣 1e13。
test('买地球 10 万亿：文案/常量一致，余额多出的保留，COIN_CAP 仍 1e15',async()=>{
  const fs=await import('node:fs');const V=fs.readFileSync(new URL('../../space/xingtu-views.mjs',import.meta.url),'utf8');
  assert(V.includes('买下地球 · 10 万亿金币'));assert(V.includes('要 10 万亿金币'));assert(!V.includes('1000 万亿'));assert(V.includes('EARTH_PRICE=1e13'));
  const ok=fresh(3e13+7);ok.space.ended=true;const s=go(ok,{type:'earth'},T);assert.equal(s.coins,2e13+7);
  for(const f of ['economy.js','pet/game/economy.js'])assert(fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8').includes('COIN_CAP: 1e15,'));
});
