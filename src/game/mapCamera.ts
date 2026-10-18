import type { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { HERO, MAP } from '../simulation/config.ts';

/** Follow the rendered hero; a captured pointer may temporarily inspect the map. */
export function setupMapCamera(
  scene: Scene,
  canvas: HTMLCanvasElement,
  dragZone: HTMLElement,
  heroPosition: () => { x: number; z: number },
  onZoom: (zoom: number) => void,
  host: Window = window,
  page: Document = document,
) {
  const camera = scene.activeCamera as FreeCamera;
  const offset = new Vector3(46, 58, -30);
  const focus = Vector3.Zero();
  const right = new Vector3(30, 0, 46).normalize();
  const up = new Vector3(-46, 0, 30).normalize();
  const groundScale = offset.length() / offset.y;
  const mapHalfWidth = Math.max(MAP.bridge.width / 2, MAP.baseRadius);
  const mapHalfLength = Math.max(...MAP.bases.map(base => Math.abs(base.z))) + MAP.baseRadius;
  let zoom = 2;
  let drag: { id: number; x: number; y: number } | undefined;
  const update = () => {
    if (!drag) {
      const hero = heroPosition();
      focus.set(hero.x, HERO.height / 2, hero.z);
    }
    camera.position.copyFrom(offset).addInPlace(focus);
    camera.setTarget(focus);
  };
  const resizeProjection = () => {
    const aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
    const halfH = Math.max(25, 38 / aspect) / zoom;
    camera.orthoTop = halfH; camera.orthoBottom = -halfH;
    camera.orthoLeft = -halfH * aspect; camera.orthoRight = halfH * aspect;
    update();
  };
  const setZoom = (value: number) => {
    zoom = Math.max(1, Math.min(3, value));
    resizeProjection(); onZoom(zoom);
  };
  const end = () => {
    const previous = drag;
    drag = undefined;
    dragZone.classList.remove('dragging');
    if (previous && dragZone.hasPointerCapture(previous.id)) dragZone.releasePointerCapture(previous.id);
    update();
  };
  const down = (event: PointerEvent) => {
    if (drag || event.button !== 0) return;
    event.preventDefault();
    update();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    dragZone.setPointerCapture(event.pointerId);
    dragZone.classList.add('dragging');
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    event.preventDefault();
    const units = (camera.orthoTop! - camera.orthoBottom!) / Math.max(canvas.clientHeight, 1);
    const dx = (event.clientX - drag.x) * units, dy = (event.clientY - drag.y) * units;
    focus.addInPlace(right.scale(-dx)).addInPlace(up.scale(dy * groundScale));
    focus.x = Math.max(-mapHalfWidth, Math.min(mapHalfWidth, focus.x));
    focus.z = Math.max(-mapHalfLength, Math.min(mapHalfLength, focus.z));
    drag.x = event.clientX; drag.y = event.clientY; update();
  };
  const pointerEnd = (event: PointerEvent) => { if (event.pointerId === drag?.id) end(); };
  const wheel = (event: WheelEvent) => { event.preventDefault(); setZoom(zoom * Math.exp(-event.deltaY * 0.001)); };
  const resize = () => { end(); resizeProjection(); };
  dragZone.addEventListener('pointerdown', down); dragZone.addEventListener('pointermove', move);
  dragZone.addEventListener('pointerup', pointerEnd); dragZone.addEventListener('pointercancel', pointerEnd);
  dragZone.addEventListener('lostpointercapture', pointerEnd);
  canvas.addEventListener('wheel', wheel, { passive: false });
  dragZone.addEventListener('wheel', wheel, { passive: false });
  host.addEventListener('blur', end); host.addEventListener('orientationchange', resize);
  page.addEventListener('visibilitychange', end);
  setZoom(zoom);
  return {
    update, resize,
    view(mode: 'overview' | 'arena') { end(); setZoom(mode === 'overview' ? 1 : 2); },
    zoomBy: (factor: number) => setZoom(zoom * factor),
    dispose() {
      end();
      dragZone.removeEventListener('pointerdown', down); dragZone.removeEventListener('pointermove', move);
      dragZone.removeEventListener('pointerup', pointerEnd); dragZone.removeEventListener('pointercancel', pointerEnd);
      dragZone.removeEventListener('lostpointercapture', pointerEnd);
      canvas.removeEventListener('wheel', wheel); dragZone.removeEventListener('wheel', wheel);
      host.removeEventListener('blur', end); host.removeEventListener('orientationchange', resize);
      page.removeEventListener('visibilitychange', end);
    },
  };
}
