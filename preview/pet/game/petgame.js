/* 宠物名单 v2：每个家最多两只，其他宠物待命。
   state.pets = { v:2, list:[{ uid, species, room:null|ceoId, boughtAt, eng }] }。
   旧 state.pet 自动迁移；只使用原游戏主存档，不新增 localStorage 键。
   调配与购买通过 E.transact，保存失败整档回滚；各物种成长存档原样随实例保留。
   小狗运行时按 uid 独立恢复 / 模拟 / 持久化，待命不运行。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../engine.js'), require('../room.js'));
  else root.PetGame = factory(root.PetEngine, root.PetRoom);
})(typeof self !== 'undefined' ? self : this, function (PE, PR) {
  'use strict';
  const PET = { id: 'pet_dog', name: '暖棕白小狗', emoji: '🐶', price: 3000, desc: '会自己在家里逛、闻家具、回窝睡觉；能呼唤、摸摸、抛球。只陪玩，不加产速。' };
  const PV = 2, MAX_PER_ROOM = 2;
  const BED = { w: 1.3, h: 0.9 };
  // 家宅里的互动：自己的窝 + 原型里配过站位的猫窝类家具（家具在哪由家宅决定，站位按鼻尖反推，站不下就不去）
  const INTERACT = Object.assign({ pet_bed: { spot: [0.65, 0.5], face: 'E', action: 'sleep', label: '小窝' } },
    ...Object.keys(PR.INTERACT).filter(k => k !== 'pet_bed' && k !== 'pet_bowl').map(k => ({ [k]: PR.INTERACT[k] })));

  /* ---------- 宠物名单（纯数据；调配不解释任何物种的成长存档） ---------- */
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const finN = (v) => typeof v === 'number' && Number.isFinite(v);
  const validUid = (v) => typeof v === 'string' && v.trim().length > 0;
  const validRoom = (st, E, room) => isObj(st) && isObj(st.ceos) && typeof room === 'string' && Object.prototype.hasOwnProperty.call(E.CEO_BY_ID, room) && E.homeOpen(st, room);
  const storedList = (st) => st && isObj(st.pets) && Array.isArray(st.pets.list) ? st.pets.list : [];
  const legacyOwned = (st) => !!(st && isObj(st.pet) && st.pet.owned !== false);
  function freshUid(list, prefix) {
    const used = new Set(list.filter(isObj).map(p => p.uid));
    let n = 1, uid = prefix;
    while (used.has(uid)) uid = prefix + '-' + (++n);
    return uid;
  }
  // Build a normalized copy. It is also used by view(), which never mutates the save.
  // Unknown species and their complete engine payloads are deliberately opaque here.
  function rosterOf(st, E) {
    const raw = storedList(st).slice();
    if (legacyOwned(st)) {
      const p = st.pet, uid = validUid(p.uid) ? p.uid : 'pet-dog-legacy';
      if (!raw.some(q => isObj(q) && q.uid === uid)) raw.push({ uid, species: 'dog', room: p.home, boughtAt: p.boughtAt, eng: p.eng });
    }
    const list = [], seen = new Set(), counts = Object.create(null);
    // Reserve existing IDs first so repairs cannot collide with later valid records.
    const reserved = raw.filter(isObj).map(p => ({ uid: p.uid }));
    raw.forEach((p, index) => {
      if (!isObj(p)) return;
      let uid = p.uid;
      if (!validUid(uid)) { uid = freshUid(reserved, 'pet-recovered-' + (index + 1)); reserved.push({ uid }); }
      if (seen.has(uid)) return;
      seen.add(uid);
      let room = validRoom(st, E, p.room) ? p.room : null;
      if (room !== null && (counts[room] || 0) >= MAX_PER_ROOM) room = null;
      if (room !== null) counts[room] = (counts[room] || 0) + 1;
      list.push({ ...p, uid, species: validUid(p.species) ? p.species : 'dog', room,
        boughtAt: finN(p.boughtAt) && p.boughtAt >= 0 && p.boughtAt <= 8.64e15 ? p.boughtAt : 0,
        eng: p.eng === undefined ? null : p.eng });
    });
    return list;
  }
  function norm(st, E) {
    if (!isObj(st) || (!('pet' in st) && !('pets' in st))) return null;
    const list = rosterOf(st, E);
    if (list.length || 'pets' in st || legacyOwned(st)) st.pets = { ...(isObj(st.pets) ? st.pets : {}), v: PV, list };
    if ('pet' in st) delete st.pet;
    return st.pets || null;
  }
  function view(st, E) {
    const rooms = Object.create(null), pets = Object.create(null), standby = [];
    for (const p of rosterOf(st, E)) {
      pets[p.uid] = p;
      if (p.room === null) standby.push(p.uid);
      else (rooms[p.room] || (rooms[p.room] = [])).push(p.uid);
    }
    return { rooms, standby, pets };
  }
  const owned = (st, uid) => storedList(st).some(p => isObj(p) && (uid == null || p.uid === uid)) || (uid == null && legacyOwned(st));
  // A replacement picker captures PG.view(). Only identity/placement is compared:
  // elapsed time, animation and live engine snapshots do not make a picker stale.
  function placementKey(v) {
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
    if (!isObj(v) || !isObj(v.rooms) || !Array.isArray(v.standby) || !isObj(v.pets)) return null;
    return JSON.stringify({ rooms: Object.keys(v.rooms).sort().map(k => [k, v.rooms[k]]), standby: v.standby,
      pets: Object.keys(v.pets).sort().map(uid => [uid, v.pets[uid] && v.pets[uid].species, v.pets[uid] && v.pets[uid].boughtAt]) });
  }
  function checkExpected(v, expected) {
    return expected === undefined || (placementKey(expected) !== null && placementKey(expected) === placementKey(v));
  }
  function placement(st, E, uid, room, o, purchasing) {
    const v = view(st, E), p = purchasing ? null : v.pets[uid];
    if (!purchasing && !p) return { ok: false, why: '找不到这只宠物' };
    if (room !== null && !validRoom(st, E, room)) return { ok: false, why: '这位 CEO 还没加入' };
    // Same room is a true no-op, even in a full room or with replace=self.
    if (p && p.room === room) return { ok: false, same: true, noop: true, why: room === null ? '已经在待命了' : '已经在这个家了' };
    if (!checkExpected(v, o.expected)) return { ok: false, stale: true, why: '宠物位置已经变了，请重新选择' };
    const occupants = room === null ? [] : v.rooms[room] || [], replacement = o.replace == null ? null : o.replace;
    if (replacement !== null && (room === null || replacement === uid || !occupants.includes(replacement)))
      return { ok: false, why: '替换对象已经不在这间房，请重新选择', stale: true };
    if (occupants.length >= MAX_PER_ROOM && replacement === null)
      return { ok: false, why: '这个家已经有两只宠物，请选择换下哪一只', needReplace: true, occupants: occupants.slice() };
    return { ok: true, replacement, key: placementKey(v) };
  }
  function preparePlacement(st, E, uid, room, o, purchasing, checked) {
    const current = placement(st, E, uid, room, o, purchasing);
    if (!current.ok || current.key !== checked.key) return current.ok ? { ok: false, stale: true, why: '宠物位置已经变了，请重新选择' } : current;
    norm(st, E);
    // Runtime snapshots enter the transaction after its rollback snapshot exists.
    if (typeof o.prepare === 'function' && o.prepare(st) === false) return { ok: false, why: '宠物状态没有准备好' };
    const after = placement(st, E, uid, room, o, purchasing);
    if (!after.ok || after.key !== checked.key) return after.ok ? { ok: false, stale: true, why: '宠物位置已经变了，请重新选择' } : after;
    if (after.replacement !== null) storedList(st).find(p => p.uid === after.replacement).room = null;
    return after;
  }
  function assign(st, E, uid, room, opt) {
    const o = opt || {}, checked = placement(st, E, uid, room, o, false);
    if (!checked.ok) return checked;
    if (typeof E.transact !== 'function') return { ok: false, why: '存档交易不可用' };
    const r = E.transact(st, { price: 0, blocked: !!o.blocked, save: o.save,
      apply: (s) => {
        const ready = preparePlacement(s, E, uid, room, o, false, checked);
        if (!ready.ok) return ready;
        storedList(s).find(p => p.uid === uid).room = room;
        return { uid, room, replaced: ready.replacement };
      } });
    if (!r.ok) return Object.assign({}, r.result, { ok: false, why: r.why || '没有调配成功', stage: r.stage });
    return { ok: true, cost: 0, uid, room, home: room, replaced: r.result.replaced };
  }
  // This probes furniture space, separately from the two-pet roster capacity.
  let roomCache = { key: null, M: null, ok: true };
  function hasRoom(st, E, home, M) {
    if (!M || !validRoom(st, E, home)) return false;
    const L = layoutOf(st, E, home);
    if (roomCache.key !== L.key || roomCache.M !== M) roomCache = { key: L.key, M, ok: !mkWorld(E, M, L, 1).noRoom };
    return roomCache.ok;
  }
  const NO_ROOM = '暂时无法入宅：屋里摆满了，没有小狗能站的空地（收起或挪开家具、或升级房子后再来）';
  // Each purchase is a new dog instance. A null home purchases directly to standby.
  // Legacy parameters stay in place; the final options add replacement and snapshots.
  function buy(st, E, home, nowMs, M, save, blocked, opt) {
    const o = opt || {}, checked = placement(st, E, null, home, o, true);
    if (!checked.ok) return checked;
    if (!M) return { ok: false, why: '小狗还没准备好，稍后再试' };
    if (home !== null && !hasRoom(st, E, home, M)) return { ok: false, why: NO_ROOM, noRoom: true };
    if (typeof E.transact !== 'function' || typeof E.walletOk !== 'function') return { ok: false, why: '金币数据异常' };
    if (!E.walletOk(st)) return { ok: false, why: '金币数据异常', badWallet: true };
    if (!E.canAfford(st, PET.price)) return { ok: false, why: '金币不够' };
    const stamp = finN(nowMs) && nowMs >= 0 && nowMs <= 8.64e15 ? nowMs : 0;
    const r = E.transact(st, { price: PET.price, blocked: !!blocked, save: typeof save === 'function' ? save : () => true,
      apply: (s) => {
        const ready = preparePlacement(s, E, null, home, o, true, checked);
        if (!ready.ok) return ready;
        if (!isObj(s.pets)) s.pets = { v: PV, list: [] };
        const list = storedList(s), uid = freshUid(list, 'pet-dog-' + stamp.toString(36));
        list.push({ uid, species: 'dog', room: home, boughtAt: stamp, eng: null });
        return { uid, replaced: ready.replacement };
      } });
    if (!r.ok) return Object.assign({}, r.result, { ok: false, why: r.why || '没有买成', stage: r.stage });
    return { ok: true, cost: r.cost, uid: r.result.uid, home, room: home, replaced: r.result.replaced };
  }
  // Compatibility convenience for a single dog; new UI dispatches assign by uid.
  function move(st, E, home, opt) {
    const first = rosterOf(st, E).find(p => p.species === 'dog');
    if (!first) return { ok: false, why: '还没有小狗' };
    return assign(st, E, first.uid, home, opt || { save: () => true });
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
  function pickBed(w, prev, avoid) {
    const free = (b) => bedOK(w, b) && !(avoid || []).some(a => b.x < a.x + a.w && a.x < b.x + b.w && b.y < a.y + a.h && a.y < b.y + b.h);
    if (prev && free(prev)) return { ...prev };
    for (let y = +(w.rows - BED.h).toFixed(2); y >= -1e-9; y = +(y - 0.25).toFixed(2))
      for (let x = 0; x + BED.w <= w.cols + 1e-9; x = +(x + 0.25).toFixed(2)) { const b = { x, y, w: BED.w, h: BED.h }; if (free(b)) return b; }
    if (avoid && avoid.length) return pickBed(w, prev);
    return { x: 0, y: Math.max(0, w.rows - BED.h), w: BED.w, h: BED.h, blocked: true };   // 屋里摆满了：窝画在左前角，小狗原地趴着睡
  }

  function mkWorld(E, M, L, seed, start) {
    return PE.createWorld({ catalog: E.FURNITURE, room: { cols: L.cols, rows: L.rows, wallRows: 2, front: L.front, bed: { x: 0, y: L.rows - BED.h, w: BED.w, h: BED.h }, bowl: null, items: L.items },
      interact: INTERACT, manifest: M, seed, start });
  }

  /* ---------- 小狗运行时（每个 uid 一份；无 DOM，Node 可测） ---------- */
  function createRuntime(opt) {
    const E = opt.E, M = opt.manifest, now = opt.now || (() => Date.now());
    let w = null, homeId = null, petUid = null, key = '', decor = false, lastEvent = '', simAt = 0, restored = null;
    let generation = '', sourceEng = '', sourceState = null, berth = 0;
    const stagedEngs = new Set();
    const token = (v) => { try { return JSON.stringify(v); } catch (e) { return ''; } };
    function record(st) {
      const list = storedList(st);
      if (opt.uid != null) return list.find(p => isObj(p) && p.uid === opt.uid && p.species === 'dog') || null;
      return list.find(p => isObj(p) && p.species === 'dog') || (legacyOwned(st) ? st.pet : null);
    }
    const roomOf = (p) => p && ('room' in p ? p.room : p.home);
    const uidOf = (p) => p && (p.uid || 'pet-dog-legacy');
    const generationOf = (p) => token([uidOf(p), p && (p.species || 'dog'), p && p.boughtAt]);
    function reset() { w = null; homeId = petUid = null; key = generation = sourceEng = ''; sourceState = null; stagedEngs.clear(); restored = null; }
    const berthOf = (st, uid, room) => Math.max(0, storedList(st).filter(p => isObj(p) && p.room === room).findIndex(p => p.uid === uid)) % MAX_PER_ROOM;
    const runtimeBed = (prev) => pickBed(w, prev, berth ? [pickBed(w, null)] : null);
    const canonicalBed = () => runtimeBed(berth ? { x: w.cols - BED.w, y: w.rows - BED.h, w: BED.w, h: BED.h } : null);
    function build(st, p) {
      const room = roomOf(p), L = layoutOf(st, E, room), uid = uidOf(p);
      let seed = ((p.boughtAt || 1) % 2147483647) >>> 0;
      for (let i = 0; i < uid.length; i++) seed = (Math.imul(seed, 31) + uid.charCodeAt(i)) >>> 0;
      berth = berthOf(st, uid, room);
      const start = { x: L.front.x + (berth === 0 ? -0.8 : 0.8), y: L.rows - 1.6 };
      w = mkWorld(E, M, L, seed, start);
      w.bed = canonicalBed(); w.obsVer++;
      // Runtime-specific validation stays in the dog engine. Roster migration and
      // placement must not clamp or discard another species' growth payload.
      const eng = PE.sanitizeSave(p.eng); let res = null;
      if (eng && eng.home === room) { res = PE.restore(w, Object.assign({}, eng, { items: [] }), now()); lastEvent = res.ok && res.elapsed > 20 ? 'slept' : 'back'; }
      else if (eng) {
        res = PE.restore(w, Object.assign({}, eng, { items: [], savedAt: now(), dog: Object.assign({}, eng.dog, { x: start.x, y: L.front.y - 0.6, asleep: false }) }), now());
        if (!w.noRoom) w.dog.label = '刚搬来，东张西望'; lastEvent = 'moved';
      } else lastEvent = 'arrived';
      if (w.noRoom) lastEvent = 'waiting';
      if (w.dog.step && !w.dog.step.k) w.dog.step = null;
      homeId = room; petUid = uid; key = L.key; decor = false; simAt = now();
      generation = generationOf(p); sourceEng = token(p.eng); sourceState = st; stagedEngs.clear();
      restored = { x: w.dog.x, y: w.dog.y, affinity: w.dog.affinity, energy: w.dog.energy, inBed: !!(res && res.inBed), elapsed: res ? res.elapsed : 0, waiting: !!w.noRoom };
      return res;
    }
    function sync(st) {
      const p = record(st), room = roomOf(p);
      if (!p || !validRoom(st, E, room)) { reset(); return null; }
      // The exact payload we staged is our own save, not an external update.
      // A transaction rollback instead restores sourceEng, keeping live progress.
      acknowledgePersist(st);
      if (!w || homeId !== room || petUid !== uidOf(p) || generation !== generationOf(p) || sourceEng !== token(p.eng)) { build(st, p); return w; }
      sourceState = st; stagedEngs.clear();
      const L = layoutOf(st, E, homeId), nextBerth = berthOf(st, petUid, homeId), berthChanged = nextBerth !== berth;
      if (L.key !== key || berthChanged) {
        if (L.key !== key) PE.setLayout(w, { cols: L.cols, rows: L.rows, front: L.front, items: L.items });
        berth = nextBerth;
        // Membership changes can renumber the surviving resident. Reassign its
        // bed without rebuilding the world, teleporting it, or losing live growth.
        const nb = berthChanged ? canonicalBed() : runtimeBed(w.bed);
        if (nb.x !== w.bed.x || nb.y !== w.bed.y) { w.bed = nb; w.obsVer++; }
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
    function snapshot() {
      if (!w || homeId === null) return null;
      const s = PE.serialize(w, simAt || now()); delete s.items; s.home = homeId;
      return s;
    }
    function beforePersist(st) {
      const p = record(st);
      // A displaced/standby pet, a changed instance, or a newer engine payload
      // must never be overwritten by an old room's still-mounted runtime.
      if (!w || !p || roomOf(p) !== homeId || generationOf(p) !== generation) return false;
      const current = token(p.eng);
      if (current !== sourceEng && !stagedEngs.has(current)) return false;
      p.eng = snapshot();
      // Keep the original baseline and every exact staged payload until sync.
      // This covers repeated collection inside one transaction and consecutive
      // transactions without a frame between them, regardless of which rolls back.
      if (st === sourceState) stagedEngs.add(token(p.eng));
      return true;
    }
    function acknowledgePersist(st) {
      const p = record(st);
      // Call after success, or let sync recognize our own staged save. Refuse
      // moved/replaced pets and unrelated external payloads; never write state here.
      if (!w || st !== sourceState || !p || roomOf(p) !== homeId || generationOf(p) !== generation || !stagedEngs.has(token(p.eng))) return false;
      sourceEng = token(p.eng); stagedEngs.clear();
      return true;
    }
    function resume(st) { if (!w) return sync(st); beforePersist(st); w = null; sync(st); return lastEvent; }
    const act = (st, fn) => { if (!sync(st)) return { ok: false, why: 'none' }; if (w.noRoom) return { ok: false, why: 'waiting' }; return fn(w); };
    return {
      get w() { return w; }, get uid() { return petUid || opt.uid || null; }, get homeId() { return homeId; }, get lastEvent() { return lastEvent; }, get restored() { return restored; },
      get waiting() { return !!(w && w.noRoom); },
      sync, frame, snapshot, beforePersist, acknowledgePersist, resume, reset,
      call: (st) => act(st, PE.call), pet: (st, how) => act(st, (w) => PE.pet(w, how || 'button')), throwBall: (st, t) => act(st, (w) => PE.throwBall(w, t)),
    };
  }

  /* ---------- 画（浏览器：小狗 / 窝 / 球都是 #roomFloor 里的绝对定位元素，跟家具按落地点排前后） ---------- */
  // 12e：画布横向余量（概念 256 坐标）= 任何帧（含镜像）叼着的球最外沿伸出 0..256 的量 + 描边，至少 8
  function padXOf(M) {
    if (!M || !M.clips) return 8;
    const br = PE.CFG.BALL_R * 256 / M.runtime.displayTiles, lw = Math.max(1.5, br * 0.22);
    let out = 0;
    for (const c of Object.values(M.clips)) for (const f of c.frames) {
      if (!f.mouth) continue;
      const x = f.mouth[0]; out = Math.max(out, x + br + lw - 256, br + lw - x);   // 朝东伸出右边；镜像（朝西）时 256−x 侧同理 = x−br 伸出左边
    }
    return Math.max(8, Math.ceil(out + 2));
  }
  function createView(opt) {
    const M = opt.manifest, PA = opt.PA, PP = opt.PP;
    let atlas = null, els = null, cvW = 0, cvH = 0;
    const PAD_X = padXOf(M);
    const sheetSrc = opt.atlasBase && M && !M.placeholder && M.atlas && M.atlas.image ? opt.atlasBase + M.atlas.image : null;
    if (sheetSrc && typeof Image !== 'undefined') { const im = new Image(); im.onload = () => { atlas = im; }; im.onerror = () => console.warn('小狗图集没加载到，先用占位小狗'); im.src = sheetSrc + (opt.ver ? '?v=' + opt.ver : ''); }
    function mk(cls, tag) { const e = document.createElement(tag || 'div'); e.className = cls; e.setAttribute('aria-hidden', 'true'); return e; }
    function ensure(floor) {
      if (els && els.floor === floor && els.dog.parentNode === floor) return els;
      detach();
      const bed = mk('pet-bed'), ball = mk('pet-ball'), dog = mk('pet-dog pet-sprite'), cv = mk('pet-cv', 'canvas'), fx = mk('pet-fx'), tag = mk('pet-tag');
      if (opt.uid != null) for (const el of [bed, ball, dog]) el.setAttribute('data-uid', String(opt.uid));
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
      // 12e（熊大 23:26 第 3 项）：画布左右各留 padX 余量——叼着的球 / 鼻尖会伸出 256 概念格（idle_E#0、run_E#0 朝东截右边、朝西镜像截左边）；
      //   画布仍以落地点居中（translate(-50%)），所以定位不变，只是更宽
      const padX = Math.ceil(S * PAD_X / 256), CW = S + 2 * padX;
      const W2 = Math.round(CW * dpr), H2 = Math.round((S + pad) * dpr);
      if (W2 !== cvW || H2 !== cvH) { e.cv.width = cvW = W2; e.cv.height = cvH = H2; e.cv.style.width = CW + 'px'; e.cv.style.height = (S + pad) + 'px'; }
      e.dog.style.cssText = `left:${pc(d.x, w.cols)};top:${pc(d.y, w.rows)};width:${CW}px;height:${S + pad}px;z-index:${10 + Math.floor(d.y * 10)};transform:translate(-50%,${-(208 / 256 * S + pad)}px)`;
      const ctx = e.ctx, k = S / 256 * dpr, name = d.anim.name, fi = d.anim.frame(), frm = M.clips[name].frames[fi], mirror = d.dir === 'W';
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cvW, cvH);
      const gx = CW / 2 * dpr, gy = (pad + 208 / 256 * S) * dpr, sk = k * (1 - Math.min(0.4, d.z * 0.6));
      ctx.save(); ctx.translate(gx, gy); ctx.scale(sk, sk); ctx.translate(-128, -208);
      if (atlas) { const c = PA.cellRect(M, M.shadow.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); } else PP.drawShadow(ctx, M);
      ctx.restore();
      ctx.save(); ctx.translate(gx, gy - d.z * tile * dpr); ctx.scale(mirror ? -k : k, k); ctx.translate(-128, -208);
      const carried = b.state === 'carried', br = PE.CFG.BALL_R * 256 / M.runtime.displayTiles;
      if (carried && d.dir === 'N' && frm.mouth) ballPath(ctx, frm.mouth[0], frm.mouth[1], br);   // p5：真图北向嘴被挡（mouthHidden）→ 不画球
      if (atlas) { const c = PA.cellRect(M, frm.cell); ctx.drawImage(atlas, c.sx, c.sy, c.s, c.s, 0, 0, 256, 256); } else PP.drawFrame(ctx, M, name, fi);
      if (carried && d.dir !== 'N' && frm.mouth) ballPath(ctx, frm.mouth[0], frm.mouth[1] + 4, br);
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

  return { PET, PV, MAX_PER_ROOM, BED, INTERACT, NO_ROOM, norm, view, owned, assign, buy, move, hasRoom, layoutOf, pickBed, bedOK, createRuntime, createView, padXOf };
});
