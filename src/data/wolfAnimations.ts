import type { AnimState } from "../actors/animationStates";
import type { ClipConfig } from "./knightAnimations";

/**
 * Clip map for Wolf.glb (Quaternius, CC0). The GLB also contains duplicate
 * "AnimalArmature|"-prefixed groups — always use the plain names.
 * The shared AnimState type requires every key, so player-only states
 * (strafes, roll, combo steps, cast) map to sensible wolf fallbacks.
 */
export const WOLF_CLIPS: Record<AnimState, ClipConfig> = {
  idle: { clip: "Idle", loop: true, speed: 1 },
  walk: { clip: "Walk", loop: true, speed: 1 },
  walkBack: { clip: "Walk", loop: true, speed: 1 },
  strafeLeft: { clip: "Walk", loop: true, speed: 1 },
  strafeRight: { clip: "Walk", loop: true, speed: 1 },
  run: { clip: "Gallop", loop: true, speed: 1 },
  fall: { clip: "Gallop_Jump", loop: true, speed: 1 },
  roll: { clip: "Gallop_Jump", loop: false, speed: 1 },
  attack: { clip: "Attack", loop: false, speed: 1 },
  attack2: { clip: "Attack", loop: false, speed: 1 },
  attack3: { clip: "Attack", loop: false, speed: 1 },
  heavy: { clip: "Attack", loop: false, speed: 1 },
  cast: { clip: "Attack", loop: false, speed: 1 },
  hit: { clip: "Idle_HitReact_Left", loop: false, speed: 1 },
  death: { clip: "Death", loop: false, speed: 1 },
};
