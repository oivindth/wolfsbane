import type { AnimationGroup } from "@babylonjs/core";
import type { ClipConfig } from "../data/knightAnimations";
import type { AnimState } from "./animationStates";

const FADE_SECONDS = 0.15;

/**
 * Plays exactly one logical state at a time, cross-fading AnimationGroup
 * weights. One-shot (non-looping) clips invoke onOneShotEnd when done.
 */
export class AnimationController {
  private active: AnimState | null = null;
  private playing = new Map<AnimState, AnimationGroup>();

  constructor(
    private clips: Record<AnimState, ClipConfig>,
    private animations: Map<string, AnimationGroup>,
    private onOneShotEnd: () => void,
  ) {}

  /** Switch target state; no-op if already active. */
  play(state: AnimState): void {
    if (state === this.active) return;
    const config = this.clips[state];
    const group = this.animations.get(config.clip);
    if (!group) {
      console.warn(
        `Missing animation clip "${config.clip}" for state "${state}"`,
      );
      return;
    }
    if (!this.playing.has(state)) {
      group.start(config.loop, config.speed);
      group.setWeightForAllAnimatables(0);
      if (!config.loop) {
        // addOnce: a re-triggered one-shot must not stack end-handlers.
        group.onAnimationGroupEndObservable.addOnce(() => {
          if (this.active === state) {
            this.onOneShotEnd();
          }
          this.playing.delete(state);
        });
      }
      this.playing.set(state, group);
    }
    this.active = state;
  }

  /** Per-frame weight fade toward the active state. */
  update(dt: number): void {
    const step = dt / FADE_SECONDS;
    for (const [state, group] of this.playing) {
      const target = state === this.active ? 1 : 0;
      const current = group.weight === -1 ? 1 : group.weight;
      const next =
        current +
        Math.sign(target - current) *
          Math.min(step, Math.abs(target - current));
      group.setWeightForAllAnimatables(next);
      if (next === 0 && state !== this.active && this.clips[state].loop) {
        group.stop();
        this.playing.delete(state);
      }
    }
  }
}
