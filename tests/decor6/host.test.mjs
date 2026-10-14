import test from 'node:test';import assert from 'node:assert/strict';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
async function app(t,options={}){const h=await assembly({protocol:2,...options});t.after(()=>h.close());await until(()=>h.app||h.settled,'app');assert.equal(h.bootError,null);assert(h.app);return h;}
for(const scope of ['formal','preview']){
 test(scope+': actual production hidden claim persists exactly once; reload retains both grants and raw evidence',async t=>{
  const h=await app(t,{scope}),before=copy(h.app.state),evidence=[...h.data].filter(([key])=>key.endsWith('original'));assert.deepEqual(copy(before.collectiblesV1.grants),{});
  for(const id of ['d_opening_photo','d_ward_charm']){const r=h.runtime.claimHidden(id);assert(r.ok,JSON.stringify(r));const once=copy(h.app.state);assert.equal(once.coins,before.coins);assert.equal(once.gacha.draws,before.gacha.draws);assert.equal(once.gacha.pity,before.gacha.pity);assert.deepEqual(once.gacha.last,before.gacha.last);assert.equal(once.gacha.owned.filter(x=>x===id).length,1);assert.equal(h.runtime.claimHidden(id).code,'HIDDEN_ALREADY_CLAIMED');}
  const claimed=copy(h.app.state);assert.deepEqual([...h.data].filter(([key])=>key.endsWith('original')),evidence);assert.equal(h.app.persist(),true);await h.close();
  const re=await app(t,{scope,configure:f=>{f.data.clear();for(const [k,v]of h.data)f.data.set(k,v);}});assert.deepEqual(copy(re.app.state.collectiblesV1),claimed.collectiblesV1);assert.deepEqual(copy(re.app.state.gacha),claimed.gacha);assert.equal(re.runtime.claimHidden('d_ward_charm').code,'HIDDEN_ALREADY_CLAIMED');
 });
 test(scope+': general gameplay commit cannot forge hidden ownership or receipts',async t=>{
  const h=await app(t,{scope}),before=h.data.get(h.t.keys.main),next=copy(h.app.state);next.gacha.owned.push('d_ward_charm');h.app.state=next;assert.equal(h.app.persist(),false);assert.equal(h.data.get(h.t.keys.main),before);
 });
 test(scope+': old 52 ownership and opaque nested data survive activation without random giveaways',async t=>{
  const ids=['c_charcoal_vest','c_matcha_knit','c_ember_fan_mantle','c_grill_grid_tabard','h_guokui','h_antenna_clip','h_skewer_pinwheel','h_mushroom_parasol','c_skewer_loop_tunic','c_smoke_split_bolero','c_pepper_scale_wrap','c_corn_rib_jacket','h_charcoal_crescent','h_grill_press','h_tin_foil_puff','h_corn_sail'];
  const h=await app(t,{scope,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.gacha.owned.push(...ids);s.gacha.draws=52;s.gacha.future={raw:['keep',null]};s.future={nested:{keep:true}};f.data.set(f.keys.main,JSON.stringify(s));}});assert.equal(h.app.state.gacha.owned.length,52);assert.deepEqual(copy(h.app.state.gacha.future),{raw:['keep',null]});assert.deepEqual(copy(h.app.state.future),{nested:{keep:true}});assert.equal(h.initialE.gachaRemaining(h.app.state).length,140);assert.deepEqual(copy(h.app.state.collectiblesV1.grants),{});
  const original=[...h.data].filter(([k])=>k.endsWith('original')),identity=copy(h.app.state.collectiblesV1.migration),owned=copy(h.app.state.gacha.owned);
  assert(h.app.atomic(()=>{h.app.state.coins+=1000000;h.app.state.totalEarned+=1000000;return {ok:true};},'synthetic funds').ok);const funds=h.app.state.coins;
  for(let i=0;i<4;i++)assert(h.app.atomic(()=>h.initialE.gachaDraw(h.app.state,0),'paid decoration draw').ok);
  assert.equal(h.app.state.coins,funds-800000);assert.equal(h.app.state.gacha.owned.length,56);assert.deepEqual(copy(h.app.state.gacha.owned.slice(0,52)),owned);
  for(const id of ['d_opening_photo','d_ward_charm'])assert(h.runtime.claimHidden(id).ok);
  assert.equal(h.app.state.coins,funds-800000);assert.equal(h.app.state.gacha.owned.length,58);assert.deepEqual(copy(h.app.state.gacha.future),{raw:['keep',null]});assert.deepEqual(copy(h.app.state.collectiblesV1.migration),identity);assert.deepEqual([...h.data].filter(([k])=>k.endsWith('original')),original);
  const saved=[...h.data],final=copy(h.app.state);await h.close();const re=await app(t,{scope,configure:f=>{f.data.clear();for(const [k,v]of saved)f.data.set(k,v);}});assert.deepEqual(copy(re.app.state.gacha),final.gacha);assert.deepEqual(copy(re.app.state.collectiblesV1),final.collectiblesV1);
 });
 test(scope+': failed claim main write does not publish ownership or replay on read-only reconcile',async t=>{
  // Fail only the claim write (after the pre-claim gameplay flush).
  const h=await app(t,{scope});const key=h.t.keys.main;const Storage=h.context.Storage,old=Storage.prototype.setItem;let mainWrites=0;
  Storage.prototype.setItem=function(k,v){if(k===key&&++mainWrites===2)throw Error('synthetic-claim-write-failure');return old.call(this,k,v);};
  const r=h.runtime.claimHidden('d_ward_charm');assert.equal(r.ok,false);assert.equal(h.app.state.gacha.owned.includes('d_ward_charm'),false);const raw=h.data.get(key);assert(!JSON.parse(raw).gacha.owned.includes('d_ward_charm'));const writes=h.writes().length;h.runtime.reconcile();assert.equal(h.writes().length,writes);assert.equal(h.data.get(key),raw);
 });
}
for(const scope of ['formal','preview'])test(scope+': write then unreadable result protects session; reconcile only reads and never grants twice',async t=>{
 const h=await app(t,{scope}),key=h.t.keys.main,Storage=h.context.Storage,oldSet=Storage.prototype.setItem,oldGet=Storage.prototype.getItem;let armed=false;
 Storage.prototype.setItem=function(k,v){const r=oldSet.call(this,k,v);if(k===key&&JSON.parse(v).gacha.owned.includes('d_ward_charm'))armed=true;return r;};
 Storage.prototype.getItem=function(k){if(k===key&&armed)throw Error('synthetic-readback-unknown');return oldGet.call(this,k);};
 const r=h.runtime.claimHidden('d_ward_charm');assert.equal(r.ok,false);assert.equal(h.app.saveBlocked,true);const disk=h.data.get(key);assert.equal(JSON.parse(disk).gacha.owned.filter(x=>x==='d_ward_charm').length,1);assert.equal(h.app.state.gacha.owned.includes('d_ward_charm'),false);
 const writes=h.writes().length;assert.equal(h.runtime.claimHidden('d_ward_charm').ok,false);assert.equal(h.writes().length,writes);
 armed=false;Storage.prototype.setItem=oldSet;Storage.prototype.getItem=oldGet;const reconciled=h.runtime.reconcile();assert(reconciled.ok,JSON.stringify(reconciled));assert.equal(h.writes().length,writes);assert.equal(h.data.get(key),disk);assert.equal(h.app.state.gacha.owned.filter(x=>x==='d_ward_charm').length,1);assert.equal(h.runtime.claimHidden('d_ward_charm').code,'HIDDEN_ALREADY_CLAIMED');
});
