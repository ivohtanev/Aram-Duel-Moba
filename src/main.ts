import { Engine } from '@babylonjs/core/Engines/engine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Plane } from '@babylonjs/core/Maths/math.plane';
import { createArena } from './game/createArena';
import { setupMapCamera } from './game/mapCamera';
import { createMovement } from './simulation/movement';
import { setupKeyboard } from './input/keyboard';
import { setupTouch, quickAim, range, type Action, type Aim } from './input/touch';
import { createAimMarker } from './game/aimMarker';
import { createCombat } from './simulation/combat';
import { createCombatView } from './game/combatView';
import { createDebugView } from './game/debugView';
import { setupFullscreen } from './ui/fullscreen';
import { setupVisibility } from './ui/visibility';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const message = document.querySelector<HTMLParagraphElement>('#message')!;
const startScreen = document.getElementById('start-screen')!;
const playScreen = document.getElementById('play-screen')!;
const startTestButton = document.querySelector<HTMLButtonElement>('#start-test')!;
const startGameButton = document.querySelector<HTMLButtonElement>('#start-game')!;
let mode: 'test' | 'game' | null = null;
let engine: Engine | undefined;
let cleanup: (() => void) | undefined;
try {
  engine = new Engine(canvas, true, { stencil: false });
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const { scene, hero, target } = createArena(engine);
  const movement = createMovement(), combat = createCombat();
  const combatView = createCombatView(scene), marker = createAimMarker(scene);
  const debugView = createDebugView(scene);
  const castStatus = document.getElementById('cast-status')!;
  const healthStatus = document.getElementById('health-status')!;
  const debugStatus = document.getElementById('debug-status')!;
  const resetButton = document.getElementById('reset')!;
  const cooldownToggle = document.querySelector<HTMLInputElement>('#cooldowns')!;
  const debugToggle = document.querySelector<HTMLInputElement>('#debug')!;
  const trainingPanel = document.querySelector<HTMLDetailsElement>('#training-panel')!;
  const menuButton = document.getElementById('back-to-menu')!;
  const fullscreen = setupFullscreen(document.querySelector<HTMLButtonElement>('#fullscreen')!, castStatus);
  const buttons = Object.fromEntries(['attack', 'q', 'e', 'r'].map(action => [action, document.getElementById(`action-${action}`)!])) as Record<Action, HTMLElement>;
  let lastTime: number | undefined;
  let pointer: { x: number; y: number } | undefined;
  let facing = { x: -46 / Math.hypot(30, 46), z: 30 / Math.hypot(30, 46) };
  const suspend = () => { movement.suspend(); lastTime = undefined; pointer = undefined; };
  const aimFor = (action: Action): Aim => {
    const position = movement.position();
    if (pointer && action !== 'attack') {
      const rect = canvas.getBoundingClientRect();
      const ray = scene.createPickingRay((pointer.x - rect.left) / rect.width * engine!.getRenderWidth(),
        (pointer.y - rect.top) / rect.height * engine!.getRenderHeight(), Matrix.Identity(), scene.activeCamera);
      const distance = ray.intersectsPlane(Plane.FromPositionAndNormal(Vector3.Zero(), Vector3.Up()));
      if (distance !== null && distance >= 0) {
        const point = ray.origin.add(ray.direction.scale(distance));
        const dx = point.x - position.x, dz = point.z - position.z, length = Math.hypot(dx, dz);
        if (length > 1e-9) return { action, direction: { x: dx / length, z: dz / length }, distance: Math.min(length, range(action)), canceled: false };
      }
    }
    return quickAim(action, position, facing, combat.dummy.health > 0 ? combat.dummy.position : null);
  };
  const cast = (aim: Aim) => {
    if (mode === null || document.hidden || !document.hasFocus()) return;
    const result = combat.cast(movement.position(), aim);
    if (result === 'fired') movement.suspend();
    castStatus.textContent = `${aim.action === 'attack' ? 'АТАКА' : aim.action.toUpperCase()} · ${
      { fired: 'кастване', cooldown: 'изчакай cooldown', 'no-target': 'няма жива цел в обсег', dead: 'героят е победен', casting: 'вече каствaш', invalid: 'отменено' }[result]}`;
  };
  const keyboard = setupKeyboard(suspend, window, document, action => cast(aimFor(action)));
  const touch = setupTouch(document.getElementById('joystick')!, document.getElementById('joystick-knob')!,
    buttons, document.getElementById('cancel-cast')!, () => movement.position(), cast, suspend,
    window, document, () => combat.dummy.health > 0 ? combat.dummy.position : null);
  const controls = setupMapCamera(scene, canvas, document.getElementById('camera-drag-zone')!, () => hero.position, () => {});
  // Training preferences survive a reset; every active input and combat effect does not.
  const reset = () => {
    keyboard.reset(); touch.reset(); touch.resetFacing(); movement.reset(); combat.reset(); suspend();
    facing = { x: -46 / Math.hypot(30, 46), z: 30 / Math.hypot(30, 46) };
    const position = movement.position();
    hero.position.set(position.x, 0, position.z); target.setEnabled(true);
    target.position.set(combat.dummy.position.x, 0, combat.dummy.position.z);
    controls.reset(); marker.update(position); combatView.update([], []);
    debugView.update(mode === 'test' && debugToggle.checked, position, combat.dummy.position, [], []);
    castStatus.textContent = 'Ново начало · Полигонът е възстановен';
    canvas.focus();
  };
  const setCooldowns = () => combat.setCooldownsEnabled(mode !== 'test' || cooldownToggle.checked);
  resetButton.addEventListener('click', reset);
  cooldownToggle.addEventListener('change', setCooldowns);
  setCooldowns();
  const resize = () => { engine!.resize(); controls.resize(); };
  const start = (selected: 'test' | 'game') => {
    mode = selected;
    cooldownToggle.checked = true; debugToggle.checked = false; debugStatus.hidden = true;
    trainingPanel.open = false; trainingPanel.hidden = mode !== 'test';
    document.getElementById('mode-label')!.textContent = mode === 'test' ? 'ТРЕНИРОВЪЧЕН ПОЛИГОН' : 'ЛОКАЛНА ИГРА';
    startScreen.hidden = true; playScreen.hidden = false;
    setCooldowns(); reset(); resize();
    castStatus.textContent = 'Приближи целта · АТАКА / Space';
  };
  const startTest = () => start('test');
  const startGame = () => start('game');
  const showMenu = () => {
    mode = null;
    keyboard.reset(); touch.reset(); suspend();
    playScreen.hidden = true; startScreen.hidden = false;
    startGameButton.focus();
  };
  startTestButton.addEventListener('click', startTest);
  startGameButton.addEventListener('click', startGame);
  menuButton.addEventListener('click', showMenu);
  const pointerMove = (event: PointerEvent) => { if (event.pointerType === 'mouse') pointer = { x: event.clientX, y: event.clientY }; };
  canvas.addEventListener('pointermove', pointerMove);
  window.addEventListener('resize', resize);
  const render = () => {
    const now = performance.now();
    if (mode === null || document.hidden || !document.hasFocus()) suspend();
    else {
      const mobile = touch.read();
      const input = mobile.x || mobile.z ? mobile : keyboard.read();
      touch.face(input);
      const length = Math.hypot(input.x, input.z);
      if (length > 0) facing = { x: input.x / length, z: input.z / length };
      if (lastTime !== undefined) movement.advance((now - lastTime) / 1000, input, combat.tick, combat.move);
      lastTime = now;
    }
    const position = movement.interpolated();
    hero.position.set(position.x, 0, position.z);
    target.setEnabled(combat.dummy.health > 0);
    combatView.update(combat.projectiles(), combat.areas());
    const dummyText = combat.dummy.health > 0 ? `${combat.dummy.health}/${combat.dummy.maxHealth}` : `Възстановяване ${combat.dummy.respawnIn.toFixed(1)} s`;
    const hit = combat.lastHit();
    healthStatus.textContent = `Герой ${combat.hero.health}/${combat.hero.maxHealth} · Цел ${dummyText}${hit ? ` · Щети ${hit.damage}` : ''}${combat.casting() ? ' · Кастване' : ''}`;
    for (const action of Object.keys(buttons) as Action[]) {
      const cooldown = combat.cooldown(action);
      buttons[action].textContent = cooldown > 1e-12 ? `${cooldown.toFixed(1)} s` : action === 'attack' ? 'АТАКА' : action.toUpperCase();
      buttons[action].setAttribute('aria-disabled', String(cooldown > 1e-12 || Boolean(combat.casting())));
    }
    controls.update();
    const debugEnabled = mode === 'test' && debugToggle.checked;
    debugStatus.hidden = !debugEnabled;
    if (debugEnabled) {
      const actual = movement.position();
      debugStatus.textContent = `FPS ${engine!.getFps().toFixed(0)} · X ${actual.x.toFixed(2)} · Z ${actual.z.toFixed(2)}\nЩети ${hit ? `${hit.damage} → ${hit.targetId}` : '—'} · Снаряди ${combat.projectiles().length} · Области ${combat.areas().length}`;
    }
    debugView.update(debugEnabled, movement.position(), combat.dummy.health > 0 ? combat.dummy.position : null, combat.projectiles(), combat.areas());
    const held = keyboard.held();
    marker.update(position, touch.aiming() ?? (held ? aimFor(held) : undefined));
    if (mode !== null && !document.hidden) scene.render();
  };
  const visibility = setupVisibility(engine, render, suspend);
  void scene.whenReadyAsync().then(() => {
    if (!scene.isDisposed) message.textContent = 'WASD / джойстик · Задръж за обсег · Отпусни за каст · Space / Q / E / R';
  });
  cleanup = () => {
    window.removeEventListener('resize', resize); canvas.removeEventListener('pointermove', pointerMove);
    visibility.dispose();
    resetButton.removeEventListener('click', reset); cooldownToggle.removeEventListener('change', setCooldowns);
    startTestButton.removeEventListener('click', startTest); startGameButton.removeEventListener('click', startGame);
    menuButton.removeEventListener('click', showMenu);
    fullscreen.dispose(); debugView.dispose(); touch.dispose(); marker.dispose(); combatView.dispose(); keyboard.dispose(); controls.dispose(); scene.dispose(); engine?.dispose();
  };
  if (import.meta.hot) import.meta.hot.dispose(cleanup);
} catch (error) {
  cleanup?.(); engine?.dispose();
  message.textContent = 'Картата не успя да стартира. Провери поддръжката на WebGL.';
  startScreen.querySelector('.start-description')!.textContent = message.textContent;
  startTestButton.disabled = true; startGameButton.disabled = true;
  console.error(error);
}
