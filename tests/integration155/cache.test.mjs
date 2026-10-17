import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createHash}from'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),manifest=JSON.parse(read('tests/integration155/cache-manifest.json')),hash=s=>createHash('sha256').update(s).digest('hex');
function accepted(p,s){assert.equal(hash(s),manifest.accepted[p],p+' unexpected bytes');}
test('explicit integrated source fingerprints reject changed or reverted bytes',()=>{for(const[p,h]of Object.entries(manifest.accepted)){const s=read(p);accepted(p,s);assert.throws(()=>accepted(p,s+'\n/* unrelated */'));}});
test('every changed module reference uses the batch token; unrelated imports retain their source tokens',()=>{
 const changed=new Set(manifest.changedModules);
 for(const file of Object.keys(manifest.accepted).filter(p=>/\.(m?js|html)$/.test(p))){const s=read(file);for(const m of s.matchAll(/(['"])([^'"\s]+\.(?:mjs|js))(\?[^'"\s]*)\1/g)){const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),m[2]));if(changed.has(target))assert.equal(new URLSearchParams(m[3].slice(1)).get('v'),manifest.token,file+' -> '+target);}}
 assert(read('collectibles/entry.mjs').includes("+'?v='+ '"+manifest.token+"',sourceBase)"));
 assert(read('qa-protocol2/entry.mjs').includes('app.js?qaProtocol2=1&v='+manifest.token));
 assert.equal(read('collectibles/release.mjs').includes("COLLECTIBLES_RELEASE = 'xingtu135-20261015-r1'"),true);
});
test('four HTML reload markers agree with their version.json',()=>{for(const p of ['','pet/game/','preview/','preview/pet/game/']){const v=(p.startsWith('preview/')?'preview':'formal')+'-'+manifest.token;assert.equal(JSON.parse(read(p+'version.json')).v,v);assert(read(p+'index.html').includes("var B='"+v+"'"));}});
test('all runtime dependency byte pins are exact',()=>{for(const p of JSON.parse(read('qa-protocol2/dependency-pins.json'))){const b=fs.readFileSync(new URL(p.path,root));assert.equal(b.length,p.bytes,p.path);assert.equal(hash(b),p.sha256,p.path);}});
