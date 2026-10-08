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
    const endBest = { t: Math.max(0, Math.min(86400, fin(eb.t, 0))), kills: Math.max(0, Math.floor(fin(eb.kills, 0))) };
    const endTop = normTop(r.endTop, endBest);
    if (endTop[0] && endTop[0].t > endBest.t) { endBest.t = endTop[0].t; endBest.kills = endTop[0].kills; }
    return { lv, cleared: Math.max(0, Math.min(MAX_LV, Math.floor(fin(r.cleared, 0)))), best: Math.max(0, Math.floor(fin(r.best, 0))),
      endBest, endTop };
  }
  // 无尽排行榜：按坚持秒数排（同秒按击倒、再按先到），最多 TOP_N 条；id = 开局 runId，同一局只记一次。
  // 老档没有榜单时，只把已有的「最好成绩」作为唯一一条历史记录，不补造其它对局。
  const TOP_N = 10, ID_RE = /^[a-z0-9]{1,40}$/i;
  const legId = t => 'legacy' + Math.round(t * 1000).toString(36);
  const cmpTop = (a, b) => b.t - a.t || b.kills - a.kills || a.at - b.at;
  function normTop(raw, endBest) {
    if (!Array.isArray(raw)) return endBest.t > 0 ? [{ t: endBest.t, kills: endBest.kills, id: legId(endBest.t), at: 0 }] : [];
    const seen = new Set(), out = [];
    for (const e of raw) {
      if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID_RE.test(e.id) || seen.has(e.id)) continue;
      seen.add(e.id);
      out.push({ t: Math.max(0, Math.min(86400, fin(e.t, 0))), kills: Math.max(0, Math.min(1e7, Math.floor(fin(e.kills, 0)))), id: e.id, at: Math.max(0, fin(e.at, 0)) });
    }
    out.sort(cmpTop);
    // 最好成绩必须在榜上（旧页面只会更新 endBest）：没有就补一条 legacy；id 由成绩决定，重复读档不会多出来
    if (endBest.t > 0 && !out.some(e => e.t >= endBest.t)) { out.push({ t: endBest.t, kills: endBest.kills, id: legId(endBest.t), at: 0 }); out.sort(cmpTop); }
    return out.slice(0, TOP_N);
  }
  // Old formal parents replace state.zombie with their pre-TOP10 norm, but
  // Economy.migrate/commit preserve unknown top-level fields. Keep a bounded
  // mirror in the SAME transaction: no extra storage write or wallet restore.
  function preserveFormalTop(st) {
    if (!st || !st.zombie || typeof st.zombie !== 'object') return;
    const z = st.zombie, current = Array.isArray(z.endTop) ? z.endTop : [];
    const mirror = Array.isArray(st.zombieEndTopV1) ? st.zombieEndTopV1 : [];
    const top = norm(Object.assign({}, z, { endTop: current.concat(mirror) })).endTop;
    z.endTop = top;
    st.zombieEndTopV1 = top.map(e => Object.assign({}, e));
  }
  // 本局名次：1..TOP_N；没上榜 = 0
  const rankOf = (z, id) => { const k = (z && Array.isArray(z.endTop) ? z.endTop : []).findIndex(e => e.id === id); return k < 0 ? 0 : k + 1; };
  // 上场角色：烧烤店在任 CEO（经营页 zb:'state' 的 ceo 字段，null = 没人在任）。技能做好的才进 PLAYABLE；老经营页不带 ceo 字段时按 77
  const HEROES = { c77: { name: '77', atk: '飞串', ult: '火圈' }, pearl: { name: '珍珠姐', atk: '珍珠弹', ult: '冰沙风暴', btn: '冰沙' }, otaku: { name: '阿宅店长', atk: '回旋漫画', ult: '分镜轰炸', btn: '分镜' }, rocket: { name: '火箭老板', atk: '迷你火箭', ult: '星舰冲击波', btn: '星舰' } };
  const CEO_IDS = Object.keys(HEROES), PLAYABLE = ['c77', 'pearl', 'otaku', 'rocket'];
  const heroOf = v => (v === undefined ? 'c77' : CEO_IDS.includes(v) ? v : null);
  // 一局结果并进进度：只认已解锁关（n ≤ cleared+1）且打满时长的胜利；无尽要先通 50 关
  function applyResult(z, res) {
    if (!res || typeof res !== 'object') return false;
    const t = Math.max(0, Math.min(86400, fin(res.t, 0))), kills = Math.max(0, Math.min(1e7, Math.floor(fin(res.kills, 0))));
    if (res.mode === 'endless') {
      if (z.cleared < MAX_LV) return false;
      const id = typeof res.runId === 'string' && ID_RE.test(res.runId) ? res.runId : null;
      if (!Array.isArray(z.endTop)) z.endTop = normTop(null, z.endBest);
      if (id && z.endTop.some(e => e.id === id)) return true;   // 同一局重发（重试保存）不重复上榜
      if (t > z.endBest.t) z.endBest = { t, kills };
      if (id) z.endTop = normTop(z.endTop.concat({ t, kills, id, at: Date.now() }), z.endBest);
    }
    else {
      const n = Math.floor(fin(res.n, 0));
      if (n < 1 || n > Math.min(MAX_LV, z.cleared + 1)) return false;
      if (res.win === true && t >= levelDur(n) - 0.5) z.cleared = Math.max(z.cleared, n);
    }
    z.best = Math.max(z.best, kills);
    return true;
  }
  return { MAX_LV, MAX_TRAIN, GROWTH, BASE, IDS, HEROES, CEO_IDS, PLAYABLE, heroOf, price, levelDur, norm, applyResult, TOP_N, rankOf, preserveFormalTop };
});
