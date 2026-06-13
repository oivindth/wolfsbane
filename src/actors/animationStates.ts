export type LocomotionState =
  | "idle"
  | "walk"
  | "walkBack"
  | "strafeLeft"
  | "strafeRight"
  | "run"
  | "fall";
export type OneShotState =
  | "roll"
  | "attack"
  | "attack2"
  | "attack3"
  | "heavy"
  | "cast"
  | "hit"
  | "death";
export type AnimState = LocomotionState | OneShotState;

const HIT_INTERRUPTS: ReadonlySet<OneShotState> = new Set([
  "attack",
  "attack2",
  "attack3",
  "heavy",
  "cast",
]);

/** True for states that swing a weapon (cast and roll are not melee). */
export function isMeleeState(state: AnimState): boolean {
  return (
    state === "attack" ||
    state === "attack2" ||
    state === "attack3" ||
    state === "heavy"
  );
}

export interface LocomotionInput {
  /** Horizontal speed in m/s. */
  speed: number;
  /** Movement direction relative to character facing: +x = right, +z = forward. */
  localX: number;
  localZ: number;
  onGround: boolean;
  sprint: boolean;
}

const MOVE_EPSILON = 0.1;

/** Continuous animation state from movement. Pure; no Babylon imports. */
export function selectLocomotion(input: LocomotionInput): LocomotionState {
  if (!input.onGround) return "fall";
  if (input.speed < MOVE_EPSILON) return "idle";
  if (Math.abs(input.localX) > Math.abs(input.localZ)) {
    return input.localX < 0 ? "strafeLeft" : "strafeRight";
  }
  if (input.localZ < 0) return "walkBack";
  return input.sprint ? "run" : "walk";
}

/**
 * One-shot priority: death (terminal) > hit > roll/attack.
 * Hit interrupts melee attacks and casts but not roll (dodge keeps you safe); hit can also trigger freely from locomotion.
 * While a one-shot plays, locomotion changes are ignored.
 */
export class AnimStateMachine {
  current: AnimState = "idle";
  private oneShot: OneShotState | null = null;

  get isDead(): boolean {
    return this.current === "death";
  }

  trigger(state: OneShotState): boolean {
    if (this.isDead) return false;
    if (state === "death") {
      this.oneShot = "death";
      this.current = "death";
      return true;
    }
    if (this.oneShot === null) {
      this.oneShot = state;
      this.current = state;
      return true;
    }
    if (
      state === "hit" &&
      this.oneShot !== null &&
      HIT_INTERRUPTS.has(this.oneShot)
    ) {
      this.oneShot = "hit";
      this.current = "hit";
      return true;
    }
    return false;
  }

  onOneShotEnd(): void {
    if (this.isDead) return; // death pose holds forever
    this.oneShot = null;
  }

  setLocomotion(state: LocomotionState): void {
    if (this.oneShot !== null || this.isDead) return;
    this.current = state;
  }

  /** Back to idle from any state, including death (used on respawn). */
  reset(): void {
    this.current = "idle";
    this.oneShot = null;
  }
}
