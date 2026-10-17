// 家宅-155 preview 行为验收（只测不改游戏代码）：preview/app.js、preview/pet/game/app.js 的房间底图回退。
// preview 没有家宅-150 的月亮/街灯，所以这里只验 ①的回退本身：
//   A 底图被拦（route abort art/home_*.webp）→ 每间房 img.room-art 被撤掉、.room 不再带 has-art、0 JS 错；
//   B 对照：底图正常 → img.room-art 加载成功（naturalWidth>0）、.room 带 has-art。
// 4 位 CEO × Lv1–3 × 2 个 preview 入口，390×844。preview 根入口先点「同意并继续」建新版预览档（新档，不碰正式档）。
// 用法：BROWSER=chromium CHROMIUM_PATH=… node scenarios-155-preview.mjs（默认 WebKit）
import { webkit, chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';
import { VIEWPORT } from './save-recipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = (process.env.BROWSER || 'webkit').toLowerCase();
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const ENTRIES = ['/preview/', '/preview/pet/game/'];
const CEOS = ['c77', 'pearl', 'otaku', 'rocket'];
const LVS = [1, 2, 3];
const ART = /\/art\/home_[^/]+\.webp/;
const checks = [], errors = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail: typeof detail === 'string' ? detail : JSON.stringify(detail) }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail))}`); };
const tagOf = (e) => e === ENTRIES[0] ? 'preview-root' : 'preview-pet';

async function boot(page, base, entry) {
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  // preview 根入口新档会先后弹「建立新版预览存档」和「开启新收藏？」两道提示（见文案-87），依次点同意/升级
  for (const name of ['同意并继续', '保留备份并升级']) {
    const btn = page.getByRole('button', { name, exact: true });
    await btn.first().waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
    if (await btn.count() && await btn.first().isVisible()) { await btn.first().click(); await page.waitForTimeout(500); }
  }
  await page.waitForFunction('window.__tzz && window.__tzz.state', null, { timeout: 30000 });
  const open = page.getByRole('button', { name: '开摊！', exact: true });
  if (await open.count() && await open.first().isVisible()) { await open.first().click(); await page.waitForTimeout(300); }
  for (let i = 0; i < 6; i++) {
    const c = page.locator('#claim, #mOk');
    if (await c.count() && await c.first().isVisible()) { await c.first().click(); await page.waitForTimeout(300); } else break;
  }
}

async function run(browser, base, entry, mode) {
  const tag = `${tagOf(entry)} ${mode}`;
  const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: ENGINE !== 'firefox', hasTouch: true, timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  let blocked = 0, failedReq = 0;
  page.on('pageerror', (e) => errors.push({ label: tag, kind: 'pageerror', text: e.message }));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push({ label: tag, kind: 'console', text: m.text() }); });
  page.on('requestfailed', (r) => { if (ART.test(r.url())) failedReq++; });
  if (mode === 'fail') await page.route(ART, (r) => { blocked++; return r.abort(); });
  try {
    await boot(page, base, entry);
    for (const who of CEOS) for (const lv of LVS) {
      const b0 = blocked, f0 = failedReq;
      const setup = await page.evaluate(({ who, lv }) => {
        const t = window.__tzz;
        if (t.state.ceos && t.state.ceos[who]) t.state.ceos[who].unlocked = true;
        t.setTab('home'); if ('homeMode' in t) t.homeMode = 'live';
        t.E.homeOf(t.state, who).lv = lv;
        t.act('homeWho', who); t.renderTab();
        const r = document.querySelector('.room'), img = r && r.querySelector('img.room-art');
        return { room: !!r, img: img ? img.getAttribute('src') : null };
      }, { who, lv });
      const k = `${tag}: ${who} Lv${lv}`;
      if (!setup.room || !setup.img) { check(`${k}: room with room-art rendered`, false, setup); continue; }
      // 条件满足的同一帧里取状态（避免重渲染换了新 img 还没加载完时误判）；超时不吞，取当时状态交给断言
      const probe = (fail) => { const r = document.querySelector('.room'); if (!r) return false; const img = r.querySelector('img.room-art'); const st = { hasArt: r.classList.contains('has-art'), img: !!img, w: img ? img.naturalWidth : 0 }; return (fail ? !img : (img && img.complete && img.naturalWidth > 0)) ? st : false; };
      let timedOut = false, st;
      try { st = await (await page.waitForFunction(probe, mode === 'fail', { timeout: 10000 })).jsonValue(); }
      catch { timedOut = true; st = await page.evaluate(() => { const r = document.querySelector('.room'), img = r && r.querySelector('img.room-art'); return { hasArt: !!r && r.classList.contains('has-art'), img: !!img, w: img ? img.naturalWidth : 0 }; }); }
      if (!setup.img.includes(`home_${who}_${lv}.`)) check(`${k}: rendered this CEO/Lv room art`, false, setup);
      if (mode === 'fail') check(`${k}: art blocked+failed → img removed, has-art removed`, !timedOut && blocked > b0 && failedReq > f0 && !st.img && !st.hasArt, { timedOut, blocked: blocked - b0, failedReq: failedReq - f0, ...st, src: setup.img });
      else check(`${k}: art loads (naturalWidth>0) and has-art kept`, !timedOut && st.img && st.w > 0 && st.hasArt, { timedOut, ...st, src: setup.img });
      if (who === 'c77' && lv === 3) await page.screenshot({ path: path.join(OUT, `155-preview-${ENGINE}-${tagOf(entry)}-${mode}.png`) });
    }
  } catch (e) { check(`${tag}: ran`, false, e.stack || String(e)); } finally { await ctx.close(); }
}

const { server, url: base } = await startServer();
const browser = await (ENGINE === 'chromium' ? chromium : webkit).launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
try { for (const e of ENTRIES) { await run(browser, base, e, 'fail'); await run(browser, base, e, 'ok'); } }
finally { await browser.close(); server.close(); }
const failed = checks.filter((c) => !c.ok), ok = failed.length === 0 && errors.length === 0;
const lines = [`家宅-155 preview 底图回退 (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}（只滤掉 Failed to load resource 这一类资源加载报错）`, '',
  ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.ok ? '' : '  — ' + c.detail}`), ...errors.map((e) => `JSERR (${e.label}) ${e.kind}: ${e.text}`), '',
  'NOT COVERED: iOS 真机；preview 没有家宅-150 月亮/街灯，故不验故事层；房间等级只改内存态'];
fs.writeFileSync(path.join(OUT, `report-155-preview-${ENGINE}.txt`), lines.join('\n'));
console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
process.exit(ok ? 0 : 1);
