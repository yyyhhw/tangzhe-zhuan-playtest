import {canonical} from './vendor/codec/lib/json.mjs?v=copy106-20261014-r1';
/** Default-off QA-only adapter for the actual app coordinator and __tzz hooks.
 * Pure injected orchestration: no browser globals, storage selection, seeding,
 * grants, timer, automatic migration approval, gameplay replay, or publication.
 */
export const REAL_PAGE_QA_ENABLED = false;
const copy = value => JSON.parse(JSON.stringify(value));
const fail = code => ({ok: false, code});
const writeFailures = new Set(['BACKUP_WRITE_FAILED', 'WRITE_FAILED', 'MAIN_WRITE_FAILED', 'PARENT_SAVE_FAILED', 'COMMIT_UNCERTAIN']);

export function createRealPageQAFacade({enabled = REAL_PAGE_QA_ENABLED, scope, format = 1,
  storage, lease, legacy, planner, codec, validator, session, createHostModel,
  onChange = () => {}} = {}) {
  if (!['formal', 'preview'].includes(scope) || !storage || !lease || !session?.coordinator ||
      typeof session.attachHost !== 'function' || !legacy || !planner || !codec ||
      !validator || typeof createHostModel !== 'function' || ![1, 2].includes(format)) {
    throw Error('REAL_PAGE_QA_DEPENDENCIES_REQUIRED');
  }
  const owner = session.coordinator, keys = owner.keys;
  let phase = enabled === true ? 'new' : 'disabled', fault = null, terminal = false;
  let adoptedLegacy = false, migrationPending = false, migration = null, token = null;
  let app = null, host = null, last = null, applying = false, reconciling = false;
  // Runtime's known backup/main failures have no pending uncertain record. Only
  // those cases (or a rejected app draft) can reconcile via owner.current().
  let canReadCurrent = false;
  const alive = () => enabled === true && !terminal && lease.owns();
  const writable = () => alive() && phase === 'playing' && !fault && !owner.readOnly && !applying;
  const view = () => Object.freeze({enabled: enabled === true, phase, code: fault,
    canPlay: writable(), canConfirm: alive() && ['prompt', 'prepared'].includes(phase) && !!token,
    ownsLock: lease.owns(), appAttached: !!app, cardAttached: !!host, last});
  function notify(result) {
    last = result;
    // Presentation failures may not undo a storage or protection decision.
    try { onChange(view()); } catch {}
    return result;
  }
  function protect(result, {recoverCurrent = false, permanent = false} = {}) {
    fault = result?.code || owner.failed || 'SAVE_RESULT_UNCONFIRMED';
    phase = terminal || permanent ? 'revoked' : 'protected';
    terminal ||= permanent; token = null; canReadCurrent = recoverCurrent && !owner.readOnly;
    if (permanent) { owner.invalidate(fault); migration?.invalidate(fault); }
    try { app?.collectionReadOnly(fault); } catch {}
    return notify({...result, ok: false, code: fault, readOnly: true});
  }
  function gate(code = 'GAMEPLAY_READ_ONLY') {
    if (!alive()) return protect(fail(enabled !== true ? 'QA_DISABLED' : fault || 'SESSION_INVALIDATED'), {permanent: enabled === true});
    if (phase === 'playing' && (owner.readOnly || owner.failed)) return protect(fail(owner.failed || code));
    return {...fail(fault || code), readOnly: true};
  }
  function invoke(method, ...args) {
    try { return owner[method](...args); }
    catch (error) { return fail(error?.message || 'COORDINATOR_ERROR'); }
  }
  function current() {
    if (!writable()) return gate();
    const result = invoke('current');
    return result.ok ? result : protect(result);
  }
  function commit(state) {
    if (!writable()) return gate();
    const result = invoke('commit', state);
    // A false save makes E.transact restore its memory, even when the disk may
    // already contain this transaction. All later saves stop until explicit readback.
    if (!result.ok) return protect(result, {recoverCurrent: !owner.readOnly && !owner.failed});
    return result;
  }
  function initializeSpace(...args) {
    if (!writable()) return gate();
    if (args.length) return fail('SPACE_INITIALIZATION_ARGUMENTS_REFUSED');
    // App dirty is a redraw latch, not a persisted-state guarantee. Never flush
    // business changes inside this private initialization transaction.
    if (!app) return fail('SPACE_APP_SYNC_REQUIRED');
    if (app.persist.pending) return fail('SPACE_APP_SAVE_PENDING');
    const saved = invoke('current');
    if (!saved.ok) return protect(saved);
    try {
      if (canonical(app.state) !== canonical(saved.state)) return fail('SPACE_APP_SAVE_REQUIRED');
    } catch { return fail('SPACE_APP_PAYLOAD_INVALID'); }
    const result = invoke('initializeSpace');
    if (!result.ok) return protect(result, {recoverCurrent: !owner.readOnly && !owner.failed});
    // A no-op is not authority to replace even clean application memory.
    return result.initialized === false ? result : play(result);
  }
  function spaceView(){if(!writable())return gate();const result=invoke('spaceView');return owner.failed?protect(result):result;}
  function spacePreview(intent){if(!writable())return gate();return invoke('spacePreview',intent);}
  function spaceIntent(intent){
    if(!writable())return gate();
    if(!app)return fail('SPACE_APP_SYNC_REQUIRED');
    if(app.persist.pending)return fail('SPACE_APP_SAVE_PENDING');
    try{if(app.xingtuContext?.().blocked)return fail('SPACE_HOST_BLOCKED');}catch{return fail('SPACE_HOST_BLOCKED');}
    const saved=invoke('current');if(!saved.ok)return protect(saved);
    try{if(canonical(app.state)!==canonical(saved.state))return fail('SPACE_APP_SAVE_REQUIRED');}catch{return fail('SPACE_APP_PAYLOAD_INVALID');}
    const result=invoke('spaceIntent',intent);
    if(!result.ok){if(owner.failed||owner.readOnly||writeFailures.has(result.code))return protect(result,{recoverCurrent:!owner.readOnly&&!owner.failed});return result;}
    return result.noop?result:play(result);
  }
  const coordinator = Object.freeze({keys, current, commit, initializeSpace, spaceView, spacePreview, spaceIntent,
    validateCollection: owner.validateCollection,
    get raw() { return owner.raw; },
    get failed() {
      if (fault) return fault;
      if (owner.failed) return owner.failed;
      if (!alive()) return enabled === true ? 'SESSION_INVALIDATED' : 'QA_DISABLED';
      return phase === 'playing' ? null : 'MIGRATION_CONFIRMATION_REQUIRED';
    },
    get uncertain() { return owner.uncertain === true; },
    get readOnly() { return !writable(); },
  });

  function makeMigration() {
    return createHostModel({scope, keys, storage, lease, planner, codec, snapshotFormat: format,
      legacy: {check: () => legacy.parse(storage.getItem(keys.main), {source: false}),
        commit: state => owner.commit(state)},
      validateInitialV2: (raw, {snapshotRaw}) => validator.validate(raw,
        {snapshotRaw, originalRaw: keys.original ? storage.getItem(keys.original) : null})});
  }
  function play(result) {
    if (!result?.ok) return protect(result);
    // After the app exists, keep its saveBlocked latch asserted through the first
    // exact state replacement. The real hook releases it only when failed is null.
    applying = true;
    try {
      if (app) app.collectionReplaceState(copy(result.state));
      if (!alive() || owner.readOnly || owner.failed) return protect(fail(owner.failed || 'SESSION_INVALIDATED'));
      fault = null; phase = 'playing'; token = null; canReadCurrent = false;
      if (app) {
        app.collectionReplaceState(copy(result.state));
        // The unchanged root pet copy has no hook for releasing saveBlocked.
        // Its durable state is now synchronized, but only a fresh page can resume.
        if (app.saveBlocked === true) return protect(fail('APP_STILL_READ_ONLY_RELOAD_REQUIRED'), {permanent: true});
      }
    } catch (error) {
      return protect(fail(error?.message || 'APP_STATE_REPLACE_FAILED'), {permanent: true});
    } finally { applying = false; }
    return notify({...result, phase, protocol: result.state._collectionProtocol});
  }
  function adoptCommitted() {
    const raw = storage.getItem(keys.main);
    const result = adoptedLegacy ? invoke('adoptMigration', {approvedCandidateRaw: raw}) : invoke('adopt');
    if (result.ok) migrationPending = false;
    return play(result);
  }
  function inspectMigration(result) {
    if (!result.ok) return protect(result);
    token = result.token ?? null; phase = result.state;
    if (phase === 'committed') return adoptCommitted();
    return notify({ok: true, phase});
  }
  function start() {
    if (enabled !== true) return notify(fail('QA_DISABLED'));
    if (phase !== 'new' || !alive()) return gate('START_NOT_AVAILABLE');
    try {
      const raw = storage.getItem(keys.main), parsed = JSON.parse(raw);
      if (parsed?._collectionProtocol === 2) return play(invoke('adopt'));
      if (parsed?._collectionProtocol !== 1) return protect(fail('PROTOCOL_UNSUPPORTED'));
      if (storage.getItem(keys.snapshot) === null) {
        const result = invoke('adopt');
        if (!result.ok) return protect(result);
        adoptedLegacy = true;
      }
      migrationPending = true; migration = makeMigration();
      return inspectMigration(migration.inspect());
    } catch (error) { return protect(fail(error?.message || 'START_FAILED')); }
  }
  function cancelMigration() {
    if (!alive() || phase !== 'prompt' || !token) return notify(fail('CANCEL_NOT_AVAILABLE'));
    const result = migration.cancel(token); token = null;
    if (!result.ok) return protect(result);
    migrationPending = false;
    return play(invoke('current'));
  }
  function confirmMigration() {
    if (!alive() || !['prompt', 'prepared'].includes(phase) || !token) return notify(fail('CONSENT_TOKEN_INVALID'));
    const given = token; token = null; phase = 'prepared'; notify({ok: true, phase});
    try {
      const result = migration.confirm(given);
      if (!result.ok) {
        if (result.state === 'prepared') { fault = result.code; phase = 'prepared'; return notify({...result, readOnly: true}); }
        return protect(result);
      }
      return adoptCommitted();
    } catch (error) { return protect(fail(error?.message || 'MIGRATION_FAILED')); }
  }
  function attachApp(value, {enabled: cardsEnabled = false, randomInt, makeId} = {}) {
    // Real boot persists before publishing __tzz. If that first save fails,
    // bind its hooks exactly once without clearing protection or doing I/O.
    const protectedAttach = alive() && phase === 'protected' && !applying && !reconciling;
    if (!writable() && !protectedAttach) return gate('APP_ATTACH_READ_ONLY');
    if (app || host) return notify(fail('APP_ALREADY_ATTACHED'));
    if (!value || typeof value.collectionReplaceState !== 'function' ||
        typeof value.collectionReadOnly !== 'function' || typeof value.persist !== 'function' ||
        !value.state || typeof randomInt !== 'function' || typeof makeId !== 'function') {
      return notify(fail('REAL_APP_HOOKS_REQUIRED'));
    }
    app = value;
    if (app.saveBlocked === true && !protectedAttach) return protect(fail('APP_STARTED_READ_ONLY'), {permanent: true});
    try {
      host = session.attachHost({enabled: cardsEnabled === true, randomInt, makeId,
        getState: () => app.state,
        replaceState: next => {
          if (!writable()) throw Error(fault || 'APP_REPLACE_READ_ONLY');
          app.collectionReplaceState(next);
        },
        flush: () => writable() && app.persist() === true});
      return notify({ok: true, phase, readOnly: !writable()});
    } catch (error) { return protect(fail(error?.message || 'CARD_ATTACH_FAILED'), {permanent: true}); }
  }
  function card(message) {
    if (!writable() || !host) return gate('CARD_READ_ONLY');
    const checked = validateCardWire(message);
    if (!checked.ok) return notify(checked);
    let result;
    try { result = host.handle(message); }
    catch (error) { result = fail(error?.message || 'CARD_HOST_ERROR'); }
    if (fault || owner.readOnly || owner.failed || (!result.ok && writeFailures.has(result.code))) {
      return protect(result, {recoverCurrent: !owner.readOnly && !owner.failed,
        permanent: owner.failed === 'CARD_FOREIGN_DEBIT_HISTORY_REQUIRES_REVIEW'});
    }
    return notify(result);
  }
  function claimHidden(rewardId) {
    if(!writable()||!app)return gate('HIDDEN_READ_ONLY');
    // Flush current gameplay first; claim eligibility is checked from the verified
    // durable state, never a caller-supplied achievement or amount.
    if(app.persist()!==true)return protect(fail('HIDDEN_FLUSH_FAILED'));
    const result=invoke('claimHidden',rewardId);
    if(!result.ok){
      if(owner.readOnly||owner.failed||writeFailures.has(result.code))return protect(result,{recoverCurrent:!owner.readOnly&&!owner.failed});
      return notify(result);
    }
    try{app.collectionReplaceState(copy(result.state));}catch(error){return protect(fail(error?.message||'APP_STATE_REPLACE_FAILED'),{permanent:true});}
    return notify(result);
  }
  function snapshot() {
    if (!writable() || !host) return gate('CARD_READ_ONLY');
    try {
      const result = host.snapshot();
      return owner.readOnly || owner.failed ? protect(result) : notify(result);
    } catch (error) { return protect(fail(error?.message || 'CARD_SNAPSHOT_FAILED')); }
  }
  function reconcile() {
    if (!alive()) return gate('SESSION_INVALIDATED');
    if (reconciling || applying) return notify(fail('ACTION_IN_PROGRESS'));
    if (!['protected', 'prepared'].includes(phase)) return notify(fail('RECONCILE_NOT_AVAILABLE'));
    reconciling = true;
    try {
      if (migrationPending) return inspectMigration(migration.reconcile());
      if (!app) return notify(fail('REAL_APP_NOT_ATTACHED'));
      let result = invoke('reconcile');
      if (!result.ok && result.code === 'NO_PENDING_COMMIT' && canReadCurrent && !owner.readOnly && !owner.failed) {
        result = invoke('current');
      }
      // Never replay the operation, rewrite either key, or silently refund.
      return result.ok ? play(result) : protect(result);
    } catch (error) { return protect(fail(error?.message || 'RECONCILE_FAILED')); }
    finally { reconciling = false; }
  }
  function invalidate(reason = 'SESSION_INVALIDATED') { return protect(fail(reason), {permanent: true}); }
  function hidden() {
    return phase === 'playing' ? notify({ok: true, phase}) : invalidate('CONFIRMATION_REVOKED_ON_HIDE');
  }
  return Object.freeze({coordinator, start, cancelMigration, confirmMigration, attachApp,
    card, claimHidden, snapshot, reconcile, invalidate, hidden, view});
}

/** Transport field boundary only. Semantic denials still follow the unchanged
 * host (and may flush ordinary gameplay); no iframe-supplied economic fields. */
export function validateCardWire(message){
  if(!message||typeof message!=='object'||Array.isArray(message)||message.card!=='collection'||message.protocol!==1)return fail('INVALID_PROTOCOL');
  const commandFields={snapshot:[],quote:['request'],confirm:['txId','decision','allowDustOverflow','suppressFutureOverflowWarnings'],resume:['txId'],'restore-reminders':[],acknowledge:['txId'],'validate-deck':['classId','cards']};
  if(typeof message.command!=='string'||!Object.hasOwn(commandFields,message.command))return fail('INVALID_COMMAND');
  const fields=commandFields[message.command];
  if(Object.keys(message).some(k=>!['card','protocol','command','requestId',...fields].includes(k)))return fail('INVALID_COMMAND');
  if(message.command==='quote'&&message.request&&typeof message.request==='object'&&!Array.isArray(message.request)){
    const allowed=message.request.kind==='draw'?['kind']:['kind','cardId'];
    if(Object.keys(message.request).some(k=>!allowed.includes(k)))return fail('INVALID_REQUEST');
  }
  return {ok:true};
}
