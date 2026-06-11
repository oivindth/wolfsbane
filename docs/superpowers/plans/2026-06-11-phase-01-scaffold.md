# Wolfsbane Phase 1: Scaffold & First Render — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walkable 3D scene in the browser — capsule player on a ground plane with obstacles, WASD movement relative to a third-person orbit camera, Havok physics, Svelte overlay showing FPS — all at 60 fps.

**Architecture:** Babylon.js scene driven by a `startGame()` bootstrap; pure-logic modules (event bus, input mapping, movement math) have zero Babylon imports and are Vitest-covered; Svelte 5 owns the DOM overlay and reads reactive state the game loop writes. Spec: `docs/superpowers/specs/2026-06-11-wolfsbane-vertical-slice-design.md`.

**Tech Stack:** pnpm, Vite, TypeScript (strict), Svelte 5 (runes), Babylon.js v9 (`@babylonjs/core`), Havok (`@babylonjs/havok`), Vitest, Biome, svelte-check.

**Conventions for the executor:**
- Always `pnpm`, never `npm`/`npx`. (`pnpm biome …` / `pnpm vitest …` run the locally installed binaries.)
- The scaffold is hand-written, not `create vite`, because the directory already contains `docs/` and the interactive scaffolder can't run non-interactively in a non-empty directory.
- Commit messages: conventional commits. Never commit to `main`.

---

### Task 1: Git repo + planning docs

**Files:**
- Create: `.gitignore`

- [x] **Step 1: Initialize the repo with an empty root commit on main**

```bash
cd /Users/oivind/repos/temp/game
git init -b main
git commit --allow-empty -m "chore: repo root"
git switch -c feature/01-scaffold
```

Expected: `Switched to a new branch 'feature/01-scaffold'`. All further commits happen on this branch.

- [x] **Step 2: Create `.gitignore`**

```gitignore
node_modules/
dist/
*.local
.DS_Store
```

- [x] **Step 3: Commit the planning docs (already present in `docs/`) and .gitignore**

```bash
git add .gitignore docs/
git commit -m "docs: add Wolfsbane vertical-slice spec and phase 1 plan"
```

---

### Task 2: Project scaffold (Vite + Svelte 5 + TypeScript)

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `svelte.config.js`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/App.svelte`
- Create: `src/style.css`
- Create: `src/core/game.ts` (stub — replaced in Task 8)

- [x] **Step 1: Write `package.json`**

```json
{
  "name": "wolfsbane",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "biome check . && svelte-check --tsconfig ./tsconfig.json",
    "format": "biome format --write ."
  }
}
```

- [x] **Step 2: Install dependencies**

```bash
pnpm add @babylonjs/core @babylonjs/havok
pnpm add -D vite typescript svelte @sveltejs/vite-plugin-svelte @tsconfig/svelte svelte-check vitest @biomejs/biome
```

Expected: lockfile created, no peer-dependency errors. (`@babylonjs/loaders` is deliberately deferred to Phase 2 — nothing loads GLB yet.)

- [x] **Step 3: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    // Vite's dep pre-bundling breaks @babylonjs/havok's WASM URL resolution.
    exclude: ["@babylonjs/havok"],
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

- [x] **Step 4: Write `svelte.config.js`**

```js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
  preprocess: vitePreprocess(),
};
```

- [x] **Step 5: Write `tsconfig.json`**

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.svelte", "vite.config.ts"]
}
```

- [x] **Step 6: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Wolfsbane</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [x] **Step 7: Write `src/style.css`**

```css
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: #000;
  font-family: system-ui, sans-serif;
}

#app {
  height: 100%;
}
```

- [x] **Step 8: Write `src/main.ts`**

```ts
import { mount } from "svelte";
import App from "./App.svelte";
import "./style.css";

const target = document.getElementById("app");
if (!target) {
  throw new Error("#app mount point not found");
}

const app = mount(App, { target });

export default app;
```

- [x] **Step 9: Write the stub `src/core/game.ts`** (real implementation lands in Task 8)

```ts
export interface Game {
  dispose(): void;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<Game> {
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#223";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  console.log("Wolfsbane: game stub started");
  return { dispose() {} };
}
```

- [x] **Step 10: Write `src/App.svelte`**

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { type Game, startGame } from "./core/game";

  let canvas: HTMLCanvasElement | undefined = $state();

  onMount(() => {
    let game: Game | undefined;
    if (canvas) {
      startGame(canvas).then((g) => {
        game = g;
      });
    }
    return () => game?.dispose();
  });
</script>

<canvas bind:this={canvas} id="game-canvas"></canvas>
<div id="overlay-root"></div>

<style>
  #game-canvas {
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
  }

  #overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
```

- [x] **Step 11: Verify the dev server runs**

```bash
pnpm dev
```

Open http://localhost:5173 — expect a dark page and the console log `Wolfsbane: game stub started`. Stop the server.

- [x] **Step 12: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts svelte.config.js tsconfig.json index.html src/
git commit -m "chore: scaffold Vite + Svelte 5 + Babylon project"
```

---

### Task 3: Quality tooling (Biome, Vitest, svelte-check)

**Files:**
- Create: `biome.json` (generated, then adjusted)
- Create: `src/core/smoke.test.ts` (deleted again in Task 4)

- [x] **Step 1: Generate the Biome config**

```bash
pnpm biome init
```

Expected: `biome.json` created.

- [x] **Step 2: Adjust `biome.json`** — keep the generated `$schema`/version line as-is, ensure these settings (merge into the generated file):

```json
{
  "files": {
    "includes": ["src/**", "*.ts", "*.js", "*.json"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- [x] **Step 3: Write a smoke test `src/core/smoke.test.ts`**

```ts
import { describe, expect, it } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [x] **Step 4: Verify all three tools pass**

```bash
pnpm biome check --write .
pnpm test
pnpm check
```

Expected: Biome applies/passes formatting; Vitest reports `1 passed`; `pnpm check` exits 0 (svelte-check: 0 errors).

- [x] **Step 5: Commit**

```bash
git add biome.json src/core/smoke.test.ts package.json
git commit -m "chore: add biome, vitest, svelte-check tooling"
```

---

### Task 4: Typed event bus (foundational for all later phases)

**Files:**
- Create: `src/core/events.ts`
- Create: `src/core/events.test.ts`
- Delete: `src/core/smoke.test.ts`

- [x] **Step 1: Write the failing test `src/core/events.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { EventBus } from "./events";

interface TestEvents extends Record<string, unknown> {
  "test:fired": { value: number };
  "test:other": { name: string };
}

describe("EventBus", () => {
  it("delivers payloads to subscribed handlers", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on("test:fired", (p) => received.push(p.value));
    bus.emit("test:fired", { value: 42 });
    expect(received).toEqual([42]);
  });

  it("supports multiple handlers per event", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.on("test:fired", () => count++);
    bus.on("test:fired", () => count++);
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(2);
  });

  it("does not deliver to other events", () => {
    const bus = new EventBus<TestEvents>();
    let called = false;
    bus.on("test:other", () => {
      called = true;
    });
    bus.emit("test:fired", { value: 1 });
    expect(called).toBe(false);
  });

  it("stops delivering after unsubscribe via returned function", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const unsubscribe = bus.on("test:fired", () => count++);
    bus.emit("test:fired", { value: 1 });
    unsubscribe();
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(1);
  });

  it("stops delivering after off()", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const handler = () => count++;
    bus.on("test:fired", handler);
    bus.off("test:fired", handler);
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(0);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/core/events.test.ts
```

Expected: FAIL — `Cannot find module './events'` (or equivalent).

- [x] **Step 3: Write `src/core/events.ts`**

```ts
/**
 * Game-wide event map. Systems add their events here as they land
 * (e.g. "enemy:killed", "quest:advanced", "time:nightfall").
 */
export interface GameEvents extends Record<string, unknown> {
  "game:started": Record<string, never>;
}

type Handler = (payload: unknown) => void;

export class EventBus<E extends Record<string, unknown> = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler>>();

  on<K extends keyof E>(event: K, handler: (payload: E[K]) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof E>(event: K, handler: (payload: E[K]) => void): void {
    this.handlers.get(event)?.delete(handler as Handler);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

/** The single game-wide bus. Import this everywhere except tests. */
export const events = new EventBus();
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run src/core/events.test.ts
```

Expected: PASS — 5 tests.

- [x] **Step 5: Delete the smoke test, run the full suite and checks**

```bash
rm src/core/smoke.test.ts
pnpm test && pnpm check
```

Expected: 5 passed; checks exit 0.

- [x] **Step 6: Commit**

```bash
git add src/core/events.ts src/core/events.test.ts
git rm src/core/smoke.test.ts
git commit -m "feat: add typed event bus"
```

---

### Task 5: Input action mapping

**Files:**
- Create: `src/core/input.ts`
- Create: `src/core/input.test.ts`

The DOM listener glue is deliberately thin; the testable logic is `handleKey`/`isDown`, which need no DOM.

- [x] **Step 1: Write the failing test `src/core/input.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("reports no actions by default", () => {
    const input = new Input();
    expect(input.isDown("forward")).toBe(false);
  });

  it("maps KeyW to forward", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    expect(input.isDown("forward")).toBe(true);
    input.handleKey("KeyW", false);
    expect(input.isDown("forward")).toBe(false);
  });

  it("maps WASD, arrows and shift to actions", () => {
    const input = new Input();
    for (const [code, action] of [
      ["KeyS", "back"],
      ["KeyA", "left"],
      ["KeyD", "right"],
      ["ArrowUp", "forward"],
      ["ShiftLeft", "sprint"],
    ] as const) {
      input.handleKey(code, true);
      expect(input.isDown(action)).toBe(true);
    }
  });

  it("ignores unbound keys", () => {
    const input = new Input();
    input.handleKey("KeyZ", true);
    expect(input.isDown("forward")).toBe(false);
    expect(input.isDown("back")).toBe(false);
    expect(input.isDown("left")).toBe(false);
    expect(input.isDown("right")).toBe(false);
    expect(input.isDown("sprint")).toBe(false);
  });

  it("tracks multiple simultaneous actions", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    input.handleKey("KeyA", true);
    expect(input.isDown("forward")).toBe(true);
    expect(input.isDown("left")).toBe(true);
  });

  it("clears all pressed actions", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    input.handleKey("ShiftLeft", true);
    input.clear();
    expect(input.isDown("forward")).toBe(false);
    expect(input.isDown("sprint")).toBe(false);
  });

  it("respects custom bindings", () => {
    const input = new Input({ KeyJ: "forward" });
    input.handleKey("KeyJ", true);
    expect(input.isDown("forward")).toBe(true);
    input.handleKey("KeyW", true);
    expect(input.isDown("forward")).toBe(true);
    expect(input.isDown("back")).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/core/input.test.ts
```

Expected: FAIL — `Cannot find module './input'`.

- [x] **Step 3: Write `src/core/input.ts`**

```ts
export type Action = "forward" | "back" | "left" | "right" | "sprint";

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
};

export class Input {
  private pressed = new Set<Action>();
  private bindings: Record<string, Action>;

  constructor(bindings: Record<string, Action> = { ...DEFAULT_BINDINGS }) {
    this.bindings = bindings;
  }

  handleKey(code: string, down: boolean): void {
    const action = this.bindings[code];
    if (!action) return;
    if (down) {
      this.pressed.add(action);
    } else {
      this.pressed.delete(action);
    }
  }

  isDown(action: Action): boolean {
    return this.pressed.has(action);
  }

  /** Drop all pressed state — used on window blur so held keys don't stick. */
  clear(): void {
    this.pressed.clear();
  }

  private onKeyDown = (event: Event): void => {
    if (event instanceof KeyboardEvent && !event.repeat) {
      this.handleKey(event.code, true);
    }
  };

  private onKeyUp = (event: Event): void => {
    if (event instanceof KeyboardEvent) {
      this.handleKey(event.code, false);
    }
  };

  private onBlur = (): void => {
    this.clear();
  };

  attach(target: EventTarget): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  detach(target: EventTarget): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.onBlur);
  }
}
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run src/core/input.test.ts
```

Expected: PASS — 7 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/input.ts src/core/input.test.ts docs/superpowers/plans/2026-06-11-phase-01-scaffold.md
git commit -m "fix: clear held input actions on window blur"
```

---

### Task 6: Camera-relative movement math (pure, TDD)

**Files:**
- Create: `src/actors/movement.ts`
- Create: `src/actors/movement.test.ts`

Pure functions with no Babylon imports. Conventions: left-handed Babylon world, yaw measured from +Z toward +X, `yaw = atan2(x, z)`.

- [x] **Step 1: Write the failing test `src/actors/movement.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { computeMoveVelocity, lerpAngle, type MoveInput } from "./movement";

const NO_INPUT: MoveInput = { forward: false, back: false, left: false, right: false, sprint: false };
const WALK = 3;
const SPRINT = 6;

describe("computeMoveVelocity", () => {
  it("is zero with no input on the ground", () => {
    const v = computeMoveVelocity(NO_INPUT, 0, true, 0, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("moves forward along +Z at walk speed when camera yaw is 0", () => {
    const v = computeMoveVelocity({ ...NO_INPUT, forward: true }, 0, true, 0, 1 / 60);
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(WALK);
  });

  it("moves along +X when camera yaw is 90 degrees", () => {
    const v = computeMoveVelocity({ ...NO_INPUT, forward: true }, Math.PI / 2, true, 0, 1 / 60);
    expect(v.x).toBeCloseTo(WALK);
    expect(v.z).toBeCloseTo(0);
  });

  it("normalizes diagonals to walk speed", () => {
    const v = computeMoveVelocity({ ...NO_INPUT, forward: true, right: true }, 0, true, 0, 1 / 60);
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(WALK);
  });

  it("sprints at sprint speed", () => {
    const v = computeMoveVelocity({ ...NO_INPUT, forward: true, sprint: true }, 0, true, 0, 1 / 60);
    expect(v.z).toBeCloseTo(SPRINT);
  });

  it("cancels opposing inputs", () => {
    const v = computeMoveVelocity({ ...NO_INPUT, forward: true, back: true }, 0, true, 0, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("applies gravity to vertical velocity when airborne", () => {
    const dt = 1 / 60;
    const v = computeMoveVelocity(NO_INPUT, 0, false, -1, dt);
    expect(v.y).toBeCloseTo(-1 - 9.81 * dt);
  });

  it("keeps vertical velocity at zero when supported", () => {
    const v = computeMoveVelocity(NO_INPUT, 0, true, -5, 1 / 60);
    expect(v.y).toBe(0);
  });
});

describe("lerpAngle", () => {
  it("moves toward the target", () => {
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it("takes the shortest path across the -PI/PI seam", () => {
    const result = lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
    // Shortest path crosses the seam; result stays near PI, not near 0.
    expect(Math.abs(result)).toBeGreaterThan(Math.PI - 0.2);
  });

  it("clamps t to 1", () => {
    expect(lerpAngle(0, 1, 5)).toBeCloseTo(1);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/actors/movement.test.ts
```

Expected: FAIL — `Cannot find module './movement'`.

- [x] **Step 3: Write `src/actors/movement.ts`**

```ts
export interface MoveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const GRAVITY = 9.81;
const WALK_SPEED = 3;
const SPRINT_SPEED = 6;

/**
 * Horizontal velocity from input rotated by camera yaw, plus vertical
 * velocity: 0 when supported, integrating gravity when airborne.
 * Left-handed world; yaw measured from +Z toward +X.
 */
export function computeMoveVelocity(
  input: MoveInput,
  cameraYaw: number,
  onGround: boolean,
  verticalVelocity: number,
  dt: number,
): Vec3 {
  let localX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let localZ = (input.forward ? 1 : 0) - (input.back ? 1 : 0);

  const length = Math.hypot(localX, localZ);
  if (length > 0) {
    localX /= length;
    localZ /= length;
  }

  const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);

  return {
    x: (localX * cos + localZ * sin) * speed,
    y: onGround ? 0 : verticalVelocity - GRAVITY * dt,
    z: (-localX * sin + localZ * cos) * speed,
  };
}

/** Frame-rate-safe shortest-path angle interpolation. */
export function lerpAngle(from: number, to: number, t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  let delta = (to - from) % (2 * Math.PI);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return from + delta * clamped;
}
```

- [x] **Step 4: Run the tests to verify they pass**

```bash
pnpm vitest run src/actors/movement.test.ts
```

Expected: PASS — 11 tests.

- [x] **Step 5: Commit**

```bash
git add src/actors/movement.ts src/actors/movement.test.ts
git commit -m "feat: add camera-relative movement math"
```

---

### Task 7: Engine bootstrap + test zone

**Files:**
- Create: `src/core/engine.ts`
- Create: `src/world/testZone.ts`

No unit tests here — this is engine glue with no logic; it's verified visually in Task 8.

- [x] **Step 1: Write `src/core/engine.ts`**

```ts
import { Engine, HavokPlugin, Scene, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

export interface EngineContext {
  engine: Engine;
  scene: Scene;
}

export async function createEngine(canvas: HTMLCanvasElement): Promise<EngineContext> {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  const havok = await HavokPhysics();
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
  return { engine, scene };
}
```

Note: root-package imports (`@babylonjs/core`) are intentional for now — per-file tree-shaken imports require side-effect imports that are easy to get wrong. Bundle-size optimization is a phase 9 concern.

- [x] **Step 2: Write `src/world/testZone.ts`**

```ts
import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

/** Placeholder zone: lit ground plane with obstacle boxes. Replaced in phase 4. */
export function buildTestZone(scene: Scene): void {
  scene.clearColor = new Color4(0.53, 0.75, 0.92, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 60;
  scene.fogEnd = 150;
  scene.fogColor = new Color3(0.53, 0.75, 0.92);

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.5;
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.4), scene);
  sun.intensity = 0.9;

  const ground = MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.35, 0.5, 0.3);
  ground.material = groundMat;
  new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

  const boxMat = new StandardMaterial("boxMat", scene);
  boxMat.diffuseColor = new Color3(0.55, 0.45, 0.35);
  for (let i = 0; i < 5; i++) {
    const box = MeshBuilder.CreateBox(`obstacle${i}`, { size: 2 }, scene);
    box.material = boxMat;
    box.position = new Vector3(i * 4 - 8, 1, 8);
    new PhysicsAggregate(box, PhysicsShapeType.BOX, { mass: 0 }, scene);
  }
}
```

- [x] **Step 3: Type-check**

```bash
pnpm check
```

Expected: exit 0.

- [x] **Step 4: Commit**

```bash
git add src/core/engine.ts src/world/testZone.ts
git commit -m "feat: bootstrap Babylon engine with Havok and test zone"
```

---

### Task 8: Player controller, camera rig, game wiring, FPS overlay

**Files:**
- Create: `src/actors/cameraRig.ts`
- Create: `src/actors/playerController.ts`
- Create: `src/ui/hud.svelte.ts`
- Modify: `src/core/game.ts` (replace the Task 2 stub entirely)
- Modify: `src/App.svelte` (add FPS readout)

- [x] **Step 1: Write `src/actors/cameraRig.ts`**

```ts
import { ArcRotateCamera, type Scene, Vector3 } from "@babylonjs/core";

export class CameraRig {
  readonly camera: ArcRotateCamera;
  private readonly directionScratch = new Vector3();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera("camera", -Math.PI / 2, 1.2, 8, new Vector3(0, 1.5, 0), scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 12;
    this.camera.upperBetaLimit = 1.45;
    this.camera.wheelDeltaPercentage = 0.01;
  }

  /** World yaw of the camera's view direction (left-handed, +Z = 0). */
  get yaw(): number {
    this.camera.target.subtractToRef(
      this.camera.position,
      this.directionScratch,
    );
    return Math.atan2(this.directionScratch.x, this.directionScratch.z);
  }

  follow(position: Vector3): void {
    this.camera.target.copyFrom(position);
    this.camera.target.y += 1.2;
  }

  dispose(): void {
    this.camera.dispose();
  }
}
```

- [x] **Step 2: Write `src/actors/playerController.ts`**

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
import type { CameraRig } from "./cameraRig";
import { computeMoveVelocity, lerpAngle } from "./movement";

// Capsule dimensions, camera follow offset (cameraRig.ts) and the GLB swap in
// phase 2 are a coupled set — change together.
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;

export class Player {
  readonly mesh: Mesh;
  private controller: PhysicsCharacterController;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();

  constructor(
    scene: Scene,
    private input: Input,
    private cameraRig: CameraRig,
  ) {
    this.mesh = MeshBuilder.CreateCapsule("player", { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS }, scene);
    const start = new Vector3(0, 2, 0);
    this.mesh.position.copyFrom(start);
    this.controller = new PhysicsCharacterController(
      start,
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene,
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  update(dt: number): void {
    const support = this.controller.checkSupport(dt, DOWN);
    const onGround = support.supportedState === CharacterSupportedState.SUPPORTED;

    const velocity = computeMoveVelocity(
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

    this.velocityScratch.set(velocity.x, velocity.y, velocity.z);
    this.controller.setVelocity(this.velocityScratch);
    this.controller.integrate(dt, support, GRAVITY);
    this.mesh.position.copyFrom(this.controller.getPosition());

    if (velocity.x !== 0 || velocity.z !== 0) {
      this.targetYaw = Math.atan2(velocity.x, velocity.z);
    }
    this.mesh.rotation.y = lerpAngle(this.mesh.rotation.y, this.targetYaw, TURN_RATE * dt);
  }

  dispose(): void {
    this.controller.dispose();
    this.mesh.dispose();
  }
}
```

- [x] **Step 3: Write `src/ui/hud.svelte.ts`** (first Svelte↔game-loop bridge; grows in phase 3)

```ts
export const hud = $state({
  fps: 0,
});
```

- [x] **Step 4: Replace `src/core/game.ts` with the real implementation**

```ts
import { CameraRig } from "../actors/cameraRig";
import { Player } from "../actors/playerController";
import { hud } from "../ui/hud.svelte";
import { buildTestZone } from "../world/testZone";
import { createEngine } from "./engine";
import { events } from "./events";
import { Input } from "./input";

export interface Game {
  dispose(): void;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<Game> {
  const { engine, scene } = await createEngine(canvas);
  buildTestZone(scene);

  const input = new Input();
  input.attach(window);

  const cameraRig = new CameraRig(scene, canvas);
  const player = new Player(scene, input, cameraRig);

  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    player.update(dt);
    cameraRig.follow(player.position);
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
      player.dispose();
      cameraRig.dispose();
      engine.dispose();
    },
  };
}
```

- [x] **Step 5: Add the FPS readout to `src/App.svelte`** — replace the markup/style sections so the file becomes:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { type Game, startGame } from "./core/game";
  import { hud } from "./ui/hud.svelte";

  let canvas: HTMLCanvasElement | undefined = $state();
  let bootError: string | undefined = $state();

  onMount(() => {
    let game: Game | undefined;
    let disposed = false;
    if (canvas) {
      startGame(canvas)
        .then((g) => {
          if (disposed) {
            g.dispose();
          } else {
            game = g;
          }
        })
        .catch((err: unknown) => {
          bootError = err instanceof Error ? err.message : String(err);
          console.error("Game startup failed:", err);
        });
    }
    return () => {
      disposed = true;
      game?.dispose();
    };
  });
</script>

<canvas bind:this={canvas} id="game-canvas"></canvas>
<div id="overlay-root">
  <div class="fps">{Math.round(hud.fps)} FPS</div>
  {#if bootError}
    <div class="boot-error" role="alert">Failed to start: {bootError}</div>
  {/if}
</div>

<style>
  #game-canvas {
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
  }

  #overlay-root {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .fps {
    position: absolute;
    top: 8px;
    right: 12px;
    color: #fff;
    font-size: 12px;
    opacity: 0.7;
  }

  .boot-error {
    position: absolute;
    top: 40%;
    width: 100%;
    text-align: center;
    color: #f66;
    font-size: 16px;
  }
</style>
```

- [x] **Step 6: Run checks and tests**

```bash
pnpm test && pnpm check
```

Expected: all tests pass; checks exit 0.

- [x] **Step 7: Manual verification in the browser**

```bash
pnpm dev
```

Open http://localhost:5173 and verify ALL of:
- Green ground, sky-blue background, brown obstacle boxes, capsule player visible.
- Player falls from spawn (y=2) onto the ground.
- WASD moves the player **relative to the camera**; Shift sprints visibly faster; arrows also work.
- Dragging the mouse orbits the camera; wheel zooms within limits; "forward" follows the new camera direction.
- Walking into an obstacle box stops the player (no clipping through).
- The capsule turns smoothly to face its movement direction.
- FPS readout shows ~60 FPS.

If physics fails to load with a WASM error, confirm `optimizeDeps.exclude: ["@babylonjs/havok"]` in `vite.config.ts` and restart `pnpm dev` (Vite caches pre-bundles).

- [x] **Step 8: Commit**

```bash
git add src/actors/ src/ui/ src/core/game.ts src/App.svelte
git commit -m "feat: add player character controller, camera rig and FPS overlay"
```

---

### Task 9: Phase wrap-up

**Files:**
- Create: `README.md`

- [x] **Step 1: Write `README.md`**

````markdown
# Wolfsbane

A Witcher 3–inspired third-person action RPG running in the browser.
Babylon.js + Havok + Svelte 5 + TypeScript. Requires Node LTS (≥22) and pnpm 9+.

## Develop

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # vitest unit tests
pnpm check      # biome + svelte-check
pnpm build      # production build
```

Design docs live in `docs/superpowers/specs/`, implementation plans in
`docs/superpowers/plans/`.
````

- [x] **Step 2: Full verification**

```bash
pnpm test && pnpm check && pnpm build
```

Expected: tests pass, checks exit 0, `dist/` builds without errors.

- [x] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with dev commands"
```

- [x] **Step 4: Finish the branch** — use the superpowers:finishing-a-development-branch skill to decide merge/PR/next steps. Phase 2 (character & animation) gets its own plan and branch.

---

## Self-review notes

- Spec coverage: this plan covers spec phase 1 only (scaffold, ground, capsule, WASD + third-person camera, 60 fps) plus the tooling the spec locks (pnpm, Biome, Vitest, svelte-check, strict TS). Phases 2–9 get their own plans.
- The `hud.svelte.ts` FPS bridge intentionally exercises the spec's Svelte↔game-loop store architecture early, so phase 3's HUD has a proven pattern.
- Types referenced across tasks were cross-checked: `Game`/`startGame` (Tasks 2, 8), `Input.isDown`/`handleKey` (Tasks 5, 8), `computeMoveVelocity`/`lerpAngle` (Tasks 6, 8), `CameraRig.yaw`/`follow` (Task 8), `buildTestZone`/`createEngine` (Tasks 7, 8).
