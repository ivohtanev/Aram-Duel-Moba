import type { Scene } from '@babylonjs/core/scene.js';
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import type { Projectile } from '../simulation/combat.ts';

export function createCombatView(scene: Scene) {
  const meshes = new Map<number, Mesh>();
  const material = new StandardMaterial('attack-light', scene);
  material.emissiveColor = Color3.FromHexString('#a5faff');
  material.disableLighting = true;
  return {
    update(projectiles: readonly Projectile[]) {
      const live = new Set(projectiles.map(projectile => projectile.id));
      for (const [id, mesh] of meshes) if (!live.has(id)) { mesh.dispose(); meshes.delete(id); }
      for (const projectile of projectiles) {
        let mesh = meshes.get(projectile.id);
        if (!mesh) {
          mesh = CreateSphere(`attack-${projectile.id}`, { diameter: 0.24, segments: 6 }, scene);
          mesh.material = material; mesh.isPickable = false; meshes.set(projectile.id, mesh);
        }
        mesh.position.set(projectile.position.x, 1, projectile.position.z);
      }
    },
    dispose() { for (const mesh of meshes.values()) mesh.dispose(); meshes.clear(); material.dispose(); },
  };
}
