import type { AnimState } from "../actors/animationStates";

export interface ClipConfig {
  /** AnimationGroup name inside Knight.glb (names verified against the asset). */
  clip: string;
  loop: boolean;
  /** Playback speed multiplier. */
  speed: number;
}

export const KNIGHT_CLIPS: Record<AnimState, ClipConfig> = {
  idle: { clip: "Idle", loop: true, speed: 1 },
  walk: { clip: "Walking_A", loop: true, speed: 1 },
  walkBack: { clip: "Walking_Backwards", loop: true, speed: 1 },
  strafeLeft: { clip: "Running_Strafe_Left", loop: true, speed: 0.7 },
  strafeRight: { clip: "Running_Strafe_Right", loop: true, speed: 0.7 },
  run: { clip: "Running_A", loop: true, speed: 1 },
  fall: { clip: "Jump_Idle", loop: true, speed: 1 },
  roll: { clip: "Dodge_Forward", loop: false, speed: 1.3 },
  attack: { clip: "1H_Melee_Attack_Slice_Diagonal", loop: false, speed: 1.2 },
  hit: { clip: "Hit_A", loop: false, speed: 1 },
  death: { clip: "Death_A", loop: false, speed: 1 },
};
