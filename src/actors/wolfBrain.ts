export type WolfState =
  | "idle"
  | "chase"
  | "circle"
  | "attack"
  | "recover"
  | "staggered"
  | "dead";

export type WolfGait = "idle" | "walk" | "run";

export interface WolfTickInput {
  /** Planar vector from wolf to player. */
  toPlayerX: number;
  toPlayerZ: number;
  playerDead: boolean;
  dt: number;
}

export interface WolfTick {
  /** Desired horizontal velocity, world units/s. */
  velX: number;
  velZ: number;
  gait: WolfGait;
  /** True on the tick the wolf begins its attack (play the Attack clip). */
  attackStarted: boolean;
  /** True on the tick the bite's damage should be checked. */
  bite: boolean;
}

const AGGRO_RANGE = 12;
const CIRCLE_RANGE = 3.5;
const CIRCLE_DISTANCE = 3;
const ATTACK_RANGE = 2.6;
const GALLOP_SPEED = 4.5;
const WALK_SPEED = 1.8;
/** Seconds into the 1.33s Attack clip when the bite lands. */
const BITE_AT = 0.55;
const ATTACK_DURATION = 1.33;
const RECOVER_SECONDS = 1.0;
const STAGGER_SECONDS = 1.7;

// Frozen: returned by reference on the zero-velocity paths, so a stray
// mutation by a consumer must not corrupt every later tick.
const IDLE_TICK: WolfTick = Object.freeze({
  velX: 0,
  velZ: 0,
  gait: "idle",
  attackStarted: false,
  bite: false,
});

/**
 * Wolf combat FSM: idle → chase → circle → attack → recover (→ chase).
 * Aard staggers; death is terminal. Pure; rng injected for tests.
 */
export class WolfBrain {
  state: WolfState = "idle";
  private timer = 0;
  private circleDir: 1 | -1 = 1;
  private biteDone = false;

  constructor(private rng: () => number = Math.random) {}

  /** Aard hit: stand dazed (no effect when dead). */
  stagger(): void {
    if (this.state === "dead") return;
    this.state = "staggered";
    this.timer = STAGGER_SECONDS;
  }

  /** Flinch from damage: an in-progress attack is abandoned. */
  interrupt(): void {
    if (this.state === "attack") {
      this.state = "recover";
      this.timer = RECOVER_SECONDS;
    }
  }

  kill(): void {
    this.state = "dead";
  }

  reset(): void {
    this.state = "idle";
    this.timer = 0;
    this.biteDone = false;
  }

  update(input: WolfTickInput): WolfTick {
    if (this.state === "dead") return IDLE_TICK;
    if (input.playerDead) {
      this.state = "idle";
      return IDLE_TICK;
    }

    const dist = Math.hypot(input.toPlayerX, input.toPlayerZ);
    const dirX = dist > 0 ? input.toPlayerX / dist : 0;
    const dirZ = dist > 0 ? input.toPlayerZ / dist : 1;

    switch (this.state) {
      case "idle":
        if (dist < AGGRO_RANGE) this.state = "chase";
        return IDLE_TICK;

      case "chase":
        if (dist < CIRCLE_RANGE) {
          this.state = "circle";
          this.circleDir = this.rng() < 0.5 ? -1 : 1;
          this.timer = 1.2 + this.rng() * 1.3;
          return this.circleTick(dist, dirX, dirZ);
        }
        return {
          velX: dirX * GALLOP_SPEED,
          velZ: dirZ * GALLOP_SPEED,
          gait: "run",
          attackStarted: false,
          bite: false,
        };

      case "circle":
        this.timer -= input.dt;
        if (this.timer <= 0) {
          if (dist <= ATTACK_RANGE) {
            this.state = "attack";
            this.timer = ATTACK_DURATION;
            this.biteDone = false;
            return { ...IDLE_TICK, attackStarted: true };
          }
          this.state = "chase";
          return IDLE_TICK;
        }
        return this.circleTick(dist, dirX, dirZ);

      case "attack": {
        this.timer -= input.dt;
        const bite = !this.biteDone && ATTACK_DURATION - this.timer >= BITE_AT;
        if (bite) this.biteDone = true;
        if (this.timer <= 0) {
          this.state = "recover";
          this.timer = RECOVER_SECONDS;
        }
        return { ...IDLE_TICK, bite };
      }

      case "recover":
        this.timer -= input.dt;
        if (this.timer <= 0) this.state = "chase";
        return IDLE_TICK;

      case "staggered":
        this.timer -= input.dt;
        if (this.timer <= 0) this.state = "chase";
        return IDLE_TICK;
    }
    return IDLE_TICK;
  }

  /** Strafe tangentially while correcting toward the preferred circling distance. */
  private circleTick(dist: number, dirX: number, dirZ: number): WolfTick {
    const radial = Math.max(-1, Math.min(1, dist - CIRCLE_DISTANCE));
    let vx = -dirZ * this.circleDir + dirX * radial * 0.8;
    let vz = dirX * this.circleDir + dirZ * radial * 0.8;
    const len = Math.hypot(vx, vz) || 1;
    vx = (vx / len) * WALK_SPEED;
    vz = (vz / len) * WALK_SPEED;
    return {
      velX: vx,
      velZ: vz,
      gait: "walk",
      attackStarted: false,
      bite: false,
    };
  }
}
