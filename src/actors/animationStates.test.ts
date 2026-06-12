import { describe, expect, it } from "vitest";
import { AnimStateMachine, selectLocomotion } from "./animationStates";

describe("selectLocomotion", () => {
  it("is idle when grounded and not moving", () => {
    expect(
      selectLocomotion({
        speed: 0,
        localX: 0,
        localZ: 0,
        onGround: true,
        sprint: false,
      }),
    ).toBe("idle");
  });

  it("walks when moving without sprint", () => {
    expect(
      selectLocomotion({
        speed: 3,
        localX: 0,
        localZ: 1,
        onGround: true,
        sprint: false,
      }),
    ).toBe("walk");
  });

  it("runs when sprinting", () => {
    expect(
      selectLocomotion({
        speed: 6,
        localX: 0,
        localZ: 1,
        onGround: true,
        sprint: true,
      }),
    ).toBe("run");
  });

  it("falls when airborne regardless of speed", () => {
    expect(
      selectLocomotion({
        speed: 6,
        localX: 0,
        localZ: 1,
        onGround: false,
        sprint: true,
      }),
    ).toBe("fall");
  });

  it("walks backwards when movement is mostly backward (lock-on strafing)", () => {
    expect(
      selectLocomotion({
        speed: 3,
        localX: 0,
        localZ: -1,
        onGround: true,
        sprint: false,
      }),
    ).toBe("walkBack");
  });

  it("strafes when movement is mostly sideways", () => {
    expect(
      selectLocomotion({
        speed: 3,
        localX: -1,
        localZ: 0,
        onGround: true,
        sprint: false,
      }),
    ).toBe("strafeLeft");
    expect(
      selectLocomotion({
        speed: 3,
        localX: 1,
        localZ: 0,
        onGround: true,
        sprint: false,
      }),
    ).toBe("strafeRight");
  });

  it("prefers forward over strafe on diagonals", () => {
    expect(
      selectLocomotion({
        speed: 3,
        localX: 0.7,
        localZ: 0.71,
        onGround: true,
        sprint: false,
      }),
    ).toBe("walk");
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
