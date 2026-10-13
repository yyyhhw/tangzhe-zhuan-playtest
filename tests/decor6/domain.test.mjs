import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
import {DECOR6,prepareDecor6Catalog} from '../../collectibles/decor6-catalog.mjs';
import {planHiddenClaim,validHiddenTransition,validateHiddenLedger,hiddenEligibility} from '../../collectibles/decor6-grants.mjs';
import {setup} from '../wearables8/fixture.mjs';
import {prepareSecondEightCatalog} from '../../collectibles/wearables18-catalog.mjs';
const require=createRequire(import.meta.url);
function economy(scope){const path=new URL('../../'+(scope==='formal'?'':'preview/')+'economy.js',import.meta.url).pathname;delete require.cache[require.resolve(path)];const E=require(path);prepareEightWearableCatalog(E).setActive(true);prepareSecondEightCatalog(E).setActive(true);return E;}
for(const scope of ['formal','preview']){
 test(scope+': 52 retained, four ordinary added, two hidden never enter draws; price/pity unchanged',()=>{
  const E=economy(scope),old=E.ITEMS.slice(),reg=prepareDecor6Catalog(E),s=E.newState(1);s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});s.coins=5000000;s.totalEarned=5000000;s.gacha.owned=old.map(x=>x.id);s.gacha.draws=52;s.gacha.pity=3;
  reg.setActive(true);assert.equal(E.ITEMS.length,58);assert.equal(E.REGULAR_ITEMS.length,52);assert.deepEqual(E.ITEMS.slice(0,52),old);assert.equal(E.gachaRemaining(s).length,4);assert.equal(E.gachaPrice(s),200000);
  for(let i=0;i<4;i++){const r=E.gachaDraw(s,0);assert(r.ok);assert.equal(r.cost,200000);assert(!r.item.hidden);assert.equal(r.item.type,'decor');}
  assert.equal(E.gachaComplete(s),true);assert.equal(E.gachaDraw(s,0).ok,false);assert.equal(s.gacha.draws,56);assert.equal(s.gacha.pity,7);assert.equal(s.coins,4200000);assert(!s.gacha.owned.includes('d_opening_photo'));
  const empty=E.newState(1);assert.equal(E.gachaOdds(empty).perReg,.9/52);assert.equal(E.gachaOdds(empty).superP,.1);empty.gacha.pity=14;assert.equal(E.gachaOdds(empty).superP,1);reg.setActive(false);assert.deepEqual(E.ITEMS,old);
 });
 test(scope+': exact single claim preserves all opaque fields, wallet, draws, pity and original input',async()=>{
  const t=await setup(undefined,scope);t.init();const p=t.prepare(),s=JSON.parse(p.candidateRaw);s.gacha.future={receipt:['unknown',9]};s.shops[0].future={raw:'preserve'};const before=JSON.stringify(s),evidence=[...t.data];
  const first=planHiddenClaim(s,'d_opening_photo');assert(first.ok);assert(validHiddenTransition(s,first.state));assert.equal(JSON.stringify(s),before);assert.deepEqual([...t.data],evidence);assert.equal(first.state.coins,s.coins);assert.equal(first.state.gacha.draws,s.gacha.draws);assert.equal(first.state.gacha.pity,s.gacha.pity);assert.deepEqual(first.state.gacha.last,s.gacha.last);assert.deepEqual(first.state.gacha.future,s.gacha.future);assert.deepEqual(first.state.shops,s.shops);assert.equal(planHiddenClaim(first.state,'d_opening_photo').code,'HIDDEN_ALREADY_CLAIMED');
  const second=planHiddenClaim(first.state,'d_ward_charm');assert(second.ok);assert(validateHiddenLedger(second.state));assert.equal(Object.keys(second.state.collectiblesV1.grants).length,2);assert.equal(second.state.gacha.owned.length,s.gacha.owned.length+2);assert(!JSON.stringify(second.state.collectiblesV1.grants).includes('At'));
  second.state.coins++;assert(!validHiddenTransition(first.state,second.state));
 });
 test(scope+': reliable existing conditions only, no CEO requirement, malformed evidence cannot award',async()=>{
  const t=await setup(undefined,scope);t.init();const s=JSON.parse(t.prepare().candidateRaw);for(const c of Object.values(s.ceos))c.unlocked=false;
  assert(hiddenEligibility(s,'d_opening_photo').eligible);assert(hiddenEligibility(s,'d_ward_charm').eligible);s.shops[1].open=false;assert(!planHiddenClaim(s,'d_opening_photo').ok);s.zombie.cleared=9;assert(!planHiddenClaim(s,'d_ward_charm').ok);s.zombie.cleared=10;s.zombie.lv.atk=-1;assert(!planHiddenClaim(s,'d_ward_charm').ok);delete s.zombie;assert(!planHiddenClaim(s,'d_ward_charm').ok);
 });
}
test('catalog collision refuses before mutation',()=>{const E=economy('formal');E.ITEM_BY_ID.d_charcoal_chime={id:'foreign'};const before=E.ITEMS.slice();assert.throws(()=>prepareDecor6Catalog(E),/COLLISION/);assert.deepEqual(E.ITEMS,before);assert.equal(DECOR6.filter(x=>x.hidden).length,2);});
