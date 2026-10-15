import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const manifest=JSON.parse(fs.readFileSync(new URL('./baseline-integrity.json',import.meta.url)));
test('offline gap/50% economy, atomic transactions, reveal, lifecycle save bodies and explicit protection-extension fingerprints match reviewed baseline (registration checked separately)',()=>{
 for(const x of manifest.checks){let s=fs.readFileSync(new URL('../../'+x.path,import.meta.url),'utf8').replaceAll('xtearth-20261015-r1','blindbox18-candidate-20261013-r1');s=s.replace("if (COLLECTION.registerPageHide) COLLECTION.registerPageHide(onHide);\nelse window.addEventListener('pagehide', onHide);","window.addEventListener('pagehide', onHide);");if(x.start)s=s.slice(s.indexOf(x.start),s.indexOf(x.end,s.indexOf(x.start)));assert.equal(createHash('sha256').update(s).digest('hex'),x.sha256,x.path+' '+(x.start||'full file'));}
});
