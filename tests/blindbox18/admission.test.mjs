import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {prepareEightWearableCatalog,EIGHT_WEARABLES} from '../../qa-protocol2/eight-catalog.mjs';
import {prepareSecondEightCatalog,SECOND_EIGHT_WEARABLES} from '../../collectibles/wearables18-catalog.mjs';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
const require=createRequire(import.meta.url);
for(const scope of ['formal','preview']){
 test(scope+': one ordered admission produces 52 catalog / 52 random / 48 ordinary; exact rollback',()=>{
  const path=new URL('../../'+(scope==='formal'?'':'preview/')+'economy.js',import.meta.url).pathname;delete require.cache[require.resolve(path)];const E=require(path),a=prepareEightWearableCatalog(E);a.setActive(true);const previous=E.ITEMS.slice(),c=prepareSecondEightCatalog(E);c.setActive(true);assert.equal(E.ITEMS.length,52);assert.equal(E.REGULAR_ITEMS.length,48);const s=E.newState(1);s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});s.coins=5000000;s.totalEarned=5000000;s.gacha.owned=previous.map(x=>x.id);s.gacha.draws=44;
  assert.equal(E.gachaOdds(E.newState(1)).perReg,.9/48);assert.equal(E.gachaRemaining(s).length,8);
  for(const item of SECOND_EIGHT_WEARABLES){const r=E.gachaDraw(s,0);assert(r.ok);assert.equal(r.item.id,item.id);assert.equal(r.cost,200000);s.wear.c77[item.type]=item.id;assert.equal(E.migrate(s,1).st.wear.c77[item.type],item.id);}
  assert.equal(s.coins,3400000);assert.equal(s.gacha.draws,52);assert(E.gachaComplete(s));c.setActive(false);assert.deepEqual(E.ITEMS,previous);a.setActive(false);assert.equal(E.ITEMS.length,36);
 });
 test(scope+': all eight draw/equip/save through actual production coordinator and survive restart with opaque state',async t=>{
  const h=await assembly({scope,protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.gacha.owned.push(...EIGHT_WEARABLES.map(x=>x.id));s.gacha.draws=44;s.wear.c77={clothes:'c_charcoal_vest',hat:'h_guokui'};s.gacha.future={keep:[1,'opaque',null]};f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app||h.settled,'app');assert.equal(h.bootError,null);const original=h.data.get(h.t.keys.original),snapshot=h.data.get(`tangzhe-${scope}-collectibles-v2-original`);
  assert.equal(h.app.state.gacha.owned.length,44);assert.equal(h.initialE.gachaRemaining(h.app.state).length,12);assert(h.app.atomic(()=>{h.app.state.coins+=10000000;return {ok:true};},'synthetic funds').ok);
  const got=[];while(h.initialE.gachaRemaining(h.app.state).length){const r=h.app.atomic(()=>h.initialE.gachaDraw(h.app.state,0),'draw');assert(r.ok,r.why);got.push(r.item.id);if(SECOND_EIGHT_WEARABLES.some(x=>x.id===r.item.id)){assert(h.app.atomic(()=>{h.app.state.wear.c77[r.item.type]=r.item.id;return {ok:true};},'equip').ok);}}
  for(const item of SECOND_EIGHT_WEARABLES)assert(got.includes(item.id));assert.equal(h.app.state.gacha.owned.length,56);assert(!h.app.state.gacha.owned.includes('d_ward_charm'));assert.deepEqual(copy(h.app.state.collectiblesV1.grants),{});assert.deepEqual(copy(h.app.state.gacha.future),{keep:[1,'opaque',null]});const final=copy(h.app.state),saved=[...h.data];await h.close();
  const re=await assembly({scope,protocol:2,configure:f=>{f.data.clear();for(const [k,v]of saved)f.data.set(k,v);}});t.after(()=>re.close());await until(()=>re.app||re.settled,'reopen');assert.equal(re.bootError,null);assert.deepEqual(copy(re.app.state.gacha),final.gacha);assert.deepEqual(copy(re.app.state.wear),final.wear);assert.equal(re.data.get(h.t.keys.original),original);assert.equal(re.data.get(`tangzhe-${scope}-collectibles-v2-original`),snapshot);assert.deepEqual(copy(re.app.state.customForwardField),final.customForwardField);
 });
}
for(const scope of ['formal','preview'])test(scope+': on52 pool admits four ordinary decorations and keeps hidden rewards out of random draws',async t=>{
 const h=await assembly({scope,protocol:2});t.after(()=>h.close());await until(()=>h.app||h.settled,'app');assert.equal(h.bootError,null);
 assert.equal(h.app.state.gacha.owned.length,36);assert.equal(h.app.state.gacha.draws,36);
 for(const id of ['d_borrow_register','d_rocket_piggy','d_charcoal_chime','d_spice_turntable'])assert(h.initialE.gachaRemaining(h.app.state).some(x=>x.id===id));
 for(const id of ['d_opening_photo','d_ward_charm'])assert(!h.initialE.gachaRemaining(h.app.state).some(x=>x.id===id));
 const before=JSON.stringify(h.app.state.gacha),result=h.app.atomic(()=>{h.app.state.gacha.owned.push('d_unapproved');return {ok:true};},'negative unknown decoration');
 assert.equal(result.ok,false);assert.equal(JSON.stringify(h.app.state.gacha),before);
});
