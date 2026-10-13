import {planHiddenClaim,validHiddenTransition} from '../../../collectibles/decor6-grants.mjs?v=home86-bb86-20261013-r1';
import {createCardTransitionGuard} from './card-transition.mjs?v=home86-bb86-20261013-r1';
export const CARD_ADAPTER_ENABLED=false;
/** Synthetic-adapter coordinator candidate; no global storage or automatic launch. */
const fail=code=>{throw Error(code);};
const copy=x=>JSON.parse(JSON.stringify(x));
export function createCardAwareSession({scope,storage,lease,validator,canonical,model,economy:E,createCollectionHost}){
  if(!['formal','preview'].includes(scope)||!storage||!lease||!validator||typeof canonical!=='function')fail('COORDINATOR_DEPENDENCIES_REQUIRED');
  if(!model||!E||typeof createCollectionHost!=='function')fail('TRUSTED_CARD_HOST_REQUIRED');
  const cardCapability=Symbol('private-card-host-commit'),hiddenCapability=Symbol('private-hidden-claim');
  const checkCardTransition=createCardTransitionGuard({model,economy:E,canonical});
  let hostBound=false;
  const keys=Object.freeze({main:`tangzhe-${scope}-collection-v1-save`,backup:`tangzhe-${scope}-collection-v1-save-bak`,snapshot:`tangzhe-${scope}-collectibles-v2-original`,original:scope==='formal'?'tangzhe-formal-collection-v1-original':null});
  let expected=null,evidence=null,active=false,fault=null,uncertain=null,generation=0,busy=false,invalidated=false,started=false;
  const mutable=new Set(validator.mutableFields);
  const guard=g=>{if(!lease.owns())fail('LOCK_NOT_OWNED');if(invalidated)fail('SESSION_INVALIDATED');if(g!==undefined&&g!==generation)fail('SESSION_INVALIDATED');};
  const protect=e=>{fault=e?.message||String(e);active=false;return {ok:false,code:fault,readOnly:true};};
  function run(fn){if(busy)return {ok:false,code:'ACTION_IN_PROGRESS'};busy=true;const g=generation;try{guard(g);const out=fn(g);guard(g);return out;}catch(e){return protect(e);}finally{busy=false;}}
  const read=k=>storage.getItem(k);
  const readEvidence=()=>({snapshotRaw:read(keys.snapshot),originalRaw:keys.original?read(keys.original):null});
  function verifyEvidence(){const e=readEvidence();if(!evidence||e.snapshotRaw!==evidence.snapshotRaw||e.originalRaw!==evidence.originalRaw)fail('EVIDENCE_CHANGED_READ_ONLY');return e;}
  function validated(raw,e){const v=validator.validate(raw,e);if(!v.ok)fail(v.code);return v;}
  function getCurrent(){
    if(!active||fault)fail(fault||'NOT_ADOPTED');
    const e=verifyEvidence(),raw=read(keys.main);if(raw!==expected)fail('FOREIGN_WRITE_READ_ONLY');return validated(raw,e);
  }
  function adopted(raw,e){const v=validated(raw,e);expected=raw;evidence=e;active=true;started=true;fault=null;uncertain=null;return {...v,state:copy(v.state)};}
  function adopt(){return run(()=>{
    if(active)return {ok:false,code:'ALREADY_ADOPTED'};
    if(started&&!uncertain)return {ok:false,code:'SESSION_RESTART_REQUIRED'};
    if(uncertain)return {ok:false,code:'RECONCILE_REQUIRED'};
    const e=readEvidence(),raw=read(keys.main);return adopted(raw,e);
  });}
  // Explicit same-object handoff after separately confirmed migration. It does
  // not write or supply human consent. A generic refresh must not switch modes.
  function adoptMigration({approvedCandidateRaw}){return run(()=>{
    if(uncertain)fail('RECONCILE_REQUIRED');
    if(!active||fault||!expected||JSON.parse(expected)._collectionProtocol!==1)fail('LEGACY_SESSION_REQUIRED');
    const e=readEvidence(),raw=read(keys.main);
    if(raw!==approvedCandidateRaw||e.originalRaw!==evidence.originalRaw)fail('MIGRATION_HANDOFF_MISMATCH');
    const v=validated(raw,e);if(v.protocol!==2||v.state.rev!==JSON.parse(expected).rev+1)fail('MIGRATION_HANDOFF_MISMATCH');
    // Bind the approved migration to the exact previously adopted source.
    // Validator exposes sourceRaw only after full snapshot/old/original validation.
    if(v.sourceRaw!==expected)fail('MIGRATION_SOURCE_MISMATCH');
    if(raw!==v.initialRaw)fail('MIGRATION_CANDIDATE_MISMATCH');
    return adopted(raw,e);
  });}
  function current(){return run(()=>{const v=getCurrent();return {...v,state:copy(v.state)};});}
  function claimHidden(rewardId){
    const currentResult=current();if(!currentResult.ok)return currentResult;
    const plan=planHiddenClaim(currentResult.state,rewardId);if(!plan.ok)return plan;
    return commit(plan.state,{hiddenClaim:true,capability:hiddenCapability});
  }
  function commit(state,{allowCollectionChange=false,capability=null,hiddenClaim=false}={}){return run(g=>{
    const previous=getCurrent();
    canonical(state); // reject accessors/toJSON/cycles before inspecting caller data
    if(state?.rev!==previous.state.rev)return {ok:false,code:'REVISION_CONFLICT'};
    if(state._collectionProtocol!==previous.protocol)return {ok:false,code:'PROTOCOL_DOWNGRADE_OR_SWITCH_BLOCKED'};
    if(allowCollectionChange&&capability!==cardCapability)return {ok:false,code:'COLLECTION_HOST_CAPABILITY_REQUIRED'};
    if(allowCollectionChange)checkCardTransition(previous.state,state);
    if(!hiddenClaim&&['d_opening_photo','d_ward_charm'].some(id=>previous.state.gacha.owned.includes(id)!==state.gacha.owned.includes(id)))return {ok:false,code:'HIDDEN_OWNERSHIP_REQUIRES_CLAIM'};
    if(hiddenClaim&&(capability!==hiddenCapability||allowCollectionChange||!validHiddenTransition(previous.state,state)))return {ok:false,code:'HIDDEN_HOST_CAPABILITY_REQUIRED'};
    for(const k of (hiddenClaim?['collection','collectionHost']:allowCollectionChange?['collectiblesV1']:['collection','collectionHost','collectiblesV1']))if(canonical(state[k]??null)!==canonical(previous.state[k]??null))return {ok:false,code:'IMMUTABLE_COLLECTION_OR_IDENTITY'};
    for(const k of new Set([...Object.keys(previous.state),...Object.keys(state)])){
      if(mutable.has(k)||['_collectionProtocol','collection','collectionHost','collectiblesV1'].includes(k))continue;
      if(Object.hasOwn(state,k)!==Object.hasOwn(previous.state,k)||canonical(state[k])!==canonical(previous.state[k]))return {ok:false,code:'OPAQUE_EXTENSION_CHANGE_UNSUPPORTED'};
    }
    if(!validator.opaqueUnchanged(previous.state,state))return {ok:false,code:'OPAQUE_EXTENSION_CHANGE_UNSUPPORTED'};
    const oldReceipts=previous.state.tdUpgradeReceipts;
    if(oldReceipts){const n=state.tdUpgradeReceipts;if(!n||n.schemaVersion!==oldReceipts.schemaVersion||n.scope!==oldReceipts.scope||n.ruleset!==oldReceipts.ruleset||!Array.isArray(n.receipts)||n.receipts.length<oldReceipts.receipts.length||oldReceipts.receipts.some((r,i)=>canonical(r)!==canonical(n.receipts[i])))return {ok:false,code:'TD_UPGRADE_RECEIPTS_IMMUTABLE'};}
    const next=copy(state);next.rev=previous.state.rev+1;
    if(!Number.isSafeInteger(next.rev))return {ok:false,code:'REVISION_EXHAUSTED'};
    const raw=JSON.stringify(next);validated(raw,evidence);
    guard(g);verifyEvidence();if(read(keys.main)!==expected)fail('FOREIGN_WRITE_READ_ONLY');
    try{guard(g);storage.setItem(keys.backup,expected);}catch{guard(g);}
    if(read(keys.backup)!==expected)return {ok:false,code:'BACKUP_WRITE_FAILED'};
    guard(g);verifyEvidence();if(read(keys.main)!==expected)fail('FOREIGN_WRITE_READ_ONLY');
    // Record uncertainty before the attempt so a read error cannot lose the
    // intended raw. Reconciliation is read-only and never repeats gameplay.
    uncertain={before:expected,intended:raw};
    try{guard(g);storage.setItem(keys.main,raw);}catch{guard(g);}
    const actual=read(keys.main);verifyEvidence();guard(g);
    if(actual===raw){validated(actual,evidence);expected=raw;Object.assign(state,copy(next));uncertain=null;return {ok:true,state:copy(next),rev:next.rev};}
    if(actual===expected){uncertain=null;return {ok:false,code:'WRITE_FAILED'};}
    fail('COMMIT_UNCERTAIN');
  });}
  function reconcile(){return run(()=>{
    if(!uncertain)return {ok:false,code:fault||'NO_PENDING_COMMIT'};
    const e=verifyEvidence(),raw=read(keys.main);
    if(raw!==uncertain.before&&raw!==uncertain.intended)fail('FOREIGN_WRITE_READ_ONLY');
    return adopted(raw,e); // caller MUST replace its in-memory state with this result
  });}
  function invalidate(reason='SESSION_INVALIDATED'){generation++;invalidated=true;active=false;fault=reason;return {ok:false,code:reason,readOnly:true};}
  const coordinator=Object.freeze({keys,adopt,adoptMigration,current,commit,claimHidden,reconcile,invalidate,validateCollection:validator.validateCollection,get raw(){return expected;},get failed(){return fault;},get readOnly(){return !active||!!fault;}});
  const cardView=Object.freeze({current,reconcile,
    commit:(draft,options={})=>commit(draft,{allowCollectionChange:options.allowCollectionChange===true,capability:cardCapability}),
    // The pinned host reconciles only this documented sentinel on snapshot/resume.
    // Preserve detailed faults on the ordinary coordinator; never claim success.
    get failed(){return uncertain?'COMMIT_UNCERTAIN':fault;}
  });
  function attachHost(options){
    if(hostBound)fail('CARD_HOST_ALREADY_BOUND');hostBound=true;
    return createCollectionHost({...options,coordinator:cardView,model,economy:E});
  }
  return Object.freeze({coordinator,attachHost});
}
