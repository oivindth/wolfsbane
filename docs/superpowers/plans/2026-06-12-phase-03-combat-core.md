# Phase 3: Combat Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real combat: a 3-hit light combo + heavy attack with stamina costs, dodge i-frames, the three signs (Igni / Aard / Quen) with cooldowns and particle VFX, a pack of three AI wolves that chase / circle / bite, real lock-on targeting, a Svelte HUD (health, stamina, sign selector), and player death + respawn.

**Architecture:** All combat rules (health, stamina, damage, combo chaining, sign cooldowns, wolf FSM, target selection, hit arcs) are pure TypeScript in `src/combat/` and `src/actors/wolfBrain.ts` — no Babylon imports, fully Vitest-covered. Babylon-side actors (`Wolf`, extended `Player`) consume those modules. `game.ts` stays the composition root: it wires player↔wolf damage through callbacks, owns the single `LockOn` instance (resolves the phase-2 dual-lockTarget seam), and writes HUD state to the Svelte store each frame. Systems announce outcomes on the event bus (`enemy:killed`, `player:died`) for later phases.

**Tech Stack:** Babylon.js 9.11 (`PhysicsCharacterController`, `ParticleSystem`, `AnimationGroup`), Svelte 5 runes, Vitest, Biome, pnpm.

**Design note (spec deviation, intentional):** the spec's stack section mentions "melee shape casts" via Havok. This plan uses analytic planar arc tests (`inMeleeArc`) instead: deterministic, unit-testable, and indistinguishable in feel at this enemy size/count. Havok remains in charge of movement, ground support, and camera collision.

**Known limitation (accepted, do not "fix" in review):** Babylon `PhysicsCharacterController`s are kinematic shape queries — they collide with physics bodies but not with each other, so the player can walk through wolves. Wolves circle at ~3 m and lunge, so overlap is rare; soft separation can come with the boss work in phase 6 if playtesting demands it.

---

## Verified facts (do not re-derive)

**Wolf asset** — Quaternius "Wolf", CC0, from Poly Pizza (model page `https://poly.pizza/m/P1gU3Qkr9r`).
Direct download: `https://static.poly.pizza/f1d12388-e39b-4157-b32a-646a1d089fc4.glb` (986,712 bytes).
Animation clips verified by parsing the GLB JSON chunk (name: duration): `Attack`: 1.33s, `Death`: 1.04s, `Gallop`: 0.54s, `Gallop_Jump`: 0.92s, `Idle`: 3.33s, `Idle_2`: 3.33s, `Idle_2_HeadLow`: 4.0s, `Idle_HitReact_Left`: 0.67s, `Idle_HitReact_Right`: 0.67s, `Jump_ToIdle`: 1.33s, `Walk`: 1.04s, `Eating`: 2.5s. The GLB **also** contains duplicates of every clip prefixed `AnimalArmature|` — always use the plain names.

**Knight clips used this phase** (names + durations verified against `public/assets/characters/Knight.glb`): `1H_Melee_Attack_Slice_Diagonal`: 1.0s, `1H_Melee_Attack_Slice_Horizontal`: 1.067s, `1H_Melee_Attack_Stab`: 1.6s, `1H_Melee_Attack_Chop`: 1.067s, `Spellcast_Shoot`: 0.933s, `Dodge_Forward`: 0.4s, `Hit_A`: 0.667s, `Death_A`: 0.8s.

**Babylon 9.11 APIs verified against installed typings:**
- `PhysicsCharacterController` has `setPosition(position: Vector3): void` (used for respawn) alongside the known `checkSupport` / `setVelocity` / `integrate` / `getPosition`.
- `ParticleSystem` has `createSphereEmitter(radius, radiusRange)`, `createConeEmitter(radius, angle)`, `BLENDMODE_ONEONE`, `targetStopDuration`, `disposeOnStop`.
- `DynamicTexture.getContext()` returns Babylon's `ICanvasRenderingContext`; cast to `CanvasRenderingContext2D` for gradient APIs.

**Known environment gotchas (from phases 1–2):**
- Headless Playwright cannot screenshot the WebGL canvas reliably (~1 FPS software GL). Verify via `pnpm test` / `pnpm check` / `pnpm build`; visual checks are listed for the final manual playtest instead.
- If you start `pnpm dev`, kill it before finishing your task. Never leave orphan servers.
- Asset URLs must be prefixed `import.meta.env.BASE_URL` (Pages serves under `/wolfsbane/`).
- `AnimationController.dispose()` owns and disposes all AnimationGroups; actors own their controller, meshes, and physics objects, and `game.ts` disposes actors **before** `scene.dispose()`.
- `PhysicsCharacterController.dispose()` must be guarded by `if (this.mesh.getScene().getPhysicsEngine())` (HMR teardown).

**Tuning constants chosen in this plan** (single source of truth — keep these values):

| Constant | Value |
|---|---|
| Player max health / stamina | 100 / 100 |
| Stamina regen | 25/s after 0.7s delay |
| Costs: roll / light / heavy / sign | 15 / 12 / 25 / 20 |
| Sprint drain | 8/s |
| Light combo damage | 12, 12, 18 |
| Heavy damage | 25 |
| Wolf: HP / bite damage | 40 / 10 |
| Igni: range / half-arc / damage / cooldown | 5 / π/4 / 20 / 6s |
| Aard: radius / damage / cooldown | 4 / 5 + stagger / 5s |
| Quen: absorb / duration / cooldown | 30 / 30s / 10s |
| Lock-on: acquire / drop range | 15 / 20 |

---

## File structure

**New files:**

| File | Responsibility |
|---|---|
| `src/combat/health.ts` (+test) | HP pool with clamped damage/heal |
| `src/combat/stamina.ts` (+test) | Stamina pool, spend/drain/regen-with-delay |
| `src/combat/attacks.ts` | Melee attack data: damage, costs, hit timing, combo chain |
| `src/combat/hitArc.ts` (+test) | Planar range + facing-arc hit test |
| `src/combat/meleeSequencer.ts` (+test) | Combo chaining, input buffering, damage-moment timing |
| `src/combat/signs.ts` (+test) | Sign selection, cooldowns, Quen shield |
| `src/combat/targeting.ts` (+test) | Nearest-target selection + `LockOn` single owner |
| `src/actors/wolfBrain.ts` (+test) | Wolf FSM: idle→chase→circle→attack→recover, stagger |
| `src/data/wolfAnimations.ts` (+test) | Wolf clip map (`WOLF_CLIPS`) |
| `src/actors/wolf.ts` | Babylon wolf actor: capsule controller, model, anims, damage |
| `src/combat/signEffects.ts` | Particle bursts (Igni/Aard) + Quen bubble mesh |
| `src/ui/Hud.svelte` | Bars, sign selector, death overlay |
| `public/assets/characters/Wolf.glb` + `QUATERNIUS_LICENSE.txt` | CC0 wolf asset |

**Modified:** `src/actors/animationStates.ts` (+test), `src/data/knightAnimations.ts` (+test), `src/core/input.ts` (+test), `src/actors/playerController.ts`, `src/core/events.ts`, `src/core/game.ts`, `src/world/testZone.ts`, `src/ui/hud.svelte.ts`, `src/App.svelte`, `README.md`, `public/assets/README.md`.

All tasks run on branch `feature/03-combat-core` (already created). Commands run from the repo root. After each task's tests pass, also run `pnpm check` before committing.

---

### Task 1: Health & stamina pools

**Files:**
- Create: `src/combat/health.ts`, `src/combat/stamina.ts`
- Test: `src/combat/health.test.ts`, `src/combat/stamina.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/combat/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Health } from "./health";

describe("Health", () => {
  it("starts full", () => {
    const h = new Health(100);
    expect(h.current).toBe(100);
    expect(h.isDead).toBe(false);
  });

  it("applies damage and reports the applied amount", () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.current).toBe(70);
  });

  it("clamps damage at zero and reports death", () => {
    const h = new Health(20);
    expect(h.damage(50)).toBe(20);
    expect(h.current).toBe(0);
    expect(h.isDead).toBe(true);
  });

  it("ignores negative damage", () => {
    const h = new Health(100);
    expect(h.damage(-10)).toBe(0);
    expect(h.current).toBe(100);
  });

  it("heals without exceeding max", () => {
    const h = new Health(100);
    h.damage(50);
    h.heal(80);
    expect(h.current).toBe(100);
  });

  it("resets to full", () => {
    const h = new Health(100);
    h.damage(100);
    h.reset();
    expect(h.current).toBe(100);
    expect(h.isDead).toBe(false);
  });
});
```

`src/combat/stamina.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { Stamina } from "./stamina";

describe("Stamina", () => {
  it("spends when affordable", () => {
    const s = new Stamina(100);
    expect(s.trySpend(30)).toBe(true);
    expect(s.current).toBe(70);
  });

  it("refuses to overspend and leaves the pool untouched", () => {
    const s = new Stamina(100);
    s.trySpend(95);
    expect(s.trySpend(10)).toBe(false);
    expect(s.current).toBe(5);
  });

  it("does not regenerate during the post-spend delay", () => {
    const s = new Stamina(100);
    s.trySpend(50);
    s.update(0.5); // < 0.7s delay
    expect(s.current).toBe(50);
  });

  it("regenerates 25/s after the delay", () => {
    const s = new Stamina(100);
    s.trySpend(50);
    s.update(0.7); // delay elapses, no regen yet this tick boundary
    s.update(1);
    expect(s.current).toBeCloseTo(75);
  });

  it("never regenerates past max", () => {
    const s = new Stamina(100);
    s.trySpend(10);
    s.update(10);
    expect(s.current).toBe(100);
  });

  it("drains continuously and blocks regen while draining", () => {
    const s = new Stamina(100);
    expect(s.drain(8, 1)).toBe(true);
    expect(s.current).toBeCloseTo(92);
    s.update(0.3); // still inside delay after drain
    expect(s.current).toBeCloseTo(92);
  });

  it("drain reports empty pool", () => {
    const s = new Stamina(100);
    s.drain(100, 1);
    expect(s.current).toBe(0);
    expect(s.drain(8, 0.016)).toBe(false);
  });

  it("resets to full and regen-ready", () => {
    const s = new Stamina(100);
    s.trySpend(80);
    s.reset();
    expect(s.current).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./health` / `./stamina`.

- [ ] **Step 3: Implement**

`src/combat/health.ts`:

```ts
/** Hit-point pool with clamped damage and healing. Pure; no Babylon imports. */
export class Health {
  current: number;

  constructor(readonly max: number) {
    this.current = max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  /** Apply damage; returns the amount actually applied after clamping. */
  damage(amount: number): number {
    const applied = Math.min(this.current, Math.max(0, amount));
    this.current -= applied;
    return applied;
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + Math.max(0, amount));
  }

  reset(): void {
    this.current = this.max;
  }
}
```

`src/combat/stamina.ts`:

```ts
const REGEN_PER_SECOND = 25;
const REGEN_DELAY_SECONDS = 0.7;

/** Stamina pool: spending or draining pauses regeneration briefly. Pure. */
export class Stamina {
  current: number;
  private sinceSpend = REGEN_DELAY_SECONDS;

  constructor(readonly max: number) {
    this.current = max;
  }

  /** Spend if affordable; returns false (and spends nothing) otherwise. */
  trySpend(cost: number): boolean {
    if (cost > this.current) return false;
    this.current -= cost;
    this.sinceSpend = 0;
    return true;
  }

  /** Continuous drain (sprint). Returns false once the pool is empty. */
  drain(perSecond: number, dt: number): boolean {
    if (this.current <= 0) return false;
    this.current = Math.max(0, this.current - perSecond * dt);
    this.sinceSpend = 0;
    return this.current > 0;
  }

  /** Call once per frame before any spend/drain this frame. */
  update(dt: number): void {
    if (this.sinceSpend >= REGEN_DELAY_SECONDS) {
      this.current = Math.min(this.max, this.current + REGEN_PER_SECOND * dt);
    }
    this.sinceSpend += dt;
  }

  reset(): void {
    this.current = this.max;
    this.sinceSpend = REGEN_DELAY_SECONDS;
  }
}
```

(Note the `update` ordering: regen is checked *before* incrementing `sinceSpend`, so the tick where the delay elapses doesn't also regen — that's what the third test asserts.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS (all suites, including the 43 pre-existing tests).

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/combat/health.ts src/combat/health.test.ts src/combat/stamina.ts src/combat/stamina.test.ts
git commit -m "feat: add health and stamina pools for combat"
```

---

### Task 2: Animation states — combo, heavy, cast, reset

**Files:**
- Modify: `src/actors/animationStates.ts`, `src/data/knightAnimations.ts`
- Test: `src/actors/animationStates.test.ts`, `src/data/knightAnimations.test.ts` (extend existing)

- [ ] **Step 1: Write the failing tests** — append to `src/actors/animationStates.test.ts`:

```ts
describe("AnimStateMachine combat extensions", () => {
  it("hit interrupts every melee attack and cast, but not roll", () => {
    for (const state of ["attack", "attack2", "attack3", "heavy", "cast"] as const) {
      const sm = new AnimStateMachine();
      sm.trigger(state);
      expect(sm.trigger("hit")).toBe(true);
      expect(sm.current).toBe("hit");
    }
    const rolling = new AnimStateMachine();
    rolling.trigger("roll");
    expect(rolling.trigger("hit")).toBe(false);
    expect(rolling.current).toBe("roll");
  });

  it("chained attacks start after the previous one ends", () => {
    const sm = new AnimStateMachine();
    sm.trigger("attack");
    expect(sm.trigger("attack2")).toBe(false); // still mid-swing
    sm.onOneShotEnd();
    expect(sm.trigger("attack2")).toBe(true);
    expect(sm.current).toBe("attack2");
  });

  it("reset returns an active or dead machine to idle", () => {
    const sm = new AnimStateMachine();
    sm.trigger("death");
    sm.reset();
    expect(sm.current).toBe("idle");
    expect(sm.isDead).toBe(false);
    expect(sm.trigger("attack")).toBe(true);
  });
});

describe("isMeleeState", () => {
  it("identifies melee attack states only", () => {
    expect(isMeleeState("attack")).toBe(true);
    expect(isMeleeState("attack2")).toBe(true);
    expect(isMeleeState("attack3")).toBe(true);
    expect(isMeleeState("heavy")).toBe(true);
    expect(isMeleeState("cast")).toBe(false);
    expect(isMeleeState("roll")).toBe(false);
    expect(isMeleeState("idle")).toBe(false);
  });
});
```

Add `isMeleeState` to the existing import from `./animationStates` at the top of the file.

Also extend `ALL_STATES` in `src/data/knightAnimations.test.ts` with `"attack2", "attack3", "heavy", "cast"` (insert after `"attack"`), and add to the loop test:

```ts
expect(KNIGHT_CLIPS.heavy.loop).toBe(false);
expect(KNIGHT_CLIPS.cast.loop).toBe(false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `"attack2"` not assignable to `OneShotState`, `isMeleeState` not exported, `KNIGHT_CLIPS` missing keys.

- [ ] **Step 3: Implement** — in `src/actors/animationStates.ts`:

Replace the `OneShotState` type:

```ts
export type OneShotState =
  | "roll"
  | "attack"
  | "attack2"
  | "attack3"
  | "heavy"
  | "cast"
  | "hit"
  | "death";
```

Add below the type definitions:

```ts
const HIT_INTERRUPTS: ReadonlySet<OneShotState> = new Set([
  "attack",
  "attack2",
  "attack3",
  "heavy",
  "cast",
]);

/** True for states that swing a weapon (cast and roll are not melee). */
export function isMeleeState(state: AnimState): boolean {
  return (
    state === "attack" ||
    state === "attack2" ||
    state === "attack3" ||
    state === "heavy"
  );
}
```

In `AnimStateMachine.trigger`, replace the hit-interrupt branch:

```ts
    if (state === "hit" && this.oneShot !== null && HIT_INTERRUPTS.has(this.oneShot)) {
      this.oneShot = "hit";
      this.current = "hit";
      return true;
    }
```

Add a `reset` method to `AnimStateMachine`:

```ts
  /** Back to idle from any state, including death (used on respawn). */
  reset(): void {
    this.current = "idle";
    this.oneShot = null;
  }
```

In `src/data/knightAnimations.ts`, add the new entries to `KNIGHT_CLIPS` (after `attack`):

```ts
  attack2: { clip: "1H_Melee_Attack_Slice_Horizontal", loop: false, speed: 1.2 },
  attack3: { clip: "1H_Melee_Attack_Stab", loop: false, speed: 1.2 },
  heavy: { clip: "1H_Melee_Attack_Chop", loop: false, speed: 1 },
  cast: { clip: "Spellcast_Shoot", loop: false, speed: 1.2 },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/actors/animationStates.ts src/actors/animationStates.test.ts src/data/knightAnimations.ts src/data/knightAnimations.test.ts
git commit -m "feat: add combo, heavy and cast animation states"
```

---

### Task 3: Melee attack data & hit arc

**Files:**
- Create: `src/combat/attacks.ts`, `src/combat/hitArc.ts`
- Test: `src/combat/hitArc.test.ts`

- [ ] **Step 1: Write the failing test** — `src/combat/hitArc.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { inMeleeArc } from "./hitArc";

const QUARTER = Math.PI / 4;

describe("inMeleeArc", () => {
  it("hits a target straight ahead within range", () => {
    // yaw 0 faces +Z (left-handed convention from movement.ts)
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 0, z: 2 }, 2.2, QUARTER)).toBe(true);
  });

  it("misses beyond range", () => {
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 0, z: 3 }, 2.2, QUARTER)).toBe(false);
  });

  it("misses outside the arc", () => {
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 2, z: 0 }, 2.2, QUARTER)).toBe(false);
  });

  it("hits at the arc edge", () => {
    // 45° off-axis, half-arc 60°
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 1, z: 1 }, 2.2, Math.PI / 3)).toBe(true);
  });

  it("respects facing across the angle wrap", () => {
    // facing -Z (yaw = π), target behind the wrap at slightly-off -Z
    expect(inMeleeArc({ x: 0, z: 0 }, Math.PI, { x: -0.1, z: -1 }, 2.2, QUARTER)).toBe(true);
  });

  it("hits a coincident target", () => {
    expect(inMeleeArc({ x: 1, z: 1 }, 0, { x: 1, z: 1 }, 2.2, QUARTER)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./hitArc`.

- [ ] **Step 3: Implement**

`src/combat/hitArc.ts`:

```ts
export interface PlanarPoint {
  x: number;
  z: number;
}

/**
 * True when target is within range and inside the facing arc.
 * Pure; left-handed yaw measured from +Z toward +X (matches movement.ts).
 */
export function inMeleeArc(
  origin: PlanarPoint,
  yaw: number,
  target: PlanarPoint,
  range: number,
  halfArc: number,
): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  if (dist === 0) return true;
  let delta = (Math.atan2(dx, dz) - yaw) % (2 * Math.PI);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return Math.abs(delta) <= halfArc;
}
```

`src/combat/attacks.ts`:

```ts
import type { AnimState } from "../actors/animationStates";

export type MeleeKind = "light1" | "light2" | "light3" | "heavy";

export interface MeleeAttackSpec {
  /** Animation state this attack plays. */
  state: AnimState;
  damage: number;
  staminaCost: number;
  /** Real seconds into the swing when damage lands (clip speed already applied). */
  hitAt: number;
  range: number;
  /** Half-angle of the hit arc, radians. */
  halfArc: number;
}

/**
 * hitAt values sit inside each clip's real duration at its configured speed:
 * light1 Slice_Diagonal 1.0s/1.2≈0.83s, light2 Slice_Horizontal 1.067s/1.2≈0.89s,
 * light3 Stab 1.6s/1.2≈1.33s, heavy Chop 1.067s/1.0.
 */
export const MELEE_ATTACKS: Record<MeleeKind, MeleeAttackSpec> = {
  light1: { state: "attack", damage: 12, staminaCost: 12, hitAt: 0.38, range: 2.2, halfArc: Math.PI / 3 },
  light2: { state: "attack2", damage: 12, staminaCost: 12, hitAt: 0.4, range: 2.2, halfArc: Math.PI / 3 },
  light3: { state: "attack3", damage: 18, staminaCost: 12, hitAt: 0.6, range: 2.4, halfArc: Math.PI / 3 },
  heavy: { state: "heavy", damage: 25, staminaCost: 25, hitAt: 0.5, range: 2.4, halfArc: Math.PI / 3 },
};

/** What a buffered light press chains into when the active swing ends. */
export const COMBO_CHAIN: Record<MeleeKind, MeleeKind | null> = {
  light1: "light2",
  light2: "light3",
  light3: null,
  heavy: null,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/combat/attacks.ts src/combat/hitArc.ts src/combat/hitArc.test.ts
git commit -m "feat: add melee attack specs and planar hit-arc test"
```

---

### Task 4: Melee sequencer

**Files:**
- Create: `src/combat/meleeSequencer.ts`
- Test: `src/combat/meleeSequencer.test.ts`

- [ ] **Step 1: Write the failing test** — `src/combat/meleeSequencer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MELEE_ATTACKS } from "./attacks";
import { MeleeSequencer } from "./meleeSequencer";

describe("MeleeSequencer", () => {
  it("starts light1 from rest", () => {
    const seq = new MeleeSequencer();
    expect(seq.press("light")).toBe("light1");
    expect(seq.isAttacking).toBe(true);
  });

  it("starts heavy from rest", () => {
    const seq = new MeleeSequencer();
    expect(seq.press("heavy")).toBe("heavy");
  });

  it("buffers a press mid-swing instead of starting", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    expect(seq.press("light")).toBeNull();
  });

  it("fires the hit moment exactly once", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    expect(seq.update(0.2)).toBeNull(); // before hitAt 0.38
    expect(seq.update(0.2)).toBe("light1"); // crosses 0.38
    expect(seq.update(0.2)).toBeNull(); // no double hit
  });

  it("chains light1 → light2 → light3 with buffered presses", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    seq.press("light");
    expect(seq.onAttackEnd()).toBe("light2");
    seq.press("light");
    expect(seq.onAttackEnd()).toBe("light3");
    expect(seq.onAttackEnd()).toBeNull(); // combo over, nothing buffered
    expect(seq.isAttacking).toBe(false);
  });

  it("chains light → heavy when heavy is buffered", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    seq.press("heavy");
    expect(seq.onAttackEnd()).toBe("heavy");
  });

  it("ends the combo when nothing is buffered", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    expect(seq.onAttackEnd()).toBeNull();
    expect(seq.isAttacking).toBe(false);
  });

  it("resets hit timing for each chained attack", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    seq.update(1); // light1 hit fires
    seq.press("light");
    seq.onAttackEnd(); // light2 starts
    expect(seq.update(0.2)).toBeNull();
    expect(seq.update(0.3)).toBe("light2"); // crosses light2 hitAt 0.4
  });

  it("cancel clears active and buffered state", () => {
    const seq = new MeleeSequencer();
    seq.press("light");
    seq.press("light");
    seq.cancel();
    expect(seq.isAttacking).toBe(false);
    expect(seq.update(1)).toBeNull();
    expect(seq.onAttackEnd()).toBeNull();
  });

  it("every spec's hitAt is positive", () => {
    for (const spec of Object.values(MELEE_ATTACKS)) {
      expect(spec.hitAt).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./meleeSequencer`.

- [ ] **Step 3: Implement** — `src/combat/meleeSequencer.ts`:

```ts
import { COMBO_CHAIN, MELEE_ATTACKS, type MeleeKind } from "./attacks";

/**
 * Drives combo chaining and damage timing. The animation state machine
 * stays the source of truth for when a swing ends — the actor reports
 * that via onAttackEnd(). Pure; no Babylon imports.
 */
export class MeleeSequencer {
  private active: MeleeKind | null = null;
  private buffered: "light" | "heavy" | null = null;
  private elapsed = 0;
  private hitDone = false;

  get isAttacking(): boolean {
    return this.active !== null;
  }

  /** An attack input was pressed. Returns the attack to start now, if any. */
  press(kind: "light" | "heavy"): MeleeKind | null {
    if (this.active !== null) {
      this.buffered = kind;
      return null;
    }
    this.begin(kind === "light" ? "light1" : "heavy");
    return this.active;
  }

  /** Advance time; returns the attack whose damage moment was crossed, once. */
  update(dt: number): MeleeKind | null {
    if (this.active === null) return null;
    this.elapsed += dt;
    if (!this.hitDone && this.elapsed >= MELEE_ATTACKS[this.active].hitAt) {
      this.hitDone = true;
      return this.active;
    }
    return null;
  }

  /** The active swing's animation finished. Returns a chained attack, if any. */
  onAttackEnd(): MeleeKind | null {
    if (this.active === null) return null;
    const next =
      this.buffered === "light"
        ? COMBO_CHAIN[this.active]
        : this.buffered === "heavy"
          ? "heavy"
          : null;
    this.buffered = null;
    if (next) {
      this.begin(next);
    } else {
      this.active = null;
    }
    return next;
  }

  /** Swing was interrupted (hit/death); drop all combo state. */
  cancel(): void {
    this.active = null;
    this.buffered = null;
    this.elapsed = 0;
    this.hitDone = false;
  }

  private begin(kind: MeleeKind): void {
    this.active = kind;
    this.elapsed = 0;
    this.hitDone = false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/combat/meleeSequencer.ts src/combat/meleeSequencer.test.ts
git commit -m "feat: add melee sequencer for combo chaining and hit timing"
```

---

### Task 5: Sign logic — selection, cooldowns, Quen

**Files:**
- Create: `src/combat/signs.ts`
- Test: `src/combat/signs.test.ts`

- [ ] **Step 1: Write the failing test** — `src/combat/signs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { QuenShield, SIGN_SPECS, SignBook } from "./signs";

describe("SignBook", () => {
  it("defaults to igni and selects others", () => {
    const book = new SignBook();
    expect(book.selected).toBe("igni");
    book.select("quen");
    expect(book.selected).toBe("quen");
  });

  it("casts when ready and starts the cooldown", () => {
    const book = new SignBook();
    expect(book.tryCast(10)).toBe("igni");
    expect(book.tryCast(11)).toBeNull(); // cooling (6s)
    expect(book.tryCast(16)).toBe("igni"); // ready again
  });

  it("tracks cooldowns per sign independently", () => {
    const book = new SignBook();
    book.tryCast(0); // igni on cooldown
    book.select("aard");
    expect(book.tryCast(0.1)).toBe("aard");
  });

  it("reports cooldown fraction from 1 toward 0", () => {
    const book = new SignBook();
    book.tryCast(0);
    expect(book.cooldownFraction("igni", 0)).toBeCloseTo(1);
    expect(book.cooldownFraction("igni", 3)).toBeCloseTo(0.5);
    expect(book.cooldownFraction("igni", 6)).toBe(0);
    expect(book.cooldownFraction("aard", 0)).toBe(0);
  });

  it("reset clears cooldowns and selection", () => {
    const book = new SignBook();
    book.select("quen");
    book.tryCast(0);
    book.reset();
    expect(book.selected).toBe("igni");
    expect(book.cooldownFraction("quen", 0.1)).toBe(0);
  });

  it("spec sanity: each sign has a positive cooldown and stamina cost", () => {
    for (const spec of Object.values(SIGN_SPECS)) {
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(spec.staminaCost).toBeGreaterThan(0);
    }
  });
});

describe("QuenShield", () => {
  it("is inactive until activated", () => {
    const quen = new QuenShield();
    expect(quen.isActive(0)).toBe(false);
    expect(quen.absorb(10, 0)).toBe(10);
  });

  it("absorbs up to capacity and passes the remainder through", () => {
    const quen = new QuenShield();
    quen.activate(0);
    expect(quen.absorb(20, 1)).toBe(0); // 10 capacity left
    expect(quen.absorb(20, 2)).toBe(10); // soaks 10, 10 passes through
    expect(quen.isActive(3)).toBe(false); // depleted
  });

  it("expires after its duration", () => {
    const quen = new QuenShield();
    quen.activate(0);
    expect(quen.isActive(29)).toBe(true);
    expect(quen.isActive(30)).toBe(false);
    expect(quen.absorb(10, 31)).toBe(10);
  });

  it("clear drops the shield immediately", () => {
    const quen = new QuenShield();
    quen.activate(0);
    quen.clear();
    expect(quen.isActive(1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./signs`.

- [ ] **Step 3: Implement** — `src/combat/signs.ts`:

```ts
export type SignKind = "igni" | "aard" | "quen";

export const SIGN_ORDER: readonly SignKind[] = ["igni", "aard", "quen"];

export const SIGN_SPECS: Record<SignKind, { cooldown: number; staminaCost: number }> = {
  igni: { cooldown: 6, staminaCost: 20 },
  aard: { cooldown: 5, staminaCost: 20 },
  quen: { cooldown: 10, staminaCost: 20 },
};

/** Gameplay effect parameters, applied by the composition root (game.ts). */
export const IGNI_EFFECT = { range: 5, halfArc: Math.PI / 4, damage: 20 } as const;
export const AARD_EFFECT = { radius: 4, damage: 5 } as const;

/** Sign selection + cooldown bookkeeping. Time is caller-supplied seconds. Pure. */
export class SignBook {
  selected: SignKind = "igni";
  private readyAt: Record<SignKind, number> = { igni: 0, aard: 0, quen: 0 };

  select(kind: SignKind): void {
    this.selected = kind;
  }

  /** Remaining cooldown as a 0..1 fraction (0 = ready). */
  cooldownFraction(kind: SignKind, now: number): number {
    const remaining = this.readyAt[kind] - now;
    return remaining <= 0 ? 0 : remaining / SIGN_SPECS[kind].cooldown;
  }

  /** Cast the selected sign if ready; starts its cooldown. Null while cooling. */
  tryCast(now: number): SignKind | null {
    if (now < this.readyAt[this.selected]) return null;
    this.readyAt[this.selected] = now + SIGN_SPECS[this.selected].cooldown;
    return this.selected;
  }

  reset(): void {
    this.selected = "igni";
    this.readyAt = { igni: 0, aard: 0, quen: 0 };
  }
}

const QUEN_CAPACITY = 30;
const QUEN_DURATION_SECONDS = 30;

/** Quen: absorbs up to QUEN_CAPACITY damage for QUEN_DURATION_SECONDS. Pure. */
export class QuenShield {
  private remaining = 0;
  private expiresAt = 0;

  activate(now: number): void {
    this.remaining = QUEN_CAPACITY;
    this.expiresAt = now + QUEN_DURATION_SECONDS;
  }

  isActive(now: number): boolean {
    return this.remaining > 0 && now < this.expiresAt;
  }

  /** Soak damage; returns the amount that gets through to health. */
  absorb(amount: number, now: number): number {
    if (!this.isActive(now)) return amount;
    const soaked = Math.min(this.remaining, amount);
    this.remaining -= soaked;
    return amount - soaked;
  }

  clear(): void {
    this.remaining = 0;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/combat/signs.ts src/combat/signs.test.ts
git commit -m "feat: add sign selection, cooldowns and quen shield logic"
```

---

### Task 6: Lock-on targeting

**Files:**
- Create: `src/combat/targeting.ts`
- Test: `src/combat/targeting.test.ts`

- [ ] **Step 1: Write the failing test** — `src/combat/targeting.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LockOn, nearestTarget } from "./targeting";

function stub(x: number, z: number, isDead = false) {
  return { position: { x, y: 0, z }, isDead };
}

describe("nearestTarget", () => {
  it("picks the closest living candidate", () => {
    const near = stub(3, 0);
    const far = stub(8, 0);
    expect(nearestTarget(0, 0, [far, near])).toBe(near);
  });

  it("skips dead candidates", () => {
    const dead = stub(1, 0, true);
    const alive = stub(5, 0);
    expect(nearestTarget(0, 0, [dead, alive])).toBe(alive);
  });

  it("returns null beyond acquire range (15)", () => {
    expect(nearestTarget(0, 0, [stub(16, 0)])).toBeNull();
  });

  it("returns null with no candidates", () => {
    expect(nearestTarget(0, 0, [])).toBeNull();
  });
});

describe("LockOn", () => {
  it("toggle acquires then releases", () => {
    const lock = new LockOn();
    const wolf = stub(4, 0);
    lock.toggle(0, 0, [wolf]);
    expect(lock.target).toBe(wolf);
    lock.toggle(0, 0, [wolf]);
    expect(lock.target).toBeNull();
  });

  it("drops the lock when the target dies", () => {
    const lock = new LockOn();
    const wolf = stub(4, 0);
    lock.toggle(0, 0, [wolf]);
    wolf.isDead = true;
    lock.update(0, 0);
    expect(lock.target).toBeNull();
  });

  it("drops the lock beyond drop range (20)", () => {
    const lock = new LockOn();
    const wolf = stub(4, 0);
    lock.toggle(0, 0, [wolf]);
    wolf.position.x = 25;
    lock.update(0, 0);
    expect(lock.target).toBeNull();
  });

  it("keeps the lock inside drop range even past acquire range", () => {
    const lock = new LockOn();
    const wolf = stub(4, 0);
    lock.toggle(0, 0, [wolf]);
    wolf.position.x = 18; // > acquire 15, < drop 20
    lock.update(0, 0);
    expect(lock.target).toBe(wolf);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./targeting`.

- [ ] **Step 3: Implement** — `src/combat/targeting.ts`:

```ts
/** Anything lock-on can aim at. Babylon's Vector3 satisfies position structurally. */
export interface Targetable {
  position: { x: number; y: number; z: number };
  isDead: boolean;
}

const ACQUIRE_RANGE = 15;
const DROP_RANGE = 20;

export function nearestTarget<T extends Targetable>(
  originX: number,
  originZ: number,
  candidates: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDist = ACQUIRE_RANGE;
  for (const candidate of candidates) {
    if (candidate.isDead) continue;
    const dist = Math.hypot(
      candidate.position.x - originX,
      candidate.position.z - originZ,
    );
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Single owner of the current lock-on target. game.ts mirrors
 * target.position into Player and CameraRig each frame.
 */
export class LockOn<T extends Targetable = Targetable> {
  target: T | null = null;

  toggle(originX: number, originZ: number, candidates: readonly T[]): void {
    this.target = this.target ? null : nearestTarget(originX, originZ, candidates);
  }

  /** Drop the lock when the target dies or strays too far. */
  update(originX: number, originZ: number): void {
    if (!this.target) return;
    const dist = Math.hypot(
      this.target.position.x - originX,
      this.target.position.z - originZ,
    );
    if (this.target.isDead || dist > DROP_RANGE) this.target = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/combat/targeting.ts src/combat/targeting.test.ts
git commit -m "feat: add nearest-enemy lock-on targeting"
```

---

### Task 7: Wolf brain FSM

**Files:**
- Create: `src/actors/wolfBrain.ts`
- Test: `src/actors/wolfBrain.test.ts`

- [ ] **Step 1: Write the failing test** — `src/actors/wolfBrain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WolfBrain } from "./wolfBrain";

/** rng stub: always 0 → circleDir -1, minimum circle duration (1.2s). */
const rngZero = () => 0;

function tick(brain: WolfBrain, x: number, z: number, dt = 0.1, playerDead = false) {
  return brain.update({ toPlayerX: x, toPlayerZ: z, playerDead, dt });
}

describe("WolfBrain", () => {
  it("idles until the player enters aggro range (12)", () => {
    const brain = new WolfBrain(rngZero);
    const out = tick(brain, 20, 0);
    expect(brain.state).toBe("idle");
    expect(out.velX).toBe(0);
    tick(brain, 10, 0);
    expect(brain.state).toBe("chase");
  });

  it("chases at gallop speed toward the player", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0); // idle -> chase
    const out = tick(brain, 10, 0);
    expect(out.gait).toBe("run");
    expect(out.velX).toBeCloseTo(4.5);
    expect(out.velZ).toBeCloseTo(0);
  });

  it("starts circling when close (3.5)", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 3, 0); // chase -> circle
    expect(brain.state).toBe("circle");
    const out = tick(brain, 3, 0);
    expect(out.gait).toBe("walk");
  });

  it("attacks after circling when in range, biting exactly once at 0.55s", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 2, 0); // -> circle (duration 1.2 with rngZero)
    for (let t = 0; t < 1.3; t += 0.1) tick(brain, 2, 0); // circle expires
    expect(brain.state).toBe("attack");
    let bites = 0;
    for (let t = 0; t < 1.4; t += 0.1) {
      if (tick(brain, 2, 0).bite) bites++;
    }
    expect(bites).toBe(1);
    expect(brain.state).toBe("recover");
  });

  it("flags attackStarted on the transition tick", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 2, 0);
    let started = 0;
    for (let t = 0; t < 1.3; t += 0.1) {
      if (tick(brain, 2, 0).attackStarted) started++;
    }
    expect(started).toBe(1);
  });

  it("returns to chase after recovering", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 2, 0);
    for (let t = 0; t < 2.8; t += 0.1) tick(brain, 2, 0); // circle + attack
    expect(brain.state).toBe("recover");
    for (let t = 0; t < 1.1; t += 0.1) tick(brain, 6, 0);
    expect(brain.state).toBe("chase");
  });

  it("re-chases instead of attacking when the circle ends out of range", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 3, 0); // -> circle
    for (let t = 0; t < 1.3; t += 0.1) tick(brain, 8, 0); // player ran away
    expect(brain.state).toBe("chase");
  });

  it("stagger interrupts and recovers to chase", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    brain.stagger();
    expect(brain.state).toBe("staggered");
    expect(tick(brain, 2, 0).velX).toBe(0);
    for (let t = 0; t < 1.6; t += 0.1) tick(brain, 2, 0);
    expect(brain.state).toBe("chase");
  });

  it("interrupt cancels an in-progress attack into recover", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 10, 0);
    tick(brain, 2, 0);
    for (let t = 0; t < 1.3; t += 0.1) tick(brain, 2, 0); // -> attack
    expect(brain.state).toBe("attack");
    brain.interrupt();
    expect(brain.state).toBe("recover");
  });

  it("kill is terminal; stagger cannot revive", () => {
    const brain = new WolfBrain(rngZero);
    brain.kill();
    brain.stagger();
    expect(brain.state).toBe("dead");
    const out = tick(brain, 1, 0);
    expect(out.velX).toBe(0);
    expect(out.bite).toBe(false);
  });

  it("goes idle while the player is dead", () => {
    const brain = new WolfBrain(rngZero);
    tick(brain, 5, 0);
    expect(brain.state).toBe("chase");
    tick(brain, 5, 0, 0.1, true);
    expect(brain.state).toBe("idle");
  });

  it("reset returns to idle", () => {
    const brain = new WolfBrain(rngZero);
    brain.kill();
    brain.reset();
    expect(brain.state).toBe("idle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./wolfBrain`.

- [ ] **Step 3: Implement** — `src/actors/wolfBrain.ts`:

```ts
export type WolfState =
  | "idle"
  | "chase"
  | "circle"
  | "attack"
  | "recover"
  | "staggered"
  | "dead";

export type WolfGait = "idle" | "walk" | "run";

export interface WolfTickInput {
  /** Planar vector from wolf to player. */
  toPlayerX: number;
  toPlayerZ: number;
  playerDead: boolean;
  dt: number;
}

export interface WolfTick {
  /** Desired horizontal velocity, world units/s. */
  velX: number;
  velZ: number;
  gait: WolfGait;
  /** True on the tick the wolf begins its attack (play the Attack clip). */
  attackStarted: boolean;
  /** True on the tick the bite's damage should be checked. */
  bite: boolean;
}

const AGGRO_RANGE = 12;
const CIRCLE_RANGE = 3.5;
const CIRCLE_DISTANCE = 3;
const ATTACK_RANGE = 2.6;
const GALLOP_SPEED = 4.5;
const WALK_SPEED = 1.8;
/** Seconds into the 1.33s Attack clip when the bite lands. */
const BITE_AT = 0.55;
const ATTACK_DURATION = 1.33;
const RECOVER_SECONDS = 1.0;
const STAGGER_SECONDS = 1.5;

const IDLE_TICK: WolfTick = {
  velX: 0,
  velZ: 0,
  gait: "idle",
  attackStarted: false,
  bite: false,
};

/**
 * Wolf combat FSM: idle → chase → circle → attack → recover (→ chase).
 * Aard staggers; death is terminal. Pure; rng injected for tests.
 */
export class WolfBrain {
  state: WolfState = "idle";
  private timer = 0;
  private circleDir: 1 | -1 = 1;
  private biteDone = false;

  constructor(private rng: () => number = Math.random) {}

  /** Aard hit: stand dazed (no effect when dead). */
  stagger(): void {
    if (this.state === "dead") return;
    this.state = "staggered";
    this.timer = STAGGER_SECONDS;
  }

  /** Flinch from damage: an in-progress attack is abandoned. */
  interrupt(): void {
    if (this.state === "attack") {
      this.state = "recover";
      this.timer = RECOVER_SECONDS;
    }
  }

  kill(): void {
    this.state = "dead";
  }

  reset(): void {
    this.state = "idle";
    this.timer = 0;
    this.biteDone = false;
  }

  update(input: WolfTickInput): WolfTick {
    if (this.state === "dead") return IDLE_TICK;
    if (input.playerDead) {
      this.state = "idle";
      return IDLE_TICK;
    }

    const dist = Math.hypot(input.toPlayerX, input.toPlayerZ);
    const dirX = dist > 0 ? input.toPlayerX / dist : 0;
    const dirZ = dist > 0 ? input.toPlayerZ / dist : 1;

    switch (this.state) {
      case "idle":
        if (dist < AGGRO_RANGE) this.state = "chase";
        return IDLE_TICK;

      case "chase":
        if (dist < CIRCLE_RANGE) {
          this.state = "circle";
          this.circleDir = this.rng() < 0.5 ? -1 : 1;
          this.timer = 1.2 + this.rng() * 1.3;
          return this.circleTick(dist, dirX, dirZ);
        }
        return {
          velX: dirX * GALLOP_SPEED,
          velZ: dirZ * GALLOP_SPEED,
          gait: "run",
          attackStarted: false,
          bite: false,
        };

      case "circle":
        this.timer -= input.dt;
        if (this.timer <= 0) {
          if (dist <= ATTACK_RANGE) {
            this.state = "attack";
            this.timer = ATTACK_DURATION;
            this.biteDone = false;
            return { ...IDLE_TICK, attackStarted: true };
          }
          this.state = "chase";
          return IDLE_TICK;
        }
        return this.circleTick(dist, dirX, dirZ);

      case "attack": {
        this.timer -= input.dt;
        const bite = !this.biteDone && ATTACK_DURATION - this.timer >= BITE_AT;
        if (bite) this.biteDone = true;
        if (this.timer <= 0) {
          this.state = "recover";
          this.timer = RECOVER_SECONDS;
        }
        return { ...IDLE_TICK, bite };
      }

      case "recover":
        this.timer -= input.dt;
        if (this.timer <= 0) this.state = "chase";
        return IDLE_TICK;

      case "staggered":
        this.timer -= input.dt;
        if (this.timer <= 0) this.state = "chase";
        return IDLE_TICK;
    }
    return IDLE_TICK;
  }

  /** Strafe tangentially while correcting toward the preferred circling distance. */
  private circleTick(dist: number, dirX: number, dirZ: number): WolfTick {
    const radial = Math.max(-1, Math.min(1, dist - CIRCLE_DISTANCE));
    let vx = -dirZ * this.circleDir + dirX * radial * 0.8;
    let vz = dirX * this.circleDir + dirZ * radial * 0.8;
    const len = Math.hypot(vx, vz) || 1;
    vx = (vx / len) * WALK_SPEED;
    vz = (vz / len) * WALK_SPEED;
    return { velX: vx, velZ: vz, gait: "walk", attackStarted: false, bite: false };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

```bash
pnpm check
git add src/actors/wolfBrain.ts src/actors/wolfBrain.test.ts
git commit -m "feat: add wolf AI state machine"
```

---

### Task 8: Wolf asset & clip map

**Files:**
- Create: `public/assets/characters/Wolf.glb`, `public/assets/characters/QUATERNIUS_LICENSE.txt`, `src/data/wolfAnimations.ts`
- Modify: `public/assets/README.md`
- Test: `src/data/wolfAnimations.test.ts`

- [ ] **Step 1: Download the asset**

```bash
curl -sL -o public/assets/characters/Wolf.glb https://static.poly.pizza/f1d12388-e39b-4157-b32a-646a1d089fc4.glb
ls -l public/assets/characters/Wolf.glb
```

Expected: 986712 bytes.

- [ ] **Step 2: Add license + update the asset README**

`public/assets/characters/QUATERNIUS_LICENSE.txt`:

```
Wolf.glb — "Wolf" by Quaternius

License: CC0 1.0 Universal (Public Domain Dedication)
https://creativecommons.org/publicdomain/zero/1.0/

Source: https://poly.pizza/m/P1gU3Qkr9r
Creator: Quaternius — https://quaternius.com/

No attribution required; provided here as a courtesy.
```

In `public/assets/README.md`, add a row to the license table:

```
| `characters/Wolf.glb` | Quaternius | CC0 1.0 | https://poly.pizza/m/P1gU3Qkr9r |
```

(Match the existing table's column layout exactly — read the file first.)

- [ ] **Step 3: Write the failing test** — `src/data/wolfAnimations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AnimState } from "../actors/animationStates";
import { WOLF_CLIPS } from "./wolfAnimations";

const ALL_STATES: AnimState[] = [
  "idle",
  "walk",
  "walkBack",
  "strafeLeft",
  "strafeRight",
  "run",
  "fall",
  "roll",
  "attack",
  "attack2",
  "attack3",
  "heavy",
  "cast",
  "hit",
  "death",
];

/** Clip names verified against Wolf.glb's JSON chunk (plain, unprefixed set). */
const WOLF_GLB_CLIPS = new Set([
  "Attack",
  "Death",
  "Eating",
  "Gallop",
  "Gallop_Jump",
  "Idle",
  "Idle_2",
  "Idle_2_HeadLow",
  "Idle_HitReact_Left",
  "Idle_HitReact_Right",
  "Jump_ToIdle",
  "Walk",
]);

describe("WOLF_CLIPS", () => {
  it("covers every animation state with a clip that exists in the GLB", () => {
    for (const state of ALL_STATES) {
      const config = WOLF_CLIPS[state];
      expect(config, `missing clip for ${state}`).toBeDefined();
      expect(WOLF_GLB_CLIPS.has(config.clip), `unknown clip ${config.clip}`).toBe(true);
    }
  });

  it("loops locomotion but not one-shots", () => {
    expect(WOLF_CLIPS.idle.loop).toBe(true);
    expect(WOLF_CLIPS.run.loop).toBe(true);
    expect(WOLF_CLIPS.attack.loop).toBe(false);
    expect(WOLF_CLIPS.death.loop).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL — cannot resolve `./wolfAnimations`.

- [ ] **Step 5: Implement** — `src/data/wolfAnimations.ts`:

```ts
import type { AnimState } from "../actors/animationStates";
import type { ClipConfig } from "./knightAnimations";

/**
 * Clip map for Wolf.glb (Quaternius, CC0). The GLB also contains duplicate
 * "AnimalArmature|"-prefixed groups — always use the plain names.
 * The shared AnimState type requires every key, so player-only states
 * (strafes, roll, combo steps, cast) map to sensible wolf fallbacks.
 */
export const WOLF_CLIPS: Record<AnimState, ClipConfig> = {
  idle: { clip: "Idle", loop: true, speed: 1 },
  walk: { clip: "Walk", loop: true, speed: 1 },
  walkBack: { clip: "Walk", loop: true, speed: 1 },
  strafeLeft: { clip: "Walk", loop: true, speed: 1 },
  strafeRight: { clip: "Walk", loop: true, speed: 1 },
  run: { clip: "Gallop", loop: true, speed: 1 },
  fall: { clip: "Gallop_Jump", loop: true, speed: 1 },
  roll: { clip: "Gallop_Jump", loop: false, speed: 1 },
  attack: { clip: "Attack", loop: false, speed: 1 },
  attack2: { clip: "Attack", loop: false, speed: 1 },
  attack3: { clip: "Attack", loop: false, speed: 1 },
  heavy: { clip: "Attack", loop: false, speed: 1 },
  cast: { clip: "Attack", loop: false, speed: 1 },
  hit: { clip: "Idle_HitReact_Left", loop: false, speed: 1 },
  death: { clip: "Death", loop: false, speed: 1 },
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Lint and commit**

```bash
pnpm check
git add public/assets/characters/Wolf.glb public/assets/characters/QUATERNIUS_LICENSE.txt public/assets/README.md src/data/wolfAnimations.ts src/data/wolfAnimations.test.ts
git commit -m "feat: add CC0 Quaternius wolf asset and clip map"
```

---

### Task 9: Wolf actor & combat events

**Files:**
- Create: `src/actors/wolf.ts`
- Modify: `src/core/events.ts`

No unit test (Babylon-coupled); verified by `pnpm check` now and visually in Task 13.

- [ ] **Step 1: Extend the event map** — in `src/core/events.ts`, replace the `GameEvents` interface:

```ts
export interface GameEvents extends Record<string, unknown> {
  "game:started": Record<string, never>;
  /** A wolf (or future enemy) died. Consumed by quests/XP in later phases. */
  "enemy:killed": { id: string };
  "player:died": Record<string, never>;
}
```

- [ ] **Step 2: Implement the actor** — `src/actors/wolf.ts`:

```ts
import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { Health } from "../combat/health";
import { events } from "../core/events";
import { WOLF_CLIPS } from "../data/wolfAnimations";
import { AnimationController } from "./animationController";
import { AnimStateMachine } from "./animationStates";
import { loadCharacterModel } from "./characterModel";
import { lerpAngle } from "./movement";
import { WolfBrain } from "./wolfBrain";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 8;
const CAPSULE_HEIGHT = 1.0;
const CAPSULE_RADIUS = 0.45;
const WOLF_HP = 40;
/** Set to Math.PI if the wolf visibly runs backwards in the dev check. */
const MODEL_YAW = 0;

export const WOLF_BITE_DAMAGE = 10;
export const WOLF_BITE_RANGE = 2.2;
export const WOLF_BITE_HALF_ARC = Math.PI / 2.5;

let nextWolfId = 1;

/** A pack wolf: physics capsule + Quaternius model driven by WolfBrain. */
export class Wolf {
  readonly id: string;
  readonly mesh: Mesh;
  readonly health = new Health(WOLF_HP);
  /** Called at the bite moment; game.ts checks the arc and damages the player. */
  onBite: (() => void) | undefined;

  private controller: PhysicsCharacterController;
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  private brain: WolfBrain;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private readonly spawn: Vector3;

  constructor(scene: Scene, spawn: Vector3, rng?: () => number) {
    this.id = `wolf-${nextWolfId++}`;
    this.spawn = spawn.clone();
    this.brain = new WolfBrain(rng);
    this.mesh = MeshBuilder.CreateCapsule(
      this.id,
      { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS },
      scene,
    );
    this.mesh.position.copyFrom(spawn);
    this.controller = new PhysicsCharacterController(
      spawn,
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene,
    );
  }

  /** Load the visual model; capsule turns invisible. Call once at startup. */
  async loadModel(scene: Scene): Promise<void> {
    const model = await loadCharacterModel(
      `${import.meta.env.BASE_URL}assets/characters/Wolf.glb`,
      scene,
      CAPSULE_HEIGHT,
    );
    model.root.parent = this.mesh;
    model.root.position.y = -CAPSULE_HEIGHT / 2;
    model.root.rotation.y = MODEL_YAW;
    this.mesh.isVisible = false;
    this.animController = new AnimationController(WOLF_CLIPS, model.animations, () =>
      this.stateMachine.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  get isDead(): boolean {
    return this.health.isDead;
  }

  /** Apply damage; aard passes stagger=true. */
  takeDamage(amount: number, stagger = false): void {
    if (this.isDead) return;
    this.health.damage(amount);
    if (this.health.isDead) {
      this.brain.kill();
      this.stateMachine.trigger("death");
      events.emit("enemy:killed", { id: this.id });
      return;
    }
    if (stagger) {
      this.brain.stagger();
    } else {
      this.brain.interrupt();
    }
    this.stateMachine.trigger("hit");
  }

  update(dt: number, playerPosition: Vector3, playerDead: boolean): void {
    if (!this.isDead) {
      const tick = this.brain.update({
        toPlayerX: playerPosition.x - this.mesh.position.x,
        toPlayerZ: playerPosition.z - this.mesh.position.z,
        playerDead,
        dt,
      });
      if (tick.attackStarted) this.stateMachine.trigger("attack");
      if (tick.bite) this.onBite?.();

      // The flinch animation roots the wolf in place.
      const flinching = this.stateMachine.current === "hit";
      const vx = flinching ? 0 : tick.velX;
      const vz = flinching ? 0 : tick.velZ;

      const support = this.controller.checkSupport(dt, DOWN);
      const onGround =
        support.supportedState === CharacterSupportedState.SUPPORTED;
      const vy = onGround ? 0 : this.controller.getVelocity().y - 9.81 * dt;
      this.velocityScratch.set(vx, vy, vz);
      this.controller.setVelocity(this.velocityScratch);
      this.controller.integrate(dt, support, GRAVITY);
      this.mesh.position.copyFrom(this.controller.getPosition());

      // Face the player while engaging up close; otherwise face travel direction.
      const engaging =
        this.brain.state === "circle" ||
        this.brain.state === "attack" ||
        this.brain.state === "recover";
      if (engaging) {
        this.targetYaw = Math.atan2(
          playerPosition.x - this.mesh.position.x,
          playerPosition.z - this.mesh.position.z,
        );
      } else if (vx !== 0 || vz !== 0) {
        this.targetYaw = Math.atan2(vx, vz);
      }
      this.mesh.rotation.y = lerpAngle(
        this.mesh.rotation.y,
        this.targetYaw,
        TURN_RATE * dt,
      );

      this.stateMachine.setLocomotion(
        tick.gait === "run" ? "run" : tick.gait === "walk" ? "walk" : "idle",
      );
    }
    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
  }

  /** Back to spawn at full health (used when the player retries). */
  respawn(): void {
    this.health.reset();
    this.brain.reset();
    this.stateMachine.reset();
    this.controller.setPosition(this.spawn);
    this.mesh.position.copyFrom(this.spawn);
  }

  dispose(): void {
    this.animController?.dispose();
    // Babylon's controller.dispose() needs a live physics engine; during
    // HMR teardown it may already be gone.
    if (this.mesh.getScene().getPhysicsEngine()) {
      this.controller.dispose();
    }
    this.mesh.dispose();
  }
}
```

- [ ] **Step 3: Verify it compiles and lints**

Run: `pnpm test && pnpm check`
Expected: tests still pass; 0 check errors.

- [ ] **Step 4: Commit**

```bash
git add src/actors/wolf.ts src/core/events.ts
git commit -m "feat: add wolf actor and combat events"
```

---

### Task 10: Player combat integration

**Files:**
- Modify: `src/core/input.ts`, `src/core/input.test.ts`, `src/actors/playerController.ts`

- [ ] **Step 1: Update the failing input test** — in `src/core/input.test.ts`, replace the `"maps trigger keys to new actions"` test:

```ts
  it("maps combat keys to actions", () => {
    const input = new Input();
    for (const [code, action] of [
      ["Space", "roll"],
      ["KeyF", "attack"],
      ["KeyR", "heavy"],
      ["KeyQ", "castSign"],
      ["Digit1", "sign1"],
      ["Digit2", "sign2"],
      ["Digit3", "sign3"],
      ["Tab", "lockToggle"],
      ["Enter", "respawn"],
    ] as const) {
      input.handleKey(code, true);
      expect(input.isDown(action)).toBe(true);
    }
  });

  it("no longer binds the removed debug keys", () => {
    const input = new Input();
    input.handleKey("KeyH", true);
    input.handleKey("KeyK", true);
    expect(input.justPressed("attack")).toBe(false);
    expect(input.isDown("attack")).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `"heavy"` etc. not assignable to `Action`.

- [ ] **Step 3: Update input** — in `src/core/input.ts`:

Replace the `Action` type (debug actions removed — real damage drives hit/death now):

```ts
export type Action =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "roll"
  | "attack"
  | "heavy"
  | "castSign"
  | "sign1"
  | "sign2"
  | "sign3"
  | "lockToggle"
  | "respawn";
```

In `DEFAULT_BINDINGS`, remove `KeyH` and `KeyK`, and add:

```ts
  KeyR: "heavy",
  KeyQ: "castSign",
  Digit1: "sign1",
  Digit2: "sign2",
  Digit3: "sign3",
  Enter: "respawn",
```

- [ ] **Step 4: Run tests to verify input passes** — `pnpm test` — playerController will now fail `pnpm check` (it references `debugHit`); that's fixed next.

- [ ] **Step 5: Rewrite `src/actors/playerController.ts`** with full combat integration:

```ts
import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { MELEE_ATTACKS, type MeleeKind } from "../combat/attacks";
import { Health } from "../combat/health";
import { MeleeSequencer } from "../combat/meleeSequencer";
import { QuenShield, SIGN_SPECS, SignBook, type SignKind } from "../combat/signs";
import { Stamina } from "../combat/stamina";
import type { Input } from "../core/input";
import { KNIGHT_CLIPS } from "../data/knightAnimations";
import { AnimationController } from "./animationController";
import { AnimStateMachine, isMeleeState, selectLocomotion } from "./animationStates";
import type { CameraRig } from "./cameraRig";
import { loadCharacterModel } from "./characterModel";
import { computeMoveVelocity, lerpAngle } from "./movement";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;
const ROLL_SPEED = 6;
const ROLL_COST = 15;
const SPRINT_DRAIN_PER_SECOND = 8;
const MAX_HEALTH = 100;
const MAX_STAMINA = 100;
/** Real seconds into Spellcast_Shoot (0.933s at 1.2x ≈ 0.78s) when the sign fires. */
const CAST_BLAST_AT = 0.4;

// Capsule dimensions, camera follow offset (cameraRig.ts) and the model
// scaling in characterModel.ts are a coupled set — change together.
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;

export class Player {
  readonly mesh: Mesh;
  readonly health = new Health(MAX_HEALTH);
  readonly stamina = new Stamina(MAX_STAMINA);
  readonly signs = new SignBook();
  readonly quen = new QuenShield();
  /** Set by game.ts when lock-on is active; player faces this point. */
  lockTarget: Vector3 | null = null;
  /** Called at a melee swing's damage moment; game.ts applies it to enemies. */
  onMeleeHit: ((kind: MeleeKind) => void) | undefined;
  /** Called when a cast sign fires; game.ts applies the effect. */
  onSignBlast: ((kind: SignKind) => void) | undefined;

  private controller: PhysicsCharacterController;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  private sequencer = new MeleeSequencer();
  private elapsedSeconds = 0;
  private pendingSign: SignKind | null = null;
  private castElapsed = 0;

  constructor(
    scene: Scene,
    private input: Input,
    private cameraRig: CameraRig,
  ) {
    this.mesh = MeshBuilder.CreateCapsule(
      "player",
      { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS },
      scene,
    );
    const start = new Vector3(0, 2, 0);
    this.mesh.position.copyFrom(start);
    this.controller = new PhysicsCharacterController(
      start,
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene,
    );
  }

  /** Load the visual model; capsule turns invisible. Call once at startup. */
  async loadModel(scene: Scene): Promise<void> {
    const model = await loadCharacterModel(
      `${import.meta.env.BASE_URL}assets/characters/Knight.glb`,
      scene,
      CAPSULE_HEIGHT,
    );
    model.root.parent = this.mesh;
    // Capsule origin is its center; the model's origin is at the feet.
    model.root.position.y = -CAPSULE_HEIGHT / 2;
    this.mesh.isVisible = false;
    this.animController = new AnimationController(
      KNIGHT_CLIPS,
      model.animations,
      () => this.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  /** Facing yaw (left-handed, +Z = 0) — used for hit arcs and sign cones. */
  get yaw(): number {
    return this.mesh.rotation.y;
  }

  get isDead(): boolean {
    return this.stateMachine.isDead;
  }

  /** Game-time seconds since spawn; the clock for sign cooldowns and Quen. */
  get elapsed(): number {
    return this.elapsedSeconds;
  }

  get quenActive(): boolean {
    return this.quen.isActive(this.elapsedSeconds);
  }

  /** Incoming damage. Rolls grant i-frames; Quen soaks before health. */
  takeDamage(amount: number): void {
    if (this.stateMachine.isDead) return;
    if (this.stateMachine.current === "roll") return;
    const through = this.quen.absorb(amount, this.elapsedSeconds);
    if (through <= 0) return;
    this.health.damage(through);
    this.sequencer.cancel();
    this.pendingSign = null;
    this.stateMachine.trigger(this.health.isDead ? "death" : "hit");
  }

  /** Full reset at a position (player chose to retry). */
  respawn(position: Vector3): void {
    this.health.reset();
    this.stamina.reset();
    this.signs.reset();
    this.quen.clear();
    this.sequencer.cancel();
    this.pendingSign = null;
    this.stateMachine.reset();
    this.controller.setPosition(position);
    this.mesh.position.copyFrom(position);
  }

  update(dt: number): void {
    this.elapsedSeconds += dt;
    this.stamina.update(dt);

    const support = this.controller.checkSupport(dt, DOWN);
    const onGround =
      support.supportedState === CharacterSupportedState.SUPPORTED;

    if (this.input.justPressed("sign1")) this.signs.select("igni");
    if (this.input.justPressed("sign2")) this.signs.select("aard");
    if (this.input.justPressed("sign3")) this.signs.select("quen");

    if (
      this.input.justPressed("roll") &&
      this.stamina.current >= ROLL_COST &&
      this.stateMachine.trigger("roll")
    ) {
      this.stamina.trySpend(ROLL_COST);
      this.sequencer.cancel();
    }
    if (this.input.justPressed("attack")) this.tryMelee("light");
    if (this.input.justPressed("heavy")) this.tryMelee("heavy");
    if (this.input.justPressed("castSign")) this.tryCast();

    // Melee damage moment.
    const hitKind = this.sequencer.update(dt);
    if (hitKind) this.onMeleeHit?.(hitKind);

    // Sign blast moment.
    if (this.pendingSign) {
      this.castElapsed += dt;
      if (this.castElapsed >= CAST_BLAST_AT) {
        const sign = this.pendingSign;
        this.pendingSign = null;
        this.onSignBlast?.(sign);
      }
    }

    // Sprint costs stamina; an empty pool drops you to a walk.
    const wantsMove =
      this.input.isDown("forward") ||
      this.input.isDown("back") ||
      this.input.isDown("left") ||
      this.input.isDown("right");
    const sprinting =
      this.input.isDown("sprint") &&
      wantsMove &&
      onGround &&
      this.stamina.drain(SPRINT_DRAIN_PER_SECOND, dt);

    const current = this.stateMachine.current;
    let velocity = computeMoveVelocity(
      {
        forward: this.input.isDown("forward"),
        back: this.input.isDown("back"),
        left: this.input.isDown("left"),
        right: this.input.isDown("right"),
        sprint: sprinting,
      },
      this.cameraRig.yaw,
      onGround,
      this.controller.getVelocity().y,
      dt,
    );

    if (current === "roll") {
      // Roll bursts in the facing direction; KayKit clips have no root motion.
      velocity = {
        x: Math.sin(this.mesh.rotation.y) * ROLL_SPEED,
        y: velocity.y,
        z: Math.cos(this.mesh.rotation.y) * ROLL_SPEED,
      };
    } else if (
      isMeleeState(current) ||
      current === "cast" ||
      current === "hit" ||
      current === "death"
    ) {
      velocity = { x: 0, y: velocity.y, z: 0 };
    }

    this.velocityScratch.set(velocity.x, velocity.y, velocity.z);
    this.controller.setVelocity(this.velocityScratch);
    this.controller.integrate(dt, support, GRAVITY);
    this.mesh.position.copyFrom(this.controller.getPosition());

    // Facing: lock-on target wins; otherwise face movement direction.
    if (this.lockTarget && !this.isDead) {
      const dx = this.lockTarget.x - this.mesh.position.x;
      const dz = this.lockTarget.z - this.mesh.position.z;
      this.targetYaw = Math.atan2(dx, dz);
    } else if (current !== "roll" && (velocity.x !== 0 || velocity.z !== 0)) {
      this.targetYaw = Math.atan2(velocity.x, velocity.z);
    }
    this.mesh.rotation.y = lerpAngle(
      this.mesh.rotation.y,
      this.targetYaw,
      TURN_RATE * dt,
    );

    // Animation: movement direction relative to facing for strafe/back clips.
    const speed = Math.hypot(velocity.x, velocity.z);
    const cos = Math.cos(this.mesh.rotation.y);
    const sin = Math.sin(this.mesh.rotation.y);
    const localZ = (velocity.x * sin + velocity.z * cos) / (speed || 1);
    const localX = (velocity.x * cos - velocity.z * sin) / (speed || 1);
    this.stateMachine.setLocomotion(
      selectLocomotion({
        speed,
        localX,
        localZ,
        onGround,
        sprint: sprinting,
      }),
    );

    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
  }

  private tryMelee(kind: "light" | "heavy"): void {
    const current = this.stateMachine.current;
    if (this.stateMachine.isDead) return;
    if (!this.sequencer.isAttacking && !isMeleeState(current)) {
      // Only start a fresh swing from locomotion states.
      if (current === "roll" || current === "hit" || current === "cast") return;
    }
    const started = this.sequencer.press(kind);
    if (!started) return; // buffered for the chain
    const spec = MELEE_ATTACKS[started];
    if (!this.stamina.trySpend(spec.staminaCost)) {
      this.sequencer.cancel();
      return;
    }
    if (!this.stateMachine.trigger(spec.state)) {
      // Should not happen given the guards; keep sequencer and anims in sync.
      this.sequencer.cancel();
    }
  }

  private tryCast(): void {
    const current = this.stateMachine.current;
    if (this.stateMachine.isDead || this.sequencer.isAttacking) return;
    if (current === "roll" || current === "hit" || current === "cast") return;
    const cost = SIGN_SPECS[this.signs.selected].staminaCost;
    if (this.stamina.current < cost) return;
    const kind = this.signs.tryCast(this.elapsedSeconds);
    if (!kind) return; // cooling down
    if (!this.stateMachine.trigger("cast")) return;
    this.stamina.trySpend(cost);
    this.pendingSign = kind;
    this.castElapsed = 0;
  }

  private onOneShotEnd(): void {
    const ended = this.stateMachine.current;
    this.stateMachine.onOneShotEnd();
    if (!isMeleeState(ended)) return;
    const chained = this.sequencer.onAttackEnd();
    if (!chained) return;
    const spec = MELEE_ATTACKS[chained];
    if (!this.stamina.trySpend(spec.staminaCost)) {
      this.sequencer.cancel();
      return;
    }
    if (!this.stateMachine.trigger(spec.state)) {
      this.sequencer.cancel();
    }
  }

  dispose(): void {
    this.animController?.dispose();
    // Babylon's controller.dispose() needs a live physics engine; during
    // HMR teardown it may already be gone.
    if (this.mesh.getScene().getPhysicsEngine()) {
      this.controller.dispose();
    }
    this.mesh.dispose();
  }
}
```

Note for the reviewer: `game.ts` still references `debugHit`-free code only after Task 13; until then `pnpm check` must pass at *this* task's end — `game.ts` doesn't reference the removed actions (only `lockToggle`), so it does.

- [ ] **Step 6: Run tests and checks**

Run: `pnpm test && pnpm check`
Expected: all tests pass; 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/core/input.ts src/core/input.test.ts src/actors/playerController.ts
git commit -m "feat: wire combat into the player - combos, signs, stamina, i-frames"
```

---

### Task 11: Sign VFX

**Files:**
- Create: `src/combat/signEffects.ts`

No unit test (Babylon-coupled); verified by `pnpm check` and the Task 13 playtest.

- [ ] **Step 1: Implement** — `src/combat/signEffects.ts`:

```ts
import {
  Color3,
  Color4,
  DynamicTexture,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  StandardMaterial,
  type Texture,
  Vector3,
} from "@babylonjs/core";

/** Soft radial dot used by all sign particles (no external texture files). */
function makeParticleTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const texture = new DynamicTexture("signParticle", size, scene, false);
  // Babylon's ICanvasRenderingContext typing omits gradient APIs.
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.update();
  texture.hasAlpha = true;
  return texture;
}

/** Fire-and-forget particle bursts for Igni/Aard and the Quen bubble. */
export class SignEffects {
  private texture: DynamicTexture;
  private quenSphere: Mesh;

  constructor(private scene: Scene) {
    this.texture = makeParticleTexture(scene);
    this.quenSphere = MeshBuilder.CreateSphere(
      "quenShield",
      { diameter: 2.4, segments: 12 },
      scene,
    );
    const material = new StandardMaterial("quenMat", scene);
    material.emissiveColor = new Color3(1, 0.85, 0.3);
    material.alpha = 0.25;
    material.disableLighting = true;
    this.quenSphere.material = material;
    this.quenSphere.isPickable = false;
    this.quenSphere.setEnabled(false);
  }

  /** Show/hide the golden shield bubble; call every frame. */
  updateQuen(active: boolean, playerPosition: Vector3): void {
    this.quenSphere.setEnabled(active);
    if (active) this.quenSphere.position.copyFrom(playerPosition);
  }

  /** Short flame cone in front of the caster. */
  igniBurst(origin: Vector3, yaw: number): void {
    const ps = this.makeBurst("igni", 200);
    ps.emitter = origin.clone();
    ps.minEmitBox = new Vector3(-0.2, 0.6, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 1.2, 0.2);
    const forward = new Vector3(Math.sin(yaw), 0.1, Math.cos(yaw));
    ps.direction1 = forward.scale(6);
    ps.direction2 = forward.scale(10).add(new Vector3(0, 1.5, 0));
    ps.color1 = new Color4(1, 0.6, 0.1, 1);
    ps.color2 = new Color4(1, 0.3, 0, 1);
    ps.colorDead = new Color4(0.3, 0, 0, 0);
    ps.emitRate = 350;
    ps.start();
  }

  /** Radial blue shockwave around the caster. */
  aardBurst(origin: Vector3): void {
    const ps = this.makeBurst("aard", 300);
    ps.emitter = origin.clone();
    ps.createSphereEmitter(0.5, 0);
    ps.minEmitPower = 8;
    ps.maxEmitPower = 12;
    ps.color1 = new Color4(0.5, 0.7, 1, 1);
    ps.color2 = new Color4(0.8, 0.9, 1, 1);
    ps.colorDead = new Color4(0.2, 0.3, 0.6, 0);
    ps.emitRate = 600;
    ps.start();
  }

  private makeBurst(name: string, capacity: number): ParticleSystem {
    const ps = new ParticleSystem(name, capacity, this.scene);
    ps.particleTexture = this.texture;
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    ps.minSize = 0.15;
    ps.maxSize = 0.5;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.45;
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1.5;
    ps.updateSpeed = 0.016;
    ps.targetStopDuration = 0.3;
    ps.disposeOnStop = true; // fire-and-forget: no manual cleanup needed
    return ps;
  }

  dispose(): void {
    this.quenSphere.dispose();
    this.texture.dispose();
  }
}
```

(Note: `disposeOnStop` systems clean themselves up; the shared `texture` outlives them and is disposed here. Babylon does not dispose a particle system's texture on system dispose by default — exactly what we want for the shared texture.)

- [ ] **Step 2: Verify it compiles and lints**

Run: `pnpm test && pnpm check`
Expected: pass / 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/combat/signEffects.ts
git commit -m "feat: add particle VFX for igni, aard and quen"
```

---

### Task 12: HUD

**Files:**
- Modify: `src/ui/hud.svelte.ts`, `src/App.svelte`
- Create: `src/ui/Hud.svelte`

No unit test (UI; svelte-check covers types). Visual verification in Task 13.

- [ ] **Step 1: Extend the store** — replace `src/ui/hud.svelte.ts`:

```ts
import type { SignKind } from "../combat/signs";

export const hud = $state({
  fps: 0,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  selectedSign: "igni" as SignKind,
  /** Remaining cooldown per sign as a 0..1 fraction (0 = ready). */
  cooldowns: { igni: 0, aard: 0, quen: 0 } as Record<SignKind, number>,
  quenActive: false,
  dead: false,
});
```

- [ ] **Step 2: Create `src/ui/Hud.svelte`:**

```svelte
<script lang="ts">
  import { hud } from "./hud.svelte";

  const signs = [
    { kind: "igni", label: "Igni", key: "1" },
    { kind: "aard", label: "Aard", key: "2" },
    { kind: "quen", label: "Quen", key: "3" },
  ] as const;
</script>

<div class="bars">
  <div class="bar">
    <div
      class="fill health"
      style:width={`${(hud.health / hud.maxHealth) * 100}%`}
    ></div>
  </div>
  <div class="bar">
    <div
      class="fill stamina"
      style:width={`${(hud.stamina / hud.maxStamina) * 100}%`}
    ></div>
  </div>
</div>

<div class="signs">
  {#each signs as sign (sign.kind)}
    <div
      class="sign"
      class:selected={hud.selectedSign === sign.kind}
      class:lit={sign.kind === "quen" && hud.quenActive}
    >
      <span class="sign-label">{sign.label}</span>
      <span class="sign-key">{sign.key}</span>
      {#if hud.cooldowns[sign.kind] > 0}
        <div
          class="cooldown"
          style:height={`${hud.cooldowns[sign.kind] * 100}%`}
        ></div>
      {/if}
    </div>
  {/each}
</div>

{#if hud.dead}
  <div class="death" role="alert">
    <p class="death-title">You died</p>
    <p class="death-hint">Press Enter to try again</p>
  </div>
{/if}

<style>
  .bars {
    position: absolute;
    left: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 220px;
  }

  .bar {
    height: 12px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 3px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    transition: width 120ms linear;
  }

  .fill.health {
    background: #c0392b;
  }

  .fill.stamina {
    background: #27ae60;
  }

  .signs {
    position: absolute;
    right: 16px;
    bottom: 16px;
    display: flex;
    gap: 8px;
  }

  .sign {
    position: relative;
    width: 56px;
    height: 56px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 6px;
    color: #ddd;
    overflow: hidden;
  }

  .sign.selected {
    border-color: #f1c40f;
    color: #fff;
  }

  .sign.lit {
    box-shadow: 0 0 10px rgba(241, 196, 15, 0.8);
  }

  .sign-label {
    font-size: 13px;
    font-weight: 600;
  }

  .sign-key {
    font-size: 10px;
    opacity: 0.7;
  }

  .cooldown {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.65);
  }

  .death {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(20, 0, 0, 0.55);
    color: #eee;
  }

  .death-title {
    font-size: 42px;
    margin: 0 0 8px;
    color: #e74c3c;
  }

  .death-hint {
    font-size: 16px;
    margin: 0;
    opacity: 0.8;
  }
</style>
```

- [ ] **Step 3: Mount it** — in `src/App.svelte`, add to the script block:

```ts
import Hud from "./ui/Hud.svelte";
```

and inside `#overlay-root` (next to the FPS div):

```svelte
  <Hud />
```

- [ ] **Step 4: Verify checks pass**

Run: `pnpm test && pnpm check`
Expected: pass; svelte-check 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hud.svelte.ts src/ui/Hud.svelte src/App.svelte
git commit -m "feat: add combat HUD - health, stamina, signs, death overlay"
```

---

### Task 13: Integration — wolves in the zone, combat wiring, respawn

**Files:**
- Modify: `src/world/testZone.ts`, `src/core/game.ts`, `README.md`

- [ ] **Step 1: Replace the training dummy with wolf spawns** — in `src/world/testZone.ts`:

Replace the `TestZone` interface and the dummy block at the end of `buildTestZone`:

```ts
export interface TestZone {
  /** Capsule-center spawn positions for the wolf pack. */
  wolfSpawns: Vector3[];
}
```

Delete the `trainingDummy` capsule + material block entirely, and end the function with:

```ts
  return {
    wolfSpawns: [
      new Vector3(10, 1, 10),
      new Vector3(-12, 1, 6),
      new Vector3(8, 1, -14),
    ],
  };
```

- [ ] **Step 2: Rewrite `src/core/game.ts`:**

```ts
import { Vector3 } from "@babylonjs/core";
import { CameraRig } from "../actors/cameraRig";
import { Player } from "../actors/playerController";
import { Wolf, WOLF_BITE_DAMAGE, WOLF_BITE_HALF_ARC, WOLF_BITE_RANGE } from "../actors/wolf";
import { MELEE_ATTACKS } from "../combat/attacks";
import { inMeleeArc } from "../combat/hitArc";
import { SignEffects } from "../combat/signEffects";
import { AARD_EFFECT, IGNI_EFFECT } from "../combat/signs";
import { LockOn } from "../combat/targeting";
import { hud } from "../ui/hud.svelte";
import { buildTestZone } from "../world/testZone";
import { createEngine } from "./engine";
import { events } from "./events";
import { Input } from "./input";

const PLAYER_START = new Vector3(0, 2, 0);

export interface Game {
  dispose(): void;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<Game> {
  const { engine, scene } = await createEngine(canvas);
  const zone = buildTestZone(scene);

  const input = new Input();
  input.attach(window);

  const cameraRig = new CameraRig(scene, canvas);
  const player = new Player(scene, input, cameraRig);
  const wolves = zone.wolfSpawns.map((spawn) => new Wolf(scene, spawn));
  await Promise.all([
    player.loadModel(scene),
    ...wolves.map((wolf) => wolf.loadModel(scene)),
  ]);

  const signEffects = new SignEffects(scene);
  const lockOn = new LockOn<Wolf>();

  // Combat wiring: actors announce moments; the composition root applies them.
  player.onMeleeHit = (kind) => {
    const spec = MELEE_ATTACKS[kind];
    for (const wolf of wolves) {
      if (wolf.isDead) continue;
      if (inMeleeArc(player.position, player.yaw, wolf.position, spec.range, spec.halfArc)) {
        wolf.takeDamage(spec.damage);
      }
    }
  };
  player.onSignBlast = (kind) => {
    if (kind === "igni") {
      signEffects.igniBurst(player.position, player.yaw);
      for (const wolf of wolves) {
        if (wolf.isDead) continue;
        if (
          inMeleeArc(player.position, player.yaw, wolf.position, IGNI_EFFECT.range, IGNI_EFFECT.halfArc)
        ) {
          wolf.takeDamage(IGNI_EFFECT.damage);
        }
      }
    } else if (kind === "aard") {
      signEffects.aardBurst(player.position);
      for (const wolf of wolves) {
        if (wolf.isDead) continue;
        const dist = Math.hypot(
          wolf.position.x - player.position.x,
          wolf.position.z - player.position.z,
        );
        if (dist <= AARD_EFFECT.radius) {
          wolf.takeDamage(AARD_EFFECT.damage, true);
        }
      }
    } else {
      player.quen.activate(player.elapsed);
    }
  };
  for (const wolf of wolves) {
    wolf.onBite = () => {
      if (
        inMeleeArc(
          wolf.position,
          wolf.mesh.rotation.y,
          player.position,
          WOLF_BITE_RANGE,
          WOLF_BITE_HALF_ARC,
        )
      ) {
        player.takeDamage(WOLF_BITE_DAMAGE);
      }
    };
  }

  let wasDead = false;

  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);

    if (input.justPressed("lockToggle")) {
      lockOn.toggle(player.position.x, player.position.z, wolves);
    }
    lockOn.update(player.position.x, player.position.z);
    const lockPosition = lockOn.target?.position ?? null;
    player.lockTarget = lockPosition;
    cameraRig.lockTarget = lockPosition;

    player.update(dt);
    for (const wolf of wolves) {
      wolf.update(dt, player.position, player.isDead);
    }

    if (player.isDead && !wasDead) {
      events.emit("player:died", {});
    }
    wasDead = player.isDead;

    if (player.isDead && input.justPressed("respawn")) {
      player.respawn(PLAYER_START);
      for (const wolf of wolves) wolf.respawn();
      lockOn.target = null;
    }

    cameraRig.follow(player.position, dt);
    signEffects.updateQuen(player.quenActive, player.position);

    hud.health = player.health.current;
    hud.maxHealth = player.health.max;
    hud.stamina = player.stamina.current;
    hud.maxStamina = player.stamina.max;
    hud.selectedSign = player.signs.selected;
    hud.cooldowns.igni = player.signs.cooldownFraction("igni", player.elapsed);
    hud.cooldowns.aard = player.signs.cooldownFraction("aard", player.elapsed);
    hud.cooldowns.quen = player.signs.cooldownFraction("quen", player.elapsed);
    hud.quenActive = player.quenActive;
    hud.dead = player.isDead;

    input.endFrame();
  });

  let fpsAccumulator = 0;
  engine.runRenderLoop(() => {
    scene.render();
    fpsAccumulator += engine.getDeltaTime();
    if (fpsAccumulator > 500) {
      hud.fps = engine.getFps();
      fpsAccumulator = 0;
    }
  });

  const onResize = (): void => engine.resize();
  window.addEventListener("resize", onResize);

  events.emit("game:started", {});

  return {
    dispose(): void {
      window.removeEventListener("resize", onResize);
      input.detach(window);
      scene.onBeforeRenderObservable.remove(beforeRender);
      engine.stopRenderLoop();
      for (const wolf of wolves) wolf.dispose();
      player.dispose();
      signEffects.dispose();
      cameraRig.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
```

- [ ] **Step 3: Update README controls** — replace the controls table rows in `README.md`:

```markdown
| Input | Action |
|---|---|
| WASD / arrows | Move (camera-relative) |
| Shift | Sprint (drains stamina) |
| Space | Dodge roll (i-frames) |
| F | Light attack (3-hit combo) |
| R | Heavy attack |
| Q | Cast selected sign |
| 1 / 2 / 3 | Select Igni / Aard / Quen |
| Tab | Lock-on to nearest wolf |
| Enter | Respawn after death |
| Mouse drag / wheel | Orbit / zoom camera |
```

- [ ] **Step 4: Run all gates**

Run: `pnpm test && pnpm check && pnpm build`
Expected: all tests pass, 0 check errors, build succeeds.

- [ ] **Step 5: Dev sanity check (programmatic only)**

Start `pnpm dev`, fetch the page root with curl to confirm the server boots, then **kill the dev server**. Headless screenshots of WebGL are unreliable in this environment — do not attempt them. The visual checks below are for the controller/user.

- [ ] **Step 6: Commit**

```bash
git add src/world/testZone.ts src/core/game.ts README.md
git commit -m "feat: spawn wolf pack and wire combat, lock-on and respawn"
```

---

## Final verification (controller)

- [ ] `pnpm test` — all suites green (expect ~115+ tests)
- [ ] `pnpm check` — 0 errors, 0 warnings
- [ ] `pnpm build` — production build succeeds
- [ ] All plan checkboxes ticked; plan kept in sync with any review fixes

**Manual playtest checklist (user, in browser):**
- Wolves aggro when approached, gallop in, circle, and lunge with bites that cost health
- F-F-F chains the 3-hit combo; R lands a heavier chop; both stop when stamina runs out
- Sprint drains the green bar; it refills after a beat
- Space-roll through a lunging wolf takes no damage (i-frames)
- 1/2/3 + Q: Igni burns a flame cone (damages wolves in front), Aard knocks a blue burst (staggers nearby wolves), Quen shows a gold bubble that soaks the next bites
- Tab locks onto the nearest wolf (camera swings, strafe animations); lock drops when it dies
- Dying shows the overlay; Enter respawns player + wolves fresh
- Wolf model faces its direction of travel (if it runs backwards, flip `MODEL_YAW` to `Math.PI` in `wolf.ts`)
