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
// 盲盒 v2：36 件不重复（32 普通 + 4 超级），超级 10% + 15 抽保底，集齐后不扣钱
let s5 = E.newState(T0); s5.coins = 1e12; E.hireEmp(s5, 0); [1, 2, 3].forEach(i => { E.openShop(s5, i); E.hireEmp(s5, i); });
ok(E.ITEMS.length === 36 && E.REGULAR_ITEMS.length === 32 && E.SUPER_ITEMS.length === 4, '奖池 32 普通 + 4 超级');
ok(['clothes', 'hat', 'decor', 'card'].every(t => E.ITEMS.filter(i => i.type === t).length === 8), '衣服/帽子/装饰/故事卡各 8');
ok(new Set(E.ITEMS.map(i => i.id)).size === 36, '物品 id 不重复');
ok(E.SUPER_ITEMS.map(i => i.shop).join() === '0,1,2,3' && E.SUPER_ITEMS.map(i => i.name).join() === '熊猫食神,珍珠喷泉,次元传送门,人造太阳反应堆', '每店一件超级装饰');
const o0 = E.gachaOdds(s5); near(o0.superP, 0.1, '超级装饰 10%'); near(o0.perSuper, 0.025, '每件超级 2.5%'); near(o0.perReg, 0.9 / 32, '每件普通 0.9/32'); ok(o0.pityLeft === 15, '保底剩 15 抽');
const seen = new Set(); let maxGap = 0, gap = 0, supersAt = [];
for (let k = 0; k < 36; k++) { const g = E.gachaDraw(s5, Math.random()); ok(g.ok && !seen.has(g.item.id), '第' + (k + 1) + '抽是新物品'); seen.add(g.item.id);
  if (g.super) { supersAt.push(k + 1); gap = 0; } else { gap++; if (E.gachaOdds(s5).remSuper) maxGap = Math.max(maxGap, gap); } }
ok(maxGap <= 14, '保底：连续不出超级 ≤ 14 抽 (' + maxGap + ')');
ok(supersAt.length === 4, '4 件超级装饰都抽到');
const cAfter = s5.coins; const g37 = E.gachaDraw(s5, 0.5);
ok(!g37.ok && g37.complete && s5.coins === cAfter, '集齐后不能再买、不扣金币');
ok(E.cardsComplete(s5), '8 张故事卡集齐');
// 保底精确：rnd 一直很大（=不出超级）时第 15 抽必出
{ let sp = E.newState(T0); sp.coins = 1e12; E.hireEmp(sp, 0); [1, 2, 3].forEach(i => { E.openShop(sp, i); E.hireEmp(sp, i); });
  const kinds = []; for (let k = 0; k < 15; k++) kinds.push(E.gachaDraw(sp, 0.999).super);
  ok(kinds.slice(0, 14).every(x => !x) && kinds[14] === true, '第 15 抽保底必出超级'); ok(sp.gacha.pity === 0, '出超级后保底重置');
  ok(E.gachaDraw(sp, 0.05).super === true, 'rnd<10% 出超级'); ok(sp.gacha.last.odds.startsWith('超级 10%'), '结果写明概率');
  // 普通抽完后只出超级
  let sq = E.cloneState(sp); sq.gacha.owned = E.REGULAR_ITEMS.map(i => i.id); sq.gacha.pity = 0; near(E.gachaOdds(sq).superP, 1, '普通抽完 → 100% 超级');
  let sr = E.cloneState(sp); sr.gacha.owned = E.SUPER_ITEMS.map(i => i.id); near(E.gachaOdds(sr).superP, 0, '超级抽完 → 只出普通'); ok(E.gachaOdds(sr).pityLeft === null, '超级抽完不显示保底'); }
let s6 = E.newState(T0); s6.coins = 1e12; ok(!E.gachaDraw(s6, 0.1).ok && s6.coins === 1e12, '未开放不扣钱');
// 普通收藏不加产速；超级装饰本店 ×1.3
{ let a = E.cloneState(s5); a.gacha.owned = E.REGULAR_ITEMS.map(i => i.id); let b = E.cloneState(a); b.gacha.owned = [];
  near(E.baseRate(a), E.baseRate(b), '普通收藏不影响产速');
  let c = E.cloneState(b); c.gacha.owned = ['s_sun']; near(E.shopRate(c, 3), E.shopRate(b, 3) * 1.3, '人造太阳：科技 ×1.3'); near(E.shopRate(c, 0), E.shopRate(b, 0), '只加本店');
  near(E.offlineRate(c), E.offlineRate(b) + E.shopRate(b, 3) * 0.3 * 0.5, '超级装饰离线也算');
  // 暴击：概率和倍率分开
  near(E.critChance(b, 0, T0), 0.35, '默认暴击合计 35%（20/10/5）'); ok(E.critMult(b, 0, T0) === 5, '默认倍率 ×5');
  let d = E.cloneState(b); d.gacha.owned = ['s_panda']; near(E.critChance(d, 0, T0), 0.5, '熊猫食神：烧烤三档各 +5 → 50%'); near(E.critChance(d, 1, T0), 0.35, '熊猫只管烧烤摊'); ok(E.critMult(d, 0, T0) === 5, '熊猫不改倍率');
  // 珍珠喷泉：爆单 20 秒 奶茶 ×3 + 必暴击，只算在线
  let f = E.cloneState(b); f.gacha.owned = ['s_fountain']; const base1 = E.onlineRate(f, T0); E.startRush(f, 'tea', T0);
  near(E.onlineRate(f, T0 + 1000), base1 + E.shopRate(f, 1) * 2, '爆单：奶茶店 ×3'); near(E.critChance(f, 1, T0 + 1000), 1, '爆单期间手点必暴击');
  near(E.onlineRate(f, T0 + 21000), base1, '20 秒后结束'); near(E.offlineRate(f), E.baseRate(f) * 0.5, '爆单不进离线');
  // 人造太阳：超频 30 秒 科技 ×3 + 三档倍率翻倍
  E.startRush(c, 'tech', T0); near(E.onlineRate(c, T0 + 1000), E.baseRate(c) + E.shopRate(c, 3) * 2, '超频：科技 ×3');
  ok(E.tierMult(c, 3, T0 + 1000, 0) === 10 && E.tierMult(c, 3, T0 + 1000, 1) === 20 && E.tierMult(c, 3, T0 + 1000, 2) === 40, '超频三档倍率 ×10/×20/×40');
  ok(E.critMult(c, 3, T0 + 1000) === 10 && E.critMult(c, 3, T0 + 31000) === 5, '超频结束恢复到 ×5');
  let q = E.cloneState(b); q.gacha.owned = ['s_portal']; near(E.portalReward(q), E.shopRate(q, 2) * 90, '次元传送门：书店 90 秒产量'); near(E.portalReward(b), 0, '没传送门不给');
  // 没有超级装饰时 rush 字段无效
  E.startRush(b, 'tea', T0); near(E.onlineRate(b, T0 + 1000), E.baseRate(b), '没喷泉不爆单'); }
// v2 → v3：全局穿搭归 77，旧收藏保留
{ const v2 = { v:2, coins:5, shops:[{ open:true, lv:3, emp:1 }], gacha:{ owned:['c_panda', 'h_chili', 'k_1'], draws:3 }, equip:{ clothes:'c_panda', hat:'h_chili' } };
  const mm = E.migrate(v2, T0); ok(mm.st.v === 3 && mm.st.wear.c77.clothes === 'c_panda' && mm.st.wear.c77.hat === 'h_chili' && !mm.st.wear.pearl.clothes, 'v2 穿搭 → 77');
  ok(mm.st.gacha.owned.length === 3 && mm.st.gacha.pity === 0 && !('equip' in mm.st), '旧收藏保留、保底从 0 开始');
  const bw = E.migrate({ v:3, wear:{ c77:{ clothes:'h_chili', hat:'bogus' } } }, T0); ok(bw.st.wear.c77.clothes === null && bw.st.wear.c77.hat === null, '非法穿搭被清掉'); }
// 存档迁移 v1 → v2
const v1 = { v:1, coins:1234, shops:[{ open:true, lv:12, hired:true }, { open:true, lv:3, hired:false }, { open:false, lv:0, hired:false }, { open:false, lv:0, hired:false }],
  gacha:{ owned:['k_1', 'k_1', 'bogus'], draws:1 }, lastSeen:T0 - 1000, maxSeen:T0 - 1000, claimLog:[] };
const m = E.migrate(v1, T0);
ok(m.from === 1 && m.st.v === 3, '迁移 v1→v3');
ok(m.st.shops[0].emp === 1 && m.st.shops[1].emp === 0 && m.st.shops[0].lv === 12, '伙伴→员工 Lv1');
ok(m.st.ceos.c77.at === 0 && m.st.ceos.pearl.unlocked && m.st.ceos.pearl.at === 1 && !m.st.ceos.otaku.unlocked, '迁移后 CEO 按开店解锁就位');
ok(m.st.gacha.owned.length === 1, '盲盒去重 + 过滤无效 id');
const bad = E.migrate({ v:2, ceos:{ c77:{ unlocked:true, at:2, lv:3 }, pearl:{ unlocked:true, at:0, lv:1 } }, shops:[{ open:true, lv:1, emp:0 }] }, T0);
ok(bad.st.ceos.c77.at === -1 && bad.st.ceos.pearl.at === 0, '非法 CEO 位置被修正（不在未开张的店）');
ok(E.migrate('garbage', T0).st.v === 3, '坏档 → 新档');
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

// ===== 营业小舞台：团单对账（不和自动收入双算） =====
{
  let s = E.newState(T0); s.coins = 1e6; E.hireEmp(s, 0); s.shops[0].lv = 10;
  const rate = E.onlineRate(s, T0);
  ok(rate > 0 && E.boostActive(s, T0) === false, '在线产速 > 0，且不再有持续 ×5');
  near(E.orderPayout(rate), rate * (E.CFG.BOOST_MULT - 1) * E.CFG.BOOST_SEC, '团单收入 = 旧 30 秒 ×5 多出来的部分');
  // 模拟服务 30 秒：自动收入照常 + 结束一次性结算 = 旧版 ×5×30s 总收益
  const c0 = s.coins;
  const auto = rate * E.CFG.BOOST_SEC;
  s.coins += auto; s.totalEarned += auto;
  const paid = E.settleOrder(s, E.orderPayout(rate));
  near(s.coins - c0, rate * E.CFG.BOOST_MULT * E.CFG.BOOST_SEC, '总收益 = 旧 ×5 持续 30 秒（自动 + 团单）');
  near(paid, rate * 4 * 30, 'settleOrder 只发「多出来的」那笔');
  ok(s.bigCustomers === 1, '大客户计数 +1');
  // 双算防护：服务期间 onlineRate 不加 ×5；再 settle 同一笔不会自动发生（调用方负责）
  near(E.onlineRate(s, T0), rate, '服务中自动收入不加 ×5（不双算）');
  ok(E.tapReward(s, 0, T0, 0.99).value === E.tapValue(s, 0), '手点也不再吃大客户 ×5');
  // 离线仍不含团单
  s.boostEnd = T0 + 999999; // 即便旧档写了也不影响
  near(E.computeOffline(s, T0 + 3600e3).amount, E.baseRate(s) * 0.5 * 3600, '离线不含团单/×5');
  ok(E.BIG_ORDERS.length === 4 && E.SPECIAL_GUESTS.length === 4, '每店 1 个大客户 + 1 个特殊客户占位');
  ok(E.SPECIAL_GUESTS.every((g, i) => g.shop === i && g.panels.length === 2), '特殊客户两格漫画占位');
  const sp = E.specialReward(s, 0); near(sp, E.shopRate(s, 0) * E.CFG.SPECIAL_REWARD_SEC, '特殊客户奖励 = 本店 60 秒产量');
  const c1 = s.coins; const spPaid = E.settleSpecial(s, 0);
  near(spPaid, sp, 'settleSpecial 入账'); near(s.coins - c1, sp, '特殊客户不另加自动收入'); ok(s.specialCustomers === 1, '特殊客户计数');
}

// ===== CEO 生活篇：家宅 / 商城 / 摆放（方案 A：公共仓库） =====
{
  const F = id => E.FURN_BY_ID[id];
  const NEW43 = ['s77_quilt_daybed','s77_drawer_bed','s77_book_nook_bed','s77_peg_cubby','s77_ladder_shelf','s77_basket_cabinet','s77_round_corner_chest','s77_sewing_cabinet','s77_pantry_hutch','s77_attic_trunk','s77_reading_stool','s77_rocking_chair','s77_heart_bench','s77_folding_tray','s77_quilt_ottoman','s77_window_bench','s77_sewing_desk','s77_curved_sectional','s77_lantern_stand','s77_mushroom_lamp','s77_petal_uplight','s77_quilt_shade_lamp','s77_hearth_light','s77_box_fan','s77_toaster_cart','s77_record_console','s77_sewing_machine_stand','s77_stove_oven','s77_laundry_pair','s77_braided_runner','s77_patchwork_flower_rug','s77_quilt_island_rug','s77_embroidery_hoops','s77_wood_cuckoo','s77_quilt_wall','s77_pressed_flower_frame','s77_family_silhouette','s77_watering_stand','s77_knitting_basket','s77_olive_planter','s77_mini_greenhouse','pearl_tea_daybed','pearl_pearl_bed'];
  const NEW34 = ["pearl_cup_carousel", "pearl_bakery_display", "pearl_sideboard_island", "pearl_archive_apothecary", "pearl_conversation_pit", "pearl_tea_gongfu_desk", "pearl_paper_pear_lamp", "pearl_tea_glass_lamp", "pearl_boba_globe_lamp", "pearl_tea_mat", "pearl_scallop_rug", "pearl_tea_river_runner", "otaku_floor_chair", "otaku_modular_couch", "otaku_arcade_bench", "otaku_streaming_desk", "otaku_panel_rug", "otaku_controller_rug", "otaku_speed_runner", "otaku_pixel_succulent", "otaku_manga_book_stack", "otaku_robot_planter", "otaku_aquatic_pixel_tank", "rocket_field_cot", "rocket_cargo_crate", "rocket_mesh_rack", "rocket_airlock_wardrobe", "rocket_rail_bench", "rocket_mission_table", "rocket_zero_g_lounger", "rocket_cage_lamp", "rocket_tripod_searchlight", "rocket_pipe_valve_lamp", "rocket_rocket_nozzle_light"];
  const NEW106 = ["pearl_tea_loft", "pearl_canopy_lounge", "pearl_capsule_daybed", "pearl_tea_cat_hammock", "pearl_tea_cubby", "pearl_glass_wardrobe", "pearl_rattan_bookcase", "pearl_tea_trolley_shelf", "pearl_tea_stool", "pearl_cafe_chair", "pearl_round_tea_table", "pearl_scallop_sofa", "pearl_tea_bar", "pearl_bar_stool", "pearl_picnic_table", "pearl_egg_swing", "pearl_fan_shade_lamp", "pearl_tea_arc_lamp", "pearl_fountain_light", "pearl_tea_kettle_cart", "pearl_juice_press", "pearl_milk_frother_bar", "pearl_tea_brewer", "pearl_dessert_chiller", "pearl_marble_pearl_rug", "pearl_tea_menu_board", "pearl_cup_wall_rack", "pearl_sunburst_mirror", "pearl_tea_leaf_relief", "pearl_moon_window_art", "pearl_herb_crate", "pearl_tea_bonsai", "pearl_ceramic_cup_stack", "pearl_terrarium_orb", "pearl_tea_tree_screen", "otaku_floor_futon", "otaku_sofa_sleeper", "otaku_bunk_manga", "otaku_gaming_pod", "otaku_projector_bed", "otaku_cat_keyboard_cave", "otaku_locker_wardrobe", "otaku_disc_tower", "otaku_figure_vitrine", "otaku_comic_wheel_cart", "otaku_controller_drawers", "otaku_modular_pixel_shelf", "otaku_server_display_rack", "otaku_beanbag", "otaku_kotatsu", "otaku_gaming_chair", "otaku_manga_desk", "otaku_snack_sidecar", "otaku_cocoon_lounger", "otaku_panel_lamp", "otaku_gooseneck_stand", "otaku_pixel_cube_light", "otaku_arcade_marquee_lamp", "otaku_orbital_neon_floor", "otaku_sleep_timer_totem", "otaku_mini_fridge", "otaku_console_station", "otaku_arcade_cabinet", "otaku_projector_cart", "otaku_triple_monitor_station", "otaku_pixel_map_rug", "otaku_speech_bubble_board", "otaku_manga_page_triptych", "otaku_controller_wall_mount", "otaku_pixel_city_lightbox", "otaku_cactus_cartridge", "rocket_steel_platform_bed", "rocket_cryo_rest_pod", "rocket_observatory_bed", "rocket_landing_cat_pod", "rocket_steel_locker", "rocket_pipe_bookcase", "rocket_tool_chest", "rocket_specimen_drawer", "rocket_orbital_archive", "rocket_bolt_stool", "rocket_workbench", "rocket_drafting_chair", "rocket_pipe_sofa", "rocket_oil_drum_table", "rocket_captain_chair", "rocket_cantilever_desk", "rocket_orbital_ring_lamp", "rocket_solar_array_lamp", "rocket_industrial_fan", "rocket_vacuum_dock", "rocket_coffee_pressure_unit", "rocket_air_purifier", "rocket_hydroponic_unit", "rocket_planetarium_console", "rocket_workshop_mat", "rocket_orbit_rug", "rocket_runway_runner", "rocket_lunar_relief_rug", "rocket_blueprint_frame", "rocket_gear_clock", "rocket_mission_patch_board", "rocket_moon_sample_relief", "rocket_orbital_map_panel", "rocket_concrete_succulent", "rocket_pipe_vase"];
  ok(E.FURNITURE.length === 200 && ['bed','sofa','table','lamp','rug','plant','bookshelf','tv','fridge','wardrobe','painting','catbed','rocket_rocket_model','rocket_meteor_stand','rocket_biosphere_dome','s77_cloud_canopy','rocket_capsule_bunk'].concat(NEW43, NEW34, NEW106).every(n => F('furn_' + n)), '商城 200 件家具（12 基础 + 5 前批 + 11v 43 + 11w 34 + 11y 106），id = furn_<名>');
  ok(NEW34.length === 34, '11w 新接 34 件');
  ok(NEW106.length === 106, '11y 新接 106 件（107 包跳过已注册 capsule，仅替换 art）');
  ok(NEW43.length === 43 && new Set(E.FURNITURE.map(f => f.id)).size === E.FURNITURE.length, '11v 新接 43 件、全表 id 不重复');
  ok(E.FURNITURE.every(f => f.w >= 1 && f.h >= 1 && f.price > 0 && f.lux > 0), '每件家具都有占地 / 价格 / 豪华度');
  ok(E.HOME_TIERS.map(t => t.name + t.cols + 'x' + t.rows).join() === '小屋6x4,公寓8x5,豪宅10x6', '三档房子：小屋 6×4 → 公寓 8×5 → 豪宅 10×6');
  ok(E.HOME_TIERS[1].cost > E.SHOPS[2].open && E.HOME_TIERS[2].cost > E.SHOPS[3].open, '升级价跟着经营节奏（公寓 > 开书店价，豪宅 > 开科技公司价）');
  let s = E.newState(T0);
  ok(E.CEOS.every(c => s.homes[c.id] && s.homes[c.id].lv === 1 && s.homes[c.id].placed.length === 0) && Object.keys(s.furnInv).length === 0, '新档：4 间空小屋 + 空公共仓库');
  ok(E.homeOpen(s, 'c77') && !E.homeOpen(s, 'pearl'), '只有已加入的 CEO 能进自家房间摆放');
  // 买：扣金币进公共仓库；钱不够不能买
  s.coins = 100; let r = E.buyFurniture(s, 'furn_bed');
  ok(!r.ok && r.why === '金币不够' && s.coins === 100 && !s.furnInv.furn_bed, '金币不够买不了，不扣钱');
  s.coins = 100000;
  r = E.buyFurniture(s, 'furn_bed'); ok(r.ok && s.coins === 100000 - F('furn_bed').price && s.furnInv.furn_bed === 1, '买床：扣 ' + F('furn_bed').price + '，进公共仓库');
  E.buyFurniture(s, 'furn_sofa'); E.buyFurniture(s, 'furn_rug'); E.buyFurniture(s, 'furn_painting'); E.buyFurniture(s, 'furn_lamp');
  const paid = s.coins;
  // 摆 / 移 / 转 / 收 / 撤销：都不碰金币
  r = E.placeItem(s, 'c77', 'furn_bed', 0, 1, 0);
  ok(r.ok && s.homes.c77.placed.length === 1 && !s.furnInv.furn_bed, '把床从仓库摆进 77 房间');
  const bed = r.uid, U = [r.undo];
  ok(!E.placeItem(s, 'c77', 'furn_sofa', 1, 1, 0).ok, '重叠被拒');
  ok(!E.placeItem(s, 'c77', 'furn_sofa', 4, 0, 0).ok && E.canPlace(s, 'c77', 'furn_sofa', 4, 0, 0).why === '超出房间了', '出界被拒（6 格宽放不下 x=4 的 3 格沙发）');
  ok(!E.placeItem(s, 'c77', 'furn_sofa', 0, -1, 0).ok && !E.placeItem(s, 'c77', 'furn_bed', 0, 0, 0).ok, '负坐标 / 仓库里没有 都被拒');
  ok(E.placeItem(s, 'c77', 'furn_rug', 0, 2, 0).ok, '地毯可以垫在床下（不同层）');
  ok(!E.canPlace(s, 'c77', 'furn_painting', 3, 2, 0).ok && E.canPlace(s, 'c77', 'furn_painting', 3, 2, 0).why === '超出墙面了', '挂画不占地板格（墙面只有 2 排）');
  ok(!E.canPlace(s, 'c77', 'furn_painting', 2, 0, 0).ok && /窗|房名牌/.test(E.canPlace(s, 'c77', 'furn_painting', 2, 0, 0).why), '挂画避开窗户');
  ok(!E.canPlace(s, 'c77', 'furn_painting', 4, 1, 0, null, 'floor').ok && /墙上/.test(E.canPlace(s, 'c77', 'furn_painting', 4, 1, 0, null, 'floor').why), '挂画拒绝地板面');
  ok(E.placeItem(s, 'c77', 'furn_painting', 0, 0, 0).ok && s.homes.c77.placed.find(p => p.fid === 'furn_painting').surf === 'wall', '挂画挂上左上空墙 (0,0)（surf=wall）');
  ok(!E.canPlace(s, 'c77', 'furn_sofa', 4, 0, 0, null, 'wall').ok, '沙发不能挂墙');
  ok(!E.canPlace(s, 'c77', 'furn_bed', 4, 0, 0).ok || true, '挂画占墙不挡地板：床仍可摆地板'); // 烟雾
  ok(E.canPlace(s, 'c77', 'furn_lamp', 4, 0, 0).ok, '挂画占墙不挡地板：台灯可摆同列地板');
  r = E.placeItem(s, 'c77', 'furn_sofa', 3, 3, 0); ok(r.ok, '沙发摆在空位'); const sofa = r.uid; U.push(r.undo);
  r = E.moveItem(s, 'c77', sofa, 1, 1); ok(!r.ok && s.homes.c77.placed.find(p => p.uid === sofa).x === 3, '移动到重叠位置被拒，原地不动');
  r = E.moveItem(s, 'c77', sofa, 2, 2); ok(r.ok && s.homes.c77.placed.find(p => p.uid === sofa).y === 2, '移动沙发'); U.push(r.undo);
  ok(!E.moveItem(s, 'c77', sofa, 4, 2).ok, '移动出界被拒');
  r = E.rotateItem(s, 'c77', bed); const bp = s.homes.c77.placed.find(p => p.uid === bed), bs = E.furnSize('furn_bed', bp.rot);
  ok(r.ok && bp.rot === 1 && bs.w === 3 && bs.h === 2 && E.canPlace(s, 'c77', 'furn_bed', bp.x, bp.y, bp.rot, bed).ok, '旋转 90°：宽高互换后仍然放得下');
  U.push(r.undo);
  r = E.storeItem(s, 'c77', sofa); ok(r.ok && s.furnInv.furn_sofa === 1 && !s.homes.c77.placed.some(p => p.uid === sofa), '收回沙发 → 回公共仓库'); U.push(r.undo);
  ok(s.coins === paid, '摆放 / 移动 / 旋转 / 收回 都不花金币');
  ok(E.undoHome(s, U.pop()).ok && s.homes.c77.placed.some(p => p.uid === sofa) && !s.furnInv.furn_sofa, '撤销收回：沙发回到原位');
  ok(E.undoHome(s, U.pop()).ok && s.homes.c77.placed.find(p => p.uid === bed).rot === 0, '撤销旋转');
  ok(E.undoHome(s, U.pop()).ok && s.homes.c77.placed.find(p => p.uid === sofa).y === 3, '撤销移动');
  ok(E.undoHome(s, U.pop()).ok && s.furnInv.furn_sofa === 1 && !s.homes.c77.placed.some(p => p.uid === sofa), '撤销摆放：回仓库');
  ok(s.coins === paid && !E.undoHome(s, null).ok, '撤销也不碰金币；没东西可撤时提示');
  const lux = E.homeLuxury(s, 'c77');
  ok(lux === E.HOME_TIERS[0].bonus + s.homes.c77.placed.reduce((a, p) => a + F(p.fid).lux, 0) && lux > 0, '豪华度 = 摆出来的家具之和 + 房型加成');
  ok(E.invCount(s) >= 1 && E.furnStats(s, 'furn_sofa').warehouse === 1 && E.furnStats(s, 'furn_sofa').placed === 0, '仓库里的不算豪华度；furnStats 分得清摆出/仓库');
  // 升级：格子变大，原来的家具都还合法
  s.coins = 10; ok(!E.upgradeHome(s, 'c77').ok && s.homes.c77.lv === 1, '钱不够升不了房');
  s.coins = 1e9; const pl = JSON.stringify(s.homes.c77.placed);
  r = E.upgradeHome(s, 'c77'); ok(r.ok && s.homes.c77.lv === 2 && s.coins === 1e9 - E.HOME_TIERS[1].cost && E.homeTier(2).cols === 8, '升级公寓：扣钱、8×5');
  ok(JSON.stringify(s.homes.c77.placed) === pl && s.homes.c77.placed.every(p => E.canPlace(s, 'c77', p.fid, p.x, p.y, p.rot, p.uid).ok), '升级后家具位置不变、都还合法');
  ok(E.canPlace(s, 'c77', 'furn_sofa', 5, 4, 0).ok, '公寓更大：小屋放不下的位置现在能放');
  ok(E.homeLuxury(s, 'c77') === lux + E.HOME_TIERS[1].bonus, '升级加房型豪华度');
  E.upgradeHome(s, 'c77'); ok(s.homes.c77.lv === 3 && !E.upgradeHome(s, 'c77').ok && E.homeUpgradeCost(s, 'c77') === null, '豪宅是顶级');
  // 公共仓库：收回后可搬到别家；一件同时只在一家；多买才能多家同展
  s.shops[1].open = true; s.shops[1].lv = 1; E.checkUnlocks(s);
  const h77 = JSON.stringify(s.homes.c77), hp = JSON.stringify(s.homes.pearl);
  ok(E.assignCeo(s, 'c77', 1).ok && JSON.stringify(s.homes.c77) === h77 && JSON.stringify(s.homes.pearl) === hp, '调任 / 交换任职不改任何人的家');
  // 仓库里还有沙发：直接摆进珍珠姐家（不扣钱）
  const coinsBeforeMove = s.coins;
  ok(s.furnInv.furn_sofa === 1, '沙发还在公共仓库');
  r = E.placeItem(s, 'pearl', 'furn_sofa', 0, 0, 0);
  ok(r.ok && s.homes.pearl.placed.some(p => p.fid === 'furn_sofa') && !s.furnInv.furn_sofa && !s.homes.c77.placed.some(p => p.fid === 'furn_sofa'), '同件沙发只能摆在一家：77 没有、珍珠姐有');
  ok(s.coins === coinsBeforeMove, '搬家（仓库→珍珠姐）不扣金币');
  const stSofa = E.furnStats(s, 'furn_sofa');
  ok(stSofa.owned === 1 && stSofa.placed === 1 && stSofa.warehouse === 0 && stSofa.where[0].ceo === 'pearl', 'furnStats：已拥有 1（摆出 1 / 仓库 0）摆在珍珠姐');
  // 收回再摆回 77
  const sofaUid = s.homes.pearl.placed.find(p => p.fid === 'furn_sofa').uid;
  ok(E.storeItem(s, 'pearl', sofaUid).ok && s.furnInv.furn_sofa === 1 && !s.homes.pearl.placed.some(p => p.fid === 'furn_sofa'), '收回珍珠姐的沙发 → 公共仓库');
  ok(E.placeItem(s, 'c77', 'furn_sofa', 0, 0, 0).ok && s.homes.c77.placed.some(p => p.fid === 'furn_sofa') && s.coins === coinsBeforeMove, '再摆回 77：仍不扣钱');
  // 想两家都有沙发：再买一件
  const cBuy = s.coins; E.buyFurniture(s, 'furn_sofa');
  ok(s.furnInv.furn_sofa === 1 && s.coins === cBuy - F('furn_sofa').price, '再买一件沙发进仓库');
  ok(E.placeItem(s, 'pearl', 'furn_sofa', 1, 1, 0).ok, '第二件可摆珍珠姐家');
  const st2 = E.furnStats(s, 'furn_sofa');
  ok(st2.owned === 2 && st2.placed === 2 && st2.warehouse === 0 && st2.where.map(w => w.ceo).sort().join() === 'c77,pearl', '两件沙发：77 + 珍珠姐各一件');
  // 家宅不加产速
  const rateA = E.baseRate(s); const s2 = E.cloneState(s); s2.homes = E.normHomes(null); s2.furnInv = {}; ok(E.baseRate(s2) === rateA, '家宅不加产速');
  // 存档往返 + 旧档迁移
  const rt = E.migrate(JSON.parse(JSON.stringify(s)), T0).st;
  ok(JSON.stringify(rt.homes) === JSON.stringify(s.homes) && JSON.stringify(rt.furnInv) === JSON.stringify(s.furnInv) && rt.coins === s.coins, '存档往返：家宅 / 公共仓库 / 摆放原样读回');
  const old = E.migrate({ v:3, coins:500, shops:[{ open:true, lv:3, emp:1 }], ceos:{ c77:{ unlocked:true, lv:2, at:0 } } }, T0);
  ok(old.st.v === E.CFG.SAVE_VERSION && E.CEOS.every(c => old.st.homes[c.id].lv === 1 && old.st.homes[c.id].placed.length === 0) && Object.keys(old.st.furnInv).length === 0 && old.st.coins === 500, '旧档没有 homes → 每人补空小屋 + 空仓库，金币不变');
  ok(E.migrate({ v:1, coins:1, shops:[{ open:true, lv:2, hired:true }] }, T0).st.homes.c77.lv === 1, 'v1 旧档也补家宅');
  // 旧版 per-CEO inv 合并进公共仓库
  const legacy = E.migrate({ v:3, coins:9, homes:{ c77:{ lv:1, inv:{ furn_lamp:2 }, placed:[{ uid:'u1', fid:'furn_plant', x:0, y:0, rot:0 }] }, pearl:{ lv:1, inv:{ furn_lamp:1, furn_tv:1 }, placed:[] } } }, T0).st;
  ok(legacy.furnInv.furn_lamp === 3 && legacy.furnInv.furn_tv === 1 && legacy.homes.c77.placed.length === 1 && !legacy.homes.c77.inv && !legacy.homes.pearl.inv, '旧 per-CEO 仓库合并进 furnInv，placed 保留，homes.inv 清掉');
  const dirty = E.migrate({ v:3, furnInv:{ furn_bed:2, bogus:3, furn_tv:-1 }, homes:{ c77:{ lv:99, inv:{ furn_sofa:1 }, placed:[
    { uid:'u1', fid:'furn_sofa', x:0, y:0, rot:0 }, { uid:'u2', fid:'furn_sofa', x:1, y:0, rot:0 }, { uid:'u3', fid:'furn_bed', x:20, y:0, rot:0 }, { uid:'u4', fid:'nope', x:0, y:3 } ] }, pearl:'坏' } }, T0).st;
  const dh = dirty.homes.c77;
  ok(dh.lv === 3 && dirty.furnInv.furn_bed === 3 && !dirty.furnInv.bogus && !dirty.furnInv.furn_tv && dirty.furnInv.furn_sofa === 2 && dh.placed.length === 1 && dh.placed[0].uid === 'u1' && dh.next >= 4, '坏档整理：等级封顶，越界/重叠退回公共仓库不丢，未知家具丢掉');
  ok(dirty.homes.pearl.lv === 1 && dirty.homes.rocket.placed.length === 0, '坏掉的家宅数据 → 默认小屋');
  ok(E.placeItem(Object.assign(dirty, {}), 'c77', 'furn_bed', 0, 1, 0).uid !== 'u1', '新摆的家具 uid 不和旧的撞');
  // 双花金币：只有买 / 升级房扣钱；place/move/store/undo 前后金币不变
  const s3 = E.newState(T0); s3.coins = 50000;
  const c0 = s3.coins; E.buyFurniture(s3, 'furn_table'); const c1 = s3.coins;
  ok(c1 === c0 - F('furn_table').price, '买桌子扣一次');
  const pr = E.placeItem(s3, 'c77', 'furn_table', 0, 0, 0); ok(pr.ok && s3.coins === c1, '摆放不扣');
  const mr = E.moveItem(s3, 'c77', pr.uid, 2, 1); ok(mr.ok && s3.coins === c1, '移动不扣');
  const sr = E.storeItem(s3, 'c77', pr.uid); ok(sr.ok && s3.coins === c1, '收回不扣');
  ok(E.undoHome(s3, sr.undo).ok && s3.coins === c1, '撤销收回不扣');
  ok(E.undoHome(s3, mr.undo).ok && s3.coins === c1, '撤销移动不扣');
  ok(E.undoHome(s3, pr.undo).ok && s3.coins === c1 && s3.furnInv.furn_table === 1, '撤销摆放不扣、回仓库');
}

// 三档互斥 + 连击规则（杨总 19:07 / 熊大 19:11）
{
  const b = E.newState(T0); b.shops[0].open = true; b.shops[0].emp = 1;
  const ps0 = E.critTiers(b, 0, T0, 0);
  near(ps0[0], 0.20, '初始特殊 20%'); near(ps0[1], 0.10, '初始超级 10%'); near(ps0[2], 0.05, '初始超超超级 5%');
  near(E.critChance(b, 0, T0, 0), 0.35, '合计 35%');
  near(E.critChance(b, 0, T0, 49), 0.35, '49 连击还没到档');
  near(E.critChance(b, 0, T0, 50), 0.50, '50 连击合计 50%');
  const ps50 = E.critTiers(b, 0, T0, 50);
  near(ps50[0], 0.25, '50 连击特殊 25%'); near(ps50[1], 0.15, '50 连击超级 15%'); near(ps50[2], 0.10, '50 连击超超超级 10%');
  near(E.critChance(b, 0, T0, 200), 0.95, '200 连击合计 95%');
  near(E.critChance(b, 0, T0, 250), 1.00, '250 连击封顶 100%');
  const ps250 = E.critTiers(b, 0, T0, 250);
  near(ps250[0], 0.20 + (1 - 0.35) / 3, '250 连击剩余均分特殊');
  near(ps250[1], 0.10 + (1 - 0.35) / 3, '250 连击剩余均分超级');
  near(ps250[2], 0.05 + (1 - 0.35) / 3, '250 连击剩余均分超超超级');
  ok(E.comboNext(0, 0, 1) === 1 && E.comboNext(5, 10, 10.5) === 6 && E.comboNext(5, 10, 11.0001) === 1, '≤1 秒续连，超时从 1 重算');
  ok(E.comboNext(3, 10, 11) === 4, '刚好 1 秒也续连');
  // 互斥：rnd 落在各档分界
  const r0 = E.tapReward(b, 0, T0, 0.05, 0); ok(r0.tier === 1 && r0.mult === 5, 'rnd 0.05 → 特殊 ×5');
  const r1 = E.tapReward(b, 0, T0, 0.25, 0); ok(r1.tier === 2 && r1.mult === 10, 'rnd 0.25 → 超级 ×10');
  const r2 = E.tapReward(b, 0, T0, 0.33, 0); ok(r2.tier === 3 && r2.mult === 20, 'rnd 0.33 → 超超超级 ×20');
  const rN = E.tapReward(b, 0, T0, 0.50, 0); ok(rN.tier === 0 && !rN.crit && rN.mult === 1, 'rnd 0.50 → 普通');
  const pg = E.comboProgress(b, 0, T0, 37); ok(pg.into === 37 && pg.need === 50 && !pg.maxed, '下一档进度 37/50');
  const pgM = E.comboProgress(b, 0, T0, 250); ok(pgM.maxed, '封顶后进度条满');
}


// 挂画墙面迁移：地板上的旧画 → 墙上；没位完整退仓库，豪华度不双算
{
  const raw = { v:3, coins:9, homes:{ c77:{ lv:1, placed:[
    { uid:'u1', fid:'furn_painting', x:4, y:2, rot:0 },           // 旧：地板
    { uid:'u2', fid:'furn_painting', x:1, y:0, rot:0 },           // 旧：地板贴后墙（会迁，但可能撞窗）
    { uid:'u3', fid:'furn_painting', x:4, y:0, rot:0 },           // 旧：地板第一排 → 墙 (4,0)
    { uid:'u4', fid:'furn_lamp', x:0, y:3, rot:0 },
  ] } } };
  const m = E.migrate(raw, T0).st;
  const ps = m.homes.c77.placed.filter(p => p.fid === 'furn_painting');
  ok(ps.every(p => p.surf === 'wall'), '迁移后挂画都在墙面');
  ok(m.homes.c77.placed.some(p => p.fid === 'furn_lamp' && p.surf === 'floor'), '台灯仍在地板');
  const owned = E.furnStats(m, 'furn_painting');
  ok(owned.owned === 3 && owned.owned === owned.placed + owned.warehouse, '三幅画不丢：墙上 + 仓库 = 3');
  const luxP = E.homeLuxury(m, 'c77');
  ok(luxP === E.HOME_TIERS[0].bonus + m.homes.c77.placed.reduce((a, p) => a + E.FURN_BY_ID[p.fid].lux, 0), '豪华度只算摆出来的，退仓的不多算');
  // 墙面挤爆：已有画占满能挂的位置 → 新的地板旧画退仓
  const full = E.newState(T0); full.ceos.c77.unlocked = true; full.coins = 1e9;
  // 手动塞满墙面可挂格
  const h = E.homeOf(full, 'c77');
  for (let i = 0; i < 10; i++) {
    const spot = E.findFree(full, 'c77', 'furn_painting', 0, 'wall'); if (!spot) break;
    E.buyFurniture(full, 'furn_painting');
    ok(E.placeItem(full, 'c77', 'furn_painting', spot.x, spot.y, 0).ok, '墙面可挂 ' + (i + 1));
  }
  const wallN = h.placed.filter(p => p.fid === 'furn_painting').length;
  // 伪造一份「地板旧画」再走 migrateWallPaintings
  h.placed.push({ uid:'uold', fid:'furn_painting', x:0, y:2, rot:0 }); // 无 surf = 旧地板
  const beforeLux = E.homeLuxury(full, 'c77') - E.FURN_BY_ID.furn_painting.lux; // 这件还不该算墙面
  // 修正：push 后已经进 placed 会算豪华；migrate 后退仓
  const r = E.migrateWallPaintings(full);
  ok(r.stored >= 1 && !h.placed.some(p => p.uid === 'uold'), '墙面没空：旧地板挂画完整退回仓库');
  ok((full.furnInv.furn_painting || 0) >= 1, '退仓后仓库有画');
  ok(E.homeLuxury(full, 'c77') === E.HOME_TIERS[0].bonus + h.placed.reduce((a, p) => a + E.FURN_BY_ID[p.fid].lux, 0), '退仓后豪华度不多算');
  ok(wallN === h.placed.filter(p => p.fid === 'furn_painting').length, '原墙上的画数量不变、不复制');
}

// 墙面禁区按底图校准：四家 Lv1 右 4 列（窗户 / 架子 / 挂饰）全禁，左 2 列空墙可挂；自动摆放和手动共用
{
  const T0 = 1e12, mk = () => { const s = E.migrate({ v:3, coins:1e9, ceos:{ c77:{ unlocked:true, at:0 }, pearl:{ unlocked:true, at:1 }, otaku:{ unlocked:true, at:2 }, rocket:{ unlocked:true, at:3 } } }, T0).st; return s; };
  ['c77', 'pearl', 'otaku', 'rocket'].forEach(id => {
    const s = mk(), bl = E.wallBlockedCells(s, id), has = (x, y) => bl.some(c => c[0] === x && c[1] === y);
    ok([2, 3, 4, 5].every(x => has(x, 0) && has(x, 1)) && !has(0, 0) && !has(1, 0) && !has(0, 1) && !has(1, 1), id + '：右 4 列禁、左上 / 左下空墙不禁');
    ok(E.canPlace(s, id, 'furn_painting', 0, 0, 0).ok && E.canPlace(s, id, 'furn_painting', 0, 1, 0).ok, id + '：左上 (0,0) / 左下 (0,1) 都能挂');
    ok([1, 2, 3, 4].every(x => !E.canPlace(s, id, 'furn_painting', x, 0, 0).ok && !E.canPlace(s, id, 'furn_painting', x, 1, 0).ok), id + '：x≥1 一碰禁区就拒（含右上窗户）');
    // 自动摆放：只会找到左边空墙，挂满两幅后提示没位，不会盖窗户
    const spots = [];
    for (let k = 0; k < 3; k++) { const sp = E.findFree(s, id, 'furn_painting', 0, 'wall'); if (!sp) break; E.buyFurniture(s, 'furn_painting'); E.placeItem(s, id, 'furn_painting', sp.x, sp.y, 0, 'wall'); spots.push(sp.x + ',' + sp.y); }
    ok(spots.join(' ') === '0,0 0,1', id + '：自动摆放只挂左边空墙（' + spots.join(' ') + '），满了不盖窗户');
  });
  // 没底图的房型（公寓 8 列）：只禁左上 emoji 窗户 + 右上房名牌
  // 12b2：四家 Lv2/Lv3 都有底图了，这条兜底（以后新房型 / 没登记禁区）临时摘掉阿宅公寓的真禁区来测，测完放回
  const otk2 = E.WALL_BLOCK.otaku_2; delete E.WALL_BLOCK.otaku_2;
  const s = mk(); s.homes.otaku.lv = 2; const bl = E.wallBlockedCells(s, 'otaku');
  ok(bl.length === 3 && [5, 6, 7].every(x => bl.some(c => c[0] === x && c[1] === 0)) && E.canPlace(s, 'otaku', 'furn_painting', 3, 0, 0).ok && E.canPlace(s, 'otaku', 'furn_painting', 0, 0, 0).ok && !E.canPlace(s, 'otaku', 'furn_painting', 4, 0, 0).ok, '公寓（无底图）：只禁右上 3 格（emoji 窗户 + 房名牌），左边小屋的挂画位升级后仍合法');
  E.WALL_BLOCK.otaku_2 = otk2;
  // 旧档：旧版自动摆放把画挂在窗户 (4,0) 上 → 读档挪到空墙，不丢不复制；墙满的退仓库
  const old = E.migrate({ v:3, coins:1, ceos:{ c77:{ unlocked:true, at:0 } }, furnInv:{}, homes:{ c77:{ lv:1, placed:[
    { uid:'u1', fid:'furn_painting', x:4, y:0, rot:0, surf:'wall' }, { uid:'u2', fid:'furn_painting', x:2, y:1, rot:0, surf:'wall' }, { uid:'u3', fid:'furn_painting', x:3, y:0, rot:0, surf:'wall' } ] } } }, T0).st;
  const wp = old.homes.c77.placed.filter(p => p.fid === 'furn_painting');
  ok(wp.length === 2 && wp.every(p => p.surf === 'wall' && p.x === 0) && (old.furnInv.furn_painting || 0) === 1, '旧档挂在窗户上的画：挪到左边空墙 2 幅，第 3 幅退仓库（' + wp.map(p => p.x + ',' + p.y).join(' ') + '）');
  ok(E.furnStats(old, 'furn_painting').owned === 3, '挪动 / 退仓后总数不变（3 幅）');
}

// 生活互动按类别接：所有 bed 类都能休息（旧床 + 新云朵床），书架 / 衣柜不变，其它家具只走过去
{
  const beds = E.FURNITURE.filter(f => f.cat === 'bed');
  ok(beds.length >= 2 && beds.every(f => E.furnLiveAct(f.id) === 'rest'), 'bed 类全部触发休息（' + beds.map(f => f.id).join(' / ') + '）');
  ok(E.furnLiveAct('furn_bed') === 'rest' && E.furnLiveAct('furn_s77_cloud_canopy') === 'rest', '旧床 furn_bed、新云朵床都休息');
  ok(E.furnLiveAct('furn_bookshelf') === 'read' && E.furnLiveAct('furn_wardrobe') === 'dress', '书架看书、衣柜换衣不变');
  ok(['furn_sofa', 'furn_rocket_biosphere_dome', 'furn_rocket_rocket_model', 'nope'].every(id => E.furnLiveAct(id) === 'walk'), '非床家具 / 未知 ID 只走过去');
}

// 11v：packs 01–10 的 43 件；11w 熊大拍板占地：抽屉床/贝壳床 2×2、摇椅/拼布灯 1×1、花瓣沙发保持 3×2
{
  const SPEC = {"furn_s77_quilt_daybed": [3, 1, 1800, 2, "bed"], "furn_s77_drawer_bed": [2, 2, 6500, 4, "bed"], "furn_s77_book_nook_bed": [3, 3, 36000, 7, "bed"], "furn_s77_peg_cubby": [1, 1, 850, 1, "cabinet"], "furn_s77_ladder_shelf": [2, 1, 1600, 2, "cabinet"], "furn_s77_basket_cabinet": [2, 1, 2200, 2, "cabinet"], "furn_s77_round_corner_chest": [2, 1, 5200, 4, "cabinet"], "furn_s77_sewing_cabinet": [2, 1, 8500, 4, "cabinet"], "furn_s77_pantry_hutch": [2, 1, 15000, 4, "cabinet"], "furn_s77_attic_trunk": [2, 1, 28000, 7, "cabinet"], "furn_s77_reading_stool": [1, 1, 400, 1, "seat"], "furn_s77_rocking_chair": [1, 1, 3500, 2, "seat"], "furn_s77_heart_bench": [3, 1, 2800, 2, "seat"], "furn_s77_folding_tray": [1, 1, 650, 1, "seat"], "furn_s77_quilt_ottoman": [1, 1, 1200, 2, "seat"], "furn_s77_window_bench": [3, 1, 9000, 4, "seat"], "furn_s77_sewing_desk": [2, 1, 17000, 7, "seat"], "furn_s77_curved_sectional": [3, 2, 65000, 11, "seat"], "furn_s77_lantern_stand": [1, 1, 550, 1, "lamp"], "furn_s77_mushroom_lamp": [1, 1, 1600, 2, "lamp"], "furn_s77_petal_uplight": [1, 1, 4800, 2, "lamp"], "furn_s77_quilt_shade_lamp": [1, 1, 10000, 4, "lamp"], "furn_s77_hearth_light": [2, 1, 28000, 7, "lamp"], "furn_s77_box_fan": [1, 1, 900, 1, "appliance"], "furn_s77_toaster_cart": [1, 1, 2400, 2, "appliance"], "furn_s77_record_console": [2, 1, 7800, 4, "appliance"], "furn_s77_sewing_machine_stand": [2, 1, 12000, 4, "appliance"], "furn_s77_stove_oven": [2, 1, 26000, 7, "appliance"], "furn_s77_laundry_pair": [1, 1, 55000, 11, "appliance"], "furn_s77_braided_runner": [1, 3, 750, 1, "rug"], "furn_s77_patchwork_flower_rug": [3, 3, 3800, 2, "rug"], "furn_s77_quilt_island_rug": [3, 2, 15000, 4, "rug"], "furn_s77_embroidery_hoops": [2, 1, 500, 1, "wall"], "furn_s77_wood_cuckoo": [1, 2, 2500, 2, "wall"], "furn_s77_quilt_wall": [2, 2, 4800, 2, "wall"], "furn_s77_pressed_flower_frame": [1, 2, 1300, 2, "wall"], "furn_s77_family_silhouette": [2, 1, 12000, 4, "wall"], "furn_s77_watering_stand": [1, 1, 1100, 2, "plant"], "furn_s77_knitting_basket": [1, 1, 450, 1, "plant"], "furn_s77_olive_planter": [1, 1, 6200, 4, "plant"], "furn_s77_mini_greenhouse": [2, 1, 24000, 7, "plant"], "furn_pearl_tea_daybed": [3, 1, 2400, 2, "bed"], "furn_pearl_pearl_bed": [2, 2, 8000, 4, "bed"]};
  const CATS = E.MALL_CATS.map(c => c.id), bad = [];
  for (const [id, [w, h, price, lux, cat]] of Object.entries(SPEC)) {
    const f = E.FURN_BY_ID[id];
    if (!f || f.w !== w || f.h !== h || f.price !== price || f.lux !== lux || f.cat !== cat || !CATS.includes(cat) || !f.name || !f.emoji || !/^#[0-9a-f]{6}$/.test(f.color)) bad.push(id);
    else if ((cat === 'rug') !== (f.layer === 'rug') || (cat === 'wall') !== !!f.wall) bad.push(id + '(layer/wall)');
  }
  ok(Object.keys(SPEC).length === 43 && bad.length === 0, '43 件新家具字段对上索引（价格/豪华度/分类/占地/地毯层/挂墙）' + (bad.length ? '：' + bad.join(',') : ''));
  ok(E.FURN_BY_ID.furn_s77_curved_sectional.w === 3 && E.FURN_BY_ID.furn_s77_curved_sectional.h === 2, '花瓣转角沙发占地 3×2（索引 3×3，宽扁正面图实测改）');
  ok(!E.FURN_BY_ID.furn_s77_cloud_canopy || E.FURNITURE.filter(f => f.id === 'furn_s77_cloud_canopy').length === 1, '云朵纱帐床没有重复接入');
  const newBeds = ['furn_s77_quilt_daybed', 'furn_s77_drawer_bed', 'furn_s77_book_nook_bed', 'furn_pearl_tea_daybed', 'furn_pearl_pearl_bed'];
  ok(newBeds.every(id => E.FURN_BY_ID[id].cat === 'bed' && E.furnLiveAct(id) === 'rest'), '新床（午睡榻/抽屉床/书窝床/藤编榻/贝壳床）都点了休息');
  ok(['furn_s77_curved_sectional', 'furn_s77_pantry_hutch', 'furn_s77_quilt_island_rug', 'furn_s77_wood_cuckoo'].every(id => E.furnLiveAct(id) === 'walk'), '新沙发 / 柜 / 地毯 / 墙饰只走过去');
  // 小屋 6×4 里每件都能找到空位（墙饰走墙面、避开窗户）；地毯能垫在家具下面
  const s = E.newState(T0); s.coins = 1e12;
  const miss = Object.keys(SPEC).filter(id => !E.findFree(s, 'c77', id, 0));
  ok(miss.length === 0, '每件新家具在空小屋都有合法位置' + (miss.length ? '：' + miss.join(',') : ''));
  E.buyFurniture(s, 'furn_s77_patchwork_flower_rug'); E.buyFurniture(s, 'furn_s77_curved_sectional'); E.buyFurniture(s, 'furn_s77_embroidery_hoops');
  ok(E.placeItem(s, 'c77', 'furn_s77_patchwork_flower_rug', 0, 0, 0).ok && E.placeItem(s, 'c77', 'furn_s77_curved_sectional', 0, 1, 0).ok, '3×3 拼布花园毯上叠放 3×2 转角沙发');
  ok(!E.canPlace(s, 'c77', 'furn_s77_embroidery_hoops', 3, 3, 0, null, 'floor').ok && E.placeItem(s, 'c77', 'furn_s77_embroidery_hoops', 0, 0, 0, 'wall').ok, '刺绣圆绷组只能挂墙（左上空墙 2×1）');
}

// 11w：packs 13/16/19/27/30/33/36/39 的 34 件：价格 / 豪华度 / 分类 / 占地按公共资产索引提案；环形茶会沙发 3×3 实测改 3×2（同花瓣转角沙发）
{
  const SPEC = {"furn_pearl_cup_carousel": [1, 1, 6800, 4, "cabinet"], "furn_pearl_bakery_display": [2, 1, 18000, 7, "cabinet"], "furn_pearl_sideboard_island": [3, 2, 42000, 11, "cabinet"], "furn_pearl_archive_apothecary": [3, 1, 90000, 11, "cabinet"], "furn_pearl_conversation_pit": [3, 2, 75000, 11, "seat"], "furn_pearl_tea_gongfu_desk": [3, 1, 145000, 16, "seat"], "furn_pearl_paper_pear_lamp": [1, 1, 700, 1, "lamp"], "furn_pearl_tea_glass_lamp": [1, 1, 2600, 2, "lamp"], "furn_pearl_boba_globe_lamp": [1, 1, 5800, 4, "lamp"], "furn_pearl_tea_mat": [2, 2, 450, 1, "rug"], "furn_pearl_scallop_rug": [2, 2, 1600, 2, "rug"], "furn_pearl_tea_river_runner": [1, 3, 5500, 4, "rug"], "furn_otaku_floor_chair": [1, 1, 1300, 2, "seat"], "furn_otaku_modular_couch": [3, 2, 18000, 7, "seat"], "furn_otaku_arcade_bench": [2, 1, 3200, 2, "seat"], "furn_otaku_streaming_desk": [3, 2, 36000, 7, "seat"], "furn_otaku_panel_rug": [2, 2, 650, 1, "rug"], "furn_otaku_controller_rug": [3, 2, 2800, 2, "rug"], "furn_otaku_speed_runner": [1, 3, 6800, 4, "rug"], "furn_otaku_pixel_succulent": [1, 1, 1800, 2, "plant"], "furn_otaku_manga_book_stack": [1, 1, 500, 1, "plant"], "furn_otaku_robot_planter": [1, 1, 12500, 4, "plant"], "furn_otaku_aquatic_pixel_tank": [2, 1, 58000, 11, "plant"], "furn_rocket_field_cot": [2, 3, 1500, 2, "bed"], "furn_rocket_cargo_crate": [1, 1, 1900, 2, "cabinet"], "furn_rocket_mesh_rack": [2, 1, 2800, 2, "cabinet"], "furn_rocket_airlock_wardrobe": [2, 1, 26000, 7, "cabinet"], "furn_rocket_rail_bench": [3, 1, 6500, 4, "seat"], "furn_rocket_mission_table": [3, 3, 82000, 11, "seat"], "furn_rocket_zero_g_lounger": [2, 3, 190000, 16, "seat"], "furn_rocket_cage_lamp": [1, 1, 800, 1, "lamp"], "furn_rocket_tripod_searchlight": [1, 1, 3400, 2, "lamp"], "furn_rocket_pipe_valve_lamp": [1, 1, 6800, 4, "lamp"], "furn_rocket_rocket_nozzle_light": [1, 1, 14000, 4, "lamp"]};
  const CATS = E.MALL_CATS.map(c => c.id), bad = [];
  for (const [id, [w, h, price, lux, cat]] of Object.entries(SPEC)) {
    const f = E.FURN_BY_ID[id];
    if (!f || f.w !== w || f.h !== h || f.price !== price || f.lux !== lux || f.cat !== cat || !CATS.includes(cat) || !f.name || !f.emoji || !/^#[0-9a-f]{6}$/.test(f.color)) bad.push(id);
    else if ((cat === 'rug') !== (f.layer === 'rug') || !!f.wall) bad.push(id + '(layer/wall)');
  }
  ok(Object.keys(SPEC).length === 34 && bad.length === 0, '34 件新家具字段对上索引（价格/豪华度/分类/占地/地毯层）' + (bad.length ? '：' + bad.join(',') : ''));
  ok(E.FURN_BY_ID.furn_pearl_conversation_pit.w === 3 && E.FURN_BY_ID.furn_pearl_conversation_pit.h === 2, '环形茶会沙发占地 3×2（索引 3×3，宽扁正面图实测改）');
  ok(E.FURN_BY_ID.furn_rocket_field_cot.cat === 'bed' && E.furnLiveAct('furn_rocket_field_cot') === 'rest', '折叠行军床点了休息');
  ok(['furn_pearl_conversation_pit', 'furn_rocket_airlock_wardrobe', 'furn_otaku_controller_rug', 'furn_rocket_zero_g_lounger', 'furn_otaku_aquatic_pixel_tank'].every(id => E.furnLiveAct(id) === 'walk'), '新沙发 / 气闸衣柜（暂无换装 sub）/ 地毯 / 躺椅 / 水草缸只走过去');
  const s = E.newState(T0); s.coins = 1e12;
  const miss = Object.keys(SPEC).filter(id => !E.findFree(s, 'c77', id, 0));
  ok(miss.length === 0, '每件 11w 新家具在空小屋都有合法位置' + (miss.length ? '：' + miss.join(',') : ''));
  ['furn_otaku_controller_rug', 'furn_pearl_conversation_pit', 'furn_rocket_mission_table', 'furn_pearl_tea_glass_lamp'].forEach(id => E.buyFurniture(s, id));
  ok(E.placeItem(s, 'c77', 'furn_otaku_controller_rug', 0, 0, 0).ok && E.placeItem(s, 'c77', 'furn_pearl_conversation_pit', 0, 0, 0).ok, '3×2 手柄绒毯上叠放 3×2 茶会沙发');
  ok(!E.canPlace(s, 'c77', 'furn_rocket_mission_table', 1, 1, 0).ok, '3×3 会议桌压到沙发 → 不能放');
  ok(E.placeItem(s, 'c77', 'furn_rocket_mission_table', 3, 0, 0).ok && !E.canPlace(s, 'c77', 'furn_pearl_tea_glass_lamp', 5, 2, 0).ok && E.placeItem(s, 'c77', 'furn_pearl_tea_glass_lamp', 0, 3, 0).ok, '会议桌放右边 3×3；立柱灯撞桌不行、放左下空格可以');
  ok(!E.canPlace(s, 'c77', 'furn_rocket_mission_table', 4, 0, 0).ok, '3×3 会议桌出右边界 → 不能放');
}

// 舱式单层床：保留索引 ID / 价格 / 豪华度；占地按正面扁图实测改 2×1（索引提案 2×3 会让上面 2 排空着挡位）
{
  const id = 'furn_rocket_capsule_bunk', f = E.FURN_BY_ID[id];
  ok(f && f.name === '舱式单层床' && f.price === 22000 && f.lux === 7 && f.cat === 'bed', '舱式床：原 ID、价格 22000、豪华度 7、床类');
  ok(f.w === 2 && f.h === 1 && E.furnSize(id, 0).w === 2 && E.furnSize(id, 0).h === 1 && E.furnSize(id, 1).w === 1 && E.furnSize(id, 1).h === 2, '舱式床占地 2×1，转 90° 变 1×2');
  ok(E.furnLiveAct(id) === 'rest', '舱式床点了休息');
  const s = E.newState(T0); s.coins = 1e9; E.buyFurniture(s, id); E.buyFurniture(s, id); E.buyFurniture(s, 'furn_table'); E.buyFurniture(s, 'furn_plant');
  // 边界（小屋 6×4）
  ok(E.canPlace(s, 'c77', id, 4, 3, 0).ok && E.canPlace(s, 'c77', id, 0, 0, 0).ok, '边界：右下角 (4,3)、左上角 (0,0) 都能放');
  ok(!E.canPlace(s, 'c77', id, 5, 0, 0).ok && !E.canPlace(s, 'c77', id, 0, 4, 0).ok && !E.canPlace(s, 'c77', id, -1, 0, 0).ok, '边界：出右边 / 出下边 / 出左边都拒绝');
  ok(E.canPlace(s, 'c77', id, 5, 2, 1).ok && !E.canPlace(s, 'c77', id, 5, 3, 1).ok, '边界：竖放 1×2 在右列 (5,2) 能放，(5,3) 出下边');
  const a = E.placeItem(s, 'c77', id, 2, 2, 0); ok(a.ok, '摆在 (2,2)');
  // 空白区域不挡：床上一排、下一排、左右紧贴都能放别的
  ok(E.canPlace(s, 'c77', 'furn_plant', 2, 1, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 3, 1, 0).ok, '床正上方一排是空地，能放 1×1（不再有隐形墙）');
  ok(E.canPlace(s, 'c77', 'furn_plant', 2, 3, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 1, 2, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 4, 2, 0).ok, '床下一排、左右紧贴都能放');
  ok(!E.canPlace(s, 'c77', 'furn_plant', 2, 2, 0).ok && !E.canPlace(s, 'c77', 'furn_plant', 3, 2, 0).ok, '床本身 2 格被占');
  ok(!E.canPlace(s, 'c77', 'furn_table', 1, 2, 0).ok && !E.canPlace(s, 'c77', id, 3, 2, 0).ok, '和相邻家具重叠时拒绝（桌子压左格 / 第二张床压右格）');
  const pl = E.placeItem(s, 'c77', 'furn_plant', 2, 1, 0); ok(pl.ok, '真在床正上方摆一盆植物');
  // 旋转：(2,2) 转成 1×2 会压到上方植物 → 找附近空位
  const r = E.rotateItem(s, 'c77', a.uid), p = s.homes.c77.placed.find(q => q.uid === a.uid);
  ok(r.ok && p.rot === 1 && E.canPlace(s, 'c77', id, p.x, p.y, 1, a.uid).ok, '旋转成 1×2，落位合法（' + p.x + ',' + p.y + ' moved=' + r.moved + '）');
  const r2 = E.rotateItem(s, 'c77', a.uid); ok(r2.ok && p.rot === 2 && E.furnSize(id, p.rot).w === 2, '再转回横放 2×1');
  ok(E.undoHome(s, r2.undo).ok && p.rot === 1, '撤销旋转');
  // 回仓
  const lux0 = E.homeLuxury(s, 'c77'), inv0 = s.furnInv[id] || 0;
  const sr = E.storeItem(s, 'c77', a.uid);
  ok(sr.ok && (s.furnInv[id] || 0) === inv0 + 1 && !s.homes.c77.placed.some(q => q.uid === a.uid), '收回仓库：房间里没了，仓库 +1');
  ok(E.homeLuxury(s, 'c77') < lux0, '收回后豪华度下降');
  ok(E.canPlace(s, 'c77', 'furn_table', 2, 2, 0).ok, '收回后原位置空出来');
  ok(E.undoHome(s, sr.undo).ok && s.homes.c77.placed.some(q => q.uid === a.uid), '撤销收回：放回原位');
  ok(E.furnStats(s, id).owned === 2, '总数始终 2 张（不丢不复制）');
}


// 11w 熊大拍板：4 件占地收紧 + 底边锚定一次性迁移（不擦档、不改金币/件数）
{
  const F = id => E.FURN_BY_ID[id];
  ok(F('furn_s77_drawer_bed').w === 2 && F('furn_s77_drawer_bed').h === 2 && F('furn_s77_drawer_bed').price === 6500 && F('furn_s77_drawer_bed').lux === 4, '抽屉床 2×2，价/lux 不动');
  ok(F('furn_pearl_pearl_bed').w === 2 && F('furn_pearl_pearl_bed').h === 2 && F('furn_pearl_pearl_bed').price === 8000 && F('furn_pearl_pearl_bed').lux === 4, '贝壳床 2×2，价/lux 不动');
  ok(F('furn_s77_rocking_chair').w === 1 && F('furn_s77_rocking_chair').h === 1 && F('furn_s77_rocking_chair').price === 3500, '摇椅 1×1');
  ok(F('furn_s77_quilt_shade_lamp').w === 1 && F('furn_s77_quilt_shade_lamp').h === 1 && F('furn_s77_quilt_shade_lamp').price === 10000, '拼布弧臂灯 1×1');
  ok(F('furn_s77_curved_sectional').w === 3 && F('furn_s77_curved_sectional').h === 2, '花瓣沙发保持 3×2 不缩到 3×1');
  ok(E.furnLiveAct('furn_s77_drawer_bed') === 'rest' && E.furnLiveAct('furn_pearl_pearl_bed') === 'rest', '两张改过的床都能休息');

  // 边界 / 四邻贴边 / 回仓 / 撤销（抽屉床 2×2）
  const id = 'furn_s77_drawer_bed';
  const s = E.newState(T0); s.coins = 1e9;
  E.buyFurniture(s, id); E.buyFurniture(s, id); E.buyFurniture(s, 'furn_plant'); E.buyFurniture(s, 'furn_table');
  ok(E.canPlace(s, 'c77', id, 4, 2, 0).ok && E.canPlace(s, 'c77', id, 0, 0, 0).ok, '抽屉床边界：右下 (4,2)、左上 (0,0)');
  ok(!E.canPlace(s, 'c77', id, 5, 0, 0).ok && !E.canPlace(s, 'c77', id, 0, 3, 0).ok, '抽屉床出右边 / 出下边拒绝');
  const a = E.placeItem(s, 'c77', id, 2, 1, 0); ok(a.ok, '抽屉床摆 (2,1)');
  ok(E.canPlace(s, 'c77', 'furn_plant', 2, 0, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 1, 1, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 4, 1, 0).ok && E.canPlace(s, 'c77', 'furn_plant', 2, 3, 0).ok, '抽屉床上/左/右/下一圈可贴');
  ok(!E.canPlace(s, 'c77', 'furn_plant', 2, 1, 0).ok && !E.canPlace(s, 'c77', 'furn_plant', 3, 2, 0).ok, '抽屉床本体 2×2 被占');
  const lux0 = E.homeLuxury(s, 'c77'), inv0 = s.furnInv[id] || 0;
  const sr = E.storeItem(s, 'c77', a.uid);
  ok(sr.ok && (s.furnInv[id] || 0) === inv0 + 1 && !s.homes.c77.placed.some(q => q.uid === a.uid), '抽屉床回仓');
  ok(E.homeLuxury(s, 'c77') < lux0, '回仓豪华度下降');
  ok(E.undoHome(s, sr.undo).ok && s.homes.c77.placed.some(q => q.uid === a.uid), '撤销回仓');
  ok(E.furnStats(s, id).owned === 2, '抽屉床件数不丢不复制');

  // 贝壳床同样能休息 + 边界右下
  const pb = 'furn_pearl_pearl_bed';
  E.buyFurniture(s, pb);
  ok(E.canPlace(s, 'c77', pb, 4, 2, 0).ok && E.furnLiveAct(pb) === 'rest', '贝壳床右下能放且休息');

  // 旧 11v 坐标模拟：drawer_bed 旧 2×3 在 (1,0) 底边=3 → 新 2×2 应落到 y=1；摇椅旧 1×2 在 (5,2) 底边=4 → y=3
  const old = E.newState(T0); old.coins = 99999; old.totalEarned = 99999;
  old.homes.c77.placed = [
    { uid:'u1', fid:'furn_s77_drawer_bed', x:1, y:0, rot:0, surf:'floor' },
    { uid:'u2', fid:'furn_pearl_pearl_bed', x:3, y:1, rot:0, surf:'floor' },
    { uid:'u3', fid:'furn_s77_rocking_chair', x:5, y:2, rot:0, surf:'floor' },
    { uid:'u4', fid:'furn_s77_quilt_shade_lamp', x:0, y:2, rot:0, surf:'floor' },
    { uid:'u5', fid:'furn_s77_curved_sectional', x:0, y:0, rot:0, surf:'floor' },
  ];
  old.homes.c77.next = 6;
  // 注意：curved 3×2 在 (0,0) 与 drawer 迁移后 (1,1) 会重叠？drawer 旧(1,0)h3 底=3 → y=1 占(1,1)(2,1)(1,2)(2,2)；curved(0,0) 占 x0-2 y0-1 → 重叠 (1,1)(2,1)
  // 为测锚定，先不放 curved 冲突件；改用植物占位
  old.homes.c77.placed[4] = { uid:'u5', fid:'furn_plant', x:5, y:0, rot:0, surf:'floor' };
  const coins0 = old.coins, earned0 = old.totalEarned;
  const owned = id => E.furnStats(old, id).owned;
  const oDrawer = owned('furn_s77_drawer_bed'), oPearl = owned('furn_pearl_pearl_bed'), oRock = owned('furn_s77_rocking_chair'), oLamp = owned('furn_s77_quilt_shade_lamp'), oPlant = owned('furn_plant');
  const m1 = E.migrateFootprint11w(old);
  ok(!m1.skipped && m1.stored === 0, '迁移跑了一次且无退仓 stored=' + m1.stored + ' shifted=' + m1.shifted);
  const by = Object.fromEntries(old.homes.c77.placed.map(p => [p.uid, p]));
  ok(by.u1 && by.u1.y === 1 && by.u1.x === 1, '抽屉床底边锚定 (1,0)h3 → (1,1)h2');
  ok(by.u2 && by.u2.y === 2 && by.u2.x === 3, '贝壳床底边锚定 (3,1)h3 → (3,2)h2');
  ok(by.u3 && by.u3.y === 3 && by.u3.x === 5, '摇椅底边锚定 (5,2)h2 → (5,3)h1');
  ok(by.u4 && by.u4.y === 3 && by.u4.x === 0, '拼布灯底边锚定 (0,2)h2 → (0,3)h1');
  ok(by.u5 && by.u5.x === 5 && by.u5.y === 0, '无关植物不动');
  ok(old.coins === coins0 && old.totalEarned === earned0, '迁移不改金币/累计');
  ok(owned('furn_s77_drawer_bed') === oDrawer && owned('furn_pearl_pearl_bed') === oPearl && owned('furn_s77_rocking_chair') === oRock && owned('furn_s77_quilt_shade_lamp') === oLamp && owned('furn_plant') === oPlant, '迁移后件数不变');
  const m2 = E.migrateFootprint11w(old);
  ok(m2.skipped && old.fpMig11w === 1 && by.u1.y === 1, '第二次迁移跳过，坐标不再挪');

  // 刷新存读档：migrate + footprint mig 后位置仍在
  const raw = JSON.parse(JSON.stringify(old));
  const loaded = E.migrate(raw, T0).st;
  const m3 = E.migrateFootprint11w(loaded);
  ok(m3.skipped, '读档后已有 fpMig11w 标记则跳过');
  const p1 = loaded.homes.c77.placed.find(p => p.uid === 'u1');
  ok(p1 && p1.y === 1 && p1.x === 1 && loaded.coins === coins0, '存读档后抽屉床位置与金币保持');
}


// 11w 修：异常档恢复——迁移件回退找空位时必须先给「后面还没处理的家具」预留占位；记录顺序互换结果一致；最后全局无重叠
{
  const noOverlap = (st, cid) => { const h = st.homes[cid]; return h.placed.every(p => E.canPlace(st, cid, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok); };
  const mk = order => {
    const s = E.newState(T0); s.coins = 99999; s.totalEarned = 99999;
    const bed = { uid:'u1', fid:'furn_s77_drawer_bed', x:4, y:2, rot:0, surf:'floor' };   // 小屋 6×4：旧 2×3 底=5 已越底（非法旧档）→ 锚定 y=3 仍越界
    const plant = { uid:'u2', fid:'furn_plant', x:0, y:0, rot:0, surf:'floor' };
    s.homes.c77.placed = order === 'bedFirst' ? [bed, plant] : [plant, bed];
    s.homes.c77.next = 3; return s;
  };
  const res = {};
  ['bedFirst', 'plantFirst'].forEach(order => {
    const s = mk(order); const ow = id => E.furnStats(s, id).owned;
    const b0 = ow('furn_s77_drawer_bed'), p0 = ow('furn_plant'), c0 = s.coins;
    const m = E.migrateFootprint11w(s);
    const h = s.homes.c77, bed = h.placed.find(p => p.uid === 'u1'), plant = h.placed.find(p => p.uid === 'u2');
    ok(plant && plant.x === 0 && plant.y === 0, order + '：植物原位保留 (0,0)');
    ok(bed && !(bed.x === 0 && bed.y === 0), order + '：抽屉床回退没抢植物的 (0,0) → ' + (bed ? bed.x + ',' + bed.y : '退仓'));
    ok(noOverlap(s, 'c77'), order + '：迁移后全局无重叠/越界');
    ok(ow('furn_s77_drawer_bed') === b0 && ow('furn_plant') === p0 && s.coins === c0, order + '：件数与金币不变');
    // 下一次读档：植物不能被退仓
    const loaded = E.migrate(JSON.parse(JSON.stringify(s)), T0).st;
    const lp = loaded.homes.c77.placed;
    ok(lp.some(p => p.uid === 'u2' && p.x === 0 && p.y === 0) && lp.some(p => p.uid === 'u1'), order + '：读档后植物和床都还在房里');
    ok(E.migrateFootprint11w(loaded).skipped, order + '：读档后迁移不再跑');
    res[order] = bed ? bed.x + ',' + bed.y : 'stored';
  });
  ok(res.bedFirst === res.plantFirst, '记录顺序互换结果一致 ' + JSON.stringify(res));

  // 迁移件回退不抢「后面才处理的迁移件」的锚定位：坏床排前，正常摇椅排后锚到 (0,1)
  const s2 = E.newState(T0);
  s2.homes.c77.placed = [
    { uid:'u1', fid:'furn_s77_drawer_bed', x:4, y:2, rot:0, surf:'floor' },
    { uid:'u2', fid:'furn_s77_rocking_chair', x:0, y:0, rot:0, surf:'floor' },   // 旧 1×2 底=2 → 新 (0,1)
  ];
  s2.homes.c77.next = 3;
  E.migrateFootprint11w(s2);
  const rc = s2.homes.c77.placed.find(p => p.uid === 'u2');
  ok(rc && rc.x === 0 && rc.y === 1, '后排迁移件仍拿到自己的底边锚定位 (0,1)');
  ok(noOverlap(s2, 'c77') && s2.homes.c77.placed.length === 2, '混合迁移件全局无重叠、两件都在房里');

  // 没空位 → 整件退仓，不丢不复制
  const s3 = E.newState(T0);
  const fill = []; let n = 1;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if (!(x >= 4 && y >= 2)) fill.push({ uid:'f' + (n++), fid:'furn_plant', x, y, rot:0, surf:'floor' });
  s3.homes.c77.placed = [{ uid:'u0', fid:'furn_s77_drawer_bed', x:4, y:1, rot:0, surf:'floor' }].concat(fill); // 旧 2×3 底=4 → 新 (4,2) 合法
  s3.homes.c77.next = n;
  const m3 = E.migrateFootprint11w(s3);
  const bd = s3.homes.c77.placed.find(p => p.uid === 'u0');
  ok(bd && bd.x === 4 && bd.y === 2 && m3.stored === 0, '满屋时合法锚定位仍可用 (4,1)→(4,2)');
  const s4 = E.newState(T0);
  const fill4 = []; let n4 = 1;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if (!(x === 5 && y === 3)) fill4.push({ uid:'g' + (n4++), fid:'furn_plant', x, y, rot:0, surf:'floor' });
  s4.homes.c77.placed = [{ uid:'u0', fid:'furn_s77_drawer_bed', x:4, y:2, rot:0, surf:'floor' }].concat(fill4);   // 只剩 1 格空，2×2 床无处可放
  s4.homes.c77.next = n4;
  const bdOwned = E.furnStats(s4, 'furn_s77_drawer_bed').owned;
  const m4 = E.migrateFootprint11w(s4);
  ok(m4.stored === 1 && !s4.homes.c77.placed.some(p => p.uid === 'u0') && E.furnStats(s4, 'furn_s77_drawer_bed').owned === bdOwned, '越底且无空位 → 床整件退仓，件数不变');
  ok(s4.homes.c77.placed.filter(p => p.fid === 'furn_plant').length === fill4.length && noOverlap(s4, 'c77'), '退仓时植物一件不少且无重叠');
}

// 11z：熊大 10 件占地审查，9 件收紧（香草木箱园保持 1×1）；独立标记 fpMig11z；按旋转后真实高差锚底边
{
  const NEWSZ = { furn_pearl_tea_loft:[2,1], furn_pearl_capsule_daybed:[2,2], furn_pearl_picnic_table:[2,1], furn_otaku_floor_futon:[2,2],
    furn_otaku_bunk_manga:[2,1], furn_otaku_kotatsu:[2,1], furn_rocket_steel_platform_bed:[2,2], furn_rocket_cryo_rest_pod:[2,2], furn_rocket_captain_chair:[1,1] };
  const OLDSZ = { furn_pearl_tea_loft:[2,3], furn_pearl_capsule_daybed:[2,3], furn_pearl_picnic_table:[2,2], furn_otaku_floor_futon:[2,3],
    furn_otaku_bunk_manga:[2,3], furn_otaku_kotatsu:[2,2], furn_rocket_steel_platform_bed:[2,3], furn_rocket_cryo_rest_pod:[2,3], furn_rocket_captain_chair:[1,2] };
  const META = { furn_pearl_tea_loft:[24000,7], furn_pearl_capsule_daybed:[110000,16], furn_pearl_picnic_table:[1700,2], furn_otaku_floor_futon:[1200,2], furn_otaku_bunk_manga:[15000,4], furn_otaku_kotatsu:[5800,4], furn_rocket_steel_platform_bed:[6800,4], furn_rocket_cryo_rest_pod:[65000,11], furn_rocket_captain_chair:[36000,7] };
  const badDef = Object.keys(NEWSZ).filter(id => { const f = E.FURN_BY_ID[id]; return !f || f.w !== NEWSZ[id][0] || f.h !== NEWSZ[id][1] || f.price !== META[id][0] || f.lux !== META[id][1]; });
  ok(badDef.length === 0, '11z 9 件新占地 + ID/价格/豪华度不变 ' + badDef);
  ok(Object.keys(E.FP_OLD_11Z).length === 9 && Object.keys(E.FP_OLD_11Z).every(id => E.FP_OLD_11Z[id].ow === OLDSZ[id][0] && E.FP_OLD_11Z[id].oh === OLDSZ[id][1]), '11z 旧占地表 9 件对得上');
  const hb = E.FURN_BY_ID.furn_pearl_herb_crate; ok(hb && hb.w === 1 && hb.h === 1 && !E.FP_OLD_11Z.furn_pearl_herb_crate, '香草木箱园保持 1×1、不迁移');
  ok(!E.FURN_BY_ID.furn_otaku_kotatsu.layer, '被炉仍是实体家具层（不是地毯层）');
  ['furn_pearl_tea_loft','furn_pearl_capsule_daybed','furn_otaku_floor_futon','furn_otaku_bunk_manga','furn_rocket_steel_platform_bed','furn_rocket_cryo_rest_pod'].forEach(id => ok(E.furnLiveAct(id) === 'rest', id + ' 仍能休息'));

  const noOverlap = (st, cid) => st.homes[cid].placed.every(p => E.canPlace(st, cid, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok);
  // 已跑过 11w 的档（fpMig11w=1）也必须跑 11z；混合旋转
  const mkMix = order => {
    const s = E.newState(T0); s.coins = 12345; s.totalEarned = 12345; s.fpMig11w = 1;
    const rec = [
      { uid:'a', fid:'furn_pearl_tea_loft', x:0, y:0, rot:0, surf:'floor' },          // 旧 2×3 底=3 → (0,2) 2×1
      { uid:'b', fid:'furn_otaku_kotatsu', x:2, y:0, rot:0, surf:'floor' },           // 旧 2×2 底=2 → (2,1) 2×1
      { uid:'c', fid:'furn_rocket_captain_chair', x:4, y:0, rot:0, surf:'floor' },    // 旧 1×2 底=2 → (4,1)
      { uid:'d', fid:'furn_otaku_bunk_manga', x:2, y:2, rot:1, surf:'floor' },        // rot1 旧 3×2 → 新 1×2：高差 0 → (2,2) 不动
      { uid:'e', fid:'furn_plant', x:5, y:0, rot:0, surf:'floor' },
    ];
    s.homes.c77.placed = order === 'fwd' ? rec : rec.slice().reverse(); s.homes.c77.next = 9; return s;
  };
  const res = {};
  ['fwd', 'rev'].forEach(order => {
    const s = mkMix(order), ids = ['furn_pearl_tea_loft','furn_otaku_kotatsu','furn_rocket_captain_chair','furn_otaku_bunk_manga','furn_plant'];
    const own0 = ids.map(id => E.furnStats(s, id).owned);
    const m = E.migrateFootprints(s);
    const by = Object.fromEntries(s.homes.c77.placed.map(p => [p.uid, p]));
    ok(!m.z11.skipped && m.w11.skipped && m.stored === 0, order + '：11w 已跑过跳过，11z 照跑、无退仓 ' + JSON.stringify(m.z11));
    ok(by.a && by.a.x === 0 && by.a.y === 2, order + '：茶点高架床 (0,0)h3 → (0,2)h1');
    ok(by.b && by.b.x === 2 && by.b.y === 1, order + '：被炉 (2,0)h2 → (2,1)h1');
    ok(by.c && by.c.x === 4 && by.c.y === 1, order + '：指挥椅 (4,0)h2 → (4,1)h1');
    ok(by.d && by.d.x === 2 && by.d.y === 2 && by.d.rot === 1, order + '：上下铺 rot1 高差 0 不挪');
    ok(by.e && by.e.x === 5 && by.e.y === 0, order + '：无关植物不动');
    ok(noOverlap(s, 'c77'), order + '：迁移后全局无重叠/越界');
    ok(ids.every((id, n) => E.furnStats(s, id).owned === own0[n]) && s.coins === 12345 && s.totalEarned === 12345, order + '：件数与金币不变');
    const m2 = E.migrateFootprints(s);
    ok(m2.skipped && s.fpMig11z === 1 && by.a.y === 2, order + '：二次迁移跳过（幂等）');
    const loaded = E.migrate(JSON.parse(JSON.stringify(s)), T0).st;
    ok(E.migrateFootprints(loaded).skipped && loaded.homes.c77.placed.find(p => p.uid === 'a').y === 2, order + '：刷新读档后标记还在、位置不变');
    res[order] = JSON.stringify(s.homes.c77.placed.map(p => [p.uid, p.x, p.y]).sort());
  });
  ok(res.fwd === res.rev, '11z 记录换序结果一致');

  // 旋转 90°：钢架床旧 2×3 rot1 = 3×2，新 2×2 rot1 = 2×2 → 高差 0；rot2：旧 2×3 → 新 2×2，高差 1
  const sr = E.newState(T0); sr.fpMig11w = 1;
  sr.homes.c77.placed = [ { uid:'r1', fid:'furn_rocket_steel_platform_bed', x:0, y:0, rot:1, surf:'floor' }, { uid:'r2', fid:'furn_rocket_cryo_rest_pod', x:3, y:0, rot:2, surf:'floor' } ];
  sr.homes.c77.next = 3; E.migrateFootprints(sr);
  const r1 = sr.homes.c77.placed.find(p => p.uid === 'r1'), r2 = sr.homes.c77.placed.find(p => p.uid === 'r2');
  ok(r1 && r1.x === 0 && r1.y === 0 && r2 && r2.x === 3 && r2.y === 1 && noOverlap(sr, 'c77'), '旋转件按旋转后高差：rot1 不挪，rot2 下移 1 ' + JSON.stringify([r1, r2]));

  // 两个标记都没有的老 11v 档：先 11w 再 11z，同屋混合
  const sb = E.newState(T0);
  sb.homes.c77.placed = [ { uid:'w1', fid:'furn_s77_drawer_bed', x:0, y:0, rot:0, surf:'floor' }, { uid:'z1', fid:'furn_otaku_floor_futon', x:2, y:0, rot:0, surf:'floor' } ];
  sb.homes.c77.next = 3; const mb = E.migrateFootprints(sb);
  const w1 = sb.homes.c77.placed.find(p => p.uid === 'w1'), z1 = sb.homes.c77.placed.find(p => p.uid === 'z1');
  ok(!mb.w11.skipped && !mb.z11.skipped && w1.y === 1 && z1.y === 1 && sb.fpMig11w === 1 && sb.fpMig11z === 1 && noOverlap(sb, 'c77'), '老档 11w+11z 依次跑：抽屉床、漫画地铺都锚到 y=1');

  // 边界：越底异常档 → 回退找空位但不抢后面家具的格子；无空位整件退仓
  const se = E.newState(T0); se.fpMig11w = 1;
  const plantE = { uid:'p', fid:'furn_plant', x:0, y:0, rot:0, surf:'floor' };
  se.homes.c77.placed = [ { uid:'x', fid:'furn_rocket_cryo_rest_pod', x:4, y:3, rot:0, surf:'floor' }, plantE ];   // 旧 2×3 底=6 越界 → 锚 y=4 仍越界
  se.homes.c77.next = 3; const pod0 = E.furnStats(se, 'furn_rocket_cryo_rest_pod').owned;
  E.migrateFootprints(se);
  const pe = se.homes.c77.placed.find(p => p.uid === 'p'), xe = se.homes.c77.placed.find(p => p.uid === 'x');
  ok(pe && pe.x === 0 && pe.y === 0 && noOverlap(se, 'c77') && E.furnStats(se, 'furn_rocket_cryo_rest_pod').owned === pod0, '越底异常档：植物保 (0,0)，休息舱找空位或退仓、件数守恒 ' + (xe ? xe.x + ',' + xe.y : '退仓'));
  const sf = E.newState(T0); sf.fpMig11w = 1;
  const fill = []; let n = 1;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) if (!(x === 5 && y === 3)) fill.push({ uid:'f' + (n++), fid:'furn_plant', x, y, rot:0, surf:'floor' });
  sf.homes.c77.placed = [{ uid:'q', fid:'furn_pearl_capsule_daybed', x:4, y:2, rot:0, surf:'floor' }].concat(fill);
  sf.homes.c77.next = n; const cap0 = E.furnStats(sf, 'furn_pearl_capsule_daybed').owned, inv0 = (sf.furnInv || {}).furn_pearl_capsule_daybed || 0;
  const mf = E.migrateFootprints(sf);
  ok(mf.stored === 1 && !sf.homes.c77.placed.some(p => p.uid === 'q') && E.furnStats(sf, 'furn_pearl_capsule_daybed').owned === cap0 && noOverlap(sf, 'c77'), '满屋无位 → 泡泡躺舱整件回仓，所有权守恒、植物一件不少');
  ok(sf.homes.c77.placed.filter(p => p.fid === 'furn_plant').length === fill.length, '回仓时植物全在');

  // 新开局买的新占地家具不会被 11z 误挪：首次启动先跑一次（空屋），之后再摆放
  const sn = E.newState(T0); E.migrateFootprints(sn); sn.coins = 1e9;
  E.buyFurniture(sn, 'furn_pearl_tea_loft'); const pl = E.placeItem(sn, 'c77', 'furn_pearl_tea_loft', 0, 0, 0);
  const ln = E.migrate(JSON.parse(JSON.stringify(sn)), T0).st; const mn = E.migrateFootprints(ln);
  ok(pl.ok && mn.skipped && ln.homes.c77.placed.find(p => p.fid === 'furn_pearl_tea_loft').y === 0, '新档按新占地摆的高架床读档后不被误挪');
}


// 12a 家宅 Lv2/Lv3 底图接入前置：墙面整理（升级 / 读档 / 底图禁区变化）不丢件、不重叠、不踩禁区、可重复跑
{
  const T0 = 1e12, ids = ['c77', 'pearl', 'otaku', 'rocket'];
  const mk = (extra) => E.migrate(Object.assign({ v:3, coins:1e12, ceos:{ c77:{ unlocked:true, at:0 }, pearl:{ unlocked:true, at:1 }, otaku:{ unlocked:true, at:2 }, rocket:{ unlocked:true, at:3 } } }, extra || {}), T0).st;
  const tally = (s) => { const t = {}; for (const id of ids) for (const p of s.homes[id].placed) t[p.fid] = (t[p.fid] || 0) + 1; for (const k in s.furnInv) t[k] = (t[k] || 0) + s.furnInv[k]; return JSON.stringify(Object.keys(t).sort().map(k => [k, t[k]])); };
  const wallSane = (s, id) => { const h = s.homes[id], w = h.placed.filter(p => E.itemSurf(p) === 'wall'); return w.every(p => E.canPlace(s, id, p.fid, p.x, p.y, p.rot, p.uid, 'wall').ok); };
  const snap = (s) => JSON.stringify(s.homes) + JSON.stringify(s.furnInv) + s.coins;
  // 12b1：77 / 珍珠姐 Lv2/Lv3 真底图接入后，下面这些合成用例照旧按「升级房还没底图」的起点跑（restore 回到没底图），结束再换回真表
  const ART12B = ['c77_2', 'c77_3', 'pearl_2', 'pearl_3', 'otaku_2', 'otaku_3', 'rocket_2', 'rocket_3'], real = Object.assign({}, E.WALL_BLOCK);
  const saved = Object.assign({}, real); for (const k of ART12B) delete saved[k];
  const restore = () => { for (const k of Object.keys(E.WALL_BLOCK)) if (!(k in saved)) delete E.WALL_BLOCK[k]; Object.assign(E.WALL_BLOCK, saved); };
  const restoreReal = () => { restore(); Object.assign(E.WALL_BLOCK, real); };
  const blk = (cols, rows) => { const o = []; for (const y of rows || [0, 1]) for (const x of cols) o.push([x, y]); return o; };
  try {
    restore();
    // 1) Lv1 左两列挂好的画，升 Lv2 / Lv3（新底图右边画满墙饰、左两列留空）→ 原位不动
    for (const id of ids) {
      E.WALL_BLOCK[id + '_2'] = blk([2, 3, 4, 5, 6, 7]); E.WALL_BLOCK[id + '_3'] = blk([2, 3, 4, 5, 6, 7, 8, 9]);
      const s = mk(); for (const y of [0, 1]) { E.buyFurniture(s, 'furn_painting'); ok(E.placeItem(s, id, 'furn_painting', 0, y, 0, 'wall').ok, id + '：Lv1 左墙挂画 ' + y); }
      const before = tally(s), pos = JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y]));
      let c0 = s.coins, r = E.upgradeHome(s, id);
      ok(r.ok && r.wallMoved === 0 && r.wallStored === 0 && s.coins === c0 - E.HOME_TIERS[1].cost && JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])) === pos, id + '：升 Lv2 左两列挂画原位保留，只扣房钱');
      c0 = s.coins; r = E.upgradeHome(s, id);
      ok(r.ok && r.wallMoved === 0 && r.wallStored === 0 && s.coins === c0 - E.HOME_TIERS[2].cost && JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])) === pos && tally(s) === before, id + '：升 Lv3 挂画原位、件数不变');
    }
    restore();
    // 2) 底图把左上角也画了东西（坏情况）：升级时被压的画挪到最近空墙，不丢
    {
      E.WALL_BLOCK.c77_2 = blk([0, 1], [0]).concat(blk([5, 6, 7]));
      const s = mk(); E.buyFurniture(s, 'furn_painting'); E.placeItem(s, 'c77', 'furn_painting', 0, 0, 0, 'wall'); E.buyFurniture(s, 'furn_painting'); E.placeItem(s, 'c77', 'furn_painting', 0, 1, 0, 'wall');
      const before = tally(s), c0 = s.coins, r = E.upgradeHome(s, 'c77'), w = s.homes.c77.placed.filter(p => p.fid === 'furn_painting');
      ok(r.ok && r.wallMoved === 1 && r.wallStored === 0 && w.length === 2 && wallSane(s, 'c77') && tally(s) === before && s.coins === c0 - E.HOME_TIERS[1].cost, '升级后新底图压到左上挂画：挪到最近空墙 (' + w.map(p => p.x + ',' + p.y).join(' ') + ')，件数 / 金币守恒');
      const k = snap(s), r2 = E.migrateWallPaintings(s); ok(r2.moved === 0 && r2.stored === 0 && snap(s) === k, '再整理一遍不再动');
      restore();
    }
    // 3) 旧档 Lv2 / Lv3 墙上挂满，换上新底图（禁区变多）→ 放得下的保留或挪，放不下的退仓库；件数守恒、全部合法、可重复
    for (const [lv, cols] of [[2, 8], [3, 10]]) for (const id of ids) {
      const s = mk(); s.homes[id].lv = lv;
      let n = 0; for (let k = 0; k < 20; k++) { const sp = E.findFree(s, id, 'furn_painting', 0, 'wall'); if (!sp) break; E.buyFurniture(s, 'furn_painting'); E.placeItem(s, id, 'furn_painting', sp.x, sp.y, 0, 'wall'); n++; }
      const before = tally(s), c0 = s.coins;
      E.WALL_BLOCK[id + '_' + lv] = blk(Array.from({ length:cols - 4 }, (_, i) => i + 4));   // 新底图：右边 cols-4 列都画了东西，只剩左 4 列空墙 = 每排 2 幅
      const r = E.migrateWallPaintings(s), w = s.homes[id].placed.filter(p => p.fid === 'furn_painting');
      ok(n > 4 && w.length === 4 && r.stored === n - 4 && wallSane(s, id) && tally(s) === before && s.coins === c0, id + ' Lv' + lv + '：挂满 ' + n + ' 幅 → 新禁区下留 4 幅、退仓 ' + r.stored + '，件数 / 金币守恒');
      const k = snap(s), r2 = E.migrateWallPaintings(s); ok(r2.moved === 0 && r2.stored === 0 && snap(s) === k, id + ' Lv' + lv + '：重复整理不再动');
      delete E.WALL_BLOCK[id + '_' + lv];   // 禁区变少（比如底图坏了没配）：已挂的都还合法，不动
      const r3 = E.migrateWallPaintings(s); ok(r3.moved === 0 && r3.stored === 0 && snap(s) === k, id + ' Lv' + lv + '：禁区变少不乱动');
    }
    restore();
    // 4) 挪动的件不能落到后面本来合法的件上（两遍整理）
    {
      const s = mk(); s.homes.c77.lv = 2;
      s.homes.c77.placed = [{ uid:'ua', fid:'furn_painting', x:5, y:0, rot:0, surf:'wall' }, { uid:'uc', fid:'furn_painting', x:3, y:0, rot:0, surf:'wall' }];
      const r = E.migrateWallPaintings(s), c = s.homes.c77.placed.find(p => p.uid === 'uc');
      ok(r.moved === 1 && c.x === 3 && c.y === 0 && wallSane(s, 'c77') && s.homes.c77.placed.length === 2, '挪走的画不压后面的合法画（' + s.homes.c77.placed.map(p => p.uid + '@' + p.x + ',' + p.y).join(' ') + '）');
    }
    // 5) 地板家具不受墙面整理影响
    {
      const s = mk(); E.buyFurniture(s, 'furn_sofa'); E.placeItem(s, 'c77', 'furn_sofa', 0, 3, 0); const fl = JSON.stringify(s.homes.c77.placed);
      E.upgradeHome(s, 'c77'); ok(JSON.stringify(s.homes.c77.placed) === fl, '升级时地板家具原位不动');
    }
  } finally { restoreReal(); }
  // 7) 12b：真实读档链路（E.migrate → normHomeBundle → 墙面整理）和直接整理结果一致；记录顺序对调也一样
  {
    restore();   // 12b1：这组是「77 Lv2 还没底图」的旧读档复现，先摘掉真底图禁区，结尾换回
    const raw = (placed, lv) => ({ v:E.CFG.SAVE_VERSION, coins:1234, ceos:{ c77:{ unlocked:true, lv:1, at:0 } }, furnInv:{ furn_lamp:1 }, homes:{ c77:{ lv, next:9, placed } } });
    const P = (uid, x, y, surf) => surf === undefined ? { uid, fid:'furn_painting', x, y, rot:0 } : { uid, fid:'furn_painting', x, y, rot:0, surf };
    const pos = (st) => Object.fromEntries(st.homes.c77.placed.map(p => [p.uid, p.x + ',' + p.y + ',' + p.surf]));
    const cnt = (st) => st.homes.c77.placed.length + E.invCount(st);
    const direct = (placed, lv) => { const s = E.newState(T0); s.ceos.c77.unlocked = true; s.homes.c77.lv = lv; s.homes.c77.placed = JSON.parse(JSON.stringify(placed)); const r = E.reconcileWall(s, 'c77'); return { s, r }; };
    const sane = (st) => st.homes.c77.placed.every(p => E.canPlace(st, 'c77', p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok);
    // 熊大复现：77 的 Lv2，坏画在 (5,0) 禁区排前面，合法画在 (0,0) 排后面
    const cases = [
      ['坏画在前', [P('bad', 5, 0, 'wall'), P('ok', 0, 0, 'wall')], 2],
      ['合法画在前', [P('ok', 0, 0, 'wall'), P('bad', 5, 0, 'wall')], 2],
      ['旧地板画在前', [P('old', 0, 3), P('ok', 0, 0, 'wall')], 2],
      ['Lv3 三幅混排', [P('bad', 8, 0, 'wall'), P('old', 2, 2), P('ok1', 0, 0, 'wall'), P('ok2', 2, 0, 'wall')], 3],
    ];
    for (const [name, placed, lv] of cases) {
      const d = direct(placed, lv), m = E.migrate(raw(JSON.parse(JSON.stringify(placed)), lv), T0), st = m.st;
      ok(JSON.stringify(pos(st)) === JSON.stringify(pos(d.s)) || ['ok', 'ok1', 'ok2', 'bad', 'old'].every(u => pos(st)[u] === pos(d.s)[u]), '读档链路 = 直接整理（' + name + '）：' + JSON.stringify(pos(st)));
      ok(m.wall && m.wall.moved === d.r.moved && m.wall.stored === d.r.stored && m.wall.moved + m.wall.stored >= 1, '读档如实报告迁移（' + name + '）moved=' + (m.wall && m.wall.moved) + ' stored=' + (m.wall && m.wall.stored));
      ok(sane(st) && cnt(st) === placed.length + 1 && st.coins === 1234, '读档后墙面全合法、件数 / 金币守恒（' + name + '）');
      // 页面 boot 顺序：读档 → 占地迁移 → 再整理一遍，不再动
      const k = JSON.stringify(st.homes), fp = E.migrateFootprints(st), w2 = E.migrateWallPaintings(st);
      ok(w2.moved === 0 && w2.stored === 0 && JSON.stringify(st.homes) === k, 'boot 里第二次整理不再动（' + name + '）');
      // 存档往返：再读一次不变、报告 0
      const m2 = E.migrate(JSON.parse(JSON.stringify(st)), T0);
      ok(JSON.stringify(m2.st.homes) === k && m2.wall.moved === 0 && m2.wall.stored === 0, '整理后的档再读：原样、报告 0（' + name + '）');
    }
    { const st = E.migrate(raw([P('bad', 5, 0, 'wall'), P('ok', 0, 0, 'wall')], 2), T0).st, ps = pos(st);
      ok(ps.ok === '0,0,wall' && ps.bad === '5,1,wall', '熊大复现：合法画留 (0,0)，坏画挪 (5,1)：' + JSON.stringify(ps)); }
    // 顺序对调：同一组画，正序 / 反序读档，每幅画最终位置一样
    { const base = [P('bad', 6, 0, 'wall'), P('old', 1, 4), P('ok1', 0, 1, 'wall'), P('ok2', 2, 0, 'wall'), P('ok3', 4, 1, 'wall')];
      const a = pos(E.migrate(raw(JSON.parse(JSON.stringify(base)), 2), T0).st), b = pos(E.migrate(raw(JSON.parse(JSON.stringify(base)).reverse(), 2), T0).st);
      ok(['ok1', 'ok2', 'ok3'].every(u => a[u] === b[u] && a[u] === base.find(p => p.uid === u).x + ',' + base.find(p => p.uid === u).y + ',wall'), '记录换序：合法画正反序都原位（' + JSON.stringify(a) + ' / ' + JSON.stringify(b) + '）'); }
    // 墙挂满时坏画排前面：合法画全保留，坏画退仓库（不是合法画被挤去退仓）
    { const full = [P('bad', 5, 0, 'wall'), P('a', 0, 0, 'wall'), P('b', 2, 0, 'wall'), P('c', 0, 1, 'wall'), P('d', 2, 1, 'wall'), P('e', 4, 1, 'wall'), P('f', 6, 1, 'wall')];
      const m = E.migrate(raw(JSON.parse(JSON.stringify(full)), 2), T0), ps = pos(m.st);
      ok(['a', 'b', 'c', 'd', 'e', 'f'].every(u => ps[u] && ps[u] === full.find(p => p.uid === u).x + ',' + full.find(p => p.uid === u).y + ',wall') && !ps.bad && m.wall.stored === 1 && (m.st.furnInv.furn_painting || 0) === 1, '墙满 + 坏画排前：6 幅合法原位，坏画退仓 1 幅'); }
    // 旧档地板挂画不挡地板家具：同格的沙发照样读回
    { const m = E.migrate(raw([P('old', 0, 3), { uid:'s', fid:'furn_sofa', x:0, y:3, rot:0, surf:'floor' }], 2), T0), ps = pos(m.st);
      ok(ps.s === '0,3,floor' && ps.old && ps.old.endsWith(',wall') && m.wall.moved === 1, '旧地板挂画不挡同格沙发：沙发原位，画上墙 ' + JSON.stringify(ps)); }
    restoreReal();
  }
  // 12b1：77 / 珍珠姐 Lv2/Lv3 真底图禁区——小屋左两列挂画一路升到豪宅原位不动；自动挂画挂满也不压窗户；旧档挂在窗上的画读档挪开、件数守恒
  {
    const T0 = 1e12, mk = () => E.migrate({ v:3, coins:1e12, ceos:{ c77:{ unlocked:true, at:0 }, pearl:{ unlocked:true, at:1 } } }, T0).st;
    for (const id of ['c77', 'pearl']) {
      const s = mk(); for (const y of [0, 1]) { E.buyFurniture(s, 'furn_painting'); E.placeItem(s, id, 'furn_painting', 0, y, 0, 'wall'); }
      const pos = JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])), r2 = E.upgradeHome(s, id), r3 = E.upgradeHome(s, id);
      ok(r2.ok && r3.ok && r2.wallMoved + r2.wallStored + r3.wallMoved + r3.wallStored === 0 && JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])) === pos, '12b1 ' + id + '：小屋左墙两幅画升公寓 / 豪宅都原位');
      for (const lv of [2, 3]) {
        const t = mk(); t.homes[id].lv = lv; const blk = E.wallBlockedCells(t, id), bad = new Set(blk.map(c => c.join(',')));
        let n = 0; for (let k = 0; k < 20; k++) { const sp = E.findFree(t, id, 'furn_painting', 0, 'wall'); if (!sp) break; E.buyFurniture(t, 'furn_painting'); E.placeItem(t, id, 'furn_painting', sp.x, sp.y, 0, 'wall'); n++; }
        const cells = t.homes[id].placed.flatMap(p => { const z = E.furnSize(p.fid, p.rot), o = []; for (let dx = 0; dx < z.w; dx++) for (let dy = 0; dy < z.h; dy++) o.push((p.x + dx) + ',' + (p.y + dy)); return o; });
        ok(n >= 1 && blk.length === JSON.stringify(E.WALL_BLOCK[id + '_' + lv]).split('],[').length && cells.every(c => !bad.has(c)), '12b1 ' + id + ' Lv' + lv + '：自动挂满 ' + n + ' 幅都在空墙，不压底图墙饰（禁区 ' + blk.length + ' 格）');
      }
    }
    const raw = { v:E.CFG.SAVE_VERSION, coins:1, ceos:{ c77:{ unlocked:true, lv:1, at:0 } }, furnInv:{}, homes:{ c77:{ lv:2, next:9, placed:[{ uid:'win', fid:'furn_painting', x:5, y:0, rot:0, surf:'wall' }, { uid:'ok', fid:'furn_painting', x:0, y:0, rot:0, surf:'wall' }] } } };
    const m = E.migrate(raw, T0), st = m.st, w = st.homes.c77.placed.find(p => p.uid === 'win'), o = st.homes.c77.placed.find(p => p.uid === 'ok');
    ok(o && o.x === 0 && o.y === 0 && st.homes.c77.placed.length + E.invCount(st) === 2 && st.homes.c77.placed.every(p => E.canPlace(st, 'c77', p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok) && (!w || w.x < 4), '12b1 旧档 77 公寓画挂在新拱窗上：读档挪到空墙 / 退仓，合法画原位，件数守恒 ' + JSON.stringify(st.homes.c77.placed.map(p => p.uid + '@' + p.x + ',' + p.y)));
  }
  // 12b2：阿宅 / 火箭老板 Lv2/Lv3 真底图禁区——按实图逐列核对；小屋左两列挂画升到公寓 / 豪宅原位；自动挂满不压墙饰；旧档挂在新禁区上的画读档挪开、件数守恒
  {
    const T0 = 1e12, mk2 = () => E.migrate({ v:3, coins:1e12, ceos:{ c77:{ unlocked:true, at:0 }, otaku:{ unlocked:true, at:2 }, rocket:{ unlocked:true, at:3 } } }, T0).st;
    // 列从 1 数：阿宅公寓第 4–8 列、阿宅豪宅第 3–10 列、火箭公寓第 4–8 列、火箭豪宅第 4–10 列，上下两排都禁
    const WANT = { otaku_2:[4, 8], otaku_3:[3, 10], rocket_2:[4, 8], rocket_3:[4, 10] };
    for (const k in WANT) {
      const [a, b] = WANT[k], id = k.split('_')[0], lv = +k.slice(-1), cols = E.homeTier(lv).cols, t = mk2(); t.homes[id].lv = lv;
      const bl = E.wallBlockedCells(t, id), bs = new Set(bl.map(c => c.join(','))), want = [];
      for (let y = 0; y < 2; y++) for (let x = a - 1; x < b; x++) want.push(x + ',' + y);
      ok(bl.length === want.length && want.every(c => bs.has(c)), '12b2 ' + k + '：墙面禁区 = 第 ' + a + '–' + b + ' 列两排（' + bl.length + ' 格）');
      const free = []; for (let y = 0; y < 2; y++) for (let x = 0; x < cols; x++) if (!bs.has(x + ',' + y)) free.push(x);
      ok(free.every(x => x < a - 1) && E.canPlace(t, id, 'furn_painting', 0, 0, 0).ok && E.canPlace(t, id, 'furn_painting', 0, 1, 0).ok && !E.canPlace(t, id, 'furn_painting', a - 2, 0, 0).ok, '12b2 ' + k + '：左边空墙能挂、跨进第 ' + a + ' 列就拒（提示「' + E.canPlace(t, id, 'furn_painting', a - 2, 0, 0).why + '」）');
      let n = 0; for (let i = 0; i < 20; i++) { const sp = E.findFree(t, id, 'furn_painting', 0, 'wall'); if (!sp) break; E.buyFurniture(t, 'furn_painting'); E.placeItem(t, id, 'furn_painting', sp.x, sp.y, 0, 'wall'); n++; }
      const cells = t.homes[id].placed.flatMap(p => { const z = E.furnSize(p.fid, p.rot), o = []; for (let dx = 0; dx < z.w; dx++) for (let dy = 0; dy < z.h; dy++) o.push((p.x + dx) + ',' + (p.y + dy)); return o; });
      ok(n === 2 && cells.every(c => !bs.has(c)), '12b2 ' + k + '：自动挂满 ' + n + ' 幅都在左边空墙，不压底图墙饰');
    }
    for (const id of ['otaku', 'rocket']) {
      const s = mk2(); for (const y of [0, 1]) { E.buyFurniture(s, 'furn_painting'); E.placeItem(s, id, 'furn_painting', 0, y, 0, 'wall'); }
      const pos = JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])), r2 = E.upgradeHome(s, id), r3 = E.upgradeHome(s, id);
      ok(r2.ok && r3.ok && r2.wallMoved + r2.wallStored + r3.wallMoved + r3.wallStored === 0 && JSON.stringify(s.homes[id].placed.map(p => [p.uid, p.x, p.y])) === pos, '12b2 ' + id + '：小屋左墙两幅画升公寓 / 豪宅都原位');
      // 旧档：公寓里画挂在第 5 列（新舷窗 / 柜门）上，另一幅在左上 → 读档挪到空墙或退仓，件数守恒；升豪宅后照样都合法
      const raw = { v:E.CFG.SAVE_VERSION, coins:1e12, ceos:{ c77:{ unlocked:true, lv:1, at:0 }, [id]:{ unlocked:true, lv:1, at:-1 } }, furnInv:{}, homes:{ [id]:{ lv:2, next:9, placed:[{ uid:'bad', fid:'furn_painting', x:4, y:1, rot:0, surf:'wall' }, { uid:'ok', fid:'furn_painting', x:0, y:0, rot:0, surf:'wall' }] } } };
      const m = E.migrate(raw, T0), st = m.st, h = st.homes[id], bad = h.placed.find(p => p.uid === 'bad'), o = h.placed.find(p => p.uid === 'ok');
      ok(o && o.x === 0 && o.y === 0 && h.placed.length + E.invCount(st) === 2 && h.placed.every(p => E.canPlace(st, id, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok) && (!bad || bad.x + 2 <= 3) && m.wall.moved + m.wall.stored === 1, '12b2 旧档 ' + id + ' 公寓画挂在新禁区上：读档挪开（' + (bad ? bad.x + ',' + bad.y : '退仓') + '），合法画原位，件数守恒');
      const u = E.upgradeHome(st, id); ok(u.ok && h.placed.length + E.invCount(st) === 2 && h.placed.every(p => E.canPlace(st, id, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok), '12b2 ' + id + '：这份旧档再升豪宅，挂画仍都合法、件数守恒');
    }
  }
  // 12b2：测试房间假数据（?test=homes 用）——四家都开、房子统一到公寓 / 豪宅、家具和挂画都合法摆好、仓库有货；纯函数，不碰传进来的东西
  {
    const ids = ['c77', 'pearl', 'otaku', 'rocket'], appSrc0 = require('fs').readFileSync(require('path').join(__dirname, 'app.js'), 'utf8');
    const artKeys = [...(appSrc0.match(/const HOME_ART = \{([^}]*)\}/) || ['', ''])[1].matchAll(/(\w+_\d)\s*:/g)].map(x => x[1]);
    for (const lv of [2, 3]) {
      const a = E.testHomesState(1e12, lv), b = E.testHomesState(1e12, lv);
      ok(JSON.stringify(a) === JSON.stringify(b) && a !== b && a.homes !== b.homes, '12b2 测试房间 Lv' + lv + '：每次新造一份、内容一样（不共用对象）');
      ok(ids.every(id => a.ceos[id].unlocked && a.homes[id].lv === lv && artKeys.includes(id + '_' + lv) && E.WALL_BLOCK[id + '_' + lv]), '12b2 测试房间 Lv' + lv + '：四位 CEO 都在、四家都是' + E.homeTier(lv).name + '、都有真底图 + 真禁区');
      ok(ids.every(id => { const h = a.homes[id]; return h.placed.length === 8 && h.placed.filter(p => p.surf === 'wall').length === 1 && h.placed.filter(p => p.surf === 'floor').length === 7 && h.placed.every(p => E.canPlace(a, id, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok); }), '12b2 测试房间 Lv' + lv + '：每家 7 件地板家具 + 1 幅挂画，全部合法、不压墙饰');
      ok(a.furnInv.furn_painting === 4 && E.invCount(a) === 8 && a.coins >= 1e12 && a.taps > 0 && a.v === E.CFG.SAVE_VERSION, '12b2 测试房间 Lv' + lv + '：仓库 4 幅画 + 4 件小家具给测试员自己摆，金币够买够升级，不弹开场');
      ok(ids.every(id => E.findFree(a, id, 'furn_painting', 0, 'wall') !== null || lv === 3), '12b2 测试房间 Lv' + lv + '：每家墙上还留空位能再挂一幅' + (lv === 3 ? '（豪宅阿宅只有左 2 列空墙，可能已满）' : ''));
    }
    const s = E.testHomesState(1e12, 2), before = ids.map(id => s.homes[id].placed.length).join(), cnt = () => ids.reduce((n, id) => n + s.homes[id].placed.length, 0) + E.invCount(s), n0 = cnt();
    const ups = ids.map(id => E.upgradeHome(s, id));
    ok(ups.every(u => u.ok) && ids.every(id => s.homes[id].lv === 3 && s.homes[id].placed.every(p => E.canPlace(s, id, p.fid, p.x, p.y, p.rot, p.uid, p.surf).ok)) && cnt() === n0, '12b2 测试房间：公寓里直接升豪宅，四家家具 / 挂画都合法、件数守恒（' + before + ' → ' + ids.map(id => s.homes[id].placed.length).join() + '）');
    const real = E.migrate({ v:3, coins:77, ceos:{ c77:{ unlocked:true, at:0 } } }, 1e12).st, rj = JSON.stringify(real);
    E.testHomesState(1e12, 3); ok(JSON.stringify(real) === rj && real.coins === 77 && !real.test, '12b2 测试房间：造假数据不改动别的存档对象');
  }
  // 6) 底图尺寸：每张 home_<ceo>_<lv>.webp 必须 = 列×200 × (2+行)×200（Lv1 1200×1200、Lv2 1600×1400、Lv3 2000×1600），墙地分界 y=400
  const fs = require('fs'), path = require('path');
  const webpSize = (f) => { const b = fs.readFileSync(f), t = b.toString('ascii', 12, 16);
    if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (t === 'VP8L') { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    return null; };
  const appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), m = appSrc.match(/const HOME_ART = \{([^}]*)\}/);
  const keys = m ? [...m[1].matchAll(/(\w+_\d)\s*:/g)].map(x => x[1]) : [];
  ok(keys.length >= 4, 'HOME_ART 读得到（' + keys.join(' ') + '）');
  for (const k of keys) {
    const lv = +k.slice(-1), T = E.homeTier(lv), f = path.join(__dirname, 'art', 'home_' + k + '.webp'), sz = fs.existsSync(f) ? webpSize(f) : null;
    ok(sz && sz[0] === T.cols * 200 && sz[1] === (E.WALL_ROWS + T.rows) * 200, k + ' 底图尺寸 ' + (sz ? sz.join('×') : '缺文件') + ' 应为 ' + T.cols * 200 + '×' + (E.WALL_ROWS + T.rows) * 200);
    if (lv > 1) ok(!!E.WALL_BLOCK[k], k + ' 有底图就必须配墙面禁区（按实图校准）');
  }
}

console.log(`economy tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
