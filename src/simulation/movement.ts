import { HERO } from './config.ts';

export type Point = { x: number; z: number };
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;

/** Pure world-space simulation. Rendering and input own their respective adapters. */
export function step(position: Point, input: Point): Point {
  const length = Math.hypot(input.x, input.z);
  if (!Number.isFinite(length)) return { ...position };
  const scale = HERO.speed * STEP / Math.max(1, length);
  return { x: position.x + input.x * scale, z: position.z + input.z * scale };
}

export function createMovement() {
  let current: Point = { ...HERO.spawn };
  let previous = { ...current };
  let remainder = 0;
  return {
    advance(seconds: number, input: Point) {
      if (!Number.isFinite(seconds) || seconds < 0) return;
      remainder += Math.min(seconds, MAX_FRAME);
      // Tolerance avoids losing a tick at exact frame boundaries due to rounding.
      while (remainder + 1e-12 >= STEP) {
        previous = current;
        current = step(current, input);
        remainder = Math.max(0, remainder - STEP);
      }
    },
    position(): Point { return { ...current }; },
    interpolated(): Point {
      const alpha = remainder / STEP;
      return {
        x: previous.x + (current.x - previous.x) * alpha,
        z: previous.z + (current.z - previous.z) * alpha,
      };
    },
    suspend() { remainder = 0; previous = { ...current }; },
  };
}
