import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareEightWearableCatalog,EIGHT_WEARABLES} from '../../qa-protocol2/eight-catalog.mjs';
const require=createRequire(import.meta.url);
const frozen=new URL('../../',import.meta.url);
function economy(scope){const path=fileURLToPath(new URL((scope==='preview'?'preview/':'')+'economy.js',frozen));delete require.cache[require.resolve(path)];return require(path);}
function opened(E){const s=E.newState(1700000000000);s.coins=50000000;s.totalEarned=50000000;s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});return s;}
for(const scope of ['formal','preview']){
 test(`${scope}: activation only extends ordinary catalog; deactivation restores exact existing objects`,()=>{
  const E=economy(scope),old=E.ITEMS.slice(),regular=E.REGULAR_ITEMS.slice(),superItems=E.SUPER_ITEMS.slice(),before=JSON.stringify(E.CFG),set=JSON.stringify(E.SET_REWARD),register=prepareEightWearableCatalog(E);
  assert.equal(register.active,false);assert.equal(E.ITEMS.length,36);register.setActive(true);assert.equal(E.ITEMS.length,44);assert.equal(E.REGULAR_ITEMS.length,40);assert.deepEqual(E.SUPER_ITEMS,superItems);assert.deepEqual(E.ITEMS.slice(0,36),old);assert.equal(JSON.stringify(E.CFG),before);assert.equal(JSON.stringify(E.SET_REWARD),set);
  for(const item of EIGHT_WEARABLES){assert.equal(E.ITEM_BY_ID[item.id],item);assert.ok(Object.isFrozen(item));assert.ok(['hat','clothes'].includes(item.type));}
  register.setActive(true);assert.equal(E.ITEMS.length,44);register.setActive(false);assert.deepEqual(E.ITEMS,old);assert.deepEqual(E.REGULAR_ITEMS,regular);for(const item of EIGHT_WEARABLES)assert.equal(Object.hasOwn(E.ITEM_BY_ID,item.id),false);
 });
 test(`${scope}: exact ordinary probability dilution with original super probability, price and pity`,()=>{
  const E=economy(scope),state=opened(E),reg=prepareEightWearableCatalog(E);const prior=E.gachaOdds(state);assert.equal(prior.perReg,0.9/32);reg.setActive(true);let odds=E.gachaOdds(state);assert.equal(odds.superP,.1);assert.equal(odds.perSuper,.1/4);assert.equal(odds.perReg,.9/40);assert.equal(odds.remReg,40);assert.equal(E.gachaPrice(state),200000);
  state.gacha.pity=14;odds=E.gachaOdds(state);assert.equal(odds.superP,1);assert.equal(odds.pityLeft,1);const pick=E.gachaDraw(state,0);assert.equal(pick.super,true);assert.equal(state.gacha.pity,0);assert.equal(state.coins,49800000);
 });
 test(`${scope}: old complete save gets eight nonduplicate ordinary draws using unchanged algorithm`,()=>{
  const E=economy(scope),state=opened(E);state.gacha.owned=E.ITEMS.map(x=>x.id);state.gacha.draws=36;state.wear.c77={clothes:'c_gold',hat:'h_gold'};const old=state.gacha.owned.slice();const reg=prepareEightWearableCatalog(E);assert.equal(E.gachaComplete(state),true);reg.setActive(true);assert.equal(E.gachaComplete(state),false);
  for(const item of EIGHT_WEARABLES){const result=E.gachaDraw(state,0);assert.equal(result.ok,true);assert.equal(result.item.id,item.id);assert.equal(result.super,false);assert.equal(result.cost,200000);assert.equal(result.setDone,false);assert.equal(state.gacha.last.id,item.id);}
  assert.equal(state.coins,50000000-8*200000);assert.equal(state.gacha.draws,44);assert.equal(state.gacha.pity,8);assert.equal(new Set(state.gacha.owned).size,44);assert.deepEqual(state.gacha.owned.slice(0,36),old);assert.equal(E.gachaComplete(state),true);assert.equal(E.gachaDraw(state,0).ok,false);assert.equal(E.cardsComplete(state),true);assert.deepEqual(state.wear.c77,{clothes:'c_gold',hat:'h_gold'});
 });
 test(`${scope}: all eight owned/last/wear survive current normalization with active registry`,()=>{
  const E=economy(scope),reg=prepareEightWearableCatalog(E);reg.setActive(true);
  for(const item of EIGHT_WEARABLES){const state=opened(E);state.gacha.owned=[item.id];state.gacha.last={id:item.id,n:1,odds:'synthetic',setDone:false,seen:false,super:false};state.wear.c77[item.type]=item.id;const migrated=E.migrate(state,state.lastSeen).st;assert.deepEqual(migrated.gacha.owned,[item.id]);assert.equal(migrated.gacha.last.id,item.id);assert.equal(migrated.wear.c77[item.type],item.id);}
 });
 test(`${scope}: collisions, altered baseline and duplicate installer fail before activation`,()=>{
  const E=economy(scope);E.ITEMS.pop();assert.throws(()=>prepareEightWearableCatalog(E),/BASELINE/);assert.equal(E.ITEMS.length,35);
  const E2=economy(scope);const reg=prepareEightWearableCatalog(E2);assert.throws(()=>prepareEightWearableCatalog(E2),/BASELINE/);assert.throws(()=>reg.setActive(1),/BOOLEAN/);assert.equal(E2.ITEMS.length,36);assert.equal(E2.gachaOdds(opened(E2)).perReg,.9/32);
 });
}
