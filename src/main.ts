import { Engine } from './core/Engine';
import { Input } from './core/Input';
import { GameState } from './core/GameState';
import { LapTracker } from './core/LapTracker';
import { Car } from './entities/Car';
import { CarView } from './entities/CarView';
import { CheckpointMarker } from './entities/CheckpointMarker';
import { World } from './scene/World';
import { RaceTrack } from './levels/RaceTrack';
import { HUD } from './ui/HUD';
import { SoundManager } from './audio/SoundManager';

const TOTAL_LAPS = 3;

const input = new Input();
const world = new World();
const track = new RaceTrack(world.scene);

const car = new Car();
car.position.copy(track.startPosition);
car.position.y = track.heightAt(car.position.x, car.position.z);
car.yaw = track.startYaw;

const carView = new CarView(car);
world.scene.add(carView.group);

// Visual checkpoint markers disabled — minimal track aesthetic per design
const markers: CheckpointMarker[] = [];
void CheckpointMarker; // suppress unused-import warning

const lapTracker = new LapTracker(track.checkpoints, track.startLine, TOTAL_LAPS);
const gameState = new GameState(TOTAL_LAPS);
const hud = new HUD();
const sounds = new SoundManager();

function refreshCheckpointVisuals() {
  for (const m of markers) {
    if (m.checkpoint.index < lapTracker.nextCheckpointIndex) m.setStatus('past');
    else if (m.checkpoint.index === lapTracker.nextCheckpointIndex) m.setStatus('next');
    else m.setStatus('future');
  }
}

const engine = new Engine((dt) => {
  // Pure logic
  const onTrack = track.isOnTrack(car.position.x, car.position.z);
  car.update(dt, input, onTrack);
  // Follow track elevation (climbs at Eau Rouge, etc.)
  car.position.y = track.heightAt(car.position.x, car.position.z);

  const prevCheckpointIdx = lapTracker.nextCheckpointIndex;
  const prevLapsCompleted = lapTracker.lapsCompleted;
  lapTracker.update(car.position.x, car.position.z);

  if (
    lapTracker.nextCheckpointIndex !== prevCheckpointIdx ||
    lapTracker.lapsCompleted !== prevLapsCompleted
  ) {
    refreshCheckpointVisuals();
  }

  gameState.tick(dt);
  gameState.syncLaps(lapTracker.lapsCompleted, lapTracker.finished);

  // Rendering layer
  carView.update(dt);
  world.followCar(car.position, car.yaw, dt);
  hud.update(gameState, car.speed);

  // Audio layer
  const accelInput = input.isDown('w') ? 1 : input.isDown('s') ? -0.5 : 0;
  const steerInput = (input.isDown('a') ? 1 : 0) + (input.isDown('d') ? -1 : 0);
  sounds.updateEngineSound(car.speed, car.physics.maxSpeed, Math.max(0, accelInput));
  sounds.updateTireSqueals(Math.abs(steerInput) * 0.5, car.speed);

  world.render();
});

engine.start();