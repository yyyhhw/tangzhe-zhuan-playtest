/** Approved second-eight adapter. Production composition owns catalog admission.
 * Host must register approved items before creating the validator, under its unified policy.
 */
import first from '../../qa-protocol2/wearables8-display.mjs?v=copy127-20261015-r1';
import * as render from './render.mjs?v=copy127-20261015-r1';
export const IDS=Object.freeze({clothes:Object.freeze([...first.IDS.clothes,...render.IDS.clothes]),hat:Object.freeze([...first.IDS.hat,...render.IDS.hat])});
const types=Object.freeze(Object.fromEntries(Object.entries(render.IDS).flatMap(([type,ids])=>ids.map(id=>[id,type]))));
export const ART=Object.freeze(Object.fromEntries(Object.keys(types).map(id=>[id,new URL('./art/'+id+'.png?v=copy127-20261015-r1',import.meta.url).href])));
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const registered=(E,id)=>render.has(id)&&E.ITEM_BY_ID?.[id]?.id===id&&E.ITEM_BY_ID[id].type===types[id];
export const owned=(E,s,id)=>render.has(id)?registered(E,id)&&Array.isArray(s?.gacha?.owned)&&s.gacha.owned.includes(id):first.owned(E,s,id);
export const has=id=>render.has(id)||first.has(id);
export function equipment(E,s,who,original=s?.wear?.[who]||{}){const eq=first.equipment(E,s,who,original);for(const slot of ['clothes','hat'])if(render.has(eq[slot])&&(!owned(E,s,eq[slot])||types[eq[slot]]!==slot))eq[slot]=null;return eq;}
export function hasEquipment(E,s,who){const eq=equipment(E,s,who);return ['clothes','hat'].some(slot=>owned(E,s,eq[slot]));}
export function look(base,E,s,who){const eq=equipment(E,s,who),selected={};for(const slot of ['clothes','hat'])if(types[eq[slot]]===slot&&owned(E,s,eq[slot]))selected[slot]=eq[slot];return render.withCollectibleLook(first.look(base,E,s,who),selected);}
export const drawClothes=(c,id)=>render.drawCollectibleClothes(c,id)||first.drawClothes(c,id);
export const drawHat=(c,id,hy)=>render.drawCollectibleHat(c,id,hy)||first.drawHat(c,id,hy);
export function iconHTML(E,s,id){if(!render.has(id))return first.iconHTML(E,s,id);return owned(E,s,id)?`<span class="item-art"><img data-item-art="${id}" src="${escape(ART[id])}" alt="${escape(E.ITEM_BY_ID[id].name)}"><span class="item-art-status" hidden>图示暂不可用</span></span>`:'<span class="ii">❓</span>';}
export function descriptionHTML(E,s,id){if(!render.has(id))return first.descriptionHTML(E,s,id);return owned(E,s,id)?`<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">${escape(E.ITEM_BY_ID[id].desc)}</small>`:'';}
export function catalogHTML(E,s,id){if(!render.has(id))return first.catalogHTML(E,s,id);if(!registered(E,id))return '';const it=E.ITEM_BY_ID[id],yes=owned(E,s,id);return `<div class="item ${yes?'':'no'}" data-wearable-item="${id}"><span class="t">${it.type==='hat'?'帽子':'衣服'}</span>${iconHTML(E,s,id)}${yes?escape(it.name)+descriptionHTML(E,s,id):'？？？<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">'+escape(it.hint)+'</small>'}</div>`;}
export function revealFlavorHTML(E,s,id){if(!render.has(id))return first.revealFlavorHTML(E,s,id);if(!owned(E,s,id))return '';const f=E.ITEM_BY_ID[id].flavor;return typeof f==='string'&&f.trim()?escape(f)+'<br>':'';}
export const PERSON_BOUNDS=first.PERSON_BOUNDS,fitPerson=first.fitPerson;
export const remainingPreviewHTML=rows=>first.remainingPreviewHTML(rows.filter(row=>!render.has(row.id)));
// Keep the existing host capability token only in this explicitly selected adapter.
export default Object.freeze({...first,IDS,has,owned,equipment,hasEquipment,look,drawClothes,drawHat,iconHTML,descriptionHTML,catalogHTML,revealFlavorHTML,remainingPreviewHTML});
