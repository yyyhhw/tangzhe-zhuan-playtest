---
name: level-design
description: "Use when planning or reviewing levels/stages: deriving player metrics, blockout before art, critical path and gating, pacing as a tension/rest curve, teach-then-test difficulty, and encounter design."
---

> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/d4b0e35550c55ae70bdfcab4ef5a0e94610438a9/skills/disciplines/level-design — License: Apache-2.0. Imported 2026-10-04. `references/pacing-and-flow.md` inlined at the end. Related skills named in the body (godot-*, unity-*, rpg, etc.) live in the same source repo and are mostly not installed.

# Level design

A level is a **sequence of intentional experiences** delivered through space.
Good level design is a *process*: define the metrics movement is built on, block
out geometry with primitives, play it, then dress it — never the reverse. This
skill is the engine-neutral practice; use `godot-tilemap`/`unity-tilemap-2d` to
lay out 2D grids and gridmaps for 3D.

## When to use

- Use to plan a level's structure: critical path, pacing, gating, encounters,
  and where the player learns vs is tested.
- Use the **blockout → test → iterate → dress** workflow to build a level that
  plays well before any art exists.
- Use to derive level **metrics** from the character's movement so geometry is
  reachable and fair.

**When *not* to use:** to *generate* levels algorithmically, use `procedural-gen`
(authored and procedural design are complementary). For the engine's tile/grid
painting tools, use `godot-tilemap` / `unity-tilemap-2d`. For the movement
abilities the metrics come from, that's the engine movement skill + `input-systems`.

## Core workflow

1. **Derive metrics first.** Measure the character: max jump height and distance,
   run speed, reach, camera range. Every gap, ledge, and corridor is sized in
   these units. Lock them before building geometry.
2. **Blockout (whitebox/greybox).** Build the whole level from untextured
   primitives at correct scale. Validate flow, sightlines, and reachability while
   changes are cheap. No art yet.
3. **Define the critical path** (start → goal) and the **golden path** you expect
   most players to take. Layer optional/secret paths off it.
4. **Pace the experience.** Alternate tension and rest in a deliberate curve;
   don't run combat-combat-combat. Give the player room to breathe and to
   anticipate.
5. **Teach, then test.** Introduce each mechanic in a safe space, let the player
   practice, then test it under pressure. Difficulty rises in a sawtooth, not a
   straight line.
6. **Gate with intent.** Use locks/keys, abilities, and one-way drops to control
   order and pacing; guide with light, lines, and landmarks rather than walls.
7. **Playtest and iterate.** Watch real players: where do they get lost, stuck,
   bored, or killed unfairly? Fix the blockout; only dress when it plays well.

## Patterns

### 1. Player metrics drive every dimension

```gdscript
# Measure the character ONCE, then size geometry in these units. If the jump
# changes, gaps must be re-derived — never eyeball reachability.
const RUN_SPEED      := 240.0   # px/s (or m/s in 3D)
const MAX_JUMP_H     := 96.0    # peak height of a full jump
const MAX_JUMP_DIST  := 200.0   # horizontal distance of a running jump
const SAFE_GAP       := MAX_JUMP_DIST * 0.7   # comfortable, not pixel-perfect
const HARD_GAP       := MAX_JUMP_DIST * 0.95  # a deliberate skill check
# Build platforms so required jumps use SAFE_GAP; reserve HARD_GAP for optional reward.
```

A reachable level falls out of honest metrics. A platform placed `MAX_JUMP_DIST +
1` away is impossible; one at `SAFE_GAP` is fair. Keep these constants beside the
level data so designers and code agree.

### 2. Encounter / pacing as data (a tension timeline)

```gdscript
# Author the level as a sequence of beats with an intended intensity (0..1).
# This makes the pacing curve explicit and reviewable before you build rooms.
const BEATS := [
    { "room": "entry",      "type": "teach",   "intensity": 0.1 },
    { "room": "hall_1",     "type": "combat",  "intensity": 0.5 },
    { "room": "vista",      "type": "rest",    "intensity": 0.1 },  # breather + reward
    { "room": "gauntlet",   "type": "combat",  "intensity": 0.8 },
    { "room": "save_room",  "type": "rest",    "intensity": 0.2 },  # before the boss
    { "room": "boss",       "type": "climax",  "intensity": 1.0 },
]
# Read the intensity column top-to-bottom: it should rise overall but dip for rests
# (a sawtooth), never flatline high. Drive spawns/music intensity from this.
```

### 3. Gating and the critical path (a small graph)

```gdscript
# Model the level as rooms + gated connections. Validate that the goal is
# reachable with the keys/abilities the player can actually obtain in order.
const ROOMS := {
    "entry":   { "exits": [ { "to": "hall_1" } ] },
    "hall_1":  { "exits": [ { "to": "vista", "needs": "double_jump" },
                            { "to": "side_room" } ] },           # optional branch
    "side_room": { "exits": [ { "to": "hall_1" } ], "grants": "double_jump" },
    "vista":   { "exits": [ { "to": "boss", "needs": "red_key" } ] },
}
# Validation (do this!): from "entry", can the player reach "boss" given that
# "double_jump" is granted in "side_room" before "vista" requires it? A flood
# fill that only traverses an exit when its `needs` is already satisfiable
# proves the critical path isn't soft-locked.
```

## Pitfalls

- **Dressing before it plays.** Detailing a blockout you haven't validated wastes
  the most expensive work on a layout you'll change. Greybox and test first.
- **Geometry that ignores metrics**: gaps the jump can't clear, ledges below
  reach, corridors narrower than the camera needs. Size everything in player units.
- **Flat pacing.** Wall-to-wall combat (or wall-to-wall calm) numbs the player.
  Alternate tension and rest; place a breather and a save before the climax.
- **Testing a mechanic before teaching it.** Players meet a hazard for the first
  time in a lethal spot. Introduce safely, let them practice, then test.
- **Soft-locks and dead ends.** A gate needs an ability/key obtainable only past
  the gate. Validate the critical path's key/ability order, not just connectivity.
- **No readability / guidance.** Players get lost when nothing draws the eye. Use
  light, leading lines, color, and landmarks to point toward the path.
- **One-way drops with no signposting** strand or surprise players. Telegraph
  irreversible moves.
- **Confusing procedural with authored.** Generation gives variety, not
  authored pacing. Use `procedural-gen` for variety; hand-author for intent.

## References

- `references/pacing-and-flow.md` — the difficulty/tension curve in depth,
  teaching-loop design (introduce→develop→twist→test), readability and guidance
  techniques, 2D vs 3D layout considerations, and a blockout review checklist.

## Related skills

- `godot-tilemap`, `unity-tilemap-2d` — paint 2D level grids; gridmaps for 3D.
- `procedural-gen` — generate variety to complement authored structure.
- `game-ai` — encounter enemies that navigate the space you build.
- `platformer`, `puzzle`, `roguelike` — genres that compose this skill.

---

## Inlined reference: pacing-and-flow.md

# Pacing, flow, teaching, and guidance

Geometry is the medium; the goal is a felt rhythm. This reference goes deeper on
the curve, the teaching loop, guiding the player, and reviewing a blockout.

## The difficulty / tension curve

Plot intended intensity against progress. Two principles:

- **Overall rise with local dips.** Difficulty and tension trend upward toward a
  climax, but in a *sawtooth*: spikes (combat, platforming gauntlets, bosses)
  separated by rests (exploration, story, safe rooms). A monotone high flatlines
  the player's stress response; a monotone low bores them.
- **Rest before climax.** Place a clear breather — a save point, a vista, a
  resource cache — right before the hardest beat. The calm sharpens the spike.

A useful rhythm: **introduce → build → peak → release → (repeat, higher)**. Each
cycle's peak exceeds the last; each release sits a little above the previous
baseline.

## The teaching loop (mechanic introduction)

Players learn by doing, in escalating safety-to-stakes:

1. **Introduce** the mechanic in isolation, where failure is harmless (a spike
   you can see and step over; an enemy that can't yet hurt you).
2. **Develop** it — combine with movement or a second element so the player
   practices deliberately.
3. **Twist** — change context so they apply the idea, not a memorized motion.
4. **Test** — under time/health pressure, where the skill genuinely matters.

This is why the first room is calm and the boss is last: the level *is* a lesson
plan. New mechanics meet the player before, never during, a lethal test.

## The critical path, golden path, and branches

- **Critical path**: the minimal route from start to goal. Must always be
  solvable with abilities/keys obtainable in order (validate it).
- **Golden path**: the route most players will actually take. Design pacing along
  this, not just the shortest line.
- **Branches**: optional loops for exploration and reward. Keep them short enough
  to rejoin the golden path without losing momentum; reward the detour.

Loops and shortcuts (unlock a door back to an earlier hub) reduce backtracking
fatigue and make the space feel coherent.

## Gating tools

- **Locks and keys** — explicit, readable order control.
- **Ability gates** — a chasm needs the double-jump found later; revisiting opens
  it (the Metroidvania pattern). Validate the acquisition order.
- **One-way drops / collapsing paths** — enforce direction; telegraph them so the
  player chooses knowingly.
- **Soft gates** — enemies, environmental hazards, or difficulty that suggest
  "not yet" without a hard wall.

## Readability and guidance (lead without walls)

Players follow attention, not signs. Direct the eye with:

- **Light and contrast** — the bright doorway reads as "go here"; shadows read as
  optional or dangerous.
- **Leading lines** — architecture, rails, and paths that point toward the
  objective.
- **Landmarks** — a tall, unique silhouette visible from afar orients the player
  across the whole level.
- **Color and material** — a consistent color for "interactive/exit" teaches the
  player to scan for it (climbable ledges painted the same hue, etc.).
- **Framing** — compose vistas so the next goal is visible from a high point
  before the player descends to it.

When players get lost in playtests, the fix is usually guidance (a sightline, a
light), not a wall.

## 2D vs 3D considerations

- **2D**: think in the tile grid and the camera window. The player sees a fixed
  slice; telegraph off-screen threats (audio, approach time) so hits feel fair.
  Sightlines and reachable platform spacing dominate.
- **3D**: think in sightlines, verticality, and navigation. Players can get lost
  in three dimensions; landmarks and framed vistas matter more. Mind the camera —
  tight interiors and the player's view cone change what's "reachable" perceptually.

## Blockout review checklist

- Critical path solvable with the keys/abilities available *in order* (no
  soft-lock).
- Every required jump/traversal within metrics (`SAFE_GAP`, reach, camera).
- Pacing reads as a rising sawtooth; a rest precedes each major spike.
- Each mechanic is introduced safely before it's tested.
- The eye is guided toward the path (light/lines/landmarks); test for "lost".
- Optional content rewards the detour and rejoins smoothly.
- Plays well as untextured geometry — dressing would not rescue a bad layout.
- Validated with players, not just the designer.
