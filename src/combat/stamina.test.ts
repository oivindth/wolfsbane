import { describe, expect, it } from "vitest";
import { Stamina } from "./stamina";

describe("Stamina", () => {
  it("spends when affordable", () => {
    const s = new Stamina(100);
    expect(s.trySpend(30)).toBe(true);
    expect(s.current).toBe(70);
  });

  it("refuses to overspend and leaves the pool untouched", () => {
    const s = new Stamina(100);
    s.trySpend(95);
    expect(s.trySpend(10)).toBe(false);
    expect(s.current).toBe(5);
  });

  it("does not regenerate during the post-spend delay", () => {
    const s = new Stamina(100);
    s.trySpend(50);
    s.update(0.5); // < 0.7s delay
    expect(s.current).toBe(50);
  });

  it("regenerates 25/s after the delay", () => {
    const s = new Stamina(100);
    s.trySpend(50);
    s.update(0.7); // delay elapses, no regen yet this tick boundary
    s.update(1);
    expect(s.current).toBeCloseTo(75);
  });

  it("never regenerates past max", () => {
    const s = new Stamina(100);
    s.trySpend(10);
    s.update(10);
    expect(s.current).toBe(100);
  });

  it("drains continuously and blocks regen while draining", () => {
    const s = new Stamina(100);
    expect(s.drain(8, 1)).toBe(true);
    expect(s.current).toBeCloseTo(92);
    s.update(0.3); // still inside delay after drain
    expect(s.current).toBeCloseTo(92);
  });

  it("drain reports empty pool", () => {
    const s = new Stamina(100);
    s.drain(100, 1);
    expect(s.current).toBe(0);
    expect(s.drain(8, 0.016)).toBe(false);
  });

  it("resets to full and regen-ready", () => {
    const s = new Stamina(100);
    s.trySpend(80);
    s.reset();
    expect(s.current).toBe(100);
  });
});
