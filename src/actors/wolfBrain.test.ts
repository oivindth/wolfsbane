import { describe, expect, it } from "vitest";
import { WolfBrain } from "./wolfBrain";

/** rng stub: always 0 → circleDir -1, minimum circle duration (1.2s). */
const rngZero = () => 0;

function tick(
  brain: WolfBrain,
  x: number,
  z: number,
  dt = 0.1,
  playerDead = false,
) {
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
