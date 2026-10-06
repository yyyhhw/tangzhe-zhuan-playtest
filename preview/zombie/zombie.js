'use strict';
// 打僵尸：只有 77。单独打开 = 原型模式（模拟余额，只存 PROTO_KEY）；?embed=1 嵌在经营页里 = 金币、训练、进度都由经营页管（postMessage），本页不写任何存档。
(() => {
const ZB = window.ZBCore;
const EMBED = /[?&]embed=1(&|$)/.test(location.search) && window.parent !== window;
const PROTO_KEY = 'tangzhe-zombie-proto';
const MAX_LV = ZB.MAX_LV, HP_G = 1.085;
const levelDur = ZB.levelDur;
const isBossLv = n => n % 10 === 0;
const INK = '#141414', PAPER = '#f7f1e3', RED = '#e63946', YEL = '#ffd23f';
const $ = s => document.querySelector(s);
const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

// ---- 训练（价格 / 上限在 zbcore.js）----
const TRAIN = [
  { id: 'atk',  name: '串串火候', desc: lv => `普攻伤害 ×${(1.15 ** lv).toFixed(2)}` },
  { id: 'rate', name: '翻串手速', desc: lv => `出串间隔 ${fireInterval(lv).toFixed(2)} 秒` },
  { id: 'hp',   name: '摊主体力', desc: lv => `生命 ${Math.round(100 * 1.12 ** lv)}` },
  { id: 'ult',  name: '火圈加柴', desc: lv => `火圈伤害 ×${(1.2 ** lv).toFixed(2)}` },
];
const MAX_TRAIN = ZB.MAX_TRAIN;
const price = (t, lv) => ZB.price(t.id, lv);
function fireInterval(lv) { return Math.max(0.2, 0.55 * 0.95 ** lv); }
function loadProto() {
  if (EMBED) return Object.assign({ coins: 0, ready: false, blocked: false, ceo: null }, ZB.norm(null));
  let raw = null; try { raw = JSON.parse(localStorage.getItem(PROTO_KEY) || 'null'); } catch (e) { raw = null; }
  const q = new URLSearchParams(location.search).get('ceo');
  const p = Object.assign({ coins: 5e10, ready: true, blocked: false, ceo: ZB.heroOf(q === null ? undefined : q) }, ZB.norm(raw));
  if (raw && typeof raw === 'object') p.coins = Math.max(0, Math.min(1e15, fin(raw.coins, 5e10)));
  return p;
}
const proto = loadProto();
const saveProto = () => { if (EMBED) return; try { localStorage.setItem(PROTO_KEY, JSON.stringify(proto)); } catch (e) {} };
let pend = false, firstSync = true;
let port = null;
let lastSent = null;
const host = m => { lastSent = m; if (port) port.postMessage(m); };
// 13a 上场角色：嵌入 = 经营页 zb:'state' 的 ceo（烧烤摊现任 CEO，null = 没人）；原型页 = ?ceo=，默认 77。开局锁进 G.ceo，结算回传
const canPlay = () => !!proto.ceo;
const skilled = id => ZB.PLAYABLE.includes(id);
const Wallet = {
  balance: () => proto.coins,
  canSpend: n => proto.ready && !pend && !proto.blocked && isFinite(n) && n > 0 && proto.coins >= n,
  spend(n) { if (EMBED || !Wallet.canSpend(n)) return false; proto.coins -= n; saveProto(); return true; },
};
// 经营页回的权威状态：金币余额 + 训练 / 进度
if (EMBED) window.addEventListener('message', e => {
  if (port || e.source !== window.parent || e.origin !== location.origin || !e.data || e.data.zb !== 'port' || !e.ports[0]) return;
  port = e.ports[0]; port.onmessage = ev => onState(ev.data);
});
function onState(d) {
  if (!d || d.zb !== 'state') return;
  pend = false; proto.coins = Math.max(0, fin(d.coins, 0)); proto.blocked = !!d.blocked; Object.assign(proto, ZB.norm(d.z)); if ('ceo' in d) proto.ceo = ZB.heroOf(d.ceo); proto.ready = true;
  if (firstSync) { firstSync = false; selLv = Math.min(MAX_LV, proto.cleared + 1); }
  $('#trainNote').textContent = d.why || (proto.blocked ? '存档异常或已在别的页面打开，暂时不能花金币。' : '和经营共用金币：训练只花钱，打僵尸本身不产金币。');
  renderTrain();
  if (d.ack === 'result' && G && G.over && G.wait) { G.wait = false; G.why = d.why || ''; renderResult(); }
}
function fmt(n) {
  if (!isFinite(n)) return '—';
  if (n < 1e4) return String(Math.floor(n));
  if (n < 1e8) return (n / 1e4).toFixed(1) + '万';
  if (n < 1e12) return (n / 1e8).toFixed(2) + '亿';
  return (n / 1e12).toFixed(2) + '万亿';
}

// ---- 画布 ----
const cv = $('#cv'), ctx = cv.getContext('2d');
if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath(); };
let W = 360, H = 640, U = 1, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  U = Math.min(W / 360, H / 640) || 1;
  if (G) { G.p.x = Math.min(Math.max(G.p.x, 0), W); G.p.y = Math.min(Math.max(G.p.y, 0), H); }
}
window.addEventListener('resize', resize);

// ---- 对局 ----
let G = null, raf = 0, last = 0, paused = false;
let selLv = 1;
function newRun(mode, n) {
  const lv = proto.lv, maxHp = Math.round(100 * 1.12 ** lv.hp);
  return {
    mode, n, ceo: proto.ceo, dur: mode === 'level' ? levelDur(n) : Infinity, nextBoss: mode === 'level' ? (isBossLv(n) ? levelDur(n) - 30 : Infinity) : 60,
    t: 0, over: false, win: false, kills: 0, spawnAcc: 0,
    p: { x: W / 2, y: H * 0.62, r: 15 * U, hp: maxHp, maxHp, face: 1, inv: 0, fireCd: 0.3, walk: 0, moving: false },
    dmg: 10 * 1.15 ** lv.atk, interval: fireInterval(lv.rate), ultMul: 1.2 ** lv.ult,
    skewers: 3, ult: 0, ring: null, shake: 0,
    zs: [], bs: [], fx: [], txt: [], seed: 1,
  };
}
function rnd() { G.seed = (G.seed * 16807) % 2147483647; return (G.seed - 1) / 2147483646; }
const ZT = {
  walker: { r: 13, hp: 30, sp: 36, dmg: 6, col: '#8fbf7a', ult: 4 },
  runner: { r: 10, hp: 18, sp: 72, dmg: 5, col: '#b6d98f', ult: 3 },
  tank:   { r: 21, hp: 140, sp: 24, dmg: 12, col: '#7f8fb8', ult: 10 },
  boss:   { r: 42, hp: 3200, sp: 20, dmg: 28, col: '#9a6fb0', ult: 60 },
};
function spawn(type) {
  const T = ZT[type], d = diff(), scale = (1 + G.t / 75) * HP_G ** (d - 1), side = Math.floor(rnd() * 4), m = 30 * U;
  let x, y;
  if (side === 0) { x = rnd() * W; y = -m; } else if (side === 1) { x = W + m; y = rnd() * H; }
  else if (side === 2) { x = rnd() * W; y = H + m; } else { x = -m; y = rnd() * H; }
  const hp = type === 'boss' ? T.hp * HP_G ** (d - 1) * (1 + G.t / 300) : T.hp * scale;
  G.zs.push({ type, x, y, r: T.r * U, hp, maxHp: hp, sp: T.sp * U * (0.9 + rnd() * 0.2) * Math.min(1.5, 1 + (d - 1) * 0.008), dmg: T.dmg * (1 + (d - 1) * 0.05), col: T.col, flash: 0, kx: 0, ky: 0, slow: 0, burn: 0, wob: rnd() * 6 });
}
// 难度档：关卡 = 关号；无尽 = 50 起每 30 秒 +1
function diff() { return G.mode === 'endless' ? MAX_LV + G.t / 30 : G.n; }
function spawner(dt) {
  const t = G.t, d = diff(), rate = Math.min(5.5 + (d - 1) * 0.04, (0.7 + t / 38) * (1 + (d - 1) * 0.02));
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1 && G.zs.length < 140) {
    G.spawnAcc -= 1;
    const r = rnd();
    spawn(t > 60 && r < 0.12 ? 'tank' : t > 25 && r < 0.4 ? 'runner' : 'walker');
  }
  if (t >= G.nextBoss) { G.nextBoss = G.mode === 'endless' ? G.nextBoss + 60 : Infinity; spawn('boss'); toast('差评僵尸王来了！'); }
}
function nearest() {
  let best = null, bd = Infinity; const p = G.p;
  for (const z of G.zs) { if (z.x < -10 || z.x > W + 10 || z.y < -10 || z.y > H + 10) continue; const d = (z.x - p.x) ** 2 + (z.y - p.y) ** 2; if (d < bd) { bd = d; best = z; } }
  return best;
}
function fire() {
  const z = nearest(); if (!z) return false;
  const p = G.p, a0 = Math.atan2(z.y - p.y, z.x - p.x), n = G.skewers, spread = 0.2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * spread, sp = 420 * U;
    G.bs.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, life: 0.9, dmg: G.dmg, pierce: 1, hit: new Set() });
  }
  p.face = Math.cos(a0) >= 0 ? 1 : -1;
  return true;
}
function castUlt() {
  if (!G || G.over || paused || G.ult < 100 || G.ring) return false;
  G.ult = 0; G.ring = { t: 0, dur: 3.5, tick: 0 }; G.shake = 0.35; G.p.inv = Math.max(G.p.inv, 0.6);
  toast('火圈！'); return true;
}
function hurtZ(z, d, kx, ky) {
  z.hp -= d; z.flash = 0.1; z.kx += kx; z.ky += ky;
  G.txt.push({ x: z.x, y: z.y - z.r, v: Math.round(d), t: 0.6 });
}
function killZ(i) {
  const z = G.zs[i];
  G.kills++; G.ult = Math.min(100, G.ult + ZT[z.type].ult);
  for (let k = 0; k < 6; k++) G.fx.push({ x: z.x, y: z.y, vx: (rnd() - 0.5) * 160 * U, vy: (rnd() - 0.5) * 160 * U, t: 0.4, c: z.col });
  G.zs.splice(i, 1);
  const want = Math.min(7, 3 + Math.floor(G.kills / 30));
  if (want > G.skewers) { G.skewers = want; toast(`飞串 +1（×${want}）`); }
  if (z.type === 'boss') toast('僵尸王倒了！');
}
function step(dt) {
  if (!G || G.over) return;
  dt = Math.min(Math.max(fin(dt, 0), 0), 0.05);
  const p = G.p; G.t += dt;
  // 移动
  const mv = joyVec(); p.moving = mv.m > 0.05;
  if (p.moving) { const sp = 150 * U; p.x += mv.x * sp * dt; p.y += mv.y * sp * dt; p.walk += dt * 10; if (Math.abs(mv.x) > 0.2) p.face = mv.x > 0 ? 1 : -1; }
  p.x = Math.min(Math.max(p.x, p.r), W - p.r); p.y = Math.min(Math.max(p.y, p.r + 70 * U), H - p.r);
  p.inv = Math.max(0, p.inv - dt);
  // 普攻
  p.fireCd -= dt; if (p.fireCd <= 0) { p.fireCd = fire() ? G.interval : 0.1; }
  G.ult = Math.min(100, G.ult + 2 * dt);
  spawner(dt);
  // 飞串
  for (let i = G.bs.length - 1; i >= 0; i--) {
    const b = G.bs[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40;
    if (!dead) for (const z of G.zs) {
      if (b.hit.has(z)) continue;
      if ((z.x - b.x) ** 2 + (z.y - b.y) ** 2 < (z.r + 5 * U) ** 2) {
        b.hit.add(z); hurtZ(z, b.dmg, b.vx * 0.02, b.vy * 0.02);
        if (--b.pierce < 0) { dead = true; break; }
      }
    }
    if (dead) G.bs.splice(i, 1);
  }
  // 火圈：跟着 77，半径先涨后稳，每 0.25 秒灼烧一次并推开
  if (G.ring) {
    const R = G.ring; R.t += dt; R.tick -= dt;
    const rad = ringRadius(R);
    if (R.tick <= 0) {
      R.tick = 0.25;
      for (const z of G.zs) {
        const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < rad + z.r) hurtZ(z, 14 * G.ultMul * (1 + G.t / 90), dx / d * 60 * U, dy / d * 60 * U);
      }
    }
    if (R.t >= R.dur) G.ring = null;
  }
  // 僵尸
  for (let i = G.zs.length - 1; i >= 0; i--) {
    const z = G.zs[i];
    if (z.hp <= 0) { killZ(i); continue; }
    const dx = p.x - z.x, dy = p.y - z.y, d = Math.hypot(dx, dy) || 1;
    z.x += (dx / d * z.sp + z.kx * 10) * dt; z.y += (dy / d * z.sp + z.ky * 10) * dt;
    z.kx *= 0.85; z.ky *= 0.85; z.flash = Math.max(0, z.flash - dt); z.wob += dt * 6;
    if (d < z.r + p.r && p.inv <= 0) {
      p.hp -= z.dmg; p.inv = 0.8; G.shake = 0.15;
      if (p.hp <= 0) { p.hp = 0; end(false); return; }
    }
  }
  // 僵尸之间简单分开，避免叠成一团
  const zs = G.zs;
  for (let i = 0; i < zs.length; i++) for (let j = i + 1; j < zs.length; j++) {
    const a = zs[i], b = zs[j], dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
    if (d2 > 0 && d2 < rr * rr) { const d = Math.sqrt(d2), o = (rr - d) / 2, ux = dx / d, uy = dy / d; const wa = b.r / rr, wb = a.r / rr; a.x -= ux * o * wa; a.y -= uy * o * wa; b.x += ux * o * wb; b.y += uy * o * wb; }
  }
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.x += f.vx * dt; f.y += f.vy * dt; f.t -= dt; if (f.t <= 0) G.fx.splice(i, 1); }
  for (let i = G.txt.length - 1; i >= 0; i--) { const f = G.txt[i]; f.y -= 30 * U * dt; f.t -= dt; if (f.t <= 0) G.txt.splice(i, 1); }
  G.shake = Math.max(0, G.shake - dt);
  if (G.mode === 'level' && G.t >= G.dur) end(true);
}
const ringRadius = R => (40 + 80 * Math.min(1, R.t / 0.4)) * U;

// ---- 摇杆：按下处为中心，拖动方向即移动方向 ----
const joy = { on: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
const JR = 52;
function joyVec() { if (!joy.on) return { x: 0, y: 0, m: 0 }; const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy); if (d < 1) return { x: 0, y: 0, m: 0 }; const m = Math.min(1, d / JR); return { x: dx / d * m, y: dy / d * m, m }; }
cv.addEventListener('pointerdown', e => { if (!G || G.over || paused || joy.on) return; joy.on = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; try { cv.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); });
cv.addEventListener('pointermove', e => { if (joy.on && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const joyEnd = e => { if (e.pointerId === joy.id) { joy.on = false; joy.id = null; } };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
document.addEventListener('touchmove', e => { if (G && !G.over) e.preventDefault(); }, { passive: false });

// ---- 绘制 ----
function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  const sh = G.shake > 0 ? G.shake * 18 * U : 0;
  ctx.save(); if (sh) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  // 地面：烧烤夜市地砖
  ctx.strokeStyle = 'rgba(20,20,20,.08)'; ctx.lineWidth = 2; const g = 48 * U;
  for (let x = (W / 2) % g; x < W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  if (G.ring) drawRing(G.ring);
  const drawHero = HERO_DRAW[G.ceo] || draw77;
  const ents = [...G.zs.map(z => ({ y: z.y, f: () => drawZ(z) })), { y: G.p.y, f: () => drawHero(G.p) }].sort((a, b) => a.y - b.y);
  for (const e of ents) e.f();
  for (const b of G.bs) drawSkewer(b);
  for (const f of G.fx) { ctx.globalAlpha = Math.max(0, f.t / 0.4); ctx.fillStyle = f.c; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(f.x, f.y, 4 * U, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.font = `900 ${Math.round(13 * U)}px -apple-system,sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
  for (const f of G.txt) { ctx.globalAlpha = Math.min(1, f.t / 0.3); ctx.strokeText(f.v, f.x, f.y); ctx.fillStyle = INK; ctx.fillText(f.v, f.x, f.y); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (joy.on) {
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.fillStyle = 'rgba(255,250,240,.6)';
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, JR, 0, 7); ctx.fill(); ctx.stroke();
    const v = joyVec(); ctx.fillStyle = YEL; ctx.beginPath(); ctx.arc(joy.ox + v.x * JR, joy.oy + v.y * JR, 20, 0, 7); ctx.fill(); ctx.stroke();
  }
}
function outline(w) { ctx.lineWidth = w || 2.5 * U; ctx.strokeStyle = INK; ctx.stroke(); }
function draw77(p) {
  const s = U, x = p.x, y = p.y, bob = p.moving ? Math.sin(p.walk) * 2 * s : 0, f = p.face;
  if (p.inv > 0 && Math.floor(p.inv * 20) % 2) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(20,20,20,.18)'; ctx.beginPath(); ctx.ellipse(x, y + 16 * s, 15 * s, 5 * s, 0, 0, 7); ctx.fill();
  // 腿
  ctx.fillStyle = '#3a2a22'; const lg = p.moving ? Math.sin(p.walk) * 4 * s : 0;
  ctx.beginPath(); ctx.roundRect(x - 7 * s, y + 6 * s - lg * 0.3, 5 * s, 10 * s + lg * 0.3, 2 * s); ctx.fill(); outline(2 * s);
  ctx.beginPath(); ctx.roundRect(x + 2 * s, y + 6 * s + lg * 0.3, 5 * s, 10 * s - lg * 0.3, 2 * s); ctx.fill(); outline(2 * s);
  // 红 T 恤 + 棕围裙
  ctx.fillStyle = RED; ctx.beginPath(); ctx.roundRect(x - 11 * s, y - 8 * s + bob, 22 * s, 18 * s, 6 * s); ctx.fill(); outline();
  ctx.fillStyle = '#6b4226'; ctx.beginPath(); ctx.roundRect(x - 7 * s, y - 5 * s + bob, 14 * s, 16 * s, 3 * s); ctx.fill(); outline(2 * s);
  // 手里的夹子
  ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x + f * 10 * s, y + bob); ctx.lineTo(x + f * 20 * s, y - 8 * s + bob); ctx.stroke();
  // 头
  const hy = y - 18 * s + bob;
  ctx.fillStyle = '#4a2c1d'; ctx.beginPath(); ctx.ellipse(x - f * 12 * s, hy - 2 * s, 6 * s, 10 * s, -f * 0.5, 0, 7); ctx.fill(); outline(2 * s); // 马尾
  ctx.fillStyle = '#f6d7c3'; ctx.beginPath(); ctx.arc(x, hy, 11 * s, 0, 7); ctx.fill(); outline();
  ctx.fillStyle = '#4a2c1d'; ctx.beginPath(); ctx.arc(x, hy - 2 * s, 11.5 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); outline(2 * s); // 刘海
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + f * 3 * s - 3 * s, hy + 2 * s, 1.6 * s, 0, 7); ctx.arc(x + f * 3 * s + 3 * s, hy + 2 * s, 1.6 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#f4a3a8'; ctx.beginPath(); ctx.ellipse(x - f * 7 * s, hy - 11 * s, 4 * s, 3 * s, 0.4, 0, 7); ctx.ellipse(x - f * 1 * s, hy - 12 * s, 4 * s, 3 * s, -0.4, 0, 7); ctx.fill(); outline(1.5 * s); // 粉蝴蝶结
  ctx.globalAlpha = 1;
}
const HERO_DRAW = { c77: draw77 };
function drawZ(z) {
  const s = z.r / 13, x = z.x, y = z.y, w = Math.sin(z.wob) * 1.5 * s;
  ctx.fillStyle = 'rgba(20,20,20,.18)'; ctx.beginPath(); ctx.ellipse(x, y + z.r * 0.9, z.r, z.r * 0.35, 0, 0, 7); ctx.fill();
  ctx.fillStyle = z.flash > 0 ? '#fff' : z.col;
  ctx.beginPath(); ctx.roundRect(x - 9 * s, y - 4 * s, 18 * s, 16 * s, 5 * s); ctx.fill(); outline(2.5 * U);
  ctx.beginPath(); ctx.arc(x + w, y - 10 * s, 9 * s, 0, 7); ctx.fill(); outline(2.5 * U);
  const dir = G.p.x >= x ? 1 : -1;
  ctx.beginPath(); ctx.moveTo(x + dir * 6 * s, y); ctx.lineTo(x + dir * 17 * s, y - 2 * s + w); ctx.lineWidth = 4 * s; ctx.strokeStyle = z.flash > 0 ? '#fff' : z.col; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * s; ctx.beginPath();
  for (const ex of [-3.5, 3.5]) { const cx = x + w + ex * s + dir * s, cy = y - 11 * s; ctx.moveTo(cx - 1.8 * s, cy - 1.8 * s); ctx.lineTo(cx + 1.8 * s, cy + 1.8 * s); ctx.moveTo(cx + 1.8 * s, cy - 1.8 * s); ctx.lineTo(cx - 1.8 * s, cy + 1.8 * s); }
  ctx.stroke();
  if (z.type === 'boss' || z.type === 'tank') {
    const bw = z.r * 1.8; ctx.fillStyle = '#fff'; ctx.fillRect(x - bw / 2, y - z.r - 14 * U, bw, 5 * U);
    ctx.fillStyle = RED; ctx.fillRect(x - bw / 2, y - z.r - 14 * U, bw * Math.max(0, z.hp / z.maxHp), 5 * U);
    ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.strokeRect(x - bw / 2, y - z.r - 14 * U, bw, 5 * U);
    if (z.type === 'boss') { ctx.font = `900 ${Math.round(12 * U)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = INK; ctx.fillText('差评', x + w, y - 8 * s); }
  }
}
function drawSkewer(b) {
  const s = U; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a);
  ctx.strokeStyle = '#c89b5a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(12 * s, 0); ctx.stroke();
  for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 1 ? '#f2c14e' : '#a8432f'; ctx.beginPath(); ctx.roundRect(-9 * s + i * 7 * s, -3.5 * s, 6 * s, 7 * s, 1.5 * s); ctx.fill(); ctx.lineWidth = 1.5 * s; ctx.strokeStyle = INK; ctx.stroke(); }
  ctx.restore();
}
function drawRing(R) {
  const p = G.p, rad = ringRadius(R), a = R.t / R.dur;
  ctx.save(); ctx.globalAlpha = 0.85 - a * 0.4;
  ctx.fillStyle = 'rgba(255,140,40,.22)'; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fill();
  const n = 14;
  for (let i = 0; i < n; i++) {
    const ang = i / n * Math.PI * 2 + R.t * 2.2, fx = p.x + Math.cos(ang) * rad, fy = p.y + Math.sin(ang) * rad, h = (14 + Math.sin(R.t * 12 + i) * 4) * U;
    ctx.fillStyle = i % 2 ? RED : '#ff9f1c'; ctx.beginPath(); ctx.moveTo(fx - 7 * U, fy + 4 * U); ctx.quadraticCurveTo(fx - 6 * U, fy - h * 0.6, fx, fy - h); ctx.quadraticCurveTo(fx + 6 * U, fy - h * 0.6, fx + 7 * U, fy + 4 * U); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2 * U; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.restore();
}

// ---- UI ----
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1100); }
function hud() {
  const p = G.p, sec = G.mode === 'level' ? Math.max(0, Math.ceil(G.dur - G.t)) : Math.floor(G.t);
  $('#hpFill').style.width = (p.hp / p.maxHp * 100) + '%'; $('#hpTxt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('#clock').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  $('#lvlTxt').textContent = G.mode === 'level' ? `第 ${G.n} 关${isBossLv(G.n) ? '·Boss' : ''}` : `无尽 难度 ${Math.floor(diff())}`;
  $('#killTxt').textContent = `击倒 ${G.kills}`; $('#skewTxt').textContent = `飞串 ×${G.skewers}`;
  const ub = $('#ultBtn'), ready = G.ult >= 100 && !G.ring;
  $('#ultFill').style.height = G.ult + '%'; ub.disabled = !ready; ub.classList.toggle('ready', ready);
}
function renderLv() {
  const top = Math.min(MAX_LV, proto.cleared + 1); selLv = Math.min(Math.max(1, selLv), top);
  $('#lvTxt').textContent = `第 ${selLv} 关`;
  $('#lvInfo').textContent = `${levelDur(selLv)} 秒${isBossLv(selLv) ? ' · Boss 关' : ''}${selLv <= proto.cleared ? ' · 已通关' : ''}`;
  $('#lvProg').textContent = `已通关 ${proto.cleared} / ${MAX_LV}`;
  $('#lvPrev').disabled = selLv <= 1; $('#lvNext').disabled = selLv >= top;
  const eb = $('#endlessBtn'), open = proto.cleared >= MAX_LV;
  eb.disabled = !open || !canPlay(); eb.textContent = open ? `无尽模式·最好 ${Math.floor(proto.endBest.t)} 秒` : `无尽·通关 ${MAX_LV} 关开放`;
}
function renderHero() {
  const id = proto.ceo, h = id && ZB.HEROES[id], name = h ? h.name : 'CEO';
  $('#heroName').textContent = `${name} 打僵尸`; document.title = `${name} 打僵尸`;
  const img = $('.hero img'), src = `../art/face_${id || 'c77'}.webp`; if (img.getAttribute('src') !== src) { img.setAttribute('src', src); img.alt = name; }
  $('#heroNote').textContent = !proto.ready ? '' : !id ? '烧烤摊还没派 CEO：回经营页派一位再来打。' : skilled(id) ? `本局由 ${name} 上场，开打后不换人。` : `${name} 上场：专属技能还在做，这局先用 77 的飞串和火圈。`;
  const sb = $('#startBtn'); sb.disabled = !canPlay(); sb.textContent = proto.ready && !id ? '烧烤摊没有 CEO，先回经营页派一位' : '开打！';
  const ub = $('#ultBtn .ult-lbl'); if (ub && h && h.ult) ub.textContent = h.ult;
}
function renderTrain() {
  renderLv(); renderHero();
  $('#walletTxt').textContent = proto.ready ? fmt(Wallet.balance()) : '读取中…';
  $('#train').innerHTML = TRAIN.map(t => {
    const lv = proto.lv[t.id], max = lv >= MAX_TRAIN, c = price(t, lv);
    return `<div class="tr"><div class="t"><b>${t.name} Lv${lv}</b><small>${t.desc(lv)}</small></div>
      <button class="buy" type="button" data-tr="${t.id}" ${max || !Wallet.canSpend(c) ? 'disabled' : ''}>${max ? '已满级' : '升级 ' + fmt(c)}</button></div>`;
  }).join('');
}
$('#train').addEventListener('click', e => {
  const b = e.target.closest('[data-tr]'); if (!b) return;
  const t = TRAIN.find(x => x.id === b.dataset.tr), lv = proto.lv[t.id];
  if (lv >= MAX_TRAIN) return;
  if (EMBED) { if (Wallet.canSpend(price(t, lv))) { pend = true; host({ zb: 'buy', id: t.id }); } }
  else if (Wallet.spend(price(t, lv))) { proto.lv[t.id] = lv + 1; saveProto(); }
  renderTrain();
});
function show(id) { for (const s of ['#menu', '#pause', '#result']) $(s).classList.toggle('hidden', s !== id); $('#hud').classList.toggle('hidden', id === '#menu'); }
function start(mode, n) {
  if (!canPlay()) return false;
  if (mode === 'endless' && proto.cleared < MAX_LV) return false;
  if (mode !== 'endless') { mode = 'level'; n = Math.min(Math.max(1, Math.floor(fin(n, selLv))), Math.min(MAX_LV, proto.cleared + 1)); selLv = n; }
  resize(); G = newRun(mode, n); paused = false; joy.on = false; show(null); hud(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
function end(win) {
  G.over = true; G.win = win; joy.on = false; G.prevBest = proto.endBest.t; G.why = '';
  if (EMBED) {
    // 经营页是唯一写档方：等它回执（ack:'result'）后再按权威进度显示通关 / 解锁，存档失败不报喜
    G.wait = true; host({ zb: 'result', mode: G.mode, n: G.n, win, t: G.t, kills: G.kills, ceo: G.ceo });
  } else {
    proto.best = Math.max(proto.best, G.kills);
    if (G.mode === 'endless') { if (G.t > proto.endBest.t) proto.endBest = { t: G.t, kills: G.kills }; }
    else if (win) proto.cleared = Math.max(proto.cleared, G.n);
    saveProto();
  }
  renderResult(); show('#result');
}
function renderResult() {
  if (!G || !G.over) return;
  let title, again = '再来一局';
  const saved = G.mode === 'endless' ? proto.endBest.t >= G.t - 1e-6 : proto.cleared >= G.n;
  if (G.wait) title = '结算中…';
  else if (G.mode === 'endless') title = G.why ? '无尽结算（没存上）' : saved && G.t > G.prevBest ? '无尽新纪录！' : '无尽结算';
  else if (G.win && saved) { title = G.n >= MAX_LV ? `第 ${G.n} 关通关！无尽模式开放` : `第 ${G.n} 关通关！`; again = G.n >= MAX_LV ? '进入无尽' : '下一关'; }
  else if (G.win) { title = `第 ${G.n} 关没存上`; again = '再打一次'; }
  else title = `第 ${G.n} 关失败…`;
  $('#resTitle').textContent = title; $('#againBtn').textContent = again; $('#againBtn').disabled = !!G.wait;
  $('#resNote').textContent = G.wait ? '正在存档…' : G.why;
  $('#resStats').textContent = G.mode === 'endless' ? `坚持 ${Math.floor(G.t)} 秒 · 击倒 ${G.kills} · 最好 ${Math.floor(proto.endBest.t)} 秒`
    : `坚持 ${Math.floor(G.t)} / ${G.dur} 秒 · 击倒 ${G.kills}`;
}
function setPause(on) { if (!G || G.over) return; paused = on; joy.on = false; show(on ? '#pause' : null); if (!on) last = performance.now(); }
function loop(now) {
  const dt = (now - last) / 1000; last = now;
  if (G && !G.over && !paused) { step(dt); if (G) hud(); }
  draw();
  raf = requestAnimationFrame(loop);
}
$('#startBtn').addEventListener('click', () => start('level', selLv));
$('#endlessBtn').addEventListener('click', () => start('endless'));
$('#againBtn').addEventListener('click', () => {
  if (G && G.wait) return;
  if (!canPlay()) { G = null; renderTrain(); show('#menu'); draw(); return; }
  if (G && G.mode === 'endless') return start('endless');
  if (G && G.win && proto.cleared >= G.n) return G.n >= MAX_LV ? start('endless') : start('level', G.n + 1);
  start('level', G ? G.n : selLv);
});
$('#lvPrev').addEventListener('click', () => { selLv--; renderLv(); });
$('#lvNext').addEventListener('click', () => { selLv++; renderLv(); });
$('#menuBtn').addEventListener('click', () => { G = null; renderTrain(); show('#menu'); draw(); });
$('#pauseBtn').addEventListener('click', () => setPause(true));
$('#resumeBtn').addEventListener('click', () => setPause(false));
$('#quitBtn').addEventListener('click', () => { paused = false; end(false); });
$('#ultBtn').addEventListener('click', () => { castUlt(); hud(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

if (EMBED) {
  $('#walletLbl').textContent = '金币'; $('#exitBtn').classList.remove('hidden');
  $('#exitBtn').addEventListener('click', () => host({ zb: 'close' }));
}
selLv = Math.min(MAX_LV, proto.cleared + 1);
resize(); renderTrain(); draw();
// 测试钩子：只读状态 + 固定步长推进
window.__zb = { EMBED, get ceo() { return proto.ceo; }, renderResult, send: host, onState, canPlay, get lastSent() { return lastSent; }, get pend() { return pend; }, get G() { return G; }, proto, Wallet, step, castUlt, start, setPause, joy, PROTO_KEY, price, TRAIN, levelDur, renderTrain, saveProto, MAX_LV };
})();
