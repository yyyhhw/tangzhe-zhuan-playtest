import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
const T=1700000001000,opts={timeout:15000};
async function ready(t,{scope='formal',fault,configure,path}={}){
 const h=await assembly({scope,path,protocol:2,mode:'bootstrap',storageFault:fault,configure:f=>{
  const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;x.emp=0;}s.gacha.draws=0;s.zombie.cleared=0;s.zombie.best=0;f.data.set(f.keys.main,JSON.stringify(s));configure?.(f);
 }});t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length,'milestone host');assert(h.app&&h.context.XingTu,JSON.stringify(h.errors));let time=T;h.context.Date.now=()=>time;return {...h,setTime:v=>time=v};
}
for(const scope of ['formal','preview']){
 test(scope+' actual hire success records once, no-op/failed hire cannot overwrite; exact ledger survives refresh/rootpet',opts,async t=>{
  const h=await ready(t,{scope});assert(h.app.atomic(()=>h.context.Economy.hireEmp(h.app.state,0)).ok);const m=copy(h.app.state.milestones);assert.equal(m.events.firstEmployee,T);assert.equal(m.events.firstShop,null);assert(!('firstBox'in m.events));
  h.setTime(T+60000);assert(!h.app.atomic(()=>h.context.Economy.hireEmp(h.app.state,0)).ok);assert.deepEqual(copy(h.app.state.milestones),m);assert(h.app.persist());assert.deepEqual(copy(h.app.state.milestones),m);
  const saved=new Map(h.data);await h.close();const next=await ready(t,{scope,path:scope==='formal'?'/pet/game/':undefined,configure:f=>{f.data.clear();for(const [k,v]of saved)f.data.set(k,v);}});assert.deepEqual(copy(next.app.state.milestones),m);assert(next.app.persist());assert.deepEqual(JSON.parse(next.data.get(next.t.keys.main)).milestones,m);
 });
 for(const failure of ['backup','main','unknown'])test(scope+' hire '+failure+' keeps business and time atomic, reconcile never replays',opts,async t=>{
  const fault={operation:null},h=await ready(t,{scope,fault});const before=copy(h.app.state),n=h.writes().length;
  Object.assign(fault,{operation:failure==='unknown'?'getItem':'setItem',key:failure==='backup'?h.t.keys.backup:h.t.keys.main,nth:1,attempt:0,afterWrite:failure==='unknown',armed:false});
  const r=h.app.atomic(()=>h.context.Economy.hireEmp(h.app.state,0));assert(!r.ok);const disk=JSON.parse(h.data.get(h.t.keys.main));assert.equal(disk.shops[0].emp,failure==='unknown'?1:0);assert.equal(disk.milestones?.events.firstEmployee,failure==='unknown'?T:undefined);assert.equal(h.app.state.shops[0].emp,0);assert.deepEqual(copy(h.app.state.milestones??null),before.milestones??null);
  assert(h.writes().length>=n);const writes=h.writes().length;assert(!h.app.atomic(()=>h.context.Economy.hireEmp(h.app.state,0)).ok);assert.equal(h.writes().length,writes);
  Object.assign(fault,{operation:null,armed:false});await h.click('collectibleReconcile');assert.equal(h.writes().length,writes);assert.deepEqual(copy(h.app.state),disk);
 });
 test(scope+' counterfeit ledger add/edit/delete is refused, old timestamps immutable',opts,async t=>{
  const h=await ready(t,{scope});assert(h.app.persist());const c=h.runtime.coordinator,original=copy(h.app.state),raw=h.data.get(h.t.keys.main),n=h.writes().length;
  for(const op of ['add','edit','delete']){h.context.__forged=JSON.stringify(original);const r=vm.runInContext(`(()=>{const s=JSON.parse(__forged);${op==='add'?'s.milestones.events.earth=123;':op==='edit'?'s.milestones.events.firstShop=123;':'delete s.milestones;'}return ${(scope==='formal'?'Formal':'Preview')}CollectionRuntime.coordinator.commit(s);})()`,h.context);assert(!r.ok);assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(h.writes().length,n);}
 });
 test(scope+' private departure/claim timestamps survive duplicate, cancellation/hidden page zero writes',opts,async t=>{
  const h=await ready(t,{scope});assert(h.context.XingTu.open().ok);const action=h.node('xingtuDepart').onclick;h.context.XingTu.close();const n=h.writes().length;assert(!action().ok);assert.equal(h.writes().length,n);assert(!h.app.state.milestones?.events.firstVoyage);
  h.context.XingTu.open();assert(h.node('xingtuDepart').onclick().ok);assert.equal(h.app.state.milestones.events.firstVoyage,T);h.setTime(T+600000);h.context.XingTu.refresh();assert(h.node('xingtuChoiceB').onclick().ok);assert(h.node('xingtuClaim').onclick().ok);assert.equal(h.app.state.milestones.events.firstStory,T+600000);assert.equal(h.app.state.milestones.events.firstVoyage,T);
  h.hide();const saved=h.data.get(h.t.keys.main),count=h.writes().length;assert(!h.context.XingTu.perform({type:'depart',route:'moon'}).ok);assert.equal(h.writes().length,count);assert.equal(h.data.get(h.t.keys.main),saved);
 });
 test(scope+' foreign writer freezes stale page without ledger overwrite',opts,async t=>{
  const h=await ready(t,{scope});assert(h.app.persist());const foreign=JSON.parse(h.data.get(h.t.keys.main));foreign.rev++;foreign.milestones.events.firstEmployee=T+1;foreign.shops[0].emp=1;const raw=JSON.stringify(foreign);h.data.set(h.t.keys.main,raw);const n=h.writes().length;assert(!h.app.atomic(()=>h.context.Economy.hireEmp(h.app.state,0)).ok);assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(h.writes().length,n);
 });
}

import {defaultSpace} from '../../space/domain.mjs';
for(const scope of ['formal','preview'])test(scope+' research, alien/hidden, reply and Earth use successful private intents only',opts,async t=>{
 const h=await ready(t,{scope,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.coins=1e15;s.coinFrac=0;s.space=defaultSpace();s.space.lv={tech:5,war:5,med:5,life:5};s.space.cards.mars=2;f.data.set(f.keys.main,JSON.stringify(s));}});
 const host=h.context.XingTu;assert(host.open().ok);
 const perform=intent=>{h.context.__intent=JSON.stringify(intent);return vm.runInContext('XingTu.perform(JSON.parse(__intent))',h.context);};
 {const r=perform({type:'research',sys:'tech',tier:1});assert(r.ok,JSON.stringify(r));}assert.equal(h.app.state.milestones.events.firstResearch,T);h.setTime(T+1);{const r=perform({type:'research',sys:'tech',tier:1});assert(r.ok,JSON.stringify(r));}assert.equal(h.app.state.milestones.events.firstResearch,T);
 assert(perform({type:'depart',route:'mars'}).ok);let id=h.app.state.space.voyage.voyageId;h.setTime(T+3600001);assert(perform({type:'choose',voyageId:id,choice:'b'}).ok);assert(perform({type:'claim',voyageId:id}).ok);assert.equal(h.app.state.milestones.events.firstAlien,T+3600001);assert.equal(h.app.state.milestones.events.firstHidden,T+3600001);assert.equal(h.app.state.milestones.events.firstStory,null,'old cards never acquire a modern date');
 assert(perform({type:'depart',route:'signal'}).ok);id=h.app.state.space.voyage.voyageId;h.setTime(T+32400001);assert(perform({type:'choose',voyageId:id,choice:'b'}).ok);assert(perform({type:'claim',voyageId:id}).ok);assert.equal(h.app.state.milestones.events.reply,T+32400001);
 assert(!perform({type:'earth'}).ok,'research spending leaves less than Earth price');assert(!('earth' in h.app.state.milestones.events));h.app.state.coins=1e15;assert(h.app.persist());h.setTime(T+32400002);assert(perform({type:'earth'}).ok);assert.equal(h.app.state.milestones.events.earth,T+32400002);const ledger=copy(h.app.state.milestones),n=h.writes().length;assert(perform({type:'earth'}).ok);assert.equal(h.writes().length,n);assert.deepEqual(copy(h.app.state.milestones),ledger);
});

for(const scope of ['formal','preview'])for(const bad of [null,{schemaVersion:2,events:{}},{schemaVersion:1,events:{unknown:42}},{schemaVersion:1,events:{firstShop:-1}}])test(scope+' malformed/future ledger stays byte-exact and read-only',opts,async t=>{
 const h=await assembly({scope,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.milestones=bad;f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());const saved=new Map(h.data);await until(()=>h.view()||h.bootError||h.errors.length,'protected ledger');assert(!h.view()?.canPlay);assert(!h.app);assert.equal(h.writes().length,0);assert.deepEqual([...h.data],[...saved]);
});
