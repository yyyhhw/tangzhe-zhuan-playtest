import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
test('70 combination preserves 16 catalogs, renderer, ordered clone, protection, lifecycle entry, economics and preview byte-for-byte except resource token',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('./integration-integrity.json',import.meta.url)));
 for(const row of rows){const s=fs.readFileSync(new URL('../../'+row.path,import.meta.url),'utf8').replaceAll('autoupgrade-20261013-r1','decor6-preserve-order-20261013-r1');assert.equal(createHash('sha256').update(s).digest('hex'),row.sha256AfterReleaseNormalization,row.path);}
});
test('both changed bb70 stylesheets use current release URLs; stale prior CSS URL fails the check',()=>{
 const release=fs.readFileSync(new URL('../../collectibles/release.mjs',import.meta.url),'utf8').match(/COLLECTIBLES_RELEASE\s*=\s*['"]([^'"]+)/)[1];
 const check=html=>{const match=html.match(/href="style\.css\?v=([^"]+)"/);assert(match);assert.equal(match[1],release);};
 for(const prefix of ['','pet/game/']){const html=fs.readFileSync(new URL('../../'+prefix+'index.html',import.meta.url),'utf8');check(html);assert.throws(()=>check(html.replace('style.css?v='+release,'style.css?v=home35-td46-home22-copy52-20261012-r1')));assert.match(fs.readFileSync(new URL('../../'+prefix+'style.css',import.meta.url),'utf8'),/\.bb70-offline-banner/);}
});
