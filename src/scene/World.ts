import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class World {
  readonly scene    = new THREE.Scene();
  readonly camera   : THREE.PerspectiveCamera;
  readonly renderer : THREE.WebGLRenderer;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.buildScene();
  }

  private buildScene() {
    // Lighting
    this.scene.add(new THREE.AmbientLight(0xd0e8ff, 1.2));

    const sun = new THREE.DirectionalLight(0xfff5e0, 2.8);
    sun.position.set(40, 80, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near   =  1;
    sun.shadow.camera.far    = 200;
    sun.shadow.camera.left   = -60;
    sun.shadow.camera.right  =  60;
    sun.shadow.camera.top    =  60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);

    // Ground — 100×100 m
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
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
      THREE.MathUtils.degToRad(50),  // 40° elevation (50° from zenith)
      THREE.MathUtils.degToRad(45),  // azimuth
    );
    const u = sky.material.uniforms;
    u['sunPosition'].value.copy(sunDir);
    u['turbidity'].value        = 5;
    u['rayleigh'].value         = 1.2;
    u['mieCoefficient'].value   = 0.004;
    u['mieDirectionalG'].value  = 0.82;

    // Scene background tone (for when sky isn't covering, e.g. reflections)
    this.scene.background = new THREE.Color(0x8ecae6);

    // Clouds
    this.addClouds();

    // Subtle distance fog
    this.scene.fog = new THREE.Fog(0xd4eaf7, 50, 200);
  }

  private makeGrassTex(): THREE.CanvasTexture {
    const size = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;

    // Base green
    ctx.fillStyle = '#4a8c50';
    ctx.fillRect(0, 0, size, size);

    // Grass blades / variation
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 25 + Math.random() * 35;
      const g = 90 + Math.random() * 70;
      const b = 20 + Math.random() * 25;
      ctx.fillStyle = `rgb(${r|0},${g|0},${b|0})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 3 + Math.random() * 7);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(50, 50);
    return tex;
  }

  private addClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const configs: [number, number, number][] = [
      [-6, 13, -7], [4, 15, -10], [9, 12, 4], [-9, 14, 6], [1, 16, 1], [6, 13, -3],
    ];
    for (const [cx, cy, cz] of configs) {
      const cloud = new THREE.Group();
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const blob = new THREE.Mesh(
          new THREE.SphereGeometry(0.7 + Math.random() * 0.7, 6, 5),
          mat,
        );
        blob.position.set(
          (Math.random() - 0.5) * 3.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 1.5,
        );
        blob.scale.set(1.6 + Math.random(), 0.55 + Math.random() * 0.3, 1.1 + Math.random() * 0.5);
        cloud.add(blob);
      }
      cloud.position.set(cx, cy, cz);
      this.scene.add(cloud);
    }
  }

  followCamera(target: THREE.Vector3, yaw: number) {
    const offset = new THREE.Vector3(0, 3.2, 7.5);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.camera.position.copy(target).add(offset);
    this.camera.lookAt(target.clone().setY(target.y + 1.1));
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
