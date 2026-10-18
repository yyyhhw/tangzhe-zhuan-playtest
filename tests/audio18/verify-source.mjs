// Explicit opt-in network verification; not part of offline test discovery.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {tower,verify} from './mapping.mjs';
const response=await fetch(tower.url,{signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200);
const remote=Buffer.from(await response.arrayBuffer());
const local=fs.readFileSync(new URL('../../'+tower.path,import.meta.url));
verify(remote);verify(local);assert(remote.equals(local),'official and local bytes differ');
console.log(JSON.stringify({checkedAt:new Date().toISOString(),...tower,finalURL:response.url,identical:true},null,2));
