import { HERO, MAP, TOWER_RADIUS } from './config.ts';
import { createCombat, nearestTarget } from './combat.ts';
import { moveWithCollisions } from './collision.ts';
import { STEP, type Point } from './movement.ts';
import type { Combatant } from './health.ts';
import type { Aim } from '../input/touch.ts';
import { createLaneNavigation } from './laneNavigation.ts';

export const LANE = {
  spawn: { x: -2.8, z: -25 }, respawn: 8, waveInterval: 15, maxMinionsPerTeam: 30,
  minion: { health: 240, damage: 18, range: 2.8, interval: 1, speed: 2.4, radius: 0.32, aggro: 7 },
  tower: { health: 1200, damage: 140, range: 7, interval: 1 }, baseHealth: 1800,
} as const;
export type LaneActor = Combatant & { kind: 'minion' | 'tower' | 'base'; radius: number; cooldown: number; targetId?: string };
export type MatchResult = 'blue' | 'coral' | 'draw';
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Local army opponent. All clocks, target ordering and waves use fixed ticks. */
export function createLaneMatch() {
  const waypoint = createLaneNavigation(LANE.minion.radius);
  let actors: LaneActor[] = [], elapsed = 0, waveIn = 0, wave = 0, nextId = 0;
  let result: MatchResult | undefined, dead = false;
  const vulnerable = (actor: LaneActor) => {
    if (actor.kind === 'minion') return true;
    return !actors.some(other => other.team === actor.team && other.kind === 'tower' && other.health > 0
      && (actor.kind === 'base' || Math.abs(other.position.z) < Math.abs(actor.position.z)));
  };
  const candidates = () => actors.filter(actor => actor.health > 0 && vulnerable(actor));
  const combat = createCombat({ targets: candidates });
  const hero = combat.hero;
  const create = (id: string, team: Combatant['team'], kind: LaneActor['kind'], position: Point, health: number, radius: number): LaneActor =>
    ({ id, team, kind, position: { ...position }, health, maxHealth: health, radius, generation: 0, respawnIn: 0, cooldown: 0 });
  const reset = () => {
    combat.reset(); combat.setCooldownsEnabled(true);
    hero.position = { ...LANE.spawn }; hero.radius = HERO.radius;
    elapsed = 0; waveIn = 0; wave = 0; nextId = 0; result = undefined; dead = false;
    actors = MAP.towers.map((tower, i) => create(`tower-${i}`, tower.team, 'tower', tower, LANE.tower.health, TOWER_RADIUS));
    actors.push(...MAP.bases.map((base, i) => create(`base-${i}`, base.team, 'base',
      { x: base.x, z: base.z + Math.sign(base.z) * 1.8 }, LANE.baseHealth, 1.8)));
  };
  const spawnWave = () => {
    wave++;
    for (const team of ['blue', 'coral'] as const) {
      const count = actors.filter(a => a.kind === 'minion' && a.team === team && a.health > 0).length;
      for (let i = 0; i < Math.min(3, LANE.maxMinionsPerTeam - count); i++) {
        // Offset lane avoids every solid tower footprint, including destroyed ruins.
        actors.push(create(`minion-${nextId++}`, team, 'minion',
          { x: -2.8, z: (team === 'blue' ? -1 : 1) * (24 + i * 0.9) }, LANE.minion.health, LANE.minion.radius));
      }
    }
  };
  const ai = (actor: LaneActor) => {
    if (actor.kind === 'base' || actor.health <= 0) return;
    actor.cooldown = Math.max(0, actor.cooldown - STEP);
    const targets: Combatant[] = [...candidates(), hero].filter(t => t.team !== actor.team && t.health > 0);
    const stats = actor.kind === 'tower' ? LANE.tower : LANE.minion;
    // Towers prefer minions on every shot; an unescorted hero is exposed.
    const units = targets.filter(t => !('kind' in t) || t.kind === 'minion');
    let target: Combatant | undefined;
    if (actor.kind === 'tower') {
      target = nearestTarget(actor, units.filter(t => 'kind' in t), stats.range)
        ?? nearestTarget(actor, units, stats.range);
    } else {
      target = nearestTarget(actor, units, LANE.minion.aggro)
        ?? nearestTarget(actor, targets.filter(t => 'kind' in t && t.kind !== 'minion'), Infinity);
    }
    actor.targetId = target?.id;
    if (!target) return;
    if (distance(actor.position, target.position) <= stats.range) {
      if (actor.cooldown <= 1e-12) {
        combat.damage(actor, target, stats.damage);
        actor.cooldown = stats.interval;
      }
      return;
    }
    if (actor.kind !== 'minion') return;
    // Stay on a clear lane until close to a unit. Buildings can be attacked from
    // the lane, avoiding a path into the solid circular foundation.
    let goal = { x: -2.8, z: target.position.z };
    const nearbyUnit = !('kind' in target) || target.kind === 'minion';
    if (nearbyUnit && distance(actor.position, target.position) < LANE.minion.aggro) {
      goal.x = target.position.x;
    }
    goal = waypoint(actor.position, goal);
    const length = distance(actor.position, goal);
    if (length < 1e-9) return;
    const scale = Math.min(length, LANE.minion.speed * STEP) / length;
    actor.position = moveWithCollisions(actor.position,
      { x: (goal.x - actor.position.x) * scale, z: (goal.z - actor.position.z) * scale }, actor.radius);
  };
  reset();
  return {
    combat, hero, actors: () => actors as readonly LaneActor[], vulnerable,
    elapsed: () => elapsed, wave: () => wave, waveIn: () => waveIn, result: () => result,
    target: (range: number) => nearestTarget(hero, candidates(), range),
    reset,
    cast(position: Point, aim: Aim) {
      if (result) return 'invalid' as const;
      return combat.cast(position, aim);
    },
    move(position: Point, input: Point) {
      return result ? { ...position } : combat.move(position, input);
    },
    tick(position: Point) {
      if (result) return;
      let relocation: Point | undefined;
      elapsed += STEP;
      combat.tick(position);
      if (dead) {
        hero.respawnIn = Math.max(0, hero.respawnIn - STEP);
        if (hero.respawnIn <= 1e-12) {
          hero.health = hero.maxHealth; hero.generation++; hero.position = { ...LANE.spawn };
          hero.respawnIn = 0; dead = false; relocation = { ...LANE.spawn };
        }
      }
      waveIn -= STEP;
      if (waveIn <= 1e-12) { spawnWave(); waveIn = LANE.waveInterval; }
      // Alternate team order each tick to avoid a permanent blue first-hit advantage.
      const order = Math.round(elapsed / STEP) % 2 ? actors : [...actors].reverse();
      for (const actor of order) ai(actor);
      if (hero.health <= 0 && !dead) {
        dead = true; hero.respawnIn = LANE.respawn; combat.clearEffects();
      }
      actors = actors.filter(actor => actor.kind !== 'minion' || actor.health > 0);
      const blue = actors.find(a => a.id === 'base-0')!, coral = actors.find(a => a.id === 'base-1')!;
      if (blue.health <= 0 || coral.health <= 0) {
        result = blue.health <= 0 ? (coral.health <= 0 ? 'draw' : 'coral') : 'blue';
        combat.clearEffects();
      }
      return relocation;
    },
  };
}
