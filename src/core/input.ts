export type Action = "forward" | "back" | "left" | "right" | "sprint";

const DEFAULT_BINDINGS: Readonly<Record<string, Action>> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

export class Input {
  private pressed = new Set<Action>();
  private bindings: Record<string, Action>;

  constructor(bindings: Record<string, Action> = { ...DEFAULT_BINDINGS }) {
    this.bindings = bindings;
  }

  handleKey(code: string, down: boolean): void {
    const action = this.bindings[code];
    if (!action) return;
    if (down) {
      this.pressed.add(action);
    } else {
      this.pressed.delete(action);
    }
  }

  isDown(action: Action): boolean {
    return this.pressed.has(action);
  }

  private onKeyDown = (event: Event): void => {
    if (event instanceof KeyboardEvent && !event.repeat) {
      this.handleKey(event.code, true);
    }
  };

  private onKeyUp = (event: Event): void => {
    if (event instanceof KeyboardEvent) {
      this.handleKey(event.code, false);
    }
  };

  attach(target: EventTarget): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
  }

  detach(target: EventTarget): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
  }
}
