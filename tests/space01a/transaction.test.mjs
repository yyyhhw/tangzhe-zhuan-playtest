// Actual P2 validator + coordinator + planner + codec. Faultable memory adapter, not browser.
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import test from 'node:test';import assert from 'node:assert/strict';
import {setup} from '../wearables8/fixture.mjs';import {defaultSpace} from '../../space/domain.mjs';
import {createCardAwareSession} from '../../qa-protocol2/vendor/cards/card-coordinator.mjs';
import {createProtocol2Validator} from '../../qa-protocol2/vendor/runtime/validator.mjs';
import * as codec from '../../qa-protocol2/vendor/codec/snapshot-codec.mjs';
import {canonical} from '../../collection/domain/json.mjs';
import {createCollectionHost} from '../../collection/host-wallet.mjs';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
async function fixture(scope){const t=await setup('main3a96',scope);t.init();const prepared=t.prepare();t.data.set(`tangzhe-${scope}-collectibles-v2-original`,prepared.snapshotRaw);t.data.set(t.keys.main,prepared.candidateRaw);const require=createRequire(import.meta.url),path=fileURLToPath(new URL('../../'+(scope==='formal'?'':'preview/')+'economy.js',import.meta.url));delete require.cache[require.resolve(path)];const E=require(path);prepareEightWearableCatalog(E).setActive(true);let owned=true;const lease={owns:()=>owned};const validator=createProtocol2Validator({scope,economy:E,model:t.model,planner:t.planner,codec,canonical,validateLegacyCollection:t.c.validateCollection});const make=()=>createCardAwareSession({scope,storage:t.storage,lease,validator,canonical,model:t.model,economy:E,createCollectionHost}).coordinator;const c=make();E[scope==='formal'?'installFormalCollectionProtocol':'installPreviewCollectionProtocol'](c);const adopted=c.adopt();assert(adopted.ok,JSON.stringify(adopted));return {...t,c,make,lease,setLease:v=>owned=v};}
function same(prior,after){const expected=copy(prior);expected.space=defaultSpace();expected.rev++;assert.deepEqual(after,expected);}
for(const scope of ['formal','preview']){
 for(const failure of ['write-throw','unknown-before','readback-unequal','lock-backup','lock-main','lock-before-main-read'])test(scope+' P2 actual transaction '+failure+'; no duplicate initialization after reconcile/new owner',async()=>{const t=await fixture(scope),before=t.data.get(t.keys.main),prior=JSON.parse(before),evidence=new Map(t.data),set=t.storage.setItem,get=t.storage.getItem;let wroteBackup=false,armed=false;
 t.storage.setItem=(k,v)=>{if(k===t.keys.main&&failure==='unknown-before'){armed=true;throw Error('main denied');}set(k,v);if(k===t.keys.backup){wroteBackup=true;if(failure==='lock-backup')t.setLease(false);}if(k===t.keys.main){armed=true;if(failure==='write-throw')throw Error('after write');if(failure==='lock-main')t.setLease(false);}};
 t.storage.getItem=k=>{if(k===t.keys.main&&failure==='lock-before-main-read'&&wroteBackup)t.setLease(false);if(k===t.keys.main&&armed){if(failure==='unknown-before')throw Error('readback unavailable');if(failure==='readback-unequal')return '{"not":"either state"}';}return get(k);};
 const r=t.c.initializeSpace(),stored=t.data.get(t.keys.main);if(failure==='write-throw'){assert(r.ok,JSON.stringify(r));same(prior,r.state);}else assert(!r.ok,JSON.stringify(r));if(['write-throw','readback-unequal','lock-main'].includes(failure))same(prior,JSON.parse(stored));else assert.equal(stored,before);for(const [k,v]of evidence)if(![t.keys.main,t.keys.backup].includes(k))assert.equal(t.data.get(k),v,k);
 const n=t.writes.length;t.storage.setItem=set;t.storage.getItem=get;t.setLease(true);
 let owner=t.c;
 if(failure.startsWith('lock')){owner=t.make();assert(owner.adopt().ok);}else if(failure!=='write-throw'){const fixed=owner.reconcile();assert(fixed.ok,JSON.stringify(fixed));assert.equal(JSON.stringify(fixed.state),stored);assert.equal(t.writes.length,n);}
 const retry=owner.initializeSpace();assert(retry.ok,JSON.stringify(retry));same(prior,JSON.parse(t.data.get(t.keys.main)));const count=t.writes.length;assert(!owner.initializeSpace().initialized);assert.equal(t.writes.length,count);
 });
 test(scope+' opaque unknown root/nested extension remains immutable and scope/arguments stay constrained',async()=>{const t=await fixture(scope),s=t.c.current().state;s.customForwardField.nested.push('tamper');assert.equal(t.c.commit(s).code,'OPAQUE_EXTENSION_CHANGE_UNSUPPORTED');assert(!t.c.initializeSpace({space:defaultSpace()}).ok);assert.equal(t.writes.length,0);assert.throws(()=>createCardAwareSession({scope:'previewpet',storage:t.storage,lease:t.lease,validator:{},canonical}),/DEPENDENCIES/);});
}
