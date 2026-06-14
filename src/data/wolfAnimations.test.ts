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
      expect(
        WOLF_GLB_CLIPS.has(config.clip),
        `unknown clip ${config.clip}`,
      ).toBe(true);
    }
  });

  it("loops locomotion but not one-shots", () => {
    expect(WOLF_CLIPS.idle.loop).toBe(true);
    expect(WOLF_CLIPS.run.loop).toBe(true);
    expect(WOLF_CLIPS.attack.loop).toBe(false);
    expect(WOLF_CLIPS.death.loop).toBe(false);
  });
});
