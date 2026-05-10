import * as THREE from 'three';
import type { Input } from '../core/Input';

const SPEED = 5;
const TURN_SPEED = 2.2;
const JUMP_VEL = 7;
const GRAVITY = -22;
const GROUND_Y = 0;
const BOUND = 9.4;

export class Player {
  readonly group = new THREE.Group();

  private vel = new THREE.Vector3();
  private onGround = true;
  private walkPhase = 0;

  private leftLegPivot: THREE.Group;
  private rightLegPivot: THREE.Group;
  private leftArmPivot: THREE.Group;
  private rightArmPivot: THREE.Group;

  constructor() {
    const skin  = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x3a7bd5 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x22306e });
    const shoe  = new THREE.MeshStandardMaterial({ color: 0x222222 });

    // ── Head ──────────────────────────────────────────────────
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.30), skin);
    head.position.set(0, 1.50, 0);
    head.castShadow = true;

    // ── Torso ─────────────────────────────────────────────────
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.58, 0.22), shirt);
    torso.position.set(0, 1.01, 0);
    torso.castShadow = true;

    // ── Legs (pivoting at hips) ────────────────────────────────
    this.leftLegPivot  = new THREE.Group();
    this.rightLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.13, 0.72, 0);
    this.rightLegPivot.position.set( 0.13, 0.72, 0);

    for (const [pivot, sign] of [[this.leftLegPivot, -1], [this.rightLegPivot, 1]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.65, 0.20), pants);
      leg.position.y = -0.325;
      leg.castShadow = true;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.10, 0.28), shoe);
      foot.position.set(0, -0.68, 0.06);
      leg.add(foot);
      void sign;
      pivot.add(leg);
    }

    // ── Arms (pivoting at shoulders) ──────────────────────────
    this.leftArmPivot  = new THREE.Group();
    this.rightArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.31, 1.27, 0);
    this.rightArmPivot.position.set( 0.31, 1.27, 0);

    for (const pivot of [this.leftArmPivot, this.rightArmPivot]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.52, 0.16), skin);
      arm.position.y = -0.26;
      arm.castShadow = true;
      pivot.add(arm);
    }

    this.group.add(
      head, torso,
      this.leftLegPivot, this.rightLegPivot,
      this.leftArmPivot, this.rightArmPivot,
    );
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get yaw(): number {
    return this.group.rotation.y;
  }

  update(dt: number, input: Input) {
    // ── Turning ───────────────────────────────────────────────
    if (input.isDown('a')) this.group.rotation.y += TURN_SPEED * dt;
    if (input.isDown('d')) this.group.rotation.y -= TURN_SPEED * dt;

    // ── Horizontal movement ───────────────────────────────────
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(this.group.rotation);
    let moving = false;

    if (input.isDown('w')) {
      this.vel.x = forward.x * SPEED;
      this.vel.z = forward.z * SPEED;
      moving = true;
    } else if (input.isDown('s')) {
      this.vel.x = -forward.x * SPEED;
      this.vel.z = -forward.z * SPEED;
      moving = true;
    } else {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    // ── Jump ──────────────────────────────────────────────────
    if (input.isDown(' ') && this.onGround) {
      this.vel.y = JUMP_VEL;
      this.onGround = false;
    }

    // ── Gravity ───────────────────────────────────────────────
    if (!this.onGround) {
      this.vel.y += GRAVITY * dt;
    }

    // ── Integrate ─────────────────────────────────────────────
    this.group.position.addScaledVector(this.vel, dt);

    // ── Ground collision ──────────────────────────────────────
    if (this.group.position.y <= GROUND_Y) {
      this.group.position.y = GROUND_Y;
      this.vel.y = 0;
      this.onGround = true;
    }

    // ── World boundary ────────────────────────────────────────
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -BOUND, BOUND);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -BOUND, BOUND);

    // ── Walk animation ────────────────────────────────────────
    this.animate(dt, moving);
  }

  private animate(dt: number, moving: boolean) {
    if (moving) {
      this.walkPhase += dt * 7;
    } else {
      this.walkPhase *= Math.pow(0.001, dt); // fast decay to 0
    }
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.leftLegPivot.rotation.x  =  swing;
    this.rightLegPivot.rotation.x = -swing;
    this.leftArmPivot.rotation.x  = -swing * 0.55;
    this.rightArmPivot.rotation.x =  swing * 0.55;
  }
}
