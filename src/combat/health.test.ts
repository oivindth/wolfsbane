import { describe, expect, it } from "vitest";
import { Health } from "./health";

describe("Health", () => {
  it("starts full", () => {
    const h = new Health(100);
    expect(h.current).toBe(100);
    expect(h.isDead).toBe(false);
  });

  it("applies damage and reports the applied amount", () => {
    const h = new Health(100);
    expect(h.damage(30)).toBe(30);
    expect(h.current).toBe(70);
  });

  it("clamps damage at zero and reports death", () => {
    const h = new Health(20);
    expect(h.damage(50)).toBe(20);
    expect(h.current).toBe(0);
    expect(h.isDead).toBe(true);
  });

  it("ignores negative damage", () => {
    const h = new Health(100);
    expect(h.damage(-10)).toBe(0);
    expect(h.current).toBe(100);
  });

  it("heals without exceeding max", () => {
    const h = new Health(100);
    h.damage(50);
    h.heal(80);
    expect(h.current).toBe(100);
  });

  it("resets to full", () => {
    const h = new Health(100);
    h.damage(100);
    h.reset();
    expect(h.current).toBe(100);
    expect(h.isDead).toBe(false);
  });
});
