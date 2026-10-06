/* 宠物 p4 — 小狗接进完整游戏：商城购买 → 进某位 CEO 的家宅 → 自主活动 + 呼唤 / 摸摸 / 抛球 → 刷新后存档保留。
   存档：只用游戏原有存档里的一个字段 state.pet（不新增 / 不改名任何 localStorage 键）。没有 pet 字段 = 还没买，旧档照常读。
     state.pet = { v:1, owned:true, home:'<ceoId>', boughtAt:<ms>, eng:<引擎存档：小狗 / 球 / 精力 / 亲密，不含家具> | null }
   家具：一律以家宅里的摆设为准（engine.setLayout 整组同步，uid 沿用），小狗的窝自动找空地，不占家具格。
   美术：manifest 与原型共用 ../art/manifest.json；熊大正式图到了 = 换图集文件 + manifest 改 placeholder:false / atlas.image，代码不用动。
   p4b：屋里没有小狗能站的空地（合法摆满）是正常状态——没买：购买前就查（hasRoom），没位置提示「暂时无法入宅」，不扣钱；
        已经有了（读档满屋 / 布置挡满 / 搬进满屋 / 升级前后）：所有权不动，进「等待安置」（引擎 w.noRoom），腾出空地自动出来。
        读档逐字段校验 pet / pet.eng（有限数值 + 范围，缺失给默认，合法 0 保留），坏字段不再清掉所有权。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../engine.js'), require('../room.js'));
  else root.PetGame = factory(root.PetEngine, root.PetRoom);
})(typeof self !== 'undefined' ? self : this, function (PE, PR) {
  'use strict';
  const PET = { id: 'pet_dog', name: '暖棕白小狗', emoji: '🐶', price: 3000, desc: '会自己在家里逛、闻家具、回窝睡觉；能呼唤、摸摸、抛球。只陪玩，不加产速。' };
  const PV = 1;
  const BED = { w: 1.3, h: 0.9 };
  // 家宅里的互动：自己的窝 + 原型里配过站位的猫窝类家具（家具在哪由家宅决定，站位按鼻尖反推，站不下就不去）
  const INTERACT = Object.assign({ pet_bed: { spot: [0.65, 0.5], face: 'E', action: 'sleep', label: '小窝' } },
    ...Object.keys(PR.INTERACT).filter(k => k !== 'pet_bed' && k !== 'pet_bowl').map(k => ({ [k]: PR.INTERACT[k] })));

  /* ---------- 存档字段（纯函数，Node 可测） ---------- */
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const finN = (v) => typeof v === 'number' && Number.isFinite(v);
  function firstOpen(E, st) { const c = E.CEOS.find(c => E.homeOpen(st, c.id)); return c ? c.id : 'c77'; }
  // 读档整理：没有 pet 字段就保持没有（不往旧档里加东西）；pet 不是对象（字符串 / 数组 / null）或明确 owned:false = 没买，删掉；
  // p4b：pet 是对象 = 买过（这个字段只有购买会写）——owned / home / boughtAt / eng 哪个坏了就修哪个，所有权保留：
  //   家不存在 / 没开放 → 搬到第一个开放的家（精力 / 亲密照样带过去，从门口进）；boughtAt 非法 → 0；
  //   eng 逐字段校验（engine.sanitizeSave：有限数值 + 范围，缺失给默认，合法 0 保留）；eng 整个不是对象 / 版本不对 → null（小狗还在，重新进门）
  function norm(st, E) {
    if (!st || !('pet' in st)) return null;
    const p = st.pet;
    if (!isObj(p) || p.owned === false) { delete st.pet; return null; }
    p.owned = true; p.v = PV;
    if (typeof p.home !== 'string' || !E.homeOpen(st, p.home)) p.home = firstOpen(E, st);
    if (!finN(p.boughtAt) || p.boughtAt < 0 || p.boughtAt > 8.64e15) p.boughtAt = 0;
    const e = PE.sanitizeSave(p.eng);
    if (e && (typeof e.home !== 'string' || !E.CEO_BY_ID[e.home])) e.home = p.home;
    p.eng = e;
    return p;
  }
  const owned = (st) => !!(st && isObj(st.pet) && st.pet.owned === true);
  // p4b：这个家现在有没有小狗能站的地方（和真正入宅用同一个建世界流程；按布局缓存）
  let roomCache = { key: null, M: null, ok: true };
  function hasRoom(st, E, home, M) {
    if (!M) return false;
    const L = layoutOf(st, E, home);
    if (roomCache.key !== L.key || roomCache.M !== M) roomCache = { key: L.key, M, ok: !mkWorld(E, M, L, 1).noRoom };
    return roomCache.ok;
  }
  const NO_ROOM = '暂时无法入宅：屋里摆满了，没有小狗能站的空地（收起或挪开家具、或升级房子后再来）';
  // M = manifest（身体盒要用）：购买前先查有没有地方站，没有就不扣钱
  function buy(st, E, home, nowMs, M) {
    if (owned(st)) return { ok: false, why: '已经有小狗了（只能养一只）' };
    if (!E.homeOpen(st, home)) return { ok: false, why: '这位 CEO 还没加入' };
    if (!M) return { ok: false, why: '小狗还没准备好，稍后再试' };
    if (!hasRoom(st, E, home, M)) return { ok: false, why: NO_ROOM, noRoom: true };
    if (!(st.coins >= PET.price)) return { ok: false, why: '金币不够' };
    st.coins -= PET.price;
    st.pet = { v: PV, owned: true, home, boughtAt: nowMs || 0, eng: null };
    return { ok: true, cost: PET.price, home };
  }
  function move(st, E, home) {
    if (!owned(st)) return { ok: false, why: '还没有小狗' };
    if (!E.homeOpen(st, home)) return { ok: false, why: '这位 CEO 还没加入' };
    if (st.pet.home === home) return { ok: false, why: '小狗已经在这个家了', same: true };
    st.pet.home = home;
    return { ok: true, home };
  }
  // 家宅 → 引擎布局：只要地上的家具（挂画在墙上不挡路），uid 原样；「你」站在房间前沿正中
  function layoutOf(st, E, home) {
    const H = E.homeOf(st, home), T = E.homeTier(H.lv);
    const items = H.placed.filter(p => E.itemSurf(p) !== 'wall' && E.FURN_BY_ID[p.fid]).map(p => ({ uid: p.uid, fid: p.fid, x: p.x, y: p.y, rot: p.rot || 0 }));
    return { cols: T.cols, rows: T.rows, front: { x: T.cols / 2, y: T.rows - 0.3 }, items, key: T.cols + 'x' + T.rows + '|' + items.map(p => [p.uid, p.fid, p.x, p.y, p.rot].join(',')).join(';') };
  }
  // 小狗的窝：平的（能踩），不压家具；睡觉站位（窝中心，朝东）身体盒放得下。优先左前角，结果只由布局决定（读档重算位置一样）
  function bedOK(w, b) {
    if (!b || b.x < 0 || b.y < 0 || b.x + b.w > w.cols + 1e-9 || b.y + b.h > w.rows + 1e-9) return false;
    for (const o of PE.obstacles(w)) if (b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h) return false;
    const sp = INTERACT.pet_bed.spot;
    return PE.bodyFree(w, b.x + sp[0], b.y + sp[1], 'E', 1e-6) && PE.bodyFree(w, b.x + sp[0], b.y + sp[1], 'H', 1e-6);
  }
  function pickBed(w, prev) {
    if (prev && bedOK(w, prev)) return { ...prev };
    for (let y = +(w.rows - BED.h).toFixed(2); y >= -1e-9; y = +(y - 0.25).toFixed(2))
      for (let x = 0; x + BED.w <= w.cols + 1e-9; x = +(x + 0.25).toFixed(2)) { const b = { x, y, w: BED.w, h: BED.h }; if (bedOK(w, b)) return b; }
    return { x: 0, y: Math.max(0, w.rows - BED.h), w: BED.w, h: BED.h, blocked: true };   // 屋里摆满了：窝画在左前角，小狗原地趴着睡
  }

  function mkWorld(E, M, L, seed) {
    return PE.createWorld({ catalog: E.FURNITURE, room: { cols: L.cols, rows: L.rows, wallRows: 2, front: L.front, bed: { x: 0, y: L.rows - BED.h, w: BED.w, h: BED.h }, bowl: null, items: L.items },
      interact: INTERACT, manifest: M, seed });
  }

  /* ---------- 运行时（无 DOM，Node 可测） ---------- */
  function createRuntime(opt) {
    const E = opt.E, M = opt.manifest, now = opt.now || (() => Date.now());
    let w = null, homeId = null, key = '', decor = false, lastEvent = '', simAt = 0, restored = null;   // simAt = 最后一次真的在模拟的时间（存档的 savedAt 用它：页面藏起来后不再跑，回来按离线算）
    function build(st) {
      const p = st.pet, L = layoutOf(st, E, p.home);
      w = mkWorld(E, M, L, ((p.boughtAt || 1) % 2147483647) >>> 0);   // p4b：满屋也不崩（w.noRoom = 等待安置）
      w.bed = pickBed(w, null); w.obsVer++;
      const eng = p.eng; let res = null;
      if (eng && eng.home === p.home) { res = PE.restore(w, Object.assign({}, eng, { items: [] }), now()); lastEvent = res.ok && res.elapsed > 20 ? 'slept' : 'back'; }
      else if (eng) {   // 搬家：精力 / 亲密带过去，人从门口（前沿）进来
        res = PE.restore(w, Object.assign({}, eng, { items: [], savedAt: now(), dog: Object.assign({}, eng.dog, { x: L.front.x - 0.8, y: L.front.y - 0.6, asleep: false }) }), now());
        if (!w.noRoom) w.dog.label = '刚搬来，东张西望'; lastEvent = 'moved';
      } else lastEvent = 'arrived';
      if (w.noRoom) lastEvent = 'waiting';
      if (w.dog.step && !w.dog.step.k) w.dog.step = null;
      homeId = p.home; key = L.key; decor = false; simAt = now();
      restored = { x: w.dog.x, y: w.dog.y, affinity: w.dog.affinity, energy: w.dog.energy, inBed: !!(res && res.inBed), elapsed: res ? res.elapsed : 0, waiting: !!w.noRoom };
      return res;
    }
    function sync(st) {
      if (!owned(st)) { w = null; homeId = null; key = ''; return null; }
      if (!w || homeId !== st.pet.home) { build(st); return w; }
      const L = layoutOf(st, E, homeId);
      if (L.key !== key) {
        PE.setLayout(w, { cols: L.cols, rows: L.rows, front: L.front, items: L.items });
        const nb = pickBed(w, w.bed); if (nb.x !== w.bed.x || nb.y !== w.bed.y) { w.bed = nb; w.obsVer++; }
        key = L.key;
      }
      return w;
    }
    function frame(dt, st, ctx) {
      if (!sync(st)) return null;
      const dec = !!(ctx && ctx.decorHere);
      if (dec !== decor) { decor = dec; PE.setRearrange(w, dec); }
      let left = Math.min(0.1, Math.max(0, dt || 0));
      while (left > 1e-6) { const h = Math.min(1 / 60, left); PE.update(w, h); left -= h; }
      simAt = now();
      return w;
    }
    function beforePersist(st) {
      if (!w || !owned(st) || st.pet.home !== homeId) return;
      const s = PE.serialize(w, simAt || now()); delete s.items; s.home = homeId;
      st.pet.eng = s;
    }
    // 页面藏起来很久再回来：先存一份，再按存档重建（离线 = 在窝里睡，回精力，不扣亲密）
    function resume(st) { if (!owned(st) || !w) return null; beforePersist(st); w = null; sync(st); return lastEvent; }
    const act = (st, fn) => { if (!sync(st)) return { ok: false, why: 'none' }; if (w.noRoom) return { ok: false, why: 'waiting' }; return fn(w); };
    return {
      get w() { return w; }, get homeId() { return homeId; }, get lastEvent() { return lastEvent; }, get restored() { return restored; },
      get waiting() { return !!(w && w.noRoom); },
      sync, frame, beforePersist, resume, reset() { w = null; homeId = null; key = ''; },
      call: (st) => act(st, PE.call), pet: (st, how) => act(st, (w) => PE.pet(w, how || 'button')), throwBall: (st, t) => act(st, (w) => PE.throwBall(w, t)),
    };
  }

  /* ---------- 画（浏览器：小狗 / 窝 / 球都是 #roomFloor 里的绝对定位元素，跟家具按落地点排前后） ---------- */
  function createView(opt) {
    const M = opt.manifest, PA = opt.PA, PP = opt.PP;
    let atlas = null, els = null, cvW = 0, cvH = 0;
    const sheetSrc = opt.atlasBase && M && !M.placeholder && M.atlas && M.atlas.image ? opt.atlasBase + M.atlas.image : null;
    if (sheetSrc && typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { atlas = im; }; im.onerror = () => console.warn('小狗图集没加载到，先用占位小狗'); im.src = sheetSrc + (opt.ver ? '?v=' + opt.ver : ''); }
    function mk(cls, tag) { const e = document.createElement(tag || 'div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); return e; }
    function ensure(floor) {
      if (els && els.floor === floor && els.dog.parentNode === floor) return els;
      const bed = mk('pet-bed'), ball = mk('pet-ball'), dog = mk('pet-dog'), cv = mk('pet-cv', 'canvas'), fx = mk('pet-fx'), tag = mk('pet-tag');
      dog.appendChild(cv); dog.appendChild(fx); dog.appendChild(tag);
      floor.appendChild(bed); floor.appendChild(ball); floor.appendChild(dog);
      els = { floor, bed, ball, dog, cv, ctx: cv.getContext('2d'), fx, tag, fxSeen: 0, label: '' }; cvW = cvH = 0;
      return els;
    }
    function detach() { if (els) { for (const k of ['bed', 'ball', 'dog']) if (els[k].parentNode) els[k].parentNode.removeChild(els[k]); els = null; } }
    function ballPath(ctx, x, y, r) {
      ctx.fillStyle = '#d6e83a'; ctx.strokeStyle = '#2b2118'; ctx.lineWidth = Math.max(1.5, r * 0.22);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.beginPath(); ctx.arc(x - r * 0.9, y, r * 0.8, -0.9, 0.9); ctx.stroke();
    }
    function draw(w, floor) {
      if (!w || !floor || w.noRoom) { detach(); return; }   // p4b：等待安置 = 不画小狗 / 窝 / 球
      const e = ensure(floor), fr = floor.getBoundingClientRect(); if (fr.width < 2) return;
      const tile = fr.width / w.cols, pc = (x, n) => (x / n * 100) + '%';
      const d = w.dog, b = w.ball, S = M.runtime.displayTiles * tile, pad = 0.7 * tile, dpr = Math.min(3, window.devicePixelRatio || 1);
      // 窝
      e.bed.style.cssText = `left:${pc(w.bed.x, w.cols)};top:${pc(w.bed.y, w.rows)};width:${pc(w.bed.w, w.cols)};height:${pc(w.bed.h, w.rows)}`;
      // 球（嘴里的画在小狗图上）
      if (b.state === 'carried') e.ball.style.display = 'none';
      else { const r = PE.CFG.BALL_R * tile; e.ball.style.cssText = `display:block;left:${pc(b.x, w.cols)};top:${pc(b.y, w.rows)};width:${2 * r}px;height:${2 * r}px;z-index:${10 + Math.floor(b.y * 10)};transform:translate(-50%,${-2 * r - b.z * tile}px)`; }
      // 小狗：canvas = 原型同一套逐帧画法（占位）或图集格子
      const W2 = Math.round(S * dpr), H2 = Math.round((S + pad) * dpr);
      if (W2 !== cvW || H2 !== cvH) { e.cv.width = cvW = W2; e.cv.height = cvH = H2; e.cv.style.width = S + 'px'; e.cv.style.height = (S + pad) + 'px'; }
      e.dog.style.cssText = `left:${pc(d.x, w.cols)};top:${pc(d.y, w.rows)};width:${S}px;height:${S + pad}px;z-index:${10 + Math.floor(d.y * 10)};transform:translate(-50%,${-(208 / 256 * S + pad)}px)`;
      const ctx = e.ctx, k = S / 256 * dpr, name = d.anim.name, fi = d.anim.frame(), frm = M.clips[name].frames[fi], mirror = d.dir === 'W';
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvW, cvH);
      const gx = S / 2 * dpr, gy = (pad + 208 / 256 * S) * dpr, sk = k * (1 - Math.min(0.4, d.z * 0.6));
      ctx.save(); ctx.translate(gx, gy); ctx.scale(sk, sk); ctx.translate(-128, -208);
      if (atlas) { const c = PA.cellRect(M, M.shadow.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); } else PP.drawShadow(ctx, M);
      ctx.restore();
      ctx.save(); ctx.translate(gx, gy - d.z * tile * dpr); ctx.scale(mirror ? -k : k, k); ctx.translate(-128, -208);
      const carried = b.state === 'carried', br = PE.CFG.BALL_R * 256 / M.runtime.displayTiles;
      if (carried && d.dir === 'N') ballPath(ctx, frm.mouth[0], frm.mouth[1], br);
      if (atlas) { const c = PA.cellRect(M, frm.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); } else PP.drawFrame(ctx, M, name, fi);
      if (carried && d.dir !== 'N') ballPath(ctx, frm.mouth[0], frm.mouth[1] + 4, br);
      ctx.restore();
      // 爱心 / 问号 / 睡觉 z
      let fxs = '';
      for (const f of w.fx) { const age = w.t - f.t; if (age < 0 || age > 1.4) continue; fxs += f.type === 'heart' ? `<i style="opacity:${(1 - age / 1.4).toFixed(2)};transform:translate(-50%,${-age * tile * 0.7}px)">💗</i>` : `<i class="q" style="opacity:${(1 - age / 1.4).toFixed(2)}">?</i>`; }
      if (name === 'sleep') fxs += `<i class="z" style="top:${(0.95 * tile).toFixed(0)}px;left:${(0.3 * tile).toFixed(0)}px">z</i>`; else if (name === 'attention') fxs += '<i class="q">!</i>';
      if (fxs !== e.fxSeen) { e.fx.innerHTML = fxs; e.fxSeen = fxs; }
    }
    // 点到小狗（地板坐标，格）：和原型同一个判定框
    function hit(w, floor, cx, cy) {
      if (!w || !floor || w.noRoom) return false;
      const fr = floor.getBoundingClientRect(), tile = fr.width / w.cols, x = (cx - fr.left) / tile, y = (cy - fr.top) / tile, d = w.dog;
      return Math.abs(x - d.x) < 0.6 && y > d.y - 1.05 - d.z && y < d.y + 0.25;
    }
    return { draw, hit, detach, get artMode() { return atlas ? 'atlas' : 'placeholder'; }, get els() { return els; } };
  }

  return { PET, PV, BED, INTERACT, NO_ROOM, norm, owned, buy, move, hasRoom, layoutOf, pickBed, bedOK, createRuntime, createView };
});
