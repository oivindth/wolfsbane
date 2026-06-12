import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import type { Input } from "../core/input";
import { KNIGHT_CLIPS } from "../data/knightAnimations";
import { AnimationController } from "./animationController";
import { AnimStateMachine, selectLocomotion } from "./animationStates";
import type { CameraRig } from "./cameraRig";
import { loadCharacterModel } from "./characterModel";
import { computeMoveVelocity, lerpAngle } from "./movement";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;
const ROLL_SPEED = 6;

// Capsule dimensions, camera follow offset (cameraRig.ts) and the model
// scaling in characterModel.ts are a coupled set — change together.
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;

export class Player {
  readonly mesh: Mesh;
  private controller: PhysicsCharacterController;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  /** Set by game.ts when lock-on is active; player faces this point. */
  lockTarget: Vector3 | null = null;

  constructor(
    scene: Scene,
    private input: Input,
    private cameraRig: CameraRig,
  ) {
    this.mesh = MeshBuilder.CreateCapsule(
      "player",
      { height: CAPSULE_HEIGHT, radius: CAPSULE_RADIUS },
      scene,
    );
    const start = new Vector3(0, 2, 0);
    this.mesh.position.copyFrom(start);
    this.controller = new PhysicsCharacterController(
      start,
      { capsuleHeight: CAPSULE_HEIGHT, capsuleRadius: CAPSULE_RADIUS },
      scene,
    );
  }

  /** Load the visual model; capsule turns invisible. Call once at startup. */
  async loadModel(scene: Scene): Promise<void> {
    const model = await loadCharacterModel(
      `${import.meta.env.BASE_URL}assets/characters/Knight.glb`,
      scene,
      CAPSULE_HEIGHT,
    );
    model.root.parent = this.mesh;
    // Capsule origin is its center; the model's origin is at the feet.
    model.root.position.y = -CAPSULE_HEIGHT / 2;
    this.mesh.isVisible = false;
    this.animController = new AnimationController(
      KNIGHT_CLIPS,
      model.animations,
      () => this.stateMachine.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  get isDead(): boolean {
    return this.stateMachine.isDead;
  }

  update(dt: number): void {
    const support = this.controller.checkSupport(dt, DOWN);
    const onGround =
      support.supportedState === CharacterSupportedState.SUPPORTED;

    // One-shot triggers (ignored while dead or mid-one-shot by the state machine).
    if (this.input.justPressed("roll")) this.stateMachine.trigger("roll");
    if (this.input.justPressed("attack")) this.stateMachine.trigger("attack");
    if (import.meta.env.DEV) {
      // Dev-only animation triggers (H/K); real damage drives these in phase 3.
      if (this.input.justPressed("debugHit")) this.stateMachine.trigger("hit");
      if (this.input.justPressed("debugDeath"))
        this.stateMachine.trigger("death");
    }

    const current = this.stateMachine.current;
    let velocity = computeMoveVelocity(
      {
        forward: this.input.isDown("forward"),
        back: this.input.isDown("back"),
        left: this.input.isDown("left"),
        right: this.input.isDown("right"),
        sprint: this.input.isDown("sprint"),
      },
      this.cameraRig.yaw,
      onGround,
      this.controller.getVelocity().y,
      dt,
    );

    if (current === "roll") {
      // Roll bursts in the facing direction; KayKit clips have no root motion.
      velocity = {
        x: Math.sin(this.mesh.rotation.y) * ROLL_SPEED,
        y: velocity.y,
        z: Math.cos(this.mesh.rotation.y) * ROLL_SPEED,
      };
    } else if (
      current === "attack" ||
      current === "hit" ||
      current === "death"
    ) {
      velocity = { x: 0, y: velocity.y, z: 0 };
    }

    this.velocityScratch.set(velocity.x, velocity.y, velocity.z);
    this.controller.setVelocity(this.velocityScratch);
    this.controller.integrate(dt, support, GRAVITY);
    this.mesh.position.copyFrom(this.controller.getPosition());

    // Facing: lock-on target wins; otherwise face movement direction.
    if (this.lockTarget && !this.isDead) {
      const dx = this.lockTarget.x - this.mesh.position.x;
      const dz = this.lockTarget.z - this.mesh.position.z;
      this.targetYaw = Math.atan2(dx, dz);
    } else if (current !== "roll" && (velocity.x !== 0 || velocity.z !== 0)) {
      this.targetYaw = Math.atan2(velocity.x, velocity.z);
    }
    this.mesh.rotation.y = lerpAngle(
      this.mesh.rotation.y,
      this.targetYaw,
      TURN_RATE * dt,
    );

    // Animation: movement direction relative to facing for strafe/back clips.
    const speed = Math.hypot(velocity.x, velocity.z);
    const cos = Math.cos(this.mesh.rotation.y);
    const sin = Math.sin(this.mesh.rotation.y);
    const localZ = (velocity.x * sin + velocity.z * cos) / (speed || 1);
    const localX = (velocity.x * cos - velocity.z * sin) / (speed || 1);
    this.stateMachine.setLocomotion(
      selectLocomotion({
        speed,
        localX,
        localZ,
        onGround,
        sprint: this.input.isDown("sprint"),
      }),
    );

    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
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
