import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
import {prepareDecor6Catalog} from '../../collectibles/decor6-catalog.mjs';
import {prepareSecondEightCatalog,SECOND_EIGHT_WEARABLES} from '../../collectibles/wearables18-catalog.mjs';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
const require=createRequire(import.meta.url);
for(const scope of ['formal','preview']){
 test(scope+': one ordered admission produces 58 catalog / 56 random / 52 ordinary; exact rollback',()=>{
  const path=new URL('../../'+(scope==='formal'?'':'preview/')+'economy.js',import.meta.url).pathname;delete require.cache[require.resolve(path)];const E=require(path),a=prepareEightWearableCatalog(E);a.setActive(true);const b=prepareDecor6Catalog(E);b.setActive(true);const previous=E.ITEMS.slice(),c=prepareSecondEightCatalog(E);c.setActive(true);assert.equal(E.ITEMS.length,58);assert.equal(E.REGULAR_ITEMS.length,52);const s=E.newState(1);s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});s.coins=5000000;s.totalEarned=5000000;s.gacha.owned=previous.map(x=>x.id);s.gacha.draws=48;
  assert.equal(E.gachaOdds(E.newState(1)).perReg,.9/52);assert.equal(E.gachaRemaining(s).length,8);
  for(const item of SECOND_EIGHT_WEARABLES){const r=E.gachaDraw(s,0);assert(r.ok);assert.equal(r.item.id,item.id);assert.equal(r.cost,200000);s.wear.c77[item.type]=item.id;assert.equal(E.migrate(s,1).st.wear.c77[item.type],item.id);}
  assert.equal(s.coins,3400000);assert.equal(s.gacha.draws,56);assert(E.gachaComplete(s));c.setActive(false);assert.deepEqual(E.ITEMS,previous);b.setActive(false);a.setActive(false);assert.equal(E.ITEMS.length,36);
 });
 test(scope+': all eight draw/equip/save through actual production coordinator and survive restart with opaque state',async t=>{
  const h=await assembly({scope,protocol:2});t.after(()=>h.close());await until(()=>h.app||h.settled,'app');assert.equal(h.bootError,null);const original=h.data.get(h.t.keys.original),snapshot=h.data.get(`tangzhe-${scope}-collectibles-v2-original`);
  assert(h.app.atomic(()=>{h.app.state.coins+=10000000;return {ok:true};},'synthetic funds').ok);
  const got=[];while(h.initialE.gachaRemaining(h.app.state).length){const r=h.app.atomic(()=>h.initialE.gachaDraw(h.app.state,0),'draw');assert(r.ok,r.why);got.push(r.item.id);if(SECOND_EIGHT_WEARABLES.some(x=>x.id===r.item.id)){assert(h.app.atomic(()=>{h.app.state.wear.c77[r.item.type]=r.item.id;return {ok:true};},'equip').ok);}}
  for(const item of SECOND_EIGHT_WEARABLES)assert(got.includes(item.id));assert.equal(h.app.state.gacha.owned.length,56);assert(!h.app.state.gacha.owned.includes('d_ward_charm'));assert.deepEqual(copy(h.app.state.collectiblesV1.grants),{});const final=copy(h.app.state),saved=[...h.data];await h.close();
  const re=await assembly({scope,protocol:2,configure:f=>{f.data.clear();for(const [k,v]of saved)f.data.set(k,v);}});t.after(()=>re.close());await until(()=>re.app||re.settled,'reopen');assert.equal(re.bootError,null);assert.deepEqual(copy(re.app.state.gacha),final.gacha);assert.deepEqual(copy(re.app.state.wear),final.wear);assert.equal(re.data.get(h.t.keys.original),original);assert.equal(re.data.get(`tangzhe-${scope}-collectibles-v2-original`),snapshot);assert.deepEqual(copy(re.app.state.customForwardField),final.customForwardField);
 });
}
