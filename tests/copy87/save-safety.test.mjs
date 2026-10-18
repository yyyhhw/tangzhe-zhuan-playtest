import test from 'node:test';import assert from 'node:assert/strict';
import {assembly,until} from '../wearables8/production-harness.mjs';
for(const kind of ['snapshot','backup'])test('copy87 preview '+kind+' write failure preserves exact P1 and prevents gameplay',async t=>{
  const fault={operation:null,key:null};const h=await assembly({scope:'preview',storageFault:fault});t.after(()=>h.close());await until(()=>h.node('collectibleUpgradeConfirm'),'preview prompt');
  const before=h.data.get(h.t.keys.main),source=h.data.get(h.t.keys.source);Object.assign(fault,{operation:'setItem',key:kind==='snapshot'?'tangzhe-preview-collectibles-v2-original':h.t.keys.backup});
  await h.click('collectibleUpgradeConfirm');assert.equal(h.view().phase,'protected');assert.equal(h.view().canPlay,false);assert.equal(h.app,undefined);
  assert.equal(h.data.get(h.t.keys.main),before);assert.equal(h.data.get(h.t.keys.source),source);assert.equal(h.view().code,kind==='snapshot'?'SNAPSHOT_WRITE_FAILED':'BACKUP_WRITE_FAILED');
});
test('copy87 preview confirmation keeps snapshot→P1 backup→P2 main ordering, no reward or debit',async t=>{
  const h=await assembly({scope:'preview'});t.after(()=>h.close());await until(()=>h.node('collectibleUpgradeConfirm'),'preview prompt');const before=JSON.parse(h.data.get(h.t.keys.main));
  await h.click('collectibleUpgradeConfirm');await until(()=>h.app,'app');const w=h.writes(),snap=w.findIndex(x=>x.key==='tangzhe-preview-collectibles-v2-original'),backup=w.findIndex((x,i)=>i>snap&&x.key===h.t.keys.backup),main=w.findIndex((x,i)=>i>backup&&x.key===h.t.keys.main);
  assert(snap>=0&&backup>snap&&main>backup);const saved=JSON.parse(w[main].value);assert.equal(JSON.parse(w[backup].value)._collectionProtocol,1);assert.equal(saved._collectionProtocol,2);assert.equal(saved.coins,before.coins);assert.equal(saved.coinFrac,before.coinFrac);assert.deepEqual(saved.gacha.owned,before.gacha.owned);
});
