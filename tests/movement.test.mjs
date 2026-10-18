import test from 'node:test';
import assert from 'node:assert/strict';
import { createMovement, STEP } from '../src/simulation/movement.ts';
import { HERO } from '../src/simulation/config.ts';
import { direction, setupKeyboard } from '../src/input/keyboard.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const distance = p => Math.hypot(p.x - HERO.spawn.x, p.z - HERO.spawn.z);

test('one second covers 5 units for straight and diagonal input at 30/60/144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    for (const codes of [['KeyS'], ['KeyS', 'KeyA']]) {
      const sim = createMovement();
      for (let i = 0; i < fps; i++) sim.advance(1 / fps, direction(new Set(codes)));
      near(distance(sim.position()), 5);
    }
  }
});

test('irregular frames and analog strength preserve elapsed simulation time', () => {
  const sim = createMovement();
  for (let i = 0; i < 20; i++) for (const dt of [0.007, 0.013, 0.03, 0.05]) sim.advance(dt, { x: 0.5, z: 0 });
  near(distance(sim.position()), 5);
});

test('opposites cancel, aliases do not stack, and screen axes are orthogonal', () => {
  const read = (...codes) => direction(new Set(codes));
  assert.deepEqual(read('KeyW', 'KeyS'), { x: 0, z: 0 });
  assert.deepEqual(read('KeyW', 'ArrowUp'), read('KeyW'));
  const up = read('KeyW'), right = read('KeyD');
  near(up.x * right.x + up.z * right.z, 0);
  assert.ok(up.x < 0 && up.z > 0 && right.x > 0 && right.z > 0);
});

test('interpolation stays between ticks without changing authoritative state', () => {
  const sim = createMovement();
  sim.advance(STEP * 1.5, { x: 1, z: 0 });
  near(distance(sim.position()), HERO.speed * STEP);
  near(distance(sim.interpolated()), HERO.speed * STEP * 0.5);
  const saved = sim.position(); saved.x = 123;
  near(distance(sim.position()), HERO.speed * STEP);
});

test('long frames are bounded; invalid time is ignored; suspend clears residual time', () => {
  const sim = createMovement();
  sim.advance(10, { x: 1, z: 0 });
  near(distance(sim.position()), 1.25);
  for (const dt of [NaN, Infinity, -1]) sim.advance(dt, { x: 1, z: 0 });
  near(distance(sim.position()), 1.25);
  sim.advance(STEP * 0.6, { x: 1, z: 0 });
  sim.suspend();
  assert.deepEqual(sim.interpolated(), sim.position());
  sim.advance(STEP * 0.6, { x: 1, z: 0 });
  near(distance(sim.position()), 1.25);
  sim.advance(STEP, { x: 0, z: 0 });
  near(distance(sim.position()), 1.25);
});

test('keyboard releases, interrupts, editable fields, shortcuts and disposal', () => {
  const host = new EventTarget(), page = new EventTarget();
  let interruptions = 0;
  const keyboard = setupKeyboard(() => interruptions++, host, page);
  const emit = (type, props = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries(props).map(([key, value]) => [key, { value }])));
    host.dispatchEvent(event);
    return event;
  };
  const moving = () => near(Math.hypot(keyboard.read().x, keyboard.read().z), 1);
  const stopped = () => assert.deepEqual(keyboard.read(), { x: 0, z: 0 });
  assert.ok(emit('keydown', { code: 'KeyD' }).defaultPrevented); moving();
  emit('keyup', { code: 'KeyD' }); stopped();
  for (const event of ['blur', 'visibilitychange', 'focusin']) {
    emit('keydown', { code: 'KeyD' }); moving();
    (event === 'blur' ? host : page).dispatchEvent(new Event(event)); stopped();
  }
  emit('keydown', { code: 'KeyW', target: { closest: () => ({}) } }); stopped();
  emit('keydown', { code: 'KeyW' });
  emit('keydown', { code: 'Tab', altKey: true }); stopped();
  keyboard.dispose();
  const before = interruptions;
  emit('keydown', { code: 'KeyW' }); emit('blur'); stopped();
  assert.equal(interruptions, before);
});
