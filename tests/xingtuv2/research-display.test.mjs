import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {money,renderShip,renderEarth,ART} from '../../space/xingtu-views.mjs';
import {TIER_PRICE} from '../../space/moon.mjs';
import {defaultSpace} from '../../space/domain.mjs';

const cases=[
 [0,'0','0'],[9.5,'9','10'],[9999.5,'9999','1 万'],
 [10000,'1 万','1 万'],[11500,'1.1 万','1.2 万'],[11968,'1.1 万','1.2 万'],
 [12000,'1.2 万','1.2 万'],[19999,'1.9 万','2 万'],[99999,'9.9 万','10 万'],
 [119995,'11.9 万','12 万'],[1234567,'123.4 万','123.5 万'],
 [99999999,'9999.9 万','1 亿'],[1e8,'1 亿','1 亿'],[100000001,'1 亿','1.1 亿'],
 [1e12-1,'9999.9 亿','1 万亿'],[1e12,'1 万亿','1 万亿'],[1e12+1,'1 万亿','1.1 万亿'],
 [1e15-1,'999.9 万亿','1000 万亿'],[1e15,'1000 万亿','1000 万亿']
];
test('研究台余额向下、价格向上；去尾零，万/亿/万亿跨单位进位',()=>{
 for(const [n,bal,price] of cases){assert.equal(money(n),bal,`balance ${n}`);assert.equal(money(n,true),price,`price ${n}`);}
 assert.deepEqual(TIER_PRICE.map(n=>money(n,true)),['900.1 万','9000.1 万','9.1 亿','90.1 亿','900.1 亿']);
 assert.equal(money(TIER_PRICE.reduce((a,b)=>a+b,0),true),'1000 亿');
});
test('整数步长边界及其两侧：不因浮点误差多进位/少一档，不生成两位小数或 10000 万/亿',()=>{
 for(const unit of [1e4,1e8,1e12])for(const ticks of [10,11,12,29,101,9999,99999]){
  const exact=ticks*(unit/10);if(exact>1e15)continue;
  assert.equal(money(exact),money(exact,true),`exact ${exact}`);
  for(const n of [exact-1,exact,exact+1])for(const up of [false,true]){
   const text=money(n,up),[value,label]=text.split(' '),scale=({'万':1e4,'亿':1e8,'万亿':1e12})[label]??1;
   const [whole,fraction='0']=value.split('.');
   const shown=(BigInt(whole)*10n+BigInt(fraction))*BigInt(scale)/10n;
   assert(up?shown>=BigInt(n):shown<=BigInt(n),`${n} ${up} ${text}`);
   assert.match(text,/^\d+(?:\.\d)?(?: (?:万|亿|万亿))?$/);
   assert.doesNotMatch(text,/\.0(?: |$)|^10000 (?:万|亿)$/);
  }
 }
});
// Minimal DOM: runs the real renderShip and its button handlers, no HTML-source extraction.
class Node {
 constructor(){this.children=[];this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 querySelectorAll(){return [];}
}
const doc={createElement:()=>new Node()};
const find=(n,id)=>n.id===id?n:n.children.map(c=>find(c,id)).find(Boolean);
function ship(room,coins,space=defaultSpace()){
 const root=new Node(),calls=[];
 renderShip(root,{doc,space,room,coins,prices:TIER_PRICE,onRoom:()=>{},research:(...args)=>calls.push(args)});
 return {root,calls,lab:find(root,'xingtuLab')};
}
test('四岗 CEO 标题无多余空格，余额与全部价格采用不同舍入，渲染不修改输入',()=>{
 const space=defaultSpace();for(const k of Object.keys(space.lv))space.lv[k]=5;
 const before=JSON.stringify({space,prices:TIER_PRICE});
 for(const k of ['tech','war','med','life']){
  const {root,lab}=ship(k,11500,space);
  assert.equal(lab.children[0].textContent,`${ART.SYSK[k].ceo}的研究台 · 金币 1.1 万`);
  for(let t=1;t<=5;t++)assert.ok(find(root,`xingtuBuy-${k}-${t}`).textContent.endsWith(`${money(TIER_PRICE[t-1],true)} 金币`));
  assert.equal(lab.children.at(-1).textContent,'这一岗 5 件全买合计 1000 亿 金币');
 }
 assert.equal(JSON.stringify({space,prices:TIER_PRICE}),before);
 assert.equal(ship('tech',null).lab.children[0].textContent,'火箭老板的研究台 · 金币 —');
});
test('差 1 金币/恰好够钱仍按原价控制按钮；等级、已买状态及回调参数不变',()=>{
 const price=TIER_PRICE[0],space=defaultSpace();
 const poor=ship('tech',price-1,space),exact=ship('tech',price,space);
 assert.equal(find(poor.root,'xingtuBuy-tech-1').disabled,true);
 const buy=find(exact.root,'xingtuBuy-tech-1');assert.equal(buy.disabled,false);buy.onclick();
 assert.deepEqual(exact.calls,[['tech',1]]);
 assert.equal(find(exact.root,'xingtuBuy-tech-2').disabled,true);
 space.items['tech:1']=1;
 const owned=find(ship('tech',1e15,space).root,'xingtuBuy-tech-1');
 assert.equal(owned.disabled,true);assert.ok(owned.textContent.startsWith('✓ '));
});
test('地球页保持原显示，不扩展本次研究台修复范围',()=>{
 const root=new Node();renderEarth(root,{doc,space:defaultSpace(),coins:123456789,buy:()=>{}});
 assert.ok(find(root,'xingtuEarth').innerHTML.includes('现在 1.23 亿。'));
});
test('正式/root、pet、preview 共用研究台模块；旧 previewpet 无星途接线',()=>{
 const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
 for(const p of ['index.html','pet/game/index.html','preview/index.html'])assert.match(read(p),/collection\/bootstrap\.mjs/);
 for(const p of ['collection/bootstrap.mjs','preview/collection/bootstrap.mjs'])assert.match(read(p),/collectibles\/entry\.mjs/);
 assert.match(read('collectibles/entry.mjs'),/\.\.\/space\/overlay\.mjs/);
 assert.match(read('space/overlay.mjs'),/\.\/xingtu-views\.mjs/);
 assert.doesNotMatch(read('preview/pet/game/index.html'),/collection\/bootstrap|collectibles\/entry|space\/overlay/);
});
