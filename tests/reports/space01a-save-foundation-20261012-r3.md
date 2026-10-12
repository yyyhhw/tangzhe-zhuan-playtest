# 星途01a r3 — cross-engine native-function whitespace

Independent revision only. Parent `fa173b57b364688d5786cacbbc5a71e4eb076b13`, parent tree `75d8901aad55d8de2ed0659f5308bc5ccc27cc37`. Branch `codex/space01a-save-foundation-on-3a96a86-20261012-r3`. r2 retained. Main remains `3a96a86a1c854bd681c0ff033de1e71ef724640e`. Full r3 SHA/tree are the containing commit and final delivery identity. No merge, deploy, browser launch, Slack, user-save access, account/login/permission change.

## Official source read and precise finding

Read with GitHub read-only tool `mcp__codex_apps__github_fetch`, pinned WebKit commit `6233469583cbc20164551c8b4ace7f20b3a5f8e9`:

- [function-names-expected.txt](https://github.com/WebKit/WebKit/blob/6233469583cbc20164551c8b4ace7f20b3a5f8e9/LayoutTests/js/dom/function-names-expected.txt#L15), line15 explicitly expects `Object.toString()` as `function Object() {\n    [native code]\n}`.
- [FunctionPrototype.cpp](https://github.com/WebKit/WebKit/blob/6233469583cbc20164551c8b4ace7f20b3a5f8e9/Source/JavaScriptCore/runtime/FunctionPrototype.cpp#L94), lines94/101 render native/internal function name/className followed by `() {\n    [native code]\n}`. The expected file above does not directly list Array; the generic renderer is the source evidence for the format. No actual JSC engine was run.

r2 compared Function.prototype.toString output to one exact V8 single-line layout. Under an isolated VM format shim reproducing these native Object/Array strings, ordinary JSON.parse parents (including missing space) return SPACE_PARENT_INVALID_READ_ONLY. This is a cross-engine compatibility defect, distinct from dirty-host safety.

## Narrow code change and preserved boundaries

Only one production code line changes in space/domain.mjs: remove whitespace from the intrinsic source before comparison to `function${name}(){[nativecode]}`. Matching is still limited to the exact expected Object/Array name and native body, not arbitrary native functions. Own constructor descriptor must remain a function; its own prototype descriptor must point back to the tested prototype. Object prototype chain and Array→ordinary Object prototype checks remain. Inherited toJSON, custom/mismatched prototypes, sparse/extra arrays, accessors/symbols/non-JSON values and cycles retain existing refusal. Legitimate same/cross-realm JSON remains supported.

The r2 dirty/pending/exact-payload guard and idempotent no-replacement branch are byte-identical. No host transaction, private capability, schema/field/default, newState, save-version, economic rule, automatic initialization, gameplay/card entry, snapshot/original/source, Storage allowlist, authentication, vendor dependency, production cache/version/release switch changes.

## Reproducible Node/VM format comparison

```
node --experimental-vm-modules --test --test-isolation=none tests/space01a/native-format.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```

Node v24.19.0; **format simulation only**, not WebKit/JSC/browser evidence. The new test reconstructs exact r2 domain text by reversing the single production line; SHA256 must equal `26845973dcbfea45e8d770a64ff3ba8ee3ed07309cfcf5b57a1e175d48ee5d2b`, later tied to the verified exact parent blob. An isolated VM changes Function.prototype.toString presentation only for genuine native Object/Array constructors; no production source is injected or changed by the shim. The native/prototype objects and JSON.parse objects remain V8 objects, so the result establishes formatting compatibility, not all JSC runtime behavior.

| same input under newline-format shim | exact r2 | r3 |
|---|---|---|
| ordinary JSON.parse parent, missing space | SPACE_PARENT_INVALID_READ_ONLY | readable, logical defaults |
| genuine second-realm parent/dense arrays | SPACE_PARENT_INVALID_READ_ONLY | readable/migratable |
| missing migration and existing domain | format gate rejects | pure/idempotent roundtrip |
| custom prototype / mismatched constructor / own fake toString | refused | refused |
| inherited Object/Array.prototype.toJSON / sparse/extra arrays | refused | refused, serializer zero calls |

10 new cases: pinned r2 preimage/r3 comparison, pure migration/idempotence, cross realm, ordinary V8 control, invalid structures, spoofed constructor/prototype closure, inherited Object and Array toJSON, formal/preview actual production module-chain loading under the VM shim. Those production tests use modeled DOM/Storage/locks and extracted actual save hooks/boot prefix, no QA query. Both verify dirty refusal without write/replacement, independent actual persist, initialization and existing-domain no-op identity preservation. They are not full real browser pages or native Storage fault injection.

Final original101 + new10 =111/111 space tests (8 files), zero failed/skipped/cancelled. Original141/141 wearables combination tests (7 files), zero failed/skipped/cancelled; existing dependency/resource assertions unchanged. Two changed MJS files syntax checked. One initial new spoof-test fixture shadowed global Object and threw a test TypeError; renamed the local fake constructor, then10/10 and full111/111 passed. This was an explained test-fixture failure, not an unresolved product failure.

## Related regression comparison

Exact same standalone commands as r2: `node <path>` from the candidate snapshot.19 entries still12 success/7 same failure;3 related aggregates still same baseline failures. All10 failing-file outputs match r2 after removing candidate path/timing variation.

| path | r2 exit | r3 exit |
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

Same identities: economy536/2 old cache assertions; coin516/6 old commitSave fixtures; formal/preview TDhost handshake18; bridge openTD old extraction; protocol missing Campaign.STAGE_COUNT VM dependency; preview card A2j154/A7252 old future-dataVersion assertions; root keys6/8 old cache/key assumptions; formal pet old singular pet.owned TypeError28; preview pet207/13 old pet/hook assumptions. No unrelated repairs/card development.

Selected37 executed Node/VM file entries =27 successful/10 same failures (case/file denominators distinct), not full repository green. Real Safari/JSC/WebKit/Chrome and browser-native Storage are untested this round. Historical blocked browser runner/Chromium/socket routes were not retried, nothing installed, no identity/route workaround or public game-site access. Official GitHub source reads are source evidence only.

## Complete r3 diff against exact fa173b57 parent (four paths)

- space/domain.mjs — one-line whitespace-independent native signature match.
- space/README.md — r3 compatibility/test attribution.
- tests/space01a/native-format.test.mjs —10 format-simulation controls/regressions.
- tests/reports/space01a-save-foundation-20261012-r3.md — this report.

No deletion. Candidate is built from the exact parent tree with this whitelist; all other blobs, especially r2 dirty protection, stay identical. Original product checkout clean. Nonforce expected-head protects only the new r3 branch; main/Pages untouched. Independent review required before any release.
