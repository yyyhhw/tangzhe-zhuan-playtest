// 星途-04（王大妈 23:13）文字修订：去「◢」、航程按航线、探索点按 routePoints、「科技科研至少 Lv2」、「3 张剧情卡」、emoji 换 SVG、「四岗科研合计」、装饰字 aria-hidden。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ROUTE_TIME,pointRange} from '../../space/xingtu-views.mjs';
test('航程按航线、探索点范围按事件点 × 倍数',()=>{
  assert.equal(ROUTE_TIME.moon,'10 分钟');assert.equal(ROUTE_TIME.station,'30 分钟');assert.equal(ROUTE_TIME.mars,'1 小时');assert.equal(ROUTE_TIME.saturn,'4 小时');
  assert.deepEqual(pointRange('moon'),[6,12]);assert.deepEqual(pointRange('mars'),[15,30]);assert.deepEqual(pointRange('saturn'),[60,120]);
});
test('文案：无 ◢ / emoji；短板写法；张；四岗科研合计；装饰 aria-hidden',()=>{
  const s=fs.readFileSync(new URL('../../space/xingtu-views.mjs',import.meta.url),'utf8');
  for(const bad of ['◢','👽','🔒','（短板）','四人等级合计','≥ $'])assert(!s.includes(bad),bad);
  for(const good of ['科研至少 Lv','张</b>剧情卡','四岗科研合计','class="hudline" aria-hidden="true"','<text aria-hidden="true" '])assert(s.includes(good),good);
});
