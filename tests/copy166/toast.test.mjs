// 体验-166：「集齐 8 张故事卡：解锁专属外观「金牌摊主」！」走金色对勾（toast-good）；只改四份 TOAST_GOOD，不改调用点/优先级/存档。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {copy166Delta,withoutCopy166Delta} from './exact-copy-delta.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const APPS=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'];
const MSG='集齐 8 张故事卡：解锁专属外观「金牌摊主」！';
function moodOf(src){const pick=re=>src.match(re)[0];const code=[pick(/^const TOAST_GOOD = .*$/m),pick(/^const TOAST_BAD = .*$/m),pick(/^function toastMood\(item\) .*$/m),'toastMood'].join('\n');return vm.runInNewContext(code);}
test('copy166: four TOAST_GOOD lines byte-identical and include the set-complete word',()=>{
  const ref=read(APPS[0]).match(/^const TOAST_GOOD = .*$/m)[0];assert(ref.includes('|集齐 \\d+ 张故事卡：|'),ref);
  for(const f of APPS.slice(1))assert.equal(read(f).match(/^const TOAST_GOOD = .*$/m)[0],ref,f);
});
test('copy166: set-complete toast is good; negative/error toasts stay alert',()=>{
  for(const f of APPS){const mood=moodOf(read(f));
    assert.equal(mood({msg:MSG,priority:1}),'good',f);
    assert.equal(mood({msg:MSG,priority:2}),'alert',f+' error priority untouched');
    for(const bad of ['还没集齐 8 张故事卡：先去开盲盒','集齐 8 张故事卡：保存失败','金币不够'])assert.equal(mood({msg:bad,priority:1}),'alert',f+' '+bad);
    assert.equal(moodOf(withoutCopy166Delta(f,read(f)))({msg:MSG,priority:1}),'alert',f+' negative control: before 166 it was red');}
});
test('copy166: call site unchanged (same text, same duration) in both formal copies',()=>{
  for(const f of ['app.js','pet/game/app.js'])assert.equal(read(f).split("if (r.setDone) toast('集齐 ' + E.CARD_COUNT + ' 张故事卡：解锁专属外观「金牌摊主」！', 2600);").length,2,f);
});
test('copy166: delta is exact and reverses to the prior bytes; missing/duplicate rejected',()=>{
  for(const [f,row] of Object.entries(copy166Delta)){const s=read(f),[after]=row.replacements[0];
    assert.equal(hash(s),row.sha256,f);assert.equal(hash(withoutCopy166Delta(f,s)),row.priorSha256,f);
    assert.throws(()=>withoutCopy166Delta(f,s.replace(after,'')),/NOT_EXACT/);
    assert.throws(()=>withoutCopy166Delta(f,s+after),/NOT_EXACT/);}
});
