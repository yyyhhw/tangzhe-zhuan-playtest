// 杨总 2026-10-14 09:12「需要出现星途入口 但是表明还差什么所以进不去」. Node/VM over actual function text.
import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const SHOPS=[{short:'烧烤摊'},{short:'奶茶店'},{short:'漫画书店'},{short:'科技公司'}];
function fn(src,name){const start=src.indexOf('function '+name+'(');assert(start>=0,name);const next=src.indexOf('\nfunction ',start+1);return src.slice(start,next===-1?undefined:next);}
function ctx(file,shops){const src=read(file),toasts=[],opens=[];const c={state:{shops,cur:0},E:{SHOPS},SHOP_ICON:['a','b','c','<tech>'],ZB_SHOP:0,zbCard:()=>'<zb>',tdCard:()=>'<td>',toast:m=>toasts.push(m),window:{XingTu:{open:()=>{opens.push(1);return {ok:true};}}},toasts,opens};vm.createContext(c);
 let code=fn(src,'xingtuMissing')+'\n'+fn(src,'xingtuLockText')+'\n'+fn(src,'xingtuCard');if(src.includes('function shopGameCard('))code+='\n'+fn(src,'shopGameCard');vm.runInContext(code,c);
 const a=src.indexOf("case 'xingtu':"),line=src.slice(a,src.indexOf('\n',a));vm.runInContext('function act(a){switch(a){'+line+'}}',c);return {c,src};}
const fresh=()=>[{open:true,lv:1},{open:false,lv:0},{open:false,lv:0},{open:false,lv:0}];
for(const file of ['app.js','pet/game/app.js']){
 test(file+': entry visible on a fresh save, locked, explains every missing item',()=>{const {c,src}=ctx(file,fresh());
  const pages=c.shopGameCard?[0,1,2,3].map(i=>c.shopGameCard(i)):[0,1,2,3].map(i=>c.xingtuCard(i));
  for(const h of pages){assert(h.includes('data-act="xingtu"'));assert(!/data-act="xingtu"[^>]*disabled/.test(h));assert(h.includes('星途未解锁：还需 烧烤摊 Lv1→35（差34级）、奶茶店 未开店、漫画书店 未开店、科技公司 未开店'));}
  assert(src.includes("'<button class=\"buy no\" disabled>未解锁</button>'}</div>` + xingtuCard(i)"),'unopened shop page also shows entry');
  c.act('xingtu');assert.equal(c.opens.length,0);assert.match(c.toasts[0],/^星途未解锁：还需 /);});
 test(file+': mixed state lists only what is missing',()=>{const {c}=ctx(file,[{open:true,lv:12},{open:true,lv:35},{open:true,lv:40},{open:false,lv:0}]);
  assert.equal(JSON.stringify(c.xingtuMissing(c.state.shops)),JSON.stringify(['烧烤摊 Lv12→35（差23级）','科技公司 未开店']));
  assert(c.xingtuCard(3).includes('星途未解锁：还需 烧烤摊 Lv12→35（差23级）、科技公司 未开店'));
  c.state.shops[3]={open:true,lv:34};assert.equal(JSON.stringify(c.xingtuMissing(c.state.shops)),JSON.stringify(['烧烤摊 Lv12→35（差23级）','科技公司 Lv34→35（差1级）']));});
 test(file+': unlocked behaviour unchanged',()=>{const {c}=ctx(file,[0,1,2,3].map(()=>({open:true,lv:35})));
  const h=c.xingtuCard(3);assert(h.includes('打开星图'));assert(h.includes('全部店铺Lv35解锁'));assert(!h.includes('星途未解锁'));assert(!h.includes('disabled'));
  assert.equal(c.xingtuLockText(),'');c.act('xingtu');assert.equal(c.opens.length,1);assert.equal(c.toasts.length,0);});
}
test('unlock rule in space/host.mjs and moon.mjs unchanged',()=>{assert(read('space/host.mjs').includes("s?.open===true&&s.lv>=35)))return {ok:false,code:'SPACE_TECH_LEVEL_REQUIRED'}"));assert(read('space/moon.mjs').includes('minShopLevel:35'));});
