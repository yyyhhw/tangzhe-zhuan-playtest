// 文案-06（收尾版）：盲盒规则、离线说明第一句讲结果、去掉重复细节；数值仍从 CFG / capH 取，不写死。只改两份正式 app.js。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {copy06Delta,withoutCopy06Delta} from './exact-copy-delta.mjs';
import {withoutHome43Delta} from '../home43/exact-delta.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const FORMAL=['app.js','pet/game/app.js'];
test('copy06: new short wording present once, old long wording gone, numbers still from config',()=>{
  for(const f of FORMAL){const s=read(f);
    assert.equal(s.split('离线按平时每秒收益的一半算（不含团单），最多 ${capH} 小时').length,2,f);
    assert.equal(s.split('每抽有 <b>${P(CFG.SUPER_P)}</b> 出超级装饰，连续 ${CFG.SUPER_PITY - 1} 抽没出，第 ${CFG.SUPER_PITY} 抽必出。').length,2,f);
    for(const old of ['离线 = 在线每秒收益的 50%','按你离开时的店铺、员工和 CEO 安排结算','再从该类<b>还没收集的</b>里等概率抽','某一类抽完了'])assert(!s.includes(old),f+' '+old);
    assert(s.includes('<b>不加产速</b>'),f);assert(s.includes('id="offNote"'),f);}
});
test('copy06: preview copies untouched',()=>{
  for(const f of ['preview/app.js','preview/pet/game/app.js'])assert(read(f).includes('离线 = 在线每秒收益的 50%'),f);
});
test('copy06: delta is exact and reverses to the prior bytes; missing/duplicate rejected',()=>{
  for(const [f,row] of Object.entries(copy06Delta)){const s=read(f);
    assert.equal(hash(withoutHome43Delta(f,s)),row.sha256,f);assert.equal(hash(withoutCopy06Delta(f,s)),row.priorSha256,f); // 家宅-43 叠在 06 之后：先撤 43 再比 06
    for(const [after] of row.replacements){
      assert.throws(()=>withoutCopy06Delta(f,s.replace(after,'')),/NOT_EXACT/);
      assert.throws(()=>withoutCopy06Delta(f,s+after),/NOT_EXACT/);}}
});
