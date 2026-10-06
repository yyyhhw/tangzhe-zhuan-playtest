/* 躺着也能赚 v1（试玩版）— 四家店 · CEO + 员工 · 离线 · 每日双倍 · 不重复盲盒（32 普通 + 4 超级装饰）· CEO 穿搭 */
(() => {
'use strict';
const E = window.Economy, CFG = E.CFG;
const SAVE_KEY = 'tangzhe-preview-save', BAK_KEY = 'tangzhe-preview-save-bak', LOCK_KEY = 'tangzhe-preview-tab-lock';
// 12b2 测试房间：只有网址带 ?test=homes 才进；整局放在内存里，不读、不写任何 localStorage（真存档 / 备份 / 多标签锁都不碰），刷新就重置
// &lv=3 → 四家都是豪宅，默认四家都是公寓
const TEST_Q = (() => { try { return new URLSearchParams(location.search); } catch (e) { return null; } })();
const TEST_MODE = !!(TEST_Q && TEST_Q.get('test') === 'homes'), TEST_LV = TEST_Q && TEST_Q.get('lv') === '3' ? 3 : 2;
const INK = '#141414', PAPER = '#f7f1e3', RED = '#e63946', YELLOW = '#ffd23f', TAU = Math.PI * 2;
const $ = s => document.querySelector(s);
const now = () => Date.now();
const rid = () => (crypto && crypto.getRandomValues) ? Array.from(crypto.getRandomValues(new Uint32Array(2))).map(x => x.toString(36)).join('') : String(Math.random()).slice(2);
const rand = () => { if (crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296; return Math.random(); };

/* ================= 存档（版本号 + 多标签防重复） ================= */
const TAB = rid();
let frozen = false, state, migratedFrom = null, loadWallMig = { moved:0, stored:0 };
// 12d 金币安全：读档走 E.loadSave（主档坏 → 完整备份 BAK_KEY；都坏 → saveBlocked：只在内存里玩，绝不覆盖原档）；写档前 E.validState 校验
let loadInfo = { source:'new', bad:[] }, saveBlocked = false, lastGood = null;
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function loadState() {
  if (TEST_MODE) { loadWallMig = { moved:0, stored:0 }; migratedFrom = null; return E.testHomesState(now(), TEST_LV); }
  const m = E.loadSave(lsGet(SAVE_KEY), lsGet(BAK_KEY), now()), raw = m.raw;
  loadInfo = { source:m.source, bad:m.bad || [], badPending:!!m.badPending, unsafe:!!m.unsafe, bakOk:!!m.bakOk, bakCoins:m.bakCoins, rawCoins:m.raw && m.raw.coins };
  if (raw && raw.v !== CFG.SAVE_VERSION && m.source !== 'broken' && !m.blocked) { try { localStorage.setItem(BAK_KEY + '-v' + (raw.v || 0), JSON.stringify(raw)); } catch (e) {} }
  loadWallMig = m.wall || { moved:0, stored:0 };
  migratedFrom = raw && m.source !== 'broken' && !m.blocked ? (raw.v !== CFG.SAVE_VERSION ? (raw.v || 0) : null) : null;
  if (m.source === 'bak') m.st.rev = Math.max(m.st.rev || 0, m.mainRev || 0);   // 从备份恢复：rev 不低于坏主档，免得多标签锁误判
  if (m.blocked) saveBlocked = true;
  return m.st;
}
function storedRev() { if (TEST_MODE) return -1; try { const r = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return r ? (r.rev || 0) : -1; } catch (e) { return -1; } }
// 保存 = 先确认没有别的页面写过（rev 比我新就冻结本页），再整份原子写入
function persist() {
  if (frozen) return false;
  if (TEST_MODE) { state.rev++; return true; }   // 测试房间：只在内存里，永远不写真存档
  if (saveBlocked) { state.rev++; return true; } // 12d：坏档且没有可用备份 → 只在内存里玩，原档一个字节都不改
  const bad = E.validState(state);                // 12d：写档前校验（金币 / 等级 / 待领取收益），坏了不写、恢复上一份好档
  if (bad.length) { restoreGood(bad); return false; }
  const sr = storedRev();
  if (sr > state.rev) { freeze(); return false; }
  const t = now();
  if (t > state.lastSeen) state.lastSeen = t;
  state.maxSeen = Math.max(state.maxSeen || 0, state.lastSeen);
  state.rev++;
  const json = JSON.stringify(state);
  // 完整备份：把上一份通过校验的主档整份挪到 BAK_KEY（README 里已有的 -bak 键，不新增键），再写新主档
  try { const prev = localStorage.getItem(SAVE_KEY); if (prev && prev !== json) { let ok = false; try { ok = !E.checkSave(JSON.parse(prev)).length; } catch (e) {} if (ok) localStorage.setItem(BAK_KEY, prev); } } catch (e) {}
  try { localStorage.setItem(SAVE_KEY, json); lastGood = json; return true; }
  catch (e) { state.rev--; toast('存档失败：浏览器存储不可用（无痕模式？）'); return false; }
}
// 内存里出现坏值（NaN / ∞ / 负数 / 非数字）：不写盘，整档回到上一次成功写入的样子
function restoreGood(bad) {
  if (lastGood) { try { state = JSON.parse(lastGood); E.normWallet(state); } catch (e) {} }
  dirty = true;
  toast('金币数据异常（' + bad.slice(0, 3).join('、') + '），没有存档，已回到上一次存档', 3200);
}
// 关键操作（领钱、开盲盒）：失败就回滚内存，保证「扣钱/入账/记录」要么一起成功要么都没发生
function atomic(fn) {
  const snap = JSON.stringify(state);
  const res = fn();
  if (res && res.ok === false) return res;
  if (!persist()) { state = JSON.parse(snap); return { ok:false, why:'saveFailed' }; }
  return res;
}
function claimLock() { if (TEST_MODE) return; try { localStorage.setItem(LOCK_KEY, JSON.stringify({ tab:TAB, t:now() })); } catch (e) {} }
function lockMine() { if (TEST_MODE) return true; try { const v = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null'); return !v || v.tab === TAB; } catch (e) { return true; } }
function freeze() {
  if (frozen) return; frozen = true;
  $('#lockOverlay').classList.remove('hidden'); audioPause();
}
window.addEventListener('storage', e => {
  if (frozen || TEST_MODE) return;
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
    case 'crit': case 'crit1': tone(660, t, 0.1, 'square', 0.15); tone(990, t + 0.06, 0.1, 'square', 0.15); tone(1480, t + 0.12, 0.18, 'sine', 0.18); break;
    case 'crit2': tone(120, t, 0.12, 'sawtooth', 0.2, AU.sfx, 60); tone(784, t, 0.1, 'square', 0.16); tone(1175, t + 0.05, 0.1, 'square', 0.16); tone(1760, t + 0.1, 0.22, 'sine', 0.2); break;
    case 'crit3': tone(90, t, 0.22, 'sawtooth', 0.26, AU.sfx, 40); [784, 988, 1319, 1760, 2093].forEach((f, k) => tone(f, t + k * 0.045, 0.16, k % 2 ? 'square' : 'triangle', 0.18)); tone(2637, t + 0.25, 0.3, 'sine', 0.16); break;
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
  // 12c1：四位 CEO 店内小人沿用熊大立绘的发型 / 配饰 / 主色（77 高马尾+粉蝴蝶结+红 T 棕围裙；珍珠姐及颌卷发+珍珠发夹+薄荷衬衫杏色围裙；阿宅乱发+圆眼镜+藏青连帽衫；火箭老板背头+黑西装+火箭胸针）
  // 12b3：77 换熊大漫画新形象后（12b2 头像 / 立绘），店内小人配色同步：粉蝴蝶结高马尾 + 红 T + 粉围裙 + 深棕长裤 + 棕靴（取色自 ceo77_fullbody_comic_v1）
  c77:    { skin:'#ffe0c7', hair:'#4a2c22', style:'pony', bow:'#f4837a', top:'#e84d3c', short:true, apron:'#f0a08e', pants:'#4a2f26', shoe:'#835233', female:true, tag:'77' },
  pearl:  { skin:'#ffe0c7', hair:'#7a4a2a', style:'wavy', pin:true, top:'#bfe3c4', apron:'#e3a35f', female:true, lips:true },
  otaku:  { skin:'#ffe6d0', hair:'#1e1e1e', style:'messy', glasses:true, top:'#25335c', hood:true },
  rocket: { skin:'#ffe0c7', hair:'#5a3a26', style:'swept', top:'#2b2b2b', inner:'#141414', lapel:true, rocketLogo:true, smug:true },
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
  if (eq.clothes && CLOTHES[eq.clothes]) Object.assign(L, CLOTHES[eq.clothes], { rocketLogo:false, hood:false, tie:false, inner:null, lapel:false, short:false, pants:null, tag:id === 'c77' ? base.tag : null });   // 12b3：换衣服时裤子回到衣服自己的默认色（背带裤蓝 / 深灰），不沿用 77 的深棕长裤
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
  c.fillStyle = dotsPattern(c, 'rgba(20,20,20,.07)', 7 * U); c.fillRect(0, 0, W, H * 0.6); // 12c1：背景网点减轻（非重点区）
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
  c.fillStyle = dotsPattern(c, 'rgba(20,20,20,.10)', 5 * U); c.fillRect(fx + fw * 0.06 + 2, cy + 4 * U, fw * 0.66 - 4, l.ground - cy - 6 * U);
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
// 12c1：约 3 头身（头 ≈ 全身 1/3）、平涂 + 一层色块阴影；手臂两段（上臂袖子 → 弯肘 → 袖口 → 小臂 + 手），裤子是有宽度的两条裤管 + 裤脚
function shadeHex(hex, k) { // k<0 变暗、k>0 变亮（0~1）
  let h = String(hex || '#888').replace('#', ''); if (h.length === 3) h = h.replace(/./g, m => m + m);
  const n = parseInt(h.slice(0, 6), 16); if (isNaN(n)) return hex;
  const f = v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
}
const SHADE = 'rgba(20,20,20,.16)';
function personArm(c, side, a1, a2, look) {
  // side：-1 左 / 1 右；a1 上臂相对“垂直向下”的外摆角，a2 弯肘角（负 = 往身前收）
  const sx = side * 17.5, sy = -67, L1 = 16, L2 = 15;
  const ex = sx + side * Math.sin(a1) * L1, ey = sy + Math.cos(a1) * L1;
  const b = a1 + a2, wx = ex + side * Math.sin(b) * L2, wy = ey + Math.cos(b) * L2;
  const cut = look.short ? -0.25 : 0.38; // 短袖：袖口在肘上；长袖：袖口在小臂上
  const cx = cut < 0 ? ex + (sx - ex) * -cut : ex + (wx - ex) * cut, cy = cut < 0 ? ey + (sy - ey) * -cut : ey + (wy - ey) * cut;
  const sleeve = look.sleeve || look.top, cuff = look.cuff || shadeHex(sleeve, -0.28);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // 小臂（皮肤）
  c.strokeStyle = INK; c.lineWidth = 8.5; c.beginPath(); c.moveTo(cut < 0 ? ex : cx, cut < 0 ? ey : cy); if (cut < 0) { c.moveTo(cx, cy); c.lineTo(ex, ey); } c.lineTo(wx, wy); c.stroke();
  c.strokeStyle = look.skin; c.lineWidth = 5; c.stroke();
  // 袖子（上臂 → 弯肘）
  c.beginPath(); c.moveTo(sx, sy); if (cut < 0) c.lineTo(cx, cy); else { c.lineTo(ex, ey); c.lineTo(cx, cy); }
  c.strokeStyle = INK; c.lineWidth = 12; c.stroke(); c.strokeStyle = sleeve; c.lineWidth = 8; c.stroke();
  // 袖口：一道垂直于手臂的色带
  const dx = (cut < 0 ? cx - sx : wx - ex), dy = (cut < 0 ? cy - sy : wy - ey), dl = Math.hypot(dx, dy) || 1, nx = -dy / dl * 5.6, ny = dx / dl * 5.6;
  c.lineCap = 'butt'; c.beginPath(); c.moveTo(cx - nx, cy - ny); c.lineTo(cx + nx, cy + ny);
  c.strokeStyle = INK; c.lineWidth = 6.5; c.stroke(); c.strokeStyle = cuff; c.lineWidth = 3.2; c.stroke(); c.lineCap = 'round';
  // 手
  c.beginPath(); c.arc(wx, wy, 4.2, 0, TAU); c.fillStyle = look.skin; c.fill(); c.strokeStyle = INK; c.lineWidth = 2.2; c.stroke();
}
function drawPerson(c, x, y, s, look, o = {}) {
  const t = o.t || 0;
  c.save(); c.translate(x, y + (o.bob ? Math.sin(t * 6) * 1.6 * s : 0)); c.scale(o.flip ? -s : s, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  const LW = 3, pants = look.pants || (look.pattern === 'overall' ? '#2c5282' : '#3d405b');
  // 裤腿：两条有宽度的裤管（内侧一层色块阴影）+ 折边裤脚 + 鞋
  for (const d of [-1, 1]) {
    c.beginPath(); c.moveTo(d * 1.5, -42); c.lineTo(d * 16, -42); c.lineTo(d * 14.5, -9); c.lineTo(d * 3.5, -9); c.closePath(); inkFill(c, pants, 2.6);
    c.save(); c.clip(); c.fillStyle = SHADE; c.beginPath(); c.moveTo(d * 1.5, -42); c.lineTo(d * 6.5, -42); c.lineTo(d * 7.5, -9); c.lineTo(d * 1.5, -9); c.closePath(); c.fill(); c.restore();
    c.beginPath(); c.moveTo(d * 3.2, -13); c.lineTo(d * 14.8, -13); c.lineTo(d * 15, -8); c.lineTo(d * 3, -8); c.closePath(); inkFill(c, shadeHex(pants, -0.3), 2);
    c.beginPath(); c.moveTo(d * 2.5, -8); c.lineTo(d * 15, -8); c.quadraticCurveTo(d * 21, -7, d * 20, -1.5); c.lineTo(d * 2.5, -1.5); c.closePath(); inkFill(c, look.shoe || '#2f2a28', 2.2);
  }
  // 身体（平涂 + 右侧一层色块阴影）
  const torso = () => { c.beginPath(); c.moveTo(-20, -36); c.quadraticCurveTo(-22, -66, -12, -72); c.lineTo(12, -72); c.quadraticCurveTo(22, -66, 20, -36); c.closePath(); };
  torso(); inkFill(c, look.top, LW);
  c.save(); torso(); c.clip(); c.fillStyle = SHADE; c.beginPath(); c.moveTo(9, -74); c.quadraticCurveTo(15, -55, 9, -34); c.lineTo(26, -34); c.lineTo(26, -74); c.closePath(); c.fill(); c.restore();
  c.fillStyle = look.belt || shadeHex(pants, -0.35); c.fillRect(-19.5, -40, 39, 4); c.lineWidth = 1.6; c.strokeStyle = INK; c.strokeRect(-19.5, -40, 39, 4);
  if (look.inner) { c.beginPath(); c.moveTo(-7, -72); c.lineTo(7, -72); c.lineTo(5, -38); c.lineTo(-5, -38); c.closePath(); inkFill(c, look.inner, 1.8); }
  if (look.lapel) { for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 7, -72); c.lineTo(d * 13, -66); c.lineTo(d * 8, -60); c.lineTo(d * 5, -46); c.closePath(); inkFill(c, shadeHex(look.top, 0.12), 1.8); } }
  if (look.pattern === 'flower') { c.fillStyle = RED; for (const [px, py] of [[-10, -62], [6, -55], [-4, -45], [12, -66], [-14, -44], [10, -42]]) { c.beginPath(); c.arc(px, py, 2.6, 0, TAU); c.fill(); } }
  if (look.pattern === 'panda') { c.fillStyle = INK; c.beginPath(); c.ellipse(-9, -52, 6, 8, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(10, -46, 5, 7, -0.3, 0, TAU); c.fill(); }
  if (look.pattern === 'overall') { rr(c, -12, -58, 24, 22, 2); inkFill(c, '#2c5282', 2); c.strokeStyle = '#d2691e'; c.lineWidth = 2; c.beginPath(); c.moveTo(6, -56); c.lineTo(10, -66); c.stroke(); }
  if (look.pattern === 'qipao') { c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-6, -70); c.quadraticCurveTo(4, -64, 10, -66); c.stroke(); c.fillStyle = '#fff'; for (const [px, py] of [[-8, -56], [8, -50], [-4, -42], [10, -60]]) { c.beginPath(); c.arc(px, py, 2.2, 0, TAU); c.fill(); } c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(4, -64, 2, 0, TAU); c.fill(); }
  if (look.pattern === 'manga') { rr(c, -10, -62, 20, 15, 4); inkFill(c, '#fff', 1.8); c.fillStyle = INK; c.font = '900 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('！', 0, -54); c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -36); c.lineTo(-6, -44); c.moveTo(6, -36); c.lineTo(6, -44); c.stroke(); }
  if (look.pattern === 'space') { c.fillStyle = '#ff6b35'; c.fillRect(-19, -50, 38, 5); c.strokeStyle = INK; c.lineWidth = 1.5; c.strokeRect(-19, -50, 38, 5); rr(c, -14, -66, 10, 8, 2); inkFill(c, '#118ab2', 1.5); c.fillStyle = RED; c.beginPath(); c.arc(9, -62, 3, 0, TAU); c.fill(); }
  if (look.pattern === 'suit') { c.beginPath(); c.moveTo(-8, -72); c.lineTo(0, -52); c.lineTo(8, -72); c.closePath(); inkFill(c, '#fff', 1.8); c.beginPath(); c.moveTo(0, -70); c.lineTo(-2.5, -62); c.lineTo(0, -52); c.lineTo(2.5, -62); c.closePath(); inkFill(c, RED, 1.2); c.fillStyle = '#fff'; c.fillRect(10, -64, 5, 3); }
  if (look.pattern === 'goldvest') { c.beginPath(); c.moveTo(-18, -38); c.lineTo(-13, -70); c.lineTo(-3, -50); c.lineTo(-3, -38); c.closePath(); inkFill(c, '#e9b824', 2); c.beginPath(); c.moveTo(18, -38); c.lineTo(13, -70); c.lineTo(3, -50); c.lineTo(3, -38); c.closePath(); inkFill(c, '#e9b824', 2); }
  if (look.apron) { c.beginPath(); c.moveTo(-12, -60); c.lineTo(12, -60); c.lineTo(15, -32); c.lineTo(-15, -32); c.closePath(); inkFill(c, look.apron, 2);
    c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-11, -60); c.lineTo(-8, -71); c.moveTo(11, -60); c.lineTo(8, -71); c.stroke();
    if (look.pattern === 'oil') { c.fillStyle = '#ffb703'; c.beginPath(); c.arc(-5, -48, 2, 0, TAU); c.arc(5, -43, 1.6, 0, TAU); c.fill(); }
    if (look.tag) { c.fillStyle = '#fff'; c.font = '900 10px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(look.tag, 0, -48); } }
  if (look.tie) { c.beginPath(); c.moveTo(0, -70); c.lineTo(-3, -60); c.lineTo(0, -46); c.lineTo(3, -60); c.closePath(); inkFill(c, RED, 1.5); }
  if (look.rocketLogo) { c.save(); c.translate(-10, -60); c.rotate(-0.5); c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(3.5, -1, 2.4, 4); c.lineTo(-2.4, 4); c.quadraticCurveTo(-3.5, -1, 0, -6); inkFill(c, '#fff', 1.2); c.fillStyle = '#ff6b35'; c.beginPath(); c.moveTo(-2, 4.5); c.lineTo(0, 8.5); c.lineTo(2, 4.5); c.fill(); c.restore(); }
  if (look.pearls) { c.fillStyle = '#fff'; for (let k = -3; k <= 3; k++) { c.beginPath(); c.arc(k * 3.2, -69 + Math.abs(k) * -0.6 + 3, 1.9, 0, TAU); c.fill(); c.lineWidth = 0.8; c.stroke(); } }
  // 手臂（两段 + 弯肘 + 袖口）
  const p = o.pose, w8 = Math.sin(t * 8), w10 = Math.sin(t * 10);
  let L1 = 0.16, L2 = -0.3, R1 = 0.16, R2 = -0.3;
  if (p === 'work') { L1 = 0.32; L2 = -1.55 - w10 * 0.28; R1 = 0.32; R2 = -1.55 + w10 * 0.28; }
  else if (p === 'wave') { R1 = 1.8; R2 = 0.85 + w8 * 0.35; }
  else if (p === 'point') { R1 = 1.3; R2 = 0.18; }
  personArm(c, -1, L1, L2, look); personArm(c, 1, R1, R2, look);
  // 头
  drawHead(c, look, o);
  c.restore();
}
function drawHead(c, look, o = {}) {
  const hy = -92, R = 19;
  c.lineJoin = 'round';
  // 后发
  c.fillStyle = look.hair; c.strokeStyle = INK; c.lineWidth = 3;
  if (look.style === 'bangs') { c.beginPath(); c.moveTo(-21, hy - 4); c.quadraticCurveTo(-25, hy + 22, -16, hy + 26); c.lineTo(16, hy + 26); c.quadraticCurveTo(25, hy + 22, 21, hy - 4); c.closePath(); c.fill(); c.stroke(); }
  if (look.style === 'pony') { // 高马尾：从头顶右后方甩下来
    c.beginPath(); c.moveTo(6, hy - 20); c.quadraticCurveTo(34, hy - 26, 31, hy + 4); c.quadraticCurveTo(29, hy + 22, 20, hy + 30); c.quadraticCurveTo(24, hy + 12, 18, hy - 2); c.quadraticCurveTo(14, hy - 10, 4, hy - 12); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-20, hy - 2); c.quadraticCurveTo(-23, hy + 12, -17, hy + 18); c.lineTo(-12, hy + 4); c.closePath(); c.fill(); c.stroke(); }
  if (look.style === 'wavy') { // 及颌卷发：波浪发尾
    c.beginPath(); c.moveTo(-22, hy - 6); c.quadraticCurveTo(-27, hy + 8, -22, hy + 16); c.quadraticCurveTo(-26, hy + 22, -18, hy + 24); c.quadraticCurveTo(-14, hy + 20, -12, hy + 14); c.lineTo(12, hy + 14); c.quadraticCurveTo(14, hy + 20, 18, hy + 24); c.quadraticCurveTo(26, hy + 22, 22, hy + 16); c.quadraticCurveTo(27, hy + 8, 22, hy - 6); c.closePath(); c.fill(); c.stroke(); }
  if (look.style === 'bun') { c.beginPath(); c.arc(0, hy - 22, 9, 0, TAU); c.fill(); c.stroke(); }
  if (look.style === 'twin') { c.beginPath(); c.arc(-19, hy - 12, 8, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(19, hy - 12, 8, 0, TAU); c.fill(); c.stroke(); }
  // 脸（下缘一层色块阴影）
  c.beginPath(); c.arc(0, hy, R, 0, TAU); c.fillStyle = look.skin; c.fill(); c.stroke();
  // 前发
  c.fillStyle = look.hair; c.beginPath();
  if (look.style === 'bangs' || look.style === 'pony') { c.moveTo(-20, hy - 2); c.quadraticCurveTo(-20, hy - 22, 0, hy - 22); c.quadraticCurveTo(20, hy - 22, 20, hy - 2); for (let k = 0; k < 6; k++) c.lineTo(20 - k * 8 - 4, hy - 8 + (k % 2) * 5); c.closePath(); }
  else if (look.style === 'wavy') { c.moveTo(-21, hy + 2); c.quadraticCurveTo(-21, hy - 23, 2, hy - 22); c.quadraticCurveTo(21, hy - 21, 21, hy + 2); c.quadraticCurveTo(14, hy - 12, 4, hy - 10); c.quadraticCurveTo(-4, hy - 4, -10, hy - 9); c.quadraticCurveTo(-16, hy - 4, -21, hy + 2); }
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
  if (look.pin && !look.hat) { c.fillStyle = '#fff'; c.lineWidth = 1.4; for (const [px, py] of [[-13, hy - 13], [-9.5, hy - 15.5], [-6, hy - 17]]) { c.beginPath(); c.arc(px, py, 2.4, 0, TAU); c.fill(); c.stroke(); } c.lineWidth = 2.5; }
  if (look.headband) { c.fillStyle = look.headband; rr(c, -20, hy - 13, 40, 6, 2); c.fill(); c.stroke(); }
  if (look.headset) { c.beginPath(); c.arc(0, hy - 2, 21, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.fillStyle = '#333'; rr(c, -24, hy - 4, 6, 12, 2); c.fill(); c.beginPath(); c.moveTo(-21, hy + 8); c.quadraticCurveTo(-16, hy + 16, -6, hy + 14); c.stroke(); }
  if (look.hood) { c.fillStyle = shadeHex(look.top, -0.15); c.beginPath(); c.moveTo(-17, hy + 22); c.quadraticCurveTo(0, hy + 30, 17, hy + 22); c.lineTo(13, hy + 19); c.quadraticCurveTo(0, hy + 25, -13, hy + 19); c.closePath(); c.fill(); c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(-5, hy + 25); c.lineTo(-5, hy + 34); c.moveTo(5, hy + 25); c.lineTo(5, hy + 34); c.stroke(); }
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
// 熊大画的 CEO 头像（图没加载出来就退回画布小人头像）；12b2 起 77 的 ceo_c77 / face_c77 是漫画新版，换了图所以 ART_V 跟着换
const ART_V = '12b2', PORTRAIT = { c77:1, pearl:1, otaku:1, rocket:1 };
const faceURL = id => PORTRAIT[id] ? `art/face_${id}.webp?v=${ART_V}` : avatarURL(id);
const bustURL = id => PORTRAIT[id] ? `art/ceo_${id}.webp?v=${ART_V}` : avatarURL(id);
const faceImg = id => `<img src="${faceURL(id)}"${PORTRAIT[id] ? ` class="art" data-fb="${id}"` : ''} alt="">`;
const bustImg = id => `<img src="${bustURL(id)}"${PORTRAIT[id] ? ` class="art" data-fb="${id}"` : ''} alt="">`;
// CEO×店铺 任职形象（16 张）：本行用 ceo_<id>.webp，其余放 art/job_<id>_<店id>.webp，交过来一张在 JOB_ART 里登记一张
const JOB_ART = { c77_tea:1, c77_book:1, c77_tech:1, pearl_bbq:1, pearl_book:1, pearl_tech:1,
  otaku_bbq:1, otaku_tea:1, otaku_tech:1, rocket_bbq:1, rocket_tea:1, rocket_book:1 }; // 熊大 12 张补图已全部到齐
// 4 张特殊跨行漫画整图（熊大交付原图 → 480² WebP）；图加载失败自动退回两格头像+文字
const CROSS_ART = { 'rocket@0':'cross_rocket_bbq', 'c77@3':'cross_c77_tech', 'pearl@2':'cross_pearl_book', 'otaku@1':'cross_otaku_tea' };
const crossURL = k => `art/${CROSS_ART[k]}.webp?v=${ART_V}`;
const homeShop = id => E.CEO_BY_ID[id].home;
const hasJobArt = (id, i) => i === homeShop(id) ? !!PORTRAIT[id] : !!JOB_ART[id + '_' + E.SHOPS[i].id];
const jobURL = (id, i) => i !== homeShop(id) && JOB_ART[id + '_' + E.SHOPS[i].id] ? `art/job_${id}_${E.SHOPS[i].id}.webp?v=${ART_V}` : bustURL(id);
const jobImg = (id, i) => `<img src="${jobURL(id, i)}"${PORTRAIT[id] ? ` class="art" data-fb="${id}"` : ''} alt="">`;
const jobView = {}; // 每位 CEO 在 CEO 页正在看哪家店的形象（不存档，默认当前任职）
function jobShown(id) {
  const j = jobView[id], s = state.ceos[id];
  if (j && j.at === s.at && state.shops[j.i] && state.shops[j.i].open) return j.i; // 调任后自动回到新任职

  return s.at >= 0 ? s.at : homeShop(id);
}
function showJobArt(id, i) {
  const c = E.CEO_BY_ID[id], ready = hasJobArt(id, i);
  openModal(`<div class="mtitle">${c.name} × ${E.SHOPS[i].short}</div><div class="job-big">${jobImg(id, i)}</div>
    ${ready ? '' : '<div class="mnote">这家店的形象画师还在赶稿，先放本行形象。</div>'}<button class="buy big" id="mOk">好</button>`, false);
  $('#mOk').addEventListener('click', closeModal, { once:true });
}
document.addEventListener('error', e => {
  const el = e.target; if (!el || el.tagName !== 'IMG' || !el.dataset || !el.dataset.fb || el.dataset.fbd) return;
  el.dataset.fbd = '1'; el.src = avatarURL(el.dataset.fb);
}, true);
function wearPreviewURL(id) {
  const eq = wearOf(id); const k = 'wear|' + id + '|' + (eq.clothes||'') + '|' + (eq.hat||'');
  if (avaCache[k]) return avaCache[k];
  const o = document.createElement('canvas'); o.width = 140; o.height = 160; const c = o.getContext('2d');
  c.translate(70, 150); drawPerson(c, 0, 0, 1.15, lookOf(id), { t:0, pose:'wave' });
  return (avaCache[k] = o.toDataURL());
}

/* ---------- 每帧：招牌 / 人物 / 特效 / 大客户 ---------- */
const fx = [], coinsP = [];
let signAnim = { shop:-1, from:null, to:null, t0:0 }, lastSign = {}, focusT = 0, shake = 0;
let bubble = { who:null, txt:'', until:0 }, nextBubbleAt = 0, mileFx = null;
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
  if (i === 3 && E.hasSuper(state, 3) && E.rushActive(state, 'tech', ms)) { txt = '人造太阳 · 超频 ×' + CFG.SUN_MULT + ' · 暴击倍率翻倍'; end = state.rush.tech; }
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
function drawLock(c, x, y, r) { // 和 SVG ic-lock 同形：黄锁身 + 墨线锁梁
  c.save(); c.translate(x, y); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.arc(0, -r * 0.35, r * 0.5, Math.PI, 0); c.lineTo(r * 0.5, 0); c.moveTo(-r * 0.5, 0); c.lineTo(-r * 0.5, -r * 0.35); c.lineWidth = r * 0.26; c.strokeStyle = INK; c.stroke();
  rr(c, -r * 0.85, -r * 0.05, r * 1.7, r * 1.2, r * 0.18); inkFill(c, YELLOW, r * 0.2);
  c.beginPath(); c.moveTo(0, r * 0.3); c.lineTo(0, r * 0.75); c.lineWidth = r * 0.2; c.stroke(); c.restore();
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
    drawLock(g, W / 2, H * 0.4, 12 * U); // 12c1：画布里的锁也换成同套墨线锁（原系统 emoji）
  }
  // 普通客人（只在当前店、经营页）
  if (open && tab === 'shop') {
    for (const gu of guests) {
      if (gu.shop !== i) continue;
      const gp = guestPos(gu, t);
      drawPerson(g, gp.x, gp.y, U * 0.85, gu.look, { t, bob:true, pose:gp.pose, flip:gu.flip });
      // 小道具提示阶段
      const ph = gu.phases[gu.phase];
      const ico = i === 0 ? (ph === 'grill' ? '🍢' : ph === 'serve' ? '💰' : '🪑')
        : i === 1 ? (ph === 'shake' ? '🧋' : ph === 'take' ? '🛍️' : '🧍')
        : i === 2 ? (ph === 'carry' ? '📚' : ph === 'pay' ? '💰' : '👀')
        : (ph === 'meet' ? '💼' : ph === 'sign' ? '✍️' : '💻');
      drawStrokeText(g, ico, gp.x + 18 * U, gp.y - 78 * U, 11 * U, '#fff');
    }
  }
  // 大客户团单（可见进度条）
  if (order && open && order.shop === i) {
    const x = W * 0.58, y = l.ground + 4 * U;
    order.x = x; order.y = y - 52 * U; order.r = 52 * U;
    g.save(); g.globalAlpha = 0.4 + 0.25 * Math.sin(t * 7); g.fillStyle = YELLOW; g.beginPath(); g.arc(x, y - 52 * U, 54 * U, 0, TAU); g.fill(); g.restore();
    // 团客：稍大 + 多一人影暗示「团」
    drawPerson(g, x - 16 * U, y, U * 0.95, { skin:'#ffd9b8', hair:'#111', style:'short', top:'#6a4c93', glasses:true }, { t, bob:true, pose:'wave' });
    drawPerson(g, x + 14 * U, y, U * 1.05, { skin:'#ffe0c7', hair:'#222', style:'swept', top:'#264653', tie:true, smug:true }, { t, bob:true, pose:'point' });
    drawBubble(g, x, y - 132 * U, order.meta.name + '（点我加速）', 1);
    // 进度条
    const bw = W * 0.42, bh = 12 * U, bx = x - bw / 2, by = y - 18 * U;
    rr(g, bx, by, bw, bh, 4 * U); inkFill(g, '#fff', 2 * U);
    g.fillStyle = RED; rr(g, bx + 2, by + 2, Math.max(0, (bw - 4) * order.progress), bh - 4, 3 * U); g.fill();
    drawStrokeText(g, Math.round(order.progress * 100) + '% · 预计 +' + fmt(order.payout), x, by - 10 * U, 10 * U, YELLOW);
    drawStrokeText(g, order.meta.emoji || '💰', x + 36 * U, y - 78 * U + Math.sin(t * 5) * 3 * U, 16 * U, '#fff');
  }
  // 特殊客户
  if (special && open && special.shop === i) {
    const x = W * 0.22, y = l.ground + 4 * U;
    special.x = x; special.y = y - 50 * U; special.r = 48 * U;
    g.save(); g.globalAlpha = 0.35 + 0.3 * Math.sin(t * 6); g.fillStyle = '#ff4f9a'; g.beginPath(); g.arc(x, y - 50 * U, 46 * U, 0, TAU); g.fill(); g.restore();
    drawPerson(g, x, y, U * 1.08, { skin:'#ffe6d0', hair:'#5a189a', style:'bun', top:'#ff4f9a', female:true, pearls:true }, { t, bob:true, pose:'wave', happy:true });
    drawBubble(g, x, y - 128 * U, '特殊客人！点我', 1);
    drawStrokeText(g, special.meta.emoji || '✨', x + 24 * U, y - 72 * U, 16 * U, '#fff');
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
  drawCritFx(g, t); drawComboHud(g, t); drawTapHint(g, t);
  // 飘字 / 金币
  for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k], a = (t - f.t0) / f.life; if (a >= 1) { fx.splice(k, 1); continue; }
    drawStrokeText(g, f.txt, f.x, f.y - a * 36 * U, f.size * (a < 0.15 ? 0.6 + a * 2.7 : 1), f.color, f.rot, 1 - a * a); }
  for (let k = coinsP.length - 1; k >= 0; k--) {
    const p = coinsP[k];
    if (p.fly) {
      const age = clock - (p.born || clock) - (p.delay || 0);
      if (age < 0) continue;
      const u = Math.min(1, age / 0.55);
      const ee = 1 - Math.pow(1 - u, 3);
      p.x = p.x + (p.tx - p.x) * 0.18; // eased chase
      p.y = p.y + (p.ty - p.y) * 0.18;
      // re-init toward target each frame from stored start — simpler lerp from current
      const x = (1 - ee) * (p.x) + ee * p.tx;
      const y = (1 - ee) * (p.y) + ee * p.ty;
      p.life -= 1 / 60;
      if (u >= 1 || p.life <= 0) { coinsP.splice(k, 1); continue; }
      g.save(); g.translate(x, y); g.scale(Math.abs(Math.cos(age * 14)) + 0.25, 1); g.beginPath(); g.arc(0, 0, 5.5 * U, 0, TAU); inkFill(g, YELLOW, 1.5 * U); g.restore();
      continue;
    }
    p.vy += 600 * U * (1 / 60); p.x += p.vx / 60; p.y += p.vy / 60; p.life -= 1 / 60;
    if (p.life <= 0) { coinsP.splice(k, 1); continue; }
    g.save(); g.translate(p.x, p.y); g.scale(Math.abs(Math.cos(p.life * 10)) + 0.2, 1); g.beginPath(); g.arc(0, 0, 5 * U, 0, TAU); inkFill(g, YELLOW, 1.5 * U); g.restore();
  }
}
function addText(txt, x, y, o = {}) { fx.push({ txt, x, y, t0:clock, life:o.life || 0.9, size:o.size || 15 * U, color:o.color || YELLOW, rot:o.rot || (Math.random() - 0.5) * 0.3 }); if (fx.length > 30) fx.shift(); }
function burstCoins(x, y, n) { for (let k = 0; k < n; k++) coinsP.push({ x, y, vx:(Math.random() - 0.5) * 260 * U, vy:-(140 + Math.random() * 200) * U, life:0.8 + Math.random() * 0.4 }); if (coinsP.length > 60) coinsP.splice(0, coinsP.length - 60); }

/* ================= 游戏逻辑 ================= */
let clock = 0; // 秒（performance）
const coinsEl = $('#coins'), cpsEl = $('#cps'), tabBody = $('#tabBody'), toastEl = $('#toast'), sfxWord = $('#sfxWord');
let tab = 'shop', buyAmt = 1, dirty = true;
// 12d：所有入账走 E.addCoins（坏值拒绝、到上限停住、旧档超上限不再增长）；返回实际到账
let capWarned = false;
function earn(v) { const r = E.addCoins(state, v); if (r.capped) capNote(); return r.ok ? r.added : 0; }
function capNote() { if (capWarned) return; capWarned = true; toast('金币到上限 ' + fmt(CFG.COIN_CAP) + '：先花掉一些，收益才会继续进账', 3200); }
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
  const gained = earn(E.onlineRate(state, t) * gap);
  noteVisualIncome(gained);
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

/* ---------- 点店铺：三档互斥暴击 + 连击（两击间隔 ≤ 1 秒续连；特效只是画，不拦点击） ---------- */
const TAP_WORDS = ['滋啦！', '香！', '叮！', '嘿！', '巴适！'];
const combo = { n:0, last:-1e9, shop:-1 };   // 不存档：刷新 / 切店 / 超过 1 秒就从 1 重新算
const tapSec = () => performance.now() / 1000;
function comboLive(ts) { return combo.n > 0 && combo.shop === state.cur && ts - combo.last <= CFG.COMBO_GAP + 1e-9; }
function comboNow() { return comboLive(tapSec()) ? combo.n : 0; }     // 下一击之前已连了几下
let critFx = null;                                                       // 同一时间只留一个暴击特效：新的替换旧的，不堆粒子
const TIER_COLOR = [YELLOW, '#ffb703', '#ff4f9a', '#9d4edd'];
function tapShop(x, y) {
  const i = state.cur, s = state.shops[i];
  if (!s.open) { toast(i > 0 && !state.shops[i - 1].open ? '先把上一家店开起来' : '在下面点「开张」'); return; }
  const ts = tapSec(), prev = comboLive(ts) ? combo.n : 0;
  combo.n = prev + 1; combo.last = ts; combo.shop = i;
  const r = E.tapReward(state, i, now(), rand(), prev);
  earn(r.value); state.taps++; if (r.crit) state.crits++;
  const col = TIER_COLOR[r.tier];
  addText('+' + fmt(r.value) + (r.tier ? ' ×' + r.mult : ''), x, y, r.tier ? { size:(18 + r.tier * 4) * U, color:col, life:0.8 + r.tier * 0.15 } : {});
  burstCoins(x, y, r.tier ? 4 + r.tier * 4 : 3);
  if (r.tier) {
    critFx = { shop:i, tier:r.tier, x, y, t0:clock, seed:Math.random() * 1000 };
    focusT = r.tier >= 2 ? 0.18 + r.tier * 0.06 : 0; shake = [0, 0.18, 0.32, 0.5][r.tier];
    popWord(CFG.CRIT_TIERS[r.tier - 1].word); sfx('crit' + r.tier);
    try { if (navigator.vibrate) navigator.vibrate([0, 12, 22, 40][r.tier]); } catch (e) {}
  } else { sfx('tap'); if (Math.random() < 0.25) popWord(TAP_WORDS[Math.floor(Math.random() * TAP_WORDS.length)]); }
  // 每满 50 连击：三档各 +5 个百分点
  if (combo.n % CFG.COMBO_STEP === 0) { const pc = Math.round(E.critChance(state, i, now(), combo.n) * 100);
    addText('连击 ' + combo.n + '！暴击率 ' + pc + '%', W / 2, H * 0.42, { size:16 * U, color:'#06d6a0', life:1.3, rot:-0.05 }); sfx('mile'); }
  bumpCoins(); refreshCrit();   // 下方暴击说明跟着每一下同步，不等 900ms
  if (Math.random() < 0.12) { const cid = E.ceoAt(state, i); if (cid) sayLine('c', E.SIGNS[cid][i][1]); }
}
// 四家店各一套暴击特效：烧烤火星炭火 / 奶茶珍珠弹射 + 涟漪 / 书店速度线 + 翻页 / 科技电弧 + 能量环；档越高越大越久
function drawCritFx(c, t) {
  const f = critFx; if (!f || f.shop !== state.cur) return;
  const dur = 0.35 + f.tier * 0.15, k = (t - f.t0) / dur; if (k >= 1 || k < 0) { if (k >= 1) critFx = null; return; }
  const R = (26 + f.tier * 22) * U, e = 1 - Math.pow(1 - k, 3), a = 1 - k, n = 6 + f.tier * 4, col = TIER_COLOR[f.tier];
  const rnd = j => { const v = Math.sin(f.seed + j * 12.9898) * 43758.5453; return v - Math.floor(v); };
  c.save(); c.translate(f.x, f.y); c.lineCap = 'round';
  // 共用：冲击圈（一圈，越高档越粗）
  c.globalAlpha = a * 0.9; c.strokeStyle = col; c.lineWidth = (2 + f.tier * 1.5) * U * a; c.beginPath(); c.arc(0, 0, R * e, 0, TAU); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 1.2 * U; c.globalAlpha = a * 0.6; c.beginPath(); c.arc(0, 0, R * e + 2 * U, 0, TAU); c.stroke();
  c.globalAlpha = a;
  if (f.shop === 0) {        // 烧烤：火星飞溅 + 炭火块
    for (let j = 0; j < n; j++) { const ang = rnd(j) * TAU, d0 = R * 0.3 * e, d1 = R * (0.7 + rnd(j + 50) * 0.6) * e;
      c.strokeStyle = j % 2 ? '#ff7b00' : '#ffd23f'; c.lineWidth = (1.5 + f.tier * 0.6) * U;
      c.beginPath(); c.moveTo(Math.cos(ang) * d0, Math.sin(ang) * d0); c.lineTo(Math.cos(ang) * d1, Math.sin(ang) * d1); c.stroke(); }
    for (let j = 0; j < 2 + f.tier; j++) { const ang = rnd(j + 99) * TAU, d = R * 0.8 * e; c.fillStyle = '#3a1f12';
      c.beginPath(); c.arc(Math.cos(ang) * d, Math.sin(ang) * d + k * 18 * U, (2.5 + f.tier) * U, 0, TAU); c.fill(); c.fillStyle = '#ff5400'; c.beginPath(); c.arc(Math.cos(ang) * d, Math.sin(ang) * d + k * 18 * U, 1.4 * U, 0, TAU); c.fill(); }
  } else if (f.shop === 1) { // 奶茶：珍珠弹射 + 奶茶涟漪
    for (let r2 = 1; r2 <= Math.min(3, f.tier); r2++) { c.strokeStyle = '#d4a373'; c.lineWidth = 2 * U; c.globalAlpha = a * 0.7; c.beginPath(); c.ellipse(0, 0, R * e * (0.4 + r2 * 0.3), R * e * (0.2 + r2 * 0.15), 0, 0, TAU); c.stroke(); }
    c.globalAlpha = a;
    for (let j = 0; j < n; j++) { const ang = rnd(j) * TAU, d = R * (0.5 + rnd(j + 7) * 0.7) * e, hop = Math.abs(Math.sin(k * Math.PI * 2 + j)) * 8 * U;
      c.fillStyle = '#3d2314'; c.strokeStyle = INK; c.lineWidth = 1 * U; c.beginPath(); c.arc(Math.cos(ang) * d, Math.sin(ang) * d - hop, (3 + f.tier) * U, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(Math.cos(ang) * d - 1 * U, Math.sin(ang) * d - hop - 1 * U, 1 * U, 0, TAU); c.fill(); }
  } else if (f.shop === 2) { // 书店：漫画速度线 + 翻页
    c.strokeStyle = INK; c.lineWidth = 1.3 * U;
    for (let j = 0; j < n + 4; j++) { const ang = j / (n + 4) * TAU + rnd(j) * 0.2, d0 = R * (0.55 + 0.15 * rnd(j + 3)), d1 = d0 + R * (0.5 + f.tier * 0.15) * (1 - k * 0.5);
      c.beginPath(); c.moveTo(Math.cos(ang) * d0, Math.sin(ang) * d0); c.lineTo(Math.cos(ang) * d1, Math.sin(ang) * d1); c.stroke(); }
    for (let j = 0; j < f.tier + 1; j++) { const ang = -Math.PI / 2 + (j - f.tier / 2) * 0.7, d = R * 0.9 * e;
      c.save(); c.translate(Math.cos(ang) * d, Math.sin(ang) * d); c.rotate(k * 3 + j); c.scale(Math.cos(k * 9 + j), 1); c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 1.2 * U;
      c.fillRect(-6 * U, -8 * U, 12 * U, 16 * U); c.strokeRect(-6 * U, -8 * U, 12 * U, 16 * U); c.restore(); }
  } else {                   // 科技：电弧 + 能量环
    c.strokeStyle = '#4cc9f0'; c.lineWidth = (1.6 + f.tier * 0.5) * U;
    for (let j = 0; j < 3 + f.tier; j++) { const ang = rnd(j) * TAU; c.beginPath(); c.moveTo(0, 0);
      for (let q = 1; q <= 5; q++) { const d = R * 1.1 * e * q / 5, off = (rnd(j * 9 + q + Math.floor(t * 30)) - 0.5) * 12 * U; c.lineTo(Math.cos(ang) * d - Math.sin(ang) * off, Math.sin(ang) * d + Math.cos(ang) * off); }
      c.stroke(); }
    c.strokeStyle = '#b5179e'; c.lineWidth = 2 * U; c.setLineDash([6 * U, 5 * U]); c.lineDashOffset = -t * 60;
    for (let r2 = 0; r2 < Math.min(2, f.tier); r2++) { c.beginPath(); c.arc(0, 0, R * (0.55 + r2 * 0.3) * (0.6 + e * 0.4), 0, TAU); c.stroke(); }
    c.setLineDash([]);
  }
  c.restore();
  // 档名大字（停在点击点上方，0.5 秒内淡出）
  const name = CFG.CRIT_TIERS[f.tier - 1].name + '！';
  drawStrokeText(c, name, Math.max(W * 0.18, Math.min(W * 0.82, f.x)), Math.max(18 * U, f.y - R - 10 * U), (13 + f.tier * 3) * U * (k < 0.12 ? 0.7 + k * 2.5 : 1), col, -0.06, a);
}
// 连击 HUD：连击数 + 下一档进度 + 当前总暴击率（左下角小卡；不连击时只留一行小字）
function drawComboHud(c, t) {
  if (!state.shops[state.cur].open || tab !== 'shop') return;
  const ts = tapSec(), live = comboLive(ts), n = live ? combo.n : 0, i = state.cur;
  const pct = Math.round(E.critChance(state, i, now(), n) * 100), pg = E.comboProgress(state, i, now(), n);
  const x = 6 * U, y = H * 0.33, w = 96 * U, h = live ? 40 * U : 17 * U;
  c.save(); c.globalAlpha = live ? 1 : 0.75; rr(c, x, y, w, h, 5 * U); inkFill(c, 'rgba(255,255,255,.92)', 1.6 * U);
  c.fillStyle = INK; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `900 ${10 * U}px sans-serif`;
  c.fillText('暴击率 ', x + 6 * U, y + 9 * U); const tw = c.measureText('暴击率 ').width; c.fillStyle = RED; c.fillText(pct + '%', x + 6 * U + tw, y + 9 * U);
  if (live) {
    c.fillStyle = INK; c.textAlign = 'right'; c.fillText('连击 ' + n, x + w - 6 * U, y + 9 * U);
    const bx = x + 6 * U, by = y + 19 * U, bw = w - 12 * U, bh = 7 * U; rr(c, bx, by, bw, bh, 3 * U); inkFill(c, '#fff', 1.2 * U);
    c.fillStyle = pg.maxed ? RED : '#06d6a0'; rr(c, bx + 1, by + 1, Math.max(0, (bw - 2) * pg.into / pg.need), bh - 2, 2 * U); c.fill();
    c.fillStyle = INK; c.textAlign = 'left'; c.font = `700 ${8 * U}px sans-serif`;
    c.fillText(pg.maxed ? '满档：必暴击' : `下一档 ${pg.into}/${pg.need}（+5%）`, bx, by + bh + 6 * U);
    // 1 秒续连窗口：顶边一条倒计时细线
    const left = Math.max(0, 1 - (ts - combo.last) / CFG.COMBO_GAP); c.fillStyle = RED; c.fillRect(x + 4 * U, y + 1.5 * U, (w - 8 * U) * left, 1.6 * U);
  }
  c.restore();
}
// 首次营业：手势提示（点满 12 下自动消失）
function drawTapHint(c, t) {
  if (state.taps >= 12 || tab !== 'shop' || !state.shops[state.cur].open || modalOpen()) return;
  const x = W * 0.42, y = H * 0.56, p = (t * 1.6) % 1, a = 0.85;
  c.save(); c.globalAlpha = a * (1 - p); c.strokeStyle = '#fff'; c.lineWidth = 3 * U; c.beginPath(); c.arc(x, y, (10 + p * 26) * U, 0, TAU); c.stroke(); c.restore();
  drawStrokeText(c, '👆', x + 8 * U, y + 16 * U - Math.abs(Math.sin(t * 5)) * 6 * U, 24 * U, '#fff', 0, a);
  drawStrokeText(c, '点店铺赚钱，连续点击提高暴击率', W / 2, H * 0.78, 12 * U, YELLOW, -0.02, a);
}
/* ---------- 营业小舞台：普通客人（只可视化自动收入）+ 大客户团单 + 特殊客户 ---------- */
const GUEST_LOOKS = [
  { skin:'#ffe0c7', hair:'#222', style:'short', top:'#ef476f' },
  { skin:'#ffd9b8', hair:'#6b3e26', style:'bun', top:'#3a86ff', female:true },
  { skin:'#ffe6d0', hair:'#111', style:'messy', top:'#06d6a0', glasses:true },
  { skin:'#f6d1b0', hair:'#333', style:'swept', top:'#ffd166' },
  { skin:'#ffe0c7', hair:'#1b1b1b', style:'twin', top:'#9b5de5', female:true },
  { skin:'#ffd9b8', hair:'#444', style:'cover', top:'#e63946', hoodie:true },
];
const STAGE_PHASES = [
  ['seat', 'grill', 'serve'],   // 烧烤：落座→翻串→结账
  ['queue', 'shake', 'take'],   // 奶茶：排队→摇杯→拿走
  ['browse', 'carry', 'pay'],   // 书店：翻书→抱书→结账
  ['type', 'meet', 'sign'],     // 科技：敲键盘→谈项目→签约
];
let guests = [];           // 普通客人（动画，不另加钱）
let order = null;          // 大客户团单 {shop,t0,progress,rate,payout,meta,x,y,r}
let special = null;        // 特殊客户 {shop,t0,meta,x,y,r}
let nextBigAt = 0, nextSpecialAt = 0;
let visCoinAcc = 0;        // 已可视化的自动收入累计（用于冒金币，不加钱）

function scheduleBig() { nextBigAt = clock + E.bigInterval(state, rand()); }
function scheduleSpecial() { nextSpecialAt = clock + E.specialInterval(state, rand()); }

function spawnGuest(i) {
  if (guests.filter(g => g.shop === i).length >= 5) return;
  const phases = STAGE_PHASES[i];
  guests.push({
    shop:i, phase:0, phases, t0:clock, dur:1.6 + Math.random() * 1.2,
    look:GUEST_LOOKS[Math.floor(Math.random() * GUEST_LOOKS.length)],
    lane:Math.random(), flip:Math.random() < 0.5, paid:false,
  });
  if (guests.length > 18) guests.splice(0, guests.length - 18);
}

function guestPos(g, t) {
  const l = L(), i = g.shop, p = Math.min(1, (t - g.t0) / g.dur), ph = g.phases[g.phase];
  const ground = l.ground + 2 * U;
  // 各店独特路径
  if (i === 0) { // 落座左→烤炉中→柜台结账
    const seats = [0.18, 0.28, 0.38];
    if (ph === 'seat') return { x:W * (0.05 + p * (seats[g.lane * 3 | 0] || 0.22)), y:ground, pose:'wave' };
    if (ph === 'grill') return { x:W * 0.42 + Math.sin(t * 6) * 2 * U, y:ground - 2 * U, pose:'work' };
    return { x:W * (0.42 + p * 0.2), y:ground, pose:'point' };
  }
  if (i === 1) {
    if (ph === 'queue') return { x:W * (0.12 + g.lane * 0.08), y:ground - p * 4 * U, pose:'wave' };
    if (ph === 'shake') return { x:W * 0.36, y:ground, pose:'work' };
    return { x:W * (0.36 + p * 0.35), y:ground, pose:'point' };
  }
  if (i === 2) {
    if (ph === 'browse') return { x:W * (0.14 + g.lane * 0.12), y:ground - 4 * U, pose:'wave' };
    if (ph === 'carry') return { x:W * (0.22 + p * 0.2), y:ground, pose:'work' };
    return { x:W * 0.48, y:ground, pose:'point' };
  }
  // tech
  if (ph === 'type') return { x:W * (0.16 + g.lane * 0.1), y:ground - 6 * U, pose:'work' };
  if (ph === 'meet') return { x:W * 0.45, y:ground, pose:'wave' };
  return { x:W * (0.45 + p * 0.2), y:ground, pose:'point' };
}

function updateGuests(dt) {
  const i = state.cur;
  if (!state.shops[i].open || state.shops[i].emp <= 0) { guests = guests.filter(g => g.shop !== i); return; }
  // 产速越高客人越密（纯表现）
  const rate = E.shopRate(state, i);
  if (rate > 0 && Math.random() < Math.min(0.55, 0.08 + rate / Math.max(20, rate + 40)) * dt * 8) spawnGuest(i);
  for (let k = guests.length - 1; k >= 0; k--) {
    const g = guests[k]; if (g.shop !== i && g.shop !== state.cur) continue;
    if (clock - g.t0 < g.dur) continue;
    if (g.phase < g.phases.length - 1) { g.phase++; g.t0 = clock; g.dur = 1.4 + Math.random() * 1.1; }
    else {
      // 结账离场：冒金币 = 可视化自动收入（不加钱）
      if (!g.paid && g.shop === state.cur && tab === 'shop') {
        g.paid = true;
        const pos = guestPos(g, clock);
        const chunk = Math.max(0.5, E.shopRate(state, g.shop) * 0.35);
        if (visCoinAcc >= chunk * 0.2) {
          const show = Math.min(visCoinAcc, chunk);
          visCoinAcc -= show;
          addText('+' + fmt(show), pos.x, pos.y - 70 * U, { size:12 * U, color:YELLOW, life:0.7 });
          burstCoins(pos.x, pos.y - 40 * U, 2);
        }
      }
      guests.splice(k, 1);
    }
  }
}

function noteVisualIncome(amt) {
  // tick 已把钱加上；这里只记「还没冒出来的可视化额度」
  if (!(amt > 0)) return;
  visCoinAcc += amt;
  if (visCoinAcc > E.onlineRate(state, now()) * 8) visCoinAcc = E.onlineRate(state, now()) * 8; // 防堆积
}

function startOrder(shop) {
  const meta = E.BIG_ORDERS[shop] || E.BIG_ORDERS[0];
  const rate = E.rushOnlineRate(state, now());
  const payout = E.orderPayout(rate);
  order = { shop, t0:clock, progress:0, rate, payout, meta, x:0, y:0, r:50 * U, sped:0 };
  sfx('big'); popWord('团单！');
  if (state.cur === shop && tab === 'shop') {
    sayLine('e', meta.line, 2.8);
    addText(meta.name, W / 2, H * 0.38, { size:18 * U, color:RED, life:1.4 });
  } else toast(E.SHOPS[shop].short + '来了「' + meta.name + '」');
}

function finishOrder() {
  if (!order) return;
  const o = order; order = null;
  const paid = E.settleOrder(state, o.payout);
  if (E.overCap(state)) capNote();
  persist();
  focusT = 0.55; shake = 0.45; sfx('mile'); popWord('结账！');
  // 金币成串飞向钱包 + 「团单收入 +X」
  const tx = W * 0.18, ty = 8 * U;
  for (let k = 0; k < 12; k++) {
    const delay = k * 0.045;
    coinsP.push({ x:o.x || W * 0.55, y:(o.y || H * 0.55) + (Math.random() - 0.5) * 10 * U,
      vx:0, vy:0, life:1.1 + delay, fly:true, tx, ty, delay, born:clock });
  }
  addText('团单收入 +' + fmt(paid), W / 2, H * 0.42, { size:20 * U, color:YELLOW, life:1.8, rot:-0.05 });
  bumpCoins(); dirty = true;
  if (state.cur !== o.shop) toast(E.SHOPS[o.shop].short + ' 团单收入 +' + fmt(paid));
}

function updateBig() {
  // 推进团单进度（不点也会自动完成）
  if (order) {
    const baseSpeed = 1 / CFG.BOOST_SEC; // 30 秒跑满
    const clickBoost = order.sped > 0 ? 2.8 : 1; // 刚点过则加速一会儿
    if (order.sped > 0) order.sped -= 1 / 60;
    order.progress = Math.min(1, order.progress + baseSpeed * clickBoost * (1 / 60));
    if (order.progress >= 1) finishOrder();
  }
  if (!order && clock >= nextBigAt && E.baseRate(state) > 0 && !document.hidden && !modalOpen()) {
    // 优先当前店，否则找有员工的店
    let shop = state.cur;
    if (!(state.shops[shop].open && state.shops[shop].emp > 0)) {
      shop = [0, 1, 2, 3].find(i => state.shops[i].open && state.shops[i].emp > 0);
    }
    if (shop != null) startOrder(shop);
    scheduleBig();
  }
  // 特殊客户
  if (special && clock - special.t0 > 14) special = null;
  if (!special && !order && clock >= nextSpecialAt && E.baseRate(state) > 0 && !document.hidden && !modalOpen()) {
    let shop = state.cur;
    if (!(state.shops[shop].open && state.shops[shop].emp > 0)) {
      shop = [0, 1, 2, 3].find(i => state.shops[i].open && state.shops[i].emp > 0);
    }
    if (shop != null) {
      const meta = E.SPECIAL_GUESTS[shop];
      special = { shop, t0:clock, meta, x:0, y:0, r:48 * U };
      sfx('big'); popWord('特殊客人！');
      if (state.cur === shop) addText(meta.name, W / 2, H * 0.36, { size:16 * U, color:'#ff4f9a', life:1.5 });
      else toast(E.SHOPS[shop].short + '来了特殊客人「' + meta.name + '」');
    }
    scheduleSpecial();
  }
}

function hitBig(x, y) {
  // 点大客户：加快服务（不立刻结算）
  if (order && order.shop === state.cur && order.r != null) {
    if (Math.hypot(x - order.x, y - order.y) <= order.r * 1.2) {
      order.progress = Math.min(1, order.progress + 0.12);
      order.sped = 0.9;
      sfx('tap'); popWord('加速！');
      addText('服务加速！', order.x, order.y - 60 * U, { size:13 * U, color:RED, life:0.7 });
      if (order.progress >= 1) finishOrder();
      return true;
    }
  }
  // 点特殊客户：播两格漫画 + 小奖励
  if (special && special.shop === state.cur && special.r != null) {
    if (Math.hypot(x - special.x, y - special.y) <= special.r * 1.2) {
      const sp = special; special = null;
      const paid = E.settleSpecial(state, sp.shop);
      persist();
      showSpecialComic(sp.meta, paid);
      return true;
    }
  }
  return false;
}

function showSpecialComic(meta, paid) {
  sfx('mile'); focusT = 0.4;
  openModal(`<div class="mbubble">特殊客人！</div><div class="mtitle">${meta.emoji} ${meta.name}</div>
    <div class="comic two">${meta.panels.map((p, n) => `<div class="panel4"><span class="pn">${n + 1}</span><div class="pchar"><div class="pimg">${faceImg(p[0])}</div><span class="pe">${p[1]}</span></div><div class="pt">${p[2]}</div></div>`).join('')}</div>
    <div class="mreward">${coinSm}+${fmt(paid)}</div>
    <div class="mnote">小奖励：本店 ${CFG.SPECIAL_REWARD_SEC} 秒产量（占位文案，熊大可再换）</div>
    <button class="buy big" id="mOk">收下</button>`);
  burstCoins(W / 2, H * 0.5, 10); bumpCoins(); dirty = true;
  $('#mOk').addEventListener('click', closeModal, { once:true });
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
// 12d：x1 / x10 / MAX 都不超过店铺等级上限（满级返回 0）；MAX 最多循环 CFG.MAX_BUY_STEPS 次
function shopUpgradeCount(i) { return E.shopBuyCount(state, i, buyAmt); }
function doUpgradeShop(i, btn) {
  const k = shopUpgradeCount(i); if (!k) return failBuy(btn, E.shopMaxed(state, i) ? '已满级' : E.walletOk(state) ? '金币不够' : '金币数据异常');   // 12d1：MAX 一级都买不起 → 0
  const cost = E.bulkUpgradeCost(i, state.shops[i].lv, k);
  if (!(E.balance(state) >= cost)) return failBuy(btn, E.walletOk(state) ? '金币不够' : '金币数据异常');
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
    case 'jobView': { const [who, k] = arg.split(':'); jobView[who] = { i:+k, at:state.ceos[who].at }; dirty = true; sfx('tap'); break; }
    case 'jobBig': { const [who, k] = arg.split(':'); return showJobArt(who, +k); }
    case 'decor': { const h = state.decorHidden || (state.decorHidden = []); const k = h.indexOf(arg); if (k >= 0) h.splice(k, 1); else h.push(arg); persist(); dirty = true; bgKey = ''; break; }
    case 'card': return showCard(arg);
    case 'reset': return confirmReset();
    case 'goShop': switchShop(+arg); setTab('shop'); break;
    default: if (a.indexOf('home') === 0 || a.indexOf('mall') === 0) return homeAct(a, arg, btn);
  }
}
function avaCacheClear() { for (const k of Object.keys(avaCache)) delete avaCache[k]; }

/* ================= 界面：标签页 ================= */
// 12c 漫画 UI：统一线稿图标（index.html 里的 <symbol>，导航 / 翻页签 / 模式签共用同一套）
const ic = n => `<svg class="ic" aria-hidden="true"><use href="#ic-${n}"/></svg>`;
const SHOP_ICON = ['bbq', 'tea', 'book', 'tech'].map(n => ic(n)), LOCK_IC = ic('lock'), TAB_NAME = ['烧烤摊', '奶茶店', '漫画店', '科技'];
const DECOR_ICON = { d_stool:'🪑', d_lights:'🌶️', d_neon:'🏮', d_board:'🪧', d_balloon:'🎈', d_poster:'📰', d_cat:'🐱', d_plant:'🪴' };
const TYPE_LABEL = { clothes:'衣服', hat:'帽子', decor:'装饰', card:'故事卡', super:'超级装饰' };
const thumbCache = {};
function itemThumb(id) {
  if (thumbCache[id]) return thumbCache[id];
  const it = E.ITEM_BY_ID[id] || {}, o = document.createElement('canvas'); o.width = o.height = 96; const c = o.getContext('2d');
  if (it.type === 'clothes' || id === 'c_gold') { c.translate(48, 108); c.scale(0.85, 0.85); drawPerson(c, 0, 0, 1, Object.assign({}, LOOKS.c77, CLOTHES[id], { bow:null, pants:null }), {}); }
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
const ava = (id, cls = '') => PORTRAIT[id] ? `<div class="ava art ${cls}">${faceImg(id)}</div>` : `<div class="ava ${cls}"><img src="${avatarURL(id, JSON.stringify(E.CEO_BY_ID[id] ? wearOf(id) : ''))}" alt=""></div>`;
const btn = (act, arg, label, cost, extra = '') => `<button class="buy ${extra}" data-act="${act}" data-arg="${arg}" ${cost != null ? `data-cost="${cost}"` : ''}>${label}${cost != null ? `<small>${fmt(cost)}</small>` : ''}</button>`;
function rateDelta(fn) { const c = E.cloneState(state); fn(c); return E.baseRate(c) - E.baseRate(state); }
function ceoTags(i) {
  const info = E.ceoInfo(state, i); if (!info.id) return '';
  return info.match ? `<span class="tag match">专长 ×${CFG.MATCH_MULT}</span>` : `<span class="tag cross">跨行 ×${CFG.CROSS_MULT}${info.cross ? ' · ' + info.cross.title : ''}</span>`;
}
// 暴击说明：「当前暴击率」= 含连击 / 超级装饰加成的总概率（和店景 HUD 同一套 E.critChance）；「基础概率」= 三档 base 合计（固定 35%）
const CRIT_BASE = Math.round(CFG.CRIT_TIERS.reduce((a, c) => a + c.p, 0) * 100);
function critLineInner(i) {
  const t = now(), n = comboNow(), ps = E.critTiers(state, i, t, n), tot = Math.round(E.critChance(state, i, t, n) * 100);
  const sum = ps.reduce((a, b) => a + b, 0), sc = sum > 1 ? 1 / sum : 1, pc = p => Math.round(p * sc * 1000) / 10;
  const noCombo = Math.round(E.critChance(state, i, t, 0) * 100), add = [];
  if (tot > noCombo) add.push(`连击 ${n} 下 +${tot - noCombo}%`);
  if (noCombo > CRIT_BASE) add.push(`超级装饰 +${noCombo - CRIT_BASE}%`);
  return `<span>当前暴击率 <b id="critPct">${tot}%</b><small id="critTiers">（${CFG.CRIT_TIERS.map((c, k) => c.name + ' ' + pc(ps[k]) + '%').join(' · ')}）</small></span>`
    + `<span>基础概率 <b id="critBase">${CRIT_BASE}%</b><small id="critBonus">${add.length ? '（' + add.join('，') + '）' : '（现在没加成）'}</small></span>`
    + `<span>暴击倍率 <b>${CFG.CRIT_TIERS.map((c, k) => '×' + E.tierMult(state, i, t, k)).join(' / ')}</b></span>`
    + `<span class="cl-tip">连点（间隔 ≤1 秒）每满 ${CFG.COMBO_STEP} 下三档各 +5%，最高 100%；停手 1 秒回基础</span>`;
}
function critLine(i) { return `<div class="critline" id="critLine">${critLineInner(i)}</div>`; }
// 轻量刷新：只换 #critLine 里面，内容没变就不动 DOM（点店铺每下都调；refreshDynamic 每 0.25 秒也调，停手断连能及时回基础）
function refreshCrit() {
  const cl = document.getElementById('critLine'); if (!cl || tab !== 'shop') return;
  const h = critLineInner(state.cur); if (cl.innerHTML !== h) cl.innerHTML = h;
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
  const shopTop = E.shopMaxed(state, i), k0 = shopUpgradeCount(i), k = shopTop ? 0 : Math.max(1, k0), upCost = E.bulkUpgradeCost(i, s.lv, k);   // 12d1：MAX 买不起时按钮显示下一级的价格并置灰（不再显示 0 元）
  const upGain = rateDelta(c => { c.shops[i].lv += k; });
  let h = `<div class="summary">「${sign.name}」每秒 <b style="color:var(--red)">+${fmt(sr)}</b>${s.emp > 0
      ? `<br>店铺 ${fmt(E.shopBase(i, s.lv))} × 员工 ×${E.empMult(s.emp).toFixed(2)} × CEO ×${info.mult.toFixed(2)}${E.hasSuper(state, i) ? ` × 超级装饰 ×${CFG.SUPER_RATE}` : ''}`
      : '<br>还没员工：不会自动赚钱（可以点画面手动赚）'}
    ${critLine(i)}</div>`;
  if (E.hasSuper(state, i)) { const sp = E.ITEM_BY_ID[E.SUPER_OF_SHOP[i]];
    h += `<div class="card super"><div class="ava sq">${SUPER_ICON[sp.id]}</div><div class="info"><div class="name">${sp.name}<span class="tag match">超级装饰</span></div><div class="desc">${sp.desc}</div></div></div>`; }
  h += `<div class="row-head"><div class="sec-title">店铺</div><div class="buyamt">${[1, 10, 'max'].map(a => `<button data-act="amt" data-arg="${a}" class="${buyAmt === a ? 'on' : ''}">${a === 'max' ? 'MAX' : 'x' + a}</button>`).join('')}</div></div>`;
  h += `<div class="card"><div class="ava sq">${SHOP_ICON[i]}</div><div class="info"><div class="name">${S.short}<span class="lv">Lv.${s.lv}</span></div>
    <div class="desc">当前基础产量 <b>${fmt(E.shopBase(i, s.lv))}</b>/秒原料${nm ? ` · 下一里程碑 Lv${nm} → 收益 ×${E.milestoneMult(nm)}` : ' · 里程碑全拿下 ×8'}</div>
    ${nm ? `<div class="mbar"><i style="width:${((s.lv - prevM) / (nm - prevM) * 100).toFixed(0)}%"></i></div>` : ''}
    <div class="gain ${s.emp > 0 || shopTop ? '' : 'warn'}">${shopTop ? `已满级（店铺最高 Lv${E.shopMaxLv(i)}）` : s.emp > 0 ? '升级后 +' + fmt(upGain) + '/秒' : '还没员工：升级后自动收入仍是 +0/秒（先雇佣）· 手点会变强'}</div>
    <details class="details-fold"><summary>倍率怎么算</summary>店铺原料 × 员工 ×${E.empMult(s.emp).toFixed(2)} × CEO ×${info.mult.toFixed(2)}${E.hasSuper(state, i) ? ' × 超级装饰 ×' + CFG.SUPER_RATE : ''} = 每秒 <b>${fmt(sr)}</b></details></div>
    ${shopTop ? '<button class="buy no" disabled data-max="shop">满级</button>' : btn('up', i, '升级' + (k > 1 ? ' ×' + k : ''), upCost)}</div>`;
  h += `<div class="sec-title">员工</div>`;
  if (s.emp <= 0) h += `<div class="card hl">${ava('e' + i)}<div class="info"><div class="name">${S.emp.name}<span class="lv" style="background:#999">未雇</span></div>
    <div class="desc one">“${S.emp.line}”</div><div class="gain">雇了才自动赚：+${fmt(rateDelta(c => { c.shops[i].emp = 1; }))}/秒</div></div>${btn('hire', i, '雇佣', S.hire)}</div>`;
  else h += `<div class="card">${ava('e' + i)}<div class="info"><div class="name">${S.emp.name}<span class="lv">Lv.${s.emp}</span></div>
    <div class="desc one">“${S.emp.line}”</div><div class="gain">${E.empMaxed(state, i) ? `已满级（员工最高 Lv${E.empMaxLv(i)}）` : `速度 +${CFG.EMP_LV_BONUS * 100}% → +${fmt(rateDelta(c => { c.shops[i].emp++; }))}/秒`}</div></div>
    ${E.empMaxed(state, i) ? '<button class="buy no" disabled data-max="emp">满级</button>' : btn('emp', i, '升级', E.empCost(i, s.emp))}</div>`;
  h += `<div class="sec-title">CEO</div>`;
  if (info.id) {
    const c = E.CEO_BY_ID[info.id], cs = state.ceos[info.id];
    h += `<div class="card ${info.match ? '' : 'hl'}">${ava(info.id)}<div class="info"><div class="name">${c.name}<span class="lv">Lv.${cs.lv}</span>${ceoTags(i)}</div>
      <div class="desc">经营加成 ×${info.mult.toFixed(2)}（${info.match ? '专长对口' : '跨行'} ×${info.typeMult} · 等级 +${Math.round((info.lvMult - 1) * 100)}%）${info.cross ? '<br><b>' + info.cross.title + '</b>：' + info.cross.desc : ''}</div>
      <div class="gain">${E.ceoMaxed(state, info.id) ? `已满级（最高 Lv${E.ceoMaxLv(info.id)}）` : '升一级 +' + fmt(rateDelta(x => { x.ceos[info.id].lv++; })) + '/秒（跟着 CEO 走）'}</div></div>
      <div class="btns">${E.ceoMaxed(state, info.id) ? '<button class="buy no" disabled data-max="ceo">满级</button>' : btn('ceoUp', info.id, '升级', E.ceoCost(info.id, cs.lv))}<button class="buy alt" data-act="assignTo" data-arg="${i}">调任</button></div></div>`;
  } else {
    h += `<div class="card hl"><div class="ava">👔</div><div class="info"><div class="name">CEO 空缺</div><div class="desc">派一位 CEO 来：专长对口 ×${CFG.MATCH_MULT}，跨行 ×${CFG.CROSS_MULT} + 专属事件</div></div>
      <button class="buy" data-act="assignTo" data-arg="${i}">派 CEO</button></div>`;
  }
  return h;
}
function ceoPost(id) { const s = state.ceos[id]; return s.at >= 0 ? E.signOf(state, s.at).name : '休息中（空着）'; }
function jobGallery(id) {
  const s = state.ceos[id], v = jobShown(id), cur = s.at === v, ready = hasJobArt(id, v);
  const chips = E.SHOPS.map((S, i) => {
    const open = !!state.shops[i].open;
    return `<button class="job-chip ${i === v ? 'on' : ''} ${open ? '' : 'lock'}" ${open ? `data-act="jobView" data-arg="${id}:${i}"` : 'disabled'}>${open ? SHOP_ICON[i] : LOCK_IC}${S.short}${s.at === i ? '<i>现任</i>' : ''}</button>`;
  }).join('');
  return `<div class="job-gal" data-ceo="${id}"><button class="job-pic" data-act="jobBig" data-arg="${id}:${v}">${jobImg(id, v)}${ready ? '' : '<span class="job-wip">画师赶稿中</span>'}</button>
    <div class="job-side"><div class="job-cap">${cur ? '现任形象' : s.at < 0 && v === homeShop(id) ? '本行形象（休息中）' : '换店预览'}：<b>${E.SHOPS[v].short}</b></div>
    <div class="job-chips">${chips}</div><div class="job-hint">点店名看 TA 在别家店的样子，点图放大</div></div></div>`;
}
function renderCeo() {
  let h = `<div class="sec-title">CEO 们（同一时间只管一家）</div>
    <div class="note" style="margin-top:0">流程：当前任职 → 选目的店 → 双方去向与 $/秒对比 → 确认。确认后换新招牌。</div>`;
  for (const c of E.CEOS) {
    const s = state.ceos[c.id];
    if (!s.unlocked) { h += `<div class="card dim"><div class="ava lock-ava">${LOCK_IC}</div><div class="info"><div class="name">${c.id === 'rocket' ? '？？？' : c.name}<span class="tag idle">${E.TYPES[c.type]}</span></div><div class="desc">${c.unlock}</div></div></div>`; continue; }
    const at = s.at, info = at >= 0 ? E.ceoInfo(state, at) : null;
    h += `<div class="card">${ava(c.id)}<div class="info"><div class="name">${c.name}<span class="lv">Lv.${s.lv}</span><span class="tag ${info ? (info.match ? 'match' : 'cross') : 'idle'}">${E.TYPES[c.type]}</span></div>
      <div class="desc one">现任：<b>${ceoPost(c.id)}</b>${info ? `（${info.match ? '专长' : '跨行'} ×${info.mult.toFixed(2)}）` : ''}</div>
      <div class="desc one">“${c.line}”</div></div>
      <div class="btns">${E.ceoMaxed(state, c.id) ? '<button class="buy no" disabled data-max="ceo">满级</button>' : btn('ceoUp', c.id, '升级', E.ceoCost(c.id, s.lv))}<button class="buy alt" data-act="assign" data-arg="${c.id}">调任</button></div></div>`;
    h += jobGallery(c.id);
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
  const nameOf = (id, slot) => id === 'none' ? (slot === 'hat' ? '默认帽子' : '默认衣服') : id === 'c_gold' ? '金马甲' : id === 'h_gold' ? '金厨师帽' : E.ITEM_BY_ID[id].name;
  const cell = (slot, id) => `<button class="item ${((eq[slot] || 'none') === id) ? 'sel' : ''}" data-act="equip" data-arg="${who}:${slot}:${id}">${id === 'none' ? `<span class="ii">${slot === 'hat' ? '🧢' : '👕'}</span>` : (itemThumb(id) ? `<img src="${itemThumb(id)}" style="width:44px;height:44px" alt="">` : '')}${nameOf(id, slot)}</button>`;
  const clothName = eq.clothes ? nameOf(eq.clothes) : '默认衣服';
  const hatName = eq.hat ? nameOf(eq.hat) : '默认帽子';
  let h = `<div class="sec-title">CEO 衣橱（穿在 CEO 身上，换店跟着人走）</div>
    <div class="who-row">${ceos.map(c => `<button class="who ${c.id === who ? 'on' : ''}" data-act="wearWho" data-arg="${c.id}">${ava(c.id)}<span>${c.name}</span></button>`).join('')}</div>
    <div class="wear-preview"><div class="wp-ava" style="border-radius:12px;width:100px;height:114px"><img src="${wearPreviewURL(who)}" alt="" style="transform:none;width:100%;height:100%;object-fit:contain"></div><div class="wp-info">
      <div class="wp-name">${whoName} 穿搭预览</div>
      <div class="wp-sub">衣服：<b>${clothName}</b><br>帽子：<b>${hatName}</b>${state.ceos[who].at >= 0 ? '<br>现任：' + E.signOf(state, state.ceos[who].at).name : ''}</div>
    </div></div>
    <div class="slot-title">衣服</div>
    <div class="item-grid">${clothes.map(id => cell('clothes', id)).join('')}</div>
    <div class="slot-title">帽子</div>
    <div class="item-grid">${hats.map(id => cell('hat', id)).join('')}</div>`;
  if (clothes.length + hats.length <= 2) h += `<div class="note">从盲盒里抽到衣服、帽子后，在这里给 CEO 换上。两个「默认」分别是衣服和帽子，点选后能看出区别。</div>`;
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
  if (tab === 'home' && homeDrag) return; // 家宅拖动中不重画（dirty 留着，松手后再画）
  const html = tab === 'shop' ? renderShop() : tab === 'ceo' ? renderCeo() : tab === 'gacha' ? renderGacha() : tab === 'home' ? renderHome() : renderCol();
  tabBody.innerHTML = html; dirty = false; updateCompactHead(); refreshDynamic(true); // 顶部「谁在管哪家店」跟着一起刷新（调任/交换/新 CEO 后两处同步）
}
function setTab(t) {
  const prev = tab;
  if (prev === 'home' && homeDrag) homeEnd();
  tab = t;
  if (t === 'home' && prev !== 'home') { homeSub = 'room'; homeSel = null; }
  if (prev !== t && (t === 'home' || prev === 'home')) pageFlip(t === 'home' ? 'next' : 'prev'); // 像翻书：经营 ⇄ 家宅
  document.querySelectorAll('#bottomNav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.getElementById('app').dataset.tab = t;
  $('#panel').scrollTop = 0;
  updateCompactHead();
  renderTab();
  resize();
}
function updateCompactHead() {
  const el = $('#compactHead');
  if (tab === 'shop' || tab === 'home') { el.classList.add('hidden'); el.innerHTML = ''; return; } // 家宅页把高度留给房间 + 仓库（页头说明放进页内）
  el.classList.remove('hidden');
  if (tab === 'ceo') {
    let cards = E.CEOS.map(c => {
      const s = state.ceos[c.id];
      if (!s.unlocked) return `<div class="ch-card"><div class="ava lock-ava">${LOCK_IC}</div><b>？？？</b><small>${c.unlock}</small></div>`;
      const post = s.at >= 0 ? E.signOf(state, s.at).name : '休息中';
      return `<div class="ch-card">${ava(c.id)}<b>${c.name}</b><small>${post}</small></div>`;
    }).join('');
    el.innerHTML = `<div class="ch-title">谁在管哪家店</div><div class="ch-row">${cards}</div>
      <div class="ch-note">调任：点卡片上的「调任」→ 选目的店 → 看双方去向和全街 $/秒对比 → 确认。目标店有人会变成「交换任职」。</div>`;
  } else if (tab === 'gacha') {
    const owned = state.gacha.owned.length, total = E.ITEMS.length;
    el.innerHTML = `<div class="ch-title">77 收藏盲盒</div><div class="ch-note">已收集 <b>${owned}/${total}</b>（普通 ${E.REGULAR_ITEMS.length} + 超级 ${E.SUPER_ITEMS.length}）。店景在「经营」页；这里专心开盒。</div>`;
  } else {
    el.innerHTML = `<div class="ch-title">收藏与穿搭</div><div class="ch-note">衣服 / 帽子分区给 CEO 换装；装饰摆店里；故事卡集齐解锁金牌摊主。</div>`;
  }
}
function switchShop(i) { if (i < 0 || i > 3) return; if (state.cur !== i) combo.n = 0; state.cur = i; dirty = true; renderTabs(); }
function renderTabs() {
  $('#shopTabs').innerHTML = E.SHOPS.map((S, i) => { const s = state.shops[i];
    const sub = s.open ? (s.emp > 0 ? '+' + fmt(E.shopRate(state, i)) + '/秒' : '未雇员工') : (i === 0 || state.shops[i - 1].open ? fmt(S.open) : LOCK_IC + '待解锁');
    return `<button data-shop="${i}" class="${state.cur === i ? 'on' : ''} ${s.open ? '' : 'locked'}"><span class="tn">${SHOP_ICON[i]}${TAB_NAME[i]}</span><small>${sub}</small></button>`; }).join('');
}
let lastDyn = 0;
function refreshDynamic(force) {
  const t = now();
  // 顶部
  const r = E.onlineRate(state, t), busy = !!(order && order.progress < 1);
  const ct = E.walletOk(state) ? fmt(E.balance(state)) : '存档异常'; if (coinsEl.textContent !== ct) coinsEl.textContent = ct;
  const cps = '每秒 +' + fmt(r) + (busy ? '（团单服务中）' : ''); if (cpsEl.textContent !== cps) cpsEl.textContent = cps;
  $('#boostTag').classList.toggle('hidden', !busy); if (busy) $('#boostSec').textContent = Math.round(order.progress * 100);
  const dc = $('#dailyChip'), can = E.canDouble(state, t);
  const dtxt = can ? '今日双倍 ✓' : '双倍 ' + fmtClockMYT(E.nextResetTs(t)) + ' 重置'; if (dc.textContent !== dtxt) dc.textContent = dtxt;
  dc.className = 'chip ' + (can ? 'on' : 'used');
  // 按钮可买状态
  tabBody.querySelectorAll('[data-cost]').forEach(b => b.classList.toggle('no', !E.canAfford(state, +b.dataset.cost)));
  refreshCrit();   // 暴击说明不受 900ms 限制：连击中 / 刚断连都马上对上店景 HUD
  if (!force && t - lastDyn < 900) return; lastDyn = t;
  // 下一步
  const gl = E.nextGoal(state); $('#goalTxt').textContent = gl.text + (gl.lv ? `（${gl.cur}/${gl.need}）` : gl.count ? `（${gl.cur}/${gl.need}）` : '');
  $('#goalBar').style.width = Math.min(100, gl.cur / gl.need * 100).toFixed(0) + '%';
  renderTabs();
  // 底部提醒点
  const gdot = E.gachaUnlocked(state) && !E.gachaComplete(state) && E.canAfford(state, E.gachaPrice(state));
  const nb = document.querySelector('#bottomNav [data-tab="gacha"]'); const has = !!nb.querySelector('.dot');
  if (gdot && !has) nb.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); if (!gdot && has) nb.querySelector('.dot').remove();
  const cdot = E.CEOS.some(c => state.ceos[c.id].unlocked && state.ceos[c.id].at === -1);
  const cb = document.querySelector('#bottomNav [data-tab="ceo"]'); const hc = !!cb.querySelector('.dot');
  if (cdot && !hc) cb.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); if (!cdot && hc) cb.querySelector('.dot').remove();
  const mb = document.getElementById('mallBal'); if (mb) mb.textContent = E.walletOk(state) ? fmt(E.balance(state)) : '存档异常';
  const hl = document.getElementById('homeLux'); if (hl && homeWho) hl.textContent = E.homeLuxury(state, homeWho);
}

/* ================= 弹窗 ================= */
const modal = $('#modal'), mpanel = $('#mpanel'), sheet = $('#sheet'), sheetPanel = $('#sheetPanel');
const mq = [];
function modalOpen() { return !modal.classList.contains('hidden') || !sheet.classList.contains('hidden'); }
function queueModal(fn) { if (modalOpen()) mq.push(fn); else fn(); }
function openModal(html, burst = true) { mpanel.classList.remove('zoom'); mpanel.innerHTML = html; modalX(); modal.querySelector('.burst').style.display = burst ? '' : 'none'; modal.classList.remove('hidden'); mpanel.scrollTop = 0; }
// 12c：统一右上角关闭钮 = 代按弹窗里已有的「再想想 / 好 / 知道了 / 返回」，不另走关闭逻辑（领离线收益这类必须选一个的弹窗没有 ×）
function modalX() {
  const t = mpanel.querySelector('#mNo, #pvNo') || mpanel.querySelector('#mOk'); mpanel.classList.toggle('has-x', !!t); if (!t) return;
  mpanel.insertAdjacentHTML('afterbegin', `<button class="cx-close" id="mX" type="button" aria-label="${t.id === 'mOk' && t.dataset.x !== 'close' ? (t.textContent.trim() || '关闭') : '关闭'}">${ic('close')}</button>`);
  $('#mX').addEventListener('click', () => { const c = mpanel.querySelector('#mNo, #pvNo') || mpanel.querySelector('#mOk'); if (c && c.dataset.x === 'close') closeModal(); else if (c) c.click(); }); // 12c1：data-x="close" 的弹窗（开摊介绍）× 只关窗，不走「开摊」的解锁音效 / 台词；12c3：这种 × 朗读标签也叫「关闭」
}
function closeModal() { modal.classList.add('hidden'); mpanel.innerHTML = ''; if (mq.length && !modalOpen()) setTimeout(() => { if (!modalOpen() && mq.length) mq.shift()(); }, 120); }
function openSheet(html) { sheetPanel.innerHTML = `<button class="cx-close" id="sheetX" type="button" aria-label="关闭">${ic('close')}</button>` + html; sheet.classList.remove('hidden'); $('#sheetX').addEventListener('click', closeSheet); }
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
    <div class="mnote" id="offNote">离线 = 在线每秒收益的 50%，最多 ${capH} 小时${capH > 8 ? '（麻辣服务器 +2 小时）' : ''}；团单收入只算在线（离开时进行中的团单会取消）。按你离开时的店铺、员工和 CEO 安排结算。</div>
    <div class="mbtns">${can ? `<button class="buy big red" id="claimDouble">今日双倍领取 +${fmt(p.amount * 2)}</button><button class="buy ghost" id="claim">直接领取（双倍留到下次）</button>`
      : `<button class="buy big" id="claim">收下！</button><div class="mnote" style="margin:0">今日双倍已用，${fmtClockMYT(E.nextResetTs(now()))}（马来西亚时间）重置</div>`}</div>`);
  const go = dbl => {
    const r = atomic(() => E.claimOffline(state, now(), dbl));
    closeModal();
    if (r.ok) { sfx('reveal'); popWord(r.doubled ? '翻倍！' : '到账！'); bumpCoins(); burstCoins(W / 2, H * 0.5, 18); toast((r.doubled ? '双倍到账 +' : '到账 +') + fmt(r.amount) + (r.capped ? '（金币已到上限，多出的没进账）' : '')); dirty = true; }
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
function showComic(k, fresh, back) { // back：从放大图返回，只重画，不重复记已看/音效
  const x = E.CROSS[k], [id, shop] = k.split('@'), c = E.CEO_BY_ID[id];
  if (!back && !state.ceos[id].unlocked && !fresh) { toast('这位 CEO 还没加入'); return; }
  if (fresh && !back) { state.crossSeen[k] = true; persist(); sfx('mile'); }
  openModal(`<div class="mbubble">${fresh ? '跨行事件！' : '跨行组合'}</div><div class="mtitle">${c.name} × ${E.SHOPS[+shop].short}：「${x.title}」</div>
    <div class="comic-sfx">${x.sfx}</div>
    <div class="cross-wrap${CROSS_ART[k] ? ' has-art' : ''}">
    ${CROSS_ART[k] ? `<div class="cross-art"><button class="cross-zoom" id="crossZoom" aria-label="放大看「${x.title}」整图"><img src="${crossURL(k)}" alt="${x.title}" onerror="var w=this.closest('.cross-wrap');if(w)w.classList.remove('has-art');var a=this.closest('.cross-art');if(a)a.remove()"><span class="zoom-hint">🔍 点图放大</span></button></div>
    <div class="cross-cap">${x.panels.map(p => `<div>${p[1]} ${p[2]}</div>`).join('')}</div>` : ''}
    <div class="comic two">${x.panels.map((p, n) => `<div class="panel4"><span class="pn">${n + 1}</span><div class="pchar"><div class="pimg">${faceImg(p[0])}</div><span class="pe">${p[1]}</span></div><div class="pt">${p[2]}</div></div>`).join('')}</div></div>
    <div class="mnote"><b>专属效果：</b>${x.desc}${E.crossActive(state, k) ? '（生效中）' : ''}</div>
    <button class="buy big" id="mOk">知道了</button>`, !back);
  const z = $('#crossZoom'); if (z) z.addEventListener('click', () => showCrossBig(k, fresh), { once:true });
  $('#mOk').addEventListener('click', closeModal, { once:true });
}
// 跨行漫画点图放大：复用 CEO 任职照的大图弹窗（.job-big），返回时回到原漫画（不关弹窗，排队中的下一张不会丢）
function showCrossBig(k, fresh) {
  const x = E.CROSS[k], [id, shop] = k.split('@'), c = E.CEO_BY_ID[id];
  openModal(`<div class="mtitle">${c.name} × ${E.SHOPS[+shop].short}：「${x.title}」</div><div class="job-big"><img src="${crossURL(k)}" alt="${x.title}" id="crossBigImg"
    onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'mnote',textContent:'整图没加载出来，返回看文字版'}))"></div><button class="buy big" id="mOk">返回漫画</button>`, false);
  mpanel.classList.add('zoom');
  const back = () => showComic(k, fresh, true);
  $('#mOk').addEventListener('click', back, { once:true });
  const im = $('#crossBigImg'); if (im) im.addEventListener('click', back, { once:true });
}
function showCeoJoin(id) {
  const c = E.CEO_BY_ID[id], s = state.ceos[id]; sfx('mile');
  openModal(`<div class="mbubble">新 CEO 加入！</div><div style="display:flex;justify-content:center;margin:6px 0"><div class="ava art bust">${bustImg(id)}</div></div>
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
  openModal(`<div class="mbubble">欢迎来到《躺着也能赚》</div><div style="display:flex;justify-content:center;margin:6px 0"><div class="ava art bust">${bustImg('c77')}</div></div>
    <div class="mtitle">77：巴适得很，串串烤起走！</div>
    <div class="mnote">① 点画面里的烧烤摊赚第一桶金：每一下都有<b>暴击</b>机会（暴击 ×5 / 超级 ×10 / 超超超级 ×20），1 秒内连点越点越容易暴击<br>② 攒 50 雇员工阿炭，之后<b>躺着也能赚</b><br>③ 开新店、升级店铺/员工/CEO，把 CEO 调去别的店试试跨行事件<br>离线也有收益（50%，最多 8 小时），每天还有一次免费双倍。</div>
    <button class="buy big red" id="mOk" data-x="close">开摊！</button>`);
  $('#mOk').addEventListener('click', () => { audioUnlock(); closeModal(); sayLine('c', '巴适得很，串串烤起走！', 3); }, { once:true });
}

/* ================= CEO 生活篇：家宅 / 商城 / 摆放（像翻书：经营 → 家宅 → 商城） ================= */
// 存档：state.furnInv={fid:数量} 公共仓库；state.homes[ceoId]={ lv, placed:[{uid,fid,x,y,rot}], next }；一件同时只在一家
// 美术：画师的图转成 webp 后放 art/，在下面两张表里登记一张就用一张；没登记 / 加载失败 → 用色块 + emoji 占位
// 房间底图：art/home_<ceo>_<lv>.webp（ceo=c77/pearl/otaku/rocket，lv=1/2/3），例 { c77_1:1 }
// 底图规格：宽 = 列数×200px，高 = (2 + 行数)×200px；上面 2 格高是后墙，下面是地板格，平行投影无消失点。Lv1 6×4 → 1200×1200，墙地分界 y=400
const HOME_ART = { c77_1: 1, pearl_1: 1, otaku_1: 1, rocket_1: 1, c77_2: 1, c77_3: 1, pearl_2: 1, pearl_3: 1, otaku_2: 1, otaku_3: 1, rocket_2: 1, rocket_3: 1 };  // 熊大四位 CEO 的 Lv1（原图墙 / 地板在踢脚线底边处分开，分别缩放到 1200×400 + 1200×800）；12b1：77 / 珍珠姐 Lv2 1600×400+1600×1000、Lv3 2000×400+2000×1200，同样在踢脚线底边切开；12b2：阿宅 / 火箭老板 Lv2/Lv3 同法
const FURN_ART = { bed:1, bookshelf:1, wardrobe:1, table:1, fridge:1, sofa:1, rug:1, plant:1, lamp:1, tv:1, painting:1, catbed:1, rocket_rocket_model:1, rocket_meteor_stand:1, rocket_biosphere_dome:1, s77_cloud_canopy:1, rocket_capsule_bunk:1 };  // +火箭模型/陨石展座/生态圆顶/云朵纱帐床；宽=占地×200（1格240）
const furnName = fid => fid.replace(/^furn_/, '');
// 高家具：占地只有底下那排格子，图按「高 / 宽」比例往上伸（盖住后墙），底脚对齐占地底边；值 = 图高 / 图宽（400×600 → 1.5）
const FURN_UP = { bookshelf: 1.5, wardrobe: 1.5, table: 202 / 400, sofa: 225 / 600, fridge: 512 / 240, plant: 396 / 240, lamp: 468 / 240, tv: 287 / 400, catbed: 166 / 240, rocket_rocket_model: 594 / 240, rocket_meteor_stand: 274 / 240, s77_cloud_canopy: 701 / 600, rocket_capsule_bunk: 186 / 400 };  // +火箭/陨石 1×1 往上伸；云朵床略高；圆顶 2×2 铺满不登记
// 11v：packs 01–10 的 43 件；地毯（透明边补成占地比例、铺满）和墙饰（贴墙上沿）不登记往上伸，其余地上家具都按图高/宽贴底
Object.assign(FURN_ART, { s77_quilt_daybed:1, s77_drawer_bed:1, s77_book_nook_bed:1, s77_peg_cubby:1, s77_ladder_shelf:1, s77_basket_cabinet:1, s77_round_corner_chest:1, s77_sewing_cabinet:1, s77_pantry_hutch:1, s77_attic_trunk:1, s77_reading_stool:1, s77_rocking_chair:1, s77_heart_bench:1, s77_folding_tray:1, s77_quilt_ottoman:1, s77_window_bench:1, s77_sewing_desk:1, s77_curved_sectional:1, s77_lantern_stand:1, s77_mushroom_lamp:1, s77_petal_uplight:1, s77_quilt_shade_lamp:1, s77_hearth_light:1, s77_box_fan:1, s77_toaster_cart:1, s77_record_console:1, s77_sewing_machine_stand:1, s77_stove_oven:1, s77_laundry_pair:1, s77_braided_runner:1, s77_patchwork_flower_rug:1, s77_quilt_island_rug:1, s77_embroidery_hoops:1, s77_wood_cuckoo:1, s77_quilt_wall:1, s77_pressed_flower_frame:1, s77_family_silhouette:1, s77_watering_stand:1, s77_knitting_basket:1, s77_olive_planter:1, s77_mini_greenhouse:1, pearl_tea_daybed:1, pearl_pearl_bed:1 });
Object.assign(FURN_UP, { s77_quilt_daybed: 157 / 600, s77_drawer_bed: 359 / 400, s77_book_nook_bed: 579 / 600, s77_peg_cubby: 431 / 240, s77_ladder_shelf: 539 / 400, s77_basket_cabinet: 330 / 400, s77_round_corner_chest: 426 / 400, s77_sewing_cabinet: 360 / 400, s77_pantry_hutch: 693 / 400, s77_attic_trunk: 321 / 400, s77_reading_stool: 234 / 240, s77_rocking_chair: 249 / 240, s77_heart_bench: 252 / 600, s77_folding_tray: 134 / 240, s77_quilt_ottoman: 224 / 240, s77_window_bench: 140 / 600, s77_sewing_desk: 269 / 400, s77_curved_sectional: 335 / 600, s77_lantern_stand: 255 / 240, s77_mushroom_lamp: 224 / 240, s77_petal_uplight: 647 / 240, s77_quilt_shade_lamp: 301 / 240, s77_hearth_light: 190 / 400, s77_box_fan: 263 / 240, s77_toaster_cart: 235 / 240, s77_record_console: 293 / 400, s77_sewing_machine_stand: 358 / 400, s77_stove_oven: 534 / 400, s77_laundry_pair: 440 / 240, s77_watering_stand: 369 / 240, s77_knitting_basket: 212 / 240, s77_olive_planter: 458 / 240, s77_mini_greenhouse: 475 / 400, pearl_tea_daybed: 156 / 600, pearl_pearl_bed: 382 / 400 });
// 11w：packs 13/16/19/27/30/33/36/39 的 34 件；地毯铺满不登记往上伸，其余地上家具按图高/宽贴底
Object.assign(FURN_ART, { pearl_cup_carousel:1, pearl_bakery_display:1, pearl_sideboard_island:1, pearl_archive_apothecary:1, pearl_conversation_pit:1, pearl_tea_gongfu_desk:1, pearl_paper_pear_lamp:1, pearl_tea_glass_lamp:1, pearl_boba_globe_lamp:1, pearl_tea_mat:1, pearl_scallop_rug:1, pearl_tea_river_runner:1, otaku_floor_chair:1, otaku_modular_couch:1, otaku_arcade_bench:1, otaku_streaming_desk:1, otaku_panel_rug:1, otaku_controller_rug:1, otaku_speed_runner:1, otaku_pixel_succulent:1, otaku_manga_book_stack:1, otaku_robot_planter:1, otaku_aquatic_pixel_tank:1, rocket_field_cot:1, rocket_cargo_crate:1, rocket_mesh_rack:1, rocket_airlock_wardrobe:1, rocket_rail_bench:1, rocket_mission_table:1, rocket_zero_g_lounger:1, rocket_cage_lamp:1, rocket_tripod_searchlight:1, rocket_pipe_valve_lamp:1, rocket_rocket_nozzle_light:1 });
Object.assign(FURN_UP, { pearl_cup_carousel: 525 / 240, pearl_bakery_display: 252 / 400, pearl_sideboard_island: 225 / 600, pearl_archive_apothecary: 355 / 600, pearl_conversation_pit: 335 / 600, pearl_tea_gongfu_desk: 211 / 600, pearl_paper_pear_lamp: 521 / 240, pearl_tea_glass_lamp: 1006 / 240, pearl_boba_globe_lamp: 932 / 240, otaku_floor_chair: 231 / 240, otaku_modular_couch: 264 / 600, otaku_arcade_bench: 254 / 400, otaku_streaming_desk: 291 / 600, otaku_pixel_succulent: 211 / 240, otaku_manga_book_stack: 236 / 240, otaku_robot_planter: 241 / 240, otaku_aquatic_pixel_tank: 163 / 400, rocket_field_cot: 430 / 400, rocket_cargo_crate: 229 / 240, rocket_mesh_rack: 328 / 400, rocket_airlock_wardrobe: 633 / 400, rocket_rail_bench: 177 / 600, rocket_mission_table: 414 / 600, rocket_zero_g_lounger: 392 / 400, rocket_cage_lamp: 369 / 240, rocket_tripod_searchlight: 367 / 240, rocket_pipe_valve_lamp: 480 / 240, rocket_rocket_nozzle_light: 266 / 240 });
// 11y：missing107 的 106 件新 ID；地毯铺满/墙饰挂墙不登记往上伸
Object.assign(FURN_ART, { pearl_tea_loft:1, pearl_canopy_lounge:1, pearl_capsule_daybed:1, pearl_tea_cat_hammock:1, pearl_tea_cubby:1, pearl_glass_wardrobe:1, pearl_rattan_bookcase:1, pearl_tea_trolley_shelf:1, pearl_tea_stool:1, pearl_cafe_chair:1, pearl_round_tea_table:1, pearl_scallop_sofa:1, pearl_tea_bar:1, pearl_bar_stool:1, pearl_picnic_table:1, pearl_egg_swing:1, pearl_fan_shade_lamp:1, pearl_tea_arc_lamp:1, pearl_fountain_light:1, pearl_tea_kettle_cart:1, pearl_juice_press:1, pearl_milk_frother_bar:1, pearl_tea_brewer:1, pearl_dessert_chiller:1, pearl_marble_pearl_rug:1, pearl_tea_menu_board:1, pearl_cup_wall_rack:1, pearl_sunburst_mirror:1, pearl_tea_leaf_relief:1, pearl_moon_window_art:1, pearl_herb_crate:1, pearl_tea_bonsai:1, pearl_ceramic_cup_stack:1, pearl_terrarium_orb:1, pearl_tea_tree_screen:1, otaku_floor_futon:1, otaku_sofa_sleeper:1, otaku_bunk_manga:1, otaku_gaming_pod:1, otaku_projector_bed:1, otaku_cat_keyboard_cave:1, otaku_locker_wardrobe:1, otaku_disc_tower:1, otaku_figure_vitrine:1, otaku_comic_wheel_cart:1, otaku_controller_drawers:1, otaku_modular_pixel_shelf:1, otaku_server_display_rack:1, otaku_beanbag:1, otaku_kotatsu:1, otaku_gaming_chair:1, otaku_manga_desk:1, otaku_snack_sidecar:1, otaku_cocoon_lounger:1, otaku_panel_lamp:1, otaku_gooseneck_stand:1, otaku_pixel_cube_light:1, otaku_arcade_marquee_lamp:1, otaku_orbital_neon_floor:1, otaku_sleep_timer_totem:1, otaku_mini_fridge:1, otaku_console_station:1, otaku_arcade_cabinet:1, otaku_projector_cart:1, otaku_triple_monitor_station:1, otaku_pixel_map_rug:1, otaku_speech_bubble_board:1, otaku_manga_page_triptych:1, otaku_controller_wall_mount:1, otaku_pixel_city_lightbox:1, otaku_cactus_cartridge:1, rocket_steel_platform_bed:1, rocket_cryo_rest_pod:1, rocket_observatory_bed:1, rocket_landing_cat_pod:1, rocket_steel_locker:1, rocket_pipe_bookcase:1, rocket_tool_chest:1, rocket_specimen_drawer:1, rocket_orbital_archive:1, rocket_bolt_stool:1, rocket_workbench:1, rocket_drafting_chair:1, rocket_pipe_sofa:1, rocket_oil_drum_table:1, rocket_captain_chair:1, rocket_cantilever_desk:1, rocket_orbital_ring_lamp:1, rocket_solar_array_lamp:1, rocket_industrial_fan:1, rocket_vacuum_dock:1, rocket_coffee_pressure_unit:1, rocket_air_purifier:1, rocket_hydroponic_unit:1, rocket_planetarium_console:1, rocket_workshop_mat:1, rocket_orbit_rug:1, rocket_runway_runner:1, rocket_lunar_relief_rug:1, rocket_blueprint_frame:1, rocket_gear_clock:1, rocket_mission_patch_board:1, rocket_moon_sample_relief:1, rocket_orbital_map_panel:1, rocket_concrete_succulent:1, rocket_pipe_vase:1 });
Object.assign(FURN_UP, { pearl_tea_loft: 412 / 400, pearl_canopy_lounge: 615 / 600, pearl_capsule_daybed: 336 / 400, pearl_tea_cat_hammock: 132 / 240, pearl_tea_cubby: 447 / 400, pearl_glass_wardrobe: 455 / 400, pearl_rattan_bookcase: 699 / 400, pearl_tea_trolley_shelf: 254 / 240, pearl_tea_stool: 199 / 240, pearl_cafe_chair: 555 / 240, pearl_round_tea_table: 391 / 400, pearl_scallop_sofa: 234 / 600, pearl_tea_bar: 300 / 600, pearl_bar_stool: 667 / 240, pearl_picnic_table: 170 / 400, pearl_egg_swing: 706 / 400, pearl_fan_shade_lamp: 350 / 240, pearl_tea_arc_lamp: 361 / 240, pearl_fountain_light: 209 / 400, pearl_tea_kettle_cart: 256 / 240, pearl_juice_press: 371 / 240, pearl_milk_frother_bar: 282 / 400, pearl_tea_brewer: 226 / 400, pearl_dessert_chiller: 711 / 400, pearl_herb_crate: 111 / 240, pearl_tea_bonsai: 213 / 240, pearl_ceramic_cup_stack: 368 / 240, pearl_terrarium_orb: 274 / 240, pearl_tea_tree_screen: 390 / 600, otaku_floor_futon: 264 / 400, otaku_sofa_sleeper: 503 / 400, otaku_bunk_manga: 470 / 400, otaku_gaming_pod: 564 / 400, otaku_projector_bed: 598 / 600, otaku_cat_keyboard_cave: 174 / 240, otaku_locker_wardrobe: 516 / 400, otaku_disc_tower: 741 / 240, otaku_figure_vitrine: 310 / 400, otaku_comic_wheel_cart: 180 / 240, otaku_controller_drawers: 282 / 400, otaku_modular_pixel_shelf: 518 / 600, otaku_server_display_rack: 433 / 400, otaku_beanbag: 200 / 240, otaku_kotatsu: 200 / 400, otaku_gaming_chair: 394 / 240, otaku_manga_desk: 371 / 400, otaku_snack_sidecar: 321 / 240, otaku_cocoon_lounger: 601 / 400, otaku_panel_lamp: 1331 / 240, otaku_gooseneck_stand: 461 / 240, otaku_pixel_cube_light: 696 / 240, otaku_arcade_marquee_lamp: 399 / 400, otaku_orbital_neon_floor: 768 / 240, otaku_sleep_timer_totem: 770 / 240, otaku_mini_fridge: 284 / 240, otaku_console_station: 291 / 400, otaku_arcade_cabinet: 477 / 240, otaku_projector_cart: 208 / 240, otaku_triple_monitor_station: 320 / 600, otaku_cactus_cartridge: 235 / 240, rocket_steel_platform_bed: 298 / 400, rocket_cryo_rest_pod: 434 / 400, rocket_observatory_bed: 543 / 600, rocket_landing_cat_pod: 239 / 240, rocket_steel_locker: 418 / 400, rocket_pipe_bookcase: 418 / 400, rocket_tool_chest: 247 / 400, rocket_specimen_drawer: 250 / 400, rocket_orbital_archive: 936 / 600, rocket_bolt_stool: 260 / 240, rocket_workbench: 213 / 400, rocket_drafting_chair: 386 / 240, rocket_pipe_sofa: 337 / 600, rocket_oil_drum_table: 342 / 400, rocket_captain_chair: 342 / 240, rocket_cantilever_desk: 326 / 400, rocket_orbital_ring_lamp: 479 / 240, rocket_solar_array_lamp: 372 / 400, rocket_industrial_fan: 238 / 240, rocket_vacuum_dock: 401 / 240, rocket_coffee_pressure_unit: 508 / 400, rocket_air_purifier: 632 / 240, rocket_hydroponic_unit: 241 / 400, rocket_planetarium_console: 485 / 400, rocket_concrete_succulent: 228 / 240, rocket_pipe_vase: 347 / 240 });
const ROOM_WALL_ROWS = 2;  // 后墙高 2 格
const furnTall = fid => !!(FURN_ART[furnName(fid)] && FURN_UP[furnName(fid)]);
// 12c2：竖放（rot 1/3）用侧面图。熊大补 art/furn_<名>_side.webp（宽 = 竖放后的占地宽，1 格 240px；高随图）后，在这里登记「图高 / 图宽」就生效：
// 竖放换侧面图、底脚贴占地底边、同样封顶到房间顶边；rot 3 水平镜像；侧面图没登记或加载失败 → 保持原来的正面图等比兜底。目前素材包里没有任何侧面图，所以表是空的
const FURN_SIDE = {};
const furnSide = (fid, rot) => ((rot & 1) && FURN_SIDE[furnName(fid)]) || 0;
const HOME_ICON = ['home', 'apt', 'villa'].map(n => ic(n)); // 12c1：家宅升级三档用同套 SVG（原系统 emoji）
let homeWho = 'c77', homeSub = 'room', homeMode = 'live', homeSel = null, homeDrag = null;
const homeActor = {}; // ceoId -> {x,y,tx,ty,act,line,until,walk}
let mallQ = '', mallCat = 'all', mallSub = 'all', mallFilter = { afford:false, owned:false, price:'any', size:'any' };
// price: any|low|mid|high ；size: any|1|2|3p （1×1 / 2 格边 / 3+）
const homeUndo = {}; // 每位 CEO 一条撤销栈（只在本次打开有效，不存档）
const undoStack = id => homeUndo[id] || (homeUndo[id] = []);
function pushUndo(u) { const s = undoStack(u.ceo); s.push(u); if (s.length > 60) s.shift(); }
function furnInner(fid, rot, inRoom) {
  const f = E.FURN_BY_ID[fid], sz = E.furnSize(fid, rot), odd = rot & 1, n = furnName(fid);
  // 挂画（wall:true）在房间里：顶对齐、贴格子上沿挂（靠天花板），不在格子中间飘；转 90° 的才按中心转
  // 11z：往上伸的图最高只到「占地 + 2 格后墙」（房间顶边）；超高的（面板灯、光盘塔、计时图腾等）等比缩小、脚底不动，整图不被顶边裁掉
  const tall = inRoom && furnTall(fid), side = tall ? furnSide(fid, rot) : 0, tallH = up => `${Math.min(sz.w * up, sz.h + ROOM_WALL_ROWS) / sz.h * 100}%`;
  const st = tall ? `left:0;top:auto;bottom:0;width:100%;height:${tallH(side || FURN_UP[n])};transform:none`
    : inRoom && f.wall && !odd ? `left:50%;top:0;width:100%;height:100%;transform:translateX(-50%)`
    : `width:${odd ? sz.h / sz.w * 100 : 100}%;height:${odd ? sz.w / sz.h * 100 : 100}%;transform:translate(-50%,-50%) rotate(${rot * 90}deg)`;
  const front = `art/furn_${n}.webp?v=${ART_V}`;
  const img = !FURN_ART[n] ? '' : side ? `<img class="side${rot === 3 ? ' mir' : ''}" src="art/furn_${n}_side.webp?v=${ART_V}" data-homefb="1" data-front="${front}" data-fronth="${tallH(FURN_UP[n])}" alt="">`
    : `<img src="${front}" data-homefb="1" alt="">`;
  return `<div class="fi" style="${st}"><span class="fe">${f.emoji}</span>${img}</div>`;
}
document.addEventListener('error', e => { const el = e.target; if (el && el.tagName === 'IMG' && el.dataset && el.dataset.front) { const fi = el.parentNode; if (fi && el.dataset.fronth) fi.style.height = el.dataset.fronth; el.className = ''; el.src = el.dataset.front; delete el.dataset.front; return; } // 12c2：侧面图坏了 → 回正面图
  if (el && el.tagName === 'IMG' && el.dataset && el.dataset.homefb) { const fu = el.closest('.furn'); if (fu) fu.classList.remove('art'); el.remove(); } }, true);
function homeBook(sub) {
  return `<div class="book-tabs" role="tablist"><button data-act="homeGo" data-arg="shop">${ic('shop')}经营</button><button class="${sub === 'room' ? 'on' : ''}" data-act="homeSub" data-arg="room">${ic('home')}家宅</button><button class="${sub === 'mall' ? 'on' : ''}" data-act="homeSub" data-arg="mall">${ic('mall')}商城</button></div>`;
}
function homeWhoRow() {
  return `<div class="who-row home-who">${E.CEOS.map(c => { const open = E.homeOpen(state, c.id);
    return `<button class="who ${c.id === homeWho ? 'on' : ''} ${open ? '' : 'locked'}" data-act="homeWho" data-arg="${c.id}">${open ? ava(c.id) : `<div class="ava lock-ava">${LOCK_IC}</div>`}<span>${open || c.id !== 'rocket' ? c.name : '？？？'}</span></button>`; }).join('')}</div>`;
}
function homeLocked() {
  const c = E.CEO_BY_ID[homeWho];
  return `<div class="card dim home-lock"><div class="ava lock-ava">${LOCK_IC}</div><div class="info"><div class="name">${c.id === 'rocket' ? '？？？' : c.name} 的家还没开放</div><div class="desc">${c.unlock}，加入后就有自己的小屋。</div></div></div>`;
}

const LIVE_LINES = {
  c77:    { walk:['走两步耍下！','地板巴适得很。','莫慌，慢慢逛。'], rest:['瞌睡来了……','躺平！串串味儿还在。','眯一会儿，招牌自己烤。'], read:['……看不懂，但装得很认真。','书里有没有烤串秘方？','阿宅教的，我翻两页。'], dress:['换件围裙耍帅！','金马甲呢？在仓库。','穿好了，出摊！'] },
  pearl:  { walk:['脚步要轻，账本怕震。','茶香这边更浓。','客人看不见，我自己逛逛。'], rest:['珍珠姐也要午休。','躺平不等于躺不平账。','Q弹的梦，三分钟。'], read:['这本讲成本核算。','漫画？偶尔也扫一眼。','笔记写在杯套上。'], dress:['旗袍要平整。','换一身再营业。','珍珠发夹——不能掉。'] },
  otaku:  { walk:['分镜走位，从这格到那格。','地板也是画框。','别踩到我的手办投影。'], rest:['存档点……睡着了。','梦里下一话更新。','被窝是我的次元。'], read:['这本我标了书签！','名场面在第 42 页。','读完去改招牌文案。'], dress:['连帽衫＋新徽章。','换上角色扮演装。','镜子前先摆个 pose。'] },
  rocket: { walk:['舱内巡检开始。','步进电机：启动。','火星还远，先走到窗边。'], rest:['休眠模式 ON。','充电 20 分钟。','梦到小店起飞。'], read:['说明书：怎么把床送上轨道。','这页有推力公式。','读完继续画火箭。'], dress:['胸针要亮。','换发射正装。','地上的装备，穿上！'] },
};
function liveLine(id, act) { const pack = LIVE_LINES[id] || LIVE_LINES.c77, arr = pack[act] || pack.walk; return arr[Math.floor(Math.random() * arr.length)]; }
function homeActorOf(id) {
  const T = E.homeTier(E.homeOf(state, id).lv);
  if (!homeActor[id]) homeActor[id] = { x:Math.floor(T.cols / 2), y:Math.floor(T.rows / 2), tx:null, ty:null, act:null, line:'', until:0 };
  return homeActor[id];
}

function renderHome() {
  if (!E.CEO_BY_ID[homeWho]) homeWho = 'c77';
  let h = homeBook(homeSub) + homeWhoRow();
  if (homeSub !== 'mall' && !E.homeOpen(state, homeWho)) return h + homeLocked(); // 商城是公共的，不受当前 CEO 是否加入限制
  return h + (homeSub === 'mall' ? renderMall() : renderRoom());
}
function renderRoom() {
  const id = homeWho, c = E.CEO_BY_ID[id], H = E.homeOf(state, id), T = E.homeTier(H.lv), lux = E.homeLuxury(state, id);
  if (homeSel && !H.placed.some(p => p.uid === homeSel)) homeSel = null;
  const next = H.lv < E.HOME_MAX ? E.HOME_TIERS[H.lv] : null, sel = homeSel && H.placed.find(p => p.uid === homeSel);
  let h = `<div class="card home-card"><div class="ava sq">${HOME_ICON[H.lv - 1]}</div><div class="info"><div class="name">${c.name} 的${T.name}<span class="lv">Lv.${H.lv}</span></div>
    <div class="desc">${T.cols}×${T.rows} 格 · 豪华度 <b class="lux" id="homeLux">${lux}</b>（家具 ${lux - T.bonus} + 房型 ${T.bonus}）</div>
    <div class="gain">${next ? `升级 → ${next.name} ${next.cols}×${next.rows} 格，房型豪华 +${next.bonus}` : '已经是最高档豪宅'}</div></div>
    ${next ? btn('homeUp', id, '升级', next.cost) : '<button class="buy no" disabled>顶级</button>'}</div>`;
  const isRug = p => E.FURN_BY_ID[p.fid].layer === 'rug' ? 0 : 1, footY = p => p.y + E.furnSize(p.fid, p.rot).h;
  const isWall = p => E.itemSurf(p) === 'wall';
  const mkFurn = (p, rows) => {
    const f = E.FURN_BY_ID[p.fid], sz = E.furnSize(p.fid, p.rot);
    return `<div class="furn ${f.layer === 'rug' ? 'rug' : ''} ${f.wall ? 'wallf' : ''} ${FURN_ART[furnName(p.fid)] ? 'art' : ''} ${furnTall(p.fid) ? 'tall' : ''} ${p.uid === homeSel ? 'sel' : ''}" data-uid="${p.uid}" data-fid="${p.fid}" data-surf="${E.itemSurf(p)}" style="left:${p.x / T.cols * 100}%;top:${p.y / rows * 100}%;width:${sz.w / T.cols * 100}%;height:${sz.h / rows * 100}%;--fc:${f.color}">${furnInner(p.fid, p.rot, true)}<b class="fn">${f.name}</b></div>`;
  };
  // 墙面挂画 / 地板家具分开渲染；地板前后遮挡：地毯垫最底，其余按底脚行排
  const wallItems = H.placed.filter(isWall).slice().sort((a, b) => a.y - b.y || a.x - b.x).map(p => mkFurn(p, E.WALL_ROWS)).join('');
  const floorItems = H.placed.filter(p => !isWall(p)).slice().sort((a, b) => isRug(a) - isRug(b) || footY(a) - footY(b) || a.x - b.x).map(p => mkFurn(p, T.rows)).join('');
  const artKey = `${id}_${H.lv}`, hasArt = !!HOME_ART[artKey];
  // 墙面禁区（和 E.canPlace / E.findFree 同一份 E.wallBlockedCells）：平时隐藏，拖挂画时斜纹标红
  const wallBlocks = E.wallBlockedCells(state, id).map(([x, y]) => `<i class="wall-block" style="left:${x / T.cols * 100}%;top:${y / E.WALL_ROWS * 100}%;width:${100 / T.cols}%;height:${100 / E.WALL_ROWS}%"></i>`).join('');
  h += `<div class="room tier-${T.id}${hasArt ? ' has-art' : ''}" id="room" data-tier="${T.id}" style="--cols:${T.cols};--rows:${T.rows};--wall:${T.wall};--floor:${T.floor};--trim:${T.trim}">
    ${hasArt ? `<img class="room-art" src="art/home_${artKey}.webp?v=${ART_V}" data-homefb="1" alt="" onerror="this.closest('.room')&&this.closest('.room').classList.remove('has-art')">` : ''}
    <div class="room-wall" id="roomWall"><span class="rw-deco">${T.id === 'hut' ? ic('window') : T.id === 'apt' ? ic('window') + ic('window') : ic('spark') + ic('candle') + ic('spark')}</span><span class="rw-name">${c.name}的${T.name}</span><div class="wall-grid" id="wallGrid">${wallBlocks}${wallItems}<div class="room-hl hidden" id="wallHl"></div></div></div>
    <div class="room-floor" id="roomFloor">${floorItems}<div class="home-actor" id="homeActor" style="left:${(homeActorOf(id).x + 0.5) / T.cols * 100}%;top:${(homeActorOf(id).y + 0.5) / T.rows * 100}%"><span class="ha-ava">${ava(id)}</span>${(() => { const ac = homeActorOf(id); return ac.line && ac.until > clock ? `<b class="ha-line">${ac.line}</b>` : ''; })()}<i class="ha-act">${(() => { const ac = homeActorOf(id); return ac.act === 'rest' ? ic('zz') : ac.act === 'read' ? ic('book') : ac.act === 'dress' ? ic('shirt') : ''; })()}</i></div><div class="room-hl hidden" id="roomHl"></div></div></div>`;
  const st = undoStack(id);
  h += `<div class="mode-tabs" role="tablist"><button class="mt ${homeMode === 'live' ? 'on' : ''}" data-act="homeMode" data-arg="live">${ic('live')}生活</button><button class="mt ${homeMode === 'decor' ? 'on' : ''}" data-act="homeMode" data-arg="decor">${ic('decor')}布置</button></div>`;
  h += `<div class="room-tools">${homeMode === 'decor' ? (sel ? `<span class="rt-sel">已选：<b>${E.FURN_BY_ID[sel.fid].name}</b></span><button class="buy alt" data-act="homeRot" data-arg="${sel.uid}">↻ 旋转</button><button class="buy alt" data-act="homeStore" data-arg="${sel.uid}">${ic('box')}收回</button>`
    : '<span class="rt-sel">布置：点家具选中 / 拖动换位；挂画拖到墙面</span>') : '<span class="rt-sel">生活：点空地走过去 · 点床休息 · 点书架看书 · 点衣柜换装</span>'}
    ${homeMode === 'decor' ? `<button class="buy alt" data-act="homeUndo" data-arg="${id}" ${st.length ? '' : 'disabled'}>↶ 撤销${st.length ? ' ' + st.length : ''}</button>` : ''}</div>`;
  const inv = Object.entries(E.furnInvOf(state)).filter(([, n]) => n > 0);
  if (homeMode === 'decor') {
    h += `<div class="tray-head"><b>公共家具仓库</b><span>${inv.length ? '按住拖进房间 · 轻点自动摆' : '空空的'}</span><button class="buy alt mall-go" data-act="homeSub" data-arg="mall">${ic('mall')}去商城</button></div>`;
    h += inv.length ? `<div class="inv-strip">${inv.map(([fid, n]) => { const f = E.FURN_BY_ID[fid], stt = E.furnStats(state, fid);
        const where = stt.where.length ? stt.where.map(w => w.name).join('、') : '';
        return `<div class="inv-item" data-fid="${fid}" style="--fc:${f.color}" title="${f.name} ${f.w}×${f.h}${where ? ' · 另有在 ' + where : ''}"><span class="ie">${f.emoji}</span><b>${f.name}</b><small>${f.w}×${f.h}</small><i>×${n}</i></div>`; }).join('')}</div>
        <div class="note">布置模式：拖家具、旋转、收回。挂画只挂墙。生活模式下去点空地 / 床 / 书架 / 衣柜互动。</div>`
      : `<div class="note">仓库空空。去商城买家具，再回来布置 ${c.name} 的房间。</div>`;
  } else {
    h += `<div class="note live-note">生活模式：点地板空位让 ${c.name} 走过去；点<b>床</b>休息、点<b>书架</b>看书、点<b>衣柜</b>换装。要摆家具请切到「布置」。</div>
      <button class="buy alt mall-go" data-act="homeSub" data-arg="mall">${ic('mall')}去商城</button>`;
  }
  return h;
}
function mallMatch(f) {
  const q = mallQ.trim().toLowerCase();
  if (q && !(f.name.toLowerCase().includes(q) || (f.cat && f.cat.includes(q)) || (f.sub && f.sub.includes(q)))) return false;
  if (mallCat !== 'all' && f.cat !== mallCat) return false;
  if (mallCat === 'cabinet' && mallSub !== 'all' && f.sub !== mallSub) return false;
  const stt = E.furnStats(state, f.id);
  if (mallFilter.afford && !E.canAfford(state, f.price)) return false;
  if (mallFilter.owned && stt.owned <= 0) return false;
  if (mallFilter.price === 'low' && f.price >= 3000) return false;
  if (mallFilter.price === 'mid' && (f.price < 3000 || f.price >= 15000)) return false;
  if (mallFilter.price === 'high' && f.price < 15000) return false;
  const area = f.w * f.h, long = Math.max(f.w, f.h);
  if (mallFilter.size === '1' && !(f.w === 1 && f.h === 1)) return false;
  if (mallFilter.size === '2' && long !== 2) return false;
  if (mallFilter.size === '3p' && long < 3) return false;
  return true;
}
function renderMall() {
  const c = E.CEO_BY_ID[homeWho], open = E.homeOpen(state, homeWho), nm = open || c.id !== 'rocket' ? c.name : '？？？';
  const list = E.FURNITURE.filter(mallMatch);
  let h = `<div class="mall-head"><div>公共仓库 · ${open ? `现看 <b>${nm}</b> 的家` : `<b>${nm}</b> 还没加入，买的先进仓库`}</div><div>余额 ${coinSm}<b id="mallBal">${fmt(E.balance(state))}</b></div></div>`;
  h += `<div class="mall-search"><input id="mallSearch" type="search" enterkeyhint="search" placeholder="搜索家具…" value="${mallQ.replace(/"/g, '&quot;')}" autocomplete="off"><button type="button" class="buy alt" data-act="mallClear" ${mallQ || mallCat !== 'all' || mallFilter.afford || mallFilter.owned || mallFilter.price !== 'any' || mallFilter.size !== 'any' ? '' : 'disabled'}>清除</button></div>`;
  h += `<div class="mall-cats" role="tablist"><button class="mc ${mallCat === 'all' ? 'on' : ''}" data-act="mallCat" data-arg="all">全部</button>${E.MALL_CATS.map(c => `<button class="mc ${mallCat === c.id ? 'on' : ''}" data-act="mallCat" data-arg="${c.id}">${c.name}</button>`).join('')}</div>`;
  if (mallCat === 'cabinet') {
    const subs = E.MALL_CATS.find(c => c.id === 'cabinet').subs;
    h += `<div class="mall-subs">${[{ id:'all', name:'全部柜架' }, ...subs].map(c => `<button class="ms ${mallSub === c.id ? 'on' : ''}" data-act="mallSub" data-arg="${c.id}">${c.name}</button>`).join('')}</div>`;
  }
  h += `<div class="mall-filters">
    <label class="mf"><input type="checkbox" data-act="mallAff" ${mallFilter.afford ? 'checked' : ''}>买得起</label>
    <label class="mf"><input type="checkbox" data-act="mallOwn" ${mallFilter.owned ? 'checked' : ''}>已拥有</label>
    <select data-act="mallPrice"><option value="any"${mallFilter.price==='any'?' selected':''}>价格</option><option value="low"${mallFilter.price==='low'?' selected':''}>3千以下</option><option value="mid"${mallFilter.price==='mid'?' selected':''}>3千–1.5万</option><option value="high"${mallFilter.price==='high'?' selected':''}>1.5万+</option></select>
    <select data-act="mallSize"><option value="any"${mallFilter.size==='any'?' selected':''}>占地</option><option value="1"${mallFilter.size==='1'?' selected':''}>1×1</option><option value="2"${mallFilter.size==='2'?' selected':''}>含 2 格边</option><option value="3p"${mallFilter.size==='3p'?' selected':''}>3 格+</option></select>
  </div>`;
  h += `<div class="mall-count"><span class="mc-num">显示<b>${list.length}</b>/ ${E.FURNITURE.length} 件</span><span class="mall-spacer">后期还会加</span></div>`;
  h += `<div class="mall-list">`;
  h += list.map(f => { const stt = E.furnStats(state, f.id);
    const where = stt.where.length ? stt.where.map(w => w.name).join('、') : '未摆出';
    const cat = E.MALL_CATS.find(c => c.id === f.cat);
    return `<div class="card mall-card" data-fid="${f.id}"><div class="ava sq furn-ico" style="--fc:${f.color}">${furnInner(f.id, 0)}</div><div class="info"><div class="name">${f.name}<span class="tag match">豪华 +${f.lux}</span></div>
      <div class="desc">${cat ? cat.name + (f.sub ? ' · ' + (((cat.subs || []).find(x => x.id === f.sub) || {}).name || '') : '') + ' · ' : ''}占地 ${f.w}×${f.h} 格${f.layer === 'rug' ? ' · 可垫在家具下' : ''}${f.wall ? ' · 挂墙面（不占地板）' : ''}<br>已拥有 ${stt.owned}（摆出 ${stt.placed} / 仓库 ${stt.warehouse}）<br>摆在：${where}</div></div>${btn('homeBuy', f.id, '购买', f.price)}</div>`; }).join('');
  // 留白：即使滤完也保留空位提示，方便以后加商品
  if (list.length < 4) for (let i = list.length; i < 4; i++) h += `<div class="card mall-card mall-ghost" aria-hidden="true"><div class="ava sq">+</div><div class="info"><div class="name">敬请期待</div><div class="desc">商城还会加新家具，先把分类和搜索用起来。</div></div></div>`;
  if (!list.length) h += `<div class="note">没有符合条件的家具，试试清除筛选。</div>`;
  h += `</div><div class="note">商城只花游戏金币，和经营共用一个钱包。家具进公共仓库；一件同时只在一家，想多家都有就多买。家具只加豪华度，不加产速、不影响开店。</div>`;
  return h;
}
function confirmHomeBuy(fid) {
  const f = E.FURN_BY_ID[fid], stt = E.furnStats(state, fid), bal = E.balance(state), can = E.canAfford(state, f.price);
  openModal(`<div class="mbubble">商城 · 公共仓库</div><div class="buy-prev"><div class="furn-ico big" style="--fc:${f.color}">${furnInner(fid, 0)}</div></div>
    <div class="mtitle">${f.name}（${f.w}×${f.h} 格 · 豪华 +${f.lux}）</div>
    <table class="pv-table"><tr><td>价格</td><td>${fmt(f.price)}</td></tr><tr><td>当前余额</td><td>${fmt(bal)}</td></tr><tr><td>已有</td><td>${stt.owned}（摆出 ${stt.placed} / 仓库 ${stt.warehouse}）</td></tr><tr class="total"><td>买后余额</td><td class="${can ? '' : 'down'}">${can ? fmt(bal - f.price) : '还差 ' + fmt(f.price - bal)}</td></tr></table>
    <div class="mnote">买了进公共仓库，四家都能摆；一件同时只在一家。摆放 / 移动 / 收回 / 搬去别家都不花钱。</div>
    <div class="mbtns two"><button class="buy ghost" id="mNo">再想想</button><button class="buy red" id="hbYes" ${can ? '' : 'disabled'}>${can ? '确认购买' : '金币不够'}</button></div>`, false);
  $('#mNo').addEventListener('click', closeModal, { once:true });
  $('#hbYes').addEventListener('click', () => {
    const r = atomic(() => E.buyFurniture(state, fid)); closeModal();
    if (!r.ok) { if (r.why !== 'saveFailed') failBuy(null, r.why); return; }
    afterBuy(null, `${f.name} 已进公共仓库（仓库 ${r.count} 件）`);
  }, { once:true });
}
function confirmHomeUp(id) {
  const H = E.homeOf(state, id), c = E.CEO_BY_ID[id]; if (H.lv >= E.HOME_MAX) return;
  const T = E.homeTier(H.lv), N = E.HOME_TIERS[H.lv], bal = E.balance(state), can = E.canAfford(state, N.cost);
  openModal(`<div class="mbubble">房子升级</div><div class="mtitle">${c.name}：${T.name} → ${N.name}</div>
    <div class="mnote">${T.cols}×${T.rows} 格 → <b>${N.cols}×${N.rows} 格</b>，房型豪华 ${T.bonus} → ${N.bonus}。摆好的家具原位保留；挂画如果挡到新房的窗户 / 墙饰，会自动挪到空墙，挂不下就退回仓库，不会丢。</div>
    <table class="pv-table"><tr><td>价格</td><td>${fmt(N.cost)}</td></tr><tr><td>当前余额</td><td>${fmt(bal)}</td></tr><tr class="total"><td>升级后余额</td><td class="${can ? '' : 'down'}">${can ? fmt(bal - N.cost) : '还差 ' + fmt(N.cost - bal)}</td></tr></table>
    <div class="mbtns two"><button class="buy ghost" id="mNo">再想想</button><button class="buy red" id="huYes" ${can ? '' : 'disabled'}>${can ? '确认升级' : '金币不够'}</button></div>`, false);
  $('#mNo').addEventListener('click', closeModal, { once:true });
  $('#huYes').addEventListener('click', () => {
    const r = atomic(() => E.upgradeHome(state, id)); closeModal();
    if (!r.ok) { if (r.why !== 'saveFailed') failBuy(null, r.why); return; }
    afterBuy(null, `${c.name} 搬进${r.tier.name}啦！${r.tier.cols}×${r.tier.rows} 格`); sfx('mile');
    if (r.wallMoved || r.wallStored) setTimeout(() => toast(r.wallStored ? `新房墙面不一样：${r.wallMoved} 幅挂画挪到空墙，${r.wallStored} 幅挂不下已退回仓库` : `新房墙面不一样：${r.wallMoved} 幅挂画已挪到空墙`, 3200), 900);
  }, { once:true });
}
function homeCommit(r, msg) {
  if (!r.ok) { sfx('no'); if (!r.same) toast(r.why); return false; }
  if (r.undo) pushUndo(r.undo);
  persist(); sfx('tap'); if (msg) toast(msg); dirty = true; return true;
}
function homeAutoPlace(fid) {
  for (const rot of E.FURN_BY_ID[fid].wall ? [0] : [0, 1]) { const at = E.findFree(state, homeWho, fid, rot);   // 挂画自动挂不横转（不会侧着挂）；禁区和手动拖动同一份 canPlace
    if (at) { const r = E.placeItem(state, homeWho, fid, at.x, at.y, rot, at.surf); if (homeCommit(r)) homeSel = r.uid; return; } }
  sfx('no'); toast(E.FURN_BY_ID[fid].wall ? '墙面挂满了：先收一幅，或者换个位置' : '房间放不下了：先收回点东西，或者升级房子');
}
function homeAct(a, arg, b) {
  switch (a) {
    case 'homeGo': return setTab(arg);
    case 'homeMode': homeMode = arg === 'decor' ? 'decor' : 'live'; homeSel = null; if (homeDrag) homeEnd(); sfx('tap'); dirty = true; return;
    case 'homeSub': if (homeSub !== arg) { homeSub = arg; homeSel = null; pageFlip(arg === 'mall' ? 'next' : 'prev'); $('#panel').scrollTop = 0; sfx('swoosh'); } dirty = true; return;
    case 'homeWho': if (homeWho !== arg) { homeWho = arg; homeSel = null; sfx('tap'); } if (!E.homeOpen(state, arg)) toast('这位 CEO 还没加入'); dirty = true; return;
    case 'homeUp': return confirmHomeUp(arg);
    case 'homeBuy': return confirmHomeBuy(arg);
    case 'mallCat': mallCat = arg; if (arg !== 'cabinet') mallSub = 'all'; dirty = true; return;
    case 'mallSub': mallSub = arg; dirty = true; return;
    case 'mallClear': mallQ = ''; mallCat = 'all'; mallSub = 'all'; mallFilter = { afford:false, owned:false, price:'any', size:'any' }; dirty = true; return;
    case 'mallAff': mallFilter.afford = !!(typeof arg === 'boolean' ? arg : !mallFilter.afford); dirty = true; return;
    case 'mallOwn': mallFilter.owned = !!(typeof arg === 'boolean' ? arg : !mallFilter.owned); dirty = true; return;
    case 'mallPrice': mallFilter.price = arg || 'any'; dirty = true; return;
    case 'mallSize': mallFilter.size = arg || 'any'; dirty = true; return;
    case 'homeRot': { const r = E.rotateItem(state, homeWho, arg); homeCommit(r, r.ok && r.moved ? '转好了（挪了一点才放得下）' : null); return; }
    case 'homeStore': { const r = E.storeItem(state, homeWho, arg); if (homeCommit(r, r.ok ? E.FURN_BY_ID[r.undo.item.fid].name + ' 收回仓库' : null)) homeSel = null; return; }
    case 'homeUndo': { const st = undoStack(arg), u = st.pop(); const r = E.undoHome(state, u); if (r.ok) { persist(); sfx('swoosh'); toast('撤销了一步'); } else { sfx('no'); toast(r.why); } homeSel = null; dirty = true; return; }
  }
}
// ---- 拖动（pointer 事件：iPhone 触摸 / 鼠标通用；拖动中禁止页面滚动、暂停重画） ----
function homeCellAt(px, py, fid, rot, offX, offY, surf) {
  const f = E.FURN_BY_ID[fid], want = surf || (f && f.wall ? 'wall' : 'floor');
  const el = want === 'wall' ? ($('#wallGrid') || $('#roomWall')) : $('#roomFloor'); if (!el) return null;
  const r = el.getBoundingClientRect(), T = E.homeTier(E.homeOf(state, homeWho).lv);
  const rows = want === 'wall' ? E.WALL_ROWS : T.rows, cw = r.width / T.cols, ch = r.height / rows;
  const pad = want === 'wall' ? Math.max(cw, ch) * 0.8 : Math.max(cw, ch) * 0.5;
  const inside = px >= r.left - pad && px <= r.right + pad && py >= r.top - pad && py <= r.bottom + pad;
  return { inside, x:Math.round((px - r.left) / cw - offX), y:Math.round((py - r.top) / ch - offY), cw, ch, T, surf:want, rows };
}
function homeLiveTap(e) {
  const floor = $('#roomFloor'); if (!floor) return;
  const fEl = e.target.closest('#roomFloor .furn');
  const id = homeWho, T = E.homeTier(E.homeOf(state, id).lv), ac = homeActorOf(id);
  const go = (x, y, act) => {
    x = Math.max(0, Math.min(T.cols - 1, x | 0)); y = Math.max(0, Math.min(T.rows - 1, y | 0));
    ac.tx = x; ac.ty = y; ac.act = act || null; ac.line = liveLine(id, act || 'walk'); ac.until = clock + 2.4;
    sfx('tap'); dirty = true;
  };
  if (fEl) {
    const p = E.homeOf(state, id).placed.find(q => q.uid === fEl.dataset.uid); if (!p) return;
    const f = E.FURN_BY_ID[p.fid], sz = E.furnSize(p.fid, p.rot);
    const cx = p.x + Math.floor(sz.w / 2), cy = p.y + Math.floor(sz.h / 2);
    const act = E.furnLiveAct(p.fid);
    if (act === 'rest') return go(cx, Math.min(T.rows - 1, p.y + sz.h - 1), 'rest');
    if (act === 'read' || act === 'dress') return go(cx, Math.min(T.rows - 1, p.y + 1), act);
    return go(cx, cy, 'walk');
  }
  if (!e.target.closest('#roomFloor')) return;
  const r = floor.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / r.width * T.cols), y = Math.floor((e.clientY - r.top) / r.height * T.rows);
  go(x, y, 'walk');
}
function homeDown(e) {
  if (tab !== 'home' || homeSub !== 'room' || frozen || homeDrag) return;
  if (homeMode === 'live') {
    if (e.button > 0) return;
    if (e.target.closest('.mode-tabs, .room-tools, .book-tabs, .home-who, .tray-head, .mall-go, button')) return;
    e.preventDefault(); audioUnlock(); homeLiveTap(e); return;
  }
  const fEl = e.target.closest('#roomFloor .furn, #roomWall .furn'), iEl = e.target.closest('.inv-item');
  if (!fEl && !iEl) { if (homeSel && (e.target.closest('#roomFloor') || e.target.closest('#roomWall'))) { homeSel = null; dirty = true; } return; }
  if (e.button > 0) return;
  e.preventDefault(); audioUnlock();
  const H = E.homeOf(state, homeWho), T = E.homeTier(H.lv);
  let d;
  if (fEl) { const p = H.placed.find(q => q.uid === fEl.dataset.uid); if (!p) return; const sz = E.furnSize(p.fid, p.rot), surf = E.itemSurf(p);
    const el = surf === 'wall' ? ($('#wallGrid') || $('#roomWall')) : $('#roomFloor'), fr = el.getBoundingClientRect(), rows = surf === 'wall' ? E.WALL_ROWS : T.rows;
    const cw = fr.width / T.cols, ch = fr.height / rows;
    d = { src:'room', uid:p.uid, fid:p.fid, rot:p.rot, w:sz.w, h:sz.h, surf, offX:(e.clientX - fr.left) / cw - p.x, offY:(e.clientY - fr.top) / ch - p.y, el:fEl }; }
  else { const fid = iEl.dataset.fid, sz = E.furnSize(fid, 0), surf = E.FURN_BY_ID[fid].wall ? 'wall' : 'floor';
    d = { src:'inv', uid:null, fid, rot:0, w:sz.w, h:sz.h, surf, offX:sz.w / 2, offY:sz.h / 2, el:iEl }; }
  homeDrag = Object.assign(d, { id:e.pointerId, sx:e.clientX, sy:e.clientY, moved:false, ghost:null, cell:null });
  try { d.el.setPointerCapture(e.pointerId); } catch (x) {}
  window.addEventListener('pointermove', homeMove, { passive:false });
  window.addEventListener('pointerup', homeUp); window.addEventListener('pointercancel', homeCancel);
}
function homeMove(e) {
  const d = homeDrag; if (!d || e.pointerId !== d.id) return;
  e.preventDefault();
  if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 7) return;
  d.px = e.clientX; d.py = e.clientY; homeDragAt(d);
  if (d.moved && !d.raf) d.raf = requestAnimationFrame(() => homeAutoScroll(d));
}
// 手指拖到面板上下边缘：自动滚动，房间和仓库不在同一屏也能拖过去
function homeAutoScroll(d) {
  d.raf = 0; if (homeDrag !== d) return;
  const pn = $('#panel'), r = pn.getBoundingClientRect(), edge = 44;
  const v = d.py < r.top + edge ? -Math.ceil((r.top + edge - d.py) / 4) : d.py > r.bottom - edge ? Math.ceil((d.py - r.bottom + edge) / 4) : 0;
  if (v) { const before = pn.scrollTop; pn.scrollTop += Math.max(-14, Math.min(14, v)); if (pn.scrollTop !== before) homeDragAt(d); }
  d.raf = requestAnimationFrame(() => homeAutoScroll(d));
}
function homeDragAt(d) {
  const c = homeCellAt(d.px, d.py, d.fid, d.rot, d.offX, d.offY, d.surf); if (!c) return;
  if (!d.moved) { d.moved = true; homeSel = null;
    const g = document.createElement('div'); g.className = 'furn drag-ghost' + (E.FURN_BY_ID[d.fid].layer === 'rug' ? ' rug' : '') + (E.FURN_BY_ID[d.fid].wall ? ' wallf' : '') + (furnTall(d.fid) ? ' tall' : '');
    g.style.cssText = `width:${d.w * c.cw}px;height:${d.h * c.ch}px;--fc:${E.FURN_BY_ID[d.fid].color}`; g.innerHTML = furnInner(d.fid, d.rot, true);
    document.body.appendChild(g); d.ghost = g; if (d.src === 'room') d.el.classList.add('lifting');
    if (d.surf === 'wall') { const wg = $('#wallGrid'); if (wg) wg.classList.add('show-block'); } }
  d.ghost.style.left = (d.px - d.offX * c.cw) + 'px'; d.ghost.style.top = (d.py - d.offY * c.ch) + 'px';
  const hlFloor = $('#roomHl'), hlWall = $('#wallHl'), hl = c.surf === 'wall' ? hlWall : hlFloor;
  if (hlFloor) hlFloor.classList.add('hidden'); if (hlWall) hlWall.classList.add('hidden');
  d.cell = c.inside ? c : null;
  if (!c.inside || !hl) { d.ghost.classList.remove('ok', 'bad'); return; }
  const v = E.canPlace(state, homeWho, d.fid, c.x, c.y, d.rot, d.uid, c.surf); d.valid = v;
  const cx = Math.max(-d.w + 1, Math.min(c.T.cols - 1, c.x)), cy = Math.max(-d.h + 1, Math.min(c.rows - 1, c.y));
  hl.style.cssText = `left:${cx / c.T.cols * 100}%;top:${cy / c.rows * 100}%;width:${d.w / c.T.cols * 100}%;height:${d.h / c.rows * 100}%`;
  hl.className = 'room-hl ' + (v.ok ? 'ok' : 'bad'); d.ghost.classList.toggle('ok', v.ok); d.ghost.classList.toggle('bad', !v.ok);
}
function homeEnd() {
  const d = homeDrag; homeDrag = null;
  if (d && d.raf) { cancelAnimationFrame(d.raf); d.raf = 0; }
  window.removeEventListener('pointermove', homeMove); window.removeEventListener('pointerup', homeUp); window.removeEventListener('pointercancel', homeCancel);
  if (d && d.ghost) d.ghost.remove();
  const wg = $('#wallGrid'); if (wg) wg.classList.remove('show-block');
  return d;
}
function homeUp(e) {
  const d = homeDrag; if (!d || e.pointerId !== d.id) return;
  if (d.moved) homeMove(e);
  homeEnd();
  if (!d.moved) {   // 轻点：家具 → 选中/取消；仓库 → 自动找空位
    if (d.src === 'room') { homeSel = homeSel === d.uid ? null : d.uid; sfx('tap'); }
    else homeAutoPlace(d.fid);
  } else if (!d.cell) { sfx('no'); const nm = E.FURN_BY_ID[d.fid].name;
    toast(d.surf === 'wall' ? nm + '只能放墙面' + (d.src === 'room' ? '，放回原位' : '') : d.src === 'inv' ? '拖到房间的格子里才能放' : '拖出房间了，放回原位'); }
  else if (!d.valid || !d.valid.ok) { sfx('no'); toast((d.valid && d.valid.why) || '放不下'); }
  else if (d.src === 'inv') { const r = E.placeItem(state, homeWho, d.fid, d.cell.x, d.cell.y, d.rot, d.cell.surf); if (homeCommit(r)) homeSel = r.uid; }
  else { homeCommit(E.moveItem(state, homeWho, d.uid, d.cell.x, d.cell.y)); homeSel = d.uid; }
  dirty = true; renderTab();
}
function homeCancel(e) { const d = homeDrag; if (!d || e.pointerId !== d.id) return; homeEnd(); dirty = true; renderTab(); }
tabBody.addEventListener('pointerdown', homeDown);
tabBody.addEventListener('input', e => {
  const t = e.target; if (!t) return;
  if (t.id === 'mallSearch') { mallQ = t.value || ''; dirty = true; /* 保留光标：只重画列表区 */ renderMallLive(); }
});
tabBody.addEventListener('change', e => {
  const t = e.target; if (!t || !t.dataset || !t.dataset.act) return;
  if (t.dataset.act === 'mallPrice' || t.dataset.act === 'mallSize') { homeAct(t.dataset.act, t.value); renderTab(); }
  if (t.type === 'checkbox' && (t.dataset.act === 'mallAff' || t.dataset.act === 'mallOwn')) { /* click on label 也会触发 click handler */ }
});
function renderMallLive() {
  if (tab !== 'home' || homeSub !== 'mall') return;
  const keep = document.activeElement && document.activeElement.id === 'mallSearch' ? document.activeElement.selectionStart : null;
  renderTab();
  const inp = $('#mallSearch'); if (inp && keep != null) { inp.focus(); try { inp.setSelectionRange(keep, keep); } catch (e) {} }
}

document.addEventListener('touchmove', e => { if (homeDrag) e.preventDefault(); }, { passive:false });
function pageFlip(dir) {
  ['#panel', '#compactHead'].forEach(s => { const el = $(s); if (!el) return; el.classList.remove('flip-next', 'flip-prev'); void el.offsetWidth; el.classList.add('flip-' + dir); });
  clearTimeout(pageFlip.t); pageFlip.t = setTimeout(() => ['#panel', '#compactHead'].forEach(s => { const el = $(s); if (el) el.classList.remove('flip-next', 'flip-prev'); }), 500);
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
tabBody.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (!b || b.disabled || frozen) return; if (b.tagName === 'SELECT' || (b.tagName === 'INPUT' && b.type === 'search')) return; audioUnlock(); const arg = (b.type === 'checkbox') ? b.checked : b.dataset.arg; act(b.dataset.act, arg, b); });
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

function onHide() { if (frozen) return; tick(); if (order) order = null; /* 离线不结算进行中的团单，避免和离线收益纠缠 */ special = null; state.lastSeen = now(); persist(); audioPause(); }
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
// 店景区尺寸变了（切回「经营」、App 内置浏览器工具栏收起/展开）就重算画布，避免画布停在 0 高度
if (window.ResizeObserver) new ResizeObserver(() => { const r = cv.getBoundingClientRect(); if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) resize(); }).observe($('#stage'));
window.addEventListener('pageshow', () => resize());

let lastFrame = performance.now(), dynAcc = 0, saveAcc = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - lastFrame) / 1000); lastFrame = ts; clock = ts / 1000;
  if (frozen) return;
  tick(); updateBig(); updateGuests(dt); updateSupers();
  if (focusT > 0) focusT -= dt; if (shake > 0) shake = Math.max(0, shake - dt * 1.5);
  if (clock > nextBubbleAt) { nextBubbleAt = clock + 9 + Math.random() * 7; const i = state.cur;
    if (state.shops[i].open) { const cid = E.ceoAt(state, i); if (Math.random() < 0.5 && cid) sayLine('c', Math.random() < 0.5 ? E.CEO_BY_ID[cid].line : E.SIGNS[cid][i][1]); else if (state.shops[i].emp > 0) sayLine('e', E.SHOPS[i].emp.line); } }
  render(clock);
  dynAcc += dt; if (dynAcc > 0.25) { dynAcc = 0; refreshDynamic(); }
  // 家宅生活：CEO 走向目标格（只改小人 DOM，不整页重画）
  if (tab === 'home' && homeSub === 'room' && homeMode === 'live') {
    const ac = homeActorOf(homeWho), el = $('#homeActor'), T = E.homeTier(E.homeOf(state, homeWho).lv);
    if (ac.tx != null) {
      const spd = 2.8 * dt, dx = ac.tx - ac.x, dy = ac.ty - ac.y, d = Math.hypot(dx, dy);
      if (d < 0.05) { ac.x = ac.tx; ac.y = ac.ty; ac.tx = ac.ty = null; }
      else { ac.x += dx / d * Math.min(spd, d); ac.y += dy / d * Math.min(spd, d); }
      if (el) { el.style.left = ((ac.x + 0.5) / T.cols * 100) + '%'; el.style.top = ((ac.y + 0.5) / T.rows * 100) + '%'; }
    } else if (ac.line && ac.until < clock) { ac.line = ''; ac.act = null; if (el) { const b = el.querySelector('.ha-line'), i = el.querySelector('.ha-act'); if (b) b.remove(); if (i) i.textContent = ''; } }
  }
  if (dirty) renderTab();
  saveAcc += dt; if (saveAcc > 5) { saveAcc = 0; persist(); }
}

function boot() {
  state = loadState(); claimLock();
  if (!TEST_MODE && !saveBlocked) { E.normWallet(state); lastGood = JSON.stringify(state); }
  $('#mute').classList.toggle('off', !!state.muted);
  resize();
  const first = !state.taps && !state.totalEarned && !state.earnedFrac && state.shops[0].emp === 0;
  const fpMig = E.migrateFootprints(state);
  const wallMig0 = E.migrateWallPaintings(state);   // 读档时已在 E.migrate 里整理过一次，这里通常是 0；两次加起来如实提示
  const wallMig = { moved:loadWallMig.moved + wallMig0.moved, stored:loadWallMig.stored + wallMig0.stored };
  const p = E.settleOffline(state, now(), rid);
  persist();
  scheduleBig(); scheduleSpecial(); renderTabs(); setTab(TEST_MODE ? 'home' : 'shop');
  if (TEST_MODE) { const b = document.createElement('div'); b.id = 'testBadge'; b.textContent = '测试房间 · ' + (TEST_LV === 3 ? '豪宅' : '公寓') + ' · 不存档，刷新重置'; document.body.appendChild(b);
    const place = () => { const n = $('#bottomNav'); if (n) b.style.bottom = Math.max(8, innerHeight - n.getBoundingClientRect().top + 6) + 'px'; }; place(); addEventListener('resize', place); }
  if (loadInfo.source === 'bak') toast('存档里的金币 / 等级数据坏了（' + loadInfo.bad.slice(0, 3).join('、') + '），已从完整备份恢复', 3600);
  if (saveBlocked && loadInfo.unsafe) { const sb = document.createElement('div'); sb.id = 'saveBadge'; sb.textContent = '存档余额异常（超出安全整数）：交易已暂停、不保存，原存档未覆盖'; sb.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 6px);z-index:60;padding:6px 10px;border:2px solid #141414;border-radius:10px;background:#ffd6d6;font-size:12px;font-weight:700;text-align:center;pointer-events:none';
    document.body.appendChild(sb); queueModal(() => { openModal(`<div class="mbubble">存档余额异常</div><div class="mtitle">余额超出能精确计算的范围</div><div class="mnote">存档里的余额是 <b>${String(loadInfo.rawCoins)}</b>，超过了 ${fmt(E.SAFE_COINS)}（安全整数上限），加减会算不准，不能当正常钱包用。为了不出错：<b>所有买卖和收入都已暂停，这次不会自动保存</b>，原存档原样保留、没有被覆盖。${loadInfo.bakOk ? `备份里有一份正常存档（余额 ${fmt(loadInfo.bakCoins)}），没有自动替换，请联系熊二 / 熊大确认后再恢复。` : '没有找到可用的备份，请联系熊二 / 熊大。'}</div><div class="mbtns"><button class="buy" id="mOk">知道了</button></div>`, false); $('#mOk').addEventListener('click', closeModal, { once:true }); }); }
  else if (saveBlocked) { const sb = document.createElement('div'); sb.id = 'saveBadge'; sb.textContent = '存档损坏、没有可用备份：本次不保存，原存档未覆盖'; sb.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top) + 6px);z-index:60;padding:6px 10px;border:2px solid #141414;border-radius:10px;background:#ffd6d6;font-size:12px;font-weight:700;text-align:center;pointer-events:none';
    document.body.appendChild(sb); queueModal(() => { openModal(`<div class="mbubble">存档读不出来</div><div class="mtitle">金币 / 等级数据坏了，也没有可用备份</div><div class="mnote">为了不把原存档盖掉，这次游戏<b>不会自动保存</b>（坏字段：${loadInfo.bad.slice(0, 4).join('、')}）。请把情况告诉熊二 / 熊大。</div><div class="mbtns"><button class="buy" id="mOk">知道了</button></div>`, false); $('#mOk').addEventListener('click', closeModal, { once:true }); }); }
  if (loadInfo.badPending) toast('离线收益数据异常，这一笔没有入账（余额不变）', 3200);
  if (migratedFrom != null) toast('存档已升级到 v' + CFG.SAVE_VERSION + '（新盲盒 + CEO 穿搭，收藏都保留）', 2600);
  if (fpMig && !fpMig.skipped && (fpMig.shifted || fpMig.stored)) toast(fpMig.stored ? `家具占地收紧：${fpMig.shifted} 件按脚底重锚，${fpMig.stored} 件腾不出空位已退回仓库` : `家具占地收紧：${fpMig.shifted} 件已按脚底重锚`, 3200);
  if (wallMig && (wallMig.moved || wallMig.stored)) toast(wallMig.stored ? `墙面整理：${wallMig.moved} 幅挂画挪到空墙，${wallMig.stored} 幅墙面没空已退回仓库` : `墙面整理：${wallMig.moved} 幅挂画已挪到空墙`, 3200);
  if (p && p.rolledBack) toast('检测到手机时间被往回调，这段时间不发离线收益');
  if (first) queueModal(showIntro);
  if (state.pending) queueModal(showOffline);
  if (state.gacha.last && !state.gacha.last.seen) queueModal(() => showReveal(true));
  lastFrame = performance.now();
  requestAnimationFrame(frame);
}
boot();

// 测试/调试钩子（不影响玩家）
window.__tzz = { TEST_MODE, TEST_LV, SAVE_KEY, BAK_KEY, get saveBlocked() { return saveBlocked; }, get loadInfo() { return loadInfo; }, restoreGood, earn, doUpgradeShop, shopUpgradeCount, get buyAmt() { return buyAmt; }, E, FURN_SIDE, furnInner, get combo() { return combo; }, get critFx() { return critFx; }, critLine, refreshCrit, showComic, showCrossBig, queueModal, CROSS_ART, crossURL, showCeoJoin, get state() { return state; }, set state(v) { state = v; }, persist, onReturn, tapShop, act, setTab, switchShop, renderTab,
  forceBig() { nextBigAt = 0; if (order) order = null; }, clearVisitors() { order = null; special = null; nextBigAt = clock + 9999; nextSpecialAt = clock + 9999; }, forceSpecial() { nextSpecialAt = 0; special = null; },
  forceSupers() { for (const k in superNext) superNext[k] = 0; updateSupers(); renderTab(); },
  get big() { return order; }, get order() { return order; }, get special() { return special; }, get guests() { return guests; },
  hitBig, modalOpen, closeModal, get frozen() { return frozen; },
  audioState() { return AU.ctx ? AU.ctx.state : 'none'; }, showPreview, openAssign, JOB_ART, jobShown, jobURL, showJobArt,
  HOME_ART, FURN_ART, FURN_UP, homeAct, get homeWho() { return homeWho; }, get homeSub() { return homeSub; }, get homeMode() { return homeMode; }, set homeMode(v) { homeMode = v === 'decor' ? 'decor' : 'live'; }, get homeSel() { return homeSel; }, get homeDrag() { return homeDrag; }, homeActor, LIVE_LINES, homeUndo, resize, get canvasSize() { return { W, H }; }, lookOf, drawPerson, drawHead, LOOKS, get bubble() { return bubble; } };
})();
