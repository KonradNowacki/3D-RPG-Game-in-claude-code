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

// Scatter dense trees, houses, and spectators on the grass (off-track only)
new Decorations(world.scene, track, 700).scatter({ trees: 600, houses: 50, people: 120 });

// ── Player 1 (RED, WASD, left split) ──────────────────────────────────────
const car1 = new Car();
car1.position.copy(track.startPosition);
car1.position.x += 4; // small lateral offset so cars don't overlap at start
car1.position.y = track.heightAt(car1.position.x, car1.position.z);
car1.yaw = track.startYaw;

// ── Player 2 (BLUE, arrows, right split) ──────────────────────────────────
const car2 = new Car();
car2.position.copy(track.startPosition);
car2.position.x -= 4; // mirrored offset
car2.position.y = track.heightAt(car2.position.x, car2.position.z);
car2.yaw = track.startYaw;

const heightAt = (x: number, z: number): number => track.groundHeightAt(x, z);
const [carView1, carView2] = await Promise.all([
  CarView.create(car1, 0xd92b2b, heightAt), // red
  CarView.create(car2, 0x1e6ce6, heightAt), // blue
]);
world.scene.add(carView1.group);
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

const engine = new Engine((dt) => {
  // ── Update each car ─────────────────────────────────────────────────────
  updateCar(car1, p1Input, dt);
  updateCar(car2, p2Input, dt);

  // ── Car-vs-car collision: simple push-apart with energy loss ────────────
  resolveCarCollision(car1, car2);

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

function updateCar(car: Car, pInput: CarInput, dt: number): void {
  const onTrack = track.isOnTrack(car.position.x, car.position.z);
  car.update(dt, pInput, onTrack);
  car.position.y = track.groundHeightAt(car.position.x, car.position.z);
}

/**
 * Resolve car-vs-car collision: if the two cars are closer than CAR_RADIUS,
 * separate them along the contact normal (each pushed half the overlap) and
 * bleed speed on both as a soft bounce. Pure 2D (XZ) check — Y is ignored
 * so colliding while one car is mid-air (off-track fall) still works.
 */
function resolveCarCollision(a: Car, b: Car): void {
  const CAR_RADIUS = 1.8; // ~3.6m separation between centres (cars are 2×4m)
  const dx = a.position.x - b.position.x;
  const dz = a.position.z - b.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist <= 0 || dist >= CAR_RADIUS * 2) return;

  const overlap = CAR_RADIUS * 2 - dist;
  const nx = dx / dist;
  const nz = dz / dist;
  // Push apart by half-overlap each
  a.position.x += nx * overlap * 0.5;
  a.position.z += nz * overlap * 0.5;
  b.position.x -= nx * overlap * 0.5;
  b.position.z -= nz * overlap * 0.5;
  // Soft bounce: both lose 30% speed
  a.speed *= 0.7;
  b.speed *= 0.7;
}
