import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/simulation/combat.ts';
import { createMovement, STEP } from '../src/simulation/movement.ts';
import { HERO, TARGET } from '../src/simulation/config.ts';
import { setupFullscreen } from '../src/ui/fullscreen.ts';
import { setupVisibility } from '../src/ui/visibility.ts';
import { createDebugView } from '../src/game/debugView.ts';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';

const position = { x: -2, z: 0 };
const aim = action => ({ action, direction: { x: 0, z: 1 }, distance: 4, canceled: false });
const ticks = (c, n) => { for (let i = 0; i < n; i++) c.tick(position); };

test('reset during pending cast, dash, projectile, area or death clears every combat timer and effect', () => {
  for (const state of ['pending', 'dash', 'projectile', 'area', 'death']) {
    const c = createCombat();
    c.dummy.position = { x: -2, z: 4 };
    c.damage(c.hero, c.dummy, state === 'death' ? TARGET.health : 60);
    c.hero.health = 500;
    c.cast(position, aim(state === 'dash' ? 'r' : state === 'area' ? 'e' : 'q'));
    if (state === 'projectile' || state === 'area') ticks(c, 9);
    const generation = c.dummy.generation;
    c.reset();
    assert.equal(c.hero.health, HERO.health); assert.equal(c.dummy.health, TARGET.health);
    assert.deepEqual(c.hero.position, HERO.spawn); assert.deepEqual(c.dummy.position, TARGET.spawn);
    assert.equal(c.dummy.respawnIn, 0); assert.ok(c.dummy.generation > generation);
    assert.equal(c.lastHit(), undefined); assert.equal(c.casting(), undefined);
    assert.deepEqual(c.projectiles(), []); assert.deepEqual(c.areas(), []);
    for (const a of ['attack', 'q', 'e', 'r']) assert.equal(c.cooldown(a), 0);
    ticks(c, 180); assert.equal(c.dummy.health, TARGET.health);
    assert.equal(c.cast(position, aim('q')), 'fired');
  }
});

test('movement reset discards position and interpolation remainder', () => {
  const m = createMovement(); m.advance(0.2 + STEP / 2, { x: 0, z: 1 }); m.reset();
  assert.deepEqual(m.position(), HERO.spawn); assert.deepEqual(m.interpolated(), HERO.spawn);
  let steps = 0; m.advance(STEP / 2, { x: 0, z: 1 }, () => steps++);
  assert.equal(steps, 0);
});

test('cooldowns switch clears existing timers and retains cast locks, damage and reset preference', () => {
  const c = createCombat(); c.cast(position, aim('q')); assert.ok(c.cooldown('q') > 0);
  c.setCooldownsEnabled(false); assert.equal(c.cooldown('q'), 0);
  assert.equal(c.cast(position, aim('q')), 'casting');
  ticks(c, 9); assert.equal(c.cast(position, aim('q')), 'fired');
  for (const a of ['attack', 'q', 'e', 'r']) {
    c.reset(); c.dummy.position = { x: -2, z: 4 };
    assert.equal(c.cast(position, aim(a)), 'fired'); assert.equal(c.cooldown(a), 0);
    ticks(c, 90);
    assert.equal(c.dummy.health, TARGET.health - (a === 'r' ? 0 : HERO[a].damage));
  }
  c.reset(); c.setCooldownsEnabled(true); c.cast(position, aim('q'));
  assert.equal(c.cooldown('q'), HERO.q.cooldown);
});

class Surface extends EventTarget { hidden = false; disabled = false; textContent = ''; }
test('hidden tab stops the loop, preserves combat clocks and resumes without catching up wall time', () => {
  const c = createCombat(), m = createMovement(), page = new Surface();
  let callback, now = 0, lastTime;
  const loop = { runRenderLoop: fn => { callback = fn; }, stopRenderLoop: () => { callback = undefined; } };
  const render = () => {
    if (lastTime !== undefined) m.advance(now - lastTime, { x: 0, z: 0 }, c.tick, c.move);
    lastTime = now;
  };
  const ui = setupVisibility(loop, render, () => { m.suspend(); lastTime = undefined; }, page);
  c.cast(m.position(), aim('e')); callback(); now += 0.1; callback();
  const cooldown = c.cooldown('e');
  page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
  assert.equal(callback, undefined); now += 120;
  page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); callback();
  assert.equal(c.cooldown('e'), cooldown);
  now += STEP; callback(); assert.ok(Math.abs(c.cooldown('e') - cooldown + STEP) < 1e-9);
  ui.dispose(); assert.equal(callback, undefined);
  page.dispatchEvent(new Event('visibilitychange')); assert.equal(callback, undefined);
});

const flush = () => new Promise(resolve => setImmediate(resolve));
test('fullscreen hides on actual entry, returns on exit, prevents duplicate requests and disposes', async () => {
  const page = new Surface(), button = new Surface(), status = new Surface();
  page.fullscreenEnabled = true; page.fullscreenElement = null;
  let resolve, requests = 0;
  page.documentElement = { requestFullscreen: () => { requests++; return new Promise(r => { resolve = r; }); } };
  const ui = setupFullscreen(button, status, page);
  assert.equal(button.hidden, false);
  button.dispatchEvent(new Event('click')); button.dispatchEvent(new Event('click'));
  assert.equal(requests, 1); assert.equal(button.disabled, true); assert.equal(button.hidden, false);
  page.fullscreenElement = {}; page.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(button.hidden, true); resolve(); await flush();
  page.fullscreenElement = null; page.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(button.hidden, false); assert.equal(button.disabled, false);
  ui.dispose(); button.dispatchEvent(new Event('click')); assert.equal(requests, 1);
});

test('unsupported or denied fullscreen remains safe and retryable', async () => {
  const page = new Surface(), button = new Surface(), status = new Surface();
  page.fullscreenEnabled = false;
  page.documentElement = { requestFullscreen: () => Promise.reject(new Error('Denied')) };
  const ui = setupFullscreen(button, status, page); assert.equal(button.hidden, true);
  page.fullscreenEnabled = true; page.dispatchEvent(new Event('fullscreenchange'));
  button.dispatchEvent(new Event('click')); await flush();
  assert.equal(button.hidden, false); assert.equal(button.disabled, false); assert.match(status.textContent, /не е достъпен/);
  ui.dispose();
});

test('debug footprints follow simulation, remove dead actors/effects, hide and dispose without mesh leaks', () => {
  const engine = new NullEngine(), scene = new Scene(engine), debug = createDebugView(scene);
  const projectile = { id: 1, kind: 'q', position }, area = { id: 2, position };
  debug.update(true, position, TARGET.spawn, [projectile], [area]);
  assert.equal(scene.meshes.length, 5);
  const hero = scene.getMeshByName('debug-hero');
  assert.equal(hero.position.x, -2);
  assert.ok(Math.abs(hero.getBoundingInfo().boundingBox.maximum.x - HERO.radius) < 1e-6);
  debug.update(true, { x: 1, z: 2 }, null, [], []);
  assert.equal(scene.meshes.length, 2); assert.equal(hero.position.x, 1);
  debug.update(false, position, null, [], []); assert.equal(scene.meshes.length, 0);
  debug.update(true, position, TARGET.spawn, [], []); debug.dispose();
  assert.equal(scene.meshes.length, 0); scene.dispose(); engine.dispose();
});
