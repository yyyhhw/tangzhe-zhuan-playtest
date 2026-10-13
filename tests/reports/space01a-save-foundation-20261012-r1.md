# 星途01a pure save foundation candidate — 2026-10-12

Candidate only; no main merge, Pages deployment, Slack communication, account/permission changes or real user Storage. Candidate full SHA/tree are the Git commit containing this report, also reported in the final delivery message.

Base/parent: `3a96a86a1c854bd681c0ff033de1e71ef724640e`; base tree `20925a76876020ecb1cde4e2b3a804ce82fcb858`.
Branch: `codex/space01a-save-foundation-on-3a96a86-20261012-r1`.
Pinned demo field evidence: `wangdama/xingtu-demo@a1bc784b76a9abf91cd40f5c452276a4ffde9fe4`, `design/xingtu/src/main.js`. Fields only; no demo balances, rewards, timers, milestones or gameplay copied. v2 design excerpt supplied by coordinator; not independently fetched from Slack in this task. Repo AGENTS.md and .agents/skills absent in local paths and exact remote tree; followed explicit user scope.

## Implementation and save safety

- Optional versioned space schema and pure read/validate/migrate proposal; no newState shape changes. Missing whole domain alone gets four Lv1/pts0 defaults. Null/partial/future/invalid values are read-only, never cleaned. Visits stays distinct; belt counts preserved. Legal JSON extensions roundtrip verbatim. No chosen Lv50 gate, alien count cap, economic/reward parameter or milestones.
- Actual formal/preview P1 and shared P2 coordinator expose a no-argument, private-capability `initializeSpace()`. It reads the adopted state under the existing lease and permits only missing→precise default; internal rev +1 is the sole other mutation. Ordinary saves cannot add/change/remove space. Repeated initialization is zero-write/zero-revision.
- P2 opaque field protection remains intact: only after exact full-state initialization validation does the private path project away the newly added domain for the existing opaque comparison. No global opaque/mutable allowlist change. Card-host capability stays distinct. Facade requires already-playing/owned/nonfailed state; prompt/prepared/revoked remains blocked. No app invokes initialization automatically.
- Existing backup/main/readback/reconcile transactions retained. Narrow P1 initialization adds lease checks at its write boundaries; uncertain intended state survives readback or postwrite lock loss. No rollback of user saves, no retry grants/refunds. Root/pet share formal keys; preview remains separate; previewpet untouched. Storage allowlists/authentication unchanged. Source/original/snapshot bytes and P1/P2/collectiblesV1 identity retained.
- No app/UI/economy/TD/card battle resource changes, no gameplay entry, cache/version/release switch changes. New module imports use the existing release token on a previously nonexistent path; changed vendor bytes have actual dependency pins. Existing strict resource closure assertion increases exact import count 34→36 for the two necessary vendor imports, retaining resolution/token/hash assertions. Future activation needs separate release cache review.

## Fixed comparison and commands

Node `v24.19.0`. All saves synthetic and memory-isolated. Base and candidate snapshots contain exact main and only this increment respectively. No browser launch. Commands run from each snapshot root.

| command/file entry | exact-main baseline | candidate |
|---|---|---|
| `node tests/formal/protocol.mjs` | success (0) | pass (0) |
| `node tests/formal/economy-v2.test.mjs` | success (0) | pass (0) |
| `node tests/formal/td-receipts.test.mjs` | success (0) | pass (0) |
| `node tests/formal/td-fc2.test.mjs` | success (0) | pass (0) |
| `node tests/formal/fc2-archive.test.mjs` | success (0) | pass (0) |
| `node tests/formal/copy52-display.test.mjs` | success (0) | pass (0) |
| `node tests/formal/carefree-bgm.test.mjs` | success (0) | pass (0) |
| `node test_economy.js` | nonzero (1) | same-baseline-failure (1) |
| `node test_coin_safety.js` | nonzero (1) | same-baseline-failure (1) |
| `node td/test_tdhost.js` | nonzero (1) | same-baseline-failure (1) |
| `node td/test_td_bridge.js` | nonzero (1) | same-baseline-failure (1) |
| `node td/test_td_protocol.js` | nonzero (1) | same-baseline-failure (1) |
| `node preview/td/test_tdhost.js` | nonzero (1) | same-baseline-failure (1) |
| `node preview/td/test_td_bridge.js` | success (0) | pass (0) |
| `node cards/tests/save.test.mjs` | success (0) | pass (0) |
| `node cards/tests/saved-decks.test.mjs` | success (0) | pass (0) |
| `node preview/cards/tests/save.test.mjs` | nonzero (1) | same-baseline-failure (1) |
| `node preview/cards/tests/saved-decks.test.mjs` | success (0) | pass (0) |
| `node tests/formal/tea-entry-cards-out.test.mjs` | success (0) | pass (0) |
| `node test_root_keys.js` | nonzero (1) | same-baseline-failure (1) |
| `node test_integration_cross.mjs` | nonzero (1) | browser-preflight-blocked (1) |
| `node pet/game/test_petgame.js` | nonzero (1) | same-baseline-failure (1) |
| `node preview/pet/game/test_petgame.js` | nonzero (1) | same-baseline-failure (1) |

Additional fixed groups:

```
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
```

Wearables8 exact seven files: catalog, production-entry, evidence-lifecycle, storage-boundary, gameplay-chain, td-history, resource-chain (`tests/wearables8/*.test.mjs`); baseline141/141 and candidate141/141, zero failed/skipped/cancelled. New exact five files: domain, host, production, transaction, history (`tests/space01a/*.test.mjs`); 79/79, zero failed/skipped/cancelled. Changed MJS syntax:12 checked successfully.

Denominator:19 existing standalone entries =12 success/7 same failures; seven existing wearables test files all succeed; four extra entries =3 same failures and1 browser-runner preflight blocked. Combined selected35 file entries:34 actually executed Node/VM =24 success/10 same-baseline failing files;1 browser runner blocked before launch. This is not the old82/67 or whole-repository denominator and case counts are not added to file counts. The browser runner import failed with `ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'`; no engine started and no installation/retry/bypass followed.

## Existing failure identities

The seven original failing files retain the same failures; normalized output is identical except timing in preview card tests (same two titles/lines). These are not repaired in01a:

- `test_economy.js`:536 passed/2 failed, legacy ART_V=14 and13i light cache expectations.
- `test_coin_safety.js`:516 passed/6 failed, existing commitSave/old save-path fixtures.
- `td/test_tdhost.js`:assertion at line18, existing handshake fixture.
- `td/test_td_bridge.js`: `TypeError: f.api.openTD is not a function` (old extraction anchor).
- `td/test_td_protocol.js`: `TypeError: Cannot read properties of undefined (reading 'STAGE_COUNT')` at VM6:30, loaded by test line13; VM missing Campaign dependency.
- `preview/td/test_tdhost.js`:existing handshake assertion at18.
- `preview/cards/tests/save.test.mjs`: A2j at154 and A7 at252, future-dataVersion old candidate assertions; no card code edited.

Extra same failures: `test_root_keys.js`6 passed/8 failed old storage/cache expectations; `pet/game/test_petgame.js` line28:91 `TypeError: Cannot read properties of undefined (reading 'owned')` (old singular pet fixture); `preview/pet/game/test_petgame.js`207 passed/13 failed old singular pet/save-hook expectations. `test_integration_cross.mjs` is an unexecuted browser suite, dependency preflight failure, not a product assertion. No whole-repository green claim.

## New evidence and limits

79 cases cover exact defaults/read-no-write/idempotence; partial/null/future/invalid refusal and nested data preservation; current-new/P1/P2 absence; direct mandatory-newState and direct opaque insertion negative controls; private token/argument refusal; 36/44 confirmation cancel and explicit confirmation; wallet fractional parts, owned/wear, authentic pet serializer and protocol3 TD purchase receipt/stage result; source/original/snapshot and old card-key byte preservation; backup/main failure, write-after-throw with successful readback, genuinely failed/unequal readback and before/intended reconciliation; lease loss before/after writes, two session handoff and no duplicate initialization. Actual initialization+transaction+validator+planner+codec execute, never stubbed persist=true.

Production tests run actual no-QA bootstrap/module chain and extracted actual app save hooks/boot prefix in Node/VM with modeled DOM/Storage/locks. They are not a complete DOM/browser page or native browser Storage. Real Chrome/Chromium/WebKit/native fault-injection not executed; historical restricted paths not retried, public sites not requested. New gameplay browser test not applicable to this inactive foundation. Real host isolation may be independently reviewed in an available authorized browser environment.

## Complete diff paths

- `collection/host-save.mjs`
- `preview/collection/host-save.mjs`
- `qa-protocol2/dependency-pins.json`
- `qa-protocol2/real-page-facade.mjs`
- `qa-protocol2/vendor/cards/card-coordinator.mjs`
- `qa-protocol2/vendor/runtime/validator.mjs`
- `space/README.md`
- `space/domain.mjs`
- `tests/space01a/baseline-comparison.json`
- `tests/space01a/domain.test.mjs`
- `tests/space01a/history.test.mjs`
- `tests/space01a/host.test.mjs`
- `tests/space01a/production.test.mjs`
- `tests/space01a/transaction.test.mjs`
- `tests/wearables8/resource-chain.test.mjs`
- `tests/reports/space01a-save-foundation-20261012-r1.md`

No deletion or resource restoration. Original product checkout stays clean; work and logs are outside it. Final remote main must still equal the base when this candidate is published; expected-head nonforce applies only to its new branch.
