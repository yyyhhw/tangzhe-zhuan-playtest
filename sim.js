// 躺着也能赚 v2 节奏模拟器（CEO + 员工）：node sim.js [盲盒单价]
// 玩家模型：只在在线时花钱；贪心买「每秒收益增量 / 价格」最高的那项（店铺 / 员工 / CEO 升级），
// 新店买得起就先开、新店员工性价比够就攒钱雇；CEO 默认坐专长店。
// 在线手点当前最赚的店（前 3 分钟 2.5 次/秒，15 分钟内 1 次/秒，之后 0.3 次/秒）；
// 大客户每 2~4 分钟来一次、80% 被点到（×5 持续 30 秒，只管在线）；离线 50%、封顶 8h；每天第一次回来（离开>1h）用掉每日双倍。
const E = require('./economy.js');
if (process.env.SIM_OVR) { const o = JSON.parse(process.env.SIM_OVR); Object.assign(E.CFG, o.CFG || {}); (o.SHOPS || []).forEach((x, i) => Object.assign(E.SHOPS[i], x)); (o.CEOS || []).forEach((x, i) => Object.assign(E.CEOS[i], x)); }
if (process.argv[2]) E.CFG.GACHA_PRICE = Number(process.argv[2]);
if (process.argv[3]) E.CFG.GACHA_GROWTH = Number(process.argv[3]);
const price = E.CFG.GACHA_PRICE;
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const MODES = {
  '普通（约 40 分钟/天）': { day1:[[9,20],[12.5,10],[18,10],[21.5,15]], later:[[7.5,10],[12.5,10],[18.5,10],[22,10]] },
  '轻度（约 15 分钟/天）': { day1:[[9,10],[13,5],[21,5]], later:[[8,5],[13,5],[21,5]] },
  '重度（第一天 2 小时）': { day1:[[9,60],[12.5,20],[18,20],[21,20]], later:[[7.5,15],[12.5,15],[18.5,15],[22,15]] },
};
const tapsPerSec = t => t < 180 ? 2.5 : t < 900 ? 1 : 0.3;

function rateWith(st, fn) { const c = E.cloneState(st); fn(c); return E.baseRate(c); }
function candidates(st) {
  const out = [], base = E.baseRate(st);
  for (let i = 0; i < 4; i++) {
    const s = st.shops[i];
    if (!s.open) { if (st.shops[i - 1].open) out.push({ k:'open', i, cost:E.SHOPS[i].open, d:0 }); break; }
    if (s.emp <= 0) { out.push({ k:'hire', i, cost:E.SHOPS[i].hire, d:rateWith(st, c => c.shops[i].emp = 1) - base }); continue; }
    out.push({ k:'up', i, cost:E.upgradeCost(i, s.lv), d:rateWith(st, c => c.shops[i].lv++) - base });
    if (s.emp < E.CFG.EMP_MAX) out.push({ k:'emp', i, cost:E.empCost(i, s.emp), d:rateWith(st, c => c.shops[i].emp++) - base });
  }
  for (const c of E.CEOS) { const s = st.ceos[c.id];
    if (s.unlocked && s.at >= 0 && s.lv < E.CFG.CEO_MAX) out.push({ k:'ceo', id:c.id, cost:E.ceoCost(c.id, s.lv), d:rateWith(st, x => x.ceos[c.id].lv++) - base }); }
  return out;
}
function buyStep(st, log, t) {
  for (let n = 0; n < 400; n++) {
    const cs = candidates(st);
    const op = cs.find(x => x.k === 'open');
    if (op && st.coins >= op.cost) { E.openShop(st, op.i); log(t, 'open', op.i); continue; }
    const rest = cs.filter(x => x.k !== 'open').sort((a, b) => b.d / b.cost - a.d / a.cost);
    let pick = rest[0];
    // 攒钱开新店：若下一家「开店+雇人」整体回本 ≥ 当前最优的 1/3，就留钱给它（只在已攒到 ≥30% 时）
    if (op) { const S = E.SHOPS[op.i]; const pot = E.shopBase(op.i, 1) * E.CFG.MATCH_MULT;
      if (pot / (S.open + S.hire) > (pick.d / pick.cost) / 3 && st.coins > 0.3 * S.open && pick.cost > 0.02 * S.open) return; }
    const hire = rest.find(x => x.k === 'hire');
    if (hire && hire !== pick && hire.d / hire.cost > (pick.d / pick.cost) / 3) pick = hire;
    if (!pick || st.coins < pick.cost) return;
    if (pick.k === 'hire') { E.hireEmp(st, pick.i); log(t, 'hire', pick.i); }
    else if (pick.k === 'up') { const r = E.upgradeShop(st, pick.i); if (r.unlocked && r.unlocked.length) r.unlocked.forEach(id => log(t, 'ceo_' + id, '')); }
    else if (pick.k === 'emp') E.upgradeEmp(st, pick.i);
    else E.upgradeCeo(st, pick.id);
  }
}
function run(mode, days = 14) {
  const st = E.newState(0); const ev = {}; let tOnline = 0, nextBig = 150, gachaStart = null, gachaDone = null, gachaSpent = 0;
  const log = (t, what, i) => { const k = what + i; if (!(k in ev)) ev[k] = t; };
  let t = 0, lastLeave = null, doubleDay = -1; const daily = [];
  for (let d = 0; d < days; d++) {
    for (const [h, mins] of (d === 0 ? MODES[mode].day1 : MODES[mode].later)) {
      const start = d * 86400 + h * 3600;
      if (lastLeave != null) {
        const gap = start - lastLeave, eff = Math.min(gap, E.offlineCap(st));
        let amt = E.offlineRate(st) * eff; if (doubleDay !== d && gap > 3600) { amt *= 2; doubleDay = d; }
        st.coins += amt;
      }
      t = start;
      for (let s = 0; s < mins * 60; s++, t++) {
        const boost = st.boostEnd > t ? E.CFG.BOOST_MULT : 1;
        let inc = E.baseRate(st) * boost, best = 0;
        for (let i = 0; i < 4; i++) if (st.shops[i].open) best = Math.max(best, E.tapValue(st, i));
        inc += tapsPerSec(tOnline) * best * (1 + E.CFG.CRIT_CHANCE * (E.CFG.CRIT_MULT - 1)) * boost;
        st.coins += inc; tOnline++;
        if (tOnline >= nextBig) { nextBig = tOnline + E.bigInterval(st, rnd()); if (rnd() < 0.8) st.boostEnd = t + E.CFG.BOOST_SEC; }
        if (s % 2 === 0) buyStep(st, log, t);
        if (process.env.TRACE && d === 0 && s % 60 === 0 && h === 9) console.log('min', s/60, 'coins', Math.round(st.coins), 'rate', E.baseRate(st).toFixed(1), 'tap', E.tapValue(st,0), st.shops.map(x=>x.lv+'/'+x.emp).join(' '), E.CEOS.map(c=>st.ceos[c.id].lv).join('/'));
        if (E.gachaUnlocked(st)) {   // 盲盒：金币 > 单价×3 时抽（留出升级钱）
          if (gachaStart == null) gachaStart = t;
          const gp = E.gachaPrice(st); if (st.gacha.owned.length < 16 && st.coins > gp * 3) { E.gachaDraw(st, rnd()); gachaSpent += gp; if (st.gacha.owned.length === 16) gachaDone = t; }
        }
      }
      lastLeave = t;
    }
    daily.push({ d:d + 1, rate:E.baseRate(st), lv:st.shops.map(x => x.lv + '/' + x.emp).join(' '), ceo:E.CEOS.map(c => st.ceos[c.id].unlocked ? st.ceos[c.id].lv : '-').join('/'), box:st.gacha.owned.length });
  }
  return { ev, st, gachaStart, gachaDone, daily, gachaSpent };
}
const fmtT = s => { if (s == null) return '—'; const d = Math.floor(s / 86400), h = (s % 86400) / 3600; return `第${d + 1}天 ${String(Math.floor(h)).padStart(2,'0')}:${String(Math.floor((h % 1) * 60)).padStart(2,'0')}`; };
const fromStart = (s, t0) => s == null ? '—' : ((s - t0) < 3600 ? ((s - t0) / 60).toFixed(1) + ' 分钟' : fmtT(s));
const fmtN = n => n >= 1e8 ? (n / 1e8).toFixed(2) + '亿' : n >= 1e4 ? (n / 1e4).toFixed(1) + '万' : Math.round(n) + '';
if (require.main === module && process.env.SIM_JSON) {
  const r = run(Object.keys(MODES)[Number(process.env.SIM_MODE || 0)], 14), e = r.ev;
  const H = s => s == null ? null : +(s / 3600).toFixed(2);
  console.log(JSON.stringify({ tea:H(e.open1), book:H(e.open2), bookHire:H(e.hire2), tech:H(e.open3), techHire:H(e.hire3), rocket:H(e.ceo_rocket), gacha:H(r.gachaDone), d1:Math.round(r.daily[0].rate), d3:Math.round(r.daily[2].rate), d7:Math.round(r.daily[6].rate), d14:Math.round(r.daily[13].rate), lv14:r.daily[13].lv }));
} else if (require.main === module) {
  for (const m of Object.keys(MODES)) {
    const r = run(m), t0 = 9 * 3600, e = r.ev;
    console.log(`\n== ${m}  (盲盒 ${fmtN(price)}${E.CFG.GACHA_GROWTH !== 1 ? ' 起，每个×' + E.CFG.GACHA_GROWTH : ' 固定价'}) ==`);
    console.log(' 雇阿炭（烧烤摊员工）:', fromStart(e.hire0, t0));
    console.log(' 开奶茶店 / 珍珠姐加入:', fromStart(e.open1, t0), '| 雇小满', fromStart(e.hire1, t0));
    console.log(' 开漫画书店 / 阿宅加入:', fmtT(e.open2), '| 雇阿页', fmtT(e.hire2));
    console.log(' 开科技公司          :', fmtT(e.open3), '| 雇小栈（盲盒开放）', fmtT(e.hire3));
    console.log(' ' + E.ROCKET_NAME.name + '加入(科技Lv25):', fmtT(e.ceo_rocket));
    console.log(' 盲盒 16 件集齐      :', fmtT(r.gachaDone), r.gachaDone && r.gachaStart != null ? '（开放后 ' + ((r.gachaDone - r.gachaStart) / 3600).toFixed(1) + ' 小时）' : '');
    if (process.env.DAILY || m.startsWith('普通')) for (const x of r.daily) console.log(`   第${x.d}天末 产速 ${fmtN(x.rate)}/秒  店Lv/员工Lv ${x.lv}  CEO ${x.ceo}  盲盒 ${x.box}/16`);
  }
}
module.exports = { run, MODES };
