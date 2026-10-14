// 杨总 22:07：航程飞行中点「册子」，1 秒刷新走「签名没变」分支去改出航页的剩余时间元素（册子页没有）→ 抛错 → render 兜底 host.close()，星途被关。
import test from 'node:test';import assert from 'node:assert/strict';
import {assembly,until} from '../wearables8/production-harness.mjs';
for(const scope of ['formal','preview'])test(scope+'：飞行中切到册子并刷新，星途不关、不写档；切回出航剩余时间照常走',{timeout:20000},async t=>{
  const h=await assembly({scope,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}f.data.set(f.keys.main,JSON.stringify(s));}});
  t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');
  let time=1700000001000;h.context.Date.now=()=>time;const m=h.context.XingTu;assert(m.open().ok);
  await h.click('xingtuDepart');assert(h.node('xingtuRemaining'));
  await h.click('xingtuTabAlbum');assert(h.node('xingtuAlbumHead'));const writes=h.writes().length;
  for(let i=0;i<3;i++){time+=1000;assert.doesNotThrow(()=>m.refresh());}
  assert.equal(m.isOpen(),true,'星途还开着');assert(h.node('xingtuAlbumHead'),'还在册子页');assert.equal(h.writes().length,writes,'刷新不写档');
  await h.click('xingtuTabVoyage');time+=1000;m.refresh();assert.match(h.node('xingtuRemaining').textContent,/^剩余 /);assert.equal(m.isOpen(),true);
});
