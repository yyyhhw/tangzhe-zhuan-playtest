Original prompt: 在独立 clone 完善塔防 preview/td：被动统帅、音效、每波含首波 5 秒倒计时、沿用美术精细化、八塔真实属性查看；选塔显示属性，点格子预览真实射程、附近建造/取消、换格移动、空白取消，仅确认扣费。保留 1 图 10 波 8 塔 4 统帅、所有既定数值、钱包及结算事务，不推送部署、不访问 task-2。

## Implementation and design

- Base: c93d50293701917b00038cb8464e3bf3164b17bd; independent branch codex/td-passive-polish.
- Commander selection keeps global buffs and matching tower synergy exactly. Fixed support position is original spawn (2.5,1.5). Old movement is removed; original auto-attack retained; old manual ultimate becomes automatic at 100 energy when there is a valid target. 77 requires a target within original 2.4-cell circle; others require a living enemy. No damage/range/cooldown/upgrade/energy numeric rebalance. This removes manual repositioning/timing and therefore changes tactical reach, particularly 77. Play balance has not been browser-tested.
- Descriptions correct old inaccurate summaries: Pearl interval ×0.82 is ~21.95% speed increase; 77/otaku support attacks actually select nearest-to-exit 2/3 targets rather than geometric piercing/boomerang. Fixed support is openly stated, including original level/wave scaling and skill values.
- All waves use 5 seconds, cannot skip or overlap. Countdown visible separately from tower panel. Pause/background freezes simulation; manual resume required. Wave reward unchanged.
- Pick tower first; inspect current damage, interval, real range, enemy targeting and effect numbers. Pick/move cell previews real towerRange including otaku +0.45 and upgrades. Floating 48px build/cancel controls; invalid cells retain selection and show error, no fallback placement. Empty map margins cancel. Upgrade/sell stay separate.
- tdsfx.js is an in-scope derivative of existing preview/zombie/zbsfx.js, no new external asset. Tower firing, build/countdown/wave cues; no burn-tick sound spam; global shot rate gate, lower gain and compressor; pause/master mute; gesture unlock. No claim of audible/iPhone test.
- Existing paper colors/ink outlines retained; vector tower emblems, shadows, highlights, shot cores, hit flash and death fragments.
- No edits to tdcore.js, tdhost.js, wallet, parent app, root release, or root versions.

## Validation completed

Using bundled /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node (no installation):
- test_td_passive.js: 12 grouped checks pass, including all eight attack families, auto skills, countdown, no duplicate wave/reward, pause/hidden, preview move/cancel/invalid cell/no-charge, separate existing-tower actions, derived range/damage, text/draw hooks.
- test_tdsfx.js: mock AudioContext unlock/gates/mute/pause/visibility/gain pass. This is a logic test, not real audio measurement.
- test_td_protocol.js: 9 checks pass.
- test_tdhost.js: 31 checks pass.
- JS syntax and git diff --check pass.
- test_td_bridge.js: first five groups pass, then pre-existing fixed version expectation fails (expects 13k; actual baseline 13k-story2). No version edits made.

## Blockers / next integration checks

- Browser screenshots, recording and browser gameplay NOT completed. Skill Playwright client was invoked; installed Playwright reports missing chromium_headless_shell-1200. No browser installed because installation requires permission.
- Computer-use inventory reports Mac locked and automatic unlock unavailable. No Safari, user profile, or other workspace touched.
- Local HTTP bind to 127.0.0.1:8876 was sandbox-denied; server is NOT running. Did not use 8770. Need authorized local server in integration environment.
- test_td_browser.mjs is supplied for independent Chromium contexts at 390×844, 375×667, 1280×900 with screenshots and video on a system with a preinstalled browser. It is NOT yet executed; inspect generated output visually before acceptance, especially floating-button placement, bottom dock / safe area and full gameplay balance.
- Legacy test_td.py movement/label fixtures updated for passive support; browser suite remains unexecuted. Combat/transaction expectations retained.
- Real iPhone sound, interruption/resume and loudness still require device verification.

## Review follow-up

- HTTP server now successfully running on 127.0.0.1:8876 after approved ordinary local-test sandbox escalation; HTTP 200 confirmed. Earlier refusal was default sandbox PermissionError, not auto-review rejection. No installation/settings change.
- Standard installed-browser search confirms absent /Applications/Google Chrome.app, Chromium.app, Google Chrome for Testing.app; absent user Applications Chrome/Chromium and ~/Library/Caches/ms-playwright. Await nonstandard existing runner path; did not read task-2.
- Independently fixed only stale version fixtures in test_td_bridge.js (commit 0dbf19c): both actual baseline versions are 13k-story2. Original failure remains preserved in Library report version 0; all six bridge groups now pass, no protocol assertions removed.
- Fixed occupied-cell preview to draw the selected new tower's range, not the occupant's range; occupied cell still disallows building. Actual canvas-arc assertion added; 13 passive/placement checks pass.
- Browser runner now supports TD_CHROMIUM explicit executablePath and still creates fresh isolated contexts. Browser/screenshots/video remain unexecuted.

- Review follow-up: added actual selected-tower semi-transparent emblem/body ghost and 待建/不可建 label; ghost draws do not change cash or tower map. 14 passive/placement checks pass.

## Browser verification completed after authorized runtime path supplied

The earlier missing-browser blocker is resolved: parent explicitly authorized read-only use of its existing Chromium 1208/Playwright dependencies. No original runner, profile, source, or settings were modified. All tests used this checkout, port 8876, fresh headless contexts, and local evidence output.

- test_td_browser.mjs PASS at 375×667, 390×844, 1280×900: pick/details, no-charge preview, moved placement, cancel, invalid grid, blank cancellation, 48px buttons, top/bottom edge button rectangles avoid selected cell, actual placement cost, pause freeze, mute/resume and zero page errors. Named interaction videos and before/after screenshots generated.
- Skill web_game_playwright_client.js PASS (temporary copy changed only to use explicit approved executablePath), 2 iterations with 120-frame actions, screenshot/state outputs, no console error files. Its screenshots capture canvas only; full HUD evidence comes from the browser runner.
- test_td_combat.mjs PASS: eight-tower level-3 combat fixture uses extra LOCAL construction points in isolated context (not default-economy balance evidence), reaches wave 10 and wins with 182 kills/20 lives. Only tangzhe-td-proto storage key; actual AudioContext running, shot/hit/ult counters positive; zero page errors. Captured attack-frame, second-wave countdown and result screenshots.
- Visually inspected all six interaction screenshots, combat board/result/attack screenshot and skill-client screenshot. Placement ghost, real-range circle, confirm/cancel, details and countdown present; no clipped controls at tested widths.
- Evidence lives in ignored preview/td/evidence and is embedded in the Library review report. Scripts are committed; generated videos/images are not part of deployable code.
- Remaining: no physical iPhone audible-output/interruption/loudness verification; Chromium mobile viewport is not iOS WebKit. Default-economy 10-wave balance and tactical impact of fixed 77 support still need player review. No push/deploy.
