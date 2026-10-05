/* 躺着也能赚 v1（试玩版）— 四家店 · CEO + 员工 · 离线 · 每日双倍 · 不重复盲盒（32 普通 + 4 超级装饰）· CEO 穿搭 */
(() => {
'use strict';
const E = window.Economy, CFG = E.CFG;
const SAVE_KEY = 'tangzhe-save', BAK_KEY = 'tangzhe-save-bak', LOCK_KEY = 'tangzhe-tab-lock';
const INK = '#141414', PAPER = '#f7f1e3', RED = '#e63946', YELLOW = '#ffd23f', TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const now = () => Date.now();
const rid = () => (crypto && crypto.getRandomValues) ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map(x => x.toString(36)).join('') : String(Math.random()).slice(2);
const rand = () => { if (crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; return Math.random(); };

/* ================= 存档（版本号 + 多标签防重复） ================= */
const TAB = rid();
let frozen = false, state, migratedFrom = null;
function loadState() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { raw = null; }
  if (raw && raw.v !== CFG.SAVE_VERSION) { try { localStorage.setItem(BAK_KEY + '-v' + (raw.v || 0), JSON.stringify(raw)); } catch (e) {} }
  const m = E.migrate(raw, now());
  migratedFrom = raw ? (raw.v !== CFG.SAVE_VERSION ? (raw.v || 0) : null) : null;
  return m.st;
}
function storedRev() { try { const r = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return r ? (r.rev || 0) : -1; } catch (e) { return -1; } }
// 保存 = 先确认没有别的页面写过（rev 比我新就冻结本页），再整份原子写入
function persist() {
  if (frozen) return false;
  const sr = storedRev();
  if (sr > state.rev) { freeze(); return false; }
  const t = now();
  if (t > state.lastSeen) state.lastSeen = t;
  state.maxSeen = Math.max(state.maxSeen || 0, state.lastSeen);
  state.rev++;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
  catch (e) { state.rev--; toast('存档失败：浏览器存储不可用（无痕模式？）'); return false; }
}
// 关键操作（领钱、开盲盒）：失败就回滚内存，保证「扣钱/入账/记录」要么一起成功要么都没发生
function atomic(fn) {
  const snap = JSON.stringify(state);
  const res = fn();
  if (res && res.ok === false) return res;
  if (!persist()) { state = JSON.parse(snap); return { ok:false, why:'saveFailed' }; }
  return res;
}
function claimLock() { try { localStorage.setItem(LOCK_KEY, JSON.stringify({ tab:TAB, t:now() })); } catch (e) {} }
function lockMine() { try { const v = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); return !v || v.tab === TAB; } catch (e) { return true; } }
function freeze() {
  if (frozen) return; frozen = true;
  $('#lockOverlay').classList.remove('hidden'); audioPause();
}
window.addEventListener('storage', e => {
  if (frozen) return;
  if (e.key === LOCK_KEY && e.newValue) { try { if (JSON.parse(e.newValue).tab !== TAB) freeze(); } catch (x) {} }
  if (e.key === SAVE_KEY && e.newValue) { try { if ((JSON.parse(e.newValue).rev || 0) > state.rev) freeze(); } catch (x) {} }
});
$('#lockResume').addEventListener('click', () => location.reload());

/* ================= 数字/时间格式 ================= */
function fmt(n) {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a < 100) return (Math.round(n * 10) / 10).toLocaleString('en-US');
  if (a < 1e5) return Math.floor(n).toLocaleString('en-US');
  if (a < 1e8) return (n / 1e4).toFixed(a < 1e6 ? 2 : 1) + '万';
  if (a < 1e12) return (n / 1e8).toFixed(2) + '亿';
  return (n / 1e12).toFixed(2) + '万亿';
}
function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (h) return h + '小时' + (m ? m + '分' : '');
  if (m) return m + '分' + (s && m < 10 ? s + '秒' : '');
  return s + '秒';
}
function fmtClockMYT(ts) { const d = new Date(ts + CFG.TZ_OFFSET_MIN * 60000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }

/* ================= 声音（切后台/锁屏立即暂停） ================= */
const AU = { ctx:null, master:null, bgm:null, sfx:null, timer:null, nextT:0, step:0, started:false };
function audioInit() {
  if (AU.ctx) return;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AU.ctx = new C(); AU.master = AU.ctx.createGain(); AU.master.connect(AU.ctx.destination);
  AU.bgm = AU.ctx.createGain(); AU.bgm.gain.value = 0.09; AU.bgm.connect(AU.master);
  AU.sfx = AU.ctx.createGain(); AU.sfx.gain.value = 0.5; AU.sfx.connect(AU.master);
  AU.master.gain.value = state.muted ? 0 : 1;
}
function audioUnlock() { // 只能在用户手势里调用（iOS）
  audioInit(); if (!AU.ctx) return;
  if (AU.ctx.state !== 'running' && !document.hidden && !state.muted) AU.ctx.resume().catch(() => {});
  if (!AU.started) { AU.started = true; startBgm(); }
}
function audioPause() { if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend().catch(() => {}); stopBgm(); }
function audioResume() { if (!AU.ctx || state.muted || document.hidden || frozen) return; AU.ctx.resume().catch(() => {}); if (AU.started) startBgm(); }
function tone(f, t, dur, type = 'sine', vol = 0.3, dest = AU.sfx, f2) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}
function sfx(name) {
  if (!AU.ctx || AU.ctx.state !== 'running' || state.muted) return;
  const t = AU.ctx.currentTime;
  switch (name) {
    case 'tap': tone(880 + Math.random() * 120, t, 0.08, 'square', 0.12); tone(1320, t + 0.03, 0.08, 'sine', 0.1); break;
    case 'crit': tone(660, t, 0.1, 'square', 0.15); tone(990, t + 0.06, 0.1, 'square', 0.15); tone(1480, t + 0.12, 0.18, 'sine', 0.18); break;
    case 'buy': tone(1046, t, 0.07, 'triangle', 0.22); tone(1568, t + 0.06, 0.14, 'triangle', 0.22); break;
    case 'no': tone(160, t, 0.18, 'sawtooth', 0.12, AU.sfx, 120); break;
    case 'mile': [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 'triangle', 0.22)); break;
    case 'swoosh': tone(300, t, 0.25, 'sawtooth', 0.08, AU.sfx, 1200); tone(1200, t + 0.2, 0.2, 'triangle', 0.15, AU.sfx, 600); break;
    case 'box': for (let i = 0; i < 8; i++) tone(180 + i * 25, t + i * 0.07, 0.06, 'square', 0.1); break;
    case 'reveal': [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.3, 'sine', 0.2)); break;
    case 'big': tone(392, t, 0.12, 'square', 0.15); tone(523, t + 0.1, 0.12, 'square', 0.15); tone(784, t + 0.2, 0.3, 'square', 0.15); break;
    case 'coin': tone(1760, t, 0.06, 'square', 0.08); tone(2349, t + 0.05, 0.12, 'sine', 0.1); break;
  }
}
const N = s => 440 * Math.pow(2, (s - 69) / 12);
const CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]];
const MEL = [72, 0, 74, 76, 0, 79, 76, 0, 74, 0, 72, 74, 0, 0, 69, 0, 72, 0, 74, 76, 0, 81, 79, 0, 76, 0, 74, 72, 0, 0, 0, 0];
function startBgm() { if (AU.timer || !AU.ctx) return; AU.nextT = AU.ctx.currentTime + 0.1; AU.timer = setInterval(scheduleBgm, 120); }
function stopBgm() { if (AU.timer) { clearInterval(AU.timer); AU.timer = null; } }
function scheduleBgm() {
  if (!AU.ctx || AU.ctx.state !== 'running') return;
  const spb = 0.2;
  while (AU.nextT < AU.ctx.currentTime + 0.4) {
    const st = AU.step % 32, bar = Math.floor(AU.step / 8) % 4;
    if (st % 8 === 0) CHORDS[bar].forEach(n => tone(N(n), AU.nextT, spb * 7, 'triangle', 0.12, AU.bgm));
    if (MEL[st]) tone(N(MEL[st]), AU.nextT, spb * 0.9, 'square', 0.07, AU.bgm);
    if (st % 4 === 2) tone(N(36 + CHORDS[bar][0] % 12), AU.nextT, 0.12, 'sine', 0.25, AU.bgm);
    AU.nextT += spb; AU.step++;
  }
}

/* ================= 画面：漫画风店铺 + 角色 ================= */
const cv = $('#scene'), g = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, U = 1, bgCache = null, bgKey = '';
const SHOP_STYLE = [
  { wall:'#ffe8d6', awn:RED, counter:'#8d5524', accent:'#ff7b00' },
  { wall:'#fde2f3', awn:'#ff8fab', counter:'#f1c0e8', accent:'#9b5de5' },
  { wall:'#e0f2fe', awn:'#3a86ff', counter:'#ffd166', accent:'#ef476f' },
  { wall:'#e9ecef', awn:'#2b2d42', counter:'#adb5bd', accent:'#06d6a0' },
];
const LOOKS = {
  c77:    { skin:'#ffe0c7', hair:'#1b1b1b', style:'bangs', bow:'#ff4f9a', top:'#ffffff', apron:'#ff5a7a', female:true, tag:'77' },
  pearl:  { skin:'#ffe0c7', hair:'#6b3e26', style:'bun', top:'#9b5de5', pearls:true, female:true, lips:true },
  otaku:  { skin:'#ffe6d0', hair:'#2b2b2b', style:'messy', glasses:true, top:'#2a9d8f', hood:true },
  rocket: { skin:'#ffe0c7', hair:'#3b2a20', style:'swept', top:'#222222', rocketLogo:true, smug:true },
  e0:     { skin:'#ffd9b8', hair:'#222', style:'short', headband:RED, top:'#f4a261' },
  e1:     { skin:'#ffe0c7', hair:'#222', style:'twin', top:'#ffafcc', female:true, apron:'#fff' },
  e2:     { skin:'#ffe6d0', hair:'#333', style:'cover', top:'#8ecae6', sleepy:true },
  e3:     { skin:'#f6d1b0', hair:'#666', style:'bald', top:'#adb5bd', headset:true, tie:true },
};
const CLOTHES = {
  c_apron:  { top:'#ffffff', apron:'#c0392b', pattern:'oil' },
  c_flower: { top:'#ffd23f', apron:null, pattern:'flower' },
  c_work:   { top:'#3a6ea5', apron:null, pattern:'overall' },
  c_panda:  { top:'#ffffff', apron:null, pattern:'panda' },
  c_gold:   { top:'#ffffff', apron:null, pattern:'goldvest' },
  c_qipao:  { top:'#9b5de5', apron:null, pattern:'qipao' },
  c_hoodie: { top:'#2a9d8f', apron:null, pattern:'manga' },
  c_space:  { top:'#e9ecef', apron:null, pattern:'space' },
  c_suit:   { top:'#264653', apron:null, pattern:'suit' },
};
// 穿搭跟着 CEO 走：每位 CEO 有自己的衣服 / 帽子（state.wear[id]）
function wearOf(id) { return (state.wear && state.wear[id]) || {}; }
function lookOf(id) {
  const base = LOOKS[id]; if (!E.CEO_BY_ID[id]) return base;
  const L = Object.assign({}, base), eq = wearOf(id);
  if (eq.clothes && CLOTHES[eq.clothes]) Object.assign(L, CLOTHES[eq.clothes], { rocketLogo:false, hood:false, tie:false, tag:id === 'c77' ? base.tag : null });
  if (eq.hat) L.hat = eq.hat;
  return L;
}
function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, r.width); H = Math.max(1, r.height); U = H / 260;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  bgKey = '';
}
const P = (fn) => { const p = new Path2D(); fn(p); return p; };
function rr(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function inkFill(c, fill, lw) { if (fill) { c.fillStyle = fill; c.fill(); } c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); }
const patCache = new WeakMap();
function dotsPattern(c, color, step) {
  let m = patCache.get(c); if (!m) patCache.set(c, m = {});
  const key = color + '|' + Math.round(step * 10) + '|' + DPR; if (m[key]) return m[key];
  return (m[key] = makeDots(c, color, step));
}
function makeDots(c, color, step) {
  const o = document.createElement('canvas'); o.width = o.height = Math.max(4, Math.round(step * DPR));
  const x = o.getContext('2d'); x.fillStyle = color; x.beginPath(); x.arc(o.width / 2, o.height / 2, o.width * 0.18, 0, TAU); x.fill();
  const p = c.createPattern(o, 'repeat'); if (p && p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(1 / DPR)); return p;
}
const L = () => ({ ground:H * 0.87, signY:H * 0.035, signH:H * 0.15, awnY:H * 0.2, awnH:H * 0.1, counterY:H * 0.6, x0:W * 0.04, x1:W * 0.96 });

function buildBg(i) {
  const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height;
  const c = o.getContext('2d'); c.scale(DPR, DPR);
  const S = SHOP_STYLE[i], l = L(), lw = 2.6 * U, open = state.shops[i].open;
  // 天空 + 网点
  c.fillStyle = '#fffaf0'; c.fillRect(0, 0, W, H);
  c.fillStyle = dotsPattern(c, 'rgba(20,20,20,.16)', 7 * U); c.fillRect(0, 0, W, H * 0.6);
  // 远处楼
  for (let k = 0; k < 7; k++) { const bw = W * 0.16, bx = k * W * 0.15 - W * 0.04, bh = H * (0.25 + ((k * 37) % 5) * 0.06);
    rr(c, bx, l.ground - bh - H * 0.2, bw, bh, 0); inkFill(c, k % 2 ? '#efe8d8' : '#e6dfcd', 1.5 * U); }
  // 地面
  c.fillStyle = '#d9d3c5'; c.fillRect(0, l.ground, W, H - l.ground);
  c.strokeStyle = INK; c.lineWidth = lw; c.beginPath(); c.moveTo(0, l.ground); c.lineTo(W, l.ground); c.stroke();
  c.lineWidth = 1.2 * U; for (let x = -W; x < W * 2; x += 26 * U) { c.beginPath(); c.moveTo(x, l.ground); c.lineTo(x - 18 * U, H); c.stroke(); }
  // 店面
  const fx = l.x0, fw = l.x1 - l.x0, fy = l.awnY, fh = l.ground - l.awnY;
  rr(c, fx, fy, fw, fh, 0); inkFill(c, open ? S.wall : '#cfc8b8', lw);
  if (!open) {
    // 木板封着 + 招租
    for (let k = 0; k < 5; k++) { c.save(); c.translate(W / 2, fy + fh * (0.2 + k * 0.16)); c.rotate((k % 2 ? 1 : -1) * 0.06);
      rr(c, -fw * 0.46, -H * 0.03, fw * 0.92, H * 0.06, 2 * U); inkFill(c, '#c49a6c', 2 * U); c.restore(); }
    return o;
  }
  // 后墙道具
  const wy = fy + l.awnH, wh = l.counterY - wy;
  if (i === 0) { // 烧烤：串串挂架 + 烟
    for (let k = 0; k < 9; k++) { const x = fx + fw * (0.12 + k * 0.085); c.strokeStyle = INK; c.lineWidth = 2 * U; c.beginPath(); c.moveTo(x, wy + wh * 0.15); c.lineTo(x, wy + wh * 0.7); c.stroke();
      for (let j = 0; j < 3; j++) { c.beginPath(); c.arc(x, wy + wh * (0.25 + j * 0.13), 4.5 * U, 0, TAU); inkFill(c, j % 2 ? '#a0522d' : '#d2691e', 1.5 * U); } }
  } else if (i === 1) { // 奶茶：菜单板
    rr(c, fx + fw * 0.1, wy + wh * 0.12, fw * 0.5, wh * 0.66, 4 * U); inkFill(c, '#3d2c2e', lw);
    c.fillStyle = '#fff'; c.font = `900 ${10 * U}px sans-serif`; c.textAlign = 'left';
    ['珍珠奶茶', '杨枝甘露', '冰粉奶茶'].forEach((t, k) => c.fillText(t + '  ' + (12 + k * 3), fx + fw * 0.14, wy + wh * (0.32 + k * 0.17)));
  } else if (i === 2) { // 书架
    for (let r = 0; r < 2; r++) { const y = wy + wh * (0.12 + r * 0.42); rr(c, fx + fw * 0.08, y, fw * 0.6, wh * 0.36, 0); inkFill(c, '#8d6e63', lw);
      for (let k = 0; k < 14; k++) { const bx = fx + fw * (0.1 + k * 0.04); rr(c, bx, y + wh * 0.05 + (k % 3) * 2 * U, fw * 0.035, wh * 0.3 - (k % 3) * 2 * U, 0);
        inkFill(c, ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#fff'][k % 5], 1.2 * U); } }
  } else { // 科技：显示器墙 + 机柜
    for (let k = 0; k < 3; k++) { const x = fx + fw * (0.08 + k * 0.2); rr(c, x, wy + wh * 0.15, fw * 0.17, wh * 0.45, 3 * U); inkFill(c, '#1d3557', lw);
      c.strokeStyle = '#06d6a0'; c.lineWidth = 1.5 * U; for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(x + 5 * U, wy + wh * (0.25 + j * 0.08)); c.lineTo(x + fw * (0.05 + ((k + j) % 3) * 0.04), wy + wh * (0.25 + j * 0.08)); c.stroke(); } }
  }
  // 霓虹牌（装饰）
  if (decorOn('d_neon')) { c.save(); c.translate(W * 0.925, l.signY + l.signH * 0.55); c.rotate(0.1); rr(c, -24 * U, -15 * U, 48 * U, 30 * U, 6 * U); inkFill(c, '#2b2d42', 2 * U);
    c.shadowColor = '#ff4f9a'; c.shadowBlur = 8 * U; c.fillStyle = '#ff8fc7'; c.font = `900 ${19 * U}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('77', 0, 1 * U); c.restore(); }
  // 柜台
  const cy = l.counterY;
  rr(c, fx + fw * 0.06, cy, fw * 0.66, l.ground - cy, 0); inkFill(c, S.counter, lw);
  rr(c, fx + fw * 0.04, cy - 6 * U, fw * 0.7, 9 * U, 2 * U); inkFill(c, '#fff', lw);
  c.fillStyle = dotsPattern(c, 'rgba(20,20,20,.18)', 5 * U); c.fillRect(fx + fw * 0.06 + 2, cy + 4 * U, fw * 0.66 - 4, l.ground - cy - 6 * U);
  // 柜台上的道具
  if (i === 0) { rr(c, fx + fw * 0.12, cy - 18 * U, fw * 0.4, 14 * U, 2 * U); inkFill(c, '#333', lw); c.fillStyle = '#ff6b35'; c.fillRect(fx + fw * 0.13, cy - 9 * U, fw * 0.38, 4 * U); }
  else if (i === 1) { for (let k = 0; k < 3; k++) { const x = fx + fw * (0.16 + k * 0.12); c.beginPath(); c.moveTo(x - 8 * U, cy - 26 * U); c.lineTo(x + 8 * U, cy - 26 * U); c.lineTo(x + 6 * U, cy - 6 * U); c.lineTo(x - 6 * U, cy - 6 * U); c.closePath(); inkFill(c, '#f6e7d7', 2 * U);
    c.fillStyle = '#3d2c2e'; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(x - 4 * U + j * 2.6 * U, cy - 10 * U, 1.6 * U, 0, TAU); c.fill(); } c.strokeStyle = INK; c.lineWidth = 2 * U; c.beginPath(); c.moveTo(x + 2 * U, cy - 26 * U); c.lineTo(x + 5 * U, cy - 34 * U); c.stroke(); } }
  else if (i === 2) { for (let k = 0; k < 4; k++) { rr(c, fx + fw * (0.14 + k * 0.05), cy - 10 * U - k * 3 * U, fw * 0.12, 5 * U, 1 * U); inkFill(c, ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'][k], 1.5 * U); } }
  else { rr(c, fx + fw * 0.14, cy - 24 * U, fw * 0.2, 18 * U, 2 * U); inkFill(c, '#1d3557', 2 * U); rr(c, fx + fw * 0.4, cy - 30 * U, fw * 0.12, 24 * U, 2 * U); inkFill(c, '#495057', 2 * U); }
  return o;
}
function decorOn(id) { return state.gacha.owned.includes(id) && !(state.decorHidden || []).includes(id); }

/* ---------- 角色 ---------- */
function drawPerson(c, x, y, s, look, o = {}) {
  const t = o.t || 0, lw = 3 * s;
  c.save(); c.translate(x, y + (o.bob ? Math.sin(t * 6) * 1.6 * s : 0)); c.scale(o.flip ? -s : s, s);
  const LW = 3;
  // 腿
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 7;
  c.beginPath(); c.moveTo(-8, -34); c.lineTo(-9, -4); c.moveTo(8, -34); c.lineTo(9, -4); c.stroke();
  c.lineWidth = 4; c.strokeStyle = look.pattern === 'overall' ? '#2c5282' : '#555'; c.beginPath(); c.moveTo(-8, -32); c.lineTo(-9, -6); c.moveTo(8, -32); c.lineTo(9, -6); c.stroke();
  rr(c, -16, -6, 13, 7, 3); inkFill(c, '#333', 2); rr(c, 3, -6, 13, 7, 3); inkFill(c, '#333', 2);
  // 身体
  c.beginPath(); c.moveTo(-20, -36); c.quadraticCurveTo(-22, -66, -12, -72); c.lineTo(12, -72); c.quadraticCurveTo(22, -66, 20, -36); c.closePath();
  inkFill(c, look.top, LW);
  if (look.pattern === 'flower') { c.fillStyle = RED; for (const [px, py] of [[-10, -62], [6, -55], [-4, -45], [12, -66], [-14, -44], [10, -42]]) { c.beginPath(); c.arc(px, py, 2.6, 0, TAU); c.fill(); } }
  if (look.pattern === 'panda') { c.fillStyle = INK; c.beginPath(); c.ellipse(-9, -52, 6, 8, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(10, -46, 5, 7, -0.3, 0, TAU); c.fill(); }
  if (look.pattern === 'overall') { rr(c, -12, -58, 24, 22, 2); inkFill(c, '#2c5282', 2); c.strokeStyle = '#d2691e'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, -56); c.lineTo(10, -66); c.stroke(); }
  if (look.pattern === 'qipao') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -70); c.quadraticCurveTo(4, -64, 10, -66); c.stroke(); c.fillStyle = '#fff'; for (const [px, py] of [[-8, -56], [8, -50], [-4, -42], [10, -60]]) { c.beginPath(); c.arc(px, py, 2.2, 0, TAU); c.fill(); } c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(4, -64, 2, 0, TAU); c.fill(); }
  if (look.pattern === 'manga') { rr(c, -10, -62, 20, 15, 4); inkFill(c, '#fff', 1.8); c.fillStyle = INK; c.font = '900 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('！', 0, -54); c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -36); c.lineTo(-6, -44); c.moveTo(6, -36); c.lineTo(6, -44); c.stroke(); }
  if (look.pattern === 'space') { c.fillStyle = '#ff6b35'; c.fillRect(-19, -50, 38, 5); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(-19, -50, 38, 5); rr(c, -14, -66, 10, 8, 2); inkFill(c, '#118ab2', 1.5); c.fillStyle = RED; c.beginPath(); c.arc(9, -62, 3, 0, TAU); c.fill(); }
  if (look.pattern === 'suit') { c.beginPath(); c.moveTo(-8, -72); c.lineTo(0, -52); c.lineTo(8, -72); c.closePath(); inkFill(c, '#fff', 1.8); c.beginPath(); c.moveTo(0, -70); c.lineTo(-2.5, -62); c.lineTo(0, -52); c.lineTo(2.5, -62); c.closePath(); inkFill(c, RED, 1.2); c.fillStyle = '#fff'; c.fillRect(10, -64, 5, 3); }
  if (look.pattern === 'goldvest') { c.beginPath(); c.moveTo(-18, -38); c.lineTo(-13, -70); c.lineTo(-3, -50); c.lineTo(-3, -38); c.closePath(); inkFill(c, '#e9b824', 2); c.beginPath(); c.moveTo(18, -38); c.lineTo(13, -70); c.lineTo(3, -50); c.lineTo(3, -38); c.closePath(); inkFill(c, '#e9b824', 2); }
  if (look.apron) { c.beginPath(); c.moveTo(-12, -60); c.lineTo(12, -60); c.lineTo(15, -36); c.lineTo(-15, -36); c.closePath(); inkFill(c, look.apron, 2);
    if (look.pattern === 'oil') { c.fillStyle = '#ffb703'; c.beginPath(); c.arc(-5, -48, 2, 0, TAU); c.arc(5, -43, 1.6, 0, TAU); c.fill(); }
    if (look.tag) { c.fillStyle = '#fff'; c.font = '900 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(look.tag, 0, -48); } }
  if (look.tie) { c.beginPath(); c.moveTo(0, -70); c.lineTo(-3, -60); c.lineTo(0, -46); c.lineTo(3, -60); c.closePath(); inkFill(c, RED, 1.5); }
  if (look.rocketLogo) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -64); c.quadraticCurveTo(5, -56, 3, -48); c.lineTo(-3, -48); c.quadraticCurveTo(-5, -56, 0, -64); c.fill(); c.fillStyle = '#ff6b35'; c.beginPath(); c.moveTo(-2, -47); c.lineTo(0, -42); c.lineTo(2, -47); c.fill(); }
  if (look.pearls) { c.fillStyle = '#fff'; for (let k = -3; k <= 3; k++) { c.beginPath(); c.arc(k * 3.2, -69 + Math.abs(k) * -0.6 + 3, 1.9, 0, TAU); c.fill(); c.lineWidth = 0.8; c.stroke(); } }
  // 手臂
  const wave = o.pose === 'wave' ? Math.sin(t * 8) * 0.5 : 0, work = o.pose === 'work' ? Math.sin(t * 10) * 6 : 0;
  c.lineWidth = 6; c.strokeStyle = INK; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-18, -66); c.lineTo(-25, -46 + work); c.stroke();
  c.save(); c.translate(18, -66); c.rotate(o.pose === 'wave' ? -2.2 + wave : (o.pose === 'point' ? -1.2 : 0)); c.beginPath(); c.moveTo(0, 0); c.lineTo(7, 20 - (o.pose === 'work' ? work : 0)); c.stroke();
  c.fillStyle = look.skin; c.beginPath(); c.arc(7, 21, 3.6, 0, TAU); c.fill(); c.lineWidth = 2; c.stroke(); c.restore();
  c.lineWidth = 3.8; c.strokeStyle = look.top === '#222222' ? '#444' : look.top; c.beginPath(); c.moveTo(-18, -66); c.lineTo(-24, -48 + work); c.stroke();
  c.fillStyle = look.skin; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.arc(-25, -45 + work, 3.6, 0, TAU); c.fill(); c.stroke();
  // 头
  drawHead(c, look, o);
  c.restore();
}
function drawHead(c, look, o = {}) {
  const hy = -92, R = 19;
  // 后发
  c.fillStyle = look.hair; c.strokeStyle = INK; c.lineWidth = 3;
  if (look.style === 'bangs') { c.beginPath(); c.moveTo(-21, hy - 4); c.quadraticCurveTo(-25, hy + 22, -16, hy + 26); c.lineTo(16, hy + 26); c.quadraticCurveTo(25, hy + 22, 21, hy - 4); c.closePath(); c.fill(); c.stroke(); }
  if (look.style === 'bun') { c.beginPath(); c.arc(0, hy - 22, 9, 0, TAU); c.fill(); c.stroke(); }
  if (look.style === 'twin') { c.beginPath(); c.arc(-19, hy - 12, 8, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(19, hy - 12, 8, 0, TAU); c.fill(); c.stroke(); }
  // 脸
  c.beginPath(); c.arc(0, hy, R, 0, TAU); c.fillStyle = look.skin; c.fill(); c.stroke();
  // 前发
  c.fillStyle = look.hair; c.beginPath();
  if (look.style === 'bangs') { c.moveTo(-20, hy - 2); c.quadraticCurveTo(-20, hy - 22, 0, hy - 22); c.quadraticCurveTo(20, hy - 22, 20, hy - 2); for (let k = 0; k < 6; k++) c.lineTo(20 - k * 8 - 4, hy - 8 + (k % 2) * 5); c.closePath(); }
  else if (look.style === 'bun' || look.style === 'twin') { c.moveTo(-19, hy - 3); c.quadraticCurveTo(-16, hy - 21, 0, hy - 20); c.quadraticCurveTo(16, hy - 21, 19, hy - 3); c.quadraticCurveTo(6, hy - 13, -2, hy - 8); c.quadraticCurveTo(-10, hy - 12, -19, hy - 3); }
  else if (look.style === 'messy') { c.moveTo(-20, hy - 2); for (let k = 0; k < 9; k++) c.lineTo(-20 + k * 5, hy - 20 - (k % 2) * 8); c.lineTo(20, hy - 2); c.quadraticCurveTo(0, hy - 12, -20, hy - 2); }
  else if (look.style === 'swept') { c.moveTo(-19, hy - 4); c.quadraticCurveTo(-18, hy - 24, 4, hy - 24); c.quadraticCurveTo(22, hy - 22, 20, hy - 6); c.quadraticCurveTo(8, hy - 16, -19, hy - 4); }
  else if (look.style === 'short') { c.moveTo(-19, hy - 4); c.quadraticCurveTo(-17, hy - 22, 0, hy - 21); c.quadraticCurveTo(17, hy - 22, 19, hy - 4); c.quadraticCurveTo(0, hy - 14, -19, hy - 4); }
  else if (look.style === 'cover') { c.moveTo(-20, hy); c.quadraticCurveTo(-18, hy - 23, 2, hy - 22); c.quadraticCurveTo(20, hy - 20, 20, hy + 2); c.lineTo(10, hy - 6); c.lineTo(-6, hy - 4); c.closePath(); }
  else if (look.style === 'bald') { c.moveTo(-19, hy - 2); c.quadraticCurveTo(-21, hy - 12, -14, hy - 14); c.lineTo(-12, hy - 4); c.closePath(); c.moveTo(19, hy - 2); c.quadraticCurveTo(21, hy - 12, 14, hy - 14); c.lineTo(12, hy - 4); c.closePath(); }
  c.fill(); c.stroke();
  // 五官
  c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = 2.2;
  if (look.sleepy) { c.beginPath(); c.moveTo(-10, hy + 2); c.lineTo(-4, hy + 2); c.moveTo(4, hy + 2); c.lineTo(10, hy + 2); c.stroke(); }
  else if (o.happy) { c.beginPath(); c.arc(-7, hy + 3, 3.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(7, hy + 3, 3.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  else { c.beginPath(); c.ellipse(-7, hy + 1, 2.4, 3.4, 0, 0, TAU); c.ellipse(7, hy + 1, 2.4, 3.4, 0, 0, TAU); c.fill(); if (look.female) { c.beginPath(); c.moveTo(-10, hy - 2); c.lineTo(-11.5, hy - 4); c.moveTo(10, hy - 2); c.lineTo(11.5, hy - 4); c.stroke(); } }
  if (look.glasses) { c.lineWidth = 2; c.strokeStyle = INK; c.beginPath(); c.arc(-7, hy + 1, 6, 0, TAU); c.moveTo(13, hy + 1); c.arc(7, hy + 1, 6, 0, TAU); c.moveTo(-1, hy + 1); c.lineTo(1, hy + 1); c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-11, hy - 3, 3, 2); }
  c.lineWidth = 2.2; c.strokeStyle = INK; c.beginPath();
  if (look.smug) { c.moveTo(-5, hy + 10); c.quadraticCurveTo(2, hy + 13, 8, hy + 8); }
  else if (o.talk) { c.ellipse(0, hy + 10, 3.5, 3 + Math.abs(Math.sin((o.t || 0) * 14)) * 2, 0, 0, TAU); }
  else c.arc(0, hy + 7, 5, 0.2, Math.PI - 0.2);
  c.stroke();
  if (look.lips) { c.fillStyle = '#e5383b'; c.beginPath(); c.arc(0, hy + 10, 2.2, 0, TAU); c.fill(); }
  c.fillStyle = 'rgba(255,90,122,.35)'; c.beginPath(); c.ellipse(-12, hy + 7, 4, 2.4, 0, 0, TAU); c.ellipse(12, hy + 7, 4, 2.4, 0, 0, TAU); c.fill();
  // 配件
  c.strokeStyle = INK; c.lineWidth = 2.5;
  if (look.bow && !look.hat) { c.fillStyle = look.bow; c.beginPath(); c.moveTo(10, hy - 18); c.lineTo(22, hy - 26); c.lineTo(22, hy - 12); c.closePath(); c.moveTo(10, hy - 18); c.lineTo(0, hy - 28); c.lineTo(2, hy - 12); c.closePath(); c.fill(); c.stroke(); }
  if (look.headband) { c.fillStyle = look.headband; rr(c, -20, hy - 13, 40, 6, 2); c.fill(); c.stroke(); }
  if (look.headset) { c.beginPath(); c.arc(0, hy - 2, 21, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.fillStyle = '#333'; rr(c, -24, hy - 4, 6, 12, 2); c.fill(); c.beginPath(); c.moveTo(-21, hy + 8); c.quadraticCurveTo(-16, hy + 16, -6, hy + 14); c.stroke(); }
  if (look.hood) { c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, hy + 20); c.lineTo(-6, hy + 30); c.moveTo(6, hy + 20); c.lineTo(6, hy + 30); c.stroke(); }
  if (look.hat) drawHat(c, look.hat, hy);
}
function drawHat(c, id, hy) {
  c.strokeStyle = INK; c.lineWidth = 2.5;
  if (id === 'h_chili') { c.fillStyle = RED; c.beginPath(); c.moveTo(-21, hy - 8); c.quadraticCurveTo(0, hy - 34, 21, hy - 8); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-8, hy - 16, 1.8, 0, TAU); c.arc(6, hy - 20, 1.8, 0, TAU); c.fill();
    c.fillStyle = '#d00000'; c.beginPath(); c.ellipse(16, hy - 18, 3, 8, 0.6, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#2d6a4f'; c.fillRect(18, hy - 26, 3, 4); }
  if (id === 'h_bamboo') { c.fillStyle = '#e9c46a'; c.beginPath(); c.moveTo(-32, hy - 10); c.lineTo(0, hy - 38); c.lineTo(32, hy - 10); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-16, hy - 24); c.lineTo(16, hy - 24); c.stroke(); }
  if (id === 'h_flame') { c.fillStyle = '#222'; c.beginPath(); c.arc(0, hy - 10, 20, Math.PI, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(12, hy - 10); c.lineTo(32, hy - 8); c.lineTo(14, hy - 4); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff6b35'; c.beginPath(); c.moveTo(-8, hy - 12); c.quadraticCurveTo(-6, hy - 26, 0, hy - 30); c.quadraticCurveTo(2, hy - 20, 8, hy - 24); c.quadraticCurveTo(8, hy - 14, 4, hy - 12); c.closePath(); c.fill(); c.lineWidth = 1.5; c.stroke(); }
  if (id === 'h_panda') { c.fillStyle = INK; c.beginPath(); c.arc(-15, hy - 17, 7.5, 0, TAU); c.arc(15, hy - 17, 7.5, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, hy - 10, 20, Math.PI * 1.15, Math.PI * 1.85); c.lineTo(0, hy - 12); c.closePath(); c.fill(); c.stroke(); }
  if (id === 'h_boba') { c.fillStyle = '#f6e7d7'; c.beginPath(); c.moveTo(-14, hy - 14); c.lineTo(14, hy - 14); c.lineTo(11, hy - 40); c.lineTo(-11, hy - 40); c.closePath(); c.fill(); c.stroke(); rr(c, -13, hy - 44, 26, 5, 2); c.fillStyle = '#ff8fc7'; c.fill(); c.stroke();
    c.fillStyle = '#3d2c2e'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(-8 + k * 4, hy - 19, 2, 0, TAU); c.fill(); } c.lineWidth = 3; c.beginPath(); c.moveTo(4, hy - 44); c.lineTo(9, hy - 56); c.stroke(); }
  if (id === 'h_beret') { c.fillStyle = '#e63946'; c.beginPath(); c.ellipse(-2, hy - 17, 23, 9, -0.15, 0, TAU); c.fill(); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.moveTo(-2, hy - 26); c.lineTo(0, hy - 32); c.stroke();
    c.fillStyle = INK; c.save(); c.translate(17, hy - 20); c.rotate(0.9); c.fillRect(-1.5, -10, 3, 14); c.restore(); }
  if (id === 'h_helmet') { c.save(); c.fillStyle = 'rgba(160,220,255,.35)'; c.beginPath(); c.arc(0, hy, 27, 0, TAU); c.fill(); c.lineWidth = 3; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(0, hy, 21, Math.PI * 1.15, Math.PI * 1.4); c.stroke(); c.restore();
    c.fillStyle = '#ff6b35'; rr(c, -8, hy - 33, 16, 6, 2); c.fill(); c.stroke(); }
  if (id === 'h_crown') { c.fillStyle = YELLOW; c.beginPath(); c.moveTo(-16, hy - 14); c.lineTo(-18, hy - 34); c.lineTo(-8, hy - 24); c.lineTo(0, hy - 38); c.lineTo(8, hy - 24); c.lineTo(18, hy - 34); c.lineTo(16, hy - 14); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = RED; c.beginPath(); c.arc(0, hy - 20, 3, 0, TAU); c.fill(); c.fillStyle = '#06d6a0'; c.beginPath(); c.arc(-10, hy - 18, 2.2, 0, TAU); c.arc(10, hy - 18, 2.2, 0, TAU); c.fill(); }
  if (id === 'h_gold') { c.fillStyle = '#ffd23f'; rr(c, -15, hy - 30, 30, 16, 3); c.fill(); c.stroke(); c.beginPath(); c.arc(-9, hy - 32, 8, 0, TAU); c.arc(0, hy - 36, 9, 0, TAU); c.arc(9, hy - 32, 8, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fff8'; c.fillRect(-10, hy - 26, 4, 8); }
}
// 头像（缓存成图片给卡片用）
const avaCache = {};
function avatarURL(id, key) {
  const k = id + '|' + (key || ''); if (avaCache[k]) return avaCache[k];
  const o = document.createElement('canvas'); o.width = o.height = 112; const c = o.getContext('2d');
  c.translate(56, 186); c.scale(1.15, 1.15); drawHead(c, lookOf(id), { happy:false });
  return (avaCache[k] = o.toDataURL());
}

/* ---------- 每帧：招牌 / 人物 / 特效 / 大客户 ---------- */
const fx = [], coinsP = [];
let signAnim = { shop:-1, from:null, to:null, t0:0 }, lastSign = {}, focusT = 0, shake = 0;
let big = null, nextBigAt = 0, bubble = { who:null, txt:'', until:0 }, nextBubbleAt = 0, mileFx = null;
function signNow(i) { return state.shops[i].open ? E.signOf(state, i) : { name:'招租中', slogan:'开张 ' + fmt(E.SHOPS[i].open) + ' 金' }; }
function drawSign(c, i, t) {
  const l = L(), cur = signNow(i), w = W * 0.7, h = l.signH, x = W / 2, y0 = l.signY;
  const drawBoard = (txt, sub, dy, rot, alpha) => {
    c.save(); c.globalAlpha = alpha; c.translate(x, y0 + h / 2 + dy); c.rotate(rot);
    rr(c, -w / 2, -h / 2, w, h, 5 * U); inkFill(c, state.shops[i].open ? YELLOW : '#fff', 3 * U);
    c.fillStyle = dotsPattern(c, 'rgba(230,57,70,.35)', 5 * U); rr(c, w * 0.18, -h / 2 + 3 * U, w * 0.3 - 3 * U, h - 6 * U, 3 * U); c.fill();
    let fs = Math.min(h * 0.62, w / Math.max(4, txt.length) * 0.95);
    c.font = `900 ${fs}px -apple-system,"PingFang SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4 * U; c.strokeStyle = '#fff'; c.strokeText(txt, 0, 1 * U); c.fillStyle = INK; c.fillText(txt, 0, 1 * U);
    // 挂绳
    c.strokeStyle = INK; c.lineWidth = 2 * U; c.beginPath(); c.moveTo(-w * 0.35, -h / 2); c.lineTo(-w * 0.3, -h / 2 - 8 * U); c.moveTo(w * 0.35, -h / 2); c.lineTo(w * 0.3, -h / 2 - 8 * U); c.stroke();
    c.restore();
  };
  if (signAnim.shop === i && t - signAnim.t0 < 1.1) {
    const k = (t - signAnim.t0) / 1.1;
    if (k < 0.45) { const q = k / 0.45; drawBoard(signAnim.from, '', q * q * H * 0.9, q * 0.5, 1 - q * 0.3); }
    else { const q = (k - 0.45) / 0.55, b = Math.sin(q * Math.PI * 2.5) * (1 - q) * 0.12; drawBoard(cur.name, '', -(1 - q) * (1 - q) * H * 0.4, b, 1); }
  } else drawBoard(cur.name, '', 0, Math.sin(t * 1.3) * 0.008, 1);
}
function drawAwning(c, i, t) {
  const l = L(), S = SHOP_STYLE[i], n = 8, w = (l.x1 - l.x0) / n, y = l.awnY;
  if (!state.shops[i].open) return;
  for (let k = 0; k < n; k++) {
    c.beginPath(); c.moveTo(l.x0 + k * w, y); c.lineTo(l.x0 + (k + 1) * w, y); c.lineTo(l.x0 + (k + 1) * w, y + l.awnH * 0.75);
    c.arc(l.x0 + (k + 0.5) * w, y + l.awnH * 0.75, w / 2, 0, Math.PI); c.closePath(); inkFill(c, k % 2 ? '#fff' : S.awn, 2.4 * U);
  }
  if (decorOn('d_lights')) { // 辣椒串灯
    c.strokeStyle = INK; c.lineWidth = 1.5 * U; c.beginPath(); c.moveTo(l.x0, y + l.awnH * 1.05);
    for (let k = 0; k <= 10; k++) c.quadraticCurveTo(l.x0 + (k - 0.5) * (l.x1 - l.x0) / 10, y + l.awnH * 1.35, l.x0 + k * (l.x1 - l.x0) / 10, y + l.awnH * 1.05); c.stroke();
    for (let k = 0; k < 10; k++) { const px = l.x0 + (k + 0.5) * (l.x1 - l.x0) / 10, py = y + l.awnH * 1.22; c.save(); c.translate(px, py); c.rotate(0.3);
      c.shadowColor = '#ff3b3b'; c.shadowBlur = (Math.sin(t * 4 + k) > 0 ? 8 : 2) * U; c.fillStyle = '#e5383b'; c.beginPath(); c.ellipse(0, 4 * U, 2.6 * U, 6 * U, 0, 0, TAU); c.fill(); c.restore(); }
  }
}
function emo(c, ch, x, y, size, glow) {
  c.save(); c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
  if (glow) { c.shadowColor = glow; c.shadowBlur = 14 * U; } c.fillText(ch, x, y); c.restore();
}
const SUPER_ICON = { s_panda:'🐼', s_fountain:'⛲', s_portal:'🌀', s_sun:'☀️' };
function drawSuper(c, i, t) {
  const id = E.SUPER_OF_SHOP[i]; if (!E.hasSuper(state, i)) return;
  const l = L(), x = W * 0.585, y = l.ground + 2 * U, ms = now();
  const hot = (i === 1 && E.rushActive(state, 'tea', ms)) || (i === 3 && E.rushActive(state, 'tech', ms));
  const pulse = 0.5 + 0.5 * Math.sin(t * (hot ? 9 : 3));
  c.save(); c.globalAlpha = 0.25 + 0.25 * pulse; c.fillStyle = hot ? '#ff4f9a' : YELLOW; c.beginPath(); c.ellipse(x, y - 22 * U, 30 * U, 30 * U, 0, 0, TAU); c.fill(); c.restore();
  // 底座
  rr(c, x - 22 * U, y - 8 * U, 44 * U, 8 * U, 2 * U); inkFill(c, '#ffd23f', 2 * U);
  const bob = Math.sin(t * 2.4) * 2 * U, sz = 38 * U;
  if (i === 2) { c.save(); c.translate(x, y - 30 * U); c.rotate(t * 2); emo(c, '🌀', 0, sz / 2, sz); c.restore(); }
  else emo(c, SUPER_ICON[id], x, y - 6 * U + bob, sz, hot ? '#ff4f9a' : '#fff3a0');
  if (i === 0) emo(c, '🍢', x + 17 * U, y - 16 * U + bob, 16 * U);
  if (i === 1 && hot) for (let k = 0; k < 6; k++) { const p = (t * 1.6 + k / 6) % 1; c.fillStyle = '#3d2c2e'; c.beginPath(); c.arc(x + Math.sin(k * 2.1) * 26 * U * p, y - 40 * U - p * 40 * U + p * p * 50 * U, 3 * U, 0, TAU); c.fill(); }
  if (i === 3 && hot) { c.save(); c.globalAlpha = 0.12 + 0.08 * pulse; c.fillStyle = '#fff3a0'; c.fillRect(0, 0, W, H); c.restore(); }
}
function drawRushBanner(c, i, t) {
  const ms = now(); let txt = null, end = 0;
  if (i === 1 && E.hasSuper(state, 1) && E.rushActive(state, 'tea', ms)) { txt = '珍珠喷泉 · 连续爆单 ×' + CFG.FOUNTAIN_MULT + ' · 手点必暴击'; end = state.rush.tea; }
  if (i === 3 && E.hasSuper(state, 3) && E.rushActive(state, 'tech', ms)) { txt = '人造太阳 · 超频 ×' + CFG.SUN_MULT + ' · 暴击 ×' + CFG.SUN_CRIT_MULT; end = state.rush.tech; }
  if (!txt) return;
  const l = L(); drawStrokeText(c, txt + '（' + Math.ceil((end - ms) / 1000) + '）', W / 2, l.awnY + l.awnH * 1.9, 12 * U, '#ff4f9a', -0.03);
}
function drawDecorFront(c, i, t) {
  const l = L();
  if (decorOn('d_balloon')) { const by = l.awnY + l.awnH * 2.4 + Math.sin(t * 1.8) * 3 * U; c.strokeStyle = INK; c.lineWidth = 1.2 * U; c.beginPath(); c.moveTo(W * 0.075, by); c.lineTo(W * 0.085, by + 30 * U); c.stroke(); emo(c, '🎈', W * 0.075, by + 2 * U, 22 * U); }
  if (decorOn('d_poster')) { c.save(); c.translate(W * 0.9, l.counterY - 4 * U); c.rotate(0.06); rr(c, -16 * U, -24 * U, 32 * U, 40 * U, 2 * U); inkFill(c, '#fff', 2 * U);
    c.fillStyle = RED; c.font = `900 ${9 * U}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('热血', 0, -12 * U); c.fillStyle = INK; c.fillText('连载', 0, 0); c.fillStyle = '#ffd23f'; c.fillRect(-12 * U, 8 * U, 24 * U, 4 * U); c.restore(); }
  if (decorOn('d_cat')) emo(c, '🐱', W * 0.66, l.counterY - 3 * U + (Math.sin(t * 5) > 0.9 ? -2 * U : 0), 18 * U);
  if (decorOn('d_plant')) emo(c, '🪴', W * 0.955, l.ground + 4 * U, 22 * U);
  if (decorOn('d_board')) { // 龙门阵黑板
    const x = W * 0.1, y = l.ground; c.strokeStyle = INK; c.lineWidth = 2.5 * U; c.beginPath(); c.moveTo(x - 14 * U, y); c.lineTo(x - 4 * U, y - 46 * U); c.moveTo(x + 14 * U, y); c.lineTo(x + 4 * U, y - 46 * U); c.stroke();
    rr(c, x - 17 * U, y - 46 * U, 34 * U, 30 * U, 3 * U); inkFill(c, '#2d3a2e', 2.5 * U);
    c.fillStyle = '#fff'; c.font = `900 ${7 * U}px sans-serif`; c.textAlign = 'center'; c.fillText('今日', x, y - 36 * U); c.fillText('龙门阵', x, y - 26 * U);
  }
  if (decorOn('d_stool')) { // 竹编小椅
    const x = W * 0.26, y = l.ground + 2 * U; rr(c, x - 13 * U, y - 22 * U, 26 * U, 7 * U, 3 * U); inkFill(c, '#d4a373', 2 * U);
    c.strokeStyle = INK; c.lineWidth = 3 * U; c.beginPath(); c.moveTo(x - 10 * U, y - 15 * U); c.lineTo(x - 12 * U, y); c.moveTo(x + 10 * U, y - 15 * U); c.lineTo(x + 12 * U, y); c.stroke();
    c.strokeStyle = '#a0522d'; c.lineWidth = 1 * U; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x + k * 5 * U, y - 21 * U); c.lineTo(x + k * 5 * U, y - 16 * U); c.stroke(); }
  }
}
function drawStrokeText(c, txt, x, y, size, color, rot = 0, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot);
  c.font = `900 ${size}px -apple-system,"PingFang SC",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = size * 0.22; c.strokeStyle = INK; c.strokeText(txt, 0, 0); c.fillStyle = color; c.fillText(txt, 0, 0); c.restore();
}
function drawBubble(c, x, y, txt, alpha) {
  c.save(); c.globalAlpha = alpha; c.font = `800 ${10.5 * U}px -apple-system,"PingFang SC",sans-serif`;
  const w = Math.min(W * 0.62, c.measureText(txt).width + 14 * U), h = 20 * U, bx = Math.max(4, Math.min(W - w - 4, x - w / 2));
  rr(c, bx, y - h, w, h, 9 * U); inkFill(c, '#fff', 2 * U);
  c.beginPath(); c.moveTo(x - 4 * U, y - 1); c.lineTo(x + 2 * U, y + 7 * U); c.lineTo(x + 5 * U, y - 1); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.stroke();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, bx + w / 2, y - h / 2, w - 10 * U); c.restore();
}
function empPos() { const l = L(); return { x:W * 0.36, y:l.counterY + 30 * U, s:U * 0.95 }; }
function ceoPos() { const l = L(); return { x:W * 0.8, y:l.ground + 6 * U, s:U * 1.05 }; }
function render(t) {
  const i = state.cur, l = L();
  const key = [i, W, H, DPR, state.shops[i].open, decorOn('d_neon')].join('|');
  if (key !== bgKey) { bgCache = buildBg(i); bgKey = key; }
  g.setTransform(1, 0, 0, 1, 0, 0);
  let sx = 0, sy = 0; if (shake > 0) { sx = (Math.random() - 0.5) * shake * 6 * DPR; sy = (Math.random() - 0.5) * shake * 6 * DPR; }
  g.drawImage(bgCache, sx, sy);
  g.setTransform(DPR, 0, 0, DPR, sx, sy);
  // 集中线（点击 / 大客户时）
  if (focusT > 0) { g.save(); g.globalAlpha = Math.min(1, focusT * 3) * 0.5; g.strokeStyle = INK; g.lineWidth = 1.2 * U;
    for (let k = 0; k < 40; k++) { const a = k / 40 * TAU + (k % 3) * 0.05; const r0 = Math.min(W, H) * 0.42, r1 = Math.max(W, H);
      g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); g.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); g.stroke(); } g.restore(); }
  drawAwning(g, i, t);
  drawSign(g, i, t);
  const open = state.shops[i].open;
  if (open) {
    // 员工（在柜台后）
    const ep = empPos();
    g.save(); g.beginPath(); g.rect(0, 0, W, l.counterY - 5 * U); g.clip();
    if (state.shops[i].emp > 0) drawPerson(g, ep.x, ep.y, ep.s, LOOKS['e' + i], { t, bob:true, pose:'work', talk:bubble.who === 'e' && bubble.until > t });
    g.restore();
    if (state.shops[i].emp <= 0) { g.save(); g.translate(ep.x, l.counterY - 22 * U); g.rotate(-0.06); rr(g, -30 * U, -13 * U, 60 * U, 26 * U, 3 * U); inkFill(g, '#fff', 2 * U);
      g.fillStyle = RED; g.font = `900 ${11 * U}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('招聘中', 0, 0); g.restore(); }
    // 烧烤烟 / 科技灯
    if (i === 0 && state.shops[0].emp > 0) for (let k = 0; k < 3; k++) { const p = (t * 0.5 + k / 3) % 1; g.save(); g.globalAlpha = 0.5 * (1 - p); g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 1.2 * U;
      g.beginPath(); g.arc(W * (0.2 + k * 0.1) + Math.sin(t * 2 + k) * 5 * U, l.counterY - 20 * U - p * 50 * U, (5 + p * 9) * U, 0, TAU); g.fill(); g.stroke(); g.restore(); }
    drawDecorFront(g, i, t);
    drawSuper(g, i, t);
    drawRushBanner(g, i, t);
    // CEO
    const cid = E.ceoAt(state, i), cp = ceoPos();
    if (cid) {
      const info = E.ceoInfo(state, i);
      drawPerson(g, cp.x, cp.y, cp.s, lookOf(cid), { t, pose:(t % 7) < 1.2 ? 'wave' : 'point', talk:bubble.who === 'c' && bubble.until > t, happy:info.match && (t % 5) < 1 });
      // 名牌
      const nm = E.CEO_BY_ID[cid].name; g.font = `900 ${9 * U}px sans-serif`; const nw = g.measureText(nm).width + 16 * U;
      rr(g, cp.x - nw / 2, cp.y + 1 * U, nw, 14 * U, 3 * U); inkFill(g, info.match ? YELLOW : '#ff8fc7', 1.8 * U);
      g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CEO ' + nm, cp.x, cp.y + 8 * U);
    } else {
      g.save(); g.setLineDash([5 * U, 4 * U]); g.strokeStyle = INK; g.lineWidth = 2 * U; g.beginPath(); g.ellipse(cp.x, cp.y - 50 * U, 22 * U, 48 * U, 0, 0, TAU); g.stroke(); g.restore();
      g.fillStyle = INK; g.font = `900 ${10 * U}px sans-serif`; g.textAlign = 'center'; g.fillText('CEO', cp.x, cp.y - 56 * U); g.fillText('空缺', cp.x, cp.y - 42 * U);
    }
    // 台词气泡
    if (bubble.until > t) { const ad = Math.min(1, (bubble.until - t) * 3); if (bubble.who === 'c' && cid) drawBubble(g, cp.x - 6 * U, cp.y - 128 * U, bubble.txt, ad); else if (bubble.who === 'e') drawBubble(g, ep.x + 8 * U, l.counterY - 72 * U, bubble.txt, ad); }
  } else {
    const prev = i > 0 && !state.shops[i - 1].open;
    drawStrokeText(g, prev ? '先开上一家店' : '点下面「开张」', W / 2, H * 0.55, 16 * U, '#fff', -0.05);
    drawStrokeText(g, '🔒', W / 2, H * 0.4, 22 * U, '#fff');
  }
  // 大客户
  if (big && open) {
    const bt = t - big.t0, x = W * 0.56 + Math.min(0, (bt - 0.8)) * W * 0.6, y = l.ground + 4 * U;
    big.x = x; big.y = y - 50 * U; big.r = 46 * U;
    g.save(); g.globalAlpha = 0.35 + 0.25 * Math.sin(t * 8); g.fillStyle = YELLOW; g.beginPath(); g.arc(x, y - 50 * U, 48 * U, 0, TAU); g.fill(); g.restore();
    drawPerson(g, x, y, U * 1.1, { skin:'#ffd9b8', hair:'#111', style:'swept', top:'#6a4c93', tie:true, smug:true, glasses:true }, { t, bob:true, pose:'wave' });
    const left = Math.max(0, CFG.BIG_STAY - bt);
    drawBubble(g, x, y - 128 * U, '大客户！点我 ×5（' + Math.ceil(left) + '）', 1);
    drawStrokeText(g, '💰', x + 26 * U, y - 70 * U + Math.sin(t * 5) * 3 * U, 16 * U, '#fff');
  }
  // 里程碑特效
  if (mileFx && t - mileFx.t0 < 2.2) {
    const k = (t - mileFx.t0) / 2.2, a = k < 0.8 ? 1 : (1 - k) * 5;
    if (mileFx.panel) { // 漫画杯套：分镜格
      g.save(); g.globalAlpha = a; const pw = W * 0.28, ph = H * 0.42;
      for (let p = 0; p < 3; p++) { if (k < p * 0.15) continue; const px = W * 0.06 + p * (pw + W * 0.04), py = H * 0.22 + (p % 2) * 8 * U;
        g.save(); g.translate(px + pw / 2, py + ph / 2); g.rotate((p - 1) * 0.04); rr(g, -pw / 2, -ph / 2, pw, ph, 0); inkFill(g, '#fff', 3 * U);
        drawStrokeText(g, ['唰！', 'Lv' + mileFx.lv + '!', '×' + mileFx.mult][p], 0, 0, 20 * U, [RED, YELLOW, '#06d6a0'][p], -0.1); g.restore(); }
      g.restore();
      if (mileFx.bonus) drawStrokeText(g, '小红包 +' + fmt(mileFx.bonus), W / 2, H * 0.82, 15 * U, YELLOW, 0, a);
    } else {
      drawStrokeText(g, 'Lv' + mileFx.lv + '！收益 ×' + mileFx.mult, W / 2, H * 0.45 - k * 20 * U, 22 * U * (1 + Math.max(0, 0.3 - k)), YELLOW, -0.06, a);
    }
  }
  // 飘字 / 金币
  for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k], a = (t - f.t0) / f.life; if (a >= 1) { fx.splice(k, 1); continue; }
    drawStrokeText(g, f.txt, f.x, f.y - a * 36 * U, f.size * (a < 0.15 ? 0.6 + a * 2.7 : 1), f.color, f.rot, 1 - a * a); }
  for (let k = coinsP.length - 1; k >= 0; k--) { const p = coinsP[k]; p.vy += 600 * U * (1 / 60); p.x += p.vx / 60; p.y += p.vy / 60; p.life -= 1 / 60;
    if (p.life <= 0) { coinsP.splice(k, 1); continue; }
    g.save(); g.translate(p.x, p.y); g.scale(Math.abs(Math.cos(p.life * 10)) + 0.2, 1); g.beginPath(); g.arc(0, 0, 5 * U, 0, TAU); inkFill(g, YELLOW, 1.5 * U); g.restore(); }
}
function addText(txt, x, y, o = {}) { fx.push({ txt, x, y, t0:clock, life:o.life || 0.9, size:o.size || 15 * U, color:o.color || YELLOW, rot:o.rot || (Math.random() - 0.5) * 0.3 }); if (fx.length > 30) fx.shift(); }
function burstCoins(x, y, n) { for (let k = 0; k < n; k++) coinsP.push({ x, y, vx:(Math.random() - 0.5) * 260 * U, vy:-(140 + Math.random() * 200) * U, life:0.8 + Math.random() * 0.4 }); if (coinsP.length > 60) coinsP.splice(0, coinsP.length - 60); }

/* ================= 游戏逻辑 ================= */
let clock = 0; // 秒（performance）
const coinsEl = $('#coins'), cpsEl = $('#cps'), tabBody = $('#tabBody'), toastEl = $('#toast'), sfxWord = $('#sfxWord');
let tab = 'shop', buyAmt = 1, dirty = true;
function earn(v) { state.coins += v; state.totalEarned += v; }
function popWord(w) { sfxWord.textContent = w; sfxWord.classList.remove('pop'); void sfxWord.offsetWidth; sfxWord.classList.add('pop'); }
function bumpCoins() { coinsEl.classList.remove('bump'); void coinsEl.offsetWidth; coinsEl.classList.add('bump'); }
let toastTimer = 0;
function toast(msg, ms = 1900) { toastEl.textContent = msg; toastEl.classList.remove('hidden'); toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = ''; clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.add('hidden'), ms); }
function shakeEl(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
function sayLine(who, txt, sec = 2.6) { bubble = { who, txt, until:clock + sec }; }

// 在线收益：按真实时间累计；中途超过 5 秒没跑（锁屏/切走）就当离线结算
function tick() {
  const t = now(), gap = (t - state.lastSeen) / 1000;
  if (gap < 0) { if (t > state.maxSeen - CFG.CLOCK_TOLERANCE * 1000) state.lastSeen = t; return; }
  if (gap > 5) { onReturn(); return; }
  earn(E.onlineRate(state, t) * gap);
  state.lastSeen = t; if (t > state.maxSeen) state.maxSeen = t;
}
function onReturn() {
  if (frozen) return;
  const p = E.settleOffline(state, now(), rid);
  persist();
  if (p && p.rolledBack) toast('检测到手机时间被往回调，这段时间不发离线收益');
  else if (state.pending) showOffline();
  dirty = true;
}

/* ---------- 点店铺 ---------- */
const TAP_WORDS = ['滋啦！', '香！', '叮！', '嘿！', '巴适！'];
function tapShop(x, y) {
  const i = state.cur, s = state.shops[i];
  if (!s.open) { toast(i > 0 && !state.shops[i - 1].open ? '先把上一家店开起来' : '在下面点「开张」'); return; }
  const r = E.tapReward(state, i, now(), rand());
  earn(r.value); state.taps++; if (r.crit) state.crits++;
  addText('+' + fmt(r.value), x, y, r.crit ? { size:22 * U, color:RED } : {});
  burstCoins(x, y, r.crit ? 8 : 3);
  if (r.crit) { focusT = 0.3; shake = 0.25; popWord('暴击！'); sfx('crit'); }
  else { sfx('tap'); if (Math.random() < 0.25) popWord(TAP_WORDS[Math.floor(Math.random() * TAP_WORDS.length)]); }
  bumpCoins();
  if (Math.random() < 0.12) { const cid = E.ceoAt(state, i); if (cid) sayLine('c', E.SIGNS[cid][i][1]); }
}
/* ---------- 大客户（只在在线时，×5 持续 30 秒，不影响离线） ---------- */
function scheduleBig() { nextBigAt = clock + E.bigInterval(state, rand()); }
function updateBig() {
  if (big && clock - big.t0 > CFG.BIG_STAY) big = null;
  if (!big && clock >= nextBigAt && E.baseRate(state) > 0 && !document.hidden && !modalOpen()) {
    big = { t0:clock }; sfx('big'); popWord('大客户！'); if (!state.shops[state.cur].open) { big = null; }
    scheduleBig();
  }
}
function hitBig(x, y) {
  if (!big || big.r == null) return false;
  if (Math.hypot(x - big.x, y - big.y) > big.r * 1.15) return false;
  big = null; state.boostEnd = now() + CFG.BOOST_SEC * 1000; state.bigCustomers++;
  focusT = 0.5; shake = 0.4; popWord('×5！'); sfx('mile'); addText('大客户 ×5！', W / 2, H * 0.45, { size:22 * U, color:RED, life:1.4 });
  burstCoins(W / 2, H * 0.5, 16); persist(); return true;
}

/* ---------- 超级装饰的在线效果（只在页面开着时触发，不影响离线） ---------- */
const superNext = { tea:null, book:null, tech:null };
function superAnnounce(i, word, msg, amt) {
  if (state.cur === i && tab !== 'col') { popWord(word); focusT = 0.5; shake = 0.3; addText(msg, W / 2, H * 0.42, { size:16 * U, color:'#ff4f9a', life:1.8, rot:-0.04 }); if (amt) burstCoins(W * 0.585, H * 0.7, 14); }
  else toast(msg, 2400);
  sfx('mile');
}
function updateSupers() {
  if (document.hidden || frozen) return;
  const t = now(); let changed = false;
  const every = { tea:CFG.FOUNTAIN_EVERY, book:CFG.PORTAL_EVERY, tech:CFG.SUN_EVERY }, shop = { tea:1, book:2, tech:3 };
  for (const k of ['tea', 'book', 'tech']) {
    const i = shop[k];
    if (!E.hasSuper(state, i)) { superNext[k] = null; continue; }
    if (superNext[k] == null) { superNext[k] = clock + every[k]; continue; }
    if (clock < superNext[k]) continue;
    superNext[k] = clock + every[k];
    if (!(state.shops[i].emp > 0)) continue;
    if (k === 'tea') { E.startRush(state, 'tea', t); superAnnounce(1, '爆单！', '珍珠喷泉：连续爆单 ' + CFG.FOUNTAIN_SEC + ' 秒！'); }
    else if (k === 'tech') { E.startRush(state, 'tech', t); superAnnounce(3, '超频！', '人造太阳：超频 ' + CFG.SUN_SEC + ' 秒！'); }
    else { const amt = E.portalReward(state); earn(amt); superAnnounce(2, '客串！', '次元传送门：漫画角色客串，大订单 +' + fmt(amt), amt); }
    changed = true;
  }
  // 爆单 / 超频开始或结束时刷新店铺页的暴击显示
  const key = E.rushActive(state, 'tea', t) + '|' + E.rushActive(state, 'tech', t);
  if (key !== updateSupers.key) { updateSupers.key = key; dirty = true; }
  if (changed) { dirty = true; persist(); }
}

/* ---------- 购买 ---------- */
function afterBuy(btn, msg) { sfx('buy'); popWord('叮！'); bumpCoins(); dirty = true; persist(); if (btn) { const c = btn.closest('.card'); if (c) { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); } } if (msg) toast(msg); }
function failBuy(btn, why) { sfx('no'); shakeEl(btn); toast(why === '金币不够' ? '金币不够，躺一会儿再来' : why); }
function handleUnlocks(list) { (list || []).forEach(id => queueModal(() => showCeoJoin(id))); }
function shopUpgradeCount(i) {
  const s = state.shops[i]; if (buyAmt !== 'max') return buyAmt;
  let k = 0, c = 0; while (k < 200) { const n = E.upgradeCost(i, s.lv + k); if (c + n > state.coins) break; c += n; k++; } return Math.max(1, k);
}
function doUpgradeShop(i, btn) {
  const k = shopUpgradeCount(i), cost = E.bulkUpgradeCost(i, state.shops[i].lv, k);
  if (state.coins < cost) return failBuy(btn, '金币不够');
  let best = null, unlocked = [];
  for (let j = 0; j < k; j++) { const r = E.upgradeShop(state, i); if (!r.ok) break; if (r.milestone) best = r; if (r.unlocked) unlocked.push(...r.unlocked); }
  afterBuy(btn);
  if (best) { mileFx = { t0:clock, lv:best.lv, mult:best.milestone, panel:best.panel, bonus:best.bonus }; sfx('mile'); focusT = 0.5; if (state.cur !== i) switchShop(i);
    toast(best.panel ? `漫画杯套：Lv${best.lv} 分镜特效 + 小红包 ${fmt(best.bonus)}` : `${E.SHOPS[i].short} Lv${best.lv}！收益 ×${best.milestone}`); }
  handleUnlocks(unlocked);
}
function act(a, arg, btn) {
  const i = state.cur;
  switch (a) {
    case 'open': { const r = E.openShop(state, +arg); if (!r.ok) return failBuy(btn, r.why); afterBuy(btn, E.SHOPS[+arg].name + ' 开张啦！'); signAnim = { shop:+arg, from:'招租中', t0:clock }; handleUnlocks(r.unlocked); break; }
    case 'up': return doUpgradeShop(+arg, btn);
    case 'hire': { const r = E.hireEmp(state, +arg); if (!r.ok) return failBuy(btn, r.why); afterBuy(btn, '雇到 ' + E.SHOPS[+arg].emp.name + '！开始自动赚钱'); sayLine('e', E.SHOPS[+arg].emp.line, 3); if (+arg === 3) queueModal(showGachaOpen); break; }
    case 'emp': { const r = E.upgradeEmp(state, +arg); if (!r.ok) return failBuy(btn, r.why); afterBuy(btn); break; }
    case 'ceoUp': { const r = E.upgradeCeo(state, arg); if (!r.ok) return failBuy(btn, r.why); afterBuy(btn); sayLine('c', E.CEO_BY_ID[arg].line); break; }
    case 'assign': return openAssign(arg);
    case 'assignTo': return openAssignTo(+arg);
    case 'amt': buyAmt = arg === 'max' ? 'max' : +arg; dirty = true; break;
    case 'comic': return showComic(arg, false);
    case 'draw': return doGacha(btn);
    case 'equip': { const [who, slot, id] = arg.split(':'); if (!state.wear[who]) state.wear[who] = { clothes:null, hat:null }; state.wear[who][slot] = id === 'none' ? null : id; persist(); dirty = true; avaCacheClear(); sfx('buy'); break; }
    case 'wearWho': wardrobeWho = arg; dirty = true; break;
    case 'decor': { const h = state.decorHidden || (state.decorHidden = []); const k = h.indexOf(arg); if (k >= 0) h.splice(k, 1); else h.push(arg); persist(); dirty = true; bgKey = ''; break; }
    case 'card': return showCard(arg);
    case 'reset': return confirmReset();
    case 'goShop': switchShop(+arg); setTab('shop'); break;
  }
}
function avaCacheClear() { for (const k of Object.keys(avaCache)) delete avaCache[k]; }

/* ================= 界面：标签页 ================= */
const SHOP_ICON = ['🍢', '🧋', '📚', '💻'], TAB_NAME = ['烧烤摊', '奶茶店', '漫画店', '科技'];
const DECOR_ICON = { d_stool:'🪑', d_lights:'🌶️', d_neon:'🏮', d_board:'🪧', d_balloon:'🎈', d_poster:'📰', d_cat:'🐱', d_plant:'🪴' };
const TYPE_LABEL = { clothes:'衣服', hat:'帽子', decor:'装饰', card:'故事卡', super:'超级装饰' };
const thumbCache = {};
function itemThumb(id) {
  if (thumbCache[id]) return thumbCache[id];
  const it = E.ITEM_BY_ID[id] || {}, o = document.createElement('canvas'); o.width = o.height = 96; const c = o.getContext('2d');
  if (it.type === 'clothes' || id === 'c_gold') { c.translate(48, 108); c.scale(0.85, 0.85); drawPerson(c, 0, 0, 1, Object.assign({}, LOOKS.c77, CLOTHES[id], { bow:null }), {}); }
  else if (it.type === 'hat' || id === 'h_gold') { c.translate(48, 150); c.scale(1.05, 1.05); drawHead(c, Object.assign({}, LOOKS.c77, { hat:id }), {}); }
  else return null;
  return (thumbCache[id] = o.toDataURL());
}
function itemIcon(id) {
  const it = E.ITEM_BY_ID[id];
  if (it && it.type === 'decor') return `<span class="ii">${DECOR_ICON[id]}</span>`;
  if (it && it.type === 'super') return `<span class="ii">${SUPER_ICON[id]}</span>`;
  if (it && it.type === 'card') return `<span class="ii">📜</span>`;
  const u = itemThumb(id); return u ? `<img src="${u}" alt="" style="width:44px;height:44px">` : '<span class="ii">❓</span>';
}
const ava = (id, cls = '') => `<div class="ava ${cls}"><img src="${avatarURL(id, JSON.stringify(E.CEO_BY_ID[id] ? wearOf(id) : ''))}" alt=""></div>`;
const btn = (act, arg, label, cost, extra = '') => `<button class="buy ${extra}" data-act="${act}" data-arg="${arg}" ${cost != null ? `data-cost="${cost}"` : ''}>${label}${cost != null ? `<small>${fmt(cost)}</small>` : ''}</button>`;
function rateDelta(fn) { const c = E.cloneState(state); fn(c); return E.baseRate(c) - E.baseRate(state); }
function ceoTags(i) {
  const info = E.ceoInfo(state, i); if (!info.id) return '';
  return info.match ? `<span class="tag match">专长 ×${CFG.MATCH_MULT}</span>` : `<span class="tag cross">跨行 ×${CFG.CROSS_MULT}${info.cross ? ' · ' + info.cross.title : ''}</span>`;
}
function renderShop() {
  const i = state.cur, S = E.SHOPS[i], s = state.shops[i];
  if (!s.open) {
    const prevOk = i === 0 || state.shops[i - 1].open, joins = E.CEOS.find(c => c.home === i);
    return `<div class="sec-title">${S.name}</div>
      <div class="card hl"><div class="ava sq">${SHOP_ICON[i]}</div><div class="info"><div class="name">${S.name}</div>
      <div class="desc">开张后可雇员工 <b>${S.emp.name}</b>${joins && joins.id !== 'rocket' ? `，CEO <b>${joins.name}</b>（${E.TYPES[joins.type]}）加入` : ''}${i === 3 ? `；雇到员工后开放<b>盲盒</b>，Lv${CFG.ROCKET_UNLOCK_LV} 后 <b>${E.ROCKET_NAME.name}</b> 加入` : ''}</div>
      <div class="gain">${prevOk ? '' : '先开 ' + E.SHOPS[i - 1].name}</div></div>
      ${prevOk ? btn('open', i, '开张', S.open) : '<button class="buy no" disabled>未解锁</button>'}</div>`;
  }
  const info = E.ceoInfo(state, i), sr = E.shopRate(state, i), sign = E.signOf(state, i);
  const nm = E.nextMilestone(s.lv), prevM = [0, 10, 25, 50].filter(m => m <= s.lv).pop() || 0;
  const k = shopUpgradeCount(i), upCost = E.bulkUpgradeCost(i, s.lv, k);
  const upGain = rateDelta(c => { c.shops[i].lv += k; });
  let h = `<div class="summary">「${sign.name}」每秒 <b style="color:var(--red)">+${fmt(sr)}</b>${s.emp > 0
      ? `<br>店铺 ${fmt(E.shopBase(i, s.lv))} × 员工 ×${E.empMult(s.emp).toFixed(2)} × CEO ×${info.mult.toFixed(2)}${E.hasSuper(state, i) ? ` × 超级装饰 ×${CFG.SUPER_RATE}` : ''}`
      : '<br>还没员工：不会自动赚钱（可以点画面手动赚）'}
    <div class="critline"><span>手点暴击概率 <b>${Math.round(E.critChance(state, i, now()) * 100)}%</b></span><span>暴击倍率 <b>×${E.critMult(state, i, now())}</b></span></div></div>`;
  if (E.hasSuper(state, i)) { const sp = E.ITEM_BY_ID[E.SUPER_OF_SHOP[i]];
    h += `<div class="card super"><div class="ava sq">${SUPER_ICON[sp.id]}</div><div class="info"><div class="name">${sp.name}<span class="tag match">超级装饰</span></div><div class="desc">${sp.desc}</div></div></div>`; }
  h += `<div class="row-head"><div class="sec-title">店铺</div><div class="buyamt">${[1, 10, 'max'].map(a => `<button data-act="amt" data-arg="${a}" class="${buyAmt === a ? 'on' : ''}">${a === 'max' ? 'MAX' : 'x' + a}</button>`).join('')}</div></div>`;
  h += `<div class="card"><div class="ava sq">${SHOP_ICON[i]}</div><div class="info"><div class="name">${S.short}<span class="lv">Lv.${s.lv}</span></div>
    <div class="desc">${nm ? `Lv${nm} 收益 ×${E.milestoneMult(nm)}（现 ×${E.milestoneMult(s.lv)}）` : '里程碑全拿下 ×8'}</div>
    ${nm ? `<div class="mbar"><i style="width:${((s.lv - prevM) / (nm - prevM) * 100).toFixed(0)}%"></i></div>` : ''}
    <div class="gain">${s.emp > 0 ? '+' + fmt(upGain) + '/秒' : '手点收益提升'}</div></div>
    ${btn('up', i, '升级' + (k > 1 ? ' ×' + k : ''), upCost)}</div>`;
  h += `<div class="sec-title">员工</div>`;
  if (s.emp <= 0) h += `<div class="card hl">${ava('e' + i)}<div class="info"><div class="name">${S.emp.name}<span class="lv" style="background:#999">未雇</span></div>
    <div class="desc one">“${S.emp.line}”</div><div class="gain">雇了才自动赚：+${fmt(rateDelta(c => { c.shops[i].emp = 1; }))}/秒</div></div>${btn('hire', i, '雇佣', S.hire)}</div>`;
  else h += `<div class="card">${ava('e' + i)}<div class="info"><div class="name">${S.emp.name}<span class="lv">Lv.${s.emp}</span></div>
    <div class="desc one">“${S.emp.line}”</div><div class="gain">${s.emp >= CFG.EMP_MAX ? '已满级' : `速度 +${CFG.EMP_LV_BONUS * 100}% → +${fmt(rateDelta(c => { c.shops[i].emp++; }))}/秒`}</div></div>
    ${s.emp >= CFG.EMP_MAX ? '<button class="buy no" disabled>满级</button>' : btn('emp', i, '升级', E.empCost(i, s.emp))}</div>`;
  h += `<div class="sec-title">CEO</div>`;
  if (info.id) {
    const c = E.CEO_BY_ID[info.id], cs = state.ceos[info.id];
    h += `<div class="card ${info.match ? '' : 'hl'}">${ava(info.id)}<div class="info"><div class="name">${c.name}<span class="lv">Lv.${cs.lv}</span>${ceoTags(i)}</div>
      <div class="desc">经营加成 ×${info.mult.toFixed(2)}（${info.match ? '专长对口' : '跨行'} ×${info.typeMult} · 等级 +${Math.round((info.lvMult - 1) * 100)}%）${info.cross ? '<br><b>' + info.cross.title + '</b>：' + info.cross.desc : ''}</div>
      <div class="gain">${cs.lv >= CFG.CEO_MAX ? '已满级' : '升一级 +' + fmt(rateDelta(x => { x.ceos[info.id].lv++; })) + '/秒（跟着 CEO 走）'}</div></div>
      <div class="btns">${cs.lv >= CFG.CEO_MAX ? '<button class="buy no" disabled>满级</button>' : btn('ceoUp', info.id, '升级', E.ceoCost(info.id, cs.lv))}<button class="buy alt" data-act="assignTo" data-arg="${i}">调任</button></div></div>`;
  } else {
    h += `<div class="card hl"><div class="ava">👔</div><div class="info"><div class="name">CEO 空缺</div><div class="desc">派一位 CEO 来：专长对口 ×${CFG.MATCH_MULT}，跨行 ×${CFG.CROSS_MULT} + 专属事件</div></div>
      <button class="buy" data-act="assignTo" data-arg="${i}">派 CEO</button></div>`;
  }
  return h;
}
function ceoPost(id) { const s = state.ceos[id]; return s.at >= 0 ? E.signOf(state, s.at).name : '休息中（空着）'; }
function renderCeo() {
  let h = `<div class="sec-title">CEO 们（同一时间只管一家）</div>`;
  for (const c of E.CEOS) {
    const s = state.ceos[c.id];
    if (!s.unlocked) { h += `<div class="card dim"><div class="ava">🔒</div><div class="info"><div class="name">${c.id === 'rocket' ? '？？？' : c.name}<span class="tag idle">${E.TYPES[c.type]}</span></div><div class="desc">${c.unlock}</div></div></div>`; continue; }
    const at = s.at, info = at >= 0 ? E.ceoInfo(state, at) : null;
    h += `<div class="card">${ava(c.id)}<div class="info"><div class="name">${c.name}<span class="lv">Lv.${s.lv}</span><span class="tag ${info ? (info.match ? 'match' : 'cross') : 'idle'}">${E.TYPES[c.type]}</span></div>
      <div class="desc one">现任：<b>${ceoPost(c.id)}</b>${info ? `（${info.match ? '专长' : '跨行'} ×${info.mult.toFixed(2)}）` : ''}</div>
      <div class="desc one">“${c.line}”</div></div>
      <div class="btns">${s.lv >= CFG.CEO_MAX ? '' : btn('ceoUp', c.id, '升级', E.ceoCost(c.id, s.lv))}<button class="buy alt" data-act="assign" data-arg="${c.id}">调任</button></div></div>`;
  }
  h += `<div class="sec-title">跨行组合</div><div class="cross-grid">`;
  for (const [k, x] of Object.entries(E.CROSS)) {
    const [id, shop] = k.split('@'), c = E.CEO_BY_ID[id], on = E.crossActive(state, k), known = state.ceos[id].unlocked;
    h += `<button class="cross-item ${on ? 'on' : ''}" data-act="comic" data-arg="${k}"><b>${x.title}${on ? ' ✅' : ''}</b><div class="who">${known ? c.name : '？？？'} → ${E.SHOPS[+shop].short}</div>${x.desc}</button>`;
  }
  h += `</div><div class="note">专长对口加成 ×${CFG.MATCH_MULT}，跨行 ×${CFG.CROSS_MULT}；CEO 每级 +${CFG.CEO_LV_BONUS * 100}%。调任前会先给你看每家店和全街每秒收益的变化，确认了才生效。离线收益按离开时的安排结算。</div>`;
  return h;
}
function renderGacha() {
  const owned = state.gacha.owned.length, total = E.ITEMS.length, rem = total - owned, unlocked = E.gachaUnlocked(state), price = E.gachaPrice(state), o = E.gachaOdds(state);
  const box = `<svg viewBox="0 0 84 84"><rect x="10" y="30" width="64" height="46" rx="4" fill="${unlocked ? '#ffd23f' : '#ccc'}" stroke="#141414" stroke-width="4"/><rect x="6" y="20" width="72" height="16" rx="3" fill="${unlocked ? '#e63946' : '#aaa'}" stroke="#141414" stroke-width="4"/><rect x="36" y="20" width="12" height="56" fill="#fff" stroke="#141414" stroke-width="3"/><path d="M42 20 C30 4 18 10 26 20 M42 20 C54 4 66 10 58 20" fill="none" stroke="#141414" stroke-width="4"/><text x="42" y="64" font-size="18" font-weight="900" text-anchor="middle" fill="#141414">${unlocked ? '?' : '🔒'}</text></svg>`;
  const P = x => (x * 100 >= 10 || x === 0 ? (x * 100).toFixed(0) : (x * 100).toFixed(1)) + '%';
  const ownS = E.SUPER_ITEMS.filter(it => state.gacha.owned.includes(it.id)).length, ownR = owned - ownS;
  let h = `<div class="sec-title">77 收藏盲盒</div>`;
  if (!unlocked) {
    h += `<div class="box-hero"><div class="box-ico">${box}</div><div class="info"><div class="name">还没开放</div><div class="desc">摸鱼科技公司雇到员工后开放。<br>只花游戏金币，不卖真钱。</div></div></div>`;
  } else {
    h += `<div class="box-hero"><div class="box-ico" id="boxIco">${box}</div><div class="info"><div class="name">已收集 ${owned}/${total}</div>
      <div class="desc">${rem ? `下一抽：<b>超级装饰 ${P(o.superP)}</b>${o.remSuper ? `（每件 ${P(o.perSuper)}）` : ''} · 普通收藏 ${P(o.regP)}${o.remReg ? `（每件 ${P(o.perReg)}）` : ''}<br>${o.remSuper ? (o.guaranteed ? '<b style="color:var(--red)">这一抽必出超级装饰！</b>' : `保底：再 <b>${o.pityLeft}</b> 抽内必出超级装饰`) : '超级装饰已集齐'}` : `${total} 件全收集！`}</div>
      <div style="margin-top:6px">${rem ? btn('draw', '', '开一个', price, 'red') : '<button class="buy no" disabled>已集齐</button>'}</div></div></div>`;
  }
  h += `<div class="sec-title">超级装饰 ${ownS}/${E.SUPER_ITEMS.length}（每店一件，只能抽到）</div>`;
  h += E.SUPER_ITEMS.map(it => { const has = state.gacha.owned.includes(it.id);
    return `<div class="card super ${has ? '' : 'dim'}"><div class="ava sq">${has ? SUPER_ICON[it.id] : '❓'}</div><div class="info"><div class="name">${it.name}<span class="tag ${has ? 'match' : 'idle'}">${E.SHOPS[it.shop].short}</span></div><div class="desc">${it.desc}</div></div></div>`; }).join('');
  h += `<div class="sec-title">普通收藏 ${ownR}/${E.REGULAR_ITEMS.length}</div>`;
  h += `<div class="item-grid">${E.REGULAR_ITEMS.map(it => { const has = state.gacha.owned.includes(it.id);
    return `<div class="item ${has ? '' : 'no'}"><span class="t">${TYPE_LABEL[it.type]}</span>${itemIcon(it.id)}${has ? it.name : '？？？'}</div>`; }).join('')}</div>`;
  h += `<div class="note">规则：不重复收藏盒，共 ${total} 件：普通收藏 ${E.REGULAR_ITEMS.length} 件（衣服 8 / 帽子 8 / 装饰 8 / 故事卡 8）+ 超级装饰 ${E.SUPER_ITEMS.length} 件。每抽先定类别：<b>超级装饰 ${P(CFG.SUPER_P)}</b>、普通收藏 ${P(1 - CFG.SUPER_P)}，再从该类<b>还没收集的</b>里等概率抽；连续 ${CFG.SUPER_PITY - 1} 抽没出超级装饰，第 ${CFG.SUPER_PITY} 抽必出。某一类抽完了，就只出另一类。每抽必得新物品，最多 ${total} 抽集齐，集齐后不能再买、不扣金币。普通收藏只是好看，<b>不加产速</b>；超级装饰加本店产量和专属效果，但不抽也能正常开齐店铺。单价 ${fmt(CFG.GACHA_PRICE)}。</div>`;
  return h;
}
let wardrobeWho = 'c77';
function renderCol() {
  const own = new Set(state.gacha.owned), setDone = E.cardsComplete(state);
  const ceos = E.CEOS.filter(c => state.ceos[c.id].unlocked); if (!ceos.some(c => c.id === wardrobeWho)) wardrobeWho = 'c77';
  const who = wardrobeWho, eq = wearOf(who), whoName = E.CEO_BY_ID[who].name;
  const clothes = ['none', ...E.ITEMS.filter(i => i.type === 'clothes' && own.has(i.id)).map(i => i.id), ...(setDone ? ['c_gold'] : [])];
  const hats = ['none', ...E.ITEMS.filter(i => i.type === 'hat' && own.has(i.id)).map(i => i.id), ...(setDone ? ['h_gold'] : [])];
  const nameOf = id => id === 'none' ? '默认' : id === 'c_gold' ? '金马甲' : id === 'h_gold' ? '金厨师帽' : E.ITEM_BY_ID[id].name;
  const cell = (slot, id) => `<button class="item ${((eq[slot] || 'none') === id) ? 'sel' : ''}" data-act="equip" data-arg="${who}:${slot}:${id}">${id === 'none' ? '<span class="ii">🙂</span>' : (itemThumb(id) ? `<img src="${itemThumb(id)}" style="width:44px;height:44px" alt="">` : '')}${nameOf(id)}</button>`;
  let h = `<div class="sec-title">CEO 衣橱（穿在 CEO 身上，换店跟着人走）</div>
    <div class="who-row">${ceos.map(c => `<button class="who ${c.id === who ? 'on' : ''}" data-act="wearWho" data-arg="${c.id}">${ava(c.id)}<span>${c.name}</span></button>`).join('')}</div>
    <div class="note" style="margin-top:0">正在给 <b>${whoName}</b> 换装${state.ceos[who].at >= 0 ? '（现任：' + E.signOf(state, state.ceos[who].at).name + '）' : ''}</div>
    <div class="item-grid">${clothes.map(id => cell('clothes', id)).join('')}</div>
    <div class="item-grid">${hats.map(id => cell('hat', id)).join('')}</div>`;
  if (clothes.length + hats.length <= 2) h += `<div class="note">从盲盒里抽到衣服、帽子后，在这里给 CEO 换上。</div>`;
  const supers = E.SUPER_ITEMS.filter(it => own.has(it.id));
  if (supers.length) { h += `<div class="sec-title">超级装饰（常驻生效）</div>`;
    h += supers.map(it => `<div class="card super"><div class="ava sq">${SUPER_ICON[it.id]}</div><div class="info"><div class="name">${it.name}<span class="tag match">${E.SHOPS[it.shop].short}</span></div><div class="desc">${it.desc}</div></div></div>`).join(''); }
  h += `<div class="sec-title">店铺装饰</div>`;
  const decors = E.ITEMS.filter(i => i.type === 'decor');
  h += decors.map(d => own.has(d.id)
    ? `<div class="card"><div class="ava sq">${DECOR_ICON[d.id]}</div><div class="info"><div class="name">${d.name}</div><div class="desc">摆在每家店门口（不加产速）</div></div><button class="toggle ${decorOn(d.id) ? 'on' : ''}" data-act="decor" data-arg="${d.id}">${decorOn(d.id) ? '摆着' : '收起'}</button></div>`
    : `<div class="card dim"><div class="ava sq">❓</div><div class="info"><div class="name">？？？</div><div class="desc">盲盒里抽</div></div></div>`).join('');
  const cards = E.ITEMS.filter(i => i.type === 'card');
  h += `<div class="sec-title">故事卡图鉴 ${cards.filter(c => own.has(c.id)).length}/${cards.length}</div>`;
  h += cards.map((c, k) => own.has(c.id)
    ? `<div class="story"><b>${k + 1}. ${c.name}</b><p>${c.text}</p></div>` : `<div class="story no"><b>${k + 1}. ？？？</b><p>还没收集</p></div>`).join('');
  h += `<div class="note">${setDone ? `✅ 已集齐 ${cards.length} 张故事卡：解锁专属外观「金牌摊主」（金马甲 + 金厨师帽），在衣橱里给任意 CEO 换上。` : `集齐 ${cards.length} 张故事卡，解锁专属外观「金牌摊主」（金马甲 + 金厨师帽）。`}</div>`;
  h += `<div class="sec-title">设置</div><div class="card"><div class="info"><div class="name">存档</div><div class="desc">版本 v${state.v} · 自动保存在本机浏览器 · 每日双倍按马来西亚时间早上 5 点重置</div></div>
    <button class="buy ghost" data-act="reset" data-arg="">重新开始</button></div><div class="note">试玩版 · 只花游戏金币，没有任何真钱购买。</div>`;
  return h;
}
function renderTab() {
  const html = tab === 'shop' ? renderShop() : tab === 'ceo' ? renderCeo() : tab === 'gacha' ? renderGacha() : renderCol();
  tabBody.innerHTML = html; dirty = false; refreshDynamic(true);
}
function setTab(t) { tab = t; document.querySelectorAll('#bottomNav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $('#panel').scrollTop = 0; renderTab(); }
function switchShop(i) { if (i < 0 || i > 3) return; state.cur = i; big = big && state.shops[i].open ? big : null; dirty = true; renderTabs(); }
function renderTabs() {
  $('#shopTabs').innerHTML = E.SHOPS.map((S, i) => { const s = state.shops[i];
    const sub = s.open ? (s.emp > 0 ? '+' + fmt(E.shopRate(state, i)) + '/秒' : '未雇员工') : (i === 0 || state.shops[i - 1].open ? fmt(S.open) : '🔒');
    return `<button data-shop="${i}" class="${state.cur === i ? 'on' : ''} ${s.open ? '' : 'locked'}"><span class="tn">${SHOP_ICON[i]} ${TAB_NAME[i]}</span><small>${sub}</small></button>`; }).join('');
}
let lastDyn = 0;
function refreshDynamic(force) {
  const t = now();
  // 顶部
  const r = E.onlineRate(state, t), boost = E.boostActive(state, t);
  const ct = fmt(state.coins); if (coinsEl.textContent !== ct) coinsEl.textContent = ct;
  const cps = '每秒 +' + fmt(r) + (boost ? '（×5）' : ''); if (cpsEl.textContent !== cps) cpsEl.textContent = cps;
  $('#boostTag').classList.toggle('hidden', !boost); if (boost) $('#boostSec').textContent = Math.ceil((state.boostEnd - t) / 1000);
  const dc = $('#dailyChip'), can = E.canDouble(state, t);
  const dtxt = can ? '今日双倍 ✓' : '双倍 ' + fmtClockMYT(E.nextResetTs(t)) + ' 重置'; if (dc.textContent !== dtxt) dc.textContent = dtxt;
  dc.className = 'chip ' + (can ? 'on' : 'used');
  // 按钮可买状态
  tabBody.querySelectorAll('[data-cost]').forEach(b => b.classList.toggle('no', state.coins < +b.dataset.cost));
  if (!force && t - lastDyn < 900) return; lastDyn = t;
  // 下一步
  const gl = E.nextGoal(state); $('#goalTxt').textContent = gl.text + (gl.lv ? `（${gl.cur}/${gl.need}）` : gl.count ? `（${gl.cur}/${gl.need}）` : '');
  $('#goalBar').style.width = Math.min(100, gl.cur / gl.need * 100).toFixed(0) + '%';
  renderTabs();
  // 底部提醒点
  const gdot = E.gachaUnlocked(state) && !E.gachaComplete(state) && state.coins >= E.gachaPrice(state);
  const nb = document.querySelector('#bottomNav [data-tab="gacha"]'); const has = !!nb.querySelector('.dot');
  if (gdot && !has) nb.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); if (!gdot && has) nb.querySelector('.dot').remove();
  const cdot = E.CEOS.some(c => state.ceos[c.id].unlocked && state.ceos[c.id].at === -1);
  const cb = document.querySelector('#bottomNav [data-tab="ceo"]'); const hc = !!cb.querySelector('.dot');
  if (cdot && !hc) cb.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); if (!cdot && hc) cb.querySelector('.dot').remove();
}

/* ================= 弹窗 ================= */
const modal = $('#modal'), mpanel = $('#mpanel'), sheet = $('#sheet'), sheetPanel = $('#sheetPanel');
const mq = [];
function modalOpen() { return !modal.classList.contains('hidden') || !sheet.classList.contains('hidden'); }
function queueModal(fn) { if (modalOpen()) mq.push(fn); else fn(); }
function openModal(html, burst = true) { mpanel.innerHTML = html; modal.querySelector('.burst').style.display = burst ? '' : 'none'; modal.classList.remove('hidden'); mpanel.scrollTop = 0; }
function closeModal() { modal.classList.add('hidden'); mpanel.innerHTML = ''; if (mq.length && !modalOpen()) setTimeout(() => { if (!modalOpen() && mq.length) mq.shift()(); }, 120); }
function openSheet(html) { sheetPanel.innerHTML = html; sheet.classList.remove('hidden'); }
function closeSheet() { sheet.classList.add('hidden'); sheetPanel.innerHTML = ''; }
sheet.querySelector('.sheet-bg').addEventListener('click', closeSheet);
const coinSm = '<span class="coin-ico sm"><span>赚</span></span>';

/* ---------- 离线收益 ---------- */
function showOffline() {
  const p = state.pending; if (!p) return;
  if (modalOpen()) { if (!mq.includes(showOffline)) mq.unshift(showOffline); return; }
  const can = E.canDouble(state, now()), capH = p.cap / 3600;
  const capped = p.gap > p.sec + 1;
  openModal(`<div class="mbubble">老板！你不在的时候……</div>
    <div class="mtitle">大家帮你干了 <b id="offDur">${fmtDur(p.sec)}</b></div>
    ${capped ? `<div class="mnote">（离开了 ${fmtDur(p.gap)}，离线最多算 ${capH} 小时）</div>` : ''}
    <div class="mreward">${coinSm}+<span id="offGain">${fmt(p.amount)}</span></div>
    <div class="mnote" id="offNote">离线 = 在线每秒收益的 50%，最多 ${capH} 小时${capH > 8 ? '（麻辣服务器 +2 小时）' : ''}；大客户 ×5 只算在线。按你离开时的店铺、员工和 CEO 安排结算。</div>
    <div class="mbtns">${can ? `<button class="buy big red" id="claimDouble">今日双倍领取 +${fmt(p.amount * 2)}</button><button class="buy ghost" id="claim">直接领取（双倍留到下次）</button>`
      : `<button class="buy big" id="claim">收下！</button><div class="mnote" style="margin:0">今日双倍已用，${fmtClockMYT(E.nextResetTs(now()))}（马来西亚时间）重置</div>`}</div>`);
  const go = dbl => {
    const r = atomic(() => E.claimOffline(state, now(), dbl));
    closeModal();
    if (r.ok) { sfx('reveal'); popWord(r.doubled ? '翻倍！' : '到账！'); bumpCoins(); burstCoins(W / 2, H * 0.5, 18); toast((r.doubled ? '双倍到账 +' : '到账 +') + fmt(r.amount)); dirty = true; }
    else if (r.why !== 'saveFailed') toast(r.why);
  };
  const cd = $('#claimDouble'); if (cd) cd.addEventListener('click', () => { audioUnlock(); go(true); }, { once:true });
  $('#claim').addEventListener('click', () => { audioUnlock(); go(false); }, { once:true });
}

/* ---------- 调任 ---------- */
function openAssign(id) {
  const s = state.ceos[id], c = E.CEO_BY_ID[id];
  let h = `<div class="sheet-title">${ava(id)}<div>把 <b>${c.name}</b>（${E.TYPES[c.type]}）派去哪？</div></div>`;
  E.SHOPS.forEach((S, i) => {
    if (!state.shops[i].open) { h += `<button class="pick" disabled><div class="ava sq">${SHOP_ICON[i]}</div><div class="pk-main"><div class="pk-name">${S.short}</div><div class="pk-sub">还没开张</div></div></button>`; return; }
    const here = E.ceoAt(state, i), match = c.type === S.type, cross = E.CROSS[E.crossKey(id, i)];
    h += `<button class="pick ${s.at === i ? 'cur' : ''}" data-pick="${i}" ${s.at === i ? 'disabled' : ''}><div class="ava sq">${SHOP_ICON[i]}</div><div class="pk-main">
      <div class="pk-name">${E.SIGNS[id][i][0]} ${s.at === i ? '（现在在这）' : ''}</div>
      <div class="pk-sub">${match ? `<span class="tag match">专长 ×${CFG.MATCH_MULT}</span>` : `<span class="tag cross">跨行 ×${CFG.CROSS_MULT}${cross ? ' · ' + cross.title : ''}</span>`} ${here && here !== id ? '· <b>交换任职</b>：' + E.CEO_BY_ID[here].name + ' 去' + (s.at >= 0 ? E.SHOPS[s.at].short : '休息') : ''}</div></div></button>`;
  });
  h += `<button class="pick ${s.at === -1 ? 'cur' : ''}" data-pick="-1" ${s.at === -1 ? 'disabled' : ''}><div class="ava">😴</div><div class="pk-main"><div class="pk-name">休息（空着）</div><div class="pk-sub">不管任何店</div></div></button>`;
  openSheet(h);
  sheetPanel.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { closeSheet(); showPreview(id, +b.dataset.pick); }));
}
function openAssignTo(i) {
  const here = E.ceoAt(state, i), S = E.SHOPS[i];
  let h = `<div class="sheet-title"><div class="ava sq">${SHOP_ICON[i]}</div><div>派谁来管 <b>${S.short}</b>？</div></div>`;
  const list = E.CEOS.filter(c => state.ceos[c.id].unlocked && c.id !== here);
  if (!list.length && !here) h += `<div class="note">还没有其他 CEO。开新店会有新 CEO 加入。</div>`;
  list.forEach(c => { const match = c.type === S.type, cross = E.CROSS[E.crossKey(c.id, i)];
    h += `<button class="pick" data-ceo="${c.id}">${ava(c.id)}<div class="pk-main"><div class="pk-name">${c.name} <small>Lv.${state.ceos[c.id].lv}</small> → ${E.SIGNS[c.id][i][0]}</div>
      <div class="pk-sub">${match ? `<span class="tag match">专长 ×${CFG.MATCH_MULT}</span>` : `<span class="tag cross">跨行 ×${CFG.CROSS_MULT}${cross ? ' · ' + cross.title : ''}</span>`} · 现在：${ceoPost(c.id)}${here ? ` · <b>交换任职</b>：${E.CEO_BY_ID[here].name} 去${state.ceos[c.id].at >= 0 ? E.SHOPS[state.ceos[c.id].at].short : '休息'}` : ''}</div></div></button>`; });
  if (here) h += `<button class="pick" data-ceo="${here}" data-rest="1"><div class="ava">😴</div><div class="pk-main"><div class="pk-name">让 ${E.CEO_BY_ID[here].name} 休息（空着）</div><div class="pk-sub">这家店没有 CEO 加成</div></div></button>`;
  if (!list.length && !here) h += '';
  openSheet(h);
  sheetPanel.querySelectorAll('[data-ceo]').forEach(b => b.addEventListener('click', () => { closeSheet(); showPreview(b.dataset.ceo, b.dataset.rest ? -1 : i); }));
}
function showPreview(id, target) {
  const pv = E.previewAssign(state, id, target); if (!pv.ok) { toast(pv.why); return; }
  const c = E.CEO_BY_ID[id], cls = (a, b) => b > a * 1.0001 ? 'up' : b < a * 0.9999 ? 'down' : 'same';
  const pct = (a, b) => a > 0 ? ((b / a - 1) * 100).toFixed(0) + '%' : (b > 0 ? '新增' : '');
  const who = x => x ? E.CEO_BY_ID[x].name : '空';
  let rows = pv.shops.filter(s => s.open).map(s => `<tr><td>${SHOP_ICON[s.i]} ${s.name}<div class="pv-who">CEO ${who(s.ceoBefore)} → ${who(s.ceoAfter)}</div></td>
    <td>${fmt(s.before)}</td><td>→</td><td class="${cls(s.before, s.after)}">${fmt(s.after)}${s.after !== s.before ? ' <small>(' + (s.after > s.before ? '+' : '') + pct(s.before, s.after) + ')</small>' : ''}</td></tr>`).join('');
  rows += `<tr class="total"><td>全街每秒</td><td>${fmt(pv.totalBefore)}</td><td>→</td><td class="${cls(pv.totalBefore, pv.totalAfter)}">${fmt(pv.totalAfter)}</td></tr>`;
  const tags = [
    ...pv.crossOn.map(k => `<div>✨ 触发跨行事件「${E.CROSS[k].title}」：${E.CROSS[k].desc}</div>`),
    ...pv.crossOff.map(k => `<div class="off">失去「${E.CROSS[k].title}」：${E.CROSS[k].desc}</div>`),
    ...(pv.offlineCapAfter !== pv.offlineCapBefore ? [`<div>离线上限 ${pv.offlineCapBefore / 3600} 小时 → ${pv.offlineCapAfter / 3600} 小时</div>`] : []),
  ].join('');
  const dl = s => { const d = s.after - s.before; return `<span class="${cls(s.before, s.after)}">${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}/秒</span>`; };
  const tShop = target >= 0 ? pv.shops[target] : null, fShop = pv.from >= 0 ? pv.shops[pv.from] : null;
  const swapBox = pv.swapped ? `<div class="swap-box"><b>交换任职</b>：${c.name} ⇄ ${E.CEO_BY_ID[pv.swapped].name}
      <div>${SHOP_ICON[target]} ${E.SHOPS[target].short}：${who(tShop.ceoBefore)} → ${who(tShop.ceoAfter)}，${fmt(tShop.before)} → ${fmt(tShop.after)}（${dl(tShop)}）</div>
      ${fShop ? `<div>${SHOP_ICON[pv.from]} ${E.SHOPS[pv.from].short}：${who(fShop.ceoBefore)} → ${who(fShop.ceoAfter)}，${fmt(fShop.before)} → ${fmt(fShop.after)}（${dl(fShop)}）</div>` : `<div>${E.CEO_BY_ID[pv.swapped].name} 去休息</div>`}</div>` : '';
  openModal(`<div class="mbubble">${pv.swapped ? '交换任职预览' : '调任预览'}</div>
    <div class="mtitle">${c.name} → ${target >= 0 ? E.SIGNS[id][target][0] : '休息（空着）'}</div>
    ${swapBox}
    <table class="pv-table">${rows}</table>
    ${tags ? `<div class="pv-tags">${tags}</div>` : ''}
    <div class="mbtns two"><button class="buy ghost" id="pvNo">再想想</button><button class="buy red" id="pvYes">${pv.swapped ? '交换任职' : '确认调任'}</button></div>`, false);
  $('#pvNo').addEventListener('click', closeModal, { once:true });
  $('#pvYes').addEventListener('click', () => {
    const oldSigns = E.SHOPS.map((_, i) => state.shops[i].open ? E.signOf(state, i).name : null);
    tick(); // 先按旧阵容把收益结清（长空档会先走离线结算），再换人；店铺等级/员工/装饰都不动
    const r = E.assignCeoWithPayout(state, id, target, now()); closeModal(); if (!r.ok) return toast(r.why);
    persist(); sfx('swoosh'); popWord('换牌！'); dirty = true;
    const view = target >= 0 ? target : (r.from >= 0 ? r.from : state.cur);
    switchShop(view); signAnim = { shop:view, from:oldSigns[view] || '', t0:clock };
    if (target >= 0) sayLine('c', E.SIGNS[id][target][1], 3);
    const newCross = pv.crossOn.filter(k => !state.crossSeen[k]);
    if (newCross.length) newCross.forEach(k => queueModal(() => showComic(k, true)));
    else toast(`${c.name} ${r.swapped ? '交换任职' : '已调任'}（旧岗位收益已结清），全街每秒 ${fmt(pv.totalAfter)}`);
    renderTab();
  }, { once:true });
}
function showComic(k, fresh) {
  const x = E.CROSS[k], [id, shop] = k.split('@'), c = E.CEO_BY_ID[id];
  if (!state.ceos[id].unlocked && !fresh) { toast('这位 CEO 还没加入'); return; }
  if (fresh) { state.crossSeen[k] = true; persist(); sfx('mile'); }
  openModal(`<div class="mbubble">${fresh ? '跨行事件！' : '跨行组合'}</div><div class="mtitle">${c.name} × ${E.SHOPS[+shop].short}：「${x.title}」</div>
    <div class="comic-sfx">${x.sfx}</div>
    <div class="comic two">${x.panels.map((p, n) => `<div class="panel4"><span class="pn">${n + 1}</span><div class="pchar"><div class="pimg"><img src="${avatarURL(p[0])}" alt=""></div><span class="pe">${p[1]}</span></div><div class="pt">${p[2]}</div></div>`).join('')}</div>
    <div class="mnote"><b>专属效果：</b>${x.desc}${E.crossActive(state, k) ? '（生效中）' : ''}</div>
    <button class="buy big" id="mOk">知道了</button>`);
  $('#mOk').addEventListener('click', closeModal, { once:true });
}
function showCeoJoin(id) {
  const c = E.CEO_BY_ID[id], s = state.ceos[id]; sfx('mile');
  openModal(`<div class="mbubble">新 CEO 加入！</div><div style="display:flex;justify-content:center;margin:6px 0"><div class="ava" style="width:96px;height:96px"><img src="${avatarURL(id)}" alt=""></div></div>
    <div class="mtitle">${c.name}（${E.TYPES[c.type]}）</div><div class="mnote">“${c.line}”<br>${s.at >= 0 ? '已就位：' + E.signOf(state, s.at).name : '现在在休息，去 CEO 页给 TA 安排一家店'}<br>专长对口 ×${CFG.MATCH_MULT}，跨行 ×${CFG.CROSS_MULT} + 专属事件</div>
    <button class="buy big" id="mOk">欢迎！</button>`);
  $('#mOk').addEventListener('click', () => { closeModal(); dirty = true; }, { once:true });
}
function showGachaOpen() {
  openModal(`<div class="mbubble">新玩法开放！</div><div class="mtitle">77 收藏盲盒</div><div class="mnote">${E.ITEMS.length} 件不重复：衣服、帽子（给 CEO 穿）、店铺装饰、故事卡，还有 4 件<b>超级装饰</b>（每店一件，加产量和专属效果）。每抽必出新的，概率和保底公开。只花游戏金币，不抽也照样开店升级。</div>
    <div class="mbtns two"><button class="buy ghost" id="mNo">等会儿</button><button class="buy red" id="mGo">去看看</button></div>`);
  $('#mNo').addEventListener('click', closeModal, { once:true });
  $('#mGo').addEventListener('click', () => { closeModal(); setTab('gacha'); }, { once:true });
}
/* ---------- 盲盒：先存结果，动画只播已确定的结果 ---------- */
let drawing = false;
function doGacha(b) {
  if (drawing) return;
  const r = atomic(() => E.gachaDraw(state, rand()));
  if (!r.ok) { if (r.why === 'saveFailed') return; return failBuy(b, r.why); }
  drawing = true; dirty = true; sfx('box');
  const ico = $('#boxIco'); if (ico) ico.classList.add('shake');
  setTimeout(() => { drawing = false; showReveal(false); }, 800);
}
function showReveal(resumed) {
  const last = state.gacha.last; if (!last) return;
  const it = E.ITEM_BY_ID[last.id]; if (!it) return; const sup = it.type === 'super', total = E.ITEMS.length, done = E.gachaComplete(state);
  sfx(sup ? 'mile' : 'reveal'); popWord(sup ? '超级！' : '开！'); if (sup) { focusT = 0.8; shake = 0.5; }
  const note = it.type === 'card' ? '“' + it.text + '”<br>' : it.type === 'decor' ? '已经摆进店里（收藏页可收起）<br>' : sup ? `<b>${it.desc}</b><br>已经放进${E.SHOPS[it.shop].name}，常驻生效<br>` : '去收藏页给 CEO 换上<br>';
  openModal(`<div class="mbubble">${resumed ? '上次开盒的结果' : sup ? '✨ 超级装饰！✨' : '开盒！'}</div>
    <div style="display:flex;justify-content:center;margin:4px 0"><div class="item ${sup ? 'superpop' : ''}" style="width:110px;font-size:14px">${itemIcon(it.id)}<b>${it.name}</b></div></div>
    <div class="mtitle">${TYPE_LABEL[it.type]}：${it.name}</div>
    <div class="mnote">${note}本次概率：${last.odds} · 已收集 ${state.gacha.owned.length}/${total}</div>
    ${last.setDone ? `<div class="pv-tags"><div>🎉 集齐 ${E.CARD_COUNT} 张故事卡！解锁专属外观「${E.SET_REWARD.name}」（金马甲 + 金厨师帽）</div></div>` : ''}
    <div class="mbtns two"><button class="buy ghost" id="mOk">收下</button>${!done && !resumed ? `<button class="buy red" id="mAgain">再开一个 · ${fmt(E.gachaPrice(state))}</button>` : sup ? `<button class="buy" id="mGoShop">去看看</button>` : `<button class="buy" id="mCol">去收藏页</button>`}</div>`);
  last.seen = true; persist(); bgKey = ''; dirty = true;
  $('#mOk').addEventListener('click', closeModal, { once:true });
  const ag = $('#mAgain'); if (ag) ag.addEventListener('click', () => { closeModal(); doGacha(ag); }, { once:true });
  const mc = $('#mCol'); if (mc) mc.addEventListener('click', () => { closeModal(); setTab('col'); }, { once:true });
  const ms = $('#mGoShop'); if (ms) ms.addEventListener('click', () => { closeModal(); switchShop(it.shop); setTab('shop'); }, { once:true });
}
function showCard(id) { const it = E.ITEM_BY_ID[id]; openModal(`<div class="mtitle">${it.name}</div><div class="mnote">${it.text}</div><button class="buy big" id="mOk">好</button>`); $('#mOk').addEventListener('click', closeModal, { once:true }); }
function confirmReset() {
  openModal(`<div class="mtitle">确定重新开始？</div><div class="mnote">所有店铺、CEO、员工、金币和收藏都会清空，不能恢复。</div>
    <div class="mbtns two"><button class="buy ghost" id="mNo">取消</button><button class="buy red" id="mYes">清空重来</button></div>`, false);
  $('#mNo').addEventListener('click', closeModal, { once:true });
  $('#mYes').addEventListener('click', () => { const rev = state.rev; state = E.newState(now()); state.rev = Math.max(rev, storedRev()); persist(); location.reload(); }, { once:true });
}
function showIntro() {
  openModal(`<div class="mbubble">欢迎来到《躺着也能赚》</div><div style="display:flex;justify-content:center;margin:6px 0"><div class="ava" style="width:96px;height:96px"><img src="${avatarURL('c77')}" alt=""></div></div>
    <div class="mtitle">77：巴适得很，串串烤起走！</div>
    <div class="mnote">① 点画面里的烧烤摊赚第一桶金<br>② 攒 50 雇员工阿炭，之后<b>躺着也能赚</b><br>③ 开新店、升级店铺/员工/CEO，把 CEO 调去别的店试试跨行事件<br>离线也有收益（50%，最多 8 小时），每天还有一次免费双倍。</div>
    <button class="buy big red" id="mOk">开摊！</button>`);
  $('#mOk').addEventListener('click', () => { audioUnlock(); closeModal(); sayLine('c', '巴适得很，串串烤起走！', 3); }, { once:true });
}

/* ================= 输入 / 循环 / 启动 ================= */
const ptr = {};
cv.addEventListener('pointerdown', e => { audioUnlock(); const r = cv.getBoundingClientRect(); ptr[e.pointerId] = { x:e.clientX - r.left, y:e.clientY - r.top, t:clock }; });
cv.addEventListener('pointerup', e => {
  const p = ptr[e.pointerId]; delete ptr[e.pointerId]; if (!p || frozen) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, dx = x - p.x, dy = y - p.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { const n = state.cur + (dx < 0 ? 1 : -1); if (n >= 0 && n <= 3) { switchShop(n); sfx('swoosh'); } return; }
  if (Math.hypot(dx, dy) > 14) return;
  if (hitBig(x, y)) return;
  tapShop(x, y);
});
cv.addEventListener('pointercancel', e => { delete ptr[e.pointerId]; });
tabBody.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || frozen) return; audioUnlock(); act(b.dataset.act, b.dataset.arg, b); });
$('#shopTabs').addEventListener('click', e => { const b = e.target.closest('[data-shop]'); if (!b) return; audioUnlock(); switchShop(+b.dataset.shop); if (tab !== 'shop') setTab('shop'); });
$('#bottomNav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; audioUnlock(); setTab(b.dataset.tab); });
$('#mute').addEventListener('click', () => {
  state.muted = !state.muted; $('#mute').classList.toggle('off', state.muted);
  if (state.muted) { if (AU.master) AU.master.gain.value = 0; audioPause(); }
  else { audioUnlock(); if (AU.master) AU.master.gain.value = 1; audioResume(); }
  persist();
});
$('#dailyChip').addEventListener('click', () => toast(E.canDouble(state, now()) ? '每日双倍：今天第一次领离线收益可以免费翻倍（先封顶再翻倍）' : '今天的双倍用过啦，马来西亚时间早上 5 点重置', 2600));
document.addEventListener('gesturestart', e => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const t = Date.now(); if (t - lastTouchEnd < 300 && !e.target.closest('button')) e.preventDefault(); lastTouchEnd = t; }, { passive:false });

function onHide() { if (frozen) return; tick(); state.lastSeen = now(); persist(); audioPause(); }
function onShow() {
  if (frozen) return;
  if (!lockMine()) { freeze(); return; }
  if (storedRev() > state.rev) { freeze(); return; }
  tick(); audioResume(); lastFrame = performance.now();
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onHide(); else onShow(); });
window.addEventListener('pagehide', onHide);
window.addEventListener('pageshow', e => { if (e.persisted) onShow(); });
window.addEventListener('blur', () => { if (!frozen) persist(); });
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); });

let lastFrame = performance.now(), dynAcc = 0, saveAcc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - lastFrame) / 1000); lastFrame = ts; clock = ts / 1000;
  if (frozen) return;
  tick(); updateBig(); updateSupers();
  if (focusT > 0) focusT -= dt; if (shake > 0) shake = Math.max(0, shake - dt * 1.5);
  if (clock > nextBubbleAt) { nextBubbleAt = clock + 9 + Math.random() * 7; const i = state.cur;
    if (state.shops[i].open) { const cid = E.ceoAt(state, i); if (Math.random() < 0.5 && cid) sayLine('c', Math.random() < 0.5 ? E.CEO_BY_ID[cid].line : E.SIGNS[cid][i][1]); else if (state.shops[i].emp > 0) sayLine('e', E.SHOPS[i].emp.line); } }
  render(clock);
  dynAcc += dt; if (dynAcc > 0.25) { dynAcc = 0; refreshDynamic(); }
  if (dirty) renderTab();
  saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; persist(); }
}

function boot() {
  state = loadState(); claimLock();
  $('#mute').classList.toggle('off', !!state.muted);
  resize();
  const first = !state.taps && !state.totalEarned && state.shops[0].emp === 0;
  const p = E.settleOffline(state, now(), rid);
  persist();
  scheduleBig(); renderTabs(); setTab('shop');
  if (migratedFrom != null) toast('存档已升级到 v' + CFG.SAVE_VERSION + '（新盲盒 + CEO 穿搭，收藏都保留）', 2600);
  if (p && p.rolledBack) toast('检测到手机时间被往回调，这段时间不发离线收益');
  if (first) queueModal(showIntro);
  if (state.pending) queueModal(showOffline);
  if (state.gacha.last && !state.gacha.last.seen) queueModal(() => showReveal(true));
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}
boot();

// 测试/调试钩子（不影响玩家）
window.__tzz = { E, showComic, get state() { return state; }, set state(v) { state = v; }, persist, onReturn, tapShop, act, setTab, switchShop, renderTab,
  forceBig() { nextBigAt = 0; big = null; }, forceSupers() { for (const k in superNext) superNext[k] = 0; updateSupers(); renderTab(); }, get big() { return big; }, hitBig, modalOpen, closeModal, get frozen() { return frozen; },
  audioState() { return AU.ctx ? AU.ctx.state : 'none'; }, showPreview, openAssign };
})();
