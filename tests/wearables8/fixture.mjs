// Current candidate modules; synthetic memory only. Source lineage fixture remains explicit.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createMigrationPlanner} from '../../qa-protocol2/vendor/planner/migration.mjs';

export async function setup(ref='90641bc',scope='formal',shared=null){
  const prefix=scope==='formal'?'':'preview/';
  const base=new URL(`../../${prefix}`,import.meta.url);
  const host=await import(new URL('collection/host-save.mjs',base));
  const {createApprovedTrialModel}=await import(new URL('collection/domain/model.mjs',base));
  const {TRIAL_CONFIG}=await import(new URL('collection/domain/trial-config.mjs',base));
  const {canonical}=await import(new URL('collection/domain/json.mjs',base));
  const require=createRequire(import.meta.url), path=fileURLToPath(new URL('economy.js',base));
  delete require.cache[require.resolve(path)];const E=require(path);
  const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:['synthetic-compatibility-test-only'],walletBridgeApproved:false});
  const data=shared??new Map(),writes=[];let owned=true;
  const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes.push({key,value});data.set(key,value);}};
  const c=host.createSaveCoordinator({storage,economy:E,model,ownsLock:()=>owned});
  E[scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol'](c);
  const planner=createMigrationPlanner({validateLegacy:(raw,opts)=>c.parse(raw,{source:opts.source})});
  const keys=host.KEYS;
  const ZB=require(fileURLToPath(new URL('zombie/zbcore.js',base)));
  const t={ref,scope,E,ZB,model,c,data,writes,keys,planner,lockName:host.LOCK_NAME,setOwned:v=>owned=v,storage};
  t.input=()=>({scope,sourceRaw:data.get(keys.main),originalRaw:keys.original?data.get(keys.original):null});
  t.prepare=()=>{const input=t.input(),inspected=planner.inspect(input);return planner.buildCandidate({...input,approval:{scope,toProtocol:2,snapshotSha256:inspected.snapshotSha256}});};
  t.init=()=>{
    const s=E.newState(1700000000000);s.coins=712345;s.coinFrac=.125;s.totalEarned=1234567;s.earnedFrac=.375;
    s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});
    s.gacha={owned:E.ITEMS.map(x=>x.id),draws:36,pity:0,last:{id:'k_8',n:36,odds:'fixture',setDone:true,seen:false,super:false}};
    s.wear.c77={clothes:'c_gold',hat:'h_gold'};s.wear.pearl={clothes:'c_qipao',hat:'h_boba'};
    s.decorHidden=['d_cat'];
    s.zombie={lv:{atk:1,rate:2,hp:3,ult:0},cleared:10,best:25,endBest:{t:0,kills:0},endTop:[]};
    s.customForwardField={retained:true,nested:['original',0,null]};
    data.set(keys.source,JSON.stringify(s));data.set(keys.sourceBackup,JSON.stringify(s));
    const i=c.inspect();assert.equal(i.ok,true,JSON.stringify(i));
    const loaded=c.initialize({approvedSourceRaw:i.sourceRaw,approvedSourceEvidence:i.sourceEvidence,approvedEmpty:false,now:1700000000001});
    assert.equal(loaded.ok,true,JSON.stringify(loaded));writes.length=0;return loaded.state;
  };
  return t;
}
