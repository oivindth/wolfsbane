import type { AnimState } from "../actors/animationStates";

export type MeleeKind = "light1" | "light2" | "light3" | "heavy";

export interface MeleeAttackSpec {
  /** Animation state this attack plays. */
  state: AnimState;
  damage: number;
  staminaCost: number;
  /** Real seconds into the swing when damage lands (clip speed already applied). */
  hitAt: number;
  range: number;
  /** Half-angle of the hit arc, radians. */
  halfArc: number;
}

/**
 * hitAt values sit inside each clip's real duration at its configured speed:
 * light1 Slice_Diagonal 1.0s/1.2≈0.83s, light2 Slice_Horizontal 1.067s/1.2≈0.89s,
 * light3 Stab 1.6s/1.2≈1.33s, heavy Chop 1.067s/1.0.
 */
export const MELEE_ATTACKS: Record<MeleeKind, MeleeAttackSpec> = {
  light1: {
    state: "attack",
    damage: 12,
    staminaCost: 12,
    hitAt: 0.38,
    range: 2.2,
    halfArc: Math.PI / 3,
  },
  light2: {
    state: "attack2",
    damage: 12,
    staminaCost: 12,
    hitAt: 0.4,
    range: 2.2,
    halfArc: Math.PI / 3,
  },
  light3: {
    state: "attack3",
    damage: 18,
    staminaCost: 12,
    hitAt: 0.6,
    range: 2.4,
    halfArc: Math.PI / 3,
  },
  heavy: {
    state: "heavy",
    damage: 25,
    staminaCost: 25,
    hitAt: 0.5,
    range: 2.4,
    halfArc: Math.PI / 3,
  },
};

/** What a buffered light press chains into when the active swing ends. */
export const COMBO_CHAIN: Record<MeleeKind, MeleeKind | null> = {
  light1: "light2",
  light2: "light3",
  light3: null,
  heavy: null,
};
