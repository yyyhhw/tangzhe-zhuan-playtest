// r4 regressions (Node): purchase gating + rollback, roster cap vs floor space, waiting runtime,
// invalid rooms -> standby, unsupported dog/cat engine versions kept byte-for-byte.
// Run: node preview/pet/accept2/test_pets2_r4.js   (navigation / UI gating: see test_pets2_r4_e2e.py)
'use strict';
const assert = require('assert');
const E = require('../../economy.js');
const PG = require('../game/petgame.js');
const M = require('../art/manifest.json');
const T0 = 1790000000000;
const J = v => JSON.stringify(v);
const ok = () => true, fail = () => false;
const fresh = () => { const st = E.newState(T0); for (const c of E.CEOS) st.ceos[c.id].unlocked = true; st.coins = 100000; return st; };
const reload = st => { const s = J(st), r = E.loadSave(s, s, T0 + 5000).st; PG.norm(r, E); return r; };
const rec = (st, uid) => st.pets.list.find(p => p.uid === uid);
function fill(st, id) {
  const c0 = st.coins, t = E.homeTier(E.homeOf(st, id).lv);
  for (let y = 0; y < t.rows; y++) for (let x = 0; x < t.cols; x++) { st.coins = 1e9; E.buyFurniture(st, 'furn_plant'); E.placeItem(st, id, 'furn_plant', x, y, 0, 'floor'); }
  st.coins = c0;
}
let passed = 0;
const test = (name, run) => { run(); passed++; console.log('PASS ' + name); };

test('R4-1 bad wallet / insufficient / save blocked / save failure: purchase refused, coins + roster + growth unchanged', () => {
  const st = fresh(), a = PG.buy(st, E, 'c77', 100, M, ok); assert(a.ok);
  rec(st, a.uid).eng = { v: 1, savedAt: 0, t: 3, dog: { affinity: 55 } };
  for (const [name, mut, blocked, save] of [['bad wallet', s => { s.coins = 'abc'; }, false, ok], ['negative wallet', s => { s.coins = -5; }, false, ok],
    ['insufficient', s => { s.coins = 10; }, false, ok], ['save blocked', () => {}, true, ok], ['save fails', () => {}, false, fail]]) {
    const s = JSON.parse(J(st)); mut(s); const before = J(s);
    for (const room of ['pearl', null]) {
      const r = PG.buy(s, E, room, 200, M, save, blocked);
      assert(!r.ok, name + ' ' + room); assert.equal(J(s), before, name + ' changed state');
    }
  }
});

test('R4-2 two-pet roster cap and floor space are separate; explicit standby is never redirected', () => {
  const st = fresh(), a = PG.buy(st, E, 'c77', 1, M, ok), b = PG.buy(st, E, 'c77', 2, M, ok); assert(a.ok && b.ok);
  let before = J(st); const r = PG.buy(st, E, 'c77', 3, M, ok);
  assert(!r.ok && r.needReplace && !r.noRoom); assert.equal(J(st), before);
  const rep = PG.buy(st, E, 'c77', 4, M, ok, false, { replace: a.uid });
  assert(rep.ok && rep.room === 'c77' && rec(st, a.uid).room === null && rec(st, rep.uid).room === 'c77');
  fill(st, 'pearl'); assert(!PG.hasRoom(st, E, 'pearl', M) && PG.hasRoom(st, E, 'c77', M));
  before = J(st); const nr = PG.buy(st, E, 'pearl', 5, M, ok);
  assert(!nr.ok && nr.noRoom && !nr.needReplace); assert.equal(J(st), before, 'no-floor purchase changed state');
  const coins = st.coins, sb = PG.buy(st, E, null, 6, M, ok);
  assert(sb.ok && sb.room === null && rec(st, sb.uid).room === null && st.coins === coins - PG.PET.price, 'explicit standby purchase must succeed and stay standby');
  before = J(st); const mv = PG.assign(st, E, sb.uid, 'pearl', { M, save: ok });
  assert(!mv.ok && mv.noRoom); assert.equal(J(st), before, 'move into a no-floor room changed state');
  const mv2 = PG.assign(st, E, sb.uid, 'c77', { M, save: ok, replace: b.uid });
  assert(mv2.ok && mv2.room === 'c77' && rec(st, b.uid).room === null);
  const back = PG.assign(st, E, sb.uid, null, { save: ok }); assert(back.ok && back.room === null);
});

test('R4-4 waiting runtime keeps room + growth, refuses interactions, allows standby, recovers when floor frees up', () => {
  const st = fresh(), a = PG.buy(st, E, 'c77', 1, M, ok); assert(a.ok);
  const rt = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 });
  rt.sync(st); rt.w.dog.affinity = 61; rt.beforePersist(st);
  fill(st, 'c77'); rt.frame(0.05, st);
  assert(rt.waiting && rec(st, a.uid).room === 'c77' && rt.w.dog.affinity === 61);
  for (const k of ['call', 'pet', 'throwBall']) assert.equal(rt[k](st).why, 'waiting', k);
  const s2 = JSON.parse(J(st)), sb = PG.assign(s2, E, a.uid, null, { save: ok }); assert(sb.ok && rec(s2, a.uid).room === null);
  for (const p of E.homeOf(st, 'c77').placed.slice()) E.storeItem(st, 'c77', p.uid);
  rt.frame(0.05, st);
  assert(!rt.waiting && rt.w.dog.affinity === 61 && rt.call(st).ok !== undefined && rt.call(st).why !== 'waiting');
});

test('R4-5 unopened / unknown saved room -> standby; uid, species and growth intact; never moved into another room', () => {
  const st = fresh(); st.ceos.pearl.unlocked = false;
  st.pets = { v: 2, list: [{ uid: 'x1', species: 'dog', room: 'nope', boughtAt: 1, eng: { v: 1, t: 2, dog: { affinity: 66 } } },
    { uid: 'x2', species: 'cat', room: 'pearl', boughtAt: 2, eng: { v: 3, cat: { v: 9, mood: 1 } } }] };
  const raw = st.pets.list.map(p => [p.uid, p.species, J(p.eng)]);
  const r = reload(st), v = PG.view(r, E);
  assert.deepEqual(r.pets.list.map(p => [p.uid, p.species, J(p.eng)]), raw);
  assert(r.pets.list.every(p => p.room === null)); assert.deepEqual(Object.keys(v.rooms), []); assert.deepEqual(v.standby, ['x1', 'x2']);
});

const UNSUP = [['dog engine v99', { v: 99, dog: { affinity: 88 }, extra: [1, { a: 2 }] }], ['dog nested version', { v: 1, savedAt: 0, t: 5, dog: { v: 2, affinity: 77 }, ball: {} }], ['dog opaque string', 'legacy-blob']];
for (const [name, eng] of UNSUP) test('R4-6 ' + name + ': kept byte-for-byte and paused through save, refresh, failed + successful replacement', () => {
  const st = fresh(), a = PG.buy(st, E, 'c77', 1, M, ok); rec(st, a.uid).eng = eng; const raw = J(eng);
  assert.equal(PG.engSupport(rec(st, a.uid)), 'unsupported');
  const rt = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 });
  assert.equal(rt.sync(st), null); assert(rt.unsupported); assert.equal(rt.frame(0.1, st), null);
  assert.equal(rt.beforePersist(st), false); assert.equal(rt.call(st).why, 'unsupported');
  assert.equal(J(rec(st, a.uid).eng), raw, 'runtime touched unsupported growth');
  const s2 = reload(st); assert.equal(J(rec(s2, a.uid).eng), raw); assert.equal(rec(s2, a.uid).room, 'c77', 'refresh moved the pet');
  const rt2 = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 }); assert.equal(rt2.sync(s2), null);
  const b = PG.buy(s2, E, 'c77', 2, M, ok); assert(b.ok);
  const brt = PG.createRuntime({ E, manifest: M, uid: b.uid, now: () => T0 }); brt.sync(s2); brt.frame(0.05, s2);
  const prepare = x => { rt2.beforePersist(x); brt.beforePersist(x); };
  let before = J(s2);
  assert(!PG.buy(s2, E, 'c77', 3, M, fail, false, { replace: a.uid, prepare }).ok); assert.equal(J(s2), before, 'failed purchase-replacement changed state');
  assert(!PG.assign(s2, E, a.uid, null, { save: fail, prepare }).ok); assert.equal(J(s2), before, 'failed standby changed state');
  let saved = null; const save = s => { saved = J(s); return true; };
  const okr = PG.buy(s2, E, 'c77', 4, M, save, false, { replace: a.uid, prepare });
  assert(okr.ok && rec(s2, a.uid).room === null && J(rec(s2, a.uid).eng) === raw);
  const s3 = reload(JSON.parse(saved)); assert.equal(J(rec(s3, a.uid).eng), raw, 'saved replacement lost unsupported growth');
  before = J(s3); assert(!PG.assign(s3, E, a.uid, 'pearl', { M, save: fail }).ok); assert.equal(J(s3), before);
  assert(PG.assign(s3, E, a.uid, 'pearl', { M, save: ok }).ok); assert.equal(J(rec(s3, a.uid).eng), raw);
  const rt3 = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 }); assert.equal(rt3.sync(s3), null); assert(rt3.unsupported);
  assert.equal(J(rec(reload(s3), a.uid).eng), raw);
});

test('R4-6 cat nested engine version is opaque: never interpreted or rewritten by roster moves, save, refresh or replacement', () => {
  const st = fresh(), eng = { v: 1, cat: { v: 42, mood: 'x' }, extra: [3] }, raw = J(eng);
  st.pets = { v: 2, list: [{ uid: 'c1', species: 'cat', room: 'c77', boughtAt: 1, eng }] };
  assert.equal(PG.engSupport(st.pets.list[0]), 'opaque');
  const s2 = reload(st); assert.equal(J(rec(s2, 'c1').eng), raw);
  assert(PG.buy(s2, E, 'c77', 2, M, ok).ok);
  let before = J(s2); assert(!PG.buy(s2, E, 'c77', 3, M, fail, false, { replace: 'c1' }).ok); assert.equal(J(s2), before);
  assert(PG.buy(s2, E, 'c77', 4, M, ok, false, { replace: 'c1' }).ok); assert.equal(J(rec(s2, 'c1').eng), raw);
  before = J(s2); assert(!PG.assign(s2, E, 'c1', 'pearl', { M, save: fail }).ok); assert.equal(J(s2), before);
  assert(PG.assign(s2, E, 'c1', 'pearl', { M, save: ok }).ok); assert.equal(J(rec(reload(s2), 'c1').eng), raw);
});

test('R4-6 only empty growth initializes a fresh dog; a supported v1 payload restores', () => {
  const st = fresh(), a = PG.buy(st, E, 'c77', 1, M, ok);
  assert.equal(PG.engSupport(rec(st, a.uid)), 'empty');
  const rt = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 });
  assert(rt.sync(st) && !rt.unsupported && rt.beforePersist(st)); assert.equal(PG.engSupport(rec(st, a.uid)), 'ok');
  rec(st, a.uid).eng.dog.affinity = 70; const s2 = reload(st);
  const rt2 = PG.createRuntime({ E, manifest: M, uid: a.uid, now: () => T0 + 5000 }); assert.equal(rt2.sync(s2).dog.affinity, 70);
});
console.log(passed + ' r4 cases passed (Node; no browser/device claims)');
