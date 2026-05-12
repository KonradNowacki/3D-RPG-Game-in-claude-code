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
  // Aggressive arcade-style accel/brake (overrides skill's 1.2g brake spec
  // and HP curve for tighter feel on the larger circuit).
  brakeDecel: 40,          // ~4g — extreme arcade braking (250 km/h → 0 in ~1.7s)
  reverseAccel: 2.45,      // 0.25g
  rollingResistance: 10,   // strong engine braking when coasting
  offTrackDrag: 40,        // pulls car down to grass cap when above it (~1s from top speed)
  maxSpeed: 69.4,          // 250 km/h
  maxReverseSpeed: 8.3,    // 30 km/h
  turnSpeed: 1.5,          // smoother yaw rate (was 2.2 — less twitchy)
  stopThreshold: 0.4,
};

/** Speed cap (m/s ≈ 30 km/h) for either direction when off-track. */
export const GRASS_MAX_SPEED = 8.3;

/**
 * Aggressive arcade acceleration curve (overrides skill's 500 HP spec for
 * more dramatic launch feel). Roughly 2× the skill values at low speed,
 * still asymptotes to 0 at top speed.
 *   0 km/h:   ~1.5g  (14.7 m/s²)
 *   100 km/h: ~1.1g  (11.0 m/s²)
 *   150 km/h: ~0.7g  (7.0  m/s²)
 *   200 km/h: ~0.36g (3.5  m/s²)
 *   250 km/h: 0g     (top speed)
 *
 * Linearly interpolated between data points.
 * Exported for test access.
 */
export function accelAtSpeed(speedMs: number, maxSpeed: number = 69.4): number {
  if (speedMs <= 0) return 14.7;
  if (speedMs >= maxSpeed) return 0;
  const pts: [number, number][] = [
    [0,     14.7],
    [27.78, 11.0],
    [41.67,  7.0],
    [55.56,  3.5],
    [69.4,   0],
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
 * Speed-dependent steering response — smoother / more permissive than the
 * skill spec. Tiny deadzone only at literal standstill, then a gradual ramp
 * so steering is usable at very low speeds. Combined with the reduced
 * `turnSpeed`, this gives a less twitchy feel.
 *   0 km/h:        0     (deadzone — stationary car can't pivot)
 *   1-50 km/h:     linear 0 → 1.0  (slow turn at crawl speed, full at 50 km/h)
 *   50-150 km/h:   1.0   (full response — primary racing range)
 *   150-250 km/h:  linear 1.0 → 0.4  (taper for high-speed stability)
 *
 * Exported for test access.
 */
export function steerMultiplier(speedMs: number): number {
  const kmh = Math.abs(speedMs) * 3.6;
  if (kmh < 0.5) return 0;
  if (kmh <= 50) return kmh / 50;                          // 0 → 1.0
  if (kmh <= 150) return 1.0;
  if (kmh <= 250) return 1.0 - 0.6 * (kmh - 150) / 100;    // 1.0 → 0.4
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
  /**
   * Continuous time (seconds) the driver has been holding a steering input.
   * Resets to 0 when no steering key is pressed. Used to ramp up cornering
   * drag — the longer the player holds the steering, the more longitudinal
   * speed bleed they get (encourages early apex release).
   */
  steerHoldTime = 0;

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

    // ── Off-track grass cap ──────────────────────────────────────────────
    // Cars can still drive, stop, and reverse on grass — they just can't go
    // faster than GRASS_MAX_SPEED. If the player arrives on grass at high
    // speed from the track, drag pulls them down to the cap.
    if (!onTrack) {
      const drag = p.offTrackDrag * dt;
      if (this.speed > GRASS_MAX_SPEED) {
        this.speed = Math.max(GRASS_MAX_SPEED, this.speed - drag);
      } else if (this.speed < -GRASS_MAX_SPEED) {
        this.speed = Math.min(-GRASS_MAX_SPEED, this.speed + drag);
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

    // ── Cornering drag: holding steering bleeds longitudinal speed ───────
    // Ramps up the longer the steering is held (encourages clean apex release).
    // Capped so it can't dominate normal driving.
    const STEER_DRAG_RATE = 3;   // m/s² added per second of held steering
    const MAX_STEER_DRAG = 5;    // m/s² (~0.5g cap)
    if ((steerLeft || steerRight) && Math.abs(this.speed) > p.stopThreshold) {
      this.steerHoldTime += dt;
      const drag = Math.min(MAX_STEER_DRAG, this.steerHoldTime * STEER_DRAG_RATE) * dt;
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - drag);
      } else {
        this.speed = Math.min(0, this.speed + drag);
      }
    } else {
      this.steerHoldTime = 0;
    }

    // ── Integrate position ───────────────────────────────────────────────
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    this.position.x += fx * this.speed * dt;
    this.position.z += fz * this.speed * dt;
  }
}
