// 家宅-43：增量精确、可逆到 main 189fbe8 的字节；缺失 / 重复都拒绝。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {withoutCopy04Delta,withoutCopy04CacheDelta} from '../copy04/exact-copy-delta.mjs';
import {home43Delta,withoutHome43Delta,withoutHome43CacheDelta,home43Cache} from './exact-delta.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('home43: delta is exact and reverses to the 189fbe8 bytes; missing/duplicate rejected',()=>{
  for(const [f,row] of Object.entries(home43Delta)){const s=withoutHome43CacheDelta(f,withoutCopy04Delta(f,read(f))); // 04 在最上，先撤 04 再撤缓存号
    assert.equal(hash(s),row.sha256,f);assert.equal(hash(withoutHome43Delta(f,s)),row.priorSha256,f);
    assert.equal(withoutHome43Delta(f,withoutHome43Delta(f,s)),withoutHome43Delta(f,s),f+' idempotent');
    const [after]=row.replacements[0];
    assert.throws(()=>withoutHome43Delta(f,s.replace(after,'')),/NOT_EXACT/);
    assert.throws(()=>withoutHome43Delta(f,s+after),/NOT_EXACT/);}
});
test('home43 cache: every bumped file carries exactly the recorded count of the new token, none of the old; reversal exact',()=>{
  for(const [f,n] of Object.entries(home43Cache.counts)){const s=withoutCopy04CacheDelta(f,read(f)),extra=(home43Cache.replacements?.[f]??[]).filter(([a])=>a.includes(home43Cache.new)).length; // r2：preview/index.html 的 economy.js 原号是 home35-…，单列一行精确撤
    assert.equal(s.split(home43Cache.new).length-1,n+extra,f);assert(!s.includes(home43Cache.old),f);
    const r=withoutHome43CacheDelta(f,s);assert(!r.includes(home43Cache.new),f);assert.equal(r.split(home43Cache.old).length-1,n,f);
    assert.throws(()=>withoutHome43CacheDelta(f,s+home43Cache.new),/NOT_EXACT/);}
});
