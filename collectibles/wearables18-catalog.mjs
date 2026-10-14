/** The approved second eight join the same protocol2 catalog, not a new migration. */
import {ITEMS} from '../candidates/blindbox18/catalog.mjs?v=xingtuv2-full-20261015-r1';
import {EIGHT_WEARABLES} from '../qa-protocol2/eight-catalog.mjs?v=xingtuv2-full-20261015-r1';
import {LEGACY_IDS} from '../qa-protocol2/vendor/planner/migration.mjs?v=xingtuv2-full-20261015-r1';
export {ITEMS as SECOND_EIGHT_WEARABLES};
const expectedIds=[...LEGACY_IDS,...EIGHT_WEARABLES.map(x=>x.id)].join('|');
const installed=new WeakSet();
export function prepareSecondEightCatalog(E){
  if(!E||installed.has(E)||E.ITEMS?.map(x=>x.id).join('|')!==expectedIds||E.REGULAR_ITEMS?.length!==40||E.SUPER_ITEMS?.length!==4||E.CFG?.GACHA_PRICE!==200000||E.CFG.GACHA_GROWTH!==1||E.CFG.SUPER_P!==.1||E.CFG.SUPER_PITY!==15)throw Error('SECOND_EIGHT_BASELINE_MISMATCH');
  for(const item of E.ITEMS)if(E.ITEM_BY_ID[item.id]!==item)throw Error('SECOND_EIGHT_MAP_MISMATCH');
  for(const item of ITEMS)if(Object.hasOwn(E.ITEM_BY_ID,item.id))throw Error('SECOND_EIGHT_ID_COLLISION');
  const before=E.ITEMS.slice(),regular=E.REGULAR_ITEMS.slice();let active=false;installed.add(E);
  function setActive(value){
    if(typeof value!=='boolean')throw Error('SECOND_EIGHT_BOOLEAN_REQUIRED');if(value===active)return;
    const expected=active?[...before,...ITEMS]:before,regs=active?[...regular,...ITEMS]:regular;
    if(E.ITEMS.length!==expected.length||E.ITEMS.some((x,i)=>x!==expected[i])||E.REGULAR_ITEMS.length!==regs.length||E.REGULAR_ITEMS.some((x,i)=>x!==regs[i])||expected.some(x=>E.ITEM_BY_ID[x.id]!==x))throw Error('SECOND_EIGHT_CATALOG_CHANGED');
    if(value){for(const item of ITEMS){E.ITEMS.push(item);E.REGULAR_ITEMS.push(item);E.ITEM_BY_ID[item.id]=item;}}
    else{E.ITEMS.splice(before.length);E.REGULAR_ITEMS.splice(regular.length);for(const item of ITEMS)delete E.ITEM_BY_ID[item.id];}
    active=value;
  }
  return Object.freeze({setActive,get active(){return active;},items:ITEMS});
}
