import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealth, isValidTarget } from '../src/simulation/health.ts';
import { HERO, TARGET } from '../src/simulation/config.ts';
import { STEP } from '../src/simulation/movement.ts';

test('health starts from config; only living enemies can deal/receive damage', () => {
  const h = createHealth();
  assert.equal(h.hero.health, HERO.health); assert.equal(h.dummy.health, TARGET.health);
  assert.equal(isValidTarget(h.hero, h.dummy), true);
  assert.equal(h.damage(h.hero, h.hero, 50), 0);
  assert.equal(h.damage(h.hero, { ...h.dummy, team: 'blue' }, 50), 0);
  for (const amount of [NaN, Infinity, -1, 0]) assert.equal(h.damage(h.hero, h.dummy, amount), 0);
  assert.equal(h.damage(h.hero, h.dummy, 60), 60);
  assert.equal(h.dummy.health, 1940);
  assert.deepEqual(h.lastHit(), { targetId: 'dummy', damage: 60 });
  h.hero.health = 0;
  assert.equal(h.damage(h.hero, h.dummy, 60), 0);
});

test('lethal damage clamps at zero; dead hits cannot restart the exact two-second respawn', () => {
  const h = createHealth();
  assert.equal(h.damage(h.hero, h.dummy, 9999), TARGET.health);
  assert.equal(h.dummy.health, 0);
  for (let i = 0; i < 119; i++) h.tick(STEP);
  assert.equal(h.dummy.health, 0);
  assert.equal(h.damage(h.hero, h.dummy, 60), 0);
  h.tick(STEP);
  assert.equal(h.dummy.health, TARGET.health); assert.equal(h.dummy.generation, 1);
  assert.deepEqual(h.dummy.position, TARGET.spawn);
  assert.equal(h.damage(h.hero, h.dummy, 60), 60);
});

test('invalid elapsed time cannot resurrect a target; hero has no automatic respawn yet', () => {
  const h = createHealth(); h.damage(h.hero, h.dummy, TARGET.health);
  for (const seconds of [NaN, Infinity, -1, 0]) h.tick(seconds);
  assert.equal(h.dummy.respawnIn, 2);
  h.hero.health = 0; h.tick(2);
  assert.equal(h.hero.health, 0); assert.equal(h.dummy.health, TARGET.health);
});
