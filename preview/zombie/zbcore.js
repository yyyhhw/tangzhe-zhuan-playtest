// 打僵尸共享规则：训练价格 / 上限 / 关卡时长 / 进度清洗。经营页（真正扣金币、写存档的一方）和小游戏页共用这一份；经营页不信任小游戏页传来的价格或进度。
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ZBCore = factory(); })(this, function () {
  'use strict';
  const MAX_LV = 50, MAX_TRAIN = 30, GROWTH = 1.9;
  const BASE = { atk: 1e6, rate: 1.5e6, hp: 1.2e6, ult: 2e6 };
  const IDS = Object.keys(BASE);
  const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const price = (id, lv) => Math.round(BASE[id] * GROWTH ** lv);
  const levelDur = n => Math.min(150, 60 + (n - 1) * 2);
  function norm(raw) {
    const r = raw && typeof raw === 'object' ? raw : {}, lv = {};
    IDS.forEach(k => { lv[k] = Math.max(0, Math.min(MAX_TRAIN, Math.floor(fin(r.lv && r.lv[k], 0)))); });
    const eb = r.endBest && typeof r.endBest === 'object' ? r.endBest : {};
    return { lv, cleared: Math.max(0, Math.min(MAX_LV, Math.floor(fin(r.cleared, 0)))), best: Math.max(0, Math.floor(fin(r.best, 0))),
      endBest: { t: Math.max(0, Math.min(86400, fin(eb.t, 0))), kills: Math.max(0, Math.floor(fin(eb.kills, 0))) } };
  }
  // 上场角色：烧烤店在任 CEO（经营页 zb:'state' 的 ceo 字段，null = 没人在任）。技能做好的才进 PLAYABLE；老经营页不带 ceo 字段时按 77
  const HEROES = { c77: { name: '77', atk: '飞串', ult: '火圈' }, pearl: { name: '珍珠姐', atk: '珍珠弹', ult: '冰沙风暴', btn: '冰沙' }, otaku: { name: '阿宅店长' }, rocket: { name: '火箭老板' } };
  const CEO_IDS = Object.keys(HEROES), PLAYABLE = ['c77', 'pearl'];
  const heroOf = v => (v === undefined ? 'c77' : CEO_IDS.includes(v) ? v : null);
  // 一局结果并进进度：只认已解锁关（n ≤ cleared+1）且打满时长的胜利；无尽要先通 50 关
  function applyResult(z, res) {
    if (!res || typeof res !== 'object') return false;
    const t = Math.max(0, Math.min(86400, fin(res.t, 0))), kills = Math.max(0, Math.min(1e7, Math.floor(fin(res.kills, 0))));
    if (res.mode === 'endless') { if (z.cleared < MAX_LV) return false; if (t > z.endBest.t) z.endBest = { t, kills }; }
    else {
      const n = Math.floor(fin(res.n, 0));
      if (n < 1 || n > Math.min(MAX_LV, z.cleared + 1)) return false;
      if (res.win === true && t >= levelDur(n) - 0.5) z.cleared = Math.max(z.cleared, n);
    }
    z.best = Math.max(z.best, kills);
    return true;
  }
  return { MAX_LV, MAX_TRAIN, GROWTH, BASE, IDS, HEROES, CEO_IDS, PLAYABLE, heroOf, price, levelDur, norm, applyResult };
});
