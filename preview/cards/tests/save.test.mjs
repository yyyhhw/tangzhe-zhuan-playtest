// node --test preview/cards/tests/save.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../cardcore.mjs?v=card-s1';
import {createCardSave, SAVE_KEY, TMP_KEY, BAK_KEY, QUARANTINE_KEY, LOCK_NAME, CARD_KEYS} from '../ui/save.mjs?v=card-s1';

const SENTINELS = {'tangzhe-save':'MAIN','tangzhe-save-bak':'MAINBAK','tangzhe-preview-save':'PMAIN','tangzhe-preview-save-bak':'PBAK','tangzhe-tab-lock':'L','tangzhe-preview-tab-lock':'PL','tangzhe-formal-td-proto-v1':'TD','tangzhe-card-save':'FORMAL','tangzhe-card-save-bak':'FORMALBAK'};
function fakeStorage(faults = {}) {
  const m = new Map(Object.entries(SENTINELS));
  return {
    m, faults,
    getItem(k) { if (faults.readThrow?.(k)) throw new Error('read failed'); if (faults.readBad?.(k)) return 'garbled'; return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      const f = faults.set?.(k, v);
      if (f === 'throw') throw new Error('QuotaExceededError');
      if (f === 'drop') return;
      m.set(k, String(v));
    },
    removeItem(k) { if (faults.remove?.(k) === 'throw') throw new Error('remove failed'); if (faults.remove?.(k) === 'drop') return; m.delete(k); },
  };
}
const locks = {names: [], async request(name, opts, fn) { this.names.push(name); return fn(); }};
const sentinelsIntact = (s) => { for (const [k, v] of Object.entries(SENTINELS)) assert.equal(s.m.get(k), v, k); };
function play(game, n) {
  for (let i = 0; i < n && game.phase === 'main'; i++) {
    const c = game.active === 1 ? core.chooseAIAction(game)
      : (() => { const a = core.legalActions(game).filter((x) => x.player === 0); const pick = a.find((x) => x.type !== 'end') || a[0]; return {...pick, commandId: `t-${game.revision}`, expectedRevision: game.revision}; })();
    const r = core.apply(game, c); assert.ok(r.ok); game = r.game;
  }
  return game;
}
const g0 = () => core.createGame({rulesSeed: 123, aiSeed: 456, heroes: ['warrior', 'mage']});
async function saved(n = 3, faults) {
  const s = fakeStorage(faults); const st = createCardSave({storage: s, locks, core});
  await st.load(); let g = g0();
  assert.equal((await st.save(g)).ok, true);
  g = play(g, n); assert.equal((await st.save(g)).ok, true);
  return {s, st, g};
}

test('lock name is separate from storage keys', () => {
  assert.equal(LOCK_NAME, 'tangzhe-preview-card-save:write');
  assert.ok(!CARD_KEYS.includes(LOCK_NAME));
  assert.ok(CARD_KEYS.every((k) => k.startsWith('tangzhe-preview-card-save')));
});

test('A1 round trip: revision, hash and state equal; bak holds previous save', async () => {
  const {s, st, g} = await saved(4);
  const st2 = createCardSave({storage: s, locks, core}); const r = await st2.load();
  assert.equal(r.status, 'ok'); assert.equal(r.game.revision, g.revision);
  assert.equal(core.hashState(r.game), core.hashState(g));
  assert.equal(core.stableStringify(r.game), core.stableStringify(g));
  assert.equal(JSON.parse(s.m.get(BAK_KEY)).meta.revision, 0);
  assert.equal(s.m.get(TMP_KEY), undefined);
  assert.ok(locks.names.every((n) => n === LOCK_NAME));
  sentinelsIntact(s);
});

for (const step of ['tmp-write', 'tmp-verify', 'bak-write', 'main-write']) {
  test(`A2 before-commit failure at ${step}: main byte-identical`, async () => {
    const {s, st, g} = await saved(3);
    const mainBefore = s.m.get(SAVE_KEY), bakBefore = s.m.get(BAK_KEY);
    s.faults.set = (k) => (step === 'tmp-write' && k === TMP_KEY) || (step === 'bak-write' && k === BAK_KEY) || (step === 'main-write' && k === SAVE_KEY) ? 'throw' : null;
    if (step === 'tmp-verify') { s.faults.set = (k) => k === TMP_KEY ? 'drop' : null; }
    const g2 = play(g, 2); const r = await st.save(g2);
    assert.equal(r.ok, false); assert.equal(r.kind, 'before-commit'); assert.equal(r.step, step);
    assert.equal(r.lastSaved.revision, g.revision);
    assert.equal(s.m.get(SAVE_KEY), mainBefore);
    if (step !== 'main-write') assert.equal(s.m.get(BAK_KEY), bakBefore);
    assert.equal(core.hashState(g2), core.hashState(play(g, 2)), 'game hash unaffected');
    s.faults.set = null;
    const ok = await st.save(g2); assert.equal(ok.ok, true, 'retry succeeds');
    sentinelsIntact(s);
  });
}

test('A2a main committed but tmp cleanup fails: success with tmpLeft, cleaned next time', async () => {
  const {s, st, g} = await saved(2);
  s.faults.remove = (k) => k === TMP_KEY ? 'drop' : null;
  const g2 = play(g, 1); const r = await st.save(g2);
  assert.equal(r.ok, true); assert.equal(r.tmpLeft, true);
  assert.equal(JSON.parse(s.m.get(SAVE_KEY)).meta.revision, g2.revision);
  assert.equal(JSON.parse(s.m.get(BAK_KEY)).meta.revision, g.revision);
  assert.ok(s.m.has(TMP_KEY));
  const st2 = createCardSave({storage: s, locks, core}); assert.equal((await st2.load()).revision, g2.revision);
  s.faults.remove = null; const r2 = await st2.save(play(g2, 1));
  assert.equal(r2.ok, true); assert.equal(r2.tmpLeft, false); assert.ok(!s.m.has(TMP_KEY));
});

test('A2b main read-back mismatch, rollback succeeds: before-commit main-verify', async () => {
  const {s, st, g} = await saved(2); const mainBefore = s.m.get(SAVE_KEY);
  let n = 0; s.faults.set = (k) => k === SAVE_KEY && n++ === 0 ? 'drop' : null;
  const r = await st.save(play(g, 1));
  assert.equal(r.kind, 'before-commit'); assert.equal(r.step, 'main-verify'); assert.equal(s.m.get(SAVE_KEY), mainBefore);
});

test('A2c rollback fails: rollback-failed, never claims saved; bak intact and recoverable', async () => {
  const {s, st, g} = await saved(2);
  const bakAfterCommit = s.m.get(SAVE_KEY);   // becomes bak at step 4
  s.faults.set = (k) => { if (k !== SAVE_KEY) return null; s.faults.readBad = (kk) => kk === SAVE_KEY; return 'drop'; };
  const r = await st.save(play(g, 1));
  assert.equal(r.ok, false); assert.equal(r.kind, 'rollback-failed'); assert.equal(r.backupVerified, true);
  assert.ok(!('lastSaved' in r) && !('revision' in r));
  assert.equal(s.m.get(BAK_KEY), bakAfterCommit);
  s.faults.set = null; s.faults.readBad = null; s.m.set(SAVE_KEY, '{broken');
  const st2 = createCardSave({storage: s, locks, core}); const l = await st2.load();
  assert.equal(l.status, 'recovered'); assert.equal(l.revision, g.revision);
});

test('A2d read-back throws after main write: rollback-failed (main really updated), never old step', async () => {
  const {s, st, g} = await saved(2); const g2 = play(g, 1);
  s.faults.set = (k) => { if (k === SAVE_KEY) s.faults.readThrow = (kk) => kk === SAVE_KEY; return null; };
  const r = await st.save(g2);
  assert.equal(r.kind, 'rollback-failed'); assert.equal(r.backupVerified, true); assert.ok(!('lastSaved' in r));
  assert.equal(JSON.parse(s.m.get(SAVE_KEY)).meta.revision, g2.revision, 'main was in fact updated');
  s.faults.set = null; const before = new Map(s.m);
  const b0 = await st.restoreBackup();         // main still unreadable: refuse, write nothing
  assert.equal(b0.ok, false); assert.deepEqual([...s.m], [...before]);
  s.faults.readThrow = null; const bakBefore = s.m.get(BAK_KEY);
  const b = await st.restoreBackup();
  assert.equal(b.ok, true); assert.equal(b.revision, g.revision, 'explicit backup path ignores the valid-looking main');
  assert.equal(st.lastSaved.revision, g.revision);
  assert.equal(s.m.get(BAK_KEY), bakBefore, 'uncertain main never copied over the verified backup');
  assert.equal(JSON.parse(s.m.get(SAVE_KEY)).meta.revision, g.revision, 'backup committed to main in the same transaction');
  assert.equal((await st.save(play(b.game, 1))).ok, true, 'normal saving resumes');
});

test('A2e two tabs: A rollback-failed -> B loads and saves newer -> A restore = conflict, B progress kept', async () => {
  const {s, st, g} = await saved(2); const g2 = play(g, 1);
  s.faults.set = (k) => { if (k === SAVE_KEY) s.faults.readThrow = (kk) => kk === SAVE_KEY; return null; };
  assert.equal((await st.save(g2)).kind, 'rollback-failed');
  s.faults.set = null; s.faults.readThrow = null;
  const B = createCardSave({storage: s, locks, core}); const lb = await B.load();
  const g3 = play(lb.game, 2); assert.equal((await B.save(g3)).ok, true);
  const mainB = s.m.get(SAVE_KEY), bakB = s.m.get(BAK_KEY);
  const r = await st.restoreBackup();
  assert.equal(r.ok, false); assert.equal(r.kind, 'conflict');
  assert.equal(s.m.get(SAVE_KEY), mainB, 'B newer save not overwritten'); assert.equal(s.m.get(BAK_KEY), bakB);
  assert.equal(JSON.parse(s.m.get(SAVE_KEY)).meta.revision, g3.revision);
});

test('A2e2 only the main changed after failure (bak same): still conflict', async () => {
  const {s, st, g} = await saved(2);
  s.faults.set = (k) => { if (k === SAVE_KEY) { s.faults.readBad = (kk) => kk === SAVE_KEY; return 'drop'; } return null; };
  assert.equal((await st.save(play(g, 1))).kind, 'rollback-failed');
  s.faults.set = null; s.faults.readBad = null; s.m.set(SAVE_KEY, 'other-tab-text');
  const r = await st.restoreBackup(); assert.equal(r.kind, 'conflict'); assert.equal(s.m.get(SAVE_KEY), 'other-tab-text');
});

test('A2e3 restoreBackup without a prior rollback failure is refused', async () => {
  const {s, st} = await saved(2); const before = new Map(s.m);
  assert.equal((await st.restoreBackup()).ok, false); assert.deepEqual([...s.m], [...before]);
});

test('A2f bak unusable: restoreBackup refuses, writes nothing', async () => {
  const {s, st, g} = await saved(2);
  s.faults.set = (k) => { if (k === SAVE_KEY) { s.m.set(BAK_KEY, 'bad'); s.faults.readThrow = (kk) => kk === SAVE_KEY; } return null; };
  const rf = await st.save(play(g, 1)); assert.equal(rf.kind, 'rollback-failed'); assert.equal(rf.backupVerified, false);
  s.faults.set = null; s.faults.readThrow = null; const before = new Map(s.m);
  const b = await st.restoreBackup(); assert.equal(b.ok, false); assert.deepEqual([...s.m], [...before]);
});

test('A3 failures leave game hash untouched (diagnostics outside game)', async () => {
  const {s, st, g} = await saved(2); const h = core.hashState(g);
  s.faults.set = () => 'throw'; await st.save(g); assert.equal(core.hashState(g), h);
});

test('A4 main corrupt, bak ok: recover to bak, raw main quarantined', async () => {
  const {s, g} = await saved(3); const st = createCardSave({storage: s, locks, core});
  await st.load(); await st.save(play(g, 1));
  s.m.set(SAVE_KEY, '{not json');
  const r = await createCardSave({storage: s, locks, core}).load();
  assert.equal(r.status, 'recovered'); assert.equal(r.revision, g.revision); assert.equal(r.quarantine, 'saved');
  assert.equal(s.m.get(QUARANTINE_KEY), '{not json');
});

test('A4a quarantine fails / no lock / occupied: still recovers, never reports saved', async () => {
  const {s, g} = await saved(3);
  s.m.set(BAK_KEY, s.m.get(SAVE_KEY)); s.m.set(SAVE_KEY, 'bad-1');
  s.faults.set = (k) => k === QUARANTINE_KEY ? 'throw' : null;
  let r = await createCardSave({storage: s, locks, core}).load();
  assert.equal(r.status, 'recovered'); assert.equal(r.quarantine, 'failed'); assert.ok(!s.m.has(QUARANTINE_KEY));
  r = await createCardSave({storage: s, locks: {async request() { throw new Error('lock denied'); }}, core}).load();
  assert.equal(r.status, 'recovered'); assert.equal(r.quarantine, 'failed');
  s.faults.set = null;
  r = await createCardSave({storage: s, locks: null, core}).load();
  assert.equal(r.status, 'recovered'); assert.equal(r.quarantine, 'no-lock'); assert.equal(r.writable, false);
  s.m.set(QUARANTINE_KEY, 'older'); r = await createCardSave({storage: s, locks, core}).load();
  assert.equal(r.quarantine, 'occupied'); assert.equal(s.m.get(QUARANTINE_KEY), 'older');
  assert.equal(r.revision, g.revision);
});

test('A5 main and bak both bad: unrecoverable, no auto new game, keys unchanged', async () => {
  const s = fakeStorage(); s.m.set(SAVE_KEY, 'bad-main'); s.m.set(BAK_KEY, 'bad-bak');
  const r = await createCardSave({storage: s, locks, core}).load();
  assert.equal(r.status, 'unrecoverable'); assert.ok(!r.game);
  assert.equal(s.m.get(SAVE_KEY), 'bad-main'); assert.equal(s.m.get(BAK_KEY), 'bad-bak'); assert.equal(s.m.get(QUARANTINE_KEY), 'bad-main');
});

test('A6 unknown rules version is rejected, not silently replayed', async () => {
  const {s} = await saved(2);
  const env = JSON.parse(s.m.get(SAVE_KEY)); const inner = JSON.parse(env.game);
  inner.game.rulesVersion = 'bookstore-tech-0.5.0'; env.game = JSON.stringify(inner); env.rulesVersion = 'bookstore-tech-0.5.0';
  s.m.set(SAVE_KEY, JSON.stringify(env)); s.m.delete(BAK_KEY);
  const r = await createCardSave({storage: s, locks, core}).load();
  assert.equal(r.status, 'unrecoverable'); assert.match(r.why, /校验失败/);
});

test('A7 future dataVersion: read-only, nothing written', async () => {
  const {s} = await saved(2);
  const env = JSON.parse(s.m.get(SAVE_KEY)); env.dataVersion = 2; s.m.set(SAVE_KEY, JSON.stringify(env));
  const before = new Map(s.m); const st = createCardSave({storage: s, locks, core});
  assert.equal((await st.load()).status, 'future');
  assert.equal((await st.save(g0())).kind, 'readonly');
  assert.deepEqual([...s.m], [...before]);
});

test('A8 no Web Locks: storage untouched', async () => {
  const s = fakeStorage(); const before = new Map(s.m); const st = createCardSave({storage: s, locks: undefined, core});
  await st.load(); const r = await st.save(g0());
  assert.equal(r.ok, false); assert.equal(r.step, 'no-lock'); assert.deepEqual([...s.m], [...before]);
});

test('A9 CAS: two pages from the same save, second writer rejected', async () => {
  const {s, g} = await saved(2);
  const a = createCardSave({storage: s, locks, core}), b = createCardSave({storage: s, locks, core});
  await a.load(); await b.load();
  assert.equal((await a.save(play(g, 1))).ok, true);
  const rb = await b.save(play(g, 2)); assert.equal(rb.kind, 'conflict');
  assert.equal(JSON.parse(s.m.get(SAVE_KEY)).meta.revision, g.revision + 1);
});

test('A11 duplicate commandId after restore: receipt only, no new events', async () => {
  const {s, g} = await saved(0);
  const st = createCardSave({storage: s, locks, core}); await st.load();
  const a = core.legalActions(g).find((x) => x.player === 0 && x.type !== 'end');
  const cmd = {...a, commandId: 'dup-1', expectedRevision: g.revision};
  const g1 = core.apply(g, cmd).game; await st.save(g1);
  const r = await createCardSave({storage: s, locks, core}).load();
  const again = core.apply(r.game, cmd);
  assert.equal(again.duplicate, true); assert.equal(again.events.length, 0); assert.equal(again.game.revision, g1.revision);
});

test('AI continuity: restore mid AI turn, next decision equals uninterrupted run', async () => {
  let g = g0();
  while (!(g.active === 1 && core.actionsThisTurn(g, 1) >= 1)) g = play(g, 1);
  const s = fakeStorage(); const st = createCardSave({storage: s, locks, core}); await st.load(); await st.save(g);
  const restored = (await createCardSave({storage: s, locks, core}).load()).game;
  assert.equal(restored.rng.aiState, g.rng.aiState);
  for (let i = 0; i < 6 && g.phase === 'main'; i++) {
    const a = g.active === 1 ? core.chooseAIAction(g) : null, b = restored.active === 1 ? core.chooseAIAction(restored) : null;
    assert.deepEqual(b, a);
    if (!a) break;
    g = core.apply(g, a).game; const rb = core.apply(restored, b).game; assert.equal(core.hashState(rb), core.hashState(g));
    Object.assign(restored, rb);
  }
});
