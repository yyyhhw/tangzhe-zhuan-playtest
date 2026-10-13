/**
 * INERT CANDIDATE. Pure data planning only: no storage, browser, clocks, randomness,
 * automatic migration, awards, or publication. Not imported by any game entry.
 * An actual host must independently verify consent, original evidence, exclusive
 * ownership, unchanged raw, backups, commit readback and unknown outcomes.
 */
import { canonical, freeze } from './lib/json.mjs?v=decor6-candidate-20261013-r1';
import { sha256, validateV15 } from './lib/sha256.mjs?v=decor6-candidate-20261013-r1';

export const CANDIDATE_ENABLED = false;
export const TARGET_PROTOCOL = 2;
export const CATALOG_VERSION = 'collectibles-200-v1';
const SOURCE_LIMIT = 2 * 1024 * 1024; // Existing coordinator limit; never increased here.
export const SCOPES = freeze({
  formal: {main:'tangzhe-formal-collection-v1-save', backup:'tangzhe-formal-collection-v1-save-bak', source:'tangzhe-save', sourceBackup:'tangzhe-save-bak', original:'tangzhe-formal-collection-v1-original', v15:'tangzhe-upgrade-v15-original', snapshot:'tangzhe-formal-collectibles-v2-original', lock:'tangzhe:formal:collection-v1:writer'},
  preview: {main:'tangzhe-preview-collection-v1-save', backup:'tangzhe-preview-collection-v1-save-bak', source:'tangzhe-preview-save', sourceBackup:'tangzhe-preview-save-bak', original:null, snapshot:'tangzhe-preview-collectibles-v2-original', lock:'tangzhe:preview:collection-v1:writer'}
});
const CLOTHES = 'c_apron c_flower c_work c_panda c_qipao c_hoodie c_space c_suit'.split(' ');
const HATS = 'h_chili h_bamboo h_flame h_panda h_boba h_beret h_helmet h_crown'.split(' ');
export const LEGACY_IDS = freeze([...CLOTHES, ...HATS, ...'d_stool d_lights d_neon d_board d_balloon d_poster d_cat d_plant'.split(' '), ...Array.from({length:8},(_,i)=>`k_${i+1}`), ...'s_panda s_fountain s_portal s_sun'.split(' ')]);
const OLD_IDS = new Set(LEGACY_IDS);
const CEOS = ['c77','pearl','otaku','rocket'];
const HIDDEN = ['d_opening_photo','d_ward_charm'];
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const safe = (x,min=0,max=Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(x) && x>=min && x<=max;
const error = code => {throw new Error(code);};
function scopeOf(scope){if(!Object.hasOwn(SCOPES,scope))error('INVALID_SCOPE');return SCOPES[scope];}
function rawJSON(raw, limit=SOURCE_LIMIT){
  if(typeof raw!=='string'||!raw.length)error('SOURCE_MISSING');
  if(raw.length>limit)error('CAPACITY_READ_ONLY');
  let value;try{value=JSON.parse(raw);canonical(value);}catch{error('INVALID_JSON_READ_ONLY');}
  if(!obj(value))error('INVALID_SOURCE');return value;
}
const exactKeys = (x,keys) => obj(x) && Object.keys(x).sort().join('|') === [...keys].sort().join('|');
function checkCollectiblesSource(s){
  const g=s.gacha;
  if(!obj(g)||!Array.isArray(g.owned)||g.owned.some(id=>typeof id!=='string'||!OLD_IDS.has(id))||new Set(g.owned).size!==g.owned.length)error('UNKNOWN_OR_INVALID_OWNERSHIP');
  if(!safe(g.draws)||!safe(g.pity))error('INVALID_GACHA_COUNTER');
  if(g.last!==null && (!obj(g.last)||!OLD_IDS.has(g.last.id)||typeof g.last.seen!=='boolean'))error('UNKNOWN_OR_INVALID_LAST');
  if(!obj(s.wear)||!CEOS.every(id=>obj(s.wear[id])))error('INVALID_WEAR');
  for(const id of CEOS){const w=s.wear[id];if(![null,'c_gold',...CLOTHES].includes(w.clothes)||![null,'h_gold',...HATS].includes(w.hat))error('UNKNOWN_OR_INVALID_WEAR');}
  if(!Array.isArray(s.decorHidden)||s.decorHidden.some(x=>typeof x!=='string'))error('INVALID_DECOR_HIDDEN');
}
function validateSource(sourceRaw, scope, validateLegacy){
  const s=rawJSON(sourceRaw), keys=scopeOf(scope);
  if(s._collectionProtocol!==1)error('SOURCE_PROTOCOL_UNSUPPORTED');
  if(s.v!==3||!safe(s.rev)||s.rev===Number.MAX_SAFE_INTEGER)error('SOURCE_VERSION_OR_REVISION_UNSUPPORTED');
  if(Object.hasOwn(s,'collectiblesV1')||Object.hasOwn(s,'saveLineageId'))error('EXISTING_IDENTITY_REQUIRES_REVIEW');
  // This required adapter is the exact reviewed legacy validator, not a normalizer.
  // It must be pure and is invoked on raw text. The planner never trusts returned state.
  const validation=validateLegacy(sourceRaw,{scope,source:false});
  if(!validation || validation.ok!==true)error('LEGACY_VALIDATION_FAILED');
  if(s.collectionHost?.migration?.sourceKey!==keys.source)error('SOURCE_SCOPE_MISMATCH');
  const kinds=scope==='formal'?['empty-new-formal','explicit-formal-copy']:['empty-new-preview','explicit-preview-copy'];
  if(!kinds.includes(s.collectionHost?.migration?.kind))error('SOURCE_SCOPE_MISMATCH');
  checkCollectiblesSource(s);return s;
}
function validateOriginal(originalRaw,s,scope,validateLegacy){
  if(scope==='preview'){if(originalRaw!==null)error('UNEXPECTED_ORIGINAL');return;}
  const keys=SCOPES.formal, a=rawJSON(originalRaw,Infinity);
  if(a.schemaVersion!==2||typeof a.payload!=='string'||a.sha256!==sha256(a.payload))error('ORIGINAL_INVALID');
  const p=rawJSON(a.payload,Infinity), m=s.collectionHost.migration;
  if(p.schemaVersion!==1||!obj(p.source)||![keys.source,keys.sourceBackup,keys.v15].every(k=>Object.hasOwn(p.source,k)&&(p.source[k]===null||typeof p.source[k]==='string'))||!validateV15(p.source[keys.v15]))error('ORIGINAL_INVALID');
  if(m.originalSha256!==a.sha256)error('ORIGINAL_BINDING_MISMATCH');
  if(p.source[keys.source]===null){if(m.kind!=='empty-new-formal'||m.sourceRev!==0)error('ORIGINAL_BINDING_MISMATCH');}
  else{
    const v=validateLegacy(p.source[keys.source],{scope,source:true});
    const old=rawJSON(p.source[keys.source]);
    if(!v||v.ok!==true||m.kind!=='explicit-formal-copy'||m.sourceRev!==old.rev)error('ORIGINAL_BINDING_MISMATCH');
  }
}
function lineage(scope,key,snapshotHash){return 'collectible-lineage:'+sha256(JSON.stringify(['collectible-lineage-v1',scope,key,snapshotHash]));}
function snapshotFor(sourceRaw,originalRaw,scope){
  const payload=canonical({schemaVersion:1,scope,sourceKey:scopeOf(scope).main,sourceProtocol:1,sourceRaw,originalRaw});
  const hash=sha256(payload);
  return {payload,hash,raw:canonical({schemaVersion:1,payload,sha256:hash})};
}

/** Requires a pinned pure validator; intentionally cannot install a coordinator. */
export function createMigrationPlanner({validateLegacy}={}){
  if(typeof validateLegacy!=='function')error('PINNED_LEGACY_VALIDATOR_REQUIRED');
  function inspect({sourceRaw,originalRaw=null,scope,existingSnapshotRaw=null}){
    const s=validateSource(sourceRaw,scope,validateLegacy);
    validateOriginal(originalRaw,s,scope,validateLegacy);
    const snap=snapshotFor(sourceRaw,originalRaw,scope);
    // A prior preparation is immutable. No silently replacing an orphan archive.
    if(existingSnapshotRaw!==null && existingSnapshotRaw!==snap.raw)error('UPGRADE_SNAPSHOT_CONFLICT');
    return freeze({scope,sourceKey:scopeOf(scope).main,sourceRevision:s.rev,sourceSha256:sha256(sourceRaw),snapshotSha256:snap.hash,snapshotRaw:snap.raw,saveLineageId:lineage(scope,scopeOf(scope).main,snap.hash),migrationId:'collectible-migration:'+snap.hash});
  }
  function buildCandidate(input){
    if(!input || input.approval===null || input.approval===undefined)return freeze({ok:false,code:'CONSENT_REQUIRED',writes:[]});
    const reviewed=inspect(input), a=input.approval;
    // A matching token is only data binding. A future host must obtain real UI
    // consent; callers cannot interpret possession of this token as user approval.
    if(!exactKeys(a,['scope','toProtocol','snapshotSha256'])||a.scope!==reviewed.scope||a.toProtocol!==2||a.snapshotSha256!==reviewed.snapshotSha256)error('CONSENT_SOURCE_MISMATCH');
    const candidate=rawJSON(input.sourceRaw);
    candidate._collectionProtocol=2;candidate.rev++;
    candidate.collectiblesV1={schemaVersion:1,catalogVersion:CATALOG_VERSION,saveLineageId:reviewed.saveLineageId,migration:{schemaVersion:1,migrationId:reviewed.migrationId,scope:reviewed.scope,sourceKey:reviewed.sourceKey,sourceProtocol:1,sourceRevision:reviewed.sourceRevision,snapshotSha256:reviewed.snapshotSha256,sourceSha256:reviewed.sourceSha256},grants:{},acknowledged:{}};
    const candidateRaw=JSON.stringify(candidate);
    if(candidateRaw.length>SOURCE_LIMIT)error('CAPACITY_READ_ONLY');
    // This is a proposal, never a write queue to auto-execute.
    return freeze({ok:true,requiresHostCommit:true,sourceRaw:input.sourceRaw,candidateRaw,snapshotRaw:reviewed.snapshotRaw,scope:reviewed.scope,saveLineageId:reviewed.saveLineageId,migrationId:reviewed.migrationId,writes:[],invariants:{mainKeyUnchanged:true,originalUnchanged:true,noAwards:true,noEconomicMutation:true}});
  }
  function verifyPrepared({candidateRaw,snapshotRaw,scope}){
    const archive=rawJSON(snapshotRaw,Infinity);
    if(!exactKeys(archive,['schemaVersion','payload','sha256'])||archive.schemaVersion!==1||typeof archive.payload!=='string'||archive.sha256!==sha256(archive.payload))error('UPGRADE_SNAPSHOT_INVALID');
    const p=rawJSON(archive.payload,Infinity);
    if(!exactKeys(p,['schemaVersion','scope','sourceKey','sourceProtocol','sourceRaw','originalRaw'])||p.schemaVersion!==1||p.scope!==scope||p.sourceKey!==scopeOf(scope).main||p.sourceProtocol!==1)error('UPGRADE_SNAPSHOT_INVALID');
    const inspected=inspect({scope,sourceRaw:p.sourceRaw,originalRaw:p.originalRaw,existingSnapshotRaw:snapshotRaw});
    const expected=buildCandidate({scope,sourceRaw:p.sourceRaw,originalRaw:p.originalRaw,existingSnapshotRaw:snapshotRaw,approval:{scope,toProtocol:2,snapshotSha256:inspected.snapshotSha256}});
    if(candidateRaw!==expected.candidateRaw)error('CANDIDATE_MISMATCH');
    return freeze({ok:true,scope,saveLineageId:inspected.saveLineageId,migrationId:inspected.migrationId});
  }
  function inspectEvidence(input){inspect(input);return inspectHiddenEvidence(input.sourceRaw);}
  return Object.freeze({inspect,buildCandidate,verifyPrepared,inspectEvidence});
}

/** Identity only. No grant receipt, ownership change, timestamp or write. */
export function deriveGrantId(saveLineageId,rewardId,ruleVersion=1){
  if(typeof saveLineageId!=='string'||!/^collectible-lineage:[a-f0-9]{64}$/.test(saveLineageId))error('VALIDATED_LINEAGE_REQUIRED');
  if(!HIDDEN.includes(rewardId)||ruleVersion!==1)error('UNSUPPORTED_HIDDEN_RULE');
  return 'collectible-grant:'+sha256(JSON.stringify(['collectible-grant-v1',saveLineageId,rewardId,ruleVersion]));
}

/** Only known raw evidence; no normalization, achievement timestamps, or awards. */
export function inspectHiddenEvidence(raw){
  const s=rawJSON(raw), shops=s.shops;
  const shopValid=Array.isArray(shops)&&shops.length===4&&shops.every(x=>obj(x)&&typeof x.open==='boolean'&&safe(x.lv,x.open?1:0)&&safe(x.emp,0,40));
  const z=s.zombie, knownKeys=['lv','cleared','best','endBest','endTop'];
  let zombieValid=obj(z)&&Object.keys(z).every(k=>knownKeys.includes(k))&&exactKeys(z.lv,['atk','rate','hp','ult'])&&Object.values(z.lv).every(n=>safe(n,0,30))&&safe(z.cleared,0,50)&&safe(z.best);
  const best=z?.endBest;
  // endBest is mandatory for the known source shape. endTop was added later.
  zombieValid=zombieValid&&exactKeys(best,['t','kills'])&&typeof best.t==='number'&&Number.isFinite(best.t)&&best.t>=0&&best.t<=86400&&safe(best.kills);
  if(zombieValid&&Object.hasOwn(z,'endTop')){
    const top=z.endTop;
    zombieValid=Array.isArray(top)&&top.length<=10&&top.every((e,i)=>exactKeys(e,['t','kills','id','at'])&&typeof e.id==='string'&&/^[a-z0-9]{1,40}$/i.test(e.id)&&!top.slice(0,i).some(x=>x.id===e.id)&&typeof e.t==='number'&&Number.isFinite(e.t)&&e.t>=0&&e.t<=86400&&safe(e.kills,0,1e7)&&typeof e.at==='number'&&Number.isFinite(e.at)&&e.at>=0);
  }
  // Absence is normal before the first zombie game; malformed present data is
  // different. Neither case awards anything or changes ordinary gameplay.
  const zombiePresent=Object.hasOwn(s,'zombie');
  const zombieStatus=!zombiePresent?'missing':zombieValid?'valid':'invalid';
  const trainingInvalid=obj(z)&&(!exactKeys(z.lv,['atk','rate','hp','ult'])||!Object.values(z.lv).every(n=>safe(n,0,30)));
  const zombieReason=zombieStatus==='missing'?'ZOMBIE_DATA_ABSENT':zombieStatus==='valid'?null:trainingInvalid?'ZOMBIE_TRAINING_INVALID':'ZOMBIE_RECORD_INVALID';
  return freeze({
    d_opening_photo:{eligible:!!shopValid&&shops.every(x=>x.open===true),evidenceValid:!!shopValid,evidenceStatus:shopValid?'valid':'invalid',reason:shopValid?null:'SHOP_RECORD_INVALID',facts:shopValid?Object.fromEntries(['bbq','tea','book','tech'].map((id,i)=>[id,shops[i].open])):null},
    d_ward_charm:{eligible:!!zombieValid&&z.cleared>=10,evidenceValid:!!zombieValid,evidenceStatus:zombieStatus,reason:zombieReason,facts:zombieValid?{cleared:z.cleared}:null},
    historicalAchievedAt:null,noAwards:true
  });
}
