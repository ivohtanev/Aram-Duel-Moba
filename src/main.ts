import { Engine } from '@babylonjs/core/Engines/engine';
import { createArena } from './game/createArena';
import { setupMapCamera } from './game/mapCamera';
import { createMovement } from './simulation/movement';
import { setupKeyboard } from './input/keyboard';
import { setupTouch, type Action, type Aim } from './input/touch';
import { createAimMarker } from './game/aimMarker';
import { createCombat } from './simulation/combat';
import { createCombatView } from './game/combatView';
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
  const { scene, hero, target } = createArena(engine);
  const movement = createMovement();
  const combat = createCombat();
  const combatView = createCombatView(scene);
  const castStatus = document.getElementById('cast-status')!;
  const healthStatus = document.getElementById('health-status')!;
  const attackButton = document.getElementById('action-attack')!;
  const attack = () => {
    if (document.hidden || !document.hasFocus()) return;
    const result = combat.attack(movement.position());
    castStatus.textContent = { fired: 'Атака · изстрел', cooldown: 'Атаката се подготвя',
      'no-target': 'Няма жива цел в обсег (5)', dead: 'Героят е победен' }[result];
  };
  let lastTime: number | undefined;
  const keyboard = setupKeyboard(() => { movement.suspend(); lastTime = undefined; }, window, document, attack);
  const marker = createAimMarker(scene);
  let lastCast: Aim | undefined;
  let castUntil = 0;
  const touch = setupTouch(
    document.querySelector<HTMLElement>('#joystick')!, document.querySelector<HTMLElement>('#joystick-knob')!,
    Object.fromEntries(['attack', 'q', 'e', 'r'].map(action => [action, document.getElementById(`action-${action}`)!])) as Record<Action, HTMLElement>,
    document.getElementById('cancel-cast')!, () => movement.position(), aim => {
      if (aim.action === 'attack') { attack(); return; }
      lastCast = aim; castUntil = performance.now() + 450;
      castStatus.textContent = `${aim.action.toUpperCase()} · само прицелване, умението предстои`;
    }, () => { movement.suspend(); lastTime = undefined; lastCast = undefined; },
    window, document, () => combat.dummy.health > 0 ? combat.dummy.position : null,
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
      if (lastTime !== undefined) movement.advance((now - lastTime) / 1000, input, position => combat.tick(position));
      lastTime = now;
    }
    const position = movement.interpolated();
    hero.position.set(position.x, 0, position.z);
    target.setEnabled(combat.dummy.health > 0);
    combatView.update(combat.projectiles());
    const dummyText = combat.dummy.health > 0 ? `${combat.dummy.health}/${combat.dummy.maxHealth}` : `Възстановяване ${combat.dummy.respawnIn.toFixed(1)} s`;
    const hit = combat.lastHit();
    healthStatus.textContent = `Герой ${combat.hero.health}/${combat.hero.maxHealth} · Цел ${dummyText}${hit ? ` · Щети ${hit.damage}` : ''}`;
    attackButton.textContent = combat.cooldown() > 1e-12 ? `${combat.cooldown().toFixed(1)} s` : 'АТАКА';
    controls.update();
    marker.update(position, touch.aiming() ?? (now < castUntil ? lastCast : undefined));
    if (!document.hidden) scene.render();
  });
  void scene.whenReadyAsync().then(() => {
    if (!scene.isDisposed) message.textContent = 'Джойстик / WASD · Приближи целта · АТАКА / Space';
  });
  if (import.meta.env.DEV) console.info('Map geometry:', scene.metadata);
  cleanup = () => {
    window.removeEventListener('resize', resize);
    for (const [id, action] of actions) document.getElementById(id)!.removeEventListener('click', action);
    touch.dispose(); marker.dispose(); combatView.dispose(); keyboard.dispose(); controls.dispose(); scene.dispose(); engine?.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
} catch (error) {
  cleanup?.(); engine?.dispose();
  message.textContent = 'Картата не успя да стартира. Провери поддръжката на WebGL.';
  console.error(error);
}
