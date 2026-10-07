---
name: game-feel
description: "Add \"juice\" and game feel that makes actions satisfying — screen shake, hit-stop/freeze frames, tweened/eased motion, squash & stretch, knockback, and layered audio-visual feedback — as engine-neutral techniques that pair with the detected engine's tween, particle, and camera APIs. Use when the user mentions game feel, juice, \"make it feel good/punchy\", screen shake, hit stop, screen freeze, easing, squash and stretch, impact frames, or feedback/polish on hits, jumps, pickups, and deaths."
---

> Source: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/tree/main/skills/disciplines/game-feel — License: Apache-2.0. Imported 2026-10-04. `references/feedback-recipes.md` inlined at the end. Related skills named below (camera-systems, godot-animation, etc.) live in the same source repo and may not be installed.

# Game feel (juice)

The difference between a mechanic that *works* and one that feels *good* is feedback: the
layered, slightly-exaggerated response an action provokes. This skill covers the engine-
neutral techniques — screen shake, hit-stop, easing, squash & stretch, knockback, and stacked
feedback — and tells you how to apply them without burying the underlying simulation. It
**adds polish on top of** an existing mechanic; it does not implement the mechanic.

## When to use

- Use when an action (hit, jump, dash, pickup, death, button press) is mechanically correct
  but feels weak, weightless, or unsatisfying, and you want it to feel responsive and punchy.
- Use to add screen shake, hit-stop/freeze frames, eased motion, squash & stretch, knockback,
  flashes, or to layer multiple feedback channels onto one event.
- Use to decide *how much* juice is enough and where it crosses into noise.

**When *not* to use:** for the raw controller math (jump height, coyote time) use the
`platformer` genre and the engine movement skill. For camera *follow/deadzone/orbit* framing
use `camera-systems` (this skill only triggers the shake). For mixing, ducking, and adaptive
music use `audio-design`. For shader-based dissolves/flashes use `shader-programming` and the
engine shader skill. For the concrete tween/particle node APIs, use the engine animation skill
(`godot-animation`, `unity-animation`).

## Core principle: feedback is layered and exaggerated

One satisfying hit is usually **5–8 tiny responses firing together** within ~100 ms: a sound,
a particle burst, a brief hit-stop, a flash, a knockback, a small screen shake, and a number
popping up. Each is cheap; stacked, they read as "impact". Two rules keep it from becoming a
mess: **(1)** exaggerate *briefly* and return to rest (juice is transient, not a new resting
state); **(2)** scale juice to event importance — a footstep is not a boss death.

## Core workflow

1. **Confirm the event hooks exist.** Juice attaches to discrete events: `on_hit`, `on_land`,
   `on_pickup`, `on_death`, `on_fire`. If the mechanic doesn't emit these, add them first.
2. **Pick feedback channels per event** from the menu (sound, particles, shake, hit-stop,
   flash, knockback, tween, number pop). Start with 2–3; add until it reads, then stop.
3. **Make motion eased, not linear.** Route scale/position/UI changes through a tween with an
   ease (overshoot for "pop", ease-out for "settle"). Linear motion feels robotic.
4. **Reserve hit-stop and shake for impact.** They are the strongest, most abusable tools —
   short durations, scaled to importance, and never on routine actions.
5. **Keep feedback off the critical simulation.** Shake moves the *camera/visual*, not the
   body; hit-stop uses time scale or a real-time pause, not a gameplay-logic stall.
6. **Tune by importance tiers.** Define small/medium/large feedback presets and assign events
   to a tier, so the whole game's juice stays consistent and proportional.
7. **Verify by playing and watching.** Trigger the event repeatedly; confirm the feedback
   fires, returns to rest, and is not nauseating or input-blocking. Report what you observed
   (does shake decay? does input still register during hit-stop?).

## Patterns

### 1. Screen shake by decaying "trauma" (smooth, not a random jitter)

```gdscript
# Godot 4.7. Store trauma 0..1; shake = trauma^2 so small hits barely move, big hits punch.
# Drives a Camera2D OFFSET (the visual), never the player body. Decays every frame.
@export var decay := 1.2          # trauma lost per second
@export var max_offset := Vector2(12, 8)
@export var max_roll := 0.1       # radians
var trauma := 0.0
var _t := 0.0

func add_trauma(amount: float) -> void:
    trauma = clampf(trauma + amount, 0.0, 1.0)   # hits ADD; they don't reset

func _process(dt: float) -> void:
    if trauma <= 0.0: return
    trauma = maxf(trauma - decay * dt, 0.0)
    var shake := trauma * trauma                  # quadratic: gentle low, sharp high
    _t += dt * 30.0
    # Smooth pseudo-random via sampled noise/sin, NOT rand each frame (that buzzes).
    offset = Vector2(max_offset.x * shake * sin(_t * 1.7),
                     max_offset.y * shake * sin(_t * 2.3))
    rotation = max_roll * shake * sin(_t * 1.1)
# Unity 6.3 LTS: identical model on a CinemachineCamera via CinemachineBasicMultiChannelPerlin
# (set AmplitudeGain/FrequencyGain from trauma^2) — see camera-systems.
```

### 2. Hit-stop / freeze frame (sell impact by briefly stopping time)

```gdscript
# Godot 4.7. Drop time scale, then restore after a REAL-TIME delay (unaffected by time_scale).
func hit_stop(duration := 0.08, scale := 0.05) -> void:
    Engine.time_scale = scale
    # 4th arg ignore_time_scale=true → the timer still fires while the game is frozen.
    await get_tree().create_timer(duration, true, false, true).timeout
    Engine.time_scale = 1.0
```

```csharp
// Unity 6.3 LTS (C#). WaitForSecondsRealtime ignores Time.timeScale, so the timer still elapses.
IEnumerator HitStop(float duration = 0.08f, float scale = 0.05f) {
    Time.timeScale = scale;
    yield return new WaitForSecondsRealtime(duration);
    Time.timeScale = 1f;            // RIGHT: real-time wait. WRONG: WaitForSeconds (never resumes at scale 0)
}
```

### 3. Squash & stretch + overshoot via an eased tween (the "pop")

```gdscript
# Godot 4.7. Conserve volume: stretch one axis, squash the other, then spring back with overshoot.
func pop(node: Node2D) -> void:
    node.scale = Vector2(1.3, 0.7)                       # instant squash on the event
    var tw := create_tween()
    tw.tween_property(node, "scale", Vector2.ONE, 0.18) \
      .set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)   # BACK = overshoots past 1, settles
# RIGHT: ease back (TRANS_BACK/ELASTIC) for life. WRONG: linear tween → mechanical, dead.
```

### 4. A feedback bundle scaled by importance (keep juice proportional)

```gdscript
# One call per event; the tier decides intensity so the whole game stays consistent.
func feedback(event_pos: Vector2, tier: String) -> void:
    match tier:
        "small":  AudioBus.play("tick");  Camera.add_trauma(0.15)
        "medium": AudioBus.play("hit");   Camera.add_trauma(0.4);  hit_stop(0.05); spawn_particles(event_pos, 6)
        "large":  AudioBus.play("boom");  Camera.add_trauma(0.8);  hit_stop(0.12); spawn_particles(event_pos, 30); flash_white(0.06)
```

## Pitfalls

- **Shaking the player/body instead of the camera offset** desyncs collision and aim. Shake
  the camera (or a visual pivot), never the simulated transform.
- **Random offset every frame** buzzes like static. Drive shake from sampled noise/sin and a
  decaying trauma value so it's smooth and self-ending.
- **Hit-stop with `WaitForSeconds` / a scaled timer** never resumes (at time scale 0 the timer
  never advances). Use a real-time wait (`WaitForSecondsRealtime`, or Godot's
  `ignore_time_scale` timer).
- **Hit-stop on every frame of a held attack** locks the game. Trigger it once per impact.
- **Linear tweens everywhere** feel robotic. Ease almost everything; reserve overshoot
  (BACK/ELASTIC) for "pop" and ease-out for "settle".
- **Permanent exaggeration** (scale never returns, shake never decays) becomes the new normal
  and stops reading as feedback. Juice must return to rest.
- **Over-juicing routine actions** (full shake + hit-stop on every footstep) causes nausea and
  hides real impacts. Scale to importance; add a "reduce screen shake"/"reduce flashing"
  accessibility option.
- **Feedback that blocks input** (long freeze, un-cancelable animation) hurts responsiveness.
  Keep juice short and let input buffer through it.

## References

- For the trauma-shake math, easing-curve cheat sheet (which ease for pop vs settle), knockback
  + flash + number-pop recipes, importance-tier presets, and per-engine tween/particle bindings,
  see the inlined `feedback-recipes.md` section at the end of this file.

## Related skills

- `camera-systems` — owns camera follow/deadzone/orbit; this skill only feeds it shake trauma.
- `godot-animation`, `unity-animation` — concrete tween/AnimationPlayer/particle APIs juice rides on.
- `audio-design` — the sound layer of every feedback bundle; ducking and SFX variation.
- `physics-tuning` — knockback forces and the timestep juice must not destabilize.
- `platformer`, `fps-shooter`, `roguelike` — genres whose moment-to-moment feel this elevates.

---

## Inlined reference: feedback-recipes.md

# Feedback recipes — depth for `game-feel`

Detail the `game-feel` body defers here: the shake math, easing cheat sheet, the rest of the
feedback menu (knockback, flash, number pop, freeze), importance-tier presets, and the
per-engine bindings for tweens and particles. All snippets target **Godot 4.7** and **Unity 6.3 LTS**.

## 1. The trauma model (why shake feels good)

Track a single `trauma` value in `[0, 1]`. Events **add** trauma; it **decays** linearly each
frame. The actual shake amount is `trauma^2` (or `trauma^3`) so:

- small/frequent events barely nudge the screen (low trauma, squared → tiny),
- big events punch hard (high trauma, squared → near full),
- shake **always ends** on its own because trauma decays to 0.

Offset and rotation are `max_* * shake * noise(t)`. Sample a noise function or summed sines
across time — never a fresh `rand()` per frame, which produces a harsh buzz instead of a shake.

```gdscript
# 1D value-noise-ish sampler without an addon: layered sines at incommensurate rates.
func _shake_axis(seed: float, t: float) -> float:
    return 0.6 * sin(t * 11.0 + seed) + 0.4 * sin(t * 23.0 + seed * 2.0)
```

Tunable starting points: `max_offset = (8..16, 6..10) px`, `max_roll = 0.05..0.12 rad`,
`decay = 1.0..1.5` trauma/sec, per-hit trauma `0.15` (light) → `0.8` (heavy).

## 2. Easing cheat sheet — which curve for which job

| Goal | Ease | Godot `Tween` | Notes |
|------|------|---------------|-------|
| UI/element "pop" in | overshoot | `TRANS_BACK`, `EASE_OUT` | shoots past target, settles back |
| Bouncy, lively land | bounce/elastic | `TRANS_ELASTIC`/`TRANS_BOUNCE`, `EASE_OUT` | use sparingly; reads as cartoonish |
| Settle / decelerate | ease-out | `TRANS_CUBIC`/`TRANS_QUAD`, `EASE_OUT` | the default for "comes to rest" |
| Anticipation / wind-up | ease-in | `TRANS_CUBIC`, `EASE_IN` | slow start before a fast action |
| Smooth A→B both ends | ease-in-out | `TRANS_SINE`, `EASE_IN_OUT` | camera moves, menu slides |

Unity 6.3 LTS has no built-in tween library; options in order of preference: `Vector3.SmoothDamp`
for spring-like follow, `Mathf.SmoothStep`/hand-rolled ease in a coroutine, Animator curves,
or a third-party tween package if the project already uses one. Keep the *curve choice* the
same regardless of tool.

```csharp
// Unity 6.3 LTS: a minimal eased scale "pop" in a coroutine (no external deps).
IEnumerator Pop(Transform t, float dur = 0.18f) {
    t.localScale = new Vector3(1.3f, 0.7f, 1f);            // squash on the event
    for (float e = 0; e < dur; e += Time.deltaTime) {
        float k = e / dur;
        float back = 1f + 2.7f * Mathf.Pow(1 - k, 2) * (k - 0); // overshoot-ish
        t.localScale = Vector3.Lerp(t.localScale, Vector3.one, k * k);
        yield return null;
    }
    t.localScale = Vector3.one;
}
```

## 3. The rest of the feedback menu

- **Flash:** tint the sprite/material white for 1–3 frames on hit (`modulate`/material color),
  then tween back. Cheap, hugely legible.
- **Knockback:** apply an impulse away from the hit normal, clamped and short; let
  `physics-tuning` own stability. Pair with brief control lockout, not a long one.
- **Number/text pop:** spawn a damage number that rises, fades, and eases out; randomize the
  horizontal drift so stacked hits fan out.
- **Particles:** a short burst at the contact point (sparks, dust, debris). Pool them
  (`performance-optimization`) — do not instance-and-free per hit.
- **Freeze frame:** the hit-stop in the body; scale duration to importance (0.04 s light →
  0.15 s heavy). Optionally freeze only the attacker+target, not the whole world.
- **Anticipation & follow-through:** a tiny wind-up before a big action and a settle after read
  as weight; this is animation, not code (engine animation skill).
- **Chromatic/▒vignette/zoom punch:** post-process nudges for big moments; keep brief.

## 4. Importance tiers (keep the whole game proportional)

Define three presets and assign every juicy event to one. This is what stops a game from
feeling either dead (under-juiced) or exhausting (everything maxed).

| Tier | Trauma | Hit-stop | Particles | Extra | Example events |
|------|:------:|:--------:|:---------:|-------|----------------|
| small | 0.10–0.20 | none | 0–4 | tick SFX | footstep, UI hover, coin |
| medium | 0.30–0.50 | 0.04–0.06 s | 6–12 | flash | normal hit, jump-land, pickup |
| large | 0.70–1.00 | 0.10–0.15 s | 20–40 | flash + zoom + number | crit, boss hit, death, explosion |

## 5. Accessibility (ship these toggles)

- **Reduce screen shake** (scale trauma output by a 0–100% setting, default ~60–80%).
- **Reduce/disable flashing** (photosensitivity) — replace white flashes with a static tint.
- **Reduce camera motion** — cut shake roll and zoom punches.

These pair with `game-ui-ux` (settings menu) and `input-systems` (accessibility section).

## 6. Per-engine binding summary

- **Godot 4.7:** `create_tween()` + `tween_property().set_trans().set_ease()`; `GPUParticles2D/3D`
  one-shot; `Engine.time_scale` + `ignore_time_scale` timer; shake on `Camera2D.offset`.
- **Unity 6.3 LTS:** coroutines + `SmoothDamp`/curves (or a tween package); `ParticleSystem.Play()`;
  `Time.timeScale` + `WaitForSecondsRealtime`; shake via `CinemachineBasicMultiChannelPerlin`
  amplitude/frequency driven by `trauma^2` (see `camera-systems`).
- **Web (Phaser/Pixi/three):** tween via the engine/library tween; `this.cameras.main.shake()`
  in Phaser; `requestAnimationFrame`-driven eases elsewhere.
