export interface PlanarPoint {
  x: number;
  z: number;
}

/**
 * True when target is within range and inside the facing arc.
 * Pure; left-handed yaw measured from +Z toward +X (matches movement.ts).
 */
export function inMeleeArc(
  origin: PlanarPoint,
  yaw: number,
  target: PlanarPoint,
  range: number,
  halfArc: number,
): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dz);
  if (dist > range) return false;
  if (dist === 0) return true;
  let delta = (Math.atan2(dx, dz) - yaw) % (2 * Math.PI);
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return Math.abs(delta) <= halfArc;
}
