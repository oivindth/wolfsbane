import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { Health } from "../combat/health";
import { events } from "../core/events";
import { WOLF_CLIPS } from "../data/wolfAnimations";
import { AnimationController } from "./animationController";
import { AnimStateMachine } from "./animationStates";
import { loadCharacterModel } from "./characterModel";
import { lerpAngle } from "./movement";
import { WolfBrain } from "./wolfBrain";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 8;
const CAPSULE_HEIGHT = 1.0;
const CAPSULE_RADIUS = 0.45;
const WOLF_HP = 40;
/** Set to Math.PI if the wolf visibly runs backwards in the dev check. */
const MODEL_YAW = 0;

export const WOLF_BITE_DAMAGE = 10;
export const WOLF_BITE_RANGE = 2.2;
export const WOLF_BITE_HALF_ARC = Math.PI / 2.5;

let nextWolfId = 1;

/** A pack wolf: physics capsule + Quaternius model driven by WolfBrain. */
export class Wolf {
  readonly id: string;
  readonly mesh: Mesh;
  readonly health = new Health(WOLF_HP);
  /** Called at the bite moment; game.ts checks the arc and damages the player. */
  onBite: (() => void) | undefined;

  private controller: PhysicsCharacterController;
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  private brain: WolfBrain;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private readonly spawn: Vector3;

  constructor(scene: Scene, spawn: Vector3, rng?: () => number) {
    this.id = `wolf-${nextWolfId++}`;
    this.spawn = spawn.clone();
    this.brain = new WolfBrain(rng);
    this.mesh = MeshBuilder.CreateCapsule(
      this.id,
      { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS },
      scene,
    );
    this.mesh.position.copyFrom(spawn);
    this.controller = new PhysicsCharacterController(
      spawn,
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene,
    );
  }

  /** Load the visual model; capsule turns invisible. Call once at startup. */
  async loadModel(scene: Scene): Promise<void> {
    const model = await loadCharacterModel(
      `${import.meta.env.BASE_URL}assets/characters/Wolf.glb`,
      scene,
      CAPSULE_HEIGHT,
    );
    model.root.parent = this.mesh;
    model.root.position.y = -CAPSULE_HEIGHT / 2;
    model.root.rotation.y = MODEL_YAW;
    this.mesh.isVisible = false;
    this.animController = new AnimationController(
      WOLF_CLIPS,
      model.animations,
      () => this.stateMachine.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  get isDead(): boolean {
    return this.health.isDead;
  }

  /** Apply damage; aard passes stagger=true. */
  takeDamage(amount: number, stagger = false): void {
    if (this.isDead) return;
    this.health.damage(amount);
    if (this.health.isDead) {
      this.brain.kill();
      this.stateMachine.trigger("death");
      events.emit("enemy:killed", { id: this.id });
      return;
    }
    if (stagger) {
      this.brain.stagger();
    } else {
      this.brain.interrupt();
    }
    this.stateMachine.trigger("hit");
  }

  update(dt: number, playerPosition: Vector3, playerDead: boolean): void {
    if (!this.isDead) {
      const tick = this.brain.update({
        toPlayerX: playerPosition.x - this.mesh.position.x,
        toPlayerZ: playerPosition.z - this.mesh.position.z,
        playerDead,
        dt,
      });
      if (tick.attackStarted && !this.stateMachine.trigger("attack")) {
        // The flinch (or another one-shot) owns the animation slot, so the
        // lunge can't play. Abort it in the brain too, otherwise the bite
        // would still land with no visible wind-up.
        this.brain.interrupt();
      }
      if (tick.bite) this.onBite?.();

      // The flinch animation roots the wolf in place.
      const flinching = this.stateMachine.current === "hit";
      const vx = flinching ? 0 : tick.velX;
      const vz = flinching ? 0 : tick.velZ;

      const support = this.controller.checkSupport(dt, DOWN);
      const onGround =
        support.supportedState === CharacterSupportedState.SUPPORTED;
      const vy = onGround ? 0 : this.controller.getVelocity().y - 9.81 * dt;
      this.velocityScratch.set(vx, vy, vz);
      this.controller.setVelocity(this.velocityScratch);
      this.controller.integrate(dt, support, GRAVITY);
      this.mesh.position.copyFrom(this.controller.getPosition());

      // Face the player while engaging up close; otherwise face travel direction.
      const engaging =
        this.brain.state === "circle" ||
        this.brain.state === "attack" ||
        this.brain.state === "recover";
      if (engaging) {
        this.targetYaw = Math.atan2(
          playerPosition.x - this.mesh.position.x,
          playerPosition.z - this.mesh.position.z,
        );
      } else if (vx !== 0 || vz !== 0) {
        this.targetYaw = Math.atan2(vx, vz);
      }
      this.mesh.rotation.y = lerpAngle(
        this.mesh.rotation.y,
        this.targetYaw,
        TURN_RATE * dt,
      );

      this.stateMachine.setLocomotion(
        tick.gait === "run" ? "run" : tick.gait === "walk" ? "walk" : "idle",
      );
    }
    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
  }

  /** Back to spawn at full health (used when the player retries). */
  respawn(): void {
    this.health.reset();
    this.brain.reset();
    this.stateMachine.reset();
    this.controller.setPosition(this.spawn);
    this.mesh.position.copyFrom(this.spawn);
  }

  dispose(): void {
    this.animController?.dispose();
    // Babylon's controller.dispose() needs a live physics engine; during
    // HMR teardown it may already be gone.
    if (this.mesh.getScene().getPhysicsEngine()) {
      this.controller.dispose();
    }
    this.mesh.dispose();
  }
}
