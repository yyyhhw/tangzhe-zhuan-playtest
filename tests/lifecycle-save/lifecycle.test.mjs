import test from 'node:test';
import assert from 'node:assert/strict';
import {assembly,until} from '../wearables8/production-harness.mjs';
for(const scope of ['formal','preview']) {
 async function ready(t){const h=await assembly({scope});t.after(()=>h.close());await until(()=>h.view()?.phase==='prompt','prompt');await h.click('collectibleUpgradeConfirm');await until(()=>h.app,'app');return h;}
 test(scope+': pagehide synchronously commits with valid lease then revokes',async t=>{
  const h=await ready(t);let seen=false;
  h.runtime.registerPageHide(()=>{seen=true;assert.equal(h.runtime.ownsLock(),true);assert.equal(h.app.saveBlocked,false);assert.equal(h.app.persist(),true);});
  const n=h.writes().length;h.pagehide();assert(seen);assert(h.writes().length>n);assert.equal(h.runtime.ownsLock(),false);assert.equal(h.app.saveBlocked,true);await until(()=>h.settled,'released');assert.equal(h.lock.released,1);
 });
 test(scope+': protected pagehide cannot write; throwing callback still releases lease',async t=>{
  const h=await ready(t);h.runtime.registerPageHide(()=>{throw Error('synthetic lifecycle exception');});
  assert.throws(()=>h.pagehide(),/synthetic lifecycle exception/);assert.equal(h.runtime.ownsLock(),false);await until(()=>h.settled,'released');assert.equal(h.lock.released,1);
 });
 test(scope+': foreign evidence invalidation is not bypassed by pagehide',async t=>{
  const h=await ready(t);let calls=0;h.runtime.registerPageHide(()=>{calls++;h.app.persist();});h.storageEvent({key:h.runtime.keys.main,newValue:'foreign'});const n=h.writes().length;h.pagehide();assert.equal(calls,0);assert.equal(h.writes().length,n);
 });
}

test('protected implementations and explicit reviewed decor16 extensions retain their fingerprints',async()=>{
 const fs=await import('node:fs');const {createHash}=await import('node:crypto');const manifest=JSON.parse(fs.readFileSync(new URL('./protection-integrity.json',import.meta.url)));
 for(const row of manifest.files){const bytes=fs.readFileSync(new URL('../../'+row.path,import.meta.url),'utf8').replaceAll('copy87-20261013-r1','autosave15-candidate-20261013-r2');assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256,row.path);}
});
