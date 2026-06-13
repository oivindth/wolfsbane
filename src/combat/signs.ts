export type SignKind = "igni" | "aard" | "quen";

export const SIGN_ORDER: readonly SignKind[] = ["igni", "aard", "quen"];

export const SIGN_SPECS: Record<
  SignKind,
  { cooldown: number; staminaCost: number }
> = {
  igni: { cooldown: 6, staminaCost: 20 },
  aard: { cooldown: 5, staminaCost: 20 },
  quen: { cooldown: 10, staminaCost: 20 },
};

/** Gameplay effect parameters, applied by the composition root (game.ts). */
export const IGNI_EFFECT = {
  range: 5,
  halfArc: Math.PI / 4,
  damage: 20,
} as const;
export const AARD_EFFECT = { radius: 4, damage: 5 } as const;

/** Sign selection + cooldown bookkeeping. Time is caller-supplied seconds. Pure. */
export class SignBook {
  selected: SignKind = "igni";
  private readyAt: Record<SignKind, number> = { igni: 0, aard: 0, quen: 0 };

  select(kind: SignKind): void {
    this.selected = kind;
  }

  /** Remaining cooldown as a 0..1 fraction (0 = ready). */
  cooldownFraction(kind: SignKind, now: number): number {
    const remaining = this.readyAt[kind] - now;
    return remaining <= 0 ? 0 : remaining / SIGN_SPECS[kind].cooldown;
  }

  /** Cast the selected sign if ready; starts its cooldown. Null while cooling. */
  tryCast(now: number): SignKind | null {
    if (now < this.readyAt[this.selected]) return null;
    this.readyAt[this.selected] = now + SIGN_SPECS[this.selected].cooldown;
    return this.selected;
  }

  reset(): void {
    this.selected = "igni";
    this.readyAt = { igni: 0, aard: 0, quen: 0 };
  }
}

const QUEN_CAPACITY = 30;
const QUEN_DURATION_SECONDS = 30;

/** Quen: absorbs up to QUEN_CAPACITY damage for QUEN_DURATION_SECONDS. Pure. */
export class QuenShield {
  private remaining = 0;
  private expiresAt = 0;

  activate(now: number): void {
    this.remaining = QUEN_CAPACITY;
    this.expiresAt = now + QUEN_DURATION_SECONDS;
  }

  isActive(now: number): boolean {
    return this.remaining > 0 && now < this.expiresAt;
  }

  /** Soak damage; returns the amount that gets through to health. */
  absorb(amount: number, now: number): number {
    if (!this.isActive(now)) return amount;
    const soaked = Math.min(this.remaining, amount);
    this.remaining -= soaked;
    return amount - soaked;
  }

  clear(): void {
    this.remaining = 0;
  }
}
