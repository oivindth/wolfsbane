import {
  CharacterSupportedState,
  MeshBuilder,
  PhysicsCharacterController,
  type Scene,
  Vector3,
} from "@babylonjs/core";
import type { Input } from "../core/input";
import type { CameraRig } from "./cameraRig";
import { computeMoveVelocity, lerpAngle } from "./movement";

const GRAVITY = new Vector3(0, -9.81, 0);
const DOWN = new Vector3(0, -1, 0);
const TURN_RATE = 10;

export class Player {
  readonly mesh;
  private controller: PhysicsCharacterController;
  private targetYaw = 0;

  constructor(
    scene: Scene,
    private input: Input,
    private cameraRig: CameraRig,
  ) {
    this.mesh = MeshBuilder.CreateCapsule(
      "player",
      { height: 1.8, radius: 0.4 },
      scene,
    );
    const start = new Vector3(0, 2, 0);
    this.mesh.position.copyFrom(start);
    this.controller = new PhysicsCharacterController(
      start,
      { capsuleHeight: 1.8, capsuleRadius: 0.4 },
      scene,
    );
  }

  get position(): Vector3 {
    return this.mesh.position;
  }

  update(dt: number): void {
    const support = this.controller.checkSupport(dt, DOWN);
    const onGround =
      support.supportedState === CharacterSupportedState.SUPPORTED;

    const velocity = computeMoveVelocity(
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

    this.controller.setVelocity(
      new Vector3(velocity.x, velocity.y, velocity.z),
    );
    this.controller.integrate(dt, support, GRAVITY);
    this.mesh.position.copyFrom(this.controller.getPosition());

    if (velocity.x !== 0 || velocity.z !== 0) {
      this.targetYaw = Math.atan2(velocity.x, velocity.z);
    }
    this.mesh.rotation.y = lerpAngle(
      this.mesh.rotation.y,
      this.targetYaw,
      TURN_RATE * dt,
    );
  }
}
