# 星途01a r2 — host memory synchronization / strict JSON boundary

Independent revision candidate only, parent `5b588dfeee156b3f7c787acef80ad4d33b95f1bb`, parent tree `c28885fed9ca45ace59166c1173bc5ce82f796c5`. Branch `codex/space01a-save-foundation-on-3a96a86-20261012-r2`. Original r1 preserved. Main remains `3a96a86a1c854bd681c0ff033de1e71ef724640e`. Full r2 SHA/tree are the containing Git commit and final delivery identity. No merge/deploy, Slack, login, permission change or user-save access.

## Confirmed root causes

Actual root app frame runs tick/update and pet updates before its five-second persist. App dirty is a redraw latch (`renderTab` resets it), not an unsaved-payload indicator. The attached host reads actual app.state; its normal wallet operation explicitly flushes first. r1 initializeSpace instead initializes from the owner's already-persisted state then calls play, whose collectionReplaceState assigns the whole application state. Replacing even an existing-domain no-op state can discard unsaved business changes. Actual module-chain/extracted-hook VM reproduction on exact r1 returned success but changed synthetic memory coins716430/coinFrac0.625/lastSeen1700000002000 back to saved716423/coinFrac0.5500000000001819/lastSeen1700000001000. These values are synthetic fixture evidence, not a user balance.

Pure API counterexamples on exact r1: an array length1 with only own extra='keep' passed JSON validation, but readSpace copied it to [null]; a custom null-prototype intermediate containing inherited toJSON passed validation and executed that serializer once, replacing nested data with 'rewritten'. These are arbitrary JS-object pure-API/bare-P1 risks, not claims that ordinary parsed JSON disk saves generally contain those structures.

## Narrow fixes

- Facade initializeSpace requires an attached app and no persist.pending. It reads the held owner's current validated state and compares its complete canonical payload to actual app.state. Difference returns SPACE_APP_SAVE_REQUIRED; invalid JS memory returns SPACE_APP_PAYLOAD_INVALID. Both refuse this operation without flush, write, memory replacement, or a save-block latch that would prevent a separate normal persist. Existing owner/lease/read-only fault guards still apply.
- Caller must finish an independent normal app.persist first. That separate commit is tested distinctly; initialization then adds only exact default space + its own revision. No wallet/time/pet mutation enters the private initialization transaction. Dirty=true with identical payload is merely a redraw request; dirty=false with changed payload is refused.
- A valid existing-domain no-op returns without play/collectionReplaceState, even for clean memory. Repeated calls cannot replace the app object or reset redraw state.
- Pure JSON validation checks dense own indices0..length-1 and refuses extra array keys, sparse arrays, custom Object/Array prototypes and inherited toJSON before copying. Genuine cross-realm intrinsic Object/Array prototypes are accepted via intrinsic constructor/prototype linkage; direct null-prototype JSON dictionaries retain own data. No cleaning or business/schema broadening.
- No newState, Economy, app product code, schema fields, source/original/snapshot bytes, Storage allowlist, authentication, cache/version/release switch, vendor bytes or card battle integration changes. No new gameplay, milestone, economic or reward rule. Existing dependency hashes remain verified. Strict import closure exact count changes36→37 solely for the facade's canonical import; all token/resolution/hash assertions remain.

## Tests, commands and attribution

Node v24.19.0. Current snapshots are r1 plus only this eight-path revision. All save adapters/data synthetic. Production harness uses actual candidate modules, no-QA production bootstrap and extracted actual app save hooks/boot prefix; DOM/locks/Storage are modeled, not a real browser. The new test-only options expose the existing private redraw latch and load each channel's actual PetGame dependencies, allowing the real pet-domain validator rather than bypassing it. No production hook or prototype patch is added.

```
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```

101/101 space cases = original79 + new22 (12 dirty/pending/host tests +10 JSON-boundary cases), no failures/skips/cancelled.141/141 wearables production-combination cases, no failures/skips/cancelled. Six changed MJS files syntax checked via node --check.

Dirty regression covers root/preview × P1/P2 × first/existing domain; unsaved coins, coinFrac, earnedFrac, lastSeen/maxSeen and valid v2 pet roster; both actual redraw-latch values; rejection leaves memory object/data and disk bytes/writes unchanged; separate actual persist success then initialization/no-op; idempotent memory object identity; pending-save negative control; normal-save failure remains protected; formal rootpet shared host. JSON regressions cover sparse+extra/dense+extra/sparse arrays, null-prototype intermediate, custom normal/array prototype, inherited toJSON function/getter with zero calls, legitimate cross-realm dense JSON and direct null-prototype dictionary. Invalid objects are also refused by actual bare formal P1 commit with zero writes and no normalization.

Same19 standalone commands as r1/main baseline; run each `node <path>` from snapshot root:

| path | baseline exit | r2 exit |
|---|---:|---:|
| tests/formal/protocol.mjs |0|0|
| tests/formal/economy-v2.test.mjs |0|0|
| tests/formal/td-receipts.test.mjs |0|0|
| tests/formal/td-fc2.test.mjs |0|0|
| tests/formal/fc2-archive.test.mjs |0|0|
| tests/formal/copy52-display.test.mjs |0|0|
| tests/formal/carefree-bgm.test.mjs |0|0|
| test_economy.js |1|1|
| test_coin_safety.js |1|1|
| td/test_tdhost.js |1|1|
| td/test_td_bridge.js |1|1|
| td/test_td_protocol.js |1|1|
| preview/td/test_tdhost.js |1|1|
| preview/td/test_td_bridge.js |0|0|
| cards/tests/save.test.mjs |0|0|
| cards/tests/saved-decks.test.mjs |0|0|
| preview/cards/tests/save.test.mjs |1|1|
| preview/cards/tests/saved-decks.test.mjs |0|0|
| tests/formal/tea-entry-cards-out.test.mjs |0|0|

12 successful /7 same baseline-failing files. Same failures: economy536/2 legacy cache assertions; coin516/6 old commitSave fixture assertions; formal/preview tdhost handshake fixture18; formal bridge old openTD extraction; formal protocol VM missing Campaign/STAGE_COUNT; preview card A2j154/A7252 future-version assertions. No card code changed. Extra related `node test_root_keys.js`, `node pet/game/test_petgame.js`, `node preview/pet/game/test_petgame.js` again retain baseline exits1 and exact failure identities (6/8 old cache/key assertions; old singular pet.owned TypeError28;207/13 old pet/hook assertions).

This round selects36 executed Node/VM file entries:26 successful and10 same-baseline failing; it is not a full-repository denominator. Counts of files and cases are distinct. The historically dependency-blocked browser runner was not retried. No Chromium/WebKit/native Storage or full real-page browser run, no restricted-route restart/bypass and no public-site access. All evidence here is source or Node/VM; independent browser review remains separately attributed.

## Complete r2 diff from exact parent5b (eight paths)

- qa-protocol2/real-page-facade.mjs — actual payload synchronization gate, pending check, no-op avoids replacement.
- space/domain.mjs — strict dense arrays and cross-realm native prototype recognition.
- space/README.md — r2 API/safety contract.
- tests/space01a/dirty.test.mjs —12 new regressions.
- tests/space01a/json-boundary.test.mjs —10 new regressions.
- tests/wearables8/production-harness.mjs — optional test-only redraw observer/actual pet dependency loading.
- tests/wearables8/resource-chain.test.mjs — exact import count37, existing assertions retained.
- tests/reports/space01a-save-foundation-20261012-r2.md — this evidence report.

No deletion. Original product checkout stays clean. Expected-head nonforce candidate update only; main/Pages unchanged. Schema review findings beyond these two supplied issues remain a separate review, not silently implemented in this revision.
