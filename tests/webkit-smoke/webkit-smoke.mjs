// WebKit / iOS-Safari smoke test for 糖喆转 (closes the 测试-130 "no WebKit env" gap).
//
// Runs the game in Playwright's WebKit (the same engine as mobile Safari) at a 390x844
// mobile viewport and exercises the "买下地球 / buy Earth" ending flow — mirroring the
// checks the existing Chromium smoke (tests/milestones/browser.py) performs:
//   * the buy-earth button shows the "10 万亿" wording
//   * with 15 万亿 coins one click deducts EXACTLY once (15e12 -> 5e12) and sets earth=true
//   * a page refresh persists earth=true / the deducted balance
//   * with 9 万亿 coins (below EARTH_PRICE) the button is disabled / greyed
// plus a cheap home-scene sanity check, on BOTH entry points (/ and /pet/game/).
//
// Fails on any uncaught pageerror or JS console error. Writes screenshots + a JSON/text
// report to the output dir (uploaded as a CI artifact).
//
// Usage: node webkit-smoke.mjs            (output -> ./output)
//        WEBKIT_SMOKE_OUT=/path node webkit-smoke.mjs
import { webkit } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './static-server.mjs';
import {
  SAVE_KEY, EARTH_PRICE, BUY_EARTH_SELECTOR, RECAP_SELECTOR, START_BUTTON_LABEL,
  APP_SELECTOR, SCENE_SELECTOR, CLAIM_SELECTOR, ENTRY_POINTS, VIEWPORT,
  COINS_RICH, COINS_POOR, COINS_AFTER_BUY, SEED_SENTINEL, buildSeed,
} from './save-recipe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.WEBKIT_SMOKE_OUT || path.join(__dirname, 'output');
fs.mkdirSync(OUT, { recursive: true });

const checks = [];      // { name, ok, detail }
const errors = [];      // hard JS errors (pageerror / console.error)
let shotN = 0;

function check(name, ok, detail = '') {
  checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

// Resource-load failures (404s for optional art/audio) are not JS errors; keep them
// out of the hard-fail set so the smoke doesn't go red on cosmetic missing assets.
const isResourceNoise = (t) =>
  /Failed to load resource|net::|status of 4\d\d|status of 5\d\d|favicon/i.test(t);

function wireErrors(page, label) {
  page.on('pageerror', (e) => {
    errors.push({ label, kind: 'pageerror', text: String(e) });
    console.log(`PAGEERROR [${label}] ${e}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (isResourceNoise(text)) return;
    errors.push({ label, kind: 'console.error', text });
    console.log(`CONSOLE.ERROR [${label}] ${text}`);
  });
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  try { await page.screenshot({ path: file, fullPage: true }); } catch { /* best effort */ }
  return path.basename(file);
}

const READY = 'window.__tzz && window.XingTu';

// Launch a fresh game once to generate a valid save seed + defaultSpace().
async function generateSeed(browser, base) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai',
  });
  const page = await ctx.newPage();
  wireErrors(page, 'seed');
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });

  // Home-scene sanity on a genuinely fresh load.
  check('home: #app present (root fresh load)', await page.locator(APP_SELECTOR).count() > 0);
  check('home: canvas#scene present (root fresh load)', await page.locator(SCENE_SELECTOR).count() > 0);
  await shot(page, 'home-fresh-root');

  await page.getByRole('button', { name: START_BUTTON_LABEL, exact: true }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { window.__tzz.persist && window.__tzz.persist(); } catch (e) {} });
  const seed = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const def = await page.evaluate(async () => (await import('/space/domain.mjs')).defaultSpace());
  check('seed: save key present after 开摊', !!seed[SAVE_KEY], SAVE_KEY);
  check('seed: defaultSpace has ended/earth flags',
    def && def.ended === false && def.earth === false);
  await ctx.close();
  return { seed, def };
}

// Open a page with the mutated save injected via addInitScript (guarded so a reload
// does not re-seed and clobber the game's own persisted save).
async function openWith(browser, base, entry, mutatedSeed, label) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT, isMobile: true, hasTouch: true, timezoneId: 'Asia/Shanghai',
  });
  await ctx.addInitScript(({ seed, sentinel }) => {
    try {
      if (localStorage.getItem(sentinel)) return;   // already seeded this origin; leave the game's save
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem(sentinel, '1');
    } catch (e) { /* ignore */ }
  }, { seed: mutatedSeed, sentinel: SEED_SENTINEL });
  const page = await ctx.newPage();
  wireErrors(page, label);
  await page.goto(base.replace(/\/$/, '') + entry, { waitUntil: 'load' });
  await page.waitForFunction(READY, null, { timeout: 30000 });
  // Clear any offline-earnings panel that would sit over the star map.
  const claim = page.locator(CLAIM_SELECTOR);
  if (await claim.count() && await claim.first().isVisible()) await claim.first().click();
  return { ctx, page };
}

async function scenarioRich(browser, base, entry, seed, def) {
  const tag = `rich ${entry}`;
  const mutated = buildSeed(seed, def, COINS_RICH);
  const { ctx, page } = await openWith(browser, base, entry, mutated, tag);
  try {
    check(`${tag}: #app renders`, await page.locator(APP_SELECTOR).count() > 0);
    const opened = await page.evaluate(() => window.XingTu.open());
    check(`${tag}: XingTu.open() ok`, opened && opened.ok, JSON.stringify(opened));
    await page.waitForSelector(BUY_EARTH_SELECTOR, { timeout: 15000 });

    const label = (await page.locator(BUY_EARTH_SELECTOR).innerText()).trim();
    check(`${tag}: buy-earth shows 10 万亿 wording`,
      label.includes('10 万亿') || label.includes('10万亿'), label);
    const disabledBefore = await page.locator(BUY_EARTH_SELECTOR).isDisabled();
    check(`${tag}: button enabled with 15 万亿`, !disabledBefore);
    check(`${tag}: coins == 15e12 before buy`,
      await page.evaluate(() => window.__tzz.state.coins) === COINS_RICH);
    await shot(page, `earth-before-${entry.replace(/\W+/g, '') || 'root'}`);

    await page.locator(BUY_EARTH_SELECTOR).click();
    await page.waitForSelector(RECAP_SELECTOR, { timeout: 15000 });
    const afterCoins = await page.evaluate(() => window.__tzz.state.coins);
    const earth = await page.evaluate(() => window.__tzz.state.space.earth);
    check(`${tag}: earth == true after one click`, earth === true);
    check(`${tag}: deducts exactly once (15e12 -> 5e12)`, afterCoins === COINS_AFTER_BUY,
      `coins=${afterCoins} expected=${COINS_AFTER_BUY}`);
    await shot(page, `earth-after-${entry.replace(/\W+/g, '') || 'root'}`);

    // Refresh must persist (addInitScript is guarded, so the game's own save is kept).
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(READY, null, { timeout: 30000 });
    const pEarth = await page.evaluate(() => window.__tzz.state.space.earth);
    const pCoins = await page.evaluate(() => window.__tzz.state.coins);
    check(`${tag}: refresh persists earth == true`, pEarth === true);
    check(`${tag}: refresh persists coins == 5e12`, pCoins === COINS_AFTER_BUY,
      `coins=${pCoins}`);
    await shot(page, `earth-reload-${entry.replace(/\W+/g, '') || 'root'}`);
  } finally {
    await ctx.close();
  }
}

async function scenarioPoor(browser, base, entry, seed, def) {
  const tag = `poor ${entry}`;
  const mutated = buildSeed(seed, def, COINS_POOR);
  const { ctx, page } = await openWith(browser, base, entry, mutated, tag);
  try {
    const opened = await page.evaluate(() => window.XingTu.open());
    check(`${tag}: XingTu.open() ok`, opened && opened.ok, JSON.stringify(opened));
    await page.waitForSelector(BUY_EARTH_SELECTOR, { timeout: 15000 });
    const label = (await page.locator(BUY_EARTH_SELECTOR).innerText()).trim();
    check(`${tag}: buy-earth still shows 10 万亿 wording`,
      label.includes('10 万亿') || label.includes('10万亿'), label);
    const disabled = await page.locator(BUY_EARTH_SELECTOR).isDisabled();
    check(`${tag}: button disabled/greyed with 9 万亿 (< ${EARTH_PRICE})`, disabled === true);
    check(`${tag}: coins unchanged (9e12), not bought`,
      await page.evaluate(() => window.__tzz.state.coins) === COINS_POOR &&
      await page.evaluate(() => window.__tzz.state.space.earth) === false);
    await shot(page, `earth-disabled-${entry.replace(/\W+/g, '') || 'root'}`);
  } finally {
    await ctx.close();
  }
}

async function main() {
  const { server, url: base } = await startServer();
  console.log('static server:', base);
  const browser = await webkit.launch();
  try {
    const { seed, def } = await generateSeed(browser, base);
    for (const entry of ENTRY_POINTS) {
      await scenarioRich(browser, base, entry, seed, def);
      await scenarioPoor(browser, base, entry, seed, def);
    }
  } catch (e) {
    check('smoke ran to completion', false, e && e.stack ? e.stack : String(e));
  } finally {
    await browser.close();
    server.close();
  }

  const failedChecks = checks.filter((c) => !c.ok);
  const ok = failedChecks.length === 0 && errors.length === 0;
  const report = {
    ok,
    engine: 'playwright-webkit',
    viewport: VIEWPORT,
    entryPoints: ENTRY_POINTS,
    saveKey: SAVE_KEY,
    earthPrice: EARTH_PRICE,
    counts: { checks: checks.length, failed: failedChecks.length, jsErrors: errors.length },
    checks,
    errors,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  const lines = [
    `WebKit smoke: ${ok ? 'PASS' : 'FAIL'}`,
    `checks: ${checks.length - failedChecks.length}/${checks.length} passed`,
    `js errors: ${errors.length}`,
    '',
    ...checks.map((c) => `${c.ok ? '[PASS]' : '[FAIL]'} ${c.name}${c.detail ? '  — ' + c.detail : ''}`),
    ...(errors.length ? ['', 'JS ERRORS:', ...errors.map((e) => `  (${e.label}) ${e.kind}: ${e.text}`)] : []),
  ];
  fs.writeFileSync(path.join(OUT, 'report.txt'), lines.join('\n'));
  console.log(`\n${ok ? 'PASS' : 'FAIL'} — ${checks.length - failedChecks.length}/${checks.length} checks, ${errors.length} js errors. Report: ${OUT}`);
  process.exit(ok ? 0 : 1);
}

main();
