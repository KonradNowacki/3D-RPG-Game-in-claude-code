import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface CarModelTemplate {
  template: THREE.Group;
  wheelNames: string[];
}

const MODEL_URL = '/models/rb20/rb20.gltf';
const TARGET_LENGTH = 5.28;

let cached: Promise<CarModelTemplate> | null = null;

export function loadCarModel(): Promise<CarModelTemplate> {
  if (cached) return cached;
  cached = new Promise<CarModelTemplate>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        const template = gltf.scene;
        normalize(template);
        const wheelNames = identifyWheels(template);
        if (wheelNames.length === 0) {
          console.warn('[CarModel] no wheel meshes detected — wheels will not spin');
        }
        resolve({ template, wheelNames });
      },
      undefined,
      (err) => {
        console.error(`[CarModel] failed to load ${MODEL_URL}`, err);
        reject(err);
      },
    );
  });
  return cached;
}

function normalize(root: THREE.Group): void {
  // Model's nose points along +Z; game's forward direction is -Z (see Car.forward()).
  root.rotation.y = Math.PI;
  root.updateMatrixWorld(true);

  const bbox = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const longest = Math.max(size.x, size.y, size.z);
  const scale = TARGET_LENGTH / longest;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= scaledBox.min.y;
  root.updateMatrixWorld(true);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

// Identifies the 4 wheels as disc-shaped meshes (one bbox axis much shorter
// than the other two) located at the 4 corners of the car (one per quadrant of
// the XZ plane). Renames each to "wheel_<i>" so downstream filters find them.
function identifyWheels(root: THREE.Group): string[] {
  type Candidate = { mesh: THREE.Mesh; cx: number; cz: number; cornerDist: number };
  const candidates: Candidate[] = [];
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    box.setFromObject(mesh);
    box.getSize(size);
    box.getCenter(center);

    const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
    const aspect = dims[2] > 0 ? dims[0] / dims[2] : 1;
    if (aspect > 0.55) return; // not disc-shaped
    if (Math.abs(center.x) < 0.4 || Math.abs(center.z) < 0.4) return; // not at a corner

    candidates.push({ mesh, cx: center.x, cz: center.z, cornerDist: Math.abs(center.x) + Math.abs(center.z) });
  });

  // Best candidate per quadrant (sign of cx, cz)
  const byQuadrant = new Map<string, Candidate>();
  for (const c of candidates) {
    const key = `${Math.sign(c.cx)}_${Math.sign(c.cz)}`;
    const existing = byQuadrant.get(key);
    if (!existing || c.cornerDist > existing.cornerDist) byQuadrant.set(key, c);
  }

  const names: string[] = [];
  Array.from(byQuadrant.values()).forEach((c, i) => {
    c.mesh.name = `wheel_${i}`;
    names.push(c.mesh.name);
  });
  return names;
}

export function cloneCarModel(template: THREE.Group): THREE.Group {
  let hasSkinned = false;
  template.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) hasSkinned = true;
  });
  return (hasSkinned ? cloneSkeleton(template) : template.clone(true)) as THREE.Group;
}
