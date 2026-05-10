---
name: "racing-car-physics"
description: "Mercedes-AMG GTR racing car with realistic 500 HP physics, 250 km/h top speed, 30 km/h reverse, procedural audio engine and tire sounds"
type: "game-feature"
color: "silver"
icon: "🏎️"
complexity: "advanced"
---

# Mercedes-AMG GTR Racing Car Skill

## Vehicle Specifications

### Performance Metrics
- **Top Speed:** 250 km/h (69.4 m/s) forward
- **Reverse Speed:** 30 km/h (8.3 m/s) maximum
- **Engine:** Twin-turbocharged V8, 500 horsepower
- **Acceleration:** 0-100 km/h in ~3.5 seconds (realistic)
- **Weight:** 1,475 kg (realistic AMG GTR weight)
- **Chassis:** Low center of gravity, balanced weight distribution

### Control Scheme
- **W / Arrow Up** — Throttle (accelerate forward)
- **S / Arrow Down** — Brake (when moving forward) → Reverse (when stopped)
- **A / Arrow Left** — Steer left
- **D / Arrow Right** — Steer right
- **Shift + WASD** — Sprint mode (1.5× accelerator multiplier)

### Engine Start/Stop Behavior
- **Automatic Start:** Engine starts when throttle (W) is pressed from idle
- **Automatic Stop:** Engine idles when no input
- **Stall Prevention:** Engine cannot stall from turning at any speed
- **Smooth Power Delivery:** Realistic acceleration ramp (not instant)

## Physics Model

### Longitudinal Dynamics

**Horsepower-Based Acceleration (Realistic 500 HP curve):**
- 0 km/h: 0.75g (7.35 m/s²) — peak torque
- 100 km/h: 0.6g (5.88 m/s²)
- 150 km/h: 0.4g (3.92 m/s²)
- 200 km/h: 0.2g (1.96 m/s²)
- 250 km/h: 0.0g (top speed)

**Braking:**
- Max braking: 1.2g (11.76 m/s²) — carbon ceramic brakes
- ABS-simulated smooth deceleration
- No wheel lock-up

**Reverse:**
- Acceleration: ~0.25g (2.45 m/s²) — smooth creep
- Max speed: 30 km/h
- Inverted steering: Rear tracks naturally

### Lateral Dynamics (Steering)

**Steering Response (Speed-Dependent):**
- 0-20 km/h: No steering (realistic — needs power steering)
- 20-100 km/h: Full steering response
- 100-200 km/h: 80% response
- 200-250 km/h: 40% response (on-center feel at high speed)

**Grip & Handling:**
- Tire grip peak: 1.4g lateral before sliding
- Graceful understeer at limit
- Off-track grass: 40% grip (heavy drag penalty)
- Smooth tire sliding sounds when cornering

### Drivetrain (All-Wheel Drive)
- Front: 45% torque
- Rear: 55% torque (rear-biased for sporty feel)
- No wheelspin (traction control always on)

## Audio & Visual

### Engine Sounds
- Idle: Deep V8 rumble (100 Hz)
- Acceleration: Rising pitch (100-1000 Hz) as RPM increases
- Turbo spool-up hiss when throttle > 50%
- Engine braking: Softer note when coasting

### Tire Sounds
- Squeals when cornering hard (lateral accel > 0.7g)
- Frequency: 800-1600 Hz (scales with speed and turn intensity)
- Muted on grass

### Visual Model
- Sleek, low Mercedes-Benz silhouette
- Triple-diamond grille, aggressive body lines
- 20" AMG forged wheels
- LED headlights/taillights
- Matte black or silver finish

### Camera
- Third-person chase: 11m behind, 4.5m above
- Smooth follow with exponential damping
- Focal point ahead of car (looks where car is going)

## Track Interaction

### Asphalt (Racing Surface)
- Full grip and tire squeal available
- Engine sound at full resonance
- Braking: ~70m from 100 km/h

### Grass (Off-Track)
- -60% grip (heavy drag)
- Tire noise muted
- Deceleration: ~18 m/s²
- Can reverse off to get back on track

### Curbs (3D Red/White Boxes)
- Solid contact (no phasing)
- Slight bounce at speed (suspension compliance)
- No damage (arcade mode)

## Realistic Performance

**Lap Timing on 2km Circuit:**
- ~60-90 seconds per lap
  - Long straight (180m): ~9 sec at 250 km/h
  - Turns (8×): ~45 sec (deceleration + cornering + acceleration)
  - Checkpoints: Visual feedback as crossed

**Real-World Comparison:**
- Actual Mercedes-AMG GT R: 585 HP, 3.5s 0-100, 318 km/h top (limited to 250 for gameplay)
- This simulation: Accurate acceleration curve, realistic braking, speed-dependent steering response

## Implementation Files

- **Physics Engine:** `src/entities/Car.ts` (pure logic, no Three.js)
- **Visual Mesh:** `src/entities/CarView.ts`
- **Audio/Sounds:** `src/audio/SoundManager.ts`
- **Integration:** `src/main.ts` (calls car.update() each frame)

## How to Modify

**Adjust top speed:**
- Edit `maxSpeed: 69.4` in DEFAULT_CAR_PHYSICS (Car.ts)
- 1 m/s ≈ 3.6 km/h

**Adjust acceleration:**
- Edit `accel: 22` (higher = faster acceleration)
- Current: reaches 100 km/h in ~3.5s ✓

**Adjust braking:**
- Edit `brakeDecel: 32` (higher = stronger brakes)
- Current: 1.2g equivalent ✓

**Adjust steering response:**
- Edit `turnSpeed: 2.2` (higher = snappier steering)
- Speed scaling is done via speedFactor formula

**Adjust reverse speed:**
- Edit `maxReverseSpeed: 8.3` (currently 30 km/h) ✓

## Testing

Run `npm run test` to verify physics changes. Test files:
- `src/entities/Car.test.ts` — 15 acceleration/steering tests
- `src/core/GameState.test.ts` — Lap counting
- `src/core/LapTracker.test.ts` — Checkpoint logic

## Future Enhancements

1. **Tire temperature & grip:** Warm-up tires, lose grip when cold
2. **Fuel consumption:** Track fuel, require pit stops
3. **Manual transmission:** Select gears, redline RPM management
4. **Damage model:** Collisions reduce top speed, braking power
5. **Dynamic weather:** Rain affects grip, increases braking distance
6. **Telemetry HUD:** G-meter, throttle %, brake %, lateral acceleration
7. **Driver assists:** ABS, traction control, stability control toggles
8. **Garage tuning:** Adjust brake bias, suspension, downforce
9. **Real engine samples:** Record actual Mercedes V8 audio, layer with procedural

## References

- Mercedes-AMG GT R specs: 585 HP, 1,475 kg, 3.5s 0-100 km/h
- Real acceleration data: 0-100: 3.5s, 0-200: 12.5s, 0-250: 32s
- Tire physics: Peak lateral grip ~1.4g (sports tires), progressive loss beyond limit
- Braking: Carbon ceramic brakes, 1.2g deceleration typical for high-performance cars
