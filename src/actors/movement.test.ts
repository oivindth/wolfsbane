import { describe, expect, it } from "vitest";
import { computeMoveVelocity, lerpAngle, type MoveInput } from "./movement";

const NO_INPUT: MoveInput = {
  forward: false,
  back: false,
  left: false,
  right: false,
  sprint: false,
};
const WALK = 3;
const SPRINT = 6;

describe("computeMoveVelocity", () => {
  it("is zero with no input on the ground", () => {
    const v = computeMoveVelocity(NO_INPUT, 0, true, 0, 1 / 60);
    expect(v).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("moves forward along +Z at walk speed when camera yaw is 0", () => {
    const v = computeMoveVelocity(
      { ...NO_INPUT, forward: true },
      0,
      true,
      0,
      1 / 60,
    );
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(WALK);
  });

  it("moves along +X when camera yaw is 90 degrees", () => {
    const v = computeMoveVelocity(
      { ...NO_INPUT, forward: true },
      Math.PI / 2,
      true,
      0,
      1 / 60,
    );
    expect(v.x).toBeCloseTo(WALK);
    expect(v.z).toBeCloseTo(0);
  });

  it("normalizes diagonals to walk speed", () => {
    const v = computeMoveVelocity(
      { ...NO_INPUT, forward: true, right: true },
      0,
      true,
      0,
      1 / 60,
    );
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(WALK);
  });

  it("sprints at sprint speed", () => {
    const v = computeMoveVelocity(
      { ...NO_INPUT, forward: true, sprint: true },
      0,
      true,
      0,
      1 / 60,
    );
    expect(v.z).toBeCloseTo(SPRINT);
  });

  it("cancels opposing inputs", () => {
    const v = computeMoveVelocity(
      { ...NO_INPUT, forward: true, back: true },
      0,
      true,
      0,
      1 / 60,
    );
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
