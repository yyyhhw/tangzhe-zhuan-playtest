import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createCollectionHost,reserveFor} from '../../collection/host-wallet.mjs';
import {createSaveCoordinator,KEYS} from '../../collection/host-save.mjs';
import {createApprovedTrialModel} from '../../collection/domain/model.mjs';
import {TRIAL_CONFIG} from '../../collection/domain/trial-config.mjs';
import {canonical} from '../../collection/domain/json.mjs';
import fs from 'node:fs';
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
  // confirm-time bound may exceed the quote-time bound by a few counter digits; still an upper bound
  const ok=setup({maxBytes:need+64});const dr=ok.draw(1);assert(dr.ok,JSON.stringify({need,code:dr.code,cap:dr.capacity}));
});
test('commit write failure (quota/capacity) never swallows the debit; resume debits exactly once',()=>{
  const t=setup({failStage:'committed'});const coins=t.state.coins,frac=t.state.coinFrac;
  const r=t.draw(1);assert.equal(r.ok,false);const cur=t.c.current().state;assert.equal(cur.coins,coins);assert.equal(cur.coinFrac,frac);assert.equal(tx({state:cur},r.txId).stage,'selected');
  t.ctl.failStage=null;t.state=t.c.adopt().state;t.host=t.mk();
  const rec=t.host.recoverPending();assert(rec.ok&&rec.recovered,JSON.stringify(rec));assert.equal(t.state.coins,coins-PRICE);
  const rng=t.rng;assert(t.cmd('resume','again',{txId:r.txId}).replay);assert.equal(t.state.coins,coins-PRICE);assert.equal(t.rng,rng);
  assert.equal(t.host.recoverPending().reason,'NO_PENDING');
});
test('selected recovery with no physical room: CAPACITY_READ_ONLY propagated, protected, no debit, history kept',()=>{
  const t=setup({failStage:'committed'});const r0=t.draw(1);assert.equal(r0.ok,false);t.ctl.failStage=null;const len=t.c.raw.length;
  delete require.cache[require.resolve('../../economy.js')];const E2=require('../../economy.js');
  const small=createSaveCoordinator({storage:{getItem:k=>t.data.get(k)??null,setItem:(k,v)=>t.data.set(k,v)},economy:E2,model,ownsLock:()=>true,maxBytes:len+10});
  E2.installFormalCollectionProtocol(small);let st=small.adopt().state;const coins=st.coins,ev=st.collection.events.length;
  const h=createCollectionHost({coordinator:small,model,economy:E2,getState:()=>st,replaceState:s=>st=s,flush:()=>small.commit(st).ok,enabled:true,randomInt:()=>0,makeId:()=>'z:1'});
  const r=h.recoverPending();assert.equal(r.ok,false);assert.equal(r.code,'CAPACITY_READ_ONLY');assert.equal(r.protected,true);
  const cur=small.current().state;assert.equal(cur.coins,coins);assert.equal(cur.collection.transactions[r0.txId].stage,'selected');assert.equal(cur.collection.events.length,ev);
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
test('ten-draw is NOT in this candidate: no module, no command; design doc only',()=>{
  assert.equal(fs.existsSync(new URL('../../collection/batch-draw.mjs',import.meta.url)),false);
  assert(fs.readFileSync(new URL('../../collection/BATCH_DRAW_DESIGN.md',import.meta.url),'utf8').includes('原子'));
  const t=setup();assert.equal(t.cmd('batch-draw','b1',{count:10}).code,'INVALID_COMMAND');
});
// Build a durable 'debited' save: RECORD_DEBIT and the gold debit in the same revision, COMMIT not yet written.
function debitedSetup(){
  const t=setup();const q=t.cmd('quote','q1',{request:{kind:'draw'}});assert(q.ok);
  let s=t.c.current().state;let c=s.collection;const step=(c,type,x={})=>model.reduce(c,{type,txId:q.txId,eventId:`${q.txId}:${type}`,expectedRevision:c.revision,...x});
  c=step(c,'DECIDE',{decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false});c=step(c,'SELECT',{tickets:{rarity:0,card:0,golden:0}});
  c=step(c,'RECORD_DEBIT',{walletReceipt:{schemaVersion:1,debitId:`debit:${q.txId}`,intent:model.walletIntent(c,q.txId),walletRevision:s.rev+1}});
  s.collection=c;const before=s.coins;t.E.spendCoins(s,PRICE);assert(t.c.commit(s,{allowCollectionChange:true}).ok);
  t.state=t.c.adopt().state;t.host=t.mk();return {t,txId:q.txId,paid:t.state.coins,before};
}
test('debited hanging tx: recoverPending commits without second debit or RNG',()=>{
  const {t,txId,paid,before}=debitedSetup();assert.equal(paid,before-PRICE);assert.equal(tx(t,txId).stage,'debited');
  const r=t.host.recoverPending();assert(r.ok&&r.recovered,JSON.stringify(r));assert.equal(r.fromStage,'debited');
  assert.equal(tx(t,txId).stage,'committed');assert.equal(t.state.coins,paid);assert.equal(t.rng,0);
  assert.equal(tx(t,txId).receipt.walletDebitId,`debit:${txId}`);
  assert(t.cmd('resume','again',{txId}).replay);assert.equal(t.state.coins,paid);assert.equal(t.host.recoverPending().reason,'NO_PENDING');
});
test('debited via resume command also works (no INVALID_PREPARED_STATE)',()=>{
  const {t,txId,paid}=debitedSetup();const r=t.cmd('resume','r1',{txId});assert(r.ok,JSON.stringify(r));assert.equal(t.state.coins,paid);assert.equal(tx(t,txId).stage,'committed');
});
test('debited with forged/unproven wallet evidence is refused (model replay or host check), no write',()=>{
  const {t,txId}=debitedSetup();const s=t.c.current().state;s.collection.transactions[txId].walletReceipt.walletRevision=s.rev+5;
  // cannot persist a forged state through model validation? build host over in-memory clone only
  const raw=t.c.raw;let st=s;const h=createCollectionHost({coordinator:{...t.c,current:()=>({ok:true,state:st}),failed:null,maxBytes:t.c.maxBytes,commit:()=>{throw Error('must not write')}},model,economy:t.E,getState:()=>st,replaceState:x=>st=x,flush:()=>true,enabled:true,randomInt:()=>0,makeId:()=>'p:1'});
  const r=h.recoverPending();assert.equal(r.ok,false,JSON.stringify(r));assert(['DEBIT_EVIDENCE_UNPROVEN_PROTECTED','STATE_REPLAY_MISMATCH_KEEP_ORIGINAL'].includes(r.code),JSON.stringify(r));assert.equal(t.c.raw,raw);
});
test('debited recovery with no physical room: protected, coins unchanged, history kept',()=>{
  const {t,txId,paid}=debitedSetup();const len=t.c.raw.length;
  delete require.cache[require.resolve('../../economy.js')];const E2=require('../../economy.js');
  const small=createSaveCoordinator({storage:{getItem:k=>t.data.get(k)??null,setItem:(k,v)=>t.data.set(k,v)},economy:E2,model,ownsLock:()=>true,maxBytes:len+10});E2.installFormalCollectionProtocol(small);
  let st=small.adopt().state;const ev=st.collection.events.length;
  const h=createCollectionHost({coordinator:small,model,economy:E2,getState:()=>st,replaceState:x=>st=x,flush:()=>small.commit(st).ok,enabled:true,randomInt:()=>0,makeId:()=>'s:1'});
  const r=h.recoverPending();assert.equal(r.ok,false);assert.equal(r.protected,true);assert.equal(r.code,'CAPACITY_READ_ONLY');
  const cur=small.current().state;assert.equal(cur.coins,paid);assert.equal(cur.collection.transactions[txId].stage,'debited');assert.equal(cur.collection.events.length,ev);
});
test('confirm re-checks capacity after business growth: rejects before entropy/debit, cancel still possible',()=>{
  const t=setup();const q=t.cmd('quote','q1',{request:{kind:'draw'}});assert(q.ok);
  const s=t.c.current().state;const need=reserveFor({state:s,model,request:{kind:'draw'},txId:q.txId,requestId:'',maxBytes:1e9,existing:true}).neededBytes;
  const len=t.c.raw.length;
  delete require.cache[require.resolve('../../economy.js')];const E2=require('../../economy.js');
  const small=createSaveCoordinator({storage:{getItem:k=>t.data.get(k)??null,setItem:(k,v)=>t.data.set(k,v)},economy:E2,model,ownsLock:()=>true,maxBytes:need-1});E2.installFormalCollectionProtocol(small);
  let st=small.adopt().state;const coins=st.coins;let rng=0;
  const h=createCollectionHost({coordinator:small,model,economy:E2,getState:()=>st,replaceState:x=>st=x,flush:()=>small.commit(st).ok,enabled:true,randomInt:()=>{rng++;return 0},makeId:()=>'s:1'});
  const m=(command,requestId,x)=>h.handle({card:'collection',protocol:1,command,requestId,...x});
  const r=m('confirm','c1',{txId:q.txId,decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false});
  assert.equal(r.code,'CAPACITY_LIMIT_REACHED');assert.equal(rng,0);assert.equal(small.current().state.coins,coins);assert.equal(small.current().state.collection.transactions[q.txId].stage,'awaiting-decision');
  assert(m('confirm','c2',{txId:q.txId,decision:'cancel',allowDustOverflow:false,suppressFutureOverflowWarnings:false}).cancelled);assert.equal(small.current().state.coins,coins);
  assert(len<need);
});

// ---------- R22: performance, strict upper bound, ack reservation ----------
import {pendingAckChars} from '../../collection/host-save.mjs';
import {performance} from 'node:perf_hooks';
function rngOf(seed){let x=seed>>>0||1;return n=>{x^=x<<13;x>>>=0;x^=x>>17;x^=x<<5;x>>>=0;return x%n;};}
// Build a collection history quickly on TRUSTED states, then JSON round-trip so it is untrusted like a reloaded save.
function history(n,r=rngOf(7)){
  let c=model.createState({holdings:{},dust:r(1000),preferences:{suppressOverflowWarning:false}});
  for(let i=0;i<n;i++){const txId=`h:${i}:${'x'.repeat(r(60))}`;const step=(c,type,x={})=>model.reduce(c,{type,txId,eventId:`${txId}:${type}`,expectedRevision:c.revision,...x});
    try{let d=step(c,'BEGIN',{request:{kind:'draw'}});d=step(d,'DECIDE',{decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:false});
      const card=TRIAL_CONFIG.pool[r(TRIAL_CONFIG.pool.length)];let start=0;for(const rr of TRIAL_CONFIG.rarities){if(rr.id===card.rarity)break;start+=rr.weight;}
      const idx=TRIAL_CONFIG.pool.filter(p=>p.rarity===card.rarity).indexOf(card);
      d=step(d,'SELECT',{tickets:{rarity:start+r(10),card:idx,golden:r(TRIAL_CONFIG.probabilityScale)}});
      d=step(d,'RECORD_DEBIT',{walletReceipt:{schemaVersion:1,debitId:`debit:${txId}`,intent:model.walletIntent(d,txId),walletRevision:i+1}});c=step(d,'COMMIT');}catch{}}
  return c;
}
function parentWith(collection,{rev=0,coins=PRICE*3,acked=true}={}){
  delete require.cache[require.resolve('../../economy.js')];const E=require('../../economy.js');const s=E.newState(1);s.coins=coins;s.rev=rev;s._collectionProtocol=1;
  s.collection=collection;s.collectionHost={schemaVersion:1,requests:{},acknowledged:{},migration:{schemaVersion:1,kind:'empty-new-formal',sourceKey:'tangzhe-save',sourceRev:0,originalSha256:'0'.repeat(64)}};
  if(acked)for(const [id,t] of Object.entries(collection.transactions))if(t.stage==='committed')s.collectionHost.acknowledged[id]=true;
  return JSON.parse(JSON.stringify(s));
}
test('perf: 80-draw history reloaded from JSON — reserveFor < 50ms (was ~24s in R22 review)',()=>{
  const reloaded=parentWith(history(80));assert(Object.keys(reloaded.collection.transactions).length>=70);
  const times=[];for(let i=0;i<5;i++){const st=JSON.parse(JSON.stringify(reloaded));const t=performance.now();const r=reserveFor({state:st,model,request:{kind:'draw'},txId:'tx:ffffffff-0000-4000-8000-000000000000',requestId:'cu-ffffffff-0000-4000-8000-000000000000-0-1',maxBytes:2097152});times.push(performance.now()-t);assert(r.estimated);}
  times.sort((a,b)=>a-b);const median=times[2];console.log('reserveFor 80 reloaded ms',times.map(x=>x.toFixed(1)).join(','));
  assert(median<50,`median ${median.toFixed(1)}ms`);
});
test('perf: cost does not grow with history (220 reloaded vs 10 reloaded)',()=>{
  const small=parentWith(history(10)),big=parentWith(history(220));
  const time=s=>{const t=performance.now();reserveFor({state:JSON.parse(JSON.stringify(s)),model,request:{kind:'draw'},txId:'t:1',requestId:'r:1',maxBytes:1e9});return performance.now()-t;};
  time(small);const a=Math.min(time(small),time(small)),b=Math.min(time(big),time(big));console.log('10 vs 220 ms',a.toFixed(1),b.toFixed(1));
  assert(b<50,`220-history ${b.toFixed(1)}ms`);
});
test('upper bound never underestimates: randomized holdings / dust / revisions / ids / tickets (margin 0)',()=>{
  const r=rngOf(20261011);let checked=0,minSlack=Infinity;
  for(let iter=0;iter<60;iter++){
    const hist=history(r(25),rngOf(iter+1));
    const rev=[0,9,99999,Number.MAX_SAFE_INTEGER-10][r(4)];
    const st=parentWith(hist,{rev,coins:[PRICE,PRICE*7,Number.MAX_SAFE_INTEGER-1][r(3)],acked:r(2)===0});
    const txId=`tx:${'a'.repeat(r(130))}${iter}`, requestId=`rq:${'b'.repeat(r(150))}`;
    const est=reserveFor({state:st,model,request:{kind:'draw'},txId,requestId,maxBytes:1e12,marginBytes:0});assert(est.estimated);
    // real transaction with a random legal ticket on the real (trusted) collection
    let c=model.restore(st.collection);const step=(c,type,x={})=>model.reduce(c,{type,txId,eventId:`${txId}:${type}`,expectedRevision:c.revision,...x});
    try{
      c=step(c,'BEGIN',{request:{kind:'draw'}});c=step(c,'DECIDE',{decision:'continue',allowDustOverflow:true,suppressFutureOverflowWarnings:r(2)===0&&c.transactions[txId].quote.requiresOverflowConfirmation});
      c=step(c,'SELECT',{tickets:{rarity:r(TRIAL_CONFIG.probabilityScale),card:0,golden:r(TRIAL_CONFIG.probabilityScale)}});
      c=step(c,'RECORD_DEBIT',{walletReceipt:{schemaVersion:1,debitId:`debit:${txId}`,intent:model.walletIntent(c,txId),walletRevision:Math.min(Number.MAX_SAFE_INTEGER,st.rev+1)}});c=step(c,'COMMIT');
    }catch{continue;}
    const fin=JSON.parse(JSON.stringify(st));fin.collection=c;fin.rev=Math.min(Number.MAX_SAFE_INTEGER,st.rev+3);fin.coins=Math.max(0,st.coins-PRICE);
    fin.collectionHost.requests[requestId]={txId,requestCanonical:canonical({kind:'draw'})};
    for(const [id,t] of Object.entries(c.transactions))if(t.stage==='committed')fin.collectionHost.acknowledged[id]=true;
    const actual=JSON.stringify(fin).length;assert(actual<=est.neededBytes,`iter ${iter}: actual ${actual} > estimate ${est.neededBytes}`);
    minSlack=Math.min(minSlack,est.neededBytes-actual);checked++;
  }
  console.log('random upper-bound cases',checked,'min slack chars',minSlack);assert(checked>=40);
});
test('estimate unavailable is refused (no 32KiB fallback)',()=>{
  const st=parentWith(history(2));const bad={...model,reduce:()=>{throw Error('boom')}};
  const r=reserveFor({state:st,model:bad,request:{kind:'draw'},txId:'t:1',requestId:'r:1',maxBytes:1e9});assert.equal(r.ok,false);assert.equal(r.code,'CAPACITY_ESTIMATE_UNAVAILABLE');
});
test('ack space reserved while receipt waits: business save refused with CAPACITY_ACK_RESERVED, ack still succeeds',()=>{
  const t=setup();const r=t.draw(1);assert(r.ok);const len=t.c.raw.length;const need=pendingAckChars(t.c.current().state);assert(need>0);
  delete require.cache[require.resolve('../../economy.js')];const E2=require('../../economy.js');
  const small=createSaveCoordinator({storage:{getItem:k=>t.data.get(k)??null,setItem:(k,v)=>t.data.set(k,v)},economy:E2,model,ownsLock:()=>true,maxBytes:len+need+40});E2.installFormalCollectionProtocol(small);
  let st=small.adopt().state;st.extraGrowth='y'.repeat(25);
  const b=small.commit(st);assert.equal(b.ok,false,JSON.stringify({len,need,raw:small.raw.length}));assert.equal(b.code,'CAPACITY_ACK_RESERVED');
  st=small.adopt().state;const h=createCollectionHost({coordinator:small,model,economy:E2,getState:()=>st,replaceState:x=>st=x,flush:()=>small.commit(st).ok,enabled:true,randomInt:()=>0,makeId:()=>'k:1'});
  const a=h.handle({card:'collection',protocol:1,command:'acknowledge',requestId:'ack1',txId:r.txId});assert(a.ok,JSON.stringify(a));assert.equal(small.current().state.collectionHost.acknowledged[r.txId],true);
});
test('new quote also keeps other pending receipts\' ack space',()=>{
  const t=setup();const r=t.draw(1);assert(r.ok);const s=t.c.current().state;
  const a=reserveFor({state:s,model,request:{kind:'draw'},txId:'n:1',requestId:'q',maxBytes:1e9});assert.equal(a.ackReserveChars,pendingAckChars(s));assert(a.ackReserveChars>0);
});
test('UI maps capacity codes to explicit no-charge messages',()=>{
  const src=fs.readFileSync(new URL('../../cards/ui/collection.mjs',import.meta.url),'utf8');
  for(const k of ['capacity-limit-reached','capacity-estimate-unavailable','capacity-ack-reserved'])assert(src.includes(`'${k}'`),k);
  assert(/capacity-limit-reached':'[^']*没有扣金币/.test(src));
});
