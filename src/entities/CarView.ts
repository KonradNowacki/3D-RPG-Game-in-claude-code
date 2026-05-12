import * as THREE from 'three';
import type { Car } from './Car';

/**
 * Renderable shell around a `Car` logic instance.
 *
 * The view owns the Three.js group hierarchy (body, cabin, wheels, spoiler,
 * mirrors, glass) and copies position + yaw from the logic each frame. It
 * also spins the wheels in proportion to the car's forward speed.
 *
 * Splitting it from `Car` keeps the physics testable with no GPU/canvas.
 *
 * NOTE: This is a procedural model built from primitives. For higher-fidelity
 * visuals, swap this for a GLTF/GLB model loader (e.g., GLTFLoader) and a
 * downloaded model (Sketchfab has free CC-licensed AMG GTR models, ~5-15 MB).
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
      roughness: 0.32,
      metalness: 0.55,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.45,
      metalness: 0.4,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      roughness: 0.18,
      metalness: 0.95,
      transparent: true,
      opacity: 0.7,
    });
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a22,
      roughness: 0.4,
      metalness: 0.55,
    });
    const tyreMat = new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 0.95,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xcfcfcf,
      roughness: 0.25,
      metalness: 0.9,
    });
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.3,
      metalness: 0.95,
    });

    // ── Main chassis (slightly tapered using multiple boxes) ──────────────
    // Lower body — wider, lower (Z extends front to back along -Z to +Z)
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.45, 4.4), bodyMat);
    lower.position.y = 0.5;
    lower.castShadow = true;
    lower.receiveShadow = true;
    this.group.add(lower);

    // Front nose — tapered using a small wedge box
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.35, 0.6), bodyMat);
    nose.position.set(0, 0.48, -2.4);
    nose.castShadow = true;
    this.group.add(nose);

    // Hood / front deck
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.7), bodyMat);
    hood.position.set(0, 0.82, -1.1);
    hood.castShadow = true;
    this.group.add(hood);

    // Rear deck
    const rear = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.18, 1.5), bodyMat);
    rear.position.set(0, 0.82, 1.2);
    rear.castShadow = true;
    this.group.add(rear);

    // ── Cabin (greenhouse) ────────────────────────────────────────────────
    // Solid cabin frame
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 2.0), cabinMat);
    cabin.position.set(0, 1.18, 0);
    cabin.castShadow = true;
    this.group.add(cabin);

    // Windshield (front glass, slightly tilted)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.7), glassMat);
    windshield.position.set(0, 1.18, -1.0);
    windshield.rotation.x = THREE.MathUtils.degToRad(-25);
    this.group.add(windshield);

    // Rear window
    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.6), glassMat);
    rearGlass.position.set(0, 1.18, 1.0);
    rearGlass.rotation.x = THREE.MathUtils.degToRad(28);
    rearGlass.rotation.y = Math.PI;
    this.group.add(rearGlass);

    // Side windows
    for (const sx of [-1, 1]) {
      const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.4), glassMat);
      sideGlass.position.set(sx * 0.83, 1.25, 0);
      sideGlass.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(sideGlass);
    }

    // ── Side mirrors ──────────────────────────────────────────────────────
    for (const sx of [-1, 1]) {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.25), bodyMat);
      mirror.position.set(sx * 1.0, 1.05, -0.4);
      mirror.castShadow = true;
      this.group.add(mirror);
    }

    // ── Rear spoiler ──────────────────────────────────────────────────────
    // Two struts
    for (const sx of [-0.65, 0.65]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.08), accentMat);
      strut.position.set(sx, 1.05, 1.85);
      strut.castShadow = true;
      this.group.add(strut);
    }
    // Wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.4), accentMat);
    wing.position.set(0, 1.2, 1.85);
    wing.castShadow = true;
    this.group.add(wing);

    // ── Headlights ────────────────────────────────────────────────────────
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xfff6c8,
      emissive: 0xfff0a0,
      emissiveIntensity: 0.9,
    });
    for (const sx of [-0.65, 0.65]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.08), lightMat);
      light.position.set(sx, 0.62, -2.65);
      this.group.add(light);
    }

    // ── Tail lights (strip across the back) ───────────────────────────────
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xaa1010,
      emissive: 0xff2020,
      emissiveIntensity: 0.7,
    });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.06), tailMat);
    tailBar.position.set(0, 0.78, 2.05);
    this.group.add(tailBar);

    // ── Front splitter / lower lip ────────────────────────────────────────
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 0.4), accentMat);
    splitter.position.set(0, 0.18, -2.4);
    this.group.add(splitter);

    // ── Exhaust pipes ─────────────────────────────────────────────────────
    for (const sx of [-0.5, 0.5]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12),
        exhaustMat,
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, 0.28, 2.18);
      this.group.add(pipe);
    }

    // ── Wheels (with wheel arches / fenders) ──────────────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 18);
    const wheelOffsets: [number, number][] = [
      [-1.05, -1.45], [1.05, -1.45],   // front
      [-1.05, 1.45],  [1.05, 1.45],    // rear
    ];
    for (const [x, z] of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, tyreMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.42, z);
      wheel.castShadow = true;

      // Multi-spoke hub for better look
      const hubBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.37, 18),
        rimMat,
      );
      hubBase.rotation.z = Math.PI / 2;
      hubBase.position.x = x > 0 ? 0.005 : -0.005;
      wheel.add(hubBase);

      // 5-spoke pattern (thin boxes)
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.36, 0.06),
          rimMat,
        );
        spoke.rotation.x = (s / 5) * Math.PI * 2;
        spoke.position.x = x > 0 ? 0.005 : -0.005;
        wheel.add(spoke);
      }

      this.wheels.push(wheel);
      this.group.add(wheel);

      // Wheel arch (fender) — small box rising above the wheel
      const arch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.0), bodyMat);
      arch.position.set(x, 0.85, z);
      arch.castShadow = true;
      this.group.add(arch);
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
