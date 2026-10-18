import { HERO } from './config.ts';
import { createHealth, isValidTarget, type Combatant } from './health.ts';
import { STEP, type Point } from './movement.ts';

export type Projectile = { id: number; position: Point; targetId: string; generation: number };
export type AttackResult = 'fired' | 'cooldown' | 'no-target' | 'dead';

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

/** Driven by the movement clock: no separate wall-clock cooldowns or catch-up. */
export function createCombat() {
  const health = createHealth();
  let projectiles: Projectile[] = [], nextId = 0, attackCooldown = 0;
  return {
    ...health,
    projectiles: () => projectiles as readonly Projectile[],
    cooldown: () => attackCooldown,
    attack(position: Point): AttackResult {
      health.hero.position = { ...position };
      if (health.hero.health <= 0) return 'dead';
      if (attackCooldown > 1e-12) return 'cooldown';
      const target = nearestTarget(health.hero, [health.dummy], HERO.attack.range);
      if (!target) return 'no-target';
      projectiles.push({ id: nextId++, position: { ...position }, targetId: target.id, generation: target.generation });
      attackCooldown = HERO.attack.interval;
      return 'fired';
    },
    tick(position: Point) {
      health.hero.position = { ...position };
      health.tick(STEP);
      attackCooldown = Math.max(0, attackCooldown - STEP);
      projectiles = projectiles.filter(projectile => {
        const target = health.dummy;
        // A projectile cannot hit a later incarnation of the same target.
        if (target.health <= 0 || target.id !== projectile.targetId || target.generation !== projectile.generation) return false;
        const dx = target.position.x - projectile.position.x, dz = target.position.z - projectile.position.z;
        const distance = Math.hypot(dx, dz), travel = HERO.attack.projectileSpeed * STEP;
        if (distance <= travel + 1e-12) {
          health.damage(health.hero, target, HERO.attack.damage);
          return false;
        }
        projectile.position.x += dx / distance * travel;
        projectile.position.z += dz / distance * travel;
        return true;
      });
    },
  };
}
