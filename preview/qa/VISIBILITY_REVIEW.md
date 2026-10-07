# Local visibility follow-up — 13k-night2

Base local candidate: `4055137a6f06cc6ae97dd147fe018675232d1975`, whose exact tree is published for review as `120d7bd67f2cb73f7d3b338900061eb2ddef3d2e`. This follow-up is local only on `codex/night-visibility-fixes`; no push or deployment.

## Changes

- Move the balloon below the maximum-height active combo HUD. Both shop implementations share the same placement.
- When a home has resident pets in life mode, show its CEO portrait and dialogue in a separate header outside the room. Keep the original CEO ground position as a small ring. Clicking floor tiles still moves that marker; furniture/life dialogue appears in the header. Furniture-arrangement mode restores the original portrait. Homes with no pets keep their original layout.
- Place successful decoration notices over the read-only wallet, away from collection buttons. Keep normal notices on their existing route; notices remain pointer-transparent and have status semantics.
- Add real operating-page iframe tests: use CEO reassignment UI, open the zombie game through its actual entry, receive state through its real MessageChannel, and return through its real exit button. No direct injection into the iframe's state handler.

No changes to pet movement, furniture collision, admission rules, economy modules, source artwork, training prices, training formulas, or root v14. Both preview entry cache versions are `13k-night2`.

## Evidence

Workspace browser evidence lives outside the repository:

- `browser-test/visibility-pets-final320/results.json` and `visibility-pets-final393/results.json`: 6 cases total (alpaca + original dog in main, alpaca in standalone, at both widths). Spatial movement/return, furniture body clearance, selected-pet isolation during commands, unchanged coins, save/reload growth, portrait/caption separation, CEO floor walking and switching life/arrangement modes pass. These runs advance simulation quickly; their videos are not real-time demonstrations.
- `browser-test/visibility-decor-final/results.json`: 74 existing decoration/CEO checks pass, plus expanded-HUD balloon pixel checks and on-screen/non-overlapping success-notice checks in both entries. The HUD countdown is frozen in the isolated fixture for exact pixel comparisons, avoiding real countdown or random critical-hit shake differences. Screenshots include `balloon-active-hud-320.png`, `balloon-active-hud-393.png`, `decor-toast-320.png`, `decor-toast-393.png`.
- `browser-test/ceo-embedded-output/results.json`: 10 actual iframe cases (320/393 × 77, Pearl, Otaku, Rocket, back to 77). UI reassignment, correct training names, real host coins, shared levels, identical prices, prototype storage untouched, formal save sentinel intact, exit handshake and no overflow pass.
- 25 spatial behavior cases and 4 focused portal/migration/storage/cache groups pass. Syntax, diff whitespace and preview-only scope checks pass. `browser-test/skill-smoke-night2` contains startup smoke evidence.

## Story artwork blocker

The newly supplied package `story-cards-8-pack.zip` (`libfile_00121c887cb48191bae439cd595f06d6`, `file_00000000e7f081f4957cd2affe055d1a`) returned HTTP 403 through official Library materialization. That attempt stopped. No old URL retry, bypass or alternative unauthorized access was attempted. No image bytes were obtained, so ZIP CRC/SHA256 validation and actual image integration remain pending. No production image paths or placeholder images were added in this commit.

All browser checks use desktop Chromium mobile viewports, not physical devices. Prior WebKit18 baseline and historical attachment limits remain unchanged.
