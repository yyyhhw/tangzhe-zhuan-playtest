import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {withoutMilestoneDelta} from './protection-baseline.mjs';
const path='qa-protocol2/vendor/cards/card-coordinator.mjs',s=readFileSync(new URL('../../'+path,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('protection baseline admits only exact candidate delta; changed guard still changes hash',()=>{
 const baseline=withoutMilestoneDelta(path,s),guard="if(!lease.owns())fail('LOCK_NOT_OWNED');";
 assert(s.includes(guard));assert.notEqual(hash(withoutMilestoneDelta(path,s.replace(guard,''))),hash(baseline));
 assert.throws(()=>withoutMilestoneDelta(path,s.replace('if(!initializing)next.milestones','next.milestones')),/NOT_EXACT/);
 assert.throws(()=>withoutMilestoneDelta(path,s.replace('recordTransition(previous.state,next,spaceClock(),MOON_RULES)','recordTransition(previous.state,next,0,MOON_RULES)')),/NOT_EXACT/);
});
