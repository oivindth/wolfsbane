# Wolfsbane Phase 2: Character & Animation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the capsule with a rigged, animated KayKit Knight driven by an animation state machine (idle/walk/run/strafe/roll/attack/hit/death/fall), add camera collision, and a lock-on rig with a training dummy.

**Architecture:** The physics capsule stays the source of truth for movement (phase 1's `PhysicsCharacterController` is untouched); the GLB model is a pure visual parented under the player and scaled to the capsule. Animation selection is a pure, Vitest-covered state machine (`animationStates.ts`); only the thin `AnimationController` touches Babylon AnimationGroups (weight cross-fades). Camera collision uses a Havok raycast with membership masks so it never hits the player. Spec: `docs/superpowers/specs/2026-06-11-wolfsbane-vertical-slice-design.md`, phase 2.

**Tech Stack:** Babylon.js v9 (`ImportMeshAsync` + `@babylonjs/loaders` glTF), Havok raycasts, KayKit Adventurers CC0 assets (GitHub: `KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`), Vitest, Svelte 5.

**Verified facts (researched 2026-06-11, do not re-derive):**
- `Knight.glb` (3.6 MB) lives at `https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb`; license (CC0) at `.../main/LICENSE.txt`. Scene root node is `Rig`; animations are bundled in the GLB.
- Exact animation clip names used in this plan (verified by parsing the GLB): `Idle`, `Walking_A`, `Walking_Backwards`, `Running_A`, `Running_Strafe_Left`, `Running_Strafe_Right`, `Dodge_Forward`, `1H_Melee_Attack_Slice_Diagonal`, `Hit_A`, `Death_A`, `Jump_Idle`, `T-Pose` (ignore).
- Babylon v9 API: module-level `ImportMeshAsync(url, scene)` from `@babylonjs/core`; glTF loader registered via side-effect `import "@babylonjs/loaders/glTF/2.0";`. Result: `{ meshes, animationGroups, ... }`, `meshes[0]` = `__root__`. The loader auto-plays the FIRST animation group — stop all groups after import.
- AnimationGroup blending: `group.start(loop)`, then drive `group.weight` (0..1) per frame for cross-fades; `onAnimationGroupEndObservable` fires for non-looping groups.
- Havok raycast: `scene.getPhysicsEngine()?.raycastToRef(start, end, result, { collideWith: mask })`; shapes opt in via `aggregate.shape.filterMembershipMask`.

**Conventions for the executor:** Always `pnpm`, never npm. Never commit to `main`. End every commit message with the footer line `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (after a blank line). If Biome reformats given code, accept it (semantics must not change). Asset URLs in game code MUST be prefixed with `import.meta.env.BASE_URL` (GitHub Pages serves under `/wolfsbane/`).

---

### Task 1: Branch, dependency, and assets

**Files:**
- Create: `public/assets/characters/Knight.glb` (downloaded)
- Create: `public/assets/characters/KAYKIT_LICENSE.txt` (downloaded)
- Create: `public/assets/README.md`
- Modify: `package.json` (+ `@babylonjs/loaders`)

- [ ] **Step 1: Branch off up-to-date main**

```bash
cd /Users/oivind/repos/temp/game
git switch main && git pull
git switch -c feature/02-character
```

- [ ] **Step 2: Install the glTF loader package (must match @babylonjs/core major)**

```bash
pnpm add @babylonjs/loaders@^9
```

Expected: installs 9.x, no peer warnings.

- [ ] **Step 3: Download the assets**

```bash
mkdir -p public/assets/characters
curl -sL -o public/assets/characters/Knight.glb "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb"
curl -sL -o public/assets/characters/KAYKIT_LICENSE.txt "https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/main/LICENSE.txt"
ls -la public/assets/characters/
```

Expected: `Knight.glb` ≈ 3.6 MB (3659532 bytes), license file a few KB. If the download is tiny (<100 KB) it's an error page — stop and report BLOCKED.

- [ ] **Step 4: Write `public/assets/README.md`**

```markdown
# Asset sources & licenses

| Asset | Source | License |
|---|---|---|
| `characters/Knight.glb` | [KayKit Adventurers 1.0](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) by Kay Lousberg | CC0 (see `characters/KAYKIT_LICENSE.txt`) |
```

- [ ] **Step 5: Commit** (includes this plan document — it's untracked until now)

```bash
git add package.json pnpm-lock.yaml public/assets/ docs/superpowers/plans/2026-06-11-phase-02-character.md
git commit -m "feat: add KayKit Knight character asset and glTF loader"
```

---

### Task 2: Input upgrades — new actions and edge-press detection (TDD)

**Files:**
- Modify: `src/core/input.ts`
- Modify: `src/core/input.test.ts`

The game needs trigger-style actions (roll/attack fire once per key press, not per held frame). Add: new bindings (Space→roll, KeyF→attack, Tab→lockToggle, KeyH→debugHit, KeyK→debugDeath) and a `justPressed`/`endFrame` edge-detection API. Also `preventDefault` for bound keys in the DOM glue (Tab steals focus, Space scrolls).

- [ ] **Step 1: Add failing tests to `src/core/input.test.ts`** (run them, watch them fail before implementing)

```ts
  it("maps trigger keys to new actions", () => {
    const input = new Input();
    for (const [code, action] of [
      ["Space", "roll"],
      ["KeyF", "attack"],
      ["Tab", "lockToggle"],
      ["KeyH", "debugHit"],
      ["KeyK", "debugDeath"],
    ] as const) {
      input.handleKey(code, true);
      expect(input.isDown(action)).toBe(true);
    }
  });

  it("reports justPressed only until endFrame", () => {
    const input = new Input();
    input.handleKey("Space", true);
    expect(input.justPressed("roll")).toBe(true);
    input.endFrame();
    expect(input.justPressed("roll")).toBe(false); // still held, but not new
    expect(input.isDown("roll")).toBe(true);
  });

  it("reports justPressed again after release and re-press", () => {
    const input = new Input();
    input.handleKey("Space", true);
    input.endFrame();
    input.handleKey("Space", false);
    input.handleKey("Space", true);
    expect(input.justPressed("roll")).toBe(true);
  });

  it("clear() also clears justPressed", () => {
    const input = new Input();
    input.handleKey("Space", true);
    input.clear();
    expect(input.justPressed("roll")).toBe(false);
  });
```

Run: `pnpm vitest run src/core/input.test.ts` — expect the 4 new tests FAIL (unknown actions / missing methods), 7 old PASS.

- [ ] **Step 2: Implement in `src/core/input.ts`**

Extend the type and bindings:

```ts
export type Action =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "roll"
  | "attack"
  | "lockToggle"
  | "debugHit"
  | "debugDeath";

const DEFAULT_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  Space: "roll",
  KeyF: "attack",
  Tab: "lockToggle",
  KeyH: "debugHit", // temporary debug trigger, removed in phase 3
  KeyK: "debugDeath", // temporary debug trigger, removed in phase 3
};
```

Add edge detection (new field + methods; `handleKey` gains one line; `clear` extended):

```ts
  private pressed = new Set<Action>();
  private pressedThisFrame = new Set<Action>();

  handleKey(code: string, down: boolean): void {
    const action = this.bindings[code];
    if (!action) return;
    if (down) {
      if (!this.pressed.has(action)) {
        this.pressedThisFrame.add(action);
      }
      this.pressed.add(action);
    } else {
      this.pressed.delete(action);
    }
  }

  /** True if the action went down since the last endFrame(). */
  justPressed(action: Action): boolean {
    return this.pressedThisFrame.has(action);
  }

  /** Call once per game-loop frame, after all justPressed reads. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }

  /** Drop all pressed state — used on window blur so held keys don't stick. */
  clear(): void {
    this.pressed.clear();
    this.pressedThisFrame.clear();
  }
```

In the DOM glue, prevent browser defaults for bound keys (Tab focus, Space scroll):

```ts
  private onKeyDown = (event: Event): void => {
    if (event instanceof KeyboardEvent && this.bindings[event.code]) {
      event.preventDefault();
      if (!event.repeat) {
        this.handleKey(event.code, true);
      }
    }
  };
```

- [ ] **Step 3: Run tests** — `pnpm vitest run src/core/input.test.ts`: 11 pass. Then `pnpm test && pnpm check`: full suite green, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/core/input.ts src/core/input.test.ts
git commit -m "feat: add trigger actions and edge-press detection to input"
```

---

### Task 3: Pure animation state machine (TDD)

**Files:**
- Create: `src/actors/animationStates.ts`
- Create: `src/actors/animationStates.test.ts`

Pure logic, no Babylon imports. Two pieces: `selectLocomotion` (continuous states from movement) and `AnimStateMachine` (one-shot states with priorities: death > hit > roll ≈ attack; death is terminal; hit interrupts attack but not roll; one-shots can't be re-triggered while one is playing).

- [ ] **Step 1: Write the failing test `src/actors/animationStates.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { AnimStateMachine, selectLocomotion } from "./animationStates";

describe("selectLocomotion", () => {
  it("is idle when grounded and not moving", () => {
    expect(selectLocomotion({ speed: 0, localX: 0, localZ: 0, onGround: true, sprint: false })).toBe("idle");
  });

  it("walks when moving without sprint", () => {
    expect(selectLocomotion({ speed: 3, localX: 0, localZ: 1, onGround: true, sprint: false })).toBe("walk");
  });

  it("runs when sprinting", () => {
    expect(selectLocomotion({ speed: 6, localX: 0, localZ: 1, onGround: true, sprint: true })).toBe("run");
  });

  it("falls when airborne regardless of speed", () => {
    expect(selectLocomotion({ speed: 6, localX: 0, localZ: 1, onGround: false, sprint: true })).toBe("fall");
  });

  it("walks backwards when movement is mostly backward (lock-on strafing)", () => {
    expect(selectLocomotion({ speed: 3, localX: 0, localZ: -1, onGround: true, sprint: false })).toBe("walkBack");
  });

  it("strafes when movement is mostly sideways", () => {
    expect(selectLocomotion({ speed: 3, localX: -1, localZ: 0, onGround: true, sprint: false })).toBe("strafeLeft");
    expect(selectLocomotion({ speed: 3, localX: 1, localZ: 0, onGround: true, sprint: false })).toBe("strafeRight");
  });

  it("prefers forward over strafe on diagonals", () => {
    expect(selectLocomotion({ speed: 3, localX: 0.7, localZ: 0.71, onGround: true, sprint: false })).toBe("walk");
  });
});

describe("AnimStateMachine", () => {
  it("starts idle and follows locomotion", () => {
    const sm = new AnimStateMachine();
    expect(sm.current).toBe("idle");
    sm.setLocomotion("run");
    expect(sm.current).toBe("run");
  });

  it("plays a one-shot and ignores locomotion until it ends", () => {
    const sm = new AnimStateMachine();
    expect(sm.trigger("roll")).toBe(true);
    expect(sm.current).toBe("roll");
    sm.setLocomotion("walk");
    expect(sm.current).toBe("roll");
    sm.onOneShotEnd();
    sm.setLocomotion("walk");
    expect(sm.current).toBe("walk");
  });

  it("rejects a second one-shot while one is playing", () => {
    const sm = new AnimStateMachine();
    sm.trigger("attack");
    expect(sm.trigger("roll")).toBe(false);
    expect(sm.current).toBe("attack");
  });

  it("lets hit interrupt attack but not roll", () => {
    const sm = new AnimStateMachine();
    sm.trigger("attack");
    expect(sm.trigger("hit")).toBe(true);
    expect(sm.current).toBe("hit");

    const sm2 = new AnimStateMachine();
    sm2.trigger("roll");
    expect(sm2.trigger("hit")).toBe(false);
    expect(sm2.current).toBe("roll");
  });

  it("death interrupts everything and is terminal", () => {
    const sm = new AnimStateMachine();
    sm.trigger("roll");
    expect(sm.trigger("death")).toBe(true);
    expect(sm.current).toBe("death");
    sm.onOneShotEnd();
    sm.setLocomotion("run");
    expect(sm.current).toBe("death");
    expect(sm.trigger("attack")).toBe(false);
    expect(sm.isDead).toBe(true);
  });

  it("triggers hit while idle", () => {
    const sm = new AnimStateMachine();
    expect(sm.trigger("hit")).toBe(true);
    expect(sm.current).toBe("hit");
  });

  it("rejects re-triggering the same one-shot", () => {
    const sm = new AnimStateMachine();
    sm.trigger("attack");
    expect(sm.trigger("attack")).toBe(false);
    expect(sm.current).toBe("attack");
  });
});
```

- [ ] **Step 2: Run to verify FAIL** — `pnpm vitest run src/actors/animationStates.test.ts` (cannot resolve `./animationStates`).

- [ ] **Step 3: Write `src/actors/animationStates.ts`**

```ts
export type LocomotionState = "idle" | "walk" | "walkBack" | "strafeLeft" | "strafeRight" | "run" | "fall";
export type OneShotState = "roll" | "attack" | "hit" | "death";
export type AnimState = LocomotionState | OneShotState;

export interface LocomotionInput {
  /** Horizontal speed in m/s. */
  speed: number;
  /** Movement direction relative to character facing: +x = right, +z = forward. */
  localX: number;
  localZ: number;
  onGround: boolean;
  sprint: boolean;
}

const MOVE_EPSILON = 0.1;

/** Continuous animation state from movement. Pure; no Babylon imports. */
export function selectLocomotion(input: LocomotionInput): LocomotionState {
  if (!input.onGround) return "fall";
  if (input.speed < MOVE_EPSILON) return "idle";
  if (Math.abs(input.localX) > Math.abs(input.localZ)) {
    return input.localX < 0 ? "strafeLeft" : "strafeRight";
  }
  if (input.localZ < 0) return "walkBack";
  return input.sprint ? "run" : "walk";
}

/**
 * One-shot priority: death (terminal) > hit > roll/attack.
 * Hit interrupts attack but not roll (dodge keeps you safe); hit can also trigger freely from locomotion.
 * While a one-shot plays, locomotion changes are ignored.
 */
export class AnimStateMachine {
  current: AnimState = "idle";
  private oneShot: OneShotState | null = null;

  get isDead(): boolean {
    return this.current === "death";
  }

  trigger(state: OneShotState): boolean {
    if (this.isDead) return false;
    if (state === "death") {
      this.oneShot = "death";
      this.current = "death";
      return true;
    }
    if (this.oneShot === null) {
      this.oneShot = state;
      this.current = state;
      return true;
    }
    if (state === "hit" && this.oneShot === "attack") {
      this.oneShot = "hit";
      this.current = "hit";
      return true;
    }
    return false;
  }

  onOneShotEnd(): void {
    if (this.isDead) return; // death pose holds forever
    this.oneShot = null;
  }

  setLocomotion(state: LocomotionState): void {
    if (this.oneShot !== null || this.isDead) return;
    this.current = state;
  }
}
```

- [ ] **Step 4: Run tests** — 14 new tests pass; then `pnpm test && pnpm check` (41 passed) green.

- [ ] **Step 5: Commit**

```bash
git add src/actors/animationStates.ts src/actors/animationStates.test.ts
git commit -m "feat: add pure animation state machine"
```

---

### Task 4: Clip mapping data (TDD)

**Files:**
- Create: `src/data/knightAnimations.ts`
- Create: `src/data/knightAnimations.test.ts`

Maps every `AnimState` to a clip in `Knight.glb`. Lives in `src/data/` per the architecture (data, not logic). The completeness test prevents "added a state, forgot the clip" bugs.

- [ ] **Step 1: Write the failing test `src/data/knightAnimations.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import type { AnimState } from "../actors/animationStates";
import { KNIGHT_CLIPS } from "./knightAnimations";

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
  "hit",
  "death",
];

describe("KNIGHT_CLIPS", () => {
  it("covers every animation state", () => {
    for (const state of ALL_STATES) {
      expect(KNIGHT_CLIPS[state], `missing clip for ${state}`).toBeDefined();
    }
  });

  it("loops locomotion but not one-shots", () => {
    expect(KNIGHT_CLIPS.idle.loop).toBe(true);
    expect(KNIGHT_CLIPS.run.loop).toBe(true);
    expect(KNIGHT_CLIPS.roll.loop).toBe(false);
    expect(KNIGHT_CLIPS.death.loop).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**, then **Step 3: Write `src/data/knightAnimations.ts`**

```ts
import type { AnimState } from "../actors/animationStates";

export interface ClipConfig {
  /** AnimationGroup name inside Knight.glb (names verified against the asset). */
  clip: string;
  loop: boolean;
  /** Playback speed multiplier. */
  speed: number;
}

export const KNIGHT_CLIPS: Record<AnimState, ClipConfig> = {
  idle: { clip: "Idle", loop: true, speed: 1 },
  walk: { clip: "Walking_A", loop: true, speed: 1 },
  walkBack: { clip: "Walking_Backwards", loop: true, speed: 1 },
  strafeLeft: { clip: "Running_Strafe_Left", loop: true, speed: 0.7 },
  strafeRight: { clip: "Running_Strafe_Right", loop: true, speed: 0.7 },
  run: { clip: "Running_A", loop: true, speed: 1 },
  fall: { clip: "Jump_Idle", loop: true, speed: 1 },
  roll: { clip: "Dodge_Forward", loop: false, speed: 1.3 },
  attack: { clip: "1H_Melee_Attack_Slice_Diagonal", loop: false, speed: 1.2 },
  hit: { clip: "Hit_A", loop: false, speed: 1 },
  death: { clip: "Death_A", loop: false, speed: 1 },
};
```

(The pack has no walk-speed strafes, only `Running_Strafe_*` — played at 0.7 speed they read fine for walking; revisit in phase 3 polish if needed.)

- [ ] **Step 4: Run tests** — 2 pass; full suite + checks green.

- [ ] **Step 5: Commit**

```bash
git add src/data/knightAnimations.ts src/data/knightAnimations.test.ts
git commit -m "feat: map animation states to Knight clips"
```

---

### Task 5: Character model loader

**Files:**
- Create: `src/actors/characterModel.ts`
- Modify: `src/core/engine.ts` (register glTF loader)

Engine glue (no unit tests; verified in browser in Task 6). Loads the GLB, scales it to the physics capsule height, returns the root node + animation groups by name.

- [ ] **Step 1: Register the glTF loader in `src/core/engine.ts`** — add as the FIRST import line:

```ts
import "@babylonjs/loaders/glTF/2.0";
```

- [ ] **Step 2: Write `src/actors/characterModel.ts`**

```ts
import {
  type AnimationGroup,
  ImportMeshAsync,
  type Scene,
  TransformNode,
} from "@babylonjs/core";

export interface CharacterModel {
  /** Parent this under the player root; origin at the character's feet. */
  root: TransformNode;
  /** Animation groups keyed by clip name (e.g. "Idle", "Running_A"). */
  animations: Map<string, AnimationGroup>;
}

/**
 * Loads a rigged GLB and scales it so its bounding height equals
 * targetHeight (the physics capsule height stays the source of truth).
 */
export async function loadCharacterModel(
  url: string,
  scene: Scene,
  targetHeight: number,
): Promise<CharacterModel> {
  const result = await ImportMeshAsync(url, scene);

  // The glTF loader auto-plays the first animation group — stop everything.
  for (const group of result.animationGroups) {
    group.stop();
  }

  const glbRoot = result.meshes[0];
  if (!glbRoot) {
    throw new Error(`No meshes in ${url}`);
  }

  const { min, max } = glbRoot.getHierarchyBoundingVectors(true);
  const modelHeight = max.y - min.y;
  const scale = modelHeight > 0 ? targetHeight / modelHeight : 1;

  const root = new TransformNode("characterRoot", scene);
  glbRoot.parent = root;
  glbRoot.scaling.scaleInPlace(scale);

  const animations = new Map<string, AnimationGroup>();
  for (const group of result.animationGroups) {
    animations.set(group.name, group);
  }

  return { root, animations };
}
```

- [ ] **Step 3: Verify it compiles** — `pnpm check` exit 0 (nothing calls it yet; browser verification comes with Task 6).

- [ ] **Step 4: Commit**

```bash
git add src/core/engine.ts src/actors/characterModel.ts
git commit -m "feat: add GLB character model loader"
```

---### Task 6: Animation controller and player integration

**Files:**
- Create: `src/actors/animationController.ts`
- Modify: `src/actors/playerController.ts`
- Modify: `src/core/game.ts`

The capsule becomes an invisible collision proxy; the Knight is the visual. The `AnimationController` cross-fades AnimationGroup weights toward the state machine's current state and reports one-shot ends.

- [ ] **Step 1: Write `src/actors/animationController.ts`**

```ts
import type { AnimationGroup } from "@babylonjs/core";
import type { AnimState } from "./animationStates";
import type { ClipConfig } from "../data/knightAnimations";

const FADE_SECONDS = 0.15;

/**
 * Plays exactly one logical state at a time, cross-fading AnimationGroup
 * weights. One-shot (non-looping) clips invoke onOneShotEnd when done.
 */
export class AnimationController {
  private active: AnimState | null = null;
  private playing = new Map<AnimState, AnimationGroup>();

  constructor(
    private clips: Record<AnimState, ClipConfig>,
    private animations: Map<string, AnimationGroup>,
    private onOneShotEnd: () => void,
  ) {}

  /** Switch target state; no-op if already active. */
  play(state: AnimState): void {
    if (state === this.active) return;
    const config = this.clips[state];
    const group = this.animations.get(config.clip);
    if (!group) {
      console.warn(`Missing animation clip "${config.clip}" for state "${state}"`);
      return;
    }
    if (!this.playing.has(state)) {
      group.start(config.loop, config.speed);
      group.setWeightForAllAnimatables(0);
      if (!config.loop) {
        // addOnce: a re-triggered one-shot must not stack end-handlers.
        group.onAnimationGroupEndObservable.addOnce(() => {
          if (this.active === state) {
            this.onOneShotEnd();
          }
          this.playing.delete(state);
        });
      }
      this.playing.set(state, group);
    }
    this.active = state;
  }

  /** Stop and dispose every animation group this controller owns. */
  dispose(): void {
    for (const group of this.animations.values()) {
      group.dispose();
    }
    this.playing.clear();
    this.active = null;
  }

  /** Per-frame weight fade toward the active state. */
  update(dt: number): void {
    const step = dt / FADE_SECONDS;
    for (const [state, group] of this.playing) {
      const target = state === this.active ? 1 : 0;
      // play() initializes weight to 0; the -1 guard is defensive only
      // (Babylon's unset-weight sentinel).
      const current = group.weight === -1 ? 1 : group.weight;
      const next = current + Math.sign(target - current) * Math.min(step, Math.abs(target - current));
      group.setWeightForAllAnimatables(next);
      if (next === 0 && state !== this.active && this.clips[state].loop) {
        group.stop();
        this.playing.delete(state);
      }
    }
  }
}
```

- [ ] **Step 2: Rewrite `src/actors/playerController.ts`** — full new content:

```ts
import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import type { Input } from "../core/input";
import { KNIGHT_CLIPS } from "../data/knightAnimations";
import { AnimationController } from "./animationController";
import { AnimStateMachine, selectLocomotion } from "./animationStates";
import type { CameraRig } from "./cameraRig";
import { loadCharacterModel } from "./characterModel";
import { computeMoveVelocity, lerpAngle } from "./movement";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;
const ROLL_SPEED = 6;

// Capsule dimensions, camera follow offset (cameraRig.ts) and the model
// scaling in characterModel.ts are a coupled set — change together.
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;

export class Player {
  readonly mesh: Mesh;
  private controller: PhysicsCharacterController;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  /** Set by game.ts when lock-on is active; player faces this point. */
  lockTarget: Vector3 | null = null;

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
    this.animController = new AnimationController(KNIGHT_CLIPS, model.animations, () =>
      this.stateMachine.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  get isDead(): boolean {
    return this.stateMachine.isDead;
  }

  update(dt: number): void {
    const support = this.controller.checkSupport(dt, DOWN);
    const onGround = support.supportedState === CharacterSupportedState.SUPPORTED;

    // One-shot triggers (ignored while dead or mid-one-shot by the state machine).
    if (this.input.justPressed("roll")) this.stateMachine.trigger("roll");
    if (this.input.justPressed("attack")) this.stateMachine.trigger("attack");
    if (this.input.justPressed("debugHit")) this.stateMachine.trigger("hit");
    if (this.input.justPressed("debugDeath")) this.stateMachine.trigger("death");

    const current = this.stateMachine.current;
    let velocity = computeMoveVelocity(
      {
        forward: this.input.isDown("forward"),
        back: this.input.isDown("back"),
        left: this.input.isDown("left"),
        right: this.input.isDown("right"),
        sprint: this.input.isDown("sprint"),
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
      current === "attack" ||
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
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, this.targetYaw, TURN_RATE * dt);

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
        sprint: this.input.isDown("sprint"),
      }),
    );

    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
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

- [ ] **Step 3: Wire into `src/core/game.ts`** — after `const player = new Player(...)`, add:

```ts
  await player.loadModel(scene);
```

and at the END of the `onBeforeRenderObservable` callback (after `cameraRig.follow(...)`), add:

```ts
    input.endFrame();
```

- [ ] **Step 4: Verify** — `pnpm test && pnpm check` green. Then browser: `pnpm dev` (background), use Playwright tools on http://localhost:5173 — expect the Knight (not a capsule) standing on the ground playing Idle; WASD walks with walk anim; Shift runs; Space rolls (forward burst); F swings the sword; H flinches; K dies and input stops. No console errors. Kill the server.

- [ ] **Step 5: Commit**

```bash
git add src/actors/animationController.ts src/actors/playerController.ts src/core/game.ts
git commit -m "feat: animated Knight character with state-driven clips"
```

---

### Task 7: Camera collision

**Files:**
- Create: `src/core/collisionMasks.ts`
- Modify: `src/world/testZone.ts`
- Modify: `src/actors/cameraRig.ts`
- Modify: `src/core/game.ts`

Havok raycast from the camera target toward the desired camera position; on hit, pull the camera in. Membership masks keep the ray from hitting the player.

- [ ] **Step 1: Write `src/core/collisionMasks.ts`**

```ts
/** Havok filterMembershipMask bits. World geometry blocks the camera. */
export const MASK_WORLD = 1;
```

- [ ] **Step 2: Tag world geometry in `src/world/testZone.ts`** — after creating each `PhysicsAggregate` (ground and obstacle boxes), set its mask. Example for the ground (same pattern for boxes inside the loop):

```ts
import { MASK_WORLD } from "../core/collisionMasks";
// ...
const groundPhysics = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
groundPhysics.shape.filterMembershipMask = MASK_WORLD;
```

(Rename the `_groundPhysics`/`_boxPhysics` underscore variables — they're used now.)

- [ ] **Step 3: Add collision to `src/actors/cameraRig.ts`** — full new content:

```ts
import {
  ArcRotateCamera,
  PhysicsEngineV2,
  PhysicsRaycastResult,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { MASK_WORLD } from "../core/collisionMasks";

const COLLISION_MARGIN = 0.3;

export class CameraRig {
  readonly camera: ArcRotateCamera;
  private readonly directionScratch = new Vector3();
  private readonly rayEndScratch = new Vector3();
  private readonly raycastResult = new PhysicsRaycastResult();
  private desiredRadius: number;
  private clamped = false;

  constructor(
    private scene: Scene,
    canvas: HTMLCanvasElement,
  ) {
    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.2,
      8,
      new Vector3(0, 1.5, 0),
      scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 12;
    this.camera.upperBetaLimit = 1.45;
    this.camera.wheelDeltaPercentage = 0.01;
    this.desiredRadius = this.camera.radius;
  }

  /** World yaw of the camera's view direction (left-handed, +Z = 0). */
  get yaw(): number {
    this.camera.target.subtractToRef(this.camera.position, this.directionScratch);
    return Math.atan2(this.directionScratch.x, this.directionScratch.z);
  }

  follow(position: Vector3): void {
    this.camera.target.copyFrom(position);
    this.camera.target.y += 1.2;
    this.updateCollision();
  }

  /** Pull the camera in when world geometry blocks the view line. */
  private updateCollision(): void {
    const physics = this.scene.getPhysicsEngine();
    if (!physics || !(physics instanceof PhysicsEngineV2)) return;
    // While unobstructed, track the user's zoom as the desired radius.
    if (!this.clamped) {
      this.desiredRadius = this.camera.radius;
    }
    this.camera.position.subtractToRef(this.camera.target, this.directionScratch);
    this.directionScratch.normalize();
    this.rayEndScratch.copyFrom(this.camera.target);
    this.directionScratch.scaleAndAddToRef(this.desiredRadius, this.rayEndScratch);
    physics.raycastToRef(this.camera.target, this.rayEndScratch, this.raycastResult, {
      collideWith: MASK_WORLD,
    });
    if (this.raycastResult.hasHit) {
      this.raycastResult.hitPointWorld.subtractToRef(this.camera.target, this.directionScratch);
      const distance = this.directionScratch.length();
      this.camera.radius = Math.max(distance - COLLISION_MARGIN, this.camera.lowerRadiusLimit ?? 1);
      this.clamped = true;
    } else {
      if (this.clamped) {
        this.camera.radius = this.desiredRadius;
        this.clamped = false;
      }
    }
  }

  dispose(): void {
    this.camera.dispose();
  }
}
```

(Constructor signature changed: `scene` is now a stored private field — `game.ts` already passes it first, no call-site change needed.)

- [ ] **Step 4: Verify** — `pnpm test && pnpm check` green. Browser: orbit the camera so a box sits between camera and Knight — the camera should snap closer instead of clipping through the box, and zoom back out when clear. Kill the server.

- [ ] **Step 5: Commit**

```bash
git add src/core/collisionMasks.ts src/world/testZone.ts src/actors/cameraRig.ts
git commit -m "feat: camera collision via Havok raycast"
```

---

### Task 8: Lock-on rig with training dummy

**Files:**
- Modify: `src/world/testZone.ts` (training dummy)
- Modify: `src/actors/cameraRig.ts` (lock-on alpha steering)
- Modify: `src/core/game.ts` (Tab toggle wiring)

A lockable training dummy stands in the zone. Tab toggles lock-on: the camera eases behind the player relative to the dummy, and the player faces the dummy (strafe/backpedal animations from Task 6 become visible).

- [ ] **Step 1: Add the dummy to `src/world/testZone.ts`** — change the function signature to return it:

```ts
export interface TestZone {
  /** Lock-on target for phase 2; replaced by real enemies in phase 3. */
  dummyPosition: Vector3;
}

export function buildTestZone(scene: Scene): TestZone {
  // ... existing content unchanged ...

  const dummy = MeshBuilder.CreateCapsule("trainingDummy", { height: 1.8, radius: 0.4 }, scene);
  const dummyMat = new StandardMaterial("dummyMat", scene);
  dummyMat.diffuseColor = new Color3(0.7, 0.25, 0.2);
  dummy.material = dummyMat;
  dummy.position = new Vector3(4, 0.9, -4);

  return { dummyPosition: dummy.position };
}
```

(No physics body on the dummy — it's a visual lock target only.)

- [ ] **Step 2: Add lock-on steering to `src/actors/cameraRig.ts`** — add a field, a method, and steering inside `follow`:

```ts
import { lerpAngle } from "./movement";

const LOCK_STEER_RATE = 5;

  /** Point the camera keeps centered while locked on; null = free camera. */
  lockTarget: Vector3 | null = null;

  follow(position: Vector3): void {
    this.camera.target.copyFrom(position);
    this.camera.target.y += 1.2;
    if (this.lockTarget) {
      // Ease the camera to sit behind the player relative to the target.
      const dx = position.x - this.lockTarget.x;
      const dz = position.z - this.lockTarget.z;
      const desiredAlpha = Math.atan2(dz, dx);
      const dt = this.scene.getEngine().getDeltaTime() / 1000;
      this.camera.alpha = lerpAngle(this.camera.alpha, desiredAlpha, LOCK_STEER_RATE * dt);
    }
    this.updateCollision();
  }
```

- [ ] **Step 3: Wire the toggle in `src/core/game.ts`** — `buildTestZone` now returns the zone; capture it and handle Tab inside the `onBeforeRenderObservable` callback BEFORE `player.update(dt)`:

```ts
  const zone = buildTestZone(scene);
  // ...
    if (input.justPressed("lockToggle")) {
      const locked = cameraRig.lockTarget !== null;
      cameraRig.lockTarget = locked ? null : zone.dummyPosition;
      player.lockTarget = locked ? null : zone.dummyPosition;
    }
```

- [ ] **Step 4: Verify** — `pnpm test && pnpm check` green. Browser: press Tab near the red dummy — camera swings behind the Knight facing the dummy; A/D now strafe (strafe clips), S backpedals (Walking_Backwards); Tab again releases. Camera still collides with boxes while locked. Kill the server.

- [ ] **Step 5: Commit**

```bash
git add src/world/testZone.ts src/actors/cameraRig.ts src/core/game.ts
git commit -m "feat: lock-on rig with training dummy"
```

---

### Task 9: Phase wrap-up

**Files:**
- Modify: `README.md` (controls table)
- Modify: `docs/superpowers/plans/2026-06-11-phase-02-character.md` (checkboxes)

- [ ] **Step 1: Add a controls section to `README.md`** (after the "Play it" paragraph):

```markdown
## Controls

| Input | Action |
|---|---|
| WASD / arrows | Move (camera-relative) |
| Shift | Sprint |
| Space | Dodge roll |
| F | Attack |
| Tab | Lock-on toggle (training dummy) |
| Mouse drag / wheel | Orbit / zoom camera |
| H / K | Debug: flinch / die (removed in phase 3) |
```

- [ ] **Step 2: Full verification**

```bash
pnpm test && pnpm check && pnpm build
```

Expected: all tests pass (23 prior + 20 new = 43), checks exit 0, build OK. Full browser playthrough of every Task 6–8 verification point in one session.

- [ ] **Step 3: Flip all `- [ ]` checkboxes in this plan to `- [x]`, commit**

```bash
git add README.md docs/superpowers/plans/2026-06-11-phase-02-character.md
git commit -m "docs: controls table and phase 2 plan close-out"
```

- [ ] **Step 4: Finish the branch** — use superpowers:finishing-a-development-branch (PR to main; merging deploys to GitHub Pages automatically).

---

## Self-review notes

- Spec coverage (phase 2 = "rigged GLB, animation state machine, camera collision + lock-on"): GLB in Tasks 1+5, state machine Tasks 3+4+6, camera collision Task 7, lock-on Task 8. The spec's "Verify: animation transitions look right in-browser" is Task 6/9's browser check.
- Asset facts (URLs, clip names, file size, root node) were verified against the real GLB before writing; the completeness test in Task 4 guards the state↔clip mapping.
- Type consistency: `AnimState`/`LocomotionState`/`OneShotState` (Task 3) feed `KNIGHT_CLIPS: Record<AnimState, ClipConfig>` (Task 4), `AnimationController(clips, animations, onOneShotEnd)` (Task 6), `loadCharacterModel(url, scene, targetHeight): Promise<CharacterModel>` (Task 5) consumed in `Player.loadModel` (Task 6). `CameraRig` gains `lockTarget`/`updateCollision` (Tasks 7–8); `Player.lockTarget` mirrors it (Task 6 declares it, Task 8 wires it).
- Known risk, called out for the executor: `PhysicsCharacterController` may or may not be visible to Havok raycasts; masks (`collideWith: MASK_WORLD`) make this moot. If character collision against boxes breaks after adding masks (Task 7 verify step), report it — don't silently re-tune masks.
