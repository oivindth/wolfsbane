import type { SignKind } from "../combat/signs";

export const hud = $state({
  fps: 0,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  selectedSign: "igni" as SignKind,
  /** Remaining cooldown per sign as a 0..1 fraction (0 = ready). */
  cooldowns: { igni: 0, aard: 0, quen: 0 } as Record<SignKind, number>,
  quenActive: false,
  dead: false,
});
