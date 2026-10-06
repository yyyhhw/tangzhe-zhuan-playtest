/* 宠物原型 p1 — 小狗行为引擎（纯逻辑，不碰 DOM / localStorage，浏览器 / Node 通用）
   坐标：地板格，x 向右、y 向前（y=0 贴后墙），1 = 1 格；小狗位置 = 落地点（影子中心）。
   规则（熊大规格）：走 0.65 格/秒、跑 1.30、碰撞半径 0.22；精力起始 70，<35 优先休息、睡到 70 再活动；
   走/跑/玩 每秒 −0.06/−0.30/−0.20，睡觉 +0.80；亲密起始 40，有效互动 +1（60 秒冷却），离线 / 冷落永不扣；
   收益加成 0（不接经济）。只在「目标或障碍变了」时重算路径（带间隙网格 A* + 拉直）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./art.js'));
  else root.PetEngine = factory(root.PetArt);
})(typeof self !== 'undefined' ? self : this, function (Art) {
  'use strict';
  const CFG = {
    WALK: 0.65, RUN: 1.30, R: 0.22, RES: 0.25, BALL_R: 0.12,
    ENERGY0: 70, TIRED: 35, RESTED: 70,
    DRAIN: { walk: 0.06, run: 0.30, play: 0.20 }, SLEEP_GAIN: 0.80,
    AFF0: 40, AFF_CD: 60,
    PERSONALITY: { curious: 0.70, affectionate: 0.75, playful: 0.65 },
    INCOME_BONUS: 0,
    PET_CD: 1.5,           // 摸完一次后这么久内再点只冒爱心，不重播动画
    OFFLINE_BED_AFTER: 20, // 离开超过这么多秒，回来时在自己窝里（自己休息过）
    SAVE_V: 1,
  };
  const DIRV = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* ---------- 随机数（可存档、可复现） ---------- */
  function rnd(w) {
    let t = (w.rs = (w.rs + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rr = (w, a, b) => a + rnd(w) * (b - a);

  /* ---------- 世界 ---------- */
  function createWorld(opt) {
    const { catalog, room, interact, manifest } = opt;
    const v = Art.validateManifest(manifest);
    if (!v.ok) throw new Error('manifest 不合格：' + v.errors.join('；'));
    const byId = {};
    for (const f of catalog) byId[f.id] = f;
    const w = {
      cfg: CFG, byId, manifest, interact,
      cols: room.cols, rows: room.rows, wallRows: room.wallRows || 2,
      front: { ...room.front }, bed: { ...room.bed }, bowl: { ...room.bowl },
      items: room.items.filter(p => byId[p.fid] && !byId[p.fid].wall).map((p, i) => ({ uid: 'f' + i, fid: p.fid, x: p.x, y: p.y, rot: p.rot || 0 })),
      wall: (room.wall || []).filter(p => byId[p.fid] && byId[p.fid].wall).map((p, i) => ({ uid: 'w' + i, fid: p.fid, x: p.x, y: p.y, rot: 0 })),
      t: 0, rs: (opt.seed == null ? 12345 : opt.seed) >>> 0,
      obsVer: 0, _obs: null, _obsVer: -1, _grid: null,
      paused: false,
      stats: { plans: 0, replans: 0, noPath: 0, stuck: 0, petStarts: 0, petAbsorbed: 0, callDup: 0, fetches: 0, maxStep: 0 },
      log: [], fx: [], failed: [],
      ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, state: 'floor', flight: null },
    };
    const start = opt.start || { x: room.front.x, y: room.rows - 1.6 };
    w.dog = {
      x: start.x, y: start.y, z: 0, dir: 'S', side: 'E',
      energy: CFG.ENERGY0, affinity: CFG.AFF0, lastGain: -1e9,
      tired: false, carrying: false, activity: 'idle', label: '刚到家，东张西望',
      plan: [], step: null, anim: new Art.Animator(manifest), petCdUntil: 0,
      move: null, lastEat: -1e9,
    };
    const sp = nearestFreePoint(w, w.dog, CFG.R, 3);
    if (sp) { w.dog.x = sp.x; w.dog.y = sp.y; }
    const bp = nearestFreePoint(w, { x: room.front.x + 1.2, y: room.rows - 1.2 }, CFG.BALL_R, 3);
    w.ball.x = bp.x; w.ball.y = bp.y;
    return w;
  }

  /* ---------- 家具 / 障碍 ---------- */
  function sizeOf(w, p) { const f = w.byId[p.fid]; return (p.rot & 1) ? { w: f.h, h: f.w } : { w: f.w, h: f.h }; }
  function itemRect(w, p) { const s = sizeOf(w, p); return { x: p.x, y: p.y, w: s.w, h: s.h }; }
  const isRug = (w, p) => w.byId[p.fid].layer === 'rug';
  const isSolid = (w, p) => !w.byId[p.fid].wall && !isRug(w, p);
  function obstacles(w) {
    if (w._obsVer !== w.obsVer || !w._obs) {
      w._obs = w.items.filter(p => isSolid(w, p)).map(p => ({ ...itemRect(w, p), uid: p.uid }));
      w._obs.push({ ...w.bowl, uid: 'pet_bowl' });
      w._obsVer = w.obsVer; w._grid = null;
    }
    return w._obs;
  }
  function rectDist(px, py, r) {
    const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h));
    return Math.hypot(dx, dy);
  }
  function circleFree(w, x, y, rad) {
    if (x < rad || y < rad || x > w.cols - rad || y > w.rows - rad) return false;
    for (const o of obstacles(w)) if (rectDist(x, y, o) < rad) return false;
    return true;
  }
  // 线段到矩形的精确距离（不采样）：相交 = 0；否则最近点一定落在某个端点或矩形角上
  function segHitsRect(ax, ay, bx, by, r) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    const clip = (p, q) => { if (Math.abs(p) < 1e-12) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
    return clip(-dx, ax - r.x) && clip(dx, r.x + r.w - ax) && clip(-dy, ay - r.y) && clip(dy, r.y + r.h - ay) && t0 <= t1;
  }
  function ptSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(ax + dx * t - px, ay + dy * t - py);
  }
  function segRectDist(a, b, r) {
    if (segHitsRect(a.x, a.y, b.x, b.y, r)) return 0;
    let m = Math.min(rectDist(a.x, a.y, r), rectDist(b.x, b.y, r));
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]]) m = Math.min(m, ptSegDist(cx, cy, a.x, a.y, b.x, b.y));
    return m;
  }
  function segClear(w, a, b, rad) {
    for (const p of [a, b]) if (p.x < rad || p.y < rad || p.x > w.cols - rad || p.y > w.rows - rad) return false;
    for (const o of obstacles(w)) if (segRectDist(a, b, o) < rad) return false;
    return true;
  }
  /* ---------- 网格 A*（带间隙） ---------- */
  function grid(w) {
    obstacles(w);
    if (w._grid) return w._grid;
    const R = CFG.RES, nx = Math.round(w.cols / R), ny = Math.round(w.rows / R), free = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = circleFree(w, (i + 0.5) * R, (j + 0.5) * R, CFG.R) ? 1 : 0;
    w._grid = { nx, ny, free, R };
    return w._grid;
  }
  const nodePt = (g, n) => ({ x: (n % g.nx + 0.5) * g.R, y: (Math.floor(n / g.nx) + 0.5) * g.R });
  function nearestNodes(w, p, maxD, k) {
    const g = grid(w), out = [];
    const ci = Math.floor(p.x / g.R), cj = Math.floor(p.y / g.R), span = Math.ceil(maxD / g.R) + 1;
    for (let j = Math.max(0, cj - span); j <= Math.min(g.ny - 1, cj + span); j++)
      for (let i = Math.max(0, ci - span); i <= Math.min(g.nx - 1, ci + span); i++) {
        const n = j * g.nx + i; if (!g.free[n]) continue;
        const q = nodePt(g, n), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d <= maxD) out.push({ n, d, q });
      }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, k || out.length);
  }
  function nearestFreePoint(w, p, rad, maxD) {
    if (circleFree(w, p.x, p.y, rad)) return { x: p.x, y: p.y };
    for (let r = 0.05; r <= (maxD || 3); r += 0.05)
      for (let a = 0; a < 24; a++) { const x = p.x + Math.cos(a / 24 * 6.2832) * r, y = p.y + Math.sin(a / 24 * 6.2832) * r; if (circleFree(w, x, y, rad)) return { x, y }; }
    return null;
  }
  function astar(w, s, goal) {
    const g = grid(w), N = g.nx * g.ny, gs = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const gx = goal % g.nx, gy = Math.floor(goal / g.nx);
    const h = (n) => { const dx = Math.abs(n % g.nx - gx), dy = Math.abs(Math.floor(n / g.nx) - gy); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)); };
    const heap = [];
    const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gs[s] = 0; push(s, h(s));
    const midFree = (a, b) => segClear(w, nodePt(g, a), nodePt(g, b), CFG.R);
    while (heap.length) {
      const [, n] = pop();
      if (closed[n]) continue; closed[n] = 1;
      if (n === goal) { const path = [n]; let c = n; while (came[c] >= 0) { c = came[c]; path.push(c); } return path.reverse(); }
      const i = n % g.nx, j = Math.floor(n / g.nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= g.nx || b >= g.ny) continue;
        const m = b * g.nx + a; if (!g.free[m] || closed[m]) continue;
        if (di && dj && (!g.free[j * g.nx + a] || !g.free[b * g.nx + i])) continue;   // 不切角
        if (!midFree(n, m)) continue;
        const ng = gs[n] + (di && dj ? Math.SQRT2 : 1);
        if (ng < gs[m]) { gs[m] = ng; came[m] = n; push(m, ng + h(m)); }
      }
    }
    return null;
  }
  // 规划：起点 → 目标；目标被挡就找 near 范围内最近的可站点；完全没路返回 null（不穿家具、不瞬移）
  function planPath(w, from, to, near) {
    w.stats.plans++;
    const R = CFG.R;
    let fin = circleFree(w, to.x, to.y, R) ? { x: to.x, y: to.y } : null;
    if (!fin) { const c = nearestNodes(w, to, near == null ? 0.6 : near, 1)[0]; if (!c) return null; fin = c.q; }
    if (segClear(w, from, fin, R)) return [fin];
    const starts = nearestNodes(w, from, 0.9, 12).filter(c => segClear(w, from, c.q, R));
    if (!starts.length) return null;
    const goals = nearestNodes(w, fin, 0.6, 6).filter(c => segClear(w, c.q, fin, R));
    if (!goals.length) return null;
    const path = astar(w, starts[0].n, goals[0].n);
    if (!path) return null;
    const g = grid(w);
    const pts = [{ x: from.x, y: from.y }, ...path.map(n => nodePt(g, n)), fin];
    const out = []; let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !segClear(w, pts[i], pts[j], R)) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  function reachable(w, from, to, near) { return !!planPath(w, from, to, near); }

  /* ---------- 互动点（只有 INTERACT 里配了的才有） ---------- */
  function interactSpot(w, key) {
    const cfg = w.interact[key]; if (!cfg) return null;
    let base;
    if (key === 'pet_bed') base = w.bed; else if (key === 'pet_bowl') base = w.bowl;
    else { const p = w.items.find(q => q.fid === key); if (!p) return null; base = itemRect(w, p); }
    const spot = { x: base.x + cfg.spot[0], y: base.y + cfg.spot[1] };
    return { key, cfg, spot, center: { x: base.x + base.w / 2, y: base.y + base.h / 2 }, free: circleFree(w, spot.x, spot.y, CFG.R) };
  }

  /* ---------- 计划 / 步骤 ---------- */
  function setPlan(w, kind, steps, label) {
    const d = w.dog;
    if (d.step && d.step.k === 'sleep' && kind !== 'rest') d.lastWake = w.t;
    d.plan = steps; d.step = null; d.activity = kind; if (label) d.label = label;
    w.log.push({ t: +w.t.toFixed(2), kind }); if (w.log.length > 300) w.log.shift();
  }
  const faceStep = (dir, toward) => ({ k: 'face', dir, toward });
  // 原地动作只画东向：先自然转到侧面（朝目标那边），再播
  function inPlace(clip, opt) { opt = opt || {}; return [faceStep(null, opt.toward), { k: 'anim', clip, ...opt }]; }
  function fx(w, type) { w.fx.push({ type, t: w.t }); if (w.fx.length > 12) w.fx.shift(); }
  function gainAffinity(w, why) {
    const d = w.dog;
    if (w.t - d.lastGain >= CFG.AFF_CD) { d.affinity += 1; d.lastGain = w.t; fx(w, 'heart'); return true; }
    return false;
  }
  function restPlan(w, why) {
    const s = interactSpot(w, 'pet_bed'), steps = [];
    if (s && s.free) steps.push({ k: 'goto', to: s.spot, speed: 'walk', label: why === 'tired' ? '困了，慢慢走回小窝' : '想回窝眯一会' });
    steps.push(faceStep('E'), { k: 'anim', clip: 'liedown', label: '趴下' }, { k: 'sleep', label: '呼呼睡' }, { k: 'anim', clip: 'getup', label: '伸个懒腰起来' }, { k: 'fn', fn: (w) => { w.dog.tired = false; } });
    return steps;
  }
  function randomSpot(w, minD) {
    for (let i = 0; i < 40; i++) {
      const p = { x: rr(w, 0.4, w.cols - 0.4), y: rr(w, 0.4, w.rows - 0.4) };
      if (!circleFree(w, p.x, p.y, CFG.R + 0.04)) continue;
      if (dist(p, w.dog) < (minD || 1.5)) continue;
      if (w.failed.some(f => f.until > w.t && dist(f, p) < 1)) continue;
      return p;
    }
    return null;
  }
  // 自己待着时挑下一件事：按个性 + 精力加权，最近做过的降权（让它像在「有目的地过日子」）
  function choose(w) {
    const d = w.dog, P = CFG.PERSONALITY;
    if (d.tired || d.energy < CFG.TIRED) { d.tired = true; setPlan(w, 'rest', restPlan(w, 'tired')); return; }
    const opts = [];
    const add = (kind, wt, build) => { if (wt > 0) opts.push({ kind, wt, build }); };
    add('explore', 0.55 + 0.6 * P.curious, () => {
      const p = randomSpot(w, 1.8); if (!p) return null;
      const steps = [{ k: 'goto', to: p, speed: 'walk', label: '到处转转' }, { k: 'wait', dur: rr(w, 0.4, 0.9), label: '东张西望' }, ...inPlace('sniff', { label: '低头闻闻地板' })];
      if (rnd(w) < P.curious * 0.55) steps.push({ k: 'wait', dur: rr(w, 2, 4.5), label: '在这儿待一会' });
      return steps;
    });
    const visits = Object.keys(w.interact).filter(k => k.startsWith('furn_')).map(k => interactSpot(w, k)).filter(s => s && s.free && !w.failed.some(f => f.until > w.t && dist(f, s.spot) < 0.5));
    if (visits.length) add('visit', 0.9 * P.curious, () => {
      const s = visits[Math.floor(rnd(w) * visits.length)];
      const steps = [{ k: 'goto', to: s.spot, speed: 'walk', label: '去' + s.cfg.label + '那边看看' }, faceStep(s.cfg.face), { k: 'anim', clip: 'sniff', label: '闻闻' + s.cfg.label + '（有猫味？）' }];
      if (rnd(w) < (s.cfg.stay || 0.5)) steps.push({ k: 'anim', clip: 'sniff', label: '再闻闻' + s.cfg.label }, { k: 'wait', dur: rr(w, 2, 4), label: '守在' + s.cfg.label + '旁边' });
      return steps;
    });
    const bowl = interactSpot(w, 'pet_bowl');
    if (bowl && bowl.free && w.t - d.lastEat > 45) add('eat', 0.45, () => [{ k: 'goto', to: bowl.spot, speed: 'walk', label: '去饭碗那边' }, faceStep('E'), { k: 'anim', clip: 'eat', label: '吧唧吧唧吃两口' }, { k: 'anim', clip: 'eat', label: '吧唧吧唧' }, { k: 'fn', fn: (w) => { w.dog.lastEat = w.t; } }]);
    add('owner', 0.45 * P.affectionate, () => [{ k: 'goto', to: { x: w.front.x + rr(w, -1, 1), y: w.front.y - 0.6 }, speed: 'walk', label: '跑来看看你' }, faceStep('S'), { k: 'wait', dur: rr(w, 1.5, 3), label: '抬头看着你' }]);
    if (w.ball.state === 'floor' && d.energy > 45) add('ballPlay', 0.7 * P.playful, () => [
      { k: 'chase', speed: 'run', label: '自己去扑球' }, ...inPlace('play', { towardBall: true, label: '用爪子拨球' }),
      { k: 'fn', fn: nudgeBall }, { k: 'wait', dur: 0.8, label: '看球滚走' }]);
    if (d.energy > 50) add('hop', 0.3 * P.playful, () => [...inPlace('hop', { label: '原地蹦一下' }), { k: 'wait', dur: rr(w, 0.6, 1.2) }]);
    if (d.energy < 55) add('nap', 0.5, () => restPlan(w, 'nap'));
    add('idle', 0.35, () => [{ k: 'wait', dur: rr(w, 1.5, 3), look: 'random', label: '发会呆' }]);
    const last = w.log.length ? w.log[w.log.length - 1].kind : '', last2 = w.log.length > 1 ? w.log[w.log.length - 2].kind : '';
    for (const o of opts) { if (o.kind === last) o.wt *= 0.2; else if (o.kind === last2) o.wt *= 0.5; }
    const tot = opts.reduce((a, o) => a + o.wt, 0);
    let r = rnd(w) * tot;
    for (const o of opts) {
      r -= o.wt;
      if (r <= 0) { const steps = o.build(); if (steps) { setPlan(w, o.kind, steps); return; } }
    }
    setPlan(w, 'idle', [{ k: 'wait', dur: 1.5, look: 'random', label: '发会呆' }]);
  }

  /* ---------- 球 ---------- */
  function ballFree(w, x, y) { return circleFree(w, x, y, CFG.BALL_R); }
  function nudgeBall(w) {
    const b = w.ball, d = w.dog; if (b.state !== 'floor') return;
    let dx = b.x - d.x, dy = b.y - d.y; const L = Math.hypot(dx, dy) || 1;
    const sp = rr(w, 0.8, 1.3); b.vx = dx / L * sp; b.vy = dy / L * sp; b.state = 'roll';
  }
  function updateBall(w, dt) {
    const b = w.ball;
    if (b.state === 'air') {
      const f = b.flight; f.p = Math.min(1, f.p + dt / f.T);
      b.x = f.sx + (f.tx - f.sx) * f.p; b.y = f.sy + (f.ty - f.sy) * f.p;
      b.z = f.z0 * (1 - f.p) + 4 * f.h * f.p * (1 - f.p);
      if (f.p >= 1) { b.z = 0; b.state = 'roll'; const L = Math.hypot(f.tx - f.sx, f.ty - f.sy) || 1; b.vx = (f.tx - f.sx) / L * 0.9; b.vy = (f.ty - f.sy) / L * 0.9; b.flight = null; }
    } else if (b.state === 'roll') {
      const sp = Math.hypot(b.vx, b.vy);
      if (sp < 0.05) { b.state = 'floor'; b.vx = b.vy = 0; return; }
      const k = Math.max(0, sp - 1.6 * dt) / sp; b.vx *= k; b.vy *= k;
      const nx = b.x + b.vx * dt; if (ballFree(w, nx, b.y)) b.x = nx; else b.vx = -b.vx * 0.5;
      const ny = b.y + b.vy * dt; if (ballFree(w, b.x, ny)) b.y = ny; else b.vy = -b.vy * 0.5;
    } else if (b.state === 'carried') {
      const v = DIRV[w.dog.dir]; b.x = w.dog.x + v[0] * 0.3; b.y = w.dog.y + v[1] * 0.12; b.z = 0;
    }
  }
  function ballApproach(w) {
    const b = w.ball, d = w.dog;
    let dx = d.x - b.x, dy = d.y - b.y; const L = Math.hypot(dx, dy) || 1;
    const p = { x: b.x + dx / L * 0.32, y: b.y + dy / L * 0.32 };
    if (circleFree(w, p.x, p.y, CFG.R)) return p;
    const c = nearestNodes(w, b, 0.62, 1)[0];
    return c ? c.q : { x: b.x, y: b.y };
  }
  const REACH = CFG.R + CFG.BALL_R + 0.32;

  /* ---------- 每帧 ---------- */
  function playAnim(w, base, opt) {
    const d = w.dog, rc = Art.resolveClip(w.manifest, base, d.dir);
    if (d.anim.name !== rc.name || (opt && opt.restart)) d.anim.play(rc.name, opt && opt.restart ? opt : undefined);
  }
  function startStep(w, s) {
    const d = w.dog;
    if (s.label) d.label = s.label;
    s.t0 = w.t;
    switch (s.k) {
      case 'goto': case 'chase': s.path = null; s.ver = -1; break;
      case 'face': {
        let want = s.dir;
        if (!want) {   // 侧面：朝目标那边；没目标就沿用上次的侧面
          const tx = s.toward ? s.toward.x : null;
          want = tx != null && Math.abs(tx - d.x) > 0.05 ? (tx > d.x ? 'E' : 'W') : (d.dir === 'E' || d.dir === 'W' ? d.dir : d.side);
          if (s.towardBall) want = w.ball.x >= d.x ? 'E' : 'W';
        }
        s.want = want; s.dur = want === d.dir ? 0 : 0.16; break;
      }
      case 'anim': {
        if (s.towardBall) { /* 朝向已由 face 处理 */ }
        const opt = { restart: true };
        if (s.action) { const a = w.manifest.actions[s.action]; s.clip = a.clip; opt.frames = a.frames; opt.events = a.events; }
        opt.loop = false;
        d.anim.play(s.clip, opt);
        if (s.clip === 'petted') w.stats.petStarts++;
        break;
      }
      case 'wait': playAnim(w, 'idle'); s.nextLook = w.t + rr(w, 0.8, 1.6); break;
      case 'sleep': d.anim.play('sleep', { loop: true }); fx(w, 'zz'); break;
    }
  }
  // 返回 'run' | 'done' | 'fail'
  function tickStep(w, s, dt) {
    const d = w.dog;
    switch (s.k) {
      case 'fn': s.fn(w); return 'done';
      case 'face': {
        playAnim(w, 'idle');
        if (w.t - s.t0 >= s.dur / 2 && d.dir !== s.want) { d.dir = s.want; playAnim(w, 'idle'); }
        if (w.t - s.t0 >= s.dur) { d.dir = s.want; if (s.want === 'E' || s.want === 'W') d.side = s.want; return 'done'; }
        return 'run';
      }
      case 'anim': {
        const ev = d.anim.tick(dt);
        for (const e of ev) if (s.onEvent && s.onEvent(w, e) === false) return 'fail';
        if (s.clip === 'play' || s.clip === 'hop') d.drainMode = 'play';
        if (s.clip === 'hop') { const n = d.anim.seq.length; d.z = Math.sin(Math.PI * clamp((d.anim.k + d.anim.t / 70) / n, 0, 1)) * 0.32; }
        if (d.anim.done) { d.z = 0; if (s.clip === 'petted') d.petCdUntil = w.t + CFG.PET_CD; return 'done'; }
        return 'run';
      }
      case 'wait': {
        if (s.look === 'random' && w.t >= s.nextLook) { const ds = ['E', 'W', 'S', 'N', 'S']; d.dir = ds[Math.floor(rnd(w) * ds.length)]; if (d.dir === 'E' || d.dir === 'W') d.side = d.dir; s.nextLook = w.t + rr(w, 0.8, 1.6); }
        playAnim(w, 'idle'); d.anim.tick(dt);
        return w.t - s.t0 >= s.dur ? 'done' : 'run';
      }
      case 'waitBall': {
        playAnim(w, 'idle'); d.anim.tick(dt);
        const b = w.ball; if (b.state === 'floor' || b.state === 'carried') return 'done';
        if (b.state === 'roll' && w.t - s.t0 > 0.5) return 'done';
        return w.t - s.t0 > 4 ? 'done' : 'run';
      }
      case 'sleep': {
        d.anim.tick(dt); d.drainMode = 'sleep';
        if (w.t - s.t0 > 4 && d.energy >= CFG.RESTED) return 'done';
        return 'run';
      }
      case 'goto': case 'chase': return tickMove(w, s, dt);
    }
    return 'done';
  }
  function tickMove(w, s, dt) {
    const d = w.dog;
    if (s.k === 'chase') {
      if (w.ball.state === 'carried') return 'fail';
      if (w.ball.state === 'air') { playAnim(w, 'idle'); d.anim.tick(dt); return 'run'; }
      if (dist(d, w.ball) <= REACH && segClear(w, d, d, CFG.R)) { s.goal = null; return 'done'; }
      const g = ballApproach(w);
      if (!s.goal || dist(g, s.goal) > 0.3) { s.goal = g; s.path = null; }
    } else s.goal = s.to;
    if (!s.path || s.ver !== w.obsVer) {
      if (s.path) w.stats.replans++;
      s.path = planPath(w, d, s.goal, s.near); s.ver = w.obsVer; s.progAt = w.t; s.progPos = { x: d.x, y: d.y };
      if (!s.path) { w.failed.push({ x: s.goal.x, y: s.goal.y, until: w.t + 15 }); if (w.failed.length > 20) w.failed.shift(); return 'fail'; }
    }
    const spd = s.speed === 'run' ? CFG.RUN : CFG.WALK;
    let budget = spd * dt; const ox = d.x, oy = d.y; let mvx = 0, mvy = 0;
    while (budget > 1e-9 && s.path.length) {
      const wp = s.path[0], dx = wp.x - d.x, dy = wp.y - d.y, L = Math.hypot(dx, dy);
      if (L < 1e-6) { s.path.shift(); continue; }
      const stepL = Math.min(L, budget), nx = d.x + dx / L * stepL, ny = d.y + dy / L * stepL;
      if (!circleFree(w, nx, ny, CFG.R - 1e-9)) { s.path = null; s.ver = -1; break; }   // 被挡（障碍刚变过）→ 下帧重算
      d.x = nx; d.y = ny; budget -= stepL; mvx += dx / L * stepL; mvy += dy / L * stepL;
      if (stepL >= L - 1e-9) s.path.shift();
    }
    const moved = Math.hypot(d.x - ox, d.y - oy);
    // 保险：2.5 秒没往前走 0.05 格就当这条路不通，停下换目标（不硬挤、不瞬移）
    if (dist(d, s.progPos) > 0.05) { s.progPos = { x: d.x, y: d.y }; s.progAt = w.t; }
    else if (w.t - s.progAt > 2.5) { w.stats.stuck = (w.stats.stuck || 0) + 1; w.failed.push({ x: s.goal.x, y: s.goal.y, until: w.t + 15 }); return 'fail'; }
    if (moved > 1e-6) {
      d.drainMode = s.speed;
      // 朝向：横竖哪个分量大就朝哪边（带一点迟滞，免得斜走时来回闪）
      const ax = Math.abs(mvx), ay = Math.abs(mvy), cur = d.dir;
      const horiz = cur === 'E' || cur === 'W';
      let nd = cur;
      if (ax > ay * (horiz ? 0.8 : 1.25)) nd = mvx > 0 ? 'E' : 'W'; else nd = mvy > 0 ? 'S' : 'N';
      d.dir = nd; if (nd === 'E' || nd === 'W') d.side = nd;
      playAnim(w, s.speed === 'run' ? 'run' : 'walk'); d.anim.tick(dt);
    } else if (s.path) { playAnim(w, 'idle'); d.anim.tick(dt); }
    if (s.path && !s.path.length) return s.k === 'chase' ? (dist(d, w.ball) <= REACH ? 'done' : (s.path = null, 'run')) : 'done';
    return 'run';
  }
  function runDog(w, dt) {
    const d = w.dog;
    for (let guard = 0; guard < 6; guard++) {
      if (!d.step) {
        if (!d.plan.length) { if (w.paused) { playAnim(w, 'idle'); d.anim.tick(dt); return; } choose(w); }
        d.step = d.plan.shift(); startStep(w, d.step);
      }
      if (w.paused && d.step.k !== 'sleep' && d.step.k !== 'anim') { playAnim(w, 'idle'); d.anim.tick(dt); return; }   // 搬家具时停下来等
      const r = tickStep(w, d.step, dt);
      if (r === 'run') return;
      if (r === 'fail') {
        w.stats.noPath++; d.carrying = w.ball.state === 'carried';
        setPlan(w, 'confused', [...inPlace('attention', { label: '过不去，换个事做' }), { k: 'wait', dur: 0.6 }]);
        fx(w, 'q'); return;
      }
      d.step = null; dt = 0;
    }
  }
  function update(w, dt) {
    const d = w.dog, ox = d.x, oy = d.y;
    w.t += dt; d.drainMode = null;
    if (!w.paused) updateBall(w, dt); else if (w.ball.state === 'carried') updateBall(w, dt);
    runDog(w, dt);
    if (d.drainMode === 'sleep') d.energy = Math.min(100, d.energy + CFG.SLEEP_GAIN * dt);
    else if (d.drainMode && CFG.DRAIN[d.drainMode]) d.energy = Math.max(0, d.energy - CFG.DRAIN[d.drainMode] * dt);
    const mv = Math.hypot(d.x - ox, d.y - oy); if (dt > 0 && mv / dt > w.stats.maxStep) w.stats.maxStep = mv / dt;
    if (w.ball.state === 'carried') updateBall(w, 0);
  }
  function step(w, seconds, h) { h = h || 1 / 60; let n = Math.round(seconds / h); while (n-- > 0) update(w, h); }

  /* ---------- 三个操作 ---------- */
  const callSpot = (w) => ({ x: w.front.x, y: w.front.y - 0.55 });
  function dropBallSteps() {
    return [faceStep('S'), { k: 'anim', action: 'drop_ball', label: '把球放你面前', onEvent: (w, e) => { if (e === 'ball_drop') dropBall(w); } }];
  }
  function dropBall(w) {
    const b = w.ball, d = w.dog; if (b.state !== 'carried') return;
    const v = DIRV[d.dir]; let p = { x: d.x + v[0] * 0.38, y: d.y + v[1] * 0.38 };
    if (!ballFree(w, p.x, p.y)) p = nearestFreePoint(w, p, CFG.BALL_R, 1.5) || { x: d.x, y: d.y };
    b.x = p.x; b.y = p.y; b.z = 0; b.state = 'roll'; b.vx = v[0] * 0.25; b.vy = v[1] * 0.25; d.carrying = false;
    if (dist(b, callSpot(w)) < 1.2) { w.stats.fetches++; gainAffinity(w, 'fetch'); }
  }
  const sleeping = (w) => !!(w.dog.step && (w.dog.step.k === 'sleep' || (w.dog.step.k === 'anim' && w.dog.step.clip === 'liedown')));
  function call(w) {
    const d = w.dog;
    if (w.paused) return { ok: false, why: 'rearrange' };
    if (d.activity === 'called') { w.stats.callDup++; return { ok: true, dup: true }; }
    const steps = [];
    if (sleeping(w)) steps.push({ k: 'anim', clip: 'getup', label: '被叫醒，爬起来' });
    const far = dist(d, callSpot(w));
    steps.push(...inPlace('attention', { toward: callSpot(w), label: '听到了，扭头看你' }));
    steps.push({ k: 'goto', to: callSpot(w), speed: far > 3 && !d.tired && d.energy > 45 ? 'run' : 'walk', label: '朝你跑过来' });
    if (w.ball.state === 'carried') steps.push(...dropBallSteps());
    steps.push(faceStep('S'), { k: 'wait', dur: 1.6, label: '坐在你面前看着你' }, { k: 'fn', fn: (w) => gainAffinity(w, 'call') });
    setPlan(w, 'called', steps);
    return { ok: true };
  }
  function pet(w, how) {
    const d = w.dog;
    if (w.paused) return { ok: false, why: 'rearrange' };
    const busy = d.activity === 'petted' || w.t < d.petCdUntil;
    if (busy) { w.stats.petAbsorbed++; fx(w, 'heart'); return { ok: true, absorbed: true }; }
    if (sleeping(w)) { w.stats.petAbsorbed++; d.petCdUntil = w.t + CFG.PET_CD * 2; gainAffinity(w, 'pet'); fx(w, 'heart'); d.label = '睡着了，摸摸它，尾巴动了动'; return { ok: true, asleep: true }; }
    const steps = [];
    if (how === 'button' && dist(d, callSpot(w)) > 1.2) steps.push(...inPlace('attention', { toward: callSpot(w), label: '听到你要摸它' }), { k: 'goto', to: callSpot(w), speed: 'walk', label: '凑过来让你摸' });
    steps.push(faceStep(null), { k: 'anim', clip: 'petted', label: '被摸得眯起眼' }, { k: 'fn', fn: (w) => gainAffinity(w, 'pet') }, { k: 'wait', dur: 0.6, label: '蹭蹭你' });
    setPlan(w, 'petted', steps);
    return { ok: true };
  }
  function throwBall(w, target) {
    const d = w.dog, b = w.ball;
    if (w.paused) return { ok: false, why: 'rearrange' };
    if (b.state === 'carried') return { ok: false, why: 'carried' };
    if (b.state === 'air') return { ok: false, why: 'flying' };
    let t = target;
    if (!t || !ballFree(w, t.x, t.y)) {
      for (let i = 0; i < 60; i++) { const p = { x: rr(w, 0.4, w.cols - 0.4), y: rr(w, 0.5, w.rows - 1.4) }; if (ballFree(w, p.x, p.y) && dist(p, w.front) > 2.2) { t = p; break; } }
    }
    if (!t) return { ok: false, why: 'nowhere' };
    const sx = w.front.x, sy = w.front.y, L = Math.hypot(t.x - sx, t.y - sy);
    b.state = 'air'; b.x = sx; b.y = sy; b.z = 0.9; b.vx = b.vy = 0;
    b.flight = { sx, sy, tx: t.x, ty: t.y, p: 0, T: 0.55 + L * 0.07, h: 0.9 + L * 0.1, z0: 0.9 };
    if (sleeping(w)) return { ok: true, ignored: 'asleep', target: t };
    if (d.tired) { setPlan(w, 'rest', [...inPlace('attention', { toward: t, label: '看了一眼球，太困了' }), ...restPlan(w, 'tired')]); return { ok: true, ignored: 'tired', target: t }; }
    setPlan(w, 'fetch', [
      ...inPlace('attention', { toward: t, label: '看到球了！' }),
      { k: 'waitBall', label: '盯着球' },
      { k: 'chase', speed: 'run', label: '冲过去追球' },
      faceStep(null, null), { k: 'anim', action: 'pick_ball', label: '叼起球', onEvent: (w, e) => {
        if (e !== 'ball_pick') return true;
        if (dist(w.dog, w.ball) > REACH + 0.05 || w.ball.state === 'air') return false;
        w.ball.state = 'carried'; w.ball.vx = w.ball.vy = 0; w.dog.carrying = true; return true;
      } },
      { k: 'goto', to: callSpot(w), speed: 'walk', label: '叼着球回来' },
      ...dropBallSteps(),
      { k: 'wait', dur: 0.8, label: '摇尾巴等你再扔' },
    ]);
    // 叼球前转向：朝球那边
    const fs = w.dog.plan.find(s => s.k === 'face' && s.toward === null); if (fs) fs.towardBall = true;
    return { ok: true, target: t };
  }

  /* ---------- 搬家具（搬的时候小狗停下来等；放好后重算路径） ---------- */
  function setRearrange(w, on) {
    w.paused = !!on;
    if (!on && w.dog.step && (w.dog.step.k === 'goto' || w.dog.step.k === 'chase')) { w.dog.step.ver = -1; w.dog.step.progAt = w.t; }
    if (on) w.dog.label = w.dog.step && w.dog.step.k === 'sleep' ? '睡着呢（你搬你的）' : '停下来看你搬家具';
  }
  function canPlace(w, uid, x, y, rot) {
    const p = w.items.find(q => q.uid === uid); if (!p) return { ok: false, why: '没有这件' };
    if (!Number.isInteger(x) || !Number.isInteger(y)) return { ok: false, why: '位置不对' };
    rot = rot == null ? p.rot : rot;
    const s = sizeOf(w, { fid: p.fid, rot }), me = { x, y, w: s.w, h: s.h };
    if (x < 0 || y < 0 || x + s.w > w.cols || y + s.h > w.rows) return { ok: false, why: '超出房间' };
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const rug = isRug(w, p);
    for (const q of w.items) { if (q.uid === uid || isRug(w, q) !== rug) continue; if (ov(me, itemRect(w, q))) return { ok: false, why: '和' + w.byId[q.fid].name + '重叠' }; }
    if (!rug) {
      if (ov(me, w.bowl)) return { ok: false, why: '压到饭碗了' };
      if (ov(me, w.bed)) return { ok: false, why: '压到小狗的窝了' };
      if (rectDist(w.dog.x, w.dog.y, me) < CFG.R) return { ok: false, why: '小狗站在这儿' };
      if (w.ball.state !== 'carried' && rectDist(w.ball.x, w.ball.y, me) < CFG.BALL_R) return { ok: false, why: '压到球了' };
    }
    return { ok: true };
  }
  function moveItem(w, uid, x, y, rot) {
    const c = canPlace(w, uid, x, y, rot); if (!c.ok) return c;
    const p = w.items.find(q => q.uid === uid); p.x = x; p.y = y; if (rot != null) p.rot = rot;
    w.obsVer++;
    return { ok: true };
  }

  /* ---------- 存档 / 离线 ---------- */
  function serialize(w, nowMs) {
    const d = w.dog, b = w.ball;
    let bx = b.x, by = b.y;
    if (b.state === 'air' && b.flight) { bx = b.flight.tx; by = b.flight.ty; }
    return {
      v: CFG.SAVE_V, savedAt: nowMs, t: +w.t.toFixed(3), rs: w.rs,
      dog: { x: +d.x.toFixed(4), y: +d.y.toFixed(4), dir: d.dir, energy: +d.energy.toFixed(3), affinity: d.affinity, lastGain: d.lastGain, tired: d.tired, asleep: sleeping(w), lastEat: d.lastEat },
      ball: { x: +bx.toFixed(4), y: +by.toFixed(4), carried: b.state === 'carried' },
      items: w.items.map(p => ({ uid: p.uid, fid: p.fid, x: p.x, y: p.y, rot: p.rot })),
    };
  }
  // 回来：离线 = 自己在窝里休息（只回精力），不扣亲密、不动金币（本来就不接经济）、不复制小狗或球
  function restore(w, s, nowMs) {
    if (!s || s.v !== CFG.SAVE_V || !s.dog) return { ok: false };
    for (const it of s.items || []) {
      const p = w.items.find(q => q.uid === it.uid && q.fid === it.fid);
      if (p && Number.isInteger(it.x) && Number.isInteger(it.y)) { const ox = p.x, oy = p.y, orot = p.rot; p.x = it.x; p.y = it.y; p.rot = it.rot || 0; w.obsVer++; const c = canPlaceStatic(w, p); if (!c) { p.x = ox; p.y = oy; p.rot = orot; w.obsVer++; } }
    }
    const elapsed = clamp(((nowMs || 0) - (s.savedAt || 0)) / 1000, 0, 86400 * 30);
    const d = w.dog;
    w.t = (s.t || 0) + elapsed; if (s.rs) w.rs = s.rs >>> 0;
    d.affinity = Math.max(CFG.AFF0, Math.floor(s.dog.affinity || CFG.AFF0));
    d.lastGain = typeof s.dog.lastGain === 'number' ? s.dog.lastGain : -1e9;
    d.lastEat = typeof s.dog.lastEat === 'number' ? s.dog.lastEat : -1e9;
    const e0 = clamp(+s.dog.energy || CFG.ENERGY0, 0, 100);
    d.energy = Math.min(100, e0 + CFG.SLEEP_GAIN * elapsed);
    d.carrying = false; d.z = 0; d.plan = []; d.step = null;
    const bed = interactSpot(w, 'pet_bed');
    const inBed = (elapsed >= CFG.OFFLINE_BED_AFTER || s.dog.asleep) && bed && bed.free;
    if (inBed) {
      d.x = bed.spot.x; d.y = bed.spot.y; d.dir = 'E'; d.side = 'E';
      d.tired = d.energy < CFG.RESTED;
      setPlan(w, 'rest', [{ k: 'sleep', label: '在窝里睡着（你不在时自己休息了）' }, { k: 'anim', clip: 'getup', label: '你回来了，伸懒腰起来' }, { k: 'fn', fn: (w) => { w.dog.tired = false; } }]);
    } else {
      const p = nearestFreePoint(w, { x: +s.dog.x, y: +s.dog.y }, CFG.R, 4) || nearestFreePoint(w, callSpot(w), CFG.R, 4);
      d.x = p.x; d.y = p.y; d.dir = ['E', 'W', 'N', 'S'].includes(s.dog.dir) ? s.dog.dir : 'S'; d.tired = !!s.dog.tired && d.energy < CFG.RESTED;
      setPlan(w, 'idle', [{ k: 'wait', dur: 1, label: '你回来了' }]);
    }
    d.step = d.plan.shift(); startStep(w, d.step);   // 回来第一帧就是安全姿势（窝里睡 / 站着），不等下一帧
    const b = w.ball; b.state = 'floor'; b.z = 0; b.vx = b.vy = 0; b.flight = null;
    let bp = s.ball && !s.ball.carried ? { x: +s.ball.x, y: +s.ball.y } : { x: d.x + 0.4, y: d.y + 0.2 };
    bp = nearestFreePoint(w, bp, CFG.BALL_R, 4) || nearestFreePoint(w, { x: w.front.x + 1, y: w.front.y }, CFG.BALL_R, 6);
    b.x = bp.x; b.y = bp.y;
    return { ok: true, elapsed, energyGain: d.energy - e0, inBed: !!inBed };
  }
  function canPlaceStatic(w, p) {
    const s = sizeOf(w, p), me = { x: p.x, y: p.y, w: s.w, h: s.h };
    if (p.x < 0 || p.y < 0 || p.x + s.w > w.cols || p.y + s.h > w.rows) return false;
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const q of w.items) if (q !== p && isRug(w, q) === isRug(w, p) && ov(me, itemRect(w, q))) return false;
    if (!isRug(w, p) && (ov(me, w.bowl) || ov(me, w.bed))) return false;
    return true;
  }

  /* ---------- 给测试 / 渲染看的 ---------- */
  function snapshot(w) {
    const d = w.dog, b = w.ball;
    return {
      coords: '地板格，原点左后角，x→右，y→前（屏幕下方）', t: +w.t.toFixed(2), paused: w.paused,
      dog: { x: +d.x.toFixed(3), y: +d.y.toFixed(3), z: +d.z.toFixed(3), dir: d.dir, clip: d.anim.name, frame: d.anim.frame(), activity: d.activity, step: d.step ? d.step.k : null, label: d.label, energy: +d.energy.toFixed(2), affinity: d.affinity, tired: d.tired, carrying: b.state === 'carried' },
      ball: { x: +b.x.toFixed(3), y: +b.y.toFixed(3), z: +b.z.toFixed(3), state: b.state },
      items: w.items.map(p => ({ uid: p.uid, fid: p.fid, ...itemRect(w, p), solid: isSolid(w, p) })),
      stats: { ...w.stats }, recent: w.log.slice(-8).map(l => l.kind), incomeBonus: CFG.INCOME_BONUS,
    };
  }
  // 前后遮挡：按落地点 y 排（家具 = 占地前沿，小狗 / 球 = 落地点）；跳起来的高度不参与排序
  function drawOrder(w) {
    const list = [];
    for (const p of w.items) if (isSolid(w, p)) { const r = itemRect(w, p); list.push({ kind: 'item', uid: p.uid, y: r.y + r.h }); }
    list.push({ kind: 'bowl', uid: 'pet_bowl', y: w.bowl.y + w.bowl.h });
    list.push({ kind: 'dog', uid: 'dog', y: w.dog.y });
    if (w.ball.state !== 'carried') list.push({ kind: 'ball', uid: 'ball', y: w.ball.y });
    return list.sort((a, b) => a.y - b.y);
  }
  function overlapsFurniture(w, x, y) { return !circleFree(w, x, y, CFG.R - 1e-6) && x >= CFG.R - 1e-6 && y >= CFG.R - 1e-6 && x <= w.cols - CFG.R + 1e-6 && y <= w.rows - CFG.R + 1e-6; }
  function minClearance(w) { let m = Infinity; for (const o of obstacles(w)) m = Math.min(m, rectDist(w.dog.x, w.dog.y, o)); return m; }

  return { CFG, createWorld, update, step, call, pet, throwBall, setRearrange, moveItem, canPlace, serialize, restore, snapshot, drawOrder,
    planPath, reachable, circleFree, segClear, obstacles, itemRect, sizeOf, isSolid, isRug, interactSpot, minClearance, overlapsFurniture, rectDist, callSpot, grid };
});
