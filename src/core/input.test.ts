import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("reports no actions by default", () => {
    const input = new Input();
    expect(input.isDown("forward")).toBe(false);
  });

  it("maps KeyW to forward", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    expect(input.isDown("forward")).toBe(true);
    input.handleKey("KeyW", false);
    expect(input.isDown("forward")).toBe(false);
  });

  it("maps WASD, arrows and shift to actions", () => {
    const input = new Input();
    for (const [code, action] of [
      ["KeyS", "back"],
      ["KeyA", "left"],
      ["KeyD", "right"],
      ["ArrowUp", "forward"],
      ["ShiftLeft", "sprint"],
    ] as const) {
      input.handleKey(code, true);
      expect(input.isDown(action)).toBe(true);
    }
  });

  it("ignores unbound keys", () => {
    const input = new Input();
    input.handleKey("KeyZ", true);
    expect(input.isDown("forward")).toBe(false);
    expect(input.isDown("back")).toBe(false);
    expect(input.isDown("left")).toBe(false);
    expect(input.isDown("right")).toBe(false);
    expect(input.isDown("sprint")).toBe(false);
  });

  it("tracks multiple simultaneous actions", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    input.handleKey("KeyA", true);
    expect(input.isDown("forward")).toBe(true);
    expect(input.isDown("left")).toBe(true);
  });

  it("clears all pressed actions", () => {
    const input = new Input();
    input.handleKey("KeyW", true);
    input.handleKey("ShiftLeft", true);
    input.clear();
    expect(input.isDown("forward")).toBe(false);
    expect(input.isDown("sprint")).toBe(false);
  });

  it("respects custom bindings", () => {
    const input = new Input({ KeyJ: "forward" });
    input.handleKey("KeyJ", true);
    expect(input.isDown("forward")).toBe(true);
    input.handleKey("KeyW", true);
    expect(input.isDown("forward")).toBe(true);
    expect(input.isDown("back")).toBe(false);
  });

  it("maps trigger keys to new actions", () => {
    const input = new Input();
    for (const [code, action] of [
      ["Space", "roll"],
      ["KeyF", "attack"],
      ["Tab", "lockToggle"],
      ["KeyH", "debugHit"],
      ["KeyK", "debugDeath"],
    ] as const) {
      input.handleKey(code, true);
      expect(input.isDown(action)).toBe(true);
    }
  });

  it("reports justPressed only until endFrame", () => {
    const input = new Input();
    input.handleKey("Space", true);
    expect(input.justPressed("roll")).toBe(true);
    input.endFrame();
    expect(input.justPressed("roll")).toBe(false); // still held, but not new
    expect(input.isDown("roll")).toBe(true);
  });

  it("reports justPressed again after release and re-press", () => {
    const input = new Input();
    input.handleKey("Space", true);
    input.endFrame();
    input.handleKey("Space", false);
    input.handleKey("Space", true);
    expect(input.justPressed("roll")).toBe(true);
  });

  it("clear() also clears justPressed", () => {
    const input = new Input();
    input.handleKey("Space", true);
    input.clear();
    expect(input.justPressed("roll")).toBe(false);
  });
});
