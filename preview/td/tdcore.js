// 塔防共享规则：升级价格 / 上限 / 波数 / 进度清洗。经营页（真正扣金币、写存档的一方）和小游戏页共用这一份；经营页不信任小游戏页传来的价格或进度。
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TDCore = factory(); })(this, function () {
  'use strict';
  // 样品：一张图 10 波（第 5 波小 Boss、第 10 波 Boss）。MAX_LV 留着以后加图
  const MAX_LV = 1, WAVES = 10, MAX_UP = 30, GROWTH = 1.9;
  // 8 种塔：4 座店铺塔 + 4 座 CEO 塔（统帅和同名 CEO 塔同场时塔有额外效果）；cost = 局内建设点
  const TOWERS = {
    bbq:     { name: '烧烤火炉', cost: 60,  ceo: null },
    tea:     { name: '奶茶冷饮', cost: 60,  ceo: null },
    book:    { name: '书页发射', cost: 80,  ceo: null },
    tech:    { name: '科技电塔', cost: 90,  ceo: null },
    t77:     { name: '77 烤串塔', cost: 110, ceo: 'c77' },
    tpearl:  { name: '珍珠塔',   cost: 110, ceo: 'pearl' },
    totaku:  { name: '阿宅漫画塔', cost: 110, ceo: 'otaku' },
    trocket: { name: '火箭塔',   cost: 120, ceo: 'rocket' },
  };
  const TOWER_IDS = Object.keys(TOWERS);
  const HEROES = { c77: { name: '77', atk: '飞串', ult: '火圈', tower: 't77' }, pearl: { name: '珍珠姐', atk: '珍珠弹', ult: '冰沙风暴', btn: '冰沙', tower: 'tpearl' }, otaku: { name: '阿宅店长', atk: '回旋漫画', ult: '分镜轰炸', btn: '分镜', tower: 'totaku' }, rocket: { name: '火箭老板', atk: '迷你火箭', ult: '星舰冲击波', btn: '星舰', tower: 'trocket' } };
  const CEO_IDS = Object.keys(HEROES);
  // 主金币只用来做永久升级：每种塔一项 + 每位统帅一项
  const BASE = {};
  TOWER_IDS.forEach(k => { BASE[k] = TOWERS[k].ceo ? 1.5e6 : 1e6; });
  CEO_IDS.forEach(k => { BASE['cmd_' + k] = 2e6; });
  const IDS = Object.keys(BASE);
  const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const price = (id, lv) => Math.round(BASE[id] * GROWTH ** lv);
  const waveCount = () => WAVES;
  const cmdOf = v => (CEO_IDS.includes(v) ? v : 'rocket');
  function norm(raw) {
    const r = raw && typeof raw === 'object' ? raw : {}, lv = {};
    IDS.forEach(k => { lv[k] = Math.max(0, Math.min(MAX_UP, Math.floor(fin(r.lv && r.lv[k], 0)))); });
    return { lv, cleared: Math.max(0, Math.min(MAX_LV, Math.floor(fin(r.cleared, 0)))), best: Math.max(0, Math.min(WAVES, Math.floor(fin(r.best, 0)))), cmd: cmdOf(r.cmd) };
  }
  // 一局结果并进进度：只认已解锁图（n ≤ cleared+1）；best = 守住的最多波数，守满 10 波才算通关
  function applyResult(z, res) {
    if (!res || typeof res !== 'object') return false;
    const n = Math.floor(fin(res.n, 0)), w = Math.max(0, Math.min(WAVES, Math.floor(fin(res.waves, 0))));
    if (n < 1 || n > Math.min(MAX_LV, z.cleared + 1)) return false;
    z.best = Math.max(z.best, w);
    if (res.win === true && w >= WAVES) z.cleared = Math.max(z.cleared, n);
    return true;
  }
  return { MAX_LV, WAVES, MAX_UP, GROWTH, TOWERS, TOWER_IDS, HEROES, CEO_IDS, BASE, IDS, price, waveCount, cmdOf, norm, applyResult };
});
