import * as THREE from 'three';
import type { Platform, FinishZone } from '../core/types';

export class Level1 {
  readonly platforms: Platform[] = [];
  readonly finishZone: FinishZone;
  readonly coinPositions: [number, number, number][] = [];

  constructor(scene: THREE.Scene) {
    this.setupPlatforms();
    this.setupGeometry(scene);
    this.setupCoinPositions();
    this.finishZone = {
      minX: -2.0, maxX: 2.0,
      minZ: 7.5, maxZ: 9.0,
      minY: 1.4,
    };
  }

  private setupPlatforms(): void {
    this.platforms.push(
      // Main ground before lava gap (100×100 world)
      { minX: -50, maxX: 50, minZ: -50, maxZ: 1.5, topY: 0 },

      // Stair steps
      { minX: -1.5, maxX: 1.5, minZ: -3.5, maxZ: -2.0, topY: 0.5 },
      { minX: -1.5, maxX: 1.5, minZ: -2.0, maxZ: -0.5, topY: 1.0 },
      { minX: -1.5, maxX: 1.5, minZ: -0.5, maxZ: 1.0, topY: 1.5 },

      // Air platforms over lava
      { minX: -1.5, maxX: 1.5, minZ: 2.0, maxZ: 3.5, topY: 1.5 },
      { minX: -1.0, maxX: 1.0, minZ: 4.0, maxZ: 5.0, topY: 2.0 },
      { minX: -1.5, maxX: 1.5, minZ: 5.5, maxZ: 7.0, topY: 1.5 },

      // Finish platform
      { minX: -2.0, maxX: 2.0, minZ: 7.5, maxZ: 9.0, topY: 1.5 },
    );
  }

  private setupGeometry(scene: THREE.Scene): void {
    const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6914 });
    const finishMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aa00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5,
    });

    // Stair step 1 (0.5m high)
    const step1Geo = new THREE.BoxGeometry(3, 0.5, 1.5);
    const step1 = new THREE.Mesh(step1Geo, stoneMaterial);
    step1.position.set(0, 0.25, -2.75);
    step1.castShadow = true;
    scene.add(step1);

    // Stair step 2 (1.0m high)
    const step2Geo = new THREE.BoxGeometry(3, 1.0, 1.5);
    const step2 = new THREE.Mesh(step2Geo, stoneMaterial);
    step2.position.set(0, 0.5, -1.25);
    step2.castShadow = true;
    scene.add(step2);

    // Stair step 3 (1.5m high)
    const step3Geo = new THREE.BoxGeometry(3, 1.5, 1.5);
    const step3 = new THREE.Mesh(step3Geo, stoneMaterial);
    step3.position.set(0, 0.75, 0.25);
    step3.castShadow = true;
    scene.add(step3);

    // Air platform A
    const platAGeo = new THREE.BoxGeometry(3, 0.2, 1.5);
    const platA = new THREE.Mesh(platAGeo, woodMaterial);
    platA.position.set(0, 1.4, 2.75);
    platA.castShadow = true;
    scene.add(platA);

    // Air platform B (higher)
    const platBGeo = new THREE.BoxGeometry(2, 0.2, 1);
    const platB = new THREE.Mesh(platBGeo, woodMaterial);
    platB.position.set(0, 1.9, 4.5);
    platB.castShadow = true;
    scene.add(platB);

    // Air platform C
    const platCGeo = new THREE.BoxGeometry(3, 0.2, 1.5);
    const platC = new THREE.Mesh(platCGeo, woodMaterial);
    platC.position.set(0, 1.4, 6.25);
    platC.castShadow = true;
    scene.add(platC);

    // Finish platform
    const finishGeo = new THREE.BoxGeometry(4, 0.2, 1.5);
    const finish = new THREE.Mesh(finishGeo, finishMaterial);
    finish.position.set(0, 1.4, 8.25);
    finish.castShadow = true;
    scene.add(finish);

    // Lava visual (in the gap)
    const lavaGeo = new THREE.PlaneGeometry(20, 6);
    const lavaMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 1.5,
      side: THREE.DoubleSide,
    });
    const lava = new THREE.Mesh(lavaGeo, lavaMaterial);
    lava.rotation.x = -Math.PI / 2;
    lava.position.set(0, -0.5, 4.25);
    scene.add(lava);

    // Finish pole (visual landmark)
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
    const pole = new THREE.Mesh(poleGeo, poleMaterial);
    pole.position.set(0, 2.2, 8.25);
    pole.castShadow = true;
    scene.add(pole);

    // Finish flag
    const flagGeo = new THREE.BoxGeometry(0.4, 0.3, 0.15);
    const flag = new THREE.Mesh(flagGeo, poleMaterial);
    flag.position.set(0.25, 2.65, 8.25);
    flag.castShadow = true;
    scene.add(flag);
  }

  private setupCoinPositions(): void {
    this.coinPositions.push(
      // On stairs (3 coins)
      [0, 1.2, -2.75],
      [0, 1.7, -1.25],
      [0, 2.2, 0.25],

      // On air platforms (3 coins)
      [0, 2.2, 2.75],
      [0, 2.7, 4.5],
      [0, 2.2, 6.25],

      // On finish platform (4 coins)
      [-0.7, 2.2, 7.8],
      [0.7, 2.2, 7.8],
      [-0.7, 2.2, 8.5],
      [0.7, 2.2, 8.5],
    );
  }
}