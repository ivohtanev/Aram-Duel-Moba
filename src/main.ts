import { Engine } from '@babylonjs/core/Engines/engine';
import { createArena } from './game/createArena';
import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const message = document.querySelector<HTMLParagraphElement>('#message')!;

try {
  const engine = new Engine(canvas, true, { stencil: true });
  // Limit render resolution on high-density phones.
  engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = createArena(engine);
  engine.runRenderLoop(() => scene.render());
  const resize = () => engine.resize();
  window.addEventListener('resize', resize);
  message.textContent = 'Арената е готова. Движението и бойната система предстоят.';

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('resize', resize);
      scene.dispose();
      engine.dispose();
    });
  }
} catch (error) {
  message.textContent = 'Арената не успя да стартира. Провери поддръжката на WebGL.';
  console.error(error);
}
