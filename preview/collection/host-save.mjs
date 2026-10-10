/** PREVIEW-only save protocol. No global storage, no automatic import, no rollback writes. */
import { canonical } from './domain/json.mjs';
export const KEYS = Object.freeze({ main:'tangzhe-preview-collection-v1-save', backup:'tangzhe-preview-collection-v1-save-bak', tab:'tangzhe-preview-collection-v1-tab-lock', source:'tangzhe-preview-save', sourceBackup:'tangzhe-preview-save-bak' });
export const LOCK_NAME = 'tangzhe:preview:collection-v1:writer';
export const WRITE_PROTOCOL = 1;
const MAX_BYTES = 2 * 1024 * 1024;
const copy = v => JSON.parse(JSON.stringify(v));
const bad = (code, extra = {}) => ({ok:false,code,...extra});

export function createSaveCoordinator({storage, economy:E, model, ownsLock, onFault = () => {}, maxBytes = MAX_BYTES}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof ownsLock !== 'function') throw Error('STORAGE_AND_LOCK_REQUIRED');
  let expectedRaw, started = false, failed = null, uncertain = null;
  const requiredParentShape=E.newState(0);
  function completeShape(value, sample) {
    if (sample===null) return true;
    if (Array.isArray(sample)) return Array.isArray(value) && (!sample.length || (value.length===sample.length && sample.every((part,i)=>completeShape(value[i],part))));
    if (typeof sample==='object') return !!value && typeof value==='object' && !Array.isArray(value) && Object.keys(sample).every(k=>Object.hasOwn(value,k)&&completeShape(value[k],sample[k]));
    if (typeof sample==='number') return typeof value==='number' && Number.isFinite(value);
    return typeof value===typeof sample;
  }
  function fault(code) { failed = code; onFault(code); return bad(code); }
  function validateCollection(raw) {
    try {
      if (raw._collectionProtocol !== WRITE_PROTOCOL || !raw.collection || !raw.collectionHost) return ['collection-protocol'];
      model.restore(raw.collection);
      const h = raw.collectionHost;
      if (Object.keys(h).sort().join('|') !== ['acknowledged','migration','requests','schemaVersion'].sort().join('|') || h.schemaVersion !== 1) throw Error('host');
      for (const field of ['requests','acknowledged']) if (!h[field] || typeof h[field] !== 'object' || Array.isArray(h[field])) throw Error(field);
      for (const [key, entry] of Object.entries(h.requests)) {
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(key) || !entry || Object.keys(entry).sort().join('|') !== 'requestCanonical|txId' || typeof entry.requestCanonical !== 'string' || !Object.hasOwn(raw.collection.transactions,entry.txId)) throw Error('request');
        if (entry.requestCanonical !== canonical(raw.collection.transactions[entry.txId].request)) throw Error('request-binding');
      }
      for (const [txId, acknowledged] of Object.entries(h.acknowledged)) if (acknowledged !== true || raw.collection.transactions[txId]?.stage !== 'committed') throw Error('ack');
      const m = h.migration;
      if (!m || m.schemaVersion !== 1 || !['empty-new-preview','explicit-preview-copy'].includes(m.kind) || m.sourceKey !== KEYS.source || !Number.isSafeInteger(m.sourceRev) || m.sourceRev < 0) throw Error('migration');
      return [];
    } catch { return ['collection-invalid-or-unsupported']; }
  }
  function parse(text, {source = false} = {}) {
    if (typeof text !== 'string' || !text.length || text.length > maxBytes) return bad(text?.length > maxBytes ? 'CAPACITY_READ_ONLY' : 'SAVE_MISSING');
    let value; try { value = JSON.parse(text); } catch { return bad('INVALID_JSON_READ_ONLY'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return bad('INVALID_SAVE_READ_ONLY');
    if (!Number.isSafeInteger(value.v) || value.v !== E.CFG.SAVE_VERSION || !Number.isSafeInteger(value.rev) || value.rev < 0) return bad('UNSUPPORTED_SAVE_READ_ONLY');
    // Never accept a partially present envelope as an old source to import.
    if (source && (Object.hasOwn(value,'collection') || Object.hasOwn(value,'collectionHost') || Object.hasOwn(value,'_collectionProtocol'))) return bad('SOURCE_COLLECTION_REQUIRES_REVIEW');
    if (!completeShape(value,requiredParentShape) || E.validState(copy(value)).length) return bad('INCOMPLETE_PARENT_SAVE_REQUIRES_REVIEW');
    if (!source && validateCollection(value).length) return bad('INVALID_COLLECTION_READ_ONLY');
    if (E.checkSave(value).length) return bad('INVALID_SAVE_READ_ONLY');
    if (!Number.isSafeInteger(value.coins) || value.coins < 0 || typeof value.coinFrac !== 'number' || !Number.isFinite(value.coinFrac) || value.coinFrac < 0 || value.coinFrac >= 1) return bad('INVALID_WALLET_READ_ONLY');
    return {ok:true,state:value,raw:text};
  }
  function readKey(key) { try { return {ok:true,raw:storage.getItem(key)}; } catch { return bad('STORAGE_READ_FAILED'); } }
  function guard() {
    if (!ownsLock()) return fault('LOCK_NOT_OWNED');
    if (failed) return bad(failed);
    return {ok:true};
  }
  function destinationArtifacts() {
    for(const key of [KEYS.backup,KEYS.tab]) { const r=readKey(key); if(!r.ok)return r; if(r.raw!==null)return bad('DESTINATION_ARTIFACT_REQUIRES_REVIEW'); }
    return {ok:true};
  }
  function inspect() {
    if (!ownsLock()) return bad('LOCK_NOT_OWNED');
    const r = readKey(KEYS.main); if (!r.ok) return r;
    if (r.raw !== null) return {...parse(r.raw),needsConsent:false};
    const artifacts=destinationArtifacts(); if(!artifacts.ok)return artifacts;
    const source = readKey(KEYS.source); if (!source.ok) return source;
    if (source.raw !== null) { const p = parse(source.raw,{source:true}); return p.ok ? {ok:true,needsConsent:true,sourceRaw:source.raw,sourceState:p.state} : p; }
    const backup=readKey(KEYS.sourceBackup); if(!backup.ok)return backup;
    if(backup.raw!==null)return bad('SOURCE_BACKUP_REQUIRES_REVIEW');
    return {ok:true,needsConsent:true,sourceRaw:null,sourceState:null};
  }
  function adopt() {
    const g=guard(); if (!g.ok) return g;
    const r=readKey(KEYS.main); if (!r.ok) return r;
    const p=parse(r.raw); if (!p.ok) return p;
    expectedRaw=r.raw; started=true; return {ok:true,state:copy(p.state)};
  }
  function initialize({approvedSourceRaw, approvedEmpty = false, now}) {
    const g=guard(); if (!g.ok) return g;
    const destination=readKey(KEYS.main); if (!destination.ok) return destination;
    if (destination.raw !== null) return bad('DESTINATION_ALREADY_EXISTS');
    const artifacts=destinationArtifacts(); if(!artifacts.ok)return artifacts;
    const source=readKey(KEYS.source); if (!source.ok) return source;
    if (source.raw !== approvedSourceRaw) return bad('SOURCE_CHANGED_RECONFIRM');
    if (source.raw === null && approvedEmpty !== true) return bad('EXPLICIT_CONSENT_REQUIRED');
    if (source.raw === null) { const backup=readKey(KEYS.sourceBackup); if(!backup.ok)return backup; if(backup.raw!==null)return bad('SOURCE_BACKUP_REQUIRES_REVIEW'); }
    let state;
    if (source.raw === null) state=E.newState(now);
    else { const p=parse(source.raw,{source:true}); if (!p.ok) return p; state=copy(p.state); }
    state._collectionProtocol=WRITE_PROTOCOL;
    state.collection=model.createState({holdings:{},dust:0,preferences:{suppressOverflowWarning:false}});
    state.collectionHost={schemaVersion:1,requests:{},acknowledged:{},migration:{schemaVersion:1,kind:source.raw===null?'empty-new-preview':'explicit-preview-copy',sourceKey:KEYS.source,sourceRev:state.rev}};
    const raw=JSON.stringify(state), p=parse(raw); if (!p.ok) return p;
    // Compare both again immediately before the single destination write; original source is never written.
    const finalDestination=readKey(KEYS.main), finalSource=readKey(KEYS.source), finalBackup=source.raw===null?readKey(KEYS.sourceBackup):{ok:true,raw:null};
    if(!finalDestination.ok||!finalSource.ok||!finalBackup.ok)return bad('STORAGE_READ_FAILED');
    if(finalDestination.raw!==null||finalSource.raw!==approvedSourceRaw||finalBackup.raw!==null)return bad('SOURCE_OR_DESTINATION_CHANGED');
    const finalArtifacts=destinationArtifacts(); if(!finalArtifacts.ok)return finalArtifacts;
    try { storage.setItem(KEYS.main,raw); } catch {}
    const actual=readKey(KEYS.main);
    if (!actual.ok) { uncertain={before:null,intended:raw}; return fault('COMMIT_UNCERTAIN'); }
    if (actual.raw === raw) { expectedRaw=raw; started=true; return {ok:true,state:copy(state)}; }
    if (actual.raw === null) return bad('WRITE_FAILED');
    return fault('FOREIGN_WRITE_READ_ONLY');
  }
  function current() {
    const g=guard(); if (!g.ok) return g;
    if (!started) return bad('NOT_INITIALIZED');
    const r=readKey(KEYS.main); if (!r.ok) return fault(r.code);
    if (r.raw !== expectedRaw) return fault('FOREIGN_WRITE_READ_ONLY');
    return parse(r.raw);
  }
  function commit(state, {allowCollectionChange = false} = {}) {
    const previous=current(); if (!previous.ok) return previous;
    if (state.rev !== previous.state.rev) return bad('REVISION_CONFLICT');
    if (!allowCollectionChange && (JSON.stringify(state.collection)!==JSON.stringify(previous.state.collection) || JSON.stringify(state.collectionHost)!==JSON.stringify(previous.state.collectionHost))) return bad('COLLECTION_CHANGE_REQUIRES_HOST');
    if (state._collectionProtocol !== WRITE_PROTOCOL) return bad('PROTOCOL_DOWNGRADE_BLOCKED');
    const candidate=copy(state); candidate.rev=previous.state.rev+1;
    if (!Number.isSafeInteger(candidate.rev)) return bad('REVISION_EXHAUSTED');
    const raw=JSON.stringify(candidate); if (raw.length > maxBytes) return bad('CAPACITY_READ_ONLY');
    const p=parse(raw); if (!p.ok) return p;
    // Cooperative lifetime lock + exact raw check; no async gap, and no blind old-value rollback.
    const pre=readKey(KEYS.main); if (!pre.ok) return fault(pre.code); if (pre.raw !== previous.raw) return fault('FOREIGN_WRITE_READ_ONLY');
    try { storage.setItem(KEYS.backup,previous.raw); } catch { return bad('BACKUP_WRITE_FAILED'); }
    const backup=readKey(KEYS.backup); if (!backup.ok || backup.raw!==previous.raw) return bad('BACKUP_WRITE_FAILED');
    const again=readKey(KEYS.main); if (!again.ok || again.raw!==previous.raw) return fault('FOREIGN_WRITE_READ_ONLY');
    try { storage.setItem(KEYS.main,raw); } catch {}
    const actual=readKey(KEYS.main);
    if (actual.ok && actual.raw===raw) { expectedRaw=raw; Object.assign(state,copy(candidate)); return {ok:true,rev:candidate.rev,state:copy(candidate)}; }
    if (actual.ok && actual.raw===previous.raw) return bad('WRITE_FAILED');
    uncertain={before:previous.raw,intended:raw}; return fault('COMMIT_UNCERTAIN');
  }
  function reconcile() {
    if (!ownsLock()) return bad('LOCK_NOT_OWNED');
    if (!uncertain) return failed ? bad(failed) : current();
    const actual=readKey(KEYS.main); if (!actual.ok) return bad('COMMIT_UNCERTAIN');
    if (actual.raw!==uncertain.before && actual.raw!==uncertain.intended) return bad('FOREIGN_WRITE_READ_ONLY');
    const p=parse(actual.raw); if (!p.ok) return p;
    expectedRaw=actual.raw; started=true; failed=null; uncertain=null; return p;
  }
  return Object.freeze({validateCollection,parse,inspect,adopt,initialize,current,commit,reconcile,get raw(){return expectedRaw;},get failed(){return failed;}});
}
