import * as THREE from 'three';
import type { Car } from './Car';
import { loadCarModel, cloneCarModel } from '../assets/CarModel';

const WHEEL_RADIUS = 1.008;
const PAINT_RE = /paint|body|coat/i;
const WHEEL_RE = /wheel|tire|rim/i;
const GLASS_RE = /glass|window|windshield/i;

/**
 * Renderable shell around a `Car` logic instance. Owns a clone of the shared
 * GLTF AMG-GTR template, tints the body paint per player, and spins the wheels.
 *
 * Construct via `await CarView.create(car, color)` — the underlying GLB loads
 * once and is cached, subsequent calls just clone the template.
 */
export class CarView {
  private constructor(
    private readonly car: Car,
    readonly group: THREE.Group,
    private readonly wheels: THREE.Object3D[],
  ) {}

  static async create(car: Car, color: number): Promise<CarView> {
    const { template, wheelNames } = await loadCarModel();
    const inner = cloneCarModel(template);

    tintBody(inner, color);

    const wheelSet = new Set(wheelNames);
    const wheels: THREE.Object3D[] = [];
    inner.traverse((obj) => {
      if (wheelSet.has(obj.name)) wheels.push(obj);
    });

    // Outer group carries the dynamic car position/yaw; inner keeps the static
    // normalize transforms (scale, ground offset, axis flips) so update() can't
    // overwrite them.
    const group = new THREE.Group();
    group.add(inner);

    return new CarView(car, group, wheels);
  }

  update(dt: number): void {
    this.group.position.copy(this.car.position);
    this.group.rotation.y = this.car.yaw;

    const omega = this.car.speed / WHEEL_RADIUS;
    const delta = omega * dt;
    for (const w of this.wheels) {
      w.rotation.x += delta;
    }
  }
}

function tintBody(root: THREE.Group, color: number): void {
  const candidates: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (WHEEL_RE.test(mesh.name) || GLASS_RE.test(mesh.name)) return;
    candidates.push(mesh);
  });

  const named = candidates.filter((m) => matchesPaintName(m.material));
  const targets = named.length > 0 ? named : pickLargest(candidates);

  for (const mesh of targets) {
    mesh.material = recolorMaterial(mesh.material, color);
  }
}

function matchesPaintName(mat: THREE.Material | THREE.Material[]): boolean {
  if (Array.isArray(mat)) return mat.some((m) => PAINT_RE.test(m.name));
  return PAINT_RE.test(mat.name);
}

function pickLargest(meshes: THREE.Mesh[]): THREE.Mesh[] {
  if (meshes.length === 0) return [];
  let best: THREE.Mesh | null = null;
  let bestVol = -Infinity;
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  for (const m of meshes) {
    box.setFromObject(m);
    box.getSize(size);
    const vol = size.x * size.y * size.z;
    if (vol > bestVol) {
      bestVol = vol;
      best = m;
    }
  }
  return best ? [best] : [];
}

function recolorMaterial(
  mat: THREE.Material | THREE.Material[],
  color: number,
): THREE.Material | THREE.Material[] {
  if (Array.isArray(mat)) return mat.map((m) => recolorOne(m, color));
  return recolorOne(mat, color);
}

function recolorOne(mat: THREE.Material, color: number): THREE.Material {
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial
  ) {
    const cloned = mat.clone();
    cloned.color.setHex(color);
    return cloned;
  }
  return new THREE.MeshPhysicalMaterial({
    color,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    metalness: 0.6,
    roughness: 0.35,
  });
}
