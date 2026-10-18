// 文案-167：盲盒页提示统一为「去收藏页看提示」；整天不写「0 小时」（回顾里的那句在 tests/milestones 里断言）。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {withoutCopy167Delta,copy167Delta} from '../copy87/exact-copy-delta.mjs';
import {withoutCopy166Delta} from '../copy166/exact-copy-delta.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('copy167: both formal app.js copies say 去收藏页看提示, old wording gone',()=>{
  for(const f of ['app.js','pet/game/app.js']){const s=read(f);
    assert.equal(s.split('去收藏页看提示').length-1,2,f);
    assert(!s.includes('去图鉴看提示'),f);assert(!s.includes('提示见收藏页图鉴'),f);}
});
test('copy167: delta is exact and reverses to the 349c0e6 bytes; unrelated edits are rejected',()=>{
  for(const [f,row] of Object.entries(copy167Delta)){const s=read(f);
    const t=withoutCopy166Delta(f,s); // 166 叠在 167 之后：先撤 166，再验 167 的正反向哈希
    assert.equal(hash(t),row.sha256,f);assert.equal(hash(withoutCopy167Delta(f,t)),row.priorSha256,f);
    assert.throws(()=>withoutCopy167Delta(f,s.replace(row.replacements[0][0],'')),/NOT_EXACT/);}
});
