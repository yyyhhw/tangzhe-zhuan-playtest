'use strict';
// 科技公司塔防（样品）：一张地图、8 种塔（4 通用 + 4 CEO 塔）、4 位统帅可选。
// 单独打开 = 原型模式（模拟余额，只存 PROTO_KEY）；?embed=1 嵌在经营页里 = 金币、升级、进度都由经营页管（td:* postMessage），本页不写任何存档。
(() => {
const T = window.TDCore, SFX = window.ZBSfx;
const EMBED = /[?&]embed=1(&|$)/.test(location.search) && window.parent !== window;
const PROTO_KEY = 'tangzhe-td-proto';
const $ = s => document.querySelector(s);
const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const INK = '#141414', PAPER = '#f7f1e3', RED = '#e63946', YEL = '#ffd23f';

// ---- 地图：7×11 格，一条 S 形路（格坐标；-1 / 11 = 场外入口 / 出口）----
const COLS = 7, ROWS = 11;
const WAY = [[-1, 1], [5, 1], [5, 4], [1, 4], [1, 7], [5, 7], [5, 11]];
const PATH = new Set(), SEG = [];
let PLEN = 0;
for (let i = 0; i < WAY.length - 1; i++) {
  const [x0, y0] = WAY[i], [x1, y1] = WAY[i + 1], dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
  for (let x = x0, y = y0; ; x += dx, y += dy) { if (x >= 0 && x < COLS && y >= 0 && y < ROWS) PATH.add(x + ',' + y); if (x === x1 && y === y1) break; }
  const l = Math.abs(x1 - x0) + Math.abs(y1 - y0); SEG.push(l); PLEN += l;
}
function posAt(d) {
  for (let i = 0; i < SEG.length; i++) {
    if (d <= SEG[i] || i === SEG.length - 1) { const a = WAY[i], b = WAY[i + 1], t = Math.max(0, Math.min(1, d / SEG[i])); return [a[0] + (b[0] - a[0]) * t + 0.5, a[1] + (b[1] - a[1]) * t + 0.5]; }
    d -= SEG[i];
  }
}
const isPath = (x, y) => PATH.has(x + ',' + y);

// ---- 可调参数（距离单位 = 格，rate = 出手间隔秒）----
// 防连锁：燃烧跳伤不再触发燃烧 / 暴击；弹跳、链电、穿透都有次数上限；击杀不触发任何额外攻击
const P = {
  bbq:     { k: '烤', range: 1.9, rate: 0.9, dmg: 10, col: '#e8590c', kind: 'cone', arc: 70, burn: 0.25, burnT: 2, desc: '扇形火攻，带轻微灼烧' },
  tea:     { k: '茶', range: 1.7, rate: 0.9, dmg: 3,  col: '#7fd1e8', kind: 'aura', slow: 0.45, slowT: 1.2, desc: '范围减速' },
  book:    { k: '书', range: 2.8, rate: 1.0, dmg: 14, col: '#2e7d32', kind: 'pierce', pierce: 4, width: 0.4, desc: '书页直线穿透（最多 4 只）' },
  tech:    { k: '电', range: 2.4, rate: 0.8, dmg: 13, col: '#c13ce0', kind: 'chain', chain: 3, jump: 1.6, fall: 0.75, desc: '链电，最多跳 3 只' },
  t77:     { k: '串', range: 2.5, rate: 0.8, dmg: 12, col: RED,       kind: 'burn', burn: 0.6, burnT: 3, synBurn: 2, synBurnT: 4, desc: '飞串命中持续燃烧', syn: '统帅 77：燃烧伤害 ×2、烧 4 秒' },
  tpearl:  { k: '珠', range: 2.4, rate: 0.7, dmg: 12, col: '#6d4c41', kind: 'bounce', bounce: 2, synBounce: 1, jump: 1.8, fall: 0.85, desc: '珍珠弹跳 2 次', syn: '统帅珍珠姐：多弹 1 次' },
  totaku:  { k: '漫', range: 2.4, rate: 1.1, dmg: 14, col: '#3949ab', kind: 'boomerang', back: 0.6, width: 0.45, synBack: 1, synWidth: 0.7, desc: '回旋漫画：去程回程都打', syn: '统帅阿宅：回程满伤、更宽' },
  trocket: { k: '箭', range: 3.2, rate: 1.5, dmg: 26, col: '#ff7043', kind: 'splash', rad: 0.9, synRad: 1.35, desc: '火箭范围爆炸', syn: '统帅火箭老板：爆炸范围 ×1.5' },
};
const TW = P;
// 统帅：自己的普攻 / 大招 + 一项对全场塔生效的全局技能
const CMD = {
  c77:    { range: 2.6, rate: 0.55, dmg: 12, n: 2, col: RED,       g: { dmg: 1.15, burn: 0.12, burnT: 2 }, gDesc: '全场塔伤害 +15%，命中附带燃烧', desc: '普攻飞串穿 2 只；大招火圈烧身边一圈' },
  pearl:  { range: 2.5, rate: 0.5,  dmg: 10, n: 2, col: '#6d4c41', g: { rate: 0.82 }, gDesc: '全场塔出手间隔 ×0.82（攻速约 +21.95%）', desc: '普攻珍珠弹跳 2 下；大招冰沙风暴冻住全场' },
  otaku:  { range: 2.2, rate: 0.7,  dmg: 11, n: 3, col: '#3949ab', g: { range: 0.45 }, gDesc: '全场塔射程 +0.45 格', desc: '普攻回旋漫画打 3 只；大招分镜轰炸乱砸全场' },
  rocket: { range: 3.0, rate: 0.75, dmg: 16, n: 1, col: '#ff7043', g: { crit: 0.18, critX: 2.2 }, gDesc: '全场塔 18% 暴击（×2.2 爆发）', desc: '普攻迷你火箭带溅射；大招星舰冲击波全场重击并击退' },
};
const TIDS = T.TOWER_IDS;
const MAX_TLV = 3;
const upCost = tw => Math.round(T.TOWERS[tw.id].cost * 0.8 * tw.lv);
const sellBack = tw => Math.round(tw.spent * 0.6);
const EN = { walk: { hp: 30, sp: 1.0, r: 0.28, cash: 5, col: '#7cb342' }, fast: { hp: 18, sp: 1.8, r: 0.22, cash: 4, col: '#fdd835' }, tank: { hp: 110, sp: 0.6, r: 0.36, cash: 12, col: '#6d4c41' },
  mini: { hp: 600, sp: 0.5, r: 0.42, cash: 50, col: '#ad1457', lives: 3 }, boss: { hp: 2200, sp: 0.42, r: 0.5, cash: 100, col: '#8e24aa', lives: 10 } };
const hpMul = w => 1.17 ** w;
const LIVES = 20, START_PTS = 160, ULT_E = 100;
function waveList(w) {
  const q = [], cnt = 7 + 2 * w;
  for (let i = 0; i < cnt; i++) q.push(w >= 1 && i % 3 === 2 ? 'fast' : 'walk');
  for (let i = 0; i < Math.floor(w / 2); i++) q.push('tank');
  if (w === 4) q.push('mini');
  if (w === T.WAVES - 1) q.push('boss');
  return q;
}

const num = n => Number(n.toFixed(2));
function cmdDetail(id) {
  const s = CMD[id], lv = proto.lv['cmd_' + id], dmg = num(s.dmg * 1.15 ** lv);
  const attack = {c77:'优先前进最远的 2 个目标',pearl:'首击后最多弹跳 2 次，每跳 1.8 格',otaku:'优先前进最远的 3 个目标',rocket:'命中点半径 0.7 格溅射'}[id];
  const ult = {c77:'支援位周围 2.4 格：70 伤害，附 10/秒燃烧 3 秒',pearl:'全场 10 伤害；普通敌人冻结 3 秒，Boss 减速 50% 持续 3 秒',otaku:'随机目标共 20 次轰炸，每次 30 伤害（可能重复目标）',rocket:'全场 45 伤害，击退 1.5 格'}[id];
  return `固定入口支援位（2.5,1.5），自动攻击 ${dmg} / ${s.rate} 秒，范围 ${s.range} 格；${attack}。<br>满 100 能量自动${T.HEROES[id].ult}：${ult}；技能伤害当前升级 ×${num(1.2 ** lv)}。每秒 +1.5 能量、击杀 +4；无有效目标保留能量。支援伤害每波 ×1.1、技能伤害每波 ×1.17（首波为基准）。`;
}
function towerDetail(id, lv = 1) {
  const s = TW[id], g = gl(), syn = T.TOWERS[id].ceo === G.cmd;
  const dmg = s.dmg * tDmg(id) * (1 + .5 * (lv - 1)) * (g.dmg || 1);
  const extra = {cone:`70°扇形；燃烧 ${num(dmg*s.burn)}/秒 ×${s.burnT}秒`,aura:`范围内全体；减速 ${num(Math.min(.75,s.slow+.01*proto.lv.tea)*100)}% ×${s.slowT}秒`,pierce:`直线最多 ${s.pierce} 只；半宽 ${s.width} 格，线长为射程 +0.5 格`,chain:`首击 +${s.chain} 次跳跃；跳距 ${s.jump} 格；逐跳伤害 ×${s.fall}`,burn:`燃烧 ${num(dmg*(s.burn*(syn?s.synBurn:1)+(g.burn||0)))}/秒 ×${syn?s.synBurnT:s.burnT}秒`,bounce:`首击 +${s.bounce+(syn?s.synBounce:0)} 次弹跳；跳距 ${s.jump} 格；逐跳伤害 ×${s.fall}`,boomerang:`去程 ${num(dmg)} + 回程 ${num(dmg*(syn?s.synBack:s.back))}；半宽 ${syn?s.synWidth:s.width} 格；沿线全部`,splash:`命中点半径 ${syn?s.synRad:s.rad} 格内全体`}[s.kind];
  return `<b>${T.TOWERS[id].name} · Lv${lv}</b><br>目标：地面敌人（含 Boss），优先最前方<br>伤害 ${num(dmg)} · 间隔 ${num(s.rate*(g.rate||1))}秒 · 范围 ${num(towerRange({id,lv}))}格<br>${extra}${g.burn && !['burn','cone'].includes(s.kind)?`；命中燃烧 ${num(dmg*g.burn)}/秒 ×${g.burnT}秒（回程除外）`:''}${g.crit?`；${g.crit*100}% 暴击 ×${g.critX}（以上为非暴击）`:''}${syn?'<br>★ '+s.syn.split('：')[1]:''}`;
}

// ---- 金币 / 存档（原型）----
function loadProto() {
  if (EMBED) return Object.assign({ coins: 0, ready: false, blocked: false }, T.norm(null));
  let raw = null; try { raw = JSON.parse(localStorage.getItem(PROTO_KEY) || 'null'); } catch (e) { raw = null; }
  const p = Object.assign({ coins: 5e10, ready: true, blocked: false }, T.norm(raw));
  if (raw && typeof raw === 'object') p.coins = Math.max(0, Math.min(1e15, fin(raw.coins, 5e10)));
  return p;
}
const proto = loadProto();
const saveProto = () => { if (EMBED) return; try { localStorage.setItem(PROTO_KEY, JSON.stringify(proto)); } catch (e) {} };
let cmdSel = proto.cmd, lvSel = 1;
let pend = false, port = null, lastSent = null, buyRequest = null, buyTimer = null, buyTimedOut = false, cmdRestored = false;
const host = m => { lastSent = m; if (port) port.postMessage(m); };
const canSpend = n => proto.ready && !pend && !proto.blocked && isFinite(n) && n > 0 && proto.coins >= n;
if (EMBED) window.addEventListener('message', e => {
  if (port || e.source !== window.parent || e.origin !== location.origin || !e.data || e.data.td !== 'port' || !e.ports[0]) return;
  port = e.ports[0]; port.onmessage = ev => onState(ev.data); host({ td: 'hello' });
});
let hostMute = false, userMute = false;
function bgmOk() { return !hostMute && !userMute && !!G && !G.over && !G.pendStart && !paused && !document.hidden; }
function bgmTry() { if (bgmOk()) SFX.startBgm(G.n * 5); }
function applyMute() { SFX.setMuted(hostMute || userMute); bgmTry(); $('#sndBtn').textContent = hostMute ? '经营页已静音' : userMute ? '声音：关' : '声音：开'; }
function onState(d) {
  if (!d || d.td !== 'state') return;
  if (d.ack === 'buy' && (!buyRequest || d.requestId !== buyRequest.requestId || d.id !== buyRequest.id)) return;
  if (d.ack === 'start' && (!G || !G.pendStart || d.runId !== G.runId)) return;
  if (d.ack === 'result' && (!G || !G.over || !G.resMsg || d.runId !== G.runId || (G.saveOk && d.ok !== true))) return;
  if (d.ack === 'buy' && buyRequest && d.requestId === buyRequest.requestId && d.id === buyRequest.id) {
    clearTimeout(buyTimer); pend = false; buyRequest = null; buyTimedOut = false;
    if (!d.ok) toast(d.why || '升级没有生效');
  }
  if (EMBED && !cmdRestored && d.z) { cmdSel = T.norm(d.z).cmd; cmdRestored = true; }
  proto.coins = Math.max(0, fin(d.coins, 0)); proto.blocked = !!d.blocked; Object.assign(proto, T.norm(d.z)); proto.ready = true;
  if ('muted' in d) { hostMute = !!d.muted; applyMute(); }
  if (d.ack === 'start' && G && G.pendStart && d.runId === G.runId) {
    clearTimeout(G.startTO);
    if (d.ok === true) { G.pendStart = false; bgmTry(); } else abortStart(d.why || '开局没登记上');
  }
  if (d.ack === 'result' && G && G.over && G.resMsg && d.runId === G.runId) { clearTimeout(G.resultTO); G.wait = false; G.saveOk = d.ok === true; G.why = d.why || ''; renderResult(); }
  lvSel = Math.max(1, Math.min(lvSel, proto.cleared + 1, T.MAX_LV));
  if (!G) renderMenu();
}

// ---- 菜单 ----
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿' : n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万' : String(Math.floor(n));
const upName = id => id.startsWith('cmd_') ? T.HEROES[id.slice(4)].name : T.TOWERS[id].name;
const upDesc = (id, lv) => id.startsWith('cmd_') ? `自动支援 ×${(1.15 ** lv).toFixed(2)} · 满能技能 ×${(1.2 ** lv).toFixed(2)}` : `伤害 ×${(1.15 ** lv).toFixed(2)} · ${TW[id].desc}`;
function upRow(id) {
  const lv = proto.lv[id], max = lv >= T.MAX_UP, p = T.price(id, lv);
  return `<div class="tr"><div class="t"><b>${upName(id)} Lv${lv}</b><small>${upDesc(id, lv)}${!id.startsWith('cmd_') && TW[id].syn ? '<br>★ ' + TW[id].syn : ''}</small></div><button class="buy" data-up="${id}" type="button" ${max || !canSpend(p) ? 'disabled' : ''}>${max ? '满级' : fmt(p) + ' 金币'}</button></div>`;
}
function renderMenu() {
  const h = T.HEROES[cmdSel];
  $('#heroImg').src = `../art/face_${cmdSel}.webp`; $('#heroImg').alt = h.name;
  $('#heroName').textContent = `统帅：${h.name}`;
  $('#heroDesc').innerHTML = `<b>被动</b>：${CMD[cmdSel].gDesc}；同名塔「${T.TOWERS[h.tower].name}」${TW[h.tower].syn.split('：')[1]}。<br>${cmdDetail(cmdSel)}<br>无需移动或施法；选塔查看属性，点地图预览后确认建造。`;
  $('#cmdPick').innerHTML = T.CEO_IDS.map(id => `<button type="button" data-cmd="${id}" class="${id === cmdSel ? 'on' : ''}"><img src="../art/face_${id}.webp" alt="">${T.HEROES[id].name}</button>`).join('');
  $('#lvTxt').textContent = `第 ${lvSel} 关`;
  $('#lvTxt').textContent = T.MAX_LV > 1 ? `第 ${lvSel} 关` : '科技园区';
  $('#lvInfo').textContent = `${T.WAVES} 波 · 第 5 波小 Boss · 第 10 波 Boss`;
  $('#lvProg').textContent = proto.cleared ? '已通关 ✓' : `最佳 ${proto.best}/${T.WAVES} 波`;
  $('#lvPrev').classList.toggle('hidden', T.MAX_LV <= 1); $('#lvNext').classList.toggle('hidden', T.MAX_LV <= 1);
  $('#lvPrev').disabled = lvSel <= 1; $('#lvNext').disabled = lvSel >= Math.min(T.MAX_LV, proto.cleared + 1);
  $('#walletLbl').textContent = EMBED ? '经营金币' : '模拟余额';
  $('#walletTxt').textContent = proto.ready ? fmt(proto.coins) : '…';
  $('#upNote').textContent = !EMBED ? '单独打开是原型模式：用模拟金币，不碰经营存档。局内造塔用建设点，每局重置。' : proto.blocked ? '存档异常（只读），现在不能升级' : '花的是经营金币；塔防本身不产金币。';
  $('#upTowers').innerHTML = TIDS.map(upRow).join('');
  $('#upCmds').innerHTML = T.CEO_IDS.map(id => upRow('cmd_' + id)).join('');
  $('#exitBtn').classList.toggle('hidden', !EMBED);
  $('#startBtn').disabled = !proto.ready || proto.blocked || pend;
  $('#buyRetryBtn').classList.toggle('hidden', !buyTimedOut);
}
function buyUp(id) {
  if (!T.IDS.includes(id)) return false;
  const lv = proto.lv[id]; if (lv >= T.MAX_UP) return false;
  const p = T.price(id, lv); if (!canSpend(p)) return false;
  if (EMBED) { pend = true; buyRequest = { td:'buy', id, requestId:'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) }; sendBuy(); renderMenu(); return true; }
  proto.coins -= p; proto.lv[id] = lv + 1; saveProto(); renderMenu(); return true;
}
function sendBuy() {
  if (!buyRequest) return;
  buyTimedOut = false; host(buyRequest); clearTimeout(buyTimer);
  buyTimer = setTimeout(() => { if (!buyRequest) return; buyTimedOut = true; renderMenu(); toast('升级确认超时，可重试确认；不会重复扣款'); }, 4000);
}
$('#buyRetryBtn').onclick = () => { sendBuy(); renderMenu(); };
$('#menu').addEventListener('click', e => {
  SFX.unlock();
  const u = e.target.closest('[data-up]'); if (u) return buyUp(u.dataset.up);
  const c = e.target.closest('[data-cmd]'); if (c) { cmdSel = c.dataset.cmd; if (!EMBED) { proto.cmd = cmdSel; saveProto(); } renderMenu(); }
});
$('#lvPrev').onclick = () => { lvSel = Math.max(1, lvSel - 1); renderMenu(); };
$('#lvNext').onclick = () => { lvSel = Math.min(T.MAX_LV, proto.cleared + 1, lvSel + 1); renderMenu(); };
$('#exitBtn').onclick = () => host({ td: 'close' });

// ---- 一局 ----
let G = null, paused = false, raf = 0, last = 0, sel = null;
const tDmg = id => 1.15 ** proto.lv[id];
const gl = () => CMD[G.cmd].g;
function start(n) {
  if (EMBED && (proto.blocked || pend)) return false;
  n = Math.max(1, Math.min(T.MAX_LV, proto.cleared + 1, Math.floor(fin(n, lvSel))));
  if (!proto.ready) return false;
  SFX.unlock();
  const c = posAt(2);
  G = { n, cmd: cmdSel, W: T.WAVES, wave: 0, q: [], spawnT: 0, breakT: 5, es: [], tw: new Map(), fx: [], lives: LIVES, cash: START_PTS, kills: 0, t: 0, energy: 0,
    c: { x: c[0], y: c[1], tx: c[0], ty: c[1], cd: 0 }, over: false, win: false, runId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), pendStart: EMBED };
  if (EMBED) { const game = G; host({ td: 'start', runId: G.runId, n, cmd: G.cmd }); G.startTO = setTimeout(() => { if (G === game && G.pendStart) abortStart('开局登记超时'); }, 4000); }
  paused = false; SFX.setPaused(false); sel = {k:'build',id:null,x:null,y:null}; show(null); bar(); resize(); hud(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); bgmTry();
  return true;
}
function abortStart(why) { SFX.stopBgm(); G = null; show('#menu'); renderMenu(); toast(why); }
function nextWave() {
  if (!G || G.over || G.pendStart || G.wave >= G.W || G.q.length || alive().length || G.breakT > 0 || paused) return;
  G.q = waveList(G.wave); G.wave++; G.breakT = 0; G.spawnT = 0; SFX.cue('wave'); toast(`第 ${G.wave} 波`); bar();
}
function spawn(type) {
  const b = EN[type], hp = b.hp * hpMul(G.wave - 1);
  G.es.push({ type, d: 0, hp, max: hp, sp: b.sp, r: b.r, slowT: 0, slowK: 1, stunT: 0, burnT: 0, burnD: 0, x: -0.5, y: 1.5 });
}
const alive = () => G.es.filter(e => e.hp > 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function inRange(p, r) { return alive().filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= r).sort((a, b) => b.d - a.d); }
function hit(e, dmg, o) {
  if (!e || e.hp <= 0) return;
  e.hp -= dmg; if (!o || !o.dot) { SFX.hit(); e.flash = 0.12; }
  if (o && o.slow) { e.slowT = Math.max(e.slowT, o.slowT || 1); e.slowK = Math.min(e.slowK === 1 ? 1 : e.slowK, 1 - o.slow); }
  if (o && o.stun && e.type !== 'boss' && e.type !== 'mini') e.stunT = Math.max(e.stunT, o.stun);
  if (o && o.burn) { e.burnT = Math.max(e.burnT, o.burnT || 3); e.burnD = Math.max(e.burnD, o.burn); }
  if (e.hp <= 0) { G.kills++; G.cash += EN[e.type].cash; G.energy = Math.min(ULT_E, G.energy + 4); SFX.kill(e.type === 'boss'); G.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0.3, c: '#fff' }); }
}
const line = (a, b, c, t = 0.12) => G.fx.push({ k: 'line', x: a.x, y: a.y, x2: b.x, y2: b.y, c, t, t0: t });
const ring = (p, r, c, t = 0.3) => G.fx.push({ k: 'ring', x: p.x, y: p.y, r, c, t, t0: t });
// 线段上的敌人：从 p 朝 dir 方向 len 格、半宽 w
function onLine(p, dir, len, w) { return alive().filter(e => { const vx = e.x - p.x, vy = e.y - p.y, t = vx * dir.x + vy * dir.y; return t >= 0 && t <= len && Math.abs(vx * dir.y - vy * dir.x) <= w + e.r; }).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); }
const towerRange = tw => TW[tw.id].range + 0.2 * (tw.lv - 1) + (gl().range || 0);
function towerFire(tw) {
  const s = TW[tw.id], syn = T.TOWERS[tw.id].ceo === G.cmd, g = gl(), lvK = 1 + 0.5 * (tw.lv - 1);
  const range = towerRange(tw), p = { x: tw.x + 0.5, y: tw.y + 0.5 };
  const tg = inRange(p, range); if (!tg.length) return false;
  SFX.shot(({bbq:'c77',tea:'pearl',book:'otaku',tech:'tech',t77:'c77',tpearl:'pearl',totaku:'otaku',trocket:'rocket'})[tw.id]); tw.flash = 0.14;
  const crit = g.crit && Math.random() < g.crit;
  const dmg = s.dmg * tDmg(tw.id) * lvK * (g.dmg || 1) * (crit ? g.critX : 1);
  const gb = g.burn ? { burn: dmg * g.burn, burnT: g.burnT } : null;   // 77 全局燃烧
  const e0 = tg[0], dir = (() => { const dx = e0.x - p.x, dy = e0.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; })();
  if (crit) G.fx.push({ k: 'txt', x: e0.x, y: e0.y - 0.4, s: '暴击', t: 0.4, t0: 0.4 });
  switch (s.kind) {
    case 'cone': {
      const a0 = Math.atan2(dir.y, dir.x), half = s.arc / 2 * Math.PI / 180;
      G.fx.push({ k: 'cone', x: p.x, y: p.y, a: a0, h: half, r: range, c: s.col, t: 0.25, t0: 0.25 });
      tg.filter(e => { let d = Math.atan2(e.y - p.y, e.x - p.x) - a0; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) <= half; })
        .forEach(e => hit(e, dmg, { burn: Math.max(dmg * s.burn, gb ? gb.burn : 0), burnT: s.burnT }));
      break;
    }
    case 'aura': ring(p, range, s.col, 0.25); tg.forEach(e => hit(e, dmg, Object.assign({ slow: Math.min(0.75, s.slow + 0.01 * proto.lv.tea), slowT: s.slowT }, gb))); break;
    case 'pierce': { const hs = onLine(p, dir, range + 0.5, s.width).slice(0, s.pierce); line(p, { x: p.x + dir.x * (range + 0.5), y: p.y + dir.y * (range + 0.5) }, s.col, 0.15); hs.forEach(e => hit(e, dmg, gb)); break; }
    case 'chain': { let cur = e0, k = dmg; const hs = new Set([e0]); line(p, e0, s.col); hit(e0, k, gb);
      for (let i = 0; i < s.chain; i++) { const nx = inRange(cur, s.jump).find(x => !hs.has(x)); if (!nx) break; k *= s.fall; line(cur, nx, s.col); hit(nx, k, gb); hs.add(nx); cur = nx; } break; }
    case 'burn': line(p, e0, s.col); hit(e0, dmg, { burn: dmg * s.burn * (syn ? s.synBurn : 1) + (gb ? gb.burn : 0), burnT: syn ? s.synBurnT : s.burnT }); break;
    case 'bounce': { let cur = e0, prev = p, k = dmg; const hs = new Set(), n = s.bounce + (syn ? s.synBounce : 0);
      for (let i = 0; i <= n && cur; i++) { line(prev, cur, s.col); hit(cur, k, gb); hs.add(cur); prev = cur; k *= s.fall; cur = inRange(cur, s.jump).find(x => !hs.has(x)); } break; }
    case 'boomerang': { const w = syn ? s.synWidth : s.width, hs = onLine(p, dir, range, w);
      G.fx.push({ k: 'boom', x: p.x, y: p.y, x2: p.x + dir.x * range, y2: p.y + dir.y * range, c: s.col, t: 0.4, t0: 0.4 });
      hs.forEach(e => hit(e, dmg, gb)); hs.forEach(e => hit(e, dmg * (syn ? s.synBack : s.back))); break; }
    case 'splash': { const r = syn ? s.synRad : s.rad; line(p, e0, s.col, 0.2); ring(e0, r, s.col); inRange(e0, r).forEach(x => hit(x, dmg, gb)); break; }
  }
  return true;
}
function cmdFire() {
  const s = CMD[G.cmd], dmg = s.dmg * 1.15 ** proto.lv['cmd_' + G.cmd] * 1.1 ** Math.max(0, G.wave - 1), c = G.c;
  const tg = inRange(c, s.range); if (!tg.length) return false;
  SFX.shot(G.cmd);
  if (G.cmd === 'rocket') { line(c, tg[0], s.col, 0.2); ring(tg[0], 0.7, s.col); inRange(tg[0], 0.7).forEach(e => hit(e, dmg)); }
  else if (G.cmd === 'pearl') { let cur = tg[0], prev = c, hs = new Set(); for (let i = 0; i <= s.n && cur; i++) { line(prev, cur, s.col); hit(cur, dmg); hs.add(cur); prev = cur; cur = inRange(cur, 1.8).find(x => !hs.has(x)); } }
  else tg.slice(0, s.n).forEach(e => { line(c, e, s.col); hit(e, dmg); });
  return true;
}
function castUlt() {
  if (!G || G.over || G.pendStart || paused || G.energy < ULT_E) return false;
  G.energy = 0; SFX.ult(G.cmd);
  const m = 1.2 ** proto.lv['cmd_' + G.cmd] * 1.17 ** Math.max(0, G.wave - 1), c = G.c, all = alive();
  if (G.cmd === 'c77') { ring(c, 2.4, RED, 0.6); inRange(c, 2.4).forEach(e => hit(e, 70 * m, { burn: 10 * m })); toast('火圈！'); }
  else if (G.cmd === 'pearl') { all.forEach(e => { hit(e, 10 * m); if (e.type === 'boss' || e.type === 'mini') { e.slowT = 3; e.slowK = 0.5; } else e.stunT = Math.max(e.stunT, 3); }); G.fx.push({ k: 'frost', t: 3, t0: 3 }); toast('冰沙风暴！'); }
  else if (G.cmd === 'otaku') { for (let i = 0; i < 20; i++) { const e = all[Math.floor(Math.random() * all.length)]; if (e) { ring(e, 0.6, '#3949ab', 0.5); hit(e, 30 * m); } } toast('分镜轰炸！'); }
  else { all.forEach(e => { hit(e, 45 * m); e.d = Math.max(0, e.d - 1.5); }); G.fx.push({ k: 'wave', x: c.x, y: c.y, t: 0.7, t0: 0.7 }); toast('星舰冲击波！'); }
  bar(); return true;
}
function build(id, x, y) {
  if (!G || G.over || G.pendStart || paused || !Number.isInteger(x) || !Number.isInteger(y) || !TW[id] || x < 0 || y < 0 || x >= COLS || y >= ROWS || isPath(x, y) || G.tw.has(x + ',' + y)) return false;
  const cost = T.TOWERS[id].cost; if (G.cash < cost) return false;
  SFX.cue('build'); G.cash -= cost; G.tw.set(x + ',' + y, { id, x, y, lv: 1, cd: 0, spent: cost }); sel = null; bar(); return true;
}
function upTower(x, y) {
  if (!G || G.over || paused || G.pendStart) return false;
  const tw = G && G.tw.get(x + ',' + y); if (!tw || tw.lv >= MAX_TLV) return false;
  const c = upCost(tw); if (G.cash < c) return false;
  G.cash -= c; tw.spent += c; tw.lv++; bar(); return true;
}
function sell(x, y) { if (!G || G.over || paused || G.pendStart) return false; const tw = G && G.tw.get(x + ',' + y); if (!tw) return false; G.cash += sellBack(tw); G.tw.delete(x + ',' + y); sel = null; bar(); return true; }
// Compatibility hook: commanders are now fixed passive support.
function moveCmd() { return false; }

function step(dt) {
  if (!G || G.over || G.pendStart || paused || document.hidden) return;
  G.t += dt;
  G.energy = Math.min(ULT_E, G.energy + 1.5 * dt);
  if (!G.q.length && G.wave < G.W && !alive().length) { if (G.breakT <= 0 && G.wave > 0) { G.breakT = 5; G.cash += 20 + 5 * G.wave; } const before = Math.ceil(G.breakT); G.breakT = Math.max(0, G.breakT - dt); if (Math.ceil(G.breakT) !== before && G.breakT > 0) SFX.cue('tick'); if (G.breakT <= 0) nextWave(); }
  if (G.q.length) { G.spawnT -= dt; if (G.spawnT <= 0) { const ty = G.q.shift(); spawn(ty); G.spawnT = ty === 'fast' ? 0.5 : ty === 'boss' ? 2 : 0.8; } }
  for (const e of G.es) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.burnT > 0) { e.burnT -= dt; hit(e, e.burnD * dt, {dot:true}); if (e.hp <= 0) continue; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowK = 1; }
    if (e.stunT > 0) { e.stunT -= dt; } else e.d += e.sp * e.slowK * dt;
    const [x, y] = posAt(e.d); e.x = x; e.y = y;
    if (e.d >= PLEN) { e.hp = 0; G.lives -= EN[e.type].lives || 1; SFX.hurt(); toast('机房被闯了！'); if (G.lives <= 0) { G.lives = 0; return end(false); } }
  }
  G.es = G.es.filter(e => e.hp > 0);
  for (const tw of G.tw.values()) { tw.flash = Math.max(0, (tw.flash || 0) - dt); tw.cd -= dt; if (tw.cd <= 0 && towerFire(tw)) tw.cd = TW[tw.id].rate * (gl().rate || 1); }
  const c = G.c;
  c.cd -= dt; if (c.cd <= 0 && cmdFire()) c.cd = CMD[G.cmd].rate;
  if (G.energy >= ULT_E && (G.cmd === 'c77' ? inRange(c, 2.4).length : alive().length)) castUlt();
  for (const f of G.fx) f.t -= dt;
  G.fx = G.fx.filter(f => f.t > 0);
  if (G.wave >= G.W && !G.q.length && !G.es.length) end(true);
}
function end(win) {
  if (!G || G.over) return;
  G.over = true; G.win = win; SFX.stopBgm(); win ? SFX.win() : SFX.lose();
  const res = { td: 'result', runId: G.runId, n: G.n, win, waves: win ? G.wave : Math.max(0, G.wave - 1), cmd: G.cmd, kills: G.kills };
  if (EMBED) { G.resMsg = res; sendResult(); }
  else { T.applyResult(proto, res); saveProto(); G.saveOk = true; }
  renderResult(); show('#result');
}
function sendResult() {
  if (!G || !G.resMsg) return;
  const game = G; G.wait = true; host(G.resMsg); clearTimeout(G.resultTO);
  G.resultTO = setTimeout(() => { if (G !== game || !G.wait) return; G.wait = false; G.saveOk = false; G.why = '结算确认超时，可重试保存'; renderResult(); }, 4000);
}
function renderResult() {
  if (!G) return;
  const saved = !EMBED || G.saveOk;
  $('#resTitle').textContent = G.wait ? '结算中…' : G.win && saved ? '守住了！' : G.win ? '存档失败' : '机房失守';
  $('#resStats').textContent = `守了 ${G.win ? G.W : Math.max(0, G.wave - 1)}/${G.W} 波 · 击倒 ${G.kills} · 剩余生命 ${G.lives}`;
  $('#resNote').textContent = G.wait ? '' : !saved ? `这局进度没记上${G.why ? '（' + G.why + '）' : ''}` : G.win ? `${T.WAVES} 波全部守住！` : `最佳 ${proto.best}/${T.WAVES} 波 · 去升级防御塔或统帅再来`;
  $('#retryBtn').classList.toggle('hidden', !(EMBED && !G.wait && !G.saveOk));
  $('#againBtn').textContent = G.win && saved && G.n < T.MAX_LV ? '下一关' : '再来一局';
  $('#againBtn').disabled = !!G.wait;
}
$('#retryBtn').onclick = () => { if (G && G.over && !G.wait && G.resMsg) { sendResult(); renderResult(); } };
$('#againBtn').onclick = () => { if (!G || G.wait) return; const n = G.win && (!EMBED || G.saveOk) ? G.n + 1 : G.n; G = null; lvSel = Math.min(T.MAX_LV, proto.cleared + 1, n); start(lvSel); };
$('#menuBtn').onclick = () => { if (G && G.wait) return; G = null; SFX.stopBgm(); show('#menu'); renderMenu(); };
function setPause(on) { if (!G || G.over) return; paused = on; if (on) SFX.stopBgm(); else { SFX.unlock(); bgmTry(); } SFX.setPaused(on); show(on ? '#pause' : null); if (!on) last = performance.now(); }
$('#pauseBtn').onclick = () => setPause(true);
$('#resumeBtn').onclick = () => setPause(false);
$('#sndBtn').onclick = () => { userMute = !userMute; SFX.unlock(); applyMute(); };
$('#quitBtn').onclick = () => { if (!G) return; paused = false; G.pendStart ? abortStart('已退出') : end(false); };
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
$('#startBtn').onclick = () => start(lvSel);
$('#waveBtn').onclick = () => {};
$('#ultBtn').onclick = () => {};

// ---- HUD / 底栏 ----
let toastT = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1200); }
function show(id) { for (const s of ['#menu', '#pause', '#result']) $(s).classList.toggle('hidden', s !== id); $('#hud').classList.toggle('hidden', id === '#menu'); }
function hud() {
  if (!G) return;
  $('#lifeTxt').textContent = `❤ ${G.lives}`; $('#cashTxt').textContent = `建设点 ${Math.floor(G.cash)}`; $('#waveTxt').textContent = `波 ${G.wave}/${G.W}`;
  const h = T.HEROES[G.cmd]; $('#ultLbl').textContent = '自动 · ' + (h.btn || h.ult); $('#ultBtn').setAttribute('aria-label', '满能自动支援：' + h.ult);
  $('#ultFill').style.height = (G.energy / ULT_E * 100) + '%';
  const rdy = G.energy >= ULT_E && !G.over && !G.pendStart; $('#ultBtn').disabled = true; $('#ultBtn').classList.toggle('ready', rdy);
  const canWave = !G.q.length && G.wave < G.W && !alive().length && !G.pendStart;
  $('#waveBtn').disabled = true; $('#waveBtn').textContent = canWave ? `第 ${G.wave + 1} 波 · ${Math.max(1, Math.ceil(G.breakT))} 秒` : G.pendStart ? '登记中' : '进攻中';
  $('#countdown').classList.toggle('hidden', !canWave || paused || G.over);
  $('#countdown').textContent = `第 ${G.wave + 1} 波即将来临 · ${Math.max(1, Math.ceil(G.breakT))}`;
  if (sel && sel.k === 'build' && sel.id) $('#buildConfirm').disabled = sel.x === null || isPath(sel.x,sel.y) || G.tw.has(sel.x+','+sel.y) || G.cash < T.TOWERS[sel.id].cost || G.pendStart;
  if (sel && sel.k === 'tower') { const tw = G.tw.get(sel.x + ',' + sel.y); if (tw) $('#twUp').disabled = tw.lv >= MAX_TLV || G.cash < upCost(tw); }
}
function bar() {
  $('#barMain').classList.toggle('hidden', !!sel && sel.k === 'tower'); $('#barBuild').classList.toggle('hidden', !!sel && sel.k === 'tower'); $('#barTower').classList.toggle('hidden', !sel || sel.k !== 'tower');
  if (!G) return;
  if (!sel || sel.k === 'build') { const choice = sel || {}; $('#twGrid').innerHTML = TIDS.map(id => `<button type="button" data-tw="${id}" class="${T.TOWERS[id].ceo === G.cmd ? 'syn' : ''} ${choice.id === id ? 'chosen' : ''}">${T.TOWERS[id].ceo === G.cmd ? '★' : ''}${T.TOWERS[id].name}<small>${T.TOWERS[id].cost}</small></button>`).join('');
    $('#buildInfo').innerHTML = choice.id ? towerDetail(choice.id) : '先选一座塔查看攻击与数值。选塔不扣建设点。';
    $('#buildConfirm').disabled = !choice.id || choice.x === null || isPath(choice.x, choice.y) || G.tw.has(choice.x+','+choice.y) || G.cash < T.TOWERS[choice.id].cost;
    $('#buildConfirm').textContent = choice.id ? `建造 · ${T.TOWERS[choice.id].cost}` : '请选择塔';
  }
  if (sel && sel.k === 'tower') {
    const tw = G.tw.get(sel.x + ',' + sel.y); if (!tw) { sel = null; return bar(); }
    const syn = T.TOWERS[tw.id].ceo === G.cmd;
    $('#twInfo').innerHTML = towerDetail(tw.id, tw.lv);
    $('#twUp').textContent = tw.lv >= MAX_TLV ? '已满级' : `升级 ${upCost(tw)}`; $('#twSell').textContent = `拆除 +${sellBack(tw)}`;
  }
  positionBuildActions(); hud();
}
$('#twGrid').addEventListener('click', e => { const b = e.target.closest('[data-tw]'); if (b) { sel = {k:'build',id:b.dataset.tw,x:null,y:null}; bar(); } });
$('#buildConfirm').onclick = () => { if (sel && sel.id && sel.x !== null) build(sel.id, sel.x, sel.y); };
$('#buildX').onclick = $('#cancelChoice').onclick = $('#twX').onclick = () => { sel = null; bar(); };
$('#twUp').onclick = () => { if (sel) upTower(sel.x, sel.y); };
$('#twSell').onclick = () => { if (sel) sell(sel.x, sel.y); };

// ---- 画面 ----
const cv = $('#cv'), cx = cv.getContext('2d');
let W = 0, H = 0, S = 40, OX = 0, OY = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 64 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || 0), bot = (barMaxH() || 110) + 6;
  S = Math.floor(Math.min((W - 12) / COLS, (H - top - bot) / ROWS)); OX = Math.round((W - S * COLS) / 2); OY = Math.round(top + Math.max(0, (H - top - bot - S * ROWS) / 2));
}
addEventListener('resize', resize);
// 底栏三种状态（提示 / 造塔 / 选中塔）取最高的那个固定住，弹出造塔栏时地图不被挡、也不跳
function barMaxH() { return Math.min(innerHeight * .52, 312 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0)); }
function positionBuildActions() {
  const el = $('#buildActions'), active = sel?.k === 'build' && sel.id && sel.x !== null;
  el.classList.toggle('hidden', !active || paused || G?.over);
  if (!active) return;
  const width = Math.min(214, innerWidth-16), x = px(sel.x+.5), y = py(sel.y);
  el.style.width = width+'px'; el.style.left = Math.max(8,Math.min(innerWidth-width-8,x-width/2))+'px';
  const below = y+S+8; const bottom = innerHeight-barMaxH();
  el.style.top = (below+48 < bottom ? below : Math.max(56,y-56))+'px';
}

const IMG = {}; T.CEO_IDS.forEach(id => { const i = new Image(); i.src = `../art/face_${id}.webp`; IMG[id] = i; });
const px = x => OX + x * S, py = y => OY + y * S;
// Small vector emblems keep the paper/comic palette while giving each attack family a silhouette.
function drawTowerEmblem(id,x,y,r) {
  cx.save(); cx.translate(x,y); cx.lineWidth=1.8; cx.strokeStyle=INK; cx.fillStyle='#fffaf0';
  if (id==='tea' || id==='tpearl') { cx.beginPath(); cx.moveTo(-r,-r*.65);cx.lineTo(-r*.7,r);cx.lineTo(r*.7,r);cx.lineTo(r,-r*.65);cx.closePath();cx.fill();cx.stroke();cx.beginPath();cx.moveTo(0,-r*.5);cx.lineTo(r*.4,-r*1.4);cx.stroke(); for(let i=0;i<3;i++){cx.beginPath();cx.arc((i-1)*r*.4,r*.5,r*.15,0,7);cx.fillStyle='#6d4c41';cx.fill();} }
  else if(id==='book' || id==='totaku') { cx.rotate(-.18);cx.fillRect(-r,-r,r*2,r*2);cx.strokeRect(-r,-r,r*2,r*2);cx.beginPath();cx.moveTo(0,-r);cx.lineTo(0,r);cx.moveTo(-r*.7,-r*.35);cx.lineTo(-r*.2,-r*.35);cx.moveTo(r*.2,r*.2);cx.lineTo(r*.7,r*.2);cx.stroke(); }
  else if(id==='tech') {cx.fillStyle=YEL;cx.beginPath();cx.moveTo(r*.4,-r*1.3);cx.lineTo(-r,r*.15);cx.lineTo(-r*.1,r*.15);cx.lineTo(-r*.4,r*1.3);cx.lineTo(r,-r*.15);cx.lineTo(r*.1,-r*.15);cx.closePath();cx.fill();cx.stroke();}
  else if(id==='trocket') {cx.beginPath();cx.moveTo(0,-r*1.3);cx.quadraticCurveTo(r*1.1,-r*.2,r*.6,r*.7);cx.lineTo(-r*.6,r*.7);cx.quadraticCurveTo(-r*1.1,-r*.2,0,-r*1.3);cx.fill();cx.stroke();cx.fillStyle=YEL;cx.beginPath();cx.moveTo(-r*.4,r*.7);cx.lineTo(0,r*1.4);cx.lineTo(r*.4,r*.7);cx.fill();cx.fillStyle='#7fd1e8';cx.beginPath();cx.arc(0,-r*.1,r*.28,0,7);cx.fill();cx.stroke();}
  else {cx.rotate(.35);cx.beginPath();cx.moveTo(0,-r*1.4);cx.lineTo(0,r*1.4);cx.stroke();for(let i=-1;i<=1;i++){cx.fillStyle=i===0?YEL:'#fffaf0';cx.fillRect(-r*.7,i*r*.7-r*.25,r*1.4,r*.5);cx.strokeRect(-r*.7,i*r*.7-r*.25,r*1.4,r*.5);}}
  cx.restore();
}
function draw() {
  cx.fillStyle = PAPER; cx.fillRect(0, 0, W, H);
  if (!G) return;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const p = isPath(x, y);
    cx.fillStyle = p ? '#e9d3a8' : '#fffaf0'; cx.fillRect(px(x) + 1, py(y) + 1, S - 2, S - 2);
    if (p) { cx.fillStyle = '#b9a681'; cx.beginPath(); cx.arc(px(x+.5),py(y+.5),1.5,0,7); cx.fill(); }
    if (!p) { cx.fillStyle = '#e8dec6'; cx.fillRect(px(x)+5,py(y)+S-5,S-10,2); cx.strokeStyle = '#d9cfb8'; cx.setLineDash([3, 3]); cx.strokeRect(px(x) + 2.5, py(y) + 2.5, S - 5, S - 5); cx.setLineDash([]); }
  }
  cx.fillStyle = INK; cx.font = `900 ${Math.round(S * 0.3)}px sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillText('入口', px(0.5), py(0.5)); cx.fillText('机房', px(5.5), py(ROWS - 0.15));
  if (sel && sel.x !== null) { cx.strokeStyle = RED; cx.lineWidth = 3; cx.strokeRect(px(sel.x) + 1.5, py(sel.y) + 1.5, S - 3, S - 3); cx.lineWidth = 1;
    const tw = sel.k === 'build' && sel.id ? {id:sel.id,x:sel.x,y:sel.y,lv:1} : G.tw.get(sel.x + ',' + sel.y); if (tw) { cx.strokeStyle = 'rgba(230,57,70,.5)'; cx.beginPath(); cx.arc(px(tw.x + 0.5), py(tw.y + 0.5), towerRange(tw) * S, 0, 7); cx.stroke(); } }
  for (const tw of G.tw.values()) {
    const s = TW[tw.id], x = px(tw.x), y = py(tw.y), syn = T.TOWERS[tw.id].ceo === G.cmd;
    cx.fillStyle = 'rgba(20,20,20,.18)'; cx.beginPath(); cx.ellipse(x + S/2, y + S - 3, S*.4, S*.12, 0, 0, 7); cx.fill();
    cx.fillStyle = tw.flash > 0 ? '#fff3c4' : s.col; cx.strokeStyle = INK; cx.lineWidth = 2.5; cx.beginPath(); cx.roundRect ? cx.roundRect(x + 4, y + 4, S - 8, S - 8, 8) : cx.rect(x + 4, y + 4, S - 8, S - 8); cx.fill(); cx.stroke(); cx.lineWidth = 1;
    cx.fillStyle = 'rgba(255,255,255,.35)'; cx.fillRect(x+8,y+7,S-16,4);
    drawTowerEmblem(tw.id,x+S/2,y+S*.46,S*.24);
    cx.fillStyle = INK; cx.font = `900 ${Math.max(8,Math.round(S*.22))}px sans-serif`; cx.fillText(s.k,x+S*.78,y+S*.77);
    for (let i = 0; i < tw.lv; i++) { cx.fillStyle = YEL; cx.fillRect(x + 7 + i * 7, y + S - 11, 5, 5); }
    if (syn) { cx.fillStyle = YEL; cx.font = `900 ${Math.round(S * 0.3)}px sans-serif`; cx.fillText('★', x + S - 9, y + 11); }
  }
  // Placement ghost is visual only: the map/cash mutate only in build().
  if (sel?.k === 'build' && sel.id && sel.x !== null) {
    const p = TW[sel.id], x = px(sel.x), y = py(sel.y);
    const blocked = isPath(sel.x,sel.y) || G.tw.has(sel.x+','+sel.y);
    cx.save(); cx.globalAlpha = blocked ? .4 : .65;
    cx.fillStyle = p.col; cx.strokeStyle = blocked ? RED : INK; cx.lineWidth = 2;
    cx.setLineDash([3,2]); cx.beginPath();
    if (cx.roundRect) cx.roundRect(x+4,y+4,S-8,S-8,7); else cx.rect(x+4,y+4,S-8,S-8);
    cx.fill(); cx.stroke(); cx.setLineDash([]);
    drawTowerEmblem(sel.id,x+S/2,y+S*.43,S*.24);
    cx.globalAlpha = 1; cx.fillStyle = blocked ? RED : INK;
    cx.font = `900 ${Math.max(9,Math.round(S*.22))}px sans-serif`;
    cx.fillText(blocked ? '不可建' : '待建', x+S/2, y+S*.8); cx.restore();
  }
  for (const e of G.es) {
    const b = EN[e.type], x = px(e.x), y = py(e.y), r = e.r * S;
    cx.fillStyle = e.flash > 0 ? '#fff' : e.stunT > 0 ? '#b3e5fc' : b.col; cx.strokeStyle = INK; cx.lineWidth = 2; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill(); cx.stroke(); cx.lineWidth = 1;
    cx.fillStyle = INK; cx.fillRect(x - r * 0.45, y - r * 0.2, r * 0.25, r * 0.25); cx.fillRect(x + r * 0.2, y - r * 0.2, r * 0.25, r * 0.25);
    if (e.burnT > 0) { cx.fillStyle = '#ff9800'; cx.beginPath(); cx.arc(x, y - r, r * 0.3, 0, 7); cx.fill(); }
    cx.fillStyle = '#fff'; cx.fillRect(x - r, y - r - 7, r * 2, 4); cx.fillStyle = RED; cx.fillRect(x - r, y - r - 7, r * 2 * Math.max(0, e.hp / e.max), 4);
    if (e.type === 'boss' || e.type === 'mini') { cx.fillStyle = YEL; cx.font = `900 ${Math.round(S * 0.4)}px sans-serif`; cx.fillText('♛', x, y - r - 16); }
  }
  const c = G.c, cr = S * 0.42;
  cx.strokeStyle = 'rgba(20,20,20,.15)'; cx.beginPath(); cx.arc(px(c.x), py(c.y), CMD[G.cmd].range * S, 0, 7); cx.stroke();
  cx.save(); cx.beginPath(); cx.arc(px(c.x), py(c.y), cr, 0, 7); cx.clip();
  if (IMG[G.cmd].complete && IMG[G.cmd].naturalWidth) cx.drawImage(IMG[G.cmd], px(c.x) - cr, py(c.y) - cr, cr * 2, cr * 2); else { cx.fillStyle = CMD[G.cmd].col; cx.fill(); }
  cx.restore(); cx.fillStyle = INK; cx.font = `800 ${Math.max(9,S*.22)}px sans-serif`; cx.fillText('自动支援', px(c.x), py(c.y)+cr+9); cx.strokeStyle = YEL; cx.lineWidth = 4; cx.beginPath(); cx.arc(px(c.x), py(c.y), cr, 0, 7); cx.stroke(); cx.strokeStyle = INK; cx.lineWidth = 2; cx.stroke(); cx.lineWidth = 1;
  for (const f of G.fx) {
    const a = Math.max(0, f.t / (f.t0 || 0.3));
    cx.globalAlpha = a;
    if (f.k === 'line') { cx.strokeStyle = f.c; cx.lineWidth = 5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(px(f.x), py(f.y)); cx.lineTo(px(f.x2), py(f.y2)); cx.stroke(); cx.strokeStyle = '#fffaf0'; cx.lineWidth = 1.5; cx.stroke(); cx.lineWidth = 1; }
    else if (f.k === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = 3; cx.beginPath(); cx.arc(px(f.x), py(f.y), f.r * S * (1.1 - a * 0.3), 0, 7); cx.stroke(); cx.lineWidth = 1; }
    else if (f.k === 'pop') { cx.strokeStyle = '#e8590c'; cx.lineWidth=2; for(let i=0;i<6;i++){const angle=i*Math.PI/3,rr=S*(1-a)*.6;cx.beginPath();cx.moveTo(px(f.x)+Math.cos(angle)*rr,py(f.y)+Math.sin(angle)*rr);cx.lineTo(px(f.x)+Math.cos(angle)*(rr+4),py(f.y)+Math.sin(angle)*(rr+4));cx.stroke();} cx.lineWidth=1; cx.fillStyle = YEL; cx.beginPath(); cx.arc(px(f.x), py(f.y), S * 0.3 * (1.5 - a), 0, 7); cx.fill(); }
    else if (f.k === 'frost') { cx.globalAlpha = 0.18 * a + 0.05; cx.fillStyle = '#7fd1e8'; cx.fillRect(OX, OY, S * COLS, S * ROWS); }
    else if (f.k === 'cone') { cx.fillStyle = f.c; cx.globalAlpha = 0.35 * a; cx.beginPath(); cx.moveTo(px(f.x), py(f.y)); cx.arc(px(f.x), py(f.y), f.r * S, f.a - f.h, f.a + f.h); cx.closePath(); cx.fill(); }
    else if (f.k === 'boom') { const u = 1 - a, k = u < 0.5 ? u * 2 : 2 - u * 2; cx.fillStyle = f.c; cx.fillRect(px(f.x + (f.x2 - f.x) * k) - S * 0.18, py(f.y + (f.y2 - f.y) * k) - S * 0.22, S * 0.36, S * 0.44); }
    else if (f.k === 'txt') { cx.fillStyle = RED; cx.font = `900 ${Math.round(S * 0.32)}px sans-serif`; cx.fillText(f.s, px(f.x), py(f.y)); }
    else if (f.k === 'wave') { cx.strokeStyle = '#ff7043'; cx.lineWidth = 6; cx.beginPath(); cx.arc(px(f.x), py(f.y), (1 - a) * S * 12, 0, 7); cx.stroke(); cx.lineWidth = 1; }
    cx.globalAlpha = 1;
  }
}
cv.addEventListener('pointerdown', e => {
  SFX.unlock();
  if (!G || G.over || paused) return;
  const x = Math.floor((e.clientX - OX) / S), y = Math.floor((e.clientY - OY) / S);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) { sel = null; return bar(); }
  if (sel?.k === 'build' && sel.id) {
    sel.x = x; sel.y = y;
    if (isPath(x,y) || G.tw.has(x+','+y)) toast('这里不能建造，请选择空地');
  } else if (G.tw.has(x + ',' + y)) sel = {k:'tower',x,y};
  else { toast(isPath(x,y) ? '路面不能建造' : '先在下方选择防御塔'); sel = null; }
  bar();
});
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G && !paused && !G.over) step(dt);
  draw(); hud(); positionBuildActions();
  raf = requestAnimationFrame(loop);
}
window.render_game_to_text = () => JSON.stringify({mode:!G?'menu':G.over?'result':paused?'paused':'playing',coordinates:'grid origin top-left, x right, y down',wave:G?.wave,countdown:G?.breakT,cash:G?.cash,lives:G?.lives,commander:G?.cmd,energy:G?.energy,selection:sel,towers:G?[...G.tw.values()]:[],enemies:G?.es});
window.advanceTime = ms => { for (let left=ms;left>0;left-=1000/60) step(Math.min(left,1000/60)/1000); draw(); hud(); };
resize(); renderMenu(); show('#menu'); raf = requestAnimationFrame(loop);
window.__td = { EMBED, proto, P, towerRange, start, step, build, upTower, sell, moveCmd, castUlt, nextWave, buyUp, onState, setPause, renderMenu, isPath, waveList, PLEN, TW, CMD,
  get G() { return G; }, get geo() { return { S, OX, OY, COLS, ROWS }; }, get lastSent() { return lastSent; }, get pend() { return pend; }, get paused() { return paused; }, get cmdSel() { return cmdSel; }, set cmdSel(v) { if (T.CEO_IDS.includes(v)) { cmdSel = v; renderMenu(); } } };
})();
