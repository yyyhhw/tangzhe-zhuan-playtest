# 星途01a（未接玩法、未自动初始化）

`space/domain.mjs` is a pure optional-domain proposal. It reads no Storage and uses no clocks, RNG, wallet or economic rules. SAVE_VERSION remains 3. Economy.newState remains unchanged; missing space is not a mandatory parent-shape field.

## Schema 1

| Field | Stored meaning |
|---|---|
| schemaVersion | 1; other versions read-only |
| lv.tech / war / med / life | 科技 / 战斗 / 医疗 / 生活研究等级；positive safe integers, missing-domain defaults all 1 |
| pts | exploration points, nonnegative safe integer; default 0 |
| voyage | null or `{route,start,dur,ev}`; route/event identifiers, safe nonnegative start/duration in milliseconds, event can be null |
| items | research identifier → positive integer star count |
| cards | story identifier → nonnegative integer progress; collection only, no bookstore battle link |
| hidden | hidden item identifier → boolean |
| alienCards / wins | nonnegative integer alien count / consecutive wins |
| ended / earth | completion / Earth purchased booleans |
| visits | route identifier → nonnegative integer visits; distinct from story progress, supports demo belt count |

Empty dictionaries, null voyage and false booleans are the other defaults. There is no default money, milestone, grant, level threshold, alien-card cap or terminal reward. No demo balance/30 points are imported. Numeric validation is a serialization constraint, not a gameplay rule.

Only the entire missing domain can get defaults. Null, partial, malformed and future domains fail read-only; nothing is normalized. Unknown JSON extensions at domain/level/voyage object levels are retained and cannot be changed through ordinary saves. Typed dictionary values must keep their declared type; invalid nested entries are refused and never cleaned. Non-JSON values/accessors/cycles/custom instances are refused.

## Explicit narrow host interface

`readSpace` and `migrateSpace` return copies/proposals without mutating input. Valid data roundtrips unchanged; repeated migration is idempotent. `spaceTransition` describes validation, not a save authorization.

Actual P1 coordinators (formal and preview), the shared P2 coordinator and its real-page facade expose `initializeSpace()` with **no arguments**. It obtains the exact adopted current state under the existing lease and private capability, and permits only missing → exact defaults, then the usual revision increment. It cannot combine wallet/collection/opaque mutations. Ordinary commit may retain a valid space verbatim, but cannot add, alter or remove it. Already present valid space returns without a write or revision increase.

The facade permits this interface only while already playing; prompt/prepared/read-only/failed/revoked states remain blocked. It does not confirm P1→P2 or activate 44 wearables. No production app calls it. Uncertain writes must reconcile by exact before/intended readback; reconciliation never replays initialization or refunds/rewards. Source/original/snapshot evidence is never rewritten. Existing Storage allowlists, authentication and lock scope remain unchanged. Formal root/pet use the same save; preview is isolated; previewpet is not migrated.

This candidate deliberately leaves release/cache/version tokens unchanged. New imports use the existing release token on their new path, and real vendor dependency hashes are updated. A future explicit activation requires its own resource-version review.

## Reproduction (Node/VM, not browser)

```
node --experimental-vm-modules --test --test-isolation=none tests/space01a/*.test.mjs
node --experimental-vm-modules --test --test-isolation=none tests/wearables8/*.test.mjs
```

The production harness executes actual bootstrap, coordinator and extracted actual save hooks/boot prefix with synthetic DOM, Storage and locks and no QA query. It is not a full real-page browser or a user save. No restricted Chromium retry is performed.

## r2 host synchronization and JS object boundary

The real-page facade does not flush from initializeSpace. It requires an attached app, no persist.pending and exact canonical equality between actual app.state and the lease-validated persisted state. A dirty payload returns SPACE_APP_SAVE_REQUIRED with zero disk write and zero memory replacement, leaving the independent normal save available. The app dirty variable is a redraw latch which renderTab resets; it is deliberately not used as proof of save synchronization. After a successful independent app.persist(), initialization may add only space/defaults + its own rev. An existing-domain no-op never calls play/collectionReplaceState, including when the redraw latch is set.

Pure JSON validation requires dense own array indices 0..length-1 and no extra keys. Plain native Object/Array prototypes are recognized across realms by their intrinsic constructor/prototype linkage; direct null-prototype JSON dictionaries remain supported, arbitrary intermediate prototypes are refused. Inherited toJSON and custom prototypes are rejected before any JSON copy. These are JS-object pure-API/bare-P1 counterexamples; they are not a claim that ordinary parsed JSON saves generally contain such structures. Schema/business rules remain unchanged.

## r3 cross-engine native formatting

Intrinsic constructor source recognition ignores whitespace (including JSC newlines/indentation) while retaining the exact Object/Array name/native body and constructor/prototype identity closure. No dirty synchronization logic, schema or save transaction changes. tests/space01a/native-format.test.mjs reconstructs the exact r2 domain preimage and checks SHA256, then compares r2 failure/r3 success under an isolated Node/VM native-format shim. The shim is a format simulation, not JavaScriptCore/WebKit/browser evidence.
