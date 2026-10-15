// Reconstruct only exact candidate deltas, then compare all other bytes to 0b7218d.
import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
import {withoutMilestoneDelta} from './protection-baseline.mjs';
const base='0b7218d',read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),baseline=p=>execFileSync('git',['show',base+':'+p],{encoding:'utf8'}),rows=[];
for(const p of ['qa-protocol2/vendor/cards/card-coordinator.mjs','qa-protocol2/vendor/runtime/validator.mjs','qa-protocol2/real-page-facade.mjs']){assert.equal(withoutMilestoneDelta(p,read(p)),baseline(p));rows.push({path:p,result:'only exact milestone delta; all original protection bytes retained'});}
for(const p of ['app.js','preview/app.js']){
 let s=read(p);const addition=`  // Actual battle acknowledgement, after the child has accepted this start receipt.
  if (d.zb === 'started') {
    if (!zbRun || zbRun.settled || d.runId !== zbRun.runId || d.ceo !== zbRun.ceoId || zbBlocked() || document.hidden || !COLLECTION.ownsLock()) return;
    zbRun.started = true;
    COLLECTION.coordinator.recordZombieStarted?.();
    return;
  }
`;
 assert.equal(s.split(addition).length,2);s=s.replace(addition,'');const prop='zombieStartReady:{ value:()=>zbOpen&&!!zbRun?.started&&!zbRun.settled&&!zbBlocked()&&!document.hidden&&COLLECTION.ownsLock() }, ';assert.equal(s.split(prop).length,2);s=s.replace(prop,'');assert.equal(s,baseline(p));rows.push({path:p,result:'only started hook; all main copy127/gameplay bytes retained'});
}
for(const p of ['zombie/zombie.js','preview/zombie/zombie.js']){let s=read(p);const after="last = performance.now(); bgmTry();\n    host({ zb:'started', runId:G.runId, ceo:G.ceo }); return;";assert.equal(s.split(after).length,2);s=s.replace(after,'last = performance.now(); bgmTry(); return;');assert.equal(s,baseline(p));rows.push({path:p,result:'only post-ack notification; combat rules unchanged'});}
for(const p of ['economy.js','preview/economy.js','pet/game/app.js','preview/pet/game/app.js','home-interaction.js','space/moon.mjs','space/host.mjs','space/domain.mjs','tests/autosave15/baseline-integrity.json','tests/lifecycle-save/protection-integrity.json','tests/moon/protected-blobs.json']){assert.equal(read(p),baseline(p));rows.push({path:p,result:'byte-exact latest main'});}
console.log(JSON.stringify({baseline:base,checks:rows},null,2));
