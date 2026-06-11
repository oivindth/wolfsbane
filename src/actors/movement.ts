export interface MoveInput {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const GRAVITY = 9.81;
const WALK_SPEED = 3;
const SPRINT_SPEED = 6;

/**
 * Horizontal velocity from input rotated by camera yaw, plus vertical
 * velocity: 0 when supported, integrating gravity when airborne.
 * Left-handed world; yaw measured from +Z toward +X.
 */
export function computeMoveVelocity(
  input: MoveInput,
  cameraYaw: number,
  onGround: boolean,
  verticalVelocity: number,
  dt: number,
): Vec3 {
  let localX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let localZ = (input.forward ? 1 : 0) - (input.back ? 1 : 0);

  const length = Math.hypot(localX, localZ);
  if (length > 0) {
    localX /= length;
    localZ /= length;
  }

  const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  const cos = Math.cos(cameraYaw);
  const sin = Math.sin(cameraYaw);

  return {
    x: (localX * cos + localZ * sin) * speed,
    y: onGround ? 0 : verticalVelocity - GRAVITY * dt,
    z: (-localX * sin + localZ * cos) * speed,
  };
}

/** Frame-rate-safe shortest-path angle interpolation. */
export function lerpAngle(from: number, to: number, t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  let delta = (to - from) % (2 * Math.PI);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return from + delta * clamped;
}
