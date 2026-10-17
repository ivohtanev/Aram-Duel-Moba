import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/** Visual foundation only. Gameplay and collision rules belong in simulation/. */
export function createArena(engine: Engine): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.035, 0.06, 0.1, 1);
  const camera = new FreeCamera('camera', new Vector3(0, 24, -19), scene);
  camera.setTarget(Vector3.Zero());
  camera.fov = 0.9;
  camera.inputs.clear();
  scene.activeCamera = camera;
  new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);

  const material = (name: string, color: string) => {
    const result = new StandardMaterial(name, scene);
    result.diffuseColor = Color3.FromHexString(color);
    result.specularColor = Color3.Black();
    return result;
  };
  const ground = MeshBuilder.CreateGround('arena', { width: 12, height: 24 }, scene);
  ground.material = material('ground', '#33475b');
  const lane = MeshBuilder.CreateGround('lane', { width: 5, height: 24 }, scene);
  lane.position.y = 0.01;
  lane.material = material('lane', '#657b8b');
  const player = MeshBuilder.CreateCapsule('hero-placeholder', { height: 1.6, radius: 0.4 }, scene);
  player.position.set(0, 0.8, -5);
  player.material = material('hero', '#38d6dc');
  const target = MeshBuilder.CreateBox('dummy-placeholder', { width: 1, height: 1.5, depth: 1 }, scene);
  target.position.set(0, 0.75, 5);
  target.material = material('dummy', '#fa9377');
  return scene;
}
