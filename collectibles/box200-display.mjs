/** 盲盒200 显示：图一律从 art/collectibles/box200/<ID>.png 读（512×512 透明 PNG，见 /workspace/box200/style.md）。
 * 放图即生效：图鉴图标、CEO 身上的衣/帽、店铺装饰卡片都用同一张图。图没到时显示「图示暂不可用」，不报错。 */
import {BOX200_ITEMS} from './box200-items.mjs?v=xingtuv2-2-20261014-r1';
const meta=Object.fromEntries(BOX200_ITEMS.map(x=>[x.id,x]));
export const artURL=id=>new URL('../art/collectibles/box200/'+id+'.png?v=xingtuv2-2-20261014-r1',import.meta.url).href;
const escape=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const images=new Map();
function image(id){let i=images.get(id);if(!i&&typeof Image==='function'){i=new Image();i.src=artURL(id);images.set(id,i);}return i;}
const ready=i=>i&&i.complete&&i.naturalWidth>0;
export const has=id=>Object.hasOwn(meta,id);
const registered=(E,id)=>has(id)&&E.ITEM_BY_ID?.[id]?.id===id;
const ownedBy=(E,s,id)=>registered(E,id)&&Array.isArray(s?.gacha?.owned)&&s.gacha.owned.includes(id);
const icon=(E,id)=>`<span class="item-art"><img data-item-art="${id}" src="${escape(artURL(id))}" alt="${escape(E.ITEM_BY_ID[id]?.name)}"><span class="item-art-status" hidden>图示暂不可用</span></span>`;
// Person anchors follow candidates/blindbox18/render.mjs bounds: torso [-30,-80]..[30,-26]; hat box above head anchor.
function drawImg(c,id,x,y,w,h){const i=image(id);if(ready(i))c.drawImage(i,x,y,w,h);return true;}
export function wrapWearables(first){
  const types=id=>meta[id]?.type;
  const owned=(E,s,id)=>has(id)?ownedBy(E,s,id):first.owned(E,s,id);
  function equipment(E,s,who,original=s?.wear?.[who]||{}){const o={...original},keep={};for(const slot of ['clothes','hat'])if(has(o[slot])){keep[slot]=o[slot];o[slot]=null;}
    const eq=first.equipment(E,s,who,o);for(const slot of ['clothes','hat'])if(keep[slot])eq[slot]=ownedBy(E,s,keep[slot])&&types(keep[slot])===slot?keep[slot]:null;return eq;}
  const hasEquipment=(E,s,who)=>{const eq=equipment(E,s,who);return ['clothes','hat'].some(slot=>owned(E,s,eq[slot]));};
  function look(base,E,s,who){const eq=equipment(E,s,who),L=first.look(base,E,s,who),out={...L};
    if(has(eq.clothes))Object.assign(out,{collectibleClothes:eq.clothes,top:'#E3D4B8',sleeve:base.sleeve||base.top,apron:null,pattern:null,inner:null,lapel:false,rocketLogo:false,hood:false,tie:false});
    if(has(eq.hat))out.hat=eq.hat;return out;}
  const drawClothes=(c,id)=>has(id)&&types(id)==='clothes'?drawImg(c,id,-30,-82,60,60):first.drawClothes(c,id);
  const drawHat=(c,id,hy)=>has(id)&&types(id)==='hat'?drawImg(c,id,-26,hy-58,52,52):first.drawHat(c,id,hy);
  const isWear=id=>has(id)&&types(id)!=='decor';
  const iconHTML=(E,s,id)=>isWear(id)?(ownedBy(E,s,id)?icon(E,id):'<span class="ii">❓</span>'):first.iconHTML(E,s,id);
  const descriptionHTML=(E,s,id)=>isWear(id)?(ownedBy(E,s,id)?`<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">${escape(E.ITEM_BY_ID[id].desc)}</small>`:''):first.descriptionHTML(E,s,id);
  function catalogHTML(E,s,id){if(!isWear(id))return first.catalogHTML(E,s,id);if(!registered(E,id))return '';const it=E.ITEM_BY_ID[id],yes=ownedBy(E,s,id);
    return `<div class="item ${yes?'':'no'}" data-wearable-item="${id}"><span class="t">${it.type==='hat'?'帽子':'衣服'}</span>${iconHTML(E,s,id)}${yes?escape(it.name)+descriptionHTML(E,s,id):'？？？<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">'+escape(it.hidden===true&&it.box200?it.unlock+' 就送':it.hint)+'</small>'}</div>`;}
  const revealFlavorHTML=(E,s,id)=>{if(!isWear(id))return first.revealFlavorHTML(E,s,id);const f=ownedBy(E,s,id)&&E.ITEM_BY_ID[id].flavor;return typeof f==='string'&&f.trim()?escape(f)+'<br>':'';};
  const IDS=Object.freeze({clothes:Object.freeze([...first.IDS.clothes,...BOX200_ITEMS.filter(x=>x.type==='clothes').map(x=>x.id)]),hat:Object.freeze([...first.IDS.hat,...BOX200_ITEMS.filter(x=>x.type==='hat').map(x=>x.id)])});
  // 盲盒-109 fix：盲盒页图鉴补一段「隐藏款」，未得的显示剪影 ❓ +「{unlock} 就送」，已得的显示图与名字（衣/帽/装饰都在这里）。
  function box200HiddenHTML(E,s){const rows=BOX200_ITEMS.filter(x=>x.rarity==='hidden'&&registered(E,x.id));if(!rows.length)return '';
    const got=rows.filter(x=>ownedBy(E,s,x.id)).length,label={clothes:'衣服',hat:'帽子',decor:'装饰'};
    return `<div class="sec-title">隐藏款 ${got}/${rows.length}</div><div class="item-grid" data-box200-hidden>${rows.map(x=>{const it=E.ITEM_BY_ID[x.id],yes=ownedBy(E,s,x.id);
      return `<div class="item ${yes?'':'no'}" data-hidden-item="${x.id}"><span class="t">隐藏 · ${label[x.type]}</span>${yes?icon(E,x.id):'<span class="ii">❓</span>'}${yes?escape(it.name):'？？？<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">'+escape(it.unlock+' 就送')+'</small>'}</div>`;}).join('')}</div>`;}
  return Object.freeze({...first,IDS,box200HiddenHTML,has:id=>isWear(id)||first.has(id),owned,equipment,hasEquipment,look,drawClothes,drawHat,iconHTML,descriptionHTML,catalogHTML,revealFlavorHTML,
    remainingPreviewHTML:rows=>first.remainingPreviewHTML(rows.filter(r=>!has(r.id)))});
}
export function wrapDecor(decor){
  const isDecor=id=>has(id)&&meta[id].type==='decor';
  const descriptions=new Proxy(decor.descriptions,{get:(t,k)=>isDecor(k)?(globalThis.Economy?.ITEM_BY_ID?.[k]?.desc||''):t[k]});
  // Shop scene: owned, shown box200 decor sit in a small row on the counter, max 6, after decor6.
  function draw(c,state,W,l,U){decor.draw(c,state,W,l,U);if(!state.shops[state.cur]?.open)return;
    const shown=state.gacha.owned.filter(id=>isDecor(id)&&!state.decorHidden.includes(id)).slice(-6);
    shown.forEach((id,k)=>{const i=image(id),s=26*U;if(ready(i))c.drawImage(i,W*(.08+k*.07)-s/2,l.counterY-s-2*U,s,s);});}
  return Object.freeze({...decor,has:id=>isDecor(id)||decor.has(id),iconHTML:id=>isDecor(id)?`<span class="item-art"><img data-item-art="${id}" src="${escape(artURL(id))}" alt=""><span class="item-art-status" hidden>图示暂不可用</span></span>`:decor.iconHTML(id),descriptions,draw});
}
