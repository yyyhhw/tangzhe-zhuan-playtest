import test from 'node:test';
import assert from 'node:assert/strict';
import {assembly,until} from '../wearables8/production-harness.mjs';
for(const [scope,path,projectRoot='/'] of [['formal','/'],['formal','/pet/game/'],['preview','/preview/'],['formal','/tangzhe-zhuan-playtest/pet/game/','/tangzhe-zhuan-playtest/']])test(`${path}: earned art only; module-relative URLs; no album writes`,async t=>{
 const h=await assembly({scope,path,projectRoot,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const shop of s.shops){shop.open=true;shop.lv=35;}f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());
 await until(()=>h.context.XingTu||h.errors.length||h.bootError,'host');assert(h.context.XingTu,JSON.stringify(h.errors));
 let now=1700000001000;h.context.Date.now=()=>now;const host=h.context.XingTu;host.open();h.node('xingtuTabAlbum').onclick();
 assert.equal(h.node('xingtuContent').querySelectorAll('img').length,0);
 h.node('xingtuCard-moon-1').onclick();assert.equal(h.node('xingtuCardDetail').querySelector('img'),null);
 h.node('xingtuTabVoyage').onclick();
 for(let n=1;n<=3;n++){
  assert(h.node('xingtuDepart').onclick().ok);now+=601000;host.refresh();assert(h.node('xingtuChoiceB').onclick().ok);
  const reward=h.node('xingtuNewCard').querySelector('img');assert.equal(reward.src,`https://play.example.invalid${projectRoot}art/spacecards/moon_${n}.webp?v=home128-xingtu129-20261015-r1`);assert.equal(reward.width,1024);assert.equal(reward.height,768);
  assert(h.node('xingtuClaim').onclick().ok);const writes=h.writes().length;h.node('xingtuTabAlbum').onclick();
  assert.equal(h.node('xingtuContent').querySelectorAll('img').length,n);
  for(let i=1;i<=3;i++){const b=h.node(`xingtuCard-moon-${i}`);assert.equal(!!b.querySelector('img'),i<=n);b.onclick();assert.equal(!!h.node('xingtuCardDetail').querySelector('img'),i<=n);}
  assert.equal(h.writes().length,writes);// 星途 v2-D：9 条全开航
  h.node('xingtuCard-moon-1').onclick();const img=h.node('xingtuCardDetail').querySelector('img');img.onerror();assert.equal(img.hidden,true);assert.match(h.node('xingtuCardDetail').textContent,/月面第一串/);
  h.node('xingtuTabVoyage').onclick();
 }
});
