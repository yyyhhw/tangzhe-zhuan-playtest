import assert from 'node:assert/strict';
import {createCollectionHost} from '../../collection/host-wallet.mjs';
import {createRequire} from 'node:module';
import {createSaveCoordinator,KEYS} from '../../collection/host-save.mjs';
import {createApprovedTrialModel} from '../../collection/domain/model.mjs';
import {TRIAL_CONFIG} from '../../collection/domain/trial-config.mjs';
import {canonical} from '../../collection/domain/json.mjs';
const require=createRequire(import.meta.url);
const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:['test-only'],walletBridgeApproved:false});
let passed=0;
function setup(){delete require.cache[require.resolve('../../economy.js')];const E=require('../../economy.js');const data=new Map(),writes=[];let failWrite=null,failRead=null,readAfterWrite=false,owned=true,failStage=null;
 const storage={getItem(k){if(failRead===k)throw Error('read');return data.get(k)??null;},setItem(k,v){writes.push(k);if(k===KEYS.main&&failStage&&Object.values(JSON.parse(v).collection?.transactions||{}).some(t=>t.stage===failStage))throw Error('stage failure');if(failWrite===k)throw Error('write');data.set(k,v);if(readAfterWrite&&k===KEYS.main)failRead=k;}};
 const c=createSaveCoordinator({storage,economy:E,model,ownsLock:()=>owned});E.installFormalCollectionProtocol(c);
 return {E,c,data,writes,setFailStage:k=>failStage=k,setFailWrite:k=>failWrite=k,setFailRead:k=>failRead=k,setReadAfter:v=>readAfterWrite=v,setOwned:v=>owned=v,init(){const i=c.inspect();assert.equal(i.ok,true,JSON.stringify(i));return c.initialize({approvedSourceRaw:i.sourceRaw,approvedSourceEvidence:i.sourceEvidence,approvedEmpty:!i.sourceState,now:1000});}};
}
function test(name,fn){fn();passed++;console.log('PASS',name);}
test('cancel/inspection has zero writes',()=>{const t=setup();assert(t.c.inspect().needsConsent);assert.deepEqual(t.writes,[]);});
test('all formal fields + fractional wallet + raw originals preserved',()=>{const t=setup(),s=t.E.newState(1000);s.coins=712345;s.coinFrac=.1234567;s.pets={customFixture:true};s.td50=require('../../td/tdprogress.js').fresh();s.tdCampaign=require('../../td/tdcampaign-progress.js').fresh();s.extra={futureCompatibleField:[1,2,3]};s.zombieEndTopV1=[{id:'unit',t:20,kills:3,at:1}];const raw=JSON.stringify(s);t.data.set(KEYS.source,raw);t.data.set(KEYS.sourceBackup,'backup-raw');const out=t.init();assert(out.ok,JSON.stringify(out));for(const k of Object.keys(s))assert.deepEqual(out.state[k],s[k]);assert.equal(t.data.get(KEYS.source),raw);assert.equal(JSON.parse(JSON.parse(t.data.get(KEYS.original)).payload).source[KEYS.sourceBackup],'backup-raw');});
test('source mutation requires new consent without writes',()=>{const t=setup();t.data.set(KEYS.source,JSON.stringify(t.E.newState(1)));const i=t.c.inspect();t.data.set(KEYS.source,JSON.stringify(t.E.newState(2)));assert.equal(t.c.initialize({approvedSourceRaw:i.sourceRaw,approvedSourceEvidence:i.sourceEvidence,now:2}).code,'SOURCE_CHANGED_RECONFIRM');assert.deepEqual(t.writes,[]);});
for(const [name,key,value] of [['broken',KEYS.source,'{'],['future',KEYS.source,JSON.stringify({v:999})],['backup-only',KEYS.sourceBackup,'{}'],['migration-trace',KEYS.original,'{}'],['v15-only',KEYS.v15,'{}']])test(name+' protected',()=>{const t=setup();t.data.set(key,value);assert.equal(t.c.inspect().ok,false);assert.deepEqual(t.writes,[]);});
test('old writer only modifies old source after migration',()=>{const t=setup();assert(t.init().ok);const raw=t.c.raw;t.data.set(KEYS.source,'old tab progress');assert(t.c.current().ok);assert.equal(t.c.raw,raw);});
test('lost lock blocks commits',()=>{const t=setup();const s=t.init().state;t.setOwned(false);assert.equal(t.c.commit(s).code,'LOCK_NOT_OWNED');});
test('backup write failure retains main',()=>{const t=setup();const s=t.init().state,raw=t.c.raw;t.setFailWrite(KEYS.backup);assert.equal(t.c.commit(s).ok,false);assert.equal(t.data.get(KEYS.main),raw);});
test('main failure retains old revision',()=>{const t=setup();const s=t.init().state,raw=t.c.raw;t.setFailWrite(KEYS.main);assert.equal(t.c.commit(s).code,'WRITE_FAILED');assert.equal(t.data.get(KEYS.main),raw);});
test('readback uncertainty reconciles exact commit without another write',()=>{const t=setup();const s=t.init().state;t.setReadAfter(true);assert.equal(t.c.commit(s).code,'COMMIT_UNCERTAIN');const count=t.writes.length;t.setFailRead(null);assert.equal(t.c.reconcile().state.rev,1);assert.equal(t.writes.length,count);});
test('migration interrupted after archive never creates zero save',()=>{const t=setup();t.setFailWrite(KEYS.main);assert.equal(t.init().ok,false);assert.equal(t.c.inspect().code,'DESTINATION_ARTIFACT_REQUIRES_REVIEW');});
test('archive tamper protects',()=>{const t=setup();const s=t.init().state;t.data.delete(KEYS.original);assert.equal(t.c.commit(s).code,'ORIGINAL_CHANGED_READ_ONLY');});
test('business saves preserve collection when trading disabled',()=>{const t=setup();const s=t.init().state;s.taps++;assert(t.c.commit(s).ok);assert.equal(t.c.current().state.taps,1);assert.deepEqual(t.c.current().state.collection,s.collection);});


test('PREPARED result survives commit failure, reload/resume and permanent request replay',()=>{
 const t=setup(),source=t.E.newState(1);source.coins=10000000;source.coinFrac=.25;t.data.set(KEYS.source,JSON.stringify(source));let state=t.init().state,rng=0,id=0;
 const host=()=>createCollectionHost({coordinator:t.c,model,economy:t.E,getState:()=>state,replaceState:s=>state=s,flush:()=>t.c.commit(state).ok,enabled:true,randomInt:()=>{rng++;return 0},makeId:()=>`unit:${++id}`});
 let h=host();const cmd=(command,requestId,extra={})=>h.handle({card:'collection',protocol:1,command,requestId,...extra});
 const q=cmd('quote','stable-request',{request:{kind:'draw'}});assert(q.ok,JSON.stringify(q));t.setFailStage('committed');
 const out=cmd('confirm','confirm-request',{txId:q.txId,decision:'continue',allowDustOverflow:false,suppressFutureOverflowWarnings:false});assert.equal(out.ok,false);
 const prepared=t.c.current().state;assert.equal(prepared.collection.transactions[q.txId].stage,'selected');assert.equal(prepared.coins,10000000);assert.equal(rng,3);
 t.setFailStage(null);state=t.c.adopt().state;h=host();const result=cmd('resume','resume-request',{txId:q.txId});assert(result.ok,JSON.stringify(result));assert.equal(state.coins,10000000-TRIAL_CONFIG.drawPriceGold);assert.equal(state.coinFrac,.25);assert.equal(rng,3);
 const balance=state.coins;assert(cmd('quote','stable-request',{request:{kind:'draw'}}).replay);assert(cmd('resume','resume-again',{txId:q.txId}).replay);assert.equal(state.coins,balance);assert.equal(rng,3);
});
test('disabled production host rejects wallet mutation and arbitrary fields',()=>{const t=setup();let state=t.init().state;const h=createCollectionHost({coordinator:t.c,model,economy:t.E,getState:()=>state,replaceState:s=>state=s,flush:()=>true,enabled:false,randomInt:()=>0,makeId:()=> 'unit:1'});const before=t.c.raw;assert.equal(h.handle({card:'collection',protocol:1,command:'quote',requestId:'unit:q',request:{kind:'draw'}}).code,'WALLET_BRIDGE_DISABLED');assert.equal(h.handle({card:'collection',protocol:1,command:'quote',requestId:'unit:q',request:{kind:'draw'},coins:1}).code,'INVALID_COMMAND');assert.equal(t.c.raw,before);});
test('craft commit failure resumes once; cancel clears suppression choice',()=>{
 const t=setup();let state=t.init().state;state.collection=model.createState({holdings:{},dust:1000,preferences:{suppressOverflowWarning:false}});assert(t.c.commit(state,{allowCollectionChange:true}).ok);let rng=0,id=0;
 const h=createCollectionHost({coordinator:t.c,model,economy:t.E,getState:()=>state,replaceState:s=>state=s,flush:()=>t.c.commit(state).ok,enabled:true,randomInt:()=>{rng++;return 0},makeId:()=>`craft:${++id}`});const msg=(command,requestId,x={})=>h.handle({card:'collection',protocol:1,command,requestId,...x});
 const cardId=TRIAL_CONFIG.pool[0].cardId,q=msg('quote','craft:q',{request:{kind:'craft',cardId}});assert(q.ok);t.setFailStage('committed');assert.equal(msg('confirm','craft:c',{txId:q.txId,decision:'continue',allowDustOverflow:false,suppressFutureOverflowWarnings:false}).ok,false);assert.equal(t.c.current().state.collection.dust,1000);t.setFailStage(null);assert(msg('resume','craft:r',{txId:q.txId}).ok);const dust=state.collection.dust;assert.equal(state.collection.holdings[cardId].normal,1);assert(msg('resume','craft:r2',{txId:q.txId}).replay);assert.equal(state.collection.dust,dust);assert.equal(rng,0);
 const draw=msg('quote','cancel:q',{request:{kind:'craft',cardId}});assert(draw.ok);const result=msg('confirm','cancel:c',{txId:draw.txId,decision:'cancel',allowDustOverflow:true,suppressFutureOverflowWarnings:true});assert(result.ok);assert.equal(state.collection.preferences.suppressOverflowWarning,false);assert.equal(state.collection.transactions[draw.txId].decision.suppressFutureOverflowWarnings,false);assert.equal(rng,0);
});
console.log(`${passed} protocol cases passed`);
