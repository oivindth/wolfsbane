/** Hit-point pool with clamped damage and healing. Pure; no Babylon imports. */
export class Health {
  current: number;

  constructor(readonly max: number) {
    this.current = max;
  }

  get isDead(): boolean {
    return this.current <= 0;
  }

  /** Apply damage; returns the amount actually applied after clamping. */
  damage(amount: number): number {
    const applied = Math.min(this.current, Math.max(0, amount));
    this.current -= applied;
    return applied;
  }

  heal(amount: number): void {
    this.current = Math.min(this.max, this.current + Math.max(0, amount));
  }

  reset(): void {
    this.current = this.max;
  }
}
