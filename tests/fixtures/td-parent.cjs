const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
function bridgeBlock(src){
 const start=src.indexOf('function tdCard()'),marker=src.indexOf('Object.defineProperties(window.__tzz, {openTD:',start),end=src.indexOf(');',marker)+2;
 assert(start>=0&&marker>start&&end>marker,'actual parent TD entry/export boundaries must exist');return src.slice(start,end);
}
async function wallet(projectRoot){
 const file=path.join(projectRoot,'economy.js');delete require.cache[require.resolve(file)];const E=require(file);
 const imp=name=>import(pathToFileURL(path.join(projectRoot,'collection',name)));
 const [{createSaveCoordinator,KEYS},{createApprovedTrialModel},{TRIAL_CONFIG},{canonical}]=await Promise.all([imp('host-save.mjs'),imp('domain/model.mjs'),imp('domain/trial-config.mjs'),imp('domain/json.mjs')]);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
 const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:['isolated-node-fixture'],walletBridgeApproved:false});
 const coordinator=createSaveCoordinator({storage,economy:E,model,ownsLock:()=>true});
 if(E.installFormalCollectionProtocol)E.installFormalCollectionProtocol(coordinator);else E.installPreviewCollectionProtocol(coordinator);
 const seed=E.newState(1);seed.coins=5e10;seed.shops[3]={open:true,lv:1,emp:0};data.set(KEYS.source,JSON.stringify(seed));
 const inspected=coordinator.inspect();assert(inspected.ok,JSON.stringify(inspected));
 const loaded=coordinator.initialize({approvedSourceRaw:inspected.sourceRaw,approvedSourceEvidence:inspected.sourceEvidence,now:1});assert(loaded.ok,JSON.stringify(loaded));
 return {E,coordinator,data,KEYS,state:loaded.state};
}
module.exports={bridgeBlock,wallet};
