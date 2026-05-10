import * as THREE from 'three';
import type { Checkpoint } from '../core/types';

/**
 * Visual marker for a checkpoint: two thin pylons flanking the racing line
 * with a glowing arch between them. The arch dims once the checkpoint has
 * been collected for the current lap.
 */
export class CheckpointMarker {
  readonly group = new THREE.Group();
  private readonly arch: THREE.Mesh;
  private readonly archMat: THREE.MeshStandardMaterial;

  /** Whether this checkpoint has been hit on the current lap. */
  active = true;

  constructor(public readonly checkpoint: Checkpoint, scene: THREE.Scene) {
    const pylonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    this.archMat = new THREE.MeshStandardMaterial({
      color: 0x44ddff,
      emissive: 0x44ddff,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    // Pylons sit at the long-axis ends of the checkpoint rectangle.
    const long = checkpoint.halfX > checkpoint.halfZ ? 'x' : 'z';
    const halfLong = long === 'x' ? checkpoint.halfX : checkpoint.halfZ;
    const pylonGeo = new THREE.CylinderGeometry(0.18, 0.18, 4, 8);
    for (const sign of [-1, 1]) {
      const pylon = new THREE.Mesh(pylonGeo, pylonMat);
      pylon.position.set(
        checkpoint.cx + (long === 'x' ? sign * halfLong : 0),
        2,
        checkpoint.cz + (long === 'z' ? sign * halfLong : 0),
      );
      pylon.castShadow = true;
      this.group.add(pylon);
    }

    // Arch — a thin glowing plane spanning the two pylons.
    const archWidth = halfLong * 2;
    const archGeo = new THREE.PlaneGeometry(archWidth, 3.2);
    this.arch = new THREE.Mesh(archGeo, this.archMat);
    this.arch.position.set(checkpoint.cx, 2.4, checkpoint.cz);
    if (long === 'z') this.arch.rotation.y = Math.PI / 2;
    this.group.add(this.arch);

    scene.add(this.group);
  }

  /**
   * Set whether the checkpoint is the current target.
   *  - `'next'`  — bright cyan target arch
   *  - `'past'`  — dim white, already passed this lap
   *  - `'future'`— hidden until earlier checkpoints are claimed
   */
  setStatus(status: 'next' | 'past' | 'future'): void {
    if (status === 'next') {
      this.archMat.color.setHex(0x44ddff);
      this.archMat.emissive.setHex(0x44ddff);
      this.archMat.emissiveIntensity = 1.2;
      this.archMat.opacity = 0.55;
    } else if (status === 'past') {
      this.archMat.color.setHex(0x222222);
      this.archMat.emissive.setHex(0x000000);
      this.archMat.emissiveIntensity = 0;
      this.archMat.opacity = 0.15;
    } else {
      this.archMat.color.setHex(0x666666);
      this.archMat.emissive.setHex(0x222222);
      this.archMat.emissiveIntensity = 0.2;
      this.archMat.opacity = 0.25;
    }
    this.archMat.needsUpdate = true;
  }
}