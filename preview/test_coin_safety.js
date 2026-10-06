// node test_coin_safety.js [economy.js 路径] — 12d 金币安全 v1 回归（熊大 16:49 五条 + 16:50 等级边界 + 17:00 测试者 4.52 亿场景）
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
const snap = st => JSON.stringify({ c:st.coins, f:st.coinFrac || 0, te:st.totalEarned, shops:st.shops, ceos:st.ceos, g:st.gacha && st.gacha.owned.length, inv:st.furnInv, homes:st.homes && Object.values(st.homes).map(h => h.lv) });
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
t('钱包：单价超过 1e15 → 不能买（不压低价格），余额原样', () => { const st = full(); st.coins = 3e16; const r = E.spendCoins(st, 1.0000001e15); return !r.ok && r.over && st.coins === 3e16; });
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
  const legacy = { v:3, rev:7, coins:3e16, totalEarned:4e16, shops:[{ open:true, lv:150, emp:40 }, { open:true, lv:120, emp:38 }, { open:true, lv:99, emp:30 }, { open:true, lv:88, emp:30 }],
    ceos:{ c77:{ unlocked:true, lv:30, at:0 }, pearl:{ unlocked:true, lv:30, at:1 }, otaku:{ unlocked:true, lv:30, at:2 }, rocket:{ unlocked:true, lv:29, at:3 } }, lastSeen:T0, maxSeen:T0 };
  const ld = () => E.migrate(JSON.parse(JSON.stringify(legacy)), T0).st;
  t('旧档超上限：读档保留 3e16 余额（不截到 1e15）', () => ld().coins === 3e16);
  t('旧档超上限：读档不降级（店 150/120/99/88、员工 40/38/30/30、火箭 Lv29 原样）', () => { const s = ld(); return s.shops.map(x => x.lv).join() === '150,120,99,88' && s.shops.map(x => x.emp).join() === '40,38,30,30' && s.ceos.rocket.lv === 29; });
  t('旧档超上限：团单 / 特殊客户 / 调任结清 / 离线都不再增长', () => { const s = ld(); E.settleOrder(s, 1e9); E.settleSpecial(s, 0); s.lastSeen = T0 - 3000; E.creditOnline(s, T0); E.settleOffline(s, T0 + 30e3); return s.coins === 3e16; });
  t('旧档超上限：领离线收益不增长（领取记录照写）', () => { const s = ld(); s.pending = { id:'x1', sec:3600, gap:3600, amount:5e9, from:T0 - 3600e3 }; const r = E.claimOffline(s, T0, false); return r.ok && s.coins === 3e16 && !s.pending && s.claimLog.some(c => c.id === 'x1'); });
  t('旧档超上限：等级超过上限的店 / 员工 / CEO 不能再升，不扣钱', () => { const s = ld(); const r = [E.upgradeShop(s, 0), E.upgradeEmp(s, 1), E.upgradeCeo(s, 'rocket'), E.upgradeCeo(s, 'c77')]; return r.every(x => !x.ok && x.why === '已满级') && s.coins === 3e16 && s.shops[0].lv === 150 && s.shops[1].emp === 38 && s.ceos.rocket.lv === 29; });
  t('旧档超上限：产速是有限数（不 NaN / ∞）', () => { const s = ld(); const r = E.baseRate(s); return isFinite(r) && r > 0; });
}

/* ===== 3. 等级上限（熊大 16:50）===== */
const SM = [110, 93, 79, 69], EM = [35, 31, 26, 22], CM = { c77:30, pearl:30, otaku:30, rocket:25 };
t('等级上限表 = 熊大 16:50：店 110/93/79/69、员工 35/31/26/22、CEO 30/30/30/25', () => SM.every((m, i) => E.shopMaxLv(i) === m) && EM.every((m, i) => E.empMaxLv(i) === m) && Object.keys(CM).every(id => E.ceoMaxLv(id) === CM[id]));
t('等级上限按公式复核：最后一笔单价 ≤ 1e15，再下一级 > 1e15（店 / 员工 / 火箭）', () => SM.every((m, i) => E.upgradeCost(i, m - 1) <= CAP && E.upgradeCost(i, m) > CAP) && EM.every((m, i) => E.empCost(i, m - 1) <= CAP && E.empCost(i, m) > CAP) && E.ceoCost('rocket', 24) <= CAP && E.ceoCost('rocket', 25) > CAP);
SM.forEach((m, i) => {
  t(`店铺 ${E.SHOPS[i].short}：Lv${m - 1}→${m} 能买（1e15 余额）`, () => { const st = full(CAP); st.shops[i].lv = m - 1; const r = E.upgradeShop(st, i); return r.ok && st.shops[i].lv === m && st.coins === CAP - E.upgradeCost(i, m - 1); });
  t(`店铺 ${E.SHOPS[i].short}：Lv${m} 满级，旧档 3e16 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 3e16; st.shops[i].lv = m; const r = E.upgradeShop(st, i); return !r.ok && r.why === '已满级' && st.shops[i].lv === m && st.coins === 3e16; });
});
EM.forEach((m, i) => {
  t(`员工 ${E.SHOPS[i].emp.name}：Lv${m - 1}→${m} 能买`, () => { const st = full(CAP); st.shops[i].emp = m - 1; return E.upgradeEmp(st, i).ok && st.shops[i].emp === m; });
  t(`员工 ${E.SHOPS[i].emp.name}：Lv${m} 满级，旧档 3e16 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 3e16; st.shops[i].emp = m; const r = E.upgradeEmp(st, i); return !r.ok && st.shops[i].emp === m && st.coins === 3e16; });
});
Object.keys(CM).forEach(id => {
  t(`CEO ${id}：Lv${CM[id] - 1}→${CM[id]} 能买`, () => { const st = full(CAP); st.ceos[id].lv = CM[id] - 1; return E.upgradeCeo(st, id).ok && st.ceos[id].lv === CM[id]; });
  t(`CEO ${id}：Lv${CM[id]} 满级，旧档 3e16 余额也不能再升、不扣钱`, () => { const st = full(); st.coins = 3e16; st.ceos[id].lv = CM[id]; const r = E.upgradeCeo(st, id); return !r.ok && st.ceos[id].lv === CM[id] && st.coins === 3e16; });
});
t('超上限价格不压低：Lv110→111 的报价仍是公式原价（> 1e15），钱包判不能买', () => { const c = E.upgradeCost(0, 110); return c === Math.ceil(30 * Math.pow(1.33, 110)) && c > CAP && !E.canAfford(full(CAP), c); });

/* ===== 4. MAX 批量购买遵守上限 ===== */
t('MAX：烧烤 Lv100 + 旧档 3e16 余额（钱够买很多级）→ 最多买到 Lv110（10 级）', () => { const st = full(); st.coins = 3e16; st.shops[0].lv = 100; return E.shopBuyCount(st, 0, 'max') === 10; });
t('MAX：烧烤 Lv100 + 1e15 余额 → 只算买得起的级数（逐级累加 ≤ 余额）', () => { const st = full(CAP); st.shops[0].lv = 100; let k = 0, c = 0; while (c + E.upgradeCost(0, 100 + k) <= CAP) c += E.upgradeCost(0, 100 + k++); return E.shopBuyCount(st, 0, 'max') === k && k > 0 && k < 10; });
t('MAX：照 MAX 连买 200 次（3e16 余额），最终停在 Lv110、钱包没变负', () => { const st = full(); st.coins = 3e16; st.shops[0].lv = 100; for (let k = 0; k < 200; k++) E.upgradeShop(st, 0); return st.shops[0].lv === 110 && st.coins > 0; });
t('MAX：满级时可买数 = 0（x1 / x10 / MAX 都是 0）', () => { const st = full(CAP); st.shops[2].lv = 79; return [1, 10, 'max'].every(a => E.shopBuyCount(st, 2, a) === 0); });
t('x10：Lv105 只能买 5 级（不超过 110）', () => { const st = full(CAP); st.shops[0].lv = 105; return E.shopBuyCount(st, 0, 10) === 5; });
t('MAX：余额坏值（NaN）时 MAX 只报 1 级、实际一级也买不到', () => { const st = full(); st.coins = NaN; const k = E.shopBuyCount(st, 0, 'max'); const r = E.upgradeShop(st, 0); return k === 1 && !r.ok && st.shops[0].lv === 1; });
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
  t('loadSave：没有主档 → 新游戏（不拿备份顶上）', () => { const r = E.loadSave(null, bak, T0); return r.source === 'new' && r.st.coins === 0; });
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

console.log(`coin safety tests: ${pass} passed, ${fail} failed`);
if (process.env.COIN_FAILS_JSON) require('fs').writeFileSync(process.env.COIN_FAILS_JSON, JSON.stringify(fails, null, 1));
process.exitCode = fail ? 1 : 0;
