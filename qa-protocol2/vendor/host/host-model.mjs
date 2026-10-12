/** Default-disabled transaction MODEL. Dependency-injected synthetic adapters only.
 * Not a browser host, complete protocol2 validator, storage CAS, or grant engine. */
export const HOST_MODEL_ENABLED = false;
const fail = code => { throw Error(code); };
const ok = extra => ({ok:true,...extra});

/** Model lock, not Web Locks. A revoked lease never becomes valid again. */
export function createModelLock(){
  let active=null;
  return Object.freeze({acquire(){
    if(active)fail('LOCK_BUSY');
    let owned=true;
    const lease=Object.freeze({owns:()=>owned,revoke(){owned=false;if(active===lease)active=null;}});
    active=lease;return lease;
  }});
}
export async function withModelLock(lock,run){
  const lease=lock.acquire();
  try{return await run(lease);}finally{lease.revoke();}
}

export function createHostModel({scope,keys,storage,lease,planner,codec,legacy,validateInitialV2,snapshotFormat=1}){
  if(!['formal','preview'].includes(scope)||!keys||!storage||!lease||!planner||!codec||!legacy||typeof validateInitialV2!=='function')fail('ADAPTERS_REQUIRED');
  keys=Object.freeze({...keys}); // caller mutation must not redirect an in-flight transaction.
  const prefix=`tangzhe-${scope}-`;
  if(keys.main!==`${prefix}collection-v1-save`||keys.backup!==`${prefix}collection-v1-save-bak`||keys.snapshot!==`${prefix}collectibles-v2-original`||keys.original!==(scope==='formal'?`${prefix}collection-v1-original`:null))fail('SCOPE_KEYS_INVALID');
  if(![1,2].includes(snapshotFormat))fail('SNAPSHOT_FORMAT_UNSUPPORTED');
  const readable=new Set([keys.main,keys.backup,keys.snapshot,...(keys.original?[keys.original]:[])]);
  const writable=new Set([keys.main,keys.backup,keys.snapshot]);
  let state='new',code=null,proposal=null,baseline=null,token=null,epoch=0,generation=0,running=false,stage='none';
  const read=k=>{if(!readable.has(k))fail('STORAGE_SCOPE');return storage.getItem(k);};
  const guard=expectedGeneration=>{if(!lease.owns())fail('LOCK_NOT_OWNED');if(expectedGeneration!==undefined&&generation!==expectedGeneration)fail('SESSION_INVALIDATED');};
  const write=(k,v,expectedGeneration)=>{guard(expectedGeneration);if(!writable.has(k))fail('STORAGE_SCOPE');storage.setItem(k,v);};
  const protect=e=>{state='protected';code=e?.message||String(e);token=null;return {ok:false,code,state,stage};};
  const reject=code=>({ok:false,code,state,stage});
  const safe=fn=>{if(running)return reject('ACTION_IN_PROGRESS');running=true;const startedGeneration=generation;try{guard();const result=fn(startedGeneration);guard(startedGeneration);if(result.ok)code=null;return result;}catch(e){return protect(e);}finally{running=false;}};
  const original=()=>keys.original?read(keys.original):null;
  function chain(snapshotRaw){
    const record=codec.decodeSnapshot(snapshotRaw,{expectedScope:scope});
    const canonical=codec.encodeSnapshot(record,{format:1});
    const p=record.payload;
    // inspect invokes pinned FULL legacy validator, then original binding.
    const input={scope,sourceRaw:p.sourceRaw,originalRaw:p.originalRaw,existingSnapshotRaw:canonical};
    const reviewed=planner.inspect(input);
    if(original()!==p.originalRaw)fail('ORIGINAL_CHANGED_READ_ONLY');
    const prepared=planner.buildCandidate({...input,approval:{scope,toProtocol:2,snapshotSha256:reviewed.snapshotSha256}});
    planner.verifyPrepared({scope,candidateRaw:prepared.candidateRaw,snapshotRaw:canonical});
    if(validateInitialV2(prepared.candidateRaw,{scope,snapshotRaw:canonical})?.ok!==true)fail('INITIAL_V2_VALIDATION_FAILED');
    return {prepared,originalRaw:p.originalRaw,sourceRaw:p.sourceRaw,snapshotRaw,canonical};
  }
  function checkBaseline(expectedSnapshot){
    guard();
    if(read(keys.main)!==baseline.sourceRaw)fail('CONSENT_SOURCE_MISMATCH');
    if(original()!==baseline.originalRaw)fail('ORIGINAL_CHANGED_READ_ONLY');
    if(read(keys.snapshot)!==expectedSnapshot)fail('UPGRADE_SNAPSHOT_CONFLICT');
  }
  function consent(){token=Object.freeze({epoch:++epoch,scope,snapshotSha256:proposal.snapshotSha256});return ok({state,token});}
  function inspect(){return safe(()=>{
    if(!['new','protected','prepared'].includes(state))return reject('INSPECT_STATE_INVALID');
    const raw=read(keys.main),snapshot=read(keys.snapshot);
    if(snapshot!==null){
      const checked=chain(snapshot);baseline=checked;proposal=planner.inspect({scope,sourceRaw:checked.sourceRaw,originalRaw:checked.originalRaw,existingSnapshotRaw:checked.canonical});
      if(raw===checked.prepared.candidateRaw){state='committed';token=null;return ok({state});}
      if(raw!==checked.sourceRaw)fail('UNSUPPORTED_OR_FOREIGN_MAIN');
      state='prepared';return consent();
    }
    const input={scope,sourceRaw:raw,originalRaw:original()};
    proposal=planner.inspect(input);
    if(legacy.check()?.ok!==true)fail('LEGACY_ADOPT_FAILED');
    baseline={...input,snapshotRaw:null};state='prompt';stage='none';return consent();
  });}
  function cancel(given){return safe(()=>{
    if(state!=='prompt'||given!==token)return reject('CANCEL_NOT_AVAILABLE');
    checkBaseline(null);
    if(legacy.check()?.ok!==true)fail('LEGACY_CURRENT_FAILED');
    token=null;state='legacy';return ok({state});
  });}
  function commitLegacy(next){return safe(startedGeneration=>{
    if(state!=='legacy')return reject('LEGACY_WRITES_BLOCKED');
    checkBaseline(null);
    if(legacy.check()?.ok!==true)fail('LEGACY_CURRENT_FAILED');
    guard(startedGeneration); // legacy adapter must additionally share this same lease in its own writer guard.
    const result=legacy.commit(next);
    if(result?.ok!==true)fail(result?.code||'LEGACY_COMMIT_FAILED');
    baseline.sourceRaw=read(keys.main);return ok({state});
  });}
  function confirm(given){return safe(startedGeneration=>{
    if(!['prompt','prepared'].includes(state)||given!==token||given?.epoch!==epoch)return reject('CONSENT_TOKEN_INVALID');
    checkBaseline(baseline.snapshotRaw);
    const candidate=planner.buildCandidate({scope,sourceRaw:baseline.sourceRaw,originalRaw:baseline.originalRaw,existingSnapshotRaw:baseline.snapshotRaw===null?null:codec.encodeSnapshot(codec.decodeSnapshot(baseline.snapshotRaw,{expectedScope:scope}),{format:1}),approval:{scope,toProtocol:2,snapshotSha256:proposal.snapshotSha256}});
    planner.verifyPrepared({scope,candidateRaw:candidate.candidateRaw,snapshotRaw:candidate.snapshotRaw});
    if(validateInitialV2(candidate.candidateRaw,{scope,snapshotRaw:candidate.snapshotRaw})?.ok!==true)fail('INITIAL_V2_VALIDATION_FAILED');
    const intendedSnapshot=baseline.snapshotRaw??codec.encodeSnapshot(codec.decodeSnapshot(candidate.snapshotRaw,{expectedScope:scope}),{format:snapshotFormat});
    token=null;state='prepared';
    stage='snapshot';
    if(baseline.snapshotRaw===null){try{write(keys.snapshot,intendedSnapshot,startedGeneration);}catch(e){guard(startedGeneration);}}
    const stored=read(keys.snapshot);
    if(stored!==intendedSnapshot)fail(stored===null?'SNAPSHOT_WRITE_FAILED':'SNAPSHOT_UNCERTAIN');
    chain(stored);baseline.snapshotRaw=stored;
    checkBaseline(stored);
    stage='backup';
    try{write(keys.backup,baseline.sourceRaw,startedGeneration);}catch(e){guard(startedGeneration);}
    if(read(keys.backup)!==baseline.sourceRaw)fail('BACKUP_WRITE_FAILED');
    checkBaseline(stored);
    stage='main';
    try{write(keys.main,candidate.candidateRaw,startedGeneration);}catch(e){guard(startedGeneration);}
    const actual=read(keys.main);
    // Recheck immutable evidence before considering the commit usable.
    if(original()!==baseline.originalRaw||read(keys.snapshot)!==stored||read(keys.backup)!==baseline.sourceRaw)fail('COMMIT_EVIDENCE_CHANGED');
    chain(stored);
    if(actual===candidate.candidateRaw){state='committed';stage='complete';return ok({state});}
    if(actual===baseline.sourceRaw){state='prepared';code='MAIN_WRITE_FAILED';return {ok:false,state,code,stage};}
    fail('COMMIT_UNCERTAIN');
  });}
  function reconcile(){return inspect();} // read-only; no implicit rollback/retry.
  function invalidate(reason='SESSION_INVALIDATED'){++epoch;++generation;token=null;state='protected';code=reason;return {ok:false,state,code};}
  return Object.freeze({inspect,cancel,confirm,commitLegacy,reconcile,invalidate,get status(){return Object.freeze({state,code,stage});}});
}
