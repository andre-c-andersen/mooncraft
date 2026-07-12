// Game lifecycle: attempt reset, level advance, retry, game over.

import { game, freshUnlocks } from './state.js';
import { START_LIVES } from './config.js';
import { genTerrain } from './terrain.js';
import { createLander } from './lander.js';
import { placeCannons } from './cannons.js';

export function reset() {
  game.lander = createLander();
  game.particles = [];
  game.slugs = [];
  game.bombs = [];
  game.booms = [];
  placeCannons(); // destroyed cannons come back on retry
  // grace period before the cannons open fire, staggered per cannon
  game.cannons.forEach((c, i) => { c.cooldown = 120 + i * 75; });
  game.lifeAwarded = false;
  game.state = 'flying';
}

// continue after a landing (next level), a crash (retry),
// or a game over (fresh run from the start level)
export function advance() {
  if (game.state === 'landed') {
    game.level++;
    genTerrain();
  } else if (game.state === 'crashed' && game.lives <= 0) {
    game.credits = 0;
    game.level = game.startLevel;
    game.lives = START_LIVES;
    game.unlocks = freshUnlocks();
    game.assistOn = false;
    genTerrain();
  }
  reset();
}
