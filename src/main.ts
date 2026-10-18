import { Engine } from '@babylonjs/core/Engines/engine';
import { createArena } from './game/createArena';
import { setupMapCamera } from './game/mapCamera';
import { createMovement } from './simulation/movement';
import { setupKeyboard } from './input/keyboard';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const message = document.querySelector<HTMLParagraphElement>('#message')!;
const zoomLabel = document.querySelector<HTMLOutputElement>('#zoom-level')!;
const overviewButton = document.querySelector<HTMLButtonElement>('#view-overview')!;
const arenaButton = document.querySelector<HTMLButtonElement>('#view-arena')!;
let engine: Engine | undefined;
let cleanup: (() => void) | undefined;
try {
  engine = new Engine(canvas, true, { stencil: false });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const { scene, hero } = createArena(engine);
  const movement = createMovement();
  let lastTime: number | undefined;
  const keyboard = setupKeyboard(() => { movement.suspend(); lastTime = undefined; });
  const dragZone = document.querySelector<HTMLElement>('#camera-drag-zone')!;
  const controls = setupMapCamera(scene, canvas, dragZone, () => hero.position, zoom => {
    zoomLabel.value = `${zoom.toFixed(1)}×`;
    overviewButton.setAttribute('aria-pressed', String(zoom === 1));
    arenaButton.setAttribute('aria-pressed', String(zoom > 1));
  });
  const actions: [string, () => void][] = [
    ['view-overview', () => controls.view('overview')],
    ['view-arena', () => controls.view('arena')],
    ['zoom-in', () => controls.zoomBy(1.25)],
    ['zoom-out', () => controls.zoomBy(0.8)],
  ];
  for (const [id, action] of actions) document.getElementById(id)!.addEventListener('click', action);
  const resize = () => { engine!.resize(); controls.resize(); };
  window.addEventListener('resize', resize);
  engine.runRenderLoop(() => {
    const now = performance.now();
    if (document.hidden || !document.hasFocus()) {
      movement.suspend(); lastTime = undefined;
    } else {
      if (lastTime !== undefined) movement.advance((now - lastTime) / 1000, keyboard.read());
      lastTime = now;
    }
    const position = movement.interpolated();
    hero.position.set(position.x, 0, position.z);
    controls.update();
    if (!document.hidden) scene.render();
  });
  void scene.whenReadyAsync().then(() => {
    if (!scene.isDisposed) message.textContent = 'WASD / стрелки за движение · Камерата следи героя';
  });
  if (import.meta.env.DEV) console.info('Map geometry:', scene.metadata);
  cleanup = () => {
    window.removeEventListener('resize', resize);
    for (const [id, action] of actions) document.getElementById(id)!.removeEventListener('click', action);
    keyboard.dispose(); controls.dispose(); scene.dispose(); engine?.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
} catch (error) {
  cleanup?.(); engine?.dispose();
  message.textContent = 'Картата не успя да стартира. Провери поддръжката на WebGL.';
  console.error(error);
}
