import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { Point } from '../simulation/movement.ts';
import type { Projectile, Area } from '../simulation/combat.ts';
import { HERO, TARGET, SOLID_OBJECTS } from '../simulation/config.ts';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';

/** Ground footprints use simulation positions and radii, independent of art geometry. */
export function createDebugView(scene: Scene) {
  const meshes = new Map<string, LinesMesh>();
  const clear = () => { for (const mesh of meshes.values()) mesh.dispose(); meshes.clear(); };
  return {
    update(enabled: boolean, hero: Point, dummy: Point | null, projectiles: readonly Projectile[], areas: readonly Area[]) {
      if (!enabled) { clear(); return; }
      const live = new Set<string>();
      const circle = (id: string, point: Point, radius: number, color: string) => {
        live.add(id);
        let mesh = meshes.get(id);
        if (!mesh) {
          const points = Array.from({ length: 65 }, (_, i) => new Vector3(
            Math.cos(i / 64 * Math.PI * 2) * radius, 0, Math.sin(i / 64 * Math.PI * 2) * radius));
          mesh = CreateLines(`debug-${id}`, { points }, scene);
          mesh.color = Color3.FromHexString(color); mesh.isPickable = false;
          meshes.set(id, mesh);
        }
        mesh.position.set(point.x, 0.25, point.z);
      };
      circle('hero', hero, HERO.radius, '#9effc5');
      if (dummy) circle('dummy', dummy, TARGET.radius, '#ff8e9d');
      SOLID_OBJECTS.forEach((object, index) => circle(`object-${index}`, object, object.radius, '#ffee87'));
      for (const p of projectiles) if (p.kind === 'q') circle(`q-${p.id}`, p.position, HERO.q.radius, '#b8faff');
      for (const a of areas) circle(`e-${a.id}`, a.position, HERO.e.radius, '#ffb36b');
      for (const [id, mesh] of meshes) if (!live.has(id)) { mesh.dispose(); meshes.delete(id); }
    },
    dispose: clear,
  };
}
