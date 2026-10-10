// 钱包桥接负向验收（Node，无浏览器）。对应熊二排工六项 + 熊大桥接草案 card-wallet-bridge-review-v1（7cc395d3…）。
// 跑法：WALLET_BRIDGE_IMPL=<实现模块> node tests/wallet-bridge/bridge.test.mjs   （默认 preview/cards/collection/wallet-bridge.mjs）
// 无实现 → 「缺实现」rc=1；任一条不过 → rc=1。只用内存 Storage / Web Locks 替身和隔离测试 key，不碰 preview/正式存档。
import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
const IMPL = path.resolve(process.env.WALLET_BRIDGE_IMPL || 'preview/cards/collection/wallet-bridge.mjs');
let P = 0, F = 0; const failed = [];
const ok = (c, id, m) => { if (c) P++; else { F++; failed.push(id); console.log(`  ✗ ${id} ${m}`); } };
if (!fs.existsSync(IMPL)) { console.log(`✗ 缺实现：找不到钱包桥模块 ${IMPL}（见 README「接口约定」）`); console.log('passed 0, failed 0, 未跑'); process.exit(1); }
const mod = await import(pathToFileURL(IMPL).href);
if (typeof mod.createWalletBridge !== 'function') { console.log('✗ 缺实现：未导出 createWalletBridge'); console.log('passed 0, failed 0, 未跑'); process.exit(1); }
const COST = 5_000_000, KEY = 'qa-wallet-bridge-test', PROD = 'tangzhe-save', PREVIEW = 'tangzhe-preview-save';
function mkStorage(seed = {}) {
  const m = new Map(Object.entries(seed)), log = [], s = { log, failNext: null, held: () => false };
  s.getItem = k => m.has(k) ? m.get(k) : null;
  s.setItem = (k, v) => { if (s.failNext === 'before') { s.failNext = null; throw new Error('QA quota'); }
    log.push([k, s.held()]); m.set(k, String(v)); if (s.failNext === 'after') { s.failNext = null; throw new Error('QA crash after write'); } };
  s.removeItem = k => { log.push([k, s.held()]); m.delete(k); }; s.raw = k => m.get(k); return s;
}
function mkLocks() { let tail = Promise.resolve(), n = 0; return { held: () => n > 0, request(name, a, b) { const cb = b || a;
  const run = tail.then(async () => { n++; try { return await cb({ name }); } finally { n--; } }); tail = run.catch(() => {}); return run; } }; }
const st0 = (coins = 50_000_000, frac = 0.25) => JSON.stringify({ rev: 7, coins, coinFrac: frac, collection: { owned: {}, dust: 0, ledger: {} } });
const SENT = { [PROD]: '{"sentinel":"prod"}', [PREVIEW]: '{"sentinel":"preview"}' };
function env(coins, frac, opts = {}) {
  const storage = mkStorage({ ...SENT, [KEY]: st0(coins, frac) }), locks = mkLocks(); storage.held = locks.held;
  const mk = () => mod.createWalletBridge({ storage, locks, key: KEY, enabled: opts.enabled ?? true });
  return { storage, locks, mk, b: mk() };
}
const plan = (cardId = 'bkCard01', expectedRev = 7) => ({ cost: COST, expectedRev, apply(s) { s.collection.owned[cardId] = (s.collection.owned[cardId] || 0) + 1; return { cardId }; } });
const read = e => JSON.parse(e.storage.raw(KEY));
const keysOk = e => e.storage.log.every(([k]) => k === KEY || k === KEY + '-bak');
const locked = e => e.storage.log.every(([, h]) => h);
const sentOk = e => e.storage.raw(PROD) === SENT[PROD] && e.storage.raw(PREVIEW) === SENT[PREVIEW];
const tryC = async p => { try { return await p; } catch (x) { return { ok: false, code: 'THROWN', err: String(x) }; } };

console.log('== W1 同一 txId 重复提交只扣一次');
{ const e = env(); const r1 = await tryC(e.b.commit('tx-1', plan())); const r2 = await tryC(e.b.commit('tx-1', plan()));
  const [r3, r4] = await Promise.all([tryC(e.b.commit('tx-2', plan('bkCard01', 8))), tryC(e.b.commit('tx-2', plan('bkCard01', 8)))]); const s = read(e);
  ok(r1.ok && r2.ok && r2.replay === true, 'W1', `第二次应返回原结果 replay=true：${JSON.stringify(r2)}`);
  ok(JSON.stringify(r2.receipt) === JSON.stringify(r1.receipt), 'W1', '重放返回的回执应与首次一致');
  ok(s.coins === 50_000_000 - 2 * COST && Object.keys(s.collection.ledger).length === 2 && s.collection.owned.bkCard01 === 2, 'W1', `顺序 + 并发同 txId：应共扣 2 次（tx-1、tx-2 各 1）、卡 2 张：coins=${s.coins} 卡=${s.collection.owned.bkCard01}`);
  ok(r3.ok && r4.ok && [r3, r4].filter(r => r.replay).length === 1, 'W1', '并发同 txId：一次成交、一次 replay');
  ok(locked(e), 'W1', '有写入发生在 Web Lock 之外'); }

console.log('== W2 双标签页并发只成功一次');
{ const e = env(); const A = e.b, B = e.mk(); const [ra, rb] = await Promise.all([tryC(A.commit('tab-a', plan())), tryC(B.commit('tab-b', plan()))]); const s = read(e);
  ok([ra, rb].filter(r => r.ok).length === 1, 'W2', `基于同一 rev 的两笔应只成 1 笔：${JSON.stringify([ra.code, rb.code])}`);
  ok([ra, rb].some(r => !r.ok && r.code === 'CONFLICT'), 'W2', '失败那笔应报 CONFLICT');
  ok(s.coins === 50_000_000 - COST && Object.keys(s.collection.ledger).length === 1, 'W2', `应只扣 1 次：coins=${s.coins}`);
  ok(locked(e), 'W2', '有写入发生在 Web Lock 之外'); }

console.log('== W3 扣费后崩溃 / 切后台恢复');
{ const e = env(); const raw0 = e.storage.raw(KEY); e.storage.failNext = 'before'; const r = await tryC(e.b.commit('tx-c', plan()));
  ok(!r.ok && e.storage.raw(KEY) === raw0, 'W3', `写前失败应不成交、主档不变：${JSON.stringify(r)}`);
  const r2 = await tryC(e.b.commit('tx-c', plan())); ok(r2.ok && read(e).coins === 50_000_000 - COST, 'W3', '写前失败后同 txId 重试应正好扣 1 次'); }
{ const e = env(); e.storage.failNext = 'after'; await tryC(e.b.commit('tx-d', plan()));
  const fresh = e.mk(); const st = await tryC(Promise.resolve(fresh.status('tx-d'))); const r = await tryC(fresh.commit('tx-d', plan())); const s = read(e);
  ok(st === 'committed' || st?.status === 'committed', 'W3', `写成功后崩溃：新实例 status 应为 committed，实际 ${JSON.stringify(st)}`);
  ok(r.ok && r.replay === true, 'W3', '恢复后同 txId 应返回原结果（replay），不重新扣');
  ok(s.coins === 50_000_000 - COST && s.collection.owned.bkCard01 === 1 && Object.keys(s.collection.ledger).length === 1, 'W3', `不重复扣、不丢卡：coins=${s.coins} 卡=${s.collection.owned.bkCard01}`);
  ok(Math.abs(s.coinFrac - 0.25) < 1e-9, 'W3', `零头应保留 0.25，实际 ${s.coinFrac}`); }

console.log('== W4 余额不足拒绝且零写入');
{ const e = env(COST - 1, 0.99); const r = await tryC(e.b.commit('tx-p', plan()));
  ok(!r.ok && r.code === 'INSUFFICIENT_COINS', 'W4', `4,999,999.99 应拒绝 INSUFFICIENT_COINS：${JSON.stringify(r)}`); ok(e.storage.log.length === 0, 'W4', `应零写入，实际写了 ${e.storage.log.length} 次`); }
{ const e = env(COST, 0); const r = await tryC(e.b.commit('tx-q', plan())); ok(r.ok && read(e).coins === 0, 'W4', '余额正好 500 万应能成交、余 0'); }

console.log('== W5 隔离存档外零写入');
{ const e = env(); await tryC(e.b.commit('tx-i', plan())); await tryC(e.mk().commit('tx-j', plan('bkCard02', 8)));
  ok(sentOk(e), 'W5', 'preview / 正式存档原文被改'); ok(keysOk(e), 'W5', `写了隔离 key 以外的键：${[...new Set(e.storage.log.map(x => x[0]))]}`); }

console.log('== W6 开关关闭时零扣费');
{ const e = env(undefined, undefined, { enabled: false }); const raw0 = e.storage.raw(KEY); const r = await tryC(e.b.commit('tx-o', plan()));
  ok(!r.ok && r.code === 'BRIDGE_DISABLED', 'W6', `开关关应拒绝 BRIDGE_DISABLED：${JSON.stringify(r)}`); ok(e.storage.raw(KEY) === raw0 && e.storage.log.length === 0, 'W6', '开关关仍有写入');
  const e2 = mod.createWalletBridge.length >= 0 ? (() => { const s = mkStorage({ ...SENT, [KEY]: st0() }); const l = mkLocks(); s.held = l.held; return { storage: s, b: mod.createWalletBridge({ storage: s, locks: l, key: KEY }) }; })() : null;
  const r2 = await tryC(e2.b.commit('tx-o2', plan())); ok(!r2.ok && e2.storage.log.length === 0, 'W6', '没传 enabled 时应默认关闭、零写入'); }

console.log(`\npassed ${P}, failed ${F}`); if (F) console.log('失败编号：' + [...new Set(failed)].join(' '));
process.exit(F ? 1 : 0);
