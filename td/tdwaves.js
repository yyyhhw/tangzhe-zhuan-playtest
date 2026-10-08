// 塔防波次数据（实验版，平衡未验）：只生成每一波的出怪队列和敌人数值，不碰页面、存档、钱包。
// 第 1–10 波与 15c 的 waveList / spawn 完全一致；第 11–50 波只用现有敌种，
// 血量 = 该敌种在基线里最后一次出现的血量 × 1.03^(波数−锚点)：小 Boss 锚第 5 波，其余锚第 10 波；不再乘旧的 1.17 和 (1+0.5·…) 成长。
// 无尽第 k 波 = 该敌种第 50 波血量 × 1.12^k（沿用 15c 无尽倍率），先钳指数再算，血量不超过 1e12。
// 调用方直接用返回的血量和速度，不能再乘任何成长倍率。
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TDWaves = factory(); })(this, function () {
  'use strict';
  const RULES_VERSION = 'td-waves-50-exp2', NORMAL_WAVES = 50, OLD_WAVES = 10, GROWTH = 1.03, ENDLESS_GROWTH = 1.12, MAX_ENDLESS = Number.MAX_SAFE_INTEGER - NORMAL_WAVES;
  const EN = Object.freeze({ walk: { hp: 30, sp: 1.0, leak: 1 }, fast: { hp: 18, sp: 1.8, leak: 1 }, tank: { hp: 110, sp: 0.6, leak: 1 }, mini: { hp: 600, sp: 0.5, leak: 3 }, boss: { hp: 2200, sp: 0.42, leak: 10 } });
  const NORMAL_BOSS_HP = 800, NORMAL_BOSS_LEAK = 20, HP_CAP = 1e12;
  const ANCHOR = Object.freeze({ walk: 10, fast: 10, tank: 10, mini: 5, boss: 10 });
  // 第 11–50 波按阶段调数量：count=普通+快兵总数，fastEvery=每几只里有 1 只快兵，tanks=坦克数
  const STAGES = Object.freeze([
    Object.freeze({ from: 11, to: 20, count0: 26, tank0: 4, tankStep: 4, fastEvery: 3 }),
    Object.freeze({ from: 21, to: 30, count0: 31, tank0: 6, tankStep: 4, fastEvery: 3 }),
    Object.freeze({ from: 31, to: 40, count0: 36, tank0: 8, tankStep: 4, fastEvery: 2 }),
    Object.freeze({ from: 41, to: 50, count0: 40, tank0: 10, tankStep: 2, fastEvery: 2 })
  ]);
  // 波末能量的几种封顶方案，供比较；累计预算不在这里定
  const ENERGY_PLANS = Object.freeze({
    A: Object.freeze({ desc: '沿用 20+5n，不封顶', at: n => 20 + 5 * n }),
    B: Object.freeze({ desc: '20+5n，第 10 波后封顶 70', at: n => Math.min(70, 20 + 5 * n) }),
    C: Object.freeze({ desc: '20+5n，第 10 波后每波只加 1，封顶 100', at: n => n <= 10 ? 20 + 5 * n : Math.min(100, 70 + (n - 10)) })
  });
  const DEFAULT_PLAN = 'B';
  const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  // 与 15c spawn() 同顺序同算式，保证前 10 波逐位相等
  function oldHp(type, n) {
    const w = Math.min(n - 1, 9);
    return Math.min(HP_CAP, (type === 'boss' ? NORMAL_BOSS_HP : EN[type].hp) * (1.17 ** w) * (type === 'boss' ? 1 : 1 + .5 * Math.max(0, w - 2)) * 1);
  }
  const hpAt = (type, n) => n <= ANCHOR[type] ? oldHp(type, n) : Math.min(HP_CAP, oldHp(type, ANCHOR[type]) * GROWTH ** (n - ANCHOR[type]));
  function endlessHp(type, k) {
    const base = hpAt(type, NORMAL_WAVES), kMax = Math.ceil(Math.log(HP_CAP / base) / Math.log(ENDLESS_GROWTH));
    return Math.min(HP_CAP, base * ENDLESS_GROWTH ** Math.min(k, kMax));
  }
  function walkFast(q, count, fastEvery, allowFast) { for (let i = 0; i < count; i++) q.push(allowFast && i % fastEvery === fastEvery - 1 ? 'fast' : 'walk'); }
  function normalQueue(n) {
    const q = [];
    if (n <= OLD_WAVES) {
      const w = n - 1;
      walkFast(q, 7 + 2 * w, 3, w >= 1);
      for (let i = 0; i < Math.floor(w / 2); i++) q.push('tank');
      if (w === 4) q.push('mini');
      if (w === OLD_WAVES - 1) q.push('boss');
      return q;
    }
    const s = STAGES.find(x => n >= x.from && n <= x.to), off = n - s.from;
    walkFast(q, Math.min(40, s.count0 + Math.floor(off / 2)), s.fastEvery, true);
    for (let i = 0, t = s.tank0 + Math.floor(off / s.tankStep); i < t; i++) q.push('tank');
    if (n % 10 === 5) q.push('mini');
    if (n % 10 === 0) { if (n >= 40) q.push('mini'); q.push('boss'); }
    return q;
  }
  function endlessQueue(k) {
    const q = [];
    walkFast(q, 40, 2, true);
    for (let i = 0, t = Math.min(20, 14 + Math.floor(k / 5)); i < t; i++) q.push('tank');
    if (k % 5 === 0) q.push('boss'); else if (k % 3 === 0) q.push('mini');
    return q;
  }
  function build(kind, n, k, q, hpOf, spMul, leakOf, energy) {
    const enemies = {};
    for (const type of q) if (!enemies[type]) enemies[type] = { hp: hpOf(type), speed: EN[type].sp * spMul, leak: leakOf(type) };
    const counts = {};
    for (const type of q) counts[type] = (counts[type] || 0) + 1;
    return { rulesVersion: RULES_VERSION, kind, wave: kind === 'normal' ? n : k, overall: n, queue: q, counts, enemies, waveEndEnergy: energy };
  }
  function getNormalWave(n, plan = DEFAULT_PLAN) {
    if (!isInt(n, 1, NORMAL_WAVES)) throw new RangeError('normal wave must be an integer 1..' + NORMAL_WAVES);
    if (!Object.prototype.hasOwnProperty.call(ENERGY_PLANS, plan)) throw new RangeError('unknown energy plan');
    return build('normal', n, 0, normalQueue(n), t => hpAt(t, n), 1, t => t === 'boss' ? NORMAL_BOSS_LEAK : EN[t].leak, n === NORMAL_WAVES ? 0 : ENERGY_PLANS[plan].at(n));
  }
  function getEndlessWave(k) {
    if (!isInt(k, 1, MAX_ENDLESS)) throw new RangeError('endless wave must be an integer 1..' + MAX_ENDLESS);
    return build('endless', NORMAL_WAVES + k, k, endlessQueue(k), t => endlessHp(t, k), Math.min(1.25, 1 + .01 * k), t => EN[t].leak, 50);
  }
  return Object.freeze({ RULES_VERSION, NORMAL_WAVES, MAX_ENDLESS, GROWTH, ENDLESS_GROWTH, STAGES, ENERGY_PLANS: Object.freeze(Object.keys(ENERGY_PLANS).map(id => Object.freeze({ id, desc: ENERGY_PLANS[id].desc }))), DEFAULT_PLAN, getNormalWave, getEndlessWave });
});
