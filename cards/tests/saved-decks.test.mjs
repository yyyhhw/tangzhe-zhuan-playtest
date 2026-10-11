// node --test cards/tests/saved-decks.test.mjs preview/cards/tests/saved-decks.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {defaultDeck} from '../cardcore.mjs';
import {classIds, emptyLibrary, validateLibrary, deckStorageKey, createSavedDeckStore, templateDeck, MAX_SAVED_DECKS, MAX_DECK_NAME_LENGTH} from '../ui/saved-decks.mjs';

function fakeStorage(entries = {}) {
  const values = new Map(Object.entries(entries)), writes = [], reads = [];
  return {values, writes, reads,
    getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes.push([key, value]); values.set(key, String(value)); }
  };
}
function webLocks() {
  const chains = new Map(), names = []; let active = 0;
  return {names, get active() { return active; }, request(name, options, callback) {
    assert.deepEqual(options, {mode:'exclusive'}); names.push(name);
    const previous = chains.get(name) || Promise.resolve();
    const next = previous.then(async () => { active++; try { return await callback({name, mode:'exclusive'}); } finally { active--; } });
    chains.set(name, next.catch(() => {})); return next;
  }};
}
const key = deckStorageKey('https://example.test/tangzhe-zhuan-playtest/cards/ui/index.html');
function library(overrides = {}) {
  return {...emptyLibrary(), decks:[{id:'deck-1', name:'我的战士', classId:'warrior', cards:[]}], selectedDeckIds:{...emptyLibrary().selectedDeckIds, warrior:'deck-1'}, ...overrides};
}
function setup(raw) {
  const storage = fakeStorage(raw === undefined ? {} : {[key]:raw}), locks = webLocks();
  return {storage, locks, store:createSavedDeckStore({storage, locks, key})};
}

test('scope keys isolate formal and preview pages/modules, ignore query and hash', () => {
  const formal = 'tangzhe-formal-card-decks-v1', preview = 'tangzhe-preview-card-decks-v1';
  for (const url of ['/cards/ui/index.html', '/tangzhe-zhuan-playtest/cards/ui/saved-decks.mjs?v=preview', '/cards/ui/index.html#preview']) assert.equal(deckStorageKey(url), formal);
  for (const url of ['/preview/cards/ui/index.html', 'https://x.test/tangzhe-zhuan-playtest/preview/cards/ui/saved-decks.mjs?v=1', '/%70review/cards/ui/index.html']) assert.equal(deckStorageKey(url), preview);
  assert.equal(deckStorageKey('/previewish/cards/ui/index.html'), formal);
});

test('root/preview source mirrors are byte-identical', async () => {
  const here = new URL('../ui/saved-decks.mjs', import.meta.url);
  const root = here.pathname.includes('/preview/') ? new URL('../../../cards/ui/saved-decks.mjs', import.meta.url) : here;
  const preview = here.pathname.includes('/preview/') ? here : new URL('../../preview/cards/ui/saved-decks.mjs', import.meta.url);
  assert.equal(await readFile(root, 'utf8'), await readFile(preview, 'utf8'));
});

test('empty load is detached, never initializes or modifies any storage key', () => {
  const {store, storage} = setup();
  const first = store.load();
  assert.equal(first.ok, true); assert.equal(first.raw, null); assert.deepEqual(first.data, emptyLibrary());
  first.data.selectedDeckIds.warrior = 'modified';
  assert.equal(store.load().data.selectedDeckIds.warrior, null);
  assert.equal(storage.writes.length, 0); assert.deepEqual(storage.reads, [key, key]);
});

test('explicit save survives reload with per-class selections and active class', async () => {
  const {store, storage, locks} = setup();
  const next = library({activeClassId:'mage'});
  next.decks.push({id:'deck-2', name:'法师', classId:'mage', cards:defaultDeck('mage')});
  next.selectedDeckIds.mage = 'deck-2';
  const saved = await store.commit(next, null);
  assert.equal(saved.ok, true); assert.equal(saved.data.revision, 1); assert.equal(next.revision, 0);
  assert.equal(saved.raw, storage.values.get(key));
  const loaded = createSavedDeckStore({storage, locks, key}).load();
  assert.deepEqual(loaded, saved); assert.equal(loaded.data.activeClassId, 'mage');
  loaded.data.decks[1].cards.pop();
  assert.equal(store.load().data.decks[1].cards.length, 30);
  assert.deepEqual(locks.names, [key + ':write']);
});

test('all four current base templates are legal cloned recipes', () => {
  for (const classId of classIds) {
    const base = templateDeck(classId, defaultDeck);
    assert.deepEqual(base, {classId, cards:defaultDeck(classId)});
    const next = library(); next.decks[0] = {...next.decks[0], classId, cards:base.cards};
    next.selectedDeckIds = {...emptyLibrary().selectedDeckIds, [classId]:'deck-1'};
    assert.equal(validateLibrary(next).ok, true);
    base.cards.pop(); assert.equal(defaultDeck(classId).length, 30);
  }
});

test('saved recipes permit incomplete counts, unowned and retired card IDs', async () => {
  const {store} = setup();
  let raw = null;
  for (const size of [0, 1, 29, 30]) {
    const next = raw === null ? library() : store.load().data;
    next.decks[0].cards = Array.from({length:size}, (_, i) => `retiredCard${Math.floor(i / 2)}`);
    const result = await store.commit(next, raw);
    assert.equal(result.ok, true, `${size} cards`); raw = result.raw;
    assert.equal(store.load().data.decks[0].cards.length, size);
  }
});

test('template changes cannot overwrite saved custom or retired recipes on load', async () => {
  const {store, storage} = setup();
  const custom = library(); custom.decks[0].cards = ['retiredCard', 'retiredCard'];
  const saved = await store.commit(custom, null), before = [...storage.writes];
  const upgradedTemplate = templateDeck('warrior', () => ['newTemplateCard']);
  assert.deepEqual(upgradedTemplate.cards, ['newTemplateCard']);
  assert.equal(store.load().raw, saved.raw); assert.deepEqual(store.load().data.decks[0].cards, custom.decks[0].cards);
  assert.deepEqual(storage.writes, before);
});

test('same-class trimmed case-insensitive names are unique, cross-class names allowed', () => {
  const next = library(); next.decks[0].name = ' Alpha ';
  next.decks.push({id:'second', name:'alpha', classId:'warrior', cards:[]});
  assert.equal(validateLibrary(next).error, 'duplicate-name');
  next.decks[1].classId = 'mage'; assert.equal(validateLibrary(next).ok, true);
});

test('structural boundaries: counts, duplicate IDs, selected class, names, schema', () => {
  const invalid = [
    x => { x.schemaVersion = 2; },
    x => { x.schemaVersion = 0; },
    x => { x.revision = -1; },
    x => { x.revision = 0.5; },
    x => { x.activeClassId = 'neutral'; },
    x => { x.decks[0].classId = 'priest'; },
    x => { x.decks[0].id = ''; },
    x => { x.decks[0].id = '<script>'; },
    x => { x.decks[0].name = ' '; },
    x => { x.decks[0].name = 'bad\nname'; },
    x => { x.decks[0].name = 'x'.repeat(MAX_DECK_NAME_LENGTH + 1); },
    x => { x.decks[0].cards = Array.from({length:31}, (_, i) => `card${i}`); },
    x => { x.decks[0].cards = ['same', 'same', 'same']; },
    x => { x.decks[0].cards = ['']; },
    x => { x.decks[0].cards = [null]; },
    x => { x.decks[0].cards = new Array(1); },
    x => { x.decks[0].cards.extra = true; },
    x => { x.decks[0].unexpected = true; },
    x => { x.unexpected = true; },
    x => { x.decks.push({...x.decks[0], name:'second'}); },
    x => { x.selectedDeckIds.mage = 'deck-1'; },
    x => { x.selectedDeckIds.warrior = 'missing'; },
    x => { delete x.selectedDeckIds.warlock; },
    x => { x.decks = Array.from({length:MAX_SAVED_DECKS + 1}, (_, i) => ({id:`d${i}`, name:`Deck ${i}`, classId:'warrior', cards:[]})); },
  ];
  for (const change of invalid) { const value = library(); change(value); assert.equal(validateLibrary(value).ok, false, String(change)); }
  const boundary = library(); boundary.decks[0].name = 'x'.repeat(MAX_DECK_NAME_LENGTH); assert.equal(validateLibrary(boundary).ok, true);
  boundary.decks = Array.from({length:MAX_SAVED_DECKS}, (_, i) => ({id:`d${i}`, name:`Deck ${i}`, classId:'warrior', cards:[]}));
  boundary.selectedDeckIds.warrior = 'd0'; assert.equal(validateLibrary(boundary).ok, true);
});

test('validation never invokes accessor properties or custom serialization', () => {
  let calls = 0;
  const getter = library(); Object.defineProperty(getter.decks[0], 'name', {get() { calls++; return 'unsafe'; }, enumerable:true});
  assert.equal(validateLibrary(getter).ok, false);
  const custom = library(); custom.toJSON = () => { calls++; return library(); };
  assert.equal(validateLibrary(custom).ok, false); assert.equal(calls, 0);
});

test('malformed, future, unknown-field and invalid records are never rewritten', async () => {
  const records = ['garbled', '', 'null', '{}', JSON.stringify({...library(), schemaVersion:99, futureField:true}), JSON.stringify({...library(), schemaVersion:0}), JSON.stringify({...library(), futureField:true}), JSON.stringify({...library(), selectedDeckIds:{}})];
  for (const original of records) {
    const {store, storage} = setup(original);
    assert.equal(store.load().ok, false);
    const result = await store.commit(library(), original);
    assert.equal(result.ok, false); assert.equal(storage.values.get(key), original); assert.equal(storage.writes.length, 0);
  }
  const future = setup(JSON.stringify({schemaVersion:2, otherShape:true}));
  assert.equal(future.store.load().error, 'future-version');
});

test('missing Web Locks or rejected locks are read-only', async () => {
  const storage = fakeStorage();
  for (const locks of [undefined, {}, {request:async () => { throw Error('Denied'); }}]) {
    const store = createSavedDeckStore({storage, locks, key});
    assert.equal(store.load().ok, true); assert.equal((await store.commit(library(), null)).error, 'unavailable-locks');
  }
  assert.equal(storage.writes.length, 0);
});

test('stale tabs cannot overwrite a successful write, even with same revision JSON', async () => {
  const {store, storage, locks} = setup(), second = createSavedDeckStore({storage, locks, key});
  const a = store.load(), b = second.load();
  a.data = library(); b.data = library(); b.data.decks[0].name = 'Another';
  const [one, two] = await Promise.all([store.commit(a.data, a.raw), second.commit(b.data, b.raw)]);
  assert.equal(one.ok, true); assert.equal(two.error, 'conflict'); assert.equal(storage.writes.length, 1);
  assert.equal(second.load().data.decks[0].name, '我的战士');
  const external = JSON.stringify({...one.data, decks:[{...one.data.decks[0], name:'Non-cooperating writer'}]}, null, 2);
  storage.values.set(key, external);
  assert.equal((await store.commit(one.data, one.raw)).error, 'conflict'); assert.equal(storage.values.get(key), external);
});

test('revision mismatch, omitted expectedRaw, and overflow never write', async () => {
  const {store, storage} = setup();
  assert.equal((await store.commit(library())).error, 'expected-raw-required');
  assert.equal((await store.commit(library({revision:4}), null)).error, 'conflict');
  const full = library({revision:Number.MAX_SAFE_INTEGER}), raw = JSON.stringify(full);
  storage.values.set(key, raw);
  assert.equal((await store.commit(full, raw)).error, 'revision-exhausted'); assert.equal(storage.writes.length, 0);
});

test('a queued commit snapshots intent before caller can mutate it', async () => {
  let run;
  const locks = {request(_name, _options, callback) { return new Promise(resolve => { run = () => resolve(callback()); }); }};
  const storage = fakeStorage(), store = createSavedDeckStore({storage, locks, key});
  const next = library(), pending = store.commit(next, null);
  next.decks[0].name = 'Changed while waiting'; next.decks[0].cards.push('later');
  run(); const result = await pending;
  assert.equal(result.ok, true); assert.equal(result.data.decks[0].name, '我的战士'); assert.deepEqual(result.data.decks[0].cards, []);
});

test('read errors, quota failure, and unverifiable writes are reported without rollback', async () => {
  const {store, storage} = setup();
  storage.getItem = () => { throw Error('Disabled'); };
  assert.equal(store.load().error, 'storage-read'); assert.equal((await store.commit(library(), null)).error, 'storage-read');
  assert.equal(storage.writes.length, 0);
  const quota = setup(); quota.storage.setItem = () => { throw Error('QuotaExceededError'); };
  assert.equal((await quota.store.commit(library(), null)).error, 'storage-write'); assert.equal(quota.storage.values.has(key), false);
  const dropped = setup(); dropped.storage.setItem = () => {};
  assert.equal((await dropped.store.commit(library(), null)).error, 'storage-verify');
  const unreadable = setup(), get = unreadable.storage.getItem; let attempts = 0;
  unreadable.storage.getItem = k => { if (++attempts > 1) throw Error('Read disabled after write'); return get(k); };
  assert.equal((await unreadable.store.commit(library(), null)).error, 'storage-verify'); assert.equal(unreadable.storage.writes.length, 1);
  const replaced = setup(); replaced.storage.setItem = () => { replaced.storage.values.set(key, 'external-data'); };
  assert.equal((await replaced.store.commit(library(), null)).error, 'storage-verify'); assert.equal(replaced.storage.values.get(key), 'external-data');
});

test('writes occur under the one dedicated lock and preserve all other saves', async () => {
  const otherKeys = {'tangzhe-save':'money', 'tangzhe-save-bak':'money-backup', 'tangzhe-formal-card-save':'match', 'tangzhe-preview-card-save':'preview-match', 'tangzhe-formal-card-collection':'collection', 'unrelated':'keep'};
  const storage = fakeStorage(otherKeys), locks = webLocks(), originalSet = storage.setItem;
  storage.setItem = (k, v) => { assert.equal(locks.active, 1); assert.equal(k, key); originalSet(k, v); };
  const store = createSavedDeckStore({storage, locks, key});
  const first = await store.commit(library(), null); assert.equal(first.ok, true);
  const second = {...first.data, decks:[], selectedDeckIds:{...emptyLibrary().selectedDeckIds}};
  assert.equal((await store.commit(second, first.raw)).ok, true);
  for (const [k, value] of Object.entries(otherKeys)) assert.equal(storage.values.get(k), value);
  assert.ok(storage.reads.every(k => k === key)); assert.ok(storage.writes.every(([k]) => k === key));
});
