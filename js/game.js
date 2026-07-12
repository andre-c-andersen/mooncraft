// Game lifecycle: attempt reset, level advance, retry, game over.

import { game, freshUnlocks, saveProgress, applyCheats } from './state.js';
import { START_LIVES } from './config.js';
import { genTerrain } from './terrain.js';
import { createLander } from './lander.js';
import { placeCannons } from './cannons.js';
import { resetAsteroids } from './asteroids.js';

export function reset() {
  game.lander = createLander();
  game.particles = [];
  game.slugs = [];
  game.bombs = [];
  game.booms = [];
  placeCannons(); // destroyed cannons come back on retry
  // grace period before the cannons open fire, randomly spread — a linear
  // per-index stagger made high cannon counts fire in a one-by-one chain
  game.cannons.forEach(c => { c.cooldown = 120 + Math.random() * 150; });
  resetAsteroids();
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
    applyCheats(); // a cheated run stays cheated after game over
    genTerrain();
  }
  reset();
  saveProgress();
}
