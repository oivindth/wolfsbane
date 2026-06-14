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
