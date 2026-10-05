/* 躺着也能赚 — 经济/结算核心 v2（CEO + 员工）。纯函数，不依赖 DOM，浏览器 / Node 通用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Economy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 可调参数（数值都在这里） ================= */
  const CFG = {
    SAVE_VERSION: 2,
    UP_GROWTH: 1.33,            // 店铺升级价 = 基础价 × 1.33^等级
    EMP_GROWTH: 2.5,            // 员工升级价成长（每级 ×2.5）
    EMP_COST_K: 1,              // 员工 Lv1→2 价格 = 雇佣价 × 1
    EMP_LV_BONUS: 0.15,         // 员工每级 +15% 自动产出速度
    EMP_MAX: 40,
    CEO_GROWTH: 2.0,            // CEO 升级价成长（每级 ×2）
    CEO_LV_BONUS: 0.05,         // CEO 每级 +5% 经营加成
    CEO_MAX: 30,
    MATCH_MULT: 1.5,            // 专长对口
    CROSS_MULT: 1.2,            // 跨行
    OFFLINE_RATE: 0.5,          // 离线 = 在线基础产速 × 50%（不含大客户 ×5）
    OFFLINE_CAP: 8 * 3600,      // 离线最多 8 小时
    OFFLINE_CAP_BONUS_77TECH: 2 * 3600, // 跨行事件「麻辣服务器」：+2 小时
    OFFLINE_MIN: 60,            // 离开 ≥60 秒才弹「老板你回来啦」
    TZ_OFFSET_MIN: 480,         // 每日双倍按马来西亚时间（UTC+8）计算，不跟手机时区走
    DAY_RESET_HOUR: 5,          // 早上 5 点重置
    CLOCK_TOLERANCE: 120,       // 系统时间回拨容忍（秒）
    BOOST_MULT: 5,              // 大客户 ×5（只管在线那 30 秒）
    BOOST_SEC: 30,
    BIG_MIN: 120, BIG_MAX: 240, // 大客户每 2~4 分钟来一次（在线）
    BIG_STAY: 12,               // 出现后 12 秒内要点到
    BIG_FREQ_ROCKET_BBQ: 0.5,   // 跨行事件「火箭烤炉」：间隔 ×0.5
    CRIT_CHANCE: 0.12, CRIT_MULT: 5,
    TAP_FRAC: 0.35,             // 手点一次 ≈ 该店（含 CEO 加成）每秒基础产量的 35%
    TAP_X_PEARL_BOOK: 2,        // 跨行事件「奶茶漫画联名」：书店手点 ×2
    AZHAI_BONUS_SEC: 120,       // 跨行事件「漫画杯套」：奶茶店冲里程碑送 120 秒奶茶店产量
    AZHAI_BONUS_MIN: 500,
    ROCKET_UNLOCK_LV: 25,       // 科技公司 Lv25 解锁火箭老板
    GACHA_PRICE: 200000,        // 盲盒单价（可调；熊大候选 20 万）
    GACHA_GROWTH: 1,            // 每开一个涨价倍数（1 = 固定价；模拟器对比见 sim.js）
  };

  /* ===== 火箭老板：名字只在这一处配置（公开上架前再评估真名/肖像权） ===== */
  // 改这里，CEO 名字和火箭老板那一行 4 块招牌一起变：烧烤=sign+'烧烤'，奶茶=tea+'奶茶'，书店=book+'书店'，科技=short+'科技'
  const ROCKET_NAME = { name:'火箭老板', short:'火箭', sign:'老马', tea:'特嘶啦', book:'漫威' };

  const TYPES = { food:'餐饮型', drink:'饮品型', creative:'创意型', tech:'科技型' };

  /* ================= 四家店 + 四位员工（一店一位，固定在本店） ================= */
  const SHOPS = [
    { id:'bbq',  name:'77烧烤摊',     short:'烧烤摊',   type:'food',     open:0,       hire:50,       upBase:30,      rate:0.6,  tapMin:1,
      emp:{ name:'阿炭', line:'翻个面，香气就营业了。' } },
    { id:'tea',  name:'奶茶店',       short:'奶茶店',   type:'drink',    open:1000,    hire:2500,     upBase:4000,    rate:4,    tapMin:3,
      emp:{ name:'小满', line:'七分茶，三分好心情。' } },
    { id:'book', name:'漫画书店',     short:'漫画书店', type:'creative', open:60000,   hire:150000,   upBase:200000,  rate:50,   tapMin:30,
      emp:{ name:'阿页', line:'再翻一页，我就整理书架。' } },
    { id:'tech', name:'摸鱼科技公司', short:'科技公司', type:'tech',     open:4000000, hire:10000000, upBase:3000000, rate:1200, tapMin:800,
      emp:{ name:'小栈', line:'代码能重构，午饭不能拖。' } },
  ];

  /* ================= 四位 CEO ================= */
  const CEOS = [
    { id:'c77',    name:'77',             type:'food',     home:0, upBase:300,     line:'巴适得很，串串烤起走！', unlock:'开局就在烧烤摊' },
    { id:'pearl',  name:'珍珠姐',         type:'drink',    home:1, upBase:20000,   line:'珍珠要Q，账目要清。',     unlock:'开奶茶店时加入' },
    { id:'otaku',  name:'阿宅店长',       type:'creative', home:2, upBase:1000000, line:'这家店，我要画成名场面。', unlock:'开漫画书店时加入' },
    { id:'rocket', name:ROCKET_NAME.name, type:'tech',     home:3, upBase:60000000, line:'目标：把小店送上火星！', unlock:'科技公司 Lv25 加入' },
  ];
  const CEO_BY_ID = {}; CEOS.forEach(c => CEO_BY_ID[c.id] = c);

  /* ===== 老板 × 店铺 = 16 块招牌（换 CEO 时招牌、口号跟着换） ===== */
  const RN = ROCKET_NAME;
  // 熊大文案定稿 + 15:05 杨总认可的招牌名（烧烤／奶茶／书店／科技）。口号除「特嘶啦奶茶」外为凤雏补的，可再换。
  const SIGNS = {
    c77:    [['77烧烤店','巴适得很，串串烤起走！'], ['七分糖七分拽','糖可以少，态度不能少'], ['摆龙门阵书局','看漫画也要摆龙门阵'], ['巴适不死机','服务器也要吃得巴适']],
    pearl:  [['掌上明猪烧烤','烤串配奶茶，绝配'], ['一颗不剩奶茶','珍珠要Q，一颗不剩'], ['字字珠玑书局','每一页都是珍珠'], ['算盘珠子科技','账算得比服务器还快']],
    otaku:  [['二次元烤肉部','烤串要有分镜感'], ['肥宅快乐茶','快乐是一杯一杯续的'], ['再看亿页书店','本店漫画，全部看过'], ['下班再说科技','代码写成热血漫']],
    rocket: [[RN.sign + '烧烤','今天的目标：把羊肉串送上天。'], [RN.tea + '奶茶','嘶——这杯加速有点猛。'], [RN.book + '书店','下一卷在火星连载'], [RN.short + '科技','目标：摸鱼摸到火星']],
  };

  /* ===== 4 个跨行组合：专属效果 + 两格漫画（熊大文案定稿；效果数值不变） ===== */
  // panels: [角色 id（头像）, 道具 emoji, 文案]
  const CROSS = {
    'rocket@0': { title:'火箭烤炉', effect:'bigFreq', desc:'大客户出现频率 ×2（间隔减半）',
      panels:[['rocket','🚀',RN.name + '推来火箭造型烤炉：“准备出串！”'], ['e0','🍢','阿炭看串转圈：“香味先起飞了。”']], sfx:'轰！' },
    'c77@3':    { title:'麻辣服务器', effect:'offlineCap', desc:'离线收益上限 +2 小时（8→10 小时）',
      panels:[['c77','🌶️','77 给机箱贴辣椒：“这台，麻辣款！”'], ['e3','🌡️','小栈盯着温度表：“老板，火候我盯着！”']], sfx:'滋啦！' },
    'pearl@2':  { title:'奶茶漫画联名', effect:'tapX2', desc:'在漫画书店点一下的收益 ×2',
      panels:[['pearl','🕵️','珍珠姐画起「珍珠侦探」。'], ['e2','🧋','阿页捧着书：“案件没破，奶茶先喝完了。”']], sfx:'吸溜！' },
    'otaku@1':  { title:'漫画杯套', effect:'milestonePanel', desc:'奶茶店冲里程碑时变成漫画分镜特效 + 一笔小红包',
      panels:[['otaku','✏️','阿宅店长：“喝一口，追一格。”'], ['e1','🥤','小满转着杯子：“结尾呢？哦，在背面！”']], sfx:'唰唰！' },
  };
  function crossKey(ceoId, shop) { return ceoId + '@' + shop; }

  /* ================= 基础公式 ================= */
  const MILESTONES = [10, 25, 50];
  function milestoneMult(lv) { return lv >= 50 ? 8 : lv >= 25 ? 4 : lv >= 10 ? 2 : 1; }
  function nextMilestone(lv) { for (const m of MILESTONES) if (lv < m) return m; return null; }
  function upgradeCost(i, lv) { return Math.ceil(SHOPS[i].upBase * Math.pow(CFG.UP_GROWTH, lv)); }
  function bulkUpgradeCost(i, lv, k) { let c = 0; for (let j = 0; j < k; j++) c += upgradeCost(i, lv + j); return c; }
  function empCost(i, e) { return e <= 0 ? SHOPS[i].hire : Math.ceil(SHOPS[i].hire * CFG.EMP_COST_K * Math.pow(CFG.EMP_GROWTH, e - 1)); }
  function ceoCost(id, lv) { return Math.ceil(CEO_BY_ID[id].upBase * Math.pow(CFG.CEO_GROWTH, lv - 1)); }
  function empMult(e) { return e > 0 ? 1 + CFG.EMP_LV_BONUS * (e - 1) : 0; }
  function shopBase(i, lv) { return lv > 0 ? SHOPS[i].rate * lv * milestoneMult(lv) : 0; }

  function ceoAt(st, i) { for (const c of CEOS) { const s = st.ceos[c.id]; if (s && s.unlocked && s.at === i) return c.id; } return null; }
  function ceoInfo(st, i) {
    const id = ceoAt(st, i);
    if (!id) return { id:null, match:false, mult:1, typeMult:1, lvMult:1 };
    const c = CEO_BY_ID[id], lv = st.ceos[id].lv, match = c.type === SHOPS[i].type;
    const typeMult = match ? CFG.MATCH_MULT : CFG.CROSS_MULT, lvMult = 1 + CFG.CEO_LV_BONUS * (lv - 1);
    return { id, match, typeMult, lvMult, mult:typeMult * lvMult, cross:match ? null : (CROSS[crossKey(id, i)] || null) };
  }
  function shopRate(st, i) {
    const s = st.shops[i]; if (!s || !s.open || s.emp <= 0) return 0;
    return shopBase(i, s.lv) * empMult(s.emp) * ceoInfo(st, i).mult;
  }
  function baseRate(st) { let r = 0; for (let i = 0; i < SHOPS.length; i++) r += shopRate(st, i); return r; }
  function boostActive(st, now) { return st.boostEnd > now && st.boostEnd - now <= CFG.BOOST_SEC * 1000 + 1000; }
  function onlineRate(st, now) { return baseRate(st) * (boostActive(st, now) ? CFG.BOOST_MULT : 1); }
  function offlineRate(st) { return baseRate(st) * CFG.OFFLINE_RATE; }

  /* ===== 跨行效果 ===== */
  function crossActive(st, key) { const [id, shop] = key.split('@'); const s = st.ceos[id]; return !!(s && s.unlocked && s.at === Number(shop)); }
  function offlineCap(st) { return CFG.OFFLINE_CAP + (crossActive(st, 'c77@3') ? CFG.OFFLINE_CAP_BONUS_77TECH : 0); }
  function bigInterval(st, rnd) { const k = crossActive(st, 'rocket@0') ? CFG.BIG_FREQ_ROCKET_BBQ : 1; return (CFG.BIG_MIN + (CFG.BIG_MAX - CFG.BIG_MIN) * rnd) * k; }
  function tapMult(st, i) { return i === 2 && crossActive(st, 'pearl@2') ? CFG.TAP_X_PEARL_BOOK : 1; }
  function tapValue(st, i) {
    const s = st.shops[i]; if (!s || !s.open) return 0;
    const v = Math.max(SHOPS[i].tapMin, Math.round(shopBase(i, s.lv) * ceoInfo(st, i).mult * CFG.TAP_FRAC * 10) / 10);
    return v * tapMult(st, i);
  }
  function tapReward(st, i, now, rnd) {
    const crit = rnd < CFG.CRIT_CHANCE;
    let v = tapValue(st, i) * (crit ? CFG.CRIT_MULT : 1);
    if (boostActive(st, now)) v *= CFG.BOOST_MULT;
    return { value:v, crit };
  }

  /* ================= CEO 解锁 / 调任 ================= */
  // 返回本次新解锁的 CEO id 列表；新 CEO 优先坐到自己的专长店（若空着）
  function checkUnlocks(st) {
    const out = [];
    const want = { c77:true, pearl:st.shops[1].open, otaku:st.shops[2].open, rocket:st.shops[3].open && st.shops[3].lv >= CFG.ROCKET_UNLOCK_LV };
    for (const c of CEOS) {
      const s = st.ceos[c.id];
      if (want[c.id] && !s.unlocked) {
        s.unlocked = true; s.lv = Math.max(1, s.lv || 1);
        s.at = (st.shops[c.home].open && !ceoAt(st, c.home)) ? c.home : -1;
        out.push(c.id);
      }
    }
    return out;
  }
  // 调任：CEO → 目标店（-1 = 空着/休息）。目标店有人时两人「交换任职」。只改 CEO 位置，店铺进度（按固定店 ID 存）不动。
  function assignCeo(st, id, target) {
    const s = st.ceos[id];
    if (!s || !s.unlocked) return { ok:false, why:'这位 CEO 还没加入' };
    if (target !== -1 && !(st.shops[target] && st.shops[target].open)) return { ok:false, why:'这家店还没开张' };
    if (s.at === target) return { ok:false, why:'已经在这里了' };
    const from = s.at, other = target === -1 ? null : ceoAt(st, target);
    s.at = target;
    if (other) st.ceos[other].at = from;
    return { ok:true, from, to:target, swapped:other };
  }
  // 调任生效前先把旧阵容的在线收益结清（≤5 秒的未结算部分；更长的空档走离线结算），再换人
  function creditOnline(st, now) {
    const gap = (now - st.lastSeen) / 1000;
    if (!(gap > 0) || gap > 5) return 0;
    const amt = onlineRate(st, now) * gap; st.coins += amt; st.totalEarned += amt; st.lastSeen = now; if (now > st.maxSeen) st.maxSeen = now;
    return amt;
  }
  function assignCeoWithPayout(st, id, target, now) {
    const paid = creditOnline(st, now);
    const r = assignCeo(st, id, target); r.paid = paid; return r;
  }
  function cloneState(st) { return JSON.parse(JSON.stringify(st)); }
  // 调任预览：每家店 & 全街每秒收益「调前 → 调后」，以及跨行效果、离线上限变化
  function previewAssign(st, id, target) {
    const after = cloneState(st);
    const r = assignCeo(after, id, target);
    if (!r.ok) return { ok:false, why:r.why };
    const shops = SHOPS.map((S, i) => ({ i, name:S.short, open:!!st.shops[i].open,
      before:shopRate(st, i), after:shopRate(after, i),
      ceoBefore:ceoAt(st, i), ceoAfter:ceoAt(after, i) }));
    const crossOn = [], crossOff = [];
    for (const k of Object.keys(CROSS)) {
      const b = crossActive(st, k), a = crossActive(after, k);
      if (a && !b) crossOn.push(k); if (b && !a) crossOff.push(k);
    }
    return { ok:true, swapped:r.swapped, from:r.from, to:target, shops,
      totalBefore:baseRate(st), totalAfter:baseRate(after),
      offlineCapBefore:offlineCap(st), offlineCapAfter:offlineCap(after), crossOn, crossOff };
  }
  function signOf(st, i) {
    const id = ceoAt(st, i);
    if (!id) return { name:SHOPS[i].short, slogan:'CEO 空缺中…' };
    const [name, slogan] = SIGNS[id][i]; return { name, slogan };
  }

  /* ================= 购买（成功则直接改 st） ================= */
  function canOpen(st, i) { const s = st.shops[i]; return !s.open && (i === 0 || st.shops[i - 1].open) && st.coins >= SHOPS[i].open; }
  function openShop(st, i) {
    const s = st.shops[i];
    if (s.open) return { ok:false, why:'已开张' };
    if (i > 0 && !st.shops[i - 1].open) return { ok:false, why:'先开前一家店' };
    if (st.coins < SHOPS[i].open) return { ok:false, why:'金币不够' };
    st.coins -= SHOPS[i].open; s.open = true; s.lv = Math.max(1, s.lv);
    return { ok:true, cost:SHOPS[i].open, unlocked:checkUnlocks(st) };
  }
  function hireEmp(st, i) {
    const s = st.shops[i];
    if (!s.open) return { ok:false, why:'还没开店' };
    if (s.emp > 0) return { ok:false, why:'每家店 1 位员工' };
    if (st.coins < SHOPS[i].hire) return { ok:false, why:'金币不够' };
    st.coins -= SHOPS[i].hire; s.emp = 1; return { ok:true, cost:SHOPS[i].hire };
  }
  function upgradeEmp(st, i) {
    const s = st.shops[i];
    if (!s.open || s.emp <= 0) return { ok:false, why:'先雇员工' };
    if (s.emp >= CFG.EMP_MAX) return { ok:false, why:'已满级' };
    const c = empCost(i, s.emp); if (st.coins < c) return { ok:false, why:'金币不够' };
    st.coins -= c; s.emp++; return { ok:true, cost:c, lv:s.emp };
  }
  function upgradeCeo(st, id) {
    const s = st.ceos[id];
    if (!s || !s.unlocked) return { ok:false, why:'还没加入' };
    if (s.lv >= CFG.CEO_MAX) return { ok:false, why:'已满级' };
    const c = ceoCost(id, s.lv); if (st.coins < c) return { ok:false, why:'金币不够' };
    st.coins -= c; s.lv++; return { ok:true, cost:c, lv:s.lv };
  }
  function upgradeShop(st, i) {
    const s = st.shops[i];
    if (!s.open) return { ok:false, why:'还没开店' };
    const c = upgradeCost(i, s.lv);
    if (st.coins < c) return { ok:false, why:'金币不够' };
    const before = s.lv;
    st.coins -= c; s.lv++;
    const milestone = milestoneMult(s.lv) > milestoneMult(before) ? milestoneMult(s.lv) : 0;
    let bonus = 0, panel = false;
    if (milestone && i === 1 && crossActive(st, 'otaku@1')) {   // 漫画杯套：一次性小红包
      panel = true;
      bonus = Math.max(CFG.AZHAI_BONUS_MIN, Math.round(shopRate(st, 1) * CFG.AZHAI_BONUS_SEC));
      st.coins += bonus; st.totalEarned += bonus;
    }
    return { ok:true, cost:c, lv:s.lv, milestone, bonus, panel, unlocked:checkUnlocks(st) };
  }

  /* ================= 时间 / 离线 / 每日双倍 ================= */
  const DAY_SHIFT = () => (CFG.TZ_OFFSET_MIN - CFG.DAY_RESET_HOUR * 60) * 60000;
  const pad = n => String(n).padStart(2, '0');
  // 「游戏日」：马来西亚时间早上 5 点切换（与手机时区无关）
  function dayKey(ts) { const d = new Date(ts + DAY_SHIFT()); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function nextResetTs(ts) { const sh = ts + DAY_SHIFT(); return Math.floor(sh / 86400000) * 86400000 + 86400000 - DAY_SHIFT(); }
  function clockRolledBack(st, now) { return now < (st.maxSeen || 0) - CFG.CLOCK_TOLERANCE * 1000; }
  // 计算离线（不改 st）：按离开时的店铺/员工/CEO 安排结算；先封顶，再（领取时）翻倍
  function computeOffline(st, now) {
    if (clockRolledBack(st, now)) return { gapSec:0, effSec:0, amount:0, cap:offlineCap(st), rolledBack:true };
    const from = Math.max(st.lastSeen || now, st.maxSeen || 0);
    const gap = Math.max(0, (now - from) / 1000);
    const cap = offlineCap(st);
    const already = st.pending ? st.pending.sec : 0;
    const eff = Math.max(0, Math.min(gap, cap - already));
    return { gapSec:gap, effSec:eff, amount:offlineRate(st) * eff, cap, rolledBack:false };
  }
  // 把离线结算写进 st.pending（调用方随后立刻保存）；返回 pending 或 null
  function settleOffline(st, now, idGen) {
    const off = computeOffline(st, now);
    if (off.rolledBack) { st.lastSeen = now; return { rolledBack:true }; }
    st.lastSeen = now; st.maxSeen = Math.max(st.maxSeen || 0, now);
    if (off.effSec <= 0 && !st.pending) return null;
    if (off.gapSec < CFG.OFFLINE_MIN && !st.pending) {   // 很短的离开：静默入账
      st.coins += off.amount; st.totalEarned += off.amount; return null;
    }
    const p = st.pending || { id:idGen ? idGen() : String(now), sec:0, gap:0, amount:0, from:now - off.gapSec * 1000 };
    p.sec += off.effSec; p.gap += off.gapSec; p.amount += off.amount; p.cap = off.cap;
    st.pending = p; return p;
  }
  function canDouble(st, now) { return !clockRolledBack(st, now) && st.dailyDoubleDay !== dayKey(now); }
  // 领取：入账 + 领取记录 + 清 pending 在同一个对象里改完，调用方一次性保存
  function claimOffline(st, now, useDouble) {
    const p = st.pending; if (!p) return { ok:false, why:'已经领过了' };
    if (st.claimLog.some(c => c.id === p.id)) { st.pending = null; return { ok:false, why:'已经领过了' }; }
    const dbl = !!useDouble && canDouble(st, now);
    const amt = p.amount * (dbl ? 2 : 1);
    st.coins += amt; st.totalEarned += amt;
    if (dbl) st.dailyDoubleDay = dayKey(now);
    st.claimLog.push({ id:p.id, amt:Math.round(amt), dbl, t:now }); if (st.claimLog.length > 20) st.claimLog.splice(0, st.claimLog.length - 20);
    st.pending = null;
    return { ok:true, amount:amt, doubled:dbl, sec:p.sec };
  }

  /* ================= 盲盒：16 项不重复收藏盒（熊大卡池） ================= */
  const ITEMS = [
    { id:'c_apron',  type:'clothes', name:'红油围裙' },
    { id:'c_flower', type:'clothes', name:'安逸花衬衫' },
    { id:'c_work',   type:'clothes', name:'串串工装' },
    { id:'c_panda',  type:'clothes', name:'熊猫睡衣' },
    { id:'h_chili',  type:'hat', name:'辣椒头巾' },
    { id:'h_bamboo', type:'hat', name:'小竹斗笠' },
    { id:'h_flame',  type:'hat', name:'火焰鸭舌帽' },
    { id:'h_panda',  type:'hat', name:'熊猫耳帽' },
    { id:'d_stool',  type:'decor', name:'竹编小椅' },
    { id:'d_lights', type:'decor', name:'辣椒串灯' },
    { id:'d_neon',   type:'decor', name:'77霓虹牌' },
    { id:'d_board',  type:'decor', name:'龙门阵黑板' },
    { id:'k_1', type:'card', name:'第一把炭',     text:'招牌还没挂稳，香味已经拐过街角，替77招呼客人。' },
    { id:'k_2', type:'card', name:'微辣是哪个微', text:'客人说只要一点辣。77认真点头，先把凉茶放得稳稳当当。' },
    { id:'k_3', type:'card', name:'熊猫监工',     text:'熊猫只盯着竹笋串。77宣布：今天的质检老师，专门负责素菜。' },
    { id:'k_4', type:'card', name:'收摊月亮',     text:'大家围着最后几串摆龙门阵，月亮也像迟到的客人。' },
  ];
  const ITEM_BY_ID = {}; ITEMS.forEach(it => ITEM_BY_ID[it.id] = it);
  const SET_REWARD = { id:'gold', name:'金牌摊主', clothes:'c_gold', hat:'h_gold', desc:'集齐 4 张故事卡解锁：金马甲 + 金厨师帽' };
  function gachaUnlocked(st) { return !!(st.shops[3] && st.shops[3].open && st.shops[3].emp > 0); }
  function gachaRemaining(st) { const own = new Set(st.gacha.owned); return ITEMS.filter(it => !own.has(it.id)); }
  function gachaOdds(st) { const n = gachaRemaining(st).length; return n ? 1 / n : 0; }
  function gachaPrice(st) { return Math.round(CFG.GACHA_PRICE * Math.pow(CFG.GACHA_GROWTH, st.gacha.owned.length)); }
  function cardsComplete(st) { const own = new Set(st.gacha.owned); return ITEMS.filter(i => i.type === 'card').every(i => own.has(i.id)); }
  // 抽一次：校验 → 扣币 → 从未收集物品等概率抽 → 入库（都改在 st 上，调用方一次性保存，动画只播 st.gacha.last）
  function gachaDraw(st, rnd, price) {
    price = price == null ? gachaPrice(st) : price;
    if (!gachaUnlocked(st)) return { ok:false, why:'摸鱼科技公司雇到员工后开放' };
    const rem = gachaRemaining(st);
    if (!rem.length) return { ok:false, why:'已集齐', complete:true };
    if (st.coins < price) return { ok:false, why:'金币不够' };
    const pick = rem[Math.min(rem.length - 1, Math.floor(rnd * rem.length))];
    st.coins -= price; st.gacha.owned.push(pick.id); st.gacha.draws++;
    const setDone = pick.type === 'card' && cardsComplete(st);
    st.gacha.last = { id:pick.id, n:st.gacha.draws, odds:'1/' + rem.length, setDone, seen:false };
    return { ok:true, item:pick, cost:price, oddsBefore:1 / rem.length, setDone };
  }

  /* ================= 存档：新建 / 版本迁移 ================= */
  function newState(now) {
    const st = {
      v:CFG.SAVE_VERSION, rev:0, coins:0, totalEarned:0,
      shops:SHOPS.map((_, i) => ({ open:i === 0, lv:i === 0 ? 1 : 0, emp:0 })),
      ceos:{}, crossSeen:{},
      taps:0, crits:0, bigCustomers:0, boostEnd:0,
      lastSeen:now, maxSeen:now, created:now,
      pending:null, dailyDoubleDay:null, claimLog:[],
      gacha:{ owned:[], draws:0, last:null },
      equip:{ clothes:null, hat:null }, decorHidden:[],
      ach:{}, muted:false, cur:0,
    };
    CEOS.forEach(c => st.ceos[c.id] = { unlocked:false, lv:1, at:-1 });
    checkUnlocks(st);
    return st;
  }
  const num = (x, d) => (typeof x === 'number' && isFinite(x)) ? x : d;
  // 任意旧档 → 当前版本。v1 = 定稿前「伙伴」版（shops[i].hired），v2 = CEO+员工
  function migrate(raw, now) {
    const base = newState(now);
    if (!raw || typeof raw !== 'object') return { st:base, from:null };
    const from = raw.v || 0;
    const st = Object.assign(base, raw);
    st.coins = Math.max(0, num(raw.coins, 0)); st.totalEarned = num(raw.totalEarned, st.coins);
    st.shops = SHOPS.map((_, i) => {
      const o = (raw.shops && raw.shops[i]) || {};
      const open = i === 0 ? true : !!o.open;
      return { open, lv:open ? Math.max(1, Math.floor(num(o.lv, 1))) : 0,
        emp:open ? Math.max(0, Math.min(CFG.EMP_MAX, Math.floor(num(o.emp, o.hired ? 1 : 0)))) : 0 };
    });
    st.ceos = {};
    CEOS.forEach(c => { const o = (raw.ceos && raw.ceos[c.id]) || {};
      st.ceos[c.id] = { unlocked:!!o.unlocked, lv:Math.max(1, Math.min(CFG.CEO_MAX, Math.floor(num(o.lv, 1)))), at:Number.isInteger(o.at) ? o.at : -1 }; });
    // 修正非法位置：没开张的店 / 一店多 CEO
    const taken = {};
    CEOS.forEach(c => { const s = st.ceos[c.id];
      if (!s.unlocked || s.at < -1 || s.at > 3 || (s.at >= 0 && !st.shops[s.at].open) || (s.at >= 0 && taken[s.at])) s.at = -1;
      if (s.at >= 0) taken[s.at] = true; });
    checkUnlocks(st);
    st.gacha = raw.gacha && Array.isArray(raw.gacha.owned)
      ? { owned:[...new Set(raw.gacha.owned.filter(id => ITEM_BY_ID[id]))], draws:num(raw.gacha.draws, 0), last:raw.gacha.last || null }
      : { owned:[], draws:0, last:null };
    st.claimLog = Array.isArray(raw.claimLog) ? raw.claimLog.slice(-20) : [];
    st.crossSeen = raw.crossSeen && typeof raw.crossSeen === 'object' ? raw.crossSeen : {};
    st.equip = raw.equip || { clothes:null, hat:null };
    st.decorHidden = Array.isArray(raw.decorHidden) ? raw.decorHidden : [];
    st.lastSeen = num(raw.lastSeen, now); st.maxSeen = Math.max(num(raw.maxSeen, 0), st.lastSeen);
    st.rev = num(raw.rev, 0);
    delete st.hired;
    st.v = CFG.SAVE_VERSION;
    return { st, from };
  }

  /* ================= 成就 / 下一步提示 ================= */
  function nextGoal(st) {
    const S = st.shops, c = st.coins;
    if (S[0].emp <= 0) return { text:'点烧烤摊赚钱，攒 50 雇员工阿炭', cur:c, need:SHOPS[0].hire };
    if (S[0].lv < 5) return { text:'升级烧烤摊，赚得更快', cur:c, need:upgradeCost(0, S[0].lv) };
    if (!S[1].open) return { text:'攒钱开第 2 家：奶茶店（珍珠姐加入）', cur:c, need:SHOPS[1].open };
    if (S[1].emp <= 0) return { text:'给奶茶店雇员工小满', cur:c, need:SHOPS[1].hire };
    if (S[0].lv < 10) return { text:'烧烤摊冲 Lv10：收益×2', cur:S[0].lv, need:10, lv:true };
    if (!S[2].open) return { text:'攒钱开漫画书店（阿宅店长加入）', cur:c, need:SHOPS[2].open };
    if (S[2].emp <= 0) return { text:'给书店雇员工阿页', cur:c, need:SHOPS[2].hire };
    if (!S[3].open) return { text:'攒钱开摸鱼科技公司', cur:c, need:SHOPS[3].open };
    if (S[3].emp <= 0) return { text:'给科技公司雇员工小栈（盲盒开放）', cur:c, need:SHOPS[3].hire };
    if (S[3].lv < CFG.ROCKET_UNLOCK_LV) return { text:'科技公司冲 Lv25：' + ROCKET_NAME.name + '加入', cur:S[3].lv, need:CFG.ROCKET_UNLOCK_LV, lv:true };
    if (st.gacha.owned.length < ITEMS.length) return { text:'盲盒收集 16 件', cur:st.gacha.owned.length, need:ITEMS.length, count:true };
    for (const i of [0, 1, 2, 3]) if (S[i].lv < 50) return { text:SHOPS[i].short + ' 冲 Lv50：收益×8', cur:S[i].lv, need:50, lv:true };
    return { text:'躺着也能赚，老板你赢麻了！', cur:1, need:1 };
  }

  return { CFG, ROCKET_NAME, TYPES, SHOPS, CEOS, CEO_BY_ID, SIGNS, CROSS, ITEMS, ITEM_BY_ID, SET_REWARD, MILESTONES,
    milestoneMult, nextMilestone, upgradeCost, bulkUpgradeCost, empCost, ceoCost, empMult, shopBase,
    ceoAt, ceoInfo, shopRate, baseRate, onlineRate, offlineRate, boostActive,
    crossKey, crossActive, offlineCap, bigInterval, tapMult, tapValue, tapReward,
    checkUnlocks, assignCeo, assignCeoWithPayout, creditOnline, previewAssign, signOf, cloneState,
    canOpen, openShop, hireEmp, upgradeEmp, upgradeCeo, upgradeShop,
    dayKey, nextResetTs, clockRolledBack, computeOffline, settleOffline, canDouble, claimOffline,
    gachaUnlocked, gachaRemaining, gachaOdds, gachaPrice, gachaDraw, cardsComplete, newState, migrate, nextGoal };
});
