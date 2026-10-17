/** X across the bridge, Z along it, Y up; one world unit ≈ one metre.
 * Shared by rendering and future movement/collision code.
 */
export const MAP = {
  name: 'Скрежният мост',
  bridge: { width: 14, length: 52, surfaceY: 0 },
  lane: { width: 11.6 },
  bases: [{ x: 0, z: -27, team: 'blue' }, { x: 0, z: 27, team: 'coral' }],
  baseRadius: 8,
  towers: [
    { x: 0, z: -19, team: 'blue' }, { x: 0, z: -11, team: 'blue' },
    { x: 0, z: 11, team: 'coral' }, { x: 0, z: 19, team: 'coral' },
  ],
  brush: [
    { x: -5.15, z: -5, width: 1.7, length: 4.6 },
    { x: 5.15, z: 5, width: 1.7, length: 4.6 },
    { x: -5.15, z: 15, width: 1.7, length: 3.2 },
    { x: 5.15, z: -15, width: 1.7, length: 3.2 },
  ],
  relics: [{ x: 3.6, z: -7.5 }, { x: -3.6, z: 7.5 }],
} as const;

export const HERO = {
  spawn: { x: -1.4, z: -4 }, radius: 0.42, height: 1.55, health: 1000, speed: 5,
  attack: { damage: 60, range: 5, interval: 0.8 },
  q: { damage: 120, range: 9, speed: 12, cooldown: 4 },
  e: { damage: 100, radius: 1.5, range: 6, delay: 0.5, cooldown: 7 },
  r: { distance: 3, duration: 0.2, cooldown: 6 },
} as const;
export const TARGET = { spawn: { x: 1.4, z: 4 }, health: 2000, respawnDelay: 2 } as const;

/** Walkable footprint only; decorative walls, towers and brush have no collisions yet. */
export function isOnMap(x: number, z: number, inset = 0): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(inset) || inset < 0) return false;
  if (Math.abs(x) <= MAP.bridge.width / 2 - inset && Math.abs(z) <= MAP.bridge.length / 2 - inset) return true;
  const radius = MAP.baseRadius - inset;
  return radius >= 0 && MAP.bases.some(base => Math.hypot(x - base.x, z - base.z) <= radius);
}
