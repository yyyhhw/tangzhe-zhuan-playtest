/** Display and draft helpers only. No entropy, wallet, collection or match writes. */
export const RARITY_LABELS = Object.freeze({common:'普通',rare:'稀有',epic:'史诗',legendary:'传说'});
export const CLASS_LABELS = Object.freeze({neutral:'公共',warrior:'77 · 战士',mage:'阿宅 · 法师',paladin:'珍珠姐 · 圣骑士',warlock:'火箭 · 术士'});
export const TYPE_LABELS = Object.freeze({minion:'随从',spell:'法术',weapon:'武器'});
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function formatCoins(value) {
  if (!Number.isSafeInteger(value) || value < 0) return '未连接';
  if (value >= 100000000) return `${Number((value / 100000000).toFixed(2))}亿`;
  if (value >= 10000) return `${Number((value / 10000).toFixed(2))}万`;
  return value.toLocaleString('zh-CN');
}
export function copiesFor(snapshot,id) {
  const held = snapshot?.holdings?.[id];
  return {normal:Number.isSafeInteger(held?.normal) && held.normal >= 0 ? held.normal : 0,golden:Number.isSafeInteger(held?.golden) && held.golden >= 0 ? held.golden : 0};
}
export function canTransact(snapshot) {
  return snapshot?.connected === true && snapshot?.enabled === true && snapshot?.readOnly === false;
}
export function addToDraft(draft,card,snapshot) {
  const cards = [...draft.cards];
  if (!card || !['neutral',draft.classId].includes(card.classId)) return {...draft,cards,error:'只能加入公共牌和本职业牌。'};
  const owned = copiesFor(snapshot,card.cardId), count = cards.filter(id=>id === card.cardId).length;
  if (!Number.isSafeInteger(card.deckCap) || card.deckCap < 1 || count >= Math.min(card.deckCap,owned.normal + owned.golden)) return {...draft,cards,error:'已达到持有数量或同名牌上限。'};
  if (cards.length >= 30) return {...draft,cards,error:'牌组已经有 30 张牌。'};
  cards.push(card.cardId); return {...draft,cards,error:''};
}
export function inspectDraft(draft,catalog,snapshot) {
  const issues = [], counts = new Map(), policy = new Map(catalog.map(card=>[card.cardId,card]));
  if (draft.cards.length !== 30) issues.push(`还需 ${Math.max(0,30 - draft.cards.length)} 张，必须恰好 30 张。`);
  for (const id of draft.cards) counts.set(id,(counts.get(id) || 0) + 1);
  for (const [id,count] of counts) {
    const card = policy.get(id), held = copiesFor(snapshot,id);
    if (!card) issues.push('包含不在当前牌池的牌。');
    else if (!['neutral',draft.classId].includes(card.classId)) issues.push(`${card.name} 不属于当前职业。`);
    else if (!Number.isSafeInteger(card.deckCap) || count > card.deckCap || count > held.normal + held.golden) issues.push(`${card.name} 超出持有数量或同名牌上限。`);
  }
  return {valid:issues.length === 0,issues};
}
export function receiptSummary(receipt) {
  const o = receipt?.outcome;
  if (!o) return '';
  const action = {collected:'已加入牌册','upgraded-and-dusted':'已有普通卡已升为金色；重复卡按星尘结算',dusted:'同名牌已满，转为星尘',gilded:'历史普通卡已升级为金色',crafted:'普通卡已合成并加入牌册'}[o.action] || '已入账';
  const duplicate=['upgraded-and-dusted','dusted'].includes(o.action);
  const amount=value=>Number.isSafeInteger(value)&&value>=0?value:'—';
  const dust=duplicate||o.dustEarned>0?`产生 ${amount(o.dustEarned)} 星尘，实际入账 ${amount(o.dustCredited)}，丢弃 ${amount(o.dustDiscarded)}`:'';
  return [action,dust,o.dustSpent ? `消耗 ${o.dustSpent} 星尘` : ''].filter(Boolean).join(' · ');
}
/** Private MessagePort request correlation. A timeout never implies cancellation. */
export function createCollectionClient({send,onSnapshot=()=>{},timeoutMs=12000,setTimer=setTimeout,clearTimer=clearTimeout}) {
  // This nonce identifies UI requests across reloads. It never selects card outcomes.
  const sessionId = globalThis.crypto?.randomUUID?.() || null;
  let serial = 0, generation = 0; const pending = new Map();
  function request(command,body={}) {
    if (!sessionId) return Promise.reject(new Error('当前环境不支持安全请求编号，收藏保持只读。请使用新版浏览器。'));
    const requestId = `cu-${sessionId}-${generation}-${++serial}`;
    return new Promise((resolve,reject)=>{
      const timer = setTimer(()=>{pending.delete(requestId);reject(Object.assign(new Error('连接暂时中断，结果可能已入账。请刷新状态恢复，不要重复点击。'),{code:'uncertain'}));},timeoutMs);
      pending.set(requestId,{resolve,reject,timer});
      try { send({card:'collection',protocol:1,requestId,command,...body}); }
      catch (error) { clearTimer(timer);pending.delete(requestId);reject(error); }
    });
  }
  function receive(message) {
    if (!message || message.card !== 'collection-result' || message.protocol !== 1) return false;
    const p = pending.get(message.requestId); if (!p) return false;
    pending.delete(message.requestId);clearTimer(p.timer);
    if (message.snapshot) onSnapshot(message.snapshot);
    if (message.ok === false) p.reject(Object.assign(new Error(message.message || message.code || '当前操作未完成。'),{code:message.code,response:message}));
    else p.resolve(message);
    return true;
  }
  function reconnect() {
    generation++;
    for (const p of pending.values()) {clearTimer(p.timer);p.reject(Object.assign(new Error('连接已更新，请刷新状态恢复。'),{code:'reconnected'}));}
    pending.clear();
  }
  return {request,receive,reconnect};
}
