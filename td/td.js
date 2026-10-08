'use strict';
// 科技公司塔防：一张地图、8 种塔（4 通用 + 4 CEO 塔）、4 位统帅可选。
// 单独打开 = 原型模式（模拟余额，只存 PROTO_KEY）；?embed=1 嵌在经营页里 = 金币、升级、进度都由经营页管（td:* postMessage），本页不写任何存档。
(() => {
const T = window.TDCore, SFX = window.ZBSfx;
const EMBED = /[?&]embed=1(&|$)/.test(location.search) && window.parent !== window;
const PROTO_KEY = 'tangzhe-formal-td-proto-v1';
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
// 统帅仅提供建设点能力和同名塔增益；没有地图实体或直接攻击；局内建设点仍只用G.cash。
const CMD = {c77:{g:{}},pearl:{g:{}},otaku:{g:{}},rocket:{g:{}}};
const TIDS = T.TOWER_IDS;
const MAX_TLV = 3;
const upCost = tw => Math.round(T.TOWERS[tw.id].cost * 0.8 * tw.lv);
const sellBack = tw => Math.round(tw.spent * 0.6);
const EN = { walk: { hp: 30, sp: 1.0, r: 0.28, cash: 5, col: '#7cb342' }, fast: { hp: 18, sp: 1.8, r: 0.22, cash: 4, col: '#fdd835' }, tank: { hp: 110, sp: 0.6, r: 0.36, cash: 12, col: '#6d4c41' },
  mini: { hp: 600, sp: 0.5, r: 0.42, cash: 50, col: '#ad1457', lives: 3 }, boss: { hp: 2200, sp: 0.42, r: 0.5, cash: 100, col: '#8e24aa', lives: 10 } };
const hpMul = w => 1.17 ** w;
const LIVES = 20, START_PTS = 120;
const ENERGY = Object.freeze({ cap:400, endlessTowers:Math.floor(COLS*ROWS/3), baseRate:.5, waveSeconds:30, start77:60, rocketRate:.5, burstSeconds:10, burstCooldown:15, burstMax:.30, frostSeconds:5, frostCooldown:30, frostMax:.45 });
const towerLimit = () => G?.endless ? ENERGY.endlessTowers : Infinity;
// Provisional measured budgets: finite zero-upgrade strategies, not a global optimum.
const NORMAL_BUDGET = Object.freeze({c77:1616,pearl:1627,otaku:1510,rocket:1615});
function gainEnergy(value, refund = false) {
  if (!G || !Number.isFinite(value) || value <= 0) return 0;
  const remaining = G.endless || refund ? Infinity : Math.max(0, G.normalBudget-G.energyEarned);
  const credited = Math.max(0, Math.min(value, remaining, ENERGY.cap-G.cash));
  G.cash += credited;
  if (!G.endless && !refund) G.energyEarned = Math.min(G.normalBudget,G.energyEarned+credited);
  return credited;
}
const energyRatio = () => Math.min(1,Math.max(0,G.cash/ENERGY.cap));
const burstMultiplier = () => 1+(G.cmd==='otaku' && G.skillLeft>0 ? ENERGY.burstMax*energyRatio():0);
const frostMultiplier = () => G.cmd==='pearl' && G.skillLeft>0 ? 1-ENERGY.frostMax*energyRatio():1;
const skillName = () => G.cmd==='otaku'?'蓄能爆发':'冰沙风暴';
function activateSkill() {
  if(!G||G.over||G.pendStart||paused||document.hidden||!['otaku','pearl'].includes(G.cmd)||G.cash<=0||G.skillCooldown>0||(!G.q.length&&!alive().length))return false;
  G.skillLeft=G.cmd==='otaku'?ENERGY.burstSeconds:ENERGY.frostSeconds;
  G.skillCooldown=G.cmd==='otaku'?ENERGY.burstCooldown:ENERGY.frostCooldown;
  SFX.unlock();SFX.cue('build');hud();return true;
}
function energyDescription(id) {
  return id==='c77'?`开局额外 ${ENERGY.start77} 建设点`:id==='rocket'?`战斗恢复额外 +${ENERGY.rocketRate}/秒（每波最多 ${ENERGY.waveSeconds} 秒）`:id==='otaku'?`手动蓄能爆发：${ENERGY.burstSeconds}秒内全塔额外增伤 ${ENERGY.burstMax*100}%×实时建设点/${ENERGY.cap}；按下起冷却${ENERGY.burstCooldown}秒，不消耗建设点`: `手动冰沙风暴：${ENERGY.frostSeconds}秒内全场额外减速 ${ENERGY.frostMax*100}%×实时建设点/${ENERGY.cap}；与茶塔乘算、普通怪减速最多75%、Boss最多50%；按下起冷却${ENERGY.frostCooldown}秒，不消耗建设点`;
}
function waveList(w) {
  if(w>=T.WAVES){const k=w+1-T.WAVES,q=Array.from({length:Math.min(40,25+Math.floor(k/2))},(_,i)=>i%3===2?'fast':'walk');q.push(...Array(Math.min(8,4+Math.floor(k/5))).fill('tank'));if(k%5===0)q.push('boss');else if(k%3===0)q.push('mini');return q;}

  const q = [], cnt = 7 + 2 * w;
  for (let i = 0; i < cnt; i++) q.push(w >= 1 && i % 3 === 2 ? 'fast' : 'walk');
  for (let i = 0; i < Math.floor(w / 2); i++) q.push('tank');
  if (w === 4) q.push('mini');
  if (w === T.WAVES - 1) q.push('boss');
  return q;
}

const num = n => Number(n.toFixed(2));
function cmdDetail(id) {
  const g = CMD[id].g, s = TW[T.HEROES[id].tower];
  const same = id === 'c77' ? `自带燃烧每秒系数 ${s.burn}→${num(s.burn*s.synBurn)}，持续 ${s.burnT}→${s.synBurnT} 秒`
    : id === 'pearl' ? `首击后弹跳 ${s.bounce}→${s.bounce+s.synBounce} 次（最多 ${s.bounce+1+s.synBounce} 个不同目标）`
    : id === 'otaku' ? `回程伤害系数 ${s.back}→${s.synBack}；攻击半宽 ${s.width}→${s.synWidth} 格`
    : `爆炸半径 ${s.rad}→${s.synRad} 格`;
  return `<b>建设点能力</b>：${energyDescription(id)}。<br><b>同名塔「${T.TOWERS[T.HEROES[id].tower].name}」</b>：${same}。`;
}
function towerSummary(id, lv = 1) {
  const s = TW[id], g = gl(), dmg = s.dmg * tDmg(id) * (1 + .5 * (lv - 1)) * (g.dmg || 1) * burstMultiplier();
  const attack = {cone:'扇形灼烧',aura:'范围减速',pierce:'直线穿透',chain:'跳跃链电',burn:'单体燃烧',bounce:'珍珠弹跳',boomerang:'往返回旋',splash:'范围爆炸'}[s.kind];
  return `<b class="core-line">${attack} · 对地含 Boss</b><span class="core-line">伤 ${num(dmg)} · ${num(s.rate*(g.rate||1))}秒 · ${num(towerRange({id,lv}))}格</span>`;
}
function towerDetail(id, lv = 1) {
  const s = TW[id], g = gl(), syn = T.TOWERS[id].ceo === G.cmd;
  const dmg = s.dmg * tDmg(id) * (1 + .5 * (lv - 1)) * (g.dmg || 1) * burstMultiplier();
  const extra = {cone:`70°扇形；燃烧 ${num(dmg*s.burn)}/秒 ×${s.burnT}秒`,aura:`范围内全体；基础减速 ${num(Math.min(.75,s.slow+.01*proto.lv.tea)*100)}% ×${s.slowT}秒；与技能乘算后普通怪总减速最多75%，小Boss/Boss最多50%`,pierce:`直线最多 ${s.pierce} 只；半宽 ${s.width} 格，线长为射程 +0.5 格`,chain:`首击 +${s.chain} 次跳跃；跳距 ${s.jump} 格；逐跳伤害 ×${s.fall}`,burn:`燃烧 ${num(dmg*(s.burn*(syn?s.synBurn:1)+(g.burn||0)))}/秒 ×${syn?s.synBurnT:s.burnT}秒`,bounce:`首击 +${s.bounce+(syn?s.synBounce:0)} 次弹跳；跳距 ${s.jump} 格；逐跳伤害 ×${s.fall}`,boomerang:`去程 ${num(dmg)} + 回程 ${num(dmg*(syn?s.synBack:s.back))}；半宽 ${syn?s.synWidth:s.width} 格；沿线全部`,splash:`命中点半径 ${syn?s.synRad:s.rad} 格内全体`}[s.kind];
  return `<b>${T.TOWERS[id].name} · Lv${lv}</b><br>${T.TOWERS[id].ceo?'CEO塔：每种最多1座，四种可共存':'店铺塔：可重复建造'}（普通无总数限制；无尽最多25）<br>目标：地面敌人（含 Boss），优先最前方<br>伤害 ${num(dmg)} · 间隔 ${num(s.rate*(g.rate||1))}秒 · 范围 ${num(towerRange({id,lv}))}格<br>${extra}${g.burn && !['burn','cone'].includes(s.kind)?`；命中燃烧 ${num(dmg*g.burn)}/秒 ×${g.burnT}秒（回程除外）`:''}${g.crit?`；${g.crit*100}% 暴击 ×${g.critX}（以上为非暴击）`:''}${syn?'<br>★ '+s.syn.split('：')[1]:''}`;
}

// ---- 金币 / 存档（原型）----
const protoStore=EMBED?null:window.TDProto.create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},locks:()=>window.navigator?.locks,T});
const loadedProto=EMBED?null:protoStore.load();
const proto=Object.assign({coins:0,ready:!EMBED,blocked:false},EMBED?T.norm(null):loadedProto.state);
let protoNotice=loadedProto&&!loadedProto.ok?loadedProto.why:'',protoPending=false,localBuy=null,protoTask=null;
function acceptProto(r){if(r.state){Object.assign(proto,r.state);if(!r.state.endless)delete proto.endless;}protoNotice=r.ok?'':r.why||'未保存';}
async function purchaseProto(){
 if(!localBuy||protoPending)return false;protoPending=true;renderMenu();
 const r=await protoStore.buy(localBuy);acceptProto(r);protoPending=false;
 if(r.ok||!r.uncertain)localBuy=null;
 renderMenu();if(!r.ok)toast(protoNotice);return r.ok;
}
async function selectProto(cmd){
 if(protoPending||localBuy)return false;protoPending=true;renderMenu();const r=await protoStore.select(cmd);acceptProto(r);protoPending=false;if(r.ok)cmdSel=proto.cmd;renderMenu();if(!r.ok)toast(protoNotice);return r.ok;
}
let cmdSel = proto.cmd, lvSel = 1;
let pend = false, port = null, lastSent = null, buyRequest = null, buyTimer = null, buyTimedOut = false, cmdRestored = false;
const host = m => { lastSent = m; if (port) port.postMessage(m); };
const canSpend = n => proto.ready && !pend && !protoPending && !localBuy && !proto.blocked && isFinite(n) && n > 0 && proto.coins >= n;
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
  if(d.ack==='endlessStart'){if(!G||!G.pendingEndless||d.runId!==G.pendingEndless)return;clearTimeout(G.endlessTO);if(d.ok){Object.assign(proto,T.norm(d.z));enterEndless(G.pendingEndless);}else{G.pendingEndless=null;G.why=d.why;renderResult();}return;}
  if (d.ack === 'buy' && (!buyRequest || d.requestId !== buyRequest.requestId || d.id !== buyRequest.id)) return;
  if (d.ack === 'start' && (!G || !G.pendStart || d.runId !== G.runId)) return;
  if (['result','endlessResult'].includes(d.ack) && (!G || !G.over || !G.resMsg || d.runId !== G.runId || (G.saveOk && d.ok !== true))) return;
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
  if (['result','endlessResult'].includes(d.ack) && G && G.over && G.resMsg && d.runId === G.runId) { clearTimeout(G.resultTO); G.wait = false; G.saveOk = d.ok === true; G.why = d.why || ''; renderResult(); }
  lvSel = Math.max(1, Math.min(lvSel, proto.cleared + 1, T.MAX_LV));
  if (!G) renderMenu();
}

// ---- 菜单 ----
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿' : n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万' : String(Math.floor(n));
const upName = id => T.TOWERS[id].name;
const upDesc = (id, lv) => `伤害 ×${(1.15 ** lv).toFixed(2)} · ${TW[id].desc}`;
function upRow(id) {
  const lv = proto.lv[id], max = lv >= T.MAX_UP, p = T.price(id, lv);
  return `<div class="tr"><div class="t"><b>${upName(id)} Lv${lv}</b><small>${upDesc(id, lv)}${TW[id].syn ? '<br>★ ' + TW[id].syn : ''}</small></div><button class="buy" data-up="${id}" type="button" ${max || !canSpend(p) ? 'disabled' : ''}>${max ? '满级' : fmt(p) + ' 金币'}</button></div>`;
}
function renderMenu() {
  const h = T.HEROES[cmdSel];
  $('#heroImg').src = `../art/face_${cmdSel}.webp`; $('#heroImg').alt = h.name;
  $('#heroName').textContent = `统帅：${h.name}`;
  $('#heroDesc').innerHTML = `${cmdDetail(cmdSel)}<br>统帅不上地图、不参与攻击；作战单位只有 8 种防御塔。建设点持有上限400，本局累计收入预算${NORMAL_BUDGET[cmdSel]}（含初始；退款不恢复额度），普通无总塔数限制，无尽最多25座；CEO每种1座，共4种；战斗每秒恢复0.5、每波最多30秒，倒计时及暂停不恢复。选塔查看属性，点格子预览后确认建造。`;
  $('#cmdPick').innerHTML = T.CEO_IDS.map(id => `<button type="button" data-cmd="${id}" class="${id === cmdSel ? 'on' : ''}"><img src="../art/face_${id}.webp" alt="">${T.HEROES[id].name}</button>`).join('');
  $('#lvTxt').textContent = `第 ${lvSel} 关`;
  $('#lvTxt').textContent = T.MAX_LV > 1 ? `第 ${lvSel} 关` : '科技园区';
  $('#lvInfo').textContent = `${T.WAVES} 波 · 第 5 波小 Boss · 第 10 波 Boss（漏过扣 20 生命）`;
  $('#lvProg').textContent = proto.cleared ? '已通关 ✓' : `最佳 ${proto.best}/${T.WAVES} 波`;
  $('#lvPrev').classList.toggle('hidden', T.MAX_LV <= 1); $('#lvNext').classList.toggle('hidden', T.MAX_LV <= 1);
  $('#lvPrev').disabled = lvSel <= 1; $('#lvNext').disabled = lvSel >= Math.min(T.MAX_LV, proto.cleared + 1);
  $('#walletLbl').textContent = EMBED ? '经营金币' : '模拟余额';
  $('#walletTxt').textContent = proto.ready ? fmt(proto.coins) : '…';
  $('#upNote').textContent = !EMBED ? '单独打开是原型模式：用模拟金币，不碰经营存档。局内造塔用建设点，每局重置。' : proto.blocked ? '存档异常（只读），现在不能升级' : '花的是经营金币；塔防本身不产金币。';
  $('#protoStatus').textContent=EMBED?'':protoPending?'正在安全保存…':protoNotice;
  $('#upTowers').innerHTML = TIDS.map(upRow).join('');
  $('#legacyCmdNote').textContent = T.CEO_IDS.some(id => proto.lv['cmd_'+id] > 0) ? '77与火箭的建设点能力自动生效；阿宅与珍珠需点击战斗顶部技能键。同名塔增强自动生效。旧攻击/技能升级记录保留但不再生效，不折算为新能力或塔加成；不提供统帅升级。' : '77与火箭的建设点能力自动生效；阿宅与珍珠需点击战斗顶部技能键。同名塔增强自动生效，不提供统帅升级。';
  $('#exitBtn').classList.toggle('hidden', !EMBED);
  $('#startBtn').disabled = !proto.ready || proto.blocked || pend || protoPending || !!localBuy;
  $('#buyRetryBtn').classList.toggle('hidden', !(buyTimedOut||localBuy));
}
function buyUp(id) {
  if (!T.TOWER_IDS.includes(id)) return false;
  const lv = proto.lv[id]; if (lv >= T.MAX_UP) return false;
  const p = T.price(id, lv); if (!canSpend(p)) return false;
  if (EMBED) { pend = true; buyRequest = { td:'buy', id, requestId:'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) }; sendBuy(); renderMenu(); return true; }
  localBuy={id,expectedLevel:lv,requestId:'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};protoTask=purchaseProto();return true;
}
function sendBuy() {
  if (!buyRequest) return;
  buyTimedOut = false; host(buyRequest); clearTimeout(buyTimer);
  buyTimer = setTimeout(() => { if (!buyRequest) return; buyTimedOut = true; renderMenu(); toast('升级确认超时，可重试确认；不会重复扣款'); }, 4000);
}
$('#buyRetryBtn').onclick = () => { if(!EMBED)return purchaseProto();sendBuy();renderMenu(); };
$('#menu').addEventListener('click', e => {
  SFX.unlock();
  const u = e.target.closest('[data-up]'); if (u) return buyUp(u.dataset.up);
  const c = e.target.closest('[data-cmd]'); if (c) { if(!EMBED)return selectProto(c.dataset.cmd);cmdSel=c.dataset.cmd;renderMenu(); }
});
$('#lvPrev').onclick = () => { lvSel = Math.max(1, lvSel - 1); renderMenu(); };
$('#lvNext').onclick = () => { lvSel = Math.min(T.MAX_LV, proto.cleared + 1, lvSel + 1); renderMenu(); };
$('#exitBtn').onclick = () => host({ td: 'close' });

// ---- 一局 ----
let G = null, paused = false, raf = 0, last = 0, sel = null, clockRemainder = 0;
const FIXED_DT = 1/60;
function setSpeed(value){if(!G)return false;G.speed=value===2?2:1;hud();return true;}
// Real-time preparation; combat alone consumes two identical simulation steps at ×2.
function advanceClock(seconds){
 if(!G||G.over||G.pendStart||paused||document.hidden){clockRemainder=0;return;}
 if(!Number.isFinite(seconds))return;
  clockRemainder+=Math.max(0,seconds);
 while(clockRemainder+1e-10>=FIXED_DT){
  clockRemainder=Math.max(0,clockRemainder-FIXED_DT);
  const count=(G.q.length||alive().length)?G.speed:1;
  for(let i=0;i<count;i++){if(G.over||paused||document.hidden)break;step(FIXED_DT);if(!G.q.length&&!alive().length)break;}
  if(G.over){clockRemainder=0;break;}
 }
}
const tDmg = id => 1.15 ** proto.lv[id];
const gl = () => CMD[G.cmd].g;
function start(n) {
  if (protoPending||localBuy||(EMBED && (proto.blocked || pend))) return false;
  n = Math.max(1, Math.min(T.MAX_LV, proto.cleared + 1, Math.floor(fin(n, lvSel))));
  if (!proto.ready) return false;
  SFX.unlock();
  G = { n, cmd: cmdSel, W: T.WAVES, wave: 0, q: [], spawnT: 0, breakT: 20, speed:1, es: [], tw: new Map(), fx: [], lives: LIVES, cash: START_PTS+(cmdSel==='c77'?ENERGY.start77:0), normalBudget:NORMAL_BUDGET[cmdSel], energyEarned:START_PTS+(cmdSel==='c77'?ENERGY.start77:0), interestSeconds:0, skillLeft:0, skillCooldown:0, kills: 0, t: 0, damageByTower: {}, over: false, win: false, runId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), pendStart: EMBED };
  if (EMBED) { const game = G; host({ td: 'start', runId: G.runId, n, cmd: G.cmd }); G.startTO = setTimeout(() => { if (G === game && G.pendStart) abortStart('开局登记超时'); }, 4000); }
  paused = false; clockRemainder=0; SFX.newTrack(); SFX.setPaused(false); sel = {k:'build',id:null,x:null,y:null}; show(null); bar(); resize(); hud(); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); bgmTry();
  return true;
}
function abortStart(why) { SFX.stopBgm(); G = null; show('#menu'); renderMenu(); toast(why); }
function nextWave() {
  if (!G || G.over || G.pendStart || (!G.endless && G.wave >= G.W) || G.q.length || alive().length || G.breakT > 0 || paused) return;
  G.q = waveList(G.wave); G.wave++; G.interestSeconds=0; G.breakT = 0; G.spawnT = 0; SFX.cue('wave'); toast(`第 ${G.wave} 波`); bar();
}
// Normal waves4–10 gain graduated durability; endless stats remain the reviewed baseline.
function spawn(type) {
  const b = EN[type],k=Math.max(0,G.wave-T.WAVES),hp = Math.min(1e12,(type==='boss'&&!G.endless?800:b.hp) * hpMul(Math.min(G.wave-1,9)) * (G.endless||type==='boss'?1:1+.5*Math.max(0,Math.min(G.wave-1,9)-2)) * (G.endless?Math.pow(1.12,Math.min(k,300)):1));
  G.es.push({ type, d: 0, hp, max: hp, sp: b.sp*(G.endless?Math.min(1.25,1+.01*k):1), r: b.r, slowT: 0, slowK: 1, stunT: 0, burnT: 0, burnD: 0, x: -0.5, y: 1.5 });
}
const alive = () => G.es.filter(e => e.hp > 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function inRange(p, r) { return alive().filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= r).sort((a, b) => b.d - a.d); }
function hit(e, dmg, o, source) {
  if (!e || e.hp <= 0 || !TIDS.includes(source)) return;
  dmg *= burstMultiplier();
  G.damageByTower[source] = (G.damageByTower[source] || 0) + dmg;
  e.hp -= dmg; if (!o || !o.dot) { SFX.hit(); e.flash = 0.12; }
  if (o && o.slow) { e.slowT = Math.max(e.slowT, o.slowT || 1); e.slowK = Math.min(e.slowK === 1 ? 1 : e.slowK, 1 - o.slow); }
  if (o && o.stun && e.type !== 'boss' && e.type !== 'mini') e.stunT = Math.max(e.stunT, o.stun);
  if (o && o.burn) { e.burnT = Math.max(e.burnT, o.burnT || 3); if (o.burn >= e.burnD) e.burnSource = source; e.burnD = Math.max(e.burnD, o.burn); }
  if (e.hp <= 0) { G.kills++; gainEnergy(EN[e.type].cash); SFX.kill(e.type === 'boss'); G.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0.3, c: '#fff' }); }
}
const line = (a, b, c, t = 0.12) => G.fx.push({ k: 'line', x: a.x, y: a.y, x2: b.x, y2: b.y, c, t, t0: t });
const ring = (p, r, c, t = 0.3) => G.fx.push({ k: 'ring', x: p.x, y: p.y, r, c, t, t0: t });
// 线段上的敌人：从 p 朝 dir 方向 len 格、半宽 w
function onLine(p, dir, len, w) { return alive().filter(e => { const vx = e.x - p.x, vy = e.y - p.y, t = vx * dir.x + vy * dir.y; return t >= 0 && t <= len && Math.abs(vx * dir.y - vy * dir.x) <= w + e.r; }).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)); }
const towerRange = tw => TW[tw.id].range + 0.2 * (tw.lv - 1) + (gl().range || 0);
function towerFire(tw) {
  const strike = (e, dmg, options) => hit(e, dmg, options, tw.id);
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
        .forEach(e => strike(e, dmg, { burn: Math.max(dmg * s.burn, gb ? gb.burn : 0), burnT: s.burnT }));
      break;
    }
    case 'aura': ring(p, range, s.col, 0.25); tg.forEach(e => strike(e, dmg, Object.assign({ slow: Math.min(0.75, s.slow + 0.01 * proto.lv.tea), slowT: s.slowT }, gb))); break;
    case 'pierce': { const hs = onLine(p, dir, range + 0.5, s.width).slice(0, s.pierce); line(p, { x: p.x + dir.x * (range + 0.5), y: p.y + dir.y * (range + 0.5) }, s.col, 0.15); hs.forEach(e => strike(e, dmg, gb)); break; }
    case 'chain': { let cur = e0, k = dmg; const hs = new Set([e0]); line(p, e0, s.col); strike(e0, k, gb);
      for (let i = 0; i < s.chain; i++) { const nx = inRange(cur, s.jump).find(x => !hs.has(x)); if (!nx) break; k *= s.fall; line(cur, nx, s.col); strike(nx, k, gb); hs.add(nx); cur = nx; } break; }
    case 'burn': line(p, e0, s.col); strike(e0, dmg, { burn: dmg * s.burn * (syn ? s.synBurn : 1) + (gb ? gb.burn : 0), burnT: syn ? s.synBurnT : s.burnT }); break;
    case 'bounce': { let cur = e0, prev = p, k = dmg; const hs = new Set(), n = s.bounce + (syn ? s.synBounce : 0);
      for (let i = 0; i <= n && cur; i++) { line(prev, cur, s.col); strike(cur, k, gb); hs.add(cur); prev = cur; k *= s.fall; cur = inRange(cur, s.jump).find(x => !hs.has(x)); } break; }
    case 'boomerang': { const w = syn ? s.synWidth : s.width, hs = onLine(p, dir, range, w);
      G.fx.push({ k: 'boom', x: p.x, y: p.y, x2: p.x + dir.x * range, y2: p.y + dir.y * range, c: s.col, t: 0.4, t0: 0.4 });
      hs.forEach(e => strike(e, dmg, gb)); hs.forEach(e => strike(e, dmg * (syn ? s.synBack : s.back))); break; }
    case 'splash': { const r = syn ? s.synRad : s.rad; line(p, e0, s.col, 0.2); ring(e0, r, s.col); inRange(e0, r).forEach(x => strike(x, dmg, gb)); break; }
  }
  return true;
}
const ceoBlocked = id => !!T.TOWERS[id]?.ceo && !!G && [...G.tw.values()].some(t=>t.id===id);
function build(id, x, y) {
  if (!G || G.over || G.pendStart || paused || !Number.isInteger(x) || !Number.isInteger(y) || !TW[id] || x < 0 || y < 0 || x >= COLS || y >= ROWS || isPath(x, y) || G.tw.has(x + ',' + y)) return false;
  if(ceoBlocked(id)){toast('同种CEO塔最多1座，拆除后可重建');return false;}
  const cost = T.TOWERS[id].cost; if (G.tw.size>=towerLimit()) { toast('无尽最多25座塔，低于上限后可补建'); return false; } if (G.cash < cost) { toast('建设点不足'); return false; }
  SFX.cue('build'); G.cash -= cost; G.tw.set(x + ',' + y, { id, x, y, lv: 1, cd: 0, spent: cost }); sel = null; bar(); return true;
}
function upTower(x, y) {
  if (!G || G.over || paused || G.pendStart) return false;
  const tw = G && G.tw.get(x + ',' + y); if (!tw || tw.lv >= MAX_TLV) return false;
  const c = upCost(tw); if (G.cash < c) return false;
  G.cash -= c; tw.spent += c; tw.lv++; bar(); return true;
}
function sell(x, y) { if (!G || G.over || paused || G.pendStart) return false; const tw = G && G.tw.get(x + ',' + y); if (!tw) return false; const refunded=gainEnergy(sellBack(tw),true); toast(`拆除返还 ${num(refunded)} 建设点（上限${ENERGY.cap}）`); G.tw.delete(x + ',' + y); sel = null; bar(); return true; }

function step(dt) {
  if (!G || G.over || G.pendStart || paused || document.hidden) return;
  dt=Math.max(0,dt); G.t += dt; const combat=G.q.length>0||alive().length>0;
  if(combat){const interest=Math.min(dt,Math.max(0,ENERGY.waveSeconds-G.interestSeconds));G.interestSeconds+=interest;gainEnergy(interest*(ENERGY.baseRate+(G.cmd==='rocket'?ENERGY.rocketRate:0)));}
  if (!G.q.length && (G.endless || G.wave < G.W) && !alive().length) { if (G.breakT <= 0 && G.wave > 0) { G.breakT = 5; gainEnergy(G.endless?50:20 + 5 * G.wave); } const before = Math.ceil(G.breakT); G.breakT = Math.max(0, G.breakT - dt); if (Math.ceil(G.breakT) !== before && G.breakT > 0) SFX.cue('tick'); if (G.breakT <= 1e-9) {G.breakT=0;nextWave();} }
  if (G.q.length) { G.spawnT -= dt; if (G.spawnT <= 0) { const ty = G.q.shift(); spawn(ty); G.spawnT = ty === 'fast' ? 0.5 : ty === 'boss' ? 2 : 0.8; } }
  for (const e of G.es) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.burnT > 0) { e.burnT -= dt; hit(e, e.burnD * dt, {dot:true}, e.burnSource); if (e.hp <= 0) continue; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowK = 1; }
    if (e.stunT > 0) { e.stunT -= dt; } else e.d += e.sp * Math.max(['mini','boss'].includes(e.type)?.5:.25,e.slowK*frostMultiplier()) * dt;
    const [x, y] = posAt(e.d); e.x = x; e.y = y;
    if (e.d >= PLEN) { e.hp = 0; G.lives -= e.type==='boss'&&!G.endless ? 20 : EN[e.type].lives || 1; SFX.hurt(); toast('机房被闯了！'); if (G.lives <= 0) { G.lives = 0; return end(false); } }
  }
  G.es = G.es.filter(e => e.hp > 0);
  for (const tw of G.tw.values()) { tw.flash = Math.max(0, (tw.flash || 0) - dt); tw.cd -= dt; if (tw.cd <= 0 && towerFire(tw)) tw.cd = TW[tw.id].rate * (gl().rate || 1); }
  if(combat){G.skillLeft=Math.max(0,G.skillLeft-dt); G.skillCooldown=Math.max(0,G.skillCooldown-dt);}
  for (const f of G.fx) f.t -= dt;
  G.fx = G.fx.filter(f => f.t > 0);
  if (!G.endless && G.wave >= G.W && !G.q.length && !G.es.length) end(true);
}
function end(win) {
  if (!G || G.over) return;
  G.over = true; G.win = win; SFX.stopBgm(); win ? SFX.win() : SFX.lose();
  const res = Object.freeze(G.endless?{td:'endlessResult',runId:G.runId,n:G.n,cmd:G.cmd,waves:Math.max(0,G.wave-10-((G.lives<=0||G.q.length||alive().length)?1:0)),kills:Math.max(0,G.kills-G.normalResult.kills)}:{ td: 'result', runId: G.runId, n: G.n, win, waves: win ? G.wave : Math.max(0, G.wave - 1), cmd: G.cmd, kills: G.kills });
  if(!G.endless)G.normalResult=res; G.resMsg=res;
  sendResult();
  renderResult(); show('#result');
}
function enterEndless(id){G.runId=id;G.pendingEndless=null;G.endless=true;G.over=false;G.win=false;G.breakT=5;G.resMsg=null;G.saveOk=false;G.wait=false;paused=false;show(null);bar();last=performance.now();bgmTry();}
function continueEndless(){
  if(!G||G.endless||!G.over||!G.win||!G.saveOk||G.wait||G.pendingEndless)return false;
  const id=G.endlessId||(G.endlessId='e_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7));
  if(!EMBED){enterEndless(id);return true;}
  G.pendingEndless=id;host({td:'endlessStart',runId:id,parentRunId:G.runId,n:G.n,cmd:G.cmd});
  const game=G;G.endlessTO=setTimeout(()=>{if(G===game&&G.pendingEndless===id){G.pendingEndless=null;G.why='无尽登记超时，可重试继续';renderResult();}},4000);renderResult();return true;
}
$('#endlessBtn').onclick=continueEndless;
function sendResult() {
  if (!G || !G.resMsg) return;
  if(!EMBED){const game=G,message=G.resMsg;if(G.wait)return;G.wait=true;G.saveOk=false;G.savePromise=protoStore.settle(message).then(r=>{acceptProto(r);if(G!==game||G.resMsg!==message)return;G.wait=false;G.saveOk=r.ok;G.why=r.ok?'':protoNotice;renderResult();});renderResult();return;}
  const game = G; G.wait = true; host(G.resMsg); clearTimeout(G.resultTO);
  G.resultTO = setTimeout(() => { if (G !== game || !G.wait) return; G.wait = false; G.saveOk = false; G.why = '结算确认超时，可重试保存'; renderResult(); }, 4000);
}
function renderResult() {
  if (!G) return;
  const saved = !!G.saveOk;
  $('#endlessBtn').classList.toggle('hidden',!!G.endless||!G.win);$('#endlessBtn').disabled=!G.saveOk||G.wait||!!G.pendingEndless;
  $('#resTitle').textContent = G.wait ? '结算中…' : G.win && saved ? '守住了！' : G.win ? '存档失败' : '机房失守';
  $('#resStats').textContent = `守了 ${G.win ? G.W : Math.max(0, G.wave - 1)}/${G.W} 波 · 击倒 ${G.kills} · 剩余生命 ${G.lives}`;
  $('#resNote').textContent = G.wait ? '' : !saved ? `这局进度没记上${G.why ? '（' + G.why + '）' : ''}` : G.win ? `${T.WAVES} 波全部守住！` : `最佳 ${proto.best}/${T.WAVES} 波 · 调整布阵或升级防御塔再来`;
  if(G.endless){$('#resStats').textContent=`无尽守住 ${Math.max(0,G.wave-10-((G.lives<=0||G.q.length||alive().length)?1:0))} 波 · 击倒 ${G.resMsg?.kills||0}`;$('#resNote').textContent=G.wait?'保存无尽纪录中':saved?`无尽最高 ${proto.endless?.best||0} 波；不发经营金币`:G.why||'无尽纪录未保存';}
  else if(G.pendingEndless||G.why)$('#resNote').textContent=G.pendingEndless?'无尽登记中…':G.why;
  const board=$('#endlessBoard');board.classList.toggle('hidden',!G.endless);
  if(G.endless){const top=proto.endless?.top||[],rank=top.findIndex(e=>e.runId===G.runId),points=T.score(G.resMsg.waves,G.resMsg.kills);board.innerHTML=`<h3>无尽历史 TOP 10</h3><p class="note">分数＝完成无尽波数×1000＋无尽击杀数<br>同分先取得优先</p><ol>${top.map(e=>`<li${e.runId===G.runId?' class="current-score"':''}>${e.score} 分 · ${e.waves} 波 / ${e.kills} 击杀</li>`).join('')}</ol>${!top.length?'<p>暂无已保存历史分数</p>':''}<p class="current-score">本次 ${points} 分 · ${!saved?'尚未保存，名次待确认':rank>=0?'历史第 '+(rank+1)+' 名':'未上榜'}</p>`;}
  $('#retryBtn').classList.toggle('hidden', !(!G.wait && !G.saveOk));
  $('#againBtn').textContent = G.win && saved && G.n < T.MAX_LV ? '下一关' : '再来一局';
  $('#againBtn').disabled = !!G.wait;
}
$('#retryBtn').onclick = () => { if (G && G.over && !G.wait && G.resMsg) { sendResult(); renderResult(); } };
$('#againBtn').onclick = () => { if (!G || G.wait) return; const n = G.win && (!EMBED || G.saveOk) ? G.n + 1 : G.n; G = null; lvSel = Math.min(T.MAX_LV, proto.cleared + 1, n); start(lvSel); };
$('#menuBtn').onclick = () => { if (G && G.wait) return; G = null; SFX.stopBgm(); show('#menu'); renderMenu(); };
function setPause(on) { if (!G || G.over) return; paused = on; clockRemainder=0; if (on) SFX.stopBgm(); else { SFX.unlock(); bgmTry(); } SFX.setPaused(on); show(on ? '#pause' : null); if (!on) last = performance.now(); hud(); }
$('#pauseBtn').onclick = () => setPause(true);
$('#resumeBtn').onclick = () => setPause(false);
$('#sndBtn').onclick = () => { userMute = !userMute; SFX.unlock(); applyMute(); };
$('#quitBtn').onclick = () => { if (!G) return; paused = false; G.pendStart ? abortStart('已退出') : end(false); };
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });
$('#startBtn').onclick = () => start(lvSel);

// ---- HUD / 底栏 ----
let toastT = 0;
function toast(s) { const t = $('#toast'); t.textContent = s; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1200); }
function show(id) { for (const s of ['#menu', '#pause', '#result']) $(s).classList.toggle('hidden', s !== id); $('#hud').classList.toggle('hidden', id === '#menu'); }
function hud() {
  if (!G) return;
  $('#budgetInfo').textContent = G.endless ? '无尽：累计收入不限；持有上限400' : `累计收入 ${Math.ceil(G.energyEarned)}/${G.normalBudget} · 退款不恢复额度`;
  $('#lifeTxt').textContent = `❤ ${G.lives}`; $('#cashTxt').textContent = `建设点 ${Math.floor(G.cash)}/${ENERGY.cap}`; $('#waveTxt').textContent = G.endless?`无尽 ${G.wave-10}`:`波 ${G.wave}/${G.W}`;
  $('#passiveStatus').textContent = `塔 ${G.tw.size}/${G.endless?ENERGY.endlessTowers:"∞"} · `+(!G.endless && G.energyEarned>=G.normalBudget?'预算已用尽':G.interestSeconds<ENERGY.waveSeconds && (G.q.length||alive().length)?`+${ENERGY.baseRate+(G.cmd==='rocket'?ENERGY.rocketRate:0)}/秒`:'恢复暂停');
  for(const id of ['#speedBtn','#pauseSpeedBtn']){const b=$(id);b.textContent=`速度 ×${G.speed}`;b.setAttribute('aria-label',`游戏速度 ${G.speed} 倍，点击切换`);b.setAttribute('aria-pressed',String(G.speed===2));}
  const skill=$('#skillBtn'),hasSkill=['otaku','pearl'].includes(G.cmd);skill.classList.toggle('hidden',!hasSkill);
  skill.disabled=paused||document.hidden||G.over||G.pendStart||G.cash<=0||G.skillCooldown>0||(!G.q.length&&!alive().length);
  skill.textContent=hasSkill?`${skillName()}\n${G.skillLeft>0?`${Math.ceil(G.skillLeft)}秒 · ${num((G.cmd==='otaku'?ENERGY.burstMax:ENERGY.frostMax)*energyRatio()*100)}%`:G.skillCooldown>0?`冷却 ${Math.ceil(G.skillCooldown)}秒`:!G.q.length&&!alive().length?'战斗开始可用':G.cash<=0?'需建设点':'可用'}`:'';
  skill.setAttribute('aria-label',hasSkill?`${skillName()}，${G.skillLeft>0?'持续中':G.skillCooldown>0?'冷却中':!G.q.length&&!alive().length?'战斗开始可用':G.cash<=0?'需要建设点':'准备就绪'}`:'无手动技能');
  if(sel?.k==='build'&&sel.id)$('#buildInfo').innerHTML=towerSummary(sel.id);
  if(sel?.k==='tower'){const tw=G.tw.get(sel.x+','+sel.y);if(tw){$('#twInfo').innerHTML=towerSummary(tw.id,tw.lv);$('#twSell').textContent=`拆除 +${num(Math.min(sellBack(tw),ENERGY.cap-G.cash))}（封顶${ENERGY.cap}）`;}}

  const canWave = !G.q.length && (G.endless || G.wave < G.W) && !alive().length && !G.pendStart;
  $('#waveBtn').classList.toggle('hidden', canWave); $('#waveBtn').textContent = canWave ? `第 ${G.wave + 1} 波 · ${Math.max(1, Math.ceil(G.breakT))} 秒` : G.pendStart ? '登记中' : '进攻中';
  $('#countdown').classList.toggle('hidden', !canWave || paused || G.over);
  $('#countdown').textContent = `第 ${G.wave + 1} 波即将来临 · ${Math.max(1, Math.ceil(G.breakT))}`;
  if (sel && sel.k === 'build' && sel.id) $('#buildConfirm').disabled = sel.x === null || isPath(sel.x,sel.y) || G.tw.has(sel.x+','+sel.y) || G.cash < T.TOWERS[sel.id].cost || G.tw.size>=towerLimit() || ceoBlocked(sel.id) || G.pendStart;
  if (sel && sel.k === 'tower') { const tw = G.tw.get(sel.x + ',' + sel.y); if (tw) $('#twUp').disabled = tw.lv >= MAX_TLV || G.cash < upCost(tw); }
}
function bar() {
  $('#barMain').classList.toggle('hidden', !!sel && sel.k === 'tower'); $('#barBuild').classList.toggle('hidden', !!sel && sel.k === 'tower'); $('#barTower').classList.toggle('hidden', !sel || sel.k !== 'tower');
  if (!G) return;
  if (!sel || sel.k === 'build') { const choice = sel || {}, scroll = $('#twGrid').scrollLeft || 0; $('#twGrid').innerHTML = TIDS.map(id => `<button type="button" data-tw="${id}" class="${T.TOWERS[id].ceo === G.cmd ? 'syn' : ''} ${choice.id === id ? 'chosen' : ''}">${T.TOWERS[id].ceo === G.cmd ? '★' : ''}${T.TOWERS[id].name}<small>${T.TOWERS[id].ceo?'CEO·每种1':'店铺·可重复'} ${T.TOWERS[id].cost}</small></button>`).join('');
    $('#twGrid').scrollLeft = scroll;
    $('#buildInfo').innerHTML = choice.id ? towerSummary(choice.id) : '';
    $('#buildInspector').classList.toggle('hidden', !choice.id);
    $('#buildConfirm').disabled = !choice.id || choice.x === null || isPath(choice.x, choice.y) || G.tw.has(choice.x+','+choice.y) || G.cash < T.TOWERS[choice.id].cost || G.tw.size>=towerLimit() || ceoBlocked(choice.id);
    $('#buildConfirm').textContent = choice.id ? (ceoBlocked(choice.id)?'此CEO已有1座':`建造 · ${T.TOWERS[choice.id].cost}`) : '请选择塔';
  }
  if (sel && sel.k === 'tower') {
    const tw = G.tw.get(sel.x + ',' + sel.y); if (!tw) { sel = null; return bar(); }
    const syn = T.TOWERS[tw.id].ceo === G.cmd;
    $('#twInfo').innerHTML = towerSummary(tw.id, tw.lv);
    $('#twUp').textContent = tw.lv >= MAX_TLV ? '已满级' : `升级 ${upCost(tw)}`; $('#twSell').textContent = `拆除 +${sellBack(tw)}`;
  }
  resize(); positionBuildActions(); hud();
}
$('#twGrid').addEventListener('click', e => { const b = e.target.closest('[data-tw]'); if (b) { sel = {k:'build',id:b.dataset.tw,x:null,y:null}; bar(); } });
$('#buildConfirm').onclick = () => { if (sel && sel.id && sel.x !== null) build(sel.id, sel.x, sel.y); };
$('#buildX').onclick = $('#cancelChoice').onclick = $('#twX').onclick = () => { sel = null; bar(); };
$('#twUp').onclick = () => { if (sel) upTower(sel.x, sel.y); };
$('#skillBtn').onclick = activateSkill;
$('#speedBtn').onclick=$('#pauseSpeedBtn').onclick=()=>setSpeed(G?.speed===2?1:2);
$('#twSell').onclick = () => { if (sel) sell(sel.x, sel.y); };

function openTowerDetails() {
  if (!G || G.over || G.pendStart || !sel) return;
  const tw = sel.k === 'tower' ? G.tw.get(sel.x+','+sel.y) : sel.id ? {id:sel.id,lv:1} : null;
  if (!tw) return;
  $('#fullTowerInfo').innerHTML = towerDetail(tw.id,tw.lv); setPause(true);
  $('#towerDetails').classList.remove('hidden'); $('#closeDetails').focus?.();
}
$('#detailsBtn').onclick = $('#twDetails').onclick = openTowerDetails;
$('#closeDetails').onclick = () => { $('#towerDetails').classList.add('hidden'); setPause(false); (sel?.k === 'tower' ? $('#twDetails') : $('#detailsBtn')).focus?.(); };
addEventListener('keydown', e => { if(e.key === 'Escape' && !$('#towerDetails').classList.contains('hidden')) $('#closeDetails').onclick(); });

// ---- 画面 ----
const cv = $('#cv'), cx = cv.getContext('2d');
let W = 0, H = 0, S = 40, OX = 0, OY = 0;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const top = 88 + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || 0), bot = (barMaxH() || 110) + 6;
  S = Math.floor(Math.min((W - 12) / COLS, (H - top - bot) / ROWS)); OX = Math.round((W - S * COLS) / 2); OY = Math.round(top + Math.max(0, (H - top - bot - S * ROWS) / 2));
}
addEventListener('resize', resize);
// Actual compact dock height; only choosing/closing inspection changes map layout.
function barMaxH() { return $('#bar').offsetHeight || 128; }
function positionBuildActions() {
  const el = $('#buildActions'), active = sel?.k === 'build' && sel.id && sel.x !== null;
  el.classList.toggle('hidden', !active || paused || G?.over);
  if (!active) return;
  const width = Math.min(214, innerWidth-16), x = px(sel.x+.5), y = py(sel.y);
  el.style.width = width+'px'; el.style.left = Math.max(8,Math.min(innerWidth-width-8,x-width/2))+'px';
  const below = y+S+8; const bottom = innerHeight-barMaxH();
  el.style.top = (below+48 < bottom ? below : Math.max(56,y-56))+'px';
}

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
    const blocked = isPath(sel.x,sel.y) || G.tw.has(sel.x+','+sel.y) || ceoBlocked(sel.id) || G.tw.size>=towerLimit();
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
  for (const f of G.fx) {
    const a = Math.max(0, f.t / (f.t0 || 0.3));
    cx.globalAlpha = a;
    if (f.k === 'line') { cx.strokeStyle = f.c; cx.lineWidth = 5; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(px(f.x), py(f.y)); cx.lineTo(px(f.x2), py(f.y2)); cx.stroke(); cx.strokeStyle = '#fffaf0'; cx.lineWidth = 1.5; cx.stroke(); cx.lineWidth = 1; }
    else if (f.k === 'ring') { cx.strokeStyle = f.c; cx.lineWidth = 3; cx.beginPath(); cx.arc(px(f.x), py(f.y), f.r * S * (1.1 - a * 0.3), 0, 7); cx.stroke(); cx.lineWidth = 1; }
    else if (f.k === 'pop') { cx.strokeStyle = '#e8590c'; cx.lineWidth=2; for(let i=0;i<6;i++){const angle=i*Math.PI/3,rr=S*(1-a)*.6;cx.beginPath();cx.moveTo(px(f.x)+Math.cos(angle)*rr,py(f.y)+Math.sin(angle)*rr);cx.lineTo(px(f.x)+Math.cos(angle)*(rr+4),py(f.y)+Math.sin(angle)*(rr+4));cx.stroke();} cx.lineWidth=1; cx.fillStyle = YEL; cx.beginPath(); cx.arc(px(f.x), py(f.y), S * 0.3 * (1.5 - a), 0, 7); cx.fill(); }
    else if (f.k === 'cone') { cx.fillStyle = f.c; cx.globalAlpha = 0.35 * a; cx.beginPath(); cx.moveTo(px(f.x), py(f.y)); cx.arc(px(f.x), py(f.y), f.r * S, f.a - f.h, f.a + f.h); cx.closePath(); cx.fill(); }
    else if (f.k === 'boom') { const u = 1 - a, k = u < 0.5 ? u * 2 : 2 - u * 2; cx.fillStyle = f.c; cx.fillRect(px(f.x + (f.x2 - f.x) * k) - S * 0.18, py(f.y + (f.y2 - f.y) * k) - S * 0.22, S * 0.36, S * 0.44); }
    else if (f.k === 'txt') { cx.fillStyle = RED; cx.font = `900 ${Math.round(S * 0.32)}px sans-serif`; cx.fillText(f.s, px(f.x), py(f.y)); }
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
  const dt = Math.max(0, (now - last) / 1000); last = now;
  advanceClock(dt);
  draw(); hud(); positionBuildActions();
  raf = requestAnimationFrame(loop);
}
window.render_game_to_text = () => JSON.stringify({mode:!G?'menu':G.over?'result':paused?'paused':'playing',coordinates:'grid origin top-left, x right, y down',wave:G?.wave,countdown:G?.breakT,speed:G?.speed,cash:G?.cash,lives:G?.lives,passiveCommander:G?.cmd,damageByTower:G?.damageByTower,energyCap:ENERGY.cap,energyEarned:G?.energyEarned,normalBudget:G?.endless?null:G?.normalBudget,towerLimit:G?.endless?ENERGY.endlessTowers:null,interestSeconds:G?.interestSeconds,skillLeft:G?.skillLeft,skillCooldown:G?.skillCooldown,selection:sel,towers:G?[...G.tw.values()]:[],enemies:G?.es});
window.advanceTime = ms => { advanceClock(Math.max(0,ms)/1000); draw(); hud(); };
resize(); renderMenu(); show('#menu'); raf = requestAnimationFrame(loop);
window.__td = { EMBED, proto, protoStore, selectProto, setSpeed, advanceClock, P, ENERGY, NORMAL_BUDGET, towerLimit, ceoBlocked, continueEndless, end, spawn, activateSkill, burstMultiplier, frostMultiplier, gainEnergy, hit, towerFire, towerRange, start, step, build, upTower, sell, nextWave, buyUp, onState, setPause, renderMenu, isPath, waveList, PLEN, TW, CMD,
  get protoPending(){return protoPending;}, get protoTask(){return protoTask;}, get G() { return G; }, get geo() { return { S, OX, OY, COLS, ROWS }; }, get lastSent() { return lastSent; }, get pend() { return pend; }, get paused() { return paused; }, get cmdSel() { return cmdSel; }, set cmdSel(v) { if (T.CEO_IDS.includes(v)) { cmdSel = v; renderMenu(); } } };
})();
