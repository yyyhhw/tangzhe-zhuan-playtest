import test from 'node:test';import assert from 'node:assert/strict';
import {EVENT_IDS,readVoyageEv,readSpaceEv,migrateVoyageEv,attachEvent,resolveEvent,pickEvent,defaultEvState} from '../../space/voyage-ev.mjs';
import {defaultSpace,validateSpace,readSpace} from '../../space/domain.mjs';
import {moonView,planMoon} from '../../space/moon.mjs';
const base=()=>({v:3,coins:1,shops:[0,1,2,3].map(()=>({open:true,lv:35,emp:1})),gacha:{owned:[]}});
const moonVoyage={route:'moon',start:1000,dur:600000,ev:null,voyageId:'moon:formal:1:12345678-1234-1234-1234-123456789abc',sequence:1,ruleset:'xingtu-moon-10min-8pts-v1',completed:false};
const withSpace=v=>{const s=base();s.space={...defaultSpace(),voyage:v,moonLoop:{schemaVersion:1,sequence:v?1:0,claimed:0,lastReceipt:null}};return s;};
test('old saves default safely: no space / voyage null / moon ev:null → no event, migrate is a byte-identical no-op',()=>{
  for(const s of [base(),withSpace(null),withSpace(moonVoyage)]){const before=JSON.stringify(s);
    const r=readSpaceEv(s);assert(r.ok);assert.equal(r.event,null);
    const m=migrateVoyageEv(s);assert(m.ok&&!m.changed);assert.equal(JSON.stringify(m.state),before);assert.equal(JSON.stringify(s),before,'input untouched');}
  assert(readSpaceEv(base()).missing);
});
test('existing space semantics unchanged: moonView/planMoon on old moon saves behave exactly as before (ev stays null)',()=>{
  const s=withSpace(null);const p=planMoon(s,{type:'depart',route:'moon'},{scope:'formal',now:5000,makeId:()=>'12345678-1234-1234-1234-123456789abc'});
  assert(p.ok&&!p.noop);assert.equal(p.state.space.voyage.ev,null);assert(!('evState' in p.state.space.voyage));assert.equal(readSpaceEv(p.state).event,null);
  assert(moonView(withSpace(moonVoyage),{scope:'formal',now:2000}).ok);
});
test('event-bearing voyage: ev string + evState validates under existing domain schema 1 and round-trips',()=>{
  const a=attachEvent({...moonVoyage},'ev_pirates');assert(a.ok);const s=base();s.space={...defaultSpace(),voyage:a.voyage};
  assert(validateSpace(s.space).ok,'domain schema 1 accepts');assert.deepEqual(readSpace(s).space.voyage.evState,defaultEvState('ev_pirates'));
  const r=readSpaceEv(s);assert(r.ok);assert.equal(r.event.id,'ev_pirates');assert.equal(r.event.implicit,false);
  assert(!migrateVoyageEv(s).changed);
});
test('implicit (ev id, no evState) is read as unresolved; migration fills explicit default once (idempotent)',()=>{
  const s=base();s.space={...defaultSpace(),voyage:{...moonVoyage,ev:'ev_meteor_rain'}};
  const r=readSpaceEv(s);assert(r.event.implicit);const m=migrateVoyageEv(s);assert(m.changed);assert.deepEqual(m.state.space.voyage.evState,defaultEvState('ev_meteor_rain'));
  const m2=migrateVoyageEv(m.state);assert(!m2.changed);assert.equal(JSON.stringify(m2.state),JSON.stringify(m.state));assert(!('evState' in s.space.voyage));
});
test('resolve once: records choice/outcome/reward, second resolve is noop, never mutates input',()=>{
  const v=attachEvent({...moonVoyage},'ev_alien_caravan').voyage,before=JSON.stringify(v);
  const r=resolveEvent(v,{choice:'a',outcome:'success',reward:{pts:3},now:7000});assert(r.ok&&!r.noop);assert.deepEqual(r.voyage.evState,{schemaVersion:1,id:'ev_alien_caravan',choice:'a',outcome:'success',resolvedAt:7000,reward:{pts:3}});
  assert.equal(JSON.stringify(v),before);const again=resolveEvent(r.voyage,{choice:'b',outcome:'fail',now:8000});assert(again.ok&&again.noop);assert.equal(again.voyage.evState.choice,'a');
  assert.equal(resolveEvent({...moonVoyage},{choice:'a',outcome:'success',now:1}).code,'SPACE_EV_NONE');
  assert.equal(resolveEvent(v,{choice:'z',outcome:'success',now:1}).code,'SPACE_EV_RESOLVE_INVALID');
  assert.equal(resolveEvent(v,{choice:'a',outcome:'success',reward:{coins:5},now:1}).code,'SPACE_EV_RESOLVE_INVALID','no wallet rewards');
});
test('malformed / future data is refused read-only, never cleaned',()=>{
  const v=attachEvent({...moonVoyage},'ev_pirates').voyage;
  const cases=[[{...moonVoyage,evState:defaultEvState('ev_pirates')},'SPACE_EV_STATE_WITHOUT_EVENT'],[{...moonVoyage,ev:'ev_future'},'SPACE_EV_UNKNOWN_READ_ONLY'],
    [{...v,evState:{...v.evState,schemaVersion:2}},'SPACE_EV_VERSION_READ_ONLY'],[{...v,evState:{...v.evState,id:'ev_meteor_rain'}},'SPACE_EV_STATE_MISMATCH'],
    [{...v,evState:{...v.evState,extra:1}},'SPACE_EV_STATE_INVALID'],[{...v,evState:{...v.evState,choice:'a'}},'SPACE_EV_STATE_INVALID'],[{...v,ev:5},'SPACE_EV_INVALID']];
  for(const [voy,code] of cases){assert.equal(readVoyageEv(voy).code,code);const s=base();s.space={...defaultSpace(),voyage:voy};const before=JSON.stringify(s);assert(!migrateVoyageEv(s).ok);assert.equal(JSON.stringify(s),before);}
  assert.equal(attachEvent(v,'ev_pirates').code,'SPACE_EV_ALREADY_SET');assert.equal(attachEvent({...moonVoyage},'nope').code,'SPACE_EV_UNKNOWN');
});
test('pickEvent is deterministic (no RNG) and covers the 6 ids',()=>{
  assert.equal(EVENT_IDS.length,6);assert.equal(pickEvent('x'),pickEvent('x'));assert.equal(pickEvent(''),null);
  const seen=new Set();for(let i=1;i<200;i++)seen.add(pickEvent(`moon:formal:${i}:12345678-1234-1234-1234-123456789abc`));assert.equal(seen.size,6);
});
