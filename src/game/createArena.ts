import type { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { MAP, HERO, TARGET } from '../simulation/config';
import { mapGeometry } from './mapGeometry';

/** Buildings are visual landmarks; combat and collision are separate milestones. */
export function createArena(engine: Engine): Scene {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString('#173f60ff');
  const camera = new FreeCamera('camera', new Vector3(46, 58, -30), scene);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  camera.setTarget(Vector3.Zero());
  camera.minZ = 0.1; camera.maxZ = 240;
  camera.inputs.clear(); scene.activeCamera = camera;
  const ambient = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.72;
  ambient.groundColor = Color3.FromHexString('#37618a');
  const sun = new DirectionalLight('sun', new Vector3(-0.65, -1, 0.35), scene);
  sun.intensity = 0.55; sun.diffuse = Color3.FromHexString('#d7f6ff');
  const g = mapGeometry(scene);
  const m = {
    depth: g.material('abyss', '#163c5c'), rock: g.material('deep-rock', '#254d72'),
    rockLight: g.material('rock', '#38698b'), edge: g.material('masonry', '#4d7998'),
    edgeLight: g.material('cut-stone', '#719db4'), snow: g.material('snow', '#d6f3f7'),
    snowShade: g.material('snow-shadow', '#a5d7e5'), ice: g.material('ice', '#64bed7', 0.08),
    dark: g.material('contact-shadow', '#3b637f'),
    tiles: ['#88afc3', '#91b8ca', '#9bc2d0', '#80a9bf'].map((c, i) => g.material(`paving-${i}`, c)),
    blue: g.material('blue-team', '#35cbe7', 0.3), blueDark: g.material('blue-trim', '#177aa6'),
    coral: g.material('coral-team', '#ff958b', 0.22), coralDark: g.material('coral-trim', '#a95670'),
    gold: g.material('brass', '#e7c887'), bush: g.material('frost-brush', '#60a5b7'),
    green: g.material('relic', '#8ee9c6', 0.3),
  };
  let seed = 428;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const crystal = (mat: typeof m.blue, x: number, y: number, z: number, size: number) => {
    g.cylinder(mat, x, y + size * 0.6, z, size * 0.72, 0, size * 1.2, 5);
    g.cylinder(mat, x, y - size * 0.12, z, 0, size * 0.72, size * 0.24, 5);
  };
  const shadow = (x: number, z: number, size: number) => g.cylinder(m.dark, x + 0.25, 0.09, z - 0.2, size, size, 0.025, 12);
  const pine = (x: number, y: number, z: number, size: number) => {
    g.cylinder(m.rock, x, y + size * 0.45, z, size * 0.23, size * 0.18, size * 0.9, 6);
    for (let i = 0; i < 3; i++) {
      const width = size * (1 - i * 0.23), h = size * (0.85 - i * 0.16);
      g.cylinder(m.bush, x, y + size * (0.65 + i * 0.39), z, width, 0, h, 7);
      g.cylinder(m.snow, x, y + size * (0.75 + i * 0.39), z, width * 0.86, 0, h * 0.82, 7);
    }
  };
  // A thick bridge suspended over a dark ravine. No textures or transparent water.
  g.box(m.depth, 0, -9, 0, 180, 1, 180);
  g.box(m.rock, 0, -1.3, 0, MAP.bridge.width + 0.4, 2.4, MAP.bridge.length);
  g.box(m.edge, 0, -0.38, 0, MAP.bridge.width + 0.7, 0.45, MAP.bridge.length);
  g.box(m.dark, 0, -0.04, 0, MAP.bridge.width, 0.12, MAP.bridge.length);
  const columns = 6, rows = 28;
  const tileW = MAP.lane.width / columns, tileD = MAP.bridge.length / rows;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = (col - (columns - 1) / 2) * tileW, z = (row - (rows - 1) / 2) * tileD;
      const tile = g.box(m.tiles[Math.floor(random() * m.tiles.length)], x, 0, z, tileW - 0.045, 0.14, tileD - 0.055);
      tile.rotation.y = (random() - 0.5) * 0.018;
    }
  }
  // Snow banks and alternating openings keep the playable lane readable.
  for (const side of [-1, 1]) {
    g.box(m.edgeLight, side * 6.15, 0.08, 0, 0.4, 0.3, MAP.bridge.length);
    for (let z = -24; z <= 24; z += 3) {
      const bank = g.cylinder(m.snow, side * 6.55, 0.2, z, 2, 1.65, 0.35, 7);
      bank.scaling.set(0.75, 1, 1.7);
      if (Math.abs(z) % 9 !== 3) {
        g.box(m.edge, side * 7, 0.65, z, 0.65, 1, 2.2);
        g.box(m.snow, side * 7, 1.19, z, 0.83, 0.18, 2.4);
      }
    }
    for (let z = -24; z <= 24; z += 8) {
      g.box(m.rockLight, side * 6.8, -2, z, 1.7, 4.4, 1.8);
      g.box(m.edgeLight, side * 7, 1.05, z, 1.15, 2, 1.15);
      g.box(m.snow, side * 7, 2.08, z, 1.4, 0.22, 1.4);
      crystal(m.ice, side * 7, 2.4, z, 0.47);
      for (let j = 0; j < 2; j++) {
        const icicle = g.cylinder(m.ice, side * (7.35 + j * 0.16), -0.8, z + j * 0.45, 0, 0.35, 1.5 - j * 0.3, 5);
        icicle.rotation.z = side * 0.12;
      }
    }
  }
  for (const base of MAP.bases) {
    const team = base.team === 'blue' ? m.blue : m.coral;
    const trim = base.team === 'blue' ? m.blueDark : m.coralDark;
    const direction = Math.sign(base.z);
    g.cylinder(m.rock, base.x, -1.2, base.z, MAP.baseRadius * 2, MAP.baseRadius * 2, 2.5, 20);
    g.cylinder(m.edgeLight, base.x, -0.06, base.z, MAP.baseRadius * 2 + 0.15, MAP.baseRadius * 2 + 0.15, 0.3, 20);
    g.cylinder(m.snowShade, base.x, 0.1, base.z, MAP.baseRadius * 1.925, MAP.baseRadius * 1.925, 0.1, 20);
    g.cylinder(m.tiles[1], base.x, 0.17, base.z, MAP.baseRadius * 1.6, MAP.baseRadius * 1.6, 0.08, 20);
    g.ring(m.snow, 0, 0.24, base.z, 12.4, 0.16);
    g.ring(trim, 0, 0.24, base.z, 8.7, 0.13);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.box(m.edgeLight, Math.sin(a) * 5.3, 0.24, base.z + Math.cos(a) * 5.3, 0.18, 0.05, 1.1, a);
    }
    const coreZ = base.z + direction * 1.8;
    shadow(0, coreZ, 5.7);
    g.cylinder(m.edge, 0, 0.38, coreZ, 5.1, 4.5, 0.65, 8);
    g.cylinder(m.gold, 0, 0.76, coreZ, 4.5, 4.5, 0.14, 8);
    g.cylinder(trim, 0, 1.03, coreZ, 3.8, 3.1, 0.45, 8);
    g.ring(team, 0, 1.26, coreZ, 2.9, 0.18);
    crystal(team, 0, 1.6, coreZ, 2.25);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const x = Math.sin(a) * 2.15, z = coreZ + Math.cos(a) * 2.15;
      g.cylinder(m.edgeLight, x, 1.1, z, 0.85, 0.6, 1.45, 6);
      g.cylinder(m.gold, x, 1.87, z, 0.75, 0.75, 0.14, 6);
    }
    for (const side of [-1, 1]) {
      pine(side * 5.5, 0.2, base.z + direction * 4.7, 2.3);
      g.box(m.edge, side * 6.7, 0.65, base.z, 1, 1.3, 2.4);
      g.box(m.snow, side * 6.7, 1.35, base.z, 1.25, 0.2, 2.65);
    }
  }
  for (const tower of MAP.towers) {
    const team = tower.team === 'blue' ? m.blue : m.coral;
    const trim = tower.team === 'blue' ? m.blueDark : m.coralDark;
    const { x, z } = tower;
    shadow(x, z, 3.5);
    g.cylinder(m.edgeLight, x, 0.27, z, 3.1, 2.7, 0.4, 8);
    g.cylinder(m.gold, x, 0.49, z, 2.75, 2.75, 0.12, 8);
    g.cylinder(m.edge, x, 1.14, z, 2.1, 1.45, 1.25, 6);
    g.cylinder(trim, x, 1.85, z, 1.85, 2.2, 0.35, 6);
    g.cylinder(m.snow, x, 2.08, z, 2.3, 2.3, 0.15, 6);
    crystal(team, x, 2.35, z, 1.15);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      g.cylinder(m.edgeLight, x + Math.sin(a) * 0.95, 2.43, z + Math.cos(a) * 0.95, 0.4, 0.24, 0.85, 5);
    }
  }
  for (const brush of MAP.brush) {
    const patch = g.cylinder(m.bush, brush.x, 0.13, brush.z, 1, 1, 0.12, 10);
    patch.scaling.set(brush.width, 1, brush.length);
    for (let i = 0; i < 28; i++) {
      const x = brush.x + (random() - 0.5) * brush.width * 0.85;
      const z = brush.z + (random() - 0.5) * brush.length * 0.85, h = 0.5 + random() * 0.65;
      const blade = g.cylinder(i % 3 === 0 ? m.snow : m.bush, x, h / 2 + 0.17, z, 0.23, 0.02, h, 3);
      blade.rotation.z = (random() - 0.5) * 0.4;
    }
  }
  for (const relic of MAP.relics) {
    g.cylinder(m.edge, relic.x, 0.22, relic.z, 1.45, 1.2, 0.25, 8);
    g.ring(m.green, relic.x, 0.39, relic.z, 0.95, 0.1);
    g.box(m.green, relic.x, 0.84, relic.z, 0.2, 0.7, 0.2);
    g.box(m.green, relic.x, 0.84, relic.z, 0.65, 0.2, 0.2);
  }
  g.ring(m.snowShade, 0, 0.1, 0, 5.6, 0.12);
  for (let i = 0; i < 3; i++) g.box(m.snowShade, 0, 0.1, 0, 0.15, 0.03, 4.6, i * Math.PI / 3);
  // Cliff shoulders and snow-capped firs frame the path without covering it.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 15; i++) {
      const z = -35 + i * 5 + random() * 2, x = side * (10.7 + random() * 4.8);
      const width = 3 + random() * 3, topY = -1.2 - random() * 3;
      const cliff = g.cylinder(i % 2 ? m.rock : m.rockLight, x, topY - 3.2, z, width * 0.7, width, 6.4, 5);
      cliff.rotation.y = random() * Math.PI;
      const snow = g.cylinder(m.snowShade, x, topY + 0.06, z, width, width * 0.9, 0.18, 5);
      snow.rotation.y = cliff.rotation.y;
      if (i % 2 === 0) pine(x, topY + 0.15, z, 2.5 + random());
      if (i % 3 === 0) {
        crystal(m.ice, x - side, topY + 0.3, z + 1, 1.7);
        crystal(m.snowShade, x - side * 2, topY, z + 1.7, 1);
      }
    }
  }
  // Toy-like preview characters. Their placements come from the shared config.
  const hero = HERO.spawn;
  shadow(hero.x, hero.z, 1.55);
  g.ring(m.blue, hero.x, 0.13, hero.z, 1.4, 0.09);
  g.cylinder(m.blueDark, hero.x, 0.63, hero.z, HERO.radius * 1.8, HERO.radius * 1.5, 0.9, 8);
  g.cylinder(m.blue, hero.x, HERO.height - 0.33, hero.z, 0.8, 0.65, 0.6, 8);
  g.box(m.gold, hero.x, 1.35, hero.z + 0.35, 0.48, 0.16, 0.08);
  g.box(m.snow, hero.x + 0.55, 0.8, hero.z + 0.1, 0.16, 1.2, 0.25, -0.25);
  const dummy = TARGET.spawn;
  shadow(dummy.x, dummy.z, 1.5);
  g.ring(m.coral, dummy.x, 0.13, dummy.z, 1.4, 0.09);
  g.cylinder(m.coralDark, dummy.x, 0.65, dummy.z, 0.35, 0.35, 1.1, 6);
  g.cylinder(m.coral, dummy.x, 1.15, dummy.z, 0.9, 0.75, 0.9, 8);
  g.box(m.gold, dummy.x, 1.1, dummy.z - 0.4, 0.32, 0.32, 0.08, Math.PI / 4);
  g.finish();
  scene.metadata = {
    map: MAP.name, staticMeshes: scene.meshes.length,
    vertices: scene.meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0),
    triangles: scene.meshes.reduce((total, mesh) => total + mesh.getTotalIndices() / 3, 0),
  };
  return scene;
}
