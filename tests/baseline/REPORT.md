# Stage 1: fixed baseline and TD VM/parent infrastructure

Pinned product base: c9a6cda4d92e76207cc469d9d2eaa147489c31ed. Product files and cache versions are unchanged. No Cards64 or TD54 candidate changes.

## Reproduction

Run from any directory, supplying an exported exact base or candidate tree and an output directory outside the repository:

```sh
python3 tests/baseline/run.py --root /path/to/pinned-base --out /tmp/td-baseline
python3 tests/baseline/run.py --root /path/to/stage1 --out /tmp/td-stage1
node td/test_vm_runtime_contract.js
```

The manifest has exactly 82 unique paths: 57 Node and 25 browser. It preserves preview paths without mapping them to formal paths. Each Node command is node FILE with cwd at the supplied root; three workers and 25 seconds per process. Failures return runner exit 1; otherwise incomplete coverage returns exit 2. Browser entries are never launched by this runner. Missing/execution errors, timeouts and nonzero child exits are not successes.

Observed environment: Node v24.19.0, Python 3.12.14. Original export has no .git directory; test_economy.js internally skipped two historical artwork SHA checks. Full product blobs were independently pinned to the base Git tree. File PASS means exit zero, not browser or all historical coverage.

Baseline: 31 pass / 26 fail / 25 not-run. Stage 1: 31 pass / 24 fail / 27 incomplete (25 browser + two simulation timeouts). Stage 2: 33 pass / 23 fail / 26 incomplete (25 browser + budget_experiment compute timeout). Runner exit remains 1 while failures exist.

Supplemental td/test_vm_runtime_contract.js passed separately. It is intentionally outside the frozen 82 denominator. It executes dependencies in TD HTML order, real host handshake/state messages and accepted parent ports; rejects wrong source/origin/protocol/ruleset/schema/start identity; awaits real local startPromise before proving clock progress. Node/VM only.

## What changed

- Three TD child fixtures load actual TD modules and audio code in page order. State fixtures derive from real TDHost handshake; they are delivered through the authenticated port. Positive start acknowledgements use the actual start request, including map/seed/commander/stage.
- Both bridge fixtures extract current parent boundaries and supply current globals. Wallet writes use isolated memory plus the actual formal/preview save coordinator and model. Valid formal hello/ruleset is sent before purchases; production origin/source guards remain intact.
- No original failing assertion is removed or rewritten. Formal bridge cases 1–5 and preview cases 1–4 now complete before old cache/entry assertions fail.

## Stage 2 (async start confirmation)

- Shared `confirmStart` in `td/test_td_energy.js`: refuse clock advance while `pendStart`, then `await G.startPromise` before returning from `game`/`fresh`.
- `td/test_balance_sweep.js`, `td/test_budget_experiment.js` (+ shipping/verify callers) await the shared async `game`/`run` before their simulation loops.
- Product and cache files untouched. No Cards64 / TD54. Browser entries still not-run.
- Fixed 82-entry denominator unchanged. Supplemental `td/test_vm_runtime_contract.js` still outside the denominator and still passes.

## Remaining blockers and categories

All ten original STAGE_COUNT bootstrap exceptions are gone. Stage 2 removed the missing-await startPromise class for the sweep/budget runners and the shared energy `game` helper. Remaining failures are old timing/budget/wave/protocol object-identity expectations, continueEndless/progress gates, and budget_experiment compute volume under the fixed 25s cap. No product defect has been established from these failures.

Stage 2 awaits real local G.startPromise (via shared confirmStart) before simulation loops, and keeps the unconfirmed zero-advance negative control. td/test_balance_sweep.js now completes under 25s (pass). td/test_budget_verify.js now pass. td/test_budget_experiment.js still exceeds the fixed 25s budget because the finite strategy×count binary search is ~220s wall after real start; a longer local run exits 0 and writes evidence. This remaining incomplete is compute volume, not missing startPromise. Safety assertions were not deleted; pendStart was not forced false.

Root bridge still expects version 15c; preview bridge still expects no cards at shop 2. Old cache/asset/formal-candidate assertions, future dataVersion=2 fixtures (preview adapter is version 2), and older coin/host/pet fixtures without the installed save coordinator remain. R4 room-capacity semantics remain independently unresolved. Stage 2 async start confirmation is implemented for the energy harness and sweep/budget runners; further callers and old expectation updates remain.

Real browsers remain unrun under known socket/network restrictions. The earlier 69/51 report has no supplied original runner manifest and is not reproduced by this explicit denominator.

## Per-file comparison

| File | Baseline | Current (Stage 2) | Evidence |
|---|---|---|---|
| cards/tests/save.test.mjs | pass | pass |  |
| cards/tests/saved-decks.test.mjs | pass | pass |  |
| pet/game/test_petgame.js | fail | fail |  |
| pet/test_engine.js | pass | pass |  |
| preview/cards/tests/save.test.mjs | fail | fail |  |
| preview/cards/tests/saved-decks.test.mjs | pass | pass |  |
| preview/pet/accept2/test_companion_runtime.js | pass | pass |  |
| preview/pet/accept2/test_manifest_companions.js | pass | pass |  |
| preview/pet/accept2/test_pet_portal_e2e.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/pet/accept2/test_pet_portal_regressions.js | fail | fail |  |
| preview/pet/accept2/test_pets2_core.js | pass | pass |  |
| preview/pet/accept2/test_pets2_r4.js | fail | fail |  |
| preview/pet/accept2/test_pets2_roster_runtime.js | pass | pass |  |
| preview/pet/accept2/test_pets2_ui_vm.js | pass | pass |  |
| preview/pet/accept2/test_room_capacity.js | pass | pass |  |
| preview/pet/accept2/test_room_capacity_e2e.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/pet/accept2/test_spatial_companions.js | pass | pass |  |
| preview/pet/accept2/test_spatial_companions_e2e.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/pet/accept2/test_species_unique.js | fail | fail |  |
| preview/pet/game/test_petgame.js | fail | fail |  |
| preview/pet/test_engine.js | pass | pass |  |
| preview/qa/test_ceo_embedded.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/qa/test_decor_ceo.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/qa/test_story_cards.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/qa/test_story_cold_focus.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/td/test_td_bridge.js | fail | fail | 4 lifecycle/purchase guard cases pass; old empty shop-2 assertion |
| preview/td/test_td_protocol.js | pass | pass |  |
| preview/td/test_tdhost.js | fail | fail |  |
| preview/test_coin_safety.js | fail | fail |  |
| preview/test_economy.js | pass | pass |  |
| preview/zombie/test_zbtop.js | pass | pass |  |
| preview/zombie/test_zbtop_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| preview/zombie/test_zbtop_layout.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_balance_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_balance_contract.js | fail | fail | Stage2: await create(); spawn still needs waveSpec / old HP formula expectations |
| td/test_balance_sweep.js | fail | pass | Stage2: await startPromise + unconfirmed zero-advance; sim completes under 25s |
| td/test_budget_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_budget_experiment.js | fail | not-run | Stage2: await startPromise fixed; still timeout under 25s (~220s search volume); long-run exit 0 |
| td/test_budget_shipping.js | fail | fail | Stage2: sims now win after await; old granted<=expected budget caps still fail |
| td/test_budget_verify.js | fail | pass | Stage2: await startPromise in shared run(); seeds verify under 25s |
| td/test_energy_budget.js | fail | fail | Stage2: await game(); old normalBudget constants (1616…) still mismatch current 1950… |
| td/test_formal_candidate.js | fail | fail |  |
| td/test_speed_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_speed_build.js | fail | fail | Stage2: await game(); old TIMING.initial=20 expectations vs current 10 remain |
| td/test_speed_parent.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_td_bridge.js | fail | fail | 5 lifecycle/purchase guard cases pass; old 15c cache assertion |
| td/test_td_endless_host.js | fail | fail |  |
| td/test_td_endless_parent.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_td_energy.js | fail | fail | Stage2: await startPromise in game(); continueEndless/progress expectations remain |
| td/test_td_passive.js | fail | fail | STAGE_COUNT exception removed; current assertion/async caller remains |
| td/test_td_proto_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| td/test_td_protocol.js | fail | fail | STAGE_COUNT exception removed; current assertion/async caller remains |
| td/test_td_scores.js | pass | pass |  |
| td/test_tdhost.js | fail | fail |  |
| td/test_tdproto.js | pass | pass |  |
| td/test_tdsfx.js | pass | pass |  |
| test_coin_safety.js | fail | fail |  |
| test_economy.js | fail | fail |  |
| test_integration_cross.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_rc2_cache.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_root_keys.js | fail | fail |  |
| test_toast_hold.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_toast_lifecycle.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_toast_queue.mjs | pass | pass |  |
| test_toast_regression.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_zbtop_commit_failure.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_zbtop_integration.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_zbtop_old_parent.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| test_zbtop_preserve.js | pass | pass |  |
| tests/formal/bgm-pcm.test.mjs | pass | pass |  |
| tests/formal/bgm.test.mjs | pass | pass |  |
| tests/formal/carefree-bgm.test.mjs | pass | pass |  |
| tests/formal/copy52-display.test.mjs | pass | pass |  |
| tests/formal/economy-v2.test.mjs | pass | pass |  |
| tests/formal/fc2-archive.test.mjs | pass | pass |  |
| tests/formal/protocol.mjs | pass | pass |  |
| tests/formal/target-preview.test.mjs | pass | pass |  |
| tests/formal/td-fc2.test.mjs | pass | pass |  |
| tests/formal/td-receipts.test.mjs | pass | pass |  |
| zombie/test_zbtop.js | pass | pass |  |
| zombie/test_zbtop_browser.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |
| zombie/test_zbtop_layout.mjs | not-run | not-run | browser execution requires separate supported environment; not launched |

Raw summaries, command paths, environment and representative output heads are in c9a6cda-results.json, stage1-results.json and stage2-results.json. Full command stdout/stderr is emitted by the reproducible runner to the selected external output directory.
