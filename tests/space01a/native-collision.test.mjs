// Node/VM structural counterexamples; JSC presentation is simulated, not an actual engine run.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {readSpace} from '../../space/domain.mjs';import {setup} from '../wearables8/fixture.mjs';
const source=readFileSync(new URL('../../space/domain.mjs',import.meta.url),'utf8');
const newLine=source.split('\n').find(l=>l.includes('return pd?.value===p && Function.prototype.toString.call(d.value).replace'));
const r3Line="    return pd?.value===p && Function.prototype.toString.call(d.value).replace(/\\s/g,'')===`function${name}(){[nativecode]}`;";
assert(newLine);const r3=source.replace(newLine,r3Line);assert.equal(createHash('sha256').update(r3).digest('hex'),'e771de91f5d72add58453c6ad121eb7f4215bc3bcf9c7e4322f1a843030061ba','exact r3 preimage');
const shim=`{const original=Function.prototype.toString;Function.prototype.toString=function(){const text=original.call(this);return text==='function Object() { [native code] }'?'function Object() {\\n    [native code]\\n}':text==='function Array() { [native code] }'?'function Array() {\\n    [native code]\\n}':text;};}`;
async function domain(text,format){const context=vm.createContext({});if(format)vm.runInContext(shim,context);const m=new vm.SourceTextModule(text,{context});await m.link(()=>{throw Error('unexpected import');});await m.evaluate();return {api:m.namespace,run:s=>vm.runInContext(s,context)};}
for(const format of [false,true])for(const name of ['Object','Array'])for(const layout of ['compact','spaced'])test(`${format?'JSC-format VM':'V8'} ${name} [nativecode] ${layout}: exact r3 admits genuine fake identity closure; r4 refuses without invocation/cleanup`,async()=>{
 for(const text of [r3,source]){
  const h=await domain(text,format),body=layout==='compact'?`function ${name}(){[nativecode]}`:`function ${name}() { [nativecode] }`;
  const state=h.run(`(()=>{globalThis.calls=0;Object.defineProperty(globalThis,'nativecode',{get(){calls++;throw Error('fake function invoked');}});const Fake=${body};Object.setPrototypeOf(Fake.prototype,null);const value=${name==='Object'?"Object.create(Fake.prototype)":"Object.setPrototypeOf([1],Fake.prototype)"};${name==='Object'?"value.keep='original';":""}globalThis.fake=Fake;globalThis.value=value;return {unknown:value};})()`);
  assert.equal(h.run('Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value),"constructor").value.prototype===Object.getPrototypeOf(value)'),true);
  assert.equal(h.run('Object.hasOwn(fake,"toString")'),false);assert(h.run('Function.prototype.toString.call(fake)').includes('[nativecode]'));
  const read=h.api.readSpace(state),migration=h.api.migrateSpace(state);
  if(text===r3){assert(read.ok);assert(migration.ok);}else {assert.equal(read.code,'SPACE_PARENT_INVALID_READ_ONLY');assert(!migration.ok);}
  assert.strictEqual(state.unknown,h.run('value'));assert.equal(h.run('calls'),0);assert.equal(h.run('Object.getPrototypeOf(value)===fake.prototype'),true);
  const actual=h.run('JSON.parse(\'{"legal":[1,null]}\')');assert(h.api.readSpace(actual).ok,'native signatures still legal in this format');
 }
});
for(const scope of ['formal','preview'])for(const name of ['Object','Array'])test(`${scope} actual bare P1 rejects ${name} nativecode collision before any save/copy`,async()=>{
 let calls=0;const context=vm.createContext({getCalls:()=>++calls});vm.runInContext("Object.defineProperty(globalThis,'nativecode',{get(){getCalls();throw Error('must not call');}})",context);
 const value=vm.runInContext(`(()=>{const Fake=function ${name}(){[nativecode]};Object.setPrototypeOf(Fake.prototype,null);return ${name==='Object'?'Object.create(Fake.prototype)':'Object.setPrototypeOf([1],Fake.prototype)'};})()`,context);
 assert(!readSpace({unknown:value}).ok);const t=await setup('d40f54e',scope);t.init();const raw=t.data.get(t.keys.main),state=t.c.current().state;state.unknown=value;
 assert(!t.c.commit(state).ok);assert.strictEqual(state.unknown,value);assert.equal(t.writes.length,0);assert.equal(t.data.get(t.keys.main),raw);assert.equal(calls,0);
});
