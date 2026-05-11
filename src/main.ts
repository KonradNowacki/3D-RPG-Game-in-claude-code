import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { GameState } from './core/GameState';
import { LapTracker } from './core/LapTracker';
import { Car, type CarInput } from './entities/Car';
import { CarView } from './entities/CarView';
import { Decorations } from './entities/Decorations';
import { World } from './scene/World';
import { RaceTrack } from './levels/RaceTrack';
import { HUD } from './ui/HUD';
import { SoundManager } from './audio/SoundManager';

const TOTAL_LAPS = 3;
const GRAVITY = 28; // m/s² (arcade-fast fall for off-track elevated drops)

// ── Input adapters: each player only sees their own key set ──────────────
/**
 * Wraps the raw Input so the Car only sees the half of the keyboard belonging
 * to one player. Player 1 = WASD, Player 2 = arrow keys.
 */
class FilteredInput implements CarInput {
  constructor(private readonly raw: Input, private readonly allowed: Set<string>) {}
  isDown(key: string): boolean {
    return this.allowed.has(key.toLowerCase()) && this.raw.isDown(key);
  }
}

const input = new Input();
const p1Input = new FilteredInput(input, new Set(['w', 'a', 's', 'd']));
const p2Input = new FilteredInput(
  input,
  new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']),
);

// ── World + Track ─────────────────────────────────────────────────────────
const world = new World();
const track = new RaceTrack(world.scene);

// Scatter trees, houses, and spectators on the grass (off-track only)
new Decorations(world.scene, track, 700).scatter({ trees: 220, houses: 30, people: 70 });

// ── Player 1 (RED, WASD, left split) ──────────────────────────────────────
const car1 = new Car();
car1.position.copy(track.startPosition);
car1.position.x += 4; // small lateral offset so cars don't overlap at start
car1.position.y = track.heightAt(car1.position.x, car1.position.z);
car1.yaw = track.startYaw;
const carView1 = new CarView(car1, 0xd92b2b); // red
world.scene.add(carView1.group);

// ── Player 2 (BLUE, arrows, right split) ──────────────────────────────────
const car2 = new Car();
car2.position.copy(track.startPosition);
car2.position.x -= 4; // mirrored offset
car2.position.y = track.heightAt(car2.position.x, car2.position.z);
car2.yaw = track.startYaw;
const carView2 = new CarView(car2, 0x1e6ce6); // blue
world.scene.add(carView2.group);

// ── Per-player race state ─────────────────────────────────────────────────
const lapTracker1 = new LapTracker(track.checkpoints, track.startLine, TOTAL_LAPS);
const lapTracker2 = new LapTracker(track.checkpoints, track.startLine, TOTAL_LAPS);
const gameState1 = new GameState(TOTAL_LAPS);
const gameState2 = new GameState(TOTAL_LAPS);
const hud1 = new HUD('left');
const hud2 = new HUD('right');

// One shared sound manager (mixing two cars later if needed; for now reacts to P1)
const sounds = new SoundManager();

// Vertical velocity for off-track fall behavior
let vy1 = 0;
let vy2 = 0;

const engine = new Engine((dt) => {
  // ── Update each car ─────────────────────────────────────────────────────
  updateCar(car1, p1Input, dt, () => { vy1 = stepVertical(car1, vy1, dt); }, () => { vy1 = 0; });
  updateCar(car2, p2Input, dt, () => { vy2 = stepVertical(car2, vy2, dt); }, () => { vy2 = 0; });

  // ── Lap tracking ────────────────────────────────────────────────────────
  lapTracker1.update(car1.position.x, car1.position.z);
  lapTracker2.update(car2.position.x, car2.position.z);

  gameState1.tick(dt);
  gameState2.tick(dt);
  gameState1.syncLaps(lapTracker1.lapsCompleted, lapTracker1.finished);
  gameState2.syncLaps(lapTracker2.lapsCompleted, lapTracker2.finished);

  // ── Render layer ────────────────────────────────────────────────────────
  carView1.update(dt);
  carView2.update(dt);
  world.followCar1(car1.position, car1.yaw, dt);
  world.followCar2(car2.position, car2.yaw, dt);
  hud1.update(gameState1, car1.speed);
  hud2.update(gameState2, car2.speed);

  // Audio — uses player 1's car for engine pitch (arcade simplification)
  const accelInput = input.isDown('w') ? 1 : input.isDown('s') ? -0.5 : 0;
  const steerInput = (input.isDown('a') ? 1 : 0) + (input.isDown('d') ? -1 : 0);
  sounds.updateEngineSound(car1.speed, car1.physics.maxSpeed, Math.max(0, accelInput));
  sounds.updateTireSqueals(Math.abs(steerInput) * 0.5, car1.speed);

  world.render();
});

engine.start();

// ── Helpers ───────────────────────────────────────────────────────────────
function updateCar(
  car: Car,
  pInput: CarInput,
  dt: number,
  onOffTrack: () => void,
  onOnTrack: () => void,
): void {
  const onTrack = track.isOnTrack(car.position.x, car.position.z);
  car.update(dt, pInput, onTrack);
  if (onTrack) {
    car.position.y = track.heightAt(car.position.x, car.position.z);
    onOnTrack();
  } else {
    onOffTrack();
  }
}

/**
 * Off-track vertical step: apply gravity, fall toward grass (Y=0), and clamp
 * once landed. Returns the new vy for the caller to persist between frames.
 */
function stepVertical(car: Car, vy: number, dt: number): number {
  vy -= GRAVITY * dt;
  car.position.y += vy * dt;
  if (car.position.y <= 0) {
    car.position.y = 0;
    return 0;
  }
  return vy;
}
