import { Engine } from '@babylonjs/core/Engines/engine';
import { createArena } from './game/createArena';
import { setupMapCamera } from './game/mapCamera';
import { createMovement } from './simulation/movement';
import { setupKeyboard } from './input/keyboard';
import { setupTouch, type Action, type Aim } from './input/touch';
import { createAimMarker } from './game/aimMarker';
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
  const marker = createAimMarker(scene);
  let lastCast: Aim | undefined;
  let castUntil = 0;
  const touch = setupTouch(
    document.querySelector<HTMLElement>('#joystick')!, document.querySelector<HTMLElement>('#joystick-knob')!,
    Object.fromEntries(['attack', 'q', 'e', 'r'].map(action => [action, document.getElementById(`action-${action}`)!])) as Record<Action, HTMLElement>,
    document.getElementById('cancel-cast')!, () => movement.position(), aim => {
      lastCast = aim; castUntil = performance.now() + 450;
      document.getElementById('cast-status')!.textContent = `${aim.action.toUpperCase()} · команда приета (бой: етап 5)`;
    }, () => { movement.suspend(); lastTime = undefined; lastCast = undefined; },
  );
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
      const mobile = touch.read();
      const input = mobile.x || mobile.z ? mobile : keyboard.read();
      touch.face(input);
      if (lastTime !== undefined) movement.advance((now - lastTime) / 1000, input);
      lastTime = now;
    }
    const position = movement.interpolated();
    hero.position.set(position.x, 0, position.z);
    controls.update();
    marker.update(position, touch.aiming() ?? (now < castUntil ? lastCast : undefined));
    if (!document.hidden) scene.render();
  });
  void scene.whenReadyAsync().then(() => {
    if (!scene.isDisposed) message.textContent = 'Джойстик / WASD · Задръж и влачи умение · Отпусни за команда';
  });
  if (import.meta.env.DEV) console.info('Map geometry:', scene.metadata);
  cleanup = () => {
    window.removeEventListener('resize', resize);
    for (const [id, action] of actions) document.getElementById(id)!.removeEventListener('click', action);
    touch.dispose(); marker.dispose(); keyboard.dispose(); controls.dispose(); scene.dispose(); engine?.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
} catch (error) {
  cleanup?.(); engine?.dispose();
  message.textContent = 'Картата не успя да стартира. Провери поддръжката на WebGL.';
  console.error(error);
}
