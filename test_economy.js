// node test_economy.js — 经济核心单元测试
const E = require('./economy.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
const near = (a, b, m, eps = 1e-6) => ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), m + ` (${a} vs ${b})`);
const T0 = Date.UTC(2026, 9, 5, 6, 0, 0); // 2026-10-05 14:00 MYT

// 里程碑
ok(E.milestoneMult(9) === 1 && E.milestoneMult(10) === 2 && E.milestoneMult(25) === 4 && E.milestoneMult(50) === 8, '里程碑 ×2/×4/×8');
// 新档：77 在烧烤摊，没员工不自动赚
let st = E.newState(T0);
ok(st.ceos.c77.unlocked && st.ceos.c77.at === 0, '77 开局坐镇烧烤摊');
ok(E.baseRate(st) === 0, '没员工不自动赚');
ok(E.tapValue(st, 0) >= 1, '可以手点');
st.coins = 50; ok(E.hireEmp(st, 0).ok && st.shops[0].emp === 1, '雇阿炭 50');
near(E.shopRate(st, 0), E.SHOPS[0].rate * 1 * 1 * 1 * 1.5, '烧烤摊 = 基础 × 员工 × 专长1.5');
// CEO 等级 +5%/级
st.ceos.c77.lv = 3; near(E.ceoInfo(st, 0).mult, 1.5 * 1.10, 'CEO Lv3 = ×1.5×1.10');
st.ceos.c77.lv = 1;
// 员工等级
st.shops[0].emp = 5; near(E.empMult(5), 1 + 0.15 * 4, '员工 Lv5 倍率');
// 开奶茶店 → 珍珠姐加入并坐奶茶店
st.coins = 1e12; const r1 = E.openShop(st, 1);
ok(r1.ok && r1.unlocked.includes('pearl') && st.ceos.pearl.at === 1, '开奶茶店解锁珍珠姐');
E.hireEmp(st, 1);
E.openShop(st, 2); ok(st.ceos.otaku.unlocked && st.ceos.otaku.at === 2, '开书店解锁阿宅店长');
E.hireEmp(st, 2); E.openShop(st, 3); E.hireEmp(st, 3);
ok(!st.ceos.rocket.unlocked && E.ceoAt(st, 3) === null, '科技公司 Lv25 前火箭老板未加入');
ok(E.gachaUnlocked(st), '科技公司雇到员工 → 盲盒开放');
st.shops[3].lv = 24; const r25 = E.upgradeShop(st, 3);
ok(r25.milestone === 4 && r25.unlocked.includes('rocket') && st.ceos.rocket.at === 3, 'Lv25 解锁火箭老板并坐镇科技公司');
ok(E.CEO_BY_ID.rocket.name === E.ROCKET_NAME.name, '火箭老板名字来自一处配置');
// 招牌
ok(E.signOf(st, 0).name === '77烧烤店', '77+烧烤 = 77烧烤店（熊大定稿）');
// 调任预览：火箭老板 → 烧烤摊（与 77 互换）
const before = E.cloneState(st);
const pv = E.previewAssign(st, 'rocket', 0);
ok(pv.ok && pv.swapped === 'c77' && JSON.stringify(st) === JSON.stringify(before), '预览不改原存档');
near(pv.shops[0].after, E.shopRate(st, 0) / 1.5 * 1.2 * (1 + 0.05 * (st.ceos.rocket.lv - 1)) / (1 + 0.05 * (st.ceos.c77.lv - 1)), '预览：烧烤摊调后 = 跨行 ×1.2');
ok(pv.crossOn.includes('rocket@0') && pv.crossOn.includes('c77@3'), '预览列出两个跨行事件');
ok(pv.offlineCapAfter === 10 * 3600 && pv.offlineCapBefore === 8 * 3600, '预览：麻辣服务器离线上限 8h→10h');
near(pv.totalAfter, pv.shops.reduce((a, s) => a + s.after, 0), '全街调后 = 各店之和');
const prog0 = JSON.stringify(st.shops), oldRate = E.onlineRate(st, T0 + 1e9 - 3000);
st.lastSeen = T0 + 1e9 - 3000; const coins0 = st.coins;
const a = E.assignCeoWithPayout(st, 'rocket', 0, T0 + 1e9);
near(a.paid, oldRate * 3, '换人前按旧阵容结清 3 秒收益');
near(st.coins - coins0, oldRate * 3, '结清的钱进了账户');
ok(st.lastSeen === T0 + 1e9, '结清后 lastSeen 前移，不会被新阵容重复结算');
ok(JSON.stringify(st.shops) === prog0, '换招牌（交换任职）不重置店铺等级/员工/进度');
ok(a.ok && st.ceos.rocket.at === 0 && st.ceos.c77.at === 3, '确认后互换');
ok(E.signOf(st, 0).name === E.ROCKET_NAME.sign + '烧烤', '老马烧烤招牌');
// 火箭烤炉：大客户更频繁
near(E.bigInterval(st, 0), E.CFG.BIG_MIN * 0.5, '火箭烤炉：大客户间隔减半');
ok(E.offlineCap(st) === 10 * 3600, '麻辣服务器：离线上限 10h');
// 珍珠姐 → 书店：手点 ×2
const tapBook = E.tapValue(st, 2); E.assignCeo(st, 'pearl', 2);
ok(st.ceos.otaku.at === 1, '阿宅被换到奶茶店（互换）');
near(E.tapValue(st, 2), Math.max(E.SHOPS[2].tapMin, Math.round(E.shopBase(2, st.shops[2].lv) * E.ceoInfo(st, 2).mult * E.CFG.TAP_FRAC * 10) / 10) * 2, '奶茶漫画联名：书店手点 ×2');
ok(E.tapMult(st, 2) === 2 && tapBook > 0, 'tapMult=2');
// 阿宅 → 奶茶店：里程碑小红包
st.shops[1].lv = 9; const c0 = st.coins; const rm = E.upgradeShop(st, 1);
ok(rm.milestone === 2 && rm.panel && rm.bonus > 0 && Math.abs(st.coins - (c0 - rm.cost + rm.bonus)) < 1e-3, '漫画杯套：冲 Lv10 有分镜+小红包');
const rm2 = E.upgradeShop(st, 1); ok(!rm2.panel && rm2.bonus === 0, '非里程碑不送');
// CEO 空着
ok(E.assignCeo(st, 'c77', -1).ok && E.ceoAt(st, 3) === null && E.ceoInfo(st, 3).mult === 1, 'CEO 可以空着');
ok(!E.assignCeo(st, 'c77', -1).ok, '重复调任被拒');
// 离线：50%，封顶 8h，不含大客户 ×5
let s2 = E.newState(T0); s2.coins = 1e6; E.hireEmp(s2, 0); s2.shops[0].lv = 10;
const rate = E.baseRate(s2); s2.boostEnd = T0 + 30000;
let off = E.computeOffline(s2, T0 + 2 * 3600e3);
near(off.amount, rate * 0.5 * 7200, '离线 2h = 50%（大客户不放大）');
off = E.computeOffline(s2, T0 + 20 * 3600e3); near(off.effSec, 8 * 3600, '离线封顶 8h');
// settle + claim 防重复
s2.lastSeen = T0; s2.maxSeen = T0;
const now = T0 + 10 * 3600e3; const p = E.settleOffline(s2, now, () => 'id1');
near(p.amount, rate * 0.5 * 8 * 3600, 'pending = 8h×50%');
// 再次刷新（同一时刻）不会叠加
E.settleOffline(s2, now + 1000, () => 'id2'); near(s2.pending.amount, rate * 0.5 * 8 * 3600, '封顶后刷新不叠加');
const cb = s2.coins; const cl = E.claimOffline(s2, now, true);
ok(cl.ok && cl.doubled, '每日双倍可用');
near(s2.coins - cb, rate * 0.5 * 8 * 3600 * 2, '先封顶 8h 再 ×2');
ok(!E.claimOffline(s2, now, true).ok, '不能重复领取');
ok(!E.canDouble(s2, now), '今天双倍已用');
// 每日 5:00 MYT 重置（与手机时区无关）
const d0459 = Date.UTC(2026, 9, 5, 20, 59), d0500 = Date.UTC(2026, 9, 5, 21, 0); // 10/6 04:59 / 05:00 MYT
ok(E.dayKey(d0459) === '2026-10-05' && E.dayKey(d0500) === '2026-10-06', '05:00 MYT 切日');
ok(E.nextResetTs(T0) === d0500, '下次重置 = 明早 05:00 MYT');
// 时间回拨不发奖
let s3 = E.newState(T0); s3.maxSeen = T0 + 3600e3; E.hireEmp(Object.assign(s3, { coins:100 }), 0);
ok(E.computeOffline(s3, T0).rolledBack && !E.canDouble(s3, T0), '回拨时间不发奖励、不给双倍');
// 77 → 科技：离线上限 10h 按离开时安排结算
let s4 = E.newState(T0); s4.coins = 1e12; E.hireEmp(s4, 0); [1, 2, 3].forEach(i => { E.openShop(s4, i); E.hireEmp(s4, i); });
E.assignCeo(s4, 'c77', 3); const r4 = E.baseRate(s4);
near(E.computeOffline(s4, T0 + 20 * 3600e3).effSec, 10 * 3600, '麻辣服务器：离线按 10h 封顶');
near(E.computeOffline(s4, T0 + 20 * 3600e3).amount, r4 * 0.5 * 36000, '离线按离开时的 CEO 安排');
// 盲盒：16 抽不重复，集齐后不扣钱
let s5 = E.newState(T0); s5.coins = 1e12; E.hireEmp(s5, 0); [1, 2, 3].forEach(i => { E.openShop(s5, i); E.hireEmp(s5, i); });
const seen = new Set(); let odds = [];
for (let k = 0; k < 16; k++) { odds.push(E.gachaOdds(s5)); const g = E.gachaDraw(s5, Math.random()); ok(g.ok && !seen.has(g.item.id), '第' + (k + 1) + '抽是新物品'); seen.add(g.item.id); }
near(odds[0], 1 / 16, '初始概率 6.25%'); near(odds[15], 1, '最后一抽 100%');
const cAfter = s5.coins; const g17 = E.gachaDraw(s5, 0.5);
ok(!g17.ok && g17.complete && s5.coins === cAfter, '集齐后不能再买、不扣金币');
ok(E.cardsComplete(s5), '4 张故事卡集齐');
let s6 = E.newState(T0); s6.coins = 1e12; ok(!E.gachaDraw(s6, 0.1).ok && s6.coins === 1e12, '未开放不扣钱');
// 盲盒/外观不加产速
let s7 = E.cloneState(s5); s7.gacha.owned = []; near(E.baseRate(s7), E.baseRate(s5), '收藏品不影响产速');
// 存档迁移 v1 → v2
const v1 = { v:1, coins:1234, shops:[{ open:true, lv:12, hired:true }, { open:true, lv:3, hired:false }, { open:false, lv:0, hired:false }, { open:false, lv:0, hired:false }],
  gacha:{ owned:['k_1', 'k_1', 'bogus'], draws:1 }, lastSeen:T0 - 1000, maxSeen:T0 - 1000, claimLog:[] };
const m = E.migrate(v1, T0);
ok(m.from === 1 && m.st.v === 2, '迁移 v1→v2');
ok(m.st.shops[0].emp === 1 && m.st.shops[1].emp === 0 && m.st.shops[0].lv === 12, '伙伴→员工 Lv1');
ok(m.st.ceos.c77.at === 0 && m.st.ceos.pearl.unlocked && m.st.ceos.pearl.at === 1 && !m.st.ceos.otaku.unlocked, '迁移后 CEO 按开店解锁就位');
ok(m.st.gacha.owned.length === 1, '盲盒去重 + 过滤无效 id');
const bad = E.migrate({ v:2, ceos:{ c77:{ unlocked:true, at:2, lv:3 }, pearl:{ unlocked:true, at:0, lv:1 } }, shops:[{ open:true, lv:1, emp:0 }] }, T0);
ok(bad.st.ceos.c77.at === -1 && bad.st.ceos.pearl.at === 0, '非法 CEO 位置被修正（不在未开张的店）');
ok(E.migrate('garbage', T0).st.v === 2, '坏档 → 新档');
// 熊大文案定稿
const SG = k => E.SIGNS[k].map(x => x[0]).join('／');
ok(SG('c77') === '77烧烤店／七分糖七分拽／摆龙门阵书局／巴适不死机', '77 四块招牌');
ok(SG('pearl') === '掌上明猪烧烤／一颗不剩奶茶／字字珠玑书局／算盘珠子科技', '珍珠姐 四块招牌');
ok(SG('otaku') === '二次元烤肉部／肥宅快乐茶／再看亿页书店／下班再说科技', '阿宅 四块招牌');
ok(SG('rocket') === '老马烧烤／特嘶啦奶茶／漫威书店／火箭科技', '火箭老板 四块招牌');
ok(E.SIGNS.rocket[1][1] === '嘶——这杯加速有点猛。', '特嘶啦奶茶口号');
ok(new Set(Object.values(E.SIGNS).flat().map(x => x[0])).size === 16, '16 块招牌互不重复');
ok(E.SHOPS.map(x => x.emp.name).join() === '阿炭,小满,阿页,小栈', '四位员工新名字');
ok(E.SHOPS[0].emp.line === '翻个面，香气就营业了。' && E.SHOPS[3].emp.line === '代码能重构，午饭不能拖。', '员工台词');
ok(Object.values(E.CROSS).every(x => x.panels.length === 2), '4 个跨行漫画都是两格');
ok(E.CROSS['pearl@2'].panels[1][2].includes('案件没破，奶茶先喝完了') && E.CROSS['otaku@1'].panels[0][2].includes('喝一口，追一格'), '漫画台词定稿');
ok(E.CROSS['rocket@0'].effect === 'bigFreq' && E.CROSS['c77@3'].effect === 'offlineCap' && E.CROSS['pearl@2'].effect === 'tapX2' && E.CROSS['otaku@1'].effect === 'milestonePanel', '跨行效果不变');
// 招牌跟随 ROCKET_NAME 配置（改配置重新加载 economy）
{ const src = require('fs').readFileSync(__dirname + '/economy.js', 'utf8').replace("sign:'老马', tea:'特嘶啦', book:'漫威'", "sign:'老牛', tea:'特快', book:'太空'").replace("short:'火箭'", "short:'飞船'");
  const m = { exports:{} }; new Function('module', 'exports', 'window', src)(m, m.exports, undefined);
  const E2 = m.exports; ok(E2.SIGNS.rocket.map(x => x[0]).join('／') === '老牛烧烤／特快奶茶／太空书店／飞船科技', '火箭老板招牌跟随 ROCKET_NAME 配置'); }
// 交换任职：目标店有人 → 两边都有 $/s 变化
{ const s2 = E.cloneState(st); s2.ceos.c77.at = 3; s2.ceos.otaku.lv = 5; const p2 = E.previewAssign(s2, 'otaku', 3);
  ok(p2.swapped === 'c77' && p2.shops[3].after !== p2.shops[3].before && p2.shops[p2.from].after !== p2.shops[p2.from].before, '交换任职预览：两家店都有收益变化'); }
// 离线收益按离开时阵容：settleOffline 在任何操作前结算
{ const s3 = E.cloneState(st); s3.lastSeen = s3.maxSeen = T0 + 2e9 - 3600e3; const rate = E.baseRate(s3);
  const o = E.settleOffline(s3, T0 + 2e9); ok(o && o.amount > 0, '离线收益已结算'); }
console.log(`economy tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
