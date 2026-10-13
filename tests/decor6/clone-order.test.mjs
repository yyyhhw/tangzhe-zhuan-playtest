import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {canonical,clone} from '../../collection/domain/json.mjs';
import {planHiddenClaim,validHiddenTransition} from '../../collectibles/decor6-grants.mjs';
import {setup} from '../wearables8/fixture.mjs';
import {assembly,until} from '../wearables8/production-harness.mjs';
// Oracle differs only at the clone call: the previously reviewed canonical clone.
const file=new URL('../../collectibles/decor6-grants.mjs',import.meta.url);
const oldSource=fs.readFileSync(file,'utf8').replace('const next=cloneInSourceOrder(state),already=','const next=clone(state),already=').replace(/from '([^']+)'/g,(_,p)=>`from '${new URL(p,file)}'`);
const old=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));
async function state(){const t=await setup();t.init();return JSON.parse(t.prepare().candidateRaw);}
function extension(){return JSON.parse('{"z":{"__proto__":{"polluted":"no","z":1,"a":2},"constructor":"keep","prototype":[{"toString":"literal","toJSON":"literal","10":10,"2":2,"01":1}],"雪":"☃","a":-0},"a":[{"last":true,"first":null}]}');}
function orderTree(value){return value&&typeof value==='object'?Object.entries(value).map(([k,v])=>[k,orderTree(v)]):null;}
test('claim clone preserves every opaque key order and is canonically identical to old sorted-clone proposals',async()=>{
 const s=await state();s.future=extension();s.gacha.future=extension();s.shops[0].future=extension();const shared={z:1,a:2};s.future.shared=[shared,shared];const raw=JSON.stringify(s),shape=orderTree(s.future);
 for(const id of ['d_opening_photo','d_ward_charm']){
  const actual=planHiddenClaim(s,id),expected=old.planHiddenClaim(s,id);assert(actual.ok&&expected.ok);assert.equal(canonical(actual),canonical(expected));assert(validHiddenTransition(s,actual.state));assert.deepEqual(orderTree(actual.state.future),shape);assert.deepEqual(Object.keys(actual.state),Object.keys(s));assert.deepEqual(Object.keys(actual.state.gacha.future.z),Object.keys(s.gacha.future.z));assert.equal(Object.getPrototypeOf(actual.state.future.z),Object.prototype);assert(Object.hasOwn(actual.state.future.z,'__proto__'));assert.equal({}.polluted,undefined);assert.equal(Object.is(actual.state.future.z.a,-0),false);assert.notEqual(actual.state.future,s.future);assert.notEqual(actual.state.future.shared[0],actual.state.future.shared[1]);actual.state.future.shared[0].z=99;assert.equal(s.future.shared[0].z,1);assert.equal(JSON.stringify(s),raw);
 }
});
test('signatures and transition comparison remain order-insensitive but reject any nested value change',async()=>{
 const s=await state();s.future=extension();const p=planHiddenClaim(s,'d_ward_charm');assert(validHiddenTransition(s,clone(p.state)));const changed=clone(p.state);changed.future.z.__proto__.z++;assert.equal(validHiddenTransition(s,changed),false);assert.equal(old.validHiddenTransition(s,changed),false);
});
for(const kind of ['getter','toJSON','symbol','hidden','sparse','cycle','prototype','nan','bigint'])test('strict admission still rejects '+kind+' without invoking user code',async()=>{
 const s=await state();let calls=0;const x={};s.future=x;
 if(kind==='getter')Object.defineProperty(x,'x',{enumerable:true,get(){calls++;return 1;}});
 if(kind==='toJSON')x.toJSON=()=>{calls++;return {};};
 if(kind==='symbol')x[Symbol('x')]=1;
 if(kind==='hidden')Object.defineProperty(x,'x',{value:1});
 if(kind==='sparse')x.a=Array(2);
 if(kind==='cycle')x.self=x;
 if(kind==='prototype')Object.setPrototypeOf(x,{x:1});
 if(kind==='nan')x.x=NaN;
 if(kind==='bigint')x.x=1n;
 assert.throws(()=>planHiddenClaim(s,'d_ward_charm'),/INVALID_JSON/);assert.throws(()=>old.planHiddenClaim(s,'d_ward_charm'),/INVALID_JSON/);assert.equal(calls,0);
});
for(const scope of ['formal','preview'])test(scope+': real host claim preserves special-key order, exact evidence and once-only grant across reopen',async t=>{
 const h=await assembly({scope,protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.future=extension();s.gacha.future=extension();f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app,'app');const before=JSON.parse(h.data.get(h.t.keys.main)),evidence=[...h.data].filter(([k])=>k.endsWith('original'));
 for(const id of ['d_opening_photo','d_ward_charm'])assert(h.runtime.claimHidden(id).ok);
 const after=JSON.parse(h.data.get(h.t.keys.main));assert.deepEqual(orderTree(after.future),orderTree(before.future));assert.deepEqual(after.future,before.future);assert.deepEqual(after.gacha.future,before.gacha.future);assert.deepEqual([...h.data].filter(([k])=>k.endsWith('original')),evidence);const saved=[...h.data];await h.close();
 const re=await assembly({scope,protocol:2,configure:f=>{f.data.clear();for(const[k,v]of saved)f.data.set(k,v);}});t.after(()=>re.close());await until(()=>re.app,'reopen');assert.equal(re.runtime.claimHidden('d_ward_charm').code,'HIDDEN_ALREADY_CLAIMED');assert.deepEqual(JSON.parse(re.data.get(re.t.keys.main)).future,after.future);
});
for(const scope of ['formal','preview'])for(const fault of ['backup','main','unknown'])test(scope+': special opaque keys survive claim '+fault+' failure without replay',async t=>{
 const h=await assembly({scope,protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.future=extension();f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app,'app');
 const original=[...h.data].filter(([k])=>k.endsWith('original')),before=JSON.parse(h.data.get(h.t.keys.main));const S=h.context.Storage,put=S.prototype.setItem,get=S.prototype.getItem;let armed=false;
 S.prototype.setItem=function(k,v){const isClaim=k===h.t.keys.main&&JSON.parse(v).gacha.owned.includes('d_ward_charm');if(fault==='backup'&&k===h.t.keys.backup)throw Error('synthetic backup fail');if(fault==='main'&&isClaim)throw Error('synthetic main fail');const r=put.call(this,k,v);if(isClaim)armed=true;return r;};
 S.prototype.getItem=function(k){if(fault==='unknown'&&armed&&k===h.t.keys.main)throw Error('synthetic unknown');return get.call(this,k);};
 assert.equal(h.runtime.claimHidden('d_ward_charm').ok,false);const disk=h.data.get(h.t.keys.main),saved=JSON.parse(disk);assert.deepEqual(saved.future,before.future);assert.deepEqual(orderTree(saved.future),orderTree(before.future));assert.deepEqual([...h.data].filter(([k])=>k.endsWith('original')),original);assert.equal(saved.gacha.owned.includes('d_ward_charm'),fault==='unknown');
 const writes=h.writes().length;S.prototype.setItem=put;S.prototype.getItem=get;h.runtime.reconcile();assert.equal(h.writes().length,writes);assert.equal(h.data.get(h.t.keys.main),disk);if(fault==='unknown')assert.equal(h.runtime.claimHidden('d_ward_charm').code,'HIDDEN_ALREADY_CLAIMED');
});
test('global canonical signature algorithms and exact transition comparison unchanged from reviewed sources',async()=>{
 const {createHash}=await import('node:crypto');for(const row of JSON.parse(fs.readFileSync(new URL('./order-protection-integrity.json',import.meta.url)))){let s=fs.readFileSync(new URL('../../'+row.path,import.meta.url),'utf8');if(row.after)s=s.split(row.after)[1];if(row.start)s=s.slice(s.indexOf(row.start),s.indexOf(row.end,s.indexOf(row.start)));assert.equal(createHash('sha256').update(s).digest('hex'),row.sha256);}
});
test('root/nested order permutations and already-owned receipts retain old canonical semantics',async()=>{
 for(const reversed of [false,true])for(const alreadyOwned of [false,true]){
  let s=await state();s.future=extension();if(reversed){s=Object.fromEntries(Object.entries(s).reverse());s.future.z=Object.fromEntries(Object.entries(s.future.z).reverse());}if(alreadyOwned)s.gacha.owned.push('d_ward_charm');const result=planHiddenClaim(s,'d_ward_charm'),expected=old.planHiddenClaim(s,'d_ward_charm');assert.equal(canonical(result),canonical(expected));assert(validHiddenTransition(s,result.state));assert.deepEqual(Object.keys(result.state),Object.keys(s));assert.deepEqual(Object.keys(result.state.future.z),Object.keys(s.future.z));assert.equal(result.state.gacha.owned.length,s.gacha.owned.length+(alreadyOwned?0:1));assert.equal(planHiddenClaim(result.state,'d_ward_charm').code,'HIDDEN_ALREADY_CLAIMED');
 }
});
