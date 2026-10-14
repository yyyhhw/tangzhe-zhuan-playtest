/** 盲盒200 目录注册：在 decor6（58件）之上追加已放行批次。只有 LIVE_BATCHES 里的批次进池；
 * 其余批次等熊大的图齐了再把批次名加进来（同时 art/collectibles/box200/<ID>.png 必须存在）。
 * 隐藏款（rarity=hidden）不进普通池、开盒永远抽不到；盲盒-109 起达成特殊目标直接获得（见 box200-hidden.mjs），不占每天 5 次。
 * 隐藏款（batch box200-hidden）先于图放行：没图时图鉴/店景走「图示暂不可用」兜底。 */
import {BOX200_ITEMS} from './box200-items.mjs?v=xingtuv2-2-20261014-r1';
import {BOX200_COPY} from './box200-copy.mjs?v=xingtuv2-2-20261014-r1';
export const LIVE_BATCHES=Object.freeze(['盲盒-83','box200-w1','box200-hidden','box200-w2','box200-w3','box200-w4','box200-w5']);
export function liveItems(batches=LIVE_BATCHES){return BOX200_ITEMS.filter(x=>batches.includes(x.batch)).map(x=>{const c=BOX200_COPY[x.id];if(!c||!c.name)throw Error('BOX200_COPY_MISSING:'+x.id);
  return Object.freeze({id:x.id,type:x.type,shop:x.shop,name:c.name,hint:c.hint||'',desc:c.desc||'',...(c.flavor?{flavor:c.flavor}:{}),...(x.rarity==='hidden'?{hidden:true,unlock:c.unlock||''}:{}),box200:true});});}
const BASE_COUNT=58,BASE_REGULAR=52;
const installed=new WeakSet();
export function prepareBox200Catalog(E,{batches=LIVE_BATCHES}={}){
  if(!E||installed.has(E)||E.ITEMS?.length!==BASE_COUNT||E.REGULAR_ITEMS?.length!==BASE_REGULAR||E.SUPER_ITEMS?.length!==4||E.CARD_COUNT!==8)throw Error('BOX200_BASELINE_MISMATCH');
  for(const item of E.ITEMS)if(E.ITEM_BY_ID[item.id]!==item)throw Error('BOX200_MAP_MISMATCH');
  const items=liveItems(batches);
  for(const item of items)if(Object.hasOwn(E.ITEM_BY_ID,item.id))throw Error('BOX200_ID_COLLISION');
  const random=items.filter(x=>!x.hidden),hidden=items.filter(x=>x.hidden);
  const before=E.ITEMS.slice(),regular=E.REGULAR_ITEMS.slice();let active=false;installed.add(E);
  function setActive(value){
    if(typeof value!=='boolean')throw Error('BOX200_BOOLEAN_REQUIRED');if(value===active)return;
    const expected=active?[...before,...items]:before,regs=active?[...regular,...random]:regular;
    if(E.ITEMS.length!==expected.length||E.ITEMS.some((x,i)=>x!==expected[i])||E.REGULAR_ITEMS.length!==regs.length||E.REGULAR_ITEMS.some((x,i)=>x!==regs[i]))throw Error('BOX200_CATALOG_CHANGED');
    if(value){for(const item of items){E.ITEMS.push(item);E.ITEM_BY_ID[item.id]=item;}E.REGULAR_ITEMS.push(...random);}
    else{E.ITEMS.splice(before.length);E.REGULAR_ITEMS.splice(regular.length);for(const item of items)delete E.ITEM_BY_ID[item.id];}
    active=value;
  }
  return Object.freeze({setActive,get active(){return active;},items});
}
