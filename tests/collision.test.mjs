import test from 'node:test';
import assert from 'node:assert/strict';
import { moveWithCollisions, canStand } from '../src/simulation/collision.ts';
import { createMovement } from '../src/simulation/movement.ts';
import { HERO, SOLID_OBJECTS, MAP } from '../src/simulation/config.ts';
import { direction } from '../src/input/keyboard.ts';

test('every tower blocks swept movement even with both endpoints outside', () => {
  for (const object of SOLID_OBJECTS) {
    const p = moveWithCollisions({ x: -4, z: object.z }, { x: 10, z: 0 });
    assert.ok(canStand(p));
    assert.ok(Math.abs(p.x - (object.x - object.radius - HERO.radius)) < 1e-5);
    assert.equal(canStand(object), false);
  }
});

test('removed central obstacle leaves the middle freely traversable', () => {
  assert.deepEqual(moveWithCollisions({ x: -4, z: 0 }, { x: 10, z: 0 }), { x: 6, z: 0 });
});

test('all four bridge edges/base ends contain the entire hero', () => {
  for (const d of [{ x: 100, z: 0 }, { x: -100, z: 0 }, { x: 0, z: 100 }, { x: 0, z: -100 }]) {
    const p = moveWithCollisions({ x: 0, z: -4 }, d);
    assert.ok(canStand(p), JSON.stringify(p));
    if (d.x) assert.ok(Math.abs(p.x) <= MAP.bridge.width / 2 - HERO.radius);
    else assert.ok(Math.abs(p.z) <= 27 + MAP.baseRadius - HERO.radius);
  }
});

test('bridge/base overlap remains traversable in both directions', () => {
  for (const sign of [-1, 1]) {
    const end = moveWithCollisions({ x: 0, z: sign * 23 }, { x: 0, z: sign * 8 });
    assert.ok(Math.abs(end.z - sign * 31) < 1e-8);
    const back = moveWithCollisions(end, { x: 0, z: -sign * 8 });
    assert.ok(Math.abs(back.z - sign * 23) < 1e-8);
  }
});

test('diagonal contact slides along wall and tower; moving away releases contact', () => {
  const wall = moveWithCollisions({ x: 6.5, z: -5 }, { x: 1, z: 1 });
  assert.ok(canStand(wall)); assert.ok(wall.z > -4.01);
  const tower = moveWithCollisions({ x: -2, z: -12 }, { x: 2, z: 1 });
  assert.ok(canStand(tower)); assert.ok(tower.x > -1.9 && tower.z < -11.65);
  const away = moveWithCollisions(wall, { x: -1, z: 0 });
  assert.ok(away.x < wall.x - 0.99);
});

test('long frame stalls cannot leave arena and rendered positions stay valid', () => {
  const sim = createMovement();
  for (let i = 0; i < 100; i++) {
    sim.advance(30, { x: 1, z: 0 });
    assert.ok(canStand(sim.position())); assert.ok(canStand(sim.interpolated()));
  }
});

test('collision result is FPS-independent and interpolation never cuts through towers', () => {
  const results = [];
  for (const fps of [30, 60, 144]) {
    const sim = createMovement();
    for (let i = 0; i < fps * 3; i++) {
      sim.advance(1 / fps, direction(new Set(['KeyD'])));
      assert.ok(canStand(sim.position())); assert.ok(canStand(sim.interpolated()));
    }
    results.push(sim.position());
  }
  for (const p of results) assert.ok(Math.hypot(p.x - results[0].x, p.z - results[0].z) < 1e-8);
});

test('valid endpoints do not permit crossing the gap outside the narrow bridge', () => {
  const start = { x: 7.4, z: -27 };
  assert.ok(canStand(start)); assert.ok(canStand({ x: 7.4, z: 27 }));
  const end = moveWithCollisions(start, { x: 0, z: 54 });
  assert.ok(canStand(end)); assert.ok(end.z < -20);
});

test('deterministic exploration stays valid near curved rims and contacts', () => {
  let seed = 7;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const start of [HERO.spawn, { x: 7.5, z: 27 }, { x: -7.5, z: -27 }, { x: 0, z: 0 }]) {
    let p = { ...start };
    for (let i = 0; i < 3000; i++) {
      p = moveWithCollisions(p, { x: (random() - 0.5) * 8, z: (random() - 0.5) * 8 });
      assert.ok(canStand(p), JSON.stringify(p));
    }
  }
});
