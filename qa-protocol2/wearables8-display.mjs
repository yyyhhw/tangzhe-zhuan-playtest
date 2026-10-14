/** Read-only display adapter. Registration, awards and persistence belong to the host. */
import * as first from './wearables8/first-eight.mjs?v=copy106-20261014-r1';
import * as bbq from './wearables8/bbq-six.mjs?v=copy106-20261014-r1';

export const VERSION = 'qa-owned-wearables8-display-1';
export const IDS = Object.freeze({
  clothes: Object.freeze(['c_charcoal_vest', 'c_matcha_knit', 'c_ember_fan_mantle', 'c_grill_grid_tabard']),
  hat: Object.freeze(['h_guokui', 'h_antenna_clip', 'h_skewer_pinwheel', 'h_mushroom_parasol']),
});
const types = Object.freeze(Object.fromEntries(Object.entries(IDS).flatMap(([type, ids]) => ids.map(id => [id, type]))));
const art = Object.freeze(Object.fromEntries(Object.keys(types).map(id => [id, new URL(
  './wearables8/art/' + id + (['c_charcoal_vest', 'c_matcha_knit', 'h_guokui', 'h_antenna_clip'].includes(id) ? '_catalog_v1.webp' : '.png') + '?v=copy106-20261014-r1',
  import.meta.url,
).href])));
export const has = id => Object.hasOwn(types, id);
const registered = (economy, id) => has(id) && economy.ITEM_BY_ID?.[id]?.id === id && economy.ITEM_BY_ID[id].type === types[id];
export const owned = (economy, state, id) => registered(economy, id) && Array.isArray(state?.gacha?.owned) && state.gacha.owned.includes(id);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));

/** Never manufacture ownership or update the supplied equipment/state. */
export function equipment(economy, state, who, original = state?.wear?.[who] || {}) {
  const result = {...original};
  for (const slot of ['clothes', 'hat']) {
    const id = result[slot];
    if (has(id) && (!owned(economy, state, id) || types[id] !== slot)) result[slot] = null;
  }
  return result;
}
export function hasEquipment(economy, state, who) {
  const eq = equipment(economy, state, who);
  return ['clothes', 'hat'].some(slot => types[eq[slot]] === slot && owned(economy, state, eq[slot]));
}
export function look(base, economy, state, who) {
  const eq = equipment(economy, state, who);
  const selected = Object.fromEntries(['clothes', 'hat'].filter(slot => types[eq[slot]] === slot && owned(economy, state, eq[slot])).map(slot => [slot, eq[slot]]));
  return bbq.withCollectibleLook(first.withCollectibleLook(base, selected), selected);
}
export function drawClothes(context, id) { return has(id) && types[id] === 'clothes' && (first.drawCollectibleClothes(context, id) || bbq.drawCollectibleClothes(context, id)); }
export function drawHat(context, id, hy) { return has(id) && types[id] === 'hat' && (first.drawCollectibleHat(context, id, hy) || bbq.drawCollectibleHat(context, id, hy)); }
export const fitPerson = bbq.fitPerson;
export const PERSON_BOUNDS = bbq.PERSON_BOUNDS;

export function iconHTML(economy, state, id) {
  if (!owned(economy, state, id)) return '<span class="ii">❓</span>';
  return `<span class="item-art"><img data-item-art="${id}" src="${escapeHTML(art[id])}" alt="${escapeHTML(economy.ITEM_BY_ID[id].name)}"><span class="item-art-status" hidden>图示暂不可用</span></span>`;
}
export function descriptionHTML(economy, state, id) {
  return owned(economy, state, id) ? `<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">${escapeHTML(economy.ITEM_BY_ID[id].desc)}</small>` : '';
}
export function catalogHTML(economy, state, id) {
  if (!registered(economy, id)) return '';
  const item = economy.ITEM_BY_ID[id], collected = owned(economy, state, id);
  return `<div class="item ${collected ? '' : 'no'}" data-wearable-item="${id}"><span class="t">${types[id] === 'clothes' ? '衣服' : '帽子'}</span>${iconHTML(economy, state, id)}${collected ? escapeHTML(item.name) + descriptionHTML(economy, state, id) : '？？？<small class="preview-note" style="display:block;font-size:11px;line-height:1.5">' + escapeHTML(item.hint) + '</small>'}</div>`;
}
export function revealFlavorHTML(economy, state, id) {
  if (!owned(economy, state, id)) return '';
  const flavor = economy.ITEM_BY_ID[id].flavor;
  return typeof flavor === 'string' && flavor.trim() ? escapeHTML(flavor) + '<br>' : '';
}
/** Remove duplicate wearable previews only in QA; keep the unrelated decorative preview. */
export function remainingPreviewHTML(previews) {
  const items = previews.filter(item => !has(item.id));
  if (!items.length) return '';
  const labels = {clothes:'衣服', hat:'帽子', decor:'装饰'};
  return `<div class="sec-title">装饰图鉴预览（只展示，暂未放进盲盒）</div><div class="item-grid collectible-preview">${items.map(item => `<div class="item preview-only" data-preview-item="${escapeHTML(item.id)}"><span class="t">${labels[item.type] || ''}${item.hidden ? ' · 隐藏' : ''}</span><span class="item-art"><img data-item-art="${escapeHTML(item.id)}" src="${escapeHTML(item.src)}?v=collectibles-1" alt="${escapeHTML(item.alt)}" width="512" height="512" loading="lazy"><span class="item-art-status" hidden>图示暂不可用</span></span>${escapeHTML(item.name)}<small class="preview-note">${escapeHTML(item.shop)}${item.hidden ? ' · ' + escapeHTML(item.unlock) + '（条件未接入）' : ''}</small></div>`).join('')}</div><div class="note">外观收藏，不影响收益、概率和战斗。以上 ${items.length} 件装饰为图鉴预览，尚未加入盲盒、不能抽到。</div>`;
}

export const QAWearables8Display = Object.freeze({version:VERSION, IDS, has, owned, equipment, hasEquipment, look, drawClothes, drawHat, fitPerson, PERSON_BOUNDS, iconHTML, descriptionHTML, catalogHTML, revealFlavorHTML, remainingPreviewHTML});
export default QAWearables8Display;
