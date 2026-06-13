import { CameraRig } from "../actors/cameraRig";
import { Player } from "../actors/playerController";
import { hud } from "../ui/hudStore";
import { buildTestZone } from "../world/testZone";
import { createEngine } from "./engine";
import { events } from "./events";
import { Input } from "./input";

export interface Game {
  dispose(): void;
}

export async function startGame(canvas: HTMLCanvasElement): Promise<Game> {
  const { engine, scene } = await createEngine(canvas);
  const zone = buildTestZone(scene);

  const input = new Input();
  input.attach(window);

  const cameraRig = new CameraRig(scene, canvas);
  const player = new Player(scene, input, cameraRig);
  await player.loadModel(scene);

  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    if (input.justPressed("lockToggle")) {
      const locked = cameraRig.lockTarget !== null;
      cameraRig.lockTarget = locked ? null : zone.dummyPosition;
      player.lockTarget = locked ? null : zone.dummyPosition;
    }
    player.update(dt);
    cameraRig.follow(player.position, dt);
    input.endFrame();
  });

  let fpsAccumulator = 0;
  engine.runRenderLoop(() => {
    scene.render();
    fpsAccumulator += engine.getDeltaTime();
    if (fpsAccumulator > 500) {
      hud.fps = engine.getFps();
      fpsAccumulator = 0;
    }
  });

  const onResize = (): void => engine.resize();
  window.addEventListener("resize", onResize);

  events.emit("game:started", {});

  return {
    dispose(): void {
      window.removeEventListener("resize", onResize);
      input.detach(window);
      scene.onBeforeRenderObservable.remove(beforeRender);
      engine.stopRenderLoop();
      player.dispose();
      cameraRig.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
