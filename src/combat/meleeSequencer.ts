import { COMBO_CHAIN, MELEE_ATTACKS, type MeleeKind } from "./attacks";

/**
 * Drives combo chaining and damage timing. The animation state machine
 * stays the source of truth for when a swing ends — the actor reports
 * that via onAttackEnd(). Pure; no Babylon imports.
 */
export class MeleeSequencer {
  private active: MeleeKind | null = null;
  private buffered: "light" | "heavy" | null = null;
  private elapsed = 0;
  private hitDone = false;

  get isAttacking(): boolean {
    return this.active !== null;
  }

  /** An attack input was pressed. Returns the attack to start now, if any. */
  press(kind: "light" | "heavy"): MeleeKind | null {
    if (this.active !== null) {
      this.buffered = kind;
      return null;
    }
    this.begin(kind === "light" ? "light1" : "heavy");
    return this.active;
  }

  /** Advance time; returns the attack whose damage moment was crossed, once. */
  update(dt: number): MeleeKind | null {
    if (this.active === null) return null;
    this.elapsed += dt;
    if (!this.hitDone && this.elapsed >= MELEE_ATTACKS[this.active].hitAt) {
      this.hitDone = true;
      return this.active;
    }
    return null;
  }

  /** The active swing's animation finished. Returns a chained attack, if any. */
  onAttackEnd(): MeleeKind | null {
    if (this.active === null) return null;
    const next =
      this.buffered === "light"
        ? COMBO_CHAIN[this.active]
        : this.buffered === "heavy"
          ? "heavy"
          : null;
    this.buffered = null;
    if (next) {
      this.begin(next);
    } else {
      this.active = null;
    }
    return next;
  }

  /** Swing was interrupted (hit/death); drop all combo state. */
  cancel(): void {
    this.active = null;
    this.buffered = null;
    this.elapsed = 0;
    this.hitDone = false;
  }

  private begin(kind: MeleeKind): void {
    this.active = kind;
    this.elapsed = 0;
    this.hitDone = false;
  }
}
