# Tower-defense parent integration candidate

Base: 13i main at `fff02e09d39c11063d3ea07ee51d1689e1c56325`. Includes the complete TD sample directory from `devin/td-sample` at `04e717b09a5c5c496e1ab7b7487202ae20df73d2`, plus the reviewed integration changes. Candidate preview version is **13j, not published**.
This is an isolated local candidate rebased onto the verified Bear2 13i handoff. No remote write, push, merge, or deployment has occurred. Apply `td-integration-13j.patch` from the repository root at the exact base above; TD sample import is already included, so do not separately overlay its old child files. 13i artwork/furniture source changes and existing tests are preserved.

## Scope
- Preview only. Tech-company shop (index 3) gets the bottom card, after its CEO controls. Other shop entries remain unchanged.
- `state.td = {lv, cleared, best, cmd}` is an optional field in the existing main preview save. Old saves have no TD field until a successful TD mutation. No separate production/prototype wallet is used by the embedded child.
- All permanent upgrades and results go through parent `txn` → real `E.transact` → existing `app.js persist`. Prices come from `TDCore.price`, never the child. Debit, level/progress and main save succeed together or roll back.
- Save validation rejects malformed TD data instead of silently resetting purchased levels. Migration preserves the optional field and unrelated fields.
- Parent sends a MessageChannel only to the actual same-origin TD frame path. Child validates parent window and exact origin. Old/reloaded/closed ports cannot mutate the parent.
- Four commanders are explicitly selectable in this sample. Parent locks the selected valid commander and stage when a run starts; changing menu selection later cannot change that run.
- Run/buy deduplication is **page-local memory only**. It is not a durable cross-refresh transaction log. Reloading the parent discards live iframe requests, ports and run registration. Persisted TD levels/progress remain in the main save.

## Protocol
Child sends:
- `hello`, `close`
- `buy {id, requestId}`; requestId is a nonempty unique request token; never send price/balance as authority.
- `start {runId,n,cmd}`
- `result {runId,n,cmd,win,waves,kills}`

Parent sends `td:'state'`, authoritative `coins,z,blocked,muted`, plus:
- Purchase ACK: `ack:'buy', requestId, id, ok, why?`
- Start ACK: `ack:'start', runId, ok, n?, cmd?, why?`
- Result ACK: `ack:'result', runId, ok, why?`
Errors echo the original request/run ID too. Child ignores mismatched ACKs, including their state snapshots. Ordinary state pushes do not clear a pending purchase.

Successful duplicate purchases replay success without charging; changed item under the same token is rejected. Start replays cannot replace or revive an old run. Successful duplicate results replay success without writing again. Failed saves may retry the same transaction token/run. Result data is locked for save retries. Per-page token history is capped at 4096 entries without evicting used IDs; refresh is required after that bound.

A purchase ACK timeout keeps purchases/start disabled and shows retry-confirmation using the same token. Result timeout enables same-run retry. Both are 4 seconds; they do not claim failure proves nothing was committed. A late matching result ACK can still confirm success. Standalone sample remains exclusively on `tangzhe-td-proto`.

## Verification actually performed
- `node preview/td/test_tdhost.js`: 31 grouped checks passed. Uses real `Economy.transact` and `Economy.commitSave` against a fake storage adapter; **not** app.js persist or a browser.
- `node preview/td/test_td_protocol.js`: 9 grouped checks passed. Actual child script executed in Node VM with fake DOM/timers; **not** rendering/browser E2E.
- `node preview/td/test_td_bridge.js`: 6 grouped checks passed. Extracted actual parent bridge in Node VM; origin/path, stale ports, close, shop entry and pet cache-marker consistency. **Not** full app boot/browser E2E.
- `node preview/test_coin_safety.js`: 522 passed, 0 failed.
- `node --check` for app.js, economy.js, td.js, tdcore.js, tdhost.js: passed.
- Python syntax compilation for both TD browser test files: passed.

## Required validation still pending
- `python3 preview/td/test_td.py <local preview td/index.html URL>`: updated fake-host contract and assertions; NOT run successfully. WebKit executable absent here.
- `python3 preview/td/test_td_parent_e2e.py <local preview/index.html URL>`: new **real parent** app.js/persist tests; syntax checked only. Covers actual main/backup write-failure rollback, purchase recovery, result retry, refresh, saved commander, unrelated fields, formal-key preservation, SE/15 entry. Must be run with installed WebKit after applying candidate.
- Full `node preview/test_economy.js`: attempted but blocked by missing binary art files (12 missing home files, then ENOENT face_c77.webp), not a pass.
- Chromium fallback attempted using installed binary; sandbox blocked process socket creation. No browser/security settings changed and no software installed.
- Visual screenshots, SE/15 interaction, sound/lifecycle behavior, whole-app regression, Bear2 independent review are pending. The local 13i rebase is complete.

Candidate follows HANDOFF_13i cache rules: all parent index `?v=` references, preview/version.json and zombie iframe cache marker are 13j. TD scripts use 13j; the unchanged zombie child stays z10. ART_V and all 13i ART_ONE/FURN_SIDE entries remain untouched. The 13i pet/game cache omission is repaired separately: preview/pet/game/index.html references and its inline version-check B marker advance together from p6a to p6b, as does preview/pet/game/version.json. Its app.js and artwork/furniture behavior are untouched. Root/formal files are not part of this candidate. Version 13j is a local proposed version only.
