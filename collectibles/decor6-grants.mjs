/** Pure claim proposals. Only the exclusive host coordinator may commit them.
 * No clocks, RNG, wallet mutation, normalization, storage or startup awards. */
import {canonical,clone} from '../collection/domain/json.mjs?v=box109-20261014-r1';
import {deriveGrantId,inspectHiddenEvidence} from '../qa-protocol2/vendor/planner/migration.mjs?v=box109-20261014-r1';
import {HIDDEN_DECOR6} from './decor6-catalog.mjs?v=box109-20261014-r1';
const ids=new Set(HIDDEN_DECOR6.map(x=>x.id));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function hiddenEligibility(state,id){
  if(!ids.has(id))return {eligible:false,reason:'UNSUPPORTED_HIDDEN_RULE'};
  const facts={shops:state.shops};
  if(Object.hasOwn(state,'zombie'))facts.zombie=state.zombie;
  canonical(facts);
  return inspectHiddenEvidence(JSON.stringify(facts))[id];
}
export function validateHiddenLedger(state){
  try{
    const c=state.collectiblesV1;
    if(!object(c?.grants)||!object(c?.acknowledged))return false;
    const grants=Object.entries(c.grants);
    if(grants.length>2||Object.keys(c.acknowledged).length!==grants.length)return false;
    for(const [key,r]of grants){
      if(!object(r)||!ids.has(r.rewardId)||key!==deriveGrantId(c.saveLineageId,r.rewardId)||r.ruleVersion!==1||r.grantId!==key||!['earned','already-owned'].includes(r.kind)||c.acknowledged[key]!==true||!state.gacha.owned.includes(r.rewardId))return false;
      if(Object.keys(r).sort().join('|')!=='evidence|grantId|kind|rewardId|ruleVersion')return false;
      const expected=r.rewardId==='d_opening_photo'?{bbq:true,tea:true,book:true,tech:true}:null;
      if(expected?canonical(r.evidence)!==canonical(expected):!object(r.evidence)||Object.keys(r.evidence).join('|')!=='cleared'||!Number.isSafeInteger(r.evidence.cleared)||r.evidence.cleared<10||r.evidence.cleared>50)return false;
    }
    return true;
  }catch{return false;}
}
// Cloning is not a signature: preserve source enumeration order at every depth.
// Keep the same strict canonical admission as clone(), but never read getters,
// invoke toJSON, or assign through __proto__. Comparisons remain canonical.
function cloneInSourceOrder(value){
  canonical(value);
  function copy(v){
    if(v===null||typeof v!=='object')return v===0?0:v;
    const array=Array.isArray(v),out=array?[]:{};
    for(const [key,d]of Object.entries(Object.getOwnPropertyDescriptors(v))){
      if(array&&key==='length')continue;
      Object.defineProperty(out,key,{value:copy(d.value),enumerable:true,writable:true,configurable:true});
    }
    return out;
  }
  return copy(value);
}
export function planHiddenClaim(state,rewardId){
  canonical(state);
  if(state?._collectionProtocol!==2||!ids.has(rewardId)||!validateHiddenLedger(state))return {ok:false,code:'HIDDEN_CLAIM_INVALID'};
  const grantId=deriveGrantId(state.collectiblesV1.saveLineageId,rewardId);
  if(Object.hasOwn(state.collectiblesV1.grants,grantId))return {ok:false,code:'HIDDEN_ALREADY_CLAIMED'};
  const evidence=hiddenEligibility(state,rewardId);
  if(!evidence.eligible)return {ok:false,code:evidence.reason||'HIDDEN_NOT_ELIGIBLE'};
  const next=cloneInSourceOrder(state),already=next.gacha.owned.includes(rewardId);
  if(!already)next.gacha.owned.push(rewardId);
  next.collectiblesV1.grants[grantId]={grantId,rewardId,ruleVersion:1,kind:already?'already-owned':'earned',evidence:clone(evidence.facts)};
  next.collectiblesV1.acknowledged[grantId]=true;
  return {ok:true,state:next,grantId,alreadyOwned:already};
}
/** A claim is one exact, isolated transition; opaque data stays byte-equivalent
 * under canonical JSON. Host owns revision increment, backup and readback. */
export function validHiddenTransition(before,after){
  try{
    for(const id of ids){const p=planHiddenClaim(before,id);if(p.ok&&canonical(p.state)===canonical(after))return true;}
    return false;
  }catch{return false;}
}
