// Extra roster/runtime regressions. Run: node preview/pet/accept2/test_pets2_roster_runtime.js
// Keep the original R1–R16 acceptance cases unchanged; these cover integration edge cases.
'use strict';
const assert = require('assert');
const E = require('../../economy.js');
const PG = require('../game/petgame.js');
const M = require('../art/manifest.json');
const {manifests,buySpecies,runtimeSpecies}=require('./species_test_fixtures.js');
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => {
  const st = E.newState(1790000000000);
  for (const ceo of E.CEOS) st.ceos[ceo.id].unlocked = true;
  st.coins = 100000;
  return st;
};
const uid = (st, index = 0) => st.pets.list[index].uid;
let passed = 0;
const test = (name, run) => { run(); passed++; console.log('PASS ' + name); };

test('one dog only, different-species purchase, replacement and standby ownership', () => {
  const st = fresh(), startCoins = st.coins;
  let saves = 0;
  const save = () => { saves++; return true; };
  const a = PG.buy(st, E, 'c77', 100, M, save);
  const duplicate=PG.buy(st,E,'c77',100,M,save);assert(!duplicate.ok&&duplicate.alreadyOwned);assert.equal(st.coins,startCoins-3000);assert.equal(saves,1);
  const b = buySpecies(st,E,'cat','c77',100,save);
  assert(a.ok && b.ok && a.uid !== b.uid, 'same-timestamp purchases need unique IDs');
  assert.equal(st.coins, startCoins - 6000);
  assert.equal(saves, 2);
  const full = JSON.stringify(st);
  const rejected = buySpecies(st,E,'rabbit','c77',100,save);
  assert(rejected.needReplace && !rejected.ok);
  assert.equal(JSON.stringify(st), full);
  assert.equal(saves, 2, 'full-room rejection must not save');
  const standby = buySpecies(st,E,'rabbit',null,100,save);
  assert(standby.ok);
  assert.equal(PG.view(st, E).standby[0], standby.uid);

  const aRt = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => 100 });
  const bRt = runtimeSpecies(st,E,b.uid,()=>100);
  aRt.sync(st); bRt.sync(st);
  assert(Math.hypot(aRt.w.dog.x - bRt.w.dog.x, aRt.w.dog.y - bRt.w.dog.y) > 1.2, 'two dogs need distinct initial touch targets');
  assert.notEqual(aRt.w.bed.x, bRt.w.bed.x, 'empty room has space for separate beds');
  const beforeB = bRt.w.dog.affinity;
  aRt.pet(st);
  assert.equal(bRt.w.dog.affinity, beforeB, 'touching a must not change b');
  const standbyRt = runtimeSpecies(st,E,standby.uid);
  assert.equal(standbyRt.sync(st), null, 'standby must not simulate');
  const replacement = buySpecies(st,E,'robot','c77',100,save,false,{replace:a.uid});
  assert(replacement.ok);
  assert(PG.view(st, E).standby.includes(a.uid), 'replaced pet remains owned');
});

test('failed purchase rolls back wallet, revision, placement, and prepared growth', () => {
  for (const save of [() => false, () => { throw new Error('quota'); }]) {
    const st = fresh();
    PG.buy(st, E, 'c77', 100, M, () => true);
    buySpecies(st,E,'cat','c77',100,()=>true);
    const before = JSON.stringify(st);
    const result = buySpecies(st,E,'rabbit','c77',100,save,false,{
      replace: uid(st),
      prepare: next => { next.pets.list[0].eng = { affinity: 123 }; next.rev += 4; },
    });
    assert(!result.ok);
    assert.equal(JSON.stringify(st), before);
  }
});

test('roster operations preserve opaque growth across every species', () => {
  const st = fresh();
  st.pets = { v: 2, list: [
    { uid: '__proto__', species: 'future-llama', room: 'c77', boughtAt: 0,
      eng: { v: 93, xp: 987, pet: { friendship: 12 }, dog: { affinity: 99999 }, extension: ['a', 0] } },
    { uid: 'dog', species: 'dog', room: 'c77', boughtAt: 1,
      eng: { v: 8, dog: { affinity: 0 }, xp: 454 } },
  ] };
  const expectedGrowth = st.pets.list.map(p => JSON.stringify(p.eng));
  PG.norm(st, E);
  assert.equal(st.pets.list[0].uid, '__proto__');
  assert(!PG.assign(st, E, '__proto__', 'pearl', { save: () => true }).ok);assert(PG.view(st,E).pets['__proto__'].quarantined);
  assert.deepEqual(st.pets.list.map(p => JSON.stringify(p.eng)), expectedGrowth);
  const before = JSON.stringify(st);
  Object.freeze(st);
  assert(PG.view(st, E).pets['__proto__']);
  assert.equal(JSON.stringify(st), before, 'view must be read-only');
  const wrongSpecies = PG.createRuntime({ E, manifest: M, uid: '__proto__' });
  assert.equal(wrongSpecies.sync(st), null);
  wrongSpecies.beforePersist(st);
  assert.equal(JSON.stringify(st), before, 'dog runtime must never rewrite another species');
});

test('runtime snapshots are applied inside assignment rollback boundary', () => {
  const st = fresh();
  PG.buy(st, E, 'c77', 100, M, () => true);
  const id = uid(st), rt = PG.createRuntime({ E, manifest: M, uid: id, now: () => 100 });
  rt.sync(st); rt.pet(st);
  const eng = rt.snapshot(), before = JSON.stringify(st);
  assert(eng.dog.affinity >= 40);
  const options = { prepare: next => { next.pets.list[0].eng = eng; }, save: () => false };
  assert(!PG.assign(st, E, id, 'pearl', options).ok);
  assert.equal(JSON.stringify(st), before);
  options.save = next => {
    assert.equal(next.pets.list[0].eng.dog.affinity, eng.dog.affinity);
    return true;
  };
  assert(PG.assign(st, E, id, 'pearl', options).ok);
  const moved = JSON.stringify(st);
  rt.beforePersist(st);
  assert.equal(JSON.stringify(st), moved, 'old-room runtime must not overwrite moved pet');
  rt.sync(st);
  assert.equal(rt.homeId, 'pearl');
  assert.equal(rt.w.dog.affinity, eng.dog.affinity);
});

test('stale replacement picker cannot apply after room occupants change', () => {
  const st = fresh();
  for (let i = 0; i < 3; i++) assert(buySpecies(st,E,['dog','cat','rabbit'][i],i<2?'c77':null,100+i,()=>true).ok);
  const expected = PG.view(st, E);
  assert(PG.assign(st, E, uid(st, 0), 'pearl', { save: () => true }).ok);
  const before = JSON.stringify(st);
  let saves = 0;
  const result = PG.assign(st, E, uid(st, 2), 'c77', {
    replace: uid(st, 1), expected, save: () => { saves++; return true; },
  });
  assert(!result.ok && result.stale);
  assert.equal(saves, 0);
  assert.equal(JSON.stringify(st), before);
});

test('stale runtimes cannot overwrite newer engines; clone snapshots stay isolated', () => {
  const st = fresh();
  PG.buy(st, E, 'c77', 100, M, () => true);
  const id = uid(st), rt = PG.createRuntime({ E, manifest: M, uid: id, now: () => 100 });
  rt.sync(st); rt.pet(st);
  const shadow = clone(st), before = JSON.stringify(st);
  rt.beforePersist(shadow);
  assert.equal(JSON.stringify(st), before);
  const affinity = shadow.pets.list[0].eng.dog.affinity;
  rt.beforePersist(st);
  assert.equal(st.pets.list[0].eng.dog.affinity, affinity, 'snapshotting a clone must not invalidate live persistence');
  st.pets.list[0].eng = { v: 1, dog: { affinity: 88, energy: 70 }, home: 'c77', savedAt: 100 };
  const external = JSON.stringify(st);
  rt.beforePersist(st);
  assert.equal(JSON.stringify(st), external);
  rt.sync(st);
  assert.equal(rt.w.dog.affinity, 88);
  assert(PG.assign(st, E, id, null, { save: () => true }).ok);
  const standby = JSON.stringify(st);
  rt.beforePersist(st);
  assert.equal(JSON.stringify(st), standby);
  assert.equal(rt.sync(st), null);
  assert.equal(rt.w, null);
});

test('ID repair and normalization preserve roster metadata and omit empty rooms', () => {
  const st = fresh();
  st.pets = { v: 2, futureRosterMetadata: { unlockedSpecies: ['cat', 'dog'], hintSeen: true }, list: [
    { uid: '', species: 'cat', room: 'pearl', eng: { custom: 1 } },
    { uid: null, species: 'cat', room: 'pearl', eng: { custom: 2 } },
    { uid: 'a', species: 'cat', room: 'pearl', eng: { custom: 3 } },
    { uid: 'a', species: 'cat', room: 'c77', eng: { custom: 4 } },
  ] };
  PG.norm(st, E);
  assert.deepEqual(st.pets.futureRosterMetadata, { unlockedSpecies: ['cat', 'dog'], hintSeen: true });
  assert.equal(st.pets.list.length, 4);
  assert.equal(new Set(st.pets.list.map(p => p.uid)).size, 4);
  assert.deepEqual(Object.keys(PG.view(st, E).rooms), ['pearl']);
  assert.equal(PG.view(st, E).standby.length, 3);
  const before = JSON.stringify(st);
  PG.norm(st, E);
  assert.equal(JSON.stringify(st), before);
});

test('failed replacement and retry preserve every active runtime, including other rooms', () => {
  for (const save of [() => false, () => { throw new Error('quota'); }]) {
    const st = fresh();
    const purchases = ['c77', 'c77', 'pearl', null].map((room, i) => buySpecies(st,E,['dog','cat','rabbit','robot'][i],room,100+i,()=>true));
    const active = purchases.slice(0, 3).map(p => runtimeSpecies(st,E,p.uid,()=>100));
    const worlds = active.map((rt, i) => {
      const world = rt.sync(st);
      world.dog.affinity = 65 + i;
      world.dog.energy = 30 + i;
      return world;
    });
    const prepare = next => { for (const rt of active) rt.beforePersist(next, false); };
    const before = JSON.stringify(st);
    const failed = PG.assign(st, E, purchases[3].uid, 'c77', { replace: purchases[0].uid, prepare, save });
    assert(!failed.ok);
    assert.equal(JSON.stringify(st), before);
    active.forEach((rt, i) => {
      assert.strictEqual(rt.sync(st), worlds[i], 'rollback must retain each existing world');
      assert.equal(rt.w.dog.affinity, 65 + i);
      assert.equal(rt.w.dog.energy, 30 + i);
      assert.equal(rt.acknowledgePersist(st), false, 'rolled-back staged save cannot be acknowledged');
    });
    assert(PG.assign(st, E, purchases[3].uid, 'c77', { replace: purchases[0].uid, prepare, save: () => true }).ok);
    assert.equal(active[0].acknowledgePersist(st), false, 'displaced world cannot acknowledge as a resident');
    assert.equal(active[0].sync(st), null);
    active.slice(1).forEach((rt, offset) => {
      const i = offset + 1;
      assert.equal(rt.acknowledgePersist(st), true);
      assert.strictEqual(rt.sync(st), worlds[i], 'successful checkpoint retains resident animation world');
      assert.equal(rt.w.dog.affinity, 65 + i);
      assert.equal(rt.w.dog.energy, 30 + i);
    });
    assert.equal(st.pets.list.find(p => p.uid === purchases[0].uid).eng.dog.affinity, 65);
    assert.equal(st.pets.list.find(p => p.uid === purchases[0].uid).eng.dog.energy, 30);
  }
});

test('multiple snapshots inside one failed transaction retain original rollback baseline', () => {
  const st = fresh();
  PG.buy(st, E, 'c77', 100, M, () => true);
  const rt = PG.createRuntime({ E, manifest: M, uid: uid(st), now: () => 100 });
  const world = rt.sync(st);
  world.dog.affinity = 69; world.dog.energy = 32;
  const before = JSON.stringify(st);
  assert(!E.transact(st, { price: 0, save: next => {
    rt.beforePersist(next);
    world.dog.affinity = 70; world.dog.energy = 31;
    rt.beforePersist(next); return false;
  } }).ok);
  assert.equal(JSON.stringify(st), before);
  assert.strictEqual(rt.sync(st), world);
  assert.equal(rt.w.dog.affinity, 70);
  assert.equal(rt.w.dog.energy, 31);
});

test('default persistence and consecutive staged saves preserve live progress after rollback', () => {
  const st = fresh();
  PG.buy(st, E, 'c77', 100, M, () => true);
  const rt = PG.createRuntime({ E, manifest: M, uid: uid(st), now: () => 100 });
  const world = rt.sync(st);
  world.dog.affinity = 51; world.dog.energy = 55;
  // A successful generic save, with no frame or explicit acknowledgement afterward.
  rt.beforePersist(st);
  const firstSaved = JSON.stringify(st);
  world.dog.affinity = 66; world.dog.energy = 43;
  const failed = E.transact(st, {
    price: 0,
    save: next => { rt.beforePersist(next); return false; },
  });
  assert(!failed.ok);
  assert.equal(JSON.stringify(st), firstSaved);
  assert.strictEqual(rt.sync(st), world, 'second save failure must not rebuild from first saved growth');
  assert.equal(rt.w.dog.affinity, 66);
  assert.equal(rt.w.dog.energy, 43);
  // Successful generic persistence is recognized automatically at the next sync.
  assert(E.transact(st, { price: 0, save: next => { rt.beforePersist(next); return true; } }).ok);
  assert.strictEqual(rt.sync(st), world);
  assert.equal(st.pets.list[0].eng.dog.affinity, 66);
  world.dog.affinity = 67;
  rt.beforePersist(st);
  assert.equal(st.pets.list[0].eng.dog.affinity, 67);
});

test('resident departure renumbers beds without resetting live world or growth', () => {
  const st = fresh();
  const a = PG.buy(st, E, 'c77', 100, M, () => true);
  const b = buySpecies(st,E,'cat','c77',101,()=>true);
  const ar = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => 100 });
  const br = runtimeSpecies(st,E,b.uid,()=>100);
  ar.sync(st); br.sync(st);
  const worldB = br.w, position = [worldB.dog.x, worldB.dog.y];
  worldB.dog.affinity = 72; worldB.dog.energy = 38;
  assert(PG.assign(st, E, a.uid, null, { save: () => true }).ok);
  assert.strictEqual(br.sync(st), worldB);
  assert.deepEqual([worldB.dog.x, worldB.dog.y], position);
  assert.equal(worldB.dog.affinity, 72);
  assert.equal(worldB.dog.energy, 38);
  const c = buySpecies(st,E,'rabbit','c77',102,()=>true);
  const cr = runtimeSpecies(st,E,c.uid,()=>100);
  cr.sync(st); br.sync(st);
  assert.notDeepEqual(br.w.bed, cr.w.bed, 'survivor and new resident need separate beds immediately');
  const beds = [clone(br.w.bed), clone(cr.w.bed)];
  br.beforePersist(st); cr.beforePersist(st);
  const reloaded = E.migrate(clone(st), 100).st;
  PG.norm(reloaded, E);
  const br2 = runtimeSpecies(reloaded,E,b.uid,()=>100);
  const cr2 = runtimeSpecies(reloaded,E,c.uid,()=>100);
  br2.sync(reloaded); cr2.sync(reloaded);
  assert.deepEqual([br2.w.bed, cr2.w.bed], beds, 'refresh retains the same distinct bed assignment');
  assert.equal(br2.w.dog.affinity, 72);
  assert.equal(br2.w.dog.energy, 38);
});

console.log(passed + ' extra roster/runtime cases passed');
