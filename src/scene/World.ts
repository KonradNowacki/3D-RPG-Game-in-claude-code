import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Owns the Three.js scene, camera, renderer, lighting, sky, and ground —
 * everything that is purely "world dressing" rather than gameplay.
 *
 * The chase camera (`followCar`) lerps toward an offset behind the car so
 * the view is stable through hard turns instead of snapping.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  /** Smoothed camera state — kept across frames for damping. */
  private readonly camPosTarget = new THREE.Vector3();
  private readonly camLookTarget = new THREE.Vector3();
  private readonly camPosCurrent = new THREE.Vector3();
  private readonly camLookCurrent = new THREE.Vector3();
  private camInitialized = false;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 4000);

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.buildScene();
  }

  private buildScene(): void {
    // Lighting
    this.scene.add(new THREE.AmbientLight(0xd0e8ff, 1.0));

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.6);
    sun.position.set(80, 140, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    // Shadow frustum sized to cover the whole 130m-diameter track.
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -120;
    sun.shadow.camera.right = 120;
    sun.shadow.camera.top = 120;
    sun.shadow.camera.bottom = -120;
    this.scene.add(sun);

    // Ground — 300×300 m so the player never sees the edge from on-track.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshStandardMaterial({ map: this.makeGrassTex(), roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Sky
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

    // Subtle distance fog tuned for the larger world.
    this.scene.fog = new THREE.Fog(0xd4eaf7, 120, 500);
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
    tex.repeat.set(150, 150);
    return tex;
  }

  /**
   * Smooth chase camera. Sits behind the car (along its yaw) and slightly above,
   * with exponential damping toward the target so the view doesn't whip during turns.
   *
   * @param target  Car world position.
   * @param yaw     Car yaw in radians.
   * @param dt      Delta time (seconds) — used for frame-rate-independent damping.
   */
  followCar(target: THREE.Vector3, yaw: number, dt: number): void {
    const offset = new THREE.Vector3(0, 4.5, 11);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.camPosTarget.copy(target).add(offset);
    this.camLookTarget.copy(target).add(new THREE.Vector3(0, 1.2, 0));

    if (!this.camInitialized) {
      this.camPosCurrent.copy(this.camPosTarget);
      this.camLookCurrent.copy(this.camLookTarget);
      this.camInitialized = true;
    } else {
      // Frame-rate-independent exponential smoothing.
      // alpha = 1 - exp(-dt / tau). Position lags slightly more than look.
      const posAlpha = 1 - Math.exp(-dt / 0.15);
      const lookAlpha = 1 - Math.exp(-dt / 0.10);
      this.camPosCurrent.lerp(this.camPosTarget, posAlpha);
      this.camLookCurrent.lerp(this.camLookTarget, lookAlpha);
    }

    this.camera.position.copy(this.camPosCurrent);
    this.camera.lookAt(this.camLookCurrent);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}