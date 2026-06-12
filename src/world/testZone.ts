import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { MASK_WORLD } from "../core/collisionMasks";

export interface TestZone {
  /**
   * Lock-on target for phase 2; replaced by real enemies in phase 3.
   * Do not mutate — this IS the dummy mesh's position vector.
   */
  dummyPosition: Vector3;
}

/** Placeholder zone: lit ground plane with obstacle boxes. Replaced in phase 4. */
export function buildTestZone(scene: Scene): TestZone {
  scene.clearColor = new Color4(0.53, 0.75, 0.92, 1);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogStart = 60;
  scene.fogEnd = 150;
  scene.fogColor = new Color3(0.53, 0.75, 0.92);

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.5;
  const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.4), scene);
  sun.intensity = 0.9;

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 200, height: 200 },
    scene,
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.35, 0.5, 0.3);
  ground.material = groundMat;
  const groundPhysics = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    { mass: 0 },
    scene,
  );
  groundPhysics.shape.filterMembershipMask = MASK_WORLD;

  const boxMat = new StandardMaterial("boxMat", scene);
  boxMat.diffuseColor = new Color3(0.55, 0.45, 0.35);
  for (let i = 0; i < 5; i++) {
    const box = MeshBuilder.CreateBox(`obstacle${i}`, { size: 2 }, scene);
    box.material = boxMat;
    box.position = new Vector3(i * 4 - 8, 1, 8);
    const boxPhysics = new PhysicsAggregate(
      box,
      PhysicsShapeType.BOX,
      { mass: 0 },
      scene,
    );
    boxPhysics.shape.filterMembershipMask = MASK_WORLD;
  }

  const dummy = MeshBuilder.CreateCapsule(
    "trainingDummy",
    { height: 1.8, radius: 0.4 },
    scene,
  );
  const dummyMat = new StandardMaterial("dummyMat", scene);
  dummyMat.diffuseColor = new Color3(0.7, 0.25, 0.2);
  dummy.material = dummyMat;
  dummy.position = new Vector3(4, 0.9, -4);

  return { dummyPosition: dummy.position };
}
