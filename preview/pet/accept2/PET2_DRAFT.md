# Two pets per room: isolated local draft

This is a local next-preview patch, not a deployed build or the current integration.

## Baseline and scope

- Repository: yyyhhw/tangzhe-zhuan-playtest.
- Published baseline: 13i, fff02e09d39c11063d3ea07ee51d1689e1c56325.
- App/economy/index/TD files were copied from the isolated 13j integration candidate. Parent app SHA256: c935d367343df973919df5728135f4d9d0e11c4b74b7b1fffb7daeffe8b8cd28. Economy SHA256: a0751b59b98114d7811919fd33cdecc9a9a6cc94f43b5edff2474aba539db38c. The source candidate was never edited.
- Unchanged pet dependencies and the standalone pet app were read from the exact 13i revision. Acceptance contract: devin/pet2-accept at d201ca29bcda7b75266e7e7a99cdb585dfc59a61.
- Rebase only after 13j review/integration. Do not apply the full parent app over unrelated integration changes; review the patch hunks.
- No remote writes, installation, deployment, formal-root files, or storage-key changes.

## Implementation

- state.pets v2 holds individual records with uid, species, room (null = standby), boughtAt, and an opaque engine payload. The legacy single state.pet migrates once. Excess residents go to standby; duplicate identities resolve to one resident. Unknown species keep their growth payload unchanged.
- Each room has two explicit slots, a complete owned-pet list with location, free placement, and return-to-standby. A full room requires the user to choose exactly which resident goes to standby. Cancel never starts a transaction. A stale dialog rejects placement instead of using a changed roster.
- Buying another dog creates a new identity. A full room offers explicit replacement or purchase to standby; there is no automatic eviction. Already-owned pets never need repurchase.
- All allocation and purchase mutations, including runtime snapshot preparation, happen inside E.transact. Pets use the existing E.commitSave for main/backup readback and revision conflict protection. Public app.persist and economy.js are unchanged by this patch.
- Each dog has its own runtime, view, interaction controls, initial berth, bed where space permits, and save payload. A tap targets one topmost dog. Furniture-space waiting remains distinct from the two-pet capacity.
- Unknown species have a textual roster entry only. Cat artwork, animation, and toy/action loop are intentionally absent; dogs are not relabeled as cats. Full acceptance C1–C8 and cat-dependent U7 remain pending separate cat work.
- The standalone preview/pet/game/app.js shares petgame.js and the preview save, so its pet UI is updated in parallel to avoid reading removed state.pet fields after migration. Its unrelated game behavior remains unchanged.
- Cache/version files remain the exact 13j baseline (parent 13j, standalone p6b) to preserve the coordinated-version contract. This patch must not be deployed alone: integration owner must advance all affected resource queries, inline version checks and version.json together for the eventual next preview. No release version was claimed.

## Verification commands

Run from a complete repository with the patch applied:

    node preview/pet/accept2/test_pets2_core.js
    node preview/pet/accept2/test_pets2_ui_vm.js
    node preview/pet/accept2/test_pets2_roster_runtime.js
    node preview/td/test_tdhost.js
    node preview/td/test_td_protocol.js
    node preview/td/test_td_bridge.js
    node preview/test_coin_safety.js
    node preview/test_economy.js
    node preview/pet/test_engine.js
    node --check preview/app.js
    node --check preview/pet/game/app.js
    node --check preview/pet/game/petgame.js

The UI VM evaluates actual app pet functions using minimal fake DOM/storage, real Economy, and real PetGame. It cannot establish layout, touch-device, atlas appearance, browser lifecycle, or real-browser storage behavior. Tests explicitly compare whole state for cancellation, stale choices, and failure rather than only projections.

## Browser and manual acceptance (pending, not run here)

Use a fresh isolated browser profile and a complete local checkout. Do not run fixture injection against a player's profile or formal site. Freeze after EVERY initial load and reload via __tzz.pets.manual(true); the hook pauses simulation, passive autosave, hide/blur saves and foreground tick. Use __tzz.pets.step(uid, seconds) to advance only the selected pet, then __tzz.pets.draw() before inspecting. __tzz.pets.view() exposes live growth snapshots without changing state.

1. Seed three dog instances (a and b in c77, c in standby), distinct legitimate affinities (51, 62, 73), sufficient coins, and all CEO rooms unlocked. Save only to the preview save in the disposable profile. Reload and freeze again.
2. Open c77's room. Check exactly two slots, every pet's location, scrolling, 40px+ controls and no horizontal overflow at iPhone SE and 15 sizes. Record screenshots.
3. Place c. Verify only a/b appear in the replacement chooser. Cancel. Compare the full state and saved bytes with the snapshot from before opening; nothing may change.
4. Reopen, choose b. Verify a/c in c77, b standby, all growth unchanged and coins unchanged. Read the preview save back, reload, freeze again, and compare the stable roster/growth.
5. Reopen a full-room chooser and change a participant's room before confirming (test harness only). Capture full state AFTER the intervening change. Confirming the stale chooser must leave that entire state unchanged.
6. Inject preview backup/main write failures separately in the disposable profile. Placement must fail; whole state, visible slots and stored main must remain the pre-action values. Restore storage methods after each case.
7. With two dogs, advance 1.5 seconds deterministically and draw. Both must be visible and separable. Tap one, step each 0.25 seconds, draw; only the targeted dog reacts. Confirm the saved growth belongs to the same uid after moving away and back. Two dogs may visually overlap during free movement; topmost-only hit targeting is intentional.
8. Try purchase to an empty slot, a full room with explicit replacement, and standby; test each cancel, insufficient balance, failed save, and repeated confirm. Verify one successful purchase costs exactly 3000 and allocates exactly one new uid.
9. Seed an old single-dog state.pet and a four-resident v2 room in separate disposable fixtures. Reload/freeze. Verify legacy growth/location, and 2 residents + 2 standby without loss. Verify unrelated TD, zombie, coins, furniture, and CEO progress after each migration.
10. Visit the standalone pet preview with the same disposable preview save, then return to main preview. Verify the same roster/growth, no exceptions, and unchanged formal-key sentinel throughout.

Run the unchanged d201ca2 browser acceptance once real browser support and cat implementation are available. Do not call cat-dependent checks passed based on this dog-only draft.

## Independent review corrections

- Runtime snapshot preparation stages a candidate engine payload without immediately advancing the runtime's committed-state comparison baseline. A failed transaction can restore saved state while retaining every pre-transaction live dog world, including unsaved affinity and energy; subsequent sync and retry are part of regression coverage. Default persistence callers use the same staged reconciliation, so the fix is not limited to the pet allocation callback.
- Tap ordering follows actual rendered z-index, then actual DOM sibling paint order. Equal y, different y within one 0.1-tile layer, and remounted/reordered sprites are covered; raw y is not a tie-breaker for equal CSS layers.
- Bed berth assignment responds to room roster changes. Removing the first dog and adding another cannot leave both retained/new runtimes on the second berth until refresh. Regression checks compare before/after refresh and preserve live growth.
