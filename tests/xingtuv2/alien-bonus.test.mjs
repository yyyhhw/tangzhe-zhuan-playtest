// 星途 v2-C（候选）：外星剧情卡每张让四家店产速永久 +25%，在线和离线都算；只认册子里真正发到的外星卡（各航线第 3 张）。
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {ROUTES} from '../../space/album.mjs';
const require=createRequire(import.meta.url);
for(const p of ['economy.js','pet/game/economy.js','preview/economy.js'])test(p+'：+25%/张，在线离线一致，旧字段 alienCards 不算',()=>{
  const E=require('../../'+p);const st=E.newState(1);for(const s of st.shops){s.open=true;s.lv=40;s.emp=Math.max(1,s.emp||1);}
  const base=E.baseRate(st),off=E.offlineRate(st),on=E.onlineRate(st,1);assert(base>0);
  st.space={cards:{},alienCards:9};assert.equal(E.alienCount(st),0);assert.equal(E.baseRate(st),base,'旧字段 alienCards 不加成');
  st.space.cards={mars:3,venus:2,belt:3};assert.equal(E.alienCount(st),2);
  assert(Math.abs(E.baseRate(st)-base*1.5)<1e-6*base);assert(Math.abs(E.offlineRate(st)-off*1.5)<1e-6*off);assert(Math.abs(E.onlineRate(st,1)-on*1.5)<1e-6*on);
  for(let i=0;i<4;i++)assert(Math.abs(E.shopRate(st,i)-E.shopRate({...st,space:null},i)*1.5)<1e-6*Math.max(1,E.shopRate(st,i)),'四家店都加');
  st.space.cards={mars:3,venus:3,belt:3,pirate:3,europa:3,saturn:3,moon:3,station:3};assert.equal(E.alienCount(st),6);assert(Math.abs(E.baseRate(st)-base*2.5)<1e-6*base);
  st.space.cards={mars:'3',venus:-1};assert.equal(E.alienCount(st),0,'坏值不加成');
});
test('经济里的外星航线 = 册子里外星卡所在的航线（第 3 张）',()=>{
  const alien=ROUTES.filter(r=>r.cards.some(c=>c.alien));assert.deepEqual(alien.map(r=>r.id),['mars','venus','belt','pirate','europa','saturn','signal']);
  for(const r of alien)assert.equal(r.cards.findIndex(c=>c.alien),r.id==='signal'?0:2,r.id);
});
// 杨总 10-15 01:30：第 7 张外星卡 =「回信」（signal 第 1 张），集齐 ×2.75
import {ROUTES as R7,ALIEN_DENOM as D7} from '../../space/album.mjs';
for(const p of ['economy.js','pet/game/economy.js','preview/economy.js'])test(p+'：第 7 张「回信」算外星卡，集齐 ×2.75',async()=>{
  const {createRequire}=await import('node:module');const E=createRequire(import.meta.url)('../../'+p);
  const st=E.newState(1);for(const s of st.shops){s.open=true;s.lv=40;s.emp=Math.max(1,s.emp||1);}const base=E.baseRate(st),off=E.offlineRate(st);assert(base>0&&off>0);
  st.space={cards:{mars:3,venus:3,belt:3,pirate:3,europa:3,saturn:3,signal:1}};assert.equal(E.alienCount(st),7);
  assert(Math.abs(E.baseRate(st)-base*2.75)<1e-6*base);assert(Math.abs(E.offlineRate(st)-off*2.75)<1e-6*off);
  st.space.cards.signal=0;assert.equal(E.alienCount(st),6);
  assert.equal(D7,7);assert.equal(R7.find(r=>r.id==='signal').cards[0].alien,true);
});
