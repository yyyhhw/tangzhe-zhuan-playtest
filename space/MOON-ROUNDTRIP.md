# 01b+04 月面基地往返闭环（候选测试切片）

Parent is reviewed01a r4 `472349b5f31df4446e79694b6be5bd6f66bd6db4`; this whole playable increment must be reviewed together. No foundation-only release. Actual production main remains first8 `3a96a86a1c854bd681c0ff033de1e71ef724640e` until separately authorized review/release.

Only moon is implemented. **Production gate (杨总 2026-10-14 01:32 JST「星途所有店铺35级就可以了」): every shop open and Lv≥35.** Ruleset `xingtu-moon-10min-8pts-v1`: 10-minute (600000 ms) voyage / 8 exploration points per claimed return (replaces r5 test ruleset `space01b04-moon-6s-8pts-test-v1`, 6 s / tech Lv50). No demo balance/30pts, economic parameters, aliens, crafting, research spend/upgrades, end/Earth purchase, milestone02 or bookstore battle integration.

## Held parent transaction

UI sends only `{type:'depart',route:'moon'}` or `{type:'claim',voyageId}`. Parent owns scope, trusted clock and crypto UUID; monotonic sequence is persisted. Public ordinary commit continues to refuse any space changes. A separate private moon Symbol lets only the host-generated proposal through; the full parent projection outside space must equal the prior confirmed state, and collection/evidence/opaque/TD receipt guards remain.

Overlay intent adapter first performs a read-only preflight. Duplicate/stale requests require the existing facade synchronization guard but do not flush/save/replace memory. A new eligible intent completes **independent normal app.persist()** first, then the facade compares actual app.state against held current storage exactly; pending/dirty-after-save/readonly/hidden/frozen/other-game/revoked states refuse private writes. No normal business mutation enters the private proposal. First departure can add the exact missing-domain defaults plus voyage/ledger in one private transaction; open/read never initializes.

No time-counting interval is authoritative. Arrival is start+duration from persisted facts. Current voyage is retained with completed=true on atomic claim; pts+8, visits.moon+1, claimed high-water and a single latest receipt update together. A second explicit departure replaces only known voyage facts, preserving unknown voyage extras. No infinite receipt array, implicit next flight, batch reward or auto-claim. Legacy missing IDs/unknown rulesets/null/future ledger, invalid duration/time/overflow are protected, not cleared or guessed.

Backups/main/readback use existing real coordinator. Successful readback after write-then-throw confirms; equal-before is determinate failure; unavailable/unequal readback retains before/intended and stops writes. Recovery explicitly reads exact before/intended and replaces memory through existing coordinator reconciliation. It does not replay claim/depart, refund or roll back disk. Overlay refresh after reconciliation is read-only.

## Parent lifecycle/UI

Shared module overlay + window.XingTu.open, no iframe or direct Storage. Root and rootpet share formal namespace/lock; preview has its own; previewpet stays unchanged old36. Actual technology launch card is selective local integration; milk TD remains shops[1], protocol3/campaign/history/receipts unchanged; battle entries/resources remain retired. TD, zombie and moon exclude each other. Repeated open reuses one view. Close leaves voyage intact. Hide revokes view callbacks; visible resume runs after parent visibility handler then rechecks current held storage. Pagehide and simulated persisted-pageshow invalidate permanently; stale callbacks cannot save. Here freeze means the existing app.freeze() (including storage conflicts), which already invalidates XingTu. There is no document browser freeze-event listener or new freeze/resume behavior. Actual BFCache entry/restoration has not been browser-tested in this author environment.

Parent offline settlement/claim happens first under existing Economy; no lastSeen/maxSeen/backward/offline formula changes. Native music logic adds moon exclusions to unlock/start/resume/allowed checks. Open pauses existing BGM; close resumes only visible/unmuted/unfrozen/no other game. Audio denial cannot decide a save. CSS handles narrow/short orientation, but actual browser layout must be independently tested.

## Resource closure

Combination token `space01b04-moon-on-wearables8-20261012-r1` closes root/preview/rootpet version→HTML bootstrap→release/entry→actual app→coordinator/overlay/space modules. Updated real dependency pins cover derived vendor bytes and new space modules. Old source archives/business code remain unchanged. Unchanged home-interaction renderer stays at its verified first8 token; strict regression keeps its original stale-v15c negative control. Unchanged styles/TD/icon/audio blobs retain their cache tokens. Previewpet is not retokened/migrated.

## Browser handoff

Checkout the exact candidate SHA. Use isolated synthetic data, ordinary root/preview/rootpet pages without QA query, all-shops Lv34/35 gate. Test320/390 portrait and844 landscape while flying, close/reopen, refresh at ready/flying/arrived/claimed; actual native storage faults before/after private main write and failed/mismatched readback; readonly reconciliation before/intended, third-party bytes, lost lock/two-page handoff and BFCache. Check BGM mute/background/denial and no double rewards or normal-income loss. Node/VM tests below are not actual browser/native Storage evidence.

```
node --experimental-vm-modules --test --test-isolation=none tests/moon/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```
