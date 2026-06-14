import {
  Color3,
  Color4,
  DynamicTexture,
  type Mesh,
  MeshBuilder,
  ParticleSystem,
  type Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

/** Soft radial dot used by all sign particles (no external texture files). */
function makeParticleTexture(scene: Scene): DynamicTexture {
  const size = 64;
  const texture = new DynamicTexture("signParticle", size, scene, false);
  // Babylon's ICanvasRenderingContext typing omits gradient APIs.
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.update();
  texture.hasAlpha = true;
  return texture;
}

/** Fire-and-forget particle bursts for Igni/Aard and the Quen bubble. */
export class SignEffects {
  private quenSphere: Mesh;

  constructor(private scene: Scene) {
    this.quenSphere = MeshBuilder.CreateSphere(
      "quenShield",
      { diameter: 2.4, segments: 12 },
      scene,
    );
    const material = new StandardMaterial("quenMat", scene);
    material.emissiveColor = new Color3(1, 0.85, 0.3);
    material.alpha = 0.25;
    material.disableLighting = true;
    this.quenSphere.material = material;
    this.quenSphere.isPickable = false;
    this.quenSphere.setEnabled(false);
  }

  /** Show/hide the golden shield bubble; call every frame. */
  updateQuen(active: boolean, playerPosition: Vector3): void {
    this.quenSphere.setEnabled(active);
    if (active) this.quenSphere.position.copyFrom(playerPosition);
  }

  /** Short flame cone in front of the caster. */
  igniBurst(origin: Vector3, yaw: number): void {
    const ps = this.makeBurst("igni", 200);
    ps.emitter = origin.clone();
    ps.minEmitBox = new Vector3(-0.2, 0.6, -0.2);
    ps.maxEmitBox = new Vector3(0.2, 1.2, 0.2);
    const forward = new Vector3(Math.sin(yaw), 0.1, Math.cos(yaw));
    ps.direction1 = forward.scale(6);
    ps.direction2 = forward.scale(10).add(new Vector3(0, 1.5, 0));
    ps.color1 = new Color4(1, 0.6, 0.1, 1);
    ps.color2 = new Color4(1, 0.3, 0, 1);
    ps.colorDead = new Color4(0.3, 0, 0, 0);
    ps.emitRate = 350;
    ps.start();
  }

  /** Radial blue shockwave around the caster. */
  aardBurst(origin: Vector3): void {
    const ps = this.makeBurst("aard", 300);
    ps.emitter = origin.clone();
    ps.createSphereEmitter(0.5, 0);
    ps.minEmitPower = 8;
    ps.maxEmitPower = 12;
    ps.color1 = new Color4(0.5, 0.7, 1, 1);
    ps.color2 = new Color4(0.8, 0.9, 1, 1);
    ps.colorDead = new Color4(0.2, 0.3, 0.6, 0);
    ps.emitRate = 600;
    ps.start();
  }

  private makeBurst(name: string, capacity: number): ParticleSystem {
    const ps = new ParticleSystem(name, capacity, this.scene);
    // Each burst owns its texture so disposeOnStop's dispose() can free it.
    // (A shared texture would be freed by the first burst's self-dispose and
    // break later casts, since dispose() defaults to disposeTexture=true.)
    ps.particleTexture = makeParticleTexture(this.scene);
    ps.blendMode = ParticleSystem.BLENDMODE_ONEONE;
    ps.minSize = 0.15;
    ps.maxSize = 0.5;
    ps.minLifeTime = 0.2;
    ps.maxLifeTime = 0.45;
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1.5;
    ps.updateSpeed = 0.016;
    ps.targetStopDuration = 0.3;
    // Fire-and-forget: Babylon defers disposal until all particles die, then
    // frees the system and its (per-burst) texture. No manual cleanup needed.
    ps.disposeOnStop = true;
    return ps;
  }

  dispose(): void {
    this.quenSphere.material?.dispose();
    this.quenSphere.dispose();
  }
}
