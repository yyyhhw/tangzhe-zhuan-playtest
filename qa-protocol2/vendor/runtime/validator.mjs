import {validateHiddenLedger} from '../../../collectibles/decor6-grants.mjs?v=xingtu101-20261014-r1';
/** Pure protocol2 validation: admitted catalog, immutable migration identity and
 * bounded hidden receipts. No normalization, award side effects or storage. */
import {readSpace} from '../../../space/domain.mjs?v=xingtu101-20261014-r1';
export const PROTOCOL2_RUNTIME_ENABLED=false;
const error=code=>{throw Error(code);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,fields)=>object(x)&&Object.keys(x).sort().join('|')===[...fields].sort().join('|');
const copy=x=>JSON.parse(JSON.stringify(x));
const integer=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const MAX_BYTES=2*1024*1024; // Unchanged existing JS-string length limit.

export function createProtocol2Validator({scope,economy:E,model,planner,codec,canonical,validateLegacyCollection,petDomain=null}){
  if(!['formal','preview'].includes(scope)||!E||!model||!planner||!codec||typeof canonical!=='function'||typeof validateLegacyCollection!=='function')error('VALIDATOR_DEPENDENCIES_REQUIRED');
  if(petDomain!==null&&(typeof petDomain.transition!=='function'||JSON.stringify(petDomain.mutableFields)!==JSON.stringify(['pets'])))error('INVALID_PET_DOMAIN');
  const sourceKey=scope==='formal'?'tangzhe-save':'tangzhe-preview-save';
  const parentShape=E.newState(0),ids=new Set(E.ITEMS.map(x=>x.id));
  // Existing Economy boot writes only these one-way, literal-1 footprint markers.
  const footprintMarkers=Object.freeze(['fpMig11w','fpMig11z']);
  const validFootprintMarkers=s=>footprintMarkers.every(k=>!Object.hasOwn(s,k)||s[k]===1);
  const clothes=new Set(E.ITEMS.filter(x=>x.type==='clothes').map(x=>x.id));
  const hats=new Set(E.ITEMS.filter(x=>x.type==='hat').map(x=>x.id));
  // Item schema uses kind in the reviewed game. Keep a source-bound slot map.
  for(const id of ids){if(id.startsWith('c_'))clothes.add(id);if(id.startsWith('h_'))hats.add(id);}
  clothes.add('c_gold');hats.add('h_gold');
  // Formal app persist calls pinned zombie/zbcore.js preserveFormalTop.
  // Admit only its bounded, canonical Top10 mirror; no generic extension writes.
  const compareTop=(a,b)=>b.t-a.t||b.kills-a.kills||a.at-b.at;
  function validTop(rows){
    return Array.isArray(rows)&&rows.length<=10&&new Set(rows.map(e=>e?.id)).size===rows.length&&rows.every((e,i)=>
      exact(e,['t','kills','id','at'])&&typeof e.id==='string'&&/^[a-z0-9]{1,40}$/i.test(e.id)&&
      typeof e.t==='number'&&Number.isFinite(e.t)&&e.t>=0&&e.t<=86400&&integer(e.kills)&&e.kills<=1e7&&
      typeof e.at==='number'&&Number.isFinite(e.at)&&e.at>=0&&(!i||compareTop(rows[i-1],e)<=0));
  }
  function validFormalMirror(s){
    if(scope!=='formal'||!Object.hasOwn(s,'zombieEndTopV1'))return true;
    return validTop(s.zombieEndTopV1);
  }
  function mirrorTransition(before,after){
    if(scope!=='formal')return true; // preview keeps this key opaque
    if(!validFormalMirror(after))return false;
    if(Object.hasOwn(before,'zombieEndTopV1')&&!Object.hasOwn(after,'zombieEndTopV1'))return false;
    if(!Object.hasOwn(after,'zombieEndTopV1'))return true;
    const mirror=before.zombieEndTopV1??[],current=before.zombie?.endTop??[];
    if(!validTop(mirror)||!validTop(current))return false;
    const prior=[];
    for(const row of [...current,...mirror]){const same=prior.find(e=>e.id===row.id);if(same){if(canonical(same)!==canonical(row))return false;}else prior.push(row);}
    const best=before.zombie?.endBest;
    if(best&&typeof best.t==='number'&&best.t>0&&!prior.some(e=>e.t>=best.t)){
      const legacy={t:best.t,kills:best.kills,id:'legacy'+Math.round(best.t*1000).toString(36),at:0};
      if(!validTop([legacy])||prior.some(e=>e.id===legacy.id))return false;prior.push(legacy);
    }
    prior.sort(compareTop);prior.splice(10);
    const rows=after.zombieEndTopV1,afterTop=after.zombie?.endTop;
    // A legacy parent may drop endTop while the immutable mirror keeps its rows.
    // It may not rewrite an existing run and postpone the conflict to next boot.
    if(afterTop!==undefined){if(!validTop(afterTop))return false;for(const row of afterTop){const old=prior.find(e=>e.id===row.id);if(old&&canonical(old)!==canonical(row))return false;}}
    const changed=!Object.hasOwn(before,'zombieEndTopV1')||canonical(mirror)!==canonical(rows);
    if(changed&&(!object(after.zombie)||!validTop(afterTop)||canonical(rows)!==canonical(afterTop)))return false;
    // Existing run identities cannot be rewritten or silently removed below capacity.
    for(const old of prior){const found=rows.find(e=>e.id===old.id);
      if(found){if(canonical(found)!==canonical(old))return false;}
      else if(rows.length<10||compareTop(rows[rows.length-1],old)>0)return false;
    }
    return true;
  }
  function shape(v,s){
    if(s===null)return true;
    if(Array.isArray(s))return Array.isArray(v)&&(!s.length||(v.length===s.length&&s.every((x,i)=>shape(v[i],x))));
    if(typeof s==='object')return object(v)&&Object.keys(s).every(k=>Object.hasOwn(v,k)&&shape(v[k],s[k]));
    if(typeof s==='number')return typeof v==='number'&&Number.isFinite(v);
    return typeof v===typeof s;
  }
  function parse(raw){
    if(typeof raw!=='string'||!raw.length)error('SAVE_MISSING');
    if(raw.length>MAX_BYTES)error('CAPACITY_READ_ONLY');
    let s;try{s=JSON.parse(raw);canonical(s);}catch{error('INVALID_JSON_READ_ONLY');}
    if(!object(s))error('INVALID_SAVE_READ_ONLY');return s;
  }
  // Adapted from the pinned host-save validateCollection: protocol2 is explicit,
  // not a clone with protocol reset or fields removed. Called by E.checkSave.
  function validateCollection(s){
    if(s?._collectionProtocol===1)return validateLegacyCollection(s);
    try{
      if(s?._collectionProtocol!==2||!object(s.collection)||!object(s.collectionHost))error('collection-protocol');
      model.restore(s.collection);
      const h=s.collectionHost;
      if(!exact(h,['schemaVersion','requests','acknowledged','migration'])||h.schemaVersion!==1||!object(h.requests)||!object(h.acknowledged))error('host');
      for(const [key,e]of Object.entries(h.requests)){
        if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(key)||!exact(e,['requestCanonical','txId'])||typeof e.requestCanonical!=='string'||!Object.hasOwn(s.collection.transactions,e.txId)||e.requestCanonical!==canonical(s.collection.transactions[e.txId].request))error('request');
      }
      for(const[id,value]of Object.entries(h.acknowledged))if(value!==true||s.collection.transactions[id]?.stage!=='committed')error('ack');
      const m=h.migration;
      if(!object(m)||m.schemaVersion!==1||![(scope==='formal'?'empty-new-formal':'empty-new-preview'),(scope==='formal'?'explicit-formal-copy':'explicit-preview-copy')].includes(m.kind)||m.sourceKey!==sourceKey||!integer(m.sourceRev))error('migration');
      if(scope==='formal'&&(typeof m.originalSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.originalSha256)))error('original');
      return [];
    }catch{return ['collection-invalid-or-unsupported'];}
  }
  function collectibles(s){
    const g=s.gacha;
    if(!object(g)||!Array.isArray(g.owned)||g.owned.some(x=>typeof x!=='string'||!ids.has(x))||new Set(g.owned).size!==g.owned.length||!integer(g.draws)||!integer(g.pity))error('INVALID_GACHA');
    if(g.last!==null&&(!object(g.last)||!ids.has(g.last.id)||typeof g.last.seen!=='boolean'))error('INVALID_LAST');
    if(!object(s.wear)||!E.CEOS.every(c=>object(s.wear[c.id])))error('INVALID_WEAR');
    for(const c of E.CEOS){const w=s.wear[c.id];if(!(w.clothes===null||clothes.has(w.clothes))||!(w.hat===null||hats.has(w.hat)))error('INVALID_WEAR_SLOT');}
    if(!Array.isArray(s.decorHidden)||s.decorHidden.some(x=>typeof x!=='string'))error('INVALID_DECOR_HIDDEN');
  }
  // Migration evidence is immutable within a writer session. Cache only one
  // fully verified exact raw pair; current-save validation and coordinator
  // evidence/read-back checks still run on every commit.
  let snapshotCache=null;
  function freezeEvidence(value){
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(freezeEvidence);Object.freeze(value);
    }
    return value;
  }
  function snapshotChain(snapshotRaw,originalRaw){
    if(snapshotCache&&snapshotCache.snapshotRaw===snapshotRaw&&snapshotCache.originalRaw===originalRaw)return snapshotCache.chain;
    snapshotCache=null; // Never retain a successful entry across changed evidence.
    const record=codec.decodeSnapshot(snapshotRaw,{expectedScope:scope});
    const legacySnapshot=codec.encodeSnapshot(record,{format:1});
    const p=record.payload,input={scope,sourceRaw:p.sourceRaw,originalRaw:p.originalRaw,existingSnapshotRaw:legacySnapshot};
    const reviewed=planner.inspect(input); // pinned FULL old validator, then original binding
    if(originalRaw!==p.originalRaw)error('ORIGINAL_CHANGED_READ_ONLY');
    const initial=planner.buildCandidate({...input,approval:{scope,toProtocol:2,snapshotSha256:reviewed.snapshotSha256}});
    planner.verifyPrepared({scope,candidateRaw:initial.candidateRaw,snapshotRaw:legacySnapshot});
    const chain=freezeEvidence({source:parse(p.sourceRaw),initial:parse(initial.candidateRaw),initialRaw:initial.candidateRaw,reviewed,sourceRaw:p.sourceRaw});
    snapshotCache={snapshotRaw,originalRaw,chain};
    return chain;
  }
  function validate(raw,{snapshotRaw=null,originalRaw=null}={}){
    try{
      const s=parse(raw);
      const space=readSpace(s);if(!space.ok)error(space.code);
      if(!validFormalMirror(s))error('INVALID_FORMAL_ZOMBIE_MIRROR');
      if(!validFootprintMarkers(s))error('INVALID_FOOTPRINT_MIGRATION_MARKER');
      if(s._collectionProtocol===1){
        if(snapshotRaw!==null)error('PREPARED_READ_ONLY');
        planner.inspect({scope,sourceRaw:raw,originalRaw});
        return {ok:true,state:s,protocol:1,raw};
      }
      if(s._collectionProtocol!==2)error('PROTOCOL_UNSUPPORTED');
      if(s.v!==E.CFG.SAVE_VERSION||!integer(s.rev)||!shape(s,parentShape))error('INCOMPLETE_PARENT_SAVE');
      if(!integer(s.coins)||typeof s.coinFrac!=='number'||!Number.isFinite(s.coinFrac)||s.coinFrac<0||s.coinFrac>=1)error('INVALID_WALLET');
      if(validateCollection(s).length||E.validState(copy(s)).length||E.checkSave(copy(s)).length)error('INVALID_PARENT_OR_COLLECTION');
      collectibles(s);
      // 杨总 16:12 每日 5 次开盒：可选字段，缺 = 今天 0 次；有就必须是 {day:'YYYY-MM-DD',n:非负整数}
      if(Object.hasOwn(s,'gachaDaily')&&s.gachaDaily!==null&&(!exact(s.gachaDaily,['day','n'])||typeof s.gachaDaily.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.gachaDaily.day)||!integer(s.gachaDaily.n)))error('INVALID_GACHA_DAILY');
      const chain=snapshotChain(snapshotRaw,originalRaw);
      if(!exact(s.collectiblesV1,['schemaVersion','catalogVersion','saveLineageId','migration','grants','acknowledged']))error('IDENTITY_OR_UNSUPPORTED_GRANTS');
      const identity={...s.collectiblesV1,grants:{},acknowledged:{}};
      if(canonical(identity)!==canonical(chain.initial.collectiblesV1)||!validateHiddenLedger(s))error('IDENTITY_OR_UNSUPPORTED_GRANTS');
      if(Object.hasOwn(s,'saveLineageId'))error('UNSUPPORTED_TOP_LEVEL_IDENTITY');
      if(s.rev<chain.initial.rev)error('REVISION_BEFORE_MIGRATION');
      if(canonical(s.collectionHost.migration)!==canonical(chain.source.collectionHost.migration))error('COLLECTION_ORIGINAL_BINDING');
      return {ok:true,state:s,protocol:2,raw,identity:copy(s.collectiblesV1),sourceRevision:chain.source.rev,sourceRaw:chain.sourceRaw,initialRaw:chain.initialRaw};
    }catch(e){return {ok:false,code:e?.message||String(e)};}
  }
  const mutableFields=Object.freeze([...new Set([...Object.keys(parentShape),...footprintMarkers,...(petDomain?['pets']:[]),...(scope==='formal'?['zombieEndTopV1']:[]),'td','td50','tdCampaign','tdUpgradeReceipts','zombie','gachaDaily'])]);
  // Preserve opaque fields beneath fixed parent shapes too. Empty dictionaries,
  // empty arrays and null placeholders are dynamic domains governed by the pinned
  // validators; this is not an invented stricter schema for their contents.
  function opaqueUnchanged(before,after){
    if(petDomain&&!petDomain.transition(before,after).ok)return false;
    if(!mirrorTransition(before,after))return false;
    if(!validFootprintMarkers(before)||!validFootprintMarkers(after)||footprintMarkers.some(k=>Object.hasOwn(before,k)&&!Object.hasOwn(after,k)))return false;
    const rootShape={...parentShape,...(petDomain?{pets:null}:{}),...(scope==='formal'?{zombieEndTopV1:null}:{}),fpMig11w:null,fpMig11z:null,td:null,td50:null,tdCampaign:null,tdUpgradeReceipts:null,zombie:null,gachaDaily:null,_collectionProtocol:null,collection:null,collectionHost:null,collectiblesV1:null};
    function walk(a,b,s){
      if(s===null||typeof s!=='object')return true;
      if(Array.isArray(s))return !s.length||!Array.isArray(a)||!Array.isArray(b)||a.every((v,i)=>walk(v,b[i],s[i]??s[0]));
      if(!Object.keys(s).length)return true;
      if(!object(a)||!object(b))return true; // full validator handles required shape
      for(const k of new Set([...Object.keys(a),...Object.keys(b)])){
        if(!Object.hasOwn(s,k)){
          if(Object.hasOwn(a,k)!==Object.hasOwn(b,k)||canonical(a[k])!==canonical(b[k]))return false;
        }else if(!walk(a[k],b[k],s[k]))return false;
      }
      return true;
    }
    return walk(before,after,rootShape);
  }
  return Object.freeze({validate,validateCollection,mutableFields,opaqueUnchanged});
}
