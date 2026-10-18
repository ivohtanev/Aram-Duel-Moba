import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../simulation/movement';
import { HERO } from '../simulation/config';
import { range, type Aim } from '../input/touch';

export function createAimMarker(scene: Scene) {
  const points = Array.from({ length: 68 }, () => Vector3.Zero());
  const mesh = MeshBuilder.CreateLines('aim-marker', { points, updatable: true }, scene);
  mesh.isPickable = false;
  return {
    update(hero: Point, aim?: Aim) {
      mesh.setEnabled(Boolean(aim)); if (!aim) return;
      const distance = aim.action === 'e' ? aim.distance : range(aim.action);
      const x = hero.x + aim.direction.x * distance, z = hero.z + aim.direction.z * distance;
      points[0].set(hero.x, 0.18, hero.z); points[1].set(x, 0.18, z);
      const radius = aim.action === 'e' ? HERO.e.radius : 0.35;
      for (let i = 2; i < points.length; i++) {
        const angle = (i - 2) / (points.length - 3) * Math.PI * 2;
        points[i].set(x + Math.cos(angle) * radius, 0.18, z + Math.sin(angle) * radius);
      }
      MeshBuilder.CreateLines('aim-marker', { points, instance: mesh });
      mesh.color = aim.canceled ? new Color3(1, 0.3, 0.3) : new Color3(0.5, 1, 0.85);
    },
    dispose: () => mesh.dispose(),
  };
}
