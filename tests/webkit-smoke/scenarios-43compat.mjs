// 测试-43compat — 家宅-43 高风险代验补充场景（王大妈，只测，不改游戏代码）。
// 同一个源（同一个端口，存档共用）下切换「新版 = 43 候选」和「旧版 = 不含 43 的 main」两份代码，验三件事：
//   C  新版自己的保护：存档里塞一件本版本不认识的 fid（摆在房间 + 放仓库各一件）→ 新版开页不报错；摆着的退进仓库、
//      仓库里的数量不丢；进装修模式不报错；刷新后仍在仓库。
//   A  已摆放（熊二 16:09 两步之一）：新版买一件烟火小馆家具摆进 c77 → 存盘 → 旧版打开同一份存档 → 记录摆件/仓库是否还在、
//      有没有 pageerror → 再切回新版看是否还能找回。这是确认兼容现状（main 不回退的前提），不当作 43 本身的 PASS 条件。
//   B  只在仓库：新版买一件不摆 → 旧版打开并进装修模式 → 记录 pageerror、仓库计数 → 切回新版看是否还在。同 A，只记现状。
// 引擎 × 宽度 × 入口：ENGINES（默认 chromium,webkit）× 390×844 / 844×390 × 正式 / preview。
// 用法：NEW_ROOT=<43 候选树> OLD_ROOT=<旧 main 树> node tests/webkit-smoke/scenarios-43compat.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TAB_LOCK_KEY, SEED_SENTINEL } from './save-recipe.mjs';

const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const NEW_ROOT = path.resolve(process.env.NEW_ROOT || path.join(__dirname, '..', '..'));
const OLD_ROOT = process.env.OLD_ROOT ? path.resolve(process.env.OLD_ROOT) : '';
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 844, height: 390 }];
const ENTRIES = ['/', '/preview/'];
const READY = 'window.__tzz && window.__tzz.E && window.__tzz.state';
const FAKE = 'furn_zz_future_test_item';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2' };
let ROOT = NEW_ROOT;
const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.normalize(path.join(ROOT, p)); if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(d); });
  } catch { res.writeHead(500); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [], errors = [];
function rec(combo, scen, status, detail = '') { results.push({ combo, scen, status, detail: String(detail).slice(0, 500) }); console.log(`${status.padEnd(4)}  [${combo}] ${scen}  — ${detail}`); }
const isNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);
let curLabel = '';
function wire(page) {
  page.on('pageerror', (e) => { errors.push({ label: curLabel, text: String(e) }); console.log(`PAGEERROR [${curLabel}] ${e}`); });
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) { errors.push({ label: curLabel, text: m.text() }); console.log(`CONSOLE.ERROR [${curLabel}] ${m.text()}`); } });
}
async function clearModals(page) {
  for (let i = 0; i < 6; i++) {
    let hit = false;
    for (const sel of ['#claim', '#mOk']) { const l = page.locator(sel); if (await l.count() && await l.first().isVisible()) { await l.first().click(); await page.waitForTimeout(250); hit = true; break; } }
    if (!hit) break;
  }
}
async function consent(page) {
  for (const name of ['同意并继续', '保留备份并升级']) { const b = page.getByRole('button', { name }); try { await b.first().waitFor({ state: 'visible', timeout: 2500 }); await b.first().click(); } catch {} }
}
async function open(page, entry, root, label) {
  ROOT = root; curLabel = label;
  await page.goto(base + entry, { waitUntil: 'load' });
  if (entry !== '/') await consent(page);
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page); await page.waitForTimeout(400);
}
const persist = (page) => page.evaluate(() => { try { window.__tzz.persist(); } catch {} });
const snap = (page, fid) => page.evaluate((fid) => { const T = window.__tzz, E = T.E, st = T.state; const placed = Object.values(st.homes || {}).reduce((n, h) => n + ((h && h.placed) || []).filter((p) => p.fid === fid).length, 0); return { placed, inv: (E.furnInvOf(st)[fid] || 0), coins: st.coins, known: !!E.FURN_BY_ID[fid], blocked: !!T.saveBlocked }; }, fid);
async function decor(page) {
  return page.evaluate(() => { const T = window.__tzz; try { T.setTab('home'); T.homeMode = 'decor'; T.renderTab && T.renderTab(); return document.querySelectorAll('.inv-strip > *').length; } catch (e) { return 'ERR ' + e.message; } });
}
async function newCtx(browser, vp, seed) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, timezoneId: 'Asia/Tokyo' });
  if (seed) await ctx.addInitScript(({ seed, sentinel }) => { try { if (localStorage.getItem(sentinel)) return; localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); localStorage.setItem(sentinel, '1'); } catch {} }, { seed, sentinel: SEED_SENTINEL });
  return ctx;
}
async function genSeed(browser, entry) {
  const ctx = await newCtx(browser, VIEWPORTS[0]); const page = await ctx.newPage(); wire(page);
  ROOT = NEW_ROOT; curLabel = 'seed' + entry;
  await page.goto(base + entry, { waitUntil: 'load' }); if (entry !== '/') await consent(page);
  await page.waitForFunction(READY, null, { timeout: 30000 });
  const start = page.getByRole('button', { name: '开摊！', exact: true }); if (await start.count()) await start.first().click();
  await page.waitForTimeout(300); await persist(page);
  const s = await page.evaluate(() => ({ ls: Object.fromEntries(Object.entries(localStorage)), key: window.__tzz.SAVE_KEY }));
  await ctx.close(); return s;
}
function mkSeed({ ls, key }, mutate) {
  const save = JSON.parse(ls[key]); save.coins = 1e12; save.lastSeen = save.maxSeen = Date.now();
  if (mutate) mutate(save);
  const out = { ...ls, [key]: JSON.stringify(save) }; delete out[TAB_LOCK_KEY]; for (const k of Object.keys(out)) if (/tab-lock$/.test(k)) delete out[k];
  return out;
}

async function runC(browser, vp, entry, seeds, combo) {
  const e0 = errors.length;
  const seed = mkSeed(seeds[entry], (s) => { s.furnInv = { ...(s.furnInv || {}), [FAKE]: 2 }; const h = s.homes && s.homes.c77; if (h) { h.placed = [...(h.placed || []), { uid: 'uzz1', fid: FAKE, x: 0, y: 0, rot: 0 }]; } });
  const ctx = await newCtx(browser, vp, seed); const page = await ctx.newPage(); wire(page);
  await open(page, entry, NEW_ROOT, combo + ' C');
  const a = await snap(page, FAKE); const d = await decor(page); await persist(page);
  await page.screenshot({ path: path.join(OUT, `43c-${combo.replace(/[^\w]/g, '_')}.png`) }).catch(() => {});
  await open(page, entry, NEW_ROOT, combo + ' C-refresh'); const b = await snap(page, FAKE);
  const ok = errors.length === e0 && a.placed === 0 && a.inv === 3 && b.inv === 3 && !a.blocked && typeof d === 'number';
  rec(combo, 'C 新版保留不认识的 fid', ok ? 'PASS' : 'FAIL', `开页 摆=${a.placed} 仓=${a.inv}（期望 0/3）只读=${a.blocked} 装修仓库栏=${d} 刷新后仓=${b.inv} 新报错=${errors.length - e0}`);
  await ctx.close();
}
async function runAB(browser, vp, entry, seeds, combo, which) {
  const e0 = errors.length;
  const ctx = await newCtx(browser, vp, mkSeed(seeds[entry])); const page = await ctx.newPage(); wire(page);
  await open(page, entry, NEW_ROOT, `${combo} ${which}-new`);
  const fid = which === 'A' ? 'furn_s77_red_plastic_stool' : 'furn_s77_small_red_lantern';
  const r = await page.evaluate(({ fid, place }) => { const T = window.__tzz, E = T.E, st = T.state; if (!E.FURN_BY_ID[fid]) return { ok: false, why: '新版没有 ' + fid }; const b = E.buyFurniture(st, fid); if (!b.ok) return { ok: false, why: b.why }; if (place) { const s = E.findFree(st, 'c77', fid); if (!s) return { ok: false, why: '没空位' }; const p = E.placeItem(st, 'c77', fid, s.x, s.y, 0, s.surf); if (p && p.ok === false) return { ok: false, why: p.why }; } T.persist(); return { ok: true }; }, { fid, place: which === 'A' });
  const n0 = await snap(page, fid); const eNew = errors.length;
  await open(page, entry, OLD_ROOT, `${combo} ${which}-old`);
  const o1 = await snap(page, fid); const od = await decor(page); await persist(page);
  await open(page, entry, OLD_ROOT, `${combo} ${which}-old-refresh`); const o2 = await snap(page, fid);
  const eOld = errors.length;
  await open(page, entry, NEW_ROOT, `${combo} ${which}-back`); const n2 = await snap(page, fid);
  const ok = r.ok && eNew === e0 && errors.length === eOld && typeof od === 'number' && n2.placed + n2.inv >= 1;   // A/B 不过只记 INFO（旧版现状），不算 43 失败
  const detail = `新版 买${which === 'A' ? '+摆' : ''}=${r.ok}${r.why ? '(' + r.why + ')' : ''} 摆/仓=${n0.placed}/${n0.inv}｜旧版开页 摆/仓=${o1.placed}/${o1.inv} 装修仓库栏=${od} 存盘刷新后 摆/仓=${o2.placed}/${o2.inv} 旧版报错=${eOld - eNew}｜回新版 摆/仓=${n2.placed}/${n2.inv}`;
  rec(combo, which === 'A' ? 'A 已摆放→旧版→新版' : 'B 仅仓库→旧版装修→新版', ok ? 'PASS' : 'INFO', detail);
  await ctx.close();
}

let exit = 0;
try {
  for (const eng of ENGINES) {
    let browser;
    try { browser = await pw[eng].launch(eng === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); }
    catch (e) { rec(eng, '全部', 'SKIP', '环境：启动不了 ' + String(e.message).split('\n')[0].slice(0, 120)); continue; }
    const seeds = {}; for (const entry of ENTRIES) seeds[entry] = await genSeed(browser, entry);
    for (const vp of VIEWPORTS) for (const entry of ENTRIES) {
      const combo = `${eng} ${vp.width}x${vp.height} ${entry === '/' ? '正式' : 'preview'}`;
      await runC(browser, vp, entry, seeds, combo);
      if (OLD_ROOT) { await runAB(browser, vp, entry, seeds, combo, 'A'); await runAB(browser, vp, entry, seeds, combo, 'B'); }
      else rec(combo, 'A/B', 'SKIP', '没给 OLD_ROOT');
    }
    await browser.close();
  }
} catch (e) { errors.push({ label: 'runner', text: String(e && e.stack || e) }); console.log('RUNNER ERROR', e); }
finally { server.close(); }
const n = (s) => results.filter((r) => r.status === s).length;
const report = { newRoot: NEW_ROOT, oldRoot: OLD_ROOT, pass: n('PASS'), fail: n('FAIL'), info: n('INFO'), skip: n('SKIP'), jsErrors: errors.length, results, errors };
fs.writeFileSync(path.join(OUT, 'report-43compat.json'), JSON.stringify(report, null, 2));
console.log(`\n测试-43compat：PASS ${report.pass} / FAIL ${report.fail} / INFO ${report.info} / SKIP ${report.skip} / JS 报错 ${report.jsErrors}`);
if (report.fail || results.some((r) => r.scen.startsWith('C') && r.status !== 'PASS')) exit = 1;
process.exit(exit);
