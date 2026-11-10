import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  FrontSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CollapseOptions {
  /** Objects (and their descendants) that must stay separate for animation or interaction. */
  keep?: Object3D[];
}

/**
 * Bakes a hierarchy of opaque low-poly meshes into a single vertex-coloured mesh.
 *
 * The game's procedural art is built from hundreds of tiny meshes. Collapsing
 * static props (and per-model templates) keeps the draw-call budget low enough
 * for modest laptops while preserving the exact silhouette and palette.
 */
export function collapseGroup(root: Object3D, options: CollapseOptions = {}): Mesh | null {
  root.updateMatrixWorld(true);
  const keepSet = new Set<Object3D>();
  for (const object of options.keep ?? []) object.traverse((child) => keepSet.add(child));

  const inverse = new Matrix4().copy(root.matrixWorld).invert();
  const relative = new Matrix4();
  const geometries: BufferGeometry[] = [];
  const originals: Mesh[] = [];

  const walk = (object: Object3D) => {
    if (keepSet.has(object)) return;
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      const material = mesh.material;
      if (
        material instanceof MeshStandardMaterial &&
        !Array.isArray(material) &&
        !material.transparent &&
        material.opacity >= 1 &&
        !material.map &&
        material.side === FrontSide &&
        mesh.geometry.getAttribute('position')
      ) {
        const geometry = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry).clone();
        relative.multiplyMatrices(inverse, mesh.matrixWorld);
        geometry.applyMatrix4(relative);
        if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
        if (!geometry.getAttribute('uv')) {
          geometry.setAttribute('uv', new Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 2), 2));
        }
        // mergeGeometries requires a consistent attribute set.
        for (const name of Object.keys(geometry.attributes)) {
          if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') {
            geometry.deleteAttribute(name);
          }
        }
        const position = geometry.getAttribute('position');
        const colors = new Float32Array(position.count * 3);
        const base = material.color;
        const existing = geometry.getAttribute('color') as BufferAttribute | undefined;
        for (let i = 0; i < position.count; i++) {
          const r = existing ? existing.getX(i) : 1;
          const g = existing ? existing.getY(i) : 1;
          const b = existing ? existing.getZ(i) : 1;
          colors[i * 3] = base.r * r;
          colors[i * 3 + 1] = base.g * g;
          colors[i * 3 + 2] = base.b * b;
        }
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        geometries.push(geometry);
        originals.push(mesh);
        return;
      }
    }
    for (const child of object.children) walk(child);
  };
  walk(root);

  if (geometries.length === 0) return null;
  const mergedGeometry = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  if (!mergedGeometry) return null;
  mergedGeometry.computeBoundingSphere();
  mergedGeometry.computeBoundingBox();

  const material = new MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.96,
    metalness: 0,
  });
  const merged = new Mesh(mergedGeometry, material);
  merged.castShadow = true;
  merged.receiveShadow = true;
  merged.name = 'merged-static';
  for (const mesh of originals) mesh.removeFromParent();
  root.add(merged);
  return merged;
}

