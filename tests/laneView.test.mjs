import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { createArena } from '../src/game/createArena.ts';
import { createLaneView } from '../src/game/laneView.ts';
import { createLaneMatch, LANE } from '../src/simulation/laneMatch.ts';

test('arena building batches retain shared materials; lane view removes dead structures and resets training', () => {
  const engine=new NullEngine(), {scene,structures}=createArena(engine);
  const view=createLaneView(scene,structures), m=createLaneMatch();
  const initial=scene.meshes.length;
  assert.equal(structures.size,6);
  for(const node of structures.values()) {
    assert.ok(node.getChildMeshes().length>0);
    for(const mesh of node.getChildMeshes()) assert.ok(scene.materials.includes(mesh.material));
  }
  m.tick(LANE.spawn); view.update(true,m.actors(),m.vulnerable);
  assert.equal(scene.meshes.length,initial+18); // six units and twelve health bars
  const tower=m.actors().find(a=>a.id==='tower-2'); tower.health=0;
  view.update(true,m.actors(),m.vulnerable); assert.equal(structures.get('tower-2').isEnabled(),false);
  assert.equal(scene.getMeshByName('hp-tower-2'),null);
  view.update(false,[],m.vulnerable); assert.equal(scene.meshes.length,initial);
  assert.ok([...structures.values()].every(node=>node.isEnabled()));
  view.dispose(); scene.dispose(); engine.dispose();
});
