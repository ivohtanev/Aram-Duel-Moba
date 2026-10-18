import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, nearestTarget } from '../src/simulation/combat.ts';
import { createMovement, STEP } from '../src/simulation/movement.ts';
import { HERO, TARGET } from '../src/simulation/config.ts';
import { setupKeyboard } from '../src/input/keyboard.ts';
import { quickAim } from '../src/input/touch.ts';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createCombatView } from '../src/game/combatView.ts';

const origin = { x: TARGET.spawn.x, z: TARGET.spawn.z - 5 };
const tick = (combat, count) => { for (let i = 0; i < count; i++) combat.tick(origin); };

test('nearest living enemy is selected within inclusive range; ties are stable', () => {
  const c = createCombat(); c.hero.position = { x: 0, z: 0 };
  const target = (id, x, extra = {}) => ({ ...c.dummy, id, position: { x, z: 0 }, ...extra });
  const far = target('far', 5), near = target('near', 2), tie = target('tie', -2);
  assert.equal(nearestTarget(c.hero, [far, near, tie, target('dead', 1, { health: 0 }), target('ally', 0, { team: 'blue' })], 5), near);
  assert.equal(nearestTarget(c.hero, [far], 5), far);
  assert.equal(nearestTarget(c.hero, [far], 4.999), undefined);
});

test('attack requires range, starts interval only on success, hits once after travel', () => {
  const c = createCombat();
  assert.equal(c.attack(HERO.spawn), 'no-target'); assert.equal(c.cooldown(), 0);
  assert.equal(c.attack(origin), 'fired'); assert.equal(c.dummy.health, TARGET.health);
  assert.equal(c.attack(origin), 'cooldown'); assert.equal(c.projectiles().length, 1);
  tick(c, 24); assert.equal(c.dummy.health, TARGET.health);
  tick(c, 1); assert.equal(c.dummy.health, TARGET.health - 60); assert.equal(c.projectiles().length, 0);
  tick(c, 22); assert.equal(c.attack(origin), 'cooldown');
  tick(c, 1); assert.equal(c.attack(origin), 'fired');
  tick(c, 100); assert.equal(c.dummy.health, TARGET.health - 120);
});

test('homing follows a moved target outside starting range; death invalidates in-flight projectiles', () => {
  const c = createCombat(); c.attack(origin);
  c.dummy.position = { x: 4, z: 9 };
  tick(c, 60); assert.equal(c.dummy.health, TARGET.health - 60);
  c.dummy.position = { ...TARGET.spawn };
  c.attack(origin); c.damage(c.hero, c.dummy, TARGET.health);
  tick(c, 1); assert.equal(c.projectiles().length, 0);
  tick(c, 119); assert.equal(c.dummy.health, TARGET.health);
  tick(c, 60); assert.equal(c.dummy.health, TARGET.health);
});

test('old target incarnation cannot receive an old projectile; dead attackers cannot fire', () => {
  const c = createCombat(); c.attack(origin);
  c.damage(c.hero, c.dummy, TARGET.health); c.dummy.respawnIn = STEP;
  tick(c, 1); assert.equal(c.projectiles().length, 0); assert.equal(c.dummy.health, TARGET.health);
  c.hero.health = 0; assert.equal(c.attack(origin), 'dead');
  assert.deepEqual(quickAim('q', origin, { x: 1, z: 0 }, null).direction, { x: 1, z: 0 });
});

test('combat shares fixed movement ticks at 30/60/144 FPS and clamps long frames', () => {
  for (const fps of [30, 60, 144]) {
    const c = createCombat(), m = createMovement(); c.attack(origin);
    for (let i = 0; i < fps; i++) m.advance(1 / fps, { x: 0, z: 0 }, p => c.tick(p));
    assert.equal(c.dummy.health, TARGET.health - 60); assert.equal(c.cooldown(), 0);
  }
  const c = createCombat(), m = createMovement(); c.attack(origin);
  m.advance(30, { x: 0, z: 0 }, p => c.tick(p));
  assert.ok(Math.abs(c.cooldown() - 0.55) < 1e-9);
  const before = JSON.stringify(c.projectiles()); m.suspend();
  m.advance(STEP / 2, { x: 0, z: 0 }, p => c.tick(p));
  assert.equal(JSON.stringify(c.projectiles()), before);
});

test('Space fires once per press, ignores repeats/editable shortcuts, and disposes', () => {
  const host = new EventTarget(), page = new EventTarget(); let attacks = 0;
  const input = setupKeyboard(() => {}, host, page, () => attacks++);
  const down = (props = {}) => {
    const e = new Event('keydown', { cancelable: true });
    for (const [key, value] of Object.entries({ code: 'Space', ...props })) Object.defineProperty(e, key, { value });
    host.dispatchEvent(e); return e;
  };
  assert.equal(down().defaultPrevented, true); down({ repeat: true });
  down({ ctrlKey: true }); down({ target: { closest: () => ({}) } }); assert.equal(attacks, 1);
  down(); assert.equal(attacks, 2); input.dispose(); down(); assert.equal(attacks, 2);
});

test('projectile meshes update, disappear on impact, and release resources on dispose', () => {
  const engine = new NullEngine(), scene = new Scene(engine), view = createCombatView(scene);
  try {
    view.update([{ id: 1, position: { x: 2, z: 3 }, targetId: 'dummy', generation: 0 }]);
    assert.equal(scene.meshes.length, 1); assert.equal(scene.meshes[0].position.z, 3);
    view.update([]); assert.equal(scene.meshes.length, 0);
    view.update([{ id: 2, position: origin, targetId: 'dummy', generation: 0 }]);
    view.dispose(); assert.equal(scene.meshes.length, 0);
    assert.equal(scene.getMaterialByName('attack-light'), null);
  } finally { scene.dispose(); engine.dispose(); }
});
