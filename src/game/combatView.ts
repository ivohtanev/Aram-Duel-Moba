import type { Scene } from '@babylonjs/core/scene.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import '@babylonjs/core/Shaders/color.vertex.js';
import '@babylonjs/core/Shaders/color.fragment.js';
import type { Projectile, Area } from '../simulation/combat.ts';
import { HERO } from '../simulation/config.ts';

export function createCombatView(scene: Scene) {
  const meshes = new Map<number, Mesh>();
  const warnings = new Map<number, Mesh>();
  const material = new StandardMaterial('attack-light', scene);
  material.emissiveColor = Color3.FromHexString('#a5faff');
  material.disableLighting = true;
  return {
    update(projectiles: readonly Projectile[], areas: readonly Area[] = []) {
      const live = new Set(projectiles.map(projectile => projectile.id));
      for (const [id, mesh] of meshes) if (!live.has(id)) { mesh.dispose(); meshes.delete(id); }
      for (const projectile of projectiles) {
        let mesh = meshes.get(projectile.id);
        if (!mesh) {
          mesh = CreateSphere(`attack-${projectile.id}`, { diameter: 0.24, segments: 6 }, scene);
          mesh.material = material; mesh.isPickable = false; meshes.set(projectile.id, mesh);
        }
        mesh.position.set(projectile.position.x, 1, projectile.position.z);
        mesh.scaling.setAll(projectile.kind === 'q' ? 1.6 : 1);
      }
      const active = new Set(areas.map(area => area.id));
      for (const [id, mesh] of warnings) if (!active.has(id)) { mesh.dispose(); warnings.delete(id); }
      for (const area of areas) {
        let mesh = warnings.get(area.id);
        if (!mesh) {
          const points = Array.from({ length: 65 }, (_, i) => new Vector3(
            Math.cos(i / 64 * Math.PI * 2) * HERO.e.radius, 0, Math.sin(i / 64 * Math.PI * 2) * HERO.e.radius));
          const warning = CreateLines(`e-warning-${area.id}`, { points }, scene);
          warning.color = Color3.FromHexString('#ffb36b'); warning.isPickable = false;
          mesh = warning; warnings.set(area.id, mesh);
        }
        mesh.position.set(area.position.x, 0.2, area.position.z);
        mesh.visibility = 0.6 + 0.4 * (1 - area.remaining / HERO.e.delay);
      }
    },
    dispose() {
      for (const mesh of [...meshes.values(), ...warnings.values()]) mesh.dispose();
      meshes.clear(); warnings.clear(); material.dispose();
    },
  };
}
