import {CARD_KEYS, LOCK_NAME} from './save.mjs?v=formal-cards-candidate-7';

// QA uses one fixed namespace, never a caller-supplied prefix. No match storage is
// read before the embedded page accepts its parent's authenticated port handoff.
export const QA_MATCH_SCOPE = 'qa-formal-collection-v1';
export const QA_MATCH_PREFIX = QA_MATCH_SCOPE + ':';
export function createMatchStorageScope({storage, locks, embedded, hostname, qaRequested}) {
  const local = ['localhost','127.0.0.1','[::1]'].includes(hostname);
  const allowed = new Set(CARD_KEYS);
  let selected = null, resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  function choose(scope) {
    if (selected !== null) return selected === scope;
    selected = scope; resolveReady(); return true;
  }
  if (!embedded && !qaRequested) choose('formal');
  function authorize(data) {
    if (!embedded || data?.matchStorageProtocol !== 1) return false;
    const scope = data.matchStorageScope;
    if (qaRequested ? (!local || scope !== QA_MATCH_SCOPE) : scope !== 'formal') return false;
    return choose(scope);
  }
  function prefix() {
    if (selected === null) throw Error('MATCH_STORAGE_SCOPE_PENDING');
    return selected === QA_MATCH_SCOPE ? QA_MATCH_PREFIX : '';
  }
  function key(k) { if (!allowed.has(k)) throw Error('MATCH_STORAGE_SCOPE'); return prefix() + k; }
  return Object.freeze({ready,authorize,
    get selected() { return selected; },
    storage:Object.freeze({getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v),removeItem:k=>storage.removeItem(key(k))}),
    locks:typeof locks?.request === 'function' ? Object.freeze({request(name,...args) {
      if (name !== LOCK_NAME) throw Error('MATCH_LOCK_SCOPE');
      return locks.request(prefix() + name,...args);
    }}) : undefined
  });
}
