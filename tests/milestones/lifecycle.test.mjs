import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {withoutStartLifecycleDelta} from './lifecycle-delta.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
for(const path of ['zombie/zombie.js','preview/zombie/zombie.js']){
 test(path+': live start predicate requires current unexpired active combat',()=>{
  const source=read(path),line=source.split('\n').find(s=>s.startsWith("Object.defineProperty(window, '__zbStartIsLive'"));
  const context=vm.createContext({window:{},performance:{now:()=>100},startDocumentActive:true,G:{runId:'run-123',ceo:'c77',startDeadline:100,pendStart:false,over:false}});
  vm.runInContext(line,context);const live=()=>context.window.__zbStartIsLive('run-123','c77');
  assert.equal(live(),true);
  for(const [key,value]of [['pendStart',true],['over',true],['runId','wrong'],['ceo','wrong'],['startDeadline',99]]){const old=context.G[key];context.G[key]=value;assert.equal(live(),false,key);context.G[key]=old;}
  context.startDocumentActive=false;assert.equal(live(),false);context.startDocumentActive=true;context.G=null;assert.equal(live(),false);
  assert.throws(()=>Object.defineProperty(context.window,'__zbStartIsLive',{value:()=>true}),TypeError);
 });
}
test('r3 exact delta does not admit deleted live-state or one-shot guard',()=>{
 for(const path of ['app.js','preview/app.js']){
  const source=read(path);assert.doesNotThrow(()=>withoutStartLifecycleDelta(path,source));
  assert.throws(()=>withoutStartLifecycleDelta(path,source.replace('zbRun.started || zbRun.settled','zbRun.settled')),/LIFECYCLE_DELTA_NOT_EXACT/);
  assert.throws(()=>withoutStartLifecycleDelta(path,source.replace('if (!live) { zbRun = null; return; }','')),/LIFECYCLE_DELTA_NOT_EXACT/);
 }
});
