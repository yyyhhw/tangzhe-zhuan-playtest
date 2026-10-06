// node test_coin_safety.js [economy.js 路径] — 12d 金币安全 v1 回归（熊大 16:49 五条 + 16:50 等级边界 + 17:00 测试者 4.52 亿场景）
// 12d3（熊大 22:08 存档四处 + 统一交易）：第 12 段——checkSave 整档结构、主档缺失先看备份、备份写失败整次放弃、E.transact / E.commitSave 回滚
// 12d1（熊大 17:53 三处阻塞）：第 9～11 段——余额超 MAX_SAFE_INTEGER 封禁交易 + 通用「扣款精确」断言、totalEarned 整数 + 零头、MAX 零余额返回 0
// 每条都是「读到坏值 / 越界」路径：存档字段、离线收益、团单、特殊客户、手点、调任结清、MAX 批量、升级、开店雇人、盲盒、家具、房子。
// 拿旧代码跑（node test_coin_safety.js /tmp/old_economy.js）会挂一大片，证明这些用例真能抓到问题。
const path = require('path');
const E = require(path.resolve(process.argv[2] || path.join(__dirname, 'economy.js')));
let pass = 0, fail = 0; const fails = [];
const t = (name, fn) => { let r; try { r = fn(); } catch (e) { r = false; name += '（抛错：' + e.message + '）'; } if (r) pass++; else { fail++; fails.push(name); console.log('  ✗', name); } };
const T0 = Date.UTC(2026, 9, 6, 9, 0, 0);   // 2026-10-06 17:00 MYT
const CAP = 1e15;
const bal = st => st.coins + (st.coinFrac || 0);
const BAD = [NaN, Infinity, -Infinity, -5, -0.01, 'abc', '100', null, undefined, {}, [], true];
const BADN = v => (typeof v === 'number' ? String(v) : JSON.stringify(v) === undefined ? 'undefined' : JSON.stringify(v));
const snap = st => JSON.stringify({ c:st.coins, f:st.coinFrac || 0, te:st.totalEarned, ef:st.earnedFrac || 0, shops:st.shops, ceos:st.ceos, g:st.gacha && st.gacha.owned.length, inv:st.furnInv, homes:st.homes && Object.values(st.homes).map(h => h.lv) });
function full(coins) {
  const st = E.newState(T0); st.coins = 1e13; E.hireEmp(st, 0); [1, 2, 3].forEach(i => { E.openShop(st, i); E.hireEmp(st, i); });
  st.shops[3].lv = 25; E.checkUnlocks(st); st.coins = coins == null ? 1e12 : coins; st.coinFrac = 0; st.totalEarned = 5e12; st.lastSeen = st.maxSeen = T0;
  return st;
}

/* ===== 1. 统一钱包：整数 + 零头、上限、坏值拒绝 ===== */
t('钱包：addCoins / spendCoins 存在（统一入账 / 扣款接口）', () => typeof E.addCoins === 'function' && typeof E.spendCoins === 'function');
t('钱包：余额上限 = 1e15（1000 万亿）', () => E.CFG.COIN_CAP === 1e15);
for (const v of BAD) t('钱包：addCoins(' + BADN(v) + ') 拒绝，余额 / 零头 / 累计收入原样', () => { const st = full(452000000); st.coinFrac = 0.25; const s0 = snap(st); const r = E.addCoins(st, v); return r.ok === false && snap(st) === s0; });
for (const v of BAD) t('钱包：spendCoins(' + BADN(v) + ') 拒绝，余额原样', () => { const st = full(452000000); const s0 = snap(st); const r = E.spendCoins(st, v); return r.ok === false && snap(st) === s0; });
t('钱包：单价超过 1e15 → 不能买（不压低价格），余额原样', () => { const st = full(); st.coins = 5e15; const r = E.spendCoins(st, 1.0000001e15); return !r.ok && r.over && st.coins === 5e15; });
t('钱包：金币不够 → 拒绝、不扣', () => { const st = full(100); const r = E.spendCoins(st, 101); return !r.ok && r.why === '金币不够' && st.coins === 100; });
t('钱包：整数金币 + 独立零头：9000 亿余额上 0.3 × 10 = 正好 +3，整数部分一直是整数', () => { const st = full(9e14); for (let k = 0; k < 10; k++) E.addCoins(st, 0.3); return Number.isInteger(st.coins) && Math.abs(bal(st) - (9e14 + 3)) < 1e-6 && st.coinFrac < 1; });
t('钱包：每帧小额收入（0.6/秒 × 16ms）在 9999 亿余额上一分钟后照样 +36', () => { const st = full(999999999999); for (let k = 0; k < 3750; k++) E.addCoins(st, 0.6 * 0.016); return Math.abs(bal(st) - (999999999999 + 36)) < 1e-4; });
t('上限：差 5 到上限时团单 +100 → 停在正好 1e15，零头清 0，累计收入只加 5', () => { const st = full(CAP - 5); const te = st.totalEarned; E.settleOrder(st, 100); return st.coins === CAP && (st.coinFrac || 0) === 0 && st.totalEarned === te + 5; });
t('上限：到 1e15 后继续入账 → 余额不再增长', () => { const st = full(CAP); E.settleOrder(st, 1e9); E.settleSpecial(st, 3); return st.coins === CAP; });
t('上限：到上限后照样能花钱，花完继续赚', () => { const st = full(CAP); const r = E.upgradeShop(st, 0); E.settleOrder(st, 10); return r.ok && st.coins === CAP - r.cost + 10; });

/* ===== 1b. 熊大清单第 5 条：几十亿 / 几百亿量级照常（小额累计、团单、升级、存档往返都精确）===== */
for (const B of [5e9, 3.7e10, 5e10, 8.8e11]) {
  t(`${B / 1e8} 亿余额：每帧 0.6/秒小额收入 1 分钟 +36，一点不丢`, () => { const st = full(B); for (let k = 0; k < 3750; k++) E.addCoins(st, 0.6 * 0.016); return Math.abs(bal(st) - (B + 36)) < 1e-4; });
  t(`${B / 1e8} 亿余额：团单 + 升级扣款后余额精确（整数部分是整数）`, () => { const st = full(B); E.settleOrder(st, 123456.789); const c = E.upgradeCost(1, st.shops[1].lv); const r = E.upgradeShop(st, 1); return r.ok && Number.isInteger(st.coins) && Math.abs(bal(st) - (B + 123456.789 - c)) < 1e-4; });
  t(`${B / 1e8} 亿余额：存档往返（JSON → loadSave）余额 / 零头逐位相同`, () => { const st = full(B); E.addCoins(st, 0.37); const r = E.loadSave(JSON.stringify(st), null, T0); return r.source === 'main' && r.st.coins === st.coins && r.st.coinFrac === st.coinFrac; });
}

/* ===== 2. 旧档超上限：保留余额和等级，停止增长，读档不降级 ===== */
{
  const legacy = { v:3, rev:7, coins:5e15, totalEarned:6e15, shops:[{ open:true, lv:150, emp:40 }, { open:true, lv:120, emp:38 }, { open:true, lv:99, emp:30 }, { open:true, lv:88, emp:30 }],
    ceos:{ c77:{ unlocked:true, lv:30, at:0 }, pearl:{ unlocked:true, lv:30, at:1 }, otaku:{ unlocked:true, lv:30, at:2 }, rocket:{ unlocked:true, lv:29, at:3 } }, lastSeen:T0, maxSeen:T0 };
  const ld = () => E.migrate(JSON.parse(JSON.stringify(legacy)), T0).st;
  t('旧档超上限：读档保留 5e15 余额（不截到 1e15）', () => ld().coins === 5e15);
  t('旧档超上限：读档不降级（店 150/120/99/88、员工 40/38/30/30、火箭 Lv29 原样）', () => { const s = ld(); return s.shops.map(x => x.lv).join() === '150,120,99,88' && s.shops.map(x => x.emp).join() === '40,38,30,30' && s.ceos.rocket.lv === 29; });
  t('旧档超上限：团单 / 特殊客户 / 调任结清 / 离线都不再增长', () => { const s = ld(); E.settleOrder(s, 1e9); E.settleSpecial(s, 0); s.lastSeen = T0 - 3000; E.creditOnline(s, T0); E.settleOffline(s, T0 + 30e3); return s.coins === 5e15; });
  t('旧档超上限：领离线收益不增长（领取记录照写）', () => { const s = ld(); s.pending = { id:'x1', sec:3600, gap:3600, amount:5e9, from:T0 - 3600e3 }; const r = E.claimOffline(s, T0, false); return r.ok && s.coins === 5e15 && !s.pending && s.claimLog.some(c => c.id === 'x1'); });
  t('旧档超上限：等级超过上限的店 / 员工 / CEO 不能再升，不扣钱', () => { const s = ld(); const r = [E.upgradeShop(s, 0), E.upgradeEmp(s, 1), E.upgradeCeo(s, 'rocket'), E.upgradeCeo(s, 'c77')]; return r.every(x => !x.ok && x.why === '已满级') && s.coins === 5e15 && s.shops[0].lv === 150 && s.shops[1].emp === 38 && s.ceos.rocket.lv === 29; });
  t('旧档超上限：产速是有限数（不 NaN / ∞）', () => { const s = ld(); const r = E.baseRate(s); return isFinite(r) && r > 0; });
}

/* ===== 3. 等级上限（熊大 16:50）===== */
const SM = [110, 93, 79, 69], EM = [35, 31, 26, 22], CM = { c77:30, pearl:30, otaku:30, rocket:25 };
t('等级上限表 = 熊大 16:50：店 110/93/79/69、员工 35/31/26/22、CEO 30/30/30/25', () => SM.every((m, i) => E.shopMaxLv(i) === m) && EM.every((m, i) => E.empMaxLv(i) === m) && Object.keys(CM).every(id => E.ceoMaxLv(id) === CM[id]));
t('等级上限按公式复核：最后一笔单价 ≤ 1e15，再下一级 > 1e15（店 / 员工 / 火箭）', () => SM.every((m, i) => E.upgradeCost(i, m - 1) <= CAP && E.upgradeCost(i, m) > CAP) && EM.every((m, i) => E.empCost(i, m - 1) <= CAP && E.empCost(i, m) > CAP) && E.ceoCost('rocket', 24) <= CAP && E.ceoCost('rocket', 25) > CAP);
SM.forEach((m, i) => {
  t(`店铺 ${E.SHOPS[i].short}：Lv${m - 1}→${m} 能买（1e15 余额）`, () => { const st = full(CAP); st.shops[i].lv = m - 1; const r = E.upgradeShop(st, i); return r.ok && st.shops[i].lv === m && st.coins === CAP - E.upgradeCost(i, m - 1); });
  t(`店铺 ${E.SHOPS[i].short}：Lv${m} 满级，旧档 5e15 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 5e15; st.shops[i].lv = m; const r = E.upgradeShop(st, i); return !r.ok && r.why === '已满级' && st.shops[i].lv === m && st.coins === 5e15; });
});
EM.forEach((m, i) => {
  t(`员工 ${E.SHOPS[i].emp.name}：Lv${m - 1}→${m} 能买`, () => { const st = full(CAP); st.shops[i].emp = m - 1; return E.upgradeEmp(st, i).ok && st.shops[i].emp === m; });
  t(`员工 ${E.SHOPS[i].emp.name}：Lv${m} 满级，旧档 5e15 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 5e15; st.shops[i].emp = m; const r = E.upgradeEmp(st, i); return !r.ok && st.shops[i].emp === m && st.coins === 5e15; });
});
Object.keys(CM).forEach(id => {
  t(`CEO ${id}：Lv${CM[id] - 1}→${CM[id]} 能买`, () => { const st = full(CAP); st.ceos[id].lv = CM[id] - 1; return E.upgradeCeo(st, id).ok && st.ceos[id].lv === CM[id]; });
  t(`CEO ${id}：Lv${CM[id]} 满级，旧档 5e15 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 5e15; st.ceos[id].lv = CM[id]; const r = E.upgradeCeo(st, id); return !r.ok && st.ceos[id].lv === CM[id] && st.coins === 5e15; });
});
t('超上限价格不压低：Lv110→111 的报价仍是公式原价（> 1e15），钱包判不能买', () => { const c = E.upgradeCost(0, 110); return c === Math.ceil(30 * Math.pow(1.33, 110)) && c > CAP && !E.canAfford(full(CAP), c); });

/* ===== 4. MAX 批量购买遵守上限 ===== */
t('MAX：烧烤 Lv100 + 旧档 5e15 余额（钱够买很多级）→ 最多买到 Lv110（10 级）', () => { const st = full(); st.coins = 5e15; st.shops[0].lv = 100; return E.shopBuyCount(st, 0, 'max') === 10; });
t('MAX：烧烤 Lv100 + 1e15 余额 → 只算买得起的级数（逐级累加 ≤ 余额）', () => { const st = full(CAP); st.shops[0].lv = 100; let k = 0, c = 0; while (c + E.upgradeCost(0, 100 + k) <= CAP) c += E.upgradeCost(0, 100 + k++); return E.shopBuyCount(st, 0, 'max') === k && k > 0 && k < 10; });
t('MAX：照 MAX 连买 200 次（5e15 余额），最终停在 Lv110、钱包没变负', () => { const st = full(); st.coins = 5e15; st.shops[0].lv = 100; for (let k = 0; k < 200; k++) E.upgradeShop(st, 0); return st.shops[0].lv === 110 && st.coins > 0; });
t('MAX：满级时可买数 = 0（x1 / x10 / MAX 都是 0）', () => { const st = full(CAP); st.shops[2].lv = 79; return [1, 10, 'max'].every(a => E.shopBuyCount(st, 2, a) === 0); });
t('x10：Lv105 只能买 5 级（不超过 110）', () => { const st = full(CAP); st.shops[0].lv = 105; return E.shopBuyCount(st, 0, 10) === 5; });
t('MAX：余额坏值（NaN）时 MAX 可买 0 级、实际一级也买不到', () => { const st = full(); st.coins = NaN; const k = E.shopBuyCount(st, 0, 'max'); const r = E.upgradeShop(st, 0); return k === 0 && !r.ok && st.shops[0].lv === 1; });
t('MAX：旧档超上限等级（Lv150）可买数 0', () => { const st = full(CAP); st.shops[0].lv = 150; return E.shopBuyCount(st, 0, 'max') === 0; });
t('MAX：循环次数有上限（MAX_BUY_STEPS = 200）', () => E.CFG.MAX_BUY_STEPS === 200);

/* ===== 5. 各条花钱路径：内存余额是坏值时一律拒绝、什么都不改 ===== */
const MEMBAD = [NaN, Infinity, -5, 'abc', null, undefined];
const SPEND = {   // [准备, 动作]：先确认余额正常时这一步能成功，再把余额换成坏值重做一次
  '店铺升级': [null, st => E.upgradeShop(st, 0)], '员工升级': [null, st => E.upgradeEmp(st, 0)], 'CEO 升级': [null, st => E.upgradeCeo(st, 'c77')],
  '开店': [st => { st.shops[3].open = false; st.shops[3].lv = 0; st.shops[3].emp = 0; }, st => E.openShop(st, 3)],
  '雇员工': [st => { st.shops[2].emp = 0; }, st => E.hireEmp(st, 2)], '盲盒': [null, st => E.gachaDraw(st, 0.5)], '买家具': [null, st => E.buyFurniture(st, 'furn_bed')], '升级房子': [null, st => E.upgradeHome(st, 'c77')],
};
for (const [nm, [prep, fn]] of Object.entries(SPEND)) {
  t(`${nm}：余额正常时能买（对照）`, () => { const st = full(); if (prep) prep(st); const c = st.coins; return fn(st).ok && st.coins < c; });
  for (const v of MEMBAD) t(`${nm}：余额是 ${BADN(v)} → 拒绝，等级 / 仓库 / 收藏都不变`, () => { const st = full(); if (prep) prep(st); st.coins = v; const s0 = snap(st); const r = fn(st); return !r.ok && snap(st) === s0; });
}
for (const v of [NaN, Infinity, -1, 'abc', 2e15]) t(`盲盒：单价是 ${BADN(v)} → 拒绝、不扣钱、不抽`, () => { const st = full(); const s0 = snap(st); const r = E.gachaDraw(st, 0.5, v); return !r.ok && snap(st) === s0; });

/* ===== 6. 各条加钱路径：读到坏值一律拒绝 ===== */
for (const v of BAD) t(`团单：结算金额 ${BADN(v)} → 不入账、不计团单数`, () => { const st = full(); const s0 = snap(st), n = st.bigCustomers; const r = E.settleOrder(st, v); return r === 0 && snap(st) === s0 && st.bigCustomers === n; });
const allLv = (st, v) => st.shops.forEach(s => { s.lv = v; });   // 四家店的等级都读到坏值 → 产速应为 0
for (const v of [Infinity, NaN, 'abc', -3]) {
  t(`特殊客户：店铺等级读到 ${BADN(v)} → 不入账`, () => { const st = full(); allLv(st, v); const c = bal(st); E.settleSpecial(st, 0); return bal(st) === c; });
  t(`调任结清：店铺等级读到 ${BADN(v)} → 不入账，调任照常`, () => { const st = full(); allLv(st, v); st.lastSeen = T0 - 3000; const c = bal(st); const r = E.assignCeoWithPayout(st, 'pearl', 0, T0); return r.ok && bal(st) === c; });
  t(`离线（<60 秒静默入账）：店铺等级读到 ${BADN(v)} → 不入账`, () => { const st = full(); allLv(st, v); const c = bal(st); E.settleOffline(st, T0 + 30e3); return bal(st) === c; });
  t(`离线（待领取）：店铺等级读到 ${BADN(v)} → 待领取金额是有限数`, () => { const st = full(); allLv(st, v); const p = E.settleOffline(st, T0 + 3600e3); return !p || (isFinite(p.amount) && p.amount >= 0); });
  t(`手点：店铺等级读到 ${BADN(v)} → 只进有限的保底手点值（∞ 拒收）`, () => { const st = full(); allLv(st, v); const c = bal(st); const r = E.tapReward(st, 0, T0, 0.99, 0); if (typeof E.addCoins === 'function') E.addCoins(st, r.value); else { st.coins += r.value; } const ok = typeof r.value === 'number' && isFinite(r.value) && r.value >= 0; return isFinite(bal(st)) && bal(st) === (ok ? c + r.value : c); });
}
for (const v of [NaN, Infinity, -1, 'abc', null, undefined, {}]) t(`领离线：待领取金额 ${BADN(v)} → 拒绝、余额不变、坏单清掉`, () => { const st = full(); st.pending = { id:'p1', sec:100, gap:100, amount:v, from:T0 }; const c = bal(st), te = st.totalEarned; const r = E.claimOffline(st, T0, true); return !r.ok && bal(st) === c && st.totalEarned === te && !st.pending; });
t('领离线：待领取秒数是坏值 → 拒绝', () => { const st = full(); st.pending = { id:'p1', sec:NaN, gap:100, amount:100, from:T0 }; const c = bal(st); return !E.claimOffline(st, T0, false).ok && bal(st) === c; });
t('离线：坏的待领取单不会被拿来继续累加（重新结算时丢掉）', () => { const st = full(); st.pending = { id:'p1', sec:'x', amount:'abc' }; const p = E.settleOffline(st, T0 + 3600e3); return p && isFinite(p.amount) && isFinite(p.sec) && p.id !== 'p1'; });
t('漫画杯套小红包：产速坏值时红包不入账', () => { const st = full(); E.assignCeo(st, 'otaku', 1); st.shops[1].lv = 9; st.shops[1].emp = Infinity; const c0 = st.coins; const r = E.upgradeShop(st, 1); return r.ok && bal(st) === c0 - r.cost + r.bonus && isFinite(bal(st)); });
t('产速有限值保护：等级 / 员工读到 ∞ 时 shopRate = 0，不是 ∞', () => { const st = full(); st.shops[0].lv = Infinity; return E.shopRate(st, 0) === 0 && isFinite(E.baseRate(st)); });
t('离线双倍：正常领取 = 金额 × 2，重复领取被拒', () => { const st = full(1000); st.pending = { id:'d1', sec:3600, gap:3600, amount:1234.5, from:T0 }; const r = E.claimOffline(st, T0, true); st.pending = { id:'d1', sec:1, gap:1, amount:1, from:T0 }; const r2 = E.claimOffline(st, T0, true); return r.ok && r.doubled && Math.abs(bal(st) - (1000 + 2469)) < 1e-9 && !r2.ok; });

/* ===== 7. 存档：写档前校验、坏档不归零、完整备份恢复 ===== */
const good = () => { const s = full(452000000); s.coinFrac = 0.5; s.rev = 20; return s; };
for (const v of [null, 'abc', '1e9', -1, true, 'NaN', undefined]) t(`读档：coins = ${BADN(v)} → 判坏档（不当 0 读进来）`, () => { const r = JSON.parse(JSON.stringify(good())); if (v === undefined) delete r.coins; else r.coins = v; return E.checkSave(r).includes('coins'); });
t('读档：Infinity 写进 JSON 变 null → 判坏档', () => E.checkSave(JSON.parse(JSON.stringify(Object.assign(good(), { coins:Infinity })))).includes('coins'));
for (const [k, v] of [['shops[0].lv', 'abc'], ['shops[1].lv', null], ['shops[2].emp', -2], ['ceos.rocket.lv', 'x'], ['coinFrac', 3]]) t(`读档：${k} = ${BADN(v)} → 判坏档（不降成 Lv1）`, () => { const r = JSON.parse(JSON.stringify(good())); if (k === 'coinFrac') r.coinFrac = v; else if (k.startsWith('ceos')) r.ceos.rocket.lv = v; else { const i = +k[6]; r.shops[i][k.endsWith('emp') ? 'emp' : 'lv'] = v; } return E.checkSave(r).includes(k); });
t('读档：好档 checkSave 为空', () => E.checkSave(JSON.parse(JSON.stringify(good()))).length === 0);
{
  const G = JSON.stringify(good()), B = (() => { const r = JSON.parse(G); r.coins = null; r.rev = 21; return JSON.stringify(r); })();
  const bak = (() => { const r = JSON.parse(G); r.coins = 451000000; r.rev = 19; return JSON.stringify(r); })();
  t('loadSave：主档好 → 用主档（不看备份）', () => { const r = E.loadSave(G, B, T0); return r.source === 'main' && r.st.coins === 452000000 && r.st.coinFrac === 0.5; });
  t('loadSave：主档 coins 坏 + 备份好 → 用备份恢复，余额 / 等级来自备份，不归零', () => { const r = E.loadSave(B, bak, T0); return r.source === 'bak' && r.st.coins === 451000000 && r.st.shops[3].lv === 25 && r.bad.includes('coins') && r.mainRev === 21; });
  t('loadSave：主档 JSON 截断 → 用备份', () => { const r = E.loadSave(G.slice(0, 200), bak, T0); return r.source === 'bak' && r.st.coins === 451000000; });
  t('loadSave：主档坏 + 备份也坏 → blocked（调用方不覆盖原档）', () => { const r = E.loadSave(B, B, T0); return r.source === 'broken' && r.blocked; });
  t('loadSave：主档坏 + 没有备份 → blocked', () => { const r = E.loadSave(B, null, T0); return r.blocked; });
  t('loadSave：没有主档也没有备份 → 新游戏', () => { const r = E.loadSave(null, null, T0); return r.source === 'new' && r.st.coins === 0; });   // 12d3：原「没有主档 → 新游戏（不拿备份顶上）」按熊大 22:08 第 2 条改为先看备份，见第 12 段
  t('loadSave：主档店铺等级坏 → 用备份，不降成 Lv1', () => { const r0 = JSON.parse(G); r0.shops[0].lv = 'abc'; const r = E.loadSave(JSON.stringify(r0), bak, T0); return r.source === 'bak' && r.st.shops[0].lv === JSON.parse(bak).shops[0].lv; });
  t('读档：坏的待领取收益丢掉并标记（不入账、不拦整档）', () => { const r0 = JSON.parse(G); r0.pending = { id:'z', sec:10, amount:'abc' }; const m = E.migrate(r0, T0); return m.st.pending === null && m.badPending === true && m.st.coins === 452000000; });
  t('读档：合法待领取收益原样保留', () => { const r0 = JSON.parse(G); r0.pending = { id:'z', sec:10, gap:10, amount:123.25, from:T0 }; const m = E.migrate(r0, T0); return m.st.pending && m.st.pending.amount === 123.25 && !m.badPending; });
}
for (const v of [NaN, Infinity, -1, 'abc', null]) t(`写档前校验：内存余额 ${BADN(v)} → validState 报 coins`, () => { const s = good(); s.coins = v; return (E.validState(s) || []).includes('coins'); });
t('写档前校验：内存待领取金额坏 → validState 报 pending', () => { const s = good(); s.pending = { id:'a', sec:1, amount:NaN }; return E.validState(s).includes('pending'); });
t('写档前校验：店铺等级 ∞ → validState 报 shops', () => { const s = good(); s.shops[1].lv = Infinity; return E.validState(s).some(x => x.startsWith('shops')); });
t('写档前校验：合法小数余额 123.75 → 拆成 123 + 0.75，校验通过', () => { const s = good(); s.coins = 123.75; s.coinFrac = 0; return E.validState(s).length === 0 && s.coins === 123 && s.coinFrac === 0.75; });
t('读档：旧档小数余额 452345678.375 → 整数 452345678 + 零头 0.375，总额不变', () => { const m = E.migrate({ v:3, coins:452345678.375 }, T0).st; return m.coins === 452345678 && m.coinFrac === 0.375; });

/* ===== 8. 熊大 17:00 回归：测试者 4.52 亿余额、41.88 万/秒、含团单结算，进度和等级完整保留 ===== */
{
  const mk = () => {
    const st = E.newState(T0); st.coins = 1e13; E.hireEmp(st, 0); [1, 2, 3].forEach(i => { E.openShop(st, i); E.hireEmp(st, i); });
    [53, 55, 45, 28].forEach((lv, i) => { st.shops[i].lv = lv; st.shops[i].emp = 5; }); E.checkUnlocks(st);
    for (const id in st.ceos) st.ceos[id].lv = 5;
    for (let k = 0; k < 6; k++) E.gachaDraw(st, 0.2 + k * 0.13);   // 只抽普通收藏（不抽超级装饰，免得改产速）
    E.buyFurniture(st, 'furn_bed'); E.placeItem(st, 'c77', 'furn_bed', 0, 0, 0); E.buyFurniture(st, 'furn_sofa');
    st.coins = 452000000; st.coinFrac = 0.37; st.totalEarned = 2.1e9; st.lastSeen = st.maxSeen = T0; st.rev = 300; st.taps = 5000; st.bigCustomers = 40;
    return st;
  };
  const s0 = mk(), rate = E.baseRate(s0);
  t('4.52 亿场景：产速 ≈ 41.88 万/秒（' + rate.toFixed(1) + '）', () => Math.abs(rate - 418800) < 50);
  // 旧版存档（没 coinFrac、余额是小数）照样读进来
  const legacyRaw = JSON.parse(JSON.stringify(s0)); delete legacyRaw.coinFrac; legacyRaw.coins = 452000000.37;
  const L = (E.loadSave ? E.loadSave(JSON.stringify(legacyRaw), null, T0) : { st:E.migrate(legacyRaw, T0).st }).st;
  t('4.52 亿场景：旧档读进来余额 / 等级 / 员工 / CEO / 收藏 / 家具完全一致', () => Math.abs(bal(L) - 452000000.37) < 1e-6 && JSON.stringify(L.shops) === JSON.stringify(s0.shops) && JSON.stringify(L.ceos) === JSON.stringify(s0.ceos) && JSON.stringify(L.gacha.owned) === JSON.stringify(s0.gacha.owned) && JSON.stringify(L.homes) === JSON.stringify(s0.homes) && JSON.stringify(L.furnInv) === JSON.stringify(s0.furnInv));
  // 在线 120 秒（60fps 逐帧入账）+ 一张团单 + 离开 1 小时领双倍
  const st = L; let t1 = T0, autoSum = 0;
  for (let k = 0; k < 7200; k++) { t1 += 1000 / 60; const g = E.onlineRate(st, t1) * (1 / 60); autoSum += g; if (E.addCoins) E.addCoins(st, g); else { st.coins += g; st.totalEarned += g; } st.lastSeen = t1; st.maxSeen = t1; }
  const payout = E.orderPayout(E.onlineRate(st, t1)), paid = E.settleOrder(st, payout);
  const off = E.settleOffline(st, t1 + 3600e3, () => 'off-1'), cl = E.claimOffline(st, t1 + 3600e3, true);
  const expect = 452000000.37 + rate * 120 + rate * 4 * 30 + rate * 0.5 * 3600 * 2;
  t('4.52 亿场景：120 秒在线收益 = 41.88 万 × 120（逐帧零头不丢）', () => Math.abs(autoSum - rate * 120) < 1e-3);
  t('4.52 亿场景：团单结算 = 产速 × 4 × 30 = ' + Math.round(rate * 120), () => Math.abs(paid - rate * 120) < 1e-6 && st.bigCustomers === 41);
  t('4.52 亿场景：离开 1 小时领双倍 = 产速 × 50% × 3600 × 2', () => off && cl.ok && cl.doubled && Math.abs(cl.amount - rate * 3600) < 1e-3);
  t('4.52 亿场景：最终余额和逐项相加一致（误差 < 1 金币，' + bal(st).toFixed(2) + ' vs ' + expect.toFixed(2) + '）', () => Math.abs(bal(st) - expect) < 1 && Number.isInteger(st.coins));
  t('4.52 亿场景：整个过程等级 / 员工 / CEO / 收藏 / 家具一点没动', () => JSON.stringify(st.shops) === JSON.stringify(s0.shops) && JSON.stringify(st.ceos) === JSON.stringify(s0.ceos) && JSON.stringify(st.gacha.owned) === JSON.stringify(s0.gacha.owned) && JSON.stringify(st.homes) === JSON.stringify(s0.homes));
  t('4.52 亿场景：写档前校验通过；存档往返后余额 / 零头 / 等级逐字段相同', () => { const v = E.validState(st); const back = E.loadSave(JSON.stringify(st), null, T0 + 1).st; return v.length === 0 && back.coins === st.coins && back.coinFrac === st.coinFrac && JSON.stringify(back.shops) === JSON.stringify(st.shops) && JSON.stringify(back.ceos) === JSON.stringify(st.ceos); });
  t('4.52 亿场景：还能继续正常升级（店铺 Lv53→54 扣原价）', () => { const c = st.coins, cost = E.upgradeCost(0, 53); const r = E.upgradeShop(st, 0); return r.ok && st.coins === c - cost && st.shops[0].lv === 54; });
}

/* ===== 9. 12d1 熊大 17:53 ①：余额超过 MAX_SAFE_INTEGER 不能当钱包；任何购买后余额必须精确减少价格 ===== */
const SAFE = Number.MAX_SAFE_INTEGER;
const UNSAFE = [1e20, SAFE + 1, SAFE + 3, 2 ** 60, 1e300];
const ALLBUY = {   // 全部花钱路径（准备 → 动作），用来做「扣款精确」通用断言
  '店铺升级': [null, st => E.upgradeShop(st, 0)], '员工升级': [null, st => E.upgradeEmp(st, 0)], 'CEO 升级': [null, st => E.upgradeCeo(st, 'c77')],
  '开店': [st => { st.shops[3].open = false; st.shops[3].lv = 0; st.shops[3].emp = 0; }, st => E.openShop(st, 3)],
  '雇员工（50）': [st => { st.shops[0].emp = 0; }, st => E.hireEmp(st, 0)], '盲盒': [null, st => E.gachaDraw(st, 0.5)], '买家具': [null, st => E.buyFurniture(st, 'furn_bed')], '升级房子': [null, st => E.upgradeHome(st, 'c77')],
  '店铺升级（奇数价 Lv7）': [st => { st.shops[1].lv = 7; }, st => E.upgradeShop(st, 1)],
};
for (const v of UNSAFE) {
  t(`12d1 读档：coins = ${v} 超过安全整数 → checkSave 判坏档`, () => E.checkSave(Object.assign(JSON.parse(JSON.stringify(good())), { coins:v })).length > 0);
  t(`12d1 写档前校验：内存余额 ${v} → validState 报错（不写盘）`, () => { const s = good(); s.coins = v; return (E.validState(s) || []).length > 0; });
  t(`12d1 钱包：余额 ${v} → walletOk 为假，入账被拒、余额原样`, () => { const s = good(); s.coins = v; s.coinFrac = 0; const s0 = snap(s); const r = E.addCoins(s, 100); return (!E.walletOk || !E.walletOk(s)) && !r.ok && snap(s) === s0; });
  for (const [nm, [prep, fn]] of Object.entries(ALLBUY)) t(`12d1 余额 ${v}：${nm} → 拒绝，余额 / 等级 / 仓库 / 收藏都不变（不能白买）`, () => { const st = full(); if (prep) prep(st); st.coins = v; st.coinFrac = 0; const s0 = snap(st); const r = fn(st); return !r.ok && snap(st) === s0; });
  t(`12d1 余额 ${v}：MAX 可买 0 级`, () => { const st = full(); st.coins = v; return E.shopBuyCount(st, 0, 'max') === 0; });
}
t('12d1 熊大原例：1e20 旧档雇员（50）→ 必须拒绝；旧版是「返回成功、员工 +1、余额没少」', () => { const st = full(); st.shops[0].emp = 0; st.coins = 1e20; const r = E.hireEmp(st, 0); return !r.ok && st.shops[0].emp === 0 && st.coins === 1e20; });
{
  const G = JSON.stringify(good()), bak = (() => { const r = JSON.parse(G); r.coins = 451000000; r.rev = 19; return JSON.stringify(r); })();
  const U = (() => { const r = JSON.parse(G); r.coins = 1e20; r.rev = 22; return JSON.stringify(r); })();
  t('12d1 loadSave：主档余额 1e20 + 备份好 → 异常模式（blocked），不自动拿备份覆盖、原文保留', () => { const r = E.loadSave(U, bak, T0); return r.blocked === true && r.source !== 'main' && r.source !== 'bak' && r.unsafe === true && r.bakOk === true; });
  t('12d1 loadSave：主档余额 1e20 + 没备份 → 异常模式（blocked）', () => { const r = E.loadSave(U, null, T0); return r.blocked === true && r.source !== 'main'; });
  t('12d1 loadSave：异常模式读出的状态钱包不可用（所有交易都会被拒）', () => { const r = E.loadSave(U, bak, T0); return !E.walletOk(r.st) && !E.hireEmp(Object.assign(r.st, {}), 0).ok; });
  t('12d1 loadSave：余额正好 MAX_SAFE_INTEGER（旧档中间段）→ 正常读主档（保留，不截断）', () => { const r0 = JSON.parse(G); r0.coins = SAFE; r0.coinFrac = 0; const r = E.loadSave(JSON.stringify(r0), bak, T0); return r.source === 'main' && r.st.coins === SAFE; });
}
for (const B of [100, 452000000, 452000000.37, CAP - 1, CAP, 5e15 + 1, SAFE - 1, SAFE]) {
  for (const [nm, [prep, fn]] of Object.entries(ALLBUY)) t(`12d1 扣款精确：余额 ${B} 时 ${nm} → 成功则余额正好少 cost、整数且变小；失败则一点不动`, () => {
    const st = full(B); if (prep) prep(st); E.normWallet ? E.normWallet(st) : 0; const c0 = st.coins, f0 = st.coinFrac || 0, s0 = snap(st); const r = fn(st);
    if (!r.ok) return snap(st) === s0;
    return typeof r.cost === 'number' && r.cost > 0 && Number.isSafeInteger(st.coins) && st.coins < c0 && c0 - st.coins === r.cost && st.coins + r.cost === c0 && (st.coinFrac || 0) === f0;
  });
}
t('12d1 扣款精确：spendCoins 在 MAX_SAFE_INTEGER 上扣 1 / 49 / 3 都精确', () => [1, 49, 3].every(p => { const st = full(SAFE); const r = E.spendCoins(st, p); return r.ok && st.coins === SAFE - p; }));
t('12d1 中间段：余额 5e15+1 不再增长，但花钱照样精确', () => { const st = full(5e15 + 1); E.settleOrder(st, 1e6); const c = st.coins; const r = E.upgradeShop(st, 1); return c === 5e15 + 1 && r.ok && st.coins === c - r.cost; });
t('12d1 余额 1e20：离开 1 小时 / 30 秒都不结算离线收益（不弹领取、余额不变）', () => { const st = full(1e20); st.pending = null; const s0 = snap(st); const p = E.settleOffline(st, T0 + 3600e3); const st2 = full(1e20); E.settleOffline(st2, T0 + 30e3); return !p && !st.pending && snap(st) === s0 && st2.coins === 1e20 && st.lastSeen === T0 + 3600e3; });   // 时间要往前记，不然界面每帧都当「刚回来」
t('12d1 canAfford：余额 1e20 → 什么都买不起', () => { const st = full(1e20); return !E.canAfford(st, 50) && !E.canAfford(st, 1); });

/* ===== 10. 12d1 熊大 17:53 ②：totalEarned 整数 + 独立零头，大额处逐帧小数不丢 ===== */
for (const T of [5e12, 2e14, 3e15, 5e15]) {
  t(`12d1 累计收入 ${T}：0.3 × 10 = 正好 +3（整数部分一直是整数）`, () => { const st = full(1000); st.totalEarned = T; st.earnedFrac = 0; for (let k = 0; k < 10; k++) E.addCoins(st, 0.3); return Number.isInteger(st.totalEarned) && Math.abs((st.totalEarned - T) + (st.earnedFrac || 0) - 3) < 1e-6 && (st.earnedFrac || 0) < 1; });
  t(`12d1 累计收入 ${T}：每帧 0.6/秒 × 16ms 一分钟 +36`, () => { const st = full(1000); st.totalEarned = T; st.earnedFrac = 0; for (let k = 0; k < 3750; k++) E.addCoins(st, 0.6 * 0.016); return Math.abs((st.totalEarned - T) + (st.earnedFrac || 0) - 36) < 1e-4; });
}
t('12d1 累计收入：4.52 亿场景 41.88 万/秒逐帧 60 秒，累计收入 3e15 上精确 +产速×60', () => { const st = full(452000000); st.totalEarned = 3e15; st.earnedFrac = 0; let sum = 0; for (let k = 0; k < 3600; k++) { const g = 418793.537 / 60; sum += g; E.addCoins(st, g); } return Math.abs((st.totalEarned - 3e15) + (st.earnedFrac || 0) - sum) < 1e-2 && Number.isInteger(st.totalEarned); });
t('12d1 累计收入：旧档小数 totalEarned 123.75 → 读档拆成 123 + 0.75', () => { const m = E.migrate({ v:3, coins:10, totalEarned:123.75 }, T0).st; return m.totalEarned === 123 && m.earnedFrac === 0.75; });
t('12d1 累计收入：存档往返零头逐位相同', () => { const st = full(452000000); st.totalEarned = 3e15; st.earnedFrac = 0; for (let k = 0; k < 7; k++) E.addCoins(st, 0.37); const r = E.loadSave(JSON.stringify(st), null, T0); return r.source === 'main' && r.st.totalEarned === st.totalEarned && r.st.earnedFrac === st.earnedFrac && Math.abs((r.st.totalEarned - 3e15) + r.st.earnedFrac - 2.59) < 1e-6; });
t('12d1 累计收入：零头坏值（NaN / 2）→ validState 报 totalEarned', () => [NaN, 2, -1].every(v => { const s = good(); s.earnedFrac = v; return E.validState(s).includes('totalEarned'); }));
t('12d1 累计收入：到 MAX_SAFE_INTEGER 封顶不再涨（不出现不精确的大数）', () => { const st = full(1000); st.totalEarned = SAFE - 2; st.earnedFrac = 0; E.addCoins(st, 10); return st.totalEarned === SAFE && Number.isSafeInteger(st.totalEarned); });
t('12d1 累计收入：领离线双倍按实际入账累计（大额也精确）', () => { const st = full(1000); st.totalEarned = 3e15; st.earnedFrac = 0; st.pending = { id:'e1', sec:3600, gap:3600, amount:1234.25, from:T0 }; const r = E.claimOffline(st, T0, true); return r.ok && Math.abs((st.totalEarned - 3e15) + (st.earnedFrac || 0) - 2468.5) < 1e-6; });

/* ===== 11. 12d1 熊大 17:53 ③：MAX 买不起一级返回 0（不再 Math.max(1,k)）===== */
t('12d1 MAX：余额 0 → 可买 0 级', () => { const st = full(0); return E.shopBuyCount(st, 0, 'max') === 0; });
t('12d1 MAX：余额差 1 买不起下一级 → 0；正好够 → 1', () => { const st = full(); const p = E.upgradeCost(1, st.shops[1].lv); st.coins = p - 1; const a = E.shopBuyCount(st, 1, 'max'); st.coins = p; const b = E.shopBuyCount(st, 1, 'max'); return a === 0 && b === 1; });
t('12d1 MAX：余额 p−1 + 零头 0.99 也是 0（整数比较，不靠零头凑）', () => { const st = full(); const p = E.upgradeCost(1, st.shops[1].lv); st.coins = p - 1; st.coinFrac = 0.99; return E.shopBuyCount(st, 1, 'max') === 0 && !E.canAfford(st, p); });
t('12d1 MAX：四家店余额 0 全是 0，升级照样被拒、余额不变', () => [0, 1, 2, 3].every(i => { const st = full(0); const r = E.upgradeShop(st, i); return E.shopBuyCount(st, i, 'max') === 0 && !r.ok && st.coins === 0; }));

/* ===== 12. 12d3 熊大 22:08：存档四处 + 统一交易入口（扣款 + 改状态 + 落盘，任一步失败整体回滚）===== */
// 模拟 localStorage：fail = { 键名: true } 时 setItem 抛异常（同浏览器里 QuotaExceededError）
function mem(init, fail) {
  const d = Object.assign({}, init || {}); const f = fail || {};
  return { d, f, getItem:k => (k in d ? d[k] : null), setItem(k, v) { if (f[k]) { const e = new Error('写入失败（测试注入）'); e.name = 'QuotaExceededError'; throw e; } d[k] = String(v); }, removeItem:k => { delete d[k]; } };
}
const K = 'tangzhe-preview-save', KB = 'tangzhe-preview-save-bak';
const has12d3 = typeof E.transact === 'function' && typeof E.commitSave === 'function';
const G3 = () => { const s = good(); s.coins = 452000000; s.coinFrac = 0; s.rev = 20; return s; };
const raw3 = () => JSON.parse(JSON.stringify(G3()));
const deep = st => JSON.stringify(st);
// ① checkSave 整档结构：每一种都必须判坏档（9550afd 只看金币 / 等级数值，shops[0]=null 等都放过）
const STRUCT = [
  ['shops[0] = null', r => { r.shops[0] = null; }], ['shops[1] = null', r => { r.shops[1] = null; }], ['shops[2] = "x"', r => { r.shops[2] = 'x'; }], ['shops[3] = []', r => { r.shops[3] = []; }],
  ['shops[0] 缺 lv', r => { delete r.shops[0].lv; }], ['shops[1] 缺 emp', r => { delete r.shops[1].emp; }], ['shops[2] 缺 open', r => { delete r.shops[2].open; }],
  ['shops 只有 3 家', r => { r.shops.pop(); }], ['shops 有 5 家', r => { r.shops.push({ open:false, lv:0, emp:0 }); }], ['shops 整个缺失', r => { delete r.shops; }], ['shops = {}', r => { r.shops = {}; }],
  ['shops[0].lv = 2.5（读档会被取整降级）', r => { r.shops[0].lv = 2.5; }], ['shops[1].emp = 1.5', r => { r.shops[1].emp = 1.5; }], ['开着的店 lv = 0', r => { r.shops[2].lv = 0; }], ['shops[0].emp = 99（超 EMP_MAX 会被截）', r => { r.shops[0].emp = 99; }],
  ['ceos.pearl = null', r => { r.ceos.pearl = null; }], ['ceos.otaku 缺 lv', r => { delete r.ceos.otaku.lv; }], ['ceos.rocket.unlocked = "yes"', r => { r.ceos.rocket.unlocked = 'yes'; }], ['ceos.c77.at = 9', r => { r.ceos.c77.at = 9; }], ['ceos.c77.lv = 1.5', r => { r.ceos.c77.lv = 1.5; }], ['ceos = []', r => { r.ceos = []; }],
  ['homes.c77 = null（会被重建成空小屋）', r => { r.homes.c77 = null; }], ['homes.pearl.lv = "abc"', r => { r.homes.pearl.lv = 'abc'; }], ['homes.otaku.placed = "x"', r => { r.homes.otaku.placed = 'x'; }], ['homes.c77.placed 里有 null', r => { r.homes.c77.placed = [null]; }], ['homes = 5', r => { r.homes = 5; }],
  ['gacha = null（收藏会被清空）', r => { r.gacha = null; }], ['gacha.owned = "x"', r => { r.gacha.owned = 'x'; }], ['furnInv = []', r => { r.furnInv = []; }], ['furnInv 数量 = "2"', r => { r.furnInv = { furn_bed:'2' }; }],
  ['wear = null', r => { r.wear = null; }], ['crossSeen = 5', r => { r.crossSeen = 5; }], ['decorHidden = "x"', r => { r.decorHidden = 'x'; }], ['claimLog = {}', r => { r.claimLog = {}; }],
  ['cur = 7（界面会读 shops[7] 崩）', r => { r.cur = 7; }], ['rev = "abc"', r => { r.rev = 'abc'; }], ['taps = -1', r => { r.taps = -1; }], ['totalEarned = "x"', r => { r.totalEarned = 'x'; }], ['lastSeen = "x"', r => { r.lastSeen = 'x'; }], ['存档是数组', r => '[]'],
];
const mkBad = fn => { const r = raw3(); const o = fn(r); return o === '[]' ? [] : r; };
for (const [nm, fn] of STRUCT) t(`12d3 ① checkSave：${nm} → 判坏档`, () => E.checkSave(mkBad(fn)).length > 0);
for (const [nm, fn] of STRUCT.slice(0, 11)) t(`12d3 ① 读档：主档 ${nm} + 好备份 → 用备份（不 migrate 成初始等级）`, () => { const b = raw3(); b.coins = 451000000; b.rev = 19; const r = E.loadSave(JSON.stringify(mkBad(fn)), JSON.stringify(b), T0); return r.source === 'bak' && r.st.coins === 451000000 && JSON.stringify(r.st.shops) === JSON.stringify(b.shops); });
for (const [nm, fn] of STRUCT.slice(0, 4)) t(`12d3 ① 读档：主档 ${nm} + 没备份 → 只读（blocked），不当好档读`, () => { const r = E.loadSave(JSON.stringify(mkBad(fn)), null, T0); return r.blocked === true && r.source === 'broken' && (!E.isBlocked || E.isBlocked(r.st)); });
t('12d3 ① 熊大原场景：主档 shops[0]=null（店 Lv53）+ 好备份 → 读档后写一次：备份逐字节不变，主档写回备份里的进度（不是 Lv1）', () => {
  const b = raw3(); b.rev = 19; b.shops[0].lv = 53; const B = JSON.stringify(b); const m = raw3(); m.shops[0] = null; m.rev = 21; const M = JSON.stringify(m);
  const ls = mem({ [K]:M, [KB]:B }); const L = E.loadSave(ls.getItem(K), ls.getItem(KB), T0); if (L.source !== 'bak') return false;
  L.st.rev = Math.max(L.st.rev, L.mainRev || 0);
  // 主页面 persist 规则：坏主档不进备份
  const prev = ls.getItem(K); let ok = false; try { ok = !E.checkSave(JSON.parse(prev)).length; } catch (e) {} if (ok) ls.setItem(KB, prev);
  L.st.rev++; ls.setItem(K, JSON.stringify(L.st));
  return ls.getItem(KB) === B && JSON.parse(ls.getItem(K)).shops[0].lv === b.shops[0].lv && b.shops[0].lv > 1;
});
t('12d3 ① 跨页写档：当前主档结构坏（shops[0]=null）→ commitSave 拒绝，主档 / 备份逐字节不变', () => { if (!has12d3) return false; const b = JSON.stringify(raw3()); const m = raw3(); m.shops[0] = null; const M = JSON.stringify(m); const ls = mem({ [K]:M, [KB]:b }); const st = G3(); st.rev = 99; const r = E.commitSave(ls, K, KB, st); return !r.ok && ls.getItem(K) === M && ls.getItem(KB) === b; });
t('12d3 ① 写档前校验：内存 shops[0]=null / cur=9 / homes.c77=null / gacha=null → validState 报错（不写盘）', () => [s => { s.shops[0] = null; }, s => { s.cur = 9; }, s => { s.homes.c77 = null; }, s => { s.gacha = null; }].every(f => { const s = G3(); f(s); let v; try { v = E.validState(s); } catch (e) { return false; } return v.length > 0; }));
t('12d3 ① 合法旧档照常读：v1（伙伴 hired）、v3 只有 77 的 CEO 记录、新档、测试房间都通过完整校验', () => {
  const v1 = { v:1, coins:4321, shops:[{ open:true, lv:12, hired:true }, { open:true, lv:3, hired:false }, { open:false, lv:0, hired:false }, { open:false, lv:0, hired:false }] };
  const v3 = { v:3, rev:5, coins:777, totalEarned:777, shops:[{ open:true, lv:4, emp:1 }, { open:false, lv:0, emp:0 }, { open:false, lv:0, emp:0 }, { open:false, lv:0, emp:0 }], ceos:{ c77:{ unlocked:true, lv:2, at:0 } }, gacha:{ owned:[], draws:0, pity:0, last:null }, claimLog:[] };
  const j = x => JSON.parse(JSON.stringify(x));
  return [v1, v3, j(E.newState(T0)), j(E.testHomesState(T0, 3)), raw3(), j(full(5e15 + 1))].every(r => E.checkSave(r).length === 0) && E.loadSave(JSON.stringify(v1), null, T0).source === 'main';
});
// ② 主档缺失 / 空串 / JSON null → 先看备份
for (const [nm, mv] of [['缺失（null）', null], ['空字符串', ''], ['JSON null', 'null']]) {
  t(`12d3 ② 主档${nm} + 好备份 → 用备份（余额 / 等级 / rev 来自备份），不是零进度新档`, () => { const b = raw3(); b.coins = 451000000; b.rev = 33; const r = E.loadSave(mv, JSON.stringify(b), T0); return r.source === 'bak' && r.st.coins === 451000000 && r.st.shops[3].lv === 25 && r.st.rev === 33 && !r.blocked; });
  t(`12d3 ② 主档${nm} + 备份结构坏（shops[0]=null）→ 只读，不生成零进度`, () => { const b = raw3(); b.shops[0] = null; const r = E.loadSave(mv, JSON.stringify(b), T0); return r.blocked === true && r.source !== 'new' && r.source !== 'bak'; });
  t(`12d3 ② 主档${nm} + 备份 JSON 截断 → 只读，不生成零进度`, () => { const r = E.loadSave(mv, JSON.stringify(raw3()).slice(0, 150), T0); return r.blocked === true && r.source !== 'new'; });
  t(`12d3 ② 主档${nm} + 备份余额 1e20 → 只读（不当钱包）`, () => { const b = raw3(); b.coins = 1e20; const r = E.loadSave(mv, JSON.stringify(b), T0); return r.blocked === true && r.source !== 'new' && r.source !== 'bak'; });
}
t('12d3 ② 主档缺失 + 没有备份 → 才是新游戏', () => { const r = E.loadSave('', null, T0); return r.source === 'new' && !r.blocked && r.st.coins === 0; });
t('12d3 ② 主档缺失 + 坏备份 → 只读状态写不出去（commitSave 拒绝，备份原文不动）', () => { if (!has12d3) return false; const b = raw3(); b.shops[0] = null; const B = JSON.stringify(b); const ls = mem({ [KB]:B }); const L = E.loadSave(null, B, T0); const r = E.commitSave(ls, K, KB, L.st); return L.blocked && !r.ok && ls.getItem(K) === null && ls.getItem(KB) === B; });
// ④ 备份写失败 → 整次保存放弃，主档不动
t('12d3 ④ commitSave：备份 setItem 抛异常 → 返回失败，主档 / 备份逐字节不变，rev 不变', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P, [KB]:'old-bak' }, { [KB]:true }); const st = G3(); st.coins -= 100; const rev = st.rev; const r = E.commitSave(ls, K, KB, st); return !r.ok && r.stage === 'bak' && ls.getItem(K) === P && ls.getItem(KB) === 'old-bak' && st.rev === rev; });
t('12d3 ④ commitSave：主档 setItem 抛异常 → 返回失败，主档不变、rev 不变（备份 = 原主档）', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P }, { [K]:true }); const st = G3(); const rev = st.rev; const r = E.commitSave(ls, K, KB, st); return !r.ok && r.stage === 'main' && ls.getItem(K) === P && st.rev === rev && (ls.getItem(KB) === null || ls.getItem(KB) === P); });
t('12d3 ④ commitSave 成功：先把原主档整份放进 -bak，rev + 1，写出的档通过 checkSave', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P }); const st = G3(); st.coins = 451999000; const r = E.commitSave(ls, K, KB, st); const w = JSON.parse(ls.getItem(K)); return r.ok && r.rev === 21 && st.rev === 21 && w.rev === 21 && w.coins === 451999000 && ls.getItem(KB) === P && E.checkSave(w).length === 0; });
t('12d3 ④ commitSave：存储里 rev 更新（别的页面写过）→ 拒绝、不覆盖', () => { if (!has12d3) return false; const p = raw3(); p.rev = 50; const P = JSON.stringify(p); const ls = mem({ [K]:P }); const st = G3(); const r = E.commitSave(ls, K, KB, st); return !r.ok && r.stage === 'conflict' && ls.getItem(K) === P && ls.getItem(KB) === null; });
t('12d3 ④ commitSave：余额 1e20 读出的只读状态 → 拒绝（原文不动）', () => { if (!has12d3) return false; const u = raw3(); u.coins = 1e20; const U = JSON.stringify(u); const ls = mem({ [K]:U }); const L = E.loadSave(U, null, T0); const r = E.commitSave(ls, K, KB, L.st); return !r.ok && ls.getItem(K) === U; });
// ⑤ 统一交易入口 E.transact
t('12d3 ⑤ E.transact / E.commitSave / E.isBlocked 存在', () => has12d3 && typeof E.isBlocked === 'function');
t('12d3 ⑤ 成功：扣 50、改状态、调一次 save，返回 { ok, cost:50, result }', () => { if (!has12d3) return false; const st = G3(); const c = st.coins; let n = 0; const r = E.transact(st, { price:50, apply:s => { s.zombie = { lv:(s.zombie ? s.zombie.lv : 0) + 1 }; return { ok:true, lv:s.zombie.lv }; }, save:s => { n++; return s === st; } }); return r.ok && r.cost === 50 && r.result.lv === 1 && st.coins === c - 50 && st.zombie.lv === 1 && n === 1; });
for (const [nm, sv] of [['返回 false', () => false], ['返回 { ok:false }', () => ({ ok:false, why:'x' })], ['抛异常', () => { throw new Error('quota'); }], ['返回 undefined', () => undefined], ['返回字符串 "ok"', () => 'ok']]) {
  t(`12d3 ⑤ save ${nm} → 整档回滚（钱、训练等级、rev 都还原），stage = save、why = 保存失败`, () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); const r = E.transact(st, { price:1234, apply:s => { s.zombie = { lv:9 }; s.shops[0].lv++; s.rev++; return { ok:true }; }, save:sv }); return !r.ok && r.stage === 'save' && r.why === '保存失败' && deep(st) === s0; });
}
t('12d3 ⑤ 回滚后对象引用不变（调用方手里的 st 还是同一个，嵌套字段也是回滚后的值）', () => { if (!has12d3) return false; const st = G3(); const ref = st; const r = E.transact(st, { price:10, apply:s => { s.shops[1].lv = 99; }, save:() => false }); return !r.ok && st === ref && st.shops[1].lv === G3().shops[1].lv; });
t('12d3 ⑤ apply 返回 { ok:false } → 回滚，不调 save', () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); let n = 0; const r = E.transact(st, { price:100, apply:s => { s.shops[0].lv = 77; return { ok:false, why:'已满级' }; }, save:() => { n++; return true; } }); return !r.ok && r.stage === 'apply' && r.why === '已满级' && n === 0 && deep(st) === s0; });
t('12d3 ⑤ apply 抛异常 → 回滚，不调 save', () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); let n = 0; const r = E.transact(st, { price:100, apply:() => { throw new Error('boom'); }, save:() => { n++; return true; } }); return !r.ok && r.stage === 'apply' && n === 0 && deep(st) === s0; });
t('12d3 ⑤ 金币不够 → stage = pay，不调 apply / save，一分不扣', () => { if (!has12d3) return false; const st = G3(); st.coins = 10; const s0 = deep(st); let a = 0, n = 0; const r = E.transact(st, { price:11, apply:() => { a++; }, save:() => { n++; return true; } }); return !r.ok && r.stage === 'pay' && r.why === '金币不够' && a === 0 && n === 0 && deep(st) === s0; });
for (const v of [NaN, -1, Infinity, 'abc', null, 2e15]) t(`12d3 ⑤ 价格 ${BADN(v)} → 拒绝，不调 apply / save`, () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); let a = 0, n = 0; const r = E.transact(st, { price:v, apply:() => { a++; }, save:() => { n++; return true; } }); return !r.ok && a === 0 && n === 0 && deep(st) === s0; });
t('12d3 ⑤ blocked:true（调用方已知只读）→ 拒绝', () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); let n = 0; const r = E.transact(st, { price:1, apply:() => {}, save:() => { n++; return true; }, blocked:true }); return !r.ok && r.stage === 'blocked' && n === 0 && deep(st) === s0; });
for (const [nm, mainS, bakS] of [['余额 1e20（异常档）', (() => { const u = raw3(); u.coins = 1e20; return JSON.stringify(u); })(), null], ['坏档没备份（shops[0]=null）', (() => { const u = raw3(); u.shops[0] = null; return JSON.stringify(u); })(), null], ['主档缺失 + 坏备份', null, (() => { const u = raw3(); u.ceos.pearl = null; return JSON.stringify(u); })()]])
  t(`12d3 ⑤ ${nm}读出的状态：不传 blocked 也拒绝交易（不扣钱、不调 save）`, () => { if (!has12d3) return false; const L = E.loadSave(mainS, bakS, T0); const s0 = deep(L.st); let n = 0; const r = E.transact(L.st, { price:0, apply:s => { s.coins = 5; }, save:() => { n++; return true; } }); return L.blocked && !r.ok && r.stage === 'blocked' && n === 0 && deep(L.st) === s0; });
t('12d3 ⑤ apply 把状态改坏（shops[0]=null / 余额 NaN / cur=9）→ stage = validate，回滚、不调 save', () => { if (!has12d3) return false; return [s => { s.shops[0] = null; }, s => { s.coins = NaN; }, s => { s.cur = 9; }].every(f => { const st = G3(); const s0 = deep(st); let n = 0; const r = E.transact(st, { price:5, apply:f, save:() => { n++; return true; } }); return !r.ok && r.stage === 'validate' && n === 0 && deep(st) === s0; }); });
t('12d3 ⑤ 经营购买也能走：transact(apply = upgradeShop) 存不上 → 等级和钱都回滚', () => { if (!has12d3) return false; const st = G3(); const s0 = deep(st); const r = E.transact(st, { apply:s => E.upgradeShop(s, 1), save:() => false }); return !r.ok && r.stage === 'save' && deep(st) === s0; });
// ⑤ 跨页完整链路（打僵尸训练 / 宠物买狗的写法）：读档 → transact（save = commitSave）→ 失败全回滚
const zombieTrain = (ls, price) => { const L = E.loadSave(ls.getItem(K), ls.getItem(KB), T0); if (L.blocked) return { ok:false, stage:'blocked', L };
  const r = E.transact(L.st, { price, apply:s => { const z = s.zombie || (s.zombie = { lv:0 }); z.lv++; return { ok:true, lv:z.lv }; }, save:s => E.commitSave(ls, K, KB, s) }); r.L = L; return r; };
t('12d3 ⑤ 打僵尸训练（跨页）成功：主档余额 −价格、zombie.lv +1、rev +1，-bak = 原主档', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P }); const r = zombieTrain(ls, 5000); const w = JSON.parse(ls.getItem(K)); return r.ok && w.coins === 452000000 - 5000 && w.zombie.lv === 1 && w.rev === 21 && ls.getItem(KB) === P && r.L.st.zombie.lv === 1; });
t('12d3 ⑤ 打僵尸训练：备份写失败 → 主档 / 备份逐字节不变，内存里的钱和训练等级都回滚', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P, [KB]:'B0' }, { [KB]:true }); const r = zombieTrain(ls, 5000); return !r.ok && r.stage === 'save' && ls.getItem(K) === P && ls.getItem(KB) === 'B0' && r.L.st.coins === 452000000 && !r.L.st.zombie && r.L.st.rev === 20; });
t('12d3 ⑤ 打僵尸训练：主档写失败 → 主档不变，内存回滚（没有「扣了钱存不上」）', () => { if (!has12d3) return false; const P = JSON.stringify(raw3()); const ls = mem({ [K]:P }, { [K]:true }); const r = zombieTrain(ls, 5000); return !r.ok && ls.getItem(K) === P && r.L.st.coins === 452000000 && !r.L.st.zombie; });
t('12d3 ⑤ 打僵尸训练：存档余额 1e20 → 整局禁止训练扣款，原文不动', () => { if (!has12d3) return false; const u = raw3(); u.coins = 1e20; const U = JSON.stringify(u); const ls = mem({ [K]:U }); const r = zombieTrain(ls, 5000); return !r.ok && r.stage === 'blocked' && ls.getItem(K) === U; });
t('12d3 ⑤ 宠物买狗（跨页）：存不上 → pet 字段不出现、钱不扣；能存上 → pet 写进同一份主档', () => { if (!has12d3) return false; const P = JSON.stringify(raw3());
  const buy = ls => { const L = E.loadSave(ls.getItem(K), ls.getItem(KB), T0); const r = E.transact(L.st, { price:8000, apply:s => { if (s.pet) return { ok:false, why:'已经有狗了' }; s.pet = { id:'puppy', t:T0 }; return { ok:true }; }, save:s => E.commitSave(ls, K, KB, s) }); return { r, st:L.st }; };
  const a = buy(mem({ [K]:P }, { [K]:true })), ls2 = mem({ [K]:P }), b = buy(ls2);
  return !a.r.ok && !a.st.pet && a.st.coins === 452000000 && b.r.ok && JSON.parse(ls2.getItem(K)).pet.id === 'puppy' && JSON.parse(ls2.getItem(K)).coins === 452000000 - 8000; });
// ⑥ 已确认的取舍保持不变
t('12d3 ⑥ 取舍不变：1e15 < 余额 ≤ MAX_SAFE 的旧档照常读、能花不涨；totalEarned 超安全整数的旧值读档不裁', () => { const r0 = raw3(); r0.coins = 5e15 + 1; r0.totalEarned = 1e17; const L = E.loadSave(JSON.stringify(r0), null, T0); const c = L.st.coins; E.addCoins(L.st, 100); const u = E.upgradeShop(L.st, 0); return L.source === 'main' && c === 5e15 + 1 && u.ok && L.st.coins === c - u.cost && L.st.totalEarned === 1e17; });
t('12d3 ⑥ 取舍不变：余额 1e20 仍是异常模式（不自动拿备份顶）', () => { const u = raw3(); u.coins = 1e20; const r = E.loadSave(JSON.stringify(u), JSON.stringify(raw3()), T0); return r.unsafe === true && r.blocked === true && r.source === 'unsafe'; });

console.log(`coin safety tests: ${pass} passed, ${fail} failed`);
if (process.env.COIN_FAILS_JSON) require('fs').writeFileSync(process.env.COIN_FAILS_JSON, JSON.stringify(fails, null, 1));
process.exitCode = fail ? 1 : 0;
