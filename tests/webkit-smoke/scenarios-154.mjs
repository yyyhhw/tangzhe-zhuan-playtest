// 测试-154 — 家宅-150 合后补验剩下三项（只测不改游戏代码），root + pet，390×844。接在 scenarios-153 后面跑。
//   ① 底图加载失败：route 拦掉 art/home_*.webp，夜晚+k_4（月亮）和黄昏+k_8（街灯）各走四位 CEO × Lv1–3：
//      房间退回无底图（.room 没有 has-art）、月亮窗/街灯窗都不显示、房间照常渲染、0 JS 错误
//   ② 黄昏↔夜晚实时切换：同一页不刷新、不切页，用 page.clock.setSystemTime 把本地时间 18:59:40 → 19:00:05（街灯→月亮），
//      切换后 6s 内画面跟着换，且旧的那个不残留（月亮窗 1 个、街灯窗 0 个）。再拨回 18:59:40 只记录（时间倒退现实里不会发生）
//   ③ prefers-reduced-motion: reduce：夜晚+k_3+k_4、黄昏+k_8，四位 CEO × Lv1–3：月亮/街灯/熊猫照常显示（有窗房型），
//      故事层里没有时长 >10ms 的动画、熊猫 1.5s 内不动。街灯的逐盏亮起延迟（.25/.5/.75s）只记录、不判失败（是一步亮起，不是运动）
// 时段：①③ 用 Etc/GMT±N 时区把本地小时拨到 22 点 / 18 点；② 用 Asia/Tokyo + page.clock.setSystemTime（只改 Date，计时器照常跑）。
// 没法在 macOS WebKit 验的：iOS 真机 Safari。
//
// Usage: node scenarios-154.mjs   (WebKit)   |   BROWSER=chromium [CHROMIUM_PATH=...] node scenarios-154.mjs
import { webkit, chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';
import { SAVE_KEY, TAB_LOCK_KEY, ENTRY_POINTS, VIEWPORT, SEED_SENTINEL } from './save-recipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = (process.env.BROWSER || 'webkit').toLowerCase();
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });
const READY = 'window.__tzz && window.XingTu';
const CEOS = ['c77', 'pearl', 'otaku', 'rocket'];
const LVS = [1, 2, 3];
const checks = [], errors = [], notes = [], notCovered = [];
let shotN = 0;
const J = (v) => JSON.stringify(v);
const tagOf = (entry) => entry === '/' ? 'root' : 'pet';

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 600) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`);
}
const isResourceNoise = (t) => /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon|cancelled|aborted|Load request cancelled/i.test(t);
function wireErrors(page, label) {
  page.on('pageerror', (e) => { errors.push({ label, kind: 'pageerror', text: String(e) }); console.log(`PAGEERROR [${label}] ${e}`); });
  page.on('console', (m) => {
    if (m.type() !== 'error' || isResourceNoise(m.text())) return;
    errors.push({ label, kind: 'console.error', text: m.text() }); console.log(`CONSOLE.ERROR [${label}] ${m.text()}`);
  });
}
async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT, `154-${String(++shotN).padStart(2, '0')}-${ENGINE}-${name}.png`) }); } catch {}
}
function tzAt(hour) {
  let o = ((hour - new Date().getUTCHours()) % 24 + 24) % 24;
  if (o > 14) o -= 24;
  return o === 0 ? 'Etc/GMT' : `Etc/GMT${o > 0 ? '-' : '+'}${Math.abs(o)}`;
}
const ctxOpts = (timezoneId = 'Asia/Tokyo', extra = {}) => ({ viewport: VIEWPORT, isMobile: ENGINE !== 'firefox', hasTouch: true, timezoneId, ...extra });
async function newCtx(browser, seed, tz, extra) {
  const ctx = await browser.newContext(ctxOpts(tz, extra));
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
async function clearModals(page) {
  for (let i = 0; i < 6; i++) {
    const claim = page.locator('#claim'), ok = page.locator('#mOk');
    if (await claim.count() && await claim.first().isVisible()) { await claim.first().click(); await page.waitForTimeout(300); continue; }
    if (await ok.count() && await ok.first().isVisible()) { await ok.first().click(); await page.waitForTimeout(300); continue; }
    break;
  }
}
async function load(page, base, entry) {
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await clearModals(page);
}
const gamePeriod = (page) => page.evaluate(() => {
  const h = new Date().getHours();
  return { hour: h, inline: h >= 19 || h < 5 ? 'night' : h >= 17 ? 'dusk' : h < 10 ? 'morning' : 'day' };
});
async function generateSeed(browser, base) {
  const ctx = await browser.newContext(ctxOpts());
  const page = await ctx.newPage(); wireErrors(page, 'seed');
  await page.goto(base.replace(/\/$/, '') + '/', { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  await page.getByRole('button', { name: '开摊！', exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch {} });
  const seed = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await ctx.close();
  check('seed: fresh save generated', !!seed[SAVE_KEY]);
  return seed;
}
function mkSeed(seed, owned) {
  const save = JSON.parse(seed[SAVE_KEY]);
  for (const shop of save.shops) Object.assign(shop, { open: true, lv: 35, emp: 1 });
  save.coins = 1e12;
  save.cur = 0;
  save.lastSeen = save.maxSeen = Date.now();
  save.gacha.owned = owned;
  for (const id of CEOS) if (save.ceos && save.ceos[id]) Object.assign(save.ceos[id], { unlocked: true, at: save.ceos[id].at < 0 ? 0 : save.ceos[id].at });
  const out = { ...seed, [SAVE_KEY]: JSON.stringify(save) };
  delete out[TAB_LOCK_KEY];
  return out;
}
// 进某位 CEO 的家、设房间等级（只改内存态做显示，不 persist）、等底图加载完或失败
async function enterRoom(page, who, lv) {
  await page.evaluate(({ who, lv }) => {
    const t = window.__tzz; t.setTab('home'); t.homeMode = 'live';
    t.E.homeOf(t.state, who).lv = lv;
    t.act('homeWho', who); t.renderTab();
  }, { who, lv });
  await page.waitForFunction(() => { const r = document.querySelector('.room'); const img = r && r.querySelector('img.room-art'); return r && (!img || img.complete); }, null, { timeout: 8000 }).catch(() => {});
  let prev = '';
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const cur = await page.evaluate(() => [...document.querySelectorAll('.room, .story-moonwin, .story-streetwin')].map((e) => { const b = e.getBoundingClientRect(); return [e.className, b.left, b.top, b.width, b.height].map((v) => typeof v === 'number' ? v.toFixed(1) : v).join(','); }).join('|'));
    if (cur === prev) break;
    prev = cur;
  }
}
// 页内：本房间故事层状态
const STORY_PROBE = ({ who, lv }) => {
  const room = document.querySelector('.room'); if (!room) return { room: false };
  const HS = window.HomeStory, nWins = HS && HS.windowsFor ? HS.windowsFor(`${who}_${lv}`).length : 0;
  const shown = (el) => { if (!el) return false; const cs = getComputedStyle(el), b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 0 && b.height > 0; };
  const mw = [...room.querySelectorAll('.story-moonwin')], sw = [...room.querySelectorAll('.story-streetwin')];
  const moonShown = mw.some((w) => shown(w) && shown(w.querySelector('[data-story="moon"]')));
  const streetShown = sw.some((w) => shown(w) && shown(w.querySelector('[data-story="street"]')));
  const panda = room.querySelector('[data-story="panda"]');
  const scene = room.querySelector('.story-scene');
  const anims = scene && scene.getAnimations ? scene.getAnimations({ subtree: true }).map((a) => { const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : {}; return { name: a.animationName || a.id || '', dur: Number(t.duration) || 0, delay: Number(t.delay) || 0, state: a.playState }; }) : [];
  return { room: true, hasArt: room.classList.contains('has-art'), artImg: !!room.querySelector('img.room-art'), nWins, nMoonWin: mw.length, nStreetWin: sw.length, moonShown, streetShown,
    panda: panda ? { shown: shown(panda), anim: getComputedStyle(panda).animationName } : null, anims, roomH: room.getBoundingClientRect().height };
};

// ① 底图加载失败
async function scenarioArtFail(browser, base, entry, seed) {
  for (const [label, hour, owned, kind] of [['night+k_4', 22, ['c_apron', 'k_4'], 'moon'], ['dusk+k_8', 18, ['c_apron', 'k_8'], 'street']]) {
    const tag = `① art-fail ${label} ${tagOf(entry)}`;
    const tz = tzAt(hour);
    const ctx = await newCtx(browser, mkSeed(seed, owned), tz);
    let blocked = 0;
    await ctx.route(/\/art\/home_[^/?]+\.webp/, (route) => { blocked++; return route.abort(); });
    const page = await ctx.newPage(); wireErrors(page, tag);
    try {
      await load(page, base, entry);
      const per = await gamePeriod(page);
      check(`${tag}: [时段] game period is ${hour === 22 ? 'night' : 'dusk'} (${tz})`, per.inline === (hour === 22 ? 'night' : 'dusk'), J(per));
      for (const who of CEOS) for (const lv of LVS) {
        await enterRoom(page, who, lv);
        const p = await page.evaluate(STORY_PROBE, { who, lv });
        check(`${tag} ${who} Lv${lv}: no ${kind} drawn, room still renders`,
          p.room && p.roomH > 50 && !p.moonShown && !p.streetShown, J({ hasArt: p.hasArt, img: p.artImg, nWins: p.nWins, moonShown: p.moonShown, streetShown: p.streetShown, roomH: Math.round(p.roomH || 0) }));
        check(`${tag} ${who} Lv${lv}: room falls back to no-art look (.room loses has-art once the art fails)`,
          p.room && !p.hasArt, J({ hasArt: p.hasArt, img: p.artImg }));
        if (who === 'c77' && lv === 3) await shot(page, `artfail-${kind}-c77-lv3-${tagOf(entry)}`);
      }
      check(`${tag}: room art requests were actually blocked`, blocked > 0, `blocked=${blocked}`);
    } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
  }
}

// ② 黄昏↔夜晚实时切换（同页不刷新）
async function scenarioLiveSwitch(browser, base, entry, seed) {
  const tag = `② dusk↔night live ${tagOf(entry)}`;
  const ctx = await newCtx(browser, mkSeed(seed, ['c_apron', 'k_4', 'k_8']), 'Asia/Tokyo');
  const page = await ctx.newPage(); wireErrors(page, tag);
  const DUSK = new Date('2026-10-17T18:59:40+09:00'), NIGHT = new Date('2026-10-17T19:00:05+09:00');
  const waitFor = async (want, who, lv) => {
    let p = null;
    for (let i = 0; i < 24; i++) { await page.waitForTimeout(250); p = await page.evaluate(STORY_PROBE, { who, lv }); if (want(p)) return { p, ms: (i + 1) * 250 }; }
    return { p, ms: null };
  };
  try {
    await page.clock.setSystemTime(DUSK);
    await load(page, base, entry);
    // 挑有户外窗且有底图的房间：c77 Lv3 和 pearl Lv3（拿不到窗就按实际窗位表挑第一个有窗的）
    const rooms = await page.evaluate(({ CEOS, LVS }) => { const out = []; for (const w of CEOS) for (const l of LVS) if ((window.HomeStory.windowsFor(`${w}_${l}`) || []).length) out.push([w, l]); return out; }, { CEOS, LVS });
    const pick = [['c77', 3], ['pearl', 3]].filter(([w, l]) => rooms.some(([a, b]) => a === w && b === l));
    if (!pick.length && rooms.length) pick.push(rooms[0]);
    check(`${tag}: found rooms with outdoor windows`, pick.length > 0, J(pick));
    for (const [who, lv] of pick) {
      await page.clock.setSystemTime(DUSK);
      await enterRoom(page, who, lv);
      const k = `${tag} ${who} Lv${lv}`;
      const d0 = await waitFor((p) => p.streetShown && !p.moonShown, who, lv);
      check(`${k}: 18:59 dusk — street lamps shown, no moon`, d0.ms !== null && d0.p.hasArt, J({ ms: d0.ms, p: { hasArt: d0.p.hasArt, moon: d0.p.moonShown, street: d0.p.streetShown, nM: d0.p.nMoonWin, nS: d0.p.nStreetWin } }));
      await page.clock.setSystemTime(NIGHT);
      const n1 = await waitFor((p) => p.moonShown && !p.streetShown, who, lv);
      check(`${k}: → 19:00 same page, no reload — moon appears within 6s, street lamps gone, ≤1 moon window, no street window left`,
        n1.ms !== null && n1.p.nMoonWin === 1 && n1.p.nStreetWin === 0, J({ ms: n1.ms, moon: n1.p.moonShown, street: n1.p.streetShown, nM: n1.p.nMoonWin, nS: n1.p.nStreetWin }));
      if (who === 'c77') await shot(page, `live-night-${who}-lv${lv}-${tagOf(entry)}`);
      await page.clock.setSystemTime(DUSK);
      const d2 = await waitFor((p) => p.streetShown && !p.moonShown, who, lv);
      notes.push(`${k}: 拨回 18:59（时间倒退，现实里不会发生）${d2.ms !== null ? d2.ms + 'ms 内换回街灯' : '6s 内没换回街灯（月亮还在），只记录不判'}`);
    }
  } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
}

// ③ prefers-reduced-motion: reduce
async function scenarioReducedMotion(browser, base, entry, seed) {
  for (const [label, hour, owned] of [['night+k_3+k_4', 22, ['c_apron', 'k_3', 'k_4']], ['dusk+k_8', 18, ['c_apron', 'k_8']]]) {
    const tag = `③ reduced-motion ${label} ${tagOf(entry)}`;
    const tz = tzAt(hour);
    const ctx = await newCtx(browser, mkSeed(seed, owned), tz, { reducedMotion: 'reduce' });
    const page = await ctx.newPage(); wireErrors(page, tag);
    try {
      await load(page, base, entry);
      const rm = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      check(`${tag}: prefers-reduced-motion: reduce is active`, rm);
      const night = hour === 22;
      for (const who of CEOS) for (const lv of LVS) {
        await enterRoom(page, who, lv);
        const p = await page.evaluate(STORY_PROBE, { who, lv });
        const k = `${tag} ${who} Lv${lv}`;
        const motion = p.anims.filter((a) => a.dur > 10 && a.state !== 'finished');
        const delayed = p.anims.filter((a) => a.delay > 0);
        if (delayed.length) notes.push(`${k}: ${delayed.length} story animation(s) with delay ${[...new Set(delayed.map((a) => a.delay))].join('/')}ms (duration ${[...new Set(delayed.map((a) => a.dur))].join('/')}ms)`);
        if (p.nWins > 0 && p.hasArt) {
          check(`${k}: ${night ? 'moon' : 'street lamps'} still shown, no story animation longer than 10ms`,
            (night ? p.moonShown : p.streetShown) && motion.length === 0, J({ moon: p.moonShown, street: p.streetShown, motion }));
        } else {
          check(`${k}: no outdoor window (nWins=${p.nWins}, hasArt=${p.hasArt}) → nothing drawn, no story animation longer than 10ms`,
            !p.moonShown && !p.streetShown && motion.length === 0, J({ moon: p.moonShown, street: p.streetShown, motion }));
        }
        if (night && who === 'c77' && lv === 1) {
          const P = () => { const el = document.querySelector('[data-story="panda"]'); if (!el) return null; const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), anim: cs.animationName, shown: cs.display !== 'none' && r.width > 0 }; };
          const a0 = await page.evaluate(P); await page.waitForTimeout(1500); const a1 = await page.evaluate(P);
          check(`${tag}: 77 home k_3 panda shown, no animation, no movement over 1.5s`,
            a0 && a1 && a0.shown && a0.anim === 'none' && a1.anim === 'none' && a0.x === a1.x && a0.y === a1.y, J({ a0, a1 }));
        }
        if (who === 'c77' && lv === 3) await shot(page, `reduced-${night ? 'night' : 'dusk'}-c77-lv3-${tagOf(entry)}`);
      }
    } catch (e) { check(`${tag}: ran`, false, e.stack || e); } finally { await ctx.close(); }
  }
}

async function main() {
  const { server, url: base } = await startServer();
  const launcher = ENGINE === 'chromium' ? chromium : webkit;
  const browser = await launcher.launch(ENGINE === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  console.log(`engine=${ENGINE} ${browser.version()} server=${base}`);
  try {
    const seed = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioArtFail(browser, base, entry, seed);
      await scenarioLiveSwitch(browser, base, entry, seed);
      await scenarioReducedMotion(browser, base, entry, seed);
    }
  } catch (e) { check('scenarios ran to completion', false, e.stack || e); }
  finally { await browser.close(); server.close(); }
  notCovered.push('iOS 真机 Safari：macOS WebKit 模拟不了',
    '② 只验本页 Date 拨钟（page.clock.setSystemTime）往前跨 19:00，没验真实等到 19:00、没验「换时区重进」；倒拨只记录',
    '房间等级只改内存态做显示（不 persist）',
    '③ 街灯逐盏亮起的 delay 只记录不判（见 notes）',
    '不判画面好不好看');
  const failed = checks.filter((c) => !c.ok);
  const ok = failed.length === 0 && errors.length === 0;
  const uniqNotes = [...new Set(notes)];
  const report = { ok, engine: ENGINE, viewport: VIEWPORT, entryPoints: ENTRY_POINTS, counts: { checks: checks.length, failed: failed.length, jsErrors: errors.length }, checks, errors, notes: uniqNotes, notCovered };
  fs.writeFileSync(path.join(OUT, `report-154-${ENGINE}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, `report-154-${ENGINE}.txt`), [`测试-154 家宅-150 合后补验（底图失败 / 黄昏↔夜实时切换 / 减少动态） (${ENGINE}): ${ok ? 'PASS' : 'FAIL'}`, `checks: ${checks.length - failed.length}/${checks.length} passed, js errors: ${errors.length}`, '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []),
    ...(uniqNotes.length ? ['', 'NOTES:', ...uniqNotes.map((n) => '  ' + n)] : []), '', 'NOT COVERED: ' + notCovered.join('; ')].join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failed.length}/${checks.length} checks, ${errors.length} js errors`);
  process.exit(ok ? 0 : 1);
}
main();
