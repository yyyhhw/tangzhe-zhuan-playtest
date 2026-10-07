// Two-slot app UI logic regression, without a browser or third-party packages.
// Run: node preview/pet/accept2/test_pets2_ui_vm.js
// Executes the actual pet section from app.js in a VM. Economy, PetGame, and
// PetEngine are real; only modal DOM, surrounding app globals, and storage are
// in-memory fakes. This does NOT test layout, CSS, canvas drawing, browser event
// propagation, WebKit, device touch behavior, or cat animation acceptance.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const E = require(path.join(ROOT, 'economy.js'));
const PG = require(path.join(ROOT, 'pet/game/petgame.js'));
const PE = require(path.join(ROOT, 'pet/engine.js'));
const PA = require(path.join(ROOT, 'pet/art.js'));
const PP = require(path.join(ROOT, 'pet/puppy.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'pet/art/manifest.json'), 'utf8'));
const APP = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const START = APP.indexOf('const PG = window.PetGame');
const END = APP.indexOf('function homeCommit(', START);
assert(START >= 0 && END > START, 'Cannot locate actual app.js pet UI source; update extraction boundaries, never copy the implementation into the test.');
for (const name of ['view', 'assign', 'norm', 'createRuntime', 'createView']) {
  assert.equal(typeof PG[name], 'function', 'Missing PetGame.' + name + '; UI assertions have not run.');
}
const PET_SOURCE = APP.slice(START, END);
function sourceBetween(start, end) {
  const a = APP.indexOf(start), b = APP.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'Cannot locate app contract source: ' + start);
  return APP.slice(a, b);
}
const ACT_SOURCE = sourceBetween('function act(a, arg, btn)', 'function avaCacheClear(');
const HOME_ACT_SOURCE = sourceBetween('function homeAct(a, arg, b)', 'function homeCellAt(');
const MAIN = 'tangzhe-preview-save', BAK = 'tangzhe-preview-save-bak';
const FORMAL = 'tangzhe-save', SENTINEL = 'formal-save-sentinel-do-not-touch';
const T0 = 1790000000000;
const HOMES = E.CEOS.map(c => c.id);
const clone = value => JSON.parse(JSON.stringify(value));
const snapshot = value => JSON.stringify(value);
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Tiny DOM only models the selectors and direct listeners used by the extracted
// pet modal functions. Rendered room markup is inspected separately as text.
class Element {
  constructor(attrs = {}) {
    this.attrs = attrs;
    this.dataset = {};
    this.listeners = [];
    this.disabled = Object.prototype.hasOwnProperty.call(attrs, 'disabled');
    for (const [name, value] of Object.entries(attrs)) if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
  }
  addEventListener(type, fn, opts = {}) { this.listeners.push({ type, fn, once: !!opts.once }); }
  click() {
    if (this.disabled) return;
    for (const listener of this.listeners.slice()) if (listener.type === 'click') {
      if (listener.once) this.listeners.splice(this.listeners.indexOf(listener), 1);
      listener.fn({ target: this, currentTarget: this });
    }
  }
}
function tags(html, name) {
  return [...html.matchAll(new RegExp('<' + name + '\\b([^>]*)>', 'g'))].map(match => {
    const attrs = {};
    for (const a of match[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = decode(a[2]);
    if (/\bdisabled\b/.test(match[1])) attrs.disabled = '';
    return new Element(attrs);
  });
}
class ModalDOM {
  constructor() {
    this.modal = null;
    this.openCount = 0;
    this.floor = new Element({ id: 'roomFloor' });
    this.floor.getBoundingClientRect = () => ({ left: 10, top: 20, width: 600, height: 600 });
    this.body = { dataset: {} };
  }
  open(html) { this.modal = { html, buttons: tags(html, 'button') }; this.openCount++; }
  close() { this.modal = null; }
  querySelector(selector) {
    if (selector === '#roomFloor') return this.floor;
    if (selector.startsWith('[data-pet-status=')) return null;
    if (selector.startsWith('#')) return this.modal && this.modal.buttons.find(b => b.attrs.id === selector.slice(1)) || null;
    throw new Error('Unmodeled DOM selector: ' + selector);
  }
  querySelectorAll(selector) {
    assert.equal(selector, '#petReplace [data-replace-uid]', 'New selector needs explicit fake-DOM support.');
    return this.modal ? this.modal.buttons.filter(b => 'replaceUid' in b.dataset) : [];
  }
}
class MemoryStorage {
  constructor(st) {
    this.data = new Map([[MAIN, snapshot(st)], [BAK, snapshot(st)], [FORMAL, SENTINEL]]);
    this.ops = [];
    this.failKey = null;
    this.dropKey = null;
  }
  getItem(key) { this.ops.push(['get', key]); return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) {
    this.ops.push(['set', key]);
    if (key === this.failKey) { const e = new Error('Simulated quota'); e.name = 'QuotaExceededError'; throw e; }
    if (key === this.dropKey) return; // Silent write failure exercises real readback verification.
    this.data.set(key, String(value));
  }
  snap() { return snapshot([...this.data.entries()]); }
  writes() { return this.ops.filter(op => op[0] === 'set'); }
}
function fresh({ engines = true, list } = {}) {
  const st = E.migrate(null, T0).st;
  for (const id of HOMES) { st.ceos[id].unlocked = true; st.ceos[id].lv = Math.max(1, st.ceos[id].lv || 1); }
  st.coins = 1000000;
  st.pets = { v: 2, list: (list || [
    { uid: 'a', species: 'dog', room: HOMES[0] },
    { uid: 'b', species: 'dog', room: HOMES[0] },
    { uid: 'c', species: 'cat', room: null },
    { uid: 'd', species: 'dog', room: HOMES[1] },
  ]).map((p, i) => Object.assign({ boughtAt: T0 + i, eng: engines ? {
    v: 1, home: p.room, dog: { x: 1, y: 1, affinity: 51 + i, energy: 61 + i }, savedAt: T0,
  } : null }, p)) };
  PG.norm(st, E);
  assert.deepEqual(E.validState(st), [], 'Test fixture must pass actual Economy validation.');
  assert.deepEqual(E.checkSave(clone(st)), [], 'Test fixture must be readable by actual Economy.');
  return st;
}
function harness(options = {}) {
  const state = options.state || fresh(options);
  const document = new ModalDOM(), storage = new MemoryStorage(state);
  const commits = [], toasts = [], sounds = [];
  const economy = Object.assign({}, E, { commitSave(...args) {
    const result = E.commitSave(...args);
    commits.push({ result: clone(result), args: args.slice(1, 3) });
    return result;
  } });
  const ctx = vm.createContext({
    E: economy, state, localStorage: storage, document,
    window: { PetGame: PG, PetEngine: PE, PetArt: PA, PetPuppy: PP, Node: { DOCUMENT_POSITION_PRECEDING: 2, DOCUMENT_POSITION_FOLLOWING: 4 } },
    Node: { DOCUMENT_POSITION_PRECEDING: 2, DOCUMENT_POSITION_FOLLOWING: 4 },
    saveBlocked: false, frozen: false, TEST_MODE: false, SAVE_KEY: MAIN, BAK_KEY: BAK,
    lastGood: storage.data.get(MAIN), dirty: false, homeWho: HOMES[0], tab: 'home', homeSub: 'room', homeMode: 'live', lastFrame: 0,
    $: selector => document.querySelector(selector),
    openModal: html => document.open(html), closeModal: () => document.close(),
    toast: text => toasts.push(text), sfx: sound => sounds.push(sound),
    now: () => T0, performance: { now: () => 0 }, CSS: { escape: value => value }, console,
    fmt: value => String(value), btn: () => '',
    freeze: () => { ctx.frozen = true; },
    persist: () => { throw new Error('Unexpected generic persist: pet assignments must use petSave / E.commitSave.'); },
    renderTab: () => {},
  });
  vm.runInContext("'use strict';\n" + PET_SOURCE + ACT_SOURCE + HOME_ACT_SOURCE + '\nthis.petUI = { act, petPlace, petRoomBar, petDo, petTap, petChooseReplacement, petSyncActors, petSave, petsHooks, petActors, setManifest(m) { petM = m; } };', ctx, { filename: path.join(ROOT, 'app.js:pet-section-and-dispatch') });
  return { ctx, ui: ctx.petUI, document, storage, commits, toasts, sounds, state };
}
function choices(h) { return h.document.querySelectorAll('#petReplace [data-replace-uid]'); }
function choose(h, uid) {
  const b = choices(h).find(el => el.dataset.replaceUid === uid);
  assert(b, 'No replacement button for ' + uid);
  b.click();
}
function buyDialog(h, mode) {
  h.ui.setManifest(MANIFEST); h.ui.act('homePetBuy', HOMES[0]);
  assert.deepEqual(h.document.modal.buttons.map(b => b.attrs.id), ['petBuyReplace', 'petBuyStandby', 'mNo']);
  assert.equal(h.document.querySelector('#pbYes'), null, 'Full room must request replace/standby before charging.');
  if (mode === 'replace') {
    h.document.querySelector('#petBuyReplace').click();
    assert.deepEqual(choices(h).map(el => el.dataset.replaceUid), ['a', 'b']);
    choose(h, 'a');
  } else h.document.querySelector('#petBuyStandby').click();
  const yes = h.document.querySelector('#pbYes');
  assert(yes, 'Explicit purchase confirmation missing.');
  return yes;
}
function assertIsolation(h) {
  assert.equal(h.storage.data.get(FORMAL), SENTINEL, 'Formal save sentinel changed.');
  assert.deepEqual([...h.storage.data.keys()].sort(), [MAIN, BAK, FORMAL].sort(), 'Unexpected storage key created.');
  assert(h.storage.ops.every(([, key]) => key === MAIN || key === BAK), 'Pet UI accessed a non-preview key.');
}
function assertReadback(h, key) {
  const write = h.storage.ops.findIndex(op => op[0] === 'set' && op[1] === key);
  assert(write >= 0 && h.storage.ops.slice(write + 1).some(op => op[0] === 'get' && op[1] === key), key + ' was not read back after writing.');
}
function assertFailedWithoutMutation(h, before, stored, markup) {
  assert.equal(snapshot(h.state), before, 'Entire in-memory save must roll back, including engines, coins, and revision.');
  assert.equal(h.storage.snap(), stored, 'Previously seeded storage must remain unchanged.');
  assert.equal(h.ui.petRoomBar(HOMES[0]), markup, 'Rendered pet slots/list must remain unchanged.');
  assert(!h.toasts.includes('宠物安排已保存'), 'Failed operation reported success.');
  assertIsolation(h);
}
let passed = 0, failed = 0;
function test(label, run) {
  try { run(); passed++; console.log('PASS ' + label); }
  catch (error) { failed++; console.error('FAIL ' + label + '\n' + error.stack); }
}

test('VM-U1/U2: exactly two slots; every owned pet has its current location', () => {
  const h = harness(), html = h.ui.petRoomBar(HOMES[0]);
  const slots = tags(html, 'div').filter(el => 'petSlot' in el.dataset);
  assert.deepEqual(slots.map(el => [el.dataset.petSlot, el.dataset.uid]), [['0', 'a'], ['1', 'b']]);
  const rows = tags(html, 'div').filter(el => 'petUid' in el.dataset);
  assert.deepEqual(rows.map(el => [el.dataset.petUid, el.dataset.where]), [['a', HOMES[0]], ['b', HOMES[0]], ['c', 'standby'], ['d', HOMES[1]]]);
  assert(html.includes(E.CEO_BY_ID[HOMES[1]].name + '的家'));
  assert(html.includes('待命'));
  assert.deepEqual(tags(html, 'button').filter(el => el.dataset.act === 'homePetPat').map(el => el.dataset.arg), ['a', 'b']);
  const otherSlots = tags(h.ui.petRoomBar(HOMES[1]), 'div').filter(el => 'petSlot' in el.dataset);
  assert.equal(otherSlots.length, 2); assert.equal(otherSlots[0].dataset.uid, 'd'); assert.equal(otherSlots[1].dataset.uid, undefined);
  assertIsolation(h);
});
test('VM-source-contract: parent and standalone pet UI are identical apart from relative art paths', () => {
  const standalone = fs.readFileSync(path.join(ROOT, 'pet/game/app.js'), 'utf8');
  const start = standalone.indexOf('const PG = window.PetGame'), end = standalone.indexOf('function homeCommit(', start);
  assert(start >= 0 && end > start, 'Cannot locate standalone pet source.');
  assert.equal(standalone.slice(start, end).replaceAll("'../art/", "'pet/art/"), PET_SOURCE);
  assert(/a\.indexOf\('pet'\)\s*===\s*0\)\s*return homeAct\(a, arg, btn\)/.test(standalone), 'Standalone dispatch must route pet actions.');
  assert(/function onShow\(\)\s*\{\s*if \(frozen \|\| petManual\) return;/.test(standalone), 'Standalone show lifecycle must honor manual mode.');
});
test('VM-U3/U4: modal contains only both residents; cancel leaves the full save byte-for-byte unchanged', () => {
  const h = harness(), before = snapshot(h.state), stored = h.storage.snap();
  h.ui.petPlace('c');
  assert.deepEqual(choices(h).map(el => el.dataset.replaceUid), ['a', 'b']);
  h.document.querySelector('#petReplaceCancel').click();
  assert.equal(h.document.modal, null); assert.equal(snapshot(h.state), before); assert.equal(h.storage.snap(), stored);
  assert.equal(h.commits.length, 0); assert.equal(h.storage.writes().length, 0); assertIsolation(h);
});
test('VM-U11: placing a current resident again opens no modal and never saves', () => {
  const h = harness(), before = snapshot(h.state), stored = h.storage.snap();
  h.ui.petPlace('a');
  assert.equal(h.document.openCount, 0); assert.equal(snapshot(h.state), before); assert.equal(h.storage.snap(), stored);
  assert.equal(h.commits.length, 0); assertIsolation(h);
});
test('VM-dispatch: actual act() and homeAct() route place, cancel, and standby actions', () => {
  const h = harness(), before = snapshot(h.state);
  h.ui.act('petPlace', 'c');
  assert.deepEqual(choices(h).map(el => el.dataset.replaceUid), ['a', 'b']);
  h.ui.act('petReplaceCancel');
  assert.equal(h.document.modal, null); assert.equal(snapshot(h.state), before);
  h.ui.act('petStandby', 'a');
  assert(PG.view(h.state, E).standby.includes('a')); assert.equal(h.commits.length, 1);
  assert.equal(h.storage.data.get(MAIN), snapshot(h.state)); assertIsolation(h);
});
test('VM-manual: actual hide/show/blur/frame lifecycle code cannot tick or autosave in manual mode', () => {
  const h = harness(), before = snapshot(h.state), stored = h.storage.snap();
  const calls = [], events = {};
  Object.assign(h.ctx, {
    tick: () => calls.push('tick'), audioPause: () => calls.push('audioPause'), audioResume: () => calls.push('audioResume'),
    lockMine: () => { calls.push('lockMine'); return true; }, storedRev: () => { calls.push('storedRev'); return 0; },
    requestAnimationFrame: () => {}, clock: 0, order: {}, special: {},
  });
  h.ctx.window.addEventListener = (name, fn) => { events[name] = fn; };
  const blur = APP.match(/^window\.addEventListener\('blur',.*$/m);
  assert(blur, 'Cannot locate actual blur listener.');
  vm.runInContext("'use strict';\n" + sourceBetween('function onHide()', "document.addEventListener('visibilitychange'") + blur[0] + '\n' + sourceBetween('function frame(ts)', 'function boot()'), h.ctx);
  h.ui.petsHooks.manual(true); h.ctx.onHide(); h.ctx.onShow(); events.blur(); h.ctx.frame(1000);
  assert.deepEqual(calls, []); assert.equal(snapshot(h.state), before); assert.equal(h.storage.snap(), stored);
  assert.equal(h.storage.ops.length, 0); assert.equal(h.commits.length, 0); assertIsolation(h);
});
for (const uid of ['a', 'c']) test('VM-race: stale replacement dialog rejected after ' + uid + ' changes room', () => {
  const h = harness(); h.ui.petPlace('c');
  const staleButton = choices(h).find(el => el.dataset.replaceUid === 'b');
  const change = PG.assign(h.state, E, uid, HOMES[2], { save: () => true });
  assert(change.ok, 'Race setup did not succeed.');
  const afterRace = snapshot(h.state), stored = h.storage.snap();
  staleButton.click();
  assert.equal(snapshot(h.state), afterRace, 'Stale click changed the entire post-race state.');
  assert.equal(h.storage.snap(), stored); assert.equal(h.commits.length, 0); assert.equal(h.document.modal, null);
  assert(h.toasts.some(text => /位置已变化/.test(text))); assertIsolation(h);
});
test('VM-U5: choosing a resident uses real commitSave, verifies readback, and survives reload', () => {
  const h = harness(), before = clone(h.state), raw = h.storage.data.get(MAIN);
  const growth = Object.fromEntries(Object.entries(PG.view(h.state, E).pets).map(([uid, p]) => [uid, snapshot(p.eng)]));
  h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.document.modal, null); assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, true);
  assert.deepEqual(h.commits[0].args, [MAIN, BAK]); assertReadback(h, BAK); assertReadback(h, MAIN);
  const view = PG.view(h.state, E);
  assert.deepEqual(view.rooms[HOMES[0]], ['a', 'c']); assert(view.standby.includes('b'));
  assert.equal(h.state.coins, before.coins); assert.equal(h.state.rev, before.rev + 1);
  for (const [uid, p] of Object.entries(view.pets)) assert.equal(snapshot(p.eng), growth[uid]);
  const unrelated = s => { const out = clone(s); delete out.pets; delete out.pet; delete out.rev; return out; };
  assert.deepEqual(unrelated(h.state), unrelated(before));
  assert.equal(h.storage.data.get(MAIN), snapshot(h.state)); assert.equal(h.storage.data.get(BAK), raw);
  const reloaded = E.loadSave(h.storage.data.get(MAIN), h.storage.data.get(BAK), T0).st;
  PG.norm(reloaded, E); assert.deepEqual(PG.view(reloaded, E), view);
  assert.equal(h.ctx.lastGood, snapshot(h.state)); assert(h.toasts.includes('宠物安排已保存')); assertIsolation(h);
});
test('VM-U5b: a vacancy assigns directly without replacement and commits once', () => {
  const h = harness(); h.ui.petPlace('c', HOMES[1]);
  assert.equal(h.document.openCount, 0); assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, true);
  assert.deepEqual(PG.view(h.state, E).rooms[HOMES[1]], ['c', 'd']);
  assert.equal(h.storage.data.get(MAIN), snapshot(h.state)); assertIsolation(h);
});
test('VM-live-view: uninitialized saved engines expose stable live growth without mutating the save', () => {
  const h = harness({ engines: false }), before = snapshot(h.state); h.ui.setManifest(MANIFEST);
  const live = h.ui.petsHooks.view();
  for (const uid of ['a', 'b', 'd']) assert.equal(live.pets[uid].eng.dog.affinity, PE.CFG.AFF0);
  assert.equal(snapshot(h.state), before, 'Viewing live growth mutated saved state.');
  live.pets.a.eng.dog.affinity = 777;
  assert.equal(h.ui.petsHooks.world('a').dog.affinity, PE.CFG.AFF0, 'View exposed the mutable runtime snapshot.');
  assert.equal(snapshot(h.state), before);
  h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.commits[0].result.ok, true);
  const saved = snapshot(h.state), after = h.ui.petsHooks.view();
  for (const uid of ['a', 'b', 'd']) assert.equal(after.pets[uid].eng.dog.affinity, PE.CFG.AFF0, 'Replacement changed live growth for ' + uid);
  assert.equal(snapshot(h.state), saved, 'Viewing after replacement mutated saved state.'); assertIsolation(h);
});
test('VM-buy-cancel: every full-room purchase decision remains nonmutating until confirmation', () => {
  for (const stage of ['initial', 'picker', 'replace', 'standby']) {
    const h = harness(), before = snapshot(h.state), stored = h.storage.snap(); h.ui.setManifest(MANIFEST);
    if (stage === 'replace' || stage === 'standby') buyDialog(h, stage);
    else {
      h.ui.act('homePetBuy', HOMES[0]);
      assert.equal(h.document.querySelector('#pbYes'), null);
      if (stage === 'picker') h.document.querySelector('#petBuyReplace').click();
    }
    h.document.querySelector(stage === 'picker' ? '#petReplaceCancel' : '#mNo').click();
    assert.equal(h.document.modal, null); assert.equal(snapshot(h.state), before, 'Cancelled stage: ' + stage);
    assert.equal(h.storage.snap(), stored); assert.equal(h.commits.length, 0); assert.equal(h.storage.writes().length, 0); assertIsolation(h);
  }
});
for (const mode of ['replace', 'standby']) test('VM-buy-' + mode + ': explicit confirmation charges once, persists, and reads back', () => {
  const h = harness(), before = clone(h.state), raw = h.storage.data.get(MAIN);
  const yes = buyDialog(h, mode);
  assert.equal(snapshot(h.state), snapshot(before)); assert.equal(h.commits.length, 0);
  yes.click(); yes.click(); // Direct listeners are once-only, so a queued repeat cannot charge twice.
  const v = PG.view(h.state, E), newIds = Object.keys(v.pets).filter(uid => !['a', 'b', 'c', 'd'].includes(uid));
  assert.equal(newIds.length, 1); const uid = newIds[0];
  assert.equal(h.state.coins, before.coins - PG.PET.price); assert.equal(h.state.rev, before.rev + 1);
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, true); assert.equal(h.document.modal, null);
  assert.equal(v.pets[uid].species, 'dog');
  if (mode === 'replace') { assert.deepEqual(v.rooms[HOMES[0]], ['b', uid]); assert(v.standby.includes('a')); }
  else { assert.deepEqual(v.rooms[HOMES[0]], ['a', 'b']); assert(v.standby.includes(uid)); }
  for (const p of before.pets.list) assert.equal(snapshot(v.pets[p.uid].eng), snapshot(p.eng), 'Purchase changed existing growth.');
  assertReadback(h, MAIN); assertReadback(h, BAK);
  assert.equal(h.storage.data.get(MAIN), snapshot(h.state)); assert.equal(h.storage.data.get(BAK), raw); assertIsolation(h);
});
for (const mode of ['replace', 'standby']) test('VM-buy-stale-' + mode + ': stale confirmation preserves the complete post-race state', () => {
  const h = harness(), yes = buyDialog(h, mode);
  assert(PG.assign(h.state, E, 'b', HOMES[2], { save: () => true }).ok);
  const afterRace = snapshot(h.state), stored = h.storage.snap();
  yes.click();
  assert.equal(snapshot(h.state), afterRace); assert.equal(h.storage.snap(), stored); assert.equal(h.commits.length, 0);
  assert(h.toasts.some(text => /位置已变化/.test(text))); assert.equal(h.document.modal, null); assertIsolation(h);
});
for (const key of [BAK, MAIN]) test('VM-buy-quota: ' + key + ' failure rolls back new ownership, payment, and live engine snapshots', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  h.ui.petsHooks.world('a').dog.affinity = 88;
  const before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  const yes = buyDialog(h, 'replace'); h.storage.failKey = key; yes.click();
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, false);
  assertFailedWithoutMutation(h, before, stored, markup);
});
for (const key of [BAK, MAIN]) test('VM-U6: quota failure at ' + key + ' rolls back full state, even with live engine preparation', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  h.ui.petsHooks.world('a').dog.affinity = 88;
  h.ui.petsHooks.world('b').dog.affinity = 99;
  const before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  h.storage.failKey = key;
  h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, false);
  assert.equal(h.commits[0].result.stage, key === BAK ? 'bak' : 'main');
  assertFailedWithoutMutation(h, before, stored, markup);
  assert(h.toasts.some(text => /保存失败/.test(text)));
});
for (const key of [BAK, MAIN]) test('VM-readback: silently dropped ' + key + ' write cannot report success', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  h.ui.petsHooks.world('a').dog.affinity = 88;
  h.ui.petsHooks.world('b').dog.affinity = 99;
  // A distinct, valid prior backup ensures a silently dropped backup write is detectable.
  if (key === BAK) { const old = clone(h.state); old.coins--; h.storage.data.set(BAK, snapshot(old)); }
  const before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  h.storage.dropKey = key; h.ui.petPlace('c'); choose(h, 'a');
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, false); assertReadback(h, key);
  assertFailedWithoutMutation(h, before, stored, markup);
});
for (const mode of ['quota', 'silent']) for (const key of [BAK, MAIN]) test('VM-live-rollback: ' + mode + ' ' + key + ' failure preserves live worlds and unsaved growth through resync and retry', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  const worlds = { a: h.ui.petsHooks.world('a'), b: h.ui.petsHooks.world('b'), d: h.ui.petsHooks.world('d') };
  worlds.a.dog.affinity = 88; worlds.a.dog.energy = 12.75;
  worlds.b.dog.affinity = 99; worlds.b.dog.energy = 34.5;
  worlds.d.dog.affinity = 70; worlds.d.dog.energy = 45.25;
  const growth = Object.fromEntries(Object.entries(worlds).map(([uid, w]) => [uid, { affinity: w.dog.affinity, energy: w.dog.energy }]));
  const liveBefore = Object.fromEntries(Object.entries(worlds).map(([uid, w]) => [uid, snapshot(PE.snapshot(w))]));
  if (mode === 'silent' && key === BAK) { const old = clone(h.state); old.coins--; h.storage.data.set(BAK, snapshot(old)); }
  const before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  h.storage[mode === 'quota' ? 'failKey' : 'dropKey'] = key;
  h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.ok, false);
  assertFailedWithoutMutation(h, before, stored, markup);
  for (const [uid, oldWorld] of Object.entries(worlds)) {
    const synced = h.ui.petsHooks.world(uid);
    assert.equal(synced, oldWorld, 'Failed preparation rebuilt live world ' + uid + ' on next sync.');
    assert.equal(snapshot(PE.snapshot(synced)), liveBefore[uid], 'Unsaved live affinity/energy changed after failed-save sync for ' + uid);
  }
  const liveView = h.ui.petsHooks.view();
  for (const [uid, values] of Object.entries(growth)) for (const [field, value] of Object.entries(values)) assert.equal(liveView.pets[uid].eng.dog[field], value);
  assertFailedWithoutMutation(h, before, stored, markup);
  // Recovery must retain both the displaced dog and unaffected resident/off-room
  // dogs. A retry must save their exact live growth, rather than the old checkpoint.
  h.storage.failKey = h.storage.dropKey = null;
  h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.commits.length, 2); assert.equal(h.commits[1].result.ok, true);
  const after = h.ui.petsHooks.view(), savedAfter = snapshot(h.state);
  assert.deepEqual(after.rooms[HOMES[0]], ['a', 'c']); assert(after.standby.includes('b'));
  for (const [uid, values] of Object.entries(growth)) for (const [field, value] of Object.entries(values)) {
    assert.equal(after.pets[uid].eng.dog[field], value, 'Successful retry lost live ' + field + ' for ' + uid);
    assert.equal(PG.view(h.state, E).pets[uid].eng.dog[field], value, 'Successful retry failed to persist ' + field + ' for ' + uid);
  }
  assert.equal(h.ui.petsHooks.world('a'), worlds.a, 'Successful retry rebuilt the unaffected resident.');
  assert.equal(h.ui.petsHooks.world('d'), worlds.d, 'Successful retry rebuilt the unaffected off-room dog.');
  assert.equal(snapshot(h.state), savedAfter); assert.equal(h.storage.data.get(MAIN), savedAfter);
  assert.equal(h.state.coins, JSON.parse(before).coins); assert.equal(h.state.rev, JSON.parse(before).rev + 1); assertIsolation(h);
});
for (const flag of ['saveBlocked', 'frozen']) test('VM-blocked: ' + flag + ' forbids writes and preserves full state', () => {
  const h = harness(), before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  h.ctx[flag] = true; h.ui.petPlace('c'); choose(h, 'b');
  assert.equal(h.commits.length, 0); assert.equal(h.storage.writes().length, 0);
  assertFailedWithoutMutation(h, before, stored, markup);
});
test('VM-conflict: a newer stored revision wins; local assignment rolls back and freezes', () => {
  const h = harness(), newer = clone(h.state); newer.rev += 5;
  h.storage.data.set(MAIN, snapshot(newer));
  const before = snapshot(h.state), stored = h.storage.snap(), markup = h.ui.petRoomBar(HOMES[0]);
  h.ui.petPlace('c'); choose(h, 'a');
  assert.equal(h.commits.length, 1); assert.equal(h.commits[0].result.stage, 'conflict'); assert.equal(h.ctx.frozen, true);
  assert.equal(h.storage.writes().length, 0); assertFailedWithoutMutation(h, before, stored, markup);
});
test('VM-U7: direct controls target one real dog runtime; another room is not interactive', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  const a = h.ui.petsHooks.world('a'), b = h.ui.petsHooks.world('b'), d = h.ui.petsHooks.world('d');
  assert(a && b && d); assert.notEqual(a, b);
  const beforeA = snapshot(PE.snapshot(a)), beforeB = snapshot(PE.snapshot(b)), beforeD = snapshot(PE.snapshot(d));
  h.ui.act('homePetPat', 'a');
  assert.notEqual(snapshot(PE.snapshot(a)), beforeA, 'Selected dog did not react.');
  assert.equal(snapshot(PE.snapshot(b)), beforeB, 'Other resident dog reacted.');
  assert.equal(snapshot(PE.snapshot(d)), beforeD, 'Dog in another room reacted.');
  const afterA = snapshot(PE.snapshot(a));
  h.ui.petDo('pet', 'd'); h.ui.petDo('pet', 'missing');
  assert.equal(snapshot(PE.snapshot(a)), afterA); assert.equal(snapshot(PE.snapshot(b)), beforeB); assert.equal(snapshot(PE.snapshot(d)), beforeD);
  assertIsolation(h);
});
test('VM-U7b: overlapping tap goes only to the topmost resident, not all dogs', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  const a = h.ui.petsHooks.world('a'), b = h.ui.petsHooks.world('b'), d = h.ui.petsHooks.world('d');
  a.dog.x = b.dog.x = d.dog.x = 2;
  a.dog.y = 2; b.dog.y = 2.1; d.dog.y = 2.2;
  const beforeA = snapshot(PE.snapshot(a)), beforeB = snapshot(PE.snapshot(b)), beforeD = snapshot(PE.snapshot(d));
  const tile = 600 / a.cols;
  assert.equal(h.ui.petTap({ clientX: 10 + 2 * tile, clientY: 20 + 1.6 * tile }), true);
  assert.equal(snapshot(PE.snapshot(a)), beforeA); assert.notEqual(snapshot(PE.snapshot(b)), beforeB); assert.equal(snapshot(PE.snapshot(d)), beforeD);
  assert.equal(h.ui.petTap({ clientX: -100, clientY: -100 }), false); assertIsolation(h);
});
for (const scenario of [
  { name: 'equal y uses later insertion when sprites are not drawn', ay: 2.04, by: 2.04, top: 'b' },
  { name: 'same 0.1 layer favors later insertion even with a lower y', ay: 2.09, by: 2.01, top: 'b' },
  { name: 'equal y follows actual DOM order rather than map order', ay: 2.04, by: 2.04, top: 'a', order: ['b', 'a'] },
  { name: 'same layer favors the lower-y later DOM sibling', ay: 2.01, by: 2.09, top: 'a', order: ['b', 'a'] },
  { name: 'rendered z-index takes precedence over current world y and sibling order', ay: 2.01, by: 2.19, top: 'a', order: ['a', 'b'], z: { a: 40, b: 30 } },
]) test('VM-tap-layer: ' + scenario.name, () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  const worlds = { a: h.ui.petsHooks.world('a'), b: h.ui.petsHooks.world('b'), d: h.ui.petsHooks.world('d') };
  worlds.a.dog.x = worlds.b.dog.x = worlds.d.dog.x = 2;
  worlds.a.dog.y = scenario.ay; worlds.b.dog.y = scenario.by; worlds.d.dog.y = 2.2;
  if (scenario.order) {
    // Minimal connected sprite nodes exercise actual app sorting without drawing
    // canvas or pretending that this is a browser rendering assertion.
    const nodes = {};
    for (const [index, uid] of scenario.order.entries()) nodes[uid] = {
      uid, index, parentNode: h.document.floor, isConnected: true,
      style: { zIndex: String(scenario.z ? scenario.z[uid] : 10 + Math.floor(worlds[uid].dog.y * 10)) },
      compareDocumentPosition(other) { return this.index < other.index ? 4 : this.index > other.index ? 2 : 0; },
    };
    for (const uid of scenario.order) {
      const actor = h.ui.petActors.get(uid), original = actor.view;
      actor.view = { ...original, els: { dog: nodes[uid] } };
    }
  }
  const before = Object.fromEntries(Object.entries(worlds).map(([uid, w]) => [uid, snapshot(PE.snapshot(w))]));
  const tile = 600 / worlds.a.cols;
  assert.equal(h.ui.petTap({ clientX: 10 + 2 * tile, clientY: 20 + 1.6 * tile }), true);
  for (const [uid, w] of Object.entries(worlds)) {
    if (uid === scenario.top) assert.notEqual(snapshot(PE.snapshot(w)), before[uid], 'Topmost dog did not receive the tap.');
    else assert.equal(snapshot(PE.snapshot(w)), before[uid], 'A non-topmost dog received the tap: ' + uid);
  }
  assertIsolation(h);
});
test('VM-tap-remount: the newly appended sprite becomes topmost without changing actor map order', () => {
  const h = harness({ engines: false }); h.ui.setManifest(MANIFEST);
  const a = h.ui.petsHooks.world('a'), b = h.ui.petsHooks.world('b');
  a.dog.x = b.dog.x = 2; a.dog.y = 2.01; b.dog.y = 2.09;
  const node = index => ({ index, parentNode: h.document.floor, isConnected: true, style: { zIndex: '30' },
    compareDocumentPosition(other) { return this.index < other.index ? 4 : this.index > other.index ? 2 : 0; } });
  const oldA = node(0), nodeB = node(1), actorA = h.ui.petActors.get('a'), actorB = h.ui.petActors.get('b');
  actorA.view = { ...actorA.view, els: { dog: oldA } }; actorB.view = { ...actorB.view, els: { dog: nodeB } };
  const point = { clientX: 10 + 2 * (600 / a.cols), clientY: 20 + 1.6 * (600 / a.cols) };
  const beforeA = snapshot(PE.snapshot(a)), beforeB = snapshot(PE.snapshot(b));
  assert.equal(h.ui.petTap(point), true);
  assert.equal(snapshot(PE.snapshot(a)), beforeA); assert.notEqual(snapshot(PE.snapshot(b)), beforeB);
  oldA.parentNode = null; oldA.isConnected = false;
  actorA.view = { ...actorA.view, els: { dog: node(2) } }; // Simulate a remount appended after b.
  const mapOrder = [...h.ui.petActors.keys()], midA = snapshot(PE.snapshot(a)), midB = snapshot(PE.snapshot(b));
  assert.equal(h.ui.petTap(point), true);
  assert.notEqual(snapshot(PE.snapshot(a)), midA, 'Remounted later sibling did not receive the second tap.');
  assert.equal(snapshot(PE.snapshot(b)), midB, 'Former topmost dog received the second tap.');
  assert.deepEqual([...h.ui.petActors.keys()], mapOrder); assertIsolation(h);
});
test('VM-escaping: quotes and HTML in uid remain text and the selected identity round-trips', () => {
  const hostile = 'pet"><img src=x onerror="bad">&\'';
  const h = harness({ list: [
    { uid: hostile, species: 'dog', room: HOMES[0] },
    { uid: 'b', species: 'dog', room: HOMES[0] },
    { uid: 'c', species: 'cat', room: null },
  ] });
  const html = h.ui.petRoomBar(HOMES[0]);
  assert(!html.includes('<img')); assert(!html.includes(hostile));
  assert(html.includes('pet&quot;&gt;&lt;img src=x onerror=&quot;bad&quot;&gt;&amp;&#39;'));
  const slots = tags(html, 'div').filter(el => 'petSlot' in el.dataset);
  assert.equal(slots.length, 2); assert.equal(slots[0].dataset.uid, hostile);
  h.ui.act('petPlace', 'c');
  assert(!h.document.modal.html.includes('<img'));
  assert.deepEqual(choices(h).map(el => el.dataset.replaceUid), [hostile, 'b']);
  choose(h, hostile);
  assert.equal(h.commits[0].result.ok, true); assert(PG.view(h.state, E).standby.includes(hostile)); assertIsolation(h);
});

console.log(`UI VM cases passed ${passed}, failed ${failed}. No browser/layout/device claims.`);
process.exitCode = failed ? 1 : 0;
