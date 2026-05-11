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
  /** Active braking deceleration (m/s²) — skill: 1.2g (carbon ceramic). */
  brakeDecel: number;
  /** Reverse acceleration (m/s²) — skill: ~0.25g smooth creep. */
  reverseAccel: number;
  /** Natural rolling resistance (m/s²) — applied opposite to motion when coasting. */
  rollingResistance: number;
  /** Extra deceleration applied when off-track (grass: 60% grip loss). */
  offTrackDrag: number;
  /** Top forward speed (m/s) — skill: 250 km/h = 69.4 m/s. */
  maxSpeed: number;
  /** Top reverse speed (m/s) — skill: 30 km/h = 8.3 m/s. */
  maxReverseSpeed: number;
  /** Steering angular velocity (rad/s) at peak responsiveness. */
  turnSpeed: number;
  /** Below this speed (m/s), |speed| is treated as zero for steering. */
  stopThreshold: number;
}

/**
 * Mercedes-AMG GTR specifications per .claude/skills/car/SKILL.md
 * - Top: 250 km/h, Reverse: 30 km/h
 * - Braking 1.2g, Reverse 0.25g
 * - Acceleration is a horsepower-based curve (see `accelAtSpeed`)
 * - Steering is speed-dependent (see `steerMultiplier`)
 */
export const DEFAULT_CAR_PHYSICS: CarPhysicsConfig = {
  // Aggressive arcade-style deceleration (overrides skill's 1.2g brake spec
  // for tighter feel on the larger circuit).
  brakeDecel: 28,          // ~2.85g — powerful brakes (stops from 250 km/h in ~2.5s)
  reverseAccel: 2.45,      // 0.25g
  rollingResistance: 8,    // strong engine braking when coasting
  offTrackDrag: 20,        // grass = significant drag penalty
  maxSpeed: 69.4,          // 250 km/h
  maxReverseSpeed: 8.3,    // 30 km/h
  turnSpeed: 2.2,
  stopThreshold: 0.4,
};

/**
 * 500 HP horsepower-based acceleration curve (skill spec):
 *   0 km/h:   0.75g (7.35 m/s²)
 *   100 km/h: 0.6g  (5.88 m/s²)
 *   150 km/h: 0.4g  (3.92 m/s²)
 *   200 km/h: 0.2g  (1.96 m/s²)
 *   250 km/h: 0.0g  (top speed)
 *
 * Linearly interpolated between data points.
 * Exported for test access.
 */
export function accelAtSpeed(speedMs: number, maxSpeed: number = 69.4): number {
  if (speedMs <= 0) return 7.35;
  if (speedMs >= maxSpeed) return 0;
  // (speed_m_s, accel_m_s²) data points
  const pts: [number, number][] = [
    [0,     7.35],  // 0 km/h
    [27.78, 5.88],  // 100 km/h
    [41.67, 3.92],  // 150 km/h
    [55.56, 1.96],  // 200 km/h
    [69.4,  0],     // 250 km/h
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    if (speedMs >= pts[i][0] && speedMs < pts[i + 1][0]) {
      const t = (speedMs - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
      return pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
    }
  }
  return 0;
}

/**
 * Speed-dependent steering response (skill spec):
 *   0-20 km/h:   0    (no steering — power steering deadzone)
 *   20-100 km/h: 1.0  (full response)
 *   100-200 km/h: linear 1.0 → 0.8
 *   200-250 km/h: linear 0.8 → 0.4
 *
 * Exported for test access.
 */
export function steerMultiplier(speedMs: number): number {
  const kmh = Math.abs(speedMs) * 3.6;
  if (kmh < 20) return 0;
  if (kmh <= 100) return 1.0;
  if (kmh <= 200) return 1.0 - 0.2 * (kmh - 100) / 100;   // 1.0 → 0.8
  if (kmh <= 250) return 0.8 - 0.4 * (kmh - 200) / 50;    // 0.8 → 0.4
  return 0.4;
}

/**
 * Pure car physics — owns position, yaw, and forward speed.
 *
 * Implements Mercedes-AMG GTR specs from .claude/skills/car/SKILL.md.
 * Exposes only Three.js math types so it runs in vitest/jsdom without a renderer.
 *
 * Control scheme:
 *   - W: throttle (forward, follows HP curve)
 *   - S: brake while moving forward; reverse once stopped
 *   - A/D: steer (response scales with speed, deadzone below 20 km/h)
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
   * Convention: yaw=0 -> facing -Z, matching Three.js default camera/forward.
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

    // ── Longitudinal force (throttle, brake, reverse, coast) ─────────────
    if (throttle) {
      // HP-based curve: acceleration drops as speed approaches max
      this.speed += accelAtSpeed(this.speed, p.maxSpeed) * dt;
    } else if (brakeOrReverse) {
      if (this.speed > p.stopThreshold) {
        // Moving forward → S brakes (1.2g carbon ceramic)
        this.speed -= p.brakeDecel * dt;
        if (this.speed < 0) this.speed = 0; // brake never flips into reverse in one step
      } else {
        // Stopped or already reversing → S reverses (0.25g smooth creep)
        this.speed -= p.reverseAccel * dt;
      }
    } else {
      // Coast — apply rolling resistance toward zero
      const rr = p.rollingResistance * dt;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - rr);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + rr);
      }
    }

    // ── Off-track drag (grass = 40% grip per skill) ──────────────────────
    if (!onTrack) {
      const drag = p.offTrackDrag * dt;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - drag);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + drag);
      }
    }

    // ── Speed clamps ─────────────────────────────────────────────────────
    if (this.speed > p.maxSpeed) this.speed = p.maxSpeed;
    if (this.speed < -p.maxReverseSpeed) this.speed = -p.maxReverseSpeed;

    // ── Steering (speed-dependent response, deadzone below 20 km/h) ──────
    const responseMul = steerMultiplier(this.speed);
    const direction = this.speed >= 0 ? 1 : -1;
    let steer = 0;
    if (steerLeft) steer += 1;
    if (steerRight) steer -= 1;
    this.yaw += steer * p.turnSpeed * responseMul * direction * dt;

    // ── Integrate position ───────────────────────────────────────────────
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
  }
}
