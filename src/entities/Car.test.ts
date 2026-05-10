import { describe, it, expect } from 'vitest';
import { Car, DEFAULT_CAR_PHYSICS, type CarInput } from './Car';

/** Tiny stub of the Input contract so the physics can run head-less. */
function makeInput(...keys: string[]): CarInput {
  const set = new Set(keys.map(k => k.toLowerCase()));
  return { isDown: (k: string) => set.has(k.toLowerCase()) };
}

/** Run the car for `seconds` total in fixed dt steps. */
function simulate(car: Car, input: CarInput, seconds: number, onTrack = true, step = 1 / 60) {
  let t = 0;
  while (t < seconds - 1e-9) {
    const dt = Math.min(step, seconds - t);
    car.update(dt, input, onTrack);
    t += dt;
  }
}

describe('Car', () => {
  it('starts at rest at the origin', () => {
    const car = new Car();
    expect(car.position.x).toBe(0);
    expect(car.position.z).toBe(0);
    expect(car.speed).toBe(0);
    expect(car.yaw).toBe(0);
  });

  it('accelerates forward when W is held and travels in -Z direction at yaw=0', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 1.0);
    expect(car.speed).toBeGreaterThan(0);
    // Default forward is -Z when yaw=0.
    expect(car.position.z).toBeLessThan(0);
    expect(Math.abs(car.position.x)).toBeLessThan(1e-6);
  });

  it('arrow up acts the same as W', () => {
    const a = new Car();
    const b = new Car();
    simulate(a, makeInput('w'), 0.5);
    simulate(b, makeInput('arrowup'), 0.5);
    expect(b.speed).toBeCloseTo(a.speed, 5);
    expect(b.position.z).toBeCloseTo(a.position.z, 5);
  });

  it('does not exceed max forward speed', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 30); // way past saturation
    expect(car.speed).toBeLessThanOrEqual(DEFAULT_CAR_PHYSICS.maxSpeed + 1e-6);
    expect(car.speed).toBeGreaterThan(DEFAULT_CAR_PHYSICS.maxSpeed - 0.01);
  });

  it('S brakes (does not reverse) while moving forward', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 1.0);
    const speedAfterAccel = car.speed;
    expect(speedAfterAccel).toBeGreaterThan(DEFAULT_CAR_PHYSICS.stopThreshold);

    simulate(car, makeInput('s'), 0.2);
    expect(car.speed).toBeGreaterThanOrEqual(0);
    expect(car.speed).toBeLessThan(speedAfterAccel);
  });

  it('S reverses once the car has come to a stop', () => {
    const car = new Car();
    // Already at rest — S should arm reverse immediately.
    simulate(car, makeInput('s'), 0.5);
    expect(car.speed).toBeLessThan(0);
    // And does not exceed reverse cap.
    simulate(car, makeInput('s'), 30);
    expect(car.speed).toBeGreaterThanOrEqual(-DEFAULT_CAR_PHYSICS.maxReverseSpeed - 1e-6);
    expect(car.speed).toBeLessThan(-DEFAULT_CAR_PHYSICS.maxReverseSpeed + 0.5);
  });

  it('reverse moves the car along +Z (opposite of forward) at yaw=0', () => {
    const car = new Car();
    simulate(car, makeInput('s'), 1.0);
    expect(car.speed).toBeLessThan(-0.1);
    // yaw=0 → forward is -Z, so reverse should move +Z.
    expect(car.position.z).toBeGreaterThan(0);
    expect(Math.abs(car.position.x)).toBeLessThan(1e-6);
  });

  it('reverse top speed is much lower than forward top speed', () => {
    expect(DEFAULT_CAR_PHYSICS.maxReverseSpeed).toBeLessThan(
      DEFAULT_CAR_PHYSICS.maxSpeed * 0.4,
    );
  });

  it('forward top speed reaches roughly 250 km/h (≈70 m/s)', () => {
    const kmh = DEFAULT_CAR_PHYSICS.maxSpeed * 3.6;
    expect(kmh).toBeGreaterThan(240);
    expect(kmh).toBeLessThanOrEqual(260);
  });

  it('arrowdown from rest also reverses (parity with S)', () => {
    const a = new Car();
    const b = new Car();
    simulate(a, makeInput('s'), 0.4);
    simulate(b, makeInput('arrowdown'), 0.4);
    expect(b.speed).toBeCloseTo(a.speed, 5);
  });

  it('coasts to a stop via rolling resistance when no input is held', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 0.5);
    const peak = car.speed;
    expect(peak).toBeGreaterThan(0);
    simulate(car, makeInput(), 5); // no inputs
    expect(car.speed).toBe(0);
  });

  it('cannot steer meaningfully while stationary', () => {
    const car = new Car();
    simulate(car, makeInput('a'), 1.0); // steering only, no throttle
    expect(car.yaw).toBeCloseTo(0, 5);
  });

  it('steers left (positive yaw) with A while moving forward', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 1.0); // build speed first
    const yawBefore = car.yaw;
    simulate(car, makeInput('w', 'a'), 0.5);
    expect(car.yaw).toBeGreaterThan(yawBefore);
  });

  it('steers right (negative yaw) with D while moving forward', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 1.0);
    simulate(car, makeInput('w', 'd'), 0.5);
    expect(car.yaw).toBeLessThan(0);
  });

  it('inverts steering while reversing so the car backs the way you point', () => {
    const car = new Car();
    simulate(car, makeInput('s'), 1.5); // build reverse speed
    expect(car.speed).toBeLessThan(-1);
    const yawBefore = car.yaw;
    // Pressing A while reversing should rotate yaw negative
    // (mirroring real-world reverse steering feel).
    simulate(car, makeInput('s', 'a'), 0.5);
    expect(car.yaw).toBeLessThan(yawBefore);
  });

  it('off-track applies extra drag and slows the car faster than on-track coasting', () => {
    const onTrack = new Car();
    const offTrack = new Car();
    simulate(onTrack, makeInput('w'), 1.0);
    simulate(offTrack, makeInput('w'), 1.0);
    // Match speeds, then coast.
    expect(onTrack.speed).toBeCloseTo(offTrack.speed, 5);

    simulate(onTrack, makeInput(), 0.3, true);
    simulate(offTrack, makeInput(), 0.3, false);
    expect(offTrack.speed).toBeLessThan(onTrack.speed);
  });

  it('off-track does not accelerate the car (only drags toward zero)', () => {
    const car = new Car();
    car.speed = 0;
    simulate(car, makeInput(), 1.0, false);
    expect(car.speed).toBe(0);
  });

  it('forward() returns a unit vector along -Z at yaw=0', () => {
    const car = new Car();
    const f = car.forward();
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.z).toBeCloseTo(-1, 6);
    expect(f.length()).toBeCloseTo(1, 6);
  });

  it('forward() rotates with yaw', () => {
    const car = new Car();
    car.yaw = Math.PI / 2;
    const f = car.forward();
    // yaw = +90° → forward should point along -X
    expect(f.x).toBeCloseTo(-1, 6);
    expect(f.z).toBeCloseTo(0, 6);
  });
});