/** Minimal QA-only adapter for the existing saved-deck store.
 * Production code must retain its original storage/key/locks path unless the
 * explicit localhost QA gate succeeds. No automatic reads, writes or locks.
 */
import {getRealPageQAConfig, validateRealPageQAGate} from './config.mjs?v=space01b04-moon-on-wearables8-20261012-r1';
const fail = code => { throw new Error(code); };
export function createQADeckStorageScope({scope, location, storage, locks} = {}) {
  const gate = validateRealPageQAGate(location, {scope, realm: 'cards'});
  if (!gate.ok) fail(gate.reason);
  const {prefix, deckKey} = getRealPageQAConfig(scope, 'cards');
  if (!storage || ['getItem', 'setItem', 'removeItem'].some(name => typeof storage[name] !== 'function')) {
    fail('QA_DECK_STORAGE_REQUIRED');
  }
  if (!locks || typeof locks.request !== 'function') fail('QA_WEB_LOCKS_REQUIRED');
  const physicalKey = prefix + deckKey;
  const logicalLock = deckKey + ':write';
  const lockName = physicalKey + ':write';
  function key(input) {
    if (input !== deckKey) fail('QA_DECK_KEY_SCOPE');
    return physicalKey;
  }
  return Object.freeze({key: deckKey, physicalKey, lockName,
    storage: Object.freeze({
      getItem: input => storage.getItem(key(input)),
      setItem(input, value) {
        const physical = key(input);
        if (typeof value !== 'string') fail('QA_STORAGE_VALUE_INVALID');
        return storage.setItem(physical, value);
      },
      removeItem: input => storage.removeItem(key(input)),
    }),
    locks: Object.freeze({request(name, ...args) {
      if (name !== logicalLock) fail('QA_DECK_LOCK_SCOPE');
      return locks.request(lockName, ...args);
    }}),
  });
}
