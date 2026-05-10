import { Engine } from './core/Engine';
import { Input  } from './core/Input';
import { Player } from './entities/Player';
import { World  } from './scene/World';

const input  = new Input();
const world  = new World();
const player = new Player();

world.scene.add(player.group);

const engine = new Engine((dt) => {
  player.update(dt, input);
  world.followCamera(player.position, player.yaw);
  world.render();
});

engine.start();
