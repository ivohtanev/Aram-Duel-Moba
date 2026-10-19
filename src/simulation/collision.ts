import { HERO, MAP, SOLID_OBJECTS, isOnMap } from './config.ts';

type Point = { x: number; z: number };
type Interval = { enter: number; exit: number; normal: (p: Point) => Point };
const EPS = 1e-9;
const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z;
const at = (p: Point, d: Point, t: number): Point => ({ x: p.x + d.x * t, z: p.z + d.z * t });
const unit = (p: Point): Point => {
  const length = Math.hypot(p.x, p.z);
  return { x: p.x / length, z: p.z / length };
};

function circle(p: Point, d: Point, center: Point, radius: number): Interval | undefined {
  const offset = { x: p.x - center.x, z: p.z - center.z };
  const a = dot(d, d), b = dot(offset, d), c = dot(offset, offset) - radius * radius;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return;
  const root = Math.sqrt(discriminant);
  return { enter: (-b - root) / a, exit: (-b + root) / a,
    normal: hit => unit({ x: hit.x - center.x, z: hit.z - center.z }) };
}

function bridge(p: Point, d: Point, radius: number): Interval | undefined {
  let enter = -Infinity, exit = Infinity;
  let normal: Point = { x: 0, z: 0 };
  for (const axis of ['x', 'z'] as const) {
    const half = (axis === 'x' ? MAP.bridge.width : MAP.bridge.length) / 2 - radius;
    if (Math.abs(d[axis]) < EPS) { if (Math.abs(p[axis]) > half) return; continue; }
    const a = (-half - p[axis]) / d[axis], b = (half - p[axis]) / d[axis];
    enter = Math.max(enter, Math.min(a, b));
    if (Math.max(a, b) < exit) {
      exit = Math.max(a, b);
      normal = { x: 0, z: 0 }; normal[axis] = Math.sign(d[axis]);
    }
  }
  return enter <= exit ? { enter, exit, normal: () => normal } : undefined;
}

/** Conservative union of inset bridge and inset bases, matching isOnMap. */
function boundaryHit(p: Point, d: Point, radius: number = HERO.radius) {
  const intervals = [bridge(p, d, radius), ...MAP.bases.map(base => circle(p, d, base, MAP.baseRadius - radius))]
    .filter((value): value is Interval => value !== undefined)
    .sort((a, b) => a.enter - b.enter);
  let end = 0;
  let last: Interval | undefined;
  for (const interval of intervals) {
    if (interval.exit < -EPS) continue;
    if (interval.enter > end + EPS) break;
    if (interval.exit >= end) { end = interval.exit; last = interval; }
  }
  // Near-tangent roundoff may erase a zero-length interval: fail closed.
  if (!last) return { t: 0, normal: unit(d) };
  return end < 1 ? { t: Math.max(0, end), normal: last.normal(at(p, d, end)) } : undefined;
}

export function canStand(p: Point): boolean {
  return isOnMap(p.x, p.z, HERO.radius)
    && SOLID_OBJECTS.every(object => Math.hypot(p.x - object.x, p.z - object.z) >= object.radius + HERO.radius - EPS);
}

/** Fraction of a straight segment before the first boundary/solid object, without sliding. */
export function straightFraction(p: Point, d: Point, radius: number): number {
  if (!Number.isFinite(d.x) || !Number.isFinite(d.z) || !isOnMap(p.x, p.z, radius)) return 0;
  if (dot(d, d) < EPS * EPS) return 1;
  if (SOLID_OBJECTS.some(object => Math.hypot(p.x - object.x, p.z - object.z) < object.radius + radius - EPS)) return 0;
  let t = boundaryHit(p, d, radius)?.t ?? 1;
  for (const object of SOLID_OBJECTS) {
    const hit = circle(p, d, object, object.radius + radius);
    if (hit && hit.enter >= -EPS && hit.enter <= 1 && hit.exit > EPS) {
      t = Math.min(t, Math.max(0, Math.min(1 - 1e-12, hit.enter)));
    }
  }
  return Math.max(0, Math.min(1, t));
}

/** Swept circle: earliest contact, then remove the component into the surface.
 * Normals point out of the allowed region. Four contacts bound work per tick;
 * any unresolved remainder is discarded rather than allowing penetration.
 */
export function moveWithCollisions(start: Point, displacement: Point): Point {
  if (!canStand(start) || !Number.isFinite(displacement.x) || !Number.isFinite(displacement.z)) return { ...start };
  let p = { ...start }, d = { ...displacement };
  for (let iteration = 0; iteration < 4 && dot(d, d) > EPS * EPS; iteration++) {
    let hit = boundaryHit(p, d);
    for (const object of SOLID_OBJECTS) {
      const obstacle = circle(p, d, object, object.radius + HERO.radius);
      if (obstacle && obstacle.enter >= -EPS && obstacle.enter < 1 && obstacle.exit > EPS) {
        const t = Math.max(0, obstacle.enter);
        const outward = obstacle.normal(at(p, d, t));
        const normal = { x: -outward.x, z: -outward.z };
        if (dot(d, normal) > EPS && (!hit || t < hit.t)) hit = { t, normal };
      }
    }
    if (!hit) {
      const end = at(p, d, 1);
      return canStand(end) ? end : p;
    }
    // Back off slightly so tangential travel along curved boundaries can progress.
    const contact = at(p, d, Math.max(0, hit.t - 1e-7 / Math.hypot(d.x, d.z)));
    const inset = { x: contact.x - hit.normal.x * 1e-7, z: contact.z - hit.normal.z * 1e-7 };
    if (canStand(inset)) p = inset;
    else if (canStand(contact)) p = contact;
    else return p;
    d = { x: d.x * (1 - hit.t), z: d.z * (1 - hit.t) };
    const into = Math.max(0, dot(d, hit.normal));
    d = { x: d.x - hit.normal.x * into, z: d.z - hit.normal.z * into };
  }
  return p;
}
