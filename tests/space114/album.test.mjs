// 星途-114：剧情卡/隐藏物（纯函数 + planMoon）。旧档兼容、第 n 次返航发第 n 张、不重复发、隐藏物一次、篡改只读保护。
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {moonView,planMoon,MOON_RULES} from '../../space/moon.mjs';
import {ROUTES,TOTAL_CARDS,HIDDEN_RULES,awardFor,ALIEN_DENOM} from '../../space/album.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({rev:1,coins:5,shops:[0,1,2,3].map(()=>({open:true,lv:35})),space:defaultSpace()});
let u=0;const uid=()=>`${String(++u%1e8).padStart(8,'0')}-1111-4111-8111-111111111111`;
const go=(s,i,now,extra={})=>{const r=planMoon(s,i,{scope:'formal',now,makeId:uid,...extra});assert(r.ok,JSON.stringify(r));return r.state;};
function trip(s,t,extra){s=go(s,{type:'depart',route:'moon'},t,extra);const id=s.space.voyage.voyageId;s=go(s,{type:'choose',voyageId:id,choice:'b'},t+600000,extra);const v=moonView(s,{scope:'formal',now:t+600000});s=go(s,{type:'claim',voyageId:id},t+600001,extra);return {s,id,preview:v.award};}
test('copy: 25 cards / 9 hidden from 星途-08; alien prefix stripped for display; no 产速 text anywhere',async()=>{
 assert.equal(TOTAL_CARDS,25);assert.equal(ROUTES.length,9);assert.equal(ROUTES.flatMap(r=>r.cards).filter(c=>c.alien).length,ALIEN_DENOM);
 for(const c of ROUTES.flatMap(r=>r.cards)){assert(!c.title.startsWith('外星来客'));assert(c.title.length<=12,c.title);assert(c.text.length<=40,c.text);}
 assert.equal(ROUTES[0].cards[0].title,'月面第一串');assert.equal(ROUTES[4].hid.name,'会哼歌的石头');assert.equal(ROUTES[8].hid.name,'回信的信封');
 const {readFileSync}=await import('node:fs');// 星途 v2-C（星途-09）上线：外星卡写「四家店产速永久 +25%」，只许出现在 overlay 的外星卡标签里
 for(const f of ['space/album.mjs'])assert(!/产速/.test(readFileSync(new URL('../../'+f,import.meta.url),'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'')),f);
});
test('nth moon return → story card n (1,2,3), then nothing more; preview == what claim writes; same write as points+receipt',()=>{
 let s=fresh(),t=1000;for(const n of [1,2,3,null,null]){const r=trip(s,t);assert.equal(r.preview.card,n);const sp=r.s.space;assert.equal(sp.cards.moon??0,n??3);assert.equal(sp.moonLoop.lastReceipt.card,n);assert.equal(sp.moonLoop.lastReceipt.hidden,null);assert.equal(sp.alienCards,0);s=r.s;t+=700000;}
 assert.equal(s.space.visits.moon,5);
});
test('old saves: no space / 113 v2 receipt without card keys / many old visits → load read-only, next claim gives card 1 (no retro grant, no write on read)',()=>{
 const s0=fresh();delete s0.space;assert(moonView(s0,{scope:'formal',now:5}).ok);
 const a=trip(fresh(),1000).s;const old=copy(a);delete old.space.moonLoop.lastReceipt.card;delete old.space.moonLoop.lastReceipt.hidden;old.space.cards={};old.space.visits.moon=7;
 const raw=JSON.stringify(old),v=moonView(old,{scope:'formal',now:700000});assert(v.ok,v.code);assert.equal(JSON.stringify(old),raw);
 const b=trip(old,800000);assert.equal(b.s.space.cards.moon,1);assert.equal(b.s.space.visits.moon,8);
 const v1=fresh(),vid='moon:formal:1:12345678-1234-4234-8234-123456789abc';v1.space.voyage={route:'moon',start:1000,dur:600000,ev:null,voyageId:vid,sequence:1,ruleset:MOON_RULES.id,completed:false};v1.space.moonLoop={schemaVersion:1,sequence:1,claimed:0,lastReceipt:null};
 assert.equal(moonView(v1,{scope:'formal',now:601000}).award.card,1);const c=go(v1,{type:'claim',voyageId:vid},601000);assert.equal(c.space.pts,8);assert.equal(c.space.cards.moon,1);assert.equal(c.space.moonLoop.lastReceipt.card,1);
});
test('no double award: repeat/stale claim noop; cards/hidden/pts unchanged',()=>{
 const {s,id}=trip(fresh(),1000,{hiddenRules:{moon:()=>true}});const raw=JSON.stringify(s.space);
 for(const now of [700000,9e9]){const r=planMoon(s,{type:'claim',voyageId:id},{scope:'formal',now,makeId:uid,hiddenRules:{moon:()=>true}});assert(r.ok&&r.noop);}
 assert.equal(JSON.stringify(s.space),raw);
});
test('hidden item: given only when its rule holds, only once; before that only the clue exists; default moon rule (radar, 星途-06) never fires now',()=>{
 assert.equal(HIDDEN_RULES.moon(fresh().space),false);assert.equal(awardFor(fresh().space,'moon').hidden,null);
 const yes={moon:()=>true};const a=trip(fresh(),1000,{hiddenRules:yes});assert.equal(a.s.space.hidden.moon,true);assert.equal(a.s.space.moonLoop.lastReceipt.hidden,'moon');assert.equal(awardFor(fresh().space,'moon',yes).hidden,'moon');
 const b=trip(a.s,800000,{hiddenRules:yes});assert.equal(awardFor(a.s.space,'moon',yes).hidden,null);assert.equal(b.s.space.moonLoop.lastReceipt.hidden,null,'second time nothing');assert.equal(b.s.space.hidden.moon,true);
 const noisy={moon:()=>1};assert.equal(awardFor(fresh().space,'moon',noisy).hidden,null,'only strict true counts');
});
test('tampering is read-only protection, never repaired',()=>{
 const {s}=trip(fresh(),1000);const cases=[
  [x=>{x.space.cards.moon=4;},'SPACE_ALBUM_COMPATIBILITY'],
  [x=>{x.space.cards.mars=3;},'SPACE_ALBUM_COMPATIBILITY'],// 外星卡在册却 alienCards=0
  [x=>{x.space.moonLoop.lastReceipt.card=3;},'SPACE_RECEIPT_COMPATIBILITY'],
  [x=>{x.space.moonLoop.lastReceipt.card=0;},'SPACE_RECEIPT_COMPATIBILITY'],
  [x=>{x.space.moonLoop.lastReceipt.hidden='moon';},'SPACE_RECEIPT_COMPATIBILITY'],
  [x=>{x.space.moonLoop.lastReceipt.hidden='mars';x.space.hidden.mars=true;},'SPACE_RECEIPT_COMPATIBILITY'],
  [x=>{delete x.space.moonLoop.lastReceipt.hidden;},'SPACE_RECEIPT_COMPATIBILITY'],
  [x=>{x.space.moonLoop.lastReceipt.extra=1;},'SPACE_RECEIPT_COMPATIBILITY'],
 ];
 for(const [m,code] of cases){const x=copy(s);m(x);const raw=JSON.stringify(x),v=moonView(x,{scope:'formal',now:700000});assert.equal(v.code,code,m.toString());assert.equal(JSON.stringify(x),raw);assert(!planMoon(x,{type:'depart',route:'moon'},{scope:'formal',now:700000,makeId:uid}).ok);}
 const ok=copy(s);ok.space.cards.mars=3;ok.space.alienCards=1;assert(moonView(ok,{scope:'formal',now:700000}).ok,'consistent foreign-route data is preserved');
});
