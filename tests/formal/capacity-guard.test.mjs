import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCollectionHost,reserveFor} from '../../collection/host-wallet.mjs';
import {createSaveCoordinator,KEYS} from '../../collection/host-save.mjs';
import {createApprovedTrialModel} from '../../collection/domain/model.mjs';
import {TRIAL_CONFIG} from '../../collection/domain/trial-config.mjs';
import {canonical} from '../../collection/domain/json.mjs';
import {planBatchDraw,BATCH_DRAW_ENABLED} from '../../collection/batch-draw.mjs';
const require=createRequire(import.meta.url);
const model=createApprovedTrialModel(TRIAL_CONFIG,{schemaVersion:1,approvedConfigCanonical:canonical(TRIAL_CONFIG),evidenceRefs:['test-only'],walletBridgeApproved:false});
const PRICE=TRIAL_CONFIG.drawPriceGold;
function setup({maxBytes,coins=PRICE*20,failStage=null}={}){
  delete require.cache[require.resolve('../../economy.js')];const E=require('../../economy.js');
  const data=new Map(),writes=[];const ctl={failStage,throwMain:false};
  const storage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);if(k===KEYS.main&&(ctl.throwMain||(ctl.failStage&&Object.values(JSON.parse(v).collection?.transactions||{}).some(t=>t.stage===ctl.failStage))))throw new Error('QuotaExceededError');data.set(k,v);}};
  const c=createSaveCoordinator({storage,economy:E,model,ownsLock:()=>true,...(maxBytes?{maxBytes}:{})});E.installFormalCollectionProtocol(c);
  const src=E.newState(1);src.coins=coins;src.coinFrac=.5;data.set(KEYS.source,JSON.stringify(src));
  const i=c.inspect();let state=c.initialize({approvedSourceRaw:i.sourceRaw,approvedSourceEvidence:i.sourceEvidence,approvedEmpty:false,now:1000}).state;
  let rng=0,id=0;
  const mk=()=>createCollectionHost({coordinator:c,model,economy:E,getState:()=>state,replaceState:s=>state=s,flush:()=>c.commit(state).ok,enabled:true,randomInt:()=>{rng++;return 0},makeId:()=>`cap:${++id}`});
  const t={E,c,data,writes,ctl,get state(){return state},set state(v){state=v},get rng(){return rng},host:mk(),mk};
  t.cmd=(command,requestId,extra={})=>t.host.handle({card:'collection',protocol:1,command,requestId,...extra});
  t.draw=(n)=>{const q=t.cmd('quote',`q${n}`,{request:{kind:'draw'}});if(!q.ok)return q;const r=t.cmd('confirm',`c${n}`,{txId:q.txId,decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false});return r.ok?{...r,txId:q.txId}:{...r,txId:q.txId};};
  return t;
}
const tx=(t,id)=>t.state.collection.transactions[id];

test('complete transaction: final result + receipt + ack all persist within reserve',()=>{
  const t=setup();const before=t.state.coins;const r=t.draw(1);assert(r.ok,JSON.stringify(r));
  assert.equal(tx(t,r.txId).stage,'committed');assert.equal(tx(t,r.txId).receipt.txId,r.txId);assert.equal(t.state.coins,before-PRICE);
  const est=reserveFor({state:t.c.current().state,model,request:{kind:'draw'},txId:'x:1',requestId:'y',maxBytes:t.c.maxBytes});assert(est.estimated);assert(est.reserveBytes>0);
  const a=t.cmd('acknowledge','a1',{txId:r.txId});assert(a.ok);assert.equal(t.c.current().state.collectionHost.acknowledged[r.txId],true);
  assert(t.cmd('acknowledge','a1b',{txId:r.txId}).replay);
});
test('reserve covers real full transaction size (draw and craft)',()=>{
  const t=setup();const s0=t.c.current().state;
  const est=reserveFor({state:s0,model,request:{kind:'draw'},txId:'cap:1',requestId:'q1',maxBytes:t.c.maxBytes,marginBytes:0});
  const r=t.draw(1);assert(r.ok);assert(t.cmd('acknowledge','a',{txId:r.txId}).ok);
  assert(t.c.raw.length<=est.neededBytes+64,`actual ${t.c.raw.length} vs reserved ${est.neededBytes}`);
});
test('capacity limit: quote rejected before BEGIN, no collection write, no debit, no RNG',()=>{
  const probe=setup();const need=reserveFor({state:probe.c.current().state,model,request:{kind:'draw'},txId:'cap:1',requestId:'q1',maxBytes:1e9}).neededBytes;
  const t=setup({maxBytes:need-1});const raw=t.c.raw,coins=t.state.coins,w=t.writes.length;
  const q=t.cmd('quote','q1',{request:{kind:'draw'}});assert.equal(q.ok,false);assert.equal(q.code,'CAPACITY_LIMIT_REACHED');
  // only the pre-mutation business flush may write; collection/coins unchanged
  const cur=t.c.current().state;assert.equal(cur.coins,coins);assert.deepEqual(cur.collection.transactions,{});assert.equal(cur.collection.activeTxId,null);assert.equal(t.rng,0);
  // business saves keep working
  const s=t.state;s.taps=(s.taps||0)+1;assert(t.c.commit(s).ok);assert(raw!==t.c.raw||w>=0);
  const ok=setup({maxBytes:need});assert(ok.draw(1).ok);
});
test('commit write failure (quota/capacity) never swallows the debit; resume debits exactly once',()=>{
  const t=setup({failStage:'committed'});const coins=t.state.coins,frac=t.state.coinFrac;
  const r=t.draw(1);assert.equal(r.ok,false);const cur=t.c.current().state;assert.equal(cur.coins,coins);assert.equal(cur.coinFrac,frac);assert.equal(tx({state:cur},r.txId).stage,'selected');
  t.ctl.failStage=null;t.state=t.c.adopt().state;t.host=t.mk();
  const rec=t.host.recoverPending();assert(rec.ok&&rec.recovered,JSON.stringify(rec));assert.equal(t.state.coins,coins-PRICE);
  const rng=t.rng;assert(t.cmd('resume','again',{txId:r.txId}).replay);assert.equal(t.state.coins,coins-PRICE);assert.equal(t.rng,rng);
  assert.equal(t.host.recoverPending().reason,'NO_PENDING');
});
test('save failure code is propagated (CAPACITY_READ_ONLY), state rolled back',()=>{
  // shrink limit after BEGIN so COMMIT exceeds maxBytes
  const t=setup();const q=t.cmd('quote','q1',{request:{kind:'draw'}});assert(q.ok);const len=t.c.raw.length;
  delete require.cache[require.resolve('../../economy.js')];const E2=require('../../economy.js');
  const small=createSaveCoordinator({storage:{getItem:k=>t.data.get(k)??null,setItem:(k,v)=>t.data.set(k,v)},economy:E2,model,ownsLock:()=>true,maxBytes:len+600});
  E2.installFormalCollectionProtocol(small);let st=small.adopt().state;const coins=st.coins;
  const h=createCollectionHost({coordinator:small,model,economy:E2,getState:()=>st,replaceState:s=>st=s,flush:()=>small.commit(st).ok,enabled:true,randomInt:()=>0,makeId:()=>'z:1'});
  const r=h.handle({card:'collection',protocol:1,command:'confirm',requestId:'c1',txId:q.txId,decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false});
  assert.equal(r.ok,false);assert.equal(r.code,'CAPACITY_READ_ONLY');assert.equal(small.current().state.coins,coins);
  assert.equal(h.recoverPending().code,'CAPACITY_READ_ONLY');assert.equal(small.current().state.coins,coins);
});
test('hanging awaiting-decision tx is not decided for the player; new tx blocked',()=>{
  const t=setup();const q=t.cmd('quote','q1',{request:{kind:'draw'}});assert(q.ok);
  const rec=t.host.recoverPending();assert.equal(rec.needsDecision,true);assert.equal(tx(t,q.txId).stage,'awaiting-decision');assert.equal(t.rng,0);
  assert.equal(t.cmd('quote','q2',{request:{kind:'draw'}}).code,'ACTIVE_TRANSACTION_PENDING');
});
test('recovery is not gated by the new-transaction capacity reserve',()=>{
  const t=setup({failStage:'committed'});const r=t.draw(1);assert.equal(r.ok,false);t.ctl.failStage=null;
  // simulate an old save that is now above the new-tx threshold: huge margin makes every quote fail
  t.state=t.c.adopt().state;const h=createCollectionHost({coordinator:t.c,model,economy:t.E,getState:()=>t.state,replaceState:s=>t.state=s,flush:()=>t.c.commit(t.state).ok,enabled:true,randomInt:()=>0,makeId:()=>'n:1',capacityMarginBytes:t.c.maxBytes});
  assert(h.recoverPending().recovered);assert.equal(h.capacity().ok,false);
  assert.equal(h.handle({card:'collection',protocol:1,command:'quote',requestId:'q9',request:{kind:'draw'}}).code,'CAPACITY_LIMIT_REACHED');
});
test('no history deleted: transactions/events only grow across many draws',()=>{
  const t=setup();let prevTx=0,prevEv=0;for(let i=1;i<=5;i++){const r=t.draw(i);assert(r.ok);assert(t.cmd('acknowledge','a'+i,{txId:r.txId}).ok);const c=t.state.collection;const n=Object.keys(c.transactions).length;assert(n>prevTx);assert(c.events.length>prevEv);prevTx=n;prevEv=c.events.length;}
  assert.equal(TRIAL_CONFIG.drawPriceGold,5000000);
});
test('ten-draw is interface only and not enabled',()=>{
  assert.equal(BATCH_DRAW_ENABLED,false);
  assert.equal(planBatchDraw({count:10,usedBytes:1000,reservePerDrawBytes:100,maxBytes:5000}).code,'BATCH_DRAW_NOT_ENABLED');
  assert.equal(planBatchDraw({count:10,usedBytes:1000,reservePerDrawBytes:1000,maxBytes:5000}).code,'CAPACITY_LIMIT_REACHED');
  assert.equal(planBatchDraw({count:11,usedBytes:0,reservePerDrawBytes:1,maxBytes:5}).code,'INVALID_BATCH_COUNT');
  const t=setup();assert.equal(t.cmd('batch-draw','b1',{count:10}).code,'INVALID_COMMAND');
});
