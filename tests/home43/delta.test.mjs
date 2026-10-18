// 家宅-43：增量精确、可逆到 main 189fbe8 的字节；缺失 / 重复都拒绝。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {home43Delta,withoutHome43Delta} from './exact-delta.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('home43: delta is exact and reverses to the 189fbe8 bytes; missing/duplicate rejected',()=>{
  for(const [f,row] of Object.entries(home43Delta)){const s=read(f);
    assert.equal(hash(s),row.sha256,f);assert.equal(hash(withoutHome43Delta(f,s)),row.priorSha256,f);
    assert.equal(withoutHome43Delta(f,withoutHome43Delta(f,s)),withoutHome43Delta(f,s),f+' idempotent');
    const [after]=row.replacements[0];
    assert.throws(()=>withoutHome43Delta(f,s.replace(after,'')),/NOT_EXACT/);
    assert.throws(()=>withoutHome43Delta(f,s+after),/NOT_EXACT/);}
});
