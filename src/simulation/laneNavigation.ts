import { SOLID_OBJECTS } from './config.ts';
import { canStand, straightFraction } from './collision.ts';
import type { Point } from './movement.ts';

/** Small visibility graph around static foundations; only used when direct travel is blocked. */
export function createLaneNavigation(radius: number) {
  const corners = SOLID_OBJECTS.flatMap(object => {
    const offset = object.radius + radius + 0.15;
    return [-1, 1].flatMap(x => [-1, 1].map(z => ({ x: object.x + x * offset, z: object.z + z * offset })));
  }).filter(p => canStand(p, radius));
  const length = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
  const visible = (a: Point, b: Point) => straightFraction(a, { x: b.x - a.x, z: b.z - a.z }, radius) >= 1;
  const edges = corners.map(a => corners.map(b => visible(a, b) ? length(a, b) : Infinity));
  return (start: Point, goal: Point): Point => {
    if (visible(start, goal)) return goal;
    if (!canStand(goal, radius)) return start;
    const costs = corners.map(p => visible(start, p) ? length(start, p) : Infinity);
    const first = corners.map((_, i) => i), visited = new Set<number>();
    let best = Infinity, next = start;
    for (let step = 0; step < corners.length; step++) {
      let index = -1;
      for (let i = 0; i < corners.length; i++) if (!visited.has(i) && costs[i] < (index < 0 ? Infinity : costs[index])) index = i;
      if (index < 0 || costs[index] >= best) break;
      visited.add(index);
      if (visible(corners[index], goal) && costs[index] + length(corners[index], goal) < best) {
        best = costs[index] + length(corners[index], goal); next = corners[first[index]];
      }
      for (let i = 0; i < corners.length; i++) {
        const cost = costs[index] + edges[index][i];
        if (cost < costs[i]) { costs[i] = cost; first[i] = first[index]; }
      }
    }
    return next;
  };
}
