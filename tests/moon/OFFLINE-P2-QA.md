# Synthetic offline/pending P2 handoff (QA only)

No personal data; generated through actual P1 coordinator → reviewed migration/snapshot codec → admitted44 P2 validator/owner. All source/original/snapshot strings are retained; pending uses actual Economy.settleOffline + normal coordinator commit, not hand-edited P2 text. No production import, debug hook or reward rule change.

Four complete key/value bundles: `fixtures/offline-p2/{formal,preview}-{offline,pending}.json`. Formal works with root or rootpet; preview only with preview. Previewpet remains old36 and must not use these files. `offline` has lastSeen/maxSeen 10 minutes before anchor and no pending; ordinary real boot calculates offline. `pending` has the legitimate already-persisted pending at anchor. No space auto-initialization or fabricated moon awards. The final opening time can add legitimate further offline seconds under existing cap; do not expect an exact fixed total after arbitrary delays.

Generate fresh near browser's real wall time from the precise candidate checkout:

```
node tests/moon/generate-offline-fixtures.mjs work/offline-p2
```

Optional second positional argument is a valid epoch-ms anchor. Prefer real Date.now; do not replace Date constructor/dayKey or change live lastSeen then persist. The included bundles' anchor is recorded inside each file. Regenerate if the QA clock differs/backwards, rather than modifying immutable evidence or clearing protection.

In a NEW disposable browser context/profile with no player data, open the selected candidate fixture JSON through QA's local same-origin server, without starting the game first. Load bundle as `fixture` in the QA script, verify `fixture.synthetic===true`, correct scope, and **localStorage.length===0**. Only then install exact strings:

```js
if(fixture.synthetic!==true || localStorage.length!==0) throw Error('NOT_EMPTY_ISOLATED_QA_STORAGE');
for(const [key,raw] of Object.entries(fixture.keys)) localStorage.setItem(key,raw);
```

Never run this in an existing player profile; no removal/clear operation is needed or authorized. Navigate the same isolated context to root/rootpet for formal or preview for preview, with no QA query. Preserve lock ownership and existing P2 confirmation behavior. Observe ordinary offline/pending panel first; moon must refuse while pending. Claim by actual page control, normal save, then launch/claim moon. Compare wallet before/offline amount/after, claimLog exactly once, fractional balances and immutable evidence; close/reopen and compare all keys. If unknown/write error appears, use existing readonly reconciliation, never edit P2 or retry by reimporting fixture in that context.

Author verification uses Node/VM production entry with actual P2 codec/validator and real ordinary save functions; synthetic DOM/Storage/lease. Actual page controls, native dual-page locks and browser offline timing remain independent QA work. This provides incremental repro material for the concluded7104 round's offline PENDING, not a claim that its old run is still active or passed.
