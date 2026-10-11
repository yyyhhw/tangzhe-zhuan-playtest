// Optional formal-save extension. Existing saves without this field remain valid.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./tdcore.js'),require('./tdcampaign-progress.js'));
 else root.TDUpgradeReceipts=factory(root.TDCore,root.TDStageProgress);
})(this,function(T,P){
 'use strict';
 const SCOPE='formal-td-upgrade-v1',MAX=4096;
 const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.sort().join('|');
 const fresh=()=>({schemaVersion:1,scope:SCOPE,ruleset:P.RULESET_ID,receipts:[]});
 function check(value,td){
  if(value===undefined)return [];
  const bad=()=>['tdUpgradeReceipts.invalid'];
  if(!exact(value,['schemaVersion','scope','ruleset','receipts'])||value.schemaVersion!==1||value.scope!==SCOPE||value.ruleset!==P.RULESET_ID||!Array.isArray(value.receipts)||value.receipts.length>MAX)return bad();
  const ids=new Set(),last=new Map(),levels=P.legacy(td).lv;
  for(const r of value.receipts){
   if(!exact(r,['requestId','id','fromLevel','toLevel','cost'])||!P.validId(r.requestId)||ids.has(r.requestId)||!T.TOWER_IDS.includes(r.id)||!Number.isInteger(r.fromLevel)||r.fromLevel<0||r.fromLevel>=T.MAX_UP||r.toLevel!==r.fromLevel+1||r.cost!==T.price(r.id,r.fromLevel)||levels[r.id]<r.toLevel||(last.has(r.id)&&last.get(r.id)!==r.fromLevel))return bad();
   ids.add(r.requestId);last.set(r.id,r.toLevel);
  }
  return [];
 }
 return {SCOPE,MAX,fresh,check};
});
