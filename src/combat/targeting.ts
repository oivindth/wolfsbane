/** Anything lock-on can aim at. Babylon's Vector3 satisfies position structurally. */
export interface Targetable {
  position: { x: number; y: number; z: number };
  isDead: boolean;
}

const ACQUIRE_RANGE = 15;
const DROP_RANGE = 20;

export function nearestTarget<T extends Targetable>(
  originX: number,
  originZ: number,
  candidates: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDist = ACQUIRE_RANGE;
  for (const candidate of candidates) {
    if (candidate.isDead) continue;
    const dist = Math.hypot(
      candidate.position.x - originX,
      candidate.position.z - originZ,
    );
    if (dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Single owner of the current lock-on target. game.ts mirrors
 * target.position into Player and CameraRig each frame.
 */
export class LockOn<T extends Targetable = Targetable> {
  target: T | null = null;

  toggle(originX: number, originZ: number, candidates: readonly T[]): void {
    this.target = this.target
      ? null
      : nearestTarget(originX, originZ, candidates);
  }

  /** Drop the lock when the target dies or strays too far. */
  update(originX: number, originZ: number): void {
    if (!this.target) return;
    const dist = Math.hypot(
      this.target.position.x - originX,
      this.target.position.z - originZ,
    );
    if (this.target.isDead || dist > DROP_RANGE) this.target = null;
  }
}
