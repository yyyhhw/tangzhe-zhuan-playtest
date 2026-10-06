/* 躺着也能赚 — 经济/结算核心 v2（CEO + 员工）。纯函数，不依赖 DOM，浏览器 / Node 通用。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Economy = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= 可调参数（数值都在这里） ================= */
  const CFG = {
    SAVE_VERSION: 3,
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
    BOOST_MULT: 5,              // 团单额外倍率：一次性结算 = 产速 × (MULT-1) × SEC（对账=旧 ×5 多出来的部分）
    BOOST_SEC: 30,              // 团单默认服务时长（秒）；点大客户可加快
    BIG_MIN: 120, BIG_MAX: 240, // 大客户每 2~4 分钟来一次（在线）
    BIG_STAY: 12,               // 兼容旧存档字段，已不用（团单自动开始服务）
    SPECIAL_MIN: 420, SPECIAL_MAX: 720, // 特殊客户每 7~12 分钟来一次（在线）
    SPECIAL_REWARD_SEC: 60,     // 特殊客户小奖励：本店 60 秒产量
    BIG_FREQ_ROCKET_BBQ: 0.5,   // 跨行事件「火箭烤炉」：间隔 ×0.5
    CRIT_CHANCE: 0.35, CRIT_MULT: 5,  // CRIT_CHANCE = 三档合计（兼容旧字段）；CRIT_MULT = 第 1 档倍率
    // 手点三档暴击（杨总 19:07 定，熊大 19:11 细化）：三档互斥，一次点击只结算一种
    CRIT_TIERS: [
      { p:0.20, mult:5,  name:'暴击',       word:'暴击！' },
      { p:0.10, mult:10, name:'超级暴击',   word:'超级暴击！' },
      { p:0.05, mult:20, name:'超超超级暴击', word:'超超超级暴击！！' },
    ],
    COMBO_GAP: 1.0,             // 两次点击间隔 ≤ 1 秒才续连
    COMBO_STEP: 50,             // 每满 50 连击……
    COMBO_ADD: 0.05,            // ……三档各 +5 个百分点；合计超过 100% 时封顶，剩余均分给三档
    TAP_FRAC: 0.35,             // 手点一次 ≈ 该店（含 CEO 加成）每秒基础产量的 35%
    TAP_X_PEARL_BOOK: 2,        // 跨行事件「奶茶漫画联名」：书店手点 ×2
    AZHAI_BONUS_SEC: 120,       // 跨行事件「漫画杯套」：奶茶店冲里程碑送 120 秒奶茶店产量
    AZHAI_BONUS_MIN: 500,
    ROCKET_UNLOCK_LV: 25,       // 科技公司 Lv25 解锁火箭老板
    GACHA_PRICE: 200000,        // 盲盒单价（可调；熊大候选 20 万）
    GACHA_GROWTH: 1,            // 每开一个涨价倍数（1 = 固定价；杨总 15:19 定：就 20 万一个）
    SUPER_P: 0.10,              // 每抽出超级装饰的概率（还有没抽到的超级装饰时）
    SUPER_PITY: 15,             // 保底：连续 14 抽没出超级装饰，第 15 抽必出
    SUPER_RATE: 1.3,            // 超级装饰：本店产量常驻 ×1.3（离线也算）
    PANDA_CRIT_ADD: 0.05,       // 熊猫食神：烧烤摊三档暴击各再 +5 个百分点（35% → 50%）
    FOUNTAIN_EVERY: 180, FOUNTAIN_SEC: 20, FOUNTAIN_MULT: 3,   // 珍珠喷泉：每 3 分钟连续爆单 20 秒，奶茶店 ×3、手点必暴击
    PORTAL_EVERY: 240, PORTAL_SEC: 90,                         // 次元传送门：每 4 分钟送书店 90 秒产量
    SUN_EVERY: 300, SUN_SEC: 30, SUN_MULT: 3, SUN_CRIT_X: 2, // 人造太阳反应堆：每 5 分钟超频 30 秒，科技 ×3、三档暴击倍率翻倍
    // 12d 金币安全 v1（熊大 16:49 / 16:50 定）：余额上限 1000 万亿；整数金币 coins + 不足 1 的零头 coinFrac 分开存
    COIN_CAP: 1e15,
    // 「最后一笔单价不超过余额上限」的等级边界（熊大 16:50 按现有价格公式算；test_coin_safety.js 用公式复核）
    SHOP_LV_MAX: [110, 93, 79, 69],                       // 店铺最高等级：烧烤 / 奶茶 / 书店 / 科技
    EMP_LV_MAX: [35, 31, 26, 22],                         // 员工可买到的等级（EMP_MAX 40 只用来收旧档）
    CEO_LV_MAX: { c77:30, pearl:30, otaku:30, rocket:25 },// CEO 可买到的等级
    MAX_BUY_STEPS: 200,                                   // MAX 批量购买一次最多循环次数
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

  /* ================= 12d 金币安全 v1：统一钱包（所有加钱 / 花钱只走这里） ================= */
  // 余额 = coins（整数）+ coinFrac（0 ≤ 零头 < 1）。整数部分到 1e15 也是精确整数，小额收入攒在零头里不会被吞。
  // 坏值（NaN / Infinity / 负数 / 非数字）一律拒绝，余额原样不动；到上限就停在上限；旧档已超上限的余额保留、不再增长。
  const COIN_CAP = () => CFG.COIN_CAP;
  const SAFE = Number.MAX_SAFE_INTEGER;   // 9007199254740991：超过它整数加减就不精确了（12d1：熊大 17:53）
  const isAmt = x => typeof x === 'number' && isFinite(x) && x >= 0;
  const fracOk = f => f === undefined || f === null || (isAmt(f) && f < 1);
  // 12d1：余额必须是安全整数范围内的有限非负数，否则整个钱包不能用（不入账、不扣款）
  //   ≤ 1e15：正常收支；1e15 < 余额 ≤ MAX_SAFE_INTEGER（旧档）：保留、能精确花、不再增长；> MAX_SAFE_INTEGER：异常，封禁所有交易
  function walletOk(st) {
    return !!st && isAmt(st.coins) && st.coins <= SAFE && fracOk(st.coinFrac);
  }
  // 把合法但没拆开的余额（旧档 / 测试直接写的 123.45）拆成整数 + 零头；坏值返回 false、一点不改
  function normWallet(st) {
    if (!walletOk(st)) return false;
    let c = st.coins, f = st.coinFrac == null ? 0 : st.coinFrac;
    if (c !== Math.floor(c)) { const w = Math.floor(c); f += c - w; c = w; }
    if (f >= 1) { const w = Math.floor(f); c += w; f -= w; }
    st.coins = c; st.coinFrac = f;
    return true;
  }
  function balance(st) { return walletOk(st) ? st.coins + (st.coinFrac || 0) : NaN; }
  // 12d1：累计收入同样拆成整数 totalEarned + 零头 earnedFrac（大额时逐帧小数不丢）；到 MAX_SAFE_INTEGER 封顶不再涨（只是统计）
  function normEarned(st) {
    let t = isAmt(st.totalEarned) ? st.totalEarned : (isAmt(st.coins) ? Math.min(st.coins, SAFE) : 0), f = isAmt(st.earnedFrac) && st.earnedFrac < 1 ? st.earnedFrac : 0;
    if (t !== Math.floor(t)) { const w = Math.floor(t); f += t - w; t = w; }
    if (f >= 1) { const w = Math.floor(f); t += w; f -= w; }
    st.totalEarned = t; st.earnedFrac = f;
  }
  function addEarned(st, amt) {
    normEarned(st);
    if (!(amt > 0) || st.totalEarned >= SAFE) return;
    const t = st.earnedFrac + amt, w = Math.floor(t);
    if (w >= SAFE - st.totalEarned) { st.totalEarned = SAFE; st.earnedFrac = 0; }
    else { st.totalEarned += w; st.earnedFrac = t - w; }
  }
  function overCap(st) { return walletOk(st) && st.coins >= COIN_CAP(); }
  // 入账：返回 { ok, added, capped, why }；added = 实际进账（到上限后多出来的不算）
  function addCoins(st, amt) {
    if (!isAmt(amt)) return { ok:false, added:0, why:'bad' };
    if (!normWallet(st)) return { ok:false, added:0, why:'badWallet' };
    if (amt === 0) return { ok:true, added:0, capped:st.coins >= COIN_CAP() };
    if (st.coins >= COIN_CAP()) return { ok:true, added:0, capped:true };   // 已到 / 旧档已超上限：保留，不再增长
    const b0 = st.coins + st.coinFrac, t = st.coinFrac + amt, w = Math.floor(t);
    let added;
    if (w >= COIN_CAP() - st.coins) { added = COIN_CAP() - b0; st.coins = COIN_CAP(); st.coinFrac = 0; }
    else { st.coins += w; st.coinFrac = t - w; added = amt; }
    addEarned(st, added);
    return { ok:true, added, capped:st.coins >= COIN_CAP() };
  }
  // 价格校验：非数字 / 无穷 / 负数 → 拒绝；超过余额上限 → 不能买（不压低价格）
  function priceOk(price) { return isAmt(price) && Math.ceil(price) <= COIN_CAP(); }
  function canAfford(st, price) { return priceOk(price) && walletOk(st) && st.coins >= Math.ceil(price); }   // 整数对整数比较（零头 < 1 不影响能不能买）
  // 扣款：返回 { ok, cost, why }；失败时余额一点不动
  // 12d1 通用断言：扣完必须「旧余额 − 价格 = 新余额」精确成立（安全整数、真的变少），否则回滚并拒绝——再也不会出现扣了钱余额没变的白买
  function spendCoins(st, price) {
    if (!isAmt(price)) return { ok:false, why:'价格异常' };
    const c = Math.ceil(price);
    if (c > COIN_CAP()) return { ok:false, why:'超出金币上限，不能买', over:true };
    if (!normWallet(st)) return { ok:false, why:'金币数据异常' };
    if (st.coins < c) return { ok:false, why:'金币不够' };
    const b0 = st.coins, f0 = st.coinFrac, after = b0 - c;
    if (!Number.isSafeInteger(b0) || !Number.isSafeInteger(after) || after < 0 || b0 - after !== c || after + c !== b0 || (c > 0 && !(after < b0)))
      return { ok:false, why:'金币扣款校验失败' };
    st.coins = after;
    if (st.coins !== after || b0 - st.coins !== c || st.coinFrac !== f0) { st.coins = b0; st.coinFrac = f0; return { ok:false, why:'金币扣款校验失败' }; }
    return { ok:true, cost:c };
  }
  // 等级上限（到顶显示满级；旧档已超过的保留但不能再升）
  function shopMaxLv(i) { return CFG.SHOP_LV_MAX[i]; }
  function empMaxLv(i) { return Math.min(CFG.EMP_MAX, CFG.EMP_LV_MAX[i]); }
  function ceoMaxLv(id) { return Math.min(CFG.CEO_MAX, CFG.CEO_LV_MAX[id] || CFG.CEO_MAX); }
  function shopMaxed(st, i) { return st.shops[i].lv >= shopMaxLv(i); }
  function empMaxed(st, i) { return st.shops[i].emp >= empMaxLv(i); }
  function ceoMaxed(st, id) { return st.ceos[id].lv >= ceoMaxLv(id); }
  // 店铺批量升级能买几级：want = 1 / 10 / 'max'。不超过等级上限；MAX 最多循环 MAX_BUY_STEPS 次、单价超上限即停
  // 12d1：MAX 买不起一级（含余额为 0 / 坏值）返回 0，不再兜底成 1；x1 / x10 是玩家指定数量，照常返回（买不起由按钮置灰 + 扣款拒绝）
  function shopBuyCount(st, i, want) {
    const s = st.shops[i], room = Math.max(0, shopMaxLv(i) - s.lv);
    if (!room) return 0;
    if (want !== 'max') return Math.max(1, Math.min(room, Math.floor(Number(want)) || 1));
    if (!walletOk(st)) return 0;
    const bal = st.coins; let k = 0, c = 0;
    const lim = Math.min(room, CFG.MAX_BUY_STEPS);
    while (k < lim) { const n = upgradeCost(i, s.lv + k); if (!priceOk(n) || !(c + n <= bal)) break; c += n; k++; }
    return k;
  }

  /* ===== 超级装饰（每店一件，只能从盲盒抽到；效果常驻，不用摆放） ===== */
  const SUPER_OF_SHOP = ['s_panda', 's_fountain', 's_portal', 's_sun'];
  function hasSuper(st, i) { return !!(st.gacha && st.gacha.owned && st.gacha.owned.indexOf(SUPER_OF_SHOP[i]) >= 0); }
  function superMult(st, i) { return hasSuper(st, i) ? CFG.SUPER_RATE : 1; }
  const RUSH_SEC = { tea:'FOUNTAIN_SEC', tech:'SUN_SEC' };
  function rushActive(st, k, now) { const e = st.rush && st.rush[k]; return !!e && e > now && e - now <= CFG[RUSH_SEC[k]] * 1000 + 1000; }
  function rushMult(st, i, now) {
    if (i === 1 && hasSuper(st, 1) && rushActive(st, 'tea', now)) return CFG.FOUNTAIN_MULT;
    if (i === 3 && hasSuper(st, 3) && rushActive(st, 'tech', now)) return CFG.SUN_MULT;
    return 1;
  }
  function startRush(st, k, now) { if (!st.rush) st.rush = { tea:0, tech:0 }; st.rush[k] = now + CFG[RUSH_SEC[k]] * 1000; }
  // 连击：上一击在 gap 秒内就 +1，否则从 1 重新算（tSec / lastSec 单位：秒）
  function comboNext(prevN, lastSec, tSec) { return prevN > 0 && tSec - lastSec <= CFG.COMBO_GAP + 1e-9 && tSec >= lastSec ? prevN + 1 : 1; }
  // 已连 prev 下之后，下一击的加成档数（满 50 连击 → 1 档）
  function comboSteps(prev) { return Math.floor(Math.max(0, prev || 0) / CFG.COMBO_STEP); }
  // 三档各自概率 [p1,p2,p3]；prev = 这一击之前已经连了几下
  function critTiers(st, i, now, prev) {
    const base = CFG.CRIT_TIERS.map(t => t.p), sum = base.reduce((a, b) => a + b, 0);
    let add = comboSteps(prev) * CFG.COMBO_ADD;
    if (i === 0 && hasSuper(st, 0)) add += CFG.PANDA_CRIT_ADD;
    const capAdd = (1 - sum) / base.length;
    if (i === 1 && hasSuper(st, 1) && rushActive(st, 'tea', now)) add = capAdd; // 爆单：必暴击
    if (add > capAdd) add = capAdd;
    return base.map(p => p + add);
  }
  function critChance(st, i, now, prev) { const r = critTiers(st, i, now, prev).reduce((a, b) => a + b, 0); return Math.min(1, Math.round(r * 1e6) / 1e6); }
  function tierMult(st, i, now, k) { const m = CFG.CRIT_TIERS[k].mult; return i === 3 && hasSuper(st, 3) && rushActive(st, 'tech', now) ? m * CFG.SUN_CRIT_X : m; }
  function critMult(st, i, now) { return tierMult(st, i, now, 0); }
  // 下一档进度：{ steps, into, need, maxed }
  function comboProgress(st, i, now, n) {
    const maxed = critChance(st, i, now, n) >= 1, into = n % CFG.COMBO_STEP;
    return { steps:comboSteps(n), into:maxed ? CFG.COMBO_STEP : into, need:CFG.COMBO_STEP, maxed };
  }
  function portalReward(st) { return hasSuper(st, 2) ? shopRate(st, 2) * CFG.PORTAL_SEC : 0; }

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
    const r = shopBase(i, s.lv) * empMult(s.emp) * ceoInfo(st, i).mult * superMult(st, i);
    return isAmt(r) ? r : 0;   // 12d：产速只认有限非负数（坏档 / 内存坏值不会产出 NaN / ∞）
  }
  function baseRate(st) { let r = 0; for (let i = 0; i < SHOPS.length; i++) r += shopRate(st, i); return r; }
  // 旧版「×5 持续 30 秒」已废弃；保留 boostActive 只为读旧档不报错，永远按未激活算
  function boostActive(st, now) { return false; }
  function rushOnlineRate(st, now) {
    let r = 0; for (let i = 0; i < SHOPS.length; i++) r += shopRate(st, i) * rushMult(st, i, now);
    return r;
  }
  function onlineRate(st, now) { return rushOnlineRate(st, now); }
  function offlineRate(st) { return baseRate(st) * CFG.OFFLINE_RATE; }
  // 团单一次性收入 = 旧「30 秒 ×5」多出来的部分（产速 ×4 ×30），总收益与旧版一致、不会和自动收入算两次
  function orderPayout(rate) { return Math.max(0, rate) * (CFG.BOOST_MULT - 1) * CFG.BOOST_SEC; }
  function settleOrder(st, payout) {
    if (!isAmt(payout) || !(payout > 0)) return 0;          // 12d：坏团单金额拒绝，余额不动
    const r = addCoins(st, payout); if (!r.ok) return 0;
    st.bigCustomers = (st.bigCustomers || 0) + 1;
    st.boostEnd = 0; // 清掉旧档可能残留的 ×5
    return r.added;
  }

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
  // prev = 这一击之前已连了几下（不传 = 0）；tier 0 = 普通，1/2/3 = 三档暴击
  function tapReward(st, i, now, rnd, prev) {
    const ps = critTiers(st, i, now, prev); let acc = 0, tier = 0;
    for (let k = 0; k < ps.length; k++) { acc += ps[k]; if (rnd < acc - 1e-12 || (k === ps.length - 1 && acc >= 1 - 1e-9 && rnd < 1)) { tier = k + 1; break; } }
    const mult = tier ? tierMult(st, i, now, tier - 1) : 1;
    return { value:tapValue(st, i) * mult, crit:tier > 0, tier, mult };
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
    const r = addCoins(st, onlineRate(st, now) * gap); if (!r.ok) return 0;   // 12d：调任结清也走统一入账
    st.lastSeen = now; if (now > st.maxSeen) st.maxSeen = now;
    return r.added;
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
  function canOpen(st, i) { const s = st.shops[i]; return !s.open && (i === 0 || st.shops[i - 1].open) && canAfford(st, SHOPS[i].open); }
  function openShop(st, i) {
    const s = st.shops[i];
    if (s.open) return { ok:false, why:'已开张' };
    if (i > 0 && !st.shops[i - 1].open) return { ok:false, why:'先开前一家店' };
    const pay = spendCoins(st, SHOPS[i].open); if (!pay.ok) return { ok:false, why:pay.why };
    s.open = true; s.lv = Math.max(1, s.lv);
    return { ok:true, cost:SHOPS[i].open, unlocked:checkUnlocks(st) };
  }
  function hireEmp(st, i) {
    const s = st.shops[i];
    if (!s.open) return { ok:false, why:'还没开店' };
    if (s.emp > 0) return { ok:false, why:'每家店 1 位员工' };
    const pay = spendCoins(st, SHOPS[i].hire); if (!pay.ok) return { ok:false, why:pay.why };
    s.emp = 1; return { ok:true, cost:SHOPS[i].hire };
  }
  function upgradeEmp(st, i) {
    const s = st.shops[i];
    if (!s.open || s.emp <= 0) return { ok:false, why:'先雇员工' };
    if (s.emp >= empMaxLv(i)) return { ok:false, why:'已满级', max:true };
    const c = empCost(i, s.emp), pay = spendCoins(st, c); if (!pay.ok) return { ok:false, why:pay.why };
    s.emp++; return { ok:true, cost:c, lv:s.emp };
  }
  function upgradeCeo(st, id) {
    const s = st.ceos[id];
    if (!s || !s.unlocked) return { ok:false, why:'还没加入' };
    if (s.lv >= ceoMaxLv(id)) return { ok:false, why:'已满级', max:true };
    const c = ceoCost(id, s.lv), pay = spendCoins(st, c); if (!pay.ok) return { ok:false, why:pay.why };
    s.lv++; return { ok:true, cost:c, lv:s.lv };
  }
  function upgradeShop(st, i) {
    const s = st.shops[i];
    if (!s.open) return { ok:false, why:'还没开店' };
    if (s.lv >= shopMaxLv(i)) return { ok:false, why:'已满级', max:true };   // 12d：店铺有限等级；旧档超过的保留、不能再升
    const c = upgradeCost(i, s.lv);
    const pay = spendCoins(st, c); if (!pay.ok) return { ok:false, why:pay.why };
    const before = s.lv;
    s.lv++;
    const milestone = milestoneMult(s.lv) > milestoneMult(before) ? milestoneMult(s.lv) : 0;
    let bonus = 0, panel = false;
    if (milestone && i === 1 && crossActive(st, 'otaku@1')) {   // 漫画杯套：一次性小红包
      panel = true;
      bonus = addCoins(st, Math.max(CFG.AZHAI_BONUS_MIN, Math.round(shopRate(st, 1) * CFG.AZHAI_BONUS_SEC))).added;
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
    const already = st.pending && isAmt(st.pending.sec) ? st.pending.sec : 0;
    const eff = Math.max(0, Math.min(gap, cap - already));
    const amount = offlineRate(st) * eff;
    return { gapSec:gap, effSec:eff, amount:isAmt(amount) ? amount : 0, cap, rolledBack:false };
  }
  // 把离线结算写进 st.pending（调用方随后立刻保存）；返回 pending 或 null
  function settleOffline(st, now, idGen) {
    if (!walletOk(st)) { if (isAmt(now) && !(now < (st.lastSeen || 0))) { st.lastSeen = now; st.maxSeen = Math.max(st.maxSeen || 0, now); } return null; }   // 12d1：钱包异常（如余额超安全整数）→ 不结算离线、不弹领取、余额不动；只把时间往前记（否则每帧都判「刚回来」）
    if (st.pending && !pendingOk(st.pending)) st.pending = null;   // 12d：坏的待领取收益丢掉，不入账、不拿它累加
    const off = computeOffline(st, now);
    if (off.rolledBack) { st.lastSeen = now; return { rolledBack:true }; }
    st.lastSeen = now; st.maxSeen = Math.max(st.maxSeen || 0, now);
    if (off.effSec <= 0 && !st.pending) return null;
    if (off.gapSec < CFG.OFFLINE_MIN && !st.pending) {   // 很短的离开：静默入账
      addCoins(st, off.amount); return null;
    }
    const p = st.pending || { id:idGen ? idGen() : String(now), sec:0, gap:0, amount:0, from:now - off.gapSec * 1000 };
    p.sec += off.effSec; p.gap += off.gapSec; p.amount += off.amount; p.cap = off.cap;
    st.pending = p; return p;
  }
  function canDouble(st, now) { return !clockRolledBack(st, now) && st.dailyDoubleDay !== dayKey(now); }
  // 领取：入账 + 领取记录 + 清 pending 在同一个对象里改完，调用方一次性保存
  function pendingOk(p) { return !!p && typeof p === 'object' && isAmt(p.amount) && isAmt(p.sec) && (typeof p.id === 'string' || typeof p.id === 'number'); }
  function claimOffline(st, now, useDouble) {
    const p = st.pending; if (!p) return { ok:false, why:'已经领过了' };
    if (!pendingOk(p)) { st.pending = null; return { ok:false, why:'离线收益数据异常，没有入账', bad:true }; }   // 12d：坏值拒绝，余额不动
    if (!Array.isArray(st.claimLog)) st.claimLog = [];
    if (st.claimLog.some(c => c.id === p.id)) { st.pending = null; return { ok:false, why:'已经领过了' }; }
    if (!walletOk(st)) return { ok:false, why:'金币数据异常' };
    const dbl = !!useDouble && canDouble(st, now);
    const amt = p.amount * (dbl ? 2 : 1);
    const got = addCoins(st, amt); if (!got.ok) return { ok:false, why:'离线收益数据异常，没有入账', bad:true };
    if (dbl) st.dailyDoubleDay = dayKey(now);
    st.claimLog.push({ id:p.id, amt:Math.round(amt), dbl, t:now }); if (st.claimLog.length > 20) st.claimLog.splice(0, st.claimLog.length - 20);
    st.pending = null;
    return { ok:true, amount:amt, added:got.added, capped:got.capped, doubled:dbl, sec:p.sec };
  }


  /* ================= 大客户团单 / 特殊客户（名字台词熊大可再换；id 别动） ================= */
  const BIG_ORDERS = [
    { shop:0, name:'旅游团包场', line:'整桌都要！微辣多加签！', emoji:'🚌' },
    { shop:1, name:'公司团建奶茶', line:'五十杯七分糖，马上要！', emoji:'🏢' },
    { shop:2, name:'同人展采购团', line:'这套全要，再加周边！', emoji:'📚' },
    { shop:3, name:'甲方验收团', line:'签字！打款！今晚上线！', emoji:'📝' },
  ];
  // 每店 1 个特殊客户占位：两格漫画 + 本店 SPECIAL_REWARD_SEC 秒产量
  const SPECIAL_GUESTS = [
    { id:'sp0', shop:0, name:'夜游食神（占位）', emoji:'🐼',
      panels:[['c77','🍢','（占位）神秘客人点了传说中的竹笋串。'], ['e0','✨','阿炭：（占位）这单，香气能飘三条街。']] },
    { id:'sp1', shop:1, name:'珍珠鉴赏家（占位）', emoji:'🧋',
      panels:[['pearl','🔍','（占位）客人掏出放大镜数珍珠。'], ['e1','🥤','小满：（占位）一颗都不能少，这单我包了。']] },
    { id:'sp2', shop:2, name:'连载催更侠（占位）', emoji:'📖',
      panels:[['otaku','✏️','（占位）催更侠把收银台画成下一话预告。'], ['e2','📚','阿页：（占位）案件没破，先把书结了。']] },
    { id:'sp3', shop:3, name:'火星投资人（占位）', emoji:'🚀',
      panels:[['rocket','💼','（占位）投资人说：先把服务器送到火星。'], ['e3','💻','小栈：（占位）代码能重构，合同不能拖。']] },
  ];
  function specialReward(st, shop) { return shopRate(st, shop) * CFG.SPECIAL_REWARD_SEC; }
  function settleSpecial(st, shop) {
    const amt = specialReward(st, shop); st.specialCustomers = (st.specialCustomers || 0) + 1;
    if (!isAmt(amt) || !(amt > 0)) return 0;
    return addCoins(st, amt).added;
  }
  function specialInterval(st, rnd) { return CFG.SPECIAL_MIN + (CFG.SPECIAL_MAX - CFG.SPECIAL_MIN) * rnd; }

  /* ================= 盲盒 v2：32 件普通收藏 + 4 件超级装饰，不重复（杨总 15:19 / 熊大方向） ================= */
  // 名字是凤雏先补的占位，熊大可以换（只改 name / text，id 别动，存档靠 id）
  const ITEMS = [
    { id:'c_apron',  type:'clothes', name:'红油围裙' },
    { id:'c_flower', type:'clothes', name:'安逸花衬衫' },
    { id:'c_work',   type:'clothes', name:'串串工装' },
    { id:'c_panda',  type:'clothes', name:'熊猫睡衣' },
    { id:'c_qipao',  type:'clothes', name:'珍珠小旗袍' },
    { id:'c_hoodie', type:'clothes', name:'连载中卫衣' },
    { id:'c_space',  type:'clothes', name:'小火箭宇航服' },
    { id:'c_suit',   type:'clothes', name:'摸鱼西装' },
    { id:'h_chili',  type:'hat', name:'辣椒头巾' },
    { id:'h_bamboo', type:'hat', name:'小竹斗笠' },
    { id:'h_flame',  type:'hat', name:'火焰鸭舌帽' },
    { id:'h_panda',  type:'hat', name:'熊猫耳帽' },
    { id:'h_boba',   type:'hat', name:'奶茶杯帽' },
    { id:'h_beret',  type:'hat', name:'漫画家贝雷帽' },
    { id:'h_helmet', type:'hat', name:'太空头盔' },
    { id:'h_crown',  type:'hat', name:'招财小王冠' },
    { id:'d_stool',  type:'decor', name:'竹编小椅' },
    { id:'d_lights', type:'decor', name:'辣椒串灯' },
    { id:'d_neon',   type:'decor', name:'77霓虹牌' },
    { id:'d_board',  type:'decor', name:'龙门阵黑板' },
    { id:'d_balloon',type:'decor', name:'珍珠气球' },
    { id:'d_poster', type:'decor', name:'热血连载海报' },
    { id:'d_cat',    type:'decor', name:'招财猫' },
    { id:'d_plant',  type:'decor', name:'摸鱼绿萝' },
    { id:'k_1', type:'card', name:'第一把炭',     text:'招牌还没挂稳，香味已经拐过街角，替77招呼客人。' },
    { id:'k_2', type:'card', name:'微辣是哪个微', text:'客人说只要一点辣。77认真点头，先把凉茶放得稳稳当当。' },
    { id:'k_3', type:'card', name:'熊猫监工',     text:'熊猫只盯着竹笋串。77宣布：今天的质检老师，专门负责素菜。' },
    { id:'k_4', type:'card', name:'收摊月亮',     text:'大家围着最后几串摆龙门阵，月亮也像迟到的客人。' },
    { id:'k_5', type:'card', name:'一颗都不能少', text:'珍珠姐数珍珠比数钱还认真，多出来的一颗，也要追出门还给客人。' },
    { id:'k_6', type:'card', name:'名场面',       text:'阿宅店长把收银台画成漫画格，客人排队像在等下一话更新。' },
    { id:'k_7', type:'card', name:'发射倒计时',   text:'火箭老板喊完三、二、一，起飞的只有门口那串气球。' },
    { id:'k_8', type:'card', name:'一条街的灯',   text:'四家店同时亮灯那晚，77说：今天的龙门阵，摆一整条街。' },
    { id:'s_panda',    type:'super', shop:0, name:'熊猫食神',       desc:'抱着竹笋串营业：烧烤摊产量 +30%，手点三档暴击各 +5 个百分点（35% → 50%）' },
    { id:'s_fountain', type:'super', shop:1, name:'珍珠喷泉',       desc:'奶茶店产量 +30%；在线每 3 分钟连续爆单 20 秒：奶茶店产量 ×3、手点必暴击' },
    { id:'s_portal',   type:'super', shop:2, name:'次元传送门',     desc:'漫画书店产量 +30%；在线每 4 分钟漫画角色客串，送书店 90 秒产量的大订单' },
    { id:'s_sun',      type:'super', shop:3, name:'人造太阳反应堆', desc:'科技公司产量 +30%；在线每 5 分钟超频 30 秒：科技公司产量 ×3、三档暴击倍率翻倍' },
  ];
  const ITEM_BY_ID = {}; ITEMS.forEach(it => ITEM_BY_ID[it.id] = it);
  const REGULAR_ITEMS = ITEMS.filter(it => it.type !== 'super'), SUPER_ITEMS = ITEMS.filter(it => it.type === 'super');
  const CARD_COUNT = ITEMS.filter(it => it.type === 'card').length;
  const SET_REWARD = { id:'gold', name:'金牌摊主', clothes:'c_gold', hat:'h_gold', desc:'集齐 ' + CARD_COUNT + ' 张故事卡解锁：金马甲 + 金厨师帽' };
  function gachaUnlocked(st) { return !!(st.shops[3] && st.shops[3].open && st.shops[3].emp > 0); }
  function gachaRemaining(st) { const own = new Set(st.gacha.owned); return ITEMS.filter(it => !own.has(it.id)); }
  function gachaComplete(st) { return gachaRemaining(st).length === 0; }
  // 当前这一抽的概率：普通 / 超级分开算，带保底
  function gachaOdds(st) {
    const rem = gachaRemaining(st), rs = rem.filter(it => it.type === 'super'), rr = rem.filter(it => it.type !== 'super');
    const pity = st.gacha.pity || 0, pityLeft = Math.max(1, CFG.SUPER_PITY - pity);
    let sp = !rs.length ? 0 : !rr.length ? 1 : pityLeft <= 1 ? 1 : CFG.SUPER_P;
    return { superP:sp, regP:rem.length ? 1 - sp : 0, perSuper:rs.length ? sp / rs.length : 0, perReg:rr.length ? (1 - sp) / rr.length : 0,
      remSuper:rs.length, remReg:rr.length, pityLeft:rs.length ? pityLeft : null, guaranteed:rs.length > 0 && sp === 1 };
  }
  function gachaPrice(st) { return Math.round(CFG.GACHA_PRICE * Math.pow(CFG.GACHA_GROWTH, st.gacha.owned.length)); }
  function cardsComplete(st) { const own = new Set(st.gacha.owned); return ITEMS.filter(i => i.type === 'card').every(i => own.has(i.id)); }
  const pct = x => (x * 100 >= 10 || x === 0 ? (x * 100).toFixed(0) : (x * 100).toFixed(1)) + '%';
  // 抽一次：校验 → 扣币 → 先定「普通/超级」再在没收集的里等概率抽 → 入库（都改在 st 上，调用方一次性保存，动画只播 st.gacha.last）
  function gachaDraw(st, rnd, price) {
    price = price == null ? gachaPrice(st) : price;
    if (!gachaUnlocked(st)) return { ok:false, why:'摸鱼科技公司雇到员工后开放' };
    const rem = gachaRemaining(st);
    if (!rem.length) return { ok:false, why:'已集齐', complete:true };
    if (!priceOk(price)) return { ok:false, why:'价格异常' };
    if (!canAfford(st, price)) return { ok:false, why:walletOk(st) ? '金币不够' : '金币数据异常' };
    const o = gachaOdds(st), isSuper = rnd < o.superP;
    const pool = rem.filter(it => (it.type === 'super') === isSuper);
    const u = isSuper ? rnd / o.superP : (rnd - o.superP) / (1 - o.superP);
    const pick = pool[Math.min(pool.length - 1, Math.max(0, Math.floor(u * pool.length)))];
    const pay = spendCoins(st, price); if (!pay.ok) return { ok:false, why:pay.why };
    st.gacha.owned.push(pick.id); st.gacha.draws++;
    st.gacha.pity = isSuper ? 0 : (st.gacha.pity || 0) + 1;
    const setDone = pick.type === 'card' && cardsComplete(st);
    const odds = isSuper ? (o.guaranteed && o.superP === 1 && o.remReg ? '保底必出超级装饰 · 这件 1/' + pool.length : '超级 ' + pct(o.superP) + ' · 这件 1/' + pool.length)
                         : '普通 ' + pct(o.regP) + ' · 这件 1/' + pool.length;
    st.gacha.last = { id:pick.id, n:st.gacha.draws, odds, setDone, seen:false, super:isSuper };
    return { ok:true, item:pick, cost:price, super:isSuper, odds:o, setDone };
  }

  const num = (x, d) => (typeof x === 'number' && isFinite(x)) ? x : d;
  /* ================= CEO 生活篇：家宅 / 商城 / 摆放（和经营共用金币；不加产速、不影响开店） ================= */
  // 方案 A（杨总定）：四家共用一个家具仓库 state.furnInv = {fid:数量}
  // 每件实例同一时间只摆在一家：state.homes[ceoId] = { lv, placed:[{uid,fid,x,y,rot}], next }
  // 收回 → 回公共仓库 → 可搬到别家；想四家都有就买四件。只有买家具 / 升级房子花金币。
  // 名字/价格/豪华度可调；id 别动（存档靠 id，美术按 art/furn_<名>.webp）
  const HOME_TIERS = [
    { id:'hut',   name:'小屋', cols:6,  rows:4, cost:0,       bonus:0,  wall:'#f6e7cf', floor:'#d9b38c', trim:'#8d5524' },
    { id:'apt',   name:'公寓', cols:8,  rows:5, cost:80000,   bonus:10, wall:'#e3f0ff', floor:'#c9d6e3', trim:'#3a86ff' },
    { id:'villa', name:'豪宅', cols:10, rows:6, cost:6000000, bonus:30, wall:'#fff3c4', floor:'#e9d5a8', trim:'#b8860b' },
  ];
  // w×h = 占地（格），rot 为奇数时宽高互换；layer:'rug' 地毯可以垫在家具下面（地毯之间不能叠）
  // wall:true = 挂画：只挂墙面（surf:'wall'），不占地板格；墙面格子 cols×WALL_ROWS，避开窗户 / 房名牌
  const WALL_ROWS = 2;
  // 墙面禁区：格子坐标 [x,y]，挂画任意一格踩到就不行；自动摆放（findFree）和手动拖动（canPlace）共用这一份
  // 有底图的房间按底图实拍校准（墙面 = 底图上方 1200×400，每格 200×200）：四家 Lv1 右边 4 列都是画好的窗户 / 架子 / 挂饰，
  // 只有左边 2 列是空墙；房名牌在有底图时挪到右上角（压在禁区上），不再占空墙
  const ART_WALL = (cols) => { const out = []; for (let y = 0; y < WALL_ROWS; y++) for (const x of cols) out.push([x, y]); return out; };
  const WALL_BLOCK = {
    c77_1:    ART_WALL([2, 3, 4, 5]),   // 围裙挂钩（第 3 列）+ 格子窗帘大窗（第 4–6 列，上下两排都占）
    pearl_1:  ART_WALL([2, 3, 4, 5]),   // 茶具搁架 + 蝴蝶结（第 3–4 列）+ 椭圆花框 / 彩旗 / 干花束（第 5–6 列）
    otaku_1:  ART_WALL([2, 3, 4, 5]),   // 绿植书架 + 手柄 / 耳机挂钩（第 3–4 列）+ 百叶窗（第 4–6 列）
    rocket_1: ART_WALL([2, 3, 4, 5]),   // 火箭搁架 + 星图画框（第 3–5 列）+ 舷窗 / 铜管（第 5–6 列）
    // 12b1：杨总给的 77 / 珍珠姐 Lv2（公寓 8 列）、Lv3（豪宅 10 列）底图，按实图标格子（第 N 列 = 从 1 数）
    c77_2:    ART_WALL([4, 5, 6, 7]),           // 格子窗帘拱窗（第 5–7 列，左框压到第 5 列边）+ 绿植壁龛 / 毛巾挂杆（第 7–8 列）
    c77_3:    ART_WALL([5, 6, 7, 8, 9]),        // 双拱窗 + 藤蔓花（第 6–10 列，左拱柱压到第 6 列）
    pearl_2:  ART_WALL([2, 3, 4, 5, 6, 7]),     // 绿色壁柱（第 3–4 列）+ 装饰墙板 + 半圆拱窗 / 蝴蝶结花饰（第 5–8 列）
    pearl_3:  ART_WALL([4, 5, 6, 7, 8, 9]).concat([[3, 0]]),  // 玻璃花房（第 5–10 列）+ 上排第 4 列垂下的花藤
    // 12b2：阿宅 / 火箭老板 Lv2、Lv3 底图，同样按实图标（第 N 列 = 从 1 数）
    otaku_2:  ART_WALL([3, 4, 5, 6, 7]),        // 竖条格栅壁柱（第 4 列右半 + 右墙边）+ 金边柜门（第 5–6 列）+ 手办 / 书 / 绿植灯光书架（第 6–8 列）
    otaku_3:  ART_WALL([2, 3, 4, 5, 6, 7, 8, 9]),  // 左边奶白软包板只占第 1–2 列；第 3 列起是蓝色灯带 + 大理石波浪板 + 竖条格栅 + 战机 / 手办壁龛（第 7–10 列）
    rocket_2: ART_WALL([3, 4, 5, 6, 7]),        // 铆钉立柱 + 铜壁灯（第 4 列）+ 大舷窗（第 5–8 列）；第 1–3 列是素面铆钉钢板
    rocket_3: ART_WALL([3, 4, 5, 6, 7, 8, 9]),  // 穹顶弧梁（第 4–5 列）+ 星空大窗 + 灯带（第 6–10 列）；第 1 列左边一段弧梁压边，挂画盖住无妨，保住小屋左两列
  };
  // 没底图（升级后的公寓 / 豪宅）：emoji 窗户 + 房名牌都靠右上，占第一排最右 3 格；左边永远留空墙，
  // 所以小屋左 2 列挂好的画升级后照样合法（格子只会变大）
  function plainWallBlock(cols) { return [[cols - 3, 0], [cols - 2, 0], [cols - 1, 0]]; }
  function wallBlockedCells(st, id) {
    const h = homeOf(st, id), k = id + '_' + h.lv;
    return WALL_BLOCK[k] ? WALL_BLOCK[k].map(c => c.slice()) : plainWallBlock(homeTier(h.lv).cols);
  }
  function hitsWallBlock(st, id, x, y, w, h) {
    const blocked = wallBlockedCells(st, id);
    for (const [bx, by] of blocked) if (bx >= x && bx < x + w && by >= y && by < y + h) return true;
    return false;
  }
  // cat = 商城一级分类；sub = 柜架子类（衣柜/书架/储物柜）
  const MALL_CATS = [
    { id:'bed',   name:'床具' },
    { id:'cabinet', name:'柜架', subs:[
      { id:'wardrobe', name:'衣柜' }, { id:'bookshelf', name:'书架' }, { id:'storage', name:'储物柜' },
    ]},
    { id:'seat',  name:'桌椅沙发' },
    { id:'lamp',  name:'灯具' },
    { id:'appliance', name:'家电' },
    { id:'rug',   name:'地毯' },
    { id:'wall',  name:'墙饰' },
    { id:'plant', name:'绿植摆件' },
  ];
  const FURNITURE = [
    { id:'furn_rug',       name:'地毯', emoji:'🟥', color:'#e76f51', w:3, h:2, price:300,   lux:3,  layer:'rug', cat:'rug' },
    { id:'furn_plant',     name:'绿植', emoji:'🪴', color:'#52b788', w:1, h:1, price:500,   lux:2,  cat:'plant' },
    { id:'furn_lamp',      name:'台灯', emoji:'💡', color:'#ffd23f', w:1, h:1, price:800,   lux:3,  cat:'lamp' },
    { id:'furn_table',     name:'桌子', emoji:'🪵', color:'#b08968', w:2, h:2, price:1500,  lux:5,  cat:'seat' },
    { id:'furn_painting',  name:'挂画', emoji:'🖼️', color:'#9b5de5', w:2, h:1, price:2500,  lux:8,  wall:true, cat:'wall' },
    { id:'furn_catbed',    name:'猫窝', emoji:'🐱', color:'#f4a261', w:1, h:1, price:3000,  lux:6,  cat:'plant' },
    { id:'furn_sofa',      name:'沙发', emoji:'🛋️', color:'#ef476f', w:3, h:1, price:6000,  lux:12, cat:'seat' },
    { id:'furn_bookshelf', name:'书架', emoji:'📚', color:'#8d6e63', w:2, h:1, price:8000,  lux:10, cat:'cabinet', sub:'bookshelf' },
    { id:'furn_bed',       name:'床',   emoji:'🛏️', color:'#90caf9', w:2, h:3, price:12000, lux:15, cat:'bed' },
    { id:'furn_wardrobe',  name:'衣柜', emoji:'🚪', color:'#a1887f', w:2, h:1, price:15000, lux:14, cat:'cabinet', sub:'wardrobe' },
    { id:'furn_fridge',    name:'冰箱', emoji:'🧊', color:'#bde0fe', w:1, h:1, price:20000, lux:18, cat:'appliance' },
    { id:'furn_tv',        name:'电视', emoji:'📺', color:'#264653', w:2, h:1, price:30000, lux:25, cat:'appliance' },
    { id:'furn_rocket_rocket_model',   name:'分段火箭模型', emoji:'🚀', color:'#6c757d', w:1, h:1, price:6500,   lux:4,  cat:'plant' },
    { id:'furn_rocket_meteor_stand',   name:'悬架陨石展座', emoji:'☄️', color:'#adb5bd', w:1, h:1, price:32000,  lux:7,  cat:'plant' },
    { id:'furn_rocket_biosphere_dome', name:'生态圆顶花园', emoji:'🪴', color:'#52b788', w:2, h:2, price:125000, lux:16, cat:'plant' },
    { id:'furn_rocket_capsule_bunk',   name:'舱式单层床',   emoji:'🛏️', color:'#8d99ae', w:2, h:1, price:22000,  lux:7,  cat:'bed' },  // 索引提案 2×3；正面扁图实测改 2×1（同沙发 3×1），免得上面 2 排空着挡位
    { id:'furn_s77_cloud_canopy',      name:'云朵纱帐床',   emoji:'🛏️', color:'#e9ecef', w:3, h:3, price:18000,  lux:7,  cat:'bed' },
    // 11v：packs 01–10 的 43 件（跳过已接入的云朵纱帐床）；名称/价格/豪华度/占地按 200 件公共资产索引提案
    { id:'furn_s77_quilt_daybed', name:'拼布午睡榻', emoji:'🛏️', color:'#ce9473', w:3, h:1, price:1800, lux:2, cat:'bed' },
    { id:'furn_s77_drawer_bed', name:'抽屉收纳床', emoji:'🛏️', color:'#d1a083', w:2, h:2, price:6500, lux:4, cat:'bed' },  // 11w 熊大拍板 2×3→2×2，脚底锚定；FURN_UP 359/400
    { id:'furn_s77_book_nook_bed', name:'书窝壁龛床', emoji:'🛏️', color:'#c78a5f', w:3, h:3, price:36000, lux:7, cat:'bed' },
    { id:'furn_s77_peg_cubby', name:'挂钩小格柜', emoji:'🗄️', color:'#d5a578', w:1, h:1, price:850, lux:1, cat:'cabinet' },
    { id:'furn_s77_ladder_shelf', name:'梯形置物架', emoji:'🪜', color:'#da9e69', w:2, h:1, price:1600, lux:2, cat:'cabinet' },
    { id:'furn_s77_basket_cabinet', name:'编篮收纳柜', emoji:'🧺', color:'#d4a47a', w:2, h:1, price:2200, lux:2, cat:'cabinet' },
    { id:'furn_s77_round_corner_chest', name:'圆角五斗柜', emoji:'🗄️', color:'#e4a182', w:2, h:1, price:5200, lux:4, cat:'cabinet' },
    { id:'furn_s77_sewing_cabinet', name:'针线折门柜', emoji:'🗄️', color:'#da8f71', w:2, h:1, price:8500, lux:4, cat:'cabinet' },
    { id:'furn_s77_pantry_hutch', name:'玻璃餐具柜', emoji:'🍽️', color:'#d8b089', w:2, h:1, price:15000, lux:4, cat:'cabinet' },
    { id:'furn_s77_attic_trunk', name:'阁楼旅行箱柜', emoji:'🧳', color:'#c88564', w:2, h:1, price:28000, lux:7, cat:'cabinet' },
    { id:'furn_s77_reading_stool', name:'矮圆阅读凳', emoji:'🪑', color:'#e8ae79', w:1, h:1, price:400, lux:1, cat:'seat' },
    { id:'furn_s77_rocking_chair', name:'摇摇扶手椅', emoji:'🪑', color:'#e48e67', w:1, h:1, price:3500, lux:2, cat:'seat' },  // 11w 熊大拍板 1×2→1×1，脚底锚定；FURN_UP 249/240
    { id:'furn_s77_heart_bench', name:'爱心靠背长凳', emoji:'💗', color:'#e5926f', w:3, h:1, price:2800, lux:2, cat:'seat' },
    { id:'furn_s77_folding_tray', name:'折脚早餐桌', emoji:'🪵', color:'#edb779', w:1, h:1, price:650, lux:1, cat:'seat' },
    { id:'furn_s77_quilt_ottoman', name:'拼布储物脚凳', emoji:'🛋️', color:'#de9e86', w:1, h:1, price:1200, lux:2, cat:'seat' },
    { id:'furn_s77_window_bench', name:'飘窗阅读长榻', emoji:'🛋️', color:'#d58d6b', w:3, h:1, price:9000, lux:4, cat:'seat' },
    { id:'furn_s77_sewing_desk', name:'手摇缝纫桌', emoji:'🧵', color:'#b97c4f', w:2, h:1, price:17000, lux:7, cat:'seat' },
    { id:'furn_s77_curved_sectional', name:'花瓣转角沙发', emoji:'🛋️', color:'#dd937e', w:3, h:2, price:65000, lux:11, cat:'seat' },  // 索引提案 3×3；宽扁正面图（600×335）实测改 3×2，免得最上一排空着挡位；11w 保持 3×2 不再缩到 3×1
    { id:'furn_s77_lantern_stand', name:'提篮纸灯架', emoji:'🏮', color:'#e2b481', w:1, h:1, price:550, lux:1, cat:'lamp' },
    { id:'furn_s77_mushroom_lamp', name:'蘑菇陶灯', emoji:'🍄', color:'#e7ab8e', w:1, h:1, price:1600, lux:2, cat:'lamp' },
    { id:'furn_s77_petal_uplight', name:'花瓣上照灯', emoji:'🌷', color:'#e0b285', w:1, h:1, price:4800, lux:2, cat:'lamp' },
    { id:'furn_s77_quilt_shade_lamp', name:'拼布弧臂灯', emoji:'💡', color:'#d89774', w:1, h:1, price:10000, lux:4, cat:'lamp' },  // 11w 熊大拍板 1×2→1×1，脚底锚定；FURN_UP 301/240（底座偏心不强制居中）
    { id:'furn_s77_hearth_light', name:'微光壁炉灯', emoji:'🔥', color:'#c18d66', w:2, h:1, price:28000, lux:7, cat:'lamp' },
    { id:'furn_s77_box_fan', name:'木框循环扇', emoji:'🌀', color:'#deb18c', w:1, h:1, price:900, lux:1, cat:'appliance' },
    { id:'furn_s77_toaster_cart', name:'吐司机小推车', emoji:'🍞', color:'#dbaf8c', w:1, h:1, price:2400, lux:2, cat:'appliance' },
    { id:'furn_s77_record_console', name:'黑胶唱机柜', emoji:'🎵', color:'#be8660', w:2, h:1, price:7800, lux:4, cat:'appliance' },
    { id:'furn_s77_sewing_machine_stand', name:'电动缝纫工作台', emoji:'🧵', color:'#d3a07a', w:2, h:1, price:12000, lux:4, cat:'appliance' },
    { id:'furn_s77_stove_oven', name:'珐琅烤箱炉', emoji:'🍳', color:'#bf977f', w:2, h:1, price:26000, lux:7, cat:'appliance' },
    { id:'furn_s77_laundry_pair', name:'洗烘叠叠机', emoji:'🫧', color:'#c9a28b', w:1, h:1, price:55000, lux:11, cat:'appliance' },
    { id:'furn_s77_braided_runner', name:'麻花长廊毯', emoji:'🟫', color:'#c78a72', w:1, h:3, price:750, lux:1, layer:'rug', cat:'rug' },
    { id:'furn_s77_patchwork_flower_rug', name:'拼布花园毯', emoji:'🌼', color:'#db9382', w:3, h:3, price:3800, lux:2, layer:'rug', cat:'rug' },
    { id:'furn_s77_quilt_island_rug', name:'厚绒云岛毯', emoji:'☁️', color:'#e7c5b4', w:3, h:2, price:15000, lux:4, layer:'rug', cat:'rug' },
    { id:'furn_s77_embroidery_hoops', name:'刺绣圆绷组', emoji:'🪡', color:'#c89b7b', w:2, h:1, price:500, lux:1, wall:true, cat:'wall' },
    { id:'furn_s77_wood_cuckoo', name:'木屋布谷钟', emoji:'🕰️', color:'#bb8668', w:1, h:2, price:2500, lux:2, wall:true, cat:'wall' },
    { id:'furn_s77_quilt_wall', name:'拼布故事挂毯', emoji:'🧶', color:'#d2a688', w:2, h:2, price:4800, lux:2, wall:true, cat:'wall' },
    { id:'furn_s77_pressed_flower_frame', name:'压花玻璃框', emoji:'🌸', color:'#c49972', w:1, h:2, price:1300, lux:2, wall:true, cat:'wall' },
    { id:'furn_s77_family_silhouette', name:'纸雕合影灯框', emoji:'🖼️', color:'#cca071', w:2, h:1, price:12000, lux:4, wall:true, cat:'wall' },
    { id:'furn_s77_watering_stand', name:'小水壶花架', emoji:'🪴', color:'#c1875f', w:1, h:1, price:1100, lux:2, cat:'plant' },
    { id:'furn_s77_knitting_basket', name:'毛线编织篮', emoji:'🧶', color:'#c27653', w:1, h:1, price:450, lux:1, cat:'plant' },
    { id:'furn_s77_olive_planter', name:'橄榄木桶盆', emoji:'🫒', color:'#987f61', w:1, h:1, price:6200, lux:4, cat:'plant' },
    { id:'furn_s77_mini_greenhouse', name:'玻璃小温室', emoji:'🌱', color:'#bba16a', w:2, h:1, price:24000, lux:7, cat:'plant' },
    { id:'furn_pearl_tea_daybed', name:'茶歇藤编榻', emoji:'🛏️', color:'#c9ab88', w:3, h:1, price:2400, lux:2, cat:'bed' },
    { id:'furn_pearl_pearl_bed', name:'贝壳软包床', emoji:'🛏️', color:'#a8a78f', w:2, h:2, price:8000, lux:4, cat:'bed' },  // 11w 熊大拍板 2×3→2×2，脚底锚定；FURN_UP 382/400
    // 11w：packs 13/16/19/27/30/33/36/39 的 34 件；名称/价格/豪华度/占地按 200 件公共资产索引提案（旧版，熊大确认参数与新版一致）
    { id:'furn_pearl_cup_carousel', name:'旋转茶杯塔', emoji:'☕', color:'#ac9975', w:1, h:1, price:6800, lux:4, cat:'cabinet' },
    { id:'furn_pearl_bakery_display', name:'弧玻璃甜点柜', emoji:'🍰', color:'#a3845e', w:2, h:1, price:18000, lux:7, cat:'cabinet' },
    { id:'furn_pearl_sideboard_island', name:'茶台中岛柜', emoji:'🍵', color:'#a49873', w:3, h:2, price:42000, lux:11, cat:'cabinet' },
    { id:'furn_pearl_archive_apothecary', name:'百格茶香斗柜', emoji:'🗄️', color:'#8e764e', w:3, h:1, price:90000, lux:11, cat:'cabinet' },
    { id:'furn_pearl_conversation_pit', name:'环形茶会沙发', emoji:'🛋️', color:'#a5a182', w:3, h:2, price:75000, lux:11, cat:'seat' },  // 索引提案 3×3；宽扁正面图（600×335）实测改 3×2，同花瓣转角沙发
    { id:'furn_pearl_tea_gongfu_desk', name:'石槽功夫茶案', emoji:'🍵', color:'#b5a187', w:3, h:1, price:145000, lux:16, cat:'seat' },
    { id:'furn_pearl_paper_pear_lamp', name:'梨形纸罩灯', emoji:'🍐', color:'#e6c998', w:1, h:1, price:700, lux:1, cat:'lamp' },
    { id:'furn_pearl_tea_glass_lamp', name:'茶玻璃立柱灯', emoji:'💡', color:'#c59c65', w:1, h:1, price:2600, lux:2, cat:'lamp' },
    { id:'furn_pearl_boba_globe_lamp', name:'珍珠串球灯', emoji:'🧋', color:'#d3c996', w:1, h:1, price:5800, lux:4, cat:'lamp' },
    { id:'furn_pearl_tea_mat', name:'竹编茶席地垫', emoji:'🎋', color:'#c5a67b', w:2, h:2, price:450, lux:1, layer:'rug', cat:'rug' },
    { id:'furn_pearl_scallop_rug', name:'扇贝绒边毯', emoji:'🐚', color:'#afb292', w:2, h:2, price:1600, lux:2, layer:'rug', cat:'rug' },
    { id:'furn_pearl_tea_river_runner', name:'曲水茶径长毯', emoji:'🌊', color:'#bfbb9e', w:1, h:3, price:5500, lux:4, layer:'rug', cat:'rug' },
    { id:'furn_otaku_floor_chair', name:'折背地板椅', emoji:'🪑', color:'#656d82', w:1, h:1, price:1300, lux:2, cat:'seat' },
    { id:'furn_otaku_modular_couch', name:'积木拼接沙发', emoji:'🛋️', color:'#7a7e8d', w:3, h:2, price:18000, lux:7, cat:'seat' },
    { id:'furn_otaku_arcade_bench', name:'街机双座长凳', emoji:'🕹️', color:'#a8abb0', w:2, h:1, price:3200, lux:2, cat:'seat' },
    { id:'furn_otaku_streaming_desk', name:'双翼直播桌', emoji:'🎙️', color:'#8d949f', w:3, h:2, price:36000, lux:7, cat:'seat' },
    { id:'furn_otaku_panel_rug', name:'四格漫画地毯', emoji:'💬', color:'#8e97a2', w:2, h:2, price:650, lux:1, layer:'rug', cat:'rug' },
    { id:'furn_otaku_controller_rug', name:'手柄轮廓绒毯', emoji:'🎮', color:'#60677b', w:3, h:2, price:2800, lux:2, layer:'rug', cat:'rug' },
    { id:'furn_otaku_speed_runner', name:'速度线闪电毯', emoji:'⚡', color:'#717c8a', w:1, h:3, price:6800, lux:4, layer:'rug', cat:'rug' },
    { id:'furn_otaku_pixel_succulent', name:'方块多肉群盆', emoji:'🌵', color:'#727e7d', w:1, h:1, price:1800, lux:2, cat:'plant' },
    { id:'furn_otaku_manga_book_stack', name:'漫画山展示墩', emoji:'📚', color:'#8c8891', w:1, h:1, price:500, lux:1, cat:'plant' },
    { id:'furn_otaku_robot_planter', name:'行走机器人花盆', emoji:'🤖', color:'#5b6f62', w:1, h:1, price:12500, lux:4, cat:'plant' },
    { id:'furn_otaku_aquatic_pixel_tank', name:'像素水草缸', emoji:'🐠', color:'#5d857e', w:2, h:1, price:58000, lux:11, cat:'plant' },
    { id:'furn_rocket_field_cot', name:'折叠行军床', emoji:'🛏️', color:'#485670', w:2, h:3, price:1500, lux:2, cat:'bed' },
    { id:'furn_rocket_cargo_crate', name:'太空货箱柜', emoji:'📦', color:'#524d4e', w:1, h:1, price:1900, lux:2, cat:'cabinet' },
    { id:'furn_rocket_mesh_rack', name:'钢网通透货架', emoji:'🗄️', color:'#3c4144', w:2, h:1, price:2800, lux:2, cat:'cabinet' },
    { id:'furn_rocket_airlock_wardrobe', name:'气闸圆门衣柜', emoji:'🚪', color:'#474649', w:2, h:1, price:26000, lux:7, cat:'cabinet' },
    { id:'furn_rocket_rail_bench', name:'轨枕钢架长凳', emoji:'🪑', color:'#523b2f', w:3, h:1, price:6500, lux:4, cat:'seat' },
    { id:'furn_rocket_mission_table', name:'环形任务会议桌', emoji:'🛰️', color:'#555051', w:3, h:3, price:82000, lux:11, cat:'seat' },
    { id:'furn_rocket_zero_g_lounger', name:'弓架悬挂躺椅', emoji:'🪐', color:'#595453', w:2, h:3, price:190000, lux:16, cat:'seat' },
    { id:'furn_rocket_cage_lamp', name:'防护网工作灯', emoji:'💡', color:'#665a4d', w:1, h:1, price:800, lux:1, cat:'lamp' },
    { id:'furn_rocket_tripod_searchlight', name:'三脚探照灯', emoji:'🔦', color:'#6d6055', w:1, h:1, price:3400, lux:2, cat:'lamp' },
    { id:'furn_rocket_pipe_valve_lamp', name:'阀门水管灯', emoji:'🔧', color:'#624939', w:1, h:1, price:6800, lux:4, cat:'lamp' },
    { id:'furn_rocket_rocket_nozzle_light', name:'喷口氛围灯', emoji:'🚀', color:'#6c635c', w:1, h:1, price:14000, lux:4, cat:'lamp' },
    { id:'furn_pearl_tea_loft', name:'茶点高架床', emoji:'🛏️', color:'#c9ab88', w:2, h:1, price:24000, lux:7, cat:'bed' },  // 11z 熊大占地审查 2×3→2×1，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_pearl_canopy_lounge', name:'凉亭帘幕床', emoji:'🛏️', color:'#a8a78f', w:3, h:3, price:52000, lux:11, cat:'bed' },
    { id:'furn_pearl_capsule_daybed', name:'珍珠泡泡躺舱', emoji:'🛏️', color:'#ac9975', w:2, h:2, price:110000, lux:16, cat:'bed' },  // 11z 熊大占地审查 2×3→2×2，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_pearl_tea_cat_hammock', name:'茶篮猫吊床', emoji:'🛏️', color:'#a3845e', w:1, h:1, price:1600, lux:2, cat:'bed' },
    { id:'furn_pearl_tea_cubby', name:'茶罐九宫格柜', emoji:'🗄️', color:'#a49873', w:2, h:1, price:2400, lux:2, cat:'cabinet' },
    { id:'furn_pearl_glass_wardrobe', name:'长虹玻璃衣柜', emoji:'🗄️', color:'#bfbb9e', w:2, h:1, price:11000, lux:4, cat:'cabinet' },
    { id:'furn_pearl_rattan_bookcase', name:'藤网拱顶书柜', emoji:'🗄️', color:'#afb292', w:2, h:1, price:5600, lux:4, cat:'cabinet' },
    { id:'furn_pearl_tea_trolley_shelf', name:'双层茶点推架', emoji:'🗄️', color:'#c5a67b', w:1, h:1, price:1500, lux:2, cat:'cabinet' },
    { id:'furn_pearl_tea_stool', name:'茶席竹矮凳', emoji:'🪑', color:'#b8a88a', w:1, h:1, price:500, lux:1, cat:'seat' },
    { id:'furn_pearl_cafe_chair', name:'弯木咖啡椅', emoji:'🪑', color:'#9a9078', w:1, h:1, price:1300, lux:2, cat:'seat' },
    { id:'furn_pearl_round_tea_table', name:'单柱圆茶桌', emoji:'🪵', color:'#c9ab88', w:2, h:2, price:3200, lux:2, cat:'seat' },
    { id:'furn_pearl_scallop_sofa', name:'扇贝三人沙发', emoji:'🪑', color:'#a8a78f', w:3, h:1, price:14000, lux:4, cat:'seat' },
    { id:'furn_pearl_tea_bar', name:'弧形调茶吧台', emoji:'🪵', color:'#ac9975', w:3, h:2, price:28000, lux:7, cat:'seat' },
    { id:'furn_pearl_bar_stool', name:'旋脚吧凳', emoji:'🪑', color:'#a3845e', w:1, h:1, price:2700, lux:2, cat:'seat' },
    { id:'furn_pearl_picnic_table', name:'折叠野餐桌', emoji:'🪵', color:'#a49873', w:2, h:1, price:1700, lux:2, cat:'seat' },  // 11z 熊大占地审查 2×2→2×1，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_pearl_egg_swing', name:'藤壳秋千椅', emoji:'🪑', color:'#bfbb9e', w:2, h:2, price:22000, lux:7, cat:'seat' },
    { id:'furn_pearl_fan_shade_lamp', name:'竹扇伞面灯', emoji:'💡', color:'#afb292', w:1, h:1, price:8200, lux:4, cat:'lamp' },
    { id:'furn_pearl_tea_arc_lamp', name:'茶勺弧光灯', emoji:'💡', color:'#c5a67b', w:1, h:2, price:18000, lux:7, cat:'lamp' },
    { id:'furn_pearl_fountain_light', name:'水纹玻璃灯泉', emoji:'💡', color:'#b8a88a', w:2, h:1, price:48000, lux:11, cat:'lamp' },
    { id:'furn_pearl_tea_kettle_cart', name:'电热茶炉车', emoji:'🔌', color:'#9a9078', w:1, h:1, price:1500, lux:2, cat:'appliance' },
    { id:'furn_pearl_juice_press', name:'柑橘榨汁柜', emoji:'🗄️', color:'#c9ab88', w:1, h:1, price:4200, lux:2, cat:'appliance' },
    { id:'furn_pearl_milk_frother_bar', name:'奶泡双杯机台', emoji:'🪵', color:'#a8a78f', w:2, h:1, price:9500, lux:4, cat:'appliance' },
    { id:'furn_pearl_tea_brewer', name:'多壶自动泡茶台', emoji:'🪵', color:'#ac9975', w:2, h:1, price:32000, lux:7, cat:'appliance' },
    { id:'furn_pearl_dessert_chiller', name:'旋盘甜点冰柜', emoji:'🗄️', color:'#a3845e', w:2, h:1, price:78000, lux:11, cat:'appliance' },
    { id:'furn_pearl_marble_pearl_rug', name:'珍珠镶嵌圆毯', emoji:'🟥', color:'#a49873', w:3, h:3, price:21000, lux:7, layer:'rug', cat:'rug' },
    { id:'furn_pearl_tea_menu_board', name:'手写茶单牌', emoji:'🔌', color:'#bfbb9e', w:1, h:2, price:350, lux:1, wall:true, cat:'wall' },
    { id:'furn_pearl_cup_wall_rack', name:'茶杯挂壁架', emoji:'🗄️', color:'#afb292', w:2, h:1, price:1800, lux:2, wall:true, cat:'wall' },
    { id:'furn_pearl_sunburst_mirror', name:'藤编放射镜', emoji:'🖼️', color:'#c5a67b', w:2, h:2, price:4800, lux:2, wall:true, cat:'wall' },
    { id:'furn_pearl_tea_leaf_relief', name:'茶叶陶片浮雕', emoji:'🖼️', color:'#b8a88a', w:2, h:1, price:9500, lux:4, wall:true, cat:'wall' },
    { id:'furn_pearl_moon_window_art', name:'月窗水纹灯画', emoji:'💡', color:'#9a9078', w:2, h:2, price:35000, lux:7, wall:true, cat:'wall' },
    { id:'furn_pearl_herb_crate', name:'香草木箱园', emoji:'🗄️', color:'#c9ab88', w:1, h:1, price:650, lux:1, cat:'plant' },
    { id:'furn_pearl_tea_bonsai', name:'茶树浅钵盆景', emoji:'🪴', color:'#a8a78f', w:1, h:1, price:2600, lux:2, cat:'plant' },
    { id:'furn_pearl_ceramic_cup_stack', name:'叠杯陶瓷摆件', emoji:'🪴', color:'#ac9975', w:1, h:1, price:950, lux:1, cat:'plant' },
    { id:'furn_pearl_terrarium_orb', name:'玻璃球微花园', emoji:'🪴', color:'#a3845e', w:1, h:1, price:8800, lux:4, cat:'plant' },
    { id:'furn_pearl_tea_tree_screen', name:'茶树连盆屏风', emoji:'🪴', color:'#a49873', w:3, h:1, price:28000, lux:7, cat:'plant' },
    { id:'furn_otaku_floor_futon', name:'漫画地铺', emoji:'🖼️', color:'#656d82', w:2, h:2, price:1200, lux:2, cat:'bed' },  // 11z 熊大占地审查 2×3→2×2，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_otaku_sofa_sleeper', name:'翻折懒人床', emoji:'🛏️', color:'#7a7e8d', w:2, h:3, price:5200, lux:4, cat:'bed' },
    { id:'furn_otaku_bunk_manga', name:'上下铺漫画床', emoji:'🛏️', color:'#a8abb0', w:2, h:1, price:15000, lux:4, cat:'bed' },  // 11z 熊大占地审查 2×3→2×1，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_otaku_gaming_pod', name:'游戏休息舱', emoji:'🛏️', color:'#8d949f', w:2, h:3, price:42000, lux:11, cat:'bed' },
    { id:'furn_otaku_projector_bed', name:'投影帷幕床', emoji:'🛏️', color:'#8e97a2', w:3, h:3, price:85000, lux:11, cat:'bed' },
    { id:'furn_otaku_cat_keyboard_cave', name:'键帽猫山洞', emoji:'🛏️', color:'#60677b', w:1, h:1, price:3600, lux:2, cat:'bed' },
    { id:'furn_otaku_locker_wardrobe', name:'储物柜式衣柜', emoji:'🗄️', color:'#717c8a', w:2, h:1, price:4300, lux:2, cat:'cabinet' },
    { id:'furn_otaku_disc_tower', name:'光盘旋转塔', emoji:'💡', color:'#727e7d', w:1, h:1, price:1700, lux:2, cat:'cabinet' },
    { id:'furn_otaku_figure_vitrine', name:'阶梯手办柜', emoji:'🗄️', color:'#8c8891', w:2, h:1, price:13000, lux:4, cat:'cabinet' },
    { id:'furn_otaku_comic_wheel_cart', name:'漫画箱轮车', emoji:'🗄️', color:'#5b6f62', w:1, h:1, price:900, lux:1, cat:'cabinet' },
    { id:'furn_otaku_controller_drawers', name:'手柄抽屉柜', emoji:'🗄️', color:'#656d82', w:2, h:1, price:6800, lux:4, cat:'cabinet' },
    { id:'furn_otaku_modular_pixel_shelf', name:'像素阶梯书架', emoji:'🗄️', color:'#7a7e8d', w:3, h:1, price:25000, lux:7, cat:'cabinet' },
    { id:'furn_otaku_server_display_rack', name:'透侧收藏机柜', emoji:'🗄️', color:'#a8abb0', w:2, h:1, price:68000, lux:11, cat:'cabinet' },
    { id:'furn_otaku_beanbag', name:'团子懒人袋', emoji:'🪑', color:'#8d949f', w:1, h:1, price:850, lux:1, cat:'seat' },
    { id:'furn_otaku_kotatsu', name:'被炉矮桌', emoji:'🪵', color:'#8e97a2', w:2, h:1, price:5800, lux:4, cat:'seat' },  // 11z 熊大占地审查 2×2→2×1，仍为实体家具层，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_otaku_gaming_chair', name:'高背电竞椅', emoji:'🪑', color:'#60677b', w:1, h:2, price:8800, lux:4, cat:'seat' },
    { id:'furn_otaku_manga_desk', name:'斜面画稿桌', emoji:'🪵', color:'#717c8a', w:2, h:1, price:4600, lux:2, cat:'seat' },
    { id:'furn_otaku_snack_sidecar', name:'零食侧边桌', emoji:'🪵', color:'#727e7d', w:1, h:1, price:550, lux:1, cat:'seat' },
    { id:'furn_otaku_cocoon_lounger', name:'环抱阅读躺椅', emoji:'🪑', color:'#8c8891', w:2, h:2, price:98000, lux:11, cat:'seat' },
    { id:'furn_otaku_panel_lamp', name:'分镜格落地灯', emoji:'💡', color:'#5b6f62', w:1, h:1, price:950, lux:1, cat:'lamp' },
    { id:'furn_otaku_gooseneck_stand', name:'长颈阅读灯', emoji:'💡', color:'#656d82', w:1, h:1, price:1400, lux:2, cat:'lamp' },
    { id:'furn_otaku_pixel_cube_light', name:'像素积木灯柱', emoji:'💡', color:'#7a7e8d', w:1, h:1, price:4200, lux:2, cat:'lamp' },
    { id:'furn_otaku_arcade_marquee_lamp', name:'游戏厅招牌灯架', emoji:'🗄️', color:'#a8abb0', w:2, h:1, price:12000, lux:4, cat:'lamp' },
    { id:'furn_otaku_orbital_neon_floor', name:'漫画速度线灯', emoji:'💡', color:'#8d949f', w:1, h:1, price:22000, lux:7, cat:'lamp' },
    { id:'furn_otaku_sleep_timer_totem', name:'睡眠倒计时灯塔', emoji:'💡', color:'#8e97a2', w:1, h:1, price:48000, lux:11, cat:'lamp' },
    { id:'furn_otaku_mini_fridge', name:'床边小冰柜', emoji:'🛏️', color:'#60677b', w:1, h:1, price:2800, lux:2, cat:'appliance' },
    { id:'furn_otaku_console_station', name:'双手柄游戏台', emoji:'🪵', color:'#717c8a', w:2, h:1, price:15000, lux:4, cat:'appliance' },
    { id:'furn_otaku_arcade_cabinet', name:'原创街机柜', emoji:'🗄️', color:'#727e7d', w:1, h:1, price:38000, lux:7, cat:'appliance' },
    { id:'furn_otaku_projector_cart', name:'短焦投影推车', emoji:'🔌', color:'#8c8891', w:1, h:1, price:21000, lux:7, cat:'appliance' },
    { id:'furn_otaku_triple_monitor_station', name:'三屏环抱主机台', emoji:'🪵', color:'#5b6f62', w:3, h:1, price:125000, lux:16, cat:'appliance' },
    { id:'furn_otaku_pixel_map_rug', name:'像素小镇拼毯', emoji:'🟥', color:'#656d82', w:3, h:3, price:24000, lux:7, layer:'rug', cat:'rug' },
    { id:'furn_otaku_speech_bubble_board', name:'对白气泡留言板', emoji:'🖼️', color:'#7a7e8d', w:2, h:1, price:550, lux:1, wall:true, cat:'wall' },
    { id:'furn_otaku_manga_page_triptych', name:'原创分镜三联画', emoji:'🖼️', color:'#a8abb0', w:3, h:1, price:4300, lux:2, wall:true, cat:'wall' },
    { id:'furn_otaku_controller_wall_mount', name:'手柄收藏壁架', emoji:'🗄️', color:'#8d949f', w:2, h:1, price:8500, lux:4, wall:true, cat:'wall' },
    { id:'furn_otaku_pixel_city_lightbox', name:'像素夜城灯箱', emoji:'🗄️', color:'#8e97a2', w:3, h:2, price:46000, lux:11, wall:true, cat:'wall' },
    { id:'furn_otaku_cactus_cartridge', name:'卡带仙人掌盆', emoji:'🪴', color:'#60677b', w:1, h:1, price:700, lux:1, cat:'plant' },
    { id:'furn_rocket_steel_platform_bed', name:'钢架平台床', emoji:'🛏️', color:'#485670', w:2, h:2, price:6800, lux:4, cat:'bed' },  // 11z 熊大占地审查 2×3→2×2，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_rocket_cryo_rest_pod', name:'透明罩休息舱', emoji:'🛏️', color:'#524d4e', w:2, h:2, price:65000, lux:11, cat:'bed' },  // 11z 熊大占地审查 2×3→2×2，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_rocket_observatory_bed', name:'观星圆顶床', emoji:'🛏️', color:'#3c4144', w:3, h:3, price:160000, lux:16, cat:'bed' },
    { id:'furn_rocket_landing_cat_pod', name:'着陆舱猫窝', emoji:'🛏️', color:'#474649', w:1, h:1, price:4800, lux:2, cat:'bed' },
    { id:'furn_rocket_steel_locker', name:'铆钉更衣柜', emoji:'🗄️', color:'#523b2f', w:2, h:1, price:3600, lux:2, cat:'cabinet' },
    { id:'furn_rocket_pipe_bookcase', name:'水管书架', emoji:'🗄️', color:'#555051', w:2, h:1, price:4800, lux:2, cat:'cabinet' },
    { id:'furn_rocket_tool_chest', name:'滚轮工具斗柜', emoji:'🗄️', color:'#595453', w:2, h:1, price:7600, lux:4, cat:'cabinet' },
    { id:'furn_rocket_specimen_drawer', name:'矿石标本斗柜', emoji:'🗄️', color:'#665a4d', w:2, h:1, price:52000, lux:11, cat:'cabinet' },
    { id:'furn_rocket_orbital_archive', name:'轨道旋转档案架', emoji:'🗄️', color:'#6d6055', w:3, h:2, price:145000, lux:16, cat:'cabinet' },
    { id:'furn_rocket_bolt_stool', name:'螺栓三脚凳', emoji:'🪑', color:'#624939', w:1, h:1, price:600, lux:1, cat:'seat' },
    { id:'furn_rocket_workbench', name:'铆钉检修台', emoji:'🪵', color:'#485670', w:2, h:1, price:3500, lux:2, cat:'seat' },
    { id:'furn_rocket_drafting_chair', name:'机械制图椅', emoji:'🪑', color:'#524d4e', w:1, h:1, price:4800, lux:2, cat:'seat' },
    { id:'furn_rocket_pipe_sofa', name:'钢管皮垫沙发', emoji:'🪑', color:'#3c4144', w:3, h:1, price:12000, lux:4, cat:'seat' },
    { id:'furn_rocket_oil_drum_table', name:'油桶圆桌', emoji:'🪵', color:'#474649', w:2, h:2, price:1800, lux:2, cat:'seat' },
    { id:'furn_rocket_captain_chair', name:'舰桥指挥椅', emoji:'🪑', color:'#523b2f', w:1, h:1, price:36000, lux:7, cat:'seat' },  // 11z 熊大占地审查 1×2→1×1，底边锚定（fpMig11z）；整图/FURN_UP/价格/豪华度不变
    { id:'furn_rocket_cantilever_desk', name:'悬臂作图桌', emoji:'🪵', color:'#555051', w:2, h:1, price:18000, lux:7, cat:'seat' },
    { id:'furn_rocket_orbital_ring_lamp', name:'三环轨道灯', emoji:'💡', color:'#595453', w:1, h:1, price:32000, lux:7, cat:'lamp' },
    { id:'furn_rocket_solar_array_lamp', name:'太阳帆翼灯', emoji:'💡', color:'#665a4d', w:2, h:1, price:88000, lux:11, cat:'lamp' },
    { id:'furn_rocket_industrial_fan', name:'网笼工业风扇', emoji:'🔌', color:'#6d6055', w:1, h:1, price:1300, lux:2, cat:'appliance' },
    { id:'furn_rocket_vacuum_dock', name:'扫地机器人基站', emoji:'🔌', color:'#624939', w:1, h:1, price:7200, lux:4, cat:'appliance' },
    { id:'furn_rocket_coffee_pressure_unit', name:'压力咖啡机台', emoji:'🪵', color:'#485670', w:2, h:1, price:19000, lux:7, cat:'appliance' },
    { id:'furn_rocket_air_purifier', name:'滤芯净化塔', emoji:'🔌', color:'#524d4e', w:1, h:1, price:11000, lux:4, cat:'appliance' },
    { id:'furn_rocket_hydroponic_unit', name:'水培循环机', emoji:'🔌', color:'#3c4144', w:2, h:1, price:58000, lux:11, cat:'appliance' },
    { id:'furn_rocket_planetarium_console', name:'家用星象投影台', emoji:'🪵', color:'#474649', w:2, h:2, price:175000, lux:16, cat:'appliance' },
    { id:'furn_rocket_workshop_mat', name:'防滑检修地垫', emoji:'🟥', color:'#523b2f', w:2, h:2, price:550, lux:1, layer:'rug', cat:'rug' },
    { id:'furn_rocket_orbit_rug', name:'轨道线圆毯', emoji:'🟥', color:'#555051', w:2, h:2, price:2400, lux:2, layer:'rug', cat:'rug' },
    { id:'furn_rocket_runway_runner', name:'着陆跑道长毯', emoji:'🟥', color:'#595453', w:1, h:3, price:7800, lux:4, layer:'rug', cat:'rug' },
    { id:'furn_rocket_lunar_relief_rug', name:'月坑浮雕绒毯', emoji:'🟥', color:'#665a4d', w:3, h:3, price:38000, lux:7, layer:'rug', cat:'rug' },
    { id:'furn_rocket_blueprint_frame', name:'原创火箭蓝图框', emoji:'🖼️', color:'#6d6055', w:2, h:1, price:900, lux:1, wall:true, cat:'wall' },
    { id:'furn_rocket_gear_clock', name:'齿轮壁钟', emoji:'🖼️', color:'#624939', w:2, h:2, price:3800, lux:2, wall:true, cat:'wall' },
    { id:'furn_rocket_mission_patch_board', name:'任务徽章壁板', emoji:'🖼️', color:'#485670', w:2, h:1, price:8800, lux:4, wall:true, cat:'wall' },
    { id:'furn_rocket_moon_sample_relief', name:'月岩切面浮雕', emoji:'🖼️', color:'#524d4e', w:2, h:2, price:28000, lux:7, wall:true, cat:'wall' },
    { id:'furn_rocket_orbital_map_panel', name:'轨道星图灯板', emoji:'💡', color:'#3c4144', w:3, h:2, price:98000, lux:11, wall:true, cat:'wall' },
    { id:'furn_rocket_concrete_succulent', name:'水泥多肉钵', emoji:'🪴', color:'#474649', w:1, h:1, price:800, lux:1, cat:'plant' },
    { id:'furn_rocket_pipe_vase', name:'铜管苔藓瓶', emoji:'🪴', color:'#523b2f', w:1, h:1, price:2400, lux:2, cat:'plant' },
  ];
  const FURN_BY_ID = {}; FURNITURE.forEach(f => FURN_BY_ID[f.id] = f);
  const HOME_MAX = HOME_TIERS.length;
  function newHome() { return { lv:1, placed:[], next:1 }; }
  function homeTier(lv) { return HOME_TIERS[Math.max(1, Math.min(HOME_MAX, lv | 0)) - 1]; }
  function homeOf(st, id) {
    if (!st.homes) st.homes = {};
    if (!st.homes[id]) st.homes[id] = newHome();
    // 清理旧版 per-CEO 仓库字段（迁到 furnInv 后不再使用）
    if (st.homes[id].inv) delete st.homes[id].inv;
    return st.homes[id];
  }
  function furnInvOf(st) {
    if (!st.furnInv || typeof st.furnInv !== 'object') st.furnInv = {};
    return st.furnInv;
  }
  function addInv(inv, fid, n) {
    const k = Math.floor(num(n, 0)); if (!FURN_BY_ID[fid] || k <= 0) return;
    inv[fid] = (inv[fid] || 0) + k;
  }
  function takeInv(inv, fid) {
    if (!(inv[fid] > 0)) return false;
    inv[fid]--; if (inv[fid] <= 0) delete inv[fid]; return true;
  }
  function homeOpen(st, id) { return !!(CEO_BY_ID[id] && st.ceos[id] && st.ceos[id].unlocked); }
  // 生活模式点家具的互动：按类别 / 明确能力，不认死 ID（新床、新书架等自动接上）。f.act 可显式覆盖
  function furnLiveAct(fid) {
    const f = FURN_BY_ID[fid]; if (!f) return 'walk';
    if (f.act) return f.act;
    if (f.cat === 'bed') return 'rest';
    if (f.sub === 'bookshelf') return 'read';
    if (f.sub === 'wardrobe') return 'dress';
    return 'walk';
  }
  function furnSize(fid, rot) { const f = FURN_BY_ID[fid]; return (rot & 1) ? { w:f.h, h:f.w } : { w:f.w, h:f.h }; }
  const boxOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  function itemSurf(p, fid) {
    const f = FURN_BY_ID[fid || (p && p.fid)];
    if (p && (p.surf === 'wall' || p.surf === 'floor')) return p.surf;
    return f && f.wall ? 'wall' : 'floor';
  }
  // 能不能摆在 (x,y)：挂画只走墙面格，其余只走地板格；同面才算重叠；墙面避开窗户/房名牌
  function canPlace(st, id, fid, x, y, rot, ignoreUid, surf) {
    const f = FURN_BY_ID[fid]; if (!f) return { ok:false, why:'没有这件家具' };
    const want = f.wall ? 'wall' : 'floor';
    surf = surf || want;
    if (surf !== want) return { ok:false, why:f.wall ? f.name + '只能挂在墙上' : f.name + '不能挂墙' };
    const h = homeOf(st, id), T = homeTier(h.lv), sz = furnSize(fid, rot || 0);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok:false, why:'位置不对' };
    const rows = surf === 'wall' ? WALL_ROWS : T.rows, cols = T.cols;
    if (x < 0 || y < 0 || x + sz.w > cols || y + sz.h > rows) return { ok:false, why:surf === 'wall' ? '超出墙面了' : '超出房间了' };
    if (surf === 'wall' && hitsWallBlock(st, id, x, y, sz.w, sz.h)) return { ok:false, why:'这里有窗户 / 墙上装饰，换块空墙挂' };
    const me = { x, y, w:sz.w, h:sz.h }, rug = f.layer === 'rug';
    for (const p of h.placed) {
      if (p.uid === ignoreUid) continue;
      const pf = FURN_BY_ID[p.fid]; if (!pf) continue;
      if (itemSurf(p) !== surf) continue;                  // 墙面 / 地板分开，互不挡
      if (surf === 'floor' && (pf.layer === 'rug') !== rug) continue; // 地毯和普通家具不同层，可以叠
      const ps = furnSize(p.fid, p.rot);
      if (boxOverlap(me, { x:p.x, y:p.y, w:ps.w, h:ps.h })) return { ok:false, why:'和' + pf.name + '重叠了' };
    }
    return { ok:true };
  }
  function findFree(st, id, fid, rot, surf) {
    const f = FURN_BY_ID[fid]; if (!f) return null;
    const want = surf || (f.wall ? 'wall' : 'floor');
    const T = homeTier(homeOf(st, id).lv), rows = want === 'wall' ? WALL_ROWS : T.rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < T.cols; x++) if (canPlace(st, id, fid, x, y, rot || 0, null, want).ok) return { x, y, surf:want };
    return null;
  }
  function homeUpgradeCost(st, id) { const h = homeOf(st, id); return h.lv >= HOME_MAX ? null : HOME_TIERS[h.lv].cost; }
  // 下面这些都直接改 st；只有「买家具 / 升级房子」花金币，摆放/移动/旋转/收回/撤销永远不碰金币
  function buyFurniture(st, fid) {
    const f = FURN_BY_ID[fid]; if (!f) return { ok:false, why:'没有这件家具' };
    const pay = spendCoins(st, f.price); if (!pay.ok) return { ok:false, why:pay.why };
    const inv = furnInvOf(st); addInv(inv, fid, 1);
    return { ok:true, cost:f.price, count:inv[fid] };
  }
  function upgradeHome(st, id) {
    if (!homeOpen(st, id)) return { ok:false, why:'这位 CEO 还没加入' };
    const h = homeOf(st, id); if (h.lv >= HOME_MAX) return { ok:false, why:'已经是' + homeTier(h.lv).name + '了' };
    const c = HOME_TIERS[h.lv].cost, pay = spendCoins(st, c); if (!pay.ok) return { ok:false, why:pay.why };
    h.lv++;   // 地板格子只会变大、坐标不动；新房型底图的墙面禁区可能不同 → 墙面整理一遍（挪空墙 / 退仓库，不丢件）
    const w = reconcileWall(st, id);
    return { ok:true, cost:c, lv:h.lv, tier:homeTier(h.lv), wallMoved:w.moved, wallStored:w.stored };
  }
  function placeItem(st, id, fid, x, y, rot, surf) {
    rot = (rot | 0) & 3;
    if (!homeOpen(st, id)) return { ok:false, why:'这位 CEO 还没加入' };
    const f = FURN_BY_ID[fid], inv = furnInvOf(st); if (!(inv[fid] > 0)) return { ok:false, why:'仓库里没有' + (f ? f.name : '这件') };
    const want = surf || (f && f.wall ? 'wall' : 'floor');
    const c = canPlace(st, id, fid, x, y, rot, null, want); if (!c.ok) return c;
    const h = homeOf(st, id), uid = 'u' + (h.next++);
    takeInv(inv, fid); h.placed.push({ uid, fid, x, y, rot, surf:want });
    return { ok:true, uid, undo:{ type:'place', ceo:id, uid } };
  }
  function itemOf(h, uid) { return h.placed.find(p => p.uid === uid) || null; }
  function moveItem(st, id, uid, x, y) {
    const h = homeOf(st, id), p = itemOf(h, uid); if (!p) return { ok:false, why:'找不到这件家具' };
    const surf = itemSurf(p);
    if (p.x === x && p.y === y) return { ok:false, why:'没动', same:true };
    const c = canPlace(st, id, p.fid, x, y, p.rot, uid, surf); if (!c.ok) return c;
    const undo = { type:'pose', ceo:id, uid, x:p.x, y:p.y, rot:p.rot, surf };
    p.x = x; p.y = y; p.surf = surf; return { ok:true, undo };
  }
  // 原地转 90°（宽高互换）；放不下就在附近找个最近的空位，再放不下就不转；挂画仍留在墙面
  function rotateItem(st, id, uid) {
    const h = homeOf(st, id), p = itemOf(h, uid); if (!p) return { ok:false, why:'找不到这件家具' };
    const nr = (p.rot + 1) & 3, surf = itemSurf(p);
    let best = null;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (!canPlace(st, id, p.fid, x, y, nr, uid, surf).ok) continue;
      const d = Math.abs(dx) + Math.abs(dy); if (!best || d < best.d) best = { x, y, d };
    }
    if (!best) return { ok:false, why:'转不开：旁边没空位' };
    const undo = { type:'pose', ceo:id, uid, x:p.x, y:p.y, rot:p.rot, surf };
    p.x = best.x; p.y = best.y; p.rot = nr; p.surf = surf;
    return { ok:true, undo, moved:best.d > 0 };
  }
  function storeItem(st, id, uid) {
    const h = homeOf(st, id), k = h.placed.findIndex(p => p.uid === uid); if (k < 0) return { ok:false, why:'找不到这件家具' };
    const p = h.placed[k]; h.placed.splice(k, 1); addInv(furnInvOf(st), p.fid, 1);
    return { ok:true, undo:{ type:'store', ceo:id, item:{ uid:p.uid, fid:p.fid, x:p.x, y:p.y, rot:p.rot, surf:itemSurf(p) } } };
  }
  // 撤销一步摆放操作（摆上/移动/旋转/收回）；不碰金币，不撤销购买
  function undoHome(st, u) {
    if (!u) return { ok:false, why:'没有可以撤销的' };
    const h = homeOf(st, u.ceo), inv = furnInvOf(st);
    if (u.type === 'place') { const k = h.placed.findIndex(p => p.uid === u.uid); if (k < 0) return { ok:false, why:'已经不在房间里' };
      const p = h.placed[k]; h.placed.splice(k, 1); addInv(inv, p.fid, 1); return { ok:true }; }
    if (u.type === 'pose') { const p = itemOf(h, u.uid); if (!p) return { ok:false, why:'已经不在房间里' };
      const surf = u.surf || itemSurf(p);
      if (!canPlace(st, u.ceo, p.fid, u.x, u.y, u.rot, u.uid, surf).ok) return { ok:false, why:'原位置被占了' };
      p.x = u.x; p.y = u.y; p.rot = u.rot; p.surf = surf; return { ok:true }; }
    if (u.type === 'store') { const it = u.item; if (!(inv[it.fid] > 0)) return { ok:false, why:'仓库里已经没有了' };
      const surf = it.surf || itemSurf(it);
      if (!canPlace(st, u.ceo, it.fid, it.x, it.y, it.rot, null, surf).ok) return { ok:false, why:'原位置被占了' };
      takeInv(inv, it.fid); h.placed.push({ uid:it.uid, fid:it.fid, x:it.x, y:it.y, rot:it.rot, surf }); return { ok:true }; }
    return { ok:false, why:'未知操作' };
  }

  // 11w：4 件占地只缩小深度 h（抽屉床/贝壳床 2×3→2×2，摇椅/拼布灯 1×2→1×1）。旧档若只改定义不挪坐标，脚会往上飘。
  // 按「旧占地底边」锚定：newY = oldY + oldSize.h - newSize.h；宽变窄时保持 x。只跑一次（st.fpMig11w）。
  // 不合法（越界/重叠）→ 找空位；再不行完整退仓库。不擦存档、不改金币、不丢件数。
  const FP_OLD_11W = {
    furn_s77_drawer_bed: { ow:2, oh:3 },
    furn_pearl_pearl_bed: { ow:2, oh:3 },
    furn_s77_rocking_chair: { ow:1, oh:2 },
    furn_s77_quilt_shade_lamp: { ow:1, oh:2 },
  };
  function oldSize11w(ow, oh, rot) { return (rot & 1) ? { w:oh, h:ow } : { w:ow, h:oh }; }
  // 11w 修：先把「全部未迁移家具」占位预留，再分两轮安排迁移件——①原底边锚定位（只对预留件 + 已定迁移件校验）；
  // ②锚定失败的才找空位（此时所有锚定件已占好位，不会抢到后面家具的格子）；③最后全局校验，迁移件若仍与任何家具重叠就整件退仓。
  // 与记录顺序无关：迁移件排在前面还是后面，结果一致。
  function migrateFootprintBy(st, OLD, flag) {
    if (st[flag]) return { shifted:0, stored:0, skipped:true };
    let shifted = 0, stored = 0;
    CEOS.forEach(c => {
      const h = homeOf(st, c.id), all = (h.placed || []).slice();
      const isMig = p => !!(OLD[p.fid] && FURN_BY_ID[p.fid]);
      const fixed = all.filter(p => !isMig(p));
      const placedMig = new Map();   // uid -> 新记录
      const pend = [];
      const tryAt = (fid, x, y, rot, surf, others) => {
        const saved = h.placed; h.placed = others;
        const ok = Number.isInteger(x) && Number.isInteger(y) && canPlace(st, c.id, fid, x, y, rot, null, surf).ok;
        h.placed = saved; return ok;
      };
      const freeAt = (fid, rot, surf, others) => { const saved = h.placed; h.placed = others; const sp = findFree(st, c.id, fid, rot, surf); h.placed = saved; return sp; };
      const occupied = () => fixed.concat(Array.from(placedMig.values()));
      // ① 锚定
      all.filter(isMig).forEach(p => {
        const old = OLD[p.fid];
        const rot = Number.isInteger(p.rot) ? p.rot & 3 : 0;
        const oSz = oldSize11w(old.ow, old.oh, rot), nSz = furnSize(p.fid, rot);
        const nx = p.x, ny = p.y + oSz.h - nSz.h;
        const surf = p.surf === 'wall' ? 'wall' : 'floor';
        if (tryAt(p.fid, nx, ny, rot, surf, occupied())) placedMig.set(p.uid, { uid:p.uid, fid:p.fid, x:nx, y:ny, rot, surf });
        else pend.push({ p, rot, surf });
      });
      // ② 锚定失败的回退找空位
      pend.forEach(({ p, rot, surf }) => {
        const sp = freeAt(p.fid, rot, surf, occupied());
        if (sp) placedMig.set(p.uid, { uid:p.uid, fid:p.fid, x:sp.x, y:sp.y, rot, surf });
      });
      // 按原记录顺序重建；没位的退仓
      const out = [];
      all.forEach(p => {
        if (!isMig(p)) { out.push(p); return; }
        const q = placedMig.get(p.uid);
        if (q) out.push(q); else { addInv(furnInvOf(st), p.fid, 1); stored++; }
      });
      // ③ 全局校验：迁移件与任何其他家具重叠 → 退仓（兜底，正常不会触发）
      const drop = new Set();
      out.forEach(q => {
        if (!placedMig.has(q.uid)) return;
        const others = out.filter(o => o !== q && !drop.has(o));
        if (tryAt(q.fid, q.x, q.y, q.rot, q.surf, others)) { const src = all.find(p => p.uid === q.uid); if (src && (src.x !== q.x || src.y !== q.y)) shifted++; }
        else { drop.add(q); addInv(furnInvOf(st), q.fid, 1); stored++; }
      });
      h.placed = out.filter(q => !drop.has(q));
    });
    st[flag] = 1;
    return { shifted, stored, skipped:false };
  }
  function migrateFootprint11w(st) { return migrateFootprintBy(st, FP_OLD_11W, 'fpMig11w'); }
  // 11z：熊大 10 件占地审查，9 件收紧深度（宽不变）；香草木箱园保持 1×1。独立标记 fpMig11z（已跑过 11w 的档也要跑这次）。
  // 同一套：先预留全部非迁移件 → 按旋转后真实高差锚底边 newY = oldY + 旧高 − 新高（x 不变）→ 失败找空位 → 全局重叠退仓。
  const FP_OLD_11Z = {
    furn_pearl_tea_loft: { ow:2, oh:3 },
    furn_pearl_capsule_daybed: { ow:2, oh:3 },
    furn_pearl_picnic_table: { ow:2, oh:2 },
    furn_otaku_floor_futon: { ow:2, oh:3 },
    furn_otaku_bunk_manga: { ow:2, oh:3 },
    furn_otaku_kotatsu: { ow:2, oh:2 },
    furn_rocket_steel_platform_bed: { ow:2, oh:3 },
    furn_rocket_cryo_rest_pod: { ow:2, oh:3 },
    furn_rocket_captain_chair: { ow:1, oh:2 },
  };
  function migrateFootprint11z(st) { return migrateFootprintBy(st, FP_OLD_11Z, 'fpMig11z'); }
  function migrateFootprints(st) {   // 读档时按顺序跑：11w 再 11z，各自只跑一次
    const a = migrateFootprint11w(st), b = migrateFootprint11z(st);
    return { shifted:a.shifted + b.shifted, stored:a.stored + b.stored, skipped:a.skipped && b.skipped, w11:a, z11:b };
  }

  // 墙面整理（读档 + 升级房子 + 换底图禁区都走这一个）：
  // 第 1 遍：先留下所有合法的墙面件（相对已留下的件检查：不出界、不踩禁区、不互相重叠）；
  // 第 2 遍：不合法的（旧地板挂画 / 踩到新禁区 / 重叠 / 出界）在墙上找离原位最近的空位挪过去，没位就完整退回公共仓库。
  // 两遍分开，挪动的件不会落到后面本来合法的件身上；件数守恒、不碰金币；重复跑结果不变
  function reconcileWall(st, id) {
    const h = homeOf(st, id), all = h.placed || [], keep = [], fix = [];
    let moved = 0, stored = 0;
    for (const p of all) {
      const f = FURN_BY_ID[p.fid]; if (!f) continue;
      if (!f.wall) { p.surf = p.surf === 'wall' ? 'floor' : (p.surf || 'floor'); keep.push(p); continue; }
      h.placed = keep;
      const legal = p.surf === 'wall' && canPlace(st, id, p.fid, p.x, p.y, p.rot, p.uid, 'wall').ok;
      h.placed = all;
      if (legal) keep.push(p); else fix.push(p);
    }
    h.placed = keep;
    const T = homeTier(h.lv);
    for (const p of fix) {
      const tx = num(p.x, 0), ty = p.surf === 'wall' ? num(p.y, 0) : 0;
      let best = null, bd = Infinity;
      for (let y = 0; y < WALL_ROWS; y++) for (let x = 0; x < T.cols; x++) {
        const d = Math.abs(x - tx) + Math.abs(y - ty);
        if (d < bd && canPlace(st, id, p.fid, x, y, p.rot || 0, null, 'wall').ok) { best = { x, y }; bd = d; }
      }
      if (best) { keep.push({ uid:p.uid, fid:p.fid, x:best.x, y:best.y, rot:p.rot || 0, surf:'wall' }); moved++; }
      else { addInv(furnInvOf(st), p.fid, 1); stored++; }
    }
    h.placed = keep;
    return { moved, stored };
  }
  // 旧档：地板上的挂画迁到墙面；踩到窗户 / 底图墙饰的挪到空墙；墙面没位 → 完整退回公共仓库（不丢、不重复、不多算豪华度）
  function migrateWallPaintings(st) {
    let moved = 0, stored = 0;
    CEOS.forEach(c => { const r = reconcileWall(st, c.id); moved += r.moved; stored += r.stored; });
    return { moved, stored };
  }
  function homeLuxury(st, id) {
    const h = homeOf(st, id); let s = homeTier(h.lv).bonus;
    for (const p of h.placed) if (FURN_BY_ID[p.fid]) s += FURN_BY_ID[p.fid].lux;
    return s;
  }
  function invCount(st) { return Object.values(furnInvOf(st)).reduce((a, b) => a + b, 0); }
  // 商城展示：已拥有 N（摆出 X / 仓库 Y）+ 摆在谁家
  function furnStats(st, fid) {
    const warehouse = (furnInvOf(st)[fid] || 0);
    const where = [];
    CEOS.forEach(c => {
      const h = st.homes && st.homes[c.id]; if (!h) return;
      (h.placed || []).forEach(p => { if (p.fid === fid) where.push({ ceo:c.id, name:c.name, uid:p.uid, x:p.x, y:p.y }); });
    });
    return { owned:warehouse + where.length, placed:where.length, warehouse, where };
  }
  // 读档整理：缺的补默认；坏家具/越界/重叠退回公共仓库（不丢）；旧版 per-CEO inv 合并进 furnInv
  function normHomeBundle(rawHomes, rawInv) {
    const inv = {}, wall = { moved:0, stored:0 };
    if (rawInv && typeof rawInv === 'object') for (const [fid, n] of Object.entries(rawInv)) addInv(inv, fid, n);
    const out = {};
    CEOS.forEach(c => {
      const o = rawHomes && typeof rawHomes === 'object' && rawHomes[c.id] && typeof rawHomes[c.id] === 'object' ? rawHomes[c.id] : {};
      // 旧版仓库（按 CEO）→ 并入公共仓库
      if (o.inv && typeof o.inv === 'object') for (const [fid, n] of Object.entries(o.inv)) addInv(inv, fid, n);
      const h = { lv:Math.max(1, Math.min(HOME_MAX, Math.floor(num(o.lv, 1)))), placed:[], next:Math.max(1, Math.floor(num(o.next, 1))) };
      const tmp = { homes:{ [c.id]:h }, ceos:{ [c.id]:{ unlocked:true } }, furnInv:inv }, seen = {};
      (Array.isArray(o.placed) ? o.placed : []).forEach(p => {
        if (!p || !FURN_BY_ID[p.fid]) return;
        const f = FURN_BY_ID[p.fid], rot = Number.isInteger(p.rot) ? p.rot & 3 : 0;
        const uid = typeof p.uid === 'string' && p.uid && !seen[p.uid] ? p.uid : 'u' + (h.next++);
        const surf = p.surf === 'wall' || p.surf === 'floor' ? p.surf : (f.wall ? 'wall' : 'floor');
        if (f.wall) {
          // 12b：挂画这里不判合法、不找空位——先原样收下（只做 uid / rot 清洗），等整组布局恢复完，再统一交给 reconcileWall 两遍整理。
          // 以前这里单遍「当场判 + findFree」，排在前面的坏画会先抢到后面合法画的格子，后者被挤走，读档还报告 0 迁移。
          // 旧档地板挂画先标 'legacy'（不挡地板件；reconcileWall 视为不合法，按原 x 就近上墙）；原记录顺序保留
          h.placed.push({ uid, fid:p.fid, x:p.x, y:p.y, rot, surf:surf === 'wall' ? 'wall' : 'legacy' }); seen[uid] = true;
        } else if (Number.isInteger(p.x) && Number.isInteger(p.y) && canPlace(tmp, c.id, p.fid, p.x, p.y, rot, null, surf).ok) {
          h.placed.push({ uid, fid:p.fid, x:p.x, y:p.y, rot, surf }); seen[uid] = true;
        } else addInv(inv, p.fid, 1);
        const m = /^u(\d+)$/.exec(uid); if (m) h.next = Math.max(h.next, +m[1] + 1);
      });
      // 整组恢复完（地板件已就位、挂画原样收下）→ 统一墙面整理：合法的先留，坏的挪最近空墙，挂不下退公共仓库
      const r = reconcileWall(tmp, c.id); wall.moved += r.moved; wall.stored += r.stored;
      out[c.id] = h;
    });
    return { homes:out, furnInv:inv, wall };
  }
  function normHomes(raw) { return normHomeBundle(raw, null).homes; }
  function normFurnInv(rawInv, rawHomes) { return normHomeBundle(rawHomes, rawInv).furnInv; }

  /* ================= 存档：新建 / 版本迁移 ================= */
  function newState(now) {
    const st = {
      v:CFG.SAVE_VERSION, rev:0, coins:0, coinFrac:0, totalEarned:0, earnedFrac:0,
      shops:SHOPS.map((_, i) => ({ open:i === 0, lv:i === 0 ? 1 : 0, emp:0 })),
      ceos:{}, crossSeen:{},
      taps:0, crits:0, bigCustomers:0, specialCustomers:0, boostEnd:0,
      lastSeen:now, maxSeen:now, created:now,
      pending:null, dailyDoubleDay:null, claimLog:[],
      gacha:{ owned:[], draws:0, pity:0, last:null },
      wear:{}, decorHidden:[], rush:{ tea:0, tech:0 },
      ach:{}, muted:false, cur:0,
      homes:normHomes(null), furnInv:{},
    };
    CEOS.forEach(c => { st.ceos[c.id] = { unlocked:false, lv:1, at:-1 }; st.wear[c.id] = { clothes:null, hat:null }; });
    checkUnlocks(st);
    return st;
  }
  // 任意旧档 → 当前版本。v1 = 定稿前「伙伴」版（shops[i].hired），v2 = CEO+员工
  function migrate(raw, now) {
    const base = newState(now);
    if (!raw || typeof raw !== 'object') return { st:base, from:null };
    const from = raw.v || 0;
    const st = Object.assign(base, raw);
    // 12d：余额拆成整数 + 零头；坏值在 loadSave 里先挡掉（走备份），这里只做兜底清洗，不截上限（旧档超上限的保留）
    st.coins = isAmt(raw.coins) ? raw.coins : 0;
    st.coinFrac = isAmt(raw.coinFrac) && raw.coinFrac < 1 ? raw.coinFrac : 0;
    normWallet(st);
    st.totalEarned = isAmt(raw.totalEarned) ? raw.totalEarned : st.coins; st.earnedFrac = raw.earnedFrac;
    normEarned(st);   // 12d1：累计收入拆整数 + 零头
    const badPending = raw.pending != null && !pendingOk(raw.pending);
    st.pending = raw.pending != null && !badPending ? Object.assign({}, raw.pending) : null;
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
      ? { owned:[...new Set(raw.gacha.owned.filter(id => ITEM_BY_ID[id]))], draws:num(raw.gacha.draws, 0), pity:Math.max(0, Math.floor(num(raw.gacha.pity, 0))), last:raw.gacha.last || null }
      : { owned:[], draws:0, pity:0, last:null };
    if (st.gacha.last && !ITEM_BY_ID[st.gacha.last.id]) st.gacha.last = null;
    st.claimLog = Array.isArray(raw.claimLog) ? raw.claimLog.slice(-20) : [];
    st.crossSeen = raw.crossSeen && typeof raw.crossSeen === 'object' ? raw.crossSeen : {};
    // 穿搭跟着 CEO 走：v2 的全局 equip 归给 77
    const okWear = (slot, id) => id == null ? null : (id === 'c_gold' || id === 'h_gold' || (ITEM_BY_ID[id] && ITEM_BY_ID[id].type === slot)) ? id : null;
    st.wear = {};
    CEOS.forEach(c => { const w = (raw.wear && raw.wear[c.id]) || (c.id === 'c77' && raw.equip) || {};
      st.wear[c.id] = { clothes:okWear('clothes', w.clothes), hat:okWear('hat', w.hat) }; });
    delete st.equip;
    st.rush = { tea:0, tech:0 };
    st.decorHidden = Array.isArray(raw.decorHidden) ? raw.decorHidden : [];
    st.bigCustomers = Math.max(0, Math.floor(num(raw.bigCustomers, 0)));
    st.specialCustomers = Math.max(0, Math.floor(num(raw.specialCustomers, 0)));
    st.boostEnd = 0; // 团单改为一次性结算，旧档残留的 ×5 清掉
    st.lastSeen = num(raw.lastSeen, now); st.maxSeen = Math.max(num(raw.maxSeen, 0), st.lastSeen);
    const hb = normHomeBundle(raw.homes, raw.furnInv); // CEO 生活篇：公共仓库 + 每家摆放；旧 per-CEO inv 自动并入
    st.homes = hb.homes; st.furnInv = hb.furnInv;
    st.rev = num(raw.rev, 0);
    delete st.hired;
    st.v = CFG.SAVE_VERSION;
    return { st, from, wall:hb.wall, badPending };   // wall：读档时墙面整理挪了几幅 / 退了几幅（给页面提示用）；badPending：坏的待领取收益已丢弃
  }

  /* ===== 12d：存档校验 / 备份恢复 ===== */
  // 读档前检查「会动到金币 / 等级」的字段：有坏值 = 坏档（不归零、不降级），交给 loadSave 走备份
  function checkSave(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['save'];
    const bad = [];
    if (!isAmt(raw.coins)) bad.push('coins');
    else if (raw.coins > SAFE) bad.push('coins>安全整数');   // 12d1：超过 MAX_SAFE_INTEGER 的余额不能当钱包用
    if (raw.coinFrac !== undefined && !(isAmt(raw.coinFrac) && raw.coinFrac < 1)) bad.push('coinFrac');
    if (raw.shops !== undefined && !Array.isArray(raw.shops)) bad.push('shops');
    else (raw.shops || []).forEach((o, i) => { if (!o || typeof o !== 'object') return;
      if (o.lv !== undefined && !isAmt(o.lv)) bad.push('shops[' + i + '].lv');
      if (o.emp !== undefined && !isAmt(o.emp)) bad.push('shops[' + i + '].emp'); });
    if (raw.ceos && typeof raw.ceos === 'object') CEOS.forEach(c => { const o = raw.ceos[c.id];
      if (o && typeof o === 'object' && o.lv !== undefined && !isAmt(o.lv)) bad.push('ceos.' + c.id + '.lv'); });
    return bad;
  }
  // 内存里的整档在写盘前校验（坏了就不写，调用方恢复上一份好档）
  function validState(st) {
    if (!st || typeof st !== 'object') return ['state'];
    const bad = [];
    if (!normWallet(st)) bad.push(isAmt(st.coins) && st.coins > SAFE ? 'coins>安全整数' : 'coins');
    if (!isAmt(st.totalEarned) || !(st.earnedFrac == null || (isAmt(st.earnedFrac) && st.earnedFrac < 1))) bad.push('totalEarned');
    if (!Array.isArray(st.shops) || st.shops.length !== SHOPS.length) bad.push('shops');
    else st.shops.forEach((o, i) => { if (!o || !isAmt(o.lv) || !isAmt(o.emp)) bad.push('shops[' + i + ']'); });
    if (!st.ceos || typeof st.ceos !== 'object') bad.push('ceos');
    else CEOS.forEach(c => { const o = st.ceos[c.id]; if (!o || !isAmt(o.lv)) bad.push('ceos.' + c.id); });
    if (st.pending != null && !pendingOk(st.pending)) bad.push('pending');
    return bad;
  }
  // 读档：主档好 → 用主档；主档坏（JSON 读不了 / 金币或等级坏值）→ 用完整备份；备份也不行 → blocked（调用方不覆盖原档、提示）
  function loadSave(mainStr, bakStr, now) {
    const parse = sv => { if (sv == null || sv === '') return { none:true }; try { const r = JSON.parse(sv); return r == null ? { none:true } : { raw:r }; } catch (e) { return { err:true }; } };
    const m = parse(mainStr);
    if (m.none) return Object.assign(migrate(null, now), { source:'new', bad:[], raw:null });
    const mBad = m.err ? ['json'] : checkSave(m.raw);
    if (!mBad.length) return Object.assign(migrate(m.raw, now), { source:'main', bad:[], raw:m.raw });
    const mainRev = m.raw && isAmt(m.raw.rev) ? m.raw.rev : 0;
    const b = parse(bakStr), bBad = b.none ? ['none'] : b.err ? ['json'] : checkSave(b.raw);
    // 12d1：主档余额超出安全整数（如 1e20）→ 原文原样保留、不自动拿备份覆盖，进入异常模式（不写盘、封禁所有交易）；备份是否可用只做提示
    if (mBad.includes('coins>安全整数')) return Object.assign(migrate(m.raw, now), { source:'unsafe', bad:mBad, raw:m.raw, mainRev, blocked:true, unsafe:true, bakOk:!bBad.length, bakCoins:!bBad.length ? b.raw.coins : null });
    if (!bBad.length) return Object.assign(migrate(b.raw, now), { source:'bak', bad:mBad, raw:b.raw, mainRev });
    return Object.assign(migrate(m.err ? null : m.raw, now), { source:'broken', bad:mBad, bakBad:bBad, raw:m.raw || null, mainRev, blocked:true });
  }

  /* ================= 12b2：测试房间（只给 ?test=homes 用，不读不写真存档） ================= */
  // 四家都开张、四位 CEO 都在，房子统一到 lv（2 公寓 / 3 豪宅），每家摆好地板家具 + 1 幅挂画，仓库再放几件给测试员自己摆；金币够升级 / 买
  const TEST_HOME_KIT = [['furn_rug', 2, 2], ['furn_table', 3, 2], ['furn_bed', 0, 0], ['furn_sofa', 2, -1], ['furn_bookshelf', -3, -1], ['furn_lamp', -1, -2], ['furn_plant', -1, -1]];   // 高家具都放前排，不挡后墙底图
  function testHomesState(now, lv) {
    lv = lv === 3 ? 3 : 2;
    const st = newState(now);
    st.coins = 1e12; st.totalEarned = 1e12; st.taps = 1;
    st.shops = SHOPS.map(() => ({ open:true, lv:CFG.ROCKET_UNLOCK_LV, emp:1 }));
    checkUnlocks(st);
    const report = {};
    for (const c of CEOS) {
      const h = homeOf(st, c.id); h.lv = lv; const T = homeTier(lv), got = [];
      for (const [fid, x0, y0] of TEST_HOME_KIT) {
        buyFurniture(st, fid);
        const x = x0 < 0 ? T.cols + x0 : x0, y = y0 < 0 ? T.rows + y0 : y0;
        let r = placeItem(st, c.id, fid, x, y, 0);
        if (!r.ok) { const sp = findFree(st, c.id, fid, 0); r = sp ? placeItem(st, c.id, fid, sp.x, sp.y, 0, sp.surf) : r; }
        got.push(fid + (r.ok ? '' : '✗'));
      }
      buyFurniture(st, 'furn_painting'); const sp = findFree(st, c.id, 'furn_painting', 0, 'wall');
      if (sp) placeItem(st, c.id, 'furn_painting', sp.x, sp.y, 0, 'wall');
      report[c.id] = got;
    }
    for (const [fid, n] of [['furn_painting', 4], ['furn_plant', 2], ['furn_lamp', 1], ['furn_catbed', 1]]) for (let i = 0; i < n; i++) buyFurniture(st, fid);
    st.coins = 1e12; st.test = 'homes';
    return st;
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
    if (st.gacha.owned.length < ITEMS.length) return { text:'盲盒收集 ' + ITEMS.length + ' 件', cur:st.gacha.owned.length, need:ITEMS.length, count:true };
    for (const i of [0, 1, 2, 3]) if (S[i].lv < 50) return { text:SHOPS[i].short + ' 冲 Lv50：收益×8', cur:S[i].lv, need:50, lv:true };
    return { text:'躺着也能赚，老板你赢麻了！', cur:1, need:1 };
  }

  return { CFG, ROCKET_NAME, TYPES, SHOPS, CEOS, CEO_BY_ID, SIGNS, CROSS, ITEMS, ITEM_BY_ID, REGULAR_ITEMS, SUPER_ITEMS, CARD_COUNT, SET_REWARD, MILESTONES,
    SUPER_OF_SHOP, hasSuper, superMult, rushActive, rushMult, startRush, critChance, critMult, portalReward, gachaComplete,
    COIN_CAP:CFG.COIN_CAP, SAFE_COINS:SAFE, normEarned, walletOk, normWallet, balance, overCap, addCoins, spendCoins, canAfford, priceOk, pendingOk,
    shopMaxLv, empMaxLv, ceoMaxLv, shopMaxed, empMaxed, ceoMaxed, shopBuyCount, checkSave, validState, loadSave,
    milestoneMult, nextMilestone, upgradeCost, bulkUpgradeCost, empCost, ceoCost, empMult, shopBase,
    ceoAt, ceoInfo, shopRate, baseRate, onlineRate, offlineRate, rushOnlineRate, boostActive, orderPayout, settleOrder,
    BIG_ORDERS, SPECIAL_GUESTS, specialReward, settleSpecial, specialInterval,
    crossKey, crossActive, offlineCap, bigInterval, tapMult, tapValue, tapReward, critTiers, tierMult, comboNext, comboSteps, comboProgress,
    checkUnlocks, assignCeo, assignCeoWithPayout, creditOnline, previewAssign, signOf, cloneState,
    canOpen, openShop, hireEmp, upgradeEmp, upgradeCeo, upgradeShop,
    dayKey, nextResetTs, clockRolledBack, computeOffline, settleOffline, canDouble, claimOffline,
    gachaUnlocked, gachaRemaining, gachaOdds, gachaPrice, gachaDraw, cardsComplete, newState, migrate, nextGoal, testHomesState,
    HOME_TIERS, HOME_MAX, WALL_ROWS, WALL_BLOCK, wallBlockedCells, MALL_CATS, FURNITURE, FURN_BY_ID, newHome, homeTier, homeOf, furnInvOf, homeOpen, furnLiveAct, furnSize, itemSurf, canPlace, findFree, homeUpgradeCost,
    buyFurniture, upgradeHome, placeItem, moveItem, rotateItem, storeItem, undoHome, migrateWallPaintings, reconcileWall, WALL_BLOCK, migrateFootprint11w, migrateFootprint11z, migrateFootprints, FP_OLD_11Z, homeLuxury, invCount, furnStats, normHomes, normFurnInv, normHomeBundle };
});
