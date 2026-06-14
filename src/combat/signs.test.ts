import { describe, expect, it } from "vitest";
import { QuenShield, SIGN_SPECS, SignBook } from "./signs";

describe("SignBook", () => {
  it("defaults to igni and selects others", () => {
    const book = new SignBook();
    expect(book.selected).toBe("igni");
    book.select("quen");
    expect(book.selected).toBe("quen");
  });

  it("casts when ready and starts the cooldown", () => {
    const book = new SignBook();
    expect(book.tryCast(10)).toBe("igni");
    expect(book.tryCast(11)).toBeNull(); // cooling (6s)
    expect(book.tryCast(16)).toBe("igni"); // ready again
  });

  it("tracks cooldowns per sign independently", () => {
    const book = new SignBook();
    book.tryCast(0); // igni on cooldown
    book.select("aard");
    expect(book.tryCast(0.1)).toBe("aard");
  });

  it("reports cooldown fraction from 1 toward 0", () => {
    const book = new SignBook();
    book.tryCast(0);
    expect(book.cooldownFraction("igni", 0)).toBeCloseTo(1);
    expect(book.cooldownFraction("igni", 3)).toBeCloseTo(0.5);
    expect(book.cooldownFraction("igni", 6)).toBe(0);
    expect(book.cooldownFraction("aard", 0)).toBe(0);
  });

  it("reset clears cooldowns and selection", () => {
    const book = new SignBook();
    book.select("quen");
    book.tryCast(0);
    book.reset();
    expect(book.selected).toBe("igni");
    expect(book.cooldownFraction("quen", 0.1)).toBe(0);
  });

  it("spec sanity: each sign has a positive cooldown and stamina cost", () => {
    for (const spec of Object.values(SIGN_SPECS)) {
      expect(spec.cooldown).toBeGreaterThan(0);
      expect(spec.staminaCost).toBeGreaterThan(0);
    }
  });
});

describe("QuenShield", () => {
  it("is inactive until activated", () => {
    const quen = new QuenShield();
    expect(quen.isActive(0)).toBe(false);
    expect(quen.absorb(10, 0)).toBe(10);
  });

  it("absorbs up to capacity and passes the remainder through", () => {
    const quen = new QuenShield();
    quen.activate(0);
    expect(quen.absorb(20, 1)).toBe(0); // 10 capacity left
    expect(quen.absorb(20, 2)).toBe(10); // soaks 10, 10 passes through
    expect(quen.isActive(3)).toBe(false); // depleted
  });

  it("expires after its duration", () => {
    const quen = new QuenShield();
    quen.activate(0);
    expect(quen.isActive(29)).toBe(true);
    expect(quen.isActive(30)).toBe(false);
    expect(quen.absorb(10, 31)).toBe(10);
  });

  it("clear drops the shield immediately", () => {
    const quen = new QuenShield();
    quen.activate(0);
    quen.clear();
    expect(quen.isActive(1)).toBe(false);
  });
});
