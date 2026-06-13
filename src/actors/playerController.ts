import {
  CharacterSupportedState,
  type Mesh,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { MELEE_ATTACKS, type MeleeKind } from "../combat/attacks";
import { Health } from "../combat/health";
import { MeleeSequencer } from "../combat/meleeSequencer";
import {
  QuenShield,
  SIGN_SPECS,
  SignBook,
  type SignKind,
} from "../combat/signs";
import { Stamina } from "../combat/stamina";
import type { Input } from "../core/input";
import { KNIGHT_CLIPS } from "../data/knightAnimations";
import { AnimationController } from "./animationController";
import {
  AnimStateMachine,
  isMeleeState,
  selectLocomotion,
} from "./animationStates";
import type { CameraRig } from "./cameraRig";
import { loadCharacterModel } from "./characterModel";
import { computeMoveVelocity, lerpAngle } from "./movement";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;
const ROLL_SPEED = 6;
const ROLL_COST = 15;
const SPRINT_DRAIN_PER_SECOND = 8;
const MAX_HEALTH = 100;
const MAX_STAMINA = 100;
/** Real seconds into Spellcast_Shoot (0.933s at 1.2x ≈ 0.78s) when the sign fires. */
const CAST_BLAST_AT = 0.4;

// Capsule dimensions, camera follow offset (cameraRig.ts) and the model
// scaling in characterModel.ts are a coupled set — change together.
const CAPSULE_HEIGHT = 1.8;
const CAPSULE_RADIUS = 0.4;

export class Player {
  readonly mesh: Mesh;
  readonly health = new Health(MAX_HEALTH);
  readonly stamina = new Stamina(MAX_STAMINA);
  readonly signs = new SignBook();
  readonly quen = new QuenShield();
  /** Set by game.ts when lock-on is active; player faces this point. */
  lockTarget: Vector3 | null = null;
  /** Called at a melee swing's damage moment; game.ts applies it to enemies. */
  onMeleeHit: ((kind: MeleeKind) => void) | undefined;
  /** Called when a cast sign fires; game.ts applies the effect. */
  onSignBlast: ((kind: SignKind) => void) | undefined;

  private controller: PhysicsCharacterController;
  private targetYaw = 0;
  private readonly velocityScratch = new Vector3();
  private stateMachine = new AnimStateMachine();
  private animController: AnimationController | undefined;
  private sequencer = new MeleeSequencer();
  private elapsedSeconds = 0;
  private pendingSign: SignKind | null = null;
  private castElapsed = 0;

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
      () => this.onOneShotEnd(),
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  /** Facing yaw (left-handed, +Z = 0) — used for hit arcs and sign cones. */
  get yaw(): number {
    return this.mesh.rotation.y;
  }

  get isDead(): boolean {
    return this.stateMachine.isDead;
  }

  /** Game-time seconds since spawn; the clock for sign cooldowns and Quen. */
  get elapsed(): number {
    return this.elapsedSeconds;
  }

  get quenActive(): boolean {
    return this.quen.isActive(this.elapsedSeconds);
  }

  /** Incoming damage. Rolls grant i-frames; Quen soaks before health. */
  takeDamage(amount: number): void {
    if (this.stateMachine.isDead) return;
    if (this.stateMachine.current === "roll") return;
    const through = this.quen.absorb(amount, this.elapsedSeconds);
    if (through <= 0) return;
    this.health.damage(through);
    this.sequencer.cancel();
    this.pendingSign = null;
    this.stateMachine.trigger(this.health.isDead ? "death" : "hit");
  }

  /** Full reset at a position (player chose to retry). */
  respawn(position: Vector3): void {
    this.health.reset();
    this.stamina.reset();
    this.signs.reset();
    this.quen.clear();
    this.sequencer.cancel();
    this.pendingSign = null;
    this.stateMachine.reset();
    this.controller.setPosition(position);
    this.mesh.position.copyFrom(position);
  }

  update(dt: number): void {
    this.elapsedSeconds += dt;
    this.stamina.update(dt);

    const support = this.controller.checkSupport(dt, DOWN);
    const onGround =
      support.supportedState === CharacterSupportedState.SUPPORTED;

    if (this.input.justPressed("sign1")) this.signs.select("igni");
    if (this.input.justPressed("sign2")) this.signs.select("aard");
    if (this.input.justPressed("sign3")) this.signs.select("quen");

    if (
      this.input.justPressed("roll") &&
      this.stamina.current >= ROLL_COST &&
      this.stateMachine.trigger("roll")
    ) {
      this.stamina.trySpend(ROLL_COST);
      this.sequencer.cancel();
    }
    if (this.input.justPressed("attack")) this.tryMelee("light");
    if (this.input.justPressed("heavy")) this.tryMelee("heavy");
    if (this.input.justPressed("castSign")) this.tryCast();

    // Melee damage moment.
    const hitKind = this.sequencer.update(dt);
    if (hitKind) this.onMeleeHit?.(hitKind);

    // Sign blast moment.
    if (this.pendingSign) {
      this.castElapsed += dt;
      if (this.castElapsed >= CAST_BLAST_AT) {
        const sign = this.pendingSign;
        this.pendingSign = null;
        this.onSignBlast?.(sign);
      }
    }

    // Sprint costs stamina; an empty pool drops you to a walk.
    const wantsMove =
      this.input.isDown("forward") ||
      this.input.isDown("back") ||
      this.input.isDown("left") ||
      this.input.isDown("right");
    const sprinting =
      this.input.isDown("sprint") &&
      wantsMove &&
      onGround &&
      this.stamina.drain(SPRINT_DRAIN_PER_SECOND, dt);

    const current = this.stateMachine.current;
    let velocity = computeMoveVelocity(
      {
        forward: this.input.isDown("forward"),
        back: this.input.isDown("back"),
        left: this.input.isDown("left"),
        right: this.input.isDown("right"),
        sprint: sprinting,
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
      isMeleeState(current) ||
      current === "cast" ||
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
        sprint: sprinting,
      }),
    );

    this.animController?.play(this.stateMachine.current);
    this.animController?.update(dt);
  }

  private tryMelee(kind: "light" | "heavy"): void {
    const current = this.stateMachine.current;
    if (this.stateMachine.isDead) return;
    if (!this.sequencer.isAttacking && !isMeleeState(current)) {
      // Only start a fresh swing from locomotion states.
      if (current === "roll" || current === "hit" || current === "cast") return;
    }
    const started = this.sequencer.press(kind);
    if (!started) return; // buffered for the chain
    const spec = MELEE_ATTACKS[started];
    if (!this.stamina.trySpend(spec.staminaCost)) {
      this.sequencer.cancel();
      return;
    }
    if (!this.stateMachine.trigger(spec.state)) {
      // Should not happen given the guards; keep sequencer and anims in sync.
      this.sequencer.cancel();
    }
  }

  private tryCast(): void {
    const current = this.stateMachine.current;
    if (this.stateMachine.isDead || this.sequencer.isAttacking) return;
    if (current === "roll" || current === "hit" || current === "cast") return;
    const cost = SIGN_SPECS[this.signs.selected].staminaCost;
    if (this.stamina.current < cost) return;
    const kind = this.signs.tryCast(this.elapsedSeconds);
    if (!kind) return; // cooling down
    if (!this.stateMachine.trigger("cast")) return;
    this.stamina.trySpend(cost);
    this.pendingSign = kind;
    this.castElapsed = 0;
  }

  private onOneShotEnd(): void {
    const ended = this.stateMachine.current;
    this.stateMachine.onOneShotEnd();
    if (!isMeleeState(ended)) return;
    const chained = this.sequencer.onAttackEnd();
    if (!chained) return;
    const spec = MELEE_ATTACKS[chained];
    if (!this.stamina.trySpend(spec.staminaCost)) {
      this.sequencer.cancel();
      return;
    }
    if (!this.stateMachine.trigger(spec.state)) {
      this.sequencer.cancel();
    }
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
