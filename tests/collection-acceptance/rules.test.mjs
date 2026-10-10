// 卡牌收集 规则层验收（Node，纯逻辑）。用例编号对应负向提纲 v3.3（N1–N9、G7）。
// 跑法：node tests/collection-acceptance/rules.test.mjs        （COLLECTION_IMPL=<模块路径> 可改指向）
//       ACCEPT_CONTROL=1 node ...  → 反向对照：每组故意写错 1 条期望，必须非零退出（G5）
// 接口名 / 存档格式只在 ADAPT 一处；实现换名字只改这里。缺接口时打印「缺接口」并 exit 1，不会空过。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(HERE, '..', '..');
const IMPL = process.env.COLLECTION_IMPL || path.join(ROOT, 'preview', 'cards', 'collection', 'collection.mjs');
const CONTROL = process.env.ACCEPT_CONTROL === '1';
const E = createRequire(import.meta.url)(path.join(ROOT, 'preview', 'economy.js'));   // 公用经营金币：state.coins / coinFrac

let M;
try { M = await import(pathToFileURL(path.resolve(IMPL)).href); }
catch (e) { console.log('✗ 缺接口：找不到收集规则模块 ' + IMPL + '（' + String(e.message).split('\n')[0] + '）'); console.log('passed 0, failed 0, 未跑'); process.exit(1); }
const NEED = ['validateConfig', 'initCollection', 'maxDupGain', 'overflowRisk', 'prepareDraw', 'commitDraw', 'recover', 'gild', 'setOverflowReminder'];
const miss = NEED.filter(k => typeof M[k] !== 'function');
if (miss.length) { console.log('✗ 缺接口：' + miss.join(' / ') + '（见 README「接口约定」）'); console.log('passed 0, failed 0, 未跑'); process.exit(1); }

// ---------- ADAPT ----------
const ADAPT = {
  // 存档：收藏挂在经营主存档 state.collection 上，金币就是经营的 state.coins（不另造货币）
  coins: (st) => st.coins, dust: (st) => st.collection.dust,
  owned: (st, id) => { const x = st.collection.owned[id] || {}; return { normal: x.normal || 0, gold: x.gold || 0 }; },
  suppress: (st) => !!st.collection.prefs.suppressOverflowWarn,
  ledger: (st) => st.collection.ledger, revision: (st) => st.collection.revision,
  // 凭据字段
  rc: (r) => ({ txId: r.txId, cardId: r.cardId, rarity: r.rarity, foil: r.foil, cost: r.coinCost, change: r.change, g: r.dust.gained, a: r.dust.credited, o: r.dust.overflow, committed: r.committed }),
  RECEIPT_FIELDS: ['txId', 'rulesVersion', 'poolVersion', 'baseRevision', 'commitRevision', 'cardId', 'rarity', 'foil', 'coinCost', 'change', 'dust', 'committed'],
  CODES: { conflict: 'CONFLICT', coins: 'INSUFFICIENT_COINS', confirm: 'NEED_OVERFLOW_CONFIRM', save: 'SAVE_FAILED' },
};
// ---------- 测试配置（数值是占位，只有单抽 500 万是杨总已定） ----------
const POOL = [
  { cardId: 'c-a', name: '甲', rarity: 'common' }, { cardId: 'c-a2', name: '甲', rarity: 'common' },   // 同名异 cardId（N1-1）
  { cardId: 'c-b', name: '乙', rarity: 'common' }, { cardId: 'r-a', name: '丙', rarity: 'rare' },
  { cardId: 'e-a', name: '丁', rarity: 'epic' }, { cardId: 'l-x', name: '戊', rarity: 'legendary' }, { cardId: 'l-y', name: '己', rarity: 'legendary' },
];
const CFG = Object.freeze({ cost: 5_000_000, dustMax: 1000, rulesVersion: 'accept-test', poolVersion: 'accept-pool-1', pool: POOL,
  weights: { common: 40, rare: 25, epic: 15, legendary: 20 }, goldRate: 0.3, directGoldRarities: ['legendary'],
  dupDust: { common: 5, rare: 20, epic: 100, legendary: 400 }, gildCost: { common: 50, rare: 100, epic: 400, legendary: 1600 } });

let pass = 0, fail = 0; const failed = [];
const ok = (c, id, msg) => { if (c) pass++; else { fail++; failed.push(id); console.log(`  ✗ ${id} ${msg}`); } };
const wrong = (c, id, msg) => ok(CONTROL ? c : !c, id + '[反向对照]', msg + (CONTROL ? '（ACCEPT_CONTROL：故意写错，应失败）' : ''));
const clone = (o) => JSON.parse(JSON.stringify(o));
const T0 = 1790000000000;
function state({ coins = 50_000_000, dust = 0, owned = {}, prefs = {} } = {}) {
  const st = E.migrate(null, T0).st; st.coins = coins; st.coinFrac = 0.25;
  st.collection = M.initCollection({ dust, owned, prefs }); return st;
}
let SEQ = 0;   // 每次找 seed 都配新的 txId，避免连续两抽撞同一 txId
function find(st, pred, cfg = CFG, from = 1) {
  const run = ++SEQ;
  for (let s = from; s < from + 20000; s++) { const d = M.prepareDraw(st, cfg, { txId: `tx-${run}-${s}`, seed: s }); if (pred(d.result)) return d; }
  throw new Error('找不到满足条件的 seed');
}
const is = (cardId, foil) => (r) => r.cardId === cardId && (!foil || r.foil === foil);
function rec() { const f = (s) => { f.n++; f.last = JSON.stringify(s); return true; }; f.n = 0; return f; }
function draw(st, pred, o = {}) { const d = find(st, pred); const sv = rec(); const r = M.commitDraw(st, CFG, d, { save: sv, ...o }); return { d, r, sv }; }
function g7(id, before, after, rc, expG) {
  ok(rc.g === expG, id, `G7 应得 g=${rc.g}，应为 ${expG}`);
  ok(rc.a === Math.min(expG, CFG.dustMax - before), id, `G7 实际入账 a=${rc.a}，应为 min(g, 上限−当前)=${Math.min(expG, CFG.dustMax - before)}`);
  ok(rc.o === rc.g - rc.a && rc.a + rc.o === rc.g, id, `G7 溢出 o=${rc.o} 应 = g−a`);
  ok(after === before + rc.a && after <= CFG.dustMax, id, `G7 抽后粉尘 ${after} 应 = 抽前 ${before} + a`);
}
function T(id, fn) { try { fn(); } catch (e) { ok(false, id, '运行出错：' + e.message); } }

console.log('== 配置');
T('CFG', () => { const v = M.validateConfig(CFG); ok(v && v.ok, 'CFG', '测试配置应合法 ' + JSON.stringify(v)); });
T('N9-11', () => {   // 非传说直接出金不在授权范围：配置被拒，或抽到的始终是普通
  const bad = { ...CFG, directGoldRarities: ['legendary', 'epic'] }, v = M.validateConfig(bad);
  if (v && v.ok) { const st = state(); let gold = 0; for (let s = 1; s < 3000; s++) { const r = M.prepareDraw(st, bad, { txId: 'g' + s, seed: s }).result; if (r.rarity !== 'legendary' && r.foil === 'gold') gold++; } ok(gold === 0, 'N9-11', `非传说直接出金 ${gold} 次`); }
  else ok(true, 'N9-11', '');
});
T('N9-10', () => {
  if (typeof M.probabilities !== 'function') return ok(false, 'N9-10', '缺接口 probabilities(cfg)：应返回 legendaryTotal / goldGivenLegendary / goldLegendaryOverall');
  const p = M.probabilities(CFG), L = 20 / 100;
  ok(Math.abs(p.legendaryTotal - L) < 1e-9 && Math.abs(p.goldGivenLegendary - 0.3) < 1e-9, 'N9-10', '传说总概率 / 条件概率 ' + JSON.stringify(p));
  ok(Math.abs(p.goldLegendaryOverall - p.legendaryTotal * p.goldGivenLegendary) < 1e-9, 'N9-10', '总体 = 传说总概率 × 条件概率 ' + JSON.stringify(p));
  const st = state(); let n = 0, gl = 0; for (let s = 1; s <= 20000; s++) { const r = M.prepareDraw(st, CFG, { txId: 'p' + s, seed: s }).result; n++; if (r.rarity === 'legendary' && r.foil === 'gold') gl++; }
  ok(Math.abs(gl / n - p.goldLegendaryOverall) < 0.01, 'N9-10', `固定 seed 2 万抽金传占比 ${(gl / n).toFixed(4)}，应≈${p.goldLegendaryOverall}`);
  wrong(Math.abs(p.goldLegendaryOverall - p.goldGivenLegendary) < 1e-9, 'N9-10', '把条件概率当成总体概率');
});

console.log('== N1 重复识别 / N9 金传 / G7');
T('N1-1', () => { const st = state({ owned: { 'c-a': { normal: 2 } } }); const { r } = draw(st, is('c-a2'));
  ok(r.ok && ADAPT.owned(r.state, 'c-a2').normal === 1 && ADAPT.owned(r.state, 'c-a').normal === 2 && ADAPT.dust(r.state) === 0, 'N1-1', '同名异 cardId 应作为新卡，粉尘不变'); });
T('N1-2', () => { const st = state({ owned: { 'c-a': { normal: 2 } } }); const { r } = draw(st, is('c-b'));
  ok(r.ok && ADAPT.owned(r.state, 'c-b').normal === 1 && ADAPT.dust(r.state) === 0, 'N1-2', '同稀有度不同 cardId 不化尘'); });
T('N1-3a', () => { const st = state({ owned: { 'c-b': { normal: 1 } } }); const { r } = draw(st, is('c-b'));
  ok(r.ok && ADAPT.owned(r.state, 'c-b').normal === 2 && ADAPT.dust(r.state) === 0 && ADAPT.rc(r.receipt).g === 0, 'N1-3a', '第 2 张入收藏、不化尘'); });
for (const [lbl, d0] of [['容量充足', 0], ['粉尘已满', 1000]]) T('N1-3b', () => {
  const st = state({ dust: d0, owned: { 'c-b': { normal: 2 } } }); const { r } = draw(st, is('c-b'), { confirmOverflow: true });
  ok(r.ok, 'N1-3b', lbl + ' 应能抽（满额允许继续）'); const o = ADAPT.owned(r.state, 'c-b'); ok(o.normal + o.gold === 2, 'N1-3b', lbl + ' 收藏仍为 2');
  g7('N1-3b', d0, ADAPT.dust(r.state), ADAPT.rc(r.receipt), CFG.dupDust.common);
  if (d0 === 0) wrong(ADAPT.dust(r.state) === d0, 'N1-3b', '容量充足却粉尘没涨');
});
T('N1-3c', () => { const st = state({ owned: { 'c-b': { normal: 1, gold: 1 } } }); const { r } = draw(st, is('c-b'));
  const o = ADAPT.owned(r.state, 'c-b'); ok(r.ok && o.normal === 1 && o.gold === 1, 'N1-3c', '1 普 + 1 金已满 2，第 3 张化尘 ' + JSON.stringify(o)); g7('N1-3c', 0, ADAPT.dust(r.state), ADAPT.rc(r.receipt), 5); });
T('N1-5', () => { let st = state({ dust: 50, owned: { 'c-b': { normal: 1 } } }); const g = M.gild(st, CFG, 'c-b', { save: rec() });
  ok(g.ok, 'N1-5', '镀金应成功'); st = g.state; let r = draw(st, is('c-b')).r; ok(r.ok && ADAPT.owned(r.state, 'c-b').gold === 1 && ADAPT.owned(r.state, 'c-b').normal === 1 && ADAPT.dust(r.state) === 0, 'N1-5', '镀金不重置计数：1→2 不化尘');
  r = draw(r.state, is('c-b')).r; ok(r.ok && ADAPT.rc(r.receipt).g === 5, 'N1-5', '再抽一次就化尘'); });
for (const [lbl, d0] of [['容量充足', 0], ['粉尘已满', 1000]]) {
  T('N9-1', () => { const st = state({ dust: d0, owned: { 'l-x': { normal: 2 } } }); const { r } = draw(st, is('l-x', 'gold'), { confirmOverflow: true });
    const o = ADAPT.owned(r.state, 'l-x'), rc = ADAPT.rc(r.receipt);
    ok(r.ok && o.normal === 1 && o.gold === 1, 'N9-1', lbl + ' 满 2 普抽金传：1 张升级为金，总数 2 ' + JSON.stringify(o));
    ok(rc.change === 'upgrade', 'N9-1', lbl + ' 凭据应有「升级」记录，实际 ' + rc.change); g7('N9-1', d0, ADAPT.dust(r.state), rc, 400);
    wrong(o.gold === 0, 'N9-1', '只化尘、没得到金色外观'); });
  T('N9-3', () => { const st = state({ dust: d0, owned: { 'l-x': { normal: 1, gold: 1 } } }); const { r } = draw(st, is('l-x', 'gold'), { confirmOverflow: true });
    const o = ADAPT.owned(r.state, 'l-x'), rc = ADAPT.rc(r.receipt);
    ok(r.ok && o.normal === 0 && o.gold === 2, 'N9-3', lbl + ' 1 普 1 金抽金传：剩余普通升级，变 2 金 ' + JSON.stringify(o));
    ok(rc.change === 'upgrade', 'N9-3', lbl + ' 凭据应有「升级」记录'); g7('N9-3', d0, ADAPT.dust(r.state), rc, 400); });
  for (const foil of ['gold', 'normal']) T('N9-4', () => { const st = state({ dust: d0, owned: { 'l-x': { gold: 2 } } }); const { r } = draw(st, is('l-x', foil), { confirmOverflow: true });
    const o = ADAPT.owned(r.state, 'l-x'); ok(r.ok && o.gold === 2 && o.normal === 0, 'N9-4', `${lbl} 2 金再抽${foil}：收藏不变、不降级 ` + JSON.stringify(o)); g7('N9-4', d0, ADAPT.dust(r.state), ADAPT.rc(r.receipt), 400); });
}
T('N9-2', () => { const st = state({ owned: { 'l-x': { normal: 1 } } }); const { r } = draw(st, is('l-x', 'gold'));
  const o = ADAPT.owned(r.state, 'l-x'); ok(r.ok && o.normal === 1 && o.gold === 1 && ADAPT.dust(r.state) === 0, 'N9-2', '1 普抽金传 → 1 普 1 金，不化尘 ' + JSON.stringify(o)); });
T('N9-5', () => { const { r } = draw(state(), is('l-y', 'gold')); const rc = ADAPT.rc(r.receipt);
  ok(r.ok && rc.rarity === 'legendary' && rc.foil === 'gold' && ADAPT.owned(r.state, 'l-y').gold === 1, 'N9-5', '凭据带 legendary + gold，收藏 1 金'); });
T('N9-12', () => { for (const [own, foil] of [[{ normal: 2 }, 'normal'], [{ normal: 1, gold: 1 }, 'normal'], [{ gold: 2 }, 'gold'], [{ normal: 2 }, 'gold']]) for (const d0 of [0, 1000]) {
  const { r } = draw(state({ dust: d0, owned: { 'l-x': own } }), is('l-x', foil), { confirmOverflow: true }); const rc = ADAPT.rc(r.receipt);
  ok(r.ok && rc.g === 400 && (rc.a > 0 || d0 === 1000), 'N9-12', `${JSON.stringify(own)} 抽${foil} 粉尘${d0}：g=${rc.g} a=${rc.a}（不允许静默零粉尘）`); } });
T('N7-3', () => { const { r } = draw(state(), is('r-a')); ok(r.ok && ADAPT.owned(r.state, 'r-a').normal === 1, 'N7-3', '抽到的卡进收藏，不被丢弃'); });

console.log('== N2 镀金');
T('N2-2', () => { const st = state({ dust: 50, owned: { 'c-b': { normal: 1 } } }); const g = M.gild(st, CFG, 'c-b', { save: rec() }); const o = ADAPT.owned(g.state, 'c-b');
  ok(g.ok && o.normal + o.gold === 1 && o.gold === 1 && ADAPT.dust(g.state) === 0, 'N2-2', '镀金数量不变，只改外观'); });
for (const [id, st, card] of [['N2-3', state({ dust: 49, owned: { 'c-b': { normal: 1 } } }), 'c-b'], ['N2-4', state({ dust: 500, owned: { 'c-b': { gold: 1 } } }), 'c-b'], ['N2-5', state({ dust: 500 }), 'l-y']]) T(id, () => {
  const before = JSON.stringify(st), sv = rec(); let n = 0; for (let i = 0; i < 5; i++) if (M.gild(st, CFG, card, { save: sv }).ok) n++;
  ok(n === 0 && sv.n === 0 && JSON.stringify(st) === before, id, `不可镀金：成功 ${n} 次、写档 ${sv.n} 次`); });

console.log('== N3 粉尘溢出确认');
T('N3-1', () => { ok(M.maxDupGain(CFG) === 400, 'N3-1', 'MAX_DUP_GAIN 应含金传重复粉尘 400，实际 ' + M.maxDupGain(CFG));
  const st = state({ dust: 600 }); ok(!M.overflowRisk(st, CFG), 'N3-1', '剩余 = MAX_DUP_GAIN 边界不弹'); const { r } = draw(st, () => true); ok(r.ok, 'N3-1', '无风险直接抽'); });
T('N3-2', () => { for (const d0 of [601, 1000]) { const st = state({ dust: d0 }), before = JSON.stringify(st), d = find(st, () => true), sv = rec();
  ok(M.overflowRisk(st, CFG), 'N3-2', `粉尘 ${d0} 应有溢出风险`); ok(JSON.stringify(st) === before, 'N3-2', 'prepareDraw 不改状态');
  const r = M.commitDraw(st, CFG, d, { save: sv }); ok(!r.ok && r.code === ADAPT.CODES.confirm && sv.n === 0 && JSON.stringify(st) === before, 'N3-2', `未确认不能提交、零写入：${r.code} 写 ${sv.n}`);
  wrong(r.ok, 'N3-2', '未确认就提交'); } });
T('N3-3/4', () => { const st = state({ dust: 900 }), before = JSON.stringify(st); M.prepareDraw(st, CFG, { txId: 'cancel', seed: 7 });
  ok(JSON.stringify(st) === before && !ADAPT.suppress(st) && !ADAPT.ledger(st).cancel, 'N3-3', '取消：不扣费、无 txId、偏好不变'); });
T('N3-5', () => { const { r } = draw(state({ dust: 900 }), () => true, { confirmOverflow: true });
  ok(r.ok && ADAPT.coins(r.state) === 45_000_000 && !ADAPT.suppress(r.state), 'N3-5', '不勾选继续：扣 1 次、偏好仍为提醒');
  const d2 = find(r.state, () => true, CFG, 30000), r2 = M.commitDraw(r.state, CFG, d2, { save: rec() }); ok(!r2.ok && r2.code === ADAPT.CODES.confirm, 'N3-5', '下次仍要确认'); });
T('N3-6', () => { const st = state({ dust: 900 }), d = find(st, () => true), sv = rec(); const r = M.commitDraw(st, CFG, d, { save: sv, confirmOverflow: true, suppressOverflowWarn: true });
  ok(r.ok && ADAPT.suppress(r.state) && sv.n >= 1 && ADAPT.suppress(JSON.parse(sv.last)), 'N3-6', '勾选继续：偏好和抽卡同一次写档');
  const re = JSON.parse(sv.last), d2 = find(re, () => true, CFG, 30000), r2 = M.commitDraw(re, CFG, d2, { save: rec() }); ok(r2.ok, 'N3-6', '重读存档后有风险直接抽');
  const st3 = state({ dust: 900 }), r3 = M.commitDraw(st3, CFG, find(st3, () => true), { save: () => { throw new Error('quota'); }, confirmOverflow: true, suppressOverflowWarn: true });
  ok(!r3.ok && !ADAPT.suppress(st3), 'N3-6', '写档失败不留偏好'); });
T('N3-7', () => { const st = state({ dust: 900, prefs: { suppressOverflowWarn: true } }), r = M.setOverflowReminder(st, true, { save: rec() });
  ok(r.ok && !ADAPT.suppress(r.state) && ADAPT.coins(r.state) === ADAPT.coins(st) && ADAPT.dust(r.state) === 900, 'N3-7', '恢复提醒不扣费不改粉尘');
  const r2 = M.commitDraw(r.state, CFG, find(r.state, () => true), { save: rec() }); ok(!r2.ok && r2.code === ADAPT.CODES.confirm, 'N3-7', '恢复后再弹'); });
T('N3-9', () => { const st = state({ dust: 900, owned: { 'l-x': { normal: 2 } } }); const { r } = draw(st, is('l-x', 'normal'), { confirmOverflow: true }); const rc = ADAPT.rc(r.receipt);
  ok(r.ok && ADAPT.dust(r.state) === 1000 && rc.g === 400 && rc.a === 100 && rc.o === 300, 'N3-9', `部分溢出 g/a/o=${rc.g}/${rc.a}/${rc.o}，应 400/100/300`);
  wrong(rc.a === 0, 'N3-9', '整笔粉尘被丢'); });
T('N3-10', () => { const st = state({ dust: 1000 }); const { r } = draw(st, is('c-a'), { confirmOverflow: true });
  ok(r.ok && ADAPT.owned(r.state, 'c-a').normal === 1 && ADAPT.dust(r.state) === 1000, 'N3-10', '粉尘已满，新卡照常到账'); });
T('N3-11', () => { if (typeof M.commitBatch !== 'function') console.log('  - N3-11 跳过：未实现批量抽（首版不做批量，待确认 6）'); });
T('N3-12/N4-6', () => { const st = state({ dust: 900 }), d = find(st, () => true); const other = M.gild(state({ dust: 900, owned: { 'c-b': { normal: 1 } } }), CFG, 'c-b', {}).state;
  other.coins = st.coins; const sv = rec(), r = M.commitDraw(other, CFG, d, { save: sv, confirmOverflow: true });
  ok(!r.ok && r.code === ADAPT.CODES.conflict && sv.n === 0, 'N3-12', `旧 revision 提交应冲突、零写入：${r.code}`); wrong(r.ok, 'N3-12', '用旧状态提交'); });

console.log('== N4 抽卡事务 / 公用金币');
T('N4-1', () => { const st = state({ coins: 4_999_999 }), before = JSON.stringify(st), sv = rec(), r = M.commitDraw(st, CFG, find(st, () => true), { save: sv });
  ok(!r.ok && r.code === ADAPT.CODES.coins && sv.n === 0 && JSON.stringify(st) === before, 'N4-1', `差 1 金币不能抽、零写入：${r.code}`); });
T('COIN', () => { const st = state({ coins: 5_000_000 }), shops = JSON.stringify(st.shops), { r } = draw(st, () => true);
  ok(r.ok && ADAPT.coins(r.state) === 0 && r.state.coinFrac === 0.25 && ADAPT.rc(r.receipt).cost === 5_000_000, 'COIN', '单抽扣公用经营金币 500 万，零头不动');
  ok(JSON.stringify(r.state.shops) === shops && !('cardCoins' in r.state.collection), 'COIN', '只动金币和收藏，不另造货币');
  wrong(ADAPT.coins(r.state) === 5_000_000 - 100, 'COIN', '按作废的 100 金币/抽扣'); });
T('N4-2/N3-14', () => { const st = state({ dust: 900 }), before = JSON.stringify(st), d = find(st, () => true);
  const r1 = M.commitDraw(st, CFG, d, { save: () => { throw new Error('QuotaExceededError'); }, confirmOverflow: true });
  ok(!r1.ok && JSON.stringify(st) === before, 'N4-2', '写档失败：金币收藏粉尘不变');
  const r2 = M.commitDraw(st, CFG, d, { save: rec(), confirmOverflow: true }), a = ADAPT.rc(r2.receipt);
  ok(r2.ok && a.txId === d.txId && a.cardId === d.result.cardId && a.foil === d.result.foil, 'N4-2', '重试：同一 txId 同一结果，不重新随机');
  const r3 = M.commitDraw(st, CFG, d, { save: rec(), confirmOverflow: true }); ok(JSON.stringify(ADAPT.rc(r3.receipt)) === JSON.stringify(a), 'N3-14', '再重试截断量也一样'); });
T('N4-4/N3-13', () => { const st = state(), d = find(st, () => true), r1 = M.commitDraw(st, CFG, d, { save: rec() }), sv = rec(), r2 = M.commitDraw(r1.state, CFG, d, { save: sv });
  const s2 = r2.ok ? r2.state : r1.state;
  ok(ADAPT.coins(s2) === 45_000_000 && Object.keys(ADAPT.ledger(s2)).length === 1 && JSON.stringify(ADAPT.owned(s2, d.result.cardId)) === JSON.stringify(ADAPT.owned(r1.state, d.result.cardId)), 'N4-4', '同 txId 重放只到账 1 次');
  wrong(ADAPT.coins(s2) === 40_000_000, 'N4-4', '重放扣了 2 次'); });
T('N4-4b', () => { const st = state(), d = find(st, () => true), r1 = M.commitDraw(st, CFG, d, { save: rec() });   // 同 txId 带当前 revision 重发：也必须靠 txId 去重
  const r2 = M.commitDraw(r1.state, CFG, { ...d, baseRevision: ADAPT.revision(r1.state) }, { save: rec() }), s2 = r2.ok ? r2.state : r1.state;
  ok(ADAPT.coins(s2) === 45_000_000 && Object.keys(ADAPT.ledger(s2)).length === 1, 'N4-4', '同 txId 即使 revision 对得上也只到账 1 次'); });
T('N4-5', () => { const st = state(), dA = M.prepareDraw(st, CFG, { txId: 'A', seed: 3 }), dB = M.prepareDraw(st, CFG, { txId: 'B', seed: 4 });
  const rA = M.commitDraw(st, CFG, dA, { save: rec() }), sv = rec(), rB = M.commitDraw(rA.state, CFG, dB, { save: sv });
  ok(rA.ok && !rB.ok && rB.code === ADAPT.CODES.conflict && sv.n === 0 && ADAPT.coins(rA.state) === 45_000_000, 'N4-5', '两标签同一基线只成功一边'); });
T('N4-3/N4-8', () => { const st = state(), d = find(st, () => true), sv = rec(), r = M.commitDraw(st, CFG, d, { save: sv }), reopened = JSON.parse(sv.last);
  const rv = M.recover(reopened, d.txId); ok(rv && rv.status === 'committed' && rv.receipt.txId === d.txId && rv.receipt.cardId === d.result.cardId, 'N4-8', '重开按同一 txId 恢复为已提交');
  const again = M.commitDraw(reopened, CFG, d, { save: rec() }), s2 = again.ok ? again.state : reopened;
  ok(ADAPT.coins(s2) === 45_000_000 && Object.keys(ADAPT.ledger(s2)).length === 1, 'N4-3', '刷新 / 切后台重开后再提交不重复扣费');
  ok(M.recover(state(), 'nope').status === 'absent', 'N4-8', '未提交的 txId 报 absent'); });
T('N4-10', () => { const { r } = draw(state(), () => true); const miss = ADAPT.RECEIPT_FIELDS.filter(k => !(k in r.receipt));
  ok(miss.length === 0 && r.receipt.committed === true, 'N4-10', '凭据缺字段：' + miss.join(',')); });

console.log(`\npassed ${pass}, failed ${fail}${CONTROL ? '（ACCEPT_CONTROL=1：反向对照，应非零退出）' : ''}`);
if (fail) console.log('失败编号：' + [...new Set(failed)].join(' '));
process.exit(fail ? 1 : 0);
