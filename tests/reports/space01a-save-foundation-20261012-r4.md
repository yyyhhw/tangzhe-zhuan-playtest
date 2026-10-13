# 星途01a r4 — preserve native-code token boundary

Independent candidate only. Parent `d40f54e5db901ebdacd571610f7e695a379d016c`, parent tree `990269775344d1806f918d44210f979dec7d3d47`. Branch `codex/space01a-save-foundation-on-3a96a86-20261012-r4`. Full r4 SHA/tree are the containing commit and delivery message. Main remains `3a96a86a1c854bd681c0ff033de1e71ef724640e`; r3 preserved. No merge/deployment, Slack, user-save access, account/login/permission change or browser workaround.

## Reproduced collision and one-line fix

Exact r3 deletes every whitespace character in a constructor's intrinsic Function.prototype.toString result. Valid JS `function Object(){[nativecode]}` therefore collides with the stripped native signature. Set that actual function's prototype parent to null; its own constructor/prototype identity closure is genuine, and an object inheriting that prototype is incorrectly accepted. The same named `function Array(){[nativecode]}` works when a real dense array's prototype is set to the function's prototype and its parent is null (or the ordinary Object prototype). Merely putting Array.prototype in the middle does not satisfy the existing ordinary-parent test; the regression uses the actual passing construction.

The only production code change collapses each whitespace run to one ASCII space, trims, and compares against `function ${name}() { [native code] }`. The two words native/code must remain separated. `[nativecode]` is not equivalent. JSC newline/indentation and V8 single-line signatures normalize to the same genuine native signature. Constructor/prototype closure, exact Object/Array name, ordinary chain, inherited toJSON refusal, dense own indices/no extra keys, non-JSON value/accessor/symbol/cycle refusal remain unchanged. No fake function is called; no invalid structure is cleaned.

This is an arbitrary JS-object pure-API/bare-P1 structural issue, not a claim that ordinary parsed JSON disk saves generally contain fake constructors. r2 dirty/pending/payload and no-op guards remain byte-identical. No schema/fields/defaults, Economy/newState, save protocol/version, storage allowlist/authentication, private initialization capability, source/original/snapshot identity, economic/reward/gameplay/card behavior, vendor dependency or release/cache/version changes.

## Exact r3/r4 comparison and validation

```
node --experimental-vm-modules --test --test-isolation=none tests/space01a/native-collision.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```

Node v24.19.0, synthetic memory saves only. The new test reverses the single production line to reconstruct exact r3 domain source; SHA256 must equal `e771de91f5d72add58453c6ad121eb7f4215bc3bcf9c7e4322f1a843030061ba`, tied to the verified exact parent blob.

| input/condition | exact r3 | r4 |
|---|---|---|
| genuinely named fake Object with body[nativecode], real constructor/prototype closure | accepted/migrated | refused, original object retained |
| genuinely named fake Array with body[nativecode], real dense array, real closure | accepted/migrated | refused, original array retained |
| compact/spaced source, V8/JSC-format VM contexts | collisions accepted | all refused |
| native V8 and JSC newline signatures | accepted | accepted |
| legal cross-realm parent/dense arrays | accepted | accepted |
| dirty payload/pending save/inherited toJSON/sparse arrays/custom prototypes | previous protection | previous protection retained |

12 added cases: eight type×source-layout×format comparisons, four actual bare-P1 formal/preview×type tests. They assert genuine own constructor/prototype linkage, no own fake toString, zero fake-function execution through a throwing/counted nativecode getter, original object/prototype identity preserved, and zero P1 writes/main-byte changes. They also test genuine native parent JSON as a positive control. The prior111 cases remain byte-identical, including r2 dirty regressions, JSC-format pure/production module-chain controls, legal cross-realm data and old JSON-boundary negatives.

Final123/123 space cases = original111 +12, across9 files;141/141 existing wearables combination cases, across7 files. Zero failures/skips/cancelled. Both changed MJS files pass node --check. The execution counter in the new bare-P1 fixture was tightened to increment on access; the complete123 suite was rerun after that test-only adjustment and passed. No remaining unexplained product/test failure in these two groups.

JSC presentation is **Node/VM format simulation**, not actual JSC/WebKit/Safari/browser execution. r3's pinned official WebKit evidence remains source evidence only; no new engine claim. The production harness executes actual module/bootstrap/save hooks/boot prefix with modeled DOM/Storage/locks, not full real pages/native Storage. No browser installed or launched, no restricted route retried, no identity/network bypass, no public game site accessed.

## Related fixed regression comparison

Run each `node <path>` from candidate snapshot. Same19 entries =12 success/7 same failures; three related aggregates retain their failures. Every failing-file output matches r3 after path/timing normalization.

| path | r3 exit | r4 exit |
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
| test_root_keys.js |1|1|
| pet/game/test_petgame.js |1|1|
| preview/pet/game/test_petgame.js |1|1|

Same failure identities: economy536/2 legacy cache; coin516/6 old commitSave fixtures; formal/preview TDhost handshake18; bridge old openTD extraction; protocol VM missing Campaign.STAGE_COUNT; preview card A2j154/A7252 future-dataVersion assertions; root keys6/8 legacy assumptions; formal pet singular pet.owned TypeError28; preview pet207/13 old pet/save-hook assumptions. No unrelated fixture repair/card development. Selected38 Node/VM file entries =28 successful/10 same failures, not full-repository green. Case and file denominators are distinct. Historically blocked browser runner not retried.

## Complete four-path diff from d40f54e5 parent

- space/domain.mjs — one-line whitespace-run normalization retaining native/code separator.
- space/README.md — r4 token-boundary contract.
- tests/space01a/native-collision.test.mjs —12 structural counterexample/positive-control cases.
- tests/reports/space01a-save-foundation-20261012-r4.md — this report.

No deletion. All other parent blobs, including dirty host code and prior111 tests, verified unchanged. Nonforce expected-head candidate push only; original product checkout clean, main/Pages untouched. Independent review still required.
