import { Engine, HavokPlugin, Scene, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

export interface EngineContext {
  engine: Engine;
  scene: Scene;
}

export async function createEngine(
  canvas: HTMLCanvasElement,
): Promise<EngineContext> {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  const havok = await HavokPhysics();
  scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
  return { engine, scene };
}
