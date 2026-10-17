import { Engine } from '@babylonjs/core/Engines/engine';
import { createArena } from './game/createArena';
import { setupMapCamera } from './game/mapCamera';
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
  const scene = createArena(engine);
  const controls = setupMapCamera(scene, canvas, zoom => {
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
  engine.runRenderLoop(() => { if (!document.hidden) scene.render(); });
  void scene.whenReadyAsync().then(() => {
    if (!scene.isDisposed) message.textContent = 'Една линия. Две страни. Леден свят.';
  });
  if (import.meta.env.DEV) console.info('Map geometry:', scene.metadata);
  cleanup = () => {
    window.removeEventListener('resize', resize);
    for (const [id, action] of actions) document.getElementById(id)!.removeEventListener('click', action);
    controls.dispose(); scene.dispose(); engine?.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
} catch (error) {
  cleanup?.(); engine?.dispose();
  message.textContent = 'Картата не успя да стартира. Провери поддръжката на WebGL.';
  console.error(error);
}
