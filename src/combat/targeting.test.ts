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
