import { Vector3 } from "@babylonjs/core";
import { CameraRig } from "../actors/cameraRig";
import { Player } from "../actors/playerController";
import {
  WOLF_BITE_DAMAGE,
  WOLF_BITE_HALF_ARC,
  WOLF_BITE_RANGE,
  Wolf,
} from "../actors/wolf";
import { MELEE_ATTACKS } from "../combat/attacks";
import { inMeleeArc } from "../combat/hitArc";
import { SignEffects } from "../combat/signEffects";
import { AARD_EFFECT, IGNI_EFFECT } from "../combat/signs";
import { LockOn } from "../combat/targeting";
import { hud } from "../ui/hudStore.svelte";
import { buildTestZone } from "../world/testZone";
import { createEngine } from "./engine";
import { events } from "./events";
import { Input } from "./input";

const PLAYER_START = new Vector3(0, 2, 0);

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
  const wolves = zone.wolfSpawns.map((spawn) => new Wolf(scene, spawn));
  await Promise.all([
    player.loadModel(scene),
    ...wolves.map((wolf) => wolf.loadModel(scene)),
  ]);

  const signEffects = new SignEffects(scene);
  const lockOn = new LockOn<Wolf>();

  // Combat wiring: actors announce moments; the composition root applies them.
  player.onMeleeHit = (kind) => {
    const spec = MELEE_ATTACKS[kind];
    for (const wolf of wolves) {
      if (wolf.isDead) continue;
      if (
        inMeleeArc(
          player.position,
          player.yaw,
          wolf.position,
          spec.range,
          spec.halfArc,
        )
      ) {
        wolf.takeDamage(spec.damage);
      }
    }
  };
  player.onSignBlast = (kind) => {
    if (kind === "igni") {
      signEffects.igniBurst(player.position, player.yaw);
      for (const wolf of wolves) {
        if (wolf.isDead) continue;
        if (
          inMeleeArc(
            player.position,
            player.yaw,
            wolf.position,
            IGNI_EFFECT.range,
            IGNI_EFFECT.halfArc,
          )
        ) {
          wolf.takeDamage(IGNI_EFFECT.damage);
        }
      }
    } else if (kind === "aard") {
      signEffects.aardBurst(player.position);
      for (const wolf of wolves) {
        if (wolf.isDead) continue;
        const dist = Math.hypot(
          wolf.position.x - player.position.x,
          wolf.position.z - player.position.z,
        );
        if (dist <= AARD_EFFECT.radius) {
          wolf.takeDamage(AARD_EFFECT.damage, true);
        }
      }
    } else {
      player.quen.activate(player.elapsed);
    }
  };
  for (const wolf of wolves) {
    wolf.onBite = () => {
      if (
        inMeleeArc(
          wolf.position,
          wolf.mesh.rotation.y,
          player.position,
          WOLF_BITE_RANGE,
          WOLF_BITE_HALF_ARC,
        )
      ) {
        player.takeDamage(WOLF_BITE_DAMAGE);
      }
    };
  }

  let wasDead = false;

  const beforeRender = scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);

    if (input.justPressed("lockToggle")) {
      lockOn.toggle(player.position.x, player.position.z, wolves);
    }
    lockOn.update(player.position.x, player.position.z);
    const lockPosition = lockOn.target?.position ?? null;
    player.lockTarget = lockPosition;
    cameraRig.lockTarget = lockPosition;

    player.update(dt);
    for (const wolf of wolves) {
      wolf.update(dt, player.position, player.isDead);
    }

    if (player.isDead && !wasDead) {
      events.emit("player:died", {});
    }
    wasDead = player.isDead;

    if (player.isDead && input.justPressed("respawn")) {
      player.respawn(PLAYER_START);
      for (const wolf of wolves) wolf.respawn();
      lockOn.target = null;
    }

    cameraRig.follow(player.position, dt);
    signEffects.updateQuen(player.quenActive, player.position);

    hud.health = player.health.current;
    hud.maxHealth = player.health.max;
    hud.stamina = player.stamina.current;
    hud.maxStamina = player.stamina.max;
    hud.selectedSign = player.signs.selected;
    hud.cooldowns.igni = player.signs.cooldownFraction("igni", player.elapsed);
    hud.cooldowns.aard = player.signs.cooldownFraction("aard", player.elapsed);
    hud.cooldowns.quen = player.signs.cooldownFraction("quen", player.elapsed);
    hud.quenActive = player.quenActive;
    hud.dead = player.isDead;

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
      for (const wolf of wolves) wolf.dispose();
      player.dispose();
      signEffects.dispose();
      cameraRig.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
