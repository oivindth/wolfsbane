import { describe, expect, it } from "vitest";
import { inMeleeArc } from "./hitArc";

const QUARTER = Math.PI / 4;

describe("inMeleeArc", () => {
  it("hits a target straight ahead within range", () => {
    // yaw 0 faces +Z (left-handed convention from movement.ts)
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 0, z: 2 }, 2.2, QUARTER)).toBe(
      true,
    );
  });

  it("misses beyond range", () => {
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 0, z: 3 }, 2.2, QUARTER)).toBe(
      false,
    );
  });

  it("misses outside the arc", () => {
    expect(inMeleeArc({ x: 0, z: 0 }, 0, { x: 2, z: 0 }, 2.2, QUARTER)).toBe(
      false,
    );
  });

  it("hits at the arc edge", () => {
    // 45° off-axis, half-arc 60°
    expect(
      inMeleeArc({ x: 0, z: 0 }, 0, { x: 1, z: 1 }, 2.2, Math.PI / 3),
    ).toBe(true);
  });

  it("respects facing across the angle wrap", () => {
    // facing -Z (yaw = π), target behind the wrap at slightly-off -Z
    expect(
      inMeleeArc({ x: 0, z: 0 }, Math.PI, { x: -0.1, z: -1 }, 2.2, QUARTER),
    ).toBe(true);
  });

  it("hits a coincident target", () => {
    expect(inMeleeArc({ x: 1, z: 1 }, 0, { x: 1, z: 1 }, 2.2, QUARTER)).toBe(
      true,
    );
  });
});
