import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/simulation/combat.ts';
import { createMovement, STEP } from '../src/simulation/movement.ts';
import { HERO, TARGET, SOLID_OBJECTS } from '../src/simulation/config.ts';
import { canStand } from '../src/simulation/collision.ts';
import { setupKeyboard } from '../src/input/keyboard.ts';
import { createAimMarker } from '../src/game/aimMarker.ts';
import { createCombatView } from '../src/game/combatView.ts';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore.js';

const aim = (action, x = 0, z = 1, distance = 6) => ({ action, direction: { x, z }, distance, canceled: false });
const ticks = (combat, n, position = { x: -2, z: 0 }) => { for (let i = 0; i < n; i++) combat.tick(position); };
const fixture = () => { const c = createCombat(); c.dummy.position = { x: -2, z: 6 }; return c; };

test('Q flies straight, deals 120 once, and expires at range on a miss', () => {
  const c = fixture(); assert.equal(c.cast({ x: -2, z: 0 }, aim('q')), 'fired');
  ticks(c, 8); assert.equal(c.projectiles().length, 0);
  ticks(c, 1); assert.equal(c.projectiles().length, 1); assert.equal(c.dummy.health, 2000);
  ticks(c, 27); assert.equal(c.dummy.health, 1880); assert.equal(c.projectiles().length, 0);
  ticks(c, 240); assert.equal(c.dummy.health, 1880);
  c.cast({ x: -2, z: 0 }, aim('q', -1, 0)); ticks(c, 100);
  assert.equal(c.projectiles().length, 0); assert.equal(c.dummy.health, 1880);
});

test('Q crosses solid towers, hits enemies behind them and stops only at range on a miss', () => {
  for (const object of SOLID_OBJECTS) {
    const c = createCombat(), position = { x: object.x, z: object.z - 3 };
    c.dummy.position = { x: object.x, z: object.z + 3 };
    c.cast(position, aim('q')); ticks(c, 80, position);
    assert.equal(c.dummy.health, TARGET.health - HERO.q.damage);
    assert.equal(c.projectiles().length, 0);
  }
  const c = createCombat(), edge = { x: -6, z: 5 };
  c.cast(edge, aim('q', -1, 0)); ticks(c, 30, edge);
  assert.equal(c.projectiles().length, 1); // Arena scenery cannot consume Q.
  ticks(c, 30, edge); assert.equal(c.projectiles().length, 0);
});

test('E can be placed through a tower and damages an enemy beyond it', () => {
  const c = createCombat(), position = { x: 0, z: 8 };
  c.dummy.position = { x: 0, z: 14 };
  c.cast(position, aim('e')); ticks(c, 39, position);
  assert.equal(c.dummy.health, TARGET.health - HERO.e.damage);
});

test('Q cannot home toward a target moved out of its line', () => {
  const c = fixture(); c.cast({ x: -2, z: 0 }, aim('q')); ticks(c, 12);
  c.dummy.position.x = 1; ticks(c, 100);
  assert.equal(c.dummy.health, TARGET.health);
});

test('E clamps placement, warns for exactly 0.5 seconds after cast and hits once', () => {
  const c = fixture(); c.cast({ x: -2, z: 0 }, aim('e', 0, 1, 100));
  ticks(c, 9); assert.deepEqual(c.areas()[0].position, { x: -2, z: 6 });
  ticks(c, 29); assert.equal(c.dummy.health, 2000); assert.equal(c.areas().length, 1);
  ticks(c, 1); assert.equal(c.dummy.health, 1900); assert.equal(c.areas().length, 0);
  ticks(c, 200); assert.equal(c.dummy.health, 1900);
});

test('E checks living targets at detonation, supports leaving/entering and overlapping hitboxes', () => {
  const c = fixture(); c.cast({ x: -2, z: 0 }, aim('e')); ticks(c, 9);
  c.dummy.position.x = 1; ticks(c, 30); assert.equal(c.dummy.health, 2000);
  ticks(c, 420); c.cast({ x: -2, z: 0 }, aim('e')); ticks(c, 38);
  c.dummy.position = { x: -2 + HERO.e.radius + TARGET.radius - 0.001, z: 6 };
  ticks(c, 1); assert.equal(c.dummy.health, 1900);
});

test('every valid cast blocks walking then resumes held movement; dash replaces walking', () => {
  for (const action of ['attack', 'q', 'e']) {
    const c = createCombat(), m = createMovement();
    c.dummy.position = { x: HERO.spawn.x, z: HERO.spawn.z + 2 };
    c.cast(m.position(), aim(action));
    const duration = HERO[action].castTime;
    m.advance(duration, { x: 1, z: 0 }, c.tick, c.move);
    assert.deepEqual(m.position(), HERO.spawn, action);
    m.advance(STEP, { x: 1, z: 0 }, c.tick, c.move);
    assert.ok(m.position().x > HERO.spawn.x, action);
  }
});

test('R travels exactly 3 in 0.2 seconds, blocks all other actions and never deals damage', () => {
  const c = createCombat(), m = createMovement();
  assert.equal(c.cast(m.position(), aim('r', -1, 0)), 'fired');
  assert.equal(c.cast(m.position(), aim('q')), 'casting'); assert.equal(c.cooldown('q'), 0);
  m.advance(0.2, { x: 0, z: 1 }, c.tick, c.move);
  assert.ok(Math.abs(m.position().x - (HERO.spawn.x - 3)) < 1e-9);
  assert.equal(m.position().z, HERO.spawn.z); assert.equal(c.casting(), undefined);
  assert.equal(c.dummy.health, TARGET.health); assert.ok(Math.abs(c.cooldown('r') - 5.8) < 1e-9);
});

test('R stops at towers and every map boundary without sliding or penetration', () => {
  for (const [position, direction] of [
    [{ x: 0, z: 8 }, { x: 0, z: 1 }], [{ x: -6, z: 6 }, { x: -1, z: 0 }],
    [{ x: 6, z: 6 }, { x: 1, z: 0 }], [{ x: 0, z: 34 }, { x: 0, z: 1 }],
    [{ x: 0, z: -34 }, { x: 0, z: -1 }],
  ]) {
    const c = createCombat(); c.cast(position, aim('r', direction.x, direction.z));
    let p = position;
    for (let i = 0; i < 12; i++) { p = c.move(p, { x: 1, z: 1 }); c.tick(p); assert.ok(canStand(p)); }
    assert.ok(Math.hypot(p.x - position.x, p.z - position.z) < 3);
    if (direction.x === 0) assert.equal(p.x, position.x);
    if (direction.z === 0) assert.equal(p.z, position.z);
  }
});

test('cancel/invalid/dead/busy actions never start an unrelated cooldown', () => {
  const c = fixture(), p = { x: -2, z: 0 };
  for (const a of [{ ...aim('q'), canceled: true }, aim('q', NaN, 1), aim('e', 0, 0), aim('r', 1, 0, -1)]) {
    assert.equal(c.cast(p, a), 'invalid');
    assert.equal(c.cooldown(a.action), 0); assert.equal(c.casting(), undefined);
  }
  c.cast(p, aim('q')); assert.equal(c.cast(p, aim('e')), 'casting'); assert.equal(c.cooldown('e'), 0);
  ticks(c, 9); assert.equal(c.cast(p, aim('q')), 'cooldown');
  c.hero.health = 0; assert.equal(c.cast(p, aim('e')), 'dead'); assert.equal(c.cooldown('e'), 0);
});

test('ability damage/cooldowns/dash agree at 30/60/144 FPS and pause does not consume time', () => {
  const results = [];
  for (const fps of [30, 60, 144]) {
    const c = createCombat(), m = createMovement(); c.cast(m.position(), aim('r', -1, 0));
    for (let i = 0; i < fps; i++) m.advance(1 / fps, { x: 0, z: 0 }, c.tick, c.move);
    results.push({ position: m.position(), cooldown: c.cooldown('r') });
    const before = c.cooldown('r'); m.suspend(); m.advance(STEP / 2, { x: 0, z: 0 }, c.tick, c.move);
    assert.equal(c.cooldown('r'), before);
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]);
  for (const action of ['q', 'e']) {
    const states = [];
    for (const fps of [30, 60, 144]) {
      const c = createCombat(), m = createMovement();
      c.dummy.position = { x: HERO.spawn.x, z: HERO.spawn.z + 3 };
      c.cast(m.position(), aim(action, 0, 1, 3));
      for (let i = 0; i < fps; i++) m.advance(1 / fps, { x: 0, z: 0 }, c.tick, c.move);
      states.push({ health: c.dummy.health, cooldown: c.cooldown(action) });
    }
    assert.equal(states[0].health, TARGET.health - HERO[action].damage);
    assert.deepEqual(states[0], states[1]); assert.deepEqual(states[1], states[2]);
  }
});

test('keyboard owns one held ability and interruptions cancel preview without a stale release cast', () => {
  const host = new EventTarget(), page = new EventTarget(), casts = [];
  const input = setupKeyboard(() => {}, host, page, action => casts.push(action));
  const emit = (type, code) => { const event = new Event(type, { cancelable: true }); Object.assign(event, { code }); host.dispatchEvent(event); };
  try {
    assert.equal(typeof ShaderStore.ShadersStore.colorVertexShader, 'string');
    assert.equal(typeof ShaderStore.ShadersStore.colorPixelShader, 'string');
    emit('keydown', 'KeyQ'); emit('keydown', 'KeyE'); assert.equal(input.held(), 'q');
    emit('keyup', 'KeyE'); assert.deepEqual(casts, []); emit('keyup', 'KeyQ'); assert.deepEqual(casts, ['q']);
    for (const interruption of ['blur', 'resize', 'orientationchange', 'visibilitychange', 'focusin', 'Escape']) {
      emit('keydown', 'KeyR');
      if (interruption === 'Escape') emit('keydown', 'Escape');
      else (['visibilitychange', 'focusin'].includes(interruption) ? page : host).dispatchEvent(new Event(interruption));
      assert.equal(input.held(), undefined); emit('keyup', 'KeyR'); assert.deepEqual(casts, ['q']);
    }
  } finally { input.dispose(); }
});

test('range ring follows hero, uses exact action radius and vanishes immediately on release', () => {
  const engine = new NullEngine(), scene = new Scene(engine), marker = createAimMarker(scene);
  try {
    for (const [action, radius] of [['attack', 5], ['q', 9], ['e', 6], ['r', 3]]) {
      marker.update({ x: 2, z: 4 }, aim(action));
      const ring = scene.getMeshByName('ability-range'); assert.equal(ring.isEnabled(), true);
      const positions = ring.getVerticesData('position');
      assert.ok(Math.abs(positions[0] - (2 + radius)) < 1e-6); assert.equal(positions[2], 4);
      marker.update({ x: 2, z: 4 }); assert.equal(ring.isEnabled(), false);
    }
    marker.dispose(); assert.equal(scene.meshes.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});

test('E warning visualization is removed after detonation and disposed cleanly', () => {
  const engine = new NullEngine(), scene = new Scene(engine), view = createCombatView(scene);
  try {
    view.update([], [{ id: 1, position: { x: -2, z: 6 }, remaining: 0.5 }]);
    assert.equal(scene.meshes.length, 1); assert.equal(scene.meshes[0].position.z, 6);
    view.update([], []); assert.equal(scene.meshes.length, 0);
    view.update([], [{ id: 2, position: { x: 0, z: 0 }, remaining: 0.2 }]);
    view.dispose(); assert.equal(scene.meshes.length, 0);
  } finally { scene.dispose(); engine.dispose(); }
});
