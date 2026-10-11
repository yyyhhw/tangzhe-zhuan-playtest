/**
 * Local recipe library only. Never reads/writes collection, money or match keys.
 * Templates are provided by the UI and are never migrated into saved recipes.
 * A Web Lock plus exact raw-value CAS makes cooperating tabs serialize writes.
 */
export const SAVED_DECK_SCHEMA_VERSION = 1;
export const MAX_SAVED_DECKS = 100;
export const MAX_DECK_NAME_LENGTH = 60;
export const classIds = Object.freeze(['warrior', 'mage', 'paladin', 'warlock']);
const MAX_RAW_LENGTH = 512000;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_DECK_NAME_LENGTH && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const failure = (error, raw = null, detail) => ({ok:false, data:null, raw, error, ...(detail ? {detail} : {})});

/** Accept a page URL or module URL. Root and preview remain separate on Pages. */
export function deckStorageKey(url = import.meta.url) {
  const path = new URL(String(url), 'https://saved-decks.invalid/').pathname;
  const preview = path.split('/').some(part => {
    try { return decodeURIComponent(part) === 'preview'; } catch { return false; }
  });
  return preview ? 'tangzhe-preview-card-decks-v1' : 'tangzhe-formal-card-decks-v1';
}

export function emptyLibrary() {
  return {schemaVersion:SAVED_DECK_SCHEMA_VERSION, revision:0, activeClassId:'warrior', decks:[], selectedDeckIds:Object.fromEntries(classIds.map(id => [id, null]))};
}

// Reject accessors, custom serialization and unrecognized fields rather than
// accidentally normalizing them away. Successful validation returns fresh data.
function record(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  const own = Reflect.ownKeys(value);
  if (own.length !== keys.length || own.some(key => !keys.includes(key))) return false;
  return keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return d && d.enumerable && Object.hasOwn(d, 'value');
  });
}

function denseArray(value, max) {
  if (!Array.isArray(value) || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !d.enumerable || !Object.hasOwn(d, 'value')) return false;
  }
  return true;
}

/**
 * Validate the durable recipe shape, not current ownership/playability.
 * Unknown/retired card IDs survive catalog upgrades for later editing. The UI
 * checks current card class/cap rules when adding cards and before starting.
 */
export function validateLibrary(value) {
  try {
    if (!record(value, ['schemaVersion', 'revision', 'activeClassId', 'decks', 'selectedDeckIds'])) return failure('invalid-library');
    if (value.schemaVersion !== SAVED_DECK_SCHEMA_VERSION) return failure(Number.isSafeInteger(value.schemaVersion) && value.schemaVersion > SAVED_DECK_SCHEMA_VERSION ? 'future-version' : 'unsupported-version');
    if (!Number.isSafeInteger(value.revision) || value.revision < 0) return failure('invalid-revision');
    if (!classIds.includes(value.activeClassId)) return failure('invalid-class');
    if (!denseArray(value.decks, MAX_SAVED_DECKS)) return failure('invalid-library');
    if (!record(value.selectedDeckIds, classIds)) return failure('invalid-selection');
    const ids = new Map(), names = new Set(), decks = [];
    for (const deck of value.decks) {
      if (!record(deck, ['id', 'name', 'classId', 'cards']) || !identifier(deck.id) || ids.has(deck.id) || !validName(deck.name) || !classIds.includes(deck.classId)) return failure('invalid-deck');
      const normalizedName = `${deck.classId}:${deck.name.trim().toLowerCase()}`;
      if (names.has(normalizedName)) return failure('duplicate-name');
      if (!denseArray(deck.cards, 30)) return failure('invalid-cards');
      const counts = new Map();
      for (const cardId of deck.cards) {
        if (!identifier(cardId)) return failure('invalid-cards');
        const count = (counts.get(cardId) || 0) + 1;
        if (count > 2) return failure('invalid-cards');
        counts.set(cardId, count);
      }
      ids.set(deck.id, deck.classId); names.add(normalizedName);
      decks.push({id:deck.id, name:deck.name, classId:deck.classId, cards:[...deck.cards]});
    }
    const selectedDeckIds = {};
    for (const classId of classIds) {
      const id = value.selectedDeckIds[classId];
      if (id !== null && (!identifier(id) || ids.get(id) !== classId)) return failure('invalid-selection');
      selectedDeckIds[classId] = id;
    }
    return {ok:true, data:{schemaVersion:SAVED_DECK_SCHEMA_VERSION, revision:value.revision, activeClassId:value.activeClassId, decks, selectedDeckIds}, error:null};
  } catch {
    return failure('invalid-library');
  }
}

function parse(raw) {
  if (raw === null) return {ok:true, data:emptyLibrary(), raw, error:null};
  if (typeof raw !== 'string' || raw.length > MAX_RAW_LENGTH) return failure('corrupt', raw);
  let value;
  try { value = JSON.parse(raw); } catch { return failure('corrupt', raw); }
  // A newer schema may legitimately have entirely different fields. Preserve it
  // byte-for-byte even when we cannot validate its shape.
  if (Number.isSafeInteger(value?.schemaVersion) && value.schemaVersion > SAVED_DECK_SCHEMA_VERSION) return failure('future-version', raw);
  const result = validateLibrary(value);
  return result.ok ? {...result, raw} : failure(result.error === 'unsupported-version' ? result.error : 'corrupt', raw, result.error);
}

/** Optional helper: template generation is explicit and never mutates storage. */
export function templateDeck(classId, defaultDeckFn) {
  if (!classIds.includes(classId) || typeof defaultDeckFn !== 'function') throw new Error('Invalid deck template');
  const cards = defaultDeckFn(classId);
  const library = emptyLibrary();
  library.decks.push({id:'template', name:'template', classId, cards});
  const checked = validateLibrary(library);
  if (!checked.ok) throw new Error('Invalid deck template');
  return {classId, cards:[...checked.data.decks[0].cards]};
}

export function createSavedDeckStore({storage, key = deckStorageKey(), locks} = {}) {
  if (typeof key !== 'string' || !key || key.length > 300) throw new Error('Invalid saved deck storage key');
  const lockName = `${key}:write`;
  function load() {
    try {
      if (!storage || typeof storage.getItem !== 'function') return failure('unavailable');
      return parse(storage.getItem(key));
    } catch { return failure('storage-read'); }
  }
  async function commit(next, expectedRaw) {
    if (expectedRaw !== null && typeof expectedRaw !== 'string') return failure('expected-raw-required');
    // Snapshot before awaiting a lock: caller edits while queued cannot alter
    // the write that was approved by this invocation.
    const checked = validateLibrary(next);
    if (!checked.ok) return failure(checked.error, expectedRaw);
    if (!locks || typeof locks.request !== 'function') return failure('unavailable-locks', expectedRaw);
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return failure('unavailable', expectedRaw);
    try {
      return await locks.request(lockName, {mode:'exclusive'}, () => {
        const current = load();
        if (!current.ok) return current; // Corrupt/future values must never be replaced.
        if (current.raw !== expectedRaw || checked.data.revision !== current.data.revision) return failure('conflict', current.raw);
        if (current.data.revision === Number.MAX_SAFE_INTEGER) return failure('revision-exhausted', current.raw);
        const data = {...checked.data, revision:current.data.revision + 1};
        const raw = JSON.stringify(data);
        try { storage.setItem(key, raw); } catch { return failure('storage-write', current.raw); }
        let verified;
        try { verified = storage.getItem(key); } catch { return failure('storage-verify', null); }
        // Never try to roll back: another non-cooperating writer may have won.
        if (verified !== raw) return failure('storage-verify', verified);
        return {ok:true, data, raw, error:null};
      });
    } catch { return failure('unavailable-locks', expectedRaw); }
  }
  return Object.freeze({key, lockName, load, commit});
}
