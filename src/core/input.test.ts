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
});
