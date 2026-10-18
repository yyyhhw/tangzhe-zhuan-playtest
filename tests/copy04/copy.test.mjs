// 文案-04：新字各在、旧字不在；preview 不动；增量精确可逆到 main b4fce6c。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {copy04Delta,withoutCopy04Delta,withoutCopy04CacheDelta,copy04Cache} from './exact-copy-delta.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('copy04: formal copies use 金币 / 每秒 +N / 设置',()=>{
  for(const f of ['app.js','pet/game/app.js']){const s=read(f);
    assert(!s.includes('游戏金币'),f);
    for(const w of ["'升级后每秒 +'","雇了才自动赚：每秒 +","'升一级每秒 +'","'每秒 +' + fmt(E.shopRate(state, i))","每秒 ${d >= 0 ? '+' : '−'}",'<div class="name">设置</div><div class="desc">版本 v'])assert.equal(s.split(w).length,2,f+' '+w);}
});
test('copy04: delta is exact and reverses to the b4fce6c bytes; missing/duplicate rejected',()=>{
  for(const [f,row] of Object.entries(copy04Delta)){const s=withoutCopy04CacheDelta(f,read(f)); // 缓存号在最上，先撤
    assert.equal(hash(s),row.sha256,f);assert.equal(hash(withoutCopy04Delta(f,s)),row.priorSha256,f);
    const [after]=row.replacements[0];
    assert.throws(()=>withoutCopy04Delta(f,s.replace(after,'')),/NOT_EXACT/);
    assert.throws(()=>withoutCopy04Delta(f,s+after),/NOT_EXACT/);}
});
test('copy04 cache: every bumped file carries exactly the recorded count of the new token, none of the old; reversal exact',()=>{
  for(const [f,n] of Object.entries(copy04Cache.counts)){const s=read(f);
    assert.equal(s.split(copy04Cache.new).length-1,n,f);assert(!s.includes(copy04Cache.old),f);
    const r=withoutCopy04CacheDelta(f,s);assert(!r.includes(copy04Cache.new),f);assert.equal(r.split(copy04Cache.old).length-1,n,f);
    assert.throws(()=>withoutCopy04CacheDelta(f,s+copy04Cache.new),/NOT_EXACT/);}
});
