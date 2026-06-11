import { ArcRotateCamera, type Scene, Vector3 } from "@babylonjs/core";

export class CameraRig {
  readonly camera: ArcRotateCamera;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
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
  }

  /** World yaw of the camera's view direction (left-handed, +Z = 0). */
  get yaw(): number {
    const dir = this.camera.target.subtract(this.camera.position);
    return Math.atan2(dir.x, dir.z);
  }

  follow(position: Vector3): void {
    this.camera.target.copyFrom(position);
    this.camera.target.y += 1.2;
  }
}
