import { HERO, TARGET } from './config.ts';
import type { Point } from './movement.ts';

export type Combatant = {
  id: string; team: 'blue' | 'coral'; position: Point;
  health: number; maxHealth: number; generation: number; respawnIn: number;
};
export function isValidTarget(source: Combatant, target: Combatant): boolean {
  return source.health > 0 && target.health > 0 && source.id !== target.id && source.team !== target.team;
}

/** Health belongs to simulation time; rendering never owns damage or respawn. */
export function createHealth() {
  const hero: Combatant = { id: 'hero', team: 'blue', position: { ...HERO.spawn },
    health: HERO.health, maxHealth: HERO.health, generation: 0, respawnIn: 0 };
  const dummy: Combatant = { id: 'dummy', team: 'coral', position: { ...TARGET.spawn },
    health: TARGET.health, maxHealth: TARGET.health, generation: 0, respawnIn: 0 };
  let lastHit: { targetId: string; damage: number } | undefined;
  return {
    hero, dummy,
    lastHit: () => lastHit,
    damage(source: Combatant, target: Combatant, amount: number): number {
      if (!isValidTarget(source, target) || !Number.isFinite(amount) || amount <= 0) return 0;
      const dealt = Math.min(target.health, amount);
      target.health -= dealt;
      lastHit = { targetId: target.id, damage: dealt };
      if (target === dummy && target.health === 0) target.respawnIn = TARGET.respawnDelay;
      return dealt;
    },
    tick(seconds: number) {
      if (!Number.isFinite(seconds) || seconds <= 0 || dummy.health > 0) return;
      dummy.respawnIn = Math.max(0, dummy.respawnIn - seconds);
      if (dummy.respawnIn <= 1e-12) {
        dummy.health = dummy.maxHealth;
        dummy.position = { ...TARGET.spawn };
        dummy.respawnIn = 0;
        dummy.generation++;
      }
    },
  };
}
