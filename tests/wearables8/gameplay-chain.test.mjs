// Real production doGacha/atomic/txn/persist + coordinator in synthetic Node/VM.
// DOM/locks/visibility/events are modeled; this is not browser evidence.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {assembly,until,copy,source,RELEASE} from './production-harness.mjs';
const opts={timeout:15000};
async function ready(t,options={}){const h=await assembly({...options,mode:'bootstrap'});t.after(()=>h.close());await until(()=>h.view()?.phase==='prompt'||h.app||h.errors.length,'production entry');assert.equal(h.bootError,null);if(h.view()?.phase==='prompt'){assert.notEqual(options.scope??'formal','formal','formal must auto-upgrade');await h.click('collectibleUpgradeConfirm');}await until(()=>h.app||h.errors.length,'production app');assert(h.app,JSON.stringify({view:h.view(),errors:h.errors,bootError:h.bootError?.message,panel:h.node("collectionStartup")?.children.map(x=>x.textContent)}));return h;}
for(const scope of ['formal','preview']){
 test(scope+': actual doGacha chain commits one 200000 draw; synchronous repeated clicks do not debit twice',opts,async t=>{
  const h=await ready(t,{scope}),before=copy(h.app.state),writes=h.writes().length;let randomCalls=0;h.context.__gachaRandom=()=>{randomCalls++;return 0};h.app.doGacha();h.app.doGacha();h.app.doGacha();
  assert.equal(h.app.state.coins,before.coins-200000);assert.equal(h.app.state.coinFrac,before.coinFrac);assert.equal(h.app.state.gacha.draws,before.gacha.draws+1);assert.equal(h.app.state.gacha.owned.length,37);assert.equal(h.app.state.gacha.last.id,'c_charcoal_vest');assert.equal(randomCalls,1);assert.equal(h.app.state.rev,before.rev+1);assert.equal(h.writes().length,writes+2);assert.equal(JSON.parse(h.data.get(h.t.keys.main)).gacha.last.id,'c_charcoal_vest');assert.equal(h.runtime.entryEnabled,false);
  for(const field of ['td','tdCampaign','td50','tdUpgradeReceipts','collection','collectionHost'])assert.deepEqual(copy(h.app.state[field]??null),before[field]??null,field);
 });
 for(const failure of ['backup','unknown'])test(scope+': '+failure+' failure uses real persist; blocked retries cannot reroll/refund and explicit reconciliation restores exact saved outcome',opts,async t=>{
  const fault={operation:null,key:null,afterWrite:false,armed:false};const h=await ready(t,{scope,storageFault:fault});const before=copy(h.app.state),oldMain=h.data.get(h.t.keys.main);let draws=0;h.context.__gachaRandom=()=>{draws++;return 0};
  Object.assign(fault,failure==='backup'?{operation:'setItem',key:h.t.keys.backup}:{operation:'getItem',key:h.t.keys.main,afterWrite:true});
  h.app.doGacha();assert.equal(h.view().canPlay,false);assert.equal(h.view().phase,'protected');assert.equal(h.app.saveBlocked,true);assert.equal(h.app.state.coins,before.coins);assert.equal(draws,1);const stored=h.data.get(h.t.keys.main),writes=h.writes().length;
  if(failure==='backup')assert.equal(stored,oldMain);else{assert.equal(JSON.parse(stored).coins,before.coins-200000);assert.equal(JSON.parse(stored).gacha.last.id,'c_charcoal_vest');}
  h.app.doGacha();h.app.doGacha();assert.equal(draws,1);assert.equal(h.writes().length,writes);assert.equal(h.data.get(h.t.keys.main),stored);assert(!h.context.__modelToasts.some(x=>/金币已退回|没扣金币/.test(x)),'uncertain UI must not promise refund');
  Object.assign(fault,{operation:null,armed:false});assert(h.node('collectibleReconcile'));await h.click('collectibleReconcile');assert.equal(h.view().canPlay,true);assert.equal(h.app.saveBlocked,false);assert.equal(h.writes().length,writes,'reconcile reads only');assert.equal(draws,1);assert.equal(h.data.get(h.t.keys.main),stored);assert.equal(h.app.state.coins,before.coins-(failure==='unknown'?200000:0));assert.equal(h.app.state.gacha.draws,before.gacha.draws+(failure==='unknown'?1:0));
 });
 test(scope+': exact card compatibility keys and other scope bytes remain untouched across production P2 migration and one actual draw',opts,async t=>{
  const sentinels=new Map([...['formal','preview'].flatMap(c=>[...['','-tmp','-bak','-quarantine'].map(s=>'tangzhe-'+c+'-card-save'+s),'tangzhe-'+c+'-card-decks-v1']), 'qa-formal-collection-v1:never-touch','qa-collection-trial-v1:never-touch'].map(k=>[k,'unchanged:'+k]));
  const h=await ready(t,{scope,configure:f=>{for(const [k,v]of sentinels)f.data.set(k,v)}});h.app.doGacha();for(const [k,v]of sentinels)assert.equal(h.data.get(k),v,k);assert(!h.calls.some(x=>sentinels.has(x.key)),'not even compatibility sentinel reads');
 });
}
test('candidate battle route and all former battle runtime imports stay retired; rootpet shares production formal writer',()=>{
 for(const p of ['app.js','preview/app.js','pet/game/app.js']){const s=source(p);for(const marker of ['cardsOpen','openCards','cardsFrame','cardsMsg','CARDS_SHOP'])assert(!s.includes(marker),p+marker);assert(s.includes('COLLECTION.coordinator'));assert(s.includes('COLLECTION.storage'));}
 for(const p of ['index.html','preview/index.html','pet/game/index.html'])assert(!source(p).includes('cardsFrame'));for(const p of ['cards/index.html','cards/ui/index.html','preview/cards/index.html','preview/cards/ui/index.html']){const s=source(p);assert(s.includes('返回经营游戏'));assert(!/<script|iframe|refresh/i.test(s));}
 for(const p of ['collection/bootstrap.mjs','preview/collection/bootstrap.mjs'])assert(source(p).includes('cardEntryEnabled:false'));
});
// formal has no confirm button since 杨总 16:05 auto-upgrade; duplicate-confirm guard stays covered on preview.
for(const scope of ['preview'])test(scope+': stale duplicate migration confirm cannot write twice; migrated actual draw survives a new production session',opts,async t=>{
 const h=await assembly({scope,mode:'bootstrap'});t.after(()=>h.close());await until(()=>h.view()?.phase==='prompt','prompt');const confirm=h.node('collectibleUpgradeConfirm').onclick,original=h.data.get(h.t.keys.main);await confirm();await until(()=>h.app,'app');const raw=h.data.get(h.t.keys.main),snapshot=h.data.get(`tangzhe-${scope}-collectibles-v2-original`),writes=h.writes().length;await confirm();assert.equal(h.writes().length,writes);assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(h.data.get(`tangzhe-${scope}-collectibles-v2-original`),snapshot);assert.notEqual(raw,original);assert.equal(h.view().canPlay,true);
 h.app.doGacha();const final=copy(h.app.state),saved=new Map(h.data);await h.close();const reopened=await assembly({scope,mode:'bootstrap',configure:f=>{f.data.clear();for(const [k,v]of saved)f.data.set(k,v)}});t.after(()=>reopened.close());await until(()=>reopened.app||reopened.errors.length,'reopen');assert(reopened.app,JSON.stringify(reopened.errors));assert.equal(reopened.app.state._collectionProtocol,2);assert.equal(reopened.initialE.ITEMS.length,58);assert.deepEqual(copy(reopened.app.state.gacha),final.gacha);assert.equal(reopened.app.state.coins,final.coins);assert.equal(reopened.data.get(`tangzhe-${scope}-collectibles-v2-original`),snapshot);
});
