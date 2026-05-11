import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Owns the Three.js scene, two cameras for split-screen, the renderer, lighting,
 * sky, and ground. The split is vertical (left half = player 1, right half = player 2).
 *
 * Each chase camera (`followCar1` / `followCar2`) lerps toward an offset behind
 * its car for stable cornering. `render()` draws the scene twice into two
 * viewports using scissor clipping.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera1: THREE.PerspectiveCamera;  // Player 1 (left half)
  readonly camera2: THREE.PerspectiveCamera;  // Player 2 (right half)
  readonly renderer: THREE.WebGLRenderer;

  // Smoothed chase state per camera
  private readonly cam1PosTarget = new THREE.Vector3();
  private readonly cam1LookTarget = new THREE.Vector3();
  private readonly cam1PosCurrent = new THREE.Vector3();
  private readonly cam1LookCurrent = new THREE.Vector3();
  private cam1Initialized = false;

  private readonly cam2PosTarget = new THREE.Vector3();
  private readonly cam2LookTarget = new THREE.Vector3();
  private readonly cam2PosCurrent = new THREE.Vector3();
  private readonly cam2LookCurrent = new THREE.Vector3();
  private cam2Initialized = false;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Half-width aspect ratio for the split-screen views
    const halfAspect = (innerWidth / 2) / innerHeight;
    this.camera1 = new THREE.PerspectiveCamera(70, halfAspect, 0.1, 4000);
    this.camera2 = new THREE.PerspectiveCamera(70, halfAspect, 0.1, 4000);

    window.addEventListener('resize', () => {
      const aspect = (innerWidth / 2) / innerHeight;
      this.camera1.aspect = aspect;
      this.camera2.aspect = aspect;
      this.camera1.updateProjectionMatrix();
      this.camera2.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.buildScene();
  }

  private buildScene(): void {
    this.scene.add(new THREE.AmbientLight(0xd0e8ff, 1.0));

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.6);
    sun.position.set(300, 500, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 2000;
    sun.shadow.camera.left = -600;
    sun.shadow.camera.right = 600;
    sun.shadow.camera.top = 600;
    sun.shadow.camera.bottom = -600;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1500, 1500),
      new THREE.MeshStandardMaterial({ map: this.makeGrassTex(), roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const sky = new Sky();
    sky.scale.setScalar(450000);
    this.scene.add(sky);
    const sunDir = new THREE.Vector3();
    sunDir.setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(50),
      THREE.MathUtils.degToRad(45),
    );
    const u = sky.material.uniforms;
    u['sunPosition'].value.copy(sunDir);
    u['turbidity'].value = 5;
    u['rayleigh'].value = 1.2;
    u['mieCoefficient'].value = 0.004;
    u['mieDirectionalG'].value = 0.82;

    this.scene.background = new THREE.Color(0x8ecae6);
    this.scene.fog = new THREE.Fog(0xd4eaf7, 400, 1800);
  }

  private makeGrassTex(): THREE.CanvasTexture {
    const size = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#4a8c50';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 25 + Math.random() * 35;
      const g = 90 + Math.random() * 70;
      const b = 20 + Math.random() * 25;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 3 + Math.random() * 7);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(750, 750);
    return tex;
  }

  /** Smooth chase camera for Player 1 (left viewport). */
  followCar1(target: THREE.Vector3, yaw: number, dt: number): void {
    const offset = new THREE.Vector3(0, 2.5, 6);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.cam1PosTarget.copy(target).add(offset);
    this.cam1LookTarget.copy(target).add(new THREE.Vector3(0, 1.0, 0));

    if (!this.cam1Initialized) {
      this.cam1PosCurrent.copy(this.cam1PosTarget);
      this.cam1LookCurrent.copy(this.cam1LookTarget);
      this.cam1Initialized = true;
    } else {
      const posAlpha = 1 - Math.exp(-dt / 0.15);
      const lookAlpha = 1 - Math.exp(-dt / 0.10);
      this.cam1PosCurrent.lerp(this.cam1PosTarget, posAlpha);
      this.cam1LookCurrent.lerp(this.cam1LookTarget, lookAlpha);
    }

    this.camera1.position.copy(this.cam1PosCurrent);
    this.camera1.lookAt(this.cam1LookCurrent);
  }

  /** Smooth chase camera for Player 2 (right viewport). */
  followCar2(target: THREE.Vector3, yaw: number, dt: number): void {
    const offset = new THREE.Vector3(0, 2.5, 6);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.cam2PosTarget.copy(target).add(offset);
    this.cam2LookTarget.copy(target).add(new THREE.Vector3(0, 1.0, 0));

    if (!this.cam2Initialized) {
      this.cam2PosCurrent.copy(this.cam2PosTarget);
      this.cam2LookCurrent.copy(this.cam2LookTarget);
      this.cam2Initialized = true;
    } else {
      const posAlpha = 1 - Math.exp(-dt / 0.15);
      const lookAlpha = 1 - Math.exp(-dt / 0.10);
      this.cam2PosCurrent.lerp(this.cam2PosTarget, posAlpha);
      this.cam2LookCurrent.lerp(this.cam2LookTarget, lookAlpha);
    }

    this.camera2.position.copy(this.cam2PosCurrent);
    this.camera2.lookAt(this.cam2LookCurrent);
  }

  /** Render the scene twice, into left and right viewports for split-screen. */
  render(): void {
    const w = innerWidth;
    const h = innerHeight;
    const halfW = Math.floor(w / 2);

    this.renderer.setScissorTest(true);

    // ── Left half: Player 1 ──
    this.renderer.setViewport(0, 0, halfW, h);
    this.renderer.setScissor(0, 0, halfW, h);
    this.renderer.render(this.scene, this.camera1);

    // ── Right half: Player 2 ──
    this.renderer.setViewport(halfW, 0, w - halfW, h);
    this.renderer.setScissor(halfW, 0, w - halfW, h);
    this.renderer.render(this.scene, this.camera2);

    this.renderer.setScissorTest(false);
  }
}
