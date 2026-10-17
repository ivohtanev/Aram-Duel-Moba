import type { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

/** Inspection controls only: orthographic zoom and bounded pan, never hero movement. */
export function setupMapCamera(scene: Scene, canvas: HTMLCanvasElement, onZoom: (zoom: number) => void) {
  const camera = scene.activeCamera as FreeCamera;
  const offset = new Vector3(46, 58, -30);
  const focus = Vector3.Zero();
  let zoom = 1;
  let drag: { id: number; x: number; y: number } | undefined;
  const update = () => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const halfH = Math.max(25, 38 / aspect) / zoom;
    camera.orthoTop = halfH; camera.orthoBottom = -halfH;
    camera.orthoLeft = -halfH * aspect; camera.orthoRight = halfH * aspect;
    camera.position.copyFrom(offset.add(focus));
    camera.setTarget(focus);
    onZoom(zoom);
  };
  const setZoom = (value: number) => { zoom = Math.max(1, Math.min(3, value)); update(); };
  const view = (mode: 'overview' | 'arena') => { focus.set(0, 0, 0); setZoom(mode === 'overview' ? 1 : 2); };
  const down = (event: PointerEvent) => {
    if (drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId); canvas.classList.add('dragging');
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const units = (camera.orthoTop! - camera.orthoBottom!) / Math.max(canvas.clientHeight, 1);
    const dx = (event.clientX - drag.x) * units, dy = (event.clientY - drag.y) * units;
    const right = new Vector3(30, 0, 46).normalize(), up = new Vector3(-46, 0, 30).normalize();
    focus.addInPlace(right.scale(-dx)).addInPlace(up.scale(dy * 1.38));
    focus.x = Math.max(-10, Math.min(10, focus.x)); focus.z = Math.max(-28, Math.min(28, focus.z));
    drag.x = event.clientX; drag.y = event.clientY; update();
  };
  const end = () => {
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = undefined; canvas.classList.remove('dragging');
  };
  const wheel = (event: WheelEvent) => { event.preventDefault(); setZoom(zoom * Math.exp(-event.deltaY * 0.001)); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end); canvas.addEventListener('wheel', wheel, { passive: false });
  window.addEventListener('blur', end); update();
  return {
    resize: update, view, zoomBy: (factor: number) => setZoom(zoom * factor),
    dispose() {
      end();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', end); canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('lostpointercapture', end); canvas.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', end);
    },
  };
}
