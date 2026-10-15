import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
import {prepareSecondEightCatalog} from '../../collectibles/wearables18-catalog.mjs';
import {prepareDecor6Catalog} from '../../collectibles/decor6-catalog.mjs';
import {prepareBox200Catalog,liveItems,LIVE_BATCHES} from '../../collectibles/box200-catalog.mjs';
import {BOX200_ITEMS} from '../../collectibles/box200-items.mjs';
import {BOX200_COPY,COPY_STATUS} from '../../collectibles/box200-copy.mjs';
import {wrapWearables,wrapDecor,artURL} from '../../collectibles/box200-display.mjs';
import second from '../../candidates/blindbox18/display.mjs';
import decor6 from '../../collectibles/decor6-display.mjs';
const require=createRequire(import.meta.url),econ=new URL('../../economy.js',import.meta.url).pathname;
const LIVE=liveItems().map(x=>x.id),LIVE_REG=liveItems().filter(x=>!x.hidden),LIVE_HID=liveItems().filter(x=>x.hidden);
const B83=['c_lotus_slice_smock','c_cumin_dot_poncho','c_beer_foam_overall','c_lantern_rib_coat','h_garlic_bulb','h_tofu_block','h_eggplant_cap','h_ember_band'];
function fresh(){delete require.cache[require.resolve(econ)];const E=require(econ);prepareEightWearableCatalog(E).setActive(true);prepareSecondEightCatalog(E).setActive(true);prepareDecor6Catalog(E).setActive(true);return E;}
function full(E){const s=E.newState(Date.UTC(2026,9,14,0));s.shops.forEach(x=>{x.open=true;x.emp=1;x.lv=10;});s.coins=1e15;return s;}
test('142 new items: unique IDs, no collision with the 58, ID convention, 200 total, copy for every ID in one file',()=>{
  const E=fresh(),ids=BOX200_ITEMS.map(x=>x.id);assert.equal(ids.length,142);assert.equal(new Set(ids).size,142);
  for(const id of ids){assert(!Object.hasOwn(E.ITEM_BY_ID,id),id);assert.match(id,/^[chd]_[a-z0-9]+(_[a-z0-9]+)*$/);assert.equal(id[0],{clothes:'c',hat:'h',decor:'d'}[BOX200_ITEMS.find(x=>x.id===id).type]);assert(BOX200_COPY[id]?.name,id);}
  assert.equal(E.ITEMS.length+142,200);assert.equal(COPY_STATUS,'provisional');assert.equal(Object.keys(BOX200_COPY).length,142);
});
test('盲盒-83 + box200 live batches: only LIVE_BATCHES admitted, 58→58+live; not-live items stay out until art',()=>{
  assert.equal(LIVE_BATCHES[0],'盲盒-83');for(const id of B83)assert(LIVE.includes(id));const E=fresh(),r=prepareBox200Catalog(E);r.setActive(true);
  assert.deepEqual(r.items.map(x=>x.id),LIVE);assert.equal(E.ITEMS.length,58+LIVE.length);assert.equal(E.REGULAR_ITEMS.length,52+LIVE_REG.length);
  for(const id of LIVE)assert.equal(E.ITEM_BY_ID[id].name,BOX200_COPY[id].name);
  for(const x of BOX200_ITEMS)if(!LIVE.includes(x.id))assert(!Object.hasOwn(E.ITEM_BY_ID,x.id),x.id);
  r.setActive(false);assert.equal(E.ITEMS.length,58);assert.equal(E.REGULAR_ITEMS.length,52);for(const id of LIVE)assert(!Object.hasOwn(E.ITEM_BY_ID,id));
  assert.throws(()=>prepareBox200Catalog(E),/BOX200_BASELINE_MISMATCH/);
});
test('live art: every live item has a 512x512 PNG; every art path is art/collectibles/box200/<ID>.png',()=>{
  for(const id of LIVE_REG.map(x=>x.id)){const b=fs.readFileSync(new URL('../../art/collectibles/box200/'+id+'.png',import.meta.url));assert.equal(b.toString('latin1',1,4),'PNG');assert.equal(b.readUInt32BE(16),512);assert.equal(b.readUInt32BE(20),512);}
  for(const x of BOX200_ITEMS)assert(new URL(artURL(x.id)).pathname.endsWith('/art/collectibles/box200/'+x.id+'.png'));
});
test('rules kept with all live items: 5 per game day, 06:00 JST reset, no duplicates, no cost on 6th',()=>{
  const E=fresh();prepareBox200Catalog(E).setActive(true);const s=full(E),t0=Date.UTC(2026,9,13,22);// 07:00 JST
  for(let i=0;i<5;i++)assert(E.gachaDraw(s,(i*.17+.31)%1,undefined,t0+i).ok);const c=s.coins;const r=E.gachaDraw(s,.5,undefined,t0+9);assert(!r.ok&&r.dailyLimit);assert.equal(s.coins,c);
  assert(!E.gachaDraw(s,.5,undefined,Date.UTC(2026,9,14,20,59)).ok,'05:59 JST next day still same game day');
  assert(E.gachaDraw(s,.5,undefined,Date.UTC(2026,9,14,21,0)).ok,'06:00 JST resets');
  const t=E.newState(1);t.shops.forEach(x=>{x.open=true;x.emp=1;});t.coins=1e15;const seen=new Set();while(E.gachaRemaining(t).length){const q=E.gachaDraw(t,Math.random());assert(q.ok&&!seen.has(q.item.id));seen.add(q.item.id);}
  assert.equal(seen.size,58-2-(E.STORY_COND_IDS||[]).length+LIVE_REG.length);for(const x of LIVE_REG)if(!seen.has(x.id))assert.fail(x.id);for(const id of B83)assert(seen.has(id));
});
test('盲盒-109: no hidden bonus drop — box opens never yield hidden items, gachaDraw untouched, even with every batch live',()=>{
  const E=fresh(),orig=E.gachaDraw;prepareBox200Catalog(E).setActive(true);assert.equal(E.gachaDraw,orig);
  const all=[...new Set(BOX200_ITEMS.map(x=>x.batch))],H=fresh(),o2=H.gachaDraw;const reg=prepareBox200Catalog(H,{batches:all});reg.setActive(true);assert.equal(H.gachaDraw,o2);
  assert.equal(H.ITEMS.length,200);assert.equal(H.REGULAR_ITEMS.length,52+136);assert.equal(H.gachaRemaining(full(H)).length,200-2-6-(H.STORY_COND_IDS||[]).length,'hidden never in normal pool');
  const s=full(H);for(let i=0;i<150;i++){const r=H.gachaDraw(s,(i*0.6180339887)%1);assert(r.ok);assert(!r.bonus);}
  const own=s.gacha.owned;assert.equal(new Set(own).size,own.length);assert.equal(own.filter(id=>H.ITEM_BY_ID[id]?.hidden).length,0);
  reg.setActive(false);assert.equal(H.ITEMS.length,58);
});
test('display: owned 83 items render box200 PNG icon, unowned ❓, equip survives only when owned; decor wrap falls through',()=>{
  const E=fresh();prepareBox200Catalog(E).setActive(true);const W=wrapWearables(second),D=wrapDecor(decor6),s=full(E);
  assert.equal(W.version,second.version);for(const id of B83){assert(W.has(id));assert(W.iconHTML(E,s,id).includes('❓'));}
  s.gacha.owned.push('h_garlic_bulb','c_beer_foam_overall');s.wear.c77={hat:'h_garlic_bulb',clothes:'c_beer_foam_overall'};
  assert(W.iconHTML(E,s,'h_garlic_bulb').includes('art/collectibles/box200/h_garlic_bulb.png?v=xingtu02-20261015-r1'));
  assert.deepEqual(W.equipment(E,s,'c77'),{...W.equipment(E,s,'c77'),hat:'h_garlic_bulb',clothes:'c_beer_foam_overall'});
  s.wear.pearl={hat:'h_tofu_block'};assert.equal(W.equipment(E,s,'pearl').hat,null);
  assert(D.has('d_charcoal_chime'));assert(!D.has('h_garlic_bulb'));assert(W.has('c_skewer_loop_tunic'));
});
