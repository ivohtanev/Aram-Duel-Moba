import type { Scene } from '@babylonjs/core/scene.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import type { LaneActor } from '../simulation/laneMatch.ts';

export function createLaneView(scene: Scene, structures: Map<string, TransformNode>) {
  const units = new Map<string, Mesh>(), bars = new Map<string, Mesh>();
  const material = (name: string, color: string) => {
    const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(color);
    m.emissiveColor = m.diffuseColor.scale(0.3); return m;
  };
  const blue = material('lane-blue', '#35cbe7'), coral = material('lane-coral', '#ff958b');
  const protectedMaterial = material('lane-shield', '#888ca8');
  const clear = () => {
    for (const mesh of [...units.values(), ...bars.values()]) mesh.dispose();
    units.clear(); bars.clear();
  };
  return {
    update(active: boolean, actors: readonly LaneActor[], vulnerable: (actor: LaneActor) => boolean) {
      if (!active) { clear(); for (const node of structures.values()) node.setEnabled(true); return; }
      const live = new Set(actors.filter(a => a.health > 0).map(a => a.id));
      for (const collection of [units, bars]) {
        for (const [id, mesh] of collection) if (!live.has(id)) { mesh.dispose(); collection.delete(id); }
      }
      for (const actor of actors) {
        structures.get(actor.id)?.setEnabled(actor.health > 0);
        if (actor.health <= 0) continue;
        const team = actor.team === 'blue' ? blue : coral;
        if (actor.kind === 'minion') {
          let mesh = units.get(actor.id);
          if (!mesh) {
            mesh = CreateCylinder(actor.id, { diameter: actor.radius * 2, height: 0.7, tessellation: 6 }, scene);
            mesh.material = team; mesh.isPickable = false; units.set(actor.id, mesh);
          }
          mesh.position.set(actor.position.x, 0.5, actor.position.z);
        }
        let bar = bars.get(actor.id);
        if (!bar) {
          bar = CreateBox(`hp-${actor.id}`, { width: actor.kind === 'minion' ? 0.9 : 2.4, height: 0.12, depth: 0.12 }, scene);
          bar.isPickable = false; bar.billboardMode = Mesh.BILLBOARDMODE_ALL; bars.set(actor.id, bar);
        }
        bar.position.set(actor.position.x, actor.kind === 'minion' ? 1.1 : 4.2, actor.position.z);
        bar.scaling.x = actor.health / actor.maxHealth;
        bar.material = vulnerable(actor) ? team : protectedMaterial;
      }
    },
    dispose() { clear(); blue.dispose(); coral.dispose(); protectedMaterial.dispose(); },
  };
}
