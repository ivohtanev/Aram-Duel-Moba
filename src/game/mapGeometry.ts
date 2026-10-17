import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
// Register GLSL before the first merged material is rendered (also during Vite HMR).
import '@babylonjs/core/Shaders/default.vertex';
import '@babylonjs/core/Shaders/default.fragment';

/** Build once, then merge by material: hundreds of props become a few draw calls. */
export function mapGeometry(scene: Scene) {
  const batches = new Map<StandardMaterial, Mesh[]>();
  const material = (name: string, hex: string, emission = 0) => {
    const mat = new StandardMaterial(name, scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.specularColor = Color3.Black();
    mat.emissiveColor = mat.diffuseColor.scale(emission);
    mat.freeze();
    batches.set(mat, []);
    return mat;
  };
  const place = (mesh: Mesh, mat: StandardMaterial, x: number, y: number, z: number) => {
    mesh.position.set(x, y, z);
    mesh.material = mat;
    mesh.isPickable = false;
    batches.get(mat)!.push(mesh);
    return mesh;
  };
  const box = (mat: StandardMaterial, x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) => {
    const mesh = place(CreateBox('block', { width: w, height: h, depth: d }, scene), mat, x, y, z);
    mesh.rotation.y = angle;
    return mesh;
  };
  const cylinder = (mat: StandardMaterial, x: number, y: number, z: number, bottom: number, top: number, height: number, sides = 8) =>
    place(CreateCylinder('stone', { diameterBottom: bottom, diameterTop: top, height, tessellation: sides }, scene), mat, x, y, z);
  // Flat annuli use 48 triangles instead of a 1,152-triangle torus.
  const ring = (mat: StandardMaterial, x: number, y: number, z: number, diameter: number, thickness: number) => {
    const mesh = new Mesh('inlay', scene);
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      for (const radius of [(diameter - thickness) / 2, (diameter + thickness) / 2]) {
        positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        normals.push(0, 1, 0);
      }
      if (i < 24) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const data = new VertexData();
    data.positions = positions; data.normals = normals; data.indices = indices;
    data.uvs = new Array(positions.length / 3 * 2).fill(0);
    data.applyToMesh(mesh);
    return place(mesh, mat, x, y, z);
  };
  const finish = () => {
    for (const [mat, meshes] of batches) {
      if (!meshes.length) { mat.dispose(); continue; }
      const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false)!;
      merged.name = `map-${mat.name}`;
      merged.isPickable = false;
      merged.freezeWorldMatrix();
    }
  };
  return { material, box, cylinder, ring, finish };
}
