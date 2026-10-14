/** INERT SERIALIZATION CANDIDATE. No storage, clocks, randomness or state migration.
 * Envelope integrity is not game-state validity, consent, authenticity or a grant.
 * Only the canonical envelope produced by the reviewed planner is accepted.
 */
import {canonical,freeze} from './lib/json.mjs?v=xingtuv2-3-20261014-r1';
import {sha256} from './lib/sha256.mjs?v=xingtuv2-3-20261014-r1';

export const SNAPSHOT_CODEC_ENABLED=false;
export const SNAPSHOT_FORMATS=Object.freeze({legacy:1,compact:2});
const KEYS=Object.freeze({formal:'tangzhe-formal-collection-v1-save',preview:'tangzhe-preview-collection-v1-save'});
const trusted=new WeakSet();
const fail=code=>{throw new Error(code);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
function expectScope(scope){if(!Object.hasOwn(KEYS,scope))fail('EXPECTED_SCOPE_REQUIRED');return scope;}
function parse(raw){
  if(typeof raw!=='string'||!raw.length)fail('SNAPSHOT_TEXT_REQUIRED');
  try{return JSON.parse(raw);}catch{fail('SNAPSHOT_JSON_INVALID');}
}
function canonicalText(value){try{return canonical(value);}catch{fail('SNAPSHOT_JSON_INVALID');}}
function validatePayload(payload,scope){
  if(!exact(payload,['schemaVersion','scope','sourceKey','sourceProtocol','sourceRaw','originalRaw']))fail('PAYLOAD_SHAPE_UNSUPPORTED');
  if(payload.schemaVersion!==1||payload.sourceProtocol!==1)fail('PAYLOAD_VERSION_UNSUPPORTED');
  if(payload.scope!==scope||payload.sourceKey!==KEYS[scope])fail('SNAPSHOT_SCOPE_MISMATCH');
  // Opaque originals: never parse, normalize, sort, deduplicate or reserialize them.
  if(typeof payload.sourceRaw!=='string'||!payload.sourceRaw.length)fail('SOURCE_RAW_REQUIRED');
  if(scope==='formal'?(typeof payload.originalRaw!=='string'||!payload.originalRaw.length):payload.originalRaw!==null)fail('ORIGINAL_RAW_SCOPE_MISMATCH');
}
function known(record){if(!record||!trusted.has(record))fail('DECODED_RECORD_REQUIRED');return record;}

/** Reads canonical format1/string or format2/object, validating the SAME payload hash. */
export function decodeSnapshot(raw,{expectedScope}={}){
  const scope=expectScope(expectedScope),envelope=parse(raw);
  if(!exact(envelope,['schemaVersion','payload','sha256']))fail('ENVELOPE_SHAPE_UNSUPPORTED');
  if(![1,2].includes(envelope.schemaVersion))fail('ENVELOPE_VERSION_UNSUPPORTED');
  if(typeof envelope.sha256!=='string'||!/^([a-f0-9]{64})$/.test(envelope.sha256))fail('SNAPSHOT_HASH_INVALID');
  // Reject duplicate JSON keys, ambiguous escapes/numbers, whitespace or alternate
  // ordering at this layer rather than silently rewriting an unsupported envelope.
  // Every snapshot emitted by the reviewed planner already meets this contract.
  if(canonicalText(envelope)!==raw)fail('ENVELOPE_NON_CANONICAL');
  let payload,payloadText;
  if(envelope.schemaVersion===1){
    if(typeof envelope.payload!=='string')fail('LEGACY_PAYLOAD_TEXT_REQUIRED');
    payloadText=envelope.payload;payload=parse(payloadText);
    if(canonicalText(payload)!==payloadText)fail('PAYLOAD_NON_CANONICAL');
  }else{
    if(!object(envelope.payload))fail('COMPACT_PAYLOAD_OBJECT_REQUIRED');
    payload=envelope.payload;payloadText=canonicalText(payload);
  }
  validatePayload(payload,scope);
  if(sha256(payloadText)!==envelope.sha256)fail('SNAPSHOT_HASH_MISMATCH');
  const record=freeze({format:envelope.schemaVersion,scope,payload,canonicalPayload:payloadText,sha256:envelope.sha256,raw,validationLevel:'envelope-only',requiresLegacyStateValidation:true});
  trusted.add(record);return record;
}

/** Returns text only. Formats refer to archive serialization, not the game protocol. */
export function encodeSnapshot(record,{format}={}){
  const r=known(record);
  if(![1,2].includes(format))fail('ENVELOPE_VERSION_UNSUPPORTED');
  return canonicalText({schemaVersion:format,payload:format===1?r.canonicalPayload:r.payload,sha256:r.sha256});
}

/** Reproduces reviewed identity inputs. Not a validated or persisted player identity. */
export function snapshotIdentity(record){
  const r=known(record);
  return Object.freeze({saveLineageId:'collectible-lineage:'+sha256(JSON.stringify(['collectible-lineage-v1',r.scope,r.payload.sourceKey,r.sha256])),migrationId:'collectible-migration:'+r.sha256,validationLevel:'envelope-only'});
}
