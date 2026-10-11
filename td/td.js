'use strict';
// 科技公司塔防：50个独立关卡、6张地图；每关10–14波，通关终极Boss后随机地图无尽。
// 单独打开 = 原型模式（模拟余额，只存 PROTO_KEY）；?embed=1 嵌在经营页里 = 金币、升级、进度都由经营页管（td:* postMessage），本页不写任何存档。
(() => {
const T = window.TDCore, Waves = window.TDWaves, Campaign = window.TDCampaign, Progress = window.TDStageProgress, SFX = window.ZBSfx;
const STAGE_COUNT = Campaign.STAGE_COUNT, RULESET_ID = Campaign.RULESET_ID;
const EMBED = /[?&]embed=1(&|$)/.test(location.search) && window.parent !== window;
const PROTO_KEY = 'tangzhe-formal-td-proto-v1';
const $ = s => document.querySelector(s);
const fin = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const INK = '#141414', PAPER = '#f7f1e3', RED = '#e63946', YEL = '#ffd23f';

// ---- Active map is selected once at entry; waves never rotate the route. ----
let activeMap=Campaign.getMap('courtyard'), COLS=activeMap.cols, ROWS=activeMap.rows, WAY=activeMap.way, PATH=new Set(), SEG=[], PLEN=0;
function setMap(id){activeMap=Campaign.getMap(id);COLS=activeMap.cols;ROWS=activeMap.rows;WAY=activeMap.way;const r=Campaign.route(id);PATH=r.path;SEG=r.segments;PLEN=r.length;}
setMap('courtyard');
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
const LIVES = 20, START_PTS = 120;
const ENERGY = Object.freeze({ cap:400, baseRate:.5, waveSeconds:30, start77:60, rocketRate:.5, burstSeconds:10, burstCooldown:15, burstMax:.30, frostSeconds:5, frostCooldown:30, frostMax:.45 });
const towerLimit = () => G?.endless ? Math.floor(COLS*ROWS/3) : Infinity;
// Each stage/map/commander has a separately sampled cumulative income budget.
const BUDGET_VERIFIED = Campaign.BUDGET_VERIFIED;
const MIN_VERIFIED_BUDGET = Campaign.VERIFIED_BUDGETS;
const NORMAL_BUDGET = (n,cmd) => Campaign.getBudget(n,cmd);
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
// Consume the data module exactly once; no second HP growth or reward formula.
function waveSpec(wave) {
  if(!G)throw Error('wave needs an active stage');
  const spec=Campaign.getWave(G.n,wave,{endless:!!G.endless,seed:G.seed});
  if(spec.rulesVersion!==RULESET_ID||spec.mapId!==G.mapId||spec.wave!==wave||!Array.isArray(spec.queue)||!spec.queue.length||!Number.isFinite(spec.waveEndEnergy)||spec.waveEndEnergy<0||spec.queue.some(id=>!EN[id]||!spec.enemies[id]||!['hp','speed','leak'].every(k=>Number.isFinite(spec.enemies[id][k])&&spec.enemies[id][k]>0)))throw Error('campaign wave data mismatch');
  return spec;
}
function waveList(w) { return waveSpec(w+1).queue.slice(); }
const SPECIAL = Object.freeze({
  bbq:'每第4次有效攻击改为环形扫击，替代该次扇形',
  tea:'每6战斗秒可冻结普通敌人0.4秒；目标全局抗控4秒，小Boss/Boss免疫',
  book:'前4个穿透目标依次造成100% / 110% / 120% / 130%伤害',
  tech:'至少跳跃一次后，对存活首目标回击35%首伤，仅一次',
  t77:'主动命中之前已经燃烧的目标，追加25%直接伤害',
  tpearl:'末跳向最多2个本轮未命中目标各分珠25%首伤，不再弹跳',
  totaku:'回程使普通敌人后退0.25格；与冻结共用4秒抗控，小Boss/Boss免疫',
  trocket:'爆心0.35格内伤害增加25%，外围伤害不变'
});

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
  return `<b>${T.TOWERS[id].name} · Lv${lv}</b><br>${T.TOWERS[id].ceo?'CEO塔：每种最多1座，四种可共存':'店铺塔：可重复建造'}（普通无总数限制；无尽最多25）<br>目标：地面敌人（含 Boss），优先最前方<br>伤害 ${num(dmg)} · 间隔 ${num(s.rate*(g.rate||1))}秒 · 范围 ${num(towerRange({id,lv}))}格<br>${extra}${g.burn && !['burn','cone'].includes(s.kind)?`；命中燃烧 ${num(dmg*g.burn)}/秒 ×${g.burnT}秒（回程除外）`:''}${g.crit?`；${g.crit*100}% 暴击 ×${g.critX}（以上为非暴击）`:''}${syn?'<br>★ '+s.syn.split('：')[1]:''}<br><b>${lv===MAX_TLV?'已解锁':'Lv3解锁'}：</b>${SPECIAL[id]}`;
}

// ---- 金币 / 存档（原型）----
const protoStore=EMBED?null:window.TDProto.create({storage:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},locks:()=>window.navigator?.locks,T,Progress});
const loadedProto=EMBED?null:protoStore.load();
const proto=Object.assign({coins:0,ready:!EMBED&&loadedProto.ok,blocked:false,tdCampaign:Progress.fresh()},EMBED?T.norm(null):loadedProto.state);
const progress = () => Progress.check(proto.tdCampaign).length ? Progress.fresh() : (proto.tdCampaign || Progress.fresh());
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
const host = m => { lastSent = Object.assign({ruleset:RULESET_ID},m); if (port) port.postMessage(lastSent); };
const canSpend = n => proto.ready && !pend && !protoPending && !localBuy && !proto.blocked && isFinite(n) && n > 0 && proto.coins >= n;
if (EMBED) window.addEventListener('message', e => {
  if (port || e.source !== window.parent || e.origin !== location.origin || !e.data || e.data.td !== 'port' || !e.ports[0]) return;
  port = e.ports[0]; port.onmessage = ev => onState(ev.data); host({ td: 'hello', protocol:3 });
});
let hostMute = false, userMute = false;
function bgmOk() { return !hostMute && !userMute && !!G && !G.over && !G.pendStart && !paused && !document.hidden; }
function bgmTry() { if (bgmOk()) SFX.startBgm(G.n * 5); }
function applyMute() { SFX.setMuted(hostMute || userMute); bgmTry(); $('#sndBtn').textContent = hostMute ? '经营页已静音' : userMute ? '声音：关' : '声音：开'; }
function onState(d) {
  if (!d || d.td !== 'state') return;
  if (d.ruleset !== RULESET_ID || d.protocol !== 3 || d.tdCampaign===undefined || Progress.check(d.tdCampaign).length) { proto.ready=false; proto.blocked=true; protoNotice='塔防规则版本不一致，请刷新经营页与塔防页'; if(G&&!G.over&&!G.pendStart){setPause(true);toast(protoNotice);}if(G?.pendStart)abortStart(protoNotice); if(G?.wait){G.wait=false;G.saveOk=false;G.why=protoNotice;renderResult();} if(!G)renderMenu(); return; }
  if (d.ack === 'buy' && (!buyRequest || d.requestId !== buyRequest.requestId || d.id !== buyRequest.id)) return;
  if (['start','endlessStart'].includes(d.ack) && (!G || !G.pendStart || d.runId !== G.runId)) return;
  if (['result','endlessResult'].includes(d.ack) && (!G || !G.over || !G.resMsg || d.runId !== G.runId || (G.saveOk && d.ok !== true))) return;
  if (d.ack === 'buy' && buyRequest && d.requestId === buyRequest.requestId && d.id === buyRequest.id) {
    clearTimeout(buyTimer);
    if(d.ok!==true&&d.uncertain){pend=true;buyTimedOut=true;}else{pend=false;buyRequest=null;buyTimedOut=false;}
    if (!d.ok) toast(d.why || '升级没有生效');
  }
  if (EMBED && !cmdRestored && d.z) { cmdSel = T.norm(d.z).cmd; cmdRestored = true; }
  protoNotice='';proto.coins = Math.max(0, fin(d.coins, 0)); proto.blocked = !!d.blocked; Object.assign(proto, T.norm(d.z), {tdCampaign:d.tdCampaign}); proto.ready = true;
  if ('muted' in d) { hostMute = !!d.muted; applyMute(); }
  if (['start','endlessStart'].includes(d.ack) && G && G.pendStart && d.runId === G.runId) {
    clearTimeout(G.startTO);
    if(d.ok===true&&(d.n!==G.n||d.cmd!==G.cmd||d.mapId!==G.mapId||d.seed!==G.seed)){failStart('开局确认内容不一致，未开始');return;}
    if (d.ok === true) { G.pendStart = false; G.startFailed=''; paused=false; show(null); bgmTry(); } else failStart(d.why || '开局没登记上');
  }
  if (['result','endlessResult'].includes(d.ack) && G && G.over && G.resMsg && d.runId === G.runId) { clearTimeout(G.resultTO); G.wait = false; G.saveOk = d.ok === true; G.why = d.why || ''; renderResult(); }
  lvSel = Math.max(1, Math.min(lvSel, progress().unlocked, STAGE_COUNT));
  if (!G) renderMenu();
}

// ---- 菜单 ----
const fmt = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '亿' : n >= 1e4 ? (n / 1e4).toFixed(1).replace(/\.0$/, '') + '万' : String(Math.floor(n));
const upName = id => T.TOWERS[id].name;
const upDesc = (id, lv) => `伤害 ×${(1.15 ** lv).toFixed(2)} · ${TW[id].desc}`;
function upRow(id) {
  const lv = proto.lv[id], max = lv >= T.MAX_UP, p = T.price(id, lv);
  return `<div class="tr"><div class="t"><b>${upName(id)} Lv${lv}</b><small>${upDesc(id, lv)}${TW[id].syn ? '<br>★ ' + TW[id].syn : ''}</small></div><button class="buy" data-up="${id}" type="button" ${max || !canSpend(p) ? 'disabled' : ''}>${max ? '永久满级' : fmt(p) + ' 金币'}</button></div>`;
}
function renderMenu() {
  const h = T.HEROES[cmdSel];
  $('#heroImg').src = `../art/face_${cmdSel}.webp`; $('#heroImg').alt = h.name;
  $('#heroName').textContent = `统帅：${h.name}`;
  const stage=Campaign.getStage(lvSel),map=Campaign.getMap(stage.mapId),record=progress().stages[lvSel]||{best:0,cleared:false};
  $('#heroDesc').innerHTML = `${cmdDetail(cmdSel)}<br>统帅不上地图；8种防御塔。开局10秒、波间5秒，倍速同时加快战斗与倒计时。持有建设点上限400，本关累计收入预算${NORMAL_BUDGET(lvSel,cmdSel)}（含初始；退款不恢复额度）。普通无总塔数限制；无尽上限为地图总格数÷3向下取整。CEO每种1座，共4种。`;
  $('#cmdPick').innerHTML = T.CEO_IDS.map(id => `<button type="button" data-cmd="${id}" class="${id === cmdSel ? 'on' : ''}"><img src="../art/face_${id}.webp" alt="">${T.HEROES[id].name}</button>`).join('');
  $('#lvTxt').textContent=`第 ${lvSel} 关 · ${map.name}`;
  $('#lvInfo').textContent=`本关 ${stage.waves} 波${stage.ultimate?' · 末波终极Boss（阶段数值实验版）':''} · 重玩不重复解锁`;
  $('#lvProg').textContent=`已通关 ${progress().highestCleared}/50 · 本关${record.cleared?'已通关':`最佳 ${record.best}/${stage.waves} 波`}`;
  $('#lvPrev').disabled=lvSel<=1;$('#lvNext').disabled=lvSel>=progress().unlocked;
  $('#stageGrid').innerHTML=Campaign.STAGES.map(s=>`<button type="button" data-stage="${s.n}" aria-label="第${s.n}关，${s.n>progress().unlocked?'未解锁':progress().stages[s.n]?.cleared?'已通关':'可挑战'}" aria-pressed="${s.n===lvSel}" class="${s.n===lvSel?'on':''} ${progress().stages[s.n]?.cleared?'cleared':''}" ${s.n>progress().unlocked?'disabled':''}>${s.n}${s.n===50?' ♛':''}</button>`).join('');
  $('#menuEndlessBtn').disabled=!Progress.endUnlocked(progress())||!proto.ready||proto.blocked||pend||protoPending||!!localBuy;
  $('#campaignNotice').textContent=`第1–10关每关10波；11–20关11波；21–30关12波；31–40关13波；41–50关14波。每十关更换地图，第50关独立Boss地图。旧50波进度及榜单保留归档，不折算为新关卡。${Progress.endUnlocked(progress())?' 无尽已解锁：每次进入随机一张普通地图，重新布阵。':''}`;
  $('#walletLbl').textContent = EMBED ? '经营金币' : '模拟余额';
  $('#walletTxt').textContent = proto.ready ? fmt(proto.coins) : '…';
  $('#upNote').textContent = !EMBED ? '单独打开是原型模式：用模拟金币，不碰经营存档。局内造塔用建设点，每局重置；局内Lv3解锁特效，永久等级上限30。' : proto.blocked ? '存档异常（只读），现在不能升级' : '花的是经营金币；塔防本身不产金币。局内Lv3解锁特效，永久等级上限30。';
  $('#protoStatus').textContent=EMBED?protoNotice:protoPending?'正在安全保存…':protoNotice;
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
  if (EMBED) { pend = true; buyRequest = { td:'buy', id, requestId:'b-' + (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)) }; sendBuy(); renderMenu(); return true; }
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
  const stageButton=e.target.closest('[data-stage]');if(stageButton){const n=Number(stageButton.dataset.stage);if(Progress.unlocked(progress(),n)){lvSel=n;renderMenu();}return;}
  const u = e.target.closest('[data-up]'); if (u) return buyUp(u.dataset.up);
  const c = e.target.closest('[data-cmd]'); if (c) { if(!EMBED)return selectProto(c.dataset.cmd);cmdSel=c.dataset.cmd;renderMenu(); }
});
$('#lvPrev').onclick = () => { lvSel = Math.max(1, lvSel - 1); renderMenu(); };
$('#lvNext').onclick = () => { lvSel = Math.min(STAGE_COUNT, progress().unlocked, lvSel + 1); renderMenu(); };
$('#exitBtn').onclick = () => host({ td: 'close' });

// ---- 一局 ----
let G = null, paused = false, raf = 0, last = 0, sel = null, clockRemainder = 0;
const FIXED_DT = 1/60;
const TIMING=Object.freeze({revision:'td-countdown10-speed-v1',initial:10,between:5});
function setSpeed(value){if(!G)return false;G.speed=value===2?2:1;hud();return true;}
// User timing revision: preparation and combat both consume speed-scaled fixed steps.
function advanceClock(seconds){
 if(!G||G.over||G.pendStart||paused||document.hidden){clockRemainder=0;return;}
 if(!Number.isFinite(seconds))return;
  clockRemainder+=Math.max(0,seconds);
 while(clockRemainder+1e-10>=FIXED_DT){
  clockRemainder=Math.max(0,clockRemainder-FIXED_DT);
  const count=G.speed;
  for(let i=0;i<count;i++){if(G.over||paused||document.hidden)break;step(FIXED_DT);}
  if(G.over){clockRemainder=0;break;}
 }
}
const tDmg = id => 1.15 ** proto.lv[id];
const gl = () => CMD[G.cmd].g;
function start(n,options={}) {
  if(protoPending||localBuy||proto.blocked||pend||!proto.ready)return false;
  const endless=options.endless===true;
  n=n===undefined?lvSel:n;
  if(!Number.isInteger(n)||!Progress.unlocked(progress(),n)||(endless&&!Progress.endUnlocked(progress())))return false;
  if(endless&&n!==50)return false;
  const seed=endless?(options.seed===undefined?Math.floor(Math.random()*0x100000000):options.seed):0;
  if(!Campaign.validSeed(seed))return false;
  const stage=Campaign.getStage(n),mapId=endless?Campaign.mapForSeed(seed):stage.mapId;
  setMap(mapId);SFX.unlock();
  G={n,cmd:cmdSel,mapId,seed,endless,W:stage.waves,completedWave:0,lastRewardedWave:0,waveSpec:null,combatTime:0,wave:0,q:[],spawnT:0,breakT:TIMING.initial,speed:1,es:[],tw:new Map(),fx:[],lives:LIVES,cash:START_PTS+(cmdSel==='c77'?ENERGY.start77:0),normalBudget:NORMAL_BUDGET(n,cmdSel),energyEarned:START_PTS+(cmdSel==='c77'?ENERGY.start77:0),interestSeconds:0,skillLeft:0,skillCooldown:0,kills:0,t:0,damageByTower:{},over:false,win:false,ultimateBossKilled:false,runId:(endless?'e_':'s_')+Date.now().toString(36)+Math.random().toString(36).slice(2,9),pendStart:true};
  G.startMsg=Object.freeze({td:endless?'endlessStart':'start',ruleset:RULESET_ID,runId:G.runId,n,cmd:G.cmd,mapId,seed});
  paused=false;clockRemainder=0;SFX.newTrack();SFX.setPaused(false);sel={k:'build',id:null,x:null,y:null};show(null);bar();resize();hud();last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);sendStart();return true;
}
function sendStart(){
 if(!G||!G.pendStart)return false;const game=G;G.startFailed='';paused=false;show(null);
 if(EMBED){host(G.startMsg);clearTimeout(G.startTO);G.startTO=setTimeout(()=>{if(G===game&&G.pendStart)failStart('开局登记确认超时，可原样重试');},4000);}
 else G.startPromise=protoStore[G.endless?'endlessStart':'start'](G.startMsg).then(r=>{acceptProto(r);if(G!==game)return false;if(!r.ok){failStart(r.why);return false;}G.pendStart=false;bgmTry();return true;});
 return true;
}
function failStart(why){if(!G)return;G.startFailed=why;paused=true;SFX.stopBgm();show('#pause');hud();toast(why);}
function abortStart(why){SFX.stopBgm();G=null;paused=false;show('#menu');renderMenu();toast(why);}
$('#retryStartBtn').onclick=sendStart;
$('#menuEndlessBtn').onclick=()=>start(50,{endless:true});
function nextWave() {
  if (!G || G.over || G.pendStart || (!G.endless && G.wave >= G.W) || G.q.length || alive().length || G.breakT > 0 || paused) return;
  G.waveSpec = waveSpec(G.wave + 1); G.q = G.waveSpec.queue.slice(); G.wave++; G.interestSeconds=0; G.breakT = 0; G.spawnT = 0; SFX.cue('wave'); toast(`第 ${G.wave} 波`); bar();
}
// Stats are authoritative in the versioned module; retain visual and kill-reward metadata.
function spawn(type) {
  const b = EN[type], data = G.waveSpec?.enemies[type];
  if (!b || !data) throw Error('enemy absent from active wave');
  G.es.push({ type, d:0, hp:data.hp, max:data.hp, sp:data.speed, leak:data.leak, r:b.r, slowT:0, slowK:1, stunT:0, controlUntil:0, burnT:0, burnD:0, x:posAt(0)[0], y:posAt(0)[1], ultimate:!!data.ultimate, phaseAt:data.phaseAt, phaseSpeed:data.phaseSpeed, phase:1 });
}

const alive = () => G.es.filter(e => e.hp > 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function inRange(p, r) { return alive().filter(e => Math.hypot(e.x - p.x, e.y - p.y) <= r).sort((a, b) => b.d - a.d); }
function hit(e, dmg, o, source) {
  if (!e || e.hp <= 0 || !TIDS.includes(source) || !Number.isFinite(dmg) || dmg < 0) return false;
  dmg *= burstMultiplier();
  G.damageByTower[source] = (G.damageByTower[source] || 0) + dmg;
  e.hp -= dmg; if(e.ultimate&&e.phase===1&&e.hp>0&&e.hp/e.max<=e.phaseAt){e.phase=2;e.sp*=e.phaseSpeed;toast('终极Boss进入第二阶段（实验数值）');} if (!o || !o.dot) { SFX.hit(); e.flash = 0.12; }
  if (o && o.slow) { e.slowT = Math.max(e.slowT, o.slowT || 1); e.slowK = Math.min(e.slowK === 1 ? 1 : e.slowK, 1 - o.slow); }
  if (o && o.stun && e.type !== 'boss' && e.type !== 'mini') e.stunT = Math.max(e.stunT, o.stun);
  if (o && o.burn) { e.burnT = Math.max(e.burnT, o.burnT || 3); if (o.burn >= e.burnD) e.burnSource = source; e.burnD = Math.max(e.burnD, o.burn); }
  if (e.hp <= 0) { if(e.ultimate)G.ultimateBossKilled=true; e.hp=0; G.kills++; gainEnergy(EN[e.type].cash); SFX.kill(e.type === 'boss'); G.fx.push({ k: 'pop', x: e.x, y: e.y, t: 0.3, c: '#fff' }); }
  return true;
}
function control(e,kind) {
  if(!e||e.hp<=0||['mini','boss'].includes(e.type)||(e.controlUntil||0)>G.combatTime+1e-9)return false;
  e.controlUntil=G.combatTime+4;
  if(kind==='freeze')e.stunT=Math.max(e.stunT||0,.4);
  else {e.d=Math.max(0,e.d-.25);[e.x,e.y]=posAt(e.d);}
  return true;
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
  tw.shots=(tw.shots||0)+1; const maxed=tw.lv===MAX_TLV;
  const crit = g.crit && Math.random() < g.crit;
  const dmg = s.dmg * tDmg(tw.id) * lvK * (g.dmg || 1) * (crit ? g.critX : 1);
  const gb = g.burn ? { burn: dmg * g.burn, burnT: g.burnT } : null;   // 77 全局燃烧
  const e0 = tg[0], dir = (() => { const dx = e0.x - p.x, dy = e0.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; })();
  if (crit) G.fx.push({ k: 'txt', x: e0.x, y: e0.y - 0.4, s: '暴击', t: 0.4, t0: 0.4 });
  switch (s.kind) {
    case 'cone': {
      const a0 = Math.atan2(dir.y, dir.x), half = s.arc / 2 * Math.PI / 180;
      const sweep=maxed&&tw.shots%4===0;
      if(sweep)ring(p,range,s.col);else G.fx.push({ k: 'cone', x: p.x, y: p.y, a: a0, h: half, r: range, c: s.col, t: 0.25, t0: 0.25 });
      tg.filter(e => { if(sweep)return true; let d = Math.atan2(e.y - p.y, e.x - p.x) - a0; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) <= half; })
        .forEach(e => strike(e, dmg, { burn: Math.max(dmg * s.burn, gb ? gb.burn : 0), burnT: s.burnT }));
      break;
    }
    case 'aura': {ring(p, range, s.col, 0.25); let froze=false;const ready=maxed&&(tw.freezeCD||0)<=1e-9;tg.forEach(e => {strike(e, dmg, Object.assign({ slow: Math.min(0.75, s.slow + 0.01 * proto.lv.tea), slowT: s.slowT }, gb));if(ready&&control(e,'freeze'))froze=true;});if(froze)tw.freezeCD=6;break;}
    case 'pierce': { const hs = onLine(p, dir, range + 0.5, s.width).slice(0, s.pierce); line(p, { x: p.x + dir.x * (range + 0.5), y: p.y + dir.y * (range + 0.5) }, s.col, 0.15); hs.forEach((e,i) => strike(e, dmg*(maxed?1+i*.1:1), gb)); break; }
    case 'chain': { let cur = e0, k = dmg; const hs = new Set([e0]); line(p, e0, s.col); strike(e0, k, gb);
      for (let i = 0; i < s.chain; i++) { const nx = inRange(cur, s.jump).find(x => !hs.has(x)); if (!nx) break; k *= s.fall; line(cur, nx, s.col); strike(nx, k, gb); hs.add(nx); cur = nx; } if(maxed&&hs.size>1&&e0.hp>0){line(cur,e0,s.col);strike(e0,dmg*.35);}break; }
    case 'burn': {const wasBurning=e0.burnT>0;line(p, e0, s.col); strike(e0, dmg, { burn: dmg * s.burn * (syn ? s.synBurn : 1) + (gb ? gb.burn : 0), burnT: syn ? s.synBurnT : s.burnT });if(maxed&&wasBurning)strike(e0,dmg*.25);break;}
    case 'bounce': { let cur = e0, prev = p, k = dmg; const hs = new Set(), n = s.bounce + (syn ? s.synBounce : 0);
      for (let i = 0; i <= n && cur; i++) { line(prev, cur, s.col); strike(cur, k, gb); hs.add(cur); prev = cur; k *= s.fall; cur = inRange(cur, s.jump).find(x => !hs.has(x)); }if(maxed){const split=inRange(prev,s.jump).filter(e=>!hs.has(e)).slice(0,2);split.forEach(e=>{line(prev,e,s.col);strike(e,dmg*.25);});}break; }
    case 'boomerang': { const w = syn ? s.synWidth : s.width, hs = onLine(p, dir, range, w);
      G.fx.push({ k: 'boom', x: p.x, y: p.y, x2: p.x + dir.x * range, y2: p.y + dir.y * range, c: s.col, t: 0.4, t0: 0.4 });
      hs.forEach(e => strike(e, dmg, gb)); hs.forEach(e => {strike(e, dmg * (syn ? s.synBack : s.back));if(maxed)control(e,'retreat');}); break; }
    case 'splash': { const r = syn ? s.synRad : s.rad; line(p, e0, s.col, 0.2); ring(e0, r, s.col); inRange(e0, r).forEach(x => strike(x, dmg*(maxed&&dist(x,e0)<=.35+1e-9?1.25:1), gb)); break; }
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
  G.cash -= c; tw.spent += c; tw.lv++; if(tw.lv===MAX_TLV)tw.shots=0;bar(); return true;
}
function sell(x, y) { if (!G || (G.over&&!G.adjusting) || paused || G.pendStart || G.pendingEndless) return false; const tw = G && G.tw.get(x + ',' + y); if (!tw) return false; const refunded=gainEnergy(sellBack(tw),true); toast(`拆除返还 ${num(refunded)} 建设点（上限${ENERGY.cap}）`); G.tw.delete(x + ',' + y); sel = null; bar(); return true; }

function step(dt) {
  if (!G || G.over || G.pendStart || paused || document.hidden) return;
  if(!Number.isFinite(dt))return;dt=Math.max(0,dt); G.t += dt; const combat=G.q.length>0||alive().length>0;
  if(combat){G.combatTime+=dt;const interest=Math.min(dt,Math.max(0,ENERGY.waveSeconds-G.interestSeconds));G.interestSeconds+=interest;gainEnergy(interest*(ENERGY.baseRate+(G.cmd==='rocket'?ENERGY.rocketRate:0)));}
  if (!G.q.length && (G.endless || G.wave < G.W) && !alive().length) { if (G.breakT <= 0 && G.wave > 0) { G.breakT = TIMING.between; if(G.lastRewardedWave<G.wave){gainEnergy(G.waveSpec.waveEndEnergy);G.lastRewardedWave=G.wave;} } const before = Math.ceil(G.breakT); G.breakT = Math.max(0, G.breakT - dt); if (Math.ceil(G.breakT) !== before && G.breakT > 0) SFX.cue('tick'); if (G.breakT <= 1e-9) {G.breakT=0;nextWave();} }
  if (G.q.length) { G.spawnT -= dt; if (G.spawnT <= 0) { const ty = G.q.shift(); spawn(ty); G.spawnT = ty === 'fast' ? 0.5 : ty === 'boss' ? 2 : 0.8; } }
  for (const e of G.es) {
    if (e.hp <= 0) continue;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.burnT > 0) { e.burnT -= dt; hit(e, e.burnD * dt, {dot:true}, e.burnSource); if (e.hp <= 0) continue; }
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowK = 1; }
    const frozen=Math.min(dt,Math.max(0,e.stunT));e.stunT=Math.max(0,e.stunT-dt);e.d += e.sp * Math.max(['mini','boss'].includes(e.type)?.5:.25,e.slowK*frostMultiplier()) * (dt-frozen);
    const [x, y] = posAt(e.d); e.x = x; e.y = y;
    if (e.d >= PLEN) { e.hp = 0; G.lives -= e.leak; SFX.hurt(); toast('机房被闯了！'); if (G.lives <= 0) { G.lives = 0; return end(false); } }
  }
  G.es = G.es.filter(e => e.hp > 0);
  for (const tw of G.tw.values()) { if(combat)tw.freezeCD=Math.max(0,(tw.freezeCD||0)-dt);tw.flash = Math.max(0, (tw.flash || 0) - dt); tw.cd -= dt; if (tw.cd <= 0 && towerFire(tw)) tw.cd = TW[tw.id].rate * (gl().rate || 1); }
  if(combat){G.skillLeft=Math.max(0,G.skillLeft-dt); G.skillCooldown=Math.max(0,G.skillCooldown-dt);}
  for (const f of G.fx) f.t -= dt;
  G.fx = G.fx.filter(f => f.t > 0);
  if(G.wave>0&&!G.q.length&&!alive().length)G.completedWave=G.wave;
  if (!G.endless && G.completedWave >= G.W) end(G.n!==50||G.ultimateBossKilled);
}
function end(win) {
  if (!G || G.over) return;
  G.over = true; G.win = win; SFX.stopBgm(); win ? SFX.win() : SFX.lose();
  const identity={ruleset:RULESET_ID,runId:G.runId,n:G.n,cmd:G.cmd,mapId:G.mapId,seed:G.seed};
  const res=Object.freeze(G.endless?{...identity,td:'endlessResult',waves:G.completedWave,kills:G.kills}:{...identity,td:'result',win,waves:G.completedWave,kills:G.kills,bossKilled:G.ultimateBossKilled});
  G.resMsg=res;sendResult();renderResult();show('#result');
}
function continueEndless(){if(!G||!G.over||!G.saveOk||G.wait||!Progress.endUnlocked(progress()))return false;return start(50,{endless:true});}
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
  $('#endlessBtn').classList.toggle('hidden',!Progress.endUnlocked(progress()));$('#endlessBtn').disabled=!G.saveOk||G.wait||!!G.pendingEndless;
  $('#resTitle').textContent = G.wait ? '结算中…' : G.win && saved ? '守住了！' : G.win ? '存档失败' : '机房失守';
  $('#resStats').textContent = `第${G.n}关 · ${Campaign.getMap(G.mapId).name} · 守了 ${G.completedWave}/${G.W} 波 · 击倒 ${G.kills} · 剩余生命 ${G.lives}`;
  $('#resNote').textContent = G.wait ? '' : !saved ? `这局进度没记上${G.why ? '（' + G.why + '）' : ''}` : G.win ? `第${G.n}关 ${G.W} 波全部守住！${G.n===50?'终极Boss已击败，无尽已解锁。':''}` : `本关最佳 ${progress().stages[G.n]?.best||0}/${G.W} 波 · 调整布阵再来`;
  if(G.endless){$('#resStats').textContent=`无尽守住 ${G.completedWave} 波 · 击倒 ${G.resMsg?.kills||0}`;$('#resNote').textContent=G.wait?'保存无尽纪录中':saved?`无尽最高 ${progress().endless?.best||0} 波；不发经营金币`:G.why||'无尽纪录未保存';}
  else if(G.pendingEndless||G.why)$('#resNote').textContent=G.pendingEndless?'无尽登记中…':G.why;
  const board=$('#endlessBoard');board.classList.toggle('hidden',!G.endless);
  if(G.endless){const top=progress().endless?.top||[],rank=top.findIndex(e=>e.runId===G.runId),points=T.score(G.resMsg.waves,G.resMsg.kills);board.innerHTML=`<h3>50关战役 · 无尽 TOP 10</h3><p class="note">分数＝完成无尽波数×1000＋无尽击杀数<br>同分先取得优先</p><ol>${top.map(e=>`<li${e.runId===G.runId?' class="current-score"':''}>${e.score} 分 · ${e.waves} 波 / ${e.kills} 击杀</li>`).join('')}</ol>${!top.length?'<p>暂无已保存历史分数</p>':''}<p>旧10波与旧50波榜单另存，未计入此榜</p><p class="current-score">本次 ${points} 分 · ${!saved?'尚未保存，名次待确认':rank>=0?'历史第 '+(rank+1)+' 名':'未上榜'}</p>`;}
  $('#retryBtn').classList.toggle('hidden', !(!G.wait && !G.saveOk));
  $('#againBtn').textContent = G.win && saved && G.n < STAGE_COUNT ? '下一关' : '再来一局';
  $('#againBtn').disabled = !!G.wait||!G.saveOk; $('#menuBtn').disabled=!!G.wait||!G.saveOk;
}
$('#retryBtn').onclick = () => { if (G && G.over && !G.wait && G.resMsg) { sendResult(); renderResult(); } };
$('#againBtn').onclick = () => { if (!G || G.wait||!G.saveOk) return; if(G.endless)return start(50,{endless:true});const n = G.win && G.saveOk ? G.n + 1 : G.n; G = null; lvSel = Math.min(STAGE_COUNT, progress().unlocked, n); start(lvSel); };
$('#menuBtn').onclick = () => { if (G && (G.wait||!G.saveOk)) return; G = null; SFX.stopBgm(); show('#menu'); renderMenu(); };
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
  $('#retryStartBtn').classList.toggle('hidden',!G.startFailed);$('#resumeBtn').disabled=!!G.startFailed;
  $('#budgetInfo').textContent = G.endless ? '无尽：累计收入不限；持有上限400' : `累计收入 ${Math.ceil(G.energyEarned)}/${G.normalBudget} · 退款不恢复额度`;
  $('#stageTxt').textContent=G.endless?'无尽':`第${G.n}关`; $('#lifeTxt').textContent = `❤ ${G.lives}`; $('#cashTxt').textContent = `建设点 ${Math.floor(G.cash)}/${ENERGY.cap}`; $('#waveTxt').textContent = G.endless?`无尽 ${G.wave}`:`${G.wave}/${G.W}波`;
  $('#passiveStatus').textContent = `塔 ${G.tw.size}/${G.endless?Math.floor(COLS*ROWS/3):"∞"} · `+(!G.endless && G.energyEarned>=G.normalBudget?'预算已用尽':G.interestSeconds<ENERGY.waveSeconds && (G.q.length||alive().length)?`+${ENERGY.baseRate+(G.cmd==='rocket'?ENERGY.rocketRate:0)}/秒`:'恢复暂停');
  for(const id of ['#speedBtn','#pauseSpeedBtn']){const b=$(id);b.textContent=`速度 ×${G.speed}`;b.setAttribute('aria-label',`战斗与倒计时 ${G.speed} 倍，点击切换`);b.setAttribute('aria-pressed',String(G.speed===2));}
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
  if (sel && sel.k === 'tower') { const tw = G.tw.get(sel.x + ',' + sel.y); if (tw) $('#twUp').disabled = !!G.adjusting || tw.lv >= MAX_TLV || G.cash < upCost(tw); }
}
function bar() {
  $('#barMain').classList.toggle('hidden', !!G?.adjusting || !!sel && sel.k === 'tower'); $('#barBuild').classList.toggle('hidden', !!G?.adjusting || !!sel && sel.k === 'tower'); $('#barTower').classList.toggle('hidden', !sel || sel.k !== 'tower');
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
  const top = (G?.adjusting ? ($('#endlessPrep').offsetHeight||120)+16 : 88) + parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat') || 0), bot = (barMaxH() || 110) + 6;
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
    cx.fillStyle = p ? activeMap.palette.road : activeMap.palette.ground; cx.fillRect(px(x) + 1, py(y) + 1, S - 2, S - 2);
    if (p) { cx.fillStyle = activeMap.palette.accent; cx.beginPath(); cx.arc(px(x+.5),py(y+.5),1.5,0,7); cx.fill(); }
    if (!p) { cx.fillStyle = '#e8dec6'; cx.fillRect(px(x)+5,py(y)+S-5,S-10,2); cx.strokeStyle = '#d9cfb8'; cx.setLineDash([3, 3]); cx.strokeRect(px(x) + 2.5, py(y) + 2.5, S - 5, S - 5); cx.setLineDash([]); }
  }
  cx.fillStyle = INK; cx.font = `900 ${Math.round(S * 0.3)}px sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  const entry=WAY[0],exit=WAY[WAY.length-1],bound=(v,max)=>Math.max(.3,Math.min(max-.3,v+.5));cx.fillText('入口',px(bound(entry[0],COLS)),py(bound(entry[1],ROWS)));cx.fillText('机房',px(bound(exit[0],COLS)),py(bound(exit[1],ROWS)));
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
    if(e.ultimate){cx.fillStyle=RED;cx.font=`900 ${Math.max(9,Math.round(S*.25))}px sans-serif`;cx.fillText(`终极·${e.phase}阶段`,x,y+r+10);}
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
  if (!G || (G.over&&!G.adjusting) || paused || G.pendingEndless) return;
  const x = Math.floor((e.clientX - OX) / S), y = Math.floor((e.clientY - OY) / S);
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS) { sel = null; return bar(); }
  if(G.adjusting){sel=G.tw.has(x+','+y)?{k:'tower',x,y}:null;return bar();}
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
window.render_game_to_text = () => JSON.stringify({mode:!G?'menu':G.adjusting?'endless-preparation':G.over?'result':paused?'paused':'playing',timingRevision:TIMING.revision,coordinates:'grid origin top-left, x right, y down',stage:G?.n,mapId:G?.mapId,seed:G?.seed,endless:!!G?.endless,stageWaves:G?.W,wave:G?.wave,countdown:G?.breakT,speed:G?.speed,cash:G?.cash,lives:G?.lives,passiveCommander:G?.cmd,damageByTower:G?.damageByTower,energyCap:ENERGY.cap,energyEarned:G?.energyEarned,normalBudget:G?.endless?null:G?.normalBudget,towerLimit:G?.endless?Math.floor(COLS*ROWS/3):null,interestSeconds:G?.interestSeconds,skillLeft:G?.skillLeft,skillCooldown:G?.skillCooldown,selection:sel,towers:G?[...G.tw.values()]:[],enemies:G?.es});
window.advanceTime = ms => { advanceClock(Math.max(0,ms)/1000); draw(); hud(); };
resize(); renderMenu(); show('#menu'); raf = requestAnimationFrame(loop);
window.__td = { EMBED, RULESET_ID, TIMING, STAGE_COUNT, Campaign, BUDGET_VERIFIED, MIN_VERIFIED_BUDGET, waveSpec, control, sendStart, proto, protoStore, selectProto, setSpeed, advanceClock, P, ENERGY, NORMAL_BUDGET, towerLimit, ceoBlocked, continueEndless, end, spawn, activateSkill, burstMultiplier, frostMultiplier, gainEnergy, hit, towerFire, towerRange, start, step, build, upTower, sell, nextWave, buyUp, onState, setPause, renderMenu, isPath, waveList, TW, CMD, get PLEN(){return PLEN;}, get activeMap(){return activeMap;},
  get protoPending(){return protoPending;}, get protoTask(){return protoTask;}, get G() { return G; }, get geo() { return { S, OX, OY, COLS, ROWS }; }, get lastSent() { return lastSent; }, get pend() { return pend; }, get paused() { return paused; }, get cmdSel() { return cmdSel; }, set cmdSel(v) { if (T.CEO_IDS.includes(v)) { cmdSel = v; renderMenu(); } } };
})();
