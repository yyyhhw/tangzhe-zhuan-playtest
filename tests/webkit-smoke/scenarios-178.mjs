// 测试-178 — 收尾 WebKit 回归（只测不改游戏代码）。熊二 10/18 20:00 派。
// 在给定 main（默认工作流 inputs.ref）上，四个入口 × 390×844 / 844×390：
//   A 打开：READY 出现、无 pageerror / console.error、5 秒内不重载（无重载循环）
//   B 缓存号：正式入口（/、/pet/game/）请求的 style.css、app.js 都带 copy04-20261018-r1；preview 入口只记录实际号，不判
//   C 体验-177（只正式入口）：收藏页「设置」分区里带「重新开始（暂不可用）」的卡，卡高 <160px、.info 宽 ≥ 卡宽 80%、卡名可见
//   D 文案-04（只正式入口）：收藏页 / 盲盒页 / 经营页可见文字里没有「游戏金币」和收尾范围内的「+N/秒」（:1444/:1435 保留项只记录）；开店雇员后经营页出现「每秒 +」；设置卡名是「设置」
// 用法：ENGINES=webkit node scenarios-178.mjs   （CHROMIUM_PATH 可选，本机自检用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './static-server.mjs';

const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = (process.env.ENGINES || 'webkit').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 844, height: 390 }];
const ENTRIES = ['/', '/pet/game/', '/preview/', '/preview/pet/game/'];
const FORMAL = new Set(['/', '/pet/game/']);
const CACHE = process.env.CACHE_TAG || 'copy04-20261018-r1';
const READY = 'window.__tzz && window.__tzz.E && window.__tzz.state';

const results = [];
let shotN = 0;
function rec(combo, scen, status, detail = '') {
  results.push({ combo, scen, status, detail: String(detail).slice(0, 500) });
  console.log(`${status.padEnd(4)}  [${combo}] ${scen}${detail ? '  — ' + detail : ''}`);
}
const isNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);
async function shot(page, name) { try { await page.screenshot({ path: path.join(OUT, `178-${String(++shotN).padStart(2, '0')}-${name}.png`), fullPage: false }); } catch {} }
async function clearModals(page) {
  for (let i = 0; i < 8; i++) {
    let hit = false;
    for (const sel of ['#claim', '#mOk', '#mClose']) {
      const l = page.locator(sel);
      if (await l.count() && await l.first().isVisible().catch(() => false)) { await l.first().click().catch(() => {}); await page.waitForTimeout(250); hit = true; break; }
    }
    if (!hit) break;
  }
}
async function consent(page) {
  for (const name of ['同意并继续', '保留备份并升级']) {
    const b = page.getByRole('button', { name });
    try { await b.first().waitFor({ state: 'visible', timeout: 2500 }); await b.first().click(); } catch {}
  }
}

async function runCombo(browser, base, eng, vp, entry) {
  const combo = `${eng} ${vp.width}x${vp.height} ${entry}`;
  const tag = `${eng}-${vp.width}-${entry.replace(/\//g, '_') || 'root'}`;
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  const errs = [], reqs = [];
  let navs = 0;
  page.on('pageerror', (e) => errs.push('pageerror: ' + String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errs.push('console: ' + m.text()); });
  page.on('request', (r) => reqs.push(r.url()));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) navs++; });
  try {
    // A 打开
    await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
    if (entry.startsWith('/preview')) await consent(page);
    let ready = true;
    try { await page.waitForFunction(READY, null, { timeout: 30000 }); } catch { ready = false; }
    const start = page.getByRole('button', { name: '开摊！', exact: true });
    if (await start.count().catch(() => 0)) await start.first().click().catch(() => {});
    await clearModals(page);
    const navBefore = navs;
    await page.waitForTimeout(5000);
    const reloads = navs - navBefore;
    await shot(page, `${tag}-open`);
    rec(combo, 'A 打开', ready && !errs.length && reloads === 0 ? 'PASS' : 'FAIL', `READY=${ready} 报错=${errs.length}${errs.length ? '（' + errs.slice(0, 2).join(' | ') + '）' : ''} 5秒内重载=${reloads}`);
    if (!ready) return;

    // B 缓存号
    const key = reqs.filter((u) => /\/(style\.css|app\.js)\?/.test(u)).map((u) => new URL(u));
    const tags = [...new Set(key.map((u) => `${u.pathname.split('/').pop()}?v=${u.searchParams.get('v')}`))];
    if (FORMAL.has(entry)) {
      const bad = key.filter((u) => u.searchParams.get('v') !== CACHE);
      rec(combo, 'B 缓存号', key.length >= 2 && !bad.length ? 'PASS' : 'FAIL', tags.join('、') || '没抓到 style.css/app.js 请求');
    } else rec(combo, 'B 缓存号', 'INFO', `preview 只记录：${tags.join('、') || '无'}`);

    if (!FORMAL.has(entry)) return;

    // C 体验-177
    await page.evaluate(() => { window.__tzz.setTab('col'); });
    await page.waitForTimeout(400);
    const c = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('重新开始（暂不可用）'));
      const card = btn && btn.closest('.card');
      if (!card) return null;
      card.scrollIntoView({ block: 'center' });
      const r = card.getBoundingClientRect(), info = card.querySelector(':scope > .info');
      const name = info && info.querySelector('.name');
      return { h: Math.round(r.height), w: Math.round(r.width), infoW: info ? Math.round(info.getBoundingClientRect().width) : 0, name: name ? name.textContent.trim() : null, nameH: name ? Math.round(name.getBoundingClientRect().height) : 0 };
    });
    await page.waitForTimeout(200);
    await shot(page, `${tag}-177-settings`);
    if (!c) rec(combo, 'C 体验-177', 'FAIL', '收藏页没找到「重新开始（暂不可用）」那张卡');
    else rec(combo, 'C 体验-177', c.h < 160 && c.infoW >= c.w * 0.8 && c.nameH > 0 ? 'PASS' : 'FAIL', `卡高 ${c.h}px 卡宽 ${c.w} .info 宽 ${c.infoW} 卡名「${c.name}」高 ${c.nameH}`);

    // D 文案-04
    const visible = async (t) => { await page.evaluate((t) => window.__tzz.setTab(t), t); await page.waitForTimeout(350); return page.evaluate(() => document.body.innerText); };
    const texts = { col: await visible('col'), gacha: await visible('gacha') };
    await page.evaluate(() => { const st = window.__tzz.state; for (const s of st.shops.slice(0, 1)) { s.open = true; s.emp = Math.max(1, s.emp || 0); } window.__tzz.setTab('shop'); window.__tzz.renderTab && window.__tzz.renderTab(); });
    await page.waitForTimeout(500);
    texts.shop = await page.evaluate(() => document.body.innerText);
    await shot(page, `${tag}-04-shop`);
    const all = Object.values(texts).join('\n');
    // 收尾范围只改 5 处「+N/秒」；:1444 员工升级「速度 +X% → +N/秒」与 :1435「…/秒原料」按熊二 17:15 口径是保留项，只记录不判
    const old1 = (all.match(/游戏金币/g) || []).length;
    const keep = (all.match(/→ \+[^\s]*\/秒|\/秒原料/g) || []).length;
    const old2 = (all.match(/\+[^\s+]*\/秒/g) || []).length - (all.match(/→ \+[^\s]*\/秒/g) || []).length;
    const perSec = /每秒 [+−]/.test(texts.shop), setName = c && c.name === '设置';
    rec(combo, 'D 文案-04', !old1 && !old2 && perSec && setName ? 'PASS' : 'FAIL', `「游戏金币」${old1} 处、范围内「+N/秒」${old2} 处（保留项 ${keep} 处不判）、经营页「每秒 +」=${perSec}、设置卡名=${c && c.name}`);
    if (errs.length) rec(combo, 'A2 全程报错', 'FAIL', errs.slice(0, 3).join(' | '));
  } catch (e) {
    rec(combo, '脚本', 'FAIL', String(e && e.message || e).split('\n')[0]);
  } finally { await ctx.close(); }
}

const { server, url: base } = await startServer();
let exit = 0;
try {
  for (const eng of ENGINES) {
    let browser;
    try {
      const opts = eng === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
      browser = await pw[eng].launch(opts);
    } catch (e) { rec(eng, '全部', 'SKIP', `环境：${eng} 启动不了（${String(e.message).split('\n')[0].slice(0, 120)}）`); exit = 1; continue; }
    for (const vp of VIEWPORTS) for (const entry of ENTRIES) await runCombo(browser, base, eng, vp, entry);
    await browser.close();
  }
} finally { server.close(); }
const fail = results.filter((r) => r.status === 'FAIL').length, pass = results.filter((r) => r.status === 'PASS').length;
fs.writeFileSync(path.join(OUT, 'report-178.json'), JSON.stringify({ cache: CACHE, pass, fail, results }, null, 2));
console.log(`\n测试-178：PASS ${pass} / FAIL ${fail} / 共 ${results.length}`);
if (fail) exit = 1;
process.exit(exit);
