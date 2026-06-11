import { describe, expect, it } from "vitest";
import { EventBus } from "./events";

interface TestEvents extends Record<string, unknown> {
  "test:fired": { value: number };
  "test:other": { name: string };
}

describe("EventBus", () => {
  it("delivers payloads to subscribed handlers", () => {
    const bus = new EventBus<TestEvents>();
    const received: number[] = [];
    bus.on("test:fired", (p) => received.push(p.value));
    bus.emit("test:fired", { value: 42 });
    expect(received).toEqual([42]);
  });

  it("supports multiple handlers per event", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    bus.on("test:fired", () => count++);
    bus.on("test:fired", () => count++);
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(2);
  });

  it("does not deliver to other events", () => {
    const bus = new EventBus<TestEvents>();
    let called = false;
    bus.on("test:other", () => {
      called = true;
    });
    bus.emit("test:fired", { value: 1 });
    expect(called).toBe(false);
  });

  it("stops delivering after unsubscribe via returned function", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const unsubscribe = bus.on("test:fired", () => count++);
    bus.emit("test:fired", { value: 1 });
    unsubscribe();
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(1);
  });

  it("stops delivering after off()", () => {
    const bus = new EventBus<TestEvents>();
    let count = 0;
    const handler = () => count++;
    bus.on("test:fired", handler);
    bus.off("test:fired", handler);
    bus.emit("test:fired", { value: 1 });
    expect(count).toBe(0);
  });
});
