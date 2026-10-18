import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Camera } from '@babylonjs/core/Cameras/camera.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { setupMapCamera } from '../src/game/mapCamera.ts';
import { HERO, TARGET } from '../src/simulation/config.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
class Surface extends EventTarget {
  clientWidth = 844; clientHeight = 390; captured = new Set(); classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  emit(type, props = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(props)) Object.defineProperty(event, key, { value });
    this.dispatchEvent(event); return event;
  }
}
function fixture(t) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const camera = new FreeCamera('test', new Vector3(46, 58, -30), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  scene.activeCamera = camera;
  const canvas = new Surface(), zone = new Surface(), host = new Surface(), page = new Surface();
  const hero = { ...HERO.spawn };
  let zoom;
  const controls = setupMapCamera(scene, canvas, zone, () => hero, value => zoom = value, host, page);
  const target = () => camera.position.subtract(new Vector3(46, 58, -30));
  const centered = () => { near(target().x, hero.x); near(target().y, HERO.height / 2); near(target().z, hero.z); };
  const down = () => zone.emit('pointerdown', { pointerId: 1, button: 0, clientX: 700, clientY: 170 });
  const move = (x = 450, y = 330, id = 1) => zone.emit('pointermove', { pointerId: id, clientX: x, clientY: y });
  t.after(() => { controls.dispose(); scene.dispose(); engine.dispose(); });
  return { camera, canvas, zone, host, page, hero, controls, target, centered, down, move, zoom: () => zoom };
}

test('rendered hero remains projected at screen center through movement, edges, aspect and zoom', t => {
  const f = fixture(t);
  for (const [width, height] of [[1280, 720], [844, 390], [740, 360], [390, 844]]) {
    f.canvas.clientWidth = width; f.canvas.clientHeight = height; f.controls.resize();
    for (const position of [HERO.spawn, { x: 0, z: -34 }, { x: 0, z: 34 }, { x: 6, z: 10 }]) {
      Object.assign(f.hero, position);
      for (const zoom of [0.001, 2, 999]) {
        f.controls.zoomBy(zoom); f.controls.update(); f.centered();
        const transform = f.camera.getViewMatrix().multiply(f.camera.getProjectionMatrix(true));
        const point = Vector3.Project(new Vector3(f.hero.x, HERO.height / 2, f.hero.z), Matrix.Identity(), transform, { x: 0, y: 0, width, height });
        assert.ok(Math.abs(point.x - width / 2) < 0.001); assert.ok(Math.abs(point.y - height / 2) < 0.001);
        near(f.camera.orthoRight / f.camera.orthoTop, width / height);
      }
    }
  }
});

test('only inspection zone pans; hero can move while inspection stays fixed; release follows latest hero', t => {
  const f = fixture(t); const initial = f.target();
  f.canvas.emit('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
  f.canvas.emit('pointermove', { pointerId: 1, clientX: 500, clientY: 500 });
  assert.deepEqual(f.target(), initial);
  const heroBefore = { ...f.hero };
  f.down(); f.move(); assert.notDeepEqual(f.target(), initial); assert.deepEqual(f.hero, heroBefore);
  const inspection = f.target(); f.hero.z += 8; f.controls.update(); assert.deepEqual(f.target(), inspection);
  f.zone.emit('pointerdown', { pointerId: 2, button: 0, clientX: 20, clientY: 20 });
  f.move(0, 0, 2); f.zone.emit('pointerup', { pointerId: 2 }); assert.deepEqual(f.target(), inspection);
  f.zone.emit('pointerup', { pointerId: 1 }); f.centered(); assert.equal(f.zone.captured.size, 0);
});

test('interruptions, resize and view changes restore follow without stuck capture', t => {
  const f = fixture(t);
  for (const stop of [
    () => f.zone.emit('pointercancel', { pointerId: 1 }),
    () => f.zone.releasePointerCapture(1),
    () => f.host.emit('blur'), () => f.page.emit('visibilitychange'),
    () => f.host.emit('orientationchange'), () => f.controls.resize(),
    () => f.controls.view('overview'), () => f.controls.view('arena'),
  ]) {
    f.down(); f.move(); stop(); f.centered();
    assert.equal(f.zone.captured.size, 0); assert.equal(f.zone.classes.size, 0);
    f.move(100, 100); f.centered();
  }
});

test('inspection can reach distant target and both bases, but remains bounded; zoom clamps and disposes', t => {
  const f = fixture(t); f.down();
  for (const [x, y] of [[-10000, 10000], [10000, -10000]]) {
    f.move(x, y);
    assert.ok(Math.abs(f.target().x) <= 8); near(Math.abs(f.target().z), 35);
  }
  f.zone.emit('pointerup', { pointerId: 1 });
  Object.assign(f.hero, { x: 0, z: -30 }); f.controls.update(); f.down();
  f.move(-10000, 10000); assert.ok(f.target().z > TARGET.spawn.z);
  f.controls.zoomBy(1000); near(f.zoom(), 3);
  f.controls.zoomBy(0.0001); near(f.zoom(), 1);
  f.controls.dispose(); f.centered();
  f.down(); f.move(); f.centered(); assert.equal(f.zone.captured.size, 0);
});


