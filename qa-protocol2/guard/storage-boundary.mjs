/** QA instrumentation only; inert at import time. Derived from the reviewed
 * collectible-browser-host-v2-rebuilt Storage prototype and Proxy guard.
 * Install before application imports in every realm, in a fresh non-persistent
 * localhost browser context. Not a hostile-script sandbox: pre-captured native
 * functions/objects, other realms, and descriptor tampering remain out of scope.
 * sessionStorage is wholly denied after installation. Existing index version
 * clearing before this boundary must be separately audited; no exception here.
 */
import {getRealPageQAConfig, validateRealPageQAGate} from './config.mjs?v=bb70-launch-notice-20261013-r2';
export {getRealPageQAConfig, validateRealPageQAGate} from './config.mjs?v=bb70-launch-notice-20261013-r2';
const installedGuards = new WeakMap();
const frozen = value => Object.freeze(value);
const fail = code => { throw new Error(code); };
function makeAudit() {
  const entries = [];
  return {
    push(entry) { entries.push(frozen({sequence: entries.length + 1, ...entry})); },
    snapshot() { return frozen(entries.slice()); },
  };
}

/** Guard this realm's actual Storage methods before importing any application.
 * It does not enumerate storage or inspect stored values. The only allowed
 * receiver is this realm's native localStorage; even captured sessionStorage
 * fails. Normal global.localStorage access returns a restricted native proxy.
 * restore exists for isolated Node test teardown, not normal host lifecycle use.
 */
export function installRealPageStorageGuard(global, {scope, realm = 'host'} = {}) {
  const gate = validateRealPageQAGate(global?.location, {scope, realm});
  if (!gate.ok) fail(gate.reason);
  const config = getRealPageQAConfig(scope, realm);
  if (!global || (typeof global !== 'object' && typeof global !== 'function')) fail('QA_GLOBAL_REQUIRED');
  if (installedGuards.has(global)) fail('QA_GUARD_ALREADY_INSTALLED');
  const keys = config.physicalKeys;
  const allowed = new Set(keys);
  const prototype = global.Storage?.prototype;
  if (!prototype) fail('QA_STORAGE_PROTOTYPE_REQUIRED');
  const ProxyConstructor = global.Proxy;
  if (typeof ProxyConstructor !== 'function') fail('QA_STORAGE_PROXY_REQUIRED');
  const localStorage = global.localStorage;
  if (!localStorage || !prototype.isPrototypeOf(localStorage)) fail('QA_LOCAL_STORAGE_REQUIRED');
  const log = makeAudit();
  const patches = [];
  const blockedCapabilities = [];
  const guardedMethods = Object.create(null);

  function planPatch(target, name, descriptor) {
    const original = Object.getOwnPropertyDescriptor(target, name);
    if ((!original && !Object.isExtensible(target)) || (original && !original.configurable &&
        !(Object.hasOwn(original, 'value') && original.writable && Object.hasOwn(descriptor, 'value')))) {
      fail(`QA_GUARD_UNPATCHABLE:${name}`);
    }
    patches.push({target, name, original, descriptor: original
      ? (Object.hasOwn(descriptor, 'value') && Object.hasOwn(original, 'value')
        ? {...original, value: descriptor.value} : descriptor)
      : descriptor});
  }
  function block(capability) {
    return function () {
      log.push({operation: capability, key: null, status: 'blocked', error: 'QA_CAPABILITY_BLOCKED'});
      fail(`QA_CAPABILITY_BLOCKED:${capability}`);
    };
  }
  for (const name of ['getItem', 'setItem', 'removeItem', 'key', 'clear']) {
    const original = Object.getOwnPropertyDescriptor(prototype, name);
    if (typeof original?.value !== 'function') fail(`QA_STORAGE_METHOD_REQUIRED:${name}`);
    const native = original.value;
    const guarded = function (key, value) {
      if (this !== localStorage || name === 'key' || name === 'clear' ||
          typeof key !== 'string' || !allowed.has(key)) {
        log.push({operation: name, key: typeof key === 'string' ? key : null,
          status: 'blocked', error: 'QA_STORAGE_ACCESS_BLOCKED'});
        fail('QA_STORAGE_ACCESS_BLOCKED');
      }
      if (name === 'setItem' && typeof value !== 'string') {
        log.push({operation: name, key, status: 'blocked', error: 'QA_STORAGE_VALUE_INVALID'});
        fail('QA_STORAGE_VALUE_INVALID');
      }
      try {
        const result = name === 'setItem' ? Reflect.apply(native, this, [key, value])
          : Reflect.apply(native, this, [key]);
        log.push({operation: name, key, status: 'ok', wrote: name !== 'getItem'});
        return result;
      } catch (error) {
        log.push({operation: name, key, status: 'error', wrote: false,
          error: typeof error?.message === 'string' ? error.message : 'QA_NATIVE_STORAGE_FAILED'});
        throw error;
      }
    };
    guardedMethods[name] = guarded;
    planPatch(prototype, name, {value: guarded, configurable: true, writable: true, enumerable: false});
  }
  function denyProperty(operation, key) {
    log.push({operation, key: typeof key === 'string' ? key : null,
      status: 'blocked', wrote: false, error: 'QA_STORAGE_ACCESS_BLOCKED'});
    fail('QA_STORAGE_ACCESS_BLOCKED');
  }
  function requireProperty(operation, key) {
    if (typeof key !== 'string' || !allowed.has(key)) denyProperty(operation, key);
  }
  const boundMethods = frozen(Object.fromEntries(Object.entries(guardedMethods)
    .map(([name, method]) => [name, method.bind(localStorage)])));
  // Never Reflect.get/Reflect.set a user-supplied property on native Storage:
  // those would invoke its named-property machinery outside the method audit.
  const storageProxy = new ProxyConstructor(localStorage, {
    get(_target, key) {
      if (typeof key === 'string' && Object.hasOwn(boundMethods, key)) return boundMethods[key];
      requireProperty('property:get', key);
      return boundMethods.getItem(key);
    },
    set(_target, key, value) {
      requireProperty('property:set', key);
      boundMethods.setItem(key, value);
      return true;
    },
    deleteProperty(_target, key) {
      requireProperty('property:delete', key);
      boundMethods.removeItem(key);
      return true;
    },
    defineProperty(_target, key, descriptor) {
      requireProperty('property:define', key);
      // Storage exposes configurable, enumerable, writable string data values.
      // Reject accessors/restrictive descriptors instead of claiming they took
      // effect on a native exotic object when they cannot be represented there.
      if (!Object.hasOwn(descriptor, 'value') || Object.hasOwn(descriptor, 'get') ||
          Object.hasOwn(descriptor, 'set') || descriptor.configurable !== true ||
          descriptor.enumerable !== true || descriptor.writable !== true) {
        denyProperty('property:define', key);
      }
      boundMethods.setItem(key, descriptor.value);
      return true;
    },
    getOwnPropertyDescriptor(_target, key) {
      if (typeof key === 'string' && Object.hasOwn(boundMethods, key)) return undefined;
      requireProperty('property:descriptor', key);
      const value = boundMethods.getItem(key);
      return value === null ? undefined : {value, configurable: true, enumerable: true, writable: true};
    },
    has(_target, key) {
      if (typeof key === 'string' && Object.hasOwn(boundMethods, key)) return true;
      requireProperty('property:has', key);
      return boundMethods.getItem(key) !== null;
    },
    ownKeys() { return denyProperty('property:ownKeys', null); },
    setPrototypeOf() { return denyProperty('property:setPrototypeOf', null); },
    preventExtensions() { return denyProperty('property:preventExtensions', null); },
  });
  planPatch(global, 'localStorage', {get() { return storageProxy; },
    set: block('localStorage replacement'), configurable: true, enumerable: false});
  for (const name of ['sessionStorage', 'indexedDB', 'webkitIndexedDB']) {
    // Also block currently absent APIs so a later polyfill cannot silently open
    // a different persistence path while this QA guard is installed.
    planPatch(global, name, {get: block(name), set: block(name), configurable: true, enumerable: false});
    blockedCapabilities.push(name);
  }
  if (global.navigator) {
    // Block access itself, plus existing captured container.register references
    // reached through their object after installation (not pre-captured methods).
    const container = global.navigator.serviceWorker;
    if (container && typeof container.register === 'function') {
      planPatch(container, 'register', {value: block('serviceWorker.register'), configurable: true,
        writable: true, enumerable: false});
    }
    planPatch(global.navigator, 'serviceWorker', {get: block('serviceWorker'), set: block('serviceWorker'),
      configurable: true, enumerable: false});
    blockedCapabilities.push('serviceWorker');
  }
  const locks = global.navigator?.locks;
  if (!locks || typeof locks.request !== 'function') fail('QA_WEB_LOCKS_REQUIRED');
  const lockNames = new Set(config.lockNames);
  // Guard the real LockManager prototype where it owns the method. A test mock
  // may own request/query directly. Never replace Web Locks with an emulator.
  function lockTarget(name) {
    let target = locks;
    while (target && target !== Object.prototype) {
      if (Object.hasOwn(target, name)) return target;
      target = Object.getPrototypeOf(target);
    }
    fail(`QA_LOCK_METHOD_REQUIRED:${name}`);
  }
  for (const name of ['request', 'query']) {
    const target = lockTarget(name);
    const original = Object.getOwnPropertyDescriptor(target, name);
    if (typeof original?.value !== 'function') fail(`QA_LOCK_METHOD_REQUIRED:${name}`);
    const native = original.value;
    const guarded = function (...args) {
      const key = name === 'request' && typeof args[0] === 'string' ? args[0] : null;
      if (this !== locks || (name === 'request' && !lockNames.has(key))) {
        log.push({operation: `locks.${name}`, key, status: 'blocked', wrote: false,
          error: 'QA_LOCK_ACCESS_BLOCKED'});
        fail('QA_LOCK_ACCESS_BLOCKED');
      }
      // Keep the original receiver, arguments, return value and asynchronous
      // locking semantics. query is a read-only native observation.
      try {
        const result = Reflect.apply(native, this, args);
        log.push({operation: `locks.${name}`, key, status: 'forwarded', wrote: false});
        return result;
      } catch (error) {
        log.push({operation: `locks.${name}`, key, status: 'error', wrote: false,
          error: typeof error?.message === 'string' ? error.message : 'QA_NATIVE_LOCK_FAILED'});
        throw error;
      }
    };
    planPatch(target, name, {value: guarded, configurable: true, writable: true, enumerable: false});
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(prototype, 'length');
  if (lengthDescriptor) {
    planPatch(prototype, 'length', {get: block('localStorage.length'),
      configurable: true, enumerable: lengthDescriptor.enumerable});
  }
  let applied = 0;
  function undo() {
    for (let index = applied - 1; index >= 0; index -= 1) {
      const patch = patches[index];
      if (patch.original) Object.defineProperty(patch.target, patch.name, patch.original);
      else if (!Reflect.deleteProperty(patch.target, patch.name)) fail(`QA_GUARD_RESTORE_FAILED:${patch.name}`);
    }
    applied = 0;
  }
  try {
    for (const patch of patches) { Object.defineProperty(patch.target, patch.name, patch.descriptor); applied += 1; }
  } catch (error) {
    undo();
    throw new Error('QA_GUARD_INSTALL_FAILED', {cause: error});
  }
  let restored = false;
  const guard = frozen({
    scope, realm, prefix: config.prefix, physicalKeys: frozen(keys.slice()),
    lockNames: config.lockNames, blockedCapabilities: frozen(blockedCapabilities),
    get audit() { return log.snapshot(); },
    restore() {
      if (restored) return false;
      undo();
      installedGuards.delete(global);
      restored = true;
      return true;
    },
  });
  installedGuards.set(global, guard);
  return guard;
}
