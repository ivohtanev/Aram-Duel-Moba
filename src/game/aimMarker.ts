import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Scene } from '@babylonjs/core/scene';
import type { Point } from '../simulation/movement';
import { HERO } from '../simulation/config.ts';
import { range, type Aim } from '../input/touch.ts';

export function createAimMarker(scene: Scene) {
  const points = Array.from({ length: 68 }, () => Vector3.Zero());
  const mesh = MeshBuilder.CreateLines('aim-marker', { points, updatable: true }, scene);
  mesh.isPickable = false;
  const ringPoints = Array.from({ length: 97 }, () => Vector3.Zero());
  const ring = MeshBuilder.CreateLines('ability-range', { points: ringPoints, updatable: true }, scene);
  ring.color = new Color3(0.82, 0.95, 1); ring.alpha = 0.5; ring.isPickable = false;
  return {
    update(hero: Point, aim?: Aim) {
      ring.setEnabled(Boolean(aim)); mesh.setEnabled(Boolean(aim) && aim?.action !== 'attack'); if (!aim) return;
      for (let i = 0; i < ringPoints.length; i++) {
        const angle = i / (ringPoints.length - 1) * Math.PI * 2;
        ringPoints[i].set(hero.x + Math.cos(angle) * range(aim.action), 0.16, hero.z + Math.sin(angle) * range(aim.action));
      }
      MeshBuilder.CreateLines('ability-range', { points: ringPoints, instance: ring });
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
    dispose: () => { mesh.dispose(); ring.dispose(); },
  };
}
