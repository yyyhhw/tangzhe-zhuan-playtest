# WebKit / iOS-Safari smoke (测试-130)

Closes the long-standing "no WebKit environment" gap by running the game in Playwright's
**WebKit** engine (the same engine as mobile Safari) on a GitHub **macOS** runner.

## What it checks

At a 390×844 mobile viewport (`isMobile` + `hasTouch`), on **both** entry points — `/` and
`/pet/game/` — it exercises the "买下地球 / buy Earth" ending, mirroring the existing
Chromium smoke (`tests/milestones/browser.py`):

- buy-earth button (`#xingtuBuyEarth`) shows the **10 万亿** wording;
- with **15 万亿** coins one click deducts **exactly once** — the balance drops by exactly
  `EARTH_PRICE` (10 万亿) — and sets `space.earth = true`;
- a page **refresh persists** `earth = true` and the deducted (~`5e12`) balance;
- with **9 万亿** coins (below `EARTH_PRICE = 1e13`) the button is **disabled/greyed** and
  nothing is deducted;
- a cheap home-scene sanity check (`#app` / `canvas#scene`) on a fresh load;
- **fails** on any uncaught `pageerror` or JS `console.error`.

Because the fixture opens every shop (Lv35), the game accrues a tiny amount of **idle
income** between save injection and each coin read, so coin balances are compared within
`COIN_DRIFT_TOL` (1e9 — ~1e4× smaller than `EARTH_PRICE`) rather than by exact equality.
The purchase itself is still asserted exactly: `coins_before − coins_after == EARTH_PRICE`
within that tolerance, which still catches a double deduction, a no-op, or a wrong price.

Screenshots + `report.json` / `report.txt` are written to `./output` (uploaded as a CI
artifact).

## The test save

The game writes a signed-free save under `tangzhe-formal-collection-v1-save`
(confirmed: `collection/host-save.mjs`). The fixture is built the same way the Chromium
smoke does it: launch a fresh game to get a **valid** save, then mutate only data fields
(`coins`, `space.ended=true`, shops → Lv35). See `save-recipe.mjs`. It is injected via
`page.addInitScript(...)`, guarded by a sentinel so a reload does not re-seed and clobber
the game's own persisted save.

## Run locally (needs a WebKit-capable machine)

```sh
cd tests/webkit-smoke
npm install
npx playwright install webkit
npm run smoke        # or: node webkit-smoke.mjs
```

A tiny Node static server (`static-server.mjs`) serves the repo root with correct MIME
types for `.mjs` modules and ignores the `?v=` cache-busting query strings.

## 测试-130 ①–④ scenarios (`scenarios-130.mjs`)

Same server/save recipe, WebKit by default (`BROWSER=chromium CHROMIUM_PATH=… node scenarios-130.mjs`
for a local Chromium dry run), 390×844, root + `/pet/game/`:

1. **老档迁移** — a save with no `space` field and a v1 save with 10 moon round-trips
   (76 pts / 3 cards / ledger claimed 10): loads writable, 星途 opens, data intact, refresh keeps it.
2. **科研固定价** — research-bench tier 1 = 9,000,090; four synchronous clicks deduct exactly once;
   tier 2 at research Lv1 is disabled and `perform` is refused; refresh keeps only `tech:1`.
3. **跨标签** — a second page in the same context is stopped by 「同一作用域只能一个页面经营」 and
   cannot open 星途; a buy in the first page lands on disk exactly once, the second never writes.
4. **外星倍率** — 0 / 1 (mars #3) / 7 (six #3 + 回信) alien cards → ×1 / ×1.25 / ×2.75 online rate
   and 2 h offline amount; the legacy `alienCards` field alone does not count; mars at 2 cards = ×1.

Deductions are measured inside one synchronous JS turn (read → click → read), so they are exact;
balances re-read later are reported as `DRIFT` (idle income) in `report-130-<engine>.txt`.
Not covered: iOS frozen background-tab recovery (lockfix takeover) — macOS WebKit can't reproduce it.
