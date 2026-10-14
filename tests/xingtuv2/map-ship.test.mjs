// 星途 v2 第一批（杨总 22:27 / 王大妈 22:30）：星图 5 圈 9 航线、出航需要四个岗位科研、飞船四舱——只读，不写档。
import test from 'node:test';import assert from 'node:assert/strict';
import {gate,needOf,routeOf,RING_MIN,RING_SUM} from '../../space/xingtu-views.mjs';
import {DEMO_ROUTES,LV_COST} from '../../space/xingtu-art.mjs';
import {assembly,until} from '../wearables8/production-harness.mjs';
const lv=(tech,war,med,life)=>({lv:{tech,war,med,life}});
test('9 条航线 5 圈，数值照 demo',()=>{
  assert.deepEqual(DEMO_ROUTES.map(r=>r.id),['moon','station','mars','venus','belt','pirate','europa','saturn','signal']);
  assert.deepEqual(DEMO_ROUTES.map(r=>r.ring),[0,0,1,1,2,2,3,3,4]);
  assert.deepEqual(RING_MIN,[1,2,3,4,4]);assert.deepEqual(RING_SUM,[4,7,11,15,19]);assert.deepEqual(LV_COST,[20,60,150,400]);
});
test('四岗科研 + 合计 + 短板：火星要四岗都≥2、合计≥7、科技≥2',()=>{
  assert.equal(gate(lv(1,1,1,1),'moon').ok,true);
  assert.equal(gate(lv(2,2,2,1),'mars').ok,false);assert.equal(gate(lv(2,2,2,1),'mars').lack,'厨房（77）科研 Lv2');
  assert.equal(gate(lv(2,2,2,2),'mars').ok,true);assert.equal(gate(lv(1,3,3,3),'mars').lack,'舰桥（火箭老板）科研 Lv2');
});
test('火星合计规则',()=>{
  assert.equal(gate(lv(3,2,2,2),'mars').ok,true);assert.equal(gate(lv(2,2,2,2),'mars').sumOk,true);
  assert.equal(needOf(routeOf('mars'),'tech'),2);assert.equal(needOf(routeOf('belt'),'life'),3);assert.equal(needOf(routeOf('signal'),'war'),4);
  assert.equal(gate(lv(4,4,4,4),'europa').ok,true);assert.equal(gate(lv(4,4,4,3),'europa').lack,'厨房（77）科研 Lv4');
  assert.equal(gate(lv(2,2,1,2),'venus').lack,'医务室（珍珠姐）科研 Lv2');
});
for(const scope of ['formal','preview'])test(scope+'：星图/飞船页签只读，月面照常能出航',{timeout:20000},async t=>{
  const h=await assembly({scope,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}f.data.set(f.keys.main,JSON.stringify(s));}});
  t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');
  const m=h.context.XingTu;assert(m.open().ok);const w=h.writes().length;
  await h.click('xingtuTabMap');assert(h.node('xingtuRouteDetail'));assert.equal(h.node('xingtuLaunch').textContent,'出航 →');assert.equal(h.node('xingtuLack'),null);
  await h.click('xingtuTabShip');assert(h.node('xingtuShip'));assert.equal(h.node('xingtuUpgrade').disabled,true);
  assert.equal(h.writes().length,w,'星图/飞船不写档');assert.equal(m.isOpen(),true);
  await h.click('xingtuTabVoyage');assert.equal(h.node('xingtuDepart').disabled,false);const r=await h.click('xingtuDepart');assert(r?.ok!==false);assert(h.node('xingtuRemaining'));
});
