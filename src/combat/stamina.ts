const REGEN_PER_SECOND = 25;
const REGEN_DELAY_SECONDS = 0.7;

/** Stamina pool: spending or draining pauses regeneration briefly. Pure. */
export class Stamina {
  current: number;
  private sinceSpend = REGEN_DELAY_SECONDS;

  constructor(readonly max: number) {
    this.current = max;
  }

  /** Spend if affordable; returns false (and spends nothing) otherwise. */
  trySpend(cost: number): boolean {
    if (cost > this.current) return false;
    this.current -= cost;
    this.sinceSpend = 0;
    return true;
  }

  /** Continuous drain (sprint). Returns false once the pool is empty. */
  drain(perSecond: number, dt: number): boolean {
    if (this.current <= 0) return false;
    this.current = Math.max(0, this.current - perSecond * dt);
    this.sinceSpend = 0;
    return this.current > 0;
  }

  /** Call once per frame before any spend/drain this frame. */
  update(dt: number): void {
    const beforeDelay = Math.max(0, REGEN_DELAY_SECONDS - this.sinceSpend);
    const afterDelay = dt - beforeDelay;
    if (afterDelay > 0) {
      this.current = Math.min(
        this.max,
        this.current + REGEN_PER_SECOND * afterDelay,
      );
    }
    this.sinceSpend += dt;
  }

  reset(): void {
    this.current = this.max;
    this.sinceSpend = REGEN_DELAY_SECONDS;
  }
}
