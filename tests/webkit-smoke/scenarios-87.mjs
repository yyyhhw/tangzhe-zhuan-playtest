// 文案-87 高风险代验（王大妈，非作者）：xiongda/copy87-preview-minimal 的玩家可见路径。只测，不改游戏代码。
// 每个 引擎 × 宽度（390×844、844×390）跑：
//   A 预览新档：首进说明是新字、没有旧术语 → 同意 → 升级提示 → 展开说明（200/188/4/8，无 66 件/协议2）→ 确认 → 200 件、协议 2 → 刷新后仍是协议 2、金币不变、不再弹提示
//   B 预览旧档（P1）取消：照常玩原来的 36 件、协议 1、不写快照
//   C 预览旧档（P1）确认：协议 2、200 件、已有收藏和金币不变 → 刷新保留
//   D 正式旧档（根入口、pet/game 入口）：不弹任何迁移提示、协议 2 → 刷新保留金币
//   E 正式与预览 ITEMS 的 id 列表一致
//   F 390 宽下提示面板不横向溢出
// 全程收集 pageerror。用法：node tests/webkit-smoke/scenarios-87.mjs（ENGINES=chromium,webkit）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from './static-server.mjs';
import { setup } from '../wearables8/fixture.mjs';

const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const ENGINES = (process.env.ENGINES || 'chromium,webkit').split(',').map((s) => s.trim()).filter(Boolean);
const VPS = [{ width: 390, height: 844 }, { width: 844, height: 390 }];
const OLD = /共66件|66 件|90%\/60|协议2|协议 2 主档|24 件衣帽和 6 件/;

const fixtures = {};
for (const scope of ['preview', 'formal']) { const t = await setup('a739f61', scope); t.init(); fixtures[scope] = { data: Object.fromEntries(t.data), keys: t.keys }; }
const { server, url } = await startServer();
const base = url.replace(/\/?$/, '/');
const results = [];
const rec = (combo, name, ok, detail = '') => { results.push({ combo, name, ok: !!ok, detail: typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail).slice(0, 300) }); console.log(`${ok ? 'PASS' : 'FAIL'} [${combo}] ${name}${ok ? '' : '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300)}`); };

async function ctxWith(browser, vp, data) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, timezoneId: 'Asia/Tokyo' });
  await ctx.addInitScript((data) => {
    if (!sessionStorage.getItem('__seeded87')) { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded87', '1'); }
    window.__prompts = [];
    new MutationObserver(() => { for (const id of ['collectibleLegacyConfirm', 'collectibleUpgradeConfirm', 'collectibleUpgradeCancel']) if (document.getElementById(id) && !window.__prompts.includes(id)) window.__prompts.push(id); }).observe(document, { subtree: true, childList: true });
  }, data);
  return ctx;
}
const wire = (page, errs) => page.on('pageerror', (e) => errs.push(String(e)));
const ls = (p) => p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
const overflow = (p) => p.evaluate(() => { const el = document.querySelector('#collectionStartup'); if (!el) return null; const r = el.getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw: innerWidth, right: Math.round(r.right) }; });
const appState = (p) => p.evaluate(() => ({ protocol: window.__tzz.state._collectionProtocol, items: window.Economy.ITEMS.length, coins: window.__tzz.state.coins, owned: (window.__tzz.state.gacha.owned || []).length, prompts: window.__prompts }));
async function shot(p, name) { try { await p.screenshot({ path: path.join(OUT, `87-${name}.png`), fullPage: true }); } catch {} }

const ids = {};
for (const engine of ENGINES) {
  let browser;
  try { browser = await pw[engine].launch(engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}); }
  catch (e) { rec(engine, '启动浏览器', false, 'SKIP 环境：' + String(e).split('\n')[0]); continue; }
  for (const vp of VPS) {
    const combo = `${engine} ${vp.width}x${vp.height}`, tag = `${engine}-${vp.width}`;
    const pk = fixtures.preview.keys, fk = fixtures.formal.keys;
    // A 预览新档
    { const errs = []; const ctx = await ctxWith(browser, vp, {}); const p = await ctx.newPage(); wire(p, errs);
      try {
        await p.goto(base + 'preview/'); await p.locator('#collectibleLegacyConfirm').waitFor({ timeout: 20000 });
        const t1 = await p.locator('#collectionStartup').innerText();
        rec(combo, 'A 预览新档首进说明是新字', t1.includes('没有找到原来的预览存档，将从新游戏开始') && t1.includes('取消不会写入') && t1.includes('正式版进度不受影响') && !OLD.test(t1), t1);
        const o1 = await overflow(p); rec(combo, 'F 首进说明不横向溢出', o1 && o1.sw <= o1.vw && o1.right <= o1.vw, o1);
        if (vp.width === 390) await shot(p, `${tag}-A1-legacy`);
        await p.locator('#collectibleLegacyConfirm').click();
        await p.locator('#collectibleUpgradeConfirm').waitFor({ timeout: 20000 });
        await p.locator('#collectionStartup summary').click();
        const t2 = await p.locator('#collectionStartup').innerText();
        rec(combo, 'A 升级提示+展开说明数目是 200/188/4/8、无旧术语', t2.includes('升级后可收集 200 件物品') && t2.includes('188 件普通、4 件超级、8 件隐藏') && t2.includes('第 15 抽必出') && !OLD.test(t2), t2);
        const o2 = await overflow(p); rec(combo, 'F 升级说明展开后不横向溢出', o2 && o2.sw <= o2.vw && o2.right <= o2.vw, o2);
        if (vp.width === 390) await shot(p, `${tag}-A2-upgrade-details`);
        await p.locator('#collectibleUpgradeConfirm').click();
        await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 });
        const s1 = await appState(p); rec(combo, 'A 确认后协议 2、200 件', s1.protocol === 2 && s1.items === 200, s1);
        await p.evaluate(() => { try { window.__tzz.persist(); } catch {} });
        await p.evaluate(() => { window.__prompts = []; }); await p.reload(); await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 }); await p.waitForTimeout(500);
        const s2 = await appState(p); rec(combo, 'A 刷新后仍协议 2、200 件、不再弹提示', s2.protocol === 2 && s2.items === 200 && s2.prompts.length === 0 && Math.floor(s2.coins) >= Math.floor(s1.coins), { s1, s2 });
        ids.preview = await p.evaluate(() => window.Economy.ITEMS.map((x) => x.id).sort().join(','));
      } catch (e) { rec(combo, 'A 预览新档流程走完', false, e.stack); }
      rec(combo, 'A 无 JS 报错', errs.length === 0, errs); await ctx.close(); }
    // B / C 预览旧档
    for (const mode of ['cancel', 'confirm']) { const errs = []; const ctx = await ctxWith(browser, vp, fixtures.preview.data); const p = await ctx.newPage(); wire(p, errs); const L = mode === 'cancel' ? 'B' : 'C';
      try {
        await p.goto(base + 'preview/'); await p.locator('#collectibleUpgradeConfirm').waitFor({ timeout: 20000 });
        const t = await p.locator('#collectionStartup').innerText();
        rec(combo, `${L} 旧档升级提示是新字`, t.includes('已有收藏会保留') && t.includes('继续玩原来的 36 件') && !OLD.test(t), t);
        const before = await ls(p); const b = JSON.parse(before[pk.main]);
        await p.locator(mode === 'cancel' ? '#collectibleUpgradeCancel' : '#collectibleUpgradeConfirm').click();
        await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 });
        const s = await appState(p);
        if (mode === 'cancel') { const after = await ls(p); rec(combo, 'B 取消后协议 1、36 件、无迁移快照', s.protocol === 1 && s.items === 36 && !after['tangzhe-preview-collectibles-v2-original'], s); }
        else {
          rec(combo, 'C 确认后协议 2、200 件、收藏数与金币不变', s.protocol === 2 && s.items === 200 && s.owned === b.gacha.owned.length && Math.floor(s.coins) >= Math.floor(b.coins), { s, owned: b.gacha.owned.length, coins: b.coins });
          await p.evaluate(() => { try { window.__tzz.persist(); } catch {} }); await p.evaluate(() => { window.__prompts = []; });
          await p.reload(); await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 }); await p.waitForTimeout(500);
          const s2 = await appState(p); rec(combo, 'C 刷新后保留（协议 2、收藏数不变、不再弹）', s2.protocol === 2 && s2.owned === s.owned && s2.prompts.length === 0, s2);
        }
      } catch (e) { rec(combo, `${L} 预览旧档 ${mode} 流程走完`, false, e.stack); }
      rec(combo, `${L} 无 JS 报错`, errs.length === 0, errs); await ctx.close(); }
    // D 正式旧档
    for (const entry of ['', 'pet/game/']) { const errs = []; const ctx = await ctxWith(browser, vp, fixtures.formal.data); const p = await ctx.newPage(); wire(p, errs); const nm = entry ? 'pet' : 'root';
      try {
        const b = JSON.parse(fixtures.formal.data[fk.main]);
        await p.goto(base + entry); await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 }); await p.waitForTimeout(500);
        const s = await appState(p); rec(combo, `D 正式旧档(${nm}) 不弹迁移提示、协议 2、金币不少`, s.prompts.length === 0 && s.protocol === 2 && Math.floor(s.coins) >= Math.floor(b.coins), s);
        await p.evaluate(() => { try { window.__tzz.persist(); } catch {} }); await p.reload(); await p.waitForFunction(() => window.__tzz?.state, null, { timeout: 20000 });
        const s2 = await appState(p); rec(combo, `D 正式(${nm}) 刷新后保留`, s2.protocol === 2 && s2.owned === s.owned && Math.floor(s2.coins) >= Math.floor(s.coins), s2);
        if (!entry) ids.formal = await p.evaluate(() => window.Economy.ITEMS.map((x) => x.id).sort().join(','));
        if (vp.width === 390 && !entry) await shot(p, `${tag}-D-formal`);
      } catch (e) { rec(combo, `D 正式旧档(${nm}) 流程走完`, false, e.stack); }
      rec(combo, `D(${nm}) 无 JS 报错`, errs.length === 0, errs); await ctx.close(); }
    rec(combo, 'E 正式与预览 ITEMS 一致', ids.formal && ids.formal === ids.preview, { f: ids.formal?.length, p: ids.preview?.length });
  }
  await browser.close();
}
server.close();
fs.writeFileSync(path.join(OUT, 'report-87.json'), JSON.stringify(results, null, 2));
const fail = results.filter((r) => !r.ok);
console.log(`TOTAL PASS ${results.length - fail.length} / FAIL ${fail.length}`);
process.exit(fail.length ? 1 : 0);
