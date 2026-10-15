// 保存失败类提示不被普通提示覆盖：根目录 + preview，320/393 宽，A–G 七个场景。
// 测试-133 ②：改到现行协议——不再把 E.newState 原样塞进主档（新版主档在收藏层，缺协议字段会被锁成「存档已保护」）；改为页面起来后（/preview/ 先点「同意并继续 → 保留备份并升级」）在页内造档、保留收藏层协议字段、走 persist() 落盘再刷新。
// 用法：仓库根目录起 http.server，PLAYWRIGHT_MODULE=… TOAST_BASE=http://127.0.0.1:端口 node test_toast_hold.mjs
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.TOAST_BASE || 'http://127.0.0.1:8931';
const OUT = process.env.TOAST_OUT || '/tmp';
const res = [];
const b = await chromium.launch();
const SEED = `(()=>{const E=__tzz.E,T=Date.now(),st=E.newState(T);st.coins=1e9;E.hireEmp(st,0);[1,2,3].forEach(i=>{E.openShop(st,i);E.hireEmp(st,i);});
 [20,20,20,20].forEach((lv,i)=>{st.shops[i].lv=lv;st.shops[i].emp=3;});E.checkUnlocks(st);
 ['s_fountain','s_portal','s_sun'].forEach(id=>{if(st.gacha.owned.indexOf(id)<0)st.gacha.owned.push(id);});
 st.lastSeen=st.maxSeen=T;const old=__tzz.state;for(const k of Object.keys(old))if(!(k in st))st[k]=old[k];st.rev=old.rev;__tzz.state=st;__tzz.closeModal&&__tzz.closeModal();return __tzz.persist();})()`;
const boot = async pg => { const ok = pg.getByRole('button', { name:'同意并继续' }); if (await ok.isVisible().catch(() => false)) { await ok.click(); const up = pg.getByRole('button', { name:'保留备份并升级' }); await up.waitFor({ timeout:5000 }).then(() => up.click(), () => {}); } await pg.waitForFunction(() => window.__tzz); };
async function setup(path, w) {
  const ctx = await b.newContext({ viewport:{ width:w, height:w===393?852:667 }, deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage(); const errs = [];
  await pg.route(/\/app\.js(\?.*)?$/, async route => { const r = await route.fetch(); let t = await r.text();
    const n0 = t.length; t = t.replace('const superNext = {', 'window.__clock = () => clock; const superNext = window.__sn = {');
    if (t.length === n0) throw new Error('hook not applied'); await route.fulfill({ response:r, body:t }); });
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(BASE + path + 'index.html'); await pg.waitForTimeout(800); await boot(pg);
  const key = await pg.evaluate('__tzz.SAVE_KEY'), bak = await pg.evaluate('__tzz.BAK_KEY');
  if (!await pg.evaluate(SEED)) throw new Error('seed persist failed');
  await pg.goto(BASE + path + 'index.html'); await pg.waitForTimeout(1200); await pg.waitForFunction(() => window.__tzz);
  // 关掉开局弹窗
  for (let i = 0; i < 5; i++) { const m = await pg.evaluate(() => { const v = [...document.querySelectorAll('.modal:not(.hidden), [role=dialog]:not(.hidden)')].filter(e => e.offsetParent); return v.length; }); if (!m) break; await pg.keyboard.press('Escape'); await pg.waitForTimeout(250); }
  await pg.evaluate(() => { window.__tl = []; new MutationObserver(() => { const t = document.getElementById('toast'); window.__tl.push([Math.round(performance.now()), t.classList.contains('hidden') ? '' : t.textContent]); }).observe(document.getElementById('toast'), { childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:['class'] }); });
  return { ctx, pg, errs, key, bak };
}

const failOn = (pg, keys) => pg.evaluate(keys => { if (!window.__os) { window.__os = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if ((window.__fk || []).includes(k)) throw new DOMException('quota (test)', 'QuotaExceededError'); return window.__os.call(this, k, v); }; } window.__fk = keys; }, keys);
const at = (pg, steps, total) => pg.evaluate(async ([steps, total]) => {
  const t0 = performance.now();
  for (const [ms, js] of steps) { const w = t0 + ms - performance.now(); if (w > 0) await new Promise(r => setTimeout(r, w)); (new Function(js))(); }
  const w = t0 + total - performance.now(); if (w > 0) await new Promise(r => setTimeout(r, w));
  return t0;
}, [steps, total]);
const NOW = k => `__sn.${k} = __clock() - 0.01;`, OFF = `__sn.tea = __sn.book = __sn.tech = __clock() + 999;`;
const isFail = s => /保存失败|存档异常|数据异常|没有生效|存档已保护/.test(s);
// 把时间线压成「显示段」：[开始ms, 文本]（去掉连续重复）
function segs(tl, t0) { const out = []; for (const [t, x] of tl) { if (out.length && out[out.length - 1][1] === x) continue; out.push([t - t0, x]); } return out; }
const CASES = [
  { name:'A_同帧三事件_停烧烤摊', cur:0, fail:true, steps:[[0, OFF + NOW('tea') + NOW('book') + NOW('tech')]], total:3600,
    check:s => { const f = s.findIndex(x => isFail(x[1])), n = s.findIndex((x, i) => i > f && x[1] && !isFail(x[1]));
      return f >= 0 && n > f && s[n][0] - s[f][0] >= 2700 && /人造太阳/.test(s[n][1]); } },
  { name:'B_只有传送门失败_对照', cur:0, fail:true, steps:[[0, OFF + NOW('book')]], total:3300,
    check:s => s.some(x => isFail(x[1])) && s[s.length - 1][1] === '' } ,
  { name:'C_失败后1秒来超频', cur:0, fail:true, steps:[[0, OFF + NOW('book')], [1000, NOW('tech')]], total:3700,
    check:s => { const f = s.findIndex(x => isFail(x[1])), n = s.findIndex((x, i) => i > f && x[1] && !isFail(x[1]));
      return f >= 0 && n > f && s[n][0] - s[f][0] >= 2700 && /人造太阳/.test(s[n][1]); } },
  { name:'D_同帧三事件_停科技店', cur:3, fail:true, steps:[[0, OFF + NOW('tea') + NOW('book') + NOW('tech')]], total:3300,
    check:s => { const f = s.findIndex(x => isFail(x[1])); return f >= 0 && s.slice(f + 1).every(x => x[1] === '' || isFail(x[1])); } },
  { name:'E_存档正常_普通提示马上显示', cur:0, fail:false, steps:[[0, OFF + NOW('book')], [500, NOW('tech')]], total:1200,
    check:s => { const p = s.find(x => /传送门/.test(x[1])), t = s.find(x => /人造太阳/.test(x[1])); return p && t && p[0] < 300 && t[0] < 800; } },
  { name:'F_连续两次失败', cur:0, fail:true, keep:false, steps:[[0, OFF + NOW('book')], [1200, NOW('book')], [1900, 'window.__fk = [];']], total:4600,
    check:s => isFail(s[0][1]) && !s.some(x => x[0] < 3900 && !isFail(x[1])) && s.slice(-1)[0][1] === '' && s.slice(-1)[0][0] < 4300 },
  { name:'G_失败期间来三条普通提示_只留最新', cur:0, fail:true, keep:false, steps:[[0, OFF + NOW('book')], [600, NOW('tea')], [1200, NOW('tech')], [1800, NOW('tea')], [1900, 'window.__fk = [];']], total:5600,
    check:s => { const after = s.filter(x => x[1] && !isFail(x[1])); return after.length === 1 && after[0][0] >= 2700 && /珍珠喷泉/.test(after[0][1]) && s.slice(-1)[0][1] === '' && s.slice(-1)[0][0] > 5000; } },
];
// 测试-133 ②：现行协议下（12d3 + 收藏层 coordinator），主档/备份写失败 = 整页锁成「存档已保护，结果需要核对」，不再「失败提示 2.7 秒后放行普通提示」，
// 清掉故障也不会自动恢复写入。所以失败类场景（A B C D F G）统一改断言为：最先出现的是失败/保护提示；它显示满 2.7 秒前没有被普通提示盖掉；主档和备份一个字节都没变。
// 原稿的「2.7 秒后放出最新一条普通提示」「清故障后恢复」两段在锁档后不成立——锁档后普通提示还要不要显示，待熊大定，这里不替他断言。E（存档正常）照原样。
const LOCKED = s => s.length > 0 && isFail(s[0][1]) && !s.some(x => x[1] && !isFail(x[1]) && x[0] - s[0][0] < 2700);
for (const C of CASES) if (C.fail) { C.check = LOCKED; delete C.keep; }
let allOk = true;
for (const path of ['/', '/preview/']) for (const w of [320, 393]) for (const C of CASES) {
  const { ctx, pg, errs, key, bak } = await setup(path, w);
  await pg.evaluate(c => __tzz.switchShop(c), C.cur); await pg.waitForTimeout(300);
  const b0 = await pg.evaluate(([k, bk]) => [localStorage.getItem(k), localStorage.getItem(bk)], [key, bak]);
  if (C.fail) await failOn(pg, [key, bak]);
  await pg.evaluate(() => { window.__tl = [[performance.now(), '']]; });
  const t0 = await at(pg, C.steps, C.total);
  const tl = await pg.evaluate(() => window.__tl);
  const s = segs(tl.slice(1), t0).map(x => [Math.round(x[0]), x[1]]);
  const b1 = await pg.evaluate(([k, bk]) => [localStorage.getItem(k), localStorage.getItem(bk)], [key, bak]);
  const ok = !!C.check(s) && (!C.fail || C.keep === false || (b0[0] === b1[0] && b0[1] === b1[1])) && !errs.length;
  if (C.name.startsWith('A') || C.name.startsWith('C')) await pg.screenshot({ path:`${OUT}/fix_${C.name.slice(0,1)}_${path.replace(/\//g,'')||'root'}_${w}.png` });
  allOk = allOk && ok; console.log((ok ? 'PASS ' : 'FAIL ') + path + ' ' + w + ' ' + C.name + ' ' + JSON.stringify(s) + (errs.length ? ' ERR ' + errs : ''));
  await failOn(pg, []); await ctx.close();
}
await b.close(); console.log(allOk ? 'ALL PASS' : 'SOME FAIL'); process.exit(allOk ? 0 : 1);
