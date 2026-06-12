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
