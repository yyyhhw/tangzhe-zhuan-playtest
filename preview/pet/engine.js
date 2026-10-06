/* 宠物原型 p3 — 小狗行为引擎（纯逻辑，不碰 DOM / localStorage，浏览器 / Node 通用）
   坐标：地板格，x 向右、y 向前（y=0 贴后墙），1 = 1 格；小狗位置 = 落地点（影子中心）。
   规则（熊大规格）：走 0.65 格/秒、跑 1.30、碰撞半径 0.22；精力起始 70，<35 优先休息、睡到 70 再活动；
   走/跑/玩 每秒 −0.06/−0.30/−0.20，睡觉 +0.80；亲密起始 40，有效互动 +1（60 秒冷却），离线 / 冷落永不扣；
   收益加成 0（不接经济）。只在「目标或障碍变了」时重算路径（带间隙网格 A* + 拉直）。
   p3：碰撞 = 脚下圆（半径 0.22）+ 按朝向的身体盒（横向范围来自 manifest.body 逐帧量出的鼻尖 / 尾巴尖，纵深 ±0.22）；
       互动目标绑定家具 uid，布局一变重算站位，目标没了 / 走不到就取消；读档整组恢复布局再统一查冲突。 */
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
      cfg: CFG, byId, manifest, interact, body: bodyBoxes(manifest),
      cols: room.cols, rows: room.rows, wallRows: room.wallRows || 2,
      front: { ...room.front }, bed: { ...room.bed }, bowl: room.bowl ? { ...room.bowl } : null,   // p4：接进家宅时没有碗（bowl:null）
      items: room.items.filter(p => byId[p.fid] && !byId[p.fid].wall).map((p, i) => ({ uid: p.uid || 'f' + i, fid: p.fid, x: p.x, y: p.y, rot: p.rot || 0 })),
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
    const sp = nearestDogPoint(w, w.dog, 3);
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
      if (w.bowl) w._obs.push({ ...w.bowl, uid: 'pet_bowl' });
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
  /* ---------- 身体盒（p3）：按朝向的地面占地，鼻尖 / 尾巴尖不进家具 ----------
     E/W：x 向前到鼻尖、向后到尾巴尖（W = E 镜像）；N/S：x 左右到耳朵 / 尾巴；纵深都 ±R。
     V = N∪S（规划用），H = 左右对称取大（站着能随便转身 / 原地动作用）。小狗自己的饭碗只按脚下圆算（吃饭时嘴要伸到碗上）。 */
  function bodyBoxes(m) {
    const k = m.runtime.displayTiles / m.source.frameSize[0], o = m.source.origin[0], b = m.body || {};
    const ext = (r) => r ? { l: (o - r[0]) * k, r: (r[1] - o) * k } : { l: CFG.R, r: CFG.R };
    const E = ext(b.E), N = ext(b.N), S = ext(b.S);
    const V = { l: Math.max(N.l, S.l), r: Math.max(N.r, S.r) }, hw = Math.max(E.l, E.r, V.l, V.r);
    return { E, W: { l: E.r, r: E.l }, N, S, V, H: { l: hw, r: hw }, D: CFG.R };
  }
  // 当前画出来的朝向：原地动作只画东向（西 = 镜像），所以 N/S 时播原地动作也按东向算
  function visDir(w) { const d = w.dog; return Art.IN_PLACE.includes(d.anim.name) ? (d.dir === 'W' ? 'W' : 'E') : d.dir; }
  function boxAt(w, x, y, cls) { const b = w.body[cls], D = w.body.D; return { x: x - b.l, y: y - D, w: b.l + b.r, h: 2 * D }; }
  const rectsOverlap = (a, b, e) => a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e;
  // tol > 0：运行时检查，贴边（浮点误差）不算压
  function bodyFree(w, x, y, cls, tol) {
    const e = tol || 0, bx = boxAt(w, x, y, cls);
    if (bx.x < -e || bx.y < -e || bx.x + bx.w > w.cols + e || bx.y + bx.h > w.rows + e) return false;
    if (!circleFree(w, x, y, CFG.R - e)) return false;
    for (const o of obstacles(w)) if (o.uid !== 'pet_bowl' && rectsOverlap(bx, o, e)) return false;
    return true;
  }
  // 这一段走的时候画哪个朝向：横向分量大于竖向 → 侧身 E/W，否则 N/S（45° 算竖着）。tickMove 用同一条规则（moveDir）
  function moveDir(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'); }
  function segCls(a, b) { const c = moveDir(b.x - a.x, b.y - a.y); return c === 'N' || c === 'S' ? 'V' : c; }
  function segBodyClear(w, a, b, cls) {
    if (!segClear(w, a, b, CFG.R)) return false;
    const bb = w.body[cls], D = w.body.D;
    for (const p of [a, b]) if (p.x - bb.l < 0 || p.x + bb.r > w.cols || p.y - D < 0 || p.y + D > w.rows) return false;
    const e = 1e-9;
    for (const o of obstacles(w)) {
      if (o.uid === 'pet_bowl') continue;
      if (segHitsRect(a.x, a.y, b.x, b.y, { x: o.x - bb.r + e, y: o.y - D + e, w: o.w + bb.l + bb.r - 2 * e, h: o.h + 2 * D - 2 * e })) return false;
    }
    return true;
  }
  const segOK = (w, a, b) => segBodyClear(w, a, b, segCls(a, b));
  // 小狗身体盒压到实体家具（测试 / 调试用）
  function bodyOverlap(w) { return !bodyFree(w, w.dog.x, w.dog.y, visDir(w), 1e-6); }

  /* ---------- 网格 A*（带间隙） ---------- */
  function grid(w) {
    obstacles(w);
    if (w._grid) return w._grid;
    const R = CFG.RES, nx = Math.round(w.cols / R), ny = Math.round(w.rows / R), free = new Uint8Array(nx * ny), freeH = new Uint8Array(nx * ny);
    // free = 竖着（N/S 身体盒）站得下；freeH = 横着（E/W，左右对称取大）也站得下 → 能在这儿转身 / 播原地动作
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = (i + 0.5) * R, y = (j + 0.5) * R; free[j * nx + i] = bodyFree(w, x, y, 'V') ? 1 : 0; freeH[j * nx + i] = free[j * nx + i] && bodyFree(w, x, y, 'H') ? 1 : 0; }
    w._grid = { nx, ny, free, freeH, R };
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
  function nearestDogPoint(w, p, maxD) {
    if (bodyFree(w, p.x, p.y, 'H')) return { x: p.x, y: p.y };
    for (let r = 0.05; r <= (maxD || 3); r += 0.05)
      for (let a = 0; a < 24; a++) { const x = p.x + Math.cos(a / 24 * 6.2832) * r, y = p.y + Math.sin(a / 24 * 6.2832) * r; if (bodyFree(w, x, y, 'H')) return { x, y }; }
    return nearestFreePoint(w, p, CFG.R, maxD);
  }
  function astar(w, s, goal) {
    const g = grid(w), N = g.nx * g.ny, gs = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const gx = goal % g.nx, gy = Math.floor(goal / g.nx);
    const h = (n) => { const dx = Math.abs(n % g.nx - gx), dy = Math.abs(Math.floor(n / g.nx) - gy); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)); };
    const heap = [];
    const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gs[s] = 0; push(s, h(s));
    const midFree = (a, b) => segOK(w, nodePt(g, a), nodePt(g, b));
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
    let fin = bodyFree(w, to.x, to.y, 'V') ? { x: to.x, y: to.y } : null;
    if (!fin) { const c = nearestNodes(w, to, near == null ? 0.6 : near, 1)[0]; if (!c) return null; fin = c.q; }
    if (segOK(w, from, fin)) return [fin];
    const starts = nearestNodes(w, from, 0.9, 12).filter(c => segOK(w, from, c.q));
    if (!starts.length) return null;
    const goals = nearestNodes(w, fin, 0.6, 6).filter(c => segOK(w, c.q, fin));
    if (!goals.length) return null;
    const path = astar(w, starts[0].n, goals[0].n);
    if (!path) return null;
    const g = grid(w);
    const pts = [{ x: from.x, y: from.y }, ...path.map(n => nodePt(g, n)), fin];
    const out = []; let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !segOK(w, pts[i], pts[j])) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  }
  function reachable(w, from, to, near) { return !!planPath(w, from, to, near); }

  /* ---------- 互动点（只有 INTERACT 里配了的才有） ---------- */
  // 家具互动绑定 uid（同款摆两件也不会认错）；不给 uid 就找第一件这个款的
  // 站位：cfg.nose = 鼻尖相对占地左上角的位置（按身体盒倒推脚下站位，鼻尖刚好贴到不进图）；cfg.spot = 直接给脚下站位（自己的窝 / 碗）
  function interactSpot(w, key, uid) {
    const cfg = w.interact[key]; if (!cfg) return null;
    let base, item = null;
    if (key === 'pet_bed') base = w.bed; else if (key === 'pet_bowl') { base = w.bowl; if (!base) return null; }
    else { item = uid ? w.items.find(q => q.uid === uid && q.fid === key) : w.items.find(q => q.fid === key); if (!item) return null; base = itemRect(w, item); }
    const face = cfg.face || 'E', fb = w.body[face];
    const spot = cfg.nose ? { x: base.x + cfg.nose[0] + (face === 'W' ? fb.l : -fb.r), y: base.y + cfg.nose[1] } : { x: base.x + cfg.spot[0], y: base.y + cfg.spot[1] };
    return { key, uid: item ? item.uid : key, cfg, spot, center: { x: base.x + base.w / 2, y: base.y + base.h / 2 }, free: bodyFree(w, spot.x, spot.y, face) && bodyFree(w, spot.x, spot.y, 'V') };
  }

  /* ---------- 计划 / 步骤 ---------- */
  // tgt：这个计划绑定的家具目标（visit 用）；换计划就解绑
  function setPlan(w, kind, steps, label, tgt) {
    const d = w.dog;
    if (d.step && d.step.k === 'sleep' && kind !== 'rest') d.lastWake = w.t;
    d.plan = steps; d.step = null; d.activity = kind; if (label) d.label = label;
    d.tgt = tgt || null;
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
    if (s && s.free && reachable(w, w.dog, s.spot, 0.05)) steps.push({ k: 'goto', to: s.spot, speed: 'walk', label: why === 'tired' ? '困了，慢慢走回小窝' : '想回窝眯一会' });   // p4a：窝走不到（死胡同）就原地休息，不反复撞
    steps.push(faceStep('E'), { k: 'anim', clip: 'liedown', label: '趴下' }, { k: 'sleep', label: '呼呼睡' }, { k: 'anim', clip: 'getup', label: '伸个懒腰起来' }, { k: 'fn', fn: (w) => { w.dog.tired = false; } });
    return steps;
  }
  function randomSpot(w, minD) {
    for (let i = 0; i < 40; i++) {
      const p = { x: rr(w, 0.4, w.cols - 0.4), y: rr(w, 0.4, w.rows - 0.4) };
      if (!circleFree(w, p.x, p.y, CFG.R + 0.04) || !bodyFree(w, p.x, p.y, 'H')) continue;   // 到了要原地闻，左右都转得开
      if (dist(p, w.dog) < (minD || 1.5)) continue;
      if (w.failed.some(f => f.until > w.t && dist(f, p) < 1)) continue;
      return p;
    }
    return null;
  }
  /* ---------- 互动目标（p3）：绑定家具 uid，布局一变就重算站位 ---------- */
  function visitSteps(w, s, stay, label) {
    const steps = [{ k: 'goto', to: { ...s.spot }, tgt: true, speed: 'walk', label: label || '去' + s.cfg.label + '那边看看' }, faceStep(s.cfg.face || 'E'), { k: 'anim', clip: 'sniff', label: '闻闻' + s.cfg.label + '（有猫味？）' }];
    if (stay) steps.push({ k: 'anim', clip: 'sniff', label: '再闻闻' + s.cfg.label }, { k: 'wait', dur: rr(w, 2, 4), label: '守在' + s.cfg.label + '旁边' });
    return steps;
  }
  // 测试 / 以后正式接入用：让它去某件家具（按 uid）
  function visit(w, uid, stay) {
    const p = w.items.find(q => q.uid === uid); if (!p || !w.interact[p.fid]) return { ok: false, why: 'noInteract' };
    const s = interactSpot(w, p.fid, uid); if (!s || !s.free || !reachable(w, w.dog, s.spot, 0.05)) return { ok: false, why: 'unreachable' };
    setPlan(w, 'visit', visitSteps(w, s, stay !== false), null, { uid, key: p.fid, spot: { ...s.spot }, ver: w.obsVer });
    return { ok: true, spot: s.spot };
  }
  function cancelTarget(w, why) {
    const d = w.dog; w.stats.tgtCancel = (w.stats.tgtCancel || 0) + 1;
    setPlan(w, 'confused', [...inPlace('attention', { label: why }), { k: 'wait', dur: 0.6 }]); fx(w, 'q');
  }
  // 布局变了（obsVer 变）：目标家具还在吗、站位挪了吗、还走得到吗
  function checkTarget(w) {
    const d = w.dog, T = d.tgt; if (!T || T.ver === w.obsVer) return;
    T.ver = w.obsVer; w.stats.tgtChecks = (w.stats.tgtChecks || 0) + 1;
    const s = interactSpot(w, T.key, T.uid), label = (w.interact[T.key] || {}).label || '那件家具';
    if (!s) return cancelTarget(w, label + '不见了，愣了一下');
    if (!s.free || !reachable(w, d, s.spot, 0.05)) return cancelTarget(w, label + '挪到过不去的地方了，算了');
    if (dist(s.spot, T.spot) < 1e-6) return;   // 别的家具动了，站位没变
    T.spot = { ...s.spot }; w.stats.tgtMoved = (w.stats.tgtMoved || 0) + 1;
    if (d.step && d.step.k === 'goto' && d.step.tgt) { d.step.to = { ...s.spot }; d.step.path = null; d.step.ver = -1; d.step.progAt = w.t; d.step.progPos = { x: d.x, y: d.y }; return; }
    // 已经在闻 / 守着了：跟到新位置重新闻（旧位置不再闻）
    setPlan(w, 'visit', visitSteps(w, s, false, label + '挪地方了，跟过去'), null, T);
  }

  // 自己待着时挑下一件事：按个性 + 精力加权，最近做过的降权（让它像在「有目的地过日子」）
  function choose(w) {
    const d = w.dog, P = CFG.PERSONALITY;
    // 兜底：计划被打断（抚摸 / 过不去 / 其他）后嘴里还叼着球 → 先原地放下，绝不留下「一直叼着」
    if (w.ball.state === 'carried') { setPlan(w, 'dropBall', dropHereSteps('嘴里还叼着球，先放下')); return; }
    if (d.tired || d.energy < CFG.TIRED) { d.tired = true; setPlan(w, 'rest', restPlan(w, 'tired')); return; }
    const opts = [];
    const add = (kind, wt, build) => { if (wt > 0) opts.push({ kind, wt, build }); };
    add('explore', 0.55 + 0.6 * P.curious, () => {
      const p = randomSpot(w, 1.8); if (!p) return null;
      const steps = [{ k: 'goto', to: p, speed: 'walk', label: '到处转转' }, { k: 'wait', dur: rr(w, 0.4, 0.9), label: '东张西望' }, ...inPlace('sniff', { label: '低头闻闻地板' })];
      if (rnd(w) < P.curious * 0.55) steps.push({ k: 'wait', dur: rr(w, 2, 4.5), label: '在这儿待一会' });
      return steps;
    });
    const visits = w.items.filter(p => p.fid.startsWith('furn_') && w.interact[p.fid]).map(p => interactSpot(w, p.fid, p.uid)).filter(s => s && s.free && !w.failed.some(f => f.until > w.t && dist(f, s.spot) < 0.5));
    if (visits.length) add('visit', 0.9 * P.curious, () => {
      const s = visits[Math.floor(rnd(w) * visits.length)];
      return { steps: visitSteps(w, s, rnd(w) < (s.cfg.stay || 0.5)), tgt: { uid: s.uid, key: s.key, spot: { ...s.spot }, ver: w.obsVer } };
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
      if (r <= 0) { const b = o.build(); if (b) { if (Array.isArray(b)) setPlan(w, o.kind, b); else setPlan(w, o.kind, b.steps, null, b.tgt); return; } }
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
  const REACH = CFG.R + CFG.BALL_R + 0.32;
  // 叼球 / 拨球站位：站在球的左边或右边、侧身朝球（原地动作只画侧面），身体盒不进家具
  const sideTowardBall = (w, p) => (w.ball.x >= p.x ? 'E' : 'W');
  const ballPoseOK = (w, p) => dist(p, w.ball) <= REACH - 0.01 && bodyFree(w, p.x, p.y, 'V') && (bodyFree(w, p.x, p.y, sideTowardBall(w, p)) || bodyFree(w, p.x, p.y, sideTowardBall(w, p) === 'E' ? 'W' : 'E'));
  // 球停在 p 时有没有能叼的侧身站位（抛球挑落点用）
  function pickableAt(w, p) {
    for (const off of [0.46, 0.54, 0.62]) for (const dy of [0, 0.12, -0.12, 0.22, -0.22]) for (const sg of [-1, 1]) {
      const q = { x: p.x + sg * off, y: p.y + dy };
      if (Math.hypot(off, dy) <= REACH - 0.02 && bodyFree(w, q.x, q.y, 'V') && bodyFree(w, q.x, q.y, sg < 0 ? 'E' : 'W')) return true;
    }
    return false;
  }
  function ballApproach(w, cur) {
    const b = w.ball, d = w.dog;
    if (cur && ballPoseOK(w, cur)) return cur;
    let best = null;
    for (const off of [0.46, 0.54, 0.62]) for (const dy of [0, 0.12, -0.12, 0.22, -0.22]) for (const sg of [-1, 1]) {
      const p = { x: b.x + sg * off, y: b.y + dy };
      if (Math.hypot(off, dy) > REACH - 0.02 || !bodyFree(w, p.x, p.y, 'V') || !bodyFree(w, p.x, p.y, sg < 0 ? 'E' : 'W')) continue;
      const c = dist(p, d) + off * 0.5 + Math.abs(dy);
      if (!best || c < best.c) best = { p, c };
    }
    if (best) return best.p;
    if (b.state === 'floor') return null;   // 球停在左右都放不下侧身的地方：叼不了 → 放弃（不硬挤）
    const c = nearestNodes(w, b, 0.62, 1)[0];
    return c ? c.q : { x: b.x, y: b.y };
  }

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
        let want = faceWant(w, s);
        // 转过去鼻子 / 尾巴会进家具：侧面就换另一侧；还不行就不转（runDog 会先挪到宽敞处）
        if (!bodyFree(w, d.x, d.y, want, 1e-9)) {
          const alt = want === 'E' ? 'W' : want === 'W' ? 'E' : null;
          want = !s.dir && alt && bodyFree(w, d.x, d.y, alt, 1e-9) ? alt : d.dir;
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
      case 'sleep': if (s.upright) playAnim(w, 'idle'); else d.anim.play('sleep', { loop: true }); fx(w, 'zz'); break;
    }
  }
  function faceWant(w, s) {
    const d = w.dog; let want = s.dir;
    if (!want) {   // 侧面：朝目标那边；没目标就沿用上次的侧面
      const tx = s.toward ? s.toward.x : null;
      want = tx != null && Math.abs(tx - d.x) > 0.05 ? (tx > d.x ? 'E' : 'W') : (d.dir === 'E' || d.dir === 'W' ? d.dir : d.side);
      if (s.towardBall) want = w.ball.x >= d.x ? 'E' : 'W';
    }
    return want;
  }
  // 要转侧身但这里左右都放不下身子（比如卡在竖向窄道）：先挪到最近的宽敞处（走得到的才去）
  function faceFix(w, s) {
    if (s.k !== 'face' || s.fixed) return null; s.fixed = true;
    const d = w.dog, want = faceWant(w, s);
    if (want === 'N' || want === 'S') return null;
    if (bodyFree(w, d.x, d.y, want, 1e-9) || (!s.dir && bodyFree(w, d.x, d.y, want === 'E' ? 'W' : 'E', 1e-9))) return null;
    const g = grid(w);
    for (const c of nearestNodes(w, d, 1.8).filter(c => g.freeH[c.n]).slice(0, 6)) if (planPath(w, d, c.q, 0)) { w.stats.reloc = (w.stats.reloc || 0) + 1; return { k: 'goto', to: c.q, speed: 'walk', label: '挪到宽敞点的地方' }; }
    return null;
  }
  /* ---------- 侧身守卫（p4a，熊大 p3 复核：1 格宽竖走廊里转不开身还播侧身动作，身体两侧穿墙） ----------
     原地动作（抚摸 / 张望 / 闻 / 蹦 / 拨球 / 吃 / 趴下 / 睡 / 起身 / 叼放球）只画侧面：开播前统一查侧身身体盒。
     顺序：当前侧面放得下 → 播；另一侧放得下 → 换那侧播；都放不下 → 自主类动作先挪到整间屋最近、走得到的能转身处再播（每步只挪一次）；
     还不行（死胡同 / 被围住）→ 保持原朝向（南北站姿，身体盒本来就合法）用替代：抚摸 = 原地摇尾巴（照样冒爱心、加亲密），放球 = 直接放下，
     睡觉 = 站着打盹（照样回精力），其余（张望 / 闻 / 蹦 / 拨球 / 吃 / 趴下 / 起身）= 取消，只站一下。抚摸 / 呼唤 / 抛球 / 自主行为都走这里。 */
  const stepClip = (w, s) => s.k === 'sleep' ? (s.upright ? null : 'sleep') : s.k === 'anim' ? (s.action ? w.manifest.actions[s.action].clip : s.clip) : null;
  const NO_DEFER = ['petted', 'attention', 'getup'];   // 抚摸 / 回应你 / 起身：当场就要回应，不为了转身走开
  // 按「走过去的路程」找最近的能转身格（网格 Dijkstra，和 A* 同样的邻接 / 不切角 / 段检查）；走不到返回 null
  function turnSpot(w) {
    const d = w.dog, g = grid(w), N = g.nx * g.ny;
    const st = nearestNodes(w, d, 0.9, 12).filter(c => segOK(w, d, c.q)); if (!st.length) return null;
    const dist0 = new Float64Array(N).fill(Infinity), done = new Uint8Array(N), heap = [];
    const push = (n, f) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (const c of st) if (c.d < dist0[c.n]) { dist0[c.n] = c.d; push(c.n, c.d); }
    while (heap.length) {
      const [f, n] = pop(); if (done[n]) continue; done[n] = 1;
      if (g.freeH[n]) { const q = nodePt(g, n); return planPath(w, d, q, 0) ? q : null; }
      const i = n % g.nx, j = Math.floor(n / g.nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= g.nx || b >= g.ny) continue;
        const m = b * g.nx + a; if (!g.free[m] || done[m]) continue;
        if (di && dj && (!g.free[j * g.nx + a] || !g.free[b * g.nx + i])) continue;
        if (!segOK(w, nodePt(g, n), nodePt(g, m))) continue;
        const nf = f + (di && dj ? Math.SQRT2 : 1) * g.R; if (nf < dist0[m]) { dist0[m] = nf; push(m, nf); }
      }
    }
    return null;
  }
  function upright(w) {   // 保持原朝向：南北站姿（身体盒最窄）；原来就是南北就不动
    const d = w.dog;
    for (const dir of [d.dir === 'N' || d.dir === 'S' ? d.dir : null, 'S', 'N']) if (dir && bodyFree(w, d.x, d.y, dir, 1e-9)) { d.dir = dir; return; }
  }
  function sideGuard(w, s) {
    const clip = stepClip(w, s); if (!clip || !Art.IN_PLACE.includes(clip)) return null;
    const d = w.dog, side = d.dir === 'W' ? 'W' : 'E', alt = side === 'E' ? 'W' : 'E';
    if (bodyFree(w, d.x, d.y, side, 1e-9)) { if (d.dir !== side) { d.dir = side; d.side = side; } return null; }
    if (bodyFree(w, d.x, d.y, alt, 1e-9)) { d.dir = alt; d.side = alt; w.stats.sideFlip = (w.stats.sideFlip || 0) + 1; return null; }
    const ballStep = s.action === 'pick_ball' || s.action === 'drop_ball' || s.towardBall;
    if (!s.sideTried && !ballStep && !NO_DEFER.includes(clip)) {
      s.sideTried = true; const q = turnSpot(w);
      if (q) { w.stats.sideDefer = (w.stats.sideDefer || 0) + 1; d.plan.unshift(faceStep(side), s); return { k: 'goto', to: q, speed: 'walk', label: '这儿转不开身，挪到宽敞点再' + (clip === 'sniff' ? '闻' : clip === 'liedown' || clip === 'sleep' ? '躺' : '玩') }; }
    }
    w.stats.sideBlocked = (w.stats.sideBlocked || 0) + 1; upright(w);
    if (clip === 'petted') return { k: 'fn', fn: (w) => { const d = w.dog; d.label = '窄道里转不开身，站着摇尾巴让你摸'; d.petCdUntil = w.t + CFG.PET_CD; w.stats.petStarts++; fx(w, 'heart'); } };
    if (s.action === 'drop_ball') return { k: 'fn', fn: dropBall };
    if (clip === 'sleep') return { k: 'sleep', upright: true, label: '转不开身，站着打个盹' };
    return { k: 'wait', dur: clip === 'liedown' || clip === 'getup' ? 0 : 0.5, label: s.label ? '转不开身：' + s.label.replace(/^(转不开身：)+/, '') + '（先不做）' : '这儿转不开身' };
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
        if (s.look === 'random' && w.t >= s.nextLook) { const ds = ['E', 'W', 'S', 'N', 'S'], nd = ds[Math.floor(rnd(w) * ds.length)]; if (bodyFree(w, d.x, d.y, nd, 1e-9)) { d.dir = nd; if (nd === 'E' || nd === 'W') d.side = nd; } s.nextLook = w.t + rr(w, 0.8, 1.6); }
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
        if (s.upright) playAnim(w, 'idle');
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
      if (ballPoseOK(w, d)) { s.goal = null; return 'done'; }
      const g = ballApproach(w, s.goal);
      if (!g) { w.stats.ballNoPose = (w.stats.ballNoPose || 0) + 1; w.failed.push({ x: w.ball.x, y: w.ball.y, until: w.t + 15 }); return 'fail'; }
      if (!s.goal || dist(g, s.goal) > 0.3) { s.goal = g; s.path = null; }
    } else s.goal = s.to;
    if (!s.path || s.ver !== w.obsVer) {
      if (s.path) w.stats.replans++;
      s.path = planPath(w, d, s.goal, s.near); s.ver = w.obsVer;
      if (!s.progPos) { s.progAt = w.t; s.progPos = { x: d.x, y: d.y }; }   // 重算路径不清进度计时（追球时目标一直变也逃不过 2.5 秒保险）
      if (!s.path) { w.failed.push({ x: s.goal.x, y: s.goal.y, until: w.t + 15 }); if (w.failed.length > 20) w.failed.shift(); return 'fail'; }
    }
    const spd = s.speed === 'run' ? CFG.RUN : CFG.WALK;
    let budget = spd * dt; const ox = d.x, oy = d.y;
    while (budget > 1e-9 && s.path.length) {
      const wp = s.path[0], dx = wp.x - d.x, dy = wp.y - d.y, L = Math.hypot(dx, dy);
      if (L < 1e-6) { s.path.shift(); continue; }
      // 朝向按「正在走的这一段」定（整段直线，朝向不会来回闪）；和规划时 segCls 同一条规则，规划查过的身体盒就是实际画的
      const nd = moveDir(dx, dy);
      const stepL = Math.min(L, budget), nx = d.x + dx / L * stepL, ny = d.y + dy / L * stepL;
      if (!bodyFree(w, nx, ny, nd, 1e-9)) { s.path = null; s.ver = -1; break; }   // 被挡（障碍刚变过）→ 下帧重算
      d.dir = nd; if (nd === 'E' || nd === 'W') d.side = nd;
      d.x = nx; d.y = ny; budget -= stepL;
      if (stepL >= L - 1e-9) s.path.shift();
    }
    const moved = Math.hypot(d.x - ox, d.y - oy);
    // 保险：2.5 秒没往前走 0.05 格就当这条路不通，停下换目标（不硬挤、不瞬移）
    if (dist(d, s.progPos) > 0.05) { s.progPos = { x: d.x, y: d.y }; s.progAt = w.t; }
    else if (w.t - s.progAt > 2.5) { w.stats.stuck = (w.stats.stuck || 0) + 1; w.failed.push({ x: s.goal.x, y: s.goal.y, until: w.t + 15 }); return 'fail'; }
    if (moved > 1e-6) {
      d.drainMode = s.speed;
      playAnim(w, s.speed === 'run' ? 'run' : 'walk'); d.anim.tick(dt);
    } else if (s.path) { playAnim(w, 'idle'); d.anim.tick(dt); }
    if (s.path && !s.path.length) return s.k === 'chase' ? (ballPoseOK(w, d) ? 'done' : (s.path = null, s.goal = null, 'run')) : 'done';
    return 'run';
  }
  function runDog(w, dt) {
    const d = w.dog;
    checkTarget(w);
    for (let guard = 0; guard < 6; guard++) {
      if (!d.step) {
        if (!d.plan.length) { if (w.paused) { playAnim(w, 'idle'); d.anim.tick(dt); return; } choose(w); }
        d.step = d.plan.shift();
        const fix = faceFix(w, d.step); if (fix) { d.plan.unshift(d.step); d.step = fix; }
        const alt = sideGuard(w, d.step); if (alt) d.step = alt;   // p4a：侧身动作开播前查侧身身体盒
        startStep(w, d.step);
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
    return [faceStep(null), { k: 'anim', action: 'drop_ball', label: '把球放你面前', onEvent: (w, e) => { if (e === 'ball_drop') dropBall(w); } }];
  }
  // 原地放球（不走去你面前）：放球动作 + 兜底 fn（动作被打断 / 没触发事件也一定放下）
  function dropHereSteps(label) {
    return [faceStep(null), { k: 'anim', action: 'drop_ball', label: label || '把球放下', onEvent: (w, e) => { if (e === 'ball_drop') dropBall(w); } }, { k: 'fn', fn: dropBall }];
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
    const steps = [], carrying = w.ball.state === 'carried';
    if (how === 'button' && dist(d, callSpot(w)) > 1.2) steps.push(...inPlace('attention', { toward: callSpot(w), label: '听到你要摸它' }), { k: 'goto', to: callSpot(w), speed: 'walk', label: carrying ? '叼着球凑过来让你摸' : '凑过来让你摸' });
    // 叼着球被摸：先安全放球（在你面前就算送回），再被摸；摸完球在地上，可以再抛
    if (carrying) steps.push(...(dist(d, callSpot(w)) <= 1.2 || how === 'button' ? [...dropBallSteps(), { k: 'fn', fn: dropBall }] : dropHereSteps('先把球放下')));
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
      for (let i = 0; i < 80; i++) {
        const p = { x: rr(w, 0.4, w.cols - 0.4), y: rr(w, 0.5, w.rows - 1.4) }; if (!ballFree(w, p.x, p.y) || dist(p, w.front) <= 2.2) continue;
        // 落地后还会顺着飞的方向滚约 0.25 格：落点和滚停点都要叼得到（不往窄缝里扔）
        const L = Math.hypot(p.x - w.front.x, p.y - w.front.y) || 1, q = { x: p.x + (p.x - w.front.x) / L * 0.26, y: p.y + (p.y - w.front.y) / L * 0.26 };
        if (i < 60 && !(pickableAt(w, p) && pickableAt(w, q))) continue;
        t = p; break;
      }
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
      if (w.bowl && ov(me, w.bowl)) return { ok: false, why: '压到饭碗了' };
      if (ov(me, w.bed)) return { ok: false, why: '压到小狗的窝了' };
      if (rectDist(w.dog.x, w.dog.y, me) < CFG.R || rectsOverlap(boxAt(w, w.dog.x, w.dog.y, visDir(w)), me, 0)) return { ok: false, why: '小狗站在这儿' };
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

  /* ---------- 外部布局同步（p4：家宅里摆设 / 升级房子都在游戏那边改，这里整组换上） ----------
     items 带 uid（沿用家宅里的 uid，互动目标照样按 uid 跟）；dims 变了（升级）一起换；
     小狗 / 球被新家具压住就挪到最近空地（家宅的摆放规则不认识小狗），正在做的事交给 checkTarget / 重算路径。 */
  function setLayout(w, lay) {
    if (lay.cols) w.cols = lay.cols; if (lay.rows) w.rows = lay.rows;
    if (lay.front) w.front = { ...lay.front };
    if (lay.bed) w.bed = { ...lay.bed };
    w.items = (lay.items || []).filter(p => w.byId[p.fid] && !w.byId[p.fid].wall).map((p, i) => ({ uid: p.uid || 'f' + i, fid: p.fid, x: p.x, y: p.y, rot: p.rot || 0 }));
    w.obsVer++;
    const d = w.dog; let moved = false;
    if (!bodyFree(w, d.x, d.y, visDir(w), 1e-6)) {
      const p = nearestDogPoint(w, d, Math.max(w.cols, w.rows)); if (p) { d.x = p.x; d.y = p.y; moved = true; }
      if (w.ball.state === 'carried') { /* 嘴里的球跟着走 */ }
      setPlan(w, 'confused', [...inPlace('attention', { label: '家具搬过来了，挪个地方' }), { k: 'wait', dur: 0.6 }]); fx(w, 'q');
    }
    const b = w.ball;
    if (b.state !== 'carried' && !ballFree(w, b.x, b.y)) { const q = nearestFreePoint(w, b, CFG.BALL_R, Math.max(w.cols, w.rows)); if (q) { b.x = q.x; b.y = q.y; b.vx = b.vy = 0; if (b.state === 'air') { b.state = 'floor'; b.flight = null; b.z = 0; } } }
    return { ok: true, dogMoved: moved };
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
    const layout = restoreLayout(w, s.items);
    const elapsed = clamp(((nowMs || 0) - (s.savedAt || 0)) / 1000, 0, 86400 * 30);
    const d = w.dog;
    w.t = (s.t || 0) + elapsed; if (s.rs) w.rs = s.rs >>> 0;
    d.affinity = Math.max(CFG.AFF0, Math.floor(s.dog.affinity || CFG.AFF0));
    d.lastGain = typeof s.dog.lastGain === 'number' ? s.dog.lastGain : -1e9;
    d.lastEat = typeof s.dog.lastEat === 'number' ? s.dog.lastEat : -1e9;
    // 只认有限数值：合法的 0 保留为 0（不当成缺失）；缺失 / 非数字 / NaN / 无穷 才用默认 70。离线休息另算
    const e0 = typeof s.dog.energy === 'number' && Number.isFinite(s.dog.energy) ? clamp(s.dog.energy, 0, 100) : CFG.ENERGY0;
    d.energy = Math.min(100, e0 + CFG.SLEEP_GAIN * elapsed);
    d.carrying = false; d.z = 0; d.plan = []; d.step = null;
    const bed = interactSpot(w, 'pet_bed');
    const inBed = (elapsed >= CFG.OFFLINE_BED_AFTER || s.dog.asleep) && bed && bed.free;
    if (inBed) {
      d.x = bed.spot.x; d.y = bed.spot.y; d.dir = 'E'; d.side = 'E';
      d.tired = d.energy < CFG.RESTED;
      setPlan(w, 'rest', [{ k: 'sleep', label: '在窝里睡着（你不在时自己休息了）' }, { k: 'anim', clip: 'getup', label: '你回来了，伸懒腰起来' }, { k: 'fn', fn: (w) => { w.dog.tired = false; } }]);
    } else {
      const p = nearestDogPoint(w, { x: +s.dog.x, y: +s.dog.y }, 4) || nearestDogPoint(w, callSpot(w), 4);
      d.x = p.x; d.y = p.y; d.dir = ['E', 'W', 'N', 'S'].includes(s.dog.dir) ? s.dog.dir : 'S'; d.tired = (!!s.dog.tired || d.energy < CFG.TIRED) && d.energy < CFG.RESTED;
      setPlan(w, 'idle', [{ k: 'wait', dur: 1, label: '你回来了' }]);
    }
    d.step = d.plan.shift(); startStep(w, d.step);   // 回来第一帧就是安全姿势（窝里睡 / 站着），不等下一帧
    const b = w.ball; b.state = 'floor'; b.z = 0; b.vx = b.vy = 0; b.flight = null;
    let bp = s.ball && !s.ball.carried ? { x: +s.ball.x, y: +s.ball.y } : { x: d.x + 0.4, y: d.y + 0.2 };
    bp = nearestFreePoint(w, bp, CFG.BALL_R, 4) || nearestFreePoint(w, { x: w.front.x + 1, y: w.front.y }, CFG.BALL_R, 6);
    b.x = bp.x; b.y = bp.y;
    return { ok: true, elapsed, energyGain: d.energy - e0, inBed: !!inBed, reverted: layout.reverted };
  }
  // p3 读档布局：先把存档里的位置整组放上（合法交换 / 轮换都成立），再统一查冲突；
  // 只把真正有问题的件放回默认位：先查单件（出界 / 压窝压碗），再处理两两重叠——每轮挑冲突最多的「不在默认位」的件放回，
  // 平手时优先放回「默认位空着」的那件，再按 uid；结果和存档里的记录顺序无关。
  function restoreLayout(w, saved) {
    const def = {}; for (const p of w.items) def[p.uid] = { x: p.x, y: p.y, rot: p.rot };
    const atDef = (p) => p.x === def[p.uid].x && p.y === def[p.uid].y && p.rot === def[p.uid].rot;
    const back = (p) => { Object.assign(p, def[p.uid]); reverted.push(p.uid); };
    const reverted = [];
    for (const it of Array.isArray(saved) ? saved : []) {
      const p = it && w.items.find(q => q.uid === it.uid && q.fid === it.fid);
      if (p && Number.isInteger(it.x) && Number.isInteger(it.y)) { p.x = it.x; p.y = it.y; p.rot = it.rot === 1 || it.rot === 2 || it.rot === 3 ? it.rot : 0; }
    }
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    for (const p of w.items) {
      const r = itemRect(w, p);
      if (!atDef(p) && (r.x < 0 || r.y < 0 || r.x + r.w > w.cols || r.y + r.h > w.rows || (!isRug(w, p) && ((w.bowl && ov(r, w.bowl)) || ov(r, w.bed))))) back(p);
    }
    const conflicts = (p, at) => { const r = at ? itemRect(w, { ...p, ...at }) : itemRect(w, p); let n = 0; for (const q of w.items) if (q !== p && isRug(w, q) === isRug(w, p) && ov(r, itemRect(w, q))) n++; return n; };
    const uidN = (u) => parseInt(String(u).replace(/\D/g, ''), 10) || 0;
    for (let guard = 0; guard <= w.items.length; guard++) {
      const cand = w.items.filter(p => !atDef(p)).map(p => ({ p, n: conflicts(p) })).filter(c => c.n > 0);
      if (!cand.length) break;
      for (const c of cand) c.defFree = conflicts(c.p, def[c.p.uid]) === 0 ? 1 : 0;
      cand.sort((a, b) => (b.n - a.n) || (b.defFree - a.defFree) || (uidN(a.p.uid) - uidN(b.p.uid)));
      back(cand[0].p);
    }
    w.obsVer++;
    return { reverted };
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
    if (w.bowl) list.push({ kind: 'bowl', uid: 'pet_bowl', y: w.bowl.y + w.bowl.h });
    list.push({ kind: 'dog', uid: 'dog', y: w.dog.y });
    if (w.ball.state !== 'carried') list.push({ kind: 'ball', uid: 'ball', y: w.ball.y });
    return list.sort((a, b) => a.y - b.y);
  }
  function overlapsFurniture(w, x, y) { return !circleFree(w, x, y, CFG.R - 1e-6) && x >= CFG.R - 1e-6 && y >= CFG.R - 1e-6 && x <= w.cols - CFG.R + 1e-6 && y <= w.rows - CFG.R + 1e-6; }
  function minClearance(w) { let m = Infinity; for (const o of obstacles(w)) m = Math.min(m, rectDist(w.dog.x, w.dog.y, o)); return m; }

  return { CFG, createWorld, update, step, call, pet, throwBall, setRearrange, moveItem, canPlace, serialize, restore, restoreLayout, setLayout, snapshot, drawOrder, visit, nearestDogPoint,
    planPath, reachable, circleFree, segClear, obstacles, itemRect, sizeOf, isSolid, isRug, interactSpot, minClearance, overlapsFurniture, rectDist, callSpot, grid,
    bodyFree, bodyOverlap, boxAt, visDir, segOK };
});
