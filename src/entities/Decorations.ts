import * as THREE from 'three';
import type { RaceTrack } from '../levels/RaceTrack';

/**
 * Scatters procedural trees, houses, and cheering spectators randomly across
 * the grass field — guaranteeing none land on the track (uses a safety buffer
 * around the track ribbon).
 */
export class Decorations {
  /** Material caches reused across instances (faster GPU upload + draw calls). */
  private readonly trunkMat: THREE.MeshStandardMaterial;
  private readonly foliageMat: THREE.MeshStandardMaterial;
  private readonly wallMat: THREE.MeshStandardMaterial;
  private readonly roofMat: THREE.MeshStandardMaterial;
  private readonly shirtMats: THREE.MeshStandardMaterial[];
  private readonly skinMat: THREE.MeshStandardMaterial;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly track: RaceTrack,
    private readonly worldHalfSize: number = 700,
  ) {
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.9 });
    this.foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e6b2e, roughness: 0.95 });
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0xe6cfa6, roughness: 0.85 });
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.85 });
    this.shirtMats = [
      new THREE.MeshStandardMaterial({ color: 0xe61e1e }),
      new THREE.MeshStandardMaterial({ color: 0x1e72e6 }),
      new THREE.MeshStandardMaterial({ color: 0xe6c61e }),
      new THREE.MeshStandardMaterial({ color: 0x1ee672 }),
    ];
    this.skinMat = new THREE.MeshStandardMaterial({ color: 0xf2c79b });
  }

  /** Place trees, houses, and spectators around the grass. */
  scatter({ trees = 200, houses = 25, people = 60 } = {}): void {
    // Trees cluster densely up to the track shoulder (small buffer = closer trees).
    for (let i = 0; i < trees; i++) {
      const p = this.findGrassPosition(8);
      if (p) this.addTree(p.x, p.z);
    }
    for (let i = 0; i < houses; i++) {
      const p = this.findGrassPosition(40);
      if (p) this.addHouse(p.x, p.z);
    }
    for (let i = 0; i < people; i++) {
      // People cheer near the track — small buffer so they line the edges.
      const p = this.findGrassPosition(14);
      if (p) this.addPerson(p.x, p.z);
    }
  }

  /** Find a random point on the grass not within `buffer` metres of the track. */
  private findGrassPosition(buffer: number): { x: number; z: number } | null {
    const half = this.worldHalfSize;
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * (half * 2);
      const z = (Math.random() - 0.5) * (half * 2);
      if (!this.track.isOnTrack(x, z, this.track.trackHalfWidth + buffer)) {
        return { x, z };
      }
    }
    return null;
  }

  private addTree(x: number, z: number): void {
    const scale = 0.8 + Math.random() * 0.7; // 0.8 – 1.5
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const trunkH = 2.2 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, trunkH, 8),
      this.trunkMat,
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    group.add(trunk);

    const foliageH = 4 * scale;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(1.6 * scale, foliageH, 8),
      this.foliageMat,
    );
    foliage.position.y = trunkH + foliageH / 2 - 0.4 * scale;
    foliage.castShadow = true;
    group.add(foliage);

    // Random rotation so the cones don't look identical
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);
  }

  private addHouse(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const w = 6 + Math.random() * 4;
    const d = 6 + Math.random() * 4;
    const h = 3 + Math.random() * 1.5;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    group.add(walls);

    // Pitched roof — a 4-sided pyramid (ConeGeometry with 4 segments)
    const roofH = 2 + Math.random() * 1;
    const roofR = Math.sqrt(w * w + d * d) / 2;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(roofR, roofH, 4),
      this.roofMat,
    );
    roof.position.y = h + roofH / 2;
    roof.rotation.y = Math.PI / 4; // align roof corners with walls
    roof.castShadow = true;
    group.add(roof);

    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);
  }

  private addPerson(x: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const shirtMat = this.shirtMats[Math.floor(Math.random() * this.shirtMats.length)];

    // Body — torso
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.9, 8),
      shirtMat,
    );
    torso.position.y = 0.9;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      this.skinMat,
    );
    head.position.y = 1.55;
    head.castShadow = true;
    group.add(head);

    // Arms raised (cheering!) — at slight upward angle
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6),
        shirtMat,
      );
      arm.position.set(sx * 0.28, 1.45, 0);
      arm.rotation.z = sx * Math.PI / 4;     // angle out
      arm.rotation.x = -Math.PI / 6;          // arms forward
      arm.castShadow = true;
      group.add(arm);
    }

    // Legs
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.85, 6),
        this.trunkMat, // dark "pants"
      );
      leg.position.set(sx * 0.1, 0.42, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);
  }
}
