import test from 'node:test';
import assert from 'node:assert/strict';
import { stick, quickAim, setupTouch } from '../src/input/touch.ts';
import { TARGET } from '../src/simulation/config.ts';
class Surface extends EventTarget {
  captured = new Set(); style = {}; hidden = true; classes = new Set();
  classList = { add: n => this.classes.add(n), remove: n => this.classes.delete(n), toggle: (n, v) => v ? this.classes.add(n) : this.classes.delete(n) };
  rect = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 };
  getBoundingClientRect() { return this.rect; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  emit(type, props = {}) { const e = new Event(type, { cancelable: true }); Object.assign(e, { button: 0, pointerId: 1, clientX: 50, clientY: 50 }, props); this.dispatchEvent(e); return e; }
}
function fixture(t) {
  const joy = new Surface(), knob = new Surface(), cancel = new Surface(), host = new Surface(), page = new Surface();
  cancel.rect = { left: 200, right: 300, top: 0, bottom: 100 };
  const buttons = Object.fromEntries(['q','e','r','attack'].map(k => [k, new Surface()]));
  const casts = []; let suspends = 0;
  const input = setupTouch(joy, knob, buttons, cancel, () => ({ x: 0, z: 0 }), a => casts.push(a), () => suspends++, host, page);
  t.after(() => input.dispose());
  const start = () => { joy.emit('pointerdown'); joy.emit('pointermove', { clientX: 90 }); buttons.q.emit('pointerdown', { pointerId: 2 }); };
  return { joy, knob, cancel, host, page, buttons, casts, input, start, suspends: () => suspends };
}
test('dead zone, analog ramp and clamped diagonal speed in screen basis', () => {
  assert.deepEqual(stick(2, 2, 32), { x: 0, z: 0 });
  const half = stick(16, 0, 32); assert.ok(Math.hypot(half.x, half.z) > 0 && Math.hypot(half.x, half.z) < 1);
  for (const [x,y] of [[100,0],[0,100],[100,100]]) assert.ok(Math.abs(Math.hypot(...Object.values(stick(x,y,32))) - 1) < 1e-9);
  assert.ok(stick(0,-32,32).x < 0 && stick(0,-32,32).z > 0);
});
test('quick cast selects in-range target or last movement direction', () => {
  const facing = { x: 1, z: 0 };
  assert.deepEqual(quickAim('q', { x: TARGET.spawn.x, z: TARGET.spawn.z - 3 }, facing).direction, { x: 0, z: 1 });
  assert.deepEqual(quickAim('q', { x: 0, z: -30 }, facing).direction, facing);
});
test('movement and aiming remain independent; third finger cannot steal or release either', t => {
  const f = fixture(t); f.start(); const before = f.input.read();
  f.buttons.e.emit('pointerdown', { pointerId: 3 }); f.joy.emit('pointerup', { pointerId: 3 });
  f.buttons.q.emit('pointermove', { pointerId: 2, clientX: 130 });
  assert.deepEqual(f.input.read(), before); assert.equal(f.input.aiming().action, 'q');
  f.buttons.q.emit('pointerup', { pointerId: 2, clientX: 130 });
  assert.equal(f.casts.length, 1); assert.deepEqual(f.input.read(), before); assert.equal(f.buttons.q.captured.size, 0);
  f.joy.emit('pointerup'); assert.deepEqual(f.input.read(), { x: 0, z: 0 });
});
test('cancel zone suppresses cast; dragging back out permits release', t => {
  const f = fixture(t); f.start();
  f.buttons.q.emit('pointerup', { pointerId: 2, clientX: 250 }); assert.equal(f.casts.length, 0);
  f.buttons.e.emit('pointerdown', { pointerId: 2 });
  f.buttons.e.emit('pointermove', { pointerId: 2, clientX: 250 }); assert.equal(f.input.aiming().canceled, true);
  f.buttons.e.emit('pointerup', { pointerId: 2, clientX: 100 }); assert.equal(f.casts.length, 1); assert.equal(f.casts[0].action, 'e');
});
test('all interruption paths clear both captures without casting; stale up does nothing', t => {
  const f = fixture(t);
  for (const stop of [() => f.host.emit('pointercancel'), () => f.host.emit('blur'), () => f.host.emit('orientationchange'), () => f.host.emit('resize'), () => f.page.emit('visibilitychange'), () => f.page.emit('focusin'), () => f.joy.releasePointerCapture(1), () => f.buttons.q.releasePointerCapture(2)]) {
    f.start(); stop(); assert.deepEqual(f.input.read(), { x: 0, z: 0 }); assert.equal(f.input.aiming(), undefined);
    assert.equal(f.joy.captured.size, 0); assert.equal(f.buttons.q.captured.size, 0); assert.equal(f.cancel.hidden, true);
    f.buttons.q.emit('pointerup', { pointerId: 2 }); assert.equal(f.casts.length, 0);
  }
  f.input.dispose(); f.start(); assert.deepEqual(f.input.read(), { x: 0, z: 0 });
});
