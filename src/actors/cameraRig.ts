import {
  ArcRotateCamera,
  PhysicsEngineV2,
  PhysicsRaycastResult,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import { MASK_WORLD } from "../core/collisionMasks";
import { lerpAngle } from "./movement";

const LOCK_STEER_RATE = 5;

const COLLISION_MARGIN = 0.3;

export class CameraRig {
  readonly camera: ArcRotateCamera;
  /** Point the camera keeps centered while locked on; null = free camera. */
  lockTarget: Vector3 | null = null;
  private readonly directionScratch = new Vector3();
  private readonly rayEndScratch = new Vector3();
  private readonly raycastResult = new PhysicsRaycastResult();
  private desiredRadius: number;
  private clamped = false;

  constructor(
    private scene: Scene,
    canvas: HTMLCanvasElement,
  ) {
    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      1.2,
      8,
      new Vector3(0, 1.5, 0),
      scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 12;
    this.camera.upperBetaLimit = 1.45;
    this.camera.wheelDeltaPercentage = 0.01;
    this.desiredRadius = this.camera.radius;
  }

  /** World yaw of the camera's view direction (left-handed, +Z = 0). */
  get yaw(): number {
    this.camera.target.subtractToRef(
      this.camera.position,
      this.directionScratch,
    );
    return Math.atan2(this.directionScratch.x, this.directionScratch.z);
  }

  follow(position: Vector3, dt: number): void {
    this.camera.target.copyFrom(position);
    this.camera.target.y += 1.2;
    if (this.lockTarget) {
      // Ease the camera to sit behind the player relative to the target.
      const dx = position.x - this.lockTarget.x;
      const dz = position.z - this.lockTarget.z;
      const desiredAlpha = Math.atan2(dz, dx);
      this.camera.alpha = lerpAngle(
        this.camera.alpha,
        desiredAlpha,
        LOCK_STEER_RATE * dt,
      );
    }
    this.updateCollision();
  }

  /** Pull the camera in when world geometry blocks the view line. */
  private updateCollision(): void {
    const physics = this.scene.getPhysicsEngine();
    if (!physics || !(physics instanceof PhysicsEngineV2)) return;
    // While unobstructed, track the user's zoom as the desired radius.
    if (!this.clamped) {
      this.desiredRadius = this.camera.radius;
    }
    this.camera.position.subtractToRef(
      this.camera.target,
      this.directionScratch,
    );
    this.directionScratch.normalize();
    this.rayEndScratch.copyFrom(this.camera.target);
    this.directionScratch.scaleAndAddToRef(
      this.desiredRadius,
      this.rayEndScratch,
    );
    physics.raycastToRef(
      this.camera.target,
      this.rayEndScratch,
      this.raycastResult,
      {
        collideWith: MASK_WORLD,
      },
    );
    if (this.raycastResult.hasHit) {
      // reuse directionScratch as the hit-distance vector after the raycast
      this.raycastResult.hitPointWorld.subtractToRef(
        this.camera.target,
        this.directionScratch,
      );
      const distance = this.directionScratch.length();
      this.camera.radius = Math.max(
        distance - COLLISION_MARGIN,
        this.camera.lowerRadiusLimit ?? 1,
      );
      this.clamped = true;
    } else if (this.clamped) {
      this.camera.radius = this.desiredRadius;
      this.clamped = false;
    }
  }

  dispose(): void {
    this.camera.dispose();
  }
}
