# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser-based 3D game built with **Three.js** and **TypeScript**, bundled with **Vite**.

## Current Project: Racing Game

An arcade racing simulator with two-player split-screen, a Spa-Francorchamps inspired circuit, and full 3D elevation.

### World
- **1500 × 1500 m** grass plain populated with **~600 procedural trees, 50 houses, 120 cheering spectators** (all auto-distributed off the track with safety buffers).
- **~3.4 km Spa-inspired circuit** with 12 segments and realistic elevation profile (Eau Rouge climbs Y=0 → 25 m, Kemmel runs at altitude, embankments support elevated sections).
- **Embankment skirts** beneath elevated road so it doesn't float — slope from track shoulder down to grass.
- **Banner barriers** placed along the outer edge every ~28 m (mixed colours, double-sided panels).
- **Inner red curbs** on the inside of every corner, flush with the road and following elevation.
- **Checkered start/finish line** at the far end of the start straight.

### Split-screen 2 players
- **Vertical split** — left half = Player 1, right half = Player 2.
- **P1 controls (red car):** W/A/S/D.
- **P2 controls (blue car):** Arrow keys.
- Each player has independent chase camera (2.5 m above, 6 m behind), lap counter, timer, and speedometer.
- Cars collide and bounce off each other (soft impact loses 30 % speed per side).
- First player to finish 3 laps triggers the shared "P1/P2 Wins!" overlay.

### Car (Mercedes-AMG GTR per `.claude/skills/car/SKILL.md`)
- Horsepower-curve acceleration (0.75 g → 0 g across 0 → 250 km/h).
- 1.2 g+ braking; speed-dependent steering response with 20 km/h deadzone.
- **Steering-induced drag** — the longer A/D (or arrow left/right) is held, the more longitudinal speed bleeds (caps at ~0.5 g). Resets on release.
- Falls to grass level (Y = 0) under gravity if it leaves an elevated road section.

### HUD & game loop
- Two HUDs (one per player half) with lap, time, speed.
- Shared end-of-race overlay when either player completes 3 laps.

## Agents
.
**Prefer using specialized agents rather than implementing directly.** Available agents:

- **game-feature-builder** — Use for implementing new game features, levels, mechanics, UI systems, and content additions. This agent handles architecture decisions, design validation, integration testing, and full implementation lifecycle.
- **docs-explorer** — Use for searching and synthesizing documentation across frameworks and libraries (Three.js, TypeScript, Vite, Vitest, physics libraries). Efficiently finds API details, best practices, and implementation guidance.
- **game-debugger** — Use when debugging unexpected behavior, crashes, or misbehavior in the 3D game. Traces root causes for physics issues, rendering problems, game state inconsistencies, and performance problems using systematic debugging methodology.
- **code-review-commit** — Use for reviewing newly written code in the current commit for performance issues, code quality, and readability. Focuses exclusively on changes in the current commit, not the entire codebase.

When you have a feature request, use the agent to design and implement it rather than coding directly. Agents provide better validation, testing, and architectural oversight.

## Engine: Three.js
Three.js was chosen for its:
- Largest WebGL ecosystem and community
- Full control over game architecture (not opinionated)
- Excellent TypeScript types (`@types/three`)
- Native GLTF/asset loader support
- Easy integration with physics libs (`@dimforge/rapier3d` or `cannon-es`)

## Commands

```bash
npm install         # Install dependencies
npm run dev         # Dev server with HMR at localhost:5173
npm run build       # Production build → dist/
npm run preview     # Preview production build locally
npm run lint        # Run ESLint
npm run test        # Run Vitest (all tests, single pass)
npm run test:watch  # Run Vitest in watch mode (TDD workflow)
```

## Testing (TDD)

**Vitest** is the test runner (shares Vite config, no extra setup). Tests live alongside source files as `*.test.ts`.

The critical architectural rule for TDD: **game logic must not depend on the renderer.** Three.js `WebGLRenderer` requires a real GPU/canvas and cannot run in jsdom. Keep logic (physics step, entity state, input processing, game rules) in pure classes that accept Three.js math types (`Vector3`, `Quaternion`) but never reference `WebGLRenderer` or `Scene` directly. Tests can then import and exercise logic without a browser.

```
src/core/Engine.test.ts      # Test game loop timing, delta, pause/resume
src/core/Input.test.ts       # Test key state mapping
src/entities/Player.test.ts  # Test movement, collision response logic
```

## Architecture

```
src/
  main.ts         # Entry — wires up Renderer, Scene, Camera, starts Engine
  core/
    Engine.ts     # requestAnimationFrame loop, delta time, pause/resume
    Input.ts      # Keyboard/mouse state, pointer lock
  scene/
    World.ts      # Scene graph, lighting, fog, environment
  entities/       # Player, enemies, interactable objects
  assets/         # GLTF loaders, texture helpers
public/           # Static assets (models, textures) — served as-is by Vite
index.html        # Vite entry point
```
    
Key Three.js objects flow: `WebGLRenderer` → `Scene` → `PerspectiveCamera` → `Engine` game loop calls `renderer.render(scene, camera)` each frame.

**Renderer boundary:** `World.ts` and `entities/` own Three.js scene objects. `Engine.ts` drives the loop and calls update on all systems — but the logic within each system is pure and testable without a GPU.

Physics (if added): integrate Rapier or cannon-es in `Engine.ts`, step the physics world before rendering.

---

# Skills (Full Reference)

The following sections are full copies of the skill files in `.claude/skills/`. **Always consult these specifications when modifying the corresponding game systems.**

---

## Skill: Racing Car Physics

**Source:** `.claude/skills/car/SKILL.md`
**Type:** game-feature | **Color:** silver | **Icon:** 🏎️ | **Complexity:** advanced
**Description:** Mercedes-AMG GTR racing car with realistic 500 HP physics, 250 km/h top speed, 30 km/h reverse, procedural audio engine and tire sounds

### Vehicle Specifications

#### Performance Metrics
- **Top Speed:** 250 km/h (69.4 m/s) forward
- **Reverse Speed:** 30 km/h (8.3 m/s) maximum
- **Engine:** Twin-turbocharged V8, 500 horsepower
- **Acceleration:** 0-100 km/h in ~3.5 seconds (realistic)
- **Weight:** 1,475 kg (realistic AMG GTR weight)
- **Chassis:** Low center of gravity, balanced weight distribution

#### Control Scheme
- **W / Arrow Up** — Throttle (accelerate forward)
- **S / Arrow Down** — Brake (when moving forward) → Reverse (when stopped)
- **A / Arrow Left** — Steer left
- **D / Arrow Right** — Steer right
- **Shift + WASD** — Sprint mode (1.5× accelerator multiplier)

#### Engine Start/Stop Behavior
- **Automatic Start:** Engine starts when throttle (W) is pressed from idle
- **Automatic Stop:** Engine idles when no input
- **Stall Prevention:** Engine cannot stall from turning at any speed
- **Smooth Power Delivery:** Realistic acceleration ramp (not instant)

### Physics Model

#### Longitudinal Dynamics

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

#### Lateral Dynamics (Steering)

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

#### Drivetrain (All-Wheel Drive)
- Front: 45% torque
- Rear: 55% torque (rear-biased for sporty feel)
- No wheelspin (traction control always on)

### Audio & Visual

#### Engine Sounds
- Idle: Deep V8 rumble (100 Hz)
- Acceleration: Rising pitch (100-1000 Hz) as RPM increases
- Turbo spool-up hiss when throttle > 50%
- Engine braking: Softer note when coasting

#### Tire Sounds
- Squeals when cornering hard (lateral accel > 0.7g)
- Frequency: 800-1600 Hz (scales with speed and turn intensity)
- Muted on grass

#### Visual Model
- Sleek, low Mercedes-Benz silhouette
- Triple-diamond grille, aggressive body lines
- 20" AMG forged wheels
- LED headlights/taillights
- Matte black or silver finish

#### Camera
- Third-person chase: 11m behind, 4.5m above
- Smooth follow with exponential damping
- Focal point ahead of car (looks where car is going)

### Track Interaction

#### Asphalt (Racing Surface)
- Full grip and tire squeal available
- Engine sound at full resonance
- Braking: ~70m from 100 km/h

#### Grass (Off-Track)
- -60% grip (heavy drag)
- Tire noise muted
- Deceleration: ~18 m/s²
- Can reverse off to get back on track

#### Curbs (3D Red/White Boxes)
- Solid contact (no phasing)
- Slight bounce at speed (suspension compliance)
- No damage (arcade mode)

### Realistic Performance

**Lap Timing on 2km Circuit:**
- ~60-90 seconds per lap
  - Long straight (180m): ~9 sec at 250 km/h
  - Turns (8×): ~45 sec (deceleration + cornering + acceleration)
  - Checkpoints: Visual feedback as crossed

**Real-World Comparison:**
- Actual Mercedes-AMG GT R: 585 HP, 3.5s 0-100, 318 km/h top (limited to 250 for gameplay)
- This simulation: Accurate acceleration curve, realistic braking, speed-dependent steering response

### Implementation Files (Car)

- **Physics Engine:** `src/entities/Car.ts` (pure logic, no Three.js)
- **Visual Mesh:** `src/entities/CarView.ts`
- **Audio/Sounds:** `src/audio/SoundManager.ts`
- **Integration:** `src/main.ts` (calls car.update() each frame)

### How to Modify (Car)

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

### Testing (Car)

Run `npm run test` to verify physics changes. Test files:
- `src/entities/Car.test.ts` — 15 acceleration/steering tests
- `src/core/GameState.test.ts` — Lap counting
- `src/core/LapTracker.test.ts` — Checkpoint logic

### Future Enhancements (Car)

1. **Tire temperature & grip:** Warm-up tires, lose grip when cold
2. **Fuel consumption:** Track fuel, require pit stops
3. **Manual transmission:** Select gears, redline RPM management
4. **Damage model:** Collisions reduce top speed, braking power
5. **Dynamic weather:** Rain affects grip, increases braking distance
6. **Telemetry HUD:** G-meter, throttle %, brake %, lateral acceleration
7. **Driver assists:** ABS, traction control, stability control toggles
8. **Garage tuning:** Adjust brake bias, suspension, downforce
9. **Real engine samples:** Record actual Mercedes V8 audio, layer with procedural

### References (Car)

- Mercedes-AMG GT R specs: 585 HP, 1,475 kg, 3.5s 0-100 km/h
- Real acceleration data: 0-100: 3.5s, 0-200: 12.5s, 0-250: 32s
- Tire physics: Peak lateral grip ~1.4g (sports tires), progressive loss beyond limit
- Braking: Carbon ceramic brakes, 1.2g deceleration typical for high-performance cars

---

## Skill: Spa-Francorchamps Circuit

**Source:** `.claude/skills/track/SKILL.md`
**Type:** game-feature | **Color:** blue | **Icon:** 🏁 | **Complexity:** expert
**Region:** Ardennes, Belgium | **Real-world Reference:** Circuit de Spa-Francorchamps
**Image:** `.claude/skills/track/assets/track-top-view.png`
**Description:** High-speed racing circuit inspired by Spa-Francorchamps in Belgium: 7.4km lap with iconic corners (Eau Rouge, Pouhon, Les Combes), elevation changes, technical sections, and weather challenges

### Circuit Overview

#### Historical Context
- **Real Circuit:** Spa-Francorchamps in the Ardennes region of Belgium
- **Length:** 7.4 km (game version: 7.2 km for arcade balance)
- **Elevation Change:** +51m to -55m (dramatic terrain)
- **Famous for:** High-speed racing, variable weather, challenging conditions
- **Used by:** Formula 1, WEC, motorcycle racing, touring cars
- **Racing Heritage:** Since 1925, one of the oldest racing circuits

#### Game Version Characteristics
- **Total Length:** ~7.2 km (realistic circuit)
- **Estimated Lap Time:** 2:30 - 3:30 minutes at racing pace (Mercedes-AMG GTR)
- **Track Width:** 10-15m (varies by section)
- **Curbs:** 3D red/white boxes, strategically placed at apex braking points
- **Surface:** Premium asphalt with racing line definition
- **Elevation:** 80m total elevation change (dramatic visually)
- **Sectors:** 3 distinct technical zones
- **Chicanes:** 2 major chicanes (Les Combes, Bus Stop)

### Circuit Layout & Corners

#### Sector 1: High-Speed Challenge (Starting Area)

**Turn 1: Eau Rouge (Water Red)**
- **Type:** Fast left-hander, climbing uphill
- **Speed:** 140+ km/h (fastest corner on track)
- **Difficulty:** Extreme — requires smooth throttle, no lifting
- **Elevation:** +18m climb
- **Characteristics:**
  - Blind apex, crest at entry
  - Immediately flows into Turn 2
  - Classic racing corner — tests bravery and smoothness
  - Variable weather hits hardest here (rain = aquaplaning risk)
- **Exit:** Flows into uphill straight toward Raidillon

**Turn 2: Raidillon (Steep)**
- **Type:** Right-hander, steeply climbing
- **Speed:** 160+ km/h (maintaining Eau Rouge speed)
- **Difficulty:** Very High — flat-out commitment required
- **Characteristics:**
  - Continues uphill from Eau Rouge
  - Second-gear corner minimum
  - Slight off-camber (car naturally pushes wide)
  - Essential to nail Eau Rouge → Raidillon combo for good lap times
- **Exit:** Crest, then long Kemmel straight ahead

**Kemmel Straight**
- **Length:** 1.1 km (one of longest F1 straights)
- **Speed Build:** 200+ km/h → 250 km/h (top speed)
- **Characteristics:**
  - Slightly uphill initially, then crests and descends
  - DRS zone alternative (if DRS were enabled)
  - Opportunity to make up time with clean air
  - Heavy braking zone ahead (prepare for Pouhon)

#### Sector 2: Technical Undulation (Mid-Circuit)

**Turn 3: Pouhon (Deep Dip)**
- **Type:** Fast left-hander, descending steeply
- **Speed:** 180+ km/h (heavy braking from 250 km/h straight)
- **Difficulty:** High — requires trail braking
- **Elevation:** -35m descent (lowest point on track)
- **Characteristics:**
  - Heavy braking while turning left (difficult combination)
  - Deep valley floor, severe downhill approach
  - Curbing tight at apex, forces precision
  - Classic Spa corner — character defining
  - Smooth line = fast time, scrappy line = time loss
- **Exit:** Slight climb up to Les Combes section

**Les Combes Chicane**
- **Type:** Tight left-right-left sequence, uphill
- **Speed:** 120-140 km/h (slow technical section)
- **Difficulty:** Medium — rhythm and precision
- **Characteristics:**
  - Three apexes, close together (1st left, 2nd right, 3rd left)
  - Elevation: +22m climb
  - Curbs punish deep entries (understeer-prone at speed)
  - Must be smooth and rhythmic to maintain momentum
  - Poor rhythm here tanks the entire lap

**Blanchimont (Fast Kink)**
- **Type:** Fast right-hander, descending
- **Speed:** 160+ km/h (barely lifting from Les Combes exit)
- **Difficulty:** Medium-High — speed management
- **Characteristics:**
  - Off-camber (tilts car toward outside)
  - Tight curbing on inside (track limits)
  - Flowing, needs smooth steering inputs
  - Sets up for Bus Stop chicane braking

#### Sector 3: Chicanes & Comeback (Lower Circuit)

**Bus Stop Chicane**
- **Type:** Tight left-right-left, descending
- **Speed:** 110-130 km/h (aggressive braking zone)
- **Difficulty:** High — rhythm and aggression balance
- **Characteristics:**
  - Final heavy braking zone before long straight home
  - Three tight apexes (very close to Kemmel straight spacing)
  - Elevation: -20m (bottom of circuit here)
  - Curbs very tight — clipping mandatory for racing line
  - Slight weight shift between left-right helps momentum
  - Smooth flow out is critical for acceleration on straight back

**Spa Straight (Return Straight)**
- **Length:** 0.8 km back to Eau Rouge start
- **Speed Build:** 110 km/h (Bus Stop exit) → 140+ km/h (Eau Rouge entry)
- **Characteristics:**
  - Long run-off area (safety feature, also recovery zone)
  - Slight elevation gain, tightens as approaches Eau Rouge
  - Mental reset point between laps
  - Last chance to prepare for demanding Eau Rouge

### Elevation Profile

```
Elevation Map (not to scale):

Raidillon (peak)
    ↑ +51m
    │     ╱╲
    │    ╱  ╲  Kemmel
    │   ╱    ╲  ╱╲
    │  ╱      ╲╱  ╲___
    │ ╱              ╲  Pouhon (valley floor)
    └─────────────────╲─ -55m
    Start/Finish (0m reference)
    
Total elevation range: 106m (very dramatic for a game track)
```

### Track Physics & Characteristics

#### Asphalt Zones
- **Premium Racing Line:** Full grip (100%), tire squeals active
- **Standard Asphalt:** 95% grip (slightly lower curbing areas)
- **Worn Runoff:** 85% grip (old sections, less prepared)

#### Surface Grip by Section
| Section | Grip | Tire Wear | Notes |
|---------|------|-----------|-------|
| Eau Rouge | 100% | High | Wettest naturally, most aquaplaning risk |
| Kemmel Straight | 100% | Medium | Clean, high-speed section |
| Pouhon | 100% | High | Demands precision, heavy braking |
| Les Combes | 95% | High | Rhythm-dependent, curbing tight |
| Bus Stop | 95% | Very High | Aggressive braking zone |
| Spa Straight | 90% | Low | Wide, forgiving runoff |

#### Curbing Strategy
- **Inside Curbs (Red):** Track limit enforcement, 1-2 tile clips OK
- **Outside Curbs (White):** Safety margin, avoid over-curbing
- **Aggressive Curbing Zones:**
  - Pouhon apex (inside)
  - Les Combes all apexes (inside)
  - Bus Stop all apexes (inside)
- **Clipping Reward:** Clean line through Eau Rouge → Raidillon → Kemmel = 4-5 km/h advantage

### Checkpoint Layout (5 Checkpoints per Lap)

| # | Corner | Position | Purpose |
|---|--------|----------|---------|
| 1 | Eau Rouge | Entry to fast left | Confirms high-speed section |
| 2 | Pouhon | Apex of descending left | Confirms braking into valley |
| 3 | Les Combes | Exit of chicane | Confirms technical section |
| 4 | Bus Stop | Exit of chicane | Confirms lower section |
| 5 | Spa Straight | Midpoint | Confirms lap completion |

### Weather & Environmental Effects

#### Clear Weather (Default)
- **Grip:** 100% baseline
- **Visibility:** Excellent
- **Lap Time:** 2:45-3:00 (competitive)
- **Racing Line Definition:** Sharp, clearly visible

#### Rainy Conditions (Future Feature)
- **Grip:** 65-75% (wet asphalt)
- **Aquaplaning Risk:** Eau Rouge and Kemmel most vulnerable
- **Visibility:** 80% (spray from other cars)
- **Lap Time:** +25-40 seconds per lap
- **Tire Temperature:** Takes longer to warm up
- **Braking Distance:** +40% (wet compound tires)
- **Characteristics:** Eau Rouge becomes extremely challenging (legendary Spa rain difficulty)

#### Variable Weather (Future Feature)
- **Wet Patches:** Random on track, 50% grip in patches
- **Drying Line:** Racing line dries first (visible as darker asphalt)
- **Tire Degradation:** Wet tires degrade quickly in sun, dry tires lack grip in wet
- **Strategy Element:** Pit stops for tire changes

### Visual & Audio Design

#### Visual Style
- **Landscape:** Ardennes forest backdrop (dark green trees)
- **Elevation:** Dramatic hillside changes visible
- **Sky:** Overcast/dramatic (typical Belgian weather)
- **Grandstands:** Sparse (street circuit feel)
- **Run-off:** Generous white-painted safety zones
- **Grass Verges:** Dark, well-maintained

#### Iconic Elements
- **Eau Rouge Signage:** Red water feature visual (water spray effects optional)
- **Kilometer Boards:** Trackside distance markers
- **Pit Lane:** Professional pit complex (if implemented)
- **Marshal Posts:** Flag stations at key corners

#### Audio Design
- **Engine Notes:**
  - Eau Rouge/Raidillon: Flat-out, high RPM scream
  - Pouhon braking zone: Engine braking + downshift sounds
  - Les Combes rhythm: Gear changes with corner entry/exit
- **Tire Squeals:**
  - Eau Rouge: Sustained squeal (high-speed turn)
  - Pouhon: Initial squeal then fade (braking + turning)
  - Bus Stop: Harsh squeals (aggressive chicane rhythm)
- **Ambient Sounds:** Wind (especially at elevation), crowd murmur

### Realistic Lap Time Estimates

**Mercedes-AMG GTR on Spa-Inspired Circuit:**
- **Qualifying Pace:** 2:35-2:45 (aggressive, high risk)
- **Race Pace:** 2:45-2:55 (consistent, tire management)
- **Beginners:** 3:30+ (learning lines and braking points)
- **Time Split Breakdown:**
  - Eau Rouge → Kemmel straight: 25 seconds
  - Pouhon → Les Combes: 35 seconds
  - Blanchimont → Bus Stop: 30 seconds
  - Spa Straight → Eau Rouge: 20 seconds
  - **Total:** ~2:50 realistic

### Implementation Details (Track)

#### Current Game Architecture
- **Track Definition:** `src/levels/RaceTrack.ts` (currently oval circuit)
- **Segments:** 20+ arc/straight segments defining centerline
- **Platforms:** Collision data for on-track detection
- **Checkpoints:** 5 ordered zones for lap counting
- **Curbs:** 3D boxes at strategic apexes

#### How to Build This Track

**Segment Order (Spa Layout):**
1. Start/Finish straight (0.8 km uphill)
2. Eau Rouge left-hander (fast, blind)
3. Raidillon right (steep climb)
4. Kemmel straight (1.1 km downhill, 250 km/h)
5. Pouhon left descending (braking zone)
6. Les Combes chicane (technical, 3 apexes)
7. Blanchimont right (off-camber)
8. Bus Stop chicane (3 apexes, downhill)
9. Spa straight return (0.8 km back)

**Grid Placement:**
- Start at Eau Rouge entrance (iconic location)
- Yellow grid lines on approach straight (F1-style)
- Pit lane offset to the right (typical circuit design)

#### File Structure
```
src/levels/SpaCircuit.ts
├── buildSegments()        — 20+ arc/straight definitions
├── buildGeometry()        — asphalt band + curbs + scenery
├── isOnTrack()           — collision detection
└── checkpoints[]         — 5 lap marker zones

src/audio/TrackAmbience.ts (future)
├── wind sounds (elevation-dependent)
├── crowd murmur
└── race broadcast radio chatter
```

### Modification Guide (Track)

#### Adjust Track Length
- Increase/decrease Kemmel or Spa straight lengths
- Each 100m = ~8-10 seconds lap time change

#### Add/Remove Checkpoints
- Current: 5 checkpoints per lap
- For longer circuit: 6-7 checkpoints recommended
- Place at: Eau Rouge, Pouhon, Les Combes exit, Bus Stop, Spa straight

#### Weather Implementation
- Rain grip multiplier: `onTrack ? 0.75 : 0.40` (dry: 1.0 / 0.60)
- Aquaplaning risk zones: Eau Rouge, Kemmel, Pouhon
- Visual: Darkened asphalt + water spray effects

#### Difficulty Scaling
- **Easy:** Gentle curbing, wide runoffs, forgiving physics
- **Normal:** Current specs (tight but fair)
- **Hard:** Tight curbing, reduced runoff, precision required

### Real-World References (Track)

#### Actual Spa-Francorchamps Statistics
- **Circuit Length:** 7.004 km (official F1 configuration)
- **Track Width:** 10-15 meters
- **Elevation Change:** 104 meters (51m rise, 55m fall)
- **Lap Record (F1):** 1:46.286 (2018, Max Verstappen, Red Bull)
- **Approximate Speed:** 195 km/h average (F1), 125 km/h average (road cars)
- **Corners:** 25 named turns (game version: 8 major corners)
- **Sectors:** 3 (Sector 1: Eau Rouge to Pouhon; Sector 2: Pouhon to Bus Stop; Sector 3: Bus Stop to Eau Rouge)

#### Circuit Character
- **Reputation:** "The driver's circuit" — rewards smoothness, punishes aggression
- **Weather:** Famous for rain, changeable conditions
- **Speed Profile:** Highest average speed in F1 (requires commitment)
- **Overtaking:** Limited (high-speed corners don't allow passes)
- **Mechanical Failures:** High attrition due to speed and bumps

### Future Enhancements (Track)

1. **Dynamic Weather System:** Rain showers moving across circuit
2. **Tire Temperature Simulation:** Cold tires at start, optimal window 15-25 laps
3. **Fuel Strategy:** 2-3 pit stops for 45-minute race
4. **Damage Model:** Curb strikes cause suspension damage, reduce grip
5. **Safety Car & Incidents:** Mechanical failures, virtual safety cars
6. **Historical Layouts:** Different era versions (1970s, 1990s, modern)
7. **Night Racing:** Floodlights, reduced visibility, dramatic lighting
8. **Crowd Reactions:** Audio cues for good/bad performances
9. **Pit Strategy Board:** Real-time strategy information
10. **Telemetry Comparison:** Compare lap to best lap sector-by-sector

### Testing & Validation (Track)

#### Lap Time Benchmarks
- ✅ Qualifying pace: 2:35-2:45 (Mercedes-AMG GTR)
- ✅ Race pace consistency: ±5 seconds per lap
- ✅ Beginner lap time: 3:30+
- ✅ Fuel consumption: ~0.8 liters per lap (if fuel enabled)
- ✅ Tire wear: 4-5 laps on fresh tires at race pace

#### Checkpoint Validation
- ✅ All 5 checkpoints visible and approachable
- ✅ No checkpoint is missable (all on racing line)
- ✅ Checkpoint gates are clearly marked (cyan when active)

#### Physics Verification
- ✅ No off-track shortcuts available
- ✅ Curb clipping rewarded (+0.5% speed benefit per clean clip)
- ✅ Grass runoff penalizes (60% grip loss)
- ✅ Elevation changes affect braking distances (-5% per 10m climb)

### References (Track)

- **Spa-Francorchamps Official:** https://www.spa-francorchamps.be/
- **F1 Circuit Guide:** Detailed layout and history
- **Historical Data:** Circuit has hosted F1 since 1950 (with exceptions)
- **Iconic Moments:** Senna vs. Prost (1993), Villeneuve crash (1982), modern F1 epics

---

## Skill: Review Code

**Source:** `.claude/skills/review-code/SKILL.md`
**Model:** sonnet | **Color:** cyan
**Description:** Review the current file or selection for JavaScript/TypeScript quality, design patterns, and optimization opportunities

You are an expert JavaScript and TypeScript code reviewer with deep knowledge of modern best practices, design patterns, and performance optimization. When invoked, review the code in context and provide structured, actionable feedback.

### Review Dimensions

**Correctness & Safety**
- Logic errors, off-by-one errors, null/undefined edge cases
- Type safety: missing types, `any` abuse, unsafe casts, missing generics
- Error handling: unhandled promise rejections, missing try/catch at boundaries
- Mutation of inputs, shared mutable state, race conditions

**Design & Architecture**
- Single Responsibility: does each function/class do one thing?
- Separation of concerns: is logic mixed with I/O, rendering, or framework glue?
- Favor composition over inheritance; flag deep class hierarchies
- Identify applicable design patterns (Strategy, Observer, Factory, Command, etc.) and suggest them where they simplify the code
- Watch for: God objects, primitive obsession, feature envy, shotgun surgery

**TypeScript Specifics**
- Prefer `interface` for public APIs, `type` for unions/intersections
- Use `readonly` and `const` assertions where values shouldn't mutate
- Avoid `as` casts — suggest type guards or narrowing instead
- Flag missing return types on exported functions
- Discriminated unions over optional properties for variant types
- `unknown` over `any`; `never` to assert exhaustive checks

**JavaScript Best Practices**
- Prefer `const`/`let` over `var`; flag `var` usage
- Avoid implicit coercions (`==`, `+` on mixed types)
- Destructuring, optional chaining (`?.`), nullish coalescing (`??`) where appropriate
- Async/await over raw promise chains for readability
- Avoid `arguments` object; use rest params instead
- No `eval`, no `with`, no `__proto__`

**Performance & Optimization**
- Unnecessary re-computation inside loops or render calls — suggest memoization or hoisting
- Excessive object allocation in hot paths (GC pressure)
- Missing `useMemo`/`useCallback` in React (if applicable)
- N+1 patterns in data fetching
- Synchronous operations that should be async
- Large bundle contributors: flag heavy imports that could be lazy-loaded

**Code Clarity**
- Names that lie: does the name reflect what the code actually does?
- Functions longer than ~30 lines — suggest extraction
- Deeply nested conditionals — suggest early returns or guard clauses
- Magic numbers/strings — suggest named constants
- Comments that explain *what* (the code already shows that) instead of *why*

### Output Format

Structure your review as:

#### Critical
Issues that are bugs, unsafe behavior, or type errors. Must fix.

#### Design
Structural improvements — patterns, abstractions, separation of concerns.

#### Optimization
Performance wins, unnecessary work, or bundle size concerns.

#### Polish
Naming, clarity, minor style improvements. Low priority but worth noting.
