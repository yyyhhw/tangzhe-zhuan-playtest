# Unified pet entry candidate (local, not published)

This candidate follows the corrected interaction requirement and supersedes the
all-in-manager design in local commit `6646d90`.

Only purchase, placement, standby and replacement live in the **宠物** management
collection. The visible room has one group of three interaction buttons directly
below it. Two resident pets share that group; compact target chips and tapping an
actual pet select its target. The selected pet is highlighted. Interacting neither
opens management nor rebuilds the room or changes scroll. Management contains no
interaction buttons. Closing management returns to the room and controls; removing
the selected resident chooses a remaining resident. Both entrypoints match. During visible pet interaction, the room avatar uses its
normal low layer so it cannot cover pets near the center; pet pixels are unchanged.

## Release boundary

- Candidate cache/version: `13k-pets-ui2` in both preview entries.
- Six reviewed companion manifests are enabled for this preview candidate. A
  normal hostname and URL, without `petPrototype`, can buy/manage all seven after
  validated images load. Missing/invalid assets still prevent purchase.
- The original pixels, atlas geometry, scale and animation frame mapping are
  unchanged from the reviewed base. Sparse prototype loops and the known cat
  south-walk chest transition remain visual limitations; no new art was invented.
- Root v14, root save keys, main and the live Pages deployment are unchanged.
- This local commit is not approval to publish it. The remote base candidate
  `0245f335cc06db039d7af193a6dc222386e9db40` does **not** contain this entry or these fixes.

## Save and input protections

One purchase per species, two different species per room. Existing same-species
records keep their growth and purchase time in compatibility standby; an explicit
selection changes the active record without a new charge. Unknown records remain
opaque. Unknown/known UID collisions in either order preserve the paid dog and all
records. Repaired known IDs retain `uidRepair.originalUid`; unknown storage objects
remain untouched and receive derived internal quarantine IDs. Migration is
idempotent and failed writes roll back.

An original v14 `state.pet` is retained as an immutable rollback shadow while the
new runtime uses `state.pets`. Actual v14 economy/pet code reads the original dog
from both main and backup after repeated candidate saves. This preserves the
original dog, not a claim that v14 understands new species or new-roster progress.

## Current executable checks

From the repository root, run the Node files in `preview/pet/accept2/`:

- `test_species_unique.js`: uniqueness, compatibility, opaque records, conflicting
  IDs in both orders, migration rollback and idempotence.
- `test_pet_portal_regressions.js`: actual v14 migration and rollback; 24 combinations
  of buy/replace/move/standby with readonly, unsafe/corrupt saves, revision conflict,
  quota and silent-write failure; two-species full-room recovery and version keys.
- `test_pets2_core.js`, `test_pets2_roster_runtime.js`, `test_pets2_r4.js`: updated
  current species/placement/runtime/save contracts. They do not buy a second dog.
- `test_pets2_ui_vm.js`: 16 current portal rendering/state/escaping contracts;
  obsolete two-slot DOM assertions are replaced by the real browser checks below.
- `test_manifest_companions.js`: malformed semantic/multi-atlas input plus rejection
  of a dog manifest relabelled as a companion; other valid registrations continue.
- `test_companion_runtime.js`: 21 mixed-species pairs, growth rollback, routing,
  original source hashes and autonomous behavior profiles.

`test_pet_portal_e2e.mjs` uses Playwright. It serves this checkout through isolated
browser request routing at `http://preview-candidate.invalid` (no network publish),
without test flags. `PLAYWRIGHT_MODULE` may point to an existing Playwright module;
`PET_TEST_OUTPUT` chooses the screenshot/result folder. It tests both main and standalone at widths
320/375/393: all seven purchases, repeated taps, replacement
cancel/confirm, standby, one shared three-button group, successful targeted interactions, sprite-tap selection,
no scroll/room reset, standby fallback, Escape/return/reopen, reload,
formal-save sentinel and no horizontal overflow/page errors.

`test_dogs2_e2e.py URL --browser chromium --shots DIRECTORY` uses an existing Python
Playwright install and only accepts a local disposable preview. Default browser is
WebKit when installed. It checks single dog purchase, blocked repeat purchase in
another room/standby, preserved old duplicate growth, explicit activation, actual
main-write failure, refresh, and a real second-tab lock. The old dog/r4 Python
entrypoints delegate to this current suite; they no longer assert new double-dog
purchases. The historical `test_pets2_e2e.py` cat choreography draft is not the
current portal acceptance suite and was not claimed passing.

The previous candidate passed eight Node suites. This interaction correction reran
the three affected Node suites, six normal-host portal browser
cases, two legacy/two-tab cases, syntax/diff/root-scope checks and the web-game
skill smoke. Browser runs used Chromium 145 phone emulation, not physical phones
or a new WebKit acceptance run. Earlier WebKit18 baseline/log limitations remain.
