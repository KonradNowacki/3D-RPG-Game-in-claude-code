import { Engine } from './core/Engine';
import { Input  } from './core/Input';
import { GameState } from './core/GameState';
import { Player } from './entities/Player';
import { World  } from './scene/World';
import { Coin } from './entities/Coin';
import { Level1 } from './levels/Level1';
import { HUD } from './ui/HUD';

const input     = new Input();
const world     = new World();
const player    = new Player();
const level1    = new Level1(world.scene);
const gameState = new GameState();
const hud       = new HUD();
const coins     = level1.coinPositions.map(([x, y, z]) => new Coin(x, y, z));

world.scene.add(player.group);
coins.forEach(c => world.scene.add(c.mesh));

player.group.position.set(0, 0, -6);

const COLLECT_RADIUS = 1.2;
const fz = level1.finishZone;

const engine = new Engine((dt) => {

  player.update(dt, input, level1.platforms);

  // Coin collection
  for (const coin of coins) {
    if (!coin.collected && player.position.distanceTo(coin.mesh.position) < COLLECT_RADIUS) {
      coin.collected = true;
      coin.mesh.visible = false;
      gameState.collect();
    }
    if (!coin.collected) coin.update(dt);
  }

  // Finish zone trigger
  const p = player.position;
  if (!gameState.finished &&
      gameState.canFinish &&
      p.x >= fz.minX && p.x <= fz.maxX &&
      p.z >= fz.minZ && p.z <= fz.maxZ &&
      p.y >= fz.minY) {
    gameState.finish();
    hud.showWin();
  }

  hud.update(gameState);
  world.followCamera(player.position, player.yaw);
  world.render();
});

engine.start();
