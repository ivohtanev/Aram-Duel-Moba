import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP, HERO, TARGET, isOnMap } from '../src/simulation/config.ts';

test('spawns and landmarks fit on the playable surface', () => {
  for (const point of [HERO.spawn, TARGET.spawn, ...MAP.towers, ...MAP.relics]) {
    assert.ok(isOnMap(point.x, point.z, HERO.radius), JSON.stringify(point));
  }
});

test('the lane connects both spawn courts without a gap', () => {
  for (let z = -27; z <= 27; z += 0.25) {
    for (const x of [-4, 0, 4]) assert.ok(isOnMap(x, z, HERO.radius), `${x},${z}`);
  }
});

test('the footprint rejects the ravine and reserves space for a character radius', () => {
  assert.equal(isOnMap(7, 0), true);
  assert.equal(isOnMap(7, 0, HERO.radius), false);
  assert.equal(isOnMap(7.01, 0), false);
  assert.equal(isOnMap(0, 35), true);
  assert.equal(isOnMap(0, 35, HERO.radius), false);
  assert.equal(isOnMap(0, 35.01), false);
  assert.equal(isOnMap(9, 27), false);
  assert.equal(isOnMap(NaN, 0), false);
  assert.equal(isOnMap(0, Infinity), false);
  assert.equal(isOnMap(0, 0, -1), false);
});

test('both sides have mirrored tower and base positions', () => {
  for (const points of [MAP.towers, MAP.bases]) {
    for (const point of points) assert.ok(points.some(other => other.x === -point.x && other.z === -point.z && other.team !== point.team));
  }
});
