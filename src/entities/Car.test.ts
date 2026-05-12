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
    // HP-curve asymptotes at max speed (skill spec: 0g acceleration at 250 km/h),
    // so 30s of throttle gets within ~5 km/h of maxSpeed but not exactly there.
    expect(car.speed).toBeGreaterThan(DEFAULT_CAR_PHYSICS.maxSpeed - 1.5);
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
    // Build reverse speed past the 20 km/h steering deadzone (skill: no steering below 20 km/h).
    // 0.25g reverse takes ~3.4s to reach max 30 km/h, so simulate 5s to be safely past 20 km/h.
    simulate(car, makeInput('s'), 5);
    expect(car.speed).toBeLessThan(-DEFAULT_CAR_PHYSICS.maxReverseSpeed * 0.9);
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

  it('decelerates while holding steering — longer hold = more drag', () => {
    // Get the car up to a meaningful speed first.
    const cornering = new Car();
    const straight = new Car();
    simulate(cornering, makeInput('w'), 3);
    simulate(straight, makeInput('w'), 3);
    expect(cornering.speed).toBeCloseTo(straight.speed, 5);

    // Now both throttle, but one steers while the other doesn't.
    simulate(cornering, makeInput('w', 'a'), 2.0);
    simulate(straight, makeInput('w'), 2.0);

    // Cornering car must be slower than the straight-line car.
    expect(cornering.speed).toBeLessThan(straight.speed);
    // And the steerHoldTime must have accumulated.
    expect(cornering.steerHoldTime).toBeGreaterThan(0);
  });

  it('releasing steering resets the cornering-drag timer', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 2);          // build speed
    simulate(car, makeInput('w', 'a'), 1.0);   // hold steering for 1s
    expect(car.steerHoldTime).toBeGreaterThan(0.5);

    simulate(car, makeInput('w'), 0.5);        // release steering for 0.5s
    expect(car.steerHoldTime).toBe(0);
  });

  it('off-track caps forward speed at the grass cap (~30 km/h)', () => {
    const car = new Car();
    // Hammer the throttle on grass — speed must not exceed the grass cap.
    simulate(car, makeInput('w'), 6, false);
    expect(car.speed).toBeLessThan(10);   // 8.3 m/s + a tiny margin
    expect(car.speed).toBeGreaterThan(6); // car is still moving meaningfully
  });

  it('off-track high-speed entry decelerates the car down to grass cap', () => {
    const car = new Car();
    car.speed = 30;                               // ~108 km/h on track
    simulate(car, makeInput('w'), 1.5, false);    // throttle on grass
    // Drag should pull it down toward 8.3 m/s
    expect(car.speed).toBeLessThan(10);
  });

  it('off-track car can still reverse, stop, and re-accelerate', () => {
    const car = new Car();
    // Drive forward to grass cap
    simulate(car, makeInput('w'), 4, false);
    expect(car.speed).toBeGreaterThan(6);
    // Brake then reverse
    simulate(car, makeInput('s'), 4, false);
    expect(car.speed).toBeLessThan(0);
    // Stop coasting
    simulate(car, makeInput(), 5, false);
    expect(car.speed).toBe(0);
  });

  it('steering responds (slowly) at very low speed (no hard deadzone above 0)', () => {
    const car = new Car();
    simulate(car, makeInput('w'), 0.4);  // a small touch of throttle, well under 50 km/h
    expect(car.speed).toBeGreaterThan(0);
    const yawBefore = car.yaw;
    simulate(car, makeInput('w', 'a'), 0.6);
    // Yaw should change measurably even at modest speed
    expect(car.yaw).toBeGreaterThan(yawBefore + 0.05);
  });
});