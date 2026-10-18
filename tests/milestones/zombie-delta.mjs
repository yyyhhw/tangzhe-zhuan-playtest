import {withoutHome43Delta} from '../home43/exact-delta.mjs';
/** Exact second-candidate delta; reverse only these lines before original protection hashes. */
const delta={
  "qa-protocol2/vendor/cards/card-coordinator.mjs": [
    [
      "  const zombieStartCapability=Symbol('confirmed-zombie-start');\n",
      ""
    ],
    [
      "  function commit(state,{allowCollectionChange=false,capability=null,hiddenClaim=false,spaceToken=null,moonToken=null,zombieToken=null}={}){return run(g=>{\n",
      "  function commit(state,{allowCollectionChange=false,capability=null,hiddenClaim=false,spaceToken=null,moonToken=null}={}){return run(g=>{\n"
    ],
    [
      "    const zombieStarted=zombieToken===zombieStartCapability;\n    if(zombieStarted&&(initializing||moon||allowCollectionChange||hiddenClaim||canonical(state)!==canonical(previous.state)))return {ok:false,code:'ZOMBIE_START_ONLY'};\n",
      ""
    ],
    [
      "    if(!initializing)next.milestones=recordTransition(previous.state,next,spaceClock(),MOON_RULES,{zombieStarted});\n",
      "    if(!initializing)next.milestones=recordTransition(previous.state,next,spaceClock(),MOON_RULES);\n"
    ],
    [
      "  function recordZombieStarted(...args){\n    if(args.length)return {ok:false,code:'ZOMBIE_START_ARGUMENTS_REFUSED'};\n    const previous=current();if(!previous.ok)return previous;\n    if(Object.hasOwn(previous.state.milestones?.events??{},'firstZombie'))return {ok:true,noop:true};\n    return commit(previous.state,{zombieToken:zombieStartCapability});\n  }\n",
      ""
    ],
    [
      "  const coordinator=Object.freeze({keys,adopt,adoptMigration,current,commit,claimHidden,recordZombieStarted,initializeSpace,spaceView,spacePreview,spaceIntent,reconcile,invalidate,validateCollection:validator.validateCollection,get raw(){return expected;},get failed(){return fault;},get uncertain(){return uncertain!==null;},get readOnly(){return !active||!!fault;}});\n",
      "  const coordinator=Object.freeze({keys,adopt,adoptMigration,current,commit,claimHidden,initializeSpace,spaceView,spacePreview,spaceIntent,reconcile,invalidate,validateCollection:validator.validateCollection,get raw(){return expected;},get failed(){return fault;},get uncertain(){return uncertain!==null;},get readOnly(){return !active||!!fault;}});\n"
    ]
  ],
  "qa-protocol2/real-page-facade.mjs": [
    [
      "  function recordZombieStarted(...args) {\n    if(args.length)return fail('ZOMBIE_START_ARGUMENTS_REFUSED');\n    if(!writable())return gate();\n    if(!app||app.persist.pending||app.zombieStartReady?.()!==true)return fail('ZOMBIE_START_NOT_CONFIRMED');\n    const saved=invoke('current');if(!saved.ok)return protect(saved);\n    if(Object.hasOwn(saved.state.milestones?.events??{},'firstZombie'))return {ok:true,noop:true};\n    if(app.persist()!==true)return protect(fail('PARENT_SAVE_FAILED'),{recoverCurrent:!owner.readOnly&&!owner.failed});\n    if(!writable()||app.zombieStartReady?.()!==true)return fail('ZOMBIE_START_NOT_CONFIRMED');\n    const synced=invoke('current');if(!synced.ok)return protect(synced);\n    if(canonical(app.state)!==canonical(synced.state))return fail('ZOMBIE_APP_SAVE_REQUIRED');\n    const result=invoke('recordZombieStarted');\n    if(!result.ok)return protect(result,{recoverCurrent:!owner.readOnly&&!owner.failed});\n    return result.noop?result:play(result);\n  }\n",
      ""
    ],
    [
      "  const coordinator = Object.freeze({keys, current, commit, recordZombieStarted, initializeSpace, spaceView, spacePreview, spaceIntent,\n",
      "  const coordinator = Object.freeze({keys, current, commit, initializeSpace, spaceView, spacePreview, spaceIntent,\n"
    ]
  ]
};
export function withoutZombieStartDelta(path,source){
  source=withoutHome43Delta(path,source); // 家宅-43 叠在最上面：先撤 43（撤过的原样返回）
 for(const [after,before] of delta[path]??[]){if(source.split(after).length!==2)throw Error("MILESTONE_DELTA_NOT_EXACT: "+path);source=source.replace(after,before);}
 return source;
}
