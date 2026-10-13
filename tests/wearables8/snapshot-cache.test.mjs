import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {setup} from './fixture.mjs';
import {createProtocol2Validator} from '../../qa-protocol2/vendor/runtime/validator.mjs';
import * as codec from '../../qa-protocol2/vendor/codec/snapshot-codec.mjs';
import {canonical} from '../../collection/domain/json.mjs';
import {assembly,until} from './production-harness.mjs';
const require=createRequire(import.meta.url);
async function fixture(scope){
 const t=await setup(undefined,scope);t.init();const p=t.prepare();
 const path=new URL('../../'+(scope==='preview'?'preview/':'')+'economy.js',import.meta.url).pathname;
 delete require.cache[require.resolve(path)];const E=require(path);let decodes=0;
 const options={scope,economy:E,model:t.model,planner:t.planner,codec:{...codec,decodeSnapshot(...a){decodes++;return codec.decodeSnapshot(...a)}},canonical,validateLegacyCollection:t.c.validateCollection};
 const v=createProtocol2Validator(options);E[scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol']({commit(){throw Error('unused')},validateCollection:v.validateCollection});
 const evidence={snapshotRaw:p.snapshotRaw,originalRaw:scope==='formal'?t.data.get(t.keys.original):null};
 return {v,options,p,evidence,count:()=>decodes};
}
for(const scope of ['formal','preview']){
 test(scope+': exact verified evidence reused, current save and returned copies remain independent',async()=>{
  const f=await fixture(scope),a=f.v.validate(f.p.candidateRaw,f.evidence);assert.equal(a.ok,true,a.code);assert.equal(f.count(),1);
  a.state.collectiblesV1.catalogVersion='poison';a.identity.catalogVersion='poison';a.state.collectionHost.migration.kind='poison';
  const current=JSON.parse(f.p.candidateRaw);current.coins+=7;current.rev++;
  const b=f.v.validate(JSON.stringify(current),f.evidence);assert.equal(b.ok,true,b.code);assert.equal(b.state.coins,current.coins);assert.equal(f.count(),1);assert.notEqual(b.identity.catalogVersion,'poison');
  current.coins=-1;assert.equal(f.v.validate(JSON.stringify(current),f.evidence).ok,false);
  const identity=JSON.parse(f.p.candidateRaw);identity.collectiblesV1.catalogVersion='forged';assert.equal(f.v.validate(JSON.stringify(identity),f.evidence).ok,false);
 });
 test(scope+': changed evidence is rechecked, failed chains never cached, only one raw pair retained',async()=>{
  const f=await fixture(scope);assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);
  const changed={...f.evidence,snapshotRaw:f.evidence.snapshotRaw+' '};
  assert.equal(f.v.validate(f.p.candidateRaw,changed).ok,false);assert.equal(f.v.validate(f.p.candidateRaw,changed).ok,false);assert.equal(f.count(),3);
  assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);assert.equal(f.count(),4);
  const compact=codec.encodeSnapshot(codec.decodeSnapshot(f.evidence.snapshotRaw,{expectedScope:scope}),{format:2});
  assert(f.v.validate(f.p.candidateRaw,{...f.evidence,snapshotRaw:compact}).ok);assert.equal(f.count(),5);
  assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);assert.equal(f.count(),6);
  assert.equal(f.v.validate(f.p.candidateRaw,{...f.evidence,originalRaw:(f.evidence.originalRaw??'')+' '}).ok,false);
  assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);assert.equal(f.count(),8);
  const fresh=createProtocol2Validator(f.options);assert(fresh.validate(f.p.candidateRaw,f.evidence).ok);assert.equal(f.count(),9,'new session must verify independently');
  assert.equal(f.v.validate(f.p.candidateRaw,{...f.evidence,snapshotRaw:null}).ok,false);
 });
 for(const mutation of ['snapshot','main','lock'])test(scope+': warm production cache retains '+mutation+' protection', {timeout:15000},async t=>{
  const h=await assembly({scope,mode:'bootstrap',protocol:2});t.after(()=>h.close());await until(()=>h.app,'app');assert.equal(h.app.persist(),true);assert.equal(h.app.persist(),true);
  const key=mutation==='snapshot'?`tangzhe-${scope}-collectibles-v2-original`:h.t.keys.main;
  if(mutation==='lock'){h.pagehide();await until(()=>h.settled,'lock released');}else h.data.set(key,h.data.get(key)+' ');
  const main=h.data.get(h.t.keys.main),writes=h.writes().length;
  assert.equal(h.app.persist(),false);assert.equal(h.data.get(h.t.keys.main),main);assert.equal(h.writes().length,writes);
 });
}
test('formal cached chain cannot admit preview evidence',async()=>{const f=await fixture('formal'),p=await fixture('preview');assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);assert.equal(f.v.validate(f.p.candidateRaw,p.evidence).ok,false);assert(f.v.validate(f.p.candidateRaw,f.evidence).ok);});
