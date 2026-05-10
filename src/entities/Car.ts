import * as THREE from 'three';

/**
 * Read-only view of player input that the Car needs.
 * We accept a structural type rather than the concrete `Input` class so the
 * physics is fully testable without a DOM/keyboard event source.
 */
export interface CarInput {
  isDown(key: string): boolean;
}

export interface CarPhysicsConfig {
  /** Forward acceleration (m/s^2) when the throttle is pressed. */
  accel: number;
  /** Reverse acceleration (m/s^2) when reversing from a stop. */
  reverseAccel: number;
  /** Active braking deceleration (m/s^2) when S is pressed while moving forward. */
  brakeDecel: number;
  /** Natural rolling resistance (m/s^2) — applied opposite to motion. */
  rollingResistance: number;
  /** Extra deceleration applied when off-track (soft drag). */
  offTrackDrag: number;
  /** Top forward speed (m/s). */
  maxSpeed: number;
  /** Top reverse speed (m/s). */
  maxReverseSpeed: number;
  /** Steering angular velocity (rad/s) at 1.0 speed factor. */
  turnSpeed: number;
  /** Below this speed (m/s), |speed| is treated as zero for steering & reverse arming. */
  stopThreshold: number;
}

export const DEFAULT_CAR_PHYSICS: CarPhysicsConfig = {
  // 500 HP Mercedes-AMG GTR acceleration curve
  // 0→100 km/h in 3.5s requires ~7.35 m/s² peak acceleration
  accel: 22,
  reverseAccel: 6.5,
  brakeDecel: 32,
  rollingResistance: 4,
  offTrackDrag: 22,
  // 69.4 m/s = 250 km/h — Mercedes-AMG GTR limited top speed
  maxSpeed: 69.4,
  // 8.3 m/s = 30 km/h — smooth reverse, realistic for rear-heavy sports car
  maxReverseSpeed: 8.3,
  turnSpeed: 2.2,
  stopThreshold: 0.4,
};

/**
 * Pure car physics — owns position, yaw, and forward speed.
 *
 * It exposes only Three.js math types (Vector3 / Euler scalars) so it can run
 * inside vitest/jsdom with no renderer or canvas.
 *
 * Control scheme:
 *   - W: throttle (forward)
 *   - S: brake while moving forward; reverse once stopped
 *   - A/D: steer (turning rate scales with |speed|)
 */
export class Car {
  /** World-space position. */
  readonly position = new THREE.Vector3();
  /** Heading on Y axis (radians). 0 means facing -Z (Three.js convention). */
  yaw = 0;
  /** Signed forward speed along the heading (m/s). Negative = reversing. */
  speed = 0;

  constructor(public readonly physics: CarPhysicsConfig = DEFAULT_CAR_PHYSICS) {}

  /**
   * Forward unit vector for the current yaw.
   * Convention: yaw=0 -> facing -Z, matching `Three.js` default camera/forward.
   */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return out;
  }

  /**
   * Step the car physics one frame.
   *
   * @param dt        Delta time in seconds.
   * @param input     Source of held keys.
   * @param onTrack   Whether the car's current position is on tarmac.
   *                  When false, an extra drag is applied (no hard wall).
   */
  update(dt: number, input: CarInput, onTrack: boolean): void {
    const p = this.physics;

    const throttle = input.isDown('w') || input.isDown('arrowup');
    const brakeOrReverse = input.isDown('s') || input.isDown('arrowdown');
    const steerLeft = input.isDown('a') || input.isDown('arrowleft');
    const steerRight = input.isDown('d') || input.isDown('arrowright');

    // ── Longitudinal force ────────────────────────────────────
    // Order matters: throttle wins over brake (held together = creep forward).
    if (throttle) {
      this.speed += p.accel * dt;
    } else if (brakeOrReverse) {
      if (this.speed > p.stopThreshold) {
        // Moving forward → S brakes.
        this.speed -= p.brakeDecel * dt;
        if (this.speed < 0) this.speed = 0; // brake should never flip into reverse in one step
      } else {
        // Stopped or reversing → S reverses.
        this.speed -= p.reverseAccel * dt;
      }
    } else {
      // Coast — apply rolling resistance toward zero.
      const rr = p.rollingResistance * dt;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - rr);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + rr);
      }
    }

    // ── Off-track soft drag ──────────────────────────────────
    if (!onTrack) {
      const drag = p.offTrackDrag * dt;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - drag);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + drag);
      }
    }

    // ── Speed clamps ─────────────────────────────────────────
    if (this.speed > p.maxSpeed) this.speed = p.maxSpeed;
    if (this.speed < -p.maxReverseSpeed) this.speed = -p.maxReverseSpeed;

    // ── Steering ──────────────────────────────────────────────
    // Steering rate scales with |speed| but saturates quickly (sqrt curve)
    // so the car still turns sensibly at low speed even with a 70 m/s top end.
    // It must be 0 at speed=0 (no stationary pivot) and ≤1 at maxSpeed.
    const speedRatio = Math.min(1, Math.abs(this.speed) / p.maxSpeed);
    const speedFactor = Math.sqrt(speedRatio);
    // Reverse: invert steering so the rear tracks naturally.
    const direction = this.speed >= 0 ? 1 : -1;
    let steer = 0;
    if (steerLeft) steer += 1;
    if (steerRight) steer -= 1;
    this.yaw += steer * p.turnSpeed * speedFactor * direction * dt;

    // ── Integrate position ───────────────────────────────────
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
  }
}