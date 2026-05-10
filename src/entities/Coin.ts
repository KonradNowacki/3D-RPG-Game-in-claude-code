import * as THREE from 'three';

export class Coin {
  readonly mesh: THREE.Mesh;
  readonly position: THREE.Vector3;
  collected = false;

  constructor(x: number, y: number, z: number) {
    const geometry = new THREE.TorusGeometry(0.25, 0.08, 8, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 1.0,
      roughness: 0.2,
      emissive: 0xffd700,
      emissiveIntensity: 0.8,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
    this.mesh.castShadow = true;
    this.position = this.mesh.position;
  }

  update(dt: number): void {
    this.mesh.rotation.z += 1.5 * dt;
  }
}