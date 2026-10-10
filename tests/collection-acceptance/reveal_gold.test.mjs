// REVEAL-GOLD.md + DUST-GAP.md 可跑骨架（只测侧，纯模型层）。
// 用法：SKEL=<骨架包根目录> node reveal_gold.test.mjs
// 退出码：0 全过且无跳过；1 有失败；3 无失败但有跳过（缺接口/待拍/需界面），不算通过。
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const SKEL = resolve(process.env.SKEL || '/home/ubuntu/qa/collection/skel11/card-collection-model-v1.1');
let M, F;
try {
  M = await import(pathToFileURL(`${SKEL}/src/model.mjs`));
  F = await import(pathToFileURL(`${SKEL}/test/fixture.mjs`));
} catch (e) { console.log(`✗ 缺实现：无法加载骨架 ${SKEL}（${e.message}）\npassed 0, failed 0, skipped 0, 未跑`); process.exit(1); }
const { createFixtureModel } = M, { fixtureConfig, genesis, begin, decide, step, ticketsFor, receipt, draw } = F;
const config = fixtureConfig(), model = createFixtureModel(config);
const L = config.pool.find(c => c.rarity === 'legendary').cardId;
const init = (h = {}, d = 0) => model.createState(genesis(h, d));
const snap = s => JSON.stringify(s), hv = h => `${h?.normal ?? 0}/${h?.golden ?? 0}`, json = s => JSON.parse(JSON.stringify(s));
let pass = 0, fail = 0, skip = 0;
const ok = (c, id, msg) => { c ? pass++ : fail++; console.log(`${c ? '✓' : '✗'} ${id} ${msg}`); };
const sk = (id, msg, dep) => { skip++; console.log(`⊘ ${id} 跳过：${msg}【依赖：${dep}】`); };
const code = fn => { try { fn(); return null; } catch (e) { return e; } };
const errIs = (e, re) => !!e && re.test(e.message);

// R1 提交后才揭晓
{
  let s = decide(model, begin(model, init()));
  ok(errIs(code(() => model.publicResult(s, 'tx-1')), /NO_COMMITTED_REVEAL/), 'R1-1a', 'confirmed 阶段 publicResult 拒绝');
  s = step(model, s, 'SELECT', { tickets: ticketsFor(config, L, true) });
  ok(errIs(code(() => model.publicResult(s, 'tx-1')), /NO_COMMITTED_REVEAL/), 'R1-1b', 'selected 阶段（已选卡未扣款）拒绝');
  s = step(model, s, 'RECORD_DEBIT', { walletReceipt: receipt(model, s) });
  ok(errIs(code(() => model.publicResult(s, 'tx-1')), /NO_COMMITTED_REVEAL/), 'R1-1c', 'debited 阶段（已扣款未提交）拒绝');
  const done = step(model, s, 'COMMIT', {});
  const a = model.publicResult(done, 'tx-1'), b = model.publicResult(model.restore(json(done)), 'tx-1');
  ok(snap(a) === snap(b) && a.finish === 'golden', 'R1-3', '刷新（restore）后同 txId 揭晓结果逐字一致、不重抽');
}
sk('R1-2', '写档 QuotaExceeded 后不揭晓', 'G4 CardHost/真实存档（纯模型无存储层）');
sk('R1-4', '回执落盘先于卡面可见', '收集页 UI + smoke_g7（界面层）');

// R2 金色升级 + 仍有普通（A 方案现行规则）
const remain = r => r && (r.after?.normal ?? r.remainingNormal);
for (const [id, before, want] of [['R2-1', { normal: 2, golden: 0 }, { normal: 1, golden: 1 }], ['R2-2', { normal: 1, golden: 1 }, { normal: 0, golden: 2 }]]) {
  const s = draw(model, init({ [L]: before }), L, true), r = model.publicResult(s, 'tx-1');
  ok(hv(s.holdings[L]) === hv(want) && r.action === 'upgraded-and-dusted' && r.dustEarned === 400,
    `${id}a`, `${before.normal}普${before.golden}金+金传 → ${want.normal}普${want.golden}金，upgraded-and-dusted，粉尘 400`);
  if (remain(r) === undefined) sk(`${id}b`, `publicResult 返回剩余普通数（期望 ${want.normal}）`, '熊大补 publicResult.after / remainingNormal');
  else ok(remain(r) === want.normal, `${id}b`, `publicResult 剩余普通 = ${want.normal}`);
}
sk('R2-B', '1普+金传 → 1金、不写「仍有普通」', '待拍①组牌传说限1（B 版骨架）');

// R3 两金再中只化尘
for (const [id, gold] of [['R3-1', true], ['R3-2', false]]) {
  const s = draw(model, init({ [L]: { normal: 0, golden: 2 } }), L, gold), r = model.publicResult(s, 'tx-1');
  ok(r.action === 'dusted' && hv(s.holdings[L]) === '0/2' && r.dustEarned === 400,
    id, `2金+${gold ? '金' : '普'}传 → dusted，仍 2 金不降级，粉尘 400`);
}

// D0 镀金拒绝（两版共用）
const gild = (s, cardId = L, m = model) => begin(m, s, { kind: 'gild', cardId });
const rejectNoWrite = (id, s, re, msg, m) => { const b = snap(s), e = code(() => gild(s, L, m)); ok(errIs(e, re) && snap(s) === b, id, msg); return e; };
{
  const sub = fixtureConfig(); sub.pool = sub.pool.filter(c => c.cardId !== L || false);
  let m2 = null; try { m2 = createFixtureModel(sub); } catch {}
  if (m2) rejectNoWrite('D0-1a', m2.createState(genesis({ [L]: { normal: 1, golden: 0 } }, 3200)), /CARD_NOT_IN_CONFIGURED_POOL/, '不在卡池 → 拒绝且状态不变', m2);
  else sk('D0-1a', '不在卡池', '构造子卡池夹具失败');
  const e1 = rejectNoWrite('D0-1b', init({}, 3200), /NO_NORMAL_COPY_TO_GILD/, '没抽到 → 拒绝且状态不变');
  const e2 = rejectNoWrite('D0-1c', init({ [L]: { normal: 0, golden: 2 } }, 3200), /NO_NORMAL_COPY_TO_GILD/, '已全金 → 拒绝且状态不变');
  const e3 = rejectNoWrite('D0-1d', init({ [L]: { normal: 1, golden: 0 } }, 1599), /INSUFFICIENT_DUST/, '粉尘不足 → 拒绝且状态不变');
  const busy = decide(model, begin(model, init({ [L]: { normal: 1, golden: 0 } }, 3200)));
  const b = snap(busy), e4 = code(() => begin(model, busy, { kind: 'gild', cardId: L }, 'tx-2'));
  ok(errIs(e4, /ACTIVE_TRANSACTION_PENDING/) && snap(busy) === b, 'D0-1e', '有未完交易 → 拒绝且状态不变');
  ok(errIs(e3, /INSUFFICIENT_DUST/), 'D0-3', '粉尘 = 镀金价 − 1 → INSUFFICIENT_DUST');
  let s = decide(model, gild(init({ [L]: { normal: 1, golden: 0 } }, 1600)));
  s = step(model, s, 'COMMIT', {});
  ok(s.dust === 0 && hv(s.holdings[L]) === '0/1', 'D0-2', '粉尘 = 镀金价 → 可镀，镀后粉尘 0');
  if (e3 && ['cost', 'have', 'short'].every(k => k in e3)) ok(e3.short === 1, 'G-1', '拒绝带回差额 short = 1');
  else sk('G-1', '拒绝时带回 {cost,have,short}', '熊大补 gildQuote（DUST-GAP 待熊大补 G-1）');
  if (e1 && e2 && e1.message !== e2.message) ok(true, 'G-2', '「没抽到」与「已全金」错误码已区分');
  else sk('G-2', '「没抽到」与「已全金」分码', '熊大补 gildQuote（DUST-GAP 待熊大补 G-2）');
}
for (const id of ['D0-4', 'D0-5', 'D0-6', 'DA-1..6', 'DB-1..3']) sk(id, '界面文案/标识断言', `收集页 UI（ui_collection.py）${id.startsWith('D0-6') || id.startsWith('DA') || id.startsWith('DB') ? ' + 待拍②差额写/不写' : ''}`);

console.log(`\npassed ${pass}, failed ${fail}, skipped ${skip}（模拟夹具，≠ G4/G7 通过）`);
process.exit(fail ? 1 : skip ? 3 : 0);
