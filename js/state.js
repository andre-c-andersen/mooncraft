// Shared mutable game state. Leaf module: everything imports this,
// it imports nothing but config.

import { START_LIVES, START_FUEL, FUEL_TANK_STEP, START_BOMBS, VIEW_W, VIEW_H } from './config.js';

// debug/testing: pick the starting level via query param, e.g. ?level=4
const urlLevel = parseInt(new URLSearchParams(location.search).get('level'), 10);
const startLevel = urlLevel >= 1 ? urlLevel : 1;

export function freshUnlocks() {
  return {
    weapon: 0,      // 0 none, 1 bombs, 2 triple bomb, 3 super bombs, 4 triple super bomb
    assist: 0,      // 0 none, 1 level assist, 2 retro assist
    fuel: 0,        // fuel tank upgrades owned
    livesBought: 0, // for the progressive life price
  };
}

export const game = {
  W: VIEW_W,  // logical size — fixed; the canvas scales it to the screen
  H: VIEW_H,
  startLevel,
  terrain: [],   // list of {x, y}
  pads: [],      // list of {x1, x2, y, mult, color}
  stars: [],
  lander: null,
  particles: [],
  cannons: [],
  slugs: [],
  bombs: [],
  booms: [],
  state: 'flying', // flying | landed | crashed
  credits: 0,
  level: startLevel,
  lives: START_LIVES,
  unlocks: freshUnlocks(),
  assistOn: false,     // fly assist toggle state
  assistActive: false, // assist engaged this frame (for the HUD)
  lifeAwarded: false,  // bonus life granted on the current landing (for the HUD)
};

export function fuelCapacity() {
  return START_FUEL + game.unlocks.fuel * FUEL_TANK_STEP;
}

export function bombsPerAttempt() {
  return game.unlocks.weapon >= 1 ? START_BOMBS : 0;
}

export function bombsAreSuper() {
  return game.unlocks.weapon >= 3;
}

export function bombsAreTriple() {
  return game.unlocks.weapon === 2 || game.unlocks.weapon === 4;
}
