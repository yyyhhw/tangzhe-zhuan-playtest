/** 盲盒200 目录注册：在 decor6（58件）之上追加已放行批次。只有 LIVE_BATCHES 里的批次进池；
 * 其余批次等熊大的图齐了再把批次名加进来（同时 art/collectibles/box200/<ID>.png 必须存在）。
 * 隐藏款（rarity=hidden）不进普通池；临时口径：每次成功开盒另有 1% 额外掉一件未拥有的已放行隐藏款。 */
import {BOX200_ITEMS} from './box200-items.mjs?v=copy106-20261014-r1';
import {BOX200_COPY} from './box200-copy.mjs?v=copy106-20261014-r1';
export const LIVE_BATCHES=Object.freeze(['盲盒-83','box200-w1']);
export const HIDDEN_BONUS_P=0.01;
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
  const before=E.ITEMS.slice(),regular=E.REGULAR_ITEMS.slice(),draw=E.gachaDraw;let active=false;installed.add(E);
  function bonusDraw(st,rnd,price,now){
    const r=draw(st,rnd,price,now);
    if(!r||!r.ok||!hidden.length||!r.odds)return r;
    // 第二个随机数取自同一 rnd 的抽取余数（与选中项独立且均匀），不额外改调用方。
    const o=r.odds,u=r.super?rnd/o.superP:(rnd-o.superP)/(1-o.superP),n=r.super?o.remSuper:o.remReg,frac=u*n-Math.floor(u*n);
    const left=hidden.filter(x=>!st.gacha.owned.includes(x.id));
    if(!(frac<HIDDEN_BONUS_P)||!left.length)return r;
    const bonus=left[Math.min(left.length-1,Math.floor(frac/HIDDEN_BONUS_P*left.length))];
    st.gacha.owned.push(bonus.id);if(st.gacha.last)st.gacha.last.bonus=bonus.id;
    return {...r,bonus};
  }
  function setActive(value){
    if(typeof value!=='boolean')throw Error('BOX200_BOOLEAN_REQUIRED');if(value===active)return;
    const expected=active?[...before,...items]:before,regs=active?[...regular,...random]:regular;
    if(E.ITEMS.length!==expected.length||E.ITEMS.some((x,i)=>x!==expected[i])||E.REGULAR_ITEMS.length!==regs.length||E.REGULAR_ITEMS.some((x,i)=>x!==regs[i]))throw Error('BOX200_CATALOG_CHANGED');
    if(value){for(const item of items){E.ITEMS.push(item);E.ITEM_BY_ID[item.id]=item;}E.REGULAR_ITEMS.push(...random);if(hidden.length)E.gachaDraw=bonusDraw;}
    else{E.ITEMS.splice(before.length);E.REGULAR_ITEMS.splice(regular.length);for(const item of items)delete E.ITEM_BY_ID[item.id];if(E.gachaDraw===bonusDraw)E.gachaDraw=draw;}
    active=value;
  }
  return Object.freeze({setActive,get active(){return active;},items});
}
