# Dog-only browser smoke mapping

This is a separate supplementary smoke script for the current two-slot dog draft. It does not modify or replace the original d201ca2 `test_pets2_e2e.py` or acceptance contract. Original cat-specific U7 and all C1–C8 remain **NOT COVERED**.

## Status and running

Prepared and Python syntax-checked only. No browser was launched or installed in the preparation environment. The script must be run by a browser-capable reviewer before any browser result is claimed.

Serve a complete checkout with the candidate applied, using an already available local server. With Playwright/WebKit already installed:

    python3 preview/pet/accept2/test_dogs2_e2e.py http://127.0.0.1:49761/preview/index.html

The same smoke can target the standalone page by passing `/preview/pet/game/index.html`. Each invocation creates fresh disposable browser contexts for iPhone SE and iPhone 15. It refuses non-local URLs and `?test=homes`. It never loads a personal browser profile or calls `localStorage.clear()`.

Screenshots and failure diagnostics go to `_dogs2_shots/`, or the requested `--shots` directory. WebKit device emulation is not a physical-iPhone test.

## Actual mapping

- Room navigation: `__tzz.setTab('home')`, `__tzz.homeAct('homeWho', 'c77')`, `__tzz.homeAct('homeSub', 'room')`, live mode, then `renderTab()` and `pets.draw()`
- Two slots: `#petSlots [data-pet-slot]`, resident identity in `data-uid`
- Owned list: `#petList [data-pet-uid][data-where]`; location is `c77` or `standby`
- Placement: `[data-act="petPlace"][data-arg="dog-c"]`
- Replacement options: `#petReplace [data-replace-uid]`
- Replacement cancel: `#petReplace [data-act="petReplaceCancel"]`
- Rendered dog: `#roomFloor .pet-dog.pet-sprite[data-uid="dog-a"]`
- Dog control: `[data-act="homePetPat"][data-arg="dog-a"]`
- Per-dog runtime: `__tzz.pets.world(uid)`; its real dog engine is `world.dog` (`world.pet` is the compatibility alias)
- Manual simulation: `__tzz.pets.manual(true)`, then `pets.draw()`; only explicit `pets.step(uid, seconds)` advances a dog

The original d201ca2 slot, list, place, replacement, and sprite selectors already match the current candidate source. Empty U1/U2 followed by a U3 missing-element wait cannot be explained as a selector mismatch from source alone. The new script checks the loaded fixture and API before attempting UI clicks and writes URL, served script URLs, mode, load information, roster, and selector counts on failure.

## Fixture and lifecycle

The disposable fixture has three actual dog instances: dog-a and dog-b in c77, dog-c in standby, with distinct affinities 51/62/73. It uses the real `Economy.newState`, unlocks all CEO rooms, clears only the fixture's furniture arrays, validates the save, and calls the real `PetGame.norm` before writing the existing preview main/backup keys. No cat is relabeled or substituted in the original acceptance suite.

An init script freezes the simulation synchronously when the app exposes `__tzz`; the smoke also freezes explicitly after every initial load and reload. The app's normal boot-time save occurs before the hook is exposed. Comparisons therefore start after boot, not before it. Loading, normalization, rendering, and fixture identity are checked separately.

## Known original-harness integration issues

1. `?test=homes` makes the app ignore localStorage and build an in-memory home fixture. A saved pet fixture will not load in that mode. The new smoke rejects it.
2. A current resident's placement button is intentionally disabled. The original U11 attempts to click it, which makes Playwright wait. The smoke checks the disabled DOM state and separately calls the actual dispatcher to verify the no-op.
3. The existing app uses `tangzhe-preview-tab-lock`. The original U10 key allowlist omits it. The smoke allows only the existing main, backup, formal sentinel, and tab-lock keys.
4. The original U7 and C1–C8 assume implemented cat worlds and cat animations. This dog draft returns no cat runtime. Those checks remain pending real cat implementation, regardless of dog smoke outcomes.
5. `petReady=1` means the manifest loaded, not necessarily that the atlas image has decoded. The dog sprite case also waits for actual atlas mode when the manifest requires it.

## Dog-only checks

- Two correctly populated slots, all three location-labeled owned entries, usable slot dimensions, and no horizontal document overflow
- Exactly two replacement choices, an in-viewport picker, and cancellation preserving full state, both stored byte strings, and rendered placement
- Same-room disabled control and dispatcher no-op
- Explicit successful replacement, one revision, no coin charge, correct main/backup bytes, unchanged growth, and reload persistence
- Stale replacement preserving the complete post-race state
- Separate main/backup quota and silently dropped-write failures, including readback detection, full-state/UI/disk rollback, and unsaved live dog growth surviving resync
- Two real dog canvas sprites and a real touchscreen tap changing only the targeted dog's runtime
- Existing storage-key isolation, unchanged formal-key sentinel, and browser page/console errors

The smoke does not establish the original cat U7, C1–C8, legacy-migration U8/U9, complete purchase UI acceptance, or physical-device behavior. The original acceptance files remain unchanged.
