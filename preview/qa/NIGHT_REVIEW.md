# Overnight local review candidate — 13k-night1

Base: published main `a5cf0effe31cdb947250f0eadd6b24640fb59334`.
Local integration branch: `codex/overnight-preview`. No push, merge or deployment performed for this candidate.

## Player-visible changes

- One visible three-button pet bar remains under the room. Only the selected pet receives a requested action.
- Cat chases a feather over three legs; alpaca runs and emits harmless water droplets; red panda pushes a wooden ball; robot visits three scan points; panda cub searches two bamboo-leaf spots; rabbit hops between ball positions. Each uses reachable routes around furniture, returns to its start, and has explicit progress/finish text.
- Repeated play clicks request one return; call/pet interrupt cleanly. A room without a meaningful route rejects play without fake completion. No dog engine, original pet art, combat damage or economic rewards changed. Successful play uses the existing single affinity increment.
- Collected story cards open a read-only replay. Locked cards stay inert. Escape, close button and keyboard focus return work. Original eight texts and collection progress are unchanged.
- Decoration rows separate state (“已摆出 · 四家店” / “已收起”) from action (“收起” / “摆出”), describe location, and link back to the shop scene. Existing global four-shop behavior remains. Balloon, cat ornament and plant are larger; plant is inset from the edge.
- Zombie training labels follow the current CEO's existing attack/ultimate names. Four shared training levels, costs, formulas and battle mechanics are unchanged.

## Verification

Workspace evidence is under `browser-test/` outside the repository:

- `spatial-final/results.json`: 9 actual Chromium mobile browser cases; all six new pets and original dog on the main entry, plus cat/alpaca on the standalone entry. Actual UI actions, movement, furniture clearance, completed return, repeated clicks/call/pet, selected-instance isolation, coins unchanged and save/reload checked. Seven full WebM recordings with readable species filenames. Captured against spatial commit `e500b96`; the integrated candidate retains identical `companions.js`.
- `preview/pet/accept2/test_spatial_companions.js`: 25 real-manifest behavior cases passed, including blocked routes, layout/pause/reload cleanup and distinct species actions.
- `test_companion_runtime.js`: 21 synthetic pairs and existing growth/source-frame/autonomous-profile checks passed. Synthetic pair fixtures are not presented as real-device tests.
- Original dog engine suite: 401 passed in this work session; engine source is unchanged.
- `decor-ceo-output/results.json`: 64 decoration cases (8 decorations × 4 shops × 2 entries) and 10 CEO view transitions (4 roles plus return to 77 × 2 widths), total 74. Decoration UI actions show actual changed canvas pixels; hiding restores the canvas interior. Fractional CSS canvas bottom/right border is excluded from exact restoration comparison. Save-failure rollback, unchanged coins/base rate and 320/393px overflow checks passed.
- `story-night-output/results.json`: all 6 integrated story cases passed (2 entries × partial/empty/full collections at 320/375/393px). Original text, locked/invalid guards, keyboard/focus, read-only state and reload preservation checked.
- `test_pet_portal_regressions.js`: all 4 focused migration/storage/floor/cache groups passed.
- `skill-smoke-spatial/` and `skill-smoke-night/`: startup browser smoke captures.
- Root formal version, economy modules, dog engine, zombie core and source art have no diff from published main. Changed paths are exclusively `preview/`.

## Remaining work and limits

All eight story illustrations are still missing. `STORY_CARD_ART_GAPS.md` contains original texts and per-card scene briefs. Replay currently shows original text without unrelated placeholder art. This is a reviewable text/interaction candidate, not a claim that illustrated stories are complete.

New species use their existing prototype frame packs. Alpaca water is an independent visible effect; no dedicated mouth-spit animation exists in its supplied art. No sprite stretching is used. Furniture/path avoidance is checked; new pet-to-pet collision avoidance is not claimed.

Tests use desktop Chromium with mobile viewports, not physical phones. Earlier WebKit 18 571/572 baseline uncertainty and unreviewed historical attachments remain unresolved. No new claim is made about those limits.
