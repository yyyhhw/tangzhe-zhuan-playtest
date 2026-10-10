// 测试侧适配层：把验收脚本的 9 个函数映射到熊大骨架 card-collection-model-v1 的 Model（quote + reduce 命令流）。
// 不改骨架、不改断言。钱包为测试模拟（state.coins），用例假 cardId 一一映射到骨架目录真实 cardId。
// 骨架路径：SKELETON_DIR（默认 /home/ubuntu/qa/collection/skel/card-collection-model-v1）
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const DIR = process.env.SKELETON_DIR || '/home/ubuntu/qa/collection/skel/card-collection-model-v1';
const imp = f => import(pathToFileURL(path.join(DIR, 'src', f)).href);
const { createFixtureModel } = await imp('model.mjs');
const { validateConfig: skValidate } = await imp('config.mjs');
const { PLAYABLE_CARDS, CATALOG_VERSION } = await imp('catalog.mjs');

const toReal = new Map(), toFake = new Map(); let next = 0;
const real = id => { if (!toReal.has(id)) { const r = PLAYABLE_CARDS[next++].cardId; toReal.set(id, r); toFake.set(r, id); } return toReal.get(id); };
const fake = r => toFake.get(r) ?? r;
const RAR = ['common', 'rare', 'epic', 'legendary'];
function skConfig(cfg) {
  cfg.pool.forEach(c => real(c.cardId));
  const sum = RAR.reduce((s, r) => s + (cfg.weights[r] || 0), 0), scale = 10000;
  return { schemaVersion: 1, configVersion: 'accept-' + cfg.rulesVersion, purpose: 'test-fixture', catalogVersion: CATALOG_VERSION,
    poolVersion: cfg.poolVersion, drawPriceGold: cfg.cost, dustBalanceCap: cfg.dustMax, probabilityScale: scale,
    goldenLegendaryWeight: Math.round(cfg.goldRate * scale), goldDuplicatePolicy: 'upgrade-normal-and-dust',
    rarities: RAR.map(id => ({ id, weight: Math.round((cfg.weights[id] || 0) * scale / sum), duplicateDust: cfg.dupDust[id], gildDustCost: cfg.gildCost[id] })),
    pool: cfg.pool.map(c => ({ cardId: real(c.cardId), rarity: c.rarity })) };
}
const models = new Map();
function model(cfg) { const k = JSON.stringify(cfg); if (!models.has(k)) models.set(k, createFixtureModel(skConfig(cfg))); return models.get(k); }
const genesisOf = col => ({ holdings: Object.fromEntries(Object.entries(col.owned).filter(([, x]) => x.normal + x.gold > 0).map(([k, x]) => [real(k), { normal: x.normal, golden: x.gold }])),
  dust: col.dust, preferences: { suppressOverflowWarning: !!col.prefs.suppressOverflowWarn } });
const skOf = (col, m) => col.sk ?? m.createState(genesisOf(col));
const CHANGE = { 'upgraded-and-dusted': 'upgrade', dusted: 'dust' };
function receiptOf(sk, tx) {
  const o = tx.receipt.outcome, begin = sk.events.find(e => e.txId === tx.txId && e.type === 'BEGIN');
  return { txId: tx.txId, rulesVersion: sk.configVersion, poolVersion: JSON.parse(sk.configCanonical).poolVersion,
    baseRevision: begin.expectedRevision, commitRevision: sk.events.filter(e => e.txId === tx.txId).at(-1).expectedRevision + 1,
    cardId: fake(o.cardId), rarity: o.rarity, foil: o.finish === 'golden' ? 'gold' : 'normal', coinCost: tx.receipt.goldSpent,
    change: CHANGE[o.action] ?? (o.before.normal + o.before.golden ? 'add' : 'new'),
    dust: { gained: o.dustEarned, credited: o.dustCredited, overflow: o.dustDiscarded }, committed: true };
}
function view(sk) {
  const owned = {}; for (const [k, x] of Object.entries(sk.holdings)) owned[fake(k)] = { normal: x.normal, gold: x.golden };
  const ledger = {}; for (const tx of Object.values(sk.transactions)) if (tx.stage === 'committed' && tx.request.kind === 'draw') ledger[tx.txId] = receiptOf(sk, tx);
  return { sk, dust: sk.dust, owned, prefs: { suppressOverflowWarn: sk.preferences.suppressOverflowWarning }, ledger, revision: sk.revision };
}
const step = (m, s, type, txId, extra = {}) => m.reduce(s, { type, eventId: `${txId}:${type}`, txId, expectedRevision: s.revision, ...extra });
const CODE = e => /REVISION_CONFLICT|TX_LOCK_OR_COLLECTION_CONFLICT|COLLECTION_CONFLICT|ACTIVE_TRANSACTION_PENDING/.test(e.message) ? 'CONFLICT'
  : /OVERFLOW_CONFIRMATION_REQUIRED|UNCONSENTED_DUST_OVERFLOW/.test(e.message) ? 'NEED_OVERFLOW_CONFIRM' : /INSUFFICIENT_DUST|NO_NORMAL|NOT_IN_CONFIGURED/.test(e.message) ? 'CANNOT_GILD' : e.message;
function persist(st, col, opts) {
  const ns = { ...st, collection: col };
  try { if (opts?.save && opts.save(ns) === false) return null; } catch { return null; }
  return ns;
}
function rng(seed) { let a = (Math.imul(seed >>> 0, 2654435761) ^ 0x9e3779b9) >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function validateConfig(cfg) { try { createFixtureModel(skConfig(cfg)); skValidate(skConfig(cfg)); return { ok: true, errors: [] }; } catch (e) { return { ok: false, errors: [e.message] }; } }
export function initCollection(f) {
  const owned = Object.fromEntries(Object.entries(f.owned || {}).map(([k, x]) => [k, { normal: x.normal || 0, gold: x.gold || 0 }]));
  return { sk: null, dust: f.dust || 0, owned, prefs: { suppressOverflowWarn: !!f.prefs?.suppressOverflowWarn }, ledger: {}, revision: 0 };
}
export const maxDupGain = cfg => Math.max(...Object.values(cfg.dupDust));   // 适配层按配置计算；骨架无此函数
export function overflowRisk(st, cfg) { const m = model(cfg); return m.quote(skOf(st.collection, m), { kind: 'draw' }).maximumDustDiscarded > 0; }
export function prepareDraw(st, cfg, { txId, seed }) {
  const m = model(cfg), sk = skOf(st.collection, m), c = m.config, u = rng(seed);
  const rt = Math.floor(u() * c.probabilityScale); let cur = 0, rar; for (const r of c.rarities) { cur += r.weight; if (rt < cur) { rar = r.id; break; } }
  const tickets = { rarity: rt, card: Math.floor(u() * c.pool.filter(p => p.rarity === rar).length), golden: Math.floor(u() * c.probabilityScale) };
  let s = step(m, sk, 'BEGIN', txId, { request: { kind: 'draw' } });
  s = step(m, s, 'DECIDE', txId, { decision: 'continue', allowDustOverflow: true, suppressFutureOverflowWarnings: false });
  s = step(m, s, 'SELECT', txId, { tickets }); const o = s.transactions[txId].outcome;
  return { txId, seed, tickets, baseRevision: sk.revision, result: { cardId: fake(o.cardId), rarity: o.rarity, foil: o.finish === 'golden' ? 'gold' : 'normal' } };
}
export function commitDraw(st, cfg, d, opts = {}) {
  const m = model(cfg), sk = skOf(st.collection, m), done = sk.transactions[d.txId];
  if (done?.stage === 'committed') return { ok: true, duplicate: true, state: st, receipt: view(sk).ledger[d.txId] };
  if (d.baseRevision !== sk.revision) return { ok: false, code: 'CONFLICT' };
  const q = m.quote(sk, { kind: 'draw' });
  if (q.requiresOverflowConfirmation && !opts.confirmOverflow) return { ok: false, code: 'NEED_OVERFLOW_CONFIRM' };
  if (st.coins < cfg.cost) return { ok: false, code: 'INSUFFICIENT_COINS' };   // 模拟钱包
  let s;
  try {
    const risky = q.maximumDustDiscarded > 0;
    s = step(m, sk, 'BEGIN', d.txId, { request: { kind: 'draw' } });
    s = step(m, s, 'DECIDE', d.txId, { decision: 'continue', allowDustOverflow: risky && (!!opts.confirmOverflow || sk.preferences.suppressOverflowWarning),
      suppressFutureOverflowWarnings: !!opts.suppressOverflowWarn && q.requiresOverflowConfirmation });
    s = step(m, s, 'SELECT', d.txId, { tickets: d.tickets });
    s = step(m, s, 'RECORD_DEBIT', d.txId, { walletReceipt: { schemaVersion: 1, debitId: 'debit:' + d.txId, intent: m.walletIntent(s, d.txId), walletRevision: 1 } });
    s = step(m, s, 'COMMIT', d.txId);
  } catch (e) { return { ok: false, code: CODE(e) }; }
  const col = view(s), ns = persist({ ...st, coins: st.coins - cfg.cost }, col, opts);
  if (!ns) return { ok: false, code: 'SAVE_FAILED' };
  return { ok: true, state: ns, receipt: col.ledger[d.txId] };
}
export function recover(st, txId) { const r = st.collection.sk && view(st.collection.sk).ledger[txId]; return r ? { status: 'committed', receipt: r } : { status: 'absent' }; }
export function gild(st, cfg, cardId, opts = {}) {
  const m = model(cfg), sk = skOf(st.collection, m), txId = `gild-${sk.revision}-${cardId}`.replace(/[^A-Za-z0-9._:-]/g, '_'); let s;
  try {
    s = step(m, sk, 'BEGIN', txId, { request: { kind: 'gild', cardId: real(cardId) } });
    s = step(m, s, 'DECIDE', txId, { decision: 'continue', allowDustOverflow: false, suppressFutureOverflowWarnings: false });
    s = step(m, s, 'COMMIT', txId);
  } catch (e) { return { ok: false, code: CODE(e) }; }
  const ns = persist(st, view(s), opts); return ns ? { ok: true, state: ns } : { ok: false, code: 'SAVE_FAILED' };
}
// 骨架没有「设置里恢复提醒」命令（偏好只能经 DECIDE 打开）——如实缺接口。
export function setOverflowReminder() { throw new Error('缺接口：骨架无恢复提醒命令'); }
// probabilities 不导出：骨架无此函数，N9-10 按缺接口判。
