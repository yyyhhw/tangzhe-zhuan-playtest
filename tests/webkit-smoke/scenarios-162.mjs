// 测试-162 — 家宅-31（房间风格自选）/ 家宅-43（「烟火小馆」24 件家具）的非作者交叉测脚本（只测，不改游戏代码）。
// 杨总 10/18 00:50 拍板：熊大开发 31/43，王大妈做非作者 Chromium + WebKit 交叉测。本文件先把场景写好，31/43 交 SHA 后直接跑。
//
// 场景（每个 引擎 × 宽度 × 入口 都跑一遍；入口 = 正式版 / 和 /preview/）：
//   31①  新档：c77 房间默认「不设风格」；选一种风格 → 房名牌变了 → 保存刷新后风格还在。
//   31②  旧档：把存档里所有房间的风格字段删掉再进 → 不报错、默认「不设风格」、房名牌是「{主人}的{小屋}」。
//   31③  收益不变：同一时刻 E.onlineRate 在选风格前后相等。
//   31④  正式 / preview 一致：两边风格列表（id + 名字）逐项相同。
//   43①  E.FURNITURE 里带「烟火小馆」(diner) 标签的正好 24 件；商城点「烟火小馆」筛选按钮，能看到 24 张卡片。
//   43②  能买能摆：买一件 diner 家具扣对钱，摆进 c77 房间成功；保存刷新后还在。
//   43③  旧档（没有任何 diner 家具）读档不报错。
// 还没实现时：对应场景记 SKIP「待实现」，不算失败；脚本本身出 JS 报错才算失败。
// 宽度：390×844、844×390。引擎：Chromium + WebKit（本机没装 WebKit 时记 SKIP「环境」，不冒充通过）。
//
// 31 的接口还没定，下面 ADAPTER 按名字依次找；熊大交 SHA 时如果名字不同，只改这一处。
//   风格表：E.ROOM_STYLES / E.HOME_STYLES（数组，每项 {id, name}，含 'none'）
//   设置：  E.setHomeStyle(st, ceoId, styleId) / E.setRoomStyle(...)
//   读取：  E.homeStyleOf(st, ceoId) / E.roomStyleOf(...)，都没有就读 E.homeOf(st, ceoId).style
//
// 用法：node tests/webkit-smoke/scenarios-162.mjs
//   ENGINES=chromium,webkit（默认两个都跑）  CHROMIUM_PATH=/opt/pw-browsers/chromium/...（可选）
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs（可选，和 scripts/run-all-tests.mjs 一样）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './static-server.mjs';
import { TAB_LOCK_KEY, SEED_SENTINEL } from './save-recipe.mjs';

const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 844, height: 390 }];
const ENTRIES = ['/', '/preview/'];
const READY = 'window.__tzz && window.__tzz.E && window.__tzz.state';
const DINER_COUNT = 24;
const SCENARIOS = ['31①', '31②', '31③', '31④', '43①', '43②', '43③'];

const results = [], errors = [];
let shotN = 0;
function rec(combo, scen, status, detail = '') {
  results.push({ combo, scen, status, detail: String(detail).slice(0, 400) });
  console.log(`${status.padEnd(4)}  [${combo}] ${scen}${detail ? '  — ' + detail : ''}`);
}
const isNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);
function wire(page, label) {
  page.on('pageerror', (e) => { errors.push({ label, text: String(e) }); console.log(`PAGEERROR [${label}] ${e}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) { errors.push({ label, text: m.text() }); console.log(`CONSOLE.ERROR [${label}] ${m.text()}`); } });
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(OUT, `162-${String(++shotN).padStart(2, '0')}-${name}.png`) }); } catch {} }

async function clearModals(page) {
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const sel of ['#claim', '#mOk']) {
      const l = page.locator(sel);
      if (await l.count() && await l.first().isVisible()) { await l.first().click(); await page.waitForTimeout(250); hit = true; break; }
    }
    if (!hit) break;
  }
}
// preview 首次进入要先点「同意并继续」，可能再弹「保留备份并升级」（照 tests/formal 的做法）
async function consent(page) {
  for (const name of ['同意并继续', '保留备份并升级']) {
    const b = page.getByRole('button', { name });
    try { await b.first().waitFor({ state: 'visible', timeout: 2500 }); await b.first().click(); } catch {}
  }
}
async function load(page, base, entry) {
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  if (entry !== '/') await consent(page);
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
async function reload(page) {
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  await page.reload({ waitUntil: 'load' });
  if (new URL(page.url()).pathname.startsWith('/preview')) await consent(page);
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
async function newCtx(browser, vp, seed) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, timezoneId: 'Asia/Tokyo' });
  if (seed) await ctx.addInitScript(({ seed, sentinel }) => {
    try {
      if (localStorage.getItem(sentinel)) return;
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem(sentinel, '1');
    } catch {}
  }, { seed, sentinel: SEED_SENTINEL });
  return ctx;
}
async function generateSeed(browser, base, entry) {
  const ctx = await newCtx(browser, VIEWPORTS[0]);
  const page = await ctx.newPage(); wire(page, `seed${entry}`);
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  if (entry !== '/') await consent(page);
  await page.waitForFunction(READY, null, { timeout: 30000 });
  const start = page.getByRole('button', { name: '开摊！', exact: true });
  if (await start.count()) await start.first().click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist(); } catch {} });
  const seed = await page.evaluate(() => ({ ls: Object.fromEntries(Object.entries(localStorage)), key: window.__tzz.SAVE_KEY }));
  await ctx.close();
  return seed;
}
// stripStyle：旧档 —— 删掉每个房间的风格字段（字段名未定，style / roomStyle / homeStyle 都删）
function mkSeed({ ls, key }, { stripStyle = false } = {}) {
  const seed = ls, save = JSON.parse(seed[key]);
  save.coins = 1e12;
  for (const shop of save.shops || []) Object.assign(shop, { open: true, lv: 35, emp: 1 });   // 开店，31③ 收益才不是 0
  save.lastSeen = save.maxSeen = Date.now();
  if (stripStyle && save.homes) for (const h of Object.values(save.homes)) if (h && typeof h === 'object') { delete h.style; delete h.roomStyle; delete h.homeStyle; }
  const out = { ...seed, [key]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  for (const k of Object.keys(out)) if (/tab-lock$/.test(k)) delete out[k];
  return out;
}

// —— 页内探针 ——
const probe31 = (page) => page.evaluate(() => {
  const E = window.__tzz.E;
  const styles = E.ROOM_STYLES || E.HOME_STYLES || null;
  const set = E.setHomeStyle || E.setRoomStyle || null;
  return { ok: Array.isArray(styles) && styles.length > 0 && typeof set === 'function', list: Array.isArray(styles) ? styles.map((s) => ({ id: s.id, name: s.name })) : null };
});
const getStyle = (page, who = 'c77') => page.evaluate((who) => {
  const E = window.__tzz.E, st = window.__tzz.state, get = E.homeStyleOf || E.roomStyleOf;
  const v = get ? get(st, who) : E.homeOf(st, who).style;
  return v == null ? 'none' : (typeof v === 'object' ? v.id : v);
}, who);
const setStyle = (page, sid, who = 'c77') => page.evaluate(({ sid, who }) => {
  const E = window.__tzz.E, st = window.__tzz.state; const r = (E.setHomeStyle || E.setRoomStyle)(st, who, sid);
  window.__tzz.persist(); window.__tzz.setTab('home'); return r && typeof r === 'object' ? r : { ok: r !== false };
}, { sid, who });
// 房名牌只取 .rw-name 自己的文字（不含里面的「时段 · 天气」小标签）
const plate = async (page) => {
  await page.evaluate(() => window.__tzz.setTab('home')); await page.waitForTimeout(300);
  return page.evaluate(() => { const el = document.querySelector('.rw-name'); return el ? [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim() : null; });
};
const dinerIds = (page) => page.evaluate(() => { const E = window.__tzz.E; return E.FURNITURE.filter((f) => (E.furnStyles(f.id) || []).some((s) => s && s.id === 'diner')).map((f) => f.id); });

async function run31(browser, base, vp, entry, seeds, combo, lists) {
  // ①③ 新档
  let ctx = await newCtx(browser, vp, mkSeed(seeds[entry]));
  let page = await ctx.newPage(); wire(page, combo);
  await load(page, base, entry);
  const p = await probe31(page);
  lists[entry] = p.list;
  if (!p.ok) { for (const s of ['31①', '31②', '31③']) rec(combo, s, 'SKIP', '待实现（没找到风格表/设置函数）'); await ctx.close(); return; }
  const def = await getStyle(page), plate0 = await plate(page);
  const target = p.list.find((s) => s.id !== 'none' && s.id !== '') || p.list[0];
  const rate0 = await page.evaluate(() => { const t = Date.now(); window.__t162 = t; return window.__tzz.E.onlineRate(window.__tzz.state, t); });
  const r = await setStyle(page, target.id);
  const rate1 = await page.evaluate(() => window.__tzz.E.onlineRate(window.__tzz.state, window.__t162));
  const plate1 = await plate(page);
  await shot(page, `${combo}-31-${target.id}`.replace(/[^\w-]/g, '_'));
  await reload(page);
  const after = await getStyle(page), plate2 = await plate(page);
  const ok1 = def === 'none' && r.ok !== false && plate1 && plate1 !== plate0 && after === target.id && plate2 === plate1;
  rec(combo, '31①', ok1 ? 'PASS' : 'FAIL', `默认=${def} 选=${target.id} 刷新后=${after} 房名 ${plate0}→${plate1}→${plate2}`);
  const ok3 = Number.isFinite(rate0) && rate0 > 0 && Math.abs(rate1 - rate0) <= Math.abs(rate0) * 1e-12;
  rec(combo, '31③', ok3 ? 'PASS' : 'FAIL', `onlineRate ${rate0} → ${rate1}`);
  await ctx.close();
  // ② 旧档
  const errBefore = errors.length;
  ctx = await newCtx(browser, vp, mkSeed(seeds[entry], { stripStyle: true }));
  page = await ctx.newPage(); wire(page, combo + '-old');
  await load(page, base, entry);
  const oldStyle = await getStyle(page), oldPlate = await plate(page);
  const owner = await page.evaluate(() => window.__tzz.E.CEO_BY_ID.c77.name);
  const ok2 = errors.length === errBefore && oldStyle === 'none' && !!oldPlate && oldPlate.startsWith(owner.replace(/\s+/g, '').slice(0, 2));
  rec(combo, '31②', ok2 ? 'PASS' : 'FAIL', `风格=${oldStyle} 房名=${oldPlate} 新报错=${errors.length - errBefore}`);
  await ctx.close();
}

async function run43(browser, base, vp, entry, seeds, combo) {
  const errBefore = errors.length;
  const ctx = await newCtx(browser, vp, mkSeed(seeds[entry]));
  const page = await ctx.newPage(); wire(page, combo);
  await load(page, base, entry);
  const ids = await dinerIds(page);
  // ③ 旧档：种子里本来就没有 diner 家具，能进且没报错即算
  const ok3 = errors.length === errBefore;
  if (!ids.length) {
    rec(combo, '43①', 'SKIP', '待实现（diner 标签 0 件）'); rec(combo, '43②', 'SKIP', '待实现');
    rec(combo, '43③', ok3 ? 'PASS' : 'FAIL', `旧档读档报错=${errors.length - errBefore}（main 上也照跑）`);
    await ctx.close(); return;
  }
  // ① 件数 + 商城筛选
  let cards = null;
  try {
    await page.evaluate(() => window.__tzz.setTab('home'));
    await page.waitForTimeout(300);
    const mall = page.locator('[data-act="homeSub"][data-arg="mall"]').first();
    if (await mall.count()) { await mall.click(); await page.waitForTimeout(400); }
    const btn = page.locator('.mall-styles .mst[data-arg="diner"]').first();
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(400); const b = page.locator('.mall-count .mc-num b').first(); cards = (await b.count()) ? Number(await b.innerText()) : '没有 .mall-count'; }
    else cards = '没有「烟火小馆」筛选按钮';
  } catch (e) { cards = `点不到：${e.message}`; }
  await shot(page, `${combo}-43-mall`.replace(/[^\w-]/g, '_'));
  rec(combo, '43①', ids.length === DINER_COUNT && cards === DINER_COUNT ? 'PASS' : 'FAIL', `目录 ${ids.length} 件，筛选后卡片 ${cards}（商城选择器若不同请改 run43）`);
  // ② 买 + 摆 + 刷新
  const buy = await page.evaluate((fid) => {
    const T = window.__tzz, E = T.E, st = T.state, price = E.FURN_BY_ID[fid].price, c0 = st.coins;
    const b = E.buyFurniture(st, fid); if (!b.ok) return { ok: false, why: b.why };
    const spot = E.findFree(st, 'c77', fid); if (!spot) return { ok: false, why: '房间没空位' };
    const p = E.placeItem(st, 'c77', fid, spot.x, spot.y, 0, spot.surf); T.persist();
    return { ok: !!(p && p.ok !== false), paid: c0 - st.coins, price };
  }, ids[0]);
  await reload(page);
  const kept = await page.evaluate((fid) => window.__tzz.E.homeOf(window.__tzz.state, 'c77').placed.some((p) => p.fid === fid || p.id === fid), ids[0]);
  rec(combo, '43②', buy.ok && Math.abs(buy.paid - buy.price) < 1 && kept ? 'PASS' : 'FAIL', `${ids[0]} 扣 ${buy.paid}/${buy.price} 摆=${buy.ok} 刷新后在=${kept} ${buy.why || ''}`);
  rec(combo, '43③', ok3 ? 'PASS' : 'FAIL', `旧档读档报错=${errors.length - errBefore}`);
  await ctx.close();
}

const { server, url: base } = await startServer();
let exit = 0;
try {
  for (const eng of ENGINES) {
    let browser;
    try {
      const opts = eng === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
      browser = await pw[eng].launch(opts);
    } catch (e) {
      for (const s of SCENARIOS) rec(eng, s, 'SKIP', `环境：${eng} 启动不了（${String(e.message).split('\n')[0].slice(0, 120)}）`);
      continue;
    }
    const seeds = {};
    for (const entry of ENTRIES) seeds[entry] = await generateSeed(browser, base, entry);
    for (const vp of VIEWPORTS) {
      const lists = {};
      for (const entry of ENTRIES) {
        const combo = `${eng} ${vp.width}x${vp.height} ${entry === '/' ? '正式' : 'preview'}`;
        await run31(browser, base, vp, entry, seeds, combo, lists);
        await run43(browser, base, vp, entry, seeds, combo);
      }
      const combo = `${eng} ${vp.width}x${vp.height}`;
      if (!lists['/'] || !lists['/preview/']) rec(combo, '31④', 'SKIP', `待实现（正式=${!!lists['/']} preview=${!!lists['/preview/']}）`);
      else rec(combo, '31④', JSON.stringify(lists['/']) === JSON.stringify(lists['/preview/']) ? 'PASS' : 'FAIL', `正式 ${lists['/'].length} 种 / preview ${lists['/preview/'].length} 种`);
    }
    await browser.close();
  }
} catch (e) {
  errors.push({ label: 'runner', text: String(e && e.stack || e) }); console.log('RUNNER ERROR', e);
} finally {
  server.close();
}
const n = (s) => results.filter((r) => r.status === s).length;
const report = { pass: n('PASS'), fail: n('FAIL'), skip: n('SKIP'), jsErrors: errors.length, results, errors };
fs.writeFileSync(path.join(OUT, 'report-162.json'), JSON.stringify(report, null, 2));
console.log(`\n测试-162：PASS ${report.pass} / FAIL ${report.fail} / SKIP ${report.skip} / JS 报错 ${report.jsErrors}`);
if (report.fail || report.jsErrors) exit = 1;
process.exit(exit);
