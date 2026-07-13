// Game lifecycle: attempt reset, level advance, retry, game over.

import { game, freshUnlocks, saveProgress, applyCheats } from './state.js';
import { START_LIVES } from './config.js';
import { genTerrain, resetTerrain, pickRealPad } from './terrain.js';
import { createLander } from './lander.js';
import { placeCannons } from './cannons.js';
import { resetAsteroids } from './asteroids.js';
import { entry, entryReset } from './hiscores.js';

export function reset() {
  game.lander = createLander();
  game.particles = [];
  game.slugs = [];
  game.bombs = [];
  game.booms = [];
  resetTerrain(); // craters heal on retry, like the cannons below
  pickRealPad();  // decoy era: the real pad is re-rolled every attempt
  placeCannons(); // destroyed cannons come back on retry
  // grace period before the cannons open fire, randomly spread — a linear
  // per-index stagger made high cannon counts fire in a one-by-one chain
  game.cannons.forEach(c => { c.cooldown = 120 + Math.random() * 150; });
  resetAsteroids();
  game.lifeAwarded = false;
  game.landingBreakdown = null;
  game.state = 'flying';
}

// start over from scratch: game over, or the menu's RESET PROGRESS
export function freshRun() {
  game.credits = 0;
  game.score = 0;
  entryReset(); // hiscores themselves live under their own key and survive
  game.level = game.startLevel;
  game.lives = START_LIVES;
  game.unlocks = freshUnlocks();
  game.assistOn = false;
  applyCheats(); // a cheated run stays cheated
  genTerrain();
  reset();
  saveProgress();
}

// continue after a landing (next level), a crash (retry),
// or a game over (fresh run from the start level)
export function advance() {
  if (game.state === 'crashed' && game.lives <= 0) {
    if (entry.active) return; // name entry owns the input until confirmed
    freshRun();
    return;
  }
  if (game.state === 'landed') {
    game.level++;
    genTerrain();
  }
  reset();
  saveProgress();
}
