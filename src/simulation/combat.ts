import { HERO, TARGET } from './config.ts';
import { createHealth, isValidTarget, type Combatant } from './health.ts';
import { STEP, step, type Point } from './movement.ts';
import { straightFraction } from './collision.ts';
import type { Action, Aim } from '../input/touch.ts';

export type Projectile = { id: number; position: Point; targetId: string; generation: number;
  kind: 'attack' | 'q'; direction: Point; remaining: number };
export type Area = { id: number; position: Point; remaining: number };
export type AttackResult = 'fired' | 'cooldown' | 'no-target' | 'dead' | 'casting' | 'invalid';
type Cast = { aim: Aim; remaining: number; target?: Combatant; generation?: number };

/** Center-to-center range; input order breaks exact distance ties deterministically. */
export function nearestTarget(source: Combatant, candidates: readonly Combatant[], range: number): Combatant | undefined {
  let selected: Combatant | undefined, distance = range;
  for (const target of candidates) {
    const next = Math.hypot(target.position.x - source.position.x, target.position.z - source.position.z);
    if (isValidTarget(source, target) && Number.isFinite(next) && next <= distance && (!selected || next < distance)) {
      selected = target; distance = next;
    }
  }
  return selected;
}

/** Swept point against a circle: catches a hit even if a tick crosses the whole target. */
function targetFraction(start: Point, delta: Point, target: Point, radius: number): number {
  const x = start.x - target.x, z = start.z - target.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = delta.x * delta.x + delta.z * delta.z;
  const b = x * delta.x + z * delta.z, discriminant = b * b - a * c;
  if (a === 0 || discriminant < 0) return Infinity;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : Infinity;
}

/** Every timer and displacement uses the same fixed movement clock. */
export function createCombat() {
  const health = createHealth();
  let cooldownsEnabled = true;
  let projectiles: Projectile[] = [], areas: Area[] = [], nextId = 0;
  let pending: Cast | undefined;
  let dash: { direction: Point; remaining: number } | undefined;
  const cooldowns: Record<Action, number> = { attack: 0, q: 0, e: 0, r: 0 };
  const release = (cast: Cast) => {
    const { aim, target, generation } = cast;
    if (aim.action === 'e') {
      areas.push({ id: nextId++, position: {
        x: health.hero.position.x + aim.direction.x * aim.distance,
        z: health.hero.position.z + aim.direction.z * aim.distance,
      }, remaining: HERO.e.delay });
    } else if (aim.action === 'q' || (target && target.health > 0 && target.generation === generation)) {
      projectiles.push({ id: nextId++, kind: aim.action as 'attack' | 'q', position: { ...health.hero.position },
        targetId: target?.id ?? '', generation: generation ?? 0, direction: { ...aim.direction }, remaining: HERO.q.range });
    }
  };
  const cast = (position: Point, raw: Aim): AttackResult => {
    health.hero.position = { ...position };
    if (raw.canceled || !Object.hasOwn(cooldowns, raw.action) || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return 'invalid';
    if (health.hero.health <= 0) return 'dead';
    if (cooldowns[raw.action] > 1e-12) return 'cooldown';
    if (pending || dash) return 'casting';
    const length = Math.hypot(raw.direction.x, raw.direction.z);
    if (!Number.isFinite(length) || length < 1e-9 || !Number.isFinite(raw.distance) || raw.distance < 0) return 'invalid';
    const reach = raw.action === 'r' ? HERO.r.distance : HERO[raw.action].range;
    const aim: Aim = { ...raw, direction: { x: raw.direction.x / length, z: raw.direction.z / length }, distance: Math.min(reach, raw.distance) };
    const target = raw.action === 'attack' ? nearestTarget(health.hero, [health.dummy], reach) : undefined;
    if (raw.action === 'attack' && !target) return 'no-target';
    cooldowns[raw.action] = cooldownsEnabled ? (raw.action === 'attack' ? HERO.attack.interval : HERO[raw.action].cooldown) : 0;
    if (raw.action === 'r') dash = { direction: aim.direction, remaining: HERO.r.duration };
    else pending = { aim, remaining: HERO[raw.action].castTime, target, generation: target?.generation };
    return 'fired';
  };
  return {
    ...health, cast,
    reset() {
      health.reset(); projectiles = []; areas = []; pending = undefined; dash = undefined;
      for (const action of Object.keys(cooldowns) as Action[]) cooldowns[action] = 0;
    },
    setCooldownsEnabled(enabled: boolean) {
      cooldownsEnabled = enabled;
      if (!enabled) for (const action of Object.keys(cooldowns) as Action[]) cooldowns[action] = 0;
    },
    projectiles: () => projectiles as readonly Projectile[],
    areas: () => areas as readonly Area[],
    cooldown: (action: Action = 'attack') => cooldowns[action],
    casting: () => pending?.aim.action ?? (dash ? 'r' : undefined),
    attack: (position: Point) => cast(position, { action: 'attack', direction: { x: 0, z: 1 }, distance: HERO.attack.range, canceled: false }),
    move(position: Point, input: Point): Point {
      if (health.hero.health <= 0 || pending) return { ...position };
      if (!dash) return step(position, input);
      const distance = HERO.r.distance / HERO.r.duration * Math.min(STEP, dash.remaining);
      const delta = { x: dash.direction.x * distance, z: dash.direction.z * distance };
      const fraction = straightFraction(position, delta, HERO.radius);
      const safe = fraction < 1 ? Math.max(0, fraction - 1e-6 / distance) : 1;
      // Keep the casting lock until duration ends, even after hitting a wall.
      return { x: position.x + delta.x * safe, z: position.z + delta.z * safe };
    },
    tick(position: Point) {
      health.hero.position = { ...position };
      health.tick(STEP);
      for (const action of Object.keys(cooldowns) as Action[]) cooldowns[action] = Math.max(0, cooldowns[action] - STEP);
      if (dash) { dash.remaining -= STEP; if (dash.remaining <= 1e-12 || health.hero.health <= 0) dash = undefined; }
      // Advance existing effects first; a new effect starts at the end of this tick.
      areas = areas.filter(area => {
        area.remaining -= STEP;
        if (area.remaining > 1e-12) return true;
        if (Math.hypot(health.dummy.position.x - area.position.x, health.dummy.position.z - area.position.z) <= HERO.e.radius + TARGET.radius) {
          health.damage(health.hero, health.dummy, HERO.e.damage);
        }
        return false;
      });
      projectiles = projectiles.filter(projectile => {
        const target = health.dummy;
        if (projectile.kind === 'attack') {
          if (target.health <= 0 || target.id !== projectile.targetId || target.generation !== projectile.generation) return false;
          const dx = target.position.x - projectile.position.x, dz = target.position.z - projectile.position.z;
          const distance = Math.hypot(dx, dz), travel = HERO.attack.projectileSpeed * STEP;
          if (distance <= travel + 1e-12) { health.damage(health.hero, target, HERO.attack.damage); return false; }
          projectile.position.x += dx / distance * travel; projectile.position.z += dz / distance * travel;
          return true;
        }
        const travel = Math.min(projectile.remaining, HERO.q.speed * STEP);
        const delta = { x: projectile.direction.x * travel, z: projectile.direction.z * travel };
        const wall = straightFraction(projectile.position, delta, HERO.q.radius);
        const hit = isValidTarget(health.hero, target) ? targetFraction(projectile.position, delta, target.position, TARGET.radius + HERO.q.radius) : Infinity;
        // A wall wins exact ties, so Q never damages through an obstacle.
        if (hit < wall) { health.damage(health.hero, target, HERO.q.damage); return false; }
        if (wall < 1) return false;
        if (hit === 1) { health.damage(health.hero, target, HERO.q.damage); return false; }
        projectile.position.x += delta.x; projectile.position.z += delta.z;
        projectile.remaining -= travel;
        return projectile.remaining > 1e-12;
      });
      if (pending) {
        if (health.hero.health <= 0) pending = undefined;
        else {
          pending.remaining -= STEP;
          if (pending.remaining <= 1e-12) { release(pending); pending = undefined; }
        }
      }
    },
  };
}
