import * as THREE from 'three';
import type { Car } from './Car';

/**
 * Renderable shell around a `Car` logic instance.
 *
 * The view owns the Three.js group hierarchy (body, cabin, wheels) and copies
 * position + yaw from the logic each frame. It also spins the wheels in
 * proportion to the car's forward speed.
 *
 * Splitting it from `Car` keeps the physics testable with no GPU/canvas.
 */
export class CarView {
  readonly group = new THREE.Group();
  private readonly wheels: THREE.Mesh[] = [];

  /**
   * @param car   Car logic instance to mirror.
   * @param color Body color of the car (hex). Defaults to AMG red.
   */
  constructor(private readonly car: Car, private readonly color: number = 0xd92b2b) {
    this.build();
  }

  private build(): void {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.4,
      metalness: 0.3,
    });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a22,
      roughness: 0.2,
      metalness: 0.6,
    });
    const tyreMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.95,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.4,
      metalness: 0.7,
    });

    // ── Lower body ────────────────────────────────────────────
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 4.2), bodyMat);
    lower.position.y = 0.5;
    lower.castShadow = true;
    lower.receiveShadow = true;
    this.group.add(lower);

    // ── Hood / trunk taper (just a slightly smaller mid box) ──
    const upperBase = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.3, 3.6), bodyMat);
    upperBase.position.y = 0.85;
    upperBase.castShadow = true;
    this.group.add(upperBase);

    // ── Cabin ────────────────────────────────────────────────
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 2.0), cabinMat);
    cabin.position.set(0, 1.2, -0.1);
    cabin.castShadow = true;
    this.group.add(cabin);

    // ── Headlights / front bar ───────────────────────────────
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfff6c8,
      emissive: 0xfff0a0,
      emissiveIntensity: 0.6,
    });
    for (const sx of [-0.6, 0.6]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
      light.position.set(sx, 0.6, -2.05);
      this.group.add(light);
    }

    // ── Tail lights ──────────────────────────────────────────
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xaa1010,
      emissive: 0xff2020,
      emissiveIntensity: 0.6,
    });
    for (const sx of [-0.6, 0.6]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), tailMat);
      tail.position.set(sx, 0.6, 2.05);
      this.group.add(tail);
    }

    // ── Wheels ──────────────────────────────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16);
    // Cylinders default to Y axis — rotate so they roll about X.
    const wheelOffsets: [number, number][] = [
      [-1.05, -1.4], [1.05, -1.4],   // front
      [-1.05, 1.4],  [1.05, 1.4],    // rear
    ];
    for (const [x, z] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, tyreMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;

      // Hubcap — small disc inset on the outer face.
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 12), rimMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.x = x > 0 ? 0.02 : -0.02;
      wheel.add(hub);

      this.wheels.push(wheel);
      this.group.add(wheel);
    }
  }

  /** Sync the visual transform from the logic state and spin the wheels. */
  update(dt: number): void {
    this.group.position.copy(this.car.position);
    this.group.rotation.y = this.car.yaw;

    // Spin wheels — angular velocity = linearSpeed / radius.
    const wheelRadius = 0.42;
    const omega = this.car.speed / wheelRadius;
    for (const w of this.wheels) {
      // Wheels are rotated by 90° about Z — local X is now the rolling axis.
      w.rotation.x += omega * dt;
    }
  }
}