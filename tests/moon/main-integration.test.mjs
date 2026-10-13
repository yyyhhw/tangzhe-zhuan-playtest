// Integrated main capabilities coexist; synthetic Storage/DOM/Web Locks model, not browser.
import test from 'node:test';import assert from 'node:assert/strict';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
for(const scope of ['formal','preview'])test(scope+': hidden grants, moon receipts, ordinary save and synchronous pagehide retain each other',async t=>{
 const h=await assembly({scope,protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.shops[3].open=true;s.shops[3].lv=50;f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu,'integrated host');
 const evidence=[...h.data].filter(([k])=>k.endsWith('original'));let clock=1700000001000;h.context.Date.now=()=>clock;
 assert(h.runtime.claimHidden('d_opening_photo').ok);assert(h.context.XingTu.open().ok);assert(h.node('xingtuDepart').onclick().ok);h.context.XingTu.close();const voyage=copy(h.app.state.space.voyage);
 assert(h.runtime.claimHidden('d_ward_charm').ok);assert.deepEqual(copy(h.app.state.space.voyage),voyage);const grants=copy(h.app.state.collectiblesV1),gacha=copy(h.app.state.gacha);
 clock+=6000;assert(h.context.XingTu.open().ok);assert(h.node('xingtuClaim').onclick().ok);assert.equal(h.app.state.space.pts,8);assert.deepEqual(copy(h.app.state.collectiblesV1),grants);assert.deepEqual(copy(h.app.state.gacha),gacha);assert(h.app.persist());
 h.runtime.registerPageHide(()=>{assert(h.runtime.ownsLock());assert(h.app.persist());});h.pagehide();assert(!h.runtime.ownsLock());assert.equal(JSON.parse(h.data.get(h.t.keys.main)).space.pts,8);assert.deepEqual([...h.data].filter(([k])=>k.endsWith('original')),evidence);const n=h.writes().length;assert.equal(h.runtime.claimHidden('d_ward_charm').ok,false);assert.equal(h.app.persist(),false);assert.equal(h.writes().length,n);
});
